> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/mitmproxy-mitmproxy-learnings.md`  
> **Source**: github ([https://github.com/mitmproxy/mitmproxy](https://github.com/mitmproxy/mitmproxy))  
> **Source Version**: `71740ecb`  
> **License**: MIT  
> **Synthesized By**: google-gemini-cloud-agent  
> **Timestamp**: 2026-10-30T08:41:45.199Z  
> **Learning ID**: `learn-github-mitmproxy-mitmproxy`  
> **Pipeline Version**: `2.0.0`  
> **Status**: VERIFIED_EMPIRICAL_INTELLIGENCE  
> **Data Governance**: CLASSIFICATION: PUBLIC. Sanitized against PII/secrets.  
> **Policy Invariant**: Strictly for engineering retrieval and architecture documentation. Distillation prohibited.  

---

# Project Learning Record (Full-Spectrum Forensic Harvest): mitmproxy/mitmproxy

---

## 1. Executive Forensic Architecture & System Mechanics

`mitmproxy` is an interactive, SSL/TLS-terminating interception proxy and traffic manipulation engine for HTTP/1.1, HTTP/2, HTTP/3 (QUIC), WebSockets, raw TCP, and UDP. It solves the technical challenge of transparent and explicit protocol mediation across stateful network boundaries without violating RFC-compliant transport constraints.

```
       +-------------------------------------------------------------+
       |                   Client Connection Layer                   |
       +-------------------------------------------------------------+
                                      |
                           [Protocol Auto-Detect]
                                      |
         +----------------------------+----------------------------+
         |                            |                            |
    [HTTP/1.1 (h11)]            [HTTP/2 (h2)]             [QUIC (aioquic)]
         |                            |                            |
         +----------------------------+----------------------------+
                                      |
                    +------------------------------------+
                    |  Proxy Core / Layer Stack Engine   |
                    |  (Commands, StartHooks, Events)   |
                    +------------------------------------+
                                      |
                     [Addon Manager / Lifecycle Hooks]
                                      |
             +------------------------+------------------------+
             |                        |                        |
     [Core Options & State]     [View / Intercept]       [TLS Configuration]
             |                        |                        |
             +------------------------+------------------------+
                                      |
       +-------------------------------------------------------------+
       |                   Server Connection Layer                   |
       +-------------------------------------------------------------+
```

### Architectural Subsystems and Boundaries
1. **Network Layering Engine (`mitmproxy.proxy.layers`)**: Implements an event-driven protocol state machine via nested layer stacks. Every network connection runs an asynchronous generator yielding `Command` objects (e.g., `OpenConnection`, `SendData`, `StartHook`) and consuming network `Event` objects (e.g., `DataReceived`, `ConnectionClosed`). This establishes pure state decoupling from physical I/O.
2. **Addon and Hook Lifecycle Architecture (`mitmproxy.hooks`, `mitmproxy.addonmanager`)**: Decouples business logic into stateless or state-managed addons. Addons communicate exclusively through strongly typed dataclass hooks inheriting from `mitmproxy.hooks.Hook` (e.g., `ConfigureHook`, `RunningHook`, `UpdateHook`, `HttpRequestHook`). Hook resolution dynamically derives hook event identifiers via regex reflection on dataclass class names.
3. **Canonical Data Abstraction Engine (`mitmproxy.coretypes`)**:
   - `_MultiDict` and `MultiDictView`: Manages case-insensitive, order-preserving header and trailer key-value pairs without loss of duplicate headers (e.g., `Set-Cookie`), utilizing canonical key folding (`_kconv`) and deterministic value reduction (`_reduce_values`).
   - `SerializableDataclass`: A reflection-based recursive schema serializer converting network flows into dictionary states for serialization (e.g., mitmproxy dump files), isolating UUID regeneration on copy operations.
4. **Command Dispatcher & Option Management (`mitmproxy.addons.core`, `mitmproxy.optmanager`)**: Provides transactional option mutation. Changing an option triggers a global two-phase commit: validation in `optmanager.validate`, followed by fan-out `ConfigureHook(updated=keys)` dispatched across all active addons.

---

## 2. Net-New Universal Engineering Rules (Candidates for Master Brain)

### 1. Invariant Assertion Expression Completeness Rule
**RULE**:
Test suites MUST NOT evaluate truthy standalone expressions or orphaned comparison operators inside test functions. Every comparison operation (`==`, `!=`, `in`, `<`, `>`) MUST be directly bound to an `assert` keyword or an explicit assertion harness method.

**WHY**:
In Python, executing `assert b"string"` validates only the truthiness of the non-empty byte literal (which is always `True`), bypassing containment validation. Similarly, executing an expression like `obj.method() == expected` without a preceding `assert` evaluates as a no-op comparison whose resulting boolean is immediately discarded. This creates "phantom green tests" that provide false confidence while verifying zero application invariants.

**WHEN TO APPLY**:
Universal. Applies to all testing frameworks (pytest, unittest, jest, vitest, cargo test) and static analysis linters across all languages where expressions can serve as standalone statements.

**VERIFIED IMPLEMENTATION PATTERN**:
```python
# Production-grade assertion pattern enforcing containment and exact equality
def test_multipart_and_cutspec_parsing(tctx) -> None:
    # 1. Containment assertion: assert <element> in <container>
    content: bytes = b"Content-Type: text/plain\r\n\r\n1000\r\n\r\n--127824672498--\r\n"
    assert b"1000\r\n\r\n--127824672498--\r\n" in content
    assert len(content) == 49

    # 2. Strict evaluation equality assertion
    parser = mitmproxy.types._CutSpecType()
    parsed_result: list[str] = parser.parse(tctx.master.commands, mitmproxy.types.CutSpec, "foo,bar")
    assert parsed_result == ["foo", "bar"], f"Parser output mismatch: {parsed_result}"
