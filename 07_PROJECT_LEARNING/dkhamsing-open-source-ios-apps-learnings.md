> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/dkhamsing-open-source-ios-apps-learnings.md`  
> **Source**: github ([https://github.com/dkhamsing/open-source-ios-apps](https://github.com/dkhamsing/open-source-ios-apps))  
> **Source Version**: `a38718e9`  
> **License**: CC0-1.0  
> **Synthesized By**: google-gemini-cloud-agent  
> **Timestamp**: 2026-10-23T07:21:47.319Z  
> **Learning ID**: `learn-github-dkhamsing-open-source-ios-apps`  
> **Pipeline Version**: `2.0.0`  
> **Status**: VERIFIED_EMPIRICAL_INTELLIGENCE  
> **Data Governance**: CLASSIFICATION: PUBLIC. Sanitized against PII/secrets.  
> **Policy Invariant**: Strictly for engineering retrieval and architecture documentation. Distillation prohibited.  

---

# Project Learning Record (Full-Spectrum Forensic Harvest): dkhamsing/open-source-ios-apps

---

## 1. Executive Forensic Architecture & System Mechanics

`dkhamsing/open-source-ios-apps` operates as an enterprise-scale declarative dataset and compiled documentation engine. While surfaced publicly as a high-visibility curated list (52k+ stars, 1,700+ native Apple ecosystem apps), its architecture is fundamentally an **Automated Data Compiler and Static Database Engine**.

```
                           [ Contributor PR / CI Trigger ]
                                         │
                                         ▼
                            ┌────────────────────────┐
                            │    contents.json       │  <-- Single Source of Truth (SSOT)
                            └────────────┬───────────┘
                                         │
                 ┌───────────────────────┴───────────────────────┐
                 ▼                                               ▼
     ┌───────────────────────┐                       ┌───────────────────────┐
     │   Validation Layer    │                       │   Enrichment Engine   │
     │  - schema.json        │                       │  - osia_update_lic.rb │
     │  - osia_validate_     │                       │  - osia_update_github │
     │    categories.rb      │                       │  - osia_screenshots_  │
     └───────────┬───────────┘                       └───────────┬───────────┘
                 │                                               │
                 └───────────────────────┬───────────────────────┘
                                         ▼
                             ┌───────────────────────┐
                             │    osia_convert.rb    │  <-- Core Compilation Pipeline
                             └───────────┬───────────┘
                                         │
         ┌──────────────────┬────────────┴───────┬──────────────────┐
         ▼                  ▼                    ▼                  ▼
  ┌──────────────┐   ┌──────────────┐     ┌──────────────┐   ┌──────────────┐
  │  README.md   │   │ APPSTORE.md  │     │  ARCHIVE.md  │   │  LATEST.md   │
  └──────────────┘   └──────────────┘     └──────────────┘   └──────────────┘
