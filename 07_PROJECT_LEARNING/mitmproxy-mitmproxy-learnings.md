# Forensic Learning Record (Deep Inspection): mitmproxy/mitmproxy

> **Canonical Artifact**: `07_PROJECT_LEARNING/mitmproxy-mitmproxy-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/mitmproxy/mitmproxy](https://github.com/mitmproxy/mitmproxy))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-07T21:23:02.252Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `mitmproxy/mitmproxy`
- **Description**: An interactive TLS-capable intercepting HTTP proxy for penetration testers and software developers.
- **Primary Language / Ecosystem**: Python
- **Discovered Manifests / Configurations**: pyproject.toml, README.md
- **Stars / Engagement**: 45302 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: pyproject.toml, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `mitmproxy/addons/core.py`
```
import logging
import os
from collections.abc import Sequence

import mitmproxy.types
from mitmproxy import command
from mitmproxy import ctx
from mitmproxy import exceptions
from mitmproxy import flow
from mitmproxy import hooks
from mitmproxy import optmanager
from mitmproxy.log import ALERT
from mitmproxy.net.http import status_codes
from mitmproxy.utils import emoji

logger = logging.getLogger(__name__)

CONF_DIR = "~/.mitmproxy"
LISTEN_PORT = 8080


class Core:
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

    @command.command("set")
    def set(self, option: str, *value: str) -> None:
        """
        Set an option. When the value is omitted, booleans are set to true,
        strings and integers are set to None (if permitted), and sequences
        are emptied. Boolean values can be true, false or toggle.
        Multiple values are concatenated with a single space.
        """
        if value:
            specs = [f"{option}={v}" for v in value]
        else:
            specs = [option]
        try:
            ctx.options.set(*specs)
        except exceptions.OptionsError as e:
            raise exceptions.CommandError(e) from e

    @command.command("flow.resume")
    def resume(self, flows: Sequence[flow.Flow]) -> None:
        """
        Resume flows if they are intercepted.
        """
        intercepted = [i for i in flows if i.intercepted]
        for f in intercepted:
            f.resume()
        ctx.master.addons.trigger(hooks.UpdateHook(intercepted))

    # FIXME: this will become view.mark later
    @command.command("flow.mark")
    def mark(self, flows: Sequence[flow.Flow], marker: mitmproxy.types.Marker) -> None:
        """
        Mark flows.
        """
        updated = []
        if not (marker == "" or marker in emoji.emoji):
            raise exceptions.CommandError(f"invalid marker value")

        for i in flows:
            i.marked = marker
            updated.append(i)
        ctx.master.addons.trigger(hooks.UpdateHook(updated))

    # FIXME: this will become view.mark.toggle later
    @command.command("flow.mark.toggle")
    def mark_toggle(self, flows: Sequence[flow.Flow]) -> None:
        """
        Toggle mark for flows.
        """
        for i in flows:
            if i.marked:
                i.marked = ""
            else:
                i.marked = ":default:"
        ctx.master.addons.trigger(hooks.UpdateHook(flows))

    @command.command("flow.kill")
    def kill(self, flows: Sequence[flow.Flow]) -> None:
        """
        Kill running flows.
        """
        updated = []
        for f in flows:
            if f.killable:
                f.kill()
                updated.append(f)
        logger.log(ALERT, "Killed %s flows." % len(updated))
        ctx.master.addons.trigger(hooks.UpdateHook(updated))

    # FIXME: this will become view.revert later
    @command.command("flow.revert")
    def revert(self, flows: Sequence[flow.Flow]) -> None:
        """
        Revert flow changes.
        """
        updated = []
        for f in flows:
            if f.modified():
                f.revert()
                updated.append(f)
        logger.log(ALERT, "Reverted %s flows." % len(updated))
        ctx.master.addons.trigger(hooks.UpdateHook(updated))

    @command.command("flow.set.options")
    def flow_set_options(self) -> Sequence[str]:
        return [
            "host",
            "status_code",
            "method",
            "path",
            "url",
            "reason",
        ]

    @command.command("flow.set")
    @command.argument("attr", type=mitmproxy.types.Choice("flow.set.options"))
    def flow_set(self, flows: Sequence[flow.Flow], attr: str, value: str) -> None:
        """
        Quickly set a number of common values on flows.
        """
        val: int | str = value
        if attr == "status_code":
            try:
                val = int(val)  # type: ignore
            except ValueError as v:
                raise exceptions.CommandError(
                    "Status code is not an integer: %s" % val
                ) from v

        updated = []
        for f in flows:
            req = getattr(f, "request", None)
            rupdate = True
            if req:
                if attr == "method":
                    req.method = val
                elif attr == "host":
                    req.host = val
                elif attr == "path":
                    req.path = val
                elif attr == "url":
                    try:
                        req.url = val
                    except ValueError as e:
                        raise exceptions.CommandError(
                            f"URL {val!r} is invalid: {e}"
                        ) from e
                else:
                    self.rupdate = False

            resp = getattr(f, "response", None)
            supdate = True
            if resp:
                if attr == "status_code":
                    resp.status_code = val
                    if val in status_codes.RESPONSES:
                        resp.reason = status_codes.RESPONSES[val]  # type: ignore
                elif attr == "reason":
                    resp.reason = val
                else:
                    supdate = False

            if rupdate or supdate:
                updated.append(f)

        ctx.master.addons.trigger(hooks.UpdateHook(updated))
        logger.log(ALERT, f"Set {attr} on  {len(updated)} flows.")

    @command.command("flow.decode")
    def decode(self, flows: Sequence[flow.Flow], part: str) -> None:
        """
        Decode flows.
        """
        updated = []
        for f in flows:
            p = getattr(f, part, None)
            if p:
                f.backup()
                p.decode()
                updated.append(f)
        ctx.master.addons.trigger(hooks.UpdateHook(updated))
        logger.log(ALERT, "Decoded %s flows." % len(updated))

    @command.command("flow.encode.toggle")
    def encode_toggle(self, flows: Sequence[flow.Flow], part: str) -> None:
        """
        Toggle flow encoding on and off, using deflate for encoding.
        """
        updated = []
        for f in flows:
            p = getattr(f, part, None)
            if p:
                f.backup()
                current_enc = p.headers.get("content-encoding", "identity")
                if current_enc == "identity":
                    p.encode("deflate")
                else:
                    p.decode()
                updated.append(f)
        ctx.master.addons.trigger(hooks.UpdateHook(updated))
        logger.log(ALERT, "Toggled encoding on %s flows." % len(updated))

    @command.command("flow.encode")
    @command.argument("encoding", type=mitmproxy.types.Choice("flow.encode.options"))
    def encode(
        self,
        flows: Sequence[flow.Flow],
        part: str,
        encoding: str,
    ) -> None:
        """
        Encode flows with a specified encoding.
        """
        updated = []
        for f in flows:
            p = getattr(f, part, None)
            if p:
                current_enc = p.headers.get("content-encoding", "identity")
                if current_enc == "identity":
                    f.backup()
                    p.encode(encoding)
                    updated.append(f)
        ctx.master.addons.trigger(hooks.UpdateHook(updated))
        logger.log(ALERT, "Encoded %s flows." % len(updated))

    @command.command("flow.encode.options")
    def encode_options(self) -> Sequence[str]:
        """
        The possible values for an encoding specification.
        """
        return ["gzip", "deflate", "br", "zstd"]

    @command.command("options.load")
    def options_load(self, path: mitmproxy.types.Path) -> None:
        """
        Load options from a file.
        """
        try:
            optmanager.load_paths(ctx.options, path)
        except (OSError, exceptions.OptionsError) as e:
            raise exceptions.CommandError("Could not load options - %s" % e) from e

    @command.command("options.save")
    def options_save(self, path: mitmproxy.types.Path) -> None:
        """
        Save options to a file.
        """
        try:
            optmanager.save(ctx.options, path)
        except OSError as e:
            raise exceptions.CommandError("Could not save options - %s" % e) from e

    @command.command("options.reset")
    def options_reset(self) -> None:
        """
        Reset all options to defaults.
        """
        ctx.options.reset()

    @command.command("options.reset.one")
    def options_reset_one(self, name: str) -> None:
        """
        Reset one option to its default value.
        """
        if name not in ctx.options:
            raise exceptions.CommandError("No such option: %s" % name)
        setattr(
            ctx.options,
            name,
            ctx.options.default(name),
        )

```

### Core Architecture Module: `mitmproxy/contentviews/_utils.py`
```
import io
import typing
from collections.abc import Iterable
from pathlib import Path
from typing import Any

from ruamel.yaml import YAML

from .. import ctx
from .. import http
from ..dns import DNSMessage
from ..flow import Flow
from ..tcp import TCPMessage
from ..udp import UDPMessage
from ..utils import strutils
from ..websocket import WebSocketMessage
from ._api import Metadata

type ContentviewMessage = (
    http.Message | TCPMessage | UDPMessage | WebSocketMessage | DNSMessage
)


def make_metadata(
    message: ContentviewMessage,
    flow: Flow,
) -> Metadata:
    metadata = Metadata(
        flow=flow,
        protobuf_definitions=Path(ctx.options.protobuf_definitions).expanduser()
        if ctx.options.protobuf_definitions
        else None,
    )

    match message:
        case http.Message():
            metadata.http_message = message
            if ctype := message.headers.get("content-type"):
                if ct := http.parse_content_type(ctype):
                    metadata.content_type = f"{ct[0]}/{ct[1]}"
        case TCPMessage():
            metadata.tcp_message = message
        case UDPMessage():
            metadata.udp_message = message
        case WebSocketMessage():
            metadata.websocket_message = message
        case DNSMessage():
            metadata.dns_message = message
        case other:  # pragma: no cover
            typing.assert_never(other)

    return metadata


def get_data(
    message: ContentviewMessage,
) -> tuple[bytes | None, str]:
    content: bytes | None
    try:
        content = message.content
    except ValueError:
        assert isinstance(message, http.Message)
        content = message.raw_content
        enc = "[cannot decode]"
    else:
        if isinstance(message, http.Message) and content != message.raw_content:
            enc = "[decoded {}]".format(message.headers.get("content-encoding"))
        else:
            enc = ""

    return content, enc


def yaml_dumps(d: Any) -> str:
    if not d:
        return ""
    out = io.StringIO()
    YAML(typ="rt", pure=True).dump(d, out)
    return out.getvalue()


def yaml_loads(yaml: str) -> Any:
    return YAML(typ="safe", pure=True).load(yaml)


def merge_repeated_keys(items: Iterable[tuple[str, str]]) -> dict[str, str | list[str]]:
    """
    Helper function that takes a list of pairs and merges repeated keys.
    """
    ret: dict[str, str | list[str]] = {}
    for key, value in items:
        if existing := ret.get(key):
            if isinstance(existing, list):
                existing.append(value)
            else:
                ret[key] = [existing, value]
        else:
            ret[key] = value
    return ret


def byte_pairs_to_str_pairs(
    items: Iterable[tuple[bytes, bytes]],
) -> Iterable[tuple[str, str]]:
    for key, value in items:
        yield (strutils.bytes_to_escaped_str(key), strutils.bytes_to_escaped_str(value))

```

### Core Architecture Module: `mitmproxy/contrib/wbxml/ASWBXMLByteQueue.py`
```
#!/usr/bin/env python3
'''
@author: David Shaw, shawd@vmware.com

Inspired by EAS Inspector for Fiddler
https://easinspectorforfiddler.codeplex.com

----- The MIT License (MIT) -----
Filename: ASWBXMLByteQueue.py
Copyright (c) 2014, David P. Shaw

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in
all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
THE SOFTWARE.
'''
from queue import Queue
import logging

class ASWBXMLByteQueue(Queue):

    def __init__(self, wbxmlBytes):

        self.bytesDequeued = 0
        self.bytesEnqueued = 0

        Queue.__init__(self)

        for byte in wbxmlBytes:
            self.put(byte)
            self.bytesEnqueued += 1


        logging.debug("Array byte count: %d, enqueued: %d" % (self.qsize(), self.bytesEnqueued))

    """
    Created to debug the dequeueing of bytes
    """
    def dequeueAndLog(self):
        singleByte = self.get()
        self.bytesDequeued += 1
        logging.debug("Dequeued byte 0x{0:X} ({1} total)".format(singleByte, self.bytesDequeued))
        return singleByte

    """
    Return true if the continuation bit is set in the byte
    """
    def checkContinuationBit(self, byteval):
        continuationBitmask = 0x80
        return (continuationBitmask & byteval) != 0

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

    def dequeueString(self, length=None):
        if ( length != None):
            currentByte = 0x00
            strReturn = ""
            for i in range(0, length):
                # TODO: Improve this handling. We are technically UTF-8, meaning
                # that characters could be more than one byte long. This will fail if we have
                # characters outside of the US-ASCII range
                if ( self.qsize() == 0 ):
                    break
                currentByte = self.dequeueAndLog()
                strReturn += chr(currentByte)

        else:
            currentByte = 0x00
            strReturn = ""
            while True:
                currentByte = self.dequeueAndLog()
                if (currentByte != 0x00):
                    strReturn += chr(currentByte)
                else:
                    break

        return strReturn

