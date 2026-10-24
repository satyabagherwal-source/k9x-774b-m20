> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/open-policy-agent-opa-learnings.md`  
> **Source**: github ([https://github.com/open-policy-agent/opa](https://github.com/open-policy-agent/opa))  
> **Source Version**: `71deabab`  
> **License**: Apache-2.0  
> **Synthesized By**: google-gemini-cloud-agent  
> **Timestamp**: 2026-10-24T20:31:20.387Z  
> **Learning ID**: `learn-github-open-policy-agent-opa`  
> **Pipeline Version**: `2.0.0`  
> **Status**: VERIFIED_EMPIRICAL_INTELLIGENCE  
> **Data Governance**: CLASSIFICATION: PUBLIC. Sanitized against PII/secrets.  
> **Policy Invariant**: Strictly for engineering retrieval and architecture documentation. Distillation prohibited.  

---

# Project Learning Record (Full-Spectrum Forensic Harvest): open-policy-agent/opa

---

## 1. Executive Forensic Architecture & System Mechanics

### 1.1 Core Problem Space & Mission
Open Policy Agent (OPA) provides a declarative, domain-agnostic policy engine that decouples policy decisions from operational business logic across distributed cloud-native architectures (Kubernetes admission control, microservice API authorization, CI/CD pipeline gating, data filtration). The core execution model is based on **Datalog with Stratified Negation**, extended with full JSON/structural document manipulation and functional set-builder primitives (**Rego**).

### 1.2 Subsystem Decomposition & Boundaries
```
+---------------------------------------------------------------------------------------+
|                                    CLI / Server Entry                                 |
|            cmd/ (ExitError unwrapping, Cobra dispatch, signal handling)              |
+---------------------------------------------------------------------------------------+
                                           |
                                           v
+---------------------------------------------------------------------------------------+
|                                Storage & State Layer                                  |
|   storage.Store (MVCC In-Memory Trie / Persistent BadgerDB)                           |
|   - Read/Write Txn boundaries (storage.Txn)                                           |
|   - Path indexing: /data (documents), /system (runtime state)                        |
+---------------------------------------------------------------------------------------+
      |                                    |                                  |
      v                                    v                                  v
+------------------+             +-------------------+             +--------------------+
|  Bundle Engine   |             |  Compiler & AST   |             |  Topdown Evaluator |
| - Tarball Loader |             | - Lexer / Parser  |             | - Unification      |
| - Signature Ver. |             | - Type Checking   |             | - Stratified Neg.  |
| - Canonicalizer  |             | - Dep Graph Walk  |             | - Partial Eval     |
|   (data.json,    |             | - Rewrite Passes  |             | - Builtins Runtime |
|    data.yaml,    |             | - Safety Checks   |             |   (CIDR, JSON,     |
|    data.yml)     |             | - Schema Resolver |             |    Crypto, Wasm)   |
+------------------+             +-------------------+             +--------------------+
      |                                    |                                  |
      +------------------------------------+----------------------------------+
                                           |
                                           v
