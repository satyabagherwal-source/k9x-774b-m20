# Forensic Learning Record (Deep Inspection): reshaped-ui/reshaped

> **Canonical Artifact**: `07_PROJECT_LEARNING/reshaped-ui-reshaped-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/reshaped-ui/reshaped](https://github.com/reshaped-ui/reshaped))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-09-30T18:13:29.460Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `reshaped-ui/reshaped`
- **Description**: Reshaped provides accessible React and Figma components for building beautiful products or starting your own design system
- **Primary Language / Ecosystem**: TypeScript
- **Discovered Manifests / Configurations**: package.json, README.md
- **Stars / Engagement**: 2244 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: package.json, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `.storybook/main.ts`
```
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { StorybookConfig } from "@storybook/react-vite";
import { mergeConfig, UserConfig } from "vite";
import tsconfigPaths from "vite-tsconfig-paths";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const config: StorybookConfig = {
	framework: "@storybook/react-vite",
	typescript: {
		reactDocgen: "react-docgen",
	},
	stories: ["../packages/reshaped/src/**/*.stories.tsx"],
	staticDirs: ["./public"],
	addons: [
		"@storybook/addon-vitest",
		"@storybook/addon-a11y",
		"./plugins/preset.mjs",
		{
			name: "@storybook/addon-docs",
			options: {
				sourceLoaderOptions: {
					injectStoryParameters: false,
				},
			},
		},
		"@storybook/addon-mcp",
	],
	async viteFinal(config: UserConfig) {
		return mergeConfig(config, {
			plugins: [
				tsconfigPaths({
					projects: [resolve(__dirname, "../packages/reshaped/tsconfig.json")],
				}),
			],
			css: {
				postcss: resolve(__dirname),
			},
			build: {
				rollupOptions: {
					logLevel: "silent",
					onwarn: (warning: { code: string }, warn: (warning: { code: string }) => void) => {
						if (warning.code === "MODULE_LEVEL_DIRECTIVE") return;
						warn(warning);
					},
				},
			},
		});
	},
};

export default config;

```

### Core Architecture Module: `.storybook/manager.ts`
```
import { addons } from "storybook/manager-api";
import { create } from "storybook/theming";

addons.setConfig({
	panelPosition: "right",
	theme: create({
		base: "dark",
		brandTitle: "Reshaped",
		brandUrl: "https://reshaped.so",
		brandImage: "./logo.svg",
		brandTarget: "_self",
	}),
});

```

### Core Architecture Module: `.storybook/plugins/iframe.mjs`
```
import React from "react";
import { AddonPanel } from "storybook/internal/components";
import { addons, types } from "storybook/manager-api";

const ADDON_ID = "reshaped-iframe";
const PANEL_ID = `${ADDON_ID}/panel`;

addons.register(ADDON_ID, (api) => {
	addons.add(PANEL_ID, {
		type: types.PANEL,
		title: "Reshaped docs",
		render: (props) => {
			const data = api.getCurrentParameter("iframe");

			return React.createElement(
				AddonPanel,
				{ style: { height: "100%" }, ...props },
				data?.url &&
					React.createElement("iframe", {
						src: data.url,
						style: {
							width: "100%",
							height: "100%",
							outline: "none",
							border: "none",
							position: "absolute",
						},
					})
			);
		},
	});
});

```

### Core Architecture Module: `.storybook/plugins/preset.mjs`
```
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

function managerEntries(entry = []) {
	return [...entry, resolve(__dirname, "./iframe.mjs")];
}

export default {
	managerEntries,
};

```

### Core Architecture Module: `.storybook/postcss.config.mjs`
```
import path from "path";
import { fileURLToPath } from "url";
import postcssGlobalData from "@csstools/postcss-global-data";
import customMediaPlugin from "postcss-custom-media";

import baseConfig from "../packages/reshaped/tools/build/postcss.config.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default {
	plugins: [
		...baseConfig.plugins,
		postcssGlobalData({
			files: [path.resolve(__dirname, "../packages/reshaped/src/themes/slate/media.css")],
		}),
		customMediaPlugin(),
	],
};

```

### Core Architecture Module: `.storybook/preview.jsx`
```
import React from "react";

import Button from "../packages/reshaped/src/components/Button";
import DropdownMenu from "../packages/reshaped/src/components/DropdownMenu";
import Hidden from "../packages/reshaped/src/components/Hidden";
import Icon from "../packages/reshaped/src/components/Icon";
import Reshaped from "../packages/reshaped/src/components/Reshaped";
import Text from "../packages/reshaped/src/components/Text";
import { useTheme } from "../packages/reshaped/src/components/Theme";
import View from "../packages/reshaped/src/components/View";
import useRTL from "../packages/reshaped/src/hooks/useRTL";
import IconCheckmark from "../packages/reshaped/src/icons/Checkmark";
import "../packages/reshaped/src/themes/slate/theme.css";
import "../packages/reshaped/src/themes/figma/theme.css";
import "../packages/reshaped/src/themes/fragments/twitter/theme.css";

const ThemeSwitch = () => {
	const { invertColorMode, colorMode, setRootTheme, theme } = useTheme();
	const [rtl, setRTL] = useRTL();

	const handleThemeChange = (theme) => {
		setRootTheme(theme);
		localStorage.setItem("__reshaped-theme", theme);
	};

	const handleModeChange = () => {
		invertColorMode();
		localStorage.setItem("__reshaped-mode", colorMode === "dark" ? "light" : "dark");
	};

	return (
		<View
			direction="row"
			align="center"
			gap={2}
			position="fixed"
			zIndex={99}
			insetBottom={2}
			insetEnd={2}
			attributes={{ dir: "ltr", "data-chromatic": "ignore" }}
		>
			<Text variant="caption-1" weight="medium">
				<Hidden hide={{ s: false, m: true }} as="span">
					S
				</Hidden>
				<Hidden hide={{ s: true, m: false, l: true }} as="span">
					M
				</Hidden>
				<Hidden hide={{ s: true, l: false, xl: true }} as="span">
					L
				</Hidden>
				<Hidden hide={{ s: true, xl: false }} as="span">
					XL
				</Hidden>
			</Text>

			<Button onClick={() => setRTL(!rtl)} size="small">
				Toggle direction
			</Button>
			<Button onClick={handleModeChange} size="small">
				Toggle mode
			</Button>

			<DropdownMenu position="top-end" fallbackPositions={[]}>
				<DropdownMenu.Trigger>
					{(attributes) => (
						<Button attributes={attributes} size="small">
							Switch theme
						</Button>
					)}
				</DropdownMenu.Trigger>
				<DropdownMenu.Content>
					<DropdownMenu.Item
						onClick={() => handleThemeChange("slate")}
						endSlot={
							theme === "slate" ? <Icon svg={IconCheckmark} color="primary" size={5} /> : undefined
						}
					>
						Slate
					</DropdownMenu.Item>

					<DropdownMenu.Item
						onClick={() => handleThemeChange("figma")}
						endSlot={
							theme === "figma" ? <Icon svg={IconCheckmark} color="primary" size={5} /> : undefined
						}
					>
						Figma
					</DropdownMenu.Item>
				</DropdownMenu.Content>
			</DropdownMenu>
		</View>
	);
};

const reshapedDecorator = (Story, { parameters }) => {
	if (parameters.disableWrapper) return <Story />;

	return (
		<React.StrictMode>
			<Reshaped
				defaultTheme={localStorage.getItem("__reshaped-theme") || "slate"}
				defaultColorMode={localStorage.getItem("__reshaped-mode") || "dark"}
			>
				<View paddingBottom={10}>
					<Story />
				</View>
				<ThemeSwitch />
			</Reshaped>
		</React.StrictMode>
	);
};

const preview = {
	decorators: [reshapedDecorator],
	parameters: {
		actions: {
			disable: true,
		},

		options: {
			storySort: {
				order: ["Components", "Utility components", "Hooks", "Utilities", "Internal"],
			},
		},

		docs: {
			codePanel: true,
		},
	},
};

export const parameters = {
	layout: "fullscreen",
	a11y: {
		config: {
			rules: [
				{
					id: "region",
					enabled: true,
				},
			],
		},
	},
};

export default preview;

```

### Core Architecture Module: `packages/reshaped/bin/cli.js`
```
#!/usr/bin/env node
require("@reshaped/theming/cli/run");

```

### Core Architecture Module: `packages/reshaped/src/Sandbox.stories.tsx`
```
import React from "react";

import Image from "@/components/Image";
import View from "@/components/View";
import Tabs from "./components/Tabs";

export default {
	title: "Sandbox",
	chromatic: { disableSnapshot: true },
};

const Preview: React.FC<{ children: React.ReactNode }> = (props) => {
	return (
		<View padding={25} gap={6}>
			<View position="absolute" insetTop={0} insetStart={0}>
				<Image src="./logo.svg" />
			</View>

			{props.children}
		</View>
	);
};

