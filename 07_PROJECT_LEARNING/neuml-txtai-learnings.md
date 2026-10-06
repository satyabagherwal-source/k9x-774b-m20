# Forensic Learning Record (Deep Inspection): neuml/txtai

> **Canonical Artifact**: `07_PROJECT_LEARNING/neuml-txtai-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/neuml/txtai](https://github.com/neuml/txtai))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-06T03:05:10.628Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `neuml/txtai`
- **Description**: 💡 All-in-one AI framework for semantic search, LLM orchestration and language model workflows
- **Primary Language / Ecosystem**: Python
- **Discovered Manifests / Configurations**: pyproject.toml, README.md
- **Stars / Engagement**: 12990 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: pyproject.toml, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `src/python/txtai/database/schema/statement.py`
```
"""
Statement module
"""


class Statement:
    """
    Standard database schema SQL statements.
    """

    # Temporary table for working with id batches
    CREATE_BATCH = """
        CREATE TEMP TABLE IF NOT EXISTS batch (
            indexid INTEGER,
            id TEXT,
            batch INTEGER
        )
    """

    DELETE_BATCH = "DELETE FROM batch"
    INSERT_BATCH_INDEXID = "INSERT INTO batch (indexid, batch) VALUES (?, ?)"
    INSERT_BATCH_ID = "INSERT INTO batch (id, batch) VALUES (?, ?)"

    # Temporary table for joining similarity scores
    CREATE_SCORES = """
        CREATE TEMP TABLE IF NOT EXISTS scores (
            indexid INTEGER PRIMARY KEY,
            score REAL
        )
    """

    DELETE_SCORES = "DELETE FROM scores"
    INSERT_SCORE = "INSERT INTO scores VALUES (?, ?)"

    # Documents - stores full content
    CREATE_DOCUMENTS = """
        CREATE TABLE IF NOT EXISTS documents (
            id TEXT PRIMARY KEY,
            data JSON,
            tags TEXT,
            entry DATETIME
        )
    """

    INSERT_DOCUMENT = "INSERT OR REPLACE INTO documents VALUES (?, ?, ?, ?)"
    DELETE_DOCUMENTS = "DELETE FROM documents WHERE id IN (SELECT id FROM batch)"

    # Objects - stores binary content
    CREATE_OBJECTS = """
        CREATE TABLE IF NOT EXISTS objects (
            id TEXT PRIMARY KEY,
            object BLOB,
            tags TEXT,
            entry DATETIME
        )
    """

    INSERT_OBJECT = "INSERT OR REPLACE INTO objects VALUES (?, ?, ?, ?)"
    DELETE_OBJECTS = "DELETE FROM objects WHERE id IN (SELECT id FROM batch)"

    # Sections - stores section text
    CREATE_SECTIONS = """
        CREATE TABLE IF NOT EXISTS %s (
            indexid INTEGER PRIMARY KEY,
            id TEXT,
            text TEXT,
            tags TEXT,
            entry DATETIME
        )
    """

    CREATE_SECTIONS_INDEX = "CREATE INDEX section_id ON sections(id)"
    INSERT_SECTION = "INSERT INTO sections VALUES (?, ?, ?, ?, ?)"
    DELETE_SECTIONS = "DELETE FROM sections WHERE id IN (SELECT id FROM batch)"
    COPY_SECTIONS = (
        "INSERT INTO %s SELECT (select count(*) - 1 from sections s1 where s.indexid >= s1.indexid) indexid, "
        + "s.id, %s AS text, s.tags, s.entry FROM sections s LEFT JOIN documents d ON s.id = d.id ORDER BY indexid"
    )
    STREAM_SECTIONS = (
        "SELECT s.id, s.text, data, object, s.tags FROM %s s "
        + "LEFT JOIN documents d ON s.id = d.id "
        + "LEFT JOIN objects o ON s.id = o.id ORDER BY indexid"
    )
    DROP_SECTIONS = "DROP TABLE sections"
    RENAME_SECTIONS = "ALTER TABLE %s RENAME TO sections"

    # Queries
    SELECT_IDS = "SELECT indexid, id FROM sections WHERE id in (SELECT id FROM batch)"
    COUNT_IDS = "SELECT count(indexid) FROM sections"

    # Partial sql clauses
    TABLE_CLAUSE = (
        "SELECT %s FROM sections s "
        + "%s documents d ON s.id = d.id "
        + "LEFT JOIN objects o ON s.id = o.id "
        + "LEFT JOIN scores sc ON s.indexid = sc.indexid"
    )
    IDS_CLAUSE = "s.indexid in (SELECT indexid from batch WHERE batch=%s)"

    # Expression indexes
    CREATE_EXPRESSION_INDEX = "CREATE INDEX IF NOT EXISTS %s ON %s(%s)"

```

### Core Architecture Module: `src/python/txtai/util/__init__.py`
```
"""
Utility imports
"""

from .download import *
from .library import Library
from .resolver import Resolver
from .sparsearray import SparseArray
from .template import TemplateFormatter

```

### Core Architecture Module: `src/python/txtai/util/download.py`
```
"""
Download module
"""

import os

# Core library imports
from .library import Library

library = Library()
huggingface_hub = library.huggingface_hub()
HFValidationError = library.hferror()


class Download:
    """
    Downloads files from the Hugging Face Hub. This method also supports local file paths that exist.
    """

    def __call__(self, path, name=None):
        """
        Downloads path from the Hugging Face Hub. Supports local file paths.

        Args:
            path: model path or repo
            name: file name

        Returns:
            local cached model path, if available
        """

        # Reject invalid input
        if not isinstance(path, str) or (name and not isinstance(name, str)):
            return None

        # Split into repo and name components
        if not name:
            # Split into parts
            parts = path.split("/")

            # Calculate repo id split
            repo = 2 if len(parts) > 2 else 1

            # Set path and name components
            path, name = "/".join(parts[:repo]), "/".join(parts[repo:])

        # Download (if necessary) and return local file path
        try:
            local = os.path.join(path, name)
            return local if os.path.exists(local) else huggingface_hub.hf_hub_download(repo_id=path, filename=name)

        except (HFValidationError, OSError) as e:
            raise DownloadError(f"Error locating file with parameters: path={path}, name={name}") from e


class DownloadError(Exception):
    """
    Exception raised when a local or remote file path is not valid.
    """

```

### Core Architecture Module: `src/python/txtai/util/library.py`
```
"""
Library module
"""


# pylint: disable=C0415
class Library:
    """
    Imports core but optional dependencies with fallbacks when the library is not installed.
    """

    def arguments(self):
        """
        Imports transformers.TrainingArguments.
        """

        try:
            from transformers import TrainingArguments

        except ImportError:

            class TrainingArguments:
                """
                Stub for TrainingArguments
                """

        return TrainingArguments

    def config(self):
        """
        Imports transformers.configuration_utils.PretrainedConfig.

        Returns:
            PreTrainedConfig
        """

        try:
            from transformers.configuration_utils import PretrainedConfig

        except ImportError:

            class PretrainedConfig:
                """
                Stub for PretrainedConfig
                """

        return PretrainedConfig

    def dataset(self):
        """
        Import torch.utils.data.Dataset.

        Returns:
            Dataset
        """

        try:
            from torch.utils.data import Dataset

        except ImportError:

            class Dataset:
                """
                Stub for Dataset
                """

        return Dataset

    def hferror(self):
        """
        Import huggingface_hub.errors.HFValidationError.
        """

        try:
            from huggingface_hub.errors import HFValidationError

        except ImportError:

            class HFValidationError(Exception):
                """
                Stub for HFValidationError
                """

        return HFValidationError

    def huggingface_hub(self):
        """
        Imports huggingface_hub.

        Returns:
            torch
        """

        try:
            import huggingface_hub

        except ImportError:

            class HuggingFaceHub:
                """
                Stub for HuggingFaceHub
                """

                def __getattr__(self, name):
                    raise ImportError("Hugging Face Hub is not installed, install huggingface-hub to use this module")

            huggingface_hub = HuggingFaceHub()

        return huggingface_hub

    def model(self):
        """
        Imports transformers.modeling_utils.PreTrainedModel.

        Returns:
            PreTrainedModel
        """

        try:
            from transformers.modeling_utils import PreTrainedModel

        except ImportError:

            class PreTrainedModel:
                """
                Stub for PreTrainedModel
                """

        return PreTrainedModel

    def module(self):
        """
        Imports torch.nn.Module.

        Returns:
            Module
        """

        try:
            import torch.nn

            # pylint: disable=C0103
            Module = torch.nn.Module

        except ImportError:

            class Module:
                """
                Stub for Module
                """

        return Module

    def numpy(self):
        """
        Imports numpy.

        Returns:
            numpy
        """

        try:
            import numpy

        except ImportError:

            class NumPy:
                """
                Stub for NumPy
                """

                def __getattr__(self, name):
                    raise ImportError("NumPy is not installed, install numpy to use this module")

            numpy = NumPy()

        return numpy

    def regex(self):
        """
        Imports regex.

        Returns:
            regex
        """

        try:
            import regex

        except ImportError:

            class Regex:
                """
                Stub for Regex
                """

                def __getattr__(self, name):
                    raise ImportError("Regex is not installed, install regex to use this module")

            regex = Regex()

        return regex

    def safetensors(self):
        """
        Imports safetensors.

        Returns:
            safetensors
        """

        try:
            import safetensors

            # Import submodules - they are not auto-imported with safetensors
            import safetensors.numpy
            import safetensors.torch

        except ImportError:

            class Safetensors:
                """
                Stub for Safetensors
                """

                def __getattr__(self, name):
                    raise ImportError("Safetensors is not installed, install safetensors to use this module")

            safetensors = Safetensors()

        return safetensors

    def torch(self):
        """
        Imports torch.

        Returns:
            torch
        """

        try:
            import torch

        except ImportError:

            class Torch:
                """
                Stub for torch
                """

                def __getattr__(self, name):
                    raise ImportError("Torch is not installed, install torch to use this module")

            torch = Torch()

        return torch

    def tqdm(self):
        """
        Imports tqdm.

        Returns:
            tqdm
        """

        try:
            from tqdm import auto as tqdm

        except ImportError:

            class Tqdm:
                """
                Stub for tqdm
                """

                def __getattr__(self, name):
                    raise ImportError("Tqdm is not installed, install tqdm to use this module")

            tqdm = Tqdm()

        return tqdm

    def trainer(self):
        """
        Import transformers.Trainer
        """

        try:
            from transformers import Trainer

        except ImportError:

            class Trainer(Exception):
                """
                Stub for Trainfer
                """

        return Trainer

    def transformers(self):
        """
        Imports transformers.

        Returns:
            transformers
        """

        try:
            import transformers

        except ImportError:

            class Transformers:
                """
                Stub for transformers
                """

                def __getattr__(self, name):
                    raise ImportError("Transformers is not installed, install transformers to use this module")

            transformers = Transformers()

        return transformers

    def yaml(self):
        """
        Imports yaml.

        Returns:
            yaml
        """

        try:
            import yaml

        except ImportError:

            class YAML:
                """
                Stub for yaml
                """

                def __getattr__(self, name):
                    raise ImportError("PyYAML is not installed, install pyyaml to use this module")

            yaml = YAML()

        return yaml

