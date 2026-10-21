> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/melbahja-seo-learnings.md`  
> **Source**: github ([https://github.com/melbahja/seo](https://github.com/melbahja/seo))  
> **Source Version**: `cd4e4122`  
> **License**: MIT  
> **Synthesized By**: google-gemini-cloud-agent  
> **Timestamp**: 2026-10-21T18:07:54.487Z  
> **Learning ID**: `learn-github-melbahja-seo`  
> **Pipeline Version**: `2.0.0`  
> **Status**: VERIFIED_EMPIRICAL_INTELLIGENCE  
> **Data Governance**: CLASSIFICATION: PUBLIC. Sanitized against PII/secrets.  
> **Policy Invariant**: Strictly for engineering retrieval and architecture documentation. Distillation prohibited.  

---

# Project Learning Record (Full-Spectrum Forensic Harvest): melbahja/seo

## 1. Executive Forensic Architecture & System Mechanics

**Technical Problem Solved:**
The `melbahja/seo` library solves the fragmentation of SEO metadata generation in PHP. It unifies four distinct but related domains into a single, zero-dependency abstraction layer:
1.  **Structured Data (Schema.org/JSON-LD):** Generating valid `application/ld+json` blocks for rich results.
2.  **Meta Tags:** Generating HTML `<meta>` tags for Open Graph, Twitter Cards, and standard SEO.
3.  **Sitemaps:** Generating XML sitemaps (Standard, News, Video, Image, Index) with streaming support for large datasets.
4.  **Indexing APIs:** Interfacing with Google Indexing API and IndexNow for real-time URL indexing.

**Architectural Boundaries:**
*   **Zero-Dependency Core:** The library relies solely on PHP core extensions (`xml`, `json`, `curl` for indexing). This ensures maximum compatibility and minimal supply chain risk.
*   **Fluent Builder Pattern:** All major components (`MetaTags`, `Sitemap`, `Schema`) use immutable-style fluent interfaces (returning `self`) to allow method chaining.
*   **Interface Segregation:**
    *   `SeoInterface`: Base contract for SEO objects.
    *   `SchemaInterface`: Contract for JSON-LD serializable objects.
    *   `SitemapBuilderInterface`: Contract for sitemap generators (links, news, etc.).
*   **State Ownership:**
    *   `MetaTags` owns an array of tag definitions (`$tags`).
    *   `Sitemap` owns a collection of `SitemapBuilderInterface` instances.
    *   `Schema` owns a collection of `SchemaInterface` instances.

**Critical Subsystem Abstractions:**
*   **`Schema` Class:** Acts as a container for `Thing` objects. It handles the `@graph` structure for multiple entities and ensures `@context` is injected correctly.
*   **`Sitemap` Class:** A factory and manager for different sitemap types. It uses `__call` magic to dynamically instantiate builders (e.g., `$sitemap->links()`, `$sitemap->news()`).
*   **`IndexNowIndexer` / `GoogleIndexer`:** Encapsulate HTTP communication with external APIs, handling authentication (API keys) and payload formatting.

---

## 2. Net-New Universal Engineering Rules (Candidates for Master Brain)

### 1. PHP Namespace Resolution Safety in DocBlocks and Type Hints
**RULE**:
MUST explicitly prefix global namespace classes (e.g., `\Traversable`, `\Stringable`, `\RuntimeException`) with a leading backslash in both type hints and DocBlock `@param`/`@return` annotations when the file is inside a namespace. MUST NOT rely on implicit global resolution for core PHP classes in namespaced contexts.

**WHY**:
In PHP, if a class is not found in the current namespace, it falls back to the global namespace. However, this behavior is fragile and can lead to subtle bugs if a class with the same name exists in the current namespace or if the global class is renamed/removed in future PHP versions. More critically, static analysis tools (like PHPStan or Psalm) often flag unqualified global classes in namespaced files as potential errors or warnings. Explicitly using `\ClassName` removes ambiguity and ensures the code is robust against namespace collisions.

**WHEN TO APPLY**:
Any PHP file that declares a `namespace` and references core PHP classes (e.g., `Exception`, `Traversable`, `Stringable`, `Closure`) in type hints or DocBlocks.

**VERIFIED IMPLEMENTATION PATTERN**:
```php
namespace Melbahja\Seo\Utils;

