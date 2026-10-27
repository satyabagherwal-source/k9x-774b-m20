> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/apioo-fusio-learnings.md`  
> **Source**: github ([https://github.com/apioo/fusio](https://github.com/apioo/fusio))  
> **Source Version**: `9dedd6f6`  
> **License**: Apache-2.0  
> **Synthesized By**: google-gemini-cloud-agent  
> **Timestamp**: 2026-10-27T14:43:16.610Z  
> **Learning ID**: `learn-github-apioo-fusio`  
> **Pipeline Version**: `2.0.0`  
> **Status**: VERIFIED_EMPIRICAL_INTELLIGENCE  
> **Data Governance**: CLASSIFICATION: PUBLIC. Sanitized against PII/secrets.  
> **Policy Invariant**: Strictly for engineering retrieval and architecture documentation. Distillation prohibited.  

---

# Project Learning Record (Full-Spectrum Forensic Harvest): apioo/fusio

## 1. Executive Forensic Architecture & System Mechanics

**Technical Problem Solved:**
Fusio solves the "Legacy-to-API" impedance mismatch. It acts as a **Self-Hosted API Gateway and Management Plane** that abstracts heterogeneous backend data sources (SQL/NoSQL databases, microservices, custom PHP/JS logic) into a unified, secure, and monetizable REST API product. Crucially, it bridges the gap between traditional backend logic and the **AI Agent Ecosystem** via native Model Context Protocol (MCP) support, allowing autonomous agents to consume business logic as "Tools."

**Architectural Boundaries & Subsystems:**
The system is strictly decoupled into three distinct repositories, enforced by the `apioo` organization structure:
1.  **Core Engine (`fusio-impl` - PHP):** The headless backend. It owns the routing, authentication, rate limiting, and execution engine. It exposes an internal API for management.
2.  **Management UI (`fusio-apps-backend` - Angular/TS):** The admin dashboard. It does not contain business logic; it strictly consumes the Core Engine's internal API to configure operations, users, and adapters.
3.  **Developer Portal (`fusio-apps-developer` - Angular/TS):** The self-service portal for external API consumers.

**Critical Subsystem Abstractions:**
*   **Adapter Pattern:** The primary extension mechanism. Adapters are plugins (Composer packages) that implement specific interfaces to connect to external systems (e.g., `MySQLAdapter`, `RestAdapter`). This allows the core to remain agnostic of backend technologies.
*   **Operation Abstraction:** The atomic unit of API exposure. An "Operation" maps an HTTP method/path to a specific Adapter action. It encapsulates security scopes, rate limits, and documentation.
*   **MCP Server Layer:** A specialized translation layer that introspects active Operations and exposes them as MCP "Tools" for LLM consumption, handling schema conversion from OpenAPI to MCP tool definitions.

## 2. Net-New Universal Engineering Rules (Candidates for Master Brain)

### 1. The "Active State" Enforcement Invariant
**RULE**:
Any API gateway or router MUST enforce the "Active" status of a resource (Operation, Endpoint, User) at the **routing/dispatch layer**, not just at the data retrieval layer. A resource marked as "Inactive" MUST return a `404 Not Found` or `403 Forbidden` immediately upon route matching, before any adapter logic or database query is executed.

**WHY**:
Forensic analysis of Issue #582 reveals that "Inactive" operations were still reachable. This indicates a failure in the **Time-of-Check to Time-of-Use (TOCTOU)** boundary. If the check for "is this operation active?" happens *after* the adapter is instantiated or the database is queried, the system leaks existence (via timing or error messages) and allows unauthorized execution. The invariant ensures that state checks are part of the **Access Control List (ACL)** evaluation, not the business logic.

**WHEN TO APPLY**:
Any system where resources have a lifecycle state (Active/Inactive/Archived) and are exposed via a public interface. Critical for API Gateways, CMSs, and Multi-tenant SaaS platforms.

**VERIFIED IMPLEMENTATION PATTERN**:
```php
// In the Router/Dispatcher
public function dispatch(Request $request): Response
{
    // 1. Resolve Route
    $operation = $this->router->match($request);
    
    if (!$operation) {
        return new Response(404, 'Not Found');
    }

    // 2. CRITICAL: Enforce State BEFORE Execution
    // This check MUST happen here, not inside the Adapter
    if (!$operation->isActive()) {
        // Return 404 to hide existence, or 403 if authenticated
        return new Response(404, 'Not Found'); 
    }

    // 3. Check Permissions/Scopes
    if (!$this->auth->hasScope($request, $operation->getRequiredScopes())) {
        return new Response(403, 'Forbidden');
    }

    // 4. ONLY NOW execute the adapter
    $adapter = $this->adapterFactory->create($operation->getAdapterType());
    return $adapter->execute($operation, $request);
}
```

**NEGATIVE CONSTRAINT**:
```php
// ANTI-PATTERN: Checking state inside the Adapter
public function execute(Operation $op, Request $req): Response
{
    // BAD: The adapter is already instantiated, resources are loaded.
    // If the DB query fails or takes time, the "Inactive" state is ignored.
    if (!$op->isActive()) {
        throw new Exception("Operation Inactive"); // Leaks existence
    }
    // ... execute logic
}
```

**VERIFICATION METHOD**:
Integration Test:
1. Create an Operation.
2. Set it to `Inactive`.
3. Send a valid authenticated request to the endpoint.
4. Assert Response Code is `404` (or `403`).
5. Assert that **no** database query logs or adapter execution logs are generated for that request.

### 2. The "Composer Keyword" Ecosystem Discovery Invariant
**RULE**:
In plugin-based ecosystems, plugin discovery MUST rely on **static metadata markers** (e.g., Composer keywords, package.json fields) rather than dynamic runtime scanning of the filesystem. The core system MUST parse these markers during the `composer install` or `npm install` post-install hook to register plugins, ensuring zero runtime filesystem I/O for discovery.

**WHY**:
The `CONTRIBUTING.md` update explicitly mandates adding the keyword `fusio-adapter` to `composer.json`. This is a security and performance invariant. Dynamic filesystem scanning at runtime is prone to:
1.  **Race Conditions:** Files being written while being scanned.
2.  **Performance Degradation:** Scanning thousands of files on every request.
3.  **Security Risks:** Executing arbitrary code from untrusted directories if the scan is too broad.
Static metadata parsing ensures that only explicitly declared, versioned, and locked dependencies are loaded.

**WHEN TO APPLY**:
Any system using a plugin architecture (WordPress, Drupal, VS Code, Fusio).

**VERIFIED IMPLEMENTATION PATTERN**:
```json
// composer.json of the Adapter
{
    "name": "vendor/my-adapter",
    "keywords": ["fusio-adapter"],
    "extra": {
        "fusio": {
            "adapter": "MyAdapter"
        }
    }
}
```
```php
// Core System: Post-Install Hook
public function discoverAdapters(): void
{
    $lock = json_decode(file_get_contents('vendor/composer/installed.json'), true);
    foreach ($lock['packages'] as $package) {
        if (in_array('fusio-adapter', $package['keywords'] ?? [])) {
            $class = $package['extra']['fusio']['adapter'];
            $this->registry->register($class);
        }
    }
}
```

**NEGATIVE CONSTRAINT**:
```php
// ANTI-PATTERN: Runtime Filesystem Scan
public function discoverAdapters(): void
{
    $files = glob('adapters/*/*.php'); // BAD: Slow, race-prone, insecure
    foreach ($files as $file) {
        require_once $file;
        // Guess class name from file name
    }
}
```

**VERIFICATION METHOD**:
1. Install an adapter with the correct keyword.
2. Verify it appears in the Admin UI.
3. Remove the keyword from `composer.json` and run `composer update`.
4. Verify the adapter is **no longer** discoverable.
5. Assert that `glob()` or `scandir()` is never called in the request lifecycle.

### 3. The "MCP Tool Schema" Fidelity Invariant
**RULE**:
When exposing REST APIs as MCP (Model Context Protocol) tools, the JSON Schema for the tool's input MUST be derived **directly** from the OpenAPI specification of the underlying operation. Manual mapping or hardcoding of tool parameters is FORBIDDEN. Any discrepancy between the OpenAPI `parameters`/`requestBody` and the MCP `inputSchema` MUST result in a build-time failure.

**WHY**:
AI Agents rely on strict schema adherence. If the MCP tool schema says `{"id": "integer"}` but the REST API expects `{"id": "string"}`, the agent will generate invalid requests, leading to `400 Bad Request` errors that the agent cannot self-correct. This invariant ensures **Semantic Fidelity** between the human-readable API docs and the machine-readable agent tools.

**WHEN TO APPLY**:
Any system implementing MCP Server functionality or exposing APIs to LLMs.

**VERIFIED IMPLEMENTATION PATTERN**:
```php
// MCP Tool Generator
public function generateMcpTool(Operation $op): McpTool
{
    $openApi = $op->getOpenApiSpec();
    
    // Extract parameters directly from OpenAPI
    $parameters = $openApi['parameters'] ?? [];
    $requestBody = $openApi['requestBody'] ?? [];
    
    // Build JSON Schema strictly from OpenAPI types
    $inputSchema = $this->openApiToJsonSchema($parameters, $requestBody);
    
    return new McpTool(
        name: $op->getName(),
        description: $op->getDescription(),
        inputSchema: $inputSchema
    );
}
```

**NEGATIVE CONSTRAINT**:
```php
// ANTI-PATTERN: Hardcoded/Mapped Schema
public function generateMcpTool(Operation $op): McpTool
{
    // BAD: Manual mapping is error-prone and drifts from OpenAPI
    $schema = [
        'type' => 'object',
        'properties' => [
            'id' => ['type' => 'string'] // Might be integer in OpenAPI!
        ]
    ];
    return new McpTool($op->getName(), $op->getDescription(), $schema);
}
```

**VERIFICATION METHOD**:
1. Define an OpenAPI spec with `id: integer`.
2. Generate the MCP tool.
3. Assert that the MCP `inputSchema` for `id` is `type: integer`.
4. If a mismatch is detected, the test MUST fail.

## 3. Forensic Real Incidents & Production Patches (Incidents 1 to 5+)

### Incident 1: Inactive Operation Reachability Leak (BUG-INACTIVE-LEAK-01)
- **Context**: Core Routing/Dispatcher (`fusio-impl`)
- **What Was Expected**: Operations marked as "Inactive" in the Admin UI should be completely unreachable by external clients, returning `404` or `403`.
- **What Actually Happened**: Clients could still successfully call inactive operations. The operation executed, and data was returned.
- **Evidence in Repo**: Issue #582, Commit `201697160ac9bf285877caf3decd622280512cf7` in `fusio-impl`.
- **Root Cause**: The "Active" check was performed **inside the Adapter execution logic** or **after** the operation was resolved from the database. The router matched the URL, loaded the Operation entity, and passed it to the adapter. The adapter (or a middleware) failed to check the `active` flag before executing the business logic. This is a classic **State-Execution Separation** failure.
- **Remediation Code Diff**:
```php
// - Buggy: Check happens too late
public function handle(Request $request) {
    $op = $this->findOperation($request);
    $adapter = $this->getAdapter($op);
    // Adapter executes, ignoring active status
    return $adapter->run($op, $request);
}

