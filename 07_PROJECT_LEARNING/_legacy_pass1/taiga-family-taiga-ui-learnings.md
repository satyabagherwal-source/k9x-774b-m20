# Forensic Learning Record (Deep Inspection): taiga-family/taiga-ui

> **Canonical Artifact**: `07_PROJECT_LEARNING/taiga-family-taiga-ui-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/taiga-family/taiga-ui](https://github.com/taiga-family/taiga-ui))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-09-30T18:24:04.199Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `taiga-family/taiga-ui`
- **Description**: Angular components library for awesome people
- **Primary Language / Ecosystem**: TypeScript
- **Discovered Manifests / Configurations**: package.json, README.md
- **Stars / Engagement**: 4059 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: package.json, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `eslint.config.ts`
```
import taiga from '@taiga-ui/eslint-plugin-experience-next';

export default [
    ...taiga.configs.recommended,
    ...taiga.configs.jest,
    ...taiga.configs['taiga-specific'],
    {
        files: ['**/legacy/**/*.ts'],
        rules: {'@angular-eslint/prefer-standalone': 'off'},
    },
    {
        files: ['**/*.{ts,js}'],
        rules: {
            'import/no-cycle': 'off',
            '@typescript-eslint/no-unnecessary-condition': 'off',
            'unicorn/no-array-method-this-argument': 'off',
            '@typescript-eslint/max-params': ['error', {countVoidThis: true, max: 5}],
            // TODO enable after fixing all issues
            '@angular-eslint/prefer-signals': 'off',
            // TODO: enable after https://github.com/typescript-eslint/typescript-eslint/issues/11790
            '@typescript-eslint/no-redundant-type-constituents': 'off',
            '@typescript-eslint/strict-void-return': 'off',
            '@taiga-ui/experience-next/prefer-untracked-incidental-signal-reads': 'off', // TODO: investigate later
        },
    },
    {
        files: ['**/*.spec.ts', '**/*.cy.ts', '**/demo/**/*.ts'],
        rules: {'no-irregular-whitespace': 'off'},
    },
    {
        rules: {'@taiga-ui/experience-next/no-deep-imports': 'off'},
        files: [
            'projects/demo/src/pages/components/icon/examples/4/index.ts',
            'projects/demo/src/pages/markup/breakpoints/index.ts',
            '**/*.pw.spec.ts',
            '**/*.po.ts',
            '**/*.eo.ts',
        ],
    },
    {
        files: ['**/*.html'],
        rules: {
            '@taiga-ui/experience-next/no-nested-interactive': 'off', // TODO: fix later
            '@angular-eslint/template/no-empty-control-flow': 'off', // TODO: fix later
            '@angular-eslint/template/no-non-null-assertion': 'off', // TODO: fix later
            '@angular-eslint/template/no-nested-tags': 'off', // TODO: fix later
            '@angular-eslint/template/prefer-at-else': 'off', // TODO: fix later
        },
    },
];

```

### Core Architecture Module: `knip.config.ts`
```
import {type KnipConfig} from 'knip';

const config: KnipConfig = {
    ignoreDependencies: [
        '@jest/.+',
        '@types/.+',
        '@taiga-ui/.+',
        '@ng-web-apis/.+',
        '@maskito/.+',
        'ts-morph',
        'jest',
    ],
    ignoreUnresolved: ['ng-dev-mode'],
    ignoreBinaries: [
        'awk',
        'eslint',
        'ifconfig',
        'prettier',
        'playwright',
        'mkcert',
        'commitlint',
        'lint-staged',
        'extract-changelog-release',
    ],
    // TODO: investigate why some files are broken
    ignore: [
        '**/app/pages.ts',
        '**/*.spec.ts',
        '**/package.json',
        '**/scripts/**/*.ts',
        '**/*.config.{ts,js}',
        '**/*.options.{ts,js}',
        '**/examples/*/*.ts',
        '**/demo/**/server.ts',
        '**/used-icons.ts',
        '**/demo/src/emulate/*.ts',
        '**/demo/**/main.server.ts',
        '**/versions.constants.ts',
        '**/tokens/common-icons.ts',
        '**/app/logo/logo.component.ts',
        '**/app/copy-page/copy-page.component.ts',
        '**/app/server-error-handler.ts',
        '**/app/getting-started/index.ts',
        '**/testing/visual-testing/**/*.ts',
        '**/projects/cdk/date-time/test/helpers.ts',
        '**/demo/src/pages/components/data-list/examples/4/custom-list/index.ts',
    ],
    workspaces: {
        'projects/demo-playwright': {
            entry: ['utils/**/*.ts'],
            ignore: ['**/performance/dropdown/utils.ts'],
        },
    },
};

export default config;

```

### Core Architecture Module: `projects/addon-charts/components/arc-chart/arc-chart.component.ts`
```
import {ChangeDetectionStrategy, Component, input, model} from '@angular/core';
import {toSignal} from '@angular/core/rxjs-interop';
import {TuiHovered} from '@taiga-ui/cdk/directives/hovered';
import {tuiZonefree} from '@taiga-ui/cdk/observables';
import {type TuiSizeXL} from '@taiga-ui/core/types';
import {map, take, timer} from 'rxjs';

const ARC = 0.76; // 3/4 with 1% safety offset
const SIZE = {m: 9, l: 11, xl: 16} as const;
const WIDTH = {m: 0.25, l: 0.375, xl: 0.5625} as const;
const GAP = {m: 0.125, l: 0.1875, xl: 0.25} as const;

@Component({
    selector: 'tui-arc-chart',
    imports: [TuiHovered],
    templateUrl: './arc-chart.template.html',
    styleUrl: './arc-chart.style.less',
    changeDetection: ChangeDetectionStrategy.OnPush,
    host: {
        '[attr.data-size]': 'size()',
        '[style.height.rem]': 'width',
        '[style.strokeWidth.rem]': 'strokeWidth',
        '[style.width.rem]': 'width',
    },
})
export class TuiArcChart {
    protected readonly initialized = toSignal(
        timer(0).pipe(
            tuiZonefree(),
            take(1),
            map(() => true),
        ),
        {initialValue: false},
    );

    public readonly value = input<readonly number[]>([]);
    public readonly size = input<TuiSizeXL>('m');
    public readonly max = input(100);
    public readonly minLabel = input('0%');
    public readonly maxLabel = input('100%');
    public readonly activeItemIndex = model(Number.NaN);

    protected get width(): number {
        return SIZE[this.size()];
    }

    protected get strokeWidth(): number {
        return WIDTH[this.size()];
    }

    protected onHovered(hovered: boolean, index: number): void {
        this.activeItemIndex.set(hovered ? index : Number.NaN);
    }

    protected isInactive(index: number): boolean {
        return !Number.isNaN(this.activeItemIndex()) && index !== this.activeItemIndex();
    }

    protected getInset(index: number): number {
        return this.strokeWidth / 2 + index * (this.strokeWidth + GAP[this.size()]);
    }

    protected getDiameter(index: number): number {
        return SIZE[this.size()] - 2 * this.getInset(index);
    }

    protected getLength(index: number): number {
        return Math.PI * this.getDiameter(index) * ARC;
    }

    protected getOffset(index: number): number {
        return (
            this.getLength(index) *
            (1 - Math.min((this.value()[index] || 0) / this.max(), 1))
        );
    }
}

```

### Core Architecture Module: `projects/addon-charts/components/arc-chart/index.ts`
```
export * from './arc-chart.component';

```

### Core Architecture Module: `projects/addon-charts/components/axes/axes.component.ts`
```
import {ChangeDetectionStrategy, Component, computed, input} from '@angular/core';
import {type TuiLineHandler} from '@taiga-ui/addon-charts/types';
import {CHAR_NO_BREAK_SPACE} from '@taiga-ui/cdk/constants';

export const TUI_ALWAYS_DASHED: TuiLineHandler = (index) =>
    (index && 'dashed') || 'solid';

export const TUI_ALWAYS_DOTTED: TuiLineHandler = (index) =>
    (index && 'dotted') || 'solid';

export const TUI_ALWAYS_SOLID: TuiLineHandler = () => 'solid';
export const TUI_ALWAYS_NONE: TuiLineHandler = () => 'none';

@Component({
    selector: 'tui-axes',
    templateUrl: './axes.template.html',
    styleUrl: './axes.style.less',
    changeDetection: ChangeDetectionStrategy.OnPush,
    host: {
        dir: 'ltr',
        '[class._centered]': 'centeredXLabels()',
    },
})
export class TuiAxes {
    public readonly axisXLabels = input<ReadonlyArray<string | null>>([]);
    public readonly axisYInset = input(false);
    public readonly axisYLabels = input<readonly string[]>([]);
    public readonly axisYName = input('');
    public readonly axisYSecondaryInset = input(false);
    public readonly axisYSecondaryLabels = input<readonly string[]>([]);
    public readonly axisYSecondaryName = input('');
    public readonly centeredXLabels = input(false);
    public readonly horizontalLines = input(1);
    public readonly horizontalLinesHandler = input(TUI_ALWAYS_SOLID);
    public readonly verticalLines = input(1);
    public readonly verticalLinesHandler = input(TUI_ALWAYS_DASHED);
    public readonly fallbackLabel = CHAR_NO_BREAK_SPACE;
    public readonly hasXLabels = computed(() => !!this.axisXLabels().length);

    public readonly hasYLabels = computed(
        () => (this.axisYLabels().length && !this.axisYInset()) || !!this.axisYName(),
    );

