# Forensic Learning Record (Deep Inspection): google-deepmind/concordia

> **Canonical Artifact**: `07_PROJECT_LEARNING/google-deepmind-concordia-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/google-deepmind/concordia](https://github.com/google-deepmind/concordia))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-09-30T20:17:46.411Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `google-deepmind/concordia`
- **Description**: A library for generative social simulation
- **Primary Language / Ecosystem**: Python
- **Discovered Manifests / Configurations**: pyproject.toml, README.md
- **Stars / Engagement**: 1750 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: pyproject.toml, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `concordia/__init__.py`
```
# Copyright 2023 DeepMind Technologies Limited.
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#     https://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.



```

### Core Architecture Module: `concordia/agents/__init__.py`
```
# Copyright 2023 DeepMind Technologies Limited.
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#     https://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.



```

### Core Architecture Module: `concordia/agents/entity_agent.py`
```
# Copyright 2023 DeepMind Technologies Limited.
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#     https://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.

"""A modular entity agent using the new component system."""

from collections.abc import Mapping
from concurrent import futures
import functools
import threading
import traceback
import types
from typing import cast, override

from absl import logging
from concordia.typing import entity
from concordia.typing import entity_component
from concordia.utils import concurrency


class EntityAgent(entity_component.EntityWithComponents):
  """An agent that has its functionality defined by components.

  The agent has a set of components that define its functionality. The agent
  must have at least an ActComponent and an ObserveComponent. The agent will
  call the ActComponent's `act` method when it needs to act, and the
  ObservationComponent's `observe` method when they need to process an
  observation.
  """

  def __init__(
      self,
      agent_name: str,
      act_component: entity_component.ActingComponent,
      context_components: Mapping[str, entity_component.ContextComponent] = (
          types.MappingProxyType({})
      ),
  ):
    """Initializes the agent.

    The passed components will be owned by this entity agent (i.e. their
    `set_entity` method will be called with this entity as the argument).

    Args:
      agent_name: The name of the agent.
      act_component: The component that will be used to act.
      context_components: The ContextComponents that will be used by the agent.
    """
    super().__init__()
    self._agent_name = agent_name
    self._control_lock = threading.Lock()
    self._phase_lock = threading.Lock()
    self._phase = entity_component.Phase.READY
    self._capture_key_by_thread: dict[int, str] = {}
    self._active_capture_key: str = agent_name

    self._act_component = act_component
    self._act_component.set_entity(self)

    self._context_components = dict(context_components)
    for component in self._context_components.values():
      component.set_entity(self)

  @override
  @functools.cached_property
  def name(self) -> str:
    return self._agent_name

  @override
  def get_phase(self) -> entity_component.Phase:
    with self._phase_lock:
      return self._phase

  def _set_phase(self, phase: entity_component.Phase) -> None:
    with self._phase_lock:
      self._phase.check_successor(phase)
      self._phase = phase

  @override
  def get_component(
      self,
      name: str,
      *,
      type_: type[entity_component.ComponentT] = entity_component.BaseComponent,
  ) -> entity_component.ComponentT:
    component = self._context_components[name]
    return cast(entity_component.ComponentT, component)

  def get_act_component(self) -> entity_component.ActingComponent:
    return self._act_component

  def get_all_context_components(
      self,
  ) -> Mapping[str, entity_component.ContextComponent]:
    return types.MappingProxyType(self._context_components)

  def _parallel_call_(
      self,
      method_name: str,
      *args,
      executor: futures.ThreadPoolExecutor | None = None,
  ) -> entity_component.ComponentContextMapping:
    """Calls the named method in parallel on all components.

    If a component instance is registered under multiple names, its method
    will only be called once. The result of that call will be mapped to all
    names under which it was registered.

    All calls will be issued with the same payloads.

    Args:
      method_name: The name of the method to call.
      *args: The arguments to pass to the method.
      executor: An optional existing ThreadPoolExecutor to use.

    Returns:
      A ComponentsContext, that is, a mapping of component name to the result of
      the method call.
    """
    # 1. Identify unique component instances.
    unique_components = list(set(self._context_components.values()))

    # 2. Create and execute tasks for each unique component instance once.
    tasks_for_unique = {
        str(id(component)): functools.partial(
            getattr(component, method_name), *args
        )
        for component in unique_components
    }
    results_by_component_id = concurrency.run_tasks(
        tasks_for_unique, executor=executor
    )

    # 3. Construct the final results dictionary.
    final_results: dict[str, str] = {}
    for name, component in self._context_components.items():
      final_results[name] = results_by_component_id[str(id(component))]

    return types.MappingProxyType(final_results)

  @override
  def act(
      self, action_spec: entity.ActionSpec = entity.DEFAULT_ACTION_SPEC
  ) -> str:
    with self._control_lock:
      # Activate per-thread capture key so log data from this act() call
      # is routed to the correct entity thread's capture context.
      key_override = self._capture_key_by_thread.get(
          threading.current_thread().ident  # pyrefly: ignore[bad-argument-type]
      )
      if key_override is not None:
        self._active_capture_key = key_override
      try:
        self._set_phase(entity_component.Phase.PRE_ACT)
        contexts = self._parallel_call_('pre_act', action_spec)
        action_attempt = self._act_component.get_action_attempt(
            contexts, action_spec
        )

        self._set_phase(entity_component.Phase.POST_ACT)
        self._parallel_call_('post_act', action_attempt)

        self._set_phase(entity_component.Phase.UPDATE)
        self._parallel_call_('update')

        self._set_phase(entity_component.Phase.READY)

        return action_attempt
      except Exception:
        # Ensure correct error handling in the case of multiple threads
        # using the same entity by setting the phase to ready before raising.
        self.set_phase(entity_component.Phase.READY)
        raise
      finally:
        self._active_capture_key = self._agent_name

  @override
  def observe(self, observation: str) -> None:
    with self._control_lock:
      # Activate per-thread capture key (same as act()).
      key_override = self._capture_key_by_thread.get(
          threading.current_thread().ident  # pyrefly: ignore[bad-argument-type]
      )
      if key_override is not None:
        self._active_capture_key = key_override
      try:
        self._set_phase(entity_component.Phase.PRE_OBSERVE)
        self._parallel_call_('pre_observe', observation)

        self._set_phase(entity_component.Phase.POST_OBSERVE)
        self._parallel_call_('post_observe')

        self._set_phase(entity_component.Phase.UPDATE)
        self._parallel_call_('update')

        self._set_phase(entity_component.Phase.READY)
      except Exception:
        # Ensure correct error handling in the case of multiple threads
        # using the same entity by setting the phase to ready before raising.
        self.set_phase(entity_component.Phase.READY)
        raise
      finally:
        self._active_capture_key = self._agent_name

  def set_state(
      self, entity_components_state: entity_component.EntityState
  ) -> None:
    """Sets the state of the agent."""

    # Restore context components
    context_components_state = entity_components_state.get(
        'context_components', {}
    )
    for component_name, component in self._context_components.items():
      if component_name in context_components_state:
        try:
          component.set_state(context_components_state[component_name])  # pyrefly: ignore[bad-argument-type]
        except Exception:  # pylint: disable=broad-exception-caught
      
```

### Core Architecture Module: `concordia/agents/entity_agent_with_logging.py`
```
# Copyright 2023 DeepMind Technologies Limited.
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#     https://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.

"""A modular entity agent that supports logging from components."""

from collections.abc import Mapping
import types
from typing import Any

from concordia.agents import entity_agent
from concordia.typing import entity as entity_lib
from concordia.typing import entity_component
from concordia.utils import measurements as measurements_lib


