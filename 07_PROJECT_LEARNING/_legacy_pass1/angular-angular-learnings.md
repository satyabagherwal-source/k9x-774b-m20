# Forensic Learning Record (Deep Inspection): angular/angular

> **Canonical Artifact**: `07_PROJECT_LEARNING/angular-angular-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/angular/angular](https://github.com/angular/angular))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-09-30T17:16:33.285Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `angular/angular`
- **Description**: Deliver web apps with confidence 🚀
- **Primary Language / Ecosystem**: TypeScript
- **Discovered Manifests / Configurations**: package.json, README.md
- **Stars / Engagement**: 101029 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: package.json, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `.ng-dev/caretaker.mjs`
```
/**
 * The configuration for `ng-dev caretaker` commands.
 *
 * @type { import("@angular/ng-dev").CaretakerConfig }
 */
export const caretaker = {
  g3SyncConfigPath: './.ng-dev/google-sync-config.json',
  githubQueries: [
    {
      name: 'Merge Queue',
      query: `is:pr is:open label:"action: merge"`,
    },
    {
      name: 'Merge Assistance Queue',
      query: `is:pr is:open label:"merge: caretaker note" label:"action: merge"`,
    },
    {
      name: 'Initial Triage Queue',
      query: `is:open no:milestone -draft:true`,
    },
  ],
  hasEmeaCaretaker: true,
};

```

### Core Architecture Module: `.ng-dev/commit-message.mjs`
```
/**
 * The configuration for `ng-dev commit-message` commands.
 *
 * @type { import("@angular/ng-dev").CommitMessageConfig }
 */
export const commitMessage = {
  maxLineLength: Infinity,
  minBodyLength: 20,
  minBodyLengthTypeExcludes: ['docs'],
  // If you update this, also update the docs.
  // https://github.com/angular/angular/blob/main/contributing-docs/commit-message-guidelines.md#scope
  scopes: [
    'animations',
    'benchpress',
    'common',
    'compiler',
    'compiler-cli',
    'core',
    'dev-infra',
    'devtools',
    'docs-infra',
    'elements',
    'forms',
    'http',
    'language-service',
    'language-server',
    'localize',
    'migrations',
    'platform-browser',
    'platform-browser-dynamic',
    'platform-server',
    'router',
    'service-worker',
    'upgrade',
    'vscode-extension',
    'zone.js',
  ],
};

```

### Core Architecture Module: `.ng-dev/config.mjs`
```
import {caretaker} from './caretaker.mjs';
import {commitMessage} from './commit-message.mjs';
import {format} from './format.mjs';
import {github} from './github.mjs';
import {pullRequest} from './pull-request.mjs';
import {release} from './release.mjs';

export {commitMessage, format, github, pullRequest, caretaker, release};

```

### Core Architecture Module: `.ng-dev/format.mjs`
```
/**
 * Configuration for the `ng-dev format` command.
 *
 * @type { import("@angular/ng-dev").FormatConfig }
 */
export const format = {
  'prettier': true,
  'buildifier': true,
};

```

### Core Architecture Module: `.ng-dev/github.mjs`
```
/**
 * Github configuration for the `ng-dev` command. This repository is used as
 * remote for the merge script and other utilities like `ng-dev pr rebase`.
 *
 * @type { import("@angular/ng-dev").GithubConfig }
 */
export const github = {
  owner: 'angular',
  name: 'angular',
  mainBranchName: 'main',
  mergeMode: 'caretaker-only',
  requireReleaseModeForRelease: false,
};

```

### Core Architecture Module: `.ng-dev/pull-request.mjs`
```
/**
 * Configuration for the merge tool in `ng-dev`. This sets up the labels which
 * are respected by the merge script (e.g. the target labels).
 *
 * @type { import("@angular/ng-dev").PullRequestConfig }
 */
export const pullRequest = {
  githubApiMerge: {
    default: 'auto',
    labels: [{pattern: 'merge: squash commits', method: 'squash'}],
  },
  requiredBaseCommits: {
    // PRs that target either `main` or the patch branch, need to be rebased
    // on top of the latest commit message validation fix.
    // These SHAs are the commits that update the required license text in the header.
    'main': '5aeb9a4124922d8ac08eb73b8f322905a32b0b3a',
    '10.0.x': '27b95ba64a5d99757f4042073fd1860e20e3ed24',
  },
  // `docs-infra` are not affecting the public NPM packages.
  targetLabelExemptScopes: ['docs-infra'],
  // enables specific validations during the pull request merge process
  validators: {
    assertEnforceTested: true,
    assertIsolatedSeparateFiles: true,
  },

  requiredStatuses: [
    {type: 'check', name: 'test'},
    {type: 'check', name: 'lint'},
    {type: 'check', name: 'adev'},
    {type: 'check', name: 'zone-js'},
    {type: 'status', name: 'google-internal-tests'},
  ],
};

```

### Core Architecture Module: `.ng-dev/release.mjs`
```
/**
 * Configuration for the `ng-dev release` command.
 *
 * @type { import("@angular/ng-dev").ReleaseConfig }
 */
export const release = {
  publishRegistry: 'https://wombat-dressing-room.appspot.com',
  representativeNpmPackage: '@angular/core',
  npmPackages: [
    {
      name: '@angular/animations',
      deprecated: {
        version: '>=20.2.0-next.3',
        message:
          '@angular/animations is deprecated. Use `animate.enter` and `animate.leave` instead. For more information see: https://v22.angular.dev/guide/animations.',
      },
    },
    {name: '@angular/common'},
    {name: '@angular/compiler-cli'},
    {name: '@angular/compiler'},
    {name: '@angular/core'},
    {name: '@angular/elements'},
    {name: '@angular/forms'},
    {name: '@angular/language-server'},
    {name: '@angular/language-service'},
    {name: '@angular/localize'},
    {
      name: '@angular/platform-browser-dynamic',
      deprecated: {
        version: '>=20.1.0-next.0',
        message:
          '@angular/platform-browser-dynamic is deprecated. Use `@angular/platform-browser` instead.',
      },
    },
    {name: '@angular/platform-browser'},
    {name: '@angular/platform-server'},
    {name: '@angular/router'},
    {name: '@angular/service-worker'},
    {name: '@angular/upgrade'},
  ],
  buildPackages: async () => {
    // The buildTargetPackages function is loaded at runtime as the loading the script
    // causes an invocation of Bazel.
    const {performNpmReleaseBuild} = await import('../scripts/build/package-builder.mts');
    return performNpmReleaseBuild();
  },
  releaseNotes: {
    hiddenScopes: [
      'dev-infra',
      'docs-infra',
      'zone.js',
      'devtools',
      'vscode-extension',
      'benchpress',
    ],
  },
  releasePrLabels: ['area: build & ci', 'action: merge', 'PullApprove: disable'],
};