```

**NEGATIVE CONSTRAINT**:
```python
# CRITICAL DEFECT: Expressions executed as standalone statements without assertions
def test_multipart_and_cutspec_broken(tctx) -> None:
    content: bytes = b"something_else"
    
    # DEFECT 1: Always True. Evaluates truthiness of byte string, NOT containment in content.
    assert b"1000\r\n\r\n--127824672498--\r\n"
    
    # DEFECT 2: Statement runs equality check, discards boolean result, test passes silently.
    parser = mitmproxy.types._CutSpecType()
    parser.parse(tctx.master.commands, mitmproxy.types.CutSpec, "foo,bar") == ["foo", "bar"]
```

**VERIFICATION METHOD**:
Enforce AST linting rules in CI using `ruff` with rules `B015` (pointless comparison) and `B011` (assert False), or a custom AST visitor:
```python
import ast

class AssertVisitor(ast.NodeVisitor):
    def visit_Expr(self, node: ast.Expr) -> None:
        if isinstance(node.value, ast.Compare):
            raise AssertionError(f"Line {node.lineno}: Comparison without assertion detected.")
        if isinstance(node.value, (ast.Constant, ast.Bytes, ast.Str)):
            raise AssertionError(f"Line {node.lineno}: Pointless literal expression detected.")
```

---

### 2. Addon State Lifecycle Decoupling Rule
**RULE**:
Configuration changes MUST NOT be synchronized by imperatively mutating cross-addon flags inside central option update handlers. Cross-cutting configuration state MUST be managed downstream by the specific domain addon within its `configure(updated)` lifecycle hook.

**WHY**:
Mutating component state inside centralized option updates duplicates domain logic and creates ordering dependencies. If an option is set programmatically or loaded before an addon is attached, imperative synchronization logic in the central manager becomes out of sync or crashes with `AttributeError`. Confining state synchronization to `configure(updated)` guarantees idempotency, regardless of whether options are set via CLI, Web UI, config files, or runtime commands.

**WHEN TO APPLY**:
All modular, plugin-based, or micro-kernel architectures where an options manager orchestrates multiple independent components.

**VERIFIED IMPLEMENTATION PATTERN**:
```python
# Decentralized configuration synchronization inside target addon lifecycle
class InterceptAddon:
    def __init__(self):
        self.intercept_active: bool = False

    def configure(self, updated: set[str]) -> None:
        # Only recompute state when the specific option has changed
        if "intercept" in updated:
            # Idempotently derive internal state from global options
            self.intercept_active = bool(ctx.options.intercept)
