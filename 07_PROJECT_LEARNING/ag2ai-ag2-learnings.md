# Forensic Learning Record (Deep Inspection): ag2ai/ag2

> **Canonical Artifact**: `07_PROJECT_LEARNING/ag2ai-ag2-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/ag2ai/ag2](https://github.com/ag2ai/ag2))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-06T04:00:33.293Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `ag2ai/ag2`
- **Description**: AG2 (formerly AutoGen): The Open-Source AgentOS.Join us at: https://discord.gg/sNGSwQME3x
- **Primary Language / Ecosystem**: Python
- **Discovered Manifests / Configurations**: pyproject.toml, README.md
- **Stars / Engagement**: 4976 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: pyproject.toml, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `ag2/_import_utils.py`
```
# Copyright (c) 2023 - 2025, AG2ai, Inc., AG2ai open-source projects maintainers and core contributors
#
# SPDX-License-Identifier: Apache-2.0

import inspect
import re
import sys
from abc import ABC, abstractmethod
from collections.abc import Callable, Generator, Iterable
from contextlib import contextmanager, suppress
from dataclasses import dataclass
from functools import wraps
from logging import getLogger
from pathlib import Path
from typing import Any, Generic, Optional, TypeVar

from fast_depends.utils import is_coroutine_callable

__all__ = [
    "optional_import_block",
    "patch_object",
    "require_optional_import",
    "run_for_optional_imports",
    "skip_on_missing_imports",
]

logger = getLogger(__name__)


_MODULE_NAME_RE = re.compile(r"^[A-Za-z_][A-Za-z0-9_]*(\.[A-Za-z_][A-Za-z0-9_]*)*$")


@dataclass
class ModuleInfo:
    name: str

    def is_in_sys_modules(self) -> str | None:
        """Check if the module is installed.

        Returns:
            None if the module is installed, otherwise a message indicating the issue.

        """
        if self.name not in sys.modules:
            return f"'{self.name}' is not installed."

        if hasattr(sys.modules[self.name], "__file__") and sys.modules[self.name].__file__ is not None:
            ag2_path = (Path(__file__).parent).resolve()
            test_path = (Path(__file__).parent.parent / "test").resolve()
            module_path = Path(sys.modules[self.name].__file__).resolve()  # type: ignore[arg-type]

            if str(ag2_path) in str(module_path) or str(test_path) in str(module_path):
                # The module is in the ag2 or test directory
                # Aka similarly named module in the ag2 or test directory
                return f"'{self.name}' is not installed."

        return None

    @classmethod
    def from_str(cls, module_info: str) -> "ModuleInfo":
        """Parse a module name string to create a ModuleInfo object.

        Args:
            module_info (str): The importable module name.

        Returns:
            ModuleInfo: A ModuleInfo object with the parsed information

        Raises:
            ValueError: If the module information is invalid
        """
        # Importable names only — no version constraints. Nothing in the tree ever
        # passed one, and honouring them meant depending on `packaging` for a
        # PEP 440 parser. Reintroduce both together if a guard ever needs a bound.
        name = module_info.strip()
        if not _MODULE_NAME_RE.fullmatch(name):
            raise ValueError(f"Invalid package information: {module_info}")
        return cls(name=name)


class Result:
    def __init__(self) -> None:
        self._failed: bool | None = None

    @property
    def is_successful(self) -> bool:
        if self._failed is None:
            raise ValueError("Result not set")
        return not self._failed


@contextmanager
def optional_import_block() -> Generator[Result, None, None]:
    """Guard a block of code to suppress ImportErrors

    A context manager to temporarily suppress ImportErrors.
    Use this to attempt imports without failing immediately on missing modules.

    Example:
    ```python
    with optional_import_block():
        import some_module
        import some_other_module
    ```
    """
    result = Result()
    try:
        yield result
        result._failed = False
    except ImportError as e:
        # Ignore ImportErrors during this context
        logger.debug(f"Ignoring ImportError: {e}")
        result._failed = True


def get_missing_imports(modules: str | Iterable[str]) -> dict[str, str]:
    """Get missing modules from a list of module names

    Args:
        modules (Union[str, Iterable[str]]): Module name or list of module names

    Returns:
        List of missing module names
    """
    if isinstance(modules, str):
        modules = [modules]

    module_infos = [ModuleInfo.from_str(module) for module in modules]
    x = {m.name: m.is_in_sys_modules() for m in module_infos}
    return {k: v for k, v in x.items() if v}


T = TypeVar("T")
G = TypeVar("G", bound=Callable[..., Any] | type)
F = TypeVar("F", bound=Callable[..., Any])


class PatchObject(ABC, Generic[T]):
    def __init__(self, o: T, missing_modules: dict[str, str], dep_target: str):
        if not self.accept(o):
            raise ValueError(f"Cannot patch object of type {type(o)}")

        self.o = o
        self.missing_modules = missing_modules
        self.dep_target = dep_target

    @classmethod
    @abstractmethod
    def accept(cls, o: Any) -> bool: ...

    @abstractmethod
    def patch(self, except_for: Iterable[str]) -> T: ...

    def get_object_with_metadata(self) -> Any:
        return self.o

    @property
    def msg(self) -> str:
        o = self.get_object_with_metadata()
        plural = len(self.missing_modules) > 1
        fqn = f"{o.__module__}.{o.__name__}" if hasattr(o, "__module__") else o.__name__
        # modules_str = ", ".join([f"'{m}'" for m in self.missing_modules])
        msg = f"{'Modules' if plural else 'A module'} needed for {fqn} {'are' if plural else 'is'} missing:\n"
        for _, status in self.missing_modules.items():
            msg += f" - {status}\n"
        msg += f"Please install {'them' if plural else 'it'} using:\n'pip install ag2[{self.dep_target}]'"
        return msg

    def copy_metadata(self, retval: T) -> None:
        """Copy metadata from original object to patched object

        Args:
            retval: Patched object

        """
        o = self.o
        if hasattr(o, "__doc__"):
            retval.__doc__ = o.__doc__
        if hasattr(o, "__name__"):
            retval.__name__ = o.__name__  # type: ignore[attr-defined]
        if hasattr(o, "__module__"):
            retval.__module__ = o.__module__

    _registry: list[type["PatchObject[Any]"]] = []

    @classmethod
    def register(cls) -> Callable[[type["PatchObject[Any]"]], type["PatchObject[Any]"]]:
        def decorator(subclass: type["PatchObject[Any]"]) -> type["PatchObject[Any]"]:
            cls._registry.append(subclass)
            return subclass

        return decorator

    @classmethod
    def create(
        cls,
        o: T,
        *,
        missing_modules: dict[str, str],
        dep_target: str,
    ) -> Optional["PatchObject[T]"]:
        for subclass in cls._registry:
            if subclass.accept(o):
                return subclass(o, missing_modules, dep_target)
        return None


@PatchObject.register()
class PatchCallable(PatchObject[F]):
    @classmethod
    def accept(cls, o: Any) -> bool:
        return inspect.isfunction(o) or inspect.ismethod(o)

    def patch(self, except_for: Iterable[str]) -> F:
        if self.o.__name__ in except_for:
            return self.o

        f: Callable[..., Any] = self.o

        # @wraps(f.__call__)  # type: ignore[operator]
        @wraps(f)
        def _call(*args: Any, **kwargs: Any) -> Any:
            raise ImportError(self.msg)

        self.copy_metadata(_call)  # type: ignore[arg-type]

        return _call  # type: ignore[return-value]


@PatchObject.register()
class PatchStatic(PatchObject[F]):
    @classmethod
    def accept(cls, o: Any) -> bool:
        # return inspect.ismethoddescriptor(o)
        return isinstance(o, staticmethod)

    def patch(self, except_for: Iterable[str]) -> F:
        if hasattr(self.o, "__name__"):
            name = self.o.__name__
        elif hasattr(self.o, "__func__"):
            name = self.o.__func__.__name__
        else:
            raise ValueError(f"Cannot determine name for object {self.o}")
        if name in except_for:
            return self.o

        f: Callable[..., Any] = self.o.__func__  # type: ignore[attr-defined]

        @wraps(f)
        def _call(*args: Any, **kwargs: Any) -> Any:
            raise ImportError(self.msg)

        self.copy_metadata(_call)  # type: ignore[arg-type]

        return staticmethod(_call)  # type: ignore[return-value]

    def get_object_with_metadata(self) -> Any:
        return self.o.__func__  # type: ignore[attr-defined]


@PatchObject.register()
class PatchInit(PatchObject[F]):
    @classmethod
    def accept(cls, o: Any) -> bool:
        return inspect.ismethoddescriptor(o) and o.__name__ == "__init__"

    def patch(self, except_for: Iterable[str]) -> F:
        if self.o.__name__ in except_for:
            return self.o

        f: Callable[..., Any] = self.o

        @wraps(f)
        def _call(*args: Any, **kwargs: Any) -> Any:
            raise ImportError(self.msg)

        self.copy_metadata(_call)  # type: ignore[arg-type]

        return staticmethod(_call)  # type: ignore[return-value]

    def get_object_with_metadata(self) -> Any:
        return self.o


@PatchObject.register()
class PatchProperty(PatchObject[Any]):
    @classmethod
    def accept(cls, o: Any) -> bool:
        return inspect.isdatadescriptor(o) and hasattr(o, "fget")

    def patch(self, except_for: Iterable[str]) -> property:
        if not hasattr(self.o, "fget"):
            raise ValueError(f"Cannot patch property without getter: {self.o}")
        f: Callable[..., Any] = self.o.fget

        if f.__name__ in except_for:
            return self.o  # type: ignore[no-any-return]

        @wraps(f)
        def _call(*args: Any, **kwargs: Any) -> Any:
            raise ImportError(self.msg)

        self.copy_metadata(_call)

        return property(_call)

    def get_object_with_metadata(self) -> Any:
        return self.o.fget


@PatchObject.register()
class PatchClass(PatchObject[type[Any]]):
    @classmethod
    def accept(cls, o: Any) -> bool:
        return inspect.isclass(o)

    def patch(self, except_for: Iterable[str]) -> type[Any]:
        if self.o.__name__ in except_for:
            return self.o

        for name, member in inspect.getmembers(self.o):
            # Patch __init__ method if possible, but not other internal methods
            if name.startswith("__") and name != "__init__
```

### Core Architecture Module: `ag2/eval/scorer.py`
```
# Copyright (c) 2026, AG2ai, Inc., AG2ai open-source projects maintainers and core contributors
#
# SPDX-License-Identifier: Apache-2.0

"""Scorer — the unit of grading inside the eval framework.

A scorer is a function that grades one task's :class:`Trace` against the
task definition. Authors decorate plain Python functions with
:func:`scorer`; the decorator introspects the function's parameters and,
at call time, injects only what the function asked for, by name. This
matches LangSmith's settled shape::

    @scorer
    def called_get_weather(trace):
        return len(trace.events_of(ToolCallEvent, name="get_weather")) == 1


    @scorer
    def city_argument_correct(trace, reference_outputs):
        calls = trace.events_of(ToolCallEvent, name="get_weather")
        if not calls:
            return False
        return calls[0].arguments.get("city") == reference_outputs["city"]

Scorers can be sync or async: the wrapper calls the scorer and awaits
the *result* whenever it is awaitable, so plain functions, ``async def``
functions, and callable objects with an ``async def __call__`` all work.
They should be pure functions of their inputs (no I/O, no global state).

Return values are normalized into one or more :class:`Feedback` records:

* ``bool`` / ``int`` / ``float`` → ``Feedback(key=<fn name>, score=<value>)``
* ``str`` → ``Feedback(key=<fn name>, value=<value>)`` (categorical)
* :class:`Feedback` → used directly
* ``list[Feedback]`` → multiple records from one call
* ``None`` → skipped (no record produced)
* anything else → :class:`ScorerReturnTypeError`

A scorer that *raises* an exception does not fail the run. The runner
catches it, records a :class:`Feedback` with ``score=None`` and an
explanatory comment, logs a warning, and moves on.
"""

import inspect
import logging
from collections.abc import Awaitable, Callable
from typing import Any, TypeAlias

from ._types import Feedback, ScorerReturnTypeError
from .dataset import Task
from .trace import Trace

__all__ = (
    "Scorer",
    "ScorerFn",
    "scorer",
)


logger = logging.getLogger(__name__)


ScorerFn: TypeAlias = Callable[..., Any] | Callable[..., Awaitable[Any]]
"""Any callable a user can pass to :func:`scorer`. Signature is introspected at decoration time."""


_INJECTABLE_PARAMS: frozenset[str] = frozenset({
    "inputs",
    "outputs",
    "reference_outputs",
    "trace",
    "task",
})


class Scorer:
    """Wraps a user function as a callable scoring unit.

    Most users will not construct this directly — they write a function
    and decorate it with :func:`scorer`. Prebuilt scorer factories (e.g.
    ``tool_called(name)``) construct :class:`Scorer` instances
    programmatically to supply a meaningful ``key`` independent of any
    closure's function name.

    Args:
        fn: The scoring function. May be sync or async — anything whose
            result is awaitable is awaited. May declare any
            subset of the injectable parameters (``inputs``, ``outputs``,
            ``reference_outputs``, ``trace``, ``task``); anything else
            raises ``TypeError`` at construction time.
        key: Stable identifier for the feedback this scorer produces.
            Defaults to ``fn.__name__``. Pass-rate and stats lookups on
            :class:`~ag2.eval.RunResult` use this key.
    """

    __slots__ = ("_fn", "_key", "_params")

    def __init__(
        self,
        fn: ScorerFn,
        *,
        key: str | None = None,
    ) -> None:
        if isinstance(fn, Scorer):
            raise TypeError(
                f"scorer {(key if key is not None else fn.key)!r}: cannot wrap a Scorer; its "
                f"feedback already carries its own key, so this one would be silently discarded — "
                f"pass the underlying function instead"
            )
        self._fn = fn
        self._key = key if key is not None else getattr(fn, "__name__", "scorer")
        self._params = _validate_signature(fn, self._key)

    @property
    def key(self) -> str:
        """The feedback key this scorer emits (defaults to the wrapped function's name)."""
        return self._key

    async def __call__(
        self,
        *,
        inputs: dict[str, Any],
        outputs: dict[str, Any],
        reference_outputs: dict[str, Any] | None,
        trace: Trace,
        task: Task,
    ) -> list[Feedback]:
        """Run the scorer for one task and return zero or more :class:`Feedback` records.

        Only the parameters the wrapped function declared are passed
        through. Exceptions raised by the wrapped function are captured
        as a ``Feedback(score=None, comment=...)`` record and logged at
        WARNING; the runner never sees the exception.
        """
        available: dict[str, Any] = {
            "inputs": inputs,
            "outputs": outputs,
            "reference_outputs": reference_outputs,
            "trace": trace,
            "task": task,
        }
        call_args = {name: available[name] for name in self._params}

        try:
            result = self._fn(**call_args)
            if inspect.isawaitable(result):
                result = await result
        except Exception as exc:
            logger.warning("Scorer %r raised %s: %s", self._key, type(exc).__name__, exc)
            return [
                Feedback(
                    key=self._key,
                    score=None,
                    comment=f"scorer raised: {type(exc).__name__}: {exc}",
                )
            ]

        return self._normalize(result)

    def _normalize(self, result: Any) -> list[Feedback]:
        """Normalize a scorer's return value into a list of :class:`Feedback`.

        Order matters: ``bool`` is a subclass of ``int``, so it must be
        tested first; otherwise ``True`` would never produce a boolean
        feedback. ``Feedback`` is checked before ``list`` because a
        future :class:`Feedback` subclass should still be treated as a
        single record.
        """
        if result is None:
            return []
        if isinstance(result, Feedback):
            return [result]
        if isinstance(result, list):
            for index, item in enumerate(result):
                if not isinstance(item, Feedback):
                    raise ScorerReturnTypeError(
                        f"scorer {self._key!r} returned list[...] with non-Feedback at index "
                        f"{index}: got {type(item).__name__}"
                    )
            return list(result)
        if isinstance(result, bool):
            return [Feedback(key=self._key, score=result)]
        if isinstance(result, (int, float)):
            return [Feedback(key=self._key, score=result)]
        if isinstance(result, str):
            return [Feedback(key=self._key, value=result)]
        raise ScorerReturnTypeError(
            f"scorer {self._key!r} returned unsupported type {type(result).__name__}; "
            f"expected bool, int, float, str, Feedback, list[Feedback], or None"
        )


def scorer(fn: ScorerFn) -> Scorer:
    """Decorate a function as a scorer.

    Example::

        @scorer
        def called_get_weather(trace):
            return len(trace.events_of(ToolCallEvent, name="get_weather")) == 1

    The decorated object is a :class:`Scorer` instance. Pass it directly
    to :func:`ag2.eval.run_agent` via the ``scorers=`` argument.
    """
    return Scorer(fn)


def _validate_signature(fn: ScorerFn, key: str) -> tuple[str, ...]:
    """Return the names of the parameters ``fn`` declares, in declaration order.

    Raises ``TypeError`` for unsupported parameter shapes:

    * ``*args`` or ``**kwargs`` — the decorator only injects by name, so
      variadic params are ambiguous.
    * Positional-only params — we always call with kwargs.
    * Any parameter outside the injectable set
      (``inputs`` / ``outputs`` / ``reference_outputs`` / ``trace`` / ``task``).
    """
    try:
        sig = inspect.signature(fn)
    except (TypeError, ValueError) as exc:
        raise TypeError(f"scorer {key!r}: could not introspect signature: {exc}") from exc

    params: list[str] = []
    for name, param in sig.parameters.items():
        if param.kind is inspect.Parameter.VAR_POSITIONAL:
            raise TypeError(f"scorer {key!r}: *{name} is not supported; declare named parameters instead")
        if param.kind is inspect.Parameter.VAR_KEYWORD:
            raise TypeError(f"scorer {key!r}: **{name} is not supported; declare named parameters instead")
        if param.kind is inspect.Parameter.POSITIONAL_ONLY:
            raise TypeError(
                f"scorer {key!r}: parameter {name!r} is positional-only; "
                f"use a regular parameter so it can be injected by name"
            )
        if name not in _INJECTABLE_PARAMS:
            allowed = ", ".join(sorted(_INJECTABLE_PARAMS))
            raise TypeError(f"scorer {key!r}: parameter {name!r} is not injectable; allowed parameters are: {allowed}")
        params.append(name)
    return tuple(params)

```

### Core Architecture Module: `ag2/eval/scorers/__init__.py`
```
# Copyright (c) 2026, AG2ai, Inc., AG2ai open-source projects maintainers and core contributors
#
# SPDX-License-Identifier: Apache-2.0

"""Prebuilt scorers — frozen versions of the most common scorer patterns.

Each name below is a *factory* that returns a :class:`Scorer`. Drop
them straight into ``scorers=[...]``::

    from ag2.eval.scorers import (
        tool_called,
        no_tool_errors,
        final_answer_matches,
        token_budget,
    )

    scorers = [
        tool_called("get_weather"),
        no_tool_errors(),
        final_answer_matches(field="city", matcher="contains"),
        token_budget(2_000),
    ]

The four deterministic prebuilts above are a deliberately small starter
catalog. ``agent_judge`` adds LLM grading: a *single-purpose* Agent-as-judge
(one criterion → one ``Feedback`` key). Compose several for a multi-dimensional
scorecard::

    from ag2.eval.scorers import agent_judge

    scorers = [
        agent_judge(config, criterion="Answer is correct vs reference.", key="correctness"),
        agent_judge(config, criterion="Claims are grounded in tool results.", key="faithfulness"),
    ]
"""

from .attribution import ERROR_MODES, Attribution, failure_attribution
from .correctness import final_answer_matches
from .cost import token_budget
from .human_pairwise import export_pairwise_cases, human_labels, human_pairwise
from .judge import Verdict, agent_judge
from .pairwise_judge import PairwiseVerdict, pairwise_judge
from .threshold import threshold
from .tools import no_tool_errors, tool_called

__all__ = (
    "ERROR_MODES",
    "Attribution",
    "PairwiseVerdict",
    "Verdict",
    "agent_judge",
    "export_pairwise_cases",
    "failure_attribution",
    "final_answer_matches",
    "human_labels",
    "human_pairwise",
    "no_tool_errors",
    "pairwise_judge",
    "threshold",
    "token_budget",
    "tool_called",
)

```

### Core Architecture Module: `ag2/eval/scorers/attribution.py`
```
# Copyright (c) 2026, AG2ai, Inc., AG2ai open-source projects maintainers and core contributors
#
# SPDX-License-Identifier: Apache-2.0

"""Failure attribution — for a failed run, name the step, agent, and error mode.

The Who&When-style question: when a run fails, *what* went wrong, *where*, and
(in a multi-agent trace) *who* was responsible. Two complementary detectors:

* **Deterministic** — scans the typed :class:`Trace` for unambiguous mechanical
  failures (crash, terminal tool error, no answer) and names the exact event.
  Fast, free, reproducible.
* **LLM attributor** (when a ``config`` is given) — reads the numbered
  trajectory and attributes *semantic* failures (incorrect/incomplete answer,
  ignored constraint, hallucinated fact) the rules can't see.

Exposed as a single-purpose :class:`Scorer`: it emits one :class:`Feedback`
with ``value`` = the error mode (so ``RunResult.value_counts`` gives the
failure-mode distribution for free) and the typed :class:`Attribution`
serialized into ``Feedback.detail`` (decisive step, responsible agent, …) for
programmatic access. Single-agent today; ``responsible_agent`` is the extension
point for multi-agent/network traces.
"""

import json
from collections.abc import Iterable
from typing import Any

from pydantic import BaseModel, Field

from ag2.agent import Agent
from ag2.config import ModelConfig
from ag2.events import (
    BaseEvent,
    ModelResponse,
    ToolCallEvent,
    ToolErrorEvent,
    ToolResultEvent,
)
from ag2.middleware.base import MiddlewareFactory

from .._types import Feedback
from ..scorer import Scorer
from ..trace import Trace

__all__ = (
    "ERROR_MODES",
    "Attribution",
    "failure_attribution",
)

# Curated, extensible starter taxonomy. Mechanical modes come from the
# deterministic detector; semantic modes from the LLM attributor.
ERROR_MODES: tuple[str, ...] = (
    "none",  # no failure
    "tool_failure",  # a tool errored (terminally)
    "hallucinated_tool",  # called a tool that does not exist (semantic)
    "loop",  # stuck repeating without progress (semantic)
    "crash",  # the run raised an exception
    "no_answer",  # finished with no final answer
    "incorrect_answer",  # answered, but wrong (semantic)
    "premature_termination",  # stopped before completing the task (semantic)
    "ignored_constraint",  # violated an instruction/constraint (semantic)
    "hallucinated_fact",  # asserted a false fact (semantic)
    "other",
)


class Attribution(BaseModel):
    """Structured failure attribution for one run (serialized into Feedback.detail)."""

    failed: bool
    error_mode: str
    decisive_step: int | None = None  # index into trace.events of the decisive event
    responsible_agent: str | None = None
    reasoning: str


class _AttributionVerdict(BaseModel):
    """LLM-facing schema — all fields required (OpenAI strict structured output)."""

    failed: bool = Field(description="Did the run fail to accomplish the task?")
    error_mode: str = Field(description="The single error mode from the provided taxonomy ('none' if it succeeded).")
    decisive_step: int = Field(description="The step number where it went wrong, or -1 if not applicable.")
    reasoning: str = Field(description="A brief justification.")


def failure_attribution(
    config: ModelConfig | None = None,
    *,
    key: str = "failure",
    agent_name: str | None = None,
    taxonomy: Iterable[str] = ERROR_MODES,
    retries: int = 1,
    middleware: Iterable[MiddlewareFactory] = (),
) -> Scorer:
    """Build a failure-attribution :class:`Scorer`.

    Args:
        config: Optional judge model for the LLM attributor. Without it the
            scorer is deterministic-only (mechanical failures + ``none``).
        key: Result key; its ``value_counts`` is the failure-mode distribution.
        agent_name: Label used for ``responsible_agent`` (single-agent today).
        taxonomy: Allowed error modes shown to the LLM attributor.
        retries: ``content()`` re-asks on schema-validation failure.
        middleware: Middleware for the attributor agent (e.g. ``TelemetryMiddleware``).
    """
    modes = tuple(taxonomy)
    attributor = (
        Agent(
            f"attributor_{key}",
            _system_prompt(modes),
            config=config,
            response_schema=_AttributionVerdict,
            middleware=middleware,
        )
        if config is not None
        else None
    )

    async def _attribute(
        inputs: dict[str, Any],
        outputs: dict[str, Any],
        reference_outputs: dict[str, Any] | None,
        trace: Trace,
    ) -> Feedback:
        attribution = _detect_mechanical(trace, agent_name)
        if attribution is None:
            if attributor is not None:
                attribution = await _llm_attribute(
                    attributor, inputs, outputs, reference_outputs, trace, retries, agent_name
                )
            else:
                attribution = Attribution(
                    failed=False,
                    error_mode="none",
                    responsible_agent=agent_name,
                    reasoning="no mechanical failure detected",
                )
        return Feedback(
            key=key, value=attribution.error_mode, comment=attribution.reasoning, detail=attribution.model_dump()
        )

    return Scorer(_attribute, key=key)


def _detect_mechanical(trace: Trace, agent_name: str | None) -> Attribution | None:
    """Attribute unambiguous mechanical failures; ``None`` to defer to the LLM."""
    events = trace.events

    if trace.exception is not None:
        return _mech(
            events,
            events[-1] if events else None,
            "crash",
            agent_name,
            f"run raised {type(trace.exception).__name__}: {trace.exception}",
        )

    has_answer = any(r.content for r in trace.events_of(ModelResponse))
    tool_errors = trace.events_of(ToolErrorEvent)
    if tool_errors and not has_answer:
        return _mech(
            events,
            tool_errors[0],
            "tool_failure",
            agent_name,
            f"tool {tool_errors[0].name!r} errored and the run produced no answer",
        )
    if not has_answer:
        return Attribution(
            failed=True, error_mode="no_answer", responsible_agent=agent_name, reasoning="run produced no final answer"
        )
    return None


def _mech(
    events: tuple[BaseEvent, ...], target: BaseEvent | None, mode: str, agent_name: str | None, reasoning: str
) -> Attribution:
    return Attribution(
        failed=True,
        error_mode=mode,
        decisive_step=_index_of(events, target),
        responsible_agent=agent_name,
        reasoning=reasoning,
    )


async def _llm_attribute(
    attributor: Agent,
    inputs: dict[str, Any],
    outputs: dict[str, Any],
    reference_outputs: dict[str, Any] | None,
    trace: Trace,
    retries: int,
    agent_name: str | None,
) -> Attribution:
    reply = await attributor.ask(_render(inputs, outputs, reference_outputs, trace))
    verdict = await reply.content(retries=retries)
    if verdict is None:
        return Attribution(
            failed=False, error_mode="other", responsible_agent=agent_name, reasoning="attributor returned no verdict"
        )
    step = verdict.decisive_step if verdict.decisive_step is not None and verdict.decisive_step >= 0 else None
    return Attribution(
        failed=verdict.failed,
        error_mode=verdict.error_mode,
        decisive_step=step,
        responsible_agent=agent_name,
        reasoning=verdict.reasoning,
    )


def _index_of(events: tuple[BaseEvent, ...], target: BaseEvent | None) -> int | None:
    if target is None:
        return None
    for index, event in enumerate(events):
        if event is target:
            return index
    return None


def _system_prompt(taxonomy: tuple[str, ...]) -> str:
    return (
        "You analyze an agent run and attribute any failure. Given the task and the numbered "
        "trajectory, decide: whether the run failed; the single error_mode from this taxonomy — "
        f"[{', '.join(taxonomy)}] ('none' if it succeeded); the decisive_step (the step number where "
        "it went wrong, or -1 if not applicable); and a brief reasoning. Judge the trajectory as a whole."
    )


def _render(
    inputs: dict[str, Any], outputs: dict[str, Any], reference_outputs: dict[str, Any] | None, trace: Trace
) -> str:
    sections: list[str] = []
    task_input = inputs.get("input")
    if task_input is not None:
        sections.append(f"## Task\n{task_input}")
    if reference_outputs:
        sections.append(f"## Reference\n{json.dumps(reference_outputs)}")
    answer = outputs.get("body")
    sections.append(f"## Final answer\n{answer if answer is not None else '(none)'}")
    sections.append(f"## Trajectory (numbered steps)\n{_render_steps(trace)}")
    return "\n\n".join(sections)


