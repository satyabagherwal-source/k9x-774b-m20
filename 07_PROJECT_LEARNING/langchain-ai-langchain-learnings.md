# Forensic Learning Record (Deep Inspection): langchain-ai/langchain

> **Canonical Artifact**: `07_PROJECT_LEARNING/langchain-ai-langchain-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/langchain-ai/langchain](https://github.com/langchain-ai/langchain))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-05T18:18:26.141Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `langchain-ai/langchain`
- **Description**: The agent engineering platform.
- **Primary Language / Ecosystem**: Python
- **Discovered Manifests / Configurations**: README.md
- **Stars / Engagement**: 147473 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `libs/core/langchain_core/__init__.py`
```
"""`langchain-core` defines the base abstractions for the LangChain ecosystem.

The interfaces for core components like chat models, LLMs, vector stores, retrievers,
and more are defined here. The universal invocation protocol (Runnables) along with
a syntax for combining components are also defined here.

**No third-party integrations are defined here.** The dependencies are kept purposefully
very lightweight.
"""

from langchain_core._api import (
    surface_langchain_beta_warnings,
    surface_langchain_deprecation_warnings,
)
from langchain_core.version import VERSION

__version__ = VERSION

surface_langchain_deprecation_warnings()
surface_langchain_beta_warnings()

```

### Core Architecture Module: `libs/core/langchain_core/_api/__init__.py`
```
"""Helper functions for managing the LangChain API.

This module is only relevant for LangChain developers, not for users.

!!! warning

    This module and its submodules are for internal use only. Do not use them in your
    own code. We may change the API at any time with no warning.
"""

from typing import TYPE_CHECKING

from langchain_core._import_utils import import_attr

if TYPE_CHECKING:
    from langchain_core._api.beta_decorator import (
        LangChainBetaWarning,
        beta,
        suppress_langchain_beta_warning,
        surface_langchain_beta_warnings,
    )
    from langchain_core._api.deprecation import (
        LangChainDeprecationWarning,
        deprecated,
        suppress_langchain_deprecation_warning,
        surface_langchain_deprecation_warnings,
        warn_deprecated,
    )
    from langchain_core._api.path import as_import_path, get_relative_path

__all__ = (
    "LangChainBetaWarning",
    "LangChainDeprecationWarning",
    "as_import_path",
    "beta",
    "deprecated",
    "get_relative_path",
    "suppress_langchain_beta_warning",
    "suppress_langchain_deprecation_warning",
    "surface_langchain_beta_warnings",
    "surface_langchain_deprecation_warnings",
    "warn_deprecated",
)

_dynamic_imports = {
    "LangChainBetaWarning": "beta_decorator",
    "beta": "beta_decorator",
    "suppress_langchain_beta_warning": "beta_decorator",
    "surface_langchain_beta_warnings": "beta_decorator",
    "as_import_path": "path",
    "get_relative_path": "path",
    "LangChainDeprecationWarning": "deprecation",
    "deprecated": "deprecation",
    "surface_langchain_deprecation_warnings": "deprecation",
    "suppress_langchain_deprecation_warning": "deprecation",
    "warn_deprecated": "deprecation",
}


def __getattr__(attr_name: str) -> object:
    """Dynamically import and return an attribute from a submodule.

    This function enables lazy loading of API functions from submodules, reducing
    initial import time and circular dependency issues.

    Args:
        attr_name: Name of the attribute to import.

    Returns:
        The imported attribute object.

    Raises:
        AttributeError: If the attribute is not a valid dynamic import.
    """
    module_name = _dynamic_imports.get(attr_name)
    result = import_attr(attr_name, module_name, __spec__.parent)
    globals()[attr_name] = result
    return result


def __dir__() -> list[str]:
    """Return a list of available attributes for this module.

    Returns:
        List of attribute names that can be imported from this module.
    """
    return list(__all__)

```

### Core Architecture Module: `libs/core/langchain_core/_api/beta_decorator.py`
```
"""Helper functions for marking parts of the LangChain API as beta.

This module was loosely adapted from matplotlib's [`_api/deprecation.py`](https://github.com/matplotlib/matplotlib/blob/main/lib/matplotlib/_api/deprecation.py)
module.

!!! warning

    This module is for internal use only. Do not use it in your own code. We may change
    the API at any time with no warning.
"""

import contextlib
import functools
import inspect
import warnings
from collections.abc import Callable, Generator
from typing import Any, TypeVar, cast

from langchain_core._api.internal import is_caller_internal


class LangChainBetaWarning(DeprecationWarning):
    """A class for issuing beta warnings for LangChain users."""


# PUBLIC API


T = TypeVar("T", bound=Callable[..., Any] | type | property)


def beta(
    *,
    message: str = "",
    name: str = "",
    obj_type: str = "",
    addendum: str = "",
) -> Callable[[T], T]:
    """Decorator to mark a function, a class, or a property as beta.

    When marking a classmethod, a staticmethod, or a property, the `@beta` decorator
    should go *under* `@classmethod` and `@staticmethod` (i.e., `beta` should directly
    decorate the underlying callable), but *over* `@property`.

    When marking a class `C` intended to be used as a base class in a multiple
    inheritance hierarchy, `C` *must* define an `__init__` method (if `C` instead
    inherited its `__init__` from its own base class, then `@beta` would mess up
    `__init__` inheritance when installing its own (annotation-emitting) `C.__init__`).

    Args:
        message: Override the default beta message.

            The %(since)s, %(name)s, %(alternative)s, %(obj_type)s, %(addendum)s, and
            %(removal)s format specifiers will be replaced by the values of the
            respective arguments passed to this function.
        name: The name of the beta object.
        obj_type: The object type being beta.
        addendum: Additional text appended directly to the final message.

    Returns:
        A decorator which can be used to mark functions or classes as beta.

    Example:
        ```python
        @beta
        def the_function_to_annotate():
            pass
        ```
    """

    def beta(
        obj: T,
        *,
        _obj_type: str = obj_type,
        _name: str = name,
        _message: str = message,
        _addendum: str = addendum,
    ) -> T:
        """Implementation of the decorator returned by `beta`."""

        def emit_warning() -> None:
            """Emit the warning."""
            warn_beta(
                message=_message,
                name=_name,
                obj_type=_obj_type,
                addendum=_addendum,
            )

        warned = False

        def warning_emitting_wrapper(*args: Any, **kwargs: Any) -> Any:
            """Wrapper for the original wrapped callable that emits a warning.

            Args:
                *args: The positional arguments to the function.
                **kwargs: The keyword arguments to the function.

            Returns:
                The return value of the function being wrapped.
            """
            nonlocal warned
            if not warned and not is_caller_internal():
                warned = True
                emit_warning()
            return wrapped(*args, **kwargs)

        async def awarning_emitting_wrapper(*args: Any, **kwargs: Any) -> Any:
            """Same as warning_emitting_wrapper, but for async functions."""
            nonlocal warned
            if not warned and not is_caller_internal():
                warned = True
                emit_warning()
            return await wrapped(*args, **kwargs)

        if isinstance(obj, type):
            if not _obj_type:
                _obj_type = "class"
            wrapped = obj.__init__  # type: ignore[misc]
            _name = _name or obj.__qualname__
            old_doc = obj.__doc__

            def finalize(_: Callable[..., Any], new_doc: str, /) -> T:
                """Finalize the annotation of a class."""
                # Can't set new_doc on some extension objects.
                with contextlib.suppress(AttributeError):
                    obj.__doc__ = new_doc

                def warn_if_direct_instance(
                    self: Any, *args: Any, **kwargs: Any
                ) -> Any:
                    """Warn that the class is in beta."""
                    nonlocal warned
                    if not warned and type(self) is obj and not is_caller_internal():
                        warned = True
                        emit_warning()
                    return wrapped(self, *args, **kwargs)

                obj.__init__ = functools.wraps(obj.__init__)(  # type: ignore[misc]
                    warn_if_direct_instance
                )
                return obj

        elif isinstance(obj, property):
            if not _obj_type:
                _obj_type = "attribute"
            wrapped = None
            _name = _name or (obj.fget and obj.fget.__qualname__) or "<property>"
            old_doc = obj.__doc__

            # `obj.fget`/`fset`/`fdel` are typed `Callable | None`, so the `and`
            # short-circuits guard the calls for the type checker. Each wrapper is
            # only installed when its accessor is truthy (see `finalize` below), so
            # the guards never short-circuit at runtime — do not "simplify" them
            # away or mypy's `warn_unreachable` will flag the accessor as `None`.
            def _fget(instance: Any) -> Any:
                if instance is not None:
                    emit_warning()
                return obj.fget and obj.fget(instance)

            def _fset(instance: Any, value: Any) -> None:
                if instance is not None:
                    emit_warning()
                obj.fset and obj.fset(instance, value)

            def _fdel(instance: Any) -> None:
                if instance is not None:
                    emit_warning()
                obj.fdel and obj.fdel(instance)

            def finalize(_: Callable[..., Any], new_doc: str, /) -> T:
                """Finalize the property."""
                return cast(
                    "T",
                    property(
                        fget=_fget if obj.fget else None,
                        fset=_fset if obj.fset else None,
                        fdel=_fdel if obj.fdel else None,
                        doc=new_doc,
                    ),
                )

        else:
            _name = _name or obj.__qualname__
            if not _obj_type:
                # edge case: when a function is within another function
                # within a test, this will call it a "method" not a "function"
                _obj_type = "function" if "." not in _name else "method"
            wrapped = obj
            old_doc = wrapped.__doc__

            def finalize(wrapper: Callable[..., Any], new_doc: str, /) -> T:
                """Wrap the wrapped function using the wrapper and update the docstring.

                Args:
                    wrapper: The wrapper function.
                    new_doc: The new docstring.

                Returns:
                    The wrapped function.
                """
                wrapper = functools.wraps(wrapped)(wrapper)
                wrapper.__doc__ = new_doc
                return cast("T", wrapper)

        old_doc = inspect.cleandoc(old_doc or "").strip("\n") or ""
        components = [message, addendum]
        details = " ".join([component.strip() for component in components if component])
        new_doc = f".. beta::\n   {details}\n\n{old_doc}\n"

        if inspect.iscoroutinefunction(obj):
            return finalize(awarning_emitting_wrapper, new_doc)
        return finalize(warning_emitting_wrapper, new_doc)

    return beta


@contextlib.contextmanager
def suppress_langchain_beta_warning() -> Generator[None, None, None]:
    """Context manager to suppress `LangChainDeprecationWarning`."""
    with warnings.catch_warnings():
        warnings.simplefilter("ignore", LangChainBetaWarning)
        yield


def warn_beta(
    *,
    message: str = "",
    name: str = "",
    obj_type: str = "",
    addendum: str = "",
) -> None:
    """Display a standardized beta annotation.

    Args:
        message: Override the default beta message.

            The %(name)s, %(obj_type)s, %(addendum)s format specifiers will be replaced
            by the values of the respective arguments passed to this function.
        name: The name of the annotated object.
        obj_type: The object type being annotated.
        addendum: Additional text appended directly to the final message.
    """
    if not message:
        message = ""

        if obj_type:
            message += f"The {obj_type} `{name}`"
        else:
            message += f"`{name}`"

        message += " is in beta. It is actively being worked on, so the API may change."

        if addendum:
            message += f" {addendum}"

    warning = LangChainBetaWarning(message)
    warnings.warn(warning, category=LangChainBetaWarning, stacklevel=4)


def surface_langchain_beta_warnings() -> None:
    """Unmute LangChain beta warnings."""
    warnings.filterwarnings(
        "default",
        category=LangChainBetaWarning,
    )

```

### Core Architecture Module: `libs/core/langchain_core/_api/deprecation.py`
```
"""Helper functions for deprecating parts of the LangChain API.

This module was adapted from matplotlib's [`_api/deprecation.py`](https://github.com/matplotlib/matplotlib/blob/main/lib/matplotlib/_api/deprecation.py)
module.

!!! warning

    This module is for internal use only. Do not use it in your own code. We may change
    the API at any time with no warning.
"""

import contextlib
import functools
import inspect
import sys
import warnings
from collections.abc import Callable, Generator
from contextvars import ContextVar
from typing import (
    TYPE_CHECKING,
    Any,
    ParamSpec,
    TypeGuard,
    TypeVar,
    cast,
)

from pydantic.fields import FieldInfo

from langchain_core._api.internal import is_caller_internal

if TYPE_CHECKING:
    from pydantic.v1.fields import FieldInfo as FieldInfoV1


def _is_pydantic_v1_field_info(obj: Any) -> TypeGuard["FieldInfoV1"]:
    """Check if `obj` is a `pydantic.v1.fields.FieldInfo` without forcing import.

    Importing `pydantic.v1` emits a `UserWarning` on Python 3.14+. Skipping the
    import entirely when no caller has constructed a v1 `FieldInfo` keeps that
    warning out of `langchain_core`'s import path. If a caller did construct one,
    `pydantic.v1.fields` is already in `sys.modules` and isinstance is safe.
    """
    mod = sys.modules.get("pydantic.v1.fields")
    if mod is None:
        return False
    return isinstance(obj, mod.FieldInfo)


def _build_deprecation_message(
    *,
    alternative: str = "",
    alternative_import: str = "",
) -> str:
    """Build a simple deprecation message for `__deprecated__` attribute.

    Args:
        alternative: An alternative API name.
        alternative_import: A fully qualified import path for the alternative.

    Returns:
        A deprecation message string for IDE/type checker display.
    """
    if alternative_import:
        return f"Use {alternative_import} instead."
    if alternative:
        return f"Use {alternative} instead."
    return "Deprecated."


class LangChainDeprecationWarning(DeprecationWarning):
    """A class for issuing deprecation warnings for LangChain users."""


class LangChainPendingDeprecationWarning(PendingDeprecationWarning):
    """A class for issuing deprecation warnings for LangChain users."""


# Tracks when callers intentionally silence LangChain deprecation warnings.
# Suppressed warnings should not consume a deprecated callable's one-time
# warning state; otherwise an internal compatibility path can prevent the first
# user-visible call from warning.
_SUPPRESSING_LANGCHAIN_DEPRECATION_WARNING = ContextVar(
    "_SUPPRESSING_LANGCHAIN_DEPRECATION_WARNING", default=False
)


# PUBLIC API


# Bound is `Any` (not `FieldInfoV1`) because importing `pydantic.v1` at module
# scope emits a `UserWarning` on Python 3.14+; v1 `FieldInfo` support is handled
# at runtime via `_is_pydantic_v1_field_info`.
T = TypeVar("T", bound=type | Callable[..., Any] | Any)


def _validate_deprecation_params(
    removal: str,
    alternative: str,
    alternative_import: str,
    *,
    pending: bool,
) -> None:
    """Validate the deprecation parameters."""
    if pending and removal:
        msg = "A pending deprecation cannot have a scheduled removal"
        raise ValueError(msg)
    if alternative and alternative_import:
        msg = "Cannot specify both alternative and alternative_import"
        raise ValueError(msg)

    if alternative_import and "." not in alternative_import:
        msg = (
            "alternative_import must be a fully qualified module path. Got "
            f" {alternative_import}"
        )
        raise ValueError(msg)


