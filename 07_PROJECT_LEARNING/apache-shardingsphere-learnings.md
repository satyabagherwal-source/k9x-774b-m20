> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/apache-shardingsphere-learnings.md`  
> **Source**: github ([https://github.com/apache/shardingsphere](https://github.com/apache/shardingsphere))  
> **Source Version**: `4236a423`  
> **License**: Apache-2.0  
> **Synthesized By**: google-gemini-cloud-agent  
> **Timestamp**: 2026-10-25T02:58:25.167Z  
> **Learning ID**: `learn-github-apache-shardingsphere`  
> **Pipeline Version**: `2.0.0`  
> **Status**: VERIFIED_EMPIRICAL_INTELLIGENCE  
> **Data Governance**: CLASSIFICATION: PUBLIC. Sanitized against PII/secrets.  
> **Policy Invariant**: Strictly for engineering retrieval and architecture documentation. Distillation prohibited.  

---

# Project Learning Record (Full-Spectrum Forensic Harvest): apache/shardingsphere

---

## 1. Executive Forensic Architecture & System Mechanics

### Exact Technical Problem Solved
Apache ShardingSphere solves the problem of transforming disparate, heterogeneous relational databases (MySQL, PostgreSQL, SQL Server, Oracle, Doris, openGauss) into a horizontally scalable, unified distributed database system. It provides database clustering, transparent sharding, read-write splitting, distributed transactions (XA, Saga), data encryption at rest and in transit, and live data migration/CDC (Change Data Capture) pipelines while maintaining complete SQL dialect compatibility and wire-protocol transparency.

### Architectural Boundaries & State Ownership
ShardingSphere operates across two primary topologies with identical kernel abstractions:
1. **ShardingSphere-JDBC**: A lightweight, zero-overhead Java client framework packaged as a JAR driver that intercepts application JDBC calls directly inside the client process.
2. **ShardingSphere-Proxy**: An independent, transparent database gateway running on dedicated nodes that implements the native MySQL/PostgreSQL network protocol engines, terminating database client connections and proxying queries to upstream physical storage nodes.

```
                    +----------------------------------------------+
                    | Client Application (JDBC / MySQL / PG wire)  |
                    +----------------------------------------------+
                                          |
                                          v
+------------------------------------------------------------------------------------+
| ShardingSphere Kernel                                                               |
|                                                                                    |
|  [SQL Parser Engine] (Dialect ANTLR4 Grammars -> AST -> SQLStatement)              |
|           |                                                                        |
|           v                                                                        |
|  [SQL Binder Engine] (Metadata Linking, Qualified Table/Column Resolution)          |
|           |                                                                        |
|           v                                                                        |
|  [SQL Router Engine] (ShardingCondition / KeyGenerator -> RouteUnits)              |
|           |                                                                        |
|           v                                                                        |
|  [SQL Rewriter Engine] (Logical-to-Physical SQL Token Rewriting, Cipher Text)      |
|           |                                                                        |
|           v                                                                        |
|  [Execution Engine] (Push-down Parallel Executor, Connection Balancing)            |
|           |                                                                        |
|           v                                                                        |
|  [Result Merger Engine] (Streaming / In-memory / Group By / Order By Aggregator)   |
+------------------------------------------------------------------------------------+
       |                           |                           |
       v                           v                           v
 [Physical MySQL]           [Physical PG]              [Physical Storage]