```

### Core Architecture Module: `mitmproxy/coretypes/bidi.py`
```
class BiDi:
    """
    A wee utility class for keeping bi-directional mappings, like field
    constants in protocols. Names are attributes on the object, dict-like
    access maps values to names:

    CONST = BiDi(a=1, b=2)
    assert CONST.a == 1
    assert CONST.get_name(1) == "a"
    """

    def __init__(self, **kwargs):
        self.names = kwargs
        self.values = {}
        for k, v in kwargs.items():
            self.values[v] = k
        if len(self.names) != len(self.values):
            raise ValueError("Duplicate values not allowed.")

    def __getattr__(self, k):
        if k in self.names:
            return self.names[k]
        raise AttributeError("No such attribute: %s", k)

    def get_name(self, n, default=None):
        return self.values.get(n, default)

```

### Core Architecture Module: `mitmproxy/coretypes/multidict.py`
```
from abc import ABCMeta
from abc import abstractmethod
from collections.abc import Iterator
from collections.abc import MutableMapping
from collections.abc import Sequence
from typing import TypeVar

from mitmproxy.coretypes import serializable

KT = TypeVar("KT")
VT = TypeVar("VT")


class _MultiDict(MutableMapping[KT, VT], metaclass=ABCMeta):
    """
    A MultiDict is a dictionary-like data structure that supports multiple values per key.
    """

    fields: tuple[tuple[KT, VT], ...]
    """The underlying raw datastructure."""

    def __repr__(self):
        fields = (repr(field) for field in self.fields)
        return "{cls}[{fields}]".format(
            cls=type(self).__name__, fields=", ".join(fields)
        )

    @staticmethod
    @abstractmethod
    def _reduce_values(values: Sequence[VT]) -> VT:
        """
        If a user accesses multidict["foo"], this method
        reduces all values for "foo" to a single value that is returned.
        For example, HTTP headers are folded, whereas we will just take
        the first cookie we found with that name.
        """

    @staticmethod
    @abstractmethod
    def _kconv(key: KT) -> KT:
        """
        This method converts a key to its canonical representation.
        For example, HTTP headers are case-insensitive, so this method returns key.lower().
        """

    def __getitem__(self, key: KT) -> VT:
        values = self.get_all(key)
        if not values:
            raise KeyError(key)
        return self._reduce_values(values)

    def __setitem__(self, key: KT, value: VT) -> None:
        self.set_all(key, [value])

    def __delitem__(self, key: KT) -> None:
        if key not in self:
            raise KeyError(key)
        key = self._kconv(key)
        self.fields = tuple(
            field for field in self.fields if key != self._kconv(field[0])
        )

    def __iter__(self) -> Iterator[KT]:
        seen = set()
        for key, _ in self.fields:
            key_kconv = self._kconv(key)
            if key_kconv not in seen:
                seen.add(key_kconv)
                yield key

    def __len__(self) -> int:
        return len({self._kconv(key) for key, _ in self.fields})

    def __eq__(self, other) -> bool:
        if isinstance(other, MultiDict):
            return self.fields == other.fields
        return False

    def get_all(self, key: KT) -> list[VT]:
        """
        Return the list of all values for a given key.
        If that key is not in the MultiDict, the return value will be an empty list.
        """
        key = self._kconv(key)
        return [value for k, value in self.fields if self._kconv(k) == key]

    def set_all(self, key: KT, values: list[VT]) -> None:
        """
        Remove the old values for a key and add new ones.
        """
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

    def add(self, key: KT, value: VT) -> None:
        """
        Add an additional value for the given key at the bottom.
        """
        self.insert(len(self.fields), key, value)

    def insert(self, index: int, key: KT, value: VT) -> None:
        """
        Insert an additional value for the given key at the specified position.
        """
        item = (key, value)
        self.fields = self.fields[:index] + (item,) + self.fields[index:]

    def keys(self, multi: bool = False):
        """
        Get all keys.

        If `multi` is True, one key per value will be returned.
        If `multi` is False, duplicate keys will only be returned once.
        """
        return (k for k, _ in self.items(multi))

    def values(self, multi: bool = False):
        """
        Get all values.

        If `multi` is True, all values will be returned.
        If `multi` is False, only the first value per key will be returned.
        """
        return (v for _, v in self.items(multi))

    def items(self, multi: bool = False):
        """
        Get all (key, value) tuples.

        If `multi` is True, all `(key, value)` pairs will be returned.
        If False, only one tuple per key is returned.
        """
        if multi:
            return self.fields
        else:
            return super().items()


class MultiDict(_MultiDict[KT, VT], serializable.Serializable):
    """A concrete MultiDict, storing its own data."""

    def __init__(self, fields=()):
        super().__init__()
        self.fields = tuple(tuple(i) for i in fields)  # type: ignore

    @staticmethod
    def _reduce_values(values):
        return values[0]

    @staticmethod
    def _kconv(key):
        return key

    def get_state(self):
        return self.fields

    def set_state(self, state):
        self.fields = tuple(tuple(x) for x in state)  # type: ignore

    @classmethod
    def from_state(cls, state):
        return cls(state)


class MultiDictView(_MultiDict[KT, VT]):
    """
    The MultiDictView provides the MultiDict interface over calculated data.
    The view itself contains no state - data is retrieved from the parent on
    request, and stored back to the parent on change.
    """

    def __init__(self, getter, setter):
        self._getter = getter
        self._setter = setter
        super().__init__()

    @staticmethod
    def _kconv(key):
        # All request-attributes are case-sensitive.
        return key

    @staticmethod
    def _reduce_values(values):
        # We just return the first element if
        # multiple elements exist with the same key.
        return values[0]

    @property  # type: ignore
    def fields(self):
        return self._getter()

    @fields.setter
    def fields(self, value):
        self._setter(value)

    def copy(self) -> "MultiDict[KT,VT]":
        return MultiDict(self.fields)

```

### Core Architecture Module: `mitmproxy/coretypes/serializable.py`
```
import abc
import collections.abc
import dataclasses
import enum
import typing
import uuid
from functools import cache
from typing import TypeVar

try:
    from types import NoneType
    from types import UnionType
except ImportError:  # pragma: no cover

    class UnionType:  # type: ignore
        pass

    NoneType = type(None)  # type: ignore

T = TypeVar("T", bound="Serializable")

State = typing.Any


class Serializable(metaclass=abc.ABCMeta):
    """
    Abstract Base Class that defines an API to save an object's state and restore it later on.
    """

    @classmethod
    @abc.abstractmethod
    def from_state(cls: type[T], state) -> T:
        """
        Create a new object from the given state.
        Consumes the passed state.
        """
        raise NotImplementedError()

    @abc.abstractmethod
    def get_state(self) -> State:
        """
        Retrieve object state.
        """
        raise NotImplementedError()

    @abc.abstractmethod
    def set_state(self, state):
        """
        Set object state to the given state. Consumes the passed state.
        May return a `dataclasses.FrozenInstanceError` if the object is immutable.
        """
        raise NotImplementedError()

    def copy(self: T) -> T:
        state = self.get_state()
        if isinstance(state, dict) and "id" in state:
            state["id"] = str(uuid.uuid4())
        return self.from_state(state)


U = TypeVar("U", bound="SerializableDataclass")


class SerializableDataclass(Serializable):
    @classmethod
    @cache
    def __fields(cls) -> tuple[dataclasses.Field, ...]:
        # with from __future__ import annotations, `field.type` is a string,
        # see https://github.com/python/cpython/issues/83623.
        hints = typing.get_type_hints(cls)
        fields = []
        # noinspection PyDataclass
        for field in dataclasses.fields(cls):  # type: ignore[arg-type]
            if field.metadata.get("serialize", True) is False:
                continue
            if isinstance(field.type, str):
                field.type = hints[field.name]
            fields.append(field)
        return tuple(fields)

    def get_state(self) -> State:
        state: dict[str, State] = {}
        for field in self.__fields():
            val = getattr(self, field.name)
            state[field.name] = _to_state(val, field.type, field.name)
        return state

    @classmethod
    def from_state(cls: type[U], state) -> U:
        # state = state.copy()
        for field in cls.__fields():
            state[field.name] = _to_val(state[field.name], field.type, field.name)
        try:
            return cls(**state)  # type: ignore
        except TypeError as e:
            raise ValueError(f"Invalid state for {cls}: {e} ({state=})") from e

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
            val: typing.Any = _to_val(f_state, field.type, field.name)
            try:
                setattr(self, field.name, val)
            except dataclasses.FrozenInstanceError:
                state[field.name] = f_state  # restore state dict.
                raise

        if state:
            raise ValueError(
                f"Unexpected fields in {type(self).__name__}.set_state: {state}"
            )


def _process(
    attr_val: typing.Any, attr_type: typing.Any, attr_name: str, make: bool
) -> typing.Any:
    origin = typing.get_origin(attr_type)
    if origin is typing.Literal:
        if attr_val not in typing.get_args(attr_type):
            raise ValueError(
                f"Invalid value for {attr_name}: {attr_val!r} does not match any literal value."
            )
        return attr_val
    if origin in (UnionType, typing.Union):
        attr_type, nt = typing.get_args(attr_type)
        assert nt is NoneType, (
            f"{attr_name}: only `x | None` union types are supported`"
        )
        if attr_val is None:
            return None  # type: ignore
        else:
            return _process(attr_val, attr_type, attr_name, make)
    else:
        if attr_val is None:
            raise ValueError(f"Attribute {attr_name} must not be None.")

    if make and hasattr(attr_type, "from_state"):
        return attr_type.from_state(attr_val)  # type: ignore
    elif not make and hasattr(attr_type, "get_state"):
        return attr_val.get_state()

    if origin in (list, collections.abc.Sequence):
        (T,) = typing.get_args(attr_type)
        return [_process(x, T, attr_name, make) for x in attr_val]  # type: ignore
    elif origin is tuple:
        # We don't have a good way to represent tuple[str,int] | tuple[str,int,int,int], so we do a dirty hack here.
        if attr_name in ("peername", "sockname"):
            return tuple(
                _process(x, T, attr_name, make)
                for x, T in zip(attr_val, [str, int, int, int])
            )  # type: ignore
        Ts = typing.get_args(attr_type)
        if len(Ts) != len(attr_val):
            raise ValueError(
                f"Invalid data for {attr_name}. Expected {Ts}, got {attr_val}."
            )
        return tuple(_process(x, T, attr_name, make) for T, x in zip(Ts, attr_val))  # type: ignore
    elif origin is dict:
        k_cls, v_cls = typing.get_args(attr_type)
        return {
            _process(k, k_cls, attr_name, make): _process(v, v_cls, attr_name, make)
            for k, v in attr_val.items()
        }  # type: ignore
    elif attr_type in (int, float):
        if not isinstance(attr_val, (int, float)):
            raise ValueError(
                f"Invalid value for {attr_name}. Expected {attr_type}, got {attr_val} ({type(attr_val)})."
            )
        return attr_type(attr_val)  # type: ignore
    elif attr_type in (str, bytes, bool):
        if not isinstance(attr_val, attr_type):
            raise ValueError(
                f"Invalid value for {attr_name}. Expected {attr_type}, got {attr_val} ({type(attr_val)})."
            )
        return attr_type(attr_val)  # type: ignore
    elif isinstance(attr_type, type) and issubclass(attr_type, enum.Enum):
        if make:
            return attr_type(attr_val)  # type: ignore
        else:
            return attr_val.value
    else:
        raise TypeError(f"Unexpected type for {attr_name}: {attr_type!r}")


def _to_val(state: typing.Any, attr_type: typing.Any, attr_name: str) -> typing.Any:
    """Create an object based on the state given in val."""
    return _process(state, attr_type, attr_name, True)


def _to_state(value: typing.Any, attr_type: typing.Any, attr_name: str) -> typing.Any:
    """Get the state of the object given as val."""
    return _process(value, attr_type, attr_name, False)

```

### Core Architecture Module: `mitmproxy/hooks.py`
```
import re
import warnings
from collections.abc import Sequence
from dataclasses import dataclass
from dataclasses import fields
from dataclasses import is_dataclass
from typing import Any
from typing import ClassVar
from typing import TYPE_CHECKING

import mitmproxy.flow

if TYPE_CHECKING:
    import mitmproxy.addonmanager
    import mitmproxy.log


class Hook:
    name: ClassVar[str]

    def args(self) -> list[Any]:
        args = []
        for field in fields(self):  # type: ignore[arg-type]
            args.append(getattr(self, field.name))
        return args

    def __new__(cls, *args, **kwargs):
        if cls is Hook:
            raise TypeError("Hook may not be instantiated directly.")
        if not is_dataclass(cls):
            raise TypeError("Subclass is not a dataclass.")
        return super().__new__(cls)

    def __init_subclass__(cls, **kwargs):
        # initialize .name attribute. HttpRequestHook -> http_request
        if cls.__dict__.get("name", None) is None:
            name = cls.__name__.replace("Hook", "")
            cls.name = re.sub("(?!^)([A-Z]+)", r"_\1", name).lower()
        if cls.name in all_hooks:
            other = all_hooks[cls.name]
            warnings.warn(
                f"Two conflicting event classes for {cls.name}: {cls} and {other}",
                RuntimeWarning,
            )
        if cls.name == "":
            return  # don't register Hook class.
        all_hooks[cls.name] = cls

        # define a custom hash and __eq__ function so that events are hashable and not comparable.
        cls.__hash__ = object.__hash__  # type: ignore
        cls.__eq__ = object.__eq__  # type: ignore


all_hooks: dict[str, type[Hook]] = {}


@dataclass
class ConfigureHook(Hook):
    """
    Called when configuration changes. The updated argument is a
    set-like object containing the keys of all changed options. This
    event is called during startup with all options in the updated set.
    """

    updated: set[str]


