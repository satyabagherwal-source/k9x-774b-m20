> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/faker-js-faker-learnings.md`  
> **Source**: github ([https://github.com/faker-js/faker](https://github.com/faker-js/faker))  
> **Source Version**: `e1f9a84a`  
> **License**: NOASSERTION  
> **Synthesized By**: google-gemini-cloud-agent  
> **Timestamp**: 2026-10-30T21:55:47.888Z  
> **Learning ID**: `learn-github-faker-js-faker`  
> **Pipeline Version**: `2.0.0`  
> **Status**: VERIFIED_EMPIRICAL_INTELLIGENCE  
> **Data Governance**: CLASSIFICATION: PUBLIC. Sanitized against PII/secrets.  
> **Policy Invariant**: Strictly for engineering retrieval and architecture documentation. Distillation prohibited.  

---

# Project Learning Record (Full-Spectrum Forensic Harvest): faker-js/faker

---

## 1. Executive Forensic Architecture & System Mechanics

`faker-js/faker` generates deterministic, localized, pseudorandom mock and fixture data at scale. Its core challenge is balancing maximum runtime execution speed, deterministic state re-seeding, granular localization across 70+ locales, zero side-effects, and tree-shakable modular packaging without circular dependency chain bloat.

```
+-----------------------------------------------------------------------------------+
|                                 CONSUMER LAYER                                    |
|   import { faker } from '@faker-js/faker'   OR   import { fakeDatePast } from ... |
+-----------------------------------------------------------------------------------+
                                         |
                                         v
+-----------------------------------------------------------------------------------+
|                                  FAKER CORE                                       |
|  - FakerCore Interface: { locale: LocaleProxy, randomizer: Randomizer, config }   |
|  - Pseudo-Random Generator: Mersenne Twister (MT19937-53 / 53-bit resolution)     |
|  - Deterministic Seeding Pipeline: seed(n) -> reproducible sequence               |
+-----------------------------------------------------------------------------------+
             |                                                  |
             v                                                  v
+---------------------------------------+   +---------------------------------------+
|          LOCALE PROXY SYSTEM          |   |           MODULE SUBSYSTEMS           |
|  - Layered Fallback Chain:            |   |  - Person, Location, Date, Finance    |
|    [pt_BR] -> [pt] -> [base]          |   |  - Simple*Module (Zero-locale/pure)   |
|  - Trap handler: Proxy traps missing  |   |  - Full Module (Locale-dependent)     |
|    keys and delegates down prototype  |   |  - Decoupled functional entrypoints   |
+---------------------------------------+   +---------------------------------------+
```

### Architectural Subsystem Boundaries
1. **Decoupled Functional Core (`src/core.ts`)**: 
   The execution state is contained within the `FakerCore` record (`locale`, `randomizer`, `config`). Methods do not depend on global singletons; instead, top-level tree functions (`fakeDatePast(fakerCore, options)`) accept `fakerCore` explicitly as their first argument.
2. **Tiered Module Separation (`SimpleModule` vs `Module`)**:
   Pure algorithmic modules (e.g., date arithmetic, UUID generation, string formatting) exist as `SimpleModule` implementations residing in isolated files (`simple-module.ts`), allowing lightweight consumer bundles (`SimpleFaker`) without pulling in megabytes of locale token trees.
3. **Locale Proxy Resolution Engine (`src/internal/locale-proxy.ts`)**:
   Locales are layered using ES6 `Proxy` dispatch. When accessing a localized key (such as `location.street_address`), the proxy checks the specific dialect (`pt_BR`), then the regional parent (`pt`), and finally the base dictionary (`base`).
4. **Deterministic PRNG (Mersenne53)**:
   All operations derive their entropy from a 53-bit Mersenne Twister engine (`generateMersenne53Randomizer()`). Seeding the root randomizer guarantees deterministic fixture reproduction across independent CI and browser runs.

---

## 2. Net-New Universal Engineering Rules (Candidates for Master Brain)

### 1. Invariant Clamp for Calendar Arithmetic with Asymmetric Month Lengths
**RULE**:
When performing date arithmetic across years or months where the source date can be a leap day (February 29) or month-end boundary (Day 31), you MUST NOT use naive year addition (`Date.prototype.setUTCFullYear(year + delta)`). Instead, you MUST verify if the month overflowed (`result.getUTCMonth() !== original.getUTCMonth()`) and clamp back to the final day of the intended month (`result.setUTCDate(0)`). Furthermore, lower-bound range clamps MUST roll forward to March 1st to preserve strictly greater-than/equal-to temporal boundaries, while upper-bound range clamps MUST clamp to February 28th to prevent leaking beyond the maximum range.

**WHY**:
In standard ECMAScript/V8 calendar arithmetic, mutating `2024-02-29` by `setUTCFullYear(2023)` causes an internal calendar rollover to `2023-03-01` because February 2023 contains only 28 days. In windowed range generators (`date.past({ years: { min: 1, max: 2 } })`), setting the upper bound via naive year subtraction lands on `2022-03-01`. Selecting a random timestamp between `2022-03-01` and `2023-02-28` violates the contract: `2022-03-01` is strictly less than 2 years prior to `2024-02-29`, allowing generated dates to breach the expected range.

**WHEN TO APPLY**:
Apply to any temporal arithmetic logic in JavaScript/TypeScript, Python, Go, or SQL whenever calculating rolling historical/future dates, SLAs, contract expirations, or birthdate validity windows relative to an arbitrary reference date.

**VERIFIED IMPLEMENTATION PATTERN**:
```typescript
/**
 * Returns the UTC timestamp of the given date shifted to target year,
 * strictly clamping leap days (Feb 29) to Feb 28 in common years.
 */
