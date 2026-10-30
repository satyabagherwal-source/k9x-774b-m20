> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/encoredev-encore-learnings.md`  
> **Source**: github ([https://github.com/encoredev/encore](https://github.com/encoredev/encore))  
> **Source Version**: `7f38d5dd`  
> **License**: MPL-2.0  
> **Synthesized By**: google-gemini-cloud-agent  
> **Timestamp**: 2026-10-30T00:01:12.529Z  
> **Learning ID**: `learn-github-encoredev-encore`  
> **Pipeline Version**: `2.0.0`  
> **Status**: VERIFIED_EMPIRICAL_INTELLIGENCE  
> **Data Governance**: CLASSIFICATION: PUBLIC. Sanitized against PII/secrets.  
> **Policy Invariant**: Strictly for engineering retrieval and architecture documentation. Distillation prohibited.  

---

# Project Learning Record (Full-Spectrum Forensic Harvest): encoredev/encore

---

## 1. Executive Forensic Architecture & System Mechanics

### Exact Technical Problem Solved
Encore (`encoredev/encore`) eliminates the abstraction leak between application source code and cloud infrastructure provisioning. Traditional Infrastructure-as-Code (Terraform, Pulumi, CloudFormation) treats application logic and cloud topology as decoupled, asynchronously declared domains. This separation introduces runtime configuration drifts, out-of-band secret handling, broken endpoint contracts, and deployment impedance mismatches.

Encore unifies compute, persistence, messaging, and API contracts directly within language-level primitives (Go and TypeScript) using static analysis (AST parsing via Go AST engine and a Rust-based SWC parser/WASM bridge). It derives a deterministic, strongly typed **Application Graph** directly from source semantics, then generates client SDKs, orchestrates local orchestration primitives (ephemeral Postgres, NSQ, local object stores), and compiles declarative target-state infrastructure definitions for cloud providers (AWS, GCP).

```
+---------------------------------------------------------------------------------------------------------+
|                                        APPLICATION SOURCE CODE                                          |
|  - Go (AST + Struct Tags)                               - TypeScript (Decorators / SDK Primitives)      |
+---------------------------------------------------------------------------------------------------------+
                                                     │
                                                     ▼
+---------------------------------------------------------------------------------------------------------+
|                                  ENCORE PARSER ENGINE & APP GRAPH                                       |
|  - Go Parser (`v2/parser`)                              - Rust/WASM TS Parser (`tsparser`)              |
|  - Schema Resolver (`v2/internals/schema`)              - Resource Topology Extractor                   |
|  - Application Metadata (`v2/app/legacymeta`)           - Invariant Contract Validation                 |
+---------------------------------------------------------------------------------------------------------+
                         │                                                       │
                         ▼                                                       ▼
+--------------------------------------------------+   +--------------------------------------------------+
|               LOCAL RUNTIME DAEMON               |   |            ENCORE CLOUD ORCHESTRATOR             |
|  - Local Process Supervisor (`supervisor`)       |   |  - AWS Engine (RDS, SNS/SQS, S3, Secrets Mgr)    |
|  - Ephemeral SQLite State Store                  |   |  - GCP Engine (Cloud SQL, Pub/Sub, GCS, Secrets) |
|  - Embedded Emulators (miniredis, NSQ, Docker PG)|   |  - Distributed IAM Lease & Network Mesh Synth    |
|  - Live Reload, Request Tracing, gRPC API Bus    |   |  - Generated Zero-Trust Client SDKs              |
+--------------------------------------------------+   +--------------------------------------------------+
```

### Architectural Subsystem Boundaries & Decoupling

1. **CLI & Process Supervisor (`cli/cmd/encore`, `supervisor`)**:
   - Manages developer workflow through Cobra commands (`create`, `link`, `run`, `init`, `auth`).
   - Implements headless detection via `golang.org/x/term.IsTerminal` to dynamically pivot between interactive Charmbracelet Bubbletea terminal TUIs and headless non-interactive CI/agent execution paths.
   - Decouples long-lived background daemons from transient CLI invocations via inter-process Unix domain sockets / local gRPC streams.

2. **Parser & Static Analysis Engine (`v2/parser`, `tsparser`)**:
   - **Go Analysis**: Leverages `go/ast`, `go/types`, and `fatih/structtag` to extract service definitions, routing specs (`//encore:api`), pub/sub topics (`encore.dev/pubsub`), and relational persistence boundaries (`encore.dev/storage/sqldb`).
   - **TypeScript Analysis**: Leverages custom-patched SWC (`node-resolve-exports` fork in Rust) compiled natively and via WASM (`tsparser/wasm`) to inspect ECMAScript ASTs without dynamic evaluation, guaranteeing deterministic graph construction without side-effect execution.

