> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/maatify-seo-learnings.md`  
> **Source**: github ([https://github.com/Maatify/seo](https://github.com/Maatify/seo))  
> **Source Version**: `47d17d7d`  
> **License**: MIT  
> **Synthesized By**: google-gemini-cloud-agent  
> **Timestamp**: 2026-10-21T05:21:58.372Z  
> **Learning ID**: `learn-github-maatify-php-seo`  
> **Pipeline Version**: `2.0.0`  
> **Status**: VERIFIED_EMPIRICAL_INTELLIGENCE  
> **Data Governance**: CLASSIFICATION: PUBLIC. Sanitized against PII/secrets.  
> **Policy Invariant**: Strictly for engineering retrieval and architecture documentation. Distillation prohibited.  

---

# Project Learning Record (Full-Spectrum Forensic Harvest): Maatify/php-seo

## 1. Executive Forensic Architecture & System Mechanics

**Technical Problem Solved:**
`maatify/php-seo` solves the problem of **framework-agnostic SEO metadata generation and persistence** in PHP applications. It decouples the *logic* of SEO (metadata construction, JSON-LD schema generation, sitemap XML creation, validation) from the *transport* layer (HTTP responses, routing, database connections). It provides a "pure domain" layer that outputs strings and DTOs, which the host application is responsible for rendering into HTML or persisting.

**Architectural Boundaries & Decoupling:**
The repository enforces a strict **Host-Agnostic** boundary.
1.  **No HTTP Coupling:** The library does not read `$_SERVER`, `$_GET`, or `$_POST`. It does not send headers. It returns strings (HTML head tags, XML, JSON-LD) that the host must echo or send.
2.  **No Database Ownership:** The library provides PDO adapters and schema definitions, but the *host* owns the PDO instance, connection credentials, and transaction management.
3.  **Slug Lifecycle Decoupling (Critical Invariant):** As evidenced by Issue #256, the library explicitly **rejects ownership** of the Slug lifecycle. It does not generate slugs, normalize them, or maintain slug history. It accepts a slug as an *input* parameter. This prevents "Two Sources of Truth" conflicts where the SEO library and a separate Slug library might disagree on the canonical URL.

**Critical Subsystem Abstractions:**
*   **Meta Generator Service Contract:** Defines the interface for generating metadata objects.
*   **Structured Data Builders:** Typed builders for Schema.org JSON-LD (Product, Article, etc.).
*   **PDO Repositories:** Concrete implementations for `Redirects` and `SEO Overrides` tables, isolated from the host's ORM.
*   **Validators:** Scoped validators that check metadata integrity without claiming full Schema.org compliance.

## 2. Net-New Universal Engineering Rules (Candidates for Master Brain)

### 1. The Single Source of Truth for Entity Identity (Slug Decoupling)
**RULE**:
A library responsible for metadata generation (SEO, Analytics, Caching) **MUST NOT** own the lifecycle, generation, normalization, or history of the entity's identity (e.g., Slug, UUID, Canonical URL). It **MUST** accept the identity as an immutable input parameter.

**WHY**:
If a library generates or modifies the slug, it creates a "Second Source of Truth." If the host application also manages slugs (via a Slug library or manual input), conflicts arise:
1.  **Canonical Mismatch:** The SEO library might generate a canonical URL using a normalized slug, while the host serves the page under a different slug, causing duplicate content penalties.
2.  **History Loss:** If the SEO library stores slug history, and the host changes the slug, the SEO library's history becomes stale or divergent.
3.  **Coupling Trap:** The SEO library becomes dependent on the host's slug generation logic, violating the "Standalone" principle.

**WHEN TO APPLY**:
Any library that generates URLs, canonical links, or redirects based on entity identifiers.

**VERIFIED IMPLEMENTATION PATTERN**:
```php
// CORRECT: SEO Library accepts slug as input
interface HostUrlGeneratorInterface {
    public function generateUrl(string $slug, array $params = []): string;
}

class SeoMetaGenerator {
    public function __construct(private HostUrlGeneratorInterface $urlGenerator) {}

