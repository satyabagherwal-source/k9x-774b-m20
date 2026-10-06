# Forensic Learning Record (Deep Inspection): modelscope/evalscope

> **Canonical Artifact**: `07_PROJECT_LEARNING/modelscope-evalscope-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/modelscope/evalscope](https://github.com/modelscope/evalscope))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-06T05:15:31.519Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `modelscope/evalscope`
- **Description**: A streamlined and customizable framework for efficient large model (LLM, VLM, AIGC) evaluation and performance benchmarking.
- **Primary Language / Ecosystem**: Python
- **Discovered Manifests / Configurations**: pyproject.toml, README.md
- **Stars / Engagement**: 3503 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: pyproject.toml, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `evalscope/api/agent/loop.py`
```
"""AgentLoop: the model-agnostic orchestration core.

Takes a model + strategy + environment + tool executor and drives the
generate → parse → tool_call → observe loop.  It does NOT decide prompt
formats or termination semantics; those belong to :class:`AgentStrategy`.

Termination has a **single** signal: ``ParsedAction.final_answer`` set by
the strategy (in either ``parse_output`` or ``format_observation``).
The loop checks ``strategy.is_done(parsed, ctx)`` after each phase and
breaks when it returns True.  No exceptions are used for control flow.

The loop is async so it can naturally express parallel tool execution and
streaming generation in the future.  ``AgentAdapter._on_inference`` bridges
it into the synchronous evaluation pipeline through ``AsyncioLoopRunner``.
"""

import logging
import time
from typing import Any, List, Optional, Tuple

from evalscope.api.messages import ChatMessage, ChatMessageSystem, ChatMessageUser
from evalscope.api.model import Model, ModelOutput, ModelUsage
from evalscope.utils.logger import get_logger

from .constants import LoopMessages, MetadataKeys, SubmissionSources, ToolSchemaModes, TraceSources
from .environment import AgentEnvironment
from .strategy import AgentStrategy
from .tool_executor import ToolExecutor
from .trace import AgentTrace, EventType
from .types import AgentContext, AgentLoopResult, ParsedAction, ToolExecutionOutput, TurnOutcome

logger = get_logger()


class AgentLoop:
    """Generic multi-turn tool-use loop.

    Intended for use from ``AgentAdapter`` (or ``DefaultDataAdapter`` when a
    global ``agent_config`` is set).  The caller owns the lifecycle of the
    environment (create before ``run``, close after).
    """

    def __init__(
        self,
        model: Model,
        strategy: AgentStrategy,
        tool_executor: ToolExecutor,
        *,
        environment: Optional[AgentEnvironment] = None,
        max_steps: int = 10,
        trace: Optional[AgentTrace] = None,
    ) -> None:
        self.model = model
        self.strategy = strategy
        self.tool_executor = tool_executor
        self.environment = environment
        self.max_steps = max_steps
        self.trace = trace or AgentTrace(
            framework='native',
            strategy=getattr(strategy, 'name', None),
            environment=environment.name if environment else None,
            max_steps=max_steps,
        )

    # ------------------------------------------------------------------
    # Public entry point
    # ------------------------------------------------------------------

    async def run(self, ctx: AgentContext) -> AgentLoopResult:
        """Drive the loop until the strategy signals completion or ``max_steps``.

        The provided ``ctx.messages`` is mutated in place: each iteration
        appends the new assistant reply and any tool observations.  The
        returned ``AgentLoopResult.messages`` is a shallow copy so that
        post-run mutations on either side cannot pollute the other.
        """
        self._inject_system_prompt(ctx)

        final_output: Optional[ModelOutput] = None
        terminated_by_strategy = False

        while ctx.step < self.max_steps:
            # ---- generate ----
            output, latency_ms = await self._generate(ctx)
            final_output = output
            assistant_msg = self._snapshot_assistant_message(output)
            ctx.messages.append(assistant_msg)
            self._emit_generate(ctx, assistant_msg, output, latency_ms)

            # ---- terminate on model context overflow ----
            # Provider layer (openai_handle_bad_request / anthropic_handle_bad_request)
            # converts BadRequestError → stop_reason='model_length' instead of raising;
            # we surface that here as a graceful loop end so the rest of the
            # evaluation continues. Compaction / message-trimming recovery
            # (cf. inspect_ai's _handle_overflow) is intentionally out of scope.
            if output.stop_reason == 'model_length':
                self._emit_context_overflow(ctx)
                terminated_by_strategy = True
                break

            # ---- parse ----
            parsed = self.strategy.parse_output(output, ctx)
            if parsed.error:
                self._emit_parse_error(ctx, assistant_msg, parsed)

            # ---- terminate from parse? ----
            if self.strategy.is_done(parsed, ctx):
                self._emit_submit(ctx, assistant_msg, parsed)
                terminated_by_strategy = True
                break

            # ---- no tool calls but not done → nudge or implicit submit ----
            if parsed.outcome is not TurnOutcome.ACT:
                if self._try_nudge(parsed, ctx):
                    continue
                self._emit_implicit_submit(ctx, parsed)
                terminated_by_strategy = True
                break

            # ---- tool execution (may set parsed.final_answer post-hoc) ----
            # An ACT turn ends both no-tool streaks, so the budgets bound
            # consecutive silent/malformed turns rather than the whole episode.
            # Without the reset a single stray text-only turn late in a long
            # task would exhaust the budget and end the episode.
            ctx.nudge_count = 0
            ctx.parse_error_nudge_count = 0
            if await self._run_tools(parsed, ctx, assistant_msg):
                terminated_by_strategy = True
                break

            ctx.step += 1

        if not terminated_by_strategy:
            self._emit_max_steps_exceeded(ctx)

        if final_output is None:
            raise RuntimeError('AgentLoop.run ended without any generate() call')

        return AgentLoopResult(
            messages=list(ctx.messages),
            final_output=final_output,
            trace=self.trace,
        )

    # ------------------------------------------------------------------
    # Stage methods
    # ------------------------------------------------------------------

    def _inject_system_prompt(self, ctx: AgentContext) -> None:
        """Insert the strategy's system prompt at index 0 if absent."""
        system_prompt = self.strategy.build_system_prompt(ctx)
        if system_prompt and not any(m.role == 'system' for m in ctx.messages):
            ctx.messages.insert(0, ChatMessageSystem(content=system_prompt))

    async def _generate(self, ctx: AgentContext) -> Tuple[ModelOutput, float]:
        """Run one ``model.generate_async`` round and return (output, latency_ms)."""
        generate_messages = self.strategy.prepare_messages(ctx)
        mode = self.strategy.tool_schema_mode()
        tools = self.strategy.tools(ctx) if mode == ToolSchemaModes.FUNCTION_CALLING else []

        self._dbg(
            ctx,
            f'{ctx.step}/{self.max_steps} '
            f'strategy={getattr(self.strategy, "name", "?")} mode={mode} '
            f'tools=[{", ".join(t.name for t in tools)}] '
            f'messages_count={len(generate_messages)}',
        )

        started = time.monotonic()
        output = await self.model.generate_async(input=generate_messages, tools=tools or None)
        latency_ms = (time.monotonic() - started) * 1000
        ctx.last_output = output
        return output, latency_ms

    def _snapshot_assistant_message(self, output: ModelOutput) -> ChatMessage:
        """Deep-copy the assistant message before appending to ``ctx.messages``.

        Without this, ``DefaultDataAdapter._extract_final_answer`` would later
        overwrite the persisted reasoning text by mutating the same
        ``output.message`` object that lives in ``ctx.messages``.
        """
        return output.message.model_copy(deep=True)

    def _try_nudge(self, parsed: ParsedAction, ctx: AgentContext) -> bool:
        """Inject a 'please call a tool' reminder if the strategy allows it.

        Returns True when a nudge was injected (caller should ``continue``);
        False when the strategy declined and the caller should treat the
        current output as an implicit final answer.
        """
        should_nudge = self.strategy.should_nudge(parsed, ctx)
        malformed = parsed.outcome is TurnOutcome.MALFORMED
        self._dbg(ctx, f'outcome={parsed.outcome.value}, should_nudge={should_nudge}')
        if not should_nudge:
            return False

        # Prefer the strategy's own reminder so the model gets feedback that
        # matches what it actually did wrong (e.g. a parse error, or a bash /
        # fenced-block protocol) instead of the generic "call the submit tool"
        # text, which misleads when the strategy exposes no submit tool.
        reminder = self.strategy.nudge_message(parsed, ctx)
        nudge = ChatMessageUser(content=reminder)
        ctx.messages.append(nudge)
        if malformed:
            ctx.parse_error_nudge_count += 1
        else:
            ctx.nudge_count += 1
        self.trace.add_event(
            step=ctx.step,
            type=EventType.NUDGE,
            message_id=nudge.id,
            payload={
                'source': TraceSources.NUDGE,
                'message': (LoopMessages.PARSE_ERROR_REMINDER if malformed else LoopMessages.NO_TOOL_CALL_REMINDER),
                'outcome': parsed.outcome.value,
            },
        )
        ctx.step += 1
        return True

    async def _run_tools(
        self,
        parsed: ParsedAction,
        ctx: AgentContext,
        assistant_msg: ChatMessage,
    ) -> bool:
        """Execute every tool call in ``parsed.tool_calls`` sequentially.

        Returns True when ``strategy.is_done`` becomes True after a tool
        observation (post-tool termination), signalling the outer loop to
        break without re-checking ``is_done``.
        """
        self._dbg(
            ctx,
            f'executing {len(parsed.tool_calls)} tool call(s): {[c.function.name for c in parsed.tool_calls]}',
        )
        attachment_messages = []
        for call in
```

### Core Architecture Module: `evalscope/api/dataset/utils.py`
```
import json
from typing import Any, Callable, Dict, Iterable, List, Optional, Union, cast

from tqdm import tqdm

from .dataset import Dataset, FieldSpec, Sample


def record_to_sample_fn(
    sample_fields: Union[FieldSpec, Callable, None] = None,
) -> Callable:
    if sample_fields is None:
        sample_fields = FieldSpec()

    if isinstance(sample_fields, FieldSpec):

        def record_to_sample(record: dict) -> Sample:
            # collect metadata if specified
            metadata: Optional[Dict[str, Any]] = None
            if sample_fields.metadata:
                if isinstance(sample_fields.metadata, list):
                    metadata = {}
                    for name in sample_fields.metadata:
                        metadata[name] = record.get(name)

            elif 'metadata' in record:
                metadata_field = record.get('metadata')
                if isinstance(metadata_field, str):
                    metadata = json.loads(metadata_field)
                elif isinstance(metadata_field, dict):
                    metadata = metadata_field
                else:
                    raise ValueError(f"Unexpected type for 'metadata' field: {type(metadata_field)}")

            # return sample
            return Sample(
                input=read_input(record.get(sample_fields.input)),
                target=read_target(record.get(sample_fields.target)),
                choices=read_choices(record.get(sample_fields.choices)),
                id=record.get(sample_fields.id, None),
                metadata=metadata,
                sandbox=read_sandbox(record.get(sample_fields.sandbox)),
                files=read_files(record.get(sample_fields.files)),
                setup=read_setup(record.get(sample_fields.setup)),
            )

        return record_to_sample

    else:
        return sample_fields


def data_to_samples(data: Iterable[dict], data_to_sample: Callable) -> List[Sample]:
    samples: List[Sample] = []
    for record in tqdm(data, desc='Processing records'):
        record_samples = as_sample_list(data_to_sample(record=record))
        samples.extend(record_samples)
    return samples


def as_sample_list(samples: Union[Sample, List[Sample]]) -> List[Sample]:
    if isinstance(samples, list):
        return samples
    else:
        return [samples]


def read_input(input_val: Optional[Any]) -> str:
    if not input_val:
        raise ValueError('No input in dataset')
    return str(input_val)


def read_target(obj: Optional[Any]) -> Union[str, List[str]]:
    if obj is not None:
        return [str(item) for item in obj] if isinstance(obj, list) else str(obj)
    else:
        return ''


def read_choices(obj: Optional[Any]) -> Optional[List[str]]:
    if obj is not None:
        if isinstance(obj, list):
            return [str(choice) for choice in obj]
        elif isinstance(obj, str):
            choices = obj.split(',')
            if len(choices) == 1:
                choices = obj.split()
            return [choice.strip() for choice in choices]
        else:
            return [str(obj)]
    else:
        return None


def read_setup(setup: Optional[Any]) -> Optional[str]:
    if setup is not None:
        return str(setup)
    else:
        return None


def read_sandbox(sandbox: Optional[Any]) -> Optional[str]:
    if sandbox is not None:
        if isinstance(sandbox, str):
            return sandbox
        elif isinstance(sandbox, dict):
            return json.dumps(sandbox)
        else:
            raise ValueError(f"Unexpected type for 'sandbox' field: {type(sandbox)}")
    else:
        return None


def read_files(files: Optional[Any]) -> Optional[Dict[str, str]]:
    if files is not None:
        if isinstance(files, str):
            files = json.loads(files)
        if isinstance(files, dict):
            if all(isinstance(v, str) for v in files.values()):
                return cast(Dict[str, str], files)

        # didn't find the right type
        raise ValueError(f"Unexpected type for 'files' field: {type(files)}")
    else:
        return None


def shuffle_choices_if_requested(
    dataset: Dataset,
    shuffle_choices: Optional[Union[bool, int]],
    seed: Optional[int] = None,
) -> None:
    """
    Shuffle the choices in the dataset if requested.

    The `shuffle_choices` parameter passed to `json_dataset`, `csv_dataset`,
    and `hf_dataset` can be a boolean, an integer, or `None` (default).
    If it is a boolean, it will shuffle the choices if the value is `True`,
    and do nothing if it is `False`.
    If it is an integer, it will shuffle the choices using the integer as the seed.

    Args:
        dataset: Dataset whose choices may be shuffled.
        shuffle_choices: Whether to shuffle, or an explicit choice-shuffle seed.
        seed: Run seed used when ``shuffle_choices`` is ``True``.
    """
    # Note that `isinstance(x, int)` returns True if x is True or False,
    # so we need to check for both explicitly
    if shuffle_choices is True:
        dataset.shuffle_choices(seed=seed)
    elif shuffle_choices is False:
        pass
    elif isinstance(shuffle_choices, int):
        dataset.shuffle_choices(seed=shuffle_choices)

```

### Core Architecture Module: `evalscope/api/evaluator/state.py`
```
from dataclasses import dataclass
from random import Random
from typing import Any, Dict, List, Optional, Sequence, Union, overload

from evalscope.api.agent import AgentTrace
from evalscope.api.dataset import Sample
from evalscope.api.messages import ChatMessage, ChatMessageUser, messages_pretty_str, messages_to_markdown
from evalscope.api.model import ModelOutput


class Target(Sequence[str]):
    """Normalized set of accepted answers for a sample."""

    def __init__(self, target: Union[str, List[str]]) -> None:
        raw_values = [target] if isinstance(target, str) else target
        self._values = tuple(dict.fromkeys(value.strip() for value in raw_values if value.strip()))

    @overload
    def __getitem__(self, index: int) -> str: ...

    @overload
    def __getitem__(self, index: slice) -> Sequence[str]: ...

    def __getitem__(self, index: Union[int, slice]) -> Union[str, Sequence[str]]:
        return self._values[index]

    def __len__(self) -> int:
        return len(self._values)

    @property
    def values(self) -> tuple[str, ...]:
        """Accepted answers in stable order."""
        return self._values

    def single(self) -> str:
        """Return the only accepted answer."""
        if len(self) != 1:
            raise ValueError(f'Metric requires one reference answer, received {len(self)}.')
        return self._values[0]

    @property
    def display(self) -> str:
        """Render all accepted answers for text-only consumers."""
        return '\n'.join(self._values)

    @property
    def text(self) -> str:
        """Legacy text representation of the target."""
        return self.display

    def compact(self) -> str:
        """Concatenate answer labels for multiple-choice scoring."""
        return ''.join(self._values)


@dataclass
class Choice:
    """
    A `Choice` represents a single choice in a multiple choice question.

    It is only relevant for the `multiple_choice` solver and corresponding
    `choice` scorer.
    """

    value: str
    """The original value of the choice from the `Sample`."""

    correct: Optional[bool]
    """Did the model think this choice satisfies the question? `None`
    indicates this has not been set yet"""

    original_position: int
    """Choices may be re-ordered during processing, this represents the
    original position in the sample's list of choices"""


class Choices(Sequence[Choice]):
    """
    Wrapper class for a list of `Choice` objects.

    Primarily simply to abstract away implementations of choice-specific
    functionality from the already-big `TaskState` class.
    """

    def __init__(self, choices: Union[List[str], List[Choice]]) -> None:
        """
        Setter for choices, intended to only be used with the `multiple_choice` scorer.

        Choices come from a list of choices for the sample, specifically used by
        the `multiple_choice` scorer.

        For example, if the sample was a multiple choice question like "What is
        the capital of France? A) Paris B) London C) Berlin", we would store the
        possible answers here.
        """
        self._choices: List[Choice] = []

        for i, choice in enumerate(choices):
            if isinstance(choice, str):
                self._choices.append(Choice(value=choice, correct=None, original_position=i))
            elif isinstance(choice, Choice):
                self._choices.append(choice)

    @overload
    def __getitem__(self, index: int) -> Choice: ...

    @overload
    def __getitem__(self, index: slice) -> Sequence[Choice]: ...

    def __getitem__(self, index: Union[int, slice]) -> Union[Choice, Sequence[Choice]]:
        return self._choices[index]

    def __len__(self) -> int:
        return len(self._choices)

    def mark_choice(self, index: int, correct: bool) -> None:
        """Set the value of a specific choice"""
        self._choices[index].correct = correct

    def shuffle(self, rand: Random = Random()) -> None:
        """
        Shuffle the choice order, setting the `original_position` so they can be mapped back to their original order.

        Some evals will shuffle the choices from the original sample to try to
        avoid the model answering correctly due to fine-tuning (or similar) on
        specific datasets.
        """
        shuffled_positions = list(range(len(self._choices)))
        rand.shuffle(shuffled_positions)

        shuffled_choices = [Choice('notachoice', None, -1)] * len(self._choices)

        for i, shuffled_position in enumerate(shuffled_positions):
            shuffled_choices[i] = self._choices[shuffled_position]
            shuffled_choices[i].original_position = shuffled_position

        self._choices = shuffled_choices