def _render_steps(trace: Trace) -> str:
    lines = [f"[{index}] {_describe(event)}" for index, event in enumerate(trace.events)]
    return "\n".join(lines) if lines else "(no steps)"


def _describe(event: BaseEvent) -> str:
    if isinstance(event, ToolErrorEvent):
        return f"tool error: {event.name} -> {event.error}"
    if isinstance(event, ToolResultEvent):
        return f"tool result: {event.name}"
    if isinstance(event, ToolCallEvent):
        return f"tool call: {event.name}({event.arguments})"
    if isinstance(event, ModelResponse):
        return f"model: {event.content!r}"
    return type(event).__name__

```

### Core Architecture Module: `ag2/eval/scorers/correctness.py`
```
# Copyright (c) 2026, AG2ai, Inc., AG2ai open-source projects maintainers and core contributors
#
# SPDX-License-Identifier: Apache-2.0

"""Prebuilt scorers for final-answer correctness."""

from typing import Any, Literal

from ..scorer import Scorer

__all__ = ("final_answer_matches",)


_Matcher = Literal["exact", "casefold", "contains"]


def final_answer_matches(
    field: str = "answer",
    *,
    matcher: _Matcher = "casefold",
) -> Scorer:
    """Pass iff the agent's final answer matches the task's reference output.

    Reads ``reference_outputs[field]`` for the expected value and compares it
    against the agent's final answer: ``outputs["content"][field]`` when the agent
    returned a structured (JSON-object) answer carrying that field — e.g. via
    ``response_schema`` — otherwise ``outputs["body"]``, the final response text.

    Args:
        field: Key to read from ``reference_outputs`` and (when
            available) from the agent's structured ``outputs``.
            Defaults to ``"answer"``.
        matcher: How to compare the two strings:

            * ``"exact"`` — strict equality (good for closed-form
              answers in structured outputs).
            * ``"casefold"`` — case-insensitive equality (the default;
              forgives capitalization drift).
            * ``"contains"`` — pass iff ``expected`` appears as a
              substring of ``actual`` (good when the reply is a
              sentence and the reference is a single field value).

    The scorer is reference-based: it returns ``False`` when no
    reference output is available for ``field`` rather than raising,
    so an unreferenced task simply scores as a fail. Wrap your own
    scorer if you'd rather skip such tasks.
    """

    def _check(outputs: dict[str, Any], reference_outputs: dict[str, Any] | None) -> bool:
        if reference_outputs is None or field not in reference_outputs:
            return False
        expected = reference_outputs[field]
        content = outputs.get("content")
        actual = content[field] if isinstance(content, dict) and field in content else outputs.get("body")
        if actual is None:
            return False
        if matcher == "exact":
            return bool(actual == expected)
        if matcher == "casefold":
            return str(actual).casefold() == str(expected).casefold()
        return str(expected) in str(actual)

    return Scorer(_check, key="final_answer_matches")

```

### Core Architecture Module: `ag2/eval/scorers/cost.py`
```
# Copyright (c) 2026, AG2ai, Inc., AG2ai open-source projects maintainers and core contributors
#
# SPDX-License-Identifier: Apache-2.0

"""Prebuilt scorers for cost-discipline checks."""

from ..scorer import Scorer
from ..trace import Trace

__all__ = ("token_budget",)


def token_budget(max_tokens: int) -> Scorer:
    """Pass iff a task's total ``input + output`` tokens stay at or under ``max_tokens``.

    The check is **per task** — ``trace.tokens.total`` is one task's usage. Cache
    tokens are excluded; they're reported separately on
    :class:`~ag2.eval.trace.TokenUsage` and priced differently by most
    providers. This emits a pass/fail signal into the run's pass-rate aggregate;
    for the same per-task limit recorded as a dedicated ``budget_violation`` count
    instead, use :class:`~ag2.eval.BudgetThresholds` (also observational —
    neither aborts the run).
    """

    def _check(trace: Trace) -> bool:
        return trace.tokens.total <= max_tokens

    return Scorer(_check, key="token_budget")

```

### Core Architecture Module: `ag2/eval/scorers/human_pairwise.py`
```
# Copyright (c) 2026, AG2ai, Inc., AG2ai open-source projects maintainers and core contributors
#
# SPDX-License-Identifier: Apache-2.0

"""Human pairwise comparators — the same A-vs-B unit, decided by a person.

Two modes (both are :class:`PairwiseComparator`, interchangeable with
``pairwise_judge``):

* **Offline** — :func:`export_pairwise_cases` writes a *blinded* JSONL manifest
  (Response 1/2 order randomized and recorded as ``first_variant``); a person /
  UI fills in ``preferred`` per line; :func:`human_labels` reads it back and
  de-blinds to an a/b/tie outcome. Scales, UI-agnostic, and is the calibration
  workflow (run alongside ``pairwise_judge`` and compare with
  ``PairwiseRunResult.agreement``).
* **Inline** — :func:`human_pairwise` prompts during the run via an ``ask``
  callback (terminal by default), randomizing + de-blinding per case.

Position handling for humans is a single blinded randomized order (asking twice
is wasteful and itself biasing) — unlike the LLM judge's dual-order swap.
"""

import inspect
import json
import random
from collections.abc import Awaitable, Callable, Iterable
from pathlib import Path
from typing import Any

from ag2.events import ModelResponse

from ..dataset import Suite, Task
from ..pairwise import PairwiseComparator, PairwiseOutcome
from ..sources import TraceRef, TraceSource
from ..trace import Trace

__all__ = (
    "export_pairwise_cases",
    "human_labels",
    "human_pairwise",
)

# A human's per-case answer and the renderer it's shown: returns "1" / "2" / "tie".
AskHuman = Callable[[Task, str, str], "str | Awaitable[str]"]


async def export_pairwise_cases(
    source_a: TraceSource,
    source_b: TraceSource,
    *,
    criteria: Iterable[str],
    out: str,
    suite: Suite | None = None,
    seed: int | None = None,
) -> Path:
    """Write a blinded JSONL labeling manifest for the paired traces.

    One line per (task, criterion): ``{case_id, task_id, criterion, task_input,
    response_1, response_2, first_variant}``. ``first_variant`` records which
    variant is Response 1 (de-blinding key — a labeling UI must not show it).
    A labeler adds ``preferred`` ("1"/"2"/"tie") per line; feed the result to
    :func:`human_labels`.
    """
    criteria = list(criteria)
    rng = random.Random(seed)
    tasks_by_id = {task.task_id: task for task in suite} if suite is not None else {}

    refs_a = [ref async for ref in source_a.list()]
    b_by_task: dict[str, TraceRef] = {}
    async for ref in source_b.list():
        if ref.task_id is not None:
            b_by_task[ref.task_id] = ref

    lines: list[dict[str, Any]] = []
    for ref_a in refs_a:
        if ref_a.task_id is None or ref_a.task_id not in b_by_task:
            continue
        answer_a = _final_text(await source_a.load(ref_a))
        answer_b = _final_text(await source_b.load(b_by_task[ref_a.task_id]))
        task = tasks_by_id.get(ref_a.task_id) or Task(task_id=ref_a.task_id, inputs={})
        first_variant = rng.choice(["a", "b"])
        response_1, response_2 = (answer_a, answer_b) if first_variant == "a" else (answer_b, answer_a)
        for criterion in criteria:
            lines.append({
                "case_id": f"{ref_a.task_id}::{criterion}",
                "task_id": ref_a.task_id,
                "criterion": criterion,
                "task_input": task.inputs.get("input"),
                "response_1": response_1,
                "response_2": response_2,
                "first_variant": first_variant,
            })

    path = Path(out)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text("".join(json.dumps(line) + "\n" for line in lines), encoding="utf-8")
    return path


def human_labels(path: str, *, criterion: str, key: str) -> PairwiseComparator:
    """A comparator reading human labels for one criterion from a manifest JSONL."""
    return _HumanLabels(path, criterion, key)


def human_pairwise(*, key: str, ask: AskHuman | None = None, seed: int | None = None) -> PairwiseComparator:
    """An inline comparator that asks a human per case (terminal ``ask`` by default)."""
    return _HumanInline(key, ask or _terminal_ask, random.Random(seed))


class _HumanLabels:
    """Offline human comparator: reads de-blinded labels lazily on first use."""

    def __init__(self, path: str, criterion: str, key: str) -> None:
        self.key = key
        self._path = Path(path)
        self._criterion = criterion
        self._by_task: dict[str, tuple[str, Any]] | None = None

    def _labels(self) -> dict[str, tuple[str, Any]]:
        if self._by_task is None:
            by_task: dict[str, tuple[str, Any]] = {}
            for raw in self._path.read_text(encoding="utf-8").splitlines():
                if not raw.strip():
                    continue
                record = json.loads(raw)
                if record.get("criterion") != self._criterion:
                    continue
                by_task[record["task_id"]] = (record.get("first_variant", "a"), record.get("preferred"))
            self._by_task = by_task
        return self._by_task

    async def compare(
        self, *, task: Task, trace_a: Trace, trace_b: Trace, reference_outputs: dict[str, Any] | None
    ) -> PairwiseOutcome:
        entry = self._labels().get(task.task_id)
        if entry is None or entry[1] is None:
            return PairwiseOutcome(winner="tie", reasoning="no human label", detail={"missing": True})
        first_variant, preferred = entry
        return PairwiseOutcome(
            winner=_deblind(preferred, first_variant),
            reasoning="human label",
            detail={"preferred": preferred, "first_variant": first_variant},
        )


class _HumanInline:
    """Inline human comparator: blinded single presentation via an ask callback."""

    def __init__(self, key: str, ask: AskHuman, rng: random.Random) -> None:
        self.key = key
        self._ask = ask
        self._rng = rng

    async def compare(
        self, *, task: Task, trace_a: Trace, trace_b: Trace, reference_outputs: dict[str, Any] | None
    ) -> PairwiseOutcome:
        answer_a, answer_b = _final_text(trace_a), _final_text(trace_b)
        first_variant = self._rng.choice(["a", "b"])
        response_1, response_2 = (answer_a, answer_b) if first_variant == "a" else (answer_b, answer_a)
        preferred = self._ask(task, response_1, response_2)
        if inspect.isawaitable(preferred):
            preferred = await preferred
        return PairwiseOutcome(
            winner=_deblind(preferred, first_variant),
            reasoning="human (inline)",
            detail={"preferred": preferred, "first_variant": first_variant},
        )


def _deblind(preferred: Any, first_variant: str) -> str:
    other = "b" if first_variant == "a" else "a"
    if str(preferred) == "1":
        return first_variant
    if str(preferred) == "2":
        return other
    return "tie"


def _final_text(trace: Trace) -> str:
    responses = trace.events_of(ModelResponse)
    if responses and responses[-1].content is not None:
        return responses[-1].content
    return "(no answer)"


def _terminal_ask(task: Task, response_1: str, response_2: str) -> str:
    print(f"\nTask: {task.inputs.get('input')}\n[1] {response_1}\n[2] {response_2}")
    return input("Which is better? 1 / 2 / tie: ").strip() or "tie"

```

### Core Architecture Module: `ag2/eval/scorers/judge.py`
```
# Copyright (c) 2026, AG2ai, Inc., AG2ai open-source projects maintainers and core contributors
#
# SPDX-License-Identifier: Apache-2.0

"""Agent-as-judge scorer — grade one criterion with an ``Agent``.

``agent_judge`` is a *single-purpose* judge: one call grades exactly one
criterion and emits exactly one :class:`~ag2.eval.Feedback` key. A
multi-dimensional scorecard is a *list* of these::

    from ag2.eval.scorers import agent_judge

    scorers = [
        agent_judge(config, criterion="Answer is correct vs the reference.", key="correctness"),
        agent_judge(config, criterion="Every claim is grounded in the tool results.", key="faithfulness"),
    ]

Each judge becomes its own column in ``RunResult`` (numeric ``score`` →
``score_stats[key]``), so the per-dimension scores are available structurally,
not just in a rendered summary.

The judge is composed, not subclassed: the factory builds and holds an
``Agent`` whose ``response_schema`` is locked to :class:`Verdict`. Because the
scorer only reads the injected :class:`~ag2.eval.Trace` and dicts, the
same judge works under both ``run_agent()`` (live) and ``evaluate_traces()`` (trace-based).
"""

import json
from collections.abc import Iterable
from typing import Any

from pydantic import BaseModel, Field

from ag2.agent import Agent
from ag2.config import ModelConfig
from ag2.events import ToolCallEvent, ToolErrorEvent, ToolResultEvent
from ag2.middleware.base import MiddlewareFactory

from .._types import Feedback
from ..scorer import Scorer
from ..trace import Trace
from .threshold import threshold as _threshold

__all__ = (
    "Verdict",
    "agent_judge",
)


class Verdict(BaseModel):
    """One judge's structured grade on a single criterion.

    Both fields are required (no optionals): OpenAI's strict structured-output
    mode rejects a schema whose ``required`` omits any property, so an optional
    field would make the judge unusable on OpenAI.
    """

    score: float = Field(
        description="Numeric grade for this one criterion, within the judge's scale (higher is better)."
    )
    reasoning: str = Field(description="A brief justification for the score.")


def agent_judge(
    config: ModelConfig,
    *,
    criterion: str,
    key: str,
    scale: tuple[float, float] = (0.0, 1.0),
    include_trace: bool = False,
    include_reference: bool = True,
    retries: int = 1,
    middleware: Iterable[MiddlewareFactory] = (),
    threshold: float | None = None,
) -> Scorer:
    """Build a single-purpose Agent-as-judge :class:`Scorer`.

    Args:
        config: Model config for the judge agent (e.g. an ``AnthropicConfig``;
            pin temperature to 0 for stable grading).
        criterion: The single standard this judge grades against, in plain
            English. One judge grades one criterion — compose several judges
            for a multi-dimensional scorecard.
        key: The ``Feedback`` key this judge emits; becomes its column in
            ``RunResult`` aggregates. Use a distinct key per criterion.
        scale: ``(low, high)`` numeric range. **Enforced** — a score outside the
            range is clamped to the nearest bound (and the clamp is noted in the
            feedback comment). Default ``(0.0, 1.0)``.
        include_trace: When ``True``, the agent's tool-call trajectory (calls,
            results, errors) is rendered into the judge prompt (process grading).
            Default grades the final answer only.
        include_reference: When ``True`` (default), render the task's reference
            answer into the prompt as a ``## Reference`` section whenever
            ``reference_outputs`` is present. Set ``False`` for dimensions that must
            judge the answer on its own (e.g. faithfulness / grounding), so the
            golden answer cannot leak into the grade.
        retries: How many times ``content()`` re-asks the judge if its output
            fails :class:`Verdict` validation. Default ``1``.
        middleware: Middleware factories attached to the judge agent. Pass
            ``TelemetryMiddleware`` here to capture the judge's own LLM spans /
            token usage (judge cost), tracked separately from the agent graded.
        threshold: When set, gate the numeric score into a Pass/Fail — the judge's
            column then lands in ``result.pass_rate(key)`` (pass iff
            ``score >= threshold``) and the raw number is recorded in the feedback's
            ``detail``. A judge that returns no verdict counts as a fail. Default
            ``None`` keeps the numeric score (``score_stats``). Shorthand for wrapping
            the judge in :func:`~ag2.eval.scorers.threshold`.
    """
    low, high = scale
    judge = Agent(
        f"judge_{key}",
        _system_prompt(criterion, low, high),
        config=config,
        response_schema=Verdict,
        middleware=middleware,
    )

    async def _judge(
        inputs: dict[str, Any],
        outputs: dict[str, Any],
        reference_outputs: dict[str, Any] | None,
        trace: Trace,
    ) -> Feedback:
        prompt = _render_prompt(
            inputs,
            outputs,
            reference_outputs,
            trace,
            include_trace=include_trace,
            include_reference=include_reference,
        )
        reply = await judge.ask(prompt)
        verdict = await reply.content(retries=retries)
        if verdict is None:
            return Feedback(key=key, score=None, comment="judge returned no verdict")
        score = min(max(verdict.score, low), high)
        comment = verdict.reasoning
        if score != verdict.score:
            comment = f"{comment} [score clamped from {verdict.score} to scale {low}-{high}]"
        return Feedback(key=key, score=score, comment=comment)

    judge_scorer = Scorer(_judge, key=key)
    if threshold is not None:
        return _threshold(judge_scorer, at_least=threshold)
    return judge_scorer


def _system_prompt(criterion: str, low: float, high: float) -> str:
    return (
        "You are a strict evaluator grading an AI agent's response against a single criterion. "
        f"Criterion: {criterion}\n"
        f"Return a numeric score from {low} to {high} (higher is better) and a brief reasoning. "
        "Judge only this criterion — nothing else."
    )


def _render_prompt(
    inputs: dict[str, Any],
    outputs: dict[str, Any],
    reference_outputs: dict[str, Any] | None,
    trace: Trace,
    *,
    include_trace: bool,
    include_reference: bool,
) -> str:
    sections: list[str] = []
    task_input = inputs.get("input")
    if task_input is not None:
        sections.append(f"## Task input\n{task_input}")
    answer = outputs.get("body")
    sections.append(f"## Agent answer\n{answer if answer is not None else '(no answer)'}")
    if include_reference and reference_outputs:
        sections.append(f"## Reference\n{json.dumps(reference_outputs)}")
    if include_trace:
        sections.append(f"## Trajectory\n{_render_trajectory(trace)}")
    return "\n\n".join(sections)


def _render_trajectory(trace: Trace) -> str:
    lines: list[str] = []
    for event in trace.events:
        if isinstance(event, ToolErrorEvent):
            lines.append(f"  -> ERROR: {event.error}")
        elif isinstance(event, ToolResultEvent):
            lines.append(f"  -> result: {_first_text(event)}")
        elif isinstance(event, ToolCallEvent):
            lines.append(f"- call {event.name}({event.arguments})")
    return "\n".join(lines) if lines else "(no tool calls)"


def _first_text(event: ToolResultEvent) -> str:
    parts = event.result.parts
    if parts and hasattr(parts[0], "content"):
        return str(parts[0].content)
    return "(result)"

```

### Core Architecture Module: `ag2/eval/scorers/pairwise_judge.py`
```
# Copyright (c) 2026, AG2ai, Inc., AG2ai open-source projects maintainers and core contributors
#
# SPDX-License-Identifier: Apache-2.0

"""Pairwise Agent-as-judge — an LLM :class:`PairwiseComparator`.

``pairwise_judge`` compares two responses against one criterion and returns a
:class:`~ag2.eval.PairwiseOutcome`. It defends against LLM positional
bias with a **dual-order swap**: it asks the judge twice with the responses
swapped and only declares a winner if the *same* answer wins in both orders —
a flip resolves to a tie. The judge's per-call schema is position-based
(``first`` / ``second``, never A/B) so order can't leak, and has no optional
fields (OpenAI strict structured-output compatibility).

Single-purpose, like ``agent_judge``: one criterion, one ``key``. A
multi-criteria pairwise scorecard is a list of these.
"""

import json
from collections.abc import Iterable
from typing import Any, Literal

from pydantic import BaseModel, Field

from ag2.agent import Agent
from ag2.config import ModelConfig
from ag2.events import ModelResponse
from ag2.middleware.base import MiddlewareFactory

from ..dataset import Task
from ..pairwise import PairwiseComparator, PairwiseOutcome
from ..trace import Trace
from .judge import _render_trajectory

__all__ = (
    "PairwiseVerdict",
    "pairwise_judge",
)


class PairwiseVerdict(BaseModel):
    """One judge call's preference, by position (not variant). Both fields required."""

    preferred: Literal["first", "second", "tie"] = Field(
        description="Which response is better on the criterion: 'first', 'second', or 'tie'."
    )
    reasoning: str = Field(description="A brief justification.")


def pairwise_judge(
    config: ModelConfig,
    *,
    criterion: str,
    key: str,
    include_trace: bool = False,
    include_reference: bool = True,
    retries: int = 1,
    swap: bool = True,
    middleware: Iterable[MiddlewareFactory] = (),
) -> PairwiseComparator:
    """Build an LLM pairwise comparator for one criterion.

    Args:
        config: Judge model config (pin temperature 0; use a different model
            family than the variants to avoid self-preference bias).
        criterion: The single standard to compare on, in plain English.
        key: Result column this comparator reports under.
        include_trace: Render each response's tool-call trajectory into the prompt.
        include_reference: When ``True`` (default), render the reference answer
            into the prompt as a ``## Reference`` section whenever
            ``reference_outputs`` is present. Set ``False`` for dimensions that must
            judge the responses on their own (e.g. faithfulness / grounding), so the
            golden answer cannot leak into the comparison.
        retries: ``content()`` re-asks on schema-validation failure.
        swap: Run the dual-order position-swap (default, recommended). When
            ``False``, a single call is used (faster, position-biased).
        middleware: Middleware for the judge agent (e.g. ``TelemetryMiddleware``).
    """
    judge = Agent(
        f"pairwise_judge_{key}",
        _system_prompt(criterion),
        config=config,
        response_schema=PairwiseVerdict,
        middleware=middleware,
    )
    return _PairwiseJudge(
        judge, key, include_trace=include_trace, include_reference=include_reference, retries=retries, swap=swap
    )


class _PairwiseJudge:
    """A :class:`PairwiseComparator` backed by a judge :class:`Agent`."""

    def __init__(
        self, judge: Agent, key: str, *, include_trace: bool, include_reference: bool, retries: int, swap: bool
    ) -> None:
        self._judge = judge
        self.key = key
        self._include_trace = include_trace
        self._include_reference = include_reference
        self._retries = retries
        self._swap = swap

    async def compare(
        self,
        *,
        task: Task,
        trace_a: Trace,
        trace_b: Trace,
        reference_outputs: dict[str, Any] | None,
    ) -> PairwiseOutcome:
        answer_a, answer_b = _final_text(trace_a), _final_text(trace_b)

        v1 = await self._verdict(task, reference_outputs, answer_a, answer_b, trace_a, trace_b)
        if not self._swap:
            return PairwiseOutcome(
                winner=_pref_to_ab(v1.preferred, "a", "b"), reasoning=v1.reasoning, detail={"order1": v1.preferred}
            )

        v2 = await self._verdict(task, reference_outputs, answer_b, answer_a, trace_b, trace_a)
        w1 = _pref_to_ab(v1.preferred, "a", "b")  # order 1: Response 1 = A
        w2 = _pref_to_ab(v2.preferred, "b", "a")  # order 2: Response 1 = B
        winner = w1 if (w1 == w2 and w1 != "tie") else "tie"  # conservative: win only if consistent
        return PairwiseOutcome(
            winner=winner,
            reasoning=v1.reasoning,
            detail={"order1": v1.preferred, "order2": v2.preferred},
        )

    async def _verdict(
        self,
        task: Task,
        reference_outputs: dict[str, Any] | None,
        first: str,
        second: str,
        trace_first: Trace,
        trace_second: Trace,
    ) -> PairwiseVerdict:
        prompt = _render(
            task,
            reference_outputs,
            first,
            second,
            trace_first,
            trace_second,
            self._include_trace,
            self._include_reference,
        )
        reply = await self._judge.ask(prompt)
        verdict = await reply.content(retries=self._retries)
        return (
            verdict if verdict is not None else PairwiseVerdict(preferred="tie", reasoning="judge returned no verdict")
        )


def _pref_to_ab(preferred: str, first: str, second: str) -> str:
    if preferred == "first":
        return first
    if preferred == "second":
        return second
    return "tie"


def _final_text(trace: Trace) -> str:
    responses = trace.events_of(ModelResponse)
    if responses and responses[-1].content is not None:
        return responses[-1].content
    return "(no answer)"


def _system_prompt(criterion: str) -> str:
    return (
        "You are comparing two AI responses against a single criterion. "
        f"Criterion: {criterion}\n"
        'Decide which response is better on THIS criterion only: answer "first", "second", or "tie". '
        "Do not favor a response for its position or its length."
    )


def _render(
    task: Task,
    reference_outputs: dict[str, Any] | None,
    first: str,
    second: str,
    trace_first: Trace,
    trace_second: Trace,
    include_trace: bool,
    include_reference: bool,
) -> str:
    sections: list[str] = []
    task_input = task.inputs.get("input")
    if task_input is not None:
        sections.append(f"## Task\n{task_input}")
    if include_reference and reference_outputs:
        sections.append(f"## Reference\n{json.dumps(reference_outputs)}")
    sections.append(f"## Response 1\n{first}")
    if include_trace:
        sections.append(f"### Response 1 trajectory\n{_render_trajectory(trace_first)}")
    sections.append(f"## Response 2\n{second}")
    if include_trace:
        sections.append(f"### Response 2 trajectory\n{_render_trajectory(trace_second)}")
    return "\n\n".join(sections)

```

### Core Architecture Module: `ag2/eval/scorers/threshold.py`
```
# Copyright (c) 2026, AG2ai, Inc., AG2ai open-source projects maintainers and core contributors
#
# SPDX-License-Identifier: Apache-2.0

"""Threshold combinator — turn a numeric scorer into a Pass/Fail gate.

``threshold`` wraps any scorer that produces a numeric grade and returns a new
:class:`~ag2.eval.Scorer` whose grade is a boolean pass/fail derived from that
number — for automation gating ("reject anything that fails")::

    from ag2.eval.scorers import agent_judge, threshold

    quality = agent_judge(config, criterion="The answer is helpful.", key="quality")
    gate = threshold(quality, at_least=0.7)  # scorer -> scorer

    # ...or the agent_judge convenience param (same thing):
    gate = agent_judge(config, criterion="...", key="quality", threshold=0.7)

A gated criterion emits ONE :class:`~ag2.eval.Feedback`: ``score`` is the boolean
(so it lands in ``result.pass_rate(key)`` and ``diff().regressions``), and the raw number +
bounds are recorded in ``detail`` (persisted in the run JSON). A feedback with no numeric
grade — the judge returned no verdict, or the scorer raised → ``score=None`` — is a **fail**.
Already-boolean and categorical (``value``) feedback passes through unchanged.

This mirrors DeepEval's / promptfoo's ``threshold`` and Braintrust's "pass threshold". For a
per-task token/time *resource* gate, see :class:`~ag2.eval.BudgetThresholds` — a
different axis.
"""

from typing import Any

from .._types import Feedback
from ..dataset import Task
from ..scorer import Scorer
from ..trace import Trace

__all__ = ("threshold",)


def threshold(
    scorer: Scorer,
    *,
    at_least: float | None = None,
    at_most: float | None = None,
    key: str | None = None,
) -> Scorer:
    """Wrap a numeric ``scorer`` into a Pass/Fail gate.

    Args:
        scorer: The scorer to gate. Its numeric feedback is converted to a boolean
            pass/fail; already-boolean, categorical, and no-signal feedback passes
            through unchanged.
        at_least: Inclusive lower bound — pass requires ``score >= at_least``.
        at_most: Inclusive upper bound — pass requires ``score <= at_most``.
        key: Feedback key for the gate. Defaults to the source feedback's key (the
            column simply becomes pass/fail).

    At least one of ``at_least`` / ``at_most`` must be set. A numeric feedback becomes
    ``Feedback(score=<pass bool>, detail={"score": <n>, ...})`` (the raw number is kept in
    ``detail``); a ``None`` score (ungradeable) becomes ``False`` (fail).
    """
    if at_least is None and at_most is None:
        raise ValueError("threshold(): set at_least and/or at_most")

    async def _threshold(
        inputs: dict[str, Any],
        outputs: dict[str, Any],
        reference_outputs: dict[str, Any] | None,
        trace: Trace,
        task: Task,
    ) -> list[Feedback]:
        feedbacks = await scorer(
            inputs=inputs,
            outputs=outputs,
            reference_outputs=reference_outputs,
            trace=trace,
            task=task,
        )
        return [_gate(fb, at_least, at_most, key) for fb in feedbacks]

    return Scorer(_threshold, key=key or scorer.key)


def _gate(fb: Feedback, at_least: float | None, at_most: float | None, key: str | None) -> Feedback:
    """Reshape one feedback: numeric → pass/fail, ungradeable → fail, else pass through."""
    out_key = key or fb.key
    bounds = {"at_least": at_least, "at_most": at_most}

    if isinstance(fb.score, (int, float)) and not isinstance(fb.score, bool):
        passed = (at_least is None or fb.score >= at_least) and (at_most is None or fb.score <= at_most)
        return Feedback(
            key=out_key,
            score=passed,
            comment=_comment(f"score {fb.score} {_bound_text(at_least, at_most)} → {'pass' if passed else 'fail'}", fb),
            detail={**(fb.detail or {}), "score": fb.score, **bounds},
        )

    if fb.score is None and fb.value is None:  # ungradeable → fail
        return Feedback(
            key=out_key,
            score=False,
            comment=_comment("ungradeable → fail", fb),
            detail={**(fb.detail or {}), "score": None, **bounds},
        )

    return fb  # already bool, or categorical: not a numeric grade to threshold


