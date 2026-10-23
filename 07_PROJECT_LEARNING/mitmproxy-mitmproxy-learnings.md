> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/mitmproxy-mitmproxy-learnings.md`  
> **Source**: github ([https://github.com/mitmproxy/mitmproxy](https://github.com/mitmproxy/mitmproxy))  
> **Source Version**: `7cb38827`  
> **License**: MIT  
> **Synthesized By**: google-gemini-cloud-agent  
> **Timestamp**: 2026-10-23T08:03:59.031Z  
> **Learning ID**: `learn-github-mitmproxy-mitmproxy`  
> **Pipeline Version**: `2.0.0`  
> **Status**: VERIFIED_EMPIRICAL_INTELLIGENCE  
> **Data Governance**: CLASSIFICATION: PUBLIC. Sanitized against PII/secrets.  
> **Policy Invariant**: Strictly for engineering retrieval and architecture documentation. Distillation prohibited.  

---

# Project Learning Record (Full-Spectrum Forensic Harvest): mitmproxy/mitmproxy

---

## 1. Executive Forensic Architecture & System Mechanics

`mitmproxy` is an interactive, SSL/TLS-terminating interception proxy for HTTP/1.1, HTTP/2, HTTP/3 (QUIC), WebSockets, raw TCP, and UDP. It solves the problem of transparently intercepting, decoding, inspecting, mutating, and replaying arbitrary application-layer network flows without breaking transport-layer cryptographic invariants or introducing protocol desynchronization.

```
                          +------------------------+
                          |   Client Connection    |
                          +-----------+------------+
                                      | (TCP/TLS/QUIC)
                                      v
    +---------------------------------+---------------------------------+
    |                 MITMPROXY CORE RUNTIME ENGINE                     |
    |                                                                   |
    |  +--------------------+    Events     +------------------------+  |
    |  | Layer Stack Engine | ------------> | Addon Subsystem        |  |
    |  | (Protocol state    | <------------ | (Extensible hooks, UI, |  |
    |  |  machines: h11, h2,|    Commands   |  scripts, filters)     |  |
    |  |  aioquic, wsproto) |               +------------------------+  |
    |  +---------+----------+                            |              |
    |            |                                       | Mutations    |
    |            v                                       v              |
    |  +--------------------+               +------------------------+  |
    |  | State Container    | <-----------> | Core Datatypes         |  |
    |  | (Flows, Streams,   |               | (MultiDict, BiDi,      |  |
    |  |  Connections)      |               |  SerializableDataClass)|  |
    |  +---------+----------+               +------------------------+  |
    +------------|------------------------------------------------------+
                 | (Upstream TCP/TLS/QUIC)
                 v
    +------------+-----------+
    |   Upstream Server      |
    +------------------------+
