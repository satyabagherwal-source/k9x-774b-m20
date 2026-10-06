# Forensic Learning Record (Deep Inspection): taiga-family/taiga-ui

> **Canonical Artifact**: `07_PROJECT_LEARNING/taiga-family-taiga-ui-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/taiga-family/taiga-ui](https://github.com/taiga-family/taiga-ui))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-06T03:00:51.907Z  
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

### Core Architecture Module: `projects/addon-charts/utils/control-point.ts`
```
import {type TuiPoint} from '@taiga-ui/core/types';

import {tuiLineAngle} from './line-angle';
import {tuiLineLength} from './line-length';

export function tuiControlPoint(
    current?: TuiPoint,
    previous?: TuiPoint,
    next?: TuiPoint,
    reverse = false,
    smoothing = 0.2,
): TuiPoint {
    const fallback = current || ([0, 0] as const);
    const p = previous || current || ([0, 0] as const);
    const n = next || current || ([0, 0] as const);
    const angle = tuiLineAngle(p, n) + (reverse ? Math.PI : 0);
    const length = tuiLineLength(p, n) * smoothing;
    const x = fallback[0] + Math.cos(angle) * length;
    const y = fallback[1] + Math.sin(angle) * length;

    return [x, y];
}

```

### Core Architecture Module: `projects/addon-charts/utils/describe-sector.ts`
```
import {tuiToInt} from '@taiga-ui/cdk/utils/math';

const EMPTY = 'M 100 0 A 100 100 0 1 1 100 0 L 0 0';

function toRadians(deg: number): number {
    return (deg * Math.PI) / 180;
}

/**
 * Describes a normalized sector by angles. Normalized meaning it supposed to work with
 * SVG with viewBox="-1 -1 2 2" so that 0 coordinates in cartesian and polar match the same spot.
 * Everything is multiplied by 100 (including viewBox of SVG to host this) so IE properly
 * handles hover events.
 *
 * @param startAngle starting angle in degrees
 * @param endAngle ending angle in degrees
 */
export function tuiDescribeSector(startAngle = 0, endAngle = 0): string {
    const startRad = toRadians(startAngle);
    const endRad = toRadians(endAngle);
    const startX = Math.cos(startRad) * 100;
    const startY = Math.sin(startRad) * 100;
    const endX = Math.cos(endRad) * 100;
    const endY = Math.sin(endRad) * 100;
    const largeArcFlag = tuiToInt(endAngle - startAngle > 180);

    const result = [
        'M',
        startX,
        startY,
        'A 100 100 0',
        largeArcFlag,
        1,
        endX,
        endY,
        'L 0 0',
    ];

    return Number.isNaN(endX) ? EMPTY : result.join(' ');
}

```

### Core Architecture Module: `projects/addon-charts/utils/draw-curve.ts`
```
import {type TuiPoint} from '@taiga-ui/core/types';

import {tuiControlPoint} from './control-point';

export function tuiDrawCurve(
    array: readonly TuiPoint[],
    index: number,
    smoothing: number,
): string {
    const [cpsX, cpsY] = tuiControlPoint(
        array[index - 1],
        array[index - 2],
        array[index],
        false,
        smoothing,
    );

    const [cpeX, cpeY] = tuiControlPoint(
        array[index],
        array[index - 1],
        array[index + 1],
        true,
        smoothing,
    );

    const point = array[index] ?? [0, 0];

    return `C ${cpsX},${cpsY} ${cpeX},${cpeY} ${point[0]},${point[1]}`;
}

```

### Core Architecture Module: `projects/addon-charts/utils/draw-line.ts`
```
export function tuiDrawLine(point: [number, number]): string {
    return `L ${point}`;
}

```

### Core Architecture Module: `projects/addon-charts/utils/draw.ts`
```
import {type TuiPoint} from '@taiga-ui/core/types';

import {tuiDrawCurve} from './draw-curve';
import {tuiDrawLine} from './draw-line';

const COEFFICIENT = 500;

export function tuiDraw(
    array: readonly TuiPoint[],
    index: number,
    smoothing: number,
): string {
    const point: readonly [number, number] = [...(array[index] ?? [0, 0])];

    return smoothing
        ? tuiDrawCurve(array, index, smoothing / COEFFICIENT)
        : tuiDrawLine([point[0], point[1]]);
}

```

### Core Architecture Module: `projects/addon-charts/utils/index.ts`
```
export * from './control-point';
export * from './describe-sector';
export * from './draw';
export * from './draw-curve';
export * from './draw-line';
export * from './line-angle';
export * from './line-length';

```

### Core Architecture Module: `projects/addon-charts/utils/line-angle.ts`
```
import {type TuiPoint} from '@taiga-ui/core/types';

export function tuiLineAngle(a: TuiPoint, b: TuiPoint): number {
    const x = b[0] - a[0];
    const y = b[1] - a[1];

    return Math.atan2(y, x);
}

```

### Core Architecture Module: `projects/addon-charts/utils/line-length.ts`
```
import {type TuiPoint} from '@taiga-ui/core/types';

export function tuiLineLength(a: TuiPoint, b: TuiPoint): number {
    const x = b[0] - a[0];
    const y = b[1] - a[1];

    return Math.sqrt(x ** 2 + y ** 2);
}

```

### Core Architecture Module: `projects/addon-commerce/pipes/amount/amount.utils.ts`
```
import {CHAR_MINUS, CHAR_PLUS} from '@taiga-ui/cdk/constants';

import {type TuiAmountSign, type TuiAmountSignSymbol} from './amount.types';

export function tuiFormatSignSymbol(
    value: number,
    sign: TuiAmountSign,
): TuiAmountSignSymbol {
    if (sign === 'never' || !value || (sign === 'negative-only' && value > 0)) {
        return '';
    }

    return sign === 'force-negative' || (value < 0 && sign !== 'force-positive')
        ? CHAR_MINUS
        : CHAR_PLUS;
}

```

### Core Architecture Module: `projects/addon-commerce/utils/format-currency.ts`
```
import {type TuiCurrencyVariants} from '@taiga-ui/addon-commerce/types';

import {tuiGetCurrencySymbol} from './get-currency-symbol';

/**
 * @deprecated Use {@link tuiGetCurrencySymbol} instead.
 * TODO(v6): delete
 */
export function tuiFormatCurrency(currency: TuiCurrencyVariants): string {
    const fallback =
        typeof currency === 'number' ? String(currency).padStart(3, '0') : currency;

    return tuiGetCurrencySymbol(currency) ?? fallback ?? '';
}

```

### Core Architecture Module: `projects/addon-commerce/utils/get-code-by-currency.ts`
```
// cspell:disable
import {TuiCurrency, TuiCurrencyCode} from '@taiga-ui/addon-commerce/types';

export const TUI_CODE_DICTIONARY: Record<TuiCurrency, TuiCurrencyCode> = {
    [TuiCurrency.Ruble]: TuiCurrencyCode.Ruble,
    [TuiCurrency.Dollar]: TuiCurrencyCode.Dollar,
    [TuiCurrency.MexicanPeso]: TuiCurrencyCode.MexicanPeso,
    [TuiCurrency.MoldovanLeu]: TuiCurrencyCode.MoldovanLeu,
    [TuiCurrency.PolandZloty]: TuiCurrencyCode.PolandZloty,
    [TuiCurrency.SingaporeDollar]: TuiCurrencyCode.SingaporeDollar,
    [TuiCurrency.AustralianDollar]: TuiCurrencyCode.AustralianDollar,
    [TuiCurrency.HongKongDollar]: TuiCurrencyCode.HongKongDollar,
    [TuiCurrency.CanadianDollar]: TuiCurrencyCode.CanadianDollar,
    [TuiCurrency.CzechKoruna]: TuiCurrencyCode.CzechKoruna,
    [TuiCurrency.EastCaribbeanDollar]: TuiCurrencyCode.EastCaribbeanDollar,
    [TuiCurrency.Euro]: TuiCurrencyCode.Euro,
    [TuiCurrency.Forint]: TuiCurrencyCode.Forint,
    [TuiCurrency.Pound]: TuiCurrencyCode.Pound,
    [TuiCurrency.Baht]: TuiCurrencyCode.Baht,
    [TuiCurrency.BahrainiDinar]: TuiCurrencyCode.BahrainiDinar,
    [TuiCurrency.TurkishLira]: TuiCurrencyCode.TurkishLira,
    [TuiCurrency.YuanRenminbi]: TuiCurrencyCode.YuanRenminbi,
    [TuiCurrency.Yen]: TuiCurrencyCode.Yen,
    [TuiCurrency.IsraeliShekel]: TuiCurrencyCode.IsraeliShekel,
    [TuiCurrency.IndianRupee]: TuiCurrencyCode.IndianRupee,
    [TuiCurrency.SwissFranc]: TuiCurrencyCode.SwissFranc,
    [TuiCurrency.ArmenianDram]: TuiCurrencyCode.ArmenianDram,
    [TuiCurrency.Won]: TuiCurrencyCode.Won,
    [TuiCurrency.Tenge]: TuiCurrencyCode.Tenge,
    [TuiCurrency.Hryvnia]: TuiCurrencyCode.Hryvnia,
    [TuiCurrency.UzbekSum]: TuiCurrencyCode.UzbekSum,
    [TuiCurrency.KyrgyzstanSom]: TuiCurrencyCode.KyrgyzstanSom,
    [TuiCurrency.Dirham]: TuiCurrencyCode.Dirham,
    [TuiCurrency.TajikistaniSomoni]: TuiCurrencyCode.TajikistaniSomoni,
    [TuiCurrency.MalaysianRinggit]: TuiCurrencyCode.MalaysianRinggit,
    [TuiCurrency.BelarusianRuble]: TuiCurrencyCode.BelarusianRuble,
    [TuiCurrency.GeorgianLari]: TuiCurrencyCode.GeorgianLari,
    [TuiCurrency.AzerbaijaniManat]: TuiCurrencyCode.AzerbaijaniManat,
    [TuiCurrency.SriLankanRupee]: TuiCurrencyCode.SriLankanRupee,
    [TuiCurrency.SerbianDinar]: TuiCurrencyCode.SerbianDinar,
    [TuiCurrency.SaudiRiyal]: TuiCurrencyCode.SaudiRiyal,
    [TuiCurrency.MongolianTugrik]: TuiCurrencyCode.MongolianTugrik,
    [TuiCurrency.SouthAfricanRand]: TuiCurrencyCode.SouthAfricanRand,
    [TuiCurrency.IranianRial]: TuiCurrencyCode.IranianRial,
    [TuiCurrency.IndonesianRupiah]: TuiCurrencyCode.IndonesianRupiah,
    [TuiCurrency.VietnameseDong]: TuiCurrencyCode.VietnameseDong,
    [TuiCurrency.NewTurkmenManat]: TuiCurrencyCode.NewTurkmenManat,
    [TuiCurrency.BrazilianReal]: TuiCurrencyCode.BrazilianReal,
    [TuiCurrency.ArgentinePeso]: TuiCurrencyCode.ArgentinePeso,
    [TuiCurrency.CambodianRiel]: TuiCurrencyCode.CambodianRiel,
    [TuiCurrency.ChileanPeso]: TuiCurrencyCode.ChileanPeso,
    [TuiCurrency.EgyptianPound]: TuiCurrencyCode.EgyptianPound,
    [TuiCurrency.KenyanShilling]: TuiCurrencyCode.KenyanShilling,
    [TuiCurrency.LaoKip]: TuiCurrencyCode.LaoKip,
    [TuiCurrency.MaldivianRufiyaa]: TuiCurrencyCode.MaldivianRufiyaa,
    [TuiCurrency.PeruvianSol]: TuiCurrencyCode.PeruvianSol,
    [TuiCurrency.PhilippinePeso]: TuiCurrencyCode.PhilippinePeso,
    [TuiCurrency.TanzanianShilling]: TuiCurrencyCode.TanzanianShilling,
    [TuiCurrency.UnidadDeFomento]: TuiCurrencyCode.UnidadDeFomento,
};

export function tuiGetCodeByCurrency(code: TuiCurrency): TuiCurrencyCode | null {
    return TUI_CODE_DICTIONARY[code] ?? null;
}

```

### Core Architecture Module: `projects/addon-commerce/utils/get-currency-by-code.ts`
```
// cspell:disable
import {TuiCurrency, TuiCurrencyCode} from '@taiga-ui/addon-commerce/types';

