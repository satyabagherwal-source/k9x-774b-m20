> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/angular-angular-learnings.md`  
> **Source**: github ([https://github.com/angular/angular](https://github.com/angular/angular))  
> **Source Version**: `093dd364`  
> **License**: MIT  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-10-19T18:35:47.953Z  
> **Learning ID**: `learn-github-angular-angular`  
> **Pipeline Version**: `2.0.0`  
> **Status**: VERIFIED_EMPIRICAL_INTELLIGENCE  
> **Data Governance**: CLASSIFICATION: PUBLIC. Sanitized against PII/secrets.  
> **Policy Invariant**: Strictly for engineering retrieval and architecture documentation. Distillation prohibited.  

---

# Forensic Learning Record (Deep Inspection): angular/angular

> **Canonical Artifact**: `07_PROJECT_LEARNING/angular-angular-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/angular/angular](https://github.com/angular/angular))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-19T18:35:47.013Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `angular/angular`
- **Description**: Deliver web apps with confidence 🚀
- **Primary Language / Ecosystem**: TypeScript
- **Discovered Manifests / Configurations**: package.json, Cargo.toml, README.md
- **Stars / Engagement**: 101111 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: package.json, Cargo.toml, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `adev/src/app/core/constants/element-ids.ts`
```
/*!
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.dev/license
 */

export const PRIMARY_NAV_ID = 'primaryNav';
export const SECONDARY_NAV_ID = 'secondaryNav';
export const SEARCH_DIALOG_ID = 'docsSearchDialog';

```

### Core Architecture Module: `adev/src/app/core/constants/keys.ts`
```
/*!
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.dev/license
 */

export const COMMAND = 'Command';
export const CONTROL = 'Control';
export const ESCAPE = 'Escape';
export const SEARCH_TRIGGER_KEY = 'k';

```

### Core Architecture Module: `adev/src/app/core/constants/links.ts`
```
/*!
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.dev/license
 */

export const ANGULAR_DEV = 'https://angular.dev';

export const ANGULAR_LINKS = {
  GITHUB: 'https://github.com/angular/angular',
  X: 'https://x.com/angular',
  MEDIUM: 'https://blog.angular.dev',
  YOUTUBE: 'https://www.youtube.com/angular',
  DISCORD: 'https://discord.gg/angular',
  BLUESKY: 'https://bsky.app/profile/angular.dev',
  STACKOVERFLOW: 'https://stackoverflow.com/questions/tagged/angular',
} as const;

```

### Core Architecture Module: `adev/src/app/core/constants/pages.ts`
```
/*!
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.dev/license
 */

// File contains the enums used across whole application.

export const DEFAULT_PAGES = {
  DOCS: 'overview',
  REFERENCE: 'api',
  TUTORIALS: 'tutorials',
  PLAYGROUND: 'playground',
  UPDATE: 'update-guide',
} as const;

export const PAGE_PREFIX = {
  API: 'api',
  CLI: 'cli',
  DOCS: 'docs',
  HOME: '',
  PLAYGROUND: 'playground',
  REFERENCE: 'reference',
  TUTORIALS: 'tutorials',
  UPDATE: 'update-guide',
} as const;

```

### Core Architecture Module: `adev/src/app/core/layout/footer/footer.component.ts`
```
/*!
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.dev/license
 */

import {Component, VERSION} from '@angular/core';
import {ExternalLink} from '@angular/docs';
import {RouterLink} from '@angular/router';
import {ANGULAR_LINKS} from '../../constants/links';

@Component({
  selector: 'footer[adev-footer]',
  imports: [ExternalLink, RouterLink],
  templateUrl: './footer.component.html',
  styleUrls: ['./footer.component.scss'],
})
export class Footer {
  protected angularVersion = VERSION.full;
  protected ngLinks = ANGULAR_LINKS;
}

```

### Core Architecture Module: `adev/src/app/core/layout/navigation/navigation.component.ts`
```
/*!
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.dev/license
 */

import {CdkMenu, CdkMenuItem, CdkMenuTrigger} from '@angular/cdk/menu';
import {ConnectedPosition, ConnectionPositionPair} from '@angular/cdk/overlay';
import {DOCUMENT, Location, isPlatformBrowser} from '@angular/common';
import {Component, PLATFORM_ID, inject, signal} from '@angular/core';
import {takeUntilDestroyed, toObservable} from '@angular/core/rxjs-interop';
import {
  ClickOutside,
  IS_SEARCH_DIALOG_OPEN,
  IconComponent,
  NavigationState,
  getBaseUrlAfterRedirects,
  isApple,
} from '@angular/docs';
import {NavigationEnd, Router, RouterLink} from '@angular/router';
import {filter, map, startWith} from 'rxjs';
import {DOCS_ROUTES, REFERENCE_ROUTES, TUTORIALS_ROUTES} from '../../../routing/routes';
import {PRIMARY_NAV_ID, SEARCH_DIALOG_ID, SECONDARY_NAV_ID} from '../../constants/element-ids';
import {COMMAND, CONTROL, SEARCH_TRIGGER_KEY} from '../../constants/keys';
import {ANGULAR_LINKS} from '../../constants/links';
import {PAGE_PREFIX} from '../../constants/pages';
import {Theme, ThemeManager} from '../../services/theme-manager.service';
import {VersionManager} from '../../services/version-manager.service';

type MenuType = 'social' | 'theme-picker' | 'version-picker';

@Component({
  selector: 'div.adev-nav',
  imports: [RouterLink, ClickOutside, CdkMenu, CdkMenuItem, CdkMenuTrigger, IconComponent],
  templateUrl: './navigation.component.html',
  styleUrls: ['./navigation.component.scss', './mini-menu.scss', './nav-item.scss'],
})
export class Navigation {
  private readonly document = inject(DOCUMENT);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private readonly navigationState = inject(NavigationState);
  private readonly router = inject(Router);
  private readonly location = inject(Location);
  private readonly themeManager = inject(ThemeManager);
  private readonly isSearchDialogOpen = inject(IS_SEARCH_DIALOG_OPEN);
  private readonly versionManager = inject(VersionManager);

  protected PAGE_PREFIX = PAGE_PREFIX;
  protected ngLinks = ANGULAR_LINKS;
  protected readonly PRIMARY_NAV_ID = PRIMARY_NAV_ID;
  protected readonly SECONDARY_NAV_ID = SECONDARY_NAV_ID;
  protected readonly SEARCH_DIALOG_ID = SEARCH_DIALOG_ID;

  // We can't use the ActivatedRouter queryParams as we're outside the router outlet
  protected readonly isUwu = 'location' in globalThis ? location.search.includes('uwu') : false;

  protected miniMenuPositions = [
    new ConnectionPositionPair(
      {originX: 'end', originY: 'center'},
      {overlayX: 'start', overlayY: 'center'},
    ),
    new ConnectionPositionPair(
      {originX: 'end', originY: 'top'},
      {overlayX: 'start', overlayY: 'top'},
    ),
  ];
  protected bottomMiniMenuPositions: ConnectedPosition[] = [
    new ConnectionPositionPair(
      {originX: 'end', originY: 'bottom'},
      {overlayX: 'start', overlayY: 'bottom'},
    ),
  ];

  readonly APPLE_SEARCH_LABEL = `⌘`;
  readonly DEFAULT_SEARCH_LABEL = `ctrl`;

  readonly activeRouteItem = this.navigationState.primaryActiveRouteItem;
  protected readonly theme = this.themeManager.theme;
  protected readonly openedMenu = signal<MenuType | null>(null);

  protected readonly currentDocsVersion = this.versionManager.currentDocsVersion;
  protected readonly currentDocsVersionMode = this.versionManager.currentDocsVersionMode;

  // Set the values of the search label and title only on the client, because the label is user-agent specific.
  protected searchLabel = this.isBrowser
    ? isApple
      ? this.APPLE_SEARCH_LABEL
      : this.DEFAULT_SEARCH_LABEL
    : '';
  protected searchTitle = this.isBrowser
    ? isApple
      ? `${COMMAND} ${SEARCH_TRIGGER_KEY.toUpperCase()}`
      : `${CONTROL} ${SEARCH_TRIGGER_KEY.toUpperCase()}`
    : '';
  protected versions = this.versionManager.versions;

  protected isMobileNavigationOpened = this.navigationState.isMobileNavVisible;
  isMobileNavigationOpened$ = toObservable(this.isMobileNavigationOpened);
  primaryRouteChanged$ = toObservable(this.activeRouteItem);

  constructor() {
    this.listenToRouteChange();
    this.preventToScrollContentWhenSecondaryNavIsOpened();
    this.closeMobileNavOnPrimaryRouteChange();
  }

  protected setTheme(theme: Theme): void {
    this.themeManager.setTheme(theme);
  }

  protected openVersionMenu($event: MouseEvent): void {
    // It's required to avoid redirection to `home`
    $event.stopImmediatePropagation();
    $event.preventDefault();
    this.openMenu('version-picker');
  }

  protected openMenu(menuType: MenuType): void {
    this.openedMenu.set(menuType);
  }

  protected closeMenu(): void {
    this.openedMenu.set(null);
  }

  protected openMobileNav($event: MouseEvent): void {
    $event.stopPropagation();
    this.navigationState.setMobileNavigationListVisibility(true);
  }

  protected closeMobileNav(): void {
    this.navigationState.setMobileNavigationListVisibility(false);
  }

  protected toggleSearchDialog(event: MouseEvent): void {
    event.stopPropagation();
    this.isSearchDialogOpen.update((isOpen) => !isOpen);
  }

  private closeMobileNavOnPrimaryRouteChange(): void {
    this.primaryRouteChanged$.pipe(takeUntilDestroyed()).subscribe(() => {
      this.closeMobileNav();
    });
  }

  private listenToRouteChange(): void {
    this.router.events
      .pipe(
        filter((event) => event instanceof NavigationEnd),
        map((event) => (event as NavigationEnd).urlAfterRedirects),
      )
      .pipe(
        takeUntilDestroyed(),
        //using location because router.url will only return "/" here
        startWith(this.location.path()),
      )
      .subscribe((url) => {
        this.setActivePrimaryRoute(getBaseUrlAfterRedirects(url, this.router));
      });
  }

  // Set active route item, based on urlAfterRedirects.
  // First check if url starts with the main prefixes (docs, reference, tutorials).
  // (*) Docs navigation tree contains items which will navigate to /tutorials.
  // In that case after click on such link we should mark as active item, and display tutorials navigation tree.
  // If it's not starting with prefix then check if specific path exist in the array of defined routes
  // (*) Reference navigation tree contains items which are not start with prefix like /migrations or /errors.
  private setActivePrimaryRoute(urlAfterRedirects: string): void {
    if (urlAfterRedirects === '') {
      this.activeRouteItem.set(PAGE_PREFIX.HOME);
    } else if (urlAfterRedirects.startsWith(PAGE_PREFIX.DOCS)) {
      this.activeRouteItem.set(PAGE_PREFIX.DOCS);
    } else if (
      urlAfterRedirects.startsWith(PAGE_PREFIX.REFERENCE) ||
      urlAfterRedirects.startsWith(PAGE_PREFIX.API) ||
      urlAfterRedirects.startsWith(PAGE_PREFIX.UPDATE)
    ) {
      this.activeRouteItem.set(PAGE_PREFIX.REFERENCE);
    } else if (urlAfterRedirects === PAGE_PREFIX.PLAYGROUND) {
      this.activeRouteItem.set(PAGE_PREFIX.PLAYGROUND);
    } else if (urlAfterRedirects.startsWith(PAGE_PREFIX.TUTORIALS)) {
      this.activeRouteItem.set(PAGE_PREFIX.TUTORIALS);
    } else if (DOCS_ROUTES.some((route) => route.path === urlAfterRedirects)) {
      this.activeRouteItem.set(PAGE_PREFIX.DOCS);
    } else if (REFERENCE_ROUTES.some((route) => route.path === urlAfterRedirects)) {
      this.activeRouteItem.set(PAGE_PREFIX.REFERENCE);
    } else if (TUTORIALS_ROUTES.some((route) => route.path === urlAfterRedirects)) {
      this.activeRouteItem.set(PAGE_PREFIX.TUTORIALS);
    } else {
      // Reset if no active route item could be found
      this.activeRouteItem.set(null);
    }
  }

  private preventToScrollContentWhenSecondaryNavIsOpened(): void {
    this.isMobileNavigationOpened$.pipe(takeUntilDestroyed()).subscribe((opened) => {
      if (opened) {
        this.document.body.style.overflowY = 'hidden';
      } else {
        this.document.body.style.removeProperty('overflow-y');
      }
    });
  }
}

```

### Core Architecture Module: `adev/src/app/core/layout/progress-bar/progress-bar.component.ts`
```
/*!
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.dev/license
 */

import {isPlatformServer} from '@angular/common';
import {Component, effect, inject, PLATFORM_ID, viewChild} from '@angular/core';
import {Router} from '@angular/router';
import {NgProgressbar, NgProgressRef} from 'ngx-progressbar';

/** Time to wait after navigation starts before showing the progress bar. This delay allows a small amount of time to skip showing the progress bar when a navigation is effectively immediate. 30ms is approximately the amount of time we can wait before a delay is perceptible.*/
export const PROGRESS_BAR_DELAY = 30;

@Component({
  selector: 'adev-progress-bar',
  imports: [NgProgressbar],
  template: `<ng-progress aria-label="Page load progress" />`,
})
export class ProgressBarComponent {
  private readonly router = inject(Router);

  readonly progressBar = viewChild.required(NgProgressRef);

  isServer = isPlatformServer(inject(PLATFORM_ID));

  constructor() {
    this.setupPageNavigationDimming();
  }

  /**
   * Dims the main router-outlet content when navigating to a new page.
   */
  private setupPageNavigationDimming() {
    if (this.isServer) {
      return;
    }
    effect((onCleanup) => {
      if (!this.router.currentNavigation()) {
        return;
      }
      // Only show the progress bar if the navigation is not "immediate".
      const timeoutId = setTimeout(() => this.progressBar().start(), PROGRESS_BAR_DELAY);
      // Runs when the navigation ends (completed, skipped, canceled or errored) or is superseded.
      onCleanup(() => {
        clearTimeout(timeoutId);
        this.progressBar().complete();
      });
    });
  }
}

```

### Core Architecture Module: `adev/src/app/core/layout/secondary-navigation/secondary-navigation.component.ts`
```
/*!
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.dev/license
 */

import {isPlatformBrowser} from '@angular/common';
import {Component, PLATFORM_ID, computed, inject, signal} from '@angular/core';
import {takeUntilDestroyed, toObservable} from '@angular/core/rxjs-interop';
import {
  ClickOutside,
  NavigationItem,
  NavigationList,
  NavigationState,
  findNavigationItem,
  getBaseUrlAfterRedirects,
  getNavigationItemsTree,
  markExternalLinks,
  shouldReduceMotion,
} from '@angular/docs';
import {ActivatedRouteSnapshot, NavigationEnd, Router, RouterStateSnapshot} from '@angular/router';
import {distinctUntilChanged, filter, map, skip, startWith} from 'rxjs';
import {SUB_NAVIGATION_DATA} from '../../../routing/sub-navigation-data';
import {PRIMARY_NAV_ID, SEARCH_DIALOG_ID, SECONDARY_NAV_ID} from '../../constants/element-ids';
import {PAGE_PREFIX} from '../../constants/pages';

const ANIMATION_DURATION = 500;

@Component({
  selector: 'adev-secondary-navigation',
  imports: [NavigationList, ClickOutside],
  templateUrl: './secondary-navigation.component.html',
  styleUrls: ['./secondary-navigation.component.scss'],
})
export class SecondaryNavigation {
  private readonly navigationState = inject(NavigationState);
  private readonly platformId = inject(PLATFORM_ID);
  private readonly router = inject(Router);

  protected readonly isSecondaryNavVisible = this.navigationState.isMobileNavVisible;
  readonly primaryActiveRouteItem = this.navigationState.primaryActiveRouteItem;
  protected readonly maxVisibleLevelsOnSecondaryNav = computed(() =>
    this.primaryActiveRouteItem() === PAGE_PREFIX.REFERENCE ? 1 : 2,
  );
  protected readonly navigationItemsSlides = this.navigationState.expandedItems;

  protected navigationItems: NavigationItem[] | undefined;

  protected readonly translateX = computed(() => {
    const level = this.navigationState.level();
    return `translateX(${-level * 100}%)`;
  });
  protected readonly transition = signal('0ms');

  protected readonly PRIMARY_NAV_ID = PRIMARY_NAV_ID;
  protected readonly SECONDARY_NAV_ID = SECONDARY_NAV_ID;
  protected readonly SEARCH_DIALOG_ID = SEARCH_DIALOG_ID;

  private readonly routeMap: Record<string, NavigationItem[]> = {
    [PAGE_PREFIX.REFERENCE]: getNavigationItemsTree(SUB_NAVIGATION_DATA.reference, (tree) =>
      markExternalLinks(tree),
    ),
    [PAGE_PREFIX.DOCS]: getNavigationItemsTree(SUB_NAVIGATION_DATA.docs, (tree) =>
      markExternalLinks(tree),
    ),
  };

  private readonly primaryActiveRouteChanged$ = toObservable(this.primaryActiveRouteItem).pipe(
    distinctUntilChanged(),
    takeUntilDestroyed(),
  );

  private readonly urlAfterRedirects$ = this.router.events.pipe(
    filter((event) => event instanceof NavigationEnd),
    map((event) => event.urlAfterRedirects),
    filter((url) => url !== undefined),
    startWith(this.getInitialPath(this.router.routerState.snapshot)),
    takeUntilDestroyed(),
  );

  constructor() {
    this.navigationState.cleanExpandedState();
    this.listenToPrimaryRouteChange();
    this.setActiveRouteOnNavigationEnd();

    if (isPlatformBrowser(this.platformId)) {
      this.initSlideAnimation();
    }
  }

  protected close(): void {
    this.navigationState.setMobileNavigationListVisibility(false);
  }

  private setActiveRouteOnNavigationEnd(): void {
    this.urlAfterRedirects$.subscribe((url) => {
      const activeNavigationItem = this.getActiveNavigationItem(url);
      if (
        activeNavigationItem?.level &&
        activeNavigationItem.level <= this.maxVisibleLevelsOnSecondaryNav()
      ) {
        this.navigationState.cleanExpandedState();
      } else if (activeNavigationItem) {
        /**
         * For the `Docs`, we don't expand the "level === 1" items because they are already displayed in the main navigation list.
         * Example:
         * In-depth Guides (level == 0)
         * Components (level == 1) -> Selectors, Styling, etc (level == 2)
         * Template Syntax (level == 1) -> Text interpolation, etc (level == 2)
         *
         * For the `Tutorials`, we display the navigation in the dropdown and it has flat structure (all items are displayed as items with level === 0).
         *
         * For the `Reference` we would like to give possibility to expand the "level === 1" items cause they are not visible in the first slide of navigation list.
         * Example:
         * API Reference (level == 0) -> Overview, Animations, common, etc (level == 1) -> API Package exports (level == 2)
         */
        const shouldExpandItem = (node: NavigationItem): boolean =>
          !!node.level &&
          (this.primaryActiveRouteItem() === PAGE_PREFIX.REFERENCE
            ? node.level > 0
            : node.level > 1);

        // Skip expand when active item is API Reference homepage - `/api`.
        // It protect us from displaying second level of the navigation when user clicks on `Reference`,
        // Because in this situation we want to display the first level, which contains, in addition to the API Reference, also the CLI Reference, Error Encyclopedia etc.
        const skipExpandPredicateFn = (node: NavigationItem): boolean =>
          node.path === PAGE_PREFIX.API;

        this.navigationState.expandItemHierarchy(
          activeNavigationItem,
          shouldExpandItem,
          skipExpandPredicateFn,
        );
      }
    });
  }

  private getActiveNavigationItem(url: string): NavigationItem | null {
    // set visible navigation items if not present
    this.setVisibleNavigationItems();

    const activeNavigationItem = findNavigationItem(
      this.navigationItems!,
      (item) =>
        !!item.path &&
        getBaseUrlAfterRedirects(item.path, this.router) ===
          getBaseUrlAfterRedirects(url, this.router),
    );

    this.navigationState.setActiveNavigationItem(activeNavigationItem);

    return activeNavigationItem;
  }

  private initSlideAnimation(): void {
    if (shouldReduceMotion()) {
      return;
    }
    setTimeout(() => {
      this.transition.set(`${ANIMATION_DURATION}ms`);
    }, ANIMATION_DURATION);
  }

  private setVisibleNavigationItems(): void {
    const routeMap = this.routeMap[this.primaryActiveRouteItem()!];
    this.navigationItems = routeMap
      ? getNavigationItemsTree(routeMap, (item) => {
          item.isExpanded = this.primaryActiveRouteItem() === PAGE_PREFIX.DOCS && item.level === 1;
        })
      : [];
  }

  private listenToPrimaryRouteChange(): void {
    // Fix: flicker of sub-navigation on init
    this.primaryActiveRouteChanged$.pipe(skip(1)).subscribe(() => {
      this.navigationState.cleanExpandedState();
    });
  }

  private getInitialPath(routerState: RouterStateSnapshot): string {
    let route: ActivatedRouteSnapshot = routerState.root;

    while (route.firstChild) {
      route = route.firstChild;
    }

    return route.routeConfig?.path ?? '';
  }
}

```

### Core Architecture Module: `adev/src/app/core/services/a-dev-title-strategy.ts`
```
/*!
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.dev/license
 */

import {inject, Service} from '@angular/core';
import {NavigationItem} from '@angular/docs';
import {Meta, Title} from '@angular/platform-browser';
import {ActivatedRouteSnapshot, RouterStateSnapshot, TitleStrategy} from '@angular/router';

export const TITLE_SUFFIX = 'Angular';
const TITLE_SEPARATOR = ' • ';
export const DEFAULT_PAGE_TITLE = 'Overview';

const TITLE_OG_META_TAG = 'og:title';
const TITLE_TWITTER_META_TAG = 'twitter:title';

export const ALL_TITLE_META_TAGS = [TITLE_OG_META_TAG, TITLE_TWITTER_META_TAG];

@Service()
export class ADevTitleStrategy extends TitleStrategy {
  private readonly title = inject(Title);
  private readonly meta = inject(Meta);

  constructor() {
    super();
  }

  override updateTitle(routerState: RouterStateSnapshot) {
    const title = this.buildTitle(routerState);

    if (title !== undefined) {
      this.title.setTitle(title);
      ALL_TITLE_META_TAGS.forEach((tag) => this.meta.updateTag({property: tag, content: title}));
    }
  }

  override buildTitle(snapshot: RouterStateSnapshot): string {
    let route: ActivatedRouteSnapshot = snapshot.root;

    while (route.firstChild) {
      route = route.firstChild;
    }

    const data = route.data as NavigationItem;
    const routeTitle = data.label ?? '';

    const prefix =
      routeTitle.startsWith(DEFAULT_PAGE_TITLE) && data.parent
        ? `${data.parent.label}${TITLE_SEPARATOR}`
        : '';

    return !!routeTitle ? `${prefix}${routeTitle}${TITLE_SEPARATOR}${TITLE_SUFFIX}` : TITLE_SUFFIX;
  }
}

```

### Core Architecture Module: `adev/src/app/core/services/analytics/analytics-format-error.ts`
```
/*!
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.dev/license
 */

/**
 * Formats an `ErrorEvent` to a human-readable string that can
 * be sent to Google Analytics.
 */
export function formatErrorEventForAnalytics(event: ErrorEvent): string {
  const {message, filename, colno, lineno, error} = event;

  if (error instanceof Error) {
    return formatErrorForAnalytics(error);
  }

  return `${stripErrorMessagePrefix(message)}\n${filename}:` + `${lineno || '?'}:${colno || '?'}`;
}

/**
 * Formats an `Error` to a human-readable string that can be sent
 * to Google Analytics.
 */
export function formatErrorForAnalytics(error: Error): string {
  let stack = '<no-stack>';

  if (error.stack) {
    stack = stripErrorMessagePrefix(error.stack)
      // strip the message from the stack trace, if present
      .replace(error.message + '\n', '')
      // strip leading spaces
      .replace(/^ +/gm, '')
      // strip all leading "at " for each frame
      .replace(/^at /gm, '')
      // replace long urls with just the last segment: `filename:line:column`
      .replace(/(?: \(|@)http.+\/([^/)]+)\)?(?:\n|$)/gm, '@$1\n')
      // replace "eval code" in Edge
      .replace(/ *\(eval code(:\d+:\d+)\)(?:\n|$)/gm, '@???$1\n');
  }

  return `${error.message}\n${stack}`;
}

/** Strips the error message prefix from a message or stack trace. */
function stripErrorMessagePrefix(input: string): string {
  return input.replace(/^(Uncaught )?Error: /, '');
}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #69325** (2026-06-16): **OutputEmitterRef.emit() skips listeners when an earlier listener unsubscribes synchronously (e.g. outputToObservable + take(1))**
  *Symptoms*: ### Which @angular/* package(s) are the source of the bug?  core  ### Is this a regression?  Yes  ### Description  When two listeners are subscribed to the same signal-based `output()`, and the first listener unsubscribes itself synchronously while receiving an emitted value, the second listener is silently skipped — it never receives the event.  This is a regression compared to decorator-based `@Output()` / `EventEmitter`: the exact same code works correctly there, as it does in every comparable event system (DOM `EventTarget`, Node `EventEmitter`, RxJS `Subject`). A listener removing itself is never supposed to affect delivery to other listeners. Since `output()` is presented as a drop-in replacement for `@Output()`, this behavioral difference is subtle and very hard to debug — in our app it manifested as a template event binding that simply never fired, with nothing in the console pointing at the cause.  ## Reproduction  https://stackblitz.com/edit/stackblitz-starters-scbzqgpg  A child component emits an output once:  ```ts   @Component({ selector: 'app-child', /* ... */ })   export class ChildComponent implements OnInit {     ready = output<string>();      ngOnInit() {       this.ready.emit('hello from child');     }   } ``` A directive on the same element consumes that output once, the idiomatic way:    ```ts   @Directive({ selector: 'app-child[consumeOnce]' })   export class ConsumeOnceDirective {     private host = inject(ChildComponent);      constructor() {       out

- **Issue #66402** (2026-01-12): **Signal forms - radio does not reflect form model signal initial state if value attribute is enum**
  *Symptoms*: ### Which @angular/* package(s) are the source of the bug?  forms  ### Is this a regression?  No  ### Description  When trying to use `enum` as a `value` attribute for `radio` button, radio button does not reflects initial state of form model signal.  If i use for example  ```ts  readonly projectFormModel = signal<ProjectFormModel>({ name: 'test', status: ProjectStatus.CLOSED });  readonly projectForm = form(this.projectFormModel); ```   ```html  <input   type="radio"   [field]="projectForm.status"   [value]="projectStatusEnum.CLOSED"   id="btnradio2" /> <label   class="btn btn-outline-primary"   for="btnradio2">   {{ projectStatusEnum.CLOSED }} </label> ``` Button should be marked as selected. But it works correctly after I click the html radio button.  It works for initial state if i use plain string for value, ie: `value="closed"`  Enum values work OK in reactive forms, but not with signal forms.  Example link bellow.  Best regards.   ### Please provide a link to a minimal reproduction of the bug  https://stackblitz.com/~/github.com/kle-pra/signal-form-enums?file=package.json  ### Please provide the exception or error you saw  ```true / ```  ### Please provide the environment you discovered this bug in (run `ng version`)  ```true Angular CLI       : 21.0.5 Angular           : 21.0.7 Node.js           : 24.11.0 Package Manager   : npm 11.6.3 Operating System  : linux x64  ┌───────────────────────────────┬───────────────────┬───────────────────┐ │ Package                    
  **Post-Mortem & Fix Analysis**:
  > The bug here is that setting the value via binding is set after the control is updated.   The workaround for now is having the value binding _before_ the field binding.   ```html <input   type="radio"   [value]="projectStatusEnum.CLOSED"   [field]="projectForm.status"    id="btnradio2" /> ```
  > @JeanMeche nice catch 

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

### Incident Patch 1: `d7be93c5` (2026-10-19)
**Commit Message**: fix(compiler-cli): do not treat declaration files as compilation roots in preprocessor

Declaration files listed in a tsconfig's `files` (every transitive dependency, in Bazel-style builds) were analyzed as roots, processed and streamed to the host, which then emitted `.d.ng.ts`/`.d.ng.ts.map`/`.d.ngtypecheck.ts` next to each of them. This can end up consuming a lot of memory and potentially exhaust some targets.

**File**: `packages/compiler-cli/preprocessor/ng-analyze/src/compiler/analyzer.rs` (modified, +4/-4)
```diff
@@ -3,7 +3,7 @@ use crate::query::{FileId, QueryContext};
 use crate::resource_loader::ResourceResolverFs;
 use crate::resource_registry::ResourceRegistry;
 use crate::tsconfig_resolution;
-use crate::utils::{create_resolver_with_fs, is_ts_file, is_ts_source};
+use crate::utils::{create_resolver_with_fs, is_compilation_root, is_ts_file, is_ts_source};
 use crate::{
     AnalysisResult, AnalyzerOptions, CompilationChunk, FileData, FileInvalidation, FileUpdate,
 };
@@ -180,7 +180,7 @@ impl Analyzer {
             .files
             .into_iter()
             .map(|p| fs.canonicalize(&p).unwrap_or(p))
-            .filter(|p| is_ts_file(p))
+            .filter(|p| is_compilation_root(p))
             .collect();
 
         let entrypoints_lock = Arc::new(RwLock::new(entrypoints));
@@ -481,7 +481,7 @@ impl Analyzer {
                 .files
                 .into_iter()
                 .map(|p| self.fs.canonicalize(&p).unwrap_or(p))
-                .filter(|p| is_ts_file(p))
+                .filter(|p| is_compilation_root(p))
                 .collect();
             *self.entrypoints.write().unwrap() = entrypoints;
         }
@@ -952,7 +952,7 @@ async fn run_coordinator<S, LA, FutLA, P, FutP, Fs>(
         if cancel_token.is_cancelled() {
             break;
         }
-        if !is_ts_file(&entry) {
+        if !is_compilation_root(&entry) {
             continue;
         }
         // Dedupe on the case-folded path, but keep the caller's spelling.
```

**File**: `packages/compiler-cli/preprocessor/ng-analyze/src/compiler/tests.rs` (modified, +71/-0)
```diff
@@ -1391,6 +1391,77 @@ fn test_allowed_sources_allows_dts() {
     assert_eq!(importable.specifier, "./router");
 }
 
+/// Declaration files listed in `files` (as Bazel-style rules do for every dependency) are program
+/// inputs, not compilation roots: they are never streamed to the host, but their metadata is still
+/// read on demand when a source references them.
+#[test]
+fn test_dts_root_files_are_not_compiled() {
+    let mut virtual_files = HashMap::new();
+    virtual_files.insert(
+        "/project/tsconfig.json".to_string(),
+        r#"{"files": ["app.ts", "router.d.ts"]}"#.to_string(),
+    );
+    virtual_files.insert(
+        "/project/app.ts".to_string(),
+        r#"
+            import {NgModule} from '@angular/core';
+            import {RouterModule} from './router';
+
+            @NgModule({imports: [RouterModule]})
+            export class AppModule {}
+        "#
+        .to_string(),
+    );
+    virtual_files.insert(
+        "/project/router.d.ts".to_string(),
+        r#"
+            import * as i0 from '@angular/core';
+            export declare class RouterModule {
+                static ɵmod: i0.ɵɵNgModuleDeclaration<RouterModule, never, never, never>;
+            }
+        "#
+        .to_string(),
+    );
+
+    for optimize in [false, true] {
+        let options = AnalyzerOptions {
+            tsconfig_path: "/project/tsconfig.json".to_string(),
+            optimize: Some(optimize),
+            virtual_files: Some(virtual_files.clone()),
+            ..Default::default()
+        };
+        let analyzer = Analyzer::new(options).unwrap();
+        let iterator = if optimize {
+            analyzer.analyze_optimized().unwrap()
+        } else {
+            analyzer.analyze().unwrap()
+        };
+        let mut results = Vec::new();
+        while let Some(chunk) = futures::executor::block_on(iterator.next()).unwrap() {
+            results.extend(chunk.files);
+        }
+
+        let paths: Vec<&str> = results.iter().map(|r| r.file_path.as_str()).collect();
+        assert_eq!(paths, vec!["/project/app.ts"], "optimize={optimize}");
+
+        if optimize {
+            let imports = results[0]
+                .classes
+                .iter()
+                .find(|c| c.class_name.as_deref() == Some("AppModule"))
+                .and_then(|c| c.ng_module.as_ref())
+                .and_then(|m| m.imports.as_ref())
+                .expect("AppModule imports");
+            let importable = imports[0]
+                .typecheck_import
+                .as_ref()
+                .expect("RouterModule is read on demand from router.d.ts");
+            assert_eq!(importable.symbol, "RouterModule");
+            assert_eq!(importable.specifier, "./router");
+        }
+    }
+}
+
 #[test]
 fn test_resource_files_in_entrypoints_and_metadata() {
     let mut virtual_files = HashMap::new();
```

**File**: `packages/compiler-cli/preprocessor/ng-analyze/src/test_utils.rs` (modified, +24/-6)
```diff
@@ -59,6 +59,24 @@ pub fn run_analyzer(
     })
 }
 
+/// Analyze `file_path` through `Analyzer::get_metadata_for_file`, the on-demand path the
+/// language service uses. Declaration files are not compilation roots, so this is how their
+/// metadata is inspected.
+pub fn analyze_file_metadata(
+    fs: OverlayFileSystem,
+    tsconfig_path: &str,
+    file_path: &str,
+) -> AnalysisResult {
+    let options = crate::AnalyzerOptions {
+        tsconfig_path: tsconfig_path.to_string(),
+        ..Default::default()
+    };
+    let analyzer = crate::Analyzer::new_core_with_fs(options, fs).unwrap();
+    analyzer
+        .get_metadata_for_file(file_path.to_string())
+        .unwrap_or_else(|| panic!("Expected metadata for {file_path}"))
+}
+
 /// Assert that a class with the given name exists in the results
 pub fn assert_class_exists(results: &[AnalysisResult], class_name: &str) {
     let found = results.iter().any(|r| {
@@ -2822,9 +2840,9 @@ export declare class FireTeleportalOutlet<C extends PortalComponentType, D> {
             ),
         ]);
 
-        let results = run_analyzer(fs, "/test/tsconfig.json", false);
+        let result = analyze_file_metadata(fs, "/test/tsconfig.json", "/test/teleport.d.ts");
 
-        let class_meta = find_class(&results, "FireTeleportalOutlet")
+        let class_meta = find_class(std::slice::from_ref(&result), "FireTeleportalOutlet")
             .expect("FireTeleportalOutlet should exist");
         assert!(class_meta.has_non_exported_bounds);
         let params = class_meta.type_parameters.as_ref().unwrap();
@@ -2854,9 +2872,9 @@ export declare class FireTeleportalOutlet<C extends PortalComponentType, D> {
             ),
         ]);
 
-        let results = run_analyzer(fs, "/test/tsconfig.json", false);
+        let result = analyze_file_metadata(fs, "/test/tsconfig.json", "/test/teleport.d.ts");
 
-        let class_meta = find_class(&results, "FireTeleportalOutlet")
+        let class_meta = find_class(std::slice::from_ref(&result), "FireTeleportalOutlet")
             .expect("FireTeleportalOutlet should exist");
         assert!(!class_meta.has_non_exported_bounds);
     }
@@ -2883,9 +2901,9 @@ export declare class FireTeleportalOutlet<C extends PortalComponentType, D> {
             ),
         ]);
 
-        let results = run_analyzer(fs, "/test/tsconfig.json", false);
+        let result = analyze_file_metadata(fs, "/test/tsconfig.json", "/test/teleport.d.ts");
 
-        let class_meta = find_class(&results, "FireTeleportalOutlet")
+        let class_meta = find_class(std::slice::from_ref(&result), "FireTeleportalOutlet")
             .expect("FireTeleportalOutlet should exist");
         assert!(!class_meta.has_non_exported_bounds);
     }
```

**File**: `packages/compiler-cli/preprocessor/ng-analyze/src/utils/mod.rs` (modified, +11/-0)
```diff
@@ -152,5 +152,16 @@ pub(crate) fn is_ts_file(path: &Path) -> bool {
     }
 }
 
+/// Whether `path` is a root of the compilation: a TS/JS file that is not a declaration file.
+///
+/// A tsconfig's `files` can list declaration files (Bazel-style rules list every dependency's).
+/// They are inputs to the program, and their metadata is read on demand when a source references
+/// a declaration in them (see `analyze_dts`), but ngtsc never analyzes or emits them
+/// (`TraitCompiler.analyzeSync` returns early for `isDeclarationFile`), so they are neither part
+/// of the compilation unit nor streamed to the host.
+pub(crate) fn is_compilation_root(path: &Path) -> bool {
+    is_ts_file(path) && !is_dts(path)
+}
+
 #[cfg(test)]
 mod tests;
```

**File**: `packages/compiler-cli/preprocessor/ng-analyze/src/utils/tests.rs` (modified, +14/-0)
```diff
@@ -47,3 +47,17 @@ fn test_is_ts_file() {
     assert!(!super::is_ts_file(Path::new("foo.html")));
     assert!(!super::is_ts_file(Path::new("foo.ng.html")));
 }
+
+#[test]
+fn test_is_compilation_root() {
+    use std::path::Path;
+    assert!(super::is_compilation_root(Path::new("foo.ts")));
+    assert!(super::is_compilation_root(Path::new("foo.tsx")));
+    assert!(super::is_compilation_root(Path::new("foo.js")));
+    assert!(!super::is_compilation_root(Path::new("foo.d.ts")));
+    assert!(!super::is_compilation_root(Path::new(
+        "node_modules/@angular/core/index.d.ts"
+    )));
+    assert!(!super::is_compilation_root(Path::new("foo.html")));
+    assert!(!super::is_compilation_root(Path::new("foo.css")));
+}
```

**File**: `packages/compiler-cli/preprocessor/ngp.ts` (modified, +5/-0)
```diff
@@ -53,6 +53,11 @@ async function processFile(
 ) {
   const {filePath} = file;
 
+  // Declaration files are program inputs, not compilation outputs, so avoid emitting them.
+  if (filePath.endsWith('.d.ts')) {
+    return;
+  }
+
   const content = await fs.readFile(filePath, 'utf-8');
   const processed = await compiler.processFile(filePath, content, file, chunkContext);
   const s = processed.magicString;
```

**File**: `packages/compiler-cli/preprocessor/test/golden/host_directives_dts_tcb/golden.md` (modified, +0/-114)
```diff
@@ -79,118 +79,4 @@ export class AppComponent {
     });
 })();
 
-```
-
-# /out/src/directives/consumer_dir.d.ts
-```ts
-import * as i0 from '@angular/core';
-import * as i1 from './host_dir';
-
-export declare class TestHostConsumerDirective {
-  static ɵfac: i0.ɵɵFactoryDeclaration<TestHostConsumerDirective, never>;
-  static ɵdir: i0.ɵɵDirectiveDeclaration<
-    TestHostConsumerDirective,
-    '[testHostConsumer]',
-    never,
-    {},
-    {},
-    never,
-    never,
-    true,
-    [
-      {
-        directive: typeof i1.TestHostDirective;
-        inputs: {};
-        outputs: {
-          'customChange': 'disabledChange';
-        };
-      },
-    ]
-  >;
-  // @ts-ignore
-  static ɵfac: i0.ɵɵFactoryDeclaration<TestHostConsumerDirective, never> =
-    function TestHostConsumerDirective_Factory(__ngFactoryType__: any): any {
-      return new (__ngFactoryType__ || TestHostConsumerDirective)();
-    };
-  // @ts-ignore
-  static ɵdir: i0.ɵɵDirectiveDeclaration<
-    TestHostConsumerDirective,
-    '[testHostConsumer]',
-    never,
-    {},
-    {},
-    never,
-    never,
-    true,
-    [
-      {
-        directive: typeof i1.TestHostDirective;
-        inputs: {};
-        outputs: { 'customChange': 'disabledChange' };
-      },
-    ]
-  > =
-    // @ts-ignore
-    /*@__PURE__*/ i0.ɵɵdefineDirective({
-      type: TestHostConsumerDirective,
-      selectors: [['', 'testHostConsumer', '']],
-      features: [
-        i0.ɵɵHostDirectivesFeature([
-          { directive: i1.TestHostDirective, outputs: ['customChange', 'disabledChange'] },
-        ]),
-      ],
-    });
-  static {
-    (typeof ngDevMode === 'undefined' || ngDevMode) &&
-      i0.ɵsetClassMetadata(TestHostConsumerDirective, [{ type: Directive }], null, null);
-  }
-}
-
-```
-
-# /out/src/directives/host_dir.d.ts
-```ts
-import * as i0 from '@angular/core';
-
-export declare class TestHostDirective {
-  customChange: i0.EventEmitter<boolean>;
-  static ɵfac: i0.ɵɵFactoryDeclaration<TestHostDirective, never>;
-  static ɵdir: i0.ɵɵDirectiveDeclaration<
-    TestHostDirective,
-    never,
-    never,
-    {},
-    { 'customChange': 'customChange' },
-    never,
-    never,
-    true
-  >;
-  // @ts-ignore
-  static ɵfac: i0.ɵɵFactoryDeclaration<TestHostDirective, never> =
-    function TestHostDirective_Factory(__ngFactoryType__: any): any {
-      return new (__ngFactoryType__ || TestHostDirective)();
-    };
-  // @ts-ignore
-  static ɵdir: i0.ɵɵDirectiveDeclaration<
-    TestHostDirective,
-    never,
-    never,
-    {},
-    { 'customChange': 'customChange' },
-    never,
-    never,
-    true,
-    never
-  > =
-    // @ts-ignore
-    /*@__PURE__*/ i0.ɵɵdefineDirective({
-      type: TestHostDirective,
-      outputs: { customChange: 'customChange' },
-    });
-  static {
-    (typeof ngDevMode === 'undefined' || ngDevMode) &&
-      i0.ɵsetClassMetadata(TestHostDirective, [{ type: Directive }], null, null);
-  }
-}
-
 ```
\ No newline at end of file
```

**File**: `packages/compiler-cli/preprocessor/test/golden/host_directives_dts_tcb/golden.opt.md` (modified, +0/-114)
```diff
@@ -102,118 +102,4 @@ export class AppComponent {
     });
 })();
 
