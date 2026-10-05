# Forensic Learning Record (Deep Inspection): SynaLinks/synalinks-skills

> **Canonical Artifact**: `07_PROJECT_LEARNING/synalinks-synalinks-skills-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/SynaLinks/synalinks-skills](https://github.com/SynaLinks/synalinks-skills))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-04T20:16:14.796Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `SynaLinks/synalinks-skills`
- **Description**: Coding Agents skills for Synalinks OSS
- **Primary Language / Ecosystem**: Python
- **Discovered Manifests / Configurations**: README.md
- **Stars / Engagement**: 907 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `skills/synalinks/scripts/chain_of_thought.py`
```
#!/usr/bin/env python3
"""Chain-of-thought reasoning program.

Usage:
    uv run -- python scripts/chain_of_thought.py

Run log:
    references/chain_of_thought.log

This script demonstrates:
1. Using ChainOfThought module for step-by-step reasoning
2. Custom DataModel with thinking field
3. return_inputs parameter
"""

import asyncio
import synalinks

synalinks.enable_logging()


class Query(synalinks.DataModel):
    """Input data model."""
    query: str = synalinks.Field(description="The user query")


class ReasonedAnswer(synalinks.DataModel):
    """Output with reasoning."""
    answer: str = synalinks.Field(description="The final answer")


async def main():
    lm = synalinks.LanguageModel(model="ollama/mistral")

    # Method 1: Using ChainOfThought module (auto-adds thinking)
    inputs = synalinks.Input(data_model=Query)
    outputs = await synalinks.ChainOfThought(
        data_model=ReasonedAnswer,
        language_model=lm,
        return_inputs=True,
    )(inputs)

    program = synalinks.Program(
        inputs=inputs,
        outputs=outputs,
        name="chain_of_thought",
        description="Answers questions with step-by-step reasoning",
    )

    # Visualize
    synalinks.utils.plot_program(program, to_folder=".", show_schemas=True)

    # Execute
    result = await program(
        Query(query="If a train travels 120 km in 2 hours, what is its average speed?")
    )
    print(result.prettify_json())


if __name__ == "__main__":
    asyncio.run(main())

```

### Core Architecture Module: `skills/synalinks/scripts/conditional_branches.py`
```
#!/usr/bin/env python3
"""Conditional branching with Decision and Branch modules.

Usage:
    uv run -- python scripts/conditional_branches.py

Run log:
    references/conditional_branches.log

This script demonstrates:
1. Decision module for classification
2. Branch module for conditional routing
3. JSON operators (|) for merging branches
"""

import asyncio
import synalinks

synalinks.enable_logging()


class Query(synalinks.DataModel):
    """Input data model."""
    query: str = synalinks.Field(description="The user query")


class SimpleAnswer(synalinks.DataModel):
    """Short answer for easy questions."""
    answer: str = synalinks.Field(description="A brief, direct answer")


class DetailedAnswer(synalinks.DataModel):
    """Detailed answer with reasoning for hard questions."""
    thinking: str = synalinks.Field(description="Step-by-step reasoning")
    answer: str = synalinks.Field(description="The detailed answer")


async def main():
    lm = synalinks.LanguageModel(model="ollama/mistral")

    inputs = synalinks.Input(data_model=Query)

    # Conditional branching based on question difficulty
    (easy_output, hard_output) = await synalinks.Branch(
        question="Evaluate the difficulty of this query",
        labels=["easy", "difficult"],
        branches=[
            synalinks.Generator(
                data_model=SimpleAnswer,
                language_model=lm,
            ),
            synalinks.Generator(
                data_model=DetailedAnswer,
                language_model=lm,
            ),
        ],
        language_model=lm,
        return_decision=False,
    )(inputs)

    # Merge branches using logical OR
    # Returns whichever branch was taken (other is None)
    outputs = easy_output | hard_output

    program = synalinks.Program(
        inputs=inputs,
        outputs=outputs,
        name="adaptive_qa",
        description="Adapts response complexity to question difficulty",
    )

    # Visualize
    synalinks.utils.plot_program(program, to_folder=".", show_schemas=True)

    # Test with easy question
    print("=== Easy Question ===")
    result1 = await program(Query(query="What color is the sky?"))
    print(result1.prettify_json())

    # Test with hard question
    print("\n=== Hard Question ===")
    result2 = await program(
        Query(query="Explain the implications of quantum entanglement for cryptography")
    )
    print(result2.prettify_json())

if __name__ == "__main__":
    asyncio.run(main())
```

### Core Architecture Module: `skills/synalinks/scripts/custom_dataset.py`
```
#!/usr/bin/env python3
"""Custom iterable dataset (Synalinks v0.8.004+).

Usage:
    uv run -- python scripts/custom_dataset.py

Run log:
    references/custom_dataset.log

Demonstrates passing a custom iterable (with optional __len__) directly to
program.fit(). Useful for streaming from files, databases, or APIs without
materializing the entire dataset in memory.

Key detail (Keras-style semantics): a custom iterable yields *batches*, not
individual examples. Each yield is a `(x_batch, y_batch)` tuple whose leaves are
arrays/lists of DataModel instances — the iterable controls its own batching, so
`fit(batch_size=...)` is ignored for iterables. `__len__` returns the number of
*batches* (enables the progress bar). Yielding a single DataModel per step fails
with "iteration over a 0-d array".
"""

import asyncio
import json
from pathlib import Path

import numpy as np
import synalinks


class Question(synalinks.DataModel):
    question: str = synalinks.Field(description="A question")


class Answer(synalinks.DataModel):
    answer: str = synalinks.Field(description="Final answer")


class JSONLDataset:
    """Stream batches of (Question, Answer) from a JSONL file.

    Each iteration yields a `(x_batch, y_batch)` tuple of NumPy object arrays of
    DataModels — i.e. the dataset batches itself.
    """

    def __init__(self, path: str, batch_size: int = 1):
        self.path = Path(path)
        self.batch_size = batch_size

    def _rows(self):
        with self.path.open() as f:
            for line in f:
                row = json.loads(line)
                yield Question(question=row["q"]), Answer(answer=row["a"])

    def __iter__(self):
        xs, ys = [], []
        for q, a in self._rows():
            xs.append(q)
            ys.append(a)
            if len(xs) == self.batch_size:
                yield np.array(xs, dtype="object"), np.array(ys, dtype="object")
                xs, ys = [], []
        if xs:  # trailing partial batch
            yield np.array(xs, dtype="object"), np.array(ys, dtype="object")

    def __len__(self):
        # Optional, but enables the fit/evaluate progress bar. Returns the number
        # of *batches* (not examples). It does NOT enable validation_split —
        # that arg only works with NumPy arrays.
        n = sum(1 for _ in self._rows())
        return (n + self.batch_size - 1) // self.batch_size


async def main():
    lm = synalinks.LanguageModel(model="ollama/mistral")

    inputs = synalinks.Input(data_model=Question)
    outputs = await synalinks.Generator(data_model=Answer, language_model=lm)(inputs)
    program = synalinks.Program(inputs=inputs, outputs=outputs, name="custom_data")

    program.compile(
        reward=synalinks.rewards.ExactMatch(in_mask=["answer"]),
        optimizer=synalinks.optimizers.RandomFewShot(),
    )

    # Write a tiny JSONL file for the demo
    demo = Path("demo.jsonl")
    demo.write_text(
        "\n".join([
            json.dumps({"q": "What is 2+2?", "a": "4"}),
            json.dumps({"q": "Capital of France?", "a": "Paris"}),
            json.dumps({"q": "Who wrote Hamlet?", "a": "William Shakespeare"}),
        ])
    )

    dataset = JSONLDataset("demo.jsonl", batch_size=1)
    print(f"Dataset has {len(dataset)} batches")

    # NOTE: `validation_split` (which defaults to 0.1) is only supported for
    # NumPy arrays, so with a custom iterable you MUST instead pass an explicit
    # `validation_data=(x_val, y_val)`. fit() always runs validation, and the
    # validation set is fancy-indexed, so x_val/y_val must be NumPy arrays of
    # DataModels (the training data can still be a streaming iterable).
    x_val = np.array([Question(question="What is 3 + 1?")], dtype="object")
    y_val = np.array([Answer(answer="4")], dtype="object")

    # epochs=1: synalinks consumes the iterable once (it calls iter(x) a single
    # time), so a streaming dataset is a single-pass-per-fit source. For multiple
    # epochs over a finite set, materialize it into NumPy arrays instead.
    history = await program.fit(
        x=dataset,           # custom iterable yielding (x_batch, y_batch) tuples
        validation_data=(x_val, y_val),
        epochs=1,            # batch_size is ignored for iterables (dataset batches itself)
    )
    synalinks.utils.plot_history(history, to_folder=".")


if __name__ == "__main__":
    asyncio.run(main())

```

### Core Architecture Module: `skills/synalinks/scripts/custom_module.py`
```
#!/usr/bin/env python3
"""Creating a custom module via subclassing.

Usage:
    uv run -- python scripts/custom_module.py

Run log:
    references/custom_module.log

This script demonstrates:
1. Subclassing synalinks.Module
2. Implementing call() and compute_output_spec()
3. Serialization with get_config() and from_config()
4. Composing custom modules in programs

Note: Module subclasses use get_config() (NOT to_config()) — same name as
Program. Generator uses keyword-only args.
"""

import asyncio
import synalinks

synalinks.enable_logging()


class Query(synalinks.DataModel):
    """Input data model."""
    query: str = synalinks.Field(description="The user query")


class Analysis(synalinks.DataModel):
    """Analysis output."""
    category: str = synalinks.Field(description="Query category")
    complexity: str = synalinks.Field(description="Complexity level")
    suggested_approach: str = synalinks.Field(description="Recommended approach")


class FinalAnswer(synalinks.DataModel):
    """Final answer."""
    answer: str = synalinks.Field(description="The answer")


@synalinks.saving.register_synalinks_serializable()
class QueryAnalyzer(synalinks.Module):
    """Custom module that analyzes queries before answering.

    This module:
    1. Analyzes the query to determine category and complexity
    2. Generates a tailored response based on the analysis
    """

    def __init__(
        self,
        language_model=None,
        return_inputs=True,
        name=None,
        description=None,
        trainable=True,
    ):
        super().__init__(
            name=name or "query_analyzer",
            description=description or "Analyzes queries and generates tailored responses",
            trainable=trainable,
        )
        self.language_model = language_model
        self.return_inputs = return_inputs

        # Sub-modules
        # Note: instructions must be a string, not a list
        self.analyzer = synalinks.Generator(
            data_model=Analysis,
            language_model=language_model,
            instructions="Analyze the query to determine its category (factual, opinion, creative, technical). Assess complexity (simple, moderate, complex). Suggest the best approach to answer.",
            return_inputs=True,
        )

        self.responder = synalinks.Generator(
            data_model=FinalAnswer,
            language_model=language_model,
            instructions="Generate an answer based on the analysis. Adapt response style to the identified category and complexity.",
            return_inputs=return_inputs,
        )

    async def call(self, inputs, training=False):
        """Core computation: analyze then respond."""
        if not inputs:
            return None  # Support logical flows

        # Step 1: Analyze the query
        analysis = await self.analyzer(inputs, training=training)

        # Step 2: Generate response based on analysis
        response = await self.responder(analysis, training=training)

        return response

    async def compute_output_spec(self, inputs, training=False):
        """Define output schema."""
        analysis = await self.analyzer(inputs)
        return await self.responder(analysis)

    def get_config(self):
        """Serialization config for Module subclasses (same as Program)."""
        return {
            "return_inputs": self.return_inputs,
            "name": self.name,
            "description": self.description,
            "trainable": self.trainable,
            "language_model": synalinks.saving.serialize_synalinks_object(
                self.language_model
            ),
        }

    @classmethod
    def from_config(cls, config):
        """Deserialization."""
        lm = synalinks.saving.deserialize_synalinks_object(
            config.pop("language_model")
        )
        return cls(language_model=lm, **config)


async def main():
    lm = synalinks.LanguageModel(model="ollama/mistral")

    # Use custom module in a program
    inputs = synalinks.Input(data_model=Query)
    outputs = await QueryAnalyzer(
        language_model=lm,
        return_inputs=True,
    )(inputs)

    program = synalinks.Program(
        inputs=inputs,
        outputs=outputs,
        name="smart_qa",
        description="Analyzes queries before answering",
    )

    # Visualize
    synalinks.utils.plot_program(
        program,
        to_folder=".",
        show_module_names=True,
        show_schemas=True,
        show_trainable=True,
    )

    # Test
    print("=== Factual Question ===")
    result1 = await program(Query(query="What is the capital of Japan?"))
    print(result1.prettify_json())

    print("\n=== Complex Question ===")
    result2 = await program(
        Query(query="How does machine learning differ from traditional programming?")
    )
    print(result2.prettify_json())

    # Save and reload
    program.save("smart_qa.json")
    loaded = synalinks.Program.load("smart_qa.json")
    print("\nProgram saved and reloaded successfully!")


if __name__ == "__main__":
    asyncio.run(main())

```

### Core Architecture Module: `skills/synalinks/scripts/custom_reward.py`
```
#!/usr/bin/env python3
"""Custom reward function example.

Usage:
    uv run -- python scripts/custom_reward.py

Run log:
    references/custom_reward.log

Demonstrates:
1. Writing an async reward with @register_synalinks_serializable
2. Wrapping with RewardFunctionWrapper
3. Combining multiple criteria into one reward
4. Mixing built-in rewards with custom metrics
"""

import asyncio
import numpy as np
import synalinks

synalinks.enable_logging()


class Question(synalinks.DataModel):
    question: str = synalinks.Field(description="A question")


class Answer(synalinks.DataModel):
    # ChainOfThought prepends its own `thinking` field, so we only
    # declare the final answer here.
    answer: str = synalinks.Field(description="Final answer")


@synalinks.saving.register_synalinks_serializable()
async def correctness_with_reasoning(y_true, y_pred):
    """Combine exact answer match with a small bonus for showing reasoning."""
    if not y_true or not y_pred:
        return 0.0

    correct = float(y_true.get("answer") == y_pred.get("answer"))
    has_reasoning = float(bool((y_pred.get("thinking") or "").strip()))

    return 0.8 * correct + 0.2 * has_reasoning


@synalinks.saving.register_synalinks_serializable()
async def thinking_length(y_true, y_pred):
    """Metric: average thinking length normalized to [0, 1] using a 200-char ceiling."""
    if not y_pred:
        return 0.0
    thinking = y_pred.get("thinking") or ""
    return min(len(thinking) / 200.0, 1.0)


async def main():
    lm = synalinks.LanguageModel(model="ollama/mistral")

    inputs = synalinks.Input(data_model=Question)
    outputs = await synalinks.ChainOfThought(
        data_model=Answer,
        language_model=lm,
    )(inputs)
    program = synalinks.Program(inputs=inputs, outputs=outputs, name="reward_demo")

    program.compile(
        reward=synalinks.rewards.RewardFunctionWrapper(fn=correctness_with_reasoning),
        optimizer=synalinks.optimizers.RandomFewShot(),
        metrics=[
            synalinks.metrics.MeanMetricWrapper(fn=thinking_length),
            synalinks.metrics.F1Score(in_mask=["answer"]),
        ],
    )

    x = np.array([
        Question(question="What is 5 + 3?"),
        Question(question="Capital of France?"),
    ], dtype="object")

    y = np.array([
        Answer(answer="8"),
        Answer(answer="Paris"),
    ], dtype="object")

    metrics = await program.evaluate(x=x, y=y, batch_size=2)
    print("Metrics:", metrics)


if __name__ == "__main__":
    asyncio.run(main())

```

### Core Architecture Module: `skills/synalinks/scripts/decision_model.py`
```
#!/usr/bin/env python3
"""Decision models example.

Usage:
    TYPESAFE_API_KEY=... uv run -- python scripts/decision_model.py

Run log:
    none captured (needs a TypeSafe API key).

Demonstrates:
1. A DecisionModel answering a data model of questions (bool, Literal, Rating)
2. Decision with min_confidence: abstains (returns None) when unsure
3. Branch routed by a decision model, branches written by a language model
4. RubricsAsJudge grading weighted criteria in one decision model call
"""

import asyncio
from typing import Literal

import synalinks

synalinks.enable_logging()


class Ticket(synalinks.DataModel):
    message: str = synalinks.Field(description="The customer message")


class Triage(synalinks.DataModel):
    is_billing: bool = synalinks.Field(description="Is the ticket about billing?")
    urgency: Literal["low", "medium", "high"] = synalinks.Field(
        description="How urgent is the ticket?",
    )
    frustration: synalinks.Rating = synalinks.Field(
        description="How frustrated is the customer, from 1 (calm) to 5 (angry)?",
    )


class Reply(synalinks.DataModel):
    reply: str = synalinks.Field(description="The reply to the customer")


async def main():
    # Reads TYPESAFE_API_KEY from the environment.
    decision_model = synalinks.DecisionModel(model="typesafe/jev-latest")
    language_model = synalinks.LanguageModel(model="ollama/mistral")

    ticket = Ticket(message="I was charged twice for my order. Fix this today!")

    # 1. Every field is a question, answered in one call.
    inputs = synalinks.Input(data_model=Ticket)
    outputs = await synalinks.Generator(
        data_model=Triage,
        decision_model=decision_model,
        instructions="Triage the support tickets of an online shop.",
    )(inputs)
    triage = synalinks.Program(inputs=inputs, outputs=outputs, name="triage")
    result = await triage(ticket)
    print(result.prettify_json() if result else "Triage failed")

    # 2. A decision the model is not sure enough about is not taken.
    inputs = synalinks.Input(data_model=Ticket)
    outputs = await synalinks.Decision(
        question="Which team should handle the ticket?",
        labels=["billing", "technical", "sales"],
        decision_model=decision_model,
        min_confidence=0.7,
    )(inputs)
    router = synalinks.Program(inputs=inputs, outputs=outputs, name="team")
    result = await router(ticket)
    print(result.prettify_json() if result else "Not sure enough: escalate to a human")

    # 3. Route cheap, write expensive: the decision model picks the branch,
    # the branches keep their language model.
    inputs = synalinks.Input(data_model=Ticket)
    (billing, technical) = await synalinks.Branch(
        question="Which team should handle the ticket?",
        labels=["billing", "technical"],
        branches=[
            synalinks.Generator(
                data_model=Reply,
                language_model=language_model,
                instructions="Reply as the billing team.",
            ),
            synalinks.Generator(
                data_model=Reply,
                language_model=language_model,
                instructions="Reply as the technical support team.",
            ),
        ],
        decision_model=decision_model,
        return_decision=False,
    )(inputs)
    support = synalinks.Program(
        inputs=inputs, outputs=billing | technical, name="support"
    )
    result = await support(ticket)
    print(result.prettify_json() if result else "No branch selected")

    # 4. Grade weighted criteria in a single decision model call.
    reward = synalinks.rewards.RubricsAsJudge(
        rubrics=[
            {"name": "polite", "description": "The reply is polite.", "weight": 1},
            {
                "name": "actionable",
                "description": "The reply says what happens next.",
                "weight": 2,
            },
        ],
        decision_model=decision_model,
    )
    grades = await reward.program(
        [None, Reply(reply="Sorry! We refunded the duplicate charge today.")]
    )
    print(grades.prettify_json())


if __name__ == "__main__":
    asyncio.run(main())

```

### Core Architecture Module: `skills/synalinks/scripts/deep_agent.py`
```
#!/usr/bin/env python3
"""Minimal DeepAgent example.

Usage:
    PYTHONPATH=<repo-root> uv run python scripts/deep_agent.py

Run log:
    references/deep_agent.log

This script demonstrates:
1. synalinks.DeepAgent mounting a temp workdir in a Mirage sandbox.
2. Filesystem + shell tools (list_files / read_file / ...) over a seeded dir.
3. Inspecting sandbox changes via agent.sandbox.diff() at the end.

The workdir is seeded into a copy-on-write sandbox; the real directory on
disk is never modified.
"""

import asyncio
import shutil
import tempfile
from pathlib import Path

import synalinks

synalinks.enable_logging()

UTILS_SOURCE = '''\
"""Small string utilities."""


def slugify(text):
    """Lowercase a string and replace spaces with hyphens."""
    return text.strip().lower().replace(" ", "-")


def shout(text):
    """Return the text uppercased with an exclamation mark."""
    return text.upper() + "!"
'''


async def main():
    lm = synalinks.LanguageModel(model="ollama/qwen3:8b")

    workdir = tempfile.mkdtemp(prefix="deep_agent_")
    try:
        (Path(workdir) / "utils.py").write_text(UTILS_SOURCE)

        # Keep a reference to the DeepAgent module itself — the sandbox lives
        # on the module instance, not on the wrapping Program.
        deep_agent = synalinks.DeepAgent(
            workdir=workdir,
            language_model=lm,
            max_iterations=8,
            timeout=30,
        )

        inputs = synalinks.Input(data_model=synalinks.ChatMessages)
        outputs = await deep_agent(inputs)

        agent = synalinks.Program(
            inputs=inputs,
            outputs=outputs,
            name="deep_agent_demo",
            description="Inspects a small workdir",
        )

        messages = synalinks.ChatMessages(
            messages=[
                synalinks.ChatMessage(
                    role="user",
                    content="List the files and summarize what utils.py does.",
                ),
            ]
        )

        print("=== DeepAgent ===")
        result = await agent(messages)
        print(result.get("messages")[-1].get("content"))

        print("\n=== Sandbox diff ===")
        print(deep_agent.sandbox.diff())
    finally:
        shutil.rmtree(workdir, ignore_errors=True)


if __name__ == "__main__":
    asyncio.run(main())

```

### Core Architecture Module: `skills/synalinks/scripts/four_apis.py`
```
#!/usr/bin/env python3
"""Four ways to build a Synalinks Program.

Usage:
    uv run -- python scripts/four_apis.py

Run log:
    references/four_apis.log

Demonstrates:
1. Functional API
2. Sequential API
3. Subclassing (with explicit get_config/from_config)
4. Mixed (Subclassing + Functional via build())

All four programs answer the same Q&A task so the differences are purely
structural.
"""

import asyncio

import synalinks

synalinks.enable_logging()


class Query(synalinks.DataModel):
    query: str = synalinks.Field(description="The user query")


class Answer(synalinks.DataModel):
    answer: str = synalinks.Field(description="The answer to the query")


# --- 1. Functional API -------------------------------------------------------


def build_functional(language_model):
    inputs = synalinks.Input(data_model=Query)
    outputs = synalinks.Generator(
        data_model=Answer,
        language_model=language_model,
    )
    # In a real async context you'd `await` the call. For construction-only
    # examples we build the program inside an async wrapper below.
    return inputs, outputs


async def make_functional(language_model):
    inputs = synalinks.Input(data_model=Query)
    outputs = await synalinks.Generator(
        data_model=Answer, language_model=language_model,
    )(inputs)
    return synalinks.Program(
        inputs=inputs,
        outputs=outputs,
        name="functional_qa",
        description="Q&A built with the Functional API",
    )


# --- 2. Sequential API -------------------------------------------------------


def make_sequential(language_model):
    return synalinks.Sequential(
        [
            synalinks.Input(data_model=Query),
            synalinks.Generator(
                data_model=Answer, language_model=language_model,
            ),
        ],
        name="sequential_qa",
        description="Q&A built with the Sequential API",
    )


# --- 3. Subclassing ----------------------------------------------------------


@synalinks.saving.register_synalinks_serializable()
class SubclassedQA(synalinks.Program):
    """Q&A built by subclassing Program with a custom call()."""

    def __init__(
        self,
        language_model=None,
        name=None,
        description=None,
        trainable=True,
    ):
        super().__init__(name=name, description=description, trainable=trainable)
        self.language_model = language_model
        self.gen = synalinks.Generator(
            data_model=Answer, language_model=language_model,
        )

    async def call(self, inputs, training=False):
        return await self.gen(inputs, training=training)

    def get_config(self):
        return {
            "language_model": synalinks.saving.serialize_synalinks_object(
                self.language_model
            ),
            "name": self.name,
            "description": self.description,
            "trainable": self.trainable,
        }

    @classmethod
    def from_config(cls, config):
        lm = synalinks.saving.deserialize_synalinks_object(
            config.pop("language_model")
        )
        return cls(language_model=lm, **config)


# --- 4. Mixed (Subclassing + Functional) -------------------------------------


@synalinks.saving.register_synalinks_serializable()
class FunctionalQA(synalinks.Program):
    """Q&A built with the Mixed pattern — Functional graph behind a class API."""

    def __init__(
        self,
        language_model=None,
        name=None,
        description=None,
        trainable=True,
    ):
        # First super().__init__() — basic init only.
        super().__init__(name=name, description=description, trainable=trainable)
        self.language_model = language_model

    async def build(self, inputs):
        outputs = await synalinks.Generator(
            data_model=Answer, language_model=self.language_model,
        )(inputs)
        # Second super().__init__() — re-init with the graph.
        super().__init__(
            inputs=inputs,
            outputs=outputs,
            name=self.name,
            description=self.description,
            trainable=self.trainable,
        )


async def make_mixed(language_model):
    # The Mixed pattern's `build()` runs on the FIRST call and re-inits the
    # program from `inputs`/`outputs`. That second `super().__init__()` requires
    # SymbolicDataModels, so the program must first be materialized by calling it
    # on a symbolic `Input` (NOT on concrete data). After this, the graph exists
    # and the program can be called with real data like any Functional program.
    mixed = FunctionalQA(
        language_model=language_model,
        name="mixed_qa",
        description="Q&A built with the Mixed pattern",
    )
    await mixed(synalinks.Input(data_model=Query))
    return mixed