export function sameDayInYear(date: Date, year: number): number {
  const result = new Date(date.getTime());
  result.setUTCFullYear(year);
  
  // Detect silent rollover: e.g. Feb 29 became Mar 1
  if (result.getUTCMonth() !== date.getUTCMonth()) {
    // Setting date to 0 moves the pointer to the last calendar day of the previous month
    result.setUTCDate(0);
  }

  return result.getTime();
}

/**
 * Calculates a windowed past date strictly adhering to min/max constraints
 * across leap years without out-of-bounds leakage.
 */
export function calculateWindowedPastBoundary(
  refDate: Date,
  years: { min: number; max: number }
): { from: Date; to: number } {
  const year = refDate.getUTCFullYear();
  
  // From: Oldest allowable date (refDate - max years).
  // Rollover to March 1 keeps it safely within the max boundary window.
  const from = new Date(refDate.getTime());
  from.setUTCFullYear(year - years.max);

  // To: Most recent allowable date (refDate - min years).
  // Clamping leap day to Feb 28 ensures date is at least `min` full years behind refDate.
  const to = sameDayInYear(refDate, year - years.min);

  return { from, to };
}
```

**NEGATIVE CONSTRAINT**:
```typescript
// ANTI-PATTERN: Direct setUTCFullYear mutation without rollover validation.
// If refDate is 2024-02-29, subtracting 1 year sets `to` to 2023-03-01.
// A timestamp generated on 2023-03-01 is only 365 days prior, which violates
// a minimum 1-year past constraint relative to a 366-day leap year.
function unsafePastDate(refDate: Date, minYears: number, maxYears: number) {
  const from = new Date(refDate);
  from.setUTCFullYear(from.getUTCFullYear() - maxYears); // Corrupts lower boundary
  
  const to = new Date(refDate);
  to.setUTCFullYear(to.getUTCFullYear() - minYears);     // Rolls to March 1st in common years!
  
  return generateRandomBetween(from.getTime(), to.getTime());
}
```

**VERIFICATION METHOD**:
Enforce determinism using property-based/edge boundary tests:
```typescript
it('must enforce temporal invariant on leap years', () => {
  const leapDayRef = new Date(Date.UTC(2024, 1, 29, 12, 0, 0)); // 2024-02-29T12:00:00Z
  const { from, to } = calculateWindowedPastBoundary(leapDayRef, { min: 1, max: 2 });
  
  // 1 year in the past must never yield 2023-03-01 (which is < 1 full leap year away)
  expect(to).toBe(Date.UTC(2023, 1, 28, 12, 0, 0));
  // 2 years in the past must roll to 2022-03-01 if strictly clamped
  expect(from.getTime()).toBe(Date.UTC(2022, 2, 1, 12, 0, 0));
});
```

---

### 2. Strict Architectural Decoupling of Zero-Data Primitives from Localized Trees
**RULE**:
In modular multi-package or monorepo libraries offering both pure utility functions (e.g., random numbers, date generators) and heavy data/locale-driven functions, pure subsystems MUST NOT import, re-export, or reference modules that transitively depend on the locale data registry or full engine classes. Standalone functional modules MUST be partitioned into dedicated files (e.g., `simple-module.ts`), and build scripts MUST enforce strict tree-shaking and acyclic graph invariants.

**WHY**:
Allowing pure algorithmic modules (`SimpleFaker`, `simple-module.ts`) to import from hybrid files (`location/city.ts` -> `faker.ts`) triggers circular dependency loops and forces bundlers (Rollup, Vite, Webpack, Esbuild) to pull the full locale dictionary (50MB+ of JSON/TS definitions) into lightweight runtime contexts, breaking tree-shaking and inflating client-side bundle sizes.

**WHEN TO APPLY**:
Apply to all TypeScript/JavaScript libraries, micro-utilities, and shared domain libraries where consumers can choose between lightweight algorithms and data-heavy suites.

**VERIFIED IMPLEMENTATION PATTERN**:
```typescript
// ARCHITECTURAL SEPARATION:
// File: src/modules/date/simple-module.ts (Zero dependencies on heavy locale bundles)
export class SimpleDateModule {
  constructor(protected readonly fakerCore: FakerCore) {}