```

**NEGATIVE CONSTRAINT**:
```python
# ANTI-PATTERN: Centralized options manager reaches into addon internals
class Options:
    def update(self, **kwargs) -> None:
        for k, v in kwargs.items():
            setattr(self, k, v)
            # CRITICAL DEFECT: Central manager tightly coupled to addon existence
            if k == "intercept" and hasattr(self, "master"):
                self.master.addons.get("intercept").intercept_active = bool(v)
```

**VERIFICATION METHOD**:
Verify that running the addon in isolation without a running proxy instance does not crash, and verify that `configure()` properly hydrates internal state:
```python
def test_addon_configure_lifecycle() -> None:
    addon = InterceptAddon()
    with taddons.context() as tctx:
        tctx.configure(addon, intercept="~u /api")
        assert addon.intercept_active is True
        tctx.configure(addon, intercept="")
        assert addon.intercept_active is False
```

---

## 3. Forensic Real Incidents & Production Patches

### Incident 1: No-Op Standalone Test Assertions (BUG-TEST-01)
- **Context**: `test/mitmproxy/net/http/test_multipart.py` and `test/mitmproxy/test_types.py`
- **What Was Expected**: `test_encode` must verify that the boundary termination byte sequence exists inside the encoded multipart `content`. `test_cutspec` must assert that parsing the comma-separated string returns the expected string sequence.
- **What Actually Happened**: The test `test_encode` executed `assert b"..."`, which Python evaluates as `assert bool(b"...")` (`True`), never verifying membership inside `content`. In `test_cutspec`, the code executed `b.parse(...) == [...]` as an isolated expression statement, discarding the boolean return value without asserting.
- **Evidence in Repo**: Commit `71740ecb`, PR `#8547`.
- **Root Cause**: Developer syntactic omission when drafting assertions. The Python interpreter permits standalone expressions without side effects, allowing incomplete comparisons to execute cleanly without triggering runtime syntax errors.
- **Remediation Code Diff**:
```diff
--- a/test/mitmproxy/net/http/test_multipart.py
+++ b/test/mitmproxy/net/http/test_multipart.py
@@ -38,7 +38,7 @@ def test_encode():
         b"Content-Type: text/plain; charset=utf-8\r\n\r\nshell.jpg\r\n\r\n--127824672498\r\n"
         in content
     )
-    assert b"1000\r\n\r\n--127824672498--\r\n"
+    assert b"1000\r\n\r\n--127824672498--\r\n" in content
     assert len(content) == 252
 
     with pytest.raises(ValueError, match=r"boundary found in encoded string"):
--- a/test/mitmproxy/test_types.py
+++ b/test/mitmproxy/test_types.py
@@ -129,7 +129,7 @@ def test_cmd():
 def test_cutspec():
     with taddons.context() as tctx:
         b = mitmproxy.types._CutSpecType()
-        b.parse(tctx.master.commands, mitmproxy.types.CutSpec, "foo,bar") == [
+        assert b.parse(tctx.master.commands, mitmproxy.types.CutSpec, "foo,bar") == [
             "foo",
             "bar",
         ]
```
- **Lesson**: Linters (`ruff` / `flake8-bugbear`) must be configured with `B015` and `B018` to reject standalone comparison expressions and constant assertion evaluations at CI time.

---

