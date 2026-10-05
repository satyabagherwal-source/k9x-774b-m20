# Forensic Learning Record (Deep Inspection): pathwaycom/llm-app

> **Canonical Artifact**: `07_PROJECT_LEARNING/pathwaycom-llm-app-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/pathwaycom/llm-app](https://github.com/pathwaycom/llm-app))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-05T18:12:04.977Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `pathwaycom/llm-app`
- **Description**: Ready-to-run cloud templates for RAG, AI pipelines, and enterprise search with live data. 🐳Docker-friendly.⚡Always in sync with Sharepoint, Google Drive, S3, Kafka, PostgreSQL, real-time data APIs, and more.
- **Primary Language / Ecosystem**: Jupyter Notebook
- **Discovered Manifests / Configurations**: pyproject.toml, README.md
- **Stars / Engagement**: 58843 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: pyproject.toml, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `templates/adaptive_rag/app.py`
```
import logging
from warnings import warn

import pathway as pw
from dotenv import load_dotenv
from pathway.xpacks.llm.question_answering import SummaryQuestionAnswerer
from pathway.xpacks.llm.servers import QASummaryRestServer
from pydantic import BaseModel, ConfigDict, InstanceOf

# To use advanced features with Pathway Live Data Framework Scale, get your free license key from
# https://pathway.com/features and paste it below.
# To use Pathway Live Data Framework Community, comment out the line below.
pw.set_license_key("demo-license-key-with-telemetry")

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(name)s %(levelname)s %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)

load_dotenv()


class App(BaseModel):
    question_answerer: InstanceOf[SummaryQuestionAnswerer]
    host: str = "0.0.0.0"
    port: int = 8000

    with_cache: bool | None = None  # deprecated
    persistence_backend: pw.persistence.Backend | None = None
    persistence_mode: pw.PersistenceMode | None = pw.PersistenceMode.UDF_CACHING
    terminate_on_error: bool = False

    def run(self) -> None:
        server = QASummaryRestServer(  # noqa: F841
            self.host, self.port, self.question_answerer
        )

        if self.persistence_mode is None:
            if self.with_cache is True:
                warn(
                    "`with_cache` is deprecated. Please use `persistence_mode` instead.",
                    DeprecationWarning,
                )
                persistence_mode = pw.PersistenceMode.UDF_CACHING
            else:
                persistence_mode = None
        else:
            persistence_mode = self.persistence_mode

        if persistence_mode is not None:
            if self.persistence_backend is None:
                persistence_backend = pw.persistence.Backend.filesystem("./Cache")
            else:
                persistence_backend = self.persistence_backend
            persistence_config = pw.persistence.Config(
                persistence_backend,
                persistence_mode=persistence_mode,
            )
        else:
            persistence_config = None

        pw.run(
            persistence_config=persistence_config,
            terminate_on_error=self.terminate_on_error,
            monitoring_level=pw.MonitoringLevel.NONE,
        )

    model_config = ConfigDict(extra="forbid", arbitrary_types_allowed=True)


if __name__ == "__main__":
    with open("app.yaml") as f:
        config = pw.load_yaml(f)
    app = App(**config)
    app.run()

```

### Core Architecture Module: `templates/document_indexing/app.py`
```
import logging
from warnings import warn

import pathway as pw
from dotenv import load_dotenv
from pathway.xpacks.llm.document_store import DocumentStore
from pathway.xpacks.llm.servers import DocumentStoreServer
from pydantic import BaseModel, ConfigDict, InstanceOf

# To use advanced features with Pathway Live Data Framework Scale, get your free license key from
# https://pathway.com/features and paste it below.
# To use Pathway Live Data Framework Community, comment out the line below.
pw.set_license_key("demo-license-key-with-telemetry")

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(name)s %(levelname)s %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)

load_dotenv()


class App(BaseModel):
    document_store: InstanceOf[DocumentStore]
    host: str = "0.0.0.0"
    port: int = 8000

    with_cache: bool | None = None  # deprecated
    persistence_backend: pw.persistence.Backend | None = None
    persistence_mode: pw.PersistenceMode | None = pw.PersistenceMode.UDF_CACHING
    terminate_on_error: bool = False

    def run(self) -> None:
        server = DocumentStoreServer(  # noqa: F841
            self.host, self.port, self.document_store
        )
        if self.persistence_mode is None:
            if self.with_cache is True:
                warn(
                    "`with_cache` is deprecated. Please use `persistence_mode` instead.",
                    DeprecationWarning,
                )
                persistence_mode = pw.PersistenceMode.UDF_CACHING
            else:
                persistence_mode = None
        else:
            persistence_mode = self.persistence_mode

        if persistence_mode is not None:
            if self.persistence_backend is None:
                persistence_backend = pw.persistence.Backend.filesystem("./Cache")
            else:
                persistence_backend = self.persistence_backend
            persistence_config = pw.persistence.Config(
                persistence_backend,
                persistence_mode=persistence_mode,
            )
        else:
            persistence_config = None

        pw.run(
            persistence_config=persistence_config,
            terminate_on_error=self.terminate_on_error,
            monitoring_level=pw.MonitoringLevel.NONE,
        )

    model_config = ConfigDict(extra="forbid", arbitrary_types_allowed=True)


if __name__ == "__main__":
    with open("app.yaml") as f:
        config = pw.load_yaml(f)
    app = App(**config)
    app.run()

```

### Core Architecture Module: `templates/document_store_mcp_server/app.py`
```
import logging

import pathway as pw
from dotenv import load_dotenv
from pathway.xpacks.llm.mcp_server import PathwayMcp
from pydantic import BaseModel, ConfigDict

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(name)s %(levelname)s %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)

load_dotenv()


class App(BaseModel):
    mcp_http: PathwayMcp
    host: str = "0.0.0.0"
    port: int = 8000

    terminate_on_error: bool = False
    persistence_backend: pw.persistence.Backend | None = None
    persistence_mode: pw.PersistenceMode | None = pw.PersistenceMode.UDF_CACHING

    def run(self) -> None:
        if self.persistence_mode is not None:
            if self.persistence_backend is None:
                persistence_backend = pw.persistence.Backend.filesystem("./Cache")
            else:
                persistence_backend = self.persistence_backend
            persistence_config = pw.persistence.Config(
                persistence_backend,
                persistence_mode=self.persistence_mode,
            )
        else:
            persistence_config = None
        pw.run(
            terminate_on_error=self.terminate_on_error,
            persistence_config=persistence_config,
            monitoring_level=pw.MonitoringLevel.NONE,
        )

    model_config = ConfigDict(extra="forbid", arbitrary_types_allowed=True)


if __name__ == "__main__":
    with open("app.yaml") as f:
        config = pw.load_yaml(f)
    print(config)
    app = App(**config)
    app.run()

```

### Core Architecture Module: `templates/drive_alert/__init__.py`
```
from .app import run

__all__ = ["run"]

```

### Core Architecture Module: `templates/drive_alert/app.py`
```
"""
Microservice for a context-aware alerting ChatGPT assistant.

This demo is very similar to the `alert` example, the only difference is the data source (Google Drive)
For the demo, alerts are sent to Slack (you need to provide `slack_alert_channel_id` and `slack_alert_token`),
you can either put these env variables in .env file under llm-app directory,
or create env variables in the terminal (i.e. export in bash).

The program then starts a REST API endpoint serving queries about Google Docs stored in a
Google Drive folder.

We can create notifications by asking from Streamlit or sending query to API stating we want to be notified.
One example would be `Tell me and alert about the start date of the campaign for Magic Cola`

How Does It Work?
First, Pathway connects to Google Drive, extracts all documents, splits them into chunks, turns them into
vectors using OpenAI embedding service, and store in a nearest neighbor index.

Each query text is first turned into a vector, then relevant document chunks are found
using the nearest neighbor index. A prompt is built from the relevant chunk
and sent to the OpenAI GPT3.5 chat service for processing and answering.

After an initial answer is provided, Pathway monitors changes to documents and selectively
re-triggers potentially affected queries. If the new answer is significantly different from
the previously presented one, a new notification is created.

Please check the README.md in this directory for how-to-run instructions.
"""

import asyncio
import os

import dotenv
import pathway as pw
from pathway.stdlib.ml.index import KNNIndex
from pathway.xpacks.llm.embedders import OpenAIEmbedder
from pathway.xpacks.llm.llms import OpenAIChat, prompt_chat_single_qa
from pathway.xpacks.llm.parsers import UnstructuredParser
from pathway.xpacks.llm.splitters import TokenCountSplitter

# To use advanced features with Pathway Live Data Framework Scale, get your free license key from
# https://pathway.com/features and paste it below.
# To use Pathway Live Data Framework Community, comment out the line below.
pw.set_license_key("demo-license-key-with-telemetry")

dotenv.load_dotenv()


class DocumentInputSchema(pw.Schema):
    doc: str


class QueryInputSchema(pw.Schema):
    query: str
    user: str


# Helper Functions
@pw.udf
def build_prompt(documents, query):
    docs_str = "\n".join(
        [f"Doc-({idx}) -> {doc}" for idx, doc in enumerate(documents[::-1])]
    )
    prompt = f"""Given a set of documents, answer user query. If answer is not in docs, say it cant be inferred.

Docs: {docs_str}
Query: '{query}'
Final Response:"""
    return prompt


@pw.udf
def build_prompt_check_for_alert_request_and_extract_query(query: str) -> str:
    prompt = f"""Evaluate the user's query and identify if there is a request for notifications on answer alterations:
    User Query: '{query}'

    Respond with 'Yes' if there is a request for alerts, and 'No' if not,
    followed by the query without the alerting request part.

    Examples:
    "Tell me about windows in Pathway" => "No. Tell me about windows in Pathway"
    "Tell me and alert about windows in Pathway" => "Yes. Tell me about windows in Pathway"
    """
    return prompt


@pw.udf
def split_answer(answer: str) -> tuple[bool, str]:
    alert_enabled = "yes" in answer[:3].lower()
    true_query = answer[3:].strip(' ."')
    return alert_enabled, true_query


def build_prompt_compare_answers(new: str, old: str) -> str:
    prompt = f"""
    Are the two following responses deviating?
    Answer with Yes or No.

    First response: "{old}"

    Second response: "{new}"
    """
    return prompt


def make_query_id(user, query) -> str:
    return str(hash(query + user))


@pw.udf
def construct_notification_message(query: str, response: str) -> str:
    return f'New response for question "{query}":\n{response}'


@pw.udf
def construct_message(response, alert_flag, metainfo=None):
    if alert_flag:
        if metainfo:
            response += "\n" + str(metainfo)
        return response + "\n\n🔔 Activated"
    return response


def decision_to_bool(decision: str) -> bool:
    return "yes" in decision.lower()


