# Forensic Learning Record (Deep Inspection): getzep/graphiti

> **Canonical Artifact**: `07_PROJECT_LEARNING/getzep-graphiti-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/getzep/graphiti](https://github.com/getzep/graphiti))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-09-30T18:43:59.291Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `getzep/graphiti`
- **Description**: Build Real-Time Knowledge Graphs for AI Agents
- **Primary Language / Ecosystem**: Python
- **Discovered Manifests / Configurations**: pyproject.toml, README.md, Dockerfile
- **Stars / Engagement**: 31326 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: pyproject.toml, README.md, Dockerfile.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `examples/azure-openai/azure_openai_neo4j.py`
```
"""
Copyright 2025, Zep Software, Inc.

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
"""

import asyncio
import json
import logging
import os
from datetime import datetime, timezone
from logging import INFO

from dotenv import load_dotenv
from openai import AsyncOpenAI

from graphiti_core import Graphiti
from graphiti_core.embedder.azure_openai import AzureOpenAIEmbedderClient
from graphiti_core.llm_client.azure_openai_client import AzureOpenAILLMClient
from graphiti_core.llm_client.config import LLMConfig
from graphiti_core.nodes import EpisodeType

#################################################
# CONFIGURATION
#################################################
# Set up logging and environment variables for
# connecting to Neo4j database and Azure OpenAI
#################################################

# Configure logging
logging.basicConfig(
    level=INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    datefmt='%Y-%m-%d %H:%M:%S',
)
logger = logging.getLogger(__name__)

load_dotenv()

# Neo4j connection parameters
# Make sure Neo4j Desktop is running with a local DBMS started
neo4j_uri = os.environ.get('NEO4J_URI', 'bolt://localhost:7687')
neo4j_user = os.environ.get('NEO4J_USER', 'neo4j')
neo4j_password = os.environ.get('NEO4J_PASSWORD', 'password')

# Azure OpenAI connection parameters
azure_endpoint = os.environ.get('AZURE_OPENAI_ENDPOINT')
azure_api_key = os.environ.get('AZURE_OPENAI_API_KEY')
azure_deployment = os.environ.get('AZURE_OPENAI_DEPLOYMENT', 'gpt-4.1')
azure_embedding_deployment = os.environ.get(
    'AZURE_OPENAI_EMBEDDING_DEPLOYMENT', 'text-embedding-3-small'
)

if not azure_endpoint or not azure_api_key:
    raise ValueError('AZURE_OPENAI_ENDPOINT and AZURE_OPENAI_API_KEY must be set')


async def main():
    #################################################
    # INITIALIZATION
    #################################################
    # Connect to Neo4j and Azure OpenAI, then set up
    # Graphiti indices. This is required before using
    # other Graphiti functionality
    #################################################

    # Initialize Azure OpenAI client
    azure_client = AsyncOpenAI(
        base_url=f'{azure_endpoint}/openai/v1/',
        api_key=azure_api_key,
    )

    # Create LLM and Embedder clients
    llm_client = AzureOpenAILLMClient(
        azure_client=azure_client,
        config=LLMConfig(model=azure_deployment, small_model=azure_deployment),
    )
    embedder_client = AzureOpenAIEmbedderClient(
        azure_client=azure_client, model=azure_embedding_deployment
    )

    # Initialize Graphiti with Neo4j connection and Azure OpenAI clients
    graphiti = Graphiti(
        neo4j_uri,
        neo4j_user,
        neo4j_password,
        llm_client=llm_client,
        embedder=embedder_client,
    )

    try:
        #################################################
        # ADDING EPISODES
        #################################################
        # Episodes are the primary units of information
        # in Graphiti. They can be text or structured JSON
        # and are automatically processed to extract entities
        # and relationships.
        #################################################

        # Example: Add Episodes
        # Episodes list containing both text and JSON episodes
        episodes = [
            {
                'content': 'Kamala Harris is the Attorney General of California. She was previously '
                'the district attorney for San Francisco.',
                'type': EpisodeType.text,
                'description': 'podcast transcript',
            },
            {
                'content': 'As AG, Harris was in office from January 3, 2011 – January 3, 2017',
                'type': EpisodeType.text,
                'description': 'podcast transcript',
            },
            {
                'content': {
                    'name': 'Gavin Newsom',
                    'position': 'Governor',
                    'state': 'California',
                    'previous_role': 'Lieutenant Governor',
                    'previous_location': 'San Francisco',
                },
                'type': EpisodeType.json,
                'description': 'podcast metadata',
            },
        ]

        # Add episodes to the graph
        for i, episode in enumerate(episodes):
            await graphiti.add_episode(
                name=f'California Politics {i}',
                episode_body=(
                    episode['content']
                    if isinstance(episode['content'], str)
                    else json.dumps(episode['content'])
                ),
                source=episode['type'],
                source_description=episode['description'],
                reference_time=datetime.now(timezone.utc),
            )
            print(f'Added episode: California Politics {i} ({episode["type"].value})')

        #################################################
        # BASIC SEARCH
        #################################################
        # The simplest way to retrieve relationships (edges)
        # from Graphiti is using the search method, which
        # performs a hybrid search combining semantic
        # similarity and BM25 text retrieval.
        #################################################

        # Perform a hybrid search combining semantic similarity and BM25 retrieval
        print("\nSearching for: 'Who was the California Attorney General?'")
        results = await graphiti.search('Who was the California Attorney General?')

        # Print search results
        print('\nSearch Results:')
        for result in results:
            print(f'UUID: {result.uuid}')
            print(f'Fact: {result.fact}')
            if hasattr(result, 'valid_at') and result.valid_at:
                print(f'Valid from: {result.valid_at}')
            if hasattr(result, 'invalid_at') and result.invalid_at:
                print(f'Valid until: {result.invalid_at}')
            print('---')

        #################################################
        # CENTER NODE SEARCH
        #################################################
        # For more contextually relevant results, you can
        # use a center node to rerank search results based
        # on their graph distance to a specific node
        #################################################

        # Use the top search result's UUID as the center node for reranking
        if results and len(results) > 0:
            # Get the source node UUID from the top result
            center_node_uuid = results[0].source_node_uuid

            print('\nReranking search results based on graph distance:')
            print(f'Using center node UUID: {center_node_uuid}')

            reranked_results = await graphiti.search(
                'Who was the California Attorney General?',
                center_node_uuid=center_node_uuid,
            )

            # Print reranked search results
            print('\nReranked Search Results:')
            for result in reranked_results:
                print(f'UUID: {result.uuid}')
                print(f'Fact: {result.fact}')
                if hasattr(result, 'valid_at') and result.valid_at:
                    print(f'Valid from: {result.valid_at}')
                if hasattr(result, 'invalid_at') and result.invalid_at:
                    print(f'Valid until: {result.invalid_at}')
                print('---')
        else:
            pri
```

### Core Architecture Module: `examples/ecommerce/runner.py`
```
"""
Copyright 2024, Zep Software, Inc.

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
"""

import asyncio
import json
import logging
import os
import sys
from datetime import datetime, timezone
from pathlib import Path

from dotenv import load_dotenv

from graphiti_core import Graphiti
from graphiti_core.nodes import EpisodeType
from graphiti_core.utils.bulk_utils import RawEpisode
from graphiti_core.utils.maintenance.graph_data_operations import clear_data

load_dotenv()

neo4j_uri = os.environ.get('NEO4J_URI', 'bolt://localhost:7687')
neo4j_user = os.environ.get('NEO4J_USER', 'neo4j')
neo4j_password = os.environ.get('NEO4J_PASSWORD', 'password')


def setup_logging():
    # Create a logger
    logger = logging.getLogger()
    logger.setLevel(logging.INFO)  # Set the logging level to INFO

    # Create console handler and set level to INFO
    console_handler = logging.StreamHandler(sys.stdout)
    console_handler.setLevel(logging.INFO)

    # Create formatter
    formatter = logging.Formatter('%(name)s - %(levelname)s - %(message)s')

    # Add formatter to console handler
    console_handler.setFormatter(formatter)

    # Add console handler to logger
    logger.addHandler(console_handler)

    return logger


shoe_conversation = [
    "SalesBot: Hi, I'm Allbirds Assistant! How can I help you today?",
    "John: Hi, I'm looking for a new pair of shoes.",
    'SalesBot: Of course! What kind of material are you looking for?',
    "John: I'm looking for shoes made out of wool",
    """SalesBot: We have just what you are looking for, how do you like our Men's SuperLight Wool Runners 
    - Dark Grey (Medium Grey Sole)? They use the SuperLight Foam technology.""",
    """John: Oh, actually I bought those 2 months ago, but unfortunately found out that I was allergic to wool. 
    I think I will pass on those, maybe there is something with a retro look that you could suggest?""",
    """SalesBot: Im sorry to hear that! Would you be interested in Men's Couriers - 
    (Blizzard Sole) model? We have them in Natural Black and Basin Blue colors""",
    'John: Oh that is perfect, I LOVE the Natural Black color!. I will take those.',
]


async def add_messages(client: Graphiti):
    for i, message in enumerate(shoe_conversation):
        await client.add_episode(
            name=f'Message {i}',
            episode_body=message,
            source=EpisodeType.message,
            reference_time=datetime.now(timezone.utc),
            source_description='Shoe conversation',
        )


async def main():
    setup_logging()
    client = Graphiti(neo4j_uri, neo4j_user, neo4j_password)
    await clear_data(client.driver)
    await client.build_indices_and_constraints()
    await ingest_products_data(client)
    await add_messages(client)


async def ingest_products_data(client: Graphiti):
    script_dir = Path(__file__).parent
    json_file_path = script_dir / '../data/manybirds_products.json'

    with open(json_file_path) as file:
        products = json.load(file)['products']

    episodes: list[RawEpisode] = [
        RawEpisode(
            name=f'Product {i}',
            content=str(product),
            source_description='Allbirds products',
            source=EpisodeType.json,
            reference_time=datetime.now(timezone.utc),
        )
        for i, product in enumerate(products)
    ]

    for episode in episodes:
        await client.add_episode(
            episode.name,
            episode.content,
            episode.source_description,
            episode.reference_time,
            episode.source,
        )


asyncio.run(main())

```

### Core Architecture Module: `examples/gliner2/gliner2_neo4j.py`
```
"""
Copyright 2025, Zep Software, Inc.

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
"""

import asyncio
import json
import logging
import os
from datetime import datetime, timezone
from logging import INFO

from dotenv import load_dotenv
from pydantic import BaseModel, Field

from graphiti_core import Graphiti
from graphiti_core.embedder.gemini import GeminiEmbedder, GeminiEmbedderConfig
from graphiti_core.llm_client.config import LLMConfig
from graphiti_core.llm_client.gemini_client import GeminiClient
from graphiti_core.llm_client.gliner2_client import GLiNER2Client
from graphiti_core.nodes import EpisodeType

#################################################
# CUSTOM ENTITY TYPES
#################################################
# Define Pydantic models for entity classification.
# GLiNER2 uses the class docstrings as label
# descriptions for improved extraction accuracy.
# The LLM client uses these for edge extraction
# and summarization.
#################################################


class Person(BaseModel):
    """A human person, real or fictional."""

    occupation: str | None = Field(None, description='Professional role or job title')
    political_party: str | None = Field(None, description='Political party affiliation')


class Organization(BaseModel):
    """An organization such as a company, government agency, university, or political party."""

    org_type: str | None = Field(
        None, description='Type of organization (e.g., bank, university, government agency)'
    )


class Location(BaseModel):
    """A geographic location such as a city, state, or country."""

    location_type: str | None = Field(
        None, description='Type of location (e.g., city, state, county)'
    )


class Initiative(BaseModel):
    """A program, policy, initiative, or legal action."""

    description: str | None = Field(None, description='Brief description of the initiative')


entity_types: dict[str, type[BaseModel]] = {
    'Person': Person,
    'Organization': Organization,
    'Location': Location,
    'Initiative': Initiative,
}

#################################################
# CONFIGURATION
#################################################
# GLiNER2 is a lightweight extraction model
# (205M-340M params) that runs locally on CPU.
# It handles entity extraction (NER), while an
# OpenAI client handles edge/fact extraction,
# deduplication, summarization, and reasoning.
#################################################

# Configure logging
logging.basicConfig(
    level=INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    datefmt='%Y-%m-%d %H:%M:%S',
)
logger = logging.getLogger(__name__)

