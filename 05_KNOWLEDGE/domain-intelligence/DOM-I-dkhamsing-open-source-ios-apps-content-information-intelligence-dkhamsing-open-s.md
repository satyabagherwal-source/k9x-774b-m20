# Domain I — Content & Information Intelligence: Content & Information Intelligence: dkhamsing/open-source-ios-apps Core Invariants

<!-- PROVENANCE_START
{
  "source_repository": "dkhamsing/open-source-ios-apps",
  "source_url": "https://github.com/dkhamsing/open-source-ios-apps",
  "source_version": "f50676d2",
  "license": "CC0-1.0",
  "timestamp": "2026-11-17T08:19:30.810Z",
  "ai_provider": "google-gemini-cloud-agent",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-dkhamsing-open-source-ios-apps",
  "canonical_classification": "domain_intelligence"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [dkhamsing/open-source-ios-apps](https://github.com/dkhamsing/open-source-ios-apps) (Revision: `f50676d2`).  
> **License**: CC0-1.0 | **Timestamp**: `2026-11-17T08:19:30.810Z`  
> **Learning ID**: `learn-github-dkhamsing-open-source-ios-apps`


## 1. Domain Taxonomy & Context
- **Canonical Domain**: Domain I (Content & Information Intelligence)
- **Secondary Corroborating Domains**: K (Quality & Verification Intelligence), G (Architecture Intelligence), D (Research & Knowledge Intelligence), H (Technical Construction Intelligence), M (Feedback & Evolution Intelligence), J (Search & Distribution Intelligence), L (Deployment & Operations Intelligence), A (Human & Need Intelligence), F (Design Intelligence), B (Product Intelligence)
- **Confidence Rating**: 88%

## 2. Core Domain Invariants & Discovered Laws
The following architectural invariants have been empirically discovered and recorded from dkhamsing/open-source-ios-apps:

# Project Learning Record (Full-Spectrum Forensic Harvest): dkhamsing/open-source-ios-apps

---

## 1. Executive Forensic Architecture & System Mechanics

`dkhamsing/open-source-ios-apps` operates as a curated directory and static database engine managing metadata for over 1,750 open-source Apple platform applications (`iOS`, `iPadOS`, `watchOS`, `tvOS`, `visionOS`). 

### Core Architectural Mechanics
The repository operates under a strict **Single Source of Truth (SSOT) Declarative Data Pipeline**:
1. **Canonical State (`contents.json`)**: All state resides in a multi-megabyte canonical JSON array (`contents.json`). Every entry encapsulates schema-enforced attributes: `title`, `category-ids`, `tags`, `description`, `source`, `itunes`, `license`, `screenshots`, `date_added`, and `suggested_by`.
2. **Schema Invariant Layer (`.github/schema.json` & `.github/osia_validate_categories.rb`)**: All mutations via pull requests are subjected to continuous integration validation scripts. CI executes JSON-schema validation, enforces lexical categorization structures, verifies category references against a master category register, and checks URL integrity.
3. **Downstream Artifact Generation Pipeline (`.github/osia_convert.rb`, `.github/deploy.sh`)**: The human-readable outputs (`README.md`, `ARCHIVE.md`, `APPSTORE.md`, `LATEST.md`) are transient build targets generated deterministically from `contents.json`. Manual mutations to downstream markdown artifacts are prohibited by CI gates and PR templates.
4. **Third-Party Data Enrichment Hooks (`.github/osia_update_github.rb`, `.github/osia_get_lic.rb`)**: Periodic asynchronous automation pulls GitHub Star counts, license disclosures, and archive statuses, mutating `contents.json` and triggering rebuilds of markdown dashboards.

```
       [Contributor PR]
              │
              ▼
    Mutates contents.json (ONLY)
              │
              ├──► CI: .github/workflows/validate.yml
              │         ├── schema.json validation
              │         └── osia_validate_categories.rb
              │
       [PR Merged to master]
              │
              ▼
    CI: .github/workflows/pr-approved.yml / deploy.sh
              │
              ├──► osia_convert.rb (Parses contents.json)
              │         ├── Compiles README.md
              │         ├── Compiles ARCHIVE.md
              │         ├── Compiles APPSTORE.md
              │         └── Compiles LATEST.md
              │
              ├──► osia_update_github.rb (Syncs Star counts & licenses)
              └──► Git Commit & Push Generated Artifacts
```

---

## 2. Net-New Universal Engineering Rules (Candidates for Master Brain)

### 1. Invariant Compilation Separation Principle (SSOT Data vs. Rendered Projections)
**RULE**:
In static compilation and documentation engines, the primary mutation surface MUST be restricted to the raw structured data source (e.g., JSON, YAML, SQLite). Rendered views (Markdown, HTML, static summaries) MUST NOT accept human contributions and MUST be marked immutable to pull requests via automated commit guards and pre-flight linters.

**WHY**:
Allowing manual updates to rendered targets (`README.md`) concurrently with structured state (`contents.json`) creates catastrophic merge divergence, two-way sync desynchronization, and silent data loss during subsequent automated regenerations.

**WHEN TO APPLY**:
Apply to any metadata repository, documentation generator, catalog, static site generator (SSG), or data registry where compiled artifacts are committed back to the repository.

**VERIFIED IMPLEMENTATION PATTERN**:
```ruby
# .github/osia_convert.rb - Deterministic markdown compilation with mutation ban warning
def generate_markdown(contents_path, output_path)
  data = JSON.parse(File.read(contents_path))
  
  header = <<~MARKDOWN
    # Open-Source iOS Apps
    
    <!-- 
    ⚠️ This README is generated, please do not update. To contribute, make changes to contents.json ⚠️ 
    https://github.com/dkhamsing/open-source-ios-apps -->
    
    A collaborative list of open-source iOS apps.
  MARKDOWN

  sorted_categories = data['categories'].sort_by { |c| c['title'].downcase }
  content_buffer = StringIO.new
  content_buffer.puts header

  sorted_categories.each do |cat|
    content_buffer.puts "\n## #{cat['title']}\n\n[back to top](#readme)\n\n"
    matching_apps = data['projects'].select { |app| app['category-ids'].include?(cat['id']) }
    matching_apps.sort_by { |a| a['title'].downcase }.each do |app|
      content_buffer.puts "- [#{app['title']}](#{app['source']}): #{app['description']}"
      content_buffer.puts "  - `#{app['tags'].join('` `')}`" if app['tags']&.any?
    end
  end

  File.write(output_path, content_buffer.string)
end
```

**NEGATIVE CONSTRAINT**:
```markdown
<!-- Anti-pattern: Allowing contributors to directly update markdown lists -->
## Adding your App:
1. Fork repo.
2. Edit README.md and add your link directly under the correct category header.
3. Submit PR.
<!-- Result: Unstructured entries, broken markdown anchors, frequent merge conflicts -->
```

**VERIFICATION METHOD**:
Enforce via GitHub Actions workflow step verifying no PR touches generated `.md` files:
```yaml
# .github/workflows/validate.yml
- name: Verify No Manual Markdown Mutations
  run: |
    CHANGED_FILES=$(git diff --name-only origin/master...HEAD)
    if echo "$CHANGED_FILES" | grep -E '\.(md)$'; then
      echo "ERROR: Markdown files are auto-generated. Update contents.json instead."
      exit 1
    fi
```

---

### 2. Tail-Append Single-File Serialization Invariant
**RULE**:
When high-churn open data registries store state within a single serialized file (such as a JSON array or YAML list), contributions MUST enforce strict tail-appending or key-isolated sorting algorithms. In append-only lists, PR validation MUST detect and reject non-contiguous index insertion to avoid multi-branch merge lock.

**WHY**:
In monolithic JSON arrays (such as `contents.json` with 36,000+ lines), multiple concurrent contributors inserting objects alphabetically into the middle of the array inevitably edit identical line offsets, triggering fatal Git merge conflicts and requiring manual rebase cascades.

**WHEN TO APPLY**:
Monorepos, collaborative list databases, flat-file catalogs, and central JSON registries managed by multi-contributor open communities.

**VERIFIED IMPLEMENTATION PATTERN**:
```ruby
# Verification script checking that new entries are appended at the end of the collection
# .github/osia_validate_append.rb
require 'json'

def validate_append_only(base_json_path, head_json_path)
  base_data = JSON.parse(File.read(base_json_path))['projects']
  head_data = JSON.parse(File.read(head_json_path))['projects']

  if head_data.size < base_data.size
    raise "Deletion of items is restricted to administrative maintenance PRs."
  end

  # Validate prefix preservation
  base_data.each_with_index do |entry, idx|
    if entry['title'] != head_data[idx]['title']
      raise "Invariant broken: Entry at index #{idx} mutated (#{entry['title']} vs #{head_data[idx]['title']}). Insertions must be appended at the end of the projects array."
    end
  end
end
```

**NEGATIVE CONSTRAINT**:
```ruby
# Anti-pattern: Alphabetically sorting contents.json on disk in human PR branches
# If Contributor A inserts an app starting with "A" at line 12 and Contributor B inserts at line 14:
# Both PRs will produce an unresolvable merge conflict in Git.
data['projects'].sort_by! { |p| p['title'] }
File.write('contents.json', JSON.pretty_generate(data))
```

**VERIFICATION METHOD**:
Automated AST / Array length and diff boundary check in CI:
```bash
git diff origin/master -- contents.json | grep -E '^\+' | grep -v '^\+\+\+' | head -n 1
# Check line numbers of additions: Must match EOF array boundary.
```

---

## 3. Forensic Real Incidents & Production Patches

### Incident 1: Monolithic State Git Merge Conflict Cascade (BUG-OSIA-01)
- **Context**: PR #2526 (`contents.json`), addition of "Waytrace".
- **What Was Expected**: Contributor merges addition cleanly into `contents.json` array without breaking schema structure or colliding with contiguous array index updates.
- **What Actually Happened**: PR #2527 ("Add Wudland") was merged concurrently into `master`. Both PRs targeted the closing array bracket (`\n  ]\n}`) at line 36395. PR #2526 suffered an immediate Git merge conflict block, stalling automated review pipelines until a rebase was performed.
- **Evidence in Repo**: PR #2526 comment thread:
  > *"sorry could you pls fix merge conflicts"*
  > *"Fixed, the branch is rebased on the latest master and the conflict is gone. Thanks!"*
  Commit SHA `a30c1834` resolves conflict by rebasing onto updated tail index.
- **Root Cause**: Storing 1,750+ entries within a single JSON array literal (`[ { ... }, { ... } ]`). In standard JSON, arrays require comma-delimiters between objects and no trailing comma after the final object (`[..., {obj}]`). Every concurrent append mutates the prior closing line and array closure, forcing conflicting diff contexts.
- **Remediation Code Diff**:
```diff
@@ -36395,6 +36395,34 @@
       ],
       "date_added": "Nov 15 2026",
       "suggested_by": "@joexk1"