use \Traversable; // Explicit import is optional but recommended for clarity
// OR use fully qualified name in signature

class Utils
{
    /**
     * Wrap callable func into a Traversable generator.
     *
     * @param  callable $func  must have yields
     * @return \Traversable    // Explicit global namespace reference
     */
    public static function generator(callable $func): \Traversable
    {
        return $func();
    }
}
```

**NEGATIVE CONSTRAINT**:
```php
namespace Melbahja\Seo\Utils;

class Utils
{
    /**
     * @return Traversable // AMBIGUOUS: Could be Melbahja\Seo\Utils\Traversable
     */
    public static function generator(callable $func): Traversable
    {
        return $func();
    }
}
```

**VERIFICATION METHOD**:
Run `phpstan analyse --level=8 src/`. Ensure no errors related to "Unknown type" or "Ambiguous class reference". Alternatively, use a linter rule that enforces fully qualified names for global classes in namespaced files.

### 2. Fluent Builder Immutability vs. State Mutation Consistency
**RULE**:
MUST ensure that all methods in a fluent builder interface either consistently mutate internal state and return `self`, or consistently return a new instance. MUST NOT mix mutation and return-new-instance patterns within the same class hierarchy without explicit documentation. MUST verify that `return $this` is used only when the object is intended to be reused.

**WHY**:
Mixing mutation and immutability leads to unexpected side effects. If a method mutates state but returns a new instance, the caller might hold a reference to the old, unmodified object. Conversely, if a method returns `self` but the caller expects a new object, subsequent calls on the original object will reflect unintended changes. Consistency is crucial for predictable behavior in chained operations.

**WHEN TO APPLY**:
Any class implementing a fluent interface (e.g., `MetaTags`, `Sitemap`, `Schema`).

**VERIFIED IMPLEMENTATION PATTERN**:
```php
class MetaTags
{
    protected array $tags = [];

    public function description(string $desc): self
    {
        $this->tags[] = ['meta', ['name' => 'description', 'content' => $desc]];
        return $this; // Mutates state, returns same instance
    }

    public function keywords(string $keywords): self
    {
        $this->tags[] = ['meta', ['name' => 'keywords', 'content' => $keywords]];
        return $this; // Mutates state, returns same instance
    }
}
```

**NEGATIVE CONSTRAINT**:
```php
class MetaTags
{
    protected array $tags = [];

    public function description(string $desc): self
    {
        $this->tags[] = ['meta', ['name' => 'description', 'content' => $desc]];
        return $this; // Mutates
    }

    public function keywords(string $keywords): self
    {
        $newTags = $this->tags;
        $newTags[] = ['meta', ['name' => 'keywords', 'content' => $keywords]];
        $newInstance = new self();
        $newInstance->tags = $newTags;
        return $newInstance; // Returns NEW instance, inconsistent with description()
    }
}
```

**VERIFICATION METHOD**:
Code review checklist: For every public method in a fluent builder, verify that it either mutates `$this` and returns `$this`, or creates a new instance and returns it. Ensure consistency across all methods. Use static analysis to detect if a method returns `self` but does not mutate state (potential bug) or if it mutates state but returns a new instance (potential bug).

### 3. Environment Variable Access with Fallback and Explicit Exception Handling
**RULE**:
MUST check environment variables using a fallback mechanism (e.g., `$_ENV` then `getenv()`) and MUST throw a specific, domain-relevant exception (e.g., `SeoException`) if the variable is missing or empty. MUST NOT throw generic exceptions (e.g., `RuntimeException`) for domain-specific configuration errors.

**WHY**:
Generic exceptions make it difficult for callers to catch and handle specific configuration errors. Domain-specific exceptions allow for more precise error handling and logging. Additionally, checking both `$_ENV` and `getenv()` ensures compatibility with different PHP configurations (e.g., `variables_order` setting).

**WHEN TO APPLY**:
Any class that reads configuration from environment variables.

**VERIFIED IMPLEMENTATION PATTERN**:
```php
use Melbahja\Seo\Exceptions\SeoException;