class EntityAgentWithLogging(entity_agent.EntityAgent,
                             entity_lib.EntityWithLogging):
  """An agent that exposes the latest information of each component."""

  def __init__(
      self,
      agent_name: str,
      act_component: entity_component.ActingComponent,
      context_components: Mapping[str, entity_component.ContextComponent] = (
          types.MappingProxyType({})
      ),
      measurements: measurements_lib.Measurements | None = None,
  ):
    """Initializes the agent.

    The passed components will be owned by this entity agent (i.e. their
    `set_entity` method will be called with this entity as the argument).

    Whenever `get_last_log` is called, the latest values published in all the
    channels in the given measurements object will be returned as a mapping of
    channel name to value.

    Args:
      agent_name: The name of the agent.
      act_component: The component that will be used to act.
      context_components: The ContextComponents that will be used by the agent.
      measurements: Optional measurements instance to use for logging. Defaults
        to a standard Measurements().
    """
    super().__init__(
        agent_name=agent_name,
        act_component=act_component,
        context_components=context_components,
    )
    self._component_logging = (
        measurements
        if measurements is not None
        else measurements_lib.Measurements()
    )

    for component_name, component in self._context_components.items():
      if isinstance(component, entity_component.ComponentWithLogging):
        channel_name = component_name
        component.set_logging_channel(
            lambda datum, ch=channel_name: self._component_logging.publish_datum(
                ch, datum, capture_key=self._active_capture_key
            )
        )
    if isinstance(act_component, entity_component.ComponentWithLogging):
      act_component.set_logging_channel(
          lambda datum: self._component_logging.publish_datum(
              '__act__', datum, capture_key=self._active_capture_key
          )
      )

  # Per-thread capture key routing for async log isolation. The async
  # engine registers entity_name -> thread_id mappings so that when
  # multiple entity threads share a game master, each thread's
  # game_master.act() publishes log data with the calling entity's name
  # as the capture_key, not the game master's name.

  def set_capture_key_for_thread(
      self, thread_id: int, entity_name: str
  ) -> None:
    """Register a per-thread capture key for async log isolation."""
    if not hasattr(self, '_capture_key_by_thread'):
      self._capture_key_by_thread = {}
    self._capture_key_by_thread[thread_id] = entity_name

  def get_capture_key_for_thread(self, thread_id: int) -> str | None:
    """Get the per-thread capture key."""
    if hasattr(self, '_capture_key_by_thread'):
      return self._capture_key_by_thread.get(thread_id)
    return None

  def clear_capture_key_for_thread(self, thread_id: int) -> None:
    """Remove the per-thread capture key when the entity loop exits."""
    if hasattr(self, '_capture_key_by_thread'):
      self._capture_key_by_thread.pop(thread_id, None)

  @property
  def measurements(self) -> measurements_lib.Measurements:
    return self._component_logging

  def get_all_logs(self):
    return self._component_logging.get_all_channels()

  def get_last_log(self):
    log: dict[str, Any] = {}
    for channel_name in sorted(self._component_logging.available_channels()):
      log[channel_name] = self._component_logging.get_last_datum(channel_name)
    return log

```

### Core Architecture Module: `concordia/associative_memory/__init__.py`
```
# Copyright 2025 DeepMind Technologies Limited.
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#     https://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.

```

### Core Architecture Module: `concordia/associative_memory/basic_associative_memory.py`
```
# Copyright 2023 DeepMind Technologies Limited.
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#     https://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.


"""An associative memory with basic retrieval methods."""

from collections.abc import Callable, Iterable, Sequence
import io
import threading

from concordia.typing import entity_component
import numpy as np
import pandas as pd


StringIO = io.StringIO


class AssociativeMemoryBank:
  """Class that implements associative memory."""

  def __init__(
      self,
      sentence_embedder: Callable[[str], np.ndarray] | None = None,
      allow_duplicates: bool = False,
  ):
    """Constructor.

    Args:
      sentence_embedder: text embedding model, if None then skip setting the
        embedder on initialization of the object. It still must be set before
        calling `add` or `retrieve` methods.
      allow_duplicates: if True, allow adding duplicate entries to the memory.
        This is useful for Game Master memories where the same action may recur
        across different rounds.
    """
    self._memory_bank_lock = threading.Lock()
    self._embedder = sentence_embedder
    self._allow_duplicates = allow_duplicates

    self._memory_bank = pd.DataFrame(columns=['text', 'embedding'])
    self._stored_hashes = set()
    self._pending_memories = []  # Batch accumulator for performance

  def get_state(self) -> entity_component.ComponentState:
    """Converts the AssociativeMemory to a dictionary."""

    with self._memory_bank_lock:
      self._flush_pending()
      output = {
          'stored_hashes': list(self._stored_hashes),
          'memory_bank': self._memory_bank.to_json(),
      }
    return output

  def set_state(self, state: entity_component.ComponentState) -> None:
    """Sets the AssociativeMemory from a dictionary."""

    with self._memory_bank_lock:
      self._stored_hashes = set(state['stored_hashes'])  # pyrefly: ignore[bad-argument-type]
      self._memory_bank = pd.read_json(StringIO(state['memory_bank']))  # pyrefly: ignore[bad-argument-type]
      self._pending_memories.clear()  # Clear any pending on state restore

  def _flush_pending(self) -> None:
    """Flushes pending memories to the DataFrame.

    This method should be called with _memory_bank_lock held.
    """
    if self._pending_memories:
      new_df = pd.DataFrame(self._pending_memories)
      self._memory_bank = pd.concat(
          [self._memory_bank, new_df], ignore_index=True
      )
      self._pending_memories.clear()

  def add(
      self,
      text: str,
  ) -> None:
    """Adds nonduplicated entries (time, text, tags, importance) to the memory.

    Args:
      text: what goes into the memory
    """
    if not self._embedder:
      raise ValueError('Embedder must be set before calling `add` method.')

    # Remove all newline characters from memories.
    text = text.replace('\n', ' ')

    contents = {
        'text': text,
    }
    hashed_contents = hash(tuple(contents.values()))

    with self._memory_bank_lock:
      if not self._allow_duplicates and hashed_contents in self._stored_hashes:
        return

      derived = {'embedding': self._embedder(text)}
      memory_row = contents | derived
      self._pending_memories.append(memory_row)
      self._stored_hashes.add(hashed_contents)

  def extend(
      self,
      texts: Iterable[str],
  ) -> None:
    """Adds the texts to the memory.

    Args:
      texts: list of strings to add to the memory
    """
    for text in texts:
      self.add(text)

  def get_data_frame(self) -> pd.DataFrame:
    with self._memory_bank_lock:
      self._flush_pending()
      return self._memory_bank.copy()

  def _get_top_k_cosine(self, x: np.ndarray, k: int):
    """Returns the top k most cosine similar rows to an input vector x.

    Args:
      x: The input vector.
      k: The number of rows to return.

    Returns:
      Rows, sorted by cosine similarity in descending order.
    """
    with self._memory_bank_lock:
      self._flush_pending()
      cosine_similarities = self._memory_bank['embedding'].apply(
          lambda y: np.dot(x, y)
      )

      # Sort the cosine similarities in descending order.
      cosine_similarities.sort_values(ascending=False, inplace=True)

      # Return the top k rows.
      return self._memory_bank.iloc[cosine_similarities.head(k).index]

  def _pd_to_text(
      self,
      data: pd.DataFrame,
  ) -> Sequence[str]:
    """Formats a dataframe into list of strings.

    Args:
      data: the dataframe to process

    Returns:
      A list of strings, one for each memory
    """
    if data.empty:
      return []
    output = data['text']

    return output.tolist()

  def retrieve_associative(
      self,
      query: str,
      k: int = 1,
  ) -> Sequence[str]:
    """Retrieve memories associatively.

    Args:
      query: a string to use for retrieval
      k: how many memories to retrieve

    Returns:
      List of strings corresponding to memories, sorted by cosine similarity
    """
    if not self._embedder:
      raise ValueError('Embedder must be set before calling the '
                       '`retrieve_associative` method.')

    if k <= 0:
      raise ValueError('Limit must be positive.')

    query_embedding = self._embedder(query)

    data = self._get_top_k_cosine(query_embedding, k)

    return self._pd_to_text(data)

  def scan(self, selector_fn: Callable[[str], bool]):
    """Retrieve memories that match the selector function.

    Args:
      selector_fn: a function that takes a string and returns a boolean
        indicating whether the string matches the selector

    Returns:
      List of strings corresponding to memories, sorted by recency
    """
    with self._memory_bank_lock:
      self._flush_pending()
      if self._memory_bank.empty:
        return []
      is_selected = self._memory_bank['text'].apply(selector_fn)
      data = self._memory_bank[is_selected]
    return self._pd_to_text(data)

  def retrieve_recent(
      self,
      k: int = 1,
  ) -> Sequence[str]:
    """Retrieve memories by recency.

    Args:
      k: number of entries to retrieve

    Returns:
      List of strings corresponding to memories, sorted by recency
    """
    if k <= 0:
      raise ValueError('Limit must be positive.')

    with self._memory_bank_lock:
      self._flush_pending()
      if self._memory_bank.empty:
        return []
      return self._pd_to_text(self._memory_bank.iloc[-k:])

  def __len__(self):
    """Returns the number of entries in the memory bank.

    Since memories cannot be deleted, the length cannot decrease, and can be
    used to check if the contents of the memory bank have changed.
    """
    with self._memory_bank_lock:
      self._flush_pending()
      return len(self._memory_bank)

  def get_all_memories_as_text(
      self,
  ) -> Sequence[str]:
    """Returns all memories in the memory bank as a sequence of strings."""
    memories_data_frame = self.get_data_frame()
    texts = self._pd_to_text(memories_data_frame)
    return texts

  def set_embedder(self, embedder: Callable[[str], np.ndarray]):
    """Sets the embedder for the memory bank."""
    self._embedder = embedder

