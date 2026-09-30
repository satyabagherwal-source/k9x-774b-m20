# Forensic Learning Record (Deep Inspection): neuml/txtai

> **Canonical Artifact**: `07_PROJECT_LEARNING/neuml-txtai-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/neuml/txtai](https://github.com/neuml/txtai))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-09-30T18:26:50.256Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `neuml/txtai`
- **Description**: 💡 All-in-one AI framework for semantic search, LLM orchestration and language model workflows
- **Primary Language / Ecosystem**: Python
- **Discovered Manifests / Configurations**: pyproject.toml, README.md
- **Stars / Engagement**: 12989 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: pyproject.toml, README.md.
- Evaluated system abstractions and modular contracts.

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
        batting["OPS+"] = 100 + (batting["OPS"] - batting["OP
```

### Core Architecture Module: `examples/benchmarks.py`
```
"""
Runs benchmark evaluations with the BEIR dataset.

Install txtai and the following dependencies to run:
    pip install txtai pytrec_eval rank-bm25 bm25s elasticsearch psutil
"""

import argparse
import csv
import json
import os
import pickle
import sqlite3
import time

import psutil
import yaml

import numpy as np

from bm25s import BM25 as BM25Sparse
from elasticsearch import Elasticsearch
from elasticsearch.helpers import bulk
from pytrec_eval import RelevanceEvaluator
from rank_bm25 import BM25Okapi
from tqdm.auto import tqdm

from txtai.embeddings import Embeddings
from txtai.pipeline import LLM, RAG, Similarity, Tokenizer
from txtai.scoring import ScoringFactory


class Index:
    """
    Base index definition. Defines methods to index and search a dataset.
    """

    def __init__(self, path, config, output, refresh):
        """
        Creates a new index.

        Args:
            path: path to dataset
            config: path to config file
            output: path to store index
            refresh: overwrites existing index if True, otherwise existing index is loaded
        """

        self.path = path
        self.config = config
        self.output = output
        self.refresh = refresh

        # Build and save index
        self.backend = self.index()

    def __call__(self, limit, filterscores=True):
        """
        Main evaluation logic. Loads an index, runs the dataset queries and returns the results.

        Args:
            limit: maximum results
            filterscores: if exact matches should be filtered out

        Returns:
            search results
        """

        uids, queries = self.load()

        # Run queries in batches
        offset, results = 0, {}
        for batch in self.batch(queries, 256):
            for i, r in enumerate(self.search(batch, limit + 1)):
                # Get result as list of (id, score) tuples
                r = list(r)
                r = [(x["id"], x["score"]) for x in r] if r and isinstance(r[0], dict) else r

                if filterscores:
                    r = [(uid, score) for uid, score in r if uid != uids[offset + i]][:limit]

                results[uids[offset + i]] = dict(r)

            # Increment offset
            offset += len(batch)

        return results

    def search(self, queries, limit):
        """
        Runs a search for a set of queries.

        Args:
            queries: list of queries to run
            limit: maximum results

        Returns:
            search results
        """

        return self.backend.batchsearch(queries, limit)

    def index(self):
        """
        Indexes a dataset.
        """

        raise NotImplementedError

    def rows(self):
        """
        Iterates over the dataset yielding a row at a time for indexing.
        """

        # Data file
        path = f"{self.path}/corpus.jsonl"

        # Get total count
        with open(path, encoding="utf-8") as f:
            total = sum(1 for _ in f)

        # Yield data
        with open(path, encoding="utf-8") as f:
            for line in tqdm(f, total=total):
                row = json.loads(line)
                text = f'{row["title"]}. {row["text"]}' if row.get("title") else row["text"]
                if text:
                    yield (row["_id"], text, None)

    def load(self):
        """
        Loads queries for the dataset. Returns a list of expected result ids and input queries.

        Returns:
            (result ids, input queries)
        """

        with open(f"{self.path}/queries.jsonl", encoding="utf-8") as f:
            data = [json.loads(query) for query in f]
            uids, queries = [x["_id"] for x in data], [x["text"] for x in data]

        return uids, queries

    def batch(self, data, size):
        """
        Splits data into equal sized batches.

        Args:
            data: input data
            size: batch size

        Returns:
            data split into equal size batches
        """

        return [data[x : x + size] for x in range(0, len(data), size)]

    def readconfig(self, key, default):
        """
        Reads configuration from a config file. Returns default configuration
        if config file is not found or config key isn't present.

        Args:
            key: configuration key to lookup
            default: default configuration

        Returns:
            config if found, otherwise returns default config
        """

        if self.config and os.path.exists(self.config):
            # Read configuration
            with open(self.config, "r", encoding="utf-8") as f:
                # Check for config
                config = yaml.safe_load(f)
                if key in config:
                    return config[key]

        return default


class Embed(Index):
    """
    Embeddings index using txtai.
    """

    def index(self):
        if os.path.exists(self.output) and not self.refresh:
            embeddings = Embeddings()
            embeddings.load(self.output)
        else:
            # Read configuration
            config = self.readconfig("embeddings", {"batch": 8192, "encodebatch": 128, "faiss": {"quantize": True, "sample": 0.05}})

            # Build index
            embeddings = Embeddings(config)
            embeddings.index(self.rows())
            embeddings.save(self.output)

        return embeddings


class Hybrid(Index):
    """
    Hybrid embeddings + BM25 index using txtai.
    """

    def index(self):
        if os.path.exists(self.output) and not self.refresh:
            embeddings = Embeddings()
            embeddings.load(self.output)
        else:
            # Read configuration
            config = self.readconfig(
                "hybrid",
                {
                    "batch": 8192,
                    "encodebatch": 128,
                    "faiss": {"quantize": True, "sample": 0.05},
                    "scoring": {"method": "bm25", "terms": True, "normalize": True},
                },
            )

            # Build index
            embeddings = Embeddings(config)
            embeddings.index(self.rows())
            embeddings.save(self.output)

        return embeddings


class RetrievalAugmentedGeneration(Embed):
    """
    Retrieval augmented generation (RAG) using txtai.
    """

    def __init__(self, path, config, output, refresh):
        # Parent logic
        super().__init__(path, config, output, refresh)

        # Read LLM configuration
        llm = self.readconfig("llm", {})

        # Read RAG configuration
        rag = self.readconfig("rag", {})

        # Load RAG pipeline
        self.rag = RAG(self.backend, LLM(**llm), output="reference", **rag)

    def search(self, queries, limit):
        # Set context window size to limit and run
        self.rag.context = limit
        return [[(x["reference"], 1)] for x in self.rag(queries, maxlength=4096)]


class Score(Index):
    """
    BM25 index using txtai.
    """

    def index(self):
        # Read configuration
        config = self.readconfig("scoring", {"method": "bm25", "terms": True})

        # Create scoring instance
        scoring = ScoringFactory.create(config)

        output = os.path.join(self.output, "scoring")
        if os.path.exists(output) and not self.refresh:
            scoring.load(output)
        else:
            scoring.index(self.rows())
            scoring.save(output)

        return scoring


class Similar(Index):
    """
    Search data using a similarity pipeline.
    """

    def index(self):
        # Load similarity pipeline
        model = Similarity(**self.readconfig("similar", {}))

        # Get datasets
        data = list(self.rows())
        ids = [x[0] for x in data]
        texts = [x[1] for x in data]

        # Encode texts
        data = model.encode(texts, "data")

        return (ids, data, model)

    def search(self, queries, limit):
        # Unpack backend
        ids, data, model = self.backend

        
```