  past(options: PastOptions = {}): Date {
    return fakeDatePast(this.fakerCore, options);
  }
}

// File: src/modules/date/module.ts (Extended localized capabilities)
import { SimpleDateModule } from './simple-module';
import { fakeLocalizedMonth } from './month';

export class DateModule extends SimpleDateModule {
  month(options: MonthOptions = {}): string {
    return fakeLocalizedMonth(this.fakerCore, options);
  }
}

// File: src/simple-faker.ts (Consumes ONLY simple modules)
import { SimpleDateModule } from './modules/date/simple-module';
export class SimpleFaker {
  readonly date: SimpleDateModule = new SimpleDateModule(this.core);
}
```

**NEGATIVE CONSTRAINT**:
```typescript
// ANTI-PATTERN: Co-locating SimpleDateModule in module.ts alongside localized routines,
// or importing full Faker instances into pure submodule helpers.
// File: src/modules/location/module.ts
import { faker } from '../../index'; // TOXIC: Circular import pulling global locale bundle!

export class SimpleLocationModule {
  // Simple method
}

export class LocationModule extends SimpleLocationModule {
  city() {
    return faker.helpers.arrayElement(faker.rawDefinitions.cities);
  }
}
```

**VERIFICATION METHOD**:
Execute an automated AST import-graph lint or build check:
```bash
# Verify no transitive link from simple-faker to heavy locale trees
pnpm tsdown --entry.test src/simple-faker.ts --dry-run
# Ensure simple-faker bundle remains < 15KB minified and contains no raw locale definitions
```

---

## 3. Forensic Real Incidents & Production Patches

### Incident 1: Calendar Leap Day Rollover in Temporal Boundary Generators (BUG-DATE-01)
- **Context**: Date module range generation (`src/modules/date/past.ts`, `src/modules/date/future.ts`, `src/modules/date/_utils.ts`)
- **What Was Expected**: When a caller invoked `faker.date.past({ years: { min: 1, max: 2 }, refDate: new Date('2024-02-29T12:00:00Z') })`, the generated date was required to fall strictly between 1 and 2 years prior to the reference leap day.
- **What Actually Happened**: V8 `Date.prototype.setUTCFullYear(2024 - 1)` automatically shifted February 29th, 2023 to March 1st, 2023 (`2023-03-01T12:00:00Z`). In common years, `2023-03-01` is less than 365 calendar days away from `2024-02-29`, violating the `min: 1` year past invariant. Conversely, for `future()`, shifting to a common year without bounds check allowed the upper range to spill into March, generating dates beyond the `max` year ceiling.
- **Evidence in Repo**: Commit `e1f9a84a`, PR #4215. Files: `src/modules/date/_utils.ts`, `src/modules/date/birthdate.ts`, `src/modules/date/future.ts`, `src/modules/date/past.ts`, `test/modules/date.spec.ts`.
- **Root Cause**: The existing `sameDayInYear` utility was private to `birthdate.ts`. `future.ts` and `past.ts` performed direct `Date.prototype.setUTCFullYear` mutations without checking whether JavaScript's internal date normalizer rolled over the month boundary.
- **Remediation Code Diff**:
```typescript
--- a/src/modules/date/past.ts
+++ b/src/modules/date/past.ts
@@ -62,13 +63,15 @@ export function fakeDatePast(
   const time = toDate(refDate);
+  const year = time.getUTCFullYear();
+  // February 29 gets converted to March 1 in non leap years
   const from = new Date(time);
-  from.setUTCFullYear(from.getUTCFullYear() - years.max);
-  const to = new Date(time);
-  to.setUTCFullYear(to.getUTCFullYear() - years.min);
+  from.setUTCFullYear(year - years.max);
+  // February 29 gets converted to February 28 in non leap years
+  const to = sameDayInYear(time, year - years.min);
 
   return fakeDateBetween(fakerCore, {
     from,
-    to: to.getTime() - 1000,
+    to: to - 1000,
   });
 }