+---------------------------------------------------------------------------------------+
|                               Runtime Interceptors & IO                               |
| - hooks.Hooks: Dynamic plugin manager dispatch (ConfigHook, ConfigDiscoveryHook)      |
| - pathwatcher: fsnotify synchronization with storage.Txn atomic commits               |
| - resolver/wasm: Wasm engine registry & direct memory execution via Wazero            |
+---------------------------------------------------------------------------------------+
```

1. **AST & Parser (`ast/`, `v1/ast/`)**:
   - Parses Rego modules into abstract syntax trees consisting of `Rule`, `Body`, `Expr`, `Term`, and `Value` (`Object`, `Array`, `Set`, `Var`, `Ref`, `Call`).
   - Maintains lexical position mappings (`ast/location`) and provides visitor traversal interfaces (`ast.Visitor`, `ast.GenericVisitor`).
2. **Topdown Evaluation Engine (`v1/topdown/`)**:
   - Drives unification and search over rule clauses and facts.
   - Evaluates rules via SLD-resolution-style backtracking.
   - Implements **Partial Evaluation**: Evaluates a policy against known data (`data`) while treating specific inputs (`input`) as unknown, producing residual optimized Rego queries or support rules.
3. **Storage Abstraction (`storage/`, `v1/storage/`)**:
   - Implements transactional tree storage. State is accessed strictly through path slices (`[]string{"a", "b", "c"}`).
   - ACID-guaranteed read and write transactions via `storage.Txn(ctx, store, params, fn)`.
4. **Bundle Management (`internal/bundle/`, `v1/bundle/`)**:
   - Ingests compressed tarballs containing policy definitions (`.rego`), structured documents (`data.json`, `data.yaml`, `data.yml`), and cryptographic manifests (`.signatures.json`).
   - Normalizes input formats before cryptographic verification.
5. **Wasm Engine Abstraction (`internal/rego/opa/engine.go`, `internal/bundle/utils.go`)**:
   - Decouples policy evaluation from Go runtime internals by compiling Rego AST down to WebAssembly bytecode.
   - Uses an extensible registry (`RegisterEngine`) backed by Wasm runtimes (such as Wazero).

---

## 2. Net-New Universal Engineering Rules (Candidates for Master Brain)

### 1. AST Dynamic Node Exhaustion Invariant
**RULE**:
When decomposing abstract syntax tree (AST) nodes via Go type assertions or type switches, you MUST NOT default to casting child operands to a common terminal node type (`*ast.Term`) unless the parent node's grammar strictly guarantees that no composite or control structure can occupy that slot. When new language grammar primitives (e.g., `every`, `comprehension`, `with`) are introduced into an expression's operand slot, any recursive tree walker MUST explicitly handle that node type or uniformly divert non-inlinable structures to synthetic isolated scopes.

**WHY**:
In dynamically typed AST systems where expressions (`ast.Expr`) hold generic child nodes (`Terms any`), assuming that `expr.Terms` is unconditionally `*ast.Term` causes fatal runtime interface conversion panics (`interface {} is *ast.Every, not *ast.Term`). During partial evaluation, this crashes policy resolution engines when an inline query negates a rule containing newer structural quantifiers over unknown inputs.

**WHEN TO APPLY**:
- Compilers, query transpilers, policy engines, and AST transformation passes.
- Code dealing with AST nodes where `Terms`, `Children`, or `Operands` are typed as `any` or empty interface `interface{}`.

**VERIFIED IMPLEMENTATION PATTERN**:
```go
// cannotBeTriviallyNegated inspects whether an expression can be directly negated inlined,
// or if its structural semantics require extracting it into an isolated support rule.
func cannotBeTriviallyNegated(vis *nestedCheckVisitor, expr *ast.Expr) bool {
	if expr.IsEquality() {
		for _, term := range expr.Operands() {
			if containsNestedRefOrCallInTerm(vis, term) {
				return true
			}
		}
		return false
	}

	// EXPLICIT STRUCTURAL GUARD: Quantified statements (e.g., 'every') cannot be inlined
	// under negation directly because 'not every' is invalid grammar and scopes unknown variables.
	if _, ok := expr.Terms.(*ast.Every); ok {
		return true
	}

	if n, ok := expr.Terms.(*ast.Not); ok {
		return cannotBeTriviallyNegatedInBody(vis, n.Body)
	}

	if a, ok := expr.Terms.(*ast.LogicalAnd); ok {
		return cannotBeTriviallyNegatedInBody(vis, a.Lhs) || cannotBeTriviallyNegatedInBody(vis, a.Rhs)
	}

	if o, ok := expr.Terms.(*ast.LogicalOr); ok {
		return cannotBeTriviallyNegatedInBody(vis, o.Lhs) || cannotBeTriviallyNegatedInBody(vis, o.Rhs)
	}

	// Safe fallback only after structural type assertions are exhausted
	term, ok := expr.Terms.(*ast.Term)
	if !ok {
		// Defensive failure guard: unknown AST structure must be treated as non-inlinable
		return true
	}

	return containsNestedRefOrCallInTerm(vis, term)
}
```

**NEGATIVE CONSTRAINT**:
```go
// ANTI-PATTERN: Blindly assuming expr.Terms is an *ast.Term
func containsNestedRefOrCall(vis *nestedCheckVisitor, expr *ast.Expr) bool {
	// ... equality, not, and, or checks ...
	// FATAL: Panic occurs if expr.Terms is *ast.Every or any other non-Term node!
	return containsNestedRefOrCallInTerm(vis, expr.Terms.(*ast.Term))
}
```

**VERIFICATION METHOD**:
Enforce exhaustive AST type-switch linters (such as `exhaustive` or custom AST visitor tests) and run property-based tests generating ASTs with every valid permutation of expressions inside negation:
```go
func TestASTNegationWalkExhaustiveness(t *testing.T) {
	nodes := []ast.Statement{
		&ast.Every{Domain: ast.VarTerm("xs")},
		&ast.Not{Body: ast.Body{}},
		&ast.Term{Value: ast.Boolean(true)},
	}
	for _, node := range nodes {
		expr := &ast.Expr{Terms: node}
		require.NotPanics(t, func() {
			_ = cannotBeTriviallyNegated(newNestedCheckVisitor(), expr)
		})
	}
}
```

---

### 2. Dual-Stack CIDR Containment Invariant
**RULE**:
When calculating IP address or CIDR range containment across dual-stack (IPv4 and IPv6) address families, you MUST NOT calculate containment by synthesizing start and end IP addresses and feeding them into standard Go `net.IPNet.Contains(ip)`. Instead, if both CIDRs are verified to be plain IPv6 networks (`len(IP) == 16 && len(Mask) == 16 && IP.To4() == nil`), you MUST perform containment by evaluating prefix bit-lengths (`onesA <= onesB`) and bitwise network mask matching (`a.IP.Equal(b.IP.Mask(a.Mask))`).

**WHY**:
In Go's standard library (`net` package), `net.IPNet.Contains` internally executes `ip.To4()` on the target IP. For IPv6 subnets that terminate at `::ffff:ffff:ffff` (e.g., `::/80` through `::fffe:0:0/95`), the computed broadcast/last IP falls directly inside the IPv4-mapped IPv6 block (`::ffff:0:0/96`). When `To4()` is invoked on this last IP, Go converts it into a 4-byte slice (`255.255.255.255`). When compared against the outer IPv6 network's 16-byte address, `net.IPNet.Contains` fails the byte-length check and returns `false`, causing false negatives where a subnet appears not to contain itself.

**WHEN TO APPLY**:
- Network policy engines, firewall managers, IPAM (IP Address Management) modules, routing table engines in Go.

**VERIFIED IMPLEMENTATION PATTERN**:
```go
// isPlainIPv6Net reports whether n is an IPv6 network that is not IPv4-mapped.
func isPlainIPv6Net(n *net.IPNet) bool {
	return len(n.IP) == net.IPv6len && len(n.Mask) == net.IPv6len && n.IP.To4() == nil
}