export const preview = () => {
	return (
		<Preview>
			<Component />
		</Preview>
	);
};

const Component = () => {
	return (
		<View align="center" justify="center" height="100px">
			<Tabs variant="pills-raised" defaultValue="0">
				<Tabs.List>
					<Tabs.Item value="0">Themes</Tabs.Item>
					<Tabs.Item value="1">Components</Tabs.Item>
					<Tabs.Item value="2">Templates</Tabs.Item>
				</Tabs.List>
			</Tabs>
		</View>
	);
};

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #670** (2026-09-12): **Modal: velocity-aware release spring and rubber band for the swipe gesture**
  *Symptoms*: ## Summary  The swipe-to-close gesture had three physics gaps:  1. **Release ignored the finger speed.** Closing always ran the base `150ms` `accelerate` transition from the dragged position, so a flick started slow (ease-in from rest) and a slow release jumped to a much higher speed. 2. **Returning to the open position snapped.** `resetDragData()` wrote `--rs-modal-drag: 0px` synchronously in `touchend`, while the `--dragging` class (`transition: none`) was still in the DOM until React committed, so there was no transition at all. 3. **Overdrag was hard-clamped** to 0 in both JS and CSS (`max(var(--rs-modal-drag), 0px)`), so pulling a bottom sheet up or a drawer inward did nothing.  ### Velocity-aware release  - The release velocity is measured over the last 100ms of touch samples. - Close decision: a flick faster than `0.4px/ms` in the closing direction closes regardless of distance (same threshold Vaul uses); a drag past the existing 32px threshold closes unless the finger was moving back on release; everything else returns. - The release animation is resolved from a **critically damped spring** (ω = 20/s) that starts at the measured velocity, sampled at 120Hz into a CSS `linear()` easing with a matching duration (`resolveSpringTransition` in `utilities/animation.ts`). The transition is still a plain CSS `transform` transition on the compositor; JS only computes the easing once on release. Velocity fed to the spring is capped at 3px/ms to bound the overshoot. - Browsers wi
  **Post-Mortem & Fix Analysis**:
  > ## size-limit report 📦  | Path                                         | Size                 | Loading time (3g) | Running time (snapdragon) | Total time | | -------------------------------------------- | -------------------- | ----------------- | ------------------------- | ---------- | | Library / JS                                 | 51.53 KB (+1.71% 🔺) | 1.1 s (+1.71% 🔺) | 1.8 s (-15.96% 🔽)        | 2.9 s      | | Library / CSS                                | 23.77 KB (0%)        | 476 ms (0%)       | 0 ms (+100% 🔺)           | 476 ms     | | Theming / JS                                 | 7.78 KB (0%)         | 156 ms (0%)       | 128 ms (+58.04% 🔺)       | 283 ms     | | Theming with a default theme definition / JS | 8.69 KB (0%)         | 174 ms (0%)       | 208 ms (-14.63% 🔽)       | 382 ms     |

- **Issue #669** (2026-09-12): **Modal: register the drag offset as a non-inherited property**
  *Symptoms*: ## Summary  `Modal` drives its swipe-to-close gesture by writing `--rs-modal-drag` to the modal root on every `touchmove` frame (throttled by `requestAnimationFrame`), and the root's `transform` reads it back. The property itself is the right tool (the transform stays on the compositor), but as an unregistered custom property it **inherits**, so each write invalidates the computed style of every element inside the modal. On a content-heavy sheet that is the dominant per-frame cost of the gesture, and it lands on the main thread, which is exactly what gets throttled on phones in low-power mode.  This PR registers it with `@property { inherits: false }` so the update only recalculates the root's own style. No JS or markup changes; nothing else reads the variable.  Measured in headless Chromium on the `position: bottom` story with 2000 extra rows appended (6008 nodes inside the dialog), timing `style.setProperty('--rs-modal-drag')` + forced style recalc:  | | per drag frame | |---|---| | `main` (inherited custom property) | 5.94 ms | | this PR (`@property`, `inherits: false`) | 0.115 ms |  Browsers without `@property` support ignore the rule and keep the previous behavior, same as the existing registrations in `ScrollArea` and `Table`.  ## Related Issue  N/A  ## Screenshots / Recordings  Simulated a touch drag on a bottom modal in Chromium: the sheet follows the finger (`translate(0, 88px)` at 88px of drag) and closes on release, same as before.  ## Notes for Reviewers  - Modal 
  **Post-Mortem & Fix Analysis**:
  > ## size-limit report 📦  | Path                                         | Size          | Loading time (3g) | Running time (snapdragon) | Total time | | -------------------------------------------- | ------------- | ----------------- | ------------------------- | ---------- | | Library / JS                                 | 50.67 KB (0%) | 1.1 s (0%)        | 106 ms (-47.13% 🔽)       | 1.2 s      | | Library / CSS                                | 23.77 KB (0%) | 476 ms (0%)       | 0 ms (+100% 🔺)           | 476 ms     | | Theming / JS                                 | 7.78 KB (0%)  | 156 ms (0%)       | 13 ms (-16.92% 🔽)        | 168 ms     | | Theming with a default theme definition / JS | 8.69 KB (0%)  | 174 ms (0%)       | 15 ms (-0.14% 🔽)         | 189 ms     |

- **Issue #668** (2026-09-12): **ScrollArea: move the thumb with transform instead of inset**
  *Symptoms*: ## Summary  Following the guidance in [The Browser's Main Thread Is Expensive](https://kciter.so/posts/the-expensive-main-thread/en/): scroll-linked visuals should be driven by `transform`/`opacity` on the compositor, not by layout properties updated from JavaScript on every frame.  `ScrollArea`'s custom scrollbar previously did the most expensive version of this on every `scroll` event:  1. `handleScroll` called `setScrollPosition`, re-rendering `ScrollArea` and both `ScrollAreaBar`s through React. 2. The new position was applied to the thumb's `::before` via `inset-block-start` / `inset-inline-start`, which are layout properties, so each scroll frame ran style → layout → paint on the main thread.  This PR:  - **Moves the thumb with `transform: translateX/translateY`** instead of `inset`. The translate percentage is relative to the thumb's own size, so the position is divided by the ratio to map it back onto the track (`position / ratio * 100%`). The thumb pseudo-element gets `will-change: transform` so it stays on its own compositor layer between updates. - **Lets each bar track the scrollable element itself.** `ScrollAreaBar` receives the `scrollableRef`, attaches a passive `scroll` listener, and writes `--rs-scroll-area-position` onto its own element. Scroll events no longer re-render anything, and the style recalculation stays scoped to the bar (writing an inherited custom property on the root instead would invalidate every node of the scrolled content: measured ~10ms pe
  **Post-Mortem & Fix Analysis**:
  > ## size-limit report 📦  | Path                                         | Size          | Loading time (3g) | Running time (snapdragon) | Total time | | -------------------------------------------- | ------------- | ----------------- | ------------------------- | ---------- | | Library / JS                                 | 50.66 KB (0%) | 1.1 s (0%)        | 1.3 s (+14.12% 🔺)        | 2.3 s      | | Library / CSS                                | 23.87 KB (0%) | 478 ms (0%)       | 0 ms (+100% 🔺)           | 478 ms     | | Theming / JS                                 | 7.78 KB (0%)  | 156 ms (0%)       | 183 ms (+153.75% 🔺)      | 339 ms     | | Theming with a default theme definition / JS | 8.69 KB (0%)  | 174 ms (0%)       | 136 ms (-18.77% 🔽)       | 310 ms     |

- **Issue #667** (2026-09-12): **Overlay: animate backdrop opacity instead of background-color**
  *Symptoms*: ## Summary  Following the guidance in [The Browser's Main Thread Is Expensive](https://kciter.so/posts/the-expensive-main-thread/en/): only `transform` and `opacity` can be animated on the compositor thread, everything else forces style/layout/paint work on the main thread every frame.  The `Overlay` root is a `position: fixed` element covering the whole viewport. It transitioned `background-color` (0% → 70% black) together with `opacity` on open/close, and `Modal` updated that `background-color` on every frame of the drag-to-close gesture through the inherited `--rs-overlay-opacity` custom property. Every one of those frames repainted the full viewport on the main thread, and the custom property change on the root also forced a style recalculation of the entire overlay subtree (the whole modal content).  This PR renders the backdrop as a dedicated `.backdrop` element with a **static** 70% black background and animates only its `opacity`:  - Open/close: `.backdrop` transitions `opacity` with the same duration/easing as the root, so the resulting fade curve (`0.7 · t²`) is unchanged and runs on the compositor. - Drag-to-close: `instanceRef.setOpacity()` now writes `style.opacity` directly on the backdrop element, so the update is scoped to that single element instead of invalidating style for every descendant. Measured in Chromium: updating an inherited custom property on the root of a 6000-node subtree costs ~10ms of style recalc per update, versus ~0.01ms for a direct opacit
  **Post-Mortem & Fix Analysis**:
  > ## size-limit report 📦  | Path                                         | Size          | Loading time (3g) | Running time (snapdragon) | Total time | | -------------------------------------------- | ------------- | ----------------- | ------------------------- | ---------- | | Library / JS                                 | 50.66 KB (0%) | 1.1 s (0%)        | 2.1 s (-7.88% 🔽)         | 3.1 s      | | Library / CSS                                | 23.87 KB (0%) | 478 ms (0%)       | 0 ms (+100% 🔺)           | 478 ms     | | Theming / JS                                 | 7.78 KB (0%)  | 156 ms (0%)       | 469 ms (+293.9% 🔺)       | 625 ms     | | Theming with a default theme definition / JS | 8.69 KB (0%)  | 174 ms (0%)       | 279 ms (+65.24% 🔺)       | 453 ms     |

