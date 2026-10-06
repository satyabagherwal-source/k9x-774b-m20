# Forensic Learning Record (Deep Inspection): google-deepmind/concordia

> **Canonical Artifact**: `07_PROJECT_LEARNING/google-deepmind-concordia-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/google-deepmind/concordia](https://github.com/google-deepmind/concordia))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-06T04:57:26.257Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `google-deepmind/concordia`
- **Description**: A library for generative social simulation
- **Primary Language / Ecosystem**: Python
- **Discovered Manifests / Configurations**: pyproject.toml, README.md
- **Stars / Engagement**: 1757 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: pyproject.toml, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `concordia/components/game_master/world_state.py`
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

"""A component to represent any world state variables the GM deems important."""

from collections.abc import Sequence
from typing import cast

from concordia.components.agent import action_spec_ignored
from concordia.document import interactive_document
from concordia.language_model import language_model
from concordia.typing import entity as entity_lib
from concordia.typing import entity_component


class WorldState(
    entity_component.ContextComponent, entity_component.ComponentWithLogging
):
  """A component that represents the world state."""

  def __init__(
      self,
      model: language_model.LanguageModel,
      components: Sequence[str] = (),
      pre_act_label: str = '\nState',
  ):
    """Initializes the world state component.

    Args:
      model: The language model to use.
      components: Keys of components to condition the world state on.
      pre_act_label: Prefix to add to the output of the component when called
        in `pre_act`.
    """
    super().__init__()
    self._pre_act_label = pre_act_label
    self._model = model
    self._components = tuple(components)

    self._state = {}
    self._latest_action_spec = None

  def get_named_component_pre_act_value(self, component_name: str) -> str:
    """Returns the pre-act value of a named component of the parent entity."""
    return (
        self.get_entity().get_component(
            component_name, type_=action_spec_ignored.ActionSpecIgnored
        ).get_pre_act_value()
    )

  def get_component_pre_act_label(self, component_name: str) -> str:
    """Returns the pre-act label of a named component of the parent entity."""
    return (
        self.get_entity().get_component(
            component_name, type_=action_spec_ignored.ActionSpecIgnored
        ).get_pre_act_label()
    )

  def _component_pre_act_display(self, key: str) -> str:
    """Returns the pre-act label and value of a named component."""
    return (
        f'{self.get_component_pre_act_label(key)}:\n'
        f'{self.get_named_component_pre_act_value(key)}')

  def get_pre_act_label(self) -> str:
    """Returns the key used as a prefix in the string returned by `pre_act`."""
    return self._pre_act_label

  def get_pre_act_value(self) -> str:
    """Returns the current world state."""
    result = '\n'.join([
        f'{name}: {value}' for name, value in self._state.items()
    ])
    return result + '\n'

  def pre_act(
      self,
      action_spec: entity_lib.ActionSpec,
  ) -> str:
    self._latest_action_spec = action_spec
    result = self.get_pre_act_value()
    self._logging_channel({
        'Key': self._pre_act_label,
        'Summary': result,
        'Value': result,
    })
    return result

  def post_act(
      self,
      event: str,
  ) -> str:
    if (self._latest_action_spec is not None and
        self._latest_action_spec.output_type == entity_lib.OutputType.RESOLVE):
      prompt = interactive_document.InteractiveDocument(self._model)

      component_states = '\n'.join(
          [self._component_pre_act_display(key) for key in self._components]
      )
      prompt.statement(f'\n{component_states}\n')
      prompt.statement(f'State prior to the latest event:\n{self._state}')
      prompt.statement(f'The latest event: {event}')
      important_variables_str = prompt.open_question(
          question=(
              'Given the context above, what state variables are important '
              'to write down now so that they can be used later? '
              'Respond with a comma-separated list of variable names. '
              'Variables must be written in the format: "name|value". '
              'For example: "name1|value1,name2|value2,name3|value3". '
              'Useful variables reflect properties of the protagonists, '
              'or the world they inhabit, that are expected to change in '
              'value over time and expected to exert some influence on '
              'how the story plays out. Update the value for all existing '
              'state variables and add new state variables as needed to '
              'account for consequences of the latest event. If a '
              'particular state variable is no longer needed then there '
              'is no need to include it in the list.'
          ),
          max_tokens=512,
      )
      important_variables = important_variables_str.split(',')
      for variable in important_variables:
        split_variable = variable.split('|')
        if len(split_variable) == 2:
          name, value = variable.split('|')
          self._state[name.strip()] = value.strip()

    return ''

  def get_state(self) -> entity_component.ComponentState:
    """Returns the state of the component."""
    action_spec_dict = (
        self._latest_action_spec.to_dict() if self._latest_action_spec else None
    )
    return {
        'state': self._state,
        'latest_action_spec': action_spec_dict,
    }

  def set_state(self, state: entity_component.ComponentState) -> None:
    """Sets the state of the component."""
    action_spec_dict = state['latest_action_spec']
    if action_spec_dict and isinstance(action_spec_dict, dict):
      self._latest_action_spec = entity_lib.action_spec_from_dict(
          action_spec_dict  # pyrefly: ignore[bad-argument-type]
      )
    else:
      self._latest_action_spec = None
    self._state = cast(dict[str, str], state['state'])


class Locations(
    entity_component.ContextComponent, entity_component.ComponentWithLogging
):
  """A component that represents locations of entities in the world."""

  def __init__(
      self,
      model: language_model.LanguageModel,
      entity_names: Sequence[str],
      prompt: str,
      initial_locations: dict[str, str] | None = None,
      components: Sequence[str] = (),
      pre_act_label: str = '\nEntity locations',
      valid_locations: Sequence[str] | None = None,
  ):
    """Initializes the component.

    Args:
      model: The language model to use.
      entity_names: Names of entities to track locations for.
      prompt: description of all locations to be specifically represented in the
        world. This is used to prompt the model to generate concrete variables
        representing the locations and their properties (e.g. their topology).
      initial_locations: Optional dict mapping entity names to starting
        locations. If not provided, all entities start with empty locations.
      components: Keys of components to condition entity locations on.
      pre_act_label: Prefix to add to the output of the component when called in
        `pre_act`.
      valid_locations: Optional list of valid location names. When provided, the
        LLM is constrained to output only these locations, and any output not
        matching is normalized to 'unknown'. When None, free-form behavior is
        used.
    """
    super().__init__()
    self._pre_act_label = pre_act_label
    self._model = model
    self._entity_names = entity_names
    self._prompt = prompt
    self._components = tuple(components)

    self._locations = {}
    # Use initial_locations if provided, otherwise default to empty strings
    if initial_locations:
      self._entity_locations = {
          name: initial_locations.get(name, '') for name in entity_names
      }
    else:
      self._entity_locations = {name: '' for name in entity_names}
    self._latest_action_spec = None
    self._valid_locations = set(valid_locations) if valid_locations else set()

    chain_of_thought = interactive_document.InteractiveDocument(self._model)
    chain_of_thought.statement(self._prompt)
    locations_str = chain_of_thought.open_question(
        question=(
            'Given the context above, what locations are important to write '
            'down now so that they can be used later? Respond with a '
            'comma-separated list of locations using the format: '
            '"location 1|properties of location 1,'
            'location 2|properties of location 2,'
            'location 3|properties of location 3,...".'
        ),
        max_tokens=1000,
        terminators=(),
    )
    locations_and_properties = locations_str.split(',')
    for location_and_property_str in locations_and_properties:
      location_and_property = location_and_property_str.strip().split('|')
      if len(location_and_property) == 2:
        location, properties = location_and_property
        self._locations[location.strip()] = properties.strip()

  def get_named_component_pre_act_value(self, component_name: str) -> str:
    """Returns the pre-act value of a named component of the parent entity."""
    return (
        self.get_entity().get_component(
            component_name, type_=action_spec_ignored.ActionSpecIgnored
        ).get_pre_act_value()
    )

  def get_component_pre_act_label(self, component_name: str) -> str:
    """Returns the pre-act label of a named component of the parent entity."""
    return (
        self.get_entity().get_component(
            component_name, type_=action_spec_ignored.ActionSpecIgnored
        ).get_pre_act_label()
    )

  def _component_pre_act_display(self, key: str) -> str:
    """Returns the pre-act label and value of a named component."""
    return (
        f'{self.get_component_pre_act_label(key)}:\n'
        f'{self.get_named_component_pre_act_value(key)}')

  def get_pre_act_label(self) -> str:
    """Retu
```

### Core Architecture Module: `concordia/environment/engine.py`
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

"""Engine base class."""

import abc
from collections.abc import Callable, Mapping, Sequence
import json
import re
from typing import Any

from absl import logging
from concordia.environment import step_controller as step_controller_lib
from concordia.typing import entity as entity_lib

_TYPE_SKIP_THIS_STEP = 'type: __SKIP_THIS_STEP__'


class Engine(metaclass=abc.ABCMeta):
  """Engine interface."""

  @abc.abstractmethod
  def make_observation(
      self,
      game_master: entity_lib.Entity,
      entity: entity_lib.Entity,
  ) -> str:
    """Make an observation for an entity."""

  @abc.abstractmethod
  def next_acting(
      self,
      game_master: entity_lib.Entity,
      entities: Sequence[entity_lib.Entity],
  ) -> tuple[entity_lib.Entity, entity_lib.ActionSpec]:
    """Return the next entity or entities to act."""

  @abc.abstractmethod
  def resolve(
      self,
      game_master: entity_lib.Entity,
      event: str,
  ) -> None:
    """Resolve the event."""

  @abc.abstractmethod
  def terminate(
      self,
      game_master: entity_lib.Entity,
  ) -> bool:
    """Decide if the episode should terminate or continue."""

  @abc.abstractmethod
  def next_game_master(
      self,
      game_master: entity_lib.Entity,
      game_masters: Sequence[entity_lib.Entity],
  ) -> entity_lib.Entity:
    """Return the game master that will be responsible for the next step."""

  @abc.abstractmethod
  def run_loop(
      self,
      game_masters: Sequence[entity_lib.Entity],
      entities: Sequence[entity_lib.Entity],
      premise: str,
      max_steps: int,
      verbose: bool,
      log: list[Mapping[str, Any]] | None,
      checkpoint_callback: Callable[[int], None] | None = None,
      step_controller: step_controller_lib.StepController | None = None,
      step_callback: (
          Callable[[step_controller_lib.StepData], None] | None
      ) = None,
  ):
    """Run a game loop."""


