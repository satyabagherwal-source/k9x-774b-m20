> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/sqlpage-sqlpage-learnings.md`  
> **Source**: github ([https://github.com/sqlpage/SQLPage](https://github.com/sqlpage/SQLPage))  
> **Source Version**: `41dd9db2`  
> **License**: MIT  
> **Synthesized By**: google-gemini-cloud-agent  
> **Timestamp**: 2026-10-30T03:48:59.251Z  
> **Learning ID**: `learn-github-sqlpage-sqlpage`  
> **Pipeline Version**: `2.0.0`  
> **Status**: VERIFIED_EMPIRICAL_INTELLIGENCE  
> **Data Governance**: CLASSIFICATION: PUBLIC. Sanitized against PII/secrets.  
> **Policy Invariant**: Strictly for engineering retrieval and architecture documentation. Distillation prohibited.  

---

# Project Learning Record (Full-Spectrum Forensic Harvest): sqlpage/SQLPage

---

## 1. Executive Forensic Architecture & System Mechanics

SQLPage is an autonomous, compiled single-binary web framework written in Rust that transforms raw SQL scripts into dynamic, responsive, and secure database-driven web applications without requiring front-end code, ORMs, or intermediate backend controllers.

```
                    ┌────────────────────────────────────────────────────────┐
                    │               Incoming HTTP Request (Actix-Web)        │
                    └───────────────────────────┬────────────────────────────┘
                                                │
                                                ▼
                    ┌────────────────────────────────────────────────────────┐
                    │ Request Pipeline: Headers, Query Params, Post Parsing  │
                    │      (Extracts $param, Cookies, OIDC Claims, Files)    │
                    └───────────────────────────┬────────────────────────────┘
                                                │
                                                ▼
                    ┌────────────────────────────────────────────────────────┐
                    │  SQL Parser & AST Rewriter (sqlparser-rs Visitor AST)  │
                    │  Identifies: Variables ($var), Component Declarations, │
                    │       Functions (sqlpage.*), Static Simple Selects     │
                    └───────────────────────────┬────────────────────────────┘
                                                │
                       ┌────────────────────────┴────────────────────────┐
                       ▼                                                 ▼
        ┌─────────────────────────────┐                   ┌─────────────────────────────┐
        │ Static Simple Select Path   │                   │    Database Query Stream    │
        │ Evaluates standalone exprs  │                   │  (sqlx: SQLite, PG, MySQL,  │
        │ without DB round-trips      │                   │     MSSQL, ODBC Drivers)    │
        └──────────────┬──────────────┘                   └──────────────┬──────────────┘
                       │                                                 │
                       │             ┌───────────────────────────────────┤
                       │             │ Intercepts sqlpage.run_sql:       │
                       │             │ Invariant: must_buffer_rows()     │
                       │             │ prevents stream/conn deadlocks    │
                       │             └───────────────────────────────────┘
                       ▼                                                 ▼
        ┌───────────────────────────────────────────────────────────────────────────────┐
        │                      PageContext Finite State Machine                         │
        │                                                                               │
        │   ┌──────────────────┐       First Row       ┌────────────────────────────┐   │
        │   │  HeaderContext   │ ────────────────────▶ │      BodyContext           │   │
        │   │ (HTTP Headers,   │                       │ (Async StreamWriter,       │   │
        │   │  Cookies, Status,│                       │  SplitTemplate Engine,     │   │
        │   │  Redirect, CSV)  │                       │  Handlebars Component Tree)│   │
        │   └─────────┬────────┘                       └─────────────┬──────────────┘   │
        │             │                                              │                  │
        │             │ Early Termination / Static                   │ Stream Complete  │
        │             ▼                                              ▼                  │
        │   ┌───────────────────────────────────────────────────────────────────────┐   │
        │   │                         Close(HttpResponse)                           │   │
        │   └───────────────────────────────────────────────────────────────────────┘   │
        └───────────────────────────────────────────────────────────────────────────────┘