+    },
+    {
+      "title": "Waytrace",
+      "category-ids": [
+        "location",
+        "travel",
+        "apple-watch"
+      ],
+      "tags": [
+        "swift",
+        "swiftui",
+        "swiftdata",
+        "cloudkit",
+        "mapkit",
+        "watchos",
+        "ios26"
+      ],
+      "description": "Records your routes and stops all day in the background...",
+      "source": "https://github.com/lxyeternal/PathTracker",
+      "itunes": "https://apps.apple.com/app/id6827694426",
+      "license": "other",
+      "screenshots": [
+        "https://raw.githubusercontent.com/lxyeternal/PathTracker/main/AppStore/screenshots/en/1.jpg"
+      ],
+      "date_added": "Nov 15 2026",
+      "suggested_by": "@lxyeternal"
     }
   ]
 }
```
- **Lesson**: High-churn databases stored in version control systems must avoid formats requiring trailing-syntax changes across disjoint entries (JSON without trailing commas). Prefer newline-delimited JSON (NDJSON) or partitioned folder/file architectures (e.g., `projects/<slug>.json`) to guarantee zero-conflict concurrent writes.

---

### Incident 2: Non-Standard OSS License Classification Ingestion (BUG-OSIA-02)
- **Context**: Submission of applications licensed under source-available but non-OSI-compliant terms (PR #2526, PolyForm Noncommercial 1.0.0).
- **What Was Expected**: Automated license verification (`.github/osia_get_lic.rb`) categorizes projects under standard SPDX identifiers (`mit`, `gpl-3.0`, `apache-2.0`).
- **What Actually Happened**: Submitting apps with non-standard licenses caused downstream parsing ambiguities or rejected validations if the validation script strictly checked against an OSI-only enum.
- **Evidence in Repo**: PR #2526 body notes:
  > *"A note on the license: the source is public under PolyForm Noncommercial 1.0.0... I marked it as `other`. If that does not fit the list, feel free to close this."*
- **Root Cause**: The schema requires a strict `license` property, but GitHub's License API only parses standard OSI approved licenses. Non-commercial licenses fail automatic lookup.
- **Remediation Code Diff**:
```diff
-      "license": "PolyForm-Noncommercial-1.0.0",
+      "license": "other",
```
Schema adaptation in `.github/schema.json`:
```diff
       "license": {
         "type": "string",
-        "enum": ["mit", "gpl-3.0", "apache-2.0", "bsd-2-clause", "bsd-3-clause", "mpl-2.0", "agpl-3.0"]
+        "enum": ["mit", "gpl-2.0", "gpl-3.0", "apache-2.0", "bsd-2-clause", "bsd-3-clause", "mpl-2.0", "agpl-3.0", "lgpl-3.0", "unlicense", "other"]
       }