def _legacy_action_spec_parser(
    next_action_spec_string: str,
) -> entity_lib.ActionSpec:
  """Parse the next action spec string using the legacy format.

  This exists for backward compatibility with the old string format:
  "prompt: <call_to_action>;;type: <free|choice> [options: opt1, opt2, ...]"

  Args:
    next_action_spec_string: The string representation of the next action spec.

  Returns:
    The parsed action spec.

  Raises:
    RuntimeError: If the next action spec string is invalid.
  """
  if 'type: free' in next_action_spec_string:
    splits = next_action_spec_string.split(';;')

    if splits and 'prompt: ' in splits[0]:
      call_to_action = splits[0].split('prompt: ', 1)[1]
    else:
      call_to_action = entity_lib.DEFAULT_CALL_TO_ACTION

    return entity_lib.ActionSpec(
        call_to_action=call_to_action,
        output_type=entity_lib.OutputType.FREE,
    )

  elif 'type: choice' in next_action_spec_string:
    splits = next_action_spec_string.split(';;')

    if 'prompt: ' in splits[0]:
      call_to_action = splits[0].split('prompt: ', 1)[1]
    else:
      call_to_action = entity_lib.DEFAULT_CALL_TO_ACTION

    if 'options: ' not in next_action_spec_string:
      return entity_lib.ActionSpec(
          call_to_action=call_to_action,
          output_type=entity_lib.OutputType.FREE,
      )

    options_str = next_action_spec_string.split('options: ', 1)[1]
    parts = re.split(r'(?<!\\),', options_str)
    options = tuple(
        dict.fromkeys(
            part.replace(r'\,', ',').strip() for part in parts if part.strip()
        )
    )
    return entity_lib.ActionSpec(
        call_to_action=call_to_action,
        output_type=entity_lib.OutputType.CHOICE,
        options=options,
    )
  elif _TYPE_SKIP_THIS_STEP in next_action_spec_string:
    return entity_lib.skip_this_step_action_spec()
  else:
    raise RuntimeError(
        'Invalid next action spec string: "{}"'.format(next_action_spec_string)
    )


def action_spec_parser(next_action_spec_string: str) -> entity_lib.ActionSpec:
  """Parse the next action spec string into an action spec.

  Supports both JSON format (preferred) and legacy string format (for backward
  compatibility).

  Args:
    next_action_spec_string: The string representation of the next action spec.

  Returns:
    The parsed action spec.
  """
  try:
    spec_dict = json.loads(next_action_spec_string)
    return entity_lib.action_spec_from_dict(spec_dict)
  except json.JSONDecodeError:
    logging.warning(
        'Using legacy action spec parser. Please migrate to JSON format. '
        'Input was: %s...',
        next_action_spec_string[:100],
    )
    return _legacy_action_spec_parser(next_action_spec_string)


def action_spec_to_string(action_spec: entity_lib.ActionSpec) -> str:
  """Convert an action spec to a JSON string."""
  return json.dumps(action_spec.to_dict())

```

### Core Architecture Module: `concordia/environment/engines/__init__.py`
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

### Core Architecture Module: `concordia/environment/engines/asynchronous.py`
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

"""Fully asynchronous engine.

Each player entity runs its own independent observe-act loop concurrently.
Unlike the simultaneous engine (which synchronizes all players per round),
players interact with the game master independently and at their own pace.
The game master and its components must be thread-safe.
"""

from collections.abc import Mapping, Sequence
import functools
import re
import threading
import time
from typing import Any, Callable, override

from absl import logging
from concordia.components.game_master import event_resolution as event_resolution_components
from concordia.components.game_master import make_observation as make_observation_component
from concordia.components.game_master import next_acting as next_acting_components
from concordia.components.game_master import switch_act as switch_act_component
from concordia.environment import engine as engine_lib
from concordia.environment import step_controller as step_controller_lib
from concordia.typing import entity as entity_lib
from concordia.utils import async_log_collector as collector_lib
from concordia.utils import async_measurements as async_measurements_lib
from concordia.utils import concurrency
import termcolor

DEFAULT_CALL_TO_MAKE_OBSERVATION = (
    make_observation_component.DEFAULT_CALL_TO_MAKE_OBSERVATION
)
DEFAULT_CALL_TO_NEXT_ACTING = 'Which entities act next?'
DEFAULT_CALL_TO_NEXT_ACTION_SPEC = (
    next_acting_components.DEFAULT_CALL_TO_NEXT_ACTION_SPEC
)
DEFAULT_CALL_TO_RESOLVE = 'Because of all that came before, what happens next?'
DEFAULT_CALL_TO_CHECK_TERMINATION = 'Is the game/simulation finished?'
DEFAULT_CALL_TO_NEXT_GAME_MASTER = (
    'Which rule set should we use for the next step?'
)

DEFAULT_ACT_COMPONENT_KEY = switch_act_component.DEFAULT_ACT_COMPONENT_KEY
_BASE64_TRUNCATE_PATTERN = re.compile(r'(base64,)[A-Za-z0-9+/=]{100,}')

PUTATIVE_EVENT_TAG = event_resolution_components.PUTATIVE_EVENT_TAG
EVENT_TAG = event_resolution_components.EVENT_TAG

_PRINT_COLOR = 'cyan'
_DEFAULT_SLEEP_TIME = 0.1


def _get_reactive_measurements(
    entity: entity_lib.Entity,
) -> async_measurements_lib.ReactiveMeasurements:
  """Returns the ReactiveMeasurements instance from an entity."""
  if not hasattr(entity, 'measurements'):
    raise ValueError(f'Entity {entity.name} has no measurements property. ')
  measurements = entity.measurements
  if not isinstance(measurements, async_measurements_lib.ReactiveMeasurements):
    raise ValueError(
        f'Entity {entity.name} uses {type(measurements).__name__} but the '
        'asynchronous engine requires ReactiveMeasurements. Pass '
        'measurements=ReactiveMeasurements() to EntityAgentWithLogging.'
    )
  return measurements


def _get_empty_log_entry():
  return {
      'terminate': {},
      'make_observation': {},
      'next_acting': {},
      'next_action_spec': {},
      'resolve': {},
  }


class Asynchronous(engine_lib.Engine):
  """Fully asynchronous engine.

  Each player entity runs its own independent observe-act loop concurrently in
  a separate thread. Players interact with the game master independently and
  at their own pace. The game master is assumed to be thread-safe.

  Termination uses both a shared threading.Event (for global signaling) and a
  per-player max iterations cap.

  A global pause event is supported for UI play/pause functionality.
  """

  def __init__(
      self,
      call_to_make_observation: str = DEFAULT_CALL_TO_MAKE_OBSERVATION,
      call_to_next_acting: str = DEFAULT_CALL_TO_NEXT_ACTING,
      call_to_next_action_spec: str = DEFAULT_CALL_TO_NEXT_ACTION_SPEC,
      call_to_resolve: str = DEFAULT_CALL_TO_RESOLVE,
      call_to_check_termination: str = DEFAULT_CALL_TO_CHECK_TERMINATION,
      call_to_next_game_master: str = DEFAULT_CALL_TO_NEXT_GAME_MASTER,
      sleep_time: float = _DEFAULT_SLEEP_TIME,
  ):
    self._call_to_make_observation = call_to_make_observation
    self._call_to_next_acting = call_to_next_acting
    self._call_to_next_action_spec = call_to_next_action_spec
    self._call_to_resolve = call_to_resolve
    self._call_to_check_termination = call_to_check_termination
    self._call_to_next_game_master = call_to_next_game_master
    self._sleep_time = sleep_time
    self._pause_event = threading.Event()
    self._pause_event.set()
    self._collector = collector_lib.AsyncLogCollector()
    self._log_list: list[Mapping[str, Any]] | None = None

  def pause(self) -> None:
    """Pause all player threads. They will block until play() is called."""
    self._pause_event.clear()
    if self._log_list is not None:
      self._collector.materialize(self._log_list)

  def play(self) -> None:
    """Resume all player threads after a pause."""
    self._pause_event.set()

  def make_observation(
      self, game_master: entity_lib.Entity, entity: entity_lib.Entity
  ) -> str:
    observation = game_master.act(
        action_spec=entity_lib.ActionSpec(
            call_to_action=self._call_to_make_observation.format(
                name=entity.name
            ),
            output_type=entity_lib.OutputType.MAKE_OBSERVATION,
        )
    )
    return observation

  @override
  def next_acting(  # pyrefly: ignore[bad-override]
      self,
      game_master: entity_lib.Entity,
      entities: Sequence[entity_lib.Entity],
      log_entry: dict[str, Any] | None = None,
      log: list[Mapping[str, Any]] | None = None,
      gm_measurements: (
          async_measurements_lib.ReactiveMeasurements | None
      ) = None,
      capture_key: str | None = None,
  ) -> tuple[Sequence[entity_lib.Entity], Sequence[entity_lib.ActionSpec]]:
    entities_by_name = {entity.name: entity for entity in entities}

    if gm_measurements is not None and log_entry is not None:
      key = capture_key or game_master.name
      with gm_measurements.capture(key) as captured:
        next_object_names_string = game_master.act(
            action_spec=entity_lib.ActionSpec(
                call_to_action=self._call_to_next_acting,
                output_type=entity_lib.OutputType.NEXT_ACTING,
                options=tuple(entities_by_name.keys()),
            )
        )
      log_entry['next_acting'] = dict(captured)
    else:
      next_object_names_string = game_master.act(
          action_spec=entity_lib.ActionSpec(
              call_to_action=self._call_to_next_acting,
              output_type=entity_lib.OutputType.NEXT_ACTING,
              options=tuple(entities_by_name.keys()),
          )
      )

    next_entity_names = [
        name.strip() for name in next_object_names_string.split(',')
    ]
    next_entity_names = [
        name for name in next_entity_names if name in entities_by_name
    ]
    if not next_entity_names:
      return ([], [])

    action_spec_by_name = {}
    for next_entity_name in next_entity_names:
      if gm_measurements is not None and log_entry is not None:
        key = capture_key or game_master.name
        with gm_measurements.capture(key) as captured:
          next_action_spec_string = game_master.act(
              action_spec=entity_lib.ActionSpec(
                  call_to_action=self._call_to_next_action_spec.format(
                      name=next_entity_name
                  ),
                  output_type=entity_lib.OutputType.NEXT_ACTION_SPEC,
              )
          )
        log_entry['next_action_spec'] = dict(captured)
      else:
        next_action_spec_string = game_master.act(
            action_spec=entity_lib.ActionSpec(
                call_to_action=self._call_to_next_action_spec.format(
                    name=next_entity_name
                ),
                output_type=entity_lib.OutputType.NEXT_ACTION_SPEC,
            )
        )

      action_spec_by_name[next_entity_name] = engine_lib.action_spec_parser(
          next_action_spec_string
      )

    return (
        [entities_by_name[entity_name] for entity_name in next_entity_names],
        [action_spec_by_name[entity_name] for entity_name in next_entity_names],
    )

  def resolve(  # pyrefly: ignore[bad-override]
      self,
      game_master: entity_lib.Entity,
      putative_event: str,
      verbose: bool = False,
  ) -> None:
    if verbose:
      display_event = _BASE64_TRUNCATE_PATTERN.sub(
          r'\1[IMAGE DATA]', putative_event
      )
      print(
          termcolor.colored(
              f'The suggested action or event to resolve was: {display_event}',
              _PRINT_COLOR,
          )
      )
    game_master.observe(observation=f'{PUTATIVE_EVENT_TAG} {putative_event}')
    result = game_master.act(
        action_spec=entity_lib.ActionSpec(
            call_to_action=self._call_to_resolve,
            output_type=entity_lib.OutputType.RESOLVE,
        )
    )
    game_master.observe(observation=f'{EVENT_TAG} {result}')
    if verbose:
      print(
          termcolor.colored(f'The resolved event was: {result}', _PRINT_COLOR)
      )

  def terminate(
      self, game_master: entity_lib.Entity, verbose: bool = False
  ) -> bool:
    should_terminate_string = game_master.act(
        action_spec=entity_lib.ActionSpec(
            call_to_action=self._call_to_check_termination,
            output_type=entity_lib.OutputType.TERMINATE,
            options=tuple(entity_lib.BINARY_OPTIONS.values()),
        )
    )
    if verbose:
      print(
          termcolor.colored(
              f'Terminate? {should_term
```

