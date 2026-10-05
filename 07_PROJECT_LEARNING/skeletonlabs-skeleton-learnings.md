# Forensic Learning Record (Deep Inspection): skeletonlabs/skeleton

> **Canonical Artifact**: `07_PROJECT_LEARNING/skeletonlabs-skeleton-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/skeletonlabs/skeleton](https://github.com/skeletonlabs/skeleton))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-05T18:27:25.972Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `skeletonlabs/skeleton`
- **Description**: Skeleton is an adaptive design system powered by Tailwind CSS.
- **Primary Language / Ecosystem**: TypeScript
- **Discovered Manifests / Configurations**: package.json, README.md
- **Stars / Engagement**: 6066 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: package.json, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `packages/cli/src/commands/migrate/migrations/skeleton-3/utility/constants.ts`
```
import type { Theme } from './types.js';

const FALLBACK_THEME: Theme = {
	type: 'preset',
	value: 'cerberus',
};

export { FALLBACK_THEME };

```

### Core Architecture Module: `packages/cli/src/commands/migrate/migrations/skeleton-3/utility/export-mappings.ts`
```
interface Renamed {
	type: 'renamed';
	value: string;
}

interface Removed {
	type: 'removed';
}

const EXPORT_MAPPINGS: Record<
	string,
	{
		namedImport: Renamed | Removed;
		identifier: Renamed | Removed;
	}
> = {
	AccordionItem: {
		namedImport: {
			type: 'renamed',
			value: 'Accordion',
		},
		identifier: {
			type: 'renamed',
			value: 'Accordion.Item',
		},
	},
	AppShell: {
		namedImport: {
			type: 'removed',
		},
		identifier: {
			type: 'removed',
		},
	},
	Apollo: {
		namedImport: { type: 'removed' },
		identifier: { type: 'removed' },
	},
	AppRailAnchor: {
		namedImport: { type: 'removed' },
		identifier: { type: 'removed' },
	},
	Autocomplete: {
		namedImport: { type: 'removed' },
		identifier: { type: 'removed' },
	},
	BlueNight: {
		namedImport: { type: 'removed' },
		identifier: { type: 'removed' },
	},
	CodeBlock: {
		namedImport: { type: 'removed' },
		identifier: { type: 'removed' },
	},
	ConicGradient: {
		namedImport: { type: 'removed' },
		identifier: { type: 'removed' },
	},
	Drawer: {
		namedImport: { type: 'removed' },
		identifier: { type: 'removed' },
	},
	Emerald: {
		namedImport: { type: 'removed' },
		identifier: { type: 'removed' },
	},
	GreenFall: {
		namedImport: { type: 'removed' },
		identifier: { type: 'removed' },
	},
	LightSwitch: {
		namedImport: { type: 'removed' },
		identifier: { type: 'removed' },
	},
	ListBox: {
		namedImport: { type: 'removed' },
		identifier: { type: 'removed' },
	},
	ListBoxItem: {
		namedImport: { type: 'removed' },
		identifier: { type: 'removed' },
	},
	Modal: {
		namedImport: { type: 'removed' },
		identifier: { type: 'removed' },
	},
	Noir: {
		namedImport: { type: 'removed' },
		identifier: { type: 'removed' },
	},
	NoirLight: {
		namedImport: { type: 'removed' },
		identifier: { type: 'removed' },
	},
	RecursiveTreeView: {
		namedImport: { type: 'removed' },
		identifier: { type: 'removed' },
	},
	RecursiveTreeViewItem: {
		namedImport: { type: 'removed' },
		identifier: { type: 'removed' },
	},
	Rustic: {
		namedImport: { type: 'removed' },
		identifier: { type: 'removed' },
	},
	Step: {
		namedImport: { type: 'removed' },
		identifier: { type: 'removed' },
	},
	Stepper: {
		namedImport: { type: 'removed' },
		identifier: { type: 'removed' },
	},
	Summer84: {
		namedImport: { type: 'removed' },
		identifier: { type: 'removed' },
	},
	Table: {
		namedImport: { type: 'removed' },
		identifier: { type: 'removed' },
	},
	TableOfContents: {
		namedImport: { type: 'removed' },
		identifier: { type: 'removed' },
	},
	TreeView: {
		namedImport: { type: 'removed' },
		identifier: { type: 'removed' },
	},
	TreeViewItem: {
		namedImport: { type: 'removed' },
		identifier: { type: 'removed' },
	},
	XPro: {
		namedImport: { type: 'removed' },
		identifier: { type: 'removed' },
	},
	autoModeWatcher: {
		namedImport: { type: 'removed' },
		identifier: { type: 'removed' },
	},
	clipboard: {
		namedImport: { type: 'removed' },
		identifier: { type: 'removed' },
	},
	filter: {
		namedImport: { type: 'removed' },
		identifier: { type: 'removed' },
	},
	focusTrap: {
		namedImport: { type: 'removed' },
		identifier: { type: 'removed' },
	},
	getDrawerStore: {
		namedImport: { type: 'removed' },
		identifier: { type: 'removed' },
	},
	getModalStore: {
		namedImport: { type: 'removed' },
		identifier: { type: 'removed' },
	},
	getModeAutoPrefers: {
		namedImport: { type: 'removed' },
		identifier: { type: 'removed' },
	},
	getModeOsPrefers: {
		namedImport: { type: 'removed' },
		identifier: { type: 'removed' },
	},
	getModeUserPrefers: {
		namedImport: { type: 'removed' },
		identifier: { type: 'removed' },
	},
	getToastStore: {
		namedImport: { type: 'removed' },
		identifier: { type: 'removed' },
	},
	initializeStores: {
		namedImport: { type: 'removed' },
		identifier: { type: 'removed' },
	},
	localStorageStore: {
		namedImport: { type: 'removed' },
		identifier: { type: 'removed' },
	},
	modeCurrent: {
		namedImport: { type: 'removed' },
		identifier: { type: 'removed' },
	},
	modeOsPrefers: {
		namedImport: { type: 'removed' },
		identifier: { type: 'removed' },
	},
	modeUserPrefers: {
		namedImport: { type: 'removed' },
		identifier: { type: 'removed' },
	},
	popup: {
		namedImport: { type: 'removed' },
		identifier: { type: 'removed' },
	},
	prefersReducedMotionStore: {
		namedImport: { type: 'removed' },
		identifier: { type: 'removed' },
	},
	setInitialClassState: {
		namedImport: { type: 'removed' },
		identifier: { type: 'removed' },
	},
	setModeCurrent: {
		namedImport: { type: 'removed' },
		identifier: { type: 'removed' },
	},
	setModeUserPrefers: {
		namedImport: { type: 'removed' },
		identifier: { type: 'removed' },
	},
	storeHighlightJs: {
		namedImport: { type: 'removed' },
		identifier: { type: 'removed' },
	},
	storePopup: {
		namedImport: { type: 'removed' },
		identifier: { type: 'removed' },
	},
	tableMapperValues: {
		namedImport: { type: 'removed' },
		identifier: { type: 'removed' },
	},
	tableSourceMapper: {
		namedImport: { type: 'removed' },
		identifier: { type: 'removed' },
	},
	tableSourceValues: {
		namedImport: { type: 'removed' },
		identifier: { type: 'removed' },
	},
	tocCrawler: {
		namedImport: { type: 'removed' },
		identifier: { type: 'removed' },
	},
	tocStore: {
		namedImport: { type: 'removed' },
		identifier: { type: 'removed' },
	},
	AppRail: {
		namedImport: {
			type: 'renamed',
			value: 'Navigation',
		},
		identifier: {
			type: 'renamed',
			value: 'Navigation',
		},
	},
	AppRailTile: {
		namedImport: {
			type: 'renamed',
			value: 'Navigation',
		},
		identifier: {
			type: 'renamed',
			value: 'Navigation.Tile',
		},
	},
	FileButton: {
		namedImport: {
			type: 'renamed',
			value: 'FileUpload',
		},
		identifier: {
			type: 'renamed',
			value: 'FileUpload',
		},
	},
	FileDropzone: {
		namedImport: {
			type: 'renamed',
			value: 'FileUpload',
		},
		identifier: {
			type: 'renamed',
			value: 'FileUpload',
		},
	},
	InputChip: {
		namedImport: {
			type: 'renamed',
			value: 'TagsInput',
		},
		identifier: {
			type: 'renamed',
			value: 'TagsInput',
		},
	},
	Paginator: {
		namedImport: {
			type: 'renamed',
			value: 'Pagination',
		},
		identifier: {
			type: 'renamed',
			value: 'Pagination',
		},
	},
	ProgressBar: {
		namedImport: {
			type: 'renamed',
			value: 'Progress',
		},
		identifier: {
			type: 'renamed',
			value: 'Progress',
		},
	},
	ProgressRadial: {
		namedImport: {
			type: 'renamed',
			value: 'ProgressRing',
		},
		identifier: {
			type: 'renamed',
			value: 'ProgressRing',
		},
	},
	RadioGroup: {
		namedImport: {
			type: 'renamed',
			value: 'Segment',
		},
		identifier: {
			type: 'renamed',
			value: 'Segment',
		},
	},
	RadioItem: {
		namedImport: {
			type: 'renamed',
			value: 'Segment',
		},
		identifier: {
			type: 'renamed',
			value: 'Segment.Item',
		},
	},
	RangeSlider: {
		namedImport: {
			type: 'renamed',
			value: 'Slider',
		},
		identifier: {
			type: 'renamed',
			value: 'Slider',
		},
	},
	Ratings: {
		namedImport: {
			type: 'renamed',
			value: 'Rating',
		},
		identifier: {
			type: 'renamed',
			value: 'Rating',
		},
	},
	SlideToggle: {
		namedImport: {
			type: 'renamed',
			value: 'Switch',
		},
		identifier: {
			type: 'renamed',
			value: 'Switch',
		},
	},
	TabAnchor: {
		namedImport: {
			type: 'renamed',
			value: 'Tabs',
		},
		identifier: {
			type: 'renamed',
			value: 'Tabs.Control',
		},
	},
	TabGroup: {
		namedImport: {
			type: 'renamed',
			value: 'Tabs',
		},
		identifier: {
			type: 'renamed',
			value: 'Tabs',
		},
	},
	Toast: {
		namedImport: {
			type: 'renamed',
			value: 'ToastProvider',
		},
		identifier: {
			type: 'renamed',
			value: 'ToastProvider',
		},
	},
};

