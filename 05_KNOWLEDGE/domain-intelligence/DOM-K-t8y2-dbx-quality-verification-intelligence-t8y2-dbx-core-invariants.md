# Domain K — Quality & Verification Intelligence: Quality & Verification Intelligence: t8y2/dbx Core Invariants

<!-- PROVENANCE_START
{
  "source_repository": "t8y2/dbx",
  "source_url": "https://github.com/t8y2/dbx",
  "source_version": "cf1293f6",
  "license": "Apache-2.0",
  "timestamp": "2026-11-24T21:53:06.824Z",
  "ai_provider": "google-gemini-cloud-agent",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-t8y2-dbx",
  "canonical_classification": "domain_intelligence"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [t8y2/dbx](https://github.com/t8y2/dbx) (Revision: `cf1293f6`).  
> **License**: Apache-2.0 | **Timestamp**: `2026-11-24T21:53:06.824Z`  
> **Learning ID**: `learn-github-t8y2-dbx`


## 1. Domain Taxonomy & Context
- **Canonical Domain**: Domain K (Quality & Verification Intelligence)
- **Secondary Corroborating Domains**: H (Technical Construction Intelligence), G (Architecture Intelligence), M (Feedback & Evolution Intelligence), F (Design Intelligence), I (Content & Information Intelligence), D (Research & Knowledge Intelligence), B (Product Intelligence), A (Human & Need Intelligence), L (Deployment & Operations Intelligence)
- **Confidence Rating**: 55%

## 2. Core Domain Invariants & Discovered Laws
The following architectural invariants have been empirically discovered and recorded from t8y2/dbx:

# Project Learning Record (Full-Spectrum Forensic Harvest): t8y2/dbx

---

## 1. Executive Forensic Architecture & System Mechanics

### 1.1 Core Problem Statement & Decoupling Model
`t8y2/dbx` addresses the structural challenge of universal database administration across 100+ heterogeneous database engines (RDBMS, Time-Series, Document, Key-Value, Search) in an ultra-compact (~25 MB) desktop and server footprint. The architecture decouples the presentation engine (Tauri/Vue 3/TypeScript) from database protocol execution through an **Out-of-Process Polyglot Driver Agent RPC Protocol** combined with an **In-Process High-Throughput Rust Core**.

```
+---------------------------------------------------------------------------------------+
|                                    GUI / CLI / MCP LAYER                             |
|  Vue 3 + Tailwind + CodeMirror 6 + Tauri 2.x (Desktop)  |  CLI / Headless MCP Server  |
+-------------------------------------------+-------------------------------------------+
                                            | Tauri IPC / Stdout JSON-RPC 2.0
+-------------------------------------------v-------------------------------------------+
|                                     DBX RUST CORE ENGINE                              |
|  - Workspace Crates: dbx-core, dbx-sql, dbx-plugin-runtime, dbx-platform              |
|  - Ephemeral Agent Metadata Sessions (Dynamic Session Allocation & Recycling)         |
|  - AST & Keyword SQL Classifier (StatementTimeout: Cancel vs. Detach vs. Unlimited)   |
|  - Process-Level Cross-Session Table Cache with Atomic Generation Invalidation        |
+-------------------+-----------------------------------------------+-------------------+
                    |                                               |
       In-Process Drivers (Tokio)                      Out-of-Process Driver Agents
    +---------------+---------------+             +-----------------+-------------------+
    | Tokio-Postgres| Tiberius (MSSQL)            | Java JCC Bridge | Go Subprocesses   |
    | Mysql-Async   | Redis / Mongo |             | (DB2, etc.)     | (Oracle, Vastbase)|
    +---------------+---------------+             +-----------------+-------------------+
                                                  | Rust Subprocesses (TDengine WebSocket)
```

### 1.2 Subsystem Invariants & State Ownership

1. **State Ownership Boundary**:
   - The GUI/Renderer layer owns purely ephemeral view state (active tab indices, scrollbar dragging positions, uncommitted form inputs).
   - `dbx-core` owns transaction lifecycles, active statement cancellations, and cross-session catalog snapshot caches (`TABLE_SNAPSHOTS`).
   - Driver Agents (whether Rust, Go, or Java processes) own connection pools, native wire protocol state machines, and dialect-specific type decoders.
2. **Ephemeral Session Decoupling**:
   - Metadata browsing (schema navigation, column inspection, completion candidate searches) uses ephemeral sessions that spin up and terminate independently of long-running interactive query tabs.
   - To avoid cache thrashing and repeated catalog queries against servers during sidebar pagination, the driver architecture uses **Process-Level Snapshot Sharing** via `Arc<Vec<TableInfo>>` keyed by connection fingerprint and database name, invalidated instantly via an atomic metadata generation counter (`METADATA_GENERATION.fetch_add(1, Ordering::SeqCst)`).
3. **Execution Safety Boundaries**:
   - Out-of-process driver agents communicate strictly over line-delimited JSON-RPC 2.0 via `stdin`/`stdout`.
   - Thread isolation guards every driver operation with bounded concurrency semaphores (`MAX_AGENT_SESSIONS = 256`, `MAX_CONCURRENT_REQUESTS = 64`) and asynchronous `CancellationToken` tracking.

---

## 2. Net-New Universal Engineering Rules (Candidates for Master Brain)

### 1. Tri-Modal Statement Timeout and Write Non-Cancellation Invariant
**RULE**:
A database client or proxy MUST NOT issue statement cancellation directives (`KILL QUERY`, connection drop, or wire cancel packets) when an explicit timeout expires on write statements (DML) or schema alterations (DDL). Timeouts MUST be modeled as a tri-modal discriminated union:
1. `Cancel`: Applied strictly to read operations (`SELECT`, `EXPLAIN`, `SHOW`); triggers active server cancellation upon deadline.
2. `Detach`: Applied to mutating writes (`INSERT`, `UPDATE`, `DELETE`); drops client-side wait loops and returns an ambiguous-execution result to the caller without dispatching server cancellation signals.
3. `Unlimited`: Applied to schema mutations (`CREATE`, `ALTER`, `DROP`) and procedural packages; runs without an automated deadline.

**WHY**:
In distributed and replicated database clusters, `KILL QUERY` only sets an interrupt flag; the statement may still partially commit on the primary while rolling back on replicas, causing non-healing binlog and replication drift. Furthermore, cancelling in-flight DDL triggers metadata lock deadlocks and prolonged cascading rollbacks that starve the entire database instance.

**WHEN TO APPLY**:
Applies to all database clients, ORM query executors, proxy layers, migration engines, and agentic database tool executors across any language (Rust, Go, TypeScript, Java, Python).

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
use std::time::Duration;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum StatementScope {
    Read,
    Write,
    SchemaChange,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum StatementDeadline {
    Cancel(Duration),
    Detach(Duration),
    Unlimited,
}

impl StatementDeadline {
    pub fn for_statement(scope: StatementScope, read_timeout: Option<Duration>, write_timeout: Option<Duration>) -> Self {
        match scope {
            StatementScope::SchemaChange => StatementDeadline::Unlimited,
            StatementScope::Write => match write_timeout {
                Some(dur) if !dur.is_zero() => StatementDeadline::Detach(dur),
                _ => StatementDeadline::Unlimited,
            },
            StatementScope::Read => match read_timeout {
                Some(dur) if !dur.is_zero() => StatementDeadline::Cancel(dur),
                _ => StatementDeadline::Unlimited,
            },
        }
    }

    pub fn server_cancellation_budget(&self) -> Option<Duration> {
        match self {
            StatementDeadline::Cancel(d) => Some(*d),
            StatementDeadline::Detach(_) | StatementDeadline::Unlimited => None,
        }
    }
}
```

**NEGATIVE CONSTRAINT**:
```rust
// NEVER apply a single uniform cancel-capable timeout to all SQL executions
async fn execute_query_bad(client: &Client, sql: &str, timeout_secs: u64) -> Result<ExecutionResult> {
    tokio::select! {
        res = client.execute(sql) => res,
        _ = tokio::time::sleep(Duration::from_secs(timeout_secs)) => {
            // CATASTROPHIC: Sending cancel on ALTER or bulk UPDATE leaves server
            // in undefined lock state and induces replication drift!
            client.send_kill_query().await?;
            Err(anyhow::anyhow!("Query timed out"))
        }
    }
}
```

**VERIFICATION METHOD**:
Implement a property-based test asserting that for any classified `StatementScope::Write` or `StatementScope::SchemaChange`, `server_cancellation_budget()` strictly yields `None`. Verify through an integration test against a slow `UPDATE` that client timeout returns status `DetachedUnknownResult` while the database connection pool confirms no cancellation packet was sent.

---

### 2. Error-Code-Scoped Tolerant Catalog Extraction Invariant
**RULE**:
When reading catalog metadata (table comments, column defaults, constraint remarks) through legacy or strict database drivers, unmappable or malformed decorative attributes MUST be caught and defaulted to `None`/`null` ONLY when matched against the exact vendor character-conversion error code. Catch-all `SQLException` or generic error suppression MUST NOT be used, and connection-level character decoding parameters MUST NOT be downgraded or softened.

**WHY**:
Legacy databases often contain corrupt comments encoded in deprecated code pages (e.g., GBK, CP937 bytes in an EUC-JP database). Softening connection-level decoders (such as setting character substitution flags) silences encoding errors on subsequent data writes, leading to silent, irreversible user data corruption. Conversely, letting decorative catalog read failures fail the query prevents entire schemas from opening in UI/metadata explorers.

**WHEN TO APPLY**:
Applies to all JDBC, ODBC, and native wire driver bridges when extracting optional catalog metadata fields (remarks, comments, column defaults) from systems with heterogeneous client histories (DB2, Oracle, Sybase, Informix).

**VERIFIED IMPLEMENTATION PATTERN**:
```java
public final class CatalogDefensiveReader {
    // Exact IBM DB2 JCC code for character conversion exception
    private static final int DB2_UNDECODABLE_CATALOG_VALUE_ERROR = -4220;

    public static String safeMetadataString(ResultSet rs, String column) throws SQLException {
        try {
            return rs.getString(column);
        } catch (SQLException e) {
            // Strictly scope tolerance to known conversion error
            if (e.getErrorCode() != DB2_UNDECODABLE_CATALOG_VALUE_ERROR) {
                throw e; // Bubble up permission, connection, or syntax faults
            }
            return null; // Gracefully degrade decorative attribute
        }
    }
}
```

**NEGATIVE CONSTRAINT**:
```java
// NEVER loosen global connection properties to bypass metadata bugs
Properties props = new Properties();
// CATASTROPHIC: Bypasses metadata decoding errors but causes writes
// with unencodable characters to be silently replaced by '?' or corrupted!
props.setProperty("db2.jcc.charsetDecoderEncoder", "3");
```

**VERIFICATION METHOD**:
Mock a JDBC `ResultSet` throwing a `SQLException` with error code `-4220` when column `REMARKS` is read: assert that `safeMetadataString` returns `null` and the table row is returned intact. Then mock error code `-4476` (e.g., authorization failure) and assert that `safeMetadataString` rethrows the exception, failing the operation.

---

### 3. Floating-Point Shortest Round-Trippable Decimal Invariant
**RULE**:
When serializing IEEE 754 single-precision floating point numbers (`f32`) into JSON or textual wire formats for data viewing, the serializer MUST NOT cast `f32` directly to an `f64` primitive before printing. Finite `f32` numbers MUST be converted to their minimal round-trippable decimal string representation at single precision before promotion to high-precision numeric JSON tokens.

**WHY**:
Widening an IEEE 754 `f32` (24 bits of mantissa) directly to `f64` (53 bits of mantissa) exposes low-order binary approximation noise that never existed in the source column. For example, `8.6_f32` cast directly to `f64` serializes as `8.600000381469727`. This causes visual clutter, broken equality checks, and false dirty diffs in database record editors.

**WHEN TO APPLY**:
Applies to any data serialization engine, database proxy, RPC gateway, or JSON encoder that bridges low-precision native binary float types (`f32`, `float4`, `REAL`) to dynamic or JSON representations.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
use serde_json::{Number, Value};

pub fn finite_float32_to_json(value: f32) -> Value {
    if value.is_nan() {
        Value::String("NaN".to_string())
    } else if value.is_infinite() {
        if value.is_sign_positive() {
            Value::String("inf".to_string())
        } else {
            Value::String("-inf".to_string())
        }
    } else {
        // Step 1: Format f32 to its minimal round-trippable representation
        let shortest = value.to_string();
        // Step 2: Parse string as f64 to create a clean serde_json::Number
        let rounded = shortest
            .parse::<f64>()
            .expect("standard f32 to_string is always a valid f64");
        Value::Number(Number::from_f64(rounded).expect("finite f32 must yield finite f64"))
    }
}
```

**NEGATIVE CONSTRAINT**:
```rust
// NEVER widen f32 directly to f64 primitive in JSON serializers
pub fn bad_float32_to_json(value: f32) -> Value {
    // CATASTROPHIC: 8.6_f32 becomes 8.600000381469727
    serde_json::Number::from_f64(value as f64)
        .map(Value::Number)
        .unwrap_or(Value::Null)
}
```

**VERIFICATION METHOD**:
Execute an automated test with test vectors `[8.6_f32, 0.72_f32, 59.6_f32, -13.25_f32]`. Assert that serialized string outputs equal `"8.6"`, `"0.72"`, `"59.6"`, and `"-13.25"` exactly, and verify bit-level round-tripping: `(json_num.as_f64().unwrap() as f32).to_bits() == value.to_bits()`.

---

## 3. Forensic Real Incidents & Production Patches

### Incident 1: DB2 Catalog Listing Failure Due to Undecodable Comments (BUG-DB2-01)
- **Context**: `agents/drivers/db2/src/main/java/com/dbx/agent/db2/Db2Agent.java`
- **What Was Expected**: Table and column listings should load reliably regardless of whether legacy clients wrote unmappable character byte sequences into decorative catalog fields (`REMARKS`, `DEFAULT`).
- **What Actually Happened**: When IBM DB2 JCC driver encountered bytes in `REMARKS` that were unmappable under the database code page, it threw `SQLException` with `ERRORCODE=-4220`. The entire table, schema, and column metadata listing operation failed completely. An earlier attempted workaround set connection property `db2.jcc.charsetDecoderEncoder=3`, which softened client encoding and risked silent data corruption on write operations.
- **Evidence in Repo**: Commit `1248838c`, Issue #15567. Unit tests in `Db2AgentTest.java` and integration test `Db2CharsetIntegrationTest.java`.
- **Root Cause**: Reading decorative metadata using standard `rs.getString()` propagates conversion failures across the entire result set, and attempting to fix read conversion at the JDBC driver level (`charsetDecoderEncoder=3`) globalizes character substitution onto update/write paths.
- **Remediation Code Diff**:
```diff
--- a/agents/drivers/db2/src/main/java/com/dbx/agent/db2/Db2Agent.java
+++ b/agents/drivers/db2/src/main/java/com/dbx/agent/db2/Db2Agent.java
@@ -24,17 +24,18 @@
+import java.sql.SQLException;
+    private static final int UNDECODABLE_CATALOG_VALUE_ERROR = -4220;
@@ -58,13 +59,6 @@
-    @Override
-    protected Properties buildConnectionProperties(ConnectParams params) {
-        Properties properties = super.buildConnectionProperties(params);
-        properties.setProperty("db2.jcc.charsetDecoderEncoder", "3");
-        return properties;
-    }
@@ -120,7 +114,7 @@
-                        result.add(new TableInfo(rs.getString(1).trim(), type, rs.getString(3)));
+                        result.add(new TableInfo(rs.getString(1).trim(), type, metadataString(rs, 3)));
@@ -716,6 +710,37 @@
+    private static String metadataString(ResultSet rs, int column) throws SQLException {
+        try {
+            return rs.getString(column);
+        } catch (SQLException e) {
+            if (e.getErrorCode() != UNDECODABLE_CATALOG_VALUE_ERROR) {
+                throw e;
+            }
+            return null;
+        }
+    }
```
- **Lesson**: Decorative catalog attributes must have failure containment at the specific row/column decoding level. Never compromise system-wide write encoding guarantees to tolerate dirty catalog metadata.

---

### Incident 2: Statement Timeout Cancelling In-Flight Schema Changes and Writes (BUG-QUERY-02)
- **Context**: `apps/desktop/src/components/connection/ConnectionDialog.vue` and `crates/dbx-core/src/query/`
- **What Was Expected**: Query timeouts should protect client responsiveness without aborting irreversible mutations or breaking cluster replication topologies.
- **What Actually Happened**: The editor attached a single, monolithic `query_timeout_secs` to every statement. When a slow `UPDATE` or `ALTER TABLE` reached the timeout, DBX dispatched a `KILL QUERY` command. For writes, `KILL QUERY` caused an indeterminate commit status. For DDL, cancelling caused the server to initiate long-running rollbacks while retaining metadata locks, and led to non-healing replication drift on replicas that had already committed the binlog event.
- **Evidence in Repo**: Commit `c89c1a49`, Issue #15362. Full multilingual i18n locale updates (`en.ts`, `az.ts`, `es.ts`, `ja.ts`, etc.).
- **Root Cause**: Conflating read deadlines with write/DDL deadlines. A read timeout only incurs a client-side retry; a write timeout creates indeterminate state; a DDL cancellation threatens server health and replication integrity.
- **Remediation Code Diff**:
```diff
--- a/apps/desktop/src/components/connection/ConnectionDialog.vue
+++ b/apps/desktop/src/components/connection/ConnectionDialog.vue
@@ -472,6 +473,7 @@ const defaultForm = (): ConnectionForm => ({
   query_timeout_secs: settingsStore.editorSettings.globalQueryTimeoutSecs,
   query_timeout_inherit: true,
+  write_timeout_secs: DEFAULT_WRITE_TIMEOUT_SECS,
   idle_timeout_secs: 60,
@@ -4980,26 +4983,27 @@ function formValueForSubmit(): Omit<ConnectionConfig, "id"> {
+  const config = { ...form.value, write_timeout_secs: normalizeWriteTimeoutSecs(form.value.write_timeout_secs) };
@@ -7051,6 +7056,15 @@ function validateTransportLayers(config: LegacyConnectionConfig) {
+function clampWriteTimeoutInput(event: Event) {
+  const input = event.target as HTMLInputElement;
+  if (input.value === "") return;
+  const value = Number(input.value);
+  if (!Number.isFinite(value) || value <= MAX_QUERY_TIMEOUT_SECS) return;
+  input.value = String(MAX_QUERY_TIMEOUT_SECS);
+  form.value.write_timeout_secs = MAX_QUERY_TIMEOUT_SECS;
+}
```
- **Lesson**: Timeout semantics are determined by statement side-effects. Classify query ASTs and keywords before attaching deadline cancellation handlers.

---

### Incident 3: Stale Full-Width Tab Strip Scrollbar on Hover in Wrap Mode (BUG-UI-03)
- **Context**: `apps/desktop/src/components/layout/EditorGroupTabBar.vue`
- **What Was Expected**: When tabs are configured in multi-row wrapping mode or two-row layout, hover interactions should not display an unmovable horizontal scrollbar.
- **What Actually Happened**: In two-row connection grouping mode, `showOverflowControl` was kept enabled so the tab list dropdown menu could be accessed even when tabs wrapped. However, the custom horizontal drag scrollbar element derived its visibility from `showOverflowControl`, causing a disabled, full-width scrollbar thumb to appear on hover.
- **Evidence in Repo**: Commit `cf1293f6`, Issue #15619. Unit tests in `EditorGroupTabBar.groups.spec.ts`.
- **Root Cause**: Conflating dropdown menu visibility (`showOverflowControl`) with physical horizontal scrollbar geometry requirements (`showTabScrollbar`).
- **Remediation Code Diff**:
```diff
--- a/apps/desktop/src/components/layout/EditorGroupTabBar.vue
+++ b/apps/desktop/src/components/layout/EditorGroupTabBar.vue
@@ -406,6 +406,12 @@ const showOverflowControl = computed(() => {
   const hasHiddenTab = hasHorizontalFixedRows.value ? fixedTabsScroll.hasTabOverflow.value || regularTabsScroll.hasTabOverflow.value || hasHorizontalRowOverflow() : hasTabOverflow.value || hasTruncatedTabTitle.value;
   return props.tabs.length > 0 && hasHiddenTab && !isWrapLayout.value && !isVerticalLayout.value;
 });
+// The custom horizontal drag scrollbar only makes sense for a single-row
+// horizontally scrollable strip that actually overflows.
+const showTabScrollbar = computed(() => !isVerticalLayout.value && !isWrapLayout.value && !hasHorizontalFixedRows.value && hasTabOverflow.value);
@@ -2324,7 +2332,7 @@ watch([() => props.specialPageTabs?.settingsActive, () => props.specialPageTabs?
       <div class="app-tab-strip relative h-full min-w-0 flex-1 overflow-hidden">
-        <div v-if="showOverflowControl && !hasHorizontalFixedRows" class="app-tab-scrollbar" :class="{ 'app-tab-scrollbar--dragging': isScrollbarDragging }" @pointerdown="startScrollbarDrag">
+        <div v-if="showTabScrollbar" class="app-tab-scrollbar" :class="{ 'app-tab-scrollbar--dragging': isScrollbarDragging }" @pointerdown="startScrollbarDrag">
           <div class="app-tab-scrollbar__thumb" :style="tabScrollbarThumbStyle" />
         </div>
```
- **Lesson**: UI control predicates must be decoupled: never bind scrollbar DOM rendering to logical overflow dropdown states.

---

### Incident 4: Premature Dropdown Closure During Table Structure Column Editing (BUG-UI-04)
- **Context**: `apps/desktop/src/components/table/ColumnTypeSelect.vue` (and related popover components)
- **What Was Expected**: Clicking or filtering options inside a column data type dropdown select menu must keep the popup anchored and open until explicitly selected or dismissed outside.
- **What Actually Happened**: Users editing table columns observed that clicking the data-type dropdown caused it to instantly flash and dismiss before an option could be clicked.
- **Evidence in Repo**: Closed Issue #15596 ("编辑表结构时，字段类型下拉一闪就消失了").
- **Root Cause**: Focus management and click-outside/pointer-down race condition. When the table cell switches from display mode to editor mode, the table's active row cell re-asserts focus or processes a blur event from the previous element. The click-outside handler on the floating popover received an uncomposed or retargeted event from the re-rendered cell DOM tree, triggering an instant `isOpen = false` state mutation.
- **Remediation Pattern**:
  1. Guard popover dismissal by checking `event.composedPath().includes(dropdownRoot.value)`.
  2. Use pointer event phase separation (`pointerdown` vs `click`), deferring cell focus-restoration logic via `requestAnimationFrame` until the active dropdown closes.
- **Lesson**: In data grids with inline cell editing, popover click-outside listeners must verify composed event paths across portal boundaries before triggering teardowns.

---

### Incident 5: Oracle PL/SQL Debugger Goroutine Leak and Statement Close Hang (BUG-ORACLE-05)
- **Context**: `agents/drivers/oracle-go/pldebug_statement.go`
- **What Was Expected**: Closing a statement in the Oracle PL/SQL debugger bridge must release database session resources promptly without deadlocking the debug allocation lock or hanging if the connection drops.
- **What Actually Happened**: Synchronous `s.Stmt.Close()` inside the PL/SQL debugger would occasionally block indefinitely when the target session paused inside a breakpoint or crashed. Because statement close held `a.mu.Lock()`, other operations hung and goroutines leaked.
- **Evidence in Repo**: `agents/drivers/oracle-go/pldebug_statement.go`.
- **Root Cause**: Executing blocking third-party driver CGO/wire network calls (`s.Stmt.Close()`) while holding an internal resource allocation mutex (`plDebugAllocation.mu`).
- **Remediation Code Diff**:
```go
// Extracted from agents/drivers/oracle-go/pldebug_statement.go
func (s *plDebugStatement) Close() error {
    a := s.allocation
    a.mu.Lock()
    if !s.closeRequested {
        s.closeRequested = true
        s.closeDone = make(chan struct{})
        a.closingStatements++
        s.closeDeadline = time.Now().Add(plDebugReleaseTimeout)
        if !a.cleanupDeadline.IsZero() && a.cleanupDeadline.Before(s.closeDeadline) {
            s.closeDeadline = a.cleanupDeadline
        }
    }
    if a.active != nil || a.unknown || len(a.rows) != 0 {
        a.mu.Unlock()
        return errPLDebugAllocationUnknown
    }
    if !s.closeStarted {
        s.closeStarted = true
        // CRITICAL INVARIANT: Launch raw blocking driver close off-lock in background goroutine
        go s.closeRaw()
    }
    done, deadline := s.closeDone, s.closeDeadline
    a.mu.Unlock()

    timer := time.NewTimer(time.Until(deadline))
    defer timer.Stop()
    select {
    case <-done:
        return s.result()
    case <-timer.C:
        return errPLDebugAllocationUnknown
    }
}
```
- **Lesson**: Never hold an application synchronization lock across external network or driver handles. Offload external driver teardowns to an asynchronous worker with a timed channel join.

---

## 4. Microscopic Code-Level Invariants

### 4.1 Micro-Syntax & Token-Level Precision

#### 1. Falsy Zero vs Empty String vs Null in Query Timeout & Port Configurations
In database configuration interfaces, `0` has a distinct semantic meaning from `null` or `""`. In DBX:
- For timeouts: `0` explicitly represents **Unlimited / No Timeout**.
- For ports: `0` represents **Unspecified / Fallback to Engine Default** (e.g., 6041 for TDengine, 3306 for MySQL).

```typescript
// DANGEROUS: Falsy coercion treats 0 as undefined/default
const badTimeout = form.timeout || 60; // When form.timeout is 0, this assigns 60!

// INVARIANT: Explicit null/undefined checks preserving 0
export function normalizeTimeoutSecs(val: number | null | undefined): number {
  if (val === null || val === undefined || !Number.isFinite(val)) {
    return DEFAULT_TIMEOUT_SECS;
  }
  return Math.max(0, Math.floor(val));
}
```

```rust
// INVARIANT in agents/drivers/tdengine/src/config.rs:
let port = if params.port == 0 { DEFAULT_PORT } else { params.port };
```

#### 2. Shallow Copy vs Deep Immutability Mutation Leaks in Vue Pinia Stores
When updating connection configuration drafts via deep links or forms, shallow cloning (`{ ...form.value }`) leaks nested structures (such as `ssh_tunnel`, `ssl_options`, or `url_params`).
```typescript
// INVARIANT in apps/desktop/src/components/connection/ConnectionDialog.vue:
function formValueForSubmit(): Omit<ConnectionConfig, "id"> {
  // Primitives and top-level overrides combined with normalized sub-properties:
  const config = {
    ...form.value,
    write_timeout_secs: normalizeWriteTimeoutSecs(form.value.write_timeout_secs),
  };
  // Explicitly avoid mutating original form.value reference
  return config;
}
```

---

### 4.2 Infinite Loop & Recursion Guards

#### 1. Circular Reference Guard in Lexical SQL Session Sanitizers
In `agents/drivers/vastbase-go/connection_state.go`, the SQL session analyzer sanitizes strings, block comments, and dollar-quoted literals using a forward scanning pointer. An infinite loop occurs if any branch advances by 0 bytes on malformed input (such as an unclosed block comment `/*` or unclosed dollar quote `$$`).

```go
// INVARIANT: Every lexical scanning loop branch MUST monotonically advance index >= 1
func sanitizeSessionStateSQL(sqlText string) string {
    var sanitized strings.Builder
    sanitized.Grow(len(sqlText))
    for index := 0; index < len(sqlText); {
        switch {
        // Line comment branch
        case index+1 < len(sqlText) && sqlText[index] == '-' && sqlText[index+1] == '-':
            index = sanitizeSQLLine(sqlText, &sanitized, index, index+2)
        // Block comment branch
        case index+1 < len(sqlText) && sqlText[index] == '/' && sqlText[index+1] == '*':
            index = sanitizeSQLBlock(sqlText, &sanitized, index+2)
        // Default character fallback: MUST step exactly 1 byte
        default:
            sanitized.WriteByte(sqlText[index])
            index++ // Termination proof: index increases monotonically towards len(sqlText)
        }
    }
    return sanitized.String()
}
```

#### 2. Negative Timestamp Remainder Epoch Normalization
In `agents/go-common/iotdb-client-go/client/utils.go`, when dividing integer timestamps prior to epoch 1970 (`timestamp < 0`), standard Go integer division truncates towards zero. Without Euclidean remainder compensation, microsecond and nanosecond fractions diverge, producing negative sub-second components or incorrect calendar days.

```go
// INVARIANT: Euclidean floor division proof for negative timestamps
quotient := timestamp / divisor
remainder := timestamp % divisor

if timestamp < 0 && remainder != 0 {
    quotient--
    remainder += divisor // Ensures remainder is strictly in range [0, divisor)
}
```

---

### 4.3 UI & UX Micro-Mechanics

#### 1. Layout Thrashing & Stacking Context Traps in Custom Scrollbars
In `EditorGroupTabBar.vue`, tab strips feature a custom dragging scrollbar overlaid on top of a scroll container.
- **Trap**: Deriving scrollbar visibility from `scrollWidth > clientWidth` during rapid DOM reflows creates layout thrashing (read-write-read cycles) and causes scrollbars to flicker when titles truncate.
- **Guard**: Calculate overflow via

## 3. Application to AI-Builder-Brain Project Construction
- **Applied Blueprints**: `astro-tailwind-v4`, `fullstack-ai-saas`, `universal-native-factory`
- **Regression Shield**: Prevents architectural drift across construction cycles.