### Core Architecture Module: `concordia/environment/engines/sequential.py`
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

"""Sequential (turn-based) action engine.
"""

from collections.abc import Mapping, Sequence
import functools
import re
from typing import Any, Callable

from absl import logging
from concordia.components.game_master import event_resolution as event_resolution_components
from concordia.components.game_master import make_observation as make_observation_component
from concordia.components.game_master import next_acting as next_acting_components
from concordia.components.game_master import next_game_master as next_game_master_components
from concordia.components.game_master import switch_act as switch_act_component
from concordia.environment import engine as engine_lib
from concordia.environment import step_controller as step_controller_lib
from concordia.typing import entity as entity_lib
from concordia.utils import concurrency
import termcolor


DEFAULT_CALL_TO_MAKE_OBSERVATION = (
    make_observation_component.DEFAULT_CALL_TO_MAKE_OBSERVATION)
DEFAULT_CALL_TO_NEXT_ACTING = next_acting_components.DEFAULT_CALL_TO_NEXT_ACTING
DEFAULT_CALL_TO_NEXT_ACTION_SPEC = (
    next_acting_components.DEFAULT_CALL_TO_NEXT_ACTION_SPEC)
DEFAULT_CALL_TO_RESOLVE = 'Because of all that came before, what happens next?'
DEFAULT_CALL_TO_CHECK_TERMINATION = 'Is the game/simulation finished?'
DEFAULT_CALL_TO_NEXT_GAME_MASTER = (
    next_game_master_components.DEFAULT_CALL_TO_NEXT_GAME_MASTER)

DEFAULT_ACT_COMPONENT_KEY = switch_act_component.DEFAULT_ACT_COMPONENT_KEY
_BASE64_TRUNCATE_PATTERN = re.compile(r'(base64,)[A-Za-z0-9+/=]{100,}')

PUTATIVE_EVENT_TAG = event_resolution_components.PUTATIVE_EVENT_TAG
EVENT_TAG = event_resolution_components.EVENT_TAG

_PRINT_COLOR = 'cyan'


def _get_empty_log_entry():
  """Returns a dictionary to store a single log entry."""
  return {
      'terminate': {},
      'next_game_master': {},
      'make_observation': {},
      'next_acting': {},
      'next_action_spec': {},
      'resolve': {},
  }


class Sequential(engine_lib.Engine):
  """Sequential action (turn-based) engine.

  When this engine is used, one entity is acting at a time. The game master
  decides which entity to ask for an action on each step. The entity then
  decides what to do next, which is passed to the game master for resolution.
  The game master prepares observations for all entities in parallel.
  """

  def __init__(
      self,
      call_to_make_observation: str = DEFAULT_CALL_TO_MAKE_OBSERVATION,
      call_to_next_acting: str = DEFAULT_CALL_TO_NEXT_ACTING,
      call_to_next_action_spec: str = DEFAULT_CALL_TO_NEXT_ACTION_SPEC,
      call_to_resolve: str = DEFAULT_CALL_TO_RESOLVE,
      call_to_check_termination: str = DEFAULT_CALL_TO_CHECK_TERMINATION,
      call_to_next_game_master: str = DEFAULT_CALL_TO_NEXT_GAME_MASTER,
  ):
    """Sequential engine constructor."""
    self._call_to_make_observation = call_to_make_observation
    self._call_to_next_acting = call_to_next_acting
    self._call_to_next_action_spec = call_to_next_action_spec
    self._call_to_resolve = call_to_resolve
    self._call_to_check_termination = call_to_check_termination
    self._call_to_next_game_master = call_to_next_game_master

  def make_observation(self,
                       game_master: entity_lib.Entity,
                       entity: entity_lib.Entity) -> str:
    """Make an observation for a game object."""
    observation = game_master.act(
        action_spec=entity_lib.ActionSpec(
            call_to_action=self._call_to_make_observation.format(
                name=entity.name),
            output_type=entity_lib.OutputType.MAKE_OBSERVATION,
        )
    )
    return observation

  def next_acting(
      self,
      game_master: entity_lib.Entity,
      entities: Sequence[entity_lib.Entity],
      log_entry: Mapping[str, Any] | None = None,
      log: list[Mapping[str, Any]] | None = None,
  ) -> tuple[entity_lib.Entity, entity_lib.ActionSpec]:
    """Return the next entity or entities to act."""
    entities_by_name = {
        entity.name: entity for entity in entities
    }
    next_object_name = game_master.act(
        action_spec=entity_lib.ActionSpec(
            call_to_action=self._call_to_next_acting,
            output_type=entity_lib.OutputType.NEXT_ACTING,
            options=tuple(entities_by_name.keys()),
        )
    )
    if log is not None and hasattr(game_master, 'get_last_log'):
      assert hasattr(game_master, 'get_last_log')  # Assertion for pytype
      log_entry['next_acting'] = game_master.get_last_log()  # pyrefly: ignore[unsupported-operation]
    next_action_spec_string = game_master.act(
        action_spec=entity_lib.ActionSpec(
            call_to_action=self._call_to_next_action_spec.format(
                name=next_object_name),
            output_type=entity_lib.OutputType.NEXT_ACTION_SPEC,
        )
    )
    if log is not None and hasattr(game_master, 'get_last_log'):
      assert hasattr(game_master, 'get_last_log')  # Assertion for pytype
      log_entry['next_action_spec'] = game_master.get_last_log()  # pyrefly: ignore[unsupported-operation]
    next_action_spec = engine_lib.action_spec_parser(next_action_spec_string)

    # Validate entity name from LLM to prevent KeyError
    if next_object_name not in entities_by_name:
      raise ValueError(
          f'Game master returned invalid entity name "{next_object_name}". '
          f'Valid options: {list(entities_by_name.keys())}'
      )

    return (entities_by_name[next_object_name], next_action_spec)

  def resolve(self,  # pyrefly: ignore[bad-override]
              game_master: entity_lib.Entity,
              putative_event: str,
              verbose: bool = False) -> None:
    """Resolve an event."""
    if verbose:
      display_event = _BASE64_TRUNCATE_PATTERN.sub(
          r'\1[IMAGE DATA]', putative_event
      )
      print(
          termcolor.colored(
              f'The suggested action or event to resolve was: {display_event}',
              _PRINT_COLOR,
          )
      )
    game_master.observe(observation=f'{PUTATIVE_EVENT_TAG} {putative_event}')
    result = game_master.act(
        action_spec=entity_lib.ActionSpec(
            call_to_action=self._call_to_resolve,
            output_type=entity_lib.OutputType.RESOLVE,
        )
    )
    game_master.observe(observation=f'{EVENT_TAG} {result}')
    if verbose:
      print(termcolor.colored(
          f'The resolved event was: {result}', _PRINT_COLOR))

  def terminate(self,
                game_master: entity_lib.Entity,
                verbose: bool = False) -> bool:
    """Decide if the episode should terminate."""
    should_terminate_string = game_master.act(
        action_spec=entity_lib.ActionSpec(
            call_to_action=self._call_to_check_termination,
            output_type=entity_lib.OutputType.TERMINATE,
            options=tuple(entity_lib.BINARY_OPTIONS.values()),
        )
    )
    if verbose:
      print(termcolor.colored(
          f'Terminate? {should_terminate_string}', _PRINT_COLOR))
    return should_terminate_string == entity_lib.BINARY_OPTIONS['affirmative']

  def next_game_master(self,
                       game_master: entity_lib.Entity,
                       game_masters: Sequence[entity_lib.Entity],
                       verbose: bool = False) -> entity_lib.Entity:
    """Select which game master to use for the next step."""
    if len(game_masters) == 1:
      if verbose:
        print(termcolor.colored(
            (f'Only one game master available ({game_masters[0].name}), '
             'skipping the call to `next_game_master`.'),
            _PRINT_COLOR))
      return game_masters[0]
    game_masters_by_name = {
        game_master_.name: game_master_ for game_master_ in game_masters
    }
    next_game_master_name = game_master.act(
        action_spec=entity_lib.ActionSpec(
            call_to_action=self._call_to_next_game_master,
            output_type=entity_lib.OutputType.NEXT_GAME_MASTER,
            options=tuple(game_masters_by_name.keys()),
        )
    )
    if verbose:
      print(termcolor.colored(
          f'Game master: {next_game_master_name}', _PRINT_COLOR))
    if next_game_master_name not in game_masters_by_name:
      raise ValueError(
          f'Selected game master "{next_game_master_name}" not found in:'
          f' {game_masters_by_name.keys()}'
      )
    return game_masters_by_name[next_game_master_name]

  def run_loop(
      self,
      game_masters: Sequence[entity_lib.Entity | entity_lib.EntityWithLogging],
      entities: Sequence[entity_lib.Entity | entity_lib.EntityWithLogging],
      premise: str = '',
      max_steps: int = 100,
      verbose: bool = False,
      log: list[Mapping[str, Any]] | None = None,
      checkpoint_callback: Callable[[int], None] | None = None,
      step_controller: step_controller_lib.StepController | None = None,
      step_callback: (
          Callable[[step_controller_lib.StepData], None] | None
      ) = None,
  ):
    """Run a game loop."""
    if not game_masters:
      raise ValueError('No game masters provided.')

    log_entry = _get_empty_log_entry()
    steps = 0
    game_master = game_masters[0]
    if premise:
      premise = f'{EVENT_TAG} {premise}'
      game_master.observe(premise)
    while not self.terminate(game_master, verbose) and steps < max_steps:
      if step_controller is not None:
        if not step_controller.wait_for_step_permission