def _bound_text(at_least: float | None, at_most: float | None) -> str:
    parts = []
    if at_least is not None:
        parts.append(f">= {at_least}")
    if at_most is not None:
        parts.append(f"<= {at_most}")
    return " and ".join(parts)


def _comment(message: str, fb: Feedback) -> str:
    return f"{message}; {fb.comment}" if fb.comment else message

```

### Core Architecture Module: `ag2/eval/scorers/tools.py`
```
# Copyright (c) 2026, AG2ai, Inc., AG2ai open-source projects maintainers and core contributors
#
# SPDX-License-Identifier: Apache-2.0

"""Prebuilt scorers for tool-use correctness.

These are factory functions: each call returns a :class:`Scorer` ready
to drop into ``scorers=[...]``::

    from ag2.eval.scorers import tool_called, no_tool_errors

    scorers = [
        tool_called("get_weather"),
        no_tool_errors(),
    ]

The closures inside each factory are created once per scorer instance
(at user setup time), not per task — same shape as a decorator factory,
which AGENTS.md explicitly permits.
"""

from ag2.events import ToolCallEvent, ToolErrorEvent

from ..scorer import Scorer
from ..trace import Trace

__all__ = (
    "no_tool_errors",
    "tool_called",
)


def tool_called(name: str, *, exactly: int | None = None) -> Scorer:
    """Pass iff the agent called the tool ``name``.

    Args:
        name: The tool name to look for in ``ToolCallEvent.name``.
        exactly: If set, pass iff the call count equals this value.
            Default (``None``) means "at least one call".

    Returns:
        A :class:`Scorer` with key ``"tool_called[<name>]"`` so multiple
        instances coexist in one run without clashing.
    """

    def _check(trace: Trace) -> bool:
        count = len(trace.events_of(ToolCallEvent, name=name))
        if exactly is not None:
            return count == exactly
        return count >= 1

    return Scorer(_check, key=f"tool_called[{name}]")


def no_tool_errors() -> Scorer:
    """Pass iff zero :class:`ToolErrorEvent`\\ s fired during the run."""

    def _check(trace: Trace) -> bool:
        return len(trace.events_of(ToolErrorEvent)) == 0

    return Scorer(_check, key="no_tool_errors")

```

### Core Architecture Module: `ag2/events/lifecycle.py`
```
# Copyright (c) 2026, AG2ai, Inc., AG2ai open-source projects maintainers and core contributors
#
# SPDX-License-Identifier: Apache-2.0

"""Agent lifecycle events: observer, compaction, aggregation, and deserialization.

These events are emitted by Agent (framework core) during execution. They are
not network-specific — any Agent emits them regardless of Hub registration.

Task-subagent lifecycle events live in ``ag2.events``
(``TaskStarted`` / ``TaskProgress`` / ``TaskCompleted`` / ``TaskFailed``).
"""

from .base import BaseEvent, Field


class ObserverStarted(BaseEvent):
    """Emitted when an observer attaches to the agent's stream."""

    __transient__ = True

    name: str


class ObserverCompleted(BaseEvent):
    """Emitted when an observer detaches from the agent's stream."""

    __transient__ = True

    name: str


class CompactionStarted(BaseEvent):
    """Emitted on the agent's stream when compaction begins.

    Paired with either ``CompactionCompleted`` (success) or
    ``CompactionFailed`` (the strategy raised). Subscribe to both if you
    need to know that a compaction attempt was made — relying on
    ``CompactionCompleted`` alone hides errors.
    """

    __transient__ = True

    agent: str
    strategy: str
    event_count: int


class CompactionCompleted(BaseEvent):
    """Emitted on the agent's stream when compaction finishes."""

    __transient__ = True

    agent: str
    strategy: str
    events_before: int
    events_after: int
    llm_calls: int = 0
    usage: dict = Field(default_factory=dict)


class CompactionFailed(BaseEvent):
    """Emitted on the agent's stream when a compaction strategy raises.

    The exception is also logged via the module logger, but the stream
    event is the durable signal — observers and tests should subscribe
    here rather than configuring Python logging.
    """

    __transient__ = True

    agent: str
    strategy: str
    error_type: str
    error: str


class AggregationStarted(BaseEvent):
    """Emitted on the agent's stream when aggregation begins.

    Paired with either ``AggregationCompleted`` (success) or
    ``AggregationFailed`` (the strategy raised). Subscribe to both if you
    need to know that an aggregation attempt was made.
    """

    __transient__ = True

    agent: str
    strategy: str
    event_count: int


class AggregationCompleted(BaseEvent):
    """Emitted on the agent's stream when aggregation finishes."""

    __transient__ = True

    agent: str
    strategy: str
    event_count: int
    llm_calls: int = 0
    usage: dict = Field(default_factory=dict)


class AggregationFailed(BaseEvent):
    """Emitted on the agent's stream when an aggregation strategy raises.

    The exception is also logged via the module logger, but the stream
    event is the durable signal — observers and tests should subscribe
    here rather than configuring Python logging.
    """

    __transient__ = True

    agent: str
    strategy: str
    error_type: str
    error: str


class EventLogFailed(BaseEvent):
    """Emitted when the post-``ask`` event-log writer raises.

    Fires after the agent's turn completes but before ``ask`` returns. The
    failure does not interrupt the turn — the reply is still delivered —
    but log persistence into ``/log/{stream_id}.jsonl`` did not happen.
    """

    __transient__ = True

    agent: str
    error_type: str
    error: str


class UnknownEvent(BaseEvent):
    """Placeholder for events whose type cannot be resolved during deserialization.

    Preserves the raw data so nothing is lost.
    """

    type_name: str
    data: dict = Field(default_factory=dict)

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #2053** (2026-05-28): **[Issue]: Incompatibility; LlamaIndexConversable doesn't work with the new LlamaIndex ReAct agent.**
  *Symptoms*: ### Describe the issue  You need to update the LlamaIndexConversable agent in AG2 to be compatible with the new ReAct agent introduced in LlamaIndex version 0.13. The current version of LlamaIndexConversable is not working because it's looking for a chat() method that no longer exists in the updated ReAct agent.  ### Steps to reproduce  _No response_  ### Screenshots and logs  _No response_  ### Additional Information  _No response_
  **Post-Mortem & Fix Analysis**:
  > @afshinebtia thanks for reporting! Will take a look!

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