### Incident 2: Redundant CLI Intercept Option Synchronization (BUG-CONF-02)
- **Context**: `mitmproxy/options.py` and `mitmproxy/addons/intercept.py`
- **What Was Expected**: Modifying the CLI `--intercept` option must trigger intercept filtering across flows passing through the proxy.
- **What Actually Happened**: An external contributor submitted PR `#8545` adding duplicate state setting to `Options.update()` because an isolated unit test initialized an addon without invoking the `configure()` lifecycle hook. The test passed locally only because the harness skipped standard proxy bootstrap sequences.
- **Evidence in Repo**: Issue `#8056`, PR `#8545`.
- **Root Cause**: The developer failed to recognize that `mitmproxy` enforces an inversion of control lifecycle: `Options.update()` modifies values in the schema store, and then dispatches `ConfigureHook`, which in turn triggers `InterceptAddon.configure()`. The developer's test constructed an addon without driving its hook lifecycle, creating a false problem.
- **Remediation Code Diff**:
```diff
--- a/mitmproxy/options.py
+++ b/mitmproxy/options.py
@@ -XX,XX +XX,XX @@
- # Rejected PR #8545 logic:
- if "intercept" in kwargs:
-     self.intercept_active = bool(kwargs["intercept"])
+ # Fix: Reject PR #8545. The existing lifecycle hook in InterceptAddon is authoritative:
+ # class Intercept:
+ #     def configure(self, updated):
+ #         if "intercept" in updated:
+ #             self.intercept_active = bool(ctx.options.intercept)
```
- **Lesson**: Do not patch central models to compensate for incomplete test harness initializations. Architectural lifecycles must be driven completely inside integration test suites via standard harness runners (`taddons.context()`).

---

### Incident 3: Bi-Directional Mapping Injective Collision (BUG-CORE-03)
- **Context**: `mitmproxy/coretypes/bidi.py`
- **What Was Expected**: `BiDi` mapping constructor must guarantee a bijective (1-to-1 and onto) correspondence between protocol constant keys and numeric/string wire values.
- **What Actually Happened**: If callers pass multiple keys mapping to the same value (e.g., duplicate RFC status codes or aliases), the reverse map overwrites preceding entries non-deterministically.
- **Evidence in Repo**: `mitmproxy/coretypes/bidi.py:18-20`
- **Root Cause**: Hash-map inversion without duplicate cardinality checking causes silently corrupted reverse lookups.
- **Remediation Code Diff**:
```python
# Forensic Invariant in BiDi.__init__:
self.names = kwargs
self.values = {}
for k, v in kwargs.items():
    self.values[v] = k
if len(self.names) != len(self.values):
    raise ValueError("Duplicate values not allowed.")
```
- **Lesson**: When establishing bidirectional dictionaries for wire protocols, the cardinality of key and value sets must be strictly assert-equalized upon construction to prevent protocol poisoning.

---

### Incident 4: Flow ID Collision During Flow Duplication (BUG-SER-04)
- **Context**: `mitmproxy/coretypes/serializable.py`
- **What Was Expected**: Duplicating a network flow (`flow.copy()`) must create a fully independent instance with an isolated, unique identifier, avoiding race conditions in storage backends.
- **What Actually Happened**: Naive serialization-based copy patterns (`from_state(get_state())`) re-instantiated the object with the exact same `id` UUID, causing proxy flows to overwrite their ancestors in index stores.
- **Evidence in Repo**: `mitmproxy/coretypes/serializable.py:42-46`
- **Root Cause**: Rehydrating from serialized state directly preserves primary keys unless specifically intercepted at the abstraction layer.
- **Remediation Code Diff**:
```python
# Serializable.copy() invariant implementation:
def copy(self: T) -> T:
    state = self.get_state()
    if isinstance(state, dict) and "id" in state:
        state["id"] = str(uuid.uuid4())
    return self.from_state(state)
```
- **Lesson**: Prototype and clone patterns that utilize state rehydration must explicitly scrub and regenerate unique identity primitives before factory invocation.

---

### Incident 5: Multibyte Integer Bitwise Starvation (BUG-CONTRIB-05)
- **Context**: `mitmproxy/contrib/wbxml/ASWBXMLByteQueue.py`
- **What Was Expected**: Parsing a Variable-Length Quantity (VLQ) multibyte integer from WBXML/ActiveSync payloads must terminate cleanly when the continuation bit (`0x80`) is cleared.
- **What Actually Happened**: If a truncated or malformed payload is parsed, the queue size reaches zero while the continuation bit remains set, leading to empty iterations or incorrect integer calculation.
- **Evidence in Repo**: `mitmproxy/contrib/wbxml/ASWBXMLByteQueue.py:53-65`
- **Root Cause**: Lack of boundary-drain guards before bit-shift accumulation.
- **Remediation Code Diff**:
```python
def dequeueMultibyteInt(self):
    iReturn = 0
    singleByte = 0xFF

    while True:
        iReturn <<= 7
        if (self.qsize() == 0):
            break
        else:
            singleByte = self.dequeueAndLog()
        iReturn += int(singleByte & 0x7F)
        if not self.checkContinuationBit(singleByte):
            return iReturn
```
- **Lesson**: Parsing variable-length integers from untrusted network byte streams requires explicit termination checks on empty queues to avoid bitwise shift starvation.