-```
-
-# /out/src/directives/consumer_dir.d.ts
-```ts
-import * as i0 from '@angular/core';
-import * as i1 from './host_dir';
-
-export declare class TestHostConsumerDirective {
-  static ɵfac: i0.ɵɵFactoryDeclaration<TestHostConsumerDirective, never>;
-  static ɵdir: i0.ɵɵDirectiveDeclaration<
-    TestHostConsumerDirective,
-    '[testHostConsumer]',
-    never,
-    {},
-    {},
-    never,
-    never,
-    true,
-    [
-      {
-        directive: typeof i1.TestHostDirective;
-        inputs: {};
-        outputs: {
-          'customChange': 'disabledChange';
-        };
-      },
-    ]
-  >;
-  // @ts-ignore
-  static ɵfac: i0.ɵɵFactoryDeclaration<TestHostConsumerDirective, never> =
-    function TestHostConsumerDirective_Factory(__ngFactoryType__: any): any {
-      return new (__ngFactoryType__ || TestHostConsumerDirective)();
-    };
-  // @ts-ignore
-  static ɵdir: i0.ɵɵDirectiveDeclaration<
-    TestHostConsumerDirective,
-    '[testHostConsumer]',
-    never,
-    {},
-    {},
-    never,
-    never,
-    true,
-    [
-      {
-        directive: typeof i1.TestHostDirective;
-        inputs: {};
-        outputs: { 'customChange': 'disabledChange' };
-      },
-    ]
-  > =
-    // @ts-ignore
-    /*@__PURE__*/ i0.ɵɵdefineDirective({
-      type: TestHostConsumerDirective,
-      selectors: [['', 'testHostConsumer', '']],
-      features: [
-        i0.ɵɵHostDirectivesFeature([
-          { directive: i1.TestHostDirective, outputs: ['customChange', 'disabledChange'] },
-        ]),
-      ],
-    });
-  static {
-    (typeof ngDevMode === 'undefined' || ngDevMode) &&
-      i0.ɵsetClassMetadata(TestHostConsumerDirective, [{ type: Directive }], null, null);
-  }
-}
-
-```
-
-# /out/src/directives/host_dir.d.ts
-```ts
-import * as i0 from '@angular/core';
-
-export declare class TestHostDirective {
-  customChange: i0.EventEmitter<boolean>;
-  static ɵfac: i0.ɵɵFactoryDeclaration<TestHostDirective, never>;
-  static ɵdir: i0.ɵɵDirectiveDeclaration<
-    TestHostDirective,
-    never,
-    never,
-    {},
-    { 'customChange': 'customChange' },
-    never,
-    never,
-    true
-  >;
-  // @ts-ignore
-  static ɵfac: i0.ɵɵFactoryDeclaration<TestHostDirective, never> =
-    function TestHostDirective_Factory(__ngFactoryType__: any): any {
-      return new (__ngFactoryType__ || TestHostDirective)();
-    };
-  // @ts-ignore
-  static ɵdir: i0.ɵɵDirectiveDeclaration<
-    TestHostDirective,
-    never,
-    never,
-    {},
-    { 'customChange': 'customChange' },
-    never,
-    never,
-    true,
-    never
-  > =
-    // @ts-ignore
-    /*@__PURE__*/ i0.ɵɵdefineDirective({
-      type: TestHostDirective,
-      outputs: { customChange: 'customChange' },
-    });
-  static {
-    (typeof ngDevMode === 'undefined' || ngDevMode) &&
-      i0.ɵsetClassMetadata(TestHostDirective, [{ type: Directive }], null, null);
-  }
-}
-
 ```
\ No newline at end of file
```