### Incident Patch 1: `3c5a869a` (2026-10-04)
**Commit Message**: refactor(typing): bring mcp_ui, mcp and acp into the type-checked set (#3356)

**File**: `ag2/acp/bridge.py` (modified, +6/-6)
```diff
@@ -270,9 +270,9 @@ async def session_update(self, session_id: str, update: SessionUpdate, **kwargs:
 
     async def request_permission(
         self,
-        options: list[schema.PermissionOption],
         session_id: str,
         tool_call: schema.ToolCallUpdate,
+        options: list[schema.PermissionOption],
         **kwargs: Any,
     ) -> schema.RequestPermissionResponse:
         chosen = await self.state.resolve_permission(options, tool_call)
@@ -304,28 +304,28 @@ async def complete_elicitation(self, elicitation_id: str, **kwargs: Any) -> None
 
     async def read_text_file(
         self,
-        path: str,
         session_id: str,
-        limit: int | None = None,
+        path: str,
         line: int | None = None,
+        limit: int | None = None,
         **kwargs: Any,
     ) -> schema.ReadTextFileResponse:
         content = self.state.read_text_file(path, line=line, limit=limit)
         return schema.ReadTextFileResponse(content=content)
 
     async def write_text_file(
-        self, content: str, path: str, session_id: str, **kwargs: Any
+        self, session_id: str, path: str, content: str, **kwargs: Any
     ) -> schema.WriteTextFileResponse:
         self.state.write_text_file(content, path)
         return schema.WriteTextFileResponse()
 
     async def create_terminal(
         self,
-        command: str,
         session_id: str,
+        command: str,
         args: list[str] | None = None,
-        cwd: str | None = None,
         env: list[schema.EnvVariable] | None = None,
+        cwd: str | None = None,
         output_byte_limit: int | None = None,
         **kwargs: Any,
     ) -> schema.CreateTerminalResponse:
```

**File**: `ag2/acp/testing.py` (modified, +6/-3)
```diff
@@ -209,17 +209,20 @@ class _FakeConfigViews:
 
     __slots__ = ()
 
+    _sessions: "dict[StreamId, ACPSession]"
+    _connect: "ConnectHook | None"
+
     @property
     def sessions(self) -> "dict[StreamId, ACPSession]":
         """Live sessions keyed by stream id (empty once ``aclose()`` ran)."""
-        return self._sessions  # type: ignore[attr-defined]
+        return self._sessions
 
     @property
     def connect(self) -> "ConnectHook":
         """The in-process connection opener, for driving ``ACPSession.ensure`` directly."""
-        connect = self._connect  # type: ignore[attr-defined]
+        connect = self._connect
         assert connect is not None
-        return cast("ConnectHook", connect)
+        return connect
 
 
 @dataclass(slots=True, kw_only=True)
```

**File**: `ag2/acp/tool_gateway.py` (modified, +1/-1)
```diff
@@ -446,7 +446,7 @@ async def _execute(self, name: str, arguments: dict[str, Any]) -> CallToolResult
         call = ToolCallEvent(name, arguments=json.dumps(arguments))
         try:
             async with context.stream.get(
-                (ToolErrorEvent.parent_id == call.id)
+                (ToolErrorEvent.parent_id == call.id)  # type: ignore[arg-type]  # event-field DSL: `==` builds a Condition
                 | (ToolResultEvent.parent_id == call.id)
                 | (ClientToolCallEvent.id == call.id)
             ) as pending:
```

**File**: `ag2/mcp/__init__.py` (modified, +4/-4)
```diff
@@ -34,7 +34,7 @@
     from .transport import TransportConfig
 except ImportError as e:  # pragma: no cover - exercised only when ag2[mcp] is absent
     MCPServer = missing_optional_dependency("MCPServer", "mcp", e)  # type: ignore[misc]
-    build_ask_tool = missing_optional_dependency("build_ask_tool", "mcp", e)  # type: ignore[misc]
+    build_ask_tool = missing_optional_dependency("build_ask_tool", "mcp", e)
     AskContext = missing_optional_dependency("AskContext", "mcp", e)  # type: ignore[misc]
     ContextProvider = missing_optional_dependency("ContextProvider", "mcp", e)  # type: ignore[misc]
     SessionConfig = missing_optional_dependency("SessionConfig", "mcp", e)  # type: ignore[misc]
@@ -47,17 +47,17 @@
     PromptArgument = missing_optional_dependency("PromptArgument", "mcp", e)  # type: ignore[misc]
     PromptMessage = missing_optional_dependency("PromptMessage", "mcp", e)  # type: ignore[misc]
     MCPFunctionTool = missing_optional_dependency("MCPFunctionTool", "mcp", e)  # type: ignore[misc]
-    mcp_tool = missing_optional_dependency("mcp_tool", "mcp", e)  # type: ignore[misc]
+    mcp_tool = missing_optional_dependency("mcp_tool", "mcp", e)
     Elicit = missing_optional_dependency("Elicit", "mcp", e)  # type: ignore[misc]
     ListRoots = missing_optional_dependency("ListRoots", "mcp", e)  # type: ignore[misc]
     Resolve = missing_optional_dependency("Resolve", "mcp", e)  # type: ignore[misc]
     Sample = missing_optional_dependency("Sample", "mcp", e)  # type: ignore[misc]
     RequestStateSecurity = missing_optional_dependency("RequestStateSecurity", "mcp", e)  # type: ignore[misc]
-    client_extension = missing_optional_dependency("client_extension", "mcp", e)  # type: ignore[misc]
+    client_extension = missing_optional_dependency("client_extension", "mcp", e)
     ExtensionMap = missing_optional_dependency("ExtensionMap", "mcp", e)  # type: ignore[misc]
     AppSandbox = missing_optional_dependency("AppSandbox", "mcp", e)  # type: ignore[misc]
     MCPApp = missing_optional_dependency("MCPApp", "mcp", e)  # type: ignore[misc]
-    client_supports_apps = missing_optional_dependency("client_supports_apps", "mcp", e)  # type: ignore[misc]
+    client_supports_apps = missing_optional_dependency("client_supports_apps", "mcp", e)
     MCPRequestContext = missing_optional_dependency("MCPRequestContext", "mcp", e)  # type: ignore[misc]
     ResourceCsp = missing_optional_dependency("ResourceCsp", "mcp", e)  # type: ignore[misc]
     ResourcePermissions = missing_optional_dependency("ResourcePermissions", "mcp", e)  # type: ignore[misc]
```

**File**: `ag2/mcp/resources.py` (modified, +3/-3)
```diff
@@ -212,9 +212,9 @@ async def read(self, uri: str, context: MCPExecutionContext | None = None) -> li
 
 
 async def _call_resource_read(read: ReadFn, context: MCPExecutionContext | None) -> ResourceContent:
-    if context is None:
-        return await call_user_fn(read)
-    return await call_with_context(read, context)
+    # Both run the author's reader, whose return `ReadFn` states; they hand it back as `Any`.
+    data: ResourceContent = await call_user_fn(read) if context is None else await call_with_context(read, context)
+    return data
 
 
 def _to_wire_contents(uri: str, contents: ReadResourceContents) -> TextResourceContents | BlobResourceContents:
```

**File**: `ag2/mcp/testing.py` (modified, +5/-4)
```diff
@@ -14,6 +14,7 @@
 from mcp.server.lowlevel import Server
 from mcp.shared.memory import MessageStream, create_client_server_memory_streams
 from mcp_types.version import LATEST_MODERN_VERSION
+from starlette.types import Message
 
 from .server import MCPServer
 
@@ -115,13 +116,13 @@ async def serve(server: MCPServer, *, base_url: str = "http://test") -> AsyncGen
     is running, the way ``uvicorn`` would (``httpx.ASGITransport`` does not).
     Use it to exercise the HTTP transport without sockets.
     """
-    receive_queue: asyncio.Queue[dict[str, object]] = asyncio.Queue()
-    send_queue: asyncio.Queue[dict[str, object]] = asyncio.Queue()
+    receive_queue: asyncio.Queue[Message] = asyncio.Queue()
+    send_queue: asyncio.Queue[Message] = asyncio.Queue()
 
-    async def receive() -> dict[str, object]:
+    async def receive() -> Message:
         return await receive_queue.get()
 
-    async def send(message: dict[str, object]) -> None:
+    async def send(message: Message) -> None:
         await send_queue.put(message)
 
     scope = {"type": "lifespan", "asgi": {"spec_version": "2.0", "version": "3.0"}}
```

**File**: `ag2/mcp_ui/__init__.py` (modified, +9/-9)
```diff
@@ -8,15 +8,15 @@
     from .actions import intent, link, notify, post_message, prompt, tool_call
     from .resources import external_url, raw_html, remote_dom
 except ImportError as e:  # pragma: no cover - exercised only when ag2[mcp-ui] is absent
-    external_url = missing_optional_dependency("external_url", "mcp-ui", e)  # type: ignore[misc]
-    raw_html = missing_optional_dependency("raw_html", "mcp-ui", e)  # type: ignore[misc]
-    remote_dom = missing_optional_dependency("remote_dom", "mcp-ui", e)  # type: ignore[misc]
-    tool_call = missing_optional_dependency("tool_call", "mcp-ui", e)  # type: ignore[misc]
-    prompt = missing_optional_dependency("prompt", "mcp-ui", e)  # type: ignore[misc]
-    link = missing_optional_dependency("link", "mcp-ui", e)  # type: ignore[misc]
-    intent = missing_optional_dependency("intent", "mcp-ui", e)  # type: ignore[misc]
-    notify = missing_optional_dependency("notify", "mcp-ui", e)  # type: ignore[misc]
-    post_message = missing_optional_dependency("post_message", "mcp-ui", e)  # type: ignore[misc]
+    external_url = missing_optional_dependency("external_url", "mcp-ui", e)
+    raw_html = missing_optional_dependency("raw_html", "mcp-ui", e)
+    remote_dom = missing_optional_dependency("remote_dom", "mcp-ui", e)
+    tool_call = missing_optional_dependency("tool_call", "mcp-ui", e)
+    prompt = missing_optional_dependency("prompt", "mcp-ui", e)
+    link = missing_optional_dependency("link", "mcp-ui", e)
+    intent = missing_optional_dependency("intent", "mcp-ui", e)
+    notify = missing_optional_dependency("notify", "mcp-ui", e)
+    post_message = missing_optional_dependency("post_message", "mcp-ui", e)
 
 __all__ = (
     "external_url",
```

**File**: `pyproject.toml` (modified, +42/-0)
```diff
@@ -401,6 +401,24 @@ files = [
     "ag2/__init__.py",
     "ag2/acp/client.py",
     "ag2/acp/elicitation.py",
+    "ag2/acp/__init__.py",
+    "ag2/acp/agent.py",
+    "ag2/acp/auth.py",
+    "ag2/acp/bridge.py",
+    "ag2/acp/config.py",
+    "ag2/acp/dispatch.py",
+    "ag2/acp/events.py",
+    "ag2/acp/executor.py",
+    "ag2/acp/guard.py",
+    "ag2/acp/mappers.py",
+    "ag2/acp/permissions.py",
+    "ag2/acp/remote.py",
+    "ag2/acp/session.py",
+    "ag2/acp/sessions.py",
+    "ag2/acp/testing.py",
+    "ag2/acp/tool_gateway.py",
+    "ag2/acp/transport.py",
+    "ag2/acp/types.py",
     "ag2/eval/pairwise.py",
     "ag2/eval/results/result.py",
     "ag2/eval/scorers/correctness.py",
@@ -438,6 +456,24 @@ files = [
     "ag2/live/gemini.py",
     "ag2/mcp/apps.py",
     "ag2/mcp/tools.py",
+    "ag2/mcp/__init__.py",
+    "ag2/mcp/_async.py",
+    "ag2/mcp/elicitation.py",
+    "ag2/mcp/errors.py",
+    "ag2/mcp/extensions.py",
+    "ag2/mcp/mappers.py",
+    "ag2/mcp/pause.py",
+    "ag2/mcp/prompts.py",
+    "ag2/mcp/resources.py",
+    "ag2/mcp/sampling.py",
+    "ag2/mcp/security.py",
+    "ag2/mcp/server.py",
+    "ag2/mcp/sessions.py",
+    "ag2/mcp/testing.py",
+    "ag2/mcp/transport.py",
+    "ag2/mcp_ui/__init__.py",
+    "ag2/mcp_ui/actions.py",
+    "ag2/mcp_ui/resources.py",
     "ag2/ag_ui/run_input.py",
     "ag2/ag_ui/stream.py",
     "ag2/ag_ui/__init__.py",
@@ -524,6 +560,12 @@ disallow_any_unimported = true
 module = "xai_sdk.*"
 follow_untyped_imports = true
 
+# `mcp-ui-server` is fully annotated but ships no `py.typed` marker, so mypy
+# would hand us `Any` from every name we import. Following it uses its real types.
+[[tool.mypy.overrides]]
+module = "mcp_ui_server.*"
+follow_untyped_imports = true
+
 # AG-UI's SDK does not ship typing metadata, so values crossing that boundary
 # are Any even though this module's own functions remain checked strictly.
 [[tool.mypy.overrides]]
```

---

### Incident Patch 2: `c139c238` (2026-10-04)
**Commit Message**: refactor(typing): bring a2a and a2ui into the type-checked set (#3351)

* refactor(typing): bring a2a and a2ui into the type-checked set

* refactor(types): add server_to_client_payload_keys function and update type checks

**File**: `ag2/a2a/__init__.py` (modified, +2/-4)
```diff
@@ -8,7 +8,7 @@
     from .card import build_card
     from .config import A2AConfig
 except ImportError as e:
-    build_card = missing_optional_dependency("build_card", "a2a", e)  # type: ignore[misc]
+    build_card = missing_optional_dependency("build_card", "a2a", e)
     A2AConfig = missing_optional_dependency("A2AConfig", "a2a", e)  # type: ignore[misc]
 
 try:
@@ -19,9 +19,7 @@
 try:
     from .transports.grpc import secure_grpc_channel_factory
 except ImportError as e:
-    secure_grpc_channel_factory = missing_additional_dependency(  # type: ignore[misc]
-        "secure_grpc_channel_factory", "a2a-sdk[grpc]", e
-    )
+    secure_grpc_channel_factory = missing_additional_dependency("secure_grpc_channel_factory", "a2a-sdk[grpc]", e)
 
 __all__ = (
     "A2AConfig",
```

**File**: `ag2/a2a/events.py` (modified, +4/-4)
```diff
@@ -28,26 +28,26 @@ class A2AEvent(BaseEvent):
 class A2ATaskSnapshot(A2AEvent):
     """Full ``Task`` snapshot (``StreamResponse.payload="task"``)."""
 
-    task: Task = Field(repr=False)  # type: ignore[assignment]
+    task: Task = Field(repr=False)
 
 
 class A2AMessage(A2AEvent):
     """Standalone ``Message`` (``StreamResponse.payload="message"``)."""
 
-    message: Message = Field(repr=False)  # type: ignore[assignment]
+    message: Message = Field(repr=False)
 
 
 class A2ATaskStatusUpdate(A2AEvent):
     """``TaskStatusUpdateEvent`` (``payload="status_update"``); ``state`` is duplicated for filtering."""
 
-    update: TaskStatusUpdateEvent = Field(repr=False)  # type: ignore[assignment]
+    update: TaskStatusUpdateEvent = Field(repr=False)
     state: TaskState
 
 
 class A2ATaskArtifactUpdate(A2AEvent):
     """``TaskArtifactUpdateEvent`` (``payload="artifact_update"``); ``append``/``last_chunk`` exposed for chunk-aware logic."""
 
-    update: TaskArtifactUpdateEvent = Field(repr=False)  # type: ignore[assignment]
+    update: TaskArtifactUpdateEvent = Field(repr=False)
     append: bool = False
     last_chunk: bool = False
 
```

**File**: `ag2/a2a/mappers/parts.py` (modified, +4/-2)
```diff
@@ -7,7 +7,7 @@
 from dataclasses import asdict, is_dataclass
 from datetime import datetime
 from decimal import Decimal
-from typing import Any, cast
+from typing import Any
 
 from a2a.types import Part
 from google.protobuf import json_format, struct_pb2
@@ -149,7 +149,9 @@ def struct_from_dict(payload: dict[str, Any]) -> struct_pb2.Struct:  # type: ign
 def struct_to_dict(s: struct_pb2.Struct) -> dict[str, Any]:  # type: ignore[no-any-unimported]
     if not s or not s.fields:
         return {}
-    return cast(dict[str, Any], json_format.MessageToDict(s, preserving_proto_field_name=True))
+    # Annotated, not cast: the protobuf stubs type the result, an unstubbed install leaves it `Any`.
+    result: dict[str, Any] = json_format.MessageToDict(s, preserving_proto_field_name=True)
+    return result
 
 
 def _binary_kind(metadata: dict[str, Any]) -> BinaryType:
```

**File**: `ag2/a2a/transports/__init__.py` (modified, +4/-4)
```diff
@@ -14,18 +14,18 @@
 try:
     from .jsonrpc import build_jsonrpc_asgi
 except ImportError as e:
-    build_jsonrpc_asgi = missing_additional_dependency("build_jsonrpc_asgi", "a2a-sdk[http-server]", e)  # type: ignore[misc]
+    build_jsonrpc_asgi = missing_additional_dependency("build_jsonrpc_asgi", "a2a-sdk[http-server]", e)
 
 try:
     from .rest import build_rest_asgi
 except ImportError as e:
-    build_rest_asgi = missing_additional_dependency("build_rest_asgi", "a2a-sdk[http-server]", e)  # type: ignore[misc]
+    build_rest_asgi = missing_additional_dependency("build_rest_asgi", "a2a-sdk[http-server]", e)
 
 try:
     from .grpc import build_grpc_server, default_grpc_channel_factory
 except ImportError as e:
-    build_grpc_server = missing_additional_dependency("build_grpc_server", "a2a-sdk[grpc]", e)  # type: ignore[misc]
-    default_grpc_channel_factory = missing_additional_dependency("default_grpc_channel_factory", "a2a-sdk[grpc]", e)  # type: ignore[misc]
+    build_grpc_server = missing_additional_dependency("build_grpc_server", "a2a-sdk[grpc]", e)
+    default_grpc_channel_factory = missing_additional_dependency("default_grpc_channel_factory", "a2a-sdk[grpc]", e)
 
 __all__ = (
     "TransportName",
```

**File**: `ag2/a2ui/__init__.py` (modified, +1/-1)
```diff
@@ -14,7 +14,7 @@
     from .capabilities import A2UIClientCapabilities
     from .events import A2UIClientEvent, A2UIMessageEvent, A2UIValidationFailedEvent
 except ImportError as e:
-    a2ui_action = missing_optional_dependency("a2ui_action", "a2ui", e)  # type: ignore[misc]
+    a2ui_action = missing_optional_dependency("a2ui_action", "a2ui", e)
     A2UIAction = missing_optional_dependency("A2UIAction", "a2ui", e)  # type: ignore[misc]
     A2UIClientCapabilities = missing_optional_dependency("A2UIClientCapabilities", "a2ui", e)  # type: ignore[misc]
     A2UIClientEvent = missing_optional_dependency("A2UIClientEvent", "a2ui", e)  # type: ignore[misc]
```

**File**: `ag2/a2ui/_types.py` (modified, +13/-1)
```diff
@@ -2,7 +2,8 @@
 #
 # SPDX-License-Identifier: Apache-2.0
 
-from typing import Literal, TypeAlias, TypedDict
+from functools import cache
+from typing import Literal, TypeAlias, TypedDict, get_args, get_type_hints, is_typeddict
 
 JsonScalar: TypeAlias = str | int | float | bool | None
 JsonValue: TypeAlias = "JsonScalar | list[JsonValue] | dict[str, JsonValue]"
@@ -145,6 +146,17 @@ class ActionResponseMessage(TypedDict, total=False):
 )
 
 
+@cache
+def server_to_client_payload_keys() -> frozenset[str]:
+    """The key carrying the payload of each ``ServerToClientMessage``, read off its ``TypedDict``."""
+    return frozenset(
+        key
+        for message in get_args(ServerToClientMessage)
+        for key, annotation in get_type_hints(message).items()
+        if is_typeddict(annotation)
+    )
+
+
 # NOTE: client→server (action/error) and client-capability wire shapes are
 # intentionally NOT modeled as TypedDicts here. The code that parses them
 # decodes into dedicated dataclasses instead — see ``incoming.py``
```

**File**: `ag2/a2ui/a2a/__init__.py` (modified, +7/-15)
```diff
@@ -18,25 +18,17 @@
     )
     from .parts import create_a2ui_parts, get_a2ui_data, is_a2ui_part
 except ImportError as e:
-    get_a2ui_agent_extension = missing_optional_dependency(  # type: ignore[misc]
-        "get_a2ui_agent_extension", "a2a", e
-    )
-    get_activated_extensions = missing_optional_dependency(  # type: ignore[misc]
-        "get_activated_extensions", "a2a", e
-    )
-    try_activate_a2ui_extension = missing_optional_dependency(  # type: ignore[misc]
-        "try_activate_a2ui_extension", "a2a", e
-    )
+    get_a2ui_agent_extension = missing_optional_dependency("get_a2ui_agent_extension", "a2a", e)
+    get_activated_extensions = missing_optional_dependency("get_activated_extensions", "a2a", e)
+    try_activate_a2ui_extension = missing_optional_dependency("try_activate_a2ui_extension", "a2a", e)
     ACTIVATED_EXTENSIONS_KEY = "activated_extensions"
-    create_a2ui_parts = missing_optional_dependency("create_a2ui_parts", "a2a", e)  # type: ignore[misc]
-    get_a2ui_data = missing_optional_dependency("get_a2ui_data", "a2a", e)  # type: ignore[misc]
-    is_a2ui_part = missing_optional_dependency("is_a2ui_part", "a2a", e)  # type: ignore[misc]
+    create_a2ui_parts = missing_optional_dependency("create_a2ui_parts", "a2a", e)
+    get_a2ui_data = missing_optional_dependency("get_a2ui_data", "a2a", e)
+    is_a2ui_part = missing_optional_dependency("is_a2ui_part", "a2a", e)
     A2UIClientCapabilities = missing_optional_dependency(  # type: ignore[misc]
         "A2UIClientCapabilities", "a2a", e
     )
-    parse_client_capabilities = missing_optional_dependency(  # type: ignore[misc]
-        "parse_client_capabilities", "a2a", e
-    )
+    parse_client_capabilities = missing_optional_dependency("parse_client_capabilities", "a2a", e)
     A2UI_CLIENT_CAPABILITIES_METADATA_KEY = "a2uiClientCapabilities"
 
 try:
```

**File**: `ag2/a2ui/actions.py` (modified, +3/-1)
```diff
@@ -154,9 +154,11 @@ async def run(self, click: "A2UIIncomingAction", *, context: "ConversationContex
             Whatever the handler returns (opaque user value; the caller maps it
             onto the wire).
         """
+        # `asolve` annotates each keyword as a `dict[str, Any]`; the values really are arbitrary.
+        options: dict[str, Any] = click.context | {CONTEXT_OPTION_NAME: context}
         async with AsyncExitStack() as stack:
             return await self.model.asolve(
-                **(click.context | {CONTEXT_OPTION_NAME: context}),
+                **options,
                 stack=stack,
                 cache_dependencies={},
                 dependency_provider=context.dependency_provider,
```

---

### Incident Patch 3: `4afffc72` (2026-10-04)
**Commit Message**: fix(test): ensure sibling call is announced before asking human (#3357)

**File**: `test/ag_ui/served/test_refusals.py` (modified, +4/-2)
```diff
@@ -97,7 +97,7 @@ async def test_the_thread_holds_nothing_after_it(self) -> None:
 
     async def test_work_kept_while_the_question_waited_is_sent_and_closed_first(self) -> None:
         """What the turn did while paused belongs to the cancelled run, and ends before it does."""
-        question_out, sibling_done = asyncio.Event(), asyncio.Event()
+        question_out, sibling_started, sibling_done = asyncio.Event(), asyncio.Event(), asyncio.Event()
         agent = Agent(
             "test_agent",
             config=TestConfig(
@@ -109,12 +109,14 @@ async def test_work_kept_while_the_question_waited_is_sent_and_closed_first(self
 
         @agent.tool
         async def ask_human(context: Context) -> str:
-            """Ask the human."""
+            """Ask the human, once the sibling call has been announced."""
+            await sibling_started.wait()
             return await context.input(QUESTION)
 
         @agent.tool
         async def look_up() -> str:
             """Finish only once the question is out."""
+            sibling_started.set()
             await question_out.wait()
             return "looked up"
 
```

---

### Incident Patch 4: `d9bdeef1` (2026-10-04)
**Commit Message**: fix(shell): refuse ignored files named through a wildcard (#3350)

**File**: `ag2/tools/sandbox/filter.py` (modified, +39/-18)
```diff
@@ -109,7 +109,8 @@ def check_ignore(command: str, workdir: "Path | PurePath", patterns: list[str])
     """Return ``"Access denied: <path>"`` if any literal path in *command* leaves *workdir* or matches *patterns*.
 
     Tokens are extracted via :func:`shlex.split` to handle quoted paths. Each
-    token is resolved relative to *workdir* and checked against each pattern.
+    token is resolved relative to *workdir* and checked against each pattern;
+    a glob token is checked against the files it matches on a host path.
     Returns ``None`` if no pattern matches.
 
     *workdir* may be a host :class:`~pathlib.Path` (local backend) or a
@@ -132,27 +133,47 @@ def check_ignore(command: str, workdir: "Path | PurePath", patterns: list[str])
     for token in tokens:
         if host_backed:
             try:
-                resolved: PurePath = (workdir / token).resolve()
+                literal: PurePath = (workdir / token).resolve()
             except Exception:
                 continue
+            candidates = [literal, *_glob_matches(workdir, token)]
         else:
-            resolved = PurePosixPath(posixpath.normpath(posixpath.join(str(workdir), token)))
+            candidates = [PurePosixPath(posixpath.normpath(posixpath.join(str(workdir), token)))]
+
+        for resolved in candidates:
+            denied = _denied(resolved, resolved_workdir, patterns)
+            if denied is not None:
+                return denied
+
+    return None
+
+
+def _glob_matches(workdir: Path, token: str) -> list[Path]:
+    # The command runs as argv, but a program may expand a glob itself (MSYS
+    # tools do on Windows), so a pattern naming an ignored file must be refused.
+    if not any(c in token for c in "*?["):
+        return []
+    try:
+        return [m.resolve() for m in workdir.glob(token)]
+    except (ValueError, NotImplementedError, OSError):
+        return []
 
-        try:
-            rel = str(resolved.relative_to(resolved_workdir)).replace("\\", "/")
-        except ValueError:
-            return f"Access denied: {resolved}"
 
-        for pattern in patterns:
-            if any(c in pattern for c in ("*", "?", "[")):
-                if fnmatch.fnmatch(rel, pattern):
-                    return f"Access denied: {resolved}"
-                if pattern.startswith("**/") and fnmatch.fnmatch(resolved.name, pattern[3:]):
-                    return f"Access denied: {resolved}"
-                if fnmatch.fnmatch(resolved.name, pattern):
-                    return f"Access denied: {resolved}"
-            else:
-                if resolved.name == pattern or rel == pattern or rel.startswith(pattern + "/"):
-                    return f"Access denied: {resolved}"
+def _denied(resolved: PurePath, resolved_workdir: PurePath, patterns: list[str]) -> str | None:
+    try:
+        rel = str(resolved.relative_to(resolved_workdir)).replace("\\", "/")
+    except ValueError:
+        return f"Access denied: {resolved}"
+
+    for pattern in patterns:
+        if any(c in pattern for c in ("*", "?", "[")):
+            if fnmatch.fnmatch(rel, pattern):
+                return f"Access denied: {resolved}"
+            if pattern.startswith("**/") and fnmatch.fnmatch(resolved.name, pattern[3:]):
+                return f"Access denied: {resolved}"
+            if fnmatch.fnmatch(resolved.name, pattern):
+                return f"Access denied: {resolved}"
+        elif resolved.name == pattern or rel == pattern or rel.startswith(pattern + "/"):
+            return f"Access denied: {resolved}"
 
     return None
```

**File**: `test/tools/sandbox/adapter/test_shell_adapter.py` (modified, +13/-0)
```diff
@@ -199,6 +199,19 @@ async def test_ignore_alone_does_not_leak_through_shell_expansion(self, tmp_path
         result = await adapter.run(command)
         assert "SECRET" not in result
 
+    @pytest.mark.parametrize("command", ["cat .en*", "cat .e?v", "cat .en[v]", "cat *"])
+    async def test_ignore_denies_a_wildcard_that_matches_an_ignored_file(self, tmp_path: Path, command: str) -> None:
+        # Some programs expand wildcards themselves (MSYS tools on Windows), so the
+        # filter must not rely on the missing shell to keep the ignored file unread.
+        (tmp_path / ".env").write_text("SECRET")
+        adapter = ShellAdapter(LocalSandbox(tmp_path), ignore=[".env"])
+        assert "Access denied" in await adapter.run(command)
+
+    async def test_ignore_allows_a_wildcard_that_matches_nothing_ignored(self, tmp_path: Path) -> None:
+        (tmp_path / "a.txt").write_text("fine")
+        adapter = ShellAdapter(LocalSandbox(tmp_path), ignore=[".env"])
+        assert "Access denied" not in await adapter.run("ls *.txt")
+
     async def test_blocked_or_ignore_alone_switches_on_restricted_mode(self) -> None:
         assert ShellAdapter(RecordingSandbox(), blocked=["rm"]).restricted
         assert ShellAdapter(RecordingSandbox(), ignore=[".env"]).restricted
```

**File**: `website/docs/user-guide/tools/local_shell.mdx` (modified, +1/-1)
```diff
@@ -105,7 +105,7 @@ Filtering is applied in this order on every `run_shell_command(command)` call:
 5. **Execute** — the command runs in the environment: through `sh -c`, or as a plain argv in [restricted mode](#restricted-mode).
 
 !!! note
-    `ignore` checks only the literal path words of the command. Because restricted mode runs no shell, nothing is computed after the check (variables, command substitution and globs are passed on literally). A program that opens paths on its own (`sh -c`, `find`) is not covered; use an isolated backend for that.
+    `ignore` checks only the literal path words of the command. Because restricted mode runs no shell, nothing is computed after the check (variables and command substitution are passed on literally). A glob word is expanded for the check, and the command is refused if it matches an ignored file, since some programs expand globs themselves (MSYS tools on Windows). That expansion needs the host filesystem, so it applies to the local backend only. A program that opens paths on its own (`sh -c`, `find`) is not covered; use an isolated backend for that.
 
 ## Read-Only Mode
 
```

---

### Incident Patch 5: `77fb2fbb` (2026-10-03)
**Commit Message**: fix(knowledge): match SqliteKnowledgeStore prefixes literally (#3339)

* fix(knowledge): match SqliteKnowledgeStore prefixes literally

list, exists, delete and list_versions_under used `path LIKE prefix%`.
SQLite LIKE treats `_` and `%` as wildcards and ignores ASCII case,
so a prefix such as /skills/code_review also matched
/skills/codeXreview/..., and delete() removed those unrelated entries.
MemoryKnowledgeStore and DiskKnowledgeStore compare prefixes literally.

Compare substr(path, 1, len(prefix)) with the prefix instead.

* fix(sqlite): update prefix matching to use a consistent literal comparison

---------

Co-authored-by: Semen Frolov <[REDACTED_EMAIL]>
Co-authored-by: Semen Frolov <[REDACTED_EMAIL]>

**File**: `ag2/knowledge/sqlite.py` (modified, +16/-7)
```diff
@@ -14,6 +14,11 @@
 from .base import ChangeCallback, ChangeSubscription, _normalize
 from .polling import PollingChangeWatcher
 
+# Prefix predicate, bound as ``(len(prefix), prefix)``. Never use ``LIKE`` for
+# this: it treats ``_`` and ``%`` as wildcards and folds ASCII case, while the
+# other stores compare prefixes literally and case-sensitively.
+_PREFIX_MATCH = "substr(path, 1, ?) = ?"
+
 
 class SqliteKnowledgeStore:
     """SQLite-backed :class:`KnowledgeStore`.
@@ -98,8 +103,8 @@ def _sync_write(self, normalized: str, payload: bytes, version: int) -> None:
     def _sync_list(self, prefix: str) -> list[str]:
         conn = self._ensure_connected()
         cur = conn.execute(
-            "SELECT path FROM entries WHERE path LIKE ?",
-            (prefix + "%",),
+            f"SELECT path FROM entries WHERE {_PREFIX_MATCH}",
+            (len(prefix), prefix),
         )
         children: set[str] = set()
         for (p,) in cur.fetchall():
@@ -113,7 +118,10 @@ def _sync_list(self, prefix: str) -> list[str]:
     def _sync_delete(self, normalized: str, prefix: str) -> None:
         conn = self._ensure_connected()
         conn.execute("DELETE FROM entries WHERE path = ?", (normalized,))
-        conn.execute("DELETE FROM entries WHERE path LIKE ?", (prefix + "%",))
+        conn.execute(
+            f"DELETE FROM entries WHERE {_PREFIX_MATCH}",
+            (len(prefix), prefix),
+        )
         conn.commit()
 
     def _sync_exists(self, normalized: str, prefix: str) -> bool:
@@ -122,8 +130,8 @@ def _sync_exists(self, normalized: str, prefix: str) -> bool:
         if cur.fetchone() is not None:
             return True
         cur = conn.execute(
-            "SELECT 1 FROM entries WHERE path LIKE ? LIMIT 1",
-            (prefix + "%",),
+            f"SELECT 1 FROM entries WHERE {_PREFIX_MATCH} LIMIT 1",
+            (len(prefix), prefix),
         )
         return cur.fetchone() is not None
 
@@ -158,9 +166,10 @@ def _sync_list_versions(self, normalized: str) -> dict[str, int]:
         if normalized in ("", "/"):
             cur = conn.execute("SELECT path, version FROM entries")
         else:
+            child_prefix = normalized + "/"
             cur = conn.execute(
-                "SELECT path, version FROM entries WHERE path = ? OR path LIKE ?",
-                (normalized, normalized + "/%"),
+                f"SELECT path, version FROM entries WHERE path = ? OR {_PREFIX_MATCH}",
+                (normalized, len(child_prefix), child_prefix),
             )
         return {row[0]: int(row[1]) for row in cur.fetchall()}
 
```

**File**: `test/knowledge/test_knowledge.py` (modified, +79/-20)
```diff
@@ -29,19 +29,17 @@
 from ag2.testing import TestConfig
 
 
+@pytest.mark.asyncio
 class TestMemoryKnowledgeStore:
-    @pytest.mark.asyncio
     async def test_read_write(self) -> None:
         store = MemoryKnowledgeStore()
         await store.write("/test.txt", "hello")
         assert await store.read("/test.txt") == "hello"
 
-    @pytest.mark.asyncio
     async def test_read_nonexistent(self) -> None:
         store = MemoryKnowledgeStore()
         assert await store.read("/missing.txt") is None
 
-    @pytest.mark.asyncio
     async def test_list_root(self) -> None:
         store = MemoryKnowledgeStore()
         await store.write("/a.txt", "a")
@@ -50,22 +48,19 @@ async def test_list_root(self) -> None:
         assert "a.txt" in entries
         assert "b/" in entries
 
-    @pytest.mark.asyncio
     async def test_list_subdirectory(self) -> None:
         store = MemoryKnowledgeStore()
         await store.write("/log/stream-1.jsonl", "data1")
         await store.write("/log/stream-2.jsonl", "data2")
         entries = await store.list("/log/")
         assert entries == ["stream-1.jsonl", "stream-2.jsonl"]
 
-    @pytest.mark.asyncio
     async def test_delete_file(self) -> None:
         store = MemoryKnowledgeStore()
         await store.write("/test.txt", "hello")
         await store.delete("/test.txt")
         assert await store.read("/test.txt") is None
 
-    @pytest.mark.asyncio
     async def test_delete_directory(self) -> None:
         store = MemoryKnowledgeStore()
         await store.write("/dir/a.txt", "a")
@@ -74,34 +69,30 @@ async def test_delete_directory(self) -> None:
         assert await store.read("/dir/a.txt") is None
         assert await store.read("/dir/b.txt") is None
 
-    @pytest.mark.asyncio
     async def test_exists(self) -> None:
         store = MemoryKnowledgeStore()
         await store.write("/test.txt", "hello")
         assert await store.exists("/test.txt") is True
         assert await store.exists("/missing.txt") is False
 
-    @pytest.mark.asyncio
     async def test_exists_directory(self) -> None:
         store = MemoryKnowledgeStore()
         await store.write("/dir/file.txt", "data")
         assert await store.exists("/dir") is True
 
-    @pytest.mark.asyncio
     async def test_path_normalization(self) -> None:
         store = MemoryKnowledgeStore()
         await store.write("no_leading_slash.txt", "data")
         assert await store.read("/no_leading_slash.txt") == "data"
 
-    @pytest.mark.asyncio
     async def test_list_empty(self) -> None:
         store = MemoryKnowledgeStore()
         entries = await store.list("/")
         assert entries == []
 
 
+@pytest.mark.asyncio
 class TestEventLogWriter:
-    @pytest.mark.asyncio
     async def test_persist_and_load(self) -> None:
         store = MemoryKnowledgeStore()
         writer = EventLogWriter(store)
@@ -125,7 +116,6 @@ async def test_persist_and_load(self) -> None:
         assert loaded[1].agent_name == "analyzer"
         assert loaded[1].result == "done"
 
-    @pytest.mark.asyncio
     async def test_persist_dropped_segments(self) -> None:
         store = MemoryKnowledgeStore()
         writer = EventLogWriter(store)
@@ -147,7 +137,6 @@ async def test_persist_dropped_segments(self) -> None:
         assert loaded[1].parts[0].content == "old-2"
         assert loaded[2].parts[0].content == "recent"
 
-    @pytest.mark.asyncio
     async def test_persist_dropped_multiple_writers_no_overwrite(self) -> None:
         """Multiple EventLogWriter instances must not overwrite each other's segments.
 
@@ -176,14 +165,12 @@ async def test_persist_dropped_multiple_writers_no_overwrite(self) -> None:
         assert loaded[1].parts[0].content == "batch-2"
         assert loaded[2].parts[0].content == "final"
 
-    @pytest.mark.asyncio
     async def test_load_empty(self) -> None:
         store = MemoryKnowledgeStore()
         writer = EventLogWriter(store)
         loaded = await writer.load(uuid4())
         assert loaded == []
 
-    @pytest.mark.asyncio
     async def test_unknown_event_fallback(self) -> None:
         store = MemoryKnowledgeStore()
         # Write a record with a non-existent event type
@@ -198,8 +185,8 @@ async def test_unknown_event_fallback(self) -> None:
         assert loaded[0].type_name == "nonexistent.module.FakeEvent"
 
 
+@pytest.mark.asyncio
 class TestDefaultBootstrap:
-    @pytest.mark.asyncio
     async def test_creates_standard_layout(self) -> None:
         store = MemoryKnowledgeStore()
         # Agent writes sentinel before calling bootstrap, so simulate that
@@ -216,7 +203,6 @@ async def test_creates_standard_layout(self) -> None:
         root_skill = await store.read("/SKILL.md")
         assert "test-agent" in root_skill
 
-    @pytest.mark.asyncio
     async def test_sentinel_prevents_rebootstrap(self) -> None:
         store = MemoryKnowledgeStore()
         # Agent writes sentinel before calling bootstrap
@@ -231,7 +217,6 @@ async
```

---

### Incident Patch 6: `26943acb` (2026-10-03)
**Commit Message**: docs: fix observer and knowledge store examples that fail to run (#3337)

- Import observers from `ag2.observers`; `ag2.observer` does not exist.
- Import knowledge stores, `DefaultBootstrap` and `EventLogWriter` from
  `ag2.knowledge`; they are not exported from top-level `ag2`.
- Close a change subscription with `close()`, the method
  `ChangeSubscription` defines, instead of `cancel()`.
- Read the second append with `off2`: `append` returns the offset where
  the content starts, so `off1` returned both writes.
- Describe how each built-in backend delivers `on_change` callbacks;
  none of them returns `NoopChangeSubscription` in normal use.

**File**: `AGENTS.md` (modified, +1/-1)
```diff
@@ -121,7 +121,7 @@ Top-level modules:
 - `ag2.tools.subagents` - Agent-to-agent delegation (see [below](#subagent-delegation))
 - `ag2.testing` - Testing utilities
 - `ag2.middleware` - Request/response interception (see [below](#middleware))
-- `ag2.observer` - Reusable observer implementations
+- `ag2.observers` - Reusable observer implementations
 - `ag2.eval` - Offline evaluation framework (datasets, scorers, runner, persistence)
 
 Advanced modules:
```

**File**: `website/docs/user-guide/advanced/knowledge_store.mdx` (modified, +10/-9)
```diff
@@ -46,7 +46,7 @@ The `append` / `read_range` pair supports WAL-style workloads: `append` returns
 ### Memory store — fastest, non-persistent
 
 ```python linenums="1"
-from ag2 import MemoryKnowledgeStore
+from ag2.knowledge import MemoryKnowledgeStore
 
 store = MemoryKnowledgeStore()
 
@@ -58,7 +58,7 @@ print(await store.list("/"))  # ['artifacts/']
 ### Sqlite store — persistent across process restarts
 
 ```python linenums="1"
-from ag2 import SqliteKnowledgeStore
+from ag2.knowledge import SqliteKnowledgeStore
 
 store = SqliteKnowledgeStore("/var/agents/alice/knowledge.db")
 await store.write("/config/model.txt", "claude-opus-5")
@@ -71,7 +71,7 @@ print(await store2.read("/config/model.txt"))  # "claude-opus-5"
 ### Disk store — files on the filesystem
 
 ```python linenums="1"
-from ag2 import DiskKnowledgeStore
+from ag2.knowledge import DiskKnowledgeStore
 
 store = DiskKnowledgeStore("/var/agents/alice/knowledge/")
 await store.write("/artifacts/data.json", '{"ok": true}')
@@ -87,7 +87,7 @@ off1 = await store.append("/log/events.jsonl", '{"t": 1}\n')
 off2 = await store.append("/log/events.jsonl", '{"t": 2}\n')
 
 # Read everything appended in the second write
-new_slice = await store.read_range("/log/events.jsonl", off1)
+new_slice = await store.read_range("/log/events.jsonl", off2)
 print(new_slice)  # '{"t": 2}\n'
 ```
 
@@ -96,23 +96,23 @@ print(new_slice)  # '{"t": 2}\n'
 
 ## Change subscriptions
 
-Callers can react to writes via `on_change`. Backends that observe changes efficiently (`DiskKnowledgeStore` using `watchdog`) call the callback directly. Backends that cannot (`MemoryKnowledgeStore`, `SqliteKnowledgeStore`) return a `NoopChangeSubscription` — the caller is expected to poll.
+Callers can react to writes via `on_change`, which returns a subscription to `close()` when you no longer need notifications. Every built-in backend delivers them: `MemoryKnowledgeStore` calls back on each write, `DiskKnowledgeStore` uses `watchdog` filesystem events, and `SqliteKnowledgeStore` / `RedisKnowledgeStore` poll in the background (every 500 ms by default; pass `poll_interval_s` to the constructor to change it). A custom backend that cannot observe changes returns a `NoopChangeSubscription`, and the caller is expected to poll.
 
 ```python linenums="1"
 async def on_log_change(path: str) -> None:
     print(f"{path} changed")
 
 sub = await store.on_change("/log/", on_log_change)
 # ... later:
-await sub.cancel()
+await sub.close()
 ```
 
 ## DefaultBootstrap
 
 `DefaultBootstrap` populates a store with a standard layout and `SKILL.md` files that explain each directory to an LLM reader. It's designed to be called once per agent:
 
 ```python linenums="1"
-from ag2 import DefaultBootstrap, MemoryKnowledgeStore
+from ag2.knowledge import DefaultBootstrap, MemoryKnowledgeStore
 
 store = MemoryKnowledgeStore()
 await DefaultBootstrap().bootstrap(store, actor_name="alice")
@@ -137,8 +137,9 @@ Implement your own `StoreBootstrap` if you need a different layout.
 `EventLogWriter` serializes a Stream's events to a `KnowledgeStore` as JSONL, and can reconstruct them later. Useful for replay, audit, or multi-run aggregation.
 
 ```python linenums="1"
-from ag2 import Agent, EventLogWriter, MemoryKnowledgeStore, MemoryStream
+from ag2 import Agent, MemoryStream
 from ag2.config import OpenAIConfig
+from ag2.knowledge import EventLogWriter, MemoryKnowledgeStore
 
 stream = MemoryStream()
 agent = Agent("assistant", config=OpenAIConfig(model="gpt-5"))
@@ -166,7 +167,7 @@ When an `Agent` is given a `KnowledgeConfig`, it runs this `persist(...)` step f
 `LockedKnowledgeStore` wraps any `KnowledgeStore` to serialize concurrent writes. It delegates locking to a user-provided object implementing `#!python acquire(name, ttl)` / `#!python release(name)` — typically a distributed lock (Redis, database advisory locks, etc.) so multiple processes sharing the same store can coordinate.
 
 ```python linenums="1"
-from ag2 import LockedKnowledgeStore, SqliteKnowledgeStore
+from ag2.knowledge import LockedKnowledgeStore, SqliteKnowledgeStore
 
 inner = SqliteKnowledgeStore("/var/agents/shared.db")
 store = LockedKnowledgeStore(inner, lock=your_distributed_lock)
```

**File**: `website/docs/user-guide/advanced/observers.mdx` (modified, +3/-3)
```diff
@@ -184,7 +184,7 @@ Detects repetitive tool-call patterns. Maintains a sliding window of recent tool
 
 ```python linenums="1"
 from ag2 import Agent
-from ag2.observer import LoopDetector
+from ag2.observers import LoopDetector
 from ag2.config import OpenAIConfig
 
 agent = Agent(
@@ -200,7 +200,7 @@ Tracks cumulative token usage across `UsageEvent` — the framework's accounting
 
 ```python linenums="1"
 from ag2 import Agent
-from ag2.observer import TokenMonitor
+from ag2.observers import TokenMonitor
 from ag2.config import OpenAIConfig
 
 agent = Agent(
@@ -236,7 +236,7 @@ Subclass `BaseObserver`, pick a [Watch](/docs/user-guide/advanced/watches), impl
 
 ```python linenums="1" hl_lines="10 13 17-21"
 from ag2 import Context
-from ag2.observer import BaseObserver
+from ag2.observers import BaseObserver
 from ag2.watch import CadenceWatch
 from ag2.events import BaseEvent, ModelResponse, ObserverAlert, Severity
 
```

**File**: `website/docs/user-guide/code_examples/04_token_watchdog.mdx` (modified, +1/-1)
```diff
@@ -43,7 +43,7 @@ from ag2 import Agent
 from ag2 import Context
 from ag2.config import GeminiConfig
 from ag2.events import BaseEvent, ObserverAlert
-from ag2.observer import BaseObserver, LoopDetector, TokenMonitor
+from ag2.observers import BaseObserver, LoopDetector, TokenMonitor
 from ag2.stream import MemoryStream
 from ag2.watch import EventWatch
 
```

**File**: `website/docs/user-guide/code_examples/08_safety_guard.mdx` (modified, +1/-1)
```diff
@@ -50,7 +50,7 @@ from ag2 import Agent
 from ag2 import Context
 from ag2.config import GeminiConfig
 from ag2.events import BaseEvent, ToolCallEvent, HaltEvent, ObserverAlert, Severity
-from ag2.observer import BaseObserver
+from ag2.observers import BaseObserver
 from ag2.policies import AlertPolicy
 from ag2.stream import MemoryStream
 from ag2.watch import EventWatch
```

---

### Incident Patch 7: `964bc325` (2026-10-03)
**Commit Message**: docs(ag-ui): update CopilotKit quickstart for the AG-UI 1.0 sample (#3340)

**File**: `website/docs/user-guide/ag-ui/backend-deepdive.mdx` (modified, +1/-0)
```diff
@@ -58,6 +58,7 @@ Notes:
 
 - **Do not** put secrets (API keys, auth tokens) in the browser bundle. Protect the Next.js runtime route (`/api/copilotkit`) and forward credentials server-to-server.
 - If you expose a capabilities `GET` route alongside this `POST` route, apply the same authentication check there.
+- To give tools the verified user, pass it to `dispatch(dependencies=...)` rather than `variables`. The [weather sample](https://github.com/ag2ai/ag2-samples){.external-link target="_blank"} verifies a signed token in a FastAPI dependency and does exactly that, so the user is never echoed back to the browser or supplied by the client.
 - If you don’t need auth or middleware, add the generated `AGUIStream.build_asgi()` endpoint as a route, as shown in the [basic server example](/docs/user-guide/ag-ui/overview#basic-server-example){.internal-link}.
 
 ## Tools context
```

**File**: `website/docs/user-guide/ag-ui/copilotkit-quickstart.mdx` (modified, +77/-12)
```diff
@@ -1,49 +1,113 @@
 ---
 sidebarTitle: CopilotKit Quickstart
 title: "CopilotKit UI Quickstart for AG-UI"
-description: "Connect a CopilotKit UI to an AG2 agent served over AG-UI."
+description: "Connect a CopilotKit UI to an AG2 agent served over AG-UI 1.0."
 ---
 
-Run an AG2 agent behind an AG-UI endpoint and connect a CopilotKit UI to it. The [AG2 weather sample](https://github.com/ag2ai/ag2-samples){.external-link target="_blank"} contains the Python server and Next.js app used below.
+Run an AG2 agent behind an AG-UI 1.0 endpoint and connect a CopilotKit UI to it. The [AG2 weather sample](https://github.com/ag2ai/ag2-samples){.external-link target="_blank"} contains the Python server and the Next.js app used below, and shows sub-agents, human approval and shared state next to a plain chat.
 
 ## Prerequisites
 
-- Python 3.10–3.14, `uv`, Node.js 18.18 or newer, and `pnpm`
+- Python 3.10–3.14 and `uv`
+- Node.js 20.9 or newer and `pnpm`
 - An OpenAI API key for the sample agent
 
+The backend depends on `ag2[ag-ui,openai]>=1.1.2,<2`; the UI on `@copilotkit/react-core` and `@copilotkit/runtime` 1.76.0 and `@ag-ui/client` 1.0.1.
+
 ## Run the sample
 
+The sample serves the agent only to a signed-in user, so both processes share a secret that signs and verifies the user's access token. Generate any long random string and use the same value for both.
+
 Clone the sample and start its AG2 backend from the repository root:
 
 ```bash
 git clone https://github.com/ag2ai/ag2-samples.git
 cd ag2-samples
 uv sync
 export OPENAI_API_KEY="your-openai-api-key"
-uv run python weather.py
+export AUTH_SECRET="a-long-random-string"
+uv run python -m backend
 ```
 
 The server listens on port `8000`. Its AG-UI endpoint is `/weather/` in this sample. The [basic server example](/docs/user-guide/ag-ui/overview#basic-server-example) uses `/chat` instead; use the URL configured by the server you actually start.
 
-In another terminal, from the directory where you cloned the repository, start the UI:
+In another terminal, from the repository root, start the UI with the same secret:
 
 ```bash
-cd ag2-samples/ui
+cd ui
 pnpm install
-pnpm dev
+AUTH_SECRET="a-long-random-string" pnpm dev
 ```
 
-Open `http://localhost:3000` and ask for the weather in a city. The UI sends the run to the Python endpoint and renders its streamed AG-UI events. You can also ask about your location if you allow browser location access.
+Open `http://localhost:3000`, enter a name to sign in, and ask for the weather in a city. The UI sends the run to the Python endpoint and renders its streamed AG-UI events. You can also ask about your location if you allow browser location access.
+
+!!! warning "The sign-in is a demonstration"
+
+    The sample accepts any name and keeps the token in `localStorage`. Replace `verify_access_token` in `backend/auth.py` and the token route in the UI before reusing the pattern. See [Authentication](/docs/user-guide/ag-ui/backend-deepdive#authentication) for protecting the AG2 endpoint.
 
 !!! note "Starting from a generated project"
 
     Run `npx copilotkit@latest init`, select AG2 in the prompts, then use the install and start commands it prints. The generated project's layout and endpoint may differ from the weather sample.
 
+## What the sample shows
+
+| AG-UI 1.0 feature | Backend | Frontend | Try it |
+| --- | --- | --- | --- |
+| [Delegations](/docs/user-guide/ag-ui/overview#delegations) (`SUBAGENT_*` events) | `ClothingAdvisor` and `TripPlanner`, wrapped with `Agent.as_tool()` | `agent.subscribe(...)` in a side panel | "What should I wear in Oslo?" |
+| [Interrupts](/docs/user-guide/ag-ui/overview#gating-a-tool-call-instead-of-asking-a-question) | `save_favorite_city` is held by `ApprovalRequired` | `useInterrupt` renders Approve and Reject, and `resolve(true)` or `resolve(false)` answers | "Save Lisbon to my favorites" |
+| [Shared state](/docs/user-guide/ag-ui/overview#shared-state) (`STATE_SNAPSHOT`) | `context.variables` | `useAgent` reads `agent.state` | Save a city, then watch the panel |
+| [Capabilities](/docs/user-guide/ag-ui/overview#capabilities) | `GET /weather/` returns `stream.capabilities()` | | `curl localhost:8000/weather/` |
+| [Frontend tools](/docs/user-guide/ag-ui/backend-deepdive#frontend-tools-ui-driven-actions) | | `useFrontendTool` registers `getUserLocation` | "What's the weather here?" |
+
 ## Connect your own AG2 agent
 
-First serve it with `AGUIStream`, as shown in the [AG-UI overview](/docs/user-guide/ag-ui/overview#basic-server-example). Then register an `HttpAgent` pointed at that endpoint in your CopilotKit runtime. Use the [CopilotKit AG2 integration guide](https://docs.copilotkit.ai/ag2){.external-link target="_blank"} for the current runtime and React provider wiring; CopilotKit's route and component APIs differ across major versions.
+Serve the agent with `AGUIStream`, as shown in the [AG-UI overview](/docs/user-guide/ag-ui/overview#basic-server-example). Then register an `
```

---

### Incident Patch 8: `14383a9a` (2026-10-02)
**Commit Message**: docs(network): clarify remote hub auth requirements

**File**: `website/docs/user-guide/network/distributed.mdx` (modified, +2/-2)
```diff
@@ -58,7 +58,7 @@ asyncio.run(main())
 
 ## Connecting a Remote Agent
 
-From any other process — same machine, different container, or across a real network:
+From any other process — same machine, different container, or across a real network. The example connects to `ws://hub-host:8765`; reaching a hub from another machine needs it bound to a reachable address with real authentication (see the warning above), while on one machine you can use `ws://127.0.0.1:8765`:
 
 ```python linenums="1"
 import asyncio
@@ -211,7 +211,7 @@ recovered = await agent.resume_from(task_id, checkpoint_store)
 | Concern | Recommendation |
 |---|---|
 | TLS | Pass an `ssl_context` to `serve_ws(...)` and use `wss://` in `WsLink`. |
-| Auth | Build the hub with `AuthRegistry([ApiKeyAuth(keys=...)])` and pass `Passport(auth=AuthBlock(...))` from each agent. |
+| Auth | Required beyond loopback: `serve_ws` refuses a hub with `NoAuth` there. Build the hub with `AuthRegistry([ApiKeyAuth(keys=...)])` and pass `Passport(auth=AuthBlock(...))` from each agent. |
 | Durability | Use `DiskKnowledgeStore(path)` on the hub so the registry and channel WALs survive a restart. |
 | Reconnect | On disconnect, build a fresh `HubClient`, call `open()`, then `attach(agent, name=..., since_envelope_id=last_id)`. The hub replays any unacked envelopes past that cursor. |
 | Federation | Register a `RemoteAgentProxy` on the hub to route envelopes addressed to agents with `kind="remote_agent"` across hub boundaries. |
```

---

### Incident Patch 9: `a0fea8ee` (2026-10-02)
**Commit Message**: fix(network): bind task visibility to connection identity

Restrict wire task reads and events to the bound owner or channel
participants, validate audience and peer-cancel/mirror-failure text, and
serialize checkpoint first-writer claims.

Refuse to serve hubs that accept NoAuth on non-loopback WebSocket hosts unless
operators explicitly opt in, and document the safer loopback default.

BREAKING CHANGE: serve_ws now raises ValueError for NoAuth hubs on
non-loopback hosts unless allow_unauthenticated=True. Wire get_task and
list_tasks no longer expose every task to every admitted connection.

**File**: `ag2/network/hub/core.py` (modified, +62/-13)
```diff
@@ -266,6 +266,11 @@ def _expires_at(now_iso: str, ttl_seconds: int) -> str:
 # human-readable ids like ``task-1`` fit.
 _TASK_ID_RE = re.compile(r"[A-Za-z0-9][A-Za-z0-9._-]{0,127}")
 
+# Longest free-text field (a peer cancel ``reason``, a ``mirror_failed``
+# message) a wire client may place in front of another agent or the audit
+# log.
+_MAX_WIRE_TEXT = 500
+
 # Payload keys of ``TaskMirror``'s ``mirror_failed`` report — the only task
 # event a wire client may fire.
 _MIRROR_FAILURE_KEYS: frozenset[str] = frozenset({"op", "owner_id", "channel_id", "exc_type", "exc_message"})
@@ -274,7 +279,9 @@ def _expires_at(now_iso: str, ttl_seconds: int) -> str:
 # be mistaken for another agent's id, so none may be registered.
 _AGENT_ID_RE = re.compile(r"[0-9a-f]{32}")
 
-# Ops open to any connection: hub-wide discovery reads. ``register`` is
+# Ops open to any connection: hub-wide discovery reads. Task records are
+# not among them: ``get_task`` / ``list_tasks`` show a task only to its
+# owner and to the participants of its channel (``Hub._task_visible``). ``register`` is
 # open too, except that a ``remote_agent`` needs an owner (see
 # ``Hub._authorize_request``).
 _UNSCOPED_OPS: frozenset[str] = frozenset({
@@ -285,8 +292,6 @@ def _expires_at(now_iso: str, ttl_seconds: int) -> str:
     "find_agent_id",
     "names_for",
     "list_agents",
-    "get_task",
-    "list_tasks",
 })
 
 # Ops that act as, or read the private state of, the agent named by the
@@ -483,6 +488,8 @@ def __init__(
         # Per-channel locks for WAL append + dispatch ordering.
         self._channel_locks: dict[str, asyncio.Lock] = {}
         self._registration_lock = asyncio.Lock()
+        # Serialises the read-then-write that records a checkpoint's first writer.
+        self._checkpoint_claim_lock = asyncio.Lock()
 
         self._ttl_sweeper: _IntervalSweeper | None = None
         self._expectation_sweeper: _IntervalSweeper | None = None
@@ -800,6 +807,11 @@ async def fire_task_event(
         """
         await self._fan_out("on_task_event", task_id, kind, payload)
 
+    @property
+    def auth_schemes(self) -> list[str]:
+        """Auth schemes this hub accepts at registration and re-attach."""
+        return self._auth.schemes()
+
     @property
     def audit_log(self) -> AuditLog:
         """Public access to the built-in audit log (a :class:`HubListener`).
@@ -2227,6 +2239,7 @@ def _is_peer_cancel_request(self, envelope: Envelope, metadata: ChannelMetadata)
             and set(envelope.event_data) == {"task_id", "reason"}
             and envelope.event_data["task_id"] == envelope.task_id
             and isinstance(envelope.event_data["reason"], str)
+            and len(envelope.event_data["reason"]) <= _MAX_WIRE_TEXT
         )
 
     # ── Endpoint management ─────────────────────────────────────────────────
@@ -2714,9 +2727,10 @@ async def _dispatch_request_op(self, endpoint: LinkEndpoint, op: str, params: di
                 agent_id=params.get("agent_id"),
                 channel_id=params.get("channel_id"),
                 state=state,
-                limit=params.get("limit", 50),
+                limit=max(len(self._tasks), 1),
             )
-            return [t.to_dict() for t in tasks]
+            visible = [t for t in tasks if self._task_visible(endpoint, t)]
+            return [t.to_dict() for t in visible[: params.get("limit", 50)]]
         if op == "observe_task":
             await self.observe_task(TaskMetadata.from_dict(params["metadata"]))
             return None
@@ -2740,7 +2754,11 @@ async def _dispatch_request_op(self, endpoint: LinkEndpoint, op: str, params: di
             )
             return None
         if op == "fire_task_event":
-            await self.fire_task_event(params["task_id"], params["kind"], params.get("payload", {}))
+            payload = {
+                key: value[:_MAX_WIRE_TEXT] if isinstance(value, str) else value
+                for key, value in params.get("payload", {}).items()
+            }
+            await self.fire_task_event(params["task_id"], params["kind"], payload)
             return None
         if op == "checkpoint_task":
             await self.checkpoint_task(params["task_id"], params["state"])
@@ -2774,9 +2792,14 @@ async def _authorize_request(self, endpoint: LinkEndpoint, op: str, params: dict
         for task_id in _wire_task_ids(params):
             if not isinstance(task_id, str) or not _TASK_ID_RE.fullmatch(task_id):
                 raise ProtocolError(f"invalid task_id: {task_id!r}")
-        if op in _UNSCOPED_OPS:
+        if op in _UNSCOPED_OPS or op == "list_tasks":
             return
-        if op == "register":
+        if op == "get_task":
+            task = self._tasks.get(params["task_id"])
+            if task is not None and not self._task_visible(endpoint, task):
+                # Same answer as an unknown id, so ids cannot be probed.
+                raise NotFoundError(f"task not found: {params['task_id']}")
+ 
```

**File**: `ag2/network/transport/ws.py` (modified, +15/-0)
```diff
@@ -47,6 +47,8 @@
 
 logger = logging.getLogger(__name__)
 
+_LOOPBACK_HOSTS = frozenset({"127.0.0.1", "localhost", "::1"})
+
 
 class WsLinkClient:
     """Tenant-side WebSocket link to a hub.
@@ -267,6 +269,7 @@ async def serve_ws(
     ssl_context: Any = None,
     ping_interval: float | None = 20.0,
     ping_timeout: float | None = 20.0,
+    allow_unauthenticated: bool = False,
 ) -> AsyncGenerator["_WsServer"]:
     """Run a WebSocket server bound to a hub.
 
@@ -279,7 +282,19 @@ async def serve_ws(
 
     The context manager closes the server on exit and waits for all
     handler tasks to finish so the hub's endpoint registry is clean.
+
+    A hub whose registry holds ``NoAuth`` admits any client as any agent,
+    so it is served only on a loopback ``host`` unless
+    ``allow_unauthenticated=True``; otherwise :class:`ValueError` is raised.
     """
+    if "none" in hub.auth_schemes and host not in _LOOPBACK_HOSTS:
+        if not allow_unauthenticated:
+            raise ValueError(
+                f"serve_ws on {host!r} would accept the 'none' auth scheme: any client could register or "
+                "re-attach as any agent. Serve an AuthRegistry without NoAuth, bind a loopback host, "
+                "or pass allow_unauthenticated=True."
+            )
+        logger.warning("serve_ws on %s accepts the 'none' auth scheme: any client can act as any agent.", host)
     server = await _ws_serve(
         functools.partial(_serve_connection, hub),
         host,
```

**File**: `docs/adr/0021-hub-binds-wire-requests-to-connection-identity.md` (modified, +23/-7)
```diff
@@ -28,7 +28,8 @@ their signatures and stay unchecked.
 `Hub._authorize_request` classifies each op:
 
 - **Unscoped** — `register` and discovery reads (agents, resumes, skills,
-  rules, tasks). A fresh connection runs these before its `HelloFrame`.
+  rules). A fresh connection runs these before its `HelloFrame`. `get_task` /
+  `list_tasks` are filtered to the tasks the connection may see.
 - **Agent-scoped** — the named agent must be bound: identity mutation,
   `unregister`, `create_channel`, `can_send`, `pending_turns_for`,
   `report_turn_failure`, `record_observation`, the `sender_id` of
@@ -104,7 +105,7 @@ itself from `update_task`. So over the wire the only task event accepted is the
 bound and, for an observed task, be that task's owner with the task's own
 channel; for an unobserved task any `channel_id` must be one the owner
 participates in. Telemetry still records `mirror_failed` as a failed task span.
-Its owner is always the reporting agent; for an observed task it carries that
+For an unobserved task id whose checkpoint another connection wrote, the report is denied like any other access to that checkpoint. Its owner is always the reporting agent; for an observed task it carries that
 task's own id and channel, while for an unobserved task it carries whatever
 pattern-valid task id the reporter names and either no channel or one the
 reporter is in.
@@ -161,11 +162,26 @@ participant of the task's `channel_id`.
   so filtering by audience would diverge it from the hub's fold.
 - Re-attaching an agent from a new connection moves its authority there; the old
   connection's late requests and receipts for it are rejected or dropped.
-- Task records are hub-wide reads: any admitted connection sees every task's
-  spec, state, progress and result through `get_task` / `list_tasks`. This is
-  intended — delegators poll and wait on tasks other agents own, and the tasks
-  tool's `scope="all"` lists across owners — so agents must not put anything in
-  a task spec or result that other agents on the hub may not read.
+- Task records are visible over the wire only to the task's owner and to the
+  participants of its channel: `get_task` answers `not_found` for any other
+  task, and `list_tasks` leaves them out. A delegator polls the tasks it
+  delegated because it shares their channel; `scope="all"` lists what the
+  connection may see, not every task on the hub. A task with no channel is
+  visible to its owner alone.
+- A wire envelope's `audience` may name only participants of its channel, and
+  a peer cancel request's `reason` is at most 500 characters, as is the free
+  text of a `mirror_failed` payload (longer is clipped). `report_turn_failure`
+  needs the named agent to participate in the channel.
 - A checkpoint written only in-process (or before writers were recorded) has no
   recorded writer: any connection with a bound agent can read it, and the first
   one to write it over the wire claims it.
+- Recording a checkpoint's first writer is serialised by a hub lock, so two
+  connections racing to checkpoint the same new id cannot both claim it.
+  Squatting stays: an id nobody has checkpointed yet goes to whoever writes it
+  first.
+- `get_resume` and `get_skill` are discovery reads (the `peers` tool uses
+  them), and `get_rule` is read by `attach` before the Hello, so none is
+  scoped to a bound agent.
+- A registry holding `NoAuth` admits any client as any agent, so `serve_ws`
+  raises `ValueError` for such a hub on a non-loopback host. Operators who
+  accept that pass `allow_unauthenticated=True`, which logs a warning instead.
```

**File**: `test/network/test_connection_identity.py` (modified, +238/-98)
```diff
@@ -13,12 +13,13 @@
 import asyncio
 import dataclasses
 import json
+import logging
 from collections.abc import AsyncGenerator
 from contextlib import asynccontextmanager
 
 import pytest
 
-from ag2 import Agent
+from ag2 import Agent, Context
 from ag2.knowledge import MemoryKnowledgeStore
 from ag2.network import (
     EV_CHANNEL_CLOSED,
@@ -39,20 +40,24 @@
     HelloFrame,
     Hub,
     HubClient,
+    LimitsBlock,
     NoAuth,
+    NotFoundError,
     Passport,
     PingFrame,
     PongFrame,
     ProtocolError,
     ReceiptFrame,
     Resume,
+    Rule,
     WsLink,
     WsLinkClient,
     serve_ws,
 )
 from ag2.network.hub.layout import passport_path
 from ag2.network.task_mirror import TaskMirror
-from ag2.task import TaskMetadata, TaskSpec, TaskState
+from ag2.stream import MemoryStream
+from ag2.task import TaskMetadata, TaskSpec, TaskStarted, TaskState
 
 from ._helpers import ScriptedConfig
 
@@ -148,8 +153,8 @@ async def _serve(*, allow_no_auth: bool = False, allow_remote_agents: bool = Fal
         await hub.close()
 
 
+@pytest.mark.asyncio
 class TestActingAsAnotherAgent:
-    @pytest.mark.asyncio
     async def test_connection_acts_as_each_agent_it_registered_and_no_other(self) -> None:
         async with _serve() as (hub, url):
             shared_hc, bob_hc = HubClient(WsLink(url)), HubClient(WsLink(url))
@@ -169,7 +174,6 @@ async def test_connection_acts_as_each_agent_it_registered_and_no_other(self) ->
                 await shared_hc.close()
                 await bob_hc.close()
 
-    @pytest.mark.asyncio
     async def test_post_envelope_as_another_agent_is_denied(self) -> None:
         async with _serve() as (hub, url):
             alice_hc, bob_hc, mallory_hc = HubClient(WsLink(url)), HubClient(WsLink(url)), HubClient(WsLink(url))
@@ -197,7 +201,6 @@ async def test_post_envelope_as_another_agent_is_denied(self) -> None:
                 await bob_hc.close()
                 await mallory_hc.close()
 
-    @pytest.mark.asyncio
     async def test_update_of_another_agents_task_is_denied(self) -> None:
         async with _serve() as (hub, url):
             bob_hc, mallory_hc = HubClient(WsLink(url)), HubClient(WsLink(url))
@@ -218,7 +221,6 @@ async def test_update_of_another_agents_task_is_denied(self) -> None:
                 await bob_hc.close()
                 await mallory_hc.close()
 
-    @pytest.mark.asyncio
     async def test_receipt_for_another_agent_does_not_advance_its_cursor(self) -> None:
         async with _serve() as (hub, url):
             mallory_hc = HubClient(WsLink(url))
@@ -241,7 +243,6 @@ async def test_receipt_for_another_agent_does_not_advance_its_cursor(self) -> No
             finally:
                 await mallory_hc.close()
 
-    @pytest.mark.asyncio
     async def test_checkpoint_of_an_unobserved_task_belongs_to_its_first_writer(self) -> None:
         async with _serve() as (_, url):
             bob_hc, mallory_hc = HubClient(WsLink(url)), HubClient(WsLink(url))
@@ -260,7 +261,6 @@ async def test_checkpoint_of_an_unobserved_task_belongs_to_its_first_writer(self
                 await bob_hc.close()
                 await mallory_hc.close()
 
-    @pytest.mark.asyncio
     async def test_observing_a_task_id_checkpointed_by_another_agent_is_denied(self) -> None:
         async with _serve() as (_, url):
             bob_hc, mallory_hc = HubClient(WsLink(url)), HubClient(WsLink(url))
@@ -285,8 +285,8 @@ async def test_observing_a_task_id_checkpointed_by_another_agent_is_denied(self)
                 await mallory_hc.close()
 
 
+@pytest.mark.asyncio
 class TestChannelScope:
-    @pytest.mark.asyncio
     async def test_only_participants_read_the_channel_wal(self) -> None:
         async with _serve() as (_, url):
             alice_hc, bob_hc, mallory_hc = HubClient(WsLink(url)), HubClient(WsLink(url)), HubClient(WsLink(url))
@@ -304,7 +304,6 @@ async def test_only_participants_read_the_channel_wal(self) -> None:
                 await bob_hc.close()
                 await mallory_hc.close()
 
-    @pytest.mark.asyncio
     async def test_list_channels_without_agent_lists_only_the_connections_channels(self) -> None:
         async with _serve() as (_, url):
             alice_hc, bob_hc, mallory_hc = HubClient(WsLink(url)), HubClient(WsLink(url)), HubClient(WsLink(url))
@@ -321,7 +320,6 @@ async def test_list_channels_without_agent_lists_only_the_connections_channels(s
                 await bob_hc.close()
                 await mallory_hc.close()
 
-    @pytest.mark.asyncio
     async def test_non_participant_content_is_refused_whatever_the_adapter_accepts(self) -> None:
         # The conversation adapter accepts non-text events from anyone.
         async with _serve() as (hub, url):
@@ -349,7 +347,6 @@ async def test_non_participant_content_is_refused_whatever_the_adapter_accepts(s
                 await bob_hc.close()
                 await mallory_hc.close()
 
-    @pytest.mark.asyncio
     async def test_non_participant_protocol_event
```

**File**: `website/docs/_blogs/2026-06-16-AG2-Network-Networks-You-Can-Deploy/index.mdx` (modified, +1/-1)
```diff
@@ -48,7 +48,7 @@ from ag2.network import Hub, serve_ws
 
 async def main() -> None:
     hub = await Hub.open(DiskKnowledgeStore(Path("./hub-data")))
-    async with serve_ws(hub, "0.0.0.0", 8765) as server:
+    async with serve_ws(hub, "127.0.0.1", 8765) as server:
         host, port = server.sockets[0].getsockname()
         print(f"hub listening on ws://{host}:{port}")
         await asyncio.Future()  # run until interrupted
```

**File**: `website/docs/user-guide/network/distributed.mdx` (modified, +6/-2)
```diff
@@ -40,7 +40,7 @@ from ag2.network import Hub, serve_ws
 
 async def main() -> None:
     hub = await Hub.open(MemoryKnowledgeStore())
-    async with serve_ws(hub, "0.0.0.0", 8765) as server:
+    async with serve_ws(hub, "127.0.0.1", 8765) as server:
         host, port = server.sockets[0].getsockname()[:2]
         print(f"listening on ws://{host}:{port}", flush=True)
         with contextlib.suppress(asyncio.CancelledError):
@@ -52,6 +52,10 @@ asyncio.run(main())
 
 `#!python serve_ws(hub, host, port)` is an async context manager. It binds a WebSocket server, hands each incoming connection its own `#!python WsLinkEndpoint`, and lets the hub dispatch from there. Pass `#!python port=0` to bind an ephemeral port and read the real one from `#!python server.sockets[0].getsockname()[1]`.
 
+!!! warning "Reachable addresses need real authentication"
+
+    The default auth registry includes `#!python NoAuth`, which lets any client act as any agent. `#!python serve_ws` therefore raises `#!python ValueError` when such a hub is bound to a non-loopback host. To listen on a reachable address, build the hub with an `#!python AuthRegistry` without `#!python NoAuth` (see [Authentication](#authentication)), or pass `#!python allow_unauthenticated=True` to accept the risk.
+
 ## Connecting a Remote Agent
 
 From any other process — same machine, different container, or across a real network:
@@ -163,7 +167,7 @@ except AccessDeniedError:
     ...  # "connection is not bound to agent '...'"
 ```
 
-`#!python list_channels()` without an `agent_id` lists only the channels of the connection's own agents. Discovery reads — `#!python get_agent`, `#!python list_agents`, resumes, skills, rules, `#!python get_task`, `#!python list_tasks` — stay open to every connection, so every agent on the hub can read every task's spec and result. Once `#!python attach` re-binds an agent to a new connection, the old connection can no longer act as it.
+`#!python list_channels()` without an `agent_id` lists only the channels of the connection's own agents. Discovery reads — `#!python get_agent`, `#!python list_agents`, resumes, skills, rules — stay open to every connection. `#!python get_task` and `#!python list_tasks` show a task only to its owner and to the participants of its channel. An envelope's `audience` may name only participants of its channel. Once `#!python attach` re-binds an agent to a new connection, the old connection can no longer act as it.
 
 In-process clients (`#!python LocalLink` with a hub reference) call the hub directly and are not subject to these checks.
 
```

---

### Incident Patch 10: `0d6dc589` (2026-10-02)
**Commit Message**: fix: port provider, live and MCP bug fixes out of #3275 (#3333)

- gemini: report no language rather than crash on a code part without one
- anthropic: read a downloaded file's bytes off the SDK's binary response
- openai: answer a completion that carries no choices with a response
- live: send a Gemini Live tool's schema as parameters_json_schema
- mcp: stop binding the request context to a reader's first parameter
- build(typing): cover the touched modules in the mypy `files` list

**File**: `ag2/config/anthropic/files.py` (modified, +9/-9)
```diff
@@ -36,32 +36,32 @@ async def upload(self, data: bytes, filename: str, purpose: str | None = None) -
         )
         return UploadedFile(
             file_id=result.id,
-            filename=result.filename if hasattr(result, "filename") else filename,
+            filename=result.filename,
             provider=FileProvider.ANTHROPIC,
-            bytes_count=result.size_bytes if hasattr(result, "size_bytes") else None,
+            bytes_count=result.size_bytes,
             purpose=purpose,
-            created_at=_created_at_to_float(result.created_at if hasattr(result, "created_at") else None),
+            created_at=_created_at_to_float(result.created_at),
         )
 
     async def read(self, file_id: str) -> FileContent:
         response = await self._client.beta.files.download(file_id)
         metadata = await self._client.beta.files.retrieve_metadata(file_id)
         return FileContent(
-            name=metadata.filename if hasattr(metadata, "filename") else None,
-            data=response.content if hasattr(response, "content") else bytes(response),
-            media_type=metadata.mime_type if hasattr(metadata, "mime_type") else None,
+            name=metadata.filename,
+            data=await response.read(),
+            media_type=metadata.mime_type,
         )
 
     async def list(self) -> list[UploadedFile]:
         result = await self._client.beta.files.list()
         return [
             UploadedFile(
                 file_id=f.id,
-                filename=f.filename if hasattr(f, "filename") else None,
+                filename=f.filename,
                 provider=FileProvider.ANTHROPIC,
-                bytes_count=f.size_bytes if hasattr(f, "size_bytes") else None,
+                bytes_count=f.size_bytes,
                 purpose=None,
-                created_at=_created_at_to_float(f.created_at if hasattr(f, "created_at") else None),
+                created_at=_created_at_to_float(f.created_at),
             )
             for f in result.data
         ]
```

**File**: `ag2/config/gemini/events.py` (modified, +1/-1)
```diff
@@ -41,7 +41,7 @@ def from_executable_code(cls, part: types.Part) -> "GeminiServerToolCallEvent |
             name=CODE_EXECUTION_TOOL_NAME,
             arguments=json.dumps({
                 "code": part.executable_code.code or "",
-                "language": language.name if language.name else str(language) or "",
+                "language": language.name if language is not None else "",
             }),
             part=part,
         )
```

**File**: `ag2/config/openai/mappers.py` (modified, +7/-7)
```diff
@@ -58,6 +58,8 @@
     Mcp,
 )
 from openai.types.responses.web_search_tool_param import UserLocation as WebSearchUserLocation
+from openai.types.shared_params import ResponseFormatJSONSchema
+from openai.types.shared_params.response_format_json_schema import JSONSchema
 
 from ag2.compact import CompactionSummary
 from ag2.config.openai.events import (
@@ -117,14 +119,13 @@ def _kind_label(kind: BinaryType | str) -> str:
     return kind.value if isinstance(kind, BinaryType) else str(kind)
 
 
-def response_proto_to_schema(response: ResponseProto | None) -> dict[str, Any] | None:
+def response_proto_to_schema(response: ResponseProto[Any] | None) -> ResponseFormatJSONSchema | None:
     """Convert a ResponseProto to Chat Completions response_format."""
     if not response or not response.json_schema:
         return None
 
-    strict_schema = _strictify_schema(response.json_schema)
-    schema: dict[str, Any] = {
-        "schema": strict_schema,
+    schema: JSONSchema = {
+        "schema": _strictify_schema(response.json_schema),
         "name": response.name,
         "strict": True,
     }
@@ -541,7 +542,7 @@ def _ensure_object_schema(params: dict[str, Any]) -> dict[str, Any]:
     return schema
 
 
-def tool_to_api(t: ToolSchema) -> dict[str, Any]:
+def tool_to_api(t: ToolSchema) -> ChatCompletionFunctionToolParam:
     """Chat Completions API tool format."""
     if isinstance(t, FunctionToolSchema):
         if t.defer_loading:
@@ -550,15 +551,14 @@ def tool_to_api(t: ToolSchema) -> dict[str, Any]:
             # instead of silently sending the tool eagerly (which would defeat
             # defer_loading and give no error). Use the Responses API instead.
             raise UnsupportedToolError("function with defer_loading (use the Responses API)", "openai-completions")
-        fn_tool: ChatCompletionFunctionToolParam = {
+        return {
             "type": "function",
             "function": {
                 "name": t.function.name,
                 "description": t.function.description,
                 "parameters": _ensure_object_schema(t.function.parameters),
             },
         }
-        return dict(fn_tool)
 
     raise UnsupportedToolError(t.type, "openai-completions")
 
```

**File**: `ag2/config/openai/openai_client.py` (modified, +66/-47)
```diff
@@ -10,8 +10,16 @@
 from fast_depends.library.serializer import SerializerProto
 from openai import DEFAULT_MAX_RETRIES, AsyncOpenAI, AsyncStream, Omit, not_given, omit
 from openai.types import ChatModel
-from openai.types.chat import ChatCompletion, ChatCompletionChunk
-from openai.types.chat.completion_create_params import PromptCacheOptions
+from openai.types.chat import (
+    ChatCompletion,
+    ChatCompletionChunk,
+    ChatCompletionPredictionContentParam,
+    ChatCompletionStreamOptionsParam,
+    ChatCompletionToolChoiceOptionParam,
+    ChatCompletionToolUnionParam,
+)
+from openai.types.chat.chat_completion_message_function_tool_call import ChatCompletionMessageFunctionToolCall
+from openai.types.chat.completion_create_params import PromptCacheOptions, WebSearchOptions
 from typing_extensions import Required
 
 from ag2.config.client import LLMClient
@@ -26,12 +34,16 @@
     ToolCallsEvent,
     Usage,
 )
+from ag2.exceptions import UnsupportedToolError
 from ag2.response import ResponseProto
 from ag2.tools.schemas import ToolSchema
 
 from .mappers import convert_messages, normalize_usage, response_proto_to_schema, tool_to_api
 
 ReasoningEffort = Literal["none", "minimal", "low", "medium", "high", "xhigh"]
+Modality = Literal["text", "audio"]
+ServiceTier = Literal["auto", "default", "flex", "scale", "priority", "fast"]
+Verbosity = Literal["low", "medium", "high"]
 
 
 class CreateOptions(TypedDict, total=False):
@@ -49,21 +61,21 @@ class CreateOptions(TypedDict, total=False):
     user: str | Omit
     logprobs: bool | None | Omit
     top_logprobs: int | None | Omit
-    tool_choice: str | dict[str, Any] | Omit
+    tool_choice: ChatCompletionToolChoiceOptionParam | Omit
     parallel_tool_calls: bool | Omit
     logit_bias: dict[str, int] | None | Omit
     metadata: dict[str, str] | None | Omit
-    modalities: list[str] | None | Omit
-    prediction: dict[str, Any] | None | Omit
+    modalities: list[Modality] | None | Omit
+    prediction: ChatCompletionPredictionContentParam | None | Omit
     prompt_cache_key: str | Omit
     prompt_cache_options: PromptCacheOptions | Omit
     safety_identifier: str | Omit
-    service_tier: str | None | Omit
+    service_tier: ServiceTier | None | Omit
     store: bool | None | Omit
-    verbosity: str | None | Omit
-    web_search_options: dict[str, Any] | Omit
+    verbosity: Verbosity | None | Omit
+    web_search_options: WebSearchOptions | Omit
     stream: bool
-    stream_options: dict[str, Any] | Omit
+    stream_options: ChatCompletionStreamOptionsParam | None | Omit
     reasoning_effort: ReasoningEffort | None | Omit
     extra_body: dict[str, Any] | None
 
@@ -96,79 +108,86 @@ def __init__(
             http_client=http_client,
         )
 
-        self._create_options = create_options or {}
-        self._streaming = self._create_options.get("stream", False)
+        # Left as ``None`` rather than widened to an empty mapping: ``model`` is
+        # required, so there is no such thing as an empty set of create options.
+        self._create_options = create_options
 
     async def __call__(
         self,
         messages: Sequence[BaseEvent],
         context: "ConversationContext",
         *,
         tools: Iterable[ToolSchema],
-        response_schema: ResponseProto | None,
+        response_schema: ResponseProto[Any] | None,
         serializer: SerializerProto,
     ) -> ModelResponse:
         if response_schema and response_schema.system_prompt:
             prompt: Iterable[str] = chain(context.prompt, (response_schema.system_prompt,))
         else:
             prompt = context.prompt
 
-        openai_messages = convert_messages(prompt, messages, serializer)
+        if self._create_options is None:
+            raise ValueError("OpenAIClient was built without create options, so it has no model to call.")
 
-        openai_tools = [tool_to_api(t) for t in tools]
+        openai_messages = convert_messages(prompt, messages, serializer)
 
-        kwargs = {}
-        if r := response_proto_to_schema(response_schema):
-            kwargs["response_format"] = r
+        openai_tools: list[ChatCompletionToolUnionParam] = [tool_to_api(t) for t in tools]
 
         response = await self._client.chat.completions.create(
             **self._create_options,
-            **kwargs,
+            response_format=response_proto_to_schema(response_schema) or omit,
             messages=openai_messages,
             tools=openai_tools or omit,
         )
 
-        if self._streaming:
-            result = await self._process_stream(response, context)
-        else:
-            result = await self._process_completion(response, context)
-
-        return result
+        if isinstance(response, AsyncStream):
+            return await self._process_stream(response, context)
+        return await self._process_completion(response, context)
 
     async def _process_completion(
         self,
         completion: ChatCompletion,
      
```

**File**: `ag2/events/base.py` (modified, +47/-12)
```diff
@@ -7,7 +7,7 @@
 from collections.abc import Callable
 from copy import copy
 from types import EllipsisType
-from typing import Any
+from typing import TYPE_CHECKING, Any, ClassVar, Literal, TypeAlias, get_args
 
 from typing_extensions import dataclass_transform
 
@@ -17,7 +17,7 @@
 try:
     import annotationlib as _annotationlib
 except ImportError:
-    _annotationlib = None  # type: ignore[assignment]
+    _annotationlib = None
 
 
 _REPR_MAX_LEN = 80
@@ -50,7 +50,8 @@ def is_conversational(event: Any) -> bool:
     return not getattr(cls, "__transient__", False) and getattr(cls, "__conversational__", True)
 
 
-_REPLAY_ROLES = frozenset({"anchor", "turn"})
+_ReplayRole: TypeAlias = Literal["anchor", "turn"]
+_REPLAY_ROLES = frozenset(get_args(_ReplayRole))
 
 
 class ProviderReplay:
@@ -67,6 +68,9 @@ class ProviderReplay:
     that happens to subclass ``ModelReasoning`` is not filed as an anchor.
     """
 
+    # Annotation only, so a subclass that forgets it still fails the check below.
+    __replay_role__: ClassVar[_ReplayRole]
+
     # No ``__transient__`` here on purpose: ``ModelReasoning`` is transient and would
     # shadow it under the natural base order, so subclasses declare their own.
     def __init_subclass__(cls, **kwargs: Any) -> None:
@@ -83,7 +87,7 @@ def __init_subclass__(cls, **kwargs: Any) -> None:
             )
 
 
-class Field:
+class FieldInfo:
     # Set only on the copies ``__get__`` binds to an owner class.
     event_class: type
 
@@ -127,9 +131,11 @@ def __get__(self, instance: Any | None, owner: type) -> Any:
     def __set__(self, instance: Any, value: Any) -> None:
         instance.__dict__[self.name] = value
 
+    # On the class a field compares into a condition (the DSL); `object` promises a `bool`.
     def __eq__(self, other: Any) -> Condition:  # type: ignore[override]
         return OpCondition(check_eq, self.name, other, self.event_class)
 
+    # On the class a field compares into a condition (the DSL); `object` promises a `bool`.
     def __ne__(self, other: Any) -> Condition:  # type: ignore[override]
         return OpCondition(operator.ne, self.name, other, self.event_class)
 
@@ -149,6 +155,38 @@ def is_(self, other: Any) -> Condition:
         return OpCondition(operator.is_, self.name, other, self.event_class)
 
 
+if TYPE_CHECKING:
+    # A field's declared type is the type of its *value*, not of the descriptor
+    # that stands in for it, so a checker that saw ``FieldInfo`` here would reject
+    # every declaration. Declaring the specifier as a function returning ``Any`` is
+    # the shape ``dataclasses.field`` and pydantic's ``Field`` use in their stubs,
+    # for the same reason. ``default`` is keyword-only here although the runtime
+    # takes it positionally: a checker reads a field specifier's default by name
+    # only, so ``Field("")`` would silently make the field required.
+    def Field(  # noqa: N802 - the public name of the specifier; lowercase would rename the API
+        *,
+        default: Any = Ellipsis,
+        default_factory: Callable[[], Any] | EllipsisType = Ellipsis,
+        init: bool = True,
+        repr: bool = True,
+        compare: bool = True,
+        hash: bool | None = None,
+        kw_only: bool = True,
+    ) -> Any: ...
+
+else:
+    Field = FieldInfo
+
+
+# On the metaclass rather than on ``BaseEvent``: the decorator applied to a class
+# transforms that class's *subclasses*, so ``BaseEvent``'s own fields — ``created_at``
+# — never reached a subclass's synthesised ``__init__`` and every ``created_at=`` was
+# read as an unexpected keyword. Applied to the metaclass it transforms every class
+# built from it, ``BaseEvent`` included.
+@dataclass_transform(
+    kw_only_default=True,
+    field_specifiers=(Field,),
+)
 class _ConditionMeta(type):
     """Metaclass providing class-level condition operators (~, |, or_, not_)."""
 
@@ -174,7 +212,7 @@ def not_(cls) -> NotCondition:
 
 def _process_fields(cls: type) -> None:
     """Process annotations and set up Field descriptors for a class."""
-    fields: dict[str, Field] = {}
+    fields: dict[str, FieldInfo] = {}
 
     # Get annotations in a Python 3.14+ compatible way (PEP 649: lazy annotation evaluation
     # means __annotations__ is no longer eagerly populated in the class namespace dict).
@@ -187,25 +225,22 @@ def _process_fields(cls: type) -> None:
     for field_name in annotations:
         raw = own_namespace.get(field_name, _MISSING)
         if raw is _MISSING:
-            field = Field()
-        elif isinstance(raw, Field):
+            field = FieldInfo()
+        elif isinstance(raw, FieldInfo):
             field = raw
         else:
-            field = Field(raw)
+            field = FieldInfo(raw)
 
         if not field.name:
             field.name = field_name
 
         fields[field_name] = field
         setattr(cls, field_name, field)
 
+    # Stamped on every event class here and read back with `getattr`; `type` does not de
```

**File**: `ag2/live/gemini.py` (modified, +1/-1)
```diff
@@ -224,7 +224,7 @@ def _tool_schema_to_function_declaration(t: ToolSchema) -> gtypes.FunctionDeclar
         return {
             "name": t.function.name,
             "description": t.function.description,
-            "parameters": _ensure_object_schema(t.function.parameters),
+            "parameters_json_schema": _ensure_object_schema(t.function.parameters),
         }
     raise NotImplementedError(f"Gemini Live does not support tool type {t.type!r}")
 
```

**File**: `ag2/mcp/apps.py` (modified, +4/-3)
```diff
@@ -36,13 +36,13 @@ async def show_item(item_id: str) -> Item:
 from collections.abc import Awaitable, Callable, Iterable, Mapping, Sequence
 from dataclasses import dataclass, replace
 from pathlib import Path
-from typing import Any, overload
+from typing import Annotated, Any, overload
 
 from mcp.server.apps import APP_MIME_TYPE, EXTENSION_ID, ResourceCsp, ResourcePermissions, Visibility
 from mcp.server.apps import client_supports_apps as client_supports_apps
 from mcp.types import CallToolResult, ToolAnnotations
 
-from ag2.annotations import Variable
+from ag2.annotations import ContextField, Variable
 from ag2.tools.builtin._resolve import resolve_variable
 
 from ._async import call_user_fn
@@ -469,7 +469,8 @@ class _AppResourceReader:
     def __init__(self, app: MCPApp) -> None:
         self._app = app
 
-    async def __call__(self, context: MCPExecutionContext) -> str:
+    # Injected by name like any reader's `Context`, not bound to a positional slot.
+    async def __call__(self, context: Annotated[MCPExecutionContext, ContextField(cast=False)]) -> str:
         return await self._app._read(context)
 
 
```

**File**: `ag2/mcp/tools.py` (modified, +13/-10)
```diff
@@ -114,10 +114,11 @@ async def call_with_context(fn: Callable[..., Any], context: "MCPExecutionContex
     annotations ask for.
     """
     call_model = build_model(fn, serialize_result=False)
+    # `asolve` annotates each keyword as a `dict[str, Any]`; the values really are arbitrary.
+    options: dict[str, Any] = {CONTEXT_OPTION_NAME: context}
     async with AsyncExitStack() as stack:
         return await call_model.asolve(
-            context,
-            **{CONTEXT_OPTION_NAME: context},
+            **options,
             stack=stack,
             cache_dependencies={},
         )
@@ -285,8 +286,8 @@ def mcp_tool(
     *,
     name: str | None = None,
     description: str | None = None,
-    title: str | None = None,
-    annotations: ToolAnnotations | None = None,
+    title: str | Variable | None = None,
+    annotations: ToolAnnotations | Variable | None = None,
     output_schema: dict[str, Any] | None = None,
     meta: Mapping[str, Any] | None = None,
     sync_to_thread: bool = True,
@@ -299,8 +300,8 @@ def mcp_tool(
     *,
     name: str | None = None,
     description: str | None = None,
-    title: str | None = None,
-    annotations: ToolAnnotations | None = None,
+    title: str | Variable | None = None,
+    annotations: ToolAnnotations | Variable | None = None,
     output_schema: dict[str, Any] | None = None,
     meta: Mapping[str, Any] | None = None,
     sync_to_thread: bool = True,
@@ -312,8 +313,8 @@ def mcp_tool(
     *,
     name: str | None = None,
     description: str | None = None,
-    title: str | None = None,
-    annotations: ToolAnnotations | None = None,
+    title: str | Variable | None = None,
+    annotations: ToolAnnotations | Variable | None = None,
     output_schema: dict[str, Any] | None = None,
     meta: Mapping[str, Any] | None = None,
     sync_to_thread: bool = True,
@@ -335,9 +336,11 @@ def mcp_tool(
         function: The function (when used as a bare ``@mcp_tool``).
         name: Tool name. Defaults to the function name.
         description: Tool description. Defaults to the function docstring.
-        title: Human-readable display name for ``tools/list``.
+        title: Human-readable display name for ``tools/list``; a ``Variable``
+            is resolved per request.
         annotations: ``mcp.types.ToolAnnotations`` behavior hints
-            (``readOnlyHint``, ``destructiveHint``, …) for the host.
+            (``readOnlyHint``, ``destructiveHint``, …) for the host; a
+            ``Variable`` is resolved per request.
         output_schema: Overrides the schema derived from the return annotation.
         meta: ``_meta`` to advertise on the tool.
         sync_to_thread: Run a sync function in a worker thread.
```

---

### Incident Patch 11: `2c03952d` (2026-10-02)
**Commit Message**: fix(skills): execute nested scripts from declared paths (#3181)

Co-authored-by: WeiHaoxuan <[REDACTED_EMAIL]>
Co-authored-by: Mark Sze <[REDACTED_EMAIL]>
Co-authored-by: Lancetnik <[REDACTED_EMAIL]>

**File**: `ag2/tools/skills/runtime/local/runtime.py` (modified, +8/-7)
```diff
@@ -159,7 +159,7 @@ async def execute(
         resolved_script = _resolve_within(scripts_dir / script, scripts_dir)
         if script not in {s.name for s in skill.scripts} or resolved_script is None:
             raise FileNotFoundError(f"script {script!r} not found in {scripts_dir}")
-        command = _script_command(resolved_script)
+        command = _script_command(resolved_script, resolved_script.relative_to(scripts_dir.resolve()))
         if args:
             command.extend(args)
         # async + await env.run(...) so the command runs in the agent's own
@@ -241,22 +241,23 @@ def _resolve_within(path: Path, base: Path) -> Path | None:
     return resolved
 
 
-def _script_command(resolved_script: Path) -> list[str]:
-    """Build the argv to run *resolved_script* from its own directory.
+def _script_command(resolved_script: Path, relative_script: Path) -> list[str]:
+    """Build the argv to run *resolved_script* from the scripts directory.
 
     A shebang takes precedence; otherwise ``.py``/``.sh`` map to their
     interpreters, and anything else is made executable and run directly.
     """
+    script_arg = f"./{relative_script.as_posix()}"
     first_line = resolved_script.read_text(encoding="utf-8", errors="replace").split("\n", 1)[0]
     if first_line.startswith("#!"):
         resolved_script.chmod(resolved_script.stat().st_mode | stat.S_IXUSR | stat.S_IXGRP | stat.S_IXOTH)
-        return [f"./{resolved_script.name}"]
+        return [script_arg]
     if resolved_script.suffix.lower() == ".py":
-        return ["python3", f"./{resolved_script.name}"]
+        return ["python3", script_arg]
     if resolved_script.suffix.lower() == ".sh":
-        return ["sh", f"./{resolved_script.name}"]
+        return ["sh", script_arg]
     resolved_script.chmod(resolved_script.stat().st_mode | stat.S_IXUSR | stat.S_IXGRP | stat.S_IXOTH)
-    return [f"./{resolved_script.name}"]
+    return [script_arg]
 
 
 def _wrap_skill_content(name: str, body: str, skill_dir: Path, skill: Skill) -> str:
```

**File**: `test/tools/skills/test_toolkit.py` (modified, +21/-0)
```diff
@@ -74,6 +74,27 @@ async def test_run_script_falls_through_on_skill_not_found(tmp_path: Path, conte
     assert "HELLO" in result.result.parts[0].content
 
 
+@pytest.mark.asyncio
+async def test_run_skill_script_executes_nested_script(tmp_path: Path, context: Context) -> None:
+    skills_root = tmp_path / "skills"
+    skill_dir = skills_root / "nested-script"
+    scripts_dir = skill_dir / "scripts" / "helpers"
+    scripts_dir.mkdir(parents=True)
+    (skill_dir / "SKILL.md").write_text(
+        "---\nname: nested-script\ndescription: Runs a nested script\n---\n# Nested script\n"
+    )
+    (scripts_dir / "report.py").write_text('print("NESTED SCRIPT RAN")\n')
+    run_tool = SkillsToolkit(LocalRuntime(dir=skills_root)).run_skill_script()
+
+    args = json.dumps({"name": "nested-script", "script": "helpers/report.py"})
+    result = await run_tool(ToolCallEvent(name="run_skill_script", arguments=args), context)
+
+    assert not isinstance(result, ToolErrorEvent)
+    [output] = result.result.parts
+    assert isinstance(output, TextInput)
+    assert "NESTED SCRIPT RAN" in output.content
+
+
 @pytest.mark.asyncio
 async def test_run_script_routes_named_args_to_memory_runtime(tmp_path: Path, context: Context) -> None:
     skill = MemorySkill(name="calc", description="Double a number")
```

---

### Incident Patch 12: `2c967d04` (2026-10-02)
**Commit Message**: feat(ag-ui)!: serve AG-UI 1.0 (#3314)

* feat(ag-ui)!: serve AG-UI 1.0

* feat(ag-ui): complete AG-UI 1.0 run handling

Add shared capability declarations, tolerant RunAgentInput parsing, and
client context/state handling across AGUIStream and the A2UI transport.

Ensure runs close cleanly with terminal events on failures, interrupts,
cancellation, and shutdown while reporting usage per run and per
provider/model. Expand protocol fixtures, endpoint tests, and docs for
the updated server behavior.

* fix(ag-ui): keep interrupts held when resumes do not cover them

Refuse runs before streaming when a thread has an outstanding interrupt
but the request omits its answer, while preserving the held turn so it can
still be resumed later.

Strip unknown resume statuses and content source kinds with warnings, and
carry restated tool call names onto tool results for provider mappers.

BREAKING CHANGE: the exported interrupt refusal constant is now
NOT_COVERED with code INTERRUPT_NOT_COVERED.

* refactor(ag-ui): derive input filtering from AG-UI types

Replace hand-maintained role, content, source, and resume status checks
with typed SDK unions so normalization stays aligned with the schema.


**File**: `ag2/a2ui/dispatch.py` (modified, +58/-4)
```diff
@@ -12,11 +12,25 @@
 from contextlib import ExitStack
 from dataclasses import dataclass, field
 from types import MappingProxyType
+from typing import Union
 
 from ag2.agent import Agent
 from ag2.annotations import Context
 from ag2.context import ConversationContext, strip_reserved_variables
-from ag2.events import BaseEvent, HumanInputRequest, ModelRequest, TextInput, UsageEvent
+from ag2.events import (
+    BaseEvent,
+    HumanInputRequest,
+    ModelRequest,
+    TaskCancelled,
+    TaskCompleted,
+    TaskExpired,
+    TaskFailed,
+    TaskStarted,
+    TextInput,
+    ToolCallEvent,
+    ToolResultEvent,
+    UsageEvent,
+)
 from ag2.stream import MemoryStream
 from ag2.usage import collect_usage_events
 
@@ -51,6 +65,15 @@ class A2UIMessageFrame:
 # optional AG-UI one, and this module must import without it.
 Interrupter = Callable[[HumanInputRequest, Context], Awaitable[BaseEvent | None]]
 
+# A delegation starting or ending. ``Union``, not ``|``: on event classes ``|``
+# builds a stream Condition, which is no type for a subscriber's annotation.
+TaskEvent = Union[TaskStarted, TaskCompleted, TaskFailed, TaskCancelled, TaskExpired]  # noqa: UP007
+
+# What a transport hands in to hear of each delegation starting and ending.
+TaskObserver = Callable[[TaskEvent], Awaitable[None]]
+ToolCallObserver = Callable[[ToolCallEvent], Awaitable[None]]
+ToolResultObserver = Callable[[ToolResultEvent], Awaitable[None]]
+
 # Shared immutable default so the keyword arg never aliases a mutable {}.
 _NO_SERVER_ACTIONS: Mapping[str, A2UIAction] = MappingProxyType({})
 
@@ -63,6 +86,9 @@ async def stream_turn(
     server_actions: Mapping[str, A2UIAction] = _NO_SERVER_ACTIONS,
     usage_records: list[UsageEvent] | None = None,
     interrupter: Interrupter | None = None,
+    on_task: TaskObserver | None = None,
+    on_tool_call: ToolCallObserver | None = None,
+    on_tool_result: ToolResultObserver | None = None,
 ) -> AsyncIterator[A2UIFrame]:
     """Execute one turn and yield its prose then A2UI message frames.
 
@@ -90,6 +116,11 @@ async def stream_turn(
         interrupter: Where a question the agent asks goes. Supplied only by a
             transport that can put it to whoever is connected, and only when the
             agent has no hook of its own.
+        on_task: Called with each ``TaskStarted`` / ``TaskCompleted`` /
+            ``TaskFailed`` / ``TaskCancelled`` / ``TaskExpired`` on the turn's
+            stream, for a transport that reports delegations.
+        on_tool_call: Called with each tool call on the turn's stream.
+        on_tool_result: Called with each tool result on the turn's stream.
 
     Yields:
         Any server-action :class:`A2UIMessageFrame`s first, then (when the agent
@@ -148,6 +179,12 @@ async def _collect_a2ui_messages(event: BaseEvent) -> None:
 
     if usage_records is not None:
         stream.where(UsageEvent).subscribe(collect_usage_events(usage_records))
+    if on_task is not None:
+        stream.where((TaskStarted, TaskCompleted, TaskFailed, TaskCancelled, TaskExpired)).subscribe(on_task)
+    if on_tool_call is not None:
+        stream.where(ToolCallEvent).subscribe(on_tool_call)
+    if on_tool_result is not None:
+        stream.where(ToolResultEvent).subscribe(on_tool_result)
 
     # Apply A2UI behaviour to the plain agent for this turn: prepend the A2UI
     # prompt section, fold in negotiated client capabilities so the LLM only
@@ -216,12 +253,16 @@ def run_turn(
         *,
         usage_records: list[UsageEvent] | None = None,
         interrupter: Interrupter | None = None,
+        on_task: TaskObserver | None = None,
+        on_tool_call: ToolCallObserver | None = None,
+        on_tool_result: ToolResultObserver | None = None,
     ) -> AsyncIterator[A2UIFrame]:
         """Run one turn and yield its prose then A2UI message frames.
 
         Pass ``usage_records`` to have the turn's token accounting collected into
-        it, and ``interrupter`` to answer the agent's questions from wherever the
-        transport can reach a human; see :func:`stream_turn`.
+        it, ``interrupter`` to answer the agent's questions from wherever the
+        transport can reach a human, and ``on_task`` to hear of its delegations;
+        see :func:`stream_turn`.
         """
         return stream_turn(
             self.agent,
@@ -230,7 +271,20 @@ def run_turn(
             server_actions=self.server_actions,
             usage_records=usage_records,
             interrupter=interrupter,
+            on_task=on_task,
+            on_tool_call=on_tool_call,
+            on_tool_result=on_tool_result,
         )
 
 
-__all__ = ("A2UIFrame", "A2UIMessageFrame", "A2UIProseFrame", "Interrupter", "stream_turn")
+__all__ = (
+    "A2UIFrame",
+    "A2UIMessageFrame",
+    "A2UIProseFrame",
+    "Interrupter",
+    "TaskEvent",
+    "TaskObserver",
+    "ToolCallObserver",
+    "ToolResultObserver",
+    "stream_turn",
+)
```

**File**: `ag2/a2ui/transports/ag_ui.py` (modified, +116/-61)
```diff
@@ -28,37 +28,49 @@
 from ag_ui.core import (
     ActivitySnapshotEvent,
     RunAgentInput,
-    RunErrorEvent,
-    RunFinishedEvent,
     TextMessageChunkEvent,
+    ToolCallArgsEvent,
+    ToolCallEndEvent,
+    ToolCallStartEvent,
 )
 from ag_ui.encoder import EventEncoder
 from starlette.requests import Request
 from starlette.responses import JSONResponse, Response, StreamingResponse
 from starlette.routing import Route
 
+from ag2.ag_ui.capabilities import served_capabilities
 from ag2.ag_ui.interrupts import (
     DEFAULT_RETENTION,
     ClientInterrupter,
     Retention,
     ServedTurn,
     ServedTurns,
     TurnOutput,
-    interrupt_capabilities,
+    drive_run,
     serve_exchange,
-    success_outcome,
     timestamp_ms,
     utc_now,
 )
-from ag2.ag_ui.stream import AGStreamInput, map_agui_messages_to_events, map_usage_events_to_ag_ui
-from ag2.events import TextInput, UsageEvent
+from ag2.ag_ui.provider import provider_of
+from ag2.ag_ui.run_input import read_run_input
+from ag2.ag_ui.stream import (
+    AGStreamInput,
+    client_context_prompt,
+    map_agui_messages_to_events,
+    map_task_event_to_ag_ui,
+    tool_result_event,
+)
+from ag2.ag_ui.thought_signature import encrypted_signature_of, signature_event
+from ag2.events import TextInput, ToolCallEvent, ToolResultEvent
 
 from .._types import JsonObject, ServerToClientMessage
-from ..dispatch import A2UIMessageFrame, A2UIProseFrame
+from ..dispatch import A2UIMessageFrame, A2UIProseFrame, TaskEvent
 from ..incoming import iter_incoming_prompts, parse_incoming_interactions
 from ..request import A2UIServerRequest
 
 if TYPE_CHECKING:
+    from ag2.agent import Agent
+
     from ..dispatch import _A2UITurnCore
 
 logger = logging.getLogger(__name__)
@@ -80,8 +92,11 @@ class AgUiTransport:
     :class:`~ag2.a2ui.A2UIServer` calls :meth:`aclose` on shutdown.
 
     Args:
-        path: The route path, serving POST runs and GET capabilities.
+        path: The route path, serving POST runs and GET capabilities; GET
+            ``{path}/capabilities`` serves them too.
         retention: How long an unanswered question is held, and how many at once.
+        require_resume_proof: Refuse a resume that carries no proof of the
+            interrupt it answers; one that carries a proof must always match.
         now: The clock deadlines are read off. For tests.
     """
 
@@ -92,32 +107,42 @@ def __init__(
         *,
         path: str = "/",
         retention: Retention = DEFAULT_RETENTION,
+        require_resume_proof: bool = False,
         now: Callable[[], datetime] = utc_now,
     ) -> None:
         self._path = path
-        self._turns = ServedTurns(retention=retention, now=now)
+        self._turns = ServedTurns(retention=retention, require_proof=require_resume_proof, now=now)
 
     def routes(self, core: "_A2UITurnCore") -> list[Route]:
         endpoint = functools.partial(_endpoint, self._turns, core)
-        # GET on the same route answers a client asking what this agent can do,
-        # exactly as the other AG-UI transport does: the two are meant to be
-        # indistinguishable, and a client decides up front whether to offer the
-        # interrupt UI.
-        return [Route(self._path, endpoint, methods=["GET", "POST"])]
+        capabilities = functools.partial(_capabilities, core)
+        # GET on the run route answers a client asking what this agent can do,
+        # exactly as the other AG-UI transport does, and so does the sub-path
+        # other AG-UI integrations serve it on: a client decides up front
+        # whether to offer the interrupt UI.
+        return [
+            Route(self._path, endpoint, methods=["GET", "POST"]),
+            Route(f"{self._path.rstrip('/')}/capabilities", capabilities, methods=["GET"]),
+        ]
 
     async def aclose(self) -> None:
         """Cancel every turn this transport is still running."""
         await self._turns.release_all()
 
 
+async def _capabilities(core: "_A2UITurnCore", request: Request) -> JSONResponse:
+    # The turn core never sees the run's `tools`, and nothing here sends a
+    # state snapshot.
+    capabilities = served_capabilities(core.agent, client_tools=False, state_snapshots=False)
+    return JSONResponse(capabilities.model_dump(by_alias=True, exclude_none=True))
+
+
 async def _endpoint(turns: ServedTurns, core: "_A2UITurnCore", request: Request) -> Response:
     if request.method == "GET":
-        capabilities = interrupt_capabilities(core.agent.name)
-        return JSONResponse(capabilities.model_dump(by_alias=True, exclude_none=True))
+        return await _capabilities(core, request)
 
     try:
-        body = await request.body()
-        incoming = RunAgentInput.model_validate_json(body)
+        incoming = read_run_input(await request.body())
     except Exception:  # noqa: BLE001 - bad/short body or disconnect → 400, not 500
         return Response('{"error": "invalid AG-UI RunAgentInput body"}', status_code=400
```

**File**: `ag2/ag_ui/__init__.py` (modified, +6/-4)
```diff
@@ -12,25 +12,27 @@
 from .interrupts import (
     DEFAULT_RETENTION,
     INPUT_REQUIRED_REASON,
-    NOT_OUTSTANDING,
+    NOT_COVERED,
     NOT_PROVEN,
-    NO_HELD_TURN,
     PAYLOAD_REFUSED,
     TOOL_CALL_REASON,
+    UNSUPPORTED_PROTOCOL_VERSION,
     Retention,
 )
+from .run_input import read_run_input
 from .stream import AGUIStream
 
 __all__ = (
     "DEFAULT_RETENTION",
     "INPUT_REQUIRED_REASON",
-    "NOT_OUTSTANDING",
+    "NOT_COVERED",
     "NOT_PROVEN",
-    "NO_HELD_TURN",
     "PAYLOAD_REFUSED",
     "TOOL_CALL_REASON",
+    "UNSUPPORTED_PROTOCOL_VERSION",
     "AGUIEvent",
     "AGUIStream",
     "Retention",
     "RunAgentInput",
+    "read_run_input",
 )
```

**File**: `ag2/ag_ui/asgi.py` (modified, +14/-6)
```diff
@@ -4,7 +4,9 @@
 
 from typing import TYPE_CHECKING
 
-from ag_ui.core import RunAgentInput
+from ag_ui.encoder import EventEncoder
+
+from .run_input import read_run_input
 
 try:
     from starlette.endpoints import HTTPEndpoint
@@ -29,12 +31,18 @@ async def get(
         async def post(
             endpoint,  # noqa: N805
             request: Request,
-        ) -> StreamingResponse:
+        ) -> StreamingResponse | JSONResponse:
+            try:
+                incoming = read_run_input(await request.body())
+            except ValueError:
+                # Refused before any stream: a run that never started has no
+                # event stream for a RUN_ERROR to travel on.
+                return JSONResponse({"error": "invalid AG-UI RunAgentInput body"}, status_code=400)
+            accept = request.headers.get("accept")
             return StreamingResponse(
-                stream.dispatch(
-                    RunAgentInput.model_validate_json(await request.body()),
-                    accept=request.headers.get("accept"),
-                )
+                stream.dispatch(incoming, accept=accept),
+                # The encoder's own type, never the client's `Accept` copied back.
+                media_type=EventEncoder(accept=accept).get_content_type(),  # type: ignore[arg-type]
             )
 
     return AGUIEndpoint
```

**File**: `ag2/ag_ui/capabilities.py` (added, +65/-0)
```diff
@@ -0,0 +1,65 @@
+# Copyright (c) 2026, AG2ai, Inc., AG2ai open-source projects maintainers and core contributors
+#
+# SPDX-License-Identifier: Apache-2.0
+
+from ag_ui.core import (
+    AgentCapabilities,
+    HumanInTheLoopCapabilities,
+    IdentityCapabilities,
+    MultiAgentCapabilities,
+    MultimodalCapabilities,
+    MultimodalInputCapabilities,
+    ReasoningCapabilities,
+    StateCapabilities,
+    SubagentInfo,
+    ToolsCapabilities,
+    TransportCapabilities,
+)
+
+from ag2 import Agent
+from ag2.tools.final import Toolkit
+from ag2.tools.subagents.subagent_tool import SubagentTool
+from ag2.tools.tool import Tool
+
+from .input_acceptance import input_modalities
+from .provider import GEMINI_FAMILY, provider_of
+
+
+def _subagents(tools: tuple[Tool, ...]) -> list[SubagentInfo]:
+    result = []
+    for tool in tools:
+        if isinstance(tool, SubagentTool):
+            result.append(SubagentInfo(name=tool.agent.name, description=tool.schema.function.description))
+        elif isinstance(tool, Toolkit):
+            result.extend(_subagents(tool.tools))
+    return result
+
+
+def served_capabilities(agent: Agent, *, client_tools: bool, state_snapshots: bool) -> AgentCapabilities:
+    """What a server running `agent` tells a client it can do, before any run starts.
+
+    Read off the agent alone: what a single run is handed — tools, a hook — is
+    not known until it starts. `client_tools` and `state_snapshots` are the
+    transport's: whether it runs the tools a client offers, and whether it
+    sends `STATE_SNAPSHOT`.
+    """
+    # Undeclared rather than declared false where ag2 cannot tell: the protocol
+    # reads an omitted field as saying nothing.
+    subagents = _subagents(tuple(agent.tools))
+    modalities = input_modalities(agent.config)
+    return AgentCapabilities(
+        identity=IdentityCapabilities(name=agent.name, type="ag2"),
+        transport=TransportCapabilities(streaming=True),
+        tools=ToolsCapabilities(supported=True, client_provided=client_tools or None),
+        state=StateCapabilities(snapshots=True) if state_snapshots else None,
+        multi_agent=MultiAgentCapabilities(supported=True, delegation=True, subagents=subagents or None)
+        if agent.tasks is not None or subagents
+        else None,
+        reasoning=ReasoningCapabilities(encrypted=provider_of(agent.config) in GEMINI_FAMILY),
+        multimodal=MultimodalCapabilities(input=MultimodalInputCapabilities(**modalities)) if modalities else None,
+        # A question the agent's own hook answers never reaches the client.
+        human_in_the_loop=HumanInTheLoopCapabilities(supported=True, interrupts=not agent.has_hitl_hook),
+    )
+
+
+__all__ = ("served_capabilities",)
```

**File**: `ag2/ag_ui/input_acceptance.py` (added, +190/-0)
```diff
@@ -0,0 +1,190 @@
+# Copyright (c) 2026, AG2ai, Inc., AG2ai open-source projects maintainers and core contributors
+#
+# SPDX-License-Identifier: Apache-2.0
+
+"""Provider mapper acceptance for inbound AG-UI media, by position and source."""
+
+from ag2.config import (
+    AnthropicConfig,
+    BedrockConfig,
+    DashScopeConfig,
+    GeminiConfig,
+    MistralConfig,
+    ModelConfig,
+    OllamaConfig,
+    OpenAIConfig,
+    OpenAIResponsesConfig,
+    TypeSafeConfig,
+    VertexAIConfig,
+    XAIConfig,
+    ZAIConfig,
+)
+from ag2.events import BinaryInput, BinaryType, FileIdInput, Input, UrlInput
+
+# Each entry names (position, source, kind). Text is accepted everywhere.
+# The table describes mapper behavior, not model-specific ability.
+_MEDIA: dict[type[object], set[tuple[str, str, BinaryType | None]]] = {
+    OpenAIConfig: {
+        ("user", "data", BinaryType.IMAGE),
+        ("user", "url", BinaryType.IMAGE),
+        ("user", "data", BinaryType.AUDIO),
+        ("user", "data", BinaryType.DOCUMENT),
+        ("user", "file", None),
+    },
+    OpenAIResponsesConfig: {
+        *(
+            (position, source, kind)
+            for position in ("user", "tool")
+            for source in ("data", "url")
+            for kind in (BinaryType.IMAGE, BinaryType.DOCUMENT)
+        ),
+        ("user", "file", None),
+        ("tool", "file", None),
+    },
+    AnthropicConfig: {
+        *(
+            (position, source, kind)
+            for position in ("user", "tool")
+            for source in ("data", "url")
+            for kind in (BinaryType.IMAGE, BinaryType.DOCUMENT)
+        ),
+        ("user", "file", None),
+        ("tool", "file", None),
+    },
+    BedrockConfig: {
+        *(
+            (position, "data", kind)
+            for position in ("user", "tool")
+            for kind in (BinaryType.IMAGE, BinaryType.DOCUMENT, BinaryType.VIDEO)
+        ),
+    },
+    DashScopeConfig: {
+        *((position, source, BinaryType.IMAGE) for position in ("user", "tool") for source in ("data", "url")),
+    },
+    GeminiConfig: {
+        *(
+            ("user", source, kind)
+            for source in ("data", "url")
+            for kind in (BinaryType.IMAGE, BinaryType.AUDIO, BinaryType.VIDEO, BinaryType.DOCUMENT)
+        ),
+        *(("tool", source, kind) for source in ("data", "url") for kind in (BinaryType.IMAGE, BinaryType.DOCUMENT)),
+        ("user", "file", None),
+    },
+    VertexAIConfig: {
+        *(
+            ("user", source, kind)
+            for source in ("data", "url")
+            for kind in (BinaryType.IMAGE, BinaryType.AUDIO, BinaryType.VIDEO, BinaryType.DOCUMENT)
+        ),
+        *(("tool", source, kind) for source in ("data", "url") for kind in (BinaryType.IMAGE, BinaryType.DOCUMENT)),
+        ("user", "file", None),
+    },
+    MistralConfig: {
+        *(
+            (position, source, kind)
+            for position in ("user", "tool")
+            for source in ("data", "url")
+            for kind in (BinaryType.IMAGE, BinaryType.DOCUMENT)
+        ),
+        ("user", "file", None),
+        ("tool", "file", None),
+    },
+    OllamaConfig: {("user", "data", BinaryType.IMAGE)},
+    XAIConfig: {
+        *(("user", source, kind) for source in ("data", "url") for kind in (BinaryType.IMAGE, BinaryType.DOCUMENT)),
+        ("user", "file", None),
+    },
+    ZAIConfig: set(),
+    TypeSafeConfig: set(),
+}
+
+
+def _described(config: ModelConfig | None) -> type[object] | None:
+    """The config class the table describes `config` by, or `None` if it does not."""
+    if config is None:
+        return None
+    # Compared by identity, never `isinstance`: a provider whose extra is not
+    # installed is a stand-in here, not a class.
+    return type(config) if type(config) in _MEDIA else None
+
+
+def accepts_input(config: ModelConfig | None, position: str, part: Input) -> bool:
+    """Whether the config's mapper accepts this media in this position.
+
+    A config the table does not describe is taken to accept anything: its mapper
+    cannot be read from here.
+    """
+    described = _described(config)
+    if described is None:
+        return True
+    if isinstance(part, BinaryInput):
+        source = "data"
+        kind = part.kind
+    elif isinstance(part, UrlInput):
+        source = "url"
+        kind = part.kind
+    elif isinstance(part, FileIdInput):
+        source = "file"
+        kind = None
+    else:
+        return True
+    if (position, source, kind) not in _MEDIA[described]:
+        return False
+    if isinstance(part, BinaryInput):
+        if described is BedrockConfig:
+            supported_media = {
+                BinaryType.IMAGE: {"image/png", "image/jpeg", "image/gif", "image/webp"},
+                BinaryType.DOCUMENT: {
+                    "application/pdf",
+                    "text/csv",
+                    "application/msword",
+                    "application/vnd.openxmlformats-off
```

**File**: `ag2/ag_ui/interrupts.py` (modified, +504/-110)
```diff
@@ -11,6 +11,7 @@
 import asyncio
 import functools
 import logging
+import re
 import secrets
 import time
 from collections.abc import AsyncIterator, Callable, Coroutine
@@ -20,28 +21,48 @@
 from typing import Any
 
 from ag_ui.core import (
-    AgentCapabilities,
+    PROTOCOL_VERSION,
     BaseEvent,
-    HumanInTheLoopCapabilities,
-    IdentityCapabilities,
+    EventType,
     Interrupt,
+    Metadata,
+    ReasoningEndEvent,
+    ReasoningMessageEndEvent,
+    ReasoningMessageStartEvent,
+    ReasoningStartEvent,
     ResumeEntry,
     RunAgentInput,
     RunErrorEvent,
+    RunFinishedCancelledOutcome,
     RunFinishedEvent,
     RunFinishedInterruptOutcome,
     RunFinishedSuccessOutcome,
     RunStartedEvent,
+    SubagentErrorEvent,
+    SubagentFinishedEvent,
+    SubagentFinishedSuspendedOutcome,
+    SubagentStartedEvent,
+    TextMessageEndEvent,
+    TextMessageStartEvent,
+    TokenUsage,
+    ToolCallChunkEvent,
+    ToolCallEndEvent,
+    ToolCallResultEvent,
+    ToolCallStartEvent,
 )
 from ag_ui.encoder import EventEncoder
 from anyio import BrokenResourceError, ClosedResourceError, create_memory_object_stream
 from anyio.streams.memory import MemoryObjectSendStream
+from typing_extensions import assert_never
 
 from ag2.annotations import Context
 from ag2.events import BaseEvent as AG2Event
-from ag2.events import HumanInputRequest, HumanMessage, ToolApprovalRequest
+from ag2.events import HumanInputRequest, HumanMessage, ToolApprovalRequest, UsageEvent
 from ag2.exceptions import AG2Error, HumanInputTimeoutError
 
+from .run_input import strip_unrecognised
+from .usage import map_usage_events_to_ag_ui
+
 logger = logging.getLogger(__name__)
 
 # What an `Interrupt` raised by `context.input()` says it is. The
@@ -71,11 +92,17 @@
 
 # Codes on the `RUN_ERROR` a refused resume produces, so a client can branch
 # without parsing prose.
-NO_HELD_TURN = "INTERRUPT_NOT_HELD"
-NOT_OUTSTANDING = "INTERRUPT_NOT_OUTSTANDING"
+NOT_COVERED = "INTERRUPT_NOT_COVERED"
 PAYLOAD_REFUSED = "INTERRUPT_PAYLOAD_REFUSED"
 NOT_PROVEN = "INTERRUPT_NOT_PROVEN"
 
+# The code on the lone `RUN_ERROR` a client declaring another major version of
+# the protocol gets, before any run starts.
+UNSUPPORTED_PROTOCOL_VERSION = "UNSUPPORTED_PROTOCOL_VERSION"
+
+# The two-component grammar a declared protocol version is read in.
+_VERSION = re.compile(r"(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)")
+
 # Where this server's own envelope data sits inside a metadata object. Not
 # `ag_ui.core.AGUI_METADATA_KEY` (`"ag-ui"`): the protocol reserves that one
 # for itself, and every other key is user space.
@@ -131,7 +158,7 @@ class ResumeRefusedError(AG2Error):
     __slots__ = ("code",)
 
     code: str
-    """One of `NO_HELD_TURN`, `NOT_OUTSTANDING`, `NOT_PROVEN`, `PAYLOAD_REFUSED`.
+    """One of `NOT_COVERED`, `NOT_PROVEN`, `PAYLOAD_REFUSED`.
 
     Branch on this rather than on the message.
     """
@@ -153,41 +180,237 @@ class TurnOutput:
     turn keeps working while it waits — a sibling tool call finishing — and
     none of that may be lost. Sending into an exchange that closed otherwise
     (the client went away mid-run) drops the event rather than failing the turn.
+
+    Also the ledger of what the turn has open on the wire — messages, reasoning,
+    tool calls, subagent invocations — read off the events as they are sent, so
+    a run can be closed in order however it ends, and of the tool calls the
+    turn has left unanswered.
+
+    And the meter of what the turn spent: each run reports what was spent since
+    the run before it reported, so a turn carried by several runs is counted once.
     """
 
-    __slots__ = ("thread_id", "run_id", "_send", "_paused", "_kept")
+    __slots__ = (
+        "thread_id",
+        "run_id",
+        "usage",
+        "_metered",
+        "_send",
+        "_paused",
+        "_kept",
+        "_open",
+        "_announced",
+        "_reannounce",
+        "_repeats",
+        "_calls",
+    )
 
     def __init__(self, *, thread_id: str, run_id: str, send: MemoryObjectSendStream[BaseEvent]) -> None:
         self.thread_id = thread_id
         self.run_id = run_id
+        self.usage: list[UsageEvent] = []
+        """Everything the turn has spent, as it is spent. The transport running it appends here."""
+        self._metered = 0
+        """How much of `usage` a run has already reported."""
         self._send = send
         self._paused = False
         self._kept: list[BaseEvent] = []
+        self._open: dict[tuple[EventType, str], BaseEvent] = {}
+        """Every entity opened and not yet closed, by (kind, id), in opening order."""
+        self._announced: set[str] = set()
+        """Every subagent invocation id this turn has announced."""
+        self._reannounce: list[SubagentStartedEvent] = []
+        """Invocations closed as suspended, announced again first thing on resume."""
+        self._repeats: dict[str, int] = {}
+        """Starts refused for an invocati
```

**File**: `ag2/ag_ui/provider.py` (added, +32/-0)
```diff
@@ -0,0 +1,32 @@
+# Copyright (c) 2026, AG2ai, Inc., AG2ai open-source projects maintainers and core contributors
+#
+# SPDX-License-Identifier: Apache-2.0
+
+"""The provider a config serves from, in ag2's vocabulary and in AG-UI's."""
+
+from ag2.config import ModelConfig, ModelProvider
+
+# AG-UI names a file handle's provider by vendor (`openai`, `anthropic`,
+# `google`); ag2 names the API, and Gemini and Vertex AI are two of Google's.
+_VENDOR = {ModelProvider.GEMINI: "google", ModelProvider.VERTEXAI: "google"}
+
+# Providers whose calls carry a Gemini thought signature: Vertex AI runs on the same client.
+GEMINI_FAMILY = frozenset({ModelProvider.GEMINI, ModelProvider.VERTEXAI})
+
+
+def provider_of(config: ModelConfig | None) -> ModelProvider | None:
+    """The provider `config` serves from, in ag2's vocabulary, or `None` if it does not say."""
+    if config is None:
+        return None
+    try:
+        return config.provider
+    except NotImplementedError:
+        return None
+
+
+def is_same_provider(tag: str, provider: ModelProvider | None) -> bool:
+    """Whether a file handle tagged `tag` was issued by the run's `provider`, in either vocabulary."""
+    return provider is not None and (tag == provider or tag == _VENDOR.get(provider))
+
+
+__all__ = ("GEMINI_FAMILY", "is_same_provider", "provider_of")
```

---

### Incident Patch 13: `7f97d29a` (2026-10-01)
**Commit Message**: fix(skills): check local skill ownership before validating arguments (#3328)

* fix(skills): check local skill ownership before validating arguments

* docs(runtime): clarify lookup before argument validation

---------

Co-authored-by: carey-bk <[REDACTED_EMAIL]>
Co-authored-by: Semen Frolov <[REDACTED_EMAIL]>

**File**: `ag2/tools/skills/runtime/local/runtime.py` (modified, +1/-1)
```diff
@@ -149,12 +149,12 @@ async def execute(
 
         *context* is part of the runtime protocol; a subprocess script ignores it.
         """
+        skill = self._loader.get_skill(name)
         if isinstance(args, dict):
             raise TypeError(
                 f"file-based script {script!r} requires positional string arguments (an array); "
                 "named arguments (an object) are only supported for in-process scripts"
             )
-        skill = self._loader.get_skill(name)
         scripts_dir = self._loader.get_path(name) / "scripts"
         resolved_script = _resolve_within(scripts_dir / script, scripts_dir)
         if script not in {s.name for s in skill.scripts} or resolved_script is None:
```

**File**: `ag2/tools/skills/runtime/protocol.py` (modified, +3/-1)
```diff
@@ -97,7 +97,9 @@ async def execute(
         *args* is a CLI-style positional ``Sequence[str]`` for file-backed scripts
         (``LocalRuntime``) or a named-argument ``dict`` for in-process scripts
         (``MemoryRuntime``). A runtime rejects the form it does not support with a
-        ``TypeError``. *context* is the live conversation context, used for
+        ``TypeError`` — but only after checking it owns *name*, so a foreign skill
+        always raises ``SkillNotFoundError`` and routing can fall through.
+        *context* is the live conversation context, used for
         dependency injection by runtimes that invoke a callable; a filesystem
         runtime ignores it.
 
```

**File**: `test/tools/skills/test_toolkit.py` (modified, +61/-2)
```diff
@@ -13,13 +13,14 @@
 import pytest
 from dirty_equals import IsPartialDict
 
-from ag2 import Context
+from ag2 import Context, TextInput
 from ag2.events import ToolCallEvent, ToolErrorEvent
+from ag2.exceptions import SkillNotFoundError
 from ag2.tools import SkillsToolkit
 from ag2.tools.sandbox import ExecResult, Sandbox
 from ag2.tools.sandbox.adapter import ShellAdapter
 from ag2.tools.sandbox.local import LocalSandbox
-from ag2.tools.skills import LocalRuntime
+from ag2.tools.skills import LocalRuntime, MemoryRuntime, MemorySkill
 from ag2.tools.skills.runtime.local.loader import SkillLoader
 
 
@@ -73,6 +74,63 @@ async def test_run_script_falls_through_on_skill_not_found(tmp_path: Path, conte
     assert "HELLO" in result.result.parts[0].content
 
 
+@pytest.mark.asyncio
+async def test_run_script_routes_named_args_to_memory_runtime(tmp_path: Path, context: Context) -> None:
+    skill = MemorySkill(name="calc", description="Double a number")
+
+    @skill.script
+    def double(value: int) -> str:
+        return str(2 * value)
+
+    run_tool = SkillsToolkit(MemoryRuntime(skill), LocalRuntime(dir=tmp_path)).run_skill_script()
+    args = json.dumps({"name": "calc", "script": "double", "args": {"value": 2}})
+
+    result = await run_tool(ToolCallEvent(name="run_skill_script", arguments=args), context)
+
+    assert not isinstance(result, ToolErrorEvent)
+    assert result.result.parts == [TextInput(content="4")]
+
+
+@pytest.mark.asyncio
+@pytest.mark.parametrize("script_args", [None, [], {}, {"value": 2}])
+async def test_run_script_unknown_skill(tmp_path: Path, context: Context, script_args: object) -> None:
+    # Empty catalogs leave the name unconstrained, so the call reaches routing.
+    run_tool = SkillsToolkit(MemoryRuntime(), LocalRuntime(dir=tmp_path)).run_skill_script()
+    args = json.dumps({"name": "missing", "script": "double", "args": script_args})
+
+    result = await run_tool(ToolCallEvent(name="run_skill_script", arguments=args), context)
+
+    assert isinstance(result, ToolErrorEvent)
+    assert isinstance(result.error, SkillNotFoundError)
+    assert "Skill 'missing' not found in any runtime" in str(result.error)
+
+
+@pytest.mark.asyncio
+@pytest.mark.parametrize("script_body", ["echo LOCAL\n", None])
+@pytest.mark.parametrize("script_args", [{}, {"value": 2}])
+async def test_local_script_rejects_named_args_without_falling_through(
+    tmp_path: Path, context: Context, script_body: str | None, script_args: dict[str, int]
+) -> None:
+    local = _write_script_skill(tmp_path, "dup", script_body)
+    skill = MemorySkill(name="dup", description="Fallback must not run")
+    calls: list[int] = []
+
+    @skill.script(name="go.sh")
+    def fallback(value: int = 0) -> str:
+        calls.append(value)
+        return "MEMORY"
+
+    run_tool = SkillsToolkit(MemoryRuntime(skill), LocalRuntime(dir=local)).run_skill_script()
+    args = json.dumps({"name": "dup", "script": "go.sh", "args": script_args})
+
+    result = await run_tool(ToolCallEvent(name="run_skill_script", arguments=args), context)
+
+    assert isinstance(result, ToolErrorEvent)
+    assert isinstance(result.error, TypeError)
+    assert "requires positional string arguments" in str(result.error)
+    assert calls == []
+
+
 @pytest.mark.asyncio
 async def test_missing_script_in_owning_runtime_does_not_fall_through(tmp_path: Path, context: Context) -> None:
     # The last runtime OWNS the skill but lacks the script: that is a genuine
@@ -86,6 +144,7 @@ async def test_missing_script_in_owning_runtime_does_not_fall_through(tmp_path:
     result = await run_tool(ToolCallEvent(name="run_skill_script", arguments=args), context)
 
     assert isinstance(result, ToolErrorEvent)
+    assert isinstance(result.error, FileNotFoundError)
 
 
 @pytest.mark.asyncio
```

---

### Incident Patch 14: `f2d59ef6` (2026-10-01)
**Commit Message**: fix(tenki): upgrade sdk and preserve timeout failures (#3329)

* fix(tenki): upgrade sdk and preserve timeout failures

* fix(tenki): include execution budget in timeout errors

Report the configured timeout value when Tenki raises a timeout
exception, and cover the behavior with a sandbox test.

Update the code execution docs to install the Tenki 1.4 SDK range.

---------

Co-authored-by: Semen Frolov <[REDACTED_EMAIL]>

**File**: `ag2/extensions/tenki/__init__.py` (modified, +2/-2)
```diff
@@ -13,10 +13,10 @@
     from .environment import TenkiEnvironment, TenkiResources
 except ImportError as e:
     TenkiEnvironment = missing_additional_dependency(  # type: ignore[misc]
-        "TenkiEnvironment", "tenki>=0.5.4,<1", e
+        "TenkiEnvironment", "tenki>=1.4.0,<2", e
     )
     TenkiResources = missing_additional_dependency(  # type: ignore[misc]
-        "TenkiResources", "tenki>=0.5.4,<1", e
+        "TenkiResources", "tenki>=1.4.0,<2", e
     )
 
 __all__ = (
```

**File**: `ag2/extensions/tenki/sandbox.py` (modified, +7/-10)
```diff
@@ -33,17 +33,14 @@
 def _posix_exit_code(result: CommandResult) -> int:
     """Map a Tenki result onto the POSIX codes ``ExecResult`` promises.
 
-    Tenki reports ``exit_code == -1`` whenever the command produced no real
-    wait status — it timed out, was signalled, or could never be exec'd. A
-    negative code is not a POSIX status and means nothing to a model reading
-    tool output, so translate it the way a shell would.
+    Timeouts take precedence over the exit code. Negative codes indicate no
+    real wait status and are translated to shell-style failure codes.
     """
+    # A command can exhaust its budget even when it exits successfully.
+    if result.timed_out or result.reason == "timeout":
+        return 124
     if result.exit_code >= 0:
         return result.exit_code
-    # A timeout is also reported with signal="terminated", so it has to be read
-    # before the signal case, or every timeout would surface as a plain kill.
-    if result.reason == "timeout":
-        return 124
     if result.signal:
         # 128 is the base a shell adds a signal number to. Tenki reports the
         # signal by name ("killed", "terminated"), so the number isn't available
@@ -149,12 +146,12 @@ async def exec(
                 timeout=exec_timeout,
             )
         except (CommandTimeoutError, TimeoutError) as e:
-            return ExecResult(output=f"Tenki execution timed out: {e}", exit_code=124)
+            return ExecResult(output=f"Tenki execution timed out after {exec_timeout}s: {e}", exit_code=124)
         except SandboxError as e:
             return ExecResult(output=f"Tenki error: {e}", exit_code=1)
 
         output = (result.stdout_text + result.stderr_text).strip()
-        if result.reason == "timeout":
+        if result.timed_out or result.reason == "timeout":
             note = f"Tenki execution timed out after {exec_timeout}s"
             output = f"{output}\n{note}" if output else note
         else:
```

**File**: `pyproject.toml` (modified, +2/-2)
```diff
@@ -177,7 +177,7 @@ optionals = [
     "websockets>=14.0,<17",  # WsLink (ag2.network)
     "docker>=6.0.0,<8",  # code execution (ag2.extensions.docker)
     "daytona>=0.171.0,<1",
-    "tenki>=0.5.4,<2",
+    "tenki>=1.4.0,<2",
     "tinyfish>=0.5,<0.6; python_version>='3.11'",
     "exa-py>=2.12.1,<3",
     # providers
@@ -202,7 +202,7 @@ docs = [
     # Extensions are not shipped as extras; install their packages directly so docs can import the modules
     "tinyfish>=0.5,<0.6; python_version>='3.11'",
     "daytona>=0.171.0,<1",
-    "tenki>=0.5.4,<2",
+    "tenki>=1.4.0,<2",
     "exa-py>=2.12.1,<3",
     "docker>=6.0.0,<8",                # Code execution tools are exposed in the public API by the optional `ag2.tools` module
     "nlip-sdk>=0.1.0,<1",              # NLIP is exposed in the public API by the optional `autogen.extensions.nlip` module
```

**File**: `test/extensions/tenki/test_tenki_sandbox.py` (modified, +47/-1)
```diff
@@ -11,7 +11,7 @@
 from unittest.mock import AsyncMock
 
 import pytest
-from tenki import CommandResult
+from tenki import CommandResult, CommandTimeoutError
 
 from ag2.annotations import Variable
 from ag2.extensions.tenki.sandbox import TenkiSandbox
@@ -189,6 +189,52 @@ async def test_timeout_result_is_reported_with_the_budget(self) -> None:
             exit_code=124,
         )
 
+    @pytest.mark.parametrize("exit_code", [0, 3, -1])
+    async def test_timeout_flag_overrides_exit_code_and_preserves_output(self, exit_code: int) -> None:
+        result = CommandResult(
+            argv=["sh"],
+            exit_code=exit_code,
+            stdout=b"partial output\n",
+            stderr=b"partial error\n",
+            reason="exit",
+            timed_out=True,
+        )
+        sandbox = TenkiSandbox(
+            client=_fake_client(_fake_remote(result=result)),
+            create_options={"workspace_id": "workspace-1"},
+        )
+
+        assert await sandbox.exec(["sh"], timeout=2) == ExecResult(
+            output="partial output\npartial error\nTenki execution timed out after 2s",
+            exit_code=124,
+        )
+
+    async def test_timeout_flag_reports_silent_timeout_with_default_budget(self) -> None:
+        result = CommandResult(argv=["sleep", "10"], exit_code=0, timed_out=True)
+        sandbox = TenkiSandbox(
+            client=_fake_client(_fake_remote(result=result)),
+            create_options={"workspace_id": "workspace-1"},
+            timeout=2,
+        )
+
+        assert await sandbox.exec(["sleep", "10"]) == ExecResult(
+            output="Tenki execution timed out after 2s",
+            exit_code=124,
+        )
+
+    async def test_timeout_error_reports_the_budget(self) -> None:
+        remote = _fake_remote()
+        remote.exec = AsyncMock(side_effect=CommandTimeoutError("deadline exceeded"))
+        sandbox = TenkiSandbox(
+            client=_fake_client(remote),
+            create_options={"workspace_id": "workspace-1"},
+        )
+
+        assert await sandbox.exec(["sleep", "10"], timeout=2) == ExecResult(
+            output="Tenki execution timed out after 2s: deadline exceeded",
+            exit_code=124,
+        )
+
     async def test_silent_success_stays_silent(self) -> None:
         # Tenki reports reason="exit" on a clean finish too, so a command that
         # simply prints nothing must not be dressed up as an abnormal ending.
```

**File**: `uv.lock` (modified, +6/-6)
```diff
@@ -350,7 +350,7 @@ dev = [
     { name = "pyyaml", specifier = "==6.0.3" },
     { name = "respx", specifier = ">=0.23.0,<0.24.0" },
     { name = "ruff", specifier = "==0.16.8" },
-    { name = "tenki", specifier = ">=0.5.4,<2" },
+    { name = "tenki", specifier = ">=1.4.0,<2" },
     { name = "tinyfish", marker = "python_full_version >= '3.11'", specifier = ">=0.5,<0.6" },
     { name = "typer", specifier = ">=0.22,<0.28" },
     { name = "types-aiobotocore", extras = ["bedrock-runtime"] },
@@ -389,7 +389,7 @@ docs = [
     { name = "nlip-sdk", specifier = ">=0.1.0,<1" },
     { name = "nlip-server", specifier = ">=0.1.3,<1" },
     { name = "pyyaml", specifier = "==6.0.3" },
-    { name = "tenki", specifier = ">=0.5.4,<2" },
+    { name = "tenki", specifier = ">=1.4.0,<2" },
     { name = "tinyfish", marker = "python_full_version >= '3.11'", specifier = ">=0.5,<0.6" },
     { name = "typer", specifier = ">=0.22,<0.28" },
     { name = "watchdog", specifier = ">=4.0,<7" },
@@ -427,7 +427,7 @@ optionals = [
     { name = "daytona", specifier = ">=0.171.0,<1" },
     { name = "docker", specifier = ">=6.0.0,<8" },
     { name = "exa-py", specifier = ">=2.12.1,<3" },
-    { name = "tenki", specifier = ">=0.5.4,<2" },
+    { name = "tenki", specifier = ">=1.4.0,<2" },
     { name = "tinyfish", marker = "python_full_version >= '3.11'", specifier = ">=0.5,<0.6" },
     { name = "watchdog", specifier = ">=4.0,<7" },
     { name = "websockets", specifier = ">=14.0,<17" },
@@ -5447,16 +5447,16 @@ wheels = [
 
 [[package]]
 name = "tenki"
-version = "1.2.0"
+version = "1.4.0"
 source = { registry = "https://pypi.org/simple" }
 dependencies = [
     { name = "grpcio" },
     { name = "protobuf" },
     { name = "websocket-client" },
 ]
-sdist = { url = "https://files.pythonhosted.org/packages/99/7e/25975bf8b95d12e8c776debd52b266a5bb5b375971eee1024a0adeb67317/tenki-1.2.0.tar.gz", hash = "sha256:efd8cf8ab1bf0d888f0ab7a0af937bcb7601e6a7f021d1586a5daf6f04809dec", size = 275679, upload-time = "2026-09-17T15:10:54.388Z" }
+sdist = { url = "https://files.pythonhosted.org/packages/62/64/232ea63ec1473c8ee8050881cb547e4176ea63fe1c1591a3bf19e111e379/tenki-1.4.0.tar.gz", hash = "sha256:eec11071341c2da5c439ad4316896c04bf29abe92e8ab4fd229011dd5499930e", size = 288846, upload-time = "2026-09-30T04:51:36.806Z" }
 wheels = [
-    { url = "https://files.pythonhosted.org/packages/38/e4/3b8f5241309d7c0b760ab51e5818fcdee12e08ae378631b8a8e200c729d8/tenki-1.2.0-py3-none-any.whl", hash = "sha256:8ced740e37dc6ea223f2479a3385eed828aa12114df737d24617259c8f518d35", size = 186695, upload-time = "2026-09-17T15:10:52.733Z" },
+    { url = "https://files.pythonhosted.org/packages/28/5b/c435195220f11ee46cb0a585f4abc4770f69a32626211523acb9b1a43798/tenki-1.4.0-py3-none-any.whl", hash = "sha256:8a2c4da58d807313d6f4da7d0bc0aa7c3db4001bbd751f84aac0130437624b2f", size = 198601, upload-time = "2026-09-30T04:51:35.24Z" },
 ]
 
 [[package]]
```

**File**: `website/docs/user-guide/extensions/tenki.mdx` (modified, +1/-1)
```diff
@@ -10,7 +10,7 @@ The `ag2.extensions.tenki` module runs AG2 shell and code tools in isolated [Ten
 Install AG2, your model provider, and Tenki's Python SDK:
 
 ```bash
-pip install "ag2[anthropic]" "tenki>=0.5.4,<1"
+pip install "ag2[anthropic]" "tenki>=1.4.0,<2"
 ```
 
 Create an API key in Tenki and export it:
```

**File**: `website/docs/user-guide/tools/code_execution.mdx` (modified, +1/-1)
```diff
@@ -54,7 +54,7 @@ Three environments are available: **Tenki** and **Daytona** (hosted), plus **Doc
 [Tenki](https://tenki.cloud/){.external-link target="_blank"} provides managed, isolated cloud sandboxes with a bounded server-side lifetime.
 
 ```bash
-pip install "ag2[anthropic]" "tenki>=0.5.4,<1"
+pip install "ag2[anthropic]" "tenki>=1.4.0,<2"
 ```
 
 ```python linenums="1"
```

---

### Incident Patch 15: `81d0fabd` (2026-09-30)
**Commit Message**: fix(mcp): derive model output schemas from serialization (#3317)

* fix(mcp): derive model output schemas from serialization

Match Pydantic output schemas to the existing serialized payload without changing LLM validation or alias defaults. Cover both MCP protocol eras and retain explicit output contracts.

* test(mcp): pin required nullable output fields

* fix(mcp): align dataclass output with serialization schema

Generate MCP output schemas for plain dataclasses from Pydantic
serialization mode and dump structured content through TypeAdapter
instead of asdict.

Add coverage for aliased dataclass fields returned from agent responses
and typed tools.

---------

Co-authored-by: Semen Frolov <[REDACTED_EMAIL]>
Co-authored-by: Semen Frolov <[REDACTED_EMAIL]>

**File**: `ag2/mcp/executor.py` (modified, +13/-13)
```diff
@@ -43,7 +43,7 @@
 
 from .elicitation import ClientElicitor
 from .errors import MCPAgentConfigError, MCPSamplingUnavailableError, UnknownConversationError
-from .info import build_ask_tool, object_output_schema
+from .info import build_ask_tool
 from .mappers import reply_to_content, to_structured_dict, tool_error
 from .pause import PauseState, PausedRuns, SuspendedTurn
 from .sampling import CLIENT_MODEL_MAX_TOKENS, ClientModelConfig, client_can_sample
@@ -89,7 +89,7 @@ class AgentExecutor:
     __slots__ = (
         "_agent",
         "_tool_name",
-        "_tool_description",
+        "_tool",
         "_stream_progress",
         "_context_provider",
         "_session_store",
@@ -113,7 +113,6 @@ def __init__(
     ) -> None:
         self._agent = agent
         self._tool_name = tool_name
-        self._tool_description = tool_description
         self._stream_progress = stream_progress
         self._context_provider = context_provider
         self._session_store = session_store
@@ -125,22 +124,23 @@ def __init__(
         # built directly, with no ``requestState`` protection installed) leaves
         # the era without the pause transport: nowhere safe to put the state.
         self._paused = paused_runs
+        # The declaration and the result use the same output contract. Derive it
+        # once, not on every listing or agent reply.
+        self._tool = build_ask_tool(
+            agent,
+            tool_name=tool_name,
+            tool_description=tool_description,
+            response_schema=agent.response_schema,
+            conversation_bounds=session_store.bounds if session_store is not None else None,
+        )
 
     @property
     def context_provider(self) -> "ContextProvider | None":
         """The optional per-request context provider shared by MCP handlers."""
         return self._context_provider
 
     def list_tools(self) -> list[MCPTool]:
-        return [
-            build_ask_tool(
-                self._agent,
-                tool_name=self._tool_name,
-                tool_description=self._tool_description,
-                response_schema=self._agent._response_schema,
-                conversation_bounds=self._session_store.bounds if self._session_store is not None else None,
-            )
-        ]
+        return [self._tool]
 
     async def call(
         self,
@@ -443,7 +443,7 @@ def _client_model_config(
         )
 
     def _has_object_output(self) -> bool:
-        return object_output_schema(self._agent._response_schema) is not None
+        return self._tool.output_schema is not None
 
 
 def _progress_scope(
```

**File**: `ag2/mcp/info.py` (modified, +50/-1)
```diff
@@ -2,11 +2,17 @@
 #
 # SPDX-License-Identifier: Apache-2.0
 
-from typing import TYPE_CHECKING, Any
+from dataclasses import is_dataclass
+from types import GenericAlias
+from typing import TYPE_CHECKING, Any, cast
 
 from mcp.types import Tool as MCPTool
+from pydantic import BaseModel, TypeAdapter
+from pydantic.json_schema import GenerateJsonSchema, JsonSchemaValue
+from pydantic_core import core_schema
 
 from ag2.agent import Agent
+from ag2.response import ResponseSchema
 
 from .sessions import ConversationBounds
 
@@ -83,6 +89,49 @@ def object_output_schema(response_schema: "ResponseProto[Any] | None") -> dict[s
     are not advertised — those replies flow back as plain text content.
     """
     json_schema = response_schema.json_schema if response_schema is not None else None
+    if isinstance(json_schema, dict) and isinstance(response_schema, ResponseSchema):
+        model = response_schema.types
+        if (
+            isinstance(model, type)
+            and not isinstance(model, GenericAlias)
+            and (issubclass(model, BaseModel) or is_dataclass(model))
+        ):
+            # The LLM schema describes validation input; MCP describes the value
+            # after to_structured_dict dumps it in JSON mode.
+            output_schema = TypeAdapter(model).json_schema(mode="serialization", schema_generator=_OutputSchema)
+            # ResponseSchema lifts these into its name/description unless the
+            # caller supplied them explicitly. Keep that presentation unchanged.
+            for key in ("title", "description"):
+                if key not in json_schema:
+                    output_schema.pop(key, None)
+            json_schema = output_schema
     if isinstance(json_schema, dict) and json_schema.get("type") == "object":
         return json_schema
     return None
+
+
+class _OutputSchema(GenerateJsonSchema):
+    """Match model_dump's default, per-type serialize_by_alias policy.
+
+    Passing by_alias=False or True to the generator would override every nested
+    type's policy. Core configs also capture the policy inherited by dataclasses.
+    TypedDicts use the enclosing serializer's policy instead.
+    """
+
+    def generate_inner(
+        self,
+        schema: core_schema.CoreSchema
+        | core_schema.ModelField
+        | core_schema.DataclassField
+        | core_schema.TypedDictField
+        | core_schema.ComputedField,
+    ) -> JsonSchemaValue:
+        if schema["type"] not in ("model", "dataclass"):
+            return super().generate_inner(schema)
+        previous = self.by_alias
+        config = cast(core_schema.CoreConfig, schema.get("config", {}))
+        self.by_alias = config.get("serialize_by_alias", False)
+        try:
+            return super().generate_inner(schema)
+        finally:
+            self.by_alias = previous
```

**File**: `ag2/mcp/mappers.py` (modified, +6/-3)
```diff
@@ -3,7 +3,7 @@
 # SPDX-License-Identifier: Apache-2.0
 
 import base64
-from dataclasses import asdict, is_dataclass
+from dataclasses import is_dataclass
 from typing import TYPE_CHECKING, Any
 
 import jsonschema
@@ -16,7 +16,7 @@
     ImageContent,
     TextContent,
 )
-from pydantic import BaseModel
+from pydantic import BaseModel, TypeAdapter
 
 from ag2.events import BinaryResult
 
@@ -106,7 +106,10 @@ def to_structured_dict(value: Any) -> dict[str, Any] | None:
     if isinstance(value, BaseModel):
         return value.model_dump(mode="json")
     if is_dataclass(value) and not isinstance(value, type):
-        return asdict(value)
+        # Pydantic's dump, not ``asdict``: it honours ``serialize_by_alias`` and
+        # JSON-encodes nested values, which is what the advertised schema describes.
+        dumped: dict[str, Any] = TypeAdapter(type(value)).dump_python(value, mode="json")
+        return dumped
     if isinstance(value, dict):
         return value
     return None
```

**File**: `docs/adr/0015-mcp-conversation-continuity-by-handle.md` (modified, +4/-0)
```diff
@@ -5,6 +5,10 @@ date: 2026-08-27
 
 # 15. MCP conversation continuity is named by a server-minted handle
 
+Clause 3's verbatim output-schema wording is superseded for Pydantic models by
+[ADR 0021](0021-mcp-output-schemas-describe-serialization.md). The handle's
+placement and all other continuity decisions remain unchanged.
+
 ## Context
 
 `ag2.mcp.MCPServer` exposes an agent as an MCP server whose conversational tool
```

**File**: `docs/adr/0021-mcp-output-schemas-describe-serialization.md` (added, +41/-0)
```diff
@@ -0,0 +1,41 @@
+---
+status: accepted
+date: 2026-09-29
+---
+
+# 0021. MCP model output schemas describe serialization, not LLM validation
+
+## Context
+
+`ResponseSchema.json_schema` describes what an LLM must produce for validation.
+MCP's `structuredContent`, however, contains the validated model's
+`model_dump(mode="json")`. Aliases, excluded fields and serializers can make
+these representations differ. Advertising the validation schema makes MCP
+clients reject otherwise valid tool results.
+
+## Decision
+
+For a `ResponseSchema` backed by a Pydantic model, MCP derives an object output
+schema in serialization mode. The schema follows each type's effective
+`serialize_by_alias` policy, just as the existing dump does. This applies to
+the served agent's `ask` and automatically derived `@mcp_tool` return schemas.
+The served tool's declaration is built once and reused when shaping replies.
+
+`ResponseSchema.json_schema` and LLM validation do not change. Neither do the
+returned field names. Explicit tool output schemas, custom `ResponseProto`
+implementations and standalone dataclasses retain their existing behavior.
+Manually constructed results are not rewritten: a handler annotated with a
+model still promises that model's output shape. A different manual shape needs
+an explicit output schema or a `CallToolResult` return annotation.
+
+This supersedes only ADR 0015's clause 3 claim that a Pydantic response schema
+is advertised verbatim. Conversation handles still travel in text and `_meta`,
+never in `structuredContent`.
+
+## Consequences
+
+- MCP clients validate the representation they actually receive.
+- Forcing one alias policy across all models is avoided: it would rename fields
+  for callers that already rely on a different default or nested configuration.
+- Serialization schema generation stays in the MCP layer; providers and the
+  `ResponseProto` interface need no new output-schema API.
```

**File**: `test/mcp/test_conversations.py` (modified, +3/-4)
```diff
@@ -475,11 +475,10 @@ async def test_presenting_one_anyway_is_refused_not_dropped(self) -> None:
 
 @pytest.mark.asyncio
 async def test_structured_content_is_exactly_the_output_schema() -> None:
-    """``structuredContent`` is the agent's response schema, and nothing else.
+    """``structuredContent`` is the agent's serialized response, and nothing else.
 
-    It is advertised verbatim as the tool's ``outputSchema``, which MCP requires
-    structured content to conform to, so a server field mixed in would break the
-    tool's own declared contract.
+    It must conform to the tool's ``outputSchema``, so a server field mixed in
+    would break the tool's own declared contract.
     """
     agent = Agent(
         "weather",
```

**File**: `test/mcp/test_output_schema.py` (added, +472/-0)
```diff
@@ -0,0 +1,472 @@
+# Copyright (c) 2026, AG2ai, Inc., AG2ai open-source projects maintainers and core contributors
+#
+# SPDX-License-Identifier: Apache-2.0
+
+import json
+from collections.abc import Callable
+from contextlib import AbstractAsyncContextManager
+from copy import deepcopy
+from dataclasses import dataclass
+from typing import Annotated, Any
+
+import pytest
+from dirty_equals import IsPartialDict
+from mcp import ClientSession
+from mcp.types import CallToolResult, TextContent
+from pydantic import (
+    AliasChoices,
+    AliasGenerator,
+    AliasPath,
+    BaseModel,
+    ConfigDict,
+    Field,
+    GetJsonSchemaHandler,
+    Json,
+    RootModel,
+    computed_field,
+    field_serializer,
+    model_serializer,
+    with_config,
+)
+from pydantic.alias_generators import to_camel, to_pascal
+from pydantic.json_schema import JsonSchemaValue
+from pydantic_core import core_schema
+from typing_extensions import TypedDict
+
+from ag2 import Agent
+from ag2.events import ModelRequest
+from ag2.mcp import MCPServer, build_ask_tool, mcp_tool
+from ag2.mcp.testing import connect, connect_modern
+from ag2.response import PromptedSchema, ResponseSchema, response_schema
+from ag2.testing import TestConfig, TrackingConfig
+
+from ._helpers import tool_named
+
+
+class AliasedItem(BaseModel):
+    item_id: str = Field(alias="itemId")
+
+
+class ValidationAliasItem(BaseModel):
+    item_id: str = Field(validation_alias="inputId")
+
+
+class SerializationAliasItem(BaseModel):
+    item_id: str = Field(serialization_alias="outputId")
+
+
+class SplitAliasesItem(BaseModel):
+    item_id: str = Field(validation_alias="inputId", serialization_alias="outputId")
+
+
+class ChoiceAliasItem(BaseModel):
+    item_id: str = Field(validation_alias=AliasChoices("itemId", "item_id"))
+
+
+class PathAliasItem(BaseModel):
+    item_id: str = Field(validation_alias=AliasPath("payload", "itemId"))
+
+
+class ConfiguredItem(SplitAliasesItem):
+    model_config = ConfigDict(serialize_by_alias=True)
+
+
+class GeneratedAliasesItem(BaseModel):
+    model_config = ConfigDict(
+        alias_generator=AliasGenerator(validation_alias=to_camel, serialization_alias=to_pascal),
+        serialize_by_alias=True,
+    )
+    item_id: str
+
+
+class NestedItems(BaseModel):
+    items: list[AliasedItem]
+
+
+class ItemMap(RootModel[dict[str, AliasedItem]]):
+    pass
+
+
+class RecursiveItem(AliasedItem):
+    children: list["RecursiveItem"] = Field(default_factory=list)
+
+
+class ItemTree(BaseModel):
+    root: RecursiveItem
+
+
+class DefaultParent(BaseModel):
+    child: ConfiguredItem
+    label: str = Field(serialization_alias="wireLabel")
+
+
+class AliasedParent(BaseModel):
+    model_config = ConfigDict(serialize_by_alias=True)
+    child: AliasedItem = Field(alias="entry")
+    configured: ConfiguredItem
+
+
+@dataclass
+class DataclassItem:
+    item_id: str = Field(alias="itemId")
+
+
+class TypedDictItem(TypedDict):
+    item_id: Annotated[str, Field(alias="itemId")]
+
+
+@with_config(ConfigDict(serialize_by_alias=False))
+@dataclass
+class ConfiguredDataclassItem(DataclassItem):
+    pass
+
+
+@with_config(ConfigDict(serialize_by_alias=False))
+class ConfiguredTypedDictItem(TypedDictItem):
+    pass
+
+
+class NestedContainers(BaseModel):
+    model_config = ConfigDict(serialize_by_alias=True)
+    dataclass_item: DataclassItem
+    typed_dict_item: TypedDictItem
+    configured_dataclass: ConfiguredDataclassItem
+    configured_typed_dict: ConfiguredTypedDictItem
+
+
+class JsonPayload(BaseModel):
+    payload: Json[dict[str, int]]
+
+
+class SerializedFields(BaseModel):
+    value: int
+    hidden: str = Field(exclude=True)
+
+    @field_serializer("value")
+    def stringify(self, value: int) -> str:
+        return str(value)
+
+    @computed_field(alias="doubleValue")
+    @property
+    def doubled(self) -> int:
+        return self.value * 2
+
+
+class SerializedModel(BaseModel):
+    name: str
+
+    @model_serializer
+    def summarize(self) -> dict[str, str]:
+        return {"summary": self.name}
+
+
+@pytest.mark.asyncio
+@pytest.mark.parametrize("connector", [connect, connect_modern], ids=["handshake", "modern"])
+@pytest.mark.parametrize("tool_name", ["ask", "report"])
+class TestModelOutputSchema:
+    @pytest.mark.parametrize(
+        ("model", "input_data", "expected"),
+        [
+            pytest.param(AliasedItem, {"itemId": "a"}, {"item_id": "a"}, id="alias"),
+            pytest.param(ValidationAliasItem, {"inputId": "a"}, {"item_id": "a"}, id="validation-alias"),
+            pytest.param(SerializationAliasItem, {"item_id": "a"}, {"item_id": "a"}, id="serialization-alias"),
+            pytest.param(SplitAliasesItem, {"inputId": "a"}, {"item_id": "a"}, id="split-aliases"),
+            pytest.param(ChoiceAliasItem, {"itemId": "a"}, {"item_id": "a"}, id="alias-choices"),
+            pytest.param(PathAliasItem, {"payload": {"itemId": "a"}}, {"item_id": "a"}, id="alias-path"),
+            pyt
```

**File**: `website/docs/user-guide/tools/mcp_apps.mdx` (modified, +3/-1)
```diff
@@ -79,6 +79,8 @@ Which is why `__str__` is worth writing: a text-only client gets *"Espresso cup
 
 Both pydantic models and dataclasses work. This applies to any custom tool, not only a UI-bound one — see [Structured output](/docs/user-guide/tools/serving_mcp#structured-output).
 
+For Pydantic models, `outputSchema` describes `model_dump(mode="json")`, including serialized field types and each nested model's `serialize_by_alias` policy. Input-only aliases do not become output keys. An explicit `output_schema=` still takes precedence, and a manually returned `CallToolResult` keeps the content you supplied.
+
 ### Three levels of control
 
 A handler returns whichever of these fits, in increasing order of control:
@@ -106,7 +108,7 @@ async def explicit() -> CallToolResult:
 ```
 
 !!! note "The schema follows the annotation, not the value"
-    `outputSchema` is decided once, when the tool is declared. Annotating `-> CallToolResult` is what opts a tool out of an advertised schema; returning one from a handler annotated `-> Item` still advertises `Item`'s schema, and MCP requires your `structuredContent` to conform to it.
+    `outputSchema` is decided once, when the tool is declared. Annotating `-> CallToolResult` is what opts a tool out of an advertised schema; returning one from a handler annotated `-> Item` still advertises `Item`'s schema, and MCP requires your `structuredContent` to conform to it. For a Pydantic model this is its serialization schema. If you assemble a different shape by hand, supply an explicit `output_schema=` or annotate the handler `-> CallToolResult`.
 
 ## Inside the document: `ag2ui`
 
```

#### Recent Merged Pull Requests:
- **PR #3360** (2026-10-05): chore(deps): bump the uv group with 16 updates (@dependabot[bot])
- **PR #3359** (2026-10-05): chore(deps): bump github/codeql-action/upload-sarif from 4.38.1 to 4.38.2 in the github-actions group (@dependabot[bot])
- **PR #3358** (2026-10-04): refactor(typing): bring the Z.AI, Gemini and OpenAI providers into th… (@vvlrff)
- **PR #3357** (2026-10-04): fix(test): ensure sibling call is announced before asking human (@vvlrff)
- **PR #3356** (2026-10-04): refactor(typing): bring mcp_ui, mcp and acp into the type-checked set (@vvlrff)
- **PR #3355** (closed): feat(a2a): let A2AServer run on several replicas (@vvlrff)
- **PR #3354** (2026-10-04): feat(a2a): let A2AServer run on several replicas (@vvlrff)
- **PR #3351** (2026-10-04): refactor(typing): bring a2a and a2ui into the type-checked set (@vvlrff)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
