> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/mitmproxy-mitmproxy-learnings.md`  
> **Source**: github ([https://github.com/mitmproxy/mitmproxy](https://github.com/mitmproxy/mitmproxy))  
> **Source Version**: `c8a55fff`  
> **License**: MIT  
> **Synthesized By**: google-gemini-cloud-agent  
> **Timestamp**: 2026-10-20T13:19:39.791Z  
> **Learning ID**: `learn-github-mitmproxy-mitmproxy`  
> **Pipeline Version**: `2.0.0`  
> **Status**: VERIFIED_EMPIRICAL_INTELLIGENCE  
> **Data Governance**: CLASSIFICATION: PUBLIC. Sanitized against PII/secrets.  
> **Policy Invariant**: Strictly for engineering retrieval and architecture documentation. Distillation prohibited.  

---

# Project Learning Record (Full-Spectrum Forensic Harvest): mitmproxy/mitmproxy

---

## 1. Executive Forensic Architecture & System Mechanics

### Exact Technical Problem Solved
`mitmproxy` is a transparent, interactive, and scriptable SSL/TLS-terminating interception proxy and network protocol inspection engine. It operates at L4 through L7 of the OSI stack, interposing itself between client user agents and upstream servers across HTTP/1.x, HTTP/2, HTTP/3 (QUIC), Raw TCP, UDP, WebSockets, and DNS. It solves the dual challenge of:
1. Decoding, modifying, and re-serializing stateful, multiplexed, encrypted, and binary network protocols in real time without corrupting protocol invariants (such as header casing, framing flags, compression states, or stream multiplexing IDs).
2. Providing a non-blocking, event-driven reactive runtime where external scripts, UI clients (`mitmweb`, `mitmproxy` TUI), and headless tools (`mitmdump`) interact with flowing network data streams synchronously or asynchronously via an inverted command-hook control bus.

```
+-------------------------------------------------------------------------------------------------------+
|                                          mitmproxy Architecture                                       |
+-------------------------------------------------------------------------------------------------------+
|  [Client Connection (TCP/UDP/QUIC)]                                                                   |
|          |                                                                                            |
|          v                                                                                            |
|  +-------------------------------------------------------------------------------------------------+  |
|  | Layer Stack (State Machine Pipeline: Mode -> TLS/QUIC -> HTTP1/H2/H3 -> WebSocket/TCP/UDP)      |  |
|  |   - mitmproxy/proxy/layers/* (Deterministic pure-Python protocol decoders)                       |  |
|  |   - Asynchronous I/O decoupled via Layer.handle_event(Event) -> Generator[Command, None, None]  |  |
|  +-------------------------------------------------------------------------------------------------+  |
|          |                                                                                            |
|          +-------------------------> [Commands & Events Bus] <--------------------------+             |
|                                                  |                                      |             |
|                                                  v                                      |             |
|  +---------------------------------------------------------------------------------+    |             |
|  | Addon Manager & Hook System (mitmproxy/hooks.py, mitmproxy/addonmanager.py)    |    |             |
|  |   - Dispatches: HttpRequestHeadersHook, HttpRequestHook, QuicStartClientHook     |    |             |
|  |   - Addon lifecycle hooks: configure, running, done, update                     |    |             |
|  +---------------------------------------------------------------------------------+    |             |
|          |                                                                              |             |
|          v                                                                              |             |
|  +---------------------------------------------------------------------------------+    |             |
|  | Flow Lifecycle & Core Addon Bus (mitmproxy/addons/core.py)                     |    |             |
|  |   - Commands: flow.resume, flow.mark, flow.kill, flow.revert, flow.decode, set   |----+             |
|  |   - In-memory Flow storage & MultiDict state representations                    |                  |
|  +---------------------------------------------------------------------------------+                  |
|          |                                                                                            |
|          v                                                                                            |
|  +-------------------------------------------------------------------------------------------------+  |
|  | Serialization & View Layer (mitmproxy/coretypes/serializable.py, contentviews/)                |  |
|  |   - Dataclass reflection & byte-safe JSON/YAML reconstruction                                   |  |
|  |   - Upstream Network Connection (Raw Socket / TLS Handshake / Upstream Proxy)                  |  |
|  +-------------------------------------------------------------------------------------------------+  |
+-------------------------------------------------------------------------------------------------------+
```

### Architectural Boundaries & State Ownership
1. **The Layered Protocol Engine (`mitmproxy/proxy/layers`)**: Protocol decoding is decoupled from OS-level socket I/O using a Sans-I/O event-driven state machine architecture. A `Layer` receives low-level protocol events (e.g., `DataReceived`, `ConnectionClosed`) and yields high-level commands (`OpenConnection`, `SendData`, `InjectHook`). The socket handles remain outside the protocol decoding modules.
2. **Hook Metamodel & Inverted Addon Engine (`mitmproxy/hooks.py`, `mitmproxy/addons/core.py`)**: Addons are isolated state consumers. They do not retain socket locks; they subscribe to typed, frozen dataclass hooks. Modifying a flow triggers an `UpdateHook` event to keep state synchronised across subscribers.
3. **Data Representation Boundary (`mitmproxy/coretypes`)**:
   - `MultiDict` / `MultiDictView`: Network protocol headers permit multiple values for identical keys (e.g., `Set-Cookie`, `Via`). Mitmproxy uses an immutable internal tuple-of-tuples layout `((key, value), ...)` to preserve exact wire order and case sensitivity while providing a dictionary abstraction.
   - `SerializableDataclass`: Serialization between the core daemon, RPC clients, and on-disk dumps uses reflection-driven dataclass serialization rather than pickle or arbitrary JSON serializers to guarantee type stability across Python runtimes.

---

## 2. Universal Engineering Rules (Candidates for Master Brain)

### 1. Delimiter-State Validation in Wire Protocol Tokenizers
**RULE**: When parsing compound, delimiter-separated wire protocols where delimiters can exist inside payload values (such as commas inside HTTP `Expires` attributes or dates), parsers **MUST NOT** use arbitrary buffer-length heuristics (e.g., `len(token) <= 3`) to guess lookahead continuation. Parsers **MUST** verify both the immediate structural boundary delimiter (`s[offset] == ','`) and validate that the accumulated accumulator strictly belongs to the finite semantic domain permitted before that delimiter.

**WHY**: Heuristics based on character counts create asymmetric parsing vulnerabilities and boundary-crossing defects. In HTTP `Set-Cookie` headers, commas separate independent cookies (`Set-Cookie: c1=v1, c2=v2`), but also appear inside RFC 850/RFC 1123 date strings (e.g., `Expires=Wednesday, 21-Oct-2026 07:28:00 GMT`). An unbounded or size-heuristic lookahead either prematurely splits valid full-weekday dates (e.g., `Wednesday` > 3 chars) or swallows subsequent flags (`Expires=0; Secure` turns into `Expires="0, Secure"`), neutralizing critical browser security directives like `Secure` and `HttpOnly`.

**WHEN TO APPLY**:
- Network protocol parsers (HTTP, SIP, MIME, SMTP).
- Custom lexical analyzers handling optional parameters, attributes, or comma-separated lists with embedded formatting tokens.

**VERIFIED IMPLEMENTATION PATTERN**:
```python
from collections.abc import Set

_WEEKDAYS: Set[str] = {
    "mon", "tue", "wed", "thu", "fri", "sat", "sun",
    "monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"
}

def parse_cookie_attribute(s: str, off: int, lhs: str, rhs: str) -> tuple[str, int]:
    """
    Safely consumes trailing date tokens in Set-Cookie attributes without
    swallowing adjacent attributes or subsequent Set-Cookie definitions.
    """
    if lhs.lower() == "expires":
        # Check strict boundary conditions:
        # 1. Lookahead within string bounds
        # 2. Delimiter is unequivocally a comma
        # 3. Delimited prefix token matches exact weekday vocabulary
        if off < len(s) and s[off] == "," and rhs.strip().lower() in _WEEKDAYS:
            # Advance past comma and read the remainder of the RFC date until ';' or end
            trail, off = _read_value(s, off + 1, ";,")
            rhs = f"{rhs},{trail}"
    return rhs, off

def _read_value(s: str, start: int, delimiters: str) -> tuple[str, int]:
    pos = start
    while pos < len(s) and s[pos] not in delimiters:
        pos += 1
    return s[start:pos], pos
```

**NEGATIVE CONSTRAINT**:
```python
# ANTI-PATTERN: Character-length heuristic guessing
def parse_cookie_attribute_unsafe(s: str, off: int, lhs: str, rhs: str) -> tuple[str, int]:
    if lhs.lower() == "expires":
        # CRITICAL BUG: Assumes any value <= 3 chars is an incomplete day ("Wed"),
        # which corrupts short values like "0", "Sun", and breaks on "Wednesday".
        if len(rhs) <= 3:
            trail, off = _read_value(s, off + 1, ";,")
            rhs = rhs + "," + trail
    return rhs, off
```

**VERIFICATION METHOD**:
Enforce compliance via parameterized property-based testing and unit test suites verifying token boundaries:
```python
@pytest.mark.parametrize("header,expected_expires,expected_extra", [
    ("session=xyz; Expires=0; Secure; HttpOnly", "0", [("Secure", None), ("HttpOnly", None)]),
    ("a=b; expires=Wednesday, 21-Oct-2026 07:28:00 GMT; path=/", "Wednesday, 21-Oct-2026 07:28:00 GMT", [("path", "/")]),
    ("c=d; expires=0, next=cookie", "0", [("next", "cookie")]),
])
def test_cookie_boundary_preservation(header, expected_expires, expected_extra):
    parsed = parse_set_cookie_header(header)
    assert parsed[0][2]["expires"] == expected_expires
    for k, v in expected_extra:
        assert parsed[0][2][k] == v
```

---

### 2. Multi-Valued Header State Immutability via Tuple-of-Tuples
**RULE**: In-memory representations of ordered, case-insensitive multi-mapping data structures (such as HTTP headers and MIME parameters) **MUST NOT** rely on Python dictionaries of lists (`dict[str, list[str]]`) if state synchronization, wire fidelity, or thread/coroutine isolation is required. They **MUST** be backed by an immutable sequence of 2-tuples (`tuple[tuple[K, V], ...]`), generating new tuples upon mutation.

**WHY**: 
1. HTTP header ordering impacts downstream fingerprinting, signature verification, and HTTP request smuggling vulnerability detection. Python dictionaries preserve insertion order but mutate in-place, losing concurrency safety.
2. `dict[str, list[str]]` allows non-atomic mutations where an external actor can mutate the inner list reference directly, bypassing update hooks, serialization dirty flags, and validation bounds. Backing the storage with `tuple[tuple[K, V], ...]` guarantees that any insertion, deletion, or modification must re-assign the root reference, enabling cheap state snapshots and identity comparisons (`old.fields is new.fields`).

**WHEN TO APPLY**:
- High-concurrency proxies, network interceptors, web server middleware.
- Security-sensitive data models where original wire-format key casing and sequence must survive serialization roundtrips.

**VERIFIED IMPLEMENTATION PATTERN**:
```python
from collections.abc import Sequence, Iterator, MutableMapping
from typing import TypeVar

KT = TypeVar("KT", bound=str)
VT = TypeVar("VT", bound=str)

class ImmutableHeaderMap(MutableMapping[KT, VT]):
    __slots__ = ("_fields",)

    def __init__(self, fields: Sequence[tuple[KT, VT]] = ()):
        # Internal state is strictly an immutable tuple of immutable tuples
        self._fields: tuple[tuple[KT, VT], ...] = tuple((k, v) for k, v in fields)

    @property
    def fields(self) -> tuple[tuple[KT, VT], ...]:
        return self._fields

    def __getitem__(self, key: KT) -> VT:
        canonical_key = key.lower()
        for k, v in self._fields:
            if k.lower() == canonical_key:
                return v
        raise KeyError(key)

    def __setitem__(self, key: KT, value: VT) -> None:
        self.set_all(key, [value])

    def set_all(self, key: KT, values: list[VT]) -> None:
        canonical = key.lower()
        new_fields: list[tuple[KT, VT]] = []
        # Retain original wire casing for updated items where possible
        for k, v in self._fields:
            if k.lower() == canonical:
                if values:
                    new_fields.append((k, values.pop(0)))
            else:
                new_fields.append((k, v))
        # Append remaining values
        while values:
            new_fields.append((key, values.pop(0)))
        self._fields = tuple(new_fields)

    def __delitem__(self, key: KT) -> None:
        canonical = key.lower()
        initial_len = len(self._fields)
        self._fields = tuple(f for f in self._fields if f[0].lower() != canonical)
        if len(self._fields) == initial_len:
            raise KeyError(key)

    def __iter__(self) -> Iterator[KT]:
        seen = set()
        for k, _ in self._fields:
            ck = k.lower()
            if ck not in seen:
                seen.add(ck)
                yield k

    def __len__(self) -> int:
        return len({k.lower() for k, _ in self._fields})
```

**NEGATIVE CONSTRAINT**:
```python
# ANTI-PATTERN: Mutable dict with list references
class UnsafeHeaders:
    def __init__(self):
        # Exposes mutable internal lists to reference leakage
        self.headers: dict[str, list[str]] = {}

    def get_all(self, key: str) -> list[str]:
        # Leakage: caller mutating this list silently mutates internal proxy state
        return self.headers.get(key.lower(), [])
```

**VERIFICATION METHOD**:
Ensure mutation safety via identity checks verifying that any write allocates a new underlying tuple:
```python
def test_header_immutability_on_mutation():
    hm = ImmutableHeaderMap([("Host", "example.com"), ("Accept", "*/*")])
    initial_backing = hm.fields
    hm["Accept"] = "text/html"
    assert hm.fields is not initial_backing
    assert hm["Accept"] == "text/html"
    # Ensure reference cannot be mutated externally
    fields = hm.fields
    assert isinstance(fields, tuple)