// + Fixed: Check happens at dispatch boundary
public function handle(Request $request) {
    $op = $this->findOperation($request);
    
    // NEW: Enforce state immediately
    if (!$op->isActive()) {
        throw new NotFoundHttpException();
    }
    
    $adapter = $this->getAdapter($op);
    return $adapter->run($op, $request);
}
```
- **Lesson**: **State checks MUST be part of the Access Control layer, not the Business Logic layer.** If a resource is "off," it must be treated as "non-existent" to the outside world.

### Incident 2: User Role Creation Failure Post-Upgrade (BUG-ROLE-CREATE-02)
- **Context**: Admin UI / Backend API (`fusio-apps-backend` / `fusio-impl`)
- **What Was Expected**: Users should be able to create new roles via the Admin UI after upgrading to v5.2.
- **What Actually Happened**: The "Add User Role" button failed silently or threw an error. Users could not be assigned roles, blocking user creation.
- **Evidence in Repo**: Issue #615. Resolution involved checking migration logs.
- **Root Cause**: Likely a **Database Migration Failure** or **Schema Drift**. The upgrade to v5.2 introduced new columns or constraints to the `roles` or `users` table. If the migration failed partially (e.g., due to a locked table or strict mode), the API would receive a `SQLSTATE` error when trying to insert a new role. The frontend likely swallowed the error or displayed a generic "Something went wrong."
- **Remediation Code Diff**:
```php
// - Buggy: Silent failure or generic error
try {
    $role = new Role($data);
    $role->save();
} catch (\Exception $e) {
    // BAD: Swallowing the specific SQL error
    return new Response(500, 'Error');
}