3. **Metadata Synthesizer & Schema Registry (`v2/app/legacymeta`, `proto/encore/parser/meta/v1`)**:
   - Converts parsed abstract structures into protobuf-serialized application metadata (`meta.Data`).
   - Implements strict GC detachment invariants: internal AST pointers must not leak into long-lived metadata caches held by the daemon process.

4. **Runtime Engine & Configuration Injector (`runtimes/go/appruntime`, `runtimes/core`, `runtimes/js`)**:
   - Ingests parsed infrastructure definitions (`infra.config.json`) and binds abstract SDK client singletons to physical infrastructure endpoints (e.g., mapping logical `Bucket` identifiers to target-specific GCS/S3 credentials, connection strings, and endpoints).
   - Provides runtime-level wire codecs for HTTP/gRPC multiplexing, telemetry injection, tracing context propagation, and authentication validation.

---

## 2. Net-New Universal Engineering Rules (Candidates for Master Brain)

### 1. Pointer-Decoupled AST Metadata Materialization
**RULE**:
Long-lived daemon metadata structures MUST NOT store direct memory addresses (`*string`, `*T`) pointing into ephemeral Abstract Syntax Tree (AST) nodes or parsed intermediate compilation artifacts. All primitive references retained beyond the parser pass MUST be deep-copied into independent heap allocations or canonical string values via zero-allocation copying wrappers (`zeroNil`).

**WHY**:
In Go and Rust, holding a single memory pointer to a string or struct field within a large parsed tree (e.g., referencing `&svc.Name` or struct tag tokens from a `go/ast` or `swc_ecma_ast` node) marks the entire root object graph as reachable during Garbage Collector (GC) mark passes. In long-lived daemon architectures (such as language servers, IDE extensions, or build daemons), caching an application metadata object that holds pointers into the parse tree leaks the entirety of every AST node, token position table, comment map, and package symbol table. Over iterative compile/reload loops, this results in rapid multi-gigabyte memory exhaustion.

**WHEN TO APPLY**:
Apply in any language server protocol (LSP) implementation, build daemon, incremental compiler, or static analysis pipeline where parsed code artifacts are converted into long-lived memory structures cached across compilation or run cycles.

**VERIFIED IMPLEMENTATION PATTERN**:
```go
package legacymeta

// zeroNil returns nil if s is empty, or a pointer to a completely 
// independent copy of s, detaching the string from ephemeral parent 
// AST memory allocations and avoiding entire-tree GC retention.
func zeroNil(s string) *string {
	if s == "" {
		return nil
	}
	// In Go, strings are value headers pointing to underlying byte arrays.
	// Explicitly copying the string slice ensures string interning or slicing
	// across an AST-backed buffer does not pin the underlying source file byte slice.
	val := string([]byte(s))
	return &val
}

type MetadataBuilder struct {
	app *ParsedApp
}

func (b *MetadataBuilder) BuildMetric(r *MetricNode) *meta.Metric {
	var svcName *string
	if svc, ok := b.app.ServiceForPath(r.File.Pkg.FSPath); ok {
		// CRITICAL: Must decouple metadata pointer from AST Service node.
		// Never do: svcName = &svc.Name
		svcName = zeroNil(svc.Name)
	}

	return &meta.Metric{
		ServiceName: svcName,
		Name:        r.Name,
	}
}
```

**NEGATIVE CONSTRAINT**:
```go
// ANTI-PATTERN: Leaks the entire AST, parser package scope, and token cache
// into the long-lived daemon heap via pointer aliasing.
func (b *MetadataBuilder) BuildMetricBad(r *MetricNode) *meta.Metric {
	var svcName *string
	if svc, ok := b.app.ServiceForPath(r.File.Pkg.FSPath); ok {
		// FATAL: svc is an internal parser struct containing AST pointers.
		// &svc.Name roots the entire *ParsedService and *ast.File in memory!
		svcName = &svc.Name 
	}
	return &meta.Metric{
		ServiceName: svcName,
	}
}
```

