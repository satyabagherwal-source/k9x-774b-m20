# Forensic Learning Record (Deep Inspection): dockview/dockview

> **Canonical Artifact**: `07_PROJECT_LEARNING/dockview-dockview-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/dockview/dockview](https://github.com/dockview/dockview))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-06T03:01:01.754Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `dockview/dockview`
- **Description**: Zero dependency docking layout manager supporting tabs, groups, grids and splitviews. Supports React, Vue, Angular, and vanilla TypeScript.
- **Primary Language / Ecosystem**: TypeScript
- **Discovered Manifests / Configurations**: package.json, README.md
- **Stars / Engagement**: 3459 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: package.json, README.md.
- Evaluated system abstractions and modular contracts.

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

### Core Architecture Module: `packages/dockview-angular/src/lib/dockview/angular-tab-group-chip-renderer.ts`
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
import { ITabGroupChipRenderer, ITabGroup, DockviewApi } from 'dockview';

export interface IDockviewAngularTabGroupChipProps {
    tabGroup: ITabGroup;
    api: DockviewApi;
}

export class AngularTabGroupChipRenderer implements ITabGroupChipRenderer {
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

    init(params: { tabGroup: ITabGroup; api: DockviewApi }): void {
        this.componentRef = createComponent(this.component, {
            environmentInjector:
                this.environmentInjector ||
                (this.injector as EnvironmentInjector),
            elementInjector: this.injector,
        });

        const instance = this.componentRef.instance as Record<string, unknown>;
        instance['tabGroup'] = params.tabGroup;
        instance['api'] = params.api;

        const hostView = this.componentRef.hostView as EmbeddedViewRef<any>;
        const rootNode = hostView.rootNodes[0] as HTMLElement;
        this._element.appendChild(rootNode);

        this.appRef.attachView(hostView);
        this.componentRef.changeDetectorRef.markForCheck();
    }

    update(params: { tabGroup: ITabGroup }): void {
        if (!this.componentRef) {
            return;
        }

        const instance = this.componentRef.instance as Record<string, unknown>;
        instance['tabGroup'] = params.tabGroup;
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

### Core Architecture Module: `packages/dockview-angular/src/lib/utils/angular-renderer.ts`
```
import {
    ApplicationRef,
    ChangeDetectionStrategy,
    Component,
    ComponentRef,
    createComponent,
    EmbeddedViewRef,
    EnvironmentInjector,
    Injector,
    TemplateRef,
    Type,
    ViewChild,
    ViewContainerRef,
} from '@angular/core';
import { IContentRenderer, IFrameworkPart, Parameters } from 'dockview';

export interface AngularRendererOptions<T = unknown> {
    component: Type<T> | TemplateRef<T>;
    injector: Injector;
    environmentInjector?: EnvironmentInjector;
}

/**
 * An `OnPush` boundary that hosts a single dockview panel component in its
 * `ViewContainerRef`. Each panel view is attached to the application for change
 * detection; without this boundary every panel would be fully checked on every
 * CD tick, so a dockview resize/drag (which triggers ticks via zone.js) ran
 * change detection across *all* panels — O(panels) per event.
 *
 * Because the boundary is `OnPush`, a global tick that didn't touch this panel
 * finds it clean and skips it (and its hosted component) entirely. The panel is
 * still fully interactive: a DOM event inside it, an `@Input` change, or an
 * `async` pipe all mark the hosted component — and, walking up, this boundary —
 * dirty, so the next tick checks it. Panel content of any change-detection
 * strategy works, including components created outside the Angular zone.
 */
@Component({
    selector: 'dv-ng-cd-boundary',
    template: '<ng-container #vcr></ng-container>',
    changeDetection: ChangeDetectionStrategy.OnPush,
    standalone: true,
    host: { style: 'display:block;height:100%;width:100%;' },
})
class DockviewCdBoundary {
    @ViewChild('vcr', { read: ViewContainerRef, static: true })
    vcr!: ViewContainerRef;
}

export class AngularRenderer<T = unknown>
    implements IContentRenderer, IFrameworkPart
{
    private componentRef: ComponentRef<T> | null = null;
    private boundaryRef: ComponentRef<DockviewCdBoundary> | null = null;
    private viewRef: EmbeddedViewRef<T> | null = null;
    private _element: HTMLElement | null = null;
    private readonly appRef: ApplicationRef;

    constructor(private readonly options: AngularRendererOptions<T>) {
        this.appRef = options.injector.get(ApplicationRef);
    }

    get element(): HTMLElement {
        if (!this._element) {
            throw new Error('Angular renderer not initialized');
        }
        return this._element;
    }

    get component(): ComponentRef<T> | null {
        return this.componentRef;
    }
    get view(): EmbeddedViewRef<T> | null {
        return this.viewRef;
    }

    init(parameters: Parameters): void {
        // Forward the known user-facing fields from panel/tab renderers
        // and context menu item renderers. Other internal fields (e.g. 'title')
        // are excluded here; update() further guards with `key in instance`.
        const filtered: Record<string, unknown> = {};
        // Panel / tab renderer fields
        if ('params' in parameters) {
            filtered['params'] = parameters['params'];
        }
        if ('api' in parameters) {
            filtered['api'] = parameters['api'];
        }
        if ('containerApi' in parameters) {
            filtered['containerApi'] = parameters['containerApi'];
        }
        // Context menu item renderer fields: IContextMenuItemComponentProps
        // (tab menu, carries `panel`) and IChipContextMenuItemComponentProps
        // (chip menu, carries `tabGroup`).
        if ('panel' in parameters) {
            filtered['panel'] = parameters['panel'];
        }
        if ('tabGroup' in parameters) {
            filtered['tabGroup'] = parameters['tabGroup'];
        }
        if ('group' in parameters) {
            filtered['group'] = parameters['group'];
        }
        if ('close' in parameters) {
            filtered['close'] = parameters['close'];
        }
        if ('componentProps' in parameters) {
            filtered['componentProps'] = parameters['componentProps'];
        }

        if (this._element) {
            this.update(filtered);
        } else {
            this.render(filtered);
        }
    }

    update(params: Parameters): void {
        // Only component can have parameters
        if (!this.componentRef) {
            return;
        }

        const instance = this.componentRef.instance as Record<string, unknown>;

        for (const key of Object.keys(params)) {
            instance[key] = params[key];
        }

        if (this.viewRef) {
            this.viewRef.markForCheck();
        }
    }

    private render(parameters: Parameters): void {
        try {
            if (this.options.component instanceof TemplateRef) {
                this.setupView(this.options.component);
            } else {
                this.setupComponent(this.options.component, parameters);
            }
        } catch (error) {
            console.error('dockview: error creating Angular component', error);
            throw error;
        }
    }

    private setupComponent(component: Type<T>, parameters: Parameters): void {
        const environmentInjector =
            this.options.environmentInjector ||
            (this.options.injector as EnvironmentInjector);

        // Create the OnPush boundary and attach *it* (not the panel component)
        // to the application. Global CD ticks that don't touch this panel find
        // the boundary clean and skip it and the hosted component.
        this.boundaryRef = createComponent(DockviewCdBoundary, {
            environmentInjector,
            elementInjector: this.options.injector,
        });
        this.appRef.attachView(this.boundaryRef.hostView);
        // resolve the `@ViewChild` ViewContainerRef
        this.boundaryRef.changeDetectorRef.detectChanges();

        // Host the panel component inside the boundary's ViewContainerRef so it
        // is a CD child of the boundary (its markForCheck walks up to it).
        this.componentRef = this.boundaryRef.instance.vcr.createComponent(
            component,
            {
                injector: this.options.injector,
                environmentInjector,
            }
        );

        // Set initial parameters. NOTE: this runs before `viewRef` is assigned
        // below, so update()'s markForCheck is a no-op here; the initial render
        // is instead driven by the explicit detectChanges() at the end of this
        // method. Keep that ordering — assigning viewRef first would make
        // update() mark-for-check without a following tick and paint stale.
        this.update(parameters);

        this.viewRef = this.componentRef.hostView as EmbeddedViewRef<T>;
        // The panel's DOM node is the boundary's host element (which contains
        // the hosted component); dockview positions this.
        this._element = (this.boundaryRef.hostView as EmbeddedViewRef<unknown>)
            .rootNodes[0] as HTMLElement;

        // initial render of the hosted component
        this.boundaryRef.changeDetectorRef.detectChanges();
    }

    private setupView(template: TemplateRef<T>): void {
        this.viewRef = template.createEmbeddedView(
            <never>{},
            this.options.injector
        );
        this._element = this.viewRef.rootNodes[0] as HTMLElement;

        this.appRef.attachView(this.viewRef);
        this.viewRef.markForCheck();
    }

    dispose(): void {
        if (this.componentRef) {
            this.componentRef.destroy();
            this.componentRef = null;
        }
        if (this.boundaryRef) {
            // detach the boundary from the application's CD before destroying it
            this.appRef.detachView(this.boundaryRef.hostView);
            this.boundaryRef.destroy();
            this.boundaryRef = null;
        }
        if (this.viewRef) {
            this.viewRef.destroy();
            this.viewRef = null;
        }
        // Intentionally retain `_element` after dispose. Dockview's overlay
        // teardown reads `panel.view.content.element` while removing the node
        // from its overlay parent, so nulling here would make the getter throw
        // mid-cascade. The HTMLElement reference is cheap and will be GC'd
        // when the renderer itself is collected.
    }
}

```

### Core Architecture Module: `packages/dockview-angular/src/lib/utils/component-factory.ts`
```
import {
    Type,
    Injector,
    EnvironmentInjector,
    TemplateRef,
} from '@angular/core';
import {
    IContentRenderer,
    ITabRenderer,
    IWatermarkRenderer,
    IHeaderActionsRenderer,
    CreateComponentOptions,
    DockviewGroupPanel,
    GridviewPanel,
    SplitviewPanel,
    IPanePart,
} from 'dockview';
import { AngularRenderer } from './angular-renderer';
import { AngularHeaderActionsRenderer } from '../dockview/angular-header-actions-renderer';
import { AngularGridviewPanel } from '../gridview/angular-gridview-panel';
import { AngularSplitviewPanel } from '../splitview/angular-splitview-panel';
import { AngularPanePart } from '../paneview/angular-pane-part';

export class AngularFrameworkComponentFactory {
    constructor(
        private components: Record<string, Type<any> | TemplateRef<any>>,
        private readonly injector: Injector,
        private readonly environmentInjector?: EnvironmentInjector,
        private tabComponents?: Record<string, Type<any> | TemplateRef<any>>,
        private watermarkComponent?: Type<any> | TemplateRef<any>,
        private headerActionsComponents?: Record<
            string,
            Type<any> | TemplateRef<any>
        >,
        private defaultTabComponent?: Type<any> | TemplateRef<any>
    ) {}

    /**
     * Refresh the component maps in place so that rebinding an `@Input()`
     * component map (e.g. `[components]`) after init is honoured. The core
     * calls the factory live on each panel creation, so updating these
     * references is enough. No re-init required.
     */
    updateComponents(maps: {
        components: Record<string, Type<any> | TemplateRef<any>>;
        tabComponents?: Record<string, Type<any> | TemplateRef<any>>;
        watermarkComponent?: Type<any> | TemplateRef<any>;
        headerActionsComponents?: Record<string, Type<any> | TemplateRef<any>>;
        defaultTabComponent?: Type<any> | TemplateRef<any>;
    }): void {
        this.components = maps.components;
        this.tabComponents = maps.tabComponents;
        this.watermarkComponent = maps.watermarkComponent;
        this.headerActionsComponents = maps.headerActionsComponents;
        this.defaultTabComponent = maps.defaultTabComponent;
    }

    createDockviewComponent(options: CreateComponentOptions): IContentRenderer {
        const component = this.components[options.name];
        if (!component) {
            throw new Error(
                `Component '${options.name}' not found in component registry`
            );
        }

        const renderer = new AngularRenderer({
            component,
            injector: this.injector,
            environmentInjector: this.environmentInjector,
        });

        renderer.init(options);
        return renderer;
    }

    createGridviewComponent(options: CreateComponentOptions): GridviewPanel {
        const component = this.components[options.name];
        if (!component) {
            throw new Error(
                `Component '${options.name}' not found in component registry`
            );
        }

        return new AngularGridviewPanel(
            options.id,
            options.name,
            component,
            this.injector,
            this.environmentInjector
        );
    }

    createSplitviewComponent(options: CreateComponentOptions): SplitviewPanel {
        const component = this.components[options.name];
        if (!component) {
            throw new Error(
                `Component '${options.name}' not found in component registry`
            );
        }

        return new AngularSplitviewPanel(
            options.id,
            options.name,
            component,
            this.injector,
            this.environmentInjector
        );
    }

    createPaneviewComponent(options: CreateComponentOptions): IPanePart {
        const component = this.components[options.name];
        if (!component) {
            throw new Error(
                `Component '${options.name}' not found in component registry`
            );
        }

        return new AngularPanePart(
            component,
            this.injector,
            this.environmentInjector
        );
    }

    createTabComponent(
        options: CreateComponentOptions
    ): ITabRenderer | undefined {
        let component = this.tabComponents?.[options.name];

        if (!component && this.defaultTabComponent) {
            component = this.defaultTabComponent;
        }

        if (!component) {
            return undefined;
        }

        const renderer = new AngularRenderer({
            component,
            injector: this.injector,
            environmentInjector: this.environmentInjector,
        });

        renderer.init(options);
        return renderer;
    }

    createWatermarkComponent(): IWatermarkRenderer {
        if (!this.watermarkComponent) {
            throw new Error('Watermark component not provided');
        }

        const renderer = new AngularRenderer({
            component: this.watermarkComponent,
            injector: this.injector,
            environmentInjector: this.environmentInjector,
        });

        renderer.init({});
        return renderer;
    }

    createHeaderActionsComponent(
        name: string,
        group: DockviewGroupPanel
    ): IHeaderActionsRenderer | undefined {
        const component = this.headerActionsComponents?.[name];
        if (!component) {
            return undefined;
        }

        // Dedicated renderer (not AngularRenderer) so the component instance
        // receives the full IDockviewHeaderActionsProps surface and stays in
        // sync with group/panel state via event subscriptions.
        return new AngularHeaderActionsRenderer(
            component,
            group,
            this.injector,
            this.environmentInjector
        );
    }
}