@dataclass
class DoneHook(Hook):
    """
    Called when the addon shuts down, either by being removed from
    the mitmproxy instance, or when mitmproxy itself shuts down. On
    shutdown, this event is called after the event loop is
    terminated, guaranteeing that it will be the final event an addon
    sees. Note that log handlers are shut down at this point, so
    calls to log functions will produce no output.
    """


@dataclass
class RunningHook(Hook):
    """
    Called when the proxy is completely up and running. At this point,
    you can expect all addons to be loaded and all options to be set.
    """


@dataclass
class UpdateHook(Hook):
    """
    Update is called when one or more flow objects have been modified,
    usually from a different addon.
    """

    flows: Sequence[mitmproxy.flow.Flow]

```

### Core Architecture Module: `mitmproxy/proxy/layers/http/_hooks.py`
```
from dataclasses import dataclass

from mitmproxy import http
from mitmproxy.proxy import commands


@dataclass
class HttpRequestHeadersHook(commands.StartHook):
    """
    HTTP request headers were successfully read. At this point, the body is empty.
    """

    name = "requestheaders"
    flow: http.HTTPFlow


@dataclass
class HttpRequestHook(commands.StartHook):
    """
    The full HTTP request has been read.

    Note: If request streaming is active, this event fires after the entire body has been streamed.
    HTTP trailers, if present, have not been transmitted to the server yet and can still be modified.
    Enabling streaming may cause unexpected event sequences: For example, `response` may now occur
    before `request` because the server replied with "413 Payload Too Large" during upload.
    """

    name = "request"
    flow: http.HTTPFlow


@dataclass
class HttpResponseHeadersHook(commands.StartHook):
    """
    HTTP response headers were successfully read. At this point, the body is empty.
    """

    name = "responseheaders"
    flow: http.HTTPFlow


@dataclass
class HttpResponseHook(commands.StartHook):
    """
    The full HTTP response has been read.

    Note: If response streaming is active, this event fires after the entire body has been streamed.
    HTTP trailers, if present, have not been transmitted to the client yet and can still be modified.
    """

    name = "response"
    flow: http.HTTPFlow


@dataclass
class HttpErrorHook(commands.StartHook):
    """
    An HTTP error has occurred, e.g. invalid server responses, or
    interrupted connections. This is distinct from a valid server HTTP
    error response, which is simply a response with an HTTP error code.

    Every flow will receive either an error or an response event, but not both.
    """

    name = "error"
    flow: http.HTTPFlow


@dataclass
class HttpConnectHook(commands.StartHook):
    """
    An HTTP CONNECT request was received. This event can be ignored for most practical purposes.

    This event only occurs in regular and upstream proxy modes
    when the client instructs mitmproxy to open a connection to an upstream host.
    Setting a non 2xx response on the flow will return the response to the client and abort the connection.

    CONNECT requests are HTTP proxy instructions for mitmproxy itself
    and not forwarded. They do not generate the usual HTTP handler events,
    but all requests going over the newly opened connection will.
    """

    flow: http.HTTPFlow


@dataclass
class HttpConnectUpstreamHook(commands.StartHook):
    """
    An HTTP CONNECT request is about to be sent to an upstream proxy.
    This event can be ignored for most practical purposes.

    This event can be used to set custom authentication headers for upstream proxies.

    CONNECT requests do not generate the usual HTTP handler events,
    but all requests going over the newly opened connection will.
    """

    flow: http.HTTPFlow


@dataclass
class HttpConnectedHook(commands.StartHook):
    """
    HTTP CONNECT was successful

    > [!WARNING]
    > This may fire before an upstream connection has been established
    > if `connection_strategy` is set to `lazy` (default)
    """

    flow: http.HTTPFlow


@dataclass
class HttpConnectErrorHook(commands.StartHook):
    """
    HTTP CONNECT has failed.
    This can happen when the upstream server is unreachable or proxy authentication is required.
    In contrast to the `error` hook, `flow.error` is not guaranteed to be set.
    """

    flow: http.HTTPFlow

```

### Core Architecture Module: `mitmproxy/proxy/layers/quic/_hooks.py`
```
from __future__ import annotations

from dataclasses import dataclass
from dataclasses import field
from ssl import VerifyMode

from aioquic.tls import CipherSuite
from cryptography import x509
from cryptography.hazmat.primitives.asymmetric import dsa
from cryptography.hazmat.primitives.asymmetric import ec
from cryptography.hazmat.primitives.asymmetric import rsa

from mitmproxy.proxy import commands
from mitmproxy.tls import TlsData


@dataclass
class QuicTlsSettings:
    """
    Settings necessary to establish QUIC's TLS context.
    """

    alpn_protocols: list[str] | None = None
    """A list of supported ALPN protocols."""
    certificate: x509.Certificate | None = None
    """The certificate to use for the connection."""
    certificate_chain: list[x509.Certificate] = field(default_factory=list)
    """A list of additional certificates to send to the peer."""
    certificate_private_key: (
        dsa.DSAPrivateKey | ec.EllipticCurvePrivateKey | rsa.RSAPrivateKey | None
    ) = None
    """The certificate's private key."""
    cipher_suites: list[CipherSuite] | None = None
    """An optional list of allowed/advertised cipher suites."""
    ca_path: str | None = None
    """An optional path to a directory that contains the necessary information to verify the peer certificate."""
    ca_file: str | None = None
    """An optional path to a PEM file that will be used to verify the peer certificate."""
    verify_mode: VerifyMode | None = None
    """An optional flag that specifies how/if the peer's certificate should be validated."""


@dataclass
class QuicTlsData(TlsData):
    """
    Event data for `quic_start_client` and `quic_start_server` event hooks.
    """

    settings: QuicTlsSettings | None = None
    """
    The associated `QuicTlsSettings` object.
    This will be set by an addon in the `quic_start_*` event hooks.
    """


@dataclass
class QuicStartClientHook(commands.StartHook):
    """
    TLS negotiation between mitmproxy and a client over QUIC is about to start.

    An addon is expected to initialize data.settings.
    (by default, this is done by `mitmproxy.addons.tlsconfig`)
    """

    data: QuicTlsData


@dataclass
class QuicStartServerHook(commands.StartHook):
    """
    TLS negotiation between mitmproxy and a server over QUIC is about to start.

    An addon is expected to initialize data.settings.
    (by default, this is done by `mitmproxy.addons.tlsconfig`)
    """

    data: QuicTlsData

```

### Core Architecture Module: `mitmproxy/proxy/server_hooks.py`
```
from dataclasses import dataclass

from . import commands
from mitmproxy import connection


@dataclass
class ClientConnectedHook(commands.StartHook):
    """
    A client has connected to mitmproxy. Note that a connection can
    correspond to multiple HTTP requests.

    Setting client.error kills the connection.
    """

    client: connection.Client


@dataclass
class ClientDisconnectedHook(commands.StartHook):
    """
    A client connection has been closed (either by us or the client).
    """

    client: connection.Client


@dataclass
class ServerConnectionHookData:
    """Event data for server connection event hooks."""

    server: connection.Server
    """The server connection this hook is about."""
    client: connection.Client
    """The client on the other end."""


@dataclass
class ServerConnectHook(commands.StartHook):
    """
    Mitmproxy is about to connect to a server.
    Note that a connection can correspond to multiple requests.

    Setting data.server.error kills the connection.
    """

    data: ServerConnectionHookData


@dataclass
class ServerConnectedHook(commands.StartHook):
    """
    Mitmproxy has connected to a server.
    """

    data: ServerConnectionHookData


@dataclass
class ServerDisconnectedHook(commands.StartHook):
    """
    A server connection has been closed (either by us or the server).
    """

    data: ServerConnectionHookData


@dataclass
class ServerConnectErrorHook(commands.StartHook):
    """
    Mitmproxy failed to connect to a server.

    Every server connection will receive either a server_connected or a server_connect_error event, but not both.
    """

    data: ServerConnectionHookData

```

### Core Architecture Module: `mitmproxy/proxy/utils.py`
```
"""
Utility decorators that help build state machines
"""

import functools

from mitmproxy.proxy import events


def expect(*event_types):
    """
    Only allow the given event type.
    If another event is passed, an AssertionError is raised.
    """

    def decorator(f):
        if __debug__ is True:

            @functools.wraps(f)
            def _check_event_type(self, event: events.Event):
                if isinstance(event, event_types):
                    return f(self, event)
                else:
                    event_types_str = (
                        "|".join(e.__name__ for e in event_types) or "no events"
                    )
                    raise AssertionError(
                        f"Unexpected event type at {f.__qualname__}: "
                        f"Expected {event_types_str}, got {event}."
                    )

            return _check_event_type
        else:  # pragma: no cover
            return f

    return decorator


class ReceiveBuffer:
    """
    A data structure to collect stream contents efficiently in O(n).
    """

    _chunks: list[bytes]
    _len: int

    def __init__(self):
        self._chunks = []
        self._len = 0

    def __iadd__(self, other: bytes):
        assert isinstance(other, bytes)
        self._chunks.append(other)
        self._len += len(other)
        return self

    def __len__(self):
        return self._len

    def __bytes__(self):
        return b"".join(self._chunks)

    def __bool__(self):
        return self._len > 0

    def clear(self):
        self._chunks.clear()
        self._len = 0

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #8473** (2026-10-05): **Do not add empty SAN extensions**
  *Symptoms*: #### Description  See https://github.com/pyca/cryptography/pull/15472 for context.  #### Checklist   - [x] I have updated tests where applicable. 

- **Issue #8472** (2026-10-05): **Allow typing-extensions up to 4.16.0**
  *Symptoms*: Follow-up to the discussion in #8247.  The upper bound of `typing-extensions` is still `<=4.14`, while 4.14.1 (2025-07-04), 4.15.0 (2025-08-25) and 4.16.0 (2026-07-02) have been released. On Python 3.12 this makes mitmproxy impossible to resolve next to packages that need a newer release, e.g. pydantic 2.12+ (`typing-extensions>=4.14.1`) or browser-use (`typing-extensions==4.15.0`).  This keeps the project's bounds policy and only bumps the exact bound and `uv.lock`, the way Dependabot does for the other dependencies. In #8247 I mentioned `<=4.15`; I went to 4.16.0 instead since it is the latest release, which is what a Dependabot bump would pick. Happy to lower it to 4.15.0 if you prefer.  Tests: `uv run pytest test/mitmproxy -n auto` on Python 3.12.8 with typing-extensions 4.16.0 locked: 1997 passed, 5 skipped. I did not run the full tox matrix locally. 

- **Issue #8471** (2026-10-05): **Don't apply global listen_port to modes without a port**
  *Symptoms*: #### Description  Fixes #8235.  `ProxyMode.listen_port()` fell back to the global `listen_port` option even for modes with `default_port = None` (local, tun, osproxy), which don't bind a socket. With `listen_port` set, enabling local capture therefore tried to claim the same address as the regular proxy and failed the duplicate-address check.  Modes without a default port now return `None` unless a port is given explicitly in the mode spec (`local@1234` keeps working as before).  #### Checklist   - [x] I have updated tests where applicable.  - [x] I have added an entry to the CHANGELOG. 

- **Issue #8470** (2026-10-03): **Clarify inbound header validation scope**
  *Symptoms*: #### Description  Clarify that `validate_inbound_headers` covers incoming requests and responses.  Fixes #8468.  #### Checklist   - [x] Tests are not applicable to this wording-only change.  - [x] I have added an entry to the CHANGELOG. 

- **Issue #8469** (2026-10-03): **Fix Basic auth passwords containing colons**
  *Symptoms*: #### Description  Allow colons in Basic authentication passwords, as permitted by RFC 7617. Includes a regression test.  #### Checklist   - [x] I have updated tests where applicable.  - [x] I have added an entry to the CHANGELOG. 

- **Issue #8468** (2026-10-03): **validate_inbound_headers also disables upstream response validation**
  *Symptoms*: The option description says it validates incoming requests, but it also gates `validate_headers(self.flow.response)` in `HttpStream.check_invalid`.  Minimal reproduction on current `main`:  ```python def test_response_validation_disabled(tctx):     tctx.options.validate_inbound_headers = False     server = Placeholder(Server)     flow = Placeholder(HTTPFlow)     assert (         Playbook(http.HttpLayer(tctx, HTTPMode.regular))         >> DataReceived(tctx.client, b"GET http://example.com/ HTTP/1.1\r\nHost: example.com\r\n\r\n")         << http.HttpRequestHeadersHook(flow) >> reply()         << http.HttpRequestHook(flow) >> reply()         << OpenConnection(server) >> reply(None)         << SendData(server, b"GET / HTTP/1.1\r\nHost: example.com\r\n\r\n")         >> DataReceived(             server,             b"HTTP/1.1 200 OK\r\nTransfer-Encoding: chunked\r\n"             b"Content-Length: 42\r\n\r\n0\r\n\r\n",         )         << http.HttpResponseHeadersHook(flow)     ) ```  This passes, so the invalid upstream response reaches `HttpResponseHeadersHook`. I verified it locally on `be758251c42116a17a1d7236d020af603fd82ef7`.  Would it make sense to update the option text to say that disabling it also skips upstream response validation? 
  **Post-Mortem & Fix Analysis**:
  > We can change  > Make sure that incoming HTTP requests are not malformed.  to  > Make sure that incoming HTTP requests and responses are not malformed.