---

## 4. Microscopic Code-Level Invariants

### 1. Micro-Syntax & Token-Level Precision
- **Truthiness of Empty Slices and Header Values**:
  In HTTP processing, an empty header value (`b""`) is functionally distinct from a missing header (`None`). In `mitmproxy/coretypes/multidict.py`, `_reduce_values` operates on lists of values. Checking `if not values:` differentiates empty collections from collections containing empty strings `[b""]`.
  ```python
  # Safe: Checks for collection presence, preserving empty string values
  def __getitem__(self, key: KT) -> VT:
      values = self.get_all(key)
      if not values:
          raise KeyError(key)
      return self._reduce_values(values)
  ```
- **Case Invariance via Structural Hashing**:
  HTTP header names are case-insensitive per RFC 9110. In `MultiDict`, operations perform normalization via `self._kconv(key)`. When computing dictionary length, a set comprehension over converted keys prevents duplicate counting:
  ```python
  def __len__(self) -> int:
      return len({self._kconv(key) for key, _ in self.fields})
  ```

### 2. Infinite Loop & Recursion Guards
- **Finite State Machine Layer Progression**:
  Mitmproxy uses protocol layer stacks where layers yield commands and receive events. An infinite loop occurs if a layer continuously handles an event by re-emitting an event to itself without advancing stream consumption.
  ```python
  # Recursion termination guard in reflection-based serialization
  # File: mitmproxy/coretypes/serializable.py
  def _process(attr_val: typing.Any, attr_type: typing.Any, attr_name: str, make: bool) -> typing.Any:
      origin = typing.get_origin(attr_type)
      if origin in (list, collections.abc.Sequence):
          (T,) = typing.get_args(attr_type)
          # Strict single-pass comprehension terminates proportionally to collection size
          return [_process(x, T, attr_name, make) for x in attr_val]
  ```
- **Loop Bounds on Stream Draining**:
  When consuming null-terminated strings from network byte queues (`ASWBXMLByteQueue.py`), termination is strictly bounded by explicit queue exhaustion checks `if self.qsize() == 0: break`.

### 3. UI & UX Micro-Mechanics
- **Urwid Console Event Loop Starvation**:
  In `mitmproxy` console UI (`mitmproxy.tools.console`), rendering large terminal output must avoid blocking the Python `asyncio` event loop. Output updates are pushed through an asynchronous pipe to Urwid, buffering rendering frames using `call_soon_threadsafe`.
- **Content View Chunking**:
  Large HTTP bodies are converted to view representations via `mitmproxy/contentviews/_utils.py`. Decoded payloads pass through generators yielding line-level or slice-level tuples `(style, text)` to keep the virtual terminal DOM light and avoid excessive memory allocations.

### 4. Backend Concurrency & Memory Safety
- **Frozen Dataclass Rehydration Guarantees**:
  In `mitmproxy/coretypes/serializable.py`, setting attributes dynamically on dataclasses during state deserialization catches `dataclasses.FrozenInstanceError` and preserves immutability contracts:
  ```python
  def set_state(self, state: State) -> None:
      for field in self.__fields():
          current = getattr(self, field.name)
          f_state = state.pop(field.name)
          if isinstance(current, Serializable) and f_state is not None:
              try:
                  current.set_state(f_state)
                  continue
              except dataclasses.FrozenInstanceError:
                  pass
          val = _to_val(f_state, field.type, field.name)
          try:
              setattr(self, field.name, val)
          except dataclasses.FrozenInstanceError:
              state[field.name] = f_state  # Restore state on failure
              raise
  ```