def deprecated(
    since: str,
    *,
    message: str = "",
    name: str = "",
    alternative: str = "",
    alternative_import: str = "",
    pending: bool = False,
    obj_type: str = "",
    addendum: str = "",
    removal: str = "",
    package: str = "",
) -> Callable[[T], T]:
    """Decorator to mark a function, a class, or a property as deprecated.

    When deprecating a classmethod, a staticmethod, or a property, the `@deprecated`
    decorator should go *under* `@classmethod` and `@staticmethod` (i.e., `deprecated`
    should directly decorate the underlying callable), but *over* `@property`.

    When deprecating a class `C` intended to be used as a base class in a multiple
    inheritance hierarchy, `C` *must* define an `__init__` method (if `C` instead
    inherited its `__init__` from its own base class, then `@deprecated` would mess up
    `__init__` inheritance when installing its own (deprecation-emitting) `C.__init__`).

    Parameters are the same as for `warn_deprecated`, except that *obj_type* defaults to
    'class' if decorating a class, 'attribute' if decorating a property, and 'function'
    otherwise.

    Args:
        since: The release at which this API became deprecated.
        message: Override the default deprecation message.

            The `%(since)s`, `%(name)s`, `%(alternative)s`, `%(obj_type)s`,
            `%(addendum)s`, and `%(removal)s` format specifiers will be replaced by the
            values of the respective arguments passed to this function.
        name: The name of the deprecated object.
        alternative: An alternative API that the user may use in place of the deprecated
            API.

            The deprecation warning will tell the user about this alternative if
            provided.
        alternative_import: An alternative import that the user may use instead.
        pending: If `True`, uses a `PendingDeprecationWarning` instead of a
            `DeprecationWarning`.

            Cannot be used together with removal.
        obj_type: The object type being deprecated.
        addendum: Additional text appended directly to the final message.
        removal: The expected removal version.

            With the default (an empty string), no removal version is shown in the
            warning message.

            Cannot be used together with pending.
        package: The package of the deprecated object.

    Returns:
        A decorator to mark a function or class as deprecated.

    Example:
        ```python
        @deprecated("1.4.0")
        def the_function_to_deprecate():
            pass
        ```
    """
    _validate_deprecation_params(
        removal, alternative, alternative_import, pending=pending
    )

    def deprecate(
        obj: T,
        *,
        _obj_type: str = obj_type,
        _name: str = name,
        _message: str = message,
        _alternative: str = alternative,
        _alternative_import: str = alternative_import,
        _pending: bool = pending,
        _addendum: str = addendum,
        _package: str = package,
    ) -> T:
        """Implementation of the decorator returned by `deprecated`."""

        def emit_warning() -> None:
            """Emit the warning."""
            warn_deprecated(
                since,
                message=_message,
                name=_name,
                alternative=_alternative,
                alternative_import=_alternative_import,
                pending=_pending,
                obj_type=_obj_type,
                addendum=_addendum,
                removal=removal,
                package=_package,
            )

        warned = False

        def warning_emitting_wrapper(*args: Any, **kwargs: Any) -> Any:
            """Wrapper for the original wrapped callable that emits a warning.

            Args:
                *args: The positional arguments to the function.
                **kwargs: The keyword arguments to the function.

            Returns:
                The return value of the function being wrapped.
            """
            nonlocal warned
            if not warned and not is_caller_internal():
                emit_warning()
                # Only mark the warning as emitted if it was not intentionally
                # suppressed by `suppress_langchain_deprecation_warning()`.
                warned = not _SUPPRESSING_LANGCHAIN_DEPRECATION_WARNING.get()
            return wrapped(*args, **kwargs)

        async def awarning_emitting_wrapper(*args: Any, **kwargs: Any) -> Any:
            """Same as warning_emitting_wrapper, but for async functions."""
            nonlocal warned
            if not warned and not is_caller_internal():
                emit_warning()
                # Only mark the warning as emitted if it was not intentionally
                # suppressed by `suppress_langchain_deprecation_warning()`.
                warned = not _SUPPRESSING_LANGCHAIN_DEPRECATION_WARNING.get()
            return await wrapped(*args, **kwargs)

        _package = _package or obj.__module__.split(".")[0].replace("_", "-")

        if isinstance(obj, type):
            if not _obj_type:
                _obj_type = "class"
            wrapped = obj.__init__  # type: ignore[misc]
            _name = _name or obj.__qualname__
            old_doc = obj.__doc__

            def finalize(_: Callable[..., Any], new_doc: str, /) -> T:
                """Finalize the deprecation of a class."""
                # Can't set new_doc on some extension objects.
                with contextlib.suppress(AttributeError):
                    obj.__doc__ = new_doc

                def warn_if_direct_instance(
                    self: Any, *args: Any, **kwargs: Any
                ) -> Any:
                    """Warn that the class is in beta."""
                    nonlocal warned
                    if not warned and type(self) is obj and not is_caller_internal():
                        emit_warning()
                        # Only mark the warning as emitted if it was not intentionally
                        # suppressed by `suppress_langchain_deprecation_warning()`.
                        warned = not _SUPPRESSING_LANGCHAIN_DEPRECATION_WARNING.get()
                    return wrapped(self, *args, **kwargs)

                obj.__init__ = functools.wraps(obj.__init__)(  # type: igno
```

### Core Architecture Module: `libs/core/langchain_core/_api/internal.py`
```
import inspect
from typing import cast


def is_caller_internal(depth: int = 2) -> bool:
    """Return whether the caller at `depth` of this function is internal."""
    try:
        frame = inspect.currentframe()
    except AttributeError:
        return False
    if frame is None:
        return False
    try:
        for _ in range(depth):
            frame = frame.f_back
            if frame is None:
                return False
        # Directly access the module name from the frame's global variables
        module_globals = frame.f_globals
        caller_module_name = cast("str", module_globals.get("__name__", ""))
        return caller_module_name.startswith("langchain")
    finally:
        del frame

```

### Core Architecture Module: `libs/core/langchain_core/_api/path.py`
```
import os
from pathlib import Path

HERE = Path(__file__).parent

# Get directory of langchain package
PACKAGE_DIR = HERE.parent
SEPARATOR = os.sep


def get_relative_path(file: Path | str, *, relative_to: Path = PACKAGE_DIR) -> str:
    """Get the path of the file as a relative path to the package directory.

    Args:
        file: The file path to convert.
        relative_to: The base path to make the file path relative to.

    Returns:
        The relative path as a string.
    """
    if isinstance(file, str):
        file = Path(file)
    return str(file.relative_to(relative_to))


def as_import_path(
    file: Path | str,
    *,
    suffix: str | None = None,
    relative_to: Path = PACKAGE_DIR,
) -> str:
    """Path of the file as a LangChain import exclude langchain top namespace.

    Args:
        file: The file path to convert.
        suffix: An optional suffix to append to the import path.
        relative_to: The base path to make the file path relative to.

    Returns:
        The import path as a string.
    """
    if isinstance(file, str):
        file = Path(file)
    path = get_relative_path(file, relative_to=relative_to)
    if file.is_file():
        path = path[: -len(file.suffix)]
    import_path = path.replace(SEPARATOR, ".")
    if suffix:
        import_path += "." + suffix
    return import_path

```

### Core Architecture Module: `libs/core/langchain_core/_import_utils.py`
```
from importlib import import_module


def import_attr(
    attr_name: str,
    module_name: str | None,
    package: str | None,
) -> object:
    """Import an attribute from a module located in a package.

    This utility function is used in custom `__getattr__` methods within `__init__.py`
    files to dynamically import attributes.

    Args:
        attr_name: The name of the attribute to import.
        module_name: The name of the module to import from.

            If `None`, the attribute is imported from the package itself.
        package: The name of the package where the module is located.

    Raises:
        ImportError: If the module cannot be found.
        AttributeError: If the attribute does not exist in the module or package.

    Returns:
        The imported attribute.
    """
    if module_name == "__module__" or module_name is None:
        try:
            result = import_module(f".{attr_name}", package=package)
        except ModuleNotFoundError:
            msg = f"module '{package!r}' has no attribute {attr_name!r}"
            raise AttributeError(msg) from None
    else:
        try:
            module = import_module(f".{module_name}", package=package)
        except ModuleNotFoundError as err:
            msg = f"module '{package!r}.{module_name!r}' not found ({err})"
            raise ImportError(msg) from None
        result = getattr(module, attr_name)
    return result

```

### Core Architecture Module: `libs/core/langchain_core/_security/__init__.py`
```
"""SSRF protection and security utilities.

This is an **internal** module (note the `_security` prefix). It is NOT part of
the public `langchain-core` API and may change or be removed at any time without
notice. External code should not import from or depend on anything in this
module. Any vulnerability reports should target the public APIs that use these
utilities, not this internal module directly.
"""

from langchain_core._security._exceptions import SSRFBlockedError
from langchain_core._security._policy import (
    SSRFPolicy,
    validate_hostname,
    validate_resolved_ip,
    validate_url,
    validate_url_sync,
)
from langchain_core._security._transport import (
    SSRFSafeSyncTransport,
    SSRFSafeTransport,
    ssrf_safe_async_client,
    ssrf_safe_client,
)

__all__ = [
    "SSRFBlockedError",
    "SSRFPolicy",
    "SSRFSafeSyncTransport",
    "SSRFSafeTransport",
    "ssrf_safe_async_client",
    "ssrf_safe_client",
    "validate_hostname",
    "validate_resolved_ip",
    "validate_url",
    "validate_url_sync",
]

```

### Core Architecture Module: `libs/core/langchain_core/_security/_exceptions.py`
```
"""SSRF protection exceptions."""


class SSRFBlockedError(Exception):
    """Raised when a request is blocked by SSRF protection policy."""

    def __init__(self, reason: str) -> None:
        self.reason = reason
        super().__init__(f"SSRF blocked: {reason}")

```

### Core Architecture Module: `libs/core/langchain_core/_security/_policy.py`
```
"""SSRF protection policy with IP validation and DNS-aware URL checking."""

import asyncio
import dataclasses
import ipaddress
import os
import socket
import urllib.parse

from langchain_core._security._exceptions import SSRFBlockedError

# ---------------------------------------------------------------------------
# Blocklist constants
# ---------------------------------------------------------------------------

_BLOCKED_IPV4_NETWORKS: tuple[ipaddress.IPv4Network, ...] = tuple(
    ipaddress.IPv4Network(n)
    for n in (
        "10.0.0.0/8",  # RFC 1918 - private class A
        "172.16.0.0/12",  # RFC 1918 - private class B
        "192.168.0.0/16",  # RFC 1918 - private class C
        "127.0.0.0/8",  # RFC 1122 - loopback
        "169.254.0.0/16",  # RFC 3927 - link-local
        "0.0.0.0/8",  # RFC 1122 - "this network"
        "100.64.0.0/10",  # RFC 6598 - shared/CGN address space
        "192.0.0.0/24",  # RFC 6890 - IETF protocol assignments
        "192.0.2.0/24",  # RFC 5737 - TEST-NET-1 (documentation)
        "198.18.0.0/15",  # RFC 2544 - benchmarking
        "198.51.100.0/24",  # RFC 5737 - TEST-NET-2 (documentation)
        "203.0.113.0/24",  # RFC 5737 - TEST-NET-3 (documentation)
        "224.0.0.0/4",  # RFC 5771 - multicast
        "240.0.0.0/4",  # RFC 1112 - reserved for future use
        "255.255.255.255/32",  # RFC 919  - limited broadcast
    )
)

_BLOCKED_IPV6_NETWORKS: tuple[ipaddress.IPv6Network, ...] = tuple(
    ipaddress.IPv6Network(n)
    for n in (
        "::1/128",  # RFC 4291 - loopback
        "fc00::/7",  # RFC 4193 - unique local addresses (ULA)
        "fe80::/10",  # RFC 4291 - link-local
        "ff00::/8",  # RFC 4291 - multicast
        "::ffff:0:0/96",  # RFC 4291 - IPv4-mapped IPv6 addresses
        "::0.0.0.0/96",  # RFC 4291 - IPv4-compatible IPv6 (deprecated)
        "64:ff9b::/96",  # RFC 6052 - NAT64 well-known prefix
        "64:ff9b:1::/48",  # RFC 8215 - NAT64 discovery prefix
    )
)

_CLOUD_METADATA_IPS: frozenset[str] = frozenset(
    {
        "169.254.169.254",  # AWS, GCP, Azure, DigitalOcean, Oracle Cloud
        "169.254.170.2",  # AWS ECS task metadata
        "169.254.170.23",  # AWS EKS Pod Identity Agent
        "100.100.100.200",  # Alibaba Cloud metadata
        "fd00:ec2::254",  # AWS EC2 IMDSv2 over IPv6 (Nitro instances)
        "fd00:ec2::23",  # AWS EKS Pod Identity Agent (IPv6)
        "fe80::a9fe:a9fe",  # OpenStack Nova metadata (IPv6 link-local)
    }
)

# Network ranges that are always blocked when block_cloud_metadata=True,
# independent of block_private_ips.  The entire link-local range is used by
# cloud metadata services across providers.
_CLOUD_METADATA_NETWORKS: tuple[ipaddress.IPv4Network | ipaddress.IPv6Network, ...] = (
    ipaddress.IPv4Network("169.254.0.0/16"),
)

_CLOUD_METADATA_HOSTNAMES: frozenset[str] = frozenset(
    {
        "metadata.google.internal",
        "metadata.amazonaws.com",
        "metadata",
        "instance-data",
    }
)

_LOCALHOST_NAMES: frozenset[str] = frozenset(
    {
        "localhost",
        "localhost.localdomain",
        "host.docker.internal",
    }
)

_K8S_SUFFIX = ".svc.cluster.local"

_LOOPBACK_IPV4 = ipaddress.IPv4Network("127.0.0.0/8")
_LOOPBACK_IPV6 = ipaddress.IPv6Address("::1")

# NAT64 well-known prefixes
_NAT64_PREFIX = ipaddress.IPv6Network("64:ff9b::/96")
_NAT64_DISCOVERY_PREFIX = ipaddress.IPv6Network("64:ff9b:1::/48")


# ---------------------------------------------------------------------------
# SSRFPolicy
# ---------------------------------------------------------------------------


@dataclasses.dataclass(frozen=True)
class SSRFPolicy:
    """Immutable policy controlling which URLs/IPs are considered safe."""

    allowed_schemes: frozenset[str] = frozenset({"http", "https"})
    block_private_ips: bool = True
    block_localhost: bool = True
    block_cloud_metadata: bool = True
    block_k8s_internal: bool = True
    allowed_hosts: frozenset[str] = frozenset()
    additional_blocked_cidrs: tuple[
        ipaddress.IPv4Network | ipaddress.IPv6Network, ...
    ] = ()


DEFAULT_SSRF_POLICY = SSRFPolicy()


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _extract_embedded_ipv4(
    addr: ipaddress.IPv6Address,
) -> ipaddress.IPv4Address | None:
    """Extract an embedded IPv4 from IPv4-mapped or NAT64 IPv6 addresses."""
    # Check ipv4_mapped first (covers ::ffff:x.x.x.x)
    if addr.ipv4_mapped is not None:
        return addr.ipv4_mapped

    # Check NAT64 prefixes — embedded IPv4 is in the last 4 bytes
    if addr in _NAT64_PREFIX or addr in _NAT64_DISCOVERY_PREFIX:
        raw = addr.packed
        return ipaddress.IPv4Address(raw[-4:])

    return None


def _ip_in_blocked_networks(
    addr: ipaddress.IPv4Address | ipaddress.IPv6Address,
    policy: SSRFPolicy,
) -> str | None:
    """Return a reason string if *addr* falls in a blocked range, else None."""
    # NOTE: if profiling shows this is a hot path, consider memoising with
    # @functools.lru_cache (key on (addr, id(policy))).
    if isinstance(addr, ipaddress.IPv4Address):
        if policy.block_private_ips:
            for blocked_ipv4_net in _BLOCKED_IPV4_NETWORKS:
                if addr in blocked_ipv4_net:
                    return "private IP range"
        for blocked_cidr in policy.additional_blocked_cidrs:
            if isinstance(blocked_cidr, ipaddress.IPv4Network) and addr in blocked_cidr:
                return "blocked CIDR"
    else:
        if policy.block_private_ips:
            for blocked_ipv6_net in _BLOCKED_IPV6_NETWORKS:
                if addr in blocked_ipv6_net:
                    return "private IP range"
        for blocked_cidr in policy.additional_blocked_cidrs:
            if isinstance(blocked_cidr, ipaddress.IPv6Network) and addr in blocked_cidr:
                return "blocked CIDR"

    # Loopback check — independent of block_private_ips so that
    # block_localhost=True still catches 127.x.x.x / ::1 even when
    # private IPs are allowed.
    if policy.block_localhost:
        if isinstance(addr, ipaddress.IPv4Address) and (
            addr in _LOOPBACK_IPV4 or addr in ipaddress.IPv4Network("0.0.0.0/8")
        ):
            return "localhost address"
        if isinstance(addr, ipaddress.IPv6Address) and addr == _LOOPBACK_IPV6:
            return "localhost address"

    # Cloud metadata check — IP set *and* network ranges (e.g. 169.254.0.0/16).
    # Independent of block_private_ips so that allow_private=True still blocks
    # cloud metadata endpoints.
    if policy.block_cloud_metadata:
        if str(addr) in _CLOUD_METADATA_IPS:
            return "cloud metadata endpoint"
        for net in _CLOUD_METADATA_NETWORKS:
            if addr in net:
                return "cloud metadata endpoint"

    return None


# ---------------------------------------------------------------------------
# Public validation functions
# ---------------------------------------------------------------------------


def validate_resolved_ip(ip_str: str, policy: SSRFPolicy) -> None:
    """Validate a resolved IP address against the SSRF policy.

    Raises SSRFBlockedError if the IP is blocked.
    """
    try:
        addr = ipaddress.ip_address(ip_str)
    except ValueError as exc:
        msg = "invalid IP address"
        raise SSRFBlockedError(msg) from exc

    if isinstance(addr, ipaddress.IPv6Address):
        inner = _extract_embedded_ipv4(addr)
        if inner is not None:
            addr = inner

    reason = _ip_in_blocked_networks(addr, policy)
    if reason is not None:
        raise SSRFBlockedError(reason)


def validate_hostname(hostname: str, policy: SSRFPolicy) -> None:
    """Validate a hostname against the SSRF policy.

    Raises SSRFBlockedError if the hostname is blocked.
    """
    lower = hostname.lower()

    if policy.block_localhost and lower in _LOCALHOST_NAMES:
        msg = "localhost address"
        raise SSRFBlockedError(msg)

    if policy.block_cloud_metadata and lower in _CLOUD_METADATA_HOSTNAMES:
        msg = "cloud metadata endpoint"
        raise SSRFBlockedError(msg)

    if policy.block_k8s_internal and lower.endswith(_K8S_SUFFIX):
        msg = "Kubernetes internal DNS"
        raise SSRFBlockedError(msg)


def _effective_allowed_hosts(policy: SSRFPolicy) -> frozenset[str]:
    """Return allowed_hosts, augmented for local environments."""
    extra: set[str] = set()
    if os.environ.get("LANGCHAIN_ENV", "").startswith("local"):
        extra.update({"localhost", "testserver"})
    if extra:
        return policy.allowed_hosts | frozenset(extra)
    return policy.allowed_hosts


async def validate_url(url: str, policy: SSRFPolicy = DEFAULT_SSRF_POLICY) -> None:
    """Validate a URL against the SSRF policy, including DNS resolution.

    This is the primary entry-point for async code paths. It delegates
    scheme/hostname/allowed-hosts checks to `validate_url_sync`, then
    resolves DNS and validates every resolved IP.

    Raises:
        SSRFBlockedError: If the URL violates the policy.
    """
    parsed = urllib.parse.urlparse(url)
    hostname = parsed.hostname or ""

    validate_url_sync(url, policy)

    allowed = {h.lower() for h in _effective_allowed_hosts(policy)}
    if hostname.lower() in allowed:
        return

    scheme = (parsed.scheme or "").lower()
    port = parsed.port or (443 if scheme == "https" else 80)
    try:
        addrinfo = await asyncio.to_thread(
            socket.getaddrinfo, hostname, port, type=socket.SOCK_STREAM
        )
    except socket.gaierror as exc:
        msg = "DNS resolution failed"
        raise SSRFBlockedError(msg) from exc

    for _family, _type, _proto, _canonname, sockaddr in addrinfo:
        validate_resolved_ip(str(sockaddr[0]), policy)


def validate_url_sync(url: str, policy: SSRFPolicy = DEFAULT_SSRF_POLICY) -> None:
    """Synchronous U
```

### Core Architecture Module: `libs/core/langchain_core/_security/_ssrf_protection.py`
```
"""SSRF Protection - thin wrapper raising ValueError for internal callers.

Delegates all validation to `langchain_core._security._policy`.
"""

import os
import socket
from typing import Annotated, Any
from urllib.parse import urlparse

from pydantic import (
    AnyHttpUrl,
    BeforeValidator,
    HttpUrl,
)

from langchain_core._security._exceptions import SSRFBlockedError
from langchain_core._security._policy import (
    SSRFPolicy,
)
from langchain_core._security._policy import (
    validate_resolved_ip as _validate_resolved_ip,
)
from langchain_core._security._policy import (
    validate_url_sync as _validate_url_sync,
)


def _policy_for(*, allow_private: bool, allow_http: bool) -> SSRFPolicy:
    """Build an `SSRFPolicy` from the legacy flag interface."""
    schemes = frozenset({"http", "https"}) if allow_http else frozenset({"https"})
    return SSRFPolicy(
        allowed_schemes=schemes,
        block_private_ips=not allow_private,
        block_localhost=not allow_private,
        block_cloud_metadata=True,
        block_k8s_internal=True,
    )


def validate_safe_url(
    url: str | AnyHttpUrl,
    *,
    allow_private: bool = False,
    allow_http: bool = True,
) -> str:
    """Validate a URL for SSRF protection.

    This function validates URLs to prevent Server-Side Request Forgery (SSRF) attacks
    by blocking requests to private networks and cloud metadata endpoints.

    Args:
        url: The URL to validate (string or Pydantic HttpUrl).
        allow_private: If `True`, allows private IPs and localhost (for development).
                      Cloud metadata endpoints are ALWAYS blocked.
        allow_http: If `True`, allows both HTTP and HTTPS.  If `False`, only HTTPS.

    Returns:
        The validated URL as a string.

    Raises:
        ValueError: If URL is invalid or potentially dangerous.
    """
    url_str = str(url)
    parsed = urlparse(url_str)
    hostname = parsed.hostname or ""

    # Test-environment bypass (preserved from original implementation)
    if (
        os.environ.get("LANGCHAIN_ENV") == "local_test"
        and hostname.startswith("test")
        and "server" in hostname
    ):
        return url_str

    policy = _policy_for(allow_private=allow_private, allow_http=allow_http)

    # Synchronous scheme + hostname checks
    try:
        _validate_url_sync(url_str, policy)
    except SSRFBlockedError as exc:
        raise ValueError(str(exc)) from exc

    # DNS resolution and IP validation
    try:
        addr_info = socket.getaddrinfo(
            hostname,
            parsed.port or (443 if parsed.scheme == "https" else 80),
            socket.AF_UNSPEC,
            socket.SOCK_STREAM,
        )

        for result in addr_info:
            ip_str: str = result[4][0]  # type: ignore[assignment]
            try:
                _validate_resolved_ip(ip_str, policy)
            except SSRFBlockedError as exc:
                raise ValueError(str(exc)) from exc

    except socket.gaierror as e:
        msg = f"Failed to resolve hostname '{hostname}': {e}"
        raise ValueError(msg) from e
    except OSError as e:
        msg = f"Network error while validating URL: {e}"
        raise ValueError(msg) from e

    return url_str


def is_safe_url(
    url: str | AnyHttpUrl,
    *,
    allow_private: bool = False,
    allow_http: bool = True,
) -> bool:
    """Non-throwing version of `validate_safe_url`."""
    try:
        validate_safe_url(url, allow_private=allow_private, allow_http=allow_http)
    except ValueError:
        return False
    else:
        return True


def _validate_url_ssrf_strict(v: Any) -> Any:
    """Validate URL for SSRF protection (strict mode)."""
    if isinstance(v, str):
        validate_safe_url(v, allow_private=False, allow_http=True)
    return v


def _validate_url_ssrf_https_only(v: Any) -> Any:
    if isinstance(v, str):
        validate_safe_url(v, allow_private=False, allow_http=False)
    return v


def _validate_url_ssrf_relaxed(v: Any) -> Any:
    """Validate URL for SSRF protection (relaxed mode - allows private IPs)."""
    if isinstance(v, str):
        validate_safe_url(v, allow_private=True, allow_http=True)
    return v


# Annotated types with SSRF protection
SSRFProtectedUrl = Annotated[HttpUrl, BeforeValidator(_validate_url_ssrf_strict)]
SSRFProtectedUrlRelaxed = Annotated[
    HttpUrl, BeforeValidator(_validate_url_ssrf_relaxed)
]
SSRFProtectedHttpsUrl = Annotated[
    HttpUrl, BeforeValidator(_validate_url_ssrf_https_only)
]
SSRFProtectedHttpsUrlStr = Annotated[
    str, BeforeValidator(_validate_url_ssrf_https_only)
]

```

### Core Architecture Module: `libs/core/langchain_core/_security/_transport.py`
```
"""SSRF-safe httpx transport with DNS resolution and IP pinning."""

import asyncio
import socket

import httpx

from langchain_core._security._exceptions import SSRFBlockedError
from langchain_core._security._policy import (
    DEFAULT_SSRF_POLICY,
    SSRFPolicy,
    _effective_allowed_hosts,
    validate_resolved_ip,
    validate_url_sync,
)

# Keys that AsyncHTTPTransport accepts (forwarded from factory kwargs).
_TRANSPORT_KWARGS = frozenset(
    {
        "verify",
        "cert",
        "trust_env",
        "http1",
        "http2",
        "limits",
        "retries",
    }
)


class SSRFSafeTransport(httpx.AsyncBaseTransport):
    """httpx async transport that validates DNS results against an SSRF policy.

    For every outgoing request the transport:
    1. Checks the URL scheme against `policy.allowed_schemes`.
    2. Validates the hostname against blocked patterns.
    3. Resolves DNS and validates **all** returned IPs.
    4. Rewrites the request to connect to the first valid IP while
       preserving the original `Host` header and TLS SNI hostname.

    Redirects are re-validated on each hop because `follow_redirects`
    is set on the *client*, causing `handle_async_request` to be called
    again for each redirect target.
    """

    def __init__(
        self,
        policy: SSRFPolicy = DEFAULT_SSRF_POLICY,
        **transport_kwargs: object,
    ) -> None:
        self._policy = policy
        self._inner = httpx.AsyncHTTPTransport(**transport_kwargs)  # type: ignore[arg-type]

    # ------------------------------------------------------------------ #
    # Core request handler
    # ------------------------------------------------------------------ #

    async def handle_async_request(
        self,
        request: httpx.Request,
    ) -> httpx.Response:
        hostname = request.url.host or ""
        scheme = request.url.scheme.lower()

        # 1-3. Scheme, hostname, and pattern checks (reuse sync validator).
        validate_url_sync(str(request.url), self._policy)

        # Allowed-hosts bypass - skip DNS/IP validation entirely.
        allowed = {h.lower() for h in _effective_allowed_hosts(self._policy)}
        if hostname.lower() in allowed:
            return await self._inner.handle_async_request(request)

        # 4. DNS resolution
        port = request.url.port or (443 if scheme == "https" else 80)
        try:
            addrinfo = await asyncio.to_thread(
                socket.getaddrinfo,
                hostname,
                port,
                type=socket.SOCK_STREAM,
            )
        except socket.gaierror as exc:
            msg = "DNS resolution failed"
            raise SSRFBlockedError(msg) from exc

        if not addrinfo:
            msg = "DNS resolution returned no results"
            raise SSRFBlockedError(msg)

        # 5. Validate ALL resolved IPs - any blocked means reject.
        for _family, _type, _proto, _canonname, sockaddr in addrinfo:
            ip_str: str = sockaddr[0]  # type: ignore[assignment]
            validate_resolved_ip(ip_str, self._policy)

        # 6. Pin to first resolved IP.
        pinned_ip = addrinfo[0][4][0]

        # 7. Rewrite URL to use pinned IP, preserving Host header and SNI.
        pinned_url = request.url.copy_with(host=pinned_ip)

        # Build extensions dict, adding sni_hostname for HTTPS so TLS
        # certificate validation uses the original hostname.
        extensions = dict(request.extensions)
        if scheme == "https":
            extensions["sni_hostname"] = hostname.encode("ascii")

        pinned_request = httpx.Request(
            method=request.method,
            url=pinned_url,
            headers=request.headers,  # Host header already set to original
            content=request.content,
            extensions=extensions,
        )

        return await self._inner.handle_async_request(pinned_request)

    # ------------------------------------------------------------------ #
    # Lifecycle
    # ------------------------------------------------------------------ #

    async def aclose(self) -> None:
        await self._inner.aclose()


# ---------------------------------------------------------------------- #
# Factory
# ---------------------------------------------------------------------- #


class SSRFSafeSyncTransport(httpx.BaseTransport):
    """httpx sync transport that validates DNS results against an SSRF policy.

    Sync mirror of `SSRFSafeTransport`. See that class for full documentation.
    """

    def __init__(
        self,
        policy: SSRFPolicy = DEFAULT_SSRF_POLICY,
        **transport_kwargs: object,
    ) -> None:
        self._policy = policy
        self._inner = httpx.HTTPTransport(**transport_kwargs)  # type: ignore[arg-type]

    def handle_request(
        self,
        request: httpx.Request,
    ) -> httpx.Response:
        hostname = request.url.host or ""
        scheme = request.url.scheme.lower()

        validate_url_sync(str(request.url), self._policy)

        allowed = {h.lower() for h in _effective_allowed_hosts(self._policy)}
        if hostname.lower() in allowed:
            return self._inner.handle_request(request)

        port = request.url.port or (443 if scheme == "https" else 80)
        try:
            addrinfo = socket.getaddrinfo(
                hostname,
                port,
                type=socket.SOCK_STREAM,
            )
        except socket.gaierror as exc:
            msg = "DNS resolution failed"
            raise SSRFBlockedError(msg) from exc

        if not addrinfo:
            msg = "DNS resolution returned no results"
            raise SSRFBlockedError(msg)

        for _family, _type, _proto, _canonname, sockaddr in addrinfo:
            ip_str: str = sockaddr[0]  # type: ignore[assignment]
            validate_resolved_ip(ip_str, self._policy)

        pinned_ip = addrinfo[0][4][0]
        pinned_url = request.url.copy_with(host=pinned_ip)

        extensions = dict(request.extensions)
        if scheme == "https":
            extensions["sni_hostname"] = hostname.encode("ascii")

        pinned_request = httpx.Request(
            method=request.method,
            url=pinned_url,
            headers=request.headers,
            content=request.content,
            extensions=extensions,
        )

        return self._inner.handle_request(pinned_request)

    def close(self) -> None:
        self._inner.close()


# ---------------------------------------------------------------------- #
# Factories
# ---------------------------------------------------------------------- #


def ssrf_safe_client(
    policy: SSRFPolicy = DEFAULT_SSRF_POLICY,
    **kwargs: object,
) -> httpx.Client:
    """Create an `httpx.Client` with SSRF protection."""
    transport_kwargs: dict[str, object] = {}
    client_kwargs: dict[str, object] = {}
    for key, value in kwargs.items():
        if key in _TRANSPORT_KWARGS:
            transport_kwargs[key] = value
        else:
            client_kwargs[key] = value

    transport = SSRFSafeSyncTransport(policy=policy, **transport_kwargs)

    client_kwargs.setdefault("follow_redirects", True)
    client_kwargs.setdefault("max_redirects", 10)

    return httpx.Client(
        transport=transport,
        **client_kwargs,  # type: ignore[arg-type]
    )


def ssrf_safe_async_client(
    policy: SSRFPolicy = DEFAULT_SSRF_POLICY,
    **kwargs: object,
) -> httpx.AsyncClient:
    """Create an `httpx.AsyncClient` with SSRF protection.

    Drop-in replacement for `httpx.AsyncClient(...)` - callers just swap
    the constructor call.  Transport-specific kwargs (`verify`, `cert`,
    `retries`, etc.) are forwarded to the inner `AsyncHTTPTransport`;
    everything else goes to the `AsyncClient`.
    """
    transport_kwargs: dict[str, object] = {}
    client_kwargs: dict[str, object] = {}
    for key, value in kwargs.items():
        if key in _TRANSPORT_KWARGS:
            transport_kwargs[key] = value
        else:
            client_kwargs[key] = value

    transport = SSRFSafeTransport(policy=policy, **transport_kwargs)

    # Apply defaults only if not overridden by caller.
    client_kwargs.setdefault("follow_redirects", True)
    client_kwargs.setdefault("max_redirects", 10)

    return httpx.AsyncClient(
        transport=transport,
        **client_kwargs,  # type: ignore[arg-type]
    )

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #41024** (2026-10-03): **ModelRetryMiddleware / ToolRetryMiddleware: `retry_on=SomeError` (a bare class) retries every exception**
  *Symptoms*: ### Submission checklist  - [x] This is a bug, not a usage question. - [x] I added a clear and descriptive title that summarizes this issue. - [x] I used the GitHub search to find a similar question and didn't find it. - [x] I am sure that this is a bug in LangChain rather than my code. - [x] The bug is not resolved by updating to the latest stable version of LangChain (or the specific integration package). - [x] This is not related to the langchain-community package. - [x] I posted a self-contained, minimal, reproducible example. A maintainer can copy it and run it AS IS.  ### Package (Required)  - [x] langchain - [ ] langchain-openai - [ ] langchain-anthropic - [ ] langchain-classic - [ ] langchain-core - [ ] langchain-model-profiles - [ ] langchain-tests - [ ] langchain-text-splitters - [ ] langchain-chroma - [ ] langchain-deepseek - [ ] langchain-exa - [ ] langchain-fireworks - [ ] langchain-groq - [ ] langchain-huggingface - [ ] langchain-mistralai - [ ] langchain-nomic - [ ] langchain-ollama - [ ] langchain-openrouter - [ ] langchain-perplexity - [ ] langchain-qdrant - [ ] langchain-typesafe - [ ] langchain-xai - [ ] Other / not sure / general  ### Related Issues / PRs  _No response_  ### Reproduction Steps / Example Code (Python)  ```python from langchain.agents.middleware._retry import should_retry_exception from langchain.agents.middleware import ToolRetryMiddleware  print(should_retry_exception(KeyError("k"), ValueError))     # 'k'   (truthy, not even a bool) print(
  **Post-Mortem & Fix Analysis**:
  > Thanks for opening an issue! It was automatically closed because:  - no package was selected (e.g. langchain-core, langchain, langgraph) — this helps us route the issue to the right team  Please use one of the [issue templates](https://github.com/langchain-ai/langchain/issues/new/choose).
  > Re-filed as #41025 with the package selected (the checkbox did not register on this submission, which is why the triage bot closed it). Please follow up there.

- **Issue #40987** (2026-10-02): **langchain-ollama allows ollama<0.6.3, which rejects model-defined thinking levels with a Pydantic ValidationError**
  *Symptoms*: ### Submission checklist  - [x] This is a bug, not a usage question. - [x] I added a clear and descriptive title that summarizes this issue. - [x] I used the GitHub search to find a similar question and didn't find it. - [x] I am sure that this is a bug in LangChain rather than my code. - [x] The bug is not resolved by updating to the latest stable version of LangChain (or the specific integration package). - [x] This is not related to the langchain-community package. - [x] I posted a self-contained, minimal, reproducible example. A maintainer can copy it and run it AS IS.  ### Package (Required)  - [ ] langchain - [ ] langchain-openai - [ ] langchain-anthropic - [ ] langchain-classic - [ ] langchain-core - [ ] langchain-model-profiles - [ ] langchain-tests - [ ] langchain-text-splitters - [ ] langchain-chroma - [ ] langchain-deepseek - [ ] langchain-exa - [ ] langchain-fireworks - [ ] langchain-groq - [ ] langchain-huggingface - [ ] langchain-mistralai - [ ] langchain-nomic - [x] langchain-ollama - [ ] langchain-openrouter - [ ] langchain-perplexity - [ ] langchain-qdrant - [ ] langchain-typesafe - [ ] langchain-xai - [ ] Other / not sure / general  ### Related Issues / PRs  Upstream client fix, already merged and released as ollama 0.6.3: https://github.com/ollama/ollama-python/pull/744  ### Reproduction Steps / Example Code (Python)  ```python from langchain_core.messages import HumanMessage from langchain_ollama import ChatOllama from ollama._types import ChatRequest  mod
  **Post-Mortem & Fix Analysis**:
  > Duplicate of #40985, which was already fixed in #40986 and merged (commit ff46bb478b).  The `ollama` dependency floor has been raised from `0.6.1` to `0.6.3` in `libs/partners/ollama/pyproject.toml`, which resolves the `ValidationError` on model-defined thinking levels like `"xhigh"` or `"max"`.  Closing as duplicate.

- **Issue #40894** (2026-09-29): **Streaming parser crashes when a tool-call delta has function=None**
  *Symptoms*: ### Submission checklist  - [x] This is a bug, not a usage question. - [x] I added a clear and descriptive title that summarizes this issue. - [x] I used the GitHub search to find a similar question and didn't find it. - [x] I am sure that this is a bug in LangChain rather than my code. - [x] The bug is not resolved by updating to the latest stable version of LangChain (or the specific integration package). - [x] This is not related to the langchain-community package. - [x] I posted a self-contained, minimal, reproducible example. A maintainer can copy it and run it AS IS.  ### Package (Required)  - [ ] langchain - [x] langchain-openai - [ ] langchain-anthropic - [ ] langchain-classic - [ ] langchain-core - [ ] langchain-model-profiles - [ ] langchain-tests - [ ] langchain-text-splitters - [ ] langchain-chroma - [ ] langchain-deepseek - [ ] langchain-exa - [ ] langchain-fireworks - [ ] langchain-groq - [ ] langchain-huggingface - [ ] langchain-mistralai - [ ] langchain-nomic - [ ] langchain-ollama - [ ] langchain-openrouter - [ ] langchain-perplexity - [ ] langchain-qdrant - [ ] langchain-typesafe - [ ] langchain-xai - [ ] Other / not sure / general  ### Related Issues / PRs  _No response_  ### Reproduction Steps / Example Code (Python)  ```python from openai.types.chat.chat_completion_chunk import ChoiceDeltaToolCall  from langchain_core.messages import AIMessageChunk from langchain_openai.chat_models.base import _convert_delta_to_message_chunk  tool_call = ChoiceDeltaToolCa
  **Post-Mortem & Fix Analysis**:
  > I reproduced the `function=None` tool-call delta crash on current main in `_convert_delta_to_message_chunk`. The OpenAI SDK produces this shape in a locally constructed chunk, though I haven't seen a live response with it. I'd be happy to add a regression test and a small parser fix. Could you assign this to me?
  > I'd like to fix this. `_convert_delta_to_message_chunk` builds `tool_call_chunks` assuming every delta has a function object, so an SDK-legal `ChoiceDeltaToolCall(index=0, function=None)` raises `AttributeError` and aborts the stream.  Approach: treat a null function like an empty one (`(rtc["function"] or {}).get(...)`) rather than dropping the delta, so the partial chunk keeps its `id`/`index` and later deltas carrying the actual function still assemble into the tool call. The change is a two-line guard in `langchain_openai/chat_models/base.py` plus a unit test for the null-function delta. I have this change ready (PR #40901, auto-closed pending assignment) and can reopen it on assignment.
  > Please submit an issue using a LangChain public API.

- **Issue #40853** (2026-09-27): **create_agent invalid-tool-call repair emits a tool_result with no matching tool_use, so Anthropic threads fail with a 400 after any invalid tool call**
  *Symptoms*: ### Submission checklist  - [x] This is a bug, not a usage question. - [x] I added a clear and descriptive title that summarizes this issue. - [x] I used the GitHub search to find a similar question and didn't find it. - [x] I am sure that this is a bug in LangChain rather than my code. - [x] The bug is not resolved by updating to the latest stable version of LangChain (or the specific integration package). - [x] This is not related to the langchain-community package. - [x] I posted a self-contained, minimal, reproducible example. A maintainer can copy it and run it AS IS.  ### Package (Required)  - [x] langchain - [ ] langchain-openai - [ ] langchain-anthropic - [ ] langchain-classic - [ ] langchain-core - [ ] langchain-model-profiles - [ ] langchain-tests - [ ] langchain-text-splitters - [ ] langchain-chroma - [ ] langchain-deepseek - [ ] langchain-exa - [ ] langchain-fireworks - [ ] langchain-groq - [ ] langchain-huggingface - [ ] langchain-mistralai - [ ] langchain-nomic - [ ] langchain-ollama - [ ] langchain-openrouter - [ ] langchain-perplexity - [ ] langchain-qdrant - [ ] langchain-typesafe - [ ] langchain-xai - [ ] Other / not sure / general  ### Related Issues / PRs  - #40530 introduced the repair. This report is about an interaction it creates with the Anthropic message serializer, not a regression in what it fixed for OpenAI-style providers.  ### Reproduction Steps / Example Code (Python)  ```python """ create_agent's invalid-tool-call repair produces an Anthropic 
  **Post-Mortem & Fix Analysis**:
  > Happy to take this one - I have a working implementation of direction 1 and am posting the design here per the contribution flow before (re)opening the PR.  **Root cause (confirming the analysis above).** `_patch_invalid_tool_calls` (libs/langchain_v1/langchain/agents/factory.py) appends a synthetic error `ToolMessage` for each unanswered `invalid_tool_call` but leaves the `AIMessage` untouched. Provider serializers disagree on that field: `langchain-openai` emits `tool_calls` entries for invalid calls, while `langchain-anthropic` builds `tool_use` blocks only from `tool_calls` and drops `invalid_tool_calls` entirely. The synthetic `ToolMessage` therefore serializes to a `tool_result` whose `tool_use` parent no provider emits, and the Anthropic Messages API rejects the payload with a 400. Because the repair is persisted back into state (`RemoveMessage(REMOVE_ALL_MESSAGES)` + the repaired list), one truncated tool call makes every subsequent call on that thread fail with the same 400.  
  > Hey @insuffer, reporter here, thanks for taking a look :)  I already have implementation ready on my local branches for the directions mentioned in the description body.  Direction 1 is fully specced above, and the implementation is a short step from the repro harness the issue was built on, so a PR will be up quickly once a direction is ruled!
  > When tool-call errors or repair loops trigger in agent frameworks, child processes spawned during the failed execution often continue running in the background as orphans. If a tool launches a subprocess (such as a dev server, test runner, or script) and the parent framework catches an exception without explicitly terminating the process group, those orphans consume CPU, lock ports, and leak memory.  To eliminate runaway orphan processes during tool failures: 1. Place every tool execution into an isolated process group (setpgid(0, 0)) or dedicated cgroups v2 scope. 2. On tool failure or timeout, escalate termination using cgroup.kill or os.killpg(pgid, signal.SIGKILL) to ensure that all descendant processes are extinguished simultaneously. 3. Use Linux pidfd_open and pidfd_send_signal to eliminate PID recycling race conditions when managing child process lifecycles.  In [Vetto](https://github.com/shleder/vetto), we isolate AI coding agent tools using cgroups v2 and PID pinning. When a 

- **Issue #40817** (2026-09-24): **RunnableWithFallbacks.batch/abatch never close root runs when an input raises an exception not in exceptions_to_handle**
  *Symptoms*: ### Submission checklist  - [x] This is a bug, not a usage question. - [x] I added a clear and descriptive title that summarizes this issue. - [x] I used the GitHub search to find a similar question and didn't find it. - [x] I am sure that this is a bug in LangChain rather than my code. - [x] The bug is not resolved by updating to the latest stable version of LangChain (or the specific integration package). - [x] This is not related to the langchain-community package. - [x] I posted a self-contained, minimal, reproducible example. A maintainer can copy it and run it AS IS.  ### Package (Required)  - [ ] langchain - [ ] langchain-openai - [ ] langchain-anthropic - [ ] langchain-classic - [x] langchain-core - [ ] langchain-model-profiles - [ ] langchain-tests - [ ] langchain-text-splitters - [ ] langchain-chroma - [ ] langchain-deepseek - [ ] langchain-exa - [ ] langchain-fireworks - [ ] langchain-groq - [ ] langchain-huggingface - [ ] langchain-mistralai - [ ] langchain-nomic - [ ] langchain-ollama - [ ] langchain-openrouter - [ ] langchain-perplexity - [ ] langchain-qdrant - [ ] langchain-typesafe - [ ] langchain-xai - [ ] Other / not sure / general  ### Related Issues / PRs  None found. (#36746 is a different `RunnableWithFallbacks.batch` issue, about `zip(strict=False)`.)  ### Reproduction Steps / Example Code (Python)  ```python import asyncio from langchain_core.callbacks import BaseCallbackHandler from langchain_core.runnables import RunnableLambda   class Tracker(BaseCa
  **Post-Mortem & Fix Analysis**:
  > Thanks for opening an issue! It was automatically closed because:  - no package was selected (e.g. langchain-core, langchain, langgraph) — this helps us route the issue to the right team  Please use one of the [issue templates](https://github.com/langchain-ai/langchain/issues/new/choose).

- **Issue #40810** (2026-09-25): **ChatOpenAI tool calls fail with 400 for Bedrock GPT-6 model IDs (`us.openai.gpt-6-sol`, `openai.gpt-6-astra`) because Responses routing only matches names starting with `gpt-6`**
  *Symptoms*: ### Submission checklist  - [x] This is a bug, not a usage question. - [x] I added a clear and descriptive title that summarizes this issue. - [x] I used the GitHub search to find a similar question and didn't find it. - [x] I am sure that this is a bug in LangChain rather than my code. - [x] The bug is not resolved by updating to the latest stable version of LangChain (or the specific integration package). - [x] This is not related to the langchain-community package. - [x] I posted a self-contained, minimal, reproducible example. A maintainer can copy it and run it AS IS.  ### Package (Required)  - [ ] langchain - [x] langchain-openai - [ ] langchain-anthropic - [ ] langchain-classic - [ ] langchain-core - [ ] langchain-model-profiles - [ ] langchain-tests - [ ] langchain-text-splitters - [ ] langchain-chroma - [ ] langchain-deepseek - [ ] langchain-exa - [ ] langchain-fireworks - [ ] langchain-groq - [ ] langchain-huggingface - [ ] langchain-mistralai - [ ] langchain-nomic - [ ] langchain-ollama - [ ] langchain-openrouter - [ ] langchain-perplexity - [ ] langchain-qdrant - [ ] langchain-typesafe - [ ] langchain-xai - [ ] Other / not sure / general  ### Related Issues / PRs  Thanks to ccurme for #40443, which routes GPT-6 tool calls to the Responses API; with `model="gpt-6-astra"` tool calls are routed there as intended. This issue is only about model names that contain `gpt-6` but do not start with it.  - #40346 reported the `gpt-6-astra` case that #40443 fixed. - Amazon Be
  **Post-Mortem & Fix Analysis**:
  > Thanks for #40443, which already routes `gpt-6-*` tool calls to the Responses API. Here is the approach I'd like to take, for your review before I open a PR.  **Proposed change:** widen that check in `langchain_openai/chat_models/base.py` from `startswith("gpt-6")` to also match `gpt-6` after a provider prefix, so IDs like `us.openai.gpt-6-sol`, `global.openai.gpt-6-astra` and `openai.gpt-6-sol` route to `/responses` the same way. Calls without tools and explicit `use_responses_api` settings are unchanged. One behavior change worth your call: prefixed IDs with `reasoning_effort="none"` would then also use `/responses`, as `gpt-6-*` names already do.  | `ChatOpenAI(base_url=<Bedrock /openai/v1>)` | Before | After | |---|---|---| | `bind_tools`, Sol/Luna/Astra `us.`/`global.` IDs | 400 `Function tools with reasoning_effort are not supported` | tool call via `/responses` | | `with_structured_output(method="function_calling")` | same 400 | `City(name='Paris', country='France')` | | Calls w
  > Please set `use_responses_api=True`.

- **Issue #40808** (2026-09-25): **create_agent with response_format loops or returns 400 for Bedrock GPT-6 model IDs because `gpt-6` is missing from the structured-output fallback list**
  *Symptoms*: ### Submission checklist  - [x] This is a bug, not a usage question. - [x] I added a clear and descriptive title that summarizes this issue. - [x] I used the GitHub search to find a similar question and didn't find it. - [x] I am sure that this is a bug in LangChain rather than my code. - [x] The bug is not resolved by updating to the latest stable version of LangChain (or the specific integration package). - [x] This is not related to the langchain-community package. - [x] I posted a self-contained, minimal, reproducible example. A maintainer can copy it and run it AS IS.  ### Package (Required)  - [x] langchain - [ ] langchain-openai - [ ] langchain-anthropic - [ ] langchain-classic - [ ] langchain-core - [ ] langchain-model-profiles - [ ] langchain-tests - [ ] langchain-text-splitters - [ ] langchain-chroma - [ ] langchain-deepseek - [ ] langchain-exa - [ ] langchain-fireworks - [ ] langchain-groq - [ ] langchain-huggingface - [ ] langchain-mistralai - [ ] langchain-nomic - [ ] langchain-ollama - [ ] langchain-openrouter - [ ] langchain-perplexity - [ ] langchain-qdrant - [ ] langchain-typesafe - [ ] langchain-xai - [ ] Other / not sure / general  ### Related Issues / PRs  Thanks to mdrxy for #38042 and #38222, which keep `FALLBACK_MODELS_WITH_STRUCTURED_OUTPUT` current and already match Bedrock-style IDs such as `openai.gpt-5.4-mini`. The `gpt-6` family is not covered yet. OpenAI GPT-6 Sol and Luna became available on Amazon Bedrock on 2026-09-22.  - #38220 was the same f
  **Post-Mortem & Fix Analysis**:
  > Thanks for keeping `FALLBACK_MODELS_WITH_STRUCTURED_OUTPUT` current (#38042, #38222). Here is the approach I'd like to take, for your review before I open a PR.  **Proposed change:** add one `gpt-6` pattern next to `gpt-5.5` in `langchain/agents/factory.py`, so `create_agent` picks the provider strategy for GPT-6 IDs that have no profile data (for example `us.openai.gpt-6-sol` on Bedrock). Models with profile data still use their profile, and every existing pattern is unchanged. It's one source line plus test rows.  | `create_agent(..., response_format=Weather)` | Before | After | |---|---|---| | `ChatBedrockConverse`, `us.openai.gpt-6-sol` | `GraphRecursionError` (15/15 runs) | `Weather(...)` in 2 model calls | | `ChatOpenAI` chat completions, Sol/Luna/Astra | 400 `Function tools with reasoning_effort are not supported` (10/10) | `json_schema`, 1 call (10/10) | | Existing patterns, models with profile data | ✅ | ✅ unchanged |  The branch is here, if a look at the diff helps: [compare]

- **Issue #40807** (2026-09-25): **core: docstring examples use nonexistent imports, retired Claude models and invalid `openai:` model strings**
  *Symptoms*: ### Submission checklist  - [x] This is a bug, not a usage question. - [x] I added a clear and descriptive title that summarizes this issue. - [x] I used the GitHub search to find a similar question and didn't find it. - [x] I am sure that this is a bug in LangChain rather than my code. - [x] The bug is not resolved by updating to the latest stable version of LangChain (or the specific integration package). - [x] This is not related to the langchain-community package. - [x] I posted a self-contained, minimal, reproducible example. A maintainer can copy it and run it AS IS.  ### Package (Required)  - [ ] langchain - [ ] langchain-openai - [ ] langchain-anthropic - [ ] langchain-classic - [x] langchain-core - [ ] langchain-model-profiles - [ ] langchain-tests - [ ] langchain-text-splitters - [ ] langchain-chroma - [ ] langchain-deepseek - [ ] langchain-exa - [ ] langchain-fireworks - [ ] langchain-groq - [ ] langchain-huggingface - [ ] langchain-mistralai - [ ] langchain-nomic - [ ] langchain-ollama - [ ] langchain-openrouter - [ ] langchain-perplexity - [ ] langchain-qdrant - [ ] langchain-typesafe - [ ] langchain-xai - [ ] Other / not sure / general  ### Related Issues / PRs  * #37487 (same cleanup for OpenAI model names) * langchain-ai/docs#4071 (reported part of this in the docs repo)  ### Reproduction Steps / Example Code (Python)  ```python import importlib  from langchain_openai import ChatOpenAI  # 1. Import paths used in the docstring examples of #    FewShotChatMessag
  **Post-Mortem & Fix Analysis**:
  > I had this ready in PR #40815 (now auto-closed for missing assignment) — apologies for opening before being assigned, I missed that step for this repo.  The fix covers all eleven spots the issue lists across seven files: the `langchain_core.chat_models` imports (which don't exist), the `openai:` prefix passed to `ChatOpenAI`, and the retired `claude-2` / `claude-3-haiku-20240307` / `claude-sonnet-4-5-20250929` / `claude-sonnet-4-6` IDs. The `configurable_alternatives` spot was already fixed upstream, so I left it. Branch: `yuee3:docs/core-docstring-model-ids`, based on current `master`.  Could I be assigned so the PR can be reopened? Happy to adjust approach if maintainers would rather wait.
  > Thanks @yuee3. As mentioned in the issue, I'd like to take this one myself and have been waiting for assignment before opening a PR, per the contributing guide. I can open it as soon as I'm assigned.  One note: the configurable_alternatives example in runnables/base.py still uses claude-sonnet-4-5-20250929 on current master (5704d9d48), so it still needs updating. That makes 8 files in total.  Happy to go with whatever the maintainers prefer.

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

### Incident Patch 1: `6564f7e0` (2026-10-05)
**Commit Message**: fix(huggingface): hide `huggingfacehub_api_token` from `repr` (#41047)

**File**: `libs/partners/huggingface/langchain_huggingface/llms/huggingface_endpoint.py` (modified, +2/-1)
```diff
@@ -108,7 +108,8 @@ class HuggingFaceEndpoint(LLM):
         available providers can be found in the [huggingface_hub documentation](https://huggingface.co/docs/huggingface_hub/guides/inference#supported-providers-and-tasks)."""
 
     huggingfacehub_api_token: str | None = Field(
-        default_factory=from_env("HUGGINGFACEHUB_API_TOKEN", default=None)
+        default_factory=from_env("HUGGINGFACEHUB_API_TOKEN", default=None),
+        repr=False,
     )
 
     max_new_tokens: int = 512
```

**File**: `libs/partners/huggingface/tests/unit_tests/test_huggingface_endpoint.py` (modified, +21/-0)
```diff
@@ -76,3 +76,24 @@ def test_huggingface_hosted_endpoint_keeps_api_key(
 
     call_kwargs = mock_inference_client.call_args[1]
     assert call_kwargs.get("api_key") == "hf_xxx"
+
+
+@patch("huggingface_hub.AsyncInferenceClient")
+@patch("huggingface_hub.InferenceClient")
+def test_api_token_not_in_repr_or_serialized(
+    mock_inference_client: MagicMock,
+    mock_async_client: MagicMock,
+) -> None:
+    """The token must not leak via `repr`, which tracers receive as `serialized`."""
+    mock_inference_client.return_value = MagicMock()
+    mock_async_client.return_value = MagicMock()
+
+    llm = HuggingFaceEndpoint(  # type: ignore[call-arg]
+        endpoint_url="https://abc.huggingface.co/inference",
+        huggingfacehub_api_token="hf_secret_token",  # noqa: S106
+    )
+
+    assert "hf_secret_token" not in repr(llm)
+    assert "hf_secret_token" not in str(llm._serialized)
+    # Still handed to the client.
+    assert mock_inference_client.call_args[1]["api_key"] == "hf_secret_token"
```

---

### Incident Patch 2: `ff46bb47` (2026-10-02)
**Commit Message**: fix(ollama): raise ollama floor to 0.6.3 for thinking levels (#40986)

Fixes #40985

---

`ChatOllama(reasoning="xhigh")` currently raises a Pydantic
`ValidationError` instead of reaching Ollama, because the `ollama` floor
still admits clients that reject model-defined thinking levels.

`ChatOllama.reasoning` is `bool | str | None` and `_chat_params()`
forwards the string verbatim as `think`. Since ollama 0.6.3
(ollama/ollama-python#744) `ChatRequest.think` is `Optional[Union[bool,
str]]`, matching the Ollama Go backend. But the declared range
`ollama>=0.6.1,<1.0.0` still admits 0.6.1 and 0.6.2, where the
annotation is `Optional[Union[bool, Literal["low", "medium", "high"]]]`
and `"xhigh"` or `"max"` fails validation client-side.

Verified both directions on the same snippet —
`ChatOllama(reasoning="xhigh")._chat_params(...)["think"] == "xhigh"`,
then constructing `ChatRequest(..., think=...)`:

- ollama 0.6.2 → `ValidationError` on `think.bool` and
`think.literal['low','medium','high']`
- ollama 0.6.3 → validates

This raises the floor only; no `ChatOllama` code path changes. Narrowing
`reasoning` inside `ChatOllama` instead would reject levels the Ollama
backend accepts and dupli

**File**: `libs/partners/ollama/pyproject.toml` (modified, +1/-1)
```diff
@@ -23,7 +23,7 @@ classifiers = [
 version = "1.1.0"
 requires-python = ">=3.10.0,<4.0.0"
 dependencies = [
-    "ollama>=0.6.1,<1.0.0",
+    "ollama>=0.6.3,<1.0.0",
     "langchain-core>=1.4.7,<2.0.0",
 ]
 
```

---

### Incident Patch 3: `ce906613` (2026-09-29)
**Commit Message**: fix(anthropic): support Claude Sonnet 5.5 compatibility (#40882)

Co-authored-by: Hunter Lovell <[REDACTED_EMAIL]>
Co-authored-by: open-swe[bot] <[REDACTED_EMAIL]>
Co-authored-by: ccurme <[REDACTED_EMAIL]>
Co-authored-by: Chester Curme <[REDACTED_EMAIL]>

**File**: `libs/core/langchain_core/messages/ai.py` (modified, +1/-2)
```diff
@@ -617,8 +617,7 @@ def init_server_tool_calls(self) -> Self:
                     isinstance(block, dict)
                     and block.get("type")
                     in {"server_tool_call", "server_tool_call_chunk"}
-                    and (args_str := block.get("args"))
-                    and isinstance(args_str, str)
+                    and isinstance(args_str := block.get("args") or "{}", str)
                 ):
                     try:
                         args = json.loads(args_str)
```

**File**: `libs/core/langchain_core/messages/block_translators/anthropic.py` (modified, +6/-6)
```diff
@@ -286,8 +286,9 @@ def _iter_blocks() -> Iterator[types.ContentBlock]:
                         args=chunk.get("args"),
                         type="tool_call_chunk",
                     )
-                    if "caller" in block:
-                        tool_call_chunk["extras"] = {"caller": block["caller"]}
+                    for key in ("caller", "toolset_name"):
+                        if key in block:
+                            tool_call_chunk.setdefault("extras", {})[key] = block[key]
 
                     index = chunk.get("index")
                     if index is not None:
@@ -322,10 +323,9 @@ def _iter_blocks() -> Iterator[types.ContentBlock]:
                         }
                     if "index" in block:
                         tool_call_block["index"] = block["index"]
-                    if "caller" in block:
-                        if "extras" not in tool_call_block:
-                            tool_call_block["extras"] = {}
-                        tool_call_block["extras"]["caller"] = block["caller"]
+                    for key in ("caller", "toolset_name"):
+                        if key in block:
+                            tool_call_block.setdefault("extras", {})[key] = block[key]
 
                     yield tool_call_block
 
```

**File**: `libs/core/tests/unit_tests/messages/block_translators/test_anthropic.py` (modified, +31/-0)
```diff
@@ -572,3 +572,34 @@ def test_convert_to_v1_from_anthropic_malformed_citations() -> None:
             ],
         },
     ]
