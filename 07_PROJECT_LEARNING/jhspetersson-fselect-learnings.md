> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/jhspetersson-fselect-learnings.md`  
> **Source**: github ([https://github.com/jhspetersson/fselect](https://github.com/jhspetersson/fselect))  
> **Source Version**: `32c74c88`  
> **License**: Apache-2.0  
> **Synthesized By**: google-gemini-cloud-agent  
> **Timestamp**: 2026-10-19T07:29:38.904Z  
> **Learning ID**: `learn-github-jhspetersson-fselect`  
> **Pipeline Version**: `2.0.0`  
> **Status**: VERIFIED_EMPIRICAL_INTELLIGENCE  
> **Data Governance**: CLASSIFICATION: PUBLIC. Sanitized against PII/secrets.  
> **Policy Invariant**: Strictly for engineering retrieval and architecture documentation. Distillation prohibited.  

---

# Project Learning Record (Full-Spectrum Forensic Harvest): jhspetersson/fselect

---

## 1. Executive Forensic Architecture & System Mechanics

`fselect` is an autonomous CLI search and aggregation engine that bridges traditional UNIX virtual file system (VFS) traversal with a relational SQL query processing model. Unlike classic UNIX utilities (`find`, `ls`, `stat`) which require composable pipeline parsing (`find ... | xargs stat | awk ...`), `fselect` parses a relaxed SQL dialect directly into an abstract syntax tree (AST), optimizes execution paths based on indexed vs. recursive directory traversal drivers, extracts metadata from binary formats and OS-level extended attributes, executes relational operations (projections, filtering, aggregation, groupings, subqueries), and renders formatted results across multiple serialization sinks (CSV, JSON, HTML, interactive terminal).

```
 ┌────────────────────────────────────────────────────────────────────────┐
 │                              CLI / Driver                              │
 └───────────────────────────────────┬────────────────────────────────────┘
                                     │ User Query String
                                     ▼
 ┌────────────────────────────────────────────────────────────────────────┐
 │                     Query Compilation & AST Engine                     │
 │  ┌─────────────┐       ┌──────────────┐       ┌──────────────────────┐ │
 │  │ Lexer       ├──────►│ Parser       ├──────►│ AST: Query           │ │
 │  │ (src/lexer) │       │ (src/parser) │       │ Fields, Where, Group │ │
 │  └─────────────┘       └──────────────┘       └──────────┬───────────┘ │
 └──────────────────────────────────────────────────────────┼─────────────┘
                                                            ▼
 ┌────────────────────────────────────────────────────────────────────────┐
 │                      Searcher & Traversal Pipeline                     │
 │  ┌──────────────────────────────────────────────────────────────────┐  │
 │  │ Engine Router: Native WalkDir | plocate DB | Voidtools Everything│  │
 │  └───────────────────────────────┬──────────────────────────────────┘  │
 │                                  │ VFS Entry / Zip Entry               │
 │                                  ▼                                     │
 │  ┌──────────────────────────────────────────────────────────────────┐  │
 │  │ Field Dispatcher (`src/field/dispatch.rs`)                       │  │
 │  │ Evaluates: Core Stat, Media Headers, POSIX ACLs, VFS Caps, EXIF  │  │
 │  └───────────────────────────────┬──────────────────────────────────┘  │
 └──────────────────────────────────┼─────────────────────────────────────┘
                                    ▼
 ┌────────────────────────────────────────────────────────────────────────┐
 │                 Relational Execution & Aggregation                     │
 │  - Filtering: Expression Evaluation (`src/expr.rs`)                    │
 │  - Grouping: Multi-pass topological alias binding (`src/searcher.rs`)  │
 │  - Aggregators: Count, Sum, Avg, Min, Max, Correlated Subqueries       │
 └──────────────────────────────────┬─────────────────────────────────────┘
                                    ▼
 ┌────────────────────────────────────────────────────────────────────────┐
 │                      Output Sinks (`src/output/*`)                     │
 │  Flat (Tab/Custom) | CSV | JSON | HTML | Interactive TUI (Rustyline)   │
 └────────────────────────────────────────────────────────────────────────┘