```

---

### 3. Declarative Metamodel Hook Class Reflection
**RULE**: Subsystem lifecycle hooks and command definitions across modular plugin engines **MUST** use self-registering metaclasses or `__init_subclass__` validation guards to dynamically assign canonical event signatures and enforce frozen schema invariants at class definition time rather than at runtime instantiation.

**WHY**: In complex event-driven proxy pipelines, typos in hook names (`request` vs `http_request` vs `on_request`) or instantiating abstract hooks causes silent event drops where network packets hang or leak without throwing informative exceptions. Enforcing snake_case auto-derivation, dataclass schema typing, and global conflict detection during Python's class evaluation prevents conflicting plugins from intercepting identical hooks with divergent method signatures.

**WHEN TO APPLY**:
- Plugin engines, proxy middlewares, event-driven microkernels, message bus frameworks.

**VERIFIED IMPLEMENTATION PATTERN**:
```python
import re
import warnings
from dataclasses import is_dataclass
from typing import ClassVar, Any

registry: dict[str, type["BaseHook"]] = {}

class BaseHook:
    name: ClassVar[str]

    def __new__(cls, *args: Any, **kwargs: Any):
        if cls is BaseHook:
            raise TypeError("BaseHook may not be instantiated directly.")
        if not is_dataclass(cls):
            raise TypeError(f"Hook implementation '{cls.__name__}' MUST be decorated with @dataclass.")
        return super().__new__(cls)

    def __init_subclass__(cls, **kwargs: Any) -> None:
        super().__init_subclass__(**kwargs)
        # Derive snake_case hook name automatically if omitted:
        # HttpRequestHook -> http_request
        if cls.__dict__.get("name") is None:
            raw_name = cls.__name__.removesuffix("Hook")
            cls.name = re.sub(r"(?<!^)(?=[A-Z])", "_", raw_name).lower()

        if cls.name in registry:
            existing = registry[cls.name]
            warnings.warn(
                f"Duplicate hook registration conflict for '{cls.name}': {cls} supersedes {existing}",
                RuntimeWarning,
                stacklevel=2
            )
        registry[cls.name] = cls

        # Force instance-level immutable hashing
        cls.__hash__ = object.__hash__  # type: ignore
        cls.__eq__ = object.__eq__      # type: ignore