- **Issue #8467** (2026-10-03): **Fix curl/httpie body export fidelity with ANSI-C quoting**
  *Symptoms*: Fixes #8425  `request_content_for_console()` wrapped bodies containing control characters in `"$(printf '...')"` — the `printf` run expands the `\xNN` escapes back into bytes. That mangles bodies in three ways, exactly as reported:  - `%` starts a printf format directive: `a=100%\nb=2` is exported as `$(printf 'a=100%\x0ab=2')` and arrives as `a=100` (with a shell error about an invalid format character); - backslash sequences in the body get interpreted by printf: `C:\new\temp` gains a newline and a tab; - command substitution strips trailing newlines, so the very common `{"a":1}\n` JSON body arrives without its final byte.  This PR applies the fix suggested by @monasco in the issue: bodies are emitted as `$'...'` (ANSI-C quoting), which expands `\xNN` byte for byte, leaves `%` and `$` literal, and is not subject to `$()` newline stripping. Literal backslashes and single quotes in the body are escaped.  One compatibility note: `$'...'` requires bash/zsh/ksh rather than POSIX dash — but the previous `"$(printf ...)"` form never worked in cmd/PowerShell either, so interactive POSIX-ish shells were always the target audience.  Verification:  - `test_expand_escaped` updated to the new output shape, plus four regression tests covering the issue's table (trailing newline, `%`, backslashes, single quote + control char): 45/45 pass. - Exported commands were evaluated in a real bash and compared byte-for-byte: all bodies now round-trip exactly, where stock mitmproxy 13.0.0.dev loses 