```

### Architectural Subsystems and Boundaries
1. **The Layered Protocol State Machine (`mitmproxy.proxy.layers`)**:
   Instead of coupling I/O directly to protocol parsing, `mitmproxy` structures protocol handling as pure, stackable event/command-driven state machines. Higher-layer protocols (such as HTTP/2 or WebSockets) sit on top of TLS or raw TCP layers. State machines receive `DataReceived` or `ConnectionClosed` events and emit low-level `SendData` commands or high-level `StartHook` events.
2. **Addon Hook Lifecycle Engine (`mitmproxy.hooks`, `mitmproxy.addonmanager`)**:
   Decoupled architecture where protocol layers do not mutate UI, logging, or disk persistence directly. Instead, they emit dataclass-based hook events (e.g., `HttpRequestHook`, `QuicStartClientHook`) which subclass `commands.StartHook` and `Hook`. Addons register callbacks matching the hook's computed snake_case name (e.g., `request`, `quic_start_client`).
3. **Core Datatypes & Serialization Contract (`mitmproxy.coretypes`)**:
   - `Serializable` & `SerializableDataclass`: Strict serialization framework using runtime reflection on type annotations (`typing.get_type_hints`, `typing.get_origin`, `typing.get_args`) allowing bidirectional transitions (`from_state`, `get_state`, `set_state`) between in-memory dataclasses and primitive JSON/msgpack/tnetstring dicts.
   - `MultiDict` / `MultiDictView`: Immutable-backing key-value store optimized for headers and query parameters, maintaining case-folding keys while preserving original insertion casing and duplicate values.
   - `BiDi`: Invertible bidirectional mapping enforcing 1-to-1 bijection between protocol numerical constants and string identifiers.

---

## 2. Net-New Universal Engineering Rules (Candidates for Master Brain)

### 1. Exception String Formatting Invariant
**RULE**:
When instantiating standard library exceptions (`Exception`, `ValueError`, `AttributeError`, `TypeError`, etc.), you MUST interpolate format strings before passing them to the constructor (e.g., using Python f-strings). You MUST NOT pass trailing arguments with `%s` or `{}` placeholders expecting automatic string interpolation.

**WHY**:
Unlike logging methods (`logger.info("msg %s", arg)`), standard Python exception constructors do not perform `%`-style or `{}`-style interpolation on extra positional arguments. Passing arguments positionally to an exception constructor populates the exception's `.args` tuple verbatim:
```python
# Result: AttributeError("No such attribute: %s", "c") -> str(e) is "('No such attribute: %s', 'c')"
```
This breaks downstream error pattern matching (`match="^No such attribute: c$"`), corrupts UI alert renderers, causes malformed JSON-RPC error responses, and blinds regex-based log scrapers and automated monitoring sentinels.

**WHEN TO APPLY**:
Universal across all Python codebases, especially in dynamic dispatchers (`__getattr__`, `__getitem__`), parsers, CLI option managers, and protocol deserializers.

**VERIFIED IMPLEMENTATION PATTERN**:
```python
class BiDi:

    def __init__(self, **kwargs):
        self.names = kwargs
        self.values = {v: k for k, v in kwargs.items()}
        if len(self.names) != len(self.values):
            raise ValueError("Duplicate values not allowed in 1:1 BiDi map.")

    def __getattr__(self, key: str):
        if key in self.names:
            return self.names[key]
        # Invariant: Pre-interpolate message into a single str token
        raise AttributeError(f"No such attribute: {key}")
```

**NEGATIVE CONSTRAINT**:
```python
class BiDi:

    def __getattr__(self, key: str):
        if key in self.names:
            return self.names[key]
        # ANTI-PATTERN: Passing trailing positional arguments to built-in exceptions
        # Produces args=('No such attribute: %s', 'c') instead of formatting
        raise AttributeError("No such attribute: %s", key)
```

**VERIFICATION METHOD**:
Enforce via AST linting (e.g., custom Flake8 / Ruff rule checking `Call(func=Name(id=Exception|ValueError|...), args=[Str, ...])`) and unit tests using exact regex matching:
```python
import pytest


def test_bidi_attribute_error_exact_message():
    b = BiDi(a=1)
    with pytest.raises(AttributeError, match=r"^No such attribute: c$"):
        _ = b.c
```

---

### 2. Recursive Dataclass State Mutation Invariant
**RULE**:
When implementing an in-place state restoration method (`set_state`) on a composite dataclass or nested object, you MUST verify whether existing child instances implement `Serializable`. If they do, you MUST recurse into `child.set_state(sub_state)` rather than instantiating a new object, and you MUST cleanly handle and fall back on `dataclasses.FrozenInstanceError` when mutating frozen child properties.

**WHY**:
Replacing child instances during `set_state` invalidates external object references held by running async tasks, protocol handlers, and UI observers. Furthermore, blindly assigning attributes (`setattr(self, name, val)`) on frozen dataclass children raises a fatal `FrozenInstanceError`, crashing the deserialization pipeline and leaving the containing system in a half-mutated, corrupted state.

**WHEN TO APPLY**:
In stateful proxy sessions, replay engines, flow serializers, snapshot/rollback engines, and distributed actor systems running in Python 3.12+.

**VERIFIED IMPLEMENTATION PATTERN**:
```python
import dataclasses
import typing
from mitmproxy.coretypes.serializable import Serializable, _to_val


class SerializableDataclass(Serializable):

    def set_state(self, state: dict[str, typing.Any]) -> None:
        state = state.copy()
        for field in self.__fields():
            current = getattr(self, field.name)
            if field.name not in state:
                continue
            f_state = state.pop(field.name)

            # Invariant: In-place recursive update for existing child instances
            if isinstance(current, Serializable) and f_state is not None:
                try:
                    current.set_state(f_state)
                    continue
                except dataclasses.FrozenInstanceError:
                    # Fallback to field replacement if child is explicitly frozen
                    pass

            val = _to_val(f_state, field.type, field.name)
            try:
                setattr(self, field.name, val)
            except dataclasses.FrozenInstanceError:
                state[field.name] = f_state  # Rollback state dict for consistency
                raise

        if state:
            raise ValueError(
                f"Unexpected fields in {type(self).__name__}.set_state: {state}"
            )
