# Forensic Learning Record (Deep Inspection): dockview/dockview

> **Canonical Artifact**: `07_PROJECT_LEARNING/dockview-dockview-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/dockview/dockview](https://github.com/dockview/dockview))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-09-30T18:24:07.988Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `dockview/dockview`
- **Description**: Zero dependency docking layout manager supporting tabs, groups, grids and splitviews. Supports React, Vue, Angular, and vanilla TypeScript.
- **Primary Language / Ecosystem**: TypeScript
- **Discovered Manifests / Configurations**: package.json, README.md
- **Stars / Engagement**: 3453 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: package.json, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `jest-setup.ts`
```
import '@testing-library/jest-dom';
import { PointerDragController } from './packages/dockview-core/src/dnd/pointer/pointerDragController';

// `PointerDragController` is a module-level singleton — state leaks across
// test files unless explicitly reset. Tests that drive a pointer drag end
// to end already call `cancel()` in their own beforeEach, but a global
// afterEach makes the cleanup automatic so newly-added tests can't
// accidentally inherit a half-finished drag.
afterEach(() => {
    PointerDragController.getInstance().cancel();
});

```

### Core Architecture Module: `jest.config.ts`
```
import type { Config } from 'jest';

const config: Config = {
    displayName: { name: 'root', color: 'blue' },
    projects: ['<rootDir>/packages/*/jest.config.ts'],
    collectCoverage: false, // Only collect when explicitly requested
    collectCoverageFrom: ['<rootDir>/packages/*/src/**/*.{js,jsx,ts,tsx}'],
    coveragePathIgnorePatterns: [
        '/node_modules/',
        '<rootDir>/packages/*/src/__tests__/',
    ],
    coverageDirectory: 'coverage',
    testResultsProcessor: 'jest-sonar-reporter',
    maxWorkers: '50%', // Limit worker processes to prevent resource exhaustion
    cacheDirectory: '<rootDir>/node_modules/.cache/jest',
};

export default config;

```

### Core Architecture Module: `packages/dockview-angular/jest.config.ts`
```
import type { Config } from 'jest';

const config: Config = {
    preset: 'jest-preset-angular',
    roots: ['<rootDir>/packages/dockview-angular'],
    modulePaths: ['<rootDir>/packages/dockview-angular/src'],
    displayName: { name: 'dockview-angular', color: 'blue' },
    rootDir: '../../',
    collectCoverageFrom: [
        '<rootDir>/packages/dockview-angular/src/**/*.{js,jsx,ts,tsx}',
        '!<rootDir>/packages/dockview-angular/src/**/__tests__/**',
        '!<rootDir>/packages/dockview-angular/src/**/index.ts',
        '!<rootDir>/packages/dockview-angular/src/public-api.ts',
    ],
    setupFilesAfterEnv: [
        '<rootDir>/packages/dockview-angular/src/__tests__/setup-jest.ts',
    ],
    // Report coverage only for this package. The Angular preset instruments
    // TypeScript differently from the @swc/jest projects, so when this project
    // also reported the `dockview-core` sources it maps in, merging the two
    // instrumentations of the same file produced garbage counters - branches
    // taken hundreds of times came out as never taken.
    coveragePathIgnorePatterns: [
        '/node_modules/',
        '<rootDir>/packages/(?!dockview-angular/)[^/]+/src/',
    ],
    moduleNameMapper: {
        '^dockview$': '<rootDir>/packages/dockview/src/index.ts',
        '^dockview-core$': '<rootDir>/packages/dockview-core/src/index.ts',
        '^dockview-enterprise$':
            '<rootDir>/packages/dockview-enterprise/src/index.ts',
    },
    modulePathIgnorePatterns: [
        '<rootDir>/packages/dockview-angular/src/__tests__/__mocks__',
        '<rootDir>/packages/dockview-angular/src/__tests__/__test_utils__',
    ],
    coverageDirectory: '<rootDir>/packages/dockview-angular/coverage/',
    // testResultsProcessor inherited from root config
    testEnvironment: 'jsdom',
    testMatch: [
        '<rootDir>/packages/dockview-angular/src/**/*.spec.ts',
        '<rootDir>/packages/dockview-angular/src/**/*.test.ts',
    ],
    transformIgnorePatterns: ['node_modules/(?!(.*\\.mjs$|@angular|rxjs))'],
    transform: {
        '^.+\\.(ts|mjs|js|html)$': [
            'jest-preset-angular',
            {
                tsconfig: '<rootDir>/tsconfig.spec.json',
                stringifyContentPathRegex: '\\.(html|svg)$',
            },
        ],
    },
};

export default config;

```

### Core Architecture Module: `packages/dockview-angular/scripts/copy-css.js`
```
const fs = require('fs');
const path = require('path');

const sourceCssDir = path.resolve(__dirname, '../../dockview-core/dist/styles');
// Match the other framework packages (dockview-react / dockview-vue) and the
// documented import path: styles live under `dist/styles`, not the dist root.
const targetDir = path.resolve(__dirname, '../dist/styles');

if (!fs.existsSync(targetDir)) {
    fs.mkdirSync(targetDir, { recursive: true });
}

// Copy CSS files from dockview-core styles directory
if (fs.existsSync(sourceCssDir)) {
    const files = fs.readdirSync(sourceCssDir);
    
    files.forEach(file => {
        if (file.endsWith('.css')) {
            const sourcePath = path.join(sourceCssDir, file);
            const targetPath = path.join(targetDir, file);
            fs.copyFileSync(sourcePath, targetPath);
            console.log(`Copied ${file} to dist/styles/`);
        }
    });
} else {
    console.warn('dockview-core styles directory not found. Make sure to build dockview-core first.');
}
```

### Core Architecture Module: `packages/dockview-angular/src/index.ts`
```
export * from './public-api';

```

### Core Architecture Module: `packages/dockview-angular/src/lib/dockview-angular.module.ts`
```
import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';

import { DockviewAngularComponent } from './dockview/dockview-angular.component';
import { GridviewAngularComponent } from './gridview/gridview-angular.component';
import { PaneviewAngularComponent } from './paneview/paneview-angular.component';
import { SplitviewAngularComponent } from './splitview/splitview-angular.component';

@NgModule({
    imports: [
        CommonModule,
        DockviewAngularComponent,
        GridviewAngularComponent,
        PaneviewAngularComponent,
        SplitviewAngularComponent,
    ],
    exports: [
        DockviewAngularComponent,
        GridviewAngularComponent,
        PaneviewAngularComponent,
        SplitviewAngularComponent,
    ],
})
export class DockviewAngularModule {}

```

### Core Architecture Module: `packages/dockview-angular/src/lib/dockview/angular-group-drag-ghost-renderer.ts`
```
import {
    Type,
    Injector,
    EnvironmentInjector,
    ApplicationRef,
    ComponentRef,
    EmbeddedViewRef,
    createComponent,
} from '@angular/core';
import {
    IGroupDragGhostRenderer,
    IDockviewGroupPanel,
    DockviewApi,
} from 'dockview';

export interface IDockviewAngularGroupDragGhostProps {
    group: IDockviewGroupPanel;
    api: DockviewApi;
}

export class AngularGroupDragGhostRenderer implements IGroupDragGhostRenderer {
    private readonly _element: HTMLElement;
    private componentRef: ComponentRef<any> | null = null;
    private readonly appRef: ApplicationRef;

    get element(): HTMLElement {
        return this._element;
    }

    constructor(
        private readonly component: Type<any>,
        private readonly injector: Injector,
        private readonly environmentInjector?: EnvironmentInjector
    ) {
        this._element = document.createElement('div');
        this._element.className = 'dv-angular-part';
        this._element.style.display = 'inline-flex';
        this.appRef = injector.get(ApplicationRef);
    }

    init(params: { group: IDockviewGroupPanel; api: DockviewApi }): void {
        this.componentRef = createComponent(this.component, {
            environmentInjector:
                this.environmentInjector ||
                (this.injector as EnvironmentInjector),
            elementInjector: this.injector,
        });

        const instance = this.componentRef.instance as Record<string, unknown>;
        instance['group'] = params.group;
        instance['api'] = params.api;

        const hostView = this.componentRef.hostView as EmbeddedViewRef<any>;
        const rootNode = hostView.rootNodes[0] as HTMLElement;
        this._element.appendChild(rootNode);

        this.appRef.attachView(hostView);
        this.componentRef.changeDetectorRef.markForCheck();
    }

    dispose(): void {
        if (this.componentRef) {
            this.appRef.detachView(this.componentRef.hostView);
            this.componentRef.destroy();
            this.componentRef = null;
        }
    }
}

```

### Core Architecture Module: `packages/dockview-angular/src/lib/dockview/angular-header-actions-renderer.ts`
```
import {
    Type,
    Injector,
    EnvironmentInjector,
    ApplicationRef,
    ComponentRef,
    EmbeddedViewRef,
    TemplateRef,
    createComponent,
} from '@angular/core';
import {
    DockviewApi,
    DockviewCompositeDisposable,
    DockviewGroupLocation,
    DockviewGroupPanel,
    DockviewGroupPanelApi,
    IDockviewHeaderActionsProps,
    IDockviewPanel,
    IHeaderActionsRenderer,
} from 'dockview';

/**
 * Angular implementation of a header-actions renderer. Mirrors the React
 * `ReactHeaderActionsRendererPart`: dockview-core only provides `api`,
 * `containerApi`, and `group` at init time, so this renderer augments the
 * component instance with the rest of `IDockviewHeaderActionsProps`
 * (`panels`, `activePanel`, `isGroupActive`, `headerPosition`, `location`)
 * and subscribes to the relevant events to keep them up to date.
 */
export class AngularHeaderActionsRenderer implements IHeaderActionsRenderer {
    private readonly _element: HTMLElement;
    private componentRef: ComponentRef<unknown> | null = null;
    private viewRef: EmbeddedViewRef<unknown> | null = null;
    private readonly appRef: ApplicationRef;
    private subscriptions: DockviewCompositeDisposable | null = null;

    get element(): HTMLElement {
        return this._element;
    }

    constructor(
        private readonly component: Type<unknown> | TemplateRef<unknown>,
        private readonly group: DockviewGroupPanel,
        private readonly injector: Injector,
        private readonly environmentInjector?: EnvironmentInjector
    ) {
        this._element = document.createElement('div');
        this._element.className = 'dv-angular-part';
        this._element.style.height = '100%';
        this._element.style.width = '100%';
        this.appRef = injector.get(ApplicationRef);
    }

    init(parameters: {
        containerApi: DockviewApi;
        api: DockviewGroupPanelApi;
    }): void {
        if (this.component instanceof TemplateRef) {
            // TemplateRef-based header actions cannot receive @Input()s;
            // render the template once and leave it static.
            this.viewRef = this.component.createEmbeddedView({}, this.injector);
            this._element.appendChild(this.viewRef.rootNodes[0] as HTMLElement);
            this.appRef.attachView(this.viewRef);
            this.viewRef.markForCheck();
            return;
        }

        this.componentRef = createComponent(this.component, {
            environmentInjector:
                this.environmentInjector ||
                (this.injector as EnvironmentInjector),
            elementInjector: this.injector,
        });

        const initialProps: IDockviewHeaderActionsProps = {
            api: parameters.api,
            containerApi: parameters.containerApi,
            panels: this.group.model.panels,
            activePanel: this.group.model.activePanel,
            isGroupActive: this.group.api.isActive,
            group: this.group,
            headerPosition: this.group.model.headerPosition,
            location: parameters.api.location,
        };
        this.assign(initialProps);

        const hostView = this.componentRef.hostView as EmbeddedViewRef<unknown>;
        const rootNode = hostView.rootNodes[0] as HTMLElement;
        this._element.appendChild(rootNode);
        this.appRef.attachView(hostView);
        this.componentRef.changeDetectorRef.markForCheck();

        this.subscriptions = new DockviewCompositeDisposable(
            this.group.model.onDidAddPanel(() => {
                this.assign({ panels: this.group.model.panels });
            }),
            this.group.model.onDidRemovePanel(() => {
                this.assign({ panels: this.group.model.panels });
            }),
            this.group.model.onDidActivePanelChange(() => {
                this.assign({
                    activePanel: this.group.model.activePanel as
                        | IDockviewPanel
                        | undefined,
                });
            }),
            parameters.api.onDidActiveChange(() => {
                this.assign({ isGroupActive: this.group.api.isActive });
            }),
            parameters.api.onDidLocationChange((event) => {
                this.assign({
                    location: event.location as DockviewGroupLocation,
                });
            })
        );
    }

    dispose(): void {
        this.subscriptions?.dispose();
        this.subscriptions = null;
        if (this.componentRef) {
            this.appRef.detachView(this.componentRef.hostView);
            this.componentRef.destroy();
            this.componentRef = null;
        }
        if (this.viewRef) {
            this.appRef.detachView(this.viewRef);
            this.viewRef.destroy();
            this.viewRef = null;
        }
    }

    private assign(partial: Partial<IDockviewHeaderActionsProps>): void {
        if (!this.componentRef) {
            return;
        }
        const instance = this.componentRef.instance as Record<string, unknown>;
        for (const key of Object.keys(partial) as Array<
            keyof IDockviewHeaderActionsProps
        >) {
            instance[key] = partial[key];
        }
        this.componentRef.changeDetectorRef.markForCheck();
    }
}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #1649** (2026-09-24): **Context menu not working inside shadow dom**
  *Symptoms*: **Dockview version** 8.3.1  **Framework** Vanilla (dockview wrapped in Lit component using shadow dom)  **Browser** Latest Chrome  **Describe the bug** Clicking on a context menu item does not invoke the respective action. The item does not show a :hover style BUT in the tabs context menu, when you hover you do see the "tab close" button.  The same setup works outside of a shadow dom.  **Reproduction** Open a context menu and try and click on an item.  Claude suggests this line is problematic: https://github.com/dockview/dockview/blob/master/packages/dockview-core/src/dismissableLayer.ts#L90, it's suggestion of needing `event.composedPath[0]` instead of `event.target` makes sense to me as `event.target` will be the root element.  
  **Post-Mortem & Fix Analysis**:
  > FYI - confirmed the fix via a patch-package.