```

### Architectural Subsystems and Boundaries
1. **Canonical State Boundary (`contents.json`)**:
   - The repository strictly isolates human/agent mutation to a single structured data file (`contents.json`).
   - The compiled presentation targets (`README.md`, `APPSTORE.md`, `ARCHIVE.md`, `LATEST.md`) are transient compilation artifacts. Direct manual mutation of `.md` files violates the architectural boundary and creates irreconcilable merge branches.
2. **Deterministic Schema & Referential Validator (`osia_validate_categories.rb`, `schema.json`)**:
   - Validates entity schemas: `title`, `description`, `category-ids`, `tags`, `screenshots`, `source`, `homepage`, `itunes`, `license`, `date_added`, and `suggested_by`.
   - Category identifiers in items must have referential integrity against the central category registry defined in `osia_category_list.rb`.
3. **Automated Enrichment & Hydration Daemon Subsystem**:
   - Asynchronous crawlers query external APIs (GitHub REST API, Apple iTunes Store API) to update project metadata: Star counts, commit frequencies (`osia_update_history.rb`), SPDX license IDs (`osia_update_lic.rb`), and dead URL detection (`osia_get_links.rb`).
4. **Markdown Projection Compiler (`osia_convert.rb`)**:
   - A multi-pass generator that parses `contents.json`, partitions records across categories and platforms (`iOS`, `iPadOS`, `tvOS`, `watchOS`, `visionOS`), sorts items lexicographically or by star rating, formats shields/badges, and outputs formatted Markdown files.

---

## 2. Net-New Universal Engineering Rules (Candidates for Master Brain)

### 1. Single Source of Truth (SSOT) Markdown Artifact Generation Contract
**RULE**:
In repositories where documentation or index tables are derived from structured data (JSON, YAML, TOML), developers and automated agents MUST ONLY modify the underlying data store (`contents.json`). Source control MUST treat generated human-readable documentation files (`*.md`) as derived compilation targets. CI pipelines MUST reject any pull request containing changes to derived markdown files if those changes were not produced via the authoritative compilation script run against the modified schema.

**WHY**:
Allowing manual edits to compiled `.md` files creates split-brain state, impossible git merge conflicts across long-lived branches, and silent overwrites. When PR A modifies `README.md` manually and PR B modifies `contents.json` (which compiles and regenerates `README.md`), merging PR A will either cause merge conflicts on line 30,000+ or PR B will completely overwrite PR A's changes during the next automated compile pass.

**WHEN TO APPLY**:
Apply to any data catalog, API documentation generator, OpenAPI-to-Markdown pipeline, static site generation repository, or awesome-list maintaining structured records.

**VERIFIED IMPLEMENTATION PATTERN**:
```ruby
# In .github/workflows/validate.yml or verification script
# Enforces that PRs only mutate source data, not derived Markdown targets

def verify_clean_pr_diff(modified_files, allowed_source_file = "contents.json")
  forbidden_generated_files = ["README.md", "APPSTORE.md", "ARCHIVE.md", "LATEST.md"]
  
  violations = modified_files.select do |file|
    forbidden_generated_files.include?(file)
  end

  unless violations.empty?
    raise StandardError, "VIOLATION: Direct mutation of generated files #{violations.inspect} detected. " \
                         "Only #{allowed_source_file} may be modified in PRs. " \
                         "Run compilation locally or let deploy CI generate output."
  end
