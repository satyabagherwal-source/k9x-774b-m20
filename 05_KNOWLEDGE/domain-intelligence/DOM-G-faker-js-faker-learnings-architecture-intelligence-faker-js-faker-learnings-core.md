# Domain G — Architecture Intelligence: Architecture Intelligence: faker-js-faker-learnings Core Invariants

<!-- PROVENANCE_START
{
  "source_repository": "faker-js-faker-learnings",
  "source_url": "unknown",
  "source_version": "HEAD",
  "license": "Open-Source",
  "timestamp": "2026-11-17T08:57:18.516Z",
  "ai_provider": "universal-multi-artifact-distributor",
  "generator_version": "2.0.0-universal",
  "learning_id": "LEARN-EVO-faker-js-faker-learnings",
  "canonical_classification": "domain_intelligence"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [faker-js-faker-learnings](unknown) (Revision: `HEAD`).  
> **License**: Open-Source | **Timestamp**: `2026-11-17T08:57:18.516Z`  
> **Learning ID**: `LEARN-EVO-faker-js-faker-learnings`


## 1. Domain Taxonomy & Context
- **Canonical Domain**: Domain G (Architecture Intelligence)
- **Secondary Corroborating Domains**: H (Technical Construction Intelligence), D (Research & Knowledge Intelligence), M (Feedback & Evolution Intelligence), I (Content & Information Intelligence), K (Quality & Verification Intelligence), J (Search & Distribution Intelligence)
- **Confidence Rating**: 66%

## 2. Core Domain Invariants & Discovered Laws
The following architectural invariants have been empirically discovered and recorded from faker-js-faker-learnings:

> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/faker-js-faker-learnings.md`  
> **Source**: github ([https://github.com/faker-js/faker](https://github.com/faker-js/faker))  
> **Source Version**: `5060c90a`  
> **License**: NOASSERTION  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-11-17T08:56:31.422Z  
> **Learning ID**: `learn-github-faker-js-faker`  
> **Pipeline Version**: `2.0.0`  
> **Status**: VERIFIED_EMPIRICAL_INTELLIGENCE  
> **Data Governance**: CLASSIFICATION: PUBLIC. Sanitized against PII/secrets.  
> **Policy Invariant**: Strictly for engineering retrieval and architecture documentation. Distillation prohibited.  

---

# Forensic Learning Record (Deep Inspection): faker-js/faker

> **Canonical Artifact**: `07_PROJECT_LEARNING/faker-js-faker-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/faker-js/faker](https://github.com/faker-js/faker))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-11-17T08:56:31.418Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `faker-js/faker`
- **Description**: Generate massive amounts of fake data in the browser and node.js
- **Primary Language / Ecosystem**: TypeScript
- **Discovered Manifests / Configurations**: package.json, README.md
- **Stars / Engagement**: 15551 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: package.json, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `src/core.ts`
```
import type { FakerConfig } from './config';
import type { LocaleDefinition } from './definitions';
import type { LocaleProxy } from './internal/locale-proxy';
import { createLocaleProxy } from './internal/locale-proxy';
import type { Randomizer } from './randomizer';
import { mergeLocales } from './utils/merge-locales';
import { generateMersenne53Randomizer } from './utils/mersenne';

/**
 * The core grants access to the locale data, the randomizer and config settings.
 */
export interface FakerCore {
  /**
   * The locale data associated with this instance.
   *
   * Always present, but it might be empty if the locale data is not available.
   */
  readonly locale: LocaleProxy;

  /**
   * The randomizer used to generate random values.
   */
  readonly randomizer: Randomizer;

  /**
   * The configuration settings used by this instance.
   */
  readonly config: FakerConfig;
}

export interface FakerOptions {
  /**
   * The locale definitions to use. If not provided, this core will not have any locale data and thus all methods that rely on locale data will throw an error when called.
   *
   * @default {}
   */
  locale?: LocaleProxy | LocaleDefinition | LocaleDefinition[];
  /**
   * The randomizer used to generate random values.
   *
   * @default generateMersenne53Randomizer()
   */
  randomizer?: Randomizer;
  /**
   * The configuration options for all methods.
   *
   * @default {}
   */
  config?: FakerConfig;
  /**
   * The initial seed to use.
   * The seed can be used to generate reproducible values.
   *
   * Refer to the `seed()` method for more information.
   *
   * Defaults to a random seed.
   */
  seed?: number;
}

/**
 * Helper function to create a FakerCore instance.
 *
 * @remark The `config`, `randomizer` and (single) `locale` instances can be shared between multiple cores.
 * When shared, changing them will affect the other cores as well.
 *
 * @param options The options to create the FakerCore instance with.
 * @param options.locale The locale definitions to use.
 * If not provided, this core will not have any locale data and thus all methods that rely on locale data will throw an error when called.
 * This can be useful if you want to use least amount of memory possible and only use methods that do not rely on locale data.
 * @param options.randomizer The randomizer used to generate random values.
 * Defaults to `generateMersenne53Randomizer()`.
 * @param options.config The configuration options for all methods.
 * Defaults to an empty config.
 * @param options.seed The initial seed to use.
 * The seed can be used to generate reproducible values.
 * Refer to the `seed()` method for more information.
 * Defaults to a random seed.
 *
 * @returns The newly created FakerCore instance.
 *
 * @example
 * import { createFakerCore, en } from '@faker-js/faker';
 *
 * createFakerCore() // no locale data, default randomizer and empty config
 * createFakerCore({ locale: en }) // custom locale data, default randomizer and empty config
 *
 * @since 10.5.0
 */
export function createFakerCore(options: FakerOptions = {}): FakerCore {
  const {
    locale = {},
    randomizer = generateMersenne53Randomizer(),
    config = {},
    seed,
  } = options;

  if (randomizer != null && seed != null) {
    randomizer.seed(seed);
  }

  return {
    locale: createLocaleProxy(
      Array.isArray(locale) ? mergeLocales(locale) : locale
    ),
    randomizer,
    config,
  };
}

```

### Core Architecture Module: `src/locales/af_ZA/location/state.ts`
```
export default [
  'Gauteng',
  'KwaZulu-Natal',
  'Limpopo',
  'Mpumalanga',
  'Noord-Kaap',
  'Noordwes',
  'Oos-Kaap',
  'Vrystaat',
  'Wes-Kaap',
];

```

### Core Architecture Module: `src/locales/ar/location/state.ts`
```
export default [
  'القدس',
  'تل الربيع',
  'صفد',
  'أريحا',
  'بئر السبع',
  'غزة',
  'نابلس',
  'الناصرة',
  'بيت لحم',
  'الخليل',
  'يافا',
  'حيفا',
  'اللد',
  'الرملة',
  'عكا',
  'سخنين',
  'قلنسوة',
  'طيرة',
  'عرابة',
  'رام الله',
  'طولكرم',
  'تونس',
  'بن عروس',
  'أريانة',
  'باجة',
  'بنزرت',
  'قابس',
  'قفصة',
  'جندوبة',
  'القيروان',
  'القصرين',
  'قبلي',
  'الكاف',
  'المهدية',
  'منوبة',
  'مدنين',
  'المنستير',
  'نابل',
  'صفاقس',
  'بوزيد',
  'سليانة',
  'سوسة',
  'تطاوين',
  'توزر',
  'زغوان',
  'أدرار',
  'الشلف',
  'الأغواط',
  'أم البواقي',
  'باتنة',
  'بجاية',
  'بسكرة',
  'بشار',
  'البليدة',
  'البويرة',
  'تمنراست',
  'تبسة',
  'تلمسان',
  'تيارت',
  'تيزي وزو',
  'الجزائر',
  'الجلفة',
  'جيجل',
  'سطيف',
  'سعيدة',
  'سكيكدة',
  'بلعباس',
  'عنابة',
  'قالمة',
  'قسنطينة',
  'المدية',
  'عمان',
  'الزرقاء',
  'إربد',
  'العقبة',
  'السلط',
  'المفرق',
  'جرش',
  'معان',
  'عجلون',
  'حلب',
  'دمشق',
  'حمص',
  'اللاذقية',
  'حماة',
  'طرطوس',
  'دير الزور',
  'السويداء',
  'الحسكة',
  'درعا',
  'إدلب',
  'بيروت',
  'طرابلس',
  'صيدا',
  'صور',
  'النبطية',
  'زحلة',
  'جونيه',
  'حبوش',
  'بعلبك',
  'بغداد',
  'البصرة',
  'نينوى',
  'أربيل',
  'النجف',
  'كركوك',
  'المثنى',
  'القادسية',
  'بابل',
  'كربلاء',
];

```

### Core Architecture Module: `src/locales/az/location/state.ts`
```
export default null;

```

### Core Architecture Module: `src/locales/base/database/engine.ts`
```
export default ['ARCHIVE', 'BLACKHOLE', 'CSV', 'InnoDB', 'MEMORY', 'MyISAM'];

```

### Core Architecture Module: `src/locales/bn_BD/location/state.ts`
```
// Source: https://bangladesh.gov.bd/site/view/division-list/%E0%A6%AC%E0%A6%BF%E0%A6%AD%E0%A6%BE%E0%A6%97%E0%A6%B8%E0%A6%AE%E0%A7%82%E0%A6%B9

export default [
  'বরিশাল',
  'চট্টগ্রাম',
  'ঢাকা',
  'খুলনা',
  'ময়মনসিংহ',
  'রাজশাহী',
  'রংপুর',
  'সিলেট',
];

```

### Core Architecture Module: `src/locales/cs_CZ/location/state.ts`
```
export default [
  'Jihočeský kraj',
  'Jihomoravský kraj',
  'Karlovarský kraj',
  'Kraj Vysočina',
  'Královéhradecký kraj',
  'Liberecký kraj',
  'Moravskoslezský kraj',
  'Olomoucký kraj',
  'Pardubický kraj',
  'Plzeňský kraj',
  'Praha',
  'Středočeský kraj',
  'Ústecký kraj',
  'Zlínský kraj',
];

```

### Core Architecture Module: `src/locales/cs_CZ/location/state_abbr.ts`
```
export default null;

```

### Core Architecture Module: `src/locales/cy/location/state.ts`
```
export default ['Cymru'];

```

### Core Architecture Module: `src/locales/da/location/state.ts`
```
export default [
  'Hovedstaden',
  'Midtjylland',
  'Nordjylland',
  'Sjælland',
  'Syddanmark',
];

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #4271** (2026-11-13): **feat(locale): add date data for tr**
  *Symptoms*: The `tr` locale has no `date` definitions, so `faker.date.month()` and `faker.date.weekday()` return English names when using `fakerTR`. This adds the Turkish month and weekday names, including abbreviations.  Abbreviations follow the CLDR `tr` short formats (e.g. `Oca`, `Şub`, `Pzt`, `Cmt`). The names were checked by a native Turkish speaker. 
  **Post-Mortem & Fix Analysis**:
  > ### <span aria-hidden="true">✅</span> Deploy Preview for *fakerjs* ready! Built [without sensitive environment variables](https://docs.netlify.com/build/environment-variables/get-started/#untrusted-deploys-and-sensitive-variables)  |  Name | Link | |:-:|------------------------| |<span aria-hidden="true">🔨</span> Latest commit | 0b3b0c5c0f333dc91ebfb88ba448daca6c20d968 | |<span aria-hidden="true">🔍</span> Latest deploy log | https://app.netlify.com/projects/fakerjs/deploys/6af640dacd538aed02f11d1f | |<span aria-hidden="true">😎</span> Deploy Preview | [https://deploy-preview-4271.fakerjs.dev](https://deploy-preview-4271.fakerjs.dev) | |<span aria-hidden="true">📱</span> Preview on mobile | <details><summary> Toggle QR Code... </summary><br /><br />![QR Code](https://app.netlify.com/qr-code/eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJ1cmwiOiJodHRwczovL2RlcGxveS1wcmV2aWV3LTQyNzEuZmFrZXJqcy5kZXYifQ.2Iu_-F9us9PwlFvRDHdRdy1zS8QERXqsQamCotxyfsA)<br /><br />_Use your smartphone camera to open Q
  > ## [Codecov](https://app.codecov.io/gh/faker-js/faker/pull/4271?dropdown=coverage&src=pr&el=h1&utm_medium=referral&utm_source=github&utm_content=comment&utm_campaign=pr+comments&utm_term=faker-js) Report :white_check_mark: All modified and coverable lines are covered by tests. :white_check_mark: Project coverage is 99.14%. Comparing base ([`5415aec`](https://app.codecov.io/gh/faker-js/faker/commit/5415aeccc393d10db81d20e89081deffead651fa?dropdown=coverage&el=desc&utm_medium=referral&utm_source=github&utm_content=comment&utm_campaign=pr+comments&utm_term=faker-js)) to head ([`0b3b0c5`](https://app.codecov.io/gh/faker-js/faker/commit/0b3b0c5c0f333dc91ebfb88ba448daca6c20d968?dropdown=coverage&el=desc&utm_medium=referral&utm_source=github&utm_content=comment&utm_campaign=pr+comments&utm_term=faker-js)).  <details><summary>Additional details and impacted files</summary>    ```diff @@           Coverage Diff           @@ ##             next    #4271   +/-   ## ===============================

- **Issue #4270** (2026-11-12): **infra: use actions-lock**
  *Symptoms*: See https://github.blog/changelog/2026-10-28-github-actions-workflow-lockfiles-are-generally-available/  To generate the lockfile  * install `gh` cli * `gh extension install github/gh-actions-lock` * `gh actions-lock`
  **Post-Mortem & Fix Analysis**:
  > ### <span aria-hidden="true">✅</span> Deploy Preview for *fakerjs* ready!   |  Name | Link | |:-:|------------------------| |<span aria-hidden="true">🔨</span> Latest commit | 036f871b74442e13766313935690882af6618114 | |<span aria-hidden="true">🔍</span> Latest deploy log | https://app.netlify.com/projects/fakerjs/deploys/6af54df899a5d63fbc6ecd6b | |<span aria-hidden="true">😎</span> Deploy Preview | [https://deploy-preview-4270.fakerjs.dev](https://deploy-preview-4270.fakerjs.dev) | |<span aria-hidden="true">📱</span> Preview on mobile | <details><summary> Toggle QR Code... </summary><br /><br />![QR Code](https://app.netlify.com/qr-code/eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJ1cmwiOiJodHRwczovL2RlcGxveS1wcmV2aWV3LTQyNzAuZmFrZXJqcy5kZXYifQ.FDNsqGvNODv3FqXGR7w-dERY3FN81N62_k9Z4YUsCRo)<br /><br />_Use your smartphone camera to open QR code link._</details> | |<span aria-hidden="true">🤖</span> Make changes | [Run an agent on this branch](https://app.netlify.com/projects/fakerjs/agent-ru
  > ## [Codecov](https://app.codecov.io/gh/faker-js/faker/pull/4270?dropdown=coverage&src=pr&el=h1&utm_medium=referral&utm_source=github&utm_content=comment&utm_campaign=pr+comments&utm_term=faker-js) Report :white_check_mark: All modified and coverable lines are covered by tests. :white_check_mark: Project coverage is 99.09%. Comparing base ([`5415aec`](https://app.codecov.io/gh/faker-js/faker/commit/5415aeccc393d10db81d20e89081deffead651fa?dropdown=coverage&el=desc&utm_medium=referral&utm_source=github&utm_content=comment&utm_campaign=pr+comments&utm_term=faker-js)) to head ([`036f871`](https://app.codecov.io/gh/faker-js/faker/commit/036f871b74442e13766313935690882af6618114?dropdown=coverage&el=desc&utm_medium=referral&utm_source=github&utm_content=comment&utm_campaign=pr+comments&utm_term=faker-js)).  <details><summary>Additional details and impacted files</summary>    ```diff @@            Coverage Diff             @@ ##             next    #4270      +/-   ## =========================

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

### Incident Patch 1: `5060c90a` (2026-11-13)
**Commit Message**: fix(locale): remove invalid domain suffixes from ru (#4262)

**File**: `src/locales/ru/internet/domain_suffix.ts` (modified, +0/-2)
```diff
@@ -2,7 +2,6 @@ export default [
   'biz',
   'club',
   'com',
-  'edo',
   'host',
   'info',
   'moscow',
@@ -12,7 +11,6 @@ export default [
   'press',
   'pro',
   'ru',
-  'rus',
   'space',
   'store',
   'su',
```

#### Recent Merged Pull Requests:
- **PR #4271** (2026-11-13): feat(locale): add date data for tr (@bahriy-dev)
- **PR #4270** (closed): infra: use actions-lock (@matthewmayer)
- **PR #4266** (closed): feat(locale): add finance data for ko (@nococn)
- **PR #4262** (2026-11-13): fix(locale): remove invalid domain suffixes from ru (@ML642)
- **PR #4260** (closed): refactor(module): reuse one Faker instance per FakerCore in standalone functions (@TheNetherWatcher)
- **PR #4259** (closed): feat(system): add depth option to directoryPath (@QuincyGB)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.


## 3. Application to AI-Builder-Brain Project Construction
- **Applied Blueprints**: `astro-tailwind-v4`, `fullstack-ai-saas`, `universal-native-factory`
- **Regression Shield**: Prevents architectural drift across construction cycles.