```

### Core Architecture Module: `concordia/environment/engines/simultaneous.py`
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

"""Simultaneous engine."""

from collections.abc import Mapping, Sequence
import functools
import re
import threading
from typing import Any, Callable, override

from absl import logging
from concordia.components.game_master import event_resolution as event_resolution_components
from concordia.components.game_master import make_observation as make_observation_component
from concordia.components.game_master import next_acting as next_acting_components
from concordia.components.game_master import switch_act as switch_act_component
from concordia.environment import engine as engine_lib
from concordia.environment import step_controller as step_controller_lib
from concordia.typing import entity as entity_lib
from concordia.utils import concurrency
import termcolor


DEFAULT_CALL_TO_MAKE_OBSERVATION = (
    make_observation_component.DEFAULT_CALL_TO_MAKE_OBSERVATION
)
DEFAULT_CALL_TO_NEXT_ACTING = 'Which entities act next?'
DEFAULT_CALL_TO_NEXT_ACTION_SPEC = (
    next_acting_components.DEFAULT_CALL_TO_NEXT_ACTION_SPEC
)
DEFAULT_CALL_TO_RESOLVE = 'Because of all that came before, what happens next?'
DEFAULT_CALL_TO_CHECK_TERMINATION = 'Is the game/simulation finished?'
DEFAULT_CALL_TO_NEXT_GAME_MASTER = (
    'Which rule set should we use for the next step?'
)

DEFAULT_ACT_COMPONENT_KEY = switch_act_component.DEFAULT_ACT_COMPONENT_KEY
_BASE64_TRUNCATE_PATTERN = re.compile(r'(base64,)[A-Za-z0-9+/=]{100,}')

PUTATIVE_EVENT_TAG = event_resolution_components.PUTATIVE_EVENT_TAG
EVENT_TAG = event_resolution_components.EVENT_TAG

_PRINT_COLOR = 'cyan'


def _get_empty_log_entry():
  """Returns a dictionary to store a single log entry."""
  return {
      'terminate': {},
      'next_game_master': {},
      'make_observation': {},
      'next_acting': {},
      'next_action_spec': {},
      'resolve': {},
  }


class Simultaneous(engine_lib.Engine):
  """Engine for simultaneous move games."""

  def __init__(
      self,
      call_to_make_observation: str = DEFAULT_CALL_TO_MAKE_OBSERVATION,
      call_to_next_acting: str = DEFAULT_CALL_TO_NEXT_ACTING,
      call_to_next_action_spec: str = DEFAULT_CALL_TO_NEXT_ACTION_SPEC,
      call_to_resolve: str = DEFAULT_CALL_TO_RESOLVE,
      call_to_check_termination: str = DEFAULT_CALL_TO_CHECK_TERMINATION,
      call_to_next_game_master: str = DEFAULT_CALL_TO_NEXT_GAME_MASTER,
  ):
    """Simultaneous engine constructor."""
    self._call_to_make_observation = call_to_make_observation
    self._call_to_next_acting = call_to_next_acting
    self._call_to_next_action_spec = call_to_next_action_spec
    self._call_to_resolve = call_to_resolve
    self._call_to_check_termination = call_to_check_termination
    self._call_to_next_game_master = call_to_next_game_master
    self._gm_log_lock = threading.Lock()

  def make_observation(
      self, game_master: entity_lib.Entity, entity: entity_lib.Entity
  ) -> str:
    """Make an observation for a game object."""
    observation = game_master.act(
        action_spec=entity_lib.ActionSpec(
            call_to_action=self._call_to_make_observation.format(
                name=entity.name
            ),
            output_type=entity_lib.OutputType.MAKE_OBSERVATION,
        )
    )
    return observation

  @override
  def next_acting(  # pyrefly: ignore[bad-override]
      self,
      game_master: entity_lib.Entity,
      entities: Sequence[entity_lib.Entity],
      log_entry: Mapping[str, Any] | None = None,
      log: list[Mapping[str, Any]] | None = None,
  ) -> tuple[Sequence[entity_lib.Entity], Sequence[entity_lib.ActionSpec]]:
    """Return the next action spec for an entity."""
    entities_by_name = {entity.name: entity for entity in entities}
    next_object_names_string = game_master.act(
        action_spec=entity_lib.ActionSpec(
            call_to_action=self._call_to_next_acting,
            output_type=entity_lib.OutputType.NEXT_ACTING,
            options=tuple(entities_by_name.keys()),
        )
    )
    next_entity_names = [
        name.strip() for name in next_object_names_string.split(',')]
    if log is not None and hasattr(game_master, 'get_last_log'):
      assert hasattr(game_master, 'get_last_log')  # Assertion for pytype
      log_entry['next_acting'] = game_master.get_last_log()  # pyrefly: ignore[unsupported-operation]

    action_spec_by_name = {}
    for next_entity_name in next_entity_names:
      next_action_spec_string = game_master.act(
          action_spec=entity_lib.ActionSpec(
              call_to_action=self._call_to_next_action_spec.format(
                  name=next_entity_name
              ),
              output_type=entity_lib.OutputType.NEXT_ACTION_SPEC,
          )
      )
      action_spec_by_name[next_entity_name] = engine_lib.action_spec_parser(
          next_action_spec_string
      )

      if log is not None and hasattr(game_master, 'get_last_log'):
        assert hasattr(game_master, 'get_last_log')  # Assertion for pytype
        log_entry['next_action_spec'] = game_master.get_last_log()  # pyrefly: ignore[unsupported-operation]

    # Validate all entity names from LLM to prevent KeyError
    invalid_names = [
        name for name in next_entity_names if name not in entities_by_name]
    if invalid_names:
      raise ValueError(
          f'Game master returned invalid entity names: {invalid_names}. '
          f'Valid options: {list(entities_by_name.keys())}'
      )

    return (
        [entities_by_name[entity_name] for entity_name in next_entity_names],
        [action_spec_by_name[entity_name] for entity_name in next_entity_names],
    )

  def resolve(  # pyrefly: ignore[bad-override]
      self,
      game_master: entity_lib.Entity,
      putative_event: str,
      verbose: bool = False,
  ) -> None:
    """Resolve an event."""
    if verbose:
      display_event = _BASE64_TRUNCATE_PATTERN.sub(
          r'\1[IMAGE DATA]', putative_event
      )
      print(
          termcolor.colored(
              f'The suggested action or event to resolve was: {display_event}',
              _PRINT_COLOR,
          )
      )
    game_master.observe(observation=f'{PUTATIVE_EVENT_TAG} {putative_event}')
    result = game_master.act(
        action_spec=entity_lib.ActionSpec(
            call_to_action=self._call_to_resolve,
            output_type=entity_lib.OutputType.RESOLVE,
        )
    )
    game_master.observe(observation=f'{EVENT_TAG} {result}')
    if verbose:
      print(
          termcolor.colored(f'The resolved event was: {result}', _PRINT_COLOR)
      )

  def terminate(
      self, game_master: entity_lib.Entity, verbose: bool = False
  ) -> bool:
    """Decide if the episode should terminate."""
    should_terminate_string = game_master.act(
        action_spec=entity_lib.ActionSpec(
            call_to_action=self._call_to_check_termination,
            output_type=entity_lib.OutputType.TERMINATE,
            options=tuple(entity_lib.BINARY_OPTIONS.values()),
        )
    )
    if verbose:
      print(
          termcolor.colored(
              f'Terminate? {should_terminate_string}', _PRINT_COLOR
          )
      )
    return should_terminate_string == entity_lib.BINARY_OPTIONS['affirmative']

  def next_game_master(
      self,
      game_master: entity_lib.Entity,
      game_masters: Sequence[entity_lib.Entity],
      verbose: bool = False,
  ) -> entity_lib.Entity:
    """Select which game master to use for the next step."""
    if len(game_masters) == 1:
      return game_masters[0]
    game_masters_by_name = {
        game_master_.name: game_master_ for game_master_ in game_masters
    }
    next_game_master_name = game_master.act(
        action_spec=entity_lib.ActionSpec(
            call_to_action=self._call_to_next_game_master,
            output_type=entity_lib.OutputType.NEXT_GAME_MASTER,
            options=tuple(game_masters_by_name.keys()),
        )
    )
    if verbose:
      print(
          termcolor.colored(
              f'Game master: {next_game_master_name}', _PRINT_COLOR
          )
      )
    if next_game_master_name not in game_masters_by_name:
      raise ValueError(
          f'Selected game master {next_game_master_name} not found in:'
          f' {game_masters_by_name.keys()}'
      )
    return game_masters_by_name[next_game_master_name]

  def run_loop(
      self,
      game_masters: Sequence[entity_lib.Entity],
      entities: Sequence[entity_lib.Entity],
      premise: str = '',
      max_steps: int = 100,
      verbose: bool = False,
      log: list[Mapping[str, Any]] | None = None,
      checkpoint_callback: Callable[[int], None] | None = None,
      step_controller: step_controller_lib.StepController | None = None,
      step_callback: (
          Callable[[step_controller_lib.StepData], None] | None
      ) = None,
  ):
    """Run a game loop."""
    if not game_masters:
      raise ValueError('No game masters provided.')

    log_entry = _get_empty_log_entry()
    game_master = game_masters[0]
    steps = 0
    if premise:
      premise = f'{EVENT_TAG} {premise}'
      game_master.observe(premise)
    while not self.terminate(game_master, verbose) and steps < max_steps:
      if step_controller is not None:
        if not step_controller.wait_for_step_permission():
          break

      if log is not None and hasattr(game_master, 'get_last_log'):
        assert hasattr(game_master, 'get_last_log')  # Assertion for pytype
        log_entry[
```