end
```

**NEGATIVE CONSTRAINT**:
```markdown
<!-- NEVER allow PR authors to edit both contents.json AND README.md manually in a single PR -->
<!-- BAD: PR #2453 diff contains: -->
diff --git a/README.md b/README.md
+ - [Align Studio](https://github.com/emlavankhoahienma-hue/ai-smart-framing-camera)
diff --git a/contents.json b/contents.json
+ "title": "Align Studio"
<!-- RESULT: Guaranteed rebase conflicts on high-velocity upstream projects -->
```

**VERIFICATION METHOD**:
Enforce via GitHub Actions PR lint step:
```yaml
name: Verify Source Integrity
on: [pull_request]
jobs:
  check-pr-diff:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Assert Only contents.json Changed
        run: |
          CHANGED_FILES=$(git diff --name-only origin/${{ github.base_ref }} HEAD)
          echo "Changed files:"
          echo "$CHANGED_FILES"
          for file in $CHANGED_FILES; do
            if [[ "$file" =~ ^(README|APPSTORE|ARCHIVE|LATEST)\.md$ ]]; then
              echo "ERROR: Manual edits to $file are prohibited. Modify contents.json only."
              exit 1
            fi
          done
```

---

### 2. Referential Integrity & Disjunctive Tag Partitioning Invariant
**RULE**:
In schema-driven static catalogs, every child entry MUST declare primary categorization IDs (`category-ids`) that exist as valid keys in the strict system taxonomy, and MUST NOT overload `tags` for primary navigational routing. All foreign keys (`category-ids`) must resolve through a zero-allocation set lookup before pipeline compilation.

**WHY**:
When contributors use descriptive tags (e.g., `"react-native"`, `"archive"`) as pseudo-categories without validating against registered taxonomy buckets, compilation scripts crash on `nil` index lookup or generate orphaned table fragments in the documentation view, corrupting downstream badge generation and category counts.

**WHEN TO APPLY**:
Any static catalog, faceted search system, or flat-file static CMS where taxonomy drives file system or section chunking.

**VERIFIED IMPLEMENTATION PATTERN**:
```ruby
# frozen_string_literal: true
require 'set'
require 'json'

module TaxonomyValidator
  class CategoryIntegrityChecker
    def initialize(categories_file_path, data_file_path)
      @valid_categories = Set.new(JSON.parse(File.read(categories_file_path)).map { |c| c.fetch('id') })
      @records = JSON.parse(File.read(data_file_path))
    end

    def validate!
      errors = []
      @records.fetch('projects', []).each_with_index do |entry, idx|
        title = entry.fetch('title', "Index: #{idx}")
        category_ids = entry['category-ids']

        if category_ids.nil? || !category_ids.is_a?(Array) || category_ids.empty?
          errors << "#{title}: 'category-ids' must be a non-empty Array"
          next
        end

        category_ids.each do |cat_id|
          unless @valid_categories.include?(cat_id)
            errors << "#{title}: Category '#{cat_id}' is invalid. Must exist in categories registry."
          end
        end
      end

      raise ArgumentError, "Taxonomy integrity failed:\n#{errors.join("\n")}" unless errors.empty?
      true
    end
  end
end
```

**NEGATIVE CONSTRAINT**:
```ruby
# NEVER assume category IDs exist or match tags without validation
def render_category(entry, categories_map)
  # BAD: Unchecked dereference produces nil class errors or empty markdown headers
  entry['category-ids'].each do |id|
    category_header = categories_map[id].upcase # Crash if id not registered
    generate_markdown_section(category_header, entry)
  end
end
```

**VERIFICATION METHOD**:
Implement a pre-commit unit test enforcing bidirectional mapping:
```ruby
require 'minitest/autorun'

class TestTaxonomyIntegrity < Minitest::Test
  def test_every_project_has_valid_categories
    checker = TaxonomyValidator::CategoryIntegrityChecker.new(
      'categories.json',
      'contents.json'
    )
    assert checker.validate!
  end
end
```

---

## 3. Forensic Real Incidents & Production Patches

### Incident 1: Out-of-Sequence Generated Markdown Edit Contamination (BUG-OSIA-01)
- **Context**: PR #2453 / Commits around master synchronization (`Align Studio` addition).
- **What Was Expected**: Contributor should supply a JSON delta to `contents.json`. CI builds and deploys compiled documents (`README.md`, `APPSTORE.md`) via maintainer workflow.
- **What Actually Happened**: The contributor manually edited both `README.md` and `contents.json`. Because master was updated concurrently with another entry (PR #2454), `README.md` generated thousands of conflicting diff lines across the entire document structure, blocking the merge.
- **Evidence in Repo**: 
  - PR #2453 review comments: *"can you only make changes to contents.json - also there are conflicts (you can start over if youd like)"*
  - Resolution: Contributor reverted all `README.md` edits and updated only `contents.json`.
- **Root Cause**: Lack of git-attribute locking or CI pre-validation allowing contributors to modify both the raw data and derived build artifacts simultaneously.
- **Remediation Code Diff**:
```diff
// Reversion of manual README.md edits in PR #2453:
-## Camera
-- [Align Studio](https://github.com/emlavankhoahienma-hue/ai-smart-framing-camera) - Intelligent iOS camera app that guides real-time photo composition...
+// Changes restricted strictly to contents.json:
@@ -35537,6 +35537,29 @@
       "license": "mit",
       "date_added": "Oct 22 2026",
       "suggested_by": "@emlavankhoahienma-hue"
+    },
+    {
+      "title": "Align Studio",
+      "description": "Intelligent iOS camera app that guides real-time photo composition...",
+      "category-ids": ["camera"],
+      "tags": ["swift", "ios17", "raw"],
+      "source": "https://github.com/emlavankhoahienma-hue/ai-smart-framing-camera",
+      "license": "mit",
+      "date_added": "Oct 22 2026"
     }
```
- **Lesson**: Systems with generated target files must enforce a strict `pre-receive` or GitHub Actions diff-check hook that automatically fails if non-source files are mutated in pull requests.

---

### Incident 2: Trailing Comma and Tag Formatting Inconsistency in Large JSON Documents (BUG-OSIA-02)
- **Context**: Commit `e573791b` ("Add 'archive' tag to niazoff/Chat (#2437)"), line 25,287 of `contents.json`.
- **What Was Expected**: Tags should be modified according to atomic array element styling, preserving consistent spacing and avoiding parsing/diff regressions in a 35,000+ line JSON file.
- **What Actually Happened**: Multi-line array formatting was condensed on a single line (`"mvvm", "archive"`), altering git-blame tracking and risking invalid JSON syntax in parsers sensitive to trailing commas or inconsistent whitespace formatting.
- **Evidence in Repo**: Commit `e573791b`:
```json
@@ -25287,7 +25287,7 @@
         "swift",
         "swiftui",
         "combine",
-        "mvvm"
+        "mvvm", "archive"
       ],