def run(
    *,
    object_id=os.environ.get("FILE_OR_DIRECTORY_ID", ""),
    api_key: str = os.environ.get("OPENAI_API_KEY", ""),
    host: str = os.environ.get("PATHWAY_REST_CONNECTOR_HOST", "0.0.0.0"),
    port: int = int(os.environ.get("PATHWAY_REST_CONNECTOR_PORT", "8080")),
    embedder_locator: str = "text-embedding-ada-002",
    embedding_dimension: int = 1536,
    model_locator: str = "gpt-3.5-turbo",
    max_tokens: int = 400,
    temperature: float = 0.0,
    slack_alert_channel_id=os.environ.get("SLACK_ALERT_CHANNEL_ID", ""),
    slack_alert_token=os.environ.get("SLACK_ALERT_TOKEN", ""),
    service_user_credentials_file=os.environ.get(
        "GOOGLE_CREDS", "templates/drive_alert/secrets.json"
    ),
    **kwargs,
):
    # Part I: Build index
    embedder = OpenAIEmbedder(
        api_key=api_key,
        model=embedder_locator,
        retry_strategy=pw.asynchronous.FixedDelayRetryStrategy(),
        cache_strategy=pw.asynchronous.DefaultCache(),
    )

    # We start building the computational graph. Each pathway variable represents a
    # dynamically changing table.

    # The files table contains contents of documents in Google Drive.
    # Pathway automatically tracks changes to files and propagates these changes through
    # following computations.
    # Other Pathway connectors can be used as well - notably:
    # - pw.io.fs.read to load and track changes to the local drive and
    # - pw.io.s3.read to use an S3-compatible storage
    files = pw.io.gdrive.read(
        object_id=object_id,
        service_user_credentials_file=service_user_credentials_file,
        refresh_interval=30,  # interval between fetch operations in seconds, lower this for more responsiveness
    )
    parser = UnstructuredParser()
    documents = files.select(texts=parser(pw.this.data))
    documents = documents.flatten(pw.this.texts)
    documents = documents.select(texts=pw.this.texts[0])

    splitter = TokenCountSplitter()
    documents = documents.select(
        chunks=splitter(pw.this.texts, min_tokens=40, max_tokens=120)
    )
    documents = documents.flatten(pw.this.chunks)
    documents = documents.select(chunk=pw.this.chunks[0])

    enriched_documents = documents + documents.select(data=embedder(pw.this.chunk))

    # The index is updated each time a file changes.
    index = KNNIndex(
        enriched_documents.data, enriched_documents, n_dimensions=embedding_dimension
    )

    # Part II: receive queries, detect intent and prepare cleaned query

    # The rest_connector returns a table of all queries under processing
    query, response_writer = pw.io.http.rest_connector(
        host=host,
        port=port,
        schema=QueryInputSchema,
        autocommit_duration_ms=50,
        delete_completed_queries=False,
    )

    model = OpenAIChat(
        api_key=api_key,
        model=model_locator,
        temperature=temperature,
        max_tokens=max_tokens,
        retry_strategy=pw.asynchronous.FixedDelayRetryStrategy(),
        cache_strategy=pw.asynchronous.DefaultCache(),
    )

    # Pre-process the queries:
    # - detect alerting intent
    # - then embed the query for nearest neighbor retrieval
    query += query.select(
        prompt=build_prompt_check_for_alert_request_and_extract_query(query.query)
    )
    query += query.select(
        tupled=split_answer(
            model(
                prompt_chat_single_qa(pw.this.prompt),
                max_tokens=100,
            )
        ),
    )
    query = query.select(
        pw.this.user,
        alert_enabled=pw.this.tupled[0],
        query=pw.this.tupled[1],
    )

    query += query.select(
        data=embedder(pw.this.query),
        query_id=pw.apply(make_query_id, pw.this.user, pw.this.query),
    )

    # Part III: respond to queries

    # The context is a dynamic table: Pathway updates it each time:
    # - a new query arrives
    # - a source document is changed significantly enough to change the set of
    #   nearest neighbors
    query_context = query + index.get_nearest_items(query.data, k=3).select(
        documents_list=pw.this.chunk
    ).with_universe_of(query)

    # then we answer the queries using retrieved documents
    prompt = query_context.select(
        pw.this.query_id,
        pw.this.query,
        pw.this.alert_enabled,
        prompt=build_prompt(pw.this.documents_list, pw.this.query),
    )

    responses = prompt.select(
        pw.this.query_id,
        pw.this.query,
        pw.this.alert_enabled,
        response=model(
            prompt_chat_single_qa(pw.this.prompt),
        ),
    )

    output = responses.select(
        result=construct_message(pw.this.response, pw.this.alert_enabled)
    )

    # and send the answers back to the asking users
    response_writer(output)

    # Part IV: send alerts about responses which changed significantly.

    # However, for the queries with alerts the processing continues
    # whenever the set of documents retrieved for a query changes,
    # the table of responses is updated.
    responses = responses.filter(pw.this.alert_enabled)

    def acceptor(new: str, old: str) -> bool:
        if new == old:
            return False

        # TODO: clean after udfs can be used as common functions
        prompt = [dict(role="system", content=build_prompt_compare_answers(new, old))]
        decision = asyncio.run(model.__wrapped__(prompt, max_tokens=20))
        return decision_to_bool(decision)

    # Each update is compared with the previous one for deduplication
    deduplicated_responses = pw.stateful.deduplicate(
        responses,
        col=responses.response,
        acceptor=acceptor,
        instance=responses.query_id,
    )

    # Significant alerts are sent to the user
    alerts = deduplicated_responses.select(
        message=construct_notification
```

### Core Architecture Module: `templates/drive_alert/ui/server.py`
```
import os

import requests
import streamlit as st
from dotenv import load_dotenv

api_host = "localhost"
api_port = 8080

load_dotenv()
api_host = os.environ.get("PATHWAY_REST_CONNECTOR_HOST", "127.0.0.1")
api_port = int(os.environ.get("PATHWAY_REST_CONNECTOR_PORT", 8080))

with st.sidebar:
    st.markdown("## How to query your data\n")
    st.markdown(
        """Enter your question, optionally
ask to be alerted.\n"""
    )
    st.markdown(
        "Example: 'When does the magic cola campaign start? Alert me if the start date changes'",
    )
    st.markdown(
        """[View the source code on GitHub](
https://github.com/pathwaycom/llm-app/templates/drive_alert/app.py)"""
    )
    st.markdown("## Current Alerts:\n")


# Streamlit UI elements
st.title("Google Drive notifications with LLM")

prompt = st.text_input("How can I help you today?")
# prompt = st.chat_input("How can I help you today?")
# Initialize chat history
if "messages" not in st.session_state:
    st.session_state.messages = []

# Display chat messages from history on app rerun
for message in st.session_state.messages:
    with st.chat_message(message["role"]):
        st.markdown(message["content"])


# React to user input
if prompt:
    # Display user message in chat message container
    with st.chat_message("user"):
        st.markdown(prompt)

    # Add user message to chat history
    st.session_state.messages.append({"role": "user", "content": prompt})

    for message in st.session_state.messages:
        if message["role"] == "user":
            st.sidebar.text(f"📩 {message['content']}")

    url = f"http://{api_host}:{api_port}/"
    data = {"query": prompt, "user": "user"}

    response = requests.post(url, json=data)

    if response.status_code == 200:
        response = response.json()
        with st.chat_message("assistant"):
            st.markdown(response)
        st.session_state.messages.append({"role": "assistant", "content": response})
    else:
        st.error(f"Failed to send data. Status code: {response.status_code}")

```

### Core Architecture Module: `templates/multimodal_rag/app.py`
```
import logging
from warnings import warn

import pathway as pw
from dotenv import load_dotenv
from pathway.xpacks.llm.question_answering import SummaryQuestionAnswerer
from pathway.xpacks.llm.servers import QASummaryRestServer
from pydantic import BaseModel, ConfigDict, InstanceOf

# To use advanced features with Pathway Live Data Framework Scale, get your free license key from
# https://pathway.com/features and paste it below.
# To use Pathway Live Data Framework Community, comment out the line below.
pw.set_license_key("demo-license-key-with-telemetry")

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(name)s %(levelname)s %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)

load_dotenv()


class App(BaseModel):
    question_answerer: InstanceOf[SummaryQuestionAnswerer]
    host: str = "0.0.0.0"
    port: int = 8000

    with_cache: bool | None = None  # deprecated
    persistence_backend: pw.persistence.Backend | None = None
    persistence_mode: pw.PersistenceMode | None = pw.PersistenceMode.UDF_CACHING
    terminate_on_error: bool = False

    def run(self) -> None:
        server = QASummaryRestServer(  # noqa: F841
            self.host, self.port, self.question_answerer
        )

        if self.persistence_mode is None:
            if self.with_cache is True:
                warn(
                    "`with_cache` is deprecated. Please use `persistence_mode` instead.",
                    DeprecationWarning,
                )
                persistence_mode = pw.PersistenceMode.UDF_CACHING
            else:
                persistence_mode = None
        else:
            persistence_mode = self.persistence_mode

        if persistence_mode is not None:
            if self.persistence_backend is None:
                persistence_backend = pw.persistence.Backend.filesystem("./Cache")
            else:
                persistence_backend = self.persistence_backend
            persistence_config = pw.persistence.Config(
                persistence_backend,
                persistence_mode=persistence_mode,
            )
        else:
            persistence_config = None

        pw.run(
            persistence_config=persistence_config,
            terminate_on_error=self.terminate_on_error,
            monitoring_level=pw.MonitoringLevel.NONE,
        )

    model_config = ConfigDict(extra="forbid", arbitrary_types_allowed=True)


if __name__ == "__main__":
    with open("app.yaml") as f:
        config = pw.load_yaml(f)
    app = App(**config)
    app.run()

```

### Core Architecture Module: `templates/private_rag/app.py`
```
import logging
from warnings import warn

import pathway as pw
from dotenv import load_dotenv
from pathway.xpacks.llm.question_answering import SummaryQuestionAnswerer
from pathway.xpacks.llm.servers import QASummaryRestServer
from pydantic import BaseModel, ConfigDict, InstanceOf

# To use advanced features with Pathway Live Data Framework Scale, get your free license key from
# https://pathway.com/features and paste it below.
# To use Pathway Live Data Framework Community, comment out the line below.
pw.set_license_key("demo-license-key-with-telemetry")

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(name)s %(levelname)s %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)

load_dotenv()


class App(BaseModel):
    question_answerer: InstanceOf[SummaryQuestionAnswerer]
    host: str = "0.0.0.0"
    port: int = 8000

    with_cache: bool | None = None  # deprecated
    persistence_backend: pw.persistence.Backend | None = None
    persistence_mode: pw.PersistenceMode | None = pw.PersistenceMode.UDF_CACHING
    terminate_on_error: bool = False

    def run(self) -> None:
        server = QASummaryRestServer(  # noqa: F841
            self.host, self.port, self.question_answerer
        )

        if self.persistence_mode is None:
            if self.with_cache is True:
                warn(
                    "`with_cache` is deprecated. Please use `persistence_mode` instead.",
                    DeprecationWarning,
                )
                persistence_mode = pw.PersistenceMode.UDF_CACHING
            else:
                persistence_mode = None
        else:
            persistence_mode = self.persistence_mode

        if persistence_mode is not None:
            if self.persistence_backend is None:
                persistence_backend = pw.persistence.Backend.filesystem("./Cache")
            else:
                persistence_backend = self.persistence_backend
            persistence_config = pw.persistence.Config(
                persistence_backend,
                persistence_mode=persistence_mode,
            )
        else:
            persistence_config = None

        pw.run(
            persistence_config=persistence_config,
            terminate_on_error=self.terminate_on_error,
            monitoring_level=pw.MonitoringLevel.NONE,
        )

    model_config = ConfigDict(extra="forbid", arbitrary_types_allowed=True)


if __name__ == "__main__":
    with open("app.yaml") as f:
        config = pw.load_yaml(f)
    app = App(**config)
    app.run()

```

### Core Architecture Module: `templates/question_answering_rag/app.py`
```
import logging
from warnings import warn

import pathway as pw
from dotenv import load_dotenv
from pathway.xpacks.llm.question_answering import SummaryQuestionAnswerer
from pathway.xpacks.llm.servers import QASummaryRestServer
from pydantic import BaseModel, ConfigDict, InstanceOf

# To use advanced features with Pathway Live Data Framework Scale, get your free license key from
# https://pathway.com/features and paste it below.
# To use Pathway Live Data Framework Community, comment out the line below.
pw.set_license_key("demo-license-key-with-telemetry")

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(name)s %(levelname)s %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)

load_dotenv()


class App(BaseModel):
    question_answerer: InstanceOf[SummaryQuestionAnswerer]
    host: str = "0.0.0.0"
    port: int = 8000

    with_cache: bool | None = None  # deprecated
    persistence_backend: pw.persistence.Backend | None = None
    persistence_mode: pw.PersistenceMode | None = pw.PersistenceMode.UDF_CACHING
    terminate_on_error: bool = False

    def run(self) -> None:
        server = QASummaryRestServer(  # noqa: F841
            self.host, self.port, self.question_answerer
        )

        if self.persistence_mode is None:
            if self.with_cache is True:
                warn(
                    "`with_cache` is deprecated. Please use `persistence_mode` instead.",
                    DeprecationWarning,
                )
                persistence_mode = pw.PersistenceMode.UDF_CACHING
            else:
                persistence_mode = None
        else:
            persistence_mode = self.persistence_mode

        if persistence_mode is not None:
            if self.persistence_backend is None:
                persistence_backend = pw.persistence.Backend.filesystem("./Cache")
            else:
                persistence_backend = self.persistence_backend
            persistence_config = pw.persistence.Config(
                persistence_backend,
                persistence_mode=persistence_mode,
            )
        else:
            persistence_config = None

        pw.run(
            persistence_config=persistence_config,
            terminate_on_error=self.terminate_on_error,
            monitoring_level=pw.MonitoringLevel.NONE,
        )

    model_config = ConfigDict(extra="forbid", arbitrary_types_allowed=True)


if __name__ == "__main__":
    with open("app.yaml") as f:
        config = pw.load_yaml(f)
    app = App(**config)
    app.run()

```

### Core Architecture Module: `templates/question_answering_rag/ui/ui.py`
```
# Copyright © 2026 Pathway

import logging
import os

import streamlit as st
from dotenv import load_dotenv
from pathway.xpacks.llm.document_store import IndexingStatus
from pathway.xpacks.llm.question_answering import RAGClient

load_dotenv()

PATHWAY_HOST = os.environ.get("PATHWAY_HOST", "app")
PATHWAY_PORT = os.environ.get("PATHWAY_PORT", 8000)

st.set_page_config(
    page_title="Pathway Live Data Framework RAG App", page_icon="favicon.ico"
)

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(name)s %(levelname)s %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
    force=True,
)

logger = logging.getLogger("streamlit")
logger.setLevel(logging.INFO)

conn = RAGClient(url=f"http://{PATHWAY_HOST}:{PATHWAY_PORT}")

note = """
<H4><b>Ask a question"""
st.markdown(note, unsafe_allow_html=True)

st.markdown(
    """
<style>
div[data-baseweb="base-input"]{
}
input[class]{
font-size:150%;
color: black;}
button[data-testid="baseButton-primary"], button[data-testid="baseButton-secondary"]{
    border: none;
    display: flex;
    background-color: #E7E7E7;
    color: #454545;
    transition: color 0.3s;
}
button[data-testid="baseButton-primary"]:hover{
    color: #1C1CF0;
    background-color: rgba(28,28,240,0.3);
}
button[data-testid="baseButton-secondary"]:hover{
    color: #DC280B;
    background-color: rgba(220,40,11,0.3);
}
div[data-testid="stHorizontalBlock"]:has(button[data-testid="baseButton-primary"]){
    display: flex;
    flex-direction: column;
    z-index: 0;
    width: 3rem;

    transform: translateY(-500px) translateX(672px);
}
</style>
""",
    unsafe_allow_html=True,
)