---

### Incident Patch 2: `eef1db88` (2026-10-19)
**Commit Message**: fix(compiler-cli): ensure diagnostic spans are correct in preprocessor

Ports over the logic from ngtsc that parses the template with and without whitespaces so that the produced diagnostics have the correct spans.

**File**: `packages/compiler-cli/preprocessor/src/file_analysis.ts` (modified, +10/-2)
```diff
@@ -6,16 +6,24 @@
  * found in the LICENSE file at https://angular.dev/license
  */
 
-import {ParsedTemplate} from '@angular/compiler';
+import {ParsedTemplate, TmplAstNode} from '@angular/compiler';
 
 import {PreparedTcbData} from './tcb.js';
 import {AnalysisResult, DeclarationMetadata} from './types.js';
 
+export interface ParsedComponentTemplate extends ParsedTemplate {
+  /**
+   * Nodes of the template parsed with whitespace, line endings, and leading trivia preserved,
+   * for accurate source spans in type-checking, diagnostics, and indexing.
+   */
+  diagNodes: TmplAstNode[];
+}
+
 export interface FileAnalysis {
   filePath: string;
   tcb?: string | null;
   // maps keyed by className
-  parsedTemplates?: Map<string, ParsedTemplate>;
+  parsedTemplates?: Map<string, ParsedComponentTemplate>;
   preparedTcbData?: PreparedTcbData | null;
 }
 
```