```

### Core Architecture Module: `src/python/txtai/util/resolver.py`
```
"""
Resolver module
"""


class Resolver:
    """
    Resolves a Python class path
    """

    def __call__(self, path, base=None):
        """
        Class instance to resolve.

        Args:
            path: path to class
            base: optional required base class

        Returns:
            class instance
        """

        # Split into path components
        parts = path.split(".")

        # Resolve each path component
        module = ".".join(parts[:-1])
        m = __import__(module)
        for comp in parts[1:]:
            m = getattr(m, comp)

        # Validate base class requirement, if necessary
        if base and (not isinstance(m, type) or not issubclass(m, base)):
            raise ImportError(f"{path} is not a subclass of {base.__name__}")

        # Return class instance
        return m

```

### Core Architecture Module: `src/python/txtai/util/sparsearray.py`
```
"""
SparseArray module
"""

# Conditional import
try:
    from scipy.sparse import csr_matrix

    SCIPY = True
except ImportError:
    SCIPY = False

# Core library imports
from .library import Library

np = Library().numpy()


class SparseArray:
    """
    Methods to load and save sparse arrays to file.
    """

    def __init__(self):
        """
        Creates a SparseArray instance.
        """

        if not SCIPY:
            raise ImportError("SciPy is not available - install scipy to enable")

    def load(self, f):
        """
        Loads a sparse array from file.

        Args:
            f: input file handle

        Returns:
            sparse array
        """

        # Load raw data
        data, indices, indptr, shape = (
            np.load(f, allow_pickle=False),
            np.load(f, allow_pickle=False),
            np.load(f, allow_pickle=False),
            np.load(f, allow_pickle=False),
        )

        # Load data into sparse array
        return csr_matrix((data, indices, indptr), shape=shape)

    def save(self, f, array):
        """
        Saves a sparse array to file.

        Args:
            f: output file handle
            array: sparse array
        """

        # Save sparse array to file
        for x in [array.data, array.indices, array.indptr, array.shape]:
            np.save(f, x, allow_pickle=False)

```

### Core Architecture Module: `src/python/txtai/util/template.py`
```
"""
Template module
"""

from string import Formatter


class TemplateFormatter(Formatter):
    """
    Custom Formatter that requires each argument to be consumed.
    """

    def check_unused_args(self, used_args, args, kwargs):
        difference = set(kwargs).difference(used_args)
        if difference:
            raise KeyError(difference)

```

### Core Architecture Module: `docker/aws/api.py`
```
"""
Lambda handler for a txtai API instance
"""

from mangum import Mangum

from txtai.api import app, start

# pylint: disable=C0103
# Create FastAPI application instance wrapped by Mangum
handler = None
if not handler:
    # Start application
    start()

    # Create handler
    handler = Mangum(app, lifespan="off")

```

### Core Architecture Module: `docker/aws/workflow.py`
```
"""
Lambda handler for txtai workflows
"""

import json

from txtai.api import API

APP = None


# pylint: disable=W0603,W0613
def handler(event, context):
    """
    Runs a workflow using input event parameters.

    Args:
        event: input event
        context: input context

    Returns:
        Workflow results
    """

    # Create (or get) global app instance
    global APP
    APP = APP if APP else API("config.yml")

    # Get parameters from event body
    event = json.loads(event["body"])

    # Run workflow and return results
    return {"statusCode": 200, "headers": {"Content-Type": "application/json"}, "body": list(APP.workflow(event["name"], event["elements"]))}

```

### Core Architecture Module: `examples/agent_quickstart.py`
```
"""
Agent Quick Start
Easy to use way to get started with AI Agents.

TxtAI has many example notebooks covering everything the framework provides
Examples: https://neuml.github.io/txtai/examples

Install TxtAI
  pip install txtai[agent]
"""

# pylint: disable=C0103
from datetime import datetime
from txtai import Agent

# Step 1: Define your Embeddings database
#
# Replace provider/container with a path to a local Embeddings database
# See RAG Quickstart for an example of building your own custom database
embeddings = {
    "name": "wikipedia",
    "description": "Searches a Wikipedia database",
    # "path": "path to your embeddings database"
    "provider": "huggingface-hub",
    "container": "neuml/txtai-wikipedia",
}


# Step 2: Define other tools
#
# Add any Python function. Just need to describe it.
def today() -> str:
    """
    Gets the current date and time

    Returns:
        current date and time
    """

    return datetime.today().isoformat()


# Step 3: Create a list of available tools
#
# Combine defined tools with default tools
tools = [
    embeddings,  # Embeddings database with YOUR data
    today,  # Python function
    "websearch",  # Runs a websearch using default engine
    "webview",  # Loads a web page
]

# Step 4: Set LLM configuration
#
# LLM APIs
#  model = "gpt-5.1"
#  model = "claude-opus-4-5-20251101"
#  model = "gemini/gemini-3-pro-preview"
#
# Local LLMs
#  model = "ollama/gpt-oss
#  model = "openai/gpt-oss-20b"
#  model = "unsloth/gpt-oss-20b-GGUF/gpt-oss-20b-Q4_K_M.gguf"
#
# Pass multiple options as a dictionary
#  model = {
#    "path": "unsloth/Qwen3-30B-A3B-Instruct-2507-GGUF/Qwen3-30B-A3B-Instruct-2507-Q4_K_M.gguf",
#    "n_ctx": 25000
#  }
model = "Qwen/Qwen3-4B-Instruct-2507"

# Step 4: Create an Agent
#
# Set LLM, tools and other configuration
# See this for more options: https://huggingface.co/docs/smolagents/reference/agents#agents
agent = Agent(model=model, tools=tools, max_steps=10)

print(agent("Tell me about the Roman Empire"))
print(agent("What is the current date?"))
print(agent("Get the 5 top news stories for today", maxlength=25000))

```

### Core Architecture Module: `examples/article.py`
```
"""
Application that builds a summary of an article.

Requires streamlit to be installed.
  pip install streamlit
"""

import os

import streamlit as st

from txtai.pipeline import Summary, Textractor
from txtai.workflow import UrlTask, Task, Workflow


class Application:
    """
    Main application.
    """

    def __init__(self):
        """
        Creates a new application.
        """

        textract = Textractor(paragraphs=True, minlength=100, join=True)
        summary = Summary("sshleifer/distilbart-cnn-12-6")

        self.workflow = Workflow([UrlTask(textract), Task(summary)])

    def run(self):
        """
        Runs a Streamlit application.
        """

        st.title("Article Summary")
        st.markdown("This application builds a summary of an article.")

        url = st.text_input("URL")
        if url:
            # Run workflow and get summary
            summary = list(self.workflow([url]))[0]

            # Write results
            st.write(summary)
            st.markdown("*Source: " + url + "*")


@st.cache(allow_output_mutation=True)
def create():
    """
    Creates and caches a Streamlit application.

    Returns:
        Application
    """

    return Application()