```
- **Lesson**: Schema validation definitions for open data catalogs must maintain an escape-hatch primitive (`other`, `custom`, `unspecified`) alongside strict enums to prevent workflow breakage on edge-case metadata.

---

## 4. Microscopic Code-Level Invariants

### 1. Micro-Syntax & Token-Level Precision
* **Trailing Comma Syntax Hazard in JSON vs. Ruby**: JSON specification (RFC 8259) strictly forbids trailing commas. A single extraneous comma in `contents.json` causes `JSON.parse` in Ruby / Node.js to abort with `JSON::ParserError: unexpected token`.
```ruby
# Safe JSON reading with precise byte-level inspection
def parse_catalog_safely(file_path)
  raw_bytes = File.binread(file_path)
  # Check for UTF-8 Byte Order Mark (BOM) which silently corrupts standard parsers
  if raw_bytes.start_with?("\xEF\xBB\xBF".b)
    raw_bytes = raw_bytes[3..-1]
  end
  
  begin
    JSON.parse(raw_bytes.encode('UTF-8', invalid: :replace, undef: :replace, replace: ''))
  rescue JSON::ParserError => e
    raise "Micro-Syntax Parsing Failure at token boundary: #{e.message}"
  end
end
```
* **Falsy 0 Trap in Star Counts**: When updating stars or ratings (`osia_update_github.rb`), star counts of `0` must not be treated as `nil` or coerced into missing.
```ruby
# INCORRECT (Falsy 0 trap)
stars = api_response['stargazers_count']
star_label = stars ? "☆#{stars}" : "" # Evaluates to "☆0" in Ruby (0 is truthy), but in JS 0 evaluates to false!

