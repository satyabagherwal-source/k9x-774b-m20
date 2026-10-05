# Forensic Learning Record (Deep Inspection): angular/angular

> **Canonical Artifact**: `07_PROJECT_LEARNING/angular-angular-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/angular/angular](https://github.com/angular/angular))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-05T19:08:16.983Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `angular/angular`
- **Description**: Deliver web apps with confidence 🚀
- **Primary Language / Ecosystem**: TypeScript
- **Discovered Manifests / Configurations**: package.json, README.md
- **Stars / Engagement**: 101020 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: package.json, README.md.
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

### Core Architecture Module: `adev/src/app/core/services/analytics/analytics.service.ts`
```
/*!
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.dev/license
 */

import {inject, PLATFORM_ID, Service} from '@angular/core';
import {isPlatformBrowser} from '@angular/common';

import {WINDOW, ENVIRONMENT, LOCAL_STORAGE, STORAGE_KEY, setCookieConsent} from '@angular/docs';

import {formatErrorEventForAnalytics} from './analytics-format-error';

/** Extension of `Window` with potential Google Analytics fields. */
interface WindowWithAnalytics extends Window {
  dataLayer?: any[];
  gtag?(...args: any[]): void;
}

@Service()
/**
 * Google Analytics Service - captures app behaviors and sends them to Google Analytics.
 *
 * Associates data wi`th properties determined from the environment configurations:
 *   - Data is uploaded to our main Google Analytics 4+ property.
 */
export class AnalyticsService {
  private environment = inject(ENVIRONMENT);
  private window: WindowWithAnalytics = inject(WINDOW);
  private readonly localStorage = inject(LOCAL_STORAGE);
  private isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  constructor() {
    if (this.isBrowser) {
      this._installGlobalSiteTag();
      this._installWindowErrorHandler();
    }
  }

  reportError(description: string, fatal = true) {
    // Limit descriptions to maximum of 150 characters.
    // See: https://developers.google.com/analytics/devguides/collection/protocol/v1/parameters#exd.
    description = description.substring(0, 150);

    this._gtag('event', 'exception', {description, fatal});
  }

  sendEvent(name: string, parameters: Record<string, string | boolean | number>) {
    this._gtag('event', name, parameters);
  }

  private _gtag(...args: any[]) {
    if (this.window.gtag) {
      this.window.gtag(...args);
    }
  }

  private _installGlobalSiteTag() {
    const window = this.window;
    const url = `https://www.googletagmanager.com/gtag/js?id=${this.environment.googleAnalyticsId}`;

    // Note: This cannot be an arrow function as `gtag.js` expects an actual `Arguments`
    // instance with e.g. `callee` to be set. Do not attempt to change this and keep this
    // as much as possible in sync with the tracking code snippet suggested by the Google
    // Analytics 4 web UI under `Data Streams`.
    window.dataLayer = this.window.dataLayer || [];
    window.gtag = function () {
      window.dataLayer?.push(arguments);
    };

    // Cookie banner consent initial state
    // This code is modified in the @angular/docs package in the cookie-popup component.
    // Docs: https://developers.google.com/tag-platform/security/guides/consent
    if (this.localStorage) {
      if (this.localStorage.getItem(STORAGE_KEY) === 'true') {
        setCookieConsent('granted');
      } else {
        setCookieConsent('denied');
      }
    } else {
      // In case localStorage is not available, we default to denying cookies.
      setCookieConsent('denied');
    }

    window.gtag('js', new Date());

    // Configure properties before loading the script. This is necessary to avoid
    // loading multiple instances of the gtag JS scripts.
    window.gtag('config', this.environment.googleAnalyticsId);

    // Only add the element if `gtag` is not loaded yet. It might already
    // be inlined into the `index.html` via SSR.
    if (window.document.querySelector('#gtag-script') === null) {
      const el = window.document.createElement('script');
      el.async = true;
      el.src = url as string;
      el.id = 'gtag-script';
      window.document.head.appendChild(el);
    }
  }

  private _installWindowErrorHandler() {
    this.window.addEventListener('error', (event) =>
      this.reportError(formatErrorEventForAnalytics(event), true),
    );
  }
}

```

### Core Architecture Module: `adev/src/app/core/services/content-loader.service.ts`
```
/*!
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.dev/license
 */

import {HttpClient, HttpErrorResponse} from '@angular/common/http';
import {Service, inject} from '@angular/core';
import {DocContent, DocsContentLoader} from '@angular/docs';
import {firstValueFrom, map} from 'rxjs';

@Service({autoProvided: false})
export class ContentLoader implements DocsContentLoader {
  private readonly cache = new Map<string, Promise<DocContent>>();
  private readonly httpClient = inject(HttpClient);