if __name__ == "__main__":
    os.environ["TOKENIZERS_PARALLELISM"] = "false"

    # Create and run application
    app = create()
    app.run()

```

### Core Architecture Module: `examples/baseball.py`
```
"""
Baseball statistics application with txtai and Streamlit.

Install txtai and streamlit (>= 1.23) to run:
  pip install txtai streamlit
"""

import datetime
import math
import os
import random

import altair as alt
import numpy as np
import pandas as pd
import streamlit as st

from txtai import Embeddings


class Stats:
    """
    Base stats class. Contains methods for loading, indexing and searching baseball stats.
    """

    def __init__(self):
        """
        Creates a new Stats instance.
        """

        # Load columns
        self.columns = self.loadcolumns()

        # Load stats data
        self.stats = self.load()

        # Load names
        self.names = self.loadnames()

        # Build index
        self.vectors, self.data, self.maxyear, self.embeddings = self.index()

    def loadcolumns(self):
        """
        Returns a list of data columns.

        Returns:
            list of columns
        """

        raise NotImplementedError

    def load(self):
        """
        Loads and returns raw stats.

        Returns:
            stats
        """

        raise NotImplementedError

    def metric(self):
        """
        Primary metric column.

        Returns:
            metric column name
        """

        raise NotImplementedError

    def vector(self, row):
        """
        Build a vector for input row.

        Args:
            row: input row

        Returns:
            row vector
        """

        raise NotImplementedError

    def loadnames(self):
        """
        Loads a name - player id dictionary.

        Returns:
            {player name: player id}
        """

        # Get unique names
        names = {}
        rows = self.stats.sort_values(by=self.metric(), ascending=False)[["nameFirst", "nameLast", "playerID"]].drop_duplicates().reset_index()
        for x, row in rows.iterrows():
            # Name key
            key = f"{row['nameFirst']} {row['nameLast']}"
            key += f" ({row['playerID']})" if key in names else ""

            if key not in names:
                # Scale scores of top n players
                exponent = 2 if ((len(rows) - x) / len(rows)) >= 0.95 else 1

                # score = num seasons ^ exponent
                score = math.pow(len(self.stats[self.stats["playerID"] == row["playerID"]]), exponent)

                # Save name key - values pair
                names[key] = (row["playerID"], score)

        return names

    def index(self):
        """
        Builds an embeddings index to stats data. Returns vectors, input data and embeddings index.

        Returns:
            vectors, data, embeddings
        """

        # Build data dictionary
        vectors = {f'{row["yearID"]}{row["playerID"]}': self.transform(row) for _, row in self.stats.iterrows()}
        data = {f'{row["yearID"]}{row["playerID"]}': dict(row) for _, row in self.stats.iterrows()}
        maxyear = max(row["yearID"] for _, row in self.stats.iterrows())

        embeddings = Embeddings({"transform": Stats.transform})
        embeddings.index((uid, vectors[uid], None) for uid in vectors)

        return vectors, data, maxyear, embeddings

    def metrics(self, name):
        """
        Looks up a player's active years, best statistical year and key metrics.

        Args:
            name: player name

        Returns:
            active, best, metrics
        """

        if name in self.names:
            # Get player stats
            stats = self.stats[self.stats["playerID"] == self.names[name][0]]

            # Build key metrics
            metrics = stats[["yearID", self.metric()]]

            # Get best year, sort by primary metric
            best = int(stats.sort_values(by=self.metric(), ascending=False)["yearID"].iloc[0])

            # Get years active, best year, along with metric trends
            return metrics["yearID"].tolist(), best, metrics

        return range(1871, datetime.datetime.today().year), 1950, None

    def search(self, name=None, year=None, window=None, row=None, limit=10):
        """
        Runs an embeddings search. This method takes either a player-year or stats row as input.

        Args:
            name: player name to search
            year: year to search
            window: limit to window recent seasons
            row: row of stats to search
            limit: max results to return

        Returns:
            list of results
        """

        if row:
            query = self.vector(row)
        else:
            # Lookup player key and build vector id
            name = self.names.get(name)
            query = f"{year}{name[0] if name else name}"
            query = self.vectors.get(query)

        results, ids = [], set()
        if query is not None:
            candidates = limit * 100 if window else limit * 5
            for uid, _ in self.embeddings.search(query, candidates):
                # Only add unique players
                if uid[4:] not in ids:
                    result = self.data[uid].copy()

                    # Add first player if this is a player comparison. Limit results to window, if necessary
                    if (not ids and not row) or not window or result["yearID"] > self.maxyear - window:
                        result["link"] = f'https://www.baseball-reference.com/players/{result["nameLast"].lower()[0]}/{result["bbrefID"]}.shtml'
                        results.append(result)
                        ids.add(uid[4:])

                    if len(ids) >= limit:
                        break

        return results

    def transform(self, row):
        """
        Transforms a stats row into a vector.

        Args:
            row: stats row

        Returns:
            vector
        """

        if isinstance(row, np.ndarray):
            return row

        return np.array([0.0 if not row[x] or np.isnan(row[x]) else row[x] for x in self.columns])


class Batting(Stats):
    """
    Batting stats.
    """

    def loadcolumns(self):
        return [
            "birthMonth",
            "yearID",
            "age",
            "height",
            "weight",
            "G",
            "AB",
            "R",
            "H",
            "1B",
            "2B",
            "3B",
            "HR",
            "RBI",
            "SB",
            "CS",
            "BB",
            "SO",
            "IBB",
            "HBP",
            "SH",
            "SF",
            "GIDP",
            "POS",
            "AVG",
            "OBP",
            "TB",
            "SLG",
            "OPS",
            "OPS+",
        ]

    def load(self):
        # Retrieve raw data
        players = pd.read_csv("https://hf.co/datasets/neuml/baseballdata/resolve/main/People.csv")
        batting = pd.read_csv("https://hf.co/datasets/neuml/baseballdata/resolve/main/Batting.csv")
        fielding = pd.read_csv("https://hf.co/datasets/neuml/baseballdata/resolve/main/Fielding.csv")

        # Merge player data in
        batting = pd.merge(players, batting, how="inner", on=["playerID"])

        # Require player to have at least 350 plate appearances.
        batting = batting[((batting["AB"] + batting["BB"]) >= 350) & (batting["stint"] == 1)]

        # Derive primary player positions
        positions = self.positions(fielding)

        # Calculated columns
        batting["age"] = batting["yearID"] - batting["birthYear"]
        batting["POS"] = batting.apply(lambda row: self.position(positions, row), axis=1)
        batting["AVG"] = batting["H"] / batting["AB"]
        batting["OBP"] = (batting["H"] + batting["BB"]) / (batting["AB"] + batting["BB"])
        batting["1B"] = batting["H"] - batting["2B"] - batting["3B"] - batting["HR"]
        batting["TB"] = batting["1B"] + 2 * batting["2B"] + 3 * batting["3B"] + 4 * batting["HR"]
        batting["SLG"] = batting["TB"] / batting["AB"]
        batting["OPS"] = batting["OBP"] + batting["SLG"]
        batting["OPS+"] = 100 + (batting["OPS"] - batting["OPS"].mean()) * 100

        return batting

    def metric(self):
        return "OPS+"

    def vector(self, row):
        row["TB"] = row["1B"] + 2 * row["2B"] + 3 * row["3B"] + 4 * row["HR"]
        row["AVG"] = row["H"] / row["AB"]
        row["OBP"] = (row["H"] + row["BB"]) / (row["AB"] + row["BB"])
        row["SLG"] = row["TB"] / row["AB"]
        row["OPS"] = row["OBP"] + row["SLG"]
        row["OPS+"] = 100 + (row["OPS"] - self.stats["OPS"].mean()) * 100

        return self.transform(row)

    def positions(self, fielding):
        """
        Derives primary positions for players.

        Args:
            fielding: fielding data

        Returns:
            {player id: (position, number of games)}
        """

        positions = {}
        for _, row in fielding.iterrows():
            uid = f'{row["yearID"]}{row["playerID"]}'
            position = row["POS"] if row["POS"] else 0
            if position == "P":
                position = 1
            elif position == "C":
                position = 2
            elif position == "1B":
                position = 3
            elif position == "2B":
                position = 4
            elif position == "3B":
                position = 5
            elif position == "SS":
                position = 6
            elif position == "OF":
                position = 7

            # Save position if not set or player played more at this position
            if uid not in positions or positions[uid][1] < row["G"]:
                positions[uid] = (position, row["G"])

        return positions

    def position(self, positions, row):
        """
        Looks up primary position for player row.

        Arg:
            positions: all player positions
            row: player row

        Returns:
            primary player positions
        """

        uid = f'{row["yearID"]}{row["playerID"]}'
        return positions[uid][0] if uid in positions else 0