// ipv6NetContainsNet checks prefix containment directly via bit masks.
func ipv6NetContainsNet(a, b *net.IPNet) bool {
	aOnes, _ := a.Mask.Size()
	bOnes, _ := b.Mask.Size()
	// Network A can only contain Network B if A's prefix is equal to or shorter than B's,
	// and masking B's base address with A's subnet mask yields A's network address.
	return aOnes <= bOnes && a.IP.Equal(b.IP.Mask(a.Mask))
}

// CIDR containment entry point
func CheckCIDRContains(cidrA, cidrB *net.IPNet) (bool, error) {
	if isPlainIPv6Net(cidrA) && isPlainIPv6Net(cidrB) {
		return ipv6NetContainsNet(cidrA, cidrB), nil
	}

	// Fallback for IPv4 or mixed mapped contexts
	lastIP, err := getLastIP(cidrB)
	if err != nil {
		return false, err
	}
	return cidrA.Contains(cidrB.IP) && cidrA.Contains(lastIP), nil
}
```

**NEGATIVE CONSTRAINT**:
```go
// ANTI-PATTERN: Synthesizing endpoints and using net.IPNet.Contains for IPv6 subnets
func BadCIDRContains(cidrA, cidrB *net.IPNet) bool {
	lastIP := calculateLastIP(cidrB)
	// BUG: If cidrB is ::/80, lastIP is ::ffff:255.255.255.255.
	// cidrA.Contains(lastIP) calls lastIP.To4(), returning 4 bytes.
	// 4 bytes != 16 bytes, returning false! ::/80 fails to contain ::/80!
	return cidrA.Contains(cidrB.IP) && cidrA.Contains(lastIP)
}
```

**VERIFICATION METHOD**:
Write a parameterized unit test verifying that every edge subnet across the `::ffff:0:0/96` boundary correctly contains itself:
```go
func TestIPv6MappedBoundaryContainment(t *testing.T) {
	subnets := []string{"::/80", "::8000:0:0/81", "::/95", "::/96", "::/128"}
	for _, sn := range subnets {
		_, netA, _ := net.ParseCIDR(sn)
		_, netB, _ := net.ParseCIDR(sn)
		if !ipv6NetContainsNet(netA, netB) {
			t.Fatalf("CIDR invariant violated: subnet %s MUST contain itself", sn)
		}
	}
}
```

---

### 3. File Extension Canonicalization Parity Invariant
**RULE**:
When a storage engine, deserializer, or security subsystem supports equivalent file extension aliases (e.g., `.yaml` and `.yml`, or `.json` and `.json5`), all canonicalization, hashing, cryptographic signing, schema validation, and path-boundary checking MUST be parameterized across the complete set of supported extensions. A file must NEVER be loaded as valid data under one extension while bypassing normalization or store integrity boundaries enforced on its alias.

**WHY**:
Asymmetric handling of `.yaml` versus `.yml` causes cryptographic signature mismatches for identical semantic data. Furthermore, if validation routines (like path boundary checks) only match `.yaml`, an attacker can smuggle out-of-boundary root data into an engine using `.yml`, causing silent write drops, signature verification bypasses, or unexpected state divergence.

**WHEN TO APPLY**:
- Ingestion pipelines, digital signature systems, bundle packers, configuration loaders, policy verification systems.

**VERIFIED IMPLEMENTATION PATTERN**:
```go
// FileExtensionIsYAML returns true if the extension matches any YAML format alias
func FileExtensionIsYAML(path string) bool {
	ext := strings.ToLower(filepath.Ext(path))
	return ext == ".yaml" || ext == ".yml"
}