- **Issue #666** (2026-09-07): **Image: render the fallback when loading fails before hydration**
  *Symptoms*: ## Summary  `Image` only learned about a failed load from its React `onError` handler, so a server rendered `<img>` that failed before hydration never moved `status` past `loading` and the `fallback` was never rendered — the browser's broken image icon stayed on screen.  The image element is now also checked when it gets mounted: if it already finished loading without intrinsic dimensions, `decode()` tells a genuinely broken image (rejects) apart from one that legitimately has no intrinsic size, like a `viewBox` only svg (resolves). Images that are still loading keep going through `onError` as before.  - `Image.tsx`: added a callback ref on the image element that detects an already failed load and switches the status to `error`. It composes with a `ref` passed through `imageAttributes` or `attributes`, so existing refs keep working, and it re-runs when `src` changes. - Added a `fallback, error before hydration` story that reproduces the issue: it lets server rendered markup fail to load, then hydrates it and expects the fallback. The story fails on `main` and passes with this change. - Added a patch changeset.  ## Related Issue  Fixes #660  ## Screenshots / Recordings  No visual changes to the existing states — the fallback simply renders in a case where the broken image icon used to show.  ## Notes for Reviewers  - The status is only flipped to `error`; `onLoad` / `onError` callbacks are not synthesized for the pre-hydration case since there is no real event to pass to them.
  **Post-Mortem & Fix Analysis**:
  > ## size-limit report 📦  | Path                                         | Size          | Loading time (3g) | Running time (snapdragon) | Total time | | -------------------------------------------- | ------------- | ----------------- | ------------------------- | ---------- | | Library / JS                                 | 49.77 KB (0%) | 996 ms (0%)       | 1.7 s (-34.18% 🔽)        | 2.7 s      | | Library / CSS                                | 23.44 KB (0%) | 469 ms (0%)       | 0 ms (+100% 🔺)           | 469 ms     | | Theming / JS                                 | 7.78 KB (0%)  | 156 ms (0%)       | 182 ms (+109.12% 🔺)      | 338 ms     | | Theming with a default theme definition / JS | 8.69 KB (0%)  | 174 ms (0%)       | 178 ms (-17.76% 🔽)       | 352 ms     |

- **Issue #665** (2026-09-12): **DropdownMenu, ContextMenu: support size on the root component**
  *Symptoms*: ## Summary  Added a `size` property to the `DropdownMenu` and `ContextMenu` root components. It's used as the default size of all their menu items, so items no longer have to be updated one by one.  - `DropdownMenu` accepts `size` (same responsive `MenuItem` size value) and passes it down through a new internal size context. - `DropdownMenu.Item` uses that size when it doesn't have its own `size`, so per-item `size` still takes priority. - `DropdownMenu.SubMenu` inherits the size from its parent menu and can also override it with its own `size`. - `ContextMenu` picks the property up automatically since its props extend `DropdownMenuProps`.  ```tsx <DropdownMenu size="large"> 	<DropdownMenu.Content> 		<DropdownMenu.Item>Large item</DropdownMenu.Item> 		<DropdownMenu.Item size="small">Small item</DropdownMenu.Item> 	</DropdownMenu.Content> </DropdownMenu> ```  ## Related Issue  N/A  ## Screenshots / Recordings  No new visual behavior beyond the existing `MenuItem` sizes — the new `size` stories in `DropdownMenu.stories.tsx` and `ContextMenu.stories.tsx` cover small / medium / large, a per-item override and a responsive value.  ## Notes for Reviewers  - The size context is defined in `DropdownMenu.tsx` next to the existing submenu contexts instead of a separate `DropdownMenu.context.ts` file — happy to move it if you'd prefer the convention used by newer components. - Submenu inheritance is implemented by resolving `size ?? parentSize` in the root component, since `DropdownMenu.
  **Post-Mortem & Fix Analysis**:
  > ## size-limit report 📦  | Path                                         | Size                 | Loading time (3g)  | Running time (snapdragon) | Total time | | -------------------------------------------- | -------------------- | ------------------ | ------------------------- | ---------- | | Library / JS                                 | 49.77 KB (+0.68% 🔺) | 996 ms (+0.68% 🔺) | 2.3 s (+1.96% 🔺)         | 3.3 s      | | Library / CSS                                | 23.44 KB (+1.38% 🔺) | 469 ms (+1.38% 🔺) | 0 ms (+100% 🔺)           | 469 ms     | | Theming / JS                                 | 7.78 KB (-0.12% 🔽)  | 156 ms (-0.12% 🔽) | 181 ms (+106.74% 🔺)      | 337 ms     | | Theming with a default theme definition / JS | 8.69 KB (+0.21% 🔺)  | 174 ms (+0.21% 🔺) | 264 ms (+15.01% 🔺)       | 438 ms     |

- **Issue #664** (2026-09-12): **fix(Flyout): close content on right click outside**
  *Symptoms*: ## Summary  Flyout only reacted to the `click` event when detecting outside clicks, and browsers don't emit `click` for the secondary mouse button — `useOnClickOutside` even had an explicit `event.button === 2` guard. So right clicking outside of the rendered content never closed it. It's most noticeable with `ContextMenu`: every right click opened a new menu while all the previous ones stayed on the screen.  `useOnClickOutside` now also listens for the `contextmenu` event:  - The listener is registered in the **capture** phase, so the currently rendered content closes *before* another component opens its own content on the same event. That lets `ContextMenu` components replace each other instead of stacking up. Right clicking the same area again still just moves the menu to the new position, because both state updates are batched into a single render. - The target check runs synchronously off the event instead of reusing the `mousedown` result, since `contextmenu` can also be triggered from the keyboard (`Shift+F10` / the context menu key) with no preceding `mousedown`. - Everything still goes through the existing `disabled` option, so `disableCloseOnOutsideClick` keeps working and the close reason stays `outside-click`.  The inside-the-refs check used by `mousedown`/`touchstart` was extracted into a shared `checkEventInsideRefs` helper so both paths stay in sync.  ## Related Issue  N/A  ## Screenshots / Recordings  N/A — covered by the interaction tests below.  ## Notes for
  **Post-Mortem & Fix Analysis**:
  > ## size-limit report 📦  | Path                                         | Size                 | Loading time (3g)  | Running time (snapdragon) | Total time | | -------------------------------------------- | -------------------- | ------------------ | ------------------------- | ---------- | | Library / JS                                 | 49.74 KB (-0.18% 🔽) | 995 ms (-0.18% 🔽) | 1.8 s (-13.56% 🔽)        | 2.8 s      | | Library / CSS                                | 23.44 KB (0%)        | 469 ms (0%)        | 0 ms (+100% 🔺)           | 469 ms     | | Theming / JS                                 | 7.78 KB (0%)         | 156 ms (0%)        | 224 ms (+197.93% 🔺)      | 380 ms     | | Theming with a default theme definition / JS | 8.69 KB (0%)         | 174 ms (0%)        | 150 ms (-39.33% 🔽)       | 324 ms     |