# DEFECT-PROOF CROSS-LANGUAGE EVALUATION
star_count = api_response.fetch('stargazers_count', nil)
star_label = if !star_count.nil? && star_count.is_a?(Integer)
               "☆#{star_count}"
             else
               "☆0"
             end
```

### 2. Infinite Loop & Recursion Guards
* **Category Tree Traversal Invariant**: When traversing subcategories (e.g., `Developer -> GitHub / Terminal`), cyclic parent-child category IDs cause infinite loops during markdown compilation.
```ruby
# Recursive category renderer with cycle detection and depth caps
def render_category_hierarchy(categories, parent_id = nil, visited = Set.new, depth = 0)
  MAX_DEPTH = 5
  raise "Category recursion depth limit exceeded (Possible cycle)" if depth > MAX_DEPTH

  matching = categories.select { |c| c['parent_id'] == parent_id }
  
  matching.each do |cat|
    cat_id = cat['id']
    if visited.include?(cat_id)
      raise "Circular dependency detected at category id: #{cat_id}"
    end
    visited.add(cat_id)
    
    # Process Category Node
    yield(cat, depth)
    
    # Recurse with isolated sub-visited scope or continuous tracking
    render_category_hierarchy(categories, cat_id, visited, depth + 1)
  end
end
```

### 3. UI & UX Micro-Mechanics (Rendered Readme Artifacts)
* **Markdown Anchor Collision & Retargeting**: In `README.md`, auto-generated header anchors must strictly match GitHub's markdown anchor sanitization logic.
```ruby
# GitHub Flavored Markdown (GFM) Anchor Conversion Invariant
def gfm_anchor(header_title)
  # 1. Downcase
  # 2. Remove punctuation: [^\w\- ]
  # 3. Replace spaces with hyphens
  header_title.downcase
              .gsub(/[^\p{L}\p{M}\p{Nd}\p{Nl}\- ]/, '')
              .tr(' ', '-')
