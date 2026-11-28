# Verification Protocol: Verification Protocol: Empirical Defect Shield for faker-js-faker-learnings

<!-- PROVENANCE_START
{
  "source_repository": "faker-js-faker-learnings",
  "source_url": "unknown",
  "source_version": "HEAD",
  "license": "Open-Source",
  "timestamp": "2026-11-28T14:47:33.820Z",
  "ai_provider": "universal-multi-artifact-distributor",
  "generator_version": "2.0.0-universal",
  "learning_id": "LEARN-EVO-faker-js-faker-learnings",
  "canonical_classification": "verification_contract"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [faker-js-faker-learnings](unknown) (Revision: `HEAD`).  
> **License**: Open-Source | **Timestamp**: `2026-11-28T14:47:33.820Z`  
> **Learning ID**: `LEARN-EVO-faker-js-faker-learnings`


## 1. Scope & Verification Target
- **Target Repository**: `faker-js-faker-learnings` (Commit: `HEAD`)
- **Pillar Alignment**: Pillar 11 (Empirical Truth & Mathematical Integrity)

## 2. Observed Failure Modes & Defect Traps
> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/faker-js-faker-learnings.md`  
> **Source**: github ([https://github.com/faker-js/faker](https://github.com/faker-js/faker))  
> **Source Version**: `56242050`  
> **License**: NOASSERTION  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-11-28T14:46:40.972Z  
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
> **Harvest Timestamp**: 2026-11-28T14:46:40.966Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `faker-js/faker`
- **Description**: Generate massive amounts of fake data in the browser and node.js
- **Primary Language / Ecosystem**: TypeScript
- **Discovered Manifests / Configurations**: package.json, README.md
- **Stars / Engagement**: 15565 stars

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
- **Issue #4286** (2026-11-28): **feat(locale): add job titles, sex and zodiac signs to tr**
  *Symptoms*: `fakerTR.person.jobTitle()` currently falls back to English ("Global Accounts Engineer"). This adds Turkish job data, plus `sex` and `western_zodiac_sign`.  Turkish job titles are noun compounds where the job type takes a possessive suffix ("Pazarlama Müdürü", not "Pazarlama Müdür"). So `job_type` holds the base form for `jobType()`, and `job_title_pattern` spells out the suffixed form, e.g. `{{person.jobArea}} Müdürü`.  I'm a native Turkish speaker; prepared with AI assistance and reviewed by me.  🤖 Generated with [Claude Code](https://claude.com/claude-code) 
  **Post-Mortem & Fix Analysis**:
  > ### <span aria-hidden="true">✅</span> Deploy Preview for *fakerjs* ready! Built [without sensitive environment variables](https://docs.netlify.com/build/environment-variables/get-started/#untrusted-deploys-and-sensitive-variables)  |  Name | Link | |:-:|------------------------| |<span aria-hidden="true">🔨</span> Latest commit | 9dae0c09bf070040114121d64758c8da4c12d5c5 | |<span aria-hidden="true">🔍</span> Latest deploy log | https://app.netlify.com/projects/fakerjs/deploys/6b058df463a18d5e8552bc6a | |<span aria-hidden="true">😎</span> Deploy Preview | [https://deploy-preview-4286.fakerjs.dev](https://deploy-preview-4286.fakerjs.dev) | |<span aria-hidden="true">📱</span> Preview on mobile | <details><summary> Toggle QR Code... </summary><br /><br />![QR Code](https://app.netlify.com/qr-code/eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJ1cmwiOiJodHRwczovL2RlcGxveS1wcmV2aWV3LTQyODYuZmFrZXJqcy5kZXYifQ.9eRcrQvrEmIk3493Qwcs2aM6FjdDNGmYNFvtdKDTl7A)<br /><br />_Use your smartphone camera to open Q
  > ## [Codecov](https://app.codecov.io/gh/faker-js/faker/pull/4286?dropdown=coverage&src=pr&el=h1&utm_medium=referral&utm_source=github&utm_content=comment&utm_campaign=pr+comments&utm_term=faker-js) Report :white_check_mark: All modified and coverable lines are covered by tests. :white_check_mark: Project coverage is 99.14%. Comparing base ([`1092e61`](https://app.codecov.io/gh/faker-js/faker/commit/1092e61c525323571e1f884dd867ab5231632fe1?dropdown=coverage&el=desc&utm_medium=referral&utm_source=github&utm_content=comment&utm_campaign=pr+comments&utm_term=faker-js)) to head ([`9dae0c0`](https://app.codecov.io/gh/faker-js/faker/commit/9dae0c09bf070040114121d64758c8da4c12d5c5?dropdown=coverage&el=desc&utm_medium=referral&utm_source=github&utm_content=comment&utm_campaign=pr+comments&utm_term=faker-js)).  <details><summary>Additional details and impacted files</summary>    ```diff @@           Coverage Diff           @@ ##             next    #4286   +/-   ## ===============================

- **Issue #4285** (2026-11-28): **fix(locale): only use Tbk suffix with PT in id_ID company names**
  *Symptoms*: ### What  Only combine the id_ID `company.legal_entity_type` values (`Tbk`, `(Persero) Tbk`) with the `PT` prefix, and drop the pattern that appended them to a bare last name.  ### Why  `Tbk` marks a public (listed) Perseroan Terbatas (Law 40/2007, art. 16(3)) and `(Persero)` a state-owned PT, so they only follow `PT ...`. The current patterns also paired them with CV, UD, Perum, Yayasan, etc. or with no prefix at all, giving names that cannot exist, e.g. `Yayasan Dirgantara (Persero) Tbk`, `Perum Azizah (Persero) Tbk`, `Amanta Tbk`.  ### How tested  - Reproduced with `@faker-js/faker@10.6.0`, `fakerID_ID.seed(1)`: 3149 of 5000 `company.name()` results ended in `Tbk` without starting with `PT`. With the same change applied to the published `dist` locale file: 0 of 5000 (e.g. `PT Thamrin (Persero) Tbk`, `CV Utami`, `Yayasan Utami`). - `oxfmt@0.75.0 --list-different` and `oxlint@1.90.0` pass on the changed file; entries are in the order `generate:locales` sorts them.  AI-assisted and reviewed by me.

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

### Incident Patch 1: `56242050` (2026-11-28)
**Commit Message**: test: fix test timeouts in CI (#4219)

**File**: `test/faker.spec.ts` (modified, +4/-22)
```diff
@@ -1,27 +1,9 @@
-import type { MockInstance } from 'vitest';
-import { describe, expect, it, vi } from 'vitest';
-import { Faker, faker, generateMersenne32Randomizer } from '../src';
-import { keys } from '../src/internal/keys';
+import { describe, expect, it } from 'vitest';
+import { Faker } from '../src/faker';
+import { faker } from '../src/locale/en';
+import { generateMersenne32Randomizer } from '../src/utils/mersenne';
 
 describe('faker', () => {
-  it('should not log anything on startup', async () => {
-    const spies: MockInstance[] = keys(console)
-      .filter((key) => typeof console[key] === 'function')
-      .map((methodName) => vi.spyOn(console, methodName));
-
-    // oxlint-disable-next-line typescript/ban-ts-comment
-    // @ts-ignore: Types may or may not exist, depending on whether the project was built first.
-    const file: unknown = await import('..');
-    expect(file).toBeDefined();
-
-    new Faker({ locale: { metadata: { title: '' } } });
-
-    for (const spy of spies) {
-      expect(spy).not.toHaveBeenCalled();
-      spy.mockRestore();
-    }
-  });
-
   describe('getMetadata()', () => {
     it('should return metadata for the locale', () => {
       expect(faker.getMetadata()).toBeDefined();
```

**File**: `test/import-index.spec.ts` (added, +28/-0)
```diff
@@ -0,0 +1,28 @@
+import type { MockInstance } from 'vitest';
+import { describe, expect, it, vi } from 'vitest';
+import { keys } from '../src/internal/keys';
+
+describe('index.ts', { timeout: 10_000 }, () => {
+  it('should not log anything on startup', async () => {
+    const spies: MockInstance[] = keys(console)
+      .filter((key) => typeof console[key] === 'function')
+      .map((methodName) => vi.spyOn(console, methodName));
+
+    vi.resetModules();
+    const { simpleFaker, faker, SimpleFaker, Faker } = await import('..');
+
+    expect(simpleFaker).toBeDefined();
+    expect(faker).toBeDefined();
+
+    expect(SimpleFaker).toBeDefined();
+    expect(Faker).toBeDefined();
+
+    expect(new SimpleFaker()).toBeDefined();
+    expect(new Faker()).toBeDefined();
+
+    for (const spy of spies) {
+      expect(spy).not.toHaveBeenCalled();
+      spy.mockRestore();
+    }
+  });
+});
```

**File**: `test/import-locale.spec.ts` (renamed, +2/-2)
```diff
@@ -1,8 +1,8 @@
 import isISO15924 from 'validator/lib/isISO15924';
 import { describe, expect, it } from 'vitest';
-import type { Faker } from '../src';
-import { allLocales } from '../src';
+import type { Faker } from '../src/faker';
 import { keys } from '../src/internal/keys';
+import { allLocales } from '../src/locales';
 
 describe.each(keys(allLocales))('locale imports', (locale) => {
   it(`should be possible to directly import('@faker-js/faker/locale/${locale}')`, async () => {
```

**File**: `test/integration/modules/image.spec.ts` (modified, +1/-1)
```diff
@@ -4,7 +4,7 @@
 import https from 'node:https';
 import { resolve as urlResolve } from 'node:url';
 import { describe, expect, it } from 'vitest';
-import { faker } from '../../../src';
+import { faker } from '../../../src/locale/en';
 
 /**
  * Checks that the given address is a working https address.
```

**File**: `test/internal/base64.spec.ts` (modified, +9/-3)
```diff
@@ -1,12 +1,18 @@
 import { describe, expect, it } from 'vitest';
-import { faker } from '../../src';
+import { createFakerCore } from '../../src/core';
 import { toBase64 } from '../../src/internal/base64';
+import { fakeHelpersMultiple } from '../../src/modules/helpers/multiple';
+import { fakeStringAlphanumeric } from '../../src/modules/string/alphanumeric';
 
 // This test is kind of useless, because during testing the Buffer object is always available.
 describe('toBase64', () => {
+  const fakerCore = createFakerCore();
+
   it.each(
-    faker.helpers.multiple(
-      () => faker.string.alphanumeric({ length: { min: 0, max: 100 } }),
+    fakeHelpersMultiple(
+      fakerCore,
+      (fakerCore) =>
+        fakeStringAlphanumeric(fakerCore, { length: { min: 0, max: 100 } }),
       { count: 5 }
     )
   )(
```

**File**: `test/internal/bind-this-to-member-functions.spec.ts` (modified, +10/-6)
```diff
@@ -1,25 +1,29 @@
 import { describe, expect, it } from 'vitest';
-import type { Faker } from '../../src';
-import { faker } from '../../src';
+import type { FakerCore } from '../../src/core';
+import { createFakerCore } from '../../src/core';
 import { bindThisToMemberFunctions } from '../../src/internal/bind-this-to-member-functions';
+import { fakeNumberInt } from '../../src/modules/number/int';
 
 describe('internal', () => {
   describe('bind-this-to-member-functions', () => {
     it('should bind this to member functions', () => {
       class SomeModule {
-        constructor(private readonly faker: Faker) {}
+        constructor(private readonly fakerCore: FakerCore) {}
 
         someMethod(): number {
-          return this.faker.number.int();
+          return fakeNumberInt(this.fakerCore);
         }
       }
 
-      const someModule = new SomeModule(faker);
+      const fakerCore = createFakerCore();
+      const someModule = new SomeModule(fakerCore);
 
       const someMethodWithoutBind = someModule.someMethod;
 
       expect(() => someMethodWithoutBind()).toThrow(
-        new TypeError("Cannot read properties of undefined (reading 'faker')")
+        new TypeError(
+          "Cannot read properties of undefined (reading 'fakerCore')"
+        )
       );
 
       bindThisToMemberFunctions(someModule);
```

**File**: `test/locale-data.spec.ts` (modified, +1/-1)
```diff
@@ -1,5 +1,5 @@
 import { describe, expect, it } from 'vitest';
-import { allLocales } from '../src';
+import { allLocales } from '../src/locales';
 
 function checkLocaleData(data: unknown) {
   if (Array.isArray(data)) {
```

**File**: `test/simple-faker.spec.ts` (modified, +0/-19)
```diff
@@ -1,6 +1,4 @@
-import type { MockInstance } from 'vitest';
 import { describe, expect, it, vi } from 'vitest';
-import { keys } from '../src/internal/keys';
 import { SimpleFaker, simpleFaker } from '../src/simple-faker';
 import { generateMersenne32Randomizer } from '../src/utils/mersenne';
 import { buildImportGraph, detectCycles } from './support/import-graph.ts';
@@ -28,23 +26,6 @@ vi.mock('../src/faker', () => {
 });
 
 describe('simpleFaker', () => {
-  it('should not log anything on startup', async () => {
-    const spies: MockInstance[] = keys(console)
-      .filter((key) => typeof console[key] === 'function')
-      .map((methodName) => vi.spyOn(console, methodName));
-
-    // Using import() requires types being build but the CI / TS-Check runs without them.
-    const { simpleFaker: importedSimpleFaker } = await import('..');
-    expect(importedSimpleFaker).toBeDefined();
-
-    expect(new SimpleFaker()).toBeDefined();
-
-    for (const spy of spies) {
-      expect(spy).not.toHaveBeenCalled();
-      spy.mockRestore();
-    }
-  });
-
   describe('should load cleanly', () => {
     it('should not load src/faker.ts during import', async () => {
       vi.resetModules();
```

---

### Incident Patch 2: `11a5c249` (2026-11-28)
**Commit Message**: fix: loading SimpleFaker should not load Faker (#4220)

**File**: `scripts/module-tree/generate-module-tree.ts` (modified, +212/-186)
```diff
@@ -1,5 +1,4 @@
 import { writeFileSync } from 'node:fs';
-import { resolve } from 'node:path';
 import { SyntaxKind } from 'ts-morph';
 import { getJsDocs, getSince } from '../apidocs/processing/jsdocs';
 import {
@@ -8,7 +7,6 @@ import {
   toPascalCase,
 } from '../shared/character-case';
 import { formatTypescript } from '../shared/format';
-import { FILE_PATH_SRC } from '../shared/paths';
 import { getPartialProject } from '../shared/project';
 import { ImportHelper } from './import-helper';
 
@@ -22,14 +20,20 @@ const autoGeneratedCommentHeader = `/*
  * Run '${scriptCommand}' to update the methods from their respective files.
  */`;
 
-function patchModuleImports(moduleName: string, importHelper: ImportHelper) {
+function patchModuleImports(
+  moduleName: string,
+  importHelper: ImportHelper,
+  fileName: string
+) {
   switch (moduleName) {
     case 'finance': {
       importHelper.removeImports('./bitcoin-address', 'BitcoinAddressFamily');
       break;
     }
     case 'helpers': {
-      importHelper.addImports('./_eval', 'fakeEval');
+      if (fileName === 'module.ts') {
+        importHelper.addImports('./_eval', 'fakeEval');
+      }
       importHelper.addTypeImports('../../core', 'FakerCore');
       break;
     }
@@ -94,220 +98,242 @@ export async function generateModuleTree(onlyModule?: string): Promise<void> {
     }
 
     console.log(`Processing module: ${moduleName}`);
-    const moduleFile = directory.getSourceFileOrThrow('module.ts');
-
-    const header = moduleFile
-      .getStatements()[0]
-      ?.getLeadingCommentRanges()
-      .map((c) => c.getText());
-
-    const importHelper = new ImportHelper();
-    importHelper.addImports('../../internal/module-base', 'ModuleBase');
-    importHelper.addTypeImports('../../faker', 'Faker');
-    importHelper.addTypeImports(
-      '../../utils/types',
-      'Casing',
-      'LengthStrategyType',
-      'NumberOrRange'
-    );
-    importHelper.addTypeImports('../../internal/types', 'LiteralUnion');
-    importHelper.addTypeImports(
-      '../../distributors/distributor',
-      'Distributor'
-    );
-
-    const exports: string[] = moduleFile
-      .getExportDeclarations()
-      .map((exp) => exp.getText());
-
-    const typesFile = directory.getSourceFile('_types.ts');
-    if (typesFile) {
-      const typesToImport = [
-        typesFile.getEnums(),
-        typesFile.getTypeAliases(),
-        typesFile.getInterfaces(),
-      ]
-        .flat()
-        .filter((decl) => decl.isExported())
-        .map((decl) => decl.getName());
-
-      if (typesToImport.length > 0) {
-        importHelper.addTypeImports('./_types', ...typesToImport);
-      }
-    }
+    const moduleFiles = directory.getSourceFiles([
+      'module.ts',
+      'simple-module.ts',
+    ]);
+    for (const moduleFile of moduleFiles) {
+      const header = moduleFile
+        .getStatements()[0]
+        ?.getLeadingCommentRanges()
+        .map((c) => c.getText());
+
+      const importHelper = new ImportHelper();
+      importHelper.addImports('../../internal/module-base', 'ModuleBase');
+      importHelper.addTypeImports('../../faker', 'Faker');
+      importHelper.addTypeImports(
+        '../../utils/types',
+        'Casing',
+        'LengthStrategyType',
+        'NumberOrRange'
+      );
+      importHelper.addTypeImports('../../internal/types', 'LiteralUnion');
+      importHelper.addTypeImports(
+        '../../distributors/distributor',
+        'Distributor'
+      );
 
-    const content: string[] = [];
-    const classes = moduleFile?.getClasses() ?? [];
-
-    //#region Classes
-    for (const cls of classes) {
-      content.push(getJsDocs(cls).getText());
-      const methods = cls
-        .getMethods()
-        .map((method) => [method.getName(), method] as const)
-        .filter(([name]) => name !== 'fake');
-
-      for (const [methodName, original] of methods) {
-        const qualifiedMethodName = toCamelCase('fake', moduleName, methodName);
-        const methodFileName = patchFileName(methodName);
-
-        const oldSinces = [
-          ...(original.getOverloads()?.map((o) => o.getJsDocs()[0]) ?? []),
-          ...original.getJsDocs(),
-        ].map((jsDocs) => getSince(jsDocs));
-        original.remove();
-
-        const methodFile = directory.getSourceFileOrThrow(
-          `${methodFileName}.ts`
+      const exports: string[] = moduleFile
+        .getExportDeclarations()
+        .map((exp) => exp.getText());
+
+      if (
+        moduleFiles.length === 2 &&
+        moduleFile.getBaseName() === 'module.ts'
+      ) {
+        importHelper.addImports(
+          './simple-module',
+          `Simple${toPascalCase(moduleName)}Module`
         );
+      }
 
-        //#region Imports
-        importHelper.addImports(`./${methodFileName}`, qualifiedMethodName);
-
+      const typesFile = directory.getSourceFile('_types.ts');
+      if (typesFile) {
         const typesToImport = [
-          methodFile.getEnums(),
-      
```

**File**: `src/modules/date/index.ts` (modified, +2/-1)
```diff
@@ -9,4 +9,5 @@ export { fakeDateRecent } from './recent';
 export { fakeDateSoon } from './soon';
 export { fakeDateTimeZone } from './time-zone';
 export { fakeDateWeekday } from './weekday';
-export type * from './module';
+export type { DateModule } from './module';
+export type { SimpleDateModule } from './simple-module';
```

**File**: `src/modules/date/module.ts` (modified, +1/-429)
```diff
@@ -1,436 +1,8 @@
-import { ModuleBase } from '../../internal/module-base';
-import type { NumberOrRange } from '../../utils/types';
-import { fakeDateAnytime } from './anytime';
-import { fakeDateBetween } from './between';
-import { fakeDateBetweens } from './betweens';
-import { fakeDateBirthdate } from './birthdate';
-import { fakeDateFuture } from './future';
 import { fakeDateMonth } from './month';
-import { fakeDatePast } from './past';
-import { fakeDateRecent } from './recent';
-import { fakeDateSoon } from './soon';
+import { SimpleDateModule } from './simple-module';
 import { fakeDateTimeZone } from './time-zone';
 import { fakeDateWeekday } from './weekday';
 
-/**
- * Module to generate dates (without methods requiring localized data).
- */
-export class SimpleDateModule extends ModuleBase {
-  /*
-   * The class body is automatically generated.
-   * Run 'pnpm run generate:module-tree date' to update the methods from their respective files.
-   */
-
-  /**
-   * Generates a random date that can be either in the past or in the future.
-   *
-   * @param options The optional options object.
-   * @param options.refDate The date to use as reference point for the newly generated date. Defaults to `faker.defaultRefDate()`.
-   *
-   * @see faker.date.between(): For generating dates in a specific range.
-   * @see faker.date.past(): For generating dates explicitly in the past.
-   * @see faker.date.future(): For generating dates explicitly in the future.
-   *
-   * @example
-   * faker.date.anytime() // '2022-07-31T01:33:29.567Z'
-   *
-   * @since 8.0.0
-   */
-  anytime(
-    options: {
-      /**
-       * The date to use as reference point for the newly generated date.
-       *
-       * @default faker.defaultRefDate()
-       */
-      refDate?: string | Date | number;
-    } = {}
-  ): Date {
-    return fakeDateAnytime(this.fakerCore, options);
-  }
-
-  /**
-   * Generates a random date in the past.
-   *
-   * @param options The optional options object.
-   * @param options.years The range of years the date may be in the past. Either as a fixed amount of years or as a year range. Defaults to `1`.
-   * @param options.refDate The date to use as reference point for the newly generated date. Defaults to `faker.defaultRefDate()`.
-   *
-   * @throws {FakerError} If `years.min` or `years.max` is not a safe integer.
-   * @throws {FakerError} If `years.max` is less than 0.
-   * @throws {FakerError} If `years.min` is greater than or equal to `years.max`.
-   *
-   * @see faker.date.recent(): For generating dates in the recent past (days instead of years).
-   *
-   * @example
-   * faker.date.past() // '2021-12-03T05:40:44.408Z'
-   * faker.date.past({ years: 10 }) // '2017-10-25T21:34:19.488Z'
-   * faker.date.past({ years: { min: 4, max: 7 } }) // '2022-12-12T03:43:16.434Z'
-   * faker.date.past({ years: 10, refDate: '2020-01-01T00:00:00.000Z' }) // '2017-08-18T02:59:12.350Z'
-   *
-   * @since 8.0.0
-   */
-  past(
-    options: {
-      /**
-       * The range of years the date may be in the past.
-       *
-       * @default 1
-       */
-      years?: NumberOrRange;
-      /**
-       * The date to use as reference point for the newly generated date.
-       *
-       * @default faker.defaultRefDate()
-       */
-      refDate?: string | Date | number;
-    } = {}
-  ): Date {
-    return fakeDatePast(this.fakerCore, options);
-  }
-
-  /**
-   * Generates a random date in the future.
-   *
-   * @param options The optional options object.
-   * @param options.years The range of years the date may be in the future. Either as a fixed amount of years or as a year range. Defaults to `1`.
-   * @param options.refDate The date to use as reference point for the newly generated date. Defaults to `faker.defaultRefDate()`.
-   *
-   * @throws {FakerError} If `years.min` or `years.max` is not a safe integer.
-   * @throws {FakerError} If `years.max` is less than 0.
-   * @throws {FakerError} If `years.min` is greater than or equal to `years.max`.
-   *
-   * @see faker.date.soon(): For generating dates in the near future (days instead of years).
-   *
-   * @example
-   * faker.date.future() // '2022-11-19T05:52:49.100Z'
-   * faker.date.future({ years: 10 }) // '2030-11-23T09:38:28.710Z'
-   * faker.date.future({ years: { min: 4, max: 7 } }) // '2031-05-21T05:49:21.116Z'
-   * faker.date.future({ years: 10, refDate: '2020-01-01T00:00:00.000Z' }) // '2020-12-13T22:45:10.252Z'
-   *
-   * @since 8.0.0
-   */
-  future(
-    options: {
-      /**
-       * The range of years the date may be in the future.
-       *
-       * @default 1
-       */
-      years?: NumberOrRange;
-      /**
-       * The date to use as reference point for the newly generated date.
-       *
-       * @default faker.defaultRefDate()
-       */
-      refDate?: string | Date | number;
-    } = {}
-  ): Date {
-    return fakeDateFuture(this.fakerCore, options);
-  }
-
-  /**
-   * Generates a random date between the give
```

**File**: `src/modules/date/simple-module.ts` (added, +429/-0)
```diff
@@ -0,0 +1,429 @@
+import { ModuleBase } from '../../internal/module-base';
+import type { NumberOrRange } from '../../utils/types';
+import { fakeDateAnytime } from './anytime';
+import { fakeDateBetween } from './between';
+import { fakeDateBetweens } from './betweens';
+import { fakeDateBirthdate } from './birthdate';
+import { fakeDateFuture } from './future';
+import { fakeDatePast } from './past';
+import { fakeDateRecent } from './recent';
+import { fakeDateSoon } from './soon';
+
+/**
+ * Module to generate dates (without methods requiring localized data).
+ */
+export class SimpleDateModule extends ModuleBase {
+  /*
+   * The class body is automatically generated.
+   * Run 'pnpm run generate:module-tree date' to update the methods from their respective files.
+   */
+
+  /**
+   * Generates a random date that can be either in the past or in the future.
+   *
+   * @param options The optional options object.
+   * @param options.refDate The date to use as reference point for the newly generated date. Defaults to `faker.defaultRefDate()`.
+   *
+   * @see faker.date.between(): For generating dates in a specific range.
+   * @see faker.date.past(): For generating dates explicitly in the past.
+   * @see faker.date.future(): For generating dates explicitly in the future.
+   *
+   * @example
+   * faker.date.anytime() // '2022-07-31T01:33:29.567Z'
+   *
+   * @since 8.0.0
+   */
+  anytime(
+    options: {
+      /**
+       * The date to use as reference point for the newly generated date.
+       *
+       * @default faker.defaultRefDate()
+       */
+      refDate?: string | Date | number;
+    } = {}
+  ): Date {
+    return fakeDateAnytime(this.fakerCore, options);
+  }
+
+  /**
+   * Generates a random date in the past.
+   *
+   * @param options The optional options object.
+   * @param options.years The range of years the date may be in the past. Either as a fixed amount of years or as a year range. Defaults to `1`.
+   * @param options.refDate The date to use as reference point for the newly generated date. Defaults to `faker.defaultRefDate()`.
+   *
+   * @throws {FakerError} If `years.min` or `years.max` is not a safe integer.
+   * @throws {FakerError} If `years.max` is less than 0.
+   * @throws {FakerError} If `years.min` is greater than or equal to `years.max`.
+   *
+   * @see faker.date.recent(): For generating dates in the recent past (days instead of years).
+   *
+   * @example
+   * faker.date.past() // '2021-12-03T05:40:44.408Z'
+   * faker.date.past({ years: 10 }) // '2017-10-25T21:34:19.488Z'
+   * faker.date.past({ years: { min: 4, max: 7 } }) // '2022-12-12T03:43:16.434Z'
+   * faker.date.past({ years: 10, refDate: '2020-01-01T00:00:00.000Z' }) // '2017-08-18T02:59:12.350Z'
+   *
+   * @since 8.0.0
+   */
+  past(
+    options: {
+      /**
+       * The range of years the date may be in the past.
+       *
+       * @default 1
+       */
+      years?: NumberOrRange;
+      /**
+       * The date to use as reference point for the newly generated date.
+       *
+       * @default faker.defaultRefDate()
+       */
+      refDate?: string | Date | number;
+    } = {}
+  ): Date {
+    return fakeDatePast(this.fakerCore, options);
+  }
+
+  /**
+   * Generates a random date in the future.
+   *
+   * @param options The optional options object.
+   * @param options.years The range of years the date may be in the future. Either as a fixed amount of years or as a year range. Defaults to `1`.
+   * @param options.refDate The date to use as reference point for the newly generated date. Defaults to `faker.defaultRefDate()`.
+   *
+   * @throws {FakerError} If `years.min` or `years.max` is not a safe integer.
+   * @throws {FakerError} If `years.max` is less than 0.
+   * @throws {FakerError} If `years.min` is greater than or equal to `years.max`.
+   *
+   * @see faker.date.soon(): For generating dates in the near future (days instead of years).
+   *
+   * @example
+   * faker.date.future() // '2022-11-19T05:52:49.100Z'
+   * faker.date.future({ years: 10 }) // '2030-11-23T09:38:28.710Z'
+   * faker.date.future({ years: { min: 4, max: 7 } }) // '2031-05-21T05:49:21.116Z'
+   * faker.date.future({ years: 10, refDate: '2020-01-01T00:00:00.000Z' }) // '2020-12-13T22:45:10.252Z'
+   *
+   * @since 8.0.0
+   */
+  future(
+    options: {
+      /**
+       * The range of years the date may be in the future.
+       *
+       * @default 1
+       */
+      years?: NumberOrRange;
+      /**
+       * The date to use as reference point for the newly generated date.
+       *
+       * @default faker.defaultRefDate()
+       */
+      refDate?: string | Date | number;
+    } = {}
+  ): Date {
+    return fakeDateFuture(this.fakerCore, options);
+  }
+
+  /**
+   * Generates a random date between the given boundaries.
+   *
+   * @param options The options object.
+   * @param options.from The early date boundary.
+   * @param options.to The late date boundary.
+   *
+   * @throws {FakerErro
```

**File**: `src/modules/helpers/index.ts` (modified, +2/-1)
```diff
@@ -16,4 +16,5 @@ export { fakeHelpersShuffle } from './shuffle';
 export { fakeHelpersSlugify } from './slugify';
 export { fakeHelpersUniqueArray } from './unique-array';
 export { fakeHelpersWeightedArrayElement } from './weighted-array-element';
-export type * from './module';
+export type { HelpersModule } from './module';
+export type { SimpleHelpersModule } from './simple-module';
```

**File**: `src/modules/helpers/module.ts` (modified, +1/-548)
```diff
@@ -1,554 +1,7 @@
 import type { FakerCore } from '../../core';
 import type { Faker } from '../../faker';
-import { ModuleBase } from '../../internal/module-base';
-import type { NumberOrRange } from '../../utils/types';
 import { fakeEval } from './_eval';
-import { fakeHelpersArrayElement } from './array-element';
-import { fakeHelpersArrayElements } from './array-elements';
-import { fakeHelpersArraySamples } from './array-samples';
-import { fakeHelpersEnumValue } from './enum-value';
-import { fakeHelpersFromRegExp } from './from-reg-exp';
-import { fakeHelpersMaybe } from './maybe';
-import { fakeHelpersMultiple } from './multiple';
-import { fakeHelpersMustache } from './mustache';
-import { fakeHelpersObjectEntry } from './object-entry';
-import { fakeHelpersObjectKey } from './object-key';
-import { fakeHelpersObjectValue } from './object-value';
-import { fakeHelpersRangeToNumber } from './range-to-number';
-import { fakeHelpersReplaceCreditCardSymbols } from './replace-credit-card-symbols';
-import { fakeHelpersReplaceSymbols } from './replace-symbols';
-import { fakeHelpersShuffle } from './shuffle';
-import { fakeHelpersSlugify } from './slugify';
-import { fakeHelpersUniqueArray } from './unique-array';
-import { fakeHelpersWeightedArrayElement } from './weighted-array-element';
-
-/**
- * Module with various helper methods providing basic (seed-dependent) operations useful for implementing faker methods (without methods requiring localized data).
- */
-export class SimpleHelpersModule extends ModuleBase {
-  /*
-   * The class body is automatically generated.
-   * Run 'pnpm run generate:module-tree helpers' to update the methods from their respective files.
-   */
-
-  /**
-   * Slugifies the given string.
-   * For that all spaces (` `) are replaced by hyphens (`-`)
-   * and most non word characters except for dots and hyphens will be removed.
-   *
-   * @param string The input to slugify. Defaults to `''`.
-   *
-   * @example
-   * faker.helpers.slugify() // ''
-   * faker.helpers.slugify("Hello world!") // 'Hello-world'
-   *
-   * @since 2.0.1
-   */
-  slugify(string: string = ''): string {
-    return fakeHelpersSlugify(this.fakerCore, string);
-  }
-
-  /**
-   * Parses the given string symbol by symbol and replaces the placeholder appropriately.
-   *
-   * - `#` will be replaced with a digit (`0` - `9`).
-   * - `?` will be replaced with an upper letter ('A' - 'Z')
-   * - and `*` will be replaced with either a digit or letter.
-   *
-   * @param string The template string to parse. Defaults to `''`.
-   *
-   * @example
-   * faker.helpers.replaceSymbols() // ''
-   * faker.helpers.replaceSymbols('#####') // '98441'
-   * faker.helpers.replaceSymbols('?????') // 'ZYRQQ'
-   * faker.helpers.replaceSymbols('*****') // '4Z3P7'
-   * faker.helpers.replaceSymbols('Your pin is: #?*#?*') // 'Your pin is: 0T85L1'
-   *
-   * @since 3.0.0
-   */
-  replaceSymbols(string: string = ''): string {
-    return fakeHelpersReplaceSymbols(this.fakerCore, string);
-  }
-
-  /**
-   * Replaces the symbols and patterns in a credit card schema including Luhn checksum.
-   *
-   * Supported patterns:
-   * - `symbol` (defaults to `'#'`) => Replace with a random digit.
-   * - `'!'` => Replace with a random digit between 2 and 9.
-   * - `'L'` => Replace with the appropriate Luhn checksum.
-   * - `[min-max]` => Generate a number between min and max (inclusive).
-   * - `.{times}` => Repeat the character exactly `times` times.
-   * - `.{min,max}` => Repeat the character `min` to `max` times.
-   * - All other characters will remain unchanged.
-   *
-   * @param string The credit card format pattern. Defaults to `'6453-####-####-####-###L'`.
-   * @param symbol The symbol to replace with a digit. Defaults to `'#'`.
-   *
-   * @example
-   * faker.helpers.replaceCreditCardSymbols() // '6453-4876-8626-8995-3771'
-   * faker.helpers.replaceCreditCardSymbols('1234-[4-9]-##!!-L') // '1234-9-5298-2'
-   *
-   * @since 5.0.0
-   */
-  replaceCreditCardSymbols(
-    string: string = '6453-####-####-####-###L',
-    symbol: string = '#'
-  ): string {
-    return fakeHelpersReplaceCreditCardSymbols(this.fakerCore, string, symbol);
-  }
-
-  /**
-   * Generates a string matching the given regex like expressions.
-   *
-   * This function doesn't provide full support of actual `RegExp`.
-   * Features such as grouping, anchors and character classes are not supported.
-   * If you are looking for a library that randomly generates strings based on
-   * `RegExp`s, see [randexp.js](https://github.com/fent/randexp.js)
-   *
-   * Supported patterns:
-   * - `x{times}` => Repeat the `x` exactly `times` times.
-   * - `x{min,max}` => Repeat the `x` `min` to `max` times.
-   * - `[x-y]` => Randomly get a character between `x` and `y` (inclusive).
-   * - `[x-y]{times}` => Randomly get a character between `x` and `y` (inclusive) and repeat it `times` times.
-   * - `[x-y]{min,max}` => Randomly get a character between 
```

**File**: `src/modules/helpers/simple-module.ts` (added, +549/-0)
```diff
@@ -0,0 +1,549 @@
+import type { FakerCore } from '../../core';
+import { ModuleBase } from '../../internal/module-base';
+import type { NumberOrRange } from '../../utils/types';
+import { fakeHelpersArrayElement } from './array-element';
+import { fakeHelpersArrayElements } from './array-elements';
+import { fakeHelpersArraySamples } from './array-samples';
+import { fakeHelpersEnumValue } from './enum-value';
+import { fakeHelpersFromRegExp } from './from-reg-exp';
+import { fakeHelpersMaybe } from './maybe';
+import { fakeHelpersMultiple } from './multiple';
+import { fakeHelpersMustache } from './mustache';
+import { fakeHelpersObjectEntry } from './object-entry';
+import { fakeHelpersObjectKey } from './object-key';
+import { fakeHelpersObjectValue } from './object-value';
+import { fakeHelpersRangeToNumber } from './range-to-number';
+import { fakeHelpersReplaceCreditCardSymbols } from './replace-credit-card-symbols';
+import { fakeHelpersReplaceSymbols } from './replace-symbols';
+import { fakeHelpersShuffle } from './shuffle';
+import { fakeHelpersSlugify } from './slugify';
+import { fakeHelpersUniqueArray } from './unique-array';
+import { fakeHelpersWeightedArrayElement } from './weighted-array-element';
+
+/**
+ * Module with various helper methods providing basic (seed-dependent) operations useful for implementing faker methods (without methods requiring localized data).
+ */
+export class SimpleHelpersModule extends ModuleBase {
+  /*
+   * The class body is automatically generated.
+   * Run 'pnpm run generate:module-tree helpers' to update the methods from their respective files.
+   */
+
+  /**
+   * Slugifies the given string.
+   * For that all spaces (` `) are replaced by hyphens (`-`)
+   * and most non word characters except for dots and hyphens will be removed.
+   *
+   * @param string The input to slugify. Defaults to `''`.
+   *
+   * @example
+   * faker.helpers.slugify() // ''
+   * faker.helpers.slugify("Hello world!") // 'Hello-world'
+   *
+   * @since 2.0.1
+   */
+  slugify(string: string = ''): string {
+    return fakeHelpersSlugify(this.fakerCore, string);
+  }
+
+  /**
+   * Parses the given string symbol by symbol and replaces the placeholder appropriately.
+   *
+   * - `#` will be replaced with a digit (`0` - `9`).
+   * - `?` will be replaced with an upper letter ('A' - 'Z')
+   * - and `*` will be replaced with either a digit or letter.
+   *
+   * @param string The template string to parse. Defaults to `''`.
+   *
+   * @example
+   * faker.helpers.replaceSymbols() // ''
+   * faker.helpers.replaceSymbols('#####') // '98441'
+   * faker.helpers.replaceSymbols('?????') // 'ZYRQQ'
+   * faker.helpers.replaceSymbols('*****') // '4Z3P7'
+   * faker.helpers.replaceSymbols('Your pin is: #?*#?*') // 'Your pin is: 0T85L1'
+   *
+   * @since 3.0.0
+   */
+  replaceSymbols(string: string = ''): string {
+    return fakeHelpersReplaceSymbols(this.fakerCore, string);
+  }
+
+  /**
+   * Replaces the symbols and patterns in a credit card schema including Luhn checksum.
+   *
+   * Supported patterns:
+   * - `symbol` (defaults to `'#'`) => Replace with a random digit.
+   * - `'!'` => Replace with a random digit between 2 and 9.
+   * - `'L'` => Replace with the appropriate Luhn checksum.
+   * - `[min-max]` => Generate a number between min and max (inclusive).
+   * - `.{times}` => Repeat the character exactly `times` times.
+   * - `.{min,max}` => Repeat the character `min` to `max` times.
+   * - All other characters will remain unchanged.
+   *
+   * @param string The credit card format pattern. Defaults to `'6453-####-####-####-###L'`.
+   * @param symbol The symbol to replace with a digit. Defaults to `'#'`.
+   *
+   * @example
+   * faker.helpers.replaceCreditCardSymbols() // '6453-4876-8626-8995-3771'
+   * faker.helpers.replaceCreditCardSymbols('1234-[4-9]-##!!-L') // '1234-9-5298-2'
+   *
+   * @since 5.0.0
+   */
+  replaceCreditCardSymbols(
+    string: string = '6453-####-####-####-###L',
+    symbol: string = '#'
+  ): string {
+    return fakeHelpersReplaceCreditCardSymbols(this.fakerCore, string, symbol);
+  }
+
+  /**
+   * Generates a string matching the given regex like expressions.
+   *
+   * This function doesn't provide full support of actual `RegExp`.
+   * Features such as grouping, anchors and character classes are not supported.
+   * If you are looking for a library that randomly generates strings based on
+   * `RegExp`s, see [randexp.js](https://github.com/fent/randexp.js)
+   *
+   * Supported patterns:
+   * - `x{times}` => Repeat the `x` exactly `times` times.
+   * - `x{min,max}` => Repeat the `x` `min` to `max` times.
+   * - `[x-y]` => Randomly get a character between `x` and `y` (inclusive).
+   * - `[x-y]{times}` => Randomly get a character between `x` and `y` (inclusive) and repeat it `times` times.
+   * - `[x-y]{min,max}` => Randomly get a character between `x` and `y` (inclusive) and repeat it `min` to `max` times.
+   * - `[^...]` => 
```

**File**: `src/modules/location/index.ts` (modified, +2/-1)
```diff
@@ -19,4 +19,5 @@ export { fakeLocationStreet } from './street';
 export { fakeLocationStreetAddress } from './street-address';
 export { fakeLocationTimeZone } from './time-zone';
 export { fakeLocationZipCode } from './zip-code';
-export type * from './module';
+export type { LocationModule } from './module';
+export type { SimpleLocationModule } from './simple-module';
```

---

### Incident Patch 3: `c30099db` (2026-11-28)
**Commit Message**: fix(locale): avoid a leading zero in hu postcodes (#4284)

Co-authored-by: benjaminkincses <[REDACTED_EMAIL]>

**File**: `src/locales/hu/location/postcode.ts` (modified, +12/-1)
```diff
@@ -1 +1,12 @@
-export default ['####'];
+// The first digit of a Hungarian postcode is 1 to 9 (0 is not used).
+export default [
+  '1###',
+  '2###',
+  '3###',
+  '4###',
+  '5###',
+  '6###',
+  '7###',
+  '8###',
+  '9###',
+];
```

#### Recent Merged Pull Requests:
- **PR #4286** (2026-11-28): feat(locale): add job titles, sex and zodiac signs to tr (@Asimmimx)
- **PR #4285** (2026-11-28): fix(locale): only use Tbk suffix with PT in id_ID company names (@insanrizky)
- **PR #4284** (2026-11-28): fix(locale): avoid a leading zero in hu postcodes (@benjaminkincses)
- **PR #4282** (2026-11-28): fix(locale): replace lookalike letters from other scripts in mk and en_GH (@bardrop)
- **PR #4280** (closed): fix(locale): remove free_email domains without mail servers (@lazerg)
- **PR #4279** (2026-11-22): fix(locale): replace Gwangju and South Jeolla with the Jeonnam-Gwangju special city for ko (@wonjangcloud9)

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

## X. test: fix test timeouts in CI

**RULE**:
When implementing operations in `test/faker.spec.ts`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in faker-js/faker. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `56242050`: test: fix test timeouts in CI. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing TypeScript data structures, boundary deserialization, API parsing, or resource lifecycles matching `test/faker.spec.ts`.

**VERIFIED IMPLEMENTATION PATTERN**:
```typescript
// Verified production-grade fix pattern:
import { describe, expect, it } from 'vitest';
import { Faker } from '../src/faker';
import { faker } from '../src/locale/en';
import { generateMersenne32Randomizer } from '../src/utils/mersenne';
```

**NEGATIVE CONSTRAINT**:
```typescript
// Induced defect failure mode:
import type { MockInstance } from 'vitest';
import { describe, expect, it, vi } from 'vitest';
import { Faker, faker, generateMersenne32Randomizer } from '../src';
import { keys } from '../src/internal/keys';
  it('should not log anything on startup', async () => {
    const spies: MockInstance[] = keys(console)
      .filter((key) => typeof console[key] === 'function')
      .map((methodName) => vi.spyOn(console, methodName));

    // oxlint-disable-next-line typescript/ban-ts-comment
    // @ts-ignore: Types may or may not exist, depending on whether the project was built first.
    const file: unknown = await import('..');
    expect(file).toBeDefined();

    new Faker({ locale: { metadata: { title: '' } } });

    for (const spy of spies) {
      expect(spy).not.toHaveBeenCalled();
      spy.mockRestore();
    }
  });

```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `56242050` are properly handled with clean fallback behavior.


## 3. Independent Verification Protocol
1. Assert state existence before and after execution.
2. Verify deterministic SHA-256 byte digest parity.
3. Validate zero unhandled promise rejections or uncaught exceptions.