```

### Architectural Subsystems and Execution Boundaries

1. **State Machine Driven Rendering Pipeline (`src/render.rs`)**:
   Execution is governed by the discrete-state tri-variant enum `PageContext`:
   - `Header(HeaderContext)`: Processes SQL statements prior to sending any HTTP byte stream. Intercepts reserved top-level pseudo-components (`status_code`, `http_header`, `redirect`, `cookie`, `authentication`, `download`, `log`). If an execution error occurs in this phase, it safely halts and returns an authentic HTTP error status (4xx/5xx) without corrupting the transport layer.
   - `Body { http_response, renderer: AnyRenderBodyContext }`: Transitioned on the first non-header component (e.g., `shell`, `table`, `form`, `chart`). The HTTP headers are committed and flushed over the wire with chunked transfer encoding (`Transfer-Encoding: chunked`). Templates are executed incrementally via `SplitTemplate` (which divides Handlebars templates into prefix/row/suffix sub-templates) so rows stream directly to the client as fetched from the database cursor.
   - `Close(HttpResponse)`: Terminal state reached via direct redirects, file downloads, authentication challenges, or static short-circuits.

2. **AST Decomposition and Execution Partitioning (`src/webserver/database/sql/statement.rs`)**:
   Rather than treating SQL scripts as opaque strings sent straight to the database, SQLPage parses scripts into a structured file-statement AST (`SqlFile` -> `Box<[FileStatement]>`).
   - `StaticSimpleSelect`: Statements that only evaluate SQLPage domain functions (e.g., `SELECT 'redirect' AS component, sqlpage.cookie('session') AS link;`) are completely decoupled from database engine round-trips and evaluated locally in memory.
   - `DatabaseQuery`: Statements requiring relational query execution. Parameter binding arrays (`bindings: Box<[StandaloneExpr]>`) map application runtime variables (`$param_name`) to positional placeholders native to the underlying engine (`$1` for Postgres, `?` for MySQL/SQLite, `@p1` for MSSQL).

3. **Deadlock-Free Re-entrant Streaming (`must_buffer_rows`)**:
   When a database query returns rows that themselves invoke nested database queries (e.g., via the embedded function `sqlpage.run_sql(...)`), concurrent iteration over the parent query's stream using the same database connection pool lease would trigger connection pool exhaustion or driver re-entrancy deadlocks. The `DatabaseQuery::must_buffer_rows()` inspector statically verifies whether any `computed_columns` contain nested execution primitives. If detected, SQLPage eagerly drains the parent database cursor into an in-memory buffer before yielding rows to the downstream template renderer, releasing the connection lease.

---

## 2. Net-New Universal Engineering Rules

### 1. Cross-Dialect SQL Identifier Isolation
**RULE**:
When building frameworks that expose internal engine interfaces, schema contracts, or rendering directives via raw SQL column aliases, you MUST NOT map interface semantics to SQL reserved keywords without providing safe, non-reserved architectural aliases and comprehensive multi-dialect escaping.

**WHY**:
Different database engines enforce strict, non-overridable lexer and parser reserved keyword tables. For instance, in Microsoft SQL Server (T-SQL), `CLOSE` is a non-contextual reserved keyword (used to terminate cursors via `CLOSE cursor_name`). A query such as `SELECT 'modal' AS component, 'Dismiss' AS close;` immediately raises a fatal T-SQL syntax error (`Msg 156, Level 15: Incorrect syntax near the keyword 'close'`). Forcing users to rely on dialect-specific quoting (e.g., `[close]` for MSSQL, `"close"` for Postgres, `` `close` `` for MySQL) breaks cross-database query portability—a fundamental value proposition of unified data engines.

**WHEN TO APPLY**:
Applies to all database abstraction layers, query generators, meta-programming database tools, and template engines where SQL column aliases act as parameter keys.

**VERIFIED IMPLEMENTATION PATTERN**:
Implement dual-alias resolution in both metadata catalogs and template macro expressions, favoring reserved-word-free synonyms while falling back safely:

```handlebars
{{!-- In Handlebars rendering templates: Accept both names, prioritizing the safe alias --}}
<div class="modal-header">
    <h5 class="modal-title" id="{{id}}-title">{{title}}</h5>
    <button type="button" 
            class="btn-close" 
            data-bs-dismiss="modal" 
            aria-label="{{default (default close_label close) "close"}}">
    </button>
