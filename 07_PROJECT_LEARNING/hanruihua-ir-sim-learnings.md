# Forensic Learning Record (Deep Inspection): hanruihua/ir-sim

> **Canonical Artifact**: `07_PROJECT_LEARNING/hanruihua-ir-sim-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/hanruihua/ir-sim](https://github.com/hanruihua/ir-sim))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-04T20:39:26.357Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `hanruihua/ir-sim`
- **Description**: A  Python-based lightweight robot simulator designed for navigation, control, and learning
- **Primary Language / Ecosystem**: Python
- **Discovered Manifests / Configurations**: pyproject.toml, README.md
- **Stars / Engagement**: 1139 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: pyproject.toml, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `irsim/util/__init__.py`
```
"""
Utility functions for IR-SIM simulation.

This package contains helper functions for:
- Mathematical operations
- Coordinate transformations
- File operations
- Geometry utilities
"""

from .decorator import bind_env, normalize_actions, plot_only, time_it, time_it2
from .message import resolve_message_targets
from .random import random_uniform, rng, set_seed
from .util import (
    WrapToPi,
    WrapToRegion,
    cross_product,
    diff_to_omni,
    dist_hypot,
    distance,
    file_check,
    find_duplicates,
    find_file,
    find_object_by_identity,
    gen_inequal_from_vertex,
    geometry_transform,
    is_2d_list,
    is_convex_and_ordered,
    omni_to_diff,
    random_point_range,
    relative_position,
    to_numpy,
    transform_point_with_state,
    vel_diff2world,
    vel_omni2world,
    vel_world2diff,
    vel_world2omni,
    vertices_transform,
)

__all__ = [
    "WrapToPi",
    "WrapToRegion",
    "bind_env",
    "cross_product",
    "diff_to_omni",
    "dist_hypot",
    "distance",
    "file_check",
    "find_duplicates",
    "find_file",
    "find_object_by_identity",
    "gen_inequal_from_vertex",
    "geometry_transform",
    "is_2d_list",
    "is_convex_and_ordered",
    "normalize_actions",
    "omni_to_diff",
    "plot_only",
    "random_point_range",
    "random_uniform",
    "relative_position",
    "resolve_message_targets",
    "rng",
    "set_seed",
    "time_it",
    "time_it2",
    "to_numpy",
    "transform_point_with_state",
    "vel_diff2world",
    "vel_omni2world",
    "vel_world2diff",
    "vel_world2omni",
    "vertices_transform",
]

```

### Core Architecture Module: `irsim/util/decorator.py`
```
"""Decorators shared by IR-SIM environments and utilities.

``bind_env``, ``plot_only`` and ``normalize_actions`` wrap :class:`EnvBase`
methods; ``time_it`` / ``time_it2`` are general timing helpers.
"""

import functools
import time
from typing import Any

import numpy as np

from irsim.util.util import find_object_by_identity, is_list_of_numbers


def time_it(name: str = "Function") -> Any:
    """
    Decorator to measure function execution time.

    Args:
        name (str): Function name for logging (default "Function").

    Returns:
        function: Wrapped function with timing.
    """

    def decorator(func):
        def wrapper(*args, **kwargs):
            wrapper.count += 1
            start = time.time()
            result = func(*args, **kwargs)
            end = time.time()
            wrapper.func_count += 1
            print(f"{name} execute time {(end - start):.6f} seconds")
            return result

        wrapper.count = 0
        wrapper.func_count = 0
        return wrapper

    return decorator


def _as_action_list(action: Any, n_targets: int) -> list:
    """Return ``action`` as a list with one entry per target object.

    A single action (an ndarray, or a flat list/tuple of numbers such as
    ``[1.0, 0.5]``) is repeated for every target; a list/tuple of actions is
    used as is.
    """
    if isinstance(action, tuple):
        action = list(action)
    if isinstance(action, np.ndarray) or (action and is_list_of_numbers(action)):
        return [action] * n_targets
    if isinstance(action, list):
        return action
    raise TypeError(
        f"action must be a list, tuple, or ndarray, got {type(action).__name__}"
    )


def _target_positions(objects: list, action_id: Any, count: int) -> list[int]:
    """Return the positions in ``objects`` that ``action_id`` refers to.

    ``action_id`` is an object id (``obj.id``) or name, or a list of them. A
    single id (``None`` means the first object) selects ``count`` consecutive
    objects starting from it; an unknown id or name raises ``ValueError``.
    """

    def position(key):
        if isinstance(key, str):
            obj = find_object_by_identity(objects, name=key)
        else:
            obj = find_object_by_identity(objects, object_id=int(key))
        if obj is None:
            raise ValueError(f"no object with id or name {key!r}")
        return objects.index(obj)

    if isinstance(action_id, list):
        return [position(i) for i in action_id]
    start = 0 if action_id is None else position(action_id)
    return list(range(start, min(start + count, len(objects))))


def bind_env(method):
    """Decorator making ``self`` the current environment before ``method`` runs.

    Object ids, the random generator, and context-free logging are reached
    through the module-level ``env_param``/``world_param`` proxies, so methods
    that construct objects or draw random numbers bind their environment first.
    """

    @functools.wraps(method)
    def wrapper(self, *args, **kwargs):
        self._bind_config()
        return method(self, *args, **kwargs)

    return wrapper


def plot_only(method):
    """Decorator making an env plotting helper a no-op when the env has no figure.

    ``EnvBase`` creates no ``EnvPlot`` in headless mode, so
    rendering, drawing, and saving helpers decorated with this simply return
    ``None`` in that case.
    """

    @functools.wraps(method)
    def wrapper(self, *args, **kwargs):
        if self._env_plot is None:
            return None
        return method(self, *args, **kwargs)

    return wrapper


def normalize_actions(func):
    """
    Decorator to normalize (action, action_id) into an aligned actions list.

    The wrapped method must belong to a class that has a ``objects`` attribute.
    It receives ``actions``, a list aligned with ``self.objects`` (``None`` where
    nothing was given). ``action`` is one action, a list of actions, or a dict
    ``{name: action}``; ``action_id`` is an object id (``obj.id``) or name
    (``None`` for the first object), or a list of them. A single action is
    applied to every id; a list of actions is applied to the given ids, or to
    consecutive objects starting from the given id. Surplus actions (or ids)
    are dropped with a warning; an unknown id or name raises.
    """

    @functools.wraps(func)
    def wrapper(self, action=None, action_id=None, *args, **kwargs):
        objects = getattr(self, "objects", [])
        actions = [None] * len(objects)

        if isinstance(action, dict):  # {name: action}
            action_id, action = list(action), list(action.values())
        if action is not None:
            n_ids = len(action_id) if isinstance(action_id, list) else 1
            action_list = _as_action_list(action, n_ids)
            targets = _target_positions(objects, action_id, len(action_list))
            if len(action_list) != len(targets):
                self.logger.warning_once(
                    f"{len(action_list)} action(s) but {len(targets)} target object(s); "
                    "matched in order, the rest are ignored",
                    key="normalize_actions:surplus",
                )
            for pos, a in zip(targets, action_list, strict=False):
                actions[pos] = a

        return func(self, actions, 0, *args, **kwargs)

    return wrapper


def time_it2(name: str = "Function") -> Any:
    """
    Decorator to measure function execution time with instance attribute check.

    Args:
        name (str): Function name for logging (default "Function").

    Returns:
        function: Wrapped function with timing.
    """

    def decorator(func):
        def wrapper(self, *args, **kwargs):
            wrapper.count += 1
            start = time.time()
            result = func(self, *args, **kwargs)
            end = time.time()
            wrapper.func_count += 1
            if self.time_print:
                print(f"{name} execute time {(end - start):.6f} seconds")
            return result

        wrapper.count = 0
        wrapper.func_count = 0
        return wrapper

    return decorator

```

### Core Architecture Module: `irsim/util/message.py`
```
"""Helpers for applying :mod:`irsim.msg` messages to simulation objects.

These functions resolve which local objects an incoming message addresses.
They only read the objects they are given, so a caller can validate a whole
batch of updates before applying any of them.
"""

from __future__ import annotations

from collections.abc import Callable, Iterable
from typing import Any

from irsim.msg import ObjectState, WorldState
from irsim.util.util import find_object_by_identity


def resolve_message_targets(
    objects: Iterable[Any],
    msg: WorldState | ObjectState | Any,
    object_name: str | None = None,
    object_id: int | None = None,
    *,
    default_target: Callable[[], Any],
) -> list[tuple[Any, Any]]:
    """
    Pair each incoming odometry with the distinct local object it addresses.

    A ``WorldState`` addresses every object it contains, an ``ObjectState``
    uses its embedded name and id, and a standalone odometry message goes to
    ``default_target`` unless a name or id selects another object.

    Args:
        objects (Iterable): Local objects the message can address.
        msg: A :class:`~irsim.msg.WorldState`, an
            :class:`~irsim.msg.ObjectState`, or an odometry-shaped message.
        object_name (str): Explicit target name for a standalone odometry or
            object message.
        object_id (int): Explicit target id for the same messages. Names take
            precedence when both are given.
        default_target (Callable): Called only when a standalone odometry
            selects no object; returns the object that receives it.

    Returns:
        list: ``(object, odometry)`` pairs, one per addressed object.

    Raises:
        ValueError: If a target cannot be found, a name or id is combined with
            a ``WorldState``, or one object is addressed more than once.
    """

    objects = list(objects)

    if isinstance(msg, WorldState):
        if object_name is not None or object_id is not None:
            raise ValueError(
                "object_name and object_id cannot be used with WorldState."
            )
        updates = [
            (_require_object(objects, obj_msg.name, obj_msg.id), obj_msg.odom)
            for obj_msg in msg.objects
        ]
    elif isinstance(msg, ObjectState):
        if object_name is None and object_id is None:
            object_name, object_id = msg.name, msg.id
        updates = [(_require_object(objects, object_name, object_id), msg.odom)]
    elif object_name is None and object_id is None:
        updates = [(default_target(), msg)]
    else:
        updates = [(_require_object(objects, object_name, object_id), msg)]

    seen: set[int] = set()
    for target, _ in updates:
        if id(target) in seen:
            raise ValueError(
                f"Received more than one state for object '{target.name}'."
            )
        seen.add(id(target))

    return updates


def _require_object(
    objects: list[Any], object_name: str | None, object_id: int | None
) -> Any:
    """Find an incoming message target, or report the identity that failed."""
    target = find_object_by_identity(objects, object_name, object_id)
    if target is not None:
        return target

    identity = (
        f"name={object_name!r}, id={object_id}"
        if object_name or object_id is not None
        else "without a name or id"
    )
    raise ValueError(f"No simulation object matches received message {identity}.")

```

### Core Architecture Module: `irsim/util/random.py`
```
import numpy as np

_default = np.random.default_rng()  # shared by environments created without a seed
_env_param = None  # the ``irsim.config.env_param`` proxy, imported on first use


def _params():
    global _env_param
    if _env_param is None:
        from irsim.config import env_param

        _env_param = env_param
    return _env_param


def _generator() -> np.random.Generator:
    """The generator in use: the current environment's own one, else the shared default."""
    return _params().rng or _default


class _RNGProxy:
    """Proxy over the generator in use, so ``rng.uniform(...)`` follows the environment."""

    def __getattr__(self, name):
        return getattr(_generator(), name)


rng = _RNGProxy()


def set_seed(seed: int | None = None) -> None:
    """Reseed the generator in use (see :data:`rng`).

    Reseeds the current environment's own generator when it has one
    (``irsim.make(..., seed=...)`` or ``env.set_random_seed``), otherwise the
    shared default that unseeded environments draw from.

    Args:
        seed: Seed for deterministic sampling. ``None`` creates a fresh
            non-deterministic generator.
    """
    global _default
    params = _params()
    if params.rng is not None:
        params.rng = np.random.default_rng(seed)
    else:
        _default = np.random.default_rng(seed)


def random_uniform(low=None, high=None, size=(3, 1), min_distance=1.0):
    """
    Sample random points uniformly with a pairwise min-distance constraint.

    Args:
        low (list | np.ndarray): Lower bound as a 3D vector (x, y, theta).
            Default is [0.5, 0.5, 0.0].
        high (list | np.ndarray): Upper bound as a 3D vector (x, y, theta).
            Default is [9.5, 9.5, 6.28].
        size (tuple): (dim, n) where dim is 2 or 3 and n is the number of
            points to sample. When dim == 2, only x and y are sampled and
            theta is set to 0. Default is (3, 1).
        min_distance (float): Minimum pairwise distance in the xy plane.
            Default is 1.0.

    Returns:
        np.ndarray: Random points of shape (3, n).
    """
    low = np.asarray([0.5, 0.5, 0.0] if low is None else low, dtype=float).reshape(-1)
    high = np.asarray([9.5, 9.5, 6.28] if high is None else high, dtype=float).reshape(
        -1
    )
    dim, n = size

    points = np.zeros((3, n))
    max_attempts = 1000

    for i in range(n):
        for _ in range(max_attempts):
            candidate = rng.uniform(low[:dim], high[:dim])
            if i == 0:
                break
            diffs = points[:2, :i] - candidate[:2, None]
            if np.min(np.linalg.norm(diffs, axis=0)) >= min_distance:
                break
        points[:dim, i] = candidate

    return points

```

### Core Architecture Module: `irsim/util/util.py`
```
import difflib
import inspect
import math
import os
import sys
from collections import Counter, deque
from collections.abc import Iterable
from functools import wraps
from math import atan2, cos, pi, sin
from typing import Any

import numpy as np
import shapely

from irsim.config import env_param
from irsim.util.random import rng


def file_check(file_name: str | None, root_path: str | None = None) -> str | None:
    """
    Check whether a file exists and return its absolute path.

    Searches in the following order:
    1. The given path directly
    2. Relative to sys.path[0]
    3. Relative to the current working directory
    4. Relative to the script directory
    5. Recursively under root_path (lazy fallback)

    Args:
        file_name (str | None): Name or relative path of the file to check.
            Returns None immediately if None.
        root_path (str | None): Root directory for recursive search fallback.

    Returns:
        str | None: Absolute path of the file if found, None otherwise.
    """
    if file_name is None:
        return None

    paths_to_check = [
        file_name,
        os.path.join(sys.path[0], file_name),
        os.path.join(os.getcwd(), file_name),
        os.path.join(os.path.dirname(os.path.abspath(sys.argv[0])), file_name),
    ]

    for candidate_path in paths_to_check:
        if os.path.isfile(candidate_path):
            return os.path.abspath(candidate_path)

    found = find_file(root_path, file_name) if root_path else None
    if found:
        return found

    logger = getattr(env_param, "logger", None)
    if logger is not None:
        logger.warning(f"{file_name} not found")

    return None


def find_file(root_path: str | None, target_filename: str) -> str | None:
    """
    Recursively search for a file under root_path.

    Args:
        root_path (str | None): Directory to search under. Returns None if None.
        target_filename (str): Name of the file to find.

    Returns:
        str | None: Absolute path if found, None otherwise.
    """

    if root_path is None:
        return None

    for dirpath, _dirnames, filenames in os.walk(root_path):
        if target_filename in filenames:
            return os.path.abspath(os.path.join(dirpath, target_filename))
    return None


def _emit_log(level: str, msg: str) -> None:
    """Emit ``msg`` at ``level`` through the env logger, if one is configured.

    Resolves the logger via the global ``env_param`` proxy -- the same fallback
    branch objects use in their ``_env_param`` accessor -- for context-free code
    (geometry/kinematics handlers, etc.) that has no env instance. No-ops when no
    logger is configured, e.g. geometry built standalone outside ``irsim.make``,
    instead of printing unconditionally.
    """
    logger = getattr(env_param, "logger", None)
    if logger is not None:
        getattr(logger, level)(msg)


def log_warning(msg: str) -> None:
    """Emit a warning through the env logger so it respects ``log_level``."""
    _emit_log("warning", msg)


def log_warning_once(msg: str) -> None:
    """Emit ``msg`` as a warning once (then at DEBUG); see ``EnvLogger.warning_once``.

    Loggers without ``warning_once`` (e.g. a plain ``logging.Logger``) get a
    regular warning instead.
    """
    logger = getattr(env_param, "logger", None)
    if logger is not None:
        getattr(logger, "warning_once", logger.warning)(msg)


def log_error(msg: str) -> None:
    """Emit an error through the env logger so it respects ``log_level``."""
    _emit_log("error", msg)


def WrapToPi(rad: float, positive: bool = False) -> float:
    """The function `WrapToPi` transforms an angle in radians to the range [-pi, pi].

    Args:

        rad (float): Angle in radians. The `rad` parameter in the `WrapToPi` function represents an angle in radians that you want to transform to the range `[-pi, pi]`. The function ensures that the angle is within this range by wrapping it around if it exceeds the bounds.

        positive (bool): Whether to return the positive value of the angle. Useful for angles difference.

    Returns:
        The function `WrapToPi(rad)` returns the angle `rad` wrapped to the range [-pi, pi].

    """
    if not np.isfinite(rad):
        return 0.0

    rad = (rad + pi) % (2 * pi) - pi

    return rad if not positive else abs(rad)


def WrapTo2Pi(rad: float) -> float:
    """The function `WrapTo2Pi` transforms an angle in radians to the range [0, 2pi].

    Args:

        rad (float): Angle in radians.
            The `rad` parameter in the `WrapTo2Pi` function represents an angle in radians that you want to transform to the range `[0, 2pi]`. The function ensures that the angle is within this range by wrapping it around if it exceeds the bounds.

    Returns:
        The function `WrapTo2Pi(rad)` returns the angle `rad` wrapped to the range [0, 2pi].

    """
    if not np.isfinite(rad):
        return 0.0

    return rad % (2 * pi)


def ClipTo2Pi(rad: float) -> float:
    """Clip an angular span, such as a sensor sweep or a field of view, to [0, 2pi].

    Unlike :func:`WrapTo2Pi`, a full circle stays ``2pi`` instead of wrapping to ``0``.
    Non-finite input yields ``0.0``, as in :func:`WrapTo2Pi`.

    Args:
        rad (float): Angular span in radians.

    Returns:
        float: ``rad`` clipped to the range [0, 2pi].
    """
    if not np.isfinite(rad):
        return 0.0

    return float(np.clip(rad, 0.0, 2 * pi))


def WrapToRegion(rad: float, range: list[float]) -> float:
    """
    Transform an angle to a defined range, with length of 2*pi.

    Args:
        rad (float): Angle in radians.
        range (list): List defining the range [min, max].

    Returns:
        float: Wrapped angle.
    """
    if len(range) < 2:
        raise ValueError(f"Parameter 'range' must have length >= 2, got {len(range)}")
    assert range[1] - range[0] == 2 * pi
    while rad > range[1]:
        rad = rad - 2 * pi
    while rad < range[0]:
        rad = rad + 2 * pi
    return rad


def convert_list_length(
    input_data: list[Any], number: int = 0, per_object: bool = False
) -> list[Any]:
    """
    Convert input to a list with a specific length.

    A scalar, or a list of numbers such as a state or velocity vector, is
    repeated for every object. Any other list already holds one entry per
    object and is padded with its last entry or truncated.

    Args:
        input_data: Data to convert.
        number (int): Desired length.
        per_object (bool): Treat a list of numbers as one value per object
            instead of one vector shared by all, e.g. ``mass: [0.5, 2]``.

    Returns:
        list: Converted list.
    """
    if number == 0:
        return []
    if (
        not isinstance(input_data, list)
        or not input_data
        or (not per_object and is_list_of_numbers(input_data))
    ):
        return [input_data] * number
    if len(input_data) <= number:
        input_data.extend([input_data[-1]] * (number - len(input_data)))
    if len(input_data) > number:
        input_data = input_data[:number]
    return input_data


def convert_list_length_dict(input_data: list[Any], number: int = 0) -> list[Any]:
    """
    Convert input to a list with a specific length for dictionaries.

    Args:
        input_data: Data to convert.
        number (int): Desired length.

    Returns:
        list: Converted list.
    """
    if number == 0:
        return []
    if not isinstance(input_data, list) or is_list_of_dicts(input_data):
        return [input_data] * number
    if len(input_data) <= number:
        input_data.extend([input_data[-1]] * (number - len(input_data)))
    if len(input_data) > number:
        input_data = input_data[:number]
    return input_data


def is_list_of_dicts(lst: Any) -> bool:
    """
    Check if a list contains only dictionaries.

    Args:
        lst (list): List to check.

    Returns:
        bool: True if all elements are dictionaries, False otherwise.
    """
    return isinstance(lst, list) and all(isinstance(sub, dict) for sub in lst)


def is_list_of_numbers(lst: Any) -> bool:
    """
    Check if a list contains only numbers.

    Args:
        lst (list): List to check.

    Returns:
        bool: True if all elements are numbers, False otherwise.
    """
    return isinstance(lst, list) and all(
        isinstance(sub, int | float | np.number) for sub in lst
    )


def is_list_of_lists(lst: Any) -> bool:
    """
    Check if a list contains lists.

    Args:
        lst (list): List to check.

    Returns:
        bool: True if any element is a list, False otherwise.
    """
    return isinstance(lst, list) and any(isinstance(sub, list) for sub in lst)


def is_list_not_list_of_lists(lst: Any) -> bool:
    """
    Check if a list does not contain lists.

    Args:
        lst (list): List to check.

    Returns:
        bool: True if no elements are lists, False otherwise.
    """
    return isinstance(lst, list) and all(not isinstance(sub, list) for sub in lst)


def find_duplicates(values: Iterable[Any]) -> list[Any]:
    """
    Find the values that appear more than once.

    Args:
        values (Iterable): Values to inspect, such as object names.

    Returns:
        list: The repeated values, in first-seen order.
    """

    return [value for value, count in Counter(values).items() if count > 1]


def find_object_by_identity(
    objects: Iterable[Any],
    name: str | None = None,
    object_id: int | None = None,
) -> Any | None:
    """
    Find the first object matching a stable name, then an id.

    Names are matched first, because they are the identity shared across
    simulators; ids are only used as a fallback.

    Args:
        objects (Iterable): Objects to search, each with ``name`` and ``id``.
        name (str): Name to look for. Ignored when None or empty.
        object_id (int): Id to look for when the name does not match.

    Returns:
        The matching object, or None if 
```

### Core Architecture Module: `usage/07render_world/render.py`
```
import irsim

env = irsim.make(save_ani=False, display=True)

for _i in range(300):
    env.step()
    env.render(0.05)

    if env.done():
        break

env.end()

```

### Core Architecture Module: `usage/07render_world/render_save_figure.py`
```
import irsim

env = irsim.make("render.yaml", save_ani=False, display=False)

for _i in range(300):
    env.step()
    env.render(0.05)

    if env.done():
        break

env.save_figure("render2.pdf")
env.end(3)

```

### Core Architecture Module: `irsim/__init__.py`
```
import os
import sys
from collections.abc import Callable
from typing import Any, Literal, Optional

from irsim.env import EnvBase, EnvBase3D

from . import msg
from .version import __version__


class _EnvFactory:
    """
    Internal object-oriented factory that creates IR-SIM environments.

    Create an environment by the given world file and projection.

    Env candidates:
        - EnvBase (2D default)
        - EnvBase3D (3D)
    """

    def __init__(
        self, default_projection: str | None = None, **default_kwargs: Any
    ) -> None:
        self.default_projection = default_projection
        self.default_kwargs = default_kwargs

        self._registry: dict[str, Callable[..., EnvBase]] = {
            "2d": EnvBase,
            "3d": EnvBase3D,
        }

    def _resolve_world_name(self, world_name: str | None) -> str:
        return world_name or os.path.basename(sys.argv[0]).split(".")[0] + ".yaml"

    def register(self, key: str, ctor: Callable[..., EnvBase]) -> None:
        self._registry[key.strip().lower()] = ctor

    def create(
        self,
        world_name: str | None = None,
        projection: str | None = None,
        **kwargs: Any,
    ) -> EnvBase:
        resolved_world = self._resolve_world_name(world_name)
        options: dict[str, Any] = {**self.default_kwargs, **kwargs}
        key = (projection or self.default_projection or "2d").strip().lower()
        try:
            ctor = self._registry[key]
        except KeyError as e:
            raise ValueError(
                f"Unknown projection {projection!r}. Allowed: {', '.join(self._registry)}"
            ) from e
        return ctor(resolved_world, **options)


_env_factory = _EnvFactory()


def make(
    world_name: str | None = None,
    projection: str | None = None,
    step_mode: Literal["internal", "external"] | None = None,
    **kwargs: Any,
) -> EnvBase:
    """
    Create an environment by the given world file and projection.

    This function serves as the main entry point for creating simulation environments.
    It automatically selects between 2D and 3D environments based on the projection parameter.

    Args:
        world_name (str, optional): The name of the world YAML configuration file.
            If not specified, the default name of the current Python script with
            '.yaml' extension will be used.
        projection (str, optional): The projection type of the environment.
            Default is None for 2D environment. If set to "3d", creates a 3D
            plot environment.
        step_mode ({"internal", "external"}, optional): Override the
            ``world.step_mode`` value from YAML. ``internal`` lets IR-SIM
            integrate object states. ``external`` expects callers to update
            object states before each :py:meth:`.EnvBase.step` call. If None,
            the YAML value is used (defaulting to ``internal``).
        **kwargs: Additional keyword arguments passed to :py:class:`.EnvBase`
            or :py:class:`.EnvBase3D`. Common options include:

            - display (bool): Whether to display the environment visualization
            - save_ani (bool): Whether to save animation
            - log_level (str): Logging level for the environment
            - seed (int, optional): Seed for IR-SIM's random number generator
              to make runs reproducible when using IR-SIM randomness.

    Returns:
        EnvBase: The created environment object. Returns :py:class:`.EnvBase3D`
        if projection is "3d", otherwise returns :py:class:`.EnvBase`.

    Example:
        >>> # Create a 2D environment with default world file
        >>> env = make()
        >>>
        >>> # Create a 3D environment with custom world file
        >>> env = make("my_world.yaml", projection="3d")
        >>>
        >>> # Create environment with additional options
        >>> env = make("world.yaml", display=True, save_ani=False)
        >>> # Override the YAML state-advancement mode
        >>> env = make("world.yaml", step_mode="external")
    """
    if step_mode is not None:
        kwargs["step_mode"] = step_mode
    return _env_factory.create(world_name=world_name, projection=projection, **kwargs)

```

### Core Architecture Module: `irsim/config/__init__.py`
```
"""
Global parameters for IR-SIM simulation environment.

This package contains configuration parameters for:
- env_param: Environment parameters
- world_param: World parameters
- path_param: Path parameters
- palette_param: Default colors
"""

from . import env_param, palette_param, path_param, world_param

__all__ = ["env_param", "palette_param", "path_param", "world_param"]

```

### Core Architecture Module: `irsim/config/env_param.py`
```
"""
Objects: A list of all objects in the environment
Logger: A logger object to log messages
Platform: The operating system platform
"""

import itertools
import platform
import sys
from collections.abc import Iterator
from dataclasses import dataclass, field, fields
from types import ModuleType
from typing import Any

import numpy as np

from irsim.world.object_base import ObjectBase


@dataclass
class EnvParam:
    """Mutable per-environment runtime state.

    Attributes:
        objects: Objects currently managed by the environment.
        logger: Environment logger instance.
        GeometryTree: Spatial index used for geometry queries, when available.
        platform_name: Name of the current operating system platform.
        id_iter: Counter handing out object ids; each environment numbers its
            objects from 0.
        env_id: Process-wide number of the owning environment (``None`` for the
            default instance bound before any environment exists).
        rng: Generator this environment draws from when it was created with a
            seed or reseeded; ``None`` means the shared default of
            ``irsim.util.random``.
    """

    objects: list[ObjectBase] = field(default_factory=list)
    logger: Any | None = None
    GeometryTree: Any | None = None
    platform_name: str = field(default_factory=platform.system)
    id_iter: Iterator[int] = field(default_factory=itertools.count)
    env_id: int | None = None
    rng: np.random.Generator | None = None


# Multi-env storage (default index 0)
_instances: list[EnvParam] = [EnvParam()]
_current = _instances[0]

_PARAM_FIELDS = frozenset(f.name for f in fields(EnvParam))


def bind(instance: EnvParam) -> None:
    """Bind instance to default index 0 and update current alias."""
    global _current
    if _instances:
        _instances[0] = instance
    else:
        _instances.append(instance)
    _current = instance


class _ParamModule(ModuleType):
    """Route param-field access on the module to the bound instance.

    PEP 562 lets a module define ``__getattr__`` only; plain assignment
    (``env_param.logger = x``) would create a real module attribute that
    permanently shadows the proxy. Swapping the module class makes
    attribute reads, writes, and index access all resolve against the
    currently bound :class:`EnvParam` instance.
    """

    def __getattr__(self, name: str):
        return getattr(_current, name)

    def __setattr__(self, name: str, value) -> None:
        if name in _PARAM_FIELDS:
            setattr(_current, name, value)
        else:
            super().__setattr__(name, value)

    def __getitem__(self, index: int) -> EnvParam:
        return _instances[index]

    def __setitem__(self, index: int, instance: EnvParam) -> None:
        """Assign an EnvParam at a specific index. Extends list if needed."""
        global _current
        if index < 0:
            raise IndexError("env_param index must be non-negative")
        if index >= len(_instances):
            _instances.extend(EnvParam() for _ in range(index - len(_instances) + 1))
        _instances[index] = instance
        if index == 0:
            _current = instance


sys.modules[__name__].__class__ = _ParamModule

```

### Core Architecture Module: `irsim/config/palette_param.py`
```
"""
Default colors of everything IR-SIM draws.

The values are Okabe-Ito based (with a second green from Paul Tol's muted
scheme), so they stay distinguishable under common forms of colour-vision
deficiency and keep robots, sensors and obstacles apart in grayscale print.
Any color given in YAML or code overrides them. They are read when an object
or a plot is created, so changing them before ``irsim.make()`` restyles every
following scene::

    from irsim.config import palette_param

    palette_param.robot = "#0072B2"
    palette_param.cycle = ["#0072B2", "#D55E00", "#009E73"]

Attributes:
    robot: Robots with ``diff``, ``omni``, ``omni_angular`` or custom kinematics.
    robot_acker: Car-like (``acker``) robots.
    obstacle: Obstacles, grid maps and any object without a role color.
    pushable: Pushable objects (finite ``mass``, not static) without
        kinematics, which only move when ``collision_mode: contact`` pushes
        them, so they stand out from static obstacles.
    arrow: Heading arrow drawn on top of a body.
    fov: Field-of-view fill.
    fov_edge: Field-of-view outline.
    lidar: Lidar beams.
    laser_highlight: Beams singled out with ``set_laser_color``.
    fmcw_zero_velocity: FMCW beams with no radial velocity.
    fmcw_positive_velocity: FMCW beams moving away.
    fmcw_negative_velocity: FMCW beams moving closer.
    marker: Points drawn with ``env.draw_points``.
    path: Lines drawn with ``env.draw_trajectory`` and ``env.draw_box``.
    quiver: Arrows drawn with ``env.draw_quiver``.
    cycle: Colors handed out in turn to the objects of a group configured with
        ``color: 'cycle'``; it starts with the robot color so a single robot
        looks the same either way.