- **Issue #663** (2026-09-06): **feat(Link): add fullWidth support**
  *Symptoms*: ## Summary  Adds a responsive `fullWidth` prop to `Link`, matching the API already used by `Button` (`G.Responsive<boolean>`).  `Link` renders as `display: inline` by default, so `width: 100%` alone has no effect. The prop therefore switches the display mode as well:  | state | `display` | `width` | | --- | --- | --- | | `fullWidth` | `block` | `100%` | | `fullWidth` + `icon` | `flex` | `100%` | | not full width | `inline` | `auto` | | not full width + `icon` | `inline-flex` | `auto` |  The `--with-icon` case is handled inside both the `true` and `false` `@value` blocks so that responsive values reset correctly at every breakpoint — the nested selectors carry higher specificity than the base `.root.--with-icon` rule, and the generated media-query rules keep matching specificity so a later breakpoint can override an earlier one.  Unlike `Button`, this does not force `text-align: center` — that reads as button-specific and would be surprising for a text link.  Changes: - `Link.types.ts` — new `fullWidth?: G.Responsive<boolean>` prop - `Link.tsx` — wires it through `responsiveClassNames`, same as `Button` - `Link.module.css` — new `@responsive .root.--full-width` block - `Link.stories.tsx` — `fullWidth` story (plain, with icon, and responsive `{ s: true, m: false }`) with a `display: block` assertion - changeset (`minor`)  ## Related Issue  <!-- Link to the issue number if applicable -->  ## Screenshots / Recordings  No screenshots attached — the new `fullWidth` story covers the
  **Post-Mortem & Fix Analysis**:
  > ## size-limit report 📦  | Path                                         | Size                 | Loading time (3g)  | Running time (snapdragon) | Total time | | -------------------------------------------- | -------------------- | ------------------ | ------------------------- | ---------- | | Library / JS                                 | 49.76 KB (+0.17% 🔺) | 996 ms (+0.17% 🔺) | 1.4 s (-14.06% 🔽)        | 2.4 s      | | Library / CSS                                | 23.5 KB (+0.28% 🔺)  | 471 ms (+0.28% 🔺) | 0 ms (+100% 🔺)           | 471 ms     | | Theming / JS                                 | 7.78 KB (0%)         | 156 ms (0%)        | 159 ms (+421.23% 🔺)      | 315 ms     | | Theming with a default theme definition / JS | 8.69 KB (0%)         | 174 ms (0%)        | 162 ms (-5.56% 🔽)        | 336 ms     |

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