```

### Critical Subsystem Abstractions
- **SQL Parser Engine (`parser/sql/engine`)**: Translates raw SQL strings into abstract syntax trees (AST) using ANTLR4 grammar specifications partitioned by dialect (`BaseRule.g4`). Implements operator precedence hierarchies, dialect-specific keywords, and AST node visitors.
- **Data Pipeline Engine (`kernel/data-pipeline`)**: Handles continuous database replication, schema migration, inventory data loading, and incremental CDC streaming. Generates dialect DDL and metadata extraction scripts dynamically via FreeMarker template matrixes (`template/component/table/{version}/`).
- **Autonomous Governance & Test Harness (`.codex/*`)**: An autonomous deterministic harness executing policy canaries, git worktree isolation, test generation boundaries (`guard_task_scope.py`), review ledgers (`manage_review_ledger.py`), and non-code AST masking (`scan_quality_rules.py`).

---

## 2. Net-New Universal Engineering Rules (Candidates for Master Brain)

### 1. Grammatical Rule Precedence Stratification In Left-Recursive Parsers
**RULE**:
Grammar engineers MUST explicitly declare binary and bitwise expression rules in strict order of descending precedence using individual, tiered left-recursive productions rather than grouping distinct operator families into single or arbitrary non-precedent production chains.

**WHY**:
In grammar parsers supporting direct left-recursion (such as ANTLR4), rule alternative sequence defines syntactic operator precedence. Grouping heterogeneous operators (such as bitwise `|`, `&`, shift `<<`, addition `+`, and multiplication `*`) into unordered or flat alternatives causes the parser to assign associative priority based solely on order of appearance or branch flattening. In SQL expressions, this causes mathematical expressions such as `a + b * c` or `size / 128.0 - CAST(...)` to be parsed with right-associative or equal priority (e.g., parsing as `(a + b) * c` or `size / (128.0 - CAST(...))`), generating invalid AST branches that corrupt distributed SQL rewriting, routing, and execution.

**WHEN TO APPLY**:
Apply when writing or modifying ANTLR, Bison, PEG, or custom AST parsers for SQL dialects, expression languages, query builders, or programming language engines.

**VERIFIED IMPLEMENTATION PATTERN**:
```antlr
// ANTLR4: Strict tiered precedence ordering (highest to lowest)
bitExpr
    : bitExpr CARET_ bitExpr
    | bitExpr (ASTERISK_ | SLASH_ | DIV | MOD | MOD_) bitExpr
    | bitExpr (PLUS_ | MINUS_) bitExpr
    | bitExpr (PLUS_ | MINUS_) intervalExpression
    | bitExpr (SIGNED_LEFT_SHIFT_ | SIGNED_RIGHT_SHIFT_) bitExpr
    | bitExpr AMPERSAND_ bitExpr
    | bitExpr VERTICAL_BAR_ bitExpr
    | simpleExpr
    ;
```

**NEGATIVE CONSTRAINT**:
```antlr
// ANTI-PATTERN: Arbitrary or flat precedence mixing bitwise and arithmetic operations
bitExpr
    : bitExpr VERTICAL_BAR_ bitExpr
    | bitExpr AMPERSAND_ bitExpr
    | bitExpr PLUS_ bitExpr
    | bitExpr ASTERISK_ bitExpr   // FAILS: Multiplicative operators evaluate AFTER bitwise OR
    | simpleExpr
    ;
```

**VERIFICATION METHOD**:
Enforce AST validation tests via XML expression definitions covering operator combinations without parentheses (e.g., `SELECT * FROM t WHERE a + b * c = d`, verifying `<left>` is `a` and `<right>` is a nested binary operation of `b * c`).

---

### 2. Upstream Database Catalog Deprecation Immunity
**RULE**:
Database metadata retrieval engines MUST query catalog columns by capability discovery or explicit minimum schema contracts, and MUST NOT depend on deprecated database system boundary columns (e.g., PostgreSQL `pg_database.datlastsysoid`) for system vs. user object demarcation across major engine versions.

**WHY**:
Relational database systems retire internal catalog columns across major version releases. In PostgreSQL 15+, the column `datlastsysoid` was completely removed from `pg_database` because fixed system OID allocations replaced dynamic OID allocation tracking. Querying `datlastsysoid` produces fatal SQL exceptions (`ERROR: column "datlastsysoid" does not exist`), completely breaking metadata loading, schema replication, and pipeline synchronization.

**WHEN TO APPLY**:
Apply to any data pipeline, migration framework, CDC tool, ORM reverse engineering module, or database administration tool querying system catalogs across multiple major versions of database engines.

**VERIFIED IMPLEMENTATION PATTERN**:
```sql
-- Safe, version-resilient catalog query without deprecated boundary OIDs
SELECT oid AS did 
FROM pg_catalog.pg_database 
WHERE datname = '${databaseName}';
```
```freemarker
<#-- Template avoids referencing unneeded internal catalog boundary variables -->
typ.typrelid AS typoid, rel.relrowsecurity AS rlspolicy, rel.relforcerowsecurity AS forcerlspolicy,
(CASE WHEN rel.reltoastrelid = 0 THEN false ELSE true END) AS hastoasttable,
(SELECT pg_catalog.array_agg(provider || '=' || label) FROM pg_catalog.pg_seclabels sl1 WHERE sl1.objoid=rel.oid AND sl1.objsubid=0) AS seclabels
<#if tid?? >, (CASE WHEN rel.relkind = 'p' THEN pg_catalog.pg_get_partkeydef(${ tid?c }::oid) ELSE '' END) AS partition_scheme </#if>
FROM pg_catalog.pg_class rel
```

**NEGATIVE CONSTRAINT**:
```sql
-- ANTI-PATTERN: Coupling schema catalog extraction to removed system catalog OID pointers
SELECT oid AS did, datlastsysoid FROM pg_catalog.pg_database WHERE datname = '${databaseName}';
-- Fails with: org.postgresql.util.PSQLException: ERROR: column "datlastsysoid" does not exist on PostgreSQL >= 15
```

**VERIFICATION METHOD**:
Implement parameterized unit and integration tests executing schema loading against a version array spanning historical to modern major releases (e.g., PostgreSQL 9, 10, 11, 12, 14, 15, 16, 17) verifying uniform property extraction.

---

### 3. Non-Destructive In-Place Lexical Non-Code Masking
**RULE**:
When running static analysis, quality rule enforcement, or structural regex extraction on source code files, analysis engines MUST mask comments and string/text literals by replacing their character spans with whitespace of identical byte/character length, and MUST NOT delete tokens or alter byte offsets.

**WHY**:
Downstream parsing tools, diagnostic scanners, and report generators associate findings with exact file line numbers, column offsets, and matching byte positions. Deleting or compacting comments, block quotes, or strings alters line numbers and string indexes, causing diagnostic reports to point to incorrect lines, breaking automated regression patching, and producing false positives when tokens inside comments/literals mimic structural code patterns.

**WHEN TO APPLY**:
Apply when writing custom linters, regex-based code analysis scripts, static security scanners, or pre-commit policy hooks.

**VERIFIED IMPLEMENTATION PATTERN**:
```python
def mask_java_non_code(source: str, mask_literals: bool) -> str:
    result = list(source)
    index = 0
    state = "code"
    while index < len(source):
        if state == "line-comment":
            if source[index] == "\n":
                state = "code"
            else:
                result[index] = " "  # Preserve exact newline structure and length
            index += 1
            continue
        if state == "block-comment":
            if source.startswith("*/", index):
                result[index:index + 2] = [" ", " "]
                index += 2
                state = "code"
            else:
                if source[index] != "\n":
                    result[index] = " "
                index += 1
            continue
        if source.startswith("//", index):
            result[index:index + 2] = [" ", " "]
            index += 2
            state = "line-comment"
        elif source.startswith("/*", index):
            result[index:index + 2] = [" ", " "]
            index += 2
            state = "block-comment"
        else:
            index += 1
    return "".join(result)