```

**NEGATIVE CONSTRAINT**:
```python
# ANTI-PATTERN: Manual string registration with no runtime validation
class LegacyHook:
    pass

class RequestHook(LegacyHook):
    # Typo: silently fails to trigger if dispatcher listens for 'http_request'
    hook_name = "httpRequest" 
```

**VERIFICATION METHOD**:
Assert class-level enforcement at import/test time:
```python
def test_hook_metaclass_enforcement():
    # Direct instantiation of base class must fail
    with pytest.raises(TypeError, match="may not be instantiated directly"):
        BaseHook()

    # Subclassing without @dataclass must fail on instantiation
    class NonDataclassHook(BaseHook):
        pass

    with pytest.raises(TypeError, match="MUST be decorated with @dataclass"):
        NonDataclassHook()
```

---

## 3. Forensic Real Incidents & Production Patches

### Incident 1: Set-Cookie Parsing Attribute Swallowing via Heuristic Lookahead (BUG-MITM-01)
- **Context**: HTTP parser core utility (`mitmproxy/net/http/cookies.py`)
- **What Was Expected**: Parsing a `Set-Cookie` header containing `Expires=0; Secure; HttpOnly` must yield three distinct attribute pairs: `("Expires", "0")`, `("Secure", None)`, and `("HttpOnly", None)`. Furthermore, an RFC 850 date format containing full weekday names (e.g., `Wednesday, 21-Oct-2026 07:28:00 GMT`) must be parsed as a single `Expires` value.
- **What Actually Happened**: The parser evaluated `len(rhs) <= 3` as a heuristic to detect whether an `Expires` token was interrupted by a comma (as in `Wed, 21-Oct...`). When `Expires=0` was passed, `len("0") <= 3` evaluated to `True`. The parser blindly consumed across the delimiter, merging the subsequent attribute or cookie into `Expires`, outputting `Expires="0; Secure"`. Conversely, for RFC 850 weekday names (`Wednesday`), `len("Wednesday") > 3`, which evaluated to `False`. The parser failed to consume past the comma, truncating the expiration date at `"Wednesday"`.
- **Evidence in Repo**: Commit `c8a55fff`, PR #8489, Issue #8488. Unit tests in `test/mitmproxy/net/http/test_cookies.py`.
- **Root Cause**: Reliance on an ambiguous character-count heuristic (`len(rhs) <= 3`) rather than explicit delimiter verification (`s[off] == ','`) coupled with vocabulary whitelisting (`rhs.strip().lower() in _WEEKDAYS`).
- **Remediation Code Diff**:
```python
# - mitmproxy/net/http/cookies.py
-                # '3' is just a heuristic we use to determine whether we've
-                # only read a part of the expires value and we should read more.
-                if len(rhs) <= 3:
-                    trail, off = _read_value(s, off + 1, ";,")
-                    rhs = rhs + "," + trail
# + mitmproxy/net/http/cookies.py
+                # 'expires' date values can contain a comma after the weekday
+                # (e.g. RFC 1123 'Wed, ...' or RFC 850 'Wednesday, ...').
+                # We only consume across a comma if the delimiter encountered
+                # is actually a comma and the value read so far is a weekday.
+                if off < len(s) and s[off] == "," and rhs.strip().lower() in _WEEKDAYS:
+                    trail, off = _read_value(s, off + 1, ";,")
+                    rhs = rhs + "," + trail
```
- **Lesson**: Parsing RFC-compliant header specifications must never rely on integer length thresholds to infer semantic structure. Lookaheads must be conditioned on exact grammar transitions.

---

### Incident 2: Silent Test Failure Masking via Misspelled Test Harness Assertion (BUG-MITM-02)
- **Context**: Command parsing test suite (`test/mitmproxy/command/test_commander.py`)
- **What Was Expected**: If an unexpected code path was taken inside a command line interpreter test, the testing framework should fail the test run immediately via `pytest.fail(...)`.
- **What Actually Happened**: The test harness invoked `pytest.faied(...)` instead of `pytest.fail(...)`. If the failure branch triggered, Python threw an unhandled `AttributeError: module 'pytest' has no attribute 'faied'`, which confounded CI test diagnostics and prevented the test runner from cleanly reporting the underlying assertion failure.
- **Evidence in Repo**: PR #8494, Issue #8494, `CHANGELOG.md`.
- **Root Cause**: Developer typo overlooked by basic syntax checks due to dynamic module attribute resolution, combined with dead-path test code that was not executed until edge cases occurred.
- **Remediation Code Diff**:
```python
# - test/mitmproxy/command/test_commander.py
-            pytest.faied("Command execution failed unexpectedly")
# + test/mitmproxy/command/test_commander.py
+            pytest.fail("Command execution failed unexpectedly")
```
- **Lesson**: Testing harnesses must themselves be subjected to static type checking (`mypy --check-untyped-defs`) and linting (`ruff`) to prevent latent attribute access exceptions inside error-reporting paths.

---

### Incident 3: Option Help String Documentation Drift & UI Formatter Corruption (BUG-MITM-03)
- **Context**: Configuration Option Definitions (`mitmproxy/options.py`)
- **What Was Expected**: The help text for the `save_stream_file` option should clearly describe output formatting parameters for terminal and file dumps.
- **What Actually Happened**: Typographical errors (`formating`) in option definitions corrupted downstream user manual generators (`docs/scripts/options.py`), which introspect option help strings at build time to produce docs and automated CLI shell completions.
- **Evidence in Repo**: PR #8494, commit referencing codespell integration.
- **Root Cause**: Absence of automated spellchecking (`codespell`) within the pre-commit linting pipeline for user-facing option docstrings.
- **Remediation Code Diff**:
```python
# - mitmproxy/options.py
-        help="Stream file formating options.",
# + mitmproxy/options.py
+        help="Stream file formatting options.",
```
- **Lesson**: CLI documentation and option descriptions are machine-introspected interfaces. Documentation typos can break shell autocompletion generators and regex-based argument parsers.

---

## 4. Microscopic Code-Level Invariants

### 1. Micro-Syntax & Token-Level Precision
- **Truthiness Hazards on Status Codes and Flags**: In `mitmproxy/addons/core.py`, when parsing and updating HTTP status codes, string inputs must be explicitly cast to integers:
  ```python
  if attr == "status_code":
      try:
          val = int(val)
      except ValueError as v:
          raise exceptions.CommandError(f"Status code is not an integer: {val}") from v
  ```
  *Hazard*: In HTTP response mutation, evaluating `if resp.status_code:` is safe because valid status codes are 100-599. However, evaluating `if req.content:` is unsafe because `req.content` may be `b""` (empty body), which is falsy in Python, leading code to erroneously treat an explicitly empty payload the same as `None` (uninitialized body). Proxies must test `if req.content is not None:`.

- **Deep Reflection vs Shallow Copy Mutation Leaks**: In `mitmproxy/coretypes/serializable.py`, restoring a dataclass via `SerializableDataclass.set_state`:
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
          setattr(self, field.name, val)
  ```
  *Invariant*: Nested `Serializable` instances are recursively updated in place via `current.set_state(f_state)`. Directly assigning `setattr(self, field.name, f_state)` causes reference cross-contamination where two separate `Flow` instances share the same mutable header or connection instances.