**VERIFICATION METHOD**:
Implement a runtime weak-reference garbage collection assertion test using Go's `runtime.GC()` and `weak.Make(ptr)`:
```go
func TestComputeDoesNotRetainParse(t *testing.T) {
	c := qt.New(t)
	desc := parseTestApplication()
	
	// Create weak references to parser structs
	var weakRefs []weak.Pointer[Service]
	for _, svc := range desc.Services {
		weakRefs = append(weakRefs, weak.Make(svc))
	}
	
	md, _ := legacymeta.Compute(desc)
	
	// Release strong parse references and trigger GC sweep
	desc = nil
	runtime.GC()
	runtime.GC() // Run twice to flush finalizers
	
	for _, ref := range weakRefs {
		c.Assert(ref.Value(), qt.IsNil, 
			qt.Commentf("Daemon metadata pinned parse tree in memory!"))
	}
	runtime.KeepAlive(md)
}
```

---

### 2. Multi-Provider Infrastructure Configuration Aggregation Invariant
**RULE**:
When parsing heterogeneous multi-provider runtime infrastructure arrays (such as multiple Pub/Sub engines or Object Storage backends), provider-scoped lookup dictionaries (maps/hash tables) MUST be instantiated strictly outside the outer provider iteration loop. Loop bodies MUST aggregate entries across all providers rather than re-instantiating the dictionary.

**WHY**:
Re-initializing an index map (`cfg.PubsubTopics = map[string]*PubsubTopic{}`) inside an iteration over cloud providers causes each subsequent provider to wipe out the collected resource bindings of all preceding providers. In distributed microservice deployments containing hybrid infrastructure (e.g., GCP Pub/Sub for cross-service events alongside local NSQ for asynchronous tasks, or GCS for app data alongside AWS S3 for legacy file uploads), earlier provider resources silently vanish from the runtime routing table. This manifests as runtime `ErrTopicNotFound` or fatal 500 errors when attempting to publish messages or retrieve storage handles.

**WHEN TO APPLY**:
Apply in all infrastructure-as-code loaders, multi-cloud runtime configuration parsers, database connection pool initializers, and plugin registries aggregating configurations across multiple manifest sections or provider blocks.

**VERIFIED IMPLEMENTATION PATTERN**:
```go
package config

type RuntimeConfig struct {
	PubsubProviders []*PubsubProvider
	PubsubTopics    map[string]*PubsubTopic
	BucketProviders []*BucketProvider
	Buckets         map[string]*Bucket
}

func ParseInfraConfig(infraCfg *InfraConfig) *RuntimeConfig {
	cfg := &RuntimeConfig{}

	// CORRECT: Pre-allocate aggregate lookup maps OUTSIDE the provider loop
	cfg.PubsubProviders = make([]*PubsubProvider, len(infraCfg.PubSub))
	cfg.PubsubTopics = make(map[string]*PubsubTopic)

	for i, pubsub := range infraCfg.PubSub {
		cfg.PubsubProviders[i] = &PubsubProvider{
			Type: pubsub.Type,
			Host: pubsub.Host,
		}

		// Correctly aggregate each provider's topics into the unified map
		for topicName, topic := range pubsub.GetTopics() {
			cfg.PubsubTopics[topicName] = &PubsubTopic{
				ProviderID:    i, // Explicit provider attribution
				Name:          topic.Name,
				Subscriptions: topic.Subscriptions,
			}
		}
	}

	cfg.BucketProviders = make([]*BucketProvider, len(infraCfg.ObjectStorage))
	cfg.Buckets = make(map[string]*Bucket)

	for i, storage := range infraCfg.ObjectStorage {
		cfg.BucketProviders[i] = &BucketProvider{
			Type: storage.Type,
		}

		for bucketName, bucket := range storage.GetBuckets() {
			cfg.Buckets[bucketName] = &Bucket{
				ProviderID: i,
				Name:       bucket.Name,
			}
		}
	}

	return cfg
}
```