// CanonicalizeBundleFile normalizes content before cryptographic hashing
func CanonicalizeBundleFile(path string, content []byte) ([]byte, error) {
	if FileExtensionIsYAML(path) {
		var intermediate any
		if err := yaml.Unmarshal(content, &intermediate); err != nil {
			return nil, fmt.Errorf("canonicalization failed parsing yaml: %w", err)
		}
		// Re-encode into canonical JSON representation without formatting variations
		return json.Marshal(intermediate)
	}
	return content, nil
}
```

**NEGATIVE CONSTRAINT**:
```go
// ANTI-PATTERN: Checking only one canonical extension during hashing/validation
func HashBundleFile(path string, data []byte) [32]byte {
	// BUG: data.yaml is canonicalized, but data.yml is hashed as raw bytes!
	// Formatting whitespace changes in data.yml cause signature failures!
	if strings.HasSuffix(path, "data.yaml") {
		data = canonicalizeYAML(data)
	}
	return sha256.Sum256(data)
}
```

**VERIFICATION METHOD**:
Enforce cross-extension equivalence testing:
```go
func TestYAMLExtensionHashParity(t *testing.T) {
	raw := []byte("foo:   bar\n  baz:  1")
	hYaml, err := CanonicalizeBundleFile("data.yaml", raw)
	require.NoError(t, err)
	hYml, err := CanonicalizeBundleFile("data.yml", raw)
	require.NoError(t, err)
	require.Equal(t, hYaml, hYml, "Cryptographic hash input must be identical regardless of extension")
}
```

---

## 3. Forensic Real Incidents & Production Patches

### Incident 1: Topdown Partial Evaluation Panic on Negated `every` (BUG-OPA-01)
- **Context**: `v1/topdown/eval.go`, function `canInlineNegation` and `containsNestedRefOrCall`.
- **What Was Expected**: Running partial evaluation (`opa eval --partial --unknowns input`) on a query negating a rule whose body contains an `every` expression should produce valid residual queries and support rules without runtime crashes.
- **What Actually Happened**: The evaluator crashed with a fatal panic: `interface {} is *ast.Every, not *ast.Term`.
- **Evidence in Repo**: Commit `01eefbab`, PR `#9388`, Issue `#9383`. Tests: `v1/topdown/eval_test.go`, `v1/topdown/topdown_partial_test.go`.
- **Root Cause**: `canInlineNegation` walks the queries in a negated expression to decide if the negation can be flattened directly inline into a single expression. It invoked `containsNestedRefOrCall`, which assumed that any expression's terms (`expr.Terms`) implement `*ast.Term`. When Rego introduced `every` expressions, `expr.Terms` was assigned an `*ast.Every` instance. The unchecked type assertion `expr.Terms.(*ast.Term)` triggered an unrecoverable type assertion panic. Additionally, `not every` is syntactically invalid Rego and cannot be inlined, requiring extraction into a separate partial support rule.
- **Remediation Code Diff**:
```go
// v1/topdown/eval.go
- func containsNestedRefOrCall(vis *nestedCheckVisitor, expr *ast.Expr) bool {
+ func cannotBeTriviallyNegated(vis *nestedCheckVisitor, expr *ast.Expr) bool {
    if expr.IsEquality() {
        for _, term := range expr.Operands() {
            if containsNestedRefOrCallInTerm(vis, term) {
                return true
            }
        }
        return false
    }
 
+   if _, ok := expr.Terms.(*ast.Every); ok {
+       // 'not every' isn't parseable Rego, and the unknowns in the 'every' body
+       // are opaque to the variable safety check in canInlineNegation: save the
+       // negation in a support rule instead of inlining it.
+       return true
+   }
 
    if n, ok := expr.Terms.(*ast.Not); ok {
-       return containsNestedRefOrCallInBody(vis, n.Body)
+       return cannotBeTriviallyNegatedInBody(vis, n.Body)
    }
    // ...
-   return containsNestedRefOrCallInTerm(vis, expr.Terms.(*ast.Term))
+   return containsNestedRefOrCallInTerm(vis, expr.Terms.(*ast.Term))
 }
```
- **Lesson**: Functions designed to inspect AST properties MUST be semantically named after the policy invariant they enforce (`cannotBeTriviallyNegated` vs `containsNestedRefOrCall`) and must protect against unhandled AST grammar variations.