class Pitching(Stats):
    """
    Pitching stats.

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #1338** (2026-10-05): **Keep DuckDB bind values in query order when a parameter repeats**
  *Symptoms*: The DuckDB `formatargs()` change in #1253 collects each parameter's match positions and then rewrites that key to `?` before moving on to the next key. So the first key's positions are taken from the original query, and the next key's positions come from a query that is already shorter. When one parameter is used a few times ahead of another, the sort puts the values in the wrong order.  ```python embeddings = Embeddings(keyword=True, content="duckdb") embeddings.index([(0, "red apple", None), (1, "green pear", None), (2, "blue sky", None)]) embeddings.search(     "select id, text from txtai where id = :search_id or id = :search_id or id = :search_id or text = :t",     parameters={"search_id": "1", "t": "blue sky"}, ) ```  SQLite returns ids 1 and 2. DuckDB gets `['1', '1', 'blue sky', '1']` for the four placeholders and returns only id 1. Nothing errors here unless the swapped value has the wrong type.  This builds one pattern for all keys and walks the original query once, so the values come out in query order and the sort isn't needed anymore. The `\b` boundary from #1325 stays as is.  I added a case to the shared `testSQLBind`. Without the fix the DuckDB run fails, because the int `id` ends up bound to `text like ?`. `testduckdb` and `testsqlite` pass with it. 
  **Post-Mortem & Fix Analysis**:
  > LGTM - Thank you!

- **Issue #1335** (2026-10-05): **Keep node id 0 in graph path search results**
  *Symptoms*: `NetworkX.search()` with `graph=True` collected the nodes of path groups with `if node and not isinstance(node, dict)`. Node id `0` is falsy, so it was dropped from the subgraph along with its edges. Since node ids are index ids starting at 0, the first indexed document never appeared in path search results returned as a graph:      graph.search("MATCH P=()-[]->() RETURN P", 10, graph=True)     # graph 0 -> 1 -> 2     # Before: nodes [1, 2], 1 edge     # After:  nodes [0, 1, 2], 2 edges  This change checks `node is not None`, the same check the single node branch below already uses.  Added `testSearchGraphPath` to `TestGraph`, which builds a small graph without a model.  Closes #1334 
  **Post-Mortem & Fix Analysis**:
  > Please sync your fork with the latest to incorporate a build fix.
  > Done, merged the latest master into the branch.
  > LGTM - Thank you!

- **Issue #1334** (2026-10-05): **Graph path search with graph=True drops node 0**
  *Symptoms*: `NetworkX.search(query, graph=True)` builds the result subgraph from path groups with `if node and not isinstance(node, dict)`. Node ids are index ids starting at 0, so node `0` is skipped along with its edges. The first indexed document never appears in path search results returned as a graph.      from txtai.graph import GraphFactory      graph = GraphFactory.create({})     graph.initialize()     for uid in range(3):         graph.addnode(uid, id=str(uid))     graph.addedge(0, 1, weight=0.9)     graph.addedge(1, 2, weight=0.8)      sub = graph.search("MATCH P=()-[]->() RETURN P", 10, graph=True)     print(sorted(sub.scan()), sub.edgecount())  # [1, 2] 1, expected [0, 1, 2] 2  Without `graph=True` the rows include node 0: `[{'P': [0, {'weight': 0.9}, 1]}, ...]`. The single node branch right below already checks `value is not None`. 

- **Issue #1333** (2026-10-05): **Respect explicitly selected falsy ID column names in Tabular**
  *Symptoms*: An explicitly selected ID column named `""` or `0` is currently treated as if no ID column was configured. `Tabular(idcolumn="")([{"": "doc-7", "text": "hello"}])` returns `(0, "doc-7. hello", None)` rather than `("doc-7", "hello", None)`, replacing the intended document ID and adding it to the indexed text.  Use `is not None` when selecting the ID and excluding it from automatically selected text columns. This preserves row-index fallback when the option is omitted. Fixes #1332.  Validation: the focused regression fails for both falsy labels on unchanged master and passes after the fix; a normal `"id"` label is covered as a control. All 11 Tabular tests pass, the module has 95% coverage in that run, configured pre-commit hooks pass, and `git diff --check` passes.  The prescribed full `make coverage` command was attempted but stops because this environment has no `wget`. The released test fixtures were downloaded separately and used for the Tabular suite; the full model/API/media suite has not been run locally. This PR is a draft pending full validation.  Found through local code inspection and reproduction. Codex assisted with investigation, implementation, and test execution. 
  **Post-Mortem & Fix Analysis**:
  > You left this as a draft. Is it ready to merge / review or you still working on it?  Is this really a real use case? When would you have a blank id column?
  > The implementation is finished. I kept it as a draft because only the 11 Tabular tests and style checks were completed locally; the full `make coverage` command stopped at the missing `wget` prerequisite, as disclosed in the PR.  The blank-label case was a constructed edge case found through code inspection, not a production issue I encountered. The more practical case is an integer column label from headerless tabular data converted to records:  ```python records = pd.read_csv(StringIO("doc-7,hello\ndoc-8,world\n"), header=None).to_dict("records") Tabular(idcolumn=0)(records) # upstream: [(0, "doc-7. hello", None), (1, "doc-8. world", None)] # patch: [("doc-7", "hello", None), ("doc-8", "world", None)] ```  I verified that example against the unchanged base and the patch. This uses the existing dictionary-input path, rather than adding DataFrame input support. If column labels are intended to be nonempty strings only, renaming them before calling Tabular is the appropriate approach; I
  > LGTM - Thank you!

- **Issue #1332** (2026-10-05): **Tabular ignores explicitly selected falsy ID column names**
  *Symptoms*: While inspecting `Tabular` column selection on current master (`893d0424bec97f45e4cda1ad9c952afe170ea50f`), I reproduced an explicitly selected ID column being ignored when its name is falsy.  ```python from txtai.pipeline import Tabular  print(Tabular(idcolumn="")([{"": "doc-7", "text": "hello"}])) # actual: [(0, "doc-7. hello", None)] # expected: [("doc-7", "hello", None)]  print(Tabular(idcolumn=0)([{0: "doc-7", "text": "hello"}])) # same unexpected result ```  Both are valid column labels in the DataFrame created from the supported dictionary input. A nonempty name such as `"id"` works. With no ID column configured (`None`), retaining the row index is appropriate.  The truthiness checks in `process` affect both choosing the row ID and excluding the ID column from automatically selected text columns. Consequently, an explicit ID is replaced by the row index and also included in the indexed text.  Reproduced locally with Python 3.13 and pandas. Found through code inspection, not a production incident; Codex assisted with investigation and reproduction. I would like to submit a minimal fix that distinguishes an omitted column (`None`) from an explicitly selected falsy column label, with a focused regression test. 

- **Issue #1331** (2026-10-05): **Skip NULL aggregate values from shards with no matching rows**
  *Symptoms*: Closes #1330  When a cluster query uses max, min, sum or avg and one of the shards has no rows matching the where clause, that shard returns NULL for those columns. Aggregate passed the None values straight into Python's max, min and sum, so the whole search failed with a TypeError. avg failed the same way when weighting by count(*).  This change skips NULL values when merging, which is what SQL does too. A column only ends up as None when none of the shards had a value. For avg, the counts used for weighting come from the same shards that had a value, so an empty shard just drops out. avg without count(*) also works now when only one shard matched.  Testing:  - Added testAggregateNull to test/python/testdatabase/testsql.py. It fails on master with the TypeError and passes with this change. - `python -m unittest testdatabase.testsql` passes (20 tests). - testapi.testcluster is skipped on Windows, which is what I'm on, so I also checked the real path: two txtai API servers as shards with Cluster in front. The query from the issue fails on master and returns `[{'count(*)': 1, 'max(n)': 70, 'min(n)': 70, 'sum(n)': 70, 'avg(n)': 70.0}]` with this change. - The rest of testdatabase gives the same results as master. The only failures are the image encoder tests, which need packages I don't have installed. - black and pylint (10.00/10) are clean on both files. 
  **Post-Mortem & Fix Analysis**:
  > Is there a cleaner way to do this? It seems to add a lot of code just for a NULL check.
  > Good point, thanks. I simplified it. The loop is back to its original shape and the change is now just filtering out the NULL rows before computing each aggregate, with the counts for avg taken from the same rows. If nothing is left, the value stays None. I also trimmed the test down to the two cases from the issue. 
  > LGTM - Thank you!

- **Issue #1330** (2026-10-05): **Cluster aggregate queries fail when a shard has no matching rows**
  *Symptoms*: I ran into this while testing a sharded setup. If a SQL aggregate query has a where clause that only matches rows on some of the shards, the cluster search raises a TypeError instead of returning a result.  Each shard runs the query on its own, and SQL returns NULL for max, min, sum and avg when no rows match. Aggregate then passes those None values straight into Python's max, min and sum, which can't handle them.  To reproduce with two shards and ids 0 to 7 (they split evenly between the shards):  ```python from txtai.api.cluster import Cluster  cluster = Cluster({"shards": ["http://127.0.0.1:8001", "http://127.0.0.1:8002"]}) cluster.add([{"id": i, "text": f"document {i}", "n": i * 10} for i in range(8)]) cluster.index()  cluster.search("select count(*), max(n), sum(n), avg(n) from txtai where n >= 70") ```  Only id 7 matches, so the other shard returns `{"count(*)": 0, "max(n)": None, "sum(n)": None, "avg(n)": None}` and the merge fails with:  ``` TypeError: '>' not supported between instances of 'int' and 'NoneType' ```  A query that matches nothing on any shard fails the same way. You can also see it with Aggregate on its own:  ```python from txtai.database.sql import Aggregate  Aggregate()("select max(n) from txtai where n > 3", [{"max(n)": None}, {"max(n)": 7}]) ```  I'd expect the merge to skip NULLs like SQL does. The first query would then return count 1, max 70, sum 70 and avg 70.0, and an aggregate would only come back as None when no shard had a match.  I have a f

- **Issue #1327** (2026-10-04): **Decode bash tool output as UTF-8 instead of locale encoding**
  *Symptoms*: ## Summary  `BashTool.forward()` runs the command with `subprocess.run(..., text=True)` and no explicit `encoding`, so stdout is decoded using the platform's locale-preferred encoding instead of UTF-8.  ## Problem  On a non-UTF-8 locale (e.g. Windows with a Turkish/cp1254 or similar codepage), this causes two failure modes: - Non-ASCII bytes get silently mangled into the wrong characters (mojibake) when they do happen to have a mapping in that codepage. - Bytes with no mapping in the locale codepage (e.g. `Ş` = `0xC5 0x9E`, where `0x9E` has no cp1254 mapping) raise `UnicodeDecodeError` inside the subprocess reader, and the tool returns `None` instead of the command output.  This is inconsistent with the rest of the package: `write.py`, `edit.py`, `grep.py` and `skill.py` all already open files with `encoding="utf-8"` explicitly. Since the write/edit tools save files as UTF-8, reading one back with `cat` through the bash tool goes through two different encoding assumptions depending on which tool touched the file.  Closes #1326.  ## Implementation  Pass `encoding="utf-8"` explicitly to the existing `subprocess.run(...)` call in `src/python/txtai/agent/tool/bash.py`, matching the convention already used by the other agent tools in this package. No other behavior changes.  ## Testing  Added `testToolsBashEncoding` to `test/python/testagent.py`, which mocks `subprocess.run` and asserts it is called with `encoding="utf-8"`. This is locale-independent (doesn't rely on the CI runner

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

### Incident Patch 1: `af33f2e0` (2026-10-05)
**Commit Message**: Merge pull request #1333 from HuaTNA/fix-tabular-falsy-idcolumn

Respect explicitly selected falsy ID column names in Tabular

**File**: `src/python/txtai/pipeline/data/tabular.py` (modified, +2/-2)
```diff
@@ -99,14 +99,14 @@ def process(self, df):
         columns = self.textcolumns
         if not columns:
             columns = list(df.columns)
-            if self.idcolumn:
+            if self.idcolumn is not None:
                 columns.remove(self.idcolumn)
 
         # Transform into (id, text, tag) tuples
         # Tuple iteration preserves column types instead of coercing each row to one dtype.
         for index, values in zip(df.index, df.itertuples(index=False, name=None)):
             row = dict(zip(df.columns, values))
-            uid = row[self.idcolumn] if self.idcolumn else index
+            uid = row[self.idcolumn] if self.idcolumn is not None else index
             uid = uid if uid is not None else index
             text = self.concat(row, columns)
 
```

**File**: `test/python/testpipeline/testdata/testtabular.py` (modified, +10/-0)
```diff
@@ -157,6 +157,16 @@ def testMissingColumns(self):
 
         self.assertIsNone(data["metadata"])
 
+    def testFalsyIDColumn(self):
+        """
+        Explicit column labels are used for IDs and excluded from default text.
+        """
+
+        for column in ("", 0, "id"):
+            with self.subTest(column=column):
+                rows = Tabular(idcolumn=column)([{column: "doc-7", "text": "hello"}])
+                self.assertEqual(rows, [("doc-7", "hello", None)])
+
     def testNoColumns(self):
         """
         Test creating text without specifying columns