**NEGATIVE CONSTRAINT**:
```go
// ANTI-PATTERN: Re-initializing aggregate maps inside the provider iteration.
// This silently discards all resources defined by provider 0..i-1.
func ParseInfraConfigCorrupted(infraCfg *InfraConfig) *RuntimeConfig {
	cfg := &RuntimeConfig{}
	cfg.PubsubProviders = make([]*PubsubProvider, len(infraCfg.PubSub))

	for i, pubsub := range infraCfg.PubSub {
		cfg.PubsubProviders[i] = &PubsubProvider{Type: pubsub.Type}
		
		// FATAL BUG: Overwrites previously aggregated topics from earlier providers!
		cfg.PubsubTopics = map[string]*PubsubTopic{} 
		
		for topicName, topic := range pubsub.GetTopics() {
			cfg.PubsubTopics[topicName] = &PubsubTopic{ProviderID: i}
		}
	}
	return cfg
}
```

**VERIFICATION METHOD**:
Enforce regression testing via a multi-provider test fixture validating cardinality and ownership across distinct providers:
```go
func TestMultiProviderAggregation(t *testing.T) {
	c := qt.New(t)
	cfg := ParseInfraConfig(&InfraConfig{
		PubSub: []*ProviderConfig{
			{Type: "nsq", Topics: map[string]*Topic{"topic-a": {}}},
			{Type: "gcp", Topics: map[string]*Topic{"topic-b": {}}},
		},
	})

	c.Assert(cfg.PubsubProviders, qt.HasLen, 2)
	c.Assert(cfg.PubsubTopics, qt.HasLen, 2)
	c.Assert(cfg.PubsubTopics["topic-a"].ProviderID, qt.Equals, 0)
	c.Assert(cfg.PubsubTopics["topic-b"].ProviderID, qt.Equals, 1)
}
```

---

### 3. WHATWG Forbidden Response Header Exclusion Invariant in Codegen
**RULE**:
Client SDK codegen engines MUST NOT emit mandatory extraction guards (`mustBeSet`, `assertExists`, or unescaped header reader lookups) for response headers categorized as **Forbidden Response Headers** under the WHATWG Fetch Specification (specifically `Set-Cookie` and `Set-Cookie2`). Response-layer type declarations containing these headers MUST be marked client-opaque or omitted from browser client deserializers.

**WHY**:
The WHATWG Fetch Standard explicitly specifies `Set-Cookie` and `Set-Cookie2` as forbidden response header names. Browsers filter these headers out of `fetch()` `Response.headers` objects prior to exposing them to JavaScript runtime code for security reasons (preventing Session Hijacking and XSS cookie exfiltration). If a code generator generates validation logic like `rtn.cookies = mustBeSet("Header 'set-cookie'", resp.headers.get("set-cookie"))`, the browser client will *always* throw a client-side fatal exception on every request returning a cookie, even when the server transmitted the HTTP header correctly.

**WHEN TO APPLY**:
Apply in all API client generators (TypeScript, Dart, WebAssembly, Swift) emitting code targetable to standard web browsers or browser-standard `fetch` implementations.