```

**NEGATIVE CONSTRAINT**:
```python
# ANTI-PATTERN: Stripping comments using re.sub deletes lines and breaks AST line offsets
def strip_comments_bad(source: str) -> str:
    # Destroys line count and corrupts diagnostic line mappings
    return re.sub(r"/\*[\s\S]*?\*/|//.*", "", source)
```

**VERIFICATION METHOD**:
Assert that `len(mask_java_non_code(s, True)) == len(s)` and `source.count('\n') == mask_java_non_code(source, True).count('\n')` across all test fixtures.

---

## 3. Forensic Real Incidents & Production Patches

### Incident 1: SQL Arithmetic & Bitwise Operator Precedence Inversion (BUG-SHARDINGSPHERE-01)
- **Context**: SQL Parser Dialect Engine: `doris`, `mysql`, and `sqlserver` ANTLR4 grammar rule files (`BaseRule.g4`).
- **What Was Expected**: Standard SQL operator precedence requires multiplication, division, and modulo (`*`, `/`, `DIV`, `%`) to bind tighter than addition and subtraction (`+`, `-`), which in turn bind tighter than bit-shift (`<<`, `>>`), bitwise AND (`&`), bitwise OR (`|`), and bitwise XOR (`^`).
- **What Actually Happened**: The grammar defined `VERTICAL_BAR_` (`|`) at the top of the `bitExpr` rule, followed arbitrarily by shifts and arithmetic operators without precedence tiers. In SQL queries involving arithmetic expressions (e.g., `size / 128.0 - CAST(...)`), division and subtraction were evaluated with reversed or equal precedence, creating corrupted AST structures where binary operations were grouped as `size / (128.0 - CAST)`.
- **Evidence in Repo**: Commit `4236a423`, PR `#40353`. Fixed in `doris/BaseRule.g4`, `mysql/BaseRule.g4`, `sqlserver/BaseRule.g4`, and verified in `case/dml/select.xml`.
- **Root Cause**: ANTLR4 assigns precedence to left-recursive alternatives based on their declaration order. The grammar placed `VERTICAL_BAR_` as the first alternative, and grouped `PLUS_`, `MINUS_`, `ASTERISK_`, `SLASH_`, and `DIV` haphazardly without stratified rule tiers.
- **Remediation Code Diff**:
```antlr
 bitExpr
-    : bitExpr VERTICAL_BAR_ bitExpr
+    : bitExpr CARET_ bitExpr
+    | bitExpr (ASTERISK_ | SLASH_ | DIV | MOD | MOD_) bitExpr
+    | bitExpr (PLUS_ | MINUS_) bitExpr
+    | bitExpr (PLUS_ | MINUS_) intervalExpression
+    | bitExpr (SIGNED_LEFT_SHIFT_ | SIGNED_RIGHT_SHIFT_) bitExpr
     | bitExpr AMPERSAND_ bitExpr
-    | bitExpr PLUS_ bitExpr
-    | bitExpr MINUS_ bitExpr
-    | bitExpr ASTERISK_ bitExpr
-    | bitExpr SLASH_ bitExpr
+    | bitExpr VERTICAL_BAR_ bitExpr
     | simpleExpr
     ;
```
- **Lesson**: Never define binary operators with different precedence in the same ANTLR4 rule alternative or in reverse hierarchy. Every precedence level requires its own alternative block ordered from highest binding strength to lowest.