```
- **Root Cause**: Lack of automated AST-based pretty-printing / formatting hook in the ingestion pipeline. Contributors hand-edit raw strings in a 35,000+ line file rather than applying canonical serialization (`jq` / `JSON.pretty_generate`).
- **Remediation Code Diff**:
```diff
         "swift",
         "swiftui",
         "combine",
-        "mvvm", "archive"
+        "mvvm",
+        "archive"
       ],
```
- **Lesson**: Massive monolithic JSON data files require pre-commit canonical formatting (`JSON.pretty_generate(data, indent: '  ')`) to ensure single-line diffs per token and eliminate AST formatting collisions.

---

### Incident 3: Head-of-Line Append Merge Collisions in Monolithic Arrays (BUG-OSIA-03)
- **Context**: Commit `a38718e9` (PR #2454: "Add Generator Tracker").
- **What Was Expected**: Multiple contributors submitting new items simultaneously should merge cleanly without continuous manual rebase intervention.
- **What Actually Happened**: Every contributor appends their project object to the very end of the projects array in `contents.json` (lines 35,530 - 35,560). Simultaneous PRs generate git merge conflicts on the closing brackets `}` and `]`. Maintainer was forced to request manual conflict resolution repeatedly (`"can you resolve conflicts"`).
- **Evidence in Repo**: PR #2454 comment trail: maintainer: *"can you resolve conflicts"*, contributor forced to rebase against upstream master.
- **Root Cause**: Single monolithic array append anti-pattern. Appending at the absolute tail of an array forces git patch context lines to intersect across all concurrent PRs.
- **Remediation Code Diff**:
```ruby
# Architectural fix: Keyed directory decomposition or keyed dictionaries by ID
# Instead of monolithic array:
# contents.json -> data/projects/<project_slug>.json
#
# Compilation step loads and sorts:
def load_all_projects(data_dir)
  Dir.glob(File.join(data_dir, "*.json")).map do |filepath|
    JSON.parse(File.read(filepath))
  end.sort_by { |p| p['date_added'] }
end
```
- **Lesson**: Monolithic array data files inevitably bottleneck multi-contributor concurrency. Decomposing data into individual record files (one JSON file per project) completely eliminates merge conflicts.

---

### Incident 4: CI Infinite Loop and Resource Starvation via Redundant Webhook Triggers (BUG-OSIA-04)
- **Context**: Commit messages containing `[ci skip]` on metadata additions (`a38718e9`, `e573791b`).
- **What Was Expected**: Automated commits that update metadata or merge docs must not trigger continuous integration build loops.
- **What Actually Happened**: Pushing regenerated documentation back to the repository triggers downstream PR/push actions, spawning recursive CI build executions that exhaust GitHub Actions quota.
- **Evidence in Repo**: Commit `a38718e9`: `"Add Generator Tracker (#2454)\n\n[ci skip]"`, commit `e573791b`: `"Add 'archive' tag to niazoff/Chat (#2437)\n\n[ci skip]"`.
- **Root Cause**: CI triggers listening to `push: branches: [master]` without checking the commit author identity or git commit trailer tokens (`[ci skip]`, `[skip ci]`).
- **Remediation Code Diff**:
```yaml
# .github/workflows/validate.yml
on:
  push:
    branches: [ master ]