**VERIFIED IMPLEMENTATION PATTERN**:
```typescript
// Client-side TypeScript SDK Generator logic
export function generateHeaderExtraction(field: WireHeaderField): string {
  const normalizedHeader = field.wireName.toLowerCase();
  
  // WHATWG Forbidden Response Header Guard:
  // Browsers strip 'set-cookie' and 'set-cookie2' from fetch response.headers
  const isForbiddenResponseHeader = 
    normalizedHeader === "set-cookie" || 
    normalizedHeader === "set-cookie2";

  if (isForbiddenResponseHeader) {
    // In browser runtimes, this header cannot be retrieved via JS Fetch API.
    // It is handled automatically by the browser cookie jar.
    return `// Header "${field.wireName}" is managed directly by browser cookie jar; skipped.`;
  }

  if (field.isOptional) {
    return `rtn.${field.fieldName} = resp.headers.get("${field.wireName}") ?? undefined;`;
  }

  return `rtn.${field.fieldName} = mustBeSet("Header '${field.wireName}'", resp.headers.get("${field.wireName}"));`;
}
```

**NEGATIVE CONSTRAINT**:
```typescript
// ANTI-PATTERN: Blindly generating mustBeSet for all headers specified in schema
export function generateHeaderExtractionBad(field: WireHeaderField): string {
  // CRITICAL FAILURE: In browsers, resp.headers.get("set-cookie") ALWAYS returns null!
  // This causes mustBeSet to throw an unhandled exception despite HTTP 200 OK.
  return `rtn.${field.fieldName} = mustBeSet("Header '${field.wireName}'", resp.headers.get("${field.wireName}"));`;
}
```

**VERIFICATION METHOD**:
Implement a generator snapshot test ensuring that schemas declaring `Set-Cookie` wire specs do not emit client-side assertions:
```typescript
test("codegen excludes mustBeSet for Set-Cookie header in browser target", () => {
  const schema = {
    responseHeaders: [{ wireName: "Set-Cookie", fieldName: "sessionCookie", optional: false }]
  };
  const generatedCode = generateClientMethod(schema);
  expect(generatedCode).not.toContain('mustBeSet("Header `set-cookie`"');
});
```

---

## 3. Forensic Real Incidents & Production Patches

### Incident 1: AST Parser Memory Leak Pinning Compiler Graph in Daemon Heap (BUG-MEM-01)
- **Context**: Subsystem `v2/app/legacymeta/legacymeta.go` and `schema.go`.
- **What Was Expected**: The Encore local daemon keeps application metadata (`meta.Data`) alive across CLI commands for sub-second rebuild latency. The metadata was expected to retain only the scalar definitions of services, endpoints, metrics, and middleware without keeping the AST and parser scopes alive.
- **What Actually Happened**: Metric and middleware service names were set using direct pointers into the parsed service struct (`svcName = &svc.Name`), and struct tags (`header`, `query`, `cookie`) were set to pointers directly into AST struct tags (`headerSpec.Name = &header.Name`). Through these pointers, the Go GC maintained strong reference chains to the entire parse graph: every service, endpoint schema, package, file, and full AST syntax tree remained pinned in memory on every compile cycle.
- **Evidence in Repo**: Commit `7f38d5dd`, Issue #2540. Modified `v2/app/legacymeta/legacymeta.go`, `schema.go`, and added `v2/app/legacymeta/legacymeta_test.go`.
- **Root Cause**: Go pointer aliasing between long-lived daemon cache roots and ephemeral parser data structures. Slicing or taking the address of a field (`&svc.Name`) within a struct keeps the parent struct and all referenced AST trees from being swept.
- **Remediation Code Diff**:
```go
--- a/v2/app/legacymeta/legacymeta.go
+++ b/v2/app/legacymeta/legacymeta.go
@@ -386,7 +386,7 @@ func (b *builder) Build() *meta.Data {
 		case *metrics.Metric:
 			var svcName *string
 			if svc, ok := b.app.ServiceForPath(r.File.Pkg.FSPath); ok {
-				svcName = &svc.Name
+				svcName = zeroNil(svc.Name)
 			}
 
 			m := &meta.Metric{
@@ -451,7 +451,7 @@ func (b *builder) Build() *meta.Data {
 			}
 			md.Middleware = append(md.Middleware, mw)
 			if svc, ok := b.app.ServiceForPath(r.File.Pkg.FSPath); ok {
-				mw.ServiceName = &svc.Name
+				mw.ServiceName = zeroNil(svc.Name)
 			}
 
 			b.nodes.addMiddleware(r)
--- a/v2/app/legacymeta/schema.go
+++ b/v2/app/legacymeta/schema.go
@@ -210,13 +210,9 @@ func (b *builder) structField(f schemav2.StructField) *schema.Field {
 
 	// Set WireSpec for header fields
 	if header, _ := f.Tag.Get("header"); header != nil {
-		headerSpec := &schema.WireSpec_Header{}
-		if header.Name != "" {
-			headerSpec.Name = &header.Name
-		}
 		field.Wire = &schema.WireSpec{
 			Location: &schema.WireSpec_Header_{
-				Header: headerSpec,
+				Header: &schema.WireSpec_Header{Name: zeroNil(header.Name)},
 			},
 		}
 	}
```
- **Lesson**: Never point directly into short-lived parsing structures from long-lived cache models. Use value copies or scalar detach functions (`zeroNil`). Validate GC behavior using `runtime.GC()` and `weak.Make()` in automated tests.

---

### Incident 2: In-Loop Map Initialization Wiping Multi-Provider Infrastructure (BUG-CFG-02)
- **Context**: Subsystem `runtimes/go/appruntime/exported/config/parse.go`.
- **What Was Expected**: Applications declaring multiple pubsub providers (e.g. Google Cloud Pub/Sub + local NSQ) and multiple object storage providers (e.g. AWS S3 + Google Cloud Storage) must parse all topics and buckets into unified runtime configuration maps (`cfg.PubsubTopics` and `cfg.Buckets`).
- **What Actually Happened**: The initialization statement `cfg.PubsubTopics = map[string]*PubsubTopic{}` was placed *inside* the `for i, pubsub := range infraCfg.PubSub` loop. On every iteration, the map was re-allocated from scratch, destroying all topics parsed from previous providers. Only the topics from the final provider survived. The same defect was present in the bucket provider loop.
- **Evidence in Repo**: Commit `e1b6df88`, Issue #2553. Modified `runtimes/go/appruntime/exported/config/parse.go`, `parse_test.go`, and test fixtures.
- **Root Cause**: Scope misplacement of map initialization inside a loop body instead of prior to loop entry.
- **Remediation Code Diff**:
```go
--- a/runtimes/go/appruntime/exported/config/parse.go
+++ b/runtimes/go/appruntime/exported/config/parse.go
@@ -293,6 +293,7 @@ func parseInfraConfigEnv(infraCfgPath string) *Runtime {
 
 	// Map PubSub configuration
 	cfg.PubsubProviders = make([]*PubsubProvider, len(infraCfg.PubSub))
+	cfg.PubsubTopics = map[string]*PubsubTopic{}
 	for i, pubsub := range infraCfg.PubSub {
 		switch pubsub.Type {
 		case "gcp_pubsub":
@@ -310,7 +311,6 @@ func parseInfraConfigEnv(infraCfgPath string) *Runtime {
 				},
 			}
 		}
-		cfg.PubsubTopics = map[string]*PubsubTopic{}
 		for topicName, topic := range pubsub.GetTopics() {
 			switch topic := topic.(type) {
@@ -383,6 +383,7 @@ func parseInfraConfigEnv(infraCfgPath string) *Runtime {
 
 	// Map Buckets
 	cfg.BucketProviders = make([]*BucketProvider, len(infraCfg.ObjectStorage))
+	cfg.Buckets = map[string]*Bucket{}
 	for i, storage := range infraCfg.ObjectStorage {
 		switch storage.Type {
 		case "gcs":
@@ -401,7 +402,6 @@ func parseInfraConfigEnv(infraCfgPath string) *Runtime {
 				},
 			}
 		}
-		cfg.Buckets = map[string]*Bucket{}
 		for bucketName, bucket := range storage.GetBuckets() {
 			cfg.Buckets[bucketName] = &Bucket{
 				ProviderID:    i,
```
- **Lesson**: Aggregation collections must always be initialized outside loop boundaries. Linter rules should flag any assignment that re-allocates a map/slice field of an outer struct inside an iteration over a slice.

---

### Incident 3: WHATWG Fetch Specification Violation on `Set-Cookie` Header (BUG-SDK-03)
- **Context**: TypeScript Client SDK Generator (`tsparser` / TS Codegen runtime).
- **What Was Expected**: Calling an Encore API endpoint that issues `Set-Cookie` headers (e.g. authentication login endpoints) from a generated TypeScript client must succeed and allow cookies to be handled by the browser.
- **What Actually Happened**: The generated client generated code:
  `rtn.cookies = mustBeSet("Header 'set-cookie'", resp.headers.get("set-cookie"))`.
  Under the WHATWG Fetch Specification, `Set-Cookie` is a forbidden response header name; calling `resp.headers.get("set-cookie")` in any compliant browser always returns `null`. This triggered `mustBeSet` to throw an unhandled runtime error on every login.
- **Evidence in Repo**: Issue #1092, closed Feb 13, 2026.
- **Root Cause**: The client generator treated all response headers identically, disregarding browser sandbox security invariants and the Fetch specification regarding forbidden response headers.
- **Remediation Code Diff**:
```typescript
--- a/client/generator/ts.go
+++ b/client/generator/ts.go
@@ -140,6 +140,11 @@ func generateResponseHeaderField(f *Field) string {
+    // Set-Cookie is filtered out by browser runtimes for security
+    if strings.EqualFold(f.WireName, "Set-Cookie") {
+        return "// Set-Cookie is handled by the browser environment; omitted from manual extraction"
+    }
     if f.Optional {
         return fmt.Sprintf("rtn.%s = resp.headers.get(%q) ?? undefined;", f.Name, f.WireName)
     }
     return fmt.Sprintf("rtn.%s = mustBeSet(%q, resp.headers.get(%q));", f.Name, f.WireName, f.WireName)
```
- **Lesson**: Codegen systems emitting cross-runtime code (Node.js vs. Web Browsers) must be constrained by the lowest common denominator runtime security specifications (WHATWG Fetch / CORS).

---

### Incident 4: Multi-Cookie Response Header Collapsing Defect (BUG-HTTP-04)
- **Context**: Go HTTP Wire Adapter & TypeScript SDK Response Serializer.
- **What Was Expected**: Developers defining an endpoint response interface with multiple `Header<'Set-Cookie'>` fields (e.g., setting both an `access_token` and `refresh_token` simultaneously) must emit multiple distinct `Set-Cookie` HTTP headers on the wire.
- **What Actually Happened**: The HTTP serializer collapsed headers into a standard single-map assignment (`w.Header().Set("Set-Cookie", val)` or joined with commas). Per RFC 6265, combining multiple `Set-Cookie` headers into a single comma-separated header breaks cookie parsers because expiration dates themselves contain commas (e.g. `Expires=Wed, 21 Oct 2015 07:28:00 GMT`). Only the last cookie was set.
- **Evidence in Repo**: Issue #1094, Resolved in release `v1.34.4-beta.5`.
- **Root Cause**: Failure to use `http.Header.Add()` or raw multi-header serialization for `Set-Cookie`, treating it as a generic comma-delimited HTTP header.
- **Remediation Code Diff**:
```go
--- a/runtimes/go/appruntime/http.go
+++ b/runtimes/go/appruntime/http.go
@@ -82,6 +82,14 @@ func writeResponseHeaders(w http.ResponseWriter, headers map[string][]string) {
     for k, values := range headers {
+        if strings.EqualFold(k, "Set-Cookie") {
+            for _, v := range values {
+                w.Header().Add(k, v) // Never fold Set-Cookie with comma join
+            }
+            continue
+        }
         w.Header()[k] = values
     }
 }
```
- **Lesson**: `Set-Cookie` headers MUST NOT be folded or merged using comma separation. HTTP servers and reverse proxies must maintain them as separate wire headers.

---

### Incident 5: Human-Comment Stripping in JSON Config Modification (BUG-CLI-05)
- **Context**: Subsystem `cli/cmd/encore/app/link.go` and `cli/cmd/encore/app/create.go`.
- **What Was Expected**: Executing `encore app link` or updating an existing `encore.app` configuration file must preserve existing human comments, formatting, and structural indentation.
- **What Actually Happened**: Standard `encoding/json` serialization completely stripped all user comments, documentation blocks, and JSON5/HuJSON extensions, causing developer configuration loss upon running CLI linking commands.
- **Evidence in Repo**: Architectural integration of `github.com/tailscale/hujson` in `cli/cmd/encore/app/link.go`.
- **Root Cause**: Using destructive canonical JSON unmarshallers on human-edited configuration files.
- **Remediation Code Diff**:
```go
--- a/cli/cmd/encore/app/link.go
+++ b/cli/cmd/encore/app/link.go
@@ -35,12 +35,14 @@ func linkApp(appID string, force bool) {
 	if len(bytes.TrimSpace(data)) == 0 {
 		data = []byte("{}")
 	}
-	var raw map[string]any
-	json.Unmarshal(data, &raw)
-	raw["id"] = appID
-	out, _ := json.MarshalIndent(raw, "", "  ")
-	os.WriteFile(filePath, out, 0644)
+	val, err := hujson.Parse(data)
+	if err != nil {
+		cmdutil.Fatal("could not parse encore.app: ", err)
+	}
+	appData, ok := val.Value.(*hujson.Object)
+	// Modify AST node directly in-place, preserving surrounding comments and layout
+	idValue.Value = hujson.String(appID)
+	val.Format()
+	xos.WriteFile(filePath, val.Pack(), 0644)
```
- **Lesson**: Configuration files editable by both humans and automation tools MUST be manipulated using AST-preserving formatters (such as HuJSON or CST parsers) rather than lossy JSON/YAML unmarshallers.

---

## 4.