```

### Core Architecture Module: `packages/dockview-angular/src/lib/utils/lifecycle-utils.ts`
```
import { Observable, Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { DockviewIDisposable } from 'dockview';

export class AngularDisposable implements DockviewIDisposable {
    private _isDisposed = false;
    private disposeCallbacks: (() => void)[] = [];

    get isDisposed(): boolean {
        return this._isDisposed;
    }

    addDisposeCallback(callback: () => void): void {
        if (this._isDisposed) {
            callback();
            return;
        }
        this.disposeCallbacks.push(callback);
    }

    dispose(): void {
        if (this._isDisposed) {
            return;
        }

        this._isDisposed = true;
        this.disposeCallbacks.forEach((callback) => {
            try {
                callback();
            } catch (error) {
                console.error('dockview: error in dispose callback', error);
            }
        });
        this.disposeCallbacks = [];
    }
}

export class AngularLifecycleManager {
    private readonly destroySubject = new Subject<void>();
    private disposables: DockviewIDisposable[] = [];

    get destroy$(): Observable<void> {
        return this.destroySubject.asObservable();
    }

    addDisposable(disposable: DockviewIDisposable): void {
        this.disposables.push(disposable);
    }

    takeUntilDestroy<T>(): (source: Observable<T>) => Observable<T> {
        return takeUntil(this.destroySubject);
    }

    destroy(): void {
        this.destroySubject.next();
        this.destroySubject.complete();

        this.disposables.forEach((disposable) => {
            try {
                disposable.dispose();
            } catch (error) {
                console.error('dockview: error disposing resource', error);
            }
        });
        this.disposables = [];
    }
}

export function createAngularDisposable(
    disposeCallback?: () => void
): AngularDisposable {
    const disposable = new AngularDisposable();
    if (disposeCallback) {
        disposable.addDisposeCallback(disposeCallback);
    }
    return disposable;
}

```

### Core Architecture Module: `packages/dockview-core/jest.config.ts`
```
import type { Config } from 'jest';

const config: Config = {
    roots: ['<rootDir>/packages/dockview-core'],
    modulePaths: ['<rootDir>/packages/dockview-core/src'],
    displayName: { name: 'dockview-core', color: 'blue' },
    rootDir: '../../',
    collectCoverageFrom: [
        '<rootDir>/packages/dockview-core/src/**/*.{js,jsx,ts,tsx}',
    ],
    setupFiles: [
        '<rootDir>/packages/dockview-core/src/__tests__/__mocks__/resizeObserver.js',
        '<rootDir>/packages/dockview-core/src/__tests__/__mocks__/pointerEvent.js',
    ],
    setupFilesAfterEnv: ['<rootDir>/jest-setup.ts'],
    coveragePathIgnorePatterns: ['/node_modules/'],
    modulePathIgnorePatterns: [
        '<rootDir>/packages/dockview-core/src/__tests__/__mocks__',
        '<rootDir>/packages/dockview-core/src/__tests__/__test_utils__',
    ],
    coverageDirectory: '<rootDir>/packages/dockview-core/coverage/',
    // testResultsProcessor inherited from root config
    testEnvironment: 'jsdom',
    transform: {
        '^.+\\.tsx?$': [
            '@swc/jest',
            {
                jsc: {
                    parser: { syntax: 'typescript', tsx: true },
                    transform: { react: { runtime: 'automatic' } },
                    target: 'es2021',
                },
            },
        ],
    },
    cacheDirectory: '<rootDir>/node_modules/.cache/jest/dockview-core',
    // Recycle any worker whose heap balloons, so the large suite can run in
    // parallel without the OOM that originally forced maxWorkers: 1 under
    // ts-jest. @swc/jest is far lighter, so parallelism is safe now.
    workerIdleMemoryLimit: '768MB',
};

export default config;

```

### Core Architecture Module: `packages/dockview-core/rolldown.config.mjs`
```
import { defineConfig } from 'rolldown';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';
import { cssInject } from '../../scripts/rolldown-css-inject.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const { name, version, homepage, license } = require('./package.json');

const banner = [
    '/**',
    ` * ${name}`,
    ` * @version ${version}`,
    ` * @link ${homepage}`,
    ` * @license ${license}`,
    ' */',
].join('\n');

const outDir = join(__dirname, 'dist');
const withStylesEntry = join(__dirname, 'scripts/bundleEntryTarget.ts');
const noStylesEntry = join(__dirname, 'src/index.ts');
const target = 'es2015';

// Browser/CDN bundles — dist/{name}[.min][.noStyle].js
function umd(styles, min) {
    return {
        input: styles ? withStylesEntry : noStylesEntry,
        plugins: styles ? [cssInject()] : [],
        transform: { target },
        output: {
            file: join(
                outDir,
                `${name}${min ? '.min' : ''}${styles ? '' : '.noStyle'}.js`
            ),
            format: 'umd',
            name,
            banner,
            minify: min,
            esModule: true,
        },
    };
}

// npm package bundles — dist/package/main.{cjs|esm}[.min].{js|mjs}
function pkg(fmt, min) {
    const ext = fmt === 'esm' ? 'mjs' : 'js';
    return {
        input: noStylesEntry,
        transform: { target },
        output: {
            file: join(outDir, 'package', `main.${fmt}${min ? '.min' : ''}.${ext}`),
            format: fmt,
            banner,
            minify: min,
            esModule: true,
        },
    };
}

export default defineConfig([
    umd(true, false),
    umd(true, true),
    umd(false, false),
    umd(false, true),
    pkg('cjs', false),
    pkg('cjs', true),
    pkg('esm', false),
    pkg('esm', true),
]);

```

### Core Architecture Module: `packages/dockview-core/scripts/bundleEntryTarget.ts`
```
import '../dist/styles/dockview.css';
export * from '../src/index';

```

### Core Architecture Module: `packages/dockview-core/src/api/component.api.ts`
```
import {
    DockviewActivePanelChangeEvent,
    DockviewPanelPinnedChangeEvent,
    DockviewLayoutMutationEvent,
    DockviewMaximizedGroupChangeEvent,
    DockviewPopoutGroupOptions,
    FloatingGroupOptions,
    GroupNavigationDirection,
    IDockviewComponent,
    MovePanelEvent,
    PopoutGroup,
    PopoutGroupChangePositionEvent,
    PopoutGroupChangeSizeEvent,
    SerializedDockview,
} from '../dockview/dockviewComponent';
import { PopoutWindowEvent, PopoutWindowFailure } from '../popoutWindow';
import { DndCapabilities } from '../dockview/dndCapabilities';
import {
    AddGroupOptions,
    AddPanelOptions,
    DockviewComponentOptions,
    DockviewDndOverlayEvent,
    MovementOptions,
    SmartGuidesOptions,
} from '../dockview/options';
import {
    DockviewMessages,
    resolveMessages,
} from '../dockview/accessibilityMessages';
import { Parameters } from '../panel/types';
import { Direction } from '../gridview/baseComponentGridview';
import {
    AddGridviewComponentOptions,
    IGridviewComponent,
    SerializedGridviewComponent,
} from '../gridview/gridviewComponent';
import { IGridviewPanel } from '../gridview/gridviewPanel';

import {
    AddPaneviewComponentOptions,
    SerializedPaneview,
    IPaneviewComponent,
} from '../paneview/paneviewComponent';
import { IPaneviewPanel } from '../paneview/paneviewPanel';
import {
    AddSplitviewComponentOptions,
    ISplitviewComponent,
    SerializedSplitview,
} from '../splitview/splitviewComponent';
import { IView, Orientation, Sizing } from '../splitview/splitview';
import { ISplitviewPanel } from '../splitview/splitviewPanel';
import {
    DockviewGroupPanel,
    IDockviewGroupPanel,
} from '../dockview/dockviewGroupPanel';
import { Event } from '../events';
import {
    LayoutHistoryChangeEvent,
    SmartGuidesSnapEvent,
    SmartGuidesSnapTogetherEvent,
} from '../dockview/moduleContracts';
import { IDockviewPanel } from '../dockview/dockviewPanel';
import { PaneviewDidDropEvent } from '../paneview/draggablePaneviewPanel';
import {
    GroupDragEvent,
    TabDragEvent,
} from '../dockview/components/titlebar/tabsContainer';
import {
    DockviewDidDropEvent,
    DockviewWillDropEvent,
} from '../dockview/dockviewGroupPanelModel';
import {
    DockviewWillShowOverlayLocationEvent,
    DockviewTabGroupChangeEvent,
    DockviewTabGroupCollapsedChangeEvent,
    DockviewTabGroupPanelChangeEvent,
} from '../dockview/events';
import { ITabGroup } from '../dockview/tabGroup';
import { DockviewTabGroupColorEntry } from '../dockview/tabGroupAccent';
import {
    PaneviewComponentOptions,
    PaneviewDndOverlayEvent,
} from '../paneview/options';
import { SplitviewComponentOptions } from '../splitview/options';
import { GridviewComponentOptions } from '../gridview/options';
import {
    EdgeGroupPosition,
    AddEdgeGroupOptions,
} from '../dockview/dockviewShell';
import { DockviewGroupPanelApi } from './dockviewGroupPanelApi';

export interface CommonApi<T = any> {
    readonly height: number;
    readonly width: number;
    readonly onDidLayoutChange: Event<void>;
    readonly onDidLayoutFromJSON: Event<void>;
    focus(): void;
    layout(width: number, height: number): void;
    fromJSON(data: T): void;
    toJSON(): T;
    clear(): void;
    dispose(): void;
}

export class SplitviewApi implements CommonApi<SerializedSplitview> {
    /**
     * The minimum size  the component can reach where size is measured in the direction of orientation provided.
     */
    get minimumSize(): number {
        return this.component.minimumSize;
    }

    /**
     * The maximum size the component can reach where size is measured in the direction of orientation provided.
     */
    get maximumSize(): number {
        return this.component.maximumSize;
    }

    /**
     * Width of the component.
     */
    get width(): number {
        return this.component.width;
    }

    /**
     * Height of the component.
     */
    get height(): number {
        return this.component.height;
    }
    /**
     * The current number of panels.
     */
    get length(): number {
        return this.component.length;
    }

    /**
     * The current orientation of the component.
     */
    get orientation(): Orientation {
        return this.component.orientation;
    }

    /**
     * The list of current panels.
     */
    get panels(): ISplitviewPanel[] {
        return this.component.panels;
    }

    /**
     * Invoked after a layout is loaded through the `fromJSON` method.
     */
    get onDidLayoutFromJSON(): Event<void> {
        return this.component.onDidLayoutFromJSON;
    }

    /**
     * Invoked whenever any aspect of the layout changes.
     * If listening to this event it may be worth debouncing ouputs.
     */
    get onDidLayoutChange(): Event<void> {
        return this.component.onDidLayoutChange;
    }

    /**
     * Invoked when a view is added.
     */
    get onDidAddView(): Event<IView> {
        return this.component.onDidAddView;
    }

    /**
     * Invoked when a view is removed.
     */
    get onDidRemoveView(): Event<IView> {
        return this.component.onDidRemoveView;
    }

    constructor(private readonly component: ISplitviewComponent) {}

    /**
     * Removes an existing panel and optionally provide a `Sizing` method
     * for the subsequent resize.
     */
    removePanel(panel: ISplitviewPanel, sizing?: Sizing): void {
        this.component.removePanel(panel, sizing);
    }

    /**
     * Focus the component.
     */
    focus(): void {
        this.component.focus();
    }

    /**
     * Get the reference to a panel given it's `string` id.
     */
    getPanel(id: string): ISplitviewPanel | undefined {
        return this.component.getPanel(id);
    }

    /**
     * Layout the panel with a width and height.
     */
    layout(width: number, height: number): void {
        return this.component.layout(width, height);
    }

    /**
     * Add a new panel and return the created instance.
     */
    addPanel<T extends object = Parameters>(
        options: AddSplitviewComponentOptions<T>
    ): ISplitviewPanel {
        return this.component.addPanel(options);
    }

    /**
     * Move a panel given it's current and desired index.
     */
    movePanel(from: number, to: number): void {
        this.component.movePanel(from, to);
    }

    /**
     * Deserialize a layout to built a splitivew.
     */
    fromJSON(data: SerializedSplitview): void {
        this.component.fromJSON(data);
    }

    /** Serialize a layout */
    toJSON(): SerializedSplitview {
        return this.component.toJSON();
    }

    /**
     * Remove all panels and clear the component.
     */
    clear(): void {
        this.component.clear();
    }

    /**
     * Update configuratable options.
     */
    updateOptions(options: Partial<SplitviewComponentOptions>): void {
        this.component.updateOptions(options);
    }

    /**
     * Release resources and teardown component. Do not call when using framework versions of dockview.
     */
    dispose(): void {
        this.component.dispose();
    }
}

export class PaneviewApi implements CommonApi<SerializedPaneview> {
    /**
     * The minimum size  the component can reach where size is measured in the direction of orientation provided.
     */
    get minimumSize(): number {
        return this.component.minimumSize;
    }

    /**
     * The maximum size the component can reach where size is measured in the direction of orientation provided.
     */
    get maximumSize(): number {
        return this.component.maximumSize;
    }

    /**
     * Width of the component.
     */
    get width(): number {
        return this.component.width;
    }

    /**
     * Height of the component.
     */
    get height(): number {
        return this.component.height;
    }

    /**
     * All panel objects.
     */
    get panels(): IPaneviewPanel[] {
        return this.component.panels;
    }

    /**
     * Invoked when any layout change occures, an aggregation of many events.
     */
    get onDidLayoutChange(): Event<void> {
        return this.component.onDidLayoutChange;
    }

    /**
     * Invoked after a layout is deserialzied using the `fromJSON` method.
     */
    get onDidLayoutFromJSON(): Event<void> {
        return this.component.onDidLayoutFromJSON;
    }

    /**
     * Invoked when a panel is added. May be called multiple times when moving panels.
     */
    get onDidAddView(): Event<IPaneviewPanel> {
        return this.component.onDidAddView;
    }

    /**
     * Invoked when a panel is removed. May be called multiple times when moving panels.
     */
    get onDidRemoveView(): Event<IPaneviewPanel> {
        return this.component.onDidRemoveView;
    }

    /**
     * Invoked when a Drag'n'Drop event occurs that the component was unable to handle. Exposed for custom Drag'n'Drop functionality.
     */
    get onDidDrop(): Event<PaneviewDidDropEvent> {
        return this.component.onDidDrop;
    }

    get onUnhandledDragOver(): Event<PaneviewDndOverlayEvent> {
        return this.component.onUnhandledDragOver;
    }

    constructor(private readonly component: IPaneviewComponent) {}

    /**
     * Remove a panel given the panel object.
     */
    removePanel(panel: IPaneviewPanel): void {
        this.component.removePanel(panel);
    }

    /**
     * Get a panel object given a `string` id. May return `undefined`.
     */
    getPanel(id: string): IPaneviewPanel | undefined {
        return this.component.getPanel(id);
    }

    /**
     * Move a panel given it's current and desired index.
     */
    movePanel(from: number, to: number): void {
        this.component.movePanel(from, to);
    }

    /**
     *  Focus the component. Will try to focus an active panel if one exists.
     */
    focus(): void {
        this.component.focus();
    }

    /**
     * Force resize the component to an exact width and height. Read about auto-resizing before using.
     */
    lay
```

### Core Architecture Module: `packages/dockview-core/src/api/dockviewGroupPanelApi.ts`
```
import { Position, positionToDirection } from '../dnd/droptarget';
import { DockviewComponent } from '../dockview/dockviewComponent';
import { Box } from '../types';
import { DockviewGroupPanel } from '../dockview/dockviewGroupPanel';
import {
    DockviewGroupActivePanelChangeEvent,
    DockviewGroupLocation,
    DockviewGroupPanelLocked,
} from '../dockview/dockviewGroupPanelModel';
import {
    DockviewHeaderDirection,
    DockviewHeaderPosition,
} from '../dockview/options';
import { Emitter, Event } from '../events';
import {
    GridviewPanelApi,
    GridviewPanelApiImpl,
    SizeEvent,
} from './gridviewPanelApi';

export interface DockviewGroupMoveParams {
    group?: DockviewGroupPanel;
    position?: Position;
    /**
     * The index to place the panel within a group, only applicable if the placement is within an existing group
     */
    index?: number;
    /**
     * Whether to skip setting the group as active after moving
     */
    skipSetActive?: boolean;
}

export interface DockviewGroupPanelCollapsedChangeEvent {
    readonly isCollapsed: boolean;
}

export interface DockviewGroupPanelPeekChangeEvent {
    readonly isPeeking: boolean;
}

export interface DockviewGroupPanelHeaderDirectionChangeEvent {
    /** The header's new axis: `'horizontal'` (top/bottom) or `'vertical'` (left/right). */
    readonly direction: DockviewHeaderDirection;
    /** The header position that produced the new direction. */
    readonly position: DockviewHeaderPosition;
}

export interface DockviewGroupPanelApi extends GridviewPanelApi {
    readonly onDidLocationChange: Event<DockviewGroupPanelLocationChangeEvent>;
    /**
     * Fires when the active panel *within this group* changes. Scoped to the
     * group, in contrast to the component-level
     * `DockviewApi.onDidActivePanelChange` (which tracks the active panel across
     * the whole dockview). Both carry an {@link DockviewOrigin} reporting
     * whether the change came from a user gesture or an API call.
     */
    readonly onDidActivePanelChange: Event<DockviewGroupActivePanelChangeEvent>;
    /**
     * Fired when an edge group's collapsed state changes.
     * Never fires for non-edge groups.
     */
    readonly onDidCollapsedChange: Event<DockviewGroupPanelCollapsedChangeEvent>;
    /**
     * Fired when an edge group's auto-hide *peek* state changes (the slid-out
     * overlay shown/hidden while the group stays logically collapsed). Never
     * fires for non-edge groups or without the auto-hide module.
     */
    readonly onDidPeekChange: Event<DockviewGroupPanelPeekChangeEvent>;
    /**
     * Fires when this group's header flips orientation between horizontal
     * (top/bottom) and vertical (left/right), e.g. when `headerPosition`
     * moves from `top` to `left`. Does not fire for position changes that
     * keep the same axis (top↔bottom, left↔right) or for the initial set.
     */
    readonly onDidHeaderDirectionChange: Event<DockviewGroupPanelHeaderDirectionChangeEvent>;
    readonly location: DockviewGroupLocation;
    /**
     * Whether this group is locked against drop interactions.
     * - `true`: panels cannot be dropped into the group (center / tabs),
     *   but the group can still be split from its edges.
     * - `'no-drop-target'`: all drop zones are disabled for this group.
     */
    locked: DockviewGroupPanelLocked;
    /**
     * If you require the Window object
     */
    getWindow(): Window;
    moveTo(options: DockviewGroupMoveParams): void;
    setHeaderPosition(position: DockviewHeaderPosition): void;
    getHeaderPosition(): DockviewHeaderPosition;
    maximize(): void;
    isMaximized(): boolean;
    exitMaximized(): void;
    close(): void;
    /**
     * Resize this group, clamped by its constraints and the space available.
     * An edge group is sized along its own axis only - `width` for
     * `left`/`right`, `height` for `top`/`bottom` - and that size is the one
     * it expands to, so a collapsed group keeps its strip until expanded.
     */
    setSize(event: SizeEvent): void;
    /**
     * Collapse this group (edge groups only). No-op for non-edge groups.
     */
    collapse(): void;
    /**
     * Expand this group (edge groups only). No-op for non-edge groups.
     */
    expand(): void;
    /**
     * Returns true if this edge group is currently collapsed.
     * Always returns false for non-edge groups.
     */
    isCollapsed(): boolean;
    /** True while this edge group is peeking (auto-hide slid-out overlay). */
    isPeeking(): boolean;
    /**
     * Opt this edge group in/out of auto-hide (pinnable tool-window) behaviour
     * at runtime, overriding the global `autoHideEdgeGroups` option. Pass
     * `undefined` to clear the override and inherit the global. No-op for
     * non-edge groups or without the auto-hide module.
     */
    setAutoHide(value: boolean | undefined): void;
    /**
     * The resolved auto-hide state of this edge group: the per-group override
     * if one is set, otherwise the global `autoHideEdgeGroups` option for this
     * edge. Always returns false for non-edge groups.
     */
    isAutoHide(): boolean;
}

export interface DockviewGroupPanelLocationChangeEvent {
    readonly location: DockviewGroupLocation;
}

const NOT_INITIALIZED_MESSAGE =
    'dockview: DockviewGroupPanelApiImpl not initialized';

export class DockviewGroupPanelApiImpl extends GridviewPanelApiImpl {
    private _group: DockviewGroupPanel | undefined;
    private _pendingSize: SizeEvent | undefined;

    readonly _onDidLocationChange =
        new Emitter<DockviewGroupPanelLocationChangeEvent>();
    readonly onDidLocationChange: Event<DockviewGroupPanelLocationChangeEvent> =
        this._onDidLocationChange.event;

    readonly _onDidActivePanelChange =
        new Emitter<DockviewGroupActivePanelChangeEvent>();
    readonly onDidActivePanelChange = this._onDidActivePanelChange.event;

    readonly _onDidCollapsedChange =
        new Emitter<DockviewGroupPanelCollapsedChangeEvent>();
    readonly onDidCollapsedChange: Event<DockviewGroupPanelCollapsedChangeEvent> =
        this._onDidCollapsedChange.event;

    readonly _onDidPeekChange =
        new Emitter<DockviewGroupPanelPeekChangeEvent>();
    readonly onDidPeekChange: Event<DockviewGroupPanelPeekChangeEvent> =
        this._onDidPeekChange.event;

    readonly _onDidHeaderDirectionChange =
        new Emitter<DockviewGroupPanelHeaderDirectionChangeEvent>();
    readonly onDidHeaderDirectionChange: Event<DockviewGroupPanelHeaderDirectionChangeEvent> =
        this._onDidHeaderDirectionChange.event;

    get location(): DockviewGroupLocation {
        if (!this._group) {
            throw new Error(NOT_INITIALIZED_MESSAGE);
        }
        return this._group.model.location;
    }

    /**
     * The group's bounding box relative to the top-left of the dockview root,
     * in pixels. Covers grid and floating groups; returns `undefined` for a
     * popout group (it lives in a separate window). Reflects the live rendered
     * geometry, so it is only meaningful once the layout has been sized.
     */
    get boundingBox(): Box | undefined {
        if (!this._group || this._group.model.location.type === 'popout') {
            return undefined;
        }
        const root = this.accessor.element.getBoundingClientRect();
        const rect = this._group.element.getBoundingClientRect();
        return {
            left: rect.left - root.left,
            top: rect.top - root.top,
            width: rect.width,
            height: rect.height,
        };
    }

    get locked(): DockviewGroupPanelLocked {
        if (!this._group) {
            throw new Error(NOT_INITIALIZED_MESSAGE);
        }
        return this._group.locked;
    }

    set locked(value: DockviewGroupPanelLocked) {
        if (!this._group) {
            throw new Error(NOT_INITIALIZED_MESSAGE);
        }
        this._group.locked = value;
    }

    constructor(
        id: string,
        private readonly accessor: DockviewComponent
    ) {
        super(id, '__dockviewgroup__');

        this.addDisposables(
            this._onDidLocationChange,
            this._onDidActivePanelChange,
            this._onDidCollapsedChange,
            this._onDidPeekChange,
            this._onDidHeaderDirectionChange,
            this._onDidVisibilityChange.event((event) => {
                if (event.isVisible && this._pendingSize) {
                    super.setSize(this._pendingSize);
                    this._pendingSize = undefined;
                }
            })
        );
    }

    public override setSize(event: SizeEvent): void {
        this._pendingSize = { ...event };

        super.setSize(event);
    }

    close(): void {
        if (!this._group) {
            return;
        }
        return this.accessor.removeGroup(this._group);
    }

    getWindow(): Window {
        return this.location.type === 'popout'
            ? this.location.getWindow()
            : globalThis.window;
    }

    setHeaderPosition(position: DockviewHeaderPosition): void {
        if (!this._group) {
            throw new Error(NOT_INITIALIZED_MESSAGE);
        }
        this._group.model.headerPosition = position;
    }

    getHeaderPosition(): DockviewHeaderPosition {
        if (!this._group) {
            throw new Error(NOT_INITIALIZED_MESSAGE);
        }
        return this._group.model.headerPosition;
    }

    moveTo(options: DockviewGroupMoveParams): void {
        if (!this._group) {
            throw new Error(NOT_INITIALIZED_MESSAGE);
        }

        this.accessor.withOrigin('api', () => {
            const group =
                options.group ??
                this.accessor.addGroup({
                    direction: positionToDirection(options.position ?? 'right'),
                    skipSetActive: options.skipSetActive ?? false,
                });

            this.accessor.moveGroupOrPanel({
                from: { groupId: this._group!.id },

```

### Core Architecture Module: `packages/dockview-core/src/api/dockviewPanelApi.ts`
```
import { Emitter, Event } from '../events';
import { GridviewPanelApiImpl, GridviewPanelApi } from './gridviewPanelApi';
import { DockviewGroupPanel } from '../dockview/dockviewGroupPanel';
import { CompositeDisposable, MutableDisposable } from '../lifecycle';
import { DockviewPanel } from '../dockview/dockviewPanel';
import { DockviewComponent } from '../dockview/dockviewComponent';
import { DockviewPanelRenderer } from '../overlay/overlayRenderContainer';
import {
    DockviewGroupMoveParams,
    DockviewGroupPanelLocationChangeEvent,
} from './dockviewGroupPanelApi';
import { DockviewGroupLocation } from '../dockview/dockviewGroupPanelModel';

export interface TitleEvent {
    readonly title: string;
}

export interface PinnedChangeEvent {
    readonly isPinned: boolean;
}

export interface RendererChangedEvent {
    readonly renderer: DockviewPanelRenderer;
}

export interface ActiveGroupEvent {
    readonly isActive: boolean;
}

export interface GroupChangedEvent {
    // empty
}

export type DockviewPanelMoveParams = DockviewGroupMoveParams;

export interface DockviewPanelApi
    extends Omit<
        GridviewPanelApi,
        // omit properties that do not make sense here
        'setVisible' | 'onDidConstraintsChange'
    > {
    /**
     * The id of the tab component renderer
     *
     * Undefined if no custom tab renderer is provided
     */
    readonly tabComponent: string | undefined;
    readonly group: DockviewGroupPanel;
    readonly isGroupActive: boolean;
    readonly renderer: DockviewPanelRenderer;
    readonly title: string | undefined;
    /**
     * Whether this panel's tab is pinned. Pinned tabs render before unpinned
     * tabs, never overflow, and resist cross-boundary reorder. Owned by the
     * PinnedTabs module. Reads `false` until a panel is pinned, which requires
     * `pinnedTabs.enabled` (both `setPinned` and restore are gated on it), so a
     * component with pinning disabled always reports `false`.
     */
    readonly isPinned: boolean;
    readonly onDidActiveGroupChange: Event<ActiveGroupEvent>;
    readonly onDidGroupChange: Event<GroupChangedEvent>;
    readonly onDidTitleChange: Event<TitleEvent>;
    readonly onDidChangePinned: Event<PinnedChangeEvent>;
    readonly onDidRendererChange: Event<RendererChangedEvent>;
    readonly location: DockviewGroupLocation;
    readonly onDidLocationChange: Event<DockviewGroupPanelLocationChangeEvent>;
    close(): void;
    setTitle(title: string): void;
    /**
     * Pin or unpin this panel's tab. No-op (warns once) when the PinnedTabs
     * module is not registered, and dormant unless `pinnedTabs.enabled` is set.
     */
    setPinned(pinned: boolean): void;
    setRenderer(renderer: DockviewPanelRenderer): void;
    moveTo(options: DockviewPanelMoveParams): void;
    maximize(): void;
    isMaximized(): boolean;
    exitMaximized(): void;
    /**
     * If you require the Window object
     */
    getWindow(): Window;
}

export class DockviewPanelApiImpl
    extends GridviewPanelApiImpl
    implements DockviewPanelApi
{
    private _group: DockviewGroupPanel;
    private readonly _tabComponent: string | undefined;

    readonly _onDidTitleChange = new Emitter<TitleEvent>();
    readonly onDidTitleChange = this._onDidTitleChange.event;

    readonly _onDidChangePinned = new Emitter<PinnedChangeEvent>();
    readonly onDidChangePinned = this._onDidChangePinned.event;

    private readonly _onDidActiveGroupChange = new Emitter<ActiveGroupEvent>();
    readonly onDidActiveGroupChange = this._onDidActiveGroupChange.event;

    private readonly _onDidGroupChange = new Emitter<GroupChangedEvent>();
    readonly onDidGroupChange = this._onDidGroupChange.event;

    readonly _onDidRendererChange = new Emitter<RendererChangedEvent>();
    readonly onDidRendererChange = this._onDidRendererChange.event;

    private readonly _onDidLocationChange =
        new Emitter<DockviewGroupPanelLocationChangeEvent>();
    readonly onDidLocationChange: Event<DockviewGroupPanelLocationChangeEvent> =
        this._onDidLocationChange.event;

    private readonly groupEventsDisposable = new MutableDisposable();

    get location(): DockviewGroupLocation {
        return this.group.api.location;
    }

    get title(): string | undefined {
        return this.panel.title;
    }

    get isPinned(): boolean {
        return this.panel.isPinned;
    }

    get isGroupActive(): boolean {
        return this.group.isActive;
    }

    get renderer(): DockviewPanelRenderer {
        return this.panel.renderer;
    }

    set group(value: DockviewGroupPanel) {
        const oldGroup = this._group;

        if (this._group !== value) {
            this._group = value;

            this._onDidGroupChange.fire({});

            this.setupGroupEventListeners(oldGroup);

            this.fireLocationChange();
        }
    }

    get group(): DockviewGroupPanel {
        return this._group;
    }

    get tabComponent(): string | undefined {
        return this._tabComponent;
    }

    constructor(
        private readonly panel: DockviewPanel,
        group: DockviewGroupPanel,
        private readonly accessor: DockviewComponent,
        component: string,
        tabComponent?: string
    ) {
        super(panel.id, component);

        this._tabComponent = tabComponent;

        this.initialize(panel);

        this._group = group;
        this.setupGroupEventListeners();

        this.addDisposables(
            this.groupEventsDisposable,
            this._onDidRendererChange,
            this._onDidTitleChange,
            this._onDidChangePinned,
            this._onDidGroupChange,
            this._onDidActiveGroupChange,
            this._onDidLocationChange
        );
    }

    getWindow(): Window {
        return this.group.api.getWindow();
    }

    override setActive(): void {
        // A bare `panel.api.setActive()` from application code is a
        // programmatic activation. Tag it `'api'` so `onDidActivePanelChange`
        // reports the correct origin; user-gesture call sites that route
        // through here wrap the call in `withOrigin('user')` first, which wins.
        this.accessor.withOrigin('api', () => super.setActive());
    }

    moveTo(options: DockviewPanelMoveParams): void {
        // Programmatic relocation: tag it `'api'` so the `'move'` layout
        // mutation reports the correct origin. User-gesture moves (DnD) drive
        // `accessor.moveGroupOrPanel` directly and keep the default `'user'`.
        this.accessor.withOrigin('api', () =>
            this.accessor.moveGroupOrPanel({
                from: { groupId: this._group.id, panelId: this.panel.id },
                to: {
                    group: options.group ?? this._group,
                    position: options.group
                        ? (options.position ?? 'center')
                        : 'center',
                    index: options.index,
                },
                skipSetActive: options.skipSetActive,
            })
        );
    }

    setTitle(title: string): void {
        this.panel.setTitle(title);
    }

    setPinned(pinned: boolean): void {
        this.accessor.setPanelPinned(this.panel, pinned);
    }

    setRenderer(renderer: DockviewPanelRenderer): void {
        this.panel.setRenderer(renderer);
    }

    close(): void {
        this.group.model.closePanel(this.panel);
    }

    maximize(): void {
        this.group.api.maximize();
    }

    isMaximized(): boolean {
        return this.group.api.isMaximized();
    }

    exitMaximized(): void {
        this.group.api.exitMaximized();
    }

    /**
     * Report that this panel's location may have moved.
     *
     * A relocation touches the location more than once - the panel is
     * reparented into the destination group, then that group is tagged with
     * the location it ends up at - so the event is coalesced to the end of the
     * enclosing layout mutation and reports where the panel actually settled.
     * Firing each signal as it happened surfaced an intermediate `grid`
     * location the panel was never in, at a point where it was in neither
     * group's panel list. Outside a mutation this fires straight away.
     */
    private fireLocationChange(): void {
        this.accessor.deferLocationChange(this, () => {
            if (this.isDisposed) {
                return;
            }

            this._onDidLocationChange.fire({ location: this.location });
        });
    }

    private setupGroupEventListeners(previousGroup?: DockviewGroupPanel) {
        let _trackGroupActive = previousGroup?.isActive ?? false; // prevent duplicate events with same state

        this.groupEventsDisposable.value = new CompositeDisposable(
            this.group.api.onDidVisibilityChange((event) => {
                const hasBecomeHidden = !event.isVisible && this.isVisible;
                const hasBecomeVisible = event.isVisible && !this.isVisible;

                const isActivePanel = this.group.model.isPanelActive(
                    this.panel
                );

                if (hasBecomeHidden || (hasBecomeVisible && isActivePanel)) {
                    this._onDidVisibilityChange.fire(event);
                }
            }),
            this.group.api.onDidLocationChange(() => {
                if (this.group !== this.panel.group) {
                    return;
                }
                this.fireLocationChange();
            }),
            this.group.api.onDidActiveChange(() => {
                if (this.group !== this.panel.group) {
                    return;
                }

                if (_trackGroupActive !== this.isGroupActive) {
                    _trackGroupActive = this.isGroupActive;
                    this._onDidActiveGroupChange.fire({
                        isActive: this.isGroupActive,
                    });
                }
            })
        );
    }
}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #1661** (2026-10-03): **Removing the last panel leaks a watermark: doRemoveGroup deactivates the group after disposing it**
  *Symptoms*: **Dockview version** 4.13.1 and 8.4.0. The same code is on `master` at 590640b.  **Framework** Reproduces with `dockview-core` alone (vanilla JS). We hit it through `dockview` (React 19), where the watermark is a React component.  **Browser** Chrome; also reproduces under jsdom.  **Describe the bug** Each time the last panel of a group is removed, one watermark is created that is never disposed. With a React watermark, the leaked component stays mounted, effects included, until the page is reloaded. In our app the watermark loads data, so every leaked copy kept refetching.  **Reproduction**  ```js import { createDockview } from 'dockview-core';  let created = 0; const alive = new Set(); const api = createDockview(document.getElementById('app'), {   createComponent: () => ({ element: document.createElement('div'), init() {} }),   createWatermarkComponent: () => {     const id = ++created;     alive.add(id);     return {       element: document.createElement('div'),       init() {},       dispose() { alive.delete(id); },     };   }, }); api.layout(800, 600);  for (let i = 1; i <= 3; i++) {   const panel = api.addPanel({ id: `p${i}`, component: 'any' });   api.removePanel(panel);   console.log(`after close ${i}: live watermarks = ${alive.size}`); } // Observed: 2, 3, 4 // Expected: 1, 1, 1 (only the grid-level watermark) ```  **Expected behavior** After the last panel is removed, only the grid-level watermark is alive. The emptied group's watermark is disposed with the group.  *

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

### Incident Patch 1: `15351795` (2026-10-04)
**Commit Message**: fix(demo): correct selectstart readout, macOS popout close, late teardown

- Host panel: read `defaultPrevented` in a task rather than a microtask.
  For browser-dispatched events microtasks run between listeners, so the
  capture-phase probe read the flag before the shield cancelled it and
  "blocked" stayed at 0.
- Simulation: its throwaway dockview instance registers its own
  `onWillClosePopoutWindow` → `closeNativePopout`, since the listener in
  main.ts is per instance; without it the macOS popout stayed open.
- DemoPanel: `onDispose` after dispose runs the cleanup immediately, so the
  layout-sync listener resolved after the panel is gone is unsubscribed.

Co-Authored-By: Claude Opus 5.5 <[REDACTED_EMAIL]>
Claude-Session: https://claude.ai/code/session_01MKCcYRN8e31anbNydx1wia

**File**: `packages/dockview-tauri-demo/src/main.ts` (modified, +2/-1)
```diff
@@ -42,7 +42,8 @@ const api = createDockview(container, {
 /**
  * wry's macOS UI delegate has no `webViewDidClose:`, so the `close()` dockview
  * calls on a popout window does nothing there and the shell has to destroy it.
- * One listener covers every popout, whatever opened it.
+ * One listener covers every popout this instance opens; the simulation's
+ * throwaway instance registers its own.
  */
 api.onWillClosePopoutWindow(({ window }) => {
     void closeNativePopout(window);
```

**File**: `packages/dockview-tauri-demo/src/panels.ts` (modified, +11/-2)
```diff
@@ -21,18 +21,25 @@ import { RELEASE_ORIGIN_URL, simulateReleaseOriginRestore } from './simulate';
 abstract class DemoPanel implements IContentRenderer {
     protected readonly root = el('div', { class: 'demo-panel' });
     private readonly teardown: (() => void)[] = [];
+    private disposed = false;
 
     get element(): HTMLElement {
         return this.root;
     }
 
     abstract init(parameters: GroupPanelPartInitParameters): void;
 
+    /** Runs `fn` on dispose, or straight away if the panel is already gone. */
     protected onDispose(fn: () => void): void {
+        if (this.disposed) {
+            fn();
+            return;
+        }
         this.teardown.push(fn);
     }
 
     dispose(): void {
+        this.disposed = true;
         for (const fn of this.teardown.splice(0)) {
             fn();
         }
@@ -123,10 +130,12 @@ export class HostPanel extends DemoPanel {
 
         // Capture phase, so it runs before the shield's own handler and can
         // tell whether the event arrived at all separately from whether
-        // anything cancelled it.
+        // anything cancelled it. The verdict is read in a task: for an event
+        // the browser dispatches, microtasks run between listeners, so a
+        // microtask would read `defaultPrevented` before the shield has run.
         const onSelectStart = (event: Event) => {
             selectStarts += 1;
-            queueMicrotask(() => {
+            setTimeout(() => {
                 if (event.defaultPrevented) {
                     selectStartsPrevented += 1;
                 }
```

**File**: `packages/dockview-tauri-demo/src/simulate.ts` (modified, +6/-0)
```diff
@@ -15,6 +15,7 @@ import {
     createDockview,
     themeAbyss,
 } from 'dockview';
+import { closeNativePopout } from './bridge';
 
 /** A popout target on the origin a macOS / Linux release build would use. */
 export const RELEASE_ORIGIN_URL = 'tauri://localhost/popout.html';
@@ -61,6 +62,11 @@ export async function simulateReleaseOriginRestore(): Promise<SimulationResult>
             theme: themeAbyss,
             createComponent: () => new StubPanel(),
         });
+        // The close listener in main.ts is per instance, and on macOS this
+        // instance's popout is only destroyed if the shell is asked to.
+        api.onWillClosePopoutWindow(({ window }) => {
+            void closeNativePopout(window);
+        });
         api.layout(host.clientWidth, host.clientHeight);
         api.addPanel({ id: 'a', component: 'stub', title: 'A' });
         api.addPanel({
```

---

### Incident Patch 2: `1ed8b57f` (2026-10-04)
**Commit Message**: fix(dockview-core): mark popout promise in context menu as intentionally ignored

addPopoutGroup returns a Promise<boolean> that already catches and logs
its own errors, so the fire-and-forget call is marked with `void`.

Co-Authored-By: Claude Opus 5.5 <[REDACTED_EMAIL]>
Claude-Session: https://claude.ai/code/session_01AXzqsPZsfp1M3D7WCs7NXf

**File**: `packages/dockview-core/src/dockview/contextMenuService.ts` (modified, +2/-1)
```diff
@@ -346,7 +346,8 @@ export class ContextMenuController implements IContextMenuService {
                     'Open in New Window',
                     close,
                     () => {
-                        this.accessor.api.addPopoutGroup(panel);
+                        // errors are caught and logged inside addPopoutGroup
+                        void this.accessor.api.addPopoutGroup(panel);
                     },
                     panel.api.location.type === 'popout'
                 );
```

---

### Incident Patch 3: `ce09aee1` (2026-10-04)
**Commit Message**: fix: mark floating addPopoutGroup promise as intentionally ignored in context menu

Co-Authored-By: Claude Opus 5.5 <[REDACTED_EMAIL]>
Claude-Session: https://claude.ai/code/session_012MnD4EAraygZ1RnFpWDwrm

**File**: `packages/dockview-core/src/dockview/contextMenuService.ts` (modified, +1/-1)
```diff
@@ -343,7 +343,7 @@ export class ContextMenuController implements IContextMenuService {
                     'Open in New Window',
                     close,
                     () => {
-                        this.accessor.api.addPopoutGroup(panel);
+                        void this.accessor.api.addPopoutGroup(panel);
                     },
                     panel.api.location.type === 'popout'
                 );
```

---

### Incident Patch 4: `b816ee16` (2026-10-04)
**Commit Message**: Merge pull request #1663 from dockview/fix/use-after-dispose-leaks

fix: renderers and panels leaked after disposal

**File**: `packages/dockview-core/src/__tests__/__test_utils__/rendererTracker.ts` (added, +92/-0)
```diff
@@ -0,0 +1,92 @@
+import { DockviewFrameworkOptions } from '../../dockview/options';
+
+export type TrackedRendererKind =
+    | 'content'
+    | 'tab'
+    | 'watermark'
+    | 'headerAction'
+    | 'contextMenuItem';
+
+const KINDS: TrackedRendererKind[] = [
+    'content',
+    'tab',
+    'watermark',
+    'headerAction',
+    'contextMenuItem',
+];
+
+export interface RendererTracker {
+    /** Tracked renderer factories to spread into the component options. */
+    readonly options: Required<
+        Pick<
+            DockviewFrameworkOptions,
+            | 'defaultTabComponent'
+            | 'createComponent'
+            | 'createTabComponent'
+            | 'createWatermarkComponent'
+            | 'createRightHeaderActionComponent'
+            | 'createContextMenuItemComponent'
+        >
+    >;
+    /** Renderers created and not yet disposed, for one kind or all kinds. */
+    alive(kind?: TrackedRendererKind): number;
+    /** Renderers created so far, for one kind or all kinds. */
+    created(kind?: TrackedRendererKind): number;
+    snapshot(): Record<TrackedRendererKind, number>;
+}
+
+/**
+ * Counts the framework renderers a dockview creates and disposes.
+ */
+export function createRendererTracker(): RendererTracker {
+    const alive = new Map<TrackedRendererKind, Set<number>>(
+        KINDS.map((kind) => [kind, new Set<number>()])
+    );
+    const created = new Map<TrackedRendererKind, number>(
+        KINDS.map((kind) => [kind, 0])
+    );
+    let nextId = 0;
+
+    const track = (kind: TrackedRendererKind) => {
+        const id = ++nextId;
+        alive.get(kind)!.add(id);
+        created.set(kind, created.get(kind)! + 1);
+        const element = document.createElement('div');
+        element.dataset.trackedRenderer = kind;
+        return {
+            element,
+            init: () => {
+                /* noop */
+            },
+            update: () => {
+                /* noop */
+            },
+            dispose: () => {
+                alive.get(kind)!.delete(id);
+            },
+        };
+    };
+
+    const count = (
+        source: (kind: TrackedRendererKind) => number,
+        kind?: TrackedRendererKind
+    ) =>
+        kind ? source(kind) : KINDS.reduce((total, k) => total + source(k), 0);
+
+    return {
+        options: {
+            defaultTabComponent: 'tracked',
+            createComponent: () => track('content'),
+            createTabComponent: () => track('tab'),
+            createWatermarkComponent: () => track('watermark'),
+            createRightHeaderActionComponent: () => track('headerAction'),
+            createContextMenuItemComponent: () => track('contextMenuItem'),
+        },
+        alive: (kind) => count((k) => alive.get(k)!.size, kind),
+        created: (kind) => count((k) => created.get(k)!, kind),
+        snapshot: () =>
+            Object.fromEntries(
+                KINDS.map((kind) => [kind, alive.get(kind)!.size])
+            ) as Record<TrackedRendererKind, number>,
+    };
+}
```

**File**: `packages/dockview-core/src/__tests__/dockview/components/popupService.spec.ts` (modified, +47/-0)
```diff
@@ -30,6 +30,53 @@ describe('PopupService', () => {
         });
     });
 
+    describe('onClose', () => {
+        test('runs once when the popover closes', () => {
+            const onClose = jest.fn();
+            service.openPopover(
+                document.createElement('div'),
+                { x: 0, y: 0 },
+                { onClose }
+            );
+
+            service.close();
+            service.close();
+
+            expect(onClose).toHaveBeenCalledTimes(1);
+        });
+
+        test('runs for the replaced popover only', () => {
+            const first = jest.fn();
+            const second = jest.fn();
+            service.openPopover(
+                document.createElement('div'),
+                { x: 0, y: 0 },
+                { onClose: first }
+            );
+            service.openPopover(
+                document.createElement('div'),
+                { x: 0, y: 0 },
+                { onClose: second }
+            );
+
+            expect(first).toHaveBeenCalledTimes(1);
+            expect(second).not.toHaveBeenCalled();
+        });
+
+        test('runs when the service is disposed', () => {
+            const onClose = jest.fn();
+            service.openPopover(
+                document.createElement('div'),
+                { x: 0, y: 0 },
+                { onClose }
+            );
+
+            service.dispose();
+
+            expect(onClose).toHaveBeenCalledTimes(1);
+        });
+    });
+
     describe('openPopover', () => {
         test('appends wrapper containing the element into the anchor', () => {
             const el = document.createElement('div');
```

**File**: `packages/dockview-core/src/__tests__/dockview/components/titlebar/tabsContainer.spec.ts` (modified, +198/-0)
```diff
@@ -2081,6 +2081,7 @@ describe('tabsContainer', () => {
             capturedContext.open(body);
             expect(mockPopupService.openPopover).toHaveBeenCalledWith(
                 body,
+                expect.anything(),
                 expect.anything()
             );
             mockPopupService.close.mockClear();
@@ -2089,6 +2090,203 @@ describe('tabsContainer', () => {
             expect(() => capturedContext.focusTrigger()).not.toThrow();
         });
 
+        test('overflow rows built after the popover closes are disposed', () => {
+            let onClose: (() => void) | undefined;
+            const mockPopupService = {
+                openPopover: jest.fn((_el, _pos, options) => {
+                    onClose = options?.onClose;
+                }),
+                close: jest.fn(() => onClose?.()),
+            };
+
+            let capturedContext: any;
+            const accessor = makeAccessor({
+                getPopupServiceForGroup: () => mockPopupService as any,
+                advancedOverflowService: {
+                    renderOverflow: (args: any) => {
+                        capturedContext = args.context;
+                    },
+                } as any,
+            });
+
+            const renderers: { dispose: jest.Mock }[] = [];
+            const mockPanel = fromPartial<IDockviewPanel>({
+                id: 'panel-a',
+                api: { isActive: false, setActive: jest.fn() },
+                view: {
+                    createTabRenderer: jest.fn(() => {
+                        const renderer = {
+                            element: document.createElement('div'),
+                            dispose: jest.fn(),
+                        };
+                        renderers.push(renderer);
+                        return renderer;
+                    }),
+                },
+            });
+
+            const group = makeGroup({
+                panels: [mockPanel],
+                model: fromPartial<DockviewGroupPanelModel>({
+                    getTabGroups: () => [],
+                }),
+            });
+
+            const cut = new TabsContainer(accessor, group);
+            (cut as any).tabs = makeOverflowMockTabs([
+                {
+                    panel: mockPanel,
+                    element: { scrollIntoView: jest.fn() },
+                },
+            ]);
+            (cut as any).toggleDropdown({
+                tabs: ['panel-a'],
+                tabGroups: [],
+                pinnedTabs: [],
+                reset: false,
+            });
+            fireEvent.click(
+                cut.element.querySelector('.dv-tabs-overflow-dropdown-root')!
+            );
+
+            capturedContext.buildRow('panel-a');
+            capturedContext.open(document.createElement('div'));
+            expect(renderers[0].dispose).not.toHaveBeenCalled();
+
+            capturedContext.close();
+            expect(renderers[0].dispose).toHaveBeenCalledTimes(1);
+
+            // e.g. a debounced search re-rendering after the popover closed
+            capturedContext.buildRow('panel-a');
+            expect(renderers[1].dispose).toHaveBeenCalledTimes(1);
+        });
+
+        test('overflow rows are disposed when rendering the dropdown throws', () => {
+            const consoleError = jest
+                .spyOn(console, 'error')
+                .mockImplementation(() => {
+                    /* jsdom reports the listener error */
+                });
+            // the rethrown error is expected; a listener stops jest failing on it
+            const onError = (event: ErrorEvent) => event.preventDefault();
+            window.addEventListener('error', onError);
+            const accessor = makeAccessor({
+                getPopupServiceForGroup: () =>
+                    ({ openPopover: jest.fn(), close: jest.fn() }) as any,
+                advancedOverflowService: {
+                    renderOverflow: (args: any) => {
+                        args.context.buildRow('panel-a');
+                        throw new Error('render failed');
+                    },
+                } as any,
+            });
+
+            const dispose = jest.fn();
+            const mockPanel = fromPartial<IDockviewPanel>({
+                id: 'panel-a',
+                api: { isActive: false, setActive: jest.fn() },
+                view: {
+                    createTabRenderer: jest.fn(() => ({
+                        element: document.createElement('div'),
+                        dispose,
+                    })),
+                },
+            });
+            const group = makeGroup({
+                panels: [mockPanel],
+                model: fromPartial<DockviewGroupPanelModel>({
+                    getTabGroups: () => [],
+                }),
+            });
+
+            const cut = new TabsContainer(accessor, group);
+            (cut as any).tabs = makeOverflowMockTabs([
+                {
+                    panel: mo
```

**File**: `packages/dockview-core/src/__tests__/dockview/contextMenu.spec.ts` (modified, +134/-11)
```diff
@@ -144,10 +144,14 @@ describe('ContextMenuController', () => {
 
             controller.show(makePanel(), makeGroup(), event);
 
-            expect(openPopover).toHaveBeenCalledWith(expect.any(HTMLElement), {
-                x: 150,
-                y: 300,
-            });
+            expect(openPopover).toHaveBeenCalledWith(
+                expect.any(HTMLElement),
+                {
+                    x: 150,
+                    y: 300,
+                },
+                expect.anything()
+            );
         });
 
         test('does not call openPopover when getTabContextMenuItems returns empty array', () => {
@@ -245,7 +249,8 @@ describe('ContextMenuController', () => {
                     expect.any(HTMLElement),
                     expect.objectContaining({
                         zIndex: 'calc(1001 * 2)',
-                    })
+                    }),
+                    expect.anything()
                 );
             } finally {
                 document.body.removeChild(floating);
@@ -296,7 +301,8 @@ describe('ContextMenuController', () => {
                     expect.any(HTMLElement),
                     expect.objectContaining({
                         zIndex: 'calc(999 * 2)',
-                    })
+                    }),
+                    expect.anything()
                 );
             } finally {
                 document.body.removeChild(floating);
@@ -326,7 +332,8 @@ describe('ContextMenuController', () => {
                     expect.any(HTMLElement),
                     expect.objectContaining({
                         zIndex: 'calc(1003 * 2)',
-                    })
+                    }),
+                    expect.anything()
                 );
             } finally {
                 document.body.removeChild(outer);
@@ -375,7 +382,8 @@ describe('ContextMenuController', () => {
                     expect.any(HTMLElement),
                     expect.objectContaining({
                         zIndex: 'calc(var(--dv-overlay-z-index, 999) + 100)',
-                    })
+                    }),
+                    expect.anything()
                 );
             } finally {
                 document.body.removeChild(tab);
@@ -402,7 +410,8 @@ describe('ContextMenuController', () => {
                     expect.any(HTMLElement),
                     expect.objectContaining({
                         zIndex: 'calc(var(--dv-overlay-z-index, 999) + 100)',
-                    })
+                    }),
+                    expect.anything()
                 );
             } finally {
                 document.body.removeChild(floating);
@@ -428,7 +437,8 @@ describe('ContextMenuController', () => {
                     expect.any(HTMLElement),
                     expect.objectContaining({
                         zIndex: 'calc(var(--dv-overlay-z-index, 999) + 100)',
-                    })
+                    }),
+                    expect.anything()
                 );
             } finally {
                 document.body.removeChild(chip);
@@ -1232,6 +1242,118 @@ describe('ContextMenuController', () => {
         });
     });
 
+    describe('component item renderers', () => {
+        function makeRenderer() {
+            return {
+                element: document.createElement('div'),
+                init: jest.fn(),
+                dispose: jest.fn(),
+            };
+        }
+
+        test('tab menu disposes its renderers on close', () => {
+            const renderer = makeRenderer();
+            const { accessor, openPopover } = makeAccessor({
+                getTabContextMenuItems: jest
+                    .fn()
+                    .mockReturnValue([{ component: {} }]),
+                createContextMenuItemComponent: jest
+                    .fn()
+                    .mockReturnValue(renderer),
+            });
+
+            new ContextMenuController(accessor).show(
+                makePanel(),
+                makeGroup(),
+                new MouseEvent('contextmenu')
+            );
+            expect(renderer.dispose).not.toHaveBeenCalled();
+
+            openPopover.mock.calls[0][2].onClose();
+            expect(renderer.dispose).toHaveBeenCalledTimes(1);
+        });
+
+        test('disposes the renderers built so far when an item init throws', () => {
+            const first = makeRenderer();
+            const second = makeRenderer();
+            second.init.mockImplementation(() => {
+                throw new Error('init failed');
+            });
+            const { accessor, openPopover } = makeAccessor({
+                getTabContextMenuItems: jest
+                    .fn()
+                    .mockReturnValue([{ component: 'a' }, { component: 'b' }]),
+                createContextMenuItemComponent: jest
+                    .fn()
+                    .mockReturnValueOnce(first)
+                    .mockReturnValueOnce(second),
+            });
+
+            expect(() =>
+               
```

**File**: `packages/dockview-core/src/__tests__/dockview/rendererLifecycle.spec.ts` (added, +513/-0)
```diff
@@ -0,0 +1,513 @@
+import { fireEvent } from '@testing-library/dom';
+import { DockviewComponent } from '../../dockview/dockviewComponent';
+import { DockviewComponentOptions } from '../../dockview/options';
+import { setupDeferredMockWindow } from '../__mocks__/mockWindow';
+import { exhaustMicrotaskQueue } from '../__test_utils__/utils';
+import {
+    createRendererTracker,
+    RendererTracker,
+} from '../__test_utils__/rendererTracker';
+
+/**
+ * Asserts live renderer counts after public API sequences, and zero live
+ * renderers after `dispose()`.
+ */
+describe('renderer lifecycle', () => {
+    let tracker: RendererTracker;
+    let dockview: DockviewComponent;
+
+    function create(options?: Partial<DockviewComponentOptions>) {
+        dockview = new DockviewComponent(document.createElement('div'), {
+            ...tracker.options,
+            ...options,
+        });
+        dockview.layout(1000, 800);
+        return dockview;
+    }
+
+    function groupIds() {
+        return dockview.groups.map((group) => group.id);
+    }
+
+    function expectNothingAliveAfterDispose() {
+        dockview.dispose();
+        expect(tracker.snapshot()).toEqual({
+            content: 0,
+            tab: 0,
+            watermark: 0,
+            headerAction: 0,
+            contextMenuItem: 0,
+        });
+    }
+
+    beforeEach(() => {
+        tracker = createRendererTracker();
+    });
+
+    describe('baseline', () => {
+        test('adding and removing panels and groups', () => {
+            create();
+            const p1 = dockview.addPanel({ id: 'p1', component: 'default' });
+            const p2 = dockview.addPanel({
+                id: 'p2',
+                component: 'default',
+                position: { direction: 'right' },
+            });
+            dockview.addPanel({ id: 'p3', component: 'default' });
+
+            expect(tracker.alive('content')).toBe(3);
+            expect(tracker.alive('tab')).toBe(3);
+            expect(tracker.alive('headerAction')).toBe(2);
+
+            dockview.removePanel(p1);
+            dockview.removeGroup(p2.group);
+
+            expect(dockview.groups).toHaveLength(0);
+            expect(tracker.alive('content')).toBe(0);
+            expect(tracker.alive('tab')).toBe(0);
+            expect(tracker.alive('headerAction')).toBe(0);
+            // only the dockview-level watermark
+            expect(tracker.alive('watermark')).toBe(1);
+
+            expectNothingAliveAfterDispose();
+        });
+
+        test('moving panels between groups, floating and back', () => {
+            create();
+            const p1 = dockview.addPanel({ id: 'p1', component: 'default' });
+            const p2 = dockview.addPanel({
+                id: 'p2',
+                component: 'default',
+                position: { direction: 'right' },
+            });
+
+            p2.api.moveTo({ group: p1.group, position: 'center' });
+            expect(dockview.groups).toHaveLength(1);
+
+            dockview.addFloatingGroup(p2);
+            p2.api.moveTo({ group: p1.group, position: 'right' });
+
+            expect(dockview.groups).toHaveLength(2);
+            expect(tracker.alive('content')).toBe(2);
+            expect(tracker.alive('tab')).toBe(2);
+            expect(tracker.alive('headerAction')).toBe(2);
+            expect(tracker.alive('watermark')).toBe(0);
+
+            expectNothingAliveAfterDispose();
+        });
+
+        test('clear() and fromJSON()', () => {
+            create();
+            dockview.addPanel({ id: 'p1', component: 'default' });
+            dockview.addPanel({
+                id: 'p2',
+                component: 'default',
+                position: { direction: 'below' },
+            });
+            const json = dockview.toJSON();
+
+            dockview.clear();
+            expect(tracker.alive('content')).toBe(0);
+            expect(tracker.alive('headerAction')).toBe(0);
+
+            dockview.fromJSON(json);
+            dockview.fromJSON(json);
+            expect(tracker.alive('content')).toBe(2);
+            expect(tracker.alive('tab')).toBe(2);
+            expect(tracker.alive('headerAction')).toBe(2);
+
+            expectNothingAliveAfterDispose();
+        });
+    });
+
+    describe('moving into the centre of the source group', () => {
+        test('panel.api.moveTo({ index }) on the only panel keeps it', () => {
+            create();
+            const p1 = dockview.addPanel({ id: 'p1', component: 'default' });
+
+            p1.api.moveTo({ index: 0 });
+
+            expect(dockview.groups).toHaveLength(1);
+            expect(dockview.panels.map((p) => p.id)).toEqual(['p1']);
+            expect(p1.group.model.isDisposed).toBe(false);
+            expect(groupIds()).toContain(p1.group.id);
+
+            expectNothingAliveAfterDispose();
+        });
+
+        test('panel.api.moveTo its own group centre keeps it', () => {
+            create();
+            dockview.addPanel({ id: '
```

**File**: `packages/dockview-core/src/__tests__/dom.spec.ts` (modified, +50/-0)
```diff
@@ -18,6 +18,7 @@ import {
     quasiPreventDefault,
     resolveOpaqueBackground,
     trackFocus,
+    watchElementResize,
 } from '../dom';
 
 function stubRect(
@@ -830,3 +831,52 @@ describe('shadow-DOM-aware event targeting', () => {
         );
     });
 });
+
+describe('watchElementResize', () => {
+    test('a resize pending when disposed never reaches the callback', () => {
+        const originalResizeObserver = window.ResizeObserver;
+        let notify: ((entries: ResizeObserverEntry[]) => void) | undefined;
+        window.ResizeObserver = class {
+            constructor(cb: (entries: ResizeObserverEntry[]) => void) {
+                notify = cb;
+            }
+            observe() {
+                /* noop */
+            }
+            unobserve() {
+                /* noop */
+            }
+            disconnect() {
+                /* noop */
+            }
+        } as unknown as typeof ResizeObserver;
+
+        const frames: FrameRequestCallback[] = [];
+        const raf = jest
+            .spyOn(window, 'requestAnimationFrame')
+            .mockImplementation((cb) => frames.push(cb));
+        const caf = jest
+            .spyOn(window, 'cancelAnimationFrame')
+            .mockImplementation((id) => {
+                frames[id - 1] = () => {
+                    /* cancelled */
+                };
+            });
+
+        try {
+            const cb = jest.fn();
+            const element = document.createElement('div');
+            const disposable = watchElementResize(element, cb);
+
+            notify!([{ target: element } as unknown as ResizeObserverEntry]);
+            disposable.dispose();
+            frames.forEach((frame) => frame(0));
+
+            expect(cb).not.toHaveBeenCalled();
+        } finally {
+            raf.mockRestore();
+            caf.mockRestore();
+            window.ResizeObserver = originalResizeObserver;
+        }
+    });
+});
```

**File**: `packages/dockview-core/src/__tests__/paneview/paneviewComponent.spec.ts` (modified, +25/-0)
```diff
@@ -746,4 +746,29 @@ describe('paneviewComponent', () => {
 
         expect(paneview.element.className).toBe('test-b test-c');
     });
+    test('that panels added after clear() are attached and listed', () => {
+        const paneview = new PaneviewComponent(container, {
+            createComponent: (options) =>
+                new TestPanel(options.id, options.name),
+        });
+        paneview.layout(300, 200);
+
+        paneview.addPanel({ id: 'panel1', component: 'default', title: 'a' });
+        paneview.clear();
+
+        expect(paneview.panels).toHaveLength(0);
+
+        paneview.addPanel({ id: 'panel2', component: 'default', title: 'b' });
+
+        expect(paneview.panels.map((panel) => panel.id)).toEqual(['panel2']);
+        expect(
+            paneview.element.contains(paneview.getPanel('panel2')!.element)
+        ).toBe(true);
+
+        // only the restored paneview is mounted
+        paneview.fromJSON(paneview.toJSON());
+        expect(paneview.element.children).toHaveLength(1);
+
+        paneview.dispose();
+    });
 });
```

**File**: `packages/dockview-core/src/dockview/components/popupService.ts` (modified, +15/-9)
```diff
@@ -48,7 +48,8 @@ export class PopupService extends CompositeDisposable {
 
     openPopover(
         element: HTMLElement,
-        position: { x: number; y: number; zIndex?: string }
+        position: { x: number; y: number; zIndex?: string },
+        options?: { onClose?: () => void }
     ): void {
         this.close();
 
@@ -78,14 +79,19 @@ export class PopupService extends CompositeDisposable {
         // (e.g. focusing a rename input) rather than intent to dismiss.
         const POINTERDOWN_GRACE_MS = 200;
 
-        this._activeDisposable.value = createDismissableLayer({
-            window: this._window,
-            onDismiss: () => this.close(),
-            elements: () => (this._active ? [this._active] : []),
-            keys: ['Enter'],
-            pointerDownGraceMs: POINTERDOWN_GRACE_MS,
-            resize: true,
-        });
+        this._activeDisposable.value = new CompositeDisposable(
+            createDismissableLayer({
+                window: this._window,
+                onDismiss: () => this.close(),
+                elements: () => (this._active ? [this._active] : []),
+                keys: ['Enter'],
+                pointerDownGraceMs: POINTERDOWN_GRACE_MS,
+                resize: true,
+            }),
+            options?.onClose
+                ? Disposable.from(options.onClose)
+                : Disposable.NONE
+        );
 
         this._window.requestAnimationFrame(() => {
             shiftAbsoluteElementIntoView(wrapper, this._root);
```

---

### Incident Patch 5: `1fe4ee42` (2026-10-03)
**Commit Message**: test: cover chip menu renderer disposal when an item init throws

Co-Authored-By: Claude Opus 5.5 <[REDACTED_EMAIL]>
Claude-Session: https://claude.ai/code/session_01AuavYqfxLPdqw76C5TyYVz

**File**: `packages/dockview-core/src/__tests__/dockview/contextMenu.spec.ts` (modified, +29/-0)
```diff
@@ -1302,6 +1302,35 @@ describe('ContextMenuController', () => {
             expect(second.dispose).toHaveBeenCalledTimes(1);
         });
 
+        test('chip menu disposes the renderers built so far when an item init throws', () => {
+            const first = makeRenderer();
+            const second = makeRenderer();
+            second.init.mockImplementation(() => {
+                throw new Error('init failed');
+            });
+            const { accessor, openPopover } = makeAccessor({
+                getTabGroupChipContextMenuItems: jest
+                    .fn()
+                    .mockReturnValue([{ component: 'a' }, { component: 'b' }]),
+                createContextMenuItemComponent: jest
+                    .fn()
+                    .mockReturnValueOnce(first)
+                    .mockReturnValueOnce(second),
+            });
+
+            expect(() =>
+                new ContextMenuController(accessor).showForChip(
+                    fromPartial<ITabGroup>({}),
+                    makeGroup(),
+                    new MouseEvent('contextmenu', { cancelable: true })
+                )
+            ).toThrow('init failed');
+
+            expect(openPopover).not.toHaveBeenCalled();
+            expect(first.dispose).toHaveBeenCalledTimes(1);
+            expect(second.dispose).toHaveBeenCalledTimes(1);
+        });
+
         test('chip menu disposes its renderers on close', () => {
             const renderer = makeRenderer();
             const { accessor, openPopover } = makeAccessor({
```

---

### Incident Patch 6: `b5793c53` (2026-10-03)
**Commit Message**: fix: stop tracking a popout window whose open fails

Co-Authored-By: Claude Opus 5.5 <[REDACTED_EMAIL]>
Claude-Session: https://claude.ai/code/session_01AuavYqfxLPdqw76C5TyYVz

**File**: `packages/dockview-core/src/__tests__/dockview/rendererLifecycle.spec.ts` (modified, +20/-0)
```diff
@@ -419,6 +419,26 @@ describe('renderer lifecycle', () => {
             expectNothingAliveAfterDispose();
         });
 
+        test('a popout whose window fails to open is not left tracked', async () => {
+            const consoleError = jest
+                .spyOn(console, 'error')
+                .mockImplementation(() => {
+                    /* the failure is logged */
+                });
+            window.open = jest.fn(() => {
+                throw new Error('sandboxed');
+            });
+
+            create();
+            const p1 = dockview.addPanel({ id: 'p1', component: 'default' });
+
+            await expect(dockview.addPopoutGroup(p1)).resolves.toBe(false);
+            expect((dockview as any)._openingPopoutWindows.size).toBe(0);
+
+            consoleError.mockRestore();
+            expectNothingAliveAfterDispose();
+        });
+
         test('a popout that finishes opening after dispose() is abandoned', async () => {
             const deferred = setupDeferredMockWindow();
             const close = jest.spyOn(deferred.window, 'close');
```

**File**: `packages/dockview-core/src/dockview/dockviewComponent.ts` (modified, +1/-0)
```diff
@@ -2408,6 +2408,7 @@ export class DockviewComponent
                 return true;
             })
             .catch((err) => {
+                this._openingPopoutWindows.delete(popoutWindowDisposable);
                 console.error('dockview: failed to create popout.', err);
                 return false;
             });
```

---

### Incident Patch 7: `31a52c0d` (2026-10-03)
**Commit Message**: fix: close remaining disposal gaps found by a final audit

- the disposed-active-group fallback now also runs when the outermost
  synchronous mutation ends, so it is not deferred while an async popout
  holds the transaction open
- context menus and the overflow dropdown dispose the renderers already
  built when building the menu throws
- tests for the PopupService onClose contract, chip menu renderer disposal
  and the overflow row double-dispose guard

Co-Authored-By: Claude Opus 5.5 <[REDACTED_EMAIL]>
Claude-Session: https://claude.ai/code/session_01AuavYqfxLPdqw76C5TyYVz

**File**: `packages/dockview-core/src/__tests__/dockview/components/popupService.spec.ts` (modified, +47/-0)
```diff
@@ -30,6 +30,53 @@ describe('PopupService', () => {
         });
     });
 
+    describe('onClose', () => {
+        test('runs once when the popover closes', () => {
+            const onClose = jest.fn();
+            service.openPopover(
+                document.createElement('div'),
+                { x: 0, y: 0 },
+                { onClose }
+            );
+
+            service.close();
+            service.close();
+
+            expect(onClose).toHaveBeenCalledTimes(1);
+        });
+
+        test('runs for the replaced popover only', () => {
+            const first = jest.fn();
+            const second = jest.fn();
+            service.openPopover(
+                document.createElement('div'),
+                { x: 0, y: 0 },
+                { onClose: first }
+            );
+            service.openPopover(
+                document.createElement('div'),
+                { x: 0, y: 0 },
+                { onClose: second }
+            );
+
+            expect(first).toHaveBeenCalledTimes(1);
+            expect(second).not.toHaveBeenCalled();
+        });
+
+        test('runs when the service is disposed', () => {
+            const onClose = jest.fn();
+            service.openPopover(
+                document.createElement('div'),
+                { x: 0, y: 0 },
+                { onClose }
+            );
+
+            service.dispose();
+
+            expect(onClose).toHaveBeenCalledTimes(1);
+        });
+    });
+
     describe('openPopover', () => {
         test('appends wrapper containing the element into the anchor', () => {
             const el = document.createElement('div');
```

**File**: `packages/dockview-core/src/__tests__/dockview/components/titlebar/tabsContainer.spec.ts` (modified, +62/-0)
```diff
@@ -2161,6 +2161,67 @@ describe('tabsContainer', () => {
             expect(renderers[1].dispose).toHaveBeenCalledTimes(1);
         });
 
+        test('overflow rows are disposed when rendering the dropdown throws', () => {
+            const consoleError = jest
+                .spyOn(console, 'error')
+                .mockImplementation(() => {
+                    /* jsdom reports the listener error */
+                });
+            // the rethrown error is expected; a listener stops jest failing on it
+            const onError = (event: ErrorEvent) => event.preventDefault();
+            window.addEventListener('error', onError);
+            const accessor = makeAccessor({
+                getPopupServiceForGroup: () =>
+                    ({ openPopover: jest.fn(), close: jest.fn() }) as any,
+                advancedOverflowService: {
+                    renderOverflow: (args: any) => {
+                        args.context.buildRow('panel-a');
+                        throw new Error('render failed');
+                    },
+                } as any,
+            });
+
+            const dispose = jest.fn();
+            const mockPanel = fromPartial<IDockviewPanel>({
+                id: 'panel-a',
+                api: { isActive: false, setActive: jest.fn() },
+                view: {
+                    createTabRenderer: jest.fn(() => ({
+                        element: document.createElement('div'),
+                        dispose,
+                    })),
+                },
+            });
+            const group = makeGroup({
+                panels: [mockPanel],
+                model: fromPartial<DockviewGroupPanelModel>({
+                    getTabGroups: () => [],
+                }),
+            });
+
+            const cut = new TabsContainer(accessor, group);
+            (cut as any).tabs = makeOverflowMockTabs([
+                {
+                    panel: mockPanel,
+                    element: { scrollIntoView: jest.fn() },
+                },
+            ]);
+            (cut as any).toggleDropdown({
+                tabs: ['panel-a'],
+                tabGroups: [],
+                pinnedTabs: [],
+                reset: false,
+            });
+
+            fireEvent.click(
+                cut.element.querySelector('.dv-tabs-overflow-dropdown-root')!
+            );
+
+            expect(dispose).toHaveBeenCalledTimes(1);
+            window.removeEventListener('error', onError);
+            consoleError.mockRestore();
+        });
+
         test('overflow rows can be disposed before the popover closes', () => {
             let onClose: (() => void) | undefined;
             const mockPopupService = {
@@ -2219,6 +2280,7 @@ describe('tabsContainer', () => {
             const row = capturedContext.buildRow('panel-a');
             capturedContext.open(document.createElement('div'));
 
+            row.dispose();
             row.dispose();
             expect(dispose).toHaveBeenCalledTimes(1);
 
```

**File**: `packages/dockview-core/src/__tests__/dockview/contextMenu.spec.ts` (modified, +83/-0)
```diff
@@ -1242,6 +1242,89 @@ describe('ContextMenuController', () => {
         });
     });
 
+    describe('component item renderers', () => {
+        function makeRenderer() {
+            return {
+                element: document.createElement('div'),
+                init: jest.fn(),
+                dispose: jest.fn(),
+            };
+        }
+
+        test('tab menu disposes its renderers on close', () => {
+            const renderer = makeRenderer();
+            const { accessor, openPopover } = makeAccessor({
+                getTabContextMenuItems: jest
+                    .fn()
+                    .mockReturnValue([{ component: {} }]),
+                createContextMenuItemComponent: jest
+                    .fn()
+                    .mockReturnValue(renderer),
+            });
+
+            new ContextMenuController(accessor).show(
+                makePanel(),
+                makeGroup(),
+                new MouseEvent('contextmenu')
+            );
+            expect(renderer.dispose).not.toHaveBeenCalled();
+
+            openPopover.mock.calls[0][2].onClose();
+            expect(renderer.dispose).toHaveBeenCalledTimes(1);
+        });
+
+        test('disposes the renderers built so far when an item init throws', () => {
+            const first = makeRenderer();
+            const second = makeRenderer();
+            second.init.mockImplementation(() => {
+                throw new Error('init failed');
+            });
+            const { accessor, openPopover } = makeAccessor({
+                getTabContextMenuItems: jest
+                    .fn()
+                    .mockReturnValue([{ component: 'a' }, { component: 'b' }]),
+                createContextMenuItemComponent: jest
+                    .fn()
+                    .mockReturnValueOnce(first)
+                    .mockReturnValueOnce(second),
+            });
+
+            expect(() =>
+                new ContextMenuController(accessor).show(
+                    makePanel(),
+                    makeGroup(),
+                    new MouseEvent('contextmenu')
+                )
+            ).toThrow('init failed');
+
+            expect(openPopover).not.toHaveBeenCalled();
+            expect(first.dispose).toHaveBeenCalledTimes(1);
+            expect(second.dispose).toHaveBeenCalledTimes(1);
+        });
+
+        test('chip menu disposes its renderers on close', () => {
+            const renderer = makeRenderer();
+            const { accessor, openPopover } = makeAccessor({
+                getTabGroupChipContextMenuItems: jest
+                    .fn()
+                    .mockReturnValue([{ component: {} }]),
+                createContextMenuItemComponent: jest
+                    .fn()
+                    .mockReturnValue(renderer),
+            });
+
+            new ContextMenuController(accessor).showForChip(
+                fromPartial<ITabGroup>({}),
+                makeGroup(),
+                new MouseEvent('contextmenu', { cancelable: true })
+            );
+            expect(renderer.dispose).not.toHaveBeenCalled();
+
+            openPopover.mock.calls[0][2].onClose();
+            expect(renderer.dispose).toHaveBeenCalledTimes(1);
+        });
+    });
+
     describe("built-in chip 'collapse' item", () => {
         function makeChipAccessor(items: unknown[]) {
             const openPopover = jest.fn();
```

**File**: `packages/dockview-core/src/__tests__/dockview/rendererLifecycle.spec.ts` (modified, +36/-0)
```diff
@@ -383,6 +383,42 @@ describe('renderer lifecycle', () => {
             window.open = originalOpen;
         });
 
+        test('a skipSetActive removal falls back while a popout is still opening', async () => {
+            const deferred = setupDeferredMockWindow();
+            window.open = jest.fn(() => deferred.window);
+
+            create();
+            const p1 = dockview.addPanel({ id: 'p1', component: 'default' });
+            const p2 = dockview.addPanel({
+                id: 'p2',
+                component: 'default',
+                position: { direction: 'right' },
+            });
+            const p3 = dockview.addPanel({
+                id: 'p3',
+                component: 'default',
+                position: { direction: 'right' },
+            });
+            p1.api.setActive();
+            const removed = p1.group;
+
+            const opened = dockview.addPopoutGroup(p3);
+            p1.api.moveTo({
+                group: p2.group,
+                position: 'center',
+                skipSetActive: true,
+            });
+
+            expect(removed.model.isDisposed).toBe(true);
+            expect(dockview.activeGroup?.model.isDisposed).toBe(false);
+            const p4 = dockview.addPanel({ id: 'p4', component: 'default' });
+            expect(p4.group.model.isDisposed).toBe(false);
+
+            deferred.load();
+            await opened;
+            expectNothingAliveAfterDispose();
+        });
+
         test('a popout that finishes opening after dispose() is abandoned', async () => {
             const deferred = setupDeferredMockWindow();
             const close = jest.spyOn(deferred.window, 'close');
```

**File**: `packages/dockview-core/src/dockview/components/titlebar/tabsContainer.ts` (modified, +23/-13)
```diff
@@ -539,23 +539,29 @@ export class TabsContainer
                         : undefined,
                 };
 
-                const context = this.createOverflowRenderContext(root, anchor);
+                const { context, rowRenderers } =
+                    this.createOverflowRenderContext(root, anchor);
 
                 // When the AdvancedOverflowModule is registered it upgrades the
                 // dropdown in place (search + MRU + keyboard), building and
                 // opening the popover itself. Absent (the free path), core
                 // renders the flat list and opens it, byte-identical to before.
                 const advancedOverflow = this.accessor.advancedOverflowService;
-                if (advancedOverflow) {
-                    advancedOverflow.renderOverflow({
-                        group: this.group,
-                        overflowTabs: [...this._overflowTabs],
-                        overflowTabGroups: [...this._overflowTabGroups],
-                        pinnedOverflowTabs: [...this._overflowPinnedTabs],
-                        context,
-                    });
-                } else {
-                    context.open(this.renderFreeOverflowList(context));
+                try {
+                    if (advancedOverflow) {
+                        advancedOverflow.renderOverflow({
+                            group: this.group,
+                            overflowTabs: [...this._overflowTabs],
+                            overflowTabGroups: [...this._overflowTabGroups],
+                            pinnedOverflowTabs: [...this._overflowPinnedTabs],
+                            context,
+                        });
+                    } else {
+                        context.open(this.renderFreeOverflowList(context));
+                    }
+                } catch (err) {
+                    rowRenderers.dispose();
+                    throw err;
                 }
             })
         );
@@ -572,7 +578,10 @@ export class TabsContainer
     private createOverflowRenderContext(
         root: HTMLElement,
         anchor: { x: number; y: number; zIndex?: string }
-    ): IAdvancedOverflowRenderContext {
+    ): {
+        context: IAdvancedOverflowRenderContext;
+        rowRenderers: CompositeDisposable;
+    } {
         // Build lookup: panelId → tabGroup for overflow groups.
         const overflowGroupSet = new Set(this._overflowTabGroups);
         const allTabGroups = this.group.model.getTabGroups();
@@ -638,7 +647,7 @@ export class TabsContainer
             return groupHeader;
         };
 
-        return {
+        const context: IAdvancedOverflowRenderContext = {
             overflowGroupIdForPanel: (panelId) => panelToGroup.get(panelId)?.id,
             buildGroupHeader: (tabGroupId) => {
                 const tg = groupById.get(tabGroupId);
@@ -750,6 +759,7 @@ export class TabsContainer
                 root.focus();
             },
         };
+        return { context, rowRenderers };
     }
 
     /**
```

**File**: `packages/dockview-core/src/dockview/contextMenuService.ts` (modified, +56/-46)
```diff
@@ -424,22 +424,27 @@ export class ContextMenuController implements IContextMenuService {
         menuEl.className = 'dv-context-menu';
         menuEl.setAttribute('role', 'menu');
 
-        for (const item of items) {
-            if (isItemConfig(item)) {
-                this.appendConfigItem(
-                    menuEl,
-                    item,
-                    { panel },
-                    group,
-                    close,
-                    renderers
-                );
-                continue;
-            }
-            const el = this.buildBuiltInTabItem(item, panel, group, close);
-            if (el) {
-                menuEl.appendChild(el);
+        try {
+            for (const item of items) {
+                if (isItemConfig(item)) {
+                    this.appendConfigItem(
+                        menuEl,
+                        item,
+                        { panel },
+                        group,
+                        close,
+                        renderers
+                    );
+                    continue;
+                }
+                const el = this.buildBuiltInTabItem(item, panel, group, close);
+                if (el) {
+                    menuEl.appendChild(el);
+                }
             }
+        } catch (err) {
+            renderers.dispose();
+            throw err;
         }
 
         popupService.openPopover(
@@ -482,38 +487,43 @@ export class ContextMenuController implements IContextMenuService {
         menuEl.className = 'dv-context-menu';
         menuEl.setAttribute('role', 'menu');
 
-        for (const item of items) {
-            if (item === 'separator') {
-                menuEl.appendChild(buildSeparator());
-            } else if (item === 'rename') {
-                menuEl.appendChild(buildRenameInput(tabGroup));
-            } else if (item === 'colorPicker') {
-                menuEl.appendChild(
-                    buildColorPicker(
-                        tabGroup,
-                        this.accessor.tabGroupColorPalette
-                    )
-                );
-            } else if (item === 'collapse') {
-                menuEl.appendChild(this.buildCollapseItem(tabGroup, close));
-            } else if (item === 'close') {
-                menuEl.appendChild(
-                    buildItem('Close All', close, () => {
-                        group.panels
-                            .filter((p) => tabGroup.containsPanel(p.id))
-                            .forEach((p) => p.api.close());
-                    })
-                );
-            } else if (isItemConfig(item)) {
-                this.appendConfigItem(
-                    menuEl,
-                    item,
-                    { tabGroup },
-                    group,
-                    close,
-                    renderers
-                );
+        try {
+            for (const item of items) {
+                if (item === 'separator') {
+                    menuEl.appendChild(buildSeparator());
+                } else if (item === 'rename') {
+                    menuEl.appendChild(buildRenameInput(tabGroup));
+                } else if (item === 'colorPicker') {
+                    menuEl.appendChild(
+                        buildColorPicker(
+                            tabGroup,
+                            this.accessor.tabGroupColorPalette
+                        )
+                    );
+                } else if (item === 'collapse') {
+                    menuEl.appendChild(this.buildCollapseItem(tabGroup, close));
+                } else if (item === 'close') {
+                    menuEl.appendChild(
+                        buildItem('Close All', close, () => {
+                            group.panels
+                                .filter((p) => tabGroup.containsPanel(p.id))
+                                .forEach((p) => p.api.close());
+                        })
+                    );
+                } else if (isItemConfig(item)) {
+                    this.appendConfigItem(
+                        menuEl,
+                        item,
+                        { tabGroup },
+                        group,
+                        close,
+                        renderers
+                    );
+                }
             }
+        } catch (err) {
+            renderers.dispose();
+            throw err;
         }
 
         popupService.openPopover(
```

**File**: `packages/dockview-core/src/dockview/dockviewComponent.ts` (modified, +8/-0)
```diff
@@ -614,6 +614,8 @@ export class DockviewComponent
     // Compound operations (e.g. a drag that relocates a panel) nest via the
     // depth counter and bracket as a single transaction. See `mutation()`.
     private _mutationDepth = 0;
+    // depth of synchronous `mutation()` calls only
+    private _syncMutationDepth = 0;
     // Panel location events awaiting the end of the current transaction, keyed
     // by the panel api that owns them so a panel reports at most once per
     // transaction. See `deferLocationChange()`.
@@ -5061,9 +5063,15 @@ export class DockviewComponent
      */
     mutation<T>(kind: DockviewLayoutMutationKind, func: () => T): T {
         const close = this.openMutation(kind);
+        this._syncMutationDepth++;
         try {
             return func();
         } finally {
+            this._syncMutationDepth--;
+            // an async popout can hold the transaction open past this point
+            if (this._syncMutationDepth === 0) {
+                this.releaseDisposedActiveGroup();
+            }
             close();
         }
     }
```

---

### Incident Patch 8: `6d8741c5` (2026-10-03)
**Commit Message**: fix: dispose overflow rows discarded by an advanced overflow re-render

Overflow rows gain dispose(); the advanced overflow list disposes the
previous rows each time it re-renders, instead of leaving them alive until
the popover closes.

Co-Authored-By: Claude Opus 5.5 <[REDACTED_EMAIL]>
Claude-Session: https://claude.ai/code/session_01AuavYqfxLPdqw76C5TyYVz

**File**: `packages/dockview-core/src/__tests__/dockview/components/titlebar/tabsContainer.spec.ts` (modified, +65/-0)
```diff
@@ -2160,6 +2160,71 @@ describe('tabsContainer', () => {
             capturedContext.buildRow('panel-a');
             expect(renderers[1].dispose).toHaveBeenCalledTimes(1);
         });
+
+        test('overflow rows can be disposed before the popover closes', () => {
+            let onClose: (() => void) | undefined;
+            const mockPopupService = {
+                openPopover: jest.fn((_el, _pos, options) => {
+                    onClose = options?.onClose;
+                }),
+                close: jest.fn(() => onClose?.()),
+            };
+
+            let capturedContext: any;
+            const accessor = makeAccessor({
+                getPopupServiceForGroup: () => mockPopupService as any,
+                advancedOverflowService: {
+                    renderOverflow: (args: any) => {
+                        capturedContext = args.context;
+                    },
+                } as any,
+            });
+
+            const dispose = jest.fn();
+            const mockPanel = fromPartial<IDockviewPanel>({
+                id: 'panel-a',
+                api: { isActive: false, setActive: jest.fn() },
+                view: {
+                    createTabRenderer: jest.fn(() => ({
+                        element: document.createElement('div'),
+                        dispose,
+                    })),
+                },
+            });
+
+            const group = makeGroup({
+                panels: [mockPanel],
+                model: fromPartial<DockviewGroupPanelModel>({
+                    getTabGroups: () => [],
+                }),
+            });
+
+            const cut = new TabsContainer(accessor, group);
+            (cut as any).tabs = makeOverflowMockTabs([
+                {
+                    panel: mockPanel,
+                    element: { scrollIntoView: jest.fn() },
+                },
+            ]);
+            (cut as any).toggleDropdown({
+                tabs: ['panel-a'],
+                tabGroups: [],
+                pinnedTabs: [],
+                reset: false,
+            });
+            fireEvent.click(
+                cut.element.querySelector('.dv-tabs-overflow-dropdown-root')!
+            );
+
+            const row = capturedContext.buildRow('panel-a');
+            capturedContext.open(document.createElement('div'));
+
+            row.dispose();
+            expect(dispose).toHaveBeenCalledTimes(1);
+
+            capturedContext.close();
+            expect(dispose).toHaveBeenCalledTimes(1);
+        });
         test('free overflow list renders pinned section and group headers', () => {
             const mockPopupService = {
                 openPopover: jest.fn(),
```

**File**: `packages/dockview-core/src/dockview/components/titlebar/tabsContainer.ts` (modified, +13/-4)
```diff
@@ -673,13 +673,18 @@ export class TabsContainer
 
                 const tabComponent =
                     panel.view.createTabRenderer('headerOverflow');
+                let rowDisposed = false;
+                const disposeRow = Disposable.from(() => {
+                    if (!rowDisposed) {
+                        rowDisposed = true;
+                        tabComponent.dispose?.();
+                    }
+                });
                 if (rowRenderers.isDisposed) {
                     // built after the popover closed
-                    tabComponent.dispose?.();
+                    disposeRow.dispose();
                 } else {
-                    rowRenderers.addDisposables(
-                        Disposable.from(() => tabComponent.dispose?.())
-                    );
+                    rowRenderers.addDisposables(disposeRow);
                 }
                 const child = tabComponent.element;
 
@@ -726,6 +731,10 @@ export class TabsContainer
                         popup().close();
                         doActivate();
                     },
+                    dispose: () => {
+                        rowRenderers.removeDisposable(disposeRow);
+                        disposeRow.dispose();
+                    },
                 };
             },
             open: (body) => {
```

**File**: `packages/dockview-core/src/dockview/moduleContracts.ts` (modified, +2/-0)
```diff
@@ -654,6 +654,8 @@ export interface IOverflowRow {
      * the keyboard controller (Enter).
      */
     activate(): void;
+    /** Disposes the row's tab renderer. */
+    dispose(): void;
 }
 
 /**
```

**File**: `packages/dockview-enterprise/src/__tests__/advancedOverflow.spec.ts` (modified, +16/-1)
```diff
@@ -34,6 +34,7 @@ interface FakePanel {
 }
 
 function makeFakeContext(activateSpy?: (id: string) => void) {
+    const liveRows = new Set<HTMLElement>();
     const opened: { body?: HTMLElement } = {};
     const closed = { count: 0 };
     const focused = { count: 0 };
@@ -43,10 +44,12 @@ function makeFakeContext(activateSpy?: (id: string) => void) {
             element.className = 'dv-tab';
             element.dataset.panelId = panelId;
             element.textContent = panelId;
+            liveRows.add(element);
             return {
                 element,
                 panel: { id: panelId } as any,
                 activate: () => activateSpy?.(panelId),
+                dispose: () => liveRows.delete(element),
             };
         },
         buildGroupHeader: () => undefined,
@@ -70,7 +73,7 @@ function makeFakeContext(activateSpy?: (id: string) => void) {
             focused.count++;
         },
     };
-    return { context, opened, closed, focused };
+    return { context, opened, closed, focused, liveRows };
 }
 
 function makeParams(
@@ -367,6 +370,18 @@ describe('OverflowListView: search filtering + keyboard', () => {
         view.dispose();
     });
 
+    test('re-rendering disposes the previous rows', () => {
+        const { view, input, liveRows } = setup();
+        expect(liveRows.size).toBe(3);
+
+        input.value = 'lph';
+        fireEvent.input(input);
+        jest.advanceTimersByTime(80);
+
+        expect(liveRows.size).toBe(1);
+        view.dispose();
+    });
+
     test('arrow keys rove the active option and wrap; Enter activates it', () => {
         const activated: string[] = [];
         const { view, input, opened } = setup((id) => activated.push(id));
```

**File**: `packages/dockview-enterprise/src/advancedOverflowService.ts` (modified, +5/-0)
```diff
@@ -82,6 +82,7 @@ export class OverflowListView extends CompositeDisposable {
         id: string;
         element: HTMLElement;
         activate: () => void;
+        dispose: () => void;
     }[] = [];
     private _activeIndex = -1;
     private _debounce: { win: Window; handle: number } | undefined;
@@ -240,6 +241,7 @@ export class OverflowListView extends CompositeDisposable {
             id,
             element: row.element,
             activate: row.activate,
+            dispose: row.dispose,
         });
     }
 
@@ -249,6 +251,9 @@ export class OverflowListView extends CompositeDisposable {
         while (this._list.firstChild) {
             this._list.firstChild.remove();
         }
+        for (const row of this._rows) {
+            row.dispose();
+        }
         this._rows = [];
 
         // Pinned tabs that clipped out of the strip render first, under a
```

---

### Incident Patch 9: `fb9b1b7a` (2026-10-03)
**Commit Message**: Merge remote-tracking branch 'origin/master' into fix/use-after-dispose-leaks



---

### Incident Patch 10: `a92fbd44` (2026-10-03)
**Commit Message**: Merge pull request #1662 from dockview/fix/1661-disposed-group-watermark-leak

fix: don't recreate a watermark on a disposed group

**File**: `packages/dockview-core/src/__tests__/dockview/dockviewComponent.spec.ts` (modified, +40/-0)
```diff
@@ -5710,6 +5710,46 @@ describe('dockviewComponent', () => {
         ).toHaveLength(0);
     });
 
+    test('removing the last panel of the active group does not leak a watermark', () => {
+        // https://github.com/dockview/dockview/issues/1661
+        const container = document.createElement('div');
+
+        let created = 0;
+        const alive = new Set<number>();
+
+        const dockview = new DockviewComponent(container, {
+            createComponent(options) {
+                return new PanelContentPartTest(options.id, options.name);
+            },
+            createWatermarkComponent: () => {
+                const id = ++created;
+                alive.add(id);
+                return {
+                    element: document.createElement('div'),
+                    init: () => {
+                        /* noop */
+                    },
+                    dispose: () => {
+                        alive.delete(id);
+                    },
+                };
+            },
+        });
+        dockview.layout(800, 600);
+
+        for (let i = 1; i <= 3; i++) {
+            const panel = dockview.addPanel({
+                id: `panel${i}`,
+                component: 'default',
+            });
+            dockview.removePanel(panel);
+
+            // Only the dockview-level watermark should be alive.
+            expect(dockview.groups).toHaveLength(0);
+            expect(alive.size).toBe(1);
+        }
+    });
+
     test('that deserializing an empty layout has zero groups and a watermark', () => {
         const container = document.createElement('div');
 
```

**File**: `packages/dockview-core/src/dockview/dockviewGroupPanelModel.ts` (modified, +3/-0)
```diff
@@ -1597,6 +1597,9 @@ export class DockviewGroupPanelModel
     }
 
     public setActive(isGroupActive: boolean, force = false): void {
+        if (this.isDisposed) {
+            return;
+        }
         if (!force && this.isActive === isGroupActive) {
             return;
         }
```

---

### Incident Patch 11: `68afa2f0` (2026-10-03)
**Commit Message**: Merge branch 'fix/1661-disposed-group-watermark-leak' into fix/use-after-dispose-leaks

**File**: `packages/dockview-core/src/dockview/dockviewGroupPanelModel.ts` (modified, +0/-1)
```diff
@@ -1597,7 +1597,6 @@ export class DockviewGroupPanelModel
     }
 
     public setActive(isGroupActive: boolean, force = false): void {
-        // no-op once disposed
         if (this.isDisposed) {
             return;
         }
```

---

### Incident Patch 12: `115e3450` (2026-10-03)
**Commit Message**: fix: dispose overflow rows built after the popover closed

The advanced overflow search debounce can render rows after the popover
has closed; those renderers were added to an already-disposed collection.

Co-Authored-By: Claude Opus 5.5 <[REDACTED_EMAIL]>
Claude-Session: https://claude.ai/code/session_01AuavYqfxLPdqw76C5TyYVz

**File**: `packages/dockview-core/src/__tests__/dockview/components/titlebar/tabsContainer.spec.ts` (modified, +70/-0)
```diff
@@ -2090,6 +2090,76 @@ describe('tabsContainer', () => {
             expect(() => capturedContext.focusTrigger()).not.toThrow();
         });
 
+        test('overflow rows built after the popover closes are disposed', () => {
+            let owned: { dispose(): void } | undefined;
+            const mockPopupService = {
+                openPopover: jest.fn((_el, _pos, disposable) => {
+                    owned = disposable;
+                }),
+                close: jest.fn(() => owned?.dispose()),
+            };
+
+            let capturedContext: any;
+            const accessor = makeAccessor({
+                getPopupServiceForGroup: () => mockPopupService as any,
+                advancedOverflowService: {
+                    renderOverflow: (args: any) => {
+                        capturedContext = args.context;
+                    },
+                } as any,
+            });
+
+            const renderers: { dispose: jest.Mock }[] = [];
+            const mockPanel = fromPartial<IDockviewPanel>({
+                id: 'panel-a',
+                api: { isActive: false, setActive: jest.fn() },
+                view: {
+                    createTabRenderer: jest.fn(() => {
+                        const renderer = {
+                            element: document.createElement('div'),
+                            dispose: jest.fn(),
+                        };
+                        renderers.push(renderer);
+                        return renderer;
+                    }),
+                },
+            });
+
+            const group = makeGroup({
+                panels: [mockPanel],
+                model: fromPartial<DockviewGroupPanelModel>({
+                    getTabGroups: () => [],
+                }),
+            });
+
+            const cut = new TabsContainer(accessor, group);
+            (cut as any).tabs = makeOverflowMockTabs([
+                {
+                    panel: mockPanel,
+                    element: { scrollIntoView: jest.fn() },
+                },
+            ]);
+            (cut as any).toggleDropdown({
+                tabs: ['panel-a'],
+                tabGroups: [],
+                pinnedTabs: [],
+                reset: false,
+            });
+            fireEvent.click(
+                cut.element.querySelector('.dv-tabs-overflow-dropdown-root')!
+            );
+
+            capturedContext.buildRow('panel-a');
+            capturedContext.open(document.createElement('div'));
+            expect(renderers[0].dispose).not.toHaveBeenCalled();
+
+            capturedContext.close();
+            expect(renderers[0].dispose).toHaveBeenCalledTimes(1);
+
+            // e.g. a debounced search re-rendering after the popover closed
+            capturedContext.buildRow('panel-a');
+            expect(renderers[1].dispose).toHaveBeenCalledTimes(1);
+        });
         test('free overflow list renders pinned section and group headers', () => {
             const mockPopupService = {
                 openPopover: jest.fn(),
```

**File**: `packages/dockview-core/src/dockview/components/titlebar/tabsContainer.ts` (modified, +8/-3)
```diff
@@ -674,9 +674,14 @@ export class TabsContainer
 
                 const tabComponent =
                     panel.view.createTabRenderer('headerOverflow');
-                rowRenderers.addDisposables(
-                    Disposable.from(() => tabComponent.dispose?.())
-                );
+                if (rowRenderers.isDisposed) {
+                    // built after the popover closed
+                    tabComponent.dispose?.();
+                } else {
+                    rowRenderers.addDisposables(
+                        Disposable.from(() => tabComponent.dispose?.())
+                    );
+                }
                 const child = tabComponent.element;
 
                 const wrapper = document.createElement('div');
```

---

### Incident Patch 13: `3d0b7864` (2026-10-03)
**Commit Message**: fix: fall back to the first group when a skipActive removal disposes the active group

Matches removeGroup instead of leaving no active group, so the next
addPanel() still tabs into an existing group.

Co-Authored-By: Claude Opus 5.5 <[REDACTED_EMAIL]>
Claude-Session: https://claude.ai/code/session_01AuavYqfxLPdqw76C5TyYVz

**File**: `packages/dockview-core/src/__tests__/dockview/rendererLifecycle.spec.ts` (modified, +5/-1)
```diff
@@ -206,8 +206,12 @@ describe('renderer lifecycle', () => {
         }
 
         function expectNextPanelLandsInALiveGroup() {
-            expect(dockview.activeGroup?.model.isDisposed ?? false).toBe(false);
+            // falls back to the first remaining group, as removeGroup does
+            const fallback = dockview.groups[0];
+            expect(dockview.activeGroup?.id).toBe(fallback.id);
+            expect(fallback.model.isDisposed).toBe(false);
             const c = dockview.addPanel({ id: 'c', component: 'default' });
+            expect(c.group.id).toBe(fallback.id);
             expect(c.group.model.isDisposed).toBe(false);
             expect(dockview.panels.map((p) => p.id)).toContain('c');
             expect(groupIds()).toContain(c.group.id);
```

**File**: `packages/dockview-core/src/dockview/dockviewComponent.ts` (modified, +3/-3)
```diff
@@ -5123,12 +5123,12 @@ export class DockviewComponent
     }
 
     /**
-     * Clears the active group if it was disposed by a removal that skipped
-     * re-activation (`skipActive`).
+     * Activates the first remaining group if the active group was disposed by
+     * a removal that skipped re-activation (`skipActive`).
      */
     private releaseDisposedActiveGroup(): void {
         if (!this.isDisposed && this._activeGroup?.model.isDisposed) {
-            this.doSetGroupAndPanelActive(undefined);
+            this.activateFallbackGroupIfRemoved(this._activeGroup);
         }
     }
 
```

---

### Incident Patch 14: `73be1fe6` (2026-10-02)
**Commit Message**: Merge branch 'fix/1661-disposed-group-watermark-leak' into fix/use-after-dispose-leaks

**File**: `packages/dockview-core/src/dockview/dockviewGroupPanelModel.ts` (modified, +1/-2)
```diff
@@ -1597,8 +1597,7 @@ export class DockviewGroupPanelModel
     }
 
     public setActive(isGroupActive: boolean, force = false): void {
-        // A removed group is deactivated after disposal; touching it then
-        // would recreate a watermark that nothing disposes (#1661).
+        // no-op once disposed
         if (this.isDisposed) {
             return;
         }
```

---

### Incident Patch 15: `5dbec5ac` (2026-10-02)
**Commit Message**: fix: stop deferred floating and resize callbacks running after dispose

- the z-index MutationObserver for an always-rendered floating panel is
  created in a microtask; if the panel was detached first (closed in the
  same tick) the observer was never disconnected
- watchElementResize now cancels its pending animation frames on dispose,
  so callers no longer lay out disposed gridviews or reschedule work from
  a resize that arrived just before teardown

Co-Authored-By: Claude Opus 5.5 <[REDACTED_EMAIL]>
Claude-Session: https://claude.ai/code/session_01AuavYqfxLPdqw76C5TyYVz

**File**: `packages/dockview-core/src/__tests__/dockview/rendererLifecycle.spec.ts` (modified, +43/-0)
```diff
@@ -2,6 +2,7 @@ import { fireEvent } from '@testing-library/dom';
 import { DockviewComponent } from '../../dockview/dockviewComponent';
 import { DockviewComponentOptions } from '../../dockview/options';
 import { setupDeferredMockWindow } from '../__mocks__/mockWindow';
+import { exhaustMicrotaskQueue } from '../__test_utils__/utils';
 import {
     createRendererTracker,
     RendererTracker,
@@ -415,4 +416,46 @@ describe('renderer lifecycle', () => {
             });
         });
     });
+    describe('floating groups', () => {
+        test('closing an always-rendered floating panel in the tick it was added leaves no observer behind', async () => {
+            const RealMutationObserver = globalThis.MutationObserver;
+            const live = new Set<MutationObserver>();
+            globalThis.MutationObserver = class extends RealMutationObserver {
+                observe(target: Node, options?: MutationObserverInit): void {
+                    live.add(this);
+                    super.observe(target, options);
+                }
+                disconnect(): void {
+                    live.delete(this);
+                    super.disconnect();
+                }
+            };
+
+            try {
+                create({ defaultRenderer: 'always' });
+                const p1 = dockview.addPanel({
+                    id: 'p1',
+                    component: 'default',
+                    floating: true,
+                });
+                await exhaustMicrotaskQueue();
+                const baseline = live.size;
+
+                const p2 = dockview.addPanel({
+                    id: 'p2',
+                    component: 'default',
+                    position: { referenceGroup: p1.group },
+                });
+                p2.api.close();
+                await exhaustMicrotaskQueue();
+
+                expect(live.size).toBe(baseline);
+
+                expectNothingAliveAfterDispose();
+                expect(live.size).toBe(0);
+            } finally {
+                globalThis.MutationObserver = RealMutationObserver;
+            }
+        });
+    });
 });
```

**File**: `packages/dockview-core/src/__tests__/dom.spec.ts` (modified, +50/-0)
```diff
@@ -18,6 +18,7 @@ import {
     quasiPreventDefault,
     resolveOpaqueBackground,
     trackFocus,
+    watchElementResize,
 } from '../dom';
 
 function stubRect(
@@ -830,3 +831,52 @@ describe('shadow-DOM-aware event targeting', () => {
         );
     });
 });
+
+describe('watchElementResize', () => {
+    test('a resize pending when disposed never reaches the callback', () => {
+        const originalResizeObserver = window.ResizeObserver;
+        let notify: ((entries: ResizeObserverEntry[]) => void) | undefined;
+        window.ResizeObserver = class {
+            constructor(cb: (entries: ResizeObserverEntry[]) => void) {
+                notify = cb;
+            }
+            observe() {
+                /* noop */
+            }
+            unobserve() {
+                /* noop */
+            }
+            disconnect() {
+                /* noop */
+            }
+        } as unknown as typeof ResizeObserver;
+
+        const frames: FrameRequestCallback[] = [];
+        const raf = jest
+            .spyOn(window, 'requestAnimationFrame')
+            .mockImplementation((cb) => frames.push(cb));
+        const caf = jest
+            .spyOn(window, 'cancelAnimationFrame')
+            .mockImplementation((id) => {
+                frames[id - 1] = () => {
+                    /* cancelled */
+                };
+            });
+
+        try {
+            const cb = jest.fn();
+            const element = document.createElement('div');
+            const disposable = watchElementResize(element, cb);
+
+            notify!([{ target: element } as unknown as ResizeObserverEntry]);
+            disposable.dispose();
+            frames.forEach((frame) => frame(0));
+
+            expect(cb).not.toHaveBeenCalled();
+        } finally {
+            raf.mockRestore();
+            caf.mockRestore();
+            window.ResizeObserver = originalResizeObserver;
+        }
+    });
+});
```

**File**: `packages/dockview-core/src/dom.ts` (modified, +19/-1)
```diff
@@ -39,16 +39,30 @@ export function watchElementResize(
     element: HTMLElement,
     cb: (entry: ResizeObserverEntry) => void
 ): IDisposable {
+    // Frames still pending; cancelled on dispose so the callback never runs
+    // against an owner that has already been torn down.
+    const pendingFrames = new Set<number>();
+
     const observer = new ResizeObserver((entires) => {
         /**
          * Fast browser window resize produces Error: ResizeObserver loop limit exceeded.
          * The error isn't visible in browser console, doesn't affect functionality, but degrades performance.
          * See https://stackoverflow.com/questions/49384120/resizeobserver-loop-limit-exceeded/58701523#58701523
          */
-        requestAnimationFrame(() => {
+        let ran = false;
+        let frame: number | undefined;
+        frame = requestAnimationFrame(() => {
+            ran = true;
+            if (frame !== undefined) {
+                pendingFrames.delete(frame);
+            }
             const firstEntry = entires[0];
             cb(firstEntry);
         });
+        // a synchronous scheduler has already run it
+        if (!ran) {
+            pendingFrames.add(frame);
+        }
     });
 
     observer.observe(element);
@@ -57,6 +71,10 @@ export function watchElementResize(
         dispose: () => {
             observer.unobserve(element);
             observer.disconnect();
+            for (const frame of pendingFrames) {
+                cancelAnimationFrame(frame);
+            }
+            pendingFrames.clear();
         },
     };
 }
```

**File**: `packages/dockview-core/src/overlay/overlayRenderContainer.ts` (modified, +7/-0)
```diff
@@ -466,6 +466,13 @@ export class OverlayRenderContainer extends CompositeDisposable {
         const correctLayerPosition = () => {
             if (panel.api.location.type === 'floating') {
                 queueMicrotask(() => {
+                    // Detached before the microtask ran (e.g. the panel was
+                    // closed in the same tick): an observer created now would
+                    // never be disconnected.
+                    if (disposable.isDisposed) {
+                        return;
+                    }
+
                     // Resolve by membership, not anchor identity: a floating
                     // window can host a nested gridview, so a panel split into
                     // it lives in a non-anchor member group. Matching only the
```

#### Recent Merged Pull Requests:
- **PR #1665** (closed): chore(deps): Bump piscina from 5.1.4 to 5.3.2 (@dependabot[bot])
- **PR #1664** (2026-10-04): fix(dockview-core): mark popout promise in context menu as intentionally ignored (@mathuo)
- **PR #1663** (2026-10-04): fix: renderers and panels leaked after disposal (@mathuo)
- **PR #1662** (2026-10-03): fix: don't recreate a watermark on a disposed group (@mathuo)
- **PR #1660** (2026-10-01): feat(theme): variable-only themes, plus slate/connected-tab fixes (@mathuo)
- **PR #1659** (2026-09-30): docs: fix mobile navbar menu being clipped in dark mode (@mathuo)
- **PR #1658** (closed): build(deps): bump undici from 7.25.0 to 7.30.0 (@dependabot[bot])
- **PR #1657** (2026-09-24): fix(core): shadow-DOM follow-ups — one focus helper, a layer that knows its own tree (@mathuo)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