export const TUI_CURRENCY_DICTIONARY: Record<TuiCurrencyCode, TuiCurrency> = {
    [TuiCurrencyCode.Ruble]: TuiCurrency.Ruble,
    [TuiCurrencyCode.Dollar]: TuiCurrency.Dollar,
    [TuiCurrencyCode.MexicanPeso]: TuiCurrency.MexicanPeso,
    [TuiCurrencyCode.MoldovanLeu]: TuiCurrency.MoldovanLeu,
    [TuiCurrencyCode.PolandZloty]: TuiCurrency.PolandZloty,
    [TuiCurrencyCode.SingaporeDollar]: TuiCurrency.SingaporeDollar,
    [TuiCurrencyCode.AustralianDollar]: TuiCurrency.AustralianDollar,
    [TuiCurrencyCode.HongKongDollar]: TuiCurrency.HongKongDollar,
    [TuiCurrencyCode.CanadianDollar]: TuiCurrency.CanadianDollar,
    [TuiCurrencyCode.CzechKoruna]: TuiCurrency.CzechKoruna,
    [TuiCurrencyCode.EastCaribbeanDollar]: TuiCurrency.EastCaribbeanDollar,
    [TuiCurrencyCode.Euro]: TuiCurrency.Euro,
    [TuiCurrencyCode.Forint]: TuiCurrency.Forint,
    [TuiCurrencyCode.Pound]: TuiCurrency.Pound,
    [TuiCurrencyCode.Baht]: TuiCurrency.Baht,
    [TuiCurrencyCode.BahrainiDinar]: TuiCurrency.BahrainiDinar,
    [TuiCurrencyCode.TurkishLira]: TuiCurrency.TurkishLira,
    [TuiCurrencyCode.YuanRenminbi]: TuiCurrency.YuanRenminbi,
    [TuiCurrencyCode.Yen]: TuiCurrency.Yen,
    [TuiCurrencyCode.IsraeliShekel]: TuiCurrency.IsraeliShekel,
    [TuiCurrencyCode.IndianRupee]: TuiCurrency.IndianRupee,
    [TuiCurrencyCode.SwissFranc]: TuiCurrency.SwissFranc,
    [TuiCurrencyCode.ArmenianDram]: TuiCurrency.ArmenianDram,
    [TuiCurrencyCode.Won]: TuiCurrency.Won,
    [TuiCurrencyCode.Tenge]: TuiCurrency.Tenge,
    [TuiCurrencyCode.Hryvnia]: TuiCurrency.Hryvnia,
    [TuiCurrencyCode.UzbekSum]: TuiCurrency.UzbekSum,
    [TuiCurrencyCode.KyrgyzstanSom]: TuiCurrency.KyrgyzstanSom,
    [TuiCurrencyCode.Dirham]: TuiCurrency.Dirham,
    [TuiCurrencyCode.TajikistaniSomoni]: TuiCurrency.TajikistaniSomoni,
    [TuiCurrencyCode.MalaysianRinggit]: TuiCurrency.MalaysianRinggit,
    [TuiCurrencyCode.BelarusianRuble]: TuiCurrency.BelarusianRuble,
    [TuiCurrencyCode.GeorgianLari]: TuiCurrency.GeorgianLari,
    [TuiCurrencyCode.AzerbaijaniManat]: TuiCurrency.AzerbaijaniManat,
    [TuiCurrencyCode.SriLankanRupee]: TuiCurrency.SriLankanRupee,
    [TuiCurrencyCode.SerbianDinar]: TuiCurrency.SerbianDinar,
    [TuiCurrencyCode.SaudiRiyal]: TuiCurrency.SaudiRiyal,
    [TuiCurrencyCode.MongolianTugrik]: TuiCurrency.MongolianTugrik,
    [TuiCurrencyCode.SouthAfricanRand]: TuiCurrency.SouthAfricanRand,
    [TuiCurrencyCode.IranianRial]: TuiCurrency.IranianRial,
    [TuiCurrencyCode.IndonesianRupiah]: TuiCurrency.IndonesianRupiah,
    [TuiCurrencyCode.VietnameseDong]: TuiCurrency.VietnameseDong,
    [TuiCurrencyCode.NewTurkmenManat]: TuiCurrency.NewTurkmenManat,
    [TuiCurrencyCode.BrazilianReal]: TuiCurrency.BrazilianReal,
    [TuiCurrencyCode.ArgentinePeso]: TuiCurrency.ArgentinePeso,
    [TuiCurrencyCode.CambodianRiel]: TuiCurrency.CambodianRiel,
    [TuiCurrencyCode.ChileanPeso]: TuiCurrency.ChileanPeso,
    [TuiCurrencyCode.EgyptianPound]: TuiCurrency.EgyptianPound,
    [TuiCurrencyCode.KenyanShilling]: TuiCurrency.KenyanShilling,
    [TuiCurrencyCode.LaoKip]: TuiCurrency.LaoKip,
    [TuiCurrencyCode.MaldivianRufiyaa]: TuiCurrency.MaldivianRufiyaa,
    [TuiCurrencyCode.PeruvianSol]: TuiCurrency.PeruvianSol,
    [TuiCurrencyCode.PhilippinePeso]: TuiCurrency.PhilippinePeso,
    [TuiCurrencyCode.TanzanianShilling]: TuiCurrency.TanzanianShilling,
    [TuiCurrencyCode.UnidadDeFomento]: TuiCurrency.UnidadDeFomento,
};

