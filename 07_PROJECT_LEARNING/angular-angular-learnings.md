> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/angular-angular-learnings.md`  
> **Source**: github ([https://github.com/angular/angular](https://github.com/angular/angular))  
> **Source Version**: `ea43e6c3`  
> **License**: MIT  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-10-20T19:58:37.961Z  
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
> **Harvest Timestamp**: 2026-10-20T19:58:37.039Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `angular/angular`
- **Description**: Deliver web apps with confidence 🚀
- **Primary Language / Ecosystem**: TypeScript
- **Discovered Manifests / Configurations**: package.json, Cargo.toml, README.md
- **Stars / Engagement**: 101102 stars

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

### Incident Patch 1: `18fd9bed` (2026-10-15)
**Commit Message**: fix(core): guard against integer overflow in i18n

Adds a safeguard against integer overflows in ICU expressions.

**File**: `packages/core/src/render3/i18n/i18n_util.ts` (modified, +7/-0)
```diff
@@ -157,6 +157,13 @@ export function getInstructionFromIcuCreateOpCode(mergedCode: number): number {
 export function icuCreateOpCode(opCode: IcuCreateOpCode, parentIdx: number, refIdx: number) {
   ngDevMode && assertGreaterThanOrEqual(parentIdx, 0, 'Missing parent index');
   ngDevMode && assertGreaterThan(refIdx, 0, 'Missing ref index');
+
+  // Note that we intentionally retain the error here in production,
+  // because the value can change based on the locale.
+  if (parentIdx > IcuCreateOpCode.MAX_PARENT || refIdx > IcuCreateOpCode.MAX_REF) {
+    throw new Error('ICU node index out of range (too many nodes in ICU case)');
+  }
+
   return (
     opCode | (parentIdx << IcuCreateOpCode.SHIFT_PARENT) | (refIdx << IcuCreateOpCode.SHIFT_REF)
   );
```

**File**: `packages/core/src/render3/interfaces/i18n.ts` (modified, +11/-2)
```diff
@@ -65,6 +65,16 @@ export const enum IcuCreateOpCode {
   //           11111110000000000
   //           65432109876543210
 
+  /**
+   * Maximum value for the reference node index (16 bits).
+   */
+  MAX_REF = 0b1111111111111111,
+
+  /**
+   * Maximum value for the parent node index (15 bits).
+   */
+  MAX_PARENT = 0b111111111111111,
+
   /**
    * Instruction to append the current node to `PARENT`.
    */
@@ -123,8 +133,7 @@ export const enum IcuCreateOpCode {
  * ```
  */
 export interface IcuCreateOpCodes
-  extends Array<number | string | ELEMENT_MARKER | ICU_MARKER | null>,
-    I18nDebug {
+  extends Array<number | string | ELEMENT_MARKER | ICU_MARKER | null>, I18nDebug {
   __brand__: 'I18nCreateOpCodes';
 }
 
```

**File**: `packages/core/test/render3/i18n/i18n_parse_spec.ts` (modified, +28/-1)
```diff
@@ -10,7 +10,12 @@ import {ɵɵi18nApply, ɵɵi18nExp} from '../../../src/core';
 import {applyCreateOpCodes} from '../../../src/render3/i18n/i18n_apply';
 import {i18nStartFirstCreatePass} from '../../../src/render3/i18n/i18n_parse';
 import {getTIcu} from '../../../src/render3/i18n/i18n_util';
-import {I18nUpdateOpCodes, IcuType, TI18n} from '../../../src/render3/interfaces/i18n';
+import {
+  I18nUpdateOpCodes,
+  IcuCreateOpCode,
+  IcuType,
+  TI18n,
+} from '../../../src/render3/interfaces/i18n';
 import {HEADER_OFFSET, HOST} from '../../../src/render3/interfaces/view';
 
 import {matchTI18n, matchTIcu} from '../matchers';
@@ -341,6 +346,28 @@ describe('i18n_parse', () => {
         expect(fixture.host.innerHTML).toEqual(`<div></div><!--ICU ${HEADER_OFFSET + 0}:0-->`);
       });
     });
+
+    it('should throw if an ICU expression exceeds the maximum reference node index', () => {
+      fixture = new ViewFixture({
+        decls: IcuCreateOpCode.MAX_REF - HEADER_OFFSET - 2,
+        vars: 1,
+      });
+
+      expect(() => {
+        toT18n(`{\uFFFD0\uFFFD, select, other {<br><br>}}`);
+      }).toThrowError(/ICU node index out of range/);
+    });
+
+    it('should throw if an ICU expression exceeds the maximum parent node index', () => {
+      fixture = new ViewFixture({
+        decls: IcuCreateOpCode.MAX_PARENT - HEADER_OFFSET - 2,
+        vars: 1,
+      });
+
+      expect(() => {
+        toT18n(`{\uFFFD0\uFFFD, select, other {<div><span></span></div>}}`);
+      }).toThrowError(/ICU node index out of range/);
+    });
   });
 
   function toT18n(text: string) {
```

---

### Incident Patch 2: `5c4b6a48` (2026-09-22)
**Commit Message**: fix(core): avoid reloading a resource when params is unchanged

`ResourceImpl` wraps the result of `params()` in a `{request, reload}` object
before feeding it to the state machine. That wrapper is allocated inside the
computation of the `extRequest` linked signal, so when `params` is a plain
function (rather than a `Signal`), any signal read inside `params()` is tracked
directly as a producer of `extRequest`. Whenever that producer updates,
`extRequest` re-runs its computation, allocates a new `{request, reload}`
wrapper object that fails `Object.is`, and re-triggers the loader even when
`params()` returned the exact same value.

Wrap `request` in a `computed()` when `!isSignal(request)` so that `extRequest`
tracks the memoized `computed` signal and only recomputes when `params()`
actually changes (or when `request` is already a signal, tracks it directly
without an extra `computed`). Also encapsulate caught errors via
`encapsulateResourceError` directly in `extRequest` so non-Error thrown values
(including `undefined`) are properly treated as errors.

**File**: `packages/core/src/resource/resource.ts` (modified, +17/-3)
```diff
@@ -246,19 +246,33 @@ export class ResourceImpl<T, R> extends BaseWritableResource<T> implements Resou
 
     this.transferState = injector.get(TransferState, undefined, {optional: true}) ?? undefined;
 
+    const paramsSignal = isSignal(request)
+      ? request
+      : computed(
+          () => {
+            try {
+              setInParamsFunction(true);
+              return request(paramsContext);
+            } finally {
+              setInParamsFunction(false);
+            }
+          },
+          ngDevMode ? createDebugNameObject(debugName, 'params') : undefined,
+        );
+
     this.extRequest = linkedSignal<WrappedRequest>(
       () => {
         try {
           setInParamsFunction(true);
-          return {request: request(paramsContext), reload: 0};
+          return {request: paramsSignal(), reload: 0};
         } catch (error) {
           rethrowFatalErrors(error);
           if (error === ResourceParamsStatus.IDLE) {
             return {status: 'idle', reload: 0};
           } else if (error === ResourceParamsStatus.LOADING) {
             return {status: 'loading', reload: 0};
           }
-          return {error: error as Error, reload: 0};
+          return {error: encapsulateResourceError(error), reload: 0};
         } finally {
           setInParamsFunction(false);
         }
@@ -279,7 +293,7 @@ export class ResourceImpl<T, R> extends BaseWritableResource<T> implements Resou
         if (error) {
           status = 'resolved';
           stream = signal(
-            {error: encapsulateResourceError(error)},
+            {error},
             ngDevMode ? createDebugNameObject(this.debugName, 'stream') : undefined,
           );
         } else if (!status) {
```

**File**: `packages/core/test/resource/params_status_spec.ts` (modified, +82/-0)
```diff
@@ -117,6 +117,88 @@ describe('resource with ResourceParamsStatus', () => {
     expect(res.value()).toBe('foo');
     expect(loadCount).toBe(1);
   });
+
+  it('should propagate a different error thrown from params', async () => {
+    const s = signal<string | Error>('foo');
+    const res = await actAsync(() =>
+      resource({
+        params: throwStatusAndErrors(s),
+        loader: async ({params}) => params as string,
+        injector: TestBed.inject(Injector),
+      }),
+    );
+
+    await actAsync(() => s.set(new Error('first')));
+    expect(res.status()).toBe('error');
+    expect(res.error()).toEqual(new Error('first'));
+
+    await actAsync(() => s.set(new Error('second')));
+    expect(res.status()).toBe('error');
+    expect(res.error()).toEqual(new Error('second'));
+  });
+
+  it('should keep the status when an unrelated signal re-runs params that throws the same status', async () => {
+    const unrelated = signal(0);
+    const s = signal<string | ResourceParamsStatus>(ResourceParamsStatus.LOADING);
+    let paramsCount = 0;
+    let loadCount = 0;
+    const res = await actAsync(() =>
+      resource({
+        params: () => {
+          paramsCount++;
+          unrelated();
+          return throwStatusAndErrors(s)();
+        },
+        loader: async ({params}) => {
+          loadCount++;
+          return params;
+        },
+        injector: TestBed.inject(Injector),
+      }),
+    );
+
+    expect(res.status()).toBe('loading');
+    expect(paramsCount).toBe(1);
+
+    await actAsync(() => unrelated.set(1));
+
+    expect(paramsCount).toBe(2);
+    expect(res.status()).toBe('loading');
+    expect(loadCount).toBe(0);
+
+    await actAsync(() => s.set('foo'));
+    expect(res.status()).toBe('resolved');
+    expect(loadCount).toBe(1);
+  });
+
+  it('should distinguish between returning undefined and throwing undefined in params', async () => {
+    const throwIt = signal(false);
+    let loads = 0;
+
+    const res = await actAsync(() =>
+      resource({
+        params: () => {
+          if (throwIt()) {
+            throw undefined;
+          }
+          return undefined;
+        },
+        loader: async () => {
+          loads++;
+          return 'loaded';
+        },
+        injector: TestBed.inject(Injector),
+      }),
+    );
+
+    expect(res.status()).toBe('idle');
+    expect(loads).toBe(0);
+
+    await actAsync(() => throwIt.set(true));
+
+    expect(res.status()).toBe('error');
+    expect(loads).toBe(0);
+  });
 });
 
 async function act<T>(fn: () => T): Promise<T> {
```

**File**: `packages/core/test/resource/resource_spec.ts` (modified, +40/-0)
```diff
@@ -1031,6 +1031,46 @@ describe('resource', () => {
     expect(echoResource.error()).toEqual(undefined);
   });
 
+  it('should not reload when a signal read in params changes but params returns the same value', async () => {
+    const routeParams = signal<{id: string; tab: string}>({id: '1', tab: 'overview'});
+    let loadCount = 0;
+
+    const userResource = resource({
+      params: () => routeParams().id,
+      loader: async ({params: id}) => {
+        loadCount++;
+        return `user-${id}-${loadCount}`;
+      },
+      injector: TestBed.inject(Injector),
+    });
+
+    await timeout();
+    expect(loadCount).toBe(1);
+    expect(userResource.value()).toBe('user-1-1');
+
+    // Updating `routeParams` with a new object that has the same `id` should not re-run the loader
+    routeParams.set({id: '1', tab: 'orders'});
+    await timeout();
+    expect(loadCount).toBe(1);
+    expect(userResource.value()).toBe('user-1-1');
+
+    // Even after a manual reload(), a subsequent signal update with the same `id` should not trigger another reload
+    userResource.reload();
+    await timeout();
+    expect(loadCount).toBe(2);
+    expect(userResource.value()).toBe('user-1-2');
+
+    routeParams.set({id: '1', tab: 'settings'});
+    await timeout();
+    expect(loadCount).toBe(2);
+    expect(userResource.value()).toBe('user-1-2');
+
+    routeParams.set({id: '2', tab: 'settings'});
+    await timeout();
+    expect(loadCount).toBe(3);
+    expect(userResource.value()).toBe('user-2-3');
+  });
+
   describe('types', () => {
     it('should narrow hasValue() when the value can be undefined', () => {
       const result: ResourceRef<number | undefined> = resource({
```

---

### Incident Patch 3: `1c6f6b2a` (2026-10-20)
**Commit Message**: build: lock file maintenance

See associated pull request for more information.

**File**: `.github/actions/deploy-docs-site/main.js` (modified, +117/-31)
```diff
@@ -2105,6 +2105,7 @@ var require_dispatcher = __commonJS({
 var require_dispatcher_base = __commonJS({
   ""(exports, module) {
     "use strict";
+    var buffer = __require("node:buffer");
     var Dispatcher = require_dispatcher();
     var {
       ClientDestroyedError,
@@ -2116,6 +2117,7 @@ var require_dispatcher_base = __commonJS({
     var kOnClosed = Symbol("onClosed");
     var kInterceptedDispatch = Symbol("Intercepted Dispatch");
     var kWebSocketOptions = Symbol("webSocketOptions");
+    var kEventSourceOptions = Symbol("eventSourceOptions");
     var DispatcherBase = class extends Dispatcher {
       constructor(opts) {
         super();
@@ -2124,13 +2126,19 @@ var require_dispatcher_base = __commonJS({
         this[kClosed] = false;
         this[kOnClosed] = [];
         this[kWebSocketOptions] = opts?.webSocket ?? {};
+        this[kEventSourceOptions] = opts?.eventSource ?? {};
       }
       get webSocketOptions() {
         return {
           maxFragments: this[kWebSocketOptions].maxFragments ?? 131072,
           maxPayloadSize: this[kWebSocketOptions].maxPayloadSize ?? 128 * 1024 * 1024
         };
       }
+      get eventSourceOptions() {
+        return {
+          maxEventSize: this[kEventSourceOptions].maxEventSize ?? buffer.kStringMaxLength
+        };
+      }
       get destroyed() {
         return this[kDestroyed];
       }
@@ -6271,7 +6279,6 @@ var require_client_h1 = __commonJS({
       socket[kSocketUsed] = false;
       socket[kParser] = new Parser2(client, socket, llhttpInstance);
       addListener(socket, "error", function(err) {
-        assert2(err.code !== "ERR_TLS_CERT_ALTNAME_INVALID");
         const parser2 = this[kParser];
         if (err.code === "ECONNRESET" && parser2.statusCode && !parser2.shouldKeepAlive) {
           const parserErr = parser2.finish();
@@ -6955,7 +6962,6 @@ var require_client_h2 = __commonJS({
       client[kHTTP2Session] = session;
       socket[kHTTP2Session] = session;
       util.addListener(socket, "error", function(err) {
-        assert2(err.code !== "ERR_TLS_CERT_ALTNAME_INVALID");
         this[kError] = err;
         this[kClient][kOnError](err);
       });
@@ -7014,7 +7020,6 @@ var require_client_h2 = __commonJS({
       }
     }
     function onHttp2SessionError(err) {
-      assert2(err.code !== "ERR_TLS_CERT_ALTNAME_INVALID");
       this[kSocket][kError] = err;
       this[kClient][kOnError](err);
     }
@@ -7709,9 +7714,10 @@ var require_client = __commonJS({
         // h2
         maxConcurrentStreams,
         allowH2,
-        webSocket
+        webSocket,
+        eventSource
       } = {}) {
-        super({ webSocket });
+        super({ webSocket, eventSource });
         if (keepAlive !== void 0) {
           throw new InvalidArgumentError("unsupported keepAlive, use pipelining=0 instead");
         }
@@ -8609,7 +8615,7 @@ var require_agent = __commonJS({
       return opts && opts.connections === 1 ? new Client(origin, opts) : new Pool(origin, opts);
     }
     var Agent = class extends DispatcherBase {
-      constructor({ factory = defaultFactory, maxRedirections = 0, connect, ...options } = {}) {
+      constructor({ factory = defaultFactory, maxRedirections = 0, connect, tls, ...options } = {}) {
         if (typeof factory !== "function") {
           throw new InvalidArgumentError("factory must be a function.");
         }
@@ -8623,8 +8629,11 @@ var require_agent = __commonJS({
         if (connect && typeof connect !== "function") {
           connect = { ...connect };
         }
+        if (tls && typeof tls !== "function") {
+          tls = { ...tls };
+        }
         this[kInterceptors] = options.interceptors?.Agent && Array.isArray(options.interceptors.Agent) ? options.interceptors.Agent : [createRedirectInterceptor({ maxRedirections })];
-        this[kOptions] = { ...util.deepClone(options), connect };
+        this[kOptions] = { ...util.deepClone(options), connect, tls };
         this[kOptions].interceptors = options.interceptors ? { ...options.interceptors } : void 0;
         this[kMaxRedirections] = maxRedirections;
         this[kFactory] = factory;
@@ -14356,8 +14365,9 @@ var require_fetch = __commonJS({
         }
       );
       response.body = { stream, source: null, length: null };
-      fetchParams.controller.onAborted = onAborted;
-      fetchParams.controller.on("terminated", onAborted);
+      if (!fetchParams.controller.resume) {
+        fetchParams.controller.on("terminated", onAborted);
+      }
       fetchParams.controller.resume = async () => {
         while (true) {
           let bytes;
@@ -14457,15 +14467,14 @@ var require_fetch = __commonJS({
                 headersList.append(bufferToLowerCasedHeaderName(rawHeaders[i]), rawHeaders[i + 1].toString("latin1"), true);
               }
               location = headersList.get("location", true);
-              this.body = new Readable({ read: resume });
               const decoders = [];
               const w
```

**File**: `Cargo.lock` (modified, +4/-4)
```diff
@@ -466,9 +466,9 @@ dependencies = [
 
 [[package]]
 name = "libc"
-version = "0.2.190"
+version = "0.2.191"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "ce5d3ddc6d3fa000eb1536d85e147bfe31aacaba692ed6a876f95cb7c855be78"
+checksum = "65cd87c9a6d60536580b316ad985726104730a5151c99845f2490428ef91240a"
 
 [[package]]
 name = "libloading"
@@ -1345,9 +1345,9 @@ dependencies = [
 
 [[package]]
 name = "tokio"
-version = "1.53.3"
+version = "1.54.0"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "ce3335fa71841cda333a58d7615b03901380ecf09d59b3296d21f8bbac0dde4e"
+checksum = "a0c168a474b95bfecfe908a65d4bdffc523144b649a74c09c286afb35d53e0bc"
 dependencies = [
  "pin-project-lite",
 ]
```

**File**: `adev/shared-docs/pipeline/examples/template/package-lock.json` (modified, +84/-84)
```diff
@@ -42,13 +42,13 @@
       }
     },
     "node_modules/@angular-devkit/architect": {
-      "version": "0.2202.2",
-      "resolved": "https://registry.npmjs.org/@angular-devkit/architect/-/architect-0.2202.2.tgz",
-      "integrity": "sha512-7ScBo47haHyRGG5M5ZEpbhwHgO2LEDbCLwNCjpjwhtRFDIEmAFbULM1OQjIybN3x+wOyY1kWRK7KvihCbs371g==",
+      "version": "0.2202.3",
+      "resolved": "https://registry.npmjs.org/@angular-devkit/architect/-/architect-0.2202.3.tgz",
+      "integrity": "sha512-/605FxTg8Kt5fqNuIBVZMfuiNwIf+CTNsiYnHY85/7OTqCNkEwdkXKc3DiFM2KlR/AV2g64GkvHgHqxHzYh34g==",
       "dev": true,
       "license": "MIT",
       "dependencies": {
-        "@angular-devkit/core": "22.2.2",
+        "@angular-devkit/core": "22.2.3",
         "rxjs": "7.8.2"
       },
       "bin": {
@@ -61,9 +61,9 @@
       }
     },
     "node_modules/@angular-devkit/core": {
-      "version": "22.2.2",
-      "resolved": "https://registry.npmjs.org/@angular-devkit/core/-/core-22.2.2.tgz",
-      "integrity": "sha512-iQexb5xUON9AkTzvBiMftrHWLguIlYv6M/BOH/sj7U5L8eOPMu8N269WF74xPo4n/X5tusFLqniGI0zolT2Sjg==",
+      "version": "22.2.3",
+      "resolved": "https://registry.npmjs.org/@angular-devkit/core/-/core-22.2.3.tgz",
+      "integrity": "sha512-bi1oBjJeg1XCgRrBYSuJikaJV4sO/mcnyFE/0a1H646yHhQpVYoU/M2Vh69Qv8h+YoMfC7RuSxT4LZHaubhhLw==",
       "dev": true,
       "license": "MIT",
       "dependencies": {
@@ -89,13 +89,13 @@
       }
     },
     "node_modules/@angular-devkit/schematics": {
-      "version": "22.2.2",
-      "resolved": "https://registry.npmjs.org/@angular-devkit/schematics/-/schematics-22.2.2.tgz",
-      "integrity": "sha512-uCpFZbQgFUrOjKHLeYSCaYCJdufauYom8yFGggm67yetMAGKPbmRvUEko8i8auNFoBQ+1w1CivjSTwtmXQzZkA==",
+      "version": "22.2.3",
+      "resolved": "https://registry.npmjs.org/@angular-devkit/schematics/-/schematics-22.2.3.tgz",
+      "integrity": "sha512-+XfBViIGqiFQK8KJXA6PgANX9tLuMO/x8GFjlzEmA4LIe9ikAtpGZw+Ezo547BIJQoJBIKCJYR0knE4BmbFeSQ==",
       "dev": true,
       "license": "MIT",
       "dependencies": {
-        "@angular-devkit/core": "22.2.2",
+        "@angular-devkit/core": "22.2.3",
         "jsonc-parser": "3.3.1",
         "magic-string": "1.4.1",
         "ora": "9.4.1",
@@ -108,9 +108,9 @@
       }
     },
     "node_modules/@angular/animations": {
-      "version": "22.2.2",
-      "resolved": "https://registry.npmjs.org/@angular/animations/-/animations-22.2.2.tgz",
-      "integrity": "sha512-N2VTjsH9xHGWsKlyeWrODcp4b2UEkrT/lGkHMxL4yr+ie0sKpxtZzzwzOQMMCRyv39ff2sfPQjb7q56K8RZ78w==",
+      "version": "22.2.3",
+      "resolved": "https://registry.npmjs.org/@angular/animations/-/animations-22.2.3.tgz",
+      "integrity": "sha512-sslKnTrKwHwtTvT/pWj7UoYq0cfuX3PijZM7v0JtCajQkK1Nj0Ljob0mebxXBXUVBrOixfCnfBS0EG4JNEznFA==",
       "deprecated": "@angular/animations is deprecated. Use `animate.enter` and `animate.leave` instead. For more information see: https://v22.angular.dev/guide/animations.",
       "license": "MIT",
       "dependencies": {
@@ -120,18 +120,18 @@
         "node": "^22.22.3 || ^24.15.0 || >=26.0.0"
       },
       "peerDependencies": {
-        "@angular/core": "22.2.2"
+        "@angular/core": "22.2.3"
       }
     },
     "node_modules/@angular/build": {
-      "version": "22.2.2",
-      "resolved": "https://registry.npmjs.org/@angular/build/-/build-22.2.2.tgz",
-      "integrity": "sha512-QHJWkZdEWTqqb3+HiSp8lnuS4iQJCa7yTK9gg5TaMIjCoZzP9mD9L417stiVDZGj2J3Y9mrml044nEVvSbW0ig==",
+      "version": "22.2.3",
+      "resolved": "https://registry.npmjs.org/@angular/build/-/build-22.2.3.tgz",
+      "integrity": "sha512-EtNEuPBUCyIuzdXrQ/nINvgFzW8bUI5AkAZtJiSn7nsFOlvaygaKN0kENNTO3zRl3T9B4GDog+Ks5Nec3FBkhg==",
       "dev": true,
       "license": "MIT",
       "dependencies": {
         "@ampproject/remapping": "2.3.0",
-        "@angular-devkit/architect": "0.2202.2",
+        "@angular-devkit/architect": "0.2202.3",
         "@babel/core": "8.0.5",
         "@inquirer/confirm": "6.3.2",
         "@parcel/watcher": "2.6.0",
@@ -174,7 +174,7 @@
         "@angular/platform-browser": "^22.0.0",
         "@angular/platform-server": "^22.0.0",
         "@angular/service-worker": "^22.0.0",
-        "@angular/ssr": "^22.2.2",
+        "@angular/ssr": "^22.2.3",
         "istanbul-lib-instrument": "^6.0.0",
         "karma": "^6.4.0",
         "less": "^4.2.0",
@@ -323,26 +323,26 @@
       }
     },
     "node_modules/@angular/cli": {
-      "version": "22.2.2",
-      "resolved": "https://registry.npmjs.org/@angular/cli/-/cli-22.2.2.tgz",
-      "integrity": "sha512-AALIN+zai0CiA7HgSCGVPHyZyiw3yFWliCfbaS4ueHDJHVZ8QhVjRUrnfGZc3EJnigcyQ0w2DKeTxjwqpDjKew==",
+      "version": "22.2.3",
+      "resolved": "https://registry.npmjs.org/@angular/cli/-/cli-22.2.3.tgz",
+      "integrity": "sha512-ObTX0DxJ0/PMl4pkUKI+uWPr7UC7Je94KpHP8l1lr3exhundapgr7VvNsozprJb1hMlOMDab6+quTReSYvF85Q==",
       "dev": true,
       "license": "MIT",
       "dependencies": {
-        "@angular-d
```

**File**: `adev/shared-docs/pipeline/tutorials/common/package-lock.json` (modified, +68/-68)
```diff
@@ -38,13 +38,13 @@
       }
     },
     "node_modules/@angular-devkit/architect": {
-      "version": "0.2202.2",
-      "resolved": "https://registry.npmjs.org/@angular-devkit/architect/-/architect-0.2202.2.tgz",
-      "integrity": "sha512-7ScBo47haHyRGG5M5ZEpbhwHgO2LEDbCLwNCjpjwhtRFDIEmAFbULM1OQjIybN3x+wOyY1kWRK7KvihCbs371g==",
+      "version": "0.2202.3",
+      "resolved": "https://registry.npmjs.org/@angular-devkit/architect/-/architect-0.2202.3.tgz",
+      "integrity": "sha512-/605FxTg8Kt5fqNuIBVZMfuiNwIf+CTNsiYnHY85/7OTqCNkEwdkXKc3DiFM2KlR/AV2g64GkvHgHqxHzYh34g==",
       "dev": true,
       "license": "MIT",
       "dependencies": {
-        "@angular-devkit/core": "22.2.2",
+        "@angular-devkit/core": "22.2.3",
         "rxjs": "7.8.2"
       },
       "bin": {
@@ -57,9 +57,9 @@
       }
     },
     "node_modules/@angular-devkit/core": {
-      "version": "22.2.2",
-      "resolved": "https://registry.npmjs.org/@angular-devkit/core/-/core-22.2.2.tgz",
-      "integrity": "sha512-iQexb5xUON9AkTzvBiMftrHWLguIlYv6M/BOH/sj7U5L8eOPMu8N269WF74xPo4n/X5tusFLqniGI0zolT2Sjg==",
+      "version": "22.2.3",
+      "resolved": "https://registry.npmjs.org/@angular-devkit/core/-/core-22.2.3.tgz",
+      "integrity": "sha512-bi1oBjJeg1XCgRrBYSuJikaJV4sO/mcnyFE/0a1H646yHhQpVYoU/M2Vh69Qv8h+YoMfC7RuSxT4LZHaubhhLw==",
       "dev": true,
       "license": "MIT",
       "dependencies": {
@@ -85,13 +85,13 @@
       }
     },
     "node_modules/@angular-devkit/schematics": {
-      "version": "22.2.2",
-      "resolved": "https://registry.npmjs.org/@angular-devkit/schematics/-/schematics-22.2.2.tgz",
-      "integrity": "sha512-uCpFZbQgFUrOjKHLeYSCaYCJdufauYom8yFGggm67yetMAGKPbmRvUEko8i8auNFoBQ+1w1CivjSTwtmXQzZkA==",
+      "version": "22.2.3",
+      "resolved": "https://registry.npmjs.org/@angular-devkit/schematics/-/schematics-22.2.3.tgz",
+      "integrity": "sha512-+XfBViIGqiFQK8KJXA6PgANX9tLuMO/x8GFjlzEmA4LIe9ikAtpGZw+Ezo547BIJQoJBIKCJYR0knE4BmbFeSQ==",
       "dev": true,
       "license": "MIT",
       "dependencies": {
-        "@angular-devkit/core": "22.2.2",
+        "@angular-devkit/core": "22.2.3",
         "jsonc-parser": "3.3.1",
         "magic-string": "1.4.1",
         "ora": "9.4.1",
@@ -104,14 +104,14 @@
       }
     },
     "node_modules/@angular/build": {
-      "version": "22.2.2",
-      "resolved": "https://registry.npmjs.org/@angular/build/-/build-22.2.2.tgz",
-      "integrity": "sha512-QHJWkZdEWTqqb3+HiSp8lnuS4iQJCa7yTK9gg5TaMIjCoZzP9mD9L417stiVDZGj2J3Y9mrml044nEVvSbW0ig==",
+      "version": "22.2.3",
+      "resolved": "https://registry.npmjs.org/@angular/build/-/build-22.2.3.tgz",
+      "integrity": "sha512-EtNEuPBUCyIuzdXrQ/nINvgFzW8bUI5AkAZtJiSn7nsFOlvaygaKN0kENNTO3zRl3T9B4GDog+Ks5Nec3FBkhg==",
       "dev": true,
       "license": "MIT",
       "dependencies": {
         "@ampproject/remapping": "2.3.0",
-        "@angular-devkit/architect": "0.2202.2",
+        "@angular-devkit/architect": "0.2202.3",
         "@babel/core": "8.0.5",
         "@inquirer/confirm": "6.3.2",
         "@parcel/watcher": "2.6.0",
@@ -154,7 +154,7 @@
         "@angular/platform-browser": "^22.0.0",
         "@angular/platform-server": "^22.0.0",
         "@angular/service-worker": "^22.0.0",
-        "@angular/ssr": "^22.2.2",
+        "@angular/ssr": "^22.2.3",
         "istanbul-lib-instrument": "^6.0.0",
         "karma": "^6.4.0",
         "less": "^4.2.0",
@@ -212,26 +212,26 @@
       }
     },
     "node_modules/@angular/cli": {
-      "version": "22.2.2",
-      "resolved": "https://registry.npmjs.org/@angular/cli/-/cli-22.2.2.tgz",
-      "integrity": "sha512-AALIN+zai0CiA7HgSCGVPHyZyiw3yFWliCfbaS4ueHDJHVZ8QhVjRUrnfGZc3EJnigcyQ0w2DKeTxjwqpDjKew==",
+      "version": "22.2.3",
+      "resolved": "https://registry.npmjs.org/@angular/cli/-/cli-22.2.3.tgz",
+      "integrity": "sha512-ObTX0DxJ0/PMl4pkUKI+uWPr7UC7Je94KpHP8l1lr3exhundapgr7VvNsozprJb1hMlOMDab6+quTReSYvF85Q==",
       "dev": true,
       "license": "MIT",
       "dependencies": {
-        "@angular-devkit/architect": "0.2202.2",
-        "@angular-devkit/core": "22.2.2",
-        "@angular-devkit/schematics": "22.2.2",
+        "@angular-devkit/architect": "0.2202.3",
+        "@angular-devkit/core": "22.2.3",
+        "@angular-devkit/schematics": "22.2.3",
         "@inquirer/prompts": "8.7.2",
         "@listr2/prompt-adapter-inquirer": "4.2.7",
         "@modelcontextprotocol/server": "2.3.1",
-        "@schematics/angular": "22.2.2",
+        "@schematics/angular": "22.2.3",
         "jsonc-parser": "3.3.1",
         "listr2": "11.1.0",
         "npm-package-arg": "14.0.0",
         "parse5-html-rewriting-stream": "8.0.1",
         "semver": "7.8.5",
         "yargs": "18.1.0",
-        "zod": "4.6.5"
+        "zod": "4.6.6"
       },
       "bin": {
         "ng": "bin/ng.js"
@@ -243,9 +243,9 @@
       }
     },
     "node_modules/@angular/common": {
-      "version": "22.2.2",
-      "resolved": "https://registry.npmjs.or
```

**File**: `adev/src/content/tutorials/deferrable-views/common/package-lock.json` (modified, +80/-80)
```diff
@@ -40,13 +40,13 @@
       }
     },
     "node_modules/@angular-devkit/architect": {
-      "version": "0.2202.2",
-      "resolved": "https://registry.npmjs.org/@angular-devkit/architect/-/architect-0.2202.2.tgz",
-      "integrity": "sha512-7ScBo47haHyRGG5M5ZEpbhwHgO2LEDbCLwNCjpjwhtRFDIEmAFbULM1OQjIybN3x+wOyY1kWRK7KvihCbs371g==",
+      "version": "0.2202.3",
+      "resolved": "https://registry.npmjs.org/@angular-devkit/architect/-/architect-0.2202.3.tgz",
+      "integrity": "sha512-/605FxTg8Kt5fqNuIBVZMfuiNwIf+CTNsiYnHY85/7OTqCNkEwdkXKc3DiFM2KlR/AV2g64GkvHgHqxHzYh34g==",
       "dev": true,
       "license": "MIT",
       "dependencies": {
-        "@angular-devkit/core": "22.2.2",
+        "@angular-devkit/core": "22.2.3",
         "rxjs": "7.8.2"
       },
       "bin": {
@@ -59,9 +59,9 @@
       }
     },
     "node_modules/@angular-devkit/core": {
-      "version": "22.2.2",
-      "resolved": "https://registry.npmjs.org/@angular-devkit/core/-/core-22.2.2.tgz",
-      "integrity": "sha512-iQexb5xUON9AkTzvBiMftrHWLguIlYv6M/BOH/sj7U5L8eOPMu8N269WF74xPo4n/X5tusFLqniGI0zolT2Sjg==",
+      "version": "22.2.3",
+      "resolved": "https://registry.npmjs.org/@angular-devkit/core/-/core-22.2.3.tgz",
+      "integrity": "sha512-bi1oBjJeg1XCgRrBYSuJikaJV4sO/mcnyFE/0a1H646yHhQpVYoU/M2Vh69Qv8h+YoMfC7RuSxT4LZHaubhhLw==",
       "dev": true,
       "license": "MIT",
       "dependencies": {
@@ -87,13 +87,13 @@
       }
     },
     "node_modules/@angular-devkit/schematics": {
-      "version": "22.2.2",
-      "resolved": "https://registry.npmjs.org/@angular-devkit/schematics/-/schematics-22.2.2.tgz",
-      "integrity": "sha512-uCpFZbQgFUrOjKHLeYSCaYCJdufauYom8yFGggm67yetMAGKPbmRvUEko8i8auNFoBQ+1w1CivjSTwtmXQzZkA==",
+      "version": "22.2.3",
+      "resolved": "https://registry.npmjs.org/@angular-devkit/schematics/-/schematics-22.2.3.tgz",
+      "integrity": "sha512-+XfBViIGqiFQK8KJXA6PgANX9tLuMO/x8GFjlzEmA4LIe9ikAtpGZw+Ezo547BIJQoJBIKCJYR0knE4BmbFeSQ==",
       "dev": true,
       "license": "MIT",
       "dependencies": {
-        "@angular-devkit/core": "22.2.2",
+        "@angular-devkit/core": "22.2.3",
         "jsonc-parser": "3.3.1",
         "magic-string": "1.4.1",
         "ora": "9.4.1",
@@ -106,14 +106,14 @@
       }
     },
     "node_modules/@angular/build": {
-      "version": "22.2.2",
-      "resolved": "https://registry.npmjs.org/@angular/build/-/build-22.2.2.tgz",
-      "integrity": "sha512-QHJWkZdEWTqqb3+HiSp8lnuS4iQJCa7yTK9gg5TaMIjCoZzP9mD9L417stiVDZGj2J3Y9mrml044nEVvSbW0ig==",
+      "version": "22.2.3",
+      "resolved": "https://registry.npmjs.org/@angular/build/-/build-22.2.3.tgz",
+      "integrity": "sha512-EtNEuPBUCyIuzdXrQ/nINvgFzW8bUI5AkAZtJiSn7nsFOlvaygaKN0kENNTO3zRl3T9B4GDog+Ks5Nec3FBkhg==",
       "dev": true,
       "license": "MIT",
       "dependencies": {
         "@ampproject/remapping": "2.3.0",
-        "@angular-devkit/architect": "0.2202.2",
+        "@angular-devkit/architect": "0.2202.3",
         "@babel/core": "8.0.5",
         "@inquirer/confirm": "6.3.2",
         "@parcel/watcher": "2.6.0",
@@ -156,7 +156,7 @@
         "@angular/platform-browser": "^22.0.0",
         "@angular/platform-server": "^22.0.0",
         "@angular/service-worker": "^22.0.0",
-        "@angular/ssr": "^22.2.2",
+        "@angular/ssr": "^22.2.3",
         "istanbul-lib-instrument": "^6.0.0",
         "karma": "^6.4.0",
         "less": "^4.2.0",
@@ -214,26 +214,26 @@
       }
     },
     "node_modules/@angular/cli": {
-      "version": "22.2.2",
-      "resolved": "https://registry.npmjs.org/@angular/cli/-/cli-22.2.2.tgz",
-      "integrity": "sha512-AALIN+zai0CiA7HgSCGVPHyZyiw3yFWliCfbaS4ueHDJHVZ8QhVjRUrnfGZc3EJnigcyQ0w2DKeTxjwqpDjKew==",
+      "version": "22.2.3",
+      "resolved": "https://registry.npmjs.org/@angular/cli/-/cli-22.2.3.tgz",
+      "integrity": "sha512-ObTX0DxJ0/PMl4pkUKI+uWPr7UC7Je94KpHP8l1lr3exhundapgr7VvNsozprJb1hMlOMDab6+quTReSYvF85Q==",
       "dev": true,
       "license": "MIT",
       "dependencies": {
-        "@angular-devkit/architect": "0.2202.2",
-        "@angular-devkit/core": "22.2.2",
-        "@angular-devkit/schematics": "22.2.2",
+        "@angular-devkit/architect": "0.2202.3",
+        "@angular-devkit/core": "22.2.3",
+        "@angular-devkit/schematics": "22.2.3",
         "@inquirer/prompts": "8.7.2",
         "@listr2/prompt-adapter-inquirer": "4.2.7",
         "@modelcontextprotocol/server": "2.3.1",
-        "@schematics/angular": "22.2.2",
+        "@schematics/angular": "22.2.3",
         "jsonc-parser": "3.3.1",
         "listr2": "11.1.0",
         "npm-package-arg": "14.0.0",
         "parse5-html-rewriting-stream": "8.0.1",
         "semver": "7.8.5",
         "yargs": "18.1.0",
-        "zod": "4.6.5"
+        "zod": "4.6.6"
       },
       "bin": {
         "ng": "bin/ng.js"
@@ -245,9 +245,9 @@
       }
     },
     "node_modules/@angular/common": {
-      "version": "22.2.2",
-      "resolved": "https://registry.npmjs.or
```

**File**: `adev/src/content/tutorials/first-app/common/package-lock.json` (modified, +80/-80)
```diff
@@ -41,13 +41,13 @@
       }
     },
     "node_modules/@angular-devkit/architect": {
-      "version": "0.2202.2",
-      "resolved": "https://registry.npmjs.org/@angular-devkit/architect/-/architect-0.2202.2.tgz",
-      "integrity": "sha512-7ScBo47haHyRGG5M5ZEpbhwHgO2LEDbCLwNCjpjwhtRFDIEmAFbULM1OQjIybN3x+wOyY1kWRK7KvihCbs371g==",
+      "version": "0.2202.3",
+      "resolved": "https://registry.npmjs.org/@angular-devkit/architect/-/architect-0.2202.3.tgz",
+      "integrity": "sha512-/605FxTg8Kt5fqNuIBVZMfuiNwIf+CTNsiYnHY85/7OTqCNkEwdkXKc3DiFM2KlR/AV2g64GkvHgHqxHzYh34g==",
       "dev": true,
       "license": "MIT",
       "dependencies": {
-        "@angular-devkit/core": "22.2.2",
+        "@angular-devkit/core": "22.2.3",
         "rxjs": "7.8.2"
       },
       "bin": {
@@ -60,9 +60,9 @@
       }
     },
     "node_modules/@angular-devkit/core": {
-      "version": "22.2.2",
-      "resolved": "https://registry.npmjs.org/@angular-devkit/core/-/core-22.2.2.tgz",
-      "integrity": "sha512-iQexb5xUON9AkTzvBiMftrHWLguIlYv6M/BOH/sj7U5L8eOPMu8N269WF74xPo4n/X5tusFLqniGI0zolT2Sjg==",
+      "version": "22.2.3",
+      "resolved": "https://registry.npmjs.org/@angular-devkit/core/-/core-22.2.3.tgz",
+      "integrity": "sha512-bi1oBjJeg1XCgRrBYSuJikaJV4sO/mcnyFE/0a1H646yHhQpVYoU/M2Vh69Qv8h+YoMfC7RuSxT4LZHaubhhLw==",
       "dev": true,
       "license": "MIT",
       "dependencies": {
@@ -88,13 +88,13 @@
       }
     },
     "node_modules/@angular-devkit/schematics": {
-      "version": "22.2.2",
-      "resolved": "https://registry.npmjs.org/@angular-devkit/schematics/-/schematics-22.2.2.tgz",
-      "integrity": "sha512-uCpFZbQgFUrOjKHLeYSCaYCJdufauYom8yFGggm67yetMAGKPbmRvUEko8i8auNFoBQ+1w1CivjSTwtmXQzZkA==",
+      "version": "22.2.3",
+      "resolved": "https://registry.npmjs.org/@angular-devkit/schematics/-/schematics-22.2.3.tgz",
+      "integrity": "sha512-+XfBViIGqiFQK8KJXA6PgANX9tLuMO/x8GFjlzEmA4LIe9ikAtpGZw+Ezo547BIJQoJBIKCJYR0knE4BmbFeSQ==",
       "dev": true,
       "license": "MIT",
       "dependencies": {
-        "@angular-devkit/core": "22.2.2",
+        "@angular-devkit/core": "22.2.3",
         "jsonc-parser": "3.3.1",
         "magic-string": "1.4.1",
         "ora": "9.4.1",
@@ -107,14 +107,14 @@
       }
     },
     "node_modules/@angular/build": {
-      "version": "22.2.2",
-      "resolved": "https://registry.npmjs.org/@angular/build/-/build-22.2.2.tgz",
-      "integrity": "sha512-QHJWkZdEWTqqb3+HiSp8lnuS4iQJCa7yTK9gg5TaMIjCoZzP9mD9L417stiVDZGj2J3Y9mrml044nEVvSbW0ig==",
+      "version": "22.2.3",
+      "resolved": "https://registry.npmjs.org/@angular/build/-/build-22.2.3.tgz",
+      "integrity": "sha512-EtNEuPBUCyIuzdXrQ/nINvgFzW8bUI5AkAZtJiSn7nsFOlvaygaKN0kENNTO3zRl3T9B4GDog+Ks5Nec3FBkhg==",
       "dev": true,
       "license": "MIT",
       "dependencies": {
         "@ampproject/remapping": "2.3.0",
-        "@angular-devkit/architect": "0.2202.2",
+        "@angular-devkit/architect": "0.2202.3",
         "@babel/core": "8.0.5",
         "@inquirer/confirm": "6.3.2",
         "@parcel/watcher": "2.6.0",
@@ -157,7 +157,7 @@
         "@angular/platform-browser": "^22.0.0",
         "@angular/platform-server": "^22.0.0",
         "@angular/service-worker": "^22.0.0",
-        "@angular/ssr": "^22.2.2",
+        "@angular/ssr": "^22.2.3",
         "istanbul-lib-instrument": "^6.0.0",
         "karma": "^6.4.0",
         "less": "^4.2.0",
@@ -391,26 +391,26 @@
       }
     },
     "node_modules/@angular/cli": {
-      "version": "22.2.2",
-      "resolved": "https://registry.npmjs.org/@angular/cli/-/cli-22.2.2.tgz",
-      "integrity": "sha512-AALIN+zai0CiA7HgSCGVPHyZyiw3yFWliCfbaS4ueHDJHVZ8QhVjRUrnfGZc3EJnigcyQ0w2DKeTxjwqpDjKew==",
+      "version": "22.2.3",
+      "resolved": "https://registry.npmjs.org/@angular/cli/-/cli-22.2.3.tgz",
+      "integrity": "sha512-ObTX0DxJ0/PMl4pkUKI+uWPr7UC7Je94KpHP8l1lr3exhundapgr7VvNsozprJb1hMlOMDab6+quTReSYvF85Q==",
       "dev": true,
       "license": "MIT",
       "dependencies": {
-        "@angular-devkit/architect": "0.2202.2",
-        "@angular-devkit/core": "22.2.2",
-        "@angular-devkit/schematics": "22.2.2",
+        "@angular-devkit/architect": "0.2202.3",
+        "@angular-devkit/core": "22.2.3",
+        "@angular-devkit/schematics": "22.2.3",
         "@inquirer/prompts": "8.7.2",
         "@listr2/prompt-adapter-inquirer": "4.2.7",
         "@modelcontextprotocol/server": "2.3.1",
-        "@schematics/angular": "22.2.2",
+        "@schematics/angular": "22.2.3",
         "jsonc-parser": "3.3.1",
         "listr2": "11.1.0",
         "npm-package-arg": "14.0.0",
         "parse5-html-rewriting-stream": "8.0.1",
         "semver": "7.8.5",
         "yargs": "18.1.0",
-        "zod": "4.6.5"
+        "zod": "4.6.6"
       },
       "bin": {
         "ng": "bin/ng.js"
@@ -763,9 +763,9 @@
       }
     },
     "node_modules/@angular/common": {
-      "version": "22.2.2",
-      "resolved": "https://registry.npmjs.or
```

**File**: `adev/src/content/tutorials/homepage/package-lock.json` (modified, +74/-74)
```diff
@@ -39,13 +39,13 @@
       }
     },
     "node_modules/@angular-devkit/architect": {
-      "version": "0.2202.2",
-      "resolved": "https://registry.npmjs.org/@angular-devkit/architect/-/architect-0.2202.2.tgz",
-      "integrity": "sha512-7ScBo47haHyRGG5M5ZEpbhwHgO2LEDbCLwNCjpjwhtRFDIEmAFbULM1OQjIybN3x+wOyY1kWRK7KvihCbs371g==",
+      "version": "0.2202.3",
+      "resolved": "https://registry.npmjs.org/@angular-devkit/architect/-/architect-0.2202.3.tgz",
+      "integrity": "sha512-/605FxTg8Kt5fqNuIBVZMfuiNwIf+CTNsiYnHY85/7OTqCNkEwdkXKc3DiFM2KlR/AV2g64GkvHgHqxHzYh34g==",
       "dev": true,
       "license": "MIT",
       "dependencies": {
-        "@angular-devkit/core": "22.2.2",
+        "@angular-devkit/core": "22.2.3",
         "rxjs": "7.8.2"
       },
       "bin": {
@@ -58,9 +58,9 @@
       }
     },
     "node_modules/@angular-devkit/core": {
-      "version": "22.2.2",
-      "resolved": "https://registry.npmjs.org/@angular-devkit/core/-/core-22.2.2.tgz",
-      "integrity": "sha512-iQexb5xUON9AkTzvBiMftrHWLguIlYv6M/BOH/sj7U5L8eOPMu8N269WF74xPo4n/X5tusFLqniGI0zolT2Sjg==",
+      "version": "22.2.3",
+      "resolved": "https://registry.npmjs.org/@angular-devkit/core/-/core-22.2.3.tgz",
+      "integrity": "sha512-bi1oBjJeg1XCgRrBYSuJikaJV4sO/mcnyFE/0a1H646yHhQpVYoU/M2Vh69Qv8h+YoMfC7RuSxT4LZHaubhhLw==",
       "dev": true,
       "license": "MIT",
       "dependencies": {
@@ -86,13 +86,13 @@
       }
     },
     "node_modules/@angular-devkit/schematics": {
-      "version": "22.2.2",
-      "resolved": "https://registry.npmjs.org/@angular-devkit/schematics/-/schematics-22.2.2.tgz",
-      "integrity": "sha512-uCpFZbQgFUrOjKHLeYSCaYCJdufauYom8yFGggm67yetMAGKPbmRvUEko8i8auNFoBQ+1w1CivjSTwtmXQzZkA==",
+      "version": "22.2.3",
+      "resolved": "https://registry.npmjs.org/@angular-devkit/schematics/-/schematics-22.2.3.tgz",
+      "integrity": "sha512-+XfBViIGqiFQK8KJXA6PgANX9tLuMO/x8GFjlzEmA4LIe9ikAtpGZw+Ezo547BIJQoJBIKCJYR0knE4BmbFeSQ==",
       "dev": true,
       "license": "MIT",
       "dependencies": {
-        "@angular-devkit/core": "22.2.2",
+        "@angular-devkit/core": "22.2.3",
         "jsonc-parser": "3.3.1",
         "magic-string": "1.4.1",
         "ora": "9.4.1",
@@ -105,14 +105,14 @@
       }
     },
     "node_modules/@angular/build": {
-      "version": "22.2.2",
-      "resolved": "https://registry.npmjs.org/@angular/build/-/build-22.2.2.tgz",
-      "integrity": "sha512-QHJWkZdEWTqqb3+HiSp8lnuS4iQJCa7yTK9gg5TaMIjCoZzP9mD9L417stiVDZGj2J3Y9mrml044nEVvSbW0ig==",
+      "version": "22.2.3",
+      "resolved": "https://registry.npmjs.org/@angular/build/-/build-22.2.3.tgz",
+      "integrity": "sha512-EtNEuPBUCyIuzdXrQ/nINvgFzW8bUI5AkAZtJiSn7nsFOlvaygaKN0kENNTO3zRl3T9B4GDog+Ks5Nec3FBkhg==",
       "dev": true,
       "license": "MIT",
       "dependencies": {
         "@ampproject/remapping": "2.3.0",
-        "@angular-devkit/architect": "0.2202.2",
+        "@angular-devkit/architect": "0.2202.3",
         "@babel/core": "8.0.5",
         "@inquirer/confirm": "6.3.2",
         "@parcel/watcher": "2.6.0",
@@ -155,7 +155,7 @@
         "@angular/platform-browser": "^22.0.0",
         "@angular/platform-server": "^22.0.0",
         "@angular/service-worker": "^22.0.0",
-        "@angular/ssr": "^22.2.2",
+        "@angular/ssr": "^22.2.3",
         "istanbul-lib-instrument": "^6.0.0",
         "karma": "^6.4.0",
         "less": "^4.2.0",
@@ -213,26 +213,26 @@
       }
     },
     "node_modules/@angular/cli": {
-      "version": "22.2.2",
-      "resolved": "https://registry.npmjs.org/@angular/cli/-/cli-22.2.2.tgz",
-      "integrity": "sha512-AALIN+zai0CiA7HgSCGVPHyZyiw3yFWliCfbaS4ueHDJHVZ8QhVjRUrnfGZc3EJnigcyQ0w2DKeTxjwqpDjKew==",
+      "version": "22.2.3",
+      "resolved": "https://registry.npmjs.org/@angular/cli/-/cli-22.2.3.tgz",
+      "integrity": "sha512-ObTX0DxJ0/PMl4pkUKI+uWPr7UC7Je94KpHP8l1lr3exhundapgr7VvNsozprJb1hMlOMDab6+quTReSYvF85Q==",
       "dev": true,
       "license": "MIT",
       "dependencies": {
-        "@angular-devkit/architect": "0.2202.2",
-        "@angular-devkit/core": "22.2.2",
-        "@angular-devkit/schematics": "22.2.2",
+        "@angular-devkit/architect": "0.2202.3",
+        "@angular-devkit/core": "22.2.3",
+        "@angular-devkit/schematics": "22.2.3",
         "@inquirer/prompts": "8.7.2",
         "@listr2/prompt-adapter-inquirer": "4.2.7",
         "@modelcontextprotocol/server": "2.3.1",
-        "@schematics/angular": "22.2.2",
+        "@schematics/angular": "22.2.3",
         "jsonc-parser": "3.3.1",
         "listr2": "11.1.0",
         "npm-package-arg": "14.0.0",
         "parse5-html-rewriting-stream": "8.0.1",
         "semver": "7.8.5",
         "yargs": "18.1.0",
-        "zod": "4.6.5"
+        "zod": "4.6.6"
       },
       "bin": {
         "ng": "bin/ng.js"
@@ -244,9 +244,9 @@
       }
     },
     "node_modules/@angular/common": {
-      "version": "22.2.2",
-      "resolved": "https://registry.npmjs.or
```

**File**: `adev/src/content/tutorials/learn-angular/common/package-lock.json` (modified, +80/-80)
```diff
@@ -40,13 +40,13 @@
       }
     },
     "node_modules/@angular-devkit/architect": {
-      "version": "0.2202.2",
-      "resolved": "https://registry.npmjs.org/@angular-devkit/architect/-/architect-0.2202.2.tgz",
-      "integrity": "sha512-7ScBo47haHyRGG5M5ZEpbhwHgO2LEDbCLwNCjpjwhtRFDIEmAFbULM1OQjIybN3x+wOyY1kWRK7KvihCbs371g==",
+      "version": "0.2202.3",
+      "resolved": "https://registry.npmjs.org/@angular-devkit/architect/-/architect-0.2202.3.tgz",
+      "integrity": "sha512-/605FxTg8Kt5fqNuIBVZMfuiNwIf+CTNsiYnHY85/7OTqCNkEwdkXKc3DiFM2KlR/AV2g64GkvHgHqxHzYh34g==",
       "dev": true,
       "license": "MIT",
       "dependencies": {
-        "@angular-devkit/core": "22.2.2",
+        "@angular-devkit/core": "22.2.3",
         "rxjs": "7.8.2"
       },
       "bin": {
@@ -59,9 +59,9 @@
       }
     },
     "node_modules/@angular-devkit/core": {
-      "version": "22.2.2",
-      "resolved": "https://registry.npmjs.org/@angular-devkit/core/-/core-22.2.2.tgz",
-      "integrity": "sha512-iQexb5xUON9AkTzvBiMftrHWLguIlYv6M/BOH/sj7U5L8eOPMu8N269WF74xPo4n/X5tusFLqniGI0zolT2Sjg==",
+      "version": "22.2.3",
+      "resolved": "https://registry.npmjs.org/@angular-devkit/core/-/core-22.2.3.tgz",
+      "integrity": "sha512-bi1oBjJeg1XCgRrBYSuJikaJV4sO/mcnyFE/0a1H646yHhQpVYoU/M2Vh69Qv8h+YoMfC7RuSxT4LZHaubhhLw==",
       "dev": true,
       "license": "MIT",
       "dependencies": {
@@ -87,13 +87,13 @@
       }
     },
     "node_modules/@angular-devkit/schematics": {
-      "version": "22.2.2",
-      "resolved": "https://registry.npmjs.org/@angular-devkit/schematics/-/schematics-22.2.2.tgz",
-      "integrity": "sha512-uCpFZbQgFUrOjKHLeYSCaYCJdufauYom8yFGggm67yetMAGKPbmRvUEko8i8auNFoBQ+1w1CivjSTwtmXQzZkA==",
+      "version": "22.2.3",
+      "resolved": "https://registry.npmjs.org/@angular-devkit/schematics/-/schematics-22.2.3.tgz",
+      "integrity": "sha512-+XfBViIGqiFQK8KJXA6PgANX9tLuMO/x8GFjlzEmA4LIe9ikAtpGZw+Ezo547BIJQoJBIKCJYR0knE4BmbFeSQ==",
       "dev": true,
       "license": "MIT",
       "dependencies": {
-        "@angular-devkit/core": "22.2.2",
+        "@angular-devkit/core": "22.2.3",
         "jsonc-parser": "3.3.1",
         "magic-string": "1.4.1",
         "ora": "9.4.1",
@@ -106,14 +106,14 @@
       }
     },
     "node_modules/@angular/build": {
-      "version": "22.2.2",
-      "resolved": "https://registry.npmjs.org/@angular/build/-/build-22.2.2.tgz",
-      "integrity": "sha512-QHJWkZdEWTqqb3+HiSp8lnuS4iQJCa7yTK9gg5TaMIjCoZzP9mD9L417stiVDZGj2J3Y9mrml044nEVvSbW0ig==",
+      "version": "22.2.3",
+      "resolved": "https://registry.npmjs.org/@angular/build/-/build-22.2.3.tgz",
+      "integrity": "sha512-EtNEuPBUCyIuzdXrQ/nINvgFzW8bUI5AkAZtJiSn7nsFOlvaygaKN0kENNTO3zRl3T9B4GDog+Ks5Nec3FBkhg==",
       "dev": true,
       "license": "MIT",
       "dependencies": {
         "@ampproject/remapping": "2.3.0",
-        "@angular-devkit/architect": "0.2202.2",
+        "@angular-devkit/architect": "0.2202.3",
         "@babel/core": "8.0.5",
         "@inquirer/confirm": "6.3.2",
         "@parcel/watcher": "2.6.0",
@@ -156,7 +156,7 @@
         "@angular/platform-browser": "^22.0.0",
         "@angular/platform-server": "^22.0.0",
         "@angular/service-worker": "^22.0.0",
-        "@angular/ssr": "^22.2.2",
+        "@angular/ssr": "^22.2.3",
         "istanbul-lib-instrument": "^6.0.0",
         "karma": "^6.4.0",
         "less": "^4.2.0",
@@ -214,26 +214,26 @@
       }
     },
     "node_modules/@angular/cli": {
-      "version": "22.2.2",
-      "resolved": "https://registry.npmjs.org/@angular/cli/-/cli-22.2.2.tgz",
-      "integrity": "sha512-AALIN+zai0CiA7HgSCGVPHyZyiw3yFWliCfbaS4ueHDJHVZ8QhVjRUrnfGZc3EJnigcyQ0w2DKeTxjwqpDjKew==",
+      "version": "22.2.3",
+      "resolved": "https://registry.npmjs.org/@angular/cli/-/cli-22.2.3.tgz",
+      "integrity": "sha512-ObTX0DxJ0/PMl4pkUKI+uWPr7UC7Je94KpHP8l1lr3exhundapgr7VvNsozprJb1hMlOMDab6+quTReSYvF85Q==",
       "dev": true,
       "license": "MIT",
       "dependencies": {
-        "@angular-devkit/architect": "0.2202.2",
-        "@angular-devkit/core": "22.2.2",
-        "@angular-devkit/schematics": "22.2.2",
+        "@angular-devkit/architect": "0.2202.3",
+        "@angular-devkit/core": "22.2.3",
+        "@angular-devkit/schematics": "22.2.3",
         "@inquirer/prompts": "8.7.2",
         "@listr2/prompt-adapter-inquirer": "4.2.7",
         "@modelcontextprotocol/server": "2.3.1",
-        "@schematics/angular": "22.2.2",
+        "@schematics/angular": "22.2.3",
         "jsonc-parser": "3.3.1",
         "listr2": "11.1.0",
         "npm-package-arg": "14.0.0",
         "parse5-html-rewriting-stream": "8.0.1",
         "semver": "7.8.5",
         "yargs": "18.1.0",
-        "zod": "4.6.5"
+        "zod": "4.6.6"
       },
       "bin": {
         "ng": "bin/ng.js"
@@ -245,9 +245,9 @@
       }
     },
     "node_modules/@angular/common": {
-      "version": "22.2.2",
-      "resolved": "https://registry.npmjs.or
```

#### Recent Merged Pull Requests:
- **PR #71486** (2026-10-20): feat(router): Mark view transitions as stable (@atscott)
- **PR #71471** (closed): docs: update cross-repo adev docs [main] (@angular-robot)
- **PR #71469** (2026-10-20): docs: update cross-repo adev docs [main] (@angular-robot)
- **PR #71467** (2026-10-20): fix(compiler): avoid treating attributes with object prototype names as being translated (@crisbeto)
- **PR #71466** (closed): fix(forms): include the control name in the disabled attribute warning (@RubenPari)
- **PR #71464** (closed): fix(compiler): preserve Unicode spaces when removing whitespace (@RubenPari)

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

## X. core): guard against integer overflow in i18n

**RULE**:
When implementing operations in `packages/core/src/render3/i18n/i18n_util.ts`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in angular/angular. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `18fd9bed`: core): guard against integer overflow in i18n. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing TypeScript data structures, boundary deserialization, API parsing, or resource lifecycles matching `packages/core/src/render3/i18n/i18n_util.ts`.

**VERIFIED IMPLEMENTATION PATTERN**:
```typescript
// Verified production-grade fix pattern:

  // Note that we intentionally retain the error here in production,
  // because the value can change based on the locale.
  if (parentIdx > IcuCreateOpCode.MAX_PARENT || refIdx > IcuCreateOpCode.MAX_REF) {
    throw new Error('ICU node index out of range (too many nodes in ICU case)');
  }

```

**NEGATIVE CONSTRAINT**:
```typescript
// Anti-pattern to NEVER write (induced failure mode):
// Defect-prone omission of boundary validation
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `18fd9bed` are properly handled with clean fallback behavior.