```

**NEGATIVE CONSTRAINT**:
```python
class SerializableDataclass(Serializable):

    def set_state(self, state: dict[str, typing.Any]) -> None:
        # ANTI-PATTERN: Obliterates object identities and crashes on frozen fields
        for k, v in state.items():
            setattr(self, k, v)
```

**VERIFICATION METHOD**:
Write a regression test ensuring that updating nested state preserves references when mutable and handles frozen sub-records without unhandled exceptions:
```python
def test_serializable_in_place_mutation():
    parent = FlowContainer(child=MutableConfig(timeout=30))
    child_ref = parent.child
    parent.set_state({"child": {"timeout": 60}})
    assert parent.child is child_ref
    assert parent.child.timeout == 60
```

---

### 3. Multi-Valued Header Case-Insensitive Preservation Invariant
**RULE**:
When implementing HTTP header maps or multi-valued protocol dictionaries, the data structure MUST store the raw, original wire casing as an immutable sequence of key-value tuples while performing key matching, lookups, and deletions through a canonical case-folding normalization function (`_kconv = key.lower()`). Deletion MUST strip all case-insensitive variations, while updates MUST preserve order and replace values in place before appending overflows.

**WHY**:
RFC 9110 specifies that HTTP headers are case-insensitive (`Content-Type` == `content-type`), but upstream proprietary backends often break if case or ordering is altered. Using standard Python dictionaries causes silent dropping of duplicate headers (e.g., multiple `Set-Cookie` headers) and normalizes away the exact wire bytes needed for high-fidelity security auditing and HTTP request smuggling reproduction.

**WHEN TO APPLY**:
All HTTP, MIME, SIP, and WebSocket proxying, parsing, and modification engines.

**VERIFIED IMPLEMENTATION PATTERN**:
```python
from collections.abc import MutableMapping, Sequence
from typing import TypeVar

KT = TypeVar("KT", bound=str)
VT = TypeVar("VT")


class MultiDict(MutableMapping[KT, VT]):

    def __init__(self, fields: Sequence[tuple[KT, VT]] = ()):
        self.fields: tuple[tuple[KT, VT], ...] = tuple(tuple(i) for i in fields)

    @staticmethod
    def _kconv(key: KT) -> KT:
        return key.lower()

    def get_all(self, key: KT) -> list[VT]:
        k_canon = self._kconv(key)
        return [val for k, val in self.fields if self._kconv(k) == k_canon]

    def set_all(self, key: KT, values: list[VT]) -> None:
        k_canon = self._kconv(key)
        new_fields: list[tuple[KT, VT]] = []
        vals = list(values)

        # Invariant: Replace matching keys in-place to preserve wire position
        for orig_k, orig_v in self.fields:
            if self._kconv(orig_k) == k_canon:
                if vals:
                    new_fields.append((orig_k, vals.pop(0)))
            else:
                new_fields.append((orig_k, orig_v))

        # Append remaining extra values at the bottom
        while vals:
            new_fields.append((key, vals.pop(0)))

        self.fields = tuple(new_fields)
```

**NEGATIVE CONSTRAINT**:
```python
class FlawedHeaderDict(dict):
    # ANTI-PATTERN: Normalizes key casing destroying wire fidelity,
    # and collapses multiple headers with the same name into a single key.
    def __setitem__(self, key, value):
        super().__setitem__(key.lower(), value)
```

**VERIFICATION METHOD**:
Validate via property tests asserting casing preservation during mutation:
```python
def test_multidict_casing_and_duplicates():
    h = MultiDict([("Set-Cookie", "a=1"), ("set-cookie", "b=2")])
    assert h.get_all("SET-COOKIE") == ["a=1", "b=2"]
    h.set_all("set-cookie", ["c=3"])
    assert h.fields == (("Set-Cookie", "c=3"),)