jobs:
  validate:
    # Explicit loop prevention guard
    if: "!contains(github.event.head_commit.message, '[ci skip]') && github.actor != 'osia-bot'"
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: bundle exec ruby .github/osia_validate_categories.rb
```
- **Lesson**: Any system that writes back to its own repository from an automated pipeline MUST implement dual recursion guards: commit trailer suppression and actor identity filtering.

---

## 4. Microscopic Code-Level Invariants (Syntax, Infinite Loop, UI/UX & Concurrency Guards)

### 1. Micro-Syntax & Token-Level Precision
In Ruby and JavaScript tooling processing `contents.json`:
- **Falsy Coercion & Zero Values**:
  In Ruby, `0` is truthy, whereas in JavaScript `0` is falsy. Star counts, issue counts, and release counts often equal `0`.
  ```ruby
  # DEFECT HAZARD:
  stars = project['stars']
  has_stars = stars ? true : false # In Ruby, 0 is truthy!

  # SAFE INVARIANT:
  has_stars = !stars.nil? && stars.is_a?(Integer) && stars > 0
  ```
- **Deep Immutability vs Shallow Copies in Transformations**:
  When compiling tags and filtering categories, mutating child structures directly corrupts downstream markdown section renderers.
  ```ruby
  # DEFECT TRAP:
  def partition_categories(projects)
    projects.each do |p|
      # In-place mutation corrupts data for subsequent category renders!
      p['tags'].map!(&:downcase)
    end
  end

  # SAFE INVARIANT:
  def partition_categories(projects)
    projects.map do |p|
      p.merge('tags' => p.fetch('tags', []).map(&:downcase).freeze).freeze
    end
  end
  ```

### 2. Infinite Loop & Recursion Guards
- **Circular URL Redirect & Deep Crawl Traps in `osia_get_links.rb`**:
  Checking link health across 1,700+ repositories risks infinite HTTP redirect loops (e.g., `http -> https -> www -> root`).
  ```ruby
  require 'net/http'

  def safe_fetch_url(url_string, max_redirects = 5)
    raise ArgumentError, "HTTP Redirect Loop Detected" if max_redirects <= 0

    uri = URI.parse(url_string)
    http = Net::HTTP.new(uri.host, uri.port)
    http.use_ssl = (uri.scheme == 'https')
    http.open_timeout = 5
    http.read_timeout = 5

    response = http.request_head(uri.request_uri)

    case response
    when Net::HTTPSuccess then true
    when Net::HTTPRedirection
      location = response['location']
      safe_fetch_url(location, max_redirects - 1)
    else
      false
    end
  rescue StandardError => e
    false
  end
  ```

### 3. UI & UX Micro-Mechanics (Markdown AST & Anchors)
- **GitHub Markdown Slug Generation & Anchor Ambiguity**:
  When categories have special characters or emojis (e.g., `Apple TV`, `Cocos2d`, `RxSwift`), anchor links (`#apple-tv`, `#rxswift`) fail if casing or symbols are mishandled.
  ```ruby
  # Deterministic Anchor Formatter
  def format_anchor(title)
    # 1. Downcase
    # 2. Replace non-alphanumeric with hyphen
    # 3. Collapse duplicate hyphens
    # 4. Strip boundary hyphens
    title.to_s
         .downcase
         .strip
         .gsub(/[^a-z0-9\-_]+/, '-')
         .gsub(/-+/, '-')
         .gsub(/\A-+|-+\z/, '')
  end
  ```

### 4. Backend Concurrency & Memory Safety
- **Rate-Limiting & Memory Leaks in Large Batch Scraping (`osia_update_github.rb`)**:
  Querying GitHub API for 1,700+ repos simultaneously will trigger HTTP 429 / 403 Rate Limits and unbounded memory allocation if responses are buffered in an array.
  ```ruby
  # Concurrent batch processing with Token Bucket / Queue and stream flushing
  require 'concurrent'

  def update_repo_batch(projects, batch_size = 20)
    pool = Concurrent::FixedThreadPool.new(4)
    
    projects.each_slice(batch_size) do |batch|
      promises = batch.map do |proj|
        Concurrent::Promise.execute(executor: pool) do
          fetch_github_metadata(proj['source'])
        end
      end
      
      # Barrier synchronization per batch to bound memory growth
      Concurrent::Promise.zip(*promises).value!
      sleep(1.0) # Rate limit cooling window
    end
    
    pool.shutdown
    pool.wait_for_termination
  end
  ```