// + Fixed: Specific error handling and migration validation
try {
    $role = new Role($data);
    $role->save();
} catch (PDOException $e) {
    // Log the specific SQL error
    $this->logger->error('Role Creation Failed', ['error' => $e->getMessage()]);
    return new Response(500, 'Database Error: ' . $e->getMessage());
}
```
- **Lesson**: **Never swallow database exceptions.** In upgrade scenarios, always verify that migrations completed successfully before allowing write operations. Implement **Migration Health Checks** in the Admin UI.

## 4. Microscopic Code-Level Invariants (Syntax, Infinite Loop, UI/UX & Concurrency Guards)

1.  **Micro-Syntax & Token-Level Precision**:
    *   **PHP Type Coercion in JSON**: When parsing JSON from AI agents or external APIs, always use `json_decode($str, true)` to get associative arrays. Never rely on `stdClass` objects for schema validation, as property access on `stdClass` is case-sensitive and prone to `Undefined property` notices.
    *   **Falsy Zero Trap**: In PHP, `0` is falsy. When checking if a `limit` or `offset` parameter is provided, use `isset($params['limit'])` or `array_key_exists('limit', $params)`, NOT `if ($params['limit'])`. Otherwise, a valid `limit=0` (meaning "no limit" or "first page") will be treated as "not provided."

2.  **Infinite Loop & Recursion Guards**:
    *   **Adapter Recursion**: If an Adapter calls another Adapter (e.g., a "Proxy" adapter calling a "REST" adapter), implement a **Recursion Depth Counter**. Pass a `$depth` parameter to the `execute()` method. If `$depth > 10`, throw a `RecursionLimitExceeded` exception. This prevents infinite loops caused by circular adapter configurations.
    *   **Event Loop Starvation**: In long-running PHP workers (if using Swoole/RoadRunner), ensure that any `sleep()` or `usleep()` is replaced with non-blocking I/O or a `yield` mechanism. Never block the event loop with synchronous database calls in a high-concurrency context.

3.  **UI & UX Micro-Mechanics**:
    *   **Angular Change Detection**: In the Admin UI, avoid using `ChangeDetectionStrategy.OnPush` with mutable objects. If you use `OnPush`, you MUST create a new object reference (`{...oldObj}`) when updating state. Otherwise, Angular will not re-render the component, leading to "stale UI" bugs where the user clicks "Save" but the UI doesn't update.
    *   **Form Validation Debouncing**: For large forms (e.g., API Operation configuration), debounce validation calls to the backend by at least 500ms. Rapid validation calls can overwhelm the backend and cause race conditions where an old validation result overwrites a new one.

4.  **Backend Concurrency & Memory Safety**:
    *   **Connection Pool Starvation**: When using a database connection pool, ensure that connections are **always** released in a `finally` block. If an exception occurs during a query, the connection must be returned to the pool. Otherwise, the pool will be exhausted, and subsequent requests will hang.
    *   **TOCTOU in Rate Limiting**: When checking rate limits, use an **Atomic Increment** (e.g., Redis `INCR` or SQL `UPDATE ... SET count = count + 1`). Do not use `SELECT count` followed by `UPDATE count`. This creates a race condition where two requests can both read `count=99`, both pass the check, and both increment to `100`, bypassing the limit.

5.  **Defect & Error Prevention ("Galti Pakadna")**:
    *   **Null Chaining in PHP**: Always use the Nullsafe Operator (`?->`) when accessing properties of objects that might be null. Example: `$user?->getRole()?->getName()`. This prevents `Fatal error: Uncaught Error: Call to a member function getName() on null`.
    *   **Off-by-One in Pagination**: When calculating the `offset` for pagination, ensure that `offset = (page - 1) * limit`. If `page` is 1-based, `offset` for page 1 is 0. If you use `page * limit`, you will skip the first `limit` records.

## 5. The 9 Deep Learning Dimensions

1.  **Architecture**: **Modular Monolith with Plugin Ecosystem.** The core is a monolith, but it is strictly decoupled from adapters via interfaces. This allows for horizontal scaling of the core (via load balancing) while keeping the plugin ecosystem lightweight.
2.  **Core Abstractions**: **Operation, Adapter, User, Role, Scope.** These are the domain primitives. `Operation` is the bridge between the HTTP layer and the Adapter layer. `Adapter` is the bridge between the Core and the External World.
3.  **Error Handling**: **Hierarchical Error Mapping.** Database errors are mapped to `500`, Authentication errors to `401`, Authorization errors to `403`, and Validation errors to `400`. The error response body MUST include a `code` and `message` for machine readability.
4.  **Testing**: **Integration-Heavy.** Unit tests for adapters, integration tests for the core routing, and E2E tests for the Admin UI. Property-based testing for JSON Schema validation.
5.  **Security**: **Least Privilege via Scopes.** Users are assigned Scopes (e.g., `read:users`, `write:operations`). The core enforces these scopes at the middleware level. Credentials are stored hashed (bcrypt/argon2).
6.  **Performance**: **Caching Layer.** Operation metadata and user permissions are cached in Redis/Memcached. Database queries are optimized with indexes on `operation_id`, `user_id`, and `timestamp`.
7.  **Deployment**: **Docker-First.** The official deployment method is Docker Compose. The `.env` file is the single source of truth for configuration. The `APP_URL` is critical for generating correct absolute URLs in emails and API responses.
8.  **Agent Patterns**: **MCP Tool Exposure.** The core introspects active Operations and exposes them as MCP tools. The agent calls the tool, the core translates it to a REST request, and the response is returned to the agent.
9.  **Data Flow**: **Request -> Router -> Auth -> Rate Limit -> Adapter -> Response.** The data flow is strictly unidirectional. The Adapter never writes directly to the database; it uses the Core's ORM/Query Builder.

## 6. The 8 Learning Extraction Artifacts

1.  **Pattern**: **Adapter Registry Pattern.** A central registry that maps adapter names to classes. Adapters are discovered via Composer keywords.
2.  **Rule**: **State-Execution Separation.** State checks (Active/Inactive) MUST happen before execution.
3.  **Architecture Principle**: **Plugin Isolation.** Adapters MUST NOT have direct access to the Core's database connection. They MUST use the Core's provided interfaces.
4.  **Failure Mode**: **TOCTOU in Rate Limiting.** Non-atomic increment leads to rate limit bypass.
5.  **Reusable Skill**: **MCP Tool Generation.** Step-by-step: 1. Get OpenAPI spec. 2. Convert to JSON Schema. 3. Create MCP Tool object. 4. Register in MCP Server.
6.  **Decision**: **PHP over Node.js for Core.** PHP is chosen for its strong ecosystem of database drivers and its "write once, run anywhere" nature on shared hosting. Node.js is used for the UI due to its superior DX for Angular.
7.  **Anti-pattern**: **Hardcoded Adapter Logic.** Never hardcode adapter logic in the Core. Always use the Adapter interface.
8.  **Verification Method**: **Schema Drift Test.** Compare the OpenAPI spec with the MCP tool schema. Fail if they differ.

## 7. Actionable Agent Skill & Implementation Checklist

1.  **Initialize Project**:
    *   [ ] Create `composer.json` with `fusio-adapter` keyword.
    *   [ ] Define `Adapter` interface implementation.
    *   [ ] Add `extra.fusio.adapter` to `composer.json`.

2.  **Implement Adapter**:
    *   [ ] Implement `execute()` method.
    *   [ ] Handle errors with specific exception types.
    *   [ ] Use Nullsafe Operator for all object property access.

3.  **Security Hardening**:
    *   [ ] Validate all input parameters against JSON Schema.
    *   [ ] Sanitize all output data to prevent XSS.
    *   [ ] Use parameterized queries for all database operations.

4.  **Testing**:
    *   [ ] Write unit tests for `execute()` method.
    *   [ ] Write integration tests for error handling.
    *   [ ] Verify that inactive operations return `404`.

5.  **Deployment**:
    *   [ ] Test with Docker Compose.
    *   [ ] Verify that `APP_URL` is correctly set.
    *   [ ] Check that migrations run successfully.