async def main():
    lm = synalinks.LanguageModel(model="ollama/mistral")

    programs = {
        "functional": await make_functional(lm),
        "sequential": make_sequential(lm),
        "subclassed": SubclassedQA(
            language_model=lm,
            name="subclassed_qa",
            description="Q&A built by subclassing Program",
        ),
        "mixed": await make_mixed(lm),
    }

    q = Query(query="What is the capital of France?")
    for label, program in programs.items():
        result = await program(q)
        print(f"[{label}] {result.prettify_json() if result else 'No result'}")


if __name__ == "__main__":
    asyncio.run(main())

```

### Core Architecture Module: `skills/synalinks/scripts/guard_patterns.py`
```
#!/usr/bin/env python3
"""Input and Output Guard patterns using XOR operator.

Usage:
    uv run -- python scripts/guard_patterns.py

Run log:
    references/guard_patterns.log

This script demonstrates:
1. Input guards to block invalid requests
2. Output guards to filter unsafe responses
3. XOR (^) operator for computation bypass
4. OR (|) operator for result merging
"""

import asyncio
import synalinks

synalinks.enable_logging()


class ConversationalInputGuard(synalinks.Module):
    """Input guard that blocks messages containing blacklisted words."""

    def __init__(
        self,
        blacklisted_words=None,
        warning_message="I'm unable to comply with your request",
        **kwargs,
    ):
        super().__init__(**kwargs)
        self.blacklisted_words = blacklisted_words or []
        self.warning_message = warning_message

    async def call(self, inputs, training=False):
        """Return warning message if blocked, None otherwise."""
        if not synalinks.is_chat_messages(inputs):
            raise ValueError("Input guard works only for ChatMessages")

        if not inputs or not inputs["messages"]:
            return None

        content = inputs["messages"][-1]["content"]
        content_lower = content.lower()

        if any(bw.lower() in content_lower for bw in self.blacklisted_words):
            return synalinks.ChatMessage(
                role="assistant",
                content=self.warning_message,
            )
        return None

    async def compute_output_spec(self, inputs, training=False):
        """Define output schema."""
        if not synalinks.is_chat_messages(inputs):
            raise ValueError("Input guard works only for ChatMessages")
        return synalinks.ChatMessage.to_symbolic_data_model(name=self.name)

    def get_config(self):
        """Serialization config for Module subclasses."""
        return {
            "name": self.name,
            "description": self.description,
            "blacklisted_words": self.blacklisted_words,
            "warning_message": self.warning_message,
        }


class ConversationalOutputGuard(synalinks.Module):
    """Output guard that replaces responses containing blacklisted words."""

    def __init__(
        self,
        blacklisted_words=None,
        warning_message="I'm unable to comply with your request",
        **kwargs,
    ):
        super().__init__(**kwargs)
        self.blacklisted_words = blacklisted_words or []
        self.warning_message = warning_message

    async def call(self, inputs, training=False):
        """Return warning message if output should be blocked, None otherwise."""
        if not synalinks.is_chat_message(inputs):
            raise ValueError("Output guard works only for ChatMessage")

        if not inputs:
            return None

        content = inputs["content"]
        content_lower = content.lower()

        if any(bw.lower() in content_lower for bw in self.blacklisted_words):
            return synalinks.ChatMessage(
                role="assistant",
                content=self.warning_message,
            )
        return None

    async def compute_output_spec(self, inputs, training=False):
        """Define output schema."""
        if not synalinks.is_chat_message(inputs):
            raise ValueError("Output guard works only for ChatMessage")
        return synalinks.ChatMessage.to_symbolic_data_model(name=self.name)

    def get_config(self):
        """Serialization config for Module subclasses."""
        return {
            "name": self.name,
            "description": self.description,
            "blacklisted_words": self.blacklisted_words,
            "warning_message": self.warning_message,
        }


async def build_input_guarded_program(language_model):
    """Build a chatbot with input guard.

    Logic flow:
    1. Check input for blacklisted words
    2. If warning exists: XOR makes inputs None, bypassing generator
    3. Return warning (if blocked) OR answer (if allowed)
    """
    inputs = synalinks.Input(data_model=synalinks.ChatMessages)

    # Check input
    warning_msg = await ConversationalInputGuard(
        blacklisted_words=["forbidden", "blocked"],
    )(inputs)

    # XOR: if warning exists, inputs becomes None (bypassing generator)
    guarded_inputs = warning_msg ^ inputs

    # Generator only runs if guarded_inputs is not None
    answer = await synalinks.Generator(
        language_model=language_model,
    )(guarded_inputs)

    # OR: return warning if it exists, otherwise return answer
    outputs = warning_msg | answer

    return synalinks.Program(
        inputs=inputs,
        outputs=outputs,
        name="input_guarded_chatbot",
        description="A chatbot with input guard",
    )


async def build_output_guarded_program(language_model):
    """Build a chatbot with output guard.

    Logic flow:
    1. Generate response
    2. Check output for blacklisted words
    3. XOR + OR: if warning exists, replace answer with warning
    """
    inputs = synalinks.Input(data_model=synalinks.ChatMessages)

    answer = await synalinks.Generator(
        language_model=language_model,
    )(inputs)

    # Check output
    warning_msg = await ConversationalOutputGuard(
        blacklisted_words=["corn", "dangerous"],
    )(answer)

    # XOR + OR: if warning exists, replace answer with warning
    outputs = (answer ^ warning_msg) | warning_msg

    return synalinks.Program(
        inputs=inputs,
        outputs=outputs,
        name="output_guarded_chatbot",
        description="A chatbot with output guard",
    )


async def main():
    lm = synalinks.LanguageModel(model="ollama/mistral")

    # Test input guard
    print("=== Input Guard Demo ===")
    input_program = await build_input_guarded_program(lm)
    synalinks.utils.plot_program(input_program, to_folder=".")

    # Blocked input
    result1 = await input_program(
        synalinks.ChatMessages(
            messages=[{"role": "user", "content": "Tell me about forbidden topics"}]
        )
    )
    print(f"Blocked input result: {result1.prettify_json()}")

    # Allowed input
    result2 = await input_program(
        synalinks.ChatMessages(
            messages=[{"role": "user", "content": "What is the capital of France?"}]
        )
    )
    print(f"Allowed input result: {result2.prettify_json()}")

    # Test output guard
    print("\n=== Output Guard Demo ===")
    output_program = await build_output_guarded_program(lm)

    result3 = await output_program(
        synalinks.ChatMessages(
            messages=[{"role": "user", "content": "Tell me a story about corn"}]
        )
    )
    print(f"Output guard result: {result3.prettify_json()}")


if __name__ == "__main__":
    asyncio.run(main())

```

### Core Architecture Module: `skills/synalinks/scripts/lmstudio_setup.py`
```
#!/usr/bin/env python3
"""LMStudio / vLLM setup helper for Synalinks.

Local OpenAI-compatible servers need:
1. A dummy OPENAI_API_KEY (any non-empty string)
2. A LiteLLM model registration (so cost tracking returns 0.0 instead of None)
3. An api_base pointing to the local server

Usage:
    from lmstudio_setup import create_lmstudio_language_model

    lm = create_lmstudio_language_model("ibm/granite-4-h-tiny")

Run log:
    references/lmstudio_setup.log

The __main__ demo points the same helper at a *live* local OpenAI-compatible
server — ollama at http://localhost:11434/v1 — so it runs without LMStudio.
The helper itself is server-agnostic; LMStudio (:1234) / vLLM (:8000) just need
their own api_base.
"""

import os

import litellm
import synalinks


def create_lmstudio_language_model(
    model_name: str,
    api_base: str = "http://localhost:1234/v1",
    max_tokens: int = 4096,
    api_key: str = "lm-studio",
    **kwargs,
) -> synalinks.LanguageModel:
    """Create a Synalinks LanguageModel configured for an LMStudio-compatible server.

    Args:
        model_name: Model name (without provider prefix). Will be prefixed with "openai/".
        api_base: Base URL of the local OpenAI-compatible server.
        max_tokens: Max output tokens (used for LiteLLM registration).
        api_key: Dummy API key. Any non-empty string works.
        **kwargs: Forwarded to synalinks.LanguageModel.
    """
    os.environ["OPENAI_API_KEY"] = api_key
    full_model_name = f"openai/{model_name}"

    litellm.register_model({
        full_model_name: {
            "max_tokens": max_tokens,
            "input_cost_per_token": 0.0,
            "output_cost_per_token": 0.0,
            "litellm_provider": "openai",
            "mode": "chat",
        }
    })

    return synalinks.LanguageModel(
        model=full_model_name,
        api_base=api_base,
        **kwargs,
    )


# Same helper, friendlier name for vLLM
def create_vllm_language_model(
    model_name: str,
    api_base: str = "http://localhost:8000/v1",
    **kwargs,
) -> synalinks.LanguageModel:
    """Create a Synalinks LanguageModel configured for a vLLM server."""
    return create_lmstudio_language_model(model_name, api_base=api_base, **kwargs)


if __name__ == "__main__":
    import asyncio

    async def main():
        # Demo against a live local OpenAI-compatible server (ollama). For a real
        # LMStudio server use create_lmstudio_language_model("ibm/granite-4-h-tiny")
        # (defaults to :1234).
        lm = create_lmstudio_language_model(
            "mistral", api_base="http://localhost:11434/v1"
        )

        class Q(synalinks.DataModel):
            query: str = synalinks.Field(description="The user query")

        class A(synalinks.DataModel):
            answer: str = synalinks.Field(description="The answer")

        inputs = synalinks.Input(data_model=Q)
        outputs = await synalinks.Generator(data_model=A, language_model=lm)(inputs)
        program = synalinks.Program(inputs=inputs, outputs=outputs)
        result = await program(Q(query="Capital of France?"))
        print(result.prettify_json())

    asyncio.run(main())

```

### Core Architecture Module: `skills/synalinks/scripts/omega_example.py`
```
#!/usr/bin/env python3
"""OMEGA optimizer example.

Usage:
    uv run -- python scripts/omega_example.py

Run log:
    references/omega_example.log

Demonstrates:
1. Configuring OMEGA with both language_model and embedding_model
2. Tuning population_size, k_nearest_fitter, mutation_temperature
3. Comparing before/after training metrics
"""

import asyncio
import numpy as np
import synalinks


class Question(synalinks.DataModel):
    question: str = synalinks.Field(description="A math word problem")


class Answer(synalinks.DataModel):
    thinking: str = synalinks.Field(description="Step-by-step reasoning")
    answer: int = synalinks.Field(description="Numerical answer")


async def main():
    # Cheap models for both program and optimizer. Runs end-to-end on local
    # ollama (no API keys). OMEGA's DNS branch needs the embedding model. Cloud
    # equivalents:
    #   program_lm   = synalinks.LanguageModel(model="openai/gpt-4o-mini")
    #   optimizer_lm = synalinks.LanguageModel(model="openai/gpt-4o-mini")
    #   em           = synalinks.EmbeddingModel(model="openai/text-embedding-3-small")
    program_lm = synalinks.LanguageModel(model="ollama/mistral")
    optimizer_lm = synalinks.LanguageModel(model="ollama/mistral")
    em = synalinks.EmbeddingModel(model="ollama/mxbai-embed-large")

    inputs = synalinks.Input(data_model=Question)
    outputs = await synalinks.ChainOfThought(
        data_model=Answer,
        language_model=program_lm,
    )(inputs)
    program = synalinks.Program(inputs=inputs, outputs=outputs, name="math_omega")

    # Alternative: register defaults and use the Keras-style string identifier:
    #     synalinks.set_default_language_model(optimizer_lm)
    #     synalinks.set_default_embedding_model(em)
    #     program.compile(
    #         reward=synalinks.rewards.ExactMatch(in_mask=["answer"]),
    #         optimizer="omega",   # case-insensitive: "OMEGA", "randomfewshot", ...
    #     )
    program.compile(
        reward=synalinks.rewards.ExactMatch(in_mask=["answer"]),
        optimizer=synalinks.optimizers.OMEGA(
            language_model=optimizer_lm,
            embedding_model=em,
            population_size=10,
            k_nearest_fitter=5,
            mutation_temperature=0.4,
            crossover_temperature=0.3,
            selection_temperature=0.3,
            merging_rate=0.02,
            algorithm="dns",
            selection="softmax",
            instructions="Improve clarity of step-by-step reasoning and arithmetic accuracy.",
        ),
    )

    x_train = np.array([
        Question(question="What is 5 + 3?"),
        Question(question="What is 10 - 4?"),
        Question(question="What is 6 * 2?"),
        Question(question="What is 20 / 4?"),
    ], dtype="object")

    y_train = np.array([
        Answer(thinking="5 + 3 = 8", answer=8),
        Answer(thinking="10 - 4 = 6", answer=6),
        Answer(thinking="6 * 2 = 12", answer=12),
        Answer(thinking="20 / 4 = 5", answer=5),
    ], dtype="object")

    x_test = np.array([
        Question(question="What is 9 + 2?"),
        Question(question="What is 16 - 7?"),
    ], dtype="object")

    y_test = np.array([
        Answer(thinking="9 + 2 = 11", answer=11),
        Answer(thinking="16 - 7 = 9", answer=9),
    ], dtype="object")

    print("=== Before training ===")
    before = await program.evaluate(x=x_test, y=y_test, batch_size=2)
    print(before)

    history = await program.fit(
        x=x_train, y=y_train,
        validation_split=0.25,
        epochs=2,
        batch_size=2,
    )
    synalinks.utils.plot_history(history, to_folder=".")

    print("\n=== After training ===")
    after = await program.evaluate(x=x_test, y=y_test, batch_size=2)
    print(after)


if __name__ == "__main__":
    asyncio.run(main())

```

### Core Architecture Module: `skills/synalinks/scripts/rag_example.py`
```
#!/usr/bin/env python3
"""Minimal RAG pipeline using Synalinks KnowledgeBase.

Usage:
    uv run -- python scripts/rag_example.py

Run log:
    references/rag_example.log

Demonstrates:
1. Defining a Document DataModel
2. Building a DuckDB KnowledgeBase with embeddings
3. Ingesting documents
4. RetrieveKnowledge + Generator for question answering
"""

import asyncio
import os

import synalinks

synalinks.enable_logging()

DB_PATH = "./demo_docs.db"


class Document(synalinks.DataModel):
    """A document chunk."""
    id: str = synalinks.Field(description="Document ID")
    title: str = synalinks.Field(description="Document title")
    content: str = synalinks.Field(description="Document content")


class Query(synalinks.DataModel):
    query: str = synalinks.Field(description="User query")


class Answer(synalinks.DataModel):
    answer: str = synalinks.Field(description="Answer based on retrieved context")


async def main():
    # Remove any stale DB so a previous run's embedding dimension can't clash.
    if os.path.exists(DB_PATH):
        os.remove(DB_PATH)

    lm = synalinks.LanguageModel(model="ollama/mistral")
    em = synalinks.EmbeddingModel(model="ollama/qwen3-embedding:latest")

    knowledge_base = synalinks.KnowledgeBase(
        uri="duckdb://./demo_docs.db",
        data_models=[Document],
        embedding_model=em,
        metric="cosine",
        wipe_on_start=True,
    )

    # Ingest a couple of documents directly
    docs = [
        Document(id="1", title="Python", content="Python is a high-level programming language."),
        Document(id="2", title="ML", content="Machine learning is a subset of AI."),
        Document(id="3", title="Synalinks", content="Synalinks is a Keras-inspired framework for neuro-symbolic LLM apps."),
    ]
    for doc in docs:
        await knowledge_base.update(doc.to_json_data_model())

    # Build the RAG pipeline
    inputs = synalinks.Input(data_model=Query)

    context = await synalinks.RetrieveKnowledge(
        knowledge_base=knowledge_base,
        language_model=lm,
        search_type="hybrid",
        k=3,
        return_inputs=True,
    )(inputs)

    outputs = await synalinks.Generator(
        data_model=Answer,
        language_model=lm,
        instructions="Answer using the retrieved context. If irrelevant, say you don't know.",
    )(context)

    rag = synalinks.Program(inputs=inputs, outputs=outputs, name="rag_qa")

    result = await rag(Query(query="What is Synalinks?"))
    print(result.prettify_json())


if __name__ == "__main__":
    asyncio.run(main())

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #51** (2026-09-28): **ci: validate and install skills for all agents; fix SKILL.md frontmatter**
  *Symptoms*: ## Why  A user reported the repo as broken. Reproduced with the documented install command:  ``` npx skills add SynaLinks/synalinks-skills --skill synalinks ⚠ Skipped .../synalinks/SKILL.md — YAML parse error: Nested mappings are not allowed in compact mappings └ No valid skills found. Skills require a SKILL.md with name and description. ```  The `description` in `skills/synalinks/SKILL.md` contains an unquoted `(Keras-inspired): DataModel...`. A colon followed by a space inside a plain YAML scalar is invalid, so the `skills` CLI discovers no skills and installs nothing, for every agent.  ## Changes  - **`skills/synalinks/SKILL.md`**: double-quote the description (content unchanged, 990 chars, under the 1024 spec limit). - **`.github/workflows/ci.yml`** (new):   - `validate`: runs the official Agent Skills validator (`agentskills validate`) on every `skills/*/` folder. Fails on the previous frontmatter.   - `install`: `npx skills add <checkout> --skill '*' --agent '*' --copy --json`, then asserts every skill in the repo reports `installed` and that `SKILL.md` landed in `.claude/skills/` and `.agents/skills/` (read by Codex, OpenCode, Cursor and most others). Runs on PRs so a bad merge is caught before users see it.   - `install-from-github`: on push to main, weekly schedule and manual dispatch, runs the exact command users run against the published repo.   - `package`: on main, zips each skill into a `.skill` archive (Claude.ai / Desktop upload format) and uploads it as a wor

- **Issue #49** (2026-09-26): **Cover decision models and the new rewards**
  *Symptoms*: ## Summary  Brings the `synalinks` skill up to date with decision models and the rewards added recently in Synalinks.  ### Decision models (new)  - **`references/decision-models.md`**:   - setup (`TYPESAFE_API_KEY`), and fields as questions (`bool`, `Literal`/`Enum`, score types like `synalinks.Rating`, `score_schema`);   - the `decision_model` argument, with a table per module (`Generator`, `Decision`, `MultiDecision`, `Branch`, `SelfCritique`, `RubricsAsJudge`);   - the order in which modules resolve between models, and `min_confidence` / `threshold`;   - tuning thresholds with KerasTuner (with a reward that prices an abstention, and `disable_keras_backend()`);   - in-context learning with `OMEGA`, reliability, metrics, tracing and pitfalls. - **`scripts/decision_model.py`**: triage `Generator`, `Decision` with `min_confidence`, a `Branch` routed by a decision model, and `RubricsAsJudge`. It has no captured run log, since that needs a TypeSafe key; it was checked against mocked models. - **`SKILL.md`**: a "Decision models" section, and a new universal gotcha: a decision model is never a `language_model`.  ### Rewards  - **`references/rewards-metrics.md`**:   - `RubricsAsJudge` (including grading with a decision model) and its 31 presets, grouped by area;   - `AgentAsJudge`, `DeepAgentAsJudge`, `RLMAsJudge`;   - `ComposableReward`, replacing the outdated "there's no built-in reward composition" note;   - `BatchReward` / `BatchRewardFunctionWrapper`;   - a "Choosing a judge" 

- **Issue #47** (2026-08-07): **docs: reframe the skill as agent-agnostic (open SKILL.md format)**
  *Symptoms*: ## Summary  The `SKILL.md` format started at Anthropic but is now an open standard read by Claude Code, Codex, OpenCode, pi and others. The README still presented the repo as Claude-only. This PR reframes it, and carries along one unpushed fix to the agents/tools reference.  ## Changes  **`README.md`** (this branch) - Retitle to "Agent Skills for Synalinks"; describe the open format instead of "Claude Skills". - Replace Claude-specific wording with "the agent" throughout, keeping Claude Code as the worked example for install paths (`<repo>/.claude/skills/`, `~/.claude/skills/`). - Expand **Other agents** with ready-to-paste `-a codex` / `-a opencode` / `-a pi` commands, and note that an unknown `-a` slug prints the full list of valid slugs. - State explicitly that the skill content is identical across agents: one `SKILL.md`, no per-agent variants. - Drop em dashes in favour of colons and commas.  **`skills/synalinks/references/agents-tools.md`** (commit `0928d27`, previously unpushed on `main`) - Fix the `npx skills` warning.  ## Notes  No skill content changed by the README commit: `SKILL.md`, `scripts/` and `references/` are untouched by it.  🤖 Generated with [Claude Code](https://claude.com/claude-code)

- **Issue #46** (2026-08-02): **docs: add sk installation instructions**
  *Symptoms*: `sk` is a universal package manager (works across all coding agents), handles updates, etc.. (npm/cargo for agents).  would you be open to adding this? 
  **Post-Mortem & Fix Analysis**:
  > Yes sure

- **Issue #45** (2025-10-14): **The documentation is good. Can you provide a score? **
  *Symptoms*: I can't use your question template, sorry.  The documentation is good. Can you provide a score?  Openhands is something similar to Devin, but it is open source.  Can your project be exported with OpenAI API?  Or, Openhands has used something like a "test set" to test performance.  This represents the degree of completion of LLM calling tools or LLM independently completing programming tasks.  It was 19% before, and then the score reached 30%. I don't know if it has reached 50% now, but it shouldn't.  I want to know if you can use such a test to further prove the performance improvement of your framework for LLM?  In short, does your project improve LLM's ability to complete programming tasks by itself?  I looked through the documentation and didn't see the core things for the time being, such as how various "memories" interact with LLM, is it called by Tools? Or through other methods.  I also didn't see the generation and query methods of various memories.  This, I guess, can be controlled by the user.  It looks very interesting.  Another point I am more concerned about is what is the context of LLM? When using this framework.  I think that when using the framework, it is necessary to see the content of each request sent to LLM, which is crucial to understanding the principles of the framework.  Some offensive requests, this is quite interesting, but as you know, there are a lot of Agent frameworks, yours should be more special and innovative. 