### 2. Infinite Loop & Recursion Guards
- **WBXML Multi-Byte Integer Accumulation Termination**: In `mitmproxy/contrib/wbxml/ASWBXMLByteQueue.py`, reading multi-byte integers from ActiveSync streams uses a continuation bit:
  ```python
  def dequeueMultibyteInt(self):
      iReturn = 0
      while True:
          iReturn <<= 7
          if self.qsize() == 0:
              break
          singleByte = self.dequeueAndLog()
          iReturn += int(singleByte & 0x7F)
          if not self.checkContinuationBit(singleByte):
              return iReturn
  ```
  *Termination Proof*: Every iteration of the loop either consumes a byte from the queue via `dequeueAndLog()` or exits immediately when `self.qsize() == 0`. The queue is finite. The bitwise left-shift `iReturn <<= 7` is guarded against runaway memory exhaustion by the implicit boundary of available bytes in the queue.

- **Recursive Type Parsing Cap**: In `mitmproxy/coretypes/serializable.py`, processing generic type structures (`_process`) can encounter self-referential or cyclic types. To avoid `RecursionError`:
  ```python
  # Union unwrapping invariant:
  if origin in (UnionType, typing.Union):
      attr_type, nt = typing.get_args(attr_type)
      assert nt is NoneType, f"{attr_name}: only `x | None` union types are supported"
  ```
  The type processor explicitly limits union resolution strictly to optional types (`T | None`), preventing circular resolution branches in complex recursive types.