"""

import sys
from dataclasses import dataclass, field, fields
from types import ModuleType

DEFAULT_CYCLE = (
    "#009E73",  # bluish green (the robot color)
    "#0072B2",  # blue
    "#E69F00",  # orange
    "#CC79A7",  # reddish purple
    "#56B4E9",  # sky blue
    "#D55E00",  # vermillion
    "#F0E442",  # yellow
    "#117733",  # dark green
)


@dataclass
class PaletteParam:
    """Default colors, one attribute per kind of drawing (see the module docstring)."""

    robot: str = "#009E73"
    robot_acker: str = "#117733"
    obstacle: str = "k"
    pushable: str = "#E69F00"
    arrow: str = "#F0E442"
    fov: str = "#56B4E9"
    fov_edge: str = "#0072B2"
    lidar: str = "#CC3311"
    laser_highlight: str = "#56B4E9"
    fmcw_zero_velocity: str = "#56B4E9"
    fmcw_positive_velocity: str = "#CC3311"
    fmcw_negative_velocity: str = "#0072B2"
    marker: str = "#CC79A7"
    path: str = "#0072B2"
    quiver: str = "k"
    cycle: list[str] = field(default_factory=lambda: list(DEFAULT_CYCLE))

    def cycle_color(self, index: int) -> str:
        """Color of the ``index``-th object of a group drawn with ``color: 'cycle'``."""
        return self.cycle[index % len(self.cycle)]


# Multi-instance storage (default index 0), like the other config modules.
_instances: list[PaletteParam] = [PaletteParam()]
_current = _instances[0]

_PARAM_FIELDS = frozenset(f.name for f in fields(PaletteParam))


def bind(instance: PaletteParam) -> None:
    """Bind instance to default index 0 and update current alias."""
    global _current
    if _instances:
        _instances[0] = instance
    else:
        _instances.append(instance)
    _current = instance


class _ParamModule(ModuleType):
    """Route param-field access on the module to the bound instance.

    PEP 562 lets a module define ``__getattr__`` only; plain assignment
    (``palette_param.robot = x``) would create a real module attribute that
    permanently shadows the proxy. Swapping the module class makes
    attribute reads, writes, and index access all resolve against the
    currently bound :class:`PaletteParam` instance.
    """

    def __getattr__(self, name: str):
        return getattr(_current, name)

    def __setattr__(self, name: str, value) -> None:
        if name in _PARAM_FIELDS:
            setattr(_current, name, value)
        else:
            super().__setattr__(name, value)

    def __getitem__(self, index: int) -> PaletteParam:
        return _instances[index]

    def __setitem__(self, index: int, instance: PaletteParam) -> None:
        """Assign a PaletteParam at a specific index. Extends list if needed."""
        global _current
        if index < 0:
            raise IndexError("palette_param index must be non-negative")
        if index >= len(_instances):
            _instances.extend(
                PaletteParam() for _ in range(index - len(_instances) + 1)
            )
        _instances[index] = instance
        if index == 0:
            _current = instance


sys.modules[__name__].__class__ = _ParamModule

```

### Core Architecture Module: `irsim/config/path_param.py`
```
import os
import sys
from dataclasses import dataclass, field
from typing import cast

import irsim


def output_root() -> str:
    """Directory the output folders are created under.

    The folder of the running script when there is one, otherwise the current
    working directory: under ``python -c``, a REPL or a notebook ``sys.path[0]``
    is empty, and ``"" + "/figure"`` would point at the filesystem root.
    """
    base = sys.path[0] if sys.path else ""
    return base if base else os.getcwd()


@dataclass
class PathManager:
    """
    Module for managing the path of the project.
        - root_path: path of the irsim package
        - ani_buffer_path: path of the animation buffer
        - ani_path: path of the animation
        - fig_path: path of the saved figure

    The three output paths default to folders under :func:`output_root`.
    """

    root_path: str = os.path.dirname(cast(str, irsim.__file__))
    ani_buffer_path: str = field(
        default_factory=lambda: output_root() + "/animation_buffer"
    )
    ani_path: str = field(default_factory=lambda: output_root() + "/animation")
    fig_path: str = field(default_factory=lambda: output_root() + "/figure")


# Multi-env storage (default index 0)
_instances: list[PathManager] = [PathManager()]
_current = _instances[0]


def bind(instance: PathManager) -> None:
    """Bind instance to default index 0 and update current alias."""
    global _current
    if _instances:
        _instances[0] = instance
    else:
        _instances.append(instance)
    _current = instance


class _Proxy:
    def __getattr__(self, name: str):
        return getattr(_current, name)

    def __setattr__(self, name: str, value):
        setattr(_current, name, value)


path_manager = _Proxy()


def __getitem__(index: int) -> PathManager:
    return _instances[index]


def __setitem__(index: int, instance: PathManager) -> None:
    """Assign a PathManager at a specific index. Extends list if needed."""
    global _current
    if index < 0:
        raise IndexError("path_param index must be non-negative")
    if index >= len(_instances):
        _instances.extend(PathManager() for _ in range(index - len(_instances) + 1))
    _instances[index] = instance
    if index == 0:
        _current = instance

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #312** (2026-06-26): **Disable yellow arrows for static obstacles**
  *Symptoms*: Yellow arrows are showing up even for static obstacles. I don’t remember seeing this earlier, so I’m not sure if something changed in a recent version.  Is there a way to disable them?  <img width="3661" height="1960" alt="Image" src="https://github.com/user-attachments/assets/52140e4a-c338-427b-82d4-3f615977f53b" />
  **Post-Mortem & Fix Analysis**:
  > Hi, thanks for pointing this out, this bug is fixed by PR #313. You can try that in the main branch.  You can also disable yellow arrows in current version by setting the `show_arrow` to be false   ```  obstacle:     - shape: {name: 'circle', radius: 0.5}       state: [5, 5, 0]       plot:         show_arrow: False ```

- **Issue #301** (2026-06-30): **使用疑惑**
  *Symptoms*: > **Language:** English is preferred so that discussions are accessible to the broader community. Chinese (中文) is also welcome. If English is not your first language, feel free to use translation tools — we appreciate the effort! 您好，我在实验时遇到了一些情况，可能是bug，如果不是请您见谅。 1. omni_angular模型的dash运动（其他dash没有使用，不清楚），如果开始时背向目标点，会在原地进行反复轻微打转。AI给出的问题源是，双向转动在争夺控制权，转一点后又反向转回去。（AI按此方向修改可以改正） 2. diff模型的rvo运动，在背向目标点时可能会停滞不动。AI给出的问题源是，该模型的rvo求解是omni模型求解结果的转化，做不到掉头。好像rvo的原理上对反向运动就不太支持？ 3. 在并行启动大量（100以上）仿真环境进行学习训练的数据收集时，开始的创建环境会报某个队列溢出的问题，不影响运行。AI给出的问题源是，创建环境，无论是否启用键盘控制，都会唤起对应节点。（使用AI沉默这个节点可以避免） 我没有自行阅读源码，如果是使用错误或AI分析错误，请您见谅。如果需要提供更细致的情况，请您通过邮箱联系我。 感谢您提供这个开源平台！
  **Post-Mortem & Fix Analysis**:
  > 你好，请提供对应的python脚本和yaml 文件复现问题，还有ir-sim版本，才好解决问题
  > 抱歉这么晚提供。 [问题.zip](https://github.com/user-attachments/files/28834259/default.zip)请见这个压缩包，使用的是最新的2.10版本。 如果是使用有误，还请您指出。
  > Hi @xunlan11, thanks for the detailed report and reproduction scripts. Below is each issue and its fix.  **1. `omni_angular` + `dash` spins in place when starting back-to-goal.** Fix: the two turn directions were fighting for control. Removing the yaw overshoot makes it commit to one direction and reach the goal. (PR #331)  **2. `diff` + `rvo` stalls when the goal is behind.** Fix: holonomic RVO cannot represent a turn-around, so when there is nothing to avoid it now rotates toward the goal instead of freezing. (PR #331)  **3. 100+ parallel environments overflow the input queue.** Fix: every env started a global keyboard listener, which overflowed the queue. The keyboard listener is now skipped when `display=False` (headless). (PR #331)  **4. `Invalid polygon. Making it valid.` still prints with `log_level="ERROR"`.** Fix: it previously used `print()`. It now goes through the logger and respects `log_level`. (PR #326, merged)  **5. Run several algorithms on one environment to compare t

- **Issue #274** (2026-04-11): **Object ID Setting Problem**
  *Symptoms*: ## Describe the bug *When multiple irsim environments are created simultaneously, object IDs remain unique across different environments. For example, if env1 contains two objects with IDs 0 and 1, the object IDs in env2 will start counting from 2 due to the global counter implemented in the ObjectBase class. This causes issues during the simulation step.*  <img width="436" height="240" alt="Image" src="https://github.com/user-attachments/assets/2274c545-e09a-4be7-b728-f6bf1b168208" />  The action ID doesn't seem to be used, and in subsequent objects_step calls, the actions from the input action list are by default assigned to the first len(action) objects.  <img width="671" height="527" alt="Image" src="https://github.com/user-attachments/assets/1eb02268-e7d6-4d0b-9da6-c467fdee2bc9" />  <img width="623" height="342" alt="Image" src="https://github.com/user-attachments/assets/686476cd-193e-4410-a2f7-9123e0416308" />  ## To Reproduce *Create 2 irsim-env by irsim.make(world_file_path), and check the object id in the second env*   ## Expected behavior *The variable counters in each environment should be independent.*    
  **Post-Mortem & Fix Analysis**:
  > Hi, thanks for pointing this error out. This issue is fixed by PR #277  Please try and feel free to give feedback if there are any issues.
  >    > Hi, thanks for pointing this error out. This issue is fixed by PR [#277](https://github.com/hanruihua/ir-sim/pull/277) >  > Please try and feel free to give feedback if there are any issues.  Thanks a lot for your help! Your solution worked well and I really appreciate the time and effort you put into resolving this issue.

- **Issue #248** (2026-04-21): **Regarding the robot's initial speed after environment reset**
  *Symptoms*: I tried using ```self.env.robot.set_velocity([0.5, 0], init=True)``` to set the initial speed.  But after resetting the environment, the robot's initial speed remains at 0 by default.  It seems that the function's functionality is not being implemented correctly?
  **Post-Mortem & Fix Analysis**:
  > Hi, thanks for pointing this out.  Currently, `set_velocity` works as expected on my end. Could you provide a minimal example to reproduce this bug and clarify the difference between your expected behavior and the current behavior?  
  > FIxed by #284 
  > Thank you for your correction, the bug I mentioned was exactly the issue you fixed. Besides, I apologize for not replying sooner due to being busy with my graduation thesis.

- **Issue #180** (2026-01-05): **Group ID parameter conflict**
  *Symptoms*: *We recommend you to use the latest version of ir-sim when reporting bugs.*  ## Describe the bug An error occurs when assigning a group ID to the robot. The error message is shown below, and I’m using version 2.8.1.  <img width="1013" height="419" alt="Image" src="https://github.com/user-attachments/assets/17d82bbc-a870-487e-9986-a6baa6ddf32d" />  ## To Reproduce An error occurs when creating the environment with this YAML file.  `    world:       height: 10  # the height of the world       width: 10   # the width of the world       step_time: 0.1  # 10Hz calculate each step       sample_time: 0.1  # 10 Hz for render and data extraction        offset: [0, 0] # the offset of the world on x and y       robot:       - number: 5         name: ["f1", "f2", "f3", "f4", "f5"]         group: 0 # distinguish robot roles by id         distribution: {name: 'circle', radius: 4.0, center: [1, 1]}         kinematics: {name: 'omni'}         shape: {name: 'circle', radius: 0.2}         group_behavior:            name: 'orca'           neighborDist: 10.0           maxNeighbors: 10           timeHorizon: 10.0           timeHorizonObst: 10.0           safe_radius: 0.1         vel_max: [2.0, 2.0]         goal: [9, 9, 0]         plot:           show_trail: true           trail_alpha: 0.5            - number: 5         name: ["s1", "s2", "s3", "s4", "s5"]         group: 1 # distinguish robot roles by id         distribution: {name: 'circle', radius: 4.0, center: [1, 1]}         kinematics: {name: 
  **Post-Mortem & Fix Analysis**:
  > Thanks pointing this out. Your understanding is right and feel free to propose a PR to fix it.
  > This issue is fixed by PR #183 

- **Issue #144** (2025-10-10): **Program crashed after colliding with the wall in HMD3d world**
  *Symptoms*: ## Describe the bug The ir-sim crashed when the agent move and collide with the wall in the HMD3d world.  ## To Reproduce Change the yaml world to use: ```python world:   height: 80  # the height of the world   width: 80   # the width of the world   step_time: 0.1  # 10Hz calculate each step   sample_time: 0.1  # 10 Hz for render and data extraction    offset: [0, 0] # the offset of the world on x and y    collision_mode: 'reactive'  # 'stop', 'unobstructed',    obstacle_map: 'hm3d_2.png' # hm3d_1.png, hm3d_2.png, hm3d_3.png, hm3d_4.png, hm3d_5.png, hm3d_6.png, hm3d_7.png, hm3d_8.png, hm3d_9.png   mdownsample: 2 ``` Change the rl_train.py to use the suitable yaml world: ```python sim = SIM(         world_file="worlds/maze_hmd3d.yaml", disable_plotting=False     ) ``` then ```python poetry run python robot_nav/rl_train.py ```  Please provide a both python code and yaml file to reproduce the bug.   ## Expected behavior The ir-sim crash after colliding with the wall. ```bash Traceback (most recent call last):   File "/home/lexciese22/DRL-robot-navigation-IR-SIM/robot_nav/rl_train.py", line 146, in <module>     main()   File "/home/lexciese22/DRL-robot-navigation-IR-SIM/robot_nav/rl_train.py", line 86, in main     latest_scan, distance, cos, sin, collision, goal, a, reward = sim.reset()   File "/home/lexciese22/DRL-robot-navigation-IR-SIM/robot_nav/SIM_ENV/sim.py", line 99, in reset     self.env.random_obstacle_position(   File "/home/lexciese22/.cache/pypoetry/virtualenvs/robot-
  **Post-Mortem & Fix Analysis**:
  > Hi, thanks for pointing this error out.   This plot error in `random_obstacle_position` has been solved in PR #126 ; You can update the ir-sim to the newest version (>=2.7.3) to run your code again. 
  > I see, the issue is resolved. Thanks @hanruihua 

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

### Incident Patch 1: `9f747efd` (2026-10-04)
**Commit Message**: fix(env): survive scene rebuilds without a keyboard, isolate logging per environment, and fix arrival in state mode (#380)

* fix(env): survive scene rebuilds without a keyboard, isolate logging per environment, and fix arrival in state mode

A headless scene configured for keyboard control crashed on the first step
after reset(random=True) or reload(), because the rebuilt world re-applied
the YAML control_mode; auto control is now applied after every rebuild and
the keyboard path checks for a keyboard. Each environment owns its own log
sinks, so a second environment no longer removes the first one's console
and file logging. display=False switches to the Agg backend only while no
figure is open, so other environments' windows keep working. Output folders
fall back to the working directory when there is no script, so save_figure
works under python -c and notebooks. arrive_mode 'state' wraps the heading
difference, checks a goal without theta by position, and loop waypoints
keep their headings in that mode. step() keeps its docstring and signature
behind the action normaliser. Docs in both languages and tests follow.

* Revise log_file entry in Chinese localization

Updated log_file

**File**: `docs/locale/zh_CN/LC_MESSAGES/usage/make_environment.po` (modified, +6/-6)
```diff
@@ -92,6 +92,10 @@ msgid ""
 "**`log_level`** (str): Logging level for the environment (default: \"INFO\")"
 msgstr "**`log_level`**（str）：环境日志级别（默认 \"INFO\"）"
 
+#: ../../source/usage/make_environment.md:28
+msgid "**`log_file`** (str, optional): Path of this environment's log file (default: `None`, so file logging is disabled). Every environment owns its own console and optional file sinks, so creating a second environment does not change the first one's logging."
+msgstr "**`log_file`**（str，可选）：该环境日志文件的路径（默认 `None`，即不写入日志文件）。每个环境拥有自己的控制台与可选文件日志接收器，因此创建第二个环境不会改变第一个环境的日志。"
+
 #: ../../source/usage/make_environment.md:27
 msgid ""
 "**`seed`** (int, optional): Seed for IR-SIM's project RNG. If provided, "
@@ -747,9 +751,5 @@ msgstr ""
 "`save_figure()` 都会变成空操作，因此同一脚本无需修改即可运行："
 
 #: ../../source/usage/make_environment.md
-msgid ""
-"`disable_all_plot=True` is kept as an alias. To render offscreen while still "
-"saving animations or figures, use `display=False` instead."
-msgstr ""
-"`disable_all_plot=True` 作为别名保留。如果需要离屏渲染并仍然保存动画或图片，请改用 "
-"`display=False`。"
+msgid "`disable_all_plot=True` is kept as an alias. To render offscreen while still saving animations or figures, use `display=False` instead. Offscreen rendering switches the process to the Agg backend only while no figure is open; once another environment has a window, the backend is left alone so that window keeps working. Figures and animations are saved under `figure/` and `animation/` next to the running script, or under the current working directory when there is no script, as in a REPL or notebook."
+msgstr "`disable_all_plot=True` 作为别名保留。如果需要离屏渲染并仍然保存动画或图片，请改用 `display=False`。 离屏渲染只在尚无任何图窗打开时才把进程切换到 Agg 后端；一旦其他环境已有窗口，后端保持不变，以便该窗口继续工作。图片与动画保存在运行脚本旁的 `figure/` 与 `animation/` 目录下；没有脚本时（如 REPL 或 notebook）则保存在当前工作目录下。"
```

**File**: `docs/locale/zh_CN/LC_MESSAGES/yaml_config/configuration.po` (modified, +2/-4)
```diff
@@ -2175,10 +2175,8 @@ msgid ""
 msgstr "`'position'`：仅根据与目标位置 (`[x, y]`) 的距离判断。"
 
 #: ../../../../../../../Users/han/tech/ir-sim/docs/source/yaml_config/configuration.md:1340
-msgid ""
-"`'state'`: Considers both position and orientation in the arrival check "
-"(`[x, y, theta]`)."
-msgstr "`'state'`：同时考虑位置与朝向 (`[x, y, theta]`)。"
+msgid "`'state'`: Considers both position and orientation in the arrival check (`[x, y, theta]`). The heading difference is wrapped to `[-pi, pi]`, and a goal given without `theta` is checked by position only."
+msgstr "`'state'`：同时考虑位置与朝向 (`[x, y, theta]`)。朝向差会归一化到 `[-pi, pi]`；若目标未给出 `theta`，则只按位置判断。"
 
 #: ../../../../../../../Users/han/tech/ir-sim/docs/source/yaml_config/configuration.md:1348
 msgid "**`unobstructed`** (`bool`, default: `False`)"
```

**File**: `docs/source/usage/make_environment.md` (modified, +2/-1)
```diff
@@ -25,6 +25,7 @@ The `make` function creates an environment from a configuration file. Supported
 - **`display`** (bool): Whether to display the environment visualization (default: True)
 - **`save_ani`** (bool): Whether to save the simulation as an animation (default: False)
 - **`log_level`** (str): Logging level for the environment (default: "INFO")
+- **`log_file`** (str, optional): Path of this environment's log file (default: `None`, so file logging is disabled). Every environment owns its own console and optional file sinks, so creating a second environment does not change the first one's logging.
 - **`seed`** (int, optional): Seed for IR-SIM's project RNG. If provided,
   random elements produced by IR-SIM become reproducible. If omitted/``None``,
   a new unseeded generator is used (non-reproducible). Custom extensions using
@@ -168,7 +169,7 @@ Pass `headless=True` to run without any figure, window, or keyboard/mouse contro
 env = irsim.make("config.yaml", headless=True)
 ```
 
-`disable_all_plot=True` is kept as an alias. To render offscreen while still saving animations or figures, use `display=False` instead.
+`disable_all_plot=True` is kept as an alias. To render offscreen while still saving animations or figures, use `display=False` instead. Offscreen rendering switches the process to the Agg backend only while no figure is open; once another environment has a window, the backend is left alone so that window keeps working. Figures and animations are saved under `figure/` and `animation/` next to the running script, or under the current working directory when there is no script, as in a REPL or notebook.
 
 ### Internal and External Step Modes
 
```

**File**: `docs/source/yaml_config/configuration.md` (modified, +1/-1)
```diff
@@ -1386,7 +1386,7 @@ env.step(env.robot.vel_world2body(world_vel))
 
   **Options:**
   - `'position'`: Arrival is based solely on proximity to the goal position (`[x, y]`).
-  - `'state'`: Considers both position and orientation in the arrival check (`[x, y, theta]`).
+  - `'state'`: Considers both position and orientation in the arrival check (`[x, y, theta]`). The heading difference is wrapped to `[-pi, pi]`, and a goal given without `theta` is checked by position only.
 
   **Example:**
   ```yaml
```

**File**: `irsim/config/path_param.py` (modified, +19/-4)
```diff
@@ -1,11 +1,22 @@
 import os
 import sys
-from dataclasses import dataclass
+from dataclasses import dataclass, field
 from typing import cast
 
 import irsim
 
 
+def output_root() -> str:
+    """Directory the output folders are created under.
+
+    The folder of the running script when there is one, otherwise the current
+    working directory: under ``python -c``, a REPL or a notebook ``sys.path[0]``
+    is empty, and ``"" + "/figure"`` would point at the filesystem root.
+    """
+    base = sys.path[0] if sys.path else ""
+    return base if base else os.getcwd()
+
+
 @dataclass
 class PathManager:
     """
@@ -14,12 +25,16 @@ class PathManager:
         - ani_buffer_path: path of the animation buffer
         - ani_path: path of the animation
         - fig_path: path of the saved figure
+
+    The three output paths default to folders under :func:`output_root`.
     """
 
     root_path: str = os.path.dirname(cast(str, irsim.__file__))
-    ani_buffer_path: str = sys.path[0] + "/animation_buffer"
-    ani_path: str = sys.path[0] + "/animation"
-    fig_path: str = sys.path[0] + "/figure"
+    ani_buffer_path: str = field(
+        default_factory=lambda: output_root() + "/animation_buffer"
+    )
+    ani_path: str = field(default_factory=lambda: output_root() + "/animation")
+    fig_path: str = field(default_factory=lambda: output_root() + "/figure")
 
 
 # Multi-env storage (default index 0)
```

**File**: `irsim/env/env_base.py` (modified, +34/-11)
```diff
@@ -183,9 +183,9 @@ def __init__(
         if seed is not None:
             self._env_param.rng = np.random.default_rng(seed)
 
-        # headless builds no figure, so the process backend is left alone:
-        # switching it breaks the windows of other environments in this process
-        if not self.display and not self.headless:
+        # headless builds no figure, so the process backend is left alone.
+        # Offscreen rendering uses Agg, but switching the backend closes every open figure and freezes other environments' windows, so the switch happens only while no figure exists yet.
+        if not self.display and not self.headless and not plt.get_fignums():
             matplotlib.use("Agg")
 
         self.save_ani = save_ani
@@ -231,11 +231,7 @@ def __init__(
         self.mouse = None
         if self._env_plot is None:
             # No figure for keyboard/mouse control to attach to.
-            if self._world_param.control_mode == "keyboard":
-                self.logger.warning(
-                    "Keyboard control needs a figure; headless mode forces auto control."
-                )
-            self._world_param.control_mode = "auto"
+            self._fallback_to_auto()
         else:
             # Try to initialize keyboard control (pynput or MPL backend inside KeyboardControl)
             try:
@@ -246,7 +242,7 @@ def __init__(
                     f"Keyboard control unavailable error: {e}. Auto control applied. "
                     "Install 'pynput' or set backend='mpl' in YAML keyboard config."
                 )
-                self._world_param.control_mode = "auto"
+                self._fallback_to_auto()
 
             mouse_config = self.env_config.parse["gui"].get("mouse", {})
             self.mouse = MouseControl(self._env_plot.ax, **mouse_config)
@@ -313,6 +309,22 @@ def _check_ids_unique(self, objs: list[ObjectBase]) -> None:
                 "this environment."
             )
 
+    def _fallback_to_auto(self) -> None:
+        """Switch ``control_mode`` from ``keyboard`` to ``auto`` when no keyboard exists.
+
+        There is no keyboard in headless mode or when its initialisation
+        failed; in ``keyboard`` mode the first step would then dereference the
+        missing controller. ``World`` re-applies the YAML ``control_mode``
+        every time the scene is rebuilt (``reset(random=True)``, ``reload``),
+        so this runs after each rebuild as well as at construction.
+        """
+        if self.keyboard is None and self._world_param.control_mode == "keyboard":
+            self.logger.warning_once(
+                "Keyboard control needs a figure and a keyboard; auto control applied.",
+                key="control_mode:no_keyboard",
+            )
+            self._world_param.control_mode = "auto"
+
     def _wire_env_to_objects(self) -> None:
         """Set env reference on all objects for param access."""
         for obj in self._objects:
@@ -511,6 +523,7 @@ def _assign_keyboard_action(self, action: list[Any]) -> list[Any]:
 
         if (
             self._world_param.control_mode == "keyboard"
+            and self.keyboard is not None
             and self.key_id < len(action)
             and self.key_id < len(self.robot_list)
         ):
@@ -736,6 +749,8 @@ def end(self, ending_time: float = 3.0, **kwargs: Any) -> None:
         self.logger.info(
             f"Simulation Environment '{self._world.name}' ended. Total time {self._world.time:.2f} seconds."
         )
+        # This environment's console and file sinks go with it.
+        self._env_param.logger.close()
 
     def close(self, ending_time: float = 3.0, **kwargs: Any) -> None:
         """Alias for :py:meth:`end` for Gym-style API compatibility."""
@@ -1090,6 +1105,7 @@ def reload(self, world_name: str | None = None) -> None:
         # Sensors read the scene through env_param; take the first scan now so
         # a scan requested before the first step is not blank.
         self._objects_sensor_step()
+        self._fallback_to_auto()
         self.reload_flag = False
 
     def _rebuild_from_cached_parse(self) -> None:
@@ -1120,6 +1136,7 @@ def _rebuild_from_cached_parse(self) -> None:
         # Sensors read the scene through env_param; take the first scan now so
         # a scan requested before the first step is not blank.
         self._objects_sensor_step()
+        self._fallback_to_auto()
         self.set_status("Reset")
         self.pause_flag = False
         self.debug_flag = False
@@ -1753,17 +1770,23 @@ def key_vel(self) -> Any:
         """Get current keyboard velocity command.
 
         Returns:
-            Any: A 3x1 vector ``[[linear], [lateral], [angular]]`` from keyboard input.
+            Any: A 3x1 vector ``[[linear], [lateral], [angular]]`` from keyboard
+            input; zeros when the environment has no keyboard.
         """
+        if self.keyboard is None:
+            return np.zeros((3, 1))
         return self.keyboard.key_vel
 
```

**File**: `irsim/env/env_logger.py` (modified, +80/-19)
```diff
@@ -1,10 +1,31 @@
+import contextlib
+import itertools
 import sys
+import weakref
+from collections.abc import Callable
+from typing import Any
 
 from loguru import logger
 
 
 class EnvLogger:
-    """Thin wrapper around Loguru used by IR-SIM environments."""
+    """Thin wrapper around Loguru used by IR-SIM environments.
+
+    Each environment owns a console sink at its ``log_level`` and, when
+    ``log_file`` is given, a file sink. Its messages are tagged and its sinks
+    accept only that tag, so a second environment in the same process neither
+    replaces the first one's sinks nor receives its messages. Sinks added by
+    user code are left alone. ``close`` removes the sinks; garbage collection
+    does the same.
+    """
+
+    CONSOLE_FORMAT = (
+        "<green>{time:YYYY-MM-DD HH:mm}</green> | "
+        "<level>{level: <8}</level> | "
+        "<level>{message}</level>"
+    )
+    _tags = itertools.count()
+    _default_handler_dropped = False
 
     def __init__(
         self, log_file: str | None = "irsim_error.log", log_level: str = "WARNING"
@@ -16,19 +37,59 @@ def __init__(
             log_file (str, optional): Path to the log file. Default is 'irsim_error.log'.
             log_level (str, optional): Logging level. Default is 'WARNING'.
         """