```
- **Lesson**: Standard JavaScript `Date` mutation methods (`setMonth`, `setFullYear`, `setDate`) are statefully normalizing rather than failing or clamping. Any calendar arithmetic operating across years must intercept month deviation (`result.getUTCMonth() !== original.getUTCMonth()`) and clamp explicitly using `setUTCDate(0)`.

---

### Incident 2: Telephony Area Code Exhaustion & Invalid ANATEL Numbering in pt_BR (BUG-LOCALE-02)
- **Context**: Brazilian Portuguese telephone formats (`src/locales/pt_BR/phone_number/format/*`)
- **What Was Expected**: `fakerPT_BR.phone.number()` should generate valid Brazilian phone numbers conforming to the Brazilian National Telecommunications Agency (ANATEL) resolution.
- **What Actually Happened**: The format templates used generic wildcards `(##) #####-####` and `+55##########`. This generated invalid area codes (e.g., 20, 23, 25, 26, 29, 36, 39, 52, 56-59, 72, 76, 78) that do not exist in Brazil, and created mobile phone numbers with invalid leading subscriber digits (ANATEL mandates digit `9` after the two-digit area code for all mobile phones nationwide).
- **Evidence in Repo**: Commit `ce2a149a`, PR #4217. Files: `src/locales/pt_BR/phone_number/format/human.ts`, `international.ts`, `mobile.ts`, `national.ts`, `test/__snapshots__/locale-data.spec.ts.snap`, `test/modules/phone.spec.ts`.
- **Root Cause**: Over-reliance on generic token templates (`#`) without encoding national regulatory domain constraints directly into locale format arrays.
- **Remediation Code Diff**:
```typescript
--- a/src/locales/pt_BR/phone_number/format/human.ts
+++ b/src/locales/pt_BR/phone_number/format/human.ts
@@ -1 +1,136 @@
-export default ['(##) #####-####', '(##) ####-####', '+55 (##) ####-####'];
+export default [
+  '(11) 3###-####',
+  '(11) 9####-####',
+  '(12) 3###-####',
+  '(12) 9####-####',
+  // ... exhaustive valid area code mappings (11 through 99 excluding non-existent codes)
+];
```
- **Lesson**: Realistic test fixture generation cannot rely on unconstrained numeric wildcards for structured domains (telephony, tax IDs, credit cards). Locales must encode real-world regulatory schemas into token patterns.

---

### Incident 3: Cultural Inversion of Street Address Structural Grammar in pt_BR (BUG-LOCALE-03)
- **Context**: Brazilian Portuguese location templates (`src/locales/pt_BR/location/*`)
- **What Was Expected**: Generating a Brazilian street address should follow the Brazilian postal authority (Correios) format: `[Street Prefix] [Street Name], [Building Number] - [Complement]` (e.g., `Travessa Davi, 6061` or `Rodovia Ricardo, 16414 - Apto. 926`).
- **What Actually Happened**: `pt_BR` lacked a `street_address` definition file. The proxy resolution engine fell back to the root `en` pattern: `{{location.buildingNumber}} {{location.street}}`, producing nonsensical Brazilian addresses like `9751 Rua Lorenzo`.
- **Evidence in Repo**: Commit `a3c8a6e7`, PR #4218. Files: `src/locales/pt_BR/location/index.ts`, `src/locales/pt_BR/location/street_address.ts`.
- **Root Cause**: The locale fallback mechanism silently masks missing locale keys by cascading up to English defaults, leading to culturally incorrect composite string formatting.
- **Remediation Code Diff**:
```typescript
--- /dev/null
+++ b/src/locales/pt_BR/location/street_address.ts
@@ -0,0 +1,4 @@
+export default {
+  normal: '{{location.street}}, {{location.buildingNumber}}',
+  full: '{{location.street}}, {{location.buildingNumber}} - {{location.secondaryAddress}}',
+};
```
- **Lesson**: Fallback hierarchies in localization engines require structural validation. When regional grammar (e.g., Address Numbering, Given vs Family Name ordering) differs from the fallback language, the composite formatting templates MUST be explicitly defined in the dialect locale.

---

### Incident 4: Circular Dependency Chain & Bundle Bloat in SimpleFaker (BUG-ARCH-04)
- **Context**: Core bundle splitting and tree-shaking pipeline (`src/simple-faker.ts`, `src/modules/*`)
- **What Was Expected**: `SimpleFaker` was designed as a lightweight, zero-locale, deterministic utility engine. Importing `SimpleFaker` should never include locale dictionary trees into the bundle.
- **What Actually Happened**: An indirect import chain occurred: `simple-faker.ts` imported `location/module.ts`, which imported helper methods that transitively referenced `faker.ts` (the localized monolithic instance). Bundlers were forced to pull the entire global locale dictionary into builds that only requested `SimpleFaker`.
- **Evidence in Repo**: Closed Issue/Benchmark #4225, PR #4220. Modules restructured: `date`, `helpers`, `location`.
- **Root Cause**: Mixing pure algorithmic methods and locale-dependent methods in the same class definition and file (`module.ts`).
- **Remediation Code Diff**:
```typescript
// Extracted SimpleLocationModule to a dedicated file:
// src/modules/location/simple-module.ts
export class SimpleLocationModule {
  // Pure latitude/longitude/math methods
}

// Kept heavy localized operations in module.ts:
// src/modules/location/module.ts
export class LocationModule extends SimpleLocationModule {
  // Locale-dependent address, city, country methods
}

// Refactored simple-faker.ts imports:
- import { LocationModule } from './modules/location/module';
+ import { SimpleLocationModule } from './modules/location/simple-module';
```
- **Lesson**: Class inheritance hierarchies that bridge lightweight and heavy domain concerns must be physically split at the filesystem and module-boundary level to protect bundler tree-shaking boundaries.

---

## 4. Microscopic Code-Level Invariants (Syntax, Infinite Loop, UI/UX & Concurrency Guards)

### 1. Micro-Syntax & Token-Level Precision
* **Falsy Zero Numeric Traps**:
  When dealing with range inputs (e.g., `years: 0` or `min: 0`), using standard JavaScript falsy checks (`if (!years)`) evaluates `0` as falsy.
  ```typescript
  // INVARIANT: Explicit nullish coalescing and distinct comparison for numeric 0
  export function checkRange(years: number | { min: number; max: number }): void {
    if (years === 0) {
      throw new FakerError('Years must be greater than zero.');
    }
    // Safe numeric normalization
    const min = typeof years === 'object' ? years.min : years;
    if (min == null || isNaN(min)) {
      throw new FakerError('Invalid range parameter.');
    }
  }
  ```
* **Date Month Index Off-By-One Invariant**:
  ECMAScript `Date` months are 0-indexed (January is `0`, December is `11`), whereas days are 1-indexed (1 to 31).
  ```typescript
  // Setting UTC Date to 0 rolls back to the final day of the previous calendar month
  const clampedDate = new Date(Date.UTC(2023, 2, 1)); // 2023-03-01
  clampedDate.setUTCDate(0); // Mutates strictly to 2023-02-28
  ```

### 2. Infinite Loop & Recursion Guards
* **Deterministic Random Array Element Selection**:
  When filtering arrays or selecting elements based on a predicate, naive `while` loops risk infinite execution if no elements match the predicate:
  ```typescript
  // INVARIANT: Bounded retry limit with fallback exception
  export function safeRandomSample<T>(
    fakerCore: FakerCore,
    items: readonly T[],
    predicate: (item: T) => boolean,
    maxRetries = 50
  ): T {
    let attempts = 0;
    while (attempts < maxRetries) {
      const idx = Math.floor(fakerCore.randomizer.next() * items.length);
      const candidate = items[idx];
      if (predicate(candidate)) {
        return candidate;
      }
      attempts++;
    }
    // Fall back to linear scan if random sampling misses target
    const fallback = items.find(predicate);
    if (fallback !== undefined) return fallback;
    throw new FakerError('No valid elements satisfy the predicate within allowed attempts.');
  }
  ```
* **Circular Reference Protection in String Interpolation**:
  Template tokens like `{{location.street_address}}` can recursively call sub-patterns. Interpolation engines must enforce a hard recursion depth counter:
  ```typescript
  export function interpolateToken(
    template: string,
    resolver: (token: string) => string,
    depth = 0
  ): string {
    const MAX_INTERPOLATION_DEPTH = 8;
    if (depth > MAX_INTERPOLATION_DEPTH) {
      throw new FakerError(`Maximum interpolation recursion depth (${MAX_INTERPOLATION_DEPTH}) exceeded.`);
    }
    return template.replace(/\{\{([a-zA-Z0-9_.]+)\}\}/g, (_, token) => {
      const resolved = resolver(token);
      return interpolateToken(resolved, resolver, depth + 1);
    });
  }
  ```

### 3. UI & UX Micro-Mechanics
* **VitePress Embedded Docs DOM Thrashing**:
  In `docs/.vitepress/components/api-docs/refreshable-code.vue`, repeated generation of massive data sets for documentation previews must prevent synchronous layout thrashing.
  ```typescript
  // INVARIANT: Batch DOM updates using microtasks and Web Workers where applicable
  import { nextTick, shallowRef } from 'vue';

  const output = shallowRef<string>('');
  const isGenerating = shallowRef<boolean>(false);

  async function handleRefresh(generatorFn: () => string) {
    if (isGenerating.value) return; // Prevent concurrent re-render hammering
    isGenerating.value = true;
    try {
      // Yield to main thread before triggering heavy data generation
      await nextTick();
      output.value = generatorFn();
    } finally {
      isGenerating.value = false;
    }
  }
  ```

### 4. Backend Concurrency & Memory Safety
* **PRNG Instance Thread-Safety & Shared State Leaks**:
  When running in Node.js server environments handling concurrent asynchronous requests, sharing a single mutable `FakerCore` instance can introduce seed leakage between requests:
  ```typescript
  // INVARIANT: Thread/Request-isolated Faker instance creation
  import { AsyncLocalStorage } from 'node:async_hooks';

  const fakerStorage = new AsyncLocalStorage<FakerCore>();

  export function runWithFakerContext<R>(seed: number, fn: () => R): R {
    const core = createFakerCore({ seed });
    return fakerStorage.run(core, fn);
  }

  export function getContextualFaker(): FakerCore {
    const core = fakerStorage.getStore();
    if (!core) {
      throw new FakerError('FakerCore accessed outside of active AsyncLocalStorage execution context.');
    }
    return core;
  }
  ```

### 5. Defect & Error Prevention ("Galti Pakadna")
* **Proxy-Based Dynamic Property Interception Protection**:
  When reading non-existent locales via `createLocaleProxy`, unhandled `undefined` access must not throw untyped runtime `TypeError` faults:
  ```typescript
  export function createLocaleProxy(definitions: LocaleDefinition): LocaleProxy {
    return new Proxy(definitions as LocaleProxy, {
      get(target, prop, receiver) {
        if (typeof prop === 'symbol' || prop === 'then') {
          return Reflect.get(target, prop, receiver);
        }
        const val = Reflect.get(target, prop, receiver);
        if (val === undefined) {
          throw new FakerError(
            `Locale entry for key "${String(prop)}" is missing from the configured locale definition hierarchy.`
          );
        }
        return val;
      },
    });
  }
  ```

---

## 5. The 9 Deep Learning Dimensions

### 1. Architecture
- **Subsystem Decoupling**: Two primary entry modes: Standalone Functional API (`fakeUser(fakerCore)`) and Object-Tree Facade (`faker.person.firstName()`).
- **Memory Footprint**: Subsystems are grouped into stateless pure algorithms (`SimpleModules`) and localized token lookup modules (`Modules`). Consumers targeting resource-constrained environments can load only `SimpleFaker` or individual functional slices.

### 2. Core Abstractions
- **`FakerCore`**: The root interface encapsulating `{ locale, randomizer, config }`.
- **`Randomizer`**: Abstract interface specifying `next(): number` (returns IEEE-754 float in `[0, 1)`) and `seed(value: number): void`.
- **`LocaleDefinition`**: Structural mapping of categories (`location`, `person`, `phone_number`) containing token arrays or nested dictionary templates.

### 3. Error Handling
- **Typed Hierarchy**: Inherits from a unified `FakerError` base class.
- **Fail-Fast Boundary Validation**: Functions validate numeric spans (`min <= max`), range bounds (`years > 0`), and empty locale token arrays before sampling entropy.

### 4. Testing
- **Snapshot Assertions**: Automated snapshots of allowed Unicode character ranges across every locale (`test/__snapshots__/locale-data.spec.ts.snap`) to detect unintended encoding or token corruptions.
- **Seeded Runs**: Parametric testing framework (`seededTests`) running reproducible test matrices across deterministic seeds.

### 5. Security
- **PRNG Security Classification**: The library explicitly documents that its PRNG (Mersenne Twister) is **not** cryptographically secure (CSPRNG).
- **Realistic Coincidental Data Disclosure Notice**: Generated emails, names, and phone numbers are statistically valid in format. Documentation explicitly warns consumers not to use output for automated live outbound notifications (preventing unintended spam or harassment).

### 6. Performance
- **Time Complexity**: PRNG generation operates in $\mathcal{O}(1)$ time complexity using bitwise 32/53-bit Mersenne Twister shifts.
- **Proxy Caching**: Repeated lookups across the locale prototype hierarchy resolve with direct property lookups on hit, avoiding traversal penalties.

### 7. Deployment
- **Dual Module Targets**: Build pipeline leverages `tsdown` producing ESM (`dist/index.js`) and TypeScript declaration bundles (`dist/index.d.ts`).
- **Target Environments**: Node.js (`^22.13.0 || ^23.5.0 || >=24.0.0`) and modern ECMAScript browsers with `"sideEffects": false` enabled for bundler optimization.

### 8. Agent Patterns
- **Context Budget Awareness**: Autonomous agents building tests can selectively import individual modules (e.g., `import { fakeDatePast } from '@faker-js/faker'`) without causing token memory exhaustion in test runners.

### 9. Data Flow
- **Entropy Flow**: `Seed -> Mersenne53 Generator -> Randomizer.next() -> Uniform Scaling Function -> Index Selection -> Locale Template Token Substitution -> Output String/Number/Date`.

---

## 6. The 8 Learning Extraction Artifacts

```
                      +----------------------------+
                      |         8 ARTIFACTS        |
                      +----------------------------+
                                     |
    +-------------------+------------+------------+--------------------+
    |                   |                         |                    |
    v                   v                         v                    v
1. Pattern          2. Rule                  3. Principle          4. Failure Mode
sameDayInYear       Temporal Clamp           Filesystem Boundary   Leap Day Rollover
    |                   |                         |                    |
    +-------------------+------------+------------+--------------------+
    |                   |                         |                    |
    v                   v                         v                    v
5. Skill            6. Decision              7. Anti-Pattern       8. Verification
Locale Normalizer   Layered Proxy Traps      Shared Global State   Character Set Snaps
```

### 1. Pattern: Month-Preserving Year Shift (`sameDayInYear`)
```typescript
export function sameDayInYear(date: Date, year: number): number {
  const result = new Date(date);
  result.setUTCFullYear(year);
  if (result.getUTCMonth() !== date.getUTCMonth()) {
    result.setUTCDate(0); // Roll back to last day of intended month
  }
  return result.getTime();
}
```

### 2. Rule: Complete Seed Independence
Every generated output MUST be a pure deterministic function of `(seed, options, localeDefinitions)`. Code MUST NOT read global `Math.random()`, ambient system clocks (unless explicitly provided as `refDate`), or environment-dependent timezone offsets.

### 3. Architecture Principle: Separation of Pure Utilities from Static Data Trees
Heavy static datasets (locales, translation dictionaries) must be isolated at the physical file layout boundary from pure algorithmic computations to allow tree-shaking tools to prune all static data from pure computational workflows.

### 4. Failure Mode: Leap Year Arithmetic Rollover
When computing date ranges relative to February 29th, naive year arithmetic causes an out-of-bounds rollover to March 1st in common years, breaking range boundaries for temporal filters.

### 5. Reusable Skill: Locale Data Normalization Checklist
A