export { EXPORT_MAPPINGS };

```

### Core Architecture Module: `packages/cli/src/commands/migrate/migrations/skeleton-3/utility/theme-mappings.ts`
```
import type { Theme } from './types.js';

const THEME_MAPPINGS: Record<string, Theme> = {
	skeleton: { type: 'preset', value: 'legacy' },
	'gold-nouveau': { type: 'preset', value: 'nouveau' },
	wintry: { type: 'preset', value: 'wintry' },
	modern: { type: 'preset', value: 'modern' },
	rocket: { type: 'preset', value: 'rocket' },
	seafoam: { type: 'preset', value: 'seafoam' },
	vintage: { type: 'preset', value: 'vintage' },
	sahara: { type: 'preset', value: 'sahara' },
	hamlindigo: { type: 'preset', value: 'hamlindigo' },
	crimson: { type: 'preset', value: 'crimson' },
};

export { THEME_MAPPINGS };

```

### Core Architecture Module: `packages/cli/src/commands/migrate/migrations/skeleton-3/utility/types.ts`
```
interface Theme {
	type: 'preset' | 'custom';
	value: string;
}

export type { Theme };

```

### Core Architecture Module: `packages/cli/src/commands/migrate/migrations/skeleton-4/utility/identifier-mappings.ts`
```
export const IDENTIFIER_MAPPINGS: Record<string, string> = {
	Modal: 'Dialog',
	'Navigation.Bar': 'Navigation',
	'Navigation.Rail': 'Navigation',
	ProgressRing: 'Progress',
	Ratings: 'RatingGroup',
	Segment: 'SegmentedControl',
	Toaster: 'Toast.Group',
};

```

### Core Architecture Module: `packages/cli/src/commands/migrate/migrations/skeleton-4/utility/import-mappings.ts`
```
export const IMPORT_MAPPINGS: Record<string, string> = {
	Modal: 'Dialog',
	Navigation: 'Navigation',
	ProgressRing: 'Progress',
	Ratings: 'RatingGroup',
	Segment: 'SegmentedControl',
	Toaster: 'Toast',
};

```

### Core Architecture Module: `packages/cli/src/commands/migrate/migrations/skeleton-5/utility/manual-steps.ts`
```
// v4 usages that cannot be migrated automatically, reported to the user as manual steps
export interface ManualStep {
	id: string;
	match: string;
	hint: string;
}

// Classes with no 1:1 v5 rename
const MANUAL_CLASS_RULES: { pattern: RegExp; id: string; hint: string }[] = [
	{
		pattern: /^ig-cell$/,
		id: 'ig-cell',
		hint: 'has no v5 utility — replace with `label label-text` and make the element a `<label for>`.',
	},
	{
		pattern: /^code$/,
		id: 'code',
		hint: 'was removed in v5 with no replacement class — style the element manually.',
	},
	{
		pattern: /^heading-(font-size|line-height)$/,
		id: 'heading-sizing',
		hint: 'was removed in v5 — size headings with `text-*` / `leading-*` utilities instead.',
	},
	{
		pattern: /^(base|heading|anchor)-font-weight$/,
		id: 'font-weight',
		hint: 'has no v5 utility — set the weight with a `font-*` utility or the matching theme token.',
	},
	{
		pattern: /^(base|heading|anchor)-font-style$/,
		id: 'font-style',
		hint: 'has no v5 utility — use `italic` / `not-italic` or the matching theme token.',
	},
	{
		pattern: /^anchor-text-decoration(-hover|-active|-focus)?$/,
		id: 'anchor-text-decoration',
		hint: 'has no v5 utility — use `underline` / `no-underline` etc. or the anchor theme tokens.',
	},
];

export const THEME_VARIANT_STEP: Omit<ManualStep, 'match'> = {
	id: 'variant-theme',
	hint: 'the `theme-[name]` variant was removed from the Core API — scope theme styles another way.',
};

// Scan a class string for classes that require manual migration, stripping variant prefixes first
export function detectManualClasses(code: string): ManualStep[] {
	const steps: ManualStep[] = [];
	for (const token of code.split(/\s+/)) {
		if (!token) {
			continue;
		}
		const segments = token.split(':');
		const base = segments.pop()!;
		for (const variant of segments) {
			if (/^theme-[\w-]+$/.test(variant)) {
				steps.push({ ...THEME_VARIANT_STEP, match: `${variant}:` });
			}
		}
		for (const rule of MANUAL_CLASS_RULES) {
			if (rule.pattern.test(base)) {
				steps.push({ id: rule.id, match: base, hint: rule.hint });
			}
		}
	}
	return steps;
}

export function dedupeManualSteps(steps: ManualStep[]): ManualStep[] {
	const seen = new Set<string>();
	return steps.filter((step) => {
		const key = `${step.id}:${step.match}`;
		if (seen.has(key)) {
			return false;
		}
		seen.add(key);
		return true;
	});
}

```

### Core Architecture Module: `packages/cli/src/commands/migrate/migrations/skeleton-5/utility/token-mappings.ts`
```
// v4 -> v5 theme token renames, applied to declarations and `var()` references
export const TOKEN_MAPPINGS: Record<string, string> = {
	// Typography Base
	'--base-font-family': '--typo-base--font-family',
	'--base-font-size': '--typo-base--font-size',
	'--base-font-color': '--typo-base--color-light',
	'--base-font-color-dark': '--typo-base--color-dark',
	'--base-line-height': '--typo-base--line-height',
	'--base-font-weight': '--typo-base--font-weight',
	'--base-font-style': '--typo-base--font-style',
	'--base-letter-spacing': '--typo-base--letter-spacing',
	// Typography Heading
	'--heading-font-family': '--typo-heading--font-family',
	'--heading-font-color': '--typo-heading--color-light',
	'--heading-font-color-dark': '--typo-heading--color-dark',
	'--heading-font-weight': '--typo-heading--font-weight',
	'--heading-font-style': '--typo-heading--font-style',
	'--heading-letter-spacing': '--typo-heading--letter-spacing',
	// Typography Anchor
	'--anchor-font-family': '--typo-anchor--font-family',
	'--anchor-font-size': '--typo-anchor--font-size',
	'--anchor-font-color': '--typo-anchor--color-light',
	'--anchor-font-color-dark': '--typo-anchor--color-dark',
	'--anchor-line-height': '--typo-anchor--line-height',
	'--anchor-font-weight': '--typo-anchor--font-weight',
	'--anchor-font-style': '--typo-anchor--font-style',
	'--anchor-letter-spacing': '--typo-anchor--letter-spacing',
	// Typography Anchor decoration
	'--anchor-text-decoration': '--typo-anchor--text-decoration-line',
	'--anchor-text-decoration-hover': '--typo-anchor--hover--text-decoration-line',
	'--anchor-text-decoration-active': '--typo-anchor--active--text-decoration-line',
	'--anchor-text-decoration-focus': '--typo-anchor--focus--text-decoration-line',
	// Root background
	'--body-background-color': '--color-root-bg-light',
	'--body-background-color-dark': '--color-root-bg-dark',
};

// v4 theme tokens removed in v5
export const REMOVED_TOKENS: string[] = ['--default-divide-width', '--heading-font-size', '--heading-line-height'];