```

---

### Incident Patch 2: `2e8493df` (2026-10-05)
**Commit Message**: Merge pull request #1338 from serhiizghama/fix/duckdb-bind-parameter-order

Keep DuckDB bind values in query order when a parameter repeats

**File**: `src/python/txtai/database/duckdb.py` (modified, +6/-10)
```diff
@@ -139,20 +139,16 @@ def formatargs(self, args):
             # Unpack query args
             query, parameters = args
 
-            # Iterate over parameters
-            #   - Replace named parameters with ?'s
-            #   - Build list of value with position indexes
+            # Match all named parameters in a single pass, so values are listed in the order they appear in the query
+            #   - Match on a word boundary, bind parameters can be followed by any non-word character, i.e. `in (:x)`
             params = []
-            for key, value in parameters.items():
-                # Match on a word boundary, bind parameters can be followed by any non-word character, i.e. `in (:x)`
-                pattern = rf"\:{key}\b"
-                for match in re.finditer(pattern, query):
-                    params.append((match.start(), value))
-
+            if parameters:
+                pattern = r"\:(" + "|".join(re.escape(key) for key in parameters) + r")\b"
+                params = [parameters[match.group(1)] for match in re.finditer(pattern, query)]
                 query = re.sub(pattern, "?", query)
 
             # Repack query and parameter list
-            args = (query, [value for _, value in sorted(params, key=lambda x: x[0])])
+            args = (query, params)
 
         return args
 
```

**File**: `test/python/testdatabase/testrdbms.py` (modified, +7/-0)
```diff
@@ -745,6 +745,13 @@ def testSQLBind(self):
             result = self.embeddings.search("select * from txtai where text in (:x, :y)", parameters={"x": self.data[1], "y": self.data[4]})
             self.assertEqual({row["text"] for row in result}, {self.data[1], self.data[4]})
 
+            # Test a repeated bind parameter followed by another bind parameter
+            result = self.embeddings.search(
+                "select * from txtai where text like :document or text like :document or text like :document or id = :id",
+                parameters={"document": "%iceberg%", "id": 4},
+            )
+            self.assertEqual({row["text"] for row in result}, {self.data[1], self.data[4]})
+
         def testSparse(self):
             """
             Test sparse vector search
```

---

### Incident Patch 3: `ffcbc0b8` (2026-10-05)
**Commit Message**: Skip NULL aggregate values from shards with no matching rows (#1331)

**File**: `src/python/txtai/database/sql/aggregate.py` (modified, +4/-6)
```diff
@@ -123,16 +123,14 @@ def aggregate(self, query, results, columns, aggcolumns):
         # Compute column values
         rows = []
         for result in results:
-            # Row counts for this group, if a count(*) column was selected
-            counts = [r[countcolumn] for r in result] if countcolumn else None
-
             # Calculate/copy column values
             row = {}
             for column in columns:
                 if column in aggcolumns:
-                    # Calculate aggregate value
-                    values = [r[column] for r in result]
-                    row[column] = self.avg(values, counts) if column.lower().startswith("avg(") else aggcolumns[column](values)
+                    # Calculate aggregate value, skip NULLs from shards with no matching rows
+                    matches = [r for r in result if r[column] is not None]
+                    values, counts = [r[column] for r in matches], [r[countcolumn] for r in matches] if countcolumn else None
+                    row[column] = (self.avg(values, counts) if column.lower().startswith("avg(") else aggcolumns[column](values)) if values else None
                 else:
                     # Non aggregate column value repeat, use first value
                     row[column] = result[0][column]
```

**File**: `test/python/testdatabase/testsql.py` (modified, +13/-0)
```diff
@@ -62,6 +62,19 @@ def testAggregateAvg(self):
         with self.assertRaises(SQLError):
             aggregate("select avg(price) from txtai", [{"avg(price)": 100.0}, {"avg(price)": 10.0}])
 
+    def testAggregateNull(self):
+        """
+        Test Aggregate skips NULL values returned by shards with no matching rows
+        """
+
+        aggregate = Aggregate()
+
+        query = "select count(*), max(price), avg(price) from txtai where price > 50"
+        empty, result = {"count(*)": 0, "max(price)": None, "avg(price)": None}, {"count(*)": 2, "max(price)": 100.0, "avg(price)": 80.0}
+
+        self.assertEqual(aggregate(query, [empty, result]), [result])
+        self.assertEqual(aggregate(query, [empty, empty]), [empty])
+
     def testAlias(self):
         """
         Test alias clauses
```

---

### Incident Patch 4: `f14c26c4` (2026-10-05)
**Commit Message**: Fix ordinary streaming output buffering with stripthink enabled (#1311)

**File**: `src/python/txtai/pipeline/llm/generation.py` (modified, +4/-1)
```diff
@@ -173,12 +173,15 @@ def cleanstream(self, results):
         """
 
         # Consume "thinking" tokens
-        text, buffer = None, ""
+        text, buffer = "", ""
         for chunk in results:
             buffer += chunk
             text = self.cleanthink(buffer)
             if text != buffer:
                 break
+            prefix = buffer.lstrip()
+            if not any(marker.startswith(prefix) or prefix.startswith(marker) for marker in ("<think>", "<|")):
+                break
 
         # Yield remaining tokens
         yield from text.lstrip()
```

**File**: `test/python/testpipeline/testllm/testllm.py` (modified, +48/-0)
```diff
@@ -94,6 +94,11 @@ def testDefaultRole(self):
             # Test always keeping as prompt text
             self.assertEqual(type(generator.format([message], "prompt")[0]), str)
 
+    def testEmptyStream(self):
+        """Return no output when the upstream stream is empty."""
+        model, _ = self.streammodel([])
+        self.assertEqual(list(model("question", stream=True, stripthink=True)), [])
+
     def testExternal(self):
         """
         Test externally loaded model