+
+
+def test_toolset_namespace_in_content_blocks() -> None:
+    block = {
+        "type": "tool_use",
+        "id": "call_1",
+        "name": "click",
+        "input": {},
+        "toolset_name": "computer",
+    }
+    metadata = {"model_provider": "anthropic"}
+    message = AIMessage([block], response_metadata=metadata)
+    content_block = message.content_blocks[0]
+    assert content_block["type"] == "tool_call"
+    assert content_block["extras"]["toolset_name"] == "computer"
+    chunk = AIMessageChunk(
+        content=[{**block, "index": 0}],
+        tool_call_chunks=[
+            {
+                "type": "tool_call_chunk",
+                "id": "call_1",
+                "name": "click",
+                "args": "{}",
+                "index": 0,
+            }
+        ],
+        response_metadata=metadata,
+    )
+    chunk_block = chunk.content_blocks[0]
+    assert chunk_block["type"] == "tool_call_chunk"
+    assert chunk_block["extras"]["toolset_name"] == "computer"
```

**File**: `libs/core/tests/unit_tests/messages/test_ai.py` (modified, +12/-0)
```diff
@@ -423,6 +423,18 @@ def test_content_blocks() -> None:
         {"type": "server_tool_call", "name": "foo", "index": 0, "args": {"a": 1}}
     ]
 