class TaskState:
    """
    The `TaskState` represents the internal state of the `Task` being run for a single `Sample`.

    The `TaskState` is passed to and returned from each solver during a sample's
    evaluation. It allows us to maintain the manipulated message history, the tools
    available to the model, the final output of the model, and whether the task
    is completed or has hit a limit.
    """

    def __init__(
        self,
        model: str,
        sample: Sample,
        messages: Optional[List[ChatMessage]] = None,
        output: Optional[ModelOutput] = None,
        completed: bool = False,
    ) -> None:
        self._model = model
        self._sample = sample
        self._sample_id = sample.id
        self._group_id = sample.group_id
        self._input = sample.input
        self._target = Target(sample.target)
        self._metadata = sample.metadata
        self._messages: List[ChatMessage] = messages if messages is not None else []
        self._output = output if output else ModelOutput(model=str(model))
        self._completed = completed
        self._agent_trace: Optional[AgentTrace] = None
        if sample.choices:
            self._choices = Choices(sample.choices)
        else:
            self._choices = Choices([])

    @property
    def model(self) -> str:
        """Name of model being evaluated."""
        return self._model

    @property
    def sample_id(self) -> int:
        """Unique id for sample."""
        return self._sample_id

    @property
    def group_id(self) -> int:
        """Group id for sample."""
        return self._group_id

    @property
    def input(self) -> Union[str, List[ChatMessage]]:
        """Input from the `Sample`, should be considered immutable."""
        return self._input

    @property
    def input_text(self) -> str:
        """
        Convenience function for accessing the initial input from the `Sample` as a string.

        If the `input` is a `List[ChatMessage]`, this will return the text from
        the last chat message
        """
        if isinstance(self._input, str):
            return self._input
        else:
            return messages_pretty_str(self._input)

    @property
    def input_markdown(self) -> str:
        """Get the input text as markdown.

        For multi-modal content, images will be represented in markdown format.
        """
        if isinstance(self._input, str):
            return self._input
        else:
            return messages_to_markdown(self._input)

    @property
    def choices(self) -> Choices:
        """Choices for the sample, if applicable."""
        return self._choices

    @property
    def user_prompt(self) -> ChatMessageUser:
        """User prompt for this state.

        Tasks are very general and can have may types of inputs.
        However, in many cases solvers assume they can interact with
        the state as a "chat" in a predictable fashion (e.g. prompt
        engineering solvers). This property enables easy read and
        write access to the user chat prompt. Raises an
        exception if there is no user prompt
        """
        prompt = next((m for m in reversed(self.messages) if m.role == 'user'), None)
        if prompt:
            return prompt
        else:
            raise ValueError('user_prompt requested from TaskState but none available')

    @property
    def metadata(self) -> Dict[str, Any]:
        """Metadata from the `Sample` for this `TaskState`"""
        return self._metadata

    @metadata.setter
    def metadata(self, metadata: Dict[str, Any]) -> None:
        self._metadata = metadata

    @property
    def messages(self) -> List[ChatMessage]:
        """
        Chat conversation history for sample.

        This will generally get appended to every time a `generate` call is made
        to the model. Useful for both debug and for solvers/scorers to assess
        model performance or choose the next step.
        """
        return self._messages

    @messages.setter
    def messages(self, messages: List[ChatMessage]) -> None:
        self._messages = messages

    @property
    def messages_markdown(self) -> str:
        """Get the messages as markdown.

        For multi-modal content, images will be represented in markdown format.
        """
        return messages_to_markdown(self._messages)

    @property
    def output(self) -> ModelOutput:
        """
        The 'final' model output once we've completed all solving.

        For simple evals this may just be the last `message` from the
        conversation history, but more complex solvers may set this directly.
        """
        return self._output

    @output.setter
    def output(self, output: ModelOutput) -> None:
        self._output = output

    @property
    def completed(self) -> bool:
        """Is the task completed."""
        return self._completed

    @completed.setter
    def completed(self, completed: bool) -> None:
        """Set the completed status."""
        self._completed = completed

    @property
    def target_reference(self) -> Target:
        """Canonical accepted-answer set for scoring."""
        return self._target

    @property
    def target(self) -> str:
        """Text rendering of
```

### Core Architecture Module: `evalscope/api/messages/utils.py`
```
import re
from typing import Optional

from .content import ContentReasoning


def parse_content_with_reasoning(content: str) -> tuple[str, Optional[ContentReasoning]]:
    """
    Looks for and extracts <think/> tags into reasoning text.

    Returns a tuple:
    - The first element is the input content with the <think> tag and its contents fully removed.
    - The second element is a ContentReasoning object (or None if no <think> tag is found).
    """
    # Match <think> tag with optional attributes anywhere in the string
    pattern = r'<think(?:\s+signature="([^"]*)")?(?:\s+redacted="(true)")?\s*>(.*?)</think>'
    match = re.search(pattern, content, re.DOTALL)

    if match:
        signature = match.group(1)  # This will be None if not present
        redacted_value = match.group(2)  # This will be "true" or None
        reasoning = match.group(3).strip()
        # Remove the matched <think>...</think> from the input
        start, end = match.span()

        return (
            (content[:start] + content[end:]).strip(),
            ContentReasoning(
                reasoning=reasoning,
                signature=signature,
                redacted=redacted_value == 'true',
            ),
        )
    else:
        return content, None

```

### Core Architecture Module: `evalscope/api/metric/scorer.py`
```
import warnings
from typing import Any, Callable, Dict, List, Optional, Union

from pydantic import AliasChoices, BaseModel, ConfigDict, Field, model_validator

from evalscope.api.metric.semantics import MetricIdentity
from evalscope.constants import ScoreStatus

Value = Dict[str, Union[int, float, bool]]


class JudgeSummary(BaseModel):
    """First-class summary of a judge session, for reports and offline inspection."""

    status: ScoreStatus = Field(default=ScoreStatus.SUCCESS)
    """Whether scoring completed, degraded, or was unavailable."""

    scored: int = Field(default=0)
    """Samples with a usable score in this summary's scope (one for a sample summary)."""

    total: int = Field(default=1)
    """Samples considered in this summary's scope."""

    coverage: float = Field(default=0.0)
    """``scored / total``; unavailable samples are reported as zero coverage, not score zero."""

    judge_models: List[str] = Field(default_factory=list)
    """Judge model ids that produced this score."""

    valid_observations: int = Field(default=0)
    """Observations that yielded a usable verdict."""

    total_observations: int = Field(default=0)
    """Observations attempted, including invalid ones."""

    failures: Dict[str, int] = Field(default_factory=dict)
    """Failure counts keyed by :class:`ScoreStatus` value."""

    disagreement: Dict[str, Any] = Field(default_factory=dict)
    """Typed disagreement statistics; distinct from execution degradation."""

    error: Optional[str] = Field(default=None)
    """Human-readable reason the score is unavailable, if any."""


class Score(BaseModel):
    """Score generated by a scorer."""

    value: Value = Field(default_factory=dict)
    """Score value as a dictionary. Key is the score name, value is the score value.
    The first key is considered the main score by default."""

    status: ScoreStatus = Field(default=ScoreStatus.SUCCESS)
    """Whether this score is usable. A non-usable status means the affected metric keys are
    omitted from :attr:`value` and the sample drops out of aggregation instead of scoring 0."""

    judge_summary: Optional[JudgeSummary] = Field(
        default=None,
        validation_alias=AliasChoices('judge_summary', 'judge_detail'),
    )
    """Judge execution summary, populated only when an LLM judge produced this score."""

    extracted_prediction: Optional[str] = Field(default=None)
    """Answer extracted from model output (optional)"""

    prediction: Optional[str] = Field(default=None)
    """Original prediction text from the model (optional)"""

    explanation: Optional[str] = Field(default=None)
    """Explanation of score (optional)."""

    metadata: Optional[Dict[str, Any]] = Field(default_factory=dict)
    """Additional metadata related to the score"""

    main_score_name: Optional[str] = Field(default=None)
    """Raw per-sample score name used by :attr:`main_value` in a multi-score result.

    This selects a value inside one ``Score`` only. ``BenchmarkMeta.primary_metric`` is the
    report-level declaration; this field does not assign report metric roles.
    """

    @property
    def judge_detail(self) -> Optional[JudgeSummary]:
        """Deprecated Python compatibility alias for :attr:`judge_summary`."""
        return self.judge_summary

    @judge_detail.setter
    def judge_detail(self, value: Optional[JudgeSummary]) -> None:
        self.judge_summary = value

    @property
    def main_value(self) -> Union[int, float, bool]:
        """Main score value."""
        if self.main_score_name and self.main_score_name in self.value:
            return self.value[self.main_score_name]
        elif self.value:
            # If main_score_name is not set or not found, use the first value and update main_score_name
            first_key = next(iter(self.value))
            self.main_score_name = first_key
            return self.value[first_key]
        return None

    @main_value.setter
    def main_value(self, value: Union[int, float, bool]):
        """Set the main score value."""
        if self.main_score_name:
            # If main_score_name is already set, use it
            self.value[self.main_score_name] = value
        elif self.value:
            # If no main_score_name but value dict exists, use the first key
            first_key = next(iter(self.value))
            self.main_score_name = first_key
            self.value[first_key] = value
        else:
            # If neither main_score_name nor value dict exists, initialize both
            self.main_score_name = 'default'
            self.value[self.main_score_name] = value


class SampleScore(BaseModel):
    """Score for a Sample."""

    score: Score
    """A score"""

    sample_id: Optional[Union[str, int]] = Field(default=None)
    """A sample id"""

    group_id: Optional[Union[str, int]] = Field(default=None)
    """A group id for the sample, used for grouping k repeated samples."""

    generation_index: Optional[int] = Field(default=None)
    """Planned zero-based generation position inside ``group_id``; never compact missing attempts."""

    sample_metadata: Optional[Dict[str, Any]] = Field(default=None)
    """Metadata from the sample"""


class AggScore(BaseModel):
    """Output of an aggregation operation."""

    model_config = ConfigDict(populate_by_name=True, extra='forbid')

    score: float = Field(default=0.0)
    """Aggregated value as a float."""

    metric_name: str = Field(default='')
    """Name of the metric being aggregated."""

    aggregation: str = Field(default='identity', validation_alias=AliasChoices('aggregation', 'aggregation_name'))
    """Canonical name of the aggregation method. It is not part of ``metric_name``."""

    dimensions: Dict[str, Union[str, int, float, bool]] = Field(default_factory=dict)
    """Structured axes such as scope, threshold, level, target, or k."""

    num: int = Field(default=0)
    """Number of samples used in the aggregation."""

    ids: Optional[List[Union[str, int]]] = Field(default=None)
    """List of sample IDs used in the aggregation, if applicable."""

    metadata: Optional[Dict[str, Any]] = Field(default=None)
    """Additional metadata related to the aggregation."""

    @property
    def identity(self) -> MetricIdentity:
        """Return the canonical structured identity represented by this aggregate."""
        return MetricIdentity(name=self.metric_name, aggregation=self.aggregation, dimensions=self.dimensions)

    @property
    def aggregation_name(self) -> str:
        """Deprecated compatibility alias for :attr:`aggregation`."""
        warnings.warn('AggScore.aggregation_name is deprecated; use aggregation.', DeprecationWarning, stacklevel=2)
        return self.aggregation

    @model_validator(mode='before')
    @classmethod
    def _warn_deprecated_aggregation_name(cls, data: Any) -> Any:
        if isinstance(data, dict) and 'aggregation_name' in data and 'aggregation' not in data:
            warnings.warn('AggScore.aggregation_name is deprecated; use aggregation.', DeprecationWarning, stacklevel=3)
        return data

    @model_validator(mode='after')
    def _canonicalize_identity_fields(self) -> 'AggScore':
        """Normalize producer syntax without assigning legacy semantics."""
        from evalscope.metrics.semantics.naming import canonicalize_producer_identity

        identity = canonicalize_producer_identity(self.metric_name, self.aggregation, self.dimensions)
        self.metric_name = identity.name
        self.aggregation = identity.aggregation
        self.dimensions = identity.dimensions
        return self


class Aggregator:
    name = 'default'

    def __call__(self, scores: List[SampleScore]) -> List[AggScore]:
        r"""Aggregate a metric on a list of scores.

        Args:
          scores: List of scores.

        Returns:
          List[AggregatOutput]: List of aggregated outputs.
        """
        ...

```

### Core Architecture Module: `evalscope/api/sandbox/engine.py`
```
"""Sandbox engine resolution.

Maps user-facing engine names (docker / volcengine / aliases) to the
concrete ms_enclave ``SandboxType``, ``SandboxConfig`` subclass and the
``SandboxManager`` class to instantiate.

This module is intentionally import-light: ms_enclave types are imported
lazily inside the helpers so that ``evalscope`` can be imported without the
sandbox extra.
"""

from __future__ import annotations

from enum import Enum
from typing import Any, Optional, Tuple, Type, Union


class SandboxEngine(str, Enum):
    """Supported sandbox engines."""

    DOCKER = 'docker'
    VOLCENGINE = 'volcengine'


_ALIASES = {
    'docker': SandboxEngine.DOCKER,
    'volcengine': SandboxEngine.VOLCENGINE,
    'volcano': SandboxEngine.VOLCENGINE,
    'volc': SandboxEngine.VOLCENGINE,
}


def resolve_engine(value: Union[str, SandboxEngine, None]) -> SandboxEngine:
    """Normalise ``value`` into :class:`SandboxEngine`.

    Raises ``ValueError`` if the value cannot be resolved.  ``None`` defaults
    to :attr:`SandboxEngine.DOCKER` because it mirrors the historical
    ``TaskConfig.sandbox_type`` default.
    """
    if value is None:
        return SandboxEngine.DOCKER
    if isinstance(value, SandboxEngine):
        return value
    key = str(value).strip().lower()
    if key in _ALIASES:
        return _ALIASES[key]
    raise ValueError(f'Unknown sandbox engine: {value!r}. Supported: {sorted(set(_ALIASES))}')


def get_enclave_types(
    engine: SandboxEngine,
) -> Tuple[Any, Type[Any], Optional[Type[Any]], Optional[Type[Any]]]:
    """Return ``(SandboxType, SandboxConfigCls, ManagerCls, ManagerConfigCls)``.

    - ``ManagerCls`` is ``None`` when the default ``SandboxManagerFactory``
      should be used (docker case).
    - ``ManagerConfigCls`` is ``None`` when the manager takes raw ``**kwargs``.
    """
    if engine is SandboxEngine.DOCKER:
        from ms_enclave.sandbox.model import DockerSandboxConfig, SandboxType

        return SandboxType.DOCKER, DockerSandboxConfig, None, None

    if engine is SandboxEngine.VOLCENGINE:
        from ms_enclave.sandbox.manager import VolcengineSandboxManager
        from ms_enclave.sandbox.model import SandboxType, VolcengineSandboxConfig, VolcengineSandboxManagerConfig

        return (
            SandboxType.VOLCENGINE,
            VolcengineSandboxConfig,
            VolcengineSandboxManager,
            VolcengineSandboxManagerConfig,
        )

    raise ValueError(f'Unsupported sandbox engine: {engine!r}')


__all__ = ['SandboxEngine', 'resolve_engine', 'get_enclave_types']

```

### Core Architecture Module: `evalscope/api/tool/utils.py`
```
import json
from typing import Any, Dict, List, Optional

import yaml
from jsonschema import SchemaError, ValidationError, validate

from evalscope.utils import get_logger

from .tool_call import ToolCall, ToolFunction
from .tool_info import ToolInfo

logger = get_logger()


def parse_tool_call(id: str, function: str, arguments: str, tools: Optional[List[ToolInfo]] = None) -> ToolCall:
    """Parse a tool call from a JSON payload.

    Note that this function doesn't know about internal tool names so the caller
    should amend the returned `ToolCall` by mapping the parsed `function` field from
    an internal name to a tool name and fixing up the `ToolCall` object
    as required to reflect this change.
    """
    error: Optional[str] = None
    arguments_dict: Dict[str, Any] = {}

    def report_parse_error(ex: Exception) -> None:
        nonlocal error
        error = tool_parse_error_message(arguments, ex)
        logger.info(error)

    # if the arguments is a dict, then handle it with a plain json.loads
    arguments = arguments.strip()
    if arguments.startswith('{'):
        try:
            arguments_dict = json.loads(arguments)
        except json.JSONDecodeError as ex:
            report_parse_error(ex)

    # otherwise parse it as yaml (which will pickup unquoted strings, numbers, and true/false)
    # and then create a dict that maps it to the first function argument
    elif function and tools:
        tool_info = next(
            (tool for tool in tools if tool.name == function and len(tool.parameters.properties) > 0),
            None,
        )
        if tool_info:
            param_names = list(tool_info.parameters.properties.keys())
            try:
                value = yaml.safe_load(arguments)
                arguments_dict[param_names[0]] = value
            except yaml.error.YAMLError:
                # If the yaml parser fails, we treat it as a string argument.
                arguments_dict[param_names[0]] = arguments

    # return ToolCall with error payload
    return ToolCall(
        id=id,
        function=ToolFunction(
            name=function,
            arguments=arguments_dict,
        ),
        parse_error=error,
    )


def tool_parse_error_message(arguments: str, ex: Exception) -> str:
    return f'Error parsing the following tool call arguments:\n\n{arguments}\n\nError details: {ex}'


def validate_tool_arguments(call: ToolCall, tool: ToolInfo) -> Optional[str]:
    """Check ``call.function.arguments`` against the schema advertised in ``tool``.

    Returns ``None`` when the arguments satisfy ``tool.parameters``, otherwise a
    short description of the first violation, for example
    ``"'query' is a required property"`` or
    ``"'abc' is not of type 'integer' (at 'limit')"``.

    The schema is ``tool.parameters.model_dump(exclude_none=True)``: exactly
    the JSON Schema the model was shown, so a call is judged against the
    contract it was given rather than against a handler's private
    expectations. A schema jsonschema cannot compile is treated as
    unconstrained, so a broken declaration never blocks a well-formed call.
    """
    schema = tool.parameters.model_dump(exclude_none=True)
    try:
        validate(instance=call.function.arguments, schema=schema)
    except ValidationError as exc:
        path = '/'.join(str(part) for part in exc.absolute_path)
        return f'{exc.message} (at {path!r})' if path else exc.message
    except SchemaError as exc:
        logger.debug(f'validate_tool_arguments: schema of tool {tool.name!r} is invalid, skipping: {exc.message}')
        return None
    return None

```

### Core Architecture Module: `evalscope/backend/rag_eval/clip_benchmark/utils/webdataset_convert.py`
```
# Convert datasets to webdataset format
import os

import torch
import torch.utils.data
import webdataset
from tqdm import tqdm

from evalscope.backend.rag_eval.clip_benchmark.dataset_builder import DatasetWrapper
from evalscope.backend.rag_eval.utils.tools import PIL_to_bytes, path_to_bytes
from evalscope.utils.logger import get_logger

logger = get_logger()