### Core Architecture Module: `concordia/utils/__init__.py`
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

### Core Architecture Module: `concordia/utils/async_log_collector.py`
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

"""Async log collector that defers log processing for the async engine."""

from collections.abc import Mapping
import dataclasses
import threading
from typing import Any

from concordia.components.game_master import switch_act as switch_act_component

DEFAULT_ACT_COMPONENT_KEY = switch_act_component.DEFAULT_ACT_COMPONENT_KEY


@dataclasses.dataclass
class RawLogEvent:
  """A raw, unprocessed log event emitted by an entity thread."""

  step: int
  entity_name: str
  game_master_name: str
  entity_log: Mapping[str, Any]
  game_master_log: Mapping[str, Any]
  action: str


class AsyncLogCollector:
  """Collects raw log events from entity threads and defers finalization.

  Entity threads emit RawLogEvent instances via emit(). The expensive
  finalization (nested dict iteration, filtering empty values) only happens
  when materialize() is called — typically on pause or at simulation end.
  """

  def __init__(self):
    self._buffer: list[RawLogEvent] = []
    self._lock = threading.Lock()

  def emit(self, event: RawLogEvent) -> None:
    with self._lock:
      self._buffer.append(event)

  def materialize(self, log: list[Mapping[str, Any]]) -> None:
    """Finalize all buffered events and append to the raw log list.

    Args:
      log: The raw_log list to append finalized entries to.
    """
    with self._lock:
      events = list(self._buffer)
      self._buffer.clear()

    for event in events:
      game_master_finalized_log = {}
      for segment_key, segment_log in event.game_master_log.items():
        game_master_finalized_log[segment_key] = {}
        if not isinstance(segment_log, dict):
          continue
        for component_key, component_value in segment_log.items():
          if component_value and isinstance(component_value, dict):
            tmp_log_dict = {
                key: value for key, value in component_value.items() if value
            }
            if len(tmp_log_dict) > 1:
              game_master_finalized_log[segment_key][
                  component_key
              ] = tmp_log_dict

      game_master_key = event.game_master_name
      if DEFAULT_ACT_COMPONENT_KEY in game_master_finalized_log.get(
          'resolve', {}
      ):
        event_to_log = game_master_finalized_log['resolve'][
            DEFAULT_ACT_COMPONENT_KEY
        ].get('Value', '')
        game_master_key = f'{game_master_key} --- {event_to_log}'

      entity_key = f'Entity [{event.entity_name}]'
      entry = {
          'Step': event.step,
          entity_key: dict(event.entity_log) if event.entity_log else {},
          game_master_key: game_master_finalized_log,
          'Summary': f'Step {event.step} {game_master_key}',
          'thread': event.entity_name,
      }
      log.append(entry)

  def pending_count(self) -> int:
    with self._lock:
      return len(self._buffer)

```

### Core Architecture Module: `concordia/utils/async_measurements.py`
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

"""Reactive measurements for async engines using reactivex."""

import contextlib
import threading
from typing import Any

from concordia.utils import measurements as measurements_lib
from reactivex import subject as reactivex_subject


class ReactiveMeasurements(measurements_lib.Measurements):
  """Measurements subclass that emits data via reactivex Subjects.

  In addition to storing data in channels (like the base Measurements class),
  this class emits each published datum through a reactivex Subject. This
  enables reactive subscribers to capture log data atomically as it is produced.

  Usage:
    measurements = ReactiveMeasurements()

    # Components set up logging channels as usual:
    component.set_logging_channel(
        measurements.get_channel('my_component').append
    )

    # To capture logs atomically during an act() call:
    with measurements.capture() as captured:
        result = entity.act(action_spec)
    # captured now contains {channel_name: datum} for all data emitted
    # during the act() call.
  """

  def __init__(self):
    super().__init__()
    self._subject = reactivex_subject.Subject()
    self._active_captures: dict[int, tuple[str, dict[str, Any]]] = {}
    self._capture_lock = threading.Lock()

  def publish_datum(
      self, channel: str, datum: Any, capture_key: str | None = None
  ) -> None:
    super().publish_datum(channel, datum, capture_key=capture_key)
    if capture_key is not None:
      with self._capture_lock:
        for _, (key, captured) in self._active_captures.items():
          if key == capture_key:
            captured[channel] = datum
    self._subject.on_next((channel, datum))

  @contextlib.contextmanager
  def capture(self, key: str):
    """Context manager that captures data published with a matching key.

    Only data emitted via publish_datum with a capture_key matching this
    capture's key will be stored. This prevents cross-contamination when
    multiple entity threads share the same ReactiveMeasurements instance.

    This captures data from ALL threads (not just the caller), which is
    necessary because EntityAgent._parallel_call_ runs components in worker
    threads.

    Args:
      key: The capture key, typically an entity or game master name.

    Yields:
      A dict that accumulates {channel_name: datum} entries.
    """
    captured: dict[str, Any] = {}
    capture_id = id(captured)
    with self._capture_lock:
      self._active_captures[capture_id] = (key, captured)
    try:
      yield captured
    finally:
      with self._capture_lock:
        self._active_captures.pop(capture_id, None)

  def subscribe(self, callback):
    """Subscribe to all datum emissions.

    Args:
      callback: Called with (channel_name, datum) for each emission.

    Returns:
      A disposable subscription.
    """
    return self._subject.subscribe(on_next=callback)

  def dispose(self):
    """Complete the subject and release resources."""
    self._subject.on_completed()
    self._subject.dispose()

```

### Core Architecture Module: `concordia/utils/browser_sessions.py`
```
# Copyright 2026 DeepMind Technologies Limited.
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

"""Host-approved browser roles using standard opaque HTTP cookie sessions.

This is a process-lifetime session store, not an account service. Approval is
explicit on a separate trusted host surface. Browser labels are NOT identity
proof: hosts must verify the intended participant before approving a request.
No role, invitation, session credential or private state belongs in a URL/log.
"""

import dataclasses
from http import cookies
import secrets
import threading
import uuid

from concordia.utils import operation_service as ops


@dataclasses.dataclass
class Browser:
  principal: str
  label: str = ''
  requested_role: str = ''
  role: str = ''


class BrowserSessions:
  """Bounded sessions: retain reloads, fail closed on process restart."""

  def __init__(self, roles, *, capacity=128, secure=True, cookie_path='/'):
    if not cookie_path.startswith('/') or any(
        c in cookie_path for c in ';\r\n'
    ):
      raise ValueError('Invalid cookie path')
    self.roles = tuple(roles)
    self.secure = secure
    self.path = cookie_path
    self.cookie_name = 'concordia_' + uuid.uuid4().hex
    self._sessions: dict[str, str] = {}
    self._browsers: dict[str, Browser] = {}
    self._capacity = capacity
    self._lock = threading.RLock()

  def identify(self, cookie_header, *, create=False):
    """Return the internal principal and optional Set-Cookie, never a role."""
    jar = cookies.SimpleCookie()
    try:
      jar.load(cookie_header or '')
    except cookies.CookieError:
      pass
    morsel = jar.get(self.cookie_name)
    with self._lock:
      token = morsel.value if morsel else ''
      if token in self._sessions:
        return self._sessions[token], None
      if not create:
        raise ops.OperationError(
            'unauthorized', 'Open the join page in this browser first.'
        )
      if len(self._sessions) >= self._capacity:
        raise ops.OperationError(
            'session_capacity', 'The host must start a new session.'
        )
      token = secrets.token_urlsafe(32)
      principal = 'browser:' + uuid.uuid4().hex
      self._sessions[token] = principal
      self._browsers[principal] = Browser(principal)
      jar = cookies.SimpleCookie()
      jar[self.cookie_name] = token
      jar[self.cookie_name]['path'] = self.path
      jar[self.cookie_name]['httponly'] = True
      jar[self.cookie_name]['samesite'] = 'Strict'
      if self.secure:
        jar[self.cookie_name]['secure'] = True
      return principal, jar[self.cookie_name].OutputString()

  def audience(self, principal):
    with self._lock:
      browser = self._browsers.get(principal)
      if browser is None:
        # Only the trusted local listener supplies fixed developer identity.
        return principal if principal == 'developer' else 'visitor'
      return 'role:' + browser.role if browser.role else 'visitor'

  def request(self, principal, label, role):
    """Record a pending role join request for a browser session."""
    with self._lock:
      browser = self._browsers.get(principal)
      if browser is None:
        raise ops.OperationError('unauthorized', 'Open the join page first.')
      if browser.role:
        raise ops.OperationError(
            'already_joined', 'This browser already holds a role.'
        )
      if role not in self.roles or not label.strip() or len(label) > 80:
        raise ops.OperationError(
            'invalid_join', 'Choose an available role and a short name.'
        )
      if any(b.role == role for b in self._browsers.values()):
        raise ops.OperationError(
            'role_taken', 'That role is already held; ask the host.'
        )
      browser.label, browser.requested_role = label.strip(), role
      return {'requested_role': role, 'label': browser.label}

  def approve(self, principal):
    """Approve a pending role join request for a browser session."""
    with self._lock:
      browser = self._browsers.get(principal)
      if browser is None or not browser.requested_role:
        raise ops.OperationError(
            'invalid_join', 'Select a pending join request.'
        )
      if browser.role:
        return {'role': browser.role}
      role = browser.requested_role
      if any(b.role == role for b in self._browsers.values()):
        raise ops.OperationError(
            'role_taken', 'Role already held; no state changed.'
        )
      browser.role = role
      return {'role': role}

  def revoke(self, principal):
    with self._lock:
      browser = self._browsers.get(principal)
      if browser is None:
        raise ops.OperationError('invalid_join', 'Unknown join request.')
      browser.role = browser.requested_role = ''
      return {'revoked': True}

  def own(self, principal):
    with self._lock:
      browser = self._browsers.get(principal)
      return {
          'label': browser.label if browser else '',
          'requested_role': browser.requested_role if browser else '',
          'roles': [
              r
              for r in self.roles
              if not any(b.role == r for b in self._browsers.values())
          ],
      }

  def pending(self):
    with self._lock:
      return [
          {
              'id': b.principal,
              'label': b.label,
              'requested_role': b.requested_role,
              'role': b.role,
          }
          for b in self._browsers.values()
          if b.requested_role
      ]

  def ready(self, roles):
    with self._lock:
      return set(roles) <= {b.role for b in self._browsers.values()}

```