### Incident Patch 1: `469a1b27` (2026-09-06)
**Commit Message**: fix(Badge): truncate long text and stop dismiss from following the link (#662)

Co-authored-by: Claude <noreply@anthropic.com>

**File**: `.changeset/fix-badge-dismiss-link.md` (added, +5/-0)
```diff
@@ -0,0 +1,5 @@
+---
+"reshaped": patch
+---
+
+Badge: Fixed dismiss button following the link when the badge is rendered with the href prop
```

**File**: `.changeset/fix-badge-truncation.md` (added, +5/-0)
```diff
@@ -0,0 +1,5 @@
+---
+"reshaped": patch
+---
+
+Badge: Limited the width to 100% of the parent element and truncated the long text with an ellipsis
```

**File**: `packages/reshaped/src/components/Badge/Badge.module.css` (modified, +14/-0)
```diff
@@ -13,6 +13,7 @@
 	color: var(--rs-color-on-background-neutral);
 	box-sizing: border-box;
 	box-shadow: 0 0 0 1px var(--rs-badge-border-color) inset;
+	max-width: 100%;
 
 	/* GPU for container positioning */
 	backface-visibility: hidden;
@@ -32,9 +33,20 @@
 	display: inline-flex;
 	align-items: center;
 	gap: var(--rs-badge-gap);
+	max-width: 100%;
+	min-width: 0;
+}
+
+.text {
+	overflow: hidden;
+	white-space: nowrap;
+	text-overflow: ellipsis;
+	min-width: 0;
 }
 
 .icon {
+	flex-shrink: 0;
+
 	&:first-child {
 		margin-inline-start: calc(var(--rs-unit-x0-5) * -1);
 	}
@@ -49,6 +61,7 @@
 }
 
 .dismiss {
+	flex-shrink: 0;
 	border-radius: var(--rs-radius-small);
 	transition: var(--rs-duration-fast) var(--rs-easing-standard);
 	transition-property: opacity;
@@ -170,6 +183,7 @@
 .container .root {
 	position: absolute;
 	z-index: 10;
+	max-width: none;
 	inset-inline-end: 0;
 	transform: translate(50%, var(--rs-badge-translate-y)) scale(1);
 	user-select: none;
```

**File**: `packages/reshaped/src/components/Badge/Badge.tsx` (modified, +4/-0)
```diff
@@ -49,6 +49,9 @@ const Badge = forwardRef<ActionableRef, T.Props>((props, ref) => {
 	);
 
 	const handleDismiss: ActionableProps["onClick"] = (e) => {
+		// Prevent the parent Actionable from handling the click,
+		// including following the link when the badge is rendered as one
+		e.preventDefault();
 		e.stopPropagation();
 		onDismiss?.();
 	};
@@ -69,6 +72,7 @@ const Badge = forwardRef<ActionableRef, T.Props>((props, ref) => {
 					<Text
 						variant={size === "large" ? "body-2" : "caption-1"}
 						weight="medium"
+						className={s.text}
 						attributes={{
 							"aria-hidden": hidden ? "true" : undefined,
 						}}
```

**File**: `packages/reshaped/src/components/Badge/tests/Badge.stories.tsx` (modified, +63/-0)
```diff
@@ -337,6 +337,69 @@ export const href: StoryObj = {
 	},
 };
 
+export const hrefDismissible: StoryObj<{ handleDismiss: ReturnType<typeof fn> }> = {
+	name: "test: href, onDismiss",
+	args: {
+		handleDismiss: fn(),
+	},
+	render: (args) => (
+		<Badge href="#badge-dismiss" onDismiss={args.handleDismiss} dismissAriaLabel="Dismiss">
+			Badge
+		</Badge>
+	),
+	play: async ({ canvas, args }) => {
+		const initialHash = window.location.hash;
+		const dismissTrigger = canvas.getByRole("button", { name: "Dismiss" });
+
+		expect(canvas.getByRole("link")).toHaveAttribute("href", "#badge-dismiss");
+
+		await userEvent.click(dismissTrigger);
+
+		expect(args.handleDismiss).toHaveBeenCalledTimes(1);
+		// Dismissing the badge shouldn't follow the link
+		expect(window.location.hash).toBe(initialHash);
+	},
+};
+
+export const truncation: StoryObj = {
+	name: "test: truncation",
+	render: () => (
+		<Example>
+			<Example.Item title={["truncation", "text is truncated, badge is not wider than 200px"]}>
+				<View width="200px" align="start" gap={3} attributes={{ "data-testid": "root" }}>
+					<Badge attributes={{ "data-testid": "badge" }}>
+						Badge with a very long text that should get truncated
+					</Badge>
+					<Badge icon={IconPlus} endIcon={IconPlus} attributes={{ "data-testid": "badge" }}>
+						Badge with a very long text that should get truncated
+					</Badge>
+					<Badge
+						onDismiss={() => {}}
+						dismissAriaLabel="Dismiss"
+						attributes={{ "data-testid": "badge" }}
+					>
+						Badge with a very long text that should get truncated
+					</Badge>
+				</View>
+			</Example.Item>
+		</Example>
+	),
+	play: async ({ canvas }) => {
+		const badges = canvas.getAllByTestId("badge");
+
+		badges.forEach((badge) => {
+			// Badge is not growing wider than its parent
+			expect(badge.getBoundingClientRect().width).toBeLessThanOrEqual(200);
+
+			// Badge text is rendered on a single line and gets clipped
+			const text = badge.querySelector("div")!;
+
+			expect(text.scrollWidth).toBeGreaterThan(text.clientWidth);
+			expect(getComputedStyle(text).textOverflow).toBe("ellipsis");
+		});
+	},
+};
+
 export const onClick: StoryObj<{ handleClick: ReturnType<typeof fn> }> = {
 	name: "onClick",
 	args: {
```

---

### Incident Patch 2: `69b74133` (2026-09-06)
**Commit Message**: fix(Accordion): don't replay the expand animation when effects are re-attached (#661)

Co-authored-by: Claude Opus 5 <noreply@anthropic.com>

**File**: `.changeset/fix-accordion-animation-replay.md` (added, +5/-0)
```diff
@@ -0,0 +1,5 @@
+---
+"reshaped": patch
+---
+
+Accordion: Fixed the expand animation replaying when React re-attaches the effects of a mounted accordion without changing its state, for example when it's moved between its siblings or hidden and shown by a Suspense boundary. Toggling the accordion while it's still animating now continues from the current height instead of jumping, and transitions bubbling up from the content no longer end the animation early.
```

**File**: `packages/reshaped/src/components/_private/Expandable/Expandable.tsx` (modified, +32/-18)
```diff
@@ -12,6 +12,8 @@ const Expandable: React.FC<T.ContentProps> = (props) => {
 	const { children, active, attributes } = props;
 	const rootRef = React.useRef<HTMLDivElement>(null);
 	const mountedRef = React.useRef(false);
+	const animatedActiveRef = React.useRef(active);
+	const frameRef = React.useRef<number | null>(null);
 	const [animatedHeight, setAnimatedHeight] = React.useState<React.CSSProperties["height"] | null>(
 		active ? "auto" : null
 	);
@@ -22,7 +24,7 @@ const Expandable: React.FC<T.ContentProps> = (props) => {
 	);
 
 	const handleTransitionEnd = (e: React.TransitionEvent) => {
-		if (e.propertyName !== "height") return;
+		if (e.propertyName !== "height" || e.target !== rootRef.current) return;
 
 		setAnimatedHeight(active ? "auto" : null);
 	};
@@ -35,33 +37,45 @@ const Expandable: React.FC<T.ContentProps> = (props) => {
 		});
 	}, []);
 
+	// Animating only on the active prop change keeps React from replaying the animation
+	// when it tears down and sets up the effects of the mounted component again
 	useIsomorphicLayoutEffect(() => {
 		const rootEl = rootRef.current;
-		if (!rootEl || !mountedRef.current) return;
+		const activeChanged = animatedActiveRef.current !== active;
 
-		if (!checkTransitions()) {
+		animatedActiveRef.current = active;
+
+		if (!rootEl || !activeChanged) return;
+
+		if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
+		frameRef.current = null;
+
+		const settle = () => {
+			rootEl.style.height = "";
 			setAnimatedHeight(active ? "auto" : null);
+		};
+
+		if (!mountedRef.current || !checkTransitions()) {
+			settle();
 			return;
 		}
 
-		if (active) {
-			rootEl.style.height = "auto";
-
-			requestAnimationFrame(() => {
-				const targetHeight = rootEl.clientHeight;
-				rootEl.style.height = "0";
+		const currentHeight = rootEl.clientHeight;
 
-				requestAnimationFrame(() => {
-					setAnimatedHeight(targetHeight);
-				});
-			});
-		} else {
-			rootEl.style.height = `${rootEl.clientHeight}px`;
+		if (active) rootEl.style.height = "auto";
+		const targetHeight = active ? rootEl.clientHeight : 0;
 
-			requestAnimationFrame(() => {
-				setAnimatedHeight(0);
-			});
+		if (targetHeight === currentHeight) {
+			settle();
+			return;
 		}
+
+		rootEl.style.height = `${currentHeight}px`;
+
+		frameRef.current = requestAnimationFrame(() => {
+			frameRef.current = null;
+			setAnimatedHeight(targetHeight);
+		});
 	}, [active]);
 
 	return (
```

---

### Incident Patch 3: `7561531e` (2026-08-17)
**Commit Message**: fix: useHotkeys multi-key handling with held Meta + global handler audit fixes (#657)

Co-authored-by: Claude <noreply@anthropic.com>

**File**: `.changeset/use-hotkeys-meta-keys.md` (added, +5/-0)
```diff
@@ -0,0 +1,5 @@
+---
+"reshaped": patch
+---
+
+useHotkeys: Fixed hotkeys not triggering when switching between different keys while holding Meta on macOS, since the keyup events for regular keys are not emitted while Meta is pressed. Also fixed the pressed keys tracking for quick key sequences, the `mod` key support in `checkHotkeyState`, duplicate hotkey calls when multiple Reshaped providers are rendered on the same page and hotkeys removal when the same callback is used by multiple components
```

**File**: `packages/reshaped/src/hooks/_internal/useSingletonHotkeys.tsx` (modified, +120/-82)
```diff
@@ -28,7 +28,7 @@ type HotkeyData = {
  * Utilities
  */
 const COMBINATION_DELIMETER = "+";
-let modifiedKeys: string[] = [];
+const MODIFIER_KEYS = ["meta", "control", "alt", "shift"];
 
 const formatHotkey = (hotkey: string) => {
 	if (hotkey === " ") return hotkey;
@@ -44,13 +44,32 @@ const getEventKey = (e: KeyboardEvent) => {
 	if (!e.key) return;
 
 	// Having alt pressed modifies e.key value, so relying on e.code for it
-	if (e.altKey && /^[Key|Digit|Numpad]/.test(e.code)) {
-		return e.code.toLowerCase().replace(/key|digit|numpad/, "");
+	if (e.altKey && /^(Key|Digit|Numpad)/.test(e.code)) {
+		return e.code.toLowerCase().replace(/^(key|digit|numpad)/, "");
 	}
 
 	return e.key.toLowerCase();
 };
 
+/**
+ * Support for `mod` that represents both Mac and Win keyboards
+ * We create the hotkeyId again to sort the mod key correctly
+ */
+const getPressedIds = (pressedId: string) => {
+	const pressedFormattedKeys = pressedId.split(COMBINATION_DELIMETER);
+	const ids = [pressedId];
+
+	if (pressedFormattedKeys.includes("control")) {
+		ids.push(getHotkeyId(pressedId.replace("control", "mod")));
+	}
+
+	if (pressedFormattedKeys.includes("meta")) {
+		ids.push(getHotkeyId(pressedId.replace("meta", "mod")));
+	}
+
+	return ids;
+};
+
 // Removing the unknown gets highlighted an invalid syntax
 // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-constraint
 const walkHotkeys = <T extends unknown>(
@@ -72,82 +91,66 @@ export class HotkeyStore {
 
 	getSize = () => Object.keys(this.hotkeyMap).length;
 
+	hasHandlers = (pressedId: string) => {
+		return getPressedIds(pressedId).some((id) => this.hotkeyMap[id]?.size);
+	};
+
 	bindHotkeys = (
 		hotkeys: Hotkeys,
 		ref: React.RefObject<HTMLElement | null>,
 		options: HotkeyOptions
 	) => {
-		walkHotkeys(hotkeys, (id, hotkeyData) => {
-			if (!hotkeyData) return;
+		const boundData: Array<{ id: string; data: HotkeyData }> = [];
+
+		walkHotkeys(hotkeys, (id, callback) => {
+			if (!callback) return;
+
+			const data = { callback, ref, options };
 
 			if (!this.hotkeyMap[id]) {
 				this.hotkeyMap[id] = new Set();
 			}
 
-			this.hotkeyMap[id].add({ callback: hotkeyData, ref, options });
+			this.hotkeyMap[id].add(data);
+			boundData.push({ id, data });
 		});
-	};
 
-	unbindHotkeys = (hotkeys: Hotkeys) => {
-		walkHotkeys(hotkeys, (id, hotkeyCallback) => {
-			if (!hotkeyCallback) return;
+		return () => {
+			boundData.forEach(({ id, data }) => {
+				this.hotkeyMap[id]?.delete(data);
 
-			this.hotkeyMap[id]?.forEach((data) => {
-				if (data.callback === hotkeyCallback) {
-					this.hotkeyMap[id].delete(data);
+				if (!this.hotkeyMap[id]?.size) {
+					delete this.hotkeyMap[id];
 				}
 			});
-
-			if (!this.hotkeyMap[id]?.size) {
-				delete this.hotkeyMap[id];
-			}
-		});
+		};
 	};
 
 	handleKeyDown = (pressedMap: PressedMap, e: KeyboardEvent) => {
 		const pressedKeys = Object.keys(pressedMap);
 		if (!pressedKeys.length) return;
 
 		const pressedId = getHotkeyId(pressedKeys.join(COMBINATION_DELIMETER));
-		const pressedFormattedKeys = pressedId.split(COMBINATION_DELIMETER);
-
-		const hotkeyData = this.hotkeyMap[pressedId];
-
-		/**
-		 * Support for `mod` that represents both Mac and Win keyboards
-		 * We create the hotkeyId again to sort the mod key correctly
-		 */
-		const controlToModPressedId = getHotkeyId(pressedId.replace("control", "mod"));
-		const metaToModPressedId = getHotkeyId(pressedId.replace("meta", "mod"));
-		const hotkeyControlModData =
-			pressedFormattedKeys.includes("control") && this.hotkeyMap[controlToModPressedId];
-		const hotkeyMetaModData =
-			pressedFormattedKeys.includes("meta") && this.hotkeyMap[metaToModPressedId];
-
-		[hotkeyData, hotkeyControlModData, hotkeyMetaModData].forEach((hotkeyData) => {
-			if (!hotkeyData) return;
-
-			if (hotkeyData?.size) {
-				hotkeyData.forEach((data) => {
-					const eventTarget = e.composedPath()[0] as Node;
-
-					if (
-						data.ref.current &&
-						!(eventTarget === data
```

---

### Incident Patch 4: `b9196293` (2026-08-15)
**Commit Message**: fix: export postcss config subpath with file extension (#654)

Co-authored-by: Claude <noreply@anthropic.com>

**File**: `.changeset/fix-postcss-config-subpath-extension.md` (added, +5/-0)
```diff
@@ -0,0 +1,5 @@
+---
+"reshaped": patch
+---
+
+PostCSS config: Added `reshaped/config/postcss.js` and `reshaped/config/postcss.cjs` to the package exports, so importing the config with a file extension no longer fails with `ERR_PACKAGE_PATH_NOT_EXPORTED`
```

**File**: `packages/reshaped/package.json` (modified, +9/-0)
```diff
@@ -53,6 +53,15 @@
 			"import": "./dist/config/postcss.js",
 			"default": "./dist/config/postcss.cjs"
 		},
+		"./config/postcss.js": {
+			"types": "./dist/config/postcss.d.ts",
+			"import": "./dist/config/postcss.js",
+			"default": "./dist/config/postcss.cjs"
+		},
+		"./config/postcss.cjs": {
+			"types": "./dist/config/postcss.d.cts",
+			"default": "./dist/config/postcss.cjs"
+		},
 		"./bundle": {
 			"types": "./dist/bundle.d.ts",
 			"import": "./dist/bundle.js",
```

---

### Incident Patch 5: `db93fa8d` (2026-07-04)
**Commit Message**: fix(Button): keep group border above highlighted buttons (#651)

Co-authored-by: Claude <noreply@anthropic.com>

**File**: `.changeset/fix-button-group-border-zindex.md` (added, +5/-0)
```diff
@@ -0,0 +1,5 @@
+---
+"reshaped": patch
+---
+
+Button.Group: Fixed the outline group border being masked by a highlighted button when the highlight color is fully opaque, by rendering the group border above highlighted buttons in the stacking context
```

**File**: `packages/reshaped/src/components/Button/Button.module.css` (modified, +4/-2)
```diff
@@ -384,7 +384,9 @@
 			content: "";
 			position: absolute;
 			pointer-events: none;
-			z-index: var(--rs-z-index-relative);
+
+			/* Keep the group border above highlighted buttons so a plain highlight color doesn't mask it */
+			z-index: calc(var(--rs-z-index-relative) + 1);
 			inset: 0;
 			border: 1px solid var(--rs-color-border-neutral);
 			border-radius: 6px;
@@ -396,7 +398,7 @@
 			inset: 1px;
 			pointer-events: none;
 			border-radius: inherit;
-			z-index: var(--rs-z-index-relative);
+			z-index: calc(var(--rs-z-index-relative) + 1);
 		}
 	}
 }
```

**File**: `packages/reshaped/src/components/Button/tests/Button.stories.tsx` (modified, +32/-0)
```diff
@@ -756,6 +756,38 @@ export const group: StoryObj = {
 				</View>
 			</Example.Item>
 
+			<Example.Item title="variant: outline, highlighted">
+				<View gap={2} align="start">
+					{(["neutral", "primary", "critical", "positive"] as const).map((color) => (
+						<Button.Group key={color}>
+							<Button color={color} variant="outline">
+								One
+							</Button>
+							<Button color={color} variant="outline" highlighted>
+								Two
+							</Button>
+							<Button color={color} variant="outline">
+								Three
+							</Button>
+						</Button.Group>
+					))}
+					{/* Plain (opaque) highlight color should not mask the group border – see #649 */}
+					<Button.Group
+						attributes={{
+							style: {
+								["--rs-color-background-neutral-highlighted-faded" as string]: "#d4d4d4",
+							},
+						}}
+					>
+						<Button variant="outline">One</Button>
+						<Button variant="outline" highlighted>
+							Two
+						</Button>
+						<Button variant="outline">Three</Button>
+					</Button.Group>
+				</View>
+			</Example.Item>
+
 			<Example.Item title="variant: ghost">
 				<View gap={2} align="start">
 					{(["neutral", "primary", "critical", "positive"] as const).map((color) => (
```

---

### Incident Patch 6: `8acb35bd` (2026-07-01)
**Commit Message**: fix(theming): prevent reference errors on CJS require call (#645)

**File**: `.changeset/orange-bugs-fold.md` (added, +5/-0)
```diff
@@ -0,0 +1,5 @@
+---
+"@reshaped/theming": patch
+---
+
+Fixed cli/run undefined CJS require call in an ES module context.
```

**File**: `packages/theming/src/cli/run.ts` (modified, +2/-0)
```diff
@@ -1,12 +1,14 @@
 import fs from "node:fs";
 import path from "node:path";
 import process from "node:process";
+import { createRequire } from "node:module";
 import chalk from "chalk";
 import { Command } from "commander";
 
 import defaultConfig from "./reshaped.config";
 import { addTheme, addThemeFragment } from "./index";
 
+const require = createRequire(import.meta.url);
 const program = new Command();
 
 const importJSConfig = (configPath: string) => {
```

---

### Incident Patch 7: `4aaa4911` (2026-06-22)
**Commit Message**: fix(scroll): reference-count locks so stacked locks release correctly (#640)

Co-authored-by: Claude <noreply@anthropic.com>

**File**: `.changeset/fix-lockscroll-refcount.md` (added, +5/-0)
```diff
@@ -0,0 +1,5 @@
+---
+"@reshaped/utilities": patch
+---
+
+lockScroll: Fixed stacked/nested scroll locks releasing the scroll prematurely by reference-counting locks per container
```

**File**: `packages/utilities/src/scroll/lock.ts` (modified, +20/-11)
```diff
@@ -3,33 +3,42 @@ import { isIOS } from "@/platform";
 import lockSafariScroll from "./lockSafari";
 import lockStandardScroll from "./lockStandard";
 
+const locks = new WeakMap<HTMLElement, { count: number; reset: () => void }>();
+
 export const lockScroll = (args?: {
 	containerEl?: HTMLElement | null;
 	originEl?: HTMLElement | null;
 	callback?: () => void;
 }) => {
 	const isIOSLock = isIOS();
-	let reset = () => {};
 
 	const container =
 		args?.containerEl ??
 		(args?.originEl && findClosestScrollableContainer({ el: args.originEl })) ??
 		document.documentElement;
 	const lockedDocumentScroll = container === document.documentElement;
 
-	// Already locked so no need to lock again and trigger the callback
-	if (container.style.overflow === "hidden") return;
-
-	if (isIOSLock && lockedDocumentScroll) {
-		reset = lockSafariScroll();
-	} else {
-		reset = lockStandardScroll({ container });
+	let lock = locks.get(container);
+	if (!lock) {
+		const reset =
+			isIOSLock && lockedDocumentScroll ? lockSafariScroll() : lockStandardScroll({ container });
+		lock = { count: 0, reset };
+		locks.set(container, lock);
 	}
 
+	lock.count++;
 	args?.callback?.();
 
-	return (args?: { callback?: () => void }) => {
-		reset();
-		args?.callback?.();
+	let released = false;
+	return (unlockArgs?: { callback?: () => void }) => {
+		if (released) return;
+		released = true;
+
+		if (--lock.count <= 0) {
+			lock.reset();
+			locks.delete(container);
+		}
+
+		unlockArgs?.callback?.();
 	};
 };
```

**File**: `packages/utilities/src/scroll/tests/lock.test.ts` (modified, +20/-2)
```diff
@@ -124,14 +124,30 @@ describe("scroll/lockScroll", () => {
 		expect(scrollableContainer.style.overflow).toBe("auto");
 	});
 
-	test("unlocks after multiple locks", () => {
+	test("keeps scroll locked until every stacked lock is released", () => {
 		const unlock1 = lockScroll({});
 		const unlock2 = lockScroll({});
 
 		expect(document.documentElement.style.overflow).toBe("hidden");
 
+		// The first release must not unlock while a second lock is still held
 		unlock1?.();
+		expect(document.documentElement.style.overflow).toBe("hidden");
+
+		// Only the last release actually unlocks the container
+		unlock2?.();
 		expect(document.documentElement.style.overflow).toBe("");
+	});
+
+	test("ignores repeated calls to the same unlock", () => {
+		const unlock1 = lockScroll({});
+		const unlock2 = lockScroll({});
+
+		// Calling the first unlock twice must not decrement the count for unlock2
+		unlock1?.();
+		unlock1?.();
+
+		expect(document.documentElement.style.overflow).toBe("hidden");
 
 		unlock2?.();
 		expect(document.documentElement.style.overflow).toBe("");
@@ -171,9 +187,11 @@ describe("scroll/lockScroll", () => {
 	test("calls lock callback immediately", () => {
 		const lockCb = vi.fn();
 
-		lockScroll({ callback: lockCb });
+		const unlock = lockScroll({ callback: lockCb });
 
 		expect(lockCb).toHaveBeenCalledTimes(1);
+
+		unlock?.();
 	});
 
 	test("calls unlock callback when unlocking", () => {
```

---

### Incident Patch 8: `193948ec` (2026-06-22)
**Commit Message**: fix(TrapFocus): trap focus when content is added to an empty container (#638)

Co-authored-by: Claude <noreply@anthropic.com>

**File**: `.changeset/fix-trapfocus-observer-leak.md` (added, +5/-0)
```diff
@@ -0,0 +1,5 @@
+---
+"@reshaped/utilities": patch
+---
+
+TrapFocus: Trapping a container with no focusable content now defers instead of bailing — once focusable content is added (e.g. async-loaded dialog content) the focus is trapped automatically, as long as no other trap was triggered in the meantime. Also fixed the observer leaking in this case
```

**File**: `packages/utilities/src/a11y/TrapFocus.ts` (modified, +84/-47)
```diff
@@ -17,6 +17,12 @@ type TrapOptions = {
 class TrapFocus {
 	static chain = new Chain<TrapFocus>();
 
+	// Monotonic counter bumped on every trap() call. Used by the deferred
+	// observer to tell whether a newer trap was triggered after this one.
+	static #globalTrapCounter = 0;
+
+	#trapCounter = 0;
+
 	#chainId?: number;
 
 	#root: HTMLElement | null = null;
@@ -114,59 +120,35 @@ class TrapFocus {
 		return tailItem && tailItem.data.#root === this.#root;
 	};
 
-	/**
-	 * Trap the focus, add observer and keyboard event listeners
-	 * and create a chain item
-	 */
-	trap = (root: HTMLElement, options: TrapOptions = {}) => {
-		const { mode = "dialog", includeTrigger, initialFocusEl } = options;
-
-		this.#root = root;
-		this.#screenReaderTrap = new TrapScreenReader(root);
-
-		const trigger = getActiveElement(this.#root);
-		const focusable = getFocusableElements(this.#root, {
-			additionalElement: includeTrigger ? trigger : undefined,
+	#getFocusable = () => {
+		if (!this.#root) return [];
+		return getFocusableElements(this.#root, {
+			additionalElement: this.#options.includeTrigger ? this.#trigger : undefined,
 		});
-		const pseudoFocus = mode === "selection-menu";
-
-		this.#options = { ...options, pseudoFocus };
-		this.#trigger = trigger;
-
-		this.#mutationObserver = new MutationObserver(() => {
-			if (!this.#root) return;
-			if (!this.#isLast()) return;
-
-			const currentActiveElement = getActiveElement(this.#root);
-
-			// Focus stayed inside the wrapper, no need to refocus
-			if (this.#root.contains(currentActiveElement)) return;
-
-			const focusable = getFocusableElements(this.#root, {
-				additionalElement: includeTrigger ? trigger : undefined,
-			});
+	};
 
-			if (!focusable.length) return;
-			focusElement(focusable[0], { pseudoFocus });
-		});
+	/**
+	 * Establish the trap once there is something focusable inside.
+	 * Stays a no-op while the container is empty, so an empty container remains
+	 * deferred until its observer detects focusable content being added.
+	 */
+	#activate = () => {
+		if (!this.#root || this.trapped) return;
 
-		this.#removeListeners();
-		this.#mutationObserver.observe(this.#root, { childList: true, subtree: true });
+		const { mode, initialFocusEl, pseudoFocus } = this.#options;
+		const focusable = this.#getFocusable();
 
-		// Don't trap in case there is nothing to focus inside
+		// Nothing to focus yet — stay deferred.
 		if (!focusable.length && !initialFocusEl) return;
 
 		this.#addListeners();
-		if (mode === "dialog") this.#screenReaderTrap.trap();
-
-		const currentActiveElement = getActiveElement(this.#root);
-		const isLastInChain = this.#isLast();
+		if (mode === "dialog") this.#screenReaderTrap?.trap();
 
 		// Don't add back to the chain if we're traversing back
-		if (!isLastInChain) {
+		if (!this.#isLast()) {
 			this.#chainId = TrapFocus.chain.add(this);
 
-			const focusInside = this.#root.contains(currentActiveElement);
+			const focusInside = this.#root.contains(getActiveElement(this.#root));
 
 			if (initialFocusEl) {
 				focusElement(initialFocusEl, { pseudoFocus });
@@ -179,20 +161,73 @@ class TrapFocus {
 		this.trapped = true;
 	};
 
+	/**
+	 * Trap the focus, add observer and keyboard event listeners
+	 * and create a chain item
+	 */
+	trap = (root: HTMLElement, options: TrapOptions = {}) => {
+		const { mode = "dialog" } = options;
+		const pseudoFocus = mode === "selection-menu";
+
+		this.#root = root;
+		this.#screenReaderTrap = new TrapScreenReader(root);
+		this.#trigger = getActiveElement(root);
+		this.#options = { ...options, mode, pseudoFocus };
+		this.#trapCounter = ++TrapFocus.#globalTrapCounter;
+
+		this.#removeListeners();
+		this.#mutationObserver?.disconnect();
+
+		this.#mutationObserver = new MutationObserver(() => {
+			if (!this.#root) return;
+
+			// Still deferred: trap once focusable content is added (e.g. async-loaded
+			// dialog content), as long as no newer trap was triggered in the meantime.
+			if (!this.t
```

**File**: `packages/utilities/src/a11y/tests/TrapFocus.test.ts` (modified, +69/-0)
```diff
@@ -59,6 +59,75 @@ describe("a11y/TrapFocus", () => {
 			expect(trap.trapped).toBeUndefined();
 		});
 
+		test("traps focus once focusable content is added to an empty container", async () => {
+			container.innerHTML = `<div>No focusable content yet</div>`;
+
+			const trap = new TrapFocus();
+			trap.trap(container);
+			expect(trap.trapped).toBeUndefined();
+
+			const btn = document.createElement("button");
+			btn.id = "late";
+			btn.textContent = "Late";
+			container.appendChild(btn);
+
+			// Wait for the MutationObserver callback to run
+			await new Promise((resolve) => setTimeout(resolve, 0));
+
+			expect(trap.trapped).toBe(true);
+			expect(document.activeElement?.id).toBe("late");
+
+			trap.release();
+		});
+
+		test("does not trap added content if another trap was triggered after", async () => {
+			container.innerHTML = `<div>No focusable content yet</div>`;
+
+			const deferredTrap = new TrapFocus();
+			deferredTrap.trap(container);
+			expect(deferredTrap.trapped).toBeUndefined();
+
+			// A newer trap is triggered before the empty container gets content
+			const other = document.createElement("div");
+			other.innerHTML = `<button id="other-btn">Other</button>`;
+			document.body.appendChild(other);
+			const otherTrap = new TrapFocus();
+			otherTrap.trap(other);
+
+			// Now the originally-empty container receives focusable content
+			const btn = document.createElement("button");
+			btn.id = "late";
+			btn.textContent = "Late";
+			container.appendChild(btn);
+
+			await new Promise((resolve) => setTimeout(resolve, 0));
+
+			// The deferred trap must stay inactive and must not steal focus
+			expect(deferredTrap.trapped).toBeUndefined();
+			expect(document.activeElement?.id).not.toBe("late");
+
+			otherTrap.release();
+			document.body.removeChild(other);
+		});
+
+		test("releasing an empty container stops it from trapping later", async () => {
+			container.innerHTML = `<div>No focusable content yet</div>`;
+
+			const trap = new TrapFocus();
+			trap.trap(container);
+			trap.release();
+
+			const btn = document.createElement("button");
+			btn.id = "late";
+			btn.textContent = "Late";
+			container.appendChild(btn);
+
+			await new Promise((resolve) => setTimeout(resolve, 0));
+
+			expect(trap.trapped).toBeUndefined();
+			expect(document.activeElement?.id).not.toBe("late");
+		});
+
 		test("focuses initialFocusEl when provided", () => {
 			container.innerHTML = `
 				<button id="btn1">Button 1</button>
```

---

### Incident Patch 9: `64b1574c` (2026-06-20)
**Commit Message**: fix(scroll): scope StyleCache.reset to the locked element (#641)

Co-authored-by: Claude <noreply@anthropic.com>

**File**: `.changeset/fix-stylecache-scoped-reset.md` (added, +5/-0)
```diff
@@ -0,0 +1,5 @@
+---
+"@reshaped/utilities": patch
+---
+
+StyleCache: `reset()` used to restore and clear the entire cache, which let one scroll lock wipe the saved styles of another still-active lock. It now takes a required element and restores only that one. `set()` is also a no-op when the element is already cached, so locking an already-locked element keeps its original styles intact.
```

**File**: `packages/utilities/src/css/StyleCache.ts` (modified, +11/-9)
```diff
@@ -1,26 +1,28 @@
 type Styles = Record<string, string>;
 
 class StyleCache {
-	cache: Map<HTMLElement, Record<string, string>> = new Map();
+	cache: Map<HTMLElement, Styles> = new Map();
 
 	set = (el: HTMLElement, styles: Styles) => {
-		const originalStyles: Styles = {};
-		const cachedStyles = this.cache.get(el);
+		// Already cached (locked) — keep the originals captured the first time and
+		// don't reapply, so locking an element that's already locked is a no-op.
+		if (this.cache.has(el)) return;
 
+		const originalStyles: Styles = {};
 		Object.keys(styles).forEach((key) => {
 			originalStyles[key] = el.style.getPropertyValue(key);
 		});
 
-		this.cache.set(el, { ...originalStyles, ...cachedStyles });
+		this.cache.set(el, originalStyles);
 		Object.assign(el.style, styles);
 	};
 
-	reset = () => {
-		for (const [el, styles] of this.cache.entries()) {
-			Object.assign(el.style, styles);
-		}
+	reset = (el: HTMLElement) => {
+		const styles = this.cache.get(el);
+		if (!styles) return;
 
-		this.cache.clear();
+		Object.assign(el.style, styles);
+		this.cache.delete(el);
 	};
 }
 
```

**File**: `packages/utilities/src/css/tests/StyleCache.test.ts` (modified, +27/-7)
```diff
@@ -19,43 +19,63 @@ describe("css/StyleCache", () => {
 		expect(el.style.color).toBe("blue");
 		expect(el.style.overflow).toBe("hidden");
 
-		styleCache.reset();
+		styleCache.reset(el);
 
 		expect(el.style.color).toBe("red");
 		expect(el.style.overflow).toBe("visible");
 	});
 
-	test("preserves original styles across multiple set calls", () => {
+	test("ignores repeated set calls on an already-cached element", () => {
 		const el = document.createElement("div");
 		el.style.color = "red";
 
 		styleCache.set(el, { color: "blue" });
+		// The element is already cached, so this is a no-op (style stays "blue")
 		styleCache.set(el, { color: "green" });
-		styleCache.reset();
+
+		expect(el.style.color).toBe("blue");
+
+		styleCache.reset(el);
 
 		expect(el.style.color).toBe("red");
 	});
 
-	test("handles multiple elements", () => {
+	test("reset only affects the given element", () => {
 		const el1 = document.createElement("div");
 		const el2 = document.createElement("div");
 		el1.style.color = "red";
 		el2.style.color = "blue";
 
 		styleCache.set(el1, { color: "green" });
 		styleCache.set(el2, { color: "yellow" });
-		styleCache.reset();
 
+		styleCache.reset(el1);
+
+		// el1 is restored, el2 stays locked
 		expect(el1.style.color).toBe("red");
+		expect(el2.style.color).toBe("yellow");
+		expect(styleCache.cache.has(el2)).toBe(true);
+
+		styleCache.reset(el2);
+
 		expect(el2.style.color).toBe("blue");
 	});
 
-	test("clears cache after reset", () => {
+	test("reset is a no-op for an element that was never cached", () => {
+		const el = document.createElement("div");
+		el.style.color = "red";
+
+		styleCache.reset(el);
+
+		expect(el.style.color).toBe("red");
+	});
+
+	test("removes the element from the cache after reset", () => {
 		const el = document.createElement("div");
 		el.style.color = "red";
 
 		styleCache.set(el, { color: "blue" });
-		styleCache.reset();
+		styleCache.reset(el);
 
 		expect(styleCache.cache.size).toBe(0);
 	});
```

**File**: `packages/utilities/src/scroll/lockSafari.ts` (modified, +1/-1)
```diff
@@ -17,7 +17,7 @@ const lockSafariScroll = () => {
 	});
 
 	return () => {
-		styleCache.reset();
+		styleCache.reset(document.body);
 		window.scrollTo({ top: scrollY, left: scrollX, behavior: "instant" });
 	};
 };
```

**File**: `packages/utilities/src/scroll/lockStandard.ts` (modified, +6/-6)
```diff
@@ -6,19 +6,19 @@ const styleCache = new StyleCache();
 const lockStandardScroll = (args: { container: HTMLElement }) => {
 	const { container } = args;
 	const isOverflowing = container.scrollHeight > container.clientHeight;
-
-	styleCache.set(container, { overflow: "hidden" });
+	const styles: Record<string, string> = { overflow: "hidden" };
 
 	if (isOverflowing) {
 		if (CSS.supports("scrollbar-gutter", "stable")) {
-			styleCache.set(container, { scrollbarGutter: "stable" });
+			styles.scrollbarGutter = "stable";
 		} else {
-			const scrollBarWidth = getScrollbarWidth();
-			styleCache.set(container, { paddingRight: `${scrollBarWidth}px` });
+			styles.paddingRight = `${getScrollbarWidth()}px`;
 		}
 	}
 
-	return () => styleCache.reset();
+	styleCache.set(container, styles);
+
+	return () => styleCache.reset(container);
 };
 
 export default lockStandardScroll;
```

---

### Incident Patch 10: `0b671182` (2026-06-20)
**Commit Message**: fix(scroll): detect container overflow correctly when locking scroll (#639)

Co-authored-by: Claude <noreply@anthropic.com>

**File**: `.changeset/fix-lockstandard-scrollbar.md` (added, +5/-0)
```diff
@@ -0,0 +1,5 @@
+---
+"@reshaped/utilities": patch
+---
+
+lockScroll: Fixed scrollbar-width compensation not being applied when locking a scrollable container, which caused a layout shift
```

**File**: `packages/utilities/src/scroll/lockStandard.ts` (modified, +1/-2)
```diff
@@ -5,8 +5,7 @@ const styleCache = new StyleCache();
 
 const lockStandardScroll = (args: { container: HTMLElement }) => {
 	const { container } = args;
-	const rect = container.getBoundingClientRect();
-	const isOverflowing = rect.left + rect.right < window.innerWidth;
+	const isOverflowing = container.scrollHeight > container.clientHeight;
 
 	styleCache.set(container, { overflow: "hidden" });
 
```

**File**: `packages/utilities/src/scroll/tests/lock.test.ts` (modified, +51/-0)
```diff
@@ -50,6 +50,57 @@ describe("scroll/lockScroll", () => {
 		expect(container.style.overflow).toBe("auto");
 	});
 
+	test("reserves space for the scrollbar on a vertically overflowing container", () => {
+		const container = document.createElement("div");
+		container.style.overflow = "auto";
+		container.style.height = "100px";
+		document.body.appendChild(container);
+
+		const content = document.createElement("div");
+		content.style.height = "500px";
+		container.appendChild(content);
+
+		// The container actually overflows vertically, so locking it removes the
+		// vertical scrollbar and must compensate for the horizontal space it took.
+		expect(container.scrollHeight).toBeGreaterThan(container.clientHeight);
+
+		const unlock = lockScroll({ containerEl: container });
+
+		// Chromium (the test browser) supports scrollbar-gutter, so the lock
+		// reserves the gutter rather than falling back to paddingRight.
+		expect(container.style.scrollbarGutter).toBe("stable");
+
+		unlock?.();
+
+		expect(container.style.scrollbarGutter).toBe("");
+
+		document.body.removeChild(container);
+	});
+
+	test("does not reserve space when the container does not overflow vertically", () => {
+		const container = document.createElement("div");
+		container.style.overflow = "auto";
+		container.style.height = "200px";
+		document.body.appendChild(container);
+
+		const content = document.createElement("div");
+		content.style.height = "50px";
+		container.appendChild(content);
+
+		// No vertical overflow -> no scrollbar to compensate for.
+		expect(container.scrollHeight).not.toBeGreaterThan(container.clientHeight);
+
+		const unlock = lockScroll({ containerEl: container });
+
+		expect(container.style.overflow).toBe("hidden");
+		expect(container.style.scrollbarGutter).toBe("");
+		expect(container.style.paddingRight).toBe("");
+
+		unlock?.();
+
+		document.body.removeChild(container);
+	});
+
 	test("finds scrollable container from origin element", () => {
 		const scrollableContainer = document.createElement("div");
 		scrollableContainer.style.overflow = "auto";
```

#### Recent Merged Pull Requests:
- **PR #670** (2026-09-12): Modal: velocity-aware release spring and rubber band for the swipe gesture (@blvdmitry)
- **PR #669** (2026-09-12): Modal: register the drag offset as a non-inherited property (@blvdmitry)
- **PR #668** (2026-09-12): ScrollArea: move the thumb with transform instead of inset (@blvdmitry)
- **PR #667** (2026-09-12): Overlay: animate backdrop opacity instead of background-color (@blvdmitry)
- **PR #666** (2026-09-07): Image: render the fallback when loading fails before hydration (@blvdmitry)
- **PR #665** (closed): DropdownMenu, ContextMenu: support size on the root component (@blvdmitry)
- **PR #664** (closed): fix(Flyout): close content on right click outside (@blvdmitry)
- **PR #663** (closed): feat(Link): add fullWidth support (@blvdmitry)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