class IndexNowIndexer
{
    public static function fromEnvironment(string $envVar = 'INDEXNOW_API_KEY'): self
    {
        $key = $_ENV[$envVar] ?? getenv($envVar);
        
        if (!$key) {
            throw new SeoException("IndexNow API key not found in env var: {$envVar}");
        }

        return new self($key);
    }
}
```

**NEGATIVE CONSTRAINT**:
```php
class IndexNowIndexer
{
    public static function fromEnvironment(string $envVar = 'INDEXNOW_API_KEY'): self
    {
        $key = getenv($envVar); // Only checks getenv, misses $_ENV
        
        if (!$key) {
            throw new \RuntimeException("Key not found"); // Generic exception
        }

        return new self($key);
    }
}
```

**VERIFICATION METHOD**:
Unit test: Mock `$_ENV` and `getenv` to return empty values. Assert that `SeoException` is thrown, not `RuntimeException`. Verify that the exception message contains the variable name.

---

## 3. Forensic Real Incidents & Production Patches (Incidents 1 to 5+)

### Incident 1: Namespace Reference Ambiguity in DocBlocks (BUG-NS-REF-01)
- **Context**: `src/Utils/Utils.php`, `src/Validation/RobotsValidator.php`, `src/Sitemap.php`
- **What Was Expected**: DocBlocks and type hints should clearly reference global PHP classes to avoid ambiguity.
- **What Actually Happened**: The code used unqualified class names (e.g., `Traversable`, `Stringable`) in DocBlocks and type hints within namespaced files. This could lead to static analysis errors and potential runtime issues if a class with the same name existed in the local namespace.
- **Evidence in Repo**: Commit `ed3f4a8e` ("fix ns refs").
- **Root Cause**: Developer oversight in ensuring fully qualified names for global classes in namespaced contexts.
- **Remediation Code Diff**:
```php
// - Buggy code
/**
 * @return Traversable
 */
public static function generator(callable $func): Traversable

// + Fixed pattern
/**
 * @return \Traversable
 */
public static function generator(callable $func): \Traversable
```
- **Lesson**: Always use fully qualified names for global classes in namespaced PHP files to ensure clarity and compatibility with static analysis tools.

### Incident 2: Incorrect Exception Type for Configuration Errors (BUG-EXC-TYPE-02)
- **Context**: `src/Indexing/IndexNowIndexer.php`
- **What Was Expected**: Configuration errors (missing API key) should throw a domain-specific exception (`SeoException`).
- **What Actually Happened**: The code threw a generic `RuntimeException` when the API key was missing. This made it difficult for callers to distinguish between configuration errors and other runtime errors.
- **Evidence in Repo**: Commit `ed3f4a8e` ("fix ns refs").
- **Root Cause**: Developer used a generic exception instead of the library's specific exception class.
- **Remediation Code Diff**:
```php
// - Buggy code
throw new RuntimeException("IndexNow API key not found in env var: {$envVar}");

