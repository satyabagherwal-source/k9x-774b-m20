> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/maatify-seo-learnings.md`  
> **Source**: github ([https://github.com/Maatify/seo](https://github.com/Maatify/seo))  
> **Source Version**: `47d17d7d`  
> **License**: MIT  
> **Synthesized By**: google-gemini-cloud-agent  
> **Timestamp**: 2026-10-19T16:18:27.248Z  
> **Learning ID**: `learn-github-maatify-php-seo`  
> **Pipeline Version**: `2.0.0`  
> **Status**: VERIFIED_EMPIRICAL_INTELLIGENCE  
> **Data Governance**: CLASSIFICATION: PUBLIC. Sanitized against PII/secrets.  
> **Policy Invariant**: Strictly for engineering retrieval and architecture documentation. Distillation prohibited.  

---

# Project Learning Record (Full-Spectrum Forensic Harvest): Maatify/php-seo

## 1. Executive Forensic Architecture & System Mechanics

**Technical Problem Solved:**
`maatify/php-seo` solves the problem of **framework-agnostic SEO metadata generation and validation** in PHP. It decouples the *logic* of SEO (metadata construction, JSON-LD schema generation, sitemap XML creation, hreflang mapping) from the *transport* layer (HTTP responses, routing, database connections). It provides a "pure domain" library that outputs strings and DTOs, leaving the host application responsible for rendering these outputs into HTML or XML responses.

**Architectural Boundaries & Decoupling:**
1.  **Host-Agnostic Core:** The library strictly forbids access to global state (`$_SERVER`, `$_GET`, `.env`). It relies on explicit dependency injection for all context (URLs, locales, entity data).
2.  **Slug Ownership Decoupling (WU-12):** A critical architectural invariant established in Issue #256 is that **SEO does not own the Slug lifecycle**. The library does not generate, normalize, or persist slugs. It accepts a pre-resolved slug as an input parameter. This prevents "two sources of truth" conflicts between a potential future `maatify/php-slugs` library and the SEO library.
3.  **PDO Adapter Pattern:** The library ships with concrete PDO repositories for *its own* tables (redirects, SEO overrides) but requires the host to provide the `PDO` instance. This ensures the library controls its schema integrity while the host controls connection pooling and credentials.
4.  **Pre-Stable Status:** The codebase is explicitly marked as `Pre-Stable` (v1.0.0-rc.2). It enforces strict PHPStan Level Max compliance, indicating a focus on type-safety and static analysis over runtime flexibility.

**Critical Subsystem Abstractions:**
*   **Meta Generator Service Contract:** Defines the interface for generating `<head>` content.
*   **Structured Data Builders:** Typed builders for Schema.org JSON-LD (Product, Article, etc.).
*   **Validation Engine:** Scopes validation to specific protocol boundaries (e.g., Open Graph, Twitter Card) without claiming full Schema.org compliance.
*   **Sitemap Generator:** Produces XML strings from DTOs, separating data generation from XML serialization.

## 2. Net-New Universal Engineering Rules (Candidates for Master Brain)

### 1. The Single Source of Truth for Entity Identity (Slug Decoupling)
**RULE**:
A library responsible for metadata generation (SEO, Analytics, Caching) **MUST NOT** own the lifecycle, generation, normalization, or persistence of entity identifiers (Slugs, UUIDs, SKUs). It **MUST** accept the resolved identifier as an immutable input parameter.

**WHY**:
If an SEO library generates slugs, and a separate Routing or Content library also manages slugs, you create a "Split Brain" architecture. Updates to slug normalization rules (e.g., changing from `kebab-case` to `snake_case`) will cause desynchronization between the URL in the database and the URL in the SEO metadata, leading to 404s or duplicate content penalties. By decoupling, the SEO library becomes a pure function of the *current* state, not the *history* of state changes.

**WHEN TO APPLY**:
Any library that consumes entity identifiers to generate external-facing artifacts (URLs, API endpoints, cache keys) in a multi-library ecosystem.

**VERIFIED IMPLEMENTATION PATTERN**:
```php
// CORRECT: SEO library accepts the resolved slug
interface HostUrlGeneratorInterface {
    public function generateUrl(string $slug, string $locale): string;
}

class SeoMetaGenerator {
    public function __construct(private HostUrlGeneratorInterface $urlGen) {}