- **Issue #44** (2025-10-14): **Implements Docling support**
  *Symptoms*: This PR implements preliminary support for [Docling](https://github.com/DS4SD/docling) In order to keep the PR non-breaking, we implemented two additional components: a `DoclingReader` class which implements a `read` method, and a `DoclingHierarchicalChunker` class which implements a hierarchical splitter (chunker).  A combined test for both classes was implemented under `tests/modules/splitters`.  This can be tested on a Jupyter notebook like this:  ```python from hybridagi.memory.integration.local.local_document_memory import LocalDocumentMemory from hybridagi.core.pipeline import Pipeline from hybridagi.modules.embedders import DocumentEmbedder from hybridagi.embeddings.ollama import OllamaEmbeddings from hybridagi.readers.docling_reader import DoclingReader from hybridagi.modules.splitters.docling_splitter import DoclingHierarchicalChunker  source = "/my/sample.pdf"  # document path docling_reader = DoclingReader() hgi_doc_list, docling_doc = docling_reader.read(source)  presentation_doc = hgi_doc_list.docs[0] # type: ignore embeddings = OllamaEmbeddings() document_pipeline = Pipeline()  document_pipeline.add("chunk_documents", DoclingHierarchicalChunker(     doclingdoc=docling_doc )) document_pipeline.add("embed_chunks", DocumentEmbedder(embeddings=embeddings))  presentation_chunks = document_pipeline(presentation_doc)  presentation_memory = LocalDocumentMemory(index_name="company_presentation")  presentation_memory.update(presentation_doc

- **Issue #43** (2025-10-14): **Adding Neo4j integration**
  *Symptoms*: Adding Neo4J integration, the memory system can be stored in the same graph without problem. That will prepare the integration of the meta-cognition into HybridAGI. 

- **Issue #42** (2025-10-14): **Implementing iterative entity resolution into a pipeline**
  *Symptoms*: Once the feature based matching is done in the deduplicators, it should only be few lines of code to implement an iterative entity relation modules using a retriever + deduplicator. 

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

### Incident Patch 1: `092970a5` (2026-09-28)
**Commit Message**: ci: validate and install skills for all agents; fix SKILL.md frontmatter (#51)

The synalinks skill description contained an unquoted ": " so the skills CLI
parsed no skills and users could not install it. Quote the description and add
a CI workflow that validates every SKILL.md against the Agent Skills spec,
installs the skills into every agent the skills CLI supports (on PRs from the
checkout, on main from GitHub), and packages the .skill archives on main.

Co-authored-by: Claude Fable 5.1 <[REDACTED_EMAIL]>

**File**: `.github/workflows/ci.yml` (added, +108/-0)
```diff
@@ -0,0 +1,108 @@
+name: CI
+
+on:
+  push:
+    branches: [main]
+  pull_request:
+  schedule:
+    # Weekly: catches upstream changes in the `skills` CLI or the spec.
+    - cron: "0 6 * * 1"
+  workflow_dispatch:
+
+jobs:
+  validate:
+    name: Validate SKILL.md (agentskills spec)
+    runs-on: ubuntu-latest
+    steps:
+      - uses: actions/checkout@v4
+      - uses: astral-sh/setup-uv@v5
+      - name: Validate every skill folder
+        run: |
+          set -euo pipefail
+          for skill in skills/*/; do
+            uvx --from skills-ref agentskills validate "$skill"
+          done
+
+  install:
+    name: Install for all agents (skills CLI, local checkout)
+    runs-on: ubuntu-latest
+    steps:
+      - uses: actions/checkout@v4
+        with:
+          path: repo
+      - uses: actions/setup-node@v4
+        with:
+          node-version: 22
+      - name: Install every skill into every supported agent
+        run: |
+          set -euo pipefail
+          mkdir project && cd project
+          npx -y skills@latest add "$GITHUB_WORKSPACE/repo" \
+            --skill '*' --agent '*' --yes --copy --json > result.json
+          cat result.json
+      - name: Check every skill installed into every agent
+        run: |
+          set -euo pipefail
+          python3 - <<'PY'
+          import json, pathlib, sys
+          results = json.load(open("project/result.json"))
+          expected = sorted(p.parent.name for p in pathlib.Path("repo/skills").glob("*/SKILL.md"))
+          installed = sorted(r.get("name") for r in results if r.get("status") == "installed")
+          failed = [r for r in results if r.get("status") != "installed"]
+          if failed or installed != expected:
+              print("expected:", expected, "\ninstalled:", installed, "\nfailed:", failed)
+              sys.exit(1)
+          for r in results:
+              print(f"{r['name']}: installed into {len(r['agents'])} agents")
+          for name in expected:
+              # Claude Code has its own dir; Codex, OpenCode, Cursor, ... read .agents.
+              for agent_dir in (".claude", ".agents"):
+                  path = pathlib.Path("project") / agent_dir / "skills" / name / "SKILL.md"
+                  assert path.is_file(), f"missing {path}"
+          PY
+
+  install-from-github:
+    # What users actually run: install from the published repo, not the checkout.
+    name: Install for all agents (skills CLI, GitHub source)
+    if: github.event_name != 'pull_request'
+    runs-on: ubuntu-latest
+    steps:
+      - uses: actions/setup-node@v4
+        with:
+          node-version: 22
+      - name: Install from SynaLinks/synalinks-skills
+        run: |
+          set -euo pipefail
+          mkdir project && cd project
+          npx -y skills@latest add SynaLinks/synalinks-skills \
+            --skill '*' --agent '*' --yes --json > result.json
+          cat result.json
+          python3 -c '
+          import json, sys
+          results = json.load(open("result.json"))
+          failed = [r for r in results if r.get("status") != "installed"]
+          if failed or not results:
+              print("failed:", failed); sys.exit(1)
+          '
+
+  package:
+    # The `.skill` archive that Claude.ai / Claude Desktop uploads expect.
+    name: Package .skill archives
+    needs: [validate, install]
+    if: github.event_name == 'push' && github.ref == 'refs/heads/main'
+    runs-on: ubuntu-latest
+    steps:
+      - uses: actions/checkout@v4
+      - name: Zip every skill folder
+        run: |
+          set -euo pipefail
+          mkdir dist
+          for skill in skills/*/; do
+            name=$(basename "$skill")
+            (cd skills && zip -qr "../dist/$name.skill" "$name")
+          done
+          ls -l dist
+      - uses: actions/upload-artifact@v4
+        with:
+          name: skill-archives
+          path: dist/*.skill
```

**File**: `README.md` (modified, +9/-0)
```diff
@@ -1,5 +1,7 @@
 # Agent Skills for Synalinks
 
+[![CI](https://github.com/SynaLinks/synalinks-skills/actions/workflows/ci.yml/badge.svg)](https://github.com/SynaLinks/synalinks-skills/actions/workflows/ci.yml)
+
 ---
 
 This repository contains skills for coding agents that read the open Agent
@@ -208,6 +210,13 @@ See the [LICENSE](LICENSE) file for full details.
 
 Contributions are welcome! Please feel free to submit a Pull Request.
 
+Every push and pull request runs the [CI workflow](.github/workflows/ci.yml),
+which validates each `skills/*/SKILL.md` against the Agent Skills spec and
+installs the skills into every agent the `skills` CLI supports, so a broken
+frontmatter or a missing file is caught before it reaches users. On `main` it
+also re-installs from GitHub (the exact command users run) and uploads the
+`.skill` archives as a workflow artifact.
+
 ## Acknoledgement
 
 These skills have been created by [Ramiro Salas](https://www.linkedin.com/in/rsalas/) the CTO of [Hexatropian](https://www.linkedin.com/company/hextropian-systems/) an active early member of [Synalinks](https://github.com/SynaLinks/synalinks) community.
```

**File**: `skills/synalinks/SKILL.md` (modified, +1/-1)
```diff
@@ -1,6 +1,6 @@
 ---
 name: synalinks
-description: Use for anything involving the Synalinks neuro-symbolic LM framework (Keras-inspired): DataModel/Field/Input, JSON operators (+ & | ^ ~), synalinks.ops; LanguageModel/EmbeddingModel and provider prefixes; DecisionModel (TypeSafe jev decision models, decision_model=, min_confidence/threshold); the Program class and its four APIs, save/load; modules (Generator, ChainOfThought, SelfCritique, PythonSynthesis, custom Module); control flow (Decision, MultiDecision, Branch, And/Or/Xor, guards); agents (FunctionCallingAgent, RLM, DeepAgent, Tool, MCP); KnowledgeBase/RAG; training (compile/fit/evaluate/predict, callbacks, KerasTuner tuners); rewards (ExactMatch, CosineSimilarity, LMAsJudge, ProgramAsJudge, RubricsAsJudge and presets like Faithfulness/Toxicity, AgentAsJudge, DeepAgentAsJudge, RLMAsJudge, ComposableReward, BatchReward) and metrics; optimizers (RandomFewShot, OMEGA); datasets, visualization. Synalinks is Keras-shaped: without guidance LMs mix Keras/LangChain/DSPy syntax.
+description: "Use for anything involving the Synalinks neuro-symbolic LM framework (Keras-inspired): DataModel/Field/Input, JSON operators (+ & | ^ ~), synalinks.ops; LanguageModel/EmbeddingModel and provider prefixes; DecisionModel (TypeSafe jev decision models, decision_model=, min_confidence/threshold); the Program class and its four APIs, save/load; modules (Generator, ChainOfThought, SelfCritique, PythonSynthesis, custom Module); control flow (Decision, MultiDecision, Branch, And/Or/Xor, guards); agents (FunctionCallingAgent, RLM, DeepAgent, Tool, MCP); KnowledgeBase/RAG; training (compile/fit/evaluate/predict, callbacks, KerasTuner tuners); rewards (ExactMatch, CosineSimilarity, LMAsJudge, ProgramAsJudge, RubricsAsJudge and presets like Faithfulness/Toxicity, AgentAsJudge, DeepAgentAsJudge, RLMAsJudge, ComposableReward, BatchReward) and metrics; optimizers (RandomFewShot, OMEGA); datasets, visualization. Synalinks is Keras-shaped: without guidance LMs mix Keras/LangChain/DSPy syntax."
 ---
 
 # Synalinks
```

---

### Incident Patch 2: `5ba96a75` (2026-04-11)
**Commit Message**: fix: update skills docs for v0.7.1

- Fix instructions parameter: string not list in all examples
- Add decompose operation and pattern masking docs
- Update LanguageModel with correct providers and defaults (retry=5)
- Add masking/aggregation operations to api-reference

Co-Authored-By: Claude Opus 4.6 (1M context) <[REDACTED_EMAIL]>

**File**: `synalinks/references/agents-tools.md` (modified, +2/-6)
```diff
@@ -136,7 +136,7 @@ synalinks.FunctionCallingAgent(
     autonomous=True,                   # Run autonomously vs interactive
     return_inputs_with_trajectory=True, # Include full execution trajectory
     prompt_template=None,              # Custom prompt template
-    instructions=[],                   # Additional instructions
+    instructions="",                    # Additional instructions (MUST be a string)
 )
 ```
 
@@ -321,11 +321,7 @@ async def main():
         max_iterations=5,
         autonomous=True,
         return_inputs_with_trajectory=True,
-        instructions=[
-            "Always explain your reasoning",
-            "Use tools when needed, not for simple questions",
-            "Provide confidence estimate based on source quality",
-        ],
+        instructions="Always explain your reasoning. Use tools when needed, not for simple questions. Provide confidence estimate based on source quality.",
     )(inputs)
 
     agent = synalinks.Program(
```

**File**: `synalinks/references/api-reference.md` (modified, +35/-7)
```diff
@@ -97,7 +97,7 @@ outputs = await synalinks.Generator(
     data_model=Answer,  # Or schema=Answer.get_schema()
     language_model=lm,
     prompt_template=None,  # Custom prompt template
-    instructions=["Be concise"],  # List of instructions
+    instructions="Be concise",  # MUST be a string (not a list!)
     examples=None,  # Few-shot examples
     return_inputs=False,  # Include inputs in output
     use_inputs_schema=False,  # Include input schema in prompt
@@ -234,15 +234,22 @@ LLM wrapper supporting multiple providers via LiteLLM.
 ```python
 lm = synalinks.LanguageModel(
     model="ollama/mistral",  # Provider/model format
-    # model="openai/gpt-4",
-    # model="anthropic/claude-3-opus",
-    # model="groq/llama-3-70b",
-    temperature=0.7,
-    max_tokens=1000,
+    # model="openai/gpt-4o-mini",
+    # model="anthropic/claude-3-sonnet-20240229",
+    # model="gemini/gemini-2.5-pro",
+    # model="groq/llama3-8b-8192",
+    # model="mistral/codestral-latest",
+    # model="xai/grok-code-fast-1",
+    # model="azure/<your_deployment_name>",
+    api_base=None,    # Optional endpoint override
+    timeout=600,      # Timeout in seconds (default 600)
+    retry=5,          # Number of retries with exponential backoff (default 5)
+    fallback=None,    # Fallback LanguageModel if this one fails
+    caching=False,    # Enable caching of LM calls
 )
 ```
 
-**Supported providers:** ollama, openai, anthropic, mistral, groq, cohere, etc.
+**Supported providers:** ollama, openai, anthropic, gemini, mistral, groq, xai, azure, hosted_vllm.
 
 ### synalinks.EmbeddingModel
 
@@ -266,6 +273,27 @@ result = await synalinks.ops.concat(x1, x2, name="combined")
 # Or use operator: result = x1 + x2
 ```
 
+### Masking Operations
+
+```python
+# Keep only specified fields
+result = await synalinks.ops.in_mask(x, mask=["answer"])
+# Remove specified fields
+result = await synalinks.ops.out_mask(x, mask=["thinking"])
+# Regex pattern matching
+result = await synalinks.ops.in_mask(x, pattern="^input_")
+result = await synalinks.ops.out_mask(x, pattern="name$")
+```
+
+### Aggregation Operations
+
+```python
+# Group similar fields into lists (e.g. answer, answer_1 -> answers: [...])
+result = await synalinks.ops.factorize(x)
+# Expand lists into individual fields (inverse of factorize)
+result = await synalinks.ops.decompose(x)
+```
+
 ### Logical Operations
 
 ```python
```

**File**: `synalinks/references/modules-catalog.md` (modified, +23/-0)
```diff
@@ -277,6 +277,29 @@ result = await synalinks.ops.logical_not(x)
 result = ~x
 ```
 
+### Factorize / Decompose
+
+```python
+# Group similar fields into lists (e.g. answer, answer_1 -> answers: [...])
+result = await synalinks.ops.factorize(x)
+
+# Expand lists into individual fields (inverse of factorize)
+result = await synalinks.ops.decompose(x)
+```
+
+### Masking with Regex Pattern
+
+```python
+# Keep fields matching a regex pattern
+result = await synalinks.ops.in_mask(x, pattern="^input_")
+
+# Remove fields matching a regex pattern
+result = await synalinks.ops.out_mask(x, pattern="name$")
+
+# Both mask and pattern can be combined
+result = await synalinks.ops.in_mask(x, mask=["answer"], pattern="^query")
+```
+
 ---
 
 ## Creating Custom Modules
```

---

### Incident Patch 3: `e1076a3f` (2024-11-22)
**Commit Message**: Clean up falkorDB memory systems and fix test workflow

**File**: `.github/workflows/python-package.yaml` (modified, +1/-1)
```diff
@@ -27,7 +27,7 @@ jobs:
       - name: Display Python version
         run: python -c "import sys; print(sys.version)"
       - name: Start FalkorDB
-        run: docker run -d -p 6379:6379 falkordb/falkordb:edge &
+        run: docker run -d -p 6379:6379 falkordb/falkordb:v4.2.2 &
       - name: Install redis tools
         run: sudo apt-get install -y redis-tools
       - name: Verify that FalkorDB is up
```

**File**: `docs/Modules API/Agents/Graph interpreter Agent.md` (modified, +1/-1)
```diff
@@ -1,6 +1,6 @@
 # Graph Interpreter Agent
 
-The `GraphInterpreterAgent` is the agent system that execute the Cypher software stored in memory, it can branch over the graph programs by asking itself question when encountering decision steps, and use tools when encountering an Action step and jump to other programs when encountering Program steps. 
+The `GraphInterpreterAgent` is the agent system that execute the Cypher software stored in memory, it can branch over the graph programs by asking itself questions when encountering Decision steps, and use tools when encountering an Action step and jump to other programs when encountering Program steps. 
 
 ## Usage
 
```

**File**: `hybridagi/memory/integration/falkordb/falkordb_document_memory.py` (modified, +15/-12)
```diff
@@ -161,30 +161,33 @@ def get(self, id_or_ids: Union[UUID, str, List[Union[UUID, str]]]) -> DocumentLi
             doc_id = str(doc_id)
             if self.exist(doc_id):
                 query_result = self._graph.query(
-                    "MATCH (d:Document {id: $id}) RETURN d",
-                    params={"id": doc_id}
+                    " ".join(
+                        [
+                            "MATCH (d:Document {id: $id})",
+                            "RETURN d.text as text,",
+                            "d.parent_id as parent_id,",
+                            "d.metadata as metadata,",
+                            "d.vector as vector",
+                        ]
+                    ),
+                    params={"id": doc_id},
                 )
-                text = query_result.result_set[0][0].properties["text"]
-                metadata = query_result.result_set[0][0].properties["metadata"]
-                if "parent_id" in query_result.result_set[0][0].properties:
-                    parent_id = query_result.result_set[0][0].properties["parent_id"]
-                else:
-                    parent_id = None
+                text = query_result.result_set[0][0]
+                parent_id = query_result.result_set[0][1]
+                metadata = query_result.result_set[0][2]
                 if parent_id:
                     try:
                         parent_id = UUID(parent_id)
                     except Exception:
                         pass
-                else:
-                    parent_id = None
                 try:
                     doc_id = UUID(doc_id)
                 except Exception:
                     pass
                 doc = Document(id=doc_id, parent_id=parent_id, text=text)
                 doc.metadata = json.loads(metadata)
-                if "vector" in query_result.result_set[0][0].properties:
-                    doc.vector = query_result.result_set[0][0].properties["vector"]
+                if query_result.result_set[0][3]:
+                    doc.vector = query_result.result_set[0][3]
                 result.docs.append(doc)
         return result
 
```

**File**: `hybridagi/memory/integration/falkordb/falkordb_fact_memory.py` (modified, +52/-79)
```diff
@@ -54,7 +54,7 @@ def exist(self, entity_or_fact_id: Union[UUID, str]) -> bool:
             return self.exist_fact(entity_or_fact_id)
         
     def exist_fact(self, index: Union[UUID, str]) -> bool:
-        query = "MATCH ()-[r:FACT {id: $index}]->() RETURN r"
+        query = "MATCH ()-[r:FACT {_id_: $index}]->() RETURN r._id_ as id"
         result = self._graph.query(query, params={"index": str(index)})
         return len(result.result_set) > 0
 
@@ -174,30 +174,32 @@ def get_entities(self, id_or_ids: Union[UUID, str, List[Union[UUID, str]]]) -> E
         result = EntityList()
         ids = [str(i) for i in id_or_ids]
         for entity_id in entities_ids:
-            query_result = self._graph.query(
-                " ".join([
-                    "MATCH (e:Entity {id: $id})",
-                    "RETURN e"]),
-                params={"id": entity_id}
-            )
-            if len(query_result.result_set) > 0:
-                entity_data = query_result.result_set[0][0]
+            if self.exist(entity_id):
+                query_result = self._graph.query(
+                    " ".join(
+                        [
+                            "MATCH (e:Entity {id: $id})",
+                            "RETURN",
+                            "e.name as name,",
+                            "e.label as label,",
+                            "e.description as description,",
+                            "e.vector as vector",
+                        ]
+                    ),
+                    params={"id": entity_id}
+                )
                 try:
-                    entity_id = UUID(entity_data.properties["id"])
+                    entity_id = UUID(entity_id)
                 except Exception:
-                    entity_id = entity_data.properties["id"]
-                if "description" in entity_data.properties:
-                    description = entity_data.properties["description"]
-                else:
-                    description = None
-                if "vector" in entity_data.properties:
-                    vector = entity_data.properties["vector"]
-                else:
-                    vector = None
+                    pass
+                name = query_result.result_set[0][0]
+                label = query_result.result_set[0][1]
+                description = query_result.result_set[0][2]
+                vector = query_result.result_set[0][3]
                 entity = Entity(
                     id=entity_id,
-                    name=entity_data.properties["name"],
-                    label=entity_data.properties["label"],
+                    name=name,
+                    label=label,
                     description=description,
                     vector=vector,
                 )
@@ -221,70 +223,41 @@ def get_facts(self, id_or_ids: Union[UUID, str, List[Union[UUID, str]]]) -> Fact
         result = FactList()
         for fact_id in facts_ids:
             fact_id = str(fact_id)
-            query_result = self._graph.query(
-                " ".join([
-                    "MATCH (s:Entity)-[r:FACT {_id_:$id}]->(o:Entity)",
-                    "RETURN r, s, o"]),
-                params={"id": fact_id},
-            )
-            if len(query_result.result_set) > 0:
-                fact_data, subject_data, object_data = query_result.result_set[0]
-                try:
-                    subject_id = UUID(subject_data.properties["id"])
-                except Exception:
-                    subject_id = subject_data.properties["id"]
-                if "description" in subject_data.properties:
-                    description = subject_data.properties["description"]
-                else:
-                    description = None
-                if "vector" in subject_data.properties:
-                    vector = subject_data.properties["vector"]
-                else:
-                    vector = None
-                subj = Entity(
-                    id=subject_id,
-                    name=subject_data.properties["name"], 
-                    label=subject_data.properties["label"],
-                    description=description,
-                    vector=vector,
-                    metadata=json.loads(subject_data.properties["metadata"]), 
+            if self.exist_fact(fact_id):
+                query_result = self._graph.query(
+                    " ".join(
+                        [
+                            "MATCH (s:Entity)-[r:FACT {_id_:$id}]->(o:Entity)",
+                            "RETURN",
+                            "r.relationship as relationship_name,",
+                            "r.metadata as metadata,",
+                            "r.vector as relation_vector,",
+                            "s.id as subject_id,",
+                            "o.id as object_id",
+                        ]
+                    ),
+                    params={"id": fact_id},
                 )
-                rel = Relat
```

**File**: `hybridagi/memory/integration/falkordb/falkordb_memory.py` (modified, +1/-1)
```diff
@@ -56,7 +56,7 @@ def __init__(
             self.clear()
             
     def exist(self, index: Union[UUID, str], label:str) -> bool:
-        query = "MATCH (n:"+label+" {id: $index}) RETURN n"
+        query = "MATCH (n:"+label+" {id: $index}) RETURN n.id as id"
         result = self._graph.query(query, params={"index": str(index)})
         return len(result.result_set) > 0
 
```

**File**: `hybridagi/memory/integration/falkordb/falkordb_program_memory.py` (modified, +12/-6)
```diff
@@ -134,16 +134,23 @@ def get(self, id_or_ids: Union[UUID, str, List[Union[UUID, str]]]) -> GraphProgr
             prog_id = str(prog_id)
             if self.exist(prog_id):
                 query_result = self._graph.query(
-                    "MATCH (p:Program {id: $id}) RETURN p",
+                    " ".join(
+                        [
+                            "MATCH (p:Program {id: $id})",
+                            "RETURN",
+                            "p.program as program,",
+                            "p.metadata as metadata,",
+                            "p.vector as vector",
+                        ]
+                    ),
                     params={"id": prog_id}
                 )
-                cypher_program = query_result.result_set[0][0].properties["program"]
-                metadata = query_result.result_set[0][0].properties["metadata"]
+                cypher_program = query_result.result_set[0][0]
+                metadata = query_result.result_set[0][1]
                 prog = GraphProgram(name=prog_id)
                 prog.from_cypher(cypher_program)
                 prog.metadata = json.loads(metadata)
-                if "vector" in query_result.result_set[0][0].properties:
-                    prog.vector = query_result.result_set[0][0].properties["vector"]
+                prog.vector = query_result.result_set[0][2]
                 result.progs.append(prog)
         return result
 
@@ -179,7 +186,6 @@ def depends_on(self, source_id: Union[UUID, str], target_id: Union[UUID, str]) -
             "MATCH (n:Program {id:$source})-[r:DEPENDS_ON*]->(m:Program {id:$target}) RETURN r",
             params = params,
         )
-        print(result.result_set)
         if len(result.result_set) > 0:
             return True
         return False
```

**File**: `hybridagi/memory/integration/falkordb/falkordb_trace_memory.py` (modified, +13/-2)
```diff
@@ -128,8 +128,19 @@ def get(self, id_or_ids: Union[UUID, str, List[Union[UUID, str]]]) -> AgentStepL
         """
         ids = [str(id_or_ids)] if isinstance(id_or_ids, (UUID, str)) else [str(id) for id in id_or_ids]
         result = self._graph.query(
-            "MATCH (s:AgentStep) WHERE s.id IN $ids "
-            "RETURN s.id, s.step_type, s.parent_id, s.vector, s.name, s.description",
+            " ".join(
+                [
+                    "MATCH (s:AgentStep)",
+                    "WHERE s.id IN $ids",
+                    "RETURN",
+                    "s.id as id,",
+                    "s.step_type as step_type,",
+                    "s.parent_id as parent_id,",
+                    "s.vector as vector,",
+                    "s.name as name,",
+                    "s.description as description",
+                ]
+            ),
             params={"ids": ids}
         )
         steps = AgentStepList()
```

**File**: `notebooks/using_falkordb.ipynb` (modified, +13/-0)
```diff
@@ -1,5 +1,18 @@
 {
  "cells": [
+  {
+   "cell_type": "markdown",
+   "metadata": {},
+   "source": [
+    "First launch falkorDB using the following command:\n",
+    "\n",
+    "```\n",
+    "docker run -p 6379:6379 -p 3000:3000 -it --rm -v ./data:/data falkordb/falkordb:v4.2.2\n",
+    "```\n",
+    "\n",
+    "The open you browser to `http://localhost:3000`"
+   ]
+  },
   {
    "cell_type": "code",
    "execution_count": 1,
```

---

### Incident Patch 4: `759b2d4f` (2024-09-25)
**Commit Message**: Add tests + AddGraphProgram tool + various fixes

**File**: `README.md` (modified, +75/-40)
```diff
@@ -1,18 +1,20 @@
 # HybridAGI: for people who want AI to behave as expected
-## The Programmable Cypher-based Neuro-Symbolic AGI
+## The (self)Programmable Cypher-based Neuro-Symbolic AGI
 
 ### Your All-In-One framework for interactive knowledge intensive LLM applications
 
 <div align="center">
 
-[![Downloads](https://static.pepy.tech/badge/hybridagi/month)](https://pepy.tech/project/hybridagi)
+[![Downloads](https://static.pepy.tech/badge/hybridagi)](https://pepy.tech/project/hybridagi)
 [![Python package](https://github.com/SynaLinks/HybridAGI/actions/workflows/python-package.yaml/badge.svg)](https://github.com/SynaLinks/HybridAGI/actions/workflows/python-package.yaml)
 ![Beta](https://img.shields.io/badge/Release-Beta-blue)
 [![License: GPL-3.0](https://img.shields.io/badge/License-GPL-green.svg)](https://opensource.org/license/gpl-3-0/)
 
 </div>
 
-**Disclaimer:** We are currently refactoring the project for better modularity and better ease of use. For now, only the Local integration if available, the FalkorDB & Kuzu integration will be done at the end of this refactoring. At that time we will accept contributions for the integration of other Cypher-based graph databases. For more information, join the Discord channel.
+### LLM Agent as Graph VS LLM Agent as Graph Interpreter
+
+What makes our approach different from Agent as Graph is the fact that our Agent system is not a process represented by a graph, but an interpreter that can read/write and execute a graph data (the graph programs) structure separated from that process. Making possible for the Agent to learn by executing, reading and modifying the graph programs (like any other data), in its essence HybridAGI is intended to be a self-programming system centered around the Cypher language. It is a production-ready research project centered around neuro-symbolic programming, program synthesis and symbolic AI.
 
 ## Key Features
 
@@ -28,6 +30,8 @@
 
 - **Secure and Safe**: Special attention has been given to prevent Cypher Injections but also to prevent the Agent system from modifying its own main prompting mechanism by introducing the concept of protected programs.
 
+- **Predictable/Deterministic behavior and infinite number of tools**: Because we don't let the Agent choose the sequence of tools to use, we can use an infinite number of tools. By following the Graph Programs, we ensure a predictable and deterministic methodology for our Agent system. We can combine every memory system into one unique Agent by using the corresponding tools without limitation.
+
 ## Notebooks
 
 - [Datatypes](notebooks/datatypes.ipynb)
@@ -55,37 +59,37 @@ To us, an agent system is an goal-directed cognitive software that can process n
 
 HybridAGI is designed for data scientists, prompt engineers, researchers, and AI enthusiasts who love to experiment with AI. It is a "Build Yourself" product that focuses on human creativity rather than AI autonomy.
 
-### Why HybridAGI?
-
-We are not satisfied with the current trajectory of Agent-based systems that lack control and efficiency. Today's approach is to build React/MKRL agents that do what they want without any human control, resulting in infinite loops of nonsense because they tend to stay in their data distribution. Multi-agent systems try to solve that, but instead result in more nonsense and prohibitive costs due to the agents chitchatting with each other. Moreover, today's agents require fine-tuning to enhance/correct the behavior of the agent system. In contrast, with HybridAGI, the only thing you need to do is to modify the behavior graph (the graph programs).
-
-We advocate that fine-tuning should be done only as a last resort when in-context learning fails to give you the expected result. Any person who has already fine-tuned a LLM knows that gathering data is hard, but having the right variability in your dataset is even harder, thus prohibiting most companies from leveraging this technology if they don't have many AI scientists. By rooting cognitive sciences into computer science concepts, without obfuscating them, we empower programmers to build the Agent system of their dreams by controlling the sequence of action and decision.
-
-Our goal is to build an agent system that solves real-world problems by using an intermediary language interpretable by both humans and machines. If we want to keep humans in the loop in the coming years, we need to design Agent systems for that purpose.
-
 ### Install
 
+#### With pip (recommended)
+
+To install easily HybridAGI we recommend you to use pip with the following command:
 ```
 pip install hybridagi
 ```
 
-### Graphs for planning and knowledge management, no finetuning required.
+#### From sources
 
-**No React Agents here**, the only agent system that we provide is our custom **Graph Interpreter Agent** that follow a strict methodology by executing node by node the graph programs it have in memory. Because we control the behavior of the Agent from end-to-end 
```

**File**: `docs/Core API/Graph Program.md` (modified, +1/-1)
```diff
@@ -172,7 +172,7 @@ CREATE
 (answer)-[:NEXT]->(end)
 """
 
-main = gp.GraphProgram().from_cypher(cypher)
+main = gp.GraphProgram(name="main").from_cypher(cypher)
 
 ```
 
```

**File**: `docs/FAQ.md` (modified, +46/-2)
```diff
@@ -2,10 +2,54 @@
 
 ## Frequently Asked Questions
 
+### Why HybridAGI?
+
+We are dissatisfied with the current trajectory of agent-based systems that lack control and efficiency. Today's approach involves building React/MKRL agents that operate independently without human control, often leading to infinite loops of nonsense due to their tendency to stay within their data distribution. Multi-agent systems attempt to address this issue, but they often result in more nonsense and prohibitive costs due to the agents' chitchat. Additionally, today's agents often require fine-tuning to enhance or correct their behavior, which can be a time-consuming and complex process.
+
+With HybridAGI, the only thing you need to do is modify the behavior graph (the graph programs). We believe that fine-tuning should be a last resort when in-context learning fails to yield the desired results. By rooting cognitive sciences into computer science concepts, we empower programmers to build the agent system of their dreams by controlling the sequence of action and decision. Our goal is to build an agent system that can solve real-world problems by using an intermediary language that is interpretable by both humans and machines. If we want to keep humans in the loop in the coming years, we need to design agent systems for that purpose.
+
 ### What is the difference between LangGraph and HybridAGI?
 
-TODO
+LangGraph is built on top of LangChain, which was also the case for HybridAGI last year. However, given the direction of the LangChain team towards encouraging ReACT agents that lack control and explainability, we switched to DSPy, which provides better value by focusing on pipelines optimization. Recently, LangGraph has emerged to compensate for the poor decision-making of LangChain, but we had already proven the value of our work. Moreover, LangGraph, like many agentic frameworks, describes a static finite state machine. Our vision of AGI systems is that being Turing complete is required, which is the case for many agentic frameworks, but having the capability of programming itself on the fly (meaning real continuous learning) is also required to truly begin the AGI journey, which is lacking in other frameworks.
 
 ### What is the difference between Llama-Index and HybridAGI?
 
-TODO
\ No newline at end of file
+Llama-Index recently released an event-driven agent system, similar to LangGraph, it is a static state machine, and the same remarks apply to their work.
+
+### What is the difference between DSPy and HybridAGI?
+
+HybridAGI is built on top of the excellent work of the DSPy team, and it is intended as an abstraction to simplify the creation of complex DSPy programs in the context of LLM Agents. DSPy is more general and is also used for simpler tasks that don't need agentic systems. Unlike DSPy, our programs are not static but dynamic and can adapt to the user query by dynamically calling programs stored in memory. Moreover, we focus our work on explainable neuro-symbolic AGI systems using Graphs. The graph programs are easier to build than implementing them from scratch using DSPy. If DSPy is the PyTorch of LLM applications, think of HybridAGI as the Keras or HuggingFace of neuro-symbolic LLM agents.
+
+### What is the difference between OpenAI o1 and HybridAGI?
+
+OpenAI o1 and HybridAGI share many common goals, but they are built with different paradigms in mind. Like OpenAI o1, HybridAGI uses multi-step inferences and is a goal-oriented agent system. However, unlike OpenAI o1, we guide the CoT trace of our agent system instead of letting it explore freely its action space, a paradigm more similar to an A* where the Agent navigates in a defined graph instead of a Q-learning one. This results in more efficient reasoning, as experts can program it to solve a particular use case. We can use smaller LLMs, reducing the environmental impact and increasing the ROI. The downside of our technology is that you need expert knowledge in your domain as well as in programming and AI systems to best exploit its capabilities. For that reason, we provide audit, consulting, and development services to people and companies that lack the technical skills in AI to implement their system.
+
+### Who are we?
+
+We're not based in Silicon Valley or part of a big company; we're a small, dedicated team from the south of France. Our focus is on delivering an AI product where the user maintains control. We're dissatisfied with the current trajectory of agent-based products. We are experts in human-robot interactions and building interactive systems that behave as expected. While we draw inspiration from cognitive sciences and symbolic AI, we aim to keep our concepts grounded in computer science for a wider audience.
+
+Our mission extends beyond AI safety and performance; it's about shaping the world we want to live in. Even if programming becomes obsolete in 5 or 10 years, replaced by some magical prompt, we believe that traditional prompts are
```

**File**: `docs/Modules API/Agents/Graph Program Interpreter.md` (removed, +0/-3)
```diff
@@ -1,3 +0,0 @@
-# Graph Program Interpreter
-
-## 
\ No newline at end of file
```

**File**: `docs/Modules API/Agents/Graph interpreter Agent.md` (added, +37/-0)
```diff
@@ -0,0 +1,37 @@
+# Graph Interpreter Agent
+
+The `GraphInterpreterAgent` is the agent system that execute the Cypher software stored in memory, it can branch over the graph programs by asking itself question when encountering decision steps, and use tools when encountering an Action step and jump to other programs when encountering Program steps. 
+
+## Usage
+
+```python
+from hybridagi.modules.agents import GraphInterpreterAgent
+from hybridagi.core.datatypes import AgentState
+from hybridagi.modules.agents.tools import PredictTool, SpeakTool
+
+agent_state = AgentState()
+
+tools = [
+    PredictTool(),
+    SpeakTool(
+        agent_state = agent_state,
+    )
+]
+
+agent = GraphInterpreterAgent(
+    agent_state = agent_state, # The agent state
+    program_memory = program_memory, # The program memory where the graph programs are stored 
+    embeddings = None, # The embeddings to use when storing the agent steps (optional, default to None)
+    trace_memory = None, # The trace memory to store the agent steps (optional, default to None)
+    tools = tools, # The list of tools to use for the agent
+    entrypoint = "main" # The entrypoint for the graph programs (default to main)
+    num_history = 5, # The number of last steps to remember in the agent context (Default to 5)
+    commit_decision_steps = False, # Weither or not to use the decision steps in the agent context (default to False)
+    decision_lm = None, # The decision language model to use if different from the one configured (optional, default to None)
+    verbose = True, # Weither or not to display the colorful trace when executing the program (default to True)
+    debug = False, # Weither or not to raise exceptions during the execution of a program (default to False)
+)
+
+result = agent(Query(text="What is the capital of France?"))
+
+```
\ No newline at end of file
```

**File**: `docs/Modules API/Agents/Tools/Ask User.md` (modified, +25/-0)
```diff
@@ -0,0 +1,25 @@
+
+
+The `AskUser` Tool is usefull to ask information to the user and 
+
+## Output
+
+```python
+```
+
+## Usage
+
+```python
+
+ask_user = AskUserTool(
+    name = "AskUser" # The name of the tool
+    agent_state = agent_state, # The state of the agent
+    simulated = True, # Weither or not to simulate the user using a LLM
+    func = None, # Callable function to integrate with front-end (optional)
+    lm = 
+)
+```
+
+### Integrate it with Gradio
+
+TODO
\ No newline at end of file
```

**File**: `docs/index.md` (modified, +1/-1)
```diff
@@ -4,7 +4,7 @@ Welcome to HybridAGI documentation, you will find the ressources to understand a
 
 ### LLM Agent as Graph VS LLM Agent as Graph Interpreter
 
-What makes our approach different from Agent as Graph is the fact that our Agent system is *not a static finite state machine*, but an interpreter that can read/write and execute node by node a *dynamic graph data (the graph programs) structure separated from that process*. Making possible for the Agent to learn by executing, reading and modifying the graph programs (like any other data), in its essence HybridAGI is intended to be a self-programming system centered around the Cypher language.
+What makes our approach different from Agent as Graph (like LangGraph or LLama-Index) is the fact that our Agent system is *not a static finite state machine*, but an interpreter that can read/write and execute node by node a *dynamic graph data* (the graph programs) structure separated from that process. Making possible for the Agent to learn by executing, reading and modifying the graph programs (like any other data), in its essence HybridAGI is intended to be a self-programming system centered around the Cypher language.
 
 ## Install
 
```

**File**: `hybridagi/core/graph_program.py` (modified, +12/-12)
```diff
@@ -42,15 +42,15 @@ class Action(BaseModel):
     tool: str = Field(description="The tool name")
     purpose: str = Field(description="The action purpose")
     prompt: Optional[str] = Field(description="The prompt used to infer to tool inputs")
-    inputs: Optional[List[str]] = Field(description="The input for the prompt", default=[])
-    output: Optional[str] = Field(description="The variable to store the action output", default=None)
+    var_in: Optional[List[str]] = Field(description="The list of input variables for the prompt", default=[])
+    var_out: Optional[str] = Field(description="The variable to store the action output", default=None)
     disable_inference: bool = Field(description="Weither or not to disable the inference", default=False)
 
 class Decision(BaseModel):
     id: str = Field(description="Unique identifier for the step")
     purpose: str = Field(description="The decision purpose")
     question: str = Field(description="The question to assess")
-    inputs: Optional[List[str]] = Field(description="The input prompt variables", default=[])
+    var_in: Optional[List[str]] = Field(description="The list of input variables for the prompt", default=[])
 
 class Program(BaseModel):
     id: str = Field(description="Unique identifier for the step")
@@ -296,8 +296,8 @@ def from_cypher(self, cypher_query: str) -> Optional["GraphProgram"]:
                         purpose=step_props["purpose"],
                         tool=step_props["tool"],
                         prompt=step_props["prompt"],
-                        inputs=step_props["inputs"] if "inputs" in step_props else [],
-                        output=step_props["output"] if "output" in step_props else None,
+                        var_in=step_props["var_in"] if "var_in" in step_props else [],
+                        var_out=step_props["var_out"] if "var_out" in step_props else None,
                         disable_inference=True if "disable_inference" in step_props else False,
                     ))
                 elif step_type == "Decision":
@@ -311,7 +311,7 @@ def from_cypher(self, cypher_query: str) -> Optional["GraphProgram"]:
                         id=step_props["id"],
                         purpose=step_props["purpose"],
                         question=step_props["question"],
-                        inputs=step_props["inputs"] if "inputs" in step_props else [],
+                        var_in=step_props["var_in"] if "var_in" in step_props else [],
                     ))
                 elif step_type == "Program":
                     if "id" not in step_props:
@@ -364,10 +364,10 @@ def to_cypher(self):
                 }
                 if step.prompt:
                     args["prompt"] = step.prompt
-                if step.inputs and len(step.inputs) > 0:
-                    args["inputs"] = step.inputs
-                if step.output:
-                    args["output"] = step.output
+                if step.var_in and len(step.var_in) > 0:
+                    args["var_in"] = step.var_in
+                if step.var_out:
+                    args["var_out"] = step.var_out
                 if step.disable_inference is True:
                     args["disable_inference"] = True
                 cleaned_args = re.sub(key_quotes_regex, sub_regex, json.dumps(args, indent=2))
@@ -378,8 +378,8 @@ def to_cypher(self):
                     "purpose": step.purpose,
                     "question": step.question,
                 }
-                if len(step.inputs) > 0:
-                    args["inputs"] = step.inputs
+                if len(step.var_in) > 0:
+                    args["var_in"] = step.var_in
                 cleaned_args = re.sub(key_quotes_regex, sub_regex, json.dumps(args, indent=2))
                 cypher += f"\n({step_id}:Decision "+cleaned_args+"),"
             elif isinstance(step, Program):
```

---

### Incident Patch 5: `00b619b4` (2024-09-19)
**Commit Message**: Fix falkordb retrievers and memory

**File**: `docs/Core API/Data Types.md` (removed, +0/-126)
```diff
@@ -1,126 +0,0 @@
-
-`Document`: Represent an unstructured textual data to be processed or saved into the `DocumentMemory`, it can represent a text, text chunk, table row or a claim (unstructured fact)
-
-`DocumentList`: A list of documents to be processed or saved into memory
-  
-```python
-import dspy
-from pydantic import BaseModel, Field
-from typing import Optional, List, Dict
-
-class Document(BaseModel):
-	id: str = Field(description="Unique identifier for the document", default_factory=uuid4)
-	text: str = Field(description="The actual text content of the document")
-	parent_id: str = Field(description="Identifier for the parent document", default="")
-	vector: Optional[List[float]] = Field(description="Vector representation of the document", default=None)
-	metadata: Optional[Dict[str, Any]] = Field(description="Additional information about the document", default=None)
-
-class DocumentList(BaseModel, dspy.Prediction):
-	docs: List[Document] = Field(description="List of documents", default=[])
-
-``` 
-
-`Entity`: Represent an entity like a person, object, place or document to be processed or saved into the `FactMemory`
-
-`Fact`: Represent a first order predicate to be processed or saved into the `FactMemory`
-
-`EntityList`: A list of entities to be processed or saved into memory
-
-`FactList`: A list of facts to be processed or saved into memory
-  
-```python
-
-class Entity(BaseModel):
-	id: str = Field(description="Unique identifier for the entity", default_factory=uuid4)
-	label: str = Field(description="Label or category of the entity")
-	name: str = Field(description="Name or title of the entity")
-	vector: Optional[List[float]] = Field(description="Vector representation of the entity", default=None)
-	metadata: Optional[Dict[str, Any]] = Field(description="Additional information about the entity", default=None)
-
-class Fact(BaseModel):
-	id: str = Field(description="Unique identifier for the fact", default_factory=uuid4)
-	subj: Entity = Field(description="Entity that is the subject of the fact")
-	rel: str = Field(description="Relationship between the subject and object entities")
-	obj: Entity = Field(description="Entity that is the object of the fact")
-	vector: Optional[List[float]] = Field(description="Vector representation of the fact", default=None)
-	metadata: Optional[Dict[str, Any]] = Field(description="Additional information about the fact", default=None)
-
-class FactList(BaseModel, dspy.Prediction):
-	facts: List[Fact] = Field(description="List of facts", default=[])
-
-```
-
-`UserProfile`: Represent the user profile used to personalize the interaction and by the simulation of the user.
-  
-```python
-
-class UserProfile(BaseModel):
-	id: str = Field(description="Unique identifier for the user", default_factory=uuid4)
-	name: str = Field(description="The user name", default="Unknow")
-	profile: str = Field(description="The user profile", default="An average User")
-
-class RoleType(str, Enum):
-	AI = "AI"
-	User = "User"
-
-class Message(BaseModel):
-	role: RoleType
-	message: str
-
-class ChatHistory(BaseModel):
-	msgs: List[Message] = Field(description="List of messages", default=[])
-
-class InteractionSession(BaseModel):
-	id: str = Field(description="Unique identifier for the interaction session", default_factory=uuid4)
-	user_profile: UserProfile = Field(description="The user profile")
-	chat_history: ChatHistory = Field(description="The chat history")
-
-```
-
-`AgentStep`: Represent a step performed by the Agent 
-
-`AgentInput`: The DSPy input type for agents
-
-`AgentOutput`: The DSPy output type for agents
-  
-```python
-
-class AgentStepType(str, Enum):
-	Action = "Action"
-	Decision = "Decision"
-	ProgramCall = "ProgramCall"
-	ProgramEnd = "ProgramEnd"
-	Finish = "Finish"
-
-class AgentStep(BaseModel):
-	id: str = Field(description="Unique identifier for a step", default_factory=uuid4)
-	parent_id: str = Field(description="The previous step id if any", default="")
-	hop: int = Field(description="The step hop", default=0)
-	step_type: AgentStepType = Field(description="The step type")
-	inputs: dspy.Prediction = Field(description="The input of the step", default=None)
-	output: dspy.Prediction = Field(description="The output of the step", default=None)
-	vector: Optional[List[float]] = Field(description="Vector representation of the step", default=None)
-	metadata: Optional[Dict[str, Any]] = Field(description="Additional information about the step", default=None)
-
-class ProgramTrace(BaseModel):
-	steps: List[AgentStep] = Field(description="List of agent steps", default=[])
-
-class FinishReason(str, Enum):
-	MaxIters = "max_iters"
-	Finished = "finished"
-	Error = "error"
-
-class UserQuery(BaseModel):
-	query: str = Field(description="The User query")
-
-class AgentInput():
-	objective: UserQuery = Field(description="The user objective")
-	session: InteractionSession = Field(description="The current interaction session", default=None)
-
-class AgentOutput(
```

**File**: `docs/Core API/Data Types/Document.md` (added, +65/-0)
```diff
@@ -0,0 +1,65 @@
+# Document
+
+Documents are the atomic data used in HybridAGI's Document Memory, they are used to represent textual data and their chunks in the system. Allowing the system to implement vector-only [Retrieval Augmented Generation](https://en.wikipedia.org/wiki/Retrieval-augmented_generation) systems.
+
+`Document`: Represent an unstructured textual data to be processed or saved into memory
+
+`DocumentList`: A list of documents to be processed or saved into memory
+  
+## Definition
+
+```python
+
+class Document(BaseModel):
+    id: Union[UUID, str] = Field(description="Unique identifier for the document", default_factory=uuid4)
+    text: str = Field(description="The actual text content of the document")
+    parent_id: Optional[Union[UUID, str]] = Field(description="Identifier for the parent document", default=None)
+    vector: Optional[List[float]] = Field(description="Vector representation of the document", default=None)
+    metadata: Optional[Dict[str, Any]] = Field(description="Additional information about the document", default={})
+    
+    def to_dict(self):
+        if self.metadata:
+            return {"text": self.text, "metadata": self.metadata}
+        else:
+            return {"text": self.text}
+
+class DocumentList(BaseModel, dspy.Prediction):
+    docs: Optional[List[Document]] = Field(description="List of documents", default=[])
+    
+    def __init__(self, **kwargs):
+        BaseModel.__init__(self, **kwargs)
+        dspy.Prediction.__init__(self, **kwargs)
+        
+    def to_dict(self):
+        return {"documents": [d.to_dict() for d in self.docs]}
+
+```
+
+## Usage
+
+```python
+
+input_data = \
+[
+    {
+        "title": "The Catcher in the Rye",
+        "content": "The Catcher in the Rye is a novel by J. D. Salinger, partially published in serial form in 1945–1946 and as a novel in 1951. It is widely considered one of the greatest American novels of the 20th century. The novel's protagonist, Holden Caulfield, has become an icon for teenage rebellion and angst. The novel also deals with complex issues of innocence, identity, belonging, loss, and connection."
+    },
+    {
+        "title": "To Kill a Mockingbird",
+        "content": "To Kill a Mockingbird is a novel by Harper Lee published in 1960. It was immediately successful, winning the Pulitzer Prize, and has become a classic of modern American literature. The plot and characters are loosely based on the author's observations of her family and neighbors, as well as on an event that occurred near her hometown in 1936, when she was 10 years old. The novel is renowned for its sensitivity and depth in addressing racial injustice, class, gender roles, and destruction of innocence."
+    }
+]
+
+document_list = DocumentList()
+
+for data in input_data:
+    document_list.docs.append(
+        Document(
+            text=data["content"],
+            metadata={"title": data["title"]},
+        )
+    )
+
+>>>
+```
\ No newline at end of file
```

**File**: `docs/Core API/Data Types/Fact.md` (added, +125/-0)
```diff
@@ -0,0 +1,125 @@
+# Fact
+
+Facts are the atomic data of a [Knowledge Graph](https://en.wikipedia.org/wiki/Knowledge_graph). They represent the relations between two entities (a subject and object). They are the basis of knowledge based systems and allowing to represent precise and formal knowledge. With them you can implement [Knowledge Graph based Retrieval Augmented Generation]().
+
+`Entity`: Represent an entity like a person, object, place or document to be processed or saved into memory
+
+`Fact`: Represent a first order predicate to be processed or saved into the `FactMemory`
+
+`EntityList`: A list of entities to be processed or saved into memory
+
+`FactList`: A list of facts to be processed or saved into memory
+
+## Definition
+  
+```python
+
+class Entity(BaseModel):
+    id: Union[UUID, str] = Field(description="Unique identifier for the entity", default_factory=uuid4)
+    label: str = Field(description="Label or category of the entity")
+    name: str = Field(description="Name or title of the entity")
+    description: Optional[str] = Field(description="Description of the entity", default=None)
+    vector: Optional[List[float]] = Field(description="Vector representation of the document", default=None)
+    metadata: Optional[Dict[str, Any]] = Field(description="Additional information about the document", default={})
+    
+    def to_dict(self):
+        if self.metadata:
+            if self.description is not None:
+                return {"name": self.name, "label": self.label, "description": self.description, "metadata": self.metadata}
+            else:
+                return {"name": self.name, "label": self.label, "metadata": self.metadata}
+        else:
+            if self.description is not None:
+                return {"name": self.name, "label": self.label, "description": self.description}
+            else:
+                return {"name": self.name, "label": self.label}
+
+class EntityList(BaseModel, dspy.Prediction):
+    entities: List[Entity] = Field(description="List of entities", default=[])
+    
+    def __init__(self, **kwargs):
+        BaseModel.__init__(self, **kwargs)
+        dspy.Prediction.__init__(self, **kwargs)
+        
+    def to_dict(self):
+        return {"entities": [e.to_dict() for e in self.entities]}
+
+class Relationship(BaseModel):
+    id: Union[UUID, str] = Field(description="Unique identifier for the relation", default_factory=uuid4)
+    name: str = Field(description="Relationship name")
+    vector: Optional[List[float]] = Field(description="Vector representation of the relationship", default=None)
+    metadata: Optional[Dict[str, Any]] = Field(description="Additional information about the relationship", default={})
+    
+    def to_dict(self):
+        if self.metadata:
+            return {"name": self.name, "metadata": self.metadata}
+        else:
+            return {"name": self.name}
+
+class Fact(BaseModel):
+    id: Union[UUID, str] = Field(description="Unique identifier for the fact", default_factory=uuid4)
+    subj: Entity = Field(description="Entity that is the subject of the fact", default=None)
+    rel: Relationship = Field(description="Relation between the subject and object entities", default=None)
+    obj: Entity = Field(description="Entity that is the object of the fact", default=None)
+    vector: Optional[List[float]] = Field(description="Vector representation of the fact", default=None)
+    metadata: Optional[Dict[str, Any]] = Field(description="Additional information about the fact", default={})
+    
+    def to_cypher(self) -> str:
+        if self.subj.description is not None:
+            subj = "(:"+self.subj.label+" {name:\""+self.subj.name+"\", description:\""+self.subj.description+"\"})"
+        else:
+            subj = "(:"+self.subj.label+" {name:\""+self.subj.name+"\"})"
+        if self.obj.description is not None:
+            obj = "(:"+self.obj.label+" {name:\""+self.obj.name+"\", description:\""+self.obj.description+"\"})"
+        else:
+            obj = "(:"+self.obj.label+" {name:\""+self.obj.name+"\"})"
+        return subj+"-[:"+self.rel.name+"]->"+obj
+    
+    def from_cypher(self, cypher_fact:str, metadata: Dict[str, Any] = {}) -> "Fact":
+        match = re.match(CYPHER_FACT_REGEX, cypher_fact)
+        if match:
+            self.subj = Entity(label=match.group(1), name=match.group(2))
+            self.rel = Relationship(name=match.group(3))
+            self.obj = Entity(label=match.group(4), name=match.group(5))
+            self.metadata = metadata
+            return self
+        else:
+            raise ValueError("Invalid Cypher fact provided")
+    
+    def to_dict(self):
+        if self.metadata:
+            return {"fact": self.to_cypher(), "metadata": self.metadata}
+        else:
+            return {"fact": self.to_cypher()}
+
+class FactList(BaseModel, dspy.Prediction):
+    facts: List[Fact] = Field(description="List of facts", default=[])
+    
+    def __init__
```

**File**: `docs/Core API/Data Types/Graph Program.md` (renamed, +9/-13)
```diff
@@ -1,27 +1,23 @@
+# Graph Program
+
 The Graph Programs are a special data type representing a workflow of actions and decisions with calls to other programs. They are used by our own custom Agent, the `GraphProgramInterpreter`. In order help you to build them, we provide two ways of doing it: Using Python or Cypher.
 
-The two ways are equivalent and allows you to choose the one you prefer.
+The two ways are equivalent and allows you to choose the one you prefer, we recommend you however to use the pythonic way, to avoid syntax errors, and eventually save them into Cypher format for later use.
 
-### Python Usage:
+### Python Usage
 
 ```python
 import hybridagi.core.graph_program as gp
 
 main = gp.GraphProgram(
-	id = "main",
-	desc = "The main program",
+	name = "main",
+	description = "The main program",
 )
 
 main.add("answer", gp.Action(
-	tool = "Speak"
-	purpose = ""
-	prompt = \
-"""
-Please answer to the following question: 
-{{objective}}
-"""
-	inputs=["objective"],
-	ouput="answer",
+	tool = "Speak",
+	purpose = "Answer the Objective's question",
+	prompt = "Please answer to the Objective's question",
 ))
 
 main.connect("start", "answer")
```

**File**: `docs/Core API/Data Types/Session.md` (added, +28/-0)
```diff
@@ -0,0 +1,28 @@
+# Session
+
+`UserProfile`: Represent the user profile used to personalize the interaction and by the simulation of the user.
+  
+```python
+
+class UserProfile(BaseModel):
+	id: str = Field(description="Unique identifier for the user", default_factory=uuid4)
+	name: str = Field(description="The user name", default="Unknow")
+	profile: str = Field(description="The user profile", default="An average User")
+
+class RoleType(str, Enum):
+	AI = "AI"
+	User = "User"
+
+class Message(BaseModel):
+	role: RoleType
+	message: str
+
+class ChatHistory(BaseModel):
+	msgs: List[Message] = Field(description="List of messages", default=[])
+
+class InteractionSession(BaseModel):
+	id: str = Field(description="Unique identifier for the interaction session", default_factory=uuid4)
+	user_profile: UserProfile = Field(description="The user profile")
+	chat_history: ChatHistory = Field(description="The chat history")
+
+```
\ No newline at end of file
```

**File**: `docs/Core API/Pipeline.md` (modified, +16/-15)
```diff
@@ -1,14 +1,14 @@
-A pipeline is a structure that allows you to cascade DSPy modules into a sequence that you can use in other pipelines. Like Keras sequential model, each block in a pipeline have only **one input** and **one output**.
+# Pipelines
 
-It have been implemented to provide a simple way of creating sequence of modules while giving you access to the modules output after processing. The pipelines are mostly used for data processing as the 
+A `Pipeline` is a structure that allows you to cascade data processing `Modules` into a sequence. Like Keras sequential model, each block in a pipeline have only **one input** and **one output**.
 
-### Usage:
+Pipelines have been implemented to provide a simple way of creating sequence of modules while giving you access to the modules output after processing.
 
-```python
-import hybridagi as hagi
-from hybridagi.memory.integration.local import LocalDocumentMemory
-import hybridagi.core.datatypes as dt
+## Usage
+
+``` py
 from hybridagi.core.pipeline import Pipeline
+from hybridagi.core.datatypes import DocumentList, Document
 
 input_data = [
     {
@@ -21,17 +21,18 @@ input_data = [
     }
 ]
 
-input_docs = [dt.Document(text=d["content"], metadata={"title": d["title"]}) for d in input_data]
+input_docs = DocumentList()
+
+input_docs.docs = [dt.Document(text=d["content"], metadata={"title": d["title"]}) for d in input_data]
 
 pipeline = Pipeline()
 
-pipeline.add("split_chunk", hagi.DocumentSplitter(
-	method="sentence",
-	chunk_size=1,
-))
-pipeline.add("embed_docs", hagi.DocumentEmbedder(
-	embeddings=embeddings
-))
+pipeline.add("split_into_chunk", DocumentSplitter())
+pipeline.add("embed_docs", DocumentEmbedder(embeddings=embeddings))
 
 final_docs = pipeline(input_docs)
+
+# You can also access intermediary output by using the 'get_output' method
+
+splitted_chunks = pipeline.get_output("split_into_chunk")
 ```
\ No newline at end of file
```

**File**: `docs/Deployment.md` (added, +3/-0)
```diff
@@ -0,0 +1,3 @@
+# Deployment
+
+TODO
\ No newline at end of file
```

**File**: `docs/FAQ.md` (added, +11/-0)
```diff
@@ -0,0 +1,11 @@
+# FAQ
+
+## Frequently Asked Questions
+
+### What is the difference between LangGraph and HybridAGI?
+
+TODO
+
+### What is the difference between Llama-Index and HybridAGI?
+
+TODO
\ No newline at end of file
```

---

### Incident Patch 6: `9b7a2e61` (2024-09-16)
**Commit Message**: Fix FalkorDB memory

**File**: `hybridagi/memory/integration/falkordb/falkordb_document_memory.py` (modified, +12/-9)
```diff
@@ -84,12 +84,12 @@ def update(self, doc_or_docs: Union[Document, DocumentList]) -> None:
             }
             self._graph.query(
                 " ".join([
-                "MERGE (d:Document {id: $id})"
-                "SET"
-                "d.text=$text",
-                "d.parent_id=$parent_id", 
-                "d.metadata=$metadata",
-                "d.vector:vecf32($vector)"]),
+                "MERGE (d:Document {id: $id})",
+                "SET",
+                "d.text=$text,",
+                "d.parent_id=$parent_id,",
+                "d.metadata=$metadata,",
+                "d.vector=vecf32($vector)"]),
                 params = params,
             )
             params = {
@@ -103,12 +103,12 @@ def update(self, doc_or_docs: Union[Document, DocumentList]) -> None:
                 parent_id = str(doc.parent_id)
                 params = {
                     "id": doc_id,
-                    "parent": parent_id,
+                    "parent_id": parent_id,
                 }
                 self._graph.query(
                     " ".join([
                     "MATCH (d:Document {id: $id})",
-                    "MERGE (d)-[:PART_OF]->(:Document {id: $parent})"]),
+                    "MERGE (d)-[:PART_OF]->(:Document {id: $parent_id})"]),
                     params = params,
                 )
 
@@ -166,7 +166,10 @@ def get(self, id_or_ids: Union[UUID, str, List[Union[UUID, str]]]) -> DocumentLi
                 )
                 text = query_result.result_set[0][0].properties["text"]
                 metadata = query_result.result_set[0][0].properties["metadata"]
-                parent_id = query_result.result_set[0][0].properties["parent_id"]
+                if "parent_id" in query_result.result_set[0][0].properties:
+                    parent_id = query_result.result_set[0][0].properties["parent_id"]
+                else:
+                    parent_id = None
                 if parent_id:
                     try:
                         parent_id = UUID(parent_id)
```

**File**: `hybridagi/memory/integration/falkordb/falkordb_fact_memory.py` (modified, +3/-3)
```diff
@@ -81,15 +81,15 @@ def update(self, entities_or_facts: Union[Entity, EntityList, Fact, FactList]) -
                     "metadata": json.dumps(ent.metadata),
                 }
                 self._graph.query(
-                    "".join([
+                    " ".join([
                     "MERGE (e:Entity,",
                     str(ent.label),
                     "{id: $id})",
-                    "SET"
+                    "SET",
                     "e.name=$name,",
                     "e.description=$description,",
                     "e.metadata=$metadata,",
-                    "e.vector:vecf32($vector)"]),
+                    "e.vector=vecf32($vector)"]),
                     params = params,
                 )
         else:
```

**File**: `hybridagi/memory/integration/falkordb/falkordb_trace_memory.py` (modified, +5/-4)
```diff
@@ -88,9 +88,10 @@ def update(self, step_or_steps: Union[AgentStep, AgentStepList]) -> None:
                     "created_at": step.created_at.strftime(DATETIME_FORMAT),
                 }
                 self._graph.query(
-                    "".join([
+                    " ".join([
                     "MERGE (s:AgentStep {id: $id})",
-                    "SET s.parent_id=$parent_id,",
+                    "SET",
+                    "s.parent_id=$parent_id,",
                     "s.hop=$hop,",
                     "s.step_type=$step_type,",
                     "s.inputs=$inputs,",
@@ -104,10 +105,10 @@ def update(self, step_or_steps: Union[AgentStep, AgentStepList]) -> None:
                 parent_id = str(step.parent_id)
                 params = {
                     "id": step_id,
-                    "parent": parent_id,
+                    "parent_id": parent_id,
                 }
                 self._graph.query(
-                    "MATCH (child:AgentStep {id: $id}), (parent:AgentStep {id: $parent}) MERGE (parent)-[:NEXT]->(child)",
+                    "MATCH (child:AgentStep {id: $id}), (parent:AgentStep {id: $parent_id}) MERGE (parent)-[:NEXT]->(child)",
                     params = params,
                 )
 
```

**File**: `tests/memory/integration/falkordb/test_falkordb_document_memory_integration.py` (modified, +1/-35)
```diff
@@ -52,38 +52,4 @@ def test_local_document_memory_add_doc_list():
     document_memory.update(doc_list)
     result_list = document_memory.get([d.id for d in doc_list.docs])
     assert doc_list.docs[0] == result_list.docs[0]
-    assert doc_list.docs[1] == result_list.docs[1]
-    
-# def test_local_document_memory_remove_one_doc(falkordb_document_memory):
-#     doc = dt.Document(text="This is a test text")
-#     falkordb_document_memory.update(doc)
-#     assert falkordb_document_memory._documents[str(doc.id)] == doc
-#     falkordb_document_memory.remove(doc.id)
-#     assert len(falkordb_document_memory._documents) == 0
-    
-# def test_local_document_memory_remove_multiple_docs(falkordb_document_memory):
-#     doc_list = dt.DocumentList()
-#     doc_list.docs = [
-#         dt.Document(text="This is a test text"),
-#         dt.Document(text="This is another test text"),
-#     ]
-#     falkordb_document_memory.update(doc_list)
-#     assert len(falkordb_document_memory._documents) == 2
-#     ids = [d.id for d in doc_list.docs]
-#     falkordb_document_memory.remove(ids)
-#     assert len(falkordb_document_memory._documents) == 0
-    
-# def test_local_document_memory_get_one_doc(falkordb_document_memory):
-#     doc = dt.Document(text="This is a test text", metadata={"key": "value"})
-#     falkordb_document_memory.update(doc)
-#     assert falkordb_document_memory._documents[str(doc.id)] == doc
-#     res = falkordb_document_memory.get(doc.id)
-#     assert len(res.docs) == 1
-#     retrieved_doc = res.docs[0]
-#     assert retrieved_doc.id == doc.id
-#     assert retrieved_doc.text == doc.text
-#     assert retrieved_doc.parent_id == doc.parent_id
-#     assert retrieved_doc.metadata == {"key": "value"}
-#     # Compare vectors element-wise if they exist
-#     if doc.vector is not None and retrieved_doc.vector is not None:
-#         assert all(abs(a - b) < 1e-6 for a, b in zip(doc.vector, retrieved_doc.vector))
+    assert doc_list.docs[1] == result_list.docs[1]
\ No newline at end of file
```

---

### Incident Patch 7: `26dc1c0a` (2024-09-16)
**Commit Message**: Finish falkordb fact memory and retrievers

**File**: `hybridagi/core/datatypes.py` (modified, +0/-1)
```diff
@@ -127,7 +127,6 @@ class Fact(BaseModel):
     subj: Entity = Field(description="Entity that is the subject of the fact", default=None)
     rel: Relationship = Field(description="Relation between the subject and object entities", default=None)
     obj: Entity = Field(description="Entity that is the object of the fact", default=None)
-    weight: float = Field(description="The fact weight (between 0.0 and 1.0, default 1.0)", default=1.0)
     vector: Optional[List[float]] = Field(description="Vector representation of the fact", default=None)
     metadata: Optional[Dict[str, Any]] = Field(description="Additional information about the fact", default={})
     
```

**File**: `hybridagi/memory/integration/falkordb/falkordb_document_memory.py` (modified, +24/-35)
```diff
@@ -65,12 +65,6 @@ def update(self, doc_or_docs: Union[Document, DocumentList]) -> None:
 
         Raises:
             ValueError: If the input is neither a Document nor a DocumentList.
-
-        Note:
-            - If a document with the given ID already exists, it will be updated.
-            - If a document with the given ID doesn't exist, a new one will be created.
-            - For documents with a parent_id, a PART_OF relationship is created or updated.
-            - Document metadata is stored as properties on the Document node.
         """
         if not isinstance(doc_or_docs, (Document, DocumentList)):
             raise ValueError("Invalid datatype provided must be Document or DocumentList")
@@ -81,29 +75,23 @@ def update(self, doc_or_docs: Union[Document, DocumentList]) -> None:
             documents = doc_or_docs
         for doc in documents.docs:
             doc_id = str(doc.id)
-            if doc.vector is not None:
-                params = {
-                    "id": doc_id,
-                    "parent_id": str(doc.parent_id) if doc.parent_id else "",
-                    "text": doc.text,
-                    "vector": doc.vector,
-                    "metadata": json.dumps(doc.metadata)
-                }
-                self._graph.query(
-                    "MERGE (d:Document {id: $id}) SET d.text=$text, d.parent_id=$parent_id d.metadata=$metadata, d.vector:vecf32($vector)",
-                    params = params,
-                )
-            else:
-                params = {
-                    "id": doc_id,
-                    "parent_id": str(doc.parent_id) if doc.parent_id else "",
-                    "text": doc.text,
-                    "metadata": json.dumps(doc.metadata)
-                }
-                self._graph.query(
-                    "MERGE (d:Document {id: $id}) SET d.text=$text, d.parent_id=$parent_id, d.metadata=$metadata",
-                    params = params,
-                )
+            params = {
+                "id": doc_id,
+                "parent_id": str(doc.parent_id) if doc.parent_id else None,
+                "text": doc.text,
+                "vector": list(doc.vector) if doc.vector is not None else None,
+                "metadata": json.dumps(doc.metadata)
+            }
+            self._graph.query(
+                " ".join([
+                "MERGE (d:Document {id: $id})"
+                "SET"
+                "d.text=$text",
+                "d.parent_id=$parent_id", 
+                "d.metadata=$metadata",
+                "d.vector:vecf32($vector)"]),
+                params = params,
+            )
             params = {
                 "id": doc_id,
             }
@@ -118,7 +106,9 @@ def update(self, doc_or_docs: Union[Document, DocumentList]) -> None:
                     "parent": parent_id,
                 }
                 self._graph.query(
-                    "MATCH (d:Document {id: $id}) MERGE (d)-[:PART_OF]->(:Document {id: $parent})",
+                    " ".join([
+                    "MATCH (d:Document {id: $id})",
+                    "MERGE (d)-[:PART_OF]->(:Document {id: $parent})"]),
                     params = params,
                 )
 
@@ -139,11 +129,10 @@ def remove(self, id_or_ids: Union[UUID, str, List[Union[UUID, str]]]) -> None:
             documents_ids = id_or_ids
         for doc_id in documents_ids:
             doc_id = str(doc_id)
-            if self.exist(doc_id):
-                self._graph.query(
-                    "MATCH (n:Document {id: $id}) DETACH DELETE n",
-                    params={"id": doc_id}
-                )
+            self._graph.query(
+                "MATCH (n:Document {id: $id}) DETACH DELETE n",
+                params={"id": doc_id}
+            )
 
     def get(self, id_or_ids: Union[UUID, str, List[Union[UUID, str]]]) -> DocumentList:
         """
```

**File**: `hybridagi/memory/integration/falkordb/falkordb_fact_memory.py` (modified, +175/-246)
```diff
@@ -1,6 +1,5 @@
-#TODO finish it
-
 from typing import Union, List, Optional, Dict
+import json
 from uuid import UUID
 from collections import OrderedDict
 from hybridagi.memory.fact_memory import FactMemory
@@ -16,16 +15,6 @@ class FalkorDBFactMemory(FalkorDBMemory, FactMemory):
     providing a robust solution for storing and managing facts in a graph database.
     It allows for efficient storage, retrieval, and manipulation of entities and
     their relationships (facts) using FalkorDB's graph capabilities.
-
-    Key features:
-    1. Entity management: Store and retrieve entities with their properties.
-    2. Fact storage: Represent relationships between entities as facts.
-    3. Efficient querying: Utilize FalkorDB's graph querying capabilities for fast data retrieval.
-    4. Vector embeddings: Support for storing and querying vector embeddings of entities and facts.
-    5. CRUD operations: Implement create, read, update, and delete operations for both entities and facts.
-
-    This implementation provides a scalable and flexible solution for fact-based
-    knowledge representation in AI and machine learning applications.
     """
    
     def __init__(
@@ -36,291 +25,231 @@ def __init__(
         port: int = 6379,
         username: str = "",
         password: str = "",
-        indexed_label: str = "Entity",
         wipe_on_start: bool = False,
     ):
         super().__init__(
             index_name = index_name,
             graph_index = graph_index,
-            embeddings = embeddings,
             hostname = hostname,
             port = port,
             username = username,
             password = password,
-            indexed_label = indexed_label,
             wipe_on_start = wipe_on_start,
         )
 
-    def exist(self, fact_or_entity_id) -> bool:
+    def exist(self, entity_or_fact_id: Union[UUID, str]) -> bool:
         """
         Check if a fact or entity exists in the database.
 
         Args:
-            fact_or_entity_id: The ID of the fact or entity to check.
+            entity_or_fact_id: The ID of the fact or entity to check.
 
         Returns:
             bool: True if the fact or entity exists, False otherwise.
         """
-        query = (
-            "MATCH (e:Entity {id: $id}) RETURN COUNT(e) AS count "
-            "UNION ALL "
-            "MATCH ()-[r:RELATION {id: $id}]->() RETURN COUNT(r) AS count"
-        )
-        params = {"id": str(fact_or_entity_id)}
-        result = self._graph.query(query, params=params)
-        return sum(int(count[0]) for count in result.result_set) > 0
+        result = super().exist(entity_or_fact_id, "Entity")
+        if result:
+            return result
+        else:
+            return super().exist_fact(entity_or_fact_id)
 
-    def _update_entities(self, entities: Union[Entity, EntityList]) -> None:
+    def update(self, entities_or_facts: Union[Entity, EntityList, Fact, FactList]) -> None:
         """
-        Update or create entities in the FalkorDB graph and local cache.
+        Update the FalkorDB fact memory with new entities or facts.
 
-        This method takes either a single Entity or an EntityList and updates or creates
-        the corresponding nodes in the graph and local cache. If an entity with the given ID already exists,
-        its properties are updated. If it doesn't exist, a new entity node is created.
-
-        Args:
-            entities (Union[Entity, EntityList]): The entity or list of entities to update or create.
+        Parameters:
+            entities_or_facts (Union[Entity, EntityList, Fact, FactList]): An entity or a list of entities, or a fact or a list of facts to be added to the memory.
 
-        Note:
-            - The method uses a MERGE operation, which either matches existing nodes or creates new ones.
-            - Entity properties (name, description, and vector) are updated or set.
-            - The vector is converted to a list if present, or set to None if not available.
-            - The label is included in the properties instead of being part of the node label.
-            - The entity is also stored in the local cache (_entities) and its embedding in _entities_embeddings.
-        """
-        entities = [entities] if isinstance(entities, Entity) else entities.entities
-        for entity in entities:
-            params = {
-                "id": str(entity.id),
-                "properties": {
-                    "name": entity.name,
-                    "label": entity.label,
-                    "description": entity.description,
-                    "vector": list(entity.vector) if entity.vector is not None else None
+        Raises:
+            ValueError: If the input is not an Entity, EntityList, Fact, or FactList.
+        """
+        if not isinstance(entities_or_facts, (Entity, EntityList, Fact, FactList)):
+            raise ValueError("Invalid datatype provided must be Entity, EntityList, Fact or FactList")
+        if isinsta
```

**File**: `hybridagi/memory/integration/falkordb/falkordb_memory.py` (modified, +6/-2)
```diff
@@ -56,9 +56,13 @@ def __init__(
             self.clear()
             
     def exist(self, index: Union[UUID, str], label:str) -> bool:
-        index = str(index)
         query = "MATCH (n:"+label+" {id: $index}) RETURN n"
-        result = self._graph.query(query, params={"index": index})
+        result = self._graph.query(query, params={"index": str(index)})
+        return len(result.result_set) > 0
+    
+    def exist_fact(self, index: Union[UUID, str]) -> bool:
+        query = "MATCH ()-[f:FACT {id: $index}]->() RETURN f"
+        result = self._graph.query(query, params={"index": str(index)})
         return len(result.result_set) > 0
 
     def get_graph(self, graph_index: str) -> Graph:
```

**File**: `hybridagi/memory/integration/falkordb/falkordb_program_memory.py` (modified, +18/-26)
```diff
@@ -66,27 +66,20 @@ def update(self, program_or_programs: Union[GraphProgram, GraphProgramList]) ->
             programs = program_or_programs
         for prog in programs.progs:
             prog_id = str(prog.name)
-            if prog.vector is not None:
-                params = {
-                    "id": prog_id,
-                    "program": prog.to_cypher(),
-                    "vector": list(prog.vector),
-                    "metadata": json.dumps(prog.metadata)
-                }
-                self._graph.query(
-                    "MERGE (p:Program {id: $id}) SET p.program=$program, p.metadata=$metadata, p.vector=vecf32($vector)",
-                    params = params,
-                )
-            else:
-                params = {
-                    "id": prog_id,
-                    "program": prog.to_cypher(),
-                    "metadata": json.dumps(prog.metadata)
-                }
-                self._graph.query(
-                    "MERGE (p:Program {id: $id}) SET p.program=$program, p.metadata=$metadata",
-                    params = params,
-                )
+            params = {
+                "id": prog_id,
+                "program": prog.to_cypher(),
+                "vector": list(prog.vector) if prog.vector is not None else None,
+                "metadata": json.dumps(prog.metadata)
+            }
+            self._graph.query(
+                " ".join([
+                "MERGE (p:Program {id: $id})",
+                "SET p.program=$program,",
+                "p.metadata=$metadata,",
+                "p.vector=vecf32($vector)"]),
+                params = params,
+            )
             params = {
                 "id": prog_id,
             }
@@ -117,11 +110,10 @@ def remove(self, id_or_ids: Union[UUID, str, List[Union[UUID, str]]]) -> None:
             programs_ids = id_or_ids
         for prog_id in programs_ids:
             prog_id = str(prog_id)
-            if self.exist(prog_id):
-                self._graph.query(
-                    "MATCH (n:Program {id: $id}) DETACH DELETE n",
-                    params={"id": prog_id}
-                )
+            self._graph.query(
+                "MATCH (n:Program {id: $id}) DETACH DELETE n",
+                params={"id": prog_id}
+            )
                 
     def get(self, id_or_ids: Union[UUID, str, List[Union[UUID, str]]]) -> GraphProgramList:
         """
```

**File**: `hybridagi/memory/integration/falkordb/falkordb_trace_memory.py` (modified, +12/-18)
```diff
@@ -78,32 +78,26 @@ def update(self, step_or_steps: Union[AgentStep, AgentStepList]) -> None:
             if step.vector is not None:
                 params = {
                     "id": step_id,
-                    "parent_id": str(step.parent_id) if step.parent_id else "",
+                    "parent_id": str(step.parent_id) if step.parent_id else None,
                     "hop": step.hop,
                     "step_type": step.step_type.value,
                     "inputs": json.dumps(step.inputs) if step.inputs else "{}",
                     "outputs": json.dumps(step.outputs) if step.inputs else "{}",
-                    "vector": list(step.vector),
+                    "vector": list(step.vector) if step.vector is not None else None,
                     "metadata": json.dumps(step.metadata),
                     "created_at": step.created_at.strftime(DATETIME_FORMAT),
                 }
                 self._graph.query(
-                    "MERGE (s:AgentStep {id: $id}) SET s.parent_id=$parent_id, s.hop=$hop, s.step_type=$step_type, s.inputs=$inputs, s.outputs=$outputs, s.vector=vecf32($vector), s.metadata=$metadata, s.created_at=$created_at",
-                    params = params,
-                )
-            else:
-                params = {
-                    "id": step_id,
-                    "parent_id": str(step.parent_id) if step.parent_id else "",
-                    "hop": step.hop,
-                    "step_type": step.step_type.value,
-                    "inputs": json.dumps(step.inputs) if step.inputs else "{}",
-                    "outputs": json.dumps(step.outputs) if step.inputs else "{}",
-                    "metadata": json.dumps(step.metadata),
-                    "created_at": step.created_at.strftime(DATETIME_FORMAT),
-                }
-                self._graph.query(
-                    "MERGE (s:AgentStep {id: $id}) SET s.parent_id=$parent_id, s.hop=$hop, s.step_type=$step_type, s.inputs=$inputs, s.outputs=$outputs, s.metadata=$metadata, s.created_at=$created_at",
+                    "".join([
+                    "MERGE (s:AgentStep {id: $id})",
+                    "SET s.parent_id=$parent_id,",
+                    "s.hop=$hop,",
+                    "s.step_type=$step_type,",
+                    "s.inputs=$inputs,",
+                    "s.outputs=$outputs,",
+                    "s.vector=vecf32($vector),",
+                    "s.metadata=$metadata,",
+                    "s.created_at=$created_at"]),
                     params = params,
                 )
             if step.parent_id is not None:
```

**File**: `hybridagi/memory/integration/local/local_fact_memory.py` (modified, +2/-3)
```diff
@@ -74,9 +74,8 @@ def update(self, entities_or_facts: Union[Entity, EntityList, Fact, FactList]) -
         Raises:
             ValueError: If the input is not an Entity, EntityList, Fact, or FactList.
         """
-        if not isinstance(entities_or_facts, Entity) and not isinstance(entities_or_facts, EntityList) and \
-            not isinstance(entities_or_facts, Fact) and not isinstance(entities_or_facts, FactList):
-            raise ValueError("Invalid datatype provided must be Entity or EntityList or Fact or FactList")
+        if not isinstance(entities_or_facts, (Entity, EntityList, Fact, FactList)):
+            raise ValueError("Invalid datatype provided must be Entity, EntityList, Fact or FactList")
         if isinstance(entities_or_facts, Entity) or isinstance(entities_or_facts, EntityList):
             if isinstance(entities_or_facts, Entity):
                 entities = EntityList()
```

**File**: `hybridagi/modules/queries/integration/local/faiss_query_fact.py` (removed, +0/-18)
```diff
@@ -1,18 +0,0 @@
-import dspy
-
-class PartiallyParametrableQuery(BaseModel):
-    subj: Optional[str] = Field(description="The subject of the relation (None if unknow)", default=None)
-    rel: Optional[str] = Field(description="The predicate of the relation (None if unknown)", default=None)
-    obj: Optional[str] = Field(description="The object of the relation (None if unknow)", default=None)
-
-class QueryToPartiallyParametrableQuery(dspy.Signature):
-    query: str = dspy.Input(desc="The natural language query to translate into a partially parametrable query")
-    fact: PartiallyParametrableQuery = dspy.Output(desc="The partially parametrable query")
-
-class FAISSQueryFact(dspy.Module):
-    
-    def __init__(self):
-        pass#TODO
-    
-    def forward(self, query: Query) -> QueryWithFacts:
-        pass#TODO
\ No newline at end of file
```

---

### Incident Patch 8: `18ee99ac` (2024-09-11)
**Commit Message**: Modify episodic memory notebook to make it more robust

**File**: `hybridagi/modules/retrievers/integration/falkordb/falkordb_document_retriever.py` (modified, +1/-0)
```diff
@@ -0,0 +1 @@
+#TODO
\ No newline at end of file
```

**File**: `hybridagi/modules/retrievers/integration/falkordb/falkordb_entity_retriever.py` (modified, +1/-0)
```diff
@@ -0,0 +1 @@
+#TODO
\ No newline at end of file
```

**File**: `hybridagi/modules/retrievers/integration/falkordb/falkordb_fact_retriever.py` (modified, +1/-0)
```diff
@@ -0,0 +1 @@
+#TODO
\ No newline at end of file
```

**File**: `hybridagi/modules/retrievers/integration/falkordb/falkordb_graph_program_retriever.py` (modified, +1/-0)
```diff
@@ -0,0 +1 @@
+#TODO
\ No newline at end of file
```

---

### Incident Patch 9: `1f5e2fd7` (2024-09-11)
**Commit Message**: Add multi-query to retrievers + add falkordb action retriever + fix some falkordb integration typo

**File**: `README.md` (modified, +14/-0)
```diff
@@ -14,6 +14,20 @@
 
 **Disclaimer:** We are currently refactoring the project for better modularity and better ease of use. For now, only the Local integration if available, the FalkorDB & Kuzu integration will be done at the end of this refactoring. At that time we will accept contributions for the integration of other Cypher-based graph databases. For more information, join the Discord channel.
 
+## Key Features
+
+- **Turing Complete DSL**: HybridAGI's Turing Complete Domain Specific Language (DSL) has been specifically designed to describe an infinite number of algorithms using only 4 different types of nodes (Control, Action, Decision, Program). The interpreter Agent can loop and call subprograms, similar to a traditional programming language.
+
+- **Graph Program Search & Dynamic Call**: Because our agent system is not a static finite state machine but an interpreter that interprets a graph-based DSL node by node, it can search programs into memory and dynamically call the best one to solve the user query.
+
+- **Optimizable Pipeline & Agent**: With HybridAGI and DSPy, you can optimize the data processing pipelines and the agent system to your own needs. Since each HybridAGI module is also a DSPy module, you can use DSPy optimizers seamlessly with them.
+
+- **Agent Behavior as Software**: With HybridAGI, you can ship the Agent's behavior as Cypher software, enabling start-ups and companies to create their own IP based on their business logic implemented in Cypher.
+
+- **Memory-Centric System**: HybridAGI is a memory-centric system that heavily uses Knowledge Graphs, both for executing programs and to store structured knowledge. This enables Knowledge Graph RAG applications for critical domains.
+
+- **Secure and Safe**: Special attention has been given to prevent Cypher Injections but also to prevent the Agent system from modifying its own main prompting mechanism by introducing the concept of protected programs.
+
 ## Notebooks
 
 - [Datatypes](notebooks/datatypes.ipynb)
```

**File**: `hybridagi/core/datatypes.py` (modified, +11/-11)
```diff
@@ -33,7 +33,7 @@ def __init__(self, **kwargs):
         dspy.Prediction.__init__(self, **kwargs)
         
     def to_dict(self):
-        return {"queries": [q.to_dict() for q in self.queries]}
+        return {"queries": [q.query for q in self.queries]}
 
 class Document(BaseModel):
     id: Union[UUID, str] = Field(description="Unique identifier for the document", default_factory=uuid4)
@@ -59,15 +59,15 @@ def to_dict(self):
         return {"documents": [d.to_dict() for d in self.docs]}
 
 class QueryWithDocuments(BaseModel, dspy.Prediction):
-    query: Query = Field(description="The input query", default_factory=Query)
+    queries: QueryList = Field(description="The input query list", default_factory=QueryList)
     docs: Optional[List[Document]] = Field(description="List of documents", default=[])
     
     def __init__(self, **kwargs):
         BaseModel.__init__(self, **kwargs)
         dspy.Prediction.__init__(self, **kwargs)
         
     def to_dict(self):
-        return {"query": self.query.query, "documents": [d.to_dict() for d in self.docs]}
+        return {"queries": [q.query for q in self.queries.queries], "documents": [d.to_dict() for d in self.docs]}
 
 class Entity(BaseModel):
     id: Union[UUID, str] = Field(description="Unique identifier for the entity", default_factory=uuid4)
@@ -100,15 +100,15 @@ def to_dict(self):
         return {"entities": [e.to_dict() for e in self.entities]}
     
 class QueryWithEntities(BaseModel, dspy.Prediction):
-    query: Query = Field(description="The input query", default_factory=Query)
+    queries: QueryList = Field(description="The input query list", default_factory=QueryList)
     entities: List[Entity] = Field(description="List of entities", default=[])
     
     def __init__(self, **kwargs):
         BaseModel.__init__(self, **kwargs)
         dspy.Prediction.__init__(self, **kwargs)
     
     def to_dict(self):
-        return {"query": self.query.query, "entities": [e.to_dict() for e in self.entities]}
+        return {"queries": [q.query for q in self.queries.queries], "entities": [e.to_dict() for e in self.entities]}
     
 class Relationship(BaseModel):
     id: Union[UUID, str] = Field(description="Unique identifier for the relation", default_factory=uuid4)
@@ -240,15 +240,15 @@ def to_dict(self):
         return {"schema": [s.to_dict() for s in self.schemas]}
     
 class QueryWithFacts(BaseModel, dspy.Prediction):
-    query: Query = Field(description="The input query", default_factory=Query)
+    queries: QueryList = Field(description="The input query list", default_factory=QueryList)
     facts: Optional[List[Fact]] = Field(description="List of facts", default=[])
     
     def __init__(self, **kwargs):
         BaseModel.__init__(self, **kwargs)
         dspy.Prediction.__init__(self, **kwargs)
         
     def to_dict(self):
-        return {"query": self.query.query, "facts": [f.to_dict() for f in self.facts]}
+        return {"queries": [q.query for q in self.queries.queries], "facts": [f.to_dict() for f in self.facts]}
 
 class UserProfile(BaseModel):
     id: Union[UUID, str] = Field(description="Unique identifier for the user", default_factory=uuid4)
@@ -379,11 +379,11 @@ def to_dict(self):
         return {"steps": [s.to_dict() for s in self.steps]}
     
 class QueryWithSteps(BaseModel, dspy.Prediction):
-    query: Query = Field(description="The input query", default_factory=Query)
+    queries: QueryList = Field(description="The input query list", default_factory=QueryList)
     steps: List[AgentStep] = Field(description="List of agent steps", default=[])
     
     def to_dict(self):
-        return {"query": self.query.query, "steps": [s.to_dict() for s in self.steps]}
+        return {"queries": [q.query for q in self.queries.queries], "steps": [s.to_dict() for s in self.steps]}
     
 class FinishReason(str, Enum):
     MaxIters = "max_iters"
@@ -466,12 +466,12 @@ def to_dict(self):
         return {"routines": [p.to_dict() for p in self.progs]}
     
 class QueryWithGraphPrograms(BaseModel, dspy.Prediction):
-    query: Query = Field(description="The input query", default_factory=Query)
+    queries: QueryList = Field(description="The input query list", default_factory=QueryList)
     progs: Optional[List[GraphProgram]] = Field(description="List of graph programs", default=[])
     
     def __init__(self, **kwargs):
         BaseModel.__init__(self, **kwargs)
         dspy.Prediction.__init__(self, **kwargs)
         
     def to_dict(self):
-        return {"query": self.query.query, "routines": [p.to_dict() for p in self.progs]}
+        return {"queries": [q.query for q in self.queries.queries], "routines": [p.to_dict() for p in self.progs]}
```

**File**: `hybridagi/core/graph_program.py` (modified, +2/-2)
```diff
@@ -296,7 +296,7 @@ def from_cypher(self, cypher_query: str) -> Optional["GraphProgram"]:
                         purpose=step_props["purpose"],
                         tool=step_props["tool"],
                         prompt=step_props["prompt"],
-                        inputs=step_props["inputs"] if "inputs" in step_props else None,
+                        inputs=step_props["inputs"] if "inputs" in step_props else [],
                         output=step_props["output"] if "output" in step_props else None,
                         disable_inference=True if "disable_inference" in step_props else False,
                     ))
@@ -311,7 +311,7 @@ def from_cypher(self, cypher_query: str) -> Optional["GraphProgram"]:
                         id=step_props["id"],
                         purpose=step_props["purpose"],
                         question=step_props["question"],
-                        inputs=step_props["inputs"] if "inputs" in step_props else None,
+                        inputs=step_props["inputs"] if "inputs" in step_props else [],
                     ))
                 elif step_type == "Program":
                     if "id" not in step_props:
```

**File**: `hybridagi/memory/integration/falkordb/falkordb_fact_memory.py` (modified, +9/-63)
```diff
@@ -31,7 +31,6 @@ class FalkorDBFactMemory(FalkorDBMemory, FactMemory):
     def __init__(
         self,
         index_name: str,
-        embeddings: Embeddings,
         graph_index: str = "fact_memory",
         hostname: str = "localhost",
         port: int = 6379,
@@ -68,7 +67,7 @@ def exist(self, fact_or_entity_id) -> bool:
             "MATCH ()-[r:RELATION {id: $id}]->() RETURN COUNT(r) AS count"
         )
         params = {"id": str(fact_or_entity_id)}
-        result = self.hybridstore.query(query, params=params)
+        result = self._graph.query(query, params=params)
         return sum(int(count[0]) for count in result.result_set) > 0
 
     def _update_entities(self, entities: Union[Entity, EntityList]) -> None:
@@ -101,12 +100,7 @@ def _update_entities(self, entities: Union[Entity, EntityList]) -> None:
                 }
             }
             query = "MERGE (e:Entity {id: $id}) SET e += $properties"
-            self.hybridstore.query(query, params=params)
-
-            # Update local cache
-            self._entities[str(entity.id)] = entity
-            if entity.vector is not None:
-                self._entities_embeddings[str(entity.id)] = list(entity.vector)
+            self._graph.query(query, params=params)
 
     def _update_facts(self, facts: Union[Fact, FactList]) -> None:
         """
@@ -138,7 +132,7 @@ def _update_facts(self, facts: Union[Fact, FactList]) -> None:
                     "vector": list(fact.vector) if fact.vector is not None else None
                 }
             }
-            self.hybridstore.query(
+            self._graph.query(
                 "MATCH (s:Entity {id: $subject_id}), (o:Entity {id: $object_id}) "
                 "MERGE (s)-[r:RELATION {id: $id}]->(o) "
                 "SET r += $properties",
@@ -157,7 +151,7 @@ def get_entities(self, id_or_ids: Union[UUID, str, List[Union[UUID, str]]]) -> E
             EntityList: A list of retrieved entities.
         """
         ids = [str(id_or_ids)] if isinstance(id_or_ids, (UUID, str)) else [str(id) for id in id_or_ids]
-        result = self.hybridstore.query(
+        result = self._graph.query(
             "MATCH (e:Entity) WHERE e.id IN $ids "
             "RETURN e",
             params={"ids": ids}
@@ -187,7 +181,7 @@ def get_facts(self, id_or_ids: Union[UUID, str, List[Union[UUID, str]]]) -> Fact
             FactList: A list of retrieved facts.
         """
         ids = [str(id_or_ids)] if isinstance(id_or_ids, (UUID, str)) else [str(id) for id in id_or_ids]
-        result = self.hybridstore.query(
+        result = self._graph.query(
             "MATCH (s:Entity)-[r:RELATION]->(o:Entity) WHERE r.id IN $ids "
             "RETURN r, s, o",
             params={"ids": ids}
@@ -227,7 +221,7 @@ def get_related_facts(self, entity_id: Union[UUID, str], relation: Optional[str]
             "RETURN r AS fact, s AS subject, e AS object"
         )
         params = {"entity_id": str(entity_id), "relation": relation}
-        result = self.hybridstore.query(query, params=params)
+        result = self._graph.query(query, params=params)
         
         facts = FactList()
         for row in result.result_set:
@@ -255,40 +249,7 @@ def get_entities_by_type(self, entity_type: str) -> EntityList:
         """
         query = "MATCH (e:Entity {label: $entity_type}) RETURN e"
         params = {"entity_type": entity_type}
-        result = self.hybridstore.query(query, params=params)
-        
-        entities = EntityList()
-        for row in result.result_set:
-            entity_data = row[0]
-            entity = Entity(
-                id=entity_data.properties.get('id'),
-                name=entity_data.properties.get('name'),
-                label=entity_data.properties.get('label'),
-                description=entity_data.properties.get('description'),
-                vector=entity_data.properties.get('vector')
-            )
-            entities.entities.append(entity)
-        return entities
-
-    def search_entities(self, query: str, limit: int = 10) -> EntityList:
-        """
-        Search for entities based on a query string.
-
-        Args:
-            query: The search query string.
-            limit: The maximum number of results to return.
-
-        Returns:
-            EntityList: A list of entities matching the search query.
-        """
-        cypher_query = (
-            "MATCH (e:Entity) "
-            "WHERE e.name CONTAINS $query OR e.description CONTAINS $query "
-            "RETURN e "
-            "LIMIT $limit"
-        )
-        params = {"query": query, "limit": limit}
-        result = self.hybridstore.query(cypher_query, params=params)
+        result = self._graph.query(query, params=params)
         
         entities = EntityList()
         for row in result.result_set:
@@ -332,21 +293,6 @@ def update(self, entities_or_facts: Union[Entity, EntityList, Fact, FactList]) -
             self._update_facts(entities_or_facts)
        
```

**File**: `hybridagi/memory/integration/falkordb/falkordb_trace_memory.py` (modified, +8/-8)
```diff
@@ -78,38 +78,38 @@ def update(self, step_or_steps: Union[AgentStep, AgentStepList]) -> None:
             if step.vector is not None:
                 params = {
                     "id": step_id,
-                    "parent_id": str(doc.parent_id) if doc.parent_id else "",
+                    "parent_id": str(step.parent_id) if step.parent_id else "",
                     "hop": step.hop,
                     "step_type": step.step_type.value,
                     "inputs": json.dumps(step.inputs) if step.inputs else "{}",
                     "outputs": json.dumps(step.outputs) if step.inputs else "{}",
                     "vector": list(step.vector),
-                    "metadata": json.dumps(doc.metadata),
+                    "metadata": json.dumps(step.metadata),
                     "created_at": step.created_at.strftime(DATETIME_FORMAT),
                 }
                 self._graph.query(
-                    "MERGE (s:AgentStep {id: $id}) SET s.parent_id=$parent_id, s.hop=$hop, s.step_type=$step_type, s.inputs=$inputs, s.outputs=$outputs, s.vector=vecf32($vector), s.metadata=$metadata, s.created_at=$created_at})",
+                    "MERGE (s:AgentStep {id: $id}) SET s.parent_id=$parent_id, s.hop=$hop, s.step_type=$step_type, s.inputs=$inputs, s.outputs=$outputs, s.vector=vecf32($vector), s.metadata=$metadata, s.created_at=$created_at",
                     params = params,
                 )
             else:
                 params = {
                     "id": step_id,
-                    "parent_id": str(doc.parent_id) if doc.parent_id else "",
+                    "parent_id": str(step.parent_id) if step.parent_id else "",
                     "hop": step.hop,
                     "step_type": step.step_type.value,
                     "inputs": json.dumps(step.inputs) if step.inputs else "{}",
                     "outputs": json.dumps(step.outputs) if step.inputs else "{}",
-                    "metadata": json.dumps(doc.metadata),
+                    "metadata": json.dumps(step.metadata),
                     "created_at": step.created_at.strftime(DATETIME_FORMAT),
                 }
                 self._graph.query(
-                    "MERGE (s:AgentStep {id: $id}) SET s.parent_id=$parent_id, s.hop=$hop, s.step_type=$step_type, s.inputs=$inputs, s.outputs=$outputs, s.metadata=$metadata, s.created_at=$created_at})",
+                    "MERGE (s:AgentStep {id: $id}) SET s.parent_id=$parent_id, s.hop=$hop, s.step_type=$step_type, s.inputs=$inputs, s.outputs=$outputs, s.metadata=$metadata, s.created_at=$created_at",
                     params = params,
                 )
             if step.parent_id is not None:
                 parent_id = str(step.parent_id)
                 params = {
-                    "id": doc_id,
+                    "id": step_id,
                     "parent": parent_id,
                 }
                 self._graph.query(
@@ -132,7 +132,7 @@ def get(self, id_or_ids: Union[UUID, str, List[Union[UUID, str]]]) -> AgentStepL
             AgentStepList: A list of AgentStep objects matching the given ID(s).
         """
         ids = [str(id_or_ids)] if isinstance(id_or_ids, (UUID, str)) else [str(id) for id in id_or_ids]
-        result = self.hybridstore.query(
+        result = self._graph.query(
             "MATCH (s:AgentStep) WHERE s.id IN $ids "
             "RETURN s.id, s.step_type, s.parent_id, s.vector, s.name, s.description",
             params={"ids": ids}
```

**File**: `hybridagi/metrics/agents/factual_answer.py` (added, +35/-0)
```diff
@@ -0,0 +1,35 @@
+# import dspy
+
+# class FactualAnswerSignature(dspy.Signature):
+#     """
+#     Check if the answer is present in the provided trace
+#     If the answer is not helpful to answer the objective question it means No
+#     """
+#     context = dspy.InputField(desc="The context for the prediction")
+#     question = dspy.InputField(desc="Question to be answered")
+#     answer = dspy.InputField(desc="Answer for the question")
+#     correct = dspy.OutputField(
+#         desc="Is the answer factually correct based on the context?",
+#         prefix="Correct[Yes/No]:",
+#     )
+    
+# class FactualAnswer(Metric):
+    
+#     def __init__(
+#         lm: Optional[dspy.LM] = None,
+#     ):
+#         super().__init__(lm=lm)
+
+#     def evaluate(example: Union[Query, QueryWithSession], prediction: AgentOutput, trace=None):
+#         # This line means that we discard the example if the agent reached the max iterations
+#         # Meaning it was probably stuck in a loop
+#         if prediction.finish_reason == "max iters":
+#             return False
+#         # Check if the answer is actually based on the context
+#         with dspy.context(lm=self.lm if self.lm is not None else dspy.settings.lm):
+#             pred = dspy.ChainOfThought(FactualAnswerSignature)(
+#                 context = prediction.program_trace,
+#                 question = example.objective,
+#                 answer = prediction.final_answer,
+#             )
+#         return pred.correct.lower().strip().strip(".")=="yes"
\ No newline at end of file
```

**File**: `hybridagi/metrics/metric.py` (added, +14/-0)
```diff
@@ -0,0 +1,14 @@
+import dspy
+from abc import abstractmethod
+
+class Metric():
+    def __init__(
+            lm: Optional[dspy.LM] = None,
+        ):
+        self.lm = lm
+       
+    @abstractmethod 
+    def eval(example, prediction, trace=None):
+        raise NotImplementedError(
+            f"Metric {type(self).__name__} is missing the required 'eval' method."
+        )
\ No newline at end of file
```

**File**: `hybridagi/modules/agents/graph_interpreter.py` (modified, +24/-18)
```diff
@@ -77,6 +77,8 @@ def __init__(
             entrypoint: str = "main",
             num_history: int = 5,
             max_iters: int = 20,
+            commit_decision_steps: bool = False,
+            decision_lm: Optional[dspy.LM] = None,
             verbose: bool = True,
             debug: bool = False,
         ):
@@ -104,6 +106,8 @@ def __init__(
         self.max_iters = max_iters
         self.decision_parser = DecisionOutputParser()
         self.prediction_parser = PredictionOutputParser()
+        self.commit_decision_steps = commit_decision_steps
+        self.decision_lm = decision_lm
         self.verbose = verbose
         self.debug = debug
         self.previous_agent_step = None
@@ -139,7 +143,8 @@ def run_step(self):
                 print(f"{ACTION_COLOR}{agent_step}{Style.RESET_ALL}")
         elif isinstance(current_step, Decision):
             agent_step = self.decide(current_step)
-            self.agent_state.program_trace.steps.append(str(agent_step))
+            if self.commit_decision_steps:
+                self.agent_state.program_trace.steps.append(str(agent_step))
             if self.verbose:
                 print(f"{DECISION_COLOR}{agent_step}{Style.RESET_ALL}")
         elif isinstance(current_step, Control):
@@ -281,25 +286,26 @@ def decide(self, step: Decision) -> AgentStep:
             trace = "Nothing done yet"
         choices = self.agent_state.get_current_program().get_decision_choices(step.id)
         possible_answers = " or ".join(choices)
-        pred = self.decisions[self.agent_state.decision_hop](
-            objective = self.agent_state.objective.query,
-            context = trace,
-            purpose = step.purpose,
-            question = step.question,
-            options = possible_answers,
-        )
-        pred.choice = pred.choice.replace("\"", "")
-        pred.choice = self.prediction_parser.parse(pred.choice, prefix="Choice:", stop=["."])
-        pred.choice = self.decision_parser.parse(pred.choice, options=choices)
-        if pred.choice not in choices:
-            corrected_pred = self.correct_decision(
-                answer = pred.choice,
+        with dspy.context(lm=self.decision_lm if self.decision_lm is not None else dspy.settings.lm):
+            pred = self.decisions[self.agent_state.decision_hop](
+                objective = self.agent_state.objective.query,
+                context = trace,
+                purpose = step.purpose,
+                question = step.question,
                 options = possible_answers,
             )
-            corrected_pred.choice = corrected_pred.choice.replace("\"", "")
-            corrected_pred.choice = self.prediction_parser.parse(corrected_pred.choice, prefix="Choice:", stop=["."])
-            corrected_pred.choice = self.decision_parser.parse(corrected_pred.choice, options=choices)
-            pred.choice = corrected_pred.choice
+            pred.choice = pred.choice.replace("\"", "")
+            pred.choice = self.prediction_parser.parse(pred.choice, prefix="Choice:", stop=["."])
+            pred.choice = self.decision_parser.parse(pred.choice, options=choices)
+            if pred.choice not in choices:
+                corrected_pred = self.correct_decision(
+                    answer = pred.choice,
+                    options = possible_answers,
+                )
+                corrected_pred.choice = corrected_pred.choice.replace("\"", "")
+                corrected_pred.choice = self.prediction_parser.parse(corrected_pred.choice, prefix="Choice:", stop=["."])
+                corrected_pred.choice = self.decision_parser.parse(corrected_pred.choice, options=choices)
+                pred.choice = corrected_pred.choice
         self.agent_state.decision_hop += 1
         agent_step = AgentStep(
             hop = self.agent_state.current_hop,
```

---

### Incident Patch 10: `ff90ebd7` (2024-09-08)
**Commit Message**: Fix falkordb memories + few small fixes

**File**: `README.md` (modified, +19/-135)
```diff
@@ -10,10 +10,6 @@
 ![Beta](https://img.shields.io/badge/Release-Beta-blue)
 [![License: GPL-3.0](https://img.shields.io/badge/License-GPL-green.svg)](https://opensource.org/license/gpl-3-0/)
 
-<p align="center">
-  <img alt="HybridAGI long-term memory" src="img/memories.svg"/>
-</p>
-
 </div>
 
 **Disclaimer:** We are currently refactoring the project for better modularity and better ease of use. For now, only the Local integration if available, the FalkorDB & Kuzu integration will be done at the end of this refactoring. At that time we will accept contributions for the integration of other Cypher-based graph databases. For more information, join the Discord channel.
@@ -64,122 +60,33 @@ HybridAGI is build upon years of experience in making reliable Robotics systems.
 
 We provide everything for you to build your LLM application with a focus around Cypher Graph databases. We provide also a local database for rapid prototyping before scaling your application with one of our integration.
 
+<div align="center">
+
+![pipeline](img/memories.png)
+
+</div>
+
 ### Predictable/Deterministic behavior and infinite number of tools
 
 Because we don't let the Agent choose the sequence of tools to use, we can use an infinite number of tools. By following the Graph Programs, we ensure a predictable and deterministic methodology for our Agent system. We can combine every memory system into one unique Agent by using the corresponding tools without limitation.
 
-```python
-import hybridagi.core.graph_program as gp
-
-main = gp.GraphProgram(
-    name="main",
-    description="The main program",
-)
-    
-main.add(gp.Decision(
-    id="is_objective_unclear",
-    purpose="Check if the Objective's is unclear",
-    question="Is the Objective's question unclear?",
-))
-
-main.add(gp.Action(
-    id="clarify",
-    purpose="Ask one question to clarify the user's Objective",
-    tool="AskUser",
-    prompt="Please pick one question to clarify the Objective's question",
-))
-
-main.add(gp.Action(
-    id="answer",
-    purpose="Answer the question",
-    tool="Speak",
-    prompt="Please answer to the Objective's question",
-))
-    
-main.add(gp.Action(
-    id="refine_objective",
-    purpose="Refine the objective",
-    tool="UpdateObjective",
-    prompt="Please refine the user Objective",
-))
-    
-main.connect("start", "is_objective_unclear")
-main.connect("is_objective_unclear", "clarify", label="Clarify")
-main.connect("is_objective_unclear", "answer", label="Answer")
-main.connect("clarify", "refine_objective")
-main.connect("refine_objective", "answer")
-main.connect("answer", "end")
-
-main.build() # Verify the structure of the program
-
-print(main)
-# // @desc: The main program
-# CREATE
-# // Nodes declaration
-# (start:Control {id: "start"}),
-# (end:Control {id: "end"}),
-# (is_objective_unclear:Decision {
-#   id: "is_objective_unclear",
-#   purpose: "Check if the Objective's is unclear",
-#   question: "Is the Objective's question unclear?"
-# }),
-# (clarify:Action {
-#   id: "clarify",
-#   purpose: "Ask one question to clarify the user's Objective",
-#   tool: "AskUser",
-#   prompt: "Please pick one question to clarify the Objective's question"
-# }),
-# (answer:Action {
-#   id: "answer",
-#   purpose: "Answer the question",
-#   tool: "Speak",
-#   prompt: "Please answer to the Objective's question"
-# }),
-# (refine_objective:Action {
-#   id: "refine_objective",
-#   purpose: "Refine the objective",
-#   tool: "UpdateObjective",
-#   prompt: "Please refine the user Objective"
-# }),
-# // Structure declaration
-# (start)-[:NEXT]->(is_objective_unclear),
-# (is_objective_unclear)-[:CLARIFY]->(clarify),
-# (is_objective_unclear)-[:ANSWER]->(answer),
-# (clarify)-[:NEXT]->(refine_objective),
-# (answer)-[:NEXT]->(end),
-# (refine_objective)-[:NEXT]->(answer)
-```
+<div align="center">
+
+![pipeline](img/graph_program.png)
+
+</div>
 
 ### Modular Pipelines
 
 With HybridAGI you can build data extraction pipelines, RAG applications or advanced Agent systems, each being possibly optimized by using DSPy optimizers. We also provide pre-made modules and metrics for easy prototyping.
 
 Each module and data type is *strictly typed and use Pydantic* as data validation layer. You can build pipelines in no time by stacking Modules sequentially like in Keras or HuggingFace.
 
-```python
-from hybridagi.embeddings import SentenceTransformerEmbeddings
-from hybridagi.readers import PDFReader
-from hybridagi.core.pipeline import Pipeline
-from hybridagi.modules.splitters import DocumentSentenceSplitter
-from hybridagi.modules.embedders import DocumentEmbedder
-
-embeddings = SentenceTransformerEmbeddings(
-    model_name_or_path = "all-MiniLM-L6-v2",
-    dim = 384, # The dimention of the embeddings vector
-)
-
-reader = PDFReader()
-input_docs = reader("data/SpelkeKinzlerCoreKnowledge.pdf") # This is going to extract 1 document per page
-
-# Now that we have our input documents, we can start to make our data pro
```

**File**: `hybridagi/core/datatypes.py` (modified, +21/-14)
```diff
@@ -41,10 +41,12 @@ class Document(BaseModel):
     parent_id: Optional[Union[UUID, str]] = Field(description="Identifier for the parent document", default=None)
     vector: Optional[List[float]] = Field(description="Vector representation of the document", default=None)
     metadata: Optional[Dict[str, Any]] = Field(description="Additional information about the document", default={})
-    created_at: datetime = Field(description="Time when the document was created", default_factory=datetime.now)
     
     def to_dict(self):
-        return {"text": self.text, "metadata": self.metadata}
+        if self.metadata:
+            return {"text": self.text, "metadata": self.metadata}
+        else:
+            return {"text": self.text}
 
 class DocumentList(BaseModel, dspy.Prediction):
     docs: Optional[List[Document]] = Field(description="List of documents", default=[])
@@ -74,13 +76,18 @@ class Entity(BaseModel):
     description: Optional[str] = Field(description="Description of the entity", default=None)
     vector: Optional[List[float]] = Field(description="Vector representation of the document", default=None)
     metadata: Optional[Dict[str, Any]] = Field(description="Additional information about the document", default={})
-    created_at: datetime = Field(description="Time when the entity was created", default_factory=datetime.now)
     
     def to_dict(self):
-        if self.description is not None:
-            return {"name": self.name, "label": self.label, "description": self.description, "metadata": self.metadata}
+        if self.metadata:
+            if self.description is not None:
+                return {"name": self.name, "label": self.label, "description": self.description, "metadata": self.metadata}
+            else:
+                return {"name": self.name, "label": self.label, "metadata": self.metadata}
         else:
-            return {"name": self.name, "label": self.label, "metadata": self.metadata}
+            if self.description is not None:
+                return {"name": self.name, "label": self.label, "description": self.description}
+            else:
+                return {"name": self.name, "label": self.label}
 
 class EntityList(BaseModel, dspy.Prediction):
     entities: List[Entity] = Field(description="List of entities", default=[])
@@ -108,10 +115,12 @@ class Relationship(BaseModel):
     name: str = Field(description="Relationship name")
     vector: Optional[List[float]] = Field(description="Vector representation of the relationship", default=None)
     metadata: Optional[Dict[str, Any]] = Field(description="Additional information about the relationship", default={})
-    created_at: datetime = Field(description="Time when the relationship was created", default_factory=datetime.now)
     
     def to_dict(self):
-        return {"name": self.name, "metadata": self.metadata}
+        if self.metadata:
+            return {"name": self.name, "metadata": self.metadata}
+        else:
+            return {"name": self.name}
 
 class Fact(BaseModel):
     id: Union[UUID, str] = Field(description="Unique identifier for the fact", default_factory=uuid4)
@@ -121,7 +130,6 @@ class Fact(BaseModel):
     weight: float = Field(description="The fact weight (between 0.0 and 1.0, default 1.0)", default=1.0)
     vector: Optional[List[float]] = Field(description="Vector representation of the fact", default=None)
     metadata: Optional[Dict[str, Any]] = Field(description="Additional information about the fact", default={})
-    created_at: datetime = Field(description="Time when the fact was created", default_factory=datetime.now)
     
     def to_cypher(self) -> str:
         if self.subj.description is not None:
@@ -146,7 +154,10 @@ def from_cypher(self, cypher_fact:str, metadata: Dict[str, Any] = {}) -> "Fact":
             raise ValueError("Invalid Cypher fact provided")
     
     def to_dict(self):
-        return {"fact": self.to_cypher(), "metadata": self.metadata}
+        if self.metadata:
+            return {"fact": self.to_cypher(), "metadata": self.metadata}
+        else:
+            return {"fact": self.to_cypher()}
 
 class FactList(BaseModel, dspy.Prediction):
     facts: List[Fact] = Field(description="List of facts", default=[])
@@ -245,7 +256,6 @@ class UserProfile(BaseModel):
     profile: Optional[str] = Field(description="The user profile", default="An average user")
     vector: Optional[List[float]] = Field(description="Vector representation of the user", default=None)
     metadata: Optional[Dict[str, Any]] = Field(description="Additional information about the user", default={})
-    created_at: datetime = Field(description="Time when the user profile was created", default_factory=datetime.now)
     
     def to_dict(self):
         return {"name": self.name, "profile": self.profile, "metadata": self.metadata}
@@ -318,9 +328,6 @@ class AgentStep(BaseModel):
     parent_id: Optional[Union[UUID, str]] = Field(description="The previous step i
```

**File**: `hybridagi/core/graph_program.py` (modified, +1/-1)
```diff
@@ -380,7 +380,7 @@ def to_cypher(self):
         return cypher
     
     def to_dict(self):
-        return {"name": self.name, "description": self.description, "routine": self.to_cypher()}
+        return {"name": self.name, "routine": self.to_cypher()}
     
     def save(self, folderpath: str = ""):
         """
```

**File**: `hybridagi/memory/document_memory.py` (modified, +1/-1)
```diff
@@ -6,7 +6,7 @@
 class DocumentMemory(ABC):
     
     @abstractmethod
-    def exist(self, doc_id) -> bool:
+    def exist(self, doc_id: Union[UUID, str]) -> bool:
         raise NotImplementedError(
             f"DocumentMemory {type(self).__name__} is missing the required 'exist' method."
         )
```

**File**: `hybridagi/memory/fact_memory.py` (modified, +1/-1)
```diff
@@ -7,7 +7,7 @@
 class FactMemory(ABC):
     
     @abstractmethod
-    def exist(self, entity_or_fact_id) -> bool:
+    def exist(self, entity_or_fact_id: Union[UUID, str]) -> bool:
         raise NotImplementedError(
             f"FactMemory {type(self).__name__} is missing the required 'exist' method."
         )
```

**File**: `hybridagi/memory/integration/falkordb/falkordb_document_memory.py` (modified, +100/-233)
```diff
@@ -17,87 +17,41 @@ class FalkorDBDocumentMemory(FalkorDBMemory, DocumentMemory):
     providing a robust solution for storing and managing documents in a graph database.
     It allows for efficient storage, retrieval, and manipulation of documents using
     FalkorDB's graph capabilities.
-
-    Attributes:
-        _documents (Optional[Dict[str, Document]]): A dictionary to store documents.
-            The keys are document IDs and the values are Document objects.
-        _embeddings (Optional[Dict[str, List[float]]]): An ordered dictionary to store document embeddings.
-            The keys are document IDs and the values are lists of floats representing the embeddings.
     """
-    _documents: Optional[Dict[str, Document]] = {}
-    _embeddings: Optional[Dict[str, List[float]]] = OrderedDict()
 
     def __init__(
         self,
         index_name: str,
-        embeddings: Embeddings,
         graph_index: str = "filesystem",
         hostname: str = "localhost",
         port: int = 6379,
         username: str = "",
         password: str = "",
-        indexed_label: str = "Content",
         wipe_on_start: bool = False,
-        chunk_size: int = 1024,
-        chunk_overlap: int = 0,
     ):
         super().__init__(
             index_name = index_name,
             graph_index = graph_index,
-            embeddings = embeddings,
             hostname = hostname,
             port = port,
             username = username,
             password = password,
-            indexed_label = indexed_label,
             wipe_on_start = wipe_on_start,
         )
-        self._embeddings_model = embeddings
-        self.schema = ""
-        self.chunk_size = chunk_size
-        self.chunk_overlap = chunk_overlap
         if wipe_on_start:
             self.clear()
-        self.init()
-
-    def init(self):
-        """Method to initialize the filesystem"""
-        self.hybridstore.query('MERGE (:Folder {name:"/"})')
-        folders = [
-            "/home",
-            "/home/user",
-            "/home/user/Downloads",
-            "/home/user/Documents",
-            "/home/user/Pictures",
-            "/home/user/Music"
-        ]
-        for folder in folders:
-            self.create_folder(folder)
-
-    def create_folder(self, path: str):
-        """Create a folder in the filesystem"""
-        parts = path.strip('/').split('/')
-        current_path = "/"
-        for part in parts:
-            next_path = current_path + part if current_path == "/" else current_path + "/" + part
-            self.hybridstore.query(
-                'MATCH (parent:Folder {name: $parent_path}) '
-                'MERGE (parent)-[:CONTAINS]->(folder:Folder {name: $folder_name})',
-                params={"parent_path": current_path, "folder_name": next_path}
-            )
-            current_path = next_path
 
-    def exist(self, doc_name: str) -> bool:
+    def exist(self, doc_id: Union[UUID, str]) -> bool:
         """
-        Check if a document with the given name exists in the database.
+        Check if a document with the given id exists in the database.
 
         Args:
-            doc_name: The name of the document to check for existence.
+            doc_id: The id of the document to check for existence.
 
         Returns:
             bool: True if the document exists, False otherwise.
         """
-        return super().exist(doc_name, "Document")
+        return super().exist(doc_id, "Document")
 
     def update(self, doc_or_docs: Union[Document, DocumentList]) -> None:
         """
@@ -116,93 +70,90 @@ def update(self, doc_or_docs: Union[Document, DocumentList]) -> None:
             - If a document with the given ID already exists, it will be updated.
             - If a document with the given ID doesn't exist, a new one will be created.
             - For documents with a parent_id, a PART_OF relationship is created or updated.
-            - If a document doesn't have a vector, it will be generated using the text content.
-            - The local cache (_documents and _embeddings) is updated along with the database.
-            - Documents are added to the /home/user/Documents folder in the filesystem structure.
             - Document metadata is stored as properties on the Document node.
         """
+        if not isinstance(doc_or_docs, (Document, DocumentList)):
+            raise ValueError("Invalid datatype provided must be Document or DocumentList")
         if isinstance(doc_or_docs, Document):
-            documents = DocumentList(docs=[doc_or_docs])
-        elif isinstance(doc_or_docs, DocumentList):
-            documents = doc_or_docs
+            documents = DocumentList()
+            documents.docs = [doc_or_docs]
         else:
-            raise ValueError("Invalid datatype provided must be Document or DocumentList")
-
+            documents = doc_or_docs
         for doc in documents.docs:
-            # Generate vector if not provided
-            if doc.vec
```

**File**: `hybridagi/memory/integration/falkordb/falkordb_fact_memory.py` (modified, +3/-22)
```diff
@@ -1,3 +1,5 @@
+#TODO finish it
+
 from typing import Union, List, Optional, Dict
 from uuid import UUID
 from collections import OrderedDict
@@ -24,22 +26,8 @@ class FalkorDBFactMemory(FalkorDBMemory, FactMemory):
 
     This implementation provides a scalable and flexible solution for fact-based
     knowledge representation in AI and machine learning applications.
-
-    Attributes:
-        _entities (Optional[Dict[str, Entity]]): A dictionary to store entities.
-        _relationships (Optional[Dict[str, Fact]]): A dictionary to store relationships.
-        _facts (Optional[Dict[str, Fact]]): A dictionary to store facts.
-        _entities_embeddings (Optional[Dict[str, List[float]]]): An ordered dictionary to store entity embeddings.
-        _relationships_embeddings (Optional[Dict[str, List[float]]]): An ordered dictionary to store relationship embeddings.
-        _facts_embeddings (Optional[Dict[str, List[float]]]): An ordered dictionary to store fact embeddings.
     """
-    _entities: Optional[Dict[str, Entity]] = {}
-    _relationships: Optional[Dict[str, Fact]] = {}
-    _facts: Optional[Dict[str, Fact]] = {}
-    
-    _entities_embeddings: Optional[Dict[str, List[float]]] = OrderedDict()
-    _relationships_embeddings: Optional[Dict[str, List[float]]] = OrderedDict()
-    _facts_embeddings: Optional[Dict[str, List[float]]] = OrderedDict()
+   
     def __init__(
         self,
         index_name: str,
@@ -63,13 +51,6 @@ def __init__(
             indexed_label = indexed_label,
             wipe_on_start = wipe_on_start,
         )
-        self.schema = ""
-        self._entities = {}
-        self._relationships = {}
-        self._facts = {}
-        self._entities_embeddings = OrderedDict()
-        self._relationships_embeddings = OrderedDict()
-        self._facts_embeddings = OrderedDict()
 
     def exist(self, fact_or_entity_id) -> bool:
         """
```

**File**: `hybridagi/memory/integration/falkordb/falkordb_memory.py` (modified, +14/-198)
```diff
@@ -1,5 +1,6 @@
 from typing import Union, List, Optional, Dict, Any
 import json
+from uuid import UUID
 from falkordb import FalkorDB, Graph
 from hybridagi.embeddings.embeddings import Embeddings
 
@@ -22,22 +23,19 @@ class FalkorDBMemory():
         password (str): The password for authentication (if required).
         index_name (str): The name of the index used for storage.
         graph_index (str): The identifier for the specific graph within the index.
-        embeddings (Embeddings): An instance of the Embeddings class for vector operations.
         indexed_label (str): The label used for indexing nodes in the graph.
         wipe_on_start (bool): Whether to clear the memory when initializing.
         client (FalkorDB): The FalkorDB client instance.
-        hybridstore (Graph): The graph object representing the selected or created graph.
+        _graph (Graph): The graph object representing the selected or created graph.
     """
     def __init__(
             self,
             index_name: str,
             graph_index: str,
-            embeddings: Embeddings,
             hostname: str = "localhost",
             port: int = 6379,
             username: str = "",
             password: str = "",
-            indexed_label: str = "Content",
             wipe_on_start: bool = False,
         ):
         self.hostname = hostname
@@ -46,228 +44,46 @@ def __init__(
         self.password = password
         self.index_name = index_name
         self.graph_index = graph_index
-        self.embeddings = embeddings
-        self.indexed_label = indexed_label
         self.wipe_on_start = wipe_on_start
         self.client = FalkorDB(
             hostname,
             port,
             username = username if username else None,
             password = password if password else None,
         )
-        self.hybridstore = self.get_graph(self.graph_index)
+        self._graph = self.get_graph(self.graph_index)
         if self.wipe_on_start:
             self.clear()
-        self.init_index()
-
+            
+    def exist(self, index: Union[UUID, str], label:str) -> bool:
+        index = str(index)
+        query = "MATCH (n:"+label+" {id: $index}) RETURN n"
+        result = self._graph.query(query, params={"index": index})
+        return len(result.result_set) > 0
 
     def get_graph(self, graph_index: str) -> Graph:
         """
         Retrieve or create a graph from the FalkorDB knowledge base.
 
-        This method constructs a unique graph identifier by combining the index_name,
-        'graph:', and the provided graph_index. It then uses this identifier to select
-        (or create, if it doesn't exist) a graph in the FalkorDB instance.
-
         Args:
             graph_index (str): A unique identifier for the specific graph within the index.
 
         Returns:
             Graph: A FalkorDB Graph object representing the selected or created graph.
         """
-        return self.client.select_graph(self.index_name+":graph:"+graph_index)
-
-    def exist(self, index: str, label: str = None) -> bool:
-        """
-        Check if an entry with the given index exists in the graph.
-
-        This method queries the graph to determine if a node with the specified
-        index (and optionally, label) exists.
-
-        Args:
-            index (str): The unique identifier of the node to check for.
-            label (str, optional): The label of the node to check for. If not provided,
-                                   the method will check for any node with the given index.
-
-        Returns:
-            bool: True if a matching node is found, False otherwise.
-        """
-        params = {"index": index}
-        query = 'MATCH (n {name: $index}) RETURN COUNT(n) AS count'
-        if label:
-            query = f'MATCH (n:{label} {{name: $index}}) RETURN COUNT(n) AS count'
-        result = self.hybridstore.query(query, params=params)
-        return int(result.result_set[0][0]) > 0
+        return self.client.select_graph(self.index_name+":"+graph_index)
 
     def clear(self):
         """
-        Clear all data from the hybridstore and reinitialize the index.
+        Clear all data from the hybridstore.
 
         This method attempts to delete all nodes and relationships in the graph,
         effectively resetting the memory to an empty state. If the graph is already empty,
-        it skips the deletion step. After clearing the data (or attempting to),
-        it reinitializes the index to ensure the graph is ready for new data to be added.
+        it skips the deletion step.
 
         Note: This operation is irreversible and should be used with caution.
         """
         try:
-            self.hybridstore.delete()
+            self._graph.delete()
         except Exception as e:
-            pass
-        self.init_index()
-
-    def init_index(self):
-        """
-        Initialize or ensure the existence of necessary indexes in the graph.
-
-       
```

---

### Incident Patch 11: `ab3c2cd4` (2024-08-13)
**Commit Message**: fixed a bug introduced by copypasting local memory graph jupyter drawing (#34)

**File**: `hybridagi/core/graph_program.py` (modified, +1/-1)
```diff
@@ -420,4 +420,4 @@ def show(self, notebook: bool = False, cdn_resources: str = 'in_line') -> None:
             html = net.generate_html(unique_id, notebook=True)
             display(HTML(isolate(html)), display_id=unique_id)
         else:
-            net.show(f'{self.index_name}.html', notebook=notebook)
\ No newline at end of file
+            net.show(f'{self.name}.html', notebook=notebook)
\ No newline at end of file
```

---

### Incident Patch 12: `cddf16d6` (2024-08-10)
**Commit Message**: Build Interactive React Agent Tutorial (#31)

* Build Interactive React Agent Tutorial

* Remove comments about UpdateObjective from initial architecture

* Remove UpdateObjective comments from initial architecture

* Update interactive_react.ipynb

**File**: `notebooks/interactive_react.ipynb` (added, +790/-0)
```diff
@@ -0,0 +1,790 @@
+{
+ "cells": [
+  {
+   "cell_type": "markdown",
+   "id": "44c79075-7fcb-4809-94f6-9f08fe26ac72",
+   "metadata": {},
+   "source": [
+    "# ReACT Agent\n",
+    "\n",
+    "### Overview\n",
+    "\n",
+    "When discussing Large Language Model (LLM) Agents, the ReACT architecture is often at the forefront. This architecture is both simple and powerful, making it a popular choice in many mainstream Agentic frameworks. In this tutorial, we'll delve into how ReACT functions internally and showcase how to create a ReACT agent using HybridAGI, a versatile, graph-based Agentic framework.\n",
+    "\n",
+    "### Why ReACT?\n",
+    "\n",
+    "While the ReACT architecture provides a solid foundation, it is not always the best choice for every situation, particularly for complex tasks. Its simplicity can lead to limitations in control and efficiency. However, for those new to Graph-based Prompt Programming, ReACT offers an excellent starting point. With HybridAGI, you can build a ReACT agent and then expand and refine its capabilities by incorporating additional actions and decision-making processes, all within the same framework. This adaptability is one of the standout features of HybridAGI.\n",
+    "\n",
+    "### Key Components of a ReACT Agent\n",
+    "\n",
+    "A ReACT agent fundamentally consists of two main elements:\n",
+    "\n",
+    "1. **Tool Selection:** Deciding which tool or action to utilize based on the context and requirements.\n",
+    "2. **Iterative Adaptation:** Continuously adjusting the agent's responses in response to user input and interactions.\n",
+    "\n",
+    "In the following sections, we'll guide you through building and refining a ReACT agent, helping you grasp the basics and leverage HybridAGI to enhance your agent's functionality.\n"
+   ]
+  },
+  {
+   "cell_type": "code",
+   "execution_count": 1,
+   "id": "7d7c8e21-a195-4cd9-aa48-53ee7e5c9151",
+   "metadata": {},
+   "outputs": [],
+   "source": [
+    "# Lets Import our Chain of Thought Graph\n",
+    "import hybridagi.core.graph_program as gp"
+   ]
+  },
+  {
+   "cell_type": "markdown",
+   "id": "fed7a3fb-9fbd-4853-b103-0541866e272a",
+   "metadata": {},
+   "source": [
+    "## The Building Blocks\n",
+    "In order to build Our Chain of Though (COT) ReACT agent we need to implement the Decisions our Agent is to make and specify which Actions it's allowed to take\n",
+    "- Decisions: We specify what question the Agent should be asking itself in order to move on\n",
+    "- Actions: We specify a prompt as to what the Agent is trying to accomplish with this Action and what tool it's allowed to use in order to complete that Action"
+   ]
+  },
+  {
+   "cell_type": "code",
+   "execution_count": 2,
+   "id": "e9e1a239-d5df-4fe7-adee-2a2705c88ef8",
+   "metadata": {},
+   "outputs": [],
+   "source": [
+    "# Initiate our Graph\n",
+    "main = gp.GraphProgram(\n",
+    "    name = 'main',\n",
+    "    description = 'The main program'\n",
+    ")"
+   ]
+  },
+  {
+   "cell_type": "code",
+   "execution_count": 3,
+   "id": "36b602a8-57a1-4bb0-9d08-a0bee7c56bd4",
+   "metadata": {},
+   "outputs": [],
+   "source": [
+    "# Specify the Decision to be made\n",
+    "main.add(gp.Decision(\n",
+    "    id = \"tool_choice\",\n",
+    "    purpose = \"Choose the next tool to use\",\n",
+    "    question = \\\n",
+    "\"\"\"Which tool to use for the next step?\n",
+    "Use the context to help you choose.\n",
+    "To give the final answer just select finish\"\"\",\n",
+    "))"
+   ]
+  },
+  {
+   "cell_type": "code",
+   "execution_count": 4,
+   "id": "e307d5cd-d553-444f-93dc-29d9590557d9",
+   "metadata": {},
+   "outputs": [],
+   "source": [
+    "#Specify the Actions our Agent can take, the prompt that specifies the goal of the action, and the tool the Agent will use at this step\n",
+    "main.add(gp.Action(\n",
+    "    id = \"ask_user\",\n",
+    "    purpose = \"Ask the user\",\n",
+    "    tool = \"AskUser\",\n",
+    "    prompt = \"Ask a question to the user\",\n",
+    "))\n",
+    "\n",
+    "main.add(gp.Action(\n",
+    "    id = \"finish\",\n",
+    "    purpose = \"End the conversation and give the final answer\",\n",
+    "    tool = \"Speak\",\n",
+    "    prompt = \"Please give the final answer, if you don't know just say that you don't know\",\n",
+    "))"
+   ]
+  },
+  {
+   "cell_type": "markdown",
+   "id": "872fb26d-f08f-433d-9402-9796bdc68814",
+   "metadata": {},
+   "source": [
+    "## Connecting the Pieces\n",
+    "Now that we have specified the \"Nodes\" in our Chain of Thought we need to connect the Nodes appropriately to impart this \"logic chain\" on the agent"
+   ]
+  },
+  {
+   "cell_type": "code",
+   "execution_count": 5,
+   "id": "78dfcf66-0e13-4f40-98ff-62711741c886",
+   "metadata": {},
+   "outputs": [
+    {
+     "name": "stdout",
+     "output_type": "stream",
+     "text": [
+      "// @desc: The main program\n",
+      "CREATE\n",
+  
```

---

### Incident Patch 13: `0256bd60` (2024-08-06)
**Commit Message**: Fix dependency

**File**: `poetry.lock` (modified, +74/-54)
```diff
@@ -540,13 +540,33 @@ vision = ["Pillow (>=9.4.0)"]
 
 [[package]]
 name = "debugpy"
-version = "1.8.3"
+version = "1.8.2"
 description = "An implementation of the Debug Adapter Protocol for Python"
 optional = false
 python-versions = ">=3.8"
 files = [
-    {file = "debugpy-1.8.3-cp310-cp310-macosx_12_0_x86_64.whl", hash = "sha256:0df2c400853150af14996b8d1a4f54d45ffa98e76c0f3de30665e89e273ea293"},
-    {file = "debugpy-1.8.3.zip", hash = "sha256:0f5a6326d9fc375b864ed368d06cddf2dabe5135511e71cde3758be699847d36"},
+    {file = "debugpy-1.8.2-cp310-cp310-macosx_11_0_x86_64.whl", hash = "sha256:7ee2e1afbf44b138c005e4380097d92532e1001580853a7cb40ed84e0ef1c3d2"},
+    {file = "debugpy-1.8.2-cp310-cp310-manylinux_2_17_x86_64.manylinux2014_x86_64.whl", hash = "sha256:3f8c3f7c53130a070f0fc845a0f2cee8ed88d220d6b04595897b66605df1edd6"},
+    {file = "debugpy-1.8.2-cp310-cp310-win32.whl", hash = "sha256:f179af1e1bd4c88b0b9f0fa153569b24f6b6f3de33f94703336363ae62f4bf47"},
+    {file = "debugpy-1.8.2-cp310-cp310-win_amd64.whl", hash = "sha256:0600faef1d0b8d0e85c816b8bb0cb90ed94fc611f308d5fde28cb8b3d2ff0fe3"},
+    {file = "debugpy-1.8.2-cp311-cp311-macosx_11_0_universal2.whl", hash = "sha256:8a13417ccd5978a642e91fb79b871baded925d4fadd4dfafec1928196292aa0a"},
+    {file = "debugpy-1.8.2-cp311-cp311-manylinux_2_17_x86_64.manylinux2014_x86_64.whl", hash = "sha256:acdf39855f65c48ac9667b2801234fc64d46778021efac2de7e50907ab90c634"},
+    {file = "debugpy-1.8.2-cp311-cp311-win32.whl", hash = "sha256:2cbd4d9a2fc5e7f583ff9bf11f3b7d78dfda8401e8bb6856ad1ed190be4281ad"},
+    {file = "debugpy-1.8.2-cp311-cp311-win_amd64.whl", hash = "sha256:d3408fddd76414034c02880e891ea434e9a9cf3a69842098ef92f6e809d09afa"},
+    {file = "debugpy-1.8.2-cp312-cp312-macosx_11_0_universal2.whl", hash = "sha256:5d3ccd39e4021f2eb86b8d748a96c766058b39443c1f18b2dc52c10ac2757835"},
+    {file = "debugpy-1.8.2-cp312-cp312-manylinux_2_5_x86_64.manylinux1_x86_64.manylinux_2_17_x86_64.manylinux2014_x86_64.whl", hash = "sha256:62658aefe289598680193ff655ff3940e2a601765259b123dc7f89c0239b8cd3"},
+    {file = "debugpy-1.8.2-cp312-cp312-win32.whl", hash = "sha256:bd11fe35d6fd3431f1546d94121322c0ac572e1bfb1f6be0e9b8655fb4ea941e"},
+    {file = "debugpy-1.8.2-cp312-cp312-win_amd64.whl", hash = "sha256:15bc2f4b0f5e99bf86c162c91a74c0631dbd9cef3c6a1d1329c946586255e859"},
+    {file = "debugpy-1.8.2-cp38-cp38-macosx_11_0_x86_64.whl", hash = "sha256:5a019d4574afedc6ead1daa22736c530712465c0c4cd44f820d803d937531b2d"},
+    {file = "debugpy-1.8.2-cp38-cp38-manylinux_2_17_x86_64.manylinux2014_x86_64.whl", hash = "sha256:40f062d6877d2e45b112c0bbade9a17aac507445fd638922b1a5434df34aed02"},
+    {file = "debugpy-1.8.2-cp38-cp38-win32.whl", hash = "sha256:c78ba1680f1015c0ca7115671fe347b28b446081dada3fedf54138f44e4ba031"},
+    {file = "debugpy-1.8.2-cp38-cp38-win_amd64.whl", hash = "sha256:cf327316ae0c0e7dd81eb92d24ba8b5e88bb4d1b585b5c0d32929274a66a5210"},
+    {file = "debugpy-1.8.2-cp39-cp39-macosx_11_0_x86_64.whl", hash = "sha256:1523bc551e28e15147815d1397afc150ac99dbd3a8e64641d53425dba57b0ff9"},
+    {file = "debugpy-1.8.2-cp39-cp39-manylinux_2_17_x86_64.manylinux2014_x86_64.whl", hash = "sha256:e24ccb0cd6f8bfaec68d577cb49e9c680621c336f347479b3fce060ba7c09ec1"},
+    {file = "debugpy-1.8.2-cp39-cp39-win32.whl", hash = "sha256:7f8d57a98c5a486c5c7824bc0b9f2f11189d08d73635c326abef268f83950326"},
+    {file = "debugpy-1.8.2-cp39-cp39-win_amd64.whl", hash = "sha256:16c8dcab02617b75697a0a925a62943e26a0330da076e2a10437edd9f0bf3755"},
+    {file = "debugpy-1.8.2-py2.py3-none-any.whl", hash = "sha256:16e16df3a98a35c63c3ab1e4d19be4cbc7fdda92d9ddc059294f18910928e0ca"},
+    {file = "debugpy-1.8.2.zip", hash = "sha256:95378ed08ed2089221896b9b3a8d021e642c24edc8fef20e5d4342ca8be65c00"},
 ]
 
 [[package]]
@@ -3187,60 +3207,60 @@ files = [
 
 [[package]]
 name = "sqlalchemy"
-version = "2.0.31"
+version = "2.0.32"
 description = "Database Abstraction Library"
 optional = false
 python-versions = ">=3.7"
 files = [
-    {file = "SQLAlchemy-2.0.31-cp310-cp310-macosx_10_9_x86_64.whl", hash = "sha256:f2a213c1b699d3f5768a7272de720387ae0122f1becf0901ed6eaa1abd1baf6c"},
-    {file = "SQLAlchemy-2.0.31-cp310-cp310-macosx_11_0_arm64.whl", hash = "sha256:9fea3d0884e82d1e33226935dac990b967bef21315cbcc894605db3441347443"},
-    {file = "SQLAlchemy-2.0.31-cp310-cp310-manylinux_2_17_aarch64.manylinux2014_aarch64.whl", hash = "sha256:f3ad7f221d8a69d32d197e5968d798217a4feebe30144986af71ada8c548e9fa"},
-    {file = "SQLAlchemy-2.0.31-cp310-cp310-manylinux_2_17_x86_64.manylinux2014_x86_64.whl", hash = "sha256:9f2bee229715b6366f86a95d497c347c22ddffa2c7c96143b59a2aa5cc9eebbc"},
-    {file = "SQLAlchemy-2.0.31-cp310-cp310-musllinux_1_2_aarch64.whl", hash = "sha256:cd5b94d4819c0c89280b7c6109c7b788a576084bf0a480ae17c227b0bc41e109"},
-    {file = "SQLAlchemy-2.0.31-cp310-cp310-musllinux_1_2_x86_64.whl", hash = "sha256:750900a471d39a7eeba57580b11983030517a1f512c2cb287d5ad0fcf3aebd58"},
-    {file = "SQLAlchemy-2.0.31-
```

**File**: `pyproject.toml` (modified, +1/-0)
```diff
@@ -43,6 +43,7 @@ torch = "^2.3.1"
 python-dotenv = "^1.0.1"
 pymupdf = "^1.24.8"
 tqdm = "^4.66.5"
+debugpy = "1.8.2"
 [build-system]
 requires = ["poetry-core"]
 build-backend = "poetry.core.masonry.api"
\ No newline at end of file
```

---

### Incident Patch 14: `c79e1eb9` (2024-08-06)
**Commit Message**: Update README and fix typo

**File**: `README.md` (modified, +1/-0)
```diff
@@ -28,6 +28,7 @@
 - [Knowledge Graph RAG](notebooks/knowledge_graph_rag.ipynb)
 - [Episodic RAG](notebook/episodic_memory_rag.ipynb)
 - [Extracting Knowledge Graphs](notebook/extracting_knowledge_graphs.ipynb)
+- [Dynamic Graph Program](notebook/dynamic_graph_program.ipynb)
 
 ## What is HybridAGI?
 
```

**File**: `hybridagi/core/graph_program.py` (modified, +2/-2)
```diff
@@ -270,6 +270,7 @@ def from_cypher(self, cypher_query: str) -> Optional["GraphProgram"]:
                         prompt=step_props["prompt"],
                         inputs=step_props["inputs"] if "inputs" in step_props else None,
                         output=step_props["output"] if "output" in step_props else None,
+                        disable_inference=step_props["disable_inference"] if "disable_inference" in step_props else None,
                     ))
                 elif step_type == "Decision":
                     self.add(Decision(
@@ -282,8 +283,7 @@ def from_cypher(self, cypher_query: str) -> Optional["GraphProgram"]:
                     self.add(Program(
                         id=step_props["id"],
                         purpose=step_props["purpose"],
-                        inputs=step_props["inputs"] if "inputs" in step_props else None,
-                        output=step_props["output"] if "output" in step_props else None,
+                        program=step_props["program"],
                     ))
                 else:
                     raise ValueError(f"Invalid step type for {step_id} should be between: Control, Action, Decision, Program")
```

**File**: `notebooks/knowledge_graph_rag.ipynb` (modified, +13/-4)
```diff
@@ -165,6 +165,15 @@
    "execution_count": 3,
    "metadata": {},
    "outputs": [
+    {
+     "name": "stderr",
+     "output_type": "stream",
+     "text": [
+      "100%|██████████| 82/82 [00:00<00:00, 185608.70it/s]\n",
+      "100%|██████████| 82/82 [00:01<00:00, 46.70it/s]\n",
+      "100%|██████████| 82/82 [00:00<00:00, 157.41it/s]\n"
+     ]
+    },
     {
      "name": "stdout",
      "output_type": "stream",
@@ -176,7 +185,7 @@
    "source": [
     "from hybridagi.core.pipeline import Pipeline\n",
     "from hybridagi.embeddings import SentenceTransformerEmbeddings\n",
-    "from hybridagi.modules.deduplicator import EntityDeduplicator\n",
+    "from hybridagi.modules.deduplicators import EntityDeduplicator\n",
     "from hybridagi.modules.embedders import EntityEmbedder, FactEmbedder\n",
     "\n",
     "pipeline = Pipeline()\n",
@@ -321,11 +330,11 @@
       "\u001b[36m--- Step 2 ---\n",
       "Action Purpose: Answer the Objective's question the context's facts\n",
       "Action: {\n",
-      "  \"message\": \"Elijah Wood played in The Lord of the Rings: The Return of the King.\"\n",
+      "  \"message\": \"The Lord of the Rings: The Return of the King\"\n",
       "}\u001b[0m\n",
       "\u001b[35m--- Step 3 ---\n",
       "End Program: main\u001b[0m\n",
-      "Elijah Wood played in The Lord of the Rings: The Return of the King.\n"
+      "The Lord of the Rings: The Return of the King\n"
      ]
     }
    ],
@@ -372,7 +381,7 @@
   },
   {
    "cell_type": "code",
-   "execution_count": 6,
+   "execution_count": 7,
    "metadata": {},
    "outputs": [
     {
```

---

### Incident Patch 15: `ce8c4611` (2024-07-25)
**Commit Message**: Fix dspy error

**File**: `hybridagi/__init__.py` (modified, +0/-2)
```diff
@@ -51,7 +51,6 @@
 from .agents.interpreter import GraphProgramInterpreter
 
 from .knowledge_parsers.base import BaseKnowledgeParser
-from .knowledge_parsers.python import PythonKnowledgeParser
 from .knowledge_parsers.text import TextKnowledgeParser
 
 from .loaders.knowledge import KnowledgeLoader
@@ -65,7 +64,6 @@
     FileOutputParser,
 
     BaseKnowledgeParser,
-    PythonKnowledgeParser,
     TextKnowledgeParser,
 
     KnowledgeLoader,
```

**File**: `hybridagi/hybridagi.py` (modified, +0/-5)
```diff
@@ -12,7 +12,6 @@
 from .hybridstores.fact_memory.fact_memory import FactMemory
 from .types.state import AgentState
 
-from .knowledge_parsers.python import PythonKnowledgeParser
 from .knowledge_parsers.text import TextKnowledgeParser
 
 from .loaders.graph_programs import GraphProgramsLoader
@@ -160,10 +159,6 @@ def __init__(
         )
 
         parsers = [
-            PythonKnowledgeParser(
-                filesystem = self.filesystem,
-                fact_memory = self.fact_memory,
-            ),
             TextKnowledgeParser(
                 filesystem = self.filesystem,
                 fact_memory = self.fact_memory,
```

**File**: `poetry.lock` (modified, +71/-116)
```diff
@@ -357,59 +357,62 @@ development = ["black", "flake8", "mypy", "pytest", "types-colorama"]
 
 [[package]]
 name = "datasets"
-version = "2.14.4"
+version = "2.20.0"
 description = "HuggingFace community-driven open-source library of datasets"
 optional = false
 python-versions = ">=3.8.0"
 files = [
-    {file = "datasets-2.14.4-py3-none-any.whl", hash = "sha256:29336bd316a7d827ccd4da2236596279b20ca2ac78f64c04c9483da7cbc2459b"},
-    {file = "datasets-2.14.4.tar.gz", hash = "sha256:ef29c2b5841de488cd343cfc26ab979bff77efa4d2285af51f1ad7db5c46a83b"},
+    {file = "datasets-2.20.0-py3-none-any.whl", hash = "sha256:76ac02e3bdfff824492e20678f0b6b1b6d080515957fe834b00c2ba8d6b18e5e"},
+    {file = "datasets-2.20.0.tar.gz", hash = "sha256:3c4dbcd27e0f642b9d41d20ff2efa721a5e04b32b2ca4009e0fc9139e324553f"},
 ]
 
 [package.dependencies]
 aiohttp = "*"
-dill = ">=0.3.0,<0.3.8"
-fsspec = {version = ">=2021.11.1", extras = ["http"]}
-huggingface-hub = ">=0.14.0,<1.0.0"
+dill = ">=0.3.0,<0.3.9"
+filelock = "*"
+fsspec = {version = ">=2023.1.0,<=2024.5.0", extras = ["http"]}
+huggingface-hub = ">=0.21.2"
 multiprocess = "*"
 numpy = ">=1.17"
 packaging = "*"
 pandas = "*"
-pyarrow = ">=8.0.0"
+pyarrow = ">=15.0.0"
+pyarrow-hotfix = "*"
 pyyaml = ">=5.1"
-requests = ">=2.19.0"
-tqdm = ">=4.62.1"
+requests = ">=2.32.2"
+tqdm = ">=4.66.3"
 xxhash = "*"
 
 [package.extras]
-apache-beam = ["apache-beam (>=2.26.0,<2.44.0)"]
+apache-beam = ["apache-beam (>=2.26.0)"]
 audio = ["librosa", "soundfile (>=0.12.1)"]
 benchmarks = ["tensorflow (==2.12.0)", "torch (==2.0.1)", "transformers (==4.30.1)"]
-dev = ["Pillow (>=6.2.1)", "absl-py", "apache-beam (>=2.26.0,<2.44.0)", "black (>=23.1,<24.0)", "elasticsearch (<8.0.0)", "faiss-cpu (>=1.6.4)", "joblib (<1.3.0)", "joblibspark", "librosa", "lz4", "py7zr", "pyspark (>=3.4)", "pytest", "pytest-datadir", "pytest-xdist", "pyyaml (>=5.3.1)", "rarfile (>=4.0)", "ruff (>=0.0.241)", "s3fs", "s3fs (>=2021.11.1)", "soundfile (>=0.12.1)", "sqlalchemy (<2.0.0)", "tensorflow (>=2.2.0,!=2.6.0,!=2.6.1)", "tensorflow (>=2.3,!=2.6.0,!=2.6.1)", "tensorflow-macos", "tiktoken", "torch", "transformers", "zstandard"]
-docs = ["s3fs", "tensorflow (>=2.2.0,!=2.6.0,!=2.6.1)", "tensorflow-macos", "torch", "transformers"]
-jax = ["jax (>=0.2.8,!=0.3.2,<=0.3.25)", "jaxlib (>=0.1.65,<=0.3.25)"]
+dev = ["Pillow (>=9.4.0)", "absl-py", "elasticsearch (<8.0.0)", "faiss-cpu (>=1.6.4)", "jax (>=0.3.14)", "jaxlib (>=0.3.14)", "joblib (<1.3.0)", "joblibspark", "librosa", "lz4", "polars[timezone] (>=0.20.0)", "protobuf (<4.0.0)", "py7zr", "pyspark (>=3.4)", "pytest", "pytest-datadir", "pytest-xdist", "rarfile (>=4.0)", "ruff (>=0.3.0)", "s3fs", "s3fs (>=2021.11.1)", "soundfile (>=0.12.1)", "sqlalchemy", "tensorflow (>=2.6.0)", "tiktoken", "torch", "torch (>=2.0.0)", "transformers", "typing-extensions (>=4.6.1)", "zstandard"]
+docs = ["s3fs", "tensorflow (>=2.6.0)", "torch", "transformers"]
+jax = ["jax (>=0.3.14)", "jaxlib (>=0.3.14)"]
 metrics-tests = ["Werkzeug (>=1.0.1)", "accelerate", "bert-score (>=0.3.6)", "jiwer", "langdetect", "mauve-text", "nltk", "requests-file (>=1.5.1)", "rouge-score", "sacrebleu", "sacremoses", "scikit-learn", "scipy", "sentencepiece", "seqeval", "six (>=1.15.0,<1.16.0)", "spacy (>=3.0.0)", "texttable (>=1.6.3)", "tldextract", "tldextract (>=3.1.0)", "toml (>=0.10.1)", "typer (<0.5.0)"]
-quality = ["black (>=23.1,<24.0)", "pyyaml (>=5.3.1)", "ruff (>=0.0.241)"]
+quality = ["ruff (>=0.3.0)"]
 s3 = ["s3fs"]
-tensorflow = ["tensorflow (>=2.2.0,!=2.6.0,!=2.6.1)", "tensorflow-macos"]
-tensorflow-gpu = ["tensorflow-gpu (>=2.2.0,!=2.6.0,!=2.6.1)"]
-tests = ["Pillow (>=6.2.1)", "absl-py", "apache-beam (>=2.26.0,<2.44.0)", "elasticsearch (<8.0.0)", "faiss-cpu (>=1.6.4)", "joblib (<1.3.0)", "joblibspark", "librosa", "lz4", "py7zr", "pyspark (>=3.4)", "pytest", "pytest-datadir", "pytest-xdist", "rarfile (>=4.0)", "s3fs (>=2021.11.1)", "soundfile (>=0.12.1)", "sqlalchemy (<2.0.0)", "tensorflow (>=2.3,!=2.6.0,!=2.6.1)", "tensorflow-macos", "tiktoken", "torch", "transformers", "zstandard"]
+tensorflow = ["tensorflow (>=2.6.0)"]
+tensorflow-gpu = ["tensorflow (>=2.6.0)"]
+tests = ["Pillow (>=9.4.0)", "absl-py", "elasticsearch (<8.0.0)", "faiss-cpu (>=1.6.4)", "jax (>=0.3.14)", "jaxlib (>=0.3.14)", "joblib (<1.3.0)", "joblibspark", "librosa", "lz4", "polars[timezone] (>=0.20.0)", "protobuf (<4.0.0)", "py7zr", "pyspark (>=3.4)", "pytest", "pytest-datadir", "pytest-xdist", "rarfile (>=4.0)", "s3fs (>=2021.11.1)", "soundfile (>=0.12.1)", "sqlalchemy", "tensorflow (>=2.6.0)", "tiktoken", "torch (>=2.0.0)", "transformers", "typing-extensions (>=4.6.1)", "zstandard"]
 torch = ["torch"]
-vision = ["Pillow (>=6.2.1)"]
+vision = ["Pillow (>=9.4.0)"]
 
 [[package]]
 name = "dill"
-version = "0.3.7"
+version = "0.3.8"
 description = "serialize all of Python"
 optional = false
-python-versions = ">=3.7"
+python-versions = ">=3.8"
 files = [
-    {file = "dill-0.3.7-py3-none-any.whl", hash = "sha256:76b122c08ef4ce2eedcd4d1
```

**File**: `pyproject.toml` (modified, +2/-3)
```diff
@@ -22,13 +22,12 @@ python-dotenv = ">=1.0.1"
 sentence-transformers = ">=2.6.0"
 duckduckgo-search = ">=5.2.1"
 falkordb = ">=1.0.3"
-dspy-ai = "^2.4.10"
+dspy-ai = "==2.4.10"
 colorama = ">=0.4.6"
 mistralai = ">=0.1.8"
 faiss-cpu = ">=1.8.0.post1"
-tree-sitter = ">=0.22.3"
-tree-sitter-python = {git="https://github.com/tree-sitter/tree-sitter-python", tag="v0.21.0"}
 
+pytest = "^8.3.2"
 [tool.poetry.group.dev.dependencies]
 pytest = ">=8.1.1"
 
```

**File**: `tests/loaders/test_knowledge_loader.py` (modified, +37/-37)
```diff
@@ -1,44 +1,44 @@
-from hybridagi import FileSystem
-from hybridagi import FactMemory
-from hybridagi import FakeEmbeddings
+# from hybridagi import FileSystem
+# from hybridagi import FactMemory
+# from hybridagi import FakeEmbeddings
 
-from hybridagi import KnowledgeLoader
+# from hybridagi import KnowledgeLoader
 
-from hybridagi import PythonKnowledgeParser
-from hybridagi import TextKnowledgeParser
+# from hybridagi import PythonKnowledgeParser
+# from hybridagi import TextKnowledgeParser
 
-def test_knowledge_loader():
-    emb = FakeEmbeddings(dim=250)
-    filesystem = FileSystem(
-        index_name = "test_loader",
-        embeddings = emb,
-        wipe_on_start = True,
-    )
-    fact_memory = FactMemory(
-        index_name="test_loader",
-        embeddings=emb,
-        wipe_on_start=True,
-    )
+# def test_knowledge_loader():
+#     emb = FakeEmbeddings(dim=250)
+#     filesystem = FileSystem(
+#         index_name = "test_loader",
+#         embeddings = emb,
+#         wipe_on_start = True,
+#     )
+#     fact_memory = FactMemory(
+#         index_name="test_loader",
+#         embeddings=emb,
+#         wipe_on_start=True,
+#     )
 
-    parsers = [
-        PythonKnowledgeParser(
-            filesystem = filesystem,
-            fact_memory = fact_memory,
-        ),
-        TextKnowledgeParser(
-            filesystem = filesystem,
-            fact_memory = fact_memory,
-        ),
-    ]
+#     parsers = [
+#         PythonKnowledgeParser(
+#             filesystem = filesystem,
+#             fact_memory = fact_memory,
+#         ),
+#         TextKnowledgeParser(
+#             filesystem = filesystem,
+#             fact_memory = fact_memory,
+#         ),
+#     ]
 
-    loader = KnowledgeLoader(
-        filesystem = filesystem,
-        fact_memory = fact_memory,
-        parsers = parsers,
-    )
+#     loader = KnowledgeLoader(
+#         filesystem = filesystem,
+#         fact_memory = fact_memory,
+#         parsers = parsers,
+#     )
 
-    loader.from_folders(["tests/loaders/test_data"])
+#     loader.from_folders(["tests/loaders/test_data"])
 
-    assert filesystem.is_folder("/home/user/test_data")
-    assert filesystem.is_file("/home/user/test_data/program.py")
-    assert filesystem.is_file("/home/user/test_data/text_file.txt")
\ No newline at end of file
+#     assert filesystem.is_folder("/home/user/test_data")
+#     assert filesystem.is_file("/home/user/test_data/program.py")
+#     assert filesystem.is_file("/home/user/test_data/text_file.txt")
\ No newline at end of file
```

#### Recent Merged Pull Requests:
- **PR #51** (2026-09-28): ci: validate and install skills for all agents; fix SKILL.md frontmatter (@YoanSallami)
- **PR #49** (2026-09-26): Cover decision models and the new rewards (@YoanSallami)
- **PR #47** (2026-08-07): docs: reframe the skill as agent-agnostic (open SKILL.md format) (@YoanSallami)
- **PR #46** (closed): docs: add sk installation instructions (@alizain)
- **PR #44** (closed): Implements Docling support (@RamXX)
- **PR #38** (2024-11-26): Implements Ollama embeddings (@RamXX)
- **PR #37** (closed): Minor text edit (@sapenov)
- **PR #36** (2024-08-30): Falkordb 03 (@acazau)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