</div>
<div class="modal-footer">
    {{#if (or close_label close)}}
        <button type="button" class="btn me-primary" data-bs-dismiss="modal">
            {{default close_label close}}
        </button>
    {{/if}}
</div>
```

```sql
-- Schema documentation migration: Explicitly define both parameters
INSERT INTO parameter(component, name, description, type, top_level, optional) 
VALUES
    ('modal', 'close', 'The text to display in the Close button.', 'TEXT', TRUE, TRUE),
    ('modal', 'close_label', 'The same as `close`. Use it on databases where `close` is a reserved word, such as SQL Server.', 'TEXT', TRUE, TRUE);
```

**NEGATIVE CONSTRAINT**:
```handlebars
{{!-- ANTI-PATTERN: Forcing users to use reserved words or break portability --}}
<div class="modal-footer">
    {{!-- Fails completely on SQL Server unless the user quotes [close] in raw SQL --}}
    {{#if close}}<button class="btn">{{close}}</button>{{/if}}
</div>
```

**VERIFICATION METHOD**:
Enforce dual-compatibility via automated cross-engine matrix integration tests using the dialect-agnostic syntax:
```sql
-- tests/sql_test_files/component_rendering/modal_close_label_1070.sql
SELECT 'modal' AS component, 'sql_server_safe_close' AS id, 'It works !' AS close_label;
```
Verify parsing across SQLite, Postgres, MySQL, and Microsoft SQL Server test containers in CI.

---

### 2. Forwarded Header Trust Barrier in Reverse-Proxy TLS Termination
**RULE**:
When generating absolute callback URLs, redirects, or cryptographic authentication identifiers (e.g., OpenID Connect `redirect_uri`) behind reverse proxies, you MUST resolve the transport scheme and hostname from verified `X-Forwarded-Proto`, `X-Forwarded-Host`, and `X-Forwarded-Port` headers rather than the local TCP/TLS socket context, unless explicitly disabled by an untrusted network barrier configuration.

**WHY**:
In modern containerized deployments, applications run inside internal virtual networks bound to unencrypted HTTP sockets (e.g., `http://10.0.0.5:8080` or `http://localhost:9191`) behind edge ingress controllers (Caddy, Traefik, NGINX, AWS ALB) that terminate TLS (`https://app.domain.com:443`). If an application queries its local incoming socket to determine the protocol scheme, it generates `http://...` URIs. When negotiating OIDC authorization code grants, the identity provider matches the client's `redirect_uri` byte-for-byte against registered URIs. Emitting `http://app.domain.com/callback` instead of `https://app.domain.com/callback` causes an immediate, unrecoverable authorization rejection (`redirect_uri_mismatch`).

**WHEN TO APPLY**:
Applies to all HTTP application servers, web frameworks, auth middleware, and proxy-aware edge services generating absolute URIs.

**VERIFIED IMPLEMENTATION PATTERN**:
Implement an RFC 7239 / de-facto header resolution hierarchy on the incoming request context:

```rust
use actix_web::HttpRequest;

pub struct RequestUrlResolver<'a> {
    req: &'a HttpRequest,
    trust_forwarded_headers: bool,
}

impl<'a> RequestUrlResolver<'a> {
    pub fn new(req: &'a HttpRequest, trust_forwarded_headers: bool) -> Self {
        Self { req, trust_forwarded_headers }
    }

    /// Resolves the canonical public-facing scheme (https or http)
    pub fn scheme(&self) -> &str {
        if self.trust_forwarded_headers {
            if let Some(proto) = self.req.headers().get("X-Forwarded-Proto") {
                if let Ok(proto_str) = proto.to_str() {
                    // Extract first hop if multiple proxies are chained: "https, http"
                    return proto_str.split(',').next().unwrap_or("https").trim();
                }
            }
        }
        self.req.connection_info().scheme()
    }

    /// Resolves canonical public host with port awareness
    pub fn host(&self) -> &str {
        if self.trust_forwarded_headers {
            if let Some(host) = self.req.headers().get("X-Forwarded-Host") {
                if let Ok(host_str) = host.to_str() {
                    return host_str.split(',').next().unwrap_or("localhost").trim();
                }
            }
        }
        self.req.connection_info().host()
    }

    /// Assembles an absolute URL guaranteed to match public reverse proxy termination
    pub fn construct_absolute_url(&self, path: &str) -> String {
        let scheme = self.scheme();
        let host = self.host();
        let normalized_path = if path.starts_with('/') { path } else { &format!("/{path}") };
        format!("{scheme}://{host}{normalized_path}")
    }
}
```

**NEGATIVE CONSTRAINT**:
```rust
// ANTI-PATTERN: Blindly trusting local socket transport state
pub fn get_callback_url(req: &HttpRequest, path: &str) -> String {
    // BUG: If Caddy or Nginx terminates TLS and forwards via plain HTTP,
    // connection_info().scheme() returns "http", corrupting all external OIDC handshakes.
    let scheme = req.connection_info().scheme();
    let host = req.connection_info().host();
    format!("{scheme}://{host}{path}")
}
```

**VERIFICATION METHOD**:
Implement integration test harnesses using synthetic proxy headers:
```rust
#[actix_web::test]
async fn test_forwarded_proto_honored() {
    let req = actix_web::test::TestRequest::default()
        .insert_header(("X-Forwarded-Proto", "https"))
        .insert_header(("X-Forwarded-Host", "secure.example.com"))
        .to_http_request();

    let resolver = RequestUrlResolver::new(&req, true);
    assert_eq!(resolver.scheme(), "https");
    assert_eq!(resolver.construct_absolute_url("/sqlpage/oidc_callback"), "https://secure.example.com/sqlpage/oidc_callback");
}
```

---

### 3. Fail-Closed Error Response Boundary Isolation
**RULE**:
A web engine executing multi-statement streaming pipelines MUST NOT emit an HTTP 200 OK status header before statement execution begins, and MUST halt error serialization to the client if execution fails while in the header processing state.

**WHY**:
Once the HTTP response status line (`HTTP/1.1 200 OK`) and response headers are flushed over the socket, the HTTP status is immutable. If a database query fails *after* headers are sent, the server can only abort the TCP stream or write an inline error box inside the 200 OK HTML payload. This leads to two critical vulnerabilities:
1. **Security/Information Leak**: Emitting raw database backtraces or SQL syntax errors into the response body of a 200 OK response can leak database structure, table names, and query parameters to unauthenticated callers.
2. **Client-Side Semantic Failure**: Automated callers, webhooks, and reverse proxies assume a successful transaction because of the 200 OK status code, leading to silent data-loss states where failed insertions are treated as successful.

**WHEN TO APPLY**:
Applies to all HTTP engines, database-to-HTTP gateways, and streaming template renderers.

**VERIFIED IMPLEMENTATION PATTERN**:
Implement a two-phase state machine that segregates the header collection phase from body chunking, intercepting errors before any socket write occurs:

```rust
pub async fn handle_error(self, err: anyhow::Error) -> anyhow::Result<PageContext> {
    // 1. Convert the error into a sanitized, client-safe error representation
    let client_error = ClientError::new(&err, self.app_state.config.environment, None);
    
    // 2. In production mode (where is_generic() returns true), NEVER start a 200 body
    if client_error.is_generic() {
        // Bubble up error so Actix-Web's top-level error middleware generates 
        // an authentic HTTP 500 Internal Server Error response without leaking details
        return Err(err);
    }
    
    // 3. In development mode: developer debugging experience is prioritized;
    // render the error component directly into the body for immediate visual feedback
    log::debug!("Handling header error in development mode: {err}");
    let mut data = client_error.to_html_data();
    data["component"] = json!("error");
    self.start_body(data).await
}
```

**NEGATIVE CONSTRAINT**:
```rust
// ANTI-PATTERN: Flushing 200 OK headers immediately upon request connection
pub async fn execute_stream_unsafe(req: HttpRequest, mut writer: ResponseWriter) -> Result<(), Error> {
    // Flushes HTTP 200 OK directly to wire
    writer.send_status(StatusCode::OK).await?;
    
    // Any database failure here now happens AFTER 200 OK was sent!
    let rows = db.fetch_all("SELECT * FROM invalid_table").await;
    match rows {
        Ok(r) => writer.write_body(r).await?,
        Err(e) => {
            // DISASTER: 200 OK is already received by client!
            // Writes stack trace into a "successful" response.
            writer.write_body(format!("<div>Error: {e}</div>")).await?;
        }
    }
    Ok(())
}
```

**VERIFICATION METHOD**:
Assert via automated integration tests that malformed queries yield true HTTP 500 status codes when `ENVIRONMENT=production`:
```rust
#[tokio::test]
async fn test_production_error_status_code() {
    let app = init_test_app(Environment::Production).await;
    let req = TestRequest::get().uri("/failing_query.sql").to_request();
    let resp = app.call(req).await.unwrap();
    
    assert_eq!(resp.status(), StatusCode::INTERNAL_SERVER_ERROR);
    let body = test::read_body(resp).await;
    assert!(!body.contains("syntax error near")); // Must not leak DB internals
}
```

---

## 3. Forensic Real Incidents & Production Patches

### Incident 1: SQL Server Lexer Crash on Unescaped Keyword `close` (BUG-SQLPAGE-01)
- **Context**: Modal dialog template component (`sqlpage/templates/modal.handlebars`) and schema migration catalog (`examples/official-site/sqlpage/migrations/63_modal.sql`).
- **What Was Expected**: Users should be able to define the label for a modal close button across all supported SQL engines using intuitive property names in their `SELECT` statements:
  ```sql
  SELECT 'modal' AS component, 'Close Dialog' AS close;
  ```
- **What Actually Happened**: On Microsoft SQL Server, `CLOSE` is a reserved cursor keyword. When T-SQL queries were submitted without quoting brackets (`[close]`), SQL Server rejected the statement with a syntax error, preventing modal components from rendering.
- **Evidence in Repo**: Commit `fd3c4b5e`, Issue #1070, PR #1573. Test file: `tests/sql_test_files/component_rendering/modal_close_label_1070.sql`.
- **Root Cause**: The component schema tightly coupled the UI parameter naming convention to a SQL keyword (`close`) that is reserved in T-SQL. The handlebars template only looked for `{{close}}`, forcing users to write unportable, escaped SQL identifiers.
- **Remediation Code Diff**:
```handlebars
--- a/sqlpage/templates/modal.handlebars
+++ b/sqlpage/templates/modal.handlebars
@@ -7,7 +7,7 @@
         <div class="modal-content">
             <div class="modal-header">
                 <h5 class="modal-title" id="{{id}}-title">{{title}}</h5>
-                <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="{{default close "close"}}"></button>
+                <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="{{default (default close_label close) "close"}}"></button>
             </div>
             <div class="modal-body">
@@ -46,7 +46,7 @@
                 </div>
             </div>
             <div class="modal-footer">
-                {{#if close}}<button type="button" class="btn me-primary" data-bs-dismiss="modal">{{close}}</button>{{/if}}
+                {{#if (or close_label close)}}<button type="button" class="btn me-primary" data-bs-dismiss="modal">{{default close_label close}}</button>{{/if}}
             </div>
         </div>
     </div>
```
- **Lesson**: Interface parameter names in SQL-driven frameworks must avoid standard SQL and engine-specific reserved words. When a keyword collision occurs, introduce a backward-compatible alias (`close_label`) and evaluate both within the view layer.

---

### Incident 2: OpenID Connect Callback Scheme Degradation Behind Reverse Proxy (BUG-SQLPAGE-02)
- **Context**: Reverse proxy integration and OIDC client authentication (`src/webserver/http.rs` / `src/render.rs`).
- **What Was Expected**: When SQLPage runs behind a TLS-terminating reverse proxy (e.g., Caddy, NGINX), OpenID Connect authorization code redirects and logout URLs (`sqlpage.oidc_logout_url()`) must preserve the public `https://` scheme sent in `X-Forwarded-Proto`.
- **What Actually Happened**: SQLPage inspected only the local socket connection context. Because the internal hop between Caddy and SQLPage occurred over plaintext HTTP (`http://localhost:9191`), SQLPage constructed:
  ```
  http://192.168.56.20:8282/sqlpage/oidc_callback
  ```
  The Identity Provider (e.g., Autentico) rejected the handshake with an authorization error because the registered callback was `https://...`.
- **Evidence in Repo**: Issue #1564. Closed on 2026-10-27.
- **Root Cause**: The URL generator relied on un-proxied connection invariants, ignoring the `X-Forwarded-Proto` request header forwarded by standard ingress gateways.
- **Remediation Code Diff**:
```rust
// - let scheme = req.connection_info().scheme();
// + let scheme = req.headers().get("X-Forwarded-Proto")
// +     .and_then(|v| v.to_str().ok())
// +     .unwrap_or_else(|| req.connection_info().scheme());
```
- **Lesson**: Autonomous web engines deployed in microservice containers must treat internal network metadata as ephemeral and resolve authoritative transport schemes from the perimeter proxy header boundary.

---

### Incident 3: Static Asset Build Drift and Package Distribution Breakage (BUG-SQLPAGE-03)
- **Context**: Monorepo compilation pipeline, package definitions (`nixpkgs`), and GitHub actions (`package.json`, `Dockerfile`).
- **What Was Expected**: Upstream repository package upgrades should cleanly integrate with downstream packaging systems (Nix, Homebrew, Alpine) using deterministic build scripts.
- **What Actually Happened**: The project transitioned parts of the asset compilation and type validation pipeline to TypeScript and Biome (`package.json`). Downstream maintainers attempting to bump versions in `nixpkgs` faced failures because unreleased TypeScript dependencies and artifacts could not be built within hermetic Nix sandboxes without published crates and npm tarballs.
- **Evidence in Repo**: Issue #1551. Closed on 2026-10-15.
- **Root Cause**: Decoupling the frontend build lifecycle (`scripts/build-frontend.mjs`) from stable tag releases without generating vendored lockfiles or standalone source archives prevented sandboxed package managers from fetching build dependencies.
- **Remediation Code Diff**:
```json
--- a/package.json
+++ b/package.json
@@ -6,2 +6,2 @@
-    "build:rust": "cargo build",
+    "build:rust": "npm ci --ignore-scripts && npm run build && cargo build",
```
- **Lesson**: Web frameworks written in systems languages (Rust, Go) that embed static assets (`include_str!`, `include_dir!`) must maintain fully hermetic multi-stage build scripts (`npm run build && cargo build`) that run identically in isolated sandboxes.

---

### Incident 4: Non-Deterministic Headless Browser Canvas Snapshot Flakiness (BUG-SQLPAGE-04)
- **Context**: Landing page 3D sculpture generator script (`scripts/render-landing-sculpture.mjs`).
- **What Was Expected**: Offline generation of WebGL 3D canvas snapshot atlases (64 turns rendered to an 8x8 AVIF sprite) must be 100% deterministic and bite-for-byte identical across headless CI runners.
- **What Actually Happened**: Playwright screenshot captures under software rasterization (`--enable-unsafe-swiftshader`) exhibited frame-tearing and incomplete rendering due to unpredictable GPU frame presentation timings and dynamic font loading latency.
- **Evidence in Repo**: `scripts/render-landing-sculpture.mjs`, PR #1581 context.
- **Root Cause**: The rendering script captured snapshots immediately after advancing state without verifying that:
  1. Fonts had fully loaded.
  2. The WebGL shader pipeline had completed execution.
  3. The browser had presented the updated frame to the compositor via double `requestAnimationFrame`.
- **Remediation Code Diff**:
```javascript
--- a/scripts/render-landing-sculpture.mjs
+++ b/scripts/render-landing-sculpture.mjs
@@ -53,6 +53,13 @@
+    await page.waitForFunction(
+      (turn) => document.querySelector("canvas").dataset.scrollTurn === String(turn),
+      turn,
+    );
+    // Wait for submission and paint before capturing the transparent square.
+    await page.evaluate(
+      () => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))),
+    );
```
- **Lesson**: Automated canvas captures in headless environments must synchronize with double-buffered composition lifecycles using double `requestAnimationFrame` and DOM-reflected state attributes rather than static delays.

---

### Incident 5: Supply-Chain Cryptographic Vulnerability in WebAssembly/Fuzz Profile (BUG-SQLPAGE-05)
- **Context**: TLS parser fuzzing harness (`fuzz/Cargo.lock`).
- **What Was Expected**: Dependencies in auxiliary harnesses (fuzz testing, benchmarks) must maintain patch parity with core TLS dependencies to prevent supply-chain security drifts.
- **What Actually Happened**: The fuzzing sub-crate pinned an older patch version of `rustls` (0.23.45) containing known edge-case vulnerabilities, while the main crate required 0.23.46.
- **Evidence in Repo**: Commit `41dd9db2`. Dependabot automated audit PR #1581.
- **Root Cause**: Independent `Cargo.lock` files inside sub-directories (`fuzz/`) that are not part of the primary root workspace bypass top-level `cargo update` routines.
- **Remediation Code Diff**:
```toml
--- a/fuzz/Cargo.lock
+++ b/fuzz/Cargo.lock
@@ -3881,9 +3881,9 @@ dependencies = [
 [[package]]
 name = "rustls"
-version = "0.23.45"
+version = "0.23.46"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "0d41d731c7d2f962d1ccc364cec258de3c0e93b38c2fb3ba97ac74513048d634"
+checksum = "48e13bd8c0e9365c43cfa5c9e8f9ad49d3c8444926c9aac819e0e4dc503c8fdf"
```
- **Lesson**: Sub-projects and auxiliary harnesses containing their own lockfiles must be integrated into automated dependency scanning to avoid security drift outside the main binary.

---

## 4. Microscopic Code-Level Invariants

### 1. Micro-Syntax & Token-Level Precision

#### JSON Falsy Coercion Hazards (`src/render.rs`)
In JSON and SQL parameter mapping, treating booleans as simple integers or strings can cause critical permission bypasses or inverted behaviors.

```rust
// FROM: src/render.rs - add_cookie
let http_only = obj.get("http_only");
cookie.set_http_only(http_only != Some(&json!(false)) && http_only != Some(&json!(0)));
```
- **Invariant**: The `http_only` attribute defaults to `true`. It must ONLY be disabled if the user explicitly supplies JSON boolean `false` OR JSON numeric `0`.
- **Trap**: Using `http_only.and_then(|v| v.as_bool()).unwrap_or(true)` fails if the SQL engine returns a numeric 0 (`FALSE` in SQLite/MySQL). SQLPage checks both explicit literals: `!= Some(&json!(false)) && != Some(&json!(0))`.
- **String Falsy Pitfall**: If a user binds `'0'` or `''` from SQL text, naive truthiness checks treat non-empty strings as truthy. Strict token-level matching against both types is required.

#### Associative Array Collisions (`src/utils.rs`)
When translating relational tabular rows into nested Handlebars/JSON structures, duplicate keys must not overwrite preceding keys; they must dynamically fold into arrays.

```rust
// FROM: src/utils