def convert_dataset(
    dataset,
    split,
    output_folder,
    *,
    transform=None,
    image_format='webp',
    max_count=10_000,
    max_size=1_000_000_000,
    multilabel=False,
    verbose=True,
):
    """
    Convert an iterable `dataset` of (image, label) pairs to webdataset (.tar) format, and store in
       `output_folder/split`.

    Images may be passed in as either:
    * File paths: pass in `transform=path_to_bytes`;
    * PIL images: pass in `transform=PIL_to_bytes(image_format)` where `image_format` is e.g. "webp"; or
    * Raw binary data: use a PyTorch `Dataset` that supports `transform=PIL_to_bytes(image_format)`, and
        pass in `transform=None` here.
        Be sure that the transform is not applied twice.

    Copying image files directly or writing raw binary data is fastest since it allows multiprocessing;
    passing in PIL images will be slower, but should work for any format of dataset.

    Labels must be zero-indexed integers (for multilabel datasets, labels must be arrays/tensors).

    Classnames and zero-shot classification templates can be provided as attributes of the dataset (`.classes`
    and `.templates`) or filled in manually afterward. `dataset.classes` should be a list of strings indexed by
    the labels, and `dataset.templates` should be a list of strings containing `{c}` to specify where classnames
    are to be inserted.
    """
    # Create output directory
    os.makedirs(os.path.join(output_folder, split), exist_ok=True)
    # Multiprocessed dataloader, should work with Dataset or list
    dataloader = torch.utils.data.DataLoader(
        dataset,
        batch_size=1,
        num_workers=8,
        collate_fn=lambda batch: batch[0],  # No collate, only for multiprocessing
    )
    if verbose:
        try:
            logger.info(f'Dataset size: {len(dataset)}')
        except TypeError:
            logger.info('IterableDataset has no len()')
    # Save classnames
    if hasattr(dataset, 'classes') and dataset.classes:
        classnames_fname = os.path.join(output_folder, 'classnames.txt')
        with open(classnames_fname, 'w') as classnames_file:
            classnames_file.write('\n'.join(str(class_name) for class_name in dataset.classes) + '\n')
        if verbose:
            logger.info("Saved class names to '%s'" % classnames_fname)
    elif verbose:
        logger.info('WARNING: No class names found')
    # Save zeroshot templates
    if hasattr(dataset, 'templates') and dataset.templates:
        templates_fname = os.path.join(output_folder, 'zeroshot_classification_templates.txt')
        with open(templates_fname, 'w') as templates_file:
            templates_file.write('\n'.join(str(template) for template in dataset.templates) + '\n')
        if verbose:
            logger.info("Saved class names to '%s'" % templates_fname)
    elif verbose:
        logger.info('WARNING: No zeroshot classification templates found')
    # Save dataset type
    if multilabel:
        type_fname = os.path.join(output_folder, 'dataset_type.txt')
        with open(type_fname, 'w') as type_file:
            type_file.write('multilabel\n')
            if verbose:
                logger.info("Saved dataset type to '%s'" % type_fname)
    # Write to TAR files
    data_fname = os.path.join(output_folder, split, r'%d.tar')
    sink = webdataset.ShardWriter(data_fname, maxcount=max_count, maxsize=max_size)
    nsamples = 0
    label_type = 'npy' if multilabel else 'cls'
    for index, (input, output) in enumerate(tqdm(dataloader, desc='Converting')):
        nsamples += 1
        if isinstance(input, str) and transform is path_to_bytes:
            # If copying file, determine image format from extension
            extension = os.path.splitext(input)[1].replace('.', '').lower().replace('jpeg', 'jpg') or image_format
        else:
            extension = image_format
        # Convert label if necessary
        if isinstance(output, torch.Tensor):
            if multilabel:
                output = output.detach().cpu().numpy()
            else:
                output = output.item()
        # Write example
        sink.write(
            {
                '__key__': 's%07d' % index,
                extension: transform(input) if transform else input,
                label_type: output,
            }
        )
    num_shards = sink.shard
    sink.close()
    if verbose:
        logger.info("Saved dataset to '%s'" % data_fname.replace(r'%d', '{0..%d}' % (num_shards - 1)))
    # Save number of shards
    nshards_fname = os.path.join(output_folder, split, 'nshards.txt')
    with open(nshards_fname, 'w') as nshards_file:
        nshards_file.write(f'{num_shards}\n')
    if verbose:
        logger.info("Saved number of shards = %d to '%s'" % (num_shards, nshards_fname))
    logger.info('Final dataset size: %s', nsamples)


def convert_retrieval_dataset(
    dataset,
    split,
    output_folder,
    *,
    transform=None,
    image_format='webp',
    max_count=10_000,
    max_size=1_000_000_000,
    verbose=True,
):
    """
    Convert an iterable `dataset` of (image, [caption1, caption2, ...]) pairs to webdataset (.tar) format,
    and store in `output_folder/split`.

    Labels must be lists of strings, with no newlines.

    Read the documentation of `convert_dataset` for more information.
    """
    # Create output directory
    os.makedirs(os.path.join(output_folder, split), exist_ok=True)
    # Multiprocessed dataloader, should work with Dataset or list
    dataloader = torch.utils.data.DataLoader(
        dataset,
        batch_size=1,
        num_workers=8,
        collate_fn=lambda batch: batch[0],  # No collate, only for multiprocessing
    )
    if verbose:
        try:
            logger.info(f'Dataset size: {len(dataset)}')
        except TypeError:
            logger.info('IterableDataset has no len()')
    # No classnames
    # No zeroshot templates
    # Save dataset type
    type_fname = os.path.join(output_folder, 'dataset_type.txt')
    with open(type_fname, 'w') as type_file:
        type_file.write('retrieval\n')
    if verbose:
        logger.info("Saved dataset type to '%s'" % type_fname)
    # Write to TAR files
    data_fname = os.path.join(output_folder, split, r'%d.tar')
    sink = webdataset.ShardWriter(data_fname, maxcount=max_count, maxsize=max_size)
    nsamples = 0
    for index, (input, output) in enumerate(tqdm(dataloader, desc='Converting')):
        nsamples += 1
        if isinstance(input, str) and transform is path_to_bytes:
            # If copying file, determine image format from extension
            extension = os.path.splitext(input)[1].replace('.', '').lower().replace('jpeg', 'jpg') or image_format
        else:
            extension = image_format
        sink.write(
            {
                '__key__': 's%07d' % index,
                extension: transform(input) if transform else input,
                'txt': '\n'.join(caption.replace('\n', r'\n') for caption in output),
            }
        )
    num_shards = sink.shard
    sink.close()
    if verbose:
        logger.info("Saved dataset to '%s'" % data_fname.replace(r'%d', '{0..%d}' % (num_shards - 1)))
    # Save number of shards
    nshards_fname = os.path.join(output_folder, split, 'nshards.txt')
    with open(nshards_fname, 'w') as nshards_file:
        nshards_file.write(f'{num_shards}\n')
    if verbose:
        logger.info("Saved number of shards = %d to '%s'" % (num_shards, nshards_fname))
    logger.info('Final dataset size: %s', nsamples)


if __name__ == '__main__':
    from modelscope.msdatasets import MsDataset

    splits = ['train', 'validation']
    for split in splits:
        ds = MsDataset.load('modelscope/muge', split=split)
        hf_dataset = ds.to_hf_dataset()
        pytorch_dataset = DatasetWrapper(hf_dataset, image_key='image', text_key='query')
        convert_retrieval_dataset(
            pytorch_dataset,
            split,
            'data/muge',
            transform=PIL_to_bytes('jpg'),
            image_format='jpg',
            max_count=50_000,
        )

```

### Core Architecture Module: `evalscope/backend/rag_eval/models/utils.py`
```
"""Shared utilities for model loading and downloading."""

import os
from typing import Optional

from evalscope.constants import HubType
from evalscope.utils.logger import get_logger

logger = get_logger()


def download_model(model_id: str, revision: Optional[str] = 'master', hub: str = HubType.MODELSCOPE) -> str:
    """Download a model from ModelScope or HuggingFace hub.

    Args:
        model_id: The model identifier (e.g. 'BAAI/bge-large-zh-v1.5').
        revision: The model revision/branch to download.
        hub: The hub to download from ('modelscope' or 'huggingface').

    Returns:
        Local path to the downloaded model.
    """
    if hub == HubType.MODELSCOPE:
        from modelscope import snapshot_download

        logger.info(f'Downloading model {model_id} from ModelScope (revision={revision})')
        model_path = snapshot_download(model_id=model_id, revision=revision)
    else:
        from huggingface_hub import snapshot_download as hf_snapshot_download

        logger.info(f'Downloading model {model_id} from HuggingFace (revision={revision})')
        model_path = hf_snapshot_download(repo_id=model_id, revision=revision)
    return model_path


def resolve_model_path(
    model_name_or_path: str, hub: str = HubType.MODELSCOPE, revision: Optional[str] = 'master'
) -> str:
    """Resolve model name to local path, downloading if necessary.

    Args:
        model_name_or_path: Local path or remote model identifier.
        hub: The hub to download from if model needs downloading.
        revision: The model revision/branch.

    Returns:
        Local path to the model.
    """
    if os.path.exists(model_name_or_path):
        return model_name_or_path
    return download_model(model_name_or_path, revision=revision, hub=hub)

```

### Core Architecture Module: `evalscope/backend/rag_eval/utils/clip.py`
```
import os
from typing import List, Union

import torch
import torch.nn.functional as F
from langchain_core.embeddings import Embeddings
from PIL import Image
from transformers import AutoModel, AutoProcessor

from evalscope.backend.rag_eval.utils.tools import PIL_to_base64, download_model
from evalscope.constants import HubType


class VisionModel:
    @staticmethod
    def load(**kw):
        api_base = kw.get('api_base', None)
        if api_base:
            return VLMAPI(
                model_name=kw.get('model_name', ''),
                openai_api_base=api_base,
                openai_api_key=kw.get('api_key', 'EMPTY'),
                prompt=kw.get('prompt', None),
            )
        else:
            return CLIPModel(**kw)


class VLMAPI:
    def __init__(self, model_name, openai_api_base, openai_api_key, prompt=None):
        from langchain_core.prompts import ChatPromptTemplate
        from langchain_openai import ChatOpenAI

        self.model_name = model_name
        self.model = ChatOpenAI(
            model_name=model_name,
            openai_api_base=openai_api_base,
            openai_api_key=openai_api_key,
        )
        self.default_prompt = "Please describe this image in general. Directly provide the description, do not include prefix like 'This image depicts'"  # noqa: E501
        self.prompt = ChatPromptTemplate.from_messages(
            [
                ('system', prompt if prompt else self.default_prompt),
                (
                    'user',
                    [
                        {
                            'type': 'image_url',
                            'image_url': {'url': 'data:image/jpeg;base64,{image_data}'},
                        }
                    ],
                ),
            ]
        )
        self.chain = self.prompt | self.model
        self.transform = PIL_to_base64

    def encode_image(self, images):
        captions = []
        for image in images:
            response = self.chain.invoke({'image_data': image})
            captions.append(response.content)
        return captions


class CLIPModel(Embeddings):
    def __init__(
        self,
        model_name: str,
        revision: str = 'master',
        hub=HubType.MODELSCOPE,
        device='cpu',
    ):
        self.device = device
        self.model_name = model_name
        self.revision = revision

        # Download the model if it doesn't exist locally
        if not os.path.exists(model_name) and hub == HubType.MODELSCOPE:
            model_name = download_model(self.model_name, self.revision)

        # Load the model and processor
        self.model = AutoModel.from_pretrained(model_name).to(self.device)
        self.processor = AutoProcessor.from_pretrained(model_name)
        self.transform = self.processor.image_processor
        self.tokenizer = self.processor.tokenizer

    def encode_text(self, batch_texts: Union[List[str], List[List[str]]]):
        if isinstance(batch_texts[0], list):
            batch_texts = [text for _, texts in enumerate(batch_texts) for text in texts]
        # Ensure that the input texts are within the token limit
        max_length = self.tokenizer.model_max_length
        if not max_length or max_length > 0xFFFFFF:
            max_length = 512
        encoded_inputs = self.tokenizer(
            text=batch_texts,
            max_length=max_length,
            padding=True,
            truncation=True,
            return_tensors='pt',
        )

        inputs = {k: v.to(self.device) for k, v in encoded_inputs.items()}

        with torch.no_grad():
            text_features = self.model.get_text_features(**inputs)
        text_features = F.normalize(text_features, p=2, dim=-1)
        return text_features

    def encode_image(self, image):
        batch_images = torch.stack([d['pixel_values'][0] for d in image])
        batch_images = batch_images.to(self.device)
        with torch.no_grad():
            image_features = self.model.get_image_features(batch_images)
        image_features = F.normalize(image_features, p=2, dim=-1)
        return image_features

    def embed_documents(self, texts):
        text_features = self.encode_text(texts)
        return text_features.cpu().numpy().tolist()

    def embed_query(self, text):
        text_features = self.encode_text([text])
        return text_features.cpu().numpy().tolist()[0]

    def embed_image(self, uris: List[str]):
        # read image and transform
        images = [Image.open(image_path) for image_path in uris]
        transformed_images = [
            self.transform(
                image,
                return_tensors='pt',
            )
            for image in images
        ]
        image_features = self.encode_image(transformed_images)
        return image_features.cpu().numpy().tolist()


if __name__ == '__main__':
    model = CLIPModel('AI-ModelScope/chinese-clip-vit-large-patch14-336px')
    model.embed_image(
        [
            'custom_eval/multimodal/images/AMNH.jpg',
            'custom_eval/multimodal/images/AMNH.jpg',
        ]
    )
    model.encode_text(['我喜欢吃饭' * 1000])
    print('done')

```

### Core Architecture Module: `evalscope/backend/rag_eval/utils/llm.py`
```
import logging
import os
from typing import Any, Dict, List, Optional

from langchain_core.callbacks.manager import CallbackManagerForLLMRun
from langchain_core.language_models.llms import LLM as BaseLLM
from langchain_openai import ChatOpenAI

from evalscope.api.model import GenerateConfig, Model, get_model
from evalscope.constants import DEFAULT_MODEL_REVISION, EvalType

logger = logging.getLogger(__name__)


class LLM:
    """Factory for creating LLM instances (LangChain-compatible)."""

    @staticmethod
    def load(**kw):
        """Load an LLM instance based on config.

        If api_base is provided, creates a ChatOpenAI (remote API).
        Otherwise, creates a LocalLLM (local checkpoint).
        """
        api_base = kw.get('api_base', None)
        if api_base:
            return ChatOpenAI(
                model=kw.get('model_name', ''),
                base_url=api_base,
                api_key=kw.get('api_key', 'EMPTY'),
                temperature=kw.get('temperature', 0.0),
            )
        else:
            return LocalLLM(**kw)


class LocalLLM(BaseLLM):
    """A custom LLM that loads a model from a given path and performs inference."""

    model_name_or_path: str
    model_revision: str = DEFAULT_MODEL_REVISION
    template_type: Optional[str] = None
    model_name: Optional[str] = None
    model: Optional[Model] = None
    generation_config: Optional[Dict] = {}

    def __init__(self, **kw):
        super().__init__(**kw)
        self.model_name = os.path.basename(self.model_name_or_path)

        # Create and initialize the local model
        self.model = get_model(
            model=self.model_name_or_path,
            eval_type=EvalType.CHECKPOINT,
            config=GenerateConfig(**self.generation_config),
        )

    def _call(
        self,
        prompt: str,
        stop: Optional[List[str]] = None,
        run_manager: Optional[CallbackManagerForLLMRun] = None,
        **kwargs: Any,
    ) -> str:
        """Run the LLM on the given input."""
        response = self.model.generate(input=prompt)
        return response.completion

    @property
    def _identifying_params(self) -> Dict[str, Any]:
        """Return a dictionary of identifying parameters."""
        return {
            'model_name': self.model_name,
            'revision': self.model_revision,
        }

    @property
    def _llm_type(self) -> str:
        """Get the type of language model used by this chat model."""
        return self.model_name

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #1608** (2026-08-21): **fix(terminal-bench): prevent infrastructure failures from becoming valid scores**
  *Symptoms*: ## Background  External users running EvalScope 1.10.0 for Terminal-Bench 2.0 reported several reliability and reproducibility problems after six full 89-task runs. We audited the report against v1.10.0, current `main`, and Harbor 0.8.x.  The core invariant is: **only a completed benchmark verdict with a valid reward may affect a model score; infrastructure, harness, verifier, or result-contract failures must be visible and excluded when `ignore_errors=True`, not silently converted to 0.**  ## Confirmed findings  ### P0: Terminal-Bench infrastructure failures are scored as zero  `terminal_bench_adapter.match_score()` currently defaults missing/unreadable `verifier_result.rewards.reward` to `0`. Harbor persists an `exception_info` and may leave `verifier_result` / `rewards` as `null` when Docker, network, disk, or verifier execution fails. The adapter therefore emits a normal `acc=0` score and keeps the sample in the denominator even when the model was never called.  Expected behavior:  - Validate Harbor trial results before scoring. - A valid score requires no trial exception and a finite numeric `verifier_result.rewards.reward` in the benchmark range. - Missing, malformed, or invalid reward data raises a sample execution error with trial URI and concise exception context. - Do not use a broad `except: reward = 0`.  ### P0: `--ignore-errors` does not disclose incomplete evaluation  The evaluator logs a failed work item then skips it when `ignore_errors=True`; the final report

- **Issue #994** (2025-11-27): **aarch64的支持**
  *Symptoms*: ## 自查清单  在提交 issue 之前，请确保您已完成以下步骤: - [x] 我已仔细阅读了[相关使用说明文档](https://evalscope.readthedocs.io/zh-cn/latest/get_started/parameters.html) - [x] 我已查看了[常见问题解答](https://evalscope.readthedocs.io/zh-cn/latest/get_started/faq.html) - [x] 我已搜索并查看了现有的 issues，确认这不是一个重复的问题  ## 问题描述 采用pip install ".[all]"时发现不支持arm平台的安装，原因在于ms-vlmeval依赖的decord没有arm平台的whl。现在的vlmeval已经不再强制依赖decord，我可以手动安装vlmeval。可是，观察文档我发现，evalscope依赖的ms-vlmeval是经过定制的，这就意味着我必须安装你们发布的ms-vlmeval才能使用evalscope评估vlm。什么时候可以避免强制依赖decord呢？ <img width="750" height="235" alt="Image" src="https://github.com/user-attachments/assets/dc0d5e77-42bf-45cd-917c-884e8ca44652" />  ## EvalScope 版本（必填） master分支clone后本地构建  ## 使用的工具 - [x] Native / 原生框架 - [ ] Opencompass backend - [x] VLMEvalKit backend - [ ] RAGEval backend - [ ] Perf / 模型推理压测工具 - [ ] Arena / 竞技场模式  ## 执行的代码或指令  请提供您执行的主要代码或指令。  ## 错误日志  请粘贴完整的错误日志或控制台输出。  ## 运行环境  - 操作系统：linux，aarch64 - Python版本：  ## 其他信息  如果有其他相关信息，请在此处提供。 
  **Post-Mortem & Fix Analysis**:
  > 问题已修复，更新了ms-vlmeval 的版本，移除了decord依赖

- **Issue #981** (2025-11-18): **[BUG] `KeyError: 'delta'` when perf local OpenAI server with `stream=True`**
  *Symptoms*: ## 自查清单  在提交 issue 之前，请确保您已完成以下步骤: - [x] 我已仔细阅读了[相关使用说明文档](https://evalscope.readthedocs.io/zh-cn/latest/get_started/parameters.html) - [x] 我已查看了[常见问题解答](https://evalscope.readthedocs.io/zh-cn/latest/get_started/faq.html) - [x] 我已搜索并查看了现有的 issues，确认这不是一个重复的问题  ## 问题描述  请简要描述您遇到的问题。  ## EvalScope 版本（必填） v1.2.0 ## 使用的工具 - [ ] Native / 原生框架 - [ ] Opencompass backend - [ ] VLMEvalKit backend - [ ] RAGEval backend - [x] Perf / 模型推理压测工具 - [ ] Arena / 竞技场模式  ## 执行的代码或指令  ```bash evalscope perf \   --api openai \   --url "$API_URL"/v1/completions \   --api-key "$API_KEY" \   --model "$MODEL" \   --outputs-dir evalscope/perf/${MODEL} \   --log-every-n-query 5 \   --connect-timeout 6000 \   --read-timeout 6000 \   --number 20 \   --parallel 1 \   --sleep-interval 3 \   --max-tokens 2048 \   --min-tokens 2048 \   --dataset speed_benchmark \   --stream \   --extra-args '{"ignore_eos": true}' \   --seed 6611 \   --debug  ```  ## 错误日志  ``` 2025-11-17 14:00:52 - evalscope - default_api.py - process_request - 212 - ERROR: Traceback (most recent call last):   File "/opt/miniconda3/envs/llm/lib/python3.10/site-packages/evalscope/perf/plugin/api/default_api.py", line 123, in process_request     content = choices[0]['delta'].get('content') KeyError: 'delta'  2025-11-17 14:00:52 - evalscope - http_client.py - test_connection - 129 - WARNING: Retrying... <Traceback (most recent call last):   File "/opt/miniconda3/envs/llm/lib/python3.10/site-packages/evalscope/perf/plugin/api/default_api.py", line
  **Post-Mortem & Fix Analysis**:
  > 当endpoint换成`/v1/chat/completions`，会遇到  422: Unprocessable Entity 
  > main分支已修复该问题，可以在试试
  > > main分支已修复该问题，可以在试试  今天用evalscope怎么突然有这个问题了，版本是1.2.0，之前用的也是这个版本没这个问题，我都是用pip下载的