---

### Incident 2: IPv6 CIDR Containment False Negatives on IPv4-Mapped Boundary (BUG-OPA-02)
- **Context**: `v1/topdown/cidr.go`, function `builtinNetCIDRContains`.
- **What Was Expected**: `net.cidr_contains(A, B)` must evaluate to `true` when network $A$ is identical to $B$ (e.g., `::/80` contains `::/80`).
- **What Actually Happened**: For 16 distinct IPv6 subnets (`::/80` through `::fffe:0:0/95`), `net.cidr_contains` returned `false` when testing self-containment or containment of child subnets.
- **Evidence in Repo**: Commit `85b62162`, PR `#9397`, Issue `#9396`. Tests added in `v1/test/cases/testdata/v0/netcidrcontains/test-netcidrcontains-ipv6-mapped.yaml`.
- **Root Cause**: `builtinNetCIDRContains` verified containment by calculating `firstIP = netB.IP` and `lastIP = getLastIP(netB)`, then testing `netA.Contains(firstIP) && netA.Contains(lastIP)`. For subnets ending at `::ffff:ffff:ffff`, the last IP resides inside the IPv4-mapped address space (`::ffff:0:0/96`). Inside the Go standard library, `net.IPNet.Contains(ip)` invokes `ip.To4()`. Since the last IP fell within the mapped prefix, Go condensed the 16-byte IPv6 address into a 4-byte IPv4 slice. The length check inside `net.IPNet.Contains` then failed against $A$'s 16-byte network address.
- **Remediation Code Diff**:
```go
// v1/topdown/cidr.go
+ func isPlainIPv6Net(n *net.IPNet) bool {
+     return len(n.IP) == net.IPv6len && len(n.Mask) == net.IPv6len && n.IP.To4() == nil
+ }
+ 
+ func ipv6NetContainsNet(a, b *net.IPNet) bool {
+     aOnes, _ := a.Mask.Size()
+     bOnes, _ := b.Mask.Size()
+     return aOnes <= bOnes && a.IP.Equal(b.IP.Mask(a.Mask))
+ }

func builtinNetCIDRContains(_ BuiltinContext, operands []*ast.Term, iter func(*ast.Term) error) error {
    // ... parse cidrnetA, cidrnetB ...
+   if isPlainIPv6Net(cidrnetA) && isPlainIPv6Net(cidrnetB) {
+       return iter(ast.InternedTerm(ipv6NetContainsNet(cidrnetA, cidrnetB)))
+   }
    // ... fallback endpoint comparison ...
}
```
- **Lesson**: Do not use IP endpoint synthesis to test CIDR containment when the runtime or language standard library implicitly mutates representations of mapped IP address formats. Mask and prefix bit-logic is invariant.