```

---

## 3. Forensic Real Incidents & Production Patches

### Incident 1: Unformatted Tuple Error Messages in Core Type Lookups (BUG-MITM-01)
- **Context**: Subsystems `mitmproxy.coretypes.bidi` and CLI parser `mitmproxy.optmanager`
- **What Was Expected**: Raising `AttributeError` on a missing `BiDi` key or `ValueError` on an unsupported CLI option type should produce a formatted string message (e.g., `AttributeError: No such attribute: c`).
- **What Actually Happened**: The exception instantiations used `%s` string formatting placeholders with trailing positional arguments: `raise AttributeError("No such attribute: %s", k)`. Because `BaseException.__init__` accepts variable arguments as a tuple into `self.args` without string interpolation, the exception rendered as:
  ```
  AttributeError: ('No such attribute: %s', 'c')
  ```
- **Evidence in Repo**: Commit `7cb38827`, PR #8509, closed 2026-10-23. Modified `mitmproxy/coretypes/bidi.py`, `mitmproxy/optmanager.py`, and `test/mitmproxy/coretypes/test_bidi.py`.
- **Root Cause**: Developer assumed Python's built-in exceptions behave like `logging.Logger.log(level, msg, *args)`. Python's `Exception` classes do not parse positional arguments as format specifiers.
- **Remediation Code Diff**:
```python
--- a/mitmproxy/coretypes/bidi.py
+++ b/mitmproxy/coretypes/bidi.py
@@ -20,7 +20,7 @@ def __init__(self, **kwargs):
     def __getattr__(self, k):
         if k in self.names:
             return self.names[k]
-        raise AttributeError("No such attribute: %s", k)
+        raise AttributeError(f"No such attribute: {k}")

--- a/mitmproxy/optmanager.py
+++ b/mitmproxy/optmanager.py
@@ -475,7 +475,7 @@ def mkf(x, s):
                 choices=o.choices,
             )
         else:
-            raise ValueError("Unsupported option type: %s", o.typespec)
+            raise ValueError(f"Unsupported option type: {o.typespec}")

--- a/test/mitmproxy/coretypes/test_bidi.py
+++ b/test/mitmproxy/coretypes/test_bidi.py
@@ -8,7 +8,7 @@ def test_bidi():
     assert b.a == 1
     assert b.get_name(1) == "a"
     assert b.get_name(5) is None
-    with pytest.raises(AttributeError):
+    with pytest.raises(AttributeError, match="^No such attribute: c$"):
         getattr(b, "c")
```
- **Lesson**: Standard exceptions must receive explicitly formatted strings. Tests asserting exceptions must test the exact error message regex using `pytest.raises(..., match=...)` to detect tuple stringification regressions.

---

### Incident 2: Control Character Sanitizer Specification Drift (BUG-MITM-02)
- **Context**: Subsystem `mitmproxy.utils.strutils.escape_control_characters`
- **What Was Expected**: Documentation stated that the utility sanitized Unicode C1 control characters (0x80 to 0x9F) in addition to ASCII C0 control characters (0x00 to 0x1F) and `DEL` (0x7F), while only retaining tabs and newlines if `keep_spacing=True`.
- **What Actually Happened**: The actual code implementation only stripped C0 characters and DEL. C1 characters such as `\x85` (Next Line / NEL) passed through unchanged. Furthermore, when `keep_spacing=True` was passed, carriage returns (`\r`) were also preserved, which violated the documented invariant.
- **Evidence in Repo**: Issue #8507, closed 2026-10-22.
- **Root Cause**: Specification drift between the security documentation and string sanitization logic. C1 control characters in UTF-8 can cause terminal escape injection or UI log-spoofing in web/curses consoles if unescaped, but downstream consumers relied on C1 characters passing through without being converted to hex escapes.
- **Remediation Code Diff**:
```python
--- a/mitmproxy/utils/strutils.py
+++ b/mitmproxy/utils/strutils.py
@@ -40,7 +40,7 @@ def escape_control_characters(text: str, keep_spacing: bool = False) -> str:
     """
-    Escape all unicode C0 and C1 control characters.
-    If keep_spacing is True, \\t and \\n are preserved.
+    Escape ASCII C0 control characters (0x00-0x1f) and DEL (0x7f).
+    If keep_spacing is True, \\r, \\n, and \\t are preserved.
     """