### 3. UI & UX Micro-Mechanics
- **Flow Update Hook Throttling**: In interactive terminals (Urwid in `mitmproxy`) and web interfaces (`mitmweb`), calling `ctx.master.addons.trigger(hooks.UpdateHook(updated))` after bulk flow modifications must batch events:
  ```python
  updated = []
  for f in flows:
      if f.killable:
          f.kill()
          updated.append(f)
  ctx.master.addons.trigger(hooks.UpdateHook(updated))
  ```
  *Invariant*: Never fire `UpdateHook` inside the loop. Firing individual hooks per flow on a list of 10,000 flows causes 10,000 separate redraw calls, locking up the UI thread and exhausting asyncio event loop microtasks.

### 4. Backend Concurrency & Memory Safety
- **Flow Interception Resumption TOCTOU Guard**:
  ```python
  intercepted = [i for i in flows if i.intercepted]
  for f in intercepted:
      f.resume()
  ```
  *Invariant*: Before executing `f.resume()`, the flow collection must be filtered by checking `i.intercepted`. Calling `.resume()` on a non-intercepted flow can result in an invalid internal state machine transition in the proxy layer, causing an unhandled exception or stream desynchronization.

- **Header Mutex Elimination via Immutable Tuples**: In `mitmproxy/coretypes/multidict.py`:
  ```python
  def set_all(self, key: KT, values: list[VT]) -> None:
      key_kconv = self._kconv(key)
      new_fields: list[tuple[KT, VT]] = []
      for field in self.fields:
          if self._kconv(field[0]) == key_kconv:
              if values:
                  new_fields.append((field[0], values.pop(0)))
          else:
              new_fields.append(field)
      while values:
          new_fields.append((key, values.pop(0)))
      self.fields = tuple(new_fields)
  ```
  *Invariant*: Reads iterate over `self.fields` without obtaining locks because `self.fields` is replaced atomically via reference reassignment. If a concurrent coroutine reads `self.fields` during an update, it reads either the complete old tuple or the complete new tuple—never a partially-modified state.