- **Issue #1640** (2026-09-24): **smooth tabAnimation mode does not apply to vertical tabbed edge groups**
  *Symptoms*: **Dockview version** 8.3.1  **Framework** Vanilla JS  **Browser** Chrome 152.0.7977.84  **Describe the bug** Edge groups using vertical tab orientation do not have smooth tab reordering animation applied to them.  **Reproduction** Use the [edge group example](https://dockview.dev/templates/dockview/edge-groups/typescript/index.html) and enter into JS console:  ```js const dv = await System.import("dockview"); dv.themeAbyss.tabAnimation = "smooth"; dv.themeLight.tabAnimation = "smooth"; ```  **Expected behavior** All tab groups use smooth animation when resizing  

- **Issue #1614** (2026-08-28): **Resizing an edge group with `setSize()` silently does nothing**
  *Symptoms*: **Dockview version**  8.2.0.  **Framework**  Vanilla JS (`dockview`).  **Browser**  Chromium 148, headless, 1200x800.  **Describe the bug**  Calling `setSize()` on an edge group's api returns without error and changes nothing, while the same call on a grid group's api resizes it. Nothing else exposes an edge group's size, so a rail is stuck at its `initialSize` for the life of the dock.  **Reproduction**  Vite project, two files. The `package.json`:  ```json {   "private": true,   "type": "module",   "scripts": { "dev": "vite" },   "dependencies": { "dockview": "8.2.0" },   "devDependencies": { "vite": "^7.0.0" } } ```  The `index.html`:  ```html <!doctype html> <html>   <body style="margin: 0">     <div id="app" style="height: 600px"></div>     <script type="module">       import { createDockview, themeLight } from 'dockview';       import 'dockview/dist/styles/dockview.css';        const container = document.getElementById('app');       const api = createDockview(container, {         theme: themeLight,         createComponent: () => ({           element: document.createElement('div'),           init: () => {},         }),       });        // `initialSize` is measured against the splitview's available space, so       // lay the dock out first.       api.layout(container.clientWidth, container.clientHeight);        api.addEdgeGroup('left', { id: 'left-edge', initialSize: 260 });       api.addPanel({ id: 'main', component: 'default' });       api.addPanel({         id: 'other'
  **Post-Mortem & Fix Analysis**:
  > Duplicate of #1613, which was filed first and reports the same thing. Closing this; I will move what is not already there onto that issue.

- **Issue #1613** (2026-09-02): **setSize() on an edge group's api does nothing**
  *Symptoms*: **dockview-core 8.0.0**  `setSize()` on an edge group's api does nothing. No error, no warning, it just returns and the rail keeps its width. The same call on a grid group's api resizes it.  I ran into this while trying to re-apply a width after the initial layout, and ended up laying the grid out *before* creating the rail instead, because I couldn't find any other way to set the size once the group exists. The sash is the only thing that moves it.  ```js import { createDockview } from 'dockview-core';  const api = createDockview(document.getElementById('root'), {   createComponent: (o) => ({     element: Object.assign(document.createElement('div'), { textContent: o.id }),     init: () => {},   }), });  api.layout(1200, 600);  // Two grid groups, otherwise there's nothing to redistribute between and the // grid call looks inert too. api.addPanel({ id: 'main', component: 'default' }); api.addPanel({ id: 'other', component: 'default',   position: { referencePanel: 'main', direction: 'right' } });  api.addEdgeGroup('left', { id: 'left-edge', initialSize: 260 }); api.addPanel({ id: 'side', component: 'default',   position: { referenceGroup: 'left-edge' } });  api.groups.find((g) => g.api.location.type === 'grid')   .api.setSize({ width: 300 });                  // moves it: 437 -> 295 api.getEdgeGroup('left').setSize({ width: 420 }); // rail stays at 255 ```  `setSize(420)`, `setSize({ width: 420 })`, `setSize({ size: 420 })` and `setSize({ width: 420, height: 600 })` all behave

- **Issue #1612** (2026-09-09): **Dropped panel does not land in the zone the drop overlay indicated**
  *Symptoms*: # Dropped panel does not land in the zone the drop overlay indicated  ## Summary  During a panel drag, the drop overlay and the actual drop decision disagree about zone boundaries. The overlay highlights one placement; releasing performs a different one. Observed on v7.0.4 and still present on v8.2.0. Our application overrides no drop-target CSS, and the same behaviour reproduces with real pointer events (Playwright-generated pointermove/pointerdown), so this does not appear to be styling- or synthetic-event-related.  ## Cases observed  **1. Middle of the layout lands at the far right (v8.2.0).** Dropping a panel in the middle third of the layout can place it in a narrow new group occupying roughly the rightmost tenth of the width, nowhere near the highlighted zone.  **2. Top-edge of a group: overlay says "tab", drop splits above.** Dragging a tab to just below a group's tab strip (measured at `y = group.y + 60` on a 705x403 group): the overlay highlights the whole group, i.e. "add as a tab here", but the drop creates a new group above the target. Measured with the drop-anchor animation disabled (anchor snapped), so it is not a mid-animation release artefact: every other point in a sweep of that group (left, right, bottom, centre, 25%, 75%, lower-right corner) agrees between overlay and drop; the top edge does not.  **3. Highlight resolves to a different group entirely.** With four groups, aiming at the top quadrant of one group: the highlight resolved to the group above the 
  **Post-Mortem & Fix Analysis**:
  > I can reproduce point 2. Do you have screen recordings of 1 and 3 so I can understand the problem better?
  > https://github.com/user-attachments/assets/92be8af3-a808-4455-ad22-5f839c6a8a97  Hopefully this is clear enough, if not please do let me know
  > these should now be addressed in v8.3.0.

- **Issue #1610** (2026-09-04): **`ContextMenuModule` not available (regression in 8.0.0)**
  *Symptoms*: **Dockview version** 8.0.0  **Framework** Vue 3.5.41  **Browser** Electron 43.4.0's bundled Chromium  **Describe the bug** Upgrading from `dockview-vue` 7.0.4 to 8.0.0 removes the previously free tab context-menu implementation. An application that continues to provide `getTabContextMenuItems` now logs this error at startup:  > `dockview`: `getTabContextMenuItems` requires the `ContextMenu` module, which ships in `dockview-enterprise`. > `npm install dockview-enterprise` > `import 'dockview-enterprise'; // self-registers every enterprise module`  The application does not crash, but right-clicking a tab no longer opens the configured context menu.  This conflicts with the [Dockview Enterprise announcement](https://dockview.dev/blog/dockview-enterprise/), which says:  > Nothing you rely on today has been taken away. If a feature was free in Dockview, it stays free.  `getTabContextMenuItems` was already a free Dockview feature. Dockview's [v6 release notes](https://dockview.dev/docs/releases/whats-new/whats-new-v6/#tab-context-menu) document its introduction, and Dockview 7.0.4 registered `ContextMenuModule` from the MIT-licensed `dockview-modules` bundle.  The regression was introduced by #1393, which removed `registerModules(Modules)` from the free `dockview` entry point and moved `ContextMenuModule` into the commercially licensed package.  **Reproduction** 1. Install `dockview-vue@7.0.4` in a Vue 3 application. 2. Render `DockviewVue` with a `getTabContextMenuItems` callback:
  **Post-Mortem & Fix Analysis**:
  > yeah, this is a bug. will get this fixed
  > available in v8.3.0
  > I've upgraded to 8.3.0 and can confirm the fix works. Thank you very much!

- **Issue #1602** (2026-08-18): **Inconsistent event between moving a panel to a new group or moving panel to a new floating group**
  *Symptoms*: **Problem** I'm creating an application where I have a WorkspaceManager I tried to synchronize to Dockview.  **Scenario 1** :  I create 2 panels.  I move the second to a new group with my mouse.  A new group is created (event fired), the panel is moved into this group and the event onDidMovePanel triggers, so I can do my stuff : perfect.   **Scenario 2** :  I create 2 panels.  I move the second with shit+clic to a new "floating"group.  A new group is created (event fired), the panel is moved into this group and.... no onDidMovePanel here.   **Framework** My test are on React. I use the last version of Dockview (8.1)  **Proposed solution** The easiest way is to fire onDidMovePanel on floating group exactly the same as onDidMovePanel is fired on non-floating group. Targeting a floating group or a docked group not should not have any impact on this event.    **Alternatives considered** I tried to listen other events, to simulate the move but with no success. Example :  ```ts dockviewPanel.api.onDidLocationChange((locationEvent) => {         // The id here is the correct ID         console.log("CURREENT DOCK VIEW PANEL id: ", dockviewPanel.id);         // The ALL PANEL Contains all panel but not the one with the id before...         console.log("ALL PANELS:", this.api?.panels);         this._didMovePanel.fire({ panel: dockviewPanel.params.workspacePanel, from: dockviewPanel.params.workspaceGroup, to: wsGroup }) }) ``` But when I log it, in the ALL PANELS, the moving panel is not 
  **Post-Mortem & Fix Analysis**:
  > Thanks for the quick fix ! 

- **Issue #1553** (2026-08-10): **Re-adding a panel to a new single-panel group with inactive:true renders an empty body (same as #957 / #1300)**
  *Symptoms*: > **Note:** This report was drafted with AI assistance, but the root cause and the workaround below were **verified by actual testing** in a real dockview-react + React 19 application (dockview 7.0.2).  ### Summary  When a panel is removed and later re-added **programmatically during the same session**, the re-added panel shows an **empty body**: the group frame/tab is inserted correctly and space is reserved, but no content renders inside. Reloading the app or restoring the layout from a saved state (`fromJSON`) renders the same panel correctly.  This appears to be the same underlying issue reported in #957 ("space is reserved for the container but nothing is visible inside") and #1300 ("calling `panel.api.close()` then `addPanel()` to restore the panel does not work").  ### Reproduction  1. `api.addPanel({ id, component, position: { referencePanel, direction }, inactive: true })` — add a panel to a **newly created single-panel group**, with `inactive: true` so it does not steal activation from another panel (e.g. a central canvas). 2. The panel body is blank. The tab and the group container exist, but the React content never mounts. 3. Reload / `fromJSON` restore → the same panel renders fine.  ### Root cause  The public `addPanel({ inactive: true })` maps `inactive` to **both** `skipSetActive` **and** `skipSetGroupActive`.  For a panel added into a **freshly created single-panel group**, the group's `_activePanel` is initially `undefined`. In `DockviewGroupPanelModel.openP

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

### Incident Patch 1: `d74febda` (2026-09-24)
**Commit Message**: fix(core): shadow-DOM follow-ups — one focus helper, a layer that knows its own tree

Three loose ends from the shadow-DOM series (#1651, #1653, #1654, #1655,
#1656), now that it has all landed.

**One `getActiveElement`, not two.** `dockview-core`'s `getActiveElement` and
`dockview-enterprise`'s `activeElementOf` were the same function, kept in sync
by hand because `dom.ts` is internal and enterprise only sees the public
surface. Export it (alongside `findRelativeZIndexParent`,
`prefersReducedMotion` and `resolveOpaqueBackground`, which were promoted for
the same reason) and delete the copy.

**A dismissable layer now reasons in its own tree.** Two related gaps:

- The shadow roots to listen on were collected from `elements()`, so a layer
  that decides inside/outside purely by geometry — the auto-hide peek, which
  passes `isFocusInside` and no `elements` — bound none of them, and a focus
  move within a shadow root (which never reaches the window) left it open.
  #1651 recorded this as a known limitation. A new `anchor` option supplies a
  node to locate the roots from; the peek passes its group element.
- `isFocusInside` was handed the target retargeted all the way to the
  doc

**File**: `__generated__/dockview-core-exports.txt` (modified, +1/-0)
```diff
@@ -323,6 +323,7 @@ createSplitview
 defineModule
 directionToPosition
 findRelativeZIndexParent
+getActiveElement
 getDirectionOrientation
 getGridLocation
 getLocationOrientation
```

**File**: `e2e/fixtures/index.html` (modified, +25/-1)
```diff
@@ -48,8 +48,32 @@
                     '[KeyId:TEST]_[Company:Tests]_[Plan:team]_[AppName:Tests]_[Email:test@test]_[ValidFrom:01_Jan_2020]_[ValidUntil:01_Jan_2999]__8d12a26c8376cc3b'
                 );
 
-                const el = document.getElementById('app');
                 const params = new URLSearchParams(location.search);
+                // `?shadow=1` mounts the dock inside an open shadow root, the
+                // web-component case (a Lit host, say). The stylesheet is
+                // linked in <head>, which shadow DOM does not inherit, so copy
+                // it into the root as a real host would.
+                let el = document.getElementById('app');
+                if (params.get('shadow') === '1') {
+                    const shadowHost = document.createElement('div');
+                    shadowHost.id = 'shadow-host';
+                    // The `#app` rule in <head> styles the original mount;
+                    // the host needs the size inline to fill the page.
+                    shadowHost.style.cssText = 'height:100%;width:100%;';
+                    el.replaceWith(shadowHost);
+                    const shadowRoot = shadowHost.attachShadow({
+                        mode: 'open',
+                    });
+                    const link = document.createElement('link');
+                    link.rel = 'stylesheet';
+                    link.href =
+                        '/packages/dockview-core/dist/styles/dockview.css';
+                    const mount = document.createElement('div');
+                    mount.id = 'app';
+                    mount.style.cssText = 'height:100%;width:100%;';
+                    shadowRoot.append(link, mount);
+                    el = mount;
+                }
                 // Opt-in multi-row (wrapping) tabs via `?overflow=wrap` so the
                 // wrap behaviour is exercised without affecting other specs.
                 // `?maxRows=N` caps the header at N rows (surplus spills to the
```

**File**: `e2e/tests/shadow-dom.spec.ts` (added, +98/-0)
```diff
@@ -0,0 +1,98 @@
+import { test, expect, Page } from '@playwright/test';
+
+/**
+ * Dockview mounted inside an open shadow root — the web-component case (a Lit
+ * host, say). Real-browser only: the bugs here are all about what the platform
+ * retargets across a shadow boundary, which jsdom either doesn't model or the
+ * unit tests have to stub (hit-testing on a shadow root, `composedPath` on a
+ * real pointer event, popover geometry). The fixture mounts into a shadow root
+ * via `?shadow=1`.
+ *
+ * Playwright's CSS engine pierces open shadow roots, so the locators below read
+ * the same as in the light-DOM specs.
+ */
+test.describe('dockview inside a shadow root', () => {
+    const setup = async (page: Page, query = '') => {
+        await page.goto(`/e2e/fixtures/index.html?shadow=1${query}`);
+        await page.waitForFunction(() => (window as any).__ready === true);
+        // It really is in a shadow root, not the light DOM.
+        expect(
+            await page.evaluate(
+                () =>
+                    document
+                        .getElementById('shadow-host')
+                        ?.shadowRoot?.getElementById('app') != null
+            )
+        ).toBe(true);
+    };
+
+    test('a context menu item acts on the panel it was opened for', async ({
+        page,
+    }) => {
+        // The reported bug (#1649): `pointerdown` from inside a shadow root
+        // arrives at the window retargeted to the host, so the dismissable
+        // layer counted the click as "outside" and closed the menu before the
+        // item's handler ran — the item did nothing.
+        await setup(page);
+        await page.evaluate(() => {
+            (window as any).__dv.addPanel('alpha');
+            (window as any).__dv.addPanel('bravo');
+        });
+        await expect(page.locator('.dv-tab')).toHaveCount(2);
+
+        await page
+            .locator('.dv-tab', { hasText: 'alpha' })
+            .click({ button: 'right' });
+        const menu = page.locator('.dv-context-menu');
+        await expect(menu).toBeVisible();
+
+        await menu
+            .locator('.dv-context-menu-item', { hasText: 'Close' })
+            .first()
+            .click();
+
+        await expect(page.locator('.dv-tab')).toHaveCount(1);
+        await expect(page.locator('.dv-tab')).toHaveText('bravo');
+    });
+
+    test('a pointer drag reorders a tab', async ({ page }) => {
+        // `document.elementsFromPoint` stops at the shadow host, so the pointer
+        // backend found no drop target and a drag did nothing.
+        await setup(page);
+        await page.evaluate(() => {
+            for (const id of ['one', 'two', 'three']) {
+                (window as any).__dv.addPanel(id);
+            }
+        });
+        const tabs = page.locator('.dv-tab .dv-default-tab-content');
+        await expect(tabs).toHaveText(['one', 'two', 'three']);
+
+        const first = (await page
+            .locator('.dv-tab')
+            .first()
+            .boundingBox())!;
+        const last = (await page.locator('.dv-tab').last().boundingBox())!;
+
+        // Land on the right half of the last tab: that is the half that reads
+        // as "insert after me".
+        const targetX = last.x + last.width * 0.75;
+        const targetY = last.y + last.height / 2;
+        await page.mouse.move(
+            first.x + first.width / 2,
+            first.y + first.height / 2
+        );
+        await page.mouse.down();
+        const steps = 15;
+        for (let i = 1; i <= steps; i++) {
+            await page.mouse.move(
+                first.x + first.width / 2 + ((targetX - first.x - first.width / 2) * i) / steps,
+                targetY
+            );
+            await page.waitForTimeout(20);
+        }
+        await page.waitForTimeout(150);
+        await page.mouse.up();
+
+        await expect(tabs).toHaveText(['two', 'three', 'one']);
+    });
+});
```

**File**: `packages/dockview-core/src/__tests__/dismissableLayer.spec.ts` (modified, +57/-15)
```diff
@@ -277,37 +277,46 @@ describe('createDismissableLayer', () => {
         layer.dispose();
         panel.remove();
     });
-    test('a custom isFocusInside still gets the host for a move within the layer\u2019s own shadow root', () => {
-        // The shadow-root listener sees the un-retargeted inner node; a
-        // light-DOM `contains` predicate would call that "outside" and dismiss
-        // a layer the focus never left.
+    test('a custom isFocusInside sees the layer\u2019s own tree, not one collapsed host', () => {
         const host = document.createElement('div');
         document.body.appendChild(host);
         const shadowRoot = host.attachShadow({ mode: 'open' });
         const menu = document.createElement('div');
         const first = document.createElement('button');
-        const second = document.createElement('button');
-        menu.append(first, second);
-        shadowRoot.appendChild(menu);
+        menu.appendChild(first);
+        const elsewhere = document.createElement('button');
+        // A nested web component *inside* the layer still retargets to its own
+        // host, as it would for a light-DOM layer.
+        const componentHost = document.createElement('div');
+        menu.appendChild(componentHost);
+        const inComponent = document.createElement('button');
+        componentHost.attachShadow({ mode: 'open' }).appendChild(inComponent);
+        shadowRoot.append(menu, elsewhere);
 
+        const seen: Element[] = [];
         const onDismiss = jest.fn();
-        const isFocusInside = jest.fn(
-            (el: Element) => host.contains(el) || el === host
-        );
         const layer = createDismissableLayer({
             onDismiss,
             focusOut: true,
             elements: () => [menu],
-            isFocusInside,
+            isFocusInside: (el) => {
+                seen.push(el);
+                return menu.contains(el);
+            },
         });
 
+        // Retargeting everything out to `host` would make all three of these
+        // indistinguishable, so the layer could never close.
         first.focus();
-        second.focus(); // intra-root: only the shadow listener sees it
-
-        expect(isFocusInside).toHaveBeenCalledWith(host);
-        expect(isFocusInside).not.toHaveBeenCalledWith(second);
+        expect(seen.at(-1)).toBe(first);
+        inComponent.focus();
+        expect(seen.at(-1)).toBe(componentHost);
         expect(onDismiss).not.toHaveBeenCalled();
 
+        elsewhere.focus();
+        expect(seen.at(-1)).toBe(elsewhere);
+        expect(onDismiss).toHaveBeenCalledTimes(1);
+
         layer.dispose();
         host.remove();
     });
@@ -405,6 +414,39 @@ describe('createDismissableLayer', () => {
         elsewhere.focus(); // intra-root, needs the newly bound listener
         expect(onDismiss).toHaveBeenCalledTimes(1);
 
+        layer.dispose();
+        host.remove();
+    });
+    test('anchor lets a geometry-only layer see focus moves within its shadow root', () => {
+        const host = document.createElement('div');
+        document.body.appendChild(host);
+        const shadowRoot = host.attachShadow({ mode: 'open' });
+        const dock = document.createElement('div');
+        const peek = document.createElement('div');
+        const inPeek = document.createElement('button');
+        peek.appendChild(inPeek);
+        const outside = document.createElement('button');
+        dock.append(peek, outside);
+        shadowRoot.appendChild(dock);
+
+        // The auto-hide peek's shape: inside/outside is decided by geometry,
+        // so there are no `elements` to find the shadow root from.
+        const onDismiss = jest.fn();
+        const layer = createDismissableLayer({
+            onDismiss,
+            focusOut: true,
+            capture: true,
+            isFocusInside: (el) => peek.contains(el) || el === host,
+            anchor: () => dock,
+        });
+
+        inPeek.focus();
+        
```

**File**: `packages/dockview-core/src/dismissableLayer.ts` (modified, +35/-14)
```diff
@@ -1,4 +1,4 @@
-import { isEventWithin, retargetToDocument, shadowRootsOf } from './dom';
+import { isEventWithin, retargetInto, shadowRootsOf } from './dom';
 import { addDisposableListener } from './events';
 import { CompositeDisposable, IDisposable } from './lifecycle';
 
@@ -30,6 +30,13 @@ export interface DismissableLayerOptions {
     readonly isInside?: (event: PointerEvent) => boolean;
     /** Elements treated as "inside" by the default contains check. */
     readonly elements?: () => HTMLElement[];
+    /** An element the layer is anchored to, used only to locate the shadow
+     *  roots it lives in for {@link focusOut}. `elements` already provides
+     *  that, so pass this when the layer has none — a layer that decides
+     *  inside/outside purely by geometry ({@link isInside} /
+     *  {@link isFocusInside}) would otherwise never see a focus move *within*
+     *  a shadow root, since such a move never reaches the window. */
+    readonly anchor?: () => Node | null | undefined;
     /** Dismiss on `Escape` (default `true`). */
     readonly escape?: boolean;
     /** Extra keys that also dismiss (e.g. `'Enter'`). */
@@ -47,13 +54,14 @@ export interface DismissableLayerOptions {
      *  `false`): the "slide back on focus loss" behaviour. */
     readonly focusOut?: boolean;
     /** Whether a newly-focused element is inside the layer (for
-     *  {@link focusOut}). Always receives the target as a document-level
-     *  listener sees it, so focus inside a shadow root arrives as that root's
-     *  host however the event reached us — a `contains` predicate written
-     *  against the light DOM keeps working. Defaults to checking the event's
-     *  composed path against {@link elements}. Provide this for geometry-based
-     *  testing when the content is a sibling overlay stacked on top of the
-     *  layer. */
+     *  {@link focusOut}). Receives the target as seen from the layer's own
+     *  tree — the one holding {@link anchor}, else the first of
+     *  {@link elements} — so a predicate can always be written against the
+     *  elements it was given: focus inside a *nested* web component arrives as
+     *  that component's host, while focus in the layer's own shadow root
+     *  arrives as the real element. Defaults to checking the event's composed
+     *  path against {@link elements}. Provide this for geometry-based testing
+     *  when the content is a sibling overlay stacked on top of the layer. */
     readonly isFocusInside?: (focused: Element) => boolean;
     /** Listen in the capture phase (default `false`). Use capture when the
      *  layer must see the event before content handlers stop its propagation. */
@@ -155,6 +163,11 @@ export function createDismissableLayer(
         // so an `onDismiss` that moves focus — dispatching a nested `focusin`
         // while this one is still on the stack — can't make the outer event
         // look unseen and dismiss twice.
+        /** A node in the layer's own tree, to scope retargeting and to locate
+         *  the shadow roots to listen on. */
+        const layerScope = (): Node | undefined =>
+            options.anchor?.() ?? options.elements?.()[0];
+
         const seen = new WeakSet<FocusEvent>();
         const onFocusIn = (event: FocusEvent): void => {
             if (seen.has(event)) {
@@ -165,11 +178,14 @@ export function createDismissableLayer(
             if (!(target instanceof Element)) {
                 return;
             }
-            // Retarget so a custom predicate sees the same element whichever
-            // listener caught the event; the default path reads the composed
-            // path, which retargeting doesn't affect.
+            // Retarget into the layer's own tree so a custom predicate sees
+            // the same element whichever listener caught the event — and, for
+            // a layer inside a shadow root, an element it can actually tell
+            // apart rather than the one host e
```

---

### Incident Patch 2: `f96a1b72` (2026-09-24)
**Commit Message**: Merge pull request #1655 from dockview/fix/shadow-dom-focus-and-ghosts

fix(core): focus state and drag ghosts break when dockview is inside a shadow root

**File**: `packages/dockview-core/src/__tests__/dnd/ghost.spec.ts` (modified, +50/-0)
```diff
@@ -57,4 +57,54 @@ describe('ghost', () => {
 
         expect(element.parentElement).toBeNull();
     });
+
+    test('that the ghost is appended to the owner’s shadow root when it lives in one', () => {
+        const dataTransfer = <DataTransfer>(<unknown>{
+            setDragImage: jest.fn(),
+        });
+
+        const host = document.createElement('div');
+        document.body.appendChild(host);
+        const shadowRoot = host.attachShadow({ mode: 'open' });
+        const owner = document.createElement('div');
+        shadowRoot.appendChild(owner);
+
+        const element = document.createElement('div');
+        addGhostImage(dataTransfer, element, {
+            ownerDocument: owner.ownerDocument,
+            owner,
+        });
+
+        expect(element.parentNode).toBe(shadowRoot);
+
+        jest.runAllTimers();
+        expect(element.parentNode).toBeNull();
+        host.remove();
+    });
+    test('positions the ghost out of flow so it cannot shift the dock', () => {
+        const dataTransfer = <DataTransfer>(<unknown>{
+            setDragImage: jest.fn(),
+        });
+
+        const host = document.createElement('div');
+        document.body.appendChild(host);
+        const shadowRoot = host.attachShadow({ mode: 'open' });
+        const owner = document.createElement('div');
+        shadowRoot.appendChild(owner);
+
+        // Appended inside the dock's own subtree, an in-flow ghost would take
+        // up space for the frame before the timeout removes it; `top` only
+        // bites once it is positioned.
+        const element = document.createElement('div');
+        addGhostImage(dataTransfer, element, {
+            ownerDocument: owner.ownerDocument,
+            owner,
+        });
+
+        expect(element.style.position).toBe('absolute');
+        expect(element.style.top).toBe('-9999px');
+
+        jest.runAllTimers();
+        host.remove();
+    });
 });
```

**File**: `packages/dockview-core/src/__tests__/dnd/pointer/pointerGhost.spec.ts` (modified, +97/-0)
```diff
@@ -77,6 +77,103 @@ describe('PointerGhost', () => {
         ghost.dispose();
     });
 
+    test('attaches into the owner’s shadow root when the owner lives in one', () => {
+        const host = document.createElement('div');
+        document.body.appendChild(host);
+        const shadowRoot = host.attachShadow({ mode: 'open' });
+        const owner = document.createElement('div');
+        shadowRoot.appendChild(owner);
+
+        const ghostEl = document.createElement('div');
+        const ghost = new PointerGhost({
+            element: ghostEl,
+            initialX: 0,
+            initialY: 0,
+            owner,
+        });
+
+        expect(ghostEl.parentNode).toBe(shadowRoot);
+
+        ghost.dispose();
+        host.remove();
+    });
+
+    test('lifts a shadow-root ghost into the top layer so host ancestors cannot offset or clip it', () => {
+        // jsdom has no Popover API; browsers do.
+        const showPopover = jest.fn();
+        HTMLElement.prototype.showPopover = showPopover;
+        const host = document.createElement('div');
+        document.body.appendChild(host);
+        const shadowRoot = host.attachShadow({ mode: 'open' });
+        const owner = document.createElement('div');
+        shadowRoot.appendChild(owner);
+
+        try {
+            const ghostEl = document.createElement('div');
+            const ghost = new PointerGhost({
+                element: ghostEl,
+                initialX: 10,
+                initialY: 20,
+                owner,
+            });
+
+            const wrapper = ghostEl.parentElement as HTMLElement;
+            expect(wrapper.parentNode).toBe(shadowRoot);
+            expect(wrapper.popover).toBe('manual');
+            expect(showPopover).toHaveBeenCalledTimes(1);
+            expect(wrapper.style.position).toBe('fixed');
+            expect(wrapper.style.transform).toBe('translate3d(10px, 20px, 0)');
+            // The ghost itself keeps its own styles.
+            expect(ghostEl.style.position).toBe('');
+
+            ghost.update(30, 40);
+            expect(wrapper.style.transform).toBe('translate3d(30px, 40px, 0)');
+
+            ghost.dispose();
+            expect(ghostEl.isConnected).toBe(false);
+            expect(wrapper.isConnected).toBe(false);
+        } finally {
+            delete (HTMLElement.prototype as Partial<HTMLElement>).showPopover;
+            host.remove();
+        }
+    });
+
+    test('neutralises the clone\u2019s own pointer-events and transform when wrapped', () => {
+        const showPopover = jest.fn();
+        HTMLElement.prototype.showPopover = showPopover;
+        const host = document.createElement('div');
+        document.body.appendChild(host);
+        const shadowRoot = host.attachShadow({ mode: 'open' });
+        const owner = document.createElement('div');
+        shadowRoot.appendChild(owner);
+
+        try {
+            // Dockview's ghosts are clones with every computed property copied
+            // inline, so the element's own declarations beat the wrapper's.
+            const ghostEl = document.createElement('div');
+            ghostEl.style.pointerEvents = 'auto';
+            ghostEl.style.transform = 'translateX(40px)';
+
+            const ghost = new PointerGhost({
+                element: ghostEl,
+                initialX: 10,
+                initialY: 20,
+                owner,
+            });
+
+            const wrapper = ghostEl.parentElement as HTMLElement;
+            expect(wrapper.style.transform).toBe('translate3d(10px, 20px, 0)');
+            // Otherwise the ghost is hit-testable and sits 40px off the pointer.
+            expect(ghostEl.style.pointerEvents).toBe('none');
+            expect(ghostEl.style.transform).toBe('none');
+
+            ghost.dispose();
+        } finally {
+            delete (HTMLElement.prototype as Partial<HTMLElement>).showPopover;
+            host.remove();
+        }
+    });
+
     test('dispose() removes the element and
```

**File**: `packages/dockview-core/src/__tests__/dom.spec.ts` (modified, +110/-0)
```diff
@@ -4,6 +4,8 @@ import {
     disableIframePointEvents,
     disableTextSelection,
     findRelativeZIndexParent,
+    getActiveElement,
+    getOverlayParent,
     getDockviewTheme,
     getHitTestRoot,
     isChildEntirelyVisibleWithinParent,
@@ -15,6 +17,7 @@ import {
     quasiDefaultPrevented,
     quasiPreventDefault,
     resolveOpaqueBackground,
+    trackFocus,
 } from '../dom';
 
 function stubRect(
@@ -543,6 +546,113 @@ describe('onDidWindowMoveEnd', () => {
     });
 });
 
+describe('shadow-DOM-aware focus and overlay helpers', () => {
+    let host: HTMLElement;
+
+    beforeEach(() => {
+        host = document.createElement('div');
+        document.body.appendChild(host);
+    });
+
+    afterEach(() => {
+        host.remove();
+        jest.useRealTimers();
+    });
+
+    test('getActiveElement reaches into the shadow root the node lives in', () => {
+        const shadowRoot = host.attachShadow({ mode: 'open' });
+        const container = document.createElement('div');
+        const button = document.createElement('button');
+        container.appendChild(button);
+        shadowRoot.appendChild(container);
+
+        button.focus();
+
+        expect(document.activeElement).toBe(host);
+        expect(getActiveElement(container)).toBe(button);
+    });
+
+    test('getActiveElement resolves focus inside a nested web component to its host', () => {
+        const componentHost = document.createElement('div');
+        host.appendChild(componentHost);
+        const button = document.createElement('button');
+        componentHost.attachShadow({ mode: 'open' }).appendChild(button);
+
+        button.focus();
+
+        expect(getActiveElement(host)).toBe(componentHost);
+    });
+
+    test('getActiveElement ignores a document that does not have focus', () => {
+        const button = document.createElement('button');
+        host.appendChild(button);
+        button.focus();
+        expect(getActiveElement(button)).toBe(button);
+
+        // A background popout keeps its activeElement; reading it would let
+        // refreshState fire a focus the window never had.
+        const hasFocus = jest
+            .spyOn(document, 'hasFocus')
+            .mockReturnValue(false);
+        try {
+            expect(getActiveElement(button)).toBeNull();
+        } finally {
+            hasFocus.mockRestore();
+        }
+    });
+
+    test('getActiveElement is null for a detached node', () => {
+        expect(getActiveElement(document.createElement('div'))).toBeNull();
+    });
+
+    test('getOverlayParent is the shadow root, the body, or a popout body', () => {
+        const shadowRoot = host.attachShadow({ mode: 'open' });
+        const inShadow = document.createElement('div');
+        shadowRoot.appendChild(inShadow);
+        expect(getOverlayParent(inShadow)).toBe(shadowRoot);
+
+        const inLight = document.createElement('div');
+        document.body.appendChild(inLight);
+        expect(getOverlayParent(inLight)).toBe(document.body);
+        inLight.remove();
+
+        expect(getOverlayParent(document.createElement('div'))).toBe(
+            document.body
+        );
+
+        const otherDoc = document.implementation.createHTMLDocument('popout');
+        const inPopout = otherDoc.createElement('div');
+        otherDoc.body.appendChild(inPopout);
+        expect(getOverlayParent(inPopout)).toBe(otherDoc.body);
+    });
+
+    test('trackFocus keeps focus inside a shadow root on refreshState', () => {
+        jest.useFakeTimers();
+        const shadowRoot = host.attachShadow({ mode: 'open' });
+        const container = document.createElement('div');
+        const button = document.createElement('button');
+        container.appendChild(button);
+        shadowRoot.appendChild(container);
+
+        const tracker = trackFocus(container);
+        const onDidFocus = jest.fn();
+        const onDidBlur = jest.fn();
+        tracker.onDidFocus(onDidFocus);
+        tracker.onDidBlur(onDi
```

**File**: `packages/dockview-core/src/dnd/backend.ts` (modified, +1/-0)
```diff
@@ -142,6 +142,7 @@ class Html5DragSource extends CompositeDisposable implements IDragSource {
                         x: ghost.offsetX ?? 0,
                         y: ghost.offsetY ?? 0,
                         ownerDocument: this.el.ownerDocument ?? undefined,
+                        owner: this.el,
                     });
                     if (ghost.dispose) {
                         // addGhostImage removes the element from the DOM on
```

**File**: `packages/dockview-core/src/dnd/ghost.ts` (modified, +20/-5)
```diff
@@ -1,22 +1,37 @@
-import { addClasses, removeClasses } from '../dom';
+import { addClasses, getOverlayParent, removeClasses } from '../dom';
 
 export function addGhostImage(
     dataTransfer: DataTransfer,
     ghostElement: HTMLElement,
-    options?: { x?: number; y?: number; ownerDocument?: Document }
+    options?: {
+        x?: number;
+        y?: number;
+        ownerDocument?: Document;
+        /** The drag source. When it is inside a shadow root the ghost is
+         *  appended there, so the styles scoped to that root apply. */
+        owner?: Node;
+    }
 ): void {
     // class dockview provides to force ghost image to be drawn on a different layer and prevent weird rendering issues
     addClasses(ghostElement, 'dv-dragged');
 
     // move the element off-screen initially otherwise it may in some cases be rendered at (0,0) momentarily
     ghostElement.style.top = '-9999px';
+    // `top` only bites once the element is out of flow. In the document body
+    // that hardly showed; appended into a shadow root it sits inside the dock's
+    // own box, so a ghost without its own `position` (the multi-panel one sets
+    // only `display`) would shift the layout for the frame before removal.
+    ghostElement.style.position = 'absolute';
 
-    // Append to the drag source's own document. Per spec a setDragImage
+    // Append to the drag source's own document (inside its shadow root, when
+    // it has one, so the styles scoped there apply). Per spec a setDragImage
     // element that is cross-document relative to the drag's DataTransfer is
     // ignored, so a drag initiated inside a popout window must use the popout
     // document, not the main one.
-    const ownerDocument = options?.ownerDocument ?? document;
-    ownerDocument.body.appendChild(ghostElement);
+    const parent = options?.owner
+        ? getOverlayParent(options.owner)
+        : (options?.ownerDocument ?? document).body;
+    parent.appendChild(ghostElement);
     dataTransfer.setDragImage(ghostElement, options?.x ?? 0, options?.y ?? 0);
 
     setTimeout(() => {
```

---

### Incident Patch 3: `786a227d` (2026-09-24)
**Commit Message**: Merge remote-tracking branch 'origin/master' into fix/shadow-dom-focus-and-ghosts

# Conflicts:
#	packages/dockview-core/src/__tests__/dom.spec.ts

**File**: `packages/dockview-core/src/__tests__/dockview/dockviewComponent.spec.ts` (modified, +54/-0)
```diff
@@ -14321,3 +14321,57 @@ describe('group header direction change signal (DV-14 unblocker)', () => {
         });
     });
 });
+
+describe('popout styles from a shadow-root mount', () => {
+    test('copies the stylesheets of the shadow root dockview is mounted in', async () => {
+        const host = document.createElement('div');
+        document.body.appendChild(host);
+        const shadowRoot = host.attachShadow({ mode: 'open' });
+        const container = document.createElement('div');
+        shadowRoot.appendChild(container);
+        // jsdom has no styleSheets / adoptedStyleSheets on shadow roots.
+        Object.assign(shadowRoot, {
+            styleSheets: [
+                {
+                    href: null,
+                    cssRules: [{ cssText: '.from-shadow { color: red; }' }],
+                },
+            ],
+            adoptedStyleSheets: [],
+        });
+
+        const popoutDocument =
+            document.implementation.createHTMLDocument('popout');
+        const mockWindow = setupMockWindow();
+        Object.defineProperty(mockWindow, 'document', {
+            value: popoutDocument,
+        });
+        const originalOpen = window.open;
+        window.open = () => mockWindow;
+
+        try {
+            const dockview = new DockviewComponent(container, {
+                createComponent(options) {
+                    return new PanelContentPartTest(options.id, options.name);
+                },
+            });
+            dockview.layout(1000, 500);
+            const panel = dockview.addPanel({
+                id: 'panel_1',
+                component: 'default',
+            });
+
+            expect(await dockview.addPopoutGroup(panel.api.group)).toBeTruthy();
+
+            const texts = Array.from(
+                popoutDocument.head.querySelectorAll('style')
+            ).map((style) => style.textContent);
+            expect(texts).toContain('.from-shadow { color: red; }');
+
+            dockview.dispose();
+        } finally {
+            window.open = originalOpen;
+            host.remove();
+        }
+    });
+});
```

**File**: `packages/dockview-core/src/__tests__/dom.spec.ts` (modified, +52/-0)
```diff
@@ -6,10 +6,12 @@ import {
     findRelativeZIndexParent,
     getActiveElement,
     getOverlayParent,
+    getDockviewTheme,
     getHitTestRoot,
     isChildEntirelyVisibleWithinParent,
     isEventWithin,
     isInDocument,
+    isShadowRoot,
     onDidWindowMoveEnd,
     prefersReducedMotion,
     quasiDefaultPrevented,
@@ -651,6 +653,56 @@ describe('shadow-DOM-aware focus and overlay helpers', () => {
     });
 });
 
+describe('isShadowRoot', () => {
+    test('true only for a shadow root', () => {
+        const host = document.createElement('div');
+        const shadowRoot = host.attachShadow({ mode: 'open' });
+
+        expect(isShadowRoot(shadowRoot)).toBe(true);
+        expect(isShadowRoot(document)).toBe(false);
+        expect(isShadowRoot(host)).toBe(false);
+        expect(isShadowRoot(document.createDocumentFragment())).toBe(false);
+        expect(isShadowRoot(null)).toBe(false);
+        expect(isShadowRoot(undefined)).toBe(false);
+    });
+});
+
+describe('addStyles and getDockviewTheme across a shadow boundary', () => {
+    test('a copied <link> carries the CSP nonce', () => {
+        const targetDoc = document.implementation.createHTMLDocument('popout');
+        addStyles(
+            targetDoc,
+            [
+                {
+                    href: 'https://example.test/app.css',
+                    type: 'text/css',
+                } as unknown as CSSStyleSheet,
+            ],
+            { nonce: 'abc123' }
+        );
+
+        const link = targetDoc.head.querySelector('link');
+        expect(link?.getAttribute('href')).toBe('https://example.test/app.css');
+        // Without it, `style-src 'nonce-…'` blocks the sheet.
+        expect(link?.getAttribute('nonce')).toBe('abc123');
+    });
+
+    test('getDockviewTheme finds a theme class on the shadow host', () => {
+        const host = document.createElement('div');
+        host.classList.add('dockview-theme-abyss');
+        document.body.appendChild(host);
+        const shadowRoot = host.attachShadow({ mode: 'open' });
+        const dock = document.createElement('div');
+        shadowRoot.appendChild(dock);
+
+        // `parentElement` is null at the boundary, so the walk has to step out
+        // through the host or the popout container gets no theme class.
+        expect(getDockviewTheme(dock)).toBe('dockview-theme-abyss');
+
+        host.remove();
+    });
+});
+
 describe('getHitTestRoot', () => {
     test('returns the document for an attached light-DOM node', () => {
         const el = document.createElement('div');
```

**File**: `packages/dockview-core/src/__tests__/popoutWindow.spec.ts` (modified, +192/-0)
```diff
@@ -342,6 +342,198 @@ describe('PopoutWindow', () => {
         }
     });
 
+    test('copies the stylesheets of a shadow-root style root into the popout document', async () => {
+        const { externalWindow, externalDoc, fireLoad } =
+            makeFakeExternalWindow();
+        const openSpy = jest
+            .spyOn(window, 'open')
+            .mockReturnValue(externalWindow as Window);
+
+        const host = document.createElement('div');
+        document.body.appendChild(host);
+        const shadowRoot = host.attachShadow({ mode: 'open' });
+        // jsdom implements neither on shadow roots; browsers expose both.
+        const sheet = (cssText: string) =>
+            ({
+                href: null,
+                cssRules: [{ cssText }],
+            }) as unknown as CSSStyleSheet;
+        Object.assign(shadowRoot, {
+            styleSheets: [sheet('.from-shadow-style { color: red; }')],
+            adoptedStyleSheets: [sheet('.from-adopted { color: blue; }')],
+        });
+
+        try {
+            const popout = new PopoutWindow('target-id', 'dv-test-class', {
+                url: '/popout.html',
+                top: 0,
+                left: 0,
+                width: 100,
+                height: 100,
+                nonce: 'shadow-nonce',
+                styleRoot: () => shadowRoot,
+            });
+
+            const opened = popout.open();
+            fireLoad();
+            await opened;
+
+            const css = Array.from(externalDoc.head.querySelectorAll('style'));
+            const texts = css.map((s) => s.textContent);
+            expect(texts).toContain('.from-shadow-style { color: red; }');
+            expect(texts).toContain('.from-adopted { color: blue; }');
+            expect(css.map((s) => s.getAttribute('nonce'))).toEqual(
+                css.map(() => 'shadow-nonce')
+            );
+
+            popout.dispose();
+        } finally {
+            openSpy.mockRestore();
+            host.remove();
+        }
+    });
+
+    test('copies the parent document\u2019s adopted stylesheets', async () => {
+        const { externalWindow, externalDoc, fireLoad } =
+            makeFakeExternalWindow();
+        const openSpy = jest
+            .spyOn(window, 'open')
+            .mockReturnValue(externalWindow as Window);
+
+        // A build that ships its CSS as constructed sheets has nothing in
+        // `document.styleSheets` at all.
+        const adopted = [
+            {
+                href: null,
+                cssRules: [{ cssText: '.from-doc-adopted { color: teal; }' }],
+            } as unknown as CSSStyleSheet,
+        ];
+        const original = (document as Partial<Document>).adoptedStyleSheets;
+        Object.defineProperty(document, 'adoptedStyleSheets', {
+            value: adopted,
+            configurable: true,
+        });
+
+        try {
+            const popout = new PopoutWindow('target-id', 'dv-test-class', {
+                url: '/popout.html',
+                top: 0,
+                left: 0,
+                width: 100,
+                height: 100,
+            });
+
+            const opened = popout.open();
+            fireLoad();
+            await opened;
+
+            const texts = Array.from(
+                externalDoc.head.querySelectorAll('style')
+            ).map((el) => el.textContent);
+            expect(texts).toContain('.from-doc-adopted { color: teal; }');
+
+            popout.dispose();
+        } finally {
+            openSpy.mockRestore();
+            if (original === undefined) {
+                delete (document as Partial<Document>).adoptedStyleSheets;
+            } else {
+                Object.defineProperty(document, 'adoptedStyleSheets', {
+                    value: original,
+                    configurable: true,
+                });
+            }
+        }
+    });
+
+    test('copies the stylesheets of every shadow root the dock sits under', async () => {
+        const { external
```

**File**: `packages/dockview-core/src/dockview/dockviewComponent.ts` (modified, +1/-0)
```diff
@@ -2016,6 +2016,7 @@ export class DockviewComponent
                     this._onWillClosePopoutWindow.fire(event);
                 },
                 nonce: this.options?.nonce,
+                styleRoot: () => this.element.getRootNode(),
             }
         );
 
```

**File**: `packages/dockview-core/src/dom.ts` (modified, +32/-16)
```diff
@@ -227,24 +227,15 @@ export function isEventWithin(
     return target instanceof Node && elements.some((el) => el.contains(target));
 }
 
-/** The shadow root `node` is, or `undefined` when it is not one. A shadow
- *  root is the only document fragment with a `host`. */
-export function asShadowRoot(node: Node): ShadowRoot | undefined {
-    return node.nodeType === Node.DOCUMENT_FRAGMENT_NODE &&
-        (node as ShadowRoot).host
-        ? (node as ShadowRoot)
-        : undefined;
-}
-
 /** Every shadow root between `element` and its document, innermost first. An
  *  element in a component nested inside another component sits in more than
  *  one, and an event is cut at each boundary. */
 export function shadowRootsOf(element: Element): ShadowRoot[] {
     const roots: ShadowRoot[] = [];
-    let root = asShadowRoot(element.getRootNode());
-    while (root) {
+    let root: Node = element.getRootNode();
+    while (isShadowRoot(root)) {
         roots.push(root);
-        root = asShadowRoot(root.host.getRootNode());
+        root = root.host.getRootNode();
     }
     return roots;
 }
@@ -253,10 +244,10 @@ export function shadowRootsOf(element: Element): ShadowRoot[] {
  *  is retargeted to that root's host, repeatedly for nested roots. */
 export function retargetToDocument(element: Element): Element {
     let current = element;
-    let root = asShadowRoot(current.getRootNode());
-    while (root) {
+    let root: Node = current.getRootNode();
+    while (isShadowRoot(root)) {
         current = root.host;
-        root = asShadowRoot(current.getRootNode());
+        root = current.getRootNode();
     }
     return current;
 }
@@ -271,7 +262,7 @@ export interface AddStylesOptions {
 
 export function addStyles(
     document: Document,
-    styleSheetList: StyleSheetList,
+    styleSheetList: StyleSheetList | readonly CSSStyleSheet[],
     options: AddStylesOptions = {}
 ) {
     const styleSheets = Array.from(styleSheetList);
@@ -284,6 +275,11 @@ export function addStyles(
             link.href = styleSheet.href;
             link.type = styleSheet.type;
             link.rel = 'stylesheet';
+            // `style-src 'nonce-…'` covers external stylesheets too, so a
+            // copied <link> needs the nonce just as a generated <style> does.
+            if (resolvedNonce) {
+                link.setAttribute('nonce', resolvedNonce);
+            }
             document.head.appendChild(link);
             // The <link> will load and apply its rules in the target
             // document. Reading cssRules here would duplicate them
@@ -355,6 +351,18 @@ export function isInDocument(element: Element): boolean {
     return false;
 }
 
+/** Duck-typed so it holds for a shadow root from another window's realm. */
+export function isShadowRoot(
+    node: Node | null | undefined
+): node is ShadowRoot {
+    return (
+        !!node &&
+        node.nodeType === Node.DOCUMENT_FRAGMENT_NODE &&
+        'host' in node &&
+        !!(node as ShadowRoot).host
+    );
+}
+
 /**
  * The document or shadow root to hit-test (`elementFromPoint` /
  * `elementsFromPoint`) against for `node`. Hit-testing on the document stops
@@ -513,6 +521,14 @@ export function getDockviewTheme(element: HTMLElement): string | undefined {
         if (typeof theme === 'string') {
             break;
         }
+        // `parentElement` is null at a shadow boundary, so step out through
+        // the host: a theme class set on the web component hosting the dock
+        // still has to be found.
+        if (parent.parentElement === null) {
+            const root = parent.getRootNode();
+            parent = isShadowRoot(root) ? (root.host as HTMLElement) : null;
+            continue;
+        }
         parent = parent.parentElement;
     }
 
```

---

### Incident Patch 4: `ad1533d7` (2026-09-24)
**Commit Message**: Merge pull request #1654 from dockview/fix/shadow-dom-popout-styles

fix(core): popout windows open unstyled when dockview is inside a shadow root

**File**: `packages/dockview-core/src/__tests__/dockview/dockviewComponent.spec.ts` (modified, +54/-0)
```diff
@@ -14321,3 +14321,57 @@ describe('group header direction change signal (DV-14 unblocker)', () => {
         });
     });
 });
+
+describe('popout styles from a shadow-root mount', () => {
+    test('copies the stylesheets of the shadow root dockview is mounted in', async () => {
+        const host = document.createElement('div');
+        document.body.appendChild(host);
+        const shadowRoot = host.attachShadow({ mode: 'open' });
+        const container = document.createElement('div');
+        shadowRoot.appendChild(container);
+        // jsdom has no styleSheets / adoptedStyleSheets on shadow roots.
+        Object.assign(shadowRoot, {
+            styleSheets: [
+                {
+                    href: null,
+                    cssRules: [{ cssText: '.from-shadow { color: red; }' }],
+                },
+            ],
+            adoptedStyleSheets: [],
+        });
+
+        const popoutDocument =
+            document.implementation.createHTMLDocument('popout');
+        const mockWindow = setupMockWindow();
+        Object.defineProperty(mockWindow, 'document', {
+            value: popoutDocument,
+        });
+        const originalOpen = window.open;
+        window.open = () => mockWindow;
+
+        try {
+            const dockview = new DockviewComponent(container, {
+                createComponent(options) {
+                    return new PanelContentPartTest(options.id, options.name);
+                },
+            });
+            dockview.layout(1000, 500);
+            const panel = dockview.addPanel({
+                id: 'panel_1',
+                component: 'default',
+            });
+
+            expect(await dockview.addPopoutGroup(panel.api.group)).toBeTruthy();
+
+            const texts = Array.from(
+                popoutDocument.head.querySelectorAll('style')
+            ).map((style) => style.textContent);
+            expect(texts).toContain('.from-shadow { color: red; }');
+
+            dockview.dispose();
+        } finally {
+            window.open = originalOpen;
+            host.remove();
+        }
+    });
+});
```

**File**: `packages/dockview-core/src/__tests__/dom.spec.ts` (modified, +52/-0)
```diff
@@ -4,10 +4,12 @@ import {
     disableIframePointEvents,
     disableTextSelection,
     findRelativeZIndexParent,
+    getDockviewTheme,
     getHitTestRoot,
     isChildEntirelyVisibleWithinParent,
     isEventWithin,
     isInDocument,
+    isShadowRoot,
     onDidWindowMoveEnd,
     prefersReducedMotion,
     quasiDefaultPrevented,
@@ -541,6 +543,56 @@ describe('onDidWindowMoveEnd', () => {
     });
 });
 
+describe('isShadowRoot', () => {
+    test('true only for a shadow root', () => {
+        const host = document.createElement('div');
+        const shadowRoot = host.attachShadow({ mode: 'open' });
+
+        expect(isShadowRoot(shadowRoot)).toBe(true);
+        expect(isShadowRoot(document)).toBe(false);
+        expect(isShadowRoot(host)).toBe(false);
+        expect(isShadowRoot(document.createDocumentFragment())).toBe(false);
+        expect(isShadowRoot(null)).toBe(false);
+        expect(isShadowRoot(undefined)).toBe(false);
+    });
+});
+
+describe('addStyles and getDockviewTheme across a shadow boundary', () => {
+    test('a copied <link> carries the CSP nonce', () => {
+        const targetDoc = document.implementation.createHTMLDocument('popout');
+        addStyles(
+            targetDoc,
+            [
+                {
+                    href: 'https://example.test/app.css',
+                    type: 'text/css',
+                } as unknown as CSSStyleSheet,
+            ],
+            { nonce: 'abc123' }
+        );
+
+        const link = targetDoc.head.querySelector('link');
+        expect(link?.getAttribute('href')).toBe('https://example.test/app.css');
+        // Without it, `style-src 'nonce-…'` blocks the sheet.
+        expect(link?.getAttribute('nonce')).toBe('abc123');
+    });
+
+    test('getDockviewTheme finds a theme class on the shadow host', () => {
+        const host = document.createElement('div');
+        host.classList.add('dockview-theme-abyss');
+        document.body.appendChild(host);
+        const shadowRoot = host.attachShadow({ mode: 'open' });
+        const dock = document.createElement('div');
+        shadowRoot.appendChild(dock);
+
+        // `parentElement` is null at the boundary, so the walk has to step out
+        // through the host or the popout container gets no theme class.
+        expect(getDockviewTheme(dock)).toBe('dockview-theme-abyss');
+
+        host.remove();
+    });
+});
+
 describe('getHitTestRoot', () => {
     test('returns the document for an attached light-DOM node', () => {
         const el = document.createElement('div');
```

**File**: `packages/dockview-core/src/__tests__/popoutWindow.spec.ts` (modified, +192/-0)
```diff
@@ -342,6 +342,198 @@ describe('PopoutWindow', () => {
         }
     });
 
+    test('copies the stylesheets of a shadow-root style root into the popout document', async () => {
+        const { externalWindow, externalDoc, fireLoad } =
+            makeFakeExternalWindow();
+        const openSpy = jest
+            .spyOn(window, 'open')
+            .mockReturnValue(externalWindow as Window);
+
+        const host = document.createElement('div');
+        document.body.appendChild(host);
+        const shadowRoot = host.attachShadow({ mode: 'open' });
+        // jsdom implements neither on shadow roots; browsers expose both.
+        const sheet = (cssText: string) =>
+            ({
+                href: null,
+                cssRules: [{ cssText }],
+            }) as unknown as CSSStyleSheet;
+        Object.assign(shadowRoot, {
+            styleSheets: [sheet('.from-shadow-style { color: red; }')],
+            adoptedStyleSheets: [sheet('.from-adopted { color: blue; }')],
+        });
+
+        try {
+            const popout = new PopoutWindow('target-id', 'dv-test-class', {
+                url: '/popout.html',
+                top: 0,
+                left: 0,
+                width: 100,
+                height: 100,
+                nonce: 'shadow-nonce',
+                styleRoot: () => shadowRoot,
+            });
+
+            const opened = popout.open();
+            fireLoad();
+            await opened;
+
+            const css = Array.from(externalDoc.head.querySelectorAll('style'));
+            const texts = css.map((s) => s.textContent);
+            expect(texts).toContain('.from-shadow-style { color: red; }');
+            expect(texts).toContain('.from-adopted { color: blue; }');
+            expect(css.map((s) => s.getAttribute('nonce'))).toEqual(
+                css.map(() => 'shadow-nonce')
+            );
+
+            popout.dispose();
+        } finally {
+            openSpy.mockRestore();
+            host.remove();
+        }
+    });
+
+    test('copies the parent document\u2019s adopted stylesheets', async () => {
+        const { externalWindow, externalDoc, fireLoad } =
+            makeFakeExternalWindow();
+        const openSpy = jest
+            .spyOn(window, 'open')
+            .mockReturnValue(externalWindow as Window);
+
+        // A build that ships its CSS as constructed sheets has nothing in
+        // `document.styleSheets` at all.
+        const adopted = [
+            {
+                href: null,
+                cssRules: [{ cssText: '.from-doc-adopted { color: teal; }' }],
+            } as unknown as CSSStyleSheet,
+        ];
+        const original = (document as Partial<Document>).adoptedStyleSheets;
+        Object.defineProperty(document, 'adoptedStyleSheets', {
+            value: adopted,
+            configurable: true,
+        });
+
+        try {
+            const popout = new PopoutWindow('target-id', 'dv-test-class', {
+                url: '/popout.html',
+                top: 0,
+                left: 0,
+                width: 100,
+                height: 100,
+            });
+
+            const opened = popout.open();
+            fireLoad();
+            await opened;
+
+            const texts = Array.from(
+                externalDoc.head.querySelectorAll('style')
+            ).map((el) => el.textContent);
+            expect(texts).toContain('.from-doc-adopted { color: teal; }');
+
+            popout.dispose();
+        } finally {
+            openSpy.mockRestore();
+            if (original === undefined) {
+                delete (document as Partial<Document>).adoptedStyleSheets;
+            } else {
+                Object.defineProperty(document, 'adoptedStyleSheets', {
+                    value: original,
+                    configurable: true,
+                });
+            }
+        }
+    });
+
+    test('copies the stylesheets of every shadow root the dock sits under', async () => {
+        const { external
```

**File**: `packages/dockview-core/src/dockview/dockviewComponent.ts` (modified, +1/-0)
```diff
@@ -2016,6 +2016,7 @@ export class DockviewComponent
                     this._onWillClosePopoutWindow.fire(event);
                 },
                 nonce: this.options?.nonce,
+                styleRoot: () => this.element.getRootNode(),
             }
         );
 
```

**File**: `packages/dockview-core/src/dom.ts` (modified, +32/-16)
```diff
@@ -224,24 +224,15 @@ export function isEventWithin(
     return target instanceof Node && elements.some((el) => el.contains(target));
 }
 
-/** The shadow root `node` is, or `undefined` when it is not one. A shadow
- *  root is the only document fragment with a `host`. */
-export function asShadowRoot(node: Node): ShadowRoot | undefined {
-    return node.nodeType === Node.DOCUMENT_FRAGMENT_NODE &&
-        (node as ShadowRoot).host
-        ? (node as ShadowRoot)
-        : undefined;
-}
-
 /** Every shadow root between `element` and its document, innermost first. An
  *  element in a component nested inside another component sits in more than
  *  one, and an event is cut at each boundary. */
 export function shadowRootsOf(element: Element): ShadowRoot[] {
     const roots: ShadowRoot[] = [];
-    let root = asShadowRoot(element.getRootNode());
-    while (root) {
+    let root: Node = element.getRootNode();
+    while (isShadowRoot(root)) {
         roots.push(root);
-        root = asShadowRoot(root.host.getRootNode());
+        root = root.host.getRootNode();
     }
     return roots;
 }
@@ -250,10 +241,10 @@ export function shadowRootsOf(element: Element): ShadowRoot[] {
  *  is retargeted to that root's host, repeatedly for nested roots. */
 export function retargetToDocument(element: Element): Element {
     let current = element;
-    let root = asShadowRoot(current.getRootNode());
-    while (root) {
+    let root: Node = current.getRootNode();
+    while (isShadowRoot(root)) {
         current = root.host;
-        root = asShadowRoot(current.getRootNode());
+        root = current.getRootNode();
     }
     return current;
 }
@@ -268,7 +259,7 @@ export interface AddStylesOptions {
 
 export function addStyles(
     document: Document,
-    styleSheetList: StyleSheetList,
+    styleSheetList: StyleSheetList | readonly CSSStyleSheet[],
     options: AddStylesOptions = {}
 ) {
     const styleSheets = Array.from(styleSheetList);
@@ -281,6 +272,11 @@ export function addStyles(
             link.href = styleSheet.href;
             link.type = styleSheet.type;
             link.rel = 'stylesheet';
+            // `style-src 'nonce-…'` covers external stylesheets too, so a
+            // copied <link> needs the nonce just as a generated <style> does.
+            if (resolvedNonce) {
+                link.setAttribute('nonce', resolvedNonce);
+            }
             document.head.appendChild(link);
             // The <link> will load and apply its rules in the target
             // document. Reading cssRules here would duplicate them
@@ -352,6 +348,18 @@ export function isInDocument(element: Element): boolean {
     return false;
 }
 
+/** Duck-typed so it holds for a shadow root from another window's realm. */
+export function isShadowRoot(
+    node: Node | null | undefined
+): node is ShadowRoot {
+    return (
+        !!node &&
+        node.nodeType === Node.DOCUMENT_FRAGMENT_NODE &&
+        'host' in node &&
+        !!(node as ShadowRoot).host
+    );
+}
+
 /**
  * The document or shadow root to hit-test (`elementFromPoint` /
  * `elementsFromPoint`) against for `node`. Hit-testing on the document stops
@@ -510,6 +518,14 @@ export function getDockviewTheme(element: HTMLElement): string | undefined {
         if (typeof theme === 'string') {
             break;
         }
+        // `parentElement` is null at a shadow boundary, so step out through
+        // the host: a theme class set on the web component hosting the dock
+        // still has to be found.
+        if (parent.parentElement === null) {
+            const root = parent.getRootNode();
+            parent = isShadowRoot(root) ? (root.host as HTMLElement) : null;
+            continue;
+        }
         parent = parent.parentElement;
     }
 
```

---

### Incident Patch 5: `dd863959` (2026-09-24)
**Commit Message**: Merge remote-tracking branch 'origin/master' into fix/shadow-dom-focus-and-ghosts

# Conflicts:
#	packages/dockview-core/src/__tests__/dom.spec.ts

**File**: `packages/dockview-core/src/__tests__/dnd/pointer/pointerDragController.spec.ts` (modified, +43/-0)
```diff
@@ -107,6 +107,49 @@ describe('PointerDragController', () => {
         document.body.removeChild(targetEl);
     });
 
+    test('hit-tests through the shadow root when the source is inside one', () => {
+        const controller = PointerDragController.getInstance();
+
+        const host = document.createElement('div');
+        document.body.appendChild(host);
+        const shadowRoot = host.attachShadow({ mode: 'open' });
+        const source = document.createElement('div');
+        const targetEl = document.createElement('div');
+        shadowRoot.append(source, targetEl);
+
+        // Hit-testing on the document stops at the shadow host; only the
+        // shadow root sees the target. (jsdom lacks the method on shadow
+        // roots, so define it.)
+        const documentSpy = jest
+            .spyOn(document, 'elementsFromPoint')
+            .mockReturnValue([host, document.body]);
+        Object.assign(shadowRoot, {
+            elementsFromPoint: jest
+                .fn()
+                .mockReturnValue([targetEl, host, document.body]),
+        });
+
+        const { target, handleDragOver } = makeTarget(targetEl);
+        const reg = controller.registerTarget(target);
+
+        controller.beginDrag({
+            pointerEvent: makePointerEvent('pointermove'),
+            source,
+            getData: () => ({ dispose: jest.fn() }),
+        });
+
+        window.dispatchEvent(
+            makePointerEvent('pointermove', { clientX: 50, clientY: 50 })
+        );
+
+        expect(handleDragOver).toHaveBeenCalledTimes(1);
+
+        controller.cancel();
+        reg.dispose();
+        documentSpy.mockRestore();
+        host.remove();
+    });
+
     test('drag-leave fires when the pointer moves off the target', () => {
         const controller = PointerDragController.getInstance();
 
```

**File**: `packages/dockview-core/src/__tests__/dockview/components/titlebar/tabsAnimation.spec.ts` (modified, +53/-0)
```diff
@@ -1881,6 +1881,59 @@ describe('tabs - animation', () => {
             expect(moveTabGroupMock).toHaveBeenCalledWith('tg-1', 2);
         });
 
+        test('pointer chip drag commits the group move when the strip is inside a shadow root', () => {
+            const { tabs, group, tabGroup, chip } = setupChipDrag('smooth', [
+                'panel-a',
+                'panel-b',
+                'panel-c',
+            ]);
+
+            const moveTabGroupMock = jest.fn();
+            (group.model as any).moveTabGroup = moveTabGroupMock;
+
+            const host = document.createElement('div');
+            document.body.appendChild(host);
+            const shadowRoot = host.attachShadow({ mode: 'open' });
+            shadowRoot.appendChild(tabs.element);
+
+            triggerChipDragStart(tabs, tabGroup, chip);
+            getAnimState(tabs).currentInsertionIndex = 2;
+
+            // Hit-testing on the document stops at the shadow host; only the
+            // shadow root sees the strip. (jsdom lacks the method on shadow
+            // roots, so define it.)
+            const tabsList = (tabs as any)._tabsList as HTMLElement;
+            jest.spyOn(document, 'elementFromPoint').mockReturnValue(host);
+            Object.assign(shadowRoot, {
+                elementFromPoint: jest.fn().mockReturnValue(tabsList),
+            });
+            Object.assign(shadowRoot, {
+                elementsFromPoint: jest.fn().mockReturnValue([tabsList]),
+            });
+
+            const controller = PointerDragController.getInstance();
+            controller.beginDrag({
+                pointerEvent: new PointerEvent('pointerdown', {
+                    pointerId: 1,
+                    pointerType: 'touch',
+                }),
+                source: chip.element,
+                getData: () => ({ dispose: jest.fn() }),
+            });
+            window.dispatchEvent(
+                new PointerEvent('pointerup', {
+                    pointerId: 1,
+                    pointerType: 'touch',
+                    clientX: 100,
+                    clientY: 10,
+                })
+            );
+
+            expect(moveTabGroupMock).toHaveBeenCalledWith('tg-1', 2);
+
+            host.remove();
+        });
+
         // A group can never land inside another group: the reorder controller
         // snaps a chip drag out of any group range it falls in. The per-tab
         // overlay doesn't consult that, so it offers the plain left/right slot
```

**File**: `packages/dockview-core/src/__tests__/dom.spec.ts` (modified, +47/-0)
```diff
@@ -6,6 +6,7 @@ import {
     findRelativeZIndexParent,
     getActiveElement,
     getOverlayParent,
+    getHitTestRoot,
     isChildEntirelyVisibleWithinParent,
     isEventWithin,
     isInDocument,
@@ -650,6 +651,52 @@ describe('shadow-DOM-aware focus and overlay helpers', () => {
     });
 });
 
+describe('getHitTestRoot', () => {
+    test('returns the document for an attached light-DOM node', () => {
+        const el = document.createElement('div');
+        document.body.appendChild(el);
+
+        expect(getHitTestRoot(el)).toBe(document);
+
+        el.remove();
+    });
+
+    test('returns the shadow root for a node inside one', () => {
+        const host = document.createElement('div');
+        document.body.appendChild(host);
+        const shadowRoot = host.attachShadow({ mode: 'open' });
+        // jsdom lacks hit-testing on shadow roots; browsers have it.
+        Object.assign(shadowRoot, { elementsFromPoint: () => [] });
+        const el = document.createElement('div');
+        shadowRoot.appendChild(el);
+
+        expect(getHitTestRoot(el)).toBe(shadowRoot);
+
+        host.remove();
+    });
+
+    test('returns the owning document for a detached node', () => {
+        const parent = document.createElement('div');
+        const el = document.createElement('div');
+        parent.appendChild(el);
+
+        expect(getHitTestRoot(el)).toBe(document);
+        expect(getHitTestRoot(parent)).toBe(document);
+    });
+
+    test("returns a popout's own document", () => {
+        const iframe = document.createElement('iframe');
+        document.body.appendChild(iframe);
+        const otherDoc = iframe.contentDocument!;
+        const el = otherDoc.createElement('div');
+        otherDoc.body.appendChild(el);
+
+        expect(getHitTestRoot(el)).toBe(otherDoc);
+
+        iframe.remove();
+    });
+});
+
 describe('shadow-DOM-aware event targeting', () => {
     let outer: HTMLElement;
 
```

**File**: `packages/dockview-core/src/dnd/pointer/pointerDragController.ts` (modified, +11/-4)
```diff
@@ -1,4 +1,8 @@
-import { disableIframePointEvents, disableTextSelection } from '../../dom';
+import {
+    disableIframePointEvents,
+    disableTextSelection,
+    getHitTestRoot,
+} from '../../dom';
 import { addDisposableListener, Emitter, Event } from '../../events';
 import { CompositeDisposable, IDisposable } from '../../lifecycle';
 import { PointerGhost } from './pointerGhost';
@@ -215,9 +219,12 @@ export class PointerDragController extends CompositeDisposable {
     ): IPointerDropTargetHandle | undefined {
         // `elementsFromPoint` is topmost-first; walk up to find the closest
         // registered ancestor (so a tab beats the layout-root that contains it).
-        // Use the source's owning document so popout drags hit their own targets.
-        const sourceDoc = this._active?.source.ownerDocument ?? document;
-        const elements = sourceDoc.elementsFromPoint(x, y);
+        // Use the source's root so popout drags hit their own targets and a
+        // shadow-root mount reaches past the shadow host.
+        const root = this._active
+            ? getHitTestRoot(this._active.source)
+            : document;
+        const elements = root.elementsFromPoint(x, y);
         for (const el of elements) {
             let current: Element | null = el;
             while (current) {
```

**File**: `packages/dockview-core/src/dockview/components/titlebar/tabReorderController.ts` (modified, +9/-5)
```diff
@@ -1,5 +1,5 @@
 import { getPanelData, PanelTransfer } from '../../../dnd/dataTransfer';
-import { toggleClass } from '../../../dom';
+import { getHitTestRoot, toggleClass } from '../../../dom';
 import { CompositeDisposable, IValueDisposable } from '../../../lifecycle';
 import { DockviewComponent } from '../../dockviewComponent';
 import { DockviewGroupPanel } from '../../dockviewGroupPanel';
@@ -216,8 +216,10 @@ export class TabReorderController extends CompositeDisposable {
      * `processDragOver` / `processDragLeave` helpers.
      */
     handlePointerDragMove(clientX: number, clientY: number): void {
-        const sourceDoc = this._tabsList.ownerDocument ?? document;
-        const elAtPoint = sourceDoc.elementFromPoint(clientX, clientY);
+        const elAtPoint = getHitTestRoot(this._tabsList).elementFromPoint(
+            clientX,
+            clientY
+        );
         const inside =
             !!elAtPoint &&
             (this._tabsList.contains(elAtPoint) ||
@@ -277,8 +279,10 @@ export class TabReorderController extends CompositeDisposable {
     }
 
     private isPointInsideTabsList(clientX: number, clientY: number): boolean {
-        const doc = this._tabsList.ownerDocument ?? document;
-        const el = doc.elementFromPoint(clientX, clientY);
+        const el = getHitTestRoot(this._tabsList).elementFromPoint(
+            clientX,
+            clientY
+        );
         return !!el && this._tabsList.contains(el);
     }
 
```

---

### Incident Patch 6: `cd598fd9` (2026-09-24)
**Commit Message**: Merge remote-tracking branch 'origin/master' into fix/shadow-dom-popout-styles

# Conflicts:
#	packages/dockview-core/src/__tests__/dom.spec.ts
#	packages/dockview-core/src/dom.ts

**File**: `packages/dockview-core/src/__tests__/dnd/pointer/pointerDragController.spec.ts` (modified, +43/-0)
```diff
@@ -107,6 +107,49 @@ describe('PointerDragController', () => {
         document.body.removeChild(targetEl);
     });
 
+    test('hit-tests through the shadow root when the source is inside one', () => {
+        const controller = PointerDragController.getInstance();
+
+        const host = document.createElement('div');
+        document.body.appendChild(host);
+        const shadowRoot = host.attachShadow({ mode: 'open' });
+        const source = document.createElement('div');
+        const targetEl = document.createElement('div');
+        shadowRoot.append(source, targetEl);
+
+        // Hit-testing on the document stops at the shadow host; only the
+        // shadow root sees the target. (jsdom lacks the method on shadow
+        // roots, so define it.)
+        const documentSpy = jest
+            .spyOn(document, 'elementsFromPoint')
+            .mockReturnValue([host, document.body]);
+        Object.assign(shadowRoot, {
+            elementsFromPoint: jest
+                .fn()
+                .mockReturnValue([targetEl, host, document.body]),
+        });
+
+        const { target, handleDragOver } = makeTarget(targetEl);
+        const reg = controller.registerTarget(target);
+
+        controller.beginDrag({
+            pointerEvent: makePointerEvent('pointermove'),
+            source,
+            getData: () => ({ dispose: jest.fn() }),
+        });
+
+        window.dispatchEvent(
+            makePointerEvent('pointermove', { clientX: 50, clientY: 50 })
+        );
+
+        expect(handleDragOver).toHaveBeenCalledTimes(1);
+
+        controller.cancel();
+        reg.dispose();
+        documentSpy.mockRestore();
+        host.remove();
+    });
+
     test('drag-leave fires when the pointer moves off the target', () => {
         const controller = PointerDragController.getInstance();
 
```

**File**: `packages/dockview-core/src/__tests__/dockview/components/titlebar/tabsAnimation.spec.ts` (modified, +53/-0)
```diff
@@ -1881,6 +1881,59 @@ describe('tabs - animation', () => {
             expect(moveTabGroupMock).toHaveBeenCalledWith('tg-1', 2);
         });
 
+        test('pointer chip drag commits the group move when the strip is inside a shadow root', () => {
+            const { tabs, group, tabGroup, chip } = setupChipDrag('smooth', [
+                'panel-a',
+                'panel-b',
+                'panel-c',
+            ]);
+
+            const moveTabGroupMock = jest.fn();
+            (group.model as any).moveTabGroup = moveTabGroupMock;
+
+            const host = document.createElement('div');
+            document.body.appendChild(host);
+            const shadowRoot = host.attachShadow({ mode: 'open' });
+            shadowRoot.appendChild(tabs.element);
+
+            triggerChipDragStart(tabs, tabGroup, chip);
+            getAnimState(tabs).currentInsertionIndex = 2;
+
+            // Hit-testing on the document stops at the shadow host; only the
+            // shadow root sees the strip. (jsdom lacks the method on shadow
+            // roots, so define it.)
+            const tabsList = (tabs as any)._tabsList as HTMLElement;
+            jest.spyOn(document, 'elementFromPoint').mockReturnValue(host);
+            Object.assign(shadowRoot, {
+                elementFromPoint: jest.fn().mockReturnValue(tabsList),
+            });
+            Object.assign(shadowRoot, {
+                elementsFromPoint: jest.fn().mockReturnValue([tabsList]),
+            });
+
+            const controller = PointerDragController.getInstance();
+            controller.beginDrag({
+                pointerEvent: new PointerEvent('pointerdown', {
+                    pointerId: 1,
+                    pointerType: 'touch',
+                }),
+                source: chip.element,
+                getData: () => ({ dispose: jest.fn() }),
+            });
+            window.dispatchEvent(
+                new PointerEvent('pointerup', {
+                    pointerId: 1,
+                    pointerType: 'touch',
+                    clientX: 100,
+                    clientY: 10,
+                })
+            );
+
+            expect(moveTabGroupMock).toHaveBeenCalledWith('tg-1', 2);
+
+            host.remove();
+        });
+
         // A group can never land inside another group: the reorder controller
         // snaps a chip drag out of any group range it falls in. The per-tab
         // overlay doesn't consult that, so it offers the plain left/right slot
```

**File**: `packages/dockview-core/src/__tests__/dom.spec.ts` (modified, +47/-0)
```diff
@@ -5,6 +5,7 @@ import {
     disableTextSelection,
     findRelativeZIndexParent,
     getDockviewTheme,
+    getHitTestRoot,
     isChildEntirelyVisibleWithinParent,
     isEventWithin,
     isInDocument,
@@ -592,6 +593,52 @@ describe('addStyles and getDockviewTheme across a shadow boundary', () => {
     });
 });
 
+describe('getHitTestRoot', () => {
+    test('returns the document for an attached light-DOM node', () => {
+        const el = document.createElement('div');
+        document.body.appendChild(el);
+
+        expect(getHitTestRoot(el)).toBe(document);
+
+        el.remove();
+    });
+
+    test('returns the shadow root for a node inside one', () => {
+        const host = document.createElement('div');
+        document.body.appendChild(host);
+        const shadowRoot = host.attachShadow({ mode: 'open' });
+        // jsdom lacks hit-testing on shadow roots; browsers have it.
+        Object.assign(shadowRoot, { elementsFromPoint: () => [] });
+        const el = document.createElement('div');
+        shadowRoot.appendChild(el);
+
+        expect(getHitTestRoot(el)).toBe(shadowRoot);
+
+        host.remove();
+    });
+
+    test('returns the owning document for a detached node', () => {
+        const parent = document.createElement('div');
+        const el = document.createElement('div');
+        parent.appendChild(el);
+
+        expect(getHitTestRoot(el)).toBe(document);
+        expect(getHitTestRoot(parent)).toBe(document);
+    });
+
+    test("returns a popout's own document", () => {
+        const iframe = document.createElement('iframe');
+        document.body.appendChild(iframe);
+        const otherDoc = iframe.contentDocument!;
+        const el = otherDoc.createElement('div');
+        otherDoc.body.appendChild(el);
+
+        expect(getHitTestRoot(el)).toBe(otherDoc);
+
+        iframe.remove();
+    });
+});
+
 describe('shadow-DOM-aware event targeting', () => {
     let outer: HTMLElement;
 
```

**File**: `packages/dockview-core/src/dnd/pointer/pointerDragController.ts` (modified, +11/-4)
```diff
@@ -1,4 +1,8 @@
-import { disableIframePointEvents, disableTextSelection } from '../../dom';
+import {
+    disableIframePointEvents,
+    disableTextSelection,
+    getHitTestRoot,
+} from '../../dom';
 import { addDisposableListener, Emitter, Event } from '../../events';
 import { CompositeDisposable, IDisposable } from '../../lifecycle';
 import { PointerGhost } from './pointerGhost';
@@ -215,9 +219,12 @@ export class PointerDragController extends CompositeDisposable {
     ): IPointerDropTargetHandle | undefined {
         // `elementsFromPoint` is topmost-first; walk up to find the closest
         // registered ancestor (so a tab beats the layout-root that contains it).
-        // Use the source's owning document so popout drags hit their own targets.
-        const sourceDoc = this._active?.source.ownerDocument ?? document;
-        const elements = sourceDoc.elementsFromPoint(x, y);
+        // Use the source's root so popout drags hit their own targets and a
+        // shadow-root mount reaches past the shadow host.
+        const root = this._active
+            ? getHitTestRoot(this._active.source)
+            : document;
+        const elements = root.elementsFromPoint(x, y);
         for (const el of elements) {
             let current: Element | null = el;
             while (current) {
```

**File**: `packages/dockview-core/src/dockview/components/titlebar/tabReorderController.ts` (modified, +9/-5)
```diff
@@ -1,5 +1,5 @@
 import { getPanelData, PanelTransfer } from '../../../dnd/dataTransfer';
-import { toggleClass } from '../../../dom';
+import { getHitTestRoot, toggleClass } from '../../../dom';
 import { CompositeDisposable, IValueDisposable } from '../../../lifecycle';
 import { DockviewComponent } from '../../dockviewComponent';
 import { DockviewGroupPanel } from '../../dockviewGroupPanel';
@@ -216,8 +216,10 @@ export class TabReorderController extends CompositeDisposable {
      * `processDragOver` / `processDragLeave` helpers.
      */
     handlePointerDragMove(clientX: number, clientY: number): void {
-        const sourceDoc = this._tabsList.ownerDocument ?? document;
-        const elAtPoint = sourceDoc.elementFromPoint(clientX, clientY);
+        const elAtPoint = getHitTestRoot(this._tabsList).elementFromPoint(
+            clientX,
+            clientY
+        );
         const inside =
             !!elAtPoint &&
             (this._tabsList.contains(elAtPoint) ||
@@ -277,8 +279,10 @@ export class TabReorderController extends CompositeDisposable {
     }
 
     private isPointInsideTabsList(clientX: number, clientY: number): boolean {
-        const doc = this._tabsList.ownerDocument ?? document;
-        const el = doc.elementFromPoint(clientX, clientY);
+        const el = getHitTestRoot(this._tabsList).elementFromPoint(
+            clientX,
+            clientY
+        );
         return !!el && this._tabsList.contains(el);
     }
 
```

---

### Incident Patch 7: `cbf5e86d` (2026-09-24)
**Commit Message**: Merge pull request #1653 from dockview/fix/shadow-dom-pointer-dnd

fix(core): touch drag-and-drop does nothing when dockview is inside a shadow root

**File**: `packages/dockview-core/src/__tests__/dnd/pointer/pointerDragController.spec.ts` (modified, +43/-0)
```diff
@@ -107,6 +107,49 @@ describe('PointerDragController', () => {
         document.body.removeChild(targetEl);
     });
 
+    test('hit-tests through the shadow root when the source is inside one', () => {
+        const controller = PointerDragController.getInstance();
+
+        const host = document.createElement('div');
+        document.body.appendChild(host);
+        const shadowRoot = host.attachShadow({ mode: 'open' });
+        const source = document.createElement('div');
+        const targetEl = document.createElement('div');
+        shadowRoot.append(source, targetEl);
+
+        // Hit-testing on the document stops at the shadow host; only the
+        // shadow root sees the target. (jsdom lacks the method on shadow
+        // roots, so define it.)
+        const documentSpy = jest
+            .spyOn(document, 'elementsFromPoint')
+            .mockReturnValue([host, document.body]);
+        Object.assign(shadowRoot, {
+            elementsFromPoint: jest
+                .fn()
+                .mockReturnValue([targetEl, host, document.body]),
+        });
+
+        const { target, handleDragOver } = makeTarget(targetEl);
+        const reg = controller.registerTarget(target);
+
+        controller.beginDrag({
+            pointerEvent: makePointerEvent('pointermove'),
+            source,
+            getData: () => ({ dispose: jest.fn() }),
+        });
+
+        window.dispatchEvent(
+            makePointerEvent('pointermove', { clientX: 50, clientY: 50 })
+        );
+
+        expect(handleDragOver).toHaveBeenCalledTimes(1);
+
+        controller.cancel();
+        reg.dispose();
+        documentSpy.mockRestore();
+        host.remove();
+    });
+
     test('drag-leave fires when the pointer moves off the target', () => {
         const controller = PointerDragController.getInstance();
 
```

**File**: `packages/dockview-core/src/__tests__/dockview/components/titlebar/tabsAnimation.spec.ts` (modified, +53/-0)
```diff
@@ -1881,6 +1881,59 @@ describe('tabs - animation', () => {
             expect(moveTabGroupMock).toHaveBeenCalledWith('tg-1', 2);
         });
 
+        test('pointer chip drag commits the group move when the strip is inside a shadow root', () => {
+            const { tabs, group, tabGroup, chip } = setupChipDrag('smooth', [
+                'panel-a',
+                'panel-b',
+                'panel-c',
+            ]);
+
+            const moveTabGroupMock = jest.fn();
+            (group.model as any).moveTabGroup = moveTabGroupMock;
+
+            const host = document.createElement('div');
+            document.body.appendChild(host);
+            const shadowRoot = host.attachShadow({ mode: 'open' });
+            shadowRoot.appendChild(tabs.element);
+
+            triggerChipDragStart(tabs, tabGroup, chip);
+            getAnimState(tabs).currentInsertionIndex = 2;
+
+            // Hit-testing on the document stops at the shadow host; only the
+            // shadow root sees the strip. (jsdom lacks the method on shadow
+            // roots, so define it.)
+            const tabsList = (tabs as any)._tabsList as HTMLElement;
+            jest.spyOn(document, 'elementFromPoint').mockReturnValue(host);
+            Object.assign(shadowRoot, {
+                elementFromPoint: jest.fn().mockReturnValue(tabsList),
+            });
+            Object.assign(shadowRoot, {
+                elementsFromPoint: jest.fn().mockReturnValue([tabsList]),
+            });
+
+            const controller = PointerDragController.getInstance();
+            controller.beginDrag({
+                pointerEvent: new PointerEvent('pointerdown', {
+                    pointerId: 1,
+                    pointerType: 'touch',
+                }),
+                source: chip.element,
+                getData: () => ({ dispose: jest.fn() }),
+            });
+            window.dispatchEvent(
+                new PointerEvent('pointerup', {
+                    pointerId: 1,
+                    pointerType: 'touch',
+                    clientX: 100,
+                    clientY: 10,
+                })
+            );
+
+            expect(moveTabGroupMock).toHaveBeenCalledWith('tg-1', 2);
+
+            host.remove();
+        });
+
         // A group can never land inside another group: the reorder controller
         // snaps a chip drag out of any group range it falls in. The per-tab
         // overlay doesn't consult that, so it offers the plain left/right slot
```

**File**: `packages/dockview-core/src/__tests__/dom.spec.ts` (modified, +47/-0)
```diff
@@ -4,6 +4,7 @@ import {
     disableIframePointEvents,
     disableTextSelection,
     findRelativeZIndexParent,
+    getHitTestRoot,
     isChildEntirelyVisibleWithinParent,
     isEventWithin,
     isInDocument,
@@ -540,6 +541,52 @@ describe('onDidWindowMoveEnd', () => {
     });
 });
 
+describe('getHitTestRoot', () => {
+    test('returns the document for an attached light-DOM node', () => {
+        const el = document.createElement('div');
+        document.body.appendChild(el);
+
+        expect(getHitTestRoot(el)).toBe(document);
+
+        el.remove();
+    });
+
+    test('returns the shadow root for a node inside one', () => {
+        const host = document.createElement('div');
+        document.body.appendChild(host);
+        const shadowRoot = host.attachShadow({ mode: 'open' });
+        // jsdom lacks hit-testing on shadow roots; browsers have it.
+        Object.assign(shadowRoot, { elementsFromPoint: () => [] });
+        const el = document.createElement('div');
+        shadowRoot.appendChild(el);
+
+        expect(getHitTestRoot(el)).toBe(shadowRoot);
+
+        host.remove();
+    });
+
+    test('returns the owning document for a detached node', () => {
+        const parent = document.createElement('div');
+        const el = document.createElement('div');
+        parent.appendChild(el);
+
+        expect(getHitTestRoot(el)).toBe(document);
+        expect(getHitTestRoot(parent)).toBe(document);
+    });
+
+    test("returns a popout's own document", () => {
+        const iframe = document.createElement('iframe');
+        document.body.appendChild(iframe);
+        const otherDoc = iframe.contentDocument!;
+        const el = otherDoc.createElement('div');
+        otherDoc.body.appendChild(el);
+
+        expect(getHitTestRoot(el)).toBe(otherDoc);
+
+        iframe.remove();
+    });
+});
+
 describe('shadow-DOM-aware event targeting', () => {
     let outer: HTMLElement;
 
```

**File**: `packages/dockview-core/src/dnd/pointer/pointerDragController.ts` (modified, +11/-4)
```diff
@@ -1,4 +1,8 @@
-import { disableIframePointEvents, disableTextSelection } from '../../dom';
+import {
+    disableIframePointEvents,
+    disableTextSelection,
+    getHitTestRoot,
+} from '../../dom';
 import { addDisposableListener, Emitter, Event } from '../../events';
 import { CompositeDisposable, IDisposable } from '../../lifecycle';
 import { PointerGhost } from './pointerGhost';
@@ -215,9 +219,12 @@ export class PointerDragController extends CompositeDisposable {
     ): IPointerDropTargetHandle | undefined {
         // `elementsFromPoint` is topmost-first; walk up to find the closest
         // registered ancestor (so a tab beats the layout-root that contains it).
-        // Use the source's owning document so popout drags hit their own targets.
-        const sourceDoc = this._active?.source.ownerDocument ?? document;
-        const elements = sourceDoc.elementsFromPoint(x, y);
+        // Use the source's root so popout drags hit their own targets and a
+        // shadow-root mount reaches past the shadow host.
+        const root = this._active
+            ? getHitTestRoot(this._active.source)
+            : document;
+        const elements = root.elementsFromPoint(x, y);
         for (const el of elements) {
             let current: Element | null = el;
             while (current) {
```

**File**: `packages/dockview-core/src/dockview/components/titlebar/tabReorderController.ts` (modified, +9/-5)
```diff
@@ -1,5 +1,5 @@
 import { getPanelData, PanelTransfer } from '../../../dnd/dataTransfer';
-import { toggleClass } from '../../../dom';
+import { getHitTestRoot, toggleClass } from '../../../dom';
 import { CompositeDisposable, IValueDisposable } from '../../../lifecycle';
 import { DockviewComponent } from '../../dockviewComponent';
 import { DockviewGroupPanel } from '../../dockviewGroupPanel';
@@ -216,8 +216,10 @@ export class TabReorderController extends CompositeDisposable {
      * `processDragOver` / `processDragLeave` helpers.
      */
     handlePointerDragMove(clientX: number, clientY: number): void {
-        const sourceDoc = this._tabsList.ownerDocument ?? document;
-        const elAtPoint = sourceDoc.elementFromPoint(clientX, clientY);
+        const elAtPoint = getHitTestRoot(this._tabsList).elementFromPoint(
+            clientX,
+            clientY
+        );
         const inside =
             !!elAtPoint &&
             (this._tabsList.contains(elAtPoint) ||
@@ -277,8 +279,10 @@ export class TabReorderController extends CompositeDisposable {
     }
 
     private isPointInsideTabsList(clientX: number, clientY: number): boolean {
-        const doc = this._tabsList.ownerDocument ?? document;
-        const el = doc.elementFromPoint(clientX, clientY);
+        const el = getHitTestRoot(this._tabsList).elementFromPoint(
+            clientX,
+            clientY
+        );
         return !!el && this._tabsList.contains(el);
     }
 
```

---

### Incident Patch 8: `1fe2f138` (2026-09-24)
**Commit Message**: Merge remote-tracking branch 'origin/master' into fix/shadow-dom-focus-and-ghosts

# Conflicts:
#	packages/dockview-core/src/__tests__/dom.spec.ts

**File**: `packages/dockview-core/src/__tests__/dismissableLayer.spec.ts` (modified, +252/-0)
```diff
@@ -156,4 +156,256 @@ describe('createDismissableLayer', () => {
 
         layer.dispose();
     });
+
+    test('pointerdown and focusin inside a shadow root count as inside', () => {
+        const host = document.createElement('div');
+        document.body.appendChild(host);
+        const root = host.attachShadow({ mode: 'open' });
+        const menu = document.createElement('div');
+        const item = document.createElement('button');
+        menu.appendChild(item);
+        root.appendChild(menu);
+
+        const onDismiss = jest.fn();
+        const onInsidePointerDown = jest.fn();
+        const layer = createDismissableLayer({
+            onDismiss,
+            onInsidePointerDown,
+            focusOut: true,
+            elements: () => [menu],
+        });
+
+        item.dispatchEvent(
+            new MouseEvent('pointerdown', { bubbles: true, composed: true })
+        );
+        item.dispatchEvent(
+            new FocusEvent('focusin', { bubbles: true, composed: true })
+        );
+        expect(onInsidePointerDown).toHaveBeenCalledTimes(1);
+        expect(onDismiss).not.toHaveBeenCalled();
+
+        pointerdownOn(outside);
+        expect(onDismiss).toHaveBeenCalledTimes(1);
+
+        layer.dispose();
+        host.remove();
+    });
+
+    // Regression guard: this layout already worked through retargeting; the
+    // composed-path check must keep it working.
+    test('pointerdown and focusin inside a web component within the layer count as inside', () => {
+        const host = document.createElement('div');
+        inside.appendChild(host);
+        const root = host.attachShadow({ mode: 'open' });
+        const item = document.createElement('button');
+        root.appendChild(item);
+
+        const onDismiss = jest.fn();
+        const onInsidePointerDown = jest.fn();
+        const layer = createDismissableLayer({
+            onDismiss,
+            onInsidePointerDown,
+            focusOut: true,
+            elements: () => [inside],
+        });
+
+        item.dispatchEvent(
+            new MouseEvent('pointerdown', { bubbles: true, composed: true })
+        );
+        item.dispatchEvent(
+            new FocusEvent('focusin', { bubbles: true, composed: true })
+        );
+        expect(onInsidePointerDown).toHaveBeenCalledTimes(1);
+        expect(onDismiss).not.toHaveBeenCalled();
+
+        pointerdownOn(outside);
+        expect(onDismiss).toHaveBeenCalledTimes(1);
+
+        layer.dispose();
+    });
+
+    test('focusOut sees focus moving within the shadow root the layer lives in', () => {
+        const host = document.createElement('div');
+        document.body.appendChild(host);
+        const shadowRoot = host.attachShadow({ mode: 'open' });
+        const menu = document.createElement('div');
+        const item = document.createElement('button');
+        menu.appendChild(item);
+        const elsewhere = document.createElement('button');
+        shadowRoot.append(menu, elsewhere);
+
+        const onDismiss = jest.fn();
+        const layer = createDismissableLayer({
+            onDismiss,
+            focusOut: true,
+            elements: () => [menu],
+        });
+
+        // Entering the shadow root reaches both the root and the window
+        // listeners; it must count once, as inside.
+        item.focus();
+        expect(onDismiss).not.toHaveBeenCalled();
+
+        // A move within the root never reaches the window.
+        elsewhere.focus();
+        expect(onDismiss).toHaveBeenCalledTimes(1);
+
+        layer.dispose();
+        host.remove();
+    });
+
+    test('a custom isFocusInside gets the focus target as the window sees it', () => {
+        const panel = document.createElement('div');
+        document.body.appendChild(panel);
+        const componentHost = document.createElement('div');
+        panel.appendChild(componentHost);
+        const input = document.createElement('input');
+        componentHost.attachShadow({ mode: 'ope
```

**File**: `packages/dockview-core/src/__tests__/dnd/pointer/longPress.spec.ts` (modified, +33/-0)
```diff
@@ -219,6 +219,39 @@ describe('LongPressDetector', () => {
         document.body.removeChild(other);
     });
 
+    test('suppresses the synthesised click when the source is inside a shadow root', () => {
+        jest.useFakeTimers();
+        const host = document.createElement('div');
+        document.body.appendChild(host);
+        const element = document.createElement('div');
+        host.attachShadow({ mode: 'open' }).appendChild(element);
+
+        const onClick = jest.fn();
+        element.addEventListener('click', onClick);
+
+        const cut = new LongPressDetector(element, {
+            onLongPress: jest.fn(),
+            delay: 500,
+        });
+
+        fireEvent.pointerDown(element, pointerInit({ composed: true }));
+        jest.advanceTimersByTime(500);
+
+        // The window-level guard sees this click retargeted to the shadow
+        // host; it must still recognise it as a click on the source.
+        const click = new MouseEvent('click', {
+            bubbles: true,
+            cancelable: true,
+            composed: true,
+        });
+        element.dispatchEvent(click);
+        expect(click.defaultPrevented).toBe(true);
+        expect(onClick).not.toHaveBeenCalled();
+
+        cut.dispose();
+        document.body.removeChild(host);
+    });
+
     test('contextmenu guard self-disposes after the first event', () => {
         jest.useFakeTimers();
         const element = document.createElement('div');
```

**File**: `packages/dockview-core/src/__tests__/dom.spec.ts` (modified, +83/-0)
```diff
@@ -7,6 +7,7 @@ import {
     getActiveElement,
     getOverlayParent,
     isChildEntirelyVisibleWithinParent,
+    isEventWithin,
     isInDocument,
     onDidWindowMoveEnd,
     prefersReducedMotion,
@@ -648,3 +649,85 @@ describe('shadow-DOM-aware focus and overlay helpers', () => {
         tracker.dispose();
     });
 });
+
+describe('shadow-DOM-aware event targeting', () => {
+    let outer: HTMLElement;
+
+    beforeEach(() => {
+        outer = document.createElement('div');
+        document.body.appendChild(outer);
+    });
+
+    afterEach(() => {
+        outer.remove();
+    });
+
+    /** Dispatches a composed event from `from` and runs `fn` while a window
+     *  listener sees it, where the target has been retargeted. */
+    const observeOnWindow = <T>(from: Element, fn: (e: Event) => T): T => {
+        let result: T | undefined;
+        const listener = (e: Event) => {
+            result = fn(e);
+        };
+        window.addEventListener('pointerdown', listener);
+        from.dispatchEvent(
+            new Event('pointerdown', { bubbles: true, composed: true })
+        );
+        window.removeEventListener('pointerdown', listener);
+        return result as T;
+    };
+
+    const shadowChild = (host: HTMLElement): HTMLElement => {
+        const root = host.attachShadow({ mode: 'open' });
+        const child = document.createElement('button');
+        root.appendChild(child);
+        return child;
+    };
+
+    test('isEventWithin: element inside a shadow root', () => {
+        const container = document.createElement('div');
+        const root = outer.attachShadow({ mode: 'open' });
+        root.appendChild(container);
+        const child = document.createElement('button');
+        container.appendChild(child);
+        const other = document.createElement('div');
+        root.appendChild(other);
+
+        expect(
+            observeOnWindow(child, (e) => isEventWithin(e, [container]))
+        ).toBe(true);
+        expect(
+            observeOnWindow(other, (e) => isEventWithin(e, [container]))
+        ).toBe(false);
+    });
+
+    test('isEventWithin: element containing a web component', () => {
+        const host = document.createElement('div');
+        outer.appendChild(host);
+        const child = shadowChild(host);
+        const sibling = document.createElement('div');
+        document.body.appendChild(sibling);
+
+        expect(observeOnWindow(child, (e) => isEventWithin(e, [outer]))).toBe(
+            true
+        );
+        expect(observeOnWindow(child, (e) => isEventWithin(e, [sibling]))).toBe(
+            false
+        );
+
+        sibling.remove();
+    });
+
+    test('isEventWithin falls back to contains without a composed path', () => {
+        const child = document.createElement('span');
+        outer.appendChild(child);
+        const event = new Event('pointerdown');
+        Object.defineProperty(event, 'composedPath', { value: undefined });
+        Object.defineProperty(event, 'target', { value: child });
+
+        expect(isEventWithin(event, [outer])).toBe(true);
+        expect(isEventWithin(event, [document.createElement('div')])).toBe(
+            false
+        );
+    });
+});
```

**File**: `packages/dockview-core/src/dismissableLayer.ts` (modified, +93/-27)
```diff
@@ -1,3 +1,4 @@
+import { isEventWithin, retargetToDocument, shadowRootsOf } from './dom';
 import { addDisposableListener } from './events';
 import { CompositeDisposable, IDisposable } from './lifecycle';
 
@@ -22,8 +23,8 @@ export interface DismissableLayerOptions {
     /** A pointerdown landed *inside* the layer (not a dismissal). Use it to
      *  mark interaction (e.g. make a transient layer sticky). */
     readonly onInsidePointerDown?: (event: PointerEvent) => void;
-    /** Whether a pointer event is inside the layer. Defaults to a DOM
-     *  `contains` check against {@link DismissableLayerOptions.elements}.
+    /** Whether a pointer event is inside the layer. Defaults to checking the
+     *  event's composed path against {@link DismissableLayerOptions.elements}.
      *  Provide this for geometry-based hit testing (e.g. when the visible
      *  content is a sibling overlay stacked on top of the layer). */
     readonly isInside?: (event: PointerEvent) => boolean;
@@ -46,9 +47,13 @@ export interface DismissableLayerOptions {
      *  `false`): the "slide back on focus loss" behaviour. */
     readonly focusOut?: boolean;
     /** Whether a newly-focused element is inside the layer (for
-     *  {@link focusOut}). Defaults to a `contains` check against
-     *  {@link elements}. Provide this for geometry-based testing when the
-     *  content is a sibling overlay stacked on top of the layer. */
+     *  {@link focusOut}). Always receives the target as a document-level
+     *  listener sees it, so focus inside a shadow root arrives as that root's
+     *  host however the event reached us — a `contains` predicate written
+     *  against the light DOM keeps working. Defaults to checking the event's
+     *  composed path against {@link elements}. Provide this for geometry-based
+     *  testing when the content is a sibling overlay stacked on top of the
+     *  layer. */
     readonly isFocusInside?: (focused: Element) => boolean;
     /** Listen in the capture phase (default `false`). Use capture when the
      *  layer must see the event before content handlers stop its propagation. */
@@ -62,8 +67,8 @@ export interface DismissableLayerOptions {
  * peeks): while it lives it watches a configurable set of dismiss signals
  * (Escape / extra keys, outside-pointerdown with an optional grace window,
  * window resize, focus moving outside) and calls `onDismiss`. Inside/outside is
- * decided by an `isInside` predicate (geometry) or a `contains` check against
- * `elements`. Dispose to detach every listener.
+ * decided by an `isInside` predicate (geometry) or by checking the event's
+ * composed path against `elements`. Dispose to detach every listener.
  *
  * It owns only the *signals*, not the surface element, its position, or any
  * hover/keep-open policy, so callers keep their own element lifecycle and
@@ -87,11 +92,7 @@ export function createDismissableLayer(
         if (options.isInside) {
             return options.isInside(event);
         }
-        const target = event.target;
-        if (!(target instanceof Node)) {
-            return false;
-        }
-        return (options.elements?.() ?? []).some((el) => el.contains(target));
+        return isEventWithin(event, options.elements?.() ?? []);
     };
 
     if (escape || keys.length > 0) {
@@ -144,27 +145,92 @@ export function createDismissableLayer(
     }
 
     if (options.focusOut) {
-        const isFocusInside = (focused: Element): boolean => {
-            if (options.isFocusInside) {
-                return options.isFocusInside(focused);
-            }
-            return (options.elements?.() ?? []).some((el) =>
-                el.contains(focused)
-            );
-        };
         // `focusin` bubbles to the window; capture so it's seen regardless of
-        // content handlers.
+        // content handlers. A focus move *within* a shadow root never reaches
+        // the window (the event is retargeted to the host and its p
```

**File**: `packages/dockview-core/src/dnd/pointer/longPress.ts` (modified, +2/-2)
```diff
@@ -1,3 +1,4 @@
+import { isEventWithin } from '../../dom';
 import { addDisposableListener } from '../../events';
 import { CompositeDisposable, IDisposable } from '../../lifecycle';
 
@@ -151,8 +152,7 @@ export class LongPressDetector extends CompositeDisposable {
                 // Only suppress clicks targeted at the long-pressed element
                 // or its descendants. A user tap on a context menu item (or
                 // anywhere else) still gets through unchanged.
-                const target = event.target as Node | null;
-                if (target && this.element.contains(target)) {
+                if (isEventWithin(event, [this.element])) {
                     event.preventDefault();
                     event.stopPropagation();
                 }
```

---

### Incident Patch 9: `4fc90eb0` (2026-09-24)
**Commit Message**: Merge remote-tracking branch 'origin/master' into fix/shadow-dom-popout-styles

# Conflicts:
#	packages/dockview-core/src/__tests__/dom.spec.ts

**File**: `packages/dockview-core/src/__tests__/dismissableLayer.spec.ts` (modified, +252/-0)
```diff
@@ -156,4 +156,256 @@ describe('createDismissableLayer', () => {
 
         layer.dispose();
     });
+
+    test('pointerdown and focusin inside a shadow root count as inside', () => {
+        const host = document.createElement('div');
+        document.body.appendChild(host);
+        const root = host.attachShadow({ mode: 'open' });
+        const menu = document.createElement('div');
+        const item = document.createElement('button');
+        menu.appendChild(item);
+        root.appendChild(menu);
+
+        const onDismiss = jest.fn();
+        const onInsidePointerDown = jest.fn();
+        const layer = createDismissableLayer({
+            onDismiss,
+            onInsidePointerDown,
+            focusOut: true,
+            elements: () => [menu],
+        });
+
+        item.dispatchEvent(
+            new MouseEvent('pointerdown', { bubbles: true, composed: true })
+        );
+        item.dispatchEvent(
+            new FocusEvent('focusin', { bubbles: true, composed: true })
+        );
+        expect(onInsidePointerDown).toHaveBeenCalledTimes(1);
+        expect(onDismiss).not.toHaveBeenCalled();
+
+        pointerdownOn(outside);
+        expect(onDismiss).toHaveBeenCalledTimes(1);
+
+        layer.dispose();
+        host.remove();
+    });
+
+    // Regression guard: this layout already worked through retargeting; the
+    // composed-path check must keep it working.
+    test('pointerdown and focusin inside a web component within the layer count as inside', () => {
+        const host = document.createElement('div');
+        inside.appendChild(host);
+        const root = host.attachShadow({ mode: 'open' });
+        const item = document.createElement('button');
+        root.appendChild(item);
+
+        const onDismiss = jest.fn();
+        const onInsidePointerDown = jest.fn();
+        const layer = createDismissableLayer({
+            onDismiss,
+            onInsidePointerDown,
+            focusOut: true,
+            elements: () => [inside],
+        });
+
+        item.dispatchEvent(
+            new MouseEvent('pointerdown', { bubbles: true, composed: true })
+        );
+        item.dispatchEvent(
+            new FocusEvent('focusin', { bubbles: true, composed: true })
+        );
+        expect(onInsidePointerDown).toHaveBeenCalledTimes(1);
+        expect(onDismiss).not.toHaveBeenCalled();
+
+        pointerdownOn(outside);
+        expect(onDismiss).toHaveBeenCalledTimes(1);
+
+        layer.dispose();
+    });
+
+    test('focusOut sees focus moving within the shadow root the layer lives in', () => {
+        const host = document.createElement('div');
+        document.body.appendChild(host);
+        const shadowRoot = host.attachShadow({ mode: 'open' });
+        const menu = document.createElement('div');
+        const item = document.createElement('button');
+        menu.appendChild(item);
+        const elsewhere = document.createElement('button');
+        shadowRoot.append(menu, elsewhere);
+
+        const onDismiss = jest.fn();
+        const layer = createDismissableLayer({
+            onDismiss,
+            focusOut: true,
+            elements: () => [menu],
+        });
+
+        // Entering the shadow root reaches both the root and the window
+        // listeners; it must count once, as inside.
+        item.focus();
+        expect(onDismiss).not.toHaveBeenCalled();
+
+        // A move within the root never reaches the window.
+        elsewhere.focus();
+        expect(onDismiss).toHaveBeenCalledTimes(1);
+
+        layer.dispose();
+        host.remove();
+    });
+
+    test('a custom isFocusInside gets the focus target as the window sees it', () => {
+        const panel = document.createElement('div');
+        document.body.appendChild(panel);
+        const componentHost = document.createElement('div');
+        panel.appendChild(componentHost);
+        const input = document.createElement('input');
+        componentHost.attachShadow({ mode: 'ope
```

**File**: `packages/dockview-core/src/__tests__/dnd/pointer/longPress.spec.ts` (modified, +33/-0)
```diff
@@ -219,6 +219,39 @@ describe('LongPressDetector', () => {
         document.body.removeChild(other);
     });
 
+    test('suppresses the synthesised click when the source is inside a shadow root', () => {
+        jest.useFakeTimers();
+        const host = document.createElement('div');
+        document.body.appendChild(host);
+        const element = document.createElement('div');
+        host.attachShadow({ mode: 'open' }).appendChild(element);
+
+        const onClick = jest.fn();
+        element.addEventListener('click', onClick);
+
+        const cut = new LongPressDetector(element, {
+            onLongPress: jest.fn(),
+            delay: 500,
+        });
+
+        fireEvent.pointerDown(element, pointerInit({ composed: true }));
+        jest.advanceTimersByTime(500);
+
+        // The window-level guard sees this click retargeted to the shadow
+        // host; it must still recognise it as a click on the source.
+        const click = new MouseEvent('click', {
+            bubbles: true,
+            cancelable: true,
+            composed: true,
+        });
+        element.dispatchEvent(click);
+        expect(click.defaultPrevented).toBe(true);
+        expect(onClick).not.toHaveBeenCalled();
+
+        cut.dispose();
+        document.body.removeChild(host);
+    });
+
     test('contextmenu guard self-disposes after the first event', () => {
         jest.useFakeTimers();
         const element = document.createElement('div');
```

**File**: `packages/dockview-core/src/__tests__/dom.spec.ts` (modified, +83/-0)
```diff
@@ -6,6 +6,7 @@ import {
     findRelativeZIndexParent,
     getDockviewTheme,
     isChildEntirelyVisibleWithinParent,
+    isEventWithin,
     isInDocument,
     isShadowRoot,
     onDidWindowMoveEnd,
@@ -590,3 +591,85 @@ describe('addStyles and getDockviewTheme across a shadow boundary', () => {
         host.remove();
     });
 });
+
+describe('shadow-DOM-aware event targeting', () => {
+    let outer: HTMLElement;
+
+    beforeEach(() => {
+        outer = document.createElement('div');
+        document.body.appendChild(outer);
+    });
+
+    afterEach(() => {
+        outer.remove();
+    });
+
+    /** Dispatches a composed event from `from` and runs `fn` while a window
+     *  listener sees it, where the target has been retargeted. */
+    const observeOnWindow = <T>(from: Element, fn: (e: Event) => T): T => {
+        let result: T | undefined;
+        const listener = (e: Event) => {
+            result = fn(e);
+        };
+        window.addEventListener('pointerdown', listener);
+        from.dispatchEvent(
+            new Event('pointerdown', { bubbles: true, composed: true })
+        );
+        window.removeEventListener('pointerdown', listener);
+        return result as T;
+    };
+
+    const shadowChild = (host: HTMLElement): HTMLElement => {
+        const root = host.attachShadow({ mode: 'open' });
+        const child = document.createElement('button');
+        root.appendChild(child);
+        return child;
+    };
+
+    test('isEventWithin: element inside a shadow root', () => {
+        const container = document.createElement('div');
+        const root = outer.attachShadow({ mode: 'open' });
+        root.appendChild(container);
+        const child = document.createElement('button');
+        container.appendChild(child);
+        const other = document.createElement('div');
+        root.appendChild(other);
+
+        expect(
+            observeOnWindow(child, (e) => isEventWithin(e, [container]))
+        ).toBe(true);
+        expect(
+            observeOnWindow(other, (e) => isEventWithin(e, [container]))
+        ).toBe(false);
+    });
+
+    test('isEventWithin: element containing a web component', () => {
+        const host = document.createElement('div');
+        outer.appendChild(host);
+        const child = shadowChild(host);
+        const sibling = document.createElement('div');
+        document.body.appendChild(sibling);
+
+        expect(observeOnWindow(child, (e) => isEventWithin(e, [outer]))).toBe(
+            true
+        );
+        expect(observeOnWindow(child, (e) => isEventWithin(e, [sibling]))).toBe(
+            false
+        );
+
+        sibling.remove();
+    });
+
+    test('isEventWithin falls back to contains without a composed path', () => {
+        const child = document.createElement('span');
+        outer.appendChild(child);
+        const event = new Event('pointerdown');
+        Object.defineProperty(event, 'composedPath', { value: undefined });
+        Object.defineProperty(event, 'target', { value: child });
+
+        expect(isEventWithin(event, [outer])).toBe(true);
+        expect(isEventWithin(event, [document.createElement('div')])).toBe(
+            false
+        );
+    });
+});
```

**File**: `packages/dockview-core/src/dismissableLayer.ts` (modified, +93/-27)
```diff
@@ -1,3 +1,4 @@
+import { isEventWithin, retargetToDocument, shadowRootsOf } from './dom';
 import { addDisposableListener } from './events';
 import { CompositeDisposable, IDisposable } from './lifecycle';
 
@@ -22,8 +23,8 @@ export interface DismissableLayerOptions {
     /** A pointerdown landed *inside* the layer (not a dismissal). Use it to
      *  mark interaction (e.g. make a transient layer sticky). */
     readonly onInsidePointerDown?: (event: PointerEvent) => void;
-    /** Whether a pointer event is inside the layer. Defaults to a DOM
-     *  `contains` check against {@link DismissableLayerOptions.elements}.
+    /** Whether a pointer event is inside the layer. Defaults to checking the
+     *  event's composed path against {@link DismissableLayerOptions.elements}.
      *  Provide this for geometry-based hit testing (e.g. when the visible
      *  content is a sibling overlay stacked on top of the layer). */
     readonly isInside?: (event: PointerEvent) => boolean;
@@ -46,9 +47,13 @@ export interface DismissableLayerOptions {
      *  `false`): the "slide back on focus loss" behaviour. */
     readonly focusOut?: boolean;
     /** Whether a newly-focused element is inside the layer (for
-     *  {@link focusOut}). Defaults to a `contains` check against
-     *  {@link elements}. Provide this for geometry-based testing when the
-     *  content is a sibling overlay stacked on top of the layer. */
+     *  {@link focusOut}). Always receives the target as a document-level
+     *  listener sees it, so focus inside a shadow root arrives as that root's
+     *  host however the event reached us — a `contains` predicate written
+     *  against the light DOM keeps working. Defaults to checking the event's
+     *  composed path against {@link elements}. Provide this for geometry-based
+     *  testing when the content is a sibling overlay stacked on top of the
+     *  layer. */
     readonly isFocusInside?: (focused: Element) => boolean;
     /** Listen in the capture phase (default `false`). Use capture when the
      *  layer must see the event before content handlers stop its propagation. */
@@ -62,8 +67,8 @@ export interface DismissableLayerOptions {
  * peeks): while it lives it watches a configurable set of dismiss signals
  * (Escape / extra keys, outside-pointerdown with an optional grace window,
  * window resize, focus moving outside) and calls `onDismiss`. Inside/outside is
- * decided by an `isInside` predicate (geometry) or a `contains` check against
- * `elements`. Dispose to detach every listener.
+ * decided by an `isInside` predicate (geometry) or by checking the event's
+ * composed path against `elements`. Dispose to detach every listener.
  *
  * It owns only the *signals*, not the surface element, its position, or any
  * hover/keep-open policy, so callers keep their own element lifecycle and
@@ -87,11 +92,7 @@ export function createDismissableLayer(
         if (options.isInside) {
             return options.isInside(event);
         }
-        const target = event.target;
-        if (!(target instanceof Node)) {
-            return false;
-        }
-        return (options.elements?.() ?? []).some((el) => el.contains(target));
+        return isEventWithin(event, options.elements?.() ?? []);
     };
 
     if (escape || keys.length > 0) {
@@ -144,27 +145,92 @@ export function createDismissableLayer(
     }
 
     if (options.focusOut) {
-        const isFocusInside = (focused: Element): boolean => {
-            if (options.isFocusInside) {
-                return options.isFocusInside(focused);
-            }
-            return (options.elements?.() ?? []).some((el) =>
-                el.contains(focused)
-            );
-        };
         // `focusin` bubbles to the window; capture so it's seen regardless of
-        // content handlers.
+        // content handlers. A focus move *within* a shadow root never reaches
+        // the window (the event is retargeted to the host and its p
```

**File**: `packages/dockview-core/src/dnd/pointer/longPress.ts` (modified, +2/-2)
```diff
@@ -1,3 +1,4 @@
+import { isEventWithin } from '../../dom';
 import { addDisposableListener } from '../../events';
 import { CompositeDisposable, IDisposable } from '../../lifecycle';
 
@@ -151,8 +152,7 @@ export class LongPressDetector extends CompositeDisposable {
                 // Only suppress clicks targeted at the long-pressed element
                 // or its descendants. A user tap on a context menu item (or
                 // anywhere else) still gets through unchanged.
-                const target = event.target as Node | null;
-                if (target && this.element.contains(target)) {
+                if (isEventWithin(event, [this.element])) {
                     event.preventDefault();
                     event.stopPropagation();
                 }
```

---

### Incident Patch 10: `fbef8cf4` (2026-09-24)
**Commit Message**: Merge remote-tracking branch 'origin/master' into fix/shadow-dom-pointer-dnd

# Conflicts:
#	packages/dockview-core/src/__tests__/dom.spec.ts

**File**: `packages/dockview-core/src/__tests__/dismissableLayer.spec.ts` (modified, +252/-0)
```diff
@@ -156,4 +156,256 @@ describe('createDismissableLayer', () => {
 
         layer.dispose();
     });
+
+    test('pointerdown and focusin inside a shadow root count as inside', () => {
+        const host = document.createElement('div');
+        document.body.appendChild(host);
+        const root = host.attachShadow({ mode: 'open' });
+        const menu = document.createElement('div');
+        const item = document.createElement('button');
+        menu.appendChild(item);
+        root.appendChild(menu);
+
+        const onDismiss = jest.fn();
+        const onInsidePointerDown = jest.fn();
+        const layer = createDismissableLayer({
+            onDismiss,
+            onInsidePointerDown,
+            focusOut: true,
+            elements: () => [menu],
+        });
+
+        item.dispatchEvent(
+            new MouseEvent('pointerdown', { bubbles: true, composed: true })
+        );
+        item.dispatchEvent(
+            new FocusEvent('focusin', { bubbles: true, composed: true })
+        );
+        expect(onInsidePointerDown).toHaveBeenCalledTimes(1);
+        expect(onDismiss).not.toHaveBeenCalled();
+
+        pointerdownOn(outside);
+        expect(onDismiss).toHaveBeenCalledTimes(1);
+
+        layer.dispose();
+        host.remove();
+    });
+
+    // Regression guard: this layout already worked through retargeting; the
+    // composed-path check must keep it working.
+    test('pointerdown and focusin inside a web component within the layer count as inside', () => {
+        const host = document.createElement('div');
+        inside.appendChild(host);
+        const root = host.attachShadow({ mode: 'open' });
+        const item = document.createElement('button');
+        root.appendChild(item);
+
+        const onDismiss = jest.fn();
+        const onInsidePointerDown = jest.fn();
+        const layer = createDismissableLayer({
+            onDismiss,
+            onInsidePointerDown,
+            focusOut: true,
+            elements: () => [inside],
+        });
+
+        item.dispatchEvent(
+            new MouseEvent('pointerdown', { bubbles: true, composed: true })
+        );
+        item.dispatchEvent(
+            new FocusEvent('focusin', { bubbles: true, composed: true })
+        );
+        expect(onInsidePointerDown).toHaveBeenCalledTimes(1);
+        expect(onDismiss).not.toHaveBeenCalled();
+
+        pointerdownOn(outside);
+        expect(onDismiss).toHaveBeenCalledTimes(1);
+
+        layer.dispose();
+    });
+
+    test('focusOut sees focus moving within the shadow root the layer lives in', () => {
+        const host = document.createElement('div');
+        document.body.appendChild(host);
+        const shadowRoot = host.attachShadow({ mode: 'open' });
+        const menu = document.createElement('div');
+        const item = document.createElement('button');
+        menu.appendChild(item);
+        const elsewhere = document.createElement('button');
+        shadowRoot.append(menu, elsewhere);
+
+        const onDismiss = jest.fn();
+        const layer = createDismissableLayer({
+            onDismiss,
+            focusOut: true,
+            elements: () => [menu],
+        });
+
+        // Entering the shadow root reaches both the root and the window
+        // listeners; it must count once, as inside.
+        item.focus();
+        expect(onDismiss).not.toHaveBeenCalled();
+
+        // A move within the root never reaches the window.
+        elsewhere.focus();
+        expect(onDismiss).toHaveBeenCalledTimes(1);
+
+        layer.dispose();
+        host.remove();
+    });
+
+    test('a custom isFocusInside gets the focus target as the window sees it', () => {
+        const panel = document.createElement('div');
+        document.body.appendChild(panel);
+        const componentHost = document.createElement('div');
+        panel.appendChild(componentHost);
+        const input = document.createElement('input');
+        componentHost.attachShadow({ mode: 'ope
```

**File**: `packages/dockview-core/src/__tests__/dnd/pointer/longPress.spec.ts` (modified, +33/-0)
```diff
@@ -219,6 +219,39 @@ describe('LongPressDetector', () => {
         document.body.removeChild(other);
     });
 
+    test('suppresses the synthesised click when the source is inside a shadow root', () => {
+        jest.useFakeTimers();
+        const host = document.createElement('div');
+        document.body.appendChild(host);
+        const element = document.createElement('div');
+        host.attachShadow({ mode: 'open' }).appendChild(element);
+
+        const onClick = jest.fn();
+        element.addEventListener('click', onClick);
+
+        const cut = new LongPressDetector(element, {
+            onLongPress: jest.fn(),
+            delay: 500,
+        });
+
+        fireEvent.pointerDown(element, pointerInit({ composed: true }));
+        jest.advanceTimersByTime(500);
+
+        // The window-level guard sees this click retargeted to the shadow
+        // host; it must still recognise it as a click on the source.
+        const click = new MouseEvent('click', {
+            bubbles: true,
+            cancelable: true,
+            composed: true,
+        });
+        element.dispatchEvent(click);
+        expect(click.defaultPrevented).toBe(true);
+        expect(onClick).not.toHaveBeenCalled();
+
+        cut.dispose();
+        document.body.removeChild(host);
+    });
+
     test('contextmenu guard self-disposes after the first event', () => {
         jest.useFakeTimers();
         const element = document.createElement('div');
```

**File**: `packages/dockview-core/src/__tests__/dom.spec.ts` (modified, +83/-0)
```diff
@@ -6,6 +6,7 @@ import {
     findRelativeZIndexParent,
     getHitTestRoot,
     isChildEntirelyVisibleWithinParent,
+    isEventWithin,
     isInDocument,
     onDidWindowMoveEnd,
     prefersReducedMotion,
@@ -585,3 +586,85 @@ describe('getHitTestRoot', () => {
         iframe.remove();
     });
 });
+
+describe('shadow-DOM-aware event targeting', () => {
+    let outer: HTMLElement;
+
+    beforeEach(() => {
+        outer = document.createElement('div');
+        document.body.appendChild(outer);
+    });
+
+    afterEach(() => {
+        outer.remove();
+    });
+
+    /** Dispatches a composed event from `from` and runs `fn` while a window
+     *  listener sees it, where the target has been retargeted. */
+    const observeOnWindow = <T>(from: Element, fn: (e: Event) => T): T => {
+        let result: T | undefined;
+        const listener = (e: Event) => {
+            result = fn(e);
+        };
+        window.addEventListener('pointerdown', listener);
+        from.dispatchEvent(
+            new Event('pointerdown', { bubbles: true, composed: true })
+        );
+        window.removeEventListener('pointerdown', listener);
+        return result as T;
+    };
+
+    const shadowChild = (host: HTMLElement): HTMLElement => {
+        const root = host.attachShadow({ mode: 'open' });
+        const child = document.createElement('button');
+        root.appendChild(child);
+        return child;
+    };
+
+    test('isEventWithin: element inside a shadow root', () => {
+        const container = document.createElement('div');
+        const root = outer.attachShadow({ mode: 'open' });
+        root.appendChild(container);
+        const child = document.createElement('button');
+        container.appendChild(child);
+        const other = document.createElement('div');
+        root.appendChild(other);
+
+        expect(
+            observeOnWindow(child, (e) => isEventWithin(e, [container]))
+        ).toBe(true);
+        expect(
+            observeOnWindow(other, (e) => isEventWithin(e, [container]))
+        ).toBe(false);
+    });
+
+    test('isEventWithin: element containing a web component', () => {
+        const host = document.createElement('div');
+        outer.appendChild(host);
+        const child = shadowChild(host);
+        const sibling = document.createElement('div');
+        document.body.appendChild(sibling);
+
+        expect(observeOnWindow(child, (e) => isEventWithin(e, [outer]))).toBe(
+            true
+        );
+        expect(observeOnWindow(child, (e) => isEventWithin(e, [sibling]))).toBe(
+            false
+        );
+
+        sibling.remove();
+    });
+
+    test('isEventWithin falls back to contains without a composed path', () => {
+        const child = document.createElement('span');
+        outer.appendChild(child);
+        const event = new Event('pointerdown');
+        Object.defineProperty(event, 'composedPath', { value: undefined });
+        Object.defineProperty(event, 'target', { value: child });
+
+        expect(isEventWithin(event, [outer])).toBe(true);
+        expect(isEventWithin(event, [document.createElement('div')])).toBe(
+            false
+        );
+    });
+});
```

**File**: `packages/dockview-core/src/dismissableLayer.ts` (modified, +93/-27)
```diff
@@ -1,3 +1,4 @@
+import { isEventWithin, retargetToDocument, shadowRootsOf } from './dom';
 import { addDisposableListener } from './events';
 import { CompositeDisposable, IDisposable } from './lifecycle';
 
@@ -22,8 +23,8 @@ export interface DismissableLayerOptions {
     /** A pointerdown landed *inside* the layer (not a dismissal). Use it to
      *  mark interaction (e.g. make a transient layer sticky). */
     readonly onInsidePointerDown?: (event: PointerEvent) => void;
-    /** Whether a pointer event is inside the layer. Defaults to a DOM
-     *  `contains` check against {@link DismissableLayerOptions.elements}.
+    /** Whether a pointer event is inside the layer. Defaults to checking the
+     *  event's composed path against {@link DismissableLayerOptions.elements}.
      *  Provide this for geometry-based hit testing (e.g. when the visible
      *  content is a sibling overlay stacked on top of the layer). */
     readonly isInside?: (event: PointerEvent) => boolean;
@@ -46,9 +47,13 @@ export interface DismissableLayerOptions {
      *  `false`): the "slide back on focus loss" behaviour. */
     readonly focusOut?: boolean;
     /** Whether a newly-focused element is inside the layer (for
-     *  {@link focusOut}). Defaults to a `contains` check against
-     *  {@link elements}. Provide this for geometry-based testing when the
-     *  content is a sibling overlay stacked on top of the layer. */
+     *  {@link focusOut}). Always receives the target as a document-level
+     *  listener sees it, so focus inside a shadow root arrives as that root's
+     *  host however the event reached us — a `contains` predicate written
+     *  against the light DOM keeps working. Defaults to checking the event's
+     *  composed path against {@link elements}. Provide this for geometry-based
+     *  testing when the content is a sibling overlay stacked on top of the
+     *  layer. */
     readonly isFocusInside?: (focused: Element) => boolean;
     /** Listen in the capture phase (default `false`). Use capture when the
      *  layer must see the event before content handlers stop its propagation. */
@@ -62,8 +67,8 @@ export interface DismissableLayerOptions {
  * peeks): while it lives it watches a configurable set of dismiss signals
  * (Escape / extra keys, outside-pointerdown with an optional grace window,
  * window resize, focus moving outside) and calls `onDismiss`. Inside/outside is
- * decided by an `isInside` predicate (geometry) or a `contains` check against
- * `elements`. Dispose to detach every listener.
+ * decided by an `isInside` predicate (geometry) or by checking the event's
+ * composed path against `elements`. Dispose to detach every listener.
  *
  * It owns only the *signals*, not the surface element, its position, or any
  * hover/keep-open policy, so callers keep their own element lifecycle and
@@ -87,11 +92,7 @@ export function createDismissableLayer(
         if (options.isInside) {
             return options.isInside(event);
         }
-        const target = event.target;
-        if (!(target instanceof Node)) {
-            return false;
-        }
-        return (options.elements?.() ?? []).some((el) => el.contains(target));
+        return isEventWithin(event, options.elements?.() ?? []);
     };
 
     if (escape || keys.length > 0) {
@@ -144,27 +145,92 @@ export function createDismissableLayer(
     }
 
     if (options.focusOut) {
-        const isFocusInside = (focused: Element): boolean => {
-            if (options.isFocusInside) {
-                return options.isFocusInside(focused);
-            }
-            return (options.elements?.() ?? []).some((el) =>
-                el.contains(focused)
-            );
-        };
         // `focusin` bubbles to the window; capture so it's seen regardless of
-        // content handlers.
+        // content handlers. A focus move *within* a shadow root never reaches
+        // the window (the event is retargeted to the host and its p
```

**File**: `packages/dockview-core/src/dnd/pointer/longPress.ts` (modified, +2/-2)
```diff
@@ -1,3 +1,4 @@
+import { isEventWithin } from '../../dom';
 import { addDisposableListener } from '../../events';
 import { CompositeDisposable, IDisposable } from '../../lifecycle';
 
@@ -151,8 +152,7 @@ export class LongPressDetector extends CompositeDisposable {
                 // Only suppress clicks targeted at the long-pressed element
                 // or its descendants. A user tap on a context menu item (or
                 // anywhere else) still gets through unchanged.
-                const target = event.target as Node | null;
-                if (target && this.element.contains(target)) {
+                if (isEventWithin(event, [this.element])) {
                     event.preventDefault();
                     event.stopPropagation();
                 }
```

#### Recent Merged Pull Requests:
- **PR #1657** (2026-09-24): fix(core): shadow-DOM follow-ups — one focus helper, a layer that knows its own tree (@mathuo)
- **PR #1656** (2026-09-24): fix(enterprise): keyboard navigation and docking do nothing when dockview is inside a shadow root (@mathuo)
- **PR #1655** (2026-09-24): fix(core): focus state and drag ghosts break when dockview is inside a shadow root (@mathuo)
- **PR #1654** (2026-09-24): fix(core): popout windows open unstyled when dockview is inside a shadow root (@mathuo)
- **PR #1653** (2026-09-24): fix(core): touch drag-and-drop does nothing when dockview is inside a shadow root (@mathuo)
- **PR #1652** (2026-09-24): fix: drive smooth tab reorder off the header's main axis (@mathuo)
- **PR #1651** (2026-09-24): fix(core): context menu items ignore clicks when dockview is inside a shadow root (@mathuo)
- **PR #1650** (2026-09-22): docs: weekly documentation sync (2026-09-11 to 2026-09-18) (@mathuo)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