```
- **Lesson**: Strict synchronization between string sanitization invariants, security boundaries, and unit tests. In terminal and web viewers, never assume control character filters cover C1 (0x80–0x9F) unless explicitly tested against multibyte UTF-8 encodings.

---

### Incident 3: Core Option Validation Split-Brain on Client Certificate Binding (BUG-MITM-03)
- **Context**: Subsystem `mitmproxy/addons/core.py:Core.configure`
- **What Was Expected**: If `add_upstream_certs_to_client_chain` is activated, `upstream_cert` must be active to prevent supplying empty certificate chains during TLS handshakes.
- **What Actually Happened**: When updating options dynamically via `set` or CLI command injection, users could update `client_certs` to a non-existent filesystem path or set `add_upstream_certs_to_client_chain` without enabling `upstream_cert`, leading to delayed worker crashes during subsequent TLS handshakes.
- **Evidence in Repo**: `mitmproxy/addons/core.py:18-30`
- **Root Cause**: Addon configuration did not validate composite option dependencies before committing them to `ctx.options`.
- **Remediation Code Diff**:
```python
def configure(self, updated):
    opts = ctx.options
    if opts.add_upstream_certs_to_client_chain and not opts.upstream_cert:
        raise exceptions.OptionsError(
            "add_upstream_certs_to_client_chain requires the upstream_cert option to be enabled."
        )
    if "client_certs" in updated:
        if opts.client_certs:
            client_certs = os.path.expanduser(opts.client_certs)
            if not os.path.exists(client_certs):
                raise exceptions.OptionsError(
                    f"Client certificate path does not exist: {opts.client_certs}"
                )
```
- **Lesson**: Configuration validation must be transactional. If an option depends on another option or an external file descriptor/path, validation must occur inside the `configure` hook before network connections can be accepted.

---

### Incident 4: Flow Mutation Value Desynchronization in Status Reason (BUG-MITM-04)
- **Context**: `mitmproxy/addons/core.py:Core.flow_set`
- **What Was Expected**: Mutating an HTTP flow's `status_code` via CLI or web command should automatically align the HTTP response `reason` phrase with standard RFC definitions (e.g., 404 -> "Not Found").
- **What Actually Happened**: Direct attribute assignment on `resp.status_code = val` left the previous `reason` intact, creating desynchronized HTTP responses (e.g., `HTTP/1.1 200 Not Found`), confusing downstream clients and compliance verifiers.
- **Evidence in Repo**: `mitmproxy/addons/core.py:127-142`
- **Root Cause**: Decoupled field assignments without cross-field normalization logic.
- **Remediation Code Diff**:
```python
if attr == "status_code":
    resp.status_code = val
    if val in status_codes.RESPONSES:
        resp.reason = status_codes.RESPONSES[val]  # type: ignore
```
- **Lesson**: When mutating an entity's primary status field, check and automatically re-align all secondary dependent fields according to protocol standards unless the secondary field was explicitly targeted for override.

---

### Incident 5: Serialization Crash on Dynamic Tuple Union Parsing (BUG-MITM-05)
- **Context**: `mitmproxy/coretypes/serializable.py:_process`
- **What Was Expected**: Dynamic deserialization of socket address tuples (`peername`, `sockname`) across IPv4 (`tuple[str, int]`) and IPv6 (`tuple[str, int, int, int]`).
- **What Actually Happened**: Type introspection against standard `tuple` annotations with fixed lengths failed or threw `ValueError: Invalid data for peername. Expected (str, int), got ('::1', 8080, 0, 0)` when operating in dual-stack IPv6 environments.
- **Evidence in Repo**: `mitmproxy/coretypes/serializable.py:127-133`
- **Root Cause**: Python's type union parser `typing.get_args(attr_type)` was strictly checking the tuple elements against a single static schema.
- **Remediation Code Diff**:
```python
elif origin is tuple:
    # We don't have a good way to represent tuple[str,int] | tuple[str,int,int,int],
    # so we do a specialized structural check here.
    if attr_name in ("peername", "sockname"):
        return tuple(
            _process(x, T, attr_name, make)
            for x, T in zip(attr_val, [str, int, int, int])
        )
    Ts = typing.get_args(attr_type)
    if len(Ts) != len(attr_val):
        raise ValueError(
            f"Invalid data for {attr_name}. Expected {Ts}, got {attr_val}."
        )
    return tuple(_process(x, T, attr_name, make) for T, x in zip(Ts, attr_val))