question = st.text_input(label="", placeholder="Ask your question?")


def get_indexed_files(metadata_list: list[dict], opt_key: str) -> list:
    """Get all available options in a specific metadata key."""
    only_indexed_files = [
        file
        for file in metadata_list
        if file["_indexing_status"] == IndexingStatus.INDEXED
    ]
    options = set(map(lambda x: x[opt_key], only_indexed_files))
    return list(options)


def get_ingested_files(metadata_list: list[dict], opt_key: str) -> list:
    """Get all available options in a specific metadata key."""
    not_indexed_files = [
        file
        for file in metadata_list
        if file["_indexing_status"] == IndexingStatus.INGESTED
    ]
    options = set(map(lambda x: x[opt_key], not_indexed_files))
    return list(options)


logger.info("Requesting list_documents...")
document_meta_list = conn.list_documents(keys=[])
logger.info("Received response list_documents")

st.session_state["document_meta_list"] = document_meta_list

indexed_files = get_indexed_files(st.session_state["document_meta_list"], "path")
ingested_files = get_ingested_files(st.session_state["document_meta_list"], "path")


logo_htm = """
<div>
    <figure style="display: flex; align-items: center; margin: 0;">
        <img style="max-width:300px" src="app/static/pathway-logo-black.png" alt="Pathway Logo">
    </figure>
</div>
"""

with st.sidebar:
    st.markdown(logo_htm, unsafe_allow_html=True)

    st.info(
        body="See the source code [here](https://github.com/pathwaycom/llm-app/tree/main/templates/question_answering_rag).",  # noqa: E501
        icon=":material/code:",
    )

    indexed_file_names = [i.split("/")[-1] for i in indexed_files]
    ingested_file_names = [i.split("/")[-1] for i in ingested_files]

    markdown_table = "| Indexed files |\n| --- |\n"
    for file_name in indexed_file_names:
        markdown_table += f"| {file_name} |\n"

    if len(ingested_file_names) > 0:
        markdown_table += "| Files being processed |\n| --- |\n"
        for file_name in ingested_file_names:
            markdown_table += f"| {file_name} |\n"

    st.markdown(markdown_table, unsafe_allow_html=True)

    st.button("⟳ Refresh", use_container_width=True)

css = """
<style>
.slider-container {
    margin-top: 20px; /* Add some space between the main image and the slider */
}

.slider-item {
    float: left;
    margin: 10px;
    width: 120px; /* Adjust the width to your liking */
    // height: 50px; /* Adjust the height to your liking */
    border: 1px solid #ccc;
    border-radius: 5px;
    cursor: pointer;
}

.slider-item img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    border-radius: 5px;
}

.slider-wrapper {
    display: flex;
    justify-content: center;
    flex-wrap: wrap;
}

.slider-item {
    margin: 10px;
}

</style>"""


st.markdown(css, unsafe_allow_html=True)


if question:
    logger.info(
        {
            "_type": "search_request_event",
            "query": question,
        }
    )

    with st.spinner("Retrieving response..."):
        api_response = conn.answer(question, return_context_docs=True)
        response = api_response["response"]
        context_docs = api_response["context_docs"]

    logger.info(
        {
            "_type": "search_response_event",
            "query": question,
            "response": type(response),
        }
    )

    logger.info(type(response))

    st.markdown(f"**Answering question:** {question}")
    st.markdown(f"""{response}""")
    with st.expander(label="Context documents"):
        st.markdown("Documents sent to LLM as context:\n")
        for i, doc in enumerate(context_docs):
            st.markdown(
                f"{i+1}. Path: {doc['metadata']['path']}\n ```\n{doc['text']}\n```"
            )

```

### Core Architecture Module: `templates/slides_ai_search/app.py`
```
#!/usr/bin/env python

# Copyright © 2026 Pathway

# Copied and adapted from templates/slides_ai_search/app.py
# To use advanced features with Pathway Live Data Framework Scale, get your free license key from
# https://pathway.com/features and paste it in the `.env` file (check `.env.example`).

from pathlib import Path
from typing import Any
from warnings import warn

import pathway as pw
from dotenv import load_dotenv
from pathway.xpacks import llm
from pathway.xpacks.llm.document_store import SlidesDocumentStore
from pathway_slides_ai_search import DeckRetrieverWithFileSave, add_slide_id, get_model
from pydantic import BaseModel, ConfigDict, FilePath, InstanceOf


class App(BaseModel):
    host: str = "0.0.0.0"
    port: int = 8000

    sources: list[InstanceOf[pw.Table]]

    llm: InstanceOf[pw.UDF]
    retriever_factory: InstanceOf[pw.indexing.AbstractRetrieverFactory]

    search_topk: int = 6

    details_schema: FilePath | dict[str, Any] | None = None

    with_cache: bool | None = None  # deprecated
    persistence_backend: pw.persistence.Backend | None = None
    persistence_mode: pw.PersistenceMode | None = pw.PersistenceMode.UDF_CACHING
    terminate_on_error: bool = False

    def run(self) -> None:
        if self.details_schema is not None:
            detail_schema = get_model(self.details_schema)
        else:
            detail_schema = None

        parser = llm.parsers.SlideParser(
            detail_parse_schema=detail_schema,
            run_mode="parallel",
            include_schema_in_text=False,
            llm=self.llm,
            cache_strategy=pw.udfs.DefaultCache(),
            async_mode="fully_async",
        )

        doc_store = SlidesDocumentStore(
            self.sources,
            retriever_factory=self.retriever_factory,
            splitter=None,
            parser=parser,
            doc_post_processors=[add_slide_id],
        )

        app = DeckRetrieverWithFileSave(
            indexer=doc_store,
            search_topk=self.search_topk,
        )

        app.build_server(host=self.host, port=self.port)

        if self.persistence_mode is None:
            if self.with_cache is True:
                warn(
                    "`with_cache` is deprecated. Please use `persistence_mode` instead.",
                    DeprecationWarning,
                )
                persistence_mode = pw.PersistenceMode.UDF_CACHING
            else:
                persistence_mode = None
        else:
            persistence_mode = self.persistence_mode

        if persistence_mode is not None:
            if self.persistence_backend is None:
                persistence_backend = pw.persistence.Backend.filesystem("./Cache")
            else:
                persistence_backend = self.persistence_backend
            persistence_config = pw.persistence.Config(
                persistence_backend,
                persistence_mode=persistence_mode,
            )
        else:
            persistence_config = None

        pw.run(
            persistence_config=persistence_config,
            terminate_on_error=self.terminate_on_error,
            monitoring_level=pw.MonitoringLevel.NONE,
        )

    model_config = ConfigDict(extra="forbid", arbitrary_types_allowed=True)


if __name__ == "__main__":
    base_dir = Path(__file__).resolve().parent

    load_dotenv(base_dir / ".env")

    with open(base_dir / "app.yaml") as f:
        config = pw.load_yaml(f)

    app = App(**config)

    app.run()

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #114** (2025-01-31): **[Bug]:**
  *Symptoms*: ### Steps to reproduce  Hello,   I am trying to run the following - https://github.com/pathwaycom/llm-app/tree/main/examples/pipelines/demo-question-answering  There is bug coming - AttributeError: module 'pathway.xpacks.llm.parsers' has no attribute 'UnstructuredParser'  ### Relevant log output  ```text AttributeError: module 'pathway.xpacks.llm.parsers' has no attribute 'UnstructuredParser' ```  ### What did you expect to happen?  Ideally this class is present there. Upgrade my pathways as well  ### Version  pathway, version 0.16.4  ### Docker Versions (if used)  _No response_  ### OS  MacOS  ### On which CPU architecture did you run Pathway?  None
  **Post-Mortem & Fix Analysis**:
  > Hi, we are aware of this - we updated the llm-app to match the new release of Pathway package that was supposed to be released yesterday. Unfortunately, it's been delayed, but hopefully it'll happen today.  Until then, to make the code work you need to change this line: https://github.com/pathwaycom/llm-app/blob/590d853a5179439922eae413e9012d4c06f6d7ab/examples/pipelines/demo-question-answering/app.yaml#L42 to be ``` $parser: !pw.xpacks.llm.parsers.ParseUnstructured ``` Sorry for the inconvenience
  > Quick update - new Pathway package is released. On version 0.17.0 this example will work correctly without any changes

- **Issue #85** (2024-12-09): **Shei**
  *Symptoms*: ### Steps to reproduce  Big reprt  ### Relevant log output  ```text Bug reprt ```   ### What did you expect to happen?  Shetkls  ### Version  Wjefvn  ### Docker Versions (if used)  Whn  ### OS  Linux  ### On which CPU architecture did you run Pathway?  None
  **Post-Mortem & Fix Analysis**:
  > Hey @ArjitTiwarii, I am closing this issue as it doesn't contain any information about the bug. If you really need help feel free to open a new issue.