```

### Core Architecture Module: `concordia/command_line_interface/__init__.py`
```
# Copyright 2025 DeepMind Technologies Limited.
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#     https://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.

```

### Core Architecture Module: `concordia/command_line_interface/concordia_log.py`
```
# Copyright 2025 DeepMind Technologies Limited.
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#     https://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.

"""CLI tool for analyzing Concordia simulation logs.

Usage:
  concordia-log overview sim.json
  concordia-log actions sim.json Alice
  concordia-log context sim.json Alice --step 3
  concordia-log step sim.json 5
  concordia-log timeline sim.json Alice
  concordia-log search sim.json "keyword"
  concordia-log memories sim.json Alice
  concordia-log components sim.json --component tension_tracker
  concordia-log entities sim.json
  concordia-log dump sim.json | jq '...'
  concordia-log bundle sim.json --output sim_viewer.html

Add --json for structured JSON output.
"""

import argparse
import json
import pathlib
import re
import sys

from concordia.utils import log_viewer
from concordia.utils import structured_logging


_IMAGE_MARKDOWN_PATTERN = re.compile(r'!\[([^\]]*)\]\(data:image/[^)]+\)')


def _strip_images(text: str) -> str:
  def _replacer(match):
    full = match.group(0)
    alt = match.group(1) or 'image'
    data_len = len(full)
    return f'[{alt}: {data_len:,} bytes]'

  return _IMAGE_MARKDOWN_PATTERN.sub(_replacer, text)


def _format_text(text: str, include_images: bool = False) -> str:
  if include_images:
    return str(text)
  return _strip_images(str(text))


def _load_log(
    path: str,
) -> structured_logging.SimulationLog:
  with open(path) as f:
    return structured_logging.SimulationLog.from_json(f.read())


def _load_interface(
    path: str,
) -> tuple[
    structured_logging.AIAgentLogInterface,
    structured_logging.SimulationLog,
]:
  log = _load_log(path)
  return structured_logging.AIAgentLogInterface(log), log


def _print_json(data, include_images: bool = False):
  def _default(obj):
    return str(obj)

  text = json.dumps(data, indent=2, default=_default, ensure_ascii=False)
  if not include_images:
    text = _strip_images(text)
  print(text)


def cmd_overview(args):
  """Show simulation overview statistics."""
  interface, _ = _load_interface(args.log_file)
  overview = interface.get_overview()
  if args.json:
    _print_json(overview)
  else:
    print(f"Steps: {overview.get('total_steps', 0)}")
    print(f"Entries: {overview.get('total_entries', 0)}")
    entities = overview.get('entities', [])
    print(f"Entities ({len(entities)}): {', '.join(entities)}")
    components = overview.get('components', [])
    if components:
      print(f"Log sources: {', '.join(components)}")
    entry_types = overview.get('entry_types', [])
    if entry_types:
      print(f"Entry types: {', '.join(entry_types)}")


def cmd_entities(args):
  """List all entity names."""
  interface, _ = _load_interface(args.log_file)
  overview = interface.get_overview()
  entities = overview.get('entities', [])
  if args.json:
    _print_json(entities)
  else:
    for name in entities:
      print(name)


def cmd_actions(args):
  """Show entity action timeline."""
  interface, _ = _load_interface(args.log_file)
  actions = interface.get_entity_actions(args.entity)
  if args.json:
    _print_json(actions, include_images=args.include_images)
  else:
    if not actions:
      print(f"No actions found for entity '{args.entity}'.", file=sys.stderr)
      return
    for a in actions:
      action_text = _format_text(
          a.get('action', ''), include_images=args.include_images
      )
      action_text = action_text.replace('\n', ' ').strip()
      print(f"Step {a.get('step', '?')}: {action_text}")


def cmd_context(args):
  """Show full action context for one step."""
  interface, _ = _load_interface(args.log_file)
  ctx = interface.get_entity_action_context(args.entity, step=args.step)
  if args.json:
    _print_json(ctx, include_images=args.include_images)
  else:
    if not ctx:
      print(
          f"No context found for '{args.entity}' at step {args.step}.",
          file=sys.stderr,
      )
      return
    action = _format_text(
        ctx.get('action', ''), include_images=args.include_images
    )
    print(f'Action: {action}')
    observations = ctx.get('observations', '')
    if observations:
      print(
          f'\nObservations:\n{_format_text(observations, include_images=args.include_images)}'
      )
    prompt = ctx.get('action_prompt', '')
    if prompt:
      print(
          f'\nPrompt:\n{_format_text(prompt, include_images=args.include_images)}'
      )
    all_components = ctx.get('all_components', {})
    if all_components:
      print('\nComponents:')
      for key, val in all_components.items():
        if key in ('__act__', '__observation__'):
          continue
        val_str = _format_text(str(val), include_images=args.include_images)
        if len(val_str) > 200:
          val_str = val_str[:200] + '...'
        print(f'  {key}: {val_str}')


def cmd_step(args):
  """Show all entries for a specific step."""
  interface, _ = _load_interface(args.log_file)
  entries = interface.get_step_summary(args.step_num, include_content=True)
  if args.json:
    _print_json(entries, include_images=args.include_images)
  else:
    if not entries:
      print(f'No entries for step {args.step_num}.', file=sys.stderr)
      return
    for e in entries:
      entity = e.get('entity_name', '?')
      entry_type = e.get('entry_type', '?')
      summary = _format_text(
          e.get('summary', ''), include_images=args.include_images
      )
      print(f'[{entity}] ({entry_type}): {summary}')


def cmd_timeline(args):
  """Show entity's full timeline."""
  interface, _ = _load_interface(args.log_file)
  timeline = interface.get_entity_timeline(
      args.entity, include_content=args.verbose
  )
  if args.json:
    _print_json(timeline, include_images=args.include_images)
  else:
    if not timeline:
      print(f"No timeline entries for '{args.entity}'.", file=sys.stderr)
      return
    for e in timeline:
      step = e.get('step', '?')
      summary = _format_text(
          e.get('summary', ''), include_images=args.include_images
      )
      print(f'Step {step}: {summary}')


def cmd_search(args):
  """Search log entries by text."""
  interface, _ = _load_interface(args.log_file)
  results = interface.search_entries(args.query)
  if args.json:
    _print_json(results, include_images=args.include_images)
  else:
    if not results:
      print(f"No entries matching '{args.query}'.", file=sys.stderr)
      return
    for e in results:
      step = e.get('step', '?')
      entity = e.get('entity_name', '?')
      summary = _format_text(
          e.get('summary', ''), include_images=args.include_images
      )
      print(f'Step {step} [{entity}]: {summary}')


def cmd_memories(args):
  """Show entity memories."""
  interface, _ = _load_interface(args.log_file)
  memories = interface.get_entity_memories(args.entity)
  if args.json:
    _print_json(memories, include_images=args.include_images)
  else:
    if not memories:
      print(f"No memories for '{args.entity}'.", file=sys.stderr)
      return
    for i, mem in enumerate(memories):
      mem_text = _format_text(str(mem), include_images=args.include_images)
      print(f'  {i + 1}. {mem_text}')