### Core Architecture Module: `examples/books.py`
```
"""
Search application using Open Library book data. Requires the following steps to be run:

Install Streamlit
  pip install streamlit

Download and prepare data
  mkdir openlibrary && cd openlibrary
  wget -O works.txt.gz https://openlibrary.org/data/ol_dump_works_latest.txt.gz
  gunzip works.txt.gz
  grep "\"description\":" works.txt > filtered.txt

Build index
  python books.py openlibrary

Run application
  streamlit run books.py openlibrary
"""

import json
import os
import sqlite3
import sys

import pandas as pd
import streamlit as st

from txtai.embeddings import Embeddings


class Application:
    """
    Main application.
    """

    def __init__(self, path):
        """
        Creates a new application.

        Args:
            path: root path to data
        """

        self.path = path
        self.dbpath = os.path.join(self.path, "books")

    def rows(self, index):
        """
        Iterates over dataset yielding each row.

        Args:
            index: yields rows for embeddings indexing if True, otherwise yields database rows
        """

        with open(os.path.join(self.path, "filtered.txt"), encoding="utf-8") as infile:
            for x, row in enumerate(infile):
                if x % 1000 == 0:
                    print(f"Processed {x} rows", end="\r")

                row = row.split("\t")
                uid, data = row[1], json.loads(row[4])

                description = data["description"]
                if isinstance(description, dict):
                    description = description["value"]

                if "title" in data:
                    if index:
                        yield (uid, data["title"] + ". " + description, None)
                    else:
                        cover = f"{data['covers'][0]}" if "covers" in data and data["covers"] else None
                        yield (uid, data["title"], description, cover)

    def database(self):
        """
        Builds a SQLite database.
        """

        # Database file path
        dbfile = os.path.join(self.dbpath, "books.sqlite")

        # Delete existing file
        if os.path.exists(dbfile):
            os.remove(dbfile)

        # Create output database
        db = sqlite3.connect(dbfile)

        # Create database cursor
        cur = db.cursor()

        cur.execute("CREATE TABLE books (Id TEXT PRIMARY KEY, Title TEXT, Description TEXT, Cover TEXT)")

        for uid, title, description, cover in self.rows(False):
            cur.execute("INSERT INTO books (Id, Title, Description, Cover) VALUES (?, ?, ?, ?)", (uid, title, description, cover))

        # Finish and close database
        db.commit()
        db.close()

    def build(self):
        """
        Builds an embeddings index and database.
        """

        # Build embeddings index
        embeddings = Embeddings({"path": "sentence-transformers/msmarco-distilbert-base-v4"})
        embeddings.index(self.rows(True))
        embeddings.save(self.dbpath)

        # Build SQLite DB
        self.database()

    @st.cache(allow_output_mutation=True)
    def load(self):
        """
        Loads and caches embeddings index.

        Returns:
            embeddings index
        """

        embeddings = Embeddings()
        embeddings.load(self.dbpath)

        return embeddings

    def run(self):
        """
        Runs a Streamlit application.
        """

        # Build embeddings index
        embeddings = self.load()

        db = sqlite3.connect(os.path.join(self.dbpath, "books.sqlite"))
        cur = db.cursor()

        st.title("Book search")

        st.markdown(
            "This application builds a local txtai index using book data from [openlibrary.org](https://openlibrary.org). "
            + "Links to the Open Library pages and covers are shown in the application."
        )

        query = st.text_input("Search query:")
        if query:
            ids = [uid for uid, score in embeddings.search(query, 10) if score >= 0.5]

            results = []
            for uid in ids:
                cur.execute("SELECT Title, Description, Cover FROM books WHERE Id=?", (uid,))
                result = cur.fetchone()

                if result:
                    # Build cover image
                    cover = (
                        f"<img src='http://covers.openlibrary.org/b/id/{result[2]}-M.jpg'/>"
                        if result[2]
                        else "<img src='http://openlibrary.org/images/icons/avatar_book-lg.png'/>"
                    )

                    # Append book link
                    cover = f"<a target='_blank' href='https://openlibrary.org/{uid}'>{cover}</a>"
                    title = f"<a target='_blank' href='https://openlibrary.org/{uid}'>{result[0]}</a>"

                    results.append({"Cover": cover, "Title": title, "Description": result[1]})

            st.write(pd.DataFrame(results).to_html(escape=False, index=False), unsafe_allow_html=True)

        db.close()


if __name__ == "__main__":
    os.environ["TOKENIZERS_PARALLELISM"] = "false"

    # Application is used both to index and search
    app = Application(sys.argv[1])

    # pylint: disable=W0212
    if st._is_running_with_streamlit:
        # Run application using existing index/db
        app.run()
    else:
        # Not running through streamlit, build database/index
        app.build()

```