export function tuiGetCurrencyByCode(currency: TuiCurrencyCode): TuiCurrency | null {
    return TUI_CURRENCY_DICTIONARY[currency] ?? null;
}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #15156** (2026-10-05): **chore: update dependency @taiga-ui/configs to v0.564.0**
  *Symptoms*: This PR contains the following updates:  | Package | Update | Change | |---|---|---| | [@taiga-ui/configs](https://redirect.github.com/taiga-family/toolkit) | minor | [`0.563.0` → `0.564.0`](https://renovatebot.com/diffs/npm/@taiga-ui%2fconfigs/0.563.0/0.564.0) |  ---   - [ ] <!-- rebase-check -->If you want to rebase/retry this PR, check this box  ---  This PR has been generated by [Mend Renovate CLI](https://redirect.github.com/renovatebot/renovate). <!--renovate-debug:eyJjcmVhdGVkSW5WZXIiOiI0NC4xMzUuMCIsInVwZGF0ZWRJblZlciI6IjQ0LjEzNS4wIiwidGFyZ2V0QnJhbmNoIjoibWFpbiIsImxhYmVscyI6W119-->   <!-- This is an auto-generated comment: release notes by coderabbit.ai -->  ## Summary by CodeRabbit  * **Chores**   * Updated the development tooling configuration package to a newer version.  <!-- end of auto-generated comment: release notes by coderabbit.ai -->
  **Post-Mortem & Fix Analysis**:
  > <!-- This is an auto-generated comment: summarize by coderabbit.ai --> <!-- review_stack_entry_start -->  <a href="https://app.coderabbit.ai/change-stack/taiga-family/taiga-ui/pull/15156?scope=ghh_OusAJGA4HG8ljoOV0wJvVx8NmnZIjc2DdjmxOu0xZWA&amp;cs_source=review_comment"><img src="https://storage.googleapis.com/coderabbit_public_assets/review-stack-in-coderabbit-ui-dark.svg?v=2" alt="Review in Change Stack →" width="220" height="32"></a>  <!-- review_stack_entry_end --> <!-- recent_review_start -->  No actionable comments were generated in the recent review. 🎉  <details> <summary>ℹ️ Recent review info</summary>  <details> <summary>⚙️ Run configuration</summary>  - **Configuration used**: defaults - **Review profile**: CHILL - **Plan**: Advanced - **Run ID**: `4dcadd85-90c5-4dba-8b68-89cfdfea9b53`  </details>  <details> <summary>📥 Commits</summary>  Reviewing files that changed from the base of the PR and between a8eb57b674a2f26ef67f56b9fad8fde812a3289d and 0c7924cceeebcc0b02ebe814690f
  > <!-- screenshot-bot-id: test-report -->  # Pull request was closed :heavy_check_mark:  All saved screenshots (for current PR) were deleted :wastebasket:
  > <!-- MURMUR_IGNORE --> #### Approvability  **Verdict:** Approved at `0c7924c`  Macroscope's review found this PR approvable — This generated update only changes development dependency and lockfile metadata for @taiga-ui/configs and related tooling packages. It does not modify production source, APIs, schemas, deployment configuration, or customer request behavior.  **Notes:** - No code objects were reviewed. Approvability was decided on eligibility alone.  <sup>You can add or adjust custom eligibility rules. [Learn more](https://docs.macroscope.com/approvability#example-custom-eligibility-rules).</sup> <!-- macroscope-meta: {"kind":"approvability"} -->

- **Issue #15155** (2026-10-05): **chore: update dependency @types/node to v25.9.8**
  *Symptoms*: This PR contains the following updates:  | Package | Update | Change | |---|---|---| | [@types/node](https://redirect.github.com/DefinitelyTyped/DefinitelyTyped/tree/master/types/node) ([source](https://redirect.github.com/DefinitelyTyped/DefinitelyTyped/tree/HEAD/types/node)) | patch | [`25.9.6` → `25.9.8`](https://renovatebot.com/diffs/npm/@types%2fnode/25.9.6/25.9.8) |  ---   - [ ] <!-- rebase-check -->If you want to rebase/retry this PR, check this box  ---  This PR has been generated by [Mend Renovate CLI](https://redirect.github.com/renovatebot/renovate). <!--renovate-debug:eyJjcmVhdGVkSW5WZXIiOiI0NC4xMzMuMCIsInVwZGF0ZWRJblZlciI6IjQ0LjEzMy4wIiwidGFyZ2V0QnJhbmNoIjoibWFpbiIsImxhYmVscyI6W119-->   <!-- This is an auto-generated comment: release notes by coderabbit.ai -->  ## Summary by CodeRabbit  * **Chores**   * Updated development tooling. This maintenance change does not alter the app’s features, interface, or behavior, so there are no new actions or changes for users to learn. No user-facing fixes or enhancements are included in this update.  <!-- end of auto-generated comment: release notes by coderabbit.ai -->
  **Post-Mortem & Fix Analysis**:
  > <!-- MURMUR_IGNORE --> #### Approvability  **Verdict:** Not approved  Macroscope's review found this PR not approvable — This is a narrowly scoped automated @types/node update confined to ignored package metadata and lockfile paths, with no apparent application runtime or schema impact. Both changed files are explicitly owned by the core team rather than the author, so ownership context should be confirmed by a human reviewer.  **Notes:** - Diff unchanged. Approvability was decided on eligibility alone.  <sup>You can add or adjust custom eligibility rules. [Learn more](https://docs.macroscope.com/approvability#example-custom-eligibility-rules).</sup> <!-- macroscope-meta: {"kind":"approvability"} -->
  > <!-- This is an auto-generated comment: summarize by coderabbit.ai --> <!-- review_stack_entry_start -->  <a href="https://app.coderabbit.ai/change-stack/taiga-family/taiga-ui/pull/15155?scope=ghh_OusAJGA4HG8ljoOV0wJvVx8NmnZIjc2DdjmxOu0xZWA&amp;cs_source=review_comment"><img src="https://storage.googleapis.com/coderabbit_public_assets/review-stack-in-coderabbit-ui-dark.svg?v=2" alt="Review in Change Stack →" width="220" height="32"></a>  Navigate logical layers of code changes, visualize relationships, and explore their blast radius.  <!-- review_stack_entry_end --> <!-- recent_review_start -->  No actionable comments were generated in the recent review. 🎉  <details> <summary>ℹ️ Recent review info</summary>  <details> <summary>⚙️ Run configuration</summary>  - **Configuration used**: defaults - **Review profile**: CHILL - **Plan**: Advanced - **Run ID**: `cbf06229-dbb5-4bd8-a92a-4194e2c444ce`  </details>  <details> <summary>📥 Commits</summary>  Reviewing files that changed from the b
  > <!-- screenshot-bot-id: test-report -->  # Pull request was closed :heavy_check_mark:  All saved screenshots (for current PR) were deleted :wastebasket:

- **Issue #15152** (2026-10-05): **🚀 Release/v5.27.0**
  *Symptoms*: ## [5.27.0](https://github.com/taiga-family/taiga-ui/compare/v5.26.0...v5.27.0) (2026-10-05)  ### 🚀 Features  - **addon-mobile:** `SearchBar` support progressive blur   ([#15145](https://github.com/taiga-family/taiga-ui/issues/15145))   ([8d0c3cb](https://github.com/taiga-family/taiga-ui/commit/8d0c3cb4e4c989bc5d594a0f7fcadcf55aa0b60e)) - **kit:** `LineClamp` use anchor positioning when possible   ([#15110](https://github.com/taiga-family/taiga-ui/issues/15110))   ([32752fd](https://github.com/taiga-family/taiga-ui/commit/32752fde94b78f5d52adaa0d39b1016260558b3e))  ### 🐞 Bug Fixes  - **addon-table:** `TableControl` supports Signal Forms   ([#15090](https://github.com/taiga-family/taiga-ui/issues/15090))   ([89f46ad](https://github.com/taiga-family/taiga-ui/commit/89f46ad993ad14e48dbb618a75a935b8b1eaae1a)) - **addon-table:** prevent initial tuiSortChange emit ([#15081](https://github.com/taiga-family/taiga-ui/issues/15081))   ([ae5b993](https://github.com/taiga-family/taiga-ui/commit/ae5b993238292fb23a49f7a3d654262d70f9e44b)) - **cdk:** preserve synchronous control value resets ([#15128](https://github.com/taiga-family/taiga-ui/issues/15128))   ([123114d](https://github.com/taiga-family/taiga-ui/commit/123114d91c1a6bd1613fadb71583d870f3f3374e)) - **core:** `Cell` respect appearance background on hover   ([#15123](https://github.com/taiga-family/taiga-ui/issues/15123))   ([1cce3a8](https://github.com/taiga-family/taiga-ui/commit/1cce3a8801c47b514c6cd632fafd4b35ab457c24)) - **
  **Post-Mortem & Fix Analysis**:
  > <!-- This is an auto-generated comment: summarize by coderabbit.ai --> <!-- review_stack_entry_start -->  <a href="https://app.coderabbit.ai/change-stack/taiga-family/taiga-ui/pull/15152?scope=ghh_OusAJGA4HG8ljoOV0wJvVx8NmnZIjc2DdjmxOu0xZWA&amp;cs_source=review_comment"><img src="https://storage.googleapis.com/coderabbit_public_assets/review-stack-in-coderabbit-ui-dark.svg?v=2" alt="Review in Change Stack →" width="220" height="32"></a>  Navigate logical layers of code changes, visualize relationships, and explore their blast radius.  <!-- review_stack_entry_end --> <details> <summary>🧰 Additional context used</summary>  <details> <summary>📚 Code guidelines (1)</summary>  ``` AGENTS.md — auto-discovered ```  </details>  </details> <!-- walkthrough_start -->  <details> <summary>📝 Walkthrough</summary>  ## Walkthrough  This release update adds the 5.27.0 changelog entry and updates package versions and Taiga UI dependency requirements from 5.26.0 to 5.27.0.  ### Changes  **5.27.0 Rele
  > <!-- MURMUR_IGNORE --> #### Approvability  **Verdict:** Not approved  Macroscope's review found this PR not approvable — This PR is a routine v5.27.0 release update affecting changelog, package metadata, lockfile versions, and the shared runtime version constant, with no new implementation logic. All changed files are explicitly owned by the core team rather than the release bot, so designated-owner review is appropriate.  <sup>You can add or adjust custom eligibility rules. [Learn more](https://docs.macroscope.com/approvability#example-custom-eligibility-rules).</sup> <!-- macroscope-meta: {"kind":"approvability"} -->
  > <h3>🚨 NPM Audit Error</h3> <p><strong>141 vulnerabilities (2 low, 17 moderate, 120 high, 2 critical)</strong></p>  <details> <summary>Show details</summary>  ``` # npm audit report  @angular/common  <lt;=19.2.25 Severity: high Depends on vulnerable versions of @angular/core @angular/common: Denial of Service (DoS) via OOM in Date Formatting (formatDate) - https://github.com/advisories/GHSA-48r7-hpm6-gfxm @angular/common: Weak 32-Bit Cache Key Hashing in `HttpTransferCache` Leading to Cross-Request Data Leakage and State Poisoning - https://github.com/advisories/GHSA-39pv-4j6c-2g6v Angular: Cache-Key Ambiguity in HttpTransferCache Leading to Cross-Request Response Reuse and State Poisoning - https://github.com/advisories/GHSA-jhpw-976m-542j Angular: Information Leak via `HttpTransferCache` Bypass When Using `withRequestsMadeViaParent` - https://github.com/advisories/GHSA-p297-fm68-3q8c fix available via `npm audit fix --force` Will install @angular/platform-server@22.2.1, which is a br

- **Issue #15151** (2026-10-05): **🚀 Release/v4.102.0**
  *Symptoms*: ## [4.102.0](https://github.com/taiga-family/taiga-ui/compare/v4.101.0...v4.102.0) (2026-10-05)  ### 🚀 Features  - **addon-commerce:** `AmountPipe`, `CurrencyPipe` add currency token   ([#15116](https://github.com/taiga-family/taiga-ui/issues/15116))   ([3fcd60d](https://github.com/taiga-family/taiga-ui/commit/3fcd60db9a274c12a6f0945cb113b866c3e55062)) - **addon-mobile:** `SearchBar` add new component ([#15122](https://github.com/taiga-family/taiga-ui/issues/15122))   ([397399b](https://github.com/taiga-family/taiga-ui/commit/397399b93d66ac8e06204247d17091bef4d08c98)) - **addon-mobile:** `Tabbar` add liquid-glass support ([#15118](https://github.com/taiga-family/taiga-ui/issues/15118))   ([21da998](https://github.com/taiga-family/taiga-ui/commit/21da998257548bc76500c459c98bc8c719b20628)) - **kit:** unshrink dot for status ([#15137](https://github.com/taiga-family/taiga-ui/issues/15137))   ([34d01d8](https://github.com/taiga-family/taiga-ui/commit/34d01d8cc7910831dc4acdaa9927aa7c753374ee)) - **layout:** `AppBar` add liquid-glass support ([#15101](https://github.com/taiga-family/taiga-ui/issues/15101))   ([6171153](https://github.com/taiga-family/taiga-ui/commit/617115388bd4afceae96a39845665064bbcb15bc))  ### 🐞 Bug Fixes  - **kit:** render long Copy text in Safari ([#15150](https://github.com/taiga-family/taiga-ui/issues/15150))   ([abf3d73](https://github.com/taiga-family/taiga-ui/commit/abf3d73be6c355808b23be5d2b5a2d56fef0de35)) - **layout:** fixed mobile tui-list margin-in
  **Post-Mortem & Fix Analysis**:
  > <!-- This is an auto-generated comment: summarize by coderabbit.ai --> <!-- This is an auto-generated comment: skip review by coderabbit.ai -->  > [!IMPORTANT] > ## Review skipped >  > Auto reviews are disabled on base/target branches other than the default branch. >  >  >  > Please check the settings in the CodeRabbit UI or the `.coderabbit.yaml` file in this repository. To trigger a single review, invoke the `@coderabbitai review` command. >  > <details> > <summary>⚙️ Run configuration</summary> >  > - **Configuration used**: defaults > - **Review profile**: CHILL > - **Plan**: Advanced > - **Run ID**: `9da43383-e5b0-4600-b773-4c3c84617374` >  > </details> >  > You can disable this status message by setting the `reviews.review_status` to `false` in the CodeRabbit configuration file. >  > Use the checkbox below for a quick retry: > - [ ] <!-- {"checkboxId":"e9bb8d72-00e8-4f67-9cb2-caf3b22574fe"} --> 🔍 Trigger review  <!-- end of auto-generated comment: skip review by coderabbit.ai --
  > <!-- MURMUR_IGNORE --> #### Approvability  **Verdict:** Not approved  Macroscope's review found this PR not approvable — This is a mechanical 4.102.0 release synchronization across manifests, lockfile metadata, version selectors, and changelog content, with no new runtime logic or workflow. All changed files are assigned to the core team while the submitting bot is not listed as their owner, so designated-owner review is appropriate.  <sup>You can add or adjust custom eligibility rules. [Learn more](https://docs.macroscope.com/approvability#example-custom-eligibility-rules).</sup> <!-- macroscope-meta: {"kind":"approvability"} -->

- **Issue #15150** (2026-10-05): **fix(kit): render long Copy text in Safari**
  *Symptoms*: Cherry pick
  **Post-Mortem & Fix Analysis**:
  > <!-- This is an auto-generated comment: summarize by coderabbit.ai --> <!-- This is an auto-generated comment: skip review by coderabbit.ai -->  > [!IMPORTANT] > ## Review skipped >  > Auto reviews are disabled on base/target branches other than the default branch. >  >  >  > Please check the settings in the CodeRabbit UI or the `.coderabbit.yaml` file in this repository. To trigger a single review, invoke the `@coderabbitai review` command. >  > <details> > <summary>⚙️ Run configuration</summary> >  > - **Configuration used**: defaults > - **Review profile**: CHILL > - **Plan**: Advanced > - **Run ID**: `89894f52-a356-4f0c-94fb-34639e67afaf` >  > </details> >  > You can disable this status message by setting the `reviews.review_status` to `false` in the CodeRabbit configuration file. >  > Use the checkbox below for a quick retry: > - [ ] <!-- {"checkboxId":"e9bb8d72-00e8-4f67-9cb2-caf3b22574fe"} --> 🔍 Trigger review  <!-- end of auto-generated comment: skip review by coderabbit.ai --
  > <!-- screenshot-bot-id: test-report -->   <h1>Failed tests :x:</h1>  <h3 align="center">Before (main) ← Diff → After (local)</h3>   <details open>     <summary><strong>tests-kit-action-bar-action-bar.mobile.pw-ActionBar-works-chromium-retry2/01-action-bar-mobile-expanded.diff.png</strong></summary>     <img src="https://raw.githubusercontent.com/taiga-family/taiga-ui/screenshot-bot-storage/__bot-screenshots/taiga-family-taiga-ui-15150/37288825827-0.png" /> </details>  <details open>     <summary><strong>tests-kit-input-chip-scrol-86a75-nd-chip-in-narrow-container-chromium-retry2/input-chip-scrolled.diff.png</strong></summary>     <img src="https://raw.githubusercontent.com/taiga-family/taiga-ui/screenshot-bot-storage/__bot-screenshots/taiga-family-taiga-ui-15150/37288825827-1.png" /> </details>   <br />   <sub>(updated for commit 29a9e38d1cfbbc0432e65d867d41e4f07306da05)</sub> 
  > ## [Codecov](https://app.codecov.io/gh/taiga-family/taiga-ui/pull/15150?dropdown=coverage&src=pr&el=h1&utm_medium=referral&utm_source=github&utm_content=comment&utm_campaign=pr+comments&utm_term=taiga-family) Report :white_check_mark: All modified and coverable lines are covered by tests. :white_check_mark: Project coverage is 64.53%. Comparing base ([`555fd7e`](https://app.codecov.io/gh/taiga-family/taiga-ui/commit/555fd7e3d52d8fefff9733ba3677524607d4b6c9?dropdown=coverage&el=desc&utm_medium=referral&utm_source=github&utm_content=comment&utm_campaign=pr+comments&utm_term=taiga-family)) to head ([`29a9e38`](https://app.codecov.io/gh/taiga-family/taiga-ui/commit/29a9e38d1cfbbc0432e65d867d41e4f07306da05?dropdown=coverage&el=desc&utm_medium=referral&utm_source=github&utm_content=comment&utm_campaign=pr+comments&utm_term=taiga-family)).  <details><summary>Additional details and impacted files</summary>    ```diff @@           Coverage Diff           @@ ##             v4.x   #15150   +/-   

- **Issue #15149** (2026-10-05): **chore: pin ng-web-apis version for stackblitz**
  *Symptoms*: Fixes # <!-- link to a relevant issue. -->   <!-- This is an auto-generated comment: release notes by coderabbit.ai -->  ## Summary by CodeRabbit  * **Bug Fixes**   * Improved compatibility when opening demos in StackBlitz.  <!-- end of auto-generated comment: release notes by coderabbit.ai -->
  **Post-Mortem & Fix Analysis**:
  > <!-- screenshot-bot-id: test-report -->  # Pull request was closed :heavy_check_mark:  All saved screenshots (for current PR) were deleted :wastebasket:
  > <!-- This is an auto-generated comment: summarize by coderabbit.ai --> <!-- review_stack_entry_start -->  <a href="https://app.coderabbit.ai/change-stack/taiga-family/taiga-ui/pull/15149?scope=ghh_OusAJGA4HG8ljoOV0wJvVx8NmnZIjc2DdjmxOu0xZWA&amp;cs_source=review_comment"><img src="https://storage.googleapis.com/coderabbit_public_assets/review-stack-in-coderabbit-ui-dark.svg?v=2" alt="Review in Change Stack →" width="220" height="32"></a>  Navigate logical layers of code changes, visualize relationships, and explore their blast radius.  <!-- review_stack_entry_end --> <details> <summary>🧰 Additional context used</summary>  <details> <summary>📚 Code guidelines (1)</summary>  ``` AGENTS.md — auto-discovered ```  </details>  </details> <!-- recent_review_start -->  No actionable comments were generated in the recent review. 🎉  <details> <summary>ℹ️ Recent review info</summary>  <details> <summary>⚙️ Run configuration</summary>  - **Configuration used**: defaults - **Review profile**: CHI
  > <!-- MURMUR_IGNORE --> #### Approvability  **Verdict:** Approved at `65e3d27`  Macroscope's review found this PR approvable — This single-file change pins six StackBlitz-only @ng-web-apis dependencies to 5.3.0 to avoid a known missing-entrypoint resolution issue. Its effect is limited to generated StackBlitz projects and does not change Taiga UI production behavior.  <sup>You can add or adjust custom eligibility rules. [Learn more](https://docs.macroscope.com/approvability#example-custom-eligibility-rules).</sup> <!-- macroscope-meta: {"kind":"approvability"} -->

- **Issue #15147** (2026-10-05): **feat(cdk): add readonly control option**
  *Symptoms*: Fixes #3868   <!-- This is an auto-generated comment: release notes by coderabbit.ai -->  ## Summary by CodeRabbit  * **New Features**   * Added a shared readonly setting for controls and inputs. When enabled, controls and input elements reflect the readonly state, and updates to the setting take effect dynamically.  <!-- end of auto-generated comment: release notes by coderabbit.ai -->
  **Post-Mortem & Fix Analysis**:
  > <!-- screenshot-bot-id: test-report -->  # Tests completed successfully :white_check_mark:  Good job :fire:
  > <!-- This is an auto-generated comment: summarize by coderabbit.ai --> <!-- review_stack_entry_start -->  <a href="https://app.coderabbit.ai/change-stack/taiga-family/taiga-ui/pull/15147?scope=ghh_OusAJGA4HG8ljoOV0wJvVx8NmnZIjc2DdjmxOu0xZWA&amp;cs_source=review_comment"><img src="https://storage.googleapis.com/coderabbit_public_assets/review-stack-in-coderabbit-ui-dark.svg?v=2" alt="Review in Change Stack →" width="220" height="32"></a>  Navigate logical layers of code changes, visualize relationships, and explore their blast radius.  <!-- review_stack_entry_end --> <details> <summary>🧰 Additional context used</summary>  <details> <summary>📚 Code guidelines (1)</summary>  ``` AGENTS.md — auto-discovered ```  </details>  </details> <!-- recent_review_start -->  No actionable comments were generated in the recent review. 🎉  <details> <summary>ℹ️ Recent review info</summary>  <details> <summary>⚙️ Run configuration</summary>  - **Configuration used**: defaults - **Review profile**: CHI
  > <!-- bundlemon --> ## BundleMon                       <details> <summary>Unchanged files (2)</summary>  Status | Path | Size | Limits :------------: | ------------ | :------------: | :------------: :white_check_mark: | demo/browser/styles-(hash).css<br/> | 22.32KB | +10% :white_check_mark: | demo/browser/main-(hash).js<br/> | 1.03KB | +10% </details>    Total files change -3B -0.01%                  <details open> <summary>Groups updated (1)</summary>  Status | Path | Size | Limits :------------: | ------------ | :------------: | :------------: :white_check_mark: | demo/browser/*.js<br/> | 3.4MB (+1.62KB +0.05%) | - </details>          Final result: :white_check_mark:  [View report in BundleMon website ➡️](https://app.bundlemon.dev/projects/64d3a0c709a579b8d4912225/reports/6ac11292bcd3d5d99bbc248a)  --- <p align="center"><a href="https://app.bundlemon.dev/projects/64d3a0c709a579b8d4912225/reports?branch=feat%2Fcontrol-readonly-options&resolution=all" target="_blank" rel="noreferrer noo

- **Issue #15146** (2026-10-05): **fix(kit): preserve digits when filling input number with postfix**
  *Symptoms*: Fixes #15144   <!-- This is an auto-generated comment: release notes by coderabbit.ai -->  ## Summary by CodeRabbit  * **Bug Fixes**   * Empty number fields now display their configured prefix and suffix when focused, with the caret positioned after the prefix.   * Readonly empty fields remain empty, and entering a value into a focused field moves the caret to the end.   * Currency fields accept values after being cleared and blurred, and display the entered amount with the currency suffix.  <!-- end of auto-generated comment: release notes by coderabbit.ai -->
  **Post-Mortem & Fix Analysis**:
  > <!-- screenshot-bot-id: test-report -->  # Tests completed successfully :white_check_mark:  Good job :fire:
  > <!-- This is an auto-generated comment: summarize by coderabbit.ai --> <!-- review_stack_entry_start -->  <a href="https://app.coderabbit.ai/change-stack/taiga-family/taiga-ui/pull/15146?cs_source=review_comment"><img src="https://storage.googleapis.com/coderabbit_public_assets/review-stack-in-coderabbit-ui-dark.svg?v=2" alt="Review in Change Stack →" width="220" height="32"></a>  Navigate logical layers of code changes, visualize relationships, and explore their blast radius.  <!-- review_stack_entry_end --> <!-- recent_review_start -->  No actionable comments were generated in the recent review. 🎉  <details> <summary>ℹ️ Recent review info</summary>  <details> <summary>⚙️ Run configuration</summary>  **Configuration used**: defaults  **Review profile**: CHILL  **Plan**: Advanced  **Run ID**: `0347f1a0-77c6-409b-850e-1f0601d780b3`  </details>  <details> <summary>📥 Commits</summary>  Reviewing files that changed from the base of the PR and between beb0eff0c595031a68fd40dd7b4b7cbe0c9ec
  > <!-- bundlemon --> ## BundleMon                       <details> <summary>Unchanged files (2)</summary>  Status | Path | Size | Limits :------------: | ------------ | :------------: | :------------: :white_check_mark: | demo/browser/styles-(hash).css<br/> | 22.32KB | +10% :white_check_mark: | demo/browser/main-(hash).js<br/> | 1.04KB | +10% </details>    Total files change +2B +0.01%                  <details open> <summary>Groups updated (1)</summary>  Status | Path | Size | Limits :------------: | ------------ | :------------: | :------------: :white_check_mark: | demo/browser/*.js<br/> | 3.4MB (+487B +0.01%) | - </details>          Final result: :white_check_mark:  [View report in BundleMon website ➡️](https://app.bundlemon.dev/projects/64d3a0c709a579b8d4912225/reports/6abfcc34bcd3d5d99bbc0b8f)  --- <p align="center"><a href="https://app.bundlemon.dev/projects/64d3a0c709a579b8d4912225/reports?branch=fix%2F15144-input-number-fill&resolution=all" target="_blank" rel="noreferrer noopene

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

### Incident Patch 1: `95fd03b0` (2026-10-05)
**Commit Message**: chore: update dependency @taiga-ui/configs to v0.564.0 (#15156)

**File**: `package-lock.json` (modified, +50/-50)
```diff
@@ -38,7 +38,7 @@
                 "@nx/workspace": "22.1.1",
                 "@schematics/angular": "19.2.27",
                 "@stackblitz/sdk": "1.11.1",
-                "@taiga-ui/configs": "0.563.0",
+                "@taiga-ui/configs": "0.564.0",
                 "@taiga-ui/event-plugins": "5.0.0",
                 "@types/express": "4.17.25",
                 "@types/glob": "9.0.0",
@@ -14607,9 +14607,9 @@
             "link": true
         },
         "node_modules/@taiga-ui/auto-changelog-config": {
-            "version": "0.563.0",
-            "resolved": "https://registry.npmjs.org/@taiga-ui/auto-changelog-config/-/auto-changelog-config-0.563.0.tgz",
-            "integrity": "sha512-bL3GUPAUbVs50aiR7L6CUJtej+vk5kByuYPlUBKhLKJF6gkqfX65h5FxE72WlUTN02R0yQ8gCwNDG1147SbfHQ==",
+            "version": "0.564.0",
+            "resolved": "https://registry.npmjs.org/@taiga-ui/auto-changelog-config/-/auto-changelog-config-0.564.0.tgz",
+            "integrity": "sha512-CQyFqyYHGcuwcD3pgwdHrMCqC9pgRwg+D0UIkltX55kHh+c8zjdW9Qfig53iw+KuGcBEwZmPTHgW2jbSX/Q1dw==",
             "dev": true,
             "license": "Apache-2.0",
             "peer": true,
@@ -14618,9 +14618,9 @@
             }
         },
         "node_modules/@taiga-ui/browserslist-config": {
-            "version": "0.563.0",
-            "resolved": "https://registry.npmjs.org/@taiga-ui/browserslist-config/-/browserslist-config-0.563.0.tgz",
-            "integrity": "sha512-G9FkzfribfKD6hsDAHkFFOXpdD2a1X4ccCDmIX+ye399WPuHfUZRh9N2lOxwJ302AJ0uVzo0YD3s1NM1TXQ7Dg==",
+            "version": "0.564.0",
+            "resolved": "https://registry.npmjs.org/@taiga-ui/browserslist-config/-/browserslist-config-0.564.0.tgz",
+            "integrity": "sha512-BjbcmzLh3E9iUfpIF0Qmk8O7PsVF/aDtJNcZfSDxUBygioimXFGlw+ZsatPAAPDry2AxtNta9UFBd65BZKbj+g==",
             "dev": true,
             "license": "Apache-2.0",
             "peer": true
@@ -14630,9 +14630,9 @@
             "link": true
         },
         "node_modules/@taiga-ui/commitlint-config": {
-            "version": "0.563.0",
-            "resolved": "https://registry.npmjs.org/@taiga-ui/commitlint-config/-/commitlint-config-0.563.0.tgz",
-            "integrity": "sha512-R7ANxH8Syr1tPWALOrsHg2iAZT0T7YLKsf/ZR4XQyNDxrZNCA2hD7QtU+j/HbocvvciW3f4Twl46ukopw4uPEQ==",
+            "version": "0.564.0",
+            "resolved": "https://registry.npmjs.org/@taiga-ui/commitlint-config/-/commitlint-config-0.564.0.tgz",
+            "integrity": "sha512-4Wu04g/ACEaMVYKf/KINftq9svawk5iBWPRegX3Ec0rgi0Nz2FgxlC6qkiVeut/pz9Wp4xAczYlZm6nLg7AbOw==",
             "dev": true,
             "license": "Apache-2.0",
             "peer": true,
@@ -14660,33 +14660,33 @@
             }
         },
         "node_modules/@taiga-ui/configs": {
-            "version": "0.563.0",
-            "resolved": "https://registry.npmjs.org/@taiga-ui/configs/-/configs-0.563.0.tgz",
-            "integrity": "sha512-Wd3QiEm6TOrfpm3SB4e8R/V3JncRxNPeEI+y+rzVUWMuJwvBhHoHwbNCvsv3wINVqesrNsFXdTRAMlSBUFVPxQ==",
+            "version": "0.564.0",
+            "resolved": "https://registry.npmjs.org/@taiga-ui/configs/-/configs-0.564.0.tgz",
+            "integrity": "sha512-rvRYbLV3s/rk0A2xiM/gFJSsOfTTv1hYd2rDjwrZhB2mLv9WKwREXa8RcKaN/J+U854JLIT3T13dnVOhZzjS4g==",
             "dev": true,
             "license": "Apache-2.0",
             "peerDependencies": {
-                "@taiga-ui/auto-changelog-config": "^0.563.0",
-                "@taiga-ui/browserslist-config": "^0.563.0",
-                "@taiga-ui/commitlint-config": "^0.563.0",
-                "@taiga-ui/cspell-config": "^0.563.0",
-                "@taiga-ui/eslint-plugin-experience-next": "^0.563.0",
-                "@taiga-ui/jest-config": "^0.563.0",
-                "@taiga-ui/prettier-config": "^0.563.0",
-                "@taiga-ui/release-it-config": "^0.563.0",
-                "@taiga-ui/stylelint-config": "^0.563.0",
-                "@taiga-ui/syncer": "^0.563.0",
-                "@taiga-ui/tsconfig": "^0.563.0"
+                "@taiga-ui/auto-changelog-config": "^0.564.0",
+                "@taiga-ui/browserslist-config": "^0.564.0",
+                "@taiga-ui/commitlint-config": "^0.564.0",
+                "@taiga-ui/cspell-config": "^0.564.0",
+                "@taiga-ui/eslint-plugin-experience-next": "^0.564.0",
+                "@taiga-ui/jest-config": "^0.564.0",
+                "@taiga-ui/prettier-config": "^0.564.0",
+                "@taiga-ui/release-it-config": "^0.564.0",
+                "@taiga-ui/stylelint-config": "^0.564.0",
+                "@taiga-ui/syncer": "^0.564.0",
+                "@taiga-ui/tsconfig": "^0.564.0"
             }
         },
         "node_modules/@taiga-ui/core": {
             "resolved": "projects/core",
             "link": true
         },
         "node_modules/@taiga-ui/cspell-config": {
-            "version": "0.563.0",
-            "resolved": "https://registry.npmjs.org/@taiga-ui/cspell-config/-/cs
```

**File**: `package.json` (modified, +1/-1)
```diff
@@ -142,7 +142,7 @@
         "@nx/workspace": "22.1.1",
         "@schematics/angular": "19.2.27",
         "@stackblitz/sdk": "1.11.1",
-        "@taiga-ui/configs": "0.563.0",
+        "@taiga-ui/configs": "0.564.0",
         "@taiga-ui/event-plugins": "5.0.0",
         "@types/express": "4.17.25",
         "@types/glob": "9.0.0",
```

---

### Incident Patch 2: `7f3244c8` (2026-10-05)
**Commit Message**: fix(kit): render long Copy text in Safari (#15120)

**File**: `projects/kit/components/copy/copy.style.less` (modified, +28/-0)
```diff
@@ -16,6 +16,13 @@
             .t-content {
                 opacity: var(--tui-disabled-opacity);
                 mask-position: 0;
+                animation-name: tuiCopySafariOpacity;
+
+                .safari-only({
+                    animation-duration: 1s;
+                    animation-iteration-count: infinite;
+                    animation-direction: alternate;
+                });
             }
 
             .t-button {
@@ -27,12 +34,23 @@
     &:has(.t-button:focus-visible) .t-content {
         opacity: var(--tui-disabled-opacity);
         mask-position: 0;
+        animation-name: tuiCopySafariOpacity;
+
+        .safari-only({
+            animation-duration: 1s;
+            animation-iteration-count: infinite;
+            animation-direction: alternate;
+        });
     }
 }
 
 .t-content {
     .transition(~'opacity, mask');
 
+    .safari-only({
+        transition-property: mask;
+    });
+
     mask-image:
         linear-gradient(
             to var(--tui-inline-start),
@@ -74,3 +92,13 @@
     vertical-align: sub;
     color: var(--tui-text-positive);
 }
+
+@keyframes tuiCopySafariOpacity {
+    from {
+        opacity: var(--tui-disabled-opacity);
+    }
+
+    to {
+        opacity: calc(var(--tui-disabled-opacity) + 0.001);
+    }
+}
```

---

### Incident Patch 3: `0927ede5` (2026-10-05)
**Commit Message**: fix(kit): prevent phone country dropdown reopening (#15073)

**File**: `projects/demo-cypress/src/tests/input-phone-international.cy.ts` (modified, +35/-0)
```diff
@@ -28,6 +28,7 @@ import {createOutputSpy} from 'cypress/angular';
                 <input
                     tuiInputPhoneInternational
                     [countries]="countries()"
+                    [countrySearch]="countrySearch()"
                     [formControl]="control()"
                     [(countryIsoCode)]="countryIsoCode"
                     (countryIsoCodeChange)="countryIsoCodeChange.emit($event)"
@@ -48,6 +49,7 @@ export class Test implements OnInit {
     private readonly destroyRef = inject(DestroyRef);
 
     public readonly control = input(new FormControl('', {nonNullable: true}));
+    public readonly countrySearch = input(false);
     public readonly countryIsoCode = model<TuiCountryIsoCode>('RU');
 
     public readonly countries = input<readonly TuiCountryIsoCode[]>([
@@ -74,6 +76,39 @@ describe('InputPhoneInternational', () => {
         cy.viewport(400, 300);
     });
 
+    describe('Dropdown', () => {
+        beforeEach(() => {
+            cy.mount(Test, {componentProperties: {countrySearch: true}});
+            initAliases();
+        });
+
+        it('closes on second country selector click without moving focus from search', () => {
+            cy.get('@select').click();
+            cy.get('tui-dropdown').should('be.visible');
+            cy.get('tui-dropdown input[tuiInput]').should('be.focused');
+
+            cy.get('@select').trigger('pointerdown');
+            cy.get('tui-dropdown input[tuiInput]').should('be.focused');
+
+            cy.get('@select').click();
+            cy.get('tui-dropdown').should('not.exist');
+        });
+
+        it('closes on second country selector click without moving focus from option', () => {
+            cy.get('@select').click();
+            cy.get('tui-dropdown input[tuiInput]')
+                .should('be.focused')
+                .type('{downArrow}');
+            cy.get('tui-dropdown [tuiOption]').first().should('be.focused');
+
+            cy.get('@select').trigger('pointerdown');
+            cy.get('tui-dropdown [tuiOption]').first().should('be.focused');
+
+            cy.get('@select').click();
+            cy.get('tui-dropdown').should('not.exist');
+        });
+    });
+
     describe('Count form control updates', () => {
         let control!: FormControl<string>;
 
```

**File**: `projects/kit/components/input-phone-international/input-phone-international-content.component.ts` (modified, +6/-0)
```diff
@@ -80,6 +80,12 @@ export class TuiInputPhoneInternationalContent {
             );
     });
 
+    protected onPointerDown(event: Event): void {
+        if (this.host.open()) {
+            event.preventDefault();
+        }
+    }
+
     protected onItemClick(code: TuiCountryIsoCode): void {
         this.host.el.focus();
         this.host.open.set(false);
```

**File**: `projects/kit/components/input-phone-international/input-phone-international-content.template.html` (modified, +1/-1)
```diff
@@ -11,7 +11,7 @@
     [size]="size()"
     [tuiAppearanceFocus]="host.open()"
     (click.prevent)="host.interactive() && host.open.set(!host.open())"
-    (pointerdown.stop)="(0)"
+    (pointerdown.stop)="onPointerDown($event)"
 >
     <img
         class="t-ipi-flag"
```

---

### Incident Patch 4: `d1c85cdf` (2026-10-05)
**Commit Message**: fix(demo): caption mismatched (#15086)

Co-authored-by: Alex Inkin <[REDACTED_EMAIL]>
Co-authored-by: taiga-family-bot <41898282+github-actions[bot]@users.noreply.github.com>

**File**: `projects/addon-doc/components/example/example.component.ts` (modified, +7/-5)
```diff
@@ -79,7 +79,7 @@ import {TuiDocExampleGetTabsPipe} from './example-get-tabs.pipe';
         waIntersectionThreshold: '1',
         '[attr.id]': 'resolvedId()',
         '[class._fullsize]': 'fullsize()',
-        '(waIntersectionObservee)': 'onIntersection()',
+        '(waIntersectionObservee)': 'onIntersection($event)',
     },
 })
 export class TuiDocExample implements OnChanges {
@@ -173,9 +173,11 @@ export class TuiDocExample implements OnChanges {
             .finally(() => this.loading.set(false));
     }
 
-    protected onIntersection(): void {
-        this.doc.dispatchEvent(
-            new CustomEvent('tui-example', {detail: this.resolvedId()}),
-        );
+    protected onIntersection(entries: readonly IntersectionObserverEntry[]): void {
+        const entry = entries[entries.length - 1];
+
+        if (entry) {
+            this.doc.dispatchEvent(new CustomEvent('tui-example', {detail: entry}));
+        }
     }
 }
```

**File**: `projects/addon-doc/components/toc/index.ts` (modified, +19/-11)
```diff
@@ -1,6 +1,7 @@
 import {
     ChangeDetectionStrategy,
     Component,
+    computed,
     inject,
     type OnInit,
     signal,
@@ -14,7 +15,6 @@ import {
 } from '@taiga-ui/addon-doc/tokens';
 import {TuiDocKebabPipe, tuiToKebab} from '@taiga-ui/addon-doc/utils';
 import {tuiInjectElement} from '@taiga-ui/cdk/utils/dom';
-import {tuiArrayToggle} from '@taiga-ui/cdk/utils/miscellaneous';
 import {TuiLink} from '@taiga-ui/core/components/link';
 import {TuiTitle} from '@taiga-ui/core/components/title';
 
@@ -31,8 +31,16 @@ import {TuiDocPage} from '../page/page.component';
 export class TuiDocToc implements OnInit {
     private readonly el = tuiInjectElement();
     private readonly pages = inject(TUI_DOC_MAP_PAGES);
-    private examples: readonly string[] = [];
-    private active = '';
+    private readonly examples = signal<readonly string[]>([]);
+    private readonly active = computed(() => {
+        const toc = this.toc();
+        const examples = this.examples();
+
+        return examples.length
+            ? toc.find((item) => examples.includes(tuiToKebab(item))) ||
+                  toc[toc.length - 1]
+            : toc[0];
+    });
 
     protected readonly toc = signal<readonly string[]>([]);
     protected readonly route = inject(ActivatedRoute);
@@ -54,21 +62,21 @@ export class TuiDocToc implements OnInit {
     }
 
     protected isActive(fragment: string): boolean {
-        return this.active ? fragment === this.active : fragment === this.toc()[0];
+        return fragment === this.active();
     }
 
     protected getRouterLink(pageTitle: string): string {
         return this.pages.get(pageTitle)?.route ?? '';
     }
 
-    protected onExample(example: string): void {
-        const toc = this.toc();
+    protected onExample(example: IntersectionObserverEntry): void {
+        const id = example.target.id;
 
-        this.examples = tuiArrayToggle(this.examples, example);
-        this.active =
-            toc.find((item) => this.examples.includes(tuiToKebab(item))) ||
-            toc[toc.length - 1] ||
-            '';
+        this.examples.update((examples) => {
+            const remaining = examples.filter((item) => item !== id);
+
+            return example.intersectionRatio === 1 ? [...remaining, id] : remaining;
+        });
     }
 }
 
```

**File**: `projects/addon-doc/components/toc/test/toc.component.spec.ts` (added, +132/-0)
```diff
@@ -0,0 +1,132 @@
+import {ChangeDetectionStrategy, Component} from '@angular/core';
+import {type ComponentFixture, fakeAsync, TestBed, tick} from '@angular/core/testing';
+import {By} from '@angular/platform-browser';
+import {provideRouter} from '@angular/router';
+import {TuiDocExample, TuiDocPage, TuiDocPageTabConnector} from '@taiga-ui/addon-doc';
+import {provideTaiga} from '@taiga-ui/core';
+import {provideHighlightOptions} from 'ngx-highlightjs';
+
+describe('TuiDocToc', () => {
+    @Component({
+        imports: [TuiDocExample, TuiDocPage, TuiDocPageTabConnector],
+        template: `
+            <tui-doc-page>
+                <ng-template pageTab>
+                    <tui-doc-example heading="Basic" />
+                    <tui-doc-example heading="Validation" />
+                    <tui-doc-example heading="Format" />
+                </ng-template>
+            </tui-doc-page>
+        `,
+        changeDetection: ChangeDetectionStrategy.OnPush,
+    })
+    class Test {}
+
+    let fixture: ComponentFixture<Test>;
+
+    beforeEach(() => {
+        TestBed.configureTestingModule({
+            imports: [Test],
+            providers: [
+                provideTaiga(),
+                provideRouter([]),
+                provideHighlightOptions({
+                    fullLibraryLoader: async () => import('highlight.js'),
+                }),
+            ],
+        });
+
+        fixture = TestBed.createComponent(Test);
+    });
+
+    function intersect(id: string, ...intersectionRatios: readonly number[]): void {
+        const example = fixture.debugElement.query(By.css(`tui-doc-example#${id}`));
+        const rect = example.nativeElement.getBoundingClientRect();
+        const entries: IntersectionObserverEntry[] = intersectionRatios.map(
+            (intersectionRatio) => ({
+                target: example.nativeElement,
+                intersectionRatio,
+                isIntersecting: intersectionRatio > 0,
+                boundingClientRect: rect,
+                intersectionRect: rect,
+                rootBounds: rect,
+                time: 0,
+            }),
+        );
+
+        example.triggerEventHandler('waIntersectionObservee', entries);
+        fixture.detectChanges();
+    }
+
+    function activeHeading(): string {
+        return fixture.nativeElement
+            .querySelector('tui-doc-toc a._active')
+            ?.textContent.trim();
+    }
+
+    it('ignores initial notifications for examples above the anchor', fakeAsync(() => {
+        fixture.detectChanges();
+        tick();
+        fixture.detectChanges();
+
+        intersect('basic', 0);
+        intersect('validation', 1);
+        intersect('format', 1);
+
+        expect(activeHeading()).toBe('Validation');
+    }));
+
+    it('keeps the latest intersection state when the table of contents loads later', fakeAsync(() => {
+        fixture.detectChanges();
+
+        intersect('basic', 0);
+        intersect('validation', 1);
+        intersect('format', 1);
+        tick();
+        fixture.detectChanges();
+
+        expect(activeHeading()).toBe('Validation');
+    }));
+
+    it('keeps an example active after repeated fully intersecting notifications', fakeAsync(() => {
+        fixture.detectChanges();
+        tick();
+        fixture.detectChanges();
+
+        intersect('basic', 0);
+        intersect('validation', 1);
+        intersect('format', 1);
+        intersect('validation', 1);
+
+        expect(activeHeading()).toBe('Validation');
+    }));
+
+    it('updates the active example when scrolling down and back up', fakeAsync(() => {
+        fixture.detectChanges();
+        tick();
+        fixture.detectChanges();
+
+        intersect('basic', 1);
+        intersect('validation', 1);
+        intersect('format', 1);
+        intersect('basic', 0.5);
+
+        expect(activeHeading()).toBe('Validation');
+
+        intersect('basic', 1);
+
+        expect(activeHeading()).toBe('Basic');
+    }));
+
+    it('uses the latest entry when intersection notifications are batched', fakeAsync(() => {
+        fixture.detectChanges();
+        tick();
+        fixture.detectChanges();
+
+        intersect('basic', 0);
+        intersect('format', 1);
+        intersect('validation', 0, 1);
+
+        expect(activeHeading()).toBe('Validation');
+    }));
+});
```

**File**: `projects/demo-playwright/tests/addon-doc/navigation.pw.spec.ts` (modified, +17/-0)
```diff
@@ -46,6 +46,23 @@ test.describe('Navigation', () => {
     });
 
     test.describe('anchor links navigation works', () => {
+        test('selects the active example on the first visit to an anchor', async ({
+            page,
+        }) => {
+            await page.setViewportSize({width: 1920, height: 900});
+            await tuiGoto(page, `${DemoRoute.InputDate}#validation`, {hideHeader: false});
+
+            await expect(page.locator('tui-doc-toc a._active')).toHaveText('Validation');
+
+            await page.locator('tui-doc-toc a[href$="#format"]').click();
+
+            await expect(page.locator('tui-doc-toc a._active')).toHaveText('Format');
+
+            await page.locator('tui-doc-toc a[href$="#basic"]').click();
+
+            await expect(page.locator('tui-doc-toc a._active')).toHaveText('Basic');
+        });
+
         // TODO: migrate
         test.skip('scroll to "tui-doc-example"', async ({page, browserName}) => {
             // TODO: why does this test keep failing in safari
```

---

### Incident Patch 5: `123114d9` (2026-10-05)
**Commit Message**: fix(cdk): preserve synchronous control value resets (#15128)

**File**: `projects/cdk/classes/control.ts` (modified, +1/-1)
```diff
@@ -168,8 +168,8 @@ export abstract class TuiControl<T> implements ControlValueAccessor {
                 return;
             }
 
-            onChange(this.transformer.toControlValue(value));
             this.internal.set(value);
+            onChange(this.transformer.toControlValue(value));
             this.update();
         };
     }
```

**File**: `projects/cdk/classes/test/control.spec.ts` (added, +45/-0)
```diff
@@ -0,0 +1,45 @@
+import {ChangeDetectionStrategy, Component, Directive} from '@angular/core';
+import {type ComponentFixture, TestBed} from '@angular/core/testing';
+import {FormControl, ReactiveFormsModule} from '@angular/forms';
+import {By} from '@angular/platform-browser';
+import {TuiControl} from '@taiga-ui/cdk';
+
+describe('TuiControl', () => {
+    @Directive({selector: '[testControl]'})
+    class TestControl extends TuiControl<string> {}
+
+    @Component({
+        imports: [ReactiveFormsModule, TestControl],
+        template: '<input testControl [formControl]="control" />',
+        changeDetection: ChangeDetectionStrategy.OnPush,
+    })
+    class Test {
+        public readonly control = new FormControl('', {nonNullable: true});
+    }
+
+    let fixture: ComponentFixture<Test>;
+    let test: Test;
+    let control: TestControl;
+
+    beforeEach(async () => {
+        TestBed.configureTestingModule({imports: [Test]});
+        await TestBed.compileComponents();
+        fixture = TestBed.createComponent(Test);
+        test = fixture.componentInstance;
+        control = fixture.debugElement
+            .query(By.directive(TestControl))
+            .injector.get(TestControl);
+        fixture.detectChanges();
+    });
+
+    it('preserves a synchronous model write from valueChanges', () => {
+        test.control.valueChanges.subscribe(() => {
+            test.control.setValue('reset', {emitEvent: false});
+        });
+
+        control.onChange('user');
+
+        expect(test.control.value).toBe('reset');
+        expect(control.value()).toBe('reset');
+    });
+});
```

---

### Incident Patch 6: `1cce3a88` (2026-10-05)
**Commit Message**: fix(core): `Cell` respect appearance background on hover (#15123)

**File**: `projects/demo-playwright/tests/layout/card-large.pw.spec.ts` (added, +31/-0)
```diff
@@ -0,0 +1,31 @@
+import {DemoRoute} from '@demo/routes';
+import {TuiDocumentationPagePO, tuiGoto} from '@demo-playwright/utils';
+import {expect, type Locator, test} from '@playwright/test';
+
+async function getSettledBackground(element: Locator): Promise<string> {
+    return element.evaluate(async (node) => {
+        await Promise.all(node.getAnimations().map(async ({finished}) => finished));
+
+        return getComputedStyle(node).backgroundColor;
+    });
+}
+
+test.describe('CardLarge', () => {
+    test('interactive cell keeps floating appearance background on hover', async ({
+        page,
+    }) => {
+        await tuiGoto(page, DemoRoute.CardLarge);
+
+        const card = new TuiDocumentationPagePO(page)
+            .getExample('#single-item')
+            .locator('button[tuiCardLarge][tuiCell]');
+
+        await card.scrollIntoViewIfNeeded();
+
+        const background = await getSettledBackground(card);
+
+        await card.hover();
+
+        expect(await getSettledBackground(card)).toBe(background);
+    });
+});
```

**File**: `projects/styles/components/cell.less` (modified, +8/-15)
```diff
@@ -1,11 +1,14 @@
 @import '@taiga-ui/styles/utils';
 
+:where([tuiCell]&) {
+    .button-clear();
+}
+
 [tuiCell]:where(*&) {
     --t-pad: 0.125rem 1rem;
     --t-radius: var(--tui-radius-s);
 
     .transition(~'background');
-    .button-clear();
 
     position: relative;
     display: flex;
@@ -280,20 +283,10 @@
 }
 
 @media @tui-mouse {
-    a[tuiCell]:where(*&):hover,
-    button[tuiCell]:where(*&):hover,
-    label[tuiCell]:where(*&):hover {
-        &:not(:disabled, [data-state='disabled']) {
-            background: var(--tui-background-neutral-1);
-            cursor: pointer;
-        }
-    }
-
-    label[tuiCell]:where(*&):hover {
-        &:not(:has(input:disabled)) {
-            background: var(--tui-background-neutral-1);
-            cursor: pointer;
-        }
+    :where(:is(a, button, label)[tuiCell]:hover:not(:disabled, [data-state='disabled'])&),
+    :where(label[tuiCell]:hover:not(:has(input:disabled))&) {
+        background: var(--tui-background-neutral-1);
+        cursor: pointer;
     }
 }
 
```

---

### Incident Patch 7: `f7748a47` (2026-10-05)
**Commit Message**: fix(core): `Hint` prevent showing over dialogs (#15142)

**File**: `projects/core/portals/hint/hint-hover.directive.ts` (modified, +2/-1)
```diff
@@ -59,7 +59,8 @@ export class TuiHintHover extends TuiDriver {
         map(
             (value) =>
                 value &&
-                (this.el.hasAttribute('tuiHintPointer') || !tuiIsObscured(this.el)),
+                (this.el.hasAttribute('tuiHintPointer') ||
+                    !tuiIsObscured(this.el, 'tui-popups > :not(tui-modal)')),
         ),
         tap((visible) => {
             this.visible = visible;
```

**File**: `projects/core/portals/hint/test/hint-hover.directive.spec.ts` (modified, +162/-5)
```diff
@@ -1,4 +1,11 @@
-import {ChangeDetectionStrategy, Component} from '@angular/core';
+import {
+    ChangeDetectionStrategy,
+    Component,
+    inject,
+    signal,
+    type TemplateRef,
+    viewChild,
+} from '@angular/core';
 import {
     type ComponentFixture,
     discardPeriodicTasks,
@@ -7,24 +14,51 @@ import {
     tick,
 } from '@angular/core/testing';
 import {WA_IS_MOBILE} from '@ng-web-apis/platform';
-import {provideTaiga, TuiHint, TuiRoot} from '@taiga-ui/core';
+import {EMPTY_CLIENT_RECT} from '@taiga-ui/cdk';
+import {provideTaiga, TuiDialogService, TuiHint, TuiRoot} from '@taiga-ui/core';
 
 describe('Hint on mobile', () => {
     @Component({
         imports: [TuiHint, TuiRoot],
         template: `
             <tui-root>
-                <div
+                <button
                     id="hint-host"
                     tuiHint="Tooltip text"
+                    type="button"
+                    [tuiHintShowDelay]="showDelay()"
+                    (click)="onClick()"
                 >
                     Tooltip host
-                </div>
+                </button>
+                <ng-template #dialogContent>
+                    <button
+                        id="dialog-hint-host"
+                        tuiHint="Hint inside dialog"
+                        type="button"
+                    >
+                        Tooltip host inside dialog
+                    </button>
+                </ng-template>
             </tui-root>
         `,
         changeDetection: ChangeDetectionStrategy.OnPush,
     })
-    class Test {}
+    class Test {
+        private readonly dialogs = inject(TuiDialogService);
+
+        public readonly showDelay = signal(500);
+        public readonly dialogContent =
+            viewChild.required<TemplateRef<unknown>>('dialogContent');
+
+        public openDialog = false;
+
+        protected onClick(): void {
+            if (this.openDialog) {
+                this.dialogs.open('Dialog').subscribe();
+            }
+        }
+    }
 
     let fixture: ComponentFixture<Test>;
 
@@ -38,6 +72,129 @@ describe('Hint on mobile', () => {
         fixture.detectChanges();
     });
 
+    afterEach(() => {
+        jest.restoreAllMocks();
+    });
+
+    it.each([0, 500, 750])(
+        'shows immediately on tap when tuiHintShowDelay is %i',
+        fakeAsync((showDelay: number) => {
+            fixture.componentInstance.showDelay.set(showDelay);
+            fixture.detectChanges();
+
+            document.querySelector<HTMLElement>('#hint-host')!.click();
+            tick(0);
+            fixture.detectChanges();
+            discardPeriodicTasks();
+
+            expect(document.querySelector('tui-hint')).not.toBeNull();
+        }),
+    );
+
+    it('does not show over a dialog opened by the same tap', fakeAsync(() => {
+        const host = document.querySelector<HTMLElement>('#hint-host')!;
+
+        jest.spyOn(host, 'getBoundingClientRect').mockReturnValue({
+            ...EMPTY_CLIENT_RECT,
+            right: 40,
+            bottom: 40,
+            width: 40,
+            height: 40,
+        });
+        jest.spyOn(document, 'elementFromPoint').mockImplementation(
+            () => document.querySelector('tui-modal') || host,
+        );
+        fixture.componentInstance.openDialog = true;
+
+        host.dispatchEvent(new Event('mouseenter'));
+        tick(0);
+        host.click();
+        fixture.detectChanges();
+        tick(0);
+        fixture.detectChanges();
+        discardPeriodicTasks();
+
+        expect(document.querySelector('tui-dialog')).not.toBeNull();
+        expect(document.querySelector('tui-hint')).toBeNull();
+    }));
+
+    it('hides on pointerdown outside and can show again on the next tap', fakeAsync(() => {
+        const host = document.querySelector<HTMLElement>('#hint-host')!;
+
+        host.click();
+        tick(0);
+        fixture.detectChanges();
+
+        expect(document.querySelector('tui-hint')).not.toBeNull();
+
+        document.body.dispatchEvent(new Event('pointerdown', {bubbles: true}));
+        tick(100);
+        fixture.detectChanges();
+
+        expect(document.querySelector('tui-hint')).toBeNull();
+
+        host.click();
+        tick(0);
+        fixture.detectChanges();
+        discardPeriodicTasks();
+
+        expect(document.querySelector('tui-hint')).not.toBeNull();
+    }));
+
+    it('shows for a host inside the open dialog', fakeAsync(() => {
+        TestBed.inject(TuiDialogService)
+            .open(fixture.componentInstance.dialogContent())
+            .subscribe();
+        fixture.detectChanges();
+        tick(0);
+        fixture.detectChanges();
+
+        const host = document.querySelector<HTMLElement>('#dialog-hint-host')!;
+        const modal = document.querySelector('tui-modal');
+
+        expect(modal).not.toBeNull();
+
+        jest.spyOn(host, 'getBoundingClientRect').mockReturnValue({
+            ...EMPTY_CLIENT_RECT,
+            righ
```

**File**: `projects/kit/components/drawer/test/drawer-hint.spec.ts` (added, +171/-0)
```diff
@@ -0,0 +1,171 @@
+import {ChangeDetectionStrategy, Component, inject, signal} from '@angular/core';
+import {
+    type ComponentFixture,
+    discardPeriodicTasks,
+    fakeAsync,
+    TestBed,
+    tick,
+} from '@angular/core/testing';
+import {By} from '@angular/platform-browser';
+import {WA_IS_MOBILE} from '@ng-web-apis/platform';
+import {EMPTY_CLIENT_RECT, TuiActiveZone, TuiObscured} from '@taiga-ui/cdk';
+import {provideTaiga, TuiDialogService, TuiHint, TuiPopup, TuiRoot} from '@taiga-ui/core';
+import {TUI_CONFIRM, TuiDrawer} from '@taiga-ui/kit';
+
+describe('Drawer with a hint and a confirmation dialog', () => {
+    @Component({
+        imports: [TuiActiveZone, TuiDrawer, TuiHint, TuiObscured, TuiPopup, TuiRoot],
+        template: `
+            <tui-root>
+                <button
+                    #zone="tuiActiveZone"
+                    id="drawer-trigger"
+                    tuiActiveZone
+                    tuiHint="Open drawer"
+                    type="button"
+                    [tuiObscuredEnabled]="open()"
+                    (click)="open.set(true)"
+                    (tuiActiveZoneChange)="onActive($event)"
+                    (tuiObscured)="onActive(!$event)"
+                >
+                    Open drawer
+                </button>
+                <tui-drawer
+                    *tuiPopup="open()"
+                    [tuiActiveZoneParent]="zone"
+                >
+                    <button
+                        id="delete-button"
+                        tuiHint="Delete this item"
+                        type="button"
+                        (click)="onDelete()"
+                    >
+                        Delete
+                    </button>
+                </tui-drawer>
+                <button
+                    id="outside-button"
+                    type="button"
+                >
+                    Outside
+                </button>
+            </tui-root>
+        `,
+        changeDetection: ChangeDetectionStrategy.OnPush,
+    })
+    class Test {
+        private readonly dialogs = inject(TuiDialogService);
+
+        public readonly open = signal(false);
+
+        protected onActive(active: boolean): void {
+            if (!active) {
+                this.open.set(false);
+            }
+        }
+
+        protected onDelete(): void {
+            this.dialogs
+                .open(TUI_CONFIRM, {
+                    label: 'Delete this item?',
+                    closable: false,
+                })
+                .subscribe();
+        }
+    }
+
+    let fixture: ComponentFixture<Test>;
+
+    beforeEach(async () => {
+        TestBed.configureTestingModule({
+            imports: [Test],
+            providers: [provideTaiga(), {provide: WA_IS_MOBILE, useValue: true}],
+        });
+        await TestBed.compileComponents();
+        fixture = TestBed.createComponent(Test);
+        fixture.detectChanges();
+    });
+
+    afterEach(() => {
+        jest.restoreAllMocks();
+    });
+
+    it('keeps the drawer open while its confirmation dialog covers the trigger', fakeAsync(() => {
+        const trigger = document.querySelector<HTMLButtonElement>('#drawer-trigger')!;
+
+        jest.spyOn(trigger, 'getBoundingClientRect').mockReturnValue({
+            ...EMPTY_CLIENT_RECT,
+            right: 40,
+            bottom: 40,
+            width: 40,
+            height: 40,
+        });
+        jest.spyOn(document, 'elementFromPoint').mockImplementation(
+            () =>
+                document.querySelector('tui-modal') ||
+                document.querySelector('tui-drawer') ||
+                trigger,
+        );
+
+        trigger.focus();
+        trigger.click();
+        fixture.detectChanges();
+        tick(0);
+        fixture.detectChanges();
+
+        const drawer = document.querySelector('tui-drawer');
+        const button = document.querySelector<HTMLButtonElement>('#delete-button')!;
+
+        expect(drawer).not.toBeNull();
+        expect(document.querySelector('tui-hint')?.textContent?.trim()).toBe(
+            'Open drawer',
+        );
+
+        jest.spyOn(button, 'getBoundingClientRect').mockReturnValue({
+            ...EMPTY_CLIENT_RECT,
+            right: 40,
+            bottom: 40,
+            width: 40,
+            height: 40,
+        });
+
+        button.focus();
+        button.dispatchEvent(new Event('pointerdown', {bubbles: true}));
+        button.click();
+        fixture.detectChanges();
+        tick(100);
+        fixture.detectChanges();
+
+        const dialog = document.querySelector('tui-dialog');
+
+        expect(dialog).not.toBeNull();
+        expect(document.querySelector('tui-hint')).toBeNull();
+
+        const confirm = dialog!.querySelector<HTMLButtonElement>('button')!;
+        const zone = fixture.debugElement
+            .query(By.css('#drawer-trigger'))
+            .injector.get(TuiActiveZone);
+
+        confirm.focus();
+        confirm.dispatchEve
```

---

### Incident Patch 8: `afbd4a4a` (2026-10-05)
**Commit Message**: fix(kit): preserve digits when filling input number with postfix (#15146)

**File**: `projects/demo-playwright/tests/kit/input-number/input-number.pw.spec.ts` (modified, +46/-2)
```diff
@@ -7,6 +7,7 @@ import {
     CMD,
     InputNumberPO,
     TuiDocumentationApiPagePO,
+    TuiDocumentationPagePO,
     tuiGoto,
 } from '@demo-playwright/utils';
 import {expect, type Locator, test} from '@playwright/test';
@@ -673,6 +674,8 @@ describe('InputNumber', () => {
             (
                 [
                     {prefix: '$', postfix: ''},
+                    {prefix: '', postfix: '%'},
+                    {prefix: '', postfix: '€'},
                     {prefix: '', postfix: 'kg'},
                     {prefix: '$', postfix: 'kg'},
                     {prefix: '', postfix: 'Even too long postfix changes nothing'},
@@ -684,7 +687,7 @@ describe('InputNumber', () => {
                     beforeEach(async ({page}) => {
                         await tuiGoto(
                             page,
-                            `${DemoRoute.InputNumber}/API?prefix=${prefix}&postfix=${postfix}`,
+                            `${DemoRoute.InputNumber}/API?prefix=${encodeURIComponent(prefix)}&postfix=${encodeURIComponent(postfix)}&sandboxExpanded=true`,
                         );
                     });
 
@@ -700,12 +703,36 @@ describe('InputNumber', () => {
                         );
                     });
 
+                    test('fills an empty unfocused textfield', async () => {
+                        await inputNumber.textfield.fill('42');
+
+                        await expect(inputNumber.textfield).toHaveValue(
+                            `${prefix}42${postfix}`,
+                        );
+                        await expect(value).toContainText('"value": 42');
+                    });
+
+                    test('fills a textfield after clearing and blurring', async () => {
+                        await inputNumber.textfield.fill('42');
+                        await inputNumber.textfield.clear();
+                        await inputNumber.textfield.blur();
+
+                        await expect(inputNumber.textfield).toHaveValue('');
+
+                        await inputNumber.textfield.fill('42');
+
+                        await expect(inputNumber.textfield).toHaveValue(
+                            `${prefix}42${postfix}`,
+                        );
+                        await expect(value).toContainText('"value": 42');
+                    });
+
                     test('does not shows prefix for READONLY empty textfield on focus', async ({
                         page,
                     }) => {
                         await tuiGoto(
                             page,
-                            `${DemoRoute.InputNumber}/API?prefix=${prefix}&postfix=${postfix}&readonly=true`,
+                            `${DemoRoute.InputNumber}/API?prefix=${encodeURIComponent(prefix)}&postfix=${encodeURIComponent(postfix)}&readonly=true`,
                         );
                         await inputNumber.textfield.focus();
 
@@ -1785,4 +1812,21 @@ describe('InputNumber', () => {
             await expect(value).toContainText('"value": 12.3');
         });
     });
+
+    test('fills the currency example after clearing and blurring', async ({page}) => {
+        await tuiGoto(page, DemoRoute.InputNumber);
+
+        const textfield = new TuiDocumentationPagePO(page)
+            .getExample('#fluid-typography')
+            .locator('input[tuiInputNumber]');
+
+        await textfield.clear();
+        await textfield.blur();
+
+        await expect(textfield).toHaveValue('');
+
+        await textfield.fill('42');
+
+        await expect(textfield).toHaveValue('42 €');
+    });
 });
```

**File**: `projects/kit/components/input-number/input-number.directive.ts` (modified, +4/-1)
```diff
@@ -118,7 +118,10 @@ export class TuiInputNumberDirective extends TuiControl<string> {
 
     protected onFocus(): void {
         if (!this.input.value() && this.interactive()) {
-            this.input.value.set(`${this.mask.prefix()}${this.mask.postfix()}`);
+            const prefix = this.mask.prefix();
+
+            this.element.value = `${prefix}${this.mask.postfix()}`;
+            this.element.setSelectionRange(prefix.length, prefix.length);
         }
     }
 
```

**File**: `projects/kit/components/input-number/test/input-number.spec.ts` (added, +89/-0)
```diff
@@ -0,0 +1,89 @@
+import {ChangeDetectionStrategy, Component, signal} from '@angular/core';
+import {type ComponentFixture, TestBed} from '@angular/core/testing';
+import {FormControl, ReactiveFormsModule} from '@angular/forms';
+import {TuiInputNumber} from '@taiga-ui/kit';
+
+describe('TuiInputNumberDirective', () => {
+    @Component({
+        imports: [ReactiveFormsModule, TuiInputNumber],
+        template: `
+            <tui-textfield>
+                <input
+                    tuiInputNumber
+                    [formControl]="control"
+                    [postfix]="postfix()"
+                    [prefix]="prefix()"
+                    [readonly]="readonly()"
+                />
+            </tui-textfield>
+        `,
+        changeDetection: ChangeDetectionStrategy.OnPush,
+    })
+    class Test {
+        public readonly control = new FormControl<number | null>(null);
+        public readonly prefix = signal('');
+        public readonly postfix = signal('');
+        public readonly readonly = signal(false);
+    }
+
+    let fixture: ComponentFixture<Test>;
+    let component: Test;
+    let input: HTMLInputElement;
+
+    beforeEach(async () => {
+        TestBed.configureTestingModule({imports: [Test]});
+        await TestBed.compileComponents();
+        fixture = TestBed.createComponent(Test);
+        component = fixture.componentInstance;
+        fixture.detectChanges();
+        input = fixture.nativeElement.querySelector('input');
+    });
+
+    it.each([
+        {prefix: '', postfix: '%'},
+        {prefix: '', postfix: ' €'},
+        {prefix: '$', postfix: ''},
+        {prefix: '$', postfix: 'kg'},
+    ])('synchronously initializes $prefix/$postfix on focus', ({prefix, postfix}) => {
+        component.prefix.set(prefix);
+        component.postfix.set(postfix);
+        fixture.detectChanges();
+
+        input.focus();
+
+        expect(input.value).toBe(`${prefix}${postfix}`);
+        expect(input.selectionStart).toBe(prefix.length);
+        expect(input.selectionEnd).toBe(prefix.length);
+
+        fixture.detectChanges();
+
+        expect(input.value).toBe(`${prefix}${postfix}`);
+        expect(input.selectionStart).toBe(prefix.length);
+        expect(input.selectionEnd).toBe(prefix.length);
+        expect(component.control.value).toBeNull();
+        expect(component.control.pristine).toBe(true);
+    });
+
+    it('does not add affixes to a readonly empty input', () => {
+        component.postfix.set('%');
+        component.readonly.set(true);
+        fixture.detectChanges();
+
+        input.focus();
+        fixture.detectChanges();
+
+        expect(input.value).toBe('');
+    });
+
+    it('moves caret to the end when an empty focused input receives a value', () => {
+        input.focus();
+        fixture.detectChanges();
+
+        component.control.setValue(42);
+        fixture.detectChanges();
+
+        expect(input.value).toBe('42');
+        expect(input.selectionStart).toBe(2);
+        expect(input.selectionEnd).toBe(2);
+    });
+});
```

---

### Incident Patch 9: `20051442` (2026-10-02)
**Commit Message**: fix(layout): tui-list margin-inline-start fix for v5 (#15134)

Co-authored-by: il.vorontsov <[REDACTED_EMAIL]>

**File**: `projects/styles/components/list.less` (modified, +17/-0)
```diff
@@ -143,3 +143,20 @@
         }
     }
 }
+
+[data-platform='ios'] :where([tuiList]:is(ul)&),
+[data-platform='android'] :where([tuiList]:is(ul)&) {
+    margin-inline-start: 1.125rem;
+
+    & > li::before {
+        inline-size: 0.375rem;
+        margin-inline-start: -1rem;
+        margin-inline-end: 0.75rem;
+    }
+
+    &[data-size='l'] > li::before {
+        inline-size: 0.375rem;
+        margin-inline-start: -0.9375rem;
+        margin-inline-end: 0.75rem;
+    }
+}
```

---

### Incident Patch 10: `c7595862` (2026-10-02)
**Commit Message**: fix(kit): prevent status dot from shrinking (#15136)

**File**: `projects/demo-cypress/src/tests/status.cy.ts` (added, +28/-0)
```diff
@@ -0,0 +1,28 @@
+import {ChangeDetectionStrategy, Component} from '@angular/core';
+import {TuiStatus} from '@taiga-ui/kit';
+
+@Component({
+    imports: [TuiStatus],
+    template: `
+        <span
+            style="inline-size: 1rem; white-space: nowrap"
+            tuiStatus="var(--tui-status-positive)"
+        >
+            Status with a long label
+        </span>
+    `,
+    changeDetection: ChangeDetectionStrategy.OnPush,
+})
+class Test {}
+
+describe('Status', () => {
+    beforeEach(() => cy.mount(Test));
+
+    it('does not shrink status dot in constrained width', () => {
+        cy.get('[tuiStatus]').should(($status) => {
+            const styles = getComputedStyle($status[0]!, '::before');
+
+            expect(styles.width).to.equal('8px');
+        });
+    });
+});
```

**File**: `projects/styles/components/status.less` (modified, +1/-0)
```diff
@@ -24,6 +24,7 @@
         display: var(--t-status, none);
         inline-size: 0.5rem;
         block-size: 0.5rem;
+        flex-shrink: 0;
         border-radius: 100%;
         background: var(--t-status);
     }
```

---

### Incident Patch 11: `8eb0b416` (2026-10-02)
**Commit Message**: refactor(core): `Root` move CSS vars to :root (#15140)

Co-authored-by: taiga-family-bot <41898282+github-actions[bot]@users.noreply.github.com>
Co-authored-by: copilot-swe-agent[bot] <[REDACTED_EMAIL]>
Co-authored-by: waterplea <[REDACTED_EMAIL]>

**File**: `projects/addon-mobile/styles/common/hint.less` (modified, +4/-6)
```diff
@@ -1,17 +1,15 @@
 tui-hint {
     font: var(--tui-typography-body-m);
 
+    --t-arrow-inline: 1.5rem;
+    --t-arrow-block: 1.125rem;
+    --t-image: url('data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 18"><path d="M7.22854 3.81615L4.89971 6.6711C3.69732 8.14514 1.8988 9 0 9C1.8988 9 3.69732 9.85486 4.89971 11.3289L7.22854 14.1839L7.22854 14.1839C9.12123 16.5041 10.0676 17.6643 11.2665 17.922C11.75 18.026 12.25 18.026 12.7335 17.922C13.9324 17.6643 14.8788 16.5041 16.7715 14.1839L19.1003 11.3289C20.3027 9.85486 22.1012 9 24 9C22.1012 9 20.3027 8.14514 19.1003 6.6711L16.7715 3.81614C14.8788 1.49586 13.9324 0.335716 12.7335 0.0779663C12.25 -0.0259888 11.75 -0.0259888 11.2665 0.0779663C10.0676 0.335716 9.12123 1.49586 7.22854 3.81614L7.22854 3.81615Z" /></svg>');
+
     &.tui-enter {
         animation-timing-function: var(--tui-curve-expressive-entrance);
     }
 
     &.tui-leave {
         animation-timing-function: var(--tui-curve-expressive-exit);
     }
-
-    &::before {
-        inline-size: 1.5rem;
-        block-size: 1.125rem;
-        mask-image: url('data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 18"><path d="M7.22854 3.81615L4.89971 6.6711C3.69732 8.14514 1.8988 9 0 9C1.8988 9 3.69732 9.85486 4.89971 11.3289L7.22854 14.1839L7.22854 14.1839C9.12123 16.5041 10.0676 17.6643 11.2665 17.922C11.75 18.026 12.25 18.026 12.7335 17.922C13.9324 17.6643 14.8788 16.5041 16.7715 14.1839L19.1003 11.3289C20.3027 9.85486 22.1012 9 24 9C22.1012 9 20.3027 8.14514 19.1003 6.6711L16.7715 3.81614C14.8788 1.49586 13.9324 0.335716 12.7335 0.0779663C12.25 -0.0259888 11.75 -0.0259888 11.2665 0.0779663C10.0676 0.335716 9.12123 1.49586 7.22854 3.81614L7.22854 3.81615Z" /></svg>');
-    }
 }
```

**File**: `projects/cdk/constants/matchers.ts` (modified, +1/-1)
```diff
@@ -14,7 +14,7 @@ export const TUI_DEFAULT_MATCHER = <T>(
     item: T,
     search: string,
     stringify: TuiHandler<T, string> = String,
-): boolean => stringify(item).toLowerCase().includes(search.toLowerCase());
+): boolean => stringify(item).toLowerCase().includes(search.trim().toLowerCase());
 
 /**
  * Default handler for strict matching stringified version of an item and a search query
```

**File**: `projects/cdk/constants/test/matchers.spec.ts` (modified, +2/-2)
```diff
@@ -29,8 +29,8 @@ describe('Matcher functions', () => {
             expect(defaultMatcher(item, search)).toBe(true);
         });
 
-        it('does not do the trimming', () => {
-            expect(defaultMatcher(item, `    ${search}  `)).toBe(false);
+        it('trims the search query', () => {
+            expect(defaultMatcher(item, `    ${search}  `)).toBe(true);
         });
 
         it('uses String if stringify function was not provided', () => {
```

**File**: `projects/cdk/directives/focus-trap/focus-trap.directive.ts` (modified, +4/-1)
```diff
@@ -44,7 +44,10 @@ export class TuiFocusTrap implements OnDestroy {
     public ngOnDestroy(): void {
         this.initialized = false;
 
-        if (tuiIsHTMLElement(this.activeElement)) {
+        const focused = tuiGetFocused(this.doc);
+        const valid = !focused || focused === this.doc.body;
+
+        if (tuiIsHTMLElement(this.activeElement) && valid) {
             this.activeElement.focus();
         }
     }
```

**File**: `projects/core/components/notification/notification.directive.ts` (modified, +1/-1)
```diff
@@ -40,7 +40,7 @@ class Styles {}
         tuiButtonOptionsProvider({appearance: 'outline-grayscale', size: 's'}),
     ],
     hostDirectives: [TuiWithIcons, TuiWithAppearance],
-    host: {'[attr.data-size]': 'size()'},
+    host: {tuiNotification: '', '[attr.data-size]': 'size()'},
 })
 export class TuiNotificationDirective {
     private readonly options = inject(TUI_NOTIFICATION_OPTIONS);
```

**File**: `projects/core/components/root/root.component.ts` (modified, +2/-15)
```diff
@@ -17,16 +17,8 @@ import {
     TuiScrollControls,
 } from '@taiga-ui/core/components/scrollbar';
 import {TuiPopups} from '@taiga-ui/core/portals/popup';
-import {
-    TUI_ANIMATIONS_SPEED,
-    TUI_BREAKPOINT,
-    TUI_REDUCED_MOTION,
-} from '@taiga-ui/core/tokens';
-import {
-    TUI_LIQUID_GLASS,
-    TUI_OPTIONS,
-    tuiGetDuration,
-} from '@taiga-ui/core/utils/miscellaneous';
+import {TUI_BREAKPOINT} from '@taiga-ui/core/tokens';
+import {TUI_LIQUID_GLASS, TUI_OPTIONS} from '@taiga-ui/core/utils/miscellaneous';
 
 @Component({
     selector: 'tui-root',
@@ -49,8 +41,6 @@ import {
         'data-tui-version': TUI_VERSION,
         '[class._mobile]': 'breakpoint() === "mobile"',
         '[class.tui-liquid-glass]': 'liquidGlass',
-        '[style.--tui-duration.ms]': 'duration',
-        '[style.--tui-scroll-behavior]': 'reducedMotion ? "auto" : "smooth"',
         '(document:fullscreenchange)': 'top.set(parent)',
         // Required for the :active state to work in Safari. https://stackoverflow.com/a/33681490
         '(touchstart.passive.zoneless)': '0',
@@ -61,12 +51,9 @@ export class TuiRoot {
     private readonly el = tuiInjectElement();
     private readonly child = !!inject(TuiRoot, {optional: true, skipSelf: true});
 
-    protected readonly reducedMotion = inject(TUI_REDUCED_MOTION);
-    protected readonly duration = tuiGetDuration(inject(TUI_ANIMATIONS_SPEED));
     protected readonly top = signal(this.parent);
     protected readonly breakpoint = inject(TUI_BREAKPOINT);
     protected readonly liquidGlass = inject(TUI_LIQUID_GLASS);
-
     protected readonly scrollbars =
         !inject(WA_IS_MOBILE) &&
         !this.child &&
```

**File**: `projects/core/portals/hint/hint-options.directive.ts` (modified, +4/-5)
```diff
@@ -40,19 +40,18 @@ export interface TuiHintOptions extends TuiAppearanceOptions {
 }
 
 /** Default values for hint options */
-export const TUI_HINT_DEFAULT_OPTIONS: TuiHintOptions = {
+export const TUI_HINT_DEFAULT_OPTIONS = {
     direction: 'bottom-start',
     centered: true,
     showDelay: 500,
     hideDelay: 200,
     appearance: '',
     /** TODO @deprecated use {@link TUI_TOOLTIP_OPTIONS} instead **/
     icon: '@tui.circle-help',
-};
+} as const;
 
 /**
  * Default parameters for hint directive
  */
-export const [TUI_HINT_OPTIONS, tuiHintOptionsProvider] = tuiCreateOptions(
-    TUI_HINT_DEFAULT_OPTIONS,
-);
+export const [TUI_HINT_OPTIONS, tuiHintOptionsProvider] =
+    tuiCreateOptions<TuiHintOptions>(TUI_HINT_DEFAULT_OPTIONS);
```

**File**: `projects/core/portals/hint/hint.style.less` (modified, +6/-3)
```diff
@@ -15,6 +15,9 @@
 
     --tui-background-elevation-2: var(--tui-background-elevation-3);
     --tui-scale: 0.5;
+    --t-arrow-inline: 0.75rem;
+    --t-arrow-block: 0.5rem;
+    --t-image: url('data:image/svg+xml,<svg viewBox="0 0 12 8" xmlns="http://www.w3.org/2000/svg"><path d="M3.61336 1.69607L2.44882 2.96493C1.84795 3.61964 0.949361 3.99951 0.00053941 4C0.000359608 4 0.000179805 4 0 4C0.000179863 4 0.000359764 4 0.000539623 4C0.949362 4.00049 1.84795 4.38036 2.44882 5.03506L3.61336 6.30394C4.55981 7.33517 5.03303 7.85079 5.63254 7.96535C5.87433 8.01155 6.12436 8.01155 6.36616 7.96535C6.96567 7.85079 7.43889 7.33517 8.38534 6.30393L9.54988 5.03507C10.1511 4.37994 11.0505 4 12 4C11.0505 4 10.1511 3.62006 9.54988 2.96493L8.38534 1.69606C7.43889 0.664826 6.96567 0.149207 6.36616 0.0346517C6.12436 -0.0115506 5.87433 -0.0115506 5.63254 0.0346517C5.03303 0.149207 4.55981 0.664827 3.61336 1.69607Z" /></svg>');
 
     &.tui-enter {
         animation:
@@ -33,10 +36,10 @@
         position: absolute;
         inset-block-start: var(--t-top);
         inset-inline-start: var(--t-left);
-        inline-size: 0.75rem;
-        block-size: 0.5rem;
+        inline-size: var(--t-arrow-inline);
+        block-size: var(--t-arrow-block);
         background: inherit;
-        mask-image: url('data:image/svg+xml,<svg viewBox="0 0 12 8" xmlns="http://www.w3.org/2000/svg"><path d="M3.61336 1.69607L2.44882 2.96493C1.84795 3.61964 0.949361 3.99951 0.00053941 4C0.000359608 4 0.000179805 4 0 4C0.000179863 4 0.000359764 4 0.000539623 4C0.949362 4.00049 1.84795 4.38036 2.44882 5.03506L3.61336 6.30394C4.55981 7.33517 5.03303 7.85079 5.63254 7.96535C5.87433 8.01155 6.12436 8.01155 6.36616 7.96535C6.96567 7.85079 7.43889 7.33517 8.38534 6.30393L9.54988 5.03507C10.1511 4.37994 11.0505 4 12 4C11.0505 4 10.1511 3.62006 9.54988 2.96493L8.38534 1.69606C7.43889 0.664826 6.96567 0.149207 6.36616 0.0346517C6.12436 -0.0115506 5.87433 -0.0115506 5.63254 0.0346517C5.03303 0.149207 4.55981 0.664827 3.61336 1.69607Z" /></svg>');
+        mask-image: var(--t-image);
         transition: none;
         transform: translate(-50%, -50%) rotate(var(--t-rotate));
     }
```

---

### Incident Patch 12: `ae5b9932` (2026-10-02)
**Commit Message**: fix(addon-table): prevent initial tuiSortChange emit (#15081)

**File**: `projects/addon-table/components/table/directives/sort-by.directive.ts` (modified, +8/-7)
```diff
@@ -5,10 +5,11 @@ import {
     effect,
     inject,
     input,
-    output,
     untracked,
 } from '@angular/core';
+import {outputFromObservable, toObservable} from '@angular/core/rxjs-interop';
 import {type TuiComparator} from '@taiga-ui/addon-table/types';
+import {filter, skip} from 'rxjs';
 
 import {type TuiSortChange} from '../table.options';
 import {TuiTableSortable} from './sortable.directive';
@@ -36,13 +37,13 @@ export class TuiTableSortBy<T extends Partial<Record<keyof T, unknown>>> {
         }
     });
 
-    protected readonly sortOutput = effect(() => {
-        if (this.sortables().length) {
-            this.tuiSortChange.emit(this.sortChange());
-        }
-    });
+    public readonly tuiSortChange = outputFromObservable(
+        toObservable(this.sortChange).pipe(
+            filter(() => Boolean(this.sortables().length)),
+            skip(1),
+        ),
+    );
 
-    public readonly tuiSortChange = output<TuiSortChange<T>>();
     public readonly tuiSortBy = input<string | keyof T | null>(null);
 
     private getKey(sorter: TuiComparator<T> | null): keyof T | null {
```

**File**: `projects/addon-table/components/table/directives/test/sort.spec.ts` (modified, +61/-0)
```diff
@@ -1,5 +1,7 @@
 import {ChangeDetectionStrategy, Component, signal} from '@angular/core';
 import {type ComponentFixture, TestBed} from '@angular/core/testing';
+import {bootstrapApplication, type BootstrapContext} from '@angular/platform-browser';
+import {provideServerRendering, renderApplication} from '@angular/platform-server';
 import {type TuiSortChange, TuiSortDirection, TuiTable} from '@taiga-ui/addon-table';
 
 interface User {
@@ -85,6 +87,12 @@ describe('Table sort', () => {
         fixture = TestBed.createComponent(Test);
         component = fixture.componentInstance;
         fixture.detectChanges();
+        await fixture.whenStable();
+    });
+
+    it('does not emit tuiSortChange on initial render', () => {
+        expect(component.changeCount).toBe(0);
+        expect(component.last).toBeNull();
     });
 
     it('reports a header click through tuiSortChange', () => {
@@ -186,4 +194,57 @@ describe('Table sort', () => {
         expect(component.sortKey()).toBe('name');
         expect(component.direction()).toBe(TuiSortDirection.Desc);
     });
+
+    describe('SSR', () => {
+        @Component({
+            selector: 'tui-test-app',
+            imports: [TuiTable],
+            template: `
+                <table
+                    tuiTable
+                    [columns]="columns"
+                    tuiSortBy="name"
+                    (tuiSortChange)="change()"
+                >
+                    <thead>
+                        <tr tuiThGroup>
+                            <th
+                                *tuiHead="'name'"
+                                tuiSortable
+                                tuiTh
+                            >
+                                Name
+                            </th>
+                        </tr>
+                    </thead>
+                </table>
+            `,
+            changeDetection: ChangeDetectionStrategy.OnPush,
+        })
+        class Test {
+            public static changeCount = 0;
+
+            protected readonly columns = ['name'];
+
+            protected change(): void {
+                Test.changeCount++;
+            }
+        }
+
+        it('does not emit tuiSortChange during server rendering', async () => {
+            Test.changeCount = 0;
+
+            await renderApplication(
+                async (context: BootstrapContext) =>
+                    bootstrapApplication(
+                        Test,
+                        {providers: [provideServerRendering()]},
+                        context,
+                    ),
+                {document: '<tui-test-app></tui-test-app>'},
+            );
+
+            expect(Test.changeCount).toBe(0);
+        });
+    });
 });
```

---

### Incident Patch 13: `935214c1` (2026-09-29)
**Commit Message**: chore: update dependency @taiga-ui/design-tokens to ~0.324.0 (#15117)

**File**: `package-lock.json` (modified, +4/-4)
```diff
@@ -14720,9 +14720,9 @@
             "link": true
         },
         "node_modules/@taiga-ui/design-tokens": {
-            "version": "0.320.0",
-            "resolved": "https://registry.npmjs.org/@taiga-ui/design-tokens/-/design-tokens-0.320.0.tgz",
-            "integrity": "sha512-6iq4w0Dg7U6TNbSPTZsVjlvkjDnDHIJCtqppq9RaNGdNNMdXjxgGEEfs1HqlwrWUa7k6oEbm72v7MyJul4oRdg==",
+            "version": "0.324.0",
+            "resolved": "https://registry.npmjs.org/@taiga-ui/design-tokens/-/design-tokens-0.324.0.tgz",
+            "integrity": "sha512-8LqQ4V3/b+z7KyMMRshh8OreiLpozFQPfcKnXOUxrQX2/ZCNDz1JHND5P//F43iGRFI7riReWl7XFAJgsTS0nA==",
             "license": "Apache-2.0",
             "peer": true,
             "dependencies": {
@@ -51040,7 +51040,7 @@
             "version": "5.26.0",
             "license": "Apache-2.0",
             "peerDependencies": {
-                "@taiga-ui/design-tokens": "~0.320.0"
+                "@taiga-ui/design-tokens": "~0.324.0"
             }
         },
         "projects/taiga-schematics": {
```

**File**: `projects/styles/package.json` (modified, +1/-1)
```diff
@@ -25,6 +25,6 @@
         "./*": "./*"
     },
     "peerDependencies": {
-        "@taiga-ui/design-tokens": "~0.320.0"
+        "@taiga-ui/design-tokens": "~0.324.0"
     }
 }
```

---

### Incident Patch 14: `5fd5455f` (2026-09-29)
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

### Incident Patch 15: `dbb16bf2` (2026-09-29)
**Commit Message**: chore: update dependency @taiga-ui/configs to v0.563.0 (#15107)

**File**: `package-lock.json` (modified, +53/-53)
```diff
@@ -38,7 +38,7 @@
                 "@nx/workspace": "22.1.1",
                 "@schematics/angular": "19.2.27",
                 "@stackblitz/sdk": "1.11.1",
-                "@taiga-ui/configs": "0.560.0",
+                "@taiga-ui/configs": "0.563.0",
                 "@taiga-ui/event-plugins": "5.0.0",
                 "@types/express": "4.17.25",
                 "@types/glob": "9.0.0",
@@ -14607,9 +14607,9 @@
             "link": true
         },
         "node_modules/@taiga-ui/auto-changelog-config": {
-            "version": "0.560.0",
-            "resolved": "https://registry.npmjs.org/@taiga-ui/auto-changelog-config/-/auto-changelog-config-0.560.0.tgz",
-            "integrity": "sha512-kLbOnIbF9UFTotGuhiNGYk2NK/EpOoGjhILd8D7X0gTNP5K3SXYLufzMvGIZsPTkvX9H8JDsbqGF6rHhqAVmew==",
+            "version": "0.563.0",
+            "resolved": "https://registry.npmjs.org/@taiga-ui/auto-changelog-config/-/auto-changelog-config-0.563.0.tgz",
+            "integrity": "sha512-bL3GUPAUbVs50aiR7L6CUJtej+vk5kByuYPlUBKhLKJF6gkqfX65h5FxE72WlUTN02R0yQ8gCwNDG1147SbfHQ==",
             "dev": true,
             "license": "Apache-2.0",
             "peer": true,
@@ -14618,9 +14618,9 @@
             }
         },
         "node_modules/@taiga-ui/browserslist-config": {
-            "version": "0.560.0",
-            "resolved": "https://registry.npmjs.org/@taiga-ui/browserslist-config/-/browserslist-config-0.560.0.tgz",
-            "integrity": "sha512-iCsqaoiBk7iNPMNPo9/JfrmgbO0kKHV1shxFc17nJUuz5dHCT1ZfRjRxiDd680wdSpj1r0el1BpjWH0hKoUBcA==",
+            "version": "0.563.0",
+            "resolved": "https://registry.npmjs.org/@taiga-ui/browserslist-config/-/browserslist-config-0.563.0.tgz",
+            "integrity": "sha512-G9FkzfribfKD6hsDAHkFFOXpdD2a1X4ccCDmIX+ye399WPuHfUZRh9N2lOxwJ302AJ0uVzo0YD3s1NM1TXQ7Dg==",
             "dev": true,
             "license": "Apache-2.0",
             "peer": true
@@ -14630,9 +14630,9 @@
             "link": true
         },
         "node_modules/@taiga-ui/commitlint-config": {
-            "version": "0.560.0",
-            "resolved": "https://registry.npmjs.org/@taiga-ui/commitlint-config/-/commitlint-config-0.560.0.tgz",
-            "integrity": "sha512-5m/dRbVTCNvvHlTfTgDtPdNyx4HTk0ls2K5g1haal/QRhfbc8BIFqxV0pQ/ThNBXu4nVqe8GhQiQ0ymlRoD2cg==",
+            "version": "0.563.0",
+            "resolved": "https://registry.npmjs.org/@taiga-ui/commitlint-config/-/commitlint-config-0.563.0.tgz",
+            "integrity": "sha512-R7ANxH8Syr1tPWALOrsHg2iAZT0T7YLKsf/ZR4XQyNDxrZNCA2hD7QtU+j/HbocvvciW3f4Twl46ukopw4uPEQ==",
             "dev": true,
             "license": "Apache-2.0",
             "peer": true,
@@ -14660,33 +14660,33 @@
             }
         },
         "node_modules/@taiga-ui/configs": {
-            "version": "0.560.0",
-            "resolved": "https://registry.npmjs.org/@taiga-ui/configs/-/configs-0.560.0.tgz",
-            "integrity": "sha512-t0tA06QlSCBKWP9wQijmbjxo4YmgjOHxwOvn7yjPagIMGvi7AO1B+1HuXaWBudCbPizhNoUjNvyzNeynljHp7A==",
+            "version": "0.563.0",
+            "resolved": "https://registry.npmjs.org/@taiga-ui/configs/-/configs-0.563.0.tgz",
+            "integrity": "sha512-Wd3QiEm6TOrfpm3SB4e8R/V3JncRxNPeEI+y+rzVUWMuJwvBhHoHwbNCvsv3wINVqesrNsFXdTRAMlSBUFVPxQ==",
             "dev": true,
             "license": "Apache-2.0",
             "peerDependencies": {
-                "@taiga-ui/auto-changelog-config": "^0.560.0",
-                "@taiga-ui/browserslist-config": "^0.560.0",
-                "@taiga-ui/commitlint-config": "^0.560.0",
-                "@taiga-ui/cspell-config": "^0.560.0",
-                "@taiga-ui/eslint-plugin-experience-next": "^0.560.0",
-                "@taiga-ui/jest-config": "^0.560.0",
-                "@taiga-ui/prettier-config": "^0.560.0",
-                "@taiga-ui/release-it-config": "^0.560.0",
-                "@taiga-ui/stylelint-config": "^0.560.0",
-                "@taiga-ui/syncer": "^0.560.0",
-                "@taiga-ui/tsconfig": "^0.560.0"
+                "@taiga-ui/auto-changelog-config": "^0.563.0",
+                "@taiga-ui/browserslist-config": "^0.563.0",
+                "@taiga-ui/commitlint-config": "^0.563.0",
+                "@taiga-ui/cspell-config": "^0.563.0",
+                "@taiga-ui/eslint-plugin-experience-next": "^0.563.0",
+                "@taiga-ui/jest-config": "^0.563.0",
+                "@taiga-ui/prettier-config": "^0.563.0",
+                "@taiga-ui/release-it-config": "^0.563.0",
+                "@taiga-ui/stylelint-config": "^0.563.0",
+                "@taiga-ui/syncer": "^0.563.0",
+                "@taiga-ui/tsconfig": "^0.563.0"
             }
         },
         "node_modules/@taiga-ui/core": {
             "resolved": "projects/core",
             "link": true
         },
         "node_modules/@taiga-ui/cspell-config": {
-            "version": "0.560.0",
-            "resolved": "https://registry.npmjs.org/@taiga-ui/cspell-config/-/cs
```

**File**: `package.json` (modified, +1/-1)
```diff
@@ -142,7 +142,7 @@
         "@nx/workspace": "22.1.1",
         "@schematics/angular": "19.2.27",
         "@stackblitz/sdk": "1.11.1",
-        "@taiga-ui/configs": "0.560.0",
+        "@taiga-ui/configs": "0.563.0",
         "@taiga-ui/event-plugins": "5.0.0",
         "@types/express": "4.17.25",
         "@types/glob": "9.0.0",
```

#### Recent Merged Pull Requests:
- **PR #15156** (2026-10-05): chore: update dependency @taiga-ui/configs to v0.564.0 (@taiga-family-bot)
- **PR #15155** (2026-10-05): chore: update dependency @types/node to v25.9.8 (@taiga-family-bot)
- **PR #15152** (2026-10-05): 🚀 Release/v5.27.0 (@taiga-family-bot)
- **PR #15151** (2026-10-05): 🚀 Release/v4.102.0 (@taiga-family-bot)
- **PR #15150** (2026-10-05): fix(kit): render long Copy text in Safari (@splincode)
- **PR #15149** (2026-10-05): chore: pin ng-web-apis version for stackblitz (@vladimirpotekhin)
- **PR #15147** (closed): feat(cdk): add readonly control option (@splincode)
- **PR #15146** (2026-10-05): fix(kit): preserve digits when filling input number with postfix (@splincode)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