### Core Architecture Module: `concordia/utils/concurrency.py`
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

"""Concurrency helpers."""

from collections.abc import Collection, Iterator, Mapping, Sequence
from concurrent import futures
import contextlib
import functools
from typing import Any, Callable, TypeVar

from absl import logging

_T = TypeVar('_T')


@contextlib.contextmanager
def _executor(**kwargs) -> Iterator[futures.ThreadPoolExecutor]:
  """Context manager for a concurrent.futures.ThreadPoolExecutor.

  On normal __exit__ this context manager will behave like
  `ThreadPoolExecutor.__exit__`: it will block until all running and pending
  threads complete.

  However, on an __exit__ due to an error, the executor will be shutdown
  immediately without waiting for the running futures to complete, and all
  pending futures will be cancelled. This allows errors to quickly propagate to
  the caller.

  Args:
    **kwargs: Forwarded to ThreadPoolExecutor.

  Yields:
    A thread pool executor.
  """
  thread_executor = futures.ThreadPoolExecutor(**kwargs)
  try:
    yield thread_executor
  except BaseException:
    thread_executor.shutdown(wait=False, cancel_futures=True)
    raise
  else:
    thread_executor.shutdown()


def _run_task(key: str, fn: Callable[[], _T]) -> Callable[[], _T]:
  """Returns fn() and logs ordinary exceptions."""
  try:
    return fn()  # pyrefly: ignore[bad-return]
  except Exception:
    logging.exception('Error in task %s', key)
    raise


def _as_completed(
    tasks: Mapping[str, Callable[[], _T]],
    *,
    timeout: float | None = None,
    max_workers: int | None = None,
    executor: futures.ThreadPoolExecutor | None = None,
) -> Iterator[tuple[str, futures.Future[_T]]]:
  """Maps a function to a sequence of values in parallel.

  IMPORTANT: Passed callables must be threadsafe.

  Args:
    tasks: callables to execute (MUST BE THREADSAFE)
    timeout: the maximum number of seconds to wait for all tasks to complete.
    max_workers: them maximum number of parallel jobs. If None will use as many
      workers as there are tasks. Ignored if executor is provided.
    executor: An optional existing ThreadPoolExecutor to use. If None, a new
      one will be created.

  Yields:
    (key, future) as tasks complete.

  Raises:
    TimeoutError: If all the results are not generated before the timeout.
  """
  if not tasks:
    return

  def submit_tasks(exec_):
    return {
        exec_.submit(_run_task, key, task): key for key, task in tasks.items()
    }

  if executor is not None:
    key_by_future = submit_tasks(executor)
    for future in futures.as_completed(key_by_future, timeout=timeout):
      yield key_by_future[future], future
  else:
    if max_workers is None or max_workers > len(tasks):
      max_workers = len(tasks)
    with _executor(max_workers=max_workers) as executor_:
      key_by_future = submit_tasks(executor_)
      for future in futures.as_completed(key_by_future, timeout=timeout):
        yield key_by_future[future], future


def run_tasks(
    tasks: Mapping[str, Callable[[], _T]],
    *,
    timeout: float | None = None,
    max_workers: int | None = None,
    executor: futures.ThreadPoolExecutor | None = None,
) -> Mapping[str, _T]:
  """Runs the callables in parallel, blocks until first failure.

  IMPORTANT: Passed callables must be threadsafe.

  Args:
    tasks: callables to execute (MUST BE THREADSAFE)
    timeout: the maximum number of seconds to wait.
    max_workers: them maximum number of parallel jobs. If None will use as many
      workers as there are tasks. Ignored if executor is provided.
    executor: An optional existing ThreadPoolExecutor to use.

  Returns:
    The results fn(*arg) for arg in args]
    However, the calls will be executed concurrently.

  Raises:
    TimeoutError: If all the results are not generated before the timeout.
    Exception: If any task raises an exception.
  """
  return {
      key: future.result()
      for key, future in _as_completed(
          tasks, timeout=timeout, max_workers=max_workers, executor=executor
      )
  }


def run_tasks_in_background(
    tasks: Mapping[str, Callable[[], _T]],
    *,
    timeout: float | None = None,
    max_workers: int | None = None,
    executor: futures.ThreadPoolExecutor | None = None,
) -> tuple[Mapping[str, _T], Mapping[str, BaseException]]:
  """Runs the callables in parallel, blocks until all complete.

  IMPORTANT: Passed callables must be threadsafe.

  Args:
    tasks: callables to execute (MUST BE THREADSAFE)
    timeout: the maximum number of seconds to wait.
    max_workers: them maximum number of parallel jobs. If None will use as many
      workers as there are tasks. Ignored if executor is provided.
    executor: An optional existing ThreadPoolExecutor to use.

  Returns:
    (results, errors): a mappings from key to the result of the callable or the
    exception it raised. Thus if no task raised an error, errors will be empty.
  """
  results = {}
  errors = {}
  try:
    for key, future in _as_completed(
        tasks, timeout=timeout, max_workers=max_workers, executor=executor
    ):
      error = future.exception()
      if error is not None:
        errors[key] = error
      else:
        results[key] = future.result()
  except TimeoutError as error:
    unfinished = tasks.keys() - results.keys() - errors.keys()
    for key in unfinished:
      errors[key] = error
  return results, errors


def map_parallel(
    fn: Callable[..., _T],
    *args: Collection[Any],
    timeout: float | None = None,
    max_workers: int | None = None,
    executor: futures.ThreadPoolExecutor | None = None,
) -> Sequence[_T]:
  """Runs `map(*args)` in parallel.

  IMPORTANT: Passed callables must be threadsafe.

  Args:
    fn: function to execute (MUST BE THREADSAFE)
    *args: arguments to pass to function.
    timeout: the maximum number of seconds to wait.
    max_workers: them maximum number of parallel jobs. If None, will use as many
      workers as there are arguments. Ignored if executor is provided.
    executor: An optional existing ThreadPoolExecutor to use.

  Returns:
    [fn(arg0, arg1, ...) for arg0, arg1, ...  in zip(*args)]
    However, the calls will be executed concurrently.

  Raises:
    TimeoutError: If all the results are not generated before the timeout.
    Exception: If fn(*args) raises for any values.
  """
  tasks = {
      str(n): functools.partial(fn, *arg)
      for n, arg in enumerate(zip(*args, strict=True))
  }
  results = run_tasks(
      tasks, timeout=timeout, max_workers=max_workers, executor=executor
  )
  return [results[key] for key in tasks]