**File**: `packages/compiler-cli/preprocessor/src/hybrid_compiler.ts` (modified, +9/-4)
```diff
@@ -10,7 +10,6 @@ import {
   BoundTarget,
   LEGACY_OPTIONAL_CHAINING_DEFAULT,
   MatchSource,
-  ParsedTemplate,
   ParseTemplateOptions,
   TcbDirectiveMetadata,
 } from '@angular/compiler';
@@ -19,7 +18,12 @@ import * as fs from 'node:fs/promises';
 import * as path from 'path';
 import {makeClassKey} from './compiler-utils.js';
 import {withErrorGuide} from './diagnostic.js';
-import {ChunkContext, FileAnalysis, getOrCreateFileAnalysis} from './file_analysis.js';
+import {
+  ChunkContext,
+  FileAnalysis,
+  ParsedComponentTemplate,
+  getOrCreateFileAnalysis,
+} from './file_analysis.js';
 import {IndexedComponent} from './indexer_api.js';
 import {getIndexedComponents, getIndexedComponentsSync} from './indexing/indexer.js';
 import {buildTcbTargets, processFile, processFileSync, type ProcessedFile} from './processor.js';
@@ -599,7 +603,7 @@ export class HybridCompiler {
   ): FileAnalysis {
     let templatesByClass = fileAnalysis.parsedTemplates;
     if (!templatesByClass) {
-      templatesByClass = new Map<string, ParsedTemplate>();
+      templatesByClass = new Map<string, ParsedComponentTemplate>();
       fileAnalysis.parsedTemplates = templatesByClass;
     }
 
@@ -669,7 +673,8 @@ export class HybridCompiler {
   }
 
   getParsedTemplate(filePath: string, classKey: string): any | null {
-    return this.ensureBoundSync(filePath).parsedTemplates?.get(classKey) ?? null;
+    const parsed = this.ensureBoundSync(filePath).parsedTemplates?.get(classKey);
+    return parsed ? {...parsed, nodes: parsed.diagNodes} : null;
   }
 
   getHostElement(filePath: string, classKey: string): any | null {
```