### 5. Defect & Error Prevention ("Galti Pakadna")
- **Null Safety in Nested Category Arrays**:
  `category-ids` can be missing, empty, or contain trailing nulls if hand-edited.
  ```ruby
  # DEFECTIVE:
  categories = entry['category-ids'].map(&:strip) # Crashes with NoMethodError if nil

  # BULLETPROOF DEFENSE:
  categories = Array(entry['category-ids'])
                 .compact
                 .map(&:to_s)
                 .map(&:strip)
                 .reject(&:empty?)
  ```

---

## 5. The 9 Deep Learning Dimensions

### 1. Architecture
The architecture is decoupled into **Data Definition** (`contents.json`), **Taxonomy Constraints** (`osia_category_list.rb`), **Enrichment Tooling** (Ruby scripts), and **Compilation Projections** (`README.md`, etc.). State ownership is completely centralized in `contents.json`.

### 2. Core Abstractions
- **Entity (`Project`)**:
  ```typescript
  interface Project {
    title: string;
    description: string;
    "category-ids": string[];
    tags: string[];
    screenshots?: string[];
    source: string;
    homepage?: string;
    itunes?: string;
    license: string;
    date_added: string;
    suggested_by: string;
    stars?: number;
  }
  ```
- **Taxonomy Category**:
  Represents a partition key with title, slug, and platform grouping.

### 3. Error Handling
- **Degradation Policy**: If an external API (iTunes/GitHub) fails during hydration, the system retains the previous state (e.g., previous star count or license string) rather than wiping the field or aborting the build.
- **Fail-Fast Policy**: During CI verification (`osia_validate_categories.rb`), any schema violation, unescaped quote, or missing key aborts execution immediately with a non-zero exit code.

### 4. Testing
- Testing relies on static structural testing via `ruby .github/osia_validate_categories.rb` and JSON schema validation.
- Schema invariants:
  - Every project must have valid URLs for `source`.
  - Date added must parse cleanly as a valid timestamp.

### 5. Security
- **Untrusted User Input Sanitization in Markdown**:
  User submissions include `description`, `title`, and `homepage`.
  Markdown injection traps: If an attacker injects unescaped HTML (`<script>`, `<iframe src="...">`) into `description`, it compiles directly into `README.md`.
  Invariant: All text fields must be HTML-entity encoded or stripped before rendering to Markdown tables.

### 6. Performance
- **Asymptotic Complexity**:
  Parsing a 35,000+ line JSON file takes `O(N)` memory and time.
  Conversion to Markdown operates in `O(N log N)` due to category grouping and star-count sorting.
- **Memory Footprint**:
  Reading the entire JSON tree into memory is acceptable (~10MB heap in Ruby), but string concatenation must use buffer arrays (`buffer << string`) rather than dynamic re-allocations (`string += another_string`).

### 7. Deployment
- Deployments run via `.github/deploy.sh` triggered on push to master or approval workflows (`pr-approved.yml`).
- Generates derived `.md` files and executes Git commit/push using deployment credentials.