### Core Architecture Module: `examples/images.py`
```
"""
Builds a similarity index for a directory of images

Requires streamlit to be installed.
  pip install streamlit
"""

import glob
import os
import sys

import streamlit as st

from PIL import Image

from txtai.embeddings import Embeddings


class Application:
    """
    Main application
    """

    def __init__(self, directory):
        """
        Creates a new application.

        Args:
            directory: directory of images
        """

        self.embeddings = self.build(directory)

    def build(self, directory):
        """
        Builds an image embeddings index.

        Args:
            directory: directory with images

        Returns:
            Embeddings index
        """

        embeddings = Embeddings({"method": "sentence-transformers", "path": "clip-ViT-B-32"})
        embeddings.index(self.images(directory))

        # Update model to support multilingual queries
        embeddings.config["path"] = "sentence-transformers/clip-ViT-B-32-multilingual-v1"
        embeddings.model = embeddings.loadvectors()

        return embeddings

    def images(self, directory):
        """
        Generator that loops over each image in a directory.

        Args:
            directory: directory with images
        """

        for path in glob.glob(directory + "/*jpg") + glob.glob(directory + "/*png"):
            yield (path, Image.open(path), None)

    def run(self):
        """
        Runs a Streamlit application.
        """

        st.title("Image search")

        st.markdown("This application shows how images and text can be embedded into the same space to support similarity search. ")
        st.markdown(
            "[sentence-transformers](https://github.com/UKPLab/sentence-transformers/tree/master/examples/applications/image-search) "
            + "recently added support for the [OpenAI CLIP model](https://github.com/openai/CLIP). This model embeds text and images into "
            + "the same space, enabling image similarity search. txtai can directly utilize these models."
        )

        query = st.text_input("Search query:")
        if query:
            index, _ = self.embeddings.search(query, 1)[0]
            st.image(Image.open(index))


@st.cache(allow_output_mutation=True)
def create(directory):
    """
    Creates and caches a Streamlit application.

    Args:
        directory: directory of images to index

    Returns:
        Application
    """

    return Application(directory)


if __name__ == "__main__":
    os.environ["TOKENIZERS_PARALLELISM"] = "false"

    # Create and run application
    app = create(sys.argv[1])
    app.run()

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #1304** (2026-09-30): **Support append and delete in the RaBitQ ivf mode**
  *Symptoms*: Follow-up to #1297, now that rabitqlib 0.5.1 is released with `IvfIndex.add` and `IvfIndex.remove` (VectorDB-NTU/RaBitQ-Library#124).  The ivf mode supports append and delete again, and the index is still a single file with no vectors kept outside of it. The hnsw mode is unchanged and still doesn't support append and delete.  Changes:  - `append` calls the native `add`. Native ids continue from the last row ever added, so `config["offset"]` is set to the native row count. - `delete` calls the native `remove`, which hides rows from search. Ids that don't exist are ignored. Removed rows keep their storage. - `count()` is the native row count minus `config["deletes"]`, the same counter the hnsw backend uses. `remove` returns how many rows were newly removed, so repeated ids are not counted twice. - `search` returns empty results when there are no rows left to return. The native search raises an error for `k=0`, which is what an index with every row deleted would ask for. - `rabitqlib>=0.5.1` is required, since 0.5.0 has no `add` or `remove`. - The docs say that ivf supports upserts and deletes and that hnsw doesn't.  One tradeoff, which is in the docs. With a native `add` the clusters are trained once, when the index is first built, and later rows are assigned to the existing centroids. Before #1297, every append reclustered the whole corpus. On 100k vectors with 384 dimensions (inner product, `nbits=4`, default `nprobe`), recall@10 is 0.897 if the first index holds
  **Post-Mortem & Fix Analysis**:
  > Very cool! Standby I'm refactoring the ANN tests because they have become beyond messy. I'll just need you to sync your fork and add any new tests in `testann/testdense/testrabitq.py`
  > Please sync your fork and merge in tests into the new structure.
  > Synced with master and moved the tests into `testann/testdense/testrabitq.py`. The ANN tests pass with rabitqlib 0.5.1. 

- **Issue #1303** (2026-09-30): **Delete the requested rows when ANN ids are a NumPy array**
  *Symptoms*: Deleting from a dense ANN directly with ids in a NumPy array removed the wrong rows in SQLite: `sqlite3` binds NumPy integers as blobs, so `delete(np.array([3, 4]))` deleted row 0 and kept rows 3 and 4. PGVector deleted nothing for the same call, and Milvus and Zvec raised `ValueError` from their `if ids:` guard.  Bind ids as `int` in the SQLite and PGVector deletes, and check `len(ids)` in the Milvus and Zvec guards, following #1241. Add one regression method in `TestDense` that deletes with a NumPy array in the four backends and checks the count and which ids search still returns.  Fixes #1302.  ### Validation - On unchanged master the new test fails for all four: Milvus and Zvec raise `ValueError`, SQLite ends with 9 rows and PGVector with 10 where 8 are expected. It passes after the fix. - `testann.testdense` and `testann.testsparse`: 58 tests pass. - Black, and Pylint with the repository's pre-commit options (10.00/10), pass. - Linux, Python 3.11. The full model/integration suite was not run. 
  **Post-Mortem & Fix Analysis**:
  > Please sync your fork and merge in tests into the new structure.
  > Done. I rebased onto master (6765330) and moved the tests into the new layout, so the `TestDense` method from the description is gone:  - `testdense/base.py`: a `deletenumpy()` helper. It builds a 10-row index, deletes `np.array([3, 4])`, and checks the count and the ids search still returns. - `testSQLite`, `testZvec` and `testMilvus` each call it after `runTests()`. - `testPGVector`: after the existing `delete([0])`, it deletes the remaining row with `np.array([1])` and checks the count is 0.  The 4 tests pass on the branch. With the source files from master they fail: Milvus and Zvec raise `ValueError`, SQLite keeps 9 rows, and PGVector keeps 1. All of `testann` passes (60 tests), and black is clean. 
  > LGTM - Thank you!

- **Issue #1302** (2026-09-30): **ANN delete with a NumPy id array removes the wrong rows in SQLite, and does nothing or fails in PGVector, Milvus and Zvec**
  *Symptoms*: Deleting from a dense ANN directly with ids in a NumPy array goes wrong in four backends. Current master reproduction:  ~~~python import numpy as np from txtai.ann import ANNFactory  data = np.random.rand(10, 32).astype(np.float32) ann = ANNFactory.create({"backend": "sqlite", "dimensions": 32}) ann.index(data) ann.delete(np.array([3, 4]))  rows = ann.database().execute(ann.tosql("SELECT indexid FROM {table}")).fetchall() print(ann.count(), sorted(r[0] for r in rows)) # 9 [1, 2, 3, 4, 5, 6, 7, 8, 9] ~~~  - **SQLite:** row 0 is deleted and rows 3 and 4 stay. `sqlite3` binds a NumPy integer through the buffer protocol as a blob. With `[3, 4]` as a list, rows 3 and 4 are deleted as expected. - **PGVector:** nothing is deleted (count stays 10), checked through SQLAlchemy with a SQLite URL the way `testPGVector` runs. - **Milvus and Zvec:** `delete()` raises `ValueError: The truth value of an array with more than one element is ambiguous` from its `if ids:` guard.  NumPy, Torch, Faiss, HNSW, GGML and TurboVec handle the same call correctly. This is the same class as #1241 (IVFSparse). `Embeddings.delete()` passes Python ints, so this is about calling the ANN directly.  I plan to bind ids as `int` in the SQLite and PGVector deletes and check `len(ids)` in the Milvus and Zvec guards, with one regression method in `TestDense` covering the four backends. I found no existing issue or PR for this. 

- **Issue #1301** (2026-09-30): **Return OpenAI-compliant index, created and finish_reason from chat completions**
  *Symptoms*: Fixes #1300.  The OpenAI-compatible `/v1/chat/completions` responses now match the OpenAI format, so the official client models accept them:  - `choices[0]` uses `index` instead of `id`, in both the response and streamed chunks. - `created` is a Unix timestamp in seconds, not milliseconds. - A streamed response uses one `id` and `created` for all of its chunks, and ends with a chunk that has an empty `delta` and `finish_reason: "stop"` before `data: [DONE]`. The other chunks carry `finish_reason: null`.  With `openai` 3.22.1, `ChatCompletion.model_validate` and `ChatCompletionChunk.model_validate` failed on master with `choices.0.index Field required` and now pass.  Tests: `testChatResponseFormat` and `testChatStreamFormat` in `testopenai.py`. On master the first raises `KeyError: 'index'`, and the second fails with `504 != 1` distinct chunk ids. `python -m unittest -k testChat testapi.testopenai` passes (9 tests). `black --check` and `pylint` (10.00/10, pre-commit args) pass on the changed files. Running the whole module locally, `testSpeech`, `testTranscribe` and `testTranslate` error because I did not run `make data` for the audio fixtures; they do not touch this code. 
  **Post-Mortem & Fix Analysis**:
  > Can you please share where these API changes are documented? I know at one point it matched the OpenAI API. Thank you. 
  > Answering my own question: https://developers.openai.com/api/reference/resources/chat/subresources/completions/streaming-events
  > Thanks for taking a look. These come from OpenAI's API reference:  - [Chat completion object](https://developers.openai.com/api/reference/resources/chat/subresources/completions/): each entry in `choices` has `index`, `finish_reason` and `message`, and `created` is the Unix timestamp in seconds. - [Chat completion chunk object](https://developers.openai.com/api/reference/resources/chat/subresources/completions/streaming-events/): the `id` field says "Each chunk has the same ID", `created` is in seconds with "Each chunk has the same timestamp", and each choice has `index` plus a nullable `finish_reason`. - The final chunk with an empty `delta` and `finish_reason: "stop"` is shown in the [OpenAI Cookbook streaming example](https://cookbook.openai.com/examples/how_to_stream_completions) (section 2).  As far as I can tell these fields have not changed recently. The models in openai-python v1.0.0, released Nov 2023, already have `index`, `created` in seconds and the same-ID note ([chat_comp

- **Issue #1300** (2026-09-30): **OpenAI-compatible chat completions do not match the OpenAI response format**
  *Symptoms*: The OpenAI-compatible `/v1/chat/completions` endpoint (`src/python/txtai/api/routers/openai.py`) returns responses that the official `openai` client models reject:  - `choices[0]` has `"id": 0` instead of `"index": 0`, in both the response and the streamed chunks. `ChatCompletion.model_validate(response)` and `ChatCompletionChunk.model_validate(chunk)` fail with `choices.0.index Field required`. Clients that read `choice.index` get `None`. - `created` is `int(time.time() * 1000)`, i.e. milliseconds. The spec defines it as a Unix timestamp in seconds, so `datetime.fromtimestamp(created)` raises `ValueError: year ... is out of range`. - A streamed response never sends a `finish_reason`. The last chunk before `data: [DONE]` should carry `finish_reason: "stop"`, and clients that wait for it treat the stream as cut off. - Each streamed chunk gets a new `uuid4` id. In the spec all chunks of one completion share the same id; with the tiny test LLM one reply had 504 different ids.  Checked with `openai` 3.22.1 against master @ 6a15ed8, using the `segmentation` pipeline for the non-streaming case and the test LLM (`hf-internal-testing/tiny-random-LlamaForCausalLM`) for streaming.  I have a fix ready: `index` instead of `id`, `created` in seconds, one id and timestamp per response, and a final chunk with `finish_reason: "stop"`. It adds tests to `testopenai.py`. I'll open a PR and link it here. 

- **Issue #1299** (2026-09-30): **Preserve integer document IDs and numeric column types in Tabular**
  *Symptoms*: Tabular used pandas iterrows, which can convert integer columns to float when a row also contains decimals. Document IDs 9007199254740993 and 9007199254740992 then both become 9007199254740992.0, and integer content fields can lose precision too.  Iterate using dtype-preserving tuples and map values back to the original column labels. Add one concise regression method in the existing TestTabular class covering text-only, full-content and selected-content output.  Fixes #1298.  ### Validation - The new regression fails in all three content modes on unchanged master; it passes after the fix. - Nine related TestTabular methods pass, plus an additional real CSV read checks large IDs and integer text formatting. The existing testCSV was excluded because its release fixture was unavailable locally; the generated CSV check exercises that input path separately. - Tabular statement coverage: 61/64 (95%). Black and Pylint with repository options (10.00/10), plus git diff --check, pass. - Windows, Python 3.12, pandas 3.0.6. Full model/integration suite not run.  AI assistance was used for investigation, implementation and validation.
  **Post-Mortem & Fix Analysis**:
  > LGTM - Thank you!

- **Issue #1298** (2026-09-30): **Tabular coerces large integer document IDs to floats and creates collisions**
  *Symptoms*: Tabular.process uses pandas iterrows, which can coerce an integer ID column to float when a row also contains floating-point values. Integer IDs beyond float64's exact range can change and collide; numeric values in content records are coerced too.  Current master reproduction: ~~~python from txtai.pipeline import Tabular rows = [     {"id": 9007199254740993, "value": 1.5},     {"id": 9007199254740992, "value": 2.5}, ] print(Tabular("id", ["value"], content=True)(rows)) ~~~ Both output IDs become 9007199254740992.0, and the first content record's ID is also corrupted. Expected: preserve both original integer IDs and their distinctness.  I plan to iterate over dtype-preserving tuples and build the row mapping from the original column labels, avoiding iterrows' common row dtype. I will add a concise regression to the existing TestTabular class. I found no duplicate issue/PR in searches for Tabular precision/iterrows. Reproduced with pandas 3.0.6. Investigation and implementation are AI-assisted.

- **Issue #1295** (2026-09-29): **Pad batched inputs in the Summary pipeline**
  *Symptoms*: Fixes #1294.  `Summary.generate` tokenized the whole input list at once with `return_tensors="pt"` and no padding, so a list of texts with different token lengths failed:      Summary("t5-small")([text, text + text], maxlength=15)     # ValueError: Unable to create tensor, you should probably activate truncation and/or padding ...  The existing `testSummaryBatch` passes only because it summarizes the same text twice.  `generate` now splits its inputs with `self.batch(inputs, self.batchsize)`, like `Translation` does, and tokenizes each batch with `padding=True`. This also makes the `batch` constructor argument, which was stored but never used, bound how much is sent to `model.generate` at once. The results for inputs that already worked do not change.  `testSummaryBatchLengths` summarizes three texts where the middle one is twice as long. It then runs them again with `batchsize = 2`, so they span two batches, and checks the results match and keep their order. The test raises the error above on master.  Tested with `python -m unittest testpipeline.testtext.testsummary` (5 tests, OK), `black --check` and `pylint` (10.00/10, pre-commit args) on the changed files. 
  **Post-Mortem & Fix Analysis**:
  > LGTM - Thank you!

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

### Incident Patch 1: `3c7a5489` (2026-09-30)
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

### Incident Patch 2: `2d535ff2` (2026-09-30)
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

---

### Incident Patch 3: `1d5041b6` (2026-09-30)
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

### Incident Patch 4: `47d3e657` (2026-09-30)
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

### Incident Patch 5: `7df50abb` (2026-09-30)
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

### Incident Patch 6: `80b8ceff` (2026-09-30)
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

### Incident Patch 7: `de9e09e9` (2026-09-30)
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

---

### Incident Patch 8: `d0cc2bed` (2026-09-30)
**Commit Message**: Simplify regression test in existing TestDense class (#1282)

**File**: `test/python/testann/testdense.py` (modified, +13/-0)
```diff
@@ -737,6 +737,19 @@ def testSQLiteQuantizeDisabled(self):
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