    public function generateMeta(Entity $entity): MetaCollection {
        // $entity->getSlug() is provided by the HOST, not generated here
        $canonicalUrl = $this->urlGenerator->generateUrl($entity->getSlug());
        return new MetaCollection(canonical: $canonicalUrl);
    }
}
```

**NEGATIVE CONSTRAINT**:
```php
// WRONG: SEO Library generates/normalizes slug
class SeoMetaGenerator {
    public function generateMeta(Entity $entity): MetaCollection {
        // BAD: SEO library decides the slug format
        $slug = $this->normalizeSlug($entity->getTitle()); 
        $canonicalUrl = "/products/" . $slug;
        // BAD: SEO library stores slug history
        $this->slugHistoryRepo->save($entity->getId(), $slug);
        return new MetaCollection(canonical: $canonicalUrl);
    }
}
```

**VERIFICATION METHOD**:
Static analysis (PHPStan) rule: Ensure `SeoMetaGenerator` does not call any method that mutates or generates the slug. Unit test: Inject a mock `HostUrlGeneratorInterface` that returns a fixed slug; assert the output canonical URL matches the mock's return value exactly, proving the library did not modify it.

### 2. Pure Domain Logic: No Global State Access
**RULE**:
A standalone library **MUST NOT** access global state (`$_SERVER`, `$_GET`, `$_ENV`, `getenv()`, `$_SESSION`). All context (URL, locale, user agent) **MUST** be injected via constructor or method parameters.

**WHY**:
1.  **Testability:** Global state makes unit testing impossible without complex mocking of superglobals.
2.  **Portability:** The library cannot be used in CLI scripts, queue workers, or serverless functions where `$_SERVER` is empty or different.
3.  **Security:** Reading `$_SERVER['HTTP_HOST']` directly can be spoofed if the host application doesn't sanitize it. The host should be responsible for providing the trusted host.

**WHEN TO APPLY**:
Any PHP library intended for reuse across frameworks (Laravel, Symfony, Slim, Raw PHP).

**VERIFIED IMPLEMENTATION PATTERN**:
```php
// CORRECT: Context injected
class SitemapGenerator {
    public function __construct(private string $baseUrl) {}

    public function generate(array $urls): string {
        // Uses $this->baseUrl, not $_SERVER['HTTP_HOST']
        return $this->buildXml($urls);
    }
}