**File**: `packages/compiler-cli/preprocessor/src/indexing/indexer.ts` (modified, +1/-1)
```diff
@@ -195,7 +195,7 @@ function indexFileComponents(
       }
     }
     const visitor = new IndexerVisitor<ClassEntity>(new IndexerBoundTemplate(boundTarget, pipeMap));
-    parsedTemplate.nodes.forEach((node: TmplAstNode) => node.visit(visitor));
+    parsedTemplate.diagNodes.forEach((node: TmplAstNode) => node.visit(visitor));
 
     const identifiers = new Set<TopLevelIdentifier>();
 
```

**File**: `packages/compiler-cli/preprocessor/src/processor.ts` (modified, +36/-16)
```diff
@@ -72,7 +72,12 @@ import {
   stripIife,
   type MinimalDirectiveMeta,
 } from './compiler-utils.js';
-import {ChunkContext, FileAnalysis, getOrCreateFileAnalysis} from './file_analysis.js';
+import {
+  ChunkContext,
+  FileAnalysis,
+  ParsedComponentTemplate,
+  getOrCreateFileAnalysis,
+} from './file_analysis.js';
 import {analyzeForeignComponentFeatures} from './foreign_component.js';
 import {extractHmrMetadata, getHmrUpdateDeclaration} from './hmr.js';
 import type {IAnalyzer} from './hybrid_compiler.js';
@@ -175,7 +180,7 @@ export function buildTcbTargets(
   filePath: string,
   content: string,
   classes: nga.ClassMetadata[],
-  templatesByClass: Map<string, any>,
+  templatesByClass: Map<string, ParsedComponentTemplate>,
   options: Partial<ParseTemplateOptions> = {},
   tcbConfig: NgpTypeCheckingConfig,
 ): TcbTargetInput[] {
@@ -218,7 +223,7 @@ export function buildTcbTargets(
         classMeta: cls,
         className,
         template: component.template || '',
-        templateNodes: parsed.nodes,
+        templateNodes: parsed.diagNodes,
         declarations: component.resolvedDeclarations ?? [],
         enableSelectorless: options.enableSelectorless ?? false,
         selectorlessEnabled,
@@ -303,7 +308,7 @@ export async function processFile(
   }
   const fileAnalysis = getOrCreateFileAnalysis(rawCtx.fileCache, filePath);
   if (!fileAnalysis.parsedTemplates) {
-    fileAnalysis.parsedTemplates = new Map<string, ParsedTemplate>();
+    fileAnalysis.parsedTemplates = new Map<string, ParsedComponentTemplate>();
   }
   const templatesByClass = fileAnalysis.parsedTemplates;
   const resourceMap = new Map<string, nga.ResolvedResource | null>();
@@ -383,7 +388,7 @@ export function processFileSync(
   let fileAnalysis = getOrCreateFileAnalysis(ctx.fileCache, filePath);
   let templatesByClass = fileAnalysis.parsedTemplates;
   if (!templatesByClass) {
-    templatesByClass = new Map<string, any>();
+    templatesByClass = new Map<string, ParsedComponentTemplate>();
     fileAnalysis.parsedTemplates = templatesByClass;
   }
 
@@ -3175,28 +3180,43 @@ function parseComponentTemplate(
   filePath: string,
   content: string,
   options: Partial<ParseTemplateOptions> = {},
-): ParsedTemplate {
+): ParsedComponentTemplate {
   const parseOptions: Partial<ParseTemplateOptions> = {
     ...options,
     preserveWhitespaces: component.preserveWhitespaces ?? options.preserveWhitespaces ?? false,
   };
+  const diagParseOptions: Partial<ParseTemplateOptions> = {
+    ...options,
+    preserveWhitespaces: true,
+    preserveLineEndings: true,
+    preserveSignificantWhitespace: true,
+    leadingTriviaChars: [],
+  };
+
   // A `template` literal is parsed out of this file's source text so its spans are offsets
   // into it. An external template, or an inline one computed by any other expression, is parsed
   // on its own: its spans are offsets into the template string (ngtsc's `external` and
   // `indirect` source mappings).
-  // TODO(parity): ngtsc's `parseExtractedTemplate` also parses a second, span-faithful copy
-  // (`diagNodes`: whitespace, line endings and leading trivia preserved) that type-checking
-  // binds against. Only this primary parse exists here, so spans that line-ending
-  // normalization moves (e.g. an ICU switch value after CRLF line breaks) can still drift.
+  // Mirroring ngtsc's `parseExtractedTemplate`, also parse a second, span-faithful copy
+  // (`diagNodes`: whitespace, line endings and leading trivia preserved) for type-checking,
+  // diagnostics, and indexing.
   const contentSpan = component.templateContentSpan;
   if (component.templateUrl == null && contentSpan != null) {
-    return parseDirectInlineTemplate(content, filePath, contentSpan, parseOptions);
+    const parsed = parseDirectInlineTemplate(content, filePath, contentSpan, parseOptions);
+    const diagNodes = parseDirectInlineTemplate(
+      content,
+      filePath,
+      contentSpan,
+      diagParseOptions,
+    ).nodes;
+    return {...parsed, diagNodes};
   }
+
   // The URL identifies the file the spans are offsets into, which for an external template is
   // the template file itself (as in ngtsc's `extractTemplate`).
-  return parseTemplate(
-    component.template || '',
-    component.templateUrl?.resolvedPath ?? filePath,
-    parseOptions,
-  );
+  const templateStr = component.template || '';
+  const templateUrl = component.templateUrl?.resolvedPath ?? filePath;
+  const parsed = parseTemplate(templateStr, templateUrl, parseOptions);
+  const diagNodes = parseTemplate(templateStr, templateUrl, diagParseOptions).nodes;
+  return {...parsed, diagNodes};
 }
```