---

### Incident 2: PostgreSQL 15+ Pipeline Metadata Catalog Failure (BUG-SHARDINGSPHERE-02)
- **Context**: `kernel/data-pipeline/dialect/postgresql/src/main/resources/template/component/table/` FreeMarker templates.
- **What Was Expected**: The PostgreSQL table property loader must load database and table metadata consistently across PostgreSQL versions 9.x through 17.x.
- **What Actually Happened**: On PostgreSQL 15+, initiating a migration pipeline caused a metadata query failure because the template queried `datlastsysoid` from `pg_catalog.pg_database`. PostgreSQL 15 removed this column from the system catalog entirely.
- **Evidence in Repo**: Commit `3cbeeeb1`, Issue `#40363`. Fixed in `get_database_id.ftl`, `10_plus/properties.ftl`, `11_plus/properties.ftl`, `12_plus/properties.ftl`, `default/properties.ftl`.
- **Root Cause**: The data pipeline queried `SELECT oid AS did, datlastsysoid FROM pg_catalog.pg_database` and used `datlastsysoid` in a comparison `(CASE WHEN rel.oid <= ${datlastsysoid?c}::oid THEN true ELSE false END) AS is_sys_table` to check if a table belonged to the system catalog. PostgreSQL eliminated OID-based system table identification in favor of namespace schema checks (`pg_namespace`).
- **Remediation Code Diff**:
```sql
--- a/kernel/data-pipeline/dialect/postgresql/src/main/resources/template/component/table/default/get_database_id.ftl
+++ b/kernel/data-pipeline/dialect/postgresql/src/main/resources/template/component/table/default/get_database_id.ftl
-SELECT oid AS did, datlastsysoid FROM pg_catalog.pg_database WHERE datname = '${databaseName}';
+SELECT oid AS did FROM pg_catalog.pg_database WHERE datname = '${databaseName}';

--- a/kernel/data-pipeline/dialect/postgresql/src/main/resources/template/component/table/12_plus/properties.ftl
+++ b/kernel/data-pipeline/dialect/postgresql/src/main/resources/template/component/table/12_plus/properties.ftl
-(SELECT pg_catalog.array_agg(provider || '=' || label) FROM pg_catalog.pg_seclabels sl1 WHERE sl1.objoid=rel.oid AND sl1.objsubid=0) AS seclabels,
-(CASE WHEN rel.oid <= ${ datlastsysoid?c}::oid THEN true ElSE false END) AS is_sys_table
+(SELECT pg_catalog.array_agg(provider || '=' || label) FROM pg_catalog.pg_seclabels sl1 WHERE sl1.objoid=rel.oid AND sl1.objsubid=0) AS seclabels
```
- **Lesson**: Do not query deprecated metadata columns when determining system vs. user objects. Rely on standard schema namespace checks (`nspname NOT IN ('pg_catalog', 'information_schema')`).