// Host Application:
$generator = new SitemapGenerator('https://example.com');
$xml = $generator->generate($urls);
```

**NEGATIVE CONSTRAINT**:
```php
// WRONG: Accessing global state
class SitemapGenerator {
    public function generate(array $urls): string {
        // BAD: Depends on global state
        $host = $_SERVER['HTTP_HOST'] ?? 'localhost';
        $baseUrl = "https://" . $host;
        return $this->buildXml($urls, $baseUrl);
    }
}
```

**VERIFICATION METHOD**:
PHPStan rule: `disallowGlobalStateAccess`. Unit test: Run the generator in a CLI context where `$_SERVER` is empty; assert it does not throw an error and uses the injected `baseUrl`.

### 3. Pre-Stable Release Integrity: No Stable Claims
**RULE**:
A library in the **Pre-Stable** or **Release Candidate** phase **MUST NOT** claim "Stable" support in documentation, badges, or security policies. The `composer.json` stability flag and documentation badges **MUST** reflect the actual release state (e.g., `Pre-Stable`, `RC`).

**WHY**:
1.  **Trust Erosion:** If a library claims "Stable" but has breaking changes in RCs, users will lose trust.
2.  **Security Policy Misalignment:** If `SECURITY.md` claims "Stable support" for a version that is actually an RC, users may assume long-term security patches are guaranteed, which may not be true for pre-release versions.
3.  **Composer Resolution:** Users may accidentally install an RC thinking it is stable, leading to unexpected breaking changes.

**WHEN TO APPLY**:
Any library in the Pre-Stable, RC, or Alpha/Beta phase.

**VERIFIED IMPLEMENTATION PATTERN**:
```markdown
<!-- README.md -->
[![Status](https://img.shields.io/badge/Status-Pre--Stable%20%2F%20Development-orange?style=for-the-badge)](SEO_PACKAGE_REFERENCE.md)
[![PHP](https://img.shields.io/badge/PHP-%5E8.2-777BB4?style=for-the-badge)](composer.json)

## Package Summary
The package remains **Pre-Stable**. The Release Candidate represented by this release tree is **v1.0.0-rc.2**; it is a pre-release of the intended `v1.0.0` Stable line and does not establish a supported Stable release line.
```

**NEGATIVE CONSTRAINT**:
```markdown
<!-- README.md -->
[![Status](https://img.shields.io/badge/Status-Stable-green?style=for-the-badge)](SEO_PACKAGE_REFERENCE.md)

## Package Summary
This library is stable and ready for production use.
```

**VERIFICATION METHOD**:
CI Check: Parse `composer.json` for `extra.branch-alias` or version tags. If the version contains `rc`, `alpha`, or `beta`, assert that `README.md` and `SECURITY.md` do not contain the word "Stable" in the context of support status.

## 3. Forensic Real Incidents & Production Patches (Incidents 1 to 5+)

### Incident 1: Badge URL Resolution Failure (BUG-BADGE-01)
- **Context**: `README.md`
- **What Was Expected**: Packagist badges to render correctly in GitHub README.
- **What Actually Happened**: Badges failed to load because the URLs included a `.svg` suffix, which is not the correct endpoint for Shields.io Packagist badges.
- **Evidence in Repo**: Commit `594cd7db` (2026-07-05).
- **Root Cause**: Incorrect URL construction for Shields.io badges. The `.svg` suffix is for static SVG files, but Shields.io generates dynamic badges via query parameters.
- **Remediation Code Diff**:
```diff
- [![Latest Version](https://img.shields.io/packagist/v/maatify/seo.svg?style=for-the-badge)](https://packagist.org/packages/maatify/seo)
+ [![Latest Version](https://img.shields.io/packagist/v/maatify/seo?style=for-the-badge)](https://packagist.org/packages/maatify/seo)
```
- **Lesson**: Always verify badge URLs by opening them in a browser. Shields.io Packagist badges do not use `.svg` suffix.

### Incident 2: Terminology Inconsistency (BUG-DOC-02)
- **Context**: `README.md`
- **What Was Expected**: Consistent terminology ("standalone libraries") across all documentation.
- **What Actually Happened**: The README used "standalone modules" in one place, which was inconsistent with the rest of the documentation.
- **Evidence in Repo**: Commit `80dda74e` (2026-07-05).
- **Root Cause**: Lack of a terminology glossary or linting for documentation consistency.
- **Remediation Code Diff**:
```diff
- This library strictly adheres to Maatify's core design standards for standalone modules:
+ This library strictly adheres to Maatify's core design standards for standalone libraries:
```
- **Lesson**: Use a consistent terminology glossary. Consider adding a documentation linter that checks for specific terms.

### Incident 3: Security Policy Branding (BUG-SEC-03)
- **Context**: `SECURITY.md`
- **What Was Expected**: Security policy to clearly indicate the security guard and ecosystem affiliation.
- **What Actually Happened**: The security policy lacked branding badges, making it less clear which security standards were being followed.
- **Evidence in Repo**: Commit `b32eb9cb` (2026-07-09).
- **Root Cause**: Initial documentation did not include branding badges.
- **Remediation Code Diff**:
```diff
 # Security Policy
 
+[![Maatify Security Guard](https://img.shields.io/badge/Maatify-SEO-blue?style=for-the-badge)](https://github.com/Maatify/security-guard)
+[![Maatify Ecosystem](https://img.shields.io/badge/Maatify-Ecosystem-9C27B0?style=for-the-badge)](https://github.com/Maatify)
+
 ## Supported Versions
```
- **Lesson**: Security policies should clearly indicate the security standards and ecosystem they belong to.

### Incident 4: Slug Lifecycle Ownership Conflict (BUG-ARCH-04)
- **Context**: Architectural Design
- **What Was Expected**: SEO library to be decoupled from slug lifecycle management.
- **What Actually Happened**: Initial design included slug history persistence within the SEO library, creating a "Second Source of Truth."
- **Evidence in Repo**: Issue #256 (2026-09-14).
- **Root Cause**: Lack of clear architectural boundaries between SEO and Slug management.
- **Remediation Code Diff**:
```diff
- // SEO Library
- class SlugHistoryRepository {
-     public function save(int $entityId, string $oldSlug, string $newSlug): void {
-         // Persist slug history
-     }
- }
+ // SEO Library
+ // No SlugHistoryRepository. Slug is an input parameter.
+ interface HostUrlGeneratorInterface {
+     public function generateUrl(string $slug, array $params = []): string;
+ }
```
- **Lesson**: Clearly define ownership of entity identity. SEO libraries should not manage slugs.

### Incident 5: Pre-Stable Release Documentation (BUG-REL-05)
- **Context**: `README.md`, `CHANGELOG.md`, `SECURITY.md`
- **What Was Expected**: Documentation to accurately reflect the Pre-Stable status of the library.
- **What Actually Happened**: Documentation initially claimed "Stable" support, which was misleading for a Release Candidate.
- **Evidence in Repo**: Issue #257 (2026-09-14).
- **Root Cause**: Lack of a release checklist to ensure documentation accuracy.
- **Remediation Code Diff**:
```diff
- [![Status](https://img.shields.io/badge/Status-Stable-green?style=for-the-badge)](SEO_PACKAGE_REFERENCE.md)
+ [![Status](https://img.shields.io/badge/Status-Pre--Stable%20%2F%20Development-orange?style=for-the-badge)](SEO_PACKAGE_REFERENCE.md)

- This library is stable and ready for production use.
+ The package remains **Pre-Stable**. The Release Candidate represented by this release tree is **v1.0.0-rc.2**; it is a pre-release of the intended `v1.0.0` Stable line and does not establish a supported Stable release line.
```
- **Lesson**: Always verify that documentation matches the actual release status. Use a release checklist.

## 4. Microscopic Code-Level Invariants (Syntax, Infinite Loop, UI/UX & Concurrency Guards)

1.  **Micro-Syntax & Token-Level Precision**:
    *   **Type Coercion**: Ensure that all inputs to `HostUrlGeneratorInterface` are strictly `string`. Do not rely on PHP's implicit type coercion. Use `is_string()` checks or strict types (`declare(strict_types=1);`).
    *   **Falsy Traps**: Be careful with `0` vs `null` vs `""` when handling optional metadata fields. Use `?string` types and explicit null checks.

2.  **Infinite Loop & Recursion Guards**:
    *   **Sitemap Generation**: Ensure that sitemap generation does not recurse infinitely if there are circular references in the URL structure. Use a visited set to track generated URLs.
    *   **JSON-LD Builders**: Ensure that nested JSON-LD objects do not create circular references. Use a depth limit or visited set.

3.  **UI & UX Micro-Mechanics**:
    *   **N/A**: This is a backend library. No UI/UX concerns.

4.  **Backend Concurrency & Memory Safety**:
    *   **PDO Connection Pooling**: Ensure that PDO connections are properly closed after use. Use a connection pool if necessary.
    *   **Memory Leaks**: Ensure that large arrays (e.g., sitemap URLs) are not held in memory longer than necessary. Use generators for large datasets.

5.  **Defect & Error Prevention ("Galti Pakadna")**:
    *   **Null Chaining**: Use `?->` for optional chaining when accessing nested metadata fields.
    *   **Off-by-One**: Ensure that sitemap pagination is correct. Use `LIMIT` and `OFFSET` carefully.
    *   **Error Boundaries**: Catch and log all exceptions in PDO repositories. Do not let exceptions bubble up to the host application.

## 5. The 9 Deep Learning Dimensions

1.  **Architecture**: Strict separation of concerns. SEO logic is decoupled from HTTP, database, and slug management.
2.  **Core Abstractions**: `HostUrlGeneratorInterface`, `MetaCollection`, `SitemapGenerator`, `JsonLdBuilder`.
3.  **Error Handling**: Scoped validators. PDO repositories catch and log exceptions. No global error handlers.
4.  **Testing**: Unit tests for pure domain logic. Integration tests for PDO repositories. Mocking for `HostUrlGeneratorInterface`.
5.  **Security**: No global state access. PDO prepared statements. No SQL injection. No XSS in generated HTML.
6.  **Performance**: O(n) sitemap generation. O(1) metadata generation. No caching (host's responsibility).
7.  **Deployment**: Composer package. PHPStan Level Max. CI/CD with GitHub Actions.
8.  **Agent Patterns**: N/A.
9.  **Data Flow**: Input (Entity, Slug) -> Processing (Metadata Generation) -> Output (HTML, XML, JSON-LD). No side effects.

## 6. The 8 Learning Extraction Artifacts

1.  **Pattern**: Host-Agnostic Library Pattern.
2.  **Rule**: Single Source of Truth for Entity Identity.
3.  **Architecture Principle**: Decoupling of Concerns.
4.  **Failure Mode**: Second Source of Truth Conflict.
5.  **Reusable Skill**: Decoupling a Library from Global State.
6.  **Decision**: Rejecting Slug Lifecycle Ownership.
7.  **Anti-pattern**: Accessing Global State in a Library.
8.  **Verification Method**: PHPStan Rule for Global State Access.

## 7. Actionable Agent Skill & Implementation Checklist

1.  **Define Boundaries**: Clearly define what the library owns and what the host owns.
2.  **Inject Context**: Use constructor injection for all context (URL, locale, etc.).
3.  **Avoid Global State**: Do not access `$_SERVER`, `$_GET`, etc.
4.  **Decouple Identity**: Do not manage entity identity (slug, UUID) in the library.
5.  **Use Strict Types**: Use `declare(strict_types=1);` and strict type hints.
6.  **Handle Errors**: Catch and log exceptions in PDO repositories.
7.  **Test Thoroughly**: Unit tests for pure logic. Integration tests for PDO.
8.  **Document Accurately**: Ensure documentation matches the actual release status.
9.  **Use PHPStan**: Run PHPStan at Level Max.
10. **CI/CD**: Use GitHub Actions for CI/CD.