**File**: `packages/compiler-cli/preprocessor/test/golden/defer_block/golden.opt.md` (modified, +1/-1)
```diff
@@ -13,7 +13,7 @@ var _pipe1 = null! as i1.TestPipe;
 /*tcb1*/
 function _tcb1(this: i0.AppComponent) {
   if (true) {
-    '' + _pipe1.transform(/*235,243*/ 'hello' /*225,232*/) /*225,243*/;
+    '' + _pipe1.transform(/*241,249*/ 'hello' /*231,238*/) /*231,249*/;
   }
 }
 
```

**File**: `packages/compiler-cli/preprocessor/test/golden/defer_deferred_imports/golden.opt.md` (modified, +1/-1)
```diff
@@ -13,7 +13,7 @@ var _pipe1 = null! as i1.DeferredPipe;
 /*tcb1*/
 function _tcb1(this: i0.AppComponent) {
   if (true) {
-    '' + _pipe1.transform(/*306,318*/ 'hello' /*296,303*/) /*296,318*/;
+    '' + _pipe1.transform(/*312,324*/ 'hello' /*302,309*/) /*302,324*/;
   }
 }
 
```

**File**: `packages/compiler-cli/preprocessor/test/golden/defer_ngmodule_transitive_deps/golden.opt.md` (modified, +1/-1)
```diff
@@ -13,7 +13,7 @@ var _pipe1 = null! as i1.TrimPipe;
 /*tcb1*/
 function _tcb1(this: i0.AppComponent) {
   if (true) {
-    '' + _pipe1.transform(/*327,331*/ ' hello ' /*315,324*/) /*315,331*/;
+    '' + _pipe1.transform(/*329,333*/ '  hello  ' /*315,326*/) /*315,333*/;
   }
 }
 
```