def _discover_components(log, entity_name=None, step=None):
  """Discover component names and keys from a single entry."""
  for entry in log.entries:
    if entry.entry_type != 'entity':
      continue
    if entity_name and entry.entity_name != entity_name:
      continue
    if step is not None and entry.step != step:
      continue
    full_data = log.reconstruct_value(entry.deduplicat
```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #9** (2024-01-02): **Update game_master.py - update_before_event not executing**
  *Symptoms*: update_before_event wasn't executing on GM components since its trying to execute the component dict instead of its values
  **Post-Mortem & Fix Analysis**:
  > Merged in aa5a4653c32c5dd85ae6371033d949cf3d8d54b6

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

### Incident Patch 1: `222d3a44` (2026-09-28)
**Commit Message**: Merge pull request #300 from codewithfourtix:fix-component-comparison-default-skip-keys

PiperOrigin-RevId: 989678560
Change-Id: I9a88e393352121551833a3cb493d8ac5810543fe

**File**: `concordia/utils/helper_functions.py` (modified, +1/-2)
```diff
@@ -364,8 +364,7 @@ def deep_compare_components(comp1, comp2, test_case, skip_keys=None):
 
   for key in d1:
 
-    # pyrefly: ignore [not-iterable]
-    if key in skip_keys:
+    if skip_keys and key in skip_keys:
       continue
 
     val1 = d1[key]
```

**File**: `concordia/utils/helper_functions_test.py` (modified, +23/-0)
```diff
@@ -12,6 +12,7 @@
 # See the License for the specific language governing permissions and
 # limitations under the License.
 
+import types
 import unittest
 
 from absl.testing import absltest
@@ -118,5 +119,27 @@ def test_default_removes_duplicates_of_dicts_with_unhashable_values(self):
     )
 
 
+class DeepCompareComponentsTest(absltest.TestCase):
+
+  def test_compares_nested_components_without_skip_keys(self):
+    first = types.SimpleNamespace(child=types.SimpleNamespace(value=1))
+    second = types.SimpleNamespace(child=types.SimpleNamespace(value=1))
+    helper_functions.deep_compare_components(first, second, self)
+
+  def test_reports_value_mismatch_without_skip_keys(self):
+    with self.assertRaises(AssertionError):
+      helper_functions.deep_compare_components(
+          types.SimpleNamespace(value=1), types.SimpleNamespace(value=2), self
+      )
+
+  def test_still_skips_requested_keys(self):
+    helper_functions.deep_compare_components(
+        types.SimpleNamespace(value=1),
+        types.SimpleNamespace(value=2),
+        self,
+        skip_keys={'value'},
+    )
+
+
 if __name__ == '__main__':
   absltest.main()
```

---

### Incident Patch 2: `eaea22ed` (2026-09-23)
**Commit Message**: Fix Social Deception simulation_test timeout and player count parameterization in Concordia CI.

PiperOrigin-RevId: 986947281
Change-Id: Icb3e707da37fb84113825aabc75fb304e107b92e

**File**: `examples/games/social_deception/simulation_test.py` (modified, +14/-6)
```diff
@@ -41,6 +41,13 @@ def sample_text(
       timeout: float = language_model.DEFAULT_TIMEOUT_SECONDS,
       seed: int | None = None,
   ) -> str:
+    is_named = "Alice" in prompt or "Bob" in prompt
+    target_p0 = "Alice" if is_named else "Player_0"
+    target_p1 = "Bob" if is_named else "Player_1"
+    target_p2 = "Charlie" if is_named else "Player_2"
+    target_p3 = "David" if is_named else "Player_3"
+    target_p4 = "Eve" if is_named else "Player_4"
+
     if "Respond with 'Ack'" in prompt:
       return "Ack"
     elif "Choose action: nominate [player] or pass" in prompt:
@@ -50,21 +57,21 @@ def sample_text(
     elif "Vote on nomination of" in prompt:
       return "no"
     elif "Please select one player to kill." in prompt:
-      targets = ["Player_0", "Player_1", "Player_2", "Player_3", "Player_4"]
+      targets = [target_p0, target_p1, target_p2, target_p3, target_p4]
       target = targets[self._kill_target_index]
       self._kill_target_index = (self._kill_target_index + 1) % len(targets)
       return f"I want to kill {target}"
     elif "Please choose one alive player (not yourself)" in prompt:
-      return "Player_2"
+      return target_p2
     elif "Please select one player to learn their character." in prompt:
-      return "Player_1"
+      return target_p1
     elif "Please select one alive player to poison." in prompt:
-      return "Player_1"
+      return target_p1
     elif (
         "Please select two players." in prompt
         or "Please select exactly two players." in prompt
     ):
-      return "I choose Player_1 and Player_2"
+      return f"I choose {target_p1} and {target_p2}"
     elif "Choose action:" in prompt and "pass" in prompt:
       return "pass because I have no info"
     elif (
@@ -105,6 +112,7 @@ def test_setup(self):
         model=model,
         embedder=dummy_embedder,
         player_names=player_names,
+        day_to_play_through=1,
     )
     self.assertIsNotNone(res)
     self.assertIn("structured_log", res)
@@ -120,7 +128,7 @@ def test_puppet_simulation(self):
     self.assertIsNotNone(res)
     self.assertIn("structured_log", res)
 
-  @parameterized.parameters(range(5, 16))
+  @parameterized.parameters(5, 8, 12)
   def test_puppet_simulation_with_player_counts(self, num_players: int):
     model = MockLanguageModel()
     player_names = [f"Player_{i}" for i in range(num_players)]
```

---

### Incident Patch 3: `5d00d681` (2026-09-23)
**Commit Message**: Merge pull request #293 from anxkhn:fix/absolute-time-negative-offset

PiperOrigin-RevId: 986857088
Change-Id: I6054e6b7e3dd17476511de8a9266f4f47c24d1e5

**File**: `concordia/components/game_master/interrupt_time_model.py` (modified, +8/-6)
```diff
@@ -302,8 +302,9 @@ def parse_absolute_time(self, time_str: str, current_time: int) -> int:
 
     Prompts the LLM to convert the entity's absolute time specification into
     a number of seconds from now, then adds that offset to ``current_time``.
-    If the result is not strictly after ``current_time``, one simulated day
-    (86400 seconds) is added on the assumption the entity meant "tomorrow".
+    A non-positive offset is reduced modulo one simulated day. Exact multiples
+    of a day map to the following day, so the result is strictly after
+    ``current_time``.
 
     Args:
       time_str: An absolute time string, e.g. ``'8:00'``.
@@ -336,10 +337,11 @@ def parse_absolute_time(self, time_str: str, current_time: int) -> int:
       raise ValueError(
           f'Cannot parse LLM absolute-time response: {response!r}'
       ) from e
-    result = current_time + offset
-    if result <= current_time:
-      result += 86400  # Assume "tomorrow".
-    return result
+    if offset <= 0:
+      offset %= 86400
+      if offset == 0:
+        offset = 86400
+    return current_time + offset
 
   def format_time(self, time: int) -> str:
     """Formats a timestamp using the LLM. Results are cached."""
```

**File**: `concordia/components/game_master/interrupt_time_model_test.py` (modified, +14/-1)
```diff
@@ -154,7 +154,7 @@ def test_timestamps_are_comparable(self):
     self.assertEqual(t1, t1)
 
 
-class GenerativeTimeModelTest(absltest.TestCase):
+class GenerativeTimeModelTest(parameterized.TestCase):
 
   def _make_model(self, format_response='narrated time'):
     """Creates a GenerativeTimeModel with a mock LLM."""
@@ -228,6 +228,19 @@ def test_parse_absolute_time_negative_offset(self):
     result = model.parse_absolute_time('8:00', 1000)
     self.assertEqual(result, 86900)  # 1000 + (-500) + 86400
 
+  @parameterized.parameters(
+      (-86400, 87400),
+      (-172800, 87400),
+      (-172900, 87300),
+  )
+  def test_parse_absolute_time_large_negative_offset_is_future(
+      self, offset, expected
+  ):
+    model = self._make_model(format_response=str(offset))
+    result = model.parse_absolute_time('8:00', 1000)
+    self.assertEqual(result, expected)
+    self.assertGreater(result, 1000)
+
   def test_parse_absolute_time_bad_llm_response_raises(self):
     model = self._make_model(format_response='not a number')
     with self.assertRaises(ValueError):
```

---

### Incident Patch 4: `edcc568e` (2026-09-23)
**Commit Message**: Merge pull request #285 from jaisinha77777:fix-call-limit-race-condition

PiperOrigin-RevId: 986788359
Change-Id: Id448e0956a9bf3c67d4d2a06df68c7f36b8ffd8f

**File**: `concordia/language_model/call_limit_wrapper.py` (modified, +22/-19)
```diff
@@ -15,6 +15,7 @@
 """Wrapper to limit calls to an underlying language model."""
 
 from collections.abc import Collection, Mapping, Sequence
+import threading
 from typing import Any, override
 
 from absl import logging
@@ -44,6 +45,7 @@ def __init__(
     self._model = model
     self._max_calls = max_calls
     self._calls = 0
+    self._calls_lock = threading.Lock()
 
   @override
   def sample_text(
@@ -58,17 +60,17 @@ def sample_text(
       timeout: float = language_model.DEFAULT_TIMEOUT_SECONDS,
       seed: int | None = None,
   ) -> str:
-    if self._calls >= self._max_calls:
-      logging.warning(
-          'Call limit of %s reached. All further sample_text calls will be'
-          ' replaced with empty strings and sample_choice calls with the first'
-          ' response',
-          self._max_calls,
-      )
+    with self._calls_lock:
+      if self._calls >= self._max_calls:
+        logging.warning(
+            'Call limit of %s reached. All further sample_text calls will be'
+            ' replaced with empty strings and sample_choice calls with the'
+            ' first response',
+            self._max_calls,
+        )
+        return ''
+      self._calls += 1
 
-      return ''
-
-    self._calls += 1
     return self._model.sample_text(
         prompt,
         max_tokens=max_tokens,
@@ -88,14 +90,15 @@ def sample_choice(
       *,
       seed: int | None = None,
   ) -> tuple[int, str, Mapping[str, Any]]:
-    if self._calls >= self._max_calls:
-      logging.warning(
-          'Call limit of %s reached. All further sample_text calls will be'
-          ' replaced with empty strings and sample_choice calls with the first'
-          ' response',
-          self._max_calls,
-      )
-      return 0, responses[0], {}
+    with self._calls_lock:
+      if self._calls >= self._max_calls:
+        logging.warning(
+            'Call limit of %s reached. All further sample_text calls will be'
+            ' replaced with empty strings and sample_choice calls with the'
+            ' first response',
+            self._max_calls,
+        )
+        return 0, responses[0], {}
+      self._calls += 1
 
-    self._calls += 1
     return self._model.sample_choice(prompt, responses, seed=seed)
```

**File**: `concordia/language_model/call_limit_wrapper_test.py` (added, +113/-0)
```diff
@@ -0,0 +1,113 @@
+# Copyright 2026 DeepMind Technologies Limited.
+#
+# Licensed under the Apache License, Version 2.0 (the "License");
+# you may not use this file except in compliance with the License.
+# You may obtain a copy of the License at
+#
+#     https://www.apache.org/licenses/LICENSE-2.0
+#
+# Unless required by applicable law or agreed to in writing, software
+# distributed under the License is distributed on an "AS IS" BASIS,
+# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
+# See the License for the specific language governing permissions and
+# limitations under the License.
+
+import threading
+
+from absl.testing import absltest
+from concordia.language_model import call_limit_wrapper
+from concordia.language_model import language_model
+
+
+class _CountingModel(language_model.LanguageModel):
+  """A model that counts how many times it was actually invoked."""
+
+  def __init__(self):
+    self.sample_text_calls = 0
+    self.sample_choice_calls = 0
+    self._lock = threading.Lock()
+
+  def sample_text(self, prompt, **kwargs):
+    del prompt, kwargs
+    with self._lock:
+      self.sample_text_calls += 1
+    return 'response'
+
+  def sample_choice(self, prompt, responses, **kwargs):
+    del prompt, kwargs
+    with self._lock:
+      self.sample_choice_calls += 1
+    return 0, responses[0], {}
+
+
+class CallLimitLanguageModelTest(absltest.TestCase):
+
+  def test_calls_pass_through_under_the_limit(self):
+    model = _CountingModel()
+    wrapped = call_limit_wrapper.CallLimitLanguageModel(model, max_calls=3)
+    for _ in range(3):
+      self.assertEqual(wrapped.sample_text('prompt'), 'response')
+    self.assertEqual(model.sample_text_calls, 3)
+
+  def test_sample_text_returns_empty_string_once_limit_reached(self):
+    model = _CountingModel()
+    wrapped = call_limit_wrapper.CallLimitLanguageModel(model, max_calls=1)
+    self.assertEqual(wrapped.sample_text('prompt'), 'response')
+    self.assertEqual(wrapped.sample_text('prompt'), '')
+    self.assertEqual(wrapped.sample_text('prompt'), '')
+    # The underlying model must not be called once the limit is reached.
+    self.assertEqual(model.sample_text_calls, 1)
+
+  def test_sample_choice_returns_first_response_once_limit_reached(self):
+    model = _CountingModel()
+    wrapped = call_limit_wrapper.CallLimitLanguageModel(model, max_calls=1)
+    wrapped.sample_choice('prompt', ['a', 'b', 'c'])
+    result = wrapped.sample_choice('prompt', ['x', 'y', 'z'])
+    self.assertEqual(result, (0, 'x', {}))
+    self.assertEqual(model.sample_choice_calls, 1)
+
+  def test_sample_text_and_sample_choice_share_the_same_budget(self):
+    model = _CountingModel()
+    wrapped = call_limit_wrapper.CallLimitLanguageModel(model, max_calls=2)
+    wrapped.sample_text('prompt')
+    wrapped.sample_choice('prompt', ['a', 'b'])
+    # Budget is now exhausted; further calls of either kind should not reach
+    # the underlying model.
+    wrapped.sample_text('prompt')
+    wrapped.sample_choice('prompt', ['a', 'b'])
+    self.assertEqual(model.sample_text_calls, 1)
+    self.assertEqual(model.sample_choice_calls, 1)
+
+  def test_call_limit_is_enforced_exactly_under_concurrency(self):
+    # Regression test: the call counter used to be an unsynchronized
+    # `self._calls += 1` shared across every thread that calls the wrapped
+    # model. EntityAgent runs component calls concurrently via a
+    # ThreadPoolExecutor and typically shares one language model instance
+    # across an entire simulation, so this counter is genuinely
+    # multi-threaded in normal use: an unsynchronized read-modify-write on a
+    # shared counter is a data race regardless of whether any particular
+    # CPython build's GIL happens to hide it, and it's an outright bug on
+    # free-threaded (no-GIL) Python builds. With the counter under a lock,
+    # exactly `max_calls` of many more concurrent attempts must get through.
+    num_threads = 200
+    m
```

---

### Incident Patch 5: `66091de2` (2026-09-23)
**Commit Message**: Merge pull request #295 from rootkiller6788:fix/game-master-logging-channel-init

PiperOrigin-RevId: 986705102
Change-Id: I7eed91c3def378fc4c012b28a3981b46c6429c5a

**File**: `concordia/components/game_master/inventory.py` (modified, +2/-0)
```diff
@@ -124,6 +124,7 @@ def __init__(
         `pre_act`.
       verbose: whether to print the full update chain of thought or not
     """
+    super().__init__()
     self._pre_act_label = pre_act_label
     self._model = model
     self._observations_component_name = observations_component_name
@@ -436,6 +437,7 @@ def __init__(
       pre_act_label: the name of this component to use in pre_act.
       verbose: whether to print the full update chain of thought or not
     """
+    super().__init__()
     self._pre_act_label = pre_act_label
     self._inventory = inventory
     self._player_names = player_names
```

**File**: `concordia/components/game_master/inventory_test.py` (added, +187/-0)
```diff
@@ -0,0 +1,187 @@
+# Copyright 2026 DeepMind Technologies Limited.
+#
+# Licensed under the Apache License, Version 2.0 (the "License");
+# you may not use this file except in compliance with the License.
+# You may obtain a copy of the License at
+#
+#     https://www.apache.org/licenses/LICENSE-2.0
+#
+# Unless required by applicable law or agreed to in writing, software
+# distributed under the License is distributed on an "AS IS" BASIS,
+# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
+# See the License for the specific language governing permissions and
+# limitations under the License.
+
+"""Tests for the inventory component."""
+
+import datetime
+from unittest import mock
+
+from absl.testing import absltest
+from concordia.components.game_master import inventory
+from concordia.testing import mock_model
+from concordia.typing import entity as entity_lib
+
+
+def _make_item_type_configs():
+  return [
+      inventory.ItemTypeConfig(name='money', minimum=0.0),
+      inventory.ItemTypeConfig(name='apple', minimum=0.0, force_integer=True),
+  ]
+
+
+def _make_inventory():
+  with mock.patch.object(
+      inventory.helper_functions, 'is_count_noun', return_value=False
+  ):
+    return inventory.Inventory(
+        model=mock_model.MockModel(),
+        item_type_configs=_make_item_type_configs(),
+        player_initial_endowments={
+            'Alice': {'money': 10.0, 'apple': 2},
+            'Bob': {'money': 5.0, 'apple': 1},
+        },
+        clock_now=datetime.datetime.now,
+    )
+
+
+class ItemTypeConfigTest(absltest.TestCase):
+  """Tests for the ItemTypeConfig helper."""
+
+  def test_check_valid_in_range(self):
+    config = inventory.ItemTypeConfig(name='x', minimum=0.0, maximum=10.0)
+    config.check_valid(5.0)
+
+  def test_check_valid_out_of_bounds(self):
+    config = inventory.ItemTypeConfig(name='x', minimum=0.0, maximum=10.0)
+    with self.assertRaises(ValueError):
+      config.check_valid(11.0)
+
+  def test_check_valid_force_integer(self):
+    config = inventory.ItemTypeConfig(name='x', force_integer=True)
+    with self.assertRaises(ValueError):
+      config.check_valid(1.5)
+    config.check_valid(2)
+
+  def test_many_or_much_fn(self):
+    self.assertEqual(inventory._many_or_much_fn(True), 'many')
+    self.assertEqual(inventory._many_or_much_fn(False), 'much')
+
+
+class InventoryTest(absltest.TestCase):
+  """Tests for the Inventory component."""
+
+  def test_get_state_set_state_round_trip(self):
+    component = _make_inventory()
+    state = component.get_state()
+    restored = _make_inventory()
+    restored.set_state(state)
+    self.assertEqual(restored.get_state(), state)
+
+  def test_get_pre_act_value(self):
+    component = _make_inventory()
+    expected = {
+        'Alice': {'money': 10.0, 'apple': 2},
+        'Bob': {'money': 5.0, 'apple': 1},
+    }
+    self.assertEqual(component.get_pre_act_value(), str(expected))
+
+  def test_get_player_inventory_returns_copy(self):
+    component = _make_inventory()
+    alice = component.get_player_inventory('Alice')
+    alice['money'] = 999.0
+    self.assertEqual(component.get_player_inventory('Alice')['money'], 10.0)
+
+  def test_pre_act_free_logs_and_returns_empty(self):
+    component = _make_inventory()
+    logging_channel = mock.MagicMock()
+    component.set_logging_channel(logging_channel)
+    action_spec = entity_lib.ActionSpec(
+        call_to_action='test', output_type=entity_lib.OutputType.FREE
+    )
+    self.assertEqual(component.pre_act(action_spec), '')
+    logging_channel.assert_called_once()
+
+  def test_pre_act_resolve_runs_and_returns_empty(self):
+    with mock.patch.object(
+        inventory.helper_functions, 'is_count_noun', return_value=False
+    ):
+      component = inventory.Inventory(
+          model=mock_model.MockModel(),
+          item_type_configs=_make_item_type_configs(),
+          player_initial_endowments={'Alice': {'money': 10.0}},
+          clock_now
```

**File**: `concordia/components/game_master/world_state.py` (modified, +3/-0)
```diff
@@ -43,6 +43,7 @@ def __init__(
       pre_act_label: Prefix to add to the output of the component when called
         in `pre_act`.
     """
+    super().__init__()
     self._pre_act_label = pre_act_label
     self._model = model
     self._components = tuple(components)
@@ -192,6 +193,7 @@ def __init__(
         matching is normalized to 'unknown'. When None, free-form behavior is
         used.
     """
+    super().__init__()
     self._pre_act_label = pre_act_label
     self._model = model
     self._entity_names = entity_names
@@ -435,6 +437,7 @@ def __init__(
       pre_act_label: Prefix to add to the output of the component when called
         in `pre_act`.
     """
+    super().__init__()
     self._pre_act_label = pre_act_label
     self._model = model
     self._format_description_key = format_description_key
```

**File**: `concordia/components/game_master/world_state_test.py` (added, +173/-0)
```diff
@@ -0,0 +1,173 @@
+# Copyright 2026 DeepMind Technologies Limited.
+#
+# Licensed under the Apache License, Version 2.0 (the "License");
+# you may not use this file except in compliance with the License.
+# You may obtain a copy of the License at
+#
+#     https://www.apache.org/licenses/LICENSE-2.0
+#
+# Unless required by applicable law or agreed to in writing, software
+# distributed under the License is distributed on an "AS IS" BASIS,
+# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
+# See the License for the specific language governing permissions and
+# limitations under the License.
+
+"""Tests for the world_state component."""
+
+from absl.testing import absltest
+from concordia.components.game_master import world_state
+from concordia.language_model import no_language_model
+from concordia.testing import mock_model
+from concordia.typing import entity as entity_lib
+
+
+class WorldStateTest(absltest.TestCase):
+  """Tests for the WorldState component."""
+
+  def setUp(self):
+    super().setUp()
+    self._model = no_language_model.NoLanguageModel()
+
+  def test_get_pre_act_value_empty(self):
+    component = world_state.WorldState(model=self._model)
+    self.assertEqual(component.get_pre_act_value(), '\n')
+
+  def test_get_pre_act_value_formats_entries(self):
+    component = world_state.WorldState(model=self._model)
+    component.set_state({
+        'state': {'weather': 'sunny', 'time': 'noon'},
+        'latest_action_spec': None,
+    })
+    self.assertEqual(
+        component.get_pre_act_value(), 'weather: sunny\ntime: noon\n'
+    )
+
+  def test_get_pre_act_label(self):
+    component = world_state.WorldState(
+        model=self._model, pre_act_label='\nState'
+    )
+    self.assertEqual(component.get_pre_act_label(), '\nState')
+
+  def test_state_round_trip(self):
+    component = world_state.WorldState(model=self._model)
+    original = {'state': {'a': '1'}, 'latest_action_spec': None}
+    component.set_state(original)
+    self.assertEqual(component.get_state(), original)
+
+  def test_pre_act_records_action_spec_and_returns_state(self):
+    component = world_state.WorldState(model=self._model)
+    component.set_state({'state': {'x': 'y'}, 'latest_action_spec': None})
+    action_spec = entity_lib.ActionSpec(
+        call_to_action='test', output_type=entity_lib.OutputType.RESOLVE
+    )
+    self.assertEqual(component.pre_act(action_spec), 'x: y\n')
+    self.assertEqual(
+        component.get_state()['latest_action_spec'], action_spec.to_dict()
+    )
+
+  def test_action_spec_round_trip(self):
+    component = world_state.WorldState(model=self._model)
+    action_spec = entity_lib.ActionSpec(
+        call_to_action='act', output_type=entity_lib.OutputType.FREE
+    )
+    component.pre_act(action_spec)
+    restored = world_state.WorldState(model=self._model)
+    restored.set_state(component.get_state())
+    self.assertEqual(
+        restored.get_state()['latest_action_spec'], action_spec.to_dict()
+    )
+
+
+class LocationsNormalizeTest(absltest.TestCase):
+  """Tests for the Locations._normalize_location helper."""
+
+  def _make_locations(self, valid_locations):
+    return world_state.Locations(
+        model=mock_model.MockModel(''),
+        entity_names=['Alice', 'Bob'],
+        prompt='a prompt',
+        valid_locations=valid_locations,
+    )
+
+  def test_empty_location_normalizes_to_empty(self):
+    locations = self._make_locations(['Home', 'Work'])
+    self.assertEqual(locations._normalize_location(''), '')
+
+  def test_free_form_when_no_valid_locations(self):
+    locations = self._make_locations(None)
+    self.assertEqual(locations._normalize_location('  Home.  '), 'Home')
+
+  def test_exact_match(self):
+    locations = self._make_locations(['Home', 'Work'])
+    self.assertEqual(locations._normalize_location('Home'), 'Home')
+
+  def test_case_insensitive_match(self):
+    locations = self._make_locations(['Home', 'Work'])
+    self
```

---

### Incident Patch 6: `83659f2f` (2026-09-23)
**Commit Message**: Merge pull request #273 from xiaokhkh:test-associative-memory-bank

PiperOrigin-RevId: 986699224
Change-Id: Icd752a60be8454d28f1a9866f50689b7f2cad05a

**File**: `concordia/associative_memory/basic_associative_memory_test.py` (added, +127/-0)
```diff
@@ -0,0 +1,127 @@
+# Copyright 2026 DeepMind Technologies Limited.
+#
+# Licensed under the Apache License, Version 2.0 (the "License");
+# you may not use this file except in compliance with the License.
+# You may obtain a copy of the License at
+#
+#     https://www.apache.org/licenses/LICENSE-2.0
+#
+# Unless required by applicable law or agreed to in writing, software
+# distributed under the License is distributed on an "AS IS" BASIS,
+# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
+# See the License for the specific language governing permissions and
+# limitations under the License.
+
+"""Tests for basic associative memory."""
+
+from collections.abc import Callable, Mapping, Sequence
+
+from absl.testing import absltest
+from concordia.associative_memory import basic_associative_memory
+import numpy as np
+
+
+def _make_embedder(
+    embeddings: Mapping[str, Sequence[float]],
+) -> Callable[[str], np.ndarray]:
+  """Returns a deterministic embedder backed by a local mapping."""
+
+  def embed(text: str) -> np.ndarray:
+    return np.asarray(embeddings[text], dtype=np.float64)
+
+  return embed
+
+
+class AssociativeMemoryBankTest(absltest.TestCase):
+
+  def test_add_suppresses_duplicates_by_default(self):
+    embedder = _make_embedder({'same memory': [1.0, 0.0]})
+    memory = basic_associative_memory.AssociativeMemoryBank(embedder)
+
+    memory.add('same memory')
+    memory.add('same memory')
+
+    self.assertLen(memory, 1)
+    self.assertEqual(memory.get_all_memories_as_text(), ['same memory'])
+
+  def test_add_retains_duplicates_when_allowed(self):
+    embedder = _make_embedder({'same memory': [1.0, 0.0]})
+    memory = basic_associative_memory.AssociativeMemoryBank(
+        embedder, allow_duplicates=True
+    )
+
+    memory.add('same memory')
+    memory.add('same memory')
+
+    self.assertLen(memory, 2)
+    self.assertEqual(
+        memory.get_all_memories_as_text(), ['same memory', 'same memory']
+    )
+
+  def test_add_normalizes_newlines(self):
+    embedder = _make_embedder({'line one line two line three': [1.0, 0.0]})
+    memory = basic_associative_memory.AssociativeMemoryBank(embedder)
+
+    memory.add('line one\nline two\nline three')
+
+    self.assertEqual(
+        memory.get_all_memories_as_text(),
+        ['line one line two line three'],
+    )
+
+  def test_retrieve_associative_orders_by_similarity(self):
+    embedder = _make_embedder({
+        'find northern memories': [1.0, 0.0],
+        'north market': [0.9, 0.1],
+        'east library': [0.2, 0.8],
+        'south garden': [0.7, 0.3],
+    })
+    memory = basic_associative_memory.AssociativeMemoryBank(embedder)
+    memory.extend(['east library', 'north market', 'south garden'])
+
+    self.assertEqual(
+        memory.retrieve_associative('find northern memories', k=2),
+        ['north market', 'south garden'],
+    )
+
+  def test_retrieve_recent_returns_most_recent_window_in_insertion_order(self):
+    embedder = _make_embedder({
+        'first': [1.0, 0.0],
+        'second': [0.0, 1.0],
+        'third': [1.0, 1.0],
+    })
+    memory = basic_associative_memory.AssociativeMemoryBank(embedder)
+    memory.extend(['first', 'second', 'third'])
+
+    self.assertEqual(memory.retrieve_recent(k=2), ['second', 'third'])
+
+  def test_retrieve_validates_limit(self):
+    embedder = _make_embedder({'query': [1.0, 0.0]})
+    memory = basic_associative_memory.AssociativeMemoryBank(embedder)
+
+    with self.assertRaisesRegex(ValueError, 'Limit must be positive.'):
+      memory.retrieve_recent(k=0)
+
+    with self.assertRaisesRegex(ValueError, 'Limit must be positive.'):
+      memory.retrieve_associative('query', k=0)
+
+  def test_get_state_and_set_state_preserve_pending_memories(self):
+    embedder = _make_embedder({
+        'first': [1.0, 0.0],
+        'second': [0.0, 1.0],
+    })
+    memory = basic_associative_memory.AssociativeMemoryBank(embedder)
+    memory.extend(['first', 'second'
```

---

### Incident Patch 7: `022b0bbc` (2026-09-23)
**Commit Message**: Merge pull request #292 from anxkhn:fix/interrupt-duration-parsing

PiperOrigin-RevId: 986690727
Change-Id: I68fd8d36e64c35b7ff9691fb36d4663329ff56a0

**File**: `concordia/components/game_master/interrupt_time_model.py` (modified, +4/-14)
```diff
@@ -49,21 +49,11 @@ def parse_duration_seconds(duration_str: str) -> int:
   duration_str = duration_str.strip()
   if not duration_str or duration_str == '0':
     return 0
-  hours = 0
-  minutes = 0
-  parsed = False
-  if 'h' in duration_str:
-    parts = duration_str.split('h', 1)
-    hours = int(parts[0])
-    rest = parts[1]
-    parsed = True
-  else:
-    rest = duration_str
-  if rest.endswith('m'):
-    minutes = int(rest[:-1])
-    parsed = True
-  if not parsed:
+  match = re.fullmatch(r'(?:(\d+)h)?(?:(\d+)m)?', duration_str)
+  if match is None or not any(match.groups()):
     return 3600  # Default fallback: 1 hour.
+  hours = int(match.group(1) or 0)
+  minutes = int(match.group(2) or 0)
   return hours * 3600 + minutes * 60
 
 
```

**File**: `concordia/components/game_master/interrupt_time_model_test.py` (modified, +12/-2)
```diff
@@ -26,6 +26,8 @@ class ParseDurationSecondsTest(parameterized.TestCase):
 
   @parameterized.parameters(
       ('0m', 0),
+      ('0h', 0),
+      ('0h0m', 0),
       ('0', 0),
       ('5m', 300),
       ('2h', 7200),
@@ -40,9 +42,17 @@ def test_parse_duration_seconds(self, input_str, expected):
         expected,
     )
 
-  def test_unparseable_defaults_to_one_hour(self):
+  @parameterized.parameters(
+      'abc',
+      '1hour',
+      '1h30mx',
+      '1hgarbage',
+      'h',
+      'm',
+  )
+  def test_unparseable_defaults_to_one_hour(self, input_str):
     self.assertEqual(
-        interrupt_time_model.parse_duration_seconds('abc'),
+        interrupt_time_model.parse_duration_seconds(input_str),
         3600,
     )
 
```

---

### Incident Patch 8: `0e536305` (2026-09-22)
**Commit Message**: Add default pytest fixture

PiperOrigin-RevId: 986133743
Change-Id: I7c0124d170178e5dc560af967ce0802a077f337d

**File**: `conftest.py` (added, +24/-0)
```diff
@@ -0,0 +1,24 @@
+# Copyright 2026 DeepMind Technologies Limited.
+#
+# Licensed under the Apache License, Version 2.0 (the "License");
+# you may not use this file except in compliance with the License.
+# You may obtain a copy of the License at
+#
+#     https://www.apache.org/licenses/LICENSE-2.0
+#
+# Unless required by applicable law or agreed to in writing, software
+# distributed under the License is distributed on an "AS IS" BASIS,
+# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
+# See the License for the specific language governing permissions and
+# limitations under the License.
+
+"""Pytest fixtures."""
+
+from absl import flags
+import pytest
+
+
+@pytest.fixture(autouse=True, scope="session")
+def initialize_absl_flags():
+  """Initializes absl flags."""
+  flags.FLAGS.mark_as_parsed()
```

---

### Incident Patch 9: `796d4890` (2026-09-03)
**Commit Message**: Merge pull request #284 from jaisinha77777:fix-simulation-server-bind-all-interfaces

PiperOrigin-RevId: 975634958
Change-Id: Id62be37ee179f77244b5c9403e9c380ecd3346bf

**File**: `concordia/utils/simulation_server.py` (modified, +35/-1)
```diff
@@ -42,15 +42,22 @@ def __init__(
       self,
       port: int = 8080,
       html_content: str = '',
+      host: str = '127.0.0.1',
   ):
     """Initialize the simulation server.
 
     Args:
       port: Port to serve on.
       html_content: Static HTML content to serve at the root.
+      host: Interface to bind to. Defaults to the loopback interface only,
+        since this server has no authentication and its endpoints (including
+        `/cmd/set_component_state`, which can overwrite arbitrary simulation
+        state) are unauthenticated. Pass '0.0.0.0' explicitly to accept
+        connections from other machines on the network.
     """
     self._port = port
     self._html_content = html_content
+    self._host = host
     self._step_controller = step_controller_lib.StepController(
         start_paused=True
     )
@@ -64,6 +71,31 @@ def __init__(
     print(f'[SERVER INIT] SimulationServer initialized on port {port}')
     sys.stdout.flush()
 
+  @property
+  def host(self) -> str:
+    """Get the interface the server binds to."""
+    return self._host
+
+  @property
+  def port(self) -> int:
+    """Get the port the server was configured to listen on.
+
+    If the server was started with `port=0`, use `bound_port` instead to get
+    the OS-assigned port actually in use.
+    """
+    return self._port
+
+  @property
+  def bound_port(self) -> int:
+    """Get the port the running server is actually bound to.
+
+    Raises:
+      RuntimeError: If the server has not been started.
+    """
+    if self._server is None:
+      raise RuntimeError('Server has not been started.')
+    return self._server.server_address[1]
+
   @property
   def step_controller(self) -> step_controller_lib.StepController:
     """Get the step controller for use by the simulation."""
@@ -369,7 +401,9 @@ def _send_json(self, data: dict[str, Any]) -> None:
   def start(self) -> None:
     """Start the HTTP server in a background thread."""
     handler = self._create_handler()
-    self._server = socketserver.ThreadingTCPServer(('', self._port), handler)
+    self._server = socketserver.ThreadingTCPServer(
+        (self._host, self._port), handler
+    )
     self._server.allow_reuse_address = True
     self._server_thread = threading.Thread(target=self._server.serve_forever)
     self._server_thread.daemon = True
```

**File**: `concordia/utils/simulation_server_test.py` (added, +243/-0)
```diff
@@ -0,0 +1,243 @@
+# Copyright 2026 DeepMind Technologies Limited.
+#
+# Licensed under the Apache License, Version 2.0 (the "License");
+# you may not use this file except in compliance with the License.
+# You may obtain a copy of the License at
+#
+#     https://www.apache.org/licenses/LICENSE-2.0
+#
+# Unless required by applicable law or agreed to in writing, software
+# distributed under the License is distributed on an "AS IS" BASIS,
+# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
+# See the License for the specific language governing permissions and
+# limitations under the License.
+
+"""Tests for SimulationServer covering loopback binding, SSE queues, and HTTP endpoints."""
+
+import json
+import queue
+import urllib.error
+import urllib.request
+
+from absl.testing import absltest
+from concordia.environment import step_controller as step_controller_lib
+from concordia.utils import simulation_server
+
+
+class _FakeSimulation:
+  """Minimal stand-in for a Simulation, for exercising the edit endpoint."""
+
+  def __init__(self):
+    self.set_calls = []
+
+  def set_component_dynamic_state(
+      self, entity_name, component_name, key, value
+  ):
+    self.set_calls.append((entity_name, component_name, key, value))
+
+  def make_checkpoint_data(self):
+    return {'entities': {'alice': {}}, 'game_masters': {'gm': {}}}
+
+
+def _request(url, method='GET', data=None):
+  body = json.dumps(data).encode('utf-8') if data is not None else None
+  req = urllib.request.Request(url, data=body, method=method)
+  if body is not None:
+    req.add_header('Content-Type', 'application/json')
+  with urllib.request.urlopen(req, timeout=5) as response:
+    return response.status, json.loads(response.read().decode('utf-8'))
+
+
+class HostDefaultsTest(absltest.TestCase):
+
+  def test_defaults_to_loopback_only(self):
+    server = simulation_server.SimulationServer(port=0)
+    self.assertEqual(server.host, '127.0.0.1')
+
+  def test_host_is_configurable(self):
+    server = simulation_server.SimulationServer(port=0, host='0.0.0.0')
+    self.assertEqual(server.host, '0.0.0.0')
+
+  def test_port_property_reflects_constructor_argument(self):
+    server = simulation_server.SimulationServer(port=12345)
+    self.assertEqual(server.port, 12345)
+
+  def test_bound_port_raises_before_start(self):
+    server = simulation_server.SimulationServer(port=0)
+    with self.assertRaises(RuntimeError):
+      _ = server.bound_port
+
+
+class BroadcastTest(absltest.TestCase):
+
+  def test_broadcast_step_delivers_to_all_queues(self):
+    server = simulation_server.SimulationServer(port=0)
+    q1: queue.Queue[str] = queue.Queue(maxsize=10)
+    q2: queue.Queue[str] = queue.Queue(maxsize=10)
+    server.server_sent_events_queues.extend([q1, q2])
+
+    step_data = step_controller_lib.StepData(
+        step=1,
+        acting_entity='alice',
+        action='wave',
+        entity_actions={'alice': 'wave'},
+        entity_logs={'alice': {}},
+        game_master='gm',
+    )
+    server.broadcast_step(step_data)
+
+    self.assertEqual(server.current_step_data['step'], 1)
+    self.assertEqual(server.current_step_data['acting_entity'], 'alice')
+    self.assertIn('data: ', q1.get_nowait())
+    self.assertIn('data: ', q2.get_nowait())
+
+  def test_broadcast_step_drops_full_queues(self):
+    server = simulation_server.SimulationServer(port=0)
+    full_queue: queue.Queue[str] = queue.Queue(maxsize=1)
+    full_queue.put_nowait('already full')
+    server.server_sent_events_queues.append(full_queue)
+
+    step_data = step_controller_lib.StepData(
+        step=1,
+        acting_entity='alice',
+        action='wave',
+        entity_actions={},
+        entity_logs={},
+    )
+    server.broadcast_step(step_data)
+
+    # The full queue should have been dropped from the list rather than
+    # raising or blocking.
+    self.assertNotIn(full_queue, server.server_sent_events_queues)
+
+  def test_broadcast_entity_
```

---

### Incident Patch 10: `48defea6` (2026-09-01)
**Commit Message**: Merge pull request #276 from codewithfourtix:fix/docstring-typos

PiperOrigin-RevId: 974390534
Change-Id: I2f0e4012d5a999b6a8e4d83de1b57303bd5743db

**File**: `concordia/document/document.py` (modified, +4/-4)
```diff
@@ -54,7 +54,7 @@ def __init__(self, contents: Iterable[Content] = ()) -> None:
     Args:
       contents: Initial contents of the document.
     """
-    # TODO: b/311191572 - be more efficient if contents is a tupel iter.
+    # TODO: b/311191572 - be more efficient if contents is a tuple iter.
     self._contents = tuple(contents)
 
   # TODO: b/311191905 - implement __iadd__, __add__?
@@ -128,9 +128,9 @@ def new(self: T) -> T:
   def edit(self: T) -> Iterator[T]:
     """Edits the current document.
 
-    Creates a edit based on the current document. Once the context is completed,
-    the edit will be committed to the document. If you wish not to commit the
-    edit call edit.clear() before leavign the context.
+    Creates an edit based on the current document. Once the context is
+    completed, the edit will be committed to the document. If you wish not to
+    commit the edit call edit.clear() before leaving the context.
 
     Yields:
       The document being edited.
```

**File**: `setup.py` (modified, +1/-1)
```diff
@@ -41,7 +41,7 @@ def _remove_excluded(description: str) -> str:
     author='DeepMind',
     author_email='noreply@google.com',
     description=(
-        'A library for building a generative model of social interacions.'
+        'A library for building a generative model of social interactions.'
     ),
     long_description=LONG_DESCRIPTION,
     long_description_content_type='text/markdown',
```

#### Recent Merged Pull Requests:
- **PR #383** (closed): Stop EntityAgent reusing stale pre-act values after a failed step (@codewithfourtix)
- **PR #376** (closed): Keep control-flow exceptions out of task-error logs (@sylvesterkaczmarek)
- **PR #370** (closed): Show confirmed-action elapsed waiting in Bellwether (@concordia-claw)
- **PR #368** (closed): Coalesce attached SSE wakeups without building discarded snapshots (@concordia-claw)
- **PR #366** (closed): Distinguish stopped Bellwether runs from completed accounts (@concordia-claw)
- **PR #364** (closed): Report unavailable Bellwether replies without invented dialogue (@concordia-claw)
- **PR #362** (closed): Inspect received developer snapshots without eager full rendering (@concordia-claw)
- **PR #360** (closed): Keep Bellwether perception separate from structured resident actions (@concordia-claw)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