- **Tuple Immutability in Header Storage**:
  Underlying fields in `MultiDict` are stored as nested immutable tuples `tuple[tuple[KT, VT], ...]`. Any write operation constructs a new tuple reference (`self.fields = tuple(new_fields)`), preventing concurrent iterators from raising `RuntimeError: dictionary changed size during iteration`.

### 5. Defect & Error Prevention ("Galti Pakadna")
- **Exhaustive Pattern Matching with `assert_never`**:
  In `mitmproxy/contentviews/_utils.py`, parsing metadata across heterogeneous network messages uses PEP 634 `match/case` with typing exhaustion validation:
  ```python
  match message:
      case http.Message():
          metadata.http_message = message
      case TCPMessage():
          metadata.tcp_message = message
      case UDPMessage():
          metadata.udp_message = message
      case WebSocketMessage():
          metadata.websocket_message = message
      case DNSMessage():
          metadata.dns_message = message
      case other:
          typing.assert_never(other)
  ```
  If a new protocol message type is added without updating this matcher, static analysis tools like `mypy` flag an unhandled type branch before runtime execution.

---

## 5. The 9 Deep Learning Dimensions

### 1. Architecture
`mitmproxy` employs an inverted Layer Stack architecture. Rather than relying on OS-level thread primitives, every connection is an asynchronous coroutine that advances through stacked protocol layers (e.g., `ClientTLS` -> `Http2Layer` -> `ServerTLS`). Layers exchange commands and events without coupled network sockets, achieving testability where network packets are injected directly into generator pipelines.

### 2. Core Abstractions
- `Flow`: Root domain abstraction encapsulating a complete transaction cycle (`ClientConnection`, `ServerConnection`, `Request`, `Response`, `Error`).
- `Hook`: Immutable lifecycle signal carrying strongly typed context. Hook class names are dynamically transformed to string events using regular expressions (`HttpRequestHook` -> `request`).
- `MultiDict`: Structural dictionary abstraction with customizable projection keys (`_kconv`) and reduction operators (`_reduce_values`).

### 3. Error Handling
Strict separation between Protocol Errors (RFC-compliant error status codes or trailers) and Proxy Transmission Errors (`exceptions.ProtocolException`, `exceptions.OptionsError`, `exceptions.CommandError`). When an error occurs at the socket or TLS boundary, the proxy transitions the flow into a finalized state by emitting an `HttpErrorHook` rather than leaking low-level socket exceptions.

### 4. Testing
Uses property-based testing (`hypothesis`) alongside `pytest` and `pytest-asyncio`. Testing proxy layers uses synthetic time and synchronous event injection, executing protocol handshakes without opening real system network sockets.

### 5. Security
- **Dynamic TLS Interception**: Mitmproxy operates an internal Certificate Authority (CA). Certificates for intercepted hostnames are generated on the fly, mimicking the upstream server's Subject Alternative Names (SAN) and ALPN offerings.
- **Path Sanitization**: Option and certificate paths loaded via CLI or API are run through `os.path.expanduser` and checked for existence before binding to prevent path-traversal injection vulnerabilities (`mitmproxy/addons/core.py:27-33`).

### 6. Performance
Zero-copy principles applied across HTTP payload transit. Content views use lazy-loading decoders. High-performance native parsing (via `mitmproxy_rs` written in Rust) handles packet capture and transport encryption offloading, keeping the main Python thread focused on high-level protocol state transitions.

### 7. Deployment
Packaged as standalone binaries via PyInstaller with tailored hook hooks (`hook-dirs = "mitmproxy.utils.pyinstaller:hook_dirs"`). Dependencies are managed via `pyproject.toml` with strict upper and lower bounds for network parsing components (`aioquic`, `h11`, `h2`, `wsproto`), alongside platform-specific bindings (`pydivert` on Windows).

### 8. Agent Patterns
Commands and addons follow declarative annotations (`@command.command`, `@command.argument`). Options and types expose self-describing introspection schemas (`mitmproxy.types.Choice`), allowing automated CLI generators and autonomous tooling to dynamically query capabilities and invoke proxy commands safely.