---

### Incident 3: Naive Semicolon Splitting of PostgreSQL DDL Scripts (BUG-SHARDINGSPHERE-03)
- **Context**: `kernel/data-pipeline/dialect/postgresql/src/main/java/.../PostgreSQLPipelineSQLBuilder.java`.
- **What Was Expected**: Executing multi-statement DDL scripts during pipeline table migration must split individual statements cleanly without fragmenting stored procedures, triggers, quoted strings, dollar-quoted blocks (`$$ ... $$`), or comments containing semicolons.
- **What Actually Happened**: Naive string tokenization or standard regex splitting on `;` broke complex DDL blocks, splitting PL/pgSQL function definitions and triggers containing internal semicolons into syntactically invalid SQL fragments.
- **Evidence in Repo**: Issue `#40362`. Fixed in `PostgreSQLPipelineSQLBuilder.java` lines 123–139; regression tests in `PostgreSQLPipelineSQLBuilderTest.java`.
- **Root Cause**: SQL scripts cannot be decomposed using delimiter string tokenization (`String.split(";")`) because semicolons are valid within literals, block comments, and dollar-quoted procedure declarations.
- **Remediation Code Pattern**:
```java
// Production Pattern: Using Lexer-driven token stream to split DDL statements
public List<String> splitSQLByLexer(final String sql, final DatabaseType databaseType) {
    List<String> result = new LinkedList<>();
    SQLLexer lexer = DatabaseTypedSPILoader.getService(SQLLexerFactory.class, databaseType).createLexer(sql);
    int lastStartIndex = 0;
    while (!lexer.isEOF()) {
        Token token = lexer.nextToken();
        if (TokenType.SEMI == token.getType()) {
            String statement = sql.substring(lastStartIndex, token.getStopIndex() + 1).trim();
            if (!statement.isEmpty() && !";".equals(statement)) {
                result.add(statement);
            }
            lastStartIndex = token.getStopIndex() + 1;
        }
    }
    // Handle trailing statement without terminating semicolon
    if (lastStartIndex < sql.length()) {
        String remaining = sql.substring(lastStartIndex).trim();
        if (!remaining.isEmpty()) {
            result.add(remaining);
        }
    }
    return result;
}
```
- **Lesson**: Never parse or split database DDL scripts using delimiter string splits or regular expressions. Always tokenize using the target dialect's native lexical analyzer.