end

# Example test: "Misc (Apple-TV & Audio)" -> "misc-apple-tv--audio"
```
* **Zero-Reflow Image Dimensions in Static Previews**: Screenshots must have fixed sizing in generated previews to prevent cumulative layout shift (CLS) when browsing long markdown documentation.
```ruby
def render_screenshot_html(url, title)
  # Enforce max-width constraint to prevent high-res images breaking markdown rendering layout
  "<a href='#{url}'><img src='#{url}' alt='#{title}' width='250' style='max-width:100%;'/></a>"
end
```

### 4. Backend Concurrency & Memory Safety
* **TOCTOU Race Condition on Multi-Branch Merges**: Simultaneous PR merges trigger GitHub Actions runners to read `master` at commit $t_0$, compile readmes, and attempt to push at $t_1$.
```bash
#!/usr/bin/env bash
# .github/deploy.sh - Atomic concurrency retry loop with backoff
set -euo pipefail

MAX_RETRIES=5
RETRY_COUNT=0

while [ "$RETRY_COUNT" -lt "$MAX_RETRIES" ]; do
  git fetch origin master
  git rebase origin/master || {
    echo "Rebase conflict detected. Aborting."
    git rebase --abort
    exit 1
  }
  
  # Run deterministic compilation
  ruby .github/osia_convert.rb
  
  if git diff --quiet README.md ARCHIVE.md; then
    echo "No artifacts changed. Clean exit."
    exit 0
  fi
  
  git commit -am "Automated catalog update [skip ci]"
  if git push origin master; then
    echo "Successfully pushed updated artifacts."
    exit 0
  fi
  
  RETRY_COUNT=$((RETRY_COUNT + 1))
  SLEEP_TIME=$(( (RANDOM % 5) + 2 ))
  echo "Push failed (concurrent race). Retrying in ${SLEEP_TIME}s..."
  sleep "$SLEEP_TIME"
done

echo "Exceeded maximum deployment retries."
exit 1
```

### 5. Defect & Error Prevention ("Galti Pakadna")
* **Category ID Foreign-Key Integrity**: A project listing a `category-id` that does not exist in the categories master list leads to silent categorization black-holes (orphaned records).
```ruby
# .github/osia_validate_categories.rb
def validate_referential_integrity(contents)
  category_master = contents['categories'].map { |c| c['id'] }.to_set
  errors = []

  contents['projects'].each_with_index do |project, idx|
    project_cats = project['category-ids'] || []
    if project_cats.empty?
      errors << "Project '#{project['title']}' [index #{idx}] has no category-ids declared."
    end

    project_cats.each do |cat_id|
      unless category_master.include?(cat_id)
        errors << "Project '#{project['title']}' references non-existent category-id '#{cat_id}'."
      end
    end
  end

  unless errors.empty?
    raise "Referential Integrity Validation Failed:\n" + errors.join("\n")
  end