    public function generateCanonical(string $slug, string $locale): string {
        // $slug is assumed to be already normalized and unique by the Host
        return $this->urlGen->generateUrl($slug, $locale);
    }
}
```

**NEGATIVE CONSTRAINT**:
```php
// WRONG: SEO library owns slug generation
class SeoMetaGenerator {
    public function generateCanonical(string $title, string $locale): string {
        $slug = $this->normalizeSlug($title); // DANGER: Duplicate logic
        $slug = $this->ensureUniqueness($slug); // DANGER: DB access inside SEO lib
        return "https://example.com/" . $slug;
    }
}
```

**VERIFICATION METHOD**:
Static analysis rule: Ensure no class within the `Maatify\Seo` namespace calls methods related to `Slug::generate`, `Slug::normalize`, or performs `INSERT/UPDATE` on a `slugs` table. The `composer.json` must not list `maatify/php-slugs` as a dependency.

### 2. Pure Domain Logic Isolation (No Global State)
**RULE**:
A standalone library **MUST NOT** read from global superglobals (`$_SERVER`, `$_GET`, `$_ENV`) or environment files (`.env`). All context **MUST** be injected via constructor or method parameters.

**WHY**:
Reading global state makes the library untestable in isolation (requires mocking globals) and tightly coupled to the execution environment (CLI vs. Web vs. Queue Worker). It violates the "Host-Agnostic" principle, making the library unusable in non-HTTP contexts (e.g., generating sitemaps in a cron job where `$_SERVER['HTTP_HOST']` might be undefined or incorrect).

**WHEN TO APPLY**:
Any library intended to be reused across different PHP runtimes (Web, CLI, Microservices) or frameworks (Laravel, Symfony, Raw PHP).

**VERIFIED IMPLEMENTATION PATTERN**:
```php
// CORRECT: Context is injected
class SitemapGenerator {
    public function __construct(private string $baseUrl) {}