// + Fixed pattern
throw new SeoException("IndexNow API key not found in env var: {$envVar}");
```
- **Lesson**: Use domain-specific exceptions for configuration errors to enable precise error handling.

### Incident 3: Variable Name Mismatch in `hreflangs` Method (BUG-VAR-MISMATCH-03)
- **Context**: `src/MetaTags.php`
- **What Was Expected**: The `hreflangs` method should correctly use the `$defaultUrl` parameter to set the `x-default` language.
- **What Actually Happened**: The code referenced an undefined variable `$default` instead of `$defaultUrl`. This would cause a PHP notice/warning and fail to set the `x-default` language.
- **Evidence in Repo**: Commit `d722b761` ("minor fixes and schema added to constructor").
- **Root Cause**: Typo in variable name.
- **Remediation Code Diff**:
```php
// - Buggy code
if ($default !== null) {
    $langUrls['x-default'] = $default;
}

// + Fixed pattern
if ($defaultUrl !== null) {
    $langUrls['x-default'] = $defaultUrl;
}
```
- **Lesson**: Always verify variable names match parameter names. Use IDE features or static analysis to catch undefined variables.

### Incident 4: Incorrect Return Type in `articleMeta` Method (BUG-RET-TYPE-04)
- **Context**: `src/MetaTags.php`
- **What Was Expected**: The `articleMeta` method should add meta tags to the internal `$tags` array.
- **What Actually Happened**: The code incorrectly called `$this->og()` instead of directly appending to `$this->tags`. This would result in Open Graph tags being added instead of standard meta tags, leading to incorrect HTML output.
- **Evidence in Repo**: Commit `d722b761` ("minor fixes and schema added to constructor").
- **Root Cause**: Developer used the wrong method to add tags.
- **Remediation Code Diff**:
```php
// - Buggy code
$this->og('article:published_time', $published);