```

### Core Architecture Module: `adev/src/app/app-scroller.ts`
```
/*!
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.dev/license
 */
import {isPlatformBrowser, ViewportScroller} from '@angular/common';
import {
  inject,
  ApplicationRef,
  afterNextRender,
  EnvironmentInjector,
  Injector,
  DestroyRef,
  PLATFORM_ID,
  Service,
} from '@angular/core';
import {Scroll, Router} from '@angular/router';
import {filter, firstValueFrom, map, switchMap, tap} from 'rxjs';

@Service()
export class AppScroller {
  private readonly router = inject(Router);
  private readonly viewportScroller = inject(ViewportScroller);
  private readonly appRef = inject(ApplicationRef);
  private readonly injector = inject(EnvironmentInjector);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  private _lastScrollEvent?: Scroll;
  private canScroll = false;
  private cancelScroll?: () => void;

  get lastScrollEvent(): Scroll | undefined {
    return this._lastScrollEvent;
  }

  constructor() {
    if (this.isBrowser) {
      this.setupScrollRestoration();
    }
  }

  private setupScrollRestoration(): void {
    let windowWidth = window.innerWidth;
    // Setting up a ResizeObserver to update the width on resize. (without triggering a reflow)
    const windowSizeObserver = new ResizeObserver((entries) => {
      windowWidth = entries[0].contentRect.width;
    });
    windowSizeObserver.observe(document.documentElement);
    inject(DestroyRef).onDestroy(() => windowSizeObserver.disconnect());

    const root = document.documentElement; // or any element with the variable
    const styles = getComputedStyle(root);
    // slice to drop the 'px'
    const xsBreakpoint = +styles.getPropertyValue('--screen-xs').slice(0, -2);
    const mdBreakpoint = +styles.getPropertyValue('--screen-md').slice(0, -2);

    this.viewportScroller.setHistoryScrollRestoration('manual');
    this.router.events
      .pipe(
        filter((e): e is Scroll => e instanceof Scroll),
        tap((e) => {
          this.cancelScroll?.();
          this.canScroll = true;
          this._lastScrollEvent = e;
        }),
        filter((e) => e.scrollBehavior !== 'manual'),
        switchMap((e) => {
          return firstValueFrom(
            this.appRef.isStable.pipe(
              filter((stable) => stable),
              map(() => e),
            ),
          );
        }),
      )
      .subscribe(() => {
        this.scroll();
      });

    if (windowWidth < xsBreakpoint) {
      this.viewportScroller.setOffset([0, 64]);
    } else if (windowWidth <= mdBreakpoint) {
      this.viewportScroller.setOffset([0, 140]);
    } else {
      this.viewportScroller.setOffset([0, 24]);
    }
  }