// Tokens new in v5, appended to theme blocks with appearance-preserving defaults
export const ADDED_TOKENS: Record<string, string> = {
	// Typography extended properties
	'--typo-base--font-stretch': 'inherit',
	'--typo-base--font-kerning': 'inherit',
	'--typo-base--text-shadow': 'inherit',
	'--typo-base--word-spacing': 'inherit',
	'--typo-base--hyphens': 'inherit',
	'--typo-base--text-transform': 'inherit',
	'--typo-heading--font-stretch': 'inherit',
	'--typo-heading--font-kerning': 'inherit',
	'--typo-heading--text-shadow': 'inherit',
	'--typo-heading--word-spacing': 'inherit',
	'--typo-heading--hyphens': 'inherit',
	'--typo-heading--text-transform': 'inherit',
	'--typo-anchor--font-stretch': 'inherit',
	'--typo-anchor--font-kerning': 'inherit',
	'--typo-anchor--text-shadow': 'inherit',
	'--typo-anchor--word-spacing': 'inherit',
	'--typo-anchor--hyphens': 'inherit',
	'--typo-anchor--text-transform': 'inherit',
	// Anchor decoration sub-properties
	'--typo-anchor--text-decoration-color': 'inherit',
	'--typo-anchor--text-decoration-style': 'inherit',
	'--typo-anchor--text-decoration-thickness': 'inherit',
	'--typo-anchor--text-underline-offset': 'inherit',
	'--typo-anchor--text-underline-position': 'inherit',
	'--typo-anchor--hover--text-decoration-color': 'inherit',
	'--typo-anchor--hover--text-decoration-style': 'inherit',
	'--typo-anchor--hover--text-decoration-thickness': 'inherit',
	'--typo-anchor--hover--text-underline-offset': 'inherit',
	'--typo-anchor--hover--text-underline-position': 'inherit',
	'--typo-anchor--active--text-decoration-color': 'inherit',
	'--typo-anchor--active--text-decoration-style': 'inherit',
	'--typo-anchor--active--text-decoration-thickness': 'inherit',
	'--typo-anchor--active--text-underline-offset': 'inherit',
	'--typo-anchor--active--text-underline-position': 'inherit',
	'--typo-anchor--focus--text-decoration-color': 'inherit',
	'--typo-anchor--focus--text-decoration-style': 'inherit',
	'--typo-anchor--focus--text-decoration-thickness': 'inherit',
	'--typo-anchor--focus--text-underline-offset': 'inherit',
	'--typo-anchor--focus--text-underline-position': 'inherit',
	// Edges
	'--default-outline-width': '1px',
	// Corner shape
	'--corner-shape-base': 'initial',
	'--corner-shape-container': 'initial',
	// Brand colors
	'--color-brand-light': 'var(--color-primary-500)',
	'--color-brand-contrast-light': 'var(--color-primary-contrast-500)',
	'--color-brand-dark': 'var(--color-primary-500)',
	'--color-brand-contrast-dark': 'var(--color-primary-contrast-500)',
};

```

### Core Architecture Module: `packages/cli/src/utility/file-migration.ts`
```
export interface FileMigration {
	path: string;
	content: string;
}

```

### Core Architecture Module: `packages/cli/src/utility/get-our-package-json.ts`
```
import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { PackageJson } from 'type-fest';

async function getOurPackageJson(): Promise<Required<PackageJson>> {
	const packageJsonPath = join(dirname(fileURLToPath(import.meta.url)), '../package.json');
	const content = await readFile(packageJsonPath, 'utf-8');
	return JSON.parse(content);
}

export { getOurPackageJson };

```

### Core Architecture Module: `packages/cli/src/utility/install-dependencies.ts`
```
import child_process from 'node:child_process';
import { promisify } from 'node:util';
import { detect, resolveCommand } from 'package-manager-detector';

const exec = promisify(child_process.exec);

async function installDependencies(cwd = process.cwd()) {
	const pm = await detect({
		cwd: cwd,
	});
	const resolvedCommand = resolveCommand(pm?.agent ?? 'npm', 'install', []);
	if (!resolvedCommand) {
		throw new Error('Could not resolve package manager command.');
	}
	return exec(`${resolvedCommand.command} ${resolvedCommand.args.join(' ')}`, {
		cwd: cwd,
	});
}

export { installDependencies };

```

### Core Architecture Module: `packages/cli/src/utility/sort-properties-alphabetically.ts`
```
function sortPropertiesAlphabetically(object: Record<string, string>) {
	const orderedObject: Record<string, string> = {};
	const sortedEntries = Object.entries(object).sort(([a], [b]) => a.localeCompare(b));
	for (const [key, value] of sortedEntries) {
		orderedObject[key] = value;
	}
	return orderedObject;
}

export { sortPropertiesAlphabetically };

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #4564** (2026-09-09): **v5: can’t match icon buttons to text buttons anymore**
  *Symptoms*: ### Current Behavior  In v4, `btn-icon-lg` matched `btn` exactly. Now, the closest thing is `btn-icon-xl`, and it’s still off:  ```svelte <AppBar> 	<AppBar.Toolbar class="grid-cols-[auto_1fr_auto]"> 		... 		<AppBar.Trail> 			<button type="button" class="btn preset-filled">Share</button> 			<button type="button" class="btn preset-tonal">Reset</button> 			<a class="btn-icon btn-icon-xl preset-tonal"><SiGithub /></a> 		</AppBar.Trail> 	</AppBar.Toolbar> </AppBar> ```  <img width="201" height="58" alt="Image" src="https://github.com/user-attachments/assets/f1602ab5-ac60-4e13-bf2d-57add4db5dbc" />  ### Expected Behavior  _No response_  ### Steps To Reproduce  _No response_  ### Stackblitz or Reproduction URL  _No response_  ### Environment Information  _No response_  ### More Information  _No response_
  **Post-Mortem & Fix Analysis**:
  > ah sorry, that’s a bigger element throwing things off

- **Issue #4536** (2026-07-17): **Default Themes Not Importing in Theme Generator**
  *Symptoms*: ### Current Behavior  When on the `Import` page of the Theme generator, clicking a default color palette does not actually import anything and the default colors remain.  https://github.com/user-attachments/assets/34120b3e-b13f-45da-8b37-5f54a5e045a3  ### Expected Behavior  When the button is clicked, it should import the selected default stylesheet.  ### Steps To Reproduce  1. Visit the Skeleton UI Theme Generator 2. Navigate to the `Import` page 3. Select a default color palette to import 4. Page returns to `Create` and no changes take effect  ### Stackblitz or Reproduction URL  _No response_  ### Environment Information  Browser: Brave 1.92.139   (Official Build)  (64-bit)     Chromium: 150.0.7871.114  ### More Information  _No response_

- **Issue #4526** (2026-07-20): **Select element padding collapsing on left/right**
  *Symptoms*: ### Current Behavior  <img width="521" height="91" alt="Image" src="https://github.com/user-attachments/assets/6771c76d-96cf-474b-ba90-ac8bff16c7d8" />  ### Expected Behavior  This does not happen in the Skeleton docs (Astro app) but does happen in standalone apps running SvelteKit + Skeleton RC 1  ### Steps To Reproduce  ``` <label class="label"> 	<span class="label-text">Basic Placeholder</span> 	<select id="example" name="example" class="select"> 		<option disabled selected>Preferred Flavor</option> 		<option value="1">Strawberry</option> 		<option value="2">Grape</option> 		<option value="3">Watermelon</option> 		<option value="4">Apple</option> 		<option value="5">Mango</option> 	</select> </label> ```  ### Stackblitz or Reproduction URL  _No response_  ### Environment Information  _No response_  ### More Information  _No response_
  **Post-Mortem & Fix Analysis**:
  > This was just me being dumb and forgetting to installed the Tailwind Forms plugin. Once added this works as expected.

- **Issue #4514** (2026-07-12): **[v5] No animation when closing drawer on Firefox**
  *Symptoms*: ### Current Behavior  No animation, probably because Firefox doesn't support `transition-discrete`. Animation is present in Chrome  ### Expected Behavior  _No response_  ### Steps To Reproduce  https://next.skeleton.dev/docs/svelte/framework-components/dialog#drawer  ### Stackblitz or Reproduction URL  _No response_  ### Environment Information  _No response_  ### More Information  _No response_
  **Post-Mortem & Fix Analysis**:
  > @PerchunPak this is correct per the reason you stated:  > No animation, probably because Firefox doesn't support transition-discrete.  But I'll correct you that it's only the close animation. Firefox does not support this feature yet, so the animation is a progressive enhancement. I'd suggest replacing this with your own solution if desired.  I have plans to implement a more thorough set of utilities and guidance around animations in the future. But for now this is working as intended.  If you would like to submit a PR that adds a note about this behavior for this component specifically, this would be welcomed and encouraged. You can follow our approach for browser support callout here:  https://next.skeleton.dev/docs/svelte/tailwind-components/dialogs#interaction

- **Issue #4447** (2026-05-13): **Plus site oAuth fails on localhost**
  *Symptoms*: ### Current Behavior  When testing on localhost:  - Docker/Local - works like a charm - Github/Discord - throws 500 error  ### Expected Behavior  I should sign in :)  ### Steps To Reproduce  > NOTE: I have client/secret set for both services in my `.env`  1. Go to sign in page 2. Tap Github or Discord 3. Page shows 500 error 4. Server log shows 500 error (same for both)  <img width="1707" height="1340" alt="Image" src="https://github.com/user-attachments/assets/4bbca957-f904-4760-89ae-dd10dbef262b" /> <img width="355" height="205" alt="Image" src="https://github.com/user-attachments/assets/75738f97-70c3-4810-9120-a7b67be12936" />  ### Stackblitz or Reproduction URL  n/a  ### Environment Information  n/a  ### More Information  _No response_

- **Issue #4406** (2026-05-09): **PR template and doc redirect improvements**
  *Symptoms*: While not directly related, these both affect the PR templates. Let's try to resolve them together:  1. Let's go ahead and drop the AI opt-in checkbox. I agree it's no longer needed. 2. The template links to a number of URLs. But they provide a 404.  Per item 2, the links are correct, just dropping the `/react` or `/svelte` to keep them agnostic. These redirects were working at one point, but seems to have stopped. We'll need to revisit.

- **Issue #4360** (2026-04-17): **bugfix: remove `cursor: pointer` from `btn` class**
  *Symptoms*: ### Current Behavior  The `btn` class adds `cursor: pointer`, although intuitive, this actually moves away from Tailwind and browser default behaviour. Only links should have `cursor: pointer`.  ### Expected Behavior  The pointer should not change when hovering over a button.  ### Steps To Reproduce  _No response_  ### Stackblitz or Reproduction URL  _No response_  ### Environment Information  _No response_  ### More Information  _No response_
  **Post-Mortem & Fix Analysis**:
  > NOTE: This will likely need to be addressed in a few places, including Chips.