```

### Core Architecture Module: `concordia/utils/helper_functions.py`
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

"""Helper functions."""

from collections.abc import Iterable, Sequence
import datetime
import functools
import inspect
import re
import types
from typing import Any

from absl import logging
from concordia.document import interactive_document
from concordia.language_model import language_model
from concordia.utils import concurrency
import numpy as np
import pandas as pd


def extract_text_between_delimiters(text: str, delimiter: str) -> str | None:
  """Extracts text between the first two occurrences of a delimiter in a string.

  Args:
    text: The string to search through and extract from.
    delimiter: The delimiter string.

  Returns:
    The extracted text, or None if the delimiter does not appear twice.
  """
  first_delimiter_index = text.find(delimiter)
  if first_delimiter_index == -1:
    return None
  second_delimiter_index = text.find(delimiter,
                                     first_delimiter_index + len(delimiter))
  if second_delimiter_index == -1:
    return None

  return text[first_delimiter_index + len(delimiter):second_delimiter_index]


def filter_copy_as_statement(
    doc: interactive_document.InteractiveDocument,
    include_tags: Iterable[str] = (),
    exclude_tags: Iterable[str] = (),
) -> interactive_document.InteractiveDocument:
  """Copy interactive document as an initial statement.

  Args:
    doc: document to copy
    include_tags: tags to include in the statement.
    exclude_tags: tags to filter out from the statement.
      interactive_document.DEBUG_TAG will always be added.

  Returns:
    an interactive document containing a filtered copy of the input document.
  """
  filtered_view = doc.view(
      include_tags=include_tags,
      exclude_tags={interactive_document.DEBUG_TAG, *exclude_tags},
  )
  result_doc = doc.new()
  result_doc.statement(filtered_view.text())
  return result_doc


def extract_from_generated_comma_separated_list(x: str) -> Sequence[str]:
  """Extract from a maybe badly formatted comma-separated list."""
  result = x.split(',')
  return [item.strip('" ') for item in result]


def is_count_noun(x: str, model: language_model.LanguageModel) -> bool:
  """Output True if the input is a count noun, not a mass noun.

  For a count noun you ask how *many* there are. For a mass noun you ask how
  *much* there is.

  Args:
    x: input string. It should be a noun.
    model: a language model

  Returns:
    True if x is a count noun and False if x is a mass noun.
  """
  examples = (
      'Question: is money a count noun? [yes/no]\n' + 'Answer: no\n'
      'Question: is coin a count noun? [yes/no]\n' + 'Answer: yes\n'
      'Question: is water a count noun? [yes/no]\n' + 'Answer: no\n'
      'Question: is apple a count noun? [yes/no]\n' + 'Answer: yes\n'
      'Question: is token a count noun? [yes/no]\n' + 'Answer: yes\n'
  )
  doc = interactive_document.InteractiveDocument(model=model)
  doc.statement(examples)
  answer = doc.yes_no_question(question=f'is {x} a count noun? [yes/no]')
  return answer


def timedelta_to_readable_str(td: datetime.timedelta):
  """Converts a datetime.timedelta object to a readable string."""
  hours = td.seconds // 3600
  minutes = (td.seconds % 3600) // 60
  seconds = td.seconds % 60

  readable_str = []
  if hours > 0:
    readable_str += [f'{hours} hour' if hours == 1 else f'{hours} hours']
  if minutes > 0:
    if hours > 0:
      readable_str += ' and '
    readable_str += [
        f'{minutes} minute' if minutes == 1 else f'{minutes} minutes'
    ]
  if seconds > 0:
    if hours > 0 or minutes > 0:
      readable_str += [' and ']
    readable_str += [
        f'{seconds} second' if seconds == 1 else f'{seconds} seconds'
    ]

  return ''.join(readable_str)


def apply_recursively(
    parent_component: Any,
    function_name: str,
    function_arg: str | None = None,
    concurrent_child_calls: bool = False,
) -> None:
  """Recursively applies a function to each component in a tree of components.

  Args:
    parent_component: the component to apply the function to.
    function_name: the name of the function to apply.
    function_arg: the argument to pass to the function.
    concurrent_child_calls: whether to call the function on child components
      concurrently.
  """
  if concurrent_child_calls:
    concurrency.run_tasks({
        f'{child_component.name}.{function_name}': functools.partial(
            apply_recursively,
            parent_component=child_component,
            function_name=function_name,
            function_arg=function_arg,
            concurrent_child_calls=concurrent_child_calls,
        )
        for child_component in parent_component.get_components()
    })
  else:
    for child_component in parent_component.get_components():
      apply_recursively(
          parent_component=child_component,
          function_name=function_name,
          function_arg=function_arg,
      )

  if function_arg is None:
    getattr(parent_component, function_name)()
  else:
    getattr(parent_component, function_name)(function_arg)


def get_package_classes(module: types.ModuleType):
  """Load all classes defined in any file within a package."""
  package_name = module.__package__
  prefabs = {}
  submodule_names = [
      value for value in dir(module) if not value.startswith('__')]
  for submodule_name in submodule_names:
    submodule = getattr(module, submodule_name)
    all_var_names = dir(submodule)
    for var_name in all_var_names:
      var = getattr(submodule, var_name)
      if inspect.isclass(var) and var.__module__.startswith(package_name):  # pyrefly: ignore[bad-argument-type]
        key = f'{submodule_name}__{var_name}'
        prefabs[key] = var()
  return prefabs


def print_pretty_prefabs(data_dict):
  """Generates a Markdown string representation of a dictionary.

  Each object's representation (from its __repr__ method) is formatted
  to show the class name and its arguments on separate lines,
  indented, within a Python code block for syntax highlighting.
  Lines for 'entities=None' or 'entities=()' will be omitted.

  Args:
      data_dict (dict): The dictionary to format. Values are expected to be
        objects whose __repr__ produces a string like "ClassName(arg1=value1,
        arg2=value2, ...)".

  Returns:
      str: A string formatted as Markdown.
  """
  output_lines = []

  if not data_dict:
    return '(The dictionary is empty)'

  for key, value_obj in data_dict.items():
    output_lines.append('---')

    value_str = repr(value_obj)

    output_lines.append(f'**`{key}`**:')
    output_lines.append('```python')

    first_paren_idx = value_str.find('(')

    if first_paren_idx != -1 and value_str.endswith(')'):
      class_name = value_str[:first_paren_idx]
      output_lines.append(f'{class_name}(')

      last_paren_idx = value_str.rfind(')')

      if last_paren_idx > first_paren_idx:
        args_content = value_str[first_paren_idx + 1 : last_paren_idx]

        if args_content.strip():
          raw_split_args = re.split(
              r',\s*(?=[_a-zA-Z][_a-zA-Z0-9]*=)', args_content
          )

          # Filter arguments before printing
          args_to_print = []
          for arg_str in raw_split_args:
            stripped_arg_str = arg_str.strip()
            if not stripped_arg_str:  # Skip if argument is empty after strip
              continue

            # Check if the argument is 'entities=None' or 'entities=()'
            if (
                stripped_arg_str == 'entities=None'
                or stripped_arg_str == 'entities=()'
            ):
              continue  # Skip this argument

            args_to_print.append(stripped_arg_str)

          if args_to_print:
            for i, final_arg_str in enumerate(args_to_print):
              line_to_add = f'    {final_arg_str}'

              if i < len(args_to_print) - 1:  # If it's not the last argument
                line_to_add += ','

              output_lines.append(line_to_add)

        output_lines.append(')')
      else:
        output_lines.append(')')
    else:
      output_lines.append(value_str)

    output_lines.append('```')

  if data_dict:
    output_lines.append('---')

  return '\n'.join(output_lines)


def remove_duplicate_dicts(
    list_of_dicts: Sequence[dict[str, Any]],
) -> Sequence[dict[str, Any]]:
  """Removes duplicate dictionaries from a list of dictionaries."""
  seen = set()
  unique_dicts = []
  for d in list_of_dicts:
    # Convert the dictionary to a frozenset of its items, which is hashable
    frozen_items = frozenset(d.items())
    if frozen_items not in seen:
      unique_dicts.append(d)
      seen.add(frozen_items)
  return unique_dicts


def _make_hashable(value: Any) -> Any:
  """Returns a hashable stand-in for `value`, recursing into containers."""
  if isinstance(value, dict):
    return frozenset((k, _make_hashable(v)) for k, v in value.items())
  if isinstance(value, (list, tuple)):
    return tuple(_make_hashable(v) for v in value)
  if isinstance(value, (set, frozenset)):
    return frozenset(_make_hashable(v) for v in value)
  try:
    hash(value)
  except TypeError:
    return repr(value)
  return value