---

### Incident 4: Automated Test Generation Out-of-Scope Mutation Bleed (BUG-SHARDINGSPHERE-04)
- **Context**: `.codex/skills/gen-ut/scripts/guard_task_scope.py`.
- **What Was Expected**: Automated test generation scripts (`gen-ut`) must strictly isolate modifications to target unit test files (`src/test/java/`, `src/test/resources/`), refusing to run or fail-safe halting if any production code or out-of-scope worktree files are modified.
- **What Actually Happened**: Stray files, build artifacts (such as Maven `target/` directories and Python `__pycache__` directories), and untracked changes were causing false-positive policy rejections or uncommitted mutation bleed across repositories.
- **Evidence in Repo**: Commit `f4acdb6e`, `guard_task_scope.py`, `test_guard_task_scope.py`.
- **Root Cause**: The scope guard failed to differentiate between reproducible build verification output (e.g., Maven test compilation artifacts) and actual out-of-scope code file modifications.
- **Remediation Code Diff**:
```python
 def is_reproducible_verification_output(repo_root: Path, path: str, status: str, module_cache: dict[Path, bool]) -> bool:
     if status not in ("??", "!!"):
         return False
     relative_path = Path(path)
     python_cache = PYTHON_CACHE_DIRECTORY in relative_path.parts and relative_path.suffix in PYTHON_CACHE_SUFFIXES
     return python_cache or is_maven_target_output(repo_root, relative_path, module_cache)
```
- **Lesson**: Boundary integrity verification must explicitly filter ephemeral target artifacts produced by test runners while strictly hashing all tracked and untracked repository source files.

---

### Incident 5: Flaky Test Harness JSON Schema and Ordering Drift (BUG-SHARDINGSPHERE-05)
- **Context**: `.codex/skills/gen-ut/tests/test_scan_quality_rules.py`.
- **What Was Expected**: Automated unit tests checking static rule scanners must verify structural results without depending on dictionary key ordering or raw string formatting of serialized JSON outputs.
- **What Actually Happened**: Tests failed across different platforms or Python versions due to asserting exact string dumps and list conversions of dictionary keys (`list(result)` vs `set(result)`), creating flaky CI assertions.
- **Evidence in Repo**: Commit `f4acdb6e`.
- **Root Cause**: Checking `self.assertEqual(["candidates", "java_file_count", "reviews", "rules"], list(result))` asserted an un-guaranteed insertion ordering in dictionaries, while comparing formatted JSON strings (`json.dumps(...) + "\n"`) introduced formatting brittle failures.
- **Remediation Code Diff**:
```python
-        self.assertEqual(["candidates", "java_file_count", "reviews", "rules"], list(result))
-        self.assertEqual(["R15-C", "R15-J"], list(result["rules"]))
+        self.assertEqual({"candidates", "java_file_count", "reviews", "rules"}, set(result))
+        self.assertEqual({"R15-C", "R15-J"}, set(result["rules"]))
...
-        self.assertEqual(json.dumps(result, indent=2, sort_keys=True) + "\n", stdout.getvalue())
```
- **Lesson**: Always assert sets rather than ordered lists when validating dictionary keys, and deserialize serialized payloads to structural representations before asserting equivalence.

---

## 4. Microscopic Code-Level Invariants