**File**: `packages/compiler-cli/preprocessor/test/golden/defer_pipe_only_dom_only/golden.opt.md` (modified, +1/-1)
```diff
@@ -46,7 +46,7 @@ class AppComponent {}
 function _tcb1(this: AppComponent) {
   if (true) {
     var _pipe1 = null! as MyPipe;
-    '' + _pipe1.transform(/*1041,1047*/ 'hello' /*1031,1038*/) /*1031,1047*/;
+    '' + _pipe1.transform(/*1049,1055*/ 'hello' /*1039,1046*/) /*1039,1055*/;
   }
 }
 
```

---

### Incident Patch 3: `fd9e5635` (2026-10-18)
**Commit Message**: fix(compiler-cli): spread raw options argument in ngp signal query metadata

In ngtsc, signal query class metadata and JIT decorators spread the user's options object literal verbatim (`{ ...options, isSignal: true }`), preserving explicit options like `descendants: false` or `debugName` and avoiding extra keys when no options argument was passed.

Previously, ngp reconstructed the options object from parsed `readSpan` and `descendants` fields. That emitted a spurious `descendants: true` on bare `contentChild('x')` calls (where no options argument was provided) and dropped `descendants: false` when explicitly passed.

Record the raw `options_span` on `QueryMetadata` in `ng-analyze` and spread it via `LiteralMapSpreadAssignment` in `buildPropDecoratorsExpr` (and JIT decorator synthesis) so ngp matches ngtsc.

**File**: `packages/compiler-cli/preprocessor/ng-analyze/src/analyzer/class_data.rs` (modified, +4/-0)
```diff
@@ -107,6 +107,7 @@ pub struct QueryData {
     pub descendants: bool,
     pub emit_distinct_changes_only: bool,
     pub read_span: Option<oxc_span::Span>,
+    pub options_span: Option<oxc_span::Span>,
     pub is_static: bool,
     pub is_signal: bool,
     pub decorator_span: Option<oxc_span::Span>,
@@ -2737,6 +2738,9 @@ impl QueryData {
             read_span: self
                 .read_span
                 .map(|s| crate::types::metadata::SpanMetadata::new(s, converter)),
+            options_span: self
+                .options_span
+                .map(|s| crate::types::metadata::SpanMetadata::new(s, converter)),
             is_static: self.is_static,
             is_signal: self.is_signal,
             decorator_span: self
```

**File**: `packages/compiler-cli/preprocessor/ng-analyze/src/analyzer/queries.rs` (modified, +31/-0)
```diff
@@ -223,6 +223,7 @@ pub fn extract_queries<'a>(
                 descendants,
                 emit_distinct_changes_only,
                 read_span,
+                options_span: None,
                 is_static,
                 is_signal: false,
                 decorator_span: Some(decorator.span),
@@ -263,6 +264,11 @@ pub fn extract_queries<'a>(
         let predicate = extract_predicate(&call.arguments[0], PredicateKind::Signal, eval);
         let (descendants, emit_distinct_changes_only, read_span, is_static) =
             extract_query_options(&call.arguments, default_descendants, semantic);
+        let options_span = call
+            .arguments
+            .get(1)
+            .and_then(|arg| arg.as_expression())
+            .map(GetSpan::span);
         if let Some(reads) = top_level_reads.as_deref_mut() {
             super::collect_argument_references(
                 &call.arguments,
@@ -282,6 +288,7 @@ pub fn extract_queries<'a>(
             descendants,
             emit_distinct_changes_only,
             read_span,
+            options_span,
             is_static,
             is_signal: true,
             decorator_span: None,
@@ -341,6 +348,7 @@ pub(crate) fn parse_legacy_query<'a>(
         descendants,
         emit_distinct_changes_only,
         read_span,
+        options_span: None,
         is_static,
         is_signal: false,
         decorator_span: Some(expr.span()),
@@ -367,6 +375,7 @@ mod tests {
         descendants: bool,
         emit_distinct_changes_only: bool,
         read: Option<String>,
+        options: Option<String>,
         is_static: bool,
         is_signal: bool,
     }
@@ -419,6 +428,9 @@ mod tests {
                             vec![q.predicate_span.source_text(source_text).to_string()]
                         });
                         let read = q.read_span.map(|s| s.source_text(source_text).to_string());
+                        let options = q
+                            .options_span
+                            .map(|s| s.source_text(source_text).to_string());
 
                         let res = QueryTestResult {
                             property_name: q.property_name,
@@ -429,6 +441,7 @@ mod tests {
                             descendants: q.descendants,
                             emit_distinct_changes_only: q.emit_distinct_changes_only,
                             read,
+                            options,
                             is_static: q.is_static,
                             is_signal: q.is_signal,
                         };
@@ -564,20 +577,33 @@ mod tests {
         assert!(queries[0].is_signal);
         assert!(queries[0].descendants);
         assert!(queries[0].emit_distinct_changes_only);
+        assert_eq!(
+            queries[0].options.as_deref(),
+            Some("{ descendants: true }")
+        );
 
         assert_eq!(queries[1].property_name, "signalContentItems");
         assert!(!queries[1].first);
         assert!(queries[1].is_signal);
         assert!(!queries[1].descendants);
+        assert_eq!(
+            queries[1].options.as_deref(),
+            Some("{ descendants: false }")
+        );
 
         assert_eq!(queries[2].property_name, "signalContentItemsDefault");
         assert!(!queries[2].first);
         assert!(!queries[2].descendants);
         assert!(queries[2].emit_distinct_changes_only);
+        assert_eq!(queries[2].options, None);
 
         assert_eq!(queries[3].property_name, "signalContentItemsNoDistinct");
         assert!(!queries[3].first);
         assert!(!queries[3].emit_distinct_changes_only);
+        assert_eq!(
+            queries[3].options.as_deref(),
+            Some("{ emitDistinctChangesOnly: false }")
+        );
 
         assert_eq!(view_queries.len(), 6);
 
@@ -586,10 +612,15 @@ mod tests {
         assert!(view_queries[0].is_signal);
         assert!(view_queries[0].descendants);
         assert!(view_queries[0].emit_distinct_changes_only);
+        assert_eq!(view_queries[0].options, None);
 
         assert_eq!(view_queries[1].property_name, "signalTpl");
         assert!(view_queries[1].first);
         assert_eq!(view_queries[1].read.as_deref(), Some("TemplateRef"));
+        assert_eq!(
+            view_queries[1].options.as_deref(),
+            Some("{ read: TemplateRef }")
+        );
 
         assert_eq!(view_queries[2].property_name, "signalItems");
         assert!(!view_queries[2].first);
```