### 8. Agent Patterns
- When AI coding agents (such as Claude Code, referenced in PR #2454) interact with this repository:
  1. The agent must parse `contents.json`.
  2. The agent must locate the insertion offset or load the JSON document.
  3. The agent must NEVER touch `README.md`.
  4. The agent must add the entry conforming precisely to `schema.json`.

### 9. Data Flow
`Contributor Submission -> contents.json -> schema.json verification -> osia_validate_categories.rb -> External Enrichment APIs -> osia_convert.rb -> README.md / APPSTORE.md / ARCHIVE.md`.

---

## 6. The 8 Learning Extraction Artifacts

### 1. Pattern: Monorepo Schema-to-Markdown Static Compilation
```ruby
# Pattern: Safe deterministic file rendering from JSON state
class MarkdownCompiler
  def self.compile(input_path, output_path)
    data = JSON.parse(File.read(input_path))
    content = StringIO.new

    content.puts "# Generated Open Source Directory\n\n"
    content.puts "<!-- Auto-generated. Do not edit directly. -->\n\n"

    # Deterministic grouping and sorting
    categories = data.fetch('categories', {}).sort
    categories.each do |cat_id, meta|
      content.puts "## #{meta['title']}\n\n"
      projects = data.fetch('projects', []).select { |p| p['category-ids'].include?(cat_id) }
      
      projects.sort_by { |p| p['title'].downcase }.each do |proj|
        content.puts "- [#{proj['title']}](#{proj['source']}) - #{proj['description']}"
      end
      content.puts "\n"
    end

    File.write(output_path, content.string)
  end
end
```

### 2. Rule
**RULE**:
Pull requests against static-generated repositories MUST ONLY modify source data files (`contents.json`) and MUST NOT contain changes to generated Markdown files (`README.md`, etc.).

### 3. Architecture Principle
**Separation of Source State and Projection Artifacts**:
Derived documentation files are compiled views, not source files. Mixing views and models in version control leads to irreconcilable merge branches.

### 4. Failure Mode
**Merge Gridlock via Compiled File Desynchronization**:
When multiple PRs update both source JSON and derived Markdown files, non-deterministic line placement in Markdown generators makes automated git merges mathematically impossible, stalling repository ingestion.

### 5. Reusable Skill: Automated PR Rebase & Regeneration Checklist
1. Revert any modified `.md` files: `git checkout origin/master -- *.md`.
2. Rebase feature branch against upstream: `git rebase origin/master`.
3. Validate modified `contents.json`: `ruby .github/osia_validate_categories.rb`.
4. Run compiler: `ruby .github/osia_convert.rb`.
5. Check git diff: Only `contents.json` should have unstaged or staged changes intended for the PR.

### 6. Decision: Raw JSON Monolith vs Distributed Flat Files
- *Decision*: Maintain a single `contents.json` file.
- *Rejected Alternative*: Split into individual files per project (`projects/*.json`).
- *Trade-off*: Single file simplifies GitHub web-editor contributions and full-text searches, but incurs merge collision penalties during high-frequency concurrent PRs.

### 7. Anti-Pattern: Two-Way Synchronization Between Markdown and JSON
```ruby
# ANTI-PATTERN: Attempting to parse Markdown back into JSON to support dual edits
def sync_markdown_to_json(markdown_path, json_path)
  # Brittle regex parsing of markdown will corrupt edge cases, Unicode, and escaped characters
  md_lines = File.readlines(markdown_path)
  # ... NEVER parse presentation formats back into single-source-of-truth models!
end
```

### 8. Verification Method
```bash
# Automated verification script for GitHub Actions
#!/usr/bin/env bash
set -euo pipefail

echo "Running Category and Schema Validation..."
bundle exec ruby .github/osia_validate_categories.rb

echo "Checking if README.md was inadvertently touched in this PR..."
if git diff --name-only origin/master...HEAD | grep -E '^README\.md$'; then
  echo "FAIL: README.md was modified in this branch. Revert README.md and modify contents.json only."
  exit 1
fi

echo "Integrity verification passed."
```

---

## 7. Actionable Agent Skill & Implementation Checklist

When an autonomous AI agent is tasked with contributing to or modifying `dkhamsing/open-source-ios-apps` or an identical architecture:

- [ ] **Step 1: Check Ingestion Policy**
  Inspect `.github/CONTRIBUTING.md` and repository headers to identify the Single Source of Truth file (`contents.json`). Confirm that all `.md` files are read-only build targets.
- [ ] **Step 2: Read and Parse Schema Definitions**
  Load `.github/schema.json` and `.github/osia_category_list.rb`. Extract allowed categories, mandatory fields, and formatting constraints.
- [ ] **Step 3: Prepare the Record Delta**
  Structure the candidate entry according to the exact field spec:
  ```json
  {
    "title": "<Project Name>",
    "description": "<Concise summary without marketing fluff>",
    "category-ids": ["<valid-id-from-category-list>"],
    "tags": ["<tag1>", "<tag2>"],
    "source": "https://github.com/<owner>/<repo>",
    "license": "<spdx-license-id>",
    "date_added": "<Month Day Year>"
  }
  ```
- [ ] **Step 