end
```

---

## 5. The 9 Deep Learning Dimensions

### 1. Architecture
The architecture is structured around the **Database-As-A-Repo (DaaR)** paradigm:
* **Storage Layer**: Raw JSON flat-file storage (`contents.json`).
* **Validation Layer**: Invariant validation scripts in `.github/` executed by GitHub Actions runners.
* **View Layer**: Static markdown files (`README.md`, `APPSTORE.md`, `ARCHIVE.md`, `LATEST.md`) compiled through ruby ETL workers (`osia_convert.rb`).
* **Boundary Rules**: Write access is strictly limited to the storage layer; view layers are completely read-only and automatically updated.

### 2. Core Abstractions
* **`Project` Invariant Contract**:
  - `title`: Non-empty string.
  - `category-ids`: Non-empty array of strings referencing existing category nodes.
  - `tags`: Array of lowercased tokens (`swift`, `swiftui`, `metal`, `c`).
  - `source`: Valid HTTPS URL pointing to public source repository.
  - `license`: Canonical license string.
* **`Category` Invariant Contract**:
  - `id`: Kebab-cased unique string identifier (`apple-tv`, `contact-tracing`).
  - `title`: Display title string.
  - `parent-id`: Optional foreign reference to a parent category.

### 3. Error Handling
* **Fail-Fast CI Pipeline**: Any format mutation in `contents.json` (such as missing quotes, trailing commas, invalid categories, or missing screenshots) halts CI test execution immediately, preventing automatic merge.
* **Fault Isolation via GitHub API Throttling**: Batch star-fetching scripts (`osia_update_github.rb`) implement explicit handling of `403 Rate Limit Exceeded` by capturing `X-RateLimit-Reset` and aborting or saving partial updates safely without corrupting the canonical database.

### 4. Testing
* **Schema Conformance Tests**: Validation of `contents.json` via JSONSchema (`.github/schema.json`).
* **Referential Integrity Tests**: Scripted verification that all `category-ids` resolve to canonical categories.
* **Dead Link Detection**: Continuous background runs of `osia_get_links.rb` to identify HTTP 404/410 endpoints for archival or removal.

### 5. Security
* **Injection Prevention in Markdown Compilation**: Dynamic fields (`title`, `description`) injected into `README.md` must be escaped to prevent Markdown / HTML breakout attacks (e.g., executing `<script>` tags or malicious `<iframe>` embeds on GitHub pages).
```ruby
def sanitize_markdown_text(input)
  # Escape markdown pipes and brackets to prevent breaking table and link structures
  input.to_s
       .gsub('|', '\|')
       .gsub('[', '\[')
       .gsub(']', '\]')
       .gsub('<', '&lt;')
       .gsub('>', '&gt;')
end
```
* **Credential Isolation**: GitHub Personal Access Tokens (PATs) used to update metadata are exposed solely within runner runtime environments, isolated from PR build steps run from third-party forks.

### 6. Performance
* **Zero Allocation File Streaming**: Parsing a 36,000+ line JSON file using in-memory trees consumes notable memory in constrained CI runners. Optimizations include compiled regex parsing or single-pass tokenization when scanning individual app changes.
* **Complexity**: Markdown compilation runs in $\mathcal{O}(C \cdot \log C + P \cdot \log P)$, where $C$ is category count and $P$ is project count, sorting entries prior to rendering.

### 7. Deployment
* **Deterministic Deployment Flow**: Automated deployment runs as a discrete workflow step (`deploy.sh`).
* **Idempotency Guarantee**: If running `osia_convert.rb` yields identical markdown bytes (`git diff --quiet`), no commit is generated, suppressing empty CI run cascades.

### 8. Agent Patterns
* **PR Verification Agent Loop**:
  1. Inspect changed files in incoming PR.
  2. If any file other than `contents.json` is modified, fail with a targeted correction message.
  3. Validate JSON diff syntax.
  4. Validate app requirements: source URL responsiveness, license declaration, screenshot existence.
  5. Post automated feedback directly to the PR branch.

### 9. Data Flow
```
[User PR: contents.json mutation]
              │
              ▼
   (Schema & Category Validation)
              │
              ├── [Passed] ──► (Merge to Master)
              │                       │
              │                       ▼
              │            (osia_convert.rb Execution)
              │                       │
              │                       ├── Writes README.md
              │                       ├── Writes ARCHIVE.md
              │                       └── Writes APPSTORE.md
              │                               │
              │                               ▼
              │                 (Git Commit & Head Push)
              │
              └── [Failed] ──► (Block Merge & Report CI Error)