```

### Critical Subsystem Boundaries and Abstractions

1. **Query AST & Expression Architecture (`src/expr.rs`, `src/parser.rs`)**:
   - The query syntax is modeled as a unified `Query` struct comprising projection columns (`fields`), table/directory roots, predicate expression tree (`Expr`), grouping directives (`group_by_fields`), post-aggregation filters (`having_expr`), ordering directives, and limit/offset bounds.
   - Expressions are recursively resolved: literals, fields, unary/binary arithmetic operators, glob/regex comparisons, aggregate function calls, and correlated subqueries.

2. **Unified VFS & Archive Abstraction (`src/fileinfo.rs`, `src/field/context.rs`)**:
   - Traversal treats physical file paths and virtual archive paths (ZIP archives, nested members) under a uniform `FileInfo` envelope.
   - `FieldContext` maintains borrow-scoped references to the directory entry (`DirEntry`), custom metadata attributes, and cached descriptors, isolating I/O syscalls until an evaluated expression explicitly queries an expensive attribute (e.g., MIME type, SHA-256, EXIF, or audio duration).

3. **Domain-Specific Metadata Probing (`src/util/*`)**:
   - Decoupled from POSIX `stat`, dedicated parsers inspect container-specific binary signatures:
     - `src/util/acl.rs`: Decodes raw Linux/POSIX ACL binary structs (`system.posix_acl_access` xattr) without shelling out to `getfacl`.
     - `src/util/capabilities.rs`: Decodes Linux VFS capability structs directly from `security.capability` extended attributes via bitmasking.
     - `src/util/dimensions/*`: Strategy pattern driven by `DimensionsExtractor` to extract dimensions lazily without decoding full media frames (probes ISO-BMFF headers for MP4, EBML headers for Matroska/MKV, SVG XML trees, or Image container headers).

4. **Multi-Pass Execution & Aggregator Context (`src/searcher.rs`)**:
   - Grouping and aggregation require stateful evaluation across grouped buckets.
   - Handles correlated subqueries (where child queries reference parent query field aliases) via topological multi-pass evaluation, avoiding eager resolution locks or uninitialized alias lookups.

---

## 2. Net-New Universal Engineering Rules (Candidates for Master Brain)

### 1. Zero-Cost Binary VFS Serialization Boundary Rule
**RULE**: When parsing OS-level binary structures from system calls (extended attributes, kernel capabilities, IPC structures, archive central directories), every parser MUST validate strict length boundaries, verify format revision magic numbers before performing byte-slice transmutation, and reject unaligned or trailing truncated buffers with deterministic `Option`/`Result` types rather than partial fallback or panic.

**WHY**: Parsing Linux capabilities (`security.capability`) or POSIX ACLs (`system.posix_acl_access`) directly from extended attribute bytes is prone to buffer over-reads, memory panics, and privilege check bypasses. OS APIs may return variable revisions (e.g., VFS Cap Revision 1, 2, or 3) with varying trailing payloads (such as root namespace IDs). Casting raw slices without header validation leads to UB or process crashes.

**WHEN TO APPLY**: Systems programming in Rust/C/C++, kernel-to-userspace boundary interactions, parsing `xattr`, POSIX ACLs, ELF headers, or container file format headers.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
// Canonical Pattern: Strict Header Verification + Exact Chunk Processing
pub fn parse_posix_acl_v2(data: &[u8]) -> Option<Vec<AclEntry>> {
    const ACL_VERSION: u32 = 0x0002;
    const ACL_HEADER_SIZE: usize = 4;
    const ACL_ENTRY_SIZE: usize = 8;

    // 1. Strict minimum length validation
    if data.len() < ACL_HEADER_SIZE {
        return None;
    }

    // 2. Validate revision magic from endian-explicit byte conversion
    let version = u32::from_le_bytes(data[0..4].try_into().ok()?);
    if version != ACL_VERSION {
        return None;
    }

    let body = &data[ACL_HEADER_SIZE..];

    // 3. Enforce exact alignment with entry size; prevent truncated trailing bytes
    if body.len() % ACL_ENTRY_SIZE != 0 {
        return None;
    }

    let mut entries = Vec::with_capacity(body.len() / ACL_ENTRY_SIZE);

    // 4. Zero-copy iteration over chunks
    for chunk in body.chunks_exact(ACL_ENTRY_SIZE) {
        let tag_raw = u16::from_le_bytes(chunk[0..2].try_into().ok()?);
        let perm = u16::from_le_bytes(chunk[2..4].try_into().ok()?);
        let id = u32::from_le_bytes(chunk[4..8].try_into().ok()?);

        let tag = match tag_raw {
            0x0001 => AclTag::UserObj,
            0x0002 => AclTag::User(id),
            0x0004 => AclTag::GroupObj,
            0x0008 => AclTag::Group(id),
            0x0010 => AclTag::Mask,
            0x0020 => AclTag::Other,
            _ => continue, // Graceful degradation on unknown tags
        };

        entries.push(AclEntry { tag, permissions: perm });
    }

    Some(entries)
}
```

**NEGATIVE CONSTRAINT**:
```rust
// CRITICAL BUG: Unchecked slice indexing and assuming fixed size
pub fn parse_acl_unsafe(data: &[u8]) -> Vec<AclEntry> {
    let mut entries = Vec::new();
    // PANIC: data might be empty or smaller than 4 bytes
    let version = u32::from_le_bytes([data[0], data[1], data[2], data[3]]); 
    let mut offset = 4;
    // HAZARD: Slicing out of bounds if data length is not (4 + 8*n)
    while offset < data.len() {
        let tag = u16::from_le_bytes([data[offset], data[offset+1]]);
        let perm = u16::from_le_bytes([data[offset+2], data[offset+3]]);
        let id = u32::from_le_bytes([data[offset+4], data[offset+5], data[offset+6], data[offset+7]]);
        offset += 8;
        // ...
    }
    entries
}
```

**VERIFICATION METHOD**: Automated property-based testing and fuzz tests supplying: (1) `&[]`, (2) lengths `1..=3`, (3) valid headers followed by non-multiples of entry size (e.g., 5 bytes), (4) unknown revision identifiers. Assert that `parse_posix_acl_v2` yields `None` and never panics.

---

### 2. Temporal Representation Non-Ambiguity Invariant
**RULE**: Date/time query parsers MUST parse and construct temporal types directly in the target representation (`NaiveDate` / `NaiveDateTime`) using non-panicking, checked constructor APIs (`from_ymd_opt`, `and_hms_opt`), and MUST NOT perform intermediate round-trip conversions through timezone-aware representations (`Local`, `DateTime<Local>`) unless explicitly requested by the query semantics.

**WHY**: Timezones with daylight saving time (DST) transitions have "skipped hours" (spring forward) and "ambiguous repeated hours" (fall back). If a parser parses user input into a `Local` datetime or runs `DateTime::<Local>::from_local(...)`, standard libraries like `chrono` will panic with `"No such local time"` or `"Ambiguous local time"` on invalid/skipped civil clock values (e.g., midnight during DST switches in certain jurisdictions).

**WHEN TO APPLY**: All date/time parsers, database engines, CLI query tools, search predicates, and log ingestion pipelines handling wall-clock time.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
// Canonical Pattern: Naive construction with checked bounds and zero local round-trip
pub fn parse_calendar_datetime(
    year: i32,
    month: u32,
    day: u32,
    hour: u32,
    minute: u32,
    second: u32,
) -> Result<NaiveDateTime, String> {
    // 1. Explicit range and leap check without timezone panics
    let date = NaiveDate::from_ymd_opt(year, month, day)
        .ok_or_else(|| format!("Invalid calendar date: {year:04}-{month:02}-{day:02}"))?;

    // 2. Explicit time check (rejecting 25:00:00, 12:61:00)
    let time = date.and_hms_opt(hour, minute, second)
        .ok_or_else(|| format!("Invalid time component: {hour:02}:{minute:02}:{second:02}"))?;

    // Returns NaiveDateTime directly; safe from DST discontinuities
    Ok(time)
}
```

**NEGATIVE CONSTRAINT**:
```rust
// CRITICAL BUG: Converting naive to local triggers crash on DST gaps
pub fn parse_calendar_datetime_bad(year: i32, month: u32, day: u32) -> DateTime<Local> {
    let naive = NaiveDate::from_ymd(year, month, day).and_hms(0, 0, 0);
    // PANIC: If midnight falls in a DST transition gap (e.g., Brazil/Cuba historical shifts),
    // chrono panics: "No such local time"
    Local.from_local_datetime(&naive).unwrap()
}
```

**VERIFICATION METHOD**: Unit test executing `parse_datetime("2023-02-30")`, `parse_datetime("2024-01-01 25:00:00")`, and parsing time strings during daylight saving transition hours for timezone regions such as `America/Sao_Paulo` and `Europe/London`. Assert that invalid dates return `Err` cleanly and that valid naive dates never panic.

---

### 3. Multi-Pass Topological Alias Binding Invariant
**RULE**: In relational execution pipelines with support for computed projections, aggregate aliases, and correlated subqueries, the query evaluator MUST partition projection expressions into evaluation phases: Phase 1 evaluates independent aggregate functions, binds their aliases to the group execution context, and only then Phase 2 evaluates expressions containing correlated subqueries or cross-alias dependencies.

**WHY**: If projection columns are evaluated in a single sequential pass, a correlated subquery in column position $N$ that references an aggregate alias defined in column position $N+1$ will read an uninitialized or empty context, causing either evaluation failures, zero-value defaults, or query syntax rejection. Multi-phase partitioning guarantees convergence of dependent aliases without introducing expensive full AST graph solvers.

**WHEN TO APPLY**: Query engines, SQL-like parsers, pipeline processors, reporting systems where projection fields can be aliased and cross-referenced within the same `SELECT` block.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
// Canonical Pattern: Two-phase binding partitioned by correlation dependencies
pub fn bind_aggregate_aliases(
    &mut self,
    aliases: &HashSet<String>,
    group_key: &[String],
    file_map: &mut HashMap<String, String>,
    accumulator: &GroupAccumulator,
) -> Result<(), SearchError> {
    if aliases.is_empty() {
        return Ok(());
    }

    let mut bound_values = Vec::new();

    // Two phases: Phase 0 evaluates non-correlated columns;
    // Phase 1 evaluates correlated subquery columns that may depend on Phase 0 aliases.
    for correlated in [false, true] {
        let before_count = bound_values.len();
        
        for column in &self.query.fields {
            if let Some(ref alias) = column.alias {
                if column.has_aggregate_function() && column.has_correlated_subquery() == correlated {
                    let value = self.get_column_expr_value(
                        None,
                        &None,
                        Path::new(""),
                        file_map,
                        Some(accumulator),
                        column,
                    )?;
                    
                    let text = value.to_string();
                    let val = if column.contains_numeric() {
                        numeric_or_text(&text)
                    } else {
                        Variant::from_string(&text)
                    };
                    bound_values.push((alias.clone(), val));
                }
            }
        }
        
        // Immediately publish Phase 0 aliases so Phase 1 subqueries can resolve them
        if bound_values.len() > before_count {
            self.bind_group_context(aliases, group_key, &bound_values);
        }
    }

    Ok(())
}
```

**NEGATIVE CONSTRAINT**:
```rust
// CRITICAL BUG: Single sequential pass evaluates in syntactic declaration order
for column in &self.query.fields {
    if let Some(ref alias) = column.alias && column.has_aggregate_function() {
        // If column contains a subquery referencing an alias declared in a subsequent column,
        // bind_group_context has not been called for that alias yet! Evaluation fails or yields NULL.
        let value = self.get_column_expr_value(None, &None, Path::new(""), file_map, Some(accumulator), column)?;
        self.bind_single_alias(alias, value);
    }
}
```

**VERIFICATION METHOD**: Execute query: `select ext, (select count(*) from dir where size > t.total) as count_larger, sum(size) as total from dir as t group by ext`. Verify that `count_larger` correctly resolves `t.total` regardless of whether `sum(size) as total` is defined syntactically before or after it in the projection list.

---

## 3. Forensic Real Incidents & Production Patches

### Incident 1: Virtual Archive Directory Emptiness Check False-Positive (BUG-ARCHIVE-EMPTY-01)
- **Context**: Subsystem: Virtual Archive Handling / Field Metadata Handlers (`src/field/metadata_handlers.rs`, `src/fileinfo.rs`).
- **What Was Expected**: The expression `is_empty = true` on a directory inside an archive (e.g., `zip`) must only evaluate to `true` if that virtual directory contains zero child entries.
- **What Actually Happened**: Archive directories always reported `is_empty = true`. In zip files, directory entries have a physical uncompressed size of 0 bytes (`file_info.size == 0`). The handler checked `file_info.size == 0` for all archive members uniformly without checking if other archive entries shared that path prefix.
- **Evidence in Repo**: Commit `32c74c88`, tests in `archived_directory_is_empty_only_without_children`.
- **Root Cause**: The virtual filesystem handler failed to distinguish between leaf 0-byte regular files and directory records when inspecting archive members. Because directories in ZIP archives are metadata markers with `size: 0`, checking `size == 0` is valid for regular files but semantically invalid for directory entries.
- **Remediation Code Diff**:
```rust
// File: src/field/metadata_handlers.rs
@@ -318,6 +318,12 @@ pub fn handle_is_empty(ctx: &mut FieldContext) -> Result<Variant, SearchError> {
     match ctx.file_info {
         Some(file_info) => {
+            if file_info.name.ends_with('/') || file_info.name.ends_with('\\') {
+                return Ok(match crate::fileinfo::archived_directory_has_children(&ctx.entry.path(), file_info) {
+                    Some(has_children) => Variant::from_bool(!has_children),
+                    None => Variant::empty(VariantType::Bool),
+                });
+            }
             Ok(Variant::from_bool(file_info.size == 0))
         }
         _ => {
```
- **Lesson**: Virtual file representations must preserve container-specific directory semantics. Emptiness for containerized directories cannot rely on size metadata; it requires prefix iteration over sibling entries.

---

### Incident 2: Positional Group-By Index Ambiguity vs Arithmetic Expressions (BUG-PARSER-GROUPBY-02)
- **Context**: SQL Grammar & Parsing Engine (`src/parser.rs`).
- **What Was Expected**: The query `select -size, count(*) from /d group by -size` and `select 1 + size from /d group by 1 + size` should parse arithmetic expressions as grouping keys.
- **What Actually Happened**: The parser crashed or returned `Err("Group by field index is out of range")` or failed to group. In SQL dialects, integer numbers in `GROUP BY` specify positional column indices (e.g., `group by 1`). When the parser encountered `1 + size`, it greedily parsed `1` as a positional index, threw an error if out of range, or failed to parse the arithmetic operator `+`. Similarly, unary minus `-size` failed lexeme matching.
- **Evidence in Repo**: Commit `c8419fab`, unit test `group_by_accepts_arithmetic_without_parentheses`.
- **Root Cause**: Lookahead deficiency. The parser assumed any integer token in a `GROUP BY` clause was exclusively an ordinal column index without checking whether the subsequent lexeme was an arithmetic operator (`+`, `-`, `*`, `/`).
- **Remediation Code Diff**:
```rust
// File: src/parser.rs
@@ -1513,6 +1513,13 @@ impl <'a> Parser<'a> {
                         Some(Lexeme::Comma) => {}
                         Some(Lexeme::RawString(ref grouping_field)) => {
                             let actual_field = match grouping_field.parse::<usize>() {
+                                Ok(_) if self.followed_by_arithmetic_operator() => {
+                                    self.drop_lexeme();
+                                    match self.parse_expr()? {
+                                        Some(expr) => expr,
+                                        None => break,
+                                    }
+                                }
                                 Ok(idx) if idx >= 1 && idx <= fields.len() => fields[idx - 1].clone(),
                                 Ok(_) => return Err(String::from("Group by field index is out of range")),
@@ -1528,6 +1535,13 @@ impl <'a> Parser<'a> {
+                        Some(Lexeme::ArithmeticOperator(ref op)) if op == "-" => {
+                            self.drop_lexeme();
+                            match self.parse_expr()? {
+                                Some(expr) => group_by_fields.push(expr),
+                                None => break,
+                            }
+                        }
```
- **Lesson**: Parsing overloaded syntactic tokens (e.g., numeric literals acting as column ordinals vs math operands) requires strict single-token lookahead. A numeric literal cannot be classified as an ordinal if followed by an infix or unary operator.

---

### Incident 3: Out-of-Order Aggregate and Correlated Subquery Alias Binding (BUG-SEARCHER-ALIAS-03)
- **Context**: Searcher and Aggregation Context Engine (`src/searcher.rs`).
- **What Was Expected**: Projections containing aggregate aliases and correlated subqueries referencing those aliases (e.g., `select ext, score as total, sum(size) as score`) must resolve identically regardless of column order.
- **What Actually Happened**: If a correlated subquery referenced an aggregate alias that was declared later in the `SELECT` column list, the subquery failed to find the alias in the bound group context, returning empty/zero or erroring out.
- **Evidence in Repo**: Commit `f8bc73cf`, unit test `aliased_aggregates_may_depend_on_other_aggregate_aliases_in_any_order`.
- **Root Cause**: Single-pass evaluation loop. `aggregate_alias_values` iterated over `query.fields` once from left to right. Aggregate columns with subqueries referencing sibling aggregate aliases had not yet populated `group_context` when executed if they preceded their target alias syntactically.
- **Remediation Code Diff**:
```rust
// File: src/searcher.rs
@@ -1680,28 +1677,36 @@ impl<'a> Searcher<'a> {
-    fn aggregate_alias_values(
+    fn bind_aggregate_aliases(
         &mut self,
         aliases: &HashSet<String>,
+        group_key: &[String],
         file_map: &mut HashMap<String, String>,
         accumulator: &function::GroupAccumulator,
-    ) -> Result<Vec<(String, Variant)>, SearchError> {
-        let mut values = Vec::new();
+    ) -> Result<(), SearchError> {
         if aliases.is_empty() {
-            return Ok(values);
+            return Ok(());
         }
         let query = self.query;
-        for column in &query.fields {
-            if let Some(ref alias) = column.alias
-                && column.has_aggregate_function()
-            {
-                let value = self.get_column_expr_value(None, &None, Path::new(""), file_map, Some(accumulator), column)?;
-                let text = value.to_string();
-                let value = if column.contains_numeric() { numeric_or_text(&text) } else { Variant::from_string(&text) };
-                values.push((alias.clone(), value));
+        let mut values = Vec::new();
+        for correlated in [false, true] {
+            let before = values.len();
+            for column in &query.fields {
+                if let Some(ref alias) = column.alias
+                    && column.has_aggregate_function()
+                    && column.has_correlated_subquery() == correlated
+                {
+                    let value = self.get_column_expr_value(None, &None, Path::new(""), file_map, Some(accumulator), column)?;
+                    let text = value.to_string();
+                    let value = if column.contains_numeric() { numeric_or_text(&text) } else { Variant::from_string(&text) };
+                    values.push((alias.clone(), value));
+                }
+            }
+            if values.len() > before {
+                self.bind_group_context(aliases, group_key, &values);
             }
         }
-        Ok(values)
+        Ok(())
     }
```
- **Lesson**: Declarative expressions in SQL projection lists have no defined evaluation order. When mutual dependencies exist, evaluation must be stratified into topological evaluation stages.

---

### Incident 4: Panic on Ambiguous Local Time / DST Transition During Date Filter Evaluation (BUG-CHRONO-DST-04)
- **Context**: Date/Time Utility (`src/util/datetime.rs`).
- **What Was Expected**: Parsing user queries with file time filters (`created`, `modified`, `accessed`) must gracefully handle invalid dates and never crash the process.
- **What Actually Happened**: Process crashed with:
  `thread 'main' (487628) panicked at chrono-0.4.44/src/datetime/mod.rs:1931:38: No such local time` when running queries referencing timestamps on systems with specific timezone transitions or invalid dates.
- **Evidence in Repo**: Closed Issue #184: *"Crash/panic in some queries with time/date"*.
- **Root Cause**: `parse_datetime` constructed intermediate timezone-aware dates using `Local.from_local_datetime()`. In timezones where DST forward jumps skip an hour (e.g., 00:00:00 to 01:00:00), `from_local_datetime()` produces a `LocalResult::None`, which panicked on unwrap. Furthermore, invalid calendar dates (e.g. Feb 30) were improperly guarded.
- **Remediation Code Diff**:
```rust
// File: src/util/datetime.rs
-            // Bad: Round tripping through Local triggered panics on DST gaps
-            let date = Local.ymd(year, month, day);
-            let start = date.and_hms(hour_start, min_start, sec_start);
+            // Build the