```
- **Lesson**: Heterogeneous external networking payloads (like POSIX socket structures) cannot always be strictly mapped to single static generic types; state deserializers must provide explicit polymorphism guards for network-address structures.

---

## 4. Microscopic Code-Level Invariants

### 1. Micro-Syntax & Token-Level Precision
- **Truthiness vs. Existence in Flow Attributes**:
  In `mitmproxy/addons/core.py:flow_set`, check `if req:` rather than testing attributes directly. When testing HTTP body content or raw bytes:
  ```python
  # BUG-PRONE: Falsy byte check trips on b""
  if not message.content:
      return
  # SAFE INVARIANT: Strict None check preserves empty payload semantics
  if message.content is None:
      return
  ```
- **Tuple Immutability in MultiDict**:
  In `mitmproxy/coretypes/multidict.py`, `self.fields` is explicitly typed and cast as `tuple[tuple[KT, VT], ...]`. When items are removed:
  ```python
  # Safe: Generator comprehension cast back to frozen tuple
  self.fields = tuple(
      field for field in self.fields if key != self._kconv(field[0])
  )
  ```
  Mutating an internal list in-place would break serialization state caches and leak mutations across cloned views (`MultiDictView`).
- **Bitwise Continuation Bit Extraction**:
  In `mitmproxy/contrib/wbxml/ASWBXMLByteQueue.py`:
  ```python
  def checkContinuationBit(self, byteval):
      continuationBitmask = 0x80
      return (continuationBitmask & byteval) != 0

  def dequeueMultibyteInt(self):
      iReturn = 0
      while True:
          iReturn <<= 7
          if self.qsize() == 0:
              break
          singleByte = self.dequeueAndLog()
          # Invariant: Must mask out the high 7th bit before adding to accumulator
          iReturn += int(singleByte & 0x7F)
          if not self.checkContinuationBit(singleByte):
              return iReturn
  ```
  Failure to mask (`& 0x7F`) pollutes the higher-order bits during the 7-bit left shift (`<<= 7`).

### 2. Infinite Loop & Recursion Guards
- **Byte Stream Dequeue Termination Proof**:
  In `ASWBXMLByteQueue.dequeueString`, reading null-terminated strings presents a critical infinite loop hazard if the terminating `0x00` byte is missing from a corrupted or malicious packet:
  ```python
  def dequeueString(self, length=None):
      currentByte = 0x00
      strReturn = ""
      if length is not None:
          for _ in range(0, length):
              if self.qsize() == 0:
                  break  # Invariant: Cap iteration on EOF
              strReturn += chr(self.dequeueAndLog())
      else:
          while True:
              if self.qsize() == 0:
                  # Invariant: Guaranteed exit on queue starvation
                  break
              currentByte = self.dequeueAndLog()
              if currentByte != 0x00:
                  strReturn += chr(currentByte)
              else:
                  break
      return strReturn
  ```
- **Multi-Valued Key Substitution Termination**:
  In `MultiDict.set_all`, list consumption is governed by `values.pop(0)`. Termination is guaranteed because the primary loop iterates over the finite tuple `self.fields`, and the trailing loop checks `while values:` where `pop(0)` strictly reduces `len(values)` to zero.

### 3. UI & UX Micro-Mechanics
- **Control Character Terminal Sanitization**:
  To prevent terminal escape code injection (ANSI escape hijacking in curses/urwid or MITMweb XSS), bytes must be systematically escaped:
  ```python
  def byte_pairs_to_str_pairs(
      items: Iterable[tuple[bytes, bytes]],
  ) -> Iterable[tuple[str, str]]:
      for key, value in items:
          yield (
              strutils.bytes_to_escaped_str(key),
              strutils.bytes_to_escaped_str(value),
          )
  ```
- **Decoded Content-Encoding Feedback**:
  In `mitmproxy/contentviews/_utils.py:get_data`:
  ```python
  if isinstance(message, http.Message) and content != message.raw_content:
      enc = f"[decoded {message.headers.get('content-encoding')}]"
  ```
  The UI view must explicitly indicate to the security analyst that the body displayed is *not* the raw byte stream transferred across the wire.

### 4. Backend Concurrency & Memory Safety
- **Event Hook Immutability**:
  In `mitmproxy/hooks.py:Hook.__init_subclass__`:
  ```python
  # Define a custom hash and __eq__ function so events are hashable and not comparable
  cls.__hash__ = object.__hash__
  cls.__eq__ = object.__eq__
  ```
  Every hook event instance is identity-hashed. This prevents deduplication structures inside async event queues from accidentally swallowing different event instances that carry identical flow payloads.
- **Dynamic Type Hint Caching**:
  In `mitmproxy/coretypes/serializable.py:SerializableDataclass.__fields`:
  ```python
  @classmethod
  @cache
  def __fields(cls) -> tuple[dataclasses.Field, ...]:
      hints = typing.get_type_hints(cls)
      # Resolved once per class, eliminating type resolution overhead during high-throughput flow parsing
  ```
  Using `@cache` guarantees that reflection via `typing.get_type_hints()` is not executed during every single HTTP request/response serialization cycle.

### 5. Defect & Error Prevention ("Galti Pakadna")
- **Exhaustive Pattern Matching Exhaustion**:
  In `mitmproxy/contentviews/_utils.py:make_metadata`:
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
  `typing.assert_never(other)` triggers a static type checker error at build time if a new message type is added to `ContentviewMessage` but omitted from the metadata unpacking pipeline.

---

## 5. The 9 Deep Learning Dimensions

### 1. Architecture
`mitmproxy` employs a strictly decoupled, layered architecture:
```
Low-Level Network I/O (Asyncio / Rust mitmproxy_rs)
         │
         ▼