  async getContent(path: string): Promise<DocContent> {
    // If the path does not end with a file extension, add `.md.html` as the default
    if (!path.match(/\.\w+$/)) {
      path += '.md.html';
    }
    try {
      let promise = this.cache.get(path);
      if (!promise) {
        promise = firstValueFrom(
          this.httpClient
            .get(`assets/content/${path}`, {
              responseType: 'text',
            })
            .pipe(map((contents) => ({contents, id: path}))),
        );
        this.cache.set(path, promise);
      }
      return await promise;
    } catch (e) {
      const errorResponse = e as HttpErrorResponse;
      if (!(e instanceof HttpErrorResponse) || errorResponse.status !== 404) {
        // assume 404 errors are permanent but don't cache others that may be temporary
        this.cache.delete(path);
      }
      throw e;
    }
  }
}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #69325** (2026-06-16): **OutputEmitterRef.emit() skips listeners when an earlier listener unsubscribes synchronously (e.g. outputToObservable + take(1))**
  *Symptoms*: ### Which @angular/* package(s) are the source of the bug?  core  ### Is this a regression?  Yes  ### Description  When two listeners are subscribed to the same signal-based `output()`, and the first listener unsubscribes itself synchronously while receiving an emitted value, the second listener is silently skipped — it never receives the event.  This is a regression compared to decorator-based `@Output()` / `EventEmitter`: the exact same code works correctly there, as it does in every comparable event system (DOM `EventTarget`, Node `EventEmitter`, RxJS `Subject`). A listener removing itself is never supposed to affect delivery to other listeners. Since `output()` is presented as a drop-in replacement for `@Output()`, this behavioral difference is subtle and very hard to debug — in our app it manifested as a template event binding that simply never fired, with nothing in the console pointing at the cause.  ## Reproduction  https://stackblitz.com/edit/stackblitz-starters-scbzqgpg  A child component emits an output once:  ```ts   @Component({ selector: 'app-child', /* ... */ })   export class ChildComponent implements OnInit {     ready = output<string>();      ngOnInit() {       this.ready.emit('hello from child');     }   } ``` A directive on the same element consumes that output once, the idiomatic way:    ```ts   @Directive({ selector: 'app-child[consumeOnce]' })   export class ConsumeOnceDirective {     private host = inject(ChildComponent);      constructor() {       out
  **Post-Mortem & Fix Analysis**:
  > This issue has been automatically locked due to inactivity. Please file a new issue if you are encountering a similar or related problem.  Read more about our [automatic conversation locking policy](https://github.com/angular/angular/blob/f0fbced1c55bc8b8ed9df01cea99df42f3e7eae3/contributing-docs/auto-issue-locking.md).  <sub>_This action has been performed automatically by a bot._</sub>

- **Issue #66402** (2026-01-12): **Signal forms - radio does not reflect form model signal initial state if value attribute is enum**
  *Symptoms*: ### Which @angular/* package(s) are the source of the bug?  forms  ### Is this a regression?  No  ### Description  When trying to use `enum` as a `value` attribute for `radio` button, radio button does not reflects initial state of form model signal.  If i use for example  ```ts  readonly projectFormModel = signal<ProjectFormModel>({ name: 'test', status: ProjectStatus.CLOSED });  readonly projectForm = form(this.projectFormModel); ```   ```html  <input   type="radio"   [field]="projectForm.status"   [value]="projectStatusEnum.CLOSED"   id="btnradio2" /> <label   class="btn btn-outline-primary"   for="btnradio2">   {{ projectStatusEnum.CLOSED }} </label> ``` Button should be marked as selected. But it works correctly after I click the html radio button.  It works for initial state if i use plain string for value, ie: `value="closed"`  Enum values work OK in reactive forms, but not with signal forms.  Example link bellow.  Best regards.   ### Please provide a link to a minimal reproduction of the bug  https://stackblitz.com/~/github.com/kle-pra/signal-form-enums?file=package.json  ### Please provide the exception or error you saw  ```true / ```  ### Please provide the environment you discovered this bug in (run `ng version`)  ```true Angular CLI       : 21.0.5 Angular           : 21.0.7 Node.js           : 24.11.0 Package Manager   : npm 11.6.3 Operating System  : linux x64  ┌───────────────────────────────┬───────────────────┬───────────────────┐ │ Package                    
  **Post-Mortem & Fix Analysis**:
  > The bug here is that setting the value via binding is set after the control is updated.   The workaround for now is having the value binding _before_ the field binding.   ```html <input   type="radio"   [value]="projectStatusEnum.CLOSED"   [field]="projectForm.status"    id="btnradio2" /> ```
  > @JeanMeche nice catch 
  > This issue has been automatically locked due to inactivity. Please file a new issue if you are encountering a similar or related problem.  Read more about our [automatic conversation locking policy](https://github.com/angular/angular/blob/f0fbced1c55bc8b8ed9df01cea99df42f3e7eae3/contributing-docs/auto-issue-locking.md).  <sub>_This action has been performed automatically by a bot._</sub>

- **Issue #66286** (2026-01-20): **Template pipeline leaves behind unnecessary restore/reset view calls in the presence of `@let`**
  *Symptoms*: Variables are generated in the pipeline by inserting references to all the symbols within the scope and then later cleaning up the unused ones in an optimization pass. When generating the scope for listener instructions, we expose all the `@let` declarations in the same view ([see](https://github.com/angular/angular/blob/main/packages/compiler/src/template/pipeline/src/phases/generate_variables.ts#L293)) which leads us to generate `ɵɵrestoreView` and `ɵɵresetView` calls, however if the `@let` reference isn't used within the listener, the variable optimization phase only removes the variable that reads it and not the `ɵɵrestoreView`/`ɵɵresetView` calls.  For example, if we take the following template:  ```html @let unused = 1; <button (click)="noop()"></button> ```  It produces the following code before optimization:  ```js if (rf & 1) {   const _r1 = ɵɵgetCurrentView();   ɵɵdeclareLet(0);   ɵɵdomElementStart(1, "button", 0);   ɵɵdomListener(     "click",     function TestComp_Template_button_click_1_listener() {       const ctx_r1 = ɵɵrestoreView(_r1);       const unused_r3 = ɵɵreadContextLet(0);       return ɵɵresetView(ctx.noop());     }   );   ɵɵdomElementEnd(); } if (rf & 2) {   const unused_r4 = ɵɵstoreLet(1); } ```  Which becomes the following after optimization:  ```js if (rf & 1) {   const _r1 = ɵɵgetCurrentView();   ɵɵdomElementStart(0, "button", 0);   ɵɵdomListener(     "click",     function TestComp_Template_button_click_0_listener() {       ɵɵrestoreView(_r1);    
  **Post-Mortem & Fix Analysis**:
  > Variables are generated in the pipeline by inserting references to all symbols within the scope and later cleaning up unused ones during an optimization pass. When generating the scope for listener instructions, we expose all @let declarations in the same view, which leads to the generation of ɵɵrestoreView and ɵɵresetView calls. However, if an @let reference is not used within the listener, the variable optimization phase removes only the variable that reads it, but not the corresponding ɵɵrestoreView and ɵɵresetView calls.  For example, consider the following template:  @let unused = 1; <button (click)="noop()"></button>   This produces the following code before optimization:  if (rf & 1) {   const _r1 = ɵɵgetCurrentView();   ɵɵdeclareLet(0);   ɵɵdomElementStart(1, "button", 0);   ɵɵdomListener(     "click",     function TestComp_Template_button_click_1_listener() {       const ctx_r1 = ɵɵrestoreView(_r1);       const unused_r3 = ɵɵreadContextLet(0);       return ɵɵresetView(ctx.noop
  > This issue has been automatically locked due to inactivity. Please file a new issue if you are encountering a similar or related problem.  Read more about our [automatic conversation locking policy](https://github.com/angular/angular/blob/f0fbced1c55bc8b8ed9df01cea99df42f3e7eae3/contributing-docs/auto-issue-locking.md).  <sub>_This action has been performed automatically by a bot._</sub>

- **Issue #65487** (2025-11-21): **Severe performance issues**
  *Symptoms*: # 🐞 bug report  ### Is this a regression?  No, it has been broken for as long as I was using the extension.   ### Description  Possible reopen of https://github.com/angular/vscode-ng-language-service/issues/2131  For as long as I've been using vscode, various language service features, particularly "Go to references" and "Go to definition" have been very very slow to the point they are unusable. I'm talking 4+ seconds each (sometimes so long it seems like nothing happens) This happens on the first try for a particular symbol. Subsequent tries for the same symbol are fast. It doesn't consistently happen, and I'm not sure why.   This could happen immediately (or almost immediately) after opening vscode, restarting language server doesn't help.  Disabling the angular language service and relying on the ts language service instead makes it work, but of course it means angular specific syntax (like templates) wouldn't work.   I verified this reproduces on at least 2 different code bases, suggesting it's not a specific problem with my codebase. Though I can't reproduce 100% consistently. I'm not sure why it sometimes happen and sometimes not.   This is still reproducing in the most up to date version 20.2.2.   Other potentially related issues: - Opening "options" with alt+enter takes forever, and sometimes randomly comes up with "no options available" even though this symbol can actually be imported from somewhere. (The same thing would sometimes work and sometimes not work)  ## B
  **Post-Mortem & Fix Analysis**:
  > Using Zed has felt like a huge relief, I recommend giving it a go. The angular plugin has a couple of warts because it's not officially supported by the angular team but there's one thing it is, and that's performant.
  > v20.2.2 is extremely slow for some reason. I had to revert to 20.2.1 and it is faster now. This may be a different issue because I am experiencing it for everything.
  > > Received response 'textDocument/references - (6)' in 6704ms.  A request for references requires the entire application to be compiled fully, so it is expected to take some time on the initial request. Are you observing that every request for references thereafter remains slow?   > v20.2.2 is extremely slow for some reason. I had to revert to 20.2.1 and it is faster now.  What operations are slow in 20.2.2? The only significant change to language service functionality looks like autocomplete for attributes: https://github.com/angular/angular/commit/c81e345e726b5b281621159c789e6d80a9f328e2#diff-0dbc44b3fef98374d5d3e635e1173221fda1169d422fd3761ae4cd06b063e126

- **Issue #63623** (2025-10-17): **signal-forms: FormValueControl is unable to mark field as dirty**
  *Symptoms*: ### Which @angular/* package(s) are the source of the bug?  forms  ### Is this a regression?  No  ### Description  I have been playing around with the new `FormValueControl` interface to implement custom controls in signal forms.   I noticed that `FormValueControl` does not automatically mark the field as dirty if the value changes and lacks the ability to manually mark as dirty because `dirty` is only exposed as an input signal to `FormValueControl`.  ```ts @Component({   selector: 'app-input',   changeDetection: ChangeDetectionStrategy.OnPush,   template: `     <input        [value]="value()"       (input)="setValue($event)"       (blur)="markTouched()"     />   `, }) export class Input implements FormValueControl<string> {   readonly value = model<string>('');   readonly touched = model<boolean>(false);   readonly dirty = input<boolean>(false);    setValue(event: Event) {     this.value.set((event.target as HTMLInputElement).value);   }    markTouched() {     this.touched.set(true);   } } ```  ### Please provide a link to a minimal reproduction of the bug  https://stackblitz.com/edit/stackblitz-starters-tyvqgwbf?file=src%2Fmain.ts  ### Please provide the exception or error you saw  ```true When implementing a custom input via `FormValueControl` the field will not automatically be marked as dirty and cannot be marked as dirty via the provided interface. ```  ### Please provide the environment you discovered this bug in (run `ng version`)  ```true Angular CLI: 21.0.0-next.2 
  **Post-Mortem & Fix Analysis**:
  > It looks to me like a similar issue might also be present for the integration of `Control` with `ControlValueAccessor`, cf. https://github.com/angular/angular/blob/main/packages/forms/signals/src/controls/control.ts#L323.
  > Thanks for the report, this should be fixed in https://github.com/angular/angular/pull/64483.
  > This issue has been automatically locked due to inactivity. Please file a new issue if you are encountering a similar or related problem.  Read more about our [automatic conversation locking policy](https://github.com/angular/angular/blob/f0fbced1c55bc8b8ed9df01cea99df42f3e7eae3/contributing-docs/auto-issue-locking.md).  <sub>_This action has been performed automatically by a bot._</sub>

- **Issue #63251** (2025-09-19): **Escape `APP_ID` for `ViewEncapsulation.Emulated`**
  *Symptoms*: ### Which @angular/* package(s) are the source of the bug?  core  ### Is this a regression?  No  ### Description  `APP_ID` is not escaped despite being included in a CSS selector, meaning if it includes special syntax known to CSS it can confuse the selector.  For example, providing:  ```typescript {   provide: APP_ID,   useValue: 'foo:bar', } ```  Generates the following DOM:  ```html <h1 _ngcontent-foo:bar-c2846697727="" class="foo">Hello from Angular!</h1> ```  Which is actually ok, `:` is valid in this context. But the CSS is not:  ```css .foo[_ngcontent-foo:bar-c2846697727] { /* ... */ } ```  This is invalid because `:` triggers a pseudo-class in the middle of an attribute selector. Ideally, we should escape this with `CSS.escape`, though a similar problem exists with the attribute name itself. For example, `foo bar` triggers  ``` InvalidCharacterError: Failed to execute 'setAttribute' on 'Element': '_nghost-foo bar-c2846697727' is not a valid attribute name. ```  I'm not sure you really can escape a space from an attribute name, so we might just have to ban that (and any other invalid characters such as `>`) altogether.  ### Please provide a link to a minimal reproduction of the bug  https://stackblitz.com/edit/stackblitz-starters-74rnmosz?description=An%20angular-cli%20project%20based%20on%20@angular/animations,%20@angular/common,%20@angular/compiler,%20@angular/core,%20@angular/forms,%20@angular/platform-browser,%20@angular/platform-browser-dynamic,%20@angular/router,
  **Post-Mortem & Fix Analysis**:
  > `CSS.escape` is also unsafe to use because of the non-browser environments where the render also runs.  What alternative do we have ?   Should we maybe throw an error in devmode so a more "complex" check doesn't impact prod builds ? Or Is APP_ID the kind of token that are often set depending on envs  ? 
  > Indeed, CSS.escape and CSS.unescape cannot be used in this context. We could probably just allow alphanumeric characters, `_` and `-`.  The APP_ID token is used when having multiple applications running on the same page so that CSS is not leaked between an application and another. 
  > #63252

- **Issue #63052** (2025-08-08): **Angular Language Service keeps crashing when using `host` and generic with host type-checking**
  *Symptoms*: ### Which @angular/* package(s) are the source of the bug?  language-service  ### Is this a regression?  Yes  ### Description  When using `typeCheckHostBindings` in Angular compiler options, the Angular Language Service will crash when it encounters a Component/Directive that has a `host` property as well as a generic. Disabling `typeCheckHostBindings` is an easy way to work around the issue, but that's not ideal.  Generics without `host`, or `host` without generics both seem to work. It just seems to be unusable when they are both used at the same component.  <img width="1078" height="180" alt="Image" src="https://github.com/user-attachments/assets/d74e1308-6703-448a-819b-97b41488f178" />   ### Reproduction  1. Create a fresh Angular project    ```sh    $ npx @angular/cli@latest new --ssr=false --style=css --zoneless=false ng-20.1    ``` 2. Update the `App` component so that it has a `host` property and a generic (`App<T>`)    <details>    <summary><strong>Show full <code>app.ts</code></strong></summary>      ```ts     import { Component, input, signal } from '@angular/core';     import { RouterOutlet } from '@angular/router';          @Component({       selector: 'app-root',       imports: [RouterOutlet],       templateUrl: './app.html',       styleUrl: './app.css',       host: {         '[class.show]': 'show()'       }     })     export class App<T> {       protected readonly title = signal('ng-20.1');       readonly show = input<T>();     }      ```        </details> 3. D
  **Post-Mortem & Fix Analysis**:
  > I can't find a way to create  a new Stackblitz with Angular (is Stackblitz gone?), so I don't have a reproduction link currently.
  > Are you seeing this error only in the language service or does it also happen when you try to build the app?
  > Only the language service. I didn't see any issues during `build` or `serve`.

- **Issue #65491** (2026-04-01): **Tooltip hints for template variables do not match compiler type when narrowed by template syntax**
  *Symptoms*: <!--🔅🔅🔅🔅🔅🔅🔅🔅🔅🔅🔅🔅🔅🔅🔅🔅🔅🔅🔅🔅🔅🔅🔅🔅🔅🔅🔅🔅🔅🔅🔅  Oh hi there! 😄  To expedite issue processing please search open and closed issues before submitting a new one. Existing issues often contain information about workarounds, resolution, or progress updates.  🔅🔅🔅🔅🔅🔅🔅🔅🔅🔅🔅🔅🔅🔅🔅🔅🔅🔅🔅🔅🔅🔅🔅🔅🔅🔅🔅🔅🔅🔅🔅🔅🔅-->  # 🐞 bug report  ### Is this a regression?  <!-- Did this behavior use to work in the previous version? --> Unsure.  ### Description   Tooltip type hints can end up in a mismatch with the compiler when using template logic to narrow types.  Example:  component.ts:  ``` protected source$!: Observable<DataItem>; ```  In the below example, the tooltip for `obj` within the `<div>` tag will be marked as nullable (see Screenshot 1)  component.html: ``` @let obj= source$ | async; @if (obj !== null) {   <div [id]="obj.data" /> } ```   Whereas in the below example, the tooltip correctly recognizes the type as non-nullable (see Screenshot 2):   component.html: ``` @let nullableObj = source$ | async; @if (nullableObj !== null) {   @let obj = nullableObj;   <div [id]="obj.data"></div> } ```  **Note:** The compiled type is read properly by `ngtsc` for nullability rules. This report only applies to the tooltip.  ## Bug Type What does this bug affect  <!-- Please check the one that applies to this bug report using "x". -->  - [x ] Angular Language Service VSCode extension - [ ] Angular Language Service server  ## Reproduction  Steps to reproduce the b
  **Post-Mortem & Fix Analysis**:
  > ## Investigation Summary  **Reproduced** on Angular 21.x / Language Service.  ### Root Cause  [getQuickInfoForLetDeclarationSymbol()](cci:1://file:///Users/tejassathe/OSContribution/angular/packages/language-service/src/quick_info.ts:163:2-174:3) queries TypeScript at the **declaration location** in the TCB (`symbol.initializerLocation`), but TypeScript's flow narrowing only applies at **usage sites** within control flow blocks.  @let obj = val; // ← TCB queries type here: { data: number } | null  @if (obj !== null) {  ### Fix Updated getQuickInfoForLetDeclarationSymbol() to:  - Get TCB location at the usage site (where the cursor is) - Query TypeScript at that location for the narrowed type - Fall back to declaration location if unavailable  Added getTcbLocationOfNode() to TemplateTypeChecker API, following the same pattern used by getQuickInfoForBindingSymbol and getQuickInfoForPipeSymbol.  ### Changes - packages/compiler-cli/src/ngtsc/typecheck/api/checker.ts - packages/compiler-cli
  > This issue has been automatically locked due to inactivity. Please file a new issue if you are encountering a similar or related problem.  Read more about our [automatic conversation locking policy](https://github.com/angular/angular/blob/f0fbced1c55bc8b8ed9df01cea99df42f3e7eae3/contributing-docs/auto-issue-locking.md).  <sub>_This action has been performed automatically by a bot._</sub>

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

### Incident Patch 1: `7d96a37a` (2026-10-05)
**Commit Message**: build: update all non-major dependencies

See associated pull request for more information.

**File**: `MODULE.bazel` (modified, +2/-2)
```diff
@@ -71,8 +71,8 @@ use_repo(node, "nodejs_windows_amd64")
 pnpm = use_extension("@aspect_rules_js//npm:extensions.bzl", "pnpm")
 pnpm.pnpm(
     name = "pnpm",
-    pnpm_version = "11.27.1",
-    pnpm_version_integrity = "sha512-qB1MIbmwmksK6/kO9eUn1CYr3aMi0mCCl4y1SQI6xtnK/Jixn/+qXHHbQ4pl9wIk7beNcxEYeGH/lkgNHNyiPA==",
+    pnpm_version = "11.28.4",
+    pnpm_version_integrity = "sha512-+QWmFWP4m0mikmNNPYfQJM/eqdzPXGayzMJhZ1+nsndDIKlZ20cubKp/n/cxRwnNUNBsj9ZK3bYGRzd6eNJQ/w==",
 )
 use_repo(pnpm, "pnpm")
 
```

**File**: `adev/package.json` (modified, +8/-8)
```diff
@@ -32,11 +32,11 @@
     "@codemirror/search": "6.7.2",
     "@codemirror/state": "6.7.6",
     "@codemirror/view": "6.43.13",
-    "@lezer/common": "1.5.2",
+    "@lezer/common": "1.5.3",
     "@lezer/css": "1.3.8",
-    "@lezer/highlight": "1.2.3",
+    "@lezer/highlight": "1.2.5",
     "@lezer/html": "1.3.13",
-    "@lezer/javascript": "1.5.5",
+    "@lezer/javascript": "1.5.6",
     "@lezer/lr": "1.4.10",
     "@lezer/sass": "1.1.0",
     "@marijn/find-cluster-break": "1.0.4",
@@ -52,7 +52,7 @@
     "@types/dom-navigation": "1.0.7",
     "@types/jasmine": "6.0.0",
     "@types/jsdom": "30.0.0",
-    "@types/node": "24.13.6",
+    "@types/node": "24.19.1",
     "@typescript/vfs": "1.6.5",
     "@webcontainer/api": "1.6.4",
     "@xterm/addon-fit": "0.11.0",
@@ -72,21 +72,21 @@
     "hast-util-whitespace": "^3.0.0",
     "html-void-elements": "^3.0.0",
     "jasmine-core": "6.3.0",
-    "jsdom": "30.1.1",
+    "jsdom": "30.1.2",
     "karma-chrome-launcher": "3.2.0",
     "karma-coverage": "2.2.1",
     "karma-jasmine": "5.1.0",
     "karma-jasmine-html-reporter": "2.3.0",
     "marked": "18.0.14",
-    "mermaid": "12.0.0",
+    "mermaid": "12.1.0",
     "ngx-progressbar": "14.0.0",
     "playwright-core": "1.63.0",
     "preact": "11.0.0",
-    "preact-render-to-string": "6.7.0",
+    "preact-render-to-string": "6.8.0",
     "prettier": "3.9.9",
     "property-information": "^7.1.0",
     "rxjs": "7.8.2",
-    "shiki": "4.4.3",
+    "shiki": "4.5.0",
     "space-separated-tokens": "^2.0.2",
     "stringify-entities": "^4.0.4",
     "style-mod": "4.1.4",
```

**File**: `integration/animations/package.json` (modified, +1/-1)
```diff
@@ -38,5 +38,5 @@
     "ts-node": "^10.9.1",
     "typescript": "6.0.3"
   },
-  "packageManager": "pnpm@11.27.1"
+  "packageManager": "pnpm@11.28.4"
 }
```

**File**: `integration/cli-hello-world-ivy-i18n/package.json` (modified, +1/-1)
```diff
@@ -46,5 +46,5 @@
     "ts-node": "^10.9.1",
     "typescript": "6.0.3"
   },
-  "packageManager": "pnpm@11.27.1"
+  "packageManager": "pnpm@11.28.4"
 }
```

**File**: `integration/cli-hello-world-lazy/package.json` (modified, +1/-1)
```diff
@@ -27,5 +27,5 @@
     "ts-node": "^10.9.1",
     "typescript": "6.0.3"
   },
-  "packageManager": "pnpm@11.27.1"
+  "packageManager": "pnpm@11.28.4"
 }
```

**File**: `integration/cli-hello-world/package.json` (modified, +1/-1)
```diff
@@ -32,5 +32,5 @@
     "ts-node": "^10.9.1",
     "typescript": "6.0.3"
   },
-  "packageManager": "pnpm@11.27.1"
+  "packageManager": "pnpm@11.28.4"
 }
```

**File**: `integration/cli-signal-inputs/package.json` (modified, +1/-1)
```diff
@@ -10,7 +10,7 @@
     "lint": "ng lint",
     "e2e": "ng build --configuration production && concurrently \"serve dist/browser -l 4210 --no-clipboard --single\" \"jasmine --config=e2e/jasmine.json 'e2e/src/**/*.e2e-spec.ts'\" --kill-others --success first"
   },
-  "packageManager": "pnpm@11.27.1",
+  "packageManager": "pnpm@11.28.4",
   "private": true,
   "dependencies": {
     "@angular/animations": "link:./in-existing-linked-by-bazel",
```

**File**: `integration/defer/package.json` (modified, +1/-1)
```diff
@@ -29,5 +29,5 @@
     "ts-node": "10.9.2",
     "typescript": "6.0.3"
   },
-  "packageManager": "pnpm@11.27.1"
+  "packageManager": "pnpm@11.28.4"
 }
```

---

### Incident Patch 2: `3e9edabf` (2026-09-29)
**Commit Message**: fix(docs-infra): add the Exported by section to the API table of contents

`SectionDescription` writes a bare `<h2>Exported by</h2>` instead of using
`SectionHeading`, so it is the only heading the API templates emit without an
id. Across the built API pages there are 1023 `<h2 id="api">`, 336
`<h2 id="description">`, 225 `<h2 id="usage-notes">`, 13 `<h2 id="pipe-usage">`
and 61 bare `<h2>`, all of them this one.

API detail pages render a table of contents, and the loader selects `h2[id]`,
so the section is missing from the ToC on all 61 pages, including every pipe
and every `@ngModule`-tagged directive. It also has no anchor, so it cannot be
linked to.

Using `SectionHeading` gives it the `exported-by` id, the anchor link and the
section margin the other headings get. The `<hr>` above it is dropped: it was
the only rule in the API templates and stood in for the margin this heading
never had, so keeping both left a rule and a 3rem gap doing the same job.

`exported-by` is added to `KNOWN_API_SECTION_ANCHORS`, which the file asks to
be kept in sync with the `SectionHeading` usages, so a JSDoc link to that
fragment validates.

**File**: `adev/shared-docs/pipeline/api-gen/rendering/templates/section-description.tsx` (modified, +2/-2)
```diff
@@ -14,6 +14,7 @@ import {SECTION_CONTAINER} from '../styling/css-classes.mjs';
 import {SectionHeading} from './section-heading';
 
 const DESCRIPTION_SECTION_NAME = 'Description';
+const EXPORTED_BY_SECTION_NAME = 'Exported by';
 
 /** Component to render the description section. */
 export function SectionDescription(props: {entry: DocEntryRenderable}) {
@@ -33,8 +34,7 @@ export function SectionDescription(props: {entry: DocEntryRenderable}) {
 
       {exportedBy.length ? (
         <>
-          <hr />
-          <h2>Exported by</h2>
+          <SectionHeading name={EXPORTED_BY_SECTION_NAME} />
 
           <ul>
             {exportedBy.map((tag) => (
```

**File**: `adev/shared-docs/pipeline/api-gen/rendering/transforms/jsdoc-transforms.mts` (modified, +7/-1)
```diff
@@ -53,7 +53,13 @@ const jsDoclinkRegexGlobal = new RegExp(jsDoclinkRegex.source, 'g');
  *
  * Keep in sync with `templates/section-*.tsx` and the inline `<SectionHeading name="...">` usages.
  */
-const KNOWN_API_SECTION_ANCHORS = new Set(['description', 'usage-notes', 'api', 'pipe-usage']);
+const KNOWN_API_SECTION_ANCHORS = new Set([
+  'description',
+  'usage-notes',
+  'api',
+  'pipe-usage',
+  'exported-by',
+]);
 
 /** Given an entity with a description, gets the entity augmented with an `htmlDescription`. */
 export function addHtmlDescription<T extends HasDescription & HasModuleName & MaybeJsDocTags>(
```

---

### Incident Patch 3: `3ad3afa3` (2026-10-04)
**Commit Message**: docs: fix code examples that fail to compile or run in the guides

Fix the HeroTaxReturn component in the hierarchical injection guide, the NavigationError handler
in the data resolvers guide, the DebounceEventPlugin and buildSchema examples, and add missing
imports across several guides. List arrow functions as supported in expression syntax and flag
JSONP and the legacy HttpClient modules as deprecated.

**File**: `adev/src/content/guide/di/hierarchical-dependency-injection.md` (modified, +11/-15)
```diff
@@ -1013,7 +1013,7 @@ Each tax return component has the following characteristics:
 - Can change a tax return without affecting a return in another component
 - Has the ability to save the changes to its tax return or cancel them
 
-Suppose that the `HeroTaxReturn` had logic to manage and restore changes.
+Suppose that the `HeroTaxReturnEditor` had logic to manage and restore changes.
 That would be a straightforward task for a hero tax return.
 In the real world, with a rich tax return data model, the change management would be tricky.
 You could delegate that management to a helper service, as this example does.
@@ -1053,10 +1053,10 @@ export class HeroTaxReturnService {
 }
 ```
 
-Here is the `HeroTaxReturn` that makes use of `HeroTaxReturnService`.
+Here is the `HeroTaxReturnEditor` that makes use of `HeroTaxReturnService`.
 
 ```typescript
-import {Component, input, output} from '@angular/core';
+import {Component, effect, inject, input, output} from '@angular/core';
 import {HeroTaxReturn} from './hero';
 import {HeroTaxReturnService} from './hero-tax-return.service';
 
@@ -1066,25 +1066,21 @@ import {HeroTaxReturnService} from './hero-tax-return.service';
   styleUrls: ['./hero-tax-return.css'],
   providers: [HeroTaxReturnService],
 })
-export class HeroTaxReturn {
+export class HeroTaxReturnEditor {
   message = '';
 
   close = output<void>();
 
-  get taxReturn(): HeroTaxReturn {
-    return this.heroTaxReturnService.taxReturn;
-  }
-
   taxReturn = input.required<HeroTaxReturn>();
 
+  private heroTaxReturnService = inject(HeroTaxReturnService);
+
   constructor() {
     effect(() => {
       this.heroTaxReturnService.taxReturn = this.taxReturn();
     });
   }
 
-  private heroTaxReturnService = inject(HeroTaxReturnService);
-
   onCanceled() {
     this.flashMessage('Canceled');
     this.heroTaxReturnService.restoreTaxReturn();
@@ -1106,21 +1102,21 @@ export class HeroTaxReturn {
 }
 ```
 
-The _tax-return-to-edit_ arrives by way of the `input` property, which is implemented with getters and setters.
-The setter initializes the component's own instance of the `HeroTaxReturnService` with the incoming return.
-The getter always returns what that service says is the current state of the hero.
+The _tax-return-to-edit_ arrives by way of the `taxReturn` signal input.
+An `effect` initializes the component's own instance of the `HeroTaxReturnService` with the incoming return whenever the input changes.
+The service's getter always returns what the service says is the current state of the hero.
 The component also asks the service to save and restore this tax return.
 
 This won't work if the service is an application-wide singleton.
 Every component would share the same service instance, and each component would overwrite the tax return that belonged to another hero.
 
-To prevent this, configure the component-level injector of `HeroTaxReturn` to provide the service, using the `providers` property in the component metadata.
+To prevent this, configure the component-level injector of `HeroTaxReturnEditor` to provide the service, using the `providers` property in the component metadata.
 
 ```typescript
 providers: [HeroTaxReturnService];
 ```
 
-The `HeroTaxReturn` has its own provider of the `HeroTaxReturnService`.
+The `HeroTaxReturnEditor` has its own provider of the `HeroTaxReturnService`.
 Recall that every component _instance_ has its own injector.
 Providing the service at the component level ensures that _every_ instance of the component gets a private instance of the service. This makes sure that no tax return gets overwritten.
 
```

**File**: `adev/src/content/guide/forms/signals/dynamic-forms-with-json.md` (modified, +8/-6)
```diff
@@ -61,7 +61,7 @@ In addition, numeric fields initialize to `null` rather than `0` so an empty fie
 The schema is also derived from the config. You can loop through each entry and apply the validators that match its kind:
 
 ```ts
-import {required, min, max, SchemaFn} from '@angular/forms/signals';
+import {required, min, max, SchemaFn, SchemaPath} from '@angular/forms/signals';
 
 function buildSchema(configs: FieldConfig[]): SchemaFn<Record<string, string | number | null>> {
   return (path) => {
@@ -73,8 +73,9 @@ function buildSchema(configs: FieldConfig[]): SchemaFn<Record<string, string | n
       }
 
       if (config.kind === 'number') {
-        if (config.min !== undefined) min(fieldPath, config.min);
-        if (config.max !== undefined) max(fieldPath, config.max);
+        const numberPath = fieldPath as unknown as SchemaPath<number | null>;
+        if (config.min !== undefined) min(numberPath, config.min);
+        if (config.max !== undefined) max(numberPath, config.max);
       }
     }
   };
@@ -106,7 +107,7 @@ type FieldConfig =
 Update `buildSchema()` to translate `when` into an [`applyWhen()`](api/forms/signals/applyWhen) call. Shared rule application logic moves into a small closure so the conditional and unconditional branches both call the same function:
 
 ```ts
-import {applyWhen, required, min, max, SchemaFn} from '@angular/forms/signals';
+import {applyWhen, required, min, max, SchemaFn, SchemaPath} from '@angular/forms/signals';
 
 function buildSchema(configs: FieldConfig[]): SchemaFn<Record<string, string | number | null>> {
   return (rootPath) => {
@@ -115,8 +116,9 @@ function buildSchema(configs: FieldConfig[]): SchemaFn<Record<string, string | n
         const fieldPath = path[config.name];
         if (config.required) required(fieldPath);
         if (config.kind === 'number') {
-          if (config.min !== undefined) min(fieldPath, config.min);
-          if (config.max !== undefined) max(fieldPath, config.max);
+          const numberPath = fieldPath as unknown as SchemaPath<number | null>;
+          if (config.min !== undefined) min(numberPath, config.min);
+          if (config.max !== undefined) max(numberPath, config.max);
         }
       };
 
```

**File**: `adev/src/content/guide/http/setup.md` (modified, +9/-1)
```diff
@@ -74,6 +74,12 @@ CRITICAL: You must configure an instance of `HttpClient` above the current injec
 
 ### `withJsonpSupport()`
 
+<docs-callout critical title="JSONP is deprecated">
+
+`withJsonpSupport`, `HttpClientJsonpModule`, and the `.jsonp()` method on `HttpClient` are deprecated because JSONP can cause cross-site scripting (XSS) vulnerabilities. Use standard HTTP requests with [CORS](https://developer.mozilla.org/docs/Web/HTTP/CORS) instead.
+
+</docs-callout>
+
 Including `withJsonpSupport` enables the `.jsonp()` method on `HttpClient`, which makes a GET request via the [JSONP convention](https://en.wikipedia.org/wiki/JSONP) for cross-domain loading of data.
 
 HELPFUL: Prefer using [CORS](https://developer.mozilla.org/docs/Web/HTTP/CORS) to make cross-domain requests instead of JSONP when possible.
@@ -95,10 +101,12 @@ This table lists the NgModules available from `@angular/common/http` and how the
 | **NgModule**                            | `provideHttpClient()` equivalent                         |
 | --------------------------------------- | -------------------------------------------------------- |
 | `HttpClientModule`                      | `provideHttpClient(withInterceptorsFromDi(), withXhr())` |
-| `HttpClientJsonpModule`                 | `withJsonpSupport()`                                     |
+| `HttpClientJsonpModule` (deprecated)    | `withJsonpSupport()` (deprecated)                        |
 | `HttpClientXsrfModule.withOptions(...)` | `withXsrfConfiguration(...)`                             |
 | `HttpClientXsrfModule.disable()`        | `withNoXsrfProtection()`                                 |
 
+NOTE: `HttpClientModule` and `HttpClientXsrfModule` are also deprecated. Use `provideHttpClient` with the corresponding features instead.
+
 <docs-callout important title="Use caution when using HttpClientModule in multiple injectors">
 When `HttpClientModule` is present in multiple injectors, the behavior of interceptors is poorly defined and depends on the exact options and provider/import ordering.
 
```

**File**: `adev/src/content/guide/routing/data-resolvers.md` (modified, +3/-3)
```diff
@@ -162,8 +162,8 @@ bootstrapApplication(App, {
       withNavigationErrorHandler((error) => {
         const router = inject(Router);
 
-        if (error?.message) {
-          console.error('Navigation error occurred:', error.message);
+        if (error.error?.message) {
+          console.error('Navigation error occurred:', error.error.message);
         }
 
         router.navigate(['/error']);
@@ -280,7 +280,7 @@ TIP: To avoid blocking navigation and render components immediately with skeleto
 To improve user experience during resolver execution, you can listen to router events and show loading indicators:
 
 ```angular-ts
-import {Component, inject} from '@angular/core';
+import {Component, computed, inject} from '@angular/core';
 import {Router} from '@angular/router';
 
 @Component({
```

**File**: `adev/src/content/guide/routing/lifecycle-and-events.md` (modified, +2/-2)
```diff
@@ -65,7 +65,7 @@ Debugging router navigation issues can be challenging without visibility into th
 When you need to inspect a Router event sequence, you can enable logging for internal navigation events for debugging. You can configure this by passing a configuration option (`withDebugTracing()`) that enables detailed console logging of all routing events.
 
 ```ts
-import {provideRouter, withDebugTracing} from '@angular/router';
+import {provideRouter, Routes, withDebugTracing} from '@angular/router';
 
 const appRoutes: Routes = [];
 bootstrapApplication(App, {
@@ -84,7 +84,7 @@ Router events enable many practical features in real-world applications. Here ar
 Show loading indicators during navigation:
 
 ```angular-ts
-import {Component, inject} from '@angular/core';
+import {Component, computed, inject} from '@angular/core';
 import {Router} from '@angular/router';
 
 @Component({
```

**File**: `adev/src/content/guide/routing/testing.md` (modified, +1/-1)
```diff
@@ -59,7 +59,7 @@ Route guards control access to routes based on conditions like authentication or
 The following example tests an `authGuard` that allows navigation for authenticated users and redirects unauthenticated users to a login page.
 
 ```ts {header: 'auth.guard.spec.ts'}
-import {vi, type Mocked} from 'vitest';
+import {describe, expect, it, vi, type Mocked} from 'vitest';
 import {RouterTestingHarness} from '@angular/router/testing';
 import {provideRouter, Router} from '@angular/router';
 import {authGuard} from './auth.guard';
```

**File**: `adev/src/content/guide/signals/debounced.md` (modified, +1/-1)
```diff
@@ -5,7 +5,7 @@ IMPORTANT: `debounced` is [experimental](reference/releases#experimental). It's
 Use `debounced` to delay reacting to a signal's value until it stops changing. It returns a `Resource` whose value reflects the debounced value of the source signal.
 
 ```angular-ts
-import {debounced, resource, signal} from '@angular/core';
+import {Component, debounced, resource, signal} from '@angular/core';
 
 @Component({
   template: `
```

**File**: `adev/src/content/guide/ssr.md` (modified, +1/-1)
```diff
@@ -241,7 +241,7 @@ Some common browser APIs and capabilities might not be available on the server.
 In general, code which relies on browser-specific symbols should only be executed in the browser, not on the server. This can be enforced through the `afterEveryRender` and `afterNextRender` lifecycle hooks. These are only executed on the browser and skipped on the server.
 
 ```angular-ts
-import {Component, viewChild, afterNextRender} from '@angular/core';
+import {Component, ElementRef, viewChild, afterNextRender} from '@angular/core';
 
 @Component({
   selector: 'my-cmp',
```

---

### Incident Patch 4: `c0dc8c4b` (2026-09-25)
**Commit Message**: fix(forms): skip class bindings for orphaned fields

The class bindings from `provideSignalFormsConfig` run in an `afterRenderEffect`, which keeps running while its view is detached. If an array is replaced in the meantime, the detached `@for` still holds the old rows and computing their classes throws NG01904. Skip the class updates while the field is orphaned.

Fixes #70934

**File**: `packages/forms/signals/src/directive/form_field.ts` (modified, +3/-0)
```diff
@@ -263,6 +263,9 @@ export class FormField<T> {
     afterRenderEffect(
       {
         write: () => {
+          if ((this.state() as unknown as FieldNode).structure.isOrphaned()) {
+            return;
+          }
           for (const [className, computation] of classes) {
             const active = computation();
             if (bindingUpdated(bindings, className, active)) {
```

**File**: `packages/forms/signals/test/web/form_field.spec.ts` (modified, +50/-0)
```diff
@@ -9,10 +9,12 @@
 import {
   booleanAttribute,
   ChangeDetectionStrategy,
+  ChangeDetectorRef,
   Component,
   computed,
   Directive,
   ElementRef,
+  ErrorHandler,
   EventEmitter,
   inject,
   Injector,
@@ -6422,6 +6424,54 @@ describe('field directive', () => {
       expect(input.classList.contains('multiline')).toBe(false);
       expect(textarea.classList.contains('multiline')).toBe(true);
     });
+
+    it('should not apply classes to orphaned fields in a detached view', () => {
+      const errors: unknown[] = [];
+      TestBed.configureTestingModule({
+        providers: [
+          {provide: ErrorHandler, useValue: {handleError: (e: unknown) => errors.push(e)}},
+          provideSignalFormsConfig({
+            classes: NG_STATUS_CLASSES,
+          }),
+        ],
+      });
+
+      @Component({
+        selector: 'test-rows',
+        imports: [FormField],
+        template: `
+          @for (item of f.items; track item) {
+            <input [formField]="item.name" />
+          }
+        `,
+      })
+      class TestRows {
+        readonly changeDetectorRef = inject(ChangeDetectorRef);
+        readonly model = signal({items: [{name: 'a'}, {name: 'b'}]});
+        readonly f = form(this.model);
+      }
+
+      @Component({
+        imports: [TestRows],
+        template: `<test-rows />`,
+      })
+      class TestCmp {
+        readonly rows = viewChild.required(TestRows);
+      }
+
+      const fixture = act(() => TestBed.createComponent(TestCmp));
+      const rows = fixture.componentInstance.rows();
+      rows.changeDetectorRef.detach();
+
+      act(() => rows.model.set({items: [{name: 'c'}, {name: 'd'}]}));
+      expect(errors).toEqual([]);
+
+      rows.changeDetectorRef.reattach();
+      act(() => rows.changeDetectorRef.markForCheck());
+      const inputs = fixture.nativeElement.querySelectorAll('input');
+      expect(inputs[0].value).toBe('c');
+      expect(inputs[0].classList.contains('ng-valid')).toBe(true);
+    });
   });
 
   it('should create & bind input when a macro task is running', async () => {
```

---

### Incident Patch 5: `8dd33e72` (2026-09-05)
**Commit Message**: fix(compiler-cli): don't mark constructor parameter properties as inherited

A member was considered inherited when its declaration's parent was not
the class being extracted. A public constructor parameter property
(`constructor(public snapshot: ActivatedRouteSnapshot) {}`) is extracted
as a property, but its declaration is a parameter whose parent is the
constructor rather than the class, so the check always matched and every
such member was tagged as inherited.

In the API reference that tag is rendered as `override`, which produced
class signatures like:

  class ActivationStart {
    constructor(snapshot: ActivatedRouteSnapshot);
    override snapshot: ActivatedRouteSnapshot;
  }

even though the class doesn't extend anything.

The check now resolves a parameter property to the class declaring its
constructor, so only members actually coming from a parent class keep
the inherited tag.

**File**: `packages/compiler-cli/src/ngtsc/docs/src/properties_extractor.ts` (modified, +12/-1)
```diff
@@ -185,13 +185,24 @@ export abstract class PropertiesExtractor {
       tags.push(MemberTags.Optional);
     }
 
-    if (member.parent !== this.declaration) {
+    if (this.getDeclaringNode(member) !== this.declaration) {
       tags.push(MemberTags.Inherited);
     }
 
     return tags;
   }
 
+  /**
+   * Gets the node a member is declared on. This is the member's parent, except for constructor
+   * parameter properties (e.g. `constructor(readonly foo: string) {}`) whose parent is the
+   * constructor rather than the class declaring it.
+   */
+  private getDeclaringNode(member: ts.Node): ts.Node | undefined {
+    return ts.isParameterPropertyDeclaration(member, member.parent)
+      ? member.parent.parent
+      : member.parent;
+  }
+
   /** Computes all signature declarations of the class/interface. */
   private computeAllSignatureDeclarations(): SignatureElement[] {
     const type = this.typeChecker.getTypeAtLocation(this.declaration);
```

**File**: `packages/compiler-cli/test/ngtsc/doc_extraction/class_doc_extraction_spec.ts` (modified, +30/-0)
```diff
@@ -721,6 +721,36 @@ runInEachFileSystem(() => {
       expect(fooEntry.name).toBe('foo');
       expect(fooEntry.memberType).toBe(MemberType.Property);
       expect((fooEntry as PropertyEntry).type).toBe('string');
+      expect(fooEntry.memberTags).not.toContain(MemberTags.Inherited);
+    });
+
+    it('should only mark constructor parameter properties from a parent as inherited', () => {
+      env.write(
+        'index.ts',
+        `
+        class Parent {
+          constructor(public name: string) {}
+        }
+
+        export class Child extends Parent {
+          constructor(public age: number) { super(''); }
+        }`,
+      );
+
+      const docs: DocEntry[] = env.driveDocsExtraction('index.ts');
+      expect(docs.length).toBe(1);
+
+      const classEntry = docs[0] as ClassEntry;
+
+      const ageEntry = classEntry.members.find((member) => member.name === 'age')!;
+      expect(ageEntry).toBeDefined();
+      expect(ageEntry.memberType).toBe(MemberType.Property);
+      expect(ageEntry.memberTags).not.toContain(MemberTags.Inherited);
+
+      const nameEntry = classEntry.members.find((member) => member.name === 'name')!;
+      expect(nameEntry).toBeDefined();
+      expect(nameEntry.memberType).toBe(MemberType.Property);
+      expect(nameEntry.memberTags).toContain(MemberTags.Inherited);
     });
 
     it('should not extract a constructor without parameters', () => {
```

---

### Incident Patch 6: `f591d36f` (2026-10-01)
**Commit Message**: fix(router): reset internal state on error handler redirect after state commit

When an error occurs after `BeforeActivateRoutes` has already committed
`targetRouterState` and `withNavigationErrorHandler` returns a
`RedirectCommand`, the transition emits a redirecting `NavigationCancel`
instead of `NavigationError`. Previously, `StateManager` skipped resetting
internal state on all redirecting cancellations because redirects from guards
and resolvers happen prior to `BeforeActivateRoutes`. This left the uncommitted
or half-activated `targetRouterState` (whose unactivated routes do not yet have
`snapshot` assigned) as the current `routerState` for the subsequent redirect
navigation.

This change resets internal state if a redirecting cancellation occurs after
`targetRouterState` was already committed.

Fixes #71126

**File**: `packages/router/src/statemanager/navigation_state_manager.ts` (modified, +8/-1)
```diff
@@ -320,8 +320,15 @@ export class NavigationStateManager extends StateManager {
     this.currentNavigation.rejectNavigateEvent?.();
     const clearedState = {}; // Marker to detect if a new navigation started during async ops.
     this.currentNavigation = clearedState;
-    // Do not reset state if we're redirecting or navigation is superseded by a new one.
+    // Do not reset browser history if we're redirecting or navigation is superseded by a new one.
     if (isRedirectingEvent(cause)) {
+      if (
+        cause instanceof NavigationCancel &&
+        cause.code === NavigationCancellationCode.Redirect &&
+        this.routerState === transition.targetRouterState
+      ) {
+        this.resetInternalState(transition.finalUrl, false);
+      }
       return;
     }
     // Determine if the rollback should be a traversal to a specific previous entry
```

**File**: `packages/router/src/statemanager/state_manager.ts` (modified, +10/-2)
```diff
@@ -15,6 +15,7 @@ import {
   Event,
   isRedirectingEvent,
   NavigationCancel,
+  NavigationCancellationCode,
   NavigationEnd,
   NavigationError,
   NavigationSkipped,
@@ -233,8 +234,15 @@ export class HistoryStateManager extends StateManager {
       if (this.urlUpdateStrategy === 'deferred' && !currentTransition.extras.skipLocationChange) {
         this.setBrowserUrl(this.createBrowserPath(currentTransition), currentTransition);
       }
-    } else if (e instanceof NavigationCancel && !isRedirectingEvent(e)) {
-      this.restoreHistory(currentTransition);
+    } else if (e instanceof NavigationCancel) {
+      if (!isRedirectingEvent(e)) {
+        this.restoreHistory(currentTransition);
+      } else if (
+        e.code === NavigationCancellationCode.Redirect &&
+        this.routerState === currentTransition.targetRouterState
+      ) {
+        this.resetInternalState(currentTransition);
+      }
     } else if (e instanceof NavigationError) {
       this.restoreHistory(currentTransition, true);
     } else if (e instanceof NavigationEnd) {
```

**File**: `packages/router/test/integration/navigation_errors.spec.ts` (modified, +28/-2)
```diff
@@ -132,7 +132,6 @@ export function navigationErrorsIntegrationSuite(browserAPI: 'history' | 'naviga
             {path: 'error', component: BlankCmp},
           ],
           {
-            resolveNavigationPromiseOnError: true,
             errorHandler: () => new RedirectCommand(inject(Router).parseUrl('/error')),
           },
         ),
@@ -171,7 +170,6 @@ export function navigationErrorsIntegrationSuite(browserAPI: 'history' | 'naviga
             },
             {path: 'error', component: BlankCmp},
           ],
-          withRouterConfig({resolveNavigationPromiseOnError: true}),
           withNavigationErrorHandler(() => new RedirectCommand(inject(Router).parseUrl('/error'))),
         ),
       ],
@@ -219,6 +217,34 @@ export function navigationErrorsIntegrationSuite(browserAPI: 'history' | 'naviga
     const router = TestBed.inject(Router);
   });
 
+  it('can redirect from error handler when a component throws during activation alongside a secondary outlet', async () => {
+    let errors = 0;
+    TestBed.configureTestingModule({
+      providers: [
+        provideRouter(
+          [
+            {path: 'throwing', component: ThrowingCmp},
+            {path: 'user/:name', outlet: 'aux', component: UserCmp},
+            {path: 'error', component: SimpleCmp},
+          ],
+          withNavigationErrorHandler(() => {
+            errors++;
+            return errors <= 3 ? new RedirectCommand(inject(Router).parseUrl('/error')) : undefined;
+          }),
+        ),
+      ],
+    });
+    const router = TestBed.inject(Router);
+    const fixture = await createRoot(router, RootCmp);
+
+    await router.navigateByUrl('/throwing(aux:user/victor)');
+    await advance(fixture);
+
+    expect(errors).toBe(1);
+    expect(router.url).toEqual('/error');
+    expect(fixture.nativeElement).toHaveText('simple');
+  });
+
   // Errors should behave the same for both deferred and eager URL update strategies
   (['deferred', 'eager'] as const).forEach((urlUpdateStrategy) => {
     it(`should dispatch NavigationError after the url has been reset back (${urlUpdateStrategy})`, async () => {
```

---

### Incident Patch 7: `8eea8f5e` (2026-10-02)
**Commit Message**: build: update dependency preact to v11

See associated pull request for more information.

**File**: `adev/package.json` (modified, +1/-1)
```diff
@@ -81,7 +81,7 @@
     "mermaid": "12.0.0",
     "ngx-progressbar": "14.0.0",
     "playwright-core": "1.63.0",
-    "preact": "10.29.8",
+    "preact": "11.0.0",
     "preact-render-to-string": "6.7.0",
     "prettier": "3.9.9",
     "property-information": "^7.1.0",
```

**File**: `pnpm-lock.yaml` (modified, +19/-19)
```diff
@@ -188,7 +188,7 @@ importers:
         version: 2.1.3
       karma-jasmine:
         specifier: ^5.0.0
-        version: 5.1.0(karma@6.4.4(bufferutil@4.1.0)(debug@4.4.3(supports-color@11.0.0))(supports-color@11.0.0))
+        version: 5.1.0(karma@6.4.4(bufferutil@4.1.0)(debug@4.4.3(supports-color@11.0.0))(supports-color@11.0.0)(utf-8-validate@6.0.6))
       karma-sourcemap-loader:
         specifier: ^0.4.0
         version: 0.4.0
@@ -288,7 +288,7 @@ importers:
         version: 16.1.0(bufferutil@4.1.0)
       firebase-tools:
         specifier: ^15.0.0
-        version: 15.32.0(@types/node@20.19.43)(bufferutil@4.1.0)(encoding@0.1.13)(supports-color@11.0.0)
+        version: 15.32.0(@types/node@20.19.43)(bufferutil@4.1.0)(encoding@0.1.13)(supports-color@11.0.0)(utf-8-validate@6.0.6)
       get-tsconfig:
         specifier: ^4.10.1
         version: 4.14.3
@@ -306,7 +306,7 @@ importers:
         version: 2.2.1(supports-color@11.0.0)
       karma-jasmine-html-reporter:
         specifier: ^2.2.0
-        version: 2.3.0(jasmine-core@6.3.0)(karma-jasmine@5.1.0(karma@6.4.4(bufferutil@4.1.0)(debug@4.4.3(supports-color@11.0.0))(supports-color@11.0.0)))(karma@6.4.4(bufferutil@4.1.0)(debug@4.4.3(supports-color@11.0.0))(supports-color@11.0.0))
+        version: 2.3.0(jasmine-core@6.3.0)(karma-jasmine@5.1.0(karma@6.4.4(bufferutil@4.1.0)(debug@4.4.3(supports-color@11.0.0))(supports-color@11.0.0)(utf-8-validate@6.0.6)))(karma@6.4.4(bufferutil@4.1.0)(debug@4.4.3(supports-color@11.0.0))(supports-color@11.0.0)(utf-8-validate@6.0.6))
       prettier:
         specifier: ^3.8.0
         version: 3.9.9
@@ -555,10 +555,10 @@ importers:
         version: 2.2.1(supports-color@11.0.0)
       karma-jasmine:
         specifier: 5.1.0
-        version: 5.1.0(karma@6.4.4(bufferutil@4.1.0)(debug@4.4.3(supports-color@11.0.0))(supports-color@11.0.0))
+        version: 5.1.0(karma@6.4.4(bufferutil@4.1.0)(debug@4.4.3(supports-color@11.0.0))(supports-color@11.0.0)(utf-8-validate@6.0.6))
       karma-jasmine-html-reporter:
         specifier: 2.3.0
-        version: 2.3.0(jasmine-core@6.3.0)(karma-jasmine@5.1.0(karma@6.4.4(bufferutil@4.1.0)(debug@4.4.3(supports-color@11.0.0))(supports-color@11.0.0)))(karma@6.4.4(bufferutil@4.1.0)(debug@4.4.3(supports-color@11.0.0))(supports-color@11.0.0))
+        version: 2.3.0(jasmine-core@6.3.0)(karma-jasmine@5.1.0(karma@6.4.4(bufferutil@4.1.0)(debug@4.4.3(supports-color@11.0.0))(supports-color@11.0.0)(utf-8-validate@6.0.6)))(karma@6.4.4(bufferutil@4.1.0)(debug@4.4.3(supports-color@11.0.0))(supports-color@11.0.0)(utf-8-validate@6.0.6))
       marked:
         specifier: 18.0.14
         version: 18.0.14
@@ -572,11 +572,11 @@ importers:
         specifier: 1.63.0
         version: 1.63.0
       preact:
-        specifier: 10.29.8
-        version: 10.29.8(preact-render-to-string@6.7.0)
+        specifier: 11.0.0
+        version: 11.0.0(preact-render-to-string@6.7.0)
       preact-render-to-string:
         specifier: 6.7.0
-        version: 6.7.0(preact@10.29.8)
+        version: 6.7.0(preact@11.0.0)
       prettier:
         specifier: 3.9.9
         version: 3.9.9
@@ -9287,10 +9287,10 @@ packages:
     peerDependencies:
       preact: '>=10 || >= 11.0.0-0'
 
-  preact@10.29.8:
-    resolution: {integrity: sha512-ej2aVZ+vZ8WO7tvlQWRM9N63A0KzF9q4mWJfDUHgYaIofWY9hu74QdnQrjoPMmZi2/nZ5gN0bJCQF49xQqx09Q==}
+  preact@11.0.0:
+    resolution: {integrity: sha512-LRTLKuSe6VYPhvBDjwFaX+nuZnpsw6IN2GSboisAvhGsncylBmrbDCERhgKDn6yP2mAwbGvsB5OVyTe33M8gBg==}
     peerDependencies:
-      preact-render-to-string: '>=5'
+      preact-render-to-string: '>=6.7.0'
     peerDependenciesMeta:
       preact-render-to-string:
         optional: true
@@ -17429,7 +17429,7 @@ snapshots:
       object.pick: 1.3.0
       parse-filepath: 1.0.2
 
-  firebase-tools@15.32.0(@types/node@20.19.43)(bufferutil@4.1.0)(encoding@0.1.13)(supports-color@11.0.0):
+  firebase-tools@15.32.0(@types/node@20.19.43)(bufferutil@4.1.0)(encoding@0.1.13)(supports-color@11.0.0)(utf-8-validate@6.0.6):
     dependencies:
       '@apphosting/common': 0.0.8
       '@electric-sql/pglite': 0.3.16
@@ -19199,13 +19199,13 @@ snapshots:
       is-wsl: 2.2.0
       which: 3.0.1
 
-  karma-jasmine-html-reporter@2.3.0(jasmine-core@6.3.0)(karma-jasmine@5.1.0(karma@6.4.4(bufferutil@4.1.0)(debug@4.4.3(supports-color@11.0.0))(supports-color@11.0.0)))(karma@6.4.4(bufferutil@4.1.0)(debug@4.4.3(supports-color@11.0.0))(supports-color@11.0.0)):
+  karma-jasmine-html-reporter@2.3.0(jasmine-core@6.3.0)(karma-jasmine@5.1.0(karma@6.4.4(bufferutil@4.1.0)(debug@4.4.3(supports-color@11.0.0))(supports-color@11.0.0)(utf-8-validate@6.0.6)))(karma@6.4.4(bufferutil@4.1.0)(debug@4.4.3(supports-color@11.0.0))(supports-color@11.0.0)(utf-8-validate@6.0.6)):
     dependencies:
       jasmine-core: 6.3.0
       karma: 6.4.4(bufferutil@4.1.0)(debug@4.4.3(supports-color@11.0.0))(supports-color@11.0.0)(utf-8-validate@6.0.6)
-      karma-jasmine: 5.1.0(karma@6.4.4(bufferutil@4.1.0)(debug@4.4.3(suppo
```

---

### Incident Patch 8: `341fadd2` (2026-10-01)
**Commit Message**: docs: fix inaccurate statements and broken examples across adev

Fix code examples that don't compile or fail at runtime, wrong API
names, and statements of defaults or behavior that no longer match the
source, across the forms, signals, http, routing, DI, components,
testing, CLI, reference, ecosystem and tutorial pages.

**File**: `adev/src/content/best-practices/runtime-performance/skipping-subtrees.md` (modified, +1/-1)
```diff
@@ -8,7 +8,7 @@ Change detection is sufficiently fast for most applications. However, when an ap
 
 OnPush is the default change detection strategy in Angular (since v22). It instructs Angular to run change detection for a component subtree **only** when:
 
-- The root component of the subtree receives new inputs as the result of a template binding. Angular compares the current and past value of the input with `==`.
+- The root component of the subtree receives new inputs as the result of a template binding. Angular compares the current and past value of the input with `Object.is`.
 - Angular handles an event _(for example using event binding, output binding, or `@HostListener` )_ in the subtree's root component or any of its children whether they are using OnPush change detection or not.
 
 ## Common change detection scenarios
```

**File**: `adev/src/content/ecosystem/rxjs-interop/output-interop.md` (modified, +1/-1)
```diff
@@ -2,7 +2,7 @@
 
 TIP: This guide assumes you're familiar with [component and directive outputs](guide/components/outputs).
 
-The `@angular/rxjs-interop` package offers two APIs related to component and directive outputs.
+The `@angular/core/rxjs-interop` package offers two APIs related to component and directive outputs.
 
 ## Creating an output based on an RxJs Observable
 
```

**File**: `adev/src/content/ecosystem/rxjs-interop/signals-interop.md` (modified, +1/-1)
```diff
@@ -128,7 +128,7 @@ Here, only the last value (3) will be logged.
 
 ## Using `rxResource` for async data
 
-Angular's [`resource` function](/guide/signals/resource) gives you a way to incorporate async data into your application's signal-based code. Building on top of this pattern, `rxResource` lets you define a resource where the source of your data is defined in terms of an RxJS `Observable`. Instead of accepting a `loader` function, `rxResource` accepts a `stream` function that accepts an RxJS `Observable`.
+Angular's [`resource` function](/guide/signals/resource) gives you a way to incorporate async data into your application's signal-based code. Building on top of this pattern, `rxResource` lets you define a resource where the source of your data is defined in terms of an RxJS `Observable`. Instead of accepting a `loader` function, `rxResource` accepts a `stream` function that returns an RxJS `Observable`.
 
 ```typescript
 import {Component, inject} from '@angular/core';
```

**File**: `adev/src/content/ecosystem/service-workers/communications.md` (modified, +8/-9)
```diff
@@ -14,15 +14,14 @@ The `SwUpdate` service supports three separate operations:
 
 ### Version updates
 
-The `versionUpdates` is an `Observable` property of `SwUpdate` and emits five event types:
-
-| Event types                      | Details                                                                                                                                                                               |
-| :------------------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
-| `VersionDetectedEvent`           | Emitted when the service worker has detected a new version of the app on the server and is about to start downloading it.                                                             |
-| `NoNewVersionDetectedEvent`      | Emitted when the service worker has checked the version of the app on the server and did not find a new version.                                                                      |
-| `VersionReadyEvent`              | Emitted when a new version of the app is available to be activated by clients. It may be used to notify the user of an available update or prompt them to refresh the page.           |
-| `VersionInstallationFailedEvent` | Emitted when the installation of a new version failed. It may be used for logging/monitoring purposes.                                                                                |
-| `VersionFailedEvent`             | Emitted when a version encounters a critical failure (such as broken hash errors) that affects all clients using that version. Provides error details for debugging and transparency. |
+The `versionUpdates` is an `Observable` property of `SwUpdate` and emits four event types:
+
+| Event types                      | Details                                                                                                                                                                     |
+| :------------------------------- | :-------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
+| `VersionDetectedEvent`           | Emitted when the service worker has detected a new version of the app on the server and is about to start downloading it.                                                   |
+| `NoNewVersionDetectedEvent`      | Emitted when the service worker has checked the version of the app on the server and did not find a new version.                                                            |
+| `VersionReadyEvent`              | Emitted when a new version of the app is available to be activated by clients. It may be used to notify the user of an available update or prompt them to refresh the page. |
+| `VersionInstallationFailedEvent` | Emitted when the installation of a new version failed. It may be used for logging/monitoring purposes.                                                                      |
 
 <docs-code header="log-update.service.ts" path="adev/src/content/examples/service-worker-getting-started/src/app/log-update.service.ts" region="sw-update"/>
 
```

**File**: `adev/src/content/ecosystem/service-workers/config.md` (modified, +1/-1)
```diff
@@ -332,7 +332,7 @@ The ServiceWorker redirects navigation requests that don't match any `asset` or
 A request is considered to be a navigation request if:
 
 - Its [method](https://developer.mozilla.org/docs/Web/API/Request/method) is `GET`
-- Its [mode](https://developer.mozilla.org/docs/Web/API/Request/mode) is `navigation`
+- Its [mode](https://developer.mozilla.org/docs/Web/API/Request/mode) is `navigate`
 - It accepts a `text/html` response as determined by the value of the `Accept` header
 - Its URL matches the following criteria:
   - The URL must not contain a file extension (that is, a `.`) in the last path segment
```

**File**: `adev/src/content/examples/accessibility/src/app/progress-bar.component.ts` (modified, +1/-1)
```diff
@@ -18,7 +18,7 @@ import {Component, input} from '@angular/core';
     'aria-valuemax': '100',
 
     // Binding that updates the current value of the progressbar.
-    '[attr.aria-valuenow]': 'value',
+    '[attr.aria-valuenow]': 'value()',
   },
 })
 export class ExampleProgressbarComponent {
```

**File**: `adev/src/content/examples/service-worker-getting-started/src/app/log-update.service.ts` (modified, +0/-3)
```diff
@@ -18,9 +18,6 @@ export class LogUpdateService {
         case 'VERSION_INSTALLATION_FAILED':
           console.log(`Failed to install app version '${evt.version.hash}': ${evt.error}`);
           break;
-        case 'VERSION_FAILED':
-          console.log(`Version '${evt.version.hash}' failed with error: ${evt.error}`);
-          break;
       }
     });
   }
```

**File**: `adev/src/content/guide/components/advanced-configuration.md` (modified, +1/-1)
```diff
@@ -45,4 +45,4 @@ import {Component, CUSTOM_ELEMENTS_SCHEMA} from '@angular/core';
 export class ComponentWithCustomElements { }
 ```
 
-Angular does not support any other schemas at this time.
+Angular also provides `NO_ERRORS_SCHEMA`, which allows any element and any property.
```

---

### Incident Patch 9: `a1bffc29` (2026-09-30)
**Commit Message**: fix(router): fall back when serializing protocol-relative URLs

Avoid throwing when DefaultUrlSerializer encounters a UrlTree that would serialize to a protocol-relative URL. Warn in development mode and serialize the tree with a root-relative path instead while preserving query parameters and fragments.

Additionally, account for WHATWG URL normalization (e.g. dot segments and backslashes collapsing into protocol-relative paths such as `/.//` or `/..//`).

Fixes #69700
Fixes #71076

Co-authored-by: Andrew Scott <[REDACTED_EMAIL]>

**File**: `goldens/public-api/router/errors.api.md` (modified, +2/-0)
```diff
@@ -37,6 +37,8 @@ export const enum RuntimeErrorCode {
     // (undocumented)
     OUTLET_NOT_ACTIVATED = 4012,
     // (undocumented)
+    PROTOCOL_RELATIVE_URL_NOT_ALLOWED = 4019,
+    // (undocumented)
     ROOT_SEGMENT_MATRIX_PARAMS = 4003,
     // (undocumented)
     TWO_SEGMENTS_WITH_SAME_OUTLET = 4006,
```

**File**: `packages/core/test/bundling/router/bundle.golden_symbols.json` (modified, +2/-0)
```diff
@@ -74,6 +74,7 @@
       "DI_DECORATOR_FLAG",
       "DOCUMENT",
       "DOCUMENT2",
+      "DUMMY_BASE_URL",
       "DefaultDomRenderer2",
       "DefaultRouteReuseStrategy",
       "DefaultTitleStrategy",
@@ -862,6 +863,7 @@
       "isPositive",
       "isPromise",
       "isPromise2",
+      "isProtocolRelative",
       "isPublicRouterEvent",
       "isReadableStreamLike",
       "isRedirect",
```

**File**: `packages/router/src/errors.ts` (modified, +1/-0)
```diff
@@ -29,4 +29,5 @@ export const enum RuntimeErrorCode {
   INFINITE_REDIRECT = 4016,
   INVALID_ROUTER_LINK_INPUTS = 4017,
   ERROR_PARSING_URL = 4018,
+  PROTOCOL_RELATIVE_URL_NOT_ALLOWED = 4019,
 }
```

**File**: `packages/router/src/url_tree.ts` (modified, +36/-2)
```diff
@@ -6,7 +6,13 @@
  * found in the LICENSE file at https://angular.dev/license
  */
 
-import {computed, ɵRuntimeError as RuntimeError, Service, Signal} from '@angular/core';
+import {
+  computed,
+  ɵformatRuntimeError as formatRuntimeError,
+  ɵRuntimeError as RuntimeError,
+  Service,
+  Signal,
+} from '@angular/core';
 
 import {RuntimeErrorCode} from './errors';
 import type {Router} from './router';
@@ -472,7 +478,18 @@ export class DefaultUrlSerializer implements UrlSerializer {
 
   /** Converts a `UrlTree` into a url */
   serialize(tree: UrlTree): string {
-    const segment = `/${serializeSegment(tree.root, true)}`;
+    let segment = `/${serializeSegment(tree.root, true)}`;
+    if (isProtocolRelative(segment)) {
+      if (typeof ngDevMode === 'undefined' || ngDevMode) {
+        console.warn(
+          formatRuntimeError(
+            RuntimeErrorCode.PROTOCOL_RELATIVE_URL_NOT_ALLOWED,
+            `Cannot serialize a UrlTree that would produce a protocol-relative URL. Falling back to '/' instead.`,
+          ),
+        );
+      }
+      segment = '/';
+    }
     const query = serializeQueryParams(tree.queryParams);
     const fragment =
       typeof tree.fragment === `string` ? `#${encodeUriFragment(tree.fragment)}` : '';
@@ -481,6 +498,23 @@ export class DefaultUrlSerializer implements UrlSerializer {
   }
 }
 
+const DUMMY_BASE_URL = 'http://fake';
+
+/**
+ * Determines whether a serialized path would produce a protocol-relative URL when interpreted
+ * by a browser or server. Under the WHATWG URL standard, paths starting with `//` or `/\`, or paths
+ * where leading dot segments collapse to `//` (such as `/.//` or `/..//`), resolve to an external
+ * origin or a protocol-relative pathname.
+ */
+function isProtocolRelative(url: string): boolean {
+  try {
+    const resolved = new URL(url, DUMMY_BASE_URL);
+    return resolved.origin !== DUMMY_BASE_URL || resolved.pathname.startsWith('//');
+  } catch {
+    return true;
+  }
+}
+
 const DEFAULT_SERIALIZER = new DefaultUrlSerializer();
 
 export function serializePaths(segment: UrlSegmentGroup): string {
```

**File**: `packages/router/test/create_url_tree.spec.ts` (modified, +86/-0)
```diff
@@ -22,6 +22,15 @@ import {timeout} from '@angular/private/testing';
 
 describe('createUrlTree', () => {
   const serializer = new DefaultUrlSerializer();
+  const protocolRelativeUrlWarning = `NG04019: Cannot serialize a UrlTree that would produce a protocol-relative URL. Falling back to '/' instead.`;
+
+  function expectProtocolRelativeUrlFallback(tree: UrlTree, expected = '/'): void {
+    const warn = spyOn(console, 'warn');
+
+    expect(serializer.serialize(tree)).toEqual(expected);
+    expect(warn).toHaveBeenCalledOnceWith(protocolRelativeUrlWarning);
+  }
+
   let router: Router;
   beforeEach(() => {
     router = TestBed.inject(Router);
@@ -134,6 +143,83 @@ describe('createUrlTree', () => {
     expect(serializer.serialize(t)).toEqual('/%2Fone/two%2Fthree');
   });
 
+  describe('leading empty path commands', () => {
+    it('should fall back for absolute navigations that would serialize as protocol-relative', () => {
+      const t = router.createUrlTree(['/', '', '', 'attacker.example', 'collect']);
+
+      expectProtocolRelativeUrlFallback(t);
+    });
+
+    it('should fall back for an unsafe primary outlet string', async () => {
+      await router.navigateByUrl('/safe');
+      const t = router.createUrlTree([{outlets: {primary: '/attacker.example/collect'}}]);
+
+      expectProtocolRelativeUrlFallback(t);
+    });
+
+    it('should fall back for an unsafe primary outlet array', () => {
+      const t = router.createUrlTree([{outlets: {primary: ['', 'attacker.example', 'collect']}}]);
+
+      expectProtocolRelativeUrlFallback(t);
+    });
+
+    it('should fall back for unsafe parent-relative commands', async () => {
+      router.resetConfig([{path: 'source', component: class {}}]);
+      await router.navigateByUrl('/source');
+      const t = create(router.routerState.root.firstChild!, [
+        '../',
+        '',
+        'attacker.example',
+        'collect',
+      ]);
+
+      expectProtocolRelativeUrlFallback(t);
+    });
+
+    it('should fall back for an escaped slash after an empty path command', () => {
+      const t = router.createUrlTree(['/', '', {segmentPath: '/'}]);
+
+      expectProtocolRelativeUrlFallback(t);
+    });
+
+    it('should fall back for final empty path commands', () => {
+      const t = router.createUrlTree(['/', '', '']);
+
+      expectProtocolRelativeUrlFallback(t);
+    });
+
+    it('should fall back for dot segments that normalize to protocol-relative', () => {
+      const t = router.createUrlTree(['/', '.', '', 'attacker.example', 'collect']);
+
+      expectProtocolRelativeUrlFallback(t);
+    });
+
+    it('should fall back for parent dot segments that normalize to protocol-relative', () => {
+      const t = router.createUrlTree(['/', '..', '', 'attacker.example', 'collect']);
+
+      expectProtocolRelativeUrlFallback(t);
+    });
+
+    it('should preserve query params and fragment when falling back', () => {
+      const t = router.createUrlTree(['/', '', '', 'attacker.example', 'collect'], {
+        queryParams: {foo: 'bar'},
+        fragment: 'frag',
+      });
+
+      expectProtocolRelativeUrlFallback(t, '/?foo=bar#frag');
+    });
+
+    it('should not normalize a leading empty path command in a secondary outlet', () => {
+      const t = router.createUrlTree(['/', {outlets: {right: ['', 'child']}}]);
+
+      expect(t.root.children['right'].segments.map((segment) => segment.path)).toEqual([
+        '',
+        'child',
+      ]);
+      expect(serializer.serialize(t)).toEqual('/(right:/child)');
+    });
+  });
+
   describe('named outlets', () => {
     it('should preserve secondary segments', async () => {
       const p = serializer.parse('/a/11/b(right:c)');
```

**File**: `packages/router/test/router_link_spec.ts` (modified, +48/-0)
```diff
@@ -329,4 +329,52 @@ describe('RouterLink', () => {
     await harness.navigateByUrl('/different');
     expect(anchor.getAttribute('href')).toBe('/different/child');
   });
+
+  it('falls back to the root for a link that would generate a protocol-relative href', async () => {
+    @Component({
+      template: `<a [routerLink]="commands" queryParamsHandling="preserve">commands</a>`,
+      imports: [RouterLink],
+    })
+    class WithLink {
+      readonly commands = ['/', '', 'attacker.example', 'collect'];
+    }
+
+    TestBed.configureTestingModule({
+      providers: [provideRouter([{path: '', component: WithLink}])],
+    });
+    const warn = spyOn(console, 'warn');
+    const fixture = TestBed.createComponent(WithLink);
+
+    await fixture.whenStable();
+
+    expect(fixture.nativeElement.querySelector('a').getAttribute('href')).toBe('/');
+    expect(warn).toHaveBeenCalledWith(
+      `NG04019: Cannot serialize a UrlTree that would produce a protocol-relative URL. Falling back to '/' instead.`,
+    );
+  });
+
+  it('preserves query params and fragment when falling back for a protocol-relative link', async () => {
+    @Component({
+      template: `<a [routerLink]="commands" [queryParams]="{ref: '123'}" fragment="section"
+        >commands</a
+      >`,
+      imports: [RouterLink],
+    })
+    class WithLink {
+      readonly commands = ['/', '', 'attacker.example', 'collect'];
+    }
+
+    TestBed.configureTestingModule({
+      providers: [provideRouter([{path: '', component: WithLink}])],
+    });
+    const warn = spyOn(console, 'warn');
+    const fixture = TestBed.createComponent(WithLink);
+
+    await fixture.whenStable();
+
+    expect(fixture.nativeElement.querySelector('a').getAttribute('href')).toBe('/?ref=123#section');
+    expect(warn).toHaveBeenCalledWith(
+      `NG04019: Cannot serialize a UrlTree that would produce a protocol-relative URL. Falling back to '/' instead.`,
+    );
+  });
 });
```

**File**: `packages/router/test/url_serializer.spec.ts` (modified, +67/-0)
```diff
@@ -13,11 +13,13 @@ import {
   encodeUriQuery,
   encodeUriSegment,
   serializePath,
+  UrlSegment,
   UrlSegmentGroup,
 } from '../src/url_tree';
 
 describe('url serializer', () => {
   const url = new DefaultUrlSerializer();
+  const protocolRelativeUrlWarning = `NG04019: Cannot serialize a UrlTree that would produce a protocol-relative URL. Falling back to '/' instead.`;
 
   it('should parse the root url', () => {
     const tree = url.parse('/');
@@ -447,6 +449,71 @@ describe('url serializer', () => {
     });
   });
 
+  describe('leading empty path segments', () => {
+    it('should fall back for a parsed primary outlet that would serialize as protocol-relative', () => {
+      const warn = spyOn(console, 'warn');
+      const tree = url.parse('/(primary://attacker.example/collect)?token=RESET_TOKEN');
+
+      expect(url.serialize(tree)).toBe('/?token=RESET_TOKEN');
+      expect(warn).toHaveBeenCalledOnceWith(protocolRelativeUrlWarning);
+    });
+
+    it('should fall back for multiple leading empty primary segments', () => {
+      const warn = spyOn(console, 'warn');
+      const tree = url.parse('/attacker.example/collect');
+      tree.root.children[PRIMARY_OUTLET].segments.unshift(
+        new UrlSegment('', {}),
+        new UrlSegment('', {}),
+      );
+
+      expect(url.serialize(tree)).toBe('/');
+      expect(warn).toHaveBeenCalledOnceWith(protocolRelativeUrlWarning);
+    });
+
+    it('should fall back for unsafe trees with secondary outlets, query params, and fragments', () => {
+      const warn = spyOn(console, 'warn');
+      const tree = url.parse(
+        '/attacker.example/collect(popup:compose)?token=RESET_TOKEN#OAUTH_TOKEN',
+      );
+      tree.root.children[PRIMARY_OUTLET].segments.unshift(new UrlSegment('', {}));
+
+      expect(url.serialize(tree)).toBe('/?token=RESET_TOKEN#OAUTH_TOKEN');
+      expect(warn).toHaveBeenCalledOnceWith(protocolRelativeUrlWarning);
+    });
+
+    it('should fall back for a parsed path with dot and leading empty segment that would normalize to protocol-relative', () => {
+      const warn = spyOn(console, 'warn');
+      const tree = url.parse('/.;/(//evil.test)');
+
+      expect(url.serialize(tree)).toBe('/');
+      expect(warn).toHaveBeenCalledOnceWith(protocolRelativeUrlWarning);
+    });
+
+    it('should fall back for dot segments collapsing to protocol-relative path', () => {
+      const warn = spyOn(console, 'warn');
+      const tree = url.parse('/attacker.example/collect');
+      tree.root.children[PRIMARY_OUTLET].segments.unshift(
+        new UrlSegment('.', {}),
+        new UrlSegment('', {}),
+      );
+
+      expect(url.serialize(tree)).toBe('/');
+      expect(warn).toHaveBeenCalledOnceWith(protocolRelativeUrlWarning);
+    });
+
+    it('should fall back for double dot segments collapsing to protocol-relative path', () => {
+      const warn = spyOn(console, 'warn');
+      const tree = url.parse('/attacker.example/collect');
+      tree.root.children[PRIMARY_OUTLET].segments.unshift(
+        new UrlSegment('..', {}),
+        new UrlSegment('', {}),
+      );
+
+      expect(url.serialize(tree)).toBe('/');
+      expect(warn).toHaveBeenCalledOnceWith(protocolRelativeUrlWarning);
+    });
+  });
+
   describe('error handling', () => {
     it('should throw when invalid characters inside children', () => {
       expect(() => url.parse('/one/(left#one)')).toThrowError();
```

---

### Incident Patch 10: `c5b4678e` (2026-10-01)
**Commit Message**: docs: update event replay section of the hydration guide

Since incremental hydration became the default in v22 and it enables
event replay, `provideClientHydration()` already replays events. The
hydration guide still told readers to enable event replay with
`withEventReplay()`; it now explains that it's on by default and when
`withEventReplay()` is still needed.

**File**: `adev/src/content/guide/hydration.md` (modified, +9/-5)
```diff
@@ -63,13 +63,19 @@ You can also use [Angular DevTools browser extension](tools/devtools) to see hyd
 
 ## Capturing and replaying events
 
-When an application is rendered on the server, it is visible in a browser as soon as produced HTML loads. Users may assume that they can interact with the page, but event listeners are not attached until hydration completes. Starting from v18, you can enable the Event Replay feature that allows to capture all events that happen before hydration and replay those events once hydration has completed. You can enable it using the `withEventReplay()` function, for example:
+When an application is rendered on the server, it is visible in a browser as soon as produced HTML loads. Users may assume that they can interact with the page, but event listeners are not attached until hydration completes. The Event Replay feature captures all events that happen before hydration and replays those events once hydration has completed.
+
+Event replay is enabled alongside [incremental hydration](guide/incremental-hydration). If you opt out of incremental hydration with `withNoIncrementalHydration()`, you can still enable event replay using the `withEventReplay()` function:
 
 ```typescript
-import {provideClientHydration, withEventReplay} from '@angular/platform-browser';
+import {
+  provideClientHydration,
+  withEventReplay,
+  withNoIncrementalHydration,
+} from '@angular/platform-browser';
 
 bootstrapApplication(App, {
-  providers: [provideClientHydration(withEventReplay())],
+  providers: [provideClientHydration(withNoIncrementalHydration(), withEventReplay())],
 });
 ```
 
@@ -92,8 +98,6 @@ Event replay supports _native browser events_, for example `click`, `mouseover`,
 
 This feature ensures a consistent user experience, preventing user actions performed before hydration from being ignored.
 
-NOTE: If you have [incremental hydration](guide/incremental-hydration) enabled, event replay is automatically enabled under the hood.
-
 ## Constraints
 
 Hydration imposes a few constraints on your application that are not present without hydration enabled. Your application must have the same generated DOM structure on both the server and the client. The process of hydration expects the DOM tree to have the same structure in both places. This also includes whitespaces and comment nodes that Angular produces during the rendering on the server. Those whitespaces and nodes must be present in the HTML generated by the server-side rendering process.
```

---

### Incident Patch 11: `a0bb74bf` (2026-09-20)
**Commit Message**: docs(platform-browser): link the styling guide from the namespacing APIs (#70835)

Point the TSDoc of `provideCssVarNamespacing` and `CssVarNamespacer` at the
guide section that describes them, so the generated API pages lead back to
it, and name the component file in the guide's example.

PR Close #70835

**File**: `adev/src/content/guide/components/styling.md` (modified, +1/-1)
```diff
@@ -235,7 +235,7 @@ Prefer a style binding such as `[style.--primary-color]`, which Angular namespac
 you go through a DOM API instead, pass the name you wrote in your styles to
 [`CssVarNamespacer`](api/platform-browser/CssVarNamespacer), including the leading `--`:
 
-```angular-ts
+```angular-ts {header: "profile-photo.ts"}
 import {Component, ElementRef, inject} from '@angular/core';
 import {CssVarNamespacer} from '@angular/platform-browser';
 
```

**File**: `packages/platform-browser/src/dom/css_var_namespacer.ts` (modified, +1/-0)
```diff
@@ -14,6 +14,7 @@ import {CSS_VAR_NAMESPACE} from './dom_renderer';
  * This is useful when reading or setting CSS variables dynamically in JavaScript that
  * were transformed by the compiler during the build.
  *
+ * @see [Using namespaced properties in TypeScript](guide/components/styling#using-namespaced-properties-in-typescript)
  * @publicApi 22.1
  */
 @Service()
```

**File**: `packages/platform-browser/src/dom/dom_renderer.ts` (modified, +1/-0)
```diff
@@ -88,6 +88,7 @@ export const CSS_VAR_NAMESPACE = new InjectionToken<string>(
  *
  * @param namespace The prefix string to use as a namespace. If not provided, it defaults
  *     to the `APP_ID`. An underscore is appended unconditionally.
+ * @see [Namespacing CSS custom properties](guide/components/styling#namespacing-css-custom-properties)
  * @publicApi
  */
 export function provideCssVarNamespacing(namespace?: string): EnvironmentProviders {
```

---

### Incident Patch 12: `95f607ca` (2026-09-20)
**Commit Message**: docs: document CSS custom property namespacing in the styling guide (#70835)

`provideCssVarNamespacing` and `CssVarNamespacer` landed in v22.1 (#68846)
with no guide coverage, so the generated API reference was the only
description of them. That reference cannot explain where the feature stops:
Angular rewrites the custom property names in the styles it compiles, but
static `style` attributes, object style bindings, `Renderer2.setStyle`,
global stylesheets, and library components that read a global theme all keep
the original name, and nothing reports the mismatch at build time or at
runtime.

Document the feature in the component styling guide: what Angular rewrites,
the surfaces that keep the name you write, how to opt a name out with
`--global--`, and how to resolve a namespaced name from TypeScript.

Fixes #70834

PR Close #70835

**File**: `adev/src/content/guide/components/styling.md` (modified, +119/-0)
```diff
@@ -142,3 +142,122 @@ reference CSS files. Additionally, your CSS may
 use [the `@import`at-rule](https://developer.mozilla.org/docs/Web/CSS/@import) to reference
 CSS files. Angular treats these references as _external_ styles. External styles are not affected by
 emulated view encapsulation.
+
+## Namespacing CSS custom properties
+
+Angular can add a prefix to the CSS custom properties (also called CSS variables) that your
+component styles declare and read. Custom properties inherit down the DOM tree, so when something
+outside your application defines a custom property such as `--primary-color` on an ancestor
+element, your components read that value. This matters when your application shares a page with another
+application or with markup you do not control. Angular does not namespace custom properties until
+you ask it to, and an application that owns its page does not need namespacing.
+
+To scope the custom properties in your component styles to your application, add
+[`provideCssVarNamespacing`](api/platform-browser/provideCssVarNamespacing) to your application's
+providers. It uses the application's [`APP_ID`](api/core/APP_ID) as the namespace:
+
+```ts {header: "app.config.ts"}
+import {APP_ID, ApplicationConfig} from '@angular/core';
+import {provideCssVarNamespacing} from '@angular/platform-browser';
+
+export const appConfig: ApplicationConfig = {
+  providers: [{provide: APP_ID, useValue: 'my-app'}, provideCssVarNamespacing()],
+};
+```
+
+Angular prefixes the custom properties in your component styles with that namespace followed by an
+underscore, so `--primary-color` becomes `--my-app_primary-color`. The prefix applies to
+declarations, `var()` references, `@property` rules, and style bindings such as
+`[style.--primary-color]`, including the style bindings a component declares in its `host` object.
+
+`APP_ID` is `ng` unless you set it, so give each application on the page its own `APP_ID`.
+Otherwise, the applications share a prefix and collide again. To use a namespace that differs from
+the application id, pass it to `provideCssVarNamespacing`. Angular appends the underscore itself:
+`provideCssVarNamespacing('my-app_')` produces `--my-app__primary-color`.
+
+Angular namespaces the styles it compiles into a component: the `styles` and `styleUrl` of the
+component, the styles you [write in a `<style>` element](#defining-styles-in-templates) in its
+template, stylesheets its template references with a relative `<link rel="stylesheet">`, and
+the styles of a component that uses `ViewEncapsulation.None`. Angular does not namespace a stylesheet the browser
+loads at runtime, such as a global stylesheet your build configuration lists or an
+[external style](#referencing-external-style-files) that your build does not inline.
+
+Namespacing applies to every component Angular compiles, including the components of the libraries
+you install. When a library's styles read a custom property that a global stylesheet defines, such
+as the properties of a theme, the reference no longer matches, the browser uses the `var()`
+fallback if there is one or otherwise
+[the property's inherited or initial value](https://www.w3.org/TR/css-variables-1/#invalid-variables),
+and nothing reports an error. Before you enable namespacing in an
+existing application, review the custom properties that cross between your global stylesheets and
+your components.
+
+IMPORTANT: Angular rewrites custom property names only in the styles and bindings it compiles.
+Everywhere else keeps the name you write, and nothing reports the mismatch.
+
+Angular does not rewrite the name in:
+
+- Static style attributes, such as `style="--primary-color: red"`, including the `style` entry of a
+  component's `host` object.
+- Object and string style bindings, such as `[style]="{'--primary-color': color}"`,
+  `[style]="'--primary-color: red'"` and `ngStyle`, including the `[style]` entry of a component's
+  `host` object.
+- Custom property names inside a binding's value, such as
+  `[style.border-color]="'var(--primary-color)'"`.
+- Calls to `Renderer2.setStyle`.
+
+Each of these produces a property that your namespaced styles no longer read. Namespace those
+names yourself, as described in
+[Using namespaced properties in TypeScript](#using-namespaced-properties-in-typescript).
+
+### Opting out of namespacing
+
+To declare or read a custom property that Angular does not namespace, such as one defined in a
+global stylesheet, prefix its name with `--global--`. Angular removes `--global` and leaves the
+remaining `--` and the rest of the name unchanged:
+
+```css
+:host {
+  /* Declares --accent-color and reads --brand-color, not --my-app_brand-color. */
+  --global--accent-color: navy;
+  color: var(--global--brand-color);
+}
+```
+
+Write two hyphens after `global`. A single hyphen, as in `--global-brand-color`, does not opt out,
+and Angular namespaces that name like any other. Avoid names that start with `--global-` followed
+by any
```

---

### Incident Patch 13: `a9d6b2ff` (2026-08-30)
**Commit Message**: fix(compiler): correctly match directives on `<ng-template>` nested in various namespaces

With this commit with correctly detect directive attached to ng-templates in namespaces

fixes #70471

**File**: `packages/compiler-cli/src/ngtsc/typecheck/extended/api/api.ts` (modified, +8/-7)
```diff
@@ -10,15 +10,16 @@ import {
   AbsoluteSourceSpan,
   AST,
   CombinedRecursiveAstVisitor,
+  isNgTemplate,
+  KeyedRead,
+  NonNullAssert,
+  ParenthesizedExpression,
   ParseSourceSpan,
+  SafeCall,
+  SafeKeyedRead,
+  SafePropertyRead,
   TmplAstNode,
   TmplAstTemplate,
-  KeyedRead,
-  SafePropertyRead,
-  SafeKeyedRead,
-  SafeCall,
-  ParenthesizedExpression,
-  NonNullAssert,
 } from '@angular/compiler';
 import ts from 'typescript';
 
@@ -140,7 +141,7 @@ class TemplateVisitor<Code extends ErrorCode> extends CombinedRecursiveAstVisito
   }
 
   override visitTemplate(template: TmplAstTemplate) {
-    const isInlineTemplate = template.tagName === 'ng-template';
+    const isInlineTemplate = template.tagName && isNgTemplate(template.tagName);
     this.visitAllTemplateNodes(template.attributes);
 
     if (isInlineTemplate) {
```

**File**: `packages/compiler-cli/src/ngtsc/typecheck/extended/checks/interpolated_signal_not_invoked/index.ts` (modified, +3/-2)
```diff
@@ -12,6 +12,7 @@ import {
   BindingType,
   Conditional,
   Interpolation,
+  isNgTemplate,
   NonNullAssert,
   ParenthesizedExpression,
   PrefixNot,
@@ -29,10 +30,10 @@ import {ErrorCode, ExtendedTemplateDiagnosticName} from '../../../../diagnostics
 import {NgTemplateDiagnostic, SymbolKind, TypeCheckableDirectiveMeta} from '../../../api';
 import {isSignalReference} from '../../../src/symbol_util';
 import {
+  formatExtendedError,
   TemplateCheckFactory,
   TemplateCheckWithVisitor,
   TemplateContext,
-  formatExtendedError,
 } from '../../api';
 
 /** Names of known signal instance properties. */
@@ -72,7 +73,7 @@ class InterpolatedSignalCheck extends TemplateCheckWithVisitor<ErrorCode.INTERPO
       return node.inputs.flatMap((input) =>
         checkBoundAttribute(ctx, component, directivesOfElement, input),
       );
-    } else if (node instanceof TmplAstTemplate && node.tagName === 'ng-template') {
+    } else if (node instanceof TmplAstTemplate && node.tagName && isNgTemplate(node.tagName)) {
       const directivesOfElement = ctx.templateTypeChecker.getDirectivesOfNode(component, node);
       const inputDiagnostics = node.inputs.flatMap((input) => {
         return checkBoundAttribute(ctx, component, directivesOfElement, input);
```

**File**: `packages/compiler-cli/src/ngtsc/typecheck/extended/test/checks/interpolated_signal_not_invoked/interpolated_signal_not_invoked_spec.ts` (modified, +45/-0)
```diff
@@ -55,6 +55,51 @@ runInEachFileSystem(() => {
     });
   });
 
+  it('should produce a warning when a signal is not invoked in an svg:ng-template', () => {
+    const fileName = absoluteFrom('/main.ts');
+    const {program, templateTypeChecker} = setup([
+      {
+        fileName,
+        declarations: [
+          {
+            type: 'directive',
+            name: 'TestDir',
+            selector: '[dir]',
+            inputs: {
+              myInput: 'myInput',
+            },
+          },
+        ],
+        templates: {
+          'TestCmp': `<svg><ng-template dir myInput="{{mySignal}}"></ng-template></svg>`,
+        },
+        source: `
+          import {signal} from '@angular/core';
+
+          export class TestDir {
+            myInput: any;
+          }
+
+          export class TestCmp {
+            mySignal = signal<number>(0);
+          }`,
+      },
+    ]);
+    const sf = getSourceFileOrError(program, fileName);
+    const component = getClass(sf, 'TestCmp');
+    const extendedTemplateChecker = new ExtendedTemplateCheckerImpl(
+      templateTypeChecker,
+      program.getTypeChecker(),
+      [interpolatedSignalFactory],
+      {} /* options */,
+    );
+    const diags = extendedTemplateChecker.getDiagnosticsForComponent(component);
+    expect(diags.length).toBe(1);
+    expect(diags[0].category).toBe(ts.DiagnosticCategory.Warning);
+    expect(diags[0].code).toBe(ngErrorCode(ErrorCode.INTERPOLATED_SIGNAL_NOT_INVOKED));
+    expect(getSourceCodeForDiagnostic(diags[0])).toBe('mySignal');
+  });
+
   it('should produce a warning when a signal is not invoked', () => {
     const fileName = absoluteFrom('/main.ts');
     const {program, templateTypeChecker} = setup([
```

**File**: `packages/compiler-cli/test/ngtsc/template_typecheck_spec.ts` (modified, +25/-0)
```diff
@@ -9877,6 +9877,31 @@ suppress
         const diags = env.driveDiagnostics();
         expect(diags.length).toBe(0);
       });
+
+      it('should not report unused directives on ng-template nested in an svg element', () => {
+        env.write(
+          'test.ts',
+          `
+          import {Component} from '@angular/core';
+          import {CommonModule} from '@angular/common';
+
+
+          @Component({
+            template: \`
+              <ng-template #foo>foo</ng-template>
+              <svg>
+                <ng-template [ngTemplateOutlet]="foo"></ng-template>
+              </svg>
+            \`,
+            imports: [CommonModule]
+          })
+          export class MyComp {}
+        `,
+        );
+
+        const diags = env.driveDiagnostics();
+        expect(diags.length).toBe(0);
+      });
     });
 
     describe('DOM event target type inference', () => {
```

**File**: `packages/compiler/src/render3/view/util.ts` (modified, +2/-2)
```diff
@@ -8,7 +8,7 @@
 
 import {InputFlags} from '../../core';
 import {BindingType} from '../../expression_parser/ast';
-import {splitNsName} from '../../ml_parser/tags';
+import {isNgTemplate, splitNsName} from '../../ml_parser/tags';
 import * as o from '../../output/output_ast';
 import {CssSelector} from '../../directive_matching';
 import * as t from '../r3_ast';
@@ -201,7 +201,7 @@ export function createCssSelectorFromNode(node: t.Element | t.Template): CssSele
 function getAttrsForDirectiveMatching(elOrTpl: t.Element | t.Template): {[name: string]: string} {
   const attributesMap: {[name: string]: string} = {};
 
-  if (elOrTpl instanceof t.Template && elOrTpl.tagName !== 'ng-template') {
+  if (elOrTpl instanceof t.Template && (!elOrTpl.tagName || !isNgTemplate(elOrTpl.tagName))) {
     elOrTpl.templateAttrs.forEach((a) => (attributesMap[a.name] = ''));
   } else {
     elOrTpl.attributes.forEach((a) => {
```

**File**: `packages/compiler/src/typecheck/ops/bindings.ts` (modified, +2/-1)
```diff
@@ -21,6 +21,7 @@ import {
 import {TcbDirectiveMetadata, TcbInputMapping} from '../api';
 import {Context} from './context';
 import {TcbExpr} from './codegen';
+import {isNgTemplate} from '../../ml_parser/tags';
 
 export interface TcbBoundAttribute {
   value: AST | string;
@@ -119,7 +120,7 @@ export function getBoundAttributes(
   };
 
   if (node instanceof Template) {
-    if (node.tagName === 'ng-template') {
+    if (node.tagName && isNgTemplate(node.tagName)) {
       node.inputs.forEach(processAttribute);
       node.attributes.forEach(processAttribute);
     }
```

**File**: `packages/compiler/test/render3/view/binding_spec.ts` (modified, +16/-0)
```diff
@@ -254,6 +254,22 @@ describe('t2 binding', () => {
     expect(directives[0].name).toBe('Dir');
   });
 
+  it('should match directives on ng-template nested in namespaced elements', () => {
+    const template = parseTemplate(
+      '<svg><ng-template [hasInput]="true"></ng-template></svg>',
+      '',
+      {},
+    );
+    const binder = new R3TargetBinder(makeSelectorMatcher());
+    const res = binder.bind({template: template.nodes});
+    const svgNode = template.nodes[0] as a.Element;
+    const tmplNode = svgNode.children[0] as a.Template;
+    const directives = res.getDirectivesOfNode(tmplNode)!;
+    expect(directives).not.toBeNull();
+    expect(directives.length).toBe(1);
+    expect(directives[0].name).toBe('HasInput');
+  });
+
   it('should not match directives intended for an element on a microsyntax template', () => {
     const template = parseTemplate('<div *ngFor="let item of items" dir></div>', '', {});
     const binder = new R3TargetBinder(makeSelectorMatcher());
```

**File**: `packages/core/test/acceptance/directive_spec.ts` (modified, +10/-0)
```diff
@@ -157,6 +157,16 @@ describe('directives', () => {
       expect(nodesWithDirective.length).toBe(1);
     });
 
+    it('should match directives on ng-template inside of SVG elements', () => {
+      TestBed.configureTestingModule({declarations: [TestComponent, TestDirective]});
+      TestBed.overrideTemplate(TestComponent, `<svg><ng-template test></ng-template></svg>`);
+
+      const fixture = TestBed.createComponent(TestComponent);
+      const nodesWithDirective = fixture.debugElement.queryAllNodes(By.directive(TestDirective));
+
+      expect(nodesWithDirective.length).toBe(1);
+    });
+
     it('should match directives on <ng-container>', () => {
       @Directive({
         selector: 'ng-container[directiveA]',
```

---

### Incident Patch 14: `124f4214` (2026-09-29)
**Commit Message**: refactor(platform-browser): type async animation renderer

Replace unsafe renderer casts with an internal helper that updates the synthetic properties flag without exposing the concrete DOM renderer type.

**File**: `packages/platform-browser/animations/async/src/async_animation_renderer.ts` (modified, +5/-4)
```diff
@@ -28,7 +28,10 @@ import {
   ɵRuntimeError as RuntimeError,
   type ListenerOptions,
 } from '@angular/core';
-import {ɵRuntimeErrorCode as RuntimeErrorCode} from '../../../index';
+import {
+  ɵdisableThrowOnSyntheticProps as disableThrowOnSyntheticProps,
+  ɵRuntimeErrorCode as RuntimeErrorCode,
+} from '../../../index';
 
 const ANIMATION_PREFIX = '@';
 
@@ -125,9 +128,7 @@ export class AsyncAnimationRendererFactory implements OnDestroy, RendererFactory
     }
 
     // We need to prevent the DomRenderer to throw an error because of synthetic properties
-    if (typeof (renderer as any).throwOnSyntheticProps === 'boolean') {
-      (renderer as any).throwOnSyntheticProps = false;
-    }
+    disableThrowOnSyntheticProps(renderer);
 
     // Using a dynamic renderer to switch the renderer implementation once the module is loaded.
     const dynamicRenderer = new DynamicDelegationRenderer(renderer);
```

**File**: `packages/platform-browser/src/dom/dom_renderer.ts` (modified, +6/-0)
```diff
@@ -538,6 +538,12 @@ class DefaultDomRenderer2 implements Renderer2 {
   }
 }
 
+export function disableThrowOnSyntheticProps(renderer: Renderer2): void {
+  if (renderer instanceof DefaultDomRenderer2) {
+    renderer.throwOnSyntheticProps = false;
+  }
+}
+
 const AT_CHARCODE = (() => '@'.charCodeAt(0))();
 
 function checkNoSyntheticProp(name: string, nameKind: string) {
```

**File**: `packages/platform-browser/src/private_export.ts` (modified, +4/-1)
```diff
@@ -9,7 +9,10 @@
 export {ɵgetDOM} from '@angular/common';
 export {BrowserDomAdapter as ɵBrowserDomAdapter} from './browser/browser_adapter';
 export {BrowserGetTestability as ɵBrowserGetTestability} from './browser/testability';
-export {DomRendererFactory2 as ɵDomRendererFactory2} from './dom/dom_renderer';
+export {
+  disableThrowOnSyntheticProps as ɵdisableThrowOnSyntheticProps,
+  DomRendererFactory2 as ɵDomRendererFactory2,
+} from './dom/dom_renderer';
 export {DomEventsPlugin as ɵDomEventsPlugin} from './dom/events/dom_events';
 export {KeyEventsPlugin as ɵKeyEventsPlugin} from './dom/events/key_events';
 export {SharedStylesHost as ɵSharedStylesHost} from './dom/shared_styles_host';
```

---

### Incident Patch 15: `c58464d1` (2026-09-28)
**Commit Message**: fix(forms): write a pending debounced value when its control is destroyed

With `debounce(path, 'blur')` the value is only written when the control
is blurred. If the focused control is destroyed first, browsers that do
not fire `blur` on removal (e.g. Safari) never write it, and the typed
value is lost.

Flush the pending value when the control is destroyed or bound to
another field, unless the field itself was removed or another control is
still bound to it.

Fixes #71004

**File**: `packages/forms/signals/src/directive/form_field.ts` (modified, +7/-3)
```diff
@@ -335,9 +335,13 @@ export class FormField<T> {
           this as FormField<unknown>,
         ]);
         onCleanup(() => {
-          fieldNode.nodeState.formFieldBindings.update((controls) =>
-            controls.filter((c) => c !== this),
-          );
+          const remaining = fieldNode.nodeState.formFieldBindings().filter((c) => c !== this);
+          fieldNode.nodeState.formFieldBindings.set(remaining);
+          // Once the last control is gone, nothing can blur anymore, so write any value still
+          // waiting for a blur debounce (e.g. `debounce(path, 'blur')`).
+          if (remaining.length === 0 && !fieldNode.structure.isOrphaned()) {
+            fieldNode.flushSync();
+          }
         });
       },
       {injector: this.injector},
```

**File**: `packages/forms/signals/src/field/node.ts` (modified, +2/-3)
```diff
@@ -117,8 +117,7 @@ export class FieldNode implements FieldState<unknown> {
    * first focusable binding in the DOM for any descendant node of this one.
    */
   private getBindingForFocus():
-    | (FormField<unknown> & {focus: (options?: FocusOptions) => void})
-    | undefined {
+    (FormField<unknown> & {focus: (options?: FocusOptions) => void}) | undefined {
     // First try to focus one of our own bindings.
     const own = this.formFieldBindings()
       .filter(
@@ -411,7 +410,7 @@ export class FieldNode implements FieldState<unknown> {
   /**
    * If there is a pending sync, abort it and sync immediately.
    */
-  private flushSync() {
+  flushSync() {
     const pending = this.pendingSync();
     if (pending && !pending.signal.aborted) {
       pending.abort();
```

**File**: `packages/forms/signals/test/web/form_field.spec.ts` (modified, +121/-0)
```diff
@@ -42,6 +42,7 @@ function isFirefox() {
 
 import {NG_STATUS_CLASSES} from '../../compat/public_api';
 import {
+  applyEach,
   debounce,
   disabled,
   form,
@@ -6146,6 +6147,126 @@ describe('field directive', () => {
       expect(input.value).toBe('initial');
       expect(cmp.f().value()).toEqual({child: 'initial'});
     });
+
+    it('should write a value pending a blur debounce when the control is destroyed', () => {
+      @Component({
+        imports: [FormField],
+        template: `
+          @if (show()) {
+            <input [formField]="f" />
+          }
+        `,
+      })
+      class TestCmp {
+        readonly show = signal(true);
+        readonly f = form(signal('initial'), (p) => {
+          debounce(p, 'blur');
+        });
+      }
+
+      const fixture = act(() => TestBed.createComponent(TestCmp));
+      const input = fixture.nativeElement.querySelector('input');
+      const cmp = fixture.componentInstance;
+
+      act(() => {
+        input.value = 'typing';
+        input.dispatchEvent(new Event('input'));
+      });
+      expect(cmp.f().value()).toBe('initial');
+
+      act(() => cmp.show.set(false));
+      expect(cmp.f().value()).toBe('typing');
+      expect(cmp.f().touched()).toBe(false);
+    });
+
+    it('should write a value pending a blur debounce when the control is bound to another field', () => {
+      @Component({
+        imports: [FormField],
+        template: `<input [formField]="useFirst() ? f.first : f.second" />`,
+      })
+      class TestCmp {
+        readonly useFirst = signal(true);
+        readonly f = form(signal({first: '', second: ''}), (p) => {
+          debounce(p.first, 'blur');
+        });
+      }
+
+      const fixture = act(() => TestBed.createComponent(TestCmp));
+      const input = fixture.nativeElement.querySelector('input');
+      const cmp = fixture.componentInstance;
+
+      act(() => {
+        input.value = 'typing';
+        input.dispatchEvent(new Event('input'));
+      });
+      expect(cmp.f().value()).toEqual({first: '', second: ''});
+
+      act(() => cmp.useFirst.set(false));
+      expect(cmp.f().value()).toEqual({first: 'typing', second: ''});
+    });
+
+    it('should not write a value pending a blur debounce when its field is removed', () => {
+      @Component({
+        imports: [FormField],
+        template: `
+          @for (item of f; track $index) {
+            <input [formField]="item" />
+          }
+        `,
+      })
+      class TestCmp {
+        readonly model = signal(['a', 'b']);
+        readonly f = form(this.model, (p) => {
+          applyEach(p, (item) => debounce(item, 'blur'));
+        });
+      }
+
+      const fixture = act(() => TestBed.createComponent(TestCmp));
+      const input = fixture.nativeElement.querySelectorAll('input')[1];
+      const cmp = fixture.componentInstance;
+
+      act(() => {
+        input.value = 'typing';
+        input.dispatchEvent(new Event('input'));
+      });
+
+      act(() => cmp.model.set(['a']));
+      expect(cmp.model()).toEqual(['a']);
+    });
+
+    it('should not write a value pending a blur debounce while another control is still bound', () => {
+      @Component({
+        imports: [FormField],
+        template: `
+          @if (show()) {
+            <input id="first" [formField]="f" />
+          }
+          <input id="second" [formField]="f" />
+        `,
+      })
+      class TestCmp {
+        readonly show = signal(true);
+        readonly f = form(signal('initial'), (p) => {
+          debounce(p, 'blur');
+        });
+      }
+
+      const fixture = act(() => TestBed.createComponent(TestCmp));
+      const second = fixture.nativeElement.querySelector('input#second');
+      const cmp = fixture.componentInstance;
+
+      act(() => {
+        second.value = 'typing';
+        second.dispatchEvent(new Event('input'));
+      });
+      expect(cmp.f().value()).toBe('initial');
+
+      act(() => cmp.show.set(false));
+      expect(cmp.f().value()).toBe('initial');
+
+      act(() => second.dispatchEvent(new Event('blur')));
+      expect(cmp.f().value()).toBe('typing');
+    });
   });
 
   describe('config', () => {
```

#### Recent Merged Pull Requests:
- **PR #71192** (closed): docs(docs-infra): modernize remaining shared-docs tests (@MeAkib)
- **PR #71183** (closed): fix(router): bound navigation restarts caused by cyclic redirects (@kemrec)
- **PR #71180** (closed): docs(router): use computed for fine-grained route resource params (@MeAkib)
- **PR #71175** (2026-10-05): refactor(docs-infra): add an illustration to the Angular Aria header (@erkamyaman)
- **PR #71174** (2026-10-05): docs: fix code examples that fail to compile or run in the guides (@erkamyaman)
- **PR #71171** (closed): fix(forms): throw a coded error for missing controls in production (@ManoharPaturi)
- **PR #71170** (closed): fix(router): skip dot segments in any part of the first command (@ManoharPaturi)
- **PR #71169** (closed): fix(service-worker): fall back on the network when assigning a version fails (@ManoharPaturi)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