### 1. Micro-Syntax & Token-Level Precision
- **FreeMarker Integer Casting (`?c`) Invariant**: In FreeMarker SQL templates, every numeric identifier, schema ID (`scid`), or OID (`datlastsysoid`) passed into an interpolated SQL query MUST use the `?c` built-in modifier (computer format, e.g., `${scid?c}::oid`). Omitting `?c` causes FreeMarker to format integers according to runtime locale groupings (e.g., rendering `1000` as `1,000`), immediately producing a SQL syntax error in the database catalog query.
- **Surrogate Escape Git Decoding**: When processing raw byte streams from Git (`git status --porcelain -z`), path strings containing non-ASCII characters or invalid UTF-8 sequences MUST be decoded with `errors="surrogateescape"`. Using standard `utf-8` decoding with default `strict` causes fatal `UnicodeDecodeError` crashes on filenames containing non-standard byte sequences.
```python
# Exact token-level invariant for zero-defect Git porcelain parsing
path = record[3:].decode("utf-8", errors="surrogateescape")
```

### 2. Infinite Loop & Recursion Guards
- **Balanced Bracket Parsing Termination Proof**: In structural source analyzers (`scan_quality_rules.py`), parsing nested method blocks using opening and closing braces MUST maintain a depth counter that decrements upon `}` and terminates immediately at `depth == 0`. The loop termination condition MUST strictly combine length bounds (`index < len(text)`) with depth checks:
```python
def extract_block(text: str, brace_index: int) -> str:
    depth = 0
    index = brace_index
    # Loop Termination Invariant: index strictly increments; bounded by len(text)
    while index < len(text):
        if "{" == text[index]:
            depth += 1
        elif "}" == text[index]:
            depth -= 1
            if 0 == depth:
                return text[brace_index + 1:index]
        index += 1
    return ""  # Unterminated block safe return
```
- **Path Traversal Escape Invariant**: Path resolution MUST ensure target child paths do not escape the repository boundary. When resolving candidate test paths:
```python
# Absolute verification that path is strictly a descendant of repo_root
resolved = (repo_root / each).resolve() if not each.is_absolute() else each.resolve()
try:
    relative = resolved.relative_to(repo_root)
except ValueError as ex:
    raise ValueError(f"path is outside repository: {resolved}") from ex
```

### 3. UI & UX Micro-Mechanics (CLI & Review Ledger UI Mechanics)
- **High-Output Wrap Protection**: When executing agent tools and test runners that generate megabytes of console output, the system enforces `wrap_high_output` to prevent terminal buffer exhaustion and token-budget collapse.
- **Atomic File Replacement**: File-based review ledgers and cache states write to a `.tmp` file and invoke `os.replace` (POSIX atomic swap) to prevent partial reads or corrupt UI state displays during concurrent access.

### 4. Backend Concurrency & Memory Safety
- **TOCTOU Symlink & Temp Hijacking Guards**: When establishing shared or temporary operational directories (e.g., `codex-review-pr` in `/tmp`), standard `os.makedirs` is vulnerable to Time-of-Check to Time-of-Use (TOCTOU) exploits if an unprivileged user creates a symlink at the target path beforehand. The ledger root enforces strict permission and ownership invariants:
```python
def ledger_root() -> Path:
    result = Path(tempfile.gettempdir()) / "codex-review-pr"
    if result.exists():
        if result.is_symlink() or not result.is_dir():
            raise RuntimeError(f"Invalid review ledger root: {result}")
        # Invariant: Owner MUST match current executing process UID
        if result.stat().st_uid != os.getuid():
            raise RuntimeError(f"Review ledger root has an unexpected owner: {result}")
    else:
        result.mkdir(mode=0o700)
    result.chmod(0o700)
    return result.resolve()
```
- **Exclusive Baseline File Creation**: Test baselines are written using `os.O_CREAT | os.O_EXCL` flags, guaranteeing that existing snapshots cannot be overwritten by parallel test runners.