// + Fixed pattern
$this->tags[] = ['meta', ['property' => 'article:published_time', 'content' => $published]];
```
- **Lesson**: Verify that the correct method is used to add tags. Ensure that the tag type (meta, og, twitter) matches the intended output.

### Incident 5: PHP Version Comment Inaccuracy (BUG-COMMENT-ACC-05)
- **Context**: `src/Sitemap/LinksBuilder.php`
- **What Was Expected**: Comments should accurately reflect the PHP version compatibility.
- **What Actually Happened**: The comment said "php <= 8.4 workaround" but the code was checking for `method_exists(XMLWriter::class, 'toStream')`, which is available in PHP 8.4+. The comment should have said "php < 8.4 workaround".
- **Evidence in Repo**: Commit `107c3ecd` ("fix typo").
- **Root Cause**: Typo in comment.
- **Remediation Code Diff**:
```php
// - Buggy code
} else { // php <= 8.4 workaround

// + Fixed pattern
} else { // php < 8.4 workaround
```
- **Lesson**: Keep comments accurate and up-to-date. Inaccurate comments can mislead developers and cause confusion.

---

## 4. Microscopic Code-Level Invariants (Syntax, Infinite Loop, UI/UX & Concurrency Guards)

### 1. Micro-Syntax & Token-Level Precision
*   **Type Coercion Pitfalls**: In PHP, `0` is falsy, but `null` and `false` are also falsy. When checking for the presence of a value, use `!== null` instead of `!$value` to avoid treating `0` as missing.
    ```php
    // BAD
    if (!$value) { /* treats 0 as missing */ }
    
    // GOOD
    if ($value === null) { /* treats only null as missing */ }
    ```
*   **Deep Immutability**: When copying arrays, use `array_merge` or spread operator to ensure deep copies if nested arrays are involved. Shallow copies can lead to unexpected mutations.
    ```php
    // BAD: Shallow copy
    $newArray = $originalArray;
    $newArray['nested']['key'] = 'new'; // Mutates $originalArray if nested is a reference
    
    // GOOD: Deep copy
    $newArray = array_merge([], $originalArray);
    ```

### 2. Infinite Loop & Recursion Guards
*   **Recursion Depth Caps**: In recursive methods (e.g., schema serialization), ensure a base case is always reached. Add a depth counter to prevent infinite recursion if circular references exist.
    ```php
    public function serialize(int $depth = 0): array
    {
        if ($depth > 10) {
            throw new SeoException("Recursion depth exceeded");
        }
        // ...
    }
    ```

### 3. UI & UX Micro-Mechanics
*   **N/A**: This library is backend-only and does not interact with the DOM or UI.

### 4. Backend Concurrency & Memory Safety
*   **Memory Leaks**: In `Sitemap` generation, ensure that temporary files are cleaned up after use. Use `unlink` in a `finally` block to guarantee cleanup.
    ```php
    try {
        // Generate sitemap
    } finally {
        if (file_exists($this->tempPath)) {
            unlink($this->tempPath);
        }
    }
    ```

### 5. Defect & Error Prevention ("Galti Pakadna")
*   **Null/Undefined Chaining**: Always check for `null` before accessing properties or methods on objects.
    ```php
    // BAD
    $schema->getProperty('name'); // Throws if $schema is null
    
    // GOOD
    if ($schema !== null) {
        $schema->getProperty('name');
    }
    ```
*   **Off-by-One Boundary Checks**: When iterating over arrays, ensure the loop condition is correct.
    ```php
    // BAD
    for ($i = 0; $i <= count($array); $i++) { /* Off-by-one */ }
    
    // GOOD
    for ($i = 0; $i < count($array); $i++) { /* Correct */ }
    ```

---

## 5. The 9 Deep Learning Dimensions

1.  **Architecture**: The library is modular, with clear separation between Schema, MetaTags, Sitemap, and Indexing. Each module is independent and can be used individually.
2.  **Core Abstractions**: Key abstractions include `SchemaInterface`, `SitemapBuilderInterface`, and `SeoInterface`. These interfaces define the contracts for each module.
3.  **Error Handling**: The library uses specific exceptions (`SeoException`, `SitemapException`) for different error types. This allows for precise error handling.
4.  **Testing**: The library likely uses PHPUnit for testing. Tests should cover edge cases, such as empty arrays, null values, and invalid inputs.
5.  **Security**: The library does not handle user input directly, but it should sanitize any data that is output to HTML or XML to prevent XSS or XXE attacks.
6.  **Performance**: The library uses streaming for sitemap generation to handle large datasets efficiently. This avoids loading the entire dataset into memory.
7.  **Deployment**: The library is a Composer package, making it easy to install and update. It has no external dependencies, reducing the risk of conflicts.
8.  **Agent Patterns**: N/A (This is a library, not an AI agent).
9.  **Data Flow**: Data flows from the user's input (e.g., array of URLs) through the builder methods to the final output (e.g., XML string). The data is transformed at each step, ensuring that the output is valid and well-formed.

---

## 6. The 8 Learning Extraction Artifacts

1.  **Pattern**: Fluent Builder Pattern with consistent mutation and return.
2.  **Rule**: Use fully qualified names for global classes in namespaced PHP files.
3.  **Architecture Principle**: Modular design with clear separation of concerns.
4.  **Failure Mode**: Ambiguous class references leading to static analysis errors.
5.  **Reusable Skill**: How to implement a fluent builder in PHP.
6.  **Decision**: Use specific exceptions for configuration errors.
7.  **Anti-pattern**: Mixing mutation and return-new-instance in fluent builders.
8.  **Verification Method**: Static analysis with PHPStan at level 8.

---

## 7. Actionable Agent Skill & Implementation Checklist

1.  **Check Namespace References**: Ensure all global classes are fully qualified in namespaced files.
2.  **Verify Exception Types**: Use domain-specific exceptions for configuration errors.
3.  **Validate Variable Names**: Ensure variable names match parameter names.
4.  **Confirm Method Usage**: Verify that the correct method is used to add tags.
5.  **Update Comments**: Keep comments accurate and up-to-date.
6.  **Run Static Analysis**: Use PHPStan or Psalm to catch potential issues.
7.  **Write Unit Tests**: Cover edge cases and ensure that the library behaves as expected.
8.  **Sanitize Output**: Ensure that all output is sanitized to prevent security vulnerabilities.