**File**: `test/python/testann/testsqlitescores.py` (removed, +0/-113)
```diff
@@ -1,113 +0,0 @@
-"""
-SQLite ANN score tests.
-"""
-
-import os
-import platform
-import tempfile
-import unittest
-
-import numpy as np
-
-from txtai import Embeddings
-from txtai.ann import ANNFactory
-
-
-@unittest.skipIf(platform.system() == "Darwin", "SQLite extensions not supported on macOS")
-class TestSQLiteScores(unittest.TestCase):
-    """
-    Verify SQLite similarity scores with real sqlite-vec queries.
-    """
-
-    def testBinary(self):
-        """
-        Binary scores are the fraction of matching bits, including fractional values.
-        """
-
-        for dimensions in (8, 16, 24):
-            with self.subTest(dimensions=dimensions):
-                data = self.vectors(dimensions)
-                model = ANNFactory.create({"backend": "sqlite", "dimensions": dimensions, "sqlite": {"quantize": 1}})
-                try:
-                    model.index(data)
-                    queries = data[[0, 3]]
-                    results = model.search(queries, len(data))
-                    for query, result in zip(queries, results):
-                        expected = {i: float(np.mean((query > 0) == (row > 0))) for i, row in enumerate(data)}
-                        self.assertEqual({i for i, _ in result}, set(expected))
-                        for i, score in result:
-                            self.assertAlmostEqual(score, expected[i], places=12)
-                        scores = [score for _, score in result]
-                        self.assertEqual(scores, sorted(scores, reverse=True))
-                    self.assertEqual(len(model.search(queries[:1], 2)[0]), 2)
-                finally:
-                    model.close()
-
-    def testCosine(self):
-        """
-        FLOAT32 and INT8 modes continue to return cosine similarity.
-        """
-
-        for quantize in (None, False, True, 8):
-            with self.subTest(quantize=quantize):
-                data = self.vectors(8)
-                model = ANNFactory.create({"backend": "sqlite", "dimensions": 8, "sqlite": {"quantize": quantize}})
-                try:
-                    model.index(data)
-                    result = dict(model.search(data[:1], len(data))[0])
-                    for i, score in enumerate((1.0, 0.75, 0.0, -1.0)):
-                        self.assertAlmostEqual(result[i], score, delta=0.02 if quantize else 1e-6)
-                finally:
-                    model.close()
-
-    def testPersistence(self):
-        """
-        Scores survive save/load, appends and deletes with a custom table.
-        """
-
-        with tempfile.TemporaryDirectory() as directory:
-            path = os.path.join(directory, "vectors.sqlite")
-            data = self.vectors(16)
-            config = {"backend": "sqlite", "dimensions": 16, "sqlite": {"quantize": 1, "table": "custom_vectors"}}
-            model = ANNFactory.create(config)
-            try:
-                model.index(data[:2])
-                model.save(path)
-                model.close()
-                model.load(path)
-                model.append(data[2:])
-                model.delete([0])
-                model.save(path)
-                model.close()
-                model.load(path)
-                self.assertEqual(model.count(), 3)
-                self.assertEqual(model.search(data[:1], 4)[0], [(1, 0.9375), (2, 0.5), (3, 0.0)])
-            finally:
-                model.close()
-
-    def testEmbeddings(self):
-        """
-        Public search keeps nonidentical binary neighbors with positive similarity.
-        """
-
-        data = self.vectors(8)
-        with Embeddings({"method": "external", "backend": "sqlite", "sqlite": {"quantize": 1}}) as embeddings:
-            embeddings.index([(str(i), row, None) for i, row in enumerate(data)])
-            self.assertEqual(embeddings.search(data[0], 4), [("0", 1.0), ("1", 0.875), ("2", 0.5)])
-
-    def vectors(self, dimensions):
-        """
-        Build normalized vectors differing in zer
```