### 5. Defect & Error Prevention ("Galti Pakadna")
- **Porcelain V1 Zero-Byte Null Parsing**: Splitting Git status output on standard newlines fails if filenames contain newline characters or spaces. Git status MUST run with `-z` (NUL-byte separated records). Furthermore, rename entries (`R`) and copy entries (`C`) emit two consecutive records (new path and old path). Parsing logic MUST check `status[0] in "RC"` and advance the index explicitly to prevent misaligning subsequent status flags:
```python
# Invariant: Explicit two-pointer consumption for rename/copy records
if ("R" in state or "C" in state) and index < len(records):
    original = records[index].decode("utf-8", errors="surrogateescape")
    index += 1
    result[original] = state
```

---

## 5. The 9 Deep Learning Dimensions

### 1. Architecture
ShardingSphere separates query coordination from physical database execution. It models distributed data as logical databases containing logical tables mapped to physical data sources and actual tables through rules (ShardingRule, ReadwriteSplittingRule, EncryptRule). Each subsystem is stateless, relying on Apache ZooKeeper or etcd for metadata synchronization and cluster state coordination.

### 2. Core Abstractions
- **`SQLStatement` & `SQLStatementContext`**: Represents dialect-specific parsed ASTs, decorated with contextual metadata (table bindings, projections, WHERE clause conditions).
- **`RouteContext` & `RouteUnit`**: Encapsulates the execution plan, mapping logical SQL to specific physical data source names and physical SQL statements.
- **`ExecutionEngine`**: Decouples execution planning from physical connection management using the connection-mode model (ConnectionStrictly vs MemoryStrictly).

### 3. Error Handling
ShardingSphere uses hierarchical error codes with standardized SQLStates (e.g., `XOpen` standard). When a physical data source fails during multi-shard distributed execution, the engine uses strict two-phase commit rollback mechanisms for XA transactions, or compensates via Saga engines, preventing partial distributed commits.

### 4. Testing
Uses a three-tier testing harness:
1. **Dialect Parser Test Suites**: XML-driven test fixtures (`insert.xml`, `select.xml`) verifying SQL text to AST structure down to column indices.
2. **Integration Test Matrix**: In-container execution of ShardingSphere-Proxy against live MySQL, PostgreSQL, and openGauss instances.
3. **Automated Unit Test Quality Shields**: Custom Python harnesses verifying that unit tests do not mutate production boundaries or invoke target public methods from test providers.

### 5. Security
- **Data Masking and Encryption Engine**: Intercepts column reads/writes to encrypt plaintext data into cipher columns and optional assisted-query columns (for equality searches) before dispatching to physical storage.
- **Harness Security**: Rigorous permission sandboxing (`0o700`), UID validation on temporary review ledgers, and protection against unauthorized external network egress.

### 6. Performance
- **SQL Parse Tree Caching**: Avoids recurring ANTLR4 parsing overhead by maintaining high-concurrency Guava/Caffeine AST parse caches keyed by SQL statement hash.
- **Streaming Result Sets**: When queries return millions of rows across shards, the Result Merger Engine streams rows from physical JDBC ResultSets using a PriorityQueue (min-max heap) for ordered queries without loading the entire result set into JVM memory.

### 7. Deployment
Deployable as an embedded client JAR (`shardingsphere-jdbc`) or a Dockerized container gateway (`shardingsphere-proxy`). Build pipelines use Apache Maven multi-module profiles, enforcing strict Checkstyle rules and SonarCloud quality gates.

### 8. Agent Patterns
Contains structured CODEX agent harnesses (`.codex/`):
- **Hook-driven Task Boundaries**: `code_handoff_hook.py` monitors shell tool executions, calculating pre- and post-tool repository tree hashes to prevent unauthorized file mutations.
- **Structured Ledgers**: Multi-pass code review state machines (`