    public readonly hasYSecondaryLabels = computed(
        () =>
            (this.axisYSecondaryLabels().length && !this.axisYSecondaryInset()) ||
            !!this.axisYSecondaryName(),
    );
}

```

### Core Architecture Module: `projects/addon-charts/components/axes/index.ts`
```
export * from './axes.component';

```

### Core Architecture Module: `projects/addon-charts/components/bar-chart/bar-chart.component.ts`
```
import {AsyncPipe} from '@angular/common';
import {
    ChangeDetectionStrategy,
    Component,
    computed,
    inject,
    input,
    output,
    viewChildren,
} from '@angular/core';
import {TuiBarSet} from '@taiga-ui/addon-charts/components/bar-set';
import {TuiChartHint} from '@taiga-ui/addon-charts/components/chart-hint';
import {TuiMapperPipe} from '@taiga-ui/cdk/pipes/mapper';
import {type TuiContext, type TuiMapper} from '@taiga-ui/cdk/types';
import {tuiSum} from '@taiga-ui/cdk/utils/math';
import {tuiGenerateId} from '@taiga-ui/cdk/utils/miscellaneous';
import {TuiHint, TuiHintHover, tuiHintOptionsProvider} from '@taiga-ui/core/portals/hint';
import {type TuiSizeL, type TuiSizeS} from '@taiga-ui/core/types';
import {type PolymorpheusContent} from '@taiga-ui/polymorpheus';

@Component({
    selector: 'tui-bar-chart',
    imports: [AsyncPipe, TuiBarSet, TuiHint, TuiMapperPipe],
    templateUrl: './bar-chart.template.html',
    styleUrl: './bar-chart.style.less',
    changeDetection: ChangeDetectionStrategy.OnPush,
    viewProviders: [tuiHintOptionsProvider({direction: 'top'})],
})
export class TuiBarChart {
    private readonly hintOptions = inject(TuiChartHint, {optional: true});
    private readonly autoId = tuiGenerateId();

    private readonly getMax = computed(() =>
        this.collapsed()
            ? Math.max(
                  // eslint-disable-next-line no-restricted-syntax
                  ...this.value().reduce((result, next) =>
                      result.map((value, index) => value + (next[index] || 0)),
                  ),
              )
            : this.value().reduce((max, value) => Math.max(...value, max), 0),
    );

    protected readonly transposed = computed(() =>
        this.value().reduce<ReadonlyArray<readonly number[]>>(
            (result, next) =>
                next.map((_, index) => [...(result[index] || []), next[index] || 0]),
            [],
        ),
    );

    protected readonly drivers = viewChildren(TuiHintHover);

    public readonly value = input<ReadonlyArray<readonly number[]>>([]);
    public readonly max = input(Number.NaN);
    public readonly size = input<TuiSizeL | TuiSizeS | null>('m');
    public readonly collapsed = input(false);
    public readonly tapColumn = output<number>();
    public readonly computedMax = computed(() => this.max() || this.getMax());

    public readonly percentMapper: TuiMapper<
        [readonly number[], boolean, number],
        number
    > = (set, collapsed, max) =>
        (100 * (collapsed ? tuiSum(...set) : Math.max(...set))) / max;

    protected get hintContent(): PolymorpheusContent<TuiContext<number>> {
        return this.hintOptions?.content() || '';
    }

    protected get hintAppearance(): string {
        return this.hintOptions?.appearance() || '';
    }

    protected getHintId(index: number): string {
        return `${this.autoId}_${index}`;
    }
}