- **Issue #946** (2025-11-04): **AI-ModelScope/SimpleQA 题数不对**
  *Symptoms*: ## 自查清单  在提交 issue 之前，请确保您已完成以下步骤: - [x] 我已仔细阅读了[相关使用说明文档](https://evalscope.readthedocs.io/zh-cn/latest/get_started/parameters.html) - [x] 我已查看了[常见问题解答](https://evalscope.readthedocs.io/zh-cn/latest/get_started/faq.html) - [x] 我已搜索并查看了现有的 issues，确认这不是一个重复的问题  ## 问题描述  simpleqa使用的数据集AI-ModelScope/SimpleQA，题目`4321`，官方数据集`4326`，得看下少了哪些题目？  官方数据集： https://github.com/openai/simple-evals/blob/ee3b0318d8d1d9d72755a4120879be65f7c07e9e/simpleqa_eval.py#L102C14-L102C92  ## EvalScope 版本（必填） v0.xx.x  ## 使用的工具 - [ ] Native / 原生框架 - [ ] Opencompass backend - [ ] VLMEvalKit backend - [ ] RAGEval backend - [ ] Perf / 模型推理压测工具 - [ ] Arena / 竞技场模式  ## 执行的代码或指令  请提供您执行的主要代码或指令。  ## 错误日志  请粘贴完整的错误日志或控制台输出。  ## 运行环境  - 操作系统： - Python版本：  ## 其他信息  如果有其他相关信息，请在此处提供。 
  **Post-Mortem & Fix Analysis**:
  > @Yunnglin 
  > 这个问题我处理一下，得更新数据集
  > 该问题已修复

- **Issue #915** (2026-06-02): **自定义数据集运行报参数错误**
  *Symptoms*: ## 自查清单  在提交 issue 之前，请确保您已完成以下步骤: - [X] 我已仔细阅读了[相关使用说明文档](https://evalscope.readthedocs.io/zh-cn/latest/get_started/parameters.html) - [X] 我已查看了[常见问题解答](https://evalscope.readthedocs.io/zh-cn/latest/get_started/faq.html) - [ ] 我已搜索并查看了现有的 issues，确认这不是一个重复的问题  ## 问题描述  请简要描述您遇到的问题。  ## EvalScope 版本（必填） v1.1.0  ## 使用的工具 - [ ] Native / 原生框架 - [ ] Opencompass backend - [ ] VLMEvalKit backend - [X] RAGEval backend - [ ] Perf / 模型推理压测工具 - [ ] Arena / 竞技场模式  ## 执行的代码或指令 from evalscope.run import run_task  task_cfg = {     "work_dir": "outputs",     "eval_backend": "RAGEval",     "eval_config": {         "tool": "MTEB",         "model": [             {                 "model_name": "youtu-embedding",                 "api_base": "http://192.168.0.147:10600/v1",                 "api_key": "123",                 "dimensions": 2048,                 "encode_kwargs": {                     "batch_size": 128,                 },             }         ],         "eval": {             "tasks": ["CustomRetrieval"],             "dataset_path": "/study_project/evalscope/embedding_test/retrieval_data",             "verbosity": 2,             "overwrite_results": True,             "limits": 500,         },     }, } run_task(task_cfg=task_cfg)    ## 错误日志 Traceback (most recent call last):   File "/DATA/LLM/gaojiale/study_project/evalscope/embedding_test/embedding_test.py", line 28, in <module>     run_task(task_cfg=task_cfg)   File "/DATA/LLM/gaojiale/miniconda/envs/eval/lib/python3.10/site-packages
  **Post-Mortem & Fix Analysis**:
  > 遇到相同的问题
  > Opened #1390 to address this.  What changed: - RAGEval/MTEB result summaries now use metadata from the task objects that were actually evaluated, instead of asking `TaskResult.task_type` to look the task up again in the upstream MTEB registry. - This covers `CustomRetrieval` and other EvalScope-managed custom MTEB tasks, where the task exists in EvalScope but not necessarily in MTEB's global registry. - Added a safe fallback so summary rendering does not crash if a result has no matching task metadata. - Added regression coverage for the `CustomRetrieval` failure mode where `TaskResult.task_type` raises `KeyError`.  Validation passed: - RAGEval/MTEB custom task result-summary regression tests. - Python compilation check for the changed summary code and new test. - Whitespace diff check. - Existing MTEB integration tests collect successfully with level-0 tests skipped.

- **Issue #859** (2026-07-08): **ValueError: No nodes that satisfied the given filer. Try changing the filter.**
  *Symptoms*: ## 自查清单  在提交 issue 之前，请确保您已完成以下步骤: - [√] 我已仔细阅读了[相关使用说明文档](https://evalscope.readthedocs.io/zh-cn/latest/get_started/parameters.html) - [√] 我已查看了[常见问题解答](https://evalscope.readthedocs.io/zh-cn/latest/get_started/faq.html) - [√] 我已搜索并查看了现有的 issues，确认这不是一个重复的问题  ## 问题描述  用ragas生成测试数据集时报错ValueError: No nodes that satisfied the given filer. Try changing the filter.     ## EvalScope 版本（必填）  v1.0.2  ## 使用的工具  RAGAS v0.2.14  ## 执行的代码或指令  from evalscope.run import run_task from evalscope.utils.logger import get_logger  generate_testset_task_cfg = {     "eval_backend": "RAGEval",      "eval_config": {         "tool": "RAGAS",         "testset_generation": {             "docs": ["**.txt"],              "test_size": 10,             "output_file": "outputs/test1/qwen_testset.json",             "knowledge_graph": "outputs/test1/qwen_knowledge_graph.json",             "generator_llm": {                 "model_name": "qwen2.5-vl-72b-instruct",                 "api_base": "https://dashscope.aliyuncs.com/compatible-mode/v1",                 "api_key": "*****",                 "generation_config": {                     "temperature": 0.7,                     "max_tokens": 1024                   }             },                          "embeddings": {                 "model_name": "Qwen3-Embedding-0.6B",                   "api_base": "******",                 "api_key": "EMPTY",                   "dimension": 1024             },             "language": "chinese"           }     }, }  logger = 
  **Post-Mortem & Fix Analysis**:
  > PR #1383 已合并，将 RAGAS 升级到 0.4.x 并对 RAG eval 模块做了重构。该 issue 涉及 RAGAS testset generation 中 persona 节点过滤的报错（`No nodes that satisfied the given filter`），属于 RAGAS 内部 KG 节点筛选逻辑问题，需要在新版本上验证。  请从最新 main 分支安装后再次尝试，并反馈是否仍能复现。如新版本仍有问题，我们会进一步跟进。
  > This issue was reported against the legacy RAGEval / RAGAS 0.2.x path.  RAG evaluation has been refactored in PR #1383, and RAGAS has been upgraded to the 0.4.x series. The original error (`No nodes that satisfied the given filter`) is related to RAGAS testset generation / KG node filtering in the old stack, so the first step is to verify with the latest main branch.  Closing this for now as a legacy RAGEval issue. If it can still be reproduced on the latest main branch, please reopen with:  1. EvalScope commit / version 2. RAGAS version 3. Full config 4. Minimal docs sample 5. Complete traceback  We'll continue from there if the issue still exists. 

- **Issue #856** (2025-09-29): **BFCL-v3数据集type字段解析错误**
  *Symptoms*: ## 自查清单  在提交 issue 之前，请确保您已完成以下步骤: - [x] 我已仔细阅读了[相关使用说明文档](https://evalscope.readthedocs.io/zh-cn/latest/get_started/parameters.html) - [x] 我已查看了[常见问题解答](https://evalscope.readthedocs.io/zh-cn/latest/get_started/faq.html) - [x] 我已搜索并查看了现有的 issues，确认这不是一个重复的问题  ## 问题描述  对bfcl_v3进行评估之后会出现如下的报错：  ``` prediction failed: due to 1 validation error for ToolInfo parameters.properties.exclusion   Value error, Unsupported type: {'type': 'string', 'description': 'The type of the exclusion e.g window, door etc.'} for Python to JSON conversion. [type=value_error, input_value={'type': 'object', 'prope...sion if not specified.'}, input_type=dict] ```  在bfcl_v3中会有多条数据会引起上述的报错，以其中的某条数据为例进行说明。数据内容如下：  ``` {   "id": "simple_260",   ... ...   "tools": [     {       "type": "function",       "function": {         "name": "paint_requirement_calculate",         "description": "Calculate the amount of paint required to paint a given area. Account for coverage efficiency of the paint and exclusions (like windows). Note that the provided function is in Python 3 syntax.",         "parameters": {           "type": "object",           "properties": {             "area": {               "type": "object",               "properties": {                 "width": {                   "type": "integer",                   "description": "The width of the area to be painted in feet."                 },                 "height": {                   "type": "integer",                   "description": "The height of 
  **Post-Mortem & Fix Analysis**:
  > 感谢你的反馈，我修复一下
  > 已修复，可以用main分支代码试试
  > 测试没问题了，感谢🙏

- **Issue #844** (2025-09-28): **TaskConfig 导出 yaml 文件失败**
  *Symptoms*: ## 自查清单  在提交 issue 之前，请确保您已完成以下步骤: - [√] 我已仔细阅读了[相关使用说明文档](https://evalscope.readthedocs.io/zh-cn/latest/get_started/parameters.html) - [√] 我已查看了[常见问题解答](https://evalscope.readthedocs.io/zh-cn/latest/get_started/faq.html) - [√] 我已搜索并查看了现有的 issues，确认这不是一个重复的问题  ## 问题描述  在 ms-swift 中使用 evalscope 做训练时的评估工具时，发现 TaskConfig 导出 yaml 失败。  ## EvalScope 版本（必填） v1.0.1 （ms-swift version: v3.9.0dev0）  ## 使用的工具 - [√] Native / 原生框架 - [ ] Opencompass backend - [ ] VLMEvalKit backend - [ ] RAGEval backend - [ ] Perf / 模型推理压测工具 - [ ] Arena / 竞技场模式  ## 执行的代码或指令  ```bash PROJECT_NAME=sft MODEL_NAME=qwen2_5_05b MODEL_PATH="Qwen/Qwen2.5-0.5B-Instruct"  EXP_NAME=test  TRAIN_TYPE=full TRAIN_DATASET_PATH="AI-ModelScope/alpaca-gpt4-data-zh#100" OUTPUT_DIR=outputs/ms-swift  CUDA_VISIBLE_DEVICES=0 \ swift sft \     --model $MODEL_PATH \     --model_type qwen2_5 \     --train_type $TRAIN_TYPE \     --dataset $TRAIN_DATASET_PATH \     --torch_dtype bfloat16 \     --num_train_epochs 2 \     --per_device_train_batch_size 8 \     --per_device_eval_batch_size 8 \     --learning_rate 1e-4 \     --gradient_accumulation_steps 2 \     --eval_strategy "steps" \     --eval_steps 2 \     --eval_use_evalscope \     --eval_dataset "gsm8k" \     --eval_dataset_args '{"gsm8k": {"few_shot_num": 0}}' \     --eval_generation_config '{"max_tokens": 512, "temperature": 0}' \     --eval_limit 10 \     --extra_eval_args '{"ignore_errors": true}' \     --save_steps 50 \     --save_total_limit 100 \     --logging_steps 1 \     -
  **Post-Mortem & Fix Analysis**:
  > 这部分已在ms-swift中修复  > 感谢你的反馈！我们将关闭此问题。如果您有任何疑问，请随时重新打开它。如果EvalScope对您有所帮助，欢迎给我们点个STAR以示支持，谢谢！

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