- **Issue #8466** (2026-10-02): **build(deps): bump the github-actions group with 4 updates**
  *Symptoms*: Bumps the github-actions group with 4 updates: [codecov/codecov-action](https://github.com/codecov/codecov-action), [docker/setup-qemu-action](https://github.com/docker/setup-qemu-action), [docker/setup-buildx-action](https://github.com/docker/setup-buildx-action) and [docker/build-push-action](https://github.com/docker/build-push-action).  Updates `codecov/codecov-action` from 7.0.0 to 7.1.1 <details> <summary>Release notes</summary> <p><em>Sourced from <a href="https://github.com/codecov/codecov-action/releases">codecov/codecov-action's releases</a>.</em></p> <blockquote> <h2>v7.1.1</h2> <h2>What's Changed</h2> <ul> <li>chore(release): 7.1.1 by <a href="https://github.com/thomasrockhu-codecov"><code>@​thomasrockhu-codecov</code></a> in <a href="https://redirect.github.com/codecov/codecov-action/pull/1973">codecov/codecov-action#1973</a></li> </ul> <p><strong>Full Changelog</strong>: <a href="https://github.com/codecov/codecov-action/compare/v7.1.0...v7.1.1">https://github.com/codecov/codecov-action/compare/v7.1.0...v7.1.1</a></p> <h2>v7.1.0</h2> <h2>What's Changed</h2> <ul> <li>chore(release): 7.1.0 by <a href="https://github.com/thomasrockhu-codecov"><code>@​thomasrockhu-codecov</code></a> in <a href="https://redirect.github.com/codecov/codecov-action/pull/1971">codecov/codecov-action#1971</a></li> </ul> <p><strong>Full Changelog</strong>: <a href="https://github.com/codecov/codecov-action/compare/v7.0.0...v7.1.0">https://github.com/codecov/codecov-action/compare/v7.0.0...

### D4: Resource Lifecycle & Leak Defenses
- Memory allocation, socket lifecycle, and handle cleanup observed from bug fixes and PR deltas.

### D5: Boundary Deserialization & Encoding
- Schema deserialization, payload validation, and untrusted input guards.

### D6: Cross-Platform & Runtime Gotchas
- Platform variance, OS-specific gotchas, and environment discrepancies detected in issue reports.

### D7: Build, CI/CD, Deployment & Tooling
- Toolchain requirements, dependencies, and packaging specs verified against remote manifests.

### D8: Forensic Bug Fixes & Real Production Code Patches
Observed empirical fixes and code patches:

### Incident Patch 1: `3368a0a0` (2026-10-03)
**Commit Message**: Fix Basic auth passwords containing colons (#8469)

* Fix Basic auth passwords containing colons

* [autofix.ci] apply automated fixes

---------

Co-authored-by: autofix-ci[bot] <114827586+autofix-ci[bot]@users.noreply.github.com>
Co-authored-by: Maximilian Hils <[REDACTED_EMAIL]>

**File**: `CHANGELOG.md` (modified, +2/-0)
```diff
@@ -7,6 +7,8 @@
 
 ## Unreleased: mitmproxy next
 
+- Accept colons in Basic authentication passwords.
+  ([#8469](https://github.com/mitmproxy/mitmproxy/pull/8469), @gigioneggiando)
 - Clarify that inbound header validation covers requests and responses.
   ([#8470](https://github.com/mitmproxy/mitmproxy/pull/8470), @gigioneggiando)
 - mitmweb: Support `float` addon options in the Options editor.
```

**File**: `mitmproxy/addons/proxyauth.py` (modified, +3/-1)
```diff
@@ -169,7 +169,9 @@ def parse_http_basic_auth(s: str) -> tuple[str, str, str]:
         raise ValueError("Unknown scheme")
     try:
         user, password = (
-            binascii.a2b_base64(authinfo.encode()).decode("utf8", "replace").split(":")
+            binascii.a2b_base64(authinfo.encode())
+            .decode("utf8", "replace")
+            .split(":", 1)
         )
     except binascii.Error as e:
         raise ValueError(str(e))
```

**File**: `test/mitmproxy/addons/test_proxyauth.py` (modified, +5/-0)
```diff
@@ -29,6 +29,11 @@ def test_parse_http_basic_auth():
     assert proxyauth.parse_http_basic_auth(input) == ("basic", "test", "test")
 
 
+def test_parse_http_basic_auth_password_with_colon():
+    input = proxyauth.mkauth("test", "pass:word")
+    assert proxyauth.parse_http_basic_auth(input) == ("basic", "test", "pass:word")
+
+
 @pytest.mark.parametrize(
     "input",
     [
```

---

### Incident Patch 2: `be758251` (2026-10-02)
**Commit Message**: build(deps): bump the github-actions group with 4 updates (#8466)

Bumps the github-actions group with 4 updates: [codecov/codecov-action](https://github.com/codecov/codecov-action), [docker/setup-qemu-action](https://github.com/docker/setup-qemu-action), [docker/setup-buildx-action](https://github.com/docker/setup-buildx-action) and [docker/build-push-action](https://github.com/docker/build-push-action).


Updates `codecov/codecov-action` from 7.0.0 to 7.1.1
- [Release notes](https://github.com/codecov/codecov-action/releases)
- [Changelog](https://github.com/codecov/codecov-action/blob/main/CHANGELOG.md)
- [Commits](https://github.com/codecov/codecov-action/compare/fb8b3582c8e4def4969c97caa2f19720cb33a72f...303a32d7a59b442fa8d48b6a1cc6825c09c847a5)

Updates `docker/setup-qemu-action` from 4.2.0 to 4.4.0
- [Release notes](https://github.com/docker/setup-qemu-action/releases)
- [Commits](https://github.com/docker/setup-qemu-action/compare/96fe6ef7f33517b61c61be40b68a1882f3264fb8...99012661954931238ded8c8b007157a8430204e1)

Updates `docker/setup-buildx-action` from 4.3.0 to 4.4.1
- [Release notes](https://github.com/docker/setup-buildx-action/releases)
- [Commits](https://github.com

**File**: `.github/workflows/main.yml` (modified, +5/-5)
```diff
@@ -58,7 +58,7 @@ jobs:
           args: --only-group tox
 
       - run: tox -e py${{ matrix.py }}
-      - uses: codecov/codecov-action@fb8b3582c8e4def4969c97caa2f19720cb33a72f # v6
+      - uses: codecov/codecov-action@303a32d7a59b442fa8d48b6a1cc6825c09c847a5 # v7.1.1
         with:
           token: ${{ secrets.CODECOV_TOKEN }}
           files: ./coverage.xml
@@ -170,7 +170,7 @@ jobs:
         run: npm ci
       - working-directory: ./web
         run: npm test
-      - uses: codecov/codecov-action@fb8b3582c8e4def4969c97caa2f19720cb33a72f # v6
+      - uses: codecov/codecov-action@303a32d7a59b442fa8d48b6a1cc6825c09c847a5 # v7.1.1
         with:
           token: ${{ secrets.CODECOV_TOKEN }}
           files: ./web/coverage/coverage-final.json
@@ -251,8 +251,8 @@ jobs:
         with:
           name: binaries.wheel
           path: release/docker
-      - uses: docker/setup-qemu-action@96fe6ef7f33517b61c61be40b68a1882f3264fb8 # v4.2.0
-      - uses: docker/setup-buildx-action@37fe631027851001ddb9b187196cc803df7f5f0e # v1.6.0
+      - uses: docker/setup-qemu-action@99012661954931238ded8c8b007157a8430204e1 # v4.4.0
+      - uses: docker/setup-buildx-action@f87e5991a6d7451dcb8d9637bfbc97413f497069 # v1.6.0
         with:
           cache-binary: false
 
@@ -286,7 +286,7 @@ jobs:
 
       - name: Build and push
         id: push
-        uses: docker/build-push-action@53b7df96c91f9c12dcc8a07bcb9ccacbed38856a # v7.3.0
+        uses: docker/build-push-action@c3c9e263c25d99ce0380d002d59b67737d91b0dc # v7.4.0
         with:
           context: release/docker
           platforms: linux/amd64,linux/arm64
```

---

### Incident Patch 3: `24e6b9c3` (2026-10-02)
**Commit Message**: build(deps): update pyparsing requirement from <=3.3.2,>=3.3.2 to >=3.3.2,<=3.3.3 (#8464)

* build(deps): update pyparsing requirement

Updates the requirements on [pyparsing](https://github.com/pyparsing/pyparsing) to permit the latest version.
- [Release notes](https://github.com/pyparsing/pyparsing/releases)
- [Changelog](https://github.com/pyparsing/pyparsing/blob/master/CHANGES)
- [Commits](https://github.com/pyparsing/pyparsing/compare/3.3.2...3.3.3)

---
updated-dependencies:
- dependency-name: pyparsing
  dependency-version: 3.3.3
  dependency-type: direct:production
...

Signed-off-by: dependabot[bot] <[REDACTED_EMAIL]>

* [autofix.ci] apply automated fixes

---------

Signed-off-by: dependabot[bot] <[REDACTED_EMAIL]>
Co-authored-by: dependabot[bot] <49699333+dependabot[bot]@users.noreply.github.com>
Co-authored-by: autofix-ci[bot] <114827586+autofix-ci[bot]@users.noreply.github.com>

**File**: `pyproject.toml` (modified, +1/-1)
```diff
@@ -48,7 +48,7 @@ dependencies = [
     "mitmproxy_rs>=0.12.6,<0.13",  # relaxed upper bound here: we control this
     "pydivert>=2.0.3,<=3.1.3; sys_platform == 'win32'",
     "pyOpenSSL>=24.3,<=27.0.0",
-    "pyparsing>=3.3.2,<=3.3.2",
+    "pyparsing>=3.3.2,<=3.3.3",
     "pyperclip>=1.9.0,<=1.11.0",
     "ruamel.yaml>=0.18.10,<=0.19.1",
     "sortedcontainers>=2.3,<=2.4.0",
```

**File**: `uv.lock` (modified, +1/-1)
```diff
@@ -1089,7 +1089,7 @@ requires-dist = [
     { name = "publicsuffix2", specifier = ">=2.20190812,<=2.20191221" },
     { name = "pydivert", marker = "sys_platform == 'win32'", specifier = ">=2.0.3,<=3.1.3" },
     { name = "pyopenssl", specifier = ">=24.3,<=27.0.0" },
-    { name = "pyparsing", specifier = "<=3.3.2,>=3.3.2" },
+    { name = "pyparsing", specifier = ">=3.3.2,<=3.3.3" },
     { name = "pyperclip", specifier = ">=1.9.0,<=1.11.0" },
     { name = "ruamel-yaml", specifier = ">=0.18.10,<=0.19.1" },
     { name = "sortedcontainers", specifier = ">=2.3,<=2.4.0" },
```

---

### Incident Patch 4: `04199b68` (2026-10-02)
**Commit Message**: build(deps): update tornado requirement from <=6.5.8,>=6.5.0 to >=6.5.0,<=6.5.10 (#8465)

* build(deps): update tornado requirement

Updates the requirements on [tornado](https://github.com/tornadoweb/tornado) to permit the latest version.
- [Changelog](https://github.com/tornadoweb/tornado/blob/master/docs/releases.rst)
- [Commits](https://github.com/tornadoweb/tornado/compare/v6.5.0...v6.5.10)

---
updated-dependencies:
- dependency-name: tornado
  dependency-version: 6.5.10
  dependency-type: direct:production
...

Signed-off-by: dependabot[bot] <[REDACTED_EMAIL]>

* [autofix.ci] apply automated fixes

---------

Signed-off-by: dependabot[bot] <[REDACTED_EMAIL]>
Co-authored-by: dependabot[bot] <49699333+dependabot[bot]@users.noreply.github.com>
Co-authored-by: autofix-ci[bot] <114827586+autofix-ci[bot]@users.noreply.github.com>

**File**: `pyproject.toml` (modified, +1/-1)
```diff
@@ -52,7 +52,7 @@ dependencies = [
     "pyperclip>=1.9.0,<=1.11.0",
     "ruamel.yaml>=0.18.10,<=0.19.1",
     "sortedcontainers>=2.3,<=2.4.0",
-    "tornado>=6.5.0,<=6.5.8",
+    "tornado>=6.5.0,<=6.5.10",
     "typing-extensions>=4.13.2,<=4.14; python_version < '3.13'",
     "urwid>=2.6.14,<=4.0.13",
     "wsproto>=1.0,<=1.3.2",
```

**File**: `uv.lock` (modified, +1/-1)
```diff
@@ -1093,7 +1093,7 @@ requires-dist = [
     { name = "pyperclip", specifier = ">=1.9.0,<=1.11.0" },
     { name = "ruamel-yaml", specifier = ">=0.18.10,<=0.19.1" },
     { name = "sortedcontainers", specifier = ">=2.3,<=2.4.0" },
-    { name = "tornado", specifier = ">=6.5.0,<=6.5.8" },
+    { name = "tornado", specifier = ">=6.5.0,<=6.5.10" },
     { name = "typing-extensions", marker = "python_full_version < '3.13'", specifier = ">=4.13.2,<=4.14" },
     { name = "urwid", specifier = ">=2.6.14,<=4.0.13" },
     { name = "wsproto", specifier = ">=1.0,<=1.3.2" },
```

---

### Incident Patch 5: `2ae76299` (2026-10-02)
**Commit Message**: build(deps-dev): bump ruff from 0.16.4 to 0.16.9 (#8463)

* build(deps-dev): bump ruff from 0.16.4 to 0.16.9

Bumps [ruff](https://github.com/astral-sh/ruff) from 0.16.4 to 0.16.9.
- [Release notes](https://github.com/astral-sh/ruff/releases)
- [Changelog](https://github.com/astral-sh/ruff/blob/main/CHANGELOG.md)
- [Commits](https://github.com/astral-sh/ruff/compare/0.16.4...0.16.9)

---
updated-dependencies:
- dependency-name: ruff
  dependency-version: 0.16.9
  dependency-type: direct:development
  update-type: version-update:semver-patch
...

Signed-off-by: dependabot[bot] <[REDACTED_EMAIL]>

* [autofix.ci] apply automated fixes

---------

Signed-off-by: dependabot[bot] <[REDACTED_EMAIL]>
Co-authored-by: dependabot[bot] <49699333+dependabot[bot]@users.noreply.github.com>
Co-authored-by: autofix-ci[bot] <114827586+autofix-ci[bot]@users.noreply.github.com>

**File**: `pyproject.toml` (modified, +1/-1)
```diff
@@ -85,7 +85,7 @@ tox = [
     "tox-uv==1.35.2",
 ]
 ruff = [
-    "ruff==0.16.4",
+    "ruff==0.16.9",
 ]
 deploy = [
     "awscli==1.46.1",
```

**File**: `uv.lock` (modified, +23/-23)
```diff
@@ -1119,13 +1119,13 @@ dev = [
     { name = "pytest-timeout", specifier = "==2.4.0" },
     { name = "pytest-xdist", specifier = "==3.8.0" },
     { name = "requests", specifier = "==2.34.2" },
-    { name = "ruff", specifier = "==0.16.4" },
+    { name = "ruff", specifier = "==0.16.9" },
     { name = "tox", specifier = "==4.55.1" },
     { name = "tox-uv", specifier = "==1.35.2" },
     { name = "types-requests", specifier = "==2.33.0.20260408" },
     { name = "wheel", specifier = "==0.48.0" },
 ]
-ruff = [{ name = "ruff", specifier = "==0.16.4" }]
+ruff = [{ name = "ruff", specifier = "==0.16.9" }]
 tox = [
     { name = "tox", specifier = "==4.55.1" },
     { name = "tox-uv", specifier = "==1.35.2" },
@@ -1730,27 +1730,27 @@ wheels = [
 
 [[package]]
 name = "ruff"
-version = "0.16.4"
-source = { registry = "https://pypi.org/simple" }
-sdist = { url = "https://files.pythonhosted.org/packages/00/8f/d8074b1f25e003164087a8bfe79a0f1a3945135764dbb6aaab04103dcaf9/ruff-0.16.4.tar.gz", hash = "sha256:13171aa9d9af2240ee3504e639de73122c67e74036de5ba2e1d01422cd17e3dc", size = 4899731, upload-time = "2026-08-20T17:43:59.196Z" }
-wheels = [
-    { url = "https://files.pythonhosted.org/packages/ff/80/779895ef584e089d22f2c6df0d0e99a65ec2df0805f1fffd439415b8c1f0/ruff-0.16.4-py3-none-linux_armv6l.whl", hash = "sha256:df4075f71ddac40b9934af60c3ec8a53047dd5a5fdc43224e6e4e8e9a27cb6f7", size = 10006909, upload-time = "2026-08-20T17:43:16.888Z" },
-    { url = "https://files.pythonhosted.org/packages/a9/e6/f553199b5e8927a05cb5c422d921fd0656b29ab976e91c44802107c6b0da/ruff-0.16.4-py3-none-macosx_10_12_x86_64.whl", hash = "sha256:0c95538517af68004306b0fb3214ff2f2af67a65092aee77cd9eb86db6656604", size = 10240201, upload-time = "2026-08-20T17:43:19.337Z" },
-    { url = "https://files.pythonhosted.org/packages/1c/70/4a6dc4bb34da4dee35e30f09bbd1bfbdd26f33b62fb9b8df31f08a199cd2/ruff-0.16.4-py3-none-macosx_11_0_arm64.whl", hash = "sha256:963f83df8e69e575b64d67dd447ebbc917db41a14bf38d4593a4183e7aaa8255", size = 9835122, upload-time = "2026-08-20T17:43:21.708Z" },
-    { url = "https://files.pythonhosted.org/packages/24/12/c6e22d686372c15bcb7af99831f1a1be96df696491babf4f24e4f942c527/ruff-0.16.4-py3-none-manylinux_2_17_aarch64.manylinux2014_aarch64.whl", hash = "sha256:32a5057c7ff3f6e6480a48fccfb3a412a690f48a3d03ac5cf08177d6c2da3ade", size = 9977162, upload-time = "2026-08-20T17:43:24.236Z" },
-    { url = "https://files.pythonhosted.org/packages/46/49/72b10ec912f5ab5854992eaf7aa7cd36729b6937d9dc4e0fb41b3bf428ec/ruff-0.16.4-py3-none-manylinux_2_17_armv7l.manylinux2014_armv7l.whl", hash = "sha256:b3dce8d9b0c57c265b91885a66a567d8ea1372e8eb4e250fa8e5e3f579e99cff", size = 9829789, upload-time = "2026-08-20T17:43:26.966Z" },
-    { url = "https://files.pythonhosted.org/packages/fa/80/0f30e32e7f6ee26edc39075502db9d368d788a44a79b55f763eb4ab03796/ruff-0.16.4-py3-none-manylinux_2_17_i686.manylinux2014_i686.whl", hash = "sha256:7dc651db49283c69f8e72c834eec4fe5573e4c646856aebece0ce385dceb2a80", size = 10527949, upload-time = "2026-08-20T17:43:29.384Z" },
-    { url = "https://files.pythonhosted.org/packages/52/3d/86e8ad3542169e56cac3859a343afdb9df2ad54d35a59ce1e67baee83421/ruff-0.16.4-py3-none-manylinux_2_17_ppc64le.manylinux2014_ppc64le.whl", hash = "sha256:3817b87dbcabc92f13b05019257c5b89b5b4d51b5fb20f56fb5235ceb723cd07", size = 11333695, upload-time = "2026-08-20T17:43:31.872Z" },
-    { url = "https://files.pythonhosted.org/packages/d0/16/481c29b380c20a0054a8261066665e1b3488e23636c49d0a43e75975b9bb/ruff-0.16.4-py3-none-manylinux_2_17_s390x.manylinux2014_s390x.whl", hash = "sha256:e9fce1499134b2c8c68e5166f95705a5812062bb93aacc5f9873bb1a27084bc7", size = 10727741, upload-time = "2026-08-20T17:43:34.596Z" },
-    { url = "https://files.pythonhosted.org/packages/5e/b6/56bc0b8cf45b54b28b3a5e6381c8945d51b5b18adf659454c32295209a31/ruff-0.16.4-py3-none-manylinux_2_17_x86_64.manylinux2014_x86_64.whl", hash = "sha256:f2d812e482f5a7e02eee26cd73d2a37ebbdf47d795ea63ba1b89110ae93e9fb3", size = 10286522, upload-time = "2026-08-20T17:43:37.288Z" },
-    { url = "https://files.pythonhosted.org/packages/e8/8b/b345b4fb110f2fbe2bd31eabd271e5e8b3b7e4ee6c0e02f2dc6be78db000/ruff-0.16.4-py3-none-manylinux_2_31_riscv64.whl", hash = "sha256:6baaf984aa7976edf93d3b627fe2d1d22ee94bbca05fa6f90fc76d73924e3454", size = 10584182, upload-time = "2026-08-20T17:43:39.984Z" },
-    { url = "https://files.pythonhosted.org/packages/29/e5/827b34041c35f58774a9681a4213994c164fc987800f4dddabcf451da0bf/ruff-0.16.4-py3-none-musllinux_1_2_aarch64.whl", hash = "sha256:bdfcf0b28662eb890372d50f92c283bb94e67e7635ed93c7fd533970acff7b2b", size = 10134195, upload-time = "2026-08-20T17:43:42.351Z" },
-    { url = "https://files.pythonhosted.org/packages/0f/10/d0bffcdd6729b87afc82ba0ef377173356a7dc8e972f5179968cf2fdf98c/ruff-0.16.4-py3-none-musllinux_1_2_armv7l.whl", hash = "sha256:b66b02cb9b04f537643cadf5768e5f98dc461890d530cb67113d71c8c76e605d", size = 9825821, upload-time = "2026-08-20T17:4
```

---

### Incident Patch 6: `45e1dea9` (2026-10-02)
**Commit Message**: build(deps-dev): bump awscli from 1.46.0 to 1.46.1 in the deploy group (#8462)

* build(deps-dev): bump awscli from 1.46.0 to 1.46.1 in the deploy group

Bumps the deploy group with 1 update: [awscli](https://github.com/aws/aws-cli).


Updates `awscli` from 1.46.0 to 1.46.1
- [Release notes](https://github.com/aws/aws-cli/releases)
- [Commits](https://github.com/aws/aws-cli/compare/1.46.0...1.46.1)

---
updated-dependencies:
- dependency-name: awscli
  dependency-version: 1.46.1
  dependency-type: direct:development
  update-type: version-update:semver-patch
  dependency-group: deploy
...

Signed-off-by: dependabot[bot] <[REDACTED_EMAIL]>

* [autofix.ci] apply automated fixes

---------

Signed-off-by: dependabot[bot] <[REDACTED_EMAIL]>
Co-authored-by: dependabot[bot] <49699333+dependabot[bot]@users.noreply.github.com>
Co-authored-by: autofix-ci[bot] <114827586+autofix-ci[bot]@users.noreply.github.com>

**File**: `pyproject.toml` (modified, +1/-1)
```diff
@@ -88,7 +88,7 @@ ruff = [
     "ruff==0.16.4",
 ]
 deploy = [
-    "awscli==1.46.0",
+    "awscli==1.46.1",
     "twine==7.0.0",
 ]
 
```

**File**: `uv.lock` (modified, +4/-4)
```diff
@@ -101,7 +101,7 @@ wheels = [
 
 [[package]]
 name = "awscli"
-version = "1.46.0"
+version = "1.46.1"
 source = { registry = "https://pypi.org/simple" }
 dependencies = [
     { name = "colorama" },
@@ -112,9 +112,9 @@ dependencies = [
     { name = "rsa" },
     { name = "urllib3" },
 ]
-sdist = { url = "https://files.pythonhosted.org/packages/d9/d7/74b718d668537d85ecef9f908f951827a95f7b1eb32f254bf3b1813edf9e/awscli-1.46.0.tar.gz", hash = "sha256:5c1bd660bd3f967f5754a2267fb54e81edf379374faa27973671561888d39bf6", size = 16777783, upload-time = "2026-08-05T05:23:24.302Z" }
+sdist = { url = "https://files.pythonhosted.org/packages/b1/92/907a22013a0177919a98d7b57cf302e86ae162b0c05c0714f3b565cea814/awscli-1.46.1.tar.gz", hash = "sha256:9dab615cc46d16f1f9750e1c9bd37820a24d6964e9381f712b3a304c2b05d248", size = 16782333, upload-time = "2026-08-27T21:30:37.715Z" }
 wheels = [
-    { url = "https://files.pythonhosted.org/packages/e1/13/775b5b79cb686dc9f9133f1f73079102e312866500556c1b604f72e7b68b/awscli-1.46.0-py3-none-any.whl", hash = "sha256:0aa98754c23c7eff4c7d970cb619670dc9b0214ee451bb3fe88e74e4a9a03a90", size = 20231511, upload-time = "2026-08-05T05:23:20.803Z" },
+    { url = "https://files.pythonhosted.org/packages/86/9f/1b37f7e20a2ba4ca3dc99117d7d3ceaee7dfa1f09bc8aeb4eebe0a85bcbd/awscli-1.46.1-py3-none-any.whl", hash = "sha256:68701ad24347c63b5b145b7aa32391ce7e04f328057dd5aa0537a07c0d0b7cc3", size = 20232487, upload-time = "2026-08-27T21:30:32.54Z" },
 ]
 
 [[package]]
@@ -1101,7 +1101,7 @@ requires-dist = [
 
 [package.metadata.requires-dev]
 deploy = [
-    { name = "awscli", specifier = "==1.46.0" },
+    { name = "awscli", specifier = "==1.46.1" },
     { name = "twine", specifier = "==7.0.0" },
 ]
 dev = [
```

---

### Incident Patch 7: `30102775` (2026-10-02)
**Commit Message**: build(deps): update cryptography requirement from <=50.0.1,>=42.0 to >=42.0,<=50.0.2 in the openssl group (#8461)

* build(deps): update cryptography requirement

Updates the requirements on [cryptography](https://github.com/pyca/cryptography) to permit the latest version.

Updates `cryptography` to 50.0.2
- [Changelog](https://github.com/pyca/cryptography/blob/main/CHANGELOG.rst)
- [Commits](https://github.com/pyca/cryptography/compare/42.0.0...50.0.2)

---
updated-dependencies:
- dependency-name: cryptography
  dependency-version: 50.0.2
  dependency-type: direct:production
  dependency-group: openssl
...

Signed-off-by: dependabot[bot] <[REDACTED_EMAIL]>

* [autofix.ci] apply automated fixes

---------

Signed-off-by: dependabot[bot] <[REDACTED_EMAIL]>
Co-authored-by: dependabot[bot] <49699333+dependabot[bot]@users.noreply.github.com>
Co-authored-by: autofix-ci[bot] <114827586+autofix-ci[bot]@users.noreply.github.com>

**File**: `pyproject.toml` (modified, +1/-1)
```diff
@@ -38,7 +38,7 @@ dependencies = [
     "bcrypt>=5.0.0,<=5.0.0",
     "Brotli>=1.0,<=1.2.0",
     "certifi>=2019.9.11",  # no upper bound here to get latest CA bundle
-    "cryptography>=42.0,<=50.0.1",  # relaxed upper bound here to get security fixes
+    "cryptography>=42.0,<=50.0.2",  # relaxed upper bound here to get security fixes
     "flask>=3.0,<=3.1.3",
     "h11>=0.16.0,<=0.16.0",
     "h2>=4.3.0,<=4.4.1",
```

**File**: `uv.lock` (modified, +1/-1)
```diff
@@ -1078,7 +1078,7 @@ requires-dist = [
     { name = "bcrypt", specifier = "<=5.0.0,>=5.0.0" },
     { name = "brotli", specifier = ">=1.0,<=1.2.0" },
     { name = "certifi", specifier = ">=2019.9.11" },
-    { name = "cryptography", specifier = ">=42.0,<=50.0.1" },
+    { name = "cryptography", specifier = ">=42.0,<=50.0.2" },
     { name = "flask", specifier = ">=3.0,<=3.1.3" },
     { name = "h11", specifier = "<=0.16.0,>=0.16.0" },
     { name = "h2", specifier = ">=4.3.0,<=4.4.1" },
```

---

### Incident Patch 8: `36ba9218` (2026-10-02)
**Commit Message**: build(deps-dev): bump pyinstaller from 6.22.2 to 6.22.3 in the pyinstaller group (#8460)

* build(deps-dev): bump pyinstaller

Bumps the pyinstaller group with 1 update: [pyinstaller](https://github.com/pyinstaller/pyinstaller).


Updates `pyinstaller` from 6.22.2 to 6.22.3
- [Release notes](https://github.com/pyinstaller/pyinstaller/releases)
- [Changelog](https://github.com/pyinstaller/pyinstaller/blob/develop/doc/CHANGES.rst)
- [Commits](https://github.com/pyinstaller/pyinstaller/compare/v6.22.2...v6.22.3)

---
updated-dependencies:
- dependency-name: pyinstaller
  dependency-version: 6.22.3
  dependency-type: direct:development
  update-type: version-update:semver-patch
  dependency-group: pyinstaller
...

Signed-off-by: dependabot[bot] <[REDACTED_EMAIL]>

* [autofix.ci] apply automated fixes

---------

Signed-off-by: dependabot[bot] <[REDACTED_EMAIL]>
Co-authored-by: dependabot[bot] <49699333+dependabot[bot]@users.noreply.github.com>
Co-authored-by: autofix-ci[bot] <114827586+autofix-ci[bot]@users.noreply.github.com>

**File**: `pyproject.toml` (modified, +1/-1)
```diff
@@ -65,7 +65,7 @@ dev = [
     "hypothesis==6.130.6",
     "maturin==1.15.0",
     "pdoc==16.0.0",
-    "pyinstaller==6.22.2",
+    "pyinstaller==6.22.3",
     "pyinstaller-hooks-contrib==2026.7",
     "pytest-asyncio==1.2.0",
     "pytest-cov==7.0.0",
```

**File**: `uv.lock` (modified, +15/-15)
```diff
@@ -1111,7 +1111,7 @@ dev = [
     { name = "maturin", specifier = "==1.15.0" },
     { name = "mypy", specifier = "==1.20.2" },
     { name = "pdoc", specifier = "==16.0.0" },
-    { name = "pyinstaller", specifier = "==6.22.2" },
+    { name = "pyinstaller", specifier = "==6.22.3" },
     { name = "pyinstaller-hooks-contrib", specifier = "==2026.7" },
     { name = "pytest", specifier = "==8.4.2" },
     { name = "pytest-asyncio", specifier = "==1.2.0" },
@@ -1387,7 +1387,7 @@ wheels = [
 
 [[package]]
 name = "pyinstaller"
-version = "6.22.2"
+version = "6.22.3"
 source = { registry = "https://pypi.org/simple" }
 dependencies = [
     { name = "altgraph" },
@@ -1398,19 +1398,19 @@ dependencies = [
     { name = "pywin32-ctypes", marker = "sys_platform == 'win32'" },
     { name = "setuptools" },
 ]
-sdist = { url = "https://files.pythonhosted.org/packages/cc/2b/836d9def811c02522e0921d8b8cdf0c16b0545a216e97e71041758057859/pyinstaller-6.22.2.tar.gz", hash = "sha256:89b65a3ad07d9dd5832253e37bc45f31872d10d7f9d5c9fd0fdd6088a83829dd", size = 4092631, upload-time = "2026-08-17T20:53:22.231Z" }
-wheels = [
-    { url = "https://files.pythonhosted.org/packages/57/39/08cd53632276de70426e7c273820277a48253fee397b4048301ec03c3566/pyinstaller-6.22.2-py3-none-macosx_10_13_universal2.whl", hash = "sha256:ebd1b1ca932d7cf25d7366ce691aaf79a5ff9425811ed7328b5116e4471b6d6d", size = 1062734, upload-time = "2026-08-17T20:52:17.635Z" },
-    { url = "https://files.pythonhosted.org/packages/74/22/2d865896782cbb41e2388c7314207c17a98acdcc1b8e5eef668873505c9f/pyinstaller-6.22.2-py3-none-manylinux2014_aarch64.whl", hash = "sha256:f5ccb847451df4207bce18bf53a57b124c9bb4e7e4bad08c5ecc627bcf00b28c", size = 755697, upload-time = "2026-08-17T20:52:21.676Z" },
-    { url = "https://files.pythonhosted.org/packages/91/2b/6c11e4d5a76e716ea68da1946ab706a4bdf6d8e68b0e1dea314366d046a0/pyinstaller-6.22.2-py3-none-manylinux2014_i686.whl", hash = "sha256:becb47ad78272bede87acf2ed830d7545a8f65ab11d06a68fe2b99ba1afaac6d", size = 768870, upload-time = "2026-08-17T20:52:25.511Z" },
-    { url = "https://files.pythonhosted.org/packages/cf/e2/dbfea6a58b68acf644f7193b11d570476d6ffaed57381b6d1dd9e898a971/pyinstaller-6.22.2-py3-none-manylinux2014_ppc64le.whl", hash = "sha256:06d7b3827a8049db4a2d47e3ec4ae2f69a1041577d8833b8f169745cde573ab4", size = 767445, upload-time = "2026-08-17T20:52:29.629Z" },
-    { url = "https://files.pythonhosted.org/packages/5e/db/f24a21af2f87ce1df4e07fdad95eec65ef9f284267a7c1e5eeea40f49aa4/pyinstaller-6.22.2-py3-none-manylinux2014_s390x.whl", hash = "sha256:7bee432404eca5dc3ef37c36811c266561b03988f6d3e70ab0fa5352dd5de9e4", size = 762113, upload-time = "2026-08-17T20:52:34.025Z" },
-    { url = "https://files.pythonhosted.org/packages/2b/07/b304ff3f5f8333778065e3658b604b0e108cd934b920f3fbab825a0dd5b7/pyinstaller-6.22.2-py3-none-manylinux2014_x86_64.whl", hash = "sha256:9622686ecc5d5fa492fe6cde29d47df9dd41138cff8177be9f901ca3260f2096", size = 762173, upload-time = "2026-08-17T20:52:38.477Z" },
-    { url = "https://files.pythonhosted.org/packages/6c/9b/0af69d93dfad2e3d590a5de5828d5bcd903747c0224bd9560ab476904dfe/pyinstaller-6.22.2-py3-none-musllinux_1_1_aarch64.whl", hash = "sha256:0260eaad6be3f6fbc1affffe6dc7b8e5b636dbca51b463224daba971610b6fc1", size = 761674, upload-time = "2026-08-17T20:52:42.646Z" },
-    { url = "https://files.pythonhosted.org/packages/d3/4e/28b6094dcbd1e1bbb868daf4f8752999a20c1020ab64569232be42af2be8/pyinstaller-6.22.2-py3-none-musllinux_1_1_x86_64.whl", hash = "sha256:8c2c4b14caad38c1f3df8e9bf5276fc265e27fe8b4180cab4a37864288427bc0", size = 761053, upload-time = "2026-08-17T20:52:46.594Z" },
-    { url = "https://files.pythonhosted.org/packages/ba/2c/f91b63fd01422111ac04e3b9bf61c039da5a3292acb4fe5248905f0be688/pyinstaller-6.22.2-py3-none-win32.whl", hash = "sha256:9a078877caa3920558a3242d0a7019fe5b825cff4b65ed380c7d1e1bd200ddd9", size = 1344474, upload-time = "2026-08-17T20:52:53.108Z" },
-    { url = "https://files.pythonhosted.org/packages/3f/53/8ba1d0f6159b490f700eac6161a4be5f0d4672608a6dae9fd73679f183ee/pyinstaller-6.22.2-py3-none-win_amd64.whl", hash = "sha256:9b990fa6bbe143572f06644a984ad0d7aa2e2ccc6929d4916031343a5888e9a7", size = 1405725, upload-time = "2026-08-17T20:52:59.667Z" },
-    { url = "https://files.pythonhosted.org/packages/fb/1b/9a3062cc34c939f694d4262c4754681f6ffe853c21c124209ad2d08b8e84/pyinstaller-6.22.2-py3-none-win_arm64.whl", hash = "sha256:afb6f9a95d19b6dcd3a7decc40d9adb6ba9c4f8802ddd6c972dfb552953f384e", size = 1353806, upload-time = "2026-08-17T20:53:06.222Z" },
+sdist = { url = "https://files.pythonhosted.org/packages/63/41/f90302845945abd4ed647933ff5ee7c6ac93983187be67f897b6cb613331/pyinstaller-6.22.3.tar.gz", hash = "sha256:05eb2f5615503e72939a7224d68b4aff572c6b0438ee4a17d0a4b481f399362d", size = 4437180, upload-time = "2026-09-12T21:54:09.669Z" }
+wheels = [
+    { url = "https://files.pythonhosted.org/packages/ec/af/898f70947e27f8e65d55183c780e77112e023c0b4a6fba6255d4d563a2
```

---

### Incident Patch 9: `1ef9cec9` (2026-10-01)
**Commit Message**: docs: fix typos in API changelog and docstrings (#8444)

- 'inadvertedly' -> 'inadvertently' in docs/src/content/addons/api-changelog.md
- 'artifically' -> 'artificially' in mitmproxy/flow.py
- 'programatically' -> 'programmatically' in mitmproxy/addonmanager.py

Found via codespell scan of user-facing documentation and module
docstrings; no behavior changes.

Co-authored-by: haimingZZ <[REDACTED_EMAIL]>

**File**: `docs/src/content/addons/api-changelog.md` (modified, +1/-1)
```diff
@@ -72,7 +72,7 @@ As the passed objects are different now, we've also taken this opportunity to in
 #### Logging
 
 The `log` event has been renamed to `add_log`. This fixes a consistent source of errors where users imported 
-modules with the name "log", which were then inadvertedly picked up.
+modules with the name "log", which were then inadvertently picked up.
 
 #### Contentviews
 
```

**File**: `mitmproxy/addonmanager.py` (modified, +1/-1)
```diff
@@ -101,7 +101,7 @@ def add_option(
     def add_command(self, path: str, func: Callable) -> None:
         """Add a command to mitmproxy.
 
-        Unless you are generating commands programatically,
+        Unless you are generating commands programmatically,
         this API should be avoided. Decorate your function with `@mitmproxy.command.command` instead.
         """
         self.master.commands.add(path, func)
```

**File**: `mitmproxy/flow.py` (modified, +1/-1)
```diff
@@ -92,7 +92,7 @@ class Flow(serializable.Serializable):
     """
     This attribute indicates if this flow has been replayed in either direction.
 
-     - a value of `request` indicates that the request has been artifically replayed by mitmproxy to the server.
+     - a value of `request` indicates that the request has been artificially replayed by mitmproxy to the server.
      - a value of `response` indicates that the response to the client's request has been set by server replay.
     """
 
```

---

### Incident Patch 10: `6a209f74` (2026-09-30)
**Commit Message**: CI: Update build containers to Debian 12 (#8458)

**File**: `.github/workflows/main.yml` (modified, +2/-2)
```diff
@@ -76,10 +76,10 @@ jobs:
             platform: windows
           - image: ubuntu-latest
             platform: linux-x86_64
-            container: debian@sha256:aeec37aebc55ca5cc6fcfb8d5f6ae2fd43d5017ad849e6e2fdb5325d61e144db  # Old Debian 11 so we get oldest glibc possible.
+            container: debian@sha256:f37a335e82bca302e955fa39f9dfe28f1be618f016f8a2b56318e5a5111afc26  # Old Debian 12 so we get oldest glibc possible.
           - image: ubuntu-24.04-arm
             platform: linux-arm64
-            container: debian@sha256:aeec37aebc55ca5cc6fcfb8d5f6ae2fd43d5017ad849e6e2fdb5325d61e144db  # Old Debian 11 so we get oldest glibc possible.
+            container: debian@sha256:f37a335e82bca302e955fa39f9dfe28f1be618f016f8a2b56318e5a5111afc26  # Old Debian 12 so we get oldest glibc possible.
     runs-on: ${{ matrix.image }}
     container:
       image: ${{ matrix.container }}
```

**File**: `CHANGELOG.md` (modified, +2/-0)
```diff
@@ -25,6 +25,8 @@
 - Remove the unused `msgpack` dependency. The msgpack contentview is
   implemented in Rust and shipped with `mitmproxy_rs` since mitmproxy 12.
   ([#8319](https://github.com/mitmproxy/mitmproxy/pull/8319), @lukehsiao)
+- Update Linux binary builder to Debian 12, bumping the minimum glibc version to 2.36.
+  ([#8458](https://github.com/mitmproxy/mitmproxy/pull/8458), @mhils)
 - Fix a crash on OpenSSL builds that reject a TLS protocol version at
   context-setup time (e.g. SSLv3): `is_supported_version` now treats such a
   version as unsupported instead of raising an unhandled `SSL.Error`.
```

---

### Incident Patch 11: `d0d5a70b` (2026-09-27)
**Commit Message**: build(deps): bump docker/setup-buildx-action from 4.2.0 to 4.3.0 in the github-actions group (#8421)

build(deps): bump docker/setup-buildx-action in the github-actions group

Bumps the github-actions group with 1 update: [docker/setup-buildx-action](https://github.com/docker/setup-buildx-action).


Updates `docker/setup-buildx-action` from 4.2.0 to 4.3.0
- [Release notes](https://github.com/docker/setup-buildx-action/releases)
- [Commits](https://github.com/docker/setup-buildx-action/compare/bb05f3f5519dd87d3ba754cc423b652a5edd6d2c...37fe631027851001ddb9b187196cc803df7f5f0e)

---
updated-dependencies:
- dependency-name: docker/setup-buildx-action
  dependency-version: 4.3.0
  dependency-type: direct:production
  update-type: version-update:semver-minor
  dependency-group: github-actions
...

Signed-off-by: dependabot[bot] <[REDACTED_EMAIL]>
Co-authored-by: dependabot[bot] <49699333+dependabot[bot]@users.noreply.github.com>

**File**: `.github/workflows/main.yml` (modified, +1/-1)
```diff
@@ -252,7 +252,7 @@ jobs:
           name: binaries.wheel
           path: release/docker
       - uses: docker/setup-qemu-action@96fe6ef7f33517b61c61be40b68a1882f3264fb8 # v4.2.0
-      - uses: docker/setup-buildx-action@bb05f3f5519dd87d3ba754cc423b652a5edd6d2c # v1.6.0
+      - uses: docker/setup-buildx-action@37fe631027851001ddb9b187196cc803df7f5f0e # v1.6.0
         with:
           cache-binary: false
 
```

---

### Incident Patch 12: `6c0d0c65` (2026-09-27)
**Commit Message**: build(deps-dev): bump maturin from 1.14.1 to 1.15.0 (#8420)

* build(deps-dev): bump maturin from 1.14.1 to 1.15.0

Bumps [maturin](https://github.com/pyo3/maturin) from 1.14.1 to 1.15.0.
- [Release notes](https://github.com/pyo3/maturin/releases)
- [Changelog](https://github.com/PyO3/maturin/blob/main/Changelog.md)
- [Commits](https://github.com/pyo3/maturin/compare/v1.14.1...v1.15.0)

---
updated-dependencies:
- dependency-name: maturin
  dependency-version: 1.15.0
  dependency-type: direct:development
  update-type: version-update:semver-minor
...

Signed-off-by: dependabot[bot] <[REDACTED_EMAIL]>

* [autofix.ci] apply automated fixes

---------

Signed-off-by: dependabot[bot] <[REDACTED_EMAIL]>
Co-authored-by: dependabot[bot] <49699333+dependabot[bot]@users.noreply.github.com>
Co-authored-by: autofix-ci[bot] <114827586+autofix-ci[bot]@users.noreply.github.com>

**File**: `pyproject.toml` (modified, +1/-1)
```diff
@@ -63,7 +63,7 @@ dependencies = [
 dev = [
     "click==8.4.2",
     "hypothesis==6.130.6",
-    "maturin==1.14.1",
+    "maturin==1.15.0",
     "pdoc==16.0.0",
     "pyinstaller==6.22.2",
     "pyinstaller-hooks-contrib==2026.7",
```

**File**: `uv.lock` (modified, +16/-16)
```diff
@@ -975,23 +975,23 @@ wheels = [
 
 [[package]]
 name = "maturin"
-version = "1.14.1"
+version = "1.15.0"
 source = { registry = "https://pypi.org/simple" }
-sdist = { url = "https://files.pythonhosted.org/packages/e7/b3/addd877f871fb1860d46d3a4f206ecb10b946c85846805e6367631926fd3/maturin-1.14.1.tar.gz", hash = "sha256:9d6577a62cd08e0ceba7a0db06fb098e0c9b1b3429bad747a4f3a18215a1b3df", size = 369637, upload-time = "2026-06-19T05:19:49.774Z" }
+sdist = { url = "https://files.pythonhosted.org/packages/b9/c8/22e5e21b2679c9bce6415ca578034ca2cc9316be0642ae21e051a2d5198c/maturin-1.15.0.tar.gz", hash = "sha256:94b26cc8e8aba61a5f2099715fe640e18c5f678e9a500408b38761263954228a", size = 385504, upload-time = "2026-08-24T12:11:22.665Z" }
 wheels = [
-    { url = "https://files.pythonhosted.org/packages/f4/f0/97c5a5bd9c71653a066c0976a484eaaae50b9369557838a4176b7b0bdaa5/maturin-1.14.1-py3-none-linux_armv6l.whl", hash = "sha256:522292398945442cdafa9daeb2271b2340fbde57027b818f923f88eab04174f8", size = 10207496, upload-time = "2026-06-19T05:19:09.321Z" },
-    { url = "https://files.pythonhosted.org/packages/fe/83/294bca639b0e052f1e2f65199b3db258780c7d4e31408b934c9c974a1379/maturin-1.14.1-py3-none-macosx_10_12_x86_64.macosx_11_0_arm64.macosx_10_12_universal2.whl", hash = "sha256:ffe5ad71f21d1e6603c4dd75f7fee34adf5ed5ebcebb692886549888ebb329ed", size = 19680113, upload-time = "2026-06-19T05:19:13.43Z" },
-    { url = "https://files.pythonhosted.org/packages/43/b6/79c881410a3b1c187f7eb3d407aecae646c6a4433d630d72200359015e83/maturin-1.14.1-py3-none-macosx_10_12_x86_64.whl", hash = "sha256:f3306078070c1508fd715b9116070cbcaff5959024272a9f1e6f5cb29768b86c", size = 10169205, upload-time = "2026-06-19T05:19:16.615Z" },
-    { url = "https://files.pythonhosted.org/packages/93/9d/44b6f26dcb7f7a04c5501ac2dbb6ca1490150682baa525ca5860504f9eab/maturin-1.14.1-py3-none-manylinux_2_12_i686.manylinux2010_i686.musllinux_1_1_i686.whl", hash = "sha256:cd457cd88961156e26379e1155bd287cc0ec1c8b2f1582b0660fb31b87c8842d", size = 10188098, upload-time = "2026-06-19T05:19:19.736Z" },
-    { url = "https://files.pythonhosted.org/packages/1a/bd/9c0d5d6983905ce2c9edaa073a7e89355a9cf7f396988e05d32f1c37785d/maturin-1.14.1-py3-none-manylinux_2_12_x86_64.manylinux2010_x86_64.musllinux_1_1_x86_64.whl", hash = "sha256:dfc54ae32e6fcb18302193ab9a30b0b25eefffba994ae13238974805533ef75e", size = 10627576, upload-time = "2026-06-19T05:19:22.713Z" },
-    { url = "https://files.pythonhosted.org/packages/e5/33/b096412bd6a7cb399652b260666f901adf88a687181a6dbd6a3f89f0a94e/maturin-1.14.1-py3-none-manylinux_2_17_aarch64.manylinux2014_aarch64.musllinux_1_1_aarch64.whl", hash = "sha256:a131d912b5267e640bc96d70f4914e10590aed64082ec9abacba7cea52004224", size = 10085181, upload-time = "2026-06-19T05:19:25.69Z" },
-    { url = "https://files.pythonhosted.org/packages/56/8d/08c3bf469c38a23c9e6c877e338193001eb604d010fedc08341974e38528/maturin-1.14.1-py3-none-manylinux_2_17_armv7l.manylinux2014_armv7l.musllinux_1_1_armv7l.whl", hash = "sha256:be18fc568fb76884c0205456336892a75105ec398e6b667cd777c6268bd06d69", size = 10026363, upload-time = "2026-06-19T05:19:28.904Z" },
-    { url = "https://files.pythonhosted.org/packages/3a/a4/c4d1a92839f8745ab4aab988a7db884a79d6d710bd3b286fcf9316dece1a/maturin-1.14.1-py3-none-manylinux_2_17_ppc64le.manylinux2014_ppc64le.musllinux_1_1_ppc64le.whl", hash = "sha256:994a0c8ba3ad8a92b3a9ee1b02645d200d610216b15cff5102b0fe65e8e08666", size = 13321347, upload-time = "2026-06-19T05:19:32.411Z" },
-    { url = "https://files.pythonhosted.org/packages/b3/fa/170f04624d03fd07d2a8b1b67de83a127af93aef9eaa425839553347297b/maturin-1.14.1-py3-none-manylinux_2_17_s390x.manylinux2014_s390x.whl", hash = "sha256:be80866363e605d137991b491a741a84cde9ae350183c4c85f49690ca9aaaa65", size = 10877609, upload-time = "2026-06-19T05:19:35.448Z" },
-    { url = "https://files.pythonhosted.org/packages/61/ad/1ae2e1d0ded282bf2c55ac13f0811d87deb425e200ae64a15785675dede9/maturin-1.14.1-py3-none-manylinux_2_31_riscv64.musllinux_1_1_riscv64.whl", hash = "sha256:5282dffd4b539d2be245f4e5b1a5ab6bc1033b58f4a4872f5833f9d43c954aa4", size = 10417316, upload-time = "2026-06-19T05:19:38.28Z" },
-    { url = "https://files.pythonhosted.org/packages/fb/27/bf677183920718da49cd7982d6a3ffc440aad8919329f571d189f81b7bdf/maturin-1.14.1-py3-none-win32.whl", hash = "sha256:1a04de0a20188f95c721b5702eed18140bdcccb28c386797093eca3f62f4d4e0", size = 8931293, upload-time = "2026-06-19T05:19:41.183Z" },
-    { url = "https://files.pythonhosted.org/packages/63/4b/585adeb9167b08d3cdff0032a938b0e72655c92003df4f52c3f696a1bcc2/maturin-1.14.1-py3-none-win_amd64.whl", hash = "sha256:3c9f94640ecc4895e94abaf834a0684430032c865b2748a36c12461fd9252fdd", size = 10314067, upload-time = "2026-06-19T05:19:44.389Z" },
-    { url = "https://files.pythonhosted.org/packages/51/d4/dac8c0720ae246be1700afb6fbdbbea20fe35b13f6570b2f70faa005df77/maturin-1.14.1-py3-none-win_arm64.whl", hash = "sha256:15cea8fcb3ba47dd636f50092bb34baea8b0
```

---

### Incident Patch 13: `d2605651` (2026-09-27)
**Commit Message**: build(deps): update urwid requirement from <=4.0.9,>=2.6.14 to >=2.6.14,<=4.0.13 (#8419)

* build(deps): update urwid requirement

Updates the requirements on [urwid](https://github.com/urwid/urwid) to permit the latest version.
- [Release notes](https://github.com/urwid/urwid/releases)
- [Changelog](https://github.com/urwid/urwid/blob/master/docs/changelog.rst)
- [Commits](https://github.com/urwid/urwid/compare/2.6.14...4.0.13)

---
updated-dependencies:
- dependency-name: urwid
  dependency-version: 4.0.13
  dependency-type: direct:production
...

Signed-off-by: dependabot[bot] <[REDACTED_EMAIL]>

* [autofix.ci] apply automated fixes

---------

Signed-off-by: dependabot[bot] <[REDACTED_EMAIL]>
Co-authored-by: dependabot[bot] <49699333+dependabot[bot]@users.noreply.github.com>
Co-authored-by: autofix-ci[bot] <114827586+autofix-ci[bot]@users.noreply.github.com>

**File**: `pyproject.toml` (modified, +1/-1)
```diff
@@ -54,7 +54,7 @@ dependencies = [
     "sortedcontainers>=2.3,<=2.4.0",
     "tornado>=6.5.0,<=6.5.8",
     "typing-extensions>=4.13.2,<=4.14; python_version < '3.13'",
-    "urwid>=2.6.14,<=4.0.9",
+    "urwid>=2.6.14,<=4.0.13",
     "wsproto>=1.0,<=1.3.2",
     "publicsuffix2>=2.20190812,<=2.20191221",
 ]
```

**File**: `uv.lock` (modified, +1/-1)
```diff
@@ -1095,7 +1095,7 @@ requires-dist = [
     { name = "sortedcontainers", specifier = ">=2.3,<=2.4.0" },
     { name = "tornado", specifier = ">=6.5.0,<=6.5.8" },
     { name = "typing-extensions", marker = "python_full_version < '3.13'", specifier = ">=4.13.2,<=4.14" },
-    { name = "urwid", specifier = ">=2.6.14,<=4.0.9" },
+    { name = "urwid", specifier = ">=2.6.14,<=4.0.13" },
     { name = "wsproto", specifier = ">=1.0,<=1.3.2" },
 ]
 
```

---

### Incident Patch 14: `e0c2afa9` (2026-09-27)
**Commit Message**: build(deps-dev): bump ruff from 0.16.3 to 0.16.4 (#8418)

* build(deps-dev): bump ruff from 0.16.3 to 0.16.4

Bumps [ruff](https://github.com/astral-sh/ruff) from 0.16.3 to 0.16.4.
- [Release notes](https://github.com/astral-sh/ruff/releases)
- [Changelog](https://github.com/astral-sh/ruff/blob/main/CHANGELOG.md)
- [Commits](https://github.com/astral-sh/ruff/compare/0.16.3...0.16.4)

---
updated-dependencies:
- dependency-name: ruff
  dependency-version: 0.16.4
  dependency-type: direct:development
  update-type: version-update:semver-patch
...

Signed-off-by: dependabot[bot] <[REDACTED_EMAIL]>

* [autofix.ci] apply automated fixes

---------

Signed-off-by: dependabot[bot] <[REDACTED_EMAIL]>
Co-authored-by: dependabot[bot] <49699333+dependabot[bot]@users.noreply.github.com>
Co-authored-by: autofix-ci[bot] <114827586+autofix-ci[bot]@users.noreply.github.com>

**File**: `pyproject.toml` (modified, +1/-1)
```diff
@@ -85,7 +85,7 @@ tox = [
     "tox-uv==1.35.2",
 ]
 ruff = [
-    "ruff==0.16.3",
+    "ruff==0.16.4",
 ]
 deploy = [
     "awscli==1.46.0",
```

**File**: `uv.lock` (modified, +23/-23)
```diff
@@ -1119,13 +1119,13 @@ dev = [
     { name = "pytest-timeout", specifier = "==2.4.0" },
     { name = "pytest-xdist", specifier = "==3.8.0" },
     { name = "requests", specifier = "==2.34.2" },
-    { name = "ruff", specifier = "==0.16.3" },
+    { name = "ruff", specifier = "==0.16.4" },
     { name = "tox", specifier = "==4.55.1" },
     { name = "tox-uv", specifier = "==1.35.2" },
     { name = "types-requests", specifier = "==2.33.0.20260408" },
     { name = "wheel", specifier = "==0.48.0" },
 ]
-ruff = [{ name = "ruff", specifier = "==0.16.3" }]
+ruff = [{ name = "ruff", specifier = "==0.16.4" }]
 tox = [
     { name = "tox", specifier = "==4.55.1" },
     { name = "tox-uv", specifier = "==1.35.2" },
@@ -1730,27 +1730,27 @@ wheels = [
 
 [[package]]
 name = "ruff"
-version = "0.16.3"
-source = { registry = "https://pypi.org/simple" }
-sdist = { url = "https://files.pythonhosted.org/packages/61/b3/3213589383f8f1b3938781bd1278713f6d18621a14992b3e81fefb8a5ef9/ruff-0.16.3.tar.gz", hash = "sha256:e76d33a347661a84b5be6d043d0347fdc745dfdcf825a8f4fed64b5e26eebdf2", size = 4891904, upload-time = "2026-08-13T15:17:13.381Z" }
-wheels = [
-    { url = "https://files.pythonhosted.org/packages/bf/96/493770daebd68c0a67f1549fdf519f53be51fc435186c0585bcc272fd76c/ruff-0.16.3-py3-none-linux_armv6l.whl", hash = "sha256:0c5710e247a58a4521e66e124ba9a74655b414f61ba3a2e9e3811e11098f48f7", size = 10902799, upload-time = "2026-08-13T15:16:27.382Z" },
-    { url = "https://files.pythonhosted.org/packages/5e/e6/2becf3942fddc29a29b8df47691d456fb1085391a694f74d84513251418c/ruff-0.16.3-py3-none-macosx_10_12_x86_64.whl", hash = "sha256:fe155130631a2471fd2e14a7a664a4dfbd7194b8229c3d7b2a40b21178639081", size = 11135539, upload-time = "2026-08-13T15:16:30.87Z" },
-    { url = "https://files.pythonhosted.org/packages/3e/1e/4b8b72f0d006dbf19326aa99f9ca0ee2ff374187c4d301cf529a51aa06fe/ruff-0.16.3-py3-none-macosx_11_0_arm64.whl", hash = "sha256:e2ed719e14aa64d895c2ee922594a90a43c861a93f0575a95ff8c47cdbd13eb9", size = 10475095, upload-time = "2026-08-13T15:16:33.259Z" },
-    { url = "https://files.pythonhosted.org/packages/92/32/2201fa49ba1f6c101ee321e83f051ac7a4b8d07b0ef6b4d3f2772b302275/ruff-0.16.3-py3-none-manylinux_2_17_aarch64.manylinux2014_aarch64.whl", hash = "sha256:9e0b1da805eb043654645d74d5de1e5ce2edc686e40790d2b86f56d71cc06a84", size = 10668771, upload-time = "2026-08-13T15:16:35.65Z" },
-    { url = "https://files.pythonhosted.org/packages/c3/66/4afc5c8363bd04d45effce1b7c8713ca037d7a6740b7451a2403a6e3a972/ruff-0.16.3-py3-none-manylinux_2_17_armv7l.manylinux2014_armv7l.whl", hash = "sha256:a37bdea0bbe21780f590bf437d6412c8c4e1b6cd010f91a65c2c40c5e5f5f870", size = 10699568, upload-time = "2026-08-13T15:16:38.195Z" },
-    { url = "https://files.pythonhosted.org/packages/53/fd/c67d246bf36bf1698551c56de39e95cd07f70e64433e0098e6267d77061b/ruff-0.16.3-py3-none-manylinux_2_17_i686.manylinux2014_i686.whl", hash = "sha256:09571e6d1288ed9be475207a3ac04ada404f1cd898104be0f6ab8d7df438575b", size = 11499365, upload-time = "2026-08-13T15:16:40.623Z" },
-    { url = "https://files.pythonhosted.org/packages/67/0b/00ecbceb99a263af7b12f6f05ac3c92bc47b905e91adc3f207a836e3bc01/ruff-0.16.3-py3-none-manylinux_2_17_ppc64le.manylinux2014_ppc64le.whl", hash = "sha256:2c18c5a101eb540010638cc1ff3c84944d3adb3df62b8d98ca8f22ba484d3413", size = 12311728, upload-time = "2026-08-13T15:16:43.564Z" },
-    { url = "https://files.pythonhosted.org/packages/54/b2/b7b3bb54f4d3f7db504e476ad4ab8de530dceebe2c061384b2757ee419e8/ruff-0.16.3-py3-none-manylinux_2_17_s390x.manylinux2014_s390x.whl", hash = "sha256:8457c44f15033c85ddbb77b15d451df9e24e4bd03b628396dd3610cedc3b8f82", size = 11699896, upload-time = "2026-08-13T15:16:46.209Z" },
-    { url = "https://files.pythonhosted.org/packages/c7/30/4c468429ac195addc5ee1b717b6ab1b66632786737ca3b2ed3443fb0c26a/ruff-0.16.3-py3-none-manylinux_2_17_x86_64.manylinux2014_x86_64.whl", hash = "sha256:294b95c4ae0cda9388525c2047778aa758d6b8d4bb876fd4e9eaa3ebc92343eb", size = 11058736, upload-time = "2026-08-13T15:16:48.823Z" },
-    { url = "https://files.pythonhosted.org/packages/43/67/7a113cdaddf24b64d7f75b1242a99d04c82fcef4f6921fdbb832beaffb5f/ruff-0.16.3-py3-none-manylinux_2_31_riscv64.whl", hash = "sha256:3d0c7c40c87c2a820509c31ba007968da6e1306468c067b2d82fbfdbcd0e8474", size = 11586911, upload-time = "2026-08-13T15:16:51.913Z" },
-    { url = "https://files.pythonhosted.org/packages/f1/c1/2e66f24c0f3ead25a5e660111778685e505e5da353c82802bf49f0cbe7b9/ruff-0.16.3-py3-none-musllinux_1_2_aarch64.whl", hash = "sha256:9f738c0fdfa8eed0b2ce7fb27ee7258208a92a68d7949e62aa15164bc7b389da", size = 10954265, upload-time = "2026-08-13T15:16:54.763Z" },
-    { url = "https://files.pythonhosted.org/packages/c2/ba/4cee23bf52cba9a058d3726de623624daf50ef9638868edd86f4126157f6/ruff-0.16.3-py3-none-musllinux_1_2_armv7l.whl", hash = "sha256:fb785f0be25abe69d320415cd4f833b59e17ba7613d9ba6a958023b6bceb0a50", size = 10709886, upload-time = "2026-08-13T15
```

---

### Incident Patch 15: `7a68774a` (2026-09-27)
**Commit Message**: build(deps): update cryptography requirement from <=50.0.0,>=42.0 to >=42.0,<=50.0.1 in the openssl group (#8417)

* build(deps): update cryptography requirement in the openssl group

Updates the requirements on [cryptography](https://github.com/pyca/cryptography) to permit the latest version.

Updates `cryptography` to 50.0.1
- [Changelog](https://github.com/pyca/cryptography/blob/main/CHANGELOG.rst)
- [Commits](https://github.com/pyca/cryptography/compare/42.0.0...50.0.1)

---
updated-dependencies:
- dependency-name: cryptography
  dependency-version: 50.0.1
  dependency-type: direct:production
  dependency-group: openssl
...

Signed-off-by: dependabot[bot] <[REDACTED_EMAIL]>

* [autofix.ci] apply automated fixes

---------

Signed-off-by: dependabot[bot] <[REDACTED_EMAIL]>
Co-authored-by: dependabot[bot] <49699333+dependabot[bot]@users.noreply.github.com>
Co-authored-by: autofix-ci[bot] <114827586+autofix-ci[bot]@users.noreply.github.com>

**File**: `pyproject.toml` (modified, +1/-1)
```diff
@@ -38,7 +38,7 @@ dependencies = [
     "bcrypt>=5.0.0,<=5.0.0",
     "Brotli>=1.0,<=1.2.0",
     "certifi>=2019.9.11",  # no upper bound here to get latest CA bundle
-    "cryptography>=42.0,<=50.0.0",  # relaxed upper bound here to get security fixes
+    "cryptography>=42.0,<=50.0.1",  # relaxed upper bound here to get security fixes
     "flask>=3.0,<=3.1.3",
     "h11>=0.16.0,<=0.16.0",
     "h2>=4.3.0,<=4.4.1",
```

**File**: `uv.lock` (modified, +1/-1)
```diff
@@ -1078,7 +1078,7 @@ requires-dist = [
     { name = "bcrypt", specifier = "<=5.0.0,>=5.0.0" },
     { name = "brotli", specifier = ">=1.0,<=1.2.0" },
     { name = "certifi", specifier = ">=2019.9.11" },
-    { name = "cryptography", specifier = ">=42.0,<=50.0.0" },
+    { name = "cryptography", specifier = ">=42.0,<=50.0.1" },
     { name = "flask", specifier = ">=3.0,<=3.1.3" },
     { name = "h11", specifier = "<=0.16.0,>=0.16.0" },
     { name = "h2", specifier = ">=4.3.0,<=4.4.1" },
```

#### Recent Merged Pull Requests:
- **PR #8473** (2026-10-05): Do not add empty SAN extensions (@mhils)
- **PR #8472** (2026-10-05): Allow typing-extensions up to 4.16.0 (@jpcaruana)
- **PR #8471** (2026-10-05): Don't apply global listen_port to modes without a port (@WarpFoxHub)
- **PR #8470** (2026-10-03): Clarify inbound header validation scope (@gigioneggiando)
- **PR #8469** (2026-10-03): Fix Basic auth passwords containing colons (@gigioneggiando)
- **PR #8467** (closed): Fix curl/httpie body export fidelity with ANSI-C quoting (@masterwusama)
- **PR #8466** (2026-10-02): build(deps): bump the github-actions group with 4 updates (@dependabot[bot])
- **PR #8465** (2026-10-02): build(deps): update tornado requirement from <=6.5.8,>=6.5.0 to >=6.5.0,<=6.5.10 (@dependabot[bot])

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