- **Issue #75** (2024-06-28): **Potential security issue**
  *Symptoms*: Hello 👋  I run a security community that finds and fixes vulnerabilities in OSS. A researcher (@m0kr4n3) has found a potential issue, which I would be eager to share with you.  Could you add a `SECURITY.md` file with an e-mail address for me to send further details to? GitHub [recommends](https://docs.github.com/en/code-security/getting-started/adding-a-security-policy-to-your-repository) a security policy to ensure issues are responsibly disclosed, and it would help direct researchers in the future.  Looking forward to hearing from you 👍  (cc @huntr-helper)
  **Post-Mortem & Fix Analysis**:
  > Hey @psmoros and @m0kr4n3, thanks, please reach out to the maintainers at the same e-mail address as for privacy breaches: https://pathway.com/privacy_gdpr_di/#breach-of-privacy. Happy to be in touch.
  > Hey @dxtrous, thank you for your reply. Actually, I already did and didn't get yet a response from them.
  > Hey @m0kr4n3, thanks a lot for this.  This repo illustrates correct usage of Pathway data processing technology with sample backend data pipelines for AI. They are meant to be simple but include some design best practices. The issue you point out touches on which of the Streamlit-based UI code templates bundled-into this repo in order to demonstrate how to use the pipeline might be suitable for "external" use, and which ones should only be reserved for testing/learning purposes only.   We acknowledge the concern and will make a point to clarify this in documentation, to avoid disillusionment for novice users.  In general, Streamlit was created as a rapid prototyping tool for internal use by data teams, although it is possible in some cases to share some demos on the cloud, hence confusion is starting to arrive. (And yes, we actually do that ourselves, for the sake of demo'ing one of the pipelines from this repo: https://chat-realtime-sharepoint-gdrive.streamlit.app/.)  Thank yo

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

### Incident Patch 1: `cbd32a58` (2025-10-23)
**Commit Message**: Fix relative links to assets in llm-app (#9439)

GitOrigin-RevId: 9181c0ea131577b7664d2a46dd161e669e03d7e1

**File**: `templates/adaptive_rag/README.md` (modified, +4/-4)
```diff
@@ -1,11 +1,11 @@
 <p align="center" class="flex items-center gap-1 justify-center flex-wrap">
-    <img src="../../../assets/gcp-logo.svg?raw=true" alt="GCP Logo" height="20" width="20">
+    <img src="../../assets/gcp-logo.svg?raw=true" alt="GCP Logo" height="20" width="20">
     <a href="https://pathway.com/developers/user-guide/deployment/gcp-deploy">Deploy with GCP</a> |
-    <img src="../../../assets/aws-fargate-logo.svg?raw=true" alt="AWS Logo" height="20" width="20">
+    <img src="../../assets/aws-fargate-logo.svg?raw=true" alt="AWS Logo" height="20" width="20">
     <a href="https://pathway.com/developers/user-guide/deployment/aws-fargate-deploy">Deploy with AWS</a> |
-    <img src="../../../assets/azure-logo.svg?raw=true" alt="Azure Logo" height="20" width="20">
+    <img src="../../assets/azure-logo.svg?raw=true" alt="Azure Logo" height="20" width="20">
     <a href="https://pathway.com/developers/user-guide/deployment/azure-aci-deploy">Deploy with Azure</a> |
-    <img src="../../../assets/render.png?raw=true" alt="Render Logo" height="20" width="20">
+    <img src="../../assets/render.png?raw=true" alt="Render Logo" height="20" width="20">
     <a href="https://pathway.com/developers/user-guide/deployment/render-deploy"> Deploy with Render </a>
 </p>
 
```

**File**: `templates/document_indexing/README.md` (modified, +4/-4)
```diff
@@ -1,11 +1,11 @@
 <p align="center" class="flex items-center gap-1 justify-center flex-wrap">
-    <img src="../../../assets/gcp-logo.svg?raw=true" alt="GCP Logo" height="20" width="20">
+    <img src="../../assets/gcp-logo.svg?raw=true" alt="GCP Logo" height="20" width="20">
     <a href="https://pathway.com/developers/user-guide/deployment/gcp-deploy">Deploy with GCP</a> |
-    <img src="../../../assets/aws-fargate-logo.svg?raw=true" alt="AWS Logo" height="20" width="20">
+    <img src="../../assets/aws-fargate-logo.svg?raw=true" alt="AWS Logo" height="20" width="20">
     <a href="https://pathway.com/developers/user-guide/deployment/aws-fargate-deploy">Deploy with AWS</a> |
-    <img src="../../../assets/azure-logo.svg?raw=true" alt="Azure Logo" height="20" width="20">
+    <img src="../../assets/azure-logo.svg?raw=true" alt="Azure Logo" height="20" width="20">
     <a href="https://pathway.com/developers/user-guide/deployment/azure-aci-deploy">Deploy with Azure</a> |
-    <img src="../../../assets/render.png?raw=true" alt="Render Logo" height="20" width="20">
+    <img src="../../assets/render.png?raw=true" alt="Render Logo" height="20" width="20">
     <a href="https://pathway.com/developers/user-guide/deployment/render-deploy"> Deploy with Render </a>
 </p>
 
```

**File**: `templates/multimodal_rag/README.md` (modified, +4/-4)
```diff
@@ -1,11 +1,11 @@
 <p align="center" class="flex items-center gap-1 justify-center flex-wrap">
-    <img src="../../../assets/gcp-logo.svg?raw=true" alt="GCP Logo" height="20" width="20">
+    <img src="../../assets/gcp-logo.svg?raw=true" alt="GCP Logo" height="20" width="20">
     <a href="https://pathway.com/developers/user-guide/deployment/gcp-deploy">Deploy with GCP</a> |
-    <img src="../../../assets/aws-fargate-logo.svg?raw=true" alt="AWS Logo" height="20" width="20">
+    <img src="../../assets/aws-fargate-logo.svg?raw=true" alt="AWS Logo" height="20" width="20">
     <a href="https://pathway.com/developers/user-guide/deployment/aws-fargate-deploy">Deploy with AWS</a> |
-    <img src="../../../assets/azure-logo.svg?raw=true" alt="Azure Logo" height="20" width="20">
+    <img src="../../assets/azure-logo.svg?raw=true" alt="Azure Logo" height="20" width="20">
     <a href="https://pathway.com/developers/user-guide/deployment/azure-aci-deploy">Deploy with Azure</a> |
-    <img src="../../../assets/render.png?raw=true" alt="Render Logo" height="20" width="20">
+    <img src="../../assets/render.png?raw=true" alt="Render Logo" height="20" width="20">
     <a href="https://pathway.com/developers/user-guide/deployment/render-deploy"> Deploy with Render </a>
 </p>
 
```

**File**: `templates/private_rag/README.md` (modified, +4/-4)
```diff
@@ -1,11 +1,11 @@
 <p align="center" class="flex items-center gap-1 justify-center flex-wrap">
-    <img src="../../../assets/gcp-logo.svg?raw=true" alt="GCP Logo" height="20" width="20">
+    <img src="../../assets/gcp-logo.svg?raw=true" alt="GCP Logo" height="20" width="20">
     <a href="https://pathway.com/developers/user-guide/deployment/gcp-deploy">Deploy with GCP</a> |
-    <img src="../../../assets/aws-fargate-logo.svg?raw=true" alt="AWS Logo" height="20" width="20">
+    <img src="../../assets/aws-fargate-logo.svg?raw=true" alt="AWS Logo" height="20" width="20">
     <a href="https://pathway.com/developers/user-guide/deployment/aws-fargate-deploy">Deploy with AWS</a> |
-    <img src="../../../assets/azure-logo.svg?raw=true" alt="Azure Logo" height="20" width="20">
+    <img src="../../assets/azure-logo.svg?raw=true" alt="Azure Logo" height="20" width="20">
     <a href="https://pathway.com/developers/user-guide/deployment/azure-aci-deploy">Deploy with Azure</a> |
-    <img src="../../../assets/render.png?raw=true" alt="Render Logo" height="20" width="20">
+    <img src="../../assets/render.png?raw=true" alt="Render Logo" height="20" width="20">
     <a href="https://pathway.com/developers/user-guide/deployment/render-deploy"> Deploy with Render </a>
 </p>
 
```

**File**: `templates/question_answering_rag/README.md` (modified, +4/-4)
```diff
@@ -1,11 +1,11 @@
 <p align="center" class="flex items-center gap-1 justify-center flex-wrap">
-    <img src="../../../assets/gcp-logo.svg?raw=true" alt="GCP Logo" height="20" width="20">
+    <img src="../../assets/gcp-logo.svg?raw=true" alt="GCP Logo" height="20" width="20">
     <a href="https://pathway.com/developers/user-guide/deployment/gcp-deploy">Deploy with GCP</a> |
-    <img src="../../../assets/aws-fargate-logo.svg?raw=true" alt="AWS Logo" height="20" width="20">
+    <img src="../../assets/aws-fargate-logo.svg?raw=true" alt="AWS Logo" height="20" width="20">
     <a href="https://pathway.com/developers/user-guide/deployment/aws-fargate-deploy">Deploy with AWS</a> |
-    <img src="../../../assets/azure-logo.svg?raw=true" alt="Azure Logo" height="20" width="20">
+    <img src="../../assets/azure-logo.svg?raw=true" alt="Azure Logo" height="20" width="20">
     <a href="https://pathway.com/developers/user-guide/deployment/azure-aci-deploy">Deploy with Azure</a> |
-    <img src="../../../assets/render.png?raw=true" alt="Render Logo" height="20" width="20">
+    <img src="../../assets/render.png?raw=true" alt="Render Logo" height="20" width="20">
     <a href="https://pathway.com/developers/user-guide/deployment/render-deploy"> Deploy with Render </a>
 </p>
 
```

**File**: `templates/slides_ai_search/README.md` (modified, +4/-4)
```diff
@@ -1,11 +1,11 @@
 <p align="center" class="flex items-center gap-1 justify-center flex-wrap">
-    <img src="../../../assets/gcp-logo.svg?raw=true" alt="GCP Logo" height="20" width="20">
+    <img src="../../assets/gcp-logo.svg?raw=true" alt="GCP Logo" height="20" width="20">
     <a href="https://pathway.com/developers/user-guide/deployment/gcp-deploy">Deploy with GCP</a> |
-    <img src="../../../assets/aws-fargate-logo.svg?raw=true" alt="AWS Logo" height="20" width="20">
+    <img src="../../assets/aws-fargate-logo.svg?raw=true" alt="AWS Logo" height="20" width="20">
     <a href="https://pathway.com/developers/user-guide/deployment/aws-fargate-deploy">Deploy with AWS</a> |
-    <img src="../../../assets/azure-logo.svg?raw=true" alt="Azure Logo" height="20" width="20">
+    <img src="../../assets/azure-logo.svg?raw=true" alt="Azure Logo" height="20" width="20">
     <a href="https://pathway.com/developers/user-guide/deployment/azure-aci-deploy">Deploy with Azure</a> |
-    <img src="../../../assets/render.png?raw=true" alt="Render Logo" height="20" width="20">
+    <img src="../../assets/render.png?raw=true" alt="Render Logo" height="20" width="20">
     <a href="https://pathway.com/developers/user-guide/deployment/render-deploy"> Deploy with Render </a>
 </p>
 
```

**File**: `templates/unstructured_to_sql_on_the_fly/README.md` (modified, +4/-4)
```diff
@@ -1,11 +1,11 @@
 <p align="center" class="flex items-center gap-1 justify-center flex-wrap">
-    <img src="../../../assets/gcp-logo.svg?raw=true" alt="GCP Logo" height="20" width="20">
+    <img src="../../assets/gcp-logo.svg?raw=true" alt="GCP Logo" height="20" width="20">
     <a href="https://pathway.com/developers/user-guide/deployment/gcp-deploy">Deploy with GCP</a> |
-    <img src="../../../assets/aws-fargate-logo.svg?raw=true" alt="AWS Logo" height="20" width="20">
+    <img src="../../assets/aws-fargate-logo.svg?raw=true" alt="AWS Logo" height="20" width="20">
     <a href="https://pathway.com/developers/user-guide/deployment/aws-fargate-deploy">Deploy with AWS</a> |
-    <img src="../../../assets/azure-logo.svg?raw=true" alt="Azure Logo" height="20" width="20">
+    <img src="../../assets/azure-logo.svg?raw=true" alt="Azure Logo" height="20" width="20">
     <a href="https://pathway.com/developers/user-guide/deployment/azure-aci-deploy">Deploy with Azure</a> |
-    <img src="../../../assets/render.png?raw=true" alt="Render Logo" height="20" width="20">
+    <img src="../../assets/render.png?raw=true" alt="Render Logo" height="20" width="20">
     <a href="https://pathway.com/developers/user-guide/deployment/render-deploy"> Deploy with Render </a>
 </p>
 
```

---

### Incident Patch 2: `7d54c873` (2025-09-15)
**Commit Message**: [Website] Fix link warnings/errors (#9258)

Co-authored-by: Sebastian Wludzik <[REDACTED_EMAIL]>
GitOrigin-RevId: 8258f6b6795c69b724a5069224d6c6e46f2da58e

**File**: `examples/pipelines/adaptive-rag/README.md` (modified, +2/-2)
```diff
@@ -119,7 +119,7 @@ The local data source is configured by using map with tag `!pw.io.fs.read`. Then
 
 The Google Drive data source is enabled by using map with tag `!pw.io.gdrive.read`. The map must contain two main parameters:
 - `object_id`, containing the ID of the folder that needs to be indexed. It can be found from the URL in the web interface, where it's the last part of the address. For example, the publicly available demo folder in Google Drive has the URL `https://drive.google.com/drive/folders/1cULDv2OaViJBmOfG5WB0oWcgayNrGtVs`. Consequently, the last part of this address is `1cULDv2OaViJBmOfG5WB0oWcgayNrGtVs`, hence this is the `object_id` you would need to specify.
-- `service_user_credentials_file`, containing the path to the credentials files for the Google [service account](https://cloud.google.com/iam/docs/service-account-overview). To get more details on setting up the service account and getting credentials, you can also refer to [this tutorial](https://pathway.com/developers/user-guide/connectors/gdrive-connector/#setting-up-google-drive).
+- `service_user_credentials_file`, containing the path to the credentials files for the Google [service account](https://cloud.google.com/iam/docs/service-account-overview). To get more details on setting up the service account and getting credentials, you can also refer to [this tutorial](https://pathway.com/developers/user-guide/connectors/gdrive-connector#setting-up-google-drive).
 
 Besides, to speed up the indexing process you may want to specify the `refresh_interval` parameter, denoted by an integer number of seconds. It corresponds to the frequency between two sequential folder scans. If unset, it defaults to 30 seconds.
 
@@ -129,7 +129,7 @@ For the full list of the available parameters, please refer to the Google Drive
 
 This data source requires Scale or Enterprise [license key](https://pathway.com/pricing) - you can obtain free Scale key on [Pathway website](https://pathway.com/get-license).
 
-To use it, set the map tag to be `!pw.xpacks.connectors.sharepoint.read`, and then provide values of `url`, `tenant`, `client_id`, `cert_path`, `thumbprint` and `root_path`. To read about the meaning of these arguments, check the Sharepoint connector [documentation](https://pathway.com/developers/api-docs/pathway-xpacks-sharepoint/#pathway.xpacks.connectors.sharepoint.read).
+To use it, set the map tag to be `!pw.xpacks.connectors.sharepoint.read`, and then provide values of `url`, `tenant`, `client_id`, `cert_path`, `thumbprint` and `root_path`. To read about the meaning of these arguments, check the Sharepoint connector [documentation](https://pathway.com/developers/api-docs/pathway-xpacks-sharepoint#pathway.xpacks.connectors.sharepoint.read).
 
 ## Running the app
 To run the app, depending on the configuration, you may need to set up environmntal variables with LLM provider keys. By default, this template  uses OpenAI API, so to run it you need to set `OPENAI_API_KEY` environmental key or create an `.env` file in this directory with your key: `OPENAI_API_KEY=sk-...`. If you modify the code to use another LLM provider, you may need to set a relevant API key.
```

**File**: `examples/pipelines/demo-document-indexing/README.md` (modified, +2/-2)
```diff
@@ -108,7 +108,7 @@ The local data source is configured by using map with tag `!pw.io.fs.read`. Then
 
 The Google Drive data source is enabled by using map with tag `!pw.io.gdrive.read`. The map must contain two main parameters:
 - `object_id`, containing the ID of the folder that needs to be indexed. It can be found from the URL in the web interface, where it's the last part of the address. For example, the publicly available demo folder in Google Drive has the URL `https://drive.google.com/drive/folders/1cULDv2OaViJBmOfG5WB0oWcgayNrGtVs`. Consequently, the last part of this address is `1cULDv2OaViJBmOfG5WB0oWcgayNrGtVs`, hence this is the `object_id` you would need to specify.
-- `service_user_credentials_file`, containing the path to the credentials files for the Google [service account](https://cloud.google.com/iam/docs/service-account-overview). To get more details on setting up the service account and getting credentials, you can also refer to [this tutorial](https://pathway.com/developers/user-guide/connectors/gdrive-connector/#setting-up-google-drive).
+- `service_user_credentials_file`, containing the path to the credentials files for the Google [service account](https://cloud.google.com/iam/docs/service-account-overview). To get more details on setting up the service account and getting credentials, you can also refer to [this tutorial](https://pathway.com/developers/user-guide/connectors/gdrive-connector#setting-up-google-drive).
 
 Besides, to speed up the indexing process you may want to specify the `refresh_interval` parameter, denoted by an integer number of seconds. It corresponds to the frequency between two sequential folder scans. If unset, it defaults to 30 seconds.
 
@@ -118,7 +118,7 @@ For the full list of the available parameters, please refer to the Google Drive
 
 This data source requires Scale or Enterprise [license key](https://pathway.com/pricing) - you can obtain free Scale key on [Pathway website](https://pathway.com/get-license).
 
-To use it, set the map tag to be `!pw.xpacks.connectors.sharepoint.read`, and then provide values of `url`, `tenant`, `client_id`, `cert_path`, `thumbprint` and `root_path`. To read about the meaning of these arguments, check the Sharepoint connector [documentation](https://pathway.com/developers/api-docs/pathway-xpacks-sharepoint/#pathway.xpacks.connectors.sharepoint.read).
+To use it, set the map tag to be `!pw.xpacks.connectors.sharepoint.read`, and then provide values of `url`, `tenant`, `client_id`, `cert_path`, `thumbprint` and `root_path`. To read about the meaning of these arguments, check the Sharepoint connector [documentation](https://pathway.com/developers/api-docs/pathway-xpacks-sharepoint#pathway.xpacks.connectors.sharepoint.read).
 
 ## Running the Example
 
```

**File**: `examples/pipelines/demo-question-answering/README.md` (modified, +6/-6)
```diff
@@ -28,7 +28,7 @@ This demo allows you to:
 - Get an executive outlook for a question on different files to easily access available knowledge in your documents;
 
 
-Note: This app relies on [Document Store](https://pathway.com/developers/api-docs/pathway-xpacks-llm/document_store) to learn more, you can check out [this blog post](https://pathway.com/developers/user-guide/llm-xpack/docs-indexing/).
+Note: This app relies on [Document Store](https://pathway.com/developers/api-docs/pathway-xpacks-llm/document_store) to learn more, you can check out [this blog post](https://pathway.com/developers/user-guide/llm-xpack/docs-indexing).
 
 ## Table of contents
 - [Summary of available endpoints](#Summary-of-available-endpoints)
@@ -91,7 +91,7 @@ This folder contains several objects:
 
 Pathway allows you to define custom prompts in addition to the ones provided in [`pathway.xpacks.llm`](https://pathway.com/developers/user-guide/llm-xpack/overview).
 
-You can also use user-defined functions using the [`@pw.udf`](https://pathway.com/developers/api-docs/pathway/#pathway.udf) decorator to define custom functions that will run on streaming data.
+You can also use user-defined functions using the [`@pw.udf`](https://pathway.com/developers/api-docs/pathway#pathway.udf) decorator to define custom functions that will run on streaming data.
 
 - RAG
 
@@ -109,7 +109,7 @@ Default LLM provider in this template is OpenAI, so, unless you change the confi
 
 ## Customizing the pipeline
 
-The code can be modified by changing the `app.yaml` configuration file. To read more about YAML files used in Pathway templates, read [our guide](https://pathway.com/developers/templates/configure-yaml/).
+The code can be modified by changing the `app.yaml` configuration file. To read more about YAML files used in Pathway templates, read [our guide](https://pathway.com/developers/templates/configure-yaml).
 
 In the `app.yaml` file we define:
 - input connectors
@@ -227,7 +227,7 @@ The local data source is configured by using map with tag `!pw.io.fs.read`. Then
 
 The Google Drive data source is enabled by using map with tag `!pw.io.gdrive.read`. The map must contain two main parameters:
 - `object_id`, containing the ID of the folder that needs to be indexed. It can be found from the URL in the web interface, where it's the last part of the address. For example, the publicly available demo folder in Google Drive has the URL `https://drive.google.com/drive/folders/1cULDv2OaViJBmOfG5WB0oWcgayNrGtVs`. The last part of this address is `1cULDv2OaViJBmOfG5WB0oWcgayNrGtVs` and this is the `object_id` you would need to specify.
-- `service_user_credentials_file`, containing the path to the credentials files for the Google [service account](https://cloud.google.com/iam/docs/service-account-overview). To get more details on setting up the service account and getting credentials, you can also refer to [this tutorial](https://pathway.com/developers/user-guide/connectors/gdrive-connector/#setting-up-google-drive).
+- `service_user_credentials_file`, containing the path to the credentials files for the Google [service account](https://cloud.google.com/iam/docs/service-account-overview). To get more details on setting up the service account and getting credentials, you can also refer to [this tutorial](https://pathway.com/developers/user-guide/connectors/gdrive-connector#setting-up-google-drive).
 
 Besides, to speed up the indexing process you may want to specify the `refresh_interval` parameter, denoted by an integer number of seconds. It corresponds to the frequency between two sequential folder scans. If unset, it defaults to 30 seconds.
 
@@ -237,7 +237,7 @@ For the full list of the available parameters, please refer to the Google Drive
 
 This data source requires Scale or Enterprise [license key](https://pathway.com/pricing) - you can obtain free Scale key on [Pathway website](https://pathway.com/get-license).
 
-To use it, set the map tag to be `!pw.xpacks.connectors.sharepoint.read`, and then provide values of `url`, `tenant`, `client_id`, `cert_path`, `thumbprint` and `root_path`. To read about the meaning of these arguments, check the Sharepoint connector [documentation](https://pathway.com/developers/api-docs/pathway-xpacks-sharepoint/#pathway.xpacks.connectors.sharepoint.read).
+To use it, set the map tag to be `!pw.xpacks.connectors.sharepoint.read`, and then provide values of `url`, `tenant`, `client_id`, `cert_path`, `thumbprint` and `root_path`. To read about the meaning of these arguments, check the Sharepoint connector [documentation](https://pathway.com/developers/api-docs/pathway-xpacks-sharepoint#pathway.xpacks.connectors.sharepoint.read).
 
 ## How to run the project
 
@@ -333,7 +333,7 @@ curl -X 'POST' \
 
 #### Asking questions to LLM (With and without RAG)
 
-- Note: The local version of this app does not require `openai_api_key` parameter in the payload of the query. Embedder and LLM will use the API key in the `.env` file. Howeve
```

**File**: `examples/pipelines/gpt_4o_multimodal_rag/README.md` (modified, +1/-1)
```diff
@@ -202,7 +202,7 @@ curl -X 'POST'   'http://0.0.0.0:8000/v2/list_documents'   -H 'accept: */*'   -H
 This will return the list of files e.g. if you start with the [data folder](./data) provided in the demo, the answer will be as follows:
 > `[{"modified_at": 1715765613, "owner": "berke", "path": "data/20230203_alphabet_10K.pdf", "seen_at": 1715768762}]`
 
-In the default app setup, the connected folder is a local file folder. You can add more folders and file sources, such as [Google Drive](https://pathway.com/developers/user-guide/connectors/gdrive-connector/#google-drive-connector) or [Sharepoint](https://pathway.com/developers/user-guide/connecting-to-data/connectors/#tutorials), by adding a line of code to the template.
+In the default app setup, the connected folder is a local file folder. You can add more folders and file sources, such as [Google Drive](https://pathway.com/developers/user-guide/connectors/gdrive-connector#google-drive-connector) or [Sharepoint](https://pathway.com/developers/user-guide/connecting-to-data/connectors#tutorials), by adding a line of code to the template.
 
 If you now add or remove files from your connected folder, you can repeat the request and see the index file list has been updated automatically. You can look into the logs of the service to see the progress of the indexing of new and modified files. PDF files of 100 pages should normally take under 10 seconds to sync, and the indexing parallelizes if multiple files are added at a single time.
 
```

**File**: `examples/pipelines/private-rag/README.md` (modified, +3/-3)
```diff
@@ -49,7 +49,7 @@ The architecture consists of two connected technology bricks, which will run as
 
 ## Customizing the pipeline
 
-The code can be modified by changing the `app.yaml` configuration file. To read more about YAML files used in Pathway templates, read [our guide](https://pathway.com/developers/templates/configure-yaml/).
+The code can be modified by changing the `app.yaml` configuration file. To read more about YAML files used in Pathway templates, read [our guide](https://pathway.com/developers/templates/configure-yaml).
 
 In the `app.yaml` file we define:
 - input connectors
@@ -106,7 +106,7 @@ The local data source is configured by using map with tag `!pw.io.fs.read`. Then
 
 The Google Drive data source is enabled by using map with tag `!pw.io.gdrive.read`. The map must contain two main parameters:
 - `object_id`, containing the ID of the folder that needs to be indexed. It can be found from the URL in the web interface, where it's the last part of the address. For example, the publicly available demo folder in Google Drive has the URL `https://drive.google.com/drive/folders/1cULDv2OaViJBmOfG5WB0oWcgayNrGtVs`. Consequently, the last part of this address is `1cULDv2OaViJBmOfG5WB0oWcgayNrGtVs`, hence this is the `object_id` you would need to specify.
-- `service_user_credentials_file`, containing the path to the credentials files for the Google [service account](https://cloud.google.com/iam/docs/service-account-overview). To get more details on setting up the service account and getting credentials, you can also refer to [this tutorial](https://pathway.com/developers/user-guide/connectors/gdrive-connector/#setting-up-google-drive).
+- `service_user_credentials_file`, containing the path to the credentials files for the Google [service account](https://cloud.google.com/iam/docs/service-account-overview). To get more details on setting up the service account and getting credentials, you can also refer to [this tutorial](https://pathway.com/developers/user-guide/connectors/gdrive-connector#setting-up-google-drive).
 
 Besides, to speed up the indexing process you may want to specify the `refresh_interval` parameter, denoted by an integer number of seconds. It corresponds to the frequency between two sequential folder scans. If unset, it defaults to 30 seconds.
 
@@ -116,7 +116,7 @@ For the full list of the available parameters, please refer to the Google Drive
 
 This data source requires Scale or Enterprise [license key](https://pathway.com/pricing) - you can obtain free Scale key on [Pathway website](https://pathway.com/get-license).
 
-To use it, set the map tag to be `!pw.xpacks.connectors.sharepoint.read`, and then provide values of `url`, `tenant`, `client_id`, `cert_path`, `thumbprint` and `root_path`. To read about the meaning of these arguments, check the Sharepoint connector [documentation](https://pathway.com/developers/api-docs/pathway-xpacks-sharepoint/#pathway.xpacks.connectors.sharepoint.read).
+To use it, set the map tag to be `!pw.xpacks.connectors.sharepoint.read`, and then provide values of `url`, `tenant`, `client_id`, `cert_path`, `thumbprint` and `root_path`. To read about the meaning of these arguments, check the Sharepoint connector [documentation](https://pathway.com/developers/api-docs/pathway-xpacks-sharepoint#pathway.xpacks.connectors.sharepoint.read).
 
 
 ## Deploying and using a local LLM
```

**File**: `examples/pipelines/slides_ai_search/README.md` (modified, +1/-1)
```diff
@@ -81,7 +81,7 @@ This demo consists of three parts:
 
 1. **Data Sources**:
     * The application reads slide files (PPTX and PDF) from a specified directory. The directory is set to `./data/`in the `app.py` file.
-    * In the default app setup, the connected folder is a local file folder. You can add more folders and file sources, such as [Google Drive](https://pathway.com/developers/user-guide/connectors/gdrive-connector/#google-drive-connector) or [Sharepoint](https://pathway.com/developers/user-guide/connecting-to-data/connectors/#tutorials), by changing configuration in `app.yaml`.
+    * In the default app setup, the connected folder is a local file folder. You can add more folders and file sources, such as [Google Drive](https://pathway.com/developers/user-guide/connectors/gdrive-connector#google-drive-connector) or [Sharepoint](https://pathway.com/developers/user-guide/connecting-to-data/connectors#tutorials), by changing configuration in `app.yaml`.
     * More inputs can be added by configuring the `sources` list in the `app.yaml`.
 
 
```

---

### Incident Patch 3: `1a60fd78` (2025-07-30)
**Commit Message**: Fix dependencies of demo question answering (#9095)

GitOrigin-RevId: 8f607fb704980b0f6e29d72a124b7c81d7b2474e

**File**: `examples/pipelines/adaptive-rag/requirements.txt` (modified, +1/-1)
```diff
@@ -1 +1 @@
-python-dotenv==1.0.1
+python-dotenv~=1.0
```

**File**: `examples/pipelines/demo-document-indexing/requirements.txt` (modified, +1/-1)
```diff
@@ -1 +1 @@
-python-dotenv==1.0.1
+python-dotenv~=1.0
```

**File**: `examples/pipelines/demo-question-answering/requirements.txt` (modified, +2/-2)
```diff
@@ -1,3 +1,3 @@
 pathway[all]
-python-dotenv==1.0.1
-mpmath==1.3.0
+python-dotenv~=1.0
+mpmath~=1.3
```

**File**: `examples/pipelines/gpt_4o_multimodal_rag/requirements.txt` (modified, +2/-2)
```diff
@@ -1,3 +1,3 @@
 pathway[all]
-python-dotenv==1.0.1
-mpmath==1.3.0
+python-dotenv~=1.0
+mpmath~=1.3
```

**File**: `examples/pipelines/private-rag/requirements.txt` (modified, +2/-2)
```diff
@@ -1,3 +1,3 @@
 pathway[all]
-python-dotenv==1.0.1
-mpmath==1.3.0
+python-dotenv~=1.0
+mpmath~=1.3
```

**File**: `examples/pipelines/slides_ai_search/requirements.txt` (modified, +1/-1)
```diff
@@ -1 +1 @@
-python-dotenv==1.0.1
+python-dotenv~=1.0
```

**File**: `examples/pipelines/unstructured_to_sql_on_the_fly/requirements.txt` (modified, +2/-2)
```diff
@@ -1,2 +1,2 @@
-python-dotenv==1.0.1
-psycopg==3.1.12
+python-dotenv~=1.0
+psycopg~=3.1
```

---

### Incident Patch 4: `c9ee7d98` (2025-04-11)
**Commit Message**: UI for presenting not indexed files (#8483)

Co-authored-by: Albert Roethel <[REDACTED_EMAIL]>
Co-authored-by: bjornengdahl <[REDACTED_EMAIL]>
GitOrigin-RevId: 7eb146176a18d96de482d74e159f13393c3df09a

**File**: `examples/pipelines/demo-question-answering/ui/requirements.txt` (modified, +0/-4)
```diff
@@ -1,6 +1,2 @@
 streamlit==1.37.0
 load_dotenv==0.1.0
-nest_asyncio==1.6.0
-aiohttp==3.9.5
-beautifulsoup4==4.12.3
-openai==1.35.10
```

**File**: `examples/pipelines/demo-question-answering/ui/ui.py` (modified, +38/-15)
```diff
@@ -3,9 +3,9 @@
 import logging
 import os
 
-import requests
 import streamlit as st
 from dotenv import load_dotenv
+from pathway.xpacks.llm.document_store import IndexingStatus
 from pathway.xpacks.llm.question_answering import RAGClient
 
 load_dotenv()
@@ -71,9 +71,25 @@
 question = st.text_input(label="", placeholder="Ask your question?")
 
 
-def get_options_list(metadata_list: list[dict], opt_key: str) -> list:
+def get_indexed_files(metadata_list: list[dict], opt_key: str) -> list:
     """Get all available options in a specific metadata key."""
-    options = set(map(lambda x: x[opt_key], metadata_list))
+    only_indexed_files = [
+        file
+        for file in metadata_list
+        if file["_indexing_status"] == IndexingStatus.INDEXED
+    ]
+    options = set(map(lambda x: x[opt_key], only_indexed_files))
+    return list(options)
+
+
+def get_ingested_files(metadata_list: list[dict], opt_key: str) -> list:
+    """Get all available options in a specific metadata key."""
+    not_indexed_files = [
+        file
+        for file in metadata_list
+        if file["_indexing_status"] == IndexingStatus.INGESTED
+    ]
+    options = set(map(lambda x: x[opt_key], not_indexed_files))
     return list(options)
 
 
@@ -83,7 +99,8 @@ def get_options_list(metadata_list: list[dict], opt_key: str) -> list:
 
 st.session_state["document_meta_list"] = document_meta_list
 
-available_files = get_options_list(st.session_state["document_meta_list"], "path")
+indexed_files = get_indexed_files(st.session_state["document_meta_list"], "path")
+ingested_files = get_ingested_files(st.session_state["document_meta_list"], "path")
 
 
 with st.sidebar:
@@ -92,11 +109,18 @@ def get_options_list(metadata_list: list[dict], opt_key: str) -> list:
         icon=":material/code:",
     )
 
-    file_names = [i.split("/")[-1] for i in available_files]
+    indexed_file_names = [i.split("/")[-1] for i in indexed_files]
+    ingested_file_names = [i.split("/")[-1] for i in ingested_files]
 
     markdown_table = "| Indexed files |\n| --- |\n"
-    for file_name in file_names:
+    for file_name in indexed_file_names:
         markdown_table += f"| {file_name} |\n"
+
+    if len(ingested_file_names) > 0:
+        markdown_table += "| Files being processed |\n| --- |\n"
+        for file_name in ingested_file_names:
+            markdown_table += f"| {file_name} |\n"
+
     st.markdown(markdown_table, unsafe_allow_html=True)
 
     st.button("⟳ Refresh", use_container_width=True)
@@ -140,14 +164,6 @@ def get_options_list(metadata_list: list[dict], opt_key: str) -> list:
 st.markdown(css, unsafe_allow_html=True)
 
 
-def send_post_request(
-    url: str, data: dict, headers: dict = {}, timeout: int | None = None
-):
-    response = requests.post(url, json=data, headers=headers, timeout=timeout)
-    response.raise_for_status()
-    return response.json()
-
-
 if question:
     logger.info(
         {
@@ -157,8 +173,9 @@ def send_post_request(
     )
 
     with st.spinner("Retrieving response..."):
-        api_response = conn.answer(question)
+        api_response = conn.answer(question, return_context_docs=True)
         response = api_response["response"]
+        context_docs = api_response["context_docs"]
 
     logger.info(
         {
@@ -172,3 +189,9 @@ def send_post_request(
 
     st.markdown(f"**Answering question:** {question}")
     st.markdown(f"""{response}""")
+    with st.expander(label="Context documents"):
+        st.markdown("Documents sent to LLM as context:\n")
+        for i, doc in enumerate(context_docs):
+            st.markdown(
+                f"{i+1}. Path: {doc['metadata']['path']}\n ```\n{doc['text']}\n```"
+            )
```

---

### Incident Patch 5: `e712af38` (2025-04-08)
**Commit Message**: Adaptive RAG template fix (#8559)

GitOrigin-RevId: 72f200533d916852129967a51fd91eec1740954f

**File**: `examples/pipelines/adaptive-rag/app.yaml` (modified, +1/-2)
```diff
@@ -39,7 +39,7 @@ $embedder: !pw.xpacks.llm.embedders.OpenAIEmbedder
 $splitter: !pw.xpacks.llm.splitters.TokenCountSplitter
   max_tokens: 400
 
-$parser: !pw.xpacks.llm.parsers.UnstructuredParser
+$parser: !pw.xpacks.llm.parsers.DoclingParser
   cache_strategy: !pw.udfs.DefaultCache
 
 $retriever_factory: !pw.stdlib.indexing.BruteForceKnnFactory
@@ -59,7 +59,6 @@ question_answerer: !pw.xpacks.llm.question_answering.AdaptiveRAGQuestionAnswerer
   n_starting_documents: 2
   factor: 2
   max_iterations: 4
-  strict_prompt: true
 
 # Change host and port by uncommenting these lines
 # host: "0.0.0.0"
```

---

### Incident Patch 6: `197d2bca` (2025-03-27)
**Commit Message**: Fix vulnerabilities found by dependabot (#8488)

GitOrigin-RevId: 6715fcf9dc89a4a8a267a517b6bebd72f4a867e3

**File**: `pyproject.toml` (modified, +0/-24)
```diff
@@ -32,30 +32,6 @@ classifiers = [
 [tool.poetry.dependencies]
 python = ">=3.10,<3.13"
 pathway = "^0.12.0"
-openai = "^1.2.4"
-requests = "^2.31.0"
-diskcache = "^5.6.1"
-streamlit = "^1.26.0"
-sentence-transformers = { version = "^2.2.2", optional = true }
-torch = { version = "~2.2.1", optional = true }
-unstructured = { extras = ["all-docs"], version = "^0.11.8", optional = true }
-tiktoken = { version = "^0.6.0", optional = true }
-psycopg = { version = "^3.1.12", optional = true }
-litellm = "^1.18.0"
-transformers = { version = "^4.39.0", optional = true }
-
-
-[tool.poetry.extras]
-local = ["torch", "sentence-transformers", "transformers"]
-unstructured = ["unstructured", "tiktoken"]
-unstructured_to_sql = ["tiktoken", "psycopg", "unstructured"]
-
-[tool.poetry.group.examples]
-optional = true
-
-[tool.poetry.group.examples.dependencies]
-click = "^8.1.6"
-python-dotenv = "^1.0.0"
 
 [tool.poetry.group.linters]
 optional = true
```

---

### Incident Patch 7: `b8b5080f` (2025-03-19)
**Commit Message**: Fix Unstructured to sql template (#8431)

GitOrigin-RevId: 69e1876836b730624868fd9f80855fb3a828357a

**File**: `examples/pipelines/unstructured_to_sql_on_the_fly/app.py` (modified, +4/-4)
```diff
@@ -190,8 +190,8 @@ def structure_on_the_fly(
         model=model_locator,
         temperature=temperature,
         max_tokens=max_tokens,
-        retry_strategy=pw.asynchronous.ExponentialBackoffRetryStrategy(),
-        cache_strategy=pw.asynchronous.DefaultCache(),
+        retry_strategy=pw.udfs.ExponentialBackoffRetryStrategy(),
+        cache_strategy=pw.udfs.DefaultCache(),
     )
 
     responses = prompt.select(
@@ -233,8 +233,8 @@ def unstructured_query(
         model=model_locator,
         temperature=temperature,
         max_tokens=max_tokens,
-        retry_strategy=pw.asynchronous.ExponentialBackoffRetryStrategy(),
-        cache_strategy=pw.asynchronous.DefaultCache(),
+        retry_strategy=pw.udfs.ExponentialBackoffRetryStrategy(),
+        cache_strategy=pw.udfs.DefaultCache(),
     )
 
     query += query.select(
```

---

### Incident Patch 8: `0586df6f` (2025-03-03)
**Commit Message**: Documentation fixes (#8310)

Co-authored-by: Kamil Piechowiak <[REDACTED_EMAIL]>
GitOrigin-RevId: e4bd2fc86922b02149527530adca55a0cb8f950e

**File**: `examples/pipelines/demo-question-answering/README.md` (modified, +2/-2)
```diff
@@ -40,7 +40,7 @@ Note: This app relies on [Document Store](https://pathway.com/developers/api-doc
 
 ## Summary of available endpoints
 
-This example spawns a lightweight webserver using Pathway’s [`QASummaryRestServer`](https://pathway.com/developers/api-docs/pathway-xpacks-llm/servers#pathway.xpacks.llm.servers.QASummaryRestServer)) that accepts queries on five possible endpoints, divided into two categories: document indexing and RAG with LLM.
+This example spawns a lightweight webserver using Pathway’s [`QASummaryRestServer`](https://pathway.com/developers/api-docs/pathway-xpacks-llm/servers#pathway.xpacks.llm.servers.QASummaryRestServer) that accepts queries on five possible endpoints, divided into two categories: document indexing and RAG with LLM.
 
 ### Document Indexing capabilities
 - `/v1/retrieve` to perform similarity search;
@@ -164,7 +164,7 @@ The [`DocumentStore`](https://pathway.com/developers/api-docs/pathway-xpacks-llm
 
 Example: Hybrid Indexing with `BruteForceKNN` and `TantivyBM25`
 
-The following example demonstrates how to configure and use the [HybridIndex](/developers/api-docs/indexing#pathway.stdlib.indexing.HybridIndex)) that combines:
+The following example demonstrates how to configure and use the [HybridIndex](https://pathway.com/developers/api-docs/indexing#pathway.stdlib.indexing.HybridIndex) that combines:
 
 - **`BruteForceKNN`**: A vector-based index leveraging embeddings for semantic similarity search.
 - **[`TantivyBM25`](/developers/api-docs/indexing#pathway.stdlib.indexing.TantivyBM25)**: A text-based index using BM25 for keyword matching.
```

---

### Incident Patch 9: `590d853a` (2025-01-30)
**Commit Message**: Saksham/demoqa fixes (#7989)

GitOrigin-RevId: 6a54fe6d5bfc293c018dba3ccdc5cd2601f25786

**File**: `examples/pipelines/demo-question-answering/README.md` (modified, +62/-8)
```diff
@@ -11,7 +11,7 @@
 
 # Pathway RAG app with always up-to-date knowledge
 
-This demo shows how to create a RAG application using [Pathway](https://github.com/pathwaycom/pathway) that provides always up-to-date knowledge to your LLM without the need for a separate ETL. 
+This demo shows how to create a real-time RAG application using [Pathway](https://github.com/pathwaycom/pathway) that provides always up-to-date knowledge to your LLM without the need for a separate ETL. 
 
 You can have a preview of the demo [here](https://pathway.com/solutions/ai-pipelines).
 
@@ -20,7 +20,7 @@ This significantly reduces the developer's workload.
 
 This demo allows you to:
 
-- Create a vector store with real-time document indexing from Google Drive, Microsoft 365 SharePoint, or a local directory;
+- Create a Document store with real-time document indexing from Google Drive, Microsoft 365 SharePoint, or a local directory;
 - Connect an OpenAI LLM model of choice to your knowledge base;
 - Get quality, accurate, and precise responses to your questions;
 - Ask questions about folders, files or all your documents easily, with the help of filtering options;
@@ -40,7 +40,7 @@ Note: This app relies on [Document Store](https://pathway.com/developers/api-doc
 
 ## Summary of available endpoints
 
-This example spawns a lightweight webserver that accepts queries on six possible endpoints, divided into two categories: document indexing and RAG with LLM.
+This example spawns a lightweight webserver using Pathway’s [`QASummaryRestServer`](https://pathway.com/developers/api-docs/pathway-xpacks-llm/servers#pathway.xpacks.llm.servers.QASummaryRestServer)) that accepts queries on five possible endpoints, divided into two categories: document indexing and RAG with LLM.
 
 ### Document Indexing capabilities
 - `/v1/retrieve` to perform similarity search;
@@ -55,11 +55,25 @@ See the [using the app section](###Using-the-app) to learn how to use the provid
 
 ## How it works
 
-This pipeline uses several Pathway connectors to read the data from the local drive, Google Drive, and Microsoft SharePoint sources. It allows you to poll the changes with low latency and to do the modifications tracking. So, if something changes in the tracked files, the corresponding change is reflected in the internal collections. The contents are read into a single Pathway Table as binary objects. 
+1. **Data Ingestion**  
+We define one or more sources in `app.yaml` (local directories, Google Drive, Microsoft SharePoint, etc.).  
+- The provided demo references a local folder `data/` by default.  
+- The code can poll these sources at configured intervals, so when new documents appear or existing ones change, they are automatically parsed and re-indexed in real-time.
 
-After that, those binary objects are parsed with [unstructured](https://unstructured.io/) library and split into chunks. With the usage of OpenAI API, the pipeline embeds the obtained chunks.
+2. **Parsing & Splitting**  
+Using [Unstructured](https://unstructured.io/) (through Pathway’s [`ParseUnstructured`](https://pathway.com/developers/api-docs/pathway-xpacks-llm/parsers#pathway.xpacks.llm.parsers.ParseUnstructured)) and [TokenCountSplitter](https://pathway.com/developers/api-docs/pathway-xpacks-llm/splitters#pathway.xpacks.llm.splitters.TokenCountSplitter), documents are chunked into smaller parts.
 
-Finally, the embeddings are indexed with the capabilities of Pathway's machine-learning library. The user can then query the created index with simple HTTP requests to the endpoints mentioned above.
+3. **Embedding**  
+Via [`OpenAIEmbedder`](https://pathway.com/developers/api-docs/pathway-xpacks-llm/embedders#pathway.xpacks.llm.embedders.OpenAIEmbedder), the chunks get turned into embeddings. You can substitute your own embedder if you wish.
+
+4. **Indexing**  
+Using [`BruteForceKnnFactory`](https://pathway.com/developers/api-docs/pathway-stdlib/indexing#pathway.stdlib.indexing.BruteForceKnnFactory), the embeddings are stored in a vector index. This is all streaming as well, so new embeddings are added or updated automatically.
+
+5. **Serving**  
+- We create a [`SummaryQuestionAnswerer`](https://pathway.com/developers/api-docs/pathway-xpacks-llm/question_answering#pathway.xpacks.llm.question_answering.SummaryQuestionAnswerer) (as specified in `app.py`), which can handle both question-answering and summarization requests.  
+- A web server, [`QASummaryRestServer`](https://pathway.com/developers/api-docs/pathway-xpacks-llm/servers#pathway.xpacks.llm.servers.QASummaryRestServer), exposes multiple endpoints for retrieval, Q&A, summarization, and more.
+
+Because Pathway is fully incremental, any changes to your source files immediately flow through parsing, embedding, indexing, and ultimately get reflected in the answers from the LLM. The user can then query the created index with simple HTTP requests to the endpoints mentioned above.
 
 ## Pipeline Organization
 
@@ -81,7 +95,7 @@ You can also 
```

**File**: `examples/pipelines/demo-question-answering/requirements.txt` (modified, +1/-0)
```diff
@@ -1,2 +1,3 @@
+pathway[all]
 python-dotenv==1.0.1
 mpmath==1.3.0
```

**File**: `examples/pipelines/gpt_4o_multimodal_rag/README.md` (modified, +2/-1)
```diff
@@ -13,7 +13,7 @@
 
 ## **Overview**
 
-This app template showcases how you can build a multimodal RAG application and launch a document processing pipeline that utilizes `GPT-4o` for both parsing and generation tasks. Pathway processes unstructured financial documents within specified directories, extracting and storing the information in a scalable in-memory vector index. This index is optimized for dynamic RAG, ensuring that search results are continuously updated as documents are modified or new files are added.
+This app template showcases how you can build a multimodal RAG application and launch a document processing pipeline that utilizes a vision language model like the `GPT-4o` for parsing. Pathway processes unstructured financial documents within specified directories, extracting and storing the information in a scalable in-memory index. This index is optimized for dynamic RAG, ensuring that search results are continuously updated as documents are modified or new files are added.
 
 Using this approach, you can make your AI application run in permanent connection with your drive, in sync with your documents which include visually formatted elements: tables, charts, images, etc. 
 
@@ -155,6 +155,7 @@ By default, the app uses a local data source to read documents from the `data` f
 > Note: Recommended way of running the Pathway on Windows is Docker, refer to [Running with the Docker section](#with-docker).
 
 First, make sure to install the requirements by running:
+
 ```bash
 pip install -r requirements.txt -U
 ```
```

**File**: `examples/pipelines/gpt_4o_multimodal_rag/requirements.txt` (modified, +1/-0)
```diff
@@ -1,2 +1,3 @@
+pathway[all]
 python-dotenv==1.0.1
 mpmath==1.3.0
```

**File**: `examples/pipelines/private-rag/requirements.txt` (modified, +1/-0)
```diff
@@ -1,2 +1,3 @@
+pathway[all]
 python-dotenv==1.0.1
 mpmath==1.3.0
```

---

### Incident Patch 10: `8238697b` (2024-12-19)
**Commit Message**: fix slides app args (#7889)

GitOrigin-RevId: da1276e94a8b18f0ff36a0ab2daff71d8d1e05f6

**File**: `examples/pipelines/slides_ai_search/Dockerfile` (modified, +1/-1)
```diff
@@ -1,4 +1,4 @@
-ARG PATHWAY_SRC_IMAGE=pathwaycom/pathway:0.15.3
+ARG PATHWAY_SRC_IMAGE=pathwaycom/pathway:latest
 
 FROM ${PATHWAY_SRC_IMAGE}
 
```

**File**: `examples/pipelines/slides_ai_search/app.py` (modified, +2/-3)
```diff
@@ -12,7 +12,7 @@
 import pathway as pw
 from dotenv import load_dotenv
 from pathway.xpacks import llm
-from pathway_slides_ai_search import CustomDeckRetriever, add_slide_id, get_model
+from pathway_slides_ai_search import DeckRetrieverWithFileSave, add_slide_id, get_model
 from pydantic import BaseModel, ConfigDict, FilePath, InstanceOf
 
 
@@ -53,8 +53,7 @@ def run(self) -> None:
             doc_post_processors=[add_slide_id],
         )
 
-        app = CustomDeckRetriever(
-            llm=self.llm,
+        app = DeckRetrieverWithFileSave(
             indexer=doc_store,
             search_topk=self.search_topk,
         )
```

**File**: `examples/pipelines/slides_ai_search/pathway_slides_ai_search/__init__.py` (modified, +1/-1)
```diff
@@ -88,7 +88,7 @@ def add_slide_id(text: str, metadata: dict) -> tuple[str, dict]:
     return (text, metadata)
 
 
-class CustomDeckRetriever(DeckRetriever):
+class DeckRetrieverWithFileSave(DeckRetriever):
     def dump_img_callback(self, key, row, time, is_addition):
         # save images parsed by the Pathway
         metadata = row["data"]
```

---

### Incident Patch 11: `ab8d3ce3` (2024-12-06)
**Commit Message**: fix gdrive name_pattern arg in llm yaml templates (#7828)

GitOrigin-RevId: 902e65c3faed0e7cd242466fe66df8ca1d5386c8

**File**: `examples/pipelines/adaptive-rag/app.yaml` (modified, +1/-1)
```diff
@@ -17,7 +17,7 @@ $sources:
   # - !pw.io.gdrive.read
   #   object_id: $DRIVE_ID
   #   service_user_credentials_file: gdrive_indexer.json
-  #   name_pattern:
+  #   file_name_pattern:
   #     - "*.pdf"
   #     - "*.pptx"
   #   object_size_limit: null
```

**File**: `examples/pipelines/demo-document-indexing/app.yaml` (modified, +1/-1)
```diff
@@ -17,7 +17,7 @@ $sources:
   # - !pw.io.gdrive.read
   #   object_id: $DRIVE_ID
   #   service_user_credentials_file: gdrive_indexer.json
-  #   name_pattern:
+  #   file_name_pattern:
   #     - "*.pdf"
   #     - "*.pptx"
   #   object_size_limit: null
```

**File**: `examples/pipelines/demo-question-answering/app.yaml` (modified, +1/-1)
```diff
@@ -17,7 +17,7 @@ $sources:
   # - !pw.io.gdrive.read
   #   object_id: $DRIVE_ID
   #   service_user_credentials_file: gdrive_indexer.json
-  #   name_pattern:
+  #   file_name_pattern:
   #     - "*.pdf"
   #     - "*.pptx"
   #   object_size_limit: null
```

**File**: `examples/pipelines/gpt_4o_multimodal_rag/app.yaml` (modified, +1/-1)
```diff
@@ -17,7 +17,7 @@ $sources:
   # - !pw.io.gdrive.read
   #   object_id: $DRIVE_ID
   #   service_user_credentials_file: gdrive_indexer.json
-  #   name_pattern:
+  #   file_name_pattern:
   #     - "*.pdf"
   #     - "*.pptx"
   #   object_size_limit: null
```

**File**: `examples/pipelines/private-rag/app.yaml` (modified, +1/-1)
```diff
@@ -17,7 +17,7 @@ $sources:
   # - !pw.io.gdrive.read
   #   object_id: $DRIVE_ID
   #   service_user_credentials_file: gdrive_indexer.json
-  #   name_pattern:
+  #   file_name_pattern:
   #     - "*.pdf"
   #     - "*.pptx"
   #   object_size_limit: null
```

**File**: `examples/pipelines/slides_ai_search/app.yaml` (modified, +1/-1)
```diff
@@ -17,7 +17,7 @@ sources:
   # - !pw.io.gdrive.read
   #   object_id: $DRIVE_ID
   #   service_user_credentials_file: gdrive_indexer.json
-  #   name_pattern:
+  #   file_name_pattern:
   #     - "*.pdf"
   #     - "*.pptx"
   #   object_size_limit: null
```

---

### Incident Patch 12: `9e65323e` (2024-11-26)
**Commit Message**: Fix alert link (#7757)

GitOrigin-RevId: 4d731193660df46a1ef5c36895392eef0b50d388

**File**: `README.md` (modified, +1/-1)
```diff
@@ -54,7 +54,7 @@ Automated real-time knowledge mining and alerting:
 
 ![Automated real-time knowledge mining and alerting](examples/pipelines/drive_alert/drive_alert_demo.gif)
 
-(Check out the [`Alerting when answers change on Google Drive`](#examples) app example.)
+(Check out the [`Alerting when answers change on Google Drive`](https://github.com/pathwaycom/llm-app/tree/main/examples/pipelines/drive_alert) app example.)
 
 
 ###  Do-it-Yourself Videos
```

---

### Incident Patch 13: `1efa1472` (2024-11-21)
**Commit Message**: Bump streamlit from 1.35.0 to 1.37.0 in /public/llm-app/examples/pipelines/demo-question-answering/ui (#7717)

GitOrigin-RevId: 0644f53ce4b68ab5ff118fd1ac230e0dcf85cca2

**File**: `examples/pipelines/demo-question-answering/ui/requirements.txt` (modified, +1/-1)
```diff
@@ -1,4 +1,4 @@
-streamlit==1.35.0
+streamlit==1.37.0
 load_dotenv==0.1.0
 nest_asyncio==1.6.0
 aiohttp==3.9.5
```

---

### Incident Patch 14: `60adb513` (2024-11-21)
**Commit Message**: Adding ui for demo-question-answering (#7713)

Co-authored-by: berkecanrizai <[REDACTED_EMAIL]>
GitOrigin-RevId: 57a508d9a63ffd15564e6a5fead3d3a2ff12731d

**File**: `examples/pipelines/demo-question-answering/Dockerfile` (modified, +0/-2)
```diff
@@ -11,6 +11,4 @@ RUN pip install -U --no-cache-dir -r requirements.txt
 
 COPY . .
 
-EXPOSE 8000
-
 CMD ["python", "app.py"]
```

**File**: `examples/pipelines/demo-question-answering/README.md` (modified, +15/-11)
```diff
@@ -68,6 +68,7 @@ This folder contains several objects:
 - `Dockerfile`, the Docker configuration for running the pipeline in the container;
 - `.env`, a short environment variables configuration file where the OpenAI key must be stored;
 - `data/`, a folder with exemplary files that can be used for the test runs.
+- `ui/`, a simple ui written in Streamlit for asking questions.
 
 ## Pathway tooling
 - Prompts and helpers
@@ -206,20 +207,20 @@ Please note that the local run requires the dependencies to be installed. It can
 
 ### With Docker
 
-In order to let the pipeline get updated with each change in local files, you need to mount the folder onto the docker. The following commands show how to do that.
+Build the Docker with:
 
-You can omit the ```-v `pwd`/data:/app/data``` part if you are not using local files as a source. 
 ```bash
-# Make sure you are in the right directory.
-cd examples/pipelines/demo-question-answering
+docker compose build
+```
 
-# Build the image in this folder
-docker build -t qa .
+And, run with:
 
-# Run the image, mount the `data` folder into image and expose the port `8000`
-docker run -v `pwd`/data:/app/data -p 8000:8000 qa
+```bash
+docker compose up
 ```
 
+This will start the pipeline and the ui for asking questions.
+
 ### Query the documents
 You will see the logs for parsing & embedding documents in the Docker image logs. 
 Give it a few minutes to finish up on embeddings, you will see `0 entries (x minibatch(es)) have been...` message.
@@ -265,12 +266,12 @@ Search API gives you the ability to search in available inputs and get up-to-dat
 
 ```bash
 curl -X 'POST' \
-  'http://0.0.0.0:8000/v1/retrieve' \
+  'http://0.0.0.0:8006/v1/retrieve' \
   -H 'accept: */*' \
   -H 'Content-Type: application/json' \
   -d '{
-  "query": "What is the start date of the contract?",
-  "k": 2
+  "query": "Which articles of General Data Protection Regulation are relevant for clinical trials?",
+  "k": 6
 }'
 ```
 
@@ -341,3 +342,6 @@ To execute similar curl queries as above, you can visit [ai-pipelines page](http
 First, you can try adding your files and seeing changes in the index. To test index updates, simply add more files to the `data` folder.
 
 If you are using Google Drive or other sources, simply upload your files there.
+
+### Using the UI
+This pipeline includes a simple ui written in Streamlit. After you run the pipeline with `docker compose up`, you can access the UI at `http://localhost:8501`. This UI uses the `/v1/pw_ai_answer` endpoint to answer your questions.
```

**File**: `examples/pipelines/demo-question-answering/docker-compose.yml` (added, +27/-0)
```diff
@@ -0,0 +1,27 @@
+services:
+  app:
+    build:
+      context: .
+    ports:
+      - "${PATHWAY_PORT:-8000}:${PATHWAY_PORT:-8000}"
+    networks:
+      - network
+    volumes:
+      - ./data:/app/data
+      - ./Cache:/app/Cache
+
+  ui:
+    build:
+      context: ui
+    networks:
+      - network
+    environment:
+      PATHWAY_HOST: "app"
+      PATHWAY_PORT: "${PATHWAY_PORT:-8000}"
+      UI_PORT: 8501
+    ports:
+      - "8501:8501"
+
+networks:
+  network:
+    driver: bridge
```

**File**: `examples/pipelines/demo-question-answering/ui/Dockerfile` (added, +14/-0)
```diff
@@ -0,0 +1,14 @@
+ARG PATHWAY_SRC_IMAGE=pathwaycom/pathway:latest
+
+FROM ${PATHWAY_SRC_IMAGE}
+
+ENV PYTHONUNBUFFERED=1
+
+WORKDIR /ui
+
+COPY requirements.txt .
+RUN pip install -U --no-cache-dir -r requirements.txt
+
+COPY . .
+
+CMD exec streamlit run ui.py --server.port ${UI_PORT}
```

**File**: `examples/pipelines/demo-question-answering/ui/requirements.txt` (added, +6/-0)
```diff
@@ -0,0 +1,6 @@
+streamlit==1.35.0
+load_dotenv==0.1.0
+nest_asyncio==1.6.0
+aiohttp==3.9.5
+beautifulsoup4==4.12.3
+openai==1.35.10
```

**File**: `examples/pipelines/demo-question-answering/ui/ui.py` (added, +180/-0)
```diff
@@ -0,0 +1,180 @@
+# Copyright © 2024 Pathway
+
+import logging
+import os
+
+import requests
+import streamlit as st
+from dotenv import load_dotenv
+from pathway.xpacks.llm.question_answering import RAGClient
+
+load_dotenv()
+
+PATHWAY_HOST = os.environ.get("PATHWAY_HOST", "app")
+PATHWAY_PORT = os.environ.get("PATHWAY_PORT", 8000)
+
+st.set_page_config(page_title="Pathway RAG App", page_icon="favicon.ico")
+
+logging.basicConfig(
+    level=logging.INFO,
+    format="%(asctime)s %(name)s %(levelname)s %(message)s",
+    datefmt="%Y-%m-%d %H:%M:%S",
+    force=True,
+)
+
+logger = logging.getLogger("streamlit")
+logger.setLevel(logging.INFO)
+
+conn = RAGClient(url=f"http://{PATHWAY_HOST}:{PATHWAY_PORT}")
+
+note = """
+<H4><b>Ask a question"""
+st.markdown(note, unsafe_allow_html=True)
+
+st.markdown(
+    """
+<style>
+div[data-baseweb="base-input"]{
+}
+input[class]{
+font-size:150%;
+color: black;}
+button[data-testid="baseButton-primary"], button[data-testid="baseButton-secondary"]{
+    border: none;
+    display: flex;
+    background-color: #E7E7E7;
+    color: #454545;
+    transition: color 0.3s;
+}
+button[data-testid="baseButton-primary"]:hover{
+    color: #1C1CF0;
+    background-color: rgba(28,28,240,0.3);
+}
+button[data-testid="baseButton-secondary"]:hover{
+    color: #DC280B;
+    background-color: rgba(220,40,11,0.3);
+}
+div[data-testid="stHorizontalBlock"]:has(button[data-testid="baseButton-primary"]){
+    display: flex;
+    flex-direction: column;
+    z-index: 0;
+    width: 3rem;
+
+    transform: translateY(-500px) translateX(672px);
+}
+</style>
+""",
+    unsafe_allow_html=True,
+)
+
+
+question = st.text_input(label="", placeholder="Ask your question?")
+
+
+def get_options_list(metadata_list: list[dict], opt_key: str) -> list:
+    """Get all available options in a specific metadata key."""
+    options = set(map(lambda x: x[opt_key], metadata_list))
+    return list(options)
+
+
+logger.info("Requesting pw_list_documents...")
+document_meta_list = conn.pw_list_documents(keys=[])
+logger.info("Received response pw_list_documents")
+
+st.session_state["document_meta_list"] = document_meta_list
+
+available_files = get_options_list(st.session_state["document_meta_list"], "path")
+
+
+with st.sidebar:
+    st.info(
+        body="See the source code [here](https://github.com/pathwaycom/llm-app/tree/main/examples/pipelines/demo-question-answering).",  # noqa: E501
+        icon=":material/code:",
+    )
+
+    file_names = [i.split("/")[-1] for i in available_files]
+
+    markdown_table = "| Indexed files |\n| --- |\n"
+    for file_name in file_names:
+        markdown_table += f"| {file_name} |\n"
+    st.markdown(markdown_table, unsafe_allow_html=True)
+
+    st.button("⟳ Refresh", use_container_width=True)
+
+css = """
+<style>
+.slider-container {
+    margin-top: 20px; /* Add some space between the main image and the slider */
+}
+
+.slider-item {
+    float: left;
+    margin: 10px;
+    width: 120px; /* Adjust the width to your liking */
+    // height: 50px; /* Adjust the height to your liking */
+    border: 1px solid #ccc;
+    border-radius: 5px;
+    cursor: pointer;
+}
+
+.slider-item img {
+    width: 100%;
+    height: 100%;
+    object-fit: cover;
+    border-radius: 5px;
+}
+
+.slider-wrapper {
+    display: flex;
+    justify-content: center;
+    flex-wrap: wrap;
+}
+
+.slider-item {
+    margin: 10px;
+}
+
+</style>"""
+
+
+st.markdown(css, unsafe_allow_html=True)
+
+
+def send_post_request(
+    url: str, data: dict, headers: dict = {}, timeout: int | None = None
+):
+    response = requests.post(url, json=data, headers=headers, timeout=timeout)
+    response.raise_for_status()
+    return response.json()
+
+
+if question:
+    logger.info(
+        {
+            "_type": "search_request_event",
+            "query": question,
+        }
+    )
+
+    api_url = f"http://{PATHWAY_HOST}:{PATHWAY_PORT}/v1/pw_ai_answer"
+    payload = {
+        "prompt": question,
+        "response_type": "long",
+    }
+    with st.spinner("Retrieving response..."):
+        response = send_post_request(api_url, payload)
+
+    # response = conn.pw_ai_answer(question)
+
+    logger.info(
+        {
+            "_type": "search_response_event",
+            "query": question,
+            "response": type(response),
+        }
+    )
+
+    logger.info(type(response))
+
+    st.markdown(f"**Answering question:** {question}")
+    st.markdown(f"""{response}""")
```

---

### Incident Patch 15: `cdd6fc61` (2024-11-05)
**Commit Message**: Fix cannot pickle error  (#7598)

GitOrigin-RevId: 811d7277db2729321f7135140142303668de912e

**File**: `examples/pipelines/adaptive-rag/app.py` (modified, +0/-4)
```diff
@@ -26,16 +26,12 @@ class App(BaseModel):
     port: int = 8000
 
     with_cache: bool = True
-    cache_backend: InstanceOf[pw.persistence.Backend] = (
-        pw.persistence.Backend.filesystem("./Cache")
-    )
     terminate_on_error: bool = False
 
     def run(self) -> None:
         server = QASummaryRestServer(self.host, self.port, self.question_answerer)
         server.run(
             with_cache=self.with_cache,
-            cache_backend=self.cache_backend,
             terminate_on_error=self.terminate_on_error,
         )
 
```

**File**: `examples/pipelines/adaptive-rag/app.yaml` (modified, +0/-2)
```diff
@@ -69,8 +69,6 @@ question_answerer: !pw.xpacks.llm.question_answering.AdaptiveRAGQuestionAnswerer
 
 # Cache configuration
 # with_cache: true
-# cache_backend: !pw.persistence.Backend.filesystem
-#  path: ".Cache"
 
 # Set `terminate_on_error` to true if you want the program to terminate whenever any error is encountered
 # terminate_on_error: false
```

**File**: `examples/pipelines/demo-document-indexing/app.py` (modified, +0/-4)
```diff
@@ -26,16 +26,12 @@ class App(BaseModel):
     port: int = 8000
 
     with_cache: bool = True
-    cache_backend: InstanceOf[pw.persistence.Backend] = (
-        pw.persistence.Backend.filesystem("./Cache")
-    )
     terminate_on_error: bool = False
 
     def run(self) -> None:
         server = DocumentStoreServer(self.host, self.port, self.document_store)
         server.run(
             with_cache=self.with_cache,
-            cache_backend=self.cache_backend,
             terminate_on_error=self.terminate_on_error,
         )
 
```

**File**: `examples/pipelines/demo-document-indexing/app.yaml` (modified, +0/-2)
```diff
@@ -56,8 +56,6 @@ document_store: !pw.xpacks.llm.document_store.DocumentStore
 
 # Cache configuration
 # with_cache: true
-# cache_backend: !pw.persistence.Backend.filesystem
-#  path: ".Cache"
 
 # Set `terminate_on_error` to true if you want the program to terminate whenever any error is encountered
 # terminate_on_error: false
```

**File**: `examples/pipelines/demo-question-answering/.env` (removed, +0/-1)
```diff
@@ -1 +0,0 @@
-OPENAI_API_KEY=sk-***
```

**File**: `examples/pipelines/demo-question-answering/app.py` (modified, +0/-4)
```diff
@@ -26,16 +26,12 @@ class App(BaseModel):
     port: int = 8000
 
     with_cache: bool = True
-    cache_backend: InstanceOf[pw.persistence.Backend] = (
-        pw.persistence.Backend.filesystem("./Cache")
-    )
     terminate_on_error: bool = False
 
     def run(self) -> None:
         server = QASummaryRestServer(self.host, self.port, self.question_answerer)
         server.run(
             with_cache=self.with_cache,
-            cache_backend=self.cache_backend,
             terminate_on_error=self.terminate_on_error,
         )
 
```

**File**: `examples/pipelines/demo-question-answering/app.yaml` (modified, +0/-2)
```diff
@@ -65,8 +65,6 @@ question_answerer: !pw.xpacks.llm.question_answering.BaseRAGQuestionAnswerer
 
 # Cache configuration
 # with_cache: true
-# cache_backend: !pw.persistence.Backend.filesystem
-#  path: ".Cache"
 
 # Set `terminate_on_error` to true if you want the program to terminate whenever any error is encountered
 # terminate_on_error: false
```

**File**: `examples/pipelines/gpt_4o_multimodal_rag/app.py` (modified, +0/-4)
```diff
@@ -36,16 +36,12 @@ class App(BaseModel):
     port: int = 8000
 
     with_cache: bool = True
-    cache_backend: InstanceOf[pw.persistence.Backend] = (
-        pw.persistence.Backend.filesystem("./Cache")
-    )
     terminate_on_error: bool = False
 
     def run(self) -> None:
         server = QASummaryRestServer(self.host, self.port, self.question_answerer)
         server.run(
             with_cache=self.with_cache,
-            cache_backend=self.cache_backend,
             terminate_on_error=self.terminate_on_error,
         )
 
```

#### Recent Merged Pull Requests:
- **PR #131** (closed): Add MiniMax M3 and M2.7 provider config to RAG templates (@octo-patch)
- **PR #129** (2026-06-29): Add TwelveLabs video RAG template (Pegasus parser + Marengo embedder) (@mohit-twelvelabs)
- **PR #127** (closed): feat: add MiniMax provider (M3 default) to RAG templates (@octo-patch)
- **PR #121** (closed): Create Hyperswitch (@GOWTHAM-VITAP)
- **PR #120** (closed): Fix: Resolve 'Table has no column with name doc' error with modern DocumentStore patterns (@adityashirsatrao007)
- **PR #118** (closed): Updated README.md (@mithra009)
- **PR #86** (2024-12-23): Update settings.json (@CodewithDusty)
- **PR #84** (2024-12-23): docs: update README.md (@eltociear)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