@@ -124,6 +129,28 @@ def testNotImplemented(self):
         generation = Generation()
         self.assertRaises(NotImplementedError, generation.stream, None, None, None, None)
 
+    def testPartialThinkingPrefixes(self):
+        """Handle split thinking prefixes, ordinary tags, and whitespace."""
+        for chunks, expected in [
+            (["<", "th", "ink>", "reason", "</think>", "answer"], "answer"),
+            (["<", "table>", "answer"], "<table>answer"),
+            (["  ", "plain", " answer"], "plain answer"),
+            (["  ", "\n"], ""),
+            (["<", "t"], "<t"),
+            (["<|start|>assistant<|channel|>analysis<|message|>", "reason", "<|channel|>final<|message|>answer"], "answer"),
+        ]:
+            with self.subTest(chunks=chunks):
+                model, _ = self.streammodel(chunks)
+                self.assertEqual("".join(model("question", stream=True, stripthink=True)), expected)
+
+    def testPlainAnswerIsIncremental(self):
+        """Yield ordinary text before consuming subsequent chunks."""
+        model, consumed = self.streammodel(["  blue", " sky"])
+        result = model("question", stream=True, stripthink=True)
+        self.assertEqual(next(result), "b")
+        self.assertEqual(consumed, ["  blue"])
+        self.assertEqual("".join(result), "lue sky")
+
     def testStop(self):
         """
         Test stop strings
@@ -180,6 +207,14 @@ def execute2(*args, **kwargs):
             self.assertEqual("".join(model("Hello, how are", stripthink=True, stream=True)), "you")
             self.assertEqual("".join(model("Hello, how are", stripthink=False, stream=True)), "".join(list(method())))
 
+    def testStripthinkDisabled(self):
+        """Preserve chunks and consume them on demand when stripping is disabled."""
+        model, consumed = self.streammodel(["<think>reason</think>", "answer"])
+        result = model("question", stream=True, stripthink=False)
+        self.assertEqual(next(result), "<think>reason</think>")
+        self.assertEqual(consumed, ["<think>reason</think>"])
+        self.assertEqual(list(result), ["answer"])
+
     def testVision(self):
         """
         Test vision LLM
@@ -191,3 +226,16 @@ def testVision(self):
         )
 
         self.assertIsNotNone(result)
+
+    def streammodel(self, chunks):
+        """Create an LLM pipeline with a controlled upstream stream."""
+        consumed = []
+
+        def execute(*_args, **_kwargs):
+            for chunk in chunks:
+                consumed.append(chunk)
+                yield chunk
+
+        model = LLM("test", method="txtai.pipeline.Generation")
+        model.generator.execute = execute
+        return model, consumed
```

---

### Incident Patch 5: `32655393` (2026-10-04)
**Commit Message**: Merge pull request #1323 from Lesereingrape/fix/concat-merge-falsy-values-1003

Keep 0 and False in concat merge outputs

**File**: `src/python/txtai/workflow/task/base.py` (modified, +2/-1)
```diff
@@ -490,7 +490,8 @@ def concat(self, outputs):
             list of concat outputs
         """
 
-        return [". ".join([str(y) for y in x if y]) for x in self.hstack(outputs)]
+        # Only skip empty values: 0 and False are data, as the tabular pipeline's concat already treats them
+        return [". ".join([str(y) for y in x if y is not None and y != ""]) for x in self.hstack(outputs)]
 
 
 class OneToMany:
```

**File**: `test/python/testworkflow.py` (modified, +20/-0)
```diff
@@ -344,6 +344,26 @@ def testMergeWorkflow(self):
         results = list(workflow([2, 4, 6]))
         self.assertEqual(results, [4, 16, 36])
 
+    def testMergeWorkflowFalsyValues(self):
+        """
+        Test concat merge with falsy values
+        """
+
+        # A 0 is real data, the Tabular pipeline keeps it (see #1207), concat merge should too
+        task = Task([lambda x: [0, 5], lambda x: ["Widget", "Gadget"]], merge="concat")
+        results = list(task([1, 2]))
+        self.assertEqual(results, ["0. Widget", "5. Gadget"])
+
+        # False is likewise real data
+        task = Task([lambda x: [False, True], lambda x: ["Widget", "Gadget"]], merge="concat")
+        results = list(task([1, 2]))
+        self.assertEqual(results, ["False. Widget", "True. Gadget"])
+
+        # None and empty values stay excluded, they add nothing but a separator
+        task = Task([lambda x: [None, ""], lambda x: ["Widget", "Gadget"]], merge="concat")
+        results = list(task([1, 2]))
+        self.assertEqual(results, ["Widget", "Gadget"])
+
     def testMergeUnbalancedWorkflow(self):
         """
         Test merge tasks with unbalanced outputs (i.e. one action produce more output than another for same input).
```

---

### Incident Patch 6: `91188759` (2026-10-04)
**Commit Message**: Move coverage check to only run for Linux GitHub action

**File**: `.github/workflows/build.yml` (modified, +3/-1)
```diff
@@ -68,7 +68,9 @@ jobs:
         if: matrix.os == 'ubuntu-latest'
 
       - name: Test Coverage
-        run: coveralls --service=github
+        run: |
+          coverage report --fail-under=100
+          coveralls --service=github
         if: matrix.os == 'ubuntu-latest'
         env:
           GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

**File**: `Makefile` (modified, +0/-1)
```diff
@@ -56,4 +56,3 @@ coverage:
 	coverage run -m unittest discover -v -k testvectors -s ${TEST_DIR}
 	coverage run -m unittest discover -v -k testworkflow -s ${TEST_DIR}
 	coverage combine
-	coverage report --fail-under=100
```

---