- **Issue #4298** (2026-04-07): **Floating Panel Body's height is too high**
  *Symptoms*: ### Current Behavior  This rule sets the height of the FloatingPanel.Body to 100%:  ```css [data-scope=floating-panel][data-part=body] {     background:var(--color-surface-100-900);     height:100%;     padding:calc(var(--spacing) * 4);     overflow-y:auto   } ```  This causes FloatingPanel.Body to take up 100% of the content area height without   accounting for the space occupied by FloatingPanel.Header, resulting in vertical overflow. The body content spills outside the panel's visible/resizable bounds.  <img width="320" height="293" alt="Image" src="https://github.com/user-attachments/assets/d750e977-2ba9-46cc-b58f-00b6372e780e" />  ### Expected Behavior  FloatingPanel.Content should lay out its children in a flex column so that FloatingPanel.Body fills only the remaining vertical space after the header. The body should be scrollable within that remaining space without overflowing the panel.  ### Steps To Reproduce  1. Use the FloatingPanel component with Header, Body, and ResizeTrigger children inside Content 2. Add enough content in Body to exceed the panel's default height 3. Open the panel 4. Observe that the body overflows the panel bounds  ### Stackblitz or Reproduction URL  _No response_  ### Environment Information  Chrome: 145.0.7632.160 Edge: Chromium (140.0.3485.54) Firefox: 145.0.2  ### More Information  The fix would likely be adding `display: flex; flex-direction: column;` to the internal styles of FloatingPanel.Content, and `flex: 1; min-height: 0; overflow-

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