  private scroll(injector?: Injector) {
    if (!this._lastScrollEvent || !this.canScroll) {
      return;
    }
    // Prevent double scrolling on the same event
    this.canScroll = false;
    const {anchor, position} = this._lastScrollEvent;

    // Don't scroll during rendering
    const ref = afterNextRender(
      {
        write: () => {
          if (position) {
            this.viewportScroller.scrollToPosition(position);
          } else if (anchor) {
            this.viewportScroller.scrollToAnchor(anchor);
          } else {
            this.viewportScroller.scrollToPosition([0, 0]);
          }
        },
      },
      // Use the component injector when provided so that the manager can
      // deregister the sequence once the component is destroyed.
      {injector: injector ?? this.injector},
    );
    this.cancelScroll = () => {
      ref.destroy();
    };
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

### Incident Patch 1: `4fa5ce03` (2026-09-30)
**Commit Message**: docs: fix afterRenderEffect phase example in the effect guide

The render phases section said phases are specified by passing an object
with a `phase` property to `afterRender` or `afterNextRender`. `afterRender`
was renamed to `afterEveryRender` and the `phase` option no longer exists;
the example shows the spec object accepted by `afterRenderEffect`.

Also fix `nativeElement` being called as a function in the chart example.

**File**: `adev/src/content/guide/signals/effect.md` (modified, +2/-2)
```diff
@@ -129,7 +129,7 @@ export class MyFancyChart {
     // Run a single time to create the chart instance
     afterNextRender({
       write: () => {
-        this.chart = initializeChart(this.canvas().nativeElement(), this.chartData());
+        this.chart = initializeChart(this.canvas().nativeElement, this.chartData());
       },
     });
 
@@ -162,7 +162,7 @@ The phases are:
 
 Using these phases helps prevent layout thrashing and ensures that your DOM operations are performed in a safe and efficient manner.
 
-You can specify the phase by passing an object with a `phase` property to `afterRender` or `afterNextRender`:
+You can specify the phases by passing an object with a callback for each phase to `afterRenderEffect`:
 
 ```ts
 afterRenderEffect({
```

---

### Incident Patch 2: `b6bf6504` (2026-09-29)
**Commit Message**: fix(router): require outlets to match a route before processing child segments

Previously, empty-path outlet groups in a request URL (such as `x:/(detail:2)`,
`///(detail:2)`, or `x:/()`) were allowed to match without a corresponding
route for that outlet name in the route configuration:

1. `processChildren` called `processSegmentGroup` for each child outlet,
   which immediately delegated any zero-segment group with children back to
   `processChildren` against the same parent `config` and `parentRoute`
   without matching a route. Calling `processSegment` directly in
   `processChildren` ensures only the root `UrlSegmentGroup` short-circuits
   to `processChildren`.
2. `processSegmentAgainstRoute` allowed named outlets to pierce empty-path
   routes for other outlets even when the route had no children to pierce into
   or the URL segment group had no segments or children to pierce with.
3. `matchSegmentAgainstRoute` branched into `processChildren` or returned a
   completed leaf match before `getOutlet(route) === outlet` was satisfied,
   and did not require a descendant `TreeNode` match when piercing an
   empty-path route for a different outlet.
4. `noLeftoversInUrl` only ch

**File**: `packages/router/src/recognize.ts` (modified, +19/-6)
```diff
@@ -226,14 +226,18 @@ export class Recognizer {
       // appear first, followed by routes for other outlets, which might match if they have
       // an empty path.
       const sortedConfig = sortByMatchingOutlets(config, childOutlet);
-      const outletChildren = await this.processSegmentGroup(
+      const outletChild = await this.processSegment(
         injector,
         sortedConfig,
         child,
+        child.segments,
         childOutlet,
+        true,
         parentRoute,
       );
-      children.push(...outletChildren);
+      if (outletChild instanceof TreeNode) {
+        children.push(outletChild);
+      }
     }
 
     // Because we may have matched two outlets to the same empty path segment, we can have
@@ -302,7 +306,12 @@ export class Recognizer {
     // This should only match if the url is `/(x:b)`.
     if (
       getOutlet(route) !== outlet &&
-      (outlet === PRIMARY_OUTLET || !emptyPathMatch(rawSegment, segments, route))
+      (outlet === PRIMARY_OUTLET ||
+        !emptyPathMatch(rawSegment, segments, route) ||
+        // the route has no children to pierce into.
+        (!route.children?.length && !route.loadChildren) ||
+        // the URL segment group has no segments or children to pierce with.
+        (segments.length === 0 && !rawSegment.hasChildren()))
     ) {
       throw new NoMatch(rawSegment);
     }
@@ -453,7 +462,9 @@ export class Recognizer {
       outlet,
     );
 
-    if (slicedSegments.length === 0 && segmentGroup.hasChildren()) {
+    const matchedOnOutlet = getOutlet(route) === outlet;
+
+    if (matchedOnOutlet && slicedSegments.length === 0 && segmentGroup.hasChildren()) {
       const children = await this.processChildren(
         childInjector,
         childConfig,
@@ -463,11 +474,10 @@ export class Recognizer {
       return new TreeNode(snapshot, children);
     }
 
-    if (childConfig.length === 0 && slicedSegments.length === 0) {
+    if (matchedOnOutlet && childConfig.length === 0 && slicedSegments.length === 0) {
       return new TreeNode(snapshot, []);
     }
 
-    const matchedOnOutlet = getOutlet(route) === outlet;
     // If we matched a config due to empty path match on a different outlet, we need to
     // continue passing the current outlet for the segment rather than switch to PRIMARY.
     // Note that we switch to primary when we have a match because outlet configs look like
@@ -485,6 +495,9 @@ export class Recognizer {
       true,
       snapshot,
     );
+    if (!matchedOnOutlet && !(child instanceof TreeNode)) {
+      throw new NoMatch(rawSegment);
+    }
     return new TreeNode(snapshot, child instanceof TreeNode ? [child] : []);
   }
   private async getChildConfig(
```

**File**: `packages/router/src/utils/config_matching.ts` (modified, +1/-1)
```diff
@@ -241,5 +241,5 @@ export function noLeftoversInUrl(
   segments: UrlSegment[],
   outlet: string,
 ): boolean {
-  return segments.length === 0 && !segmentGroup.children[outlet];
+  return segments.length === 0 && !segmentGroup.hasChildren();
 }
```

**File**: `packages/router/test/recognize.spec.ts` (modified, +154/-6)
```diff
@@ -579,6 +579,155 @@ describe('recognize', () => {
         ).recognize();
         await expectAsync(recognizePromise).toBeRejected();
       });
+
+      it('does not evaluate sibling routes under unconfigured zero-segment outlets', async () => {
+        let canMatchCalls = 0;
+        const config = [
+          {
+            path: 'a',
+            children: [
+              {
+                path: '',
+                outlet: 'detail',
+                children: [
+                  {
+                    path: ':id',
+                    component: ComponentA,
+                    canMatch: [
+                      () => {
+                        canMatchCalls++;
+                        return true;
+                      },
+                    ],
+                  },
+                ],
+              },
+            ],
+          },
+        ];
+        await expectAsync(
+          recognize(config, 'a/(detail:1//x0:/(detail:2)//x1:/(detail:3)//x2:/(detail:4))'),
+        ).toBeRejectedWithError(/Cannot match any routes/);
+        expect(canMatchCalls).toBe(1);
+
+        canMatchCalls = 0;
+        await expectAsync(
+          recognize(config, 'a/(detail:1///(detail:2///(detail:3)))'),
+        ).toBeRejectedWithError(/Cannot match any routes/);
+        expect(canMatchCalls).toBe(0);
+      });
+
+      it('does not match empty-path primary routes against unconfigured outlets', async () => {
+        let canMatchCalls = 0;
+        const s1 = await recognize(
+          [
+            {
+              path: 'a',
+              children: [
+                {
+                  path: '',
+                  component: ComponentA,
+                  canMatch: [
+                    () => {
+                      canMatchCalls++;
+                      return true;
+                    },
+                  ],
+                },
+              ],
+            },
+          ],
+          'a/(x0:/()//x1:/()//x2:/())',
+        );
+        expect(canMatchCalls).toBe(1);
+        expect(s1.root.firstChild!.children.length).toBe(1);
+
+        canMatchCalls = 0;
+        const s2 = await recognize(
+          [
+            {
+              path: 'shop',
+              children: [
+                {
+                  path: '',
+                  canMatch: [
+                    () => {
+                      canMatchCalls++;
+                      return true;
+                    },
+                  ],
+                  children: [{path: '', component: ComponentA}],
+                },
+              ],
+            },
+          ],
+          'shop/(a:/()//b:/()//c:/())',
+        );
+        expect(canMatchCalls).toBe(1);
+        expect(s2.root.firstChild!.children.length).toBe(1);
+      });
+
+      it('allows navigation when an empty-path named outlet child fails canMatch', async () => {
+        const config = [
+          {
+            path: 'dashboard',
+            component: ComponentA,
+            children: [
+              {path: 'home', component: ComponentC},
+              {
+                path: '',
+                outlet: 'aux',
+                component: ComponentB,
+                canMatch: [() => false],
+              },
+            ],
+          },
+        ];
+
+        const s1 = await recognize(config, 'dashboard');
+        checkActivatedRoute(s1.root.firstChild!, 'dashboard', {}, ComponentA);
+        expect(s1.root.firstChild!.children.length).toBe(0);
+
+        const s2 = await recognize(config, 'dashboard/home');
+        checkActivatedRoute(s2.root.firstChild!, 'dashboard', {}, ComponentA);
+        expect(s2.root.firstChild!.children.length).toBe(1);
+        checkActivatedRoute(s2.root.firstChild!.firstChild!, 'home', {}, ComponentC);
+
+        const s3 = await recognize(
+          [
+            {path: '', outlet: 'aux', canMatch: [() => false], component: ComponentA},
+            {path: '', children: [{path: '', outlet: 'aux', component: ComponentB}]},
+         
```

---

### Incident Patch 3: `d7d81e18` (2026-09-30)
**Commit Message**: fix(platform-server): reject protocol-relative paths in resolveUrl

Previously, resolveUrl only checked whether the raw URL string started with '//' before WHATWG URL resolution. When given an input such as '/.//evil.test', WHATWG dot-segment normalization popped the leading '/.', leaving a pathname starting with '//'. This corrupted ServerPlatformLocation and led to protocol-relative open redirects in SSR.

Now, resolveUrl also verifies that the normalized URL pathname does not start with '//' when allowProtocolRelative is false.

Fixes #71076

**File**: `packages/platform-server/src/url.ts` (modified, +32/-6)
```diff
@@ -75,6 +75,10 @@ export function resolveUrl(
   const {allowProtocolRelative = false, allowOriginChange = true} = options;
 
   if (resolved) {
+    if (isDisallowedProtocolRelative(resolved, allowProtocolRelative)) {
+      throwProtocolRelativeUrlError(urlStr);
+    }
+
     if (originUrl && !isSafeOriginChange(resolved, originUrl, urlStr, allowOriginChange)) {
       throwSuspiciousUrlError(urlStr);
     }
@@ -102,26 +106,48 @@ export function resolveUrl(
   // and we are configured to allow and preserve standard cross-origin protocol-relative requests.
   if (urlStr.startsWith('//')) {
     if (!allowProtocolRelative) {
-      throw new RuntimeError(
-        RuntimeErrorCode.PROTOCOL_RELATIVE_URL_NOT_ALLOWED,
-        typeof ngDevMode === 'undefined' || ngDevMode
-          ? `Protocol relative URLs are not allowed in this context. URL: ${urlStr}`
-          : urlStr,
-      );
+      throwProtocolRelativeUrlError(urlStr);
     }
 
     return new URL(urlStr, origin);
   }
 
   resolved = new URL(urlStr, origin);
 
+  if (isDisallowedProtocolRelative(resolved, allowProtocolRelative)) {
+    throwProtocolRelativeUrlError(urlStr);
+  }
+
   if (!isSafeOriginChange(resolved, originUrl, urlStr, allowOriginChange)) {
     throwSuspiciousUrlError(urlStr);
   }
 
   return resolved;
 }
 
+/**
+ * Checks if the resolved URL has a disallowed protocol-relative path.
+ *
+ * @param resolved The resolved URL.
+ * @param allowProtocolRelative Whether protocol-relative URLs are allowed.
+ * @returns True if the URL has a disallowed protocol-relative path, false otherwise.
+ */
+function isDisallowedProtocolRelative(resolved: URL, allowProtocolRelative: boolean): boolean {
+  return !allowProtocolRelative && resolved.pathname.startsWith('//');
+}
+
+/**
+ * Throws a protocol-relative URL error indicating that protocol-relative URLs are not allowed.
+ */
+function throwProtocolRelativeUrlError(urlStr: string): never {
+  throw new RuntimeError(
+    RuntimeErrorCode.PROTOCOL_RELATIVE_URL_NOT_ALLOWED,
+    typeof ngDevMode === 'undefined' || ngDevMode
+      ? `Protocol relative URLs are not allowed in this context. URL: ${urlStr}`
+      : urlStr,
+  );
+}
+
 /**
  * Throws a suspicious URL error indicating a security bypass attempt.
  */
```

**File**: `packages/platform-server/test/url_spec.ts` (modified, +28/-0)
```diff
@@ -69,6 +69,34 @@ describe('resolveUrl', () => {
       expect(() => resolveUrl(url, 'http://test.com')).toThrowError(/NG05703/);
     });
 
+    it('should throw on protocol-relative URLs when allowProtocolRelative is false or default', () => {
+      const urls = [
+        '//attacker.example/collect',
+        '///attacker.example/collect',
+        '/.//attacker.example/collect',
+        '/..//attacker.example/collect',
+        '/.\\/attacker.example/collect',
+        'http://test.com/.//attacker.example/collect',
+      ];
+
+      for (const url of urls) {
+        expect(() => resolveUrl(url, 'http://test.com')).toThrowError(/NG05702/);
+      }
+    });
+
+    it('should allow protocol-relative URLs when allowProtocolRelative is true', () => {
+      const url = resolveUrl('//attacker.example/collect', 'http://test.com', {
+        allowProtocolRelative: true,
+      });
+      expect(url.href).toBe('http://attacker.example/collect');
+      expect(url.origin).toBe('http://attacker.example');
+
+      const dotUrl = resolveUrl('/.//attacker.example/collect', 'http://test.com', {
+        allowProtocolRelative: true,
+      });
+      expect(dotUrl.href).toBe('http://test.com//attacker.example/collect');
+    });
+
     it('should not trim unicode whitespace into protocol-relative URLs', () => {
       const urls = ['\u00A0//attacker.example/collect', '\uFEFF//attacker.example/collect'];
 
```

---

### Incident Patch 4: `fc9b2d64` (2026-09-30)
**Commit Message**: Revert "fix(core): block dangerous data: and vbscript: URLs in URL sanitizer"

This reverts commit e96936a57fe4f07f8155e5a500cec5adeb6341be.

**File**: `packages/core/src/sanitization/html_sanitizer.ts` (modified, +1/-3)
```diff
@@ -195,9 +195,7 @@ class SanitizingHtmlSerializer {
         continue;
       }
       let value = elAttr!.value;
-      // Note: data: URIs with dangerous subtypes (e.g. data:text/html) are now blocked
-      // by _sanitizeUrl, while safe media subtypes (data:image/*, data:video/*, data:audio/*)
-      // are still allowed.
+      // TODO(martinprobst): Special case image URIs for data:image/...
       if (URI_ATTRS[lower]) value = _sanitizeUrl(value);
       this.buf.push(' ', attrName, '="', encodeEntities(value), '"');
     }
```

**File**: `packages/core/src/sanitization/url_sanitizer.ts` (modified, +4/-14)
```diff
@@ -15,11 +15,8 @@ import {XSS_SECURITY_URL} from '../error_details_base_url';
  * This regular expression matches a subset of URLs that will not cause script
  * execution if used in URL context within a HTML document. Specifically, this
  * regular expression matches if:
- * (1) Either a protocol that is not javascript: or vbscript:, and that has
- *     valid characters (alphanumeric or [+-.]).
- *     For data: URIs, only safe media subtypes (image/*, video/*, audio/*)
- *     are allowed. Other data: subtypes (e.g. data:text/html) are blocked
- *     as they can lead to script execution in some environments.
+ * (1) Either a protocol that is not javascript:, and that has valid characters
+ *     (alphanumeric or [+-.]).
  * (2) or no protocol.  A protocol must be followed by a colon. The below
  *     allows that by allowing colons only after one of the characters [/?#].
  *     A colon after a hash (#) must be in the fragment.
@@ -36,16 +33,9 @@ import {XSS_SECURITY_URL} from '../error_details_base_url';
  * that. More importantly, it disallows masking of a colon,
  * e.g. "javascript&#58;...".
  *
- * This regular expression was originally taken from the Closure sanitization
- * library and extended to also block vbscript: and dangerous data: subtypes.
- *
- * Note: data:image/svg+xml is allowed because SVG loaded via <img src> is
- * sandboxed by browsers (scripts do not execute). For <a href> contexts,
- * modern browsers (Chrome 60+, Firefox 59+) block top-level navigation to
- * data: URLs entirely, providing an additional layer of defense.
+ * This regular expression was taken from the Closure sanitization library.
  */
-const SAFE_URL_PATTERN =
-  /^(?!javascript:)(?!vbscript:)(?!data:(?!image\/|video\/|audio\/))(?:[a-z0-9+.-]+:|[^&:\/?#]*(?:[\/?#]|$))/i;
+const SAFE_URL_PATTERN = /^(?!javascript:)(?:[a-z0-9+.-]+:|[^&:\/?#]*(?:[\/?#]|$))/i;
 export function _sanitizeUrl(url: string): string {
   url = String(url);
   if (url.match(SAFE_URL_PATTERN)) return url;
```

**File**: `packages/core/test/sanitization/url_sanitizer_spec.ts` (modified, +1/-27)
```diff
@@ -46,8 +46,6 @@ describe('URL sanitizer', () => {
       'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/', // Truncated.
       'data:video/webm;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/',
       'data:audio/opus;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/',
-      'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciPjwvc3ZnPg==',
-      'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7',
       'unknown-scheme:abc',
     ];
     for (const url of validUrls) {
@@ -70,31 +68,7 @@ describe('URL sanitizer', () => {
       'jav\u0000ascript:alert();',
     ];
     for (const url of invalidUrls) {
-      it(`invalid ${url}`, () => expect(_sanitizeUrl(url)).toMatch(/^unsafe:/));
-    }
-  });
-
-  describe('vbscript URLs', () => {
-    const vbscriptUrls = ['vbscript:MsgBox("XSS")', 'VBScript:alert()', 'VBSCRIPT:MsgBox("XSS")'];
-    for (const url of vbscriptUrls) {
-      it(`blocks ${url}`, () => expect(_sanitizeUrl(url)).toMatch(/^unsafe:/));
-    }
-  });
-
-  describe('dangerous data: URLs', () => {
-    const dangerousDataUrls = [
-      'data:text/html,<script>alert(1)</script>',
-      'data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg==',
-      'data:application/xhtml+xml,<script>alert(1)</script>',
-      'data:text/xml,<script>alert(1)</script>',
-      'DATA:text/html,<script>alert(1)</script>',
-      'data:,<script>alert(1)</script>',
-      'data:application/javascript,alert(1)',
-      'data:text/plain,hello',
-      'data:application/pdf;base64,abc',
-    ];
-    for (const url of dangerousDataUrls) {
-      it(`blocks ${url}`, () => expect(_sanitizeUrl(url)).toMatch(/^unsafe:/));
+      it(`valid ${url}`, () => expect(_sanitizeUrl(url)).toMatch(/^unsafe:/));
     }
   });
 });
```

---

### Incident Patch 5: `bab72b9f` (2026-09-30)
**Commit Message**: Revert "fix(core): extend data: URL allowlist for non-executable MIME types"

This reverts commit 2b89a3ba5a96359544e307b07e8c04c77119fffa.

**File**: `packages/core/src/sanitization/url_sanitizer.ts` (modified, +4/-6)
```diff
@@ -17,11 +17,9 @@ import {XSS_SECURITY_URL} from '../error_details_base_url';
  * regular expression matches if:
  * (1) Either a protocol that is not javascript: or vbscript:, and that has
  *     valid characters (alphanumeric or [+-.]).
- *     For data: URIs, only non-executable subtypes are allowed:
- *     image/*, video/*, audio/*, font/*, application/octet-stream,
- *     application/pdf, application/json, text/plain, and text/csv.
- *     Other data: subtypes (e.g. data:text/html, data:text/javascript)
- *     are blocked as they can lead to script execution.
+ *     For data: URIs, only safe media subtypes (image/*, video/*, audio/*)
+ *     are allowed. Other data: subtypes (e.g. data:text/html) are blocked
+ *     as they can lead to script execution in some environments.
  * (2) or no protocol.  A protocol must be followed by a colon. The below
  *     allows that by allowing colons only after one of the characters [/?#].
  *     A colon after a hash (#) must be in the fragment.
@@ -47,7 +45,7 @@ import {XSS_SECURITY_URL} from '../error_details_base_url';
  * data: URLs entirely, providing an additional layer of defense.
  */
 const SAFE_URL_PATTERN =
-  /^(?!javascript:)(?!vbscript:)(?!data:(?!image\/|video\/|audio\/|font\/|application\/octet-stream(?=[;,])|application\/pdf(?=[;,])|application\/json(?=[;,])|text\/plain(?=[;,])|text\/csv(?=[;,])))(?:[a-z0-9+.-]+:|[^&:\/?#]*(?:[\/?#]|$))/i;
+  /^(?!javascript:)(?!vbscript:)(?!data:(?!image\/|video\/|audio\/))(?:[a-z0-9+.-]+:|[^&:\/?#]*(?:[\/?#]|$))/i;
 export function _sanitizeUrl(url: string): string {
   url = String(url);
   if (url.match(SAFE_URL_PATTERN)) return url;
```

**File**: `packages/core/test/sanitization/url_sanitizer_spec.ts` (modified, +2/-10)
```diff
@@ -48,15 +48,6 @@ describe('URL sanitizer', () => {
       'data:audio/opus;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/',
       'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciPjwvc3ZnPg==',
       'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7',
-      'data:application/octet-stream;base64,dGVzdA==',
-      'data:text/plain,hello',
-      'data:application/pdf;base64,abc',
-      'data:application/json,{"key":"value"}',
-      'data:font/woff2;base64,abc',
-      'data:text/csv,a%2Cb%2Cc',
-      'DATA:IMAGE/PNG;base64,abc',
-      'data:TEXT/PLAIN,hello',
-      'data:text/plain;charset=utf-8,hello world',
       'unknown-scheme:abc',
     ];
     for (const url of validUrls) {
@@ -99,7 +90,8 @@ describe('URL sanitizer', () => {
       'DATA:text/html,<script>alert(1)</script>',
       'data:,<script>alert(1)</script>',
       'data:application/javascript,alert(1)',
-      'data:text/javascript,alert(1)',
+      'data:text/plain,hello',
+      'data:application/pdf;base64,abc',
     ];
     for (const url of dangerousDataUrls) {
       it(`blocks ${url}`, () => expect(_sanitizeUrl(url)).toMatch(/^unsafe:/));
```

---

### Incident Patch 6: `03795a9f` (2026-09-29)
**Commit Message**: fix(devtools): use MouseEvent for mouseover and mouseout listeners in tree visualizer

In @types/d3-selection >= 3.0.12, listener callbacks for mouseover and mouseout
events are strongly typed to receive MouseEvent. Because PointerEvent is a
subtype of MouseEvent, typing the listener parameter as PointerEvent causes
a TypeScript compilation error.

Update nodeMouseoverListeners and nodeMouseoutListeners in GraphRenderer and the
corresponding D3 event handlers in TreeVisualizer to use MouseEvent.

**File**: `devtools/projects/ng-devtools/src/lib/shared/tree-visualizer/graph-renderer.ts` (modified, +4/-4)
```diff
@@ -16,8 +16,8 @@ export abstract class GraphRenderer<T, U> {
   abstract root: U | null;
 
   protected nodeClickListeners: ((pointerEvent: PointerEvent, internalNode: U) => void)[] = [];
-  protected nodeMouseoverListeners: ((pointerEvent: PointerEvent, internalNode: U) => void)[] = [];
-  protected nodeMouseoutListeners: ((pointerEvent: PointerEvent, internalNode: U) => void)[] = [];
+  protected nodeMouseoverListeners: ((event: MouseEvent, internalNode: U) => void)[] = [];
+  protected nodeMouseoutListeners: ((event: MouseEvent, internalNode: U) => void)[] = [];
 
   cleanup(): void {
     this.nodeClickListeners = [];
@@ -33,11 +33,11 @@ export abstract class GraphRenderer<T, U> {
     this.nodeClickListeners.push(cb);
   }
 
-  onNodeMouseover(cb: (pointerEvent: PointerEvent, internalNode: U) => void): void {
+  onNodeMouseover(cb: (event: MouseEvent, internalNode: U) => void): void {
     this.nodeMouseoverListeners.push(cb);
   }
 
-  onNodeMouseout(cb: (pointerEvent: PointerEvent, internalNode: U) => void): void {
+  onNodeMouseout(cb: (event: MouseEvent, internalNode: U) => void): void {
     this.nodeMouseoutListeners.push(cb);
   }
 }
```

**File**: `devtools/projects/ng-devtools/src/lib/shared/tree-visualizer/tree-visualizer.ts` (modified, +4/-4)
```diff
@@ -279,14 +279,14 @@ export class TreeVisualizer<T extends TreeNode = TreeNode> extends GraphRenderer
       )
       .on(
         'mouseover',
-        wrapEvent((pointerEvent: PointerEvent, node: TreeD3Node<T>) => {
-          this.nodeMouseoverListeners.forEach((listener) => listener(pointerEvent, node));
+        wrapEvent((event: MouseEvent, node: TreeD3Node<T>) => {
+          this.nodeMouseoverListeners.forEach((listener) => listener(event, node));
         }),
       )
       .on(
         'mouseout',
-        wrapEvent((pointerEvent: PointerEvent, node: TreeD3Node<T>) => {
-          this.nodeMouseoutListeners.forEach((listener) => listener(pointerEvent, node));
+        wrapEvent((event: MouseEvent, node: TreeD3Node<T>) => {
+          this.nodeMouseoutListeners.forEach((listener) => listener(event, node));
         }),
       )
       .attr('transform', (node: TreeD3Node<T>) => {
```

---

### Incident Patch 7: `aa43e860` (2026-09-29)
**Commit Message**: docs(docs-infra): fix editor unit tests

**File**: `adev/src/app/editor/node-runtime-sandbox.service.spec.ts` (modified, +2/-2)
```diff
@@ -81,8 +81,8 @@ describe('NodeRuntimeSandbox', () => {
 
     const fakeSpawnProcess = new FakeWebContainerProcess();
     fakeSpawnProcess.output = {
-      pipeTo: (data: WritableStream) => {
-        data.getWriter().write(OUT_OF_MEMORY_MSG);
+      pipeTo: async (data: WritableStream) => {
+        await data.getWriter().write(OUT_OF_MEMORY_MSG);
       },
       pipeThrough: () => fakeSpawnProcess.output,
     } as any;
```

**File**: `adev/src/app/editor/node-runtime-sandbox.service.ts` (modified, +1/-0)
```diff
@@ -365,6 +365,7 @@ export class NodeRuntimeSandbox {
   }
 
   private setLoading(loading: LoadingStep) {
+    if (this.nodeRuntimeState.loadingStep() === LoadingStep.ERROR) return;
     this.nodeRuntimeState.setLoadingStep(loading);
   }
 
```

---

### Incident Patch 8: `2cecc4aa` (2026-09-01)
**Commit Message**: fix(common): let NgOptimizedImage pass a [srcset] binding through when srcset optimization is disabled

NgOptimizedImage declares a `srcset` input, so a `[srcset]="..."` binding
is captured by the directive and never reaches the `<img>` element. The
directive only reads that input for a conflict check, so with
`disableOptimizedSrcset` the image ended up with no `srcset` at all. The
only way to set one was `[attr.srcset]`.

Now, when `disableOptimizedSrcset` is set and the directive isn't
generating its own srcset, the value from the `[srcset]` binding is
written back to the element.

Fixes #49335

**File**: `packages/common/src/directives/ng_optimized_image/ng_optimized_image.ts` (modified, +8/-2)
```diff
@@ -391,8 +391,10 @@ export class NgOptimizedImage implements OnInit, OnChanges {
 
   /**
    * Value of the `srcset` attribute if set on the host `<img>` element.
-   * This input is exclusively read to assert that `srcset` is not set in conflict
-   * with `ngSrcset` and that images don't start to load until a lazy loading strategy is set.
+   * This input is read to assert that `srcset` is not set in conflict with `ngSrcset` and that
+   * images don't start to load until a lazy loading strategy is set. When `disableOptimizedSrcset`
+   * is set, this value is also written back to the host element's `srcset` attribute (otherwise a
+   * `[srcset]` binding would be captured by this input and never reach the DOM).
    * @internal
    */
   @Input() srcset?: string;
@@ -692,6 +694,10 @@ export class NgOptimizedImage implements OnInit, OnChanges {
 
     if (rewrittenSrcset) {
       this.setHostAttribute('srcset', rewrittenSrcset);
+    } else if (this.disableOptimizedSrcset && this.srcset) {
+      // A `[srcset]` binding is captured by the `srcset` input rather than reaching the DOM. When
+      // the user opted out of optimized srcset generation, pass their value through unchanged.
+      this.setHostAttribute('srcset', this.srcset);
     }
     return rewrittenSrcset;
   }
```

**File**: `packages/common/test/directives/ng_optimized_image_spec.ts` (modified, +16/-0)
```diff
@@ -2585,6 +2585,22 @@ describe('Image directive', () => {
         const img = nativeElement.querySelector('img')!;
         expect(img.getAttribute('srcset')).toBeNull();
       });
+
+      it('should pass a `[srcset]` binding through to the DOM when "disableOptimizedSrcset" is set', async () => {
+        // https://github.com/angular/angular/issues/49335
+        setupTestingModule({imageLoader});
+
+        const template = `
+      <img ngSrc="img" width="100" height="50" disableOptimizedSrcset
+           [srcset]="'https://example.com/a.png 1x, https://example.com/b.png 2x'">
+    `;
+        const fixture = createTestComponent(template);
+        await fixture.whenStable();
+        const img = (fixture.nativeElement as HTMLElement).querySelector('img')!;
+        expect(img.getAttribute('srcset')).toBe(
+          'https://example.com/a.png 1x, https://example.com/b.png 2x',
+        );
+      });
     });
   });
 });
```

---

### Incident Patch 9: `2b89a3ba` (2026-03-25)
**Commit Message**: fix(core): extend data: URL allowlist for non-executable MIME types

The previous allowlist only permitted image/*, video/*, and audio/*,
which broke internal tests using data:application/octet-stream.

Extend the allowlist to include common non-executable MIME types:
font/*, application/octet-stream, application/pdf, application/json,
text/plain, and text/csv. All executable types (text/html, text/javascript,
application/javascript, etc.) remain blocked.

This maintains the allowlist architecture (safe by default) while
covering legitimate data: URL use cases.

**File**: `packages/core/src/sanitization/url_sanitizer.ts` (modified, +6/-4)
```diff
@@ -17,9 +17,11 @@ import {XSS_SECURITY_URL} from '../error_details_base_url';
  * regular expression matches if:
  * (1) Either a protocol that is not javascript: or vbscript:, and that has
  *     valid characters (alphanumeric or [+-.]).
- *     For data: URIs, only safe media subtypes (image/*, video/*, audio/*)
- *     are allowed. Other data: subtypes (e.g. data:text/html) are blocked
- *     as they can lead to script execution in some environments.
+ *     For data: URIs, only non-executable subtypes are allowed:
+ *     image/*, video/*, audio/*, font/*, application/octet-stream,
+ *     application/pdf, application/json, text/plain, and text/csv.
+ *     Other data: subtypes (e.g. data:text/html, data:text/javascript)
+ *     are blocked as they can lead to script execution.
  * (2) or no protocol.  A protocol must be followed by a colon. The below
  *     allows that by allowing colons only after one of the characters [/?#].
  *     A colon after a hash (#) must be in the fragment.
@@ -45,7 +47,7 @@ import {XSS_SECURITY_URL} from '../error_details_base_url';
  * data: URLs entirely, providing an additional layer of defense.
  */
 const SAFE_URL_PATTERN =
-  /^(?!javascript:)(?!vbscript:)(?!data:(?!image\/|video\/|audio\/))(?:[a-z0-9+.-]+:|[^&:\/?#]*(?:[\/?#]|$))/i;
+  /^(?!javascript:)(?!vbscript:)(?!data:(?!image\/|video\/|audio\/|font\/|application\/octet-stream(?=[;,])|application\/pdf(?=[;,])|application\/json(?=[;,])|text\/plain(?=[;,])|text\/csv(?=[;,])))(?:[a-z0-9+.-]+:|[^&:\/?#]*(?:[\/?#]|$))/i;
 export function _sanitizeUrl(url: string): string {
   url = String(url);
   if (url.match(SAFE_URL_PATTERN)) return url;
```

**File**: `packages/core/test/sanitization/url_sanitizer_spec.ts` (modified, +10/-2)
```diff
@@ -48,6 +48,15 @@ describe('URL sanitizer', () => {
       'data:audio/opus;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/',
       'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciPjwvc3ZnPg==',
       'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7',
+      'data:application/octet-stream;base64,dGVzdA==',
+      'data:text/plain,hello',
+      'data:application/pdf;base64,abc',
+      'data:application/json,{"key":"value"}',
+      'data:font/woff2;base64,abc',
+      'data:text/csv,a%2Cb%2Cc',
+      'DATA:IMAGE/PNG;base64,abc',
+      'data:TEXT/PLAIN,hello',
+      'data:text/plain;charset=utf-8,hello world',
       'unknown-scheme:abc',
     ];
     for (const url of validUrls) {
@@ -90,8 +99,7 @@ describe('URL sanitizer', () => {
       'DATA:text/html,<script>alert(1)</script>',
       'data:,<script>alert(1)</script>',
       'data:application/javascript,alert(1)',
-      'data:text/plain,hello',
-      'data:application/pdf;base64,abc',
+      'data:text/javascript,alert(1)',
     ];
     for (const url of dangerousDataUrls) {
       it(`blocks ${url}`, () => expect(_sanitizeUrl(url)).toMatch(/^unsafe:/));
```

---

### Incident Patch 10: `e96936a5` (2026-03-20)
**Commit Message**: fix(core): block dangerous data: and vbscript: URLs in URL sanitizer

The URL sanitizer previously only blocked `javascript:` URLs via a
negative lookahead. This left other potentially dangerous URL schemes
unblocked, including `data:text/html` (which can execute scripts in
some environments), `vbscript:` (script execution in legacy IE), and
bare `data:` URIs with no explicit media type.

This change extends the URL sanitizer to also block:
- `vbscript:` URLs
- `data:` URLs except for safe media subtypes (image/*, video/*, audio/*)

Safe media data: URIs (e.g. `data:image/png;base64,...`) continue to be
allowed as they are commonly used for inline images and do not execute
scripts when loaded via `<img src>`.

This resolves a longstanding TODO in html_sanitizer.ts to special-case
`data:image/` URIs, which has been open since the sanitizer was first
written.

Applications that rely on non-media `data:` URLs (e.g. `data:text/plain`
or `data:application/pdf`) in sanitized contexts should use
`bypassSecurityTrustUrl()` to explicitly mark them as trusted.

**File**: `packages/core/src/sanitization/html_sanitizer.ts` (modified, +3/-1)
```diff
@@ -195,7 +195,9 @@ class SanitizingHtmlSerializer {
         continue;
       }
       let value = elAttr!.value;
-      // TODO(martinprobst): Special case image URIs for data:image/...
+      // Note: data: URIs with dangerous subtypes (e.g. data:text/html) are now blocked
+      // by _sanitizeUrl, while safe media subtypes (data:image/*, data:video/*, data:audio/*)
+      // are still allowed.
       if (URI_ATTRS[lower]) value = _sanitizeUrl(value);
       this.buf.push(' ', attrName, '="', encodeEntities(value), '"');
     }
```

**File**: `packages/core/src/sanitization/url_sanitizer.ts` (modified, +14/-4)
```diff
@@ -15,8 +15,11 @@ import {XSS_SECURITY_URL} from '../error_details_base_url';
  * This regular expression matches a subset of URLs that will not cause script
  * execution if used in URL context within a HTML document. Specifically, this
  * regular expression matches if:
- * (1) Either a protocol that is not javascript:, and that has valid characters
- *     (alphanumeric or [+-.]).
+ * (1) Either a protocol that is not javascript: or vbscript:, and that has
+ *     valid characters (alphanumeric or [+-.]).
+ *     For data: URIs, only safe media subtypes (image/*, video/*, audio/*)
+ *     are allowed. Other data: subtypes (e.g. data:text/html) are blocked
+ *     as they can lead to script execution in some environments.
  * (2) or no protocol.  A protocol must be followed by a colon. The below
  *     allows that by allowing colons only after one of the characters [/?#].
  *     A colon after a hash (#) must be in the fragment.
@@ -33,9 +36,16 @@ import {XSS_SECURITY_URL} from '../error_details_base_url';
  * that. More importantly, it disallows masking of a colon,
  * e.g. "javascript&#58;...".
  *
- * This regular expression was taken from the Closure sanitization library.
+ * This regular expression was originally taken from the Closure sanitization
+ * library and extended to also block vbscript: and dangerous data: subtypes.
+ *
+ * Note: data:image/svg+xml is allowed because SVG loaded via <img src> is
+ * sandboxed by browsers (scripts do not execute). For <a href> contexts,
+ * modern browsers (Chrome 60+, Firefox 59+) block top-level navigation to
+ * data: URLs entirely, providing an additional layer of defense.
  */
-const SAFE_URL_PATTERN = /^(?!javascript:)(?:[a-z0-9+.-]+:|[^&:\/?#]*(?:[\/?#]|$))/i;
+const SAFE_URL_PATTERN =
+  /^(?!javascript:)(?!vbscript:)(?!data:(?!image\/|video\/|audio\/))(?:[a-z0-9+.-]+:|[^&:\/?#]*(?:[\/?#]|$))/i;
 export function _sanitizeUrl(url: string): string {
   url = String(url);
   if (url.match(SAFE_URL_PATTERN)) return url;
```

**File**: `packages/core/test/sanitization/url_sanitizer_spec.ts` (modified, +27/-1)
```diff
@@ -46,6 +46,8 @@ describe('URL sanitizer', () => {
       'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/', // Truncated.
       'data:video/webm;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/',
       'data:audio/opus;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/',
+      'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciPjwvc3ZnPg==',
+      'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7',
       'unknown-scheme:abc',
     ];
     for (const url of validUrls) {
@@ -68,7 +70,31 @@ describe('URL sanitizer', () => {
       'jav\u0000ascript:alert();',
     ];
     for (const url of invalidUrls) {
-      it(`valid ${url}`, () => expect(_sanitizeUrl(url)).toMatch(/^unsafe:/));
+      it(`invalid ${url}`, () => expect(_sanitizeUrl(url)).toMatch(/^unsafe:/));
+    }
+  });
+
+  describe('vbscript URLs', () => {
+    const vbscriptUrls = ['vbscript:MsgBox("XSS")', 'VBScript:alert()', 'VBSCRIPT:MsgBox("XSS")'];
+    for (const url of vbscriptUrls) {
+      it(`blocks ${url}`, () => expect(_sanitizeUrl(url)).toMatch(/^unsafe:/));
+    }
+  });
+
+  describe('dangerous data: URLs', () => {
+    const dangerousDataUrls = [
+      'data:text/html,<script>alert(1)</script>',
+      'data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg==',
+      'data:application/xhtml+xml,<script>alert(1)</script>',
+      'data:text/xml,<script>alert(1)</script>',
+      'DATA:text/html,<script>alert(1)</script>',
+      'data:,<script>alert(1)</script>',
+      'data:application/javascript,alert(1)',
+      'data:text/plain,hello',
+      'data:application/pdf;base64,abc',
+    ];
+    for (const url of dangerousDataUrls) {
+      it(`blocks ${url}`, () => expect(_sanitizeUrl(url)).toMatch(/^unsafe:/));
     }
   });
 });
```

#### Recent Merged Pull Requests:
- **PR #71091** (2026-09-30): docs: fix afterRenderEffect phase example in the effect guide (@GabeSilvaDev)
- **PR #71090** (closed): fix(router): fall back when serializing protocol-relative URLs (@atscott)
- **PR #71088** (closed): docs: merge the testing imports in the RouterTestingModule example (@erkamyaman)
- **PR #71086** (closed): docs: rewrite the RouterTestingModule migration README (@erkamyaman)
- **PR #71084** (2026-09-30): docs: add the missing inject import to the inject migration examples (@erkamyaman)
- **PR #71082** (2026-09-30): docs: correct the RouterTestingModule schematic description (@erkamyaman)
- **PR #71079** (2026-09-30): [Backport 21.2.X] fix(platform-server): reject protocol-relative paths in resolveUrl (@alan-agius4)
- **PR #71078** (2026-09-30): [Backport 20.3.X] fix(platform-server): reject protocol-relative paths in resolveUrl (@alan-agius4)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