load_dotenv()

# Neo4j connection parameters
neo4j_uri = os.environ.get('NEO4J_URI')
neo4j_user = os.environ.get('NEO4J_USER')
neo4j_password = os.environ.get('NEO4J_PASSWORD')

if not neo4j_uri or not neo4j_user or not neo4j_password:
    raise ValueError('NEO4J_URI, NEO4J_USER, and NEO4J_PASSWORD must be set')

# GLiNER2 model configuration
gliner2_model = os.environ.get('GLINER2_MODEL', 'fastino/gliner2-large-v1')


async def main():
    #################################################
    # INITIALIZATION
    #################################################
    # Set up a hybrid LLM client: GLiNER2 handles
    # entity extraction locally using custom entity
    # types as labels, while OpenAI handles edge/fact
    # extraction, deduplication, and summarization.
    #################################################

    # Create the Gemini client for reasoning tasks
    gemini_client = GeminiClient(
        config=LLMConfig(
            api_key=os.environ.get('GOOGLE_API_KEY'),
            model='gemini-2.5-flash-lite',
            small_model='gemini-2.5-flash-lite',
        ),
    )

    # Create the GLiNER2 hybrid client
    gliner2_client = GLiNER2Client(
        config=LLMConfig(model=gliner2_model),
        llm_client=gemini_client,
        threshold=0.7,
    )

    # Create the Gemini embedder
    gemini_embedder = GeminiEmbedder(
        config=GeminiEmbedderConfig(
            api_key=os.environ.get('GOOGLE_API_KEY'),
            embedding_model='gemini-embedding-001',
        ),
    )

    # Initialize Graphiti with the GLiNER2 hybrid client and Gemini embedder
    graphiti = Graphiti(
        neo4j_uri,
        neo4j_user,
        neo4j_password,
        llm_client=gliner2_client,
        embedder=gemini_embedder,
    )

    try:
        #################################################
        # ADDING EPISODES
        #################################################
        # Entity extraction from these episodes will be
        # handled by GLiNER2 locally using the custom
        # entity types as labels. Edge/fact extraction,
        # deduplication, and summarization are delegated
        # to OpenAI.
        #################################################

        episodes = [
            # English: detailed political biography
            {
                'content': (
                    'Kamala Harris is the Attorney General of California. She was previously '
                    'the district attorney for San Francisco. Harris graduated from Howard '
                    'University in 1986 and earned her law degree from the University of '
                    'California, Hastings College of the Law in 1989. Before entering politics, '
                    'she worked as a deputy district attorney in Alameda County under District '
                    'Attorney John Orlovsky. In 2003, she defeated incumbent Terence Hallinan '
                    'to become San Francisco District Attorney, making her the first woman and '
                    'first African American to hold the position.'
                ),
                'type': EpisodeType.text,
                'description': 'podcast transcript',
            },
            {
                'content': (
                    'As AG, Harris was in office from January 3, 2011 to January 3, 2017. '
                    'During her tenure she launched the OpenJustice initiative, a data platform '
                    'for criminal justice statistics across California. She also led a $25 billion '
                    'national mortgage settlement against Bank of America, JPMorgan Chase, Wells '
                    'Fargo, Citigroup, and Ally Financial on behalf of homeowners affected by '
                    'the foreclosure crisis.'
                ),
                'type': EpisodeType.text,
                'description': 'podcast transcript',
            },
            # Spanish: same entities (Kamala Harris, California, San Francisco)
            {
                'content': (
                    'Kamala Harris fue la Fiscal General de California entre 2011 y 2017. '
                    'Anteriormente se desempeñó como fiscal de distrito de San Francisco. '
                    'Harris es graduada de la Universidad Howard y obtuvo su título de abogada '
                    'en la Facultad de Derecho Hastings de la Universidad de California. Durante '
                    'su mandato como Fiscal General, impulsó reformas en el sistema de justicia '
                    'penal del estado.'
                ),
                'type': EpisodeType.text,
                'description': 'artículo de noticias',
            },
            # French: same entities (Kamala Harris, California, San Francisco)
            {
                'content': (
                    'Kamala Harris a été procure
```

### Core Architecture Module: `examples/opentelemetry/otel_stdout_example.py`
```
"""
Copyright 2025, Zep Software, Inc.

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
"""

import asyncio
import json
import logging
from datetime import datetime, timezone
from logging import INFO

from opentelemetry import trace
from opentelemetry.sdk.resources import Resource
from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.sdk.trace.export import ConsoleSpanExporter, SimpleSpanProcessor

from graphiti_core import Graphiti
from graphiti_core.driver.kuzu_driver import KuzuDriver
from graphiti_core.nodes import EpisodeType

logging.basicConfig(
    level=INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    datefmt='%Y-%m-%d %H:%M:%S',
)
logger = logging.getLogger(__name__)


def setup_otel_stdout_tracing():
    """Configure OpenTelemetry to export traces to stdout."""
    resource = Resource(attributes={'service.name': 'graphiti-example'})
    provider = TracerProvider(resource=resource)
    provider.add_span_processor(SimpleSpanProcessor(ConsoleSpanExporter()))
    trace.set_tracer_provider(provider)
    return trace.get_tracer(__name__)


async def main():
    otel_tracer = setup_otel_stdout_tracing()

    print('OpenTelemetry stdout tracing enabled\n')

    kuzu_driver = KuzuDriver()
    graphiti = Graphiti(
        graph_driver=kuzu_driver, tracer=otel_tracer, trace_span_prefix='graphiti.example'
    )

    try:
        await graphiti.build_indices_and_constraints()
        print('Graph indices and constraints built\n')

        episodes = [
            {
                'content': 'Kamala Harris is the Attorney General of California. She was previously '
                'the district attorney for San Francisco.',
                'type': EpisodeType.text,
                'description': 'biographical information',
            },
            {
                'content': 'As AG, Harris was in office from January 3, 2011 – January 3, 2017',
                'type': EpisodeType.text,
                'description': 'term dates',
            },
            {
                'content': {
                    'name': 'Gavin Newsom',
                    'position': 'Governor',
                    'state': 'California',
                    'previous_role': 'Lieutenant Governor',
                },
                'type': EpisodeType.json,
                'description': 'structured data',
            },
        ]

        print('Adding episodes...\n')
        for i, episode in enumerate(episodes):
            await graphiti.add_episode(
                name=f'Episode {i}',
                episode_body=episode['content']
                if isinstance(episode['content'], str)
                else json.dumps(episode['content']),
                source=episode['type'],
                source_description=episode['description'],
                reference_time=datetime.now(timezone.utc),
            )
            print(f'Added episode: Episode {i} ({episode["type"].value})')

        print("\nSearching for: 'Who was the California Attorney General?'\n")
        results = await graphiti.search('Who was the California Attorney General?')

        print('Search Results:')
        for idx, result in enumerate(results[:3]):
            print(f'\nResult {idx + 1}:')
            print(f'  Fact: {result.fact}')
            if hasattr(result, 'valid_at') and result.valid_at:
                print(f'  Valid from: {result.valid_at}')

        print("\nSearching for: 'What positions has Gavin Newsom held?'\n")
        results = await graphiti.search('What positions has Gavin Newsom held?')

        print('Search Results:')
        for idx, result in enumerate(results[:3]):
            print(f'\nResult {idx + 1}:')
            print(f'  Fact: {result.fact}')

        print('\nExample complete')

    finally:
        await graphiti.close()


if __name__ == '__main__':
    asyncio.run(main())

```

### Core Architecture Module: `examples/podcast/podcast_runner.py`
```
"""
Copyright 2024, Zep Software, Inc.

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
"""

import asyncio
import logging
import os
import sys
import tempfile
from uuid import uuid4

from dotenv import load_dotenv
from pydantic import BaseModel, Field
from redislite.async_falkordb_client import AsyncFalkorDB
from transcript_parser import parse_podcast_messages

from graphiti_core import Graphiti
from graphiti_core.driver.falkordb_driver import FalkorDriver
from graphiti_core.llm_client import LLMConfig, OpenAIClient
from graphiti_core.nodes import EpisodeType
from graphiti_core.search.search_config_recipes import NODE_HYBRID_SEARCH_RRF
from graphiti_core.utils.bulk_utils import RawEpisode
from graphiti_core.utils.maintenance.graph_data_operations import clear_data

load_dotenv()


def setup_logging():
    # Create a logger
    logger = logging.getLogger()
    logger.setLevel(logging.INFO)  # Set the logging level to INFO

    # Create console handler and set level to INFO
    console_handler = logging.StreamHandler(sys.stdout)
    console_handler.setLevel(logging.INFO)

    # Create formatter
    formatter = logging.Formatter('%(asctime)s - %(name)s - %(levelname)s - %(message)s')

    # Add formatter to console handler
    console_handler.setFormatter(formatter)

    # Add console handler to logger
    logger.addHandler(console_handler)

    return logger


class Person(BaseModel):
    """A human person, fictional or nonfictional."""

    first_name: str | None = Field(..., description='First name')
    last_name: str | None = Field(..., description='Last name')
    occupation: str | None = Field(..., description="The person's work occupation")


class City(BaseModel):
    """A city"""

    country: str | None = Field(..., description='The country the city is in')


class IsPresidentOf(BaseModel):
    """Relationship between a person and the entity they are a president of"""


class InterpersonalRelationship(BaseModel):
    """A relationship between two people (e.g., knows, works with, interviewed)"""


class LocatedIn(BaseModel):
    """A relationship indicating something is located in or associated with a place"""


async def main(use_bulk: bool = False):
    setup_logging()

    # Configure LLM client
    llm_config = LLMConfig(model='gpt-4.1-mini', small_model='gpt-4.1-nano')
    llm_client = OpenAIClient(config=llm_config)

    # Use embedded FalkorDB (falkordblite) so the runner needs no external DB
    falkor_db_path = os.path.join(tempfile.gettempdir(), 'podcast_runner_falkordb.db')
    falkor_db = AsyncFalkorDB(dbfilename=falkor_db_path)
    falkor_driver = FalkorDriver(falkor_db=falkor_db)

    client = Graphiti(graph_driver=falkor_driver, llm_client=llm_client)
    await clear_data(client.driver)
    await client.build_indices_and_constraints()
    messages = parse_podcast_messages()
    group_id = uuid4().hex

    raw_episodes: list[RawEpisode] = []
    for i, message in enumerate(messages[3:14]):
        raw_episodes.append(
            RawEpisode(
                name=f'Message {i}',
                content=f'{message.speaker_name} ({message.role}): {message.content}',
                reference_time=message.actual_timestamp,
                source=EpisodeType.message,
                source_description='Podcast Transcript',
            )
        )
    # Define edge types - note that some edge types are reused across multiple node type pairs
    # This tests the fix for preserving all signatures when edge types are shared
    edge_types = {
        'IS_PRESIDENT_OF': IsPresidentOf,
        'INTERPERSONAL_RELATIONSHIP': InterpersonalRelationship,
        'LOCATED_IN': LocatedIn,
    }

    # Edge type map with shared edge types across multiple node type pairs:
    # - INTERPERSONAL_RELATIONSHIP is used for both (Person, Person) and (Person, Entity)
    # - LOCATED_IN is used for both (Person, City) and (Entity, City)
    edge_type_map = {
        ('Person', 'Entity'): ['IS_PRESIDENT_OF', 'INTERPERSONAL_RELATIONSHIP'],
        ('Person', 'Person'): ['INTERPERSONAL_RELATIONSHIP'],  # Same type, different signature
        ('Person', 'City'): ['LOCATED_IN'],
        ('Entity', 'City'): ['LOCATED_IN'],  # Same type, different signature
    }

    if use_bulk:
        await client.add_episode_bulk(
            raw_episodes,
            group_id=group_id,
            entity_types={'Person': Person, 'City': City},
            edge_types=edge_types,
            edge_type_map=edge_type_map,
            saga='Freakonomics Podcast',
        )
    else:
        for i, message in enumerate(messages[3:14]):
            episodes = await client.retrieve_episodes(
                message.actual_timestamp, 3, group_ids=[group_id]
            )
            episode_uuids = [episode.uuid for episode in episodes]

            await client.add_episode(
                name=f'Message {i}',
                episode_body=f'{message.speaker_name} ({message.role}): {message.content}',
                reference_time=message.actual_timestamp,
                source_description='Podcast Transcript',
                group_id=group_id,
                entity_types={'Person': Person, 'City': City},
                edge_types=edge_types,
                edge_type_map=edge_type_map,
                previous_episode_uuids=episode_uuids,
                saga='Freakonomics Podcast',
            )

    # Print token usage summary sorted by prompt type
    print('\n\nIngestion complete. Token usage by prompt type:')
    client.token_tracker.print_summary(sort_by='prompt_name')

    # Exercise search against the populated graph
    print('\n\nRunning search queries against the graph:')
    queries = [
        'Who is the president of Fordham University?',
        'What is the Freakonomics podcast about?',
        'Tania Tetlow',
    ]
    for query in queries:
        print(f'\nQuery: {query}')
        edge_results = await client.search(query, group_ids=[group_id], num_results=5)
        if not edge_results:
            print('  (no edge results)')
        for edge in edge_results:
            print(f'  - [{edge.name}] {edge.fact}')

        node_results = await client.search_(
            query,
            group_ids=[group_id],
            config=NODE_HYBRID_SEARCH_RRF.model_copy(update={'limit': 5}),
        )
        if not node_results.nodes:
            print('  (no node results)')
        for node in node_results.nodes:
            print(f'  * {node.name} ({", ".join(node.labels)})')


asyncio.run(main(False))

```

### Core Architecture Module: `examples/podcast/transcript_parser.py`
```
import os
import re
from datetime import datetime, timedelta, timezone

from pydantic import BaseModel


class Speaker(BaseModel):
    index: int
    name: str
    role: str


class ParsedMessage(BaseModel):
    speaker_index: int
    speaker_name: str
    role: str
    relative_timestamp: str
    actual_timestamp: datetime
    content: str


def parse_timestamp(timestamp: str) -> timedelta:
    if 'm' in timestamp:
        match = re.match(r'(\d+)m(?:\s*(\d+)s)?', timestamp)
        if match:
            minutes = int(match.group(1))
            seconds = int(match.group(2)) if match.group(2) else 0
            return timedelta(minutes=minutes, seconds=seconds)
    elif 's' in timestamp:
        match = re.match(r'(\d+)s', timestamp)
        if match:
            seconds = int(match.group(1))
            return timedelta(seconds=seconds)
    return timedelta()  # Return 0 duration if parsing fails


def parse_conversation_file(file_path: str, speakers: list[Speaker]) -> list[ParsedMessage]:
    with open(file_path) as file:
        content = file.read()

    messages = content.split('\n\n')
    speaker_dict = {speaker.index: speaker for speaker in speakers}

    parsed_messages: list[ParsedMessage] = []

    # Find the last timestamp to determine podcast duration
    last_timestamp = timedelta()
    for message in reversed(messages):
        lines = message.strip().split('\n')
        if lines:
            first_line = lines[0]
            parts = first_line.split(':', 1)
            if len(parts) == 2:
                header = parts[0]
                header_parts = header.split()
                if len(header_parts) >= 2:
                    timestamp = header_parts[1].strip('()')
                    last_timestamp = parse_timestamp(timestamp)
                    break

    # Calculate the start time
    now = datetime.now(timezone.utc)
    podcast_start_time = now - last_timestamp

    for message in messages:
        lines = message.strip().split('\n')
        if lines:
            first_line = lines[0]
            parts = first_line.split(':', 1)
            if len(parts) == 2:
                header, content = parts
                header_parts = header.split()
                if len(header_parts) >= 2:
                    speaker_index = int(header_parts[0])
                    timestamp = header_parts[1].strip('()')

                    if len(lines) > 1:
                        content += '\n' + '\n'.join(lines[1:])

                    delta = parse_timestamp(timestamp)
                    actual_time = podcast_start_time + delta

                    speaker = speaker_dict.get(speaker_index)
                    if speaker:
                        speaker_name = speaker.name
                        role = speaker.role
                    else:
                        speaker_name = f'Unknown Speaker {speaker_index}'
                        role = 'Unknown'

                    parsed_messages.append(
                        ParsedMessage(
                            speaker_index=speaker_index,
                            speaker_name=speaker_name,
                            role=role,
                            relative_timestamp=timestamp,
                            actual_timestamp=actual_time,
                            content=content.strip(),
                        )
                    )

    return parsed_messages


def parse_podcast_messages():
    file_path = 'podcast_transcript.txt'
    script_dir = os.path.dirname(__file__)
    relative_path = os.path.join(script_dir, file_path)

    speakers = [
        Speaker(index=0, name='Stephen DUBNER', role='Host'),
        Speaker(index=1, name='Tania Tetlow', role='Guest'),
        Speaker(index=4, name='Narrator', role='Narrator'),
        Speaker(index=5, name='Kamala Harris', role='Quoted'),
        Speaker(index=6, name='Unknown Speaker', role='Unknown'),
        Speaker(index=7, name='Unknown Speaker', role='Unknown'),
        Speaker(index=8, name='Unknown Speaker', role='Unknown'),
        Speaker(index=10, name='Unknown Speaker', role='Unknown'),
    ]

    parsed_conversation = parse_conversation_file(relative_path, speakers)
    print(f'Number of messages: {len(parsed_conversation)}')
    return parsed_conversation

```

### Core Architecture Module: `examples/quickstart/dense_vs_normal_ingestion.py`
```
"""
Copyright 2025, Zep Software, Inc.

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.

Dense vs Normal Episode Ingestion Example
-----------------------------------------
This example demonstrates how Graphiti handles different types of content:

1. Normal Content (prose, narrative, conversations):
   - Lower entity density (few entities per token)
   - Processed in a single LLM call
   - Examples: meeting transcripts, news articles, documentation

2. Dense Content (structured data with many entities):
   - High entity density (many entities per token)
   - Automatically chunked for reliable extraction
   - Examples: bulk data imports, cost reports, entity-dense JSON

The chunking behavior is controlled by environment variables:
- CHUNK_MIN_TOKENS: Minimum tokens before considering chunking (default: 1000)
- CHUNK_DENSITY_THRESHOLD: Entity density threshold (default: 0.15)
- CHUNK_TOKEN_SIZE: Target size per chunk (default: 3000)
- CHUNK_OVERLAP_TOKENS: Overlap between chunks (default: 200)
"""

import asyncio
import json
import logging
import os
from datetime import datetime, timezone
from logging import INFO

from dotenv import load_dotenv

from graphiti_core import Graphiti
from graphiti_core.nodes import EpisodeType

#################################################
# CONFIGURATION
#################################################

logging.basicConfig(
    level=INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    datefmt='%Y-%m-%d %H:%M:%S',
)
logger = logging.getLogger(__name__)

load_dotenv()

neo4j_uri = os.environ.get('NEO4J_URI', 'bolt://localhost:7687')
neo4j_user = os.environ.get('NEO4J_USER', 'neo4j')
neo4j_password = os.environ.get('NEO4J_PASSWORD', 'password')

if not neo4j_uri or not neo4j_user or not neo4j_password:
    raise ValueError('NEO4J_URI, NEO4J_USER, and NEO4J_PASSWORD must be set')


#################################################
# EXAMPLE DATA
#################################################

# Normal content: A meeting transcript (low entity density)
# This is prose/narrative content with few entities per token.
# It will NOT trigger chunking - processed in a single LLM call.
NORMAL_EPISODE_CONTENT = """
Meeting Notes - Q4 Planning Session

Alice opened the meeting by reviewing our progress on the mobile app redesign.
She mentioned that the user research phase went well and highlighted key findings
from the customer interviews conducted last month.

Bob then presented the engineering timeline. He explained that the backend API
refactoring is about 60% complete and should be finished by end of November.
The team has resolved most of the performance issues identified in the load tests.

Carol raised concerns about the holiday freeze period affecting our deployment
schedule. She suggested we move the beta launch to early December to give the
QA team enough time for regression testing before the code freeze.

David agreed with Carol's assessment and proposed allocating two additional
engineers from the platform team to help with the testing effort. He also
mentioned that the documentation needs to be updated before the release.

Action items:
- Alice will finalize the design specs by Friday
- Bob will coordinate with the platform team on resource allocation
- Carol will update the project timeline in Jira
- David will schedule a follow-up meeting for next Tuesday

The meeting concluded at 3:30 PM with agreement to reconvene next week.
"""

# Dense content: AWS cost data (high entity density)
# This is structured data with many entities per token.
# It WILL trigger chunking - processed in multiple LLM calls.
DENSE_EPISODE_CONTENT = {
    'report_type': 'AWS Cost Breakdown',
    'months': [
        {
            'period': '2025-01',
            'services': [
                {'name': 'Amazon S3', 'cost': 2487.97},
                {'name': 'Amazon RDS', 'cost': 1071.74},
                {'name': 'Amazon ECS', 'cost': 853.74},
                {'name': 'Amazon OpenSearch', 'cost': 389.74},
                {'name': 'AWS Secrets Manager', 'cost': 265.77},
                {'name': 'CloudWatch', 'cost': 232.34},
                {'name': 'Amazon VPC', 'cost': 238.39},
                {'name': 'EC2 Other', 'cost': 226.82},
                {'name': 'Amazon EC2 Compute', 'cost': 78.27},
                {'name': 'Amazon DocumentDB', 'cost': 65.40},
                {'name': 'Amazon ECR', 'cost': 29.00},
                {'name': 'Amazon ELB', 'cost': 37.53},
            ],
        },
        {
            'period': '2025-02',
            'services': [
                {'name': 'Amazon S3', 'cost': 2721.04},
                {'name': 'Amazon RDS', 'cost': 1035.77},
                {'name': 'Amazon ECS', 'cost': 779.49},
                {'name': 'Amazon OpenSearch', 'cost': 357.90},
                {'name': 'AWS Secrets Manager', 'cost': 268.57},
                {'name': 'CloudWatch', 'cost': 224.57},
                {'name': 'Amazon VPC', 'cost': 215.15},
                {'name': 'EC2 Other', 'cost': 213.86},
                {'name': 'Amazon EC2 Compute', 'cost': 70.70},
                {'name': 'Amazon DocumentDB', 'cost': 59.07},
                {'name': 'Amazon ECR', 'cost': 33.92},
                {'name': 'Amazon ELB', 'cost': 33.89},
            ],
        },
        {
            'period': '2025-03',
            'services': [
                {'name': 'Amazon S3', 'cost': 2952.31},
                {'name': 'Amazon RDS', 'cost': 1198.79},
                {'name': 'Amazon ECS', 'cost': 869.78},
                {'name': 'Amazon OpenSearch', 'cost': 389.75},
                {'name': 'AWS Secrets Manager', 'cost': 271.33},
                {'name': 'CloudWatch', 'cost': 233.00},
                {'name': 'Amazon VPC', 'cost': 238.31},
                {'name': 'EC2 Other', 'cost': 227.78},
                {'name': 'Amazon EC2 Compute', 'cost': 78.21},
                {'name': 'Amazon DocumentDB', 'cost': 65.40},
                {'name': 'Amazon ECR', 'cost': 33.75},
                {'name': 'Amazon ELB', 'cost': 37.54},
            ],
        },
        {
            'period': '2025-04',
            'services': [
                {'name': 'Amazon S3', 'cost': 3189.62},
                {'name': 'Amazon RDS', 'cost': 1102.30},
                {'name': 'Amazon ECS', 'cost': 848.19},
                {'name': 'Amazon OpenSearch', 'cost': 379.14},
                {'name': 'AWS Secrets Manager', 'cost': 270.89},
                {'name': 'CloudWatch', 'cost': 230.64},
                {'name': 'Amazon VPC', 'cost': 230.54},
                {'name': 'EC2 Other', 'cost': 220.18},
                {'name': 'Amazon EC2 Compute', 'cost': 75.70},
                {'name': 'Amazon DocumentDB', 'cost': 63.29},
                {'name': 'Amazon ECR', 'cost': 35.21},
                {'name': 'Amazon ELB', 'cost': 36.30},
            ],
        },
        {
            'period': '2025-05',
            'services': [
                {'name': 'Amazon S3', 'cost': 3423.07},
                {'name': 'Amazon RDS', 'cost': 1014.50},
                {'name': 'Amazon ECS', 'cost': 874.75},
                {'name': 'Amazon OpenSearch', 'cost': 389.71},
                {'name': 'AWS Secrets Manager', 'cost': 274.91},
                {'name': 'CloudWatch', 'cost': 233.28},
                {'name': 'Amazon VPC', 'cost': 238.53},
                {'name': 'EC2 Other', 'cost': 227.27},
                {'name': 'Amazon EC2 Compute', 'cost': 78.27},
                {'name': 'Amazon Documen
```

### Core Architecture Module: `examples/quickstart/quickstart_falkordb.py`
```
"""
Copyright 2025, Zep Software, Inc.

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
"""

import asyncio
import json
import logging
import os
from datetime import datetime, timezone
from logging import INFO

from dotenv import load_dotenv

from graphiti_core import Graphiti
from graphiti_core.driver.falkordb_driver import FalkorDriver
from graphiti_core.nodes import EpisodeType
from graphiti_core.search.search_config_recipes import NODE_HYBRID_SEARCH_RRF

#################################################
# CONFIGURATION
#################################################
# Set up logging and environment variables for
# connecting to FalkorDB database
#################################################

# Configure logging
logging.basicConfig(
    level=INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    datefmt='%Y-%m-%d %H:%M:%S',
)
logger = logging.getLogger(__name__)

load_dotenv()

# FalkorDB connection parameters
# Make sure FalkorDB (on-premises) is running — see https://docs.falkordb.com/
# By default, FalkorDB does not require a username or password,
# but you can set them via environment variables for added security.
#
# If you're using FalkorDB Cloud, set the environment variables accordingly.
# For on-premises use, you can leave them as None or set them to your preferred values.
#
# The default host and port are 'localhost' and '6379', respectively.
# You can override these values in your environment variables or directly in the code.

falkor_username = os.environ.get('FALKORDB_USERNAME', None)
falkor_password = os.environ.get('FALKORDB_PASSWORD', None)
falkor_host = os.environ.get('FALKORDB_HOST', 'localhost')
falkor_port = os.environ.get('FALKORDB_PORT', '6379')


async def main():
    #################################################
    # INITIALIZATION
    #################################################
    # Connect to FalkorDB and set up Graphiti indices
    # This is required before using other Graphiti
    # functionality
    #################################################

    # Initialize Graphiti with FalkorDB connection
    falkor_driver = FalkorDriver(
        host=falkor_host, port=falkor_port, username=falkor_username, password=falkor_password
    )

    # Or use embedded FalkorDB Lite (requires Python 3.12+ and falkordblite package)
    # from redislite.async_falkordb_client import AsyncFalkorDB
    # falkordb_client = AsyncFalkorDB(dbfilename='/tmp/graphiti_quickstart.db')
    # falkor_driver = FalkorDriver(falkor_db=falkordb_client)

    graphiti = Graphiti(graph_driver=falkor_driver)

    try:
        #################################################
        # ADDING EPISODES
        #################################################
        # Episodes are the primary units of information
        # in Graphiti. They can be text or structured JSON
        # and are automatically processed to extract entities
        # and relationships.
        #################################################

        # Example: Add Episodes
        # Episodes list containing both text and JSON episodes
        episodes = [
            {
                'content': 'Kamala Harris is the Attorney General of California. She was previously '
                'the district attorney for San Francisco.',
                'type': EpisodeType.text,
                'description': 'podcast transcript',
            },
            {
                'content': 'As AG, Harris was in office from January 3, 2011 – January 3, 2017',
                'type': EpisodeType.text,
                'description': 'podcast transcript',
            },
            {
                'content': {
                    'name': 'Gavin Newsom',
                    'position': 'Governor',
                    'state': 'California',
                    'previous_role': 'Lieutenant Governor',
                    'previous_location': 'San Francisco',
                },
                'type': EpisodeType.json,
                'description': 'podcast metadata',
            },
            {
                'content': {
                    'name': 'Gavin Newsom',
                    'position': 'Governor',
                    'term_start': 'January 7, 2019',
                    'term_end': 'Present',
                },
                'type': EpisodeType.json,
                'description': 'podcast metadata',
            },
        ]

        # Add episodes to the graph
        for i, episode in enumerate(episodes):
            await graphiti.add_episode(
                name=f'Freakonomics Radio {i}',
                episode_body=episode['content']
                if isinstance(episode['content'], str)
                else json.dumps(episode['content']),
                source=episode['type'],
                source_description=episode['description'],
                reference_time=datetime.now(timezone.utc),
            )
            print(f'Added episode: Freakonomics Radio {i} ({episode["type"].value})')

        #################################################
        # BASIC SEARCH
        #################################################
        # The simplest way to retrieve relationships (edges)
        # from Graphiti is using the search method, which
        # performs a hybrid search combining semantic
        # similarity and BM25 text retrieval.
        #################################################

        # Perform a hybrid search combining semantic similarity and BM25 retrieval
        print("\nSearching for: 'Who was the California Attorney General?'")
        results = await graphiti.search('Who was the California Attorney General?')

        # Print search results
        print('\nSearch Results:')
        for result in results:
            print(f'UUID: {result.uuid}')
            print(f'Fact: {result.fact}')
            if hasattr(result, 'valid_at') and result.valid_at:
                print(f'Valid from: {result.valid_at}')
            if hasattr(result, 'invalid_at') and result.invalid_at:
                print(f'Valid until: {result.invalid_at}')
            print('---')

        #################################################
        # CENTER NODE SEARCH
        #################################################
        # For more contextually relevant results, you can
        # use a center node to rerank search results based
        # on their graph distance to a specific node
        #################################################

        # Use the top search result's UUID as the center node for reranking
        if results and len(results) > 0:
            # Get the source node UUID from the top result
            center_node_uuid = results[0].source_node_uuid

            print('\nReranking search results based on graph distance:')
            print(f'Using center node UUID: {center_node_uuid}')

            reranked_results = await graphiti.search(
                'Who was the California Attorney General?', center_node_uuid=center_node_uuid
            )

            # Print reranked search results
            print('\nReranked Search Results:')
            for result in reranked_results:
                print(f'UUID: {result.uuid}')
                print(f'Fact: {result.fact}')
                if hasattr(result, 'valid_at') and result.valid_at:
                    print(f'Valid from: {result.valid_at}')
                if hasattr(result, 'invalid_at') and result.invalid_at:
                    print(f'Valid until: {result.invalid_at}')
       
```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #1763** (2026-08-21): **[BUG] Node attributes are silently cleared when no entity type applies to the node**
  *Symptoms*: ## Bug Description `extract_attributes_from_nodes` assigns `node.attributes = attributes` unconditionally (`graphiti_core/utils/maintenance/node_operations.py:763-764`), and `_extract_entity_attributes` returns a bare `{}` whenever no entity type applies to the node (`:790-791`):  ```python if entity_type is None or len(entity_type.model_fields) == 0:     return {} ```  For a node that deduplicates onto an existing stored node, that empty dict replaces attributes a previous typed pass had extracted. The loss reaches storage:  - The resolved node **is** the database node — `_promote_resolved_node` returns the existing   candidate (`dedup_helpers.py:177/181`), and `get_entity_node_from_record` populates `attributes`   from the record (`nodes.py:1052-1054`). - `get_entity_node_save_query` replaces attributes wholesale — `SET n = $entity_data` for   Neo4j/FalkorDB/Neptune, `n.attributes = $attributes` for Kuzu (`node_db_queries.py:137`).  Provider-agnostic; not specific to any backend.  ## Steps to Reproduce Two paths reach the early return. Either is enough:  ```python from pydantic import BaseModel  class Person(BaseModel):     age: int | None = None     city: str | None = None  # 1. A node's attributes are populated by a typed pass. await graphiti.add_episode(..., entity_types={'Person': Person})  # 2a. A later episode omits entity_types entirely — the same node dedups and is wiped. await graphiti.add_episode(..., entity_types=None)  # 2b. Or entity_types is supplied but lacks

- **Issue #1716** (2026-09-21): **[BUG] graph-service all API endpoints lack authentication allowing remote graph wipe and cross-tenant access**
  *Symptoms*: ## Vulnerability type - [x] Incorrect Access Control  ## CWE CWE-306 Missing Authentication for Critical Function  ## Vendor of the product(s) Zep AI (getzep)  ## Affected product(s)/code base ### Product graphiti graph-service (server/graph_service)  ### Version main (to be confirmed)  ## Attack type - [x] Remote  ## Impact - [x] Information Disclosure - [x] Denial of Service - Other impact detail: Unauthenticated deletion and overwrite of graph data across tenants - data integrity loss.  ## Affected component(s) server/graph_service FastAPI app - all endpoints in routers/ingest.py (POST /messages, /entity-node, DELETE /entity-edge/{uuid}, /group/{group_id}, /episode/{uuid}, POST /clear) and routers/retrieve.py (POST /search, GET /entity-edge/{uuid}, /episodes/{group_id}, POST /get-memory); backend graph DB via clear_data.  ## Core vulnerable code path Unauthenticated HTTP request -> FastAPI app without auth middleware (server/graph_service/main.py:20-29) -> route handler -> POST /clear -> clear_data(driver) -> 'MATCH (n) DETACH DELETE n' (graph_data_operations.py:34-44); DELETE /group/{group_id} -> ZepGraphiti.delete_group (zep_graphiti.py:46-64); POST /search with arbitrary group_ids -> graphiti.search (no ownership check); POST /messages with attacker-controlled uuid -> EpisodicNode.save MERGE (n:Episodic {uuid: $uuid}).  Core vulnerable code path:  ```python # server/graph_service/main.py:20-29 app = FastAPI(lifespan=lifespan)   app.include_router(retrieve.router) app.in
  **Post-Mortem & Fix Analysis**:
  > I can take a focused hardening PR, but the default policy is a release/security-contract decision, so I want to confirm the boundary before changing deployment behavior.  Proposed scope: - Add a `GRAPH_SERVICE_API_KEY` setting and one app-level dependency covering both existing routers, using `Authorization: Bearer <key>` plus `secrets.compare_digest`. - Keep only the liveness endpoint unauthenticated; every data-bearing route, including `/clear`, requires the dependency. - Make the service fail closed at startup when no key is configured, with an explicit `GRAPH_SERVICE_ALLOW_INSECURE_NO_AUTH=1` escape hatch for local development/test deployments. This avoids silently retaining the vulnerable default while preserving an intentional opt-in for isolated environments. - Document the required container environment variable and add FastAPI tests for missing, wrong, and correct credentials, plus the explicit insecure-development opt-in.  I would not attempt tenant ownership/authorization in
  > > confirm  @zrh805 Thank you very much for your prompt and thorough analysis!  I completely agree with the proposed mitigation strategy, especially the decision to default to requiring an API key with an explicit opt-out for development. This is the most secure and responsible approach to fix this vulnerability.  Your proposed scope also makes perfect sense:  1. Using GRAPH_SERVICE_API_KEY with Bearer Token auth correctly establishes the missing trust boundary. 2. Protecting all data-bearing routes while leaving only the liveness endpoint open is clean and effective. 3. The explicit GRAPH_SERVICE_ALLOW_INSECURE_NO_AUTH=1 escape hatch, combined with a fail-closed default, is a very robust design.  I have no additional findings at this point. Your plan already covers all the attack vectors I identified.  Thanks again for your quick and professional handling! I'd be happy to test the PR or provide any further information if needed. 
  > Thanks for submitting this issue! Graphiti is not intended to be run fully available on the public internet; it is up to the person hosting Graphiti to protect it (whether that be with authentication they provide, a firewall, or other means they deem appropriate). I'll close this issue.

- **Issue #1662** (2026-07-27): **[BUG] : EntityEdge.get_by_node_uuid returns swapped source/target when queried from the target side**
  *Symptoms*:   ## Bug Description    `EntityEdge.get_by_node_uuid` returns `source_node_uuid` and `target_node_uuid` swapped relative to the stored   relationship direction, whenever the queried node is the relationship's actual target. The same class of bug affects   `edge_bfs_search`.    ## Steps to Reproduce    ```python   from datetime import datetime   from graphiti_core.edges import EntityEdge   from graphiti_core.nodes import EntityNode    # Two entity nodes   alice = EntityNode(name='Alice', group_id='g', summary='alice', created_at=datetime.now())   bob = EntityNode(name='Bob', group_id='g', summary='bob', created_at=datetime.now())   await alice.save(driver)   await bob.save(driver)    # Edge with explicit direction: alice -> bob   edge = EntityEdge(       source_node_uuid=alice.uuid,       target_node_uuid=bob.uuid,       name='likes',       fact='Alice likes Bob',       episodes=[],       created_at=datetime.now(),       group_id='g',   )   await edge.save(driver)    # Query from the TARGET side   retrieved = await EntityEdge.get_by_node_uuid(driver, bob.uuid)   print(retrieved[0].source_node_uuid)  # actual:   bob.uuid   (the queried node)   print(retrieved[0].target_node_uuid)  # actual:   alice.uuid    Expected Behavior    The returned edge should preserve the stored relationship direction:   - source_node_uuid == alice.uuid   - target_node_uuid == bob.uuid    Actual Behavior    The returned edge has its direction reversed:   - source_node_uuid == bob.uuid (the queried node

- **Issue #1642** (2026-08-12): **[BUG] Cross-encoder reranking drops most candidates in edge_search**
  *Symptoms*: ## Description  In `edge_search`, the retrieval stage collects candidates from multiple search methods (`bm25`, `cosine_similarity`, `bfs`) with `2 * limit` candidates each.  However, when using `EdgeReranker.cross_encoder`, only the first `limit` candidates from the merged candidate set are passed to the reranker:  ```python fact_to_uuid_map = {     edge.fact: edge.uuid for edge in list(edge_uuid_map.values())[:limit] } ```  This causes most retrieved candidates to be discarded before reranking.  ## Example  Assume:  ```python limit = 20 ```  With three enabled search methods:  * BM25: 40 candidates * Vector similarity: 40 candidates * BFS: 40 candidates  The search stage can produce up to 120 candidates.  But cross-encoder only evaluates:  ```python edge_uuid_map.values()[:20] ```  The remaining candidates are never scored.  Because `edge_uuid_map` preserves insertion order, candidates from later search methods may be completely excluded depending on the order of `search_results`.  ## Impact  * Hybrid search recall is reduced. * Candidates retrieved by vector search or BFS may never reach the reranker. * Cross-encoder ranking quality becomes dependent on retrieval method ordering.  ## Suggested Fix  Separate the reranker candidate limit from the final result limit.  For example:  candidate_limit = config.cross_encoder_candidate_limit  candidate_edges = list(edge_uuid_map.values())[:candidate_limit]  fact_to_uuid_map = {     edge.fact: edge.uuid     for edge in candidate_edg
  **Post-Mortem & Fix Analysis**:
  > I’m interested in working on this issue.  Before opening a PR, I’d like to confirm the preferred scope. Would you prefer a minimal fix that increases the candidate pool passed to the cross-encoder, for example via a separate `cross_encoder_candidate_limit`, or a balanced merge strategy across retrieval methods before reranking?  I can keep the PR focused and include tests that verify candidates from later retrieval methods are not dropped before cross-encoder reranking.
  > Thank you very much for contributing to the Graphiti project. I've merged a change to use RRF before running cross-encoding. I've also increased the candidate limit by 2x  See PR for more details: #1754 

- **Issue #1481** (2026-09-01): **[BUG] Database Parameter Not Honored in Neo4jDriver.execute_query()**
  *Symptoms*: Even with custom initialization of the driver, the issue persists. Write operations work correctly, but during queries, the database parameter is still not passed to the underlying Neo4j connector.  **Reason:**  `Neo4jDriver.execute_query()` incorrectly puts `database_` into `parameters_` (treating it as a Cypher query parameter `$database_`), rather than passing it as a Neo4j connection parameter. As a result, search queries actually run on the default database instead of the target database.  In contrast, `add_episode` uses the `transaction()` / `session()` method for write operations, which correctly passes `database=self._database`. Therefore, data is written to the correct database.  **Root Cause:**  `Neo4jDriver.execute_query()` places `database_` inside `parameters_` — the position intended for Cypher query parameters:  ```python # Original code (with bug) params.setdefault('database_', self._database)          # ← becomes $database_ query parameter result = await self.client.execute_query(cypher, parameters_=params, **kwargs) ```  This means that no target database is specified at the connection level, causing the Neo4j driver to default to the server’s default database (`neo4j`).  **Why is `add_episode` not affected?**   Because write operations use the `transaction()` method:  ```python # transaction() — passes database correctly async with self.client.session(database=self._database) as session: ```  Data is correctly written to the target database, but search quer
  **Post-Mortem & Fix Analysis**:
  > Verified the diagnosis against current `main` and the installed neo4j driver. The bug is exactly as described.  **Cross-driver signature proof (neo4j 6.1.0):**  ``` AsyncGraphDatabase.driver(...).execute_query(     query_,     parameters_: dict | None = None,     routing_: ...,     database_: str | None = None,        # ← connection-level, trailing-underscore     impersonated_user_: ...,     ... ) ```  So `database_` is a top-level keyword argument, not a Cypher parameter. The current code  ```python params.setdefault('database_', self._database) result = await self.client.execute_query(cypher_query_, parameters_=params, **kwargs) ```  injects `database_` into `parameters_`, where the driver hands it to the query as `$database_` (which is unused by every graphiti Cypher) and leaves the real connection-level `database_=None` — so the driver falls back to the server default. `transaction()` is unaffected because it opens `client.session(database=self._database)` directly, which is why wr
  > Thanks for contributing to Graphiti and for diagnosing this.   We’ve shipped the fix in graphiti-core v0.30.1 and MCP v1.1.0: `database_` is now passed as a Neo4j connection argument, and the MCP server honors `NEO4J_DATABASE`.  Please note:  - If your server’s home database is not named `neo4j` and you don’t pass `database` to the driver, queries now target `neo4j` instead of your home database — pass your database name explicitly to keep the old behavior. - If you configured a custom database, reads now correctly target it. Data previously written via `execute_query` may reside in your home database and may need to be migrated.

- **Issue #1425** (2026-09-06): **[BUG] hypens "-" in title silently fails with syntax error while processing episode from the graphiti mcp server**
  *Symptoms*: ## Bug Description ``` graphiti-mcp-1  | 2026-04-20 22:15:42 - httpx - INFO - HTTP Request: POST http://10.103.17.13:5000/v1/embeddings "HTTP/1.1 200 OK" graphiti-mcp-1  | 2026-04-20 22:15:42 - graphiti_core.driver.falkordb_driver - ERROR - Error executing FalkorDB query: RediSearch: Syntax error at offset 16 near jira graphiti-mcp-1  | CALL db.idx.fulltext.queryNodes('Entity', $query)YIELD node AS n, score WHERE n.group_id IN $group_ids graphiti-mcp-1  |             WITH n, score graphiti-mcp-1  |             ORDER BY score DESC graphiti-mcp-1  |             LIMIT $limit graphiti-mcp-1  |             RETURN graphiti-mcp-1  | graphiti-mcp-1  |         n.uuid AS uuid, graphiti-mcp-1  |         n.name AS name, graphiti-mcp-1  |         n.group_id AS group_id, graphiti-mcp-1  |         n.created_at AS created_at, graphiti-mcp-1  |         n.summary AS summary, graphiti-mcp-1  |         labels(n) AS labels, graphiti-mcp-1  |         properties(n) AS attributes graphiti-mcp-1  | graphiti-mcp-1  | {'query': '(@group_id:"jira-summary") (Samuel | Wycliffe)', 'limit': 20, 'routing_': 'r', 'group_ids': ['jira-summary']} ```  ## Steps to Reproduce Simply tell it to write user-profile details or jira summary as I did.  ## Expected Behavior I expected to see my nodes, with my details.  ## Actual Behavior The mcp call itself succeeded, but I was not able to see my nodes in FalkorDB UI. Digging into the logs I found the syntax error traceback shown above.  ## Environment - **Graphiti Versio
  **Post-Mortem & Fix Analysis**:
  > I am taking this issue. I will add focused escaping for FalkorDB full text group filters and regression coverage for hyphenated group IDs.
  > I confirmed current main already escapes hyphenated FalkorDB group IDs, so this report is resolved by existing code and I will not open a duplicate PR.
  > Thanks

- **Issue #1342** (2026-09-08): **[BUG]  `episode_mentions_reranker` sorts nodes ascending (fewest mentions first)**
  *Symptoms*: ## Bug Description `episode_mentions_reranker` in `graphiti_core/search/search_utils.py` sorts nodes in ascending order of mention count, so nodes mentioned in the fewest episodes rank highest. This is the opposite of what the reranker name implies and what the equivalent edge reranker does.  ## Steps to Reproduce Provide a minimal code example that reproduces the issue:  ```python from collections import defaultdict                                                          def rrf(results, rank_const=1, min_score=0):     scores = defaultdict(float)     for result in results:         for i, uuid in enumerate(result):             scores[uuid] += 1 / (i + rank_const)                                                             sorted_uuids = sorted(scores.keys(), key=lambda u: scores[u], reverse=True)     return (                                                                                                     [u for u in sorted_uuids if scores[u] >= min_score],                                                   [scores[u] for u in sorted_uuids if scores[u] >= min_score],                                         )                                                                                                   # Simulate episode_mentions_reranker with mocked DB counts                                               def simulate_reranker(node_uuid_lists, db_mention_counts):     sorted_uuids, _ = rrf(node_uuid_lists)                                                                   s
  **Post-Mortem & Fix Analysis**:
  > Fix in #1344.
  > Hi, I've been looking into this and traced the root cause.  **Proposed approach:** In graphiti_core/search/search_utils.py, change the episode_mentions_reranker function: (1) replace float('inf') default score with 0, (2) add reverse=True to sorted_uuids.sort(), (3) fix the copy-pasted comment. Then extend test_episode_mentions_reranker in tests/utils/search/search_utils_test.py to include two nodes with positive mention counts and assert the higher-mention node ranks first.  I'll open a draft PR shortly. Happy to adjust based on your preference.

- **Issue #1247** (2026-09-09): **[BUG] server container release workflow**
  *Symptoms*: ## Bug Description  The automatic [server container release workflow](https://raw.githubusercontent.com/getzep/graphiti/refs/heads/main/.github/workflows/release-server-container.yml) via GitHub Actions seems to be broken.  `zepai/graphiti` is still stuck at version [0.22.0](https://hub.docker.com/layers/zepai/graphiti/0.22.0/images/sha256-12bffa459196ae8167a08fb2ea881255d9d165c2156861abacb8fd0d58319028) on Docker Hub. `graphiti-core` is at version v0.28.1 on PyPI.
  **Post-Mortem & Fix Analysis**:
  > Thanks for letting us know. We've fixed this issue via PR #1862. New releases will now deploy a new container to docker.

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

### Incident Patch 1: `c035afb7` (2026-09-11)
**Commit Message**: Update mcp_server/uv.lock to fix httpx2/httpcore2 Dependabot alerts [ZEPAI-3570] (#1884)

**File**: `mcp_server/uv.lock` (modified, +64/-24)
```diff
@@ -199,7 +199,8 @@ name = "anthropic"
 version = "0.111.0"
 source = { registry = "https://pypi.org/simple" }
 dependencies = [
-    { name = "anyio" },
+    { name = "anyio", version = "4.14.2", source = { registry = "https://pypi.org/simple" }, marker = "python_full_version < '3.14'" },
+    { name = "anyio", version = "4.15.1", source = { registry = "https://pypi.org/simple" }, marker = "python_full_version >= '3.14'" },
     { name = "distro" },
     { name = "docstring-parser" },
     { name = "httpx" },
@@ -217,17 +218,37 @@ wheels = [
 
 [[package]]
 name = "anyio"
-version = "4.9.0"
+version = "4.14.2"
 source = { registry = "https://pypi.org/simple" }
+resolution-markers = [
+    "python_full_version == '3.13.*'",
+    "python_full_version == '3.12.*'",
+    "python_full_version < '3.12'",
+]
 dependencies = [
-    { name = "exceptiongroup", marker = "python_full_version < '3.11'" },
+    { name = "exceptiongroup", marker = "python_full_version < '3.11' or python_full_version >= '3.14'" },
     { name = "idna" },
-    { name = "sniffio" },
-    { name = "typing-extensions", version = "4.14.0", source = { registry = "https://pypi.org/simple" }, marker = "python_full_version < '3.13'" },
+    { name = "typing-extensions", version = "4.14.0", source = { registry = "https://pypi.org/simple" }, marker = "python_full_version != '3.13.*'" },
+]
+sdist = { url = "https://files.pythonhosted.org/packages/61/cc/a381afa6efea9f496eff839d4a6a1aed3bfafc7b3ab4b0d1b243a12573dd/anyio-4.14.2.tar.gz", hash = "sha256:cfa139f3ed1a23ee8f88a145ddb5ac7605b8bbfd8592baacd7ce3d8bb4313c7f", size = 260176, upload-time = "2026-07-12T20:29:07.082Z" }
+wheels = [
+    { url = "https://files.pythonhosted.org/packages/da/35/f2287558c17e29fafc8ef3daf819bb9834061cfa43bff8014f7df7f63bdc/anyio-4.14.2-py3-none-any.whl", hash = "sha256:9f505dda5ac9f0c8309b5e8bd445a8c2bf7246f3ce950121e45ea15bc41d1494", size = 125813, upload-time = "2026-07-12T20:29:05.763Z" },
+]
+
+[[package]]
+name = "anyio"
+version = "4.15.1"
+source = { registry = "https://pypi.org/simple" }
+resolution-markers = [
+    "python_full_version >= '3.14'",
+]
+dependencies = [
+    { name = "idna" },
+    { name = "typing-extensions", version = "4.16.0", source = { registry = "https://pypi.org/simple" }, marker = "python_full_version < '3.15'" },
 ]
-sdist = { url = "https://files.pythonhosted.org/packages/95/7d/4c1bd541d4dffa1b52bd83fb8527089e097a106fc90b467a7313b105f840/anyio-4.9.0.tar.gz", hash = "sha256:673c0c244e15788651a4ff38710fea9675823028a6f08a5eda409e0c9840a028", size = 190949, upload-time = "2025-03-17T00:02:54.77Z" }
+sdist = { url = "https://files.pythonhosted.org/packages/a9/d2/f4d173e22df740bc37b1db102b386ba719b66e95b0f0d751f556b387e6d2/anyio-4.15.1.tar.gz", hash = "sha256:9f28306018cbd6d329e64a36d58256edff76dd996fe423bc957326e578b82a94", size = 276966, upload-time = "2026-09-05T10:42:39.44Z" }
 wheels = [
-    { url = "https://files.pythonhosted.org/packages/a1/ee/48ca1a7c89ffec8b6a0c5d02b89c305671d5ffd8d3c94acf8b8c408575bb/anyio-4.9.0-py3-none-any.whl", hash = "sha256:9f76d541cad6e36af7beb62e978876f3b41e3e04f2c1fbf0884604c0a9c4d93c", size = 100916, upload-time = "2025-03-17T00:02:52.713Z" },
+    { url = "https://files.pythonhosted.org/packages/12/b8/4bd346e22b28902df4d651910f5242c28d84e4a5c2435ca5c3f797ed7e2e/anyio-4.15.1-py3-none-any.whl", hash = "sha256:6152fdbbf9a77fdec97731721bebf7c4c44f7c29b424b0065826173efc7ed101", size = 132079, upload-time = "2026-09-05T10:42:37.923Z" },
 ]
 
 [[package]]
@@ -826,7 +847,8 @@ name = "google-genai"
 version = "2.8.0"
 source = { registry = "https://pypi.org/simple" }
 dependencies = [
-    { name = "anyio" },
+    { name = "anyio", version = "4.14.2", source = { registry = "https://pypi.org/simple" }, marker = "python_full_version < '3.14'" },
+    { name = "anyio", version = "4.15.1", source = { registry = "https://pypi.org/simple" }, marker = "python_full_version >= '3.14'" },
     { name = "distro" },
     { name = "google-auth", 
```

---

### Incident Patch 2: `9efd61f5` (2026-09-11)
**Commit Message**: Update mcp_server/uv.lock to fix Dependabot alerts [ZEPAI-3570] (#1882)

* Update MCP server dependencies in uv lock [ZEPAI-3570]

* Trigger CLA check after allowlist update



---

### Incident Patch 3: `323bbe56` (2026-09-11)
**Commit Message**: Update root uv.lock to fix Dependabot alerts [ZEPAI-3570] (#1881)

* Update root dependencies in uv lock [ZEPAI-3570]

* Trigger CLA check after allowlist update



---

### Incident Patch 4: `3ff5c160` (2026-09-08)
**Commit Message**: Land contributor fixes from #1686 #1689 #1720 #1761 (#1856)

* fix FalkorDriver.convert_datetimes_to_strings TypeError on datetime values

* normalize datetimes to UTC in convert_datetimes_to_strings

* add unit tests for datetime param conversion fixes

* add integration test for episode retrieval with non-UTC valid_at

* stop persisting labels list as a node property in FalkorDB bulk save

* apply all entity labels in a single query in FalkorDB bulk save

* add integration test for FalkorDB bulk save labels handling

* fix: episode_mentions_reranker sorts ascending instead of descending

episode_mentions_reranker() in graphiti_core/search/search_utils.py
ranked nodes by mention count in ascending order, so entities mentioned
in the fewest episodes ranked first - the opposite of what the reranker's
name implies and the opposite of every other count-based reranker in the
codebase.

Root cause: the function queried MENTIONS edge counts (higher = more
central/relevant), assigned unmentioned nodes a float('inf') sentinel
(borrowed from a distance-based reranker convention, where "no path
found" correctly means "worst"), then sorted ascending. Under mention-
count semantics this is bac

**File**: `graphiti_core/driver/falkordb_driver.py` (modified, +3/-3)
```diff
@@ -70,7 +70,7 @@
 from graphiti_core.driver.operations.saga_node_ops import SagaNodeOperations
 from graphiti_core.driver.operations.search_ops import SearchOperations
 from graphiti_core.graph_queries import get_fulltext_indices, get_range_indices
-from graphiti_core.utils.datetime_utils import convert_datetimes_to_strings
+from graphiti_core.utils.datetime_utils import convert_datetimes_to_strings, ensure_utc
 
 logger = logging.getLogger(__name__)
 
@@ -360,8 +360,8 @@ def convert_datetimes_to_strings(obj):
             return [FalkorDriver.convert_datetimes_to_strings(item) for item in obj]
         elif isinstance(obj, tuple):
             return tuple(FalkorDriver.convert_datetimes_to_strings(item) for item in obj)
-        elif isinstance(obj, datetime):
-            return obj.isoformat()
+        elif isinstance(obj, datetime.datetime):
+            return ensure_utc(obj).isoformat()  # type: ignore[union-attr]
         else:
             return obj
 
```

**File**: `graphiti_core/graphiti.py` (modified, +4/-1)
```diff
@@ -377,7 +377,8 @@ async def _get_or_create_saga(
         records, _, _ = await driver.execute_query(
             """
             MATCH (s:Saga {name: $name, group_id: $group_id})
-            RETURN s.uuid AS uuid, s.name AS name, s.group_id AS group_id, s.created_at AS created_at
+            RETURN s.uuid AS uuid, s.name AS name, s.group_id AS group_id, s.created_at AS created_at,
+                   s.first_episode_uuid AS first_episode_uuid, s.last_episode_uuid AS last_episode_uuid
             """,
             name=saga_name,
             group_id=group_id,
@@ -391,6 +392,8 @@ async def _get_or_create_saga(
                 name=record['name'],
                 group_id=record['group_id'],
                 created_at=parse_db_date(record['created_at']),  # type: ignore
+                first_episode_uuid=record['first_episode_uuid'],
+                last_episode_uuid=record['last_episode_uuid'],
             )
 
         saga = SagaNode(name=saga_name, group_id=group_id, created_at=created_at)
```

**File**: `graphiti_core/models/nodes/node_db_queries.py` (modified, +18/-14)
```diff
@@ -201,21 +201,25 @@ def get_entity_node_save_bulk_query(
         case GraphProvider.FALKORDB:
             queries = []
             for node in nodes:
-                for label in node['labels']:
-                    queries.append(
-                        (
-                            f"""
-                            UNWIND $nodes AS node
-                            MERGE (n:Entity {{uuid: node.uuid}})
-                            SET n:{label}
-                            SET n = node
-                            WITH n, node
-                            SET n.name_embedding = vecf32(node.name_embedding)
-                            RETURN n.uuid AS uuid
-                            """,
-                            {'nodes': [node]},
-                        )
+                # Exclude the labels list so it is not persisted as a node property
+                # by `SET n = node`.
+                node_data = {k: v for k, v in node.items() if k != 'labels'}
+                # Apply all labels in a single query instead of one query per label.
+                label_expr = ':'.join(node['labels']) if node['labels'] else 'Entity'
+                queries.append(
+                    (
+                        f"""
+                        UNWIND $nodes AS node
+                        MERGE (n:Entity {{uuid: node.uuid}})
+                        SET n:{label_expr}
+                        SET n = node
+                        WITH n, node
+                        SET n.name_embedding = vecf32(node.name_embedding)
+                        RETURN n.uuid AS uuid
+                        """,
+                        {'nodes': [node_data]},
                     )
+                )
             return queries
         case GraphProvider.NEPTUNE:
             queries = []
```

**File**: `graphiti_core/search/search_utils.py` (modified, +9/-4)
```diff
@@ -1883,10 +1883,15 @@ async def episode_mentions_reranker(
 
     for uuid in sorted_uuids:
         if uuid not in scores:
-            scores[uuid] = float('inf')
-
-    # rerank on shortest distance
-    sorted_uuids.sort(key=lambda cur_uuid: scores[cur_uuid])
+            # Node has no MENTIONS edges at all - treat as zero mentions so it
+            # ranks last (descending sort below) and is excluded by any
+            # min_score > 0, instead of being (incorrectly) unfilterable.
+            scores[uuid] = 0
+
+    # rerank by descending mention count - nodes mentioned in the most
+    # episodes rank first, matching the reranker's name and the convention
+    # used by the other count-based rerankers.
+    sorted_uuids.sort(key=lambda cur_uuid: scores[cur_uuid], reverse=True)
 
     return [uuid for uuid in sorted_uuids if scores[uuid] >= min_score], [
         scores[uuid] for uuid in sorted_uuids if scores[uuid] >= min_score
```

**File**: `graphiti_core/utils/datetime_utils.py` (modified, +6/-1)
```diff
@@ -50,6 +50,11 @@ def convert_datetimes_to_strings(obj):
     elif isinstance(obj, tuple):
         return tuple(convert_datetimes_to_strings(item) for item in obj)
     elif isinstance(obj, datetime):
-        return obj.isoformat()
+        # Normalize to UTC before serializing. The resulting ISO strings are
+        # compared lexicographically by drivers that store datetimes as strings
+        # (e.g. FalkorDB), which is only correct when all offsets are identical.
+        utc_dt = ensure_utc(obj)
+        assert utc_dt is not None
+        return utc_dt.isoformat()
     else:
         return obj
```

---

### Incident Patch 5: `2d96f271` (2026-09-08)
**Commit Message**: fix(falkordb): avoid a full :Entity scan per hit in edge_fulltext_search (#1711)

edge_fulltext_search resolves a matched relationship's endpoints with

    MATCH (n:Entity)-[e:RELATES_TO {uuid: rel.uuid}]->(m:Entity)

FalkorDB plans this as a Node By Label Scan over every :Entity node for
each row the fulltext index yields, so the search costs O(hits x entities)
even though the trailing LIMIT keeps only a handful of rows:

    Results
      Project
        Filter
          Edge By Index Scan | [e:RELATES_TO]
            Node By Label Scan | (n:Entity)     <-- once per hit
              ProcedureCall

The relationship the index already returned knows its own endpoints, so
read them with startNode()/endNode() instead. The added label predicate
keeps the result set identical to the pattern's.

Measured on a FalkorDB graph with 5,665 nodes / 20,263 RELATES_TO edges /
3,725 entities, same query, byte-identical 306-row result set:

    before   33,383 ms
    after         1.6 ms

Neo4j and Kuzu are untouched.

Co-authored-by: trevor-sykes <1017729+trevor-sykes@users.noreply.github.com>
Co-authored-by: Claude Opus 5 <noreply@anthropic.com>
Co-authored-by: Preston Rasmussen <109292228+pra

**File**: `graphiti_core/search/search_utils.py` (modified, +11/-0)
```diff
@@ -204,6 +204,17 @@ async def edge_fulltext_search(
     YIELD relationship AS rel, score
     MATCH (n:Entity)-[e:RELATES_TO {uuid: rel.uuid}]->(m:Entity)
     """
+    if driver.provider == GraphProvider.FALKORDB:
+        # FalkorDB plans the MATCH above as a full :Entity label scan for EVERY row the
+        # fulltext index yields, so the cost is O(hits x entities). The relationship the
+        # index already returned knows its own endpoints, so read them directly. The label
+        # predicate keeps the result set identical to the pattern's.
+        match_query = """
+        YIELD relationship AS rel, score
+        WITH rel AS e, score, startNode(rel) AS n, endNode(rel) AS m
+        WHERE n:Entity AND m:Entity
+        WITH e, score, n, m
+        """
     if driver.provider == GraphProvider.KUZU:
         match_query = """
         YIELD node, score
```

---

### Incident Patch 6: `08834609` (2026-09-08)
**Commit Message**: fix: use request-scoped driver for concurrent multi-group_id isolation (#1676) (#1699)

fix: use request-scoped driver for concurrent group_id isolation (#1676)

add_episode and add_episode_bulk previously reassigned the shared
self.driver (and self.clients.driver) whenever a group_id mapped to a
different database:

    if group_id != self.driver._database:
        self.driver = self.driver.clone(database=group_id)
        self.clients.driver = self.driver

Because these coroutines contain many await points (LLM calls,
embeddings, DB reads/writes), a concurrent call for a *different*
group_id could reassign self.driver mid-execution. The first call's
remaining operations then targeted the wrong database, silently
persisting episodes under the wrong graph. This manifested in
production as episodes leaking across FalkorDB group graphs with no
error raised.

This replaces the shared-state mutation with a request-scoped bundle:
_resolve_request_scope(group_id) returns the effective group_id, a
per-call driver, and a matching GraphitiClients copy. Both entry points
and their helper methods (_extract_and_resolve_edges,
_process_episode_data, _extract_and_dedupe_nodes_bulk,
_resolve_node

**File**: `graphiti_core/graphiti.py` (modified, +115/-59)
```diff
@@ -344,7 +344,11 @@ async def close(self):
         await self.driver.close()
 
     async def _get_or_create_saga(
-        self, saga_name: str, group_id: str, created_at: datetime
+        self,
+        saga_name: str,
+        group_id: str,
+        created_at: datetime,
+        driver: GraphDriver | None = None,
     ) -> SagaNode:
         """
         Get an existing saga by name or create a new one.
@@ -368,7 +372,9 @@ async def _get_or_create_saga(
         """
         from graphiti_core.helpers import parse_db_date
 
-        records, _, _ = await self.driver.execute_query(
+        driver = driver or self.driver
+
+        records, _, _ = await driver.execute_query(
             """
             MATCH (s:Saga {name: $name, group_id: $group_id})
             RETURN s.uuid AS uuid, s.name AS name, s.group_id AS group_id, s.created_at AS created_at
@@ -388,22 +394,24 @@ async def _get_or_create_saga(
             )
 
         saga = SagaNode(name=saga_name, group_id=group_id, created_at=created_at)
-        await saga.save(self.driver)
+        await saga.save(driver)
         return saga
 
     async def _saga_get_previous_episode_uuid(
-        self, saga_uuid: str, current_episode_uuid: str
+        self, saga_uuid: str, current_episode_uuid: str, driver: GraphDriver | None = None
     ) -> str | None:
         """Find the most recent episode UUID in a saga, excluding the current one."""
-        if self.driver.graph_operations_interface:
+        driver = driver or self.driver
+
+        if driver.graph_operations_interface:
             try:
-                return await self.driver.graph_operations_interface.saga_get_previous_episode_uuid(
-                    self.driver, saga_uuid, current_episode_uuid
+                return await driver.graph_operations_interface.saga_get_previous_episode_uuid(
+                    driver, saga_uuid, current_episode_uuid
                 )
             except NotImplementedError:
                 pass
 
-        records, _, _ = await self.driver.execute_query(
+        records, _, _ = await driver.execute_query(
             """
             MATCH (s:Saga {uuid: $saga_uuid})-[:HAS_EPISODE]->(e:Episodic)
             WHERE e.uuid <> $current_episode_uuid
@@ -639,9 +647,17 @@ async def _extract_and_resolve_edges(
         nodes: list[EntityNode],
         uuid_map: dict[str, str],
         custom_extraction_instructions: str | None = None,
+        clients: GraphitiClients | None = None,
     ) -> tuple[list[EntityEdge], list[EntityEdge], list[EntityEdge]]:
         """Extract edges from episode(s) and resolve against existing graph.
 
+        Parameters
+        ----------
+        clients : GraphitiClients | None
+            Optional request-scoped clients bundle. Defaults to ``self.clients``.
+            Callers pass a per-request bundle so concurrent calls for different
+            group_ids target the correct database (issue #1676).
+
         Returns
         -------
         tuple[list[EntityEdge], list[EntityEdge], list[EntityEdge]]
@@ -650,11 +666,12 @@ async def _extract_and_resolve_edges(
             - invalidated_edges: Edges invalidated by new information
             - new_edges: Only edges that are new to the graph (not duplicates)
         """
+        clients = clients or self.clients
         episodes = episode if isinstance(episode, list) else [episode]
         primary_episode = episodes[0]
 
         extracted_edges = await extract_edges(
-            self.clients,
+            clients,
             episode,
             extracted_nodes,
             previous_episodes,
@@ -667,7 +684,7 @@ async def _extract_and_resolve_edges(
         edges = resolve_edge_pointers(extracted_edges, uuid_map)
 
         resolved_edges, invalidated_edges, new_edges = await resolve_extracted_edges(
-            self.clients,
+            clients,
             edges,
             primary_episode,
             nodes,
@@ -687,6 +704,7 @@ async def _process_episode_data(

```

**File**: `tests/test_request_scope_concurrency.py` (added, +188/-0)
```diff
@@ -0,0 +1,188 @@
+"""
+Copyright 2024, Zep Software, Inc.
+
+Licensed under the Apache License, Version 2.0 (the "License");
+you may not use this file except in compliance with the License.
+You may obtain a copy of the License at
+
+    http://www.apache.org/licenses/LICENSE-2.0
+
+Unless required by applicable law or agreed to in writing, software
+distributed under the License is distributed on an "AS IS" BASIS,
+WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
+See the License for the specific language governing permissions and
+limitations under the License.
+"""
+
+# Regression tests for concurrent multi-group_id database routing (issue #1676).
+#
+# These tests are database-free: they exercise ``Graphiti._resolve_request_scope``
+# directly with a fake driver. The historical bug was that ``add_episode`` /
+# ``add_episode_bulk`` reassigned the shared ``self.driver`` when a ``group_id``
+# mapped to a different database. Because those coroutines have many ``await``
+# points, a concurrent call for a different ``group_id`` could reassign
+# ``self.driver`` mid-execution and silently persist episodes under the wrong
+# graph. The fix returns a request-scoped driver/clients bundle instead of
+# mutating shared instance state.
+
+import asyncio
+from typing import Any
+from unittest.mock import Mock
+
+import pytest
+
+from graphiti_core.cross_encoder.client import CrossEncoderClient
+from graphiti_core.driver.driver import GraphDriver, GraphProvider
+from graphiti_core.embedder.client import EmbedderClient
+from graphiti_core.graphiti import Graphiti
+from graphiti_core.graphiti_types import GraphitiClients
+from graphiti_core.llm_client import LLMClient
+from graphiti_core.tracer import Tracer
+
+pytest_plugins = ('pytest_asyncio',)
+
+
+class FakeDriver(GraphDriver):
+    """Minimal in-memory GraphDriver whose ``clone`` records the target database.
+
+    Each ``clone`` returns a brand new instance bound to the requested database,
+    mirroring how the real drivers hand back a call-scoped copy without mutating
+    the original.
+    """
+
+    provider = GraphProvider.NEO4J
+
+    def __init__(self, database: str = 'default_db'):
+        self._database = database
+        self.clone_calls: list[str] = []
+
+    def clone(self, database: str) -> 'FakeDriver':
+        self.clone_calls.append(database)
+        cloned = FakeDriver(database=database)
+        return cloned
+
+    # --- Abstract methods: unused by these tests, kept as no-ops. ---
+    async def execute_query(self, cypher_query_: str, **kwargs: Any) -> Any:  # pragma: no cover
+        raise NotImplementedError
+
+    def session(self, database: str | None = None):  # pragma: no cover
+        raise NotImplementedError
+
+    def close(self):  # pragma: no cover
+        raise NotImplementedError
+
+    def delete_all_indexes(self):  # pragma: no cover
+        raise NotImplementedError
+
+    async def build_indices_and_constraints(
+        self, delete_existing: bool = False
+    ):  # pragma: no cover
+        raise NotImplementedError
+
+
+def _make_graphiti(database: str = 'default_db') -> tuple[Graphiti, FakeDriver]:
+    """Build a Graphiti instance around a FakeDriver, bypassing __init__ side effects."""
+    driver = FakeDriver(database=database)
+    clients = GraphitiClients(  # type: ignore[call-arg]
+        driver=driver,
+        llm_client=Mock(spec=LLMClient),
+        embedder=Mock(spec=EmbedderClient),
+        cross_encoder=Mock(spec=CrossEncoderClient),
+        tracer=Mock(spec=Tracer),
+    )
+    graphiti = Graphiti.__new__(Graphiti)
+    graphiti.driver = driver
+    graphiti.clients = clients
+    return graphiti, driver
+
+
+def test_resolve_request_scope_none_group_id_reuses_shared_driver():
+    graphiti, driver = _make_graphiti()
+
+    group_id, scoped_driver, scoped_clients = graphiti._resolve_request_scope(None)
+
+    # Default group id for Neo4j is the empty string.
+    assert group_id == ''
+  
```

---

### Incident Patch 7: `ef68089a` (2026-09-08)
**Commit Message**: fix: bind arguments by name in multi-group decorator branch (#1758) (#1760)

* fix: bind arguments by name in multi-group decorator branch (#1758)

The multi-group branch popped group_ids from its original positional slot
and re-invoked the wrapped function with the shifted positional args plus
group_ids/driver as keywords. A caller that also passed driver positionally
collided with the injected keyword and raised
TypeError: got multiple values for argument 'driver'.

Bind the call once with inspect.signature(func).bind(...) and rewrite the
bound arguments per group instead of splicing positional slots.

* chore: re-trigger CLA check

* chore: re-trigger CLA check

* fix: bind arguments per task in the multi-group dispatch

The single BoundArguments object was shared across the per-group tasks
and mutated in place — safe only because nothing awaited between the
rewrite and the read. Rebinding from the original call inside each task
removes the trap.

---------

Co-authored-by: icn5381 <255778606+icn5381@users.noreply.github.com>
Co-authored-by: Preston Rasmussen <109292228+prasmussen15@users.noreply.github.com>

**File**: `graphiti_core/decorators.py` (modified, +15/-10)
```diff
@@ -74,16 +74,21 @@ async def wrapper(self, *args, **kwargs):
             driver = self.clients.driver
 
             async def execute_for_group(gid: str):
-                # Remove group_ids from args if it was passed positionally
-                filtered_args = list(args)
-                if group_ids_pos is not None and len(args) > group_ids_pos:
-                    filtered_args.pop(group_ids_pos)
-
-                return await func(
-                    self,
-                    *filtered_args,
-                    **{**kwargs, 'group_ids': [gid], 'driver': driver.clone(database=gid)},
-                )
+                # Bind the call by name, per task, from the original args.
+                # Popping group_ids from its original positional slot shifts
+                # every later positional argument down, so a caller that
+                # passed driver positionally collided with the keyword
+                # injected here (TypeError: got multiple values for argument
+                # 'driver') (#1758). Re-binding from the signature normalizes
+                # every argument to its declared name before the per-group
+                # rewrite; a fresh BoundArguments per task also avoids
+                # sharing one mutated-in-place object across concurrent
+                # tasks, which is safe only as long as nothing awaits
+                # between the rewrite and the read.
+                bound = inspect.signature(func).bind(self, *args, **kwargs)
+                bound.arguments['group_ids'] = [gid]
+                bound.arguments['driver'] = driver.clone(database=gid)
+                return await func(*bound.args, **bound.kwargs)
 
             results = await semaphore_gather(
                 *[execute_for_group(gid) for gid in group_ids],
```

**File**: `tests/test_handle_multiple_group_ids.py` (modified, +35/-0)
```diff
@@ -102,3 +102,38 @@ async def test_non_falkor_single_group_id_is_passthrough():
     assert driver.clone_calls == []
     assert host.seen_drivers == [None]
     assert result == ["q:None:['tenant']"]
+
+
+@pytest.mark.asyncio
+async def test_falkor_multi_group_ids_with_positional_driver():
+    """A positional `driver` must not collide with the injected keyword (#1758).
+
+    The multi-group branch pops `group_ids` from its original positional slot
+    and re-invokes `func` with the shifted positional args plus `driver` as a
+    keyword — which raised `TypeError: got multiple values for argument
+    'driver'` whenever the caller also passed `driver` positionally."""
+    driver = _FakeDriver('reggraph')
+    host = _Host(driver)
+
+    result = await host.search('q', ['a', 'b'], driver)
+
+    assert driver.clone_calls == ['a', 'b']
+    assert host.clients.driver is driver
+    assert set(host.seen_drivers) == {'a', 'b'}
+    assert sorted(result) == ["q:a:['a']", "q:b:['b']"]
+
+
+@pytest.mark.asyncio
+async def test_falkor_multi_group_ids_with_positional_group_ids_and_kwarg_driver():
+    """`group_ids` positional with `driver` as a keyword: the wrapper must keep
+    serving positional `group_ids` after the positional-slot pop is replaced by
+    name-based binding."""
+    driver = _FakeDriver('reggraph')
+    host = _Host(driver)
+
+    result = await host.search('q', ['a', 'b'], driver=driver)
+
+    assert driver.clone_calls == ['a', 'b']
+    assert host.clients.driver is driver
+    assert set(host.seen_drivers) == {'a', 'b'}
+    assert sorted(result) == ["q:a:['a']", "q:b:['b']"]
```

---

### Incident Patch 8: `7db96847` (2026-09-08)
**Commit Message**: fix: include Saga nodes when clearing data by group_ids (#1688)

* include Saga nodes when clearing data by group_ids

* add integration test for group-scoped clear_data deleting Saga nodes

---------

Co-authored-by: Preston Rasmussen <109292228+prasmussen15@users.noreply.github.com>

**File**: `graphiti_core/driver/falkordb/operations/graph_ops.py` (modified, +1/-1)
```diff
@@ -43,7 +43,7 @@ async def clear_data(
             await executor.execute_query('MATCH (n) DETACH DELETE n')
         else:
             # FalkorDB: iterate labels individually
-            for label in ['Entity', 'Episodic', 'Community']:
+            for label in ['Entity', 'Episodic', 'Community', 'Saga']:
                 await executor.execute_query(
                     f"""
                     MATCH (n:{label})
```

**File**: `graphiti_core/driver/kuzu/operations/graph_ops.py` (modified, +1/-1)
```diff
@@ -45,7 +45,7 @@ async def clear_data(
         else:
             # Kuzu requires deleting RelatesToNode_ intermediates in addition to
             # Entity, Episodic, and Community nodes.
-            for label in ['RelatesToNode_', 'Entity', 'Episodic', 'Community']:
+            for label in ['RelatesToNode_', 'Entity', 'Episodic', 'Community', 'Saga']:
                 await executor.execute_query(
                     f"""
                     MATCH (n:{label})
```

**File**: `graphiti_core/driver/neo4j/operations/graph_ops.py` (modified, +1/-1)
```diff
@@ -42,7 +42,7 @@ async def clear_data(
         if group_ids is None:
             await executor.execute_query('MATCH (n) DETACH DELETE n')
         else:
-            for label in ['Entity', 'Episodic', 'Community']:
+            for label in ['Entity', 'Episodic', 'Community', 'Saga']:
                 await executor.execute_query(
                     f"""
                     MATCH (n:{label})
```

**File**: `graphiti_core/driver/neptune/operations/graph_ops.py` (modified, +1/-1)
```diff
@@ -48,7 +48,7 @@ async def clear_data(
         if group_ids is None:
             await executor.execute_query('MATCH (n) DETACH DELETE n')
         else:
-            for label in ['Entity', 'Episodic', 'Community']:
+            for label in ['Entity', 'Episodic', 'Community', 'Saga']:
                 await executor.execute_query(
                     f"""
                     MATCH (n:{label})
```

**File**: `graphiti_core/utils/maintenance/graph_data_operations.py` (modified, +1/-1)
```diff
@@ -44,7 +44,7 @@ async def delete_all(tx):
             await tx.run('MATCH (n) DETACH DELETE n')
 
         async def delete_group_ids(tx):
-            labels = ['Entity', 'Episodic', 'Community']
+            labels = ['Entity', 'Episodic', 'Community', 'Saga']
             if driver.provider == GraphProvider.KUZU:
                 labels.append('RelatesToNode_')
 
```

---

### Incident Patch 9: `9d63818f` (2026-09-01)
**Commit Message**: fix(ci): bump gh-action-pypi-publish for metadata 2.5 (#1821)

Hatchling now emits Metadata-Version 2.5, which the pinned Twine 6 action rejects during the v0.30.0 release. v1.14.2 ships Twine 7 so the wheel can upload.

Co-authored-by: Cursor <cursoragent@cursor.com>

**File**: `.github/workflows/release-graphiti-core.yml` (modified, +1/-1)
```diff
@@ -42,4 +42,4 @@ jobs:
       - name: Build project for distribution
         run: uv build
       - name: Publish package distributions to PyPI
-        uses: pypa/gh-action-pypi-publish@ed0c53931b1dc9bd32cbe73a98c7f6766f8a527e # release/v1
+        uses: pypa/gh-action-pypi-publish@dc37677b2e1c63e2034f94d8a5b11f265b73ba33 # v1.14.2
```

---

### Incident Patch 10: `7eea1315` (2026-09-01)
**Commit Message**: fix(neo4j): route queries to the configured database

Pass database_ as Neo4j's routing keyword instead of a unused Cypher parameter, and send index deletion through the same path.

Co-authored-by: Cursor <cursoragent@cursor.com>

**File**: `graphiti_core/driver/neo4j_driver.py` (modified, +12/-8)
```diff
@@ -158,17 +158,23 @@ async def transaction(self) -> AsyncIterator[Transaction]:
                 raise
 
     async def execute_query(self, cypher_query_: LiteralString, **kwargs: Any) -> EagerResult:
-        # Check if database_ is provided in kwargs.
-        # If not populated, set the value to retain backwards compatibility
         params = kwargs.pop('params', None)
         if params is None:
             params = {}
-        params.setdefault('database_', self._database)
+        # Route via Neo4j's database_ kwarg; an explicit override wins (including None,
+        # which lets the server resolve the home database), else the driver default.
+        database = kwargs.pop('database_') if 'database_' in kwargs else self._database
 
         try:
-            result = await self.client.execute_query(cypher_query_, parameters_=params, **kwargs)
+            result = await self.client.execute_query(
+                cypher_query_, parameters_=params, database_=database, **kwargs
+            )
         except Exception as e:
-            logger.error(f'Error executing Neo4j query: {e}\n{cypher_query_}\n{params}')
+            # Log parameter names only; values may contain sensitive data.
+            logger.error(
+                f'Error executing Neo4j query: {e}\n{cypher_query_}\n'
+                f'parameter keys: {sorted([*params, *kwargs])}'
+            )
             raise
 
         return result
@@ -189,9 +195,7 @@ async def close(self) -> None:
         await self.client.close()
 
     def delete_all_indexes(self) -> Coroutine:
-        return self.client.execute_query(
-            'CALL db.indexes() YIELD name DROP INDEX name',
-        )
+        return self.execute_query('CALL db.indexes() YIELD name DROP INDEX name')
 
     async def _execute_index_query(self, query: LiteralString) -> EagerResult | None:
         """Execute an index creation query, ignoring 'index already exists' errors.
```

**File**: `tests/driver/test_neo4j_driver_routing.py` (added, +105/-0)
```diff
@@ -0,0 +1,105 @@
+"""Unit tests for Neo4jDriver query routing to the configured database.
+
+Neo4j's client takes ``database_`` as a top-level routing keyword, distinct from
+Cypher ``parameters_``. These tests assert ``execute_query`` (and index deletion)
+pass the driver database through that routing slot rather than stuffing it into
+query parameters, so a non-default database name is actually used.
+
+No live Neo4j is required: the scheduled init task is cancelled and ``client``
+is replaced with a mock.
+"""
+
+from unittest.mock import AsyncMock, MagicMock, patch
+
+import pytest
+
+from graphiti_core.driver.neo4j_driver import Neo4jDriver
+
+pytestmark = pytest.mark.asyncio
+
+
+def _make_driver(**init_kwargs) -> Neo4jDriver:
+    """Build a Neo4jDriver whose client is a mock and whose init task is inert."""
+    mock_client = MagicMock()
+    mock_client.execute_query = AsyncMock()
+    mock_client.close = AsyncMock()
+
+    with (
+        patch(
+            'graphiti_core.driver.neo4j_driver.AsyncGraphDatabase.driver',
+            return_value=mock_client,
+        ),
+        patch.object(Neo4jDriver, 'build_indices_and_constraints', new_callable=AsyncMock),
+    ):
+        driver = Neo4jDriver(uri='bolt://x', user='u', password='p', **init_kwargs)
+
+    if driver._init_task is not None:
+        driver._init_task.cancel()
+
+    assert driver.client is mock_client
+    return driver
+
+
+async def test_execute_query_routes_to_configured_database():
+    driver = _make_driver(database='custom')
+    try:
+        await driver.execute_query('RETURN 1')
+
+        driver.client.execute_query.assert_awaited_once()
+        call_kwargs = driver.client.execute_query.await_args.kwargs
+        assert call_kwargs['database_'] == 'custom'
+        assert 'database_' not in call_kwargs['parameters_']
+    finally:
+        await driver.close()
+
+
+async def test_execute_query_per_call_database_override_wins():
+    driver = _make_driver(database='custom')
+    try:
+        await driver.execute_query('RETURN 1', database_='override')
+
+        driver.client.execute_query.assert_awaited_once()
+        call_kwargs = driver.client.execute_query.await_args.kwargs
+        assert call_kwargs['database_'] == 'override'
+        assert 'database_' not in call_kwargs['parameters_']
+    finally:
+        await driver.close()
+
+
+async def test_execute_query_explicit_none_database_requests_home_database():
+    driver = _make_driver(database='custom')
+    try:
+        await driver.execute_query('RETURN 1', database_=None)
+
+        driver.client.execute_query.assert_awaited_once()
+        call_kwargs = driver.client.execute_query.await_args.kwargs
+        assert call_kwargs['database_'] is None
+        assert 'database_' not in call_kwargs['parameters_']
+    finally:
+        await driver.close()
+
+
+async def test_execute_query_defaults_to_neo4j_database():
+    driver = _make_driver()
+    try:
+        await driver.execute_query('RETURN 1')
+
+        driver.client.execute_query.assert_awaited_once()
+        call_kwargs = driver.client.execute_query.await_args.kwargs
+        assert call_kwargs['database_'] == 'neo4j'
+        assert 'database_' not in call_kwargs['parameters_']
+    finally:
+        await driver.close()
+
+
+async def test_delete_all_indexes_routes_through_execute_query():
+    driver = _make_driver(database='custom')
+    try:
+        await driver.delete_all_indexes()
+
+        driver.client.execute_query.assert_awaited_once()
+        call_kwargs = driver.client.execute_query.await_args.kwargs
+        assert call_kwargs['database_'] == 'custom'
+        assert 'database_' not in call_kwargs['parameters_']
+    finally:
+        await driver.close()
```

#### Recent Merged Pull Requests:
- **PR #1939** (2026-09-28): Replace Ellipsis with on-request Copilot code review (@pevans)
- **PR #1936** (2026-09-28): Update anyio to 4.14.2 or later in the uv lock files (@jackaldenryan)
- **PR #1928** (closed): Add RFC for AI code review and coding agents (@pevans)
- **PR #1926** (2026-09-25): route MCP tools to the graph of the requested group_id (@pevans)
- **PR #1921** (2026-09-25): upgrade mcp_server to MCP SDK 2.x (@pevans)
- **PR #1910** (closed): OpenAIGenericClient: list every property as required in the json_schema response format (@v8eta)
- **PR #1902** (2026-09-21): Add contributor guidelines and an intake bot for issues and pull requests (@pevans)
- **PR #1884** (2026-09-11): Update mcp_server/uv.lock to fix httpx2/httpcore2 Dependabot alerts [ZEPAI-3570] (@pevans)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