---

### Incident Patch 9: `a5ea35d7` (2026-09-30)
**Commit Message**: Simplify regression test in existing TestDense class (#1279)

**File**: `test/python/testann/testarrays.py` (removed, +0/-72)
```diff
@@ -1,72 +0,0 @@
-"""
-Array-backed ANN deletion tests
-"""
-
-import os
-import tempfile
-import unittest
-
-from itertools import product
-
-import numpy as np
-
-from txtai.ann import ANNFactory
-
-
-class TestArrays(unittest.TestCase):
-    """
-    NumPy and Torch ANN tests.
-    """
-
-    def testDeleteBounds(self):
-        """
-        Test invalid row IDs cannot delete live vectors or raise indexing errors
-        """
-
-        for backend, quantize, ids in product(["numpy", "torch"], [None, 1], [[], [3, 99], [-1], [-3], [-4], [-1, 0, 0, 3, 99]]):
-            with self.subTest(backend=backend, quantize=quantize, ids=ids):
-                data = self.vectors(quantize)
-                model = ANNFactory.create({"backend": backend, "dimensions": 2, "quantize": quantize})
-                self.addCleanup(model.close)
-                model.index(data.copy())
-                model.delete(np.array(ids, dtype=np.int64))
-
-                expected = data.copy()
-                if 0 in ids:
-                    expected[0] = 0
-                np.testing.assert_array_equal(model.numpy(model.backend), expected)
-                self.assertEqual(model.count(), 2 if 0 in ids else 3)
-                self.assertEqual(model.search(data[2:], 1)[0][0][0], 2)
-
-    def testDeleteSaveLoad(self):
-        """
-        Test mixed valid/invalid deletes remain correct after saving, loading and appending
-        """
-
-        for backend, quantize, safetensors in product(["numpy", "torch"], [None, 1], [False, True]):
-            with self.subTest(backend=backend, quantize=quantize, safetensors=safetensors):
-                data = self.vectors(quantize)
-                config = {"backend": backend, "dimensions": 2, "quantize": quantize, backend: {"safetensors": safetensors}}
-                model = ANNFactory.create(config)
-                self.addCleanup(model.close)
-                model.index(data.copy())
-                model.delete([0, -1, 3])
-
-                with tempfile.TemporaryDirectory() as directory:
-                    path = os.path.join(directory, "index")
-                    model.save(path)
-                    loaded = ANNFactory.create(dict(model.config))
-                    self.addCleanup(loaded.close)
-                    loaded.load(path)
-                    self.assertEqual(loaded.count(), 2)
-                    self.assertEqual(loaded.search(data[2:], 1)[0][0][0], 2)
-                    loaded.append(data[:1].copy())
-                    self.assertEqual(loaded.count(), 3)
-                    self.assertEqual(loaded.search(data[:1], 1)[0][0][0], 3)
-
-    def vectors(self, quantize):
-        """
-        Create normalized float vectors or packed binary vectors.
-        """
-
-        return np.array([[255, 0], [0, 255], [255, 255]], dtype=np.uint8) if quantize else np.array([[1, 0], [0, 1], [0.6, 0.8]], dtype=np.float32)
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

### Incident Patch 10: `37500887` (2026-09-24)
**Commit Message**: Merge pull request #1268 from HuaTNA/fix-rag-input-mutation

Preserve reusable RagTask inputs

**File**: `src/python/txtai/workflow/task/template.py` (modified, +1/-2)
```diff
@@ -109,8 +109,7 @@ def prepare(self, element):
             params.pop("query", None)
             params["text"] = params.pop("question")
 
-            element["question"] = super().prepare(params)
-            return element
+            return {**element, "question": super().prepare(params)}
 
         # Default mode is to use element text for both query and question
         return {"query": element, "question": super().prepare(element)}
```

**File**: `test/python/testworkflow.py` (modified, +41/-0)
```diff
@@ -525,6 +525,47 @@ def testTemplateRag(self):
         results = list(workflow([{"query": "query", "question": "prompt", "param": "value"}]))
         self.assertEqual(results[0], {"query": "query", "question": "This is a prompt with another value", "param": "value"})
 
+    def testTemplateRagReusableInput(self):
+        """
+        Test that rag template inputs can be reused without changing earlier results
+        """
+
+        workflow = Workflow([RagTask(template="This is a {text} with another {param}")])
+        for packed in (False, True):
+            with self.subTest(packed=packed):
+                request = {"query": "query", "question": "prompt", "param": "value"}
+                original = dict(request)
+                expected = {"query": "query", "question": "This is a prompt with another value", "param": "value"}
+                inputs = [("id", request, "tag")] if packed else [request]
+                expected = [("id", expected, "tag")] if packed else [expected]
+
+                first = list(workflow(inputs))
+                self.assertEqual(first, expected)
+                self.assertEqual(request, original)
+
+                second = list(workflow(inputs))
+                self.assertEqual(second, expected)
+                self.assertEqual(first, expected)
+                self.assertEqual(request, original)
+                self.assertIsNot(first[0][1] if packed else first[0], request)
+
+    def testTemplateRagRepeatedInput(self):
+        """
+        Test that repeated input references are formatted independently across batches
+        """
+
+        for batch in (1, 2):
+            with self.subTest(batch=batch):
+                workflow = Workflow([RagTask(template="This is a {text}")], batch=batch)
+                request = {"query": "query", "question": "prompt"}
+                original = dict(request)
+                expected = {"query": "query", "question": "This is a prompt"}
+
+                results = list(workflow([request, request]))
+                self.assertEqual(results, [expected, expected])
+                self.assertEqual(request, original)
+                self.assertIsNot(results[0], results[1])
+
     def testTensorTransformWorkflow(self):
         """
         Test a tensor workflow with list transformations
```

#### Recent Merged Pull Requests:
- **PR #1304** (2026-09-30): Support append and delete in the RaBitQ ivf mode (@pma1999)
- **PR #1303** (2026-09-30): Delete the requested rows when ANN ids are a NumPy array (@kartsan03)
- **PR #1301** (2026-09-30): Return OpenAI-compliant index, created and finish_reason from chat completions (@Bdysj)
- **PR #1299** (2026-09-30): Preserve integer document IDs and numeric column types in Tabular (@LimbC-C)
- **PR #1297** (2026-09-30): Store only the quantized index in the RaBitQ backend (@pma1999)
- **PR #1295** (2026-09-29): Pad batched inputs in the Summary pipeline (@Bdysj)
- **PR #1291** (2026-09-29): Include offset rows in similar() candidates (@devYRPauli)
- **PR #1290** (2026-09-30): Open lazy SQLite connections before saving indexes (@LimbC-C)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