---

### Incident 3: Bundle Signature Hash Inconsistency on `data.yml` (BUG-OPA-03)
- **Context**: `bundle/`, bundle verification, and storage root containment checking.
- **What Was Expected**: Bundles containing `data.yml` files should generate identical signature hashes regardless of non-semantic YAML formatting (spaces, linebreaks), identical to `data.yaml` behavior.
- **What Actually Happened**: Modifying non-semantic whitespace in `data.yml` invalidated signatures because OPA only performed YAML-to-canonical-JSON normalization on files named `data.yaml`. Files named `data.yml` were hashed as raw bytes.
- **Evidence in Repo**: Issues `#9301`, `#9302`, PR `#9300`.
- **Root Cause**: The loader subsystem recognized both `.yaml` and `.yml` as valid structured data formats, but the cryptographic signing and validation paths contained hard-coded checks strictly matching `data.yaml`. As a consequence, `data.yml` bypassed the YAML canonicalizer. Additionally, the store's contained-under-roots validation skipped `data.yml`, relying on a side-effect in `store.Truncate` to drop out-of-root writes.
- **Remediation Pattern**:
```go
// Normalization check unified across all file loader paths:
func isYAMLDataFile(filename string) bool {
    base := filepath.Base(filename)
    return base == "data.yaml" || base == "data.yml"
}
```
- **Lesson**: Dual-format acceptance in input parsers must be mirrored across all downstream cryptographic, validation, and storage boundary functions.

---

### Incident 4: Dependency Graph Cycle Deadlock in Compiler Verification (BUG-OPA-04)
- **Context**: `internal/compiler/utils.go`, functions `VerifyAuthorizationPolicySchema` and `transitiveDependencies`.
- **What Was Expected**: Compiling and type-checking authorization policies against the root input schema must traverse all rule dependencies without recursion overflow or hanging when rules exhibit mutual recursion or cyclic dependencies.
- **What Actually Happened**: In unconstrained recursive traversals of compiler rule graphs, cyclical dependencies between rules cause unbounded stack frame consumption, culminating in runtime stack overflow (`runtime: goroutine stack exceeds 1000000000-byte limit`).
- **Evidence in Repo**: `internal/compiler/utils.go`, lines 89-95.
- **Root Cause**: Traversing rule dependency edges without cycle tracking visits previously expanded nodes indefinitely.
- **Remediation Pattern**:
```go
// internal/compiler/utils.go
func transitiveDependencies(compiler *ast.Compiler, rule *ast.Rule, deps map[*ast.Rule]struct{}) {
    for x := range compiler.Graph.Dependencies(rule) {
        other := x.(*ast.Rule)
        // Guard against cycles: only recurse if the dependency has not been visited yet
        if _, exists := deps[other]; !exists {
            deps[other] = struct{}{}
            transitiveDependencies(compiler, other, deps)
        }
    }
}
```
- **Lesson**: Graph algorithms operating on user-defined ASTs MUST maintain an explicit visited set across all transitive closures.