def remove_duplicate_values(values: Sequence[Any]) -> Sequence[Any]:
  """Removes duplicate values from a list, preserving first-seen order.

  Unlike `remove_duplicate_dicts`, this works for any mix of dicts, lists and
  scalar values.

  Args:
    va
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

### Incident Patch 1: `b71d2027` (2026-10-01)
**Commit Message**: Merge pull request #274 from Osamaali313:fix/sampling-temperature-midpoint

PiperOrigin-RevId: 991899598
Change-Id: I1f2df200ba50cbefbd2b6b0091bdfa0541f7cb3d

**File**: `concordia/utils/sampling.py` (modified, +1/-1)
```diff
@@ -49,6 +49,6 @@ def dynamically_adjust_temperature(
   temperature = 0.0
   if attempts > 1 and attempts < (max_attempts / 2.0):
     temperature = 0.5
-  elif attempts > (max_attempts / 2.0):
+  elif attempts >= (max_attempts / 2.0):
     temperature = 0.75
   return temperature
```

**File**: `concordia/utils/sampling_test.py` (modified, +1/-1)
```diff
@@ -50,7 +50,7 @@ class DynamicallyAdjustTemperatureTest(parameterized.TestCase):
       ('first_attempt', 1, 10, 0.0),
       ('second_attempt_below_midpoint', 2, 10, 0.5),
       ('just_below_midpoint', 4, 10, 0.5),
-      ('exactly_at_midpoint', 5, 10, 0.0),
+      ('exactly_at_midpoint', 5, 10, 0.75),
       ('just_above_midpoint', 6, 10, 0.75),
       ('final_attempt', 10, 10, 0.75),
       ('zero_attempts', 0, 10, 0.0),
```

---

### Incident Patch 2: `405584db` (2026-09-30)
**Commit Message**: Update pyproject.toml to require binaries (faster build of requirements.txt)

PiperOrigin-RevId: 990875438
Change-Id: I88315f716651382a1c482e741a9218567fb37eba

**File**: `pyproject.toml` (modified, +1/-0)
```diff
@@ -11,6 +11,7 @@ allow_unsafe = true
 generate_hashes = true
 reuse_hashes = true
 strip_extras = true
+pip-args = "--only-binary=:all:"
 
 [tool.pyink]
 line-length = 80
```

---

### Incident Patch 3: `222d3a44` (2026-09-28)
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

### Incident Patch 4: `eaea22ed` (2026-09-23)
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

### Incident Patch 5: `5d00d681` (2026-09-23)
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

### Incident Patch 6: `edcc568e` (2026-09-23)
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
+    max_calls = 37
+    model = _CountingModel()
+    wrapped = call_limit_wrapper.CallLimitLanguageModel(
+        model, max_calls=max_calls
+    )
+
+    def worker():
+      wrapped.sample_text('prompt')
+
+    threads = [threading.Thread(target=worker) for _ in range(num_threads)]
+    for t in threads:
+      t.start()
+    for t in threads:
+      t.join()
+
+    self.assertEqual(model.sample_text_calls, max_calls)
+    self.assertEqual(wrapped._calls, max_calls)  # pylint: disable=protected-access
+
+
+if __name__ == '__main__':
+  absltest.main()
```

---

### Incident Patch 7: `66091de2` (2026-09-23)
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
+          clock_now=datetime.datetime.now,
+      )
+
+    mock_memory = mock.MagicMock()
+    mock_observation = mock.MagicMock()
+    mock_observation.get_pre_act_value.return_value = (
+        'Alice paid Bob 5 coins.'
+    )
+
+    mock_entity = mock.MagicMock()
+
+    def get_component(name, type_=None):
+      del type_
+      if name == component._memory_component_name:
+        return mock_memory
+      if name == component._observations_component_name:
+        return mock_observation
+      return mock.MagicMock()
+
+    mock_entity.get_component.side_effect = get_component
+    component._entity = mock_entity
+
+    action_spec = entity_lib.ActionSpec(
+        call_to_action='test', output_type=entity_lib.OutputType.RESOLVE
+    )
+    self.assertEqual(component.pre_act(action_spec), '')
+
+
+class ScoreTest(absltest.TestCase):
+  """Tests for the Score component."""
+
+  def _make_score(self):
+    mock_inventory = mock.MagicMock()
+    mock_inventory.get_player_inventory.side_effect = lamb
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
+    self.assertEqual(locations._normalize_location('home'), 'Home')
+
+  def test_substring_match(self):
+    locations = self._make_locations(['Home', 'Work'])
+    self.assertEqual(locations._normalize_location('the Home base'), 'Home')
+
+  def test_unknown_location_normalizes_to_empty(self):
+    locations = self._make_locations(['Home', 'Work'])
+    self.assertEqual(locations._normalize_location('School'), '')
+
+  def test_trailing_period_is_stripped(self):
+    locations = self._make_locations(['Home', 'Work'])
+    self.assertEqual(locations._normalize_location('Home.'), 'Home')
+
+
+class LocationsStateTest(absltest.TestCase):
+  """Tests for the Locations component state handling."""
+
+  def test_initial_locations_default_to_empty(self):
+    locations = world_state.Locations(
+        model=mock_model.MockModel(''),
+        entity_names=['Alice', 'Bob'],
+        prompt='p',
+    )
+    self.assertEqual(locations._entity_locations, {'Alice': '', 'Bob': ''})
+
+  def test_initial_
```

---

### Incident Patch 8: `83659f2f` (2026-09-23)
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
+    memory.extend(['first', 'second'])
+
+    restored = basic_associative_memory.AssociativeMemoryBank(embedder)
+    restored.set_state(memory.get_state())
+
+    self.assertLen(restored, 2)
+    self.assertEqual(restored.get_all_memories_as_text(), ['first', 'second'])
+    self.assertEqual(restored.retrieve_recent(k=2), ['first', 'second'])
+    restored.add('first')
+    self.assertEqual(restored.get_all_memories_as_text(), ['first', 'second'])
+
+
+if __name__ == '__main__':
+  absltest.main()
```

---

### Incident Patch 9: `022b0bbc` (2026-09-23)
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

### Incident Patch 10: `0e536305` (2026-09-22)
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

### Incident Patch 11: `796d4890` (2026-09-03)
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
+  def test_broadcast_entity_info_caches_payload(self):
+    server = simulation_server.SimulationServer(port=0)
+    server.broadcast_entity_info(
+        {'entities': {'alice': {}}, 'game_masters': {}}
+    )
+    self.assertIsNotNone(server.cached_entity_info)
+    self.assertEqual(server.cached_entity_info['entities'], {'alice': {}})
+
+
+class HttpEndpointsTest(absltest.TestCase):
+
+  def setUp(self):
+    super().setUp()
+    self.server = simulation_server.SimulationServer(
+        port=0, html_content='<html>hi</html>'
+    )
+    self.server.start()
+    self.base_url = f'http://127.0.0.1:{self.server.bound_port}'
+
+  def tearDown(self):
+    self.server.stop()
+    super().tearDown()
+
+  def test_serves_configured_host(self):
+    self.assertEqual(self.server.host, '127.0.0.1')
+
+  def test_serves_html_at_root(self):
+    with urllib.request.urlopen(self.base_url + '/', timeout=5) as response:
+      self.assertEqual(response.status, 200)
+      self.assertEqual(response.read().decode('utf-8'), '<h
```

---

### Incident Patch 12: `48defea6` (2026-09-01)
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

---

### Incident Patch 13: `f2dcbb82` (2026-08-15)
**Commit Message**: fix: resolve pyrefly missing-attribute errors in world_state tests

Access the serialized action spec through get_state() instead of the protected _latest_action_spec attribute, which pyrefly infers as Optional and flags on .to_dict().

**File**: `concordia/components/game_master/world_state_test.py` (modified, +4/-3)
```diff
@@ -61,8 +61,9 @@ def test_pre_act_records_action_spec_and_returns_state(self):
         call_to_action='test', output_type=entity_lib.OutputType.RESOLVE
     )
     self.assertEqual(component.pre_act(action_spec), 'x: y\n')
-    self.assertEqual(component._latest_action_spec.to_dict(),
-                     action_spec.to_dict())
+    self.assertEqual(
+        component.get_state()['latest_action_spec'], action_spec.to_dict()
+    )
 
   def test_action_spec_round_trip(self):
     component = world_state.WorldState(model=self._model)
@@ -73,7 +74,7 @@ def test_action_spec_round_trip(self):
     restored = world_state.WorldState(model=self._model)
     restored.set_state(component.get_state())
     self.assertEqual(
-        restored._latest_action_spec.to_dict(), action_spec.to_dict()
+        restored.get_state()['latest_action_spec'], action_spec.to_dict()
     )
 
 
```

---

### Incident Patch 14: `7d0abb7a` (2026-08-15)
**Commit Message**: fix: initialize logging channel in game master components

WorldState, Locations, and GenerativeClock (world_state.py) as well as
Inventory and Score (inventory.py) call self._logging_channel() in
pre_act but never call super().__init__(), leaving _logging_channel
undefined. Using these components with a plain EntityAgent (which never
calls set_logging_channel) crashes with AttributeError.

Add the missing super().__init__() so ComponentWithLogging installs the
default NoOpLoggingChannel, matching terminate.py / make_observation.py /
constant.py.

Also add unit tests for world_state.py and inventory.py covering state
round-trips, pre_act, and the Locations._normalize_location helper.

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
+          clock_now=datetime.datetime.now,
+      )
+
+    mock_memory = mock.MagicMock()
+    mock_observation = mock.MagicMock()
+    mock_observation.get_pre_act_value.return_value = (
+        'Alice paid Bob 5 coins.'
+    )
+
+    mock_entity = mock.MagicMock()
+
+    def get_component(name, type_=None):
+      del type_
+      if name == component._memory_component_name:
+        return mock_memory
+      if name == component._observations_component_name:
+        return mock_observation
+      return mock.MagicMock()
+
+    mock_entity.get_component.side_effect = get_component
+    component._entity = mock_entity
+
+    action_spec = entity_lib.ActionSpec(
+        call_to_action='test', output_type=entity_lib.OutputType.RESOLVE
+    )
+    self.assertEqual(component.pre_act(action_spec), '')
+
+
+class ScoreTest(absltest.TestCase):
+  """Tests for the Score component."""
+
+  def _make_score(self):
+    mock_inventory = mock.MagicMock()
+    mock_inventory.get_player_inventory.side_effect = lamb
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

**File**: `concordia/components/game_master/world_state_test.py` (added, +172/-0)
```diff
@@ -0,0 +1,172 @@
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
+    self.assertEqual(component._latest_action_spec.to_dict(),
+                     action_spec.to_dict())
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
+        restored._latest_action_spec.to_dict(), action_spec.to_dict()
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
+    self.assertEqual(locations._normalize_location('home'), 'Home')
+
+  def test_substring_match(self):
+    locations = self._make_locations(['Home', 'Work'])
+    self.assertEqual(locations._normalize_location('the Home base'), 'Home')
+
+  def test_unknown_location_normalizes_to_empty(self):
+    locations = self._make_locations(['Home', 'Work'])
+    self.assertEqual(locations._normalize_location('School'), '')
+
+  def test_trailing_period_is_stripped(self):
+    locations = self._make_locations(['Home', 'Work'])
+    self.assertEqual(locations._normalize_location('Home.'), 'Home')
+
+
+class LocationsStateTest(absltest.TestCase):
+  """Tests for the Locations component state handling."""
+
+  def test_initial_locations_default_to_empty(self):
+    locations = world_state.Locations(
+        model=mock_model.MockModel(''),
+        entity_names=['Alice', 'Bob'],
+        prompt='p',
+    )
+    self.assertEqual(locations._entity_locations, {'Alice': '', 'Bob': ''})
+
+  def test_initial_lo
```

---

### Incident Patch 15: `67a9aef4` (2026-08-13)
**Commit Message**: Fix interrupt duration parsing

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

#### Recent Merged Pull Requests:
- **PR #385** (closed): Bump the github-actions group across 2 directories with 8 updates (@dependabot[bot])
- **PR #384** (closed): Bump the pip group across 1 directory with 7 updates (@dependabot[bot])
- **PR #383** (closed): Stop EntityAgent reusing stale pre-act values after a failed step (@codewithfourtix)
- **PR #379** (closed): Fix SimulationServer stop and immediate restart lifecycle (@concordia-claw)
- **PR #376** (closed): Keep control-flow exceptions out of task-error logs (@sylvesterkaczmarek)
- **PR #370** (closed): Show confirmed-action elapsed waiting in Bellwether (@concordia-claw)
- **PR #368** (closed): Coalesce attached SSE wakeups without building discarded snapshots (@concordia-claw)
- **PR #366** (closed): Distinguish stopped Bellwether runs from completed accounts (@concordia-claw)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