### Incident Patch 1: `2ca0f834` (2026-08-19)
**Commit Message**: docs: fix overflow (#4554)

**File**: `sites/skeleton.dev/src/components/typography/code.astro` (modified, +2/-2)
```diff
@@ -4,9 +4,9 @@ import Code from '@/components/ui/code.svelte';
 ---
 
 {
-	Astro.props.className ? (
+	Astro.props.class ? (
 		<div class="mb-2">
-			<Code code={unescape(await Astro.slots.render('default'))} lang={Astro.props.className.split('-').pop()} client:visible />
+			<Code code={unescape(await Astro.slots.render('default'))} lang={Astro.props.class.split('-').pop()} client:visible />
 		</div>
 	) : (
 		<code class="code">
```

**File**: `sites/skeleton.dev/src/content/docs/get-started/fundamentals.mdx` (modified, +15/-15)
```diff
@@ -289,36 +289,38 @@ Using the extensible markup pattern, you may implement custom animations. We sho
 Skeleton components maintain a uniform pattern for handling data flow in and out. We lean into the Zag convention for this, which handles this explicitly with a prop for data in and event handler for data out. As opposed to two-way binding (such as `bind:` in Svelte). You can see this in practice below for the Switch component.
 
 <Framework id="react">
+
 ```tsx
 import { Switch } from '@skeletonlabs/skeleton-react';
 import { useState } from 'react';
 
 export default function Default() {
 	const [checked, setChecked] = useState(false);
 
-    return (
-    	<Switch checked={checked} onCheckedChange={(e) => setChecked(e.checked)}>
-    		<Switch.Control>
-    			<Switch.Thumb />
-    		</Switch.Control>
-    		<Switch.Label>Label</Switch.Label>
-    		<Switch.HiddenInput />
-    	</Switch>
-    );
-
+	return (
+		<Switch checked={checked} onCheckedChange={(e) => setChecked(e.checked)}>
+			<Switch.Control>
+				<Switch.Thumb />
+			</Switch.Control>
+			<Switch.Label>Label</Switch.Label>
+			<Switch.HiddenInput />
+		</Switch>
+	);
 }
+```
 
-````
 </Framework>
+
 <Framework id="svelte">
-{/* prettier-ignore */}
+
 ```svelte
 <script lang="ts">
 	import { Switch } from '@skeletonlabs/skeleton-svelte';
+
 	let checked = $state(false);
 </script>
 
-<Switch checked={checked} onCheckedChange={(e) => (checked = e.checked)}>
+<Switch {checked} onCheckedChange={(e) => (checked = e.checked)}>
 	<Switch.Control>
 		<Switch.Thumb />
 	</Switch.Control>
@@ -399,5 +401,3 @@ export default function TooltipExample() {
 ### Learn More
 
 For a comprehensive guide to how Skeleton implements components, refer to our [contribution guidelines](/docs/[framework]/resources/contribute/components).
-
-````
```

---

### Incident Patch 2: `c474b1fd` (2026-07-17)
**Commit Message**: Bugfix for preset theme gen import (#4537)

**File**: `sites/themes.skeleton.dev/src/lib/constants/themes.ts` (modified, +24/-24)
```diff
@@ -1,27 +1,27 @@
-import catpuccin from '@skeletonlabs/skeleton/themes/catppuccin?inline';
-import cerberus from '@skeletonlabs/skeleton/themes/cerberus?inline';
-import concord from '@skeletonlabs/skeleton/themes/concord?inline';
-import crimson from '@skeletonlabs/skeleton/themes/crimson?inline';
-import dracula from '@skeletonlabs/skeleton/themes/dracula?inline';
-import fennec from '@skeletonlabs/skeleton/themes/fennec?inline';
-import hamlindigo from '@skeletonlabs/skeleton/themes/hamlindigo?inline';
-import legacy from '@skeletonlabs/skeleton/themes/legacy?inline';
-import mint from '@skeletonlabs/skeleton/themes/mint?inline';
-import modern from '@skeletonlabs/skeleton/themes/modern?inline';
-import mona from '@skeletonlabs/skeleton/themes/mona?inline';
-import nosh from '@skeletonlabs/skeleton/themes/nosh?inline';
-import nouveau from '@skeletonlabs/skeleton/themes/nouveau?inline';
-import pine from '@skeletonlabs/skeleton/themes/pine?inline';
-import reign from '@skeletonlabs/skeleton/themes/reign?inline';
-import rocket from '@skeletonlabs/skeleton/themes/rocket?inline';
-import rose from '@skeletonlabs/skeleton/themes/rose?inline';
-import rosepine from '@skeletonlabs/skeleton/themes/rosepine?inline';
-import sahara from '@skeletonlabs/skeleton/themes/sahara?inline';
-import seafoam from '@skeletonlabs/skeleton/themes/seafoam?inline';
-import terminus from '@skeletonlabs/skeleton/themes/terminus?inline';
-import vintage from '@skeletonlabs/skeleton/themes/vintage?inline';
-import vox from '@skeletonlabs/skeleton/themes/vox?inline';
-import wintry from '@skeletonlabs/skeleton/themes/wintry?inline';
+import catpuccin from '@skeletonlabs/skeleton/themes/catppuccin?raw';
+import cerberus from '@skeletonlabs/skeleton/themes/cerberus?raw';
+import concord from '@skeletonlabs/skeleton/themes/concord?raw';
+import crimson from '@skeletonlabs/skeleton/themes/crimson?raw';
+import dracula from '@skeletonlabs/skeleton/themes/dracula?raw';
+import fennec from '@skeletonlabs/skeleton/themes/fennec?raw';
+import hamlindigo from '@skeletonlabs/skeleton/themes/hamlindigo?raw';
+import legacy from '@skeletonlabs/skeleton/themes/legacy?raw';
+import mint from '@skeletonlabs/skeleton/themes/mint?raw';
+import modern from '@skeletonlabs/skeleton/themes/modern?raw';
+import mona from '@skeletonlabs/skeleton/themes/mona?raw';
+import nosh from '@skeletonlabs/skeleton/themes/nosh?raw';
+import nouveau from '@skeletonlabs/skeleton/themes/nouveau?raw';
+import pine from '@skeletonlabs/skeleton/themes/pine?raw';
+import reign from '@skeletonlabs/skeleton/themes/reign?raw';
+import rocket from '@skeletonlabs/skeleton/themes/rocket?raw';
+import rose from '@skeletonlabs/skeleton/themes/rose?raw';
+import rosepine from '@skeletonlabs/skeleton/themes/rosepine?raw';
+import sahara from '@skeletonlabs/skeleton/themes/sahara?raw';
+import seafoam from '@skeletonlabs/skeleton/themes/seafoam?raw';
+import terminus from '@skeletonlabs/skeleton/themes/terminus?raw';
+import vintage from '@skeletonlabs/skeleton/themes/vintage?raw';
+import vox from '@skeletonlabs/skeleton/themes/vox?raw';
+import wintry from '@skeletonlabs/skeleton/themes/wintry?raw';
 
 export const themes = [
 	{
```

---

### Incident Patch 3: `9ba27496` (2026-07-17)
**Commit Message**: Homepage teaser typo fix (#4535)

**File**: `sites/skeleton.dev/src/pages/index.astro` (modified, +1/-1)
```diff
@@ -26,7 +26,7 @@ import { resolvePath } from '@/modules/resolve-path';
 		target="_blank"
 		class="block text-sm p-2 preset-filled-primary-200-800"
 	>
-		<p class="text-center">🎉 <strong>Skeleton v5</strong> is now avialable &rarr;</p>
+		<p class="text-center">🎉 <strong>Skeleton v5</strong> is now available &rarr;</p>
 	</a>
 	<!-- -- / -- -->
 	<main>
```

---

### Incident Patch 4: `8779f972` (2026-07-13)
**Commit Message**: bugfix: code typography (#4520)

**File**: `sites/skeleton.dev/src/components/typography/code.astro` (modified, +6/-5)
```diff
@@ -1,15 +1,16 @@
 ---
 import { unescape } from 'html-escaper';
-import Code_ from '@/components/ui/code.svelte';
+import Code from '@/components/ui/code.svelte';
 ---
 
 {
-	Astro.props.class ? (
+	Astro.props.className ? (
 		<div class="mb-2">
-			<Code_ code={unescape(await Astro.slots.render('default'))} lang={Astro.props.class.split('-').pop()} client:visible />
+			<Code code={unescape(await Astro.slots.render('default'))} lang={Astro.props.className.split('-').pop()} client:visible />
 		</div>
 	) : (
-		// prettier-ignore
-		<code class="code"><slot /></code>
+		<code class="code">
+			<slot />
+		</code>
 	)
 }
```

**File**: `sites/skeleton.dev/src/content/docs/get-started/fundamentals.mdx` (modified, +1/-0)
```diff
@@ -399,4 +399,5 @@ export default function TooltipExample() {
 ### Learn More
 
 For a comprehensive guide to how Skeleton implements components, refer to our [contribution guidelines](/docs/[framework]/resources/contribute/components).
+
 ````
```

---

### Incident Patch 5: `96a87915` (2026-07-13)
**Commit Message**: bugfix: explicit imports (#4519)

**File**: `pnpm-lock.yaml` (modified, +0/-17)
```diff
@@ -246,9 +246,6 @@ catalogs:
     astro:
       specifier: 7.0.7
       version: 7.0.7
-    astro-auto-import:
-      specifier: 0.5.1
-      version: 0.5.1
     astro-pagefind:
       specifier: 2.0.1
       version: 2.0.1
@@ -1144,9 +1141,6 @@ importers:
       astro:
         specifier: 'catalog:'
         version: 7.0.7(@emnapi/core@1.11.1)(@emnapi/runtime@1.11.2)(@types/node@25.9.5)(@vercel/functions@3.4.3)(jiti@2.7.0)(yaml@2.8.3)
-      astro-auto-import:
-        specifier: 'catalog:'
-        version: 0.5.1(astro@7.0.7(@emnapi/core@1.11.1)(@emnapi/runtime@1.11.2)(@types/node@25.9.5)(@vercel/functions@3.4.3)(jiti@2.7.0)(yaml@2.8.3))
       astro-pagefind:
         specifier: 'catalog:'
         version: 2.0.1(astro@7.0.7(@emnapi/core@1.11.1)(@emnapi/runtime@1.11.2)(@types/node@25.9.5)(@vercel/functions@3.4.3)(jiti@2.7.0)(yaml@2.8.3))
@@ -4595,12 +4589,6 @@ packages:
     resolution: {integrity: sha512-LElXdjswlqjWrPpJFg1Fx4wpkOCxj1TDHlSV4PlaRxHGWko024xICaa97ZkMfs6DRKlCguiAI+rbXv5GWwXIkg==}
     hasBin: true
 
-  astro-auto-import@0.5.1:
-    resolution: {integrity: sha512-7YZKVA7LE5nLkopOM+KIHqnh6g2CfHrysj2JUXNBrC3FppHH42RSNBM7mgsEgaq2lgHVDt7hsDQIA0JKTwIN8A==}
-    engines: {node: '>=20.0.0'}
-    peerDependencies:
-      astro: ^5.0.0-beta || ^6.0.0-alpha
-
   astro-pagefind@2.0.1:
     resolution: {integrity: sha512-zhMTctuVuKrYH1C0Xl+p8mhexEuxVrqfT8paQOAbKZFtgUIWAMtR2nCeU11ti4Rfeit16LhiCxZFwjOqYoiaNQ==}
     peerDependencies:
@@ -10610,11 +10598,6 @@ snapshots:
 
   astring@1.9.0: {}
 
-  astro-auto-import@0.5.1(astro@7.0.7(@emnapi/core@1.11.1)(@emnapi/runtime@1.11.2)(@types/node@25.9.5)(@vercel/functions@3.4.3)(jiti@2.7.0)(yaml@2.8.3)):
-    dependencies:
-      acorn: 8.16.0
-      astro: 7.0.7(@emnapi/core@1.11.1)(@emnapi/runtime@1.11.2)(@types/node@25.9.5)(@vercel/functions@3.4.3)(jiti@2.7.0)(yaml@2.8.3)
-
   astro-pagefind@2.0.1(astro@7.0.7(@emnapi/core@1.11.1)(@emnapi/runtime@1.11.2)(@types/node@25.9.5)(@vercel/functions@3.4.3)(jiti@2.7.0)(yaml@2.8.3)):
     dependencies:
       '@pagefind/component-ui': 1.5.2
```

**File**: `pnpm-workspace.yaml` (modified, +0/-1)
```diff
@@ -83,7 +83,6 @@ catalog:
   '@zag-js/tooltip': 1.42.0
   '@zag-js/tree-view': 1.42.0
   astro: 7.0.7
-  astro-auto-import: 0.5.1
   astro-pagefind: 2.0.1
   astro-seo: 1.1.0
   better-auth: 1.6.23
```

**File**: `sites/skeleton.dev/astro.config.ts` (modified, +1/-19)
```diff
@@ -5,7 +5,6 @@ import sitemap from '@astrojs/sitemap';
 import svelte from '@astrojs/svelte';
 import vercel from '@astrojs/vercel';
 import tailwindcss from '@tailwindcss/vite';
-import autoImport from 'astro-auto-import';
 import pagefind from 'astro-pagefind';
 import { defineConfig, envField } from 'astro/config';
 import { execSync } from 'node:child_process';
@@ -21,24 +20,7 @@ export default defineConfig({
 	markdown: {
 		syntaxHighlight: false,
 	},
-	integrations: [
-		react(),
-		svelte(),
-		autoImport({
-			imports: [
-				{
-					'./src/components/ui/framework.astro': [['default', 'Framework']],
-					'./src/components/ui/api-reference.astro': [['default', 'ApiReference']],
-					'./src/components/ui/preview.svelte': [['default', 'Preview']],
-					'./src/components/ui/alert.astro': [['default', 'Alert']],
-				},
-			],
-		}),
-		mdx(),
-		partytown(),
-		sitemap(),
-		pagefind(),
-	],
+	integrations: [react(), svelte(), mdx(), partytown(), sitemap(), pagefind()],
 	env: {
 		schema: {
 			GIT_BRANCH: envField.string({
```

**File**: `sites/skeleton.dev/package.json` (modified, +1/-1)
```diff
@@ -6,6 +6,7 @@
 		"dev": "astro dev",
 		"build": "astro build",
 		"check": "astro check",
+		"sync-mdx-imports": "node ./scripts/sync-mdx-imports.ts",
 		"generate-showcase-project-thumbnails": "playwright install chromium && node ./scripts/generate-showcase-project-thumbnails.ts",
 		"postinstall": "astro sync"
 	},
@@ -41,7 +42,6 @@
 		"@types/react": "catalog:",
 		"@types/react-dom": "catalog:",
 		"astro": "catalog:",
-		"astro-auto-import": "catalog:",
 		"astro-pagefind": "catalog:",
 		"astro-seo": "catalog:",
 		"fuse.js": "catalog:",
```

**File**: `sites/skeleton.dev/src/content/docs/design/colors.mdx` (modified, +2/-0)
```diff
@@ -7,6 +7,8 @@ references:
 order: 10
 ---
 
+import Preview from '@/components/ui/preview.svelte';
+
 import Brand from '@/components/examples/design/colors/brand.astro';
 import BrandRaw from '@/components/examples/design/colors/brand.astro?raw';
 import Contrast from '@/components/examples/design/colors/contrast.astro';
```

**File**: `sites/skeleton.dev/src/content/docs/design/iconography.mdx` (modified, +3/-0)
```diff
@@ -7,6 +7,9 @@ references:
 order: 40
 ---
 
+import Framework from '@/components/ui/framework.astro';
+import Preview from '@/components/ui/preview.svelte';
+
 import DefaultReact from '@/components/examples/design/iconography/react/default';
 import DefaultReactRaw from '@/components/examples/design/iconography/react/default?raw';
 import Size from '@/components/examples/design/iconography/size.astro';
```

**File**: `sites/skeleton.dev/src/content/docs/design/spacing.mdx` (modified, +2/-0)
```diff
@@ -5,6 +5,8 @@ summary: Skeleton utilizes the power of Tailwind to provide a universal system f
 order: 30
 ---
 
+import Preview from '@/components/ui/preview.svelte';
+
 import Default from '@/components/examples/design/spacing/default.svelte';
 
 <Preview client:visible>
```

**File**: `sites/skeleton.dev/src/content/docs/design/typography.mdx` (modified, +2/-0)
```diff
@@ -7,6 +7,8 @@ references:
 order: 20
 ---
 
+import Preview from '@/components/ui/preview.svelte';
+
 import Abbr from '@/components/examples/design/typography/abbr.astro';
 import AbbrRaw from '@/components/examples/design/typography/abbr.astro?raw';
 import Anchors from '@/components/examples/design/typography/anchors.astro';
```

---

### Incident Patch 6: `6b8fc87a` (2026-07-09)
**Commit Message**: v5 Migration Guide (#4511)

**File**: `sites/skeleton.dev/src/components/examples/framework-components/qr-code/react/default.tsx` (modified, +1/-1)
```diff
@@ -7,7 +7,7 @@ export default function Default() {
 			<QrCode.Frame className="size-full max-size-36">
 				<QrCode.Pattern />
 			</QrCode.Frame>
-			<QrCode.Overlay>
+			<QrCode.Overlay className="bg-white rounded-full p-1">
 				<img src={favicon.src} alt="Skeleton Logo" className="size-12" />
 			</QrCode.Overlay>
 			<QrCode.DownloadTrigger fileName="skeleton-dev" mimeType="image/png">
```

**File**: `sites/skeleton.dev/src/components/examples/framework-components/qr-code/react/frame-colors.tsx` (modified, +2/-2)
```diff
@@ -3,8 +3,8 @@ import { QrCode } from '@skeletonlabs/skeleton-react';
 export default function FrameColors() {
 	return (
 		<QrCode value="https://skeleton.dev">
-			<QrCode.Frame className="size-full max-size-36 bg-brand-contrast-dark">
-				<QrCode.Pattern className="fill-brand-dark" />
+			<QrCode.Frame className="size-full max-size-36 bg-brand-dark">
+				<QrCode.Pattern className="fill-brand-contrast-dark" />
 			</QrCode.Frame>
 			<QrCode.Overlay />
 		</QrCode>
```

**File**: `sites/skeleton.dev/src/components/examples/framework-components/qr-code/react/overlay.tsx` (modified, +1/-1)
```diff
@@ -7,7 +7,7 @@ export default function OverlayDemo() {
 			<QrCode.Frame className="size-full max-size-36">
 				<QrCode.Pattern />
 			</QrCode.Frame>
-			<QrCode.Overlay>
+			<QrCode.Overlay className="bg-white rounded-full p-1">
 				<img src={favicon.src} alt="Skeleton Logo" className="size-12" />
 			</QrCode.Overlay>
 		</QrCode>
```

**File**: `sites/skeleton.dev/src/components/examples/framework-components/qr-code/svelte/default.svelte` (modified, +1/-1)
```diff
@@ -7,7 +7,7 @@
 	<QrCode.Frame class="size-full max-size-36">
 		<QrCode.Pattern />
 	</QrCode.Frame>
-	<QrCode.Overlay>
+	<QrCode.Overlay class="bg-white rounded-full p-1">
 		<img src={favicon.src} alt="Skeleton Logo" class="size-12" />
 	</QrCode.Overlay>
 	<QrCode.DownloadTrigger fileName="skeleton-dev" mimeType="image/png">Download</QrCode.DownloadTrigger>
```

**File**: `sites/skeleton.dev/src/components/examples/framework-components/qr-code/svelte/frame-colors.svelte` (modified, +2/-2)
```diff
@@ -3,8 +3,8 @@
 </script>
 
 <QrCode value="https://skeleton.dev">
-	<QrCode.Frame class="size-full max-size-36 bg-brand-contrast-dark">
-		<QrCode.Pattern class="fill-brand-dark" />
+	<QrCode.Frame class="size-full max-size-36 bg-brand-dark">
+		<QrCode.Pattern class="fill-brand-contrast-dark" />
 	</QrCode.Frame>
 	<QrCode.Overlay />
 </QrCode>
```

**File**: `sites/skeleton.dev/src/components/examples/framework-components/qr-code/svelte/overlay.svelte` (modified, +1/-1)
```diff
@@ -7,7 +7,7 @@
 	<QrCode.Frame class="size-full max-size-36">
 		<QrCode.Pattern />
 	</QrCode.Frame>
-	<QrCode.Overlay>
+	<QrCode.Overlay class="bg-white rounded-full p-1">
 		<img src={favicon.src} alt="Skeleton Logo" class="size-12" />
 	</QrCode.Overlay>
 </QrCode>
```

**File**: `sites/skeleton.dev/src/components/examples/guides/mode/color-scheme.astro` (added, +25/-0)
```diff
@@ -0,0 +1,25 @@
+<div class="w-full grid grid-cols-3 gap-4">
+	<!-- Default -->
+	<div>
+		<label class="label">
+			<span class="label-text">default</span>
+			<input type="date" class="input" />
+		</label>
+	</div>
+
+	<!-- Scheme Light -->
+	<div class="scheme-light">
+		<label class="label">
+			<span class="label-text">scheme-light</span>
+			<input type="date" class="input" />
+		</label>
+	</div>
+
+	<!-- Scheme Dark -->
+	<div class="scheme-dark">
+		<label class="label">
+			<span class="label-text">scheme-dark</span>
+			<input type="date" class="input" />
+		</label>
+	</div>
+</div>
```

**File**: `sites/skeleton.dev/src/content/docs/design/colors.mdx` (modified, +14/-12)
```diff
@@ -1,7 +1,7 @@
 ---
 title: Colors
 description: The Skeleton color system.
-summary: Skeleton provides guardrails and utilities to help you craft your custom color system. This includes a number of colors, shades, and contrast values that work together seamlessly. Providing a visually appealing and accessible palette for each theme.
+summary: Skeleton provides guardrails and utilities to help you craft your custom color system. This includes a number of colors, shades, and contrast values that work together seamlessly, providing a visually appealing and accessible palette for each theme.
 references:
   source: 'https://github.com/skeletonlabs/skeleton/blob/main/packages/skeleton/src/base/theme.css'
 order: 10
@@ -74,44 +74,44 @@ Provides a condensed syntax for dual-tone color values, evenly balanced to swap
 
 ### How Pairings Work
 
-Color Pairing are enabled through the use of the CSS [light-dark](https://developer.mozilla.org/en-US/docs/Web/CSS/color_value/light-dark) function. This means instead of writing the standard light/dark syntax with Tailwind utilities:
+Color Pairings are enabled through the use of the CSS [light-dark](https://developer.mozilla.org/en-US/docs/Web/CSS/color_value/light-dark) function. This means instead of writing the standard light/dark syntax with Tailwind utilities:
 
 ```html
 <div class="text-primary-300 dark:text-primary-700">...</div>
 ```
 
-You can instead use a much more condensed syntax:
+Skeleton provides utility classes that condense this into a single class:
 
 ```html
 <div class="text-primary-300-700">...</div>
 ```
 
-This will then be implemented into your CSS bundle as follows:
+When implemented in your CSS bundle, this will be generated as follows:
 
 ```css
 .text-primary-300-700 {
 	color: light-dark(var(--color-primary-300), var(--color-primary-700));
 }
 ```
 
-Plus, as a benefit to using the CSS `light-dark()` function, this also enables use of Tailwind's [Color Scheme](https://tailwindcss.com/docs/color-scheme) utilities. Learn more about [using Color Scheme](/docs/guides/mode#color-scheme).
+The use of the CSS `light-dark()` function enables use of [Tailwind's Color Scheme](https://tailwindcss.com/docs/color-scheme) utilities. Refer to [Color Scheme](/docs/guides/mode#color-scheme) to learn how to use this within your Skeleton application.
 
 ### When to Use Pairings
 
-Color Parings are useful for generating a hierarchy of visual layers, ranging from foreground to background elements. Each reuse the same color ramp, but invert the order when switching from light to dark mode.
+Color Pairings are useful for generating a hierarchy of visual layers, ranging from foreground to background elements. Each reuse the same color ramp, but invert the order when switching from light to dark mode.
 
 <PairingsStack />
 
-- We can use shade `950` for light mode and `50` from dark mode to represent our body text color.
-- Then use shade `50` from light mode and `950` from dark mode to represent our app background.
+- We can use shade `950` for light mode and `50` for dark mode to represent our body text color.
+- Then use shade `50` for light mode and `950` for dark mode to represent our app background.
 - Use the static `500` shade for key branding elements, such as buttons or banners.
 - Then reserve multiple layers between for elements such as cards, inputs, and more.
 
 ---
 
 ## Brand Color
 
-A variable accent color for your design system. Use this as the default when styling elements and components.
+A variable accent color for your design system. Use this as the default color value when styling elements and components.
 
 > TIP: The **Nouveau** theme makes use of variable brand color for light and dark modes.
 
@@ -121,12 +121,12 @@ A variable accent color for your design system. Use this as the default when sty
 
 ### Benefits
 
-- Brand can use any colors from your palette (ex: primary/secondary/tertiary)
+- Brand utilizes any color from your theme palette (ex: primary/secondary/tertiary).
 - Brand supports the use of custom colors.
-- Brand can use any shade from 50-950; not just limited to shade 500.
+- Brand can use any shade from 50-950; it is not limited to shade 500.
 - Brand color/shade can be tailored for light and dark mode independently.
 - Brand includes a contrast color for foreground elements.
-- Brand supports all standard presets, ex: `preset-filled-brand`.
+- Brand supports all standard [presets](/docs/svelte/tailwind-utilities/presets) (`preset-filled-brand`, `preset-outlined-brand`, `preset-tonal-brand`)
 
 ---
 
@@ -139,6 +139,8 @@ All available Skeleton Colors and Color Pairings support Tailwind's color transp
 <div class="bg-surface-50-950/60">Surface Pairing 50/950 @ 60% transparency</div>
 ```
 
+---
+
 ## Core API
 
 For more information on theme properties, please refer to the [Core API](/docs/[framework]/get-started/core-api) documentation.
```

---

### Incident Patch 7: `69907377` (2026-05-17)
**Commit Message**: task(deps): update dependency svelte to v5.55.7 [security] (#4458)

Co-authored-by: renovate[bot] <29139614+renovate[bot]@users.noreply.github.com>
Co-authored-by: Hugos68 <[REDACTED_EMAIL]>

**File**: `pnpm-lock.yaml` (modified, +120/-115)
```diff
@@ -361,8 +361,8 @@ catalogs:
       specifier: 4.0.2
       version: 4.0.2
     svelte:
-      specifier: 5.55.5
-      version: 5.55.5
+      specifier: 5.55.7
+      version: 5.55.7
     svelte-check:
       specifier: 4.4.8
       version: 4.4.8
@@ -427,7 +427,7 @@ importers:
         version: 1.2.0
       '@trivago/prettier-plugin-sort-imports':
         specifier: 'catalog:'
-        version: 6.0.2(prettier-plugin-svelte@3.5.1(prettier@3.8.3)(svelte@5.55.5))(prettier@3.8.3)(svelte@5.55.5)
+        version: 6.0.2(prettier-plugin-svelte@3.5.1(prettier@3.8.3)(svelte@5.55.7))(prettier@3.8.3)(svelte@5.55.7)
       oxlint:
         specifier: 'catalog:'
         version: 1.63.0(oxlint-tsgolint@0.22.1)
@@ -442,7 +442,7 @@ importers:
         version: 0.14.1
       prettier-plugin-svelte:
         specifier: 'catalog:'
-        version: 3.5.1(prettier@3.8.3)(svelte@5.55.5)
+        version: 3.5.1(prettier@3.8.3)(svelte@5.55.7)
       vite:
         specifier: 'catalog:'
         version: 7.3.1(@types/node@25.6.2)(jiti@2.7.0)(lightningcss@1.32.0)(sass-embedded@1.93.3)(sass@1.93.3)(tsx@4.21.0)(yaml@2.8.3)
@@ -487,7 +487,7 @@ importers:
         version: 7.8.0
       svelte:
         specifier: 'catalog:'
-        version: 5.55.5
+        version: 5.55.7
       tinyglobby:
         specifier: 'catalog:'
         version: 0.2.16
@@ -536,7 +536,7 @@ importers:
         version: 2.2.0
       svelte:
         specifier: 'catalog:'
-        version: 5.55.5
+        version: 5.55.7
       tinyglobby:
         specifier: 'catalog:'
         version: 0.2.16
@@ -754,7 +754,7 @@ importers:
         version: 1.40.0
       '@zag-js/svelte':
         specifier: 'catalog:'
-        version: 1.40.0(svelte@5.55.5)
+        version: 1.40.0(svelte@5.55.7)
       '@zag-js/switch':
         specifier: 'catalog:'
         version: 1.40.0
@@ -782,13 +782,13 @@ importers:
         version: link:../skeleton
       '@sveltejs/kit':
         specifier: 'catalog:'
-        version: 2.59.1(@opentelemetry/api@1.9.1)(@sveltejs/vite-plugin-svelte@5.1.1(svelte@5.55.5)(vite@7.3.1(@types/node@25.6.2)(jiti@2.7.0)(lightningcss@1.32.0)(sass-embedded@1.93.3)(sass@1.93.3)(tsx@4.21.0)(yaml@2.8.3)))(svelte@5.55.5)(typescript@5.9.3)(vite@7.3.1(@types/node@25.6.2)(jiti@2.7.0)(lightningcss@1.32.0)(sass-embedded@1.93.3)(sass@1.93.3)(tsx@4.21.0)(yaml@2.8.3))
+        version: 2.59.1(@opentelemetry/api@1.9.1)(@sveltejs/vite-plugin-svelte@5.1.1(svelte@5.55.7)(vite@7.3.1(@types/node@25.6.2)(jiti@2.7.0)(lightningcss@1.32.0)(sass-embedded@1.93.3)(sass@1.93.3)(tsx@4.21.0)(yaml@2.8.3)))(svelte@5.55.7)(typescript@5.9.3)(vite@7.3.1(@types/node@25.6.2)(jiti@2.7.0)(lightningcss@1.32.0)(sass-embedded@1.93.3)(sass@1.93.3)(tsx@4.21.0)(yaml@2.8.3))
       '@sveltejs/package':
         specifier: 'catalog:'
-        version: 2.5.7(svelte@5.55.5)(typescript@5.9.3)
+        version: 2.5.7(svelte@5.55.7)(typescript@5.9.3)
       '@sveltejs/vite-plugin-svelte':
         specifier: 'catalog:'
-        version: 5.1.1(svelte@5.55.5)(vite@7.3.1(@types/node@25.6.2)(jiti@2.7.0)(lightningcss@1.32.0)(sass-embedded@1.93.3)(sass@1.93.3)(tsx@4.21.0)(yaml@2.8.3))
+        version: 5.1.1(svelte@5.55.7)(vite@7.3.1(@types/node@25.6.2)(jiti@2.7.0)(lightningcss@1.32.0)(sass-embedded@1.93.3)(sass@1.93.3)(tsx@4.21.0)(yaml@2.8.3))
       '@vitest/browser-playwright':
         specifier: 'catalog:'
         version: 4.1.5(playwright@1.59.1)(vite@7.3.1(@types/node@25.6.2)(jiti@2.7.0)(lightningcss@1.32.0)(sass-embedded@1.93.3)(sass@1.93.3)(tsx@4.21.0)(yaml@2.8.3))(vitest@4.1.5)
@@ -797,10 +797,10 @@ importers:
         version: 2.2.0
       svelte:
         specifier: 'catalog:'
-        version: 5.55.5
+        version: 5.55.7
       svelte-check:
         specifier: 'catalog:'
-        version: 4.4.8(picomatch@4.0.4)(svelte@5.55.5)(typescript@5.9.3)
+        version: 4.4.8(picomatch@4.0.4)(svelte@5.55.7)(typescript@5.9.3)
       typescript:
         specifier: 'catalog:'
         version: 5.9.3
@@ -809,7 +809,7 @@ importers:
         version: 7.3.1(@types/node@25.6.2)(jiti@2.7.0)(lightningcss@1.32.0)(sass-embedded@1.93.3)(sass@1.93.3)(tsx@4.21.0)(yaml@2.8.3)
       vitest-browser-svelte:
         specifier: 'catalog:'
-        version: 2.1.1(svelte@5.55.5)(vitest@4.1.5)
+        version: 2.1.1(svelte@5.55.7)(vitest@4.1.5)
 
   playgrounds/skeleton-react:
     dependencies:
@@ -870,7 +870,7 @@ importers:
     devDependencies:
       '@lucide/svelte':
         specifier: 'catalog:'
-        version: 1.14.0(svelte@5.55.5)
+        version: 1.14.0(svelte@5.55.7)
       '@skeletonlabs/skeleton':
         specifier: workspace:*
         version: link:../../packages/skeleton
@@ -879,13 +879,13 @@ importers:
         version: link:../../packages/skeleton-svelte
       '@sveltejs/adapter-auto':
         specifier: 'catalog:'
-        version: 7.0.1(@sveltejs/kit@2.59.1(@opentelemetry/api@1.9.1)(@sveltejs/vite-plugin-svelte@5.1.1(svelte@5.55.5)(vite@7.3.1(@types/node@25.6.2)(jiti@2.7.0)(lightningcss@1.32.0)
```

**File**: `pnpm-workspace.yaml` (modified, +5/-1)
```diff
@@ -122,7 +122,7 @@ catalog:
   semver: 7.8.0
   sharp: 0.34.5
   shiki: 4.0.2
-  svelte: 5.55.5
+  svelte: 5.55.7
   svelte-check: 4.4.8
   tailwindcss: 4.3.0
   tinyglobby: 0.2.16
@@ -149,6 +149,10 @@ minimumReleaseAge: 4320
 
 minimumReleaseAgeExclude:
   - '@zag-js/*'
+  # Renovate security update: svelte@5.55.7
+  - svelte@5.55.7
+  # Renovate security update: devalue@5.8.1
+  - devalue@5.8.1
 
 onlyBuiltDependencies:
   - '@parcel/watcher'
```

---

### Incident Patch 8: `30b37565` (2026-05-13)
**Commit Message**: bugfix: fix oauth (#4449)

**File**: `sites/plus.skeleton.dev/src/lib/remote/auth/sign-in.remote.ts` (modified, +3/-3)
```diff
@@ -11,15 +11,15 @@ export const signIn = form(
 	async (data) => {
 		const event = getRequestEvent();
 
-		const signIn = await auth.api.signInWithOAuth2({
+		const signIn = await auth.api.signInSocial({
 			headers: event.request.headers,
 			body: {
-				providerId: data.provider,
+				provider: data.provider,
 			},
 		});
 
 		if (!signIn.redirect || !signIn.url) {
-			error(500, 'Failed to initiate OAuth2 sign-in');
+			error(500, 'Failed to initiate social sign-in');
 		}
 
 		redirect(303, signIn.url);
```

---

### Incident Patch 9: `ea7adc7a` (2026-05-09)
**Commit Message**: fix signIn (#4423)

**File**: `sites/plus.skeleton.dev/src/lib/features/auth/sign-in.remote.ts` (modified, +4/-1)
```diff
@@ -1,5 +1,5 @@
 import * as v from 'valibot';
-import { form } from '$app/server';
+import { form, getRequestEvent } from '$app/server';
 import { error, redirect } from '@sveltejs/kit';
 import { auth } from '$lib/features/auth/auth.server';
 
@@ -8,7 +8,10 @@ export const signIn = form(
 		provider: v.picklist(Object.keys(auth.options.socialProviders)),
 	}),
 	async (data) => {
+		const event = getRequestEvent();
+
 		const signIn = await auth.api.signInSocial({
+			headers: event.request.headers,
 			body: {
 				provider: data.provider,
 			},
```

---

### Incident Patch 10: `7e7b035d` (2026-05-08)
**Commit Message**: feature: better auth fix (test) (#4414)

**File**: `sites/plus.skeleton.dev/src/lib/features/auth/auth.server.ts` (modified, +5/-4)
```diff
@@ -6,11 +6,13 @@ import * as schema from '$lib/infrastructure/database/schema';
 import { getRequestEvent } from '$app/server';
 import { sveltekitCookies } from 'better-auth/svelte-kit';
 import type { SupportedOAuthProvider } from '$lib/features/auth/supported-oauth-providers';
-import { getAppOrigin } from '$lib/infrastructure/http/get-app-origin';
 import { oAuthProxy } from 'better-auth/plugins';
 
 export const auth = betterAuth({
-	baseURL: getAppOrigin(),
+	baseURL: {
+		allowedHosts: ['localhost:*', 'plusskeleton-*-skeleton-labs.vercel.app', 'plus.skeleton.dev'],
+		protocol: 'https',
+	},
 	database: drizzleAdapter(db, {
 		provider: 'pg',
 		schema,
@@ -25,11 +27,10 @@ export const auth = betterAuth({
 			clientSecret: env.DISCORD_CLIENT_SECRET!,
 		},
 	} satisfies Record<SupportedOAuthProvider['id'], unknown>,
-	trustedOrigins: ['http://localhost:5173', 'https://plusskeleton-*-skeleton-labs.vercel.app', 'https://plus.skeleton.dev'],
 	plugins: [
+		sveltekitCookies(getRequestEvent),
 		oAuthProxy({
 			productionURL: 'https://plus.skeleton.dev',
 		}),
-		sveltekitCookies(getRequestEvent),
 	],
 });
```

---

### Incident Patch 11: `9540d173` (2026-05-08)
**Commit Message**: task: fix command (#4413)

**File**: `packages/docs/package.json` (modified, +1/-1)
```diff
@@ -14,7 +14,7 @@
 	"scripts": {
 		"generate": "node ./src/index.ts",
 		"check": "tsc",
-		"prepack": "pnpm build && clean-package",
+		"prepack": "clean-package",
 		"postpack": "clean-package restore"
 	},
 	"exports": {
```

---

### Incident Patch 12: `836a02b7` (2026-05-04)
**Commit Message**: revert: stuff (#4407)

**File**: `pnpm-workspace.yaml` (modified, +8/-9)
```diff
@@ -9,8 +9,8 @@ catalog:
   '@astrojs/partytown': 2.1.7
   '@astrojs/react': 5.0.4
   '@astrojs/sitemap': 3.7.2
-  '@astrojs/svelte': 8.1.0
-  '@astrojs/vercel': 10.0.6
+  '@astrojs/svelte': 8.0.5
+  '@astrojs/vercel': 10.0.5
   '@better-auth/drizzle-adapter': 1.6.9
   '@changesets/cli': 2.31.0
   '@clack/prompts': 1.3.0
@@ -34,12 +34,12 @@ catalog:
   '@sveltejs/adapter-vercel': 6.3.3
   '@sveltejs/kit': 2.58.0
   '@sveltejs/package': 2.5.7
-  '@sveltejs/vite-plugin-svelte': 7.0.0
+  '@sveltejs/vite-plugin-svelte': 5.1.1
   '@svitejs/changesets-changelog-github-compact': 1.2.0
   '@tailwindcss/forms': 0.5.11
   '@tailwindcss/vite': 4.2.4
   '@tanstack/react-router': 1.169.1
-  '@tanstack/react-start': 1.167.58
+  '@tanstack/react-start': 1.167.57
   '@tanstack/router-cli': 1.166.40
   '@trivago/prettier-plugin-sort-imports': 6.0.2
   '@types/chroma-js': 3.1.2
@@ -50,7 +50,7 @@ catalog:
   '@types/react': 19.2.14
   '@types/react-dom': 19.2.3
   '@types/semver': 7.7.1
-  '@vitejs/plugin-react': 6.0.1
+  '@vitejs/plugin-react': 5.2.0
   '@vitest/browser-playwright': 4.1.5
   '@zag-js/accordion': 1.40.0
   '@zag-js/avatar': 1.40.0
@@ -80,7 +80,7 @@ catalog:
   '@zag-js/toggle-group': 1.40.0
   '@zag-js/tooltip': 1.40.0
   '@zag-js/tree-view': 1.40.0
-  astro: 7.0.0-alpha.0
+  astro: 6.1.9
   astro-auto-import: 0.5.1
   astro-pagefind: 1.8.6
   astro-seo: 1.1.0
@@ -128,11 +128,11 @@ catalog:
   ts-morph: 28.0.0
   tsdown: 0.21.10
   type-fest: 5.6.0
-  typescript: 6.0.3
+  typescript: 5.9.3
   unist-util-visit: 5.1.0
   unplugin-icons: 23.0.1
   valibot: 1.3.1
-  vite: 8.0.10
+  vite: 7.3.1
   vitest: 4.1.5
   vitest-browser-react: 2.2.0
   vitest-browser-svelte: 2.1.1
@@ -148,7 +148,6 @@ minimumReleaseAge: 4320
 
 minimumReleaseAgeExclude:
   - '@zag-js/*'
-  - 'astro'
 
 onlyBuiltDependencies:
   - '@parcel/watcher'
```

**File**: `sites/skeleton.dev/astro.config.ts` (modified, +1/-0)
```diff
@@ -55,6 +55,7 @@ export default defineConfig({
 			},
 		},
 		assetsInclude: '**/pagefind.js',
+		// @ts-expect-error - Astro and Tailwind peer deps are out of sync, this doesn't effect the functionality of the plugin
 		plugins: [tailwindcss()],
 	},
 	adapter: vercel(),
```

---

### Incident Patch 13: `f3715132` (2026-05-04)
**Commit Message**: deps: revert astro alpha (#4405)

**File**: `pnpm-workspace.yaml` (modified, +9/-9)
```diff
@@ -5,12 +5,12 @@ packages:
 
 catalog:
   '@astrojs/check': 0.9.9
-  '@astrojs/mdx': 6.0.0-alpha.0
+  '@astrojs/mdx': 5.0.4
   '@astrojs/partytown': 2.1.7
-  '@astrojs/react': 6.0.0-alpha.0
+  '@astrojs/react': 5.0.4
   '@astrojs/sitemap': 3.7.2
-  '@astrojs/svelte': 9.0.0-alpha.0
-  '@astrojs/vercel': 11.0.0-alpha.0
+  '@astrojs/svelte': 8.1.0
+  '@astrojs/vercel': 10.0.6
   '@better-auth/drizzle-adapter': 1.6.9
   '@changesets/cli': 2.31.0
   '@clack/prompts': 1.3.0
@@ -34,12 +34,12 @@ catalog:
   '@sveltejs/adapter-vercel': 6.3.3
   '@sveltejs/kit': 2.58.0
   '@sveltejs/package': 2.5.7
-  '@sveltejs/vite-plugin-svelte': 5.1.1
+  '@sveltejs/vite-plugin-svelte': 7.0.0
   '@svitejs/changesets-changelog-github-compact': 1.2.0
   '@tailwindcss/forms': 0.5.11
   '@tailwindcss/vite': 4.2.4
   '@tanstack/react-router': 1.169.1
-  '@tanstack/react-start': 1.167.57
+  '@tanstack/react-start': 1.167.58
   '@tanstack/router-cli': 1.166.40
   '@trivago/prettier-plugin-sort-imports': 6.0.2
   '@types/chroma-js': 3.1.2
@@ -50,7 +50,7 @@ catalog:
   '@types/react': 19.2.14
   '@types/react-dom': 19.2.3
   '@types/semver': 7.7.1
-  '@vitejs/plugin-react': 5.2.0
+  '@vitejs/plugin-react': 6.0.1
   '@vitest/browser-playwright': 4.1.5
   '@zag-js/accordion': 1.40.0
   '@zag-js/avatar': 1.40.0
@@ -128,11 +128,11 @@ catalog:
   ts-morph: 28.0.0
   tsdown: 0.21.10
   type-fest: 5.6.0
-  typescript: 5.9.3
+  typescript: 6.0.3
   unist-util-visit: 5.1.0
   unplugin-icons: 23.0.1
   valibot: 1.3.1
-  vite: 7.3.1
+  vite: 8.0.10
   vitest: 4.1.5
   vitest-browser-react: 2.2.0
   vitest-browser-svelte: 2.1.1
```

#### Recent Merged Pull Requests:
- **PR #4558** (2026-08-28): Update dependency node-html-parser to v9 (@renovate[bot])
- **PR #4555** (2026-08-20): docs: update footer + update download count (@Hugos68)
- **PR #4554** (2026-08-19): docs: fix overflow (@Hugos68)
- **PR #4552** (2026-08-19): task: release (@github-actions[bot])
- **PR #4551** (2026-08-17): release workflow: port new args (@Hugos68)
- **PR #4550** (2026-08-17): Update dependency @changesets/cli to v3 (@renovate[bot])
- **PR #4549** (2026-08-17): Update changesets/action action to v2 (@renovate[bot])
- **PR #4548** (2026-08-17): Update dependency nanoid to v6 - autoclosed (@renovate[bot])

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