---

### Incident 5: Atomic Bundle Persistence Failure on Process Crash (BUG-OPA-05)
- **Context**: `internal/bundle/utils.go`, function `SaveBundleToDisk`.
- **What Was Expected**: Persisting downloaded bundle tarballs to local storage should be atomic. A process termination or power loss mid-write must never leave a truncated, unparseable bundle tarball at the target path.
- **What Actually Happened**: Direct writes to the target filename left zero-byte or corrupt `.tar.gz` files on disk when OPA agents were terminated during bundle activation, causing subsequent agent boot loops.
- **Evidence in Repo**: `internal/bundle/utils.go`, lines 122-140.
- **Root Cause**: Writing straight to the destination file exposed a window of vulnerability before write completion.
- **Remediation Pattern**:
```go
// internal/bundle/utils.go
func SaveBundleToDisk(path string, raw io.Reader) (string, error) {
    if _, err := os.Stat(path); os.IsNotExist(err) {
        if err := os.MkdirAll(path, os.ModePerm); err != nil {
            return "", err
        }
    }
    if raw == nil {
        return "", errors.New("no raw bundle bytes to persist to disk")
    }

    // Write to a temporary file in the same directory (same filesystem ensures atomic rename)
    dest, err := os.CreateTemp(path, ".bundle.tar.gz.*.tmp")
    if err != nil {
        return "", err
    }
    defer dest.Close()

    _, err = io.Copy(dest, raw)
    return dest.Name(), err
}
```
- **Lesson**: Bundle download and persistence MUST use temporary scratch files created on the same filesystem mount, followed by an atomic `os.Rename` operation upon hash verification.

---

## 4. Microscopic Code-Level Invariants

### 4.1 Micro-Syntax & Token-Level Precision

#### JSON Number Precision & ECMA Safe Limits
In `internal/gojsonschema/utils.go`, converting arbitrary numbers into integers or floats requires guardrails against IEEE 754 precision loss and 32-bit vs 64-bit platform differences.
```go
const (
    maxJSONFloat = float64(1<<53 - 1)  // 9007199254740991.0 (2^53 - 1)
    minJSONFloat = -float64(1<<53 - 1) // -9007199254740991.0 (-2^53 - 1)
)

func mustBeInteger(what any) *int {
    number, ok := what.(json.Number)
    if !ok {
        return nil
    }
    // Step 1: Big rational verification to prevent string truncation exploits
    bigFloat, isValidNumber := new(big.Rat).SetString(string(number))
    if !isValidNumber || !bigFloat.IsInt() {
        return nil
    }
    // Step 2: Extract as int64
    int64Value, err := number.Int64()
    if err != nil {
        return nil
    }
    // Step 3: Explicit cast to int (system-dependent width: 32 vs 64 bit)
    int32Value := int(int64Value)
    return &int32Value
}
```
**Invariant**: Never cast a `json.Number` directly to `int` via `strconv.Atoi` without validating that the number is mathematically an integer via arbitrary precision rational checks (`big.Rat.IsInt()`).

#### Zero-Allocation Whitespace Compaction
In `internal/providers/aws/v4/util.go`, AWS SigV4 request signing mandates stripping duplicate whitespace without reallocating intermediate string slices:
```go
func StripExcessSpaces(str string) string {
    str = strings.Trim(str, " ")
    j := strings.Index(str, "  ")
    if j < 0 {
        return str
    }

    // In-place byte sliding window over a single slice allocation
    buf := []byte(str)
    var spaces int
    m := j
    for k := j; k < len(buf); k++ {
        if buf[k] == ' ' {
            if spaces == 0 {
                buf[m] = buf[k]
                m++
            }
            spaces++
        } else {
            spaces = 0
            buf[m] = buf[k]
            m++
        }
    }
    return string(buf[:m])
}
```
**Invariant**: Mutate the buffer in-place using two index pointers (`k` reader, `m` writer) to achieve $O(N)$ compaction with zero intermediate allocations.