```

### Core Architecture Module: `projects/addon-charts/components/bar-chart/index.ts`
```
export * from './bar-chart.component';

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #15118** (2026-09-30): **feat(addon-mobile): `Tabbar` add liquid-glass support**
  *Symptoms*: related #14630, #14709
  **Post-Mortem & Fix Analysis**:
  > ## [Codecov](https://app.codecov.io/gh/taiga-family/taiga-ui/pull/15118?dropdown=coverage&src=pr&el=h1&utm_medium=referral&utm_source=github&utm_content=comment&utm_campaign=pr+comments&utm_term=taiga-family) Report :x: Patch coverage is `36.36364%` with `14 lines` in your changes missing coverage. Please review. :white_check_mark: Project coverage is 64.42%. Comparing base ([`6171153`](https://app.codecov.io/gh/taiga-family/taiga-ui/commit/617115388bd4afceae96a39845665064bbcb15bc?dropdown=coverage&el=desc&utm_medium=referral&utm_source=github&utm_content=comment&utm_campaign=pr+comments&utm_term=taiga-family)) to head ([`031edc5`](https://app.codecov.io/gh/taiga-family/taiga-ui/commit/031edc5b16097638ae0c81a8e23d273b91773694?dropdown=coverage&el=desc&utm_medium=referral&utm_source=github&utm_content=comment&utm_campaign=pr+comments&utm_term=taiga-family)).  | [Files with missing lines](https://app.codecov.io/gh/taiga-family/taiga-ui/pull/15118?dropdown=coverage&src=pr&el=tree&utm_medi
  > <!-- MURMUR_IGNORE --> #### Approvability  **Verdict:** Not approved  Macroscope's review found this PR not approvable — The change introduces an opt-in liquid-glass presentation mode with new production DOM, layout, and platform-specific styling across iOS and Android. Although the default path remains off, the implementation is substantial and has no accompanying test changes.  <sup>You can add or adjust custom eligibility rules. [Learn more](https://docs.macroscope.com/approvability#example-custom-eligibility-rules).</sup> <!-- macroscope-meta: {"kind":"approvability"} -->
  > Visit the preview URL for this PR (updated for commit 031edc5):  [https://taiga-preview--pr15118-tabbar-liquid-v4-demo-4lii98sc.web.app](https://taiga-preview--pr15118-tabbar-liquid-v4-demo-4lii98sc.web.app)  <sub>(expires Thu, 01 Oct 2026 08:43:04 GMT)</sub>  <sub>🔥 via [Firebase Hosting GitHub Action](https://github.com/marketplace/actions/deploy-to-firebase-hosting) 🌎</sub>  <sub>Sign: eb085b32b5952be72217ba6679f5d549914df6f6</sub>

- **Issue #15117** (2026-09-29): **chore: update dependency @taiga-ui/design-tokens to ~0.324.0**
  *Symptoms*: This PR contains the following updates:  | Package | Update | Change | |---|---|---| | @&#8203;taiga-ui/design-tokens | minor | [`~0.320.0` → `~0.324.0`](https://renovatebot.com/diffs/npm/@taiga-ui%2fdesign-tokens/0.320.0/0.324.0) |  ---   - [ ] <!-- rebase-check -->If you want to rebase/retry this PR, check this box  ---  This PR has been generated by [Mend Renovate CLI](https://redirect.github.com/renovatebot/renovate). <!--renovate-debug:eyJjcmVhdGVkSW5WZXIiOiI0NC4xMTcuMiIsInVwZGF0ZWRJblZlciI6IjQ0LjExNy4yIiwidGFyZ2V0QnJhbmNoIjoibWFpbiIsImxhYmVscyI6W119--> 
  **Post-Mortem & Fix Analysis**:
  > <!-- screenshot-bot-id: test-report -->  # Pull request was closed :heavy_check_mark:  All saved screenshots (for current PR) were deleted :wastebasket:
  > <!-- MURMUR_IGNORE --> #### Approvability  **Verdict:** Approved at `1181ce8`  Macroscope's review found this PR approvable — This is a generated, metadata-only dependency update confined to ignored package and lockfile paths, with no source-code or production workflow changes. Its scope is small and its observable effect is limited to dependency resolution and peer-dependency metadata.  **Notes:** - No code objects were reviewed. Approvability was decided on eligibility alone.  <sup>You can add or adjust custom eligibility rules. [Learn more](https://docs.macroscope.com/approvability#example-custom-eligibility-rules).</sup> <!-- macroscope-meta: {"kind":"approvability"} -->
  > <h3>🚨 NPM Audit Error</h3> <p><strong>79 vulnerabilities (2 low, 26 moderate, 50 high, 1 critical)</strong></p>  <details> <summary>Show details</summary>  ``` # npm audit report  @angular/common  <lt;=19.2.25 Severity: high Depends on vulnerable versions of @angular/core @angular/common: Denial of Service (DoS) via OOM in Date Formatting (formatDate) - https://github.com/advisories/GHSA-48r7-hpm6-gfxm @angular/common: Weak 32-Bit Cache Key Hashing in `HttpTransferCache` Leading to Cross-Request Data Leakage and State Poisoning - https://github.com/advisories/GHSA-39pv-4j6c-2g6v Angular: Cache-Key Ambiguity in HttpTransferCache Leading to Cross-Request Response Reuse and State Poisoning - https://github.com/advisories/GHSA-jhpw-976m-542j Angular: Information Leak via `HttpTransferCache` Bypass When Using `withRequestsMadeViaParent` - https://github.com/advisories/GHSA-p297-fm68-3q8c fix available via `npm audit fix --force` Will install @angular/platform-server@22.2.0, which is a brea

- **Issue #15116** (2026-09-30): **feat(addon-commerce): `AmountPipe`, `CurrencyPipe` add currency token**
  *Symptoms*: Fixes #14551  
  **Post-Mortem & Fix Analysis**:
  > <!-- MURMUR_IGNORE --> #### Approvability  **Verdict:** Approved at `cbdd884`  Macroscope's review found this PR approvable — This is a localized, opt-in currency-symbol customization through a new DI token, with default behavior and fallback output preserved for existing callers. The implementation is small, tested, and confined to the author's owned commerce pipe/token files.  <sup>You can add or adjust custom eligibility rules. [Learn more](https://docs.macroscope.com/approvability#example-custom-eligibility-rules).</sup> <!-- macroscope-meta: {"kind":"approvability"} -->
  > <!-- screenshot-bot-id: test-report -->  # Pull request was closed :heavy_check_mark:  All saved screenshots (for current PR) were deleted :wastebasket:
  > ## [Codecov](https://app.codecov.io/gh/taiga-family/taiga-ui/pull/15116?dropdown=coverage&src=pr&el=h1&utm_medium=referral&utm_source=github&utm_content=comment&utm_campaign=pr+comments&utm_term=taiga-family) Report :x: Patch coverage is `83.33333%` with `2 lines` in your changes missing coverage. Please review. :white_check_mark: Project coverage is 64.51%. Comparing base ([`ff9b39d`](https://app.codecov.io/gh/taiga-family/taiga-ui/commit/ff9b39db6658f1254bd6f4adf2b3c50c529ebef8?dropdown=coverage&el=desc&utm_medium=referral&utm_source=github&utm_content=comment&utm_campaign=pr+comments&utm_term=taiga-family)) to head ([`cbdd884`](https://app.codecov.io/gh/taiga-family/taiga-ui/commit/cbdd884aedea7f50edb964e901a8f55a56bf3bc4?dropdown=coverage&el=desc&utm_medium=referral&utm_source=github&utm_content=comment&utm_campaign=pr+comments&utm_term=taiga-family)). :warning: Report is 5 commits behind head on v4.x.  | [Files with missing lines](https://app.codecov.io/gh/taiga-family/taiga-ui/pu

- **Issue #15115** (2026-09-30): **fix(kit): `Copy` render long text in Safari**
  *Symptoms*: Fixes taiga-family/taiga-ui#15108 
  **Post-Mortem & Fix Analysis**:
  > <!-- screenshot-bot-id: test-report -->  # Tests are running :rocket:  Wait for workflow run with tests to finish :coffee:
  > <!-- bundlemon --> ## BundleMon                       <details> <summary>Unchanged files (2)</summary>  Status | Path | Size | Limits :------------: | ------------ | :------------: | :------------: :white_check_mark: | demo/browser/styles-(hash).css<br/> | 22.33KB | +10% :white_check_mark: | demo/browser/main-(hash).js<br/> | 1.04KB | +10% </details>    Total files change +5B +0.02%                  <details open> <summary>Groups updated (1)</summary>  Status | Path | Size | Limits :------------: | ------------ | :------------: | :------------: :white_check_mark: | demo/browser/*.js<br/> | 3.4MB (+974B +0.03%) | - </details>          Final result: :white_check_mark:  [View report in BundleMon website ➡️](https://app.bundlemon.dev/projects/64d3a0c709a579b8d4912225/reports/6abcd98cbcd3d5d99bbbcff2)  --- <p align="center"><a href="https://app.bundlemon.dev/projects/64d3a0c709a579b8d4912225/reports?branch=fix%2Fcopy-safari-long-text-15108&resolution=all" target="_blank" rel="noreferrer noo
  > <!-- taiga-ui-firebase-preview --> Visit the preview URL for this PR (updated for commit ba8f9d2):  [https://taiga-preview--pr15115-fix-copy-safari-long-text-15108-sjazaj0b.web.app](https://taiga-preview--pr15115-fix-copy-safari-long-text-15108-sjazaj0b.web.app)  <sub>(expires Thu, 01 Oct 2026 09:43:19 GMT)</sub>

- **Issue #15113** (2026-09-30): **fix(core): prevent anchored dropdown jitter in Safari**
  *Symptoms*: Fixes taiga-family/taiga-ui#15112 
  **Post-Mortem & Fix Analysis**:
  > <!-- screenshot-bot-id: test-report -->  # Workflow with tests failed :x:  I have not found any screenshots diffs. Probably, workflow failed for another reason.  Manually download artifacts of workflow or look into workflow logs to check it.
  > <!-- bundlemon --> ## BundleMon                       <details> <summary>Unchanged files (2)</summary>  Status | Path | Size | Limits :------------: | ------------ | :------------: | :------------: :white_check_mark: | demo/browser/styles-(hash).css<br/> | 22.33KB | +10% :white_check_mark: | demo/browser/main-(hash).js<br/> | 1.03KB | +10% </details>    Total files change +2B +0.01%                  <details open> <summary>Groups updated (1)</summary>  Status | Path | Size | Limits :------------: | ------------ | :------------: | :------------: :white_check_mark: | demo/browser/*.js<br/> | 3.4MB (+3.31KB +0.1%) | - </details>          Final result: :white_check_mark:  [View report in BundleMon website ➡️](https://app.bundlemon.dev/projects/64d3a0c709a579b8d4912225/reports/6abbfa62bcd3d5d99bbbc116)  --- <p align="center"><a href="https://app.bundlemon.dev/projects/64d3a0c709a579b8d4912225/reports?branch=fix%2Fdropdown-safari-anchor-scroll&resolution=all" target="_blank" rel="noreferrer 
  > <!-- taiga-ui-firebase-preview --> Visit the preview URL for this PR (updated for commit afa7f07):  [https://taiga-preview--pr15113-fix-dropdown-safari-anchor-scro-oahag3v0.web.app](https://taiga-preview--pr15113-fix-dropdown-safari-anchor-scro-oahag3v0.web.app)  <sub>(expires Wed, 30 Sep 2026 18:12:10 GMT)</sub>

- **Issue #15110** (2026-09-30): **feat(kit): `LineClamp` use anchor positioning when possible**
  *Symptoms*: Fixes # <!-- link to a relevant issue. --> 
  **Post-Mortem & Fix Analysis**:
  > <!-- screenshot-bot-id: test-report -->  # Pull request was closed :heavy_check_mark:  All saved screenshots (for current PR) were deleted :wastebasket:
  > <!-- bundlemon --> ## BundleMon                       <details> <summary>Unchanged files (2)</summary>  Status | Path | Size | Limits :------------: | ------------ | :------------: | :------------: :white_check_mark: | demo/browser/styles-(hash).css<br/> | 22.33KB | +10% :white_check_mark: | demo/browser/main-(hash).js<br/> | 1.03KB | +10% </details>    Total files change +3B +0.01%                  <details open> <summary>Groups updated (1)</summary>  Status | Path | Size | Limits :------------: | ------------ | :------------: | :------------: :white_check_mark: | demo/browser/*.js<br/> | 3.4MB (+1.73KB +0.05%) | - </details>          Final result: :white_check_mark:  [View report in BundleMon website ➡️](https://app.bundlemon.dev/projects/64d3a0c709a579b8d4912225/reports/6abb974eb30f54dc0ec98681)  --- <p align="center"><a href="https://app.bundlemon.dev/projects/64d3a0c709a579b8d4912225/reports?branch=line-clamp&resolution=all" target="_blank" rel="noreferrer noopener">Current branch
  > <!-- taiga-ui-firebase-preview --> Visit the preview URL for this PR (updated for commit 4943889):  [https://taiga-preview--pr15110-line-clamp-demo-971a1tfe.web.app](https://taiga-preview--pr15110-line-clamp-demo-971a1tfe.web.app)  <sub>(expires Wed, 30 Sep 2026 10:48:18 GMT)</sub>

- **Issue #15107** (2026-09-29): **chore: update dependency @taiga-ui/configs to v0.563.0**
  *Symptoms*: This PR contains the following updates:  | Package | Update | Change | |---|---|---| | [@taiga-ui/configs](https://redirect.github.com/taiga-family/toolkit) | minor | [`0.560.0` → `0.563.0`](https://renovatebot.com/diffs/npm/@taiga-ui%2fconfigs/0.560.0/0.563.0) |  ---   - [ ] <!-- rebase-check -->If you want to rebase/retry this PR, check this box  ---  This PR has been generated by [Mend Renovate CLI](https://redirect.github.com/renovatebot/renovate). <!--renovate-debug:eyJjcmVhdGVkSW5WZXIiOiI0NC4xMTcuMCIsInVwZGF0ZWRJblZlciI6IjQ0LjExNy4wIiwidGFyZ2V0QnJhbmNoIjoibWFpbiIsImxhYmVscyI6W119--> 
  **Post-Mortem & Fix Analysis**:
  > <!-- screenshot-bot-id: test-report -->  # Pull request was closed :heavy_check_mark:  All saved screenshots (for current PR) were deleted :wastebasket:
  > <!-- MURMUR_IGNORE --> #### Approvability  **Verdict:** Not approved  Macroscope's review found this PR not approvable — This is a low-risk dependency update limited to ignored package manifest and lockfile paths, with no production source or user-facing capability added. Both changed files are outside the author's ownership, so designated-team review remains appropriate.  **Notes:** - No code objects were reviewed. Approvability was decided on eligibility alone.  <sup>You can add or adjust custom eligibility rules. [Learn more](https://docs.macroscope.com/approvability#example-custom-eligibility-rules).</sup> <!-- macroscope-meta: {"kind":"approvability"} -->
  > <h3>🚨 NPM Audit Error</h3> <p><strong>79 vulnerabilities (2 low, 26 moderate, 50 high, 1 critical)</strong></p>  <details> <summary>Show details</summary>  ``` # npm audit report  @angular/common  <lt;=19.2.25 Severity: high Depends on vulnerable versions of @angular/core @angular/common: Denial of Service (DoS) via OOM in Date Formatting (formatDate) - https://github.com/advisories/GHSA-48r7-hpm6-gfxm @angular/common: Weak 32-Bit Cache Key Hashing in `HttpTransferCache` Leading to Cross-Request Data Leakage and State Poisoning - https://github.com/advisories/GHSA-39pv-4j6c-2g6v Angular: Cache-Key Ambiguity in HttpTransferCache Leading to Cross-Request Response Reuse and State Poisoning - https://github.com/advisories/GHSA-jhpw-976m-542j Angular: Information Leak via `HttpTransferCache` Bypass When Using `withRequestsMadeViaParent` - https://github.com/advisories/GHSA-p297-fm68-3q8c fix available via `npm audit fix --force` Will install @angular/platform-server@22.2.0, which is a brea

- **Issue #15106** (2026-09-29): **feat(kit): add listbox primitive**
  *Symptoms*: ## Description  Adds `tuiListbox` and `tuiListboxOption`: a composable primitive for a **persistent selectable list**. It supports single and multiple selection without requiring a dropdown, checkbox, or radio layout.  ```html <div aria-label="Framework" tuiListbox [(value)]="framework">     <button type="button" tuiListboxOption value="Angular">Angular</button>     <button type="button" tuiListboxOption value="React">React</button> </div> ```  ```html <div     aria-label="Frameworks"     tuiListbox     [multiple]="true"     [(value)]="frameworks" >     <button type="button" tuiListboxOption value="Angular">Angular</button>     <button type="button" tuiListboxOption value="React">React</button> </div> ```  ## Motivation  Taiga UI provides `DataList` for lists used in selection controls and dropdowns, plus controls such as `RadioList` and `Segmented`. A list that remains visible and lets users select one or several projected items has a different interaction model: its selection persists while focus moves between options.  Making `DataList` own this behavior would couple persistent selection to its existing dropdown-oriented focus handling. This PR adds a separate interaction primitive and leaves option content and presentation composable.  ## Design  - `tuiListbox` owns the value, selection mode, keyboard interaction, and focus recovery. - `tuiListboxOption` reuses `TuiOption` for option semantics and disabled state. - Navigation uses the exis
  **Post-Mortem & Fix Analysis**:
  > <!-- screenshot-bot-id: test-report -->  # Tests are running :rocket:  Wait for workflow run with tests to finish :coffee:
  > <!-- taiga-ui-firebase-preview --> Visit the preview URL for this PR (updated for commit 0e6d3bf):  [https://taiga-preview--pr15106-feat-listbox-demo-ysdqt8zp.web.app](https://taiga-preview--pr15106-feat-listbox-demo-ysdqt8zp.web.app)  <sub>(expires Wed, 30 Sep 2026 07:13:02 GMT)</sub>
  > <!-- bundlemon --> ## BundleMon                       <details> <summary>Unchanged files (2)</summary>  Status | Path | Size | Limits :------------: | ------------ | :------------: | :------------: :white_check_mark: | demo/browser/styles-(hash).css<br/> | 22.33KB | +10% :white_check_mark: | demo/browser/main-(hash).js<br/> | 1.03KB | +10% </details>    Total files change -3B -0.01%                  <details open> <summary>Groups updated (1)</summary>  Status | Path | Size | Limits :------------: | ------------ | :------------: | :------------: :white_check_mark: | demo/browser/*.js<br/> | 3.4MB (+6.41KB +0.18%) | - </details>          Final result: :white_check_mark:  [View report in BundleMon website ➡️](https://app.bundlemon.dev/projects/64d3a0c709a579b8d4912225/reports/6abb652db30f54dc0ec9832f)  --- <p align="center"><a href="https://app.bundlemon.dev/projects/64d3a0c709a579b8d4912225/reports?branch=feat%2Flistbox&resolution=all" target="_blank" rel="noreferrer noopener">Current br

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

### Incident Patch 1: `5fd5455f` (2026-09-29)
**Commit Message**: fix(kit): `Textarea` with `min` => `minRows` / `max` => `maxRows` props supports signal forms (#15078)

**File**: `projects/demo-playwright/tests/kit/textarea/textarea.pw.spec.ts` (modified, +28/-0)
```diff
@@ -95,4 +95,32 @@ test.describe('Textarea', () => {
         await expect(basicTextarea).not.toHaveCSS('overscroll-behavior', 'none');
         await expect(limitTextarea).toHaveCSS('overscroll-behavior', 'none');
     });
+
+    test('minRows and maxRows set the textarea height limits', async ({page}) => {
+        await tuiGoto(page, `${DemoRoute.Textarea}/API?minRows=2&maxRows=4`);
+        const {demo} = new TuiDocumentationPagePO(page);
+        const content = demo.locator('tui-textarea-content');
+
+        expect(
+            await content.evaluate((element) => [
+                element.style.minHeight,
+                element.style.maxHeight,
+            ]),
+        ).toEqual(['2.5em', '5em']);
+        await expect.soft(demo).toHaveScreenshot('textarea-min-max-rows.png');
+    });
+
+    test('legacy min and max still set the textarea height limits', async ({page}) => {
+        await tuiGoto(page, DemoRoute.Textarea);
+        const example = new TuiDocumentationPagePO(page).getExample('#icons');
+        const content = example.locator('tui-textarea-content');
+
+        expect(
+            await content.evaluate((element) => [
+                element.style.minHeight,
+                element.style.maxHeight,
+            ]),
+        ).toEqual(['5em', '5em']);
+        await expect.soft(example).toHaveScreenshot('textarea-legacy-min-max-rows.png');
+    });
 });
```

**File**: `projects/demo/src/pages/components/textarea/index.html` (modified, +4/-4)
```diff
@@ -70,8 +70,8 @@
                         placeholder="Placeholder"
                         tuiTextarea
                         [formControl]="control"
-                        [max]="max"
-                        [min]="min"
+                        [maxRows]="max"
+                        [minRows]="min"
                         [readonly]="controlDoc.readonly"
                         [tuiDisabled]="controlDoc.disabled"
                     ></textarea>
@@ -81,15 +81,15 @@
         <table tuiDocAPI>
             <tbody>
                 <tr
-                    name="[min]"
+                    name="[minRows]"
                     tuiDocAPIItem
                     type="number"
                     [(value)]="min"
                 >
                     minimum number of rows in height
                 </tr>
                 <tr
-                    name="[max]"
+                    name="[maxRows]"
                     tuiDocAPIItem
                     type="number"
                     [(value)]="max"
```

**File**: `projects/kit/components/textarea/textarea-content.component.ts` (modified, +2/-2)
```diff
@@ -37,8 +37,8 @@ import {TuiTextareaComponent} from './textarea.component';
     hostDirectives: [TuiScrollRef],
     host: {
         'data-tui-version': TUI_VERSION,
-        '[style.max-height.em]': '1.25 * host.max()',
-        '[style.min-height.em]': '1.25 * host.min()',
+        '[style.max-height.em]': '1.25 * host.maximumRows()',
+        '[style.min-height.em]': '1.25 * host.minimumRows()',
     },
 })
 export class TuiTextareaContent {
```

**File**: `projects/kit/components/textarea/textarea.component.ts` (modified, +10/-6)
```diff
@@ -1,5 +1,6 @@
 import {
     type ComponentRef,
+    computed,
     Directive,
     inject,
     INJECTOR,
@@ -33,23 +34,26 @@ export class TuiTextareaComponent implements OnInit {
     private ref?: ComponentRef<TuiTextareaContent>;
 
     /**
-     * TODO(v6): check https://github.com/angular/angular/issues/70600 status:
-     * - Solved? Drop `string | undefined` workaround and `transform`
-     * - Not yet? Rename props to `minRows`
+     * @deprecated use `minRows` instead
+     * TODO(v6): delete
      */
     public readonly min = input<number, number | string | undefined>(this.options.min, {
         transform: (min) => (typeof min === 'number' ? min : this.options.min),
     });
 
     /**
-     * TODO(v6): check https://github.com/angular/angular/issues/70600 status:
-     * - Solved? Drop `string | undefined` workaround and `transform`
-     * - Not yet? Rename props to `maxRows`
+     * @deprecated use `maxRows` instead
+     * TODO(v6): delete
      */
     public readonly max = input<number, number | string | undefined>(this.options.max, {
         transform: (max) => (typeof max === 'number' ? max : this.options.max),
     });
 
+    /** Row limits for use with Signal Forms, which reserve min and max for field constraints. */
+    public readonly minRows = input<number>();
+    public readonly maxRows = input<number>();
+    public readonly minimumRows = computed(() => this.minRows() ?? this.min());
+    public readonly maximumRows = computed(() => this.maxRows() ?? this.max());
     public readonly content = input(this.options.content);
     public readonly el = tuiInjectElement<HTMLTextAreaElement>();
 
```

**File**: `projects/kit/components/textarea/textarea.options.ts` (modified, +1/-0)
```diff
@@ -3,6 +3,7 @@ import {tuiCreateOptions} from '@taiga-ui/cdk/utils/di';
 import {type PolymorpheusContent} from '@taiga-ui/polymorpheus';
 
 export interface TuiTextareaOptions {
+    // TODO(v6): rename to `minRows` / `maxRows`
     min: number;
     max: number;
     content: PolymorpheusContent<TuiContext<string>>;
```

---

### Incident Patch 2: `89f46ad9` (2026-09-29)
**Commit Message**: fix(addon-table): `TableControl` supports Signal Forms (#15090)

**File**: `projects/addon-table/directives/table-control/table-control.directive.ts` (modified, +2/-1)
```diff
@@ -6,7 +6,8 @@ import {tuiArrayToggle} from '@taiga-ui/cdk/utils/miscellaneous';
 import {type TuiCheckboxRowDirective} from './checkbox-row.directive';
 
 @Directive({
-    selector: '[tuiTable][ngModel],[tuiTable][formControl],[tuiTable][formControlName]',
+    selector:
+        '[tuiTable][ngModel],[tuiTable][formControl],[tuiTable][formControlName],[tuiTable][formField]',
     providers: [tuiFallbackValueProvider([])],
 })
 export class TuiTableControlDirective<T> extends TuiControl<readonly T[]> {
```

**File**: `projects/demo-cypress/src/tests/table-control/signal-forms.cy.ts` (added, +133/-0)
```diff
@@ -0,0 +1,133 @@
+/*
+// TODO: Uncomment the whole file when the `@angular/forms/signals` entry point becomes available,
+// when Taiga UI drops support of Angular below 22 (stable API for signal forms appeared in Angular 22)
+import {ChangeDetectionStrategy, Component, signal} from '@angular/core';
+import {form, FormField} from '@angular/forms/signals';
+import {TuiTable, TuiTableControl} from '@taiga-ui/addon-table';
+import {TuiCheckbox, TuiRoot} from '@taiga-ui/core';
+
+@Component({
+    imports: [FormField, TuiCheckbox, TuiRoot, TuiTable, TuiTableControl],
+    template: `
+        <tui-root>
+            <table
+                tuiTable
+                [formField]="f.selected"
+            >
+                <thead>
+                    <tr>
+                        <th tuiTh>
+                            <input
+                                id="all"
+                                tuiCheckbox
+                                tuiCheckboxTable
+                                type="checkbox"
+                            />
+                        </th>
+                        <th tuiTh>Item</th>
+                    </tr>
+                </thead>
+                <tbody tuiTbody>
+                    @for (item of items; track item) {
+                        <tr>
+                            <td tuiTd>
+                                <input
+                                    tuiCheckbox
+                                    type="checkbox"
+                                    [attr.data-item]="item"
+                                    [tuiCheckboxRow]="item"
+                                />
+                            </td>
+                            <td tuiTd>{{ item }}</td>
+                        </tr>
+                    }
+                </tbody>
+            </table>
+
+            <output id="value">{{ f.selected().value().join(',') }}</output>
+
+            <button
+                id="set-value"
+                type="button"
+                (click)="f.selected().value.set(['three'])"
+            >
+                Select third
+            </button>
+        </tui-root>
+    `,
+    changeDetection: ChangeDetectionStrategy.OnPush,
+})
+export class Sandbox {
+    public readonly items = ['one', 'two', 'three'];
+    public readonly model = signal<{selected: readonly string[]}>({
+        selected: ['one'],
+    });
+
+    public readonly f = form(this.model);
+}
+
+describe('TuiTableControl + signal forms', () => {
+    beforeEach(() => {
+        cy.mount(Sandbox);
+        cy.get('#all').as('all');
+        cy.get('[data-item]').as('rows');
+    });
+
+    it('reflects the initial model value in row and table checkboxes', () => {
+        cy.get('@rows').eq(0).should('be.checked');
+        cy.get('@rows').eq(1).should('not.be.checked');
+        cy.get('@rows').eq(2).should('not.be.checked');
+
+        cy.get('@all')
+            .should('not.be.checked')
+            .and('have.prop', 'indeterminate', true);
+
+        cy.get('#value').should('have.text', 'one');
+    });
+
+    it('toggling a row updates the Signal Forms model', () => {
+        cy.get('@rows').eq(1).click();
+
+        cy.get('@rows').eq(1).should('be.checked');
+        cy.get('#value').should('have.text', 'one,two');
+        cy.get('@all').should('have.prop', 'indeterminate', true);
+    });
+
+    it('programmatic value.set() updates row and table checkboxes', () => {
+        cy.get('#set-value').click();
+
+        cy.get('@rows').eq(0).should('not.be.checked');
+        cy.get('@rows').eq(1).should('not.be.checked');
+        cy.get('@rows').eq(2).should('be.checked');
+
+        cy.get('@all')
+            .should('not.be.checked')
+            .and('have.prop', 'indeterminate', true);
+
+        cy.get('#value').should('have.text', 'three');
+    });
+
+    it('toggle-all keeps the model, checked and indeterminate state in sync', () => {
+        cy.get('@all').click();
+
+        cy.get('@rows').each((
```

---

### Incident Patch 3: `6a7ee5d8` (2026-09-28)
**Commit Message**: fix(addon-doc): code fix text selection reset in firefox when pressing cmd/ctrl (#15054)

Co-authored-by: Alex Inkin <alexander@inkin.ru>

**File**: `projects/addon-doc/components/code/index.less` (modified, +13/-1)
```diff
@@ -1,5 +1,8 @@
 @import '@taiga-ui/styles/utils';
 
+@line-number-width: 1rem;
+@line-number-gap: 1em;
+
 :host {
     display: block;
 }
@@ -19,11 +22,20 @@
     white-space: normal;
     outline: 1px solid var(--tui-border-normal);
 
+    // Firefox resets text selection on Ctrl/Cmd inside table layout (bugzilla #306641)
     ::ng-deep .hljs-ln {
+        display: grid;
+        grid-template-columns: minmax(min-content, calc(@line-number-width + @line-number-gap)) 1fr;
         inline-size: 100%;
+        min-inline-size: min-content;
+
+        tbody,
+        tr {
+            display: contents;
+        }
 
         .hljs-ln-numbers {
-            inline-size: 1rem;
+            padding-inline-end: @line-number-gap;
         }
 
         td {
```

**File**: `projects/addon-doc/components/main/main.style.less` (modified, +0/-1)
```diff
@@ -205,7 +205,6 @@ tui-doc-code {
         vertical-align: top;
         opacity: 0.3;
         text-align: end;
-        padding-inline-end: 1em !important;
     }
 }
 
```

---

### Incident Patch 4: `f9e00ed9` (2026-09-28)
**Commit Message**: fix(kit): scroll CalendarRange period items (#15063)

**File**: `projects/demo-playwright/tests/kit/input-date-range/input-date-range.pw.spec.ts` (modified, +35/-0)
```diff
@@ -114,6 +114,41 @@ test.describe('InputDateRange', () => {
                 .toHaveScreenshot('06-calendar-maximum-month-with-items.png');
         });
 
+        test('uses dropdown scrolling for long period items', async ({page}) => {
+            await tuiGoto(page, `${DemoRoute.InputDateRange}/API?items$=2`);
+            await inputDateRange.textfield.click();
+
+            const dropdown = page.locator('tui-dropdown');
+            const calendar = inputDateRange.calendar.locator(
+                '[automation-id="tui-calendar-range__calendar"]',
+            );
+
+            await expect
+                .poll(async () =>
+                    dropdown.evaluate(
+                        ({clientHeight, scrollHeight}) => scrollHeight > clientHeight,
+                    ),
+                )
+                .toBe(true);
+
+            expect(
+                await inputDateRange.items.evaluate(
+                    ({clientHeight, scrollHeight}) => scrollHeight === clientHeight,
+                ),
+            ).toBe(true);
+            expect(
+                await calendar.evaluate((element) => getComputedStyle(element).position),
+            ).toBe('sticky');
+
+            await dropdown.evaluate((element) =>
+                element.scrollTo({top: element.scrollHeight}),
+            );
+
+            await expect
+                .poll(async () => dropdown.evaluate(({scrollTop}) => scrollTop))
+                .toBeGreaterThan(0);
+        });
+
         describe('pads with zeroes if you enter an invalid date', () => {
             test('day > 31', async ({page}) => {
                 await tuiGoto(page, `${DemoRoute.InputDateRange}/API`);
```

**File**: `projects/demo/src/pages/components/input-date-range/index.ts` (modified, +8/-2)
```diff
@@ -12,7 +12,7 @@ import {TUI_FIRST_DAY, TUI_LAST_DAY, TuiDay, type TuiDayLike} from '@taiga-ui/cd
 import {TuiDropdown, TuiInput, type TuiSizeL, type TuiSizeS} from '@taiga-ui/core';
 import {
     tuiCreateDefaultDayRangePeriods,
-    type TuiDayRangePeriod,
+    TuiDayRangePeriod,
     TuiInputDateRange,
 } from '@taiga-ui/kit';
 
@@ -57,10 +57,16 @@ export default class Example {
     protected readonly sizeVariants: ReadonlyArray<TuiSizeL | TuiSizeS> = ['s', 'm', 'l'];
     protected listSize = this.sizeVariants[2]!;
     protected readonly items = tuiCreateDefaultDayRangePeriods();
+    protected readonly longItems = Array.from({length: 20}, (_, index) => {
+        const item = this.items[index % this.items.length]!;
+
+        return new TuiDayRangePeriod(item.range, `${item} ${index + 1}`);
+    });
+
     protected min = this.dates[0];
     protected max = this.dates[4];
     protected readonly limits = [{day: 3}, {day: 5}] as const;
-    protected readonly periodListItems = [null, this.items];
+    protected readonly periodListItems = [null, this.items, this.longItems];
     protected selectedPeriodList: readonly TuiDayRangePeriod[] | null = null;
     protected minLength: TuiDayLike | null = null;
     protected maxLength: TuiDayLike | null = null;
```

**File**: `projects/kit/components/calendar-range/calendar-range.style.less` (modified, +4/-0)
```diff
@@ -2,10 +2,14 @@
 
 :host:not(._mobile) {
     display: flex;
+    align-items: flex-start;
+    max-block-size: 20.25rem;
     min-inline-size: 30rem;
 }
 
 .t-calendar {
+    position: sticky;
+    inset-block-start: 0;
     border-inline-end: 1px solid var(--tui-border-normal);
 }
 
```

---

### Incident Patch 5: `5f931c55` (2026-09-28)
**Commit Message**: chore(core): `Dropdown` fix directionChange on anchor positioning (#15096)

**File**: `projects/core/portals/dropdown/dropdown-context.directive.ts` (modified, +1/-3)
```diff
@@ -77,8 +77,6 @@ export class TuiDropdownContext
 
     public readonly type = 'dropdown';
     public readonly nativeElement = tuiAnchorDelegate({
-        width: '1px',
-        height: '1px',
         top: 'calc(anchor(top)',
         left: 'calc(anchor(left)',
     });
@@ -96,7 +94,7 @@ export class TuiDropdownContext
 
         this.currentRect = tuiPointToClientRect(x, y);
         this.nativeElement.style.top = `calc(anchor(top) + ${y - top}px)`;
-        this.nativeElement.style.left = `calc(anchor(left) + ${x - left}px)`;
+        this.nativeElement.style.left = `calc(anchor(left, -100000px) + ${x - left}px)`;
         this.driver.next(true);
     }
 }
```

**File**: `projects/core/portals/dropdown/dropdown-selection.directive.ts` (modified, +1/-1)
```diff
@@ -268,7 +268,7 @@ export class TuiDropdownSelection
 
         Object.assign(this.nativeElement.style, {
             top: `calc(anchor(top) + ${rect.top - top}px)`,
-            left: `calc(anchor(left) + ${rect.left - left}px)`,
+            left: `calc(anchor(left, -100000px) + ${rect.left - left}px)`,
             blockSize: tuiPx(rect.height),
             inlineSize: tuiPx(rect.width),
         });
```

**File**: `projects/core/portals/dropdown/dropdown.component.ts` (modified, +44/-5)
```diff
@@ -1,4 +1,12 @@
-import {ChangeDetectionStrategy, Component, computed, inject} from '@angular/core';
+import {
+    ChangeDetectionStrategy,
+    Component,
+    computed,
+    inject,
+    InjectionToken,
+    type OnDestroy,
+    type Type,
+} from '@angular/core';
 import {TuiActiveZone} from '@taiga-ui/cdk/directives/active-zone';
 import {TuiAnimated} from '@taiga-ui/cdk/directives/animated';
 import {
@@ -10,9 +18,15 @@ import {TUI_DARK_MODE} from '@taiga-ui/core/tokens';
 import {PolymorpheusOutlet} from '@taiga-ui/polymorpheus';
 
 import {TuiDropdownDirective} from './dropdown.directive';
-import {TUI_DROPDOWN_CONTEXT} from './dropdown.providers';
+import {TUI_DROPDOWN_ANCHOR} from './dropdown.providers';
 import {TuiDropdownAnchored} from './dropdown-anchored.directive';
 import {TUI_DROPDOWN_OPTIONS} from './dropdown-options.directive';
+import {TuiDropdownPosition} from './dropdown-position.directive';
+
+export const TUI_DROPDOWN_COMPONENT = new InjectionToken<Type<any>>(
+    ngDevMode ? 'TUI_DROPDOWN_COMPONENT' : '',
+    {factory: () => TuiDropdownComponent},
+);
 
 /**
  * TODO: Remove extends TuiScrollbar in v6 when TuiScrollable is dropped
@@ -31,6 +45,10 @@ import {TUI_DROPDOWN_OPTIONS} from './dropdown-options.directive';
                 [innerHTML]="text"
             ></div>
         </div>
+        <div
+            class="t-detector"
+            (resize)="onResize($any($event)[0])"
+        ></div>
     `,
     styleUrl: './dropdown.style.less',
     // @bad TODO: OnPush
@@ -49,14 +67,35 @@ import {TUI_DROPDOWN_OPTIONS} from './dropdown-options.directive';
         '[style.max-block-size.px]': 'options.maxHeight',
     },
 })
-export class TuiDropdownComponent extends TuiScrollbar {
+export class TuiDropdownComponent extends TuiScrollbar implements OnDestroy {
+    private readonly anchor = inject(TUI_DROPDOWN_ANCHOR);
+    private readonly position = inject(TuiDropdownPosition);
+    private readonly darkMode = inject(TUI_DARK_MODE);
+
     protected readonly options = inject(TUI_DROPDOWN_OPTIONS);
     protected readonly directive = inject(TuiDropdownDirective);
-    protected readonly context = inject(TUI_DROPDOWN_CONTEXT, {optional: true});
-    protected readonly darkMode = inject(TUI_DARK_MODE);
     protected readonly theme = computed((_ = this.darkMode()) =>
         this.directive.el.closest('[tuiTheme]')?.getAttribute('tuiTheme'),
     );
 
+    public ngOnDestroy(): void {
+        if (!this.anchor.nativeElement.isConnected) {
+            this.el.style.setProperty('visibility', 'hidden');
+        }
+    }
+
     protected readonly close = (): void => this.directive.toggle(false);
+
+    protected onResize({target, contentRect}: ResizeObserverEntry): void {
+        if (!target.checkVisibility({opacityProperty: true})) {
+            return;
+        }
+
+        if (contentRect.width) {
+            this.position.direction.next(contentRect.height ? 'bottom' : 'top');
+            this.el.style.setProperty('visibility', 'visible');
+        } else {
+            this.el.style.setProperty('visibility', 'hidden');
+        }
+    }
 }
```

**File**: `projects/core/portals/dropdown/dropdown.directive.ts` (modified, +1/-1)
```diff
@@ -26,8 +26,8 @@ import {
 } from '@taiga-ui/polymorpheus';
 import {Subject, throttleTime} from 'rxjs';
 
+import {TUI_DROPDOWN_COMPONENT} from './dropdown.component';
 import {TuiDropdownDriver, TuiDropdownDriverDirective} from './dropdown.driver';
-import {TUI_DROPDOWN_COMPONENT} from './dropdown.providers';
 import {TuiDropdownA11y} from './dropdown-a11y.directive';
 import {TuiDropdownAnchor} from './dropdown-anchor.directive';
 import {TuiDropdownPosition} from './dropdown-position.directive';
```

**File**: `projects/core/portals/dropdown/dropdown.providers.ts` (modified, +2/-9)
```diff
@@ -1,15 +1,8 @@
-import {type ElementRef, InjectionToken, type Type} from '@angular/core';
-
-import {TuiDropdownComponent} from './dropdown.component';
+import {type ElementRef, InjectionToken} from '@angular/core';
 
 /**
- * A component to display a dropdown
+ * @deprecated: remove in v6
  */
-export const TUI_DROPDOWN_COMPONENT = new InjectionToken<Type<any>>(
-    ngDevMode ? 'TUI_DROPDOWN_COMPONENT' : '',
-    {factory: () => TuiDropdownComponent},
-);
-
 export const TUI_DROPDOWN_CONTEXT = new InjectionToken<Record<any, any>>(
     ngDevMode ? 'TUI_DROPDOWN_CONTEXT' : '',
 );
```

---

### Incident Patch 6: `d3ca9dc7` (2026-09-28)
**Commit Message**: fix(kit): `Push` hide empty header (#15098)

**File**: `projects/kit/components/push/push.component.ts` (modified, +11/-3)
```diff
@@ -1,9 +1,17 @@
 import {DatePipe} from '@angular/common';
-import {ChangeDetectionStrategy, Component, inject, input, output} from '@angular/core';
+import {
+    ChangeDetectionStrategy,
+    Component,
+    contentChild,
+    inject,
+    input,
+    output,
+} from '@angular/core';
 import {tuiIsString} from '@taiga-ui/cdk/utils/miscellaneous';
 import {TuiButton, tuiButtonOptionsProvider} from '@taiga-ui/core/components/button';
+import {TuiIcon} from '@taiga-ui/core/components/icon';
 import {TuiButtonX} from '@taiga-ui/core/directives/button-x';
-import {TUI_CLOSE_WORD, TUI_COMMON_ICONS} from '@taiga-ui/core/tokens';
+import {TUI_CLOSE_WORD} from '@taiga-ui/core/tokens';
 
 @Component({
     selector: 'tui-push',
@@ -17,7 +25,7 @@ import {TUI_CLOSE_WORD, TUI_COMMON_ICONS} from '@taiga-ui/core/tokens';
 export class TuiPushComponent {
     protected readonly isString = tuiIsString;
     protected readonly closeWord = inject(TUI_CLOSE_WORD);
-    protected readonly icons = inject(TUI_COMMON_ICONS);
+    protected readonly icon = contentChild(TuiIcon);
 
     public readonly heading = input('');
     public readonly type = input('');
```

**File**: `projects/kit/components/push/push.template.html` (modified, +18/-12)
```diff
@@ -11,18 +11,24 @@
         {{ closeWord() }}
     </button>
 }
-<div class="t-top">
-    <span class="t-icon">
-        <ng-content select="tui-icon" />
-    </span>
-    {{ type() }}
-    @if (timestamp()) {
-        <span
-            class="t-time"
-            [textContent]="isString(timestamp()) ? timestamp() : (timestamp() | date: 'h:mm a')"
-        ></span>
-    }
-</div>
+
+@if (type() || timestamp() || icon()) {
+    <div class="t-top">
+        @if (icon()) {
+            <span class="t-icon">
+                <ng-content select="tui-icon" />
+            </span>
+        }
+        {{ type() }}
+        @if (timestamp()) {
+            <span
+                class="t-time"
+                [textContent]="isString(timestamp()) ? timestamp() : (timestamp() | date: 'h:mm a')"
+            ></span>
+        }
+    </div>
+}
+
 <h3
     automation-id="tui-push__heading"
     class="t-heading"
```

**File**: `projects/kit/components/push/test/push.component.spec.ts` (modified, +28/-0)
```diff
@@ -1,5 +1,6 @@
 import {ChangeDetectionStrategy, Component, type DebugElement} from '@angular/core';
 import {type ComponentFixture, TestBed} from '@angular/core/testing';
+import {By} from '@angular/platform-browser';
 import {provideTaiga, TuiRoot} from '@taiga-ui/core';
 import {TuiPageObject} from '@taiga-ui/testing';
 
@@ -47,4 +48,31 @@ describe('Push with TUI_PUSH_OPTIONS', () => {
             expect(labelElement.nativeElement.textContent.trim()).toBe(heading);
         });
     });
+
+    describe('top row', () => {
+        it('does not render without type, timestamp or icon', () => {
+            tuiPushService.open('Test').subscribe();
+            fixture.detectChanges();
+
+            expect(getLabelElement()).not.toBeNull();
+            expect(fixture.debugElement.query(By.css('.t-top'))).toBeNull();
+        });
+
+        it.each([{type: 'News'}, {timestamp: '12:00'}, {icon: '@tui.star'}])(
+            'renders with %j',
+            (options) => {
+                tuiPushService.open('Test', options).subscribe();
+                fixture.detectChanges();
+
+                expect(fixture.debugElement.query(By.css('.t-top'))).not.toBeNull();
+            },
+        );
+
+        it('renders a numeric timestamp', () => {
+            tuiPushService.open('Test', {timestamp: 1_700_000_000_000}).subscribe();
+            fixture.detectChanges();
+
+            expect(fixture.debugElement.query(By.css('.t-top .t-time'))).not.toBeNull();
+        });
+    });
 });
```

---

### Incident Patch 7: `cb3e0404` (2026-09-28)
**Commit Message**: fix(addon-mobile): `SheetDialog` close immediately on fast swipe (#15067)

**File**: `projects/addon-mobile/components/sheet-dialog/index.ts` (modified, +1/-0)
```diff
@@ -2,3 +2,4 @@ export * from './sheet-dialog.component';
 export * from './sheet-dialog.directive';
 export * from './sheet-dialog.options';
 export * from './sheet-dialog.service';
+export * from './sheet-dialog-close.directive';
```

**File**: `projects/addon-mobile/components/sheet-dialog/sheet-dialog-close.directive.ts` (added, +66/-0)
```diff
@@ -0,0 +1,66 @@
+import {DOCUMENT} from '@angular/common';
+import {Directive, inject} from '@angular/core';
+import {outputFromObservable} from '@angular/core/rxjs-interop';
+import {tuiIfMap} from '@taiga-ui/cdk/observables';
+import {tuiInjectElement} from '@taiga-ui/cdk/utils/dom';
+import {
+    bufferCount,
+    filter,
+    fromEvent,
+    map,
+    merge,
+    pairwise,
+    startWith,
+    take,
+    takeWhile,
+} from 'rxjs';
+
+import {TuiSheetDialogComponent} from './sheet-dialog.component';
+
+@Directive({selector: '[tuiSheetDialogClose]'})
+export class TuiSheetDialogClose {
+    private readonly el = tuiInjectElement();
+    private readonly doc = inject(DOCUMENT);
+    private readonly sheet = inject(TuiSheetDialogComponent);
+    private readonly scroll$ = fromEvent(this.el, 'scroll');
+    private readonly untouched$ = merge(
+        fromEvent(this.doc, 'touchstart', {passive: true}).pipe(map(() => false)),
+        fromEvent(this.doc, 'touchend', {passive: true}).pipe(map(() => true)),
+        fromEvent(this.doc, 'touchcancel', {passive: true}).pipe(map(() => true)),
+    );
+
+    private readonly swipe$ = this.scroll$.pipe(
+        map(() => this.el.scrollHeight - this.el.clientHeight - this.el.scrollTop),
+        // Excluding scroll due to content height changes when scrolled to the end
+        filter((scroll) => Math.abs(scroll) > 10),
+        map(() => this.el.scrollTop),
+        pairwise(),
+        map(([prev, curr]) => prev - curr),
+        takeWhile((value) => value > 0),
+        bufferCount(5),
+        take(1),
+    );
+
+    private readonly release$ = this.scroll$.pipe(
+        startWith(null),
+        filter(() => !this.el.scrollTop),
+        take(1),
+    );
+
+    public readonly tuiSheetDialogClose = outputFromObservable(
+        merge(
+            // Swipe down
+            this.untouched$.pipe(
+                tuiIfMap(
+                    () => this.swipe$,
+                    (untouched) => untouched && this.el.scrollTop < this.sheet.initial,
+                ),
+            ),
+            // Wheel/let go at the end
+            merge(
+                this.untouched$,
+                fromEvent(this.el, 'wheel').pipe(map(() => true)),
+            ).pipe(tuiIfMap(() => this.release$)),
+        ),
+    );
+}
```

**File**: `projects/addon-mobile/components/sheet-dialog/sheet-dialog.component.ts` (modified, +18/-30)
```diff
@@ -20,6 +20,7 @@ import {injectContext, PolymorpheusOutlet} from '@taiga-ui/polymorpheus';
 import {exhaustMap, filter, isObservable, map, merge, of, Subject, take} from 'rxjs';
 
 import {type TuiSheetDialogOptions} from './sheet-dialog.options';
+import {TuiSheetDialogClose} from './sheet-dialog-close.directive';
 
 const REQUIRED_ERROR = new Error(ngDevMode ? 'Required dialog was dismissed' : '');
 
@@ -29,31 +30,29 @@ const REQUIRED_ERROR = new Error(ngDevMode ? 'Required dialog was dismissed' : '
     templateUrl: './sheet-dialog.template.html',
     styleUrl: './sheet-dialog.style.less',
     changeDetection: ChangeDetectionStrategy.OnPush,
-    hostDirectives: [TuiAnimated, TuiScrollRef],
+    hostDirectives: [
+        TuiAnimated,
+        TuiScrollRef,
+        {directive: TuiSheetDialogClose, outputs: ['tuiSheetDialogClose']},
+    ],
     host: {
         '[attr.data-appearance]': 'context.appearance',
         '[class._bar]': 'context.bar',
         '[class._closeable]': 'context.closable',
         '[style.--tui-offset.px]': 'context.offset',
         '(click.self)': 'close$.next()',
-        '(document:touchcancel.zoneless)': 'onPointerChange(-1)',
-        '(document:touchend.zoneless)': 'onPointerChange(-1)',
-        '(document:touchstart.passive.zoneless)': 'onPointerChange(1)',
-        '(scroll.zoneless)': 'onPointerChange(0)',
+        '(document:touchstart.passive.zoneless)': 'interacted = true',
+        '(tuiSheetDialogClose)': 'close$.next()',
         '(wheel.passive.zoneless)': 'interacted = true',
     },
 })
-export class TuiSheetDialogComponent<I> {
+export class TuiSheetDialogComponent {
     private readonly stops = viewChildren('stops', {read: ElementRef});
     private readonly el = tuiInjectElement();
-    private pointers = 0;
-
-    protected readonly context =
-        injectContext<TuiPortalContext<TuiSheetDialogOptions<I>, any>>();
 
+    protected readonly context = injectContext<TuiPortalContext<TuiSheetDialogOptions>>();
     protected readonly close$ = new Subject<void>();
     protected interacted = false;
-
     protected readonly $ = merge(
         this.close$,
         tuiCloseWatcher(),
@@ -81,30 +80,19 @@ export class TuiSheetDialogComponent<I> {
         afterNextRender(() => this.onResize());
     }
 
-    // Re-pin async content to the initial snap; mandatory scroll-snap jumps to the bottom otherwise.
-    protected onResize(): void {
-        if (!this.interacted) {
-            this.el.scrollTop = this.initial || 0;
-        }
-    }
-
-    protected onPointerChange(delta: number): void {
-        this.interacted = this.interacted || !!delta;
-        this.pointers = Math.max(this.pointers + delta, 0);
-
-        if (!this.pointers && this.el.scrollTop <= 0 && this.interacted) {
-            this.close$.next();
-        }
-    }
-
-    private get initial(): number | undefined {
+    public get initial(): number {
         return this.context.closable
             ? this.stops()
-                  .map((e) => e.nativeElement.offsetTop - this.context.offset)
-                  .concat(this.el.clientHeight ?? Infinity)[this.context.initial]
+                  .map((e) => e.nativeElement.offsetTop)
+                  .concat(this.el.clientHeight ?? Infinity)[this.context.initial] || 0
             : 0;
     }
 
+    // Re-pin async content to the initial snap; mandatory scroll-snap jumps to the bottom otherwise.
+    protected onResize(): void {
+        this.el.scrollTop = this.interacted ? this.el.scrollTop : this.initial;
+    }
+
     private close(): void {
         if (this.context.required) {
             this.context.$implicit.error(REQUIRED_ERROR);
```

**File**: `projects/addon-mobile/components/sheet-dialog/sheet-dialog.style.less` (modified, +2/-2)
```diff
@@ -31,8 +31,8 @@
     }
 
     &.tui-enter {
-        animation-duration: @tui-duration-slow;
-        animation-timing-function: var(--tui-curve-expressive-standard);
+        animation-duration: calc(var(--tui-duration) / 6 * 7);
+        animation-timing-function: cubic-bezier(0.1, 0.8, 0.5, 1);
     }
 
     &::before {
```

**File**: `projects/demo/src/pages/components/sheet-dialog/examples/3/index.html` (modified, +1/-7)
```diff
@@ -3,14 +3,8 @@
     type="button"
     (click)="open = true"
 >
-    Show/Hide
+    Show
 </button>
-<ng-template #label>
-    <label tuiTitle>
-        <span tuiSubtitle>Monty Python</span>
-        <b>And the Holy Grail</b>
-    </label>
-</ng-template>
 <ng-template
     [tuiSheetDialogOptions]="{stops: ['5.75rem', '13.875rem']}"
     [(tuiSheetDialog)]="open"
```

---

### Incident Patch 8: `65a15ffd` (2026-09-28)
**Commit Message**: fix(kit): `Tooltip` fix size selector (#15095)

**File**: `projects/kit/directives/tooltip/tooltip.style.less` (modified, +2/-3)
```diff
@@ -7,9 +7,8 @@
     pointer-events: auto;
     background-clip: content-box !important;
 
-    [tuiBlock],
-    [tuiCell][data-size='s'],
-    [tuiLabel][data-orientation='horizontal'] &,
+    [tuiCell][data-size='s'] &,
+    [tuiLabel]:not([data-orientation='vertical']) &,
     &[data-size='s'] {
         font-size: 1.25rem;
     }
```

**File**: `projects/styles/components/form.less` (modified, +0/-7)
```diff
@@ -114,11 +114,4 @@
     [tuiLabel]:not([data-orientation='vertical']) {
         font: inherit;
     }
-
-    &[data-size='s'],
-    &[data-size='m'] {
-        [tuiLabel]:not([data-orientation='vertical']) [tuiTooltip] {
-            block-size: 1.25rem;
-        }
-    }
 }
```

---

### Incident Patch 9: `b0d0662b` (2026-09-28)
**Commit Message**: fix(addon-table): `CheckboxRow` fix indeterminate flickering (#15076)

**File**: `projects/addon-table/directives/table-control/checkbox-row.directive.ts` (modified, +1/-1)
```diff
@@ -29,7 +29,7 @@ export class TuiCheckboxRowDirective<T> implements OnInit, OnDestroy {
     protected readonly checked = computed((checked = this.parent
         .value()
         .includes(this.tuiCheckboxRow())) => {
-        setTimeout(() => this.control.control?.setValue(checked));
+        queueMicrotask(() => this.control.control?.setValue(checked));
 
         return checked;
     });
```

**File**: `projects/addon-table/directives/table-control/test/checkbox-row.spec.ts` (added, +69/-0)
```diff
@@ -0,0 +1,69 @@
+import {ChangeDetectionStrategy, Component} from '@angular/core';
+import {type ComponentFixture, TestBed} from '@angular/core/testing';
+import {FormsModule} from '@angular/forms';
+import {TuiTable, TuiTableControl} from '@taiga-ui/addon-table';
+import {TuiCheckbox} from '@taiga-ui/core';
+
+describe('TuiCheckboxRowDirective', () => {
+    @Component({
+        imports: [FormsModule, TuiCheckbox, TuiTable, TuiTableControl],
+        template: `
+            <table
+                tuiTable
+                [(ngModel)]="selected"
+            >
+                @for (item of items; track item) {
+                    <input
+                        tuiCheckbox
+                        type="checkbox"
+                        [tuiCheckboxRow]="item"
+                    />
+                }
+            </table>
+        `,
+        changeDetection: ChangeDetectionStrategy.OnPush,
+    })
+    class Test {
+        public selected: readonly string[] = [];
+
+        protected readonly items = ['a', 'b'];
+    }
+
+    let fixture: ComponentFixture<Test>;
+    let component: Test;
+
+    const checkboxes = (): HTMLInputElement[] =>
+        Array.from(fixture.nativeElement.querySelectorAll('input[tuiCheckbox]'));
+
+    beforeEach(async () => {
+        TestBed.configureTestingModule({imports: [Test]});
+        await TestBed.compileComponents();
+        fixture = TestBed.createComponent(Test);
+        component = fixture.componentInstance;
+    });
+
+    const beforePaint = async (): Promise<void> => Promise.resolve();
+
+    it('checkboxes are not indeterminate before first paint', async () => {
+        fixture.detectChanges();
+        await beforePaint();
+
+        expect(checkboxes().length).toBe(2);
+        checkboxes().forEach((checkbox) => {
+            expect(checkbox.indeterminate).toBe(false);
+        });
+    });
+
+    it('preselected rows are checked and not indeterminate before first paint', async () => {
+        component.selected = ['a'];
+        fixture.detectChanges();
+        await beforePaint();
+
+        const [first, second] = checkboxes();
+
+        expect(first?.checked).toBe(true);
+        expect(first?.indeterminate).toBe(false);
+        expect(second?.checked).toBe(false);
+        expect(second?.indeterminate).toBe(false);
+    });
+});
```

---

### Incident Patch 10: `ae2268ca` (2026-09-28)
**Commit Message**: fix(addon-mobile): reset BottomSheet height on resize (#15094)

**File**: `projects/addon-mobile/components/bottom-sheet/bottom-sheet.component.ts` (modified, +6/-1)
```diff
@@ -22,7 +22,7 @@ import {TUI_BOTTOM_SHEET_OPTIONS} from './bottom-sheet.options';
         '[class._bar]': 'bar()',
         '[style.--t-initial]': 'stops()[0]',
         '[style.scroll-snap-type]': 'stops().length > 1 ? "y mandatory" : null',
-        '(resize)': 'onScroll()',
+        '(resize)': 'onResize()',
         '(scroll.zoneless)': 'onScroll()',
     },
 })
@@ -35,6 +35,11 @@ export class TuiBottomSheet {
     public readonly stops = input(this.options.stops);
     public readonly bar = input(this.options.bar);
 
+    protected onResize(): void {
+        this.el.style.removeProperty('--t-height');
+        this.onScroll();
+    }
+
     protected onScroll(): void {
         const {clientHeight, scrollTop, scrollHeight} = this.el;
         const top = this.elements()[0]?.nativeElement.clientHeight || 0;
```

**File**: `projects/addon-mobile/components/bottom-sheet/bottom-sheet.template.html` (modified, +1/-1)
```diff
@@ -8,7 +8,7 @@
 <div
     #content
     class="t-content"
-    (resize)="onScroll()"
+    (resize)="onResize()"
 >
     <ng-content />
 </div>
```

**File**: `projects/demo-cypress/src/tests/bottom-sheet.cy.ts` (added, +58/-0)
```diff
@@ -0,0 +1,58 @@
+import {ChangeDetectionStrategy, Component} from '@angular/core';
+import {TuiBottomSheet} from '@taiga-ui/addon-mobile';
+
+describe('TuiBottomSheet', () => {
+    @Component({
+        imports: [TuiBottomSheet],
+        template: `
+            <button
+                type="button"
+                (click)="expanded = false"
+            >
+                Reduce content
+            </button>
+            <div class="wrapper">
+                <tui-bottom-sheet [stops]="['5rem', '10rem', '100%']">
+                    @if (expanded) {
+                        @for (_ of '-'.repeat(50); track $index) {
+                            <p>Content</p>
+                        }
+                    }
+                </tui-bottom-sheet>
+            </div>
+        `,
+        styles: `
+            .wrapper {
+                position: relative;
+                block-size: 20rem;
+                overflow: hidden;
+            }
+        `,
+        changeDetection: ChangeDetectionStrategy.OnPush,
+    })
+    class Test {
+        protected expanded = true;
+    }
+
+    beforeEach(() => {
+        cy.viewport(400, 500);
+        cy.mount(Test);
+    });
+
+    it('updates scroll range when content shrinks', () => {
+        cy.get('tui-bottom-sheet')
+            .scrollTo('bottom')
+            .should(($el) => {
+                expect($el[0]!.scrollTop).to.be.greaterThan(0);
+            });
+
+        cy.contains('button', 'Reduce content').click();
+
+        cy.get('tui-bottom-sheet').should(($el) => {
+            const el = $el[0]!;
+
+            expect(el.scrollHeight).to.equal(el.clientHeight);
+            expect(el.scrollTop).to.equal(0);
+        });
+    });
+});
```

#### Recent Merged Pull Requests:
- **PR #15118** (2026-09-30): feat(addon-mobile): `Tabbar` add liquid-glass support (@vladimirpotekhin)
- **PR #15117** (2026-09-29): chore: update dependency @taiga-ui/design-tokens to ~0.324.0 (@taiga-family-bot)
- **PR #15116** (2026-09-30): feat(addon-commerce): `AmountPipe`, `CurrencyPipe` add currency token (@Yanduz)
- **PR #15115** (closed): fix(kit): `Copy` render long text in Safari (@splincode)
- **PR #15113** (closed): fix(core): prevent anchored dropdown jitter in Safari (@splincode)
- **PR #15110** (2026-09-30): feat(kit): `LineClamp` use anchor positioning when possible (@waterplea)
- **PR #15107** (2026-09-29): chore: update dependency @taiga-ui/configs to v0.563.0 (@taiga-family-bot)
- **PR #15106** (closed): feat(kit): add listbox primitive (@splincode)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