+    # Server tool calls with no input stream no args
+    empty_args_chunk = AIMessageChunk(
+        content=[
+            {"type": "server_tool_call_chunk", "index": 0, "name": "foo", "args": ""}
+        ]
+    ) + AIMessageChunk(
+        content=[], chunk_position="last", response_metadata={"output_version": "v1"}
+    )
+    assert empty_args_chunk.content == [
+        {"type": "server_tool_call", "name": "foo", "index": 0, "args": {}}
+    ]
+
     # Test non-standard + non-standard
     chunk_1 = AIMessageChunk(
         content=[
```

**File**: `libs/partners/anthropic/README.md` (modified, +21/-0)
```diff
@@ -31,6 +31,27 @@ As an open-source project in a rapidly developing field, we are extremely open t
 
 For detailed information on how to contribute, see the [Contributing Guide](https://docs.langchain.com/oss/python/contributing/overview).
 
+## Migrating to Claude Sonnet 5.5
+
+```python
+from langchain_anthropic import ChatAnthropic
+
+model = ChatAnthropic(
+    model="claude-sonnet-5-5",
+    max_tokens=16000,
+    output_config={"effort": "medium"},
+)
+```
+
+- Use `with_structured_output(schema, method="json_schema")` for native structured output. Sonnet 5.5 rejects forced tool choice (`"any"` or a tool name). Function-calling structured output does not force a call and raises a parsing error if the model answers without one.
+- Thinking is adaptive by default. For no up-front thinking, use `thinking={"type": "between_tools"}` at `high` effort or below, with no additional thinking fields. `disabled` and budgeted `enabled` thinking are unsupported.
+- Omit sampling settings; non-default `temperature`, `top_p`, and `top_k` are rejected. Budget output tokens for both thinking and text.
+- Preserve signed thinking blocks, including empty ones, and keep history append-only. Use mid-conversation system messages to change instructions or tools rather than editing earlier turns.
+- Progress updates can arrive as thinking blocks. Use adaptive thinking with `display="summarized"` or `display="updates"` to display them; the latter's beta header is added automatically.
+- Computer use on the direct Claude API requires `computer_toolset_20260801`. Preserve the returned tool-use content: its `toolset_name` is retained on replay and copied to matching tool results. Remove the old fine-grained streaming beta when using toolsets.
+
+See the [migration guide](https://platform.claude.com/docs/en/models/sonnet-5-5/migration-guide) for platform-specific restrictions, advisor pairings, and refusal/fallback behavior.
+
 ## Resources
 
 - [LangChain Academy](https://academy.langchain.com/) — comprehensive, free courses on LangChain libraries and products, made by the LangChain team
```

**File**: `libs/partners/anthropic/langchain_anthropic/_compat.py` (modified, +8/-2)
```diff
@@ -129,8 +129,9 @@ def _convert_from_v1_to_anthropic(
                 "input": block.get("args", {}),
                 "id": block.get("id", ""),
             }
-            if "caller" in block.get("extras", {}):
-                tool_use_block["caller"] = block["extras"]["caller"]
+            for key in ("caller", "toolset_name"):
+                if key in block.get("extras", {}):
+                    tool_use_block[key] = block["extras"][key]
             new_content.append(tool_use_block)
 
         elif block["type"] == "tool_call_chunk":
@@ -147,6 +148,11 @@ def _convert_from_v1_to_anthropic(
                     "name": block.get("name", ""),
                     "input": input_,
                     "id": block.get("id", ""),
+                    **{
+                        key: block["extras"][key]
+                        for key in ("caller", "toolset_name")
+                        if key in block.get("extras", {})
+                    },
                 }
             )
 
```

**File**: `libs/partners/anthropic/langchain_anthropic/chat_models.py` (modified, +39/-9)
```diff
@@ -720,6 +720,7 @@ def _format_messages(
     """Format messages for Anthropic's API."""
     system: str | list[dict] | None = None
     formatted_messages: list[dict] = []
+    toolsets: dict[str, str] = {}
     merged_messages = _merge_messages(messages)
     last_non_system_index = max(
         (i for i, m in enumerate(merged_messages) if m.type != "system"),
@@ -795,11 +796,13 @@ def _format_messages(
                                 for tc in message.tool_calls
                                 if tc["id"] == block["id"]
                             ]
-                            content.extend(
-                                _lc_tool_calls_to_anthropic_tool_use_blocks(
-                                    overlapping,
-                                ),
+                            tool_blocks = _lc_tool_calls_to_anthropic_tool_use_blocks(
+                                overlapping,
                             )
+                            if toolset_name := block.get("toolset_name"):
+                                for tool_block in tool_blocks:
+                                    tool_block["toolset_name"] = toolset_name
+                            content.extend(tool_blocks)
                         else:
                             if tool_input := block.get("input"):
                                 args = tool_input
@@ -818,6 +821,8 @@ def _format_messages(
                             )
                             if caller := block.get("caller"):
                                 tool_use_block["caller"] = caller
+                            if toolset_name := block.get("toolset_name"):
+                                tool_use_block["toolset_name"] = toolset_name
                             content.append(tool_use_block)
                     elif block["type"] in ("server_tool_use", "mcp_tool_use"):
                         formatted_block = {
@@ -944,6 +949,8 @@ def _format_messages(
                                 },
                             ),
                         )
+                    elif block["type"] == "advisor_tool_result":
+                        content.append({k: v for k, v in block.items() if k != "index"})
                     else:
                         content.append(block)
                 else:
@@ -1036,6 +1043,16 @@ def _format_messages(
                     system = _format_system_content(pending.content, model=model)
                     _warn_system_message_hoisted(model)
             pending_system = []
+        if isinstance(content, list):
+            for block in content:
+                if not isinstance(block, dict):
+                    continue
+                if block.get("type") == "tool_use" and block.get("toolset_name"):
+                    toolsets[block["id"]] = block["toolset_name"]
+                elif block.get("type") == "tool_result" and (
+                    toolset_name := toolsets.get(block.get("tool_use_id", ""))
+                ):
+                    block.setdefault("toolset_name", toolset_name)
         formatted_messages.append({"role": role, "content": content})
 
     formatted_messages.extend(
@@ -1136,13 +1153,16 @@ def _supports_mid_conversation_system_messages(model: object) -> bool:
             "claude-mythos-5",
             "claude-opus-4-8",
             "claude-opus-5",
+            "claude-sonnet-5-5",
         )
     )
 
 
 def _supports_forced_tool_choice(model: str) -> bool:
     """Return whether the model accepts `tool_choice` types `any` and `tool`."""
-    return not model.startswith(("claude-fable-5-1", "claude-opus-5-5"))
+    return not model.startswith(
+        ("claude-fable-5-1", "claude-opus-5-5", "claude-sonnet-5-5")
+    )
 
 
 def _is_direct_anthropic_llm_type(llm_type: object) -> bool:
@@ -1793,7 +1813,8 @@ def _assert_valid_model_configuration(self, kwargs: Mapping[str, Any]) -> None:
             output_config["effort"] = effort
 
         is_fable_model = self.model.startswith("claude-fable-5")
-        if is_fable_model:
+        is_sonnet_55 = self.model.startswith("claude-sonnet-5-5")
+        if is_fable_model or is_sonnet_55:
             top_k = request_config.get("top_k", self.top_k)
             top_p = request_config.get("top_p", self.top_p)
             temperature = request_config.get("temperature", self.temperature)
@@ -1819,7 +1840,7 @@ def _assert_valid_model_configuration(self, kwargs: Mapping[str, Any]) -> None:
                 raise ValueError(msg)
 
         if (
-            (self.model.startswith("claude-opus-5") or is_fable_model)
+            (self.model.startswith("claude-opus-5") or is_fable_model or is_sonnet_55)
             and isinstance(thinking, Mapping)
             and thinking.get("type") == "enabled"
         ):
@@ -2331,6 +2352,12 @@ def _make_message_chunk_from_anthropic_event(
                 warnings.warn("Received unexpected tool content block.", stacklevel=2)
 
             content_block = event.content_block.model_dump()
+           
```

**File**: `libs/partners/anthropic/langchain_anthropic/data/_profiles.py` (modified, +35/-0)
```diff
@@ -488,4 +488,39 @@
         ],
         "reasoning_effort_default": "high",
     },
+    "claude-sonnet-5-5": {
+        "name": "Claude Sonnet 5.5",
+        "release_date": "2026-09-28",
+        "last_updated": "2026-09-28",
+        "open_weights": False,
+        "max_input_tokens": 1000000,
+        "max_output_tokens": 128000,
+        "text_inputs": True,
+        "image_inputs": True,
+        "audio_inputs": False,
+        "pdf_inputs": True,
+        "video_inputs": False,
+        "text_outputs": True,
+        "image_outputs": False,
+        "audio_outputs": False,
+        "video_outputs": False,
+        "reasoning_output": True,
+        "tool_calling": True,
+        "structured_output": True,
+        "attachment": True,
+        "temperature": False,
+        "image_url_inputs": True,
+        "pdf_tool_message": True,
+        "image_tool_message": True,
+        "tool_call_streaming": True,
+        "tool_choice": False,
+        "reasoning_effort_levels": [
+            "low",
+            "medium",
+            "high",
+            "xhigh",
+            "max",
+        ],
+        "reasoning_effort_default": "high",
+    },
 }
```

---

### Incident Patch 4: `78a3cbcc` (2026-09-28)
**Commit Message**: hotfix(fireworks): replace unavailable integration test model (#40890)

The [Fireworks release
job](https://github.com/langchain-ai/langchain/actions/runs/36479033898/job/109120052547)
failed 55 tests because `kimi-k2p6` returned `404 NOT_FOUND`; the
`gpt-oss-120b` chat tests passed in that same job.

- Use `accounts/fireworks/models/gpt-oss-120b` across the affected chat,
completions, and standard integration tests, reusing the existing
chat-model constant.
- Preserve all assertions and coverage; leave production defaults and
release workflows unchanged.
- Fireworks [advertises GPT-OSS-120B as
serverless](https://fireworks.ai/models/fireworks/gpt-oss-120b). Live
completions and expanded chat coverage still need confirmation with CI
credentials: no Fireworks API key is available locally. This is not
evidence that Kimi was retired.

Made by [Open SWE](https://github.com/langchain-ai/open-swe) · [view
thread](https://openswe.langchain.dev/agents/b8a0feec-8262-501b-8d6f-204f467461e3)
· openai:gpt-6-astra (medium)

Co-authored-by: Mason Daugherty <[REDACTED_EMAIL]>
Co-authored-by: open-swe[bot] <[REDACTED_EMAIL]>

**File**: `libs/partners/fireworks/tests/integration_tests/test_chat_models.py` (modified, +5/-13)
```diff
@@ -22,9 +22,7 @@
 @pytest.mark.parametrize("strict", [None, True, False])
 def test_tool_choice_bool(strict: bool | None) -> None:  # noqa: FBT001
     """Test that tool choice is respected with different strict values."""
-    llm = ChatFireworks(
-        model="accounts/fireworks/models/kimi-k2p6", rate_limiter=rate_limiter
-    )
+    llm = ChatFireworks(model=_MODEL, rate_limiter=rate_limiter)
 
     class MyTool(BaseModel):
         name: str
@@ -62,9 +60,7 @@ class MyTool(BaseModel):
 
 async def test_astream() -> None:
     """Test streaming tokens from ChatFireworks."""
-    llm = ChatFireworks(
-        model="accounts/fireworks/models/kimi-k2p6", rate_limiter=rate_limiter
-    )
+    llm = ChatFireworks(model=_MODEL, rate_limiter=rate_limiter)
 
     full: BaseMessageChunk | None = None
     chunks_with_token_counts = 0
@@ -162,9 +158,7 @@ def validate_joke_dict(result: Any) -> bool:
 
 @pytest.mark.parametrize("schema_type", ["pydantic", "typeddict", "json_schema"])
 def test_structured_output_json_schema(schema_type: str) -> None:
-    llm = ChatFireworks(
-        model="accounts/fireworks/models/kimi-k2p6", rate_limiter=rate_limiter
-    )
+    llm = ChatFireworks(model=_MODEL, rate_limiter=rate_limiter)
     schema, validation_function = _get_joke_class(schema_type)  # type: ignore[arg-type]
     chat = llm.with_structured_output(schema, method="json_schema")
 
@@ -183,7 +177,7 @@ def test_structured_output_json_schema(schema_type: str) -> None:
 def test_reasoning_effort_parameter() -> None:
     """Test that the standard `reasoning_effort` parameter is accepted by the API."""
     llm = ChatFireworks(
-        model="accounts/fireworks/models/kimi-k2p6",
+        model=_MODEL,
         reasoning_effort="high",
         rate_limiter=rate_limiter,
     )
@@ -199,9 +193,7 @@ def test_reasoning_effort_parameter() -> None:
 
 def test_reasoning_effort_call_time_kwarg() -> None:
     """Test that `reasoning_effort` is accepted as a call-time kwarg."""
-    llm = ChatFireworks(
-        model="accounts/fireworks/models/kimi-k2p6", rate_limiter=rate_limiter
-    )
+    llm = ChatFireworks(model=_MODEL, rate_limiter=rate_limiter)
 
     result = llm.invoke("Say hello in one sentence", reasoning_effort="high")
 
```

**File**: `libs/partners/fireworks/tests/integration_tests/test_llms.py` (modified, +1/-1)
```diff
@@ -13,7 +13,7 @@
 
 from langchain_fireworks import Fireworks
 
-_MODEL = "accounts/fireworks/models/kimi-k2p6"
+_MODEL = "accounts/fireworks/models/gpt-oss-120b"
 
 
 def test_fireworks_call() -> None:
```

**File**: `libs/partners/fireworks/tests/integration_tests/test_standard.py` (modified, +1/-1)
```diff
@@ -19,7 +19,7 @@ def chat_model_class(self) -> type[BaseChatModel]:
     @property
     def chat_model_params(self) -> dict:
         return {
-            "model": "accounts/fireworks/models/kimi-k2p6",
+            "model": "accounts/fireworks/models/gpt-oss-120b",
             "temperature": 0,
             "rate_limiter": rate_limiter,
         }
```

---

### Incident Patch 5: `2ade674f` (2026-09-28)
**Commit Message**: fix(langchain): sanitize cache settings for fallback models (#40886)

`ModelFallbackMiddleware` now removes unsupported cache keys and
Fireworks session-affinity headers before fallback attempts, while
preserving cache settings supported by the selected fallback model.

---

When an agent falls back to another provider, explicitly supplied cache
settings in `ModelRequest.model_settings` can reach a model that does
not accept them and cause the fallback to fail.

`ModelFallbackMiddleware` now removes `x-session-affinity` for
non-Fireworks fallbacks and removes `prompt_cache_key` for providers
outside Fireworks, OpenAI, and Azure OpenAI. It preserves unrelated
settings and headers, retains the existing Anthropic cache-marker
handling, and leaves the original request unchanged. Unit tests cover
synchronous and asynchronous fallback, supported cache-key preservation,
and header cleanup.

Stacked on #38823. This PR contains only the fallback cleanup and its
tests. The Fireworks middleware in the base PR works independently
because its generated affinity is consumed directly by `ChatFireworks`.

Review focus: provider support is determined through `_llm_type`;
`prompt_cache_key` is share

**File**: `libs/langchain_v1/langchain/agents/middleware/model_fallback.py` (modified, +94/-39)
```diff
@@ -1,21 +1,19 @@
 """Model fallback middleware for agents.
 
-When a caching middleware such as `AnthropicPromptCachingMiddleware` wraps this
-middleware from the outside, it applies Anthropic `cache_control` markers to the
-request *before* the fallback loop runs. Those markers are provider-specific and
-cause API errors on non-Anthropic fallback models, so this middleware strips them
-from fallback attempts — but only when the fallback model itself cannot accept
-Anthropic cache markers. When the fallback is another Anthropic model the markers
-are valid and preserve prompt caching, so they are left intact.
-
-The knowledge of the `cache_control` marker is duplicated here (rather than owned
-solely by the Anthropic partner package) because an outer caching middleware
-never re-runs during fallback and therefore cannot clean up after itself.
+When an outer caching middleware modifies a request, those changes happen before
+the fallback loop runs. Provider-specific cache settings can cause API errors if
+the loop reuses them with a different provider. This middleware therefore strips
+unsupported Anthropic and Fireworks cache settings from each fallback attempt,
+while preserving settings accepted by the selected fallback.
+
+This provider knowledge lives here because an outer caching middleware never
+re-runs during fallback and therefore cannot clean up after itself.
 """
 
 from __future__ import annotations
 
 import logging
+from collections.abc import Mapping
 from typing import TYPE_CHECKING, Any
 
 from langchain_core.tools import BaseTool
@@ -39,6 +37,9 @@
 
 logger = logging.getLogger(__name__)
 
+_FIREWORKS_LLM_TYPE = "fireworks-chat"
+_FIREWORKS_SESSION_AFFINITY_HEADER = "x-session-affinity"
+
 
 def _sanitize_content_blocks(
     content: str | list[str | dict[str, Any]],
@@ -109,33 +110,56 @@ def _sanitize_tools(
     return sanitized_tools if changed else tools
 
 
-def _sanitize_request_for_fallback(request: ModelRequest[ContextT]) -> ModelRequest[ContextT]:
-    """Sanitize provider-specific Anthropic cache markers before fallback attempts."""
+def _sanitize_request_for_fallback(
+    request: ModelRequest[ContextT],
+    fallback_model: BaseChatModel | None = None,
+) -> ModelRequest[ContextT]:
+    """Sanitize provider-specific cache settings before a fallback attempt."""
     overrides: dict[str, Any] = {}
+    supports_anthropic_cache = _supports_anthropic_cache_control(fallback_model)
+
+    model_settings = request.model_settings
+    model_settings_changed = False
+
+    if not supports_anthropic_cache:
+        model_settings, cache_control_changed = _without_cache_control(model_settings)
+        model_settings_changed = model_settings_changed or cache_control_changed
+
+    if not _supports_fireworks_prompt_cache(fallback_model):
+        model_settings, fireworks_cache_changed = _without_fireworks_session_affinity(
+            model_settings
+        )
+        model_settings_changed = model_settings_changed or fireworks_cache_changed
+
+    if not _supports_prompt_cache_key(fallback_model) and "prompt_cache_key" in model_settings:
+        model_settings = {
+            key: value for key, value in model_settings.items() if key != "prompt_cache_key"
+        }
+        model_settings_changed = True
 
-    model_settings, model_settings_changed = _without_cache_control(request.model_settings)
     if model_settings_changed:
         overrides["model_settings"] = model_settings
 
-    system_message = _sanitize_system_message(request.system_message)
-    if system_message is not request.system_message:
-        overrides["system_message"] = system_message
+    if not supports_anthropic_cache:
+        system_message = _sanitize_system_message(request.system_message)
+        if system_message is not request.system_message:
+            overrides["system_message"] = system_message
 
-    messages = _sanitize_messages(request.messages)
-    if messages is not request.messages:
-        overrides["messages"] = messages
+        messages = _sanitize_messages(request.messages)
+        if messages is not request.messages:
+            overrides["messages"] = messages
 
-    tools = _sanitize_tools(request.tools)
-    if tools is not request.tools:
-        overrides["tools"] = tools
+        tools = _sanitize_tools(request.tools)
+        if tools is not request.tools:
+            overrides["tools"] = tools
 
     if not overrides:
         return request
 
     # Log only the field names that changed, never request content (may contain
     # prompt data or PII).
     logger.debug(
-        "Stripped Anthropic cache_control markers from %s before fallback attempt",
+        "Stripped provider-specific cache settings from %s before fallback attempt",
         sorted(overrides),
     )
 
@@ -208,6 +232,30 @@ def _without_cache_control(payload: dict[str, Any]) -> tuple[dict[str, Any], boo
     )
 
 
+def _without_fireworks_session_affinity(
+    model_settings: dict[str, Any],
+) -> 
```

**File**: `libs/langchain_v1/tests/unit_tests/agents/middleware/implementations/test_model_fallback.py` (modified, +163/-2)
```diff
@@ -11,6 +11,7 @@
 from langchain_core.messages import AIMessage, BaseMessage, HumanMessage, SystemMessage
 from langchain_core.outputs import ChatGeneration, ChatResult
 from langchain_core.tools import BaseTool, tool
+from langchain_openai import AzureChatOpenAI, ChatOpenAI
 from langgraph.errors import GraphInterrupt
 from typing_extensions import override
 
@@ -128,6 +129,31 @@ def cached_tool(query: str) -> str:
     )
 
 
+def _make_request_with_fireworks_cache_settings(
+    primary_model: BaseChatModel,
+) -> ModelRequest:
+    """Create a request with Fireworks prompt-cache affinity settings."""
+    return _make_request().override(
+        model=primary_model,
+        model_settings={
+            "temperature": 0.3,
+            "prompt_cache_key": "thread-123",
+            "extra_headers": {
+                "X-Request-ID": "request-123",
+                "X-Session-Affinity": "thread-123",
+            },
+        },
+    )
+
+
+def _assert_fireworks_cache_settings_removed(request: ModelRequest) -> None:
+    """Assert Fireworks affinity is removed while unrelated settings remain."""
+    assert request.model_settings == {
+        "temperature": 0.3,
+        "extra_headers": {"X-Request-ID": "request-123"},
+    }
+
+
 def _assert_request_has_cache_markers(request: ModelRequest) -> None:
     """Assert request still contains Anthropic-style cache markers."""
     assert "cache_control" in request.model_settings
@@ -313,6 +339,54 @@ async def mock_handler(req: ModelRequest) -> ModelResponse:
     _assert_request_has_cache_markers(request)
 
 
+def test_fallback_removes_fireworks_cache_settings_sync() -> None:
+    """A non-Fireworks fallback should not receive Fireworks cache settings."""
+    primary_model = GenericFakeChatModel(messages=iter([]))
+    fallback_model = GenericFakeChatModel(messages=iter([]))
+    middleware = ModelFallbackMiddleware(fallback_model)
+    request = _make_request_with_fireworks_cache_settings(primary_model)
+    attempts: list[ModelRequest] = []
+
+    def mock_handler(req: ModelRequest) -> ModelResponse:
+        attempts.append(req)
+        if len(attempts) == 1:
+            msg = "Primary model failed"
+            raise ValueError(msg)
+
+        assert req.model is fallback_model
+        _assert_fireworks_cache_settings_removed(req)
+        return ModelResponse(result=[AIMessage(content="fallback response")])
+
+    middleware.wrap_model_call(request, mock_handler)
+
+    assert len(attempts) == 2
+    assert request.model_settings["prompt_cache_key"] == "thread-123"
+
+
+async def test_fallback_removes_fireworks_cache_settings_async() -> None:
+    """Async non-Fireworks fallback should not receive Fireworks cache settings."""
+    primary_model = GenericFakeChatModel(messages=iter([]))
+    fallback_model = GenericFakeChatModel(messages=iter([]))
+    middleware = ModelFallbackMiddleware(fallback_model)
+    request = _make_request_with_fireworks_cache_settings(primary_model)
+    attempts: list[ModelRequest] = []
+
+    async def mock_handler(req: ModelRequest) -> ModelResponse:
+        attempts.append(req)
+        if len(attempts) == 1:
+            msg = "Primary model failed"
+            raise ValueError(msg)
+
+        assert req.model is fallback_model
+        _assert_fireworks_cache_settings_removed(req)
+        return ModelResponse(result=[AIMessage(content="fallback response")])
+
+    await middleware.awrap_model_call(request, mock_handler)
+
+    assert len(attempts) == 2
+    assert request.model_settings["prompt_cache_key"] == "thread-123"
+
+
 def test_sanitize_collapses_emptied_extras_to_none() -> None:
     """Stripping the only `extras` key (`cache_control`) resets `extras` to None."""
 
@@ -810,6 +884,14 @@ def _llm_type(self) -> str:
         return ["anthropic-chat"]  # type: ignore[return-value]
 
 
+class _FakeFireworksModel(GenericFakeChatModel):
+    """Fake model that reports the `ChatFireworks` `_llm_type`."""
+
+    @property
+    def _llm_type(self) -> str:
+        return "fireworks-chat"
+
+
 _ANTHROPIC_COMPATIBLE_FAKES = [
     _FakeAnthropicModel,
     _FakeBedrockAnthropicModel,
@@ -828,6 +910,85 @@ def test_supports_anthropic_cache_control() -> None:
     assert not _supports_anthropic_cache_control(_FakeNonStringLlmTypeModel(messages=iter([])))
 
 
+def test_fallback_preserves_fireworks_cache_settings_for_fireworks() -> None:
+    """A Fireworks fallback should keep Fireworks prompt-cache affinity settings."""
+    primary_model = _FakeFireworksModel(messages=iter([]))
+    fallback_model = _FakeFireworksModel(messages=iter([]))
+    middleware = ModelFallbackMiddleware(fallback_model)
+    request = _make_request_with_fireworks_cache_settings(primary_model)
+    attempts: list[ModelRequest] = []
+
+    def mock_handler(req: ModelRequest) -> ModelResponse:
+        attempts.append(req)
+        if len(attempts) == 1:
+            msg = "Primary model failed"
+            raise ValueError(msg)
+
+        asser
```

---

### Incident Patch 6: `60e57f5b` (2026-09-28)
**Commit Message**: fix(fireworks): classify mid-stream read timeouts (#40874)

`ChatFireworks` now reports mid-stream read timeouts as retryable
`ModelTimeoutError`s while remaining catchable as `httpx.ReadTimeout`.
Partial streams are not automatically replayed.

---

Fireworks stream read timeouts currently bypass LangChain's model-error
classification after the first chunk. Classify them as retryable
`ModelTimeoutError`s while preserving `httpx.ReadTimeout` compatibility,
the original cause, and request context when available.

- Covers synchronous and asynchronous stream consumption.
- Keeps setup retries unchanged. Does **not** replay partial streams:
doing so could duplicate text or corrupt tool-call arguments.
Whole-generation recovery remains the caller's responsibility.
- Built-in streaming retry and fallback behavior is unchanged:
`.with_retry()` does not retry streaming, and `.with_fallbacks()` only
switches models before the first chunk. Applications must explicitly
handle recovery after output has started.

Made by [Open SWE](https://github.com/langchain-ai/open-swe) · [view
thread](https://openswe.vercel.app/agents/c2ba7088-1448-5e4d-9541-ae6f25b513c7)
· openai:gpt-6-astra (medium)

Co-

**File**: `libs/partners/fireworks/langchain_fireworks/chat_models.py` (modified, +21/-3)
```diff
@@ -653,6 +653,18 @@ class FireworksTimeoutError(APITimeoutError, ModelTimeoutError):
     """Fireworks timeout error classified as a LangChain model error."""
 
 
+class FireworksReadTimeoutError(httpx.ReadTimeout, ModelTimeoutError):
+    """Fireworks stream read timeout classified as a retryable model error."""
+
+
+def _handle_stream_read_timeout(error: httpx.ReadTimeout) -> NoReturn:
+    try:
+        request = error.request
+    except RuntimeError:
+        request = None
+    raise FireworksReadTimeoutError(str(error), request=request) from error
+
+
 def _handle_fireworks_invalid_request(e: BadRequestError) -> NoReturn:
     """Promote prompt-too-long errors to `FireworksContextOverflowError`."""
     if "prompt is too long" in str(e):
@@ -815,13 +827,19 @@ async def _call() -> Any:
 
 def _prepend_chunk(first: Any, rest: Iterator[Any]) -> Iterator[Any]:
     yield first
-    yield from rest
+    try:
+        yield from rest
+    except httpx.ReadTimeout as e:
+        _handle_stream_read_timeout(e)
 
 
 async def _aprepend_chunk(first: Any, rest: AsyncIterator[Any]) -> AsyncIterator[Any]:
     yield first
-    async for item in rest:
-        yield item
+    try:
+        async for item in rest:
+            yield item
+    except httpx.ReadTimeout as e:
+        _handle_stream_read_timeout(e)
 
 
 class ChatFireworks(BaseChatModel):
```

**File**: `libs/partners/fireworks/tests/unit_tests/test_chat_models.py` (modified, +106/-7)
```diff
@@ -5,8 +5,9 @@
 import json
 import logging
 import os
+from collections.abc import AsyncIterator, Iterator
 from typing import Any
-from unittest.mock import MagicMock
+from unittest.mock import AsyncMock, MagicMock
 
 import httpx
 import pytest
@@ -841,7 +842,11 @@ def test_completion_with_retry_exhausts_and_raises() -> None:
     assert mock_client.create.call_count == 3
 
 
-def test_completion_with_retry_streaming_retries_on_setup() -> None:
+@pytest.mark.parametrize(
+    "error",
+    [_api_error(RateLimitError, "rate limited", 429), httpx.ReadTimeout("slow")],
+)
+def test_completion_with_retry_streaming_retries_on_setup(error: Exception) -> None:
     """Streaming errors raised during the first-chunk pull are retried."""
     llm = _make_llm(max_retries=1)
 
@@ -852,8 +857,7 @@ def _fail_then_stream(**_kwargs: Any) -> Any:
         if calls["n"] == 1:
 
             def _failing_gen() -> Any:
-                msg = "rate limited"
-                raise _api_error(RateLimitError, msg, 429)
+                raise error
                 yield  # pragma: no cover
 
             return _failing_gen()
@@ -994,7 +998,13 @@ def test_chat_fireworks_invoke_routes_through_retry() -> None:
     assert mock_client.create.call_count == 2
 
 
-async def test_acompletion_with_retry_streaming_retries_on_setup() -> None:
+@pytest.mark.parametrize(
+    "error",
+    [_api_error(RateLimitError, "rate limited", 429), httpx.ReadTimeout("slow")],
+)
+async def test_acompletion_with_retry_streaming_retries_on_setup(
+    error: Exception,
+) -> None:
     """Async streaming errors during the first-chunk pull are retried."""
     llm = _make_llm(max_retries=1)
     calls = {"n": 0}
@@ -1004,8 +1014,7 @@ async def _create(**_kwargs: Any) -> Any:
         if calls["n"] == 1:
 
             async def _failing_agen() -> Any:
-                msg = "rate limited"
-                raise _api_error(RateLimitError, msg, 429)
+                raise error
                 yield  # pragma: no cover
 
             return _failing_agen()
@@ -1546,6 +1555,96 @@ def test_extra_headers_forwarded_when_streaming(self) -> None:
         assert "extra_headers" not in call_kwargs.get("extra_body", {})
 
 
+@pytest.mark.parametrize("with_request", [False, True])
+@pytest.mark.parametrize("async_mode", [False, True])
+@pytest.mark.parametrize("tool_call", [False, True])
+async def test_midstream_read_timeout_is_classified_without_replay(
+    *, with_request: bool, async_mode: bool, tool_call: bool
+) -> None:
+    request = httpx.Request("POST", "https://api.fireworks.ai/inference/v1")
+    error = httpx.ReadTimeout(
+        "Timeout on reading data from socket",
+        request=request if with_request else None,
+    )
+    delta: dict[str, object] = (
+        {
+            "tool_calls": [
+                {
+                    "index": 0,
+                    "id": "call_1",
+                    "type": "function",
+                    "function": {"name": "lookup", "arguments": '{"query":'},
+                }
+            ]
+        }
+        if tool_call
+        else {"content": "Hello"}
+    )
+    chunk: dict[str, object] = {"choices": [{"delta": delta, "index": 0}]}
+
+    def _stream() -> Iterator[dict[str, object]]:
+        yield chunk
+        raise error
+
+    async def _astream() -> AsyncIterator[dict[str, object]]:
+        yield chunk
+        raise error
+
+    model = _make_llm(max_retries=2)
+    received: list[AIMessageChunk] = []
+    with pytest.raises(httpx.ReadTimeout) as exc_info:
+        if async_mode:
+            model.async_client = MagicMock(create=AsyncMock(return_value=_astream()))
+            async for message in model.astream("Hello"):
+                received.append(message)  # noqa: PERF401
+        else:
+            model.client = MagicMock(create=MagicMock(return_value=_stream()))
+            received.extend(model.stream("Hello"))
+
+    classified = exc_info.value
+    assert isinstance(classified, ModelTimeoutError)
+    assert classified.is_retryable
+    assert classified.__cause__ is error
+    assert str(classified) == str(error)
+    if with_request:
+        assert classified.request is request
+    else:
+        with pytest.raises(RuntimeError, match="request"):
+            _ = classified.request
+    assert len(received) == 1
+    if tool_call:
+        assert received[0].tool_call_chunks[0]["args"] == '{"query":'
+    else:
+        assert received[0].content == "Hello"
+    client = model.async_client if async_mode else model.client
+    client.create.assert_called_once()
+
+
+@pytest.mark.parametrize("async_mode", [False, True])
+async def test_midstream_non_timeout_propagates_unchanged(*, async_mode: bool) -> None:
+    error = ValueError("invalid stream")
+
+    def _stream() -> Iterator[dict[str, object]]:
+        yield {"choices": [{"delta": {"content": "Hello"}}]}
+        raise error
+
+    async def _astream() -> AsyncIterator[dict[str, object]]:
+        for chunk in 
```

---

### Incident Patch 7: `1ef23d6b` (2026-09-27)
**Commit Message**: fix(anthropic): serialize invalid tool calls as tool use on replay (#40864)

Co-authored-by: ccurme <[REDACTED_EMAIL]>
Co-authored-by: open-swe[bot] <[REDACTED_EMAIL]>
Co-authored-by: roshangardi <[REDACTED_EMAIL]>

**File**: `libs/partners/anthropic/langchain_anthropic/chat_models.py` (modified, +28/-2)
```diff
@@ -957,8 +957,9 @@ def _format_messages(
         else:
             content = message.content
 
-        # Ensure all tool_calls have a tool_use content block
-        if isinstance(message, AIMessage) and message.tool_calls:
+        if isinstance(message, AIMessage) and (
+            message.tool_calls or message.invalid_tool_calls
+        ):
             content = content or []
             content = (
                 [{"type": "text", "text": message.content}]
@@ -981,6 +982,31 @@ def _format_messages(
             cast("list", content).extend(
                 _lc_tool_calls_to_anthropic_tool_use_blocks(missing_tool_calls),
             )
+            tool_use_ids.extend(
+                cast("str", _normalize_tool_call_id(tc["id"]))
+                for tc in missing_tool_calls
+            )
+            for invalid_call in message.invalid_tool_calls:
+                tool_call_id = invalid_call.get("id")
+                tool_name = invalid_call.get("name")
+                if not tool_call_id or not tool_name:
+                    continue
+                normalized_id = _normalize_tool_call_id(tool_call_id)
+                if normalized_id in tool_use_ids:
+                    continue
+                try:
+                    args = json.loads(invalid_call.get("args") or "{}")
+                except json.JSONDecodeError:
+                    args = {}
+                cast("list", content).append(
+                    _AnthropicToolUse(
+                        type="tool_use",
+                        name=tool_name,
+                        input=args if isinstance(args, dict) else {},
+                        id=cast("str", normalized_id),
+                    )
+                )
+                tool_use_ids.append(normalized_id)
 
         if role == "assistant" and _i == last_non_system_index:
             if isinstance(content, str):
```

**File**: `libs/partners/anthropic/tests/unit_tests/test_chat_models.py` (modified, +54/-0)
```diff
@@ -4144,6 +4144,60 @@ def test_format_messages_preserves_nonempty_thinking_field() -> None:
     assert block["signature"] == "sig_xyz"
 
 
+@pytest.mark.parametrize(
+    ("args", "expected_input"),
+    [('{"city":', {}), ('{"city":"Paris"}', {"city": "Paris"}), ("[1]", {})],
+)
+def test_invalid_tool_call_retains_tool_use_for_error_result(
+    args: str, expected_input: dict[str, Any]
+) -> None:
+    tool_call_id = "toolu_invalid"
+    ai_message = AIMessage(
+        content=[{"type": "text", "text": "Calling tool"}],
+        invalid_tool_calls=[{"name": "get_weather", "args": args, "id": tool_call_id}],
+    )
+    tool_message = ToolMessage(
+        "Tool call arguments were malformed.",
+        tool_call_id=tool_call_id,
+        status="error",
+    )
+
+    _, messages = _format_messages(
+        [HumanMessage("Check the weather"), ai_message, tool_message],
+        model=MODEL_NAME,
+    )
+
+    assert messages[1]["content"] == [
+        {"type": "text", "text": "Calling tool"},
+        {
+            "type": "tool_use",
+            "name": "get_weather",
+            "input": expected_input,
+            "id": tool_call_id,
+        },
+    ]
+    assert messages[2]["content"][0]["tool_use_id"] == tool_call_id
+    assert messages[2]["content"][0]["is_error"] is True
+
+
+def test_invalid_tool_call_does_not_duplicate_existing_tool_use() -> None:
+    ai_message = AIMessage(
+        content=[
+            {"type": "tool_use", "name": "get_weather", "input": {}, "id": "toolu_1"}
+        ],
+        tool_calls=[{"name": "get_weather", "args": {}, "id": "toolu_2"}],
+        invalid_tool_calls=[
+            {"name": "get_weather", "args": "bad", "id": "toolu_1"},
+            {"name": "get_weather", "args": "bad", "id": "toolu_2"},
+            {"name": "get_weather", "args": "bad", "id": None},
+        ],
+    )
+
+    _, messages = _format_messages([ai_message], model=MODEL_NAME)
+
+    assert [block["id"] for block in messages[0]["content"]] == ["toolu_1", "toolu_2"]
+
+
 def test_v1_invalid_tool_call_retains_tool_use_for_error_result() -> None:
     """An error result must retain its Anthropic tool-use block on replay."""
     tool_call_id = "toolu_invalid"
```

---

### Incident Patch 8: `40fe8d6e` (2026-09-25)
**Commit Message**: docs(core): fix docstring examples that don't run as copied (#40815)

Co-authored-by: ccurme <[REDACTED_EMAIL]>
Co-authored-by: Aman Gupta <[REDACTED_EMAIL]>

**File**: `libs/core/langchain_core/messages/utils.py` (modified, +1/-1)
```diff
@@ -1289,7 +1289,7 @@ def trim_messages(
             messages,
             max_tokens=45,
             strategy="last",
-            token_counter=ChatOpenAI(model="openai:gpt-5.5"),
+            token_counter=ChatOpenAI(model="gpt-5.5"),
             # Most chat models expect that chat history starts with either:
             # (1) a HumanMessage or
             # (2) a SystemMessage followed by a HumanMessage
```

**File**: `libs/core/langchain_core/output_parsers/string.py` (modified, +1/-1)
```diff
@@ -19,7 +19,7 @@ class StrOutputParser(BaseTransformOutputParser[str]):
         from langchain_core.output_parsers import StrOutputParser
         from langchain_openai import ChatOpenAI
 
-        model = ChatOpenAI(model="openai:gpt-5.5")
+        model = ChatOpenAI(model="gpt-5.5")
         parser = StrOutputParser()
 
         # Get string output from a model
```

**File**: `libs/core/langchain_core/prompts/few_shot.py` (modified, +2/-2)
```diff
@@ -369,9 +369,9 @@ class FewShotChatMessagePromptTemplate(
         print(final_prompt.format_messages(input="What's 3+3?"))  # noqa: T201
 
         # Use within an LLM
-        from langchain_core.chat_models import ChatAnthropic
+        from langchain_anthropic import ChatAnthropic
 
-        chain = final_prompt | ChatAnthropic(model="claude-3-haiku-20240307")
+        chain = final_prompt | ChatAnthropic(model="claude-sonnet-5")
         chain.invoke({"input": "What's 3+3?"})
         ```
     """
```

**File**: `libs/core/langchain_core/rate_limiters.py` (modified, +1/-3)
```diff
@@ -105,9 +105,7 @@ class InMemoryRateLimiter(BaseRateLimiter):
 
         from langchain_anthropic import ChatAnthropic
 
-        model = ChatAnthropic(
-            model_name="claude-sonnet-4-5-20250929", rate_limiter=rate_limiter
-        )
+        model = ChatAnthropic(model_name="claude-sonnet-5", rate_limiter=rate_limiter)
 
         for _ in range(5):
             tic = time.time()
```

**File**: `libs/core/langchain_core/runnables/fallbacks.py` (modified, +5/-5)
```diff
@@ -52,10 +52,10 @@ class RunnableWithFallbacks(RunnableSerializable[Input, Output]):
 
     Example:
         ```python
-        from langchain_core.chat_models.openai import ChatOpenAI
-        from langchain_core.chat_models.anthropic import ChatAnthropic
+        from langchain_anthropic import ChatAnthropic
+        from langchain_openai import ChatOpenAI
 
-        model = ChatAnthropic(model="claude-sonnet-4-6").with_fallbacks(
+        model = ChatAnthropic(model="claude-sonnet-5").with_fallbacks(
             [ChatOpenAI(model="gpt-5.4-mini")]
         )
         # Will usually use ChatAnthropic, but fallback to ChatOpenAI
@@ -604,8 +604,8 @@ def __getattr__(self, name: str) -> Any:
             from langchain_openai import ChatOpenAI
             from langchain_anthropic import ChatAnthropic
 
-            gpt_55 = ChatOpenAI(model="openai:gpt-5.5")
-            claude_3_sonnet = ChatAnthropic(model="claude-sonnet-4-5-20250929")
+            gpt_55 = ChatOpenAI(model="gpt-5.5")
+            claude_3_sonnet = ChatAnthropic(model="claude-sonnet-5")
             model = gpt_55.with_fallbacks([claude_3_sonnet])
 
             model.model_name
```

**File**: `libs/core/langchain_core/runnables/history.py` (modified, +2/-2)
```diff
@@ -136,7 +136,7 @@ def get_by_session_id(session_id: str) -> BaseChatMessageHistory:
             ]
         )
 
-        chain = prompt | ChatAnthropic(model="claude-2")
+        chain = prompt | ChatAnthropic(model="claude-sonnet-5")
 
         chain_with_history = RunnableWithMessageHistory(
             chain,
@@ -189,7 +189,7 @@ def get_session_history(
             ]
         )
 
-        chain = prompt | ChatAnthropic(model="claude-2")
+        chain = prompt | ChatAnthropic(model="claude-sonnet-5")
 
         with_message_history = RunnableWithMessageHistory(
             chain,
```

**File**: `libs/core/langchain_core/runnables/retry.py` (modified, +1/-1)
```diff
@@ -96,7 +96,7 @@ def foo(input) -> None:
 
     Example:
         ```python
-        from langchain_core.chat_models import ChatOpenAI
+        from langchain_openai import ChatOpenAI
         from langchain_core.prompts import PromptTemplate
 
         template = PromptTemplate.from_template("tell me a joke about {topic}.")
```

---

### Incident Patch 9: `021dce46` (2026-09-25)
**Commit Message**: fix(langchain): recognize GPT-6 structured output without profiles (#40844)

Co-authored-by: Lucas Kim <[REDACTED_EMAIL]>

**File**: `libs/langchain_v1/langchain/agents/factory.py` (modified, +1/-0)
```diff
@@ -193,6 +193,7 @@ def _wrap_trace_kwargs(middleware: AgentMiddleware[Any, Any]) -> dict[str, Any]:
     r"(^|[/:.])gpt-5\.4(-\d{4}-\d{2}-\d{2})?($|[/:])",
     r"(^|[/:.])gpt-5\.4-(mini|nano)($|[-/:])",
     r"(^|[/:.])gpt-5\.5($|[-/:])",
+    r"(^|[/:.])gpt-6-(astra|luna|sol)($|[-/:])",
     r"(^|[/:.])claude-(fable|mythos)-5(?:-\d{8})?(?:-v\d(?::\d)?)?($|[/:])",
     r"(^|[/:.])claude-haiku-4-5(?:-\d{8})?(?:-v\d(?::\d)?)?($|[/:])",
     r"(^|[/:.])claude-opus-4-(5|6|7|8)(?:-\d{8})?(?:-v\d(?::\d)?)?($|[/:])",
```

**File**: `libs/langchain_v1/tests/unit_tests/agents/test_response_format.py` (modified, +4/-0)
```diff
@@ -1059,6 +1059,10 @@ def test_blocks_gemini_latest_aliases(self, alias: str) -> None:
             "openai:gpt-5.5",
             "openai/gpt-5-mini",
             "openai.gpt-5.4-mini",
+            "gpt-6-sol",
+            "us.openai.gpt-6-sol",
+            "global.openai.gpt-6-luna",
+            "openai.gpt-6-astra",
             "claude-fable-5",
             "claude-mythos-5",
             "claude-haiku-4-5",
```

---

### Incident Patch 10: `38cee0db` (2026-09-24)
**Commit Message**: fix(fireworks): declare native PDF inputs unsupported (#40814)

Co-authored-by: Mason Daugherty <[REDACTED_EMAIL]>
Co-authored-by: open-swe[bot] <[REDACTED_EMAIL]>

**File**: `libs/partners/fireworks/langchain_fireworks/data/_profiles.py` (modified, +78/-0)
```diff
@@ -38,6 +38,8 @@
         "attachment": False,
         "temperature": True,
         "tool_call_streaming": True,
+        "pdf_inputs": False,
+        "pdf_tool_message": False,
     },
     "accounts/fireworks/models/deepseek-v4-flash-vision-exp": {
         "name": "DeepSeek V4 Flash Vision Exp",
@@ -61,6 +63,8 @@
         "attachment": True,
         "temperature": True,
         "tool_call_streaming": True,
+        "pdf_inputs": False,
+        "pdf_tool_message": False,
     },
     "accounts/fireworks/models/deepseek-v4-pro": {
         "name": "DeepSeek V4 Pro",
@@ -84,6 +88,8 @@
         "attachment": False,
         "temperature": True,
         "tool_call_streaming": True,
+        "pdf_inputs": False,
+        "pdf_tool_message": False,
         "reasoning_effort_levels": [
             "none",
             "low",
@@ -116,6 +122,8 @@
         "attachment": False,
         "temperature": True,
         "tool_call_streaming": True,
+        "pdf_inputs": False,
+        "pdf_tool_message": False,
     },
     "accounts/fireworks/models/deepseek-v4p1-flash": {
         "name": "DeepSeek V4.1 Flash",
@@ -138,6 +146,8 @@
         "attachment": True,
         "temperature": True,
         "tool_call_streaming": True,
+        "pdf_inputs": False,
+        "pdf_tool_message": False,
     },
     "accounts/fireworks/models/ember-1": {
         "name": "Ember-1",
@@ -158,9 +168,13 @@
         "tool_calling": True,
         "attachment": True,
         "tool_call_streaming": True,
+        "pdf_inputs": False,
+        "pdf_tool_message": False,
     },
     "accounts/fireworks/models/glm-5p1": {
         "tool_call_streaming": True,
+        "pdf_inputs": False,
+        "pdf_tool_message": False,
         "reasoning_effort_levels": [
             "none",
             "high",
@@ -188,6 +202,8 @@
         "attachment": False,
         "temperature": True,
         "tool_call_streaming": True,
+        "pdf_inputs": False,
+        "pdf_tool_message": False,
         "reasoning_effort_levels": [
             "none",
             "high",
@@ -216,6 +232,8 @@
         "attachment": False,
         "temperature": True,
         "tool_call_streaming": True,
+        "pdf_inputs": False,
+        "pdf_tool_message": False,
     },
     "accounts/fireworks/models/glm-5p3-flash": {
         "name": "GLM 5.3 Flash",
@@ -238,6 +256,8 @@
         "attachment": True,
         "temperature": True,
         "tool_call_streaming": True,
+        "pdf_inputs": False,
+        "pdf_tool_message": False,
     },
     "accounts/fireworks/models/gpt-oss-120b": {
         "name": "GPT OSS 120B",
@@ -259,6 +279,8 @@
         "attachment": False,
         "temperature": True,
         "tool_call_streaming": True,
+        "pdf_inputs": False,
+        "pdf_tool_message": False,
     },
     "accounts/fireworks/models/inkling": {
         "name": "Inkling",
@@ -280,6 +302,8 @@
         "attachment": True,
         "temperature": True,
         "tool_call_streaming": True,
+        "pdf_inputs": False,
+        "pdf_tool_message": False,
     },
     "accounts/fireworks/models/kimi-k2p6": {
         "name": "Kimi K2.6",
@@ -302,6 +326,8 @@
         "attachment": True,
         "temperature": True,
         "tool_call_streaming": True,
+        "pdf_inputs": False,
+        "pdf_tool_message": False,
         "reasoning_effort_levels": [
             "low",
             "medium",
@@ -329,6 +355,8 @@
         "attachment": True,
         "temperature": True,
         "tool_call_streaming": True,
+        "pdf_inputs": False,
+        "pdf_tool_message": False,
         "reasoning_effort_levels": [
             "low",
             "medium",
@@ -356,6 +384,8 @@
         "attachment": True,
         "temperature": False,
         "tool_call_streaming": True,
+        "pdf_inputs": False,
+        "pdf_tool_message": False,
     },
     "accounts/fireworks/models/minimax-m2p7": {
         "name": "MiniMax-M2.7",
@@ -378,6 +408,8 @@
         "attachment": False,
         "temperature": True,
         "tool_call_streaming": True,
+        "pdf_inputs": False,
+        "pdf_tool_message": False,
     },
     "accounts/fireworks/models/minimax-m3": {
         "name": "MiniMax-M3",
@@ -399,6 +431,8 @@
         "attachment": False,
         "temperature": True,
         "tool_call_streaming": True,
+        "pdf_inputs": False,
+        "pdf_tool_message": False,
     },
     "accounts/fireworks/models/muse-glimmer-30b": {
         "name": "Muse Glimmer 30B",
@@ -422,6 +456,8 @@
         "attachment": True,
         "temperature": True,
         "tool_call_streaming": True,
+        "pdf_inputs": False,
+        "pdf_tool_message": False,
     },
     "accounts/fireworks/models/nemotron-3-ultra-nvfp4": {
         "name": "Nemotron 3 Ultra 550B A55B",
@@ -443,6 +479,8 @@
         "attachment": False,
         "temperature": True,
         "tool_call_streaming": True,
+        "pdf_inputs": False,
+        "pdf_tool_message": False,
     },
```

**File**: `libs/partners/fireworks/langchain_fireworks/data/profile_augmentations.toml` (modified, +2/-0)
```diff
@@ -2,6 +2,8 @@ provider = "fireworks-ai"
 
 [overrides]
 tool_call_streaming = true
+pdf_inputs = false
+pdf_tool_message = false
 
 [overrides."accounts/fireworks/models/deepseek-v4-pro"]
 reasoning_effort_levels = ["none", "low", "medium", "high", "xhigh", "max"]
```

**File**: `libs/partners/fireworks/tests/unit_tests/test_chat_models.py` (modified, +10/-0)
```diff
@@ -57,6 +57,7 @@
     _update_token_usage,
     _usage_to_metadata,
 )
+from langchain_fireworks.data._profiles import _PROFILES
 
 MODEL_NAME = "accounts/fireworks/models/test-model"
 
@@ -105,6 +106,15 @@ def test_fireworks_model_param() -> None:
     assert llm.model == "foo"
 
 
+@pytest.mark.parametrize("model_name", _PROFILES)
+def test_model_profile_rejects_native_pdf_input(model_name: str) -> None:
+    profile = _make_model(model=model_name).profile
+
+    assert profile is not None
+    assert profile["pdf_inputs"] is False
+    assert profile["pdf_tool_message"] is False
+
+
 def test_convert_dict_to_message_with_reasoning_content() -> None:
     """Test that reasoning_content is correctly extracted from API response."""
     response_dict = {
```

---

### Incident Patch 11: `fbd70b73` (2026-09-24)
**Commit Message**: fix(fireworks): preserve malformed tool arguments as diagnostic JSON (#40818)

`ChatFireworks` can replay historical tool calls with malformed or
non-object JSON arguments without forwarding invalid argument strings to
Fireworks.

---

Fireworks rejects conversation history containing malformed or
non-object tool-call arguments, preventing an agent from recovering on
its next turn.

Wrap these arguments in a JSON object under
`__invalid_tool_call_arguments` when serializing history, preserving the
original payload, call IDs, and tool-result pairing. Apply this to
parsed and raw tool-call history without mutating messages or executing
repaired arguments; valid object strings stay unchanged.

Made by [Open SWE](https://github.com/langchain-ai/open-swe) · [view
thread](https://openswe.vercel.app/agents/0da06f8d-3ea1-5f01-aa55-953acb9a71fa)
· openai:gpt-6-astra (medium)

Co-authored-by: Mason Daugherty <[REDACTED_EMAIL]>
Co-authored-by: open-swe[bot] <[REDACTED_EMAIL]>

**File**: `libs/partners/fireworks/langchain_fireworks/chat_models.py` (modified, +28/-0)
```diff
@@ -343,6 +343,21 @@ def _format_message_content(content: Any) -> Any:
     return formatted
 
 
+def _format_tool_call_arguments(arguments: str | dict | None) -> str | dict:
+    """Preserve invalid historical arguments inside a JSON object for replay."""
+    if isinstance(arguments, dict):
+        return arguments
+    try:
+        parsed = json.loads(arguments) if arguments is not None else None
+        if isinstance(parsed, dict) and arguments is not None:
+            json.dumps(parsed, allow_nan=False)
+            return arguments
+    except ValueError:
+        logger.debug("Invalid JSON in historical Fireworks tool call arguments")
+    logger.warning("Wrapping invalid historical Fireworks tool call arguments")
+    return json.dumps({"__invalid_tool_call_arguments": arguments}, ensure_ascii=False)
+
+
 def _convert_message_to_dict(message: BaseMessage) -> dict:
     """Convert a LangChain message to a dictionary.
 
@@ -392,6 +407,19 @@ def _convert_message_to_dict(message: BaseMessage) -> dict:
             ]
         elif "tool_calls" in message.additional_kwargs:
             message_dict["tool_calls"] = message.additional_kwargs["tool_calls"]
+        if "tool_calls" in message_dict:
+            message_dict["tool_calls"] = [
+                {
+                    **tool_call,
+                    "function": {
+                        **tool_call["function"],
+                        "arguments": _format_tool_call_arguments(
+                            tool_call["function"]["arguments"]
+                        ),
+                    },
+                }
+                for tool_call in message_dict["tool_calls"]
+            ]
         # If tool calls only, content is None not empty string
         if "tool_calls" in message_dict and message_dict["content"] == "":
             message_dict["content"] = None
```

**File**: `libs/partners/fireworks/tests/unit_tests/test_chat_models.py` (modified, +61/-1)
```diff
@@ -2,6 +2,7 @@
 
 from __future__ import annotations
 
+import json
 import logging
 import os
 from typing import Any
@@ -205,12 +206,71 @@ def test_convert_v1_message_filters_invalid_tool_call_content() -> None:
             {
                 "type": "function",
                 "id": "call_invalid",
-                "function": {"name": "get_weather", "arguments": '{"city":'},
+                "function": {
+                    "name": "get_weather",
+                    "arguments": json.dumps(
+                        {"__invalid_tool_call_arguments": '{"city":'}
+                    ),
+                },
             }
         ],
     }
 
 
+@pytest.mark.parametrize("raw_history", [False, True])
+@pytest.mark.parametrize(
+    ("arguments", "wrapped"),
+    [
+        ('{"city":', True),
+        ("[]", True),
+        ("null", True),
+        (None, True),
+        ('{"x": NaN}', True),
+        ('{"city": "Paris"}', False),
+    ],
+)
+def test_replay_invalid_tool_call_arguments(
+    arguments: str | None, *, wrapped: bool, raw_history: bool
+) -> None:
+    message = AIMessage(
+        content="",
+        tool_calls=[{"name": "get_weather", "args": {"city": "Paris"}, "id": "valid"}],
+        invalid_tool_calls=[
+            {"name": "get_weather", "args": arguments, "id": "invalid", "error": "bad"}
+        ],
+    )
+    if raw_history:
+        message.additional_kwargs["tool_calls"] = [
+            {
+                "type": "function",
+                "id": "invalid",
+                "function": {"name": "get_weather", "arguments": arguments},
+            }
+        ]
+        message.tool_calls = []
+        message.invalid_tool_calls = []
+    original = message.model_dump()
+
+    result = _convert_message_to_dict(message)
+
+    assert message.model_dump() == original
+    invalid = result["tool_calls"][-1]
+    assert invalid["id"] == "invalid"
+    assert invalid["function"]["name"] == "get_weather"
+    if wrapped:
+        assert json.loads(invalid["function"]["arguments"]) == {
+            "__invalid_tool_call_arguments": arguments
+        }
+    else:
+        assert invalid["function"]["arguments"] == arguments
+    if not raw_history:
+        assert json.loads(result["tool_calls"][0]["function"]["arguments"]) == {
+            "city": "Paris"
+        }
+    tool_result = ToolMessage(content="Invalid JSON", tool_call_id="invalid")
+    assert _convert_message_to_dict(tool_result)["tool_call_id"] == invalid["id"]
+
+
 def test_sanitize_chat_completions_content_passthrough_non_text_block() -> None:
     blocks = [{"type": "image_url", "image_url": {"url": "https://x/y.png"}}]
     assert _sanitize_chat_completions_content(blocks) == blocks
```

---

### Incident Patch 12: `2dd956b8` (2026-09-23)
**Commit Message**: docs(infra): fix AGENTS.md root setup guidance and package doc accuracy (#40794)

Closes #40793

---

Docs-only repair from a full audit of developer-facing markdown against
the repository as source of truth. A new contributor following
`AGENTS.md` from the repo root currently hits missing files and commands
that cannot run; package docs and a workflow comment also drift from
reality.

**What was wrong**

- `AGENTS.md` listed root-level `pyproject.toml`, `uv.lock`, and
`Makefile` as key config files — none exist at the repo root (config is
per package under `libs/*/`).
- Setup/test/lint examples (`uv sync --all-groups`, `make test` / `lint`
/ `format`) had no working directory, so they fail if copy-pasted from
the root.
- The monorepo structure tree omitted `openwiki/` and `AGENTS.md`.
- `libs/README.md` omitted the `model-profiles/` package from its
directory list.
- Root `README.md` linked Deep Agents with `http://` while every other
docs link uses `https://`.
- The PR-title paragraph claimed scopes are mandatory “with no
exceptions”, but `pr_lint.yml` sets `requireScope: false` (only empty
`type():` parens are rejected).
- Grammar (“require” → “requires”), an unfinished editable

**File**: `.github/workflows/pr_lint.yml` (modified, +1/-1)
```diff
@@ -31,7 +31,7 @@
 #   core, langchain, langchain-classic, model-profiles,
 #   standard-tests, text-splitters, docs, anthropic, chroma, deepseek, exa,
 #   fireworks, groq, huggingface, mistralai, nomic, ollama, openai,
-#   perplexity, qdrant, xai, infra, deps, partners
+#   openrouter, perplexity, qdrant, typesafe, xai, infra, deps, partners
 #
 # Multiple scopes can be used by separating them with a comma. For example:
 #
```

**File**: `AGENTS.md` (modified, +13/-8)
```diff
@@ -29,9 +29,10 @@ langchain/
 │   │   └── ... (other integrations maintained by the LangChain team)
 │   ├── text-splitters/   # Document chunking utilities
 │   ├── standard-tests/   # Shared test suite for integrations
-│   ├── model-profiles/   # Model configuration profiles
+│   └── model-profiles/   # Model configuration profiles
 ├── .github/              # CI/CD workflows and templates
 ├── .vscode/              # VSCode IDE standard settings and recommended extensions
+├── openwiki/             # Generated just-in-time evidence index (optional reading)
 └── README.md             # Information about LangChain
 ```
 
@@ -43,14 +44,14 @@ langchain/
 ### Development tools & commands
 
 - `uv` – Fast Python package installer and resolver (replaces pip/poetry)
-- `make` – Task runner for common development commands. Feel free to look at the `Makefile` for available commands and usage patterns.
+- `make` – Task runner for common development commands. Each package under `libs/` has its own `Makefile`; feel free to look at it for available commands and usage patterns.
 - `ruff` – Fast Python linter and formatter
 - `mypy` – Static type checking
 - `pytest` – Testing framework
 
-This monorepo uses `uv` for dependency management. Local development uses editable installs: `[tool.uv.sources]`
+This monorepo uses `uv` for dependency management. Local development uses editable installs declared under each package's `[tool.uv.sources]` table in `pyproject.toml`, so path dependencies resolve to your working tree instead of PyPI.
 
-Each package in `libs/` has its own `pyproject.toml` and `uv.lock`.
+Each package in `libs/` has its own `pyproject.toml`, `uv.lock`, and `Makefile`. There is no workspace-level `pyproject.toml` or `Makefile` at the repo root — always `cd` into the package you are working on before running the commands below (for example `cd libs/langchain_v1` or `cd libs/core`).
 
 Before running your tests, set up all packages by running:
 
@@ -92,9 +93,13 @@ Use `uv` for all environment and dependency operations in this monorepo. Do not
 
 #### Key config files
 
-- pyproject.toml: Main workspace configuration with dependency groups
-- uv.lock: Locked dependencies for reproducible builds
-- Makefile: Development tasks
+There is no single workspace config at the repository root. Configuration lives per package:
+
+- `libs/<package>/pyproject.toml`: Package metadata and dependency groups (`test`, `lint`, `typing`, `dev`, …)
+- `libs/<package>/uv.lock`: Locked dependencies for reproducible builds
+- `libs/<package>/Makefile`: Development tasks for that package (`test`, `lint`, `format`, `type`, …)
+- `libs/Makefile`: Cross-package `lock` / `check-lock` only
+- `.pre-commit-config.yaml` (repo root): Git hooks that run per-package format/lint
 
 #### PR and commit titles
 
@@ -364,7 +369,7 @@ When adding a new partner package, update these files:
 
 ## GitHub Actions & Workflows
 
-This repository require actions to be pinned to a full-length commit SHA. Attempting to use a tag will fail. Use the `gh` cli to query. Verify tags are not annotated tag objects (which would need dereferencing).
+This repository requires actions to be pinned to a full-length commit SHA. Attempting to use a tag will fail. Use the `gh` cli to query. Verify tags are not annotated tag objects (which would need dereferencing).
 
 ## Additional resources
 
```

**File**: `README.md` (modified, +2/-2)
```diff
@@ -24,7 +24,7 @@
 LangChain is a framework for building agents and LLM-powered applications. It helps you chain together interoperable components and third-party integrations to simplify AI application development — all while future-proofing decisions as the underlying technology evolves.
 
 > [!TIP]
-> Just getting started? Check out **[Deep Agents](http://docs.langchain.com/oss/python/deepagents/)** — a higher-level package built on LangChain for agents that have built-in capabilities for common usage patterns such as planning, subagents, file system usage, and more.
+> Just getting started? Check out **[Deep Agents](https://docs.langchain.com/oss/python/deepagents/)** — a higher-level package built on LangChain for agents that have built-in capabilities for common usage patterns such as planning, subagents, file system usage, and more.
 
 ## Quickstart
 
@@ -50,7 +50,7 @@ For an equivalent JS/TS library, check out [LangChain.js](https://github.com/lan
 
 While the LangChain framework can be used standalone, it also integrates seamlessly with any LangChain product, giving developers a full suite of tools when building LLM applications.
 
-- **[Deep Agents](http://docs.langchain.com/oss/python/deepagents/)** — Build agents that can plan, use subagents, and leverage file systems for complex tasks
+- **[Deep Agents](https://docs.langchain.com/oss/python/deepagents/)** — Build agents that can plan, use subagents, and leverage file systems for complex tasks
 - **[LangGraph](https://docs.langchain.com/oss/python/langgraph/overview)** — Build agents that can reliably handle complex tasks with our low-level agent orchestration framework
 - **[Integrations](https://docs.langchain.com/oss/python/integrations/providers/overview)** — Chat & embedding models, tools & toolkits, and more
 - **[LangSmith](https://www.langchain.com/langsmith)** — Agent evals, observability, and debugging for LLM apps
```

**File**: `libs/README.md` (modified, +1/-0)
```diff
@@ -12,6 +12,7 @@ This repository is structured as a monorepo, with various packages located in th
 core/             # Core primitives and abstractions for langchain
 langchain/        # langchain-classic
 langchain_v1/     # langchain
+model-profiles/   # Model capability profiles and CLI (`langchain-model-profiles`)
 partners/         # Certain third-party providers integrations (see below)
 standard-tests/   # Standardized tests for integrations
 text-splitters/   # Text splitter utilities
```

**File**: `libs/langchain_v1/Makefile` (modified, +0/-1)
```diff
@@ -126,4 +126,3 @@ help:
 	@echo 'extended_tests               - run only extended unit tests'
 	@echo 'test_watch                   - run unit tests in watch mode'
 	@echo 'integration_tests            - run integration tests'
-	@echo '-- DOCUMENTATION tasks are from the top-level Makefile --'
```

---

### Incident Patch 13: `49f4b401` (2026-09-23)
**Commit Message**: fix(openai): raise on error events in stream path (#40791)

Co-authored-by: Aokiro <[REDACTED_EMAIL]>

**File**: `libs/partners/openai/langchain_openai/chat_models/base.py` (modified, +7/-0)
```diff
@@ -5454,6 +5454,13 @@ def _advance(output_idx: int, sub_idx: int | None = None) -> None:
         response = _coerce_chunk_response(chunk.response)
         id = response.id
         response_metadata["id"] = response.id  # Backwards compatibility
+    elif chunk.type == "response.failed":
+        response = _coerce_chunk_response(chunk.response)
+        error_msg = str(response.error or f"Response {response.id} failed.")
+        raise ValueError(error_msg)
+    elif chunk.type == "error":
+        error_msg = f"{chunk.code}: {chunk.message}" if chunk.code else chunk.message
+        raise ValueError(error_msg)
     elif chunk.type in ("response.completed", "response.incomplete"):
         response = _coerce_chunk_response(chunk.response)
         msg = cast(
```

**File**: `libs/partners/openai/tests/unit_tests/chat_models/test_responses_stream.py` (modified, +72/-1)
```diff
@@ -13,6 +13,8 @@
     ResponseContentPartAddedEvent,
     ResponseContentPartDoneEvent,
     ResponseCreatedEvent,
+    ResponseErrorEvent,
+    ResponseFailedEvent,
     ResponseFunctionCallArgumentsDeltaEvent,
     ResponseFunctionCallArgumentsDoneEvent,
     ResponseFunctionToolCallItem,
@@ -30,6 +32,7 @@
     ResponseTextDoneEvent,
 )
 from openai.types.responses.response import Response
+from openai.types.responses.response_error import ResponseError
 from openai.types.responses.response_output_text import ResponseOutputText
 from openai.types.responses.response_reasoning_item import Summary
 from openai.types.responses.response_reasoning_summary_part_added_event import (
@@ -50,7 +53,10 @@
 from langchain_openai.chat_models.base import (
     _convert_responses_chunk_to_generation_chunk,
 )
-from tests.unit_tests.chat_models.test_base import MockSyncContextManager
+from tests.unit_tests.chat_models.test_base import (
+    MockAsyncContextManager,
+    MockSyncContextManager,
+)
 
 MODEL = "gpt-5.4"
 
@@ -1231,3 +1237,68 @@ def mock_create(*args: Any, **kwargs: Any) -> MockSyncContextManager:
             full = chunk if full is None else full + chunk
     assert isinstance(full, AIMessageChunk)
     assert full.id == "resp_123"
+
+
+def _failed_event(error: ResponseError | None) -> ResponseFailedEvent:
+    created = responses_stream[0]
+    assert isinstance(created, ResponseCreatedEvent)
+    response = created.response.model_copy(update={"status": "failed", "error": error})
+    return ResponseFailedEvent(
+        response=response, sequence_number=1, type="response.failed"
+    )
+
+
+_FAILURE_CASES = [
+    (
+        _failed_event(ResponseError(code="server_error", message="Model failed.")),
+        "server_error",
+    ),
+    (_failed_event(None), "Response resp_123 failed."),
+    (
+        ResponseErrorEvent(
+            type="error",
+            code="rate_limit_exceeded",
+            message="Rate limit reached.",
+            param=None,
+            sequence_number=1,
+        ),
+        "rate_limit_exceeded: Rate limit reached.",
+    ),
+]
+
+
+@pytest.mark.parametrize(("failure_event", "match"), _FAILURE_CASES)
+def test_responses_stream_raises_on_failure(failure_event: Any, match: str) -> None:
+    llm = ChatOpenAI(model=MODEL, use_responses_api=True)
+    mock_client = MagicMock()
+
+    def mock_create(*args: Any, **kwargs: Any) -> MockSyncContextManager:
+        return MockSyncContextManager([responses_stream[0], failure_event])
+
+    mock_client.responses.create = mock_create
+
+    with (
+        patch.object(llm, "root_client", mock_client),
+        pytest.raises(ValueError, match=match),
+    ):
+        list(llm.stream("test"))
+
+
+@pytest.mark.parametrize(("failure_event", "match"), _FAILURE_CASES)
+async def test_responses_astream_raises_on_failure(
+    failure_event: Any, match: str
+) -> None:
+    llm = ChatOpenAI(model=MODEL, use_responses_api=True)
+    mock_client = MagicMock()
+
+    async def mock_create(*args: Any, **kwargs: Any) -> MockAsyncContextManager:
+        return MockAsyncContextManager([responses_stream[0], failure_event])
+
+    mock_client.responses.create = mock_create
+
+    with (
+        patch.object(llm, "root_async_client", mock_client),
+        pytest.raises(ValueError, match=match),
+    ):
+        async for _ in llm.astream("test"):
+            pass
```

---

### Incident Patch 14: `19cadaa1` (2026-09-23)
**Commit Message**: fix(core): abbreviate long tool IDs in XML buffer strings (#40792)

Co-authored-by: ccurme <[REDACTED_EMAIL]>
Co-authored-by: open-swe[bot] <[REDACTED_EMAIL]>

**File**: `libs/core/langchain_core/messages/utils.py` (modified, +14/-1)
```diff
@@ -284,6 +284,16 @@ def _get_message_type_str(
     raise ValueError(msg)
 
 
+_TOOL_CALL_ID_DISPLAY_LIMIT = 64
+
+
+def _display_tool_call_id(tool_call_id: str) -> str:
+    """Abbreviate long tool-call IDs in formatted message strings."""
+    if len(tool_call_id) > _TOOL_CALL_ID_DISPLAY_LIMIT:
+        return f"{tool_call_id[:_TOOL_CALL_ID_DISPLAY_LIMIT]}..."
+    return tool_call_id
+
+
 def get_buffer_string(
     messages: Sequence[BaseMessage],
     human_prefix: str = "Human",
@@ -327,6 +337,9 @@ def get_buffer_string(
         If a message is an `AIMessage` and contains both tool calls under `tool_calls`
         and a function call under `additional_kwargs["function_call"]`, only the tool
         calls will be appended to the string representation.
+        In XML format, tool-call IDs longer than 64 characters are displayed
+        as the first 64 characters followed by `...`; the original messages
+        are not changed.
 
     !!! note "XML format"
 
@@ -469,7 +482,7 @@ def get_buffer_string(
 
                 if has_tool_calls:
                     for tc in ai_msg.tool_calls:
-                        tc_id = quoteattr(str(tc.get("id") or ""))
+                        tc_id = quoteattr(_display_tool_call_id(tc.get("id") or ""))
                         tc_name = quoteattr(str(tc.get("name") or ""))
                         tc_args = escape(
                             json.dumps(tc.get("args", {}), ensure_ascii=False)
```

**File**: `libs/core/tests/unit_tests/messages/test_utils.py` (modified, +24/-0)
```diff
@@ -1792,6 +1792,30 @@ def test_get_buffer_string_with_tool_calls() -> None:
     assert "NYC" in result
 
 
+def test_get_buffer_string_abbreviates_long_tool_call_ids_in_xml_only() -> None:
+    """Long IDs are shortened in display text without modifying protocol messages."""
+    long_id = "call_" + "thought_signature" * 100
+    message = AIMessage(
+        content="calling",
+        tool_calls=[
+            {"name": "search", "args": {"query": "weather"}, "id": long_id},
+            {"name": "search", "args": {}, "id": "call_short"},
+        ],
+    )
+    result = ToolMessage(content="result", tool_call_id=long_id)
+
+    rendered = get_buffer_string([message, result], format="xml")
+    prefix = get_buffer_string([message, result])
+
+    assert f"{long_id[:64]}..." in rendered
+    assert long_id not in rendered
+    assert "call_short" in rendered
+    assert "result" in rendered
+    assert long_id in prefix
+    assert message.tool_calls[0]["id"] == long_id
+    assert result.tool_call_id == long_id
+
+
 def test_get_buffer_string_with_tool_calls_empty_content() -> None:
     """Test `get_buffer_string` with `tool_calls` and empty `content`."""
     messages = [
```

---

### Incident Patch 15: `798441e8` (2026-09-23)
**Commit Message**: chore(anthropic): fix integration test cassette (#40790)



#### Recent Merged Pull Requests:
- **PR #41058** (2026-10-05): release(huggingface): 1.2.3 (@ccurme)
- **PR #41054** (2026-10-05): chore(langchain): bump minimum FastMCP to 4.0.11 (@hntrl)
- **PR #41053** (closed): fix(langchain): add explicit UTF-8 encoding when reading `pyproject.toml` in unit tests (@shwetangsinha0509)
- **PR #41052** (closed): fix(langchain): add explicit UTF-8 encoding when reading `pyproject.toml` in unit tests (@shwetangsinha0509)
- **PR #41047** (2026-10-05): fix(huggingface): hide `huggingfacehub_api_token` from `repr` (@emil-lc)
- **PR #41046** (closed): Fix/ollama client kwargs mutation (@cellrishi-code)
- **PR #41045** (2026-10-05): chore(model-profiles): refresh model profile data (@langchain-oss-model-profiles[bot])
- **PR #41043** (closed): fix(core): avoid KeyError when collapsing content blocks without type (@iosayin)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