### Incident Patch 1: `cfb9af39` (2026-09-30)
**Commit Message**: fix(web): localize version badge tooltip (#1796)

**File**: `evalscope/web/src/components/nav/TopNav.tsx` (modified, +1/-1)
```diff
@@ -62,7 +62,7 @@ export default function TopNav() {
               Eval<span className="text-[var(--accent)]">Scope</span>
             </span>
             {config?.version && (
-              <Badge title={`EvalScope version ${config.version}`}>
+              <Badge title={t('common.evalScopeVersion', { version: config.version })}>
                 v{config.version}
               </Badge>
             )}
```

**File**: `evalscope/web/src/i18n/translations/common.ts` (modified, +2/-0)
```diff
@@ -6,6 +6,7 @@ export const en: Dict = {
   all: 'All',
   openNewTab: 'Open in New Tab',
   github: 'Star on GitHub',
+  evalScopeVersion: 'EvalScope version ${version}',
   stop: 'Stop',
   retry: 'Retry',
   cancel: 'Cancel',
@@ -20,6 +21,7 @@ export const zh: Dict = {
   all: '全部',
   openNewTab: '在新标签页打开',
   github: 'GitHub 加星',
+  evalScopeVersion: 'EvalScope 版本 ${version}',
   stop: '停止',
   retry: '重试',
   cancel: '取消',
```

---

### Incident Patch 2: `1bb1accb` (2026-09-30)
**Commit Message**: fix(models): preserve Anthropic image URL sources (#1764)

Signed-off-by: git-jxj <[REDACTED_EMAIL]>

**File**: `evalscope/models/utils/anthropic.py` (modified, +4/-1)
```diff
@@ -122,8 +122,11 @@ def anthropic_chat_tool_choice(tool_choice: ToolChoice) -> ToolChoiceParam:
 
 def anthropic_image_block_param(image: str) -> ImageBlockParam:
     """Convert image path/URL to Anthropic ImageBlockParam."""
+    if is_http_url(image):
+        return ImageBlockParam(type='image', source=dict(type='url', url=image))
+
     # Resolve to data URI if needed
-    if not is_http_url(image) and not image.startswith('data:'):
+    if not image.startswith('data:'):
         image = file_as_data_uri(image)
 
     # Get media type and base64 content
```

**File**: `tests/models/test_anthropic_images.py` (added, +44/-0)
```diff
@@ -0,0 +1,44 @@
+import base64
+from pathlib import Path
+
+import pytest
+
+from evalscope.api.messages import ChatMessageUser, ContentImage
+
+
+@pytest.mark.parametrize('scheme', ['http', 'https'])
+def test_image_urls_are_sent_as_url_sources(scheme: str) -> None:
+    pytest.importorskip('anthropic')
+    from evalscope.models.utils.anthropic import anthropic_chat_messages
+
+    url = f'{scheme}://example.com/image.png?version=1'
+    _, messages = anthropic_chat_messages(
+        [ChatMessageUser(content=[ContentImage(image=url, internal={'anthropic': {'cache_control': {'type': 'ephemeral'}}})])]
+    )
+
+    assert messages[0]['content'] == [
+        {'type': 'image', 'source': {'type': 'url', 'url': url}, 'cache_control': {'type': 'ephemeral'}}
+    ]
+
+
+@pytest.mark.parametrize('source_kind', ['path', 'data_uri'])
+def test_local_images_remain_base64_sources(source_kind: str, tmp_path: Path) -> None:
+    pytest.importorskip('anthropic')
+    from evalscope.models.utils.anthropic import anthropic_chat_messages
+
+    image_data = base64.b64decode(
+        'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII='
+    )
+    encoded = base64.b64encode(image_data).decode('ascii')
+    if source_kind == 'path':
+        image_path = tmp_path / 'image.png'
+        image_path.write_bytes(image_data)
+        source = str(image_path)
+    else:
+        source = f'data:image/png;base64,{encoded}'
+
+    _, messages = anthropic_chat_messages([ChatMessageUser(content=[ContentImage(image=source)])])
+
+    assert messages[0]['content'] == [
+        {'type': 'image', 'source': {'type': 'base64', 'media_type': 'image/png', 'data': encoded}}
+    ]
```

---

### Incident Patch 3: `a827b17b` (2026-09-30)
**Commit Message**: fix(tools): preserve literal values in JSON schemas (#1765)

Signed-off-by: git-jxj <[REDACTED_EMAIL]>

**File**: `evalscope/utils/json_schema.py` (modified, +10/-18)
```diff
@@ -61,26 +61,18 @@ class JSONSchema(BaseModel):
     """Required fields for object parameters."""
 
     @model_validator(mode='before')
-    def convert_type_before_validation(cls, values):
+    def convert_type_before_validation(cls, values: Any) -> Any:
         values = deepcopy(values)
 
-        def recursive_convert_type(obj):
-            if isinstance(obj, dict):
-                # Convert 'type' field if it's a string
-                if 'type' in obj and isinstance(obj['type'], str):
-                    try:
-                        obj['type'] = python_type_to_json_type(obj['type'])
-                    except ValueError:
-                        # If conversion fails, leave it as is
-                        pass
-                # Recursively process nested structures
-                for k, v in obj.items():
-                    obj[k] = recursive_convert_type(v)
-            elif isinstance(obj, list):
-                return [recursive_convert_type(item) for item in obj]
-            return obj
-
-        return recursive_convert_type(values)
+        # Nested schema fields are validated as JSONSchema instances themselves.
+        # Recursing through arbitrary dictionaries would also rewrite literal
+        # values in defaults and enums that happen to contain a 'type' key.
+        if isinstance(values, dict) and isinstance(values.get('type'), str):
+            try:
+                values['type'] = python_type_to_json_type(values['type'])
+            except ValueError:
+                pass
+        return values
 
 
 def json_schema(t: Type[Any]) -> JSONSchema:
```

**File**: `tests/utils/test_json_schema.py` (added, +57/-0)
```diff
@@ -0,0 +1,57 @@
+from copy import deepcopy
+from typing import Dict
+
+import pytest
+from pydantic import BaseModel
+
+from evalscope.api.tool.tool_info import parse_tool_info
+from evalscope.utils.json_schema import JSONSchema
+
+
+@pytest.mark.parametrize('keyword', ['default', 'enum'])
+def test_schema_conversion_preserves_literal_values(keyword: str) -> None:
+    literal = {'type': 'str', 'nested': [{'type': 'int'}]}
+    value = [literal] if keyword == 'enum' else literal
+    raw = {'type': 'dict', keyword: value}
+    original = deepcopy(raw)
+
+    schema = JSONSchema.model_validate(raw)
+
+    assert schema.type == 'object'
+    assert getattr(schema, keyword) == value
+    assert raw == original
+
+
+@pytest.mark.parametrize(
+    'nested',
+    [
+        {'properties': {'payload': {'type': 'dict', 'default': {'type': 'str'}}}},
+        {'items': {'type': 'dict', 'default': {'type': 'str'}}},
+        {'additionalProperties': {'type': 'dict', 'default': {'type': 'str'}}},
+        {'anyOf': [{'type': 'dict', 'default': {'type': 'str'}}]},
+    ],
+)
+def test_schema_conversion_still_normalizes_nested_schema_types(nested: dict) -> None:
+    schema = JSONSchema.model_validate(nested).model_dump(exclude_none=True)
+    child = next(iter(schema.values()))
+    if 'properties' in schema:
+        child = child['payload']
+    elif 'anyOf' in schema:
+        child = child[0]
+
+    assert child['type'] == 'object'
+    assert child['default'] == {'type': 'str'}
+
+
+class Payload(BaseModel):
+    options: Dict[str, str] = {'type': 'str'}
+
+
+def test_tool_schema_preserves_pydantic_field_defaults() -> None:
+    def tool(payload: Payload) -> str:
+        """Accept a payload."""
+        return payload.options['type']
+
+    info = parse_tool_info(tool)
+
+    assert info.parameters.properties['payload'].properties['options'].default == {'type': 'str'}
```

---

### Incident Patch 4: `57d299e4` (2026-09-30)
**Commit Message**: fix(perf): include response bodies in embedding and rerank latency (#1763)

**File**: `evalscope/perf/plugin/api/openai_embedding_api.py` (modified, +5/-5)
```diff
@@ -169,11 +169,6 @@ async def process_request(self, client_session, url: str, headers: Dict, body: D
 
         try:
             async with client_session.post(url=url, data=data, headers=headers) as response:
-                timestamp = time.perf_counter()
-                output.completed_time = timestamp
-                output.query_latency = timestamp - st
-                output.first_chunk_latency = output.query_latency
-
                 if response.status == 200:
                     try:
                         payload = await response.json()
@@ -210,6 +205,11 @@ async def process_request(self, client_session, url: str, headers: Dict, body: D
                             output.error = response.reason or ''
                     output.success = False
 
+                timestamp = time.perf_counter()
+                output.completed_time = timestamp
+                output.query_latency = timestamp - st
+                output.first_chunk_latency = output.query_latency
+
         except Exception:
             output.success = False
             exc_info = sys.exc_info()
```

**File**: `evalscope/perf/plugin/api/openai_rerank_api.py` (modified, +5/-5)
```diff
@@ -189,11 +189,6 @@ async def process_request(self, client_session, url: str, headers: Dict, body: D
 
         try:
             async with client_session.post(url=url, data=data, headers=headers) as response:
-                timestamp = time.perf_counter()
-                output.completed_time = timestamp
-                output.query_latency = timestamp - st
-                output.first_chunk_latency = output.query_latency
-
                 if response.status == 200:
                     try:
                         payload = await response.json()
@@ -232,6 +227,11 @@ async def process_request(self, client_session, url: str, headers: Dict, body: D
                             output.error = response.reason or ''
                     output.success = False
 
+                timestamp = time.perf_counter()
+                output.completed_time = timestamp
+                output.query_latency = timestamp - st
+                output.first_chunk_latency = output.query_latency
+
         except Exception:
             output.success = False
             exc_info = sys.exc_info()
```

**File**: `tests/perf/test_embedding_rerank_latency.py` (added, +63/-0)
```diff
@@ -0,0 +1,63 @@
+"""Embedding and rerank latency includes reading the complete response body."""
+
+import asyncio
+import json
+import time
+
+import aiohttp
+import pytest
+from aiohttp import web
+from aiohttp.test_utils import TestServer
+
+from evalscope.perf.arguments import Arguments
+from evalscope.perf.plugin.api.base import ApiPluginBase
+from evalscope.perf.plugin.api.openai_embedding_api import OpenaiEmbeddingPlugin
+from evalscope.perf.plugin.api.openai_rerank_api import OpenaiRerankPlugin
+from evalscope.perf.utils.benchmark_util import BenchmarkData, MetricsAccumulator
+
+
+@pytest.mark.parametrize('plugin_type', [OpenaiEmbeddingPlugin, OpenaiRerankPlugin])
+@pytest.mark.parametrize('status', [200, 500])
+@pytest.mark.parametrize('content_type', ['application/json', 'text/plain'])
+def test_latency_includes_response_body(
+    plugin_type: type[ApiPluginBase], status: int, content_type: str
+) -> None:
+    async def run() -> tuple[BenchmarkData, ApiPluginBase, float]:
+        body_sent_at = 0.0
+        payload = {
+            'data': [{'embedding': [0.1, 0.2]}],
+            'results': [{'index': 0, 'relevance_score': 0.9}],
+            'usage': {'prompt_tokens': 10, 'total_tokens': 10},
+        }
+
+        async def handle(request: web.Request) -> web.StreamResponse:
+            nonlocal body_sent_at
+            await request.read()
+            response = web.StreamResponse(status=status, headers={'Content-Type': content_type})
+            await response.prepare(request)
+            # Flush the headers separately, as a server/proxy may do while a
+            # large embedding response is still being generated or transferred.
+            await asyncio.sleep(0.05)
+            body_sent_at = time.perf_counter()
+            await response.write(json.dumps(payload).encode())
+            await response.write_eof()
+            return response
+
+        app = web.Application()
+        app.router.add_post('/', handle)
+        plugin = plugin_type(Arguments(model='test-model'))
+        async with TestServer(app) as server:
+            async with aiohttp.ClientSession() as session:
+                output = await plugin.process_request(session, str(server.make_url('/')), {}, {})
+        return output, plugin, body_sent_at
+
+    output, plugin, body_sent_at = asyncio.run(run())
+
+    assert output.success is (status == 200)
+    assert output.completed_time >= body_sent_at
+    assert output.query_latency == pytest.approx(output.completed_time - output.start_time)
+    assert output.first_chunk_latency == output.query_latency
+
+    accumulator = MetricsAccumulator()
+    accumulator.update(output, plugin)
+    assert accumulator.wall_time >= body_sent_at - output.start_time
```

---

### Incident Patch 5: `6f1400f1` (2026-09-29)
**Commit Message**: fix(perf): tolerate non-JSON SSE terminators; route per-turn max_tokens per protocol (#1791)

* fix(perf): skip non-JSON SSE payloads instead of failing the request

Some OpenAI-compatible providers end an SSE stream with a non-JSON
sentinel other than "data: [DONE]" (or send no sentinel at all). The
streaming loops in DefaultApiPlugin.process_request and
OpenAIResponsesPlugin.process_request ran json.loads on every non-"[DONE]"
payload, so such a sentinel raised JSONDecodeError and marked the whole
request success=False, making the benchmark unusable.

Skip any SSE payload that is not valid JSON in both loops. Stream
termination is already signalled by the connection closing, so no
terminator string needs to be recognized; this also removes the two
hardcoded "[DONE]" checks.

Add end-to-end tests through process_request for both the openai and
openai_responses paths using a non-JSON sentinel.

Fixes #974

* fix(perf): route per-turn max_tokens through a protocol-aware hook

MultiTurnStrategy._worker wrote the per-turn output cap as a top-level
request['max_tokens'] for every protocol. Only OpenAI Chat reads that key:
DashScope expects parameters.max_tokens and OpenAI Responses exp

**File**: `docs/en/user_guides/stress_test/custom.md` (modified, +3/-0)
```diff
@@ -47,6 +47,9 @@ Currently, `openai` and `dashscope` are built-in and supported. To extend an API
 - process_request(...) -> BenchmarkData  
   Send the request, and gather the responses and latency data. If your custom API is compatible with OpenAI (using JSON + SSE), inheriting from `DefaultApiPlugin` is recommended. You can reuse its HTTP and streaming functionalities and only need to implement `build_request` and `parse_responses`.
 
+- set_request_max_tokens(request, max_tokens) -> None (optional)  
+  Route the per-request output cap to where your protocol expects it. Defaults to a top-level `max_tokens`; override it if your API nests or renames the cap (e.g. DashScope uses `parameters.max_tokens`, OpenAI Responses uses `max_output_tokens`). Multi-turn per-turn caps are applied through this hook, so an incorrect override leaves them silently ignored.
+
 Example: Minimum implementation by inheriting `DefaultApiPlugin` (recommended)
 
 ```python
```

**File**: `docs/zh/user_guides/stress_test/custom.md` (modified, +3/-0)
```diff
@@ -47,6 +47,9 @@ for row in rows:
 - process_request(...) -> BenchmarkData  
   发送请求并收集响应与时延数据。若自定义 API 与 OpenAI 兼容（JSON + SSE），推荐继承 `DefaultApiPlugin` 直接复用其 HTTP 与流式处理逻辑，仅需实现 `build_request`、`parse_responses`。
 
+- set_request_max_tokens(request, max_tokens) -> None （可选）  
+  将每请求的输出上限写到你的协议所期望的位置。默认写顶层 `max_tokens`；若你的 API 将其嵌套或改名（如 DashScope 用 `parameters.max_tokens`、OpenAI Responses 用 `max_output_tokens`），则需覆写。多轮的逐轮上限经此钩子写入，覆写不正确会导致其被静默忽略。
+
 示例：继承 `DefaultApiPlugin` 最小实现（推荐）
 
 ```python
```

**File**: `evalscope/perf/core/strategies/multi_turn.py` (modified, +1/-1)
```diff
@@ -158,7 +158,7 @@ async def _worker(self, worker_id: int) -> None:
                     )
                     break
                 if turn.max_tokens is not None:
-                    request['max_tokens'] = turn.max_tokens
+                    self.api_plugin.set_request_max_tokens(request, turn.max_tokens)
                 benchmark_data = await self.client.post(request)
 
                 # Inject multi-turn specific metadata.
```

**File**: `evalscope/perf/plugin/api/base.py` (modified, +4/-0)
```diff
@@ -69,6 +69,10 @@ def build_request(self, messages: Union[List[Dict], str], param: Optional[Argume
         """
         raise NotImplementedError
 
+    def set_request_max_tokens(self, request: Dict, max_tokens: int) -> None:
+        """Set the per-request output token cap where this protocol expects it."""
+        request['max_tokens'] = max_tokens
+
     @abstractmethod
     def parse_responses(self, responses: List[Dict], request: str = None, **kwargs: Any) -> Tuple[int, int]:
         """Parser responses and return number of request and response tokens.
```

**File**: `evalscope/perf/plugin/api/dashscope_api.py` (modified, +3/-0)
```diff
@@ -76,6 +76,9 @@ def __compose_query_from_parameter(self, payload: Dict, param: Arguments):
             payload['parameters']['top_p'] = param.top_p
         return payload
 
+    def set_request_max_tokens(self, request: Dict, max_tokens: int) -> None:
+        request.setdefault('parameters', {})['max_tokens'] = max_tokens
+
     def parse_responses(self, responses, **kwargs) -> Dict:
         """Parser responses and return number of request and response tokens.
 
```

**File**: `evalscope/perf/plugin/api/default_api.py` (modified, +36/-32)
```diff
@@ -179,41 +179,45 @@ async def process_request(
 
                                 chunk = message.removeprefix('data:').strip()
 
-                                if chunk != '[DONE]':
-                                    timestamp = time.perf_counter()
+                                # Skip non-JSON payloads (stream terminators like "[DONE]"), not data chunks.
+                                try:
                                     data = json.loads(chunk)
+                                except json.JSONDecodeError:
+                                    continue
 
-                                    if choices := data.get('choices'):
-                                        if data.get('object') == 'text_completion':
-                                            content = choices[0].get('text') or ''
-                                            has_output = bool(content)
+                                timestamp = time.perf_counter()
+
+                                if choices := data.get('choices'):
+                                    if data.get('object') == 'text_completion':
+                                        content = choices[0].get('text') or ''
+                                        has_output = bool(content)
+                                    else:
+                                        delta = choices[0].get('delta', {})
+                                        content, has_output = _parse_chat_delta(delta)
+                                    if has_output:
+                                        # First token
+                                        if last_output_timestamp is None:
+                                            output.first_chunk_latency = timestamp - st
+
+                                        # Decoding phase
                                         else:
-                                            delta = choices[0].get('delta', {})
-                                            content, has_output = _parse_chat_delta(delta)
-                                        if has_output:
-                                            # First token
-                                            if last_output_timestamp is None:
-                                                output.first_chunk_latency = timestamp - st
-
-                                            # Decoding phase
-                                            else:
-                                                output.inter_chunk_latency.append(timestamp - last_output_timestamp)
-
-                                            last_output_timestamp = timestamp
-
-                                        generated_text += content
-                                        output.response_messages.append(data)
-                                    if usage := data.get('usage'):
-                                        output.prompt_tokens = usage.get('prompt_tokens')
-                                        output.completion_tokens = usage.get('completion_tokens')
-                                        # Extract real cached tokens from prompt_tokens_details
-                                        _details = usage.get('prompt_tokens_details')
-                                        if _details and isinstance(_details, dict):
-                                            _cached = _details.get('cached_tokens')
-                                            if _cached is not None:
-                                                output.real_cached_tokens = _cached
-
-                                    most_recent_timestamp = timestamp
+                                            output.inter_chunk_latency.append(timestamp - last_output_timestamp)
+
+                                        last_output_timestamp = timestamp
+
+                                    generated_text += content
+                                    output.response_messages.append(data)
+                                if usage := data.get('usage'):
+                                    output.prompt_tokens = usage.get('prompt_tokens')
+                                    output.completion_tokens = usage.get('completion_tokens')
+                                    # Extract real cached tokens from prompt_tokens_details
+                                    _details = usage.get('prompt_tokens_details')
+                                    if _details and isinstance(_details, dict):
+                                        _cached = _details.get('cached_tokens')
+                                        if _cached is not None:
+                                            output.real_cached_tokens = _cached
+
+                                most_recent_timestamp = timestamp
 
                         output.generated_text = generated_text
                         output.success = True
```

**File**: `evalscope/perf/plugin/api/openai_responses_api.py` (modified, +8/-2)
```diff
@@ -111,11 +111,14 @@ async def process_request(self, client_session, url: str, headers: Dict, body: D
                             chunk = _extract_sse_data(message)
                             if not chunk:
                                 continue
-                            if chunk == '[DONE]':
+
+                            # Skip non-JSON payloads (stream terminators like "[DONE]"), not data chunks.
+                            try:
+                                payload = json.loads(chunk)
+                            except json.JSONDecodeError:
                                 continue
 
                             timestamp = time.perf_counter()
-                            payload = json.loads(chunk)
                             event_type = payload.get('type')
                             delta = payload.get('delta') or ''
                             if event_type in _DELTA_EVENT_TYPES and delta:
@@ -214,6 +217,9 @@ def _compose_query_from_parameter(self, payload: Dict, param: Arguments) -> Dict
             payload.update(param.extra_args)
         return payload
 
+    def set_request_max_tokens(self, request: Dict, max_tokens: int) -> None:
+        request['max_output_tokens'] = max_tokens
+
     def _count_input_tokens(self, request_str: str) -> int:
         request = json.loads(request_str)
         input_value = request.get('input', '')
```

**File**: `tests/perf/test_multi_turn_max_tokens.py` (added, +99/-0)
```diff
@@ -0,0 +1,99 @@
+# Copyright (c) Alibaba, Inc. and its affiliates.
+"""Per-turn max_tokens must land in each protocol's native field/location.
+
+MultiTurnStrategy._worker routes the per-turn output cap through
+ApiPluginBase.set_request_max_tokens; protocols that do not use a top-level
+``max_tokens`` override it (DashScope nests it, OpenAI Responses renames it).
+"""
+import asyncio
+import json
+from typing import Any, Dict, List, Optional
+
+from evalscope.perf.arguments import Arguments
+from evalscope.perf.core.strategies.multi_turn import MultiTurnStrategy
+from evalscope.perf.plugin.api.dashscope_api import DashScopeApiPlugin
+from evalscope.perf.plugin.api.openai_api import OpenaiPlugin
+from evalscope.perf.plugin.api.openai_responses_api import OpenAIResponsesPlugin
+from evalscope.perf.plugin.datasets.base import Turn
+from evalscope.perf.utils.benchmark_util import BenchmarkData
+
+
+def test_set_request_max_tokens_uses_protocol_native_field() -> None:
+    openai_req: Dict[str, Any] = {}
+    OpenaiPlugin(Arguments(model='m', api='openai')).set_request_max_tokens(openai_req, 42)
+    assert openai_req == {'max_tokens': 42}
+
+    dashscope_req: Dict[str, Any] = {}
+    DashScopeApiPlugin(Arguments(model='m', api='dashscope')).set_request_max_tokens(dashscope_req, 42)
+    assert dashscope_req == {'parameters': {'max_tokens': 42}}
+
+    responses_req: Dict[str, Any] = {}
+    OpenAIResponsesPlugin(Arguments(model='m', api='openai_responses')).set_request_max_tokens(responses_req, 42)
+    assert responses_req == {'max_output_tokens': 42}
+
+
+class _CapPlugin:
+    """Records the per-turn cap and nests it the way DashScope does."""
+
+    def __init__(self) -> None:
+        self.caps: List[int] = []
+
+    def build_request(self, messages: List[Dict[str, Any]]) -> Dict[str, Any]:
+        return {'messages': list(messages), 'stream': True}
+
+    def parse_responses(self, response_messages: List[Any], request: Optional[str] = None) -> tuple[int, int]:
+        return 1, 1
+
+    def set_request_max_tokens(self, request: Dict[str, Any], max_tokens: int) -> None:
+        self.caps.append(max_tokens)
+        request.setdefault('parameters', {})['max_tokens'] = max_tokens
+
+
+class _CapturingClient:
+
+    def __init__(self) -> None:
+        self.requests: List[Dict[str, Any]] = []
+
+    async def post(self, request: Dict[str, Any]) -> BenchmarkData:
+        self.requests.append(dict(request))
+        return BenchmarkData(
+            request=json.dumps(request),
+            start_time=0.0,
+            completed_time=0.0,
+            query_latency=0.0,
+            first_chunk_latency=0.0,
+            success=True,
+            is_stream=True,
+            prompt_tokens=1,
+            completion_tokens=1,
+            generated_text='ok',
+        )
+
+
+def test_worker_routes_per_turn_cap_through_hook() -> None:
+    args = Arguments(model='m', api='openai', number=1, parallel=1, rate=-1, warmup_num=0, multi_turn=True)
+    args.number = 1
+    args.parallel = 1
+    args.rate = -1
+    conversations = [[Turn(messages=[{'role': 'user', 'content': 'hi'}], max_tokens=37)]
+                     for _ in range(args.total_count)]
+
+    plugin = _CapPlugin()
+    client = _CapturingClient()
+
+    async def main() -> None:
+        await MultiTurnStrategy(args, plugin, client, asyncio.Queue(), conversations).run()
+
+    asyncio.run(main())
+
+    assert client.requests, 'no request was dispatched'
+    assert plugin.caps and all(cap == 37 for cap in plugin.caps)
+    sent = client.requests[0]
+    assert sent['parameters']['max_tokens'] == 37
+    assert 'max_tokens' not in sent
+
+
+if __name__ == '__main__':
+    import unittest
+
+    unittest.main(buffer=False)
```

---

### Incident Patch 6: `da8c5f91` (2026-09-29)
**Commit Message**: fix(perf): keep a rerank request successful when the top score is not a number (#1760)

Guard the rerank summary format so a null/non-numeric top score can't fail an HTTP 200 request, and add regression tests.

**File**: `evalscope/perf/plugin/api/openai_rerank_api.py` (modified, +4/-2)
```diff
@@ -204,10 +204,12 @@ async def process_request(self, client_session, url: str, headers: Dict, body: D
                         # Extract rerank results info
                         results = payload.get('results', [])
                         if results:
-                            # Log the top result info
+                            # Log the top result info. The score is server-controlled and may be
+                            # null/non-numeric; guard the format so this line never fails the request.
                             top_result = results[0]
                             score = top_result.get('relevance_score', top_result.get('score', 0))
-                            output.generated_text = f'top_score={score:.4f}, num_results={len(results)}'
+                            score_text = f'{score:.4f}' if isinstance(score, (int, float)) else str(score)
+                            output.generated_text = f'top_score={score_text}, num_results={len(results)}'
 
                         if usage := payload.get('usage'):
                             output.prompt_tokens = usage.get('prompt_tokens') or usage.get('total_tokens', 0)
```

**File**: `tests/perf/test_rerank_process_request.py` (added, +80/-0)
```diff
@@ -0,0 +1,80 @@
+# Copyright (c) Alibaba, Inc. and its affiliates.
+"""Unit tests for ``OpenaiRerankPlugin.process_request``.
+
+The rerank summary line (``top_score=...``) is built inside the same
+``try`` block whose handler marks a request as failed, so a score that
+cannot be formatted with ``:.4f`` used to turn a perfectly good HTTP 200
+into a failed benchmark request.  The score is copied verbatim out of the
+server's JSON and is never validated, so it can be ``null`` or a string.
+"""
+import unittest
+from typing import Any, Dict
+from unittest.mock import AsyncMock, MagicMock
+
+from evalscope.perf.arguments import Arguments
+from evalscope.perf.plugin.api.openai_rerank_api import OpenaiRerankPlugin
+
+
+def _session_returning(payload: Dict[str, Any]) -> MagicMock:
+    """Build a mock aiohttp session whose POST answers HTTP 200 with ``payload``."""
+    response = MagicMock()
+    response.status = 200
+    response.json = AsyncMock(return_value=payload)
+    response.__aenter__.return_value = response
+    client_session = MagicMock()
+    client_session.post.return_value = response
+    return client_session
+
+
+class TestRerankProcessRequest(unittest.IsolatedAsyncioTestCase):
+
+    async def _run(self, payload: Dict[str, Any]) -> Any:
+        plugin = OpenaiRerankPlugin(Arguments(model='test-rerank'))
+        return await plugin.process_request(
+            _session_returning(payload), 'http://localhost/v1/rerank', {}, {'query': 'q', 'documents': ['a']}
+        )
+
+    async def test_numeric_score_is_summarized(self) -> None:
+        """Control case: a normal response keeps its four-decimal summary."""
+        output = await self._run({
+            'results': [{'index': 0, 'relevance_score': 0.8421}, {'index': 1, 'relevance_score': 0.1}],
+            'usage': {'prompt_tokens': 21, 'total_tokens': 21},
+        })
+
+        self.assertTrue(output.success)
+        self.assertEqual(output.generated_text, 'top_score=0.8421, num_results=2')
+        self.assertEqual(output.prompt_tokens, 21)
+
+    async def test_score_key_fallback_is_summarized(self) -> None:
+        """Servers that name the field ``score`` keep the same summary."""
+        output = await self._run({'results': [{'index': 0, 'score': 0.5}], 'usage': {'total_tokens': 12}})
+
+        self.assertTrue(output.success)
+        self.assertEqual(output.generated_text, 'top_score=0.5000, num_results=1')
+
+    async def test_null_score_still_counts_as_a_successful_request(self) -> None:
+        """``relevance_score: null`` must not fail an HTTP 200 request."""
+        payload = {
+            'results': [{'index': 3, 'relevance_score': None}, {'index': 0, 'relevance_score': 0.91}],
+            'usage': {'prompt_tokens': 37, 'total_tokens': 37},
+        }
+
+        output = await self._run(payload)
+
+        self.assertTrue(output.success)
+        self.assertIsNone(output.error)
+        self.assertEqual(output.generated_text, 'top_score=None, num_results=2')
+        self.assertEqual(output.prompt_tokens, 37)
+        self.assertEqual(output.response_messages, [payload])
+
+    async def test_non_numeric_score_still_counts_as_a_successful_request(self) -> None:
+        """A stringified score must not fail an HTTP 200 request either."""
+        output = await self._run({'results': [{'index': 0, 'relevance_score': '0.9312'}]})
+
+        self.assertTrue(output.success)
+        self.assertIsNone(output.error)
+        self.assertEqual(output.generated_text, 'top_score=0.9312, num_results=1')
+
+
+if __name__ == '__main__':
+    unittest.main()
```

---

### Incident Patch 7: `3a2936c0` (2026-09-29)
**Commit Message**: fix(multi-choice): accept spaces between labels in Chinese multi-select answers (#1789)

_PLAIN_LABEL_ZH_RE stopped at the first space, so '答案：A, C' and
'答案：A C' were read as 'A'. The English pattern already allows spaces,
and _label_prefix still trims any prose after the labels.

**File**: `evalscope/utils/multi_choices.py` (modified, +1/-1)
```diff
@@ -163,7 +163,7 @@ def format_example(
 _BRACKETED_LABEL_RE = re.compile(r'[\(\[（【]\s*([A-Za-z\d](?:\s*[,，/、]\s*[A-Za-z\d])*)\s*[\)\]）】]')
 
 _PLAIN_LABEL_RE = re.compile(r'([A-Za-z\d][A-Za-z\d ,/、]*)')
-_PLAIN_LABEL_ZH_RE = re.compile(r'([A-Za-z0-9][A-Za-z0-9,，/、]*)')
+_PLAIN_LABEL_ZH_RE = re.compile(r'([A-Za-z0-9][A-Za-z0-9 ,，/、]*)')
 
 _LABEL_TOKEN_RE = re.compile(r'[A-Za-z\d]+')
 
```

**File**: `tests/test_multi_choices.py` (modified, +14/-0)
```diff
@@ -137,6 +137,20 @@ def test_parse_answers_zh_multiple_correct_slash_and_ideographic_comma() -> None
     assert parse_answers_zh(_make_state('推理过程\n答案：A，C'), multiple_correct=True) == {'A', 'C'}
 
 
+def test_parse_answers_zh_multiple_correct_space_separated() -> None:
+    """A space between labels ('A, C', 'A C') does not end a Chinese multi-select answer.
+
+    The English plain-label pattern already allows spaces; the Chinese one stopped at the
+    first space, so '答案：A, C' was read as 'A' and a correct answer was scored as wrong.
+    """
+    assert parse_answers_zh(_make_state('推理过程\n答案：A, C'), multiple_correct=True) == {'A', 'C'}
+    assert parse_answers_zh(_make_state('推理过程\n答案：A C'), multiple_correct=True) == {'A', 'C'}
+    assert parse_answers_zh(_make_state('推理过程\n答案：A, B, D'), multiple_correct=True) == {'A', 'B', 'D'}
+    # Prose after the labels still ends the answer.
+    assert parse_answers_zh(_make_state('推理过程\n答案：A, C 是正确的'), multiple_correct=True) == {'A', 'C'}
+    assert parse_answers_zh(_make_state('推理过程\n答案：B because C is wrong')) == {'B'}
+
+
 def test_parse_answers_ignores_bracketed_prose() -> None:
     """Only label-shaped bracket contents may be read as an answer."""
     assert parse_answers(_make_state('ANSWER: (see the diagram above)')).isdisjoint(set('ABCD'))
```

---

### Incident Patch 8: `3e9195d4` (2026-09-29)
**Commit Message**: fix(hallusion_bench): align fAcc/qAcc grouping with official evaluation (#1769)

* fix(hallusion_bench): align fAcc/qAcc grouping with official evaluation

The figure-level (fAcc) and question-pair (qAcc) grouping in
`HallusionBenchAdapter.aggregate_scores` deviated from the official
HallusionBench evaluation in two ways, corrupting both metrics on the
default dataset:

1. The grouping key was `f'{subcategory}_{set_id}_{group_id}'`, omitting
   `category`. HallusionBench's two categories (VD/VS) reuse the same
   subcategory/set_id/figure_id/question_id numbering, so distinct
   figures/questions from different categories were merged into one group.
   In the official data (1129 records) this collides 27 figure keys and 26
   question keys across VD/VS (e.g. `ocr_0_0`, `chart_0_1` exist under both).

2. Figure-level accuracy counted VS "no-figure" records (`figure_id == 0`).
   The official eval skips these for fAcc as they carry no figure to
   attribute a group to. The default data has 178 such VS records.

Both diverge from the reference implementation
(https://github.com/tianyi-lab/HallusionBench `utils.py`,
`get_eval_fig` / `get_eval_pair_all`), which key on
`category_subcateg

**File**: `evalscope/benchmarks/hallusion_bench/hallusion_bench_adapter.py` (modified, +13/-3)
```diff
@@ -60,6 +60,7 @@
         aggregation='mean',
         eval_split='image',
         prompt_template='{question}\nPlease answer YES or NO without an explanation.',
+        evaluation_version='v1.1',
     )
 )
 class HallusionBenchAdapter(VisionLanguageAdapter):
@@ -114,13 +115,22 @@ def compute_group_accuracy(scores: List[SampleScore], group_type: str):
             groups = defaultdict(list)
             for ss in scores:
                 md = ss.sample_metadata
+                category = md.get('category')
                 subcategory = md.get('subcategory')
                 set_id = md.get('set_id')
-                group_id = md.get('figure_id') if group_type == 'figure' else md.get('question_id')
-                if subcategory is None or set_id is None or group_id is None:
+                figure_id = md.get('figure_id')
+                group_id = figure_id if group_type == 'figure' else md.get('question_id')
+                if category is None or subcategory is None or set_id is None or group_id is None:
                     # Skip incomplete records for this grouping
                     continue
-                key = f'{subcategory}_{set_id}_{group_id}'
+                # Official HallusionBench excludes VS "no-figure" records (figure_id == 0)
+                # from figure-level accuracy: they carry no figure to attribute a group to.
+                if group_type == 'figure' and str(category) == 'VS' and str(figure_id) == '0':
+                    continue
+                # The grouping key must include category. VD and VS reuse the same
+                # subcategory/set_id/figure_id/question_id numbering, so dropping category
+                # merges distinct figures/questions across categories and corrupts the metric.
+                key = f'{category}_{subcategory}_{set_id}_{group_id}'
                 groups[key].append(ss.score.main_value)
             if not groups:
                 return 0.0, 0
```

**File**: `tests/benchmark/test_hallusion_bench.py` (added, +85/-0)
```diff
@@ -0,0 +1,85 @@
+"""Regression tests for HallusionBench figure/question grouping.
+
+These mirror the official HallusionBench evaluation
+(https://github.com/tianyi-lab/HallusionBench, ``utils.py``):
+
+- The figure-level (``fAcc``) and question-pair (``qAcc``) grouping keys join
+  ``category`` with ``subcategory`` / ``set_id`` / ``figure_id`` / ``question_id``.
+  The two categories (``VD`` / ``VS``) reuse the same
+  subcategory/set_id/figure_id/question_id numbering (e.g. ``ocr_0_0`` and
+  ``chart_0_1`` both appear under VD *and* VS), so dropping ``category`` merges
+  distinct figures/questions across categories.
+- Figure-level accuracy skips VS "no-figure" records (``figure_id == 0``).
+"""
+
+from typing import List
+
+from evalscope.api.metric.scorer import SampleScore, Score
+from evalscope.api.registry import BENCHMARK_REGISTRY
+from evalscope.benchmarks.hallusion_bench.hallusion_bench_adapter import HallusionBenchAdapter
+
+
+def _adapter() -> HallusionBenchAdapter:
+    return HallusionBenchAdapter(benchmark_meta=BENCHMARK_REGISTRY['hallusion_bench'])
+
+
+def _sample_score(category, subcategory, set_id, figure_id, question_id, acc) -> SampleScore:
+    return SampleScore(
+        score=Score(value={'acc': acc}, main_score_name='acc'),
+        sample_metadata={
+            'category': category,
+            'subcategory': subcategory,
+            'set_id': set_id,
+            'figure_id': figure_id,
+            'question_id': question_id,
+        },
+    )
+
+
+def _overall(scores: List[SampleScore]):
+    aggregates = _adapter().aggregate_scores(scores)
+    return {
+        agg.dimensions['target']: (round(agg.score, 4), agg.num)
+        for agg in aggregates
+        if agg.dimensions.get('level') == 'overall'
+    }
+
+
+def test_grouping_key_separates_categories():
+    """VD and VS share figure_id/question_id numbering; they must not be merged.
+
+    Both records here use ``figure_id == '1'`` so the VS "no-figure" skip does not
+    apply, isolating the effect of the ``category`` component of the key. Without
+    ``category`` in the key both rows collapse into a single ``chart_0_1`` group
+    that is neither all-correct (fAcc/qAcc = 0.0); with it they form two groups,
+    one correct (fAcc/qAcc = 0.5).
+    """
+    scores = [
+        _sample_score('VD', 'chart', '0', '1', '1', 1),
+        _sample_score('VS', 'chart', '0', '1', '1', 0),
+    ]
+
+    overall = _overall(scores)
+
+    assert overall['answer'] == (0.5, 2)
+    assert overall['figure'] == (0.5, 2)
+    assert overall['question'] == (0.5, 2)
+
+
+def test_figure_accuracy_skips_vs_no_figure_records():
+    """VS records with ``figure_id == '0'`` carry no figure and are excluded from fAcc.
+
+    They still count toward answer-level (aAcc) and question-level (qAcc) accuracy.
+    """
+    scores = [
+        _sample_score('VD', 'ocr', '0', '1', '0', 1),  # real figure, correct
+        _sample_score('VS', 'ocr', '5', '0', '0', 0),  # no figure (figure_id == 0), wrong
+    ]
+
+    overall = _overall(scores)
+
+    # answer- and question-level accuracy see both records.
+    assert overall['answer'] == (0.5, 2)
+    assert overall['question'] == (0.5, 2)
+    # figure-level accuracy drops the VS no-figure record, leaving one correct figure.
+    assert overall['figure'] == (1.0, 1)
```

---

### Incident Patch 9: `e7c07b36` (2026-09-29)
**Commit Message**: fix(ifbench): guard StopWordPercentageChecker against word-less responses (#1761)

StopWordPercentageChecker.check_following computes
(num_stopwords / num_words) * 100 without checking num_words. A model
response that contains no word tokens (only punctuation, symbols, emoji,
or whitespace, e.g. "...", "---", "😀") makes count_words return 0 and
raises ZeroDivisionError.

In the strict/loose scoring paths the raw response and its markdown- and
line-stripped variants are passed through, and any of these can reduce to
a word-less string. The exception is caught in IFBenchAdapter.match_score
and wipes the whole sample's score to {}, discarding the results of every
other instruction on that prompt and corrupting the aggregate.

Restore the upstream IFBench guard (return False when num_words == 0) and
add regression tests covering punctuation/symbol/emoji/whitespace-only
responses.

**File**: `evalscope/benchmarks/ifbench/instructions.py` (modified, +2/-0)
```diff
@@ -204,6 +204,8 @@ def get_instruction_args_keys(self):
     def check_following(self, value):
         """Checks if the response contains the expected percentage of stop words."""
         num_words = instructions_util.count_words(value)
+        if num_words == 0:
+            return False
         num_stopwords = instructions_util.count_stopwords(value)
         stopword_percentage = (num_stopwords / num_words) * 100
         return stopword_percentage <= self._percentage
```

**File**: `tests/benchmark/test_ifbench_instructions.py` (modified, +30/-0)
```diff
@@ -9,6 +9,7 @@
     PersonNameCountChecker,
     RepeatSpanChecker,
     SentenceAlphabetChecker,
+    StopWordPercentageChecker,
     WordsPositionChecker,
 )
 
@@ -174,3 +175,32 @@ def test_repeat_span_uses_word_indices() -> None:
     assert checker.check_following('The walls are solid but the stones are') is True
     assert checker.check_following('The walls are solid') is False
     assert checker.check_following('The wall') is False
+
+
+@pytest.mark.parametrize(
+    'response',
+    [
+        '...',
+        '!!!',
+        '---',
+        '***',
+        '😀😀😀',
+        '   ',
+    ],
+)
+def test_stop_word_percentage_handles_responses_without_words(response: str) -> None:
+    # Responses that contain no word tokens (punctuation/symbol/emoji/whitespace only)
+    # used to raise ZeroDivisionError from ``num_stopwords / num_words``. Upstream IFBench
+    # guards this by returning False, which we restore here.
+    checker = StopWordPercentageChecker('ratio:stop_words')
+    checker.build_description(percentage=50)
+
+    assert checker.check_following(response) is False
+
+
+def test_stop_word_percentage_still_scores_normal_responses() -> None:
+    checker = StopWordPercentageChecker('ratio:stop_words')
+    checker.build_description(percentage=100)
+
+    # A normal response with words should be scored without raising.
+    assert checker.check_following('The quick brown fox jumps over the lazy dog.') is True
```

---

### Incident Patch 10: `f8353770` (2026-09-29)
**Commit Message**: fix(bbh): keep brackets in free-form targets such as dyck_languages (#1773)

BBHAdapter.record_to_sample strips "(" and ")" from every target, to turn
"(A)" into "A" for the multiple-choice subsets. It also runs on the
free-form subsets, where brackets can be the answer: dyck_languages asks
the model to close a bracket sequence, and 119 of its 250 targets contain
"(" or ")". For those rows the stored target is the answer with its round
brackets deleted:

- ") ]" becomes "]", so the correct answer ") ]" scores 0 and the wrong
  answer "]" scores 1;
- ")" becomes "", which Target drops, so 39 rows get no reference and are
  excluded from scoring.

Strip the brackets only for MULTIPLE_CHOICE_LIST subsets. No other subset
is affected: running the adapter's own record_to_sample and
calculate_metrics over the BBH test rows (SaylorTwift/bbh) with the gold
answer as the completion, all 26 other subsets already score 6261/6261
and still do, while dyck_languages goes from 131 correct / 80 wrong /
39 excluded to 250/250. The wrong answers that scored 1 before (the gold
with its round brackets removed, 70 rows) now score 0.

Raise evaluation_version to v1.1 (AGENTS.md: choice/target mapping
ch

**File**: `evalscope/benchmarks/bbh/bbh_adapter.py` (modified, +4/-1)
```diff
@@ -107,6 +107,7 @@
         train_split=None,
         eval_split='test',
         metric_list=['acc'],
+        evaluation_version='v1.1',
         prompt_template=PROMPT_TEMPLATE,
         few_shot_prompt_template=FEWSHOT_TEMPLATE,
     )
@@ -121,13 +122,15 @@ def __init__(self, **kwargs):
 
     def record_to_sample(self, record: Dict[str, Any]) -> Sample:
         input = record['input']
-        target = record['target'].replace('(', '').replace(')', '').strip()  # Clean up the target answer
+        target = record['target'].strip()
 
         # Determine task type based on subset name
         task_type = None
         subset_name = self.current_subset_name
         if subset_name in MULTIPLE_CHOICE_LIST:
             task_type = MULTIPLE_CHOICE
+            # '(A)' -> 'A'. Free-form targets keep their brackets: in dyck_languages they are the answer.
+            target = target.replace('(', '').replace(')', '').strip()
         elif subset_name in FREE_FORM_LIST:
             task_type = FREE_FORM
 
```

**File**: `tests/benchmark/test_bbh_targets.py` (added, +39/-0)
```diff
@@ -0,0 +1,39 @@
+import pytest
+
+from evalscope.api.registry import BENCHMARK_REGISTRY, get_benchmark
+from evalscope.benchmarks.bbh.bbh_adapter import FREE_FORM, MULTIPLE_CHOICE, BBHAdapter
+
+
+def test_bbh_evaluation_version_reflects_target_change() -> None:
+    metadata = BENCHMARK_REGISTRY['bbh']
+
+    assert metadata.data_adapter is BBHAdapter
+    assert metadata.evaluation_version == 'v1.1'
+
+
+def _sample(subset: str, target: str):
+    adapter = get_benchmark('bbh')
+    adapter.current_subset_name = subset
+    return adapter, adapter.record_to_sample({'input': 'Question?', 'target': target})
+
+
+@pytest.mark.parametrize('target', [') ]', ')', '> ) )', '] ) } >'])
+def test_dyck_target_keeps_its_brackets(target: str) -> None:
+    adapter, sample = _sample('dyck_languages', target)
+
+    assert sample.target == target
+    assert sample.metadata['task_type'] == FREE_FORM
+
+
+def test_dyck_correct_answer_matches_target() -> None:
+    adapter, sample = _sample('dyck_languages', ') ]')
+    extracted = adapter._extract_ff_answer('So we need ")", "]". So the answer is ) ].')
+
+    assert extracted == sample.target
+
+
+def test_multiple_choice_target_is_the_bare_letter() -> None:
+    _, sample = _sample('date_understanding', '(B)')
+
+    assert sample.target == 'B'
+    assert sample.metadata['task_type'] == MULTIPLE_CHOICE
```

---

### Incident Patch 11: `c8dc1277` (2026-09-29)
**Commit Message**: fix(perf): keep unmeasured optional metrics out of the detail float contract (#1790)

build_summary_table pruned the PD-handoff / steady-ITL *columns* when no run
measured them, but _summary_values still emitted those keys with a None value
in every row. PerfSummaryRow.values is Dict[str, float], so validating
/api/v1/perf/detail raised and the endpoint returned 500 for any non-PD run --
the Dashboard "Performance > Detail" page failed to load. The HTML report was
unaffected because it renders by pruned column.

Make the pruned column set the single source of truth: project each row's
values/sample_counts onto the surviving keys, and keep an optional column only
when every run measured it (all instead of any) so a kept column can never
carry a None. An unmeasured metric is now absent everywhere, matching how the
summary JSON writer already omits it.

Fixes #1786

**File**: `evalscope/perf/utils/report/summary.py` (modified, +24/-13)
```diff
@@ -44,6 +44,13 @@
     ('output_token_throughput', 'Gen. tok/s', Metrics.OUTPUT_TOKEN_THROUGHPUT),
 ]
 _SUCCESS_COLUMN = ('success_rate', 'Success Rate', 'success_rate')
+# Optional generation metrics a run reports only when measured: summary attribute
+# -> the (avg, p99) column keys it owns.
+_OPTIONAL_SUMMARY_COLUMNS = {
+    'avg_pd_handoff_latency': ('avg_pd_handoff_latency', 'p99_pd_handoff_latency'),
+    'avg_pd_handoff_overhead': ('avg_pd_handoff_overhead', 'p99_pd_handoff_overhead'),
+    'avg_steady_itl': ('avg_steady_itl', 'p99_steady_itl'),
+}
 
 
 def _cell(field_key: str, value: float, include_unit: bool = False) -> str:
@@ -172,12 +179,10 @@ def build_summary_table(
 ) -> tuple:
     """Build a structured, unformatted cross-run summary table."""
     specs = _summary_specs(is_embedding_flag)
-    if not is_embedding_flag and not any(r.summary.avg_pd_handoff_latency is not None for r in runs):
-        specs = [spec for spec in specs if spec[0] not in ('avg_pd_handoff_latency', 'p99_pd_handoff_latency')]
-    if not is_embedding_flag and not any(r.summary.avg_pd_handoff_overhead is not None for r in runs):
-        specs = [spec for spec in specs if spec[0] not in ('avg_pd_handoff_overhead', 'p99_pd_handoff_overhead')]
-    if not is_embedding_flag and not any(r.summary.avg_steady_itl is not None for r in runs):
-        specs = [spec for spec in specs if spec[0] not in ('avg_steady_itl', 'p99_steady_itl')]
+    if not is_embedding_flag:
+        for attr, keys in _OPTIONAL_SUMMARY_COLUMNS.items():
+            if not all(getattr(r.summary, attr) is not None for r in runs):
+                specs = [spec for spec in specs if spec[0] not in keys]
 
     semantics = resolve_perf_semantics(field_key for _, _, field_key in specs if field_key is not None)
     columns: List[Dict[str, Any]] = [
@@ -188,13 +193,19 @@ def build_summary_table(
         }
         for key, label, field_key in specs
     ]
-    rows = [
-        {
-            'values': _summary_values(run, is_embedding_flag),
-            'sample_counts': _summary_sample_counts(run, request_counts[index] if request_counts else None),
-        }
-        for index, run in enumerate(runs)
-    ]
+    # Columns are the single source of truth: project each row onto the surviving
+    # keys so row keys match columns and no unmeasured metric leaks a None value.
+    kept_keys = {key for key, _, _ in specs}
+    rows = []
+    for index, run in enumerate(runs):
+        values = _summary_values(run, is_embedding_flag)
+        counts = _summary_sample_counts(run, request_counts[index] if request_counts else None)
+        rows.append(
+            {
+                'values': {key: value for key, value in values.items() if key in kept_keys},
+                'sample_counts': {key: count for key, count in counts.items() if key in kept_keys},
+            }
+        )
     return columns, rows
 
 
```

**File**: `tests/perf/test_perf_archive.py` (modified, +51/-2)
```diff
@@ -25,9 +25,16 @@ def _write_json(path: str, obj: object) -> None:
         json.dump(obj, f)
 
 
-def _make_run(run_dir: str, *, with_html: bool, with_tokens: bool = True) -> None:
+def _make_run(
+    run_dir: str,
+    *,
+    with_html: bool,
+    with_tokens: bool = True,
+    with_pd: bool = False,
+    sub_name: str = 'parallel_1_number_2',
+) -> None:
     """Create a minimal perf-run directory with one parallel_* sub-run."""
-    sub = os.path.join(run_dir, 'parallel_1_number_2')
+    sub = os.path.join(run_dir, sub_name)
     summary = {
         'Total Requests': 2,
         'Success Requests': 2,
@@ -37,6 +44,12 @@ def _make_run(run_dir: str, *, with_html: bool, with_tokens: bool = True) -> Non
             'Avg Input Tokens': 10000.0,
             'Avg Output Tokens': 300.0,
         })
+    if with_pd:
+        summary.update({
+            'Avg Steady ITL (ms)': 12.0,
+            'Avg PD Handoff Latency (ms)': 30.0,
+            'Avg PD Handoff Overhead (ms)': 5.0,
+        })
     _write_json(os.path.join(sub, 'benchmark_summary.json'), summary)
     _write_json(os.path.join(sub, 'benchmark_percentile.json'), [])
     _write_json(
@@ -131,12 +144,48 @@ def test_detail_returns_summary_fields(self):
         self.assertEqual(body['summary_rows'][0]['sample_counts']['avg_latency'], self.n_success)
         self.assertEqual(body['summary_rows'][0]['sample_counts']['p99_ttft'], self.n_success)
         self.assertEqual(body['summary_rows'][0]['sample_counts']['success_rate'], self.n_total)
+        # Row values mirror the pruned columns exactly and never carry None for
+        # metrics this non-PD run did not measure.
+        values = body['summary_rows'][0]['values']
+        column_keys = {column['key'] for column in body['summary_columns']}
+        self.assertEqual(set(values), column_keys)
+        self.assertNotIn(None, list(values.values()))
+        self.assertNotIn('avg_pd_handoff_latency', values)
+        self.assertNotIn('avg_steady_itl', values)
         self.assertEqual(body['total_requests'], 2)
         self.assertNotIn('summary_sample_counts', body)
         self.assertNotIn('metric_semantics', body)
         self.assertEqual(body['num_runs'], 1)
         self.assertEqual(body['basic_info']['API Host'], 'dashscope.aliyuncs.com')
 
+    def test_detail_includes_pd_metrics_when_measured(self):
+        pd_rel = os.path.join('20260103_120000', 'pd-model')
+        _make_run(os.path.join(self.tmp, pd_rel), with_html=False, with_pd=True)
+        res = self.client.get('/api/v1/perf/detail', query_string={'root_path': self.tmp, 'path': pd_rel})
+        self.assertEqual(res.status_code, 200)
+        body = res.get_json()
+        column_keys = {column['key'] for column in body['summary_columns']}
+        self.assertIn('avg_pd_handoff_latency', column_keys)
+        values = body['summary_rows'][0]['values']
+        self.assertEqual(values['avg_pd_handoff_latency'], 30.0)
+        self.assertNotIn(None, list(values.values()))
+
+    def test_detail_prunes_pd_column_when_partially_measured(self):
+        # Mixed sweep: one run measured PD handoff, another did not. The column is
+        # dropped for the whole table so no row leaks a None the float contract rejects.
+        mixed_rel = os.path.join('20260104_120000', 'mixed-model')
+        mixed_dir = os.path.join(self.tmp, mixed_rel)
+        _make_run(mixed_dir, with_html=False, with_pd=True, sub_name='parallel_1_number_2')
+        _make_run(mixed_dir, with_html=False, with_pd=False, sub_name='parallel_2_number_4')
+        res = self.client.get('/api/v1/perf/detail', query_string={'root_path': self.tmp, 'path': mixed_rel})
+        self.assertEqual(res.status_code, 200)
+        body = res.get_json()
+        column_keys = {column['key'] for column in body['summary_columns']}
+        self.assertNotIn('avg_pd_handoff_latency', column_keys)
+        for row in body['summary_rows']:
+            self.assertEqual(set(row['values']), column_keys)
+            self.assertNotIn(None, list(row['values'].values()))
+
     def test_history_report_serves_existing_html(self):
         res = self.client.get('/api/v1/perf/history/report', query_string={'root_path': self.tmp, 'path': self.cli_rel})
         self.assertEqual(res.status_code, 200)
```

---

### Incident Patch 12: `5e1a61b9` (2026-09-28)
**Commit Message**: fix(models): preserve provider finish reasons in streamed responses (#1777)

* fix(models): preserve provider finish reasons in streamed responses

Keep unrecognized finish reasons in prediction metadata without treating them as normal stops or token limits.

Fixes https://github.com/modelscope/evalscope/issues/1776

Signed-off-by: 1fanwang <[REDACTED_EMAIL]>

* ci: drop CI Tests Lite workflow edit

Revert ci_test.yaml to base; the regression test remains in the repo.

---------

Signed-off-by: 1fanwang <[REDACTED_EMAIL]>
Co-authored-by: Yunnglin <[REDACTED_EMAIL]>

**File**: `docs/en/get_started/faq.md` (modified, +4/-0)
```diff
@@ -102,6 +102,10 @@ task_config = TaskConfig(
 
 ### Result Anomalies & Troubleshooting
 
+**Q: Why does an OpenAI-compatible response have `stop_reason="unknown"`?**
+
+**A:** Providers can return finish reasons outside OpenAI's standard values, such as MiMo's `repetition_truncation`. EvalScope retains the answer and maps unrecognized reasons to `unknown`, rather than treating them as a normal stop or token limit. Prediction JSONL files preserve these raw strings in `model_output.metadata.finish_reasons`, keyed by the original choice index (for example, `{"0": "repetition_truncation"}`). This applies to both streaming and non-streaming responses.
+
 **Q: How to troubleshoot obviously abnormal evaluation results (like extremely low accuracy)?**
 
 **A:** Please follow these steps:
```

**File**: `docs/zh/get_started/faq.md` (modified, +4/-0)
```diff
@@ -110,6 +110,10 @@ task_config = TaskConfig(
 2.  **查看预测文件**：检查 `outputs/<timestamp>/predictions/` 目录下的 JSONL 文件，确认模型输出是否符合预期。
 3.  **可视化分析**：使用 `evalscope service` 启动可视化界面，直观地查看和分析评测结果。
 
+**Q: 为什么 OpenAI 兼容接口的响应会出现 `stop_reason="unknown"`？**
+
+**A:** 服务商可能返回 OpenAI 标准值以外的结束原因，例如 MiMo 的 `repetition_truncation`。EvalScope 会保留回答，将无法识别的原因映射为 `unknown`，而不是视为正常结束或达到 token 上限。预测 JSONL 文件中的 `model_output.metadata.finish_reasons` 会按原始 choice 索引保存这些字符串，例如 `{"0": "repetition_truncation"}`。流式和非流式响应均适用。
+
 **Q: 评测结果不稳定，两次运行结果不一致怎么办？**
 
 **A:** 结果不一致通常由采样随机性导致。可以尝试以下方法固定结果：
```

**File**: `evalscope/models/utils/openai.py` (modified, +17/-4)
```diff
@@ -3,6 +3,7 @@
 import re
 import time
 from collections import defaultdict
+from collections.abc import AsyncIterable, Iterable
 from copy import copy
 from typing import Any, Dict, List, Literal, Optional, Tuple, Union, cast
 
@@ -69,6 +70,12 @@
 BASE_64_DATA_REMOVED = '<base64-data-removed>'
 
 
+class _ProviderChoice(Choice):
+    """Accept provider finish reasons while retaining the SDK's other choice fields."""
+
+    finish_reason: str
+
+
 class OpenAIResponseError(OpenAIError):
     def __init__(self, code: str, message: str) -> None:
         self.code = code
@@ -643,10 +650,16 @@ def model_output_from_openai(
     completion: ChatCompletion,
     choices: list[ChatCompletionChoice],
 ) -> ModelOutput:
+    finish_reasons: Dict[str, str] = {
+        str(choice.index): choice.finish_reason
+        for choice in completion.choices
+        if choice.finish_reason is not None and as_stop_reason(choice.finish_reason) == 'unknown'
+    }
     return ModelOutput(
         id=completion.id,
         model=completion.model,
         choices=choices,
+        metadata={'finish_reasons': finish_reasons} if finish_reasons else None,
         usage=(
             ModelUsage(
                 input_tokens=completion.usage.prompt_tokens,
@@ -802,7 +815,7 @@ def _parse_content_with_internal(
 
 
 def collect_stream_response(
-    response_stream: List[ChatCompletionChunk],
+    response_stream: Iterable[ChatCompletionChunk],
     request_start: Optional[float] = None,
 ) -> Tuple[ChatCompletion, Optional[float]]:
     """Consume a streaming chat completion and aggregate chunks into a single ChatCompletion.
@@ -919,7 +932,7 @@ def collect_stream_response(
         if tool_calls_list:
             message_kwargs['tool_calls'] = tool_calls_list
 
-        choice = Choice(
+        choice = _ProviderChoice(
             finish_reason=finish_reason or 'stop', index=index, message=ChatCompletionMessage(**message_kwargs)
         )
         choices.append(choice)
@@ -939,7 +952,7 @@ def collect_stream_response(
 
 
 async def async_collect_stream_response(
-    response_stream,
+    response_stream: AsyncIterable[ChatCompletionChunk],
     request_start: Optional[float] = None,
 ) -> Tuple[ChatCompletion, Optional[float]]:
     """Async version of :func:`collect_stream_response`.
@@ -1052,7 +1065,7 @@ async def async_collect_stream_response(
         if tool_calls_list:
             message_kwargs['tool_calls'] = tool_calls_list
 
-        choice = Choice(
+        choice = _ProviderChoice(
             finish_reason=finish_reason or 'stop', index=index, message=ChatCompletionMessage(**message_kwargs)
         )
         choices.append(choice)
```

**File**: `tests/models/test_openai_provider_finish_reason.py` (added, +160/-0)
```diff
@@ -0,0 +1,160 @@
+import asyncio
+import json
+import threading
+from collections.abc import Iterator
+from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
+from pathlib import Path
+
+import pytest
+from pydantic import ValidationError
+
+from evalscope.api.dataset import MemoryDataset, Sample
+from evalscope.api.evaluator.cache import CacheManager
+from evalscope.api.evaluator.state import TaskState
+from evalscope.api.messages import ChatMessageUser, ContentReasoning
+from evalscope.api.model import GenerateConfig, ModelOutput
+from evalscope.models.openai_compatible import OpenAICompatibleAPI
+from evalscope.utils.io_utils import OutputsStructure
+
+
+@pytest.fixture
+def provider_url() -> Iterator[str]:
+    class Provider(BaseHTTPRequestHandler):
+        def do_POST(self) -> None:
+            request = json.loads(self.rfile.read(int(self.headers['Content-Length'])))
+            reason = request['model']
+            choices = [
+                {
+                    'index': 1,
+                    'finish_reason': 123 if reason == 'invalid-reason' else reason,
+                    'message': {'role': 'assistant', 'content': 'second answer', 'reasoning_content': 'second thought'},
+                },
+                {
+                    'index': 'invalid' if reason == 'invalid-index' else 0,
+                    'finish_reason': 'stop',
+                    'message': {'role': 'assistant', 'content': 'first answer', 'reasoning_content': 'first thought'},
+                },
+            ]
+            response = {
+                'id': 'completion-id', 'created': 1, 'model': reason,
+                'object': 'chat.completion', 'choices': choices,
+                'usage': {
+                    'prompt_tokens': 7, 'completion_tokens': 9, 'total_tokens': 16,
+                    'completion_tokens_details': {'reasoning_tokens': 3},
+                },
+            }
+            if request.get('stream'):
+                chunks = [
+                    {
+                        **response, 'object': 'chat.completion.chunk', 'usage': None,
+                        'choices': [
+                            {'index': choice['index'], 'delta': choice['message'], 'finish_reason': None}
+                            for choice in choices
+                        ],
+                    },
+                    {
+                        **response, 'object': 'chat.completion.chunk', 'usage': None,
+                        'choices': [
+                            {'index': choice['index'], 'delta': {}, 'finish_reason': choice['finish_reason']}
+                            for choice in choices
+                        ],
+                    },
+                    {**response, 'object': 'chat.completion.chunk', 'choices': []},
+                ]
+                body = (''.join(f'data: {json.dumps(chunk)}\n\n' for chunk in chunks) + 'data: [DONE]\n\n').encode()
+                content_type = 'text/event-stream'
+            else:
+                body = json.dumps(response).encode()
+                content_type = 'application/json'
+            self.send_response(200)
+            self.send_header('Content-Type', content_type)
+            self.send_header('Content-Length', str(len(body)))
+            self.end_headers()
+            self.wfile.write(body)
+
+        def log_message(self, format: str, *args: object) -> None:
+            pass
+
+    server = ThreadingHTTPServer(server_address=('127.0.0.1', 0), RequestHandlerClass=Provider)
+    worker = threading.Thread(target=server.serve_forever, daemon=True)
+    worker.start()
+    try:
+        yield f'http://127.0.0.1:{server.server_port}/v1'
+    finally:
+        server.shutdown()
+        server.server_close()
+        worker.join()
+
+
+def _generate(*, api: OpenAICompatibleAPI, asynchronous: bool, stream: bool) -> ModelOutput:
+    config = GenerateConfig(stream=stream, retries=0)
+    messages = [ChatMessageUser(content='answer')]
+
+    async def generate_async() -> ModelOutput:
+        try:
+            return await api.generate_async(input=messages, tools=[], tool_choice='none', config=config)
+        finally:
+            await api.aclose()
+
+    try:
+        if asynchronous:
+            return asyncio.run(generate_async())
+        return api.generate(input=messages, tools=[], tool_choice='none', config=config)
+    finally:
+        api.client.close()
+
+
+@pytest.mark.parametrize('asynchronous', [False, True], ids=['sync', 'async'])
+@pytest.mark.parametrize('stream', [True, False], ids=['sse', 'json'])
+@pytest.mark.parametrize('reason,stop_reason', [
+    ('stop', 'stop'),
+    ('length', 'max_tokens'),
+    ('tool_calls', 'tool_calls'),
+    ('content_filter', 'content_filter'),
+    ('function_call', 'tool_calls'),
+    ('repetition_truncation', 'unknown'),
+    ('provider_specific', 'unknown'),
+])
+def test_provider_finish_reason(
+    provider_url: str, tmp_path: Path, asynchronous: bool, stream: bool
```

---

### Incident Patch 13: `5b23aec2` (2026-09-28)
**Commit Message**: fix(benchmarks): match archive members exactly in mvbench/videomme_v2 video lookup (#1752)

* fix(benchmarks): match archive members exactly in mvbench/videomme_v2 video lookup

The find_archive_member helpers in the MVBench and Video-MME-v2 adapters
selected zip members with name.endswith(video_name), so a request for a
video such as 2.mp4 would also match 12.mp4 (and 001.mp4 would match
1001.mp4). Since the result is sorted()[0], a substring-only candidate can
be returned instead of the intended file, feeding the wrong video into the
model.

Match on the full relative path first (equality or a '/'-anchored suffix)
and fall back to basename equality, mirroring the existing tvbench helper.
Add unit tests covering exact match, subset preference, basename fallback,
and the missing-video error path.

* test(benchmarks): clarify synthetic archive fixtures

* fix(mvbench): narrow archive lookup fix to MVBench and add real ssv2 regression

Revert the Video-MME-v2 lookup change: three-digit fixed-length IDs (001-800)
and the matching NNN.zip layout cannot produce a suffix collision, so that half
was purely defensive.

Keep the MVBench basename/exact-path fix, which addresses a real collis

**File**: `evalscope/benchmarks/mvbench/utils.py` (modified, +15/-5)
```diff
@@ -1,3 +1,4 @@
+import os
 import zipfile
 from typing import Any, Dict, Optional
 
@@ -48,12 +49,21 @@ def build_question(record: Dict[str, Any], start: Optional[float], end: Optional
 
 def find_archive_member(archive_path: str, subset: str, video_name: str) -> str:
     normalized_subset = subset.replace('_', '').lower()
+    normalized_video_name = video_name.replace('\\', '/').lstrip('/')
+    video_basename = os.path.basename(normalized_video_name)
     with zipfile.ZipFile(archive_path) as zip_file:
-        matches = [
-            name
-            for name in zip_file.namelist()
-            if not name.endswith('/') and (name.endswith(f'/{video_name}') or name.endswith(video_name))
-        ]
+        member_names = [name for name in zip_file.namelist() if not name.endswith('/')]
+
+    # Prefer members whose relative path matches the requested video exactly, so that
+    # e.g. requesting `1.mp4` does not accidentally match `x1.mp4` or `11.mp4`.
+    matches = [
+        name
+        for name in member_names
+        if name.replace('\\', '/').endswith(f'/{normalized_video_name}')
+        or name.replace('\\', '/') == normalized_video_name
+    ]
+    if not matches:
+        matches = [name for name in member_names if os.path.basename(name.replace('\\', '/')) == video_basename]
     if not matches:
         raise FileNotFoundError(f'Video {video_name} was not found in archive {archive_path}.')
 
```

**File**: `tests/benchmark/test_archive_member_lookup.py` (added, +40/-0)
```diff
@@ -0,0 +1,40 @@
+import zipfile
+
+import pytest
+
+from evalscope.benchmarks.mvbench.utils import find_archive_member as mvbench_find_archive_member
+
+
+def _write_zip(path: str, members: list[str]) -> str:
+    with zipfile.ZipFile(path, 'w') as zip_file:
+        for name in members:
+            zip_file.writestr(name, b'data')
+    return path
+
+
+def test_mvbench_real_ssv2_collision_resolves_correctly(tmp_path):
+    # Real regression from the default `action_antonym` subset (ssv2_video.zip).
+    # Something-Something-v2 ids are non-zero-padded, variable-length numbers, so the archive
+    # legitimately contains both `9741.mp4` and `209741.mp4`. The old suffix lookup matched both
+    # and `sorted(...)[0]` returned `ssv2_video/209741.mp4` (the wrong video). The annotation that
+    # requests `9741.mp4` must resolve to `ssv2_video/9741.mp4`.
+    archive = _write_zip(str(tmp_path / 'ssv2_video.zip'), ['ssv2_video/209741.mp4', 'ssv2_video/9741.mp4'])
+    assert mvbench_find_archive_member(archive, 'action_antonym', '9741.mp4') == 'ssv2_video/9741.mp4'
+
+
+def test_mvbench_prefers_subset_directory(tmp_path):
+    archive = _write_zip(str(tmp_path / 'clevrer.zip'), ['moving_count/v.mp4', 'moving_direction/v.mp4'])
+    assert mvbench_find_archive_member(archive, 'moving_direction', 'v.mp4') == 'moving_direction/v.mp4'
+
+
+def test_mvbench_basename_fallback(tmp_path):
+    # No member matches the full relative path, but the basename is unique, so we fall back to it
+    # while still ignoring substring-only candidates such as `x9741.mp4`.
+    archive = _write_zip(str(tmp_path / 'ssv2_video.zip'), ['other/9741.mp4', 'other/x9741.mp4'])
+    assert mvbench_find_archive_member(archive, 'action_antonym', '9741.mp4') == 'other/9741.mp4'
+
+
+def test_mvbench_missing_video_raises(tmp_path):
+    archive = _write_zip(str(tmp_path / 'ssv2_video.zip'), ['ssv2_video/9741.mp4'])
+    with pytest.raises(FileNotFoundError):
+        mvbench_find_archive_member(archive, 'action_antonym', '999999.mp4')
```

---

### Incident Patch 14: `04081df0` (2026-09-28)
**Commit Message**: fix(alpaca_eval): count a win as 1 and a loss as 0 (#1771)

Since #1601, the AlpacaEval adapter builds each pairwise outcome with
the default weak strength. A weak win scores 0.75 and a weak loss
scores 0.25, so the reported win rate is 0.25 + 0.5 x the true rate.

The AlpacaEval judge picks one output and has no slight preference.
Mark every outcome as strong, so a win counts as 1 and a loss counts
as 0, as it did before #1601. Raise evaluation_version to v1.1
because the score changes.

Co-authored-by: Jiang Wu <[REDACTED_EMAIL]>

**File**: `evalscope/benchmarks/alpaca_eval/alpaca_eval_adapter.py` (modified, +6/-2)
```diff
@@ -103,6 +103,7 @@ class Preference(BaseModel):
         dataset_id='AI-ModelScope/alpaca_eval',
         subset_list=['alpaca_eval_gpt4_baseline'],
         metric_list=['win_rate'],
+        evaluation_version='v1.1',
         few_shot_num=0,
         train_split=None,
         eval_split='eval',
@@ -154,9 +155,12 @@ def request(case, placement, completed_cases, judge_context) -> JudgeRequest:
 
         def reduce(case_verdicts, judge_context) -> ReducedVerdict:
             values = case_verdicts[0].placements or {'original': case_verdicts[0].value}
+            # The AlpacaEval judge picks one output and has no slight preference,
+            # so a win counts as 1 and a loss counts as 0.
             outcomes = {
                 name: PairwisePlacementOutcome(
-                    result='win' if verdict.verdict == ('m' if name == 'swapped' else 'M') else 'loss'
+                    result='win' if verdict.verdict == ('m' if name == 'swapped' else 'M') else 'loss',
+                    strength='strong',
                 )
                 for name, verdict in values.items()
             }
@@ -165,7 +169,7 @@ def reduce(case_verdicts, judge_context) -> ReducedVerdict:
                 if len({item.result for item in outcomes.values()}) == 1
                 else 'tie'
             )
-            outcome = PairwiseOutcome(metric_name='win_rate', result=result, placements=outcomes)
+            outcome = PairwiseOutcome(metric_name='win_rate', result=result, strength='strong', placements=outcomes)
             return ReducedVerdict(value={'win_rate': outcome.score}, outcome=outcome)
 
         return JudgeDefinition.workflow(
```

**File**: `tests/api/judge/test_migrated_adapters.py` (modified, +14/-1)
```diff
@@ -316,11 +316,24 @@ def test_position_swap_on_overrides_alpaca_eval_official_single_pass():
     score = adapter.calculate_metrics(make_state('candidate', 'baseline')).score
 
     assert score.status is ScoreStatus.SUCCESS
-    assert score.value['win_rate'] == 0.75
+    assert score.value['win_rate'] == 1.0
     assert len(score.metadata['judge_attempts']) == 2
     assert score.metadata['non_official_position_swap'] is True
 
 
+@pytest.mark.parametrize(('reply', 'expected'), [('{"verdict": "M"}', 1.0), ('{"verdict": "m"}', 0.0)])
+def test_alpaca_eval_counts_a_win_as_one_and_a_loss_as_zero(reply: str, expected: float) -> None:
+    config = TaskConfig(model='m', datasets=['alpaca_eval'], judge={'strategy': 'llm', 'models': [{'model_id': 'j'}]})
+    adapter = get_benchmark('alpaca_eval', config)
+    adapter.llm_judge = ScriptedJudge([reply])
+
+    score = adapter.calculate_metrics(make_state('candidate', 'baseline')).score
+
+    assert score.status is ScoreStatus.SUCCESS
+    assert score.value['win_rate'] == expected
+    assert len(score.metadata['judge_attempts']) == 1
+
+
 def make_mt_bench_adapter() -> MTBenchAdapter:
     config = TaskConfig(
         model='m',
```

---

### Incident Patch 15: `06b4c67b` (2026-09-21)
**Commit Message**: fix: give logger calls a placeholder for their extra positional arguments (#1757)

* fix: give logger calls a placeholder for their extra positional arguments

Five logger calls pass a value as an extra positional argument without a
%-placeholder in the message, e.g. logger.info('Final dataset size:',
nsamples). The standard logging machinery formats the record with
`msg % args`, which raises TypeError for these calls; logging reports
"--- Logging error ---" on stderr and drops the message. The docmath and
gedit call sites sit on error-handling paths, so exactly the diagnostics
meant to explain a failure were being lost.

* fix: write clip metadata files directly

---------

Co-authored-by: Yunnglin <[REDACTED_EMAIL]>

**File**: `evalscope/backend/rag_eval/clip_benchmark/utils/webdataset_convert.py` (modified, +8/-8)
```diff
@@ -64,7 +64,7 @@ def convert_dataset(
     if hasattr(dataset, 'classes') and dataset.classes:
         classnames_fname = os.path.join(output_folder, 'classnames.txt')
         with open(classnames_fname, 'w') as classnames_file:
-            logger.info(*dataset.classes, sep='\n', end='\n', file=classnames_file)
+            classnames_file.write('\n'.join(str(class_name) for class_name in dataset.classes) + '\n')
         if verbose:
             logger.info("Saved class names to '%s'" % classnames_fname)
     elif verbose:
@@ -73,7 +73,7 @@ def convert_dataset(
     if hasattr(dataset, 'templates') and dataset.templates:
         templates_fname = os.path.join(output_folder, 'zeroshot_classification_templates.txt')
         with open(templates_fname, 'w') as templates_file:
-            logger.info(*dataset.templates, sep='\n', end='\n', file=templates_file)
+            templates_file.write('\n'.join(str(template) for template in dataset.templates) + '\n')
         if verbose:
             logger.info("Saved class names to '%s'" % templates_fname)
     elif verbose:
@@ -82,7 +82,7 @@ def convert_dataset(
     if multilabel:
         type_fname = os.path.join(output_folder, 'dataset_type.txt')
         with open(type_fname, 'w') as type_file:
-            logger.info('multilabel', end='\n', file=type_file)
+            type_file.write('multilabel\n')
             if verbose:
                 logger.info("Saved dataset type to '%s'" % type_fname)
     # Write to TAR files
@@ -118,10 +118,10 @@ def convert_dataset(
     # Save number of shards
     nshards_fname = os.path.join(output_folder, split, 'nshards.txt')
     with open(nshards_fname, 'w') as nshards_file:
-        logger.info(num_shards, end='\n', file=nshards_file)
+        nshards_file.write(f'{num_shards}\n')
     if verbose:
         logger.info("Saved number of shards = %d to '%s'" % (num_shards, nshards_fname))
-    logger.info('Final dataset size:', nsamples)
+    logger.info('Final dataset size: %s', nsamples)
 
 
 def convert_retrieval_dataset(
@@ -162,7 +162,7 @@ def convert_retrieval_dataset(
     # Save dataset type
     type_fname = os.path.join(output_folder, 'dataset_type.txt')
     with open(type_fname, 'w') as type_file:
-        logger.info('retrieval', end='\n', file=type_file)
+        type_file.write('retrieval\n')
     if verbose:
         logger.info("Saved dataset type to '%s'" % type_fname)
     # Write to TAR files
@@ -190,10 +190,10 @@ def convert_retrieval_dataset(
     # Save number of shards
     nshards_fname = os.path.join(output_folder, split, 'nshards.txt')
     with open(nshards_fname, 'w') as nshards_file:
-        logger.info(num_shards, end='\n', file=nshards_file)
+        nshards_file.write(f'{num_shards}\n')
     if verbose:
         logger.info("Saved number of shards = %d to '%s'" % (num_shards, nshards_fname))
-    logger.info('Final dataset size:', nsamples)
+    logger.info('Final dataset size: %s', nsamples)
 
 
 if __name__ == '__main__':
```

**File**: `evalscope/benchmarks/docmath/utils.py` (modified, +1/-1)
```diff
@@ -213,7 +213,7 @@ def get_acc(prediction, gt, answer_type, cot=True):
                 acc = 0
         else:
             acc = 0
-            logger.error('Error: ', prediction, type(prediction))
+            logger.error('Error: %s (%s)', prediction, type(prediction))
         return acc
     except Exception:
         return 0
```

**File**: `evalscope/benchmarks/image_edit/gedit/utils.py` (modified, +2/-2)
```diff
@@ -232,12 +232,12 @@ def mllm_output_to_dict(input_string, give_up_parsing=False):
             if not isinstance(new_data['score'], list):
                 new_data['score'] = [new_data['score']]
         except Exception:
-            logger.info('Now fixing: ', json_str)
+            logger.info('Now fixing: %s', json_str)
             try:
                 new_data = json.loads(fix_json(json_str))
                 return new_data
             except Exception:
-                logger.info('Error: Cannot fix', json_str)
+                logger.info('Error: Cannot fix %s', json_str)
                 return False
         return new_data
     else:
```

**File**: `tests/rag/test_clip_benchmark.py` (modified, +34/-0)
```diff
@@ -2,11 +2,13 @@
 import os
 import subprocess
 import unittest
+from pathlib import Path
 
 import pytest
 
 pytestmark = pytest.mark.timeout(600)
 
+from evalscope.backend.rag_eval.clip_benchmark.utils import webdataset_convert
 from evalscope.run import run_task
 from evalscope.utils.import_utils import is_module_installed
 from evalscope.utils.logger import get_logger
@@ -87,5 +89,37 @@ def test_run_custom(self):
         run_task(task_cfg)
 
 
+def test_webdataset_converter_writes_metadata_files(monkeypatch: pytest.MonkeyPatch, tmp_path: Path) -> None:
+    class DummyShardWriter:
+
+        shard = 1
+
+        def __init__(self, *args: object, **kwargs: object) -> None:
+            pass
+
+        def write(self, sample: object) -> None:
+            pass
+
+        def close(self) -> None:
+            pass
+
+    monkeypatch.setattr(webdataset_convert.torch.utils.data, 'DataLoader', lambda dataset, **_: dataset)
+    monkeypatch.setattr(webdataset_convert.webdataset, 'ShardWriter', DummyShardWriter)
+    monkeypatch.setattr(webdataset_convert, 'tqdm', lambda iterator, **_: iterator)
+
+    dataset = type('Dataset', (list,), {'classes': ['cat', 'dog'], 'templates': ['a photo of a {c}']})([(b'input', 1)])
+    webdataset_convert.convert_dataset(dataset, 'train', str(tmp_path), image_format='bin', multilabel=True)
+
+    assert (tmp_path / 'classnames.txt').read_text() == 'cat\ndog\n'
+    assert (tmp_path / 'zeroshot_classification_templates.txt').read_text() == 'a photo of a {c}\n'
+    assert (tmp_path / 'dataset_type.txt').read_text() == 'multilabel\n'
+    assert (tmp_path / 'train' / 'nshards.txt').read_text() == '1\n'
+
+    webdataset_convert.convert_retrieval_dataset([(b'input', ['caption'])], 'validation', str(tmp_path), image_format='bin')
+
+    assert (tmp_path / 'dataset_type.txt').read_text() == 'retrieval\n'
+    assert (tmp_path / 'validation' / 'nshards.txt').read_text() == '1\n'
+
+
 if __name__ == '__main__':
     unittest.main(buffer=False)
```

#### Recent Merged Pull Requests:
- **PR #1796** (2026-09-30): fix(web): localize version badge tooltip (@git-jxj)
- **PR #1792** (closed): fix(perf): decide SSE stream end by payload shape, not a sentinel literal (@Bruce-Yii)
- **PR #1791** (2026-09-29): fix(perf): tolerate non-JSON SSE terminators; route per-turn max_tokens per protocol (@Yunnglin)
- **PR #1790** (2026-09-29): fix(perf): stop perf/detail 500 for runs without PD metrics (@Yunnglin)
- **PR #1789** (2026-09-29): fix(multi-choice): accept spaces between labels in Chinese multi-select answers (@RizgarOzan)
- **PR #1788** (closed): fix(perf): leave unrecorded optional metrics out of perf detail rows (@RizgarOzan)
- **PR #1787** (closed): feat(perf): per-turn max_tokens and system prompt override for multi-turn benchmarks (@Bruce-Yii)
- **PR #1785** (2026-09-28): feat(math): unify mathematical scoring with Math-Verify (@Yunnglin)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