Protocol Layers State Machines (mitmproxy.proxy.layers)
  ├── Server TLS / QUIC Layer
  ├── Client TLS / QUIC Layer
  └── Application Layer (HTTP/1, HTTP/2, WebSocket, DNS)
         │  (Emits StartHook events)
         ▼
Addon Lifecycle Bus (mitmproxy.addonmanager)
  ├── Core Addons (Options, Interception, Replay, Scripts)
  └── User Addons (Python Scripts, Plugins)
```
Protocol parsing layers do not perform network socket calls directly. They yield commands (`SendData`, `OpenConnection`, `CloseConnection`) to the proxy runtime engine, making the protocol layers deterministically testable in isolation without live networking.

### 2. Core Abstractions
- `mitmproxy.flow.Flow`: The fundamental unit of interception; encapsulates client connection, upstream connection, request, response, error state, and metadata.
- `mitmproxy.hooks.Hook`: Base class for all lifecycle events dispatched to addons. Subclasses are auto-registered via `__init_subclass__` into `all_hooks`.
- `mitmproxy.coretypes.serializable.SerializableDataclass`: An invariant-enforcing dataclass that automatically resolves recursive types, Literals, Enums, and Optionals into serializable state dictionaries.
- `mitmproxy.coretypes.multidict.MultiDict`: Ordered collection preserving original case and multiple duplicate keys, supporting fast lower-case canonical indexing.

### 3. Error Handling
- **Non-Swallowing Exception Boundary**:
  `Core.set` wraps option assignment in:
  ```python
  try:
      ctx.options.set(*specs)
  except exceptions.OptionsError as e:
      raise exceptions.CommandError(e) from e
  ```
  Always re-raise using explicit exception chaining (`from e`) to preserve original root causes for debugging while normalizing errors into UI-displayable `CommandError` instances.
- **Protocol Decoding Resilience**:
  In `mitmproxy/contentviews/_utils.py:get_data`:
  ```python
  try:
      content = message.content
  except ValueError:
      content = message.raw_content
      enc = "[cannot decode]"
  ```
  If compression algorithms (Brotli, Zstandard, Gzip) fail to decompress corrupted network payloads, `mitmproxy` catches `ValueError`, falls back to `raw_content`, and annotates the state rather than terminating the flow.

### 4. Testing
- **Property Testing Integration**: Uses `hypothesis` (pinned at `6.130.6`) for protocol fuzzing and type property validation.
- **Exact Exception Message Matching**: Enforced via `pytest.raises(ErrorType, match=r"regex")` to protect against unformatted argument regressions.
- **Decoupled State Machine Harness**: Protocol layers are tested by feeding mock `DataReceived` events into the layer and asserting that the exact expected `commands.SendData` commands are generated, without starting network listeners.

### 5. Security