    public function generate(array $urls): string {
        // Uses $this->baseUrl, not $_SERVER['HTTP_HOST']
        return $this->buildXml($urls, $this->baseUrl);
    }
}
```

**NEGATIVE CONSTRAINT**:
```php
// WRONG: Reading global state
class SitemapGenerator {
    public function generate(array $urls): string {
        $host = $_SERVER['HTTP_HOST'] ?? 'localhost'; // DANGER: Unreliable in CLI
        return $this->buildXml($urls, "https://" . $host);
    }
}
```

**VERIFICATION METHOD**:
PHPStan custom rule or grep check: Ensure no occurrence of `$_SERVER`, `$_GET`, `$_POST`, `$_ENV`, or `getenv()` within the `src/` directory of the library.

### 3. Pre-Stable API Contract Rigidity
**RULE**:
During the `Pre-Stable` / `RC` phase, **MUST** enforce maximum static analysis levels (e.g., PHPStan Level Max) and **MUST NOT** introduce breaking changes to public interfaces without a major version bump, even if the package is not yet "Stable".

**WHY**:
RC (Release Candidate) versions are intended to be drop-in replacements for the final stable version. If the API changes between RC1 and RC2, consumers who have already integrated the library will face breakage. Enforcing strict typing and static analysis during RC ensures that the API surface is stable and type-safe before the 1.0.0 tag.

**WHEN TO APPLY**:
Any library in the `0.x` to `1.0.0-rc` transition phase.

**VERIFIED IMPLEMENTATION PATTERN**:
```json
// composer.json
{
    "require-dev": {
        "phpstan/phpstan": "^1.10"
    },
    "scripts": {
        "test": "phpstan analyse --level=max"
    }
}
```

**NEGATIVE CONSTRAINT**:
```json
// WRONG: Loose typing during RC
{
    "scripts": {
        "test": "phpstan analyse --level=5" // DANGER: Hides type errors
    }
}
```

**VERIFICATION METHOD**:
CI pipeline must fail if `phpstan analyse --level=max` returns any errors. The `composer.json` must explicitly define the `test` script to run at max level.

## 3. Forensic Real Incidents & Production Patches (Incidents 1 to 5+)

### Incident 1: Badge URL Resolution Failure (BUG-BADGE-01)
- **Context**: `README.md` documentation.
- **What Was Expected**: Packagist badges to render correctly in GitHub README.
- **What Actually Happened**: Badges failed to load or showed incorrect data because the URLs included a `.svg` suffix which is deprecated/incorrect for the specific Shields.io endpoint used.
- **Evidence in Repo**: Commit `594cd7db` (2026-07-05).
- **Root Cause**: Use of outdated Shields.io URL format. The `.svg` suffix was removed from the standard Packagist badge endpoints.
- **Remediation Code Diff**:
```markdown
- [![Latest Version](https://img.shields.io/packagist/v/maatify/seo.svg?style=for-the-badge)](https://packagist.org/packages/maatify/seo)
+ [![Latest Version](https://img.shields.io/packagist/v/maatify/seo?style=for-the-badge)](https://packagist.org/packages/maatify/seo)
```
- **Lesson**: Always verify external service URL formats against current documentation. Do not assume URL patterns remain stable across service updates.

### Incident 2: Terminology Inconsistency in Public Docs (BUG-DOC-02)
- **Context**: `README.md` design principles section.
- **What Was Expected**: Consistent terminology ("standalone libraries") across all public documentation.
- **What Actually Happened**: The README used "standalone modules" in one place, conflicting with the ecosystem's standard terminology of "standalone libraries".
- **Evidence in Repo**: Commit `80dda74e` (2026-07-05).
- **Root Cause**: Manual documentation update missed a specific instance of the term. Lack of automated terminology linting.
- **Remediation Code Diff**:
```markdown
- This library strictly adheres to Maatify's core design standards for standalone modules:
+ This library strictly adheres to Maatify's core design standards for standalone libraries:
```
- **Lesson**: Maintain a glossary of terms for the ecosystem. Use automated checks (e.g., grep in CI) to ensure consistent terminology in public-facing docs.

### Incident 3: Security Policy Branding Misalignment (BUG-SEC-03)
- **Context**: `SECURITY.md`.
- **What Was Expected**: Security policy to clearly indicate the package's status within the Maatify ecosystem and its security guardrails.
- **What Actually Happened**: The security policy lacked clear branding and ecosystem linkage, potentially confusing users about the support scope.
- **Evidence in Repo**: Commit `b32eb9cb` (2026-07-09).
- **Root Cause**: Initial security policy was generic and did not reflect the specific Maatify ecosystem standards.
- **Remediation Code Diff**:
```markdown
+ [![Maatify Security Guard](https://img.shields.io/badge/Maatify-SEO-blue?style=for-the-badge)](https://github.com/Maatify/security-guard)
+ [![Maatify Ecosystem](https://img.shields.io/badge/Maatify-Ecosystem-9C27B0?style=for-the-badge)](https://github.com/Maatify)
```
- **Lesson**: Security policies should explicitly link to the organization's security standards and ecosystem to clarify support boundaries and response times.

### Incident 4: Slug Ownership Architectural Correction (BUG-ARCH-04)
- **Context**: `maatify/php-seo` core architecture.
- **What Was Expected**: SEO library to be fully decoupled from slug lifecycle management.
- **What Actually Happened**: Initial design included slug generation/normalization logic within the SEO library, creating a potential conflict with a future `maatify/php-slugs` library.
- **Evidence in Repo**: Issue #256 (WU-12).
- **Root Cause**: Over-scoping of the SEO library's responsibilities. The library was attempting to solve a problem (slug management) that belongs to a different domain (Content/URL management).
- **Remediation Code Diff**:
```php
// REMOVED from SEO library:
// class SlugGenerator { ... }
// class SlugHistoryRepository { ... }

// ADDED to SEO library:
interface HostUrlGeneratorInterface {
    public function generateUrl(string $slug, string $locale): string;
}
```
- **Lesson**: Apply the Single Responsibility Principle strictly. If a library needs to generate identifiers, it should be a separate library. The SEO library should only consume identifiers.

### Incident 5: Pre-Stable Release Documentation Drift (BUG-REL-05)
- **Context**: `README.md`, `CHANGELOG.md`, `SECURITY.md`.
- **What Was Expected**: Documentation to accurately reflect the `v1.0.0-rc.2` pre-release status.
- **What Actually Happened**: Documentation contained stale statements about the package being absent from Packagist and did not clearly distinguish between Pre-Stable and Stable support.
- **Evidence in Repo**: Issue #257.
- **Root Cause**: Manual documentation updates did not keep pace with the release process. Lack of automated documentation synchronization.
- **Remediation Code Diff**:
```markdown
- Removed: "maatify/php-seo is absent from Packagist"
+ Added: "The package remains Pre-Stable. The Release Candidate represented by this release tree is v1.0.0-rc.2"
+ Added: "External publication and installability are determined by the actual tag and Composer distribution channel."
```
- **Lesson**: Automate documentation updates during the release process. Use scripts to update version numbers and status badges in `README.md` and `CHANGELOG.md` based on the current git tag.

## 4. Microscopic Code-Level Invariants (Syntax, Infinite Loop, UI/UX & Concurrency Guards)

1.  **Micro-Syntax & Token-Level Precision**:
    *   **Type Coercion Pitfall**: In PHP, `0` is falsy, but `null` and `""` are also falsy. When checking for the presence of a slug, use `isset($slug) && $slug !== ''` instead of `if ($slug)`. This prevents empty strings from being treated as valid slugs.
    *   **Deep Immutability**: DTOs for SEO metadata (e.g., `MetaTag`, `JsonLdNode`) **MUST** be immutable. Any modification should return a new instance. This prevents accidental mutation of shared state when the same DTO is used in multiple contexts (e.g., sitemap and meta tags).

2.  **Infinite Loop & Recursion Guards**:
    *   **Sitemap Generation**: When generating sitemaps for large sites, use pagination or chunking to avoid memory exhaustion. The generator **MUST** yield results in batches (e.g., 1000 URLs per chunk) rather than loading all URLs into memory at once.
    *   **Recursion Depth**: If the SEO library supports nested entities (e.g., Product -> Variant -> Attribute), enforce a maximum recursion depth (e.g., 5 levels) to prevent stack overflow.

3.  **UI & UX Micro-Mechanics**:
    *   **N/A**: This is a backend library. However, the generated HTML **MUST** be valid and free of duplicate meta tags. Duplicate `<title>` or `<meta name="description">` tags can cause browser rendering issues and SEO penalties.

4.  **Backend Concurrency & Memory Safety**:
    *   **PDO Connection Pooling**: The library **MUST NOT** create new PDO connections. It **MUST** accept a pre-configured `PDO` instance. This ensures that connection pooling and resource management are handled by the host application.
    *   **Memory Leaks**: Avoid holding references to large arrays (e.g., all URLs for sitemap) in class properties. Use generators or iterators to process data in a streaming fashion.

5.  **Defect & Error Prevention ("Galti Pakadna")**:
    *   **Null/Undefined Chaining**: When accessing nested arrays (e.g., `$data['meta']['title']`), use null coalescing operator (`??`) to prevent `Undefined index` warnings.
    *   **Off-by-One Boundary Checks**: When generating sitemap URLs, ensure that the last URL in the list is correctly formatted and that the XML structure is properly closed.
    *   **Error Boundary Containment**: Wrap all external calls (e.g., to Search Console API) in try-catch blocks. Log errors but do not crash the application. Return a default or empty value if the external service is unavailable.

## 5. The 9 Deep Learning Dimensions

1.  **Architecture**:
    *   **Subsystem Boundaries**: Clear separation between metadata generation, validation, and persistence.
    *   **Decoupling**: Host-agnostic design, no global state, no framework dependencies.
    *   **Modular Layout**: Separate namespaces for `Meta`, `JsonLd`, `Sitemap`, `Validation`, `Persistence`.
    *   **State Ownership**: Host owns HTTP, routing, and entity data. Library owns SEO logic and its own tables.

2.  **Core Abstractions**:
    *   **Key Types**: `MetaTag`, `JsonLdNode`, `SitemapUrl`, `ValidationReport`.
    *   **Traits/Interfaces**: `HostUrlGeneratorInterface`, `SeoMetaGeneratorInterface`, `SitemapGeneratorInterface`.
    *   **Domain Primitives**: Slug, Locale, URL, Meta Name/Content.
    *   **Invariant Contracts**: Immutability of DTOs, strict typing, no global state.

3.  **Error Handling**:
    *   **Fault Boundaries**: External calls (APIs) are wrapped in try-catch.
    *   **Error Trees**: Specific exceptions for validation failures, persistence errors, and external service failures.
    *   **Retries**: No automatic retries for external calls. Host is responsible for retry logic.
    *   **Rollbacks**: PDO transactions are managed by the host. Library does not handle rollbacks.
    *   **Graceful Degradation**: If external services are unavailable, the library returns default values or empty results.

4.  **Testing**:
    *   **Property Testing**: Test that generated XML is valid and that meta tags are correctly formatted.
    *   **Mock Invariants**: Mock `HostUrlGeneratorInterface` and `PDO` to test library logic in isolation.
    *   **Integration Harnesses**: `consumer-harness/verify.php` tests the library in a real-world context.
    *   **Regression Shields**: PHPStan Level Max ensures type safety and prevents regressions.

5.  **Security**:
    *   **Threat Model**: XSS via meta tags, SQL injection via PDO, SSRF via external API calls.
    *   **Credential Boundaries**: Library does not store credentials. Host provides PDO and API keys.
    *   **Sanitization**: Meta tag content is escaped to prevent XSS.
    *   **Memory Safety**: PHP is memory-safe, but avoid large arrays to prevent OOM.
    *   **Least Privilege**: Library only accesses its own tables and external APIs.

6.  **Performance**:
    *   **Latency Profiles**: Metadata generation is O(1). Sitemap generation is O(N) where N is the number of URLs.
    *   **Asymptotic Complexity**: Avoid O(N^2) operations in validation.
    *   **Caching**: No internal caching. Host is responsible for caching.
    *   **Zero-Copy**: Use generators for large datasets.
    *   **Concurrency Bottlenecks**: PDO is not thread-safe. Host must manage connection pooling.

7.  **Deployment**:
    *   **CI/CD Invariants**: PHPStan Level Max, PHPUnit tests, and consumer harness verification.
    *   **Container Constraints**: No specific container constraints. Library is pure PHP.
    *   **Reproducible Builds**: Composer lock file ensures reproducible dependencies.
    *   **Runtime Flags**: No runtime flags. Configuration is via constructor injection.

8.  **Agent Patterns**:
    *   **Tooling Interfaces**: `HostUrlGeneratorInterface` allows agents to plug in custom URL generation logic.
    *   **Prompt Chains**: N/A.
    *   **Loop Guards**: N/A.
    *   **Context Budget Optimization**: N/A.

9.  **Data Flow**:
    *   **Mutation Lifecycles**: DTOs are immutable. Data flows from Host to Library, and Library returns strings/DTOs to Host.
    *   **Streams**: Sitemap generation uses generators to stream URLs.
    *   **Serializers**: XML and JSON-LD serializers are separate from data generation.
    *   **Network Protocol Barriers**: External API calls are isolated and wrapped in try-catch.

## 6. The 8 Learning Extraction Artifacts

1.  **Pattern**: **Host-Agnostic Dependency Injection**. Inject all context (URLs, locales, PDO) via constructor.
2.  **Rule**: **MUST NOT** read global state. **MUST** use explicit dependency injection.
3.  **Architecture Principle**: **Single Source of Truth**. Each library owns only its own domain logic. No cross-library ownership of state.
4.  **Failure Mode**: **Split Brain Architecture**. Two libraries managing the same state (e.g., slugs) leads to desynchronization.
5.  **Reusable Skill**: **Decoupling Checklist**. 1. Identify state ownership. 2. Define interfaces for external dependencies. 3. Remove global state access. 4. Test in isolation.
6.  **Decision**: **Pre-Stable Rigidity**. Enforce strict typing and static analysis during RC phase to ensure API stability.
7.  **Anti-pattern**: **Global State Access**. Reading `$_SERVER` or `$_ENV` in a library.
8.  **Verification Method**: **PHPStan Level Max**. Ensure no type errors and no global state access.

## 7. Actionable Agent Skill & Implementation Checklist

1.  **Define Domain Boundaries**:
    *   [ ] Identify what state the library owns (e.g., SEO metadata).
    *   [ ] Identify what state the host owns (e.g., URLs, slugs, entities).
    *   [ ] Define interfaces for host-provided dependencies (e.g., `HostUrlGeneratorInterface`).

2.  **Implement Pure Domain Logic**:
    *   [ ] Ensure no global state access (`$_SERVER`, `$_ENV`).
    *   [ ] Use constructor injection for all dependencies.
    *   [ ] Make DTOs immutable.

3.  **Enforce Type Safety**:
    *   [ ] Configure PHPStan to Level Max.
    *   [ ] Add type hints to all functions and properties.
    *   [ ] Use strict types (`declare(strict_types=1);`).

4.  **Handle Errors Gracefully**:
    *   [ ] Wrap external calls in try-catch.
    *   [ ] Define specific exceptions for different failure modes.
    *   [ ] Log errors but do not crash the application.

5.  **Test in Isolation**:
    *   [ ] Mock all external dependencies.
    *   [ ] Test edge cases (empty arrays, null values).
    *   [ ] Use property-based testing for generated output (e.g., valid XML).

6.  **Document Clearly**:
    *   [ ] Use consistent terminology.
    *   [ ] Clearly state the library's status (Pre-Stable, Stable).
    *   [ ] Provide examples of usage.

7.  **Automate Quality Checks**:
    *   [ ] Run PHPStan and PHPUnit in CI.
    *   [ ] Use a consumer harness to test integration.
    *   [ ] Automate documentation updates during release.