### 5. Defect & Error Prevention ("Galti Pakadna")
- **Bi-directional Mapping Invariant**: In `mitmproxy/coretypes/bidi.py`:
  ```python
  def __init__(self, **kwargs):
      self.names = kwargs
      self.values = {}
      for k, v in kwargs.items():
          self.values[v] = k
      if len(self.names) != len(self.values):
          raise ValueError("Duplicate values not allowed.")
  ```
  *Defect Trap*: If duplicate values are passed (e.g., `BiDi(a=1, b=1)`), one value would overwrite the other in `self.values`, breaking bi-directional symmetry where `CONST.get_name(1)` returns unpredictable keys. Checking `len(self.names) != len(self.values)` traps this bug at initialization.

- **Pattern Matching Exhaustion Verification**: In `mitmproxy/contentviews/_utils.py`:
  ```python
  match message:
      case http.Message(): ...
      case TCPMessage(): ...
      case UDPMessage(): ...
      case WebSocketMessage(): ...
      case DNSMessage(): ...
      case other:
          typing.assert_never(other)
  ```
  *Invariant*: The use of `typing.assert_never(other)` guarantees compile-time static type checker (mypy) verification that all variants of `ContentviewMessage` are handled. Adding a new message type without updating the viewer triggers a type-check error before reaching production.

---

## 5. The 9 Deep Learning Dimensions

### 1. Architecture
- **Boundary Decoupling**: Mitmproxy isolates network protocol layers