### Incident Patch 7: `ff5aec46` (2026-10-04)
**Commit Message**: Fix DuckDB bind parameters followed by a non-word character not being converted (#1325)

**File**: `src/python/txtai/database/duckdb.py` (modified, +2/-1)
```diff
@@ -144,7 +144,8 @@ def formatargs(self, args):
             #   - Build list of value with position indexes
             params = []
             for key, value in parameters.items():
-                pattern = rf"\:{key}(?=\s|$)"
+                # Match on a word boundary, bind parameters can be followed by any non-word character, i.e. `in (:x)`
+                pattern = rf"\:{key}\b"
                 for match in re.finditer(pattern, query):
                     params.append((match.start(), value))
 
```

**File**: `test/python/testdatabase/testrdbms.py` (modified, +8/-0)
```diff
@@ -737,6 +737,14 @@ def testSQLBind(self):
             result = self.embeddings.search("select * from txtai where text like :x or text like :x", parameters={"x": "%iceberg%"})[0]
             self.assertEqual(result["text"], self.data[1])
 
+            # Test a bind parameter followed by a non-word character
+            result = self.embeddings.search("select * from txtai where text in (:x)", parameters={"x": self.data[1]})[0]
+            self.assertEqual(result["text"], self.data[1])
+
+            # Test multiple bind parameters in the same clause
+            result = self.embeddings.search("select * from txtai where text in (:x, :y)", parameters={"x": self.data[1], "y": self.data[4]})
+            self.assertEqual({row["text"] for row in result}, {self.data[1], self.data[4]})
+
         def testSparse(self):
             """
             Test sparse vector search
```

---

### Incident Patch 8: `84aa1c81` (2026-10-03)
**Commit Message**: Fix Tabular handling of explicitly selected falsy ID columns (#1332)

**File**: `src/python/txtai/pipeline/data/tabular.py` (modified, +2/-2)
```diff
@@ -99,14 +99,14 @@ def process(self, df):
         columns = self.textcolumns
         if not columns:
             columns = list(df.columns)
-            if self.idcolumn:
+            if self.idcolumn is not None:
                 columns.remove(self.idcolumn)
 
         # Transform into (id, text, tag) tuples
         # Tuple iteration preserves column types instead of coercing each row to one dtype.
         for index, values in zip(df.index, df.itertuples(index=False, name=None)):
             row = dict(zip(df.columns, values))
-            uid = row[self.idcolumn] if self.idcolumn else index
+            uid = row[self.idcolumn] if self.idcolumn is not None else index
             uid = uid if uid is not None else index
             text = self.concat(row, columns)
 
```

**File**: `test/python/testpipeline/testdata/testtabular.py` (modified, +10/-0)
```diff
@@ -157,6 +157,16 @@ def testMissingColumns(self):
 
         self.assertIsNone(data["metadata"])
 
+    def testFalsyIDColumn(self):
+        """
+        Explicit column labels are used for IDs and excluded from default text.
+        """
+
+        for column in ("", 0, "id"):
+            with self.subTest(column=column):
+                rows = Tabular(idcolumn=column)([{column: "doc-7", "text": "hello"}])
+                self.assertEqual(rows, [("doc-7", "hello", None)])
+
     def testNoColumns(self):
         """
         Test creating text without specifying columns
```

---

### Incident Patch 9: `3c7a5489` (2026-09-30)
**Commit Message**: Remove build script workaround, closes #1239

**File**: `.github/workflows/build.yml` (modified, +1/-1)
```diff
@@ -52,7 +52,7 @@ jobs:
       - name: Build
         run: |
           pip install -U wheel
-          pip install .[all,dev] "transformers<5.17.0"
+          pip install .[all,dev]
           pip cache purge
           python -c "import nltk; nltk.download(['punkt', 'punkt_tab', 'averaged_perceptron_tagger_eng'])"
           python --version
```

---

### Incident Patch 10: `2d535ff2` (2026-09-30)
**Commit Message**: Merge pull request #1303 from kartsan03/fix/ann-delete-numpy-ids

Delete the requested rows when ANN ids are a NumPy array

**File**: `src/python/txtai/ann/dense/milvus.py` (modified, +3/-2)
```diff
@@ -83,8 +83,9 @@ def append(self, embeddings):
         self.metadata()
 
     def delete(self, ids):
-        if ids:
-            self.collection.delete(ids)
+        # Check length, ids can be a NumPy array
+        if len(ids):
+            self.collection.delete([int(x) for x in ids])
 
     def search(self, queries, limit):
         matches = self.collection.search(queries.tolist(), top_k=limit, metric_type="IP", anns_field="embedding")
```

**File**: `src/python/txtai/ann/dense/pgvector.py` (modified, +2/-1)
```diff
@@ -71,7 +71,8 @@ def append(self, embeddings):
         self.metadata()
 
     def delete(self, ids):
-        self.database.execute(delete(self.table).where(self.table.c["indexid"].in_(ids)))
+        # Bind ids as int, NumPy integers don't match the indexid column
+        self.database.execute(delete(self.table).where(self.table.c["indexid"].in_([int(x) for x in ids])))
 
     def search(self, queries, limit):
         results = []
```

**File**: `src/python/txtai/ann/dense/sqlite.py` (modified, +2/-1)
```diff
@@ -55,7 +55,8 @@ def append(self, embeddings):
         self.metadata()
 
     def delete(self, ids):
-        self.database().executemany(self.deletesql(), [(x,) for x in ids])
+        # Bind ids as int, sqlite3 binds NumPy integers as blobs that match the wrong rows
+        self.database().executemany(self.deletesql(), [(int(x),) for x in ids])
 
     def search(self, queries, limit):
         results = []
```

**File**: `src/python/txtai/ann/dense/zvec.py` (modified, +2/-1)
```diff
@@ -80,7 +80,8 @@ def append(self, embeddings):
         self.metadata()
 
     def delete(self, ids):
-        if ids:
+        # Check length, ids can be a NumPy array
+        if len(ids):
             self.backend.delete([str(uid) for uid in ids])
 
     def search(self, queries, limit):
```

**File**: `test/python/testann/testdense/base.py` (modified, +19/-0)
```diff
@@ -128,6 +128,25 @@ def delete(self, name, params=None, ids=None):
 
         return model
 
+    def deletenumpy(self, name, params=None):
+        """
+        Test deleting ids passed as a NumPy array. Only the requested rows should be deleted.
+
+        Args:
+            name: backend name
+            params: additional config parameters
+        """
+
+        model = self.backend(name, params, 10)
+        model.delete(np.array([3, 4]))
+
+        # Generate query vector
+        query = np.random.rand(240).astype(np.float32)
+        self.normalize(query)
+
+        self.assertEqual(model.count(), 8)
+        self.assertEqual(sorted(uid for uid, _ in model.search(np.array([query]), 10)[0]), [0, 1, 2, 5, 6, 7, 8, 9])
+
     def save(self, name, params=None):
         """
         Test save/load.
```

**File**: `test/python/testann/testdense/testmilvus.py` (modified, +1/-0)
```diff
@@ -18,6 +18,7 @@ def testMilvus(self):
         """
 
         self.runTests("milvus")
+        self.deletenumpy("milvus")
 
     def testMilvusCustom(self):
         """
```

**File**: `test/python/testann/testdense/testpgvector.py` (modified, +4/-0)
```diff
@@ -70,5 +70,9 @@ def compile_bit_sqlite(type_, compiler, **kw):
             ann.delete([0])
             self.assertEqual(ann.count(), 1)
 
+            # Test delete with NumPy ids
+            ann.delete(np.array([1]))
+            self.assertEqual(ann.count(), 0)
+
             # Close ANN
             ann.close()
```

**File**: `test/python/testann/testdense/testsqlite.py` (modified, +1/-0)
```diff
@@ -26,6 +26,7 @@ def testSQLite(self):
         """
 
         self.runTests("sqlite")
+        self.deletenumpy("sqlite")
 
     @unittest.skipIf(platform.system() == "Darwin", "SQLite extensions not supported on macOS")
     def testSQLiteBinaryScores(self):
```

---

### Incident Patch 11: `1d5041b6` (2026-09-30)
**Commit Message**: Fix test merge error

**File**: `test/python/testpipeline/testtrain/testtrainer.py` (modified, +18/-17)
```diff
@@ -692,6 +692,24 @@ def testMultiLabel(self):
         labels = Labels((model, tokenizer), dynamic=False)
         self.assertEqual(labels("cat")[0][0], 1)
 
+    def testPack(self):
+        """
+        Test packing rows into chunks up to maxlength
+        """
+
+        tokenizer = AutoTokenizer.from_pretrained("hf-internal-testing/tiny-random-gpt2")
+
+        rows = ["a b c d", "e f g h", "i j k l"]
+        length = len(tokenizer(rows[0])["input_ids"])
+
+        # Two rows fill maxlength exactly and are packed into one chunk
+        packed = Texts(tokenizer, None, length * 2, "pack").process({"text": list(rows)})
+        self.assertEqual([len(chunk) for chunk in packed["input_ids"]], [length * 2, length])
+
+        # Rows are never split across chunks
+        packed = Texts(tokenizer, None, length * 2 - 1, "pack").process({"text": list(rows)})
+        self.assertEqual([len(chunk) for chunk in packed["input_ids"]], [length] * 3)
+
     def testPandas(self):
         """
         Test training a model with a pandas DataFrame
@@ -713,23 +731,6 @@ def testPandas(self):
 
         labels = Labels((model, tokenizer), dynamic=False)
         self.assertEqual(labels("cat")[0][0], 1)
-    def testPack(self):
-        """
-        Test packing rows into chunks up to maxlength
-        """
-
-        tokenizer = AutoTokenizer.from_pretrained("hf-internal-testing/tiny-random-gpt2")
-
-        rows = ["a b c d", "e f g h", "i j k l"]
-        length = len(tokenizer(rows[0])["input_ids"])
-
-        # Two rows fill maxlength exactly and are packed into one chunk
-        packed = Texts(tokenizer, None, length * 2, "pack").process({"text": list(rows)})
-        self.assertEqual([len(chunk) for chunk in packed["input_ids"]], [length * 2, length])
-
-        # Rows are never split across chunks
-        packed = Texts(tokenizer, None, length * 2 - 1, "pack").process({"text": list(rows)})
-        self.assertEqual([len(chunk) for chunk in packed["input_ids"]], [length] * 3)
 
     def testPEFT(self):
         """
```

---

### Incident Patch 12: `47d3e657` (2026-09-30)
**Commit Message**: Fix training with pandas DataFrames, closes #1265 (#1266)

**File**: `src/python/txtai/data/base.py` (modified, +8/-4)
```diff
@@ -38,7 +38,10 @@ def __call__(self, train, validation, workers, batch):
             (train, validation)
         """
 
-        return (self.prepare(train, self.process, workers, batch), self.prepare(validation, self.process, workers, batch) if validation else None)
+        return (
+            self.prepare(train, self.process, workers, batch),
+            self.prepare(validation, self.process, workers, batch) if validation is not None else None,
+        )
 
     def prepare(self, data, fn, workers, batch):
         """
@@ -54,7 +57,8 @@ def prepare(self, data, fn, workers, batch):
             tokens
         """
 
-        if hasattr(data, "map"):
+        # Check for column_names, pandas DataFrames also have a map method
+        if hasattr(data, "column_names"):
             # Hugging Face dataset
             tokens = data.map(fn, batched=True, batch_size=batch, num_proc=workers, remove_columns=data.column_names)
         else:
@@ -93,11 +97,11 @@ def labels(self, data):
         column = self.columns[-1]
 
         # Return length of labels if it's an array
-        length = self.length(data[column][0] if hasattr(data, "columns") else data[0][column])
+        length = self.length(next(iter(data[column])) if hasattr(data, "columns") else data[0][column])
         if length:
             return length
 
-        if hasattr(data, "map"):
+        if hasattr(data, "column_names"):
             # Hugging Face dataset
             labels = sorted(data.unique(self.columns[-1]))
         elif hasattr(data, "columns"):
```

**File**: `test/python/testpipeline/testtrain/testtrainer.py` (modified, +22/-0)
```diff
@@ -11,6 +11,7 @@
 from unittest.mock import patch
 
 import numpy as np
+import pandas as pd
 import torch
 
 from transformers import AutoTokenizer, AutoModelForSequenceClassification
@@ -691,6 +692,27 @@ def testMultiLabel(self):
         labels = Labels((model, tokenizer), dynamic=False)
         self.assertEqual(labels("cat")[0][0], 1)
 
+    def testPandas(self):
+        """
+        Test training a model with a pandas DataFrame
+        """
+
+        df = pd.DataFrame(self.data)
+
+        # Split into train and validation sets, the train index doesn't start at 0
+        train, validation = df.iloc[4:], df.iloc[:4]
+
+        trainer = HFTrainer()
+        model, tokenizer = trainer(
+            "google/bert_uncased_L-2_H-128_A-2",
+            train,
+            validation=validation,
+            do_eval=True,
+            output_dir=os.path.join(tempfile.gettempdir(), "trainer"),
+        )
+
+        labels = Labels((model, tokenizer), dynamic=False)
+        self.assertEqual(labels("cat")[0][0], 1)
     def testPack(self):
         """
         Test packing rows into chunks up to maxlength
```

---

### Incident Patch 13: `7df50abb` (2026-09-30)
**Commit Message**: Merge pull request #1282 from LimbC-C/fix/sqlite-binary-scores

Normalize SQLite binary ANN similarity scores

**File**: `src/python/txtai/ann/dense/sqlite.py` (modified, +6/-1)
```diff
@@ -257,7 +257,12 @@ def searchsql(self):
             SELECT
         """
 
-        return self.tosql(("SELECT indexid, 1 - distance FROM {table} " f"WHERE embedding MATCH {self.embeddingsql()} AND k = ? ORDER BY distance"))
+        # BIT distance counts differing bits; normalize it before converting to similarity.
+        # SQLite binary dimensions are the number of bits, not the packed byte count.
+        distance = f"distance / {float(self.config['dimensions'])}" if self.quantize == 1 else "distance"
+        return self.tosql(
+            f"SELECT indexid, 1 - ({distance}) FROM {{table}} " f"WHERE embedding MATCH {self.embeddingsql()} AND k = ? ORDER BY distance"
+        )
 
     def countsql(self):
         """
```

**File**: `test/python/testann/testdense.py` (modified, +13/-0)
```diff
@@ -744,6 +744,19 @@ def testSQLiteQuantizeDisabled(self):
                 ann = ANNFactory.create({"backend": "sqlite", "dimensions": 4, "sqlite": {"quantize": quantize}})
                 self.assertEqual(ann.quantize, expected)
 
+    @unittest.skipIf(platform.system() == "Darwin", "SQLite extensions not supported on macOS")
+    def testSQLiteBinaryScores(self):
+        """
+        Binary similarity is the fraction of matching bits, not one minus their distance.
+        """
+
+        ann = ANNFactory.create({"backend": "sqlite", "dimensions": 8, "sqlite": {"quantize": 1}})
+        self.addCleanup(ann.close)
+        data = np.ones((4, 8), dtype=np.float32)
+        data[1, :1], data[2, :4], data[3, :] = -1, -1, -1
+        ann.index(data)
+        self.assertEqual(ann.search(data[:1], 4)[0], [(0, 1.0), (1, 0.875), (2, 0.5), (3, 0.0)])
+
     def testTorch(self):
         """
         Test Torch backend
```

---

### Incident Patch 14: `80b8ceff` (2026-09-30)
**Commit Message**: Merge pull request #1279 from LimbC-C/fix/array-negative-delete-ids

Ignore negative deletion IDs in NumPy and Torch ANN indexes

**File**: `src/python/txtai/ann/dense/numpy.py` (modified, +2/-2)
```diff
@@ -60,8 +60,8 @@ def append(self, embeddings):
         self.metadata()
 
     def delete(self, ids):
-        # Filter any index greater than size of array
-        ids = [x for x in ids if x < self.backend.shape[0]]
+        # Ignore IDs outside the array; negative IDs must not wrap to live rows.
+        ids = [x for x in ids if 0 <= x < self.backend.shape[0]]
 
         # Clear specified ids, zeros must match the array data type (e.g. uint8 for quantized data)
         self.backend[ids] = self.tensor(self.zeros((len(ids), self.backend.shape[1]), dtype=self.backend.dtype))
```

**File**: `test/python/testann/testdense.py` (modified, +18/-0)
```diff
@@ -418,6 +418,24 @@ def testNumPy(self):
 
         self.runTests("numpy")
 
+    def testArrayDeleteBounds(self):
+        """
+        Invalid array deletion IDs must not wrap to live rows or raise IndexError.
+        """
+
+        for backend in ("numpy", "torch"):
+            for quantize in (None, 1):
+                with self.subTest(backend=backend, quantize=quantize):
+                    data = np.array([[255, 0], [0, 255], [255, 255]], dtype=np.uint8) if quantize else np.eye(3, dtype=np.float32)
+                    ann = ANNFactory.create({"backend": backend, "dimensions": data.shape[1], "quantize": quantize})
+                    self.addCleanup(ann.close)
+                    ann.index(data.copy())
+                    ann.delete([-1, -4, 0, 0, 3, 99])
+                    expected = data.copy()
+                    expected[0] = 0
+                    np.testing.assert_array_equal(ann.numpy(ann.backend), expected)
+                    self.assertEqual(ann.count(), 2)
+
     @patch.dict(os.environ, {"ALLOW_PICKLE": "True"})
     def testNumPyLegacy(self):
         """
```

---

### Incident Patch 15: `de9e09e9` (2026-09-30)
**Commit Message**: Merge pull request #1299 from LimbC-C/fix/tabular-numeric-types

Preserve integer document IDs and numeric column types in Tabular

**File**: `src/python/txtai/pipeline/data/tabular.py` (modified, +5/-3)
```diff
@@ -103,7 +103,9 @@ def process(self, df):
                 columns.remove(self.idcolumn)
 
         # Transform into (id, text, tag) tuples
-        for index, row in df.iterrows():
+        # Tuple iteration preserves column types instead of coercing each row to one dtype.
+        for index, values in zip(df.index, df.itertuples(index=False, name=None)):
+            row = dict(zip(df.columns, values))
             uid = row[self.idcolumn] if self.idcolumn else index
             uid = uid if uid is not None else index
             text = self.concat(row, columns)
@@ -112,10 +114,10 @@ def process(self, df):
 
             # Also add row for content
             if isinstance(self.content, list):
-                row = {column: self.column(value) for column, value in row.to_dict().items() if column in self.content}
+                row = {column: self.column(value) for column, value in row.items() if column in self.content}
                 rows.append((uid, row, None))
             elif self.content:
-                row = {column: self.column(value) for column, value in row.to_dict().items()}
+                row = {column: self.column(value) for column, value in row.items()}
                 rows.append((uid, row, None))
 
         return rows
```

**File**: `test/python/testpipeline/testdata/testtabular.py` (modified, +17/-0)
```diff
@@ -53,6 +53,23 @@ def testNullValues(self):
         rows = tabular([{"id": 2, "quantity": "", "text": "Widget"}])
         self.assertEqual(rows[0][1], "Widget")
 
+    def testNumericTypes(self):
+        """
+        Mixed numeric rows preserve integer IDs and content without float rounding.
+        """
+
+        data = [{"id": 2**53 + 1, "count": 2, "value": 1.5}, {"id": 2**53, "count": 3, "value": 2.5}]
+        for content in (False, True, ["id"]):
+            with self.subTest(content=content):
+                rows = Tabular("id", ["count", "value"], content)(data)
+                step = 2 if content else 1
+                self.assertTrue(all(isinstance(row[0], int) for row in rows))
+                self.assertEqual([row[0] for row in rows[::step]], [row["id"] for row in data])
+                self.assertEqual([row[1] for row in rows[::step]], ["2. 1.5", "3. 2.5"])
+                if content:
+                    expected = data if content is True else [{"id": row["id"]} for row in data]
+                    self.assertEqual([row[1] for row in rows[1::2]], expected)
+
     def testContent(self):
         """
         Test parsing additional content
```

#### Recent Merged Pull Requests:
- **PR #1338** (2026-10-05): Keep DuckDB bind values in query order when a parameter repeats (@serhiizghama)
- **PR #1337** (2026-10-05): docs: correct the workflow input tuple from (2, 2) to (2, 8) (@shabeeth2)
- **PR #1335** (2026-10-05): Keep node id 0 in graph path search results (@MohammadHijjawi97)
- **PR #1333** (2026-10-05): Respect explicitly selected falsy ID column names in Tabular (@HuaTNA)
- **PR #1331** (2026-10-05): Skip NULL aggregate values from shards with no matching rows (@gauravch-code)
- **PR #1327** (2026-10-04): Decode bash tool output as UTF-8 instead of locale encoding (@manobhisriram)
- **PR #1325** (2026-10-04): Fix DuckDB bind parameters followed by a non-word character not being converted (@Lesereingrape)
- **PR #1323** (2026-10-04): Keep 0 and False in concat merge outputs (@Lesereingrape)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