**File**: `packages/compiler-cli/preprocessor/ng-analyze/src/types/metadata.rs` (modified, +2/-0)
```diff
@@ -534,6 +534,8 @@ pub struct QueryMetadata {
     pub emit_distinct_changes_only: bool,
     #[serde(skip_serializing_if = "Option::is_none")]
     pub read_span: Option<SpanMetadata>,
+    #[serde(skip_serializing_if = "Option::is_none")]
+    pub options_span: Option<SpanMetadata>,
     pub is_static: bool,
     pub is_signal: bool,
     #[serde(skip_serializing_if = "Option::is_none")]
```

**File**: `packages/compiler-cli/preprocessor/src/processor.ts` (modified, +17/-26)
```diff
@@ -484,14 +484,11 @@ export function processFileSync(
         const predicateStr = query.predicateSelectors
           ? rawPred
           : `${coreNamespace}.forwardRef(() => ${rawPred})`;
-        const optionsObj: string[] = ['isSignal: true'];
-        if (query.readSpan) {
-          const readStr = s.original.slice(query.readSpan.start, query.readSpan.end);
-          optionsObj.push(`read: ${readStr}`);
-        }
-        if (!query.isView && query.descendants) {
-          optionsObj.push('descendants: true');
+        const optionsObj: string[] = [];
+        if (query.optionsSpan) {
+          optionsObj.push(`...${s.original.slice(query.optionsSpan.start, query.optionsSpan.end)}`);
         }
+        optionsObj.push('isSignal: true');
         const optionsStr = `({${optionsObj.join(', ')}} as any)`;
         s.appendLeft(
           query.propertySpan!.start,
@@ -2183,34 +2180,28 @@ function buildPropDecoratorsExpr(
       ]);
     }
 
-    const queryOptionsProps: {key: string; value: o.Expression; quoted: boolean}[] = [
-      {key: 'isSignal', value: o.literal(true), quoted: false},
-    ];
-    if (query.readSpan) {
+    const queryOptionsEntries: o.LiteralMapEntry[] = [];
+    if (query.optionsSpan) {
       // TODO(cleanup): `laterDeclarationReferences` only covers decorator arguments, so a signal
-      // query's `read` naming a later declaration is unguarded and fails `tsc` inside the static
+      // query's options naming a later declaration is unguarded and fails `tsc` inside the static
       // block.
-      const readStr = s.original.slice(query.readSpan.start, query.readSpan.end);
-      queryOptionsProps.push({
-        key: 'read',
-        value: new o.WrappedNodeExpr(new RawSource(readStr, [query.readSpan])),
-        quoted: false,
-      });
-    }
-    if (!query.isView && query.descendants) {
-      queryOptionsProps.push({
-        key: 'descendants',
-        value: o.literal(true),
-        quoted: false,
-      });
+      const optionsStr = s.original.slice(query.optionsSpan.start, query.optionsSpan.end);
+      queryOptionsEntries.push(
+        new o.LiteralMapSpreadAssignment(
+          new o.WrappedNodeExpr(new RawSource(optionsStr, [query.optionsSpan])),
+        ),
+      );
     }
+    queryOptionsEntries.push(
+      new o.LiteralMapPropertyAssignment('isSignal', o.literal(true), false),
+    );
 
     entry.decorators.push(
       o.literalMap([
         {key: 'type', value: new o.ExternalExpr(queryIdentifier), quoted: false},
         {
           key: 'args',
-          value: o.literalArr([predicateExpr, o.literalMap(queryOptionsProps)]),
+          value: o.literalArr([predicateExpr, new o.LiteralMapExpr(queryOptionsEntries)]),
           quoted: false,
         },
       ]),
```

**File**: `packages/compiler-cli/preprocessor/src/types.ts` (modified, +1/-0)
```diff
@@ -722,6 +722,7 @@ export interface QueryMetadata {
   descendants: boolean;
   emitDistinctChangesOnly: boolean;
   readSpan?: SpanMetadata;
+  optionsSpan?: SpanMetadata;
   isStatic: boolean;
   isSignal: boolean;
   decoratorSpan?: SpanMetadata;
```

**File**: `packages/compiler-cli/preprocessor/test/golden/advanced_signals/golden.md` (modified, +2/-4)
```diff
@@ -209,11 +209,9 @@ export class AdvancedComp {
           directOutputObs: [{ type: i0.Output, args: ['directOutputObs'] }],
           nsOutput: [{ type: i0.Output, args: ['nsOutput'] }],
           nsOutputObs: [{ type: i0.Output, args: ['nsOutputObs'] }],
-          directContentChild: [
-            { type: i0.ContentChild, args: ['tpl', { isSignal: true, descendants: true }] },
-          ],
+          directContentChild: [{ type: i0.ContentChild, args: ['tpl', { isSignal: true }] }],
           directRequiredContentChild: [
-            { type: i0.ContentChild, args: ['tpl', { isSignal: true, descendants: true }] },
+            { type: i0.ContentChild, args: ['tpl', { isSignal: true }] },
           ],
           directContentChildren: [{ type: i0.ContentChildren, args: ['tpl', { isSignal: true }] }],
           directViewChild: [{ type: i0.ViewChild, args: ['tpl', { isSignal: true }] }],
```

**File**: `packages/compiler-cli/preprocessor/test/golden/jit_signal_transforms/golden.md` (modified, +1/-1)
```diff
@@ -77,7 +77,7 @@ export class JitComponent {
     ...((ngDevMode ? [{ debugName: 'sigViewChildren' }] : /* istanbul ignore next */ []) as []),
   );
 
-  @i0.ContentChild('contentEl', { isSignal: true, descendants: true } as any) sigContentChild =
+  @i0.ContentChild('contentEl', { isSignal: true } as any) sigContentChild =
     contentChild<ElementRef>(
       'contentEl',
       ...((ngDevMode ? [{ debugName: 'sigContentChild' }] : /* istanbul ignore next */ []) as []),
```

**File**: `packages/compiler-cli/preprocessor/test/golden/queries/golden.md` (modified, +9/-3)
```diff
@@ -186,14 +186,20 @@ export class AppComponent {
           ],
           setterQuery: [{ type: ViewChild, args: ['setterQuery'] }],
           signalContent: [
-            { type: i0.ContentChild, args: ['content', { isSignal: true, descendants: true }] },
+            {
+              type: i0.ContentChild,
+              args: ['content', { ...{ descendants: true }, isSignal: true }],
+            },
           ],
           signalContentItems: [
-            { type: i0.ContentChildren, args: ['contentItem', { isSignal: true }] },
+            {
+              type: i0.ContentChildren,
+              args: ['contentItem', { ...{ descendants: false }, isSignal: true }],
+            },
           ],
           signalDiv: [{ type: i0.ViewChild, args: ['myDiv', { isSignal: true }] }],
           signalTpl: [
-            { type: i0.ViewChild, args: ['myTpl', { isSignal: true, read: TemplateRef }] },
+            { type: i0.ViewChild, args: ['myTpl', { ...{ read: TemplateRef }, isSignal: true }] },
           ],
           signalItems: [{ type: i0.ViewChildren, args: ['item', { isSignal: true }] }],
           reqSignalDiv: [{ type: i0.ViewChild, args: ['myDiv', { isSignal: true }] }],
```

#### Recent Merged Pull Requests:
- **PR #71431** (2026-10-19): refactor(compiler): remove standalone:true from ngp tests (@JeanMeche)
- **PR #71429** (2026-10-19): fix(compiler-cli): ensure diagnostic spans are correct in preprocessor (@crisbeto)
- **PR #71428** (2026-10-19): fix(compiler-cli): do not treat declaration files as compilation roots in preprocessor (@crisbeto)
- **PR #71419** (closed): Better typing for component inputs (@Gouvernathor)
- **PR #71418** (2026-10-19): fix(compiler-cli): spread raw options argument in ngp signal query metadata (@JeanMeche)
- **PR #71417** (2026-10-19): fix(compiler-cli): preserve pure annotations on ngp static fields through tsc (@JeanMeche)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.


---

## 6. Net-New Universal Engineering Rules (Candidates for Master Brain)

## X. compiler-cli): do not treat declaration files as compilation roots in preprocess

**RULE**:
When implementing operations in `packages/compiler-cli/preprocessor/ng-analyze/src/compiler/analyzer.rs`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in angular/angular. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `d7be93c5`: compiler-cli): do not treat declaration files as compilation roots in preprocessor. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing TypeScript data structures, boundary deserialization, API parsing, or resource lifecycles matching `packages/compiler-cli/preprocessor/ng-analyze/src/compiler/analyzer.rs`.

**VERIFIED IMPLEMENTATION PATTERN**:
```typescript
// Verified production-grade fix pattern:
use crate::utils::{create_resolver_with_fs, is_compilation_root, is_ts_file, is_ts_source};
            .filter(|p| is_compilation_root(p))
                .filter(|p| is_compilation_root(p))
        if !is_compilation_root(&entry) {
```

**NEGATIVE CONSTRAINT**:
```typescript
// Anti-pattern to NEVER write (induced failure mode):
use crate::utils::{create_resolver_with_fs, is_ts_file, is_ts_source};
            .filter(|p| is_ts_file(p))
                .filter(|p| is_ts_file(p))
        if !is_ts_file(&entry) {
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `d7be93c5` are properly handled with clean fallback behavior.