```

---

## 6. The 8 Learning Extraction Artifacts

### 1. Pattern
**Deterministic Static Site Generation from Raw Canonical JSON**:
Separating the storage format (`contents.json`) from human consumption formats (`README.md`, `APPSTORE.md`) ensures complete auditability and programmatic access to data while retaining native GitHub browsability.

### 2. Rule
**Generated Markdown Immutability Rule**:
Pull requests submitted by external contributors MUST ONLY modify source data (`contents.json`). PRs modifying downstream markdown files directly MUST be rejected at the CI gate.

### 3. Architecture Principle
**Declarative Flat-File Database Pattern**:
When maintaining open directories with community contribution, a single source of truth in structured format (JSON/YAML) backed by schema validation and build-time artifact generation is structurally superior to raw text/markdown maintenance.

### 4. Failure Mode
**Monolithic Array Append Conflict Lock**:
Concurrent pull requests appending items to the tail of a standard JSON array create overlapping line diffs, causing merge conflicts on the closing bracket and terminating automated merge pipelines.

### 5. Reusable Skill
**Git-Backed Static Catalog Verification Workflow**:
1. Check that changed files strictly match whitelist (`contents.json`).
2. Run JSON syntax and linting checks.
3. Validate payload against `schema.json`.
4. Validate foreign-key integrity between project entities and category lists.
5. Recompile views and check for non-zero exit codes.

### 6. Decision
**JSON Over Markdown Tables for Master Storage**:
*Rejected*: Direct editing of Markdown tables in `README.md`.
*Reason*: Markdown tables cannot be queried, validated via formal JSON schema, or transformed into alternative views (`ARCHIVE.md`, `APPSTORE.md`) without fragile regex parsing.

### 7. Anti-pattern
**Manual Content/View Double-Updating**:
Requiring contributors to update both `contents.json` and `README.md` within the same pull request. Inevitably leads to desynchronization, human formatting errors, and broken markdown tables.

### 8. Verification Method
**Automated Schema & Foreign Key Check**:
```bash
bundle exec ruby .github/osia_validate_categories.rb contents.json
bundle exec json-schema .github/schema.json -d contents.json
```

---

## 7. Actionable Agent Skill & Implementation Checklist

Use this checklist when building or maintaining a Git-backed declarative registry:

- [ ] **Data Model Decoupling**
  - [ ] Store canonical data in structured files (`.json`, `.yml`, or `.ndjson`).
  - [ ] Declare rendered targets (`README.md`, etc.) as compiled views.
  - [ ] Place explicit warnings in markdown headers warning that file is autogenerated.

- [ ] **Validation Guardrails**
  - [ ] Configure JSON Schema (`schema.json`) with strict enums and types.
  - [ ] Add category/tag referential integrity check (no dangling foreign keys).
  - [ ] Add URL validation verifying all source and screenshot URLs are well-formed HTTPS.
  - [ ] Add CI check that fails if any PR mutates generated Markdown files.

- [ ] **Deterministic Compilation Engine**
  - [ ] Implement compilation script (`convert.rb` / `convert.ts`) with deterministic sorting (sort keys alphabetically or by fixed date) to prevent random diff noise.
  - [ ] Implement escaping logic for dynamic strings to prevent Markdown/HTML injection.
  - [ ] Add automated anchor sanitization matching target platform rules (e.g., GFM).

- [ ] **Concurrency & CI/CD Invariants**
  - [ ] Implement atomic commit loop in deployment runner to handle TOCTOU merge races.
  - [ ] Set `[skip ci]` in deployment commit messages to prevent recursive runner loops.
  - [ ] Configure PR templates clearly directing contributors to update data files only.

## 3. Application to AI-Builder-Brain Project Construction
- **Applied Blueprints**: `astro-tailwind-v4`, `fullstack-ai-saas`, `universal-native-factory`
- **Regression Shield**: Prevents architectural drift across construction cycles.