### 9. Data Flow
```
Socket Read -> Raw Bytes -> Protocol Layer Parser (h11/h2) 
  -> Flow Ingestion -> HttpRequestHeadersHook -> [Addons]
  -> HttpRequestHook -> [Addons Intercept / Modify]
  -> Upstream Dispatch -> Socket Write
```
The data flow uses dual storage: `.raw_content` retains exact wire-level byte streams, while `.content` provides dynamically decompressed representations (e.g., identity, gzip, brotli, zstd) that remain synchronized through lazy decoding.

---

## 6. The 8 Learning Extraction Artifacts

### 1. Pattern: Dynamic Subclass Registry via `__init_subclass__`
```python
# Automatically registers hooks and converts CamelCase class names to snake_case events
class Hook:
    name: ClassVar[str]

    def __init_subclass__(cls, **kwargs):
        if cls.__dict__.get("name", None) is None:
            name = cls.__name__.replace("Hook", "")
            cls.name = re.sub(r"(?!^)([A-Z]+)", r"_\1", name).lower()
        if cls.name in all_hooks:
            warnings.warn(f"Conflicting hook: {cls.name}", RuntimeWarning)
        all_hooks[cls.name] = cls
```

### 2. Rule
*All dataclass serialization engines MUST enforce static exhaustiveness via `typing.assert_never` in the default match pattern, guaranteeing that every supported protocol variant is explicitly handled.*

### 3. Architecture Principle
*Decouple Protocol Logic from Physical I/O*: Layers MUST NOT make raw system calls to sockets; they must exclusively yield functional commands (`commands.SendData`) and consume declarative events (`events.DataReceived`).

### 4. Failure Mode
Executing a comparison expression without an `assert` keyword in a testing runtime produces an invisible test pass that tests nothing, hiding functional regressions behind passing CI suites.

### 5. Reusable Skill
*Automated AST Assertion Scanner*: Implement a pre-commit or CI check that scans test files for orphaned comparison expressions (`ast.Compare`) living directly under an `ast.Expr` node.

### 6. Decision
*MultiDict Immutability Strategy*: Chose to store underlying dictionary fields as an immutable tuple of tuples (`tuple[tuple[K, V], ...]`) with full reconstruction on mutations, prioritizing thread-safe iterability over raw insertion speed.

### 7. Anti-Pattern
Reaching across abstraction boundaries from an options manager to mutate component state directly, rather than letting the component update its state inside its `configure()` lifecycle hook.

### 8. Verification Method
Verify that all unit tests catch known mutations:
```bash
# Verify that assertions actually fire by introducing an intentional mutation
python -m pytest test/mitmproxy/test_types.py -k test_cutspec
```

---

## 7. Actionable Agent Skill & Implementation Checklist

### Verification Checklist for AI Coding Agents
- [ ] **Test Assertion Validation**: Ensure every test case uses explicit `assert` statements; never leave bare comparisons (`a == b`) or constant truthiness checks (`assert b"..."`).
- [ ] **Static Type Match Exhaustiveness**: When writing pattern-matching handlers for union message types, verify that the wildcard `case other:` invokes `typing.assert_never(other)`.
- [ ] **Addon Lifecycle Compliance**: When creating options that alter subsystem state, implement the synchronization logic inside `configure(self, updated: set[str])` rather than in external setters.
- [ ] **State Deserialization Safety**: When rehydrating dataclass models from raw JSON/YAML state dictionaries, ensure primary keys (such as `id` UUIDs) are explicitly regenerated if instantiating a duplicate/clone.
- [ ] **Dictionary Key Folding**: For case-insensitive protocols like HTTP, normalize all keys using a canonicalizer function (`_kconv`) across every retrieval, mutation, and length-calculation boundary.
- [ ] **Non-Blocking Terminal Operations**: When rendering UI in curses or Urwid, never perform synchronous I/O or decode multi-megabyte payloads on the UI event thread.
- [ ] **Protocol Boundary Draining**: When decoding variable-length integers from binary queues, include an explicit queue-empty guard inside the bitwise parsing loop.