-        logger.remove()
-        logger.add(
-            sys.stdout,
-            level=log_level,
-            format="<green>{time:YYYY-MM-DD HH:mm}</green> | "
-            "<level>{level: <8}</level> | "
-            "<level>{message}</level>",
+        self._drop_loguru_default_handler()
+        self._tag = next(self._tags)
+        self._logger = logger.bind(irsim_env=self._tag)
+        self._sink_ids = self._add_sinks(log_file, log_level)
+        self._finalizer = weakref.finalize(
+            self, self._remove_sinks, list(self._sink_ids)
         )
+        self._once_keys: set[str] = set()
+
+    @classmethod
+    def _drop_loguru_default_handler(cls) -> None:
+        """Remove loguru's own stderr handler once; every environment adds its own sinks."""
+        if cls._default_handler_dropped:
+            return
+        with contextlib.suppress(ValueError):
+            logger.remove(0)
+        cls._default_handler_dropped = True
+
+    @staticmethod
+    def _messages_of(tag: int) -> Callable[[Any], bool]:
+        """Sink filter accepting the messages of one environment.
+
+        Messages logged through a plain loguru logger carry no tag and are
+        accepted by every environment's sinks.
+        """
+
+        def accept(record: Any) -> bool:
+            return record["extra"].get("irsim_env", tag) == tag
+
+        return accept
 
+    def _add_sinks(self, log_file: str | None, log_level: str) -> list[int]:
+        """Add this environment's console sink and optional file sink."""
+        accept = self._messages_of(self._tag)
+        sink_ids = [
+            logger.add(
+                sys.stdout, level=log_level, format=self.CONSOLE_FORMAT, filter=accept
+            )
+        ]
         if log_file is not None:
-            logger.add(log_file, level=log_level)
+            sink_ids.append(logger.add(log_file, level=log_level, filter=accept))
+        return sink_ids
 
-        self._once_keys: set[str] = set()
+    @staticmethod
+    def _remove_sinks(sink_ids: list[int]) -> None:
+        for sink_id in sink_ids:
+            with contextlib.suppress(ValueError):
+                logger.remove(sink_id)
+
+    def close(self) -> None:
+        """Remove this environment's console and file sinks."""
+        self._finalizer()
+        self._sink_ids = []
 
     def trace(self, msg: str) -> None:
         """
@@ -37,7 +98,7 @@ def trace(self, msg: str) -> None:
         Args:
             msg (str): The message to log.
         """
-        logger.trace(msg)
+        self._logger.trace(msg)
 
     def info(self, msg: str) -> None:
         """
@@ -46,7 +107,7 @@ def info(self, msg: str) -> None:
         Args:
             msg (str): The message to log.
         """
-        logger.info(msg)
+        self._logger.info(msg)
 
     def error(self, msg: str) -> None:
         """
@@ -55,7 +116,7 @@ def error(self, msg: str) -> None:
         Args:
             msg (str): The message to log.
         """
-        logger.error(msg)
+        self._logger.error(msg)
 
     def debug(self, msg: str) -> None:
         """
@@ -64,7 +125,7 @@ def debug(self, msg: str) -> None:
         Args:
             msg (str): The message to log.
         """
-        logger.debug(msg)
+        self._logger.debug(msg)
 
     def warning(self, msg: str) -> None:
         """
@@ -73,7 +134,7 @@ def warning(self, msg: str) -> None:
         Args:
             msg (str): The message to log.
         """
-        logger.warning(msg)
+        self._logger.warning(msg)
 
     def warning_once(self, msg: str, key: str | None = None) -> None:
         """
@@ -87,11 +148,11 @@ def warning_once(self, msg: str, key: str | None = Non
```

**File**: `irsim/util/decorator.py` (modified, +1/-0)
```diff
@@ -129,6 +129,7 @@ def normalize_actions(func):
     are dropped with a warning; an unknown id or name raises.
     """
 
+    @functools.wraps(func)
     def wrapper(self, action=None, action_id=None, *args, **kwargs):
         objects = getattr(self, "objects", [])
         actions = [None] * len(objects)
```

---

### Incident Patch 2: `2bbe9208` (2026-10-03)
**Commit Message**: fix(sensor): keep lidar readings in band, scan at construction, and offer inf ranges on request (#379)

* fix(sensor): keep lidar readings in band, scan at construction, and offer inf ranges on request

Lidar noise applies to hit beams only and every range stays within
[range_min, range_max], so misses no longer turn into phantom returns and
close hits no longer go negative. range_min is applied: a return closer than
it is reported at range_min as a blocked but unmeasured beam. angle_std is
applied as direction jitter when set; its default is now 0 so existing noisy
scenes keep their beam directions. The FMCW sensor reports a near-range hit
at range_min and invalid instead of range_max, so fog is no longer cleared
through the object. Both lidars expose a per-beam valid mask. The ROS-style
LaserScan keeps the sensor's finite ranges by default; get_msg(use_inf=True)
maps beams without a usable return to +inf past range_max and -inf inside
range_min, as Gazebo publishes them under REP 117. Sensors are stepped once
when the scene is built, only robots reveal the fog map, and 2D lidar points
draw at z = 0 in the 3D environment. Example scenes set angle_std 0.01 rad.
Scans of every noise

**File**: `docs/locale/zh_CN/LC_MESSAGES/usage/configure_sensor.po` (modified, +11/-21)
```diff
@@ -95,8 +95,8 @@ msgstr ""
 "参数如下："
 
 #: ../../source/usage/configure_sensor.md:106
-msgid "**range_min**: The minimum range of the laser beam."
-msgstr "**range_min**：激光束的最小量程。"
+msgid "**range_min**: The minimum range of the laser beam. A return closer than this is reported at `range_min`: the beam counts as blocked but carries no measurement."
+msgstr "**range_min**：激光束的最小量程。比它更近的回波按 `range_min` 报告：该光束视为被遮挡，但不携带测量值。"
 
 #: ../../source/usage/configure_sensor.md:107
 msgid "**range_max**: The maximum range of the laser beam."
@@ -139,31 +139,16 @@ msgid "LiDAR scan with Gaussian noise"
 msgstr "带高斯噪声的 LiDAR 扫描"
 
 #: ../../source/usage/configure_sensor.md:194
-msgid ""
-"Gaussian noise is added to the LiDAR sensor with the `std` and `angle_std` "
-"parameters. The `std` parameter is the standard deviation of the range "
-"noise, and the `angle_std` parameter is the standard deviation of the angle "
-"noise."
-msgstr ""
-"通过 `std` 与 `angle_std` 参数为 LiDAR 添加高斯噪声。其中 `std` 为距离噪声的"
-"标准差，`angle_std` 为角度噪声的标准差。"
+msgid "Gaussian noise is added to the beams that hit something: `std` is the standard deviation of the range noise and `angle_std`, off at its default of `0`, that of each beam's direction. Noisy ranges stay within `[range_min, range_max]`, a hit pushed beyond `range_max` becomes a miss, and misses stay at `range_max` without noise."
+msgstr "高斯噪声只加在击中物体的光束上：`std` 是距离噪声的标准差，`angle_std`（默认 `0`，即关闭）是每条光束方向噪声的标准差。带噪声的距离保持在 `[range_min, range_max]` 内，被推到 `range_max` 之外的击中会变成未命中，未命中的光束保持 `range_max` 且不加噪声。"
 
 #: ../../source/usage/configure_sensor.md:196
 msgid "FMCW LiDAR Configuration Parameters"
 msgstr "FMCW 激光雷达配置参数"
 
 #: ../../source/usage/configure_sensor.md:198
-msgid ""
-"IR-SIM also provides a simplified 2D FMCW LiDAR sensor named `fmcw_lidar2d`. "
-"It keeps the same beam geometry as the standard 2D LiDAR, but each valid "
-"beam additionally reports a scalar `radial_velocity` measurement. This makes "
-"it useful for demonstrating how Doppler measurements can help interpret "
-"dynamic obstacles."
-msgstr ""
-"IR-SIM 还提供了一个简化的 2D FMCW 激光雷达传感器，名为 `fmcw_lidar2d`。它保持"
-"与标准 2D 激光雷达相同的光束几何结构，但每条有效光束会额外返回一个标量 "
-"`radial_velocity`（径向速度）测量值。这便于演示多普勒测量如何帮助理解动态障碍"
-"物。"
+msgid "IR-SIM also provides a simplified 2D FMCW LiDAR sensor named `fmcw_lidar2d`. It keeps the same beam geometry as the standard 2D LiDAR, but each valid beam additionally reports a scalar `radial_velocity` measurement. This makes it useful for demonstrating how Doppler measurements can help interpret dynamic obstacles. `valid` marks the beams whose range lies inside `[range_min, range_max]`; a return closer than `range_min` is reported at `range_min` and left invalid, so the beam still counts as blocked."
+msgstr "IR-SIM 还提供了一个简化的 2D FMCW 激光雷达传感器，名为 `fmcw_lidar2d`。它保持与标准 2D 激光雷达相同的光束几何结构，但每条有效光束会额外返回一个标量 `radial_velocity`（径向速度）测量值。这便于演示多普勒测量如何帮助理解动态障碍物。`valid` 标记距离位于 `[range_min, range_max]` 内的光束；比 `range_min` 更近的回波按 `range_min` 报告并保持无效，因此该光束仍视为被遮挡。"
 
 #: ../../source/usage/configure_sensor.md:200
 msgid ""
@@ -247,3 +232,8 @@ msgstr ""
 "下方的 YAML 配置与 Python 脚本展示了 FOV 中的对象示例。FOV 由对象配置中的 "
 "`fov`（角度）与 `fov_radius`（半径）参数定义。每个对象都拥有 FOV，可通过 "
 "`fov_detect_object()` 检测视场内的机器人。"
+
+#: ../../source/usage/configure_sensor.md:194
+msgid "**Range conventions.** A beam that hits nothing reads `range_max`, the value Isaac Sim's LaserScan bridge publishes as well, so `ranges` stays finite for learning pipelines. `get_scan()[\"valid\"]` marks the beams with a usable return: a hit whose range lies inside `[range_min, range_max]`. Misses and returns inside the blind zone are invalid, and the latter read `range_min` so the beam still counts as blocked; `get_points()` turns only valid beams into points. The ROS-style {py:class}`~irsim.msg.LaserScan` from `env.get_msg()` carries the same finite ranges by default, so snapshots used for learning are unchanged; `env.get_msg(use_inf=True)` follows REP 117 instead, as Gazebo does: `+inf` for no return and `-inf` for a return too close to measure."
+msgstr "**量程约定。** 未击中任何物体的光束读数为 `range_max`，这也是 Isaac Sim 的 LaserScan 桥接所发布的值，因此 `ranges` 对学习流水线始终是有限值。`get_scan()[\"valid\"]` 标记有可用回波的光束：距离位于 `[range_min, range_max]` 内的击中。未命中以及盲区内的回波为无效，后者读数为 `range_min`，因此该光束仍视为被遮挡；`get_points()` 只把有效光束转换为点。`env.get_msg()` 返回的 ROS 风格 {py:class}`~irsim.msg.LaserScan` 默认携带同样的有限距离，因此用于学习的快照不受影响；`env.get_msg(use_inf=True)` 则遵循 REP 117（与 Gazebo 一致）：无回波为 `+inf`，距离过近无法测量的回波为 `-inf`。"
+
```

**File**: `docs/locale/zh_CN/LC_MESSAGES/usage/make_environment.po` (modified, +2/-16)
```diff
@@ -389,22 +389,8 @@ msgstr ""
 "主读数的别名。"
 
 #: ../../source/usage/make_environment.md:177
-msgid ""
-"{py:class}`~irsim.msg.LaserScan` contains only the shared "
-"`sensor_msgs/LaserScan` data fields; when intensity data is unavailable, "
-"`intensities` is an empty array. Its angle metadata exactly reconstructs "
-"the simulated beam directions. Because IR-SIM evaluates all beams from one "
-"geometry snapshot, `time_increment` is zero; `scan_time` is the configured "
-"interval between scans. IR-SIM-specific measurements such as Cartesian "
-"target velocity, FMCW radial velocity, and validity remain available from "
-"`sensor.get_scan()` or `env.get_lidar_scan()`."
-msgstr ""
-"{py:class}`~irsim.msg.LaserScan` 仅包含共享的 `sensor_msgs/LaserScan` 数据"
-"字段；没有强度数据时，`intensities` 为空数组。其角度"
-"元数据能够精确重建仿真的光束方向。由于 IR-SIM 从同一个几何快照计算全部光束，"
-"`time_increment` 为零；`scan_time` 是配置的扫描间隔。笛卡尔目标速度、FMCW "
-"径向速度和有效性等 IR-SIM 专用测量仍可通过 `sensor.get_scan()` 或 "
-"`env.get_lidar_scan()` 获取。"
+msgid "{py:class}`~irsim.msg.LaserScan` contains only the shared `sensor_msgs/LaserScan` data fields; when intensity data is unavailable, `intensities` is an empty array. Its angle metadata describes the nominal beam directions; when angle noise is enabled, the actual cast directions are jittered. Because IR-SIM evaluates all beams from one geometry snapshot, `time_increment` is zero; `scan_time` is the configured interval between scans. IR-SIM-specific measurements such as Cartesian target velocity, FMCW radial velocity, and validity remain available from `sensor.get_scan()` or `env.get_lidar_scan()`. By default `ranges` are the sensor's own finite values, `range_max` for a miss, so snapshots used for learning are unchanged; `env.get_msg(use_inf=True)` maps beams without a usable return per REP 117, as Gazebo publishes them: `+inf` when nothing came back within `range_max` and `-inf` when the return was inside `range_min`."
+msgstr "{py:class}`~irsim.msg.LaserScan` 只包含共享的 `sensor_msgs/LaserScan` 数据字段；当没有强度数据时，`intensities` 为空数组。其角度元数据描述的是光束的标称方向；启用角度噪声时，实际投射方向会带有抖动。由于 IR-SIM 在同一几何快照上评估所有光束，`time_increment` 为零；`scan_time` 是配置的扫描间隔。IR-SIM 特有的测量值（如笛卡尔目标速度、FMCW 径向速度和有效性）仍可通过 `sensor.get_scan()` 或 `env.get_lidar_scan()` 获取。 默认情况下 `ranges` 是传感器自身的有限值（未命中为 `range_max`），因此用于学习的快照不受影响；`env.get_msg(use_inf=True)` 则按 REP 117（与 Gazebo 发布方式一致）映射没有可用回波的光束：在 `range_max` 内没有任何回波时为 `+inf`，回波位于 `range_min` 以内时为 `-inf`。"
 
 msgid ""
 "Odometry and scan messages use conventional `world`, `base_link`, and sensor "
```

**File**: `docs/locale/zh_CN/LC_MESSAGES/yaml_config/configuration.po` (modified, +6/-10)
```diff
@@ -1983,8 +1983,8 @@ msgid "`lidar2d`: 2D LiDAR sensor for distance measurements. Parameters include:
 msgstr "`lidar2d`：用于距离测量的 2D LiDAR，参数包括："
 
 #: ../../../../../../../Users/han/tech/ir-sim/docs/source/yaml_config/configuration.md:1246
-msgid "`range_min` (float/`0.0`): Minimum detection range."
-msgstr "`range_min`（float）：最小探测距离，默认 `0.0`。"
+msgid "`range_min` (float/`0.0`): Minimum detection range; a closer return is reported at this value."
+msgstr "`range_min`（float）：最小探测距离，默认 `0.0`；更近的回波按该值报告。"
 
 #: ../../../../../../../Users/han/tech/ir-sim/docs/source/yaml_config/configuration.md:1247
 msgid "`range_max` (float/`10.0`): Maximum detection range."
@@ -2011,16 +2011,12 @@ msgid "`noise` (bool/`False`): Whether noise is added to measurements."
 msgstr "`noise`（bool）：测量是否加入噪声，默认 `False`。"
 
 #: ../../../../../../../Users/han/tech/ir-sim/docs/source/yaml_config/configuration.md:1252
-msgid ""
-"`std` (float/`0.2`): Standard deviation for range noise if `noise` is "
-"`True`."
-msgstr "`std`（float）：当 `noise=True` 时距离噪声的标准差，默认 `0.2`。"
+msgid "`std` (float/`0.2`): Standard deviation for range noise on hit beams if `noise` is `True`; noisy ranges stay within `[range_min, range_max]`."
+msgstr "`std`（float）：当 `noise=True` 时击中光束的距离噪声标准差，默认 `0.2`；带噪声的距离保持在 `[range_min, range_max]` 内。"
 
 #: ../../../../../../../Users/han/tech/ir-sim/docs/source/yaml_config/configuration.md:1253
-msgid ""
-"`angle_std` (float/`0.02`): Standard deviation for angle noise if `noise`"
-" is `True`."
-msgstr "`angle_std`（float）：`noise=True` 时的角度噪声标准差，默认 `0.02`。"
+msgid "`angle_std` (float/`0.0`): Standard deviation of each beam's direction if `noise` is `True`; `0` keeps the directions exact."
+msgstr "`angle_std`（float）：`noise=True` 时每条光束方向的噪声标准差，默认 `0.0`；为 `0` 时方向保持精确。"
 
 #: ../../../../../../../Users/han/tech/ir-sim/docs/source/yaml_config/configuration.md:1254
 msgid ""
```

**File**: `docs/source/usage/configure_sensor.md` (modified, +7/-5)
```diff
@@ -56,7 +56,7 @@ robot:
         number: 200
         noise: False
         std: 0.2
-        angle_std: 0.2
+        angle_std: 0.01
         offset: [0.1, 0.1, 0.5]
         plot:
           alpha: 0.3
@@ -102,7 +102,7 @@ The environment updates sensors after all objects have moved in a step. This avo
 
 To configure the 2D LiDAR sensor, the sensor name of `lidar2d` should be defined in the `sensors` section of the robot. Key parameters of the LiDAR sensor are explained below:
 
-- **range_min**: The minimum range of the laser beam.
+- **range_min**: The minimum range of the laser beam. A return closer than this is reported at `range_min`: the beam counts as blocked but carries no measurement.
 - **range_max**: The maximum range of the laser beam.
 - **angle_range**: The angle range of the laser beam. Use `6.283185` or `2 * pi` in Python for a full 360-degree scan.
 - **number**: The number of beams.
@@ -166,7 +166,7 @@ robot:
         number: 200
         noise: True
         std: 0.1
-        angle_std: 0.2
+        angle_std: 0.01
         offset: [0, 0, 0]
         alpha: 0.3
       
@@ -189,11 +189,13 @@ obstacle:
 :::
 ::::
 
-Gaussian noise is added to the LiDAR sensor with the `std` and `angle_std` parameters. The `std` parameter is the standard deviation of the range noise, and the `angle_std` parameter is the standard deviation of the angle noise. 
+Gaussian noise is added to the beams that hit something: `std` is the standard deviation of the range noise and `angle_std`, off at its default of `0`, that of each beam's direction. Noisy ranges stay within `[range_min, range_max]`, a hit pushed beyond `range_max` becomes a miss, and misses stay at `range_max` without noise.
+
+**Range conventions.** A beam that hits nothing reads `range_max`, the value Isaac Sim's LaserScan bridge publishes as well, so `ranges` stays finite for learning pipelines. `get_scan()["valid"]` marks the beams with a usable return: a hit whose range lies inside `[range_min, range_max]`. Misses and returns inside the blind zone are invalid, and the latter read `range_min` so the beam still counts as blocked; `get_points()` turns only valid beams into points. The ROS-style {py:class}`~irsim.msg.LaserScan` from `env.get_msg()` carries the same finite ranges by default, so snapshots used for learning are unchanged; `env.get_msg(use_inf=True)` follows REP 117 instead, as Gazebo does: `+inf` for no return and `-inf` for a return too close to measure.
 
 ## FMCW LiDAR Configuration Parameters
 
-IR-SIM also provides a simplified 2D FMCW LiDAR sensor named `fmcw_lidar2d`. It keeps the same beam geometry as the standard 2D LiDAR, but each valid beam additionally reports a scalar `radial_velocity` measurement. This makes it useful for demonstrating how Doppler measurements can help interpret dynamic obstacles.
+IR-SIM also provides a simplified 2D FMCW LiDAR sensor named `fmcw_lidar2d`. It keeps the same beam geometry as the standard 2D LiDAR, but each valid beam additionally reports a scalar `radial_velocity` measurement. This makes it useful for demonstrating how Doppler measurements can help interpret dynamic obstacles. `valid` marks the beams whose range lies inside `[range_min, range_max]`; a return closer than `range_min` is reported at `range_min` and left invalid, so the beam still counts as blocked.
 
 The example below uses a stationary ego sensor with a forward 120-degree field of view and multiple moving obstacles. When plotting is enabled, valid returns are colorized by radial velocity and marked at their endpoints.
 
```

**File**: `docs/source/usage/make_environment.md` (modified, +1/-1)
```diff
@@ -231,7 +231,7 @@ payload = msg.to_dict()  # JSON-compatible lists and scalar values
 
 Message types expose a stable logical `ros_type` hint, for example `robot.odom.ros_type == "nav_msgs/Odometry"`. Its slash form is retained for compatibility and does not select ROS 1. The bridge chooses the native ROS 1 or ROS 2 class and converts IR-SIM's floating-point timestamp and sequence number to the corresponding Header layout. The `scans` list contains every LiDAR reading, and `scan` aliases its first item as the primary reading.
 
-{py:class}`~irsim.msg.LaserScan` contains only the shared `sensor_msgs/LaserScan` data fields; when intensity data is unavailable, `intensities` is an empty array. Its angle metadata exactly reconstructs the simulated beam directions. Because IR-SIM evaluates all beams from one geometry snapshot, `time_increment` is zero; `scan_time` is the configured interval between scans. IR-SIM-specific measurements such as Cartesian target velocity, FMCW radial velocity, and validity remain available from `sensor.get_scan()` or `env.get_lidar_scan()`.
+{py:class}`~irsim.msg.LaserScan` contains only the shared `sensor_msgs/LaserScan` data fields; when intensity data is unavailable, `intensities` is an empty array. Its angle metadata describes the nominal beam directions; when angle noise is enabled, the actual cast directions are jittered. Because IR-SIM evaluates all beams from one geometry snapshot, `time_increment` is zero; `scan_time` is the configured interval between scans. IR-SIM-specific measurements such as Cartesian target velocity, FMCW radial velocity, and validity remain available from `sensor.get_scan()` or `env.get_lidar_scan()`. By default `ranges` are the sensor's own finite values, `range_max` for a miss, so snapshots used for learning are unchanged; `env.get_msg(use_inf=True)` maps beams without a usable return per REP 117, as Gazebo publishes them: `+inf` when nothing came back within `range_max` and `-inf` when the return was inside `range_min`.
 
 Odometry and scan messages use conventional `world`, `base_link`, and sensor frame names. A ROS bridge remains responsible for publishing the corresponding `/tf`, `/tf_static`, and `/clock` messages.
 
```

**File**: `docs/source/yaml_config/configuration.md` (modified, +4/-4)
```diff
@@ -271,7 +271,7 @@ In a combined configuration for multiple simulators, these keys may be nested un
       <div class="yt-leaf"><a class="yt-key" href="#p-o-sensors">scan_time</a><span class="yt-type yt-t-num"><b class="yt-pill">float</b></span><span class="yt-def">0.1</span></div>
       <div class="yt-leaf"><a class="yt-key" href="#p-o-sensors">noise</a><span class="yt-type yt-t-bool"><b class="yt-pill">bool</b></span><span class="yt-def">false</span><span class="yt-desc">both variants</span></div>
       <div class="yt-leaf"><a class="yt-key" href="#p-o-sensors">std</a><span class="yt-type yt-t-num"><b class="yt-pill">float</b></span><span class="yt-def">0.2</span></div>
-      <div class="yt-leaf"><a class="yt-key" href="#p-o-sensors">angle_std</a><span class="yt-type yt-t-num"><b class="yt-pill">float</b></span><span class="yt-def">0.02</span></div>
+      <div class="yt-leaf"><a class="yt-key" href="#p-o-sensors">angle_std</a><span class="yt-type yt-t-num"><b class="yt-pill">float</b></span><span class="yt-def">0.0</span></div>
       <div class="yt-leaf"><a class="yt-key" href="#p-o-sensors">offset</a><span class="yt-type yt-t-list"><b class="yt-pill">list</b></span><span class="yt-def">[0, 0, 0]</span></div>
       <div class="yt-utabpanels">
         <div class="yt-utabpanel">
@@ -1292,14 +1292,14 @@ env.step(env.robot.vel_world2body(world_vel))
 **`sensors`**:
   Attaches sensors to the object for environmental perception. Each sensor is defined by a dictionary indicating its type and specific parameters. Currently supported sensor `name` (or `type`) include:
   - `lidar2d`: 2D LiDAR sensor for distance measurements. Parameters include:
-    - `range_min` (float/`0.0`): Minimum detection range.
+    - `range_min` (float/`0.0`): Minimum detection range; a closer return is reported at this value.
     - `range_max` (float/`10.0`): Maximum detection range.
     - `angle_range` (float/`pi`): Total angle range of the sensor, clipped to `[0, 2*pi]` (`6.283185` gives a full 360° scan).
     - `number` (int/`100`): Number of laser beams.
     - `scan_time` (float/`0.1`): Time taken for one complete scan.
     - `noise` (bool/`False`): Whether noise is added to measurements.
-    - `std` (float/`0.2`): Standard deviation for range noise if `noise` is `True`.
-    - `angle_std` (float/`0.02`): Standard deviation for angle noise if `noise` is `True`.
+    - `std` (float/`0.2`): Standard deviation for range noise on hit beams if `noise` is `True`; noisy ranges stay within `[range_min, range_max]`.
+    - `angle_std` (float/`0.0`): Standard deviation of each beam's direction if `noise` is `True`; `0` keeps the directions exact.
     - `offset` (list/`[0, 0, 0]`): Offset of the sensor from the object's position (x, y, theta).
     - `has_velocity` (bool/`False`): Whether measures the lidar point velocity.
 
```

**File**: `irsim/env/env_base.py` (modified, +18/-2)
```diff
@@ -222,6 +222,9 @@ def __init__(
 
         self.build_tree()
         self._env_param.objects = self._objects
+        # Sensors read the scene through env_param; take the first scan now so
+        # a scan requested before the first step is not blank.
+        self._objects_sensor_step()
         self.validate_unique_names()
 
         self.keyboard = None
@@ -1084,6 +1087,9 @@ def reload(self, world_name: str | None = None) -> None:
         self.build_tree()
         self.validate_unique_names()
         self._env_param.objects = self._objects
+        # Sensors read the scene through env_param; take the first scan now so
+        # a scan requested before the first step is not blank.
+        self._objects_sensor_step()
         self.reload_flag = False
 
     def _rebuild_from_cached_parse(self) -> None:
@@ -1111,6 +1117,9 @@ def _rebuild_from_cached_parse(self) -> None:
         self.build_tree()
         self.validate_unique_names()
         self._env_param.objects = self._objects
+        # Sensors read the scene through env_param; take the first scan now so
+        # a scan requested before the first step is not blank.
+        self._objects_sensor_step()
         self.set_status("Reset")
         self.pause_flag = False
         self.debug_flag = False
@@ -1259,13 +1268,20 @@ def get_robot_state(self) -> np.ndarray:
 
         return self.robot._state
 
-    def get_msg(self) -> WorldState:
+    def get_msg(self, use_inf: bool = False) -> WorldState:
         """Get a snapshot of the complete simulation environment.
 
         The returned message owns copies of all state and sensor arrays. It
         therefore remains a stable point-in-time record when the environment
         advances or its objects are modified later.
 
+        Args:
+            use_inf (bool): When True, each ``scan`` reports beams without a
+                usable return as ``+inf`` (nothing within ``range_max``) or
+                ``-inf`` (return inside ``range_min``), as ROS drivers and
+                Gazebo do under REP 117. The default keeps the sensor's finite
+                ranges, ``range_max`` for a miss.
+
         Returns:
             WorldState: Current world metadata with ``odom`` and
             ``scan`` messages for each object.
@@ -1280,7 +1296,7 @@ def get_msg(self) -> WorldState:
             array([...])
         """
 
-        return WorldState.from_env(self)
+        return WorldState.from_env(self, use_inf=use_inf)
 
     def receive_msg(
         self,
```

**File**: `irsim/msg/messages.py` (modified, +32/-5)
```diff
@@ -371,9 +371,25 @@ def from_sensor(
         stamp: float = 0.0,
         seq: int = 0,
         frame_id: str | None = None,
+        use_inf: bool = False,
     ) -> LaserScan:
-        """Capture a LiDAR sensor without sharing its mutable arrays."""
+        """Capture a LiDAR sensor without sharing its mutable arrays.
+
+        By default ``ranges`` are the sensor's own finite values, ``range_max``
+        for a miss, so snapshots used for learning are unchanged. With
+        ``use_inf=True`` a beam without a usable return becomes ``+inf`` when
+        nothing came back within ``range_max`` and ``-inf`` when the return
+        was too close to measure, as Gazebo publishes it under REP 117, so
+        ROS consumers read the scan as they would a real driver's.
+        """
         scan = sensor.get_scan()
+        ranges = _float32_array(scan["ranges"])
+        valid = scan.get("valid")
+        if use_inf and valid is not None and np.size(valid) == ranges.size:
+            invalid = ~np.asarray(valid, dtype=bool).reshape(-1)
+            lost = invalid & (ranges >= np.float32(scan["range_max"]))
+            ranges[lost] = np.inf
+            ranges[invalid & ~lost] = -np.inf
         return cls(
             header=Header(
                 seq=int(seq),
@@ -387,7 +403,7 @@ def from_sensor(
             scan_time=float(scan["scan_time"]),
             range_min=float(scan["range_min"]),
             range_max=float(scan["range_max"]),
-            ranges=_float32_array(scan["ranges"]),
+            ranges=ranges,
             intensities=_float32_array(scan.get("intensities")),
         )
 
@@ -419,8 +435,12 @@ def from_object(
         stamp: float = 0.0,
         seq: int = 0,
         frame_id: str = "world",
+        use_inf: bool = False,
     ) -> ObjectState:
-        """Capture an object as conventional ``odom`` and ``scan`` topics."""
+        """Capture an object as conventional ``odom`` and ``scan`` topics.
+
+        ``use_inf`` is passed to :meth:`LaserScan.from_sensor`.
+        """
         lidar_sensors = [
             sensor
             for sensor in obj.sensors
@@ -434,6 +454,7 @@ def from_object(
                 frame_id=(
                     f"{obj.name}/laser" if index == 0 else f"{obj.name}/laser_{index}"
                 ),
+                use_inf=use_inf,
             )
             for index, sensor in enumerate(lidar_sensors)
         ]
@@ -476,8 +497,13 @@ class WorldState(Message):
     objects: list[ObjectState] = field(default_factory=list)
 
     @classmethod
-    def from_env(cls, env: Any, frame_id: str = "world") -> WorldState:
-        """Capture the current state and sensor data from an environment."""
+    def from_env(
+        cls, env: Any, frame_id: str = "world", use_inf: bool = False
+    ) -> WorldState:
+        """Capture the current state and sensor data from an environment.
+
+        ``use_inf`` is passed to every :meth:`LaserScan.from_sensor`.
+        """
         seq = int(env.world_param.count)
         stamp = float(env.time)
         return cls(
@@ -491,6 +517,7 @@ def from_env(cls, env: Any, frame_id: str = "world") -> WorldState:
                     stamp=stamp,
                     seq=seq,
                     frame_id=frame_id,
+                    use_inf=use_inf,
                 )
                 for obj in env.objects
             ],
```

---

### Incident Patch 3: `8dbd7080` (2026-10-03)
**Commit Message**: fix(behavior): correct reactive velocity commands for rvo, sfm and orca (#378)

* fix(behavior): correct reactive velocity commands for rvo, sfm and orca

RVO built the wrong cone whenever the robot stood still, and crashed when the current speed was more than acce above the limit. Diff and acker robots aimed off their goal line under rvo and sfm because the desired velocity scaled y by the angular limit. ORCA held omni members at 1 m/s. Each has a regression test.

* docs(behavior): describe the corrected rvo, sfm and orca velocity behavior

State how RVO samples candidates within acce and clips them to the limits, that neighbours are discs carrying their velocity whether the robot moves or rests, that ORCA members head for their goal at the agent's speed cap, and that reactive behaviors use the translational limit for diff and acker. Chinese catalogs updated for the extractable entries.

* fix(behavior): keep the static rvo neighbour form and a realizable orca speed

RVO cone builders accept the static neighbour form [x, y, r] again, told apart by length rather than by the ego velocity. ORCA caps each agent at the fastest speed it can hold in every direction: the smaller vel_max 

**File**: `docs/locale/zh_CN/LC_MESSAGES/usage/configure_behavior.po` (modified, +8/-23)
```diff
@@ -174,8 +174,8 @@ msgid ""
 msgstr "**`vxmax`/`vymax`：** x/y 方向最大速度（默认 `1.5`）"
 
 #: ../../source/usage/configure_behavior.md:97
-msgid "**`acce`:** Maximum acceleration (default: `1.0`)"
-msgstr "**`acce`：** 最大加速度（默认 `1.0`）"
+msgid "**`acce`:** Maximum change of velocity per step (default: `1.0`). Candidates are sampled within `acce` of the current velocity and clipped to `vxmax`/`vymax`; a velocity already beyond those limits brakes to the nearest admissible value"
+msgstr "**`acce`：** 每步速度的最大变化量（默认 `1.0`）。候选速度在当前速度 ± `acce` 内采样，并裁剪到 `vxmax`/`vymax`；已超出限幅的速度会减速到最近的可行值"
 
 #: ../../source/usage/configure_behavior.md:98
 msgid ""
@@ -346,12 +346,8 @@ msgstr ""
 "智能体无需额外配置即可绕开墙体或折线："
 
 #: ../../source/usage/configure_behavior.md:244
-msgid ""
-"This works for both `omni` and `diff` kinematics; non-`linestring` obstacles "
-"continue to participate as agent neighbors."
-msgstr ""
-"该机制对 `omni` 与 `diff` 机动学都生效；非 `linestring` 障碍物仍按邻居智能体"
-"参与计算。"
+msgid "This works for both `omni` and `diff` kinematics; non-`linestring` obstacles continue to participate as agent neighbors. A neighbor is a disc carrying its current velocity, zero when it is stopped, and the cones are the same whether the robot itself is moving or at rest."
+msgstr "该机制对 `omni` 与 `diff` 机动学都生效；非 `linestring` 障碍物仍按邻居智能体参与计算。邻居是带有自身当前速度的圆盘（静止时速度为零），无论机器人本身在运动还是静止，构造的速度锥都相同。"
 
 #: ../../source/usage/configure_behavior.md:247
 msgid "Group Behavior"
@@ -447,19 +443,8 @@ msgstr ""
 "有数百个智能体，也能确保平滑无碰撞的导航。"
 
 #: ../../source/usage/configure_behavior.md:264
-msgid ""
-"ORCA supports both `omni` and `diff` kinematics. It plans a holonomic "
-"velocity `(vx, vy)` for every member: `omni` robots use it directly, while "
-"`diff` robots map it to a `(linear, angular)` command, so a differential-"
-"drive robot turns toward the planned direction and slows down when it is not "
-"yet aligned. Set `kinematics: {name: 'diff'}` on the group to use the "
-"differential-drive variant; all ORCA parameters below stay the same."
-msgstr ""
-"ORCA 同时支持 `omni` 和 `diff` 运动学模型。它为每个成员规划一个完整（全向）速"
-"度 `(vx, vy)`：`omni` 机器人直接使用该速度，而 `diff` 机器人会将其映射为 `(线"
-"速度, 角速度)` 指令，因此差速机器人会朝规划方向转向，并在尚未对准时减速。在群"
-"组上设置 `kinematics: {name: 'diff'}` 即可使用差速变体；下方的所有 ORCA 参数"
-"保持不变。"
+msgid "ORCA supports both `omni` and `diff` kinematics. It plans a holonomic velocity `(vx, vy)` for every member: `omni` robots use it directly, while `diff` robots map it to a `(linear, angular)` command, so a differential-drive robot turns toward the planned direction and slows down when it is not yet aligned. Set `kinematics: {name: 'diff'}` on the group to use the differential-drive variant; all ORCA parameters below stay the same. Each member's preferred velocity points at its goal at the agent's speed cap: the fastest speed the member can hold in every direction (the smaller component of `vel_max` for `omni`, the linear limit for `diff`), lowered to `maxSpeed` when that is set, so members cruise at full speed when nothing is in the way."
+msgstr "ORCA 同时支持 `omni` 和 `diff` 运动学模型。它为每个成员规划一个完整（全向）速度 `(vx, vy)`：`omni` 机器人直接使用该速度，而 `diff` 机器人会将其映射为 `(线速度, 角速度)` 指令，因此差速机器人会朝规划方向转向，并在尚未对准时减速。在群组上设置 `kinematics: {name: 'diff'}` 即可使用差速变体；下方的所有 ORCA 参数保持不变。每个成员的期望速度指向其目标，大小为该智能体的速度上限：成员在任意方向都能保持的最高速度（`omni` 取 `vel_max` 中较小的分量，`diff` 取线速度限幅），若设置了 `maxSpeed` 则再降到该值，因此在无遮挡时成员以全速行进。"
 
 #: ../../source/usage/configure_behavior.md:267
 msgid ""
@@ -590,8 +575,8 @@ msgid "`None`"
 msgstr "无"
 
 #: ../../source/usage/configure_behavior.md:333
-msgid "Maximum speed override (uses robot's `max_speed` if not set)"
-msgstr "最大速度覆盖值（未设置时使用机器人的 `max_speed`）"
+msgid "Speed cap of each agent and the speed it heads for its goal at; never above the fastest speed the robot can hold in every direction (smaller `vel_max` component for `omni`, linear limit for `diff`), which is the default"
+msgstr "每个智能体的速度上限，也是其朝目标行进的速度；不超过机器人在任意方向都能保持的最高速度（`omni` 取 `vel_max` 中较小的分量，`diff` 取线速度限幅），默认即为该速度"
 
 #: ../../source/usage/configure_behavior.md:333
 msgid "`wander`"
```

**File**: `docs/locale/zh_CN/LC_MESSAGES/yaml_config/configuration.po` (modified, +2/-4)
```diff
@@ -1936,10 +1936,8 @@ msgid "`safe_radius` (float/`0.1`): Additional safety radius padding."
 msgstr "`safe_radius`（float/`0.1`）：额外的安全半径填充。"
 
 #: ../../../../../../../Users/han/tech/ir-sim/docs/source/yaml_config/configuration.md:1208
-msgid ""
-"`maxSpeed` (float/`None`): Max speed for the agents. If `None`, uses the "
-"object's `vel_max`."
-msgstr "`maxSpeed`（float/`None`）：智能体最大速度。若为 `None`，使用对象的 `vel_max`。"
+msgid "`maxSpeed` (float/`None`): Speed cap of the agents; members head for their goals at this speed. It is never above the fastest speed a member can hold in every direction (the smaller `vel_max` component for `omni`, the linear limit for `diff`), which is also the default when `None`."
+msgstr "`maxSpeed`（float/`None`）：智能体的速度上限，成员以该速度朝目标行进。它不会超过成员在任意方向都能保持的最高速度（`omni` 取 `vel_max` 中较小的分量，`diff` 取线速度限幅），`None` 时即采用该速度。"
 
 #: ../../../../../../../Users/han/tech/ir-sim/docs/source/yaml_config/configuration.md:1222
 msgid ""
```

**File**: `docs/source/usage/configure_behavior.md` (modified, +4/-4)
```diff
@@ -93,7 +93,7 @@ robot:
 
 **RVO-specific Parameters:**
 - **`vxmax`/`vymax`:** Maximum velocities in x/y directions (default: `1.5`)
-- **`acce`:** Maximum acceleration (default: `1.0`)
+- **`acce`:** Maximum change of velocity per step (default: `1.0`). Candidates are sampled within `acce` of the current velocity and clipped to `vxmax`/`vymax`; a velocity already beyond those limits brakes to the nearest admissible value
 - **`factor`:** Collision penalty weight (default: `1.0`, higher = more conservative)
 - **`mode`:** Algorithm variant - `'rvo'` (default), `'hrvo'`, or `'vo'`
 - **`neighbor_threshold`:** Detection range for nearby objects (default: `3.0` meters)
@@ -237,7 +237,7 @@ obstacle:
   - shape: {name: 'linestring', vertices: [[2, 2], [2, 8], [8, 8]]}
 ```
 
-This works for both `omni` and `diff` kinematics; non-`linestring` obstacles continue to participate as agent neighbors.
+This works for both `omni` and `diff` kinematics; non-`linestring` obstacles continue to participate as agent neighbors. A neighbor is a disc carrying its current velocity, zero when it is stopped, and the cones are the same whether the robot itself is moving or at rest.
 
 
 ## Group Behavior
@@ -257,7 +257,7 @@ While `behavior` controls individual object movement, **`group_behavior`** enabl
 
 ORCA is a classical built-in group-level collision avoidance algorithm that computes optimal velocities for multiple agents simultaneously. It ensures smooth, collision-free navigation even with hundreds of agents.
 
-ORCA supports both `omni` and `diff` kinematics. It plans a holonomic velocity `(vx, vy)` for every member: `omni` robots use it directly, while `diff` robots map it to a `(linear, angular)` command, so a differential-drive robot turns toward the planned direction and slows down when it is not yet aligned. Set `kinematics: {name: 'diff'}` on the group to use the differential-drive variant; all ORCA parameters below stay the same.
+ORCA supports both `omni` and `diff` kinematics. It plans a holonomic velocity `(vx, vy)` for every member: `omni` robots use it directly, while `diff` robots map it to a `(linear, angular)` command, so a differential-drive robot turns toward the planned direction and slows down when it is not yet aligned. Set `kinematics: {name: 'diff'}` on the group to use the differential-drive variant; all ORCA parameters below stay the same. Each member's preferred velocity points at its goal at the agent's speed cap: the fastest speed the member can hold in every direction (the smaller component of `vel_max` for `omni`, the linear limit for `diff`), lowered to `maxSpeed` when that is set, so members cruise at full speed when nothing is in the way.
 
 :::{note}
 ORCA requires the `pyrvo` library, which is a python binding for the ORCA C++ algorithm. Install it using:
@@ -343,7 +343,7 @@ robot:
 | `timeHorizon` | `float` | `20.0` | Time horizon for agent-agent collision avoidance (seconds) |
 | `timeHorizonObst` | `float` | `10.0` | Time horizon for agent-obstacle collision avoidance (seconds) |
 | `safe_radius` | `float` | `0.1` | Additional safety margin added to agent radius |
-| `maxSpeed` | `float` | `None` | Maximum speed override (uses robot's `max_speed` if not set) |
+| `maxSpeed` | `float` | `None` | Speed cap of each agent and the speed it heads for its goal at; never above the fastest speed the robot can hold in every direction (smaller `vel_max` component for `omni`, linear limit for `diff`), which is the default |
 | `wander` | `bool` | `False` | Generate random goals when current goal is reached |
 | `loop` | `bool` | `False` | Loop through waypoints continuously when reaching the last goal |
 | `range_low` | `list` | - | Lower bounds for random goal generation `[x, y, theta]` |
```

**File**: `docs/source/yaml_config/configuration.md` (modified, +2/-2)
```diff
@@ -1045,7 +1045,7 @@ env.step(env.robot.vel_world2body(world_vel))
 
 (p-o-vel-min)=
 **`vel_min`** (`list` of `float`, default: `[-1, -1]`) and **`vel_max`** (`list` of `float`, default: `[1, 1]`)
-: Set the minimum and maximum velocity limits for each control dimension (e.g., linear and angular velocities). These constraints ensure the object's motion stays within feasible and safe bounds.
+: Set the minimum and maximum velocity limits for each control dimension (e.g., linear and angular velocities). These constraints ensure the object's motion stays within feasible and safe bounds. For `diff` and `acker` the second entry is an angular or steering limit; reactive behaviors (`rvo`, `sfm`, `orca`) head for the goal at the first, translational, limit.
 
 (p-o-acce)=
 **`acce`** (`list` of `float`, default: `[inf, inf]`)
@@ -1236,7 +1236,7 @@ env.step(env.robot.vel_world2body(world_vel))
     - `timeHorizon` (float/`20.0`): Time horizon for computing safe velocities with respect to other agents.
     - `timeHorizonObst` (float/`10.0`): Time horizon for computing safe velocities with respect to static obstacles.
     - `safe_radius` (float/`0.1`): Additional safety radius padding.
-    - `maxSpeed` (float/`None`): Max speed for the agents. If `None`, uses the object's `vel_max`.
+    - `maxSpeed` (float/`None`): Speed cap of the agents; members head for their goals at this speed. It is never above the fastest speed a member can hold in every direction (the smaller `vel_max` component for `omni`, the linear limit for `diff`), which is also the default when `None`.
 
     **Example:**
     ```yaml
```

**File**: `irsim/lib/algorithm/rvo.py` (modified, +64/-107)
```diff
@@ -118,6 +118,20 @@ def _cone_angles(
 
         return angle_mr + half_angle, angle_mr - half_angle, half_angle
 
+    @staticmethod
+    def _neighbour_state(obstacle):
+        """Unpack a neighbour as ``(x, y, vx, vy, r)``.
+
+        Accepts the moving form ``[x, y, vx, vy, r]`` and the static form
+        ``[x, y, r]``, which is a neighbour with zero velocity. The layout is
+        told from the length of ``obstacle``; the ego's own velocity plays no
+        part in it.
+        """
+        if len(obstacle) == 3:
+            x, y, r = obstacle
+            return x, y, 0.0, 0.0, r
+        return obstacle[0], obstacle[1], obstacle[2], obstacle[3], obstacle[4]
+
     def config_rvo(self):
         """Build reciprocal velocity-obstacle cones for all obstacles."""
         rvo_list = []
@@ -134,8 +148,8 @@ def config_rvo_mode(self, obstacle):
         """Build one RVO cone for a circular obstacle.
 
         Args:
-            obstacle: Moving obstacle state ``[x, y, vx, vy, radius]`` or
-                static circular obstacle state ``[x, y, radius]``.
+            obstacle: Neighbour state ``[x, y, vx, vy, radius]``, or the
+                static form ``[x, y, radius]`` (zero velocity).
 
         Returns:
             list: ``[apex, left_vector, right_vector]`` cone description.
@@ -146,28 +160,10 @@ def config_rvo_mode(self, obstacle):
         vy = self.state[3]
         r = self.state[4]
 
-        mode = "sta_circular" if vx == 0 and vy == 0 else "moving"
-
-        if mode == "moving":
-            mx = obstacle[0]
-            my = obstacle[1]
-            mvx = obstacle[2]
-            mvy = obstacle[3]
-            mr = obstacle[4]
-
-            rvo_apex = [(vx + mvx) / 2, (vy + mvy) / 2]
-
-        elif mode == "sta_circular":
-            mx = obstacle[0]
-            my = obstacle[1]
-            mvx = 0
-            mvy = 0
-            mr = obstacle[2] + 0.2
-
-            vo_apex = [mvx, mvy]
-            rvo_apex = vo_apex  # vo
-        else:  # pragma: no cover - unreachable; mode is "moving" or "sta_circular"
-            log_error("wrong rvo mode")
+        # A static neighbour is one with zero velocity; the reciprocal apex
+        # handles it without a special case.
+        mx, my, mvx, mvy, mr = self._neighbour_state(obstacle)
+        rvo_apex = [(vx + mvx) / 2, (vy + mvy) / 2]
 
         line_left_ori, line_right_ori, _ = self._cone_angles(x, y, r, mx, my, mr)
         line_left_vector = [cos(line_left_ori), sin(line_left_ori)]
@@ -192,37 +188,19 @@ def config_hrvo_mode(self, obstacle):
         """Build one HRVO cone for a circular obstacle.
 
         Args:
-            obstacle: Moving obstacle state ``[x, y, vx, vy, radius]`` or
-                static circular obstacle state ``[x, y, radius]``.
+            obstacle: Neighbour state ``[x, y, vx, vy, radius]``, or the
+                static form ``[x, y, radius]`` (zero velocity).
 
         Returns:
-            list | None: ``[apex, left_vector, right_vector]`` cone description.
+            list: ``[apex, left_vector, right_vector]`` cone description.
         """
         x = self.state[0]
         y = self.state[1]
         vx = self.state[2]
         vy = self.state[3]
         r = self.state[4]
 
-        mode = "sta_circular" if vx == 0 and vy == 0 else "moving"
-
-        if mode == "moving":
-            mx = obstacle[0]
-            my = obstacle[1]
-            mvx = obstacle[2]
-            mvy = obstacle[3]
-            mr = obstacle[4]
-
-        elif mode == "sta_circular":
-            mx = obstacle[0]
-            my = obstacle[1]
-            mvx = 0
-            mvy = 0
-            mr = obstacle[2] + 0.2
-
-        else:  # pragma: no cover - unreachable; mode is "moving" or "sta_circular"
-            log_error("wrong hrvo mode")
-
+        mx, my, mvx, mvy, mr = self._neighbour_state(obstacle)
         rvo_apex = [(vx + mvx) / 2, (vy + mvy) / 2]
         vo_apex = [mvx, mvy]
 
@@ -232,39 +210,34 @@ def config_hrvo_mode(self, obstacle):
         line_left_vector = [cos(line_left_ori), sin(line_left_ori)]
         line_right_vector = [cos(line_right_ori), sin(line_right_ori)]
 
-        if mode == "moving":
-            cl_vector = [mx - x, my - y]
+        cl_vector = [mx - x, my - y]
 
-            cur_v = [vx - rvo_apex[0], vy - rvo_apex[1]]
+        cur_v = [vx - rvo_apex[0], vy - rvo_apex[1]]
 
-            dis_rv = dist_hypot(rvo_apex[0], rvo_apex[1], vo_apex[0], vo_apex[1])
-            radians_rv = atan2(rvo_apex[1] - vo_apex[1], rvo_apex[0] - vo_apex[0])
+        dis_rv = dist_hypot(rvo_apex[0], rvo_apex[1], vo_apex[0], vo_apex[1])
+        radians_rv = atan2(rvo_apex[1] - vo_apex[1], rvo_apex[0] - vo_apex[0])
 
-            diff = line_left_ori - radians_rv
+        diff = line_left_ori - radians_rv
 
-            temp = pi - 2 * half_angle
+        temp = pi - 2 * half_angle
 
-            if temp == 0:
-                temp = temp + 0.01
+        if temp == 0:
+            temp =
```

**File**: `irsim/lib/behavior/group_behavior_methods.py` (modified, +36/-11)
```diff
@@ -83,11 +83,7 @@ def _build_sim(self, members: list[ObjectBase], **kwargs: Any):
         sim.set_time_step(step_time)
 
         for member in members:
-            agent_max_speed = (
-                float(self._maxSpeed)
-                if self._maxSpeed is not None
-                else member.max_speed
-            )
+            agent_max_speed = self._agent_speed(member)
             sim.add_agent(
                 member.state[:2, 0].tolist(),
                 self._neighborDist,
@@ -100,21 +96,50 @@ def _build_sim(self, members: list[ObjectBase], **kwargs: Any):
 
         return sim
 
+    @staticmethod
+    def _realizable_speed(member: ObjectBase) -> float:
+        """Fastest speed ``member`` can hold in every direction.
+
+        ``max_speed`` of an ``omni`` member is the norm of its component
+        limits, which is reachable only on the diagonal; a plan above the
+        smaller component would be clipped per component on execution and
+        leave ORCA's collision-free direction. ``diff`` members are bounded by
+        their linear limit, which ``max_speed`` already is.
+        """
+        if member.kinematics in ("omni", "omni_angular"):
+            return float(np.min(np.asarray(member.vel_max, dtype=float)[:2, 0]))
+        return float(member.max_speed)
+
+    def _agent_speed(self, member: ObjectBase) -> float:
+        """Speed cap of one agent: its realizable speed, lowered to ``maxSpeed``."""
+        realizable = self._realizable_speed(member)
+        if self._maxSpeed is not None:
+            return min(float(self._maxSpeed), realizable)
+        return realizable
+
     def _pref_velocity(self, member: ObjectBase) -> list[float]:
         """ORCA preferred velocity for one member as world-frame ``[vx, vy]``.
 
-        ``diff`` ``vel_max`` is ``[linear, angular]``, so the raw desired omni
-        velocity would skew the preferred direction toward the x-axis. Build it
-        from the true goal bearing scaled by the translational speed limit
-        instead; ``omni`` members keep using the desired omni velocity.
+        The direction is the goal bearing and the magnitude the agent's speed
+        cap (:meth:`_agent_speed`), the same cap the simulator enforces, so
+        members head for their goals at full speed when nothing blocks them
+        and the plan stays within what the member can execute. ``diff``
+        members take the bearing from the goal directly; ``omni`` members take
+        it from the desired omni velocity, whose magnitude is discarded (it
+        used to be clipped to 1 m/s, which held omni members at that speed).
         """
+        speed = self._agent_speed(member)
         if self._kinematics == "diff":
             if member.goal is None:
                 return [0.0, 0.0]
             _, radian = relative_position(member.state, member.goal)
-            speed = member.max_speed
             return [speed * cos(radian), speed * sin(radian)]
-        return member.get_desired_omni_vel(normalized=True).flatten().tolist()
+
+        vx, vy = member.get_desired_omni_vel().flatten()[:2]
+        norm = float(np.hypot(vx, vy))
+        if norm < 1e-9:
+            return [0.0, 0.0]
+        return [speed * vx / norm, speed * vy / norm]
 
     def _to_action(self, member: ObjectBase, vel_xy: tuple[float, float]) -> np.ndarray:
         """Convert an ORCA world-frame velocity into a member control input.
```

**File**: `irsim/world/object_base.py` (modified, +19/-15)
```diff
@@ -1468,8 +1468,9 @@ def get_desired_omni_vel(self, goal_threshold=0.1, normalized=False) -> np.ndarr
         dis, radian = relative_position(self.state, self.goal)
 
         if dis > goal_threshold:
-            vx = self.vel_max[0, 0] * cos(radian)
-            vy = self.vel_max[1, 0] * sin(radian)
+            speed_x, speed_y = self._desired_speed_bounds()
+            vx = speed_x * cos(radian)
+            vy = speed_y * sin(radian)
         else:
             vx = 0
             vy = 0
@@ -1483,6 +1484,21 @@ def get_desired_omni_vel(self, goal_threshold=0.1, normalized=False) -> np.ndarr
 
         return np.array([[vx], [vy]])
 
+    def _desired_speed_bounds(self) -> tuple[float, float]:
+        """Speed bounds along the world x and y axes for the desired velocity.
+
+        ``vel_max`` is laid out per kinematics: ``omni`` and ``omni_angular``
+        bound two translational components, while ``diff`` and ``acker`` bound
+        a translational speed and an angular or steering rate. For the latter
+        the translational bound applies to both axes; scaling the y component
+        by the angular limit would skew the desired direction away from the
+        goal bearing.
+        """
+        speed_x = float(self.vel_max[0, 0])
+        if self.kinematics in ("diff", "acker"):
+            return speed_x, speed_x
+        return speed_x, float(self.vel_max[1, 0])
+
     @property
     def name(self) -> str:
         """
@@ -1911,19 +1927,7 @@ def desired_omni_vel(self, goal_threshold=0.1):
             np.ndarray: Desired velocity [vx, vy].
         """
 
-        if self.goal is None:
-            return np.zeros((2, 1))
-
-        dis, radian = relative_position(self.state, self.goal)
-
-        if dis > goal_threshold:
-            vx = self.vel_max[0, 0] * cos(radian)
-            vy = self.vel_max[1, 0] * sin(radian)
-        else:
-            vx = 0
-            vy = 0
-
-        return np.array([[vx], [vy]])
+        return self.get_desired_omni_vel(goal_threshold)
 
     @property
     def rvo_neighbors(self):
```

**File**: `tests/test_behaviors.py` (modified, +41/-1)
```diff
@@ -679,6 +679,7 @@ def test_orca_ensure_pyrvo_import_error(self):
             member.state = np.array([[0], [0]])
             member.radius = 0.5
             member.max_speed = 1.0
+            member.vel_max = np.array([[1.0], [1.0]])
 
             with pytest.raises(ImportError, match="pyrvo"):
                 OrcaGroupBehavior([member])
@@ -694,6 +695,7 @@ def make_member(x, y, vx, vy):
             m.state = np.array([[x], [y], [0.0]])
             m.radius = 0.5
             m.max_speed = 1.0
+            m.vel_max = np.array([[1.0], [1.0]])
             m.get_desired_omni_vel = Mock(return_value=np.array([[vx], [vy]]))
             m._world_param = Mock()
             m._world_param.step_time = 0.1
@@ -740,6 +742,41 @@ def make_member(theta):
         assert result[0][0, 0] == pytest.approx(0.0, abs=1e-6)
         assert abs(result[0][1, 0]) > 0.0
 
+    def test_orca_omni_pref_velocity_uses_speed_cap(self):
+        """omni members head for the goal at their speed cap, not at 1 m/s, and
+        the cap is a speed the member can hold in every direction."""
+        pytest.importorskip("pyrvo")
+        from irsim.lib.behavior.group_behavior_methods import OrcaGroupBehavior
+
+        member = Mock(spec=ObjectBase)
+        member.kinematics = "omni"
+        member.state = np.array([[0.0], [0.0], [0.0]])
+        member.radius = 0.2
+        member.vel_max = np.array([[3.0], [3.0]])
+        member.max_speed = float(np.hypot(3.0, 3.0))  # the L2 norm, as omni reports
+        member.get_desired_omni_vel = Mock(return_value=np.array([[3.0], [0.0]]))
+        member._world_param = Mock()
+        member._world_param.step_time = 0.1
+
+        # the smaller component, not the 4.24 norm, so no component is clipped
+        assert OrcaGroupBehavior([member])._pref_velocity(member) == pytest.approx(
+            [3.0, 0.0]
+        )
+        assert OrcaGroupBehavior([member], maxSpeed=2.0)._pref_velocity(
+            member
+        ) == pytest.approx([2.0, 0.0])
+        # a maxSpeed above what the member can execute is lowered to it
+        assert OrcaGroupBehavior([member], maxSpeed=5.0)._pref_velocity(
+            member
+        ) == pytest.approx([3.0, 0.0])
+        member.vel_max = np.array([[3.0], [1.0]])
+        assert OrcaGroupBehavior([member])._pref_velocity(member) == pytest.approx(
+            [1.0, 0.0]
+        )
+
+        member.get_desired_omni_vel = Mock(return_value=np.zeros((2, 1)))
+        assert OrcaGroupBehavior([member])._pref_velocity(member) == [0.0, 0.0]
+
     def test_orca_diff_zero_when_no_goal(self):
         """diff preferred velocity is zero when a member has no goal."""
         pytest.importorskip("pyrvo")
@@ -935,6 +972,7 @@ def test_orca_rotates_world_velocity_into_the_body_frame(self):
         member.state = np.array([[0.0], [0.0], [np.pi]])
         member.radius = 0.5
         member.max_speed = 1.0
+        member.vel_max = np.array([[1.0], [1.0]])
         member.get_desired_omni_vel = Mock(return_value=np.array([[1.0], [0.0]]))
         member._world_param = Mock()
         member._world_param.step_time = 0.1
@@ -1129,9 +1167,11 @@ def _fresh_orca_module(self):
     @staticmethod
     def _make_member(x, y, vx, vy):
         member = MagicMock()
-        member.state = np.array([[x], [y]])
+        member.kinematics = "omni"
+        member.state = np.array([[x], [y], [0.0]])
         member.radius = 0.5
         member.max_speed = 1.0
+        member.vel_max = np.array([[1.0], [1.0]])
         member._world_param = MagicMock()
         member._world_param.step_time = 0.1
         member.get_desired_omni_vel = MagicMock(return_value=np.array([[vx], [vy]]))
```

---

### Incident Patch 4: `3f034232` (2026-10-03)
**Commit Message**: fix(env): assign group actions by member and keep the map out of groups (#377)

* fix: group action order

* fix: group action order

**File**: `irsim/env/env_base.py` (modified, +19/-7)
```diff
@@ -539,14 +539,26 @@ def _assign_keyboard_action(self, action: list[Any]) -> list[Any]:
 
     def _assign_group_action(self, action: list[Any]) -> list[Any]:
         """
-        Assign the group action to the action list.
+        Assign the group actions to the action list.
+
+        Each group behavior returns one action per group member, aligned with
+        ``group.members``. Actions are matched to ``self.objects`` by object
+        identity rather than by position, since group membership is neither
+        contiguous nor ordered like ``self.objects`` (e.g. obstacle groups,
+        explicit ``group`` ids, or objects deleted at runtime). An action
+        already present in ``action`` (keyboard or user supplied) takes
+        priority over the group action.
         """
-        group_actions = [
-            ga for group in self._object_groups for ga in group.gen_group_vel()
-        ]
-        for i, (a, ga) in enumerate(zip(action, group_actions, strict=False)):
-            if a is None and ga is not None:
-                action[i] = ga
+        position = {id(obj): i for i, obj in enumerate(self.objects)}
+
+        for group in self._object_groups:
+            group_actions = group.gen_group_vel()
+            for member, ga in zip(group.members, group_actions, strict=False):
+                if ga is None:
+                    continue
+                index = position.get(id(member))
+                if index is not None and action[index] is None:
+                    action[index] = ga
 
         return action
 
```

**File**: `irsim/env/env_config.py` (modified, +7/-3)
```diff
@@ -199,10 +199,14 @@ def _build_scene(self) -> Any:
         objects = robot_collection + obstacle_collection + map_collection
         objects.sort(key=attrgetter("id"))
 
-        # Initialize groups (unique and inclusive)
-        group_ids = sorted({obj.group for obj in objects})
+        # Initialize groups (unique and inclusive). Map objects are static
+        # scenery rather than agents, so they never join a group: the map's
+        # default ``group`` of 0 would otherwise make it a member of the first
+        # robot group and an agent of that group's behavior (orca, sfm).
+        grouped = [obj for obj in objects if obj.shape != "map"]
+        group_ids = sorted({obj.group for obj in grouped})
         object_groups = [
-            ObjectGroup([obj for obj in objects if obj.group == gid], gid)
+            ObjectGroup([obj for obj in grouped if obj.group == gid], gid)
             for gid in group_ids
         ]
 
```

**File**: `irsim/lib/behavior/group_behavior.py` (modified, +13/-7)
```diff
@@ -72,22 +72,28 @@ def update_members(self, members: list[ObjectBase]) -> None:
         """
         self.members = members
 
+    def _no_actions(self) -> list[None]:
+        """One ``None`` per member, so the result stays aligned with ``members``."""
+        return [None] * len(self.members)
+
     def gen_group_vel(self) -> list[Any]:
         """Generate per-member actions for one step.
 
         Returns:
-            list: A list of actions aligned with `members`. Each element is
-                  behavior-specific (e.g., 2x1 numpy arrays for velocity).
+            list: A list of actions aligned with `members` (always
+                  ``len(members)`` entries). Each element is behavior-specific
+                  (e.g., 2x1 numpy arrays for velocity), or ``None`` when the
+                  member gets no group action.
 
         Behavior:
             - Uses a class-based handler if one was registered and initialized.
             - Otherwise looks up a function behavior in the registry.
-            - If no behavior is configured, returns `[None]` (one sentinel
-              element) and logs a warning periodically in auto mode.
+            - If no behavior is configured, returns ``None`` for every member
+              and logs a warning periodically in auto mode.
         """
 
         if not self.behavior_dict:
-            return [None]
+            return self._no_actions()
 
         if self.name is None or self.kinematics is None:
             # Access params via first member if available
@@ -98,7 +104,7 @@ def gen_group_vel(self) -> list[Any]:
                         f"Group behavior not defined for the group of {self.members[0].name}. "
                         "Auto control will be static. Available behaviors: orca"
                     )
-            return [None]
+            return self._no_actions()
 
         # Prefer class-based handler if initialized
         if callable(self._invoke_func):
@@ -112,7 +118,7 @@ def gen_group_vel(self) -> list[Any]:
                 f"No group behavior method found for category '{self.kinematics}' "
                 f"and action '{self.name}'."
             )
-            return [None]
+            return self._no_actions()
         return func(self.members, **self.behavior_dict)
 
     def load_group_behaviors(self, group_behaviors: str = ".group_behavior_methods"):
```

**File**: `tests/test_behaviors.py` (modified, +2/-2)
```diff
@@ -569,7 +569,7 @@ def test_gen_group_vel_no_config(self, mock_members):
         """Test gen_group_vel with no behavior configured."""
         gb = GroupBehavior(mock_members)
         result = gb.gen_group_vel()
-        assert result == [None]
+        assert result == [None] * len(mock_members)
 
     @patch("irsim.lib.behavior.group_behavior.group_behaviors_map")
     @patch("irsim.lib.behavior.group_behavior.group_behaviors_class_map")
@@ -621,7 +621,7 @@ def test_gen_group_vel_missing_function(
         gb = GroupBehavior(mock_members, **behavior_dict)
 
         result = gb.gen_group_vel()
-        assert result == [None]
+        assert result == [None] * len(mock_members)
         mock_log_error.assert_called_once()
         assert (
             "No group behavior method found for category 'diff' and action 'missing_behavior'."
```

**File**: `tests/test_env.py` (modified, +198/-0)
```diff
@@ -2072,6 +2072,204 @@ def test_omni_angular_keyboard_action(self, env_factory):
         env._world_param.control_mode = original_mode
 
 
+class TestAssignGroupAction:
+    """Group actions are routed to their members by identity, not by position."""
+
+    def test_actions_follow_members_not_positions(self):
+        """A group's actions land on its own members wherever they sit in
+        ``objects``, and a group without a behavior contributes nothing."""
+        from unittest.mock import MagicMock
+
+        from irsim.env.env_base import EnvBase
+
+        objects = [MagicMock(name=f"obj{i}") for i in range(5)]
+        # Group A: two plain objects, no group behavior -> one None per member
+        # (the old single-element ``[None]`` shifted every later group by one).
+        group_a = MagicMock()
+        group_a.members = [objects[0], objects[1]]
+        group_a.gen_group_vel.return_value = [None, None]
+        # Group B: non-contiguous members listed out of ``objects`` order.
+        group_b = MagicMock()
+        group_b.members = [objects[4], objects[2]]
+        group_b.gen_group_vel.return_value = ["act4", "act2"]
+
+        mock_env = MagicMock()
+        mock_env.objects = objects
+        mock_env._object_groups = [group_a, group_b]
+
+        result = EnvBase._assign_group_action(mock_env, [None] * 5)
+
+        assert result == [None, None, "act2", None, "act4"]
+
+    def test_existing_action_takes_priority(self):
+        """A keyboard/user action already in the list is not overwritten."""
+        from unittest.mock import MagicMock
+
+        from irsim.env.env_base import EnvBase
+
+        objects = [MagicMock(), MagicMock()]
+        group = MagicMock()
+        group.members = objects
+        group.gen_group_vel.return_value = ["g0", "g1"]
+
+        mock_env = MagicMock()
+        mock_env.objects = objects
+        mock_env._object_groups = [group]
+
+        result = EnvBase._assign_group_action(mock_env, ["user0", None])
+
+        assert result == ["user0", "g1"]
+
+    def test_deleted_member_does_not_shift_actions(self):
+        """An action for a member no longer in ``objects`` is dropped instead
+        of landing on the next object."""
+        from unittest.mock import MagicMock
+
+        from irsim.env.env_base import EnvBase
+
+        kept0, deleted, kept2 = MagicMock(), MagicMock(), MagicMock()
+        group = MagicMock()
+        group.members = [kept0, deleted, kept2]
+        group.gen_group_vel.return_value = ["a0", "a_deleted", "a2"]
+
+        mock_env = MagicMock()
+        mock_env.objects = [kept0, kept2]
+        mock_env._object_groups = [group]
+
+        result = EnvBase._assign_group_action(mock_env, [None, None])
+
+        assert result == ["a0", "a2"]
+
+    def test_plain_group_before_group_behavior_via_make(self, tmp_path):
+        """End-to-end: two dash robots ahead of an sfm group each keep their own
+        behavior, and every sfm member receives a group action."""
+        config = tmp_path / "mixed_groups.yaml"
+        config.write_text(
+            "world:\n"
+            "  height: 20\n"
+            "  width: 20\n"
+            "  step_time: 0.1\n"
+            "  collision_mode: 'unobstructed'\n"
+            "robot:\n"
+            "  - number: 2\n"
+            "    kinematics: {name: 'diff'}\n"
+            "    shape: {name: 'circle', radius: 0.2}\n"
+            "    state: [[1, 1, 0], [1, 3, 0]]\n"
+            "    goal: [[19, 1, 0], [19, 3, 0]]\n"
+            "    behavior: {name: 'dash'}\n"
+            "    vel_max: [1, 1]\n"
+            "  - number: 3\n"
+            "    kinematics: {name: 'omni'}\n"
+            "    shape: {name: 'circle', radius: 0.2}\n"
+            "    state: [[5, 10, 0], [10, 10, 0], [15, 10, 0]]\n"
+            "    goal: [[5, 19, 0], [10, 19, 0], [15, 19, 0]]\n"
+            "    vel_max: [2, 2]\n"
+            "    vel_min: [-2, -2]\n"
+            "    group_behavior: {name: 'sfm'}\n"
+        )
+
+        env = irsim.make(str(config), display=False, save_ani=False)
+        try:
+            assigned = env._assign_group_action([None] * len(env.objects))
+            # dash robots get no group action; every sfm member gets one
+            assert assigned[0] is None
+            assert assigned[1] is None
+            assert all(a is not None for a in assigned[2:])
+
+            start = np.array([r.state[:2, 0] for r in env.robot_list])
+            for _ in range(20):
+                env.step()
+            end = np.array([r.state[:2, 0] for r in env.robot_list])
+        finally:
+            env.end()
+
+        moved = end - start
+        # dash robots drove toward +x on their own; the second one used to
+        # receive the first sfm member's velocity and spin in place instead.
+        assert moved[0, 0] > 1.0
+        assert moved[1, 0] > 1.0
+        # all three sfm members moved toward +y (their goals)
+        assert (moved[2:, 1] > 0.5).all()
+
+
+class TestMapObje
```

---

### Incident Patch 5: `4d635813` (2026-08-27)
**Commit Message**: fix: robustness fixes from a code review of sensors, env lifecycle, actions, and logging (#360)

* fix(util): add ClipTo2Pi so a 2π lidar angle_range or fov no longer wraps to zero

* fix(env): close only the environment's own figure in end()

* fix(world): round the sampling ratio and sample at least every step

* fix(env): resolve env.step action_id by object id and accept flat lists, tuples, and dicts

* fix(log): report persistent per-step warnings once instead of every step

* fix(kinematics): raise for unknown kinematics names instead of falling back to diff

* fix(world): keep truncating the sampling ratio, ignoring float noise

* fix(env): match step() type hints to the accepted action forms

* fix(util): address review notes on ClipTo2Pi, warning key, and log fallback

**File**: `docs/locale/zh_CN/LC_MESSAGES/usage/configure_sensor.po` (modified, +6/-2)
```diff
@@ -103,8 +103,12 @@ msgid "**range_max**: The maximum range of the laser beam."
 msgstr "**range_max**：激光束的最大量程。"
 
 #: ../../source/usage/configure_sensor.md:108
-msgid "**angle_range**: The angle range of the laser beam."
-msgstr "**angle_range**：激光束覆盖的角度范围。"
+msgid ""
+"**angle_range**: The angle range of the laser beam. Use `6.283185` or `2 * "
+"pi` in Python for a full 360-degree scan."
+msgstr ""
+"**angle_range**：激光束覆盖的角度范围。完整的 360 度扫描可在 YAML 中使用 "
+"`6.283185`，或在 Python 中使用 `2 * pi`。"
 
 #: ../../source/usage/configure_sensor.md:109
 msgid "**number**: The number of beams."
```

**File**: `docs/locale/zh_CN/LC_MESSAGES/usage/make_environment.po` (modified, +41/-0)
```diff
@@ -702,3 +702,44 @@ msgstr "在 `external` 模式下，状态由另一个仿真器或外部系统更
 #: ../../source/usage/make_environment.md:185
 msgid "The external step does not execute IR-SIM kinematics or behaviors. It refreshes all object geometries from one state snapshot, rebuilds the collision index, updates sensors and status, records trajectories, and advances the world clock. Passing `action` to `env.step()` in this mode raises `ValueError`, preventing accidental mixing of internal and external state advancement."
 msgstr "外部步进不会执行 IR-SIM 的运动学或行为逻辑。它基于同一状态快照刷新所有对象的几何信息、重建碰撞索引、更新传感器和状态、记录轨迹，并推进世界时钟。在此模式下向 `env.step()` 传入 `action` 会引发 `ValueError`，以防意外混用内部和外部状态推进方式。"
+
+#: ../../source/usage/make_environment.md:173
+msgid "Actions follow the usual single- and multi-agent conventions:"
+msgstr "动作的传入方式遵循常见的单智能体 / 多智能体惯例："
+
+#: ../../source/usage/make_environment.md:175
+msgid ""
+"`env.step([1.0, 0.5])` applies one action (a list, tuple, or ndarray) to "
+"the first robot."
+msgstr "`env.step([1.0, 0.5])`：把一个动作（列表、元组或 ndarray）施加给第一个机器人。"
+
+#: ../../source/usage/make_environment.md:176
+msgid ""
+"`env.step(action, action_id=2)` targets the object with id `2` (`obj.id`; "
+"robots are created first, so ids `0..n-1` are the robots). A name such as "
+"`\"robot_2\"` works as well."
+msgstr ""
+"`env.step(action, action_id=2)`：作用于 id 为 `2` 的对象（即 `obj.id`；机器人最先创建，"
+"因此 id `0..n-1` 就是机器人）。也可以用名字，如 `\"robot_2\"`。"
+
+#: ../../source/usage/make_environment.md:177
+msgid ""
+"`env.step([a0, a1, a2])` applies one action per robot in order, or from "
+"`action_id` onward."
+msgstr "`env.step([a0, a1, a2])`：按顺序给每个机器人一个动作，或从 `action_id` 开始依次施加。"
+
+#: ../../source/usage/make_environment.md:178
+msgid "`env.step(actions, action_id=[0, 3])` pairs each action with the given id."
+msgstr "`env.step(actions, action_id=[0, 3])`：动作与给定的 id 一一对应。"
+
+#: ../../source/usage/make_environment.md:179
+msgid ""
+"`env.step({\"robot_0\": a0, \"robot_3\": a3})` takes a dict keyed by robot "
+"name."
+msgstr "`env.step({\"robot_0\": a0, \"robot_3\": a3})`：以机器人名字为键的字典。"
+
+#: ../../source/usage/make_environment.md:181
+msgid ""
+"Surplus actions are dropped with a warning; an unknown id or name raises "
+"`ValueError`."
+msgstr "多余的动作会被丢弃并给出警告；不存在的 id 或名字会抛出 `ValueError`。"
```

**File**: `docs/locale/zh_CN/LC_MESSAGES/yaml_config/configuration.po` (modified, +11/-6)
```diff
@@ -468,10 +468,11 @@ msgstr "**`sample_time`**（`float`，默认与 `step_time` 相同）"
 msgid ""
 "Defines the time interval for rendering the simulation and extracting data. "
 "This controls how frequently visual updates and data recordings occur. If "
-"not specified, defaults to the value of `step_time`."
+"not specified, defaults to the value of `step_time`. The ratio to "
+"`step_time` is truncated to a whole number of steps (at least one)."
 msgstr ""
 "定义渲染与数据采集的时间间隔，决定可视化更新与记录的频率。未指定时默认等于 "
-"`step_time`。"
+"`step_time`；与 `step_time` 的比值会向下取整为整数步数（至少为 1）。"
 
 #: ../../source/yaml_config/configuration.md:571
 msgid "**`offset`** (`list` of `float`, default: `[0, 0]`)"
@@ -1148,8 +1149,10 @@ msgid "`fov`"
 msgstr "`fov`"
 
 #: ../../source/yaml_config/configuration.md:700
-msgid "Field of view angles in radians for the object's sensors."
-msgstr "对象传感器的视场角（弧度）。"
+msgid ""
+"Field of view angle in radians for the object's sensors, clipped to `[0, "
+"2*pi]`."
+msgstr "对象传感器的视场角（弧度），限制在 `[0, 2*pi]` 内。"
 
 #: ../../source/yaml_config/configuration.md:700
 msgid "`fov_radius`"
@@ -2182,8 +2185,10 @@ msgid "`range_max` (float/`10.0`): Maximum detection range."
 msgstr "`range_max`（float）：最大探测距离，默认 `10.0`。"
 
 #: ../../source/yaml_config/configuration.md:1204
-msgid "`angle_range` (float/`pi`): Total angle range of the sensor."
-msgstr "`angle_range`（float）：传感器覆盖角度，默认 `pi`。"
+msgid ""
+"`angle_range` (float/`pi`): Total angle range of the sensor, clipped to "
+"`[0, 2*pi]` (`6.283185` gives a full 360° scan)."
+msgstr "`angle_range`（float）：传感器覆盖角度，默认 `pi`，限制在 `[0, 2*pi]` 内（`6.283185` 为 360° 全向扫描）。"
 
 #: ../../source/yaml_config/configuration.md:1205
 msgid "`number` (int/`100`): Number of laser beams."
```

**File**: `docs/source/usage/configure_sensor.md` (modified, +1/-1)
```diff
@@ -104,7 +104,7 @@ To configure the 2D LiDAR sensor, the sensor name of `lidar2d` should be defined
 
 - **range_min**: The minimum range of the laser beam.
 - **range_max**: The maximum range of the laser beam.
-- **angle_range**: The angle range of the laser beam.
+- **angle_range**: The angle range of the laser beam. Use `6.283185` or `2 * pi` in Python for a full 360-degree scan.
 - **number**: The number of beams.
 - **alpha**: The transparency of the laser beam.
 
```

**File**: `docs/source/usage/make_environment.md` (modified, +10/-0)
```diff
@@ -170,6 +170,16 @@ env = irsim.make("config.yaml")
 env.step(action=[1.0, 0.0], action_id=0)
 ```
 
+Actions follow the usual single- and multi-agent conventions:
+
+- `env.step([1.0, 0.5])` applies one action (a list, tuple, or ndarray) to the first robot.
+- `env.step(action, action_id=2)` targets the object with id `2` (`obj.id`; robots are created first, so ids `0..n-1` are the robots). A name such as `"robot_2"` works as well.
+- `env.step([a0, a1, a2])` applies one action per robot in order, or from `action_id` onward.
+- `env.step(actions, action_id=[0, 3])` pairs each action with the given id.
+- `env.step({"robot_0": a0, "robot_3": a3})` takes a dict keyed by robot name.
+
+Surplus actions are dropped with a warning; an unknown id or name raises `ValueError`.
+
 In `external` mode, another simulator or system owns the state update. Supply
 the new state and velocity first, then call `env.step()` without an action:
 
```

**File**: `docs/source/yaml_config/configuration.md` (modified, +3/-3)
```diff
@@ -575,7 +575,7 @@ This section outlines the configuration parameters available for the `world` sec
 
 (p-w-sample-time)=
 **`sample_time`** (`float`, default: `step_time`)
-: Defines the time interval for rendering the simulation and extracting data. This controls how frequently visual updates and data recordings occur. If not specified, defaults to the value of `step_time`.
+: Defines the time interval for rendering the simulation and extracting data. This controls how frequently visual updates and data recordings occur. If not specified, defaults to the value of `step_time`. The ratio to `step_time` is truncated to a whole number of steps (at least one).
 
 (p-w-offset)=
 **`offset`** (`list` of `float`, default: `[0, 0]`)
@@ -761,7 +761,7 @@ All `robot` and `obstacle` entities in the simulation are configured as objects
 | `plot`           | `dict`                                           | `{}`             | Plotting options for object visualization.                                                                         |
 | `state_dim`      | `int`                                            | `None`           | Dimension of the state vector.                                                                                     |
 | `vel_dim`        | `int`                                            | `None`           | Dimension of the velocity vector.                                                                                  |
-| `fov`            | `float`                                          | `None`           | Field of view angles in radians for the object's sensors.                                                          |
+| `fov`            | `float`                                          | `None`           | Field of view angle in radians for the object's sensors, clipped to `[0, 2*pi]`.                                                          |
 | `fov_radius`     | `float`                                          | `None`           | Field of view radius for the object's sensors.                                                                     |
 
 ### Detailed Parameter Descriptions
@@ -1242,7 +1242,7 @@ env.step(env.robot.vel_world2body(world_vel))
   - `lidar2d`: 2D LiDAR sensor for distance measurements. Parameters include:
     - `range_min` (float/`0.0`): Minimum detection range.
     - `range_max` (float/`10.0`): Maximum detection range.
-    - `angle_range` (float/`pi`): Total angle range of the sensor.
+    - `angle_range` (float/`pi`): Total angle range of the sensor, clipped to `[0, 2*pi]` (`6.283185` gives a full 360° scan).
     - `number` (int/`100`): Number of laser beams.
     - `scan_time` (float/`0.1`): Time taken for one complete scan.
     - `noise` (bool/`False`): Whether noise is added to measurements.
```

**File**: `irsim/env/env_base.py` (modified, +37/-40)
```diff
@@ -211,6 +211,7 @@ def __init__(
         self.validate_unique_names()
 
         # Try to initialize keyboard control (pynput or MPL backend inside KeyboardControl)
+        self.keyboard = None
         try:
             keyboard_config = self.env_config.parse["gui"].get("keyboard", {})
             self.keyboard = KeyboardControl(env_ref=self, **keyboard_config)
@@ -273,8 +274,8 @@ def _wire_env_to_objects(self) -> None:
     @normalize_actions
     def step(
         self,
-        action: np.ndarray | list[Any] | None = None,
-        action_id: int | list[int] | None = 0,
+        action: np.ndarray | list[Any] | tuple[Any, ...] | dict[str, Any] | None = None,
+        action_id: int | str | list[int | str] | None = None,
     ) -> None:
         """
         Perform a single simulation step in the environment.
@@ -283,8 +284,9 @@ def step(
         to the specified robots and updating all objects in the environment.
 
         Args:
-            action (Union[np.ndarray, list], optional): Action(s) to be performed in the environment.
-                Can be a single action or a list of actions. Action format depends on robot type:
+            action (Union[np.ndarray, list, tuple, dict], optional): Action(s) to be performed in the environment.
+                Can be a single action, a list/tuple of actions, or a dict ``{name: action}``.
+                Action format depends on robot type:
 
                 - **Differential robot**: [linear_velocity, angular_velocity]
                 - **Omnidirectional robot**: [velocity_x, velocity_y]
@@ -298,10 +300,14 @@ def step(
                     2. Apply the provided ``action`` (list of numpy arrays) to robots by ``action_id`` (int or list of int).
                     3. For remaining robots, fall back to their configured behaviors when ``action`` is ``None``.
 
-            action_id (Union[int, list], optional): ID(s) of the robot(s) to apply the action(s) to.
-                Can be a single robot ID or a list of IDs. Default is 0 (first robot).
-                If action is a list and action_id is a single int, all actions will be
-                applied to robots sequentially starting from action_id.
+            action_id (Union[int, str, list], optional): Object id(s) (``obj.id``) or
+                name(s) to apply the action(s) to; robots are created first, so ids
+                ``0..n-1`` are the robots. ``None`` (default) targets the first robot. If
+                action is a list of actions and action_id is a single id, the actions are
+                applied to that object and the following ones in order. A flat list of
+                numbers (e.g. ``[1.0, 0.5]``) is one action; a dict ``{name: action}``
+                can be passed as ``action`` instead of using ``action_id``. Surplus actions
+                are dropped with a warning; an unknown id or name raises ``ValueError``.
 
         Note:
             - If the environment is paused, this method returns without performing any updates.
@@ -318,6 +324,9 @@ def step(
             >>> # Move multiple robots
             >>> actions = [[1.0, 0.0], [0.5, 0.3]]
             >>> env.step(actions, action_id=[0, 1])  # Move robots 0 and 1
+            >>>
+            >>> # Dict keyed by robot name
+            >>> env.step({"robot_0": [1.0, 0.0], "robot_2": [0.5, 0.3]})
         """
 
         if self.quit_flag:
@@ -595,42 +604,30 @@ def end(self, ending_time: float = 3.0, **kwargs: Any) -> None:
             **kwargs: Additional keyword arguments for saving the animation, see :py:meth:`.EnvPlot.save_animate` for detail.
         """
 
-        if self.disable_all_plot:
-            return
-
-        if self.save_ani:
-            kwargs = {**self.ani_kwargs, **kwargs}
-            if "ani_name" not in kwargs:
-                kwargs["ani_name"] = f"animation_{self._world.name}"
+        if not self.disable_all_plot:
+            if self.save_ani:
+                # precedence: call kwargs > env ani_kwargs > world-named default
+                self._env_plot.save_animate(
+                    **{
+                        "ani_name": f"animation_{self._world.name}",
+                        **self.ani_kwargs,
+                        **kwargs,
+                    }
+                )
 
-            self._env_plot.save_animate(**kwargs)
+            if self.display:
+                plt.pause(ending_time)
+                self.logger.info(
+                    f"Simulation Environment '{self._world.name}' closing in {ending_time:.2f} seconds."
+                )
 
-        if self.display:
-            plt.pause(ending_time)
-            self.logger.info(
-                f"Simulation Environment '{self._world.name}' closing in {ending_time:.2f} seconds."
-            )
+        if self.keyboard is not None:
+            self.keyboard.close()
 
-        plt.close("all")
+        # The figure exists even when plotting is disabled; close it so that
+        # headless episodic lo
```

**File**: `irsim/env/env_logger.py` (modified, +20/-0)
```diff
@@ -28,6 +28,8 @@ def __init__(
         if log_file is not None:
             logger.add(log_file, level=log_level)
 
+        self._once_keys: set[str] = set()
+
     def trace(self, msg: str) -> None:
         """
         Log a trace message.
@@ -73,6 +75,24 @@ def warning(self, msg: str) -> None:
         """
         logger.warning(msg)
 
+    def warning_once(self, msg: str, key: str | None = None) -> None:
+        """
+        Log a warning the first time ``key`` (default: ``msg``) is seen, then at DEBUG.
+
+        For per-step conditions that would otherwise flood the log every step.
+
+        Args:
+            msg (str): The message to log.
+            key (str, optional): Identity of the condition when ``msg`` varies.
+        """
+        key = key or msg
+        if key in self._once_keys:
+            logger.debug(msg)
+            return
+
+        self._once_keys.add(key)
+        logger.warning(f"{msg} (further occurrences are logged at DEBUG level)")
+
     def success(self, msg: str) -> None:
         """
         Log a success message.
```

---

### Incident Patch 6: `7b06c2db` (2026-08-24)
**Commit Message**: fix(behavior): command omni robots in the frame they are steered in (#357)

* fix(behavior): command omni robots in the frame they are steered in

Since omni kinematics became body-frame, a holonomic planner's world-frame
velocity was applied as if it were already in the robot's frame, so a robot
facing away from its goal drove away from it. Every velocity transform now
goes through one util family - vel_world2omni, vel_omni2world, vel_world2diff
and vel_diff2world - and ORCA, RVO and SFM convert through it. The previous
omni_to_diff and diff_to_omni names stay as aliases. Dash already computed a
body-frame command and is unchanged.

* Update orca_world.py

* doc: add projects using irsim

* docs: describe what the velocity conversion does per model

The paragraph described an earlier design in which every model but omni passed
the velocity through. A diff robot is mapped to [linear, angular], and acker
and omni_angular raise, so say that in both languages. The vel_world2omni
docstring claimed the rotation was the whole conversion for omni_angular,
which needs a yaw rate of its own, and the orca example's comment lost a word.

**File**: `README.md` (modified, +7/-0)
```diff
@@ -164,12 +164,19 @@ For more examples, see the [usage directory](https://github.com/hanruihua/ir-sim
 - **[RAL & ICRA 2023]** [rl-rvo-nav](https://github.com/hanruihua/rl_rvo_nav) -- Reinforcement learning-based RVO behavior for multi-robot navigation.
 - **[RAL & IROS 2023]** [RDA_planner](https://github.com/hanruihua/RDA_planner) -- Accelerated collision-free motion planner for cluttered environments.
 - **[T-RO 2025]** [NeuPAN](https://github.com/hanruihua/NeuPAN) -- Direct point robot navigation with end-to-end model-based learning.
+- **[ROBIO 2025]** [MfNeuPAN](https://doi.org/10.1109/ROBIO66223.2025.11377233) -- Proactive end-to-end navigation in dynamic environments using direct multi-frame point constraints.
+- **[IROS 2026]** [SDLW](https://github.com/williamleong/sdlw) -- Decentralized scalable exploration using sensor-driven Lévy walks for minimal-sensing robot teams.
+- **[Sensors 2026]** [PPO-GAT-Follow](https://doi.org/10.3390/s26154711) -- Graph-attention reinforcement learning for robot person following in dense crowds.
+- **[TWC 2026]** [Energy-Efficient Federated Edge Learning for Small-Scale Datasets in Large IoT Networks](https://doi.org/10.1109/TWC.2026.3683911)
 
 ### Community Projects
 
 - [DRL-robot-navigation-IR-SIM](https://github.com/reiniscimurs/DRL-robot-navigation-IR-SIM) -- Deep reinforcement learning for robot navigation.
 - [AutoNavRL](https://github.com/harshmahesheka/AutoNavRL) -- Autonomous navigation using reinforcement learning.
 - [IRSIM-3DGS-Bridge](https://github.com/Wayneyujie/IRSIM-3DGS-Bridge) -- A closed-loop bridge from 3D Gaussian Splatting scenes to IR-SIM planning/following and back to Habitat-GS trajectory playback.
+- [EdgeVox](https://github.com/nrl-ai/edgevox) -- Offline voice-agent framework with an IR-SIM mobile-navigation backend.
+
+*If your publication or project use IR-SIM, we welcome you to propose it for inclusion via an issue or pull request.*
 
 ## Citation
 
```

**File**: `docs/locale/zh_CN/LC_MESSAGES/index.po` (modified, +54/-0)
```diff
@@ -280,6 +280,52 @@ msgstr ""
 "`NeuPAN（T-RO 2025） <https://github.com/hanruihua/NeuPAN>`_ - 端到端、基于模"
 "型学习的点云直接驱动机器人导航。"
 
+#: ../../source/index.rst:236
+msgid ""
+"`MfNeuPAN (ROBIO 2025) <https://doi.org/10.1109/ROBIO66223.2025.11377233>`_ "
+"- Proactive end-to-end navigation in dynamic environments using direct multi-"
+"frame point constraints."
+msgstr ""
+"`MfNeuPAN（ROBIO 2025） <https://doi.org/10.1109/ROBIO66223.2025.11377233>`_ "
+"- 基于直接多帧点约束的动态环境前瞻式端到端导航。"
+
+#: ../../source/index.rst:238
+msgid ""
+"`SDLW (IROS 2026) <https://github.com/williamleong/sdlw>`_ - Decentralized "
+"scalable exploration using sensor-driven Lévy walks for minimal-sensing robot "
+"teams."
+msgstr ""
+"`SDLW（IROS 2026） <https://github.com/williamleong/sdlw>`_ - 面向最小感知机"
+"器人团队的基于传感器驱动列维游走的分布式可扩展探索。"
+
+#: ../../source/index.rst:238
+msgid ""
+"`PPO-GAT-Follow (Sensors 2026) <https://doi.org/10.3390/s26154711>`_ - "
+"Graph-attention reinforcement learning for robot person following in dense "
+"crowds."
+msgstr ""
+"`PPO-GAT-Follow（Sensors 2026） <https://doi.org/10.3390/s26154711>`_ - 面"
+"向密集人群中机器人跟随任务的图注意力强化学习方法。"
+
+#: ../../source/index.rst:239
+msgid ""
+"`Energy-Efficient Federated Edge Learning for Small-Scale Datasets in Large "
+"IoT Networks (TWC 2026) <https://doi.org/10.1109/TWC.2026.3683911>`_ - "
+"Federated edge learning validated through autonomous navigation and collision "
+"avoidance in IR-SIM."
+msgstr ""
+"`面向大规模物联网小规模数据集的节能联邦边缘学习（TWC 2026） <https://doi.org/"
+"10.1109/TWC.2026.3683911>`_ - 通过 IR-SIM 中的自主导航与避障验证联邦边缘"
+"学习方法。"
+
+#: ../../source/index.rst:240
+msgid ""
+"If your publication uses IR-SIM, we welcome you to propose it for inclusion "
+"via an issue or pull request."
+msgstr ""
+"如果您的论文使用了 IR-SIM，欢迎通过 issue 或 pull request 提交收录"
+"建议。"
+
 #: ../../source/index.rst:236
 msgid "Community Projects"
 msgstr "社区项目"
@@ -310,6 +356,14 @@ msgstr ""
 "闭环桥梁，将三维高斯泼溅（3D Gaussian Splatting）场景接入 IR-SIM 进行规划与跟"
 "随，再返回 Habitat-GS 进行轨迹回放。"
 
+#: ../../source/index.rst:242
+msgid ""
+"`EdgeVox <https://github.com/nrl-ai/edgevox>`_ - Offline voice-agent framework "
+"with an IR-SIM mobile-navigation backend."
+msgstr ""
+"`EdgeVox <https://github.com/nrl-ai/edgevox>`_ - 以 IR-SIM 移动导航后端为基础的"
+"离线语音智能体框架。"
+
 #: ../../source/index.rst:244
 msgid "Citation"
 msgstr "引用"
```

**File**: `docs/locale/zh_CN/LC_MESSAGES/yaml_config/configuration.po` (modified, +24/-0)
```diff
@@ -1517,6 +1517,30 @@ msgstr "**object 运动学**"
 msgid "Kinematics Models"
 msgstr "运动学模型"
 
+#: ../../source/yaml_config/configuration.md:938
+msgid ""
+"Velocity commands are expressed in the robot's own frame, while `[vx, vy]` "
+"describes the rigid-body motion in the world frame. A holonomic planner such "
+"as RVO, SFM or ORCA plans in the world frame, so its velocity is converted "
+"at that boundary. An external controller that plans in the world frame "
+"converts the same way:"
+msgstr ""
+"速度指令在机器人自身坐标系下表示，而 `[vx, vy]` 描述的是世界坐标系下的刚体运"
+"动。RVO、SFM、ORCA 等全向规划器在世界坐标系下求解，因此其速度会在该边界处完成"
+"转换。在世界坐标系下规划的外部控制器同样按此转换："
+
+#: ../../source/yaml_config/configuration.md:944
+msgid ""
+"`omni` rotates `[vx, vy]` into `[forward, lateral]`, and `diff` maps it to "
+"`[linear, angular]` using the robot's angular limit and the world step time. "
+"`acker` and `omni_angular` are commanded directly, and a world-frame "
+"translation does not determine their command, so the conversion raises for "
+"them."
+msgstr ""
+"`omni` 将 `[vx, vy]` 旋转为 `[forward, lateral]`；`diff` 则依据机器人的角速度上"
+"限与世界步长，将其映射为 `[linear, angular]`。`acker` 与 `omni_angular` 由指令"
+"直接控制，世界坐标系下的平移速度无法确定其指令，因此该转换会抛出异常。"
+
 #: ../../source/yaml_config/configuration.md:933
 msgid ""
 "**`diff`**: Differential drive, controlled by linear speed and angular "
```

**File**: `docs/source/index.rst` (modified, +7/-0)
```diff
@@ -232,13 +232,20 @@ Projects using IR-SIM
         * `rl-rvo-nav (RAL & ICRA2023) <https://github.com/hanruihua/rl_rvo_nav>`_ - Reinforcement learning-based RVO behavior for multi-robot navigation.
         * `RDA_planner (RAL & IROS2023) <https://github.com/hanruihua/RDA_planner>`_ - Accelerated collision-free motion planner for cluttered environments.
         * `NeuPAN (T-RO 2025) <https://github.com/hanruihua/NeuPAN>`_ - Direct point robot navigation with end-to-end model-based learning.
+        * `MfNeuPAN (ROBIO 2025) <https://doi.org/10.1109/ROBIO66223.2025.11377233>`_ - Proactive end-to-end navigation in dynamic environments using direct multi-frame point constraints.
+        * `SDLW (IROS 2026) <https://github.com/williamleong/sdlw>`_ - Decentralized scalable exploration using sensor-driven Lévy walks for minimal-sensing robot teams.
+        * `PPO-GAT-Follow (Sensors 2026) <https://doi.org/10.3390/s26154711>`_ - Graph-attention reinforcement learning for robot person following in dense crowds.
+        * `Energy-Efficient Federated Edge Learning for Small-Scale Datasets in Large IoT Networks (TWC 2026) <https://doi.org/10.1109/TWC.2026.3683911>`_ - Federated edge learning validated through autonomous navigation and collision avoidance in IR-SIM.
+
+        If your publication uses IR-SIM, we welcome you to propose it for inclusion via an issue or pull request.
 
     .. grid-item-card:: Community Projects
         :shadow: md
 
         * `DRL-robot-navigation-IR-SIM <https://github.com/reiniscimurs/DRL-robot-navigation-IR-SIM>`_ - Deep reinforcement learning for robot navigation.
         * `AutoNavRL <https://github.com/harshmahesheka/AutoNavRL>`_ - Autonomous navigation using reinforcement learning.
         * `IRSIM-3DGS-Bridge <https://github.com/Wayneyujie/IRSIM-3DGS-Bridge>`_ - A closed-loop bridge from 3D Gaussian Splatting scenes to IR-SIM planning/following and back to Habitat-GS trajectory playback.
+        * `EdgeVox <https://github.com/nrl-ai/edgevox>`_ - Offline voice-agent framework with an IR-SIM mobile-navigation backend.
 
 Citation
 ========
```

**File**: `docs/source/yaml_config/configuration.md` (modified, +8/-0)
```diff
@@ -953,6 +953,14 @@ All `robot` and `obstacle` entities in the simulation are configured as objects
 - **`omni`**: Omnidirectional, controlled by body-frame forward and lateral speed (`[forward, lateral]`)
 - **`omni_angular`**: Omnidirectional with angular control, controlled by body-frame speeds and yaw rate (`[forward, lateral, yaw_rate]`)
 - **`acker`**: Ackermann steering, controlled by linear speed and steering angle (`[v, phi]`)
+
+Velocity commands are expressed in the robot's own frame, while `[vx, vy]` describes the rigid-body motion in the world frame. A holonomic planner such as RVO, SFM or ORCA plans in the world frame, so its velocity is converted at that boundary. An external controller that plans in the world frame converts the same way:
+
+```python
+env.step(env.robot.vel_world2body(world_vel))
+```
+
+`omni` rotates `[vx, vy]` into `[forward, lateral]`, and `diff` maps it to `[linear, angular]` using the robot's angular limit and the world step time. `acker` and `omni_angular` are commanded directly, and a world-frame translation does not determine their command, so the conversion raises for them.
 ```
 
 (p-o-kinematics)=
```

**File**: `irsim/lib/behavior/behavior_methods.py` (modified, +14/-8)
```diff
@@ -4,7 +4,12 @@
 import numpy as np
 
 from irsim.lib import reciprocal_vel_obs, register_behavior, social_force_model
-from irsim.util.util import WrapToPi, omni_to_diff, relative_position
+from irsim.util.util import (
+    WrapToPi,
+    relative_position,
+    vel_world2diff,
+    vel_world2omni,
+)
 
 """
 Behavior Methods Module
@@ -211,7 +216,7 @@ def beh_omni_rvo(
     factor = kwargs.get("factor", 1.0)
     mode = kwargs.get("mode", "rvo")
     neighbor_threshold = kwargs.get("neighbor_threshold", 3.0)
-    return OmniRVO(
+    world_vel = OmniRVO(
         rvo_state,
         rvo_neighbor,
         vxmax,
@@ -222,6 +227,7 @@ def beh_omni_rvo(
         neighbor_threshold,
         line_segments=line_segments,
     )
+    return vel_world2omni(ego_object.state[2, 0], world_vel)
 
 
 @register_behavior("diff", "sfm")
@@ -264,10 +270,10 @@ def beh_diff_sfm(
     )
     # SFM produces a holonomic ``(vx, vy)``; track it tightly so the small
     # sideways component from anisotropic social/obstacle forces doesn't
-    # get clipped by ``omni_to_diff``'s default deadband.
+    # get clipped by ``vel_world2diff``'s default deadband.
     _, vmax_pair = ego_object.get_vel_range()
     w_max = float(vmax_pair[1, 0])
-    return omni_to_diff(
+    return vel_world2diff(
         ego_object.rvo_state[-1],
         [vx, vy],
         w_max=w_max,
@@ -314,7 +320,7 @@ def beh_omni_sfm(
         step_time=ego_object._world_param.step_time,
         **kwargs,
     )
-    return np.array([[vx], [vy]])
+    return vel_world2omni(ego_object.state[2, 0], np.array([[vx], [vy]]))
 
 
 @register_behavior("omni_angular", "dash")
@@ -575,18 +581,18 @@ def DiffRVO(
         line_obs_list=line_segments,
     )
     rvo_vel = rvo_behavior.cal_vel(mode)
-    diff_vel = omni_to_diff(state_tuple[-1], rvo_vel)
+    diff_vel = vel_world2diff(state_tuple[-1], rvo_vel)
 
     if not diff_vel.any() and not filtered_neighbor_list and not line_segments:
         # With no neighbors or obstacles in range, a fully frozen command means
         # the holonomic RVO solution collapsed toward zero velocity because the
         # goal lies behind the robot (it cannot represent a reversal), so the
         # diff robot would freeze forever instead of turning around. Rotate in
         # place toward the desired heading; forward speed stays zero and
-        # ``omni_to_diff`` naturally stops the rotation once the robot faces its
+        # ``vel_world2diff`` naturally stops the rotation once the robot faces its
         # goal. When neighbors are present the freeze is collision avoidance and
         # the robot must keep waiting, so this branch is skipped entirely.
-        diff_vel = omni_to_diff(state_tuple[-1], [state_tuple[5], state_tuple[6]])
+        diff_vel = vel_world2diff(state_tuple[-1], [state_tuple[5], state_tuple[6]])
         diff_vel[0, 0] = 0.0
 
     return diff_vel
```

**File**: `irsim/lib/behavior/group_behavior_methods.py` (modified, +14/-7)
```diff
@@ -4,7 +4,7 @@
 import numpy as np
 
 from irsim.lib.behavior.behavior_registry import register_group_behavior_class
-from irsim.util.util import omni_to_diff, relative_position
+from irsim.util.util import relative_position, vel_world2diff, vel_world2omni
 from irsim.world.object_base import ObjectBase
 
 
@@ -29,9 +29,10 @@ class OrcaGroupBehavior:
     """
     Class-based ORCA group behavior with one-time initialization.
 
-    ORCA plans a collision-free holonomic velocity ``(vx, vy)`` for every
-    member. ``omni`` members use it directly; ``diff`` members map it to a
-    ``(linear, angular)`` command via :func:`omni_to_diff`.
+    ORCA plans a collision-free holonomic velocity ``(vx, vy)`` in the world
+    frame for every member. ``omni`` members have it rotated into their body
+    frame; ``diff`` members map it to a ``(linear, angular)`` command via
+    :func:`vel_world2diff`.
     """
 
     def __init__(
@@ -117,16 +118,22 @@ def _pref_velocity(self, member: ObjectBase) -> list[float]:
     def _to_action(self, member: ObjectBase, vel_xy: tuple[float, float]) -> np.ndarray:
         """Convert an ORCA world-frame velocity into a member control input.
 
-        ``omni`` members consume ``(vx, vy)`` directly; ``diff`` members get the
-        holonomic velocity mapped to ``(linear, angular)``.
+        ``diff`` members get the holonomic velocity mapped to ``(linear,
+        angular)``; every other model converts it through its own kinematics,
+        which for ``omni`` means rotating it into the body frame the model is
+        commanded in.
         """
         if self._kinematics == "diff":
-            return omni_to_diff(
+            return vel_world2diff(
                 member.state[2, 0],
                 [vel_xy[0], vel_xy[1]],
                 w_max=float(member.vel_max[1, 0]),
                 guarantee_time=member._world_param.step_time,
             )
+
+        if self._kinematics == "omni":
+            return vel_world2omni(member.state[2, 0], [vel_xy[0], vel_xy[1]])
+
         return np.c_[list(vel_xy)]
 
     def __call__(self, members: list[ObjectBase], **kwargs: Any) -> list[np.ndarray]:
```

**File**: `irsim/lib/handler/kinematics_handler.py` (modified, +14/-23)
```diff
@@ -1,5 +1,5 @@
 from abc import ABC, abstractmethod
-from math import atan2, cos, sin
+from math import atan2
 from typing import ClassVar
 
 import numpy as np
@@ -10,7 +10,7 @@
     omni_angular_kinematics,
     omni_kinematics,
 )
-from irsim.util.util import log_warning
+from irsim.util.util import log_warning, vel_diff2world, vel_omni2world
 
 # ---------------------------------------------------------------------------
 # Registry
@@ -53,6 +53,11 @@ def decorator(cls):
 # ---------------------------------------------------------------------------
 
 
+def _heading(state: np.ndarray) -> float:
+    """Read the heading from a state that may not carry one."""
+    return state[2, 0] if state.shape[0] > 2 else 0.0
+
+
 class KinematicsHandler(ABC):
     """
     Abstract base class for handling robot kinematics.
@@ -109,8 +114,9 @@ def velocity_to_xy(self, state: np.ndarray, velocity: np.ndarray) -> np.ndarray:
 
         The default implementation follows differential-drive conventions:
         ``velocity[0]`` is the linear speed projected through the heading
-        angle ``state[2]``. Subclasses with different velocity semantics
-        (e.g. omnidirectional) should override this.
+        angle ``state[2]``, which is what :func:`~irsim.util.util.vel_diff2world`
+        does. Subclasses with different velocity semantics (e.g.
+        omnidirectional) should override this.
 
         Args:
             state (np.ndarray): Current state vector.
@@ -121,11 +127,8 @@ def velocity_to_xy(self, state: np.ndarray, velocity: np.ndarray) -> np.ndarray:
         """
         if len(velocity.shape) == 0:
             return np.zeros((2, 1))
-        vel_linear = velocity[0, 0]
-        theta = state[2, 0]
-        vx = vel_linear * cos(theta)
-        vy = vel_linear * sin(theta)
-        return np.array([[vx], [vy]])
+
+        return vel_diff2world(state[2, 0], velocity)
 
     def compute_max_speed(self, vel_max: np.ndarray) -> float:
         """Compute the scalar maximum speed from the vel_max vector.
@@ -214,13 +217,7 @@ def velocity_to_xy(self, state: np.ndarray, velocity: np.ndarray) -> np.ndarray:
         Returns:
             np.ndarray: ``(2, 1)`` world-frame velocity.
         """
-        theta = state[2, 0] if state.shape[0] > 2 else 0.0
-        cos_t, sin_t = np.cos(theta), np.sin(theta)
-        fwd = velocity[0, 0]
-        lat = velocity[1, 0]
-        vx = fwd * cos_t - lat * sin_t
-        vy = fwd * sin_t + lat * cos_t
-        return np.array([[vx], [vy]])
+        return vel_omni2world(_heading(state), velocity[0:2])
 
     def compute_max_speed(self, vel_max: np.ndarray) -> float:
         """Compute translational speed limit from forward/lateral limits.
@@ -306,13 +303,7 @@ def velocity_to_xy(self, state: np.ndarray, velocity: np.ndarray) -> np.ndarray:
         Returns:
             np.ndarray: ``(2, 1)`` world-frame velocity.
         """
-        theta = state[2, 0]
-        cos_t, sin_t = np.cos(theta), np.sin(theta)
-        fwd = velocity[0, 0]
-        lat = velocity[1, 0]
-        vx = fwd * cos_t - lat * sin_t
-        vy = fwd * sin_t + lat * cos_t
-        return np.array([[vx], [vy]])
+        return vel_omni2world(_heading(state), velocity[0:2])
 
     def compute_max_speed(self, vel_max: np.ndarray) -> float:
         """Compute translational speed limit from the first two components.
```

---

### Incident Patch 7: `b270851e` (2026-07-23)
**Commit Message**: test: consolidate test suite and raise coverage to 97% (#346)

* fix(config): route param module attribute access to the bound instance

PEP 562 only supports module-level __getattr__, so the __setattr__,
__getitem__, and __setitem__ functions in env_param and world_param were
never invoked: assignments like env_param.logger = x created a module
attribute that permanently shadowed the proxy and broke later reads of
the bound instance. Swap the module class to a ModuleType subclass so
attribute reads, writes, and index access all resolve against the
currently bound param instance.

* style: use PEP 604 unions in isinstance checks

* test: consolidate suite to 13 files and raise coverage to 97%

Consolidate 25 test files into 13 domain-focused files: dissolve the
print-smoke and line-targeted coverage files (test_all_objects.py,
test_coverage_extra.py), delete duplicated suites (test_object_group.py,
test_group_behavior.py), and merge small files into their domains
(sensors, gui, plot, behaviors, world_map, objects, env). Ported tests
are rewritten with real assertions; loop-behavior YAML fixtures are
inlined via tmp_path.

Measure coverage of irsim only: pytest/coverage config moves

**File**: `.github/workflows/python-version-test.yml` (modified, +2/-2)
```diff
@@ -38,14 +38,14 @@ jobs:
     - name: Test with pytest (Ubuntu)
       if: startsWith(matrix.os, 'ubuntu')
       run: |
-        xvfb-run -s "-screen 0 1024x768x24" uv run pytest --cov . --cov-report=xml --cov-report=html
+        xvfb-run -s "-screen 0 1024x768x24" uv run pytest --cov-report=xml --cov-report=html
 
     - name: Test with pytest (macOS)
       if: startsWith(matrix.os, 'macos')
       env:
         MPLBACKEND: Agg
       run: |
-        uv run pytest --cov . --cov-report=xml --cov-report=html
+        uv run pytest --cov-report=xml --cov-report=html
 
     - name: Upload coverage information
       if: matrix.os == 'ubuntu-latest' && matrix.python-version == '3.12'
```

**File**: `AGENTS.md` (modified, +3/-3)
```diff
@@ -15,8 +15,8 @@ uv sync
 # Run all tests
 pytest
 
-# Run tests with coverage
-pytest --cov . --cov-report=html
+# Run tests with coverage report (coverage of irsim/ is on by default via pyproject)
+pytest --cov-report=html
 
 # Run a single test file
 pytest tests/test_kinematics.py
@@ -130,7 +130,7 @@ irsim/                  # Main package
 ├── util/               # Utility functions
 └── config/             # Configuration parameters
 
-tests/                  # Pytest test suite (25 test files)
+tests/                  # Pytest test suite (13 test files)
 usage/                  # Example YAML configs and scripts (24 examples)
 docs/                   # Sphinx documentation (multilingual: en, zh_CN)
 ```
```

**File**: `CLAUDE.md` (modified, +3/-3)
```diff
@@ -15,8 +15,8 @@ uv sync
 # Run all tests
 pytest
 
-# Run tests with coverage
-pytest --cov . --cov-report=html
+# Run tests with coverage report (coverage of irsim/ is on by default via pyproject)
+pytest --cov-report=html
 
 # Run a single test file
 pytest tests/test_kinematics.py
@@ -130,7 +130,7 @@ irsim/                  # Main package
 ├── util/               # Utility functions
 └── config/             # Configuration parameters
 
-tests/                  # Pytest test suite (25 test files)
+tests/                  # Pytest test suite (13 test files)
 usage/                  # Example YAML configs and scripts (24 examples)
 docs/                   # Sphinx documentation (multilingual: en, zh_CN)
 ```
```

**File**: `irsim/config/env_param.py` (modified, +34/-17)
```diff
@@ -5,7 +5,9 @@
 """
 
 import platform
-from dataclasses import dataclass, field
+import sys
+from dataclasses import dataclass, field, fields
+from types import ModuleType
 from typing import Any
 
 from irsim.world.object_base import ObjectBase
@@ -32,6 +34,8 @@ class EnvParam:
 _instances: list[EnvParam] = [EnvParam()]
 _current = _instances[0]
 
+_PARAM_FIELDS = frozenset(f.name for f in fields(EnvParam))
+
 
 def bind(instance: EnvParam) -> None:
     """Bind instance to default index 0 and update current alias."""
@@ -43,25 +47,38 @@ def bind(instance: EnvParam) -> None:
     _current = instance
 
 
-def __getattr__(name: str):
-    return getattr(_current, name)
+class _ParamModule(ModuleType):
+    """Route param-field access on the module to the bound instance.
+
+    PEP 562 lets a module define ``__getattr__`` only; plain assignment
+    (``env_param.logger = x``) would create a real module attribute that
+    permanently shadows the proxy. Swapping the module class makes
+    attribute reads, writes, and index access all resolve against the
+    currently bound :class:`EnvParam` instance.
+    """
 
+    def __getattr__(self, name: str):
+        return getattr(_current, name)
 
-def __setattr__(name: str, value):
-    setattr(_current, name, value)
+    def __setattr__(self, name: str, value) -> None:
+        if name in _PARAM_FIELDS:
+            setattr(_current, name, value)
+        else:
+            super().__setattr__(name, value)
 
+    def __getitem__(self, index: int) -> EnvParam:
+        return _instances[index]
 
-def __getitem__(index: int) -> EnvParam:
-    return _instances[index]
+    def __setitem__(self, index: int, instance: EnvParam) -> None:
+        """Assign an EnvParam at a specific index. Extends list if needed."""
+        global _current
+        if index < 0:
+            raise IndexError("env_param index must be non-negative")
+        if index >= len(_instances):
+            _instances.extend(EnvParam() for _ in range(index - len(_instances) + 1))
+        _instances[index] = instance
+        if index == 0:
+            _current = instance
 
 
-def __setitem__(index: int, instance: EnvParam) -> None:
-    """Assign an EnvParam at a specific index. Extends list if needed."""
-    global _current
-    if index < 0:
-        raise IndexError("env_param index must be non-negative")
-    if index >= len(_instances):
-        _instances.extend(EnvParam() for _ in range(index - len(_instances) + 1))
-    _instances[index] = instance
-    if index == 0:
-        _current = instance
+sys.modules[__name__].__class__ = _ParamModule
```

**File**: `irsim/config/world_param.py` (modified, +34/-17)
```diff
@@ -10,7 +10,9 @@
     count: count of the simulation, time = count * step_time
 """
 
-from dataclasses import dataclass
+import sys
+from dataclasses import dataclass, fields
+from types import ModuleType
 
 
 @dataclass
@@ -36,6 +38,8 @@ class WorldParam:
 _instances: list[WorldParam] = [WorldParam()]
 _current = _instances[0]
 
+_PARAM_FIELDS = frozenset(f.name for f in fields(WorldParam))
+
 
 def bind(instance: WorldParam) -> None:
     """Bind instance to default index 0 and update current alias."""
@@ -47,25 +51,38 @@ def bind(instance: WorldParam) -> None:
     _current = instance
 
 
-def __getattr__(name: str):
-    return getattr(_current, name)
+class _ParamModule(ModuleType):
+    """Route param-field access on the module to the bound instance.
+
+    PEP 562 lets a module define ``__getattr__`` only; plain assignment
+    (``world_param.count = x``) would create a real module attribute that
+    permanently shadows the proxy. Swapping the module class makes
+    attribute reads, writes, and index access all resolve against the
+    currently bound :class:`WorldParam` instance.
+    """
 
+    def __getattr__(self, name: str):
+        return getattr(_current, name)
 
-def __setattr__(name: str, value):
-    setattr(_current, name, value)
+    def __setattr__(self, name: str, value) -> None:
+        if name in _PARAM_FIELDS:
+            setattr(_current, name, value)
+        else:
+            super().__setattr__(name, value)
 
+    def __getitem__(self, index: int) -> WorldParam:
+        return _instances[index]
 
-def __getitem__(index: int) -> WorldParam:
-    return _instances[index]
+    def __setitem__(self, index: int, instance: WorldParam) -> None:
+        """Assign a WorldParam at a specific index. Extends list if needed."""
+        global _current
+        if index < 0:
+            raise IndexError("world_param index must be non-negative")
+        if index >= len(_instances):
+            _instances.extend(WorldParam() for _ in range(index - len(_instances) + 1))
+        _instances[index] = instance
+        if index == 0:
+            _current = instance
 
 
-def __setitem__(index: int, instance: WorldParam) -> None:
-    """Assign a WorldParam at a specific index. Extends list if needed."""
-    global _current
-    if index < 0:
-        raise IndexError("world_param index must be non-negative")
-    if index >= len(_instances):
-        _instances.extend(WorldParam() for _ in range(index - len(_instances) + 1))
-    _instances[index] = instance
-    if index == 0:
-        _current = instance
+sys.modules[__name__].__class__ = _ParamModule
```

**File**: `irsim/util/util.py` (modified, +2/-2)
```diff
@@ -232,7 +232,7 @@ def is_list_of_numbers(lst: Any) -> bool:
     Returns:
         bool: True if all elements are numbers, False otherwise.
     """
-    return isinstance(lst, list) and all(isinstance(sub, (int, float)) for sub in lst)
+    return isinstance(lst, list) and all(isinstance(sub, int | float) for sub in lst)
 
 
 def is_list_of_lists(lst: Any) -> bool:
@@ -629,7 +629,7 @@ def is_2d_list(data: list | deque) -> bool:
     # Check if data is a list and is not empty.
     if data:
         first_element = data[0]
-        if isinstance(first_element, (list, tuple)):
+        if isinstance(first_element, list | tuple):
             return True
 
     return False
```

**File**: `pyproject.toml` (modified, +13/-0)
```diff
@@ -77,6 +77,19 @@ dev = [
 ]
 
 
+[tool.pytest.ini_options]
+testpaths = ["tests"]
+addopts = "--cov=irsim --cov-report=term-missing"
+
+[tool.coverage.run]
+source = ["irsim"]
+
+[tool.coverage.report]
+exclude_also = [
+  "if TYPE_CHECKING:",
+  "raise NotImplementedError",
+]
+
 [tool.setuptools.packages.find]
 include = ["irsim*"]
 exclude = ["docs*", "tests*"]
```

**File**: `tests/custom_behavior.py` (removed, +0/-19)
```diff
@@ -1,19 +0,0 @@
-import irsim
-
-"""
-- Refer to the irsim/lib/behavior_methods.py file for the custom behavior design.
-- custom_behavior_methods.py is the designated module name. It should be placed in the same directory as the current implementation script.
-- The behavior names defined in custom_behavior_methods.py (e.g., dash_custom) must match the behavior names specified in the YAML file.
-"""
-
-env = irsim.make()
-env.load_behavior("custom_behavior_methods")
-
-for _i in range(1000):
-    env.step()
-    env.render(0.01)
-
-    if env.done():
-        break
-
-env.end(5)
```

---

### Incident Patch 8: `f5eed41e` (2026-07-22)
**Commit Message**: refactor(plot): extract object rendering and encapsulate options (#345)

* refactor(world): extract object plotting from ObjectBase

* refactor(world): refine ObjectPlot lifecycle

* refactor(plot): encapsulate object rendering options

* fix(plot): align rendering defaults and precedence

* test(plot): cover legacy object plot paths

* fix pads 2D goals

**File**: `docs/locale/zh_CN/LC_MESSAGES/yaml_config/configuration.po` (modified, +12/-12)
```diff
@@ -2361,9 +2361,11 @@ msgstr "`obj_linestyle`（str）：对象轮廓线型（如 '-', '--', ':', '-.'
 
 #: ../../source/yaml_config/configuration.md:1348
 msgid ""
-"`obj_zorder` (int/`3`): Z-order (drawing layer) for object elements. Default"
-" is 3 for robots, 1 for obstacles."
-msgstr "`obj_zorder`（int）：对象元素的绘制层级，机器人默认 3、障碍物默认 1。"
+"`obj_zorder` (int): Z-order (drawing layer) for object elements. Default is "
+"3 for robot patches, 1 for obstacle patches, and 2 for description images."
+msgstr ""
+"`obj_zorder`（int）：对象元素的绘制层级。机器人图形默认 3，障碍物图形默认 1，"
+"描述图片默认 2。"
 
 #: ../../source/yaml_config/configuration.md:1349
 msgid ""
@@ -2376,10 +2378,8 @@ msgid "`obj_alpha` (float/`1.0`): Transparency of the object (0.0 to 1.0)."
 msgstr "`obj_alpha`（float）：对象透明度（0.0-1.0），默认 1.0。"
 
 #: ../../source/yaml_config/configuration.md:1351
-msgid ""
-"`obj_linewidth` (float/`None`): Width of the object outline. Default varies "
-"by object type."
-msgstr "`obj_linewidth`（float）：轮廓线宽，默认随对象类型而定。"
+msgid "`obj_linewidth` (float/`1.0`): Width of the object outline in Matplotlib points."
+msgstr "`obj_linewidth`（float/`1.0`）：对象轮廓线宽，单位为 Matplotlib 点。"
 
 #: ../../source/yaml_config/configuration.md:1353
 msgid "**Goal Visualization:**"
@@ -2475,8 +2475,8 @@ msgid "`arrow_alpha` (float/`1.0`): Transparency of the arrow (0.0 to 1.0)."
 msgstr "`arrow_alpha`（float）：箭头透明度，默认 1.0。"
 
 #: ../../source/yaml_config/configuration.md:1376
-msgid "`arrow_zorder` (int/`4`): Z-order of the arrow."
-msgstr "`arrow_zorder`（int）：箭头层级，默认 4。"
+msgid "`arrow_zorder` (int/`3`): Z-order of the arrow."
+msgstr "`arrow_zorder`（int/`3`）：箭头的绘制层级。"
 
 #: ../../source/yaml_config/configuration.md:1378
 msgid "**Trajectory Path Visualization:**"
@@ -2499,9 +2499,9 @@ msgstr "`traj_style`（str）：路径线型（如 '-', '--', ':', '-.'），默
 
 #: ../../source/yaml_config/configuration.md:1382
 msgid ""
-"`traj_width` (float/`None`): Width of the trajectory line. Default is the "
-"object's width."
-msgstr "`traj_width`（float）：路径线宽，默认为对象宽度。"
+"`traj_width` (float/object width): Width of the trajectory line. Default is "
+"the object's width."
+msgstr "`traj_width`（float/对象宽度）：轨迹线宽，默认为对象宽度。"
 
 #: ../../source/yaml_config/configuration.md:1383
 msgid ""
```

**File**: `docs/source/yaml_config/configuration.md` (modified, +6/-6)
```diff
@@ -291,8 +291,8 @@ A complete IR-SIM scene is described by up to four top-level keys: `world`, `rob
           <div class="yt-leaf"><a class="yt-key" href="#p-o-plot">obj_color</a><span class="yt-type yt-t-str"><b class="yt-pill">str</b></span><span class="yt-def">object's color</span><span class="yt-desc">outline / fill colour</span></div>
           <div class="yt-leaf"><a class="yt-key" href="#p-o-plot">obj_alpha</a><span class="yt-type yt-t-num"><b class="yt-pill">float</b></span><span class="yt-def">1.0</span><span class="yt-desc">transparency 0–1</span></div>
           <div class="yt-leaf"><a class="yt-key" href="#p-o-plot">obj_linestyle</a><span class="yt-type yt-t-str"><b class="yt-pill">str</b></span><span class="yt-def">"-"</span><span class="yt-desc">outline line style</span></div>
-          <div class="yt-leaf"><a class="yt-key" href="#p-o-plot">obj_linewidth</a><span class="yt-type yt-t-num"><b class="yt-pill">float</b></span><span class="yt-def">object's width</span></div>
-          <div class="yt-leaf"><a class="yt-key" href="#p-o-plot">obj_zorder</a><span class="yt-type yt-t-num"><b class="yt-pill">int</b></span><span class="yt-def">3 / 1</span><span class="yt-desc">draw order (robot / obstacle)</span></div>
+          <div class="yt-leaf"><a class="yt-key" href="#p-o-plot">obj_linewidth</a><span class="yt-type yt-t-num"><b class="yt-pill">float</b></span><span class="yt-def">1.0</span></div>
+          <div class="yt-leaf"><a class="yt-key" href="#p-o-plot">obj_zorder</a><span class="yt-type yt-t-num"><b class="yt-pill">int</b></span><span class="yt-def">3 / 1; image 2</span><span class="yt-desc">draw order (robot / obstacle / image)</span></div>
         </div>
         <div class="yt-utabpanel">
           <input type="checkbox" class="yt-gate" id="yt-g-goal">
@@ -1361,10 +1361,10 @@ All `robot` and `obstacle` entities in the simulation are configured as objects
 
   **Object Visualization Properties:**
   - `obj_linestyle` (str/`'-'`): Line style for object outline (e.g., '-', '--', ':', '-.').
-  - `obj_zorder` (int/`3`): Z-order (drawing layer) for object elements. Default is 3 for robots, 1 for obstacles.
+  - `obj_zorder` (int): Z-order (drawing layer) for object elements. Default is 3 for robot patches, 1 for obstacle patches, and 2 for description images.
   - `obj_color` (str): Color of the object. Default is the object's color property.
   - `obj_alpha` (float/`1.0`): Transparency of the object (0.0 to 1.0).
-  - `obj_linewidth` (float/`None`): Width of the object outline. Default varies by object type.
+  - `obj_linewidth` (float/`1.0`): Width of the object outline in Matplotlib points.
 
   **Goal Visualization:**
   - `show_goal` (bool/`False`): Whether to show the goal position.
@@ -1389,13 +1389,13 @@ All `robot` and `obstacle` entities in the simulation are configured as objects
     - `arrow_length` (float/`0.4`): Length of the arrow.
     - `arrow_width` (float/`0.6`): Width of the arrow.
     - `arrow_alpha` (float/`1.0`): Transparency of the arrow (0.0 to 1.0).
-    - `arrow_zorder` (int/`4`): Z-order of the arrow.
+    - `arrow_zorder` (int/`3`): Z-order of the arrow.
 
   **Trajectory Path Visualization:**
   - `show_trajectory` (bool/`False`): Whether to show the trajectory line.
     - `traj_color` (str): Color of the trajectory. Default is the object's color.
     - `traj_style` (str): Line style of the trajectory (e.g., '-', '--', ':', '-.'). Default is "-".
-    - `traj_width` (float/`None`): Width of the trajectory line. Default is the object's width.
+    - `traj_width` (float/object width): Width of the trajectory line. Default is the object's width.
     - `traj_alpha` (float/`0.5`): Transparency of the trajectory (0.0 to 1.0).
     - `traj_zorder` (int/`0`): Z-order for trajectory elements.
     - `keep_traj_length` (int/`0`): Number of steps to keep from the end of trajectory. Default is 0 (keep all steps).
```

**File**: `irsim/world/object_base.py` (modified, +87/-915)
```diff
@@ -5,29 +5,23 @@
 from math import cos, pi, sin
 from typing import Any, ClassVar
 
-import matplotlib.transforms as mtransforms
 import numpy as np
 import shapely
-from matplotlib import image
-from matplotlib.patches import Arrow, Circle, Wedge
-from mpl_toolkits.mplot3d import Axes3D
 from shapely.geometry.base import BaseGeometry
 
-from irsim.config.path_param import path_manager
-from irsim.env.env_plot import draw_patch, linewidth_from_data_units, set_patch_property
 from irsim.lib import Behavior, GeometryFactory, KinematicsFactory
 from irsim.util.util import (
     WrapTo2Pi,
     WrapToPi,
     WrapToRegion,
     check_unknown_kwargs,
-    file_check,
     is_2d_list,
     random_point_range,
     relative_position,
     to_numpy,
     vertices_transform,
 )
+from irsim.world.object_plot import ObjectPlot
 from irsim.world.sensors.sensor_factory import SensorFactory
 
 
@@ -456,6 +450,7 @@ def __init__(
         self._custom_goal_text: str | None = None
         self.collision_obj = []
         self.plot_trail_list = []
+        self._object_plot = ObjectPlot(self)
 
         # --- 13. Validate kwargs ---
         check_unknown_kwargs(kwargs, self._VALID_PARAMS, context=f" in '{role}' config")
@@ -1120,964 +1115,141 @@ def input_state_check(self, state: list, dim: int = 3):
 
     def plot(
         self,
-        ax,
+        ax: Any,
         state: np.ndarray | None = None,
         vertices: np.ndarray | None = None,
-        **kwargs,
-    ):
-        """
-        Plot the object on the given axis.
-
-        Args:
-            ax: Matplotlib axis object for plotting.
-            state: State vector [x, y, theta, ...] defining object position and orientation.
-            vertices: Vertices array defining object shape for polygon/rectangle objects.
-            **kwargs: Plotting configuration options.
-        """
-
-        if state is None:
-            state = self.state
-        if vertices is None:
-            vertices = self.vertices
-
-        self._plot(ax, state, vertices, **kwargs)
-
-    def _init_plot(self, ax, **kwargs):
-        """
-        Initialize plotting elements using zero state and initial vertices.
-
-        Returns:
-            list: Names of plot attributes created (e.g., 'object_patch', 'goal_patch').
-        """
-        # Apply handler-derived show_arrow default only when the object is
-        # dynamic (has a kinematics handler and is not flagged static).
-        # Static objects: YAML obstacles without `kinematics:`, kf=None
-        # robots, anything routed through ObjectStatic; default to no arrow.
-        if (
-            self.kf is not None
-            and not self.static
-            and "show_arrow" not in self.plot_kwargs
-            and "show_arrow" not in kwargs
-        ):
-            kwargs.setdefault("show_arrow", self.kf.show_arrow)
-        return self._plot(
-            ax, self.original_state, self.original_vertices, initial=True, **kwargs
-        )
-
-    def _plot(self, ax, state, vertices, initial: bool = False, **kwargs):
-        """
-        Plot the object with the specified state and vertices.
-
-        Args:
-            ax: Matplotlib axis object for plotting.
-            state: State vector [x, y, theta, ...] defining object position and orientation.
-            vertices: Vertices array defining object shape for polygon/rectangle objects.
-            initial: Whether the plot is for the initial state. Defaults to False.
-            **kwargs: Plotting configuration options:
-
-            Object visualization properties:
-                - obj_linestyle (str): Line style for object outline (e.g., '-', '--', ':', '-.').
-                - obj_zorder (int): Z-order (drawing layer) for object elements; defaults to 3 for robots, 1 for obstacles.
-                - obj_color (str): Color of the object.
-                - obj_alpha (float): Transparency of the object (0.0 to 1.0).
-
-                - show_goal (bool): Whether to show the goal position. Defaults to False.
-                    - goal_color (str): Color of the goal marker. Defaults to object color.
-                    - goal_zorder (int): Z-order of the goal marker. Defaults to 1.
-                    - goal_alpha (float): Transparency of the goal marker. Defaults to 0.5.
-                - show_text (bool): Whether to show text information. Defaults to False.
-                    - text_color (str): Color of the text. Defaults to 'k'.
-                    - text_size (int): Font size of the text. Defaults to 10.
-                    - text_zorder (int): Z-order of the text. Defaults to 2.
-                - show_arrow (bool): Whether to show the velocity arrow. Defaults to False.
-                    - arrow_color (str): Color of the arrow. Defaults to "gold".
-                    - arrow_length (float): Length of the arrow. Defaults to 0.4.
-                    - arrow_width (float): Width of the arrow. Defaults to 0.6.
-                    - arrow_zo
```

**File**: `irsim/world/object_plot.py` (added, +1034/-0)
```diff
@@ -0,0 +1,1034 @@
+"""Matplotlib rendering for :class:`irsim.world.object_base.ObjectBase`."""
+
+from __future__ import annotations
+
+from collections.abc import Mapping
+from dataclasses import dataclass, field, replace
+from math import pi
+from typing import TYPE_CHECKING, Any
+
+import matplotlib.transforms as mtransforms
+import numpy as np
+from matplotlib import image
+from matplotlib.patches import Arrow, Circle, Wedge
+from mpl_toolkits.mplot3d import Axes3D
+
+from irsim.config.path_param import path_manager
+from irsim.env.env_plot import draw_patch, linewidth_from_data_units, set_patch_property
+from irsim.util.util import file_check
+
+if TYPE_CHECKING:
+    from irsim.world.object_base import ObjectBase
+
+
+@dataclass(frozen=True, slots=True)
+class VisibilityOptions:
+    """Control which components of an object are rendered."""
+
+    goal: bool = False  # Draw the goal geometry.
+    goal_text: bool = False  # Draw the goal label with object text.
+    goals: bool = False  # Preserve the legacy multi-goal flag.
+    text: bool = False  # Draw the object label.
+    arrow: bool = False  # Draw the velocity-direction arrow.
+    trajectory: bool = False  # Draw the continuous trajectory line.
+    trail: bool = False  # Draw historical shape snapshots.
+    sensor: bool = True  # Draw attached sensor overlays.
+    fov: bool = False  # Draw the field-of-view region.
+
+
+@dataclass(frozen=True, slots=True)
+class PatchStyle:
+    """Style shared by object and goal patches."""
+
+    color: Any = "k"  # Matplotlib-compatible color.
+    alpha: float = 1.0  # Opacity from fully transparent to opaque.
+    zorder: int = 1  # Layer order; larger values render above.
+    linestyle: str = "-"  # Patch boundary style.
+    line_width: float = 1.0  # Boundary width in Matplotlib points.
+
+
+@dataclass(frozen=True, slots=True)
+class ImageStyle:
+    """Style specific to an object's description image."""
+
+    zorder: int = 2  # Preserve the legacy image layer default.
+
+
+@dataclass(frozen=True, slots=True)
+class LineStyle:
+    """Style and history length for a trajectory line."""
+
+    color: Any = "k"  # Matplotlib-compatible line color.
+    style: str = "-"  # Line style, such as "-" or "--".
+    width: float = 1.0  # Width in environment data units.
+    alpha: float = 0.5  # Line opacity.
+    zorder: int = 0  # Matplotlib layer order.
+    keep_length: int = 0  # Recent states retained; 0 keeps all.
+
+
+@dataclass(frozen=True, slots=True)
+class TextStyle:
+    """Style and offset for object and goal labels."""
+
+    color: Any = "k"  # Matplotlib-compatible text color.
+    size: float = 10.0  # Font size in points.
+    position: tuple[float, float] = (0.0, 0.0)  # Label offset.
+    alpha: float = 1.0  # Text opacity.
+    zorder: int = 2  # Matplotlib layer order.
+
+
+@dataclass(frozen=True, slots=True)
+class TrailStyle:
+    """Style, frequency, and retention policy for object trails."""
+
+    shape: str = "circle"  # Geometry used for each snapshot.
+    edge_color: Any = "k"  # Matplotlib-compatible boundary color.
+    line_width: float = 0.8  # Boundary width passed to Matplotlib.
+    alpha: float = 0.7  # Snapshot opacity.
+    fill: bool = False  # Fill the snapshot interior when true.
+    color: Any = "k"  # Matplotlib-compatible interior color.
+    zorder: int = 0  # Matplotlib layer order.
+    frequency: int = 2  # Simulation steps between snapshots.
+    keep_length: int = 0  # Maximum snapshots; 0 keeps all.
+
+
+@dataclass(frozen=True, slots=True)
+class ArrowStyle:
+    """Style and dimensions for the velocity arrow."""
+
+    color: Any = "gold"  # Matplotlib-compatible arrow color.
+    alpha: float = 1.0  # Arrow opacity.
+    zorder: int = 3  # Matplotlib layer order.
+    length: float = 0.4  # Length in environment data units.
+    width: float = 0.6  # Arrow-head width in data units.
+
+
+@dataclass(frozen=True, slots=True)
+class FovStyle:
+    """Style for the field-of-view patch."""
+
+    color: Any = "lightblue"  # Matplotlib-compatible interior color.
+    edge_color: Any = "blue"  # Matplotlib-compatible boundary color.
+    alpha: float = 0.5  # Region opacity.
+    zorder: int = 1  # Matplotlib layer order.
+
+
+@dataclass(frozen=True, slots=True)
+class ObjectPlotOptions:
+    """Complete immutable plotting configuration for one object."""
+
+    visibility: VisibilityOptions = field(default_factory=VisibilityOptions)
+    object: PatchStyle = field(default_factory=PatchStyle)
+    image: ImageStyle = field(default_factory=ImageStyle)
+    goal: PatchStyle = field(default_factory=lambda: PatchStyle(alpha=0.5, zorder=1))
+    trajectory: LineStyle = field(default_factory=LineStyle)
+    text: TextStyle = field(default_factory=TextStyle)
+    trail: TrailStyle = field(default_factory=TrailStyle)
+    arrow: ArrowStyle = field(default_factory=ArrowStyle)
+    fov: FovStyle = field(default_factory=FovStyle)
+
+    @classmethod
+    def defaul
```

**File**: `tests/test_plot.py` (modified, +324/-0)
```diff
@@ -5,16 +5,20 @@
 """
 
 import os
+from dataclasses import FrozenInstanceError
 from unittest.mock import Mock
 
 import matplotlib.pyplot as plt
 import numpy as np
 import pytest
+from matplotlib.colors import to_rgba
 
 import irsim
 import irsim.env.env_plot as env_plot_module
 from irsim.env.env_plot import EnvPlot, draw_patch
 from irsim.env.env_plot3d import EnvPlot3D
+from irsim.world.object_base import ObjectBase
+from irsim.world.object_plot import ObjectPlotOptions
 
 
 class TestEnvPlot2D:
@@ -377,6 +381,326 @@ def test__goal_text_creation(self, env_factory):
         plt.close(fig)
 
 
+class TestObjectPlot:
+    """Tests for the object-owned renderer boundary."""
+
+    def test_artist_state_stays_on_owner(self, env_factory):
+        env = env_factory("test_all_objects.yaml")
+        robot = env.robot
+
+        assert robot._object_plot.owner is robot
+        assert robot._object_plot._owner is robot
+        assert "object_patch" in vars(robot)
+        assert "object_patch" not in vars(robot._object_plot)
+
+    def test_legacy_renderer_attributes_delegate_to_owner(self):
+        obj = ObjectBase(
+            shape={"name": "circle", "radius": 0.2},
+            color="navy",
+            plot={"show_goal": True},
+        )
+
+        assert obj._object_plot.color == "navy"
+        assert obj._object_plot.plot_kwargs == {"show_goal": True}
+
+    def test_owner_aliases_stay_synchronized(self):
+        first = ObjectBase(shape={"name": "circle", "radius": 0.2})
+        second = ObjectBase(shape={"name": "circle", "radius": 0.3})
+
+        first._object_plot.owner = second
+
+        assert first._object_plot.owner is second
+        assert first._object_plot._owner is second
+        assert first._object_plot.radius == second.radius
+
+    def test_goal_text_is_optional_without_goal(self):
+        obj = ObjectBase(shape={"name": "circle", "radius": 0.2}, goal=None)
+        obj.show_goal = True
+        obj.show_goal_text = True
+
+        fig, ax = plt.subplots()
+        obj.plot_text(ax)
+
+        assert hasattr(obj, "_text")
+        assert not hasattr(obj, "_goal_text")
+        plt.close(fig)
+
+    def test_initial_object_style_uses_plot_overrides(self):
+        obj = ObjectBase(shape={"name": "circle", "radius": 0.2})
+
+        fig, ax = plt.subplots()
+        obj.plot_object(
+            ax,
+            obj_color="magenta",
+            obj_alpha=0.25,
+            obj_linewidth=2.5,
+        )
+
+        np.testing.assert_allclose(
+            obj.object_patch.get_facecolor(), to_rgba("magenta", alpha=0.25)
+        )
+        assert obj.object_patch.get_linewidth() == 2.5
+        plt.close(fig)
+
+    @pytest.mark.parametrize(
+        ("plot", "render_options", "expected_zorder"),
+        [
+            ({}, {}, 2),
+            ({"obj_zorder": 7}, {}, 7),
+            ({}, {"obj_zorder": 9}, 9),
+        ],
+    )
+    def test_object_image_preserves_legacy_zorder(
+        self, plot, render_options, expected_zorder
+    ):
+        obj = ObjectBase(
+            shape={"name": "rectangle", "length": 0.5, "width": 0.2},
+            role="robot",
+            description="diff_robot0.png",
+            plot=plot,
+        )
+
+        fig, ax = plt.subplots()
+        obj.plot_object(ax, **render_options)
+
+        assert obj.object_img.get_zorder() == expected_zorder
+        assert (
+            obj._object_plot._resolve_options(render_options).image.zorder
+            == expected_zorder
+        )
+        plt.close(fig)
+
+    def test_plot_options_are_grouped_immutable_values(self):
+        obj = ObjectBase(
+            shape={"name": "circle", "radius": 0.2},
+            color="navy",
+            plot={
+                "show_goal": True,
+                "obj_alpha": 0.3,
+                "keep_traj_length": 12,
+                "text_position": [0.4, 0.6],
+                "keep_trail_length": 8,
+                "arrow_length": 0.9,
+                "fov_color": "cyan",
+            },
+        )
+
+        options = obj._object_plot.options
+
+        assert isinstance(options, ObjectPlotOptions)
+        assert options.visibility.goal
+        assert options.object.alpha == 0.3
+        assert options.image.zorder == 2
+        assert options.goal.color == "navy"
+        assert options.trajectory.keep_length == 12
+        assert options.text.position == (0.4, 0.6)
+        assert options.trail.keep_length == 8
+        assert options.arrow.length == 0.9
+        assert options.fov.color == "cyan"
+        assert not hasattr(options, "__dict__")
+
+        with pytest.raises(FrozenInstanceError):
+            options.object.alpha = 0.8
+
+        overridden = options.with_overrides({"obj_alpha": 0.8})
+        assert options.object.alpha == 0.3
+        assert overridden.object.alpha == 0.8
+
+    def test_plot_dataclasses_have_fully_resolved_defaults(self):
+        options = ObjectPlotOptions()
+
+        assert options.object.alpha ==
```

---

### Incident Patch 9: `4730c3ea` (2026-07-16)
**Commit Message**: fix: keep circle center consistent across collision, render, G/h, and RVO (#344)

* fix: apply body-frame circle center in render, G/h, and RVO neighbor state

The collision geometry applies the circle center offset, but the render,
the G/h constraints, and the RVO neighbor disc used the object state
directly. All of them now follow the collision geometry. Configs with the
default center [0, 0] are not affected.

* fix: clamp asin ratio in hrvo mode to prevent domain error

config_rvo_mode and config_vo_mode already clamp the ratio before asin.
config_hrvo_mode missed the clamp and could raise ValueError for a
stationary ego with a fast neighbor.

* style: remove whitespace on blank line

* docs: clarify circle center geometry

**File**: `docs/source/yaml_config/configuration.md` (modified, +1/-1)
```diff
@@ -1034,7 +1034,7 @@ All `robot` and `obstacle` entities in the simulation are configured as objects
 
   - **`'circle'`**: Represents a circular shape.
     - **`radius`** (`float`): Radius of the circle. Default is `0.2`.
-    - **`center`** (`list`): Center (x, y) of the circle. Default is `[0, 0]`.
+    - **`center`** (`list`): Body-frame `[x, y]` offset of the circle center. It rotates with the object's heading. Default is `[0, 0]`. For an Ackermann circle, the effective center is additionally shifted forward by `wheelbase / 2`.
     - **`random_shape`** (`bool`): Whether to generate a random radius. Default is `False`.
     - **`radius_range`** (`list`): Range `[min_radius, max_radius]` for random radius generation if `random_shape` is `True`. Default is `[0.1, 1.0]`.
     - **`wheelbase`** (`float`): Wheelbase of the Ackermann steering vehicle. Required when using `'acker'` kinematics. Default is `None`.
```

**File**: `irsim/env/env_plot.py` (modified, +13/-3)
```diff
@@ -782,7 +782,9 @@ def draw_patch(
     Draw a geometric element (patch or line) on the given axes.
 
     Supported shapes and expected inputs (refer to irsim.world.object_base plotting patterns):
-    - circle: use ``state`` (x,y,theta) and ``radius``; created at origin and transformed
+
+    - circle: use ``state`` (x,y,theta), ``radius``, and optional ``center`` (body-frame
+      offset); created in the body frame and transformed, matching the collision geometry
     - rectangle: prefer ``vertices`` (2xN) else use ``width``/``height`` with ``state`` transform
     - polygon: use ``vertices`` (2xN)
     - ellipse: use ``width``/``height`` with ``state`` transform
@@ -791,6 +793,7 @@ def draw_patch(
     - line|linestring: use ``vertices`` (2xN) to draw a line element
 
     Styling:
+
     - color/edgecolor/facecolor, alpha, zorder, linestyle are respected when applicable.
 
     Returns the created matplotlib artist (patch, line, or list from ax.plot).
@@ -803,6 +806,7 @@ def draw_patch(
     edgecolor = kwargs.pop("edgecolor", None)
     alpha = kwargs.pop("alpha", None)
     fill = kwargs.pop("fill", None)
+    center = kwargs.pop("center", None)
 
     state = state if state is not None else np.zeros((3, 1))
 
@@ -812,8 +816,14 @@ def draw_patch(
             raise ValueError("circle requires radius")
 
         use_radius = radius
-        # Create at origin; translate/rotate with transform
-        patch = Circle((0.0, 0.0), use_radius)
+
+        if center is None:
+            xy = (0.0, 0.0)
+        else:
+            c = np.asarray(center, dtype=float).flatten()
+            xy = (c[0], c[1])
+        # Create at the body-frame center; translate/rotate with transform
+        patch = Circle(xy, use_radius)
         created_element = ax.add_patch(patch)
         set_patch_property(
             created_element,
```

**File**: `irsim/lib/algorithm/rvo.py` (modified, +5/-0)
```diff
@@ -217,6 +217,11 @@ def config_hrvo_mode(self, obstacle):
 
         ratio = (r + mr) / dis_mr
 
+        if ratio > 1:
+            ratio = 1
+        if ratio < -1:
+            ratio = -1
+
         half_angle = asin(ratio)
         line_left_ori = angle_mr + half_angle
         line_right_ori = angle_mr - half_angle
```

**File**: `irsim/lib/handler/geometry_handler.py` (modified, +2/-1)
```diff
@@ -78,8 +78,9 @@ def get_init_Gh(self):
         """
 
         if self.name == "circle":
+            # The circle may be offset from the body origin (center/wheelbase).
             G = np.array([[1, 0], [0, 1], [0, 0]])
-            h = np.array([[0], [0], [-self.radius]])
+            h = np.vstack((self.original_centroid, [[-self.radius]]))
             cone_type = "norm2"
             convex_flag = True
 
```

**File**: `irsim/world/object_base.py` (modified, +10/-4)
```diff
@@ -1637,6 +1637,9 @@ def plot_object(
                         shape=self.shape,
                         state=state,
                         radius=self.radius,
+                        center=(
+                            self.original_centroid if self.shape == "circle" else None
+                        ),
                         vertices=vertices,
                         color=self.color,
                         linestyle=obj_linestyle,
@@ -1983,6 +1986,7 @@ def plot_trail(
             state=state,
             vertices=vertices,
             radius=self.radius,
+            center=(self.original_centroid if trail_type == "circle" else None),
             width=self.length,
             height=self.width,
             edgecolor=trail_edgecolor,
@@ -2188,7 +2192,7 @@ def get_Gh(self) -> tuple[np.ndarray, np.ndarray]:
             tuple[np.ndarray, np.ndarray]: Tuple containing G matrix and h vector.
         """
         return self.gf.get_Gh(
-            center=self.position, radius=self.radius, vertices=self.vertices
+            center=self.centroid, radius=self.radius, vertices=self.vertices
         )
 
     def get_desired_omni_vel(self, goal_threshold=0.1, normalized=False) -> np.ndarray:
@@ -2661,15 +2665,17 @@ def rvo_neighbor_state(self):
         Get the RVO state for this object.
 
         Returns:
-            list: State [x, y, vx, vy, radius].
+            list: State [x, y, vx, vy, radius], with (x, y) at the geometry
+            centroid so the disc covers the collision geometry.
         """
         cached = getattr(self, "_rvo_neighbor_state_cache", None)
         if cached is not None:
             return cached
         vxy = self.velocity_xy
+        centroid = self.centroid
         out = [
-            self.state[0, 0],
-            self.state[1, 0],
+            centroid[0, 0],
+            centroid[1, 0],
             vxy[0, 0],
             vxy[1, 0],
             self.radius_extend,
```

**File**: `tests/conftest.py` (modified, +25/-0)
```diff
@@ -156,6 +156,31 @@ def _make(yaml_file: str, **kwargs: Any) -> Any:
 }
 
 
+CIRCLE_CENTER_WORLD_YAML = """
+world:
+  height: 10
+  width: 10
+  step_time: 0.1
+
+obstacle:
+  - shape: {name: 'circle', radius: 1.0, center: [1, 1]}
+    state: [5, 5, 0]
+
+  - shape: {name: 'circle', radius: 0.5, center: [1, 0]}
+    state: [5, 5, 1.57]
+"""
+
+
+@pytest.fixture
+def circle_center_world(tmp_path):
+    """World with circle obstacles offset by a body-frame ``center``:
+    one translated only, one rotated. Used by the render/collision and
+    G-h/RVO consistency tests."""
+    path = tmp_path / "circle_center_world.yaml"
+    path.write_text(CIRCLE_CENTER_WORLD_YAML)
+    return str(path)
+
+
 # ---------------------------------------------------------------------------
 # Keyboard mock helpers
 # ---------------------------------------------------------------------------
```

**File**: `tests/test_geometry.py` (modified, +40/-0)
```diff
@@ -7,6 +7,7 @@
 import numpy as np
 import pytest
 
+import irsim
 from irsim.lib.handler.geometry_handler import GeometryFactory
 
 
@@ -405,3 +406,42 @@ def test_array_reso(self):
         points = np.array([[0.0], [0.0]])
         pg = PointsGeometry(points=points, reso=np.array([[0.2], [0.3]]))
         assert pg.geometry is not None
+
+
+class TestCircleCenterConsistency:
+    """Circles with a body-frame center offset: the G/h cone constraints and
+    the RVO neighbor disc must sit on the same circle the collision geometry
+    uses, for both a translated and a rotated object state."""
+
+    def test_circle_gh_matches_collision_geometry(self, circle_center_world):
+        env = irsim.make(circle_center_world, display=False)
+
+        for obj in env.obstacle_list:
+            # Body frame: init G/h must encode the body-frame circle center.
+            _, h0, cone_type, convex = obj.get_init_Gh()
+            assert cone_type == "norm2"
+            assert convex
+            np.testing.assert_allclose(
+                h0[:2, 0], obj.original_centroid.flatten(), atol=1e-9
+            )
+            np.testing.assert_allclose(h0[2, 0], -obj.radius, atol=1e-9)
+
+            # World frame: the G/h center must be the collision centroid.
+            _, h, _, _ = obj.get_Gh()
+            np.testing.assert_allclose(
+                h[:2, 0], np.array(obj.geometry.centroid.coords[0]), atol=1e-6
+            )
+
+        env.end()
+
+    def test_rvo_neighbor_disc_matches_collision_geometry(self, circle_center_world):
+        env = irsim.make(circle_center_world, display=False)
+
+        for obj in env.obstacle_list:
+            x, y, _, _, r = obj.rvo_neighbor_state
+            np.testing.assert_allclose(
+                [x, y], np.array(obj.geometry.centroid.coords[0]), atol=1e-6
+            )
+            assert r >= obj.radius
+
+        env.end()
```

**File**: `tests/test_plot.py` (modified, +38/-0)
```diff
@@ -11,6 +11,7 @@
 import numpy as np
 import pytest
 
+import irsim
 import irsim.env.env_plot as env_plot_module
 from irsim.env.env_plot import EnvPlot, draw_patch
 from irsim.env.env_plot3d import EnvPlot3D
@@ -730,3 +731,40 @@ def test_save_animate_remove_buffer(self, dummy_world_2d, dummy_logger, tmp_path
             env_plot_module.imageio.imread = original_imread
 
         assert not buffer_dir.exists()
+
+
+class TestCircleCenterRender:
+    """Circles with a body-frame center offset must render on their collision
+    geometry, for both translated and rotated object states."""
+
+    @staticmethod
+    def _patch_center_in_data_coords(patch, ax):
+        """Map a Circle patch's center to data coords.
+
+        ``Circle.get_transform()`` maps unit-circle space to display space and
+        already includes the patch's own center, so the center is the image of
+        the unit-space origin.
+        """
+        display = patch.get_transform().transform((0.0, 0.0))
+        return ax.transData.inverted().transform(display)
+
+    def test_circle_center_offset_render_matches_collision(self, circle_center_world):
+        env = irsim.make(circle_center_world, display=False)
+        env.render()
+
+        ax = env._env_plot.ax
+        for obj in env.obstacle_list:
+            rendered = self._patch_center_in_data_coords(obj.object_patch, ax)
+            collision = np.array(obj.geometry.centroid.coords[0])
+            np.testing.assert_allclose(rendered, collision, atol=1e-6)
+
+        # Translated only: state (5, 5, 0) with center [1, 1] -> world (6, 6).
+        first = np.array(env.obstacle_list[0].geometry.centroid.coords[0])
+        np.testing.assert_allclose(first, [6.0, 6.0], atol=1e-6)
+
+        # Rotated: state (5, 5, 1.57) with center [1, 0] -> (5 + cos, 5 + sin).
+        second = np.array(env.obstacle_list[1].geometry.centroid.coords[0])
+        expected = [5.0 + np.cos(1.57), 5.0 + np.sin(1.57)]
+        np.testing.assert_allclose(second, expected, atol=1e-6)
+
+        env.end()
```

---

### Incident Patch 10: `7a447114` (2026-06-29)
**Commit Message**: fix: dash yaw oscillation, diff RVO stall when goal is behind, and headless keyboard queue overflow (#301) (#331)

* fix(behavior): fix yaw overshoot and velocity starvation in dash behaviors

The dash wrappers (diff, omni, omni_angular, acker) used the upper bound
from get_vel_range() as the velocity magnitude. When the robot spins CW,
this upper bound goes negative, causing the yaw command to flip direction.
When moving toward a goal in the negative body-frame direction, the upper
bound resets to near zero each step, so the robot stalls and never arrives.

The angular dash controllers also used bang-bang yaw: commanding max yaw
rate until the dead-band, then zero. The stopping distance is
omega^2 / (2*a), which causes the robot to overshoot and oscillate.

Fix:
- Use vel_max (always positive) to compute the ideal velocity.
- Add a discrete-time decel ramp to DiffDash and OmniAngularDash:
  omega <= -a*dt + sqrt(a^2*dt^2 + 2*a*remaining), so the robot always
  stops within angle_tolerance without overshoot.
- Clip the output to get_vel_range() in each wrapper so the command
  stays within the per-step acceleration limit.

* style: apply ruff format

* fix(behavior): turn diff RVO 

**File**: `irsim/gui/keyboard_control.py` (modified, +12/-1)
```diff
@@ -192,7 +192,18 @@ def __init__(self, env_ref: Any | None = None, **keyboard_kwargs: Any) -> None:
         except Exception:
             pass
 
-        if self.backend == "pynput" and _PYNPUT_AVAILABLE:
+        # Keyboard input is only meaningful with an interactive display. When
+        # headless (display=False) skip installing the global OS keyboard
+        # listener (and the matplotlib key-event fallback): pynput's listener
+        # triggers OS input-monitoring permission prompts and can overflow the
+        # event queue when many environments are spawned for parallel training.
+        # The matplotlib focus wiring above still runs; the handlers stay
+        # callable directly so tests and programmatic use are unaffected.
+        interactive = getattr(self.env_ref, "display", True) if self.env_ref else True
+
+        if not interactive:
+            self.listener = None
+        elif self.backend == "pynput" and _PYNPUT_AVAILABLE:
             # Use pynput global keyboard listener
             self.listener = keyboard.Listener(
                 on_press=self._on_pynput_press, on_release=self._on_pynput_release
```

**File**: `irsim/lib/behavior/behavior_methods.py` (modified, +85/-17)
```diff
@@ -115,8 +115,10 @@ def beh_diff_dash(
     state = ego_object.state
     goal = ego_object.goal
     goal_threshold = ego_object.goal_threshold
-    _, max_vel = ego_object.get_vel_range()
+    max_vel = ego_object.vel_max
     angle_tolerance = kwargs.get("angle_tolerance", 0.1)
+    angular_acce = ego_object.info.acce[1, 0]
+    dt = ego_object._world_param.step_time
 
     if goal is None:
         if ego_object._world_param.count % 10 == 0:
@@ -126,7 +128,11 @@ def beh_diff_dash(
 
         return np.zeros((2, 1))
 
-    return DiffDash(state, goal, max_vel, goal_threshold, angle_tolerance)
+    vel = DiffDash(
+        state, goal, max_vel, goal_threshold, angle_tolerance, angular_acce, dt
+    )
+    min_step, max_step = ego_object.get_vel_range()
+    return np.clip(vel, min_step, max_step)
 
 
 @register_behavior("omni", "dash")
@@ -155,8 +161,10 @@ def beh_omni_dash(
     state = ego_object.state
     goal = ego_object.goal
     goal_threshold = ego_object.goal_threshold
-    _, max_vel = ego_object.get_vel_range()
-    return OmniDash(state, goal, max_vel, goal_threshold)
+    max_vel = ego_object.vel_max
+    vel = OmniDash(state, goal, max_vel, goal_threshold)
+    min_step, max_step = ego_object.get_vel_range()
+    return np.clip(vel, min_step, max_step)
 
 
 @register_behavior("omni", "rvo")
@@ -336,9 +344,16 @@ def beh_omni_angular_dash(
     state = ego_object.state
     goal = ego_object.goal
     goal_threshold = ego_object.goal_threshold
-    _, max_vel = ego_object.get_vel_range()
+    max_vel = ego_object.vel_max
     angle_tolerance = kwargs.get("angle_tolerance", 0.1)
-    return OmniAngularDash(state, goal, max_vel, goal_threshold, angle_tolerance)
+    acce = ego_object.info.acce
+    angular_acce = acce[2, 0] if acce.shape[0] > 2 else float("inf")
+    dt = ego_object._world_param.step_time
+    vel = OmniAngularDash(
+        state, goal, max_vel, goal_threshold, angle_tolerance, angular_acce, dt
+    )
+    min_step, max_step = ego_object.get_vel_range()
+    return np.clip(vel, min_step, max_step)
 
 
 @register_behavior("acker", "dash")
@@ -368,10 +383,11 @@ def beh_acker_dash(
     state = ego_object.state
     goal = ego_object.goal
     goal_threshold = ego_object.goal_threshold
-    _, max_vel = ego_object.get_vel_range()
+    max_vel = ego_object.vel_max
     angle_tolerance = kwargs.get("angle_tolerance", 0.1)
-
-    return AckerDash(state, goal, max_vel, goal_threshold, angle_tolerance)
+    vel = AckerDash(state, goal, max_vel, goal_threshold, angle_tolerance)
+    min_step, max_step = ego_object.get_vel_range()
+    return np.clip(vel, min_step, max_step)
 
 
 def SFMVelocity(
@@ -559,7 +575,21 @@ def DiffRVO(
         line_obs_list=line_segments,
     )
     rvo_vel = rvo_behavior.cal_vel(mode)
-    return omni_to_diff(state_tuple[-1], rvo_vel)
+    diff_vel = omni_to_diff(state_tuple[-1], rvo_vel)
+
+    if not diff_vel.any() and not filtered_neighbor_list and not line_segments:
+        # With no neighbors or obstacles in range, a fully frozen command means
+        # the holonomic RVO solution collapsed toward zero velocity because the
+        # goal lies behind the robot (it cannot represent a reversal), so the
+        # diff robot would freeze forever instead of turning around. Rotate in
+        # place toward the desired heading; forward speed stays zero and
+        # ``omni_to_diff`` naturally stops the rotation once the robot faces its
+        # goal. When neighbors are present the freeze is collision avoidance and
+        # the robot must keep waiting, so this branch is skipped entirely.
+        diff_vel = omni_to_diff(state_tuple[-1], [state_tuple[5], state_tuple[6]])
+        diff_vel[0, 0] = 0.0
+
+    return diff_vel
 
 
 def OmniDash(
@@ -600,6 +630,8 @@ def OmniAngularDash(
     max_vel: np.ndarray,
     goal_threshold: float = 0.3,
     angle_tolerance: float = 0.1,
+    angular_acce: float = float("inf"),
+    dt: float = 0.0,
 ) -> np.ndarray:
     """
     Calculate body-frame velocity to reach a goal.
@@ -608,12 +640,22 @@ def OmniAngularDash(
     to face it. After arriving at the goal position, rotates in place
     to match the goal orientation.
 
+    The yaw rate is ramped down near the target so the robot can decelerate
+    to a stop within the remaining angle. The ramp uses the exact discrete-time
+    formula ``ω ≤ -a·dt + √(a²·dt² + 2·a·remaining)`` so the robot stops
+    cleanly within one step of ``angle_tolerance`` without overshoot.
+
     Args:
         state (np.array): Current state [x, y, theta] (3x1).
         goal (np.array): Goal state [x, y, theta] (3x1).
-        max_vel (np.array): Maximum velocity [forward, lateral, yaw_rate] (3x1).
+        max_vel (np.array): Absolute maximum velocity [forward, lateral, yaw_rate] (3x1).
         goal_threshold (float): Distance threshold to consider goal reached (default 0.3).
         angle_tolerance (float): Allowable angular deviation (default 0.1).
+        angular_acce (fl
```

**File**: `tests/test_all_objects.py` (modified, +15/-0)
```diff
@@ -542,6 +542,21 @@ def __init__(self, key):
     assert True  # Add keyboard control related assertions
 
 
+def test_keyboard_listener_skipped_when_headless():
+    """Headless envs must not start the global pynput keyboard listener.
+
+    The listener installs a global OS keyboard hook; starting one per env
+    triggers input-monitoring permission prompts and overflows the event queue
+    when many environments are created for parallel training. With display=False
+    the KeyboardControl object is still created (its handlers stay callable) but
+    no listener thread is started.
+    """
+    env = irsim.make("test_keyboard_control.yaml", save_ani=False, display=False)
+    assert hasattr(env, "keyboard")
+    assert env.keyboard.listener is None
+    env.end()
+
+
 def test_keyboard_control_mpl_backend():
     """Test keyboard control via Matplotlib backend key events."""
     # Ensure world is set to keyboard mode via YAML; KeyboardControl defaults to mpl backend
```

**File**: `tests/test_behaviors.py` (modified, +123/-1)
```diff
@@ -127,9 +127,13 @@ def test_behavior_filter_by_role(self, dummy_logger):
         ego.state = np.array([[0], [0], [0]])
         ego.goal = np.array([[1], [1]])
         ego.goal_threshold = 0.1
+        ego.vel_max = np.array([[1.0], [1.0]])
+        ego.info = Mock()
+        ego.info.acce = np.array([[1.0], [1.0]])
         ego.get_vel_range = Mock(
-            return_value=(np.array([[0], [0]]), np.array([[1], [1]]))
+            return_value=(np.array([[-1.0], [-1.0]]), np.array([[1.0], [1.0]]))
         )
+        ego._world_param.step_time = 0.1
         ego.max_speed = 1.0
 
         # This should filter out the obstacle and keep only the robot
@@ -206,18 +210,115 @@ def test_omni_angular_dash_with_goal(self, dummy_logger):
         ego.state = np.array([[0.0], [0.0], [0.0]])
         ego.goal = np.array([[5.0], [3.0], [1.0]])
         ego.goal_threshold = 0.3
+        ego.vel_max = np.array([[1.0], [1.0], [0.5]])
+        ego.info = Mock()
+        ego.info.acce = np.array([[1.0], [1.0], [3.0]])
         ego.get_vel_range = Mock(
             return_value=(
                 np.array([[-1.0], [-1.0], [-0.5]]),
                 np.array([[1.0], [1.0], [0.5]]),
             )
         )
         ego._world_param = Mock()
+        ego._world_param.step_time = 0.1
         ego.logger = Mock()
 
         result = beh_omni_angular_dash(ego, [])
         assert result.shape == (3, 1)
 
+    def test_omni_angular_dash_yaw_deceleration(self, dummy_logger):
+        """OmniAngularDash decel ramp: caps yaw below max, mirrors CCW/CW, inf → bang-bang."""
+        from irsim.lib.behavior.behavior_methods import OmniAngularDash
+
+        state = np.array([[0.0], [0.0], [0.0]])
+        goal_pos = np.array([[5.0], [0.0], [0.3]])  # goal heading 0.3 rad away
+        max_vel = np.array([[1.0], [1.0], [3.0]])
+        dt = 0.1
+
+        res = OmniAngularDash(
+            state,
+            goal_pos,
+            max_vel,
+            goal_threshold=6.0,
+            angle_tolerance=0.05,
+            angular_acce=3.0,
+            dt=dt,
+        )
+        assert abs(res[2, 0]) < 3.0, "decel ramp should limit yaw rate"
+
+        # Discrete-time ramp: ω·dt + ω²/(2a) ≤ remaining → no overshoot in one step
+        remaining = 0.3 - 0.05
+        a, omega = 3.0, abs(res[2, 0])
+        assert omega * dt + omega**2 / (2 * a) <= remaining + 1e-9, (
+            "overshoot in one step"
+        )
+
+        # CW goal must produce same magnitude as CCW
+        goal_cw = np.array([[5.0], [0.0], [-0.3]])
+        res_cw = OmniAngularDash(
+            state,
+            goal_cw,
+            max_vel,
+            goal_threshold=6.0,
+            angle_tolerance=0.05,
+            angular_acce=3.0,
+            dt=dt,
+        )
+        assert abs(res[2, 0]) == pytest.approx(abs(res_cw[2, 0]))
+        assert res_cw[2, 0] < 0
+
+        # inf acce → bang-bang (full yaw)
+        res_inf = OmniAngularDash(
+            state,
+            goal_pos,
+            max_vel,
+            goal_threshold=6.0,
+            angle_tolerance=0.05,
+        )
+        assert res_inf[2, 0] == pytest.approx(3.0)
+
+    def test_omni_angular_dash_yaw_capped_at_max_vel(self, dummy_logger):
+        """Large heading error: the decel ramp is capped at max_vel, not exceeded."""
+        from irsim.lib.behavior.behavior_methods import OmniAngularDash
+
+        # At goal position, but goal heading is ~pi away -> large remaining, so the
+        # uncapped decel ramp (~3.9) would exceed the 3.0 yaw-rate limit.
+        state = np.array([[0.0], [0.0], [0.0]])
+        goal = np.array([[0.0], [0.0], [3.0]])
+        max_vel = np.array([[1.0], [1.0], [3.0]])
+
+        res = OmniAngularDash(
+            state,
+            goal,
+            max_vel,
+            goal_threshold=0.5,
+            angle_tolerance=0.05,
+            angular_acce=3.0,
+            dt=0.1,
+        )
+        assert res[2, 0] == pytest.approx(3.0)
+
+    def test_diff_dash_angular_capped_at_max_vel(self, dummy_logger):
+        """Large heading error: DiffDash decel ramp is capped at max_vel."""
+        from irsim.lib.behavior.behavior_methods import DiffDash
+
+        # Goal directly behind -> heading error ~pi, so the uncapped ramp (~4.0)
+        # would exceed the 2.0 angular limit.
+        state = np.array([[0.0], [0.0], [0.0]])
+        goal = np.array([[-5.0], [0.0]])
+        max_vel = np.array([[1.0], [2.0]])
+
+        res = DiffDash(
+            state,
+            goal,
+            max_vel,
+            goal_threshold=0.1,
+            angle_tolerance=0.05,
+            angular_acce=3.0,
+            dt=0.1,
+        )
+        assert abs(res[1, 0]) == pytest.approx(2.0)
+
 
 class TestBehaviorMethodsFunctions:
     """Tests for standalone behavior method functions."""
@@ -240,6 +341,27 @@ def test_diff_rvo_neighbor_none(self):
         result = DiffRVO(state_tuple, neighbor_list=None)
         assert result.shape == (2, 1)
 
+    def test_dif
```

---

### Incident Patch 11: `c1a1d22a` (2026-06-29)
**Commit Message**: perf: keep animation frame size fixed and save video correctly (#330)

* perf: keep animation frame size fixed and save video correctly

The recorded frame size used to change when the figure window was
resized or zoomed, because bbox_inches="tight" recomputed it every
frame. Now the crop size is captured once from the first frame and
reused, so every frame is the same size. This also makes saving about
twice as fast.

Pad each video frame to an even size so the mp4 encoder no longer
resizes and distorts it. Restore the window size after each save so the
live window can still be resized without flickering.

Add an ani_kwargs option so env.end and ESC quit save the animation in
the chosen format (for example mp4) instead of always gif.

* fix(plot): pin animation frames to first saved frame size; copy ani_kwargs

Capture _save_size from the first frame actually saved (before
_init_save_bbox reads it), so a window resize before saving is honored
instead of forcing frames back to the construction-time size. Also copy
ani_kwargs on assignment so external mutation of the caller's dict can't
change the env's animation-save defaults.

**File**: `irsim/env/env_base.py` (modified, +10/-0)
```diff
@@ -91,6 +91,11 @@ class EnvBase:
             Default is False.
         save_ani (bool): Whether to save the simulation as an animation file.
             Useful for creating videos of simulation runs. Default is False.
+        ani_kwargs (dict, optional): Default keyword arguments for animation
+            saving (see :py:meth:`.EnvPlot.save_animate`), e.g.
+            ``{"suffix": ".mp4"}``. Honored by every save path, including
+            quitting with ESC; per-call ``end(**kwargs)`` overrides them.
+            Default is None.
         full (bool): Whether to display the visualization in full screen mode.
             Only effective on supported platforms. Default is False.
         log_file (str, optional): Path to the log file for saving simulation logs.
@@ -139,6 +144,7 @@ def __init__(
         display: bool = True,
         disable_all_plot: bool = False,
         save_ani: bool = False,
+        ani_kwargs: dict[str, Any] | None = None,
         full: bool = False,
         log_file: str | None = None,
         log_level: str = "INFO",
@@ -164,6 +170,9 @@ def __init__(
 
         self.disable_all_plot = disable_all_plot
         self.save_ani = save_ani
+        # Copy so later external mutation of the caller's dict can't change
+        # this env's default animation-save behavior.
+        self.ani_kwargs: dict[str, Any] = dict(ani_kwargs) if ani_kwargs else {}
 
         self._env_param.logger = EnvLogger(log_file, log_level)
 
@@ -557,6 +566,7 @@ def end(self, ending_time: float = 3.0, **kwargs: Any) -> None:
             return
 
         if self.save_ani:
+            kwargs = {**self.ani_kwargs, **kwargs}
             if "ani_name" not in kwargs:
                 kwargs["ani_name"] = f"animation_{self._world.name}"
 
```

**File**: `irsim/env/env_plot.py` (modified, +52/-1)
```diff
@@ -77,6 +77,11 @@ def __init__(
             dpi=self.saved_figure_kwargs["dpi"],
         )
 
+        # Default size for saved animation frames; refined on the first saved
+        # frame (see save_figure) so every frame is pinned to it
+        # (bbox_inches="tight" otherwise recomputes it from the window).
+        self._save_size = self.fig.get_size_inches().copy()
+
         self.viewpoint = world.plot_parse.get("viewpoint", None)
 
         # Initialize dynamic plotting lists
@@ -108,6 +113,8 @@ def _init_plot(
         world.plot_parse.update(kwargs)
         self.world = world
         self.saved_ani_kwargs: dict[str, Any] = {}
+        # Frozen crop box for animation frames (computed lazily on first save).
+        self._save_bbox: Any = None
         self.title = world.plot_parse.get("title", None)
         self.show_title = world.plot_parse.get("show_title", True)
         self.saved_figure_kwargs.update(world.plot_parse.get("saved_figure", {}))
@@ -449,7 +456,43 @@ def save_figure(
         else:
             full_name = fp + "/" + file_name + "." + file_format
 
-        self.fig.savefig(full_name, format=file_format, **self.saved_figure_kwargs)
+        save_kwargs = self.saved_figure_kwargs
+        restore_size = None
+        if save_gif:
+            # Save at the fixed initial size with a frozen crop box so every
+            # animation frame is the same size, then restore the window's current
+            # size so the user can still resize/zoom the live figure during render.
+            restore_size = self.fig.get_size_inches().copy()
+            if self._save_bbox is None:
+                # Pin every frame to the size of the first frame actually saved
+                # (which reflects any resize the user did before saving started),
+                # not the construction-time size. Set before _init_save_bbox,
+                # which reads self._save_size.
+                self._save_size = restore_size.copy()
+                self._save_bbox = self._init_save_bbox()
+            # forward=False resizes the figure for the save only, without
+            # resizing the on-screen window (which would flicker every frame).
+            self.fig.set_size_inches(self._save_size, forward=False)
+            save_kwargs = {**self.saved_figure_kwargs, "bbox_inches": self._save_bbox}
+
+        self.fig.savefig(full_name, format=file_format, **save_kwargs)
+
+        if restore_size is not None:
+            self.fig.set_size_inches(restore_size, forward=False)
+
+    def _init_save_bbox(self) -> Any:
+        """Tight crop box of the initial figure, captured once and reused.
+
+        Reusing one crop box (with the figure pinned to its initial size) keeps
+        every animation frame the same size, regardless of how the window was
+        resized or zoomed. The mp4 encoder's even-size requirement is handled at
+        write time (ffmpeg pad), not here, since bbox->pixel rounding can't
+        guarantee an even pixel count.
+        """
+        self.fig.set_size_inches(self._save_size, forward=False)
+        self.fig.canvas.draw()
+        pad = self.saved_figure_kwargs.get("pad_inches", 0.1)
+        return self.fig.get_tightbbox(self.fig.canvas.get_renderer()).padded(pad)
 
     def save_animate(
         self,
@@ -522,6 +565,14 @@ def save_animate(
             # Video format (e.g., .mp4) - stream frames to encoder
             video_kwargs = self.saved_ani_kwargs.copy()
             fps = video_kwargs.pop("fps", 10)
+            # H.264 needs even dimensions; the tight crop is often odd. Let ffmpeg
+            # pad (not resize) each frame up to even, so the video isn't distorted
+            # and the encoder doesn't reject odd sizes. macro_block_size=1 stops
+            # imageio from doing its own resize first.
+            video_kwargs.setdefault("macro_block_size", 1)
+            video_kwargs.setdefault(
+                "output_params", ["-vf", "pad=ceil(iw/2)*2:ceil(ih/2)*2:color=white"]
+            )
 
             # Use get_writer for memory-efficient streaming writes
             with imageio.get_writer(full_name, fps=fps, **video_kwargs) as writer:
```

**File**: `tests/test_env.py` (modified, +30/-0)
```diff
@@ -506,6 +506,36 @@ def test_animation_saving(self, env_factory, projection):
             env.render(0.01)
         env.end(ani_name="test_animation")
 
+    def test_ani_kwargs_honored_by_quit_and_overridable(self):
+        """ani_kwargs default is used by every save path (incl. ESC/quit) and
+        is overridable per call. See issue #301 (ESC saved .gif not .mp4)."""
+        from unittest.mock import MagicMock
+
+        # default format set up front
+        env = irsim.make(
+            "test_render.yaml",
+            save_ani=True,
+            display=False,
+            ani_kwargs={"suffix": ".mp4"},
+        )
+        env._env_plot.save_animate = MagicMock()
+
+        # ESC path: quit() calls end() itself -> must use the stored suffix
+        with pytest.raises(SystemExit):
+            env.quit()
+        assert env._env_plot.save_animate.call_args.kwargs["suffix"] == ".mp4"
+
+        # per-call kwargs override the stored default
+        env2 = irsim.make(
+            "test_render.yaml",
+            save_ani=True,
+            display=False,
+            ani_kwargs={"suffix": ".mp4"},
+        )
+        env2._env_plot.save_animate = MagicMock()
+        env2.end(ending_time=0, suffix=".gif")
+        assert env2._env_plot.save_animate.call_args.kwargs["suffix"] == ".gif"
+
 
 class TestRandomization:
     """Tests for randomization methods."""
```

---

### Incident Patch 12: `7cf41f68` (2026-06-02)
**Commit Message**: chore: add security and quality CI tooling (#314)

- Add Bandit security scan (CI job + pre-commit hook) with a justified
  [tool.bandit] config; switch config loading to yaml.safe_load to clear
  the one flagged finding.
- Add CodeQL and dependency-review workflows.
- Run the ty type checker in CI (non-blocking for now).
- Add SECURITY.md disclosure policy and CODEOWNERS.
- Enforce conventional commit messages via pre-commit; bump the pinned
  ruff hook to match the dev dependency.

**File**: `.github/CODEOWNERS` (added, +3/-0)
```diff
@@ -0,0 +1,3 @@
+# Default owner for everything in the repository.
+# Requested for review on every pull request.
+*       @hanruihua
```

**File**: `.github/SECURITY.md` (added, +28/-0)
```diff
@@ -0,0 +1,28 @@
+# Security Policy
+
+## Supported Versions
+
+Security fixes are applied to the latest released version of IR-SIM on PyPI.
+We recommend always running the most recent release.
+
+| Version | Supported          |
+| ------- | ------------------ |
+| latest  | :white_check_mark: |
+| older   | :x:                |
+
+## Reporting a Vulnerability
+
+Please **do not** report security vulnerabilities through public GitHub issues.
+
+Instead, report them privately via GitHub's
+[private vulnerability reporting](https://github.com/hanruihua/ir-sim/security/advisories/new),
+or by emailing the maintainer at **hanrh@connect.hku.hk**.
+
+Please include:
+
+- A description of the vulnerability and its impact.
+- Steps to reproduce (a minimal scenario YAML or script is ideal).
+- The IR-SIM version and Python version affected.
+
+We aim to acknowledge reports within 7 days and to provide a remediation
+timeline after triage. Thank you for helping keep IR-SIM and its users safe.
```

**File**: `.github/workflows/codeql.yml` (added, +36/-0)
```diff
@@ -0,0 +1,36 @@
+name: CodeQL
+
+on:
+  push:
+    branches: ["main"]
+  pull_request:
+    branches: ["main"]
+  schedule:
+    - cron: "0 0 * * 1"
+
+concurrency:
+  group: ${{ github.workflow }}-${{ github.ref }}
+  cancel-in-progress: true
+
+jobs:
+  analyze:
+    name: Analyze (Python)
+    runs-on: ubuntu-latest
+    permissions:
+      actions: read
+      contents: read
+      security-events: write
+
+    steps:
+      - uses: actions/checkout@v4
+
+      - name: Initialize CodeQL
+        uses: github/codeql-action/init@v3
+        with:
+          languages: python
+          queries: security-and-quality
+
+      - name: Perform CodeQL Analysis
+        uses: github/codeql-action/analyze@v3
+        with:
+          category: "/language:python"
```

**File**: `.github/workflows/dependency-review.yml` (added, +19/-0)
```diff
@@ -0,0 +1,19 @@
+name: Dependency Review
+
+on:
+  pull_request:
+    branches: ["main"]
+
+permissions:
+  contents: read
+
+jobs:
+  dependency-review:
+    runs-on: ubuntu-latest
+    steps:
+      - uses: actions/checkout@v4
+      - name: Dependency Review
+        uses: actions/dependency-review-action@v4
+        with:
+          comment-summary-in-pr: on-failure
+          fail-on-severity: high
```

**File**: `.github/workflows/lint.yml` (modified, +22/-0)
```diff
@@ -14,3 +14,25 @@ jobs:
       - uses: astral-sh/ruff-action@v3
       - run: ruff check
       - run: ruff format --check
+
+  bandit:
+    runs-on: ubuntu-latest
+    steps:
+      - uses: actions/checkout@v4
+      - name: Run Bandit security scan
+        run: pipx run 'bandit[toml]' -c pyproject.toml -r irsim
+
+  type-check:
+    runs-on: ubuntu-latest
+    steps:
+      - uses: actions/checkout@v4
+      - name: Install uv
+        uses: astral-sh/setup-uv@v6
+        with:
+          python-version: "3.12"
+          enable-cache: true
+      - run: uv sync --locked --dev
+      # `ty` is in preview; surface findings without failing the build yet.
+      - name: Run ty type checker
+        run: uv run ty check
+        continue-on-error: true
```

**File**: `.pre-commit-config.yaml` (modified, +22/-9)
```diff
@@ -1,10 +1,23 @@
 repos:
-- repo: https://github.com/astral-sh/ruff-pre-commit
-  # Ruff version.
-  rev: v0.12.8
-  hooks:
-    # Run the linter.
-    - id: ruff-check
-      args: [ --fix ]
-    # Run the formatter.
-    - id: ruff-format
\ No newline at end of file
+  - repo: https://github.com/astral-sh/ruff-pre-commit
+    # Ruff version. Keep in sync with the `ruff` dev dependency in pyproject.toml.
+    rev: v0.15.14
+    hooks:
+      # Run the linter.
+      - id: ruff-check
+        args: [--fix]
+      # Run the formatter.
+      - id: ruff-format
+
+  - repo: https://github.com/PyCQA/bandit
+    rev: 1.8.0
+    hooks:
+      - id: bandit
+        args: [-c, pyproject.toml]
+        additional_dependencies: ["bandit[toml]"]
+
+  - repo: https://github.com/compilerla/conventional-pre-commit
+    rev: v4.0.0
+    hooks:
+      - id: conventional-pre-commit
+        stages: [commit-msg]
```

**File**: `irsim/env/env_config.py` (modified, +1/-1)
```diff
@@ -64,7 +64,7 @@ def load_yaml(self, world_name: str | None = None) -> None:
 
         if self.world_file_path is not None:
             with open(self.world_file_path) as file:
-                com_list = yaml.load(file, Loader=yaml.FullLoader)
+                com_list = yaml.safe_load(file)
 
                 for key in com_list:
                     if key in self._kwargs_parse:
```

**File**: `pyproject.toml` (modified, +13/-3)
```diff
@@ -1,7 +1,7 @@
 [build-system]
 requires = ["setuptools>=61.0",
             ]
-                   
+
 build-backend = "setuptools.build_meta"
 
 [project]
@@ -61,6 +61,7 @@ lint = [
     "black>=25.1.0",
     "ruff>=0.12.8",
     "ty>=0.0.1a17",
+    "bandit[toml]>=1.8.0",
 ]
 test = [
     "pytest>=8.4.1",
@@ -121,12 +122,21 @@ exclude = ["docs", "tests"]
 
 [tool.ty.rules]
 unused-ignore-comment = "warn"
-possibly-unbound-import = "error"
+possibly-missing-import = "error"
 invalid-argument-type = "ignore"
 unresolved-import = "ignore"
 redundant-cast = "ignore"
 unresolved-attribute = "ignore"
-possibly-unbound-attribute = "ignore"
+possibly-missing-attribute = "ignore"
+
+[tool.bandit]
+# Scan the library source only; tests and docs are not shipped.
+exclude_dirs = ["tests", "docs", ".venv"]
+# Skips justified for a simulation library (no security-sensitive context):
+#   B101 assert_used      - asserts guard internal invariants
+#   B311 blacklist        - PRNG is for simulation sampling, not cryptography
+#   B110 try_except_pass  - intentional best-effort cleanup paths
+skips = ["B101", "B311", "B110"]
 
 [project.urls]
 "Homepage" = "https://ir-sim.readthedocs.io/en/stable/"
```

---

### Incident Patch 13: `aa10549d` (2026-05-26)
**Commit Message**: fix(plot): suppress default arrow on static obstacles (#313)

Gate the handler-derived show_arrow default on `not self.static` so YAML
obstacles without a `kinematics:` block no longer render the gold velocity
arrow from the kinematics factory's fallback DifferentialKinematics handler.
Dynamic diff/acker obstacles (with explicit `kinematics:`) still draw an
arrow by default; users can override either direction via `plot.show_arrow`.

Regression introduced by the kinematics-handler registry refactor (#237,
v2.9.2). Closes #312.

**File**: `changelog.md` (modified, +5/-0)
```diff
@@ -1,5 +1,10 @@
 # Changelog
 
+## 2.10.1
+
+- Fix:
+  - Suppress the default velocity arrow on static obstacles by gating the handler-derived `show_arrow` on `not self.static` (regression from v2.9.2's kinematics-handler registry refactor). ([#313](https://github.com/hanruihua/ir-sim/pull/313))
+
 ## 2.10.0 (2026-05-24)
 
 Minor release adding two new perception/behavior capabilities — the Social Force Model (SFM) for pedestrian-style crowd avoidance and a simplified 2D FMCW LiDAR sensor with per-beam radial velocity.
```

**File**: `irsim/world/object_base.py` (modified, +5/-1)
```diff
@@ -1137,9 +1137,13 @@ def _init_plot(self, ax, **kwargs):
         Returns:
             list: Names of plot attributes created (e.g., 'object_patch', 'goal_patch').
         """
-        # Apply handler-derived show_arrow default when not explicitly set
+        # Apply handler-derived show_arrow default only when the object is
+        # dynamic (has a kinematics handler and is not flagged static).
+        # Static objects — YAML obstacles without `kinematics:`, kf=None
+        # robots, anything routed through ObjectStatic — default to no arrow.
         if (
             self.kf is not None
+            and not self.static
             and "show_arrow" not in self.plot_kwargs
             and "show_arrow" not in kwargs
         ):
```

**File**: `tests/test_arrow_default.py` (added, +241/-0)
```diff
@@ -0,0 +1,241 @@
+"""Tests for the default `show_arrow` behavior across robots and obstacles.
+
+Regression: after the kinematics-handler registry refactor (#237, v2.9.2),
+YAML obstacles without a `kinematics:` block were unintentionally inheriting
+`show_arrow=True` — `KinematicsFactory.create_kinematics` falls back to a
+`DifferentialKinematics` instance even when no name is given, so the old
+`self.kf is not None` guard couldn't tell them apart from real dynamic
+obstacles.
+
+Rule the fix codifies: apply the handler-derived `show_arrow` default only
+when the object is *dynamic* — `self.kf is not None` AND `self.static is
+False`. `self.static` is True for ObjectStatic (used for any YAML object
+without kinematics, including kf=None robots), so this naturally suppresses
+arrows for purely static things while preserving them for diff/acker
+dynamic obstacles.
+"""
+
+import contextlib
+from pathlib import Path
+
+import matplotlib.pyplot as plt
+import pytest
+import yaml
+
+import irsim
+from irsim.world.object_base import ObjectBase
+
+
+def _write_yaml(path: Path, data: dict) -> Path:
+    path.write_text(yaml.safe_dump(data, sort_keys=False))
+    return path
+
+
+def _has_arrow(obj) -> bool:
+    """Return True if the object actually drew an arrow patch."""
+    return getattr(obj, "arrow_patch", None) is not None
+
+
+@pytest.fixture
+def scenario_factory(tmp_path):
+    """Build a minimal irsim env from an inline scenario dict."""
+    created = []
+
+    def _make(scenario: dict) -> object:
+        yaml_path = _write_yaml(tmp_path / "scenario.yaml", scenario)
+        env = irsim.make(str(yaml_path), save_ani=False, display=False)
+        created.append(env)
+        return env
+
+    yield _make
+
+    for env in created:
+        with contextlib.suppress(Exception):
+            env.end()
+
+
+BASE_WORLD = {
+    "height": 10,
+    "width": 10,
+    "step_time": 0.1,
+    "sample_time": 0.1,
+    "offset": [0, 0],
+}
+
+ROBOT_DIFF = {
+    "kinematics": {"name": "diff"},
+    "shape": {"name": "circle", "radius": 0.2},
+    "state": [1, 1, 0],
+    "goal": [9, 9, 0],
+}
+
+
+def test_robot_diff_has_arrow_by_default(scenario_factory):
+    """A diff-drive robot should show an arrow by default."""
+    env = scenario_factory(
+        {
+            "world": BASE_WORLD,
+            "robot": [ROBOT_DIFF],
+        }
+    )
+    env.render()
+    assert _has_arrow(env.robot), "diff robot should draw arrow by default"
+
+
+def test_static_obstacle_has_no_arrow(scenario_factory):
+    """A static YAML obstacle (no `kinematics:` block) should not draw an
+    arrow, even though the kinematics factory secretly attaches a fallback
+    DifferentialKinematics handler."""
+    env = scenario_factory(
+        {
+            "world": BASE_WORLD,
+            "robot": [ROBOT_DIFF],
+            "obstacle": [
+                {
+                    "shape": {"name": "circle", "radius": 1.0},
+                    "state": [5, 5, 0],
+                },
+                {
+                    "shape": {"name": "rectangle", "length": 1.5, "width": 1.2},
+                    "state": [6, 5, 1],
+                },
+            ],
+        }
+    )
+    env.render()
+    for obs in env.obstacle_list:
+        assert obs.static, f"YAML static obstacle {obs.name} should be flagged static"
+        assert not _has_arrow(obs), (
+            f"static obstacle {obs.name} should not draw an arrow by default"
+        )
+
+
+def test_dynamic_diff_obstacle_has_arrow_by_default(scenario_factory):
+    """A genuinely dynamic obstacle (diff kinematics declared in YAML) should
+    draw an arrow by default — it has a real kinematics handler with
+    `show_arrow=True` and is not flagged static."""
+    env = scenario_factory(
+        {
+            "world": BASE_WORLD,
+            "robot": [ROBOT_DIFF],
+            "obstacle": [
+                {
+                    "kinematics": {"name": "diff"},
+                    "shape": {"name": "circle", "radius": 0.3},
+                    "state": [3, 3, 0],
+                },
+            ],
+        }
+    )
+    env.render()
+    obs = env.obstacle_list[0]
+    assert not obs.static, "diff obstacle should not be flagged static"
+    assert _has_arrow(obs), "dynamic diff obstacle should draw arrow by default"
+
+
+def test_dynamic_omni_obstacle_has_no_arrow_by_default(scenario_factory):
+    """Omni kinematics defaults `show_arrow=False` at the handler level, so
+    even a dynamic omni obstacle should not draw an arrow."""
+    env = scenario_factory(
+        {
+            "world": BASE_WORLD,
+            "robot": [ROBOT_DIFF],
+            "obstacle": [
+                {
+                    "kinematics": {"name": "omni"},
+                    "shape": {"name": "circle", "radius": 0.3},
+                    "state": [3, 7, 0],
+                },
+            ],
+        }
+    )
+    env.render()
+    obs = env.obstacle_list[0]
+    assert not obs.static
+    as
```

---

### Incident Patch 14: `02276019` (2026-04-21)
**Commit Message**: fix(env): refresh geometry/sensors on reset without a fake step (#284)

set_velocity(init=True) had no effect after env.reset() because the
refresh step inside reset() ran object.step() with a zero action, which
overwrote _velocity with the behavior-computed value (and, for noisy
kinematics, drifted _state).

Add ObjectBase.refresh() (geometry + geometry_valid + sensor_step) and
EnvBase.refresh() (refresh each object + rebuild tree + status). Use
env.refresh() from reset() instead of the fake kinematic step.

**File**: `irsim/env/env_base.py` (modified, +18/-1)
```diff
@@ -761,8 +761,8 @@ def reset(self, random: bool = False) -> None:
             return
 
         self._reset_all()
-        self.step(action=[np.zeros((2, 1))] * self.robot_number)
         self._world.reset()
+        self.refresh()
         self.reset_plot()
         self.set_status("Reset")
         self.pause_flag = False
@@ -773,6 +773,23 @@ def reset(self, random: bool = False) -> None:
     def _reset_all(self) -> None:
         [obj.reset() for obj in self.objects]
 
+    def refresh(self) -> None:
+        """
+        Refresh state-derived attributes across the environment without
+        advancing the simulation.
+
+        Calls ``ObjectBase.refresh`` on every object (geometry, geometry
+        validity, sensor readings), rebuilds the collision STRtree, and
+        re-evaluates collision/arrival status. Used after ``reset`` and
+        whenever callers mutate object states directly and need derived
+        views (geometry, sensors, collisions) brought up to date.
+        """
+
+        for obj in self.objects:
+            obj.refresh()
+        self.build_tree()
+        self._status_step()
+
     def reset_plot(self) -> None:
         """
         Reset the environment figure in-place.
```

**File**: `irsim/world/object_base.py` (modified, +11/-0)
```diff
@@ -2064,6 +2064,17 @@ def reset(self):
         self.stop_flag = False
         self.trajectory = []
 
+    def refresh(self):
+        """
+        Refresh state-derived attributes (geometry and sensors) without
+        advancing the simulation. Used after ``reset`` so geometry/sensor
+        readings reflect the current state without running a kinematic
+        step (which would clobber ``_velocity`` and add noise drift).
+        """
+        self._geometry = self.gf.step(self.state)
+        self._geometry_valid = shapely.is_valid(self._geometry)
+        self.sensor_step()
+
     def remove(self):
         """
         Remove the object from the environment.
```

#### Recent Merged Pull Requests:
- **PR #381** (2026-10-04): docs: refresh GIFs and link them from the ir-sim-gifs repo (@hanruihua)
- **PR #380** (2026-10-04): fix(env): survive scene rebuilds without a keyboard, isolate logging per environment, and fix arrival in state mode (@hanruihua)
- **PR #379** (2026-10-03): fix(sensor): keep lidar readings in band, scan at construction, and offer inf ranges on request (@hanruihua)
- **PR #378** (2026-10-03): fix(behavior): correct reactive velocity commands for rvo, sfm and orca (@hanruihua)
- **PR #377** (2026-10-03): fix(env): assign group actions by member and keep the map out of groups (@hanruihua)
- **PR #375** (2026-10-02): chore(deps): bump the dependencies group with 4 updates (@dependabot[bot])
- **PR #374** (2026-10-04): feat(collision): add contact mode with rigid-body pushing physics (@hanruihua)
- **PR #373** (2026-09-18): feat(config): print-safe default colors as a runtime palette parameter (@hanruihua)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
