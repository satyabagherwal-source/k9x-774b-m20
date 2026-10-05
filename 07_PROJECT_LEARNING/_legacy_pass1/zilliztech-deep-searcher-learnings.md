# Forensic Learning Record (Deep Inspection): zilliztech/deep-searcher

> **Canonical Artifact**: `07_PROJECT_LEARNING/zilliztech-deep-searcher-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/zilliztech/deep-searcher](https://github.com/zilliztech/deep-searcher))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-09-30T18:49:33.011Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `zilliztech/deep-searcher`
- **Description**: Open Source Deep Research Alternative to Reason and Search on Private Data. Written in Python.
- **Primary Language / Ecosystem**: Python
- **Discovered Manifests / Configurations**: pyproject.toml, README.md, Dockerfile
- **Stars / Engagement**: 8291 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: pyproject.toml, README.md, Dockerfile.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `deepsearcher/__init__.py`
```
import os

# ignore the warnings
# None of PyTorch, TensorFlow >= 2.0, or Flax have been found. Models won't be available and only tokenizers, configuration and file/data utilities can be used.
os.environ["TRANSFORMERS_NO_ADVISORY_WARNINGS"] = "1"

```

### Core Architecture Module: `deepsearcher/agent/__init__.py`
```
from .base import BaseAgent, RAGAgent
from .chain_of_rag import ChainOfRAG
from .deep_search import DeepSearch
from .naive_rag import NaiveRAG

__all__ = [
    "ChainOfRAG",
    "DeepSearch",
    "NaiveRAG",
    "BaseAgent",
    "RAGAgent",
]

```

### Core Architecture Module: `deepsearcher/agent/base.py`
```
from abc import ABC
from typing import Any, List, Tuple

from deepsearcher.vector_db import RetrievalResult


def describe_class(description):
    """
    Decorator function to add a description to a class.

    This decorator adds a __description__ attribute to the decorated class,
    which can be used for documentation or introspection.

    Args:
        description: The description to add to the class.

    Returns:
        A decorator function that adds the description to the class.
    """

    def decorator(cls):
        cls.__description__ = description
        return cls

    return decorator


class BaseAgent(ABC):
    """
    Abstract base class for all agents in the DeepSearcher system.

    This class defines the basic interface for agents, including initialization
    and invocation methods.
    """

    def __init__(self, **kwargs):
        """
        Initialize a BaseAgent object.

        Args:
            **kwargs: Arbitrary keyword arguments.
        """
        pass

    def invoke(self, query: str, **kwargs) -> Any:
        """
        Invoke the agent and return the result.

        Args:
            query: The query string.
            **kwargs: Additional keyword arguments.

        Returns:
            The result of invoking the agent.
        """


class RAGAgent(BaseAgent):
    """
    Abstract base class for Retrieval-Augmented Generation (RAG) agents.

    This class extends BaseAgent with methods specific to RAG, including
    retrieval and query methods.
    """

    def __init__(self, **kwargs):
        """
        Initialize a RAGAgent object.

        Args:
            **kwargs: Arbitrary keyword arguments.
        """
        pass

    def retrieve(self, query: str, **kwargs) -> Tuple[List[RetrievalResult], int, dict]:
        """
        Retrieve document results from the knowledge base.

        Args:
            query: The query string.
            **kwargs: Additional keyword arguments.

        Returns:
            A tuple containing:
                - the retrieved results
                - the total number of token usages of the LLM
                - any additional metadata, which can be an empty dictionary
        """

    def query(self, query: str, **kwargs) -> Tuple[str, List[RetrievalResult], int]:
        """
        Query the agent and return the answer.

        Args:
            query: The query string.
            **kwargs: Additional keyword arguments.

        Returns:
            A tuple containing:
                - the result generated from LLM
                - the retrieved document results
                - the total number of token usages of the LLM
        """

```

### Core Architecture Module: `deepsearcher/agent/chain_of_rag.py`
```
from typing import List, Tuple

from deepsearcher.agent.base import RAGAgent, describe_class
from deepsearcher.agent.collection_router import CollectionRouter
from deepsearcher.embedding.base import BaseEmbedding
from deepsearcher.llm.base import BaseLLM
from deepsearcher.utils import log
from deepsearcher.vector_db import RetrievalResult
from deepsearcher.vector_db.base import BaseVectorDB, deduplicate_results

FOLLOWUP_QUERY_PROMPT = """You are using a search tool to answer the main query by iteratively searching the database. Given the following intermediate queries and answers, generate a new simple follow-up question that can help answer the main query. You may rephrase or decompose the main query when previous answers are not helpful. Ask simple follow-up questions only as the search tool may not understand complex questions.

## Previous intermediate queries and answers
{intermediate_context}

## Main query to answer
{query}

Respond with a simple follow-up question that will help answer the main query, do not explain yourself or output anything else.
"""

INTERMEDIATE_ANSWER_PROMPT = """Given the following documents, generate an appropriate answer for the query. DO NOT hallucinate any information, only use the provided documents to generate the answer. Respond "No relevant information found" if the documents do not contain useful information.

## Documents
{retrieved_documents}

## Query
{sub_query}

Respond with a concise answer only, do not explain yourself or output anything else.
"""

FINAL_ANSWER_PROMPT = """Given the following intermediate queries and answers, generate a final answer for the main query by combining relevant information. Note that intermediate answers are generated by an LLM and may not always be accurate.

## Documents
{retrieved_documents}

## Intermediate queries and answers
{intermediate_context}

## Main query
{query}

Respond with an appropriate answer only, do not explain yourself or output anything else.
"""

REFLECTION_PROMPT = """Given the following intermediate queries and answers, judge whether you have enough information to answer the main query. If you believe you have enough information, respond with "Yes", otherwise respond with "No".

## Intermediate queries and answers
{intermediate_context}

## Main query
{query}

Respond with "Yes" or "No" only, do not explain yourself or output anything else.
"""

GET_SUPPORTED_DOCS_PROMPT = """Given the following documents, select the ones that are support the Q-A pair.

## Documents
{retrieved_documents}

## Q-A Pair
### Question
{query}
### Answer
{answer}

Respond with a python list of indices of the selected documents.
"""


@describe_class(
    "This agent can decompose complex queries and gradually find the fact information of sub-queries. "
    "It is very suitable for handling concrete factual queries and multi-hop questions."
)
class ChainOfRAG(RAGAgent):
    """
    Chain of Retrieval-Augmented Generation (RAG) agent implementation.

    This agent implements a multi-step RAG process where each step can refine
    the query and retrieval process based on previous results, creating a chain
    of increasingly focused and relevant information retrieval and generation.
    Inspired by: https://arxiv.org/pdf/2501.14342

    """

    def __init__(
        self,
        llm: BaseLLM,
        embedding_model: BaseEmbedding,
        vector_db: BaseVectorDB,
        max_iter: int = 4,
        early_stopping: bool = False,
        route_collection: bool = True,
        text_window_splitter: bool = True,
        **kwargs,
    ):
        """
        Initialize the ChainOfRAG agent with configuration parameters.

        Args:
            llm (BaseLLM): The language model to use for generating answers.
            embedding_model (BaseEmbedding): The embedding model to use for embedding queries.
            vector_db (BaseVectorDB): The vector database to search for relevant documents.
            max_iter (int, optional): The maximum number of iterations for the RAG process. Defaults to 4.
            early_stopping (bool, optional): Whether to use early stopping. Defaults to False.
            route_collection (bool, optional): Whether to route the query to specific collections. Defaults to True.
            text_window_splitter (bool, optional): Whether use text_window splitter. Defaults to True.
        """
        self.llm = llm
        self.embedding_model = embedding_model
        self.vector_db = vector_db
        self.max_iter = max_iter
        self.early_stopping = early_stopping
        self.route_collection = route_collection
        self.collection_router = CollectionRouter(
            llm=self.llm, vector_db=self.vector_db, dim=embedding_model.dimension
        )
        self.text_window_splitter = text_window_splitter

    def _reflect_get_subquery(self, query: str, intermediate_context: List[str]) -> Tuple[str, int]:
        chat_response = self.llm.chat(
            [
                {
                    "role": "user",
                    "content": FOLLOWUP_QUERY_PROMPT.format(
                        query=query,
                        intermediate_context="\n".join(intermediate_context),
                    ),
                }
            ]
        )
        return self.llm.remove_think(chat_response.content), chat_response.total_tokens

    def _retrieve_and_answer(self, query: str) -> Tuple[str, List[RetrievalResult], int]:
        consume_tokens = 0
        if self.route_collection:
            selected_collections, n_token_route = self.collection_router.invoke(
                query=query, dim=self.embedding_model.dimension
            )
        else:
            selected_collections = self.collection_router.all_collections
            n_token_route = 0
        consume_tokens += n_token_route
        all_retrieved_results = []
        for collection in selected_collections:
            log.color_print(f"<search> Search [{query}] in [{collection}]...  </search>\n")
            query_vector = self.embedding_model.embed_query(query)
            retrieved_results = self.vector_db.search_data(
                collection=collection, vector=query_vector, query_text=query
            )
            all_retrieved_results.extend(retrieved_results)
        all_retrieved_results = deduplicate_results(all_retrieved_results)
        chat_response = self.llm.chat(
            [
                {
                    "role": "user",
                    "content": INTERMEDIATE_ANSWER_PROMPT.format(
                        retrieved_documents=self._format_retrieved_results(all_retrieved_results),
                        sub_query=query,
                    ),
                }
            ]
        )
        return (
            self.llm.remove_think(chat_response.content),
            all_retrieved_results,
            consume_tokens + chat_response.total_tokens,
        )

    def _get_supported_docs(
        self,
        retrieved_results: List[RetrievalResult],
        query: str,
        intermediate_answer: str,
    ) -> Tuple[List[RetrievalResult], int]:
        supported_retrieved_results = []
        token_usage = 0
        if "No relevant information found" not in intermediate_answer:
            chat_response = self.llm.chat(
                [
                    {
                        "role": "user",
                        "content": GET_SUPPORTED_DOCS_PROMPT.format(
                            retrieved_documents=self._format_retrieved_results(retrieved_results),
                            query=query,
                            answer=intermediate_answer,
                        ),
                    }
                ]
            )
            supported_doc_indices = self.llm.literal_eval(chat_response.content)
            supported_retrieved_results = [
                retrieved_results[int(i)]
                for i in supported_doc_indices
                if int(i) < len(retrieved_results)
            ]
            token_usage = ch
```

### Core Architecture Module: `deepsearcher/agent/collection_router.py`
```
from typing import List, Tuple

from deepsearcher.agent.base import BaseAgent
from deepsearcher.llm.base import BaseLLM
from deepsearcher.utils import log
from deepsearcher.vector_db.base import BaseVectorDB

COLLECTION_ROUTE_PROMPT = """
I provide you with collection_name(s) and corresponding collection_description(s). Please select the collection names that may be related to the question and return a python list of str. If there is no collection related to the question, you can return an empty list.

"QUESTION": {question}
"COLLECTION_INFO": {collection_info}

When you return, you can ONLY return a python list of str, WITHOUT any other additional content. Your selected collection name list is:
"""


class CollectionRouter(BaseAgent):
    """
    Routes queries to appropriate collections in the vector database.

    This class analyzes the content of a query and determines which collections
    in the vector database are most likely to contain relevant information.
    """

    def __init__(self, llm: BaseLLM, vector_db: BaseVectorDB, dim: int, **kwargs):
        """
        Initialize the CollectionRouter.

        Args:
            llm: The language model to use for analyzing queries.
            vector_db: The vector database containing the collections.
            dim: The dimension of the vector space to search in.
        """
        self.llm = llm
        self.vector_db = vector_db
        self.all_collections = [
            collection_info.collection_name
            for collection_info in self.vector_db.list_collections(dim=dim)
        ]

    def invoke(self, query: str, dim: int, **kwargs) -> Tuple[List[str], int]:
        """
        Determine which collections are relevant for the given query.

        This method analyzes the query content and selects collections that are
        most likely to contain information relevant to answering the query.

        Args:
            query (str): The query to analyze.
            dim (int): The dimension of the vector space to search in.

        Returns:
            Tuple[List[str], int]: A tuple containing:
                - A list of selected collection names
                - The token usage for the routing operation
        """
        consume_tokens = 0
        collection_infos = self.vector_db.list_collections(dim=dim)
        if len(collection_infos) == 0:
            log.warning(
                "No collections found in the vector database. Please check the database connection."
            )
            return [], 0
        if len(collection_infos) == 1:
            the_only_collection = collection_infos[0].collection_name
            log.color_print(
                f"<think> Perform search [{query}] on the vector DB collection: {the_only_collection} </think>\n"
            )
            return [the_only_collection], 0
        vector_db_search_prompt = COLLECTION_ROUTE_PROMPT.format(
            question=query,
            collection_info=[
                {
                    "collection_name": collection_info.collection_name,
                    "collection_description": collection_info.description,
                }
                for collection_info in collection_infos
            ],
        )
        chat_response = self.llm.chat(
            messages=[{"role": "user", "content": vector_db_search_prompt}]
        )
        selected_collections = self.llm.literal_eval(chat_response.content)
        consume_tokens += chat_response.total_tokens

        for collection_info in collection_infos:
            # If a collection description is not provided, use the query as the search query
            if not collection_info.description:
                selected_collections.append(collection_info.collection_name)
            # If the default collection exists, use the query as the search query
            if self.vector_db.default_collection == collection_info.collection_name:
                selected_collections.append(collection_info.collection_name)
        selected_collections = list(set(selected_collections))
        log.color_print(
            f"<think> Perform search [{query}] on the vector DB collections: {selected_collections} </think>\n"
        )
        return selected_collections, consume_tokens

```

### Core Architecture Module: `deepsearcher/agent/deep_search.py`
```
import asyncio
from typing import List, Tuple

from deepsearcher.agent.base import RAGAgent, describe_class
from deepsearcher.agent.collection_router import CollectionRouter
from deepsearcher.embedding.base import BaseEmbedding
from deepsearcher.llm.base import BaseLLM
from deepsearcher.utils import log
from deepsearcher.vector_db import RetrievalResult
from deepsearcher.vector_db.base import BaseVectorDB, deduplicate_results

SUB_QUERY_PROMPT = """To answer this question more comprehensively, please break down the original question into up to four sub-questions. Return as list of str.
If this is a very simple question and no decomposition is necessary, then keep the only one original question in the python code list.

Original Question: {original_query}


<EXAMPLE>
Example input:
"Explain deep learning"

Example output:
[
    "What is deep learning?",
    "What is the difference between deep learning and machine learning?",
    "What is the history of deep learning?"
]
</EXAMPLE>

Provide your response in a python code list of str format:
"""

RERANK_PROMPT = """Based on the query questions and the retrieved chunk, to determine whether the chunk is helpful in answering any of the query question, you can only return "YES" or "NO", without any other information.

Query Questions: {query}
Retrieved Chunk: {retrieved_chunk}

Is the chunk helpful in answering the any of the questions?
"""


REFLECT_PROMPT = """Determine whether additional search queries are needed based on the original query, previous sub queries, and all retrieved document chunks. If further research is required, provide a Python list of up to 3 search queries. If no further research is required, return an empty list.

If the original query is to write a report, then you prefer to generate some further queries, instead return an empty list.

Original Query: {question}

Previous Sub Queries: {mini_questions}

Related Chunks: 
{mini_chunk_str}

Respond exclusively in valid List of str format without any other text."""


SUMMARY_PROMPT = """You are a AI content analysis expert, good at summarizing content. Please summarize a specific and detailed answer or report based on the previous queries and the retrieved document chunks.

Original Query: {question}

Previous Sub Queries: {mini_questions}

Related Chunks: 
{mini_chunk_str}

"""


@describe_class(
    "This agent is suitable for handling general and simple queries, such as given a topic and then writing a report, survey, or article."
)
class DeepSearch(RAGAgent):
    """
    Deep Search agent implementation for comprehensive information retrieval.

    This agent performs a thorough search through the knowledge base, analyzing
    multiple aspects of the query to provide comprehensive and detailed answers.
    """

    def __init__(
        self,
        llm: BaseLLM,
        embedding_model: BaseEmbedding,
        vector_db: BaseVectorDB,
        max_iter: int = 3,
        route_collection: bool = True,
        text_window_splitter: bool = True,
        **kwargs,
    ):
        """
        Initialize the DeepSearch agent.

        Args:
            llm: The language model to use for generating answers.
            embedding_model: The embedding model to use for query embedding.
            vector_db: The vector database to search for relevant documents.
            max_iter: The maximum number of iterations for the search process.
            route_collection: Whether to use a collection router for search.
            text_window_splitter: Whether to use text_window splitter.
            **kwargs: Additional keyword arguments for customization.
        """
        self.llm = llm
        self.embedding_model = embedding_model
        self.vector_db = vector_db
        self.max_iter = max_iter
        self.route_collection = route_collection
        self.collection_router = CollectionRouter(
            llm=self.llm, vector_db=self.vector_db, dim=embedding_model.dimension
        )
        self.text_window_splitter = text_window_splitter

    def _generate_sub_queries(self, original_query: str) -> Tuple[List[str], int]:
        chat_response = self.llm.chat(
            messages=[
                {"role": "user", "content": SUB_QUERY_PROMPT.format(original_query=original_query)}
            ]
        )
        response_content = self.llm.remove_think(chat_response.content)
        return self.llm.literal_eval(response_content), chat_response.total_tokens

    async def _search_chunks_from_vectordb(self, query: str, sub_queries: List[str]):
        consume_tokens = 0
        if self.route_collection:
            selected_collections, n_token_route = self.collection_router.invoke(
                query=query, dim=self.embedding_model.dimension
            )
        else:
            selected_collections = self.collection_router.all_collections
            n_token_route = 0
        consume_tokens += n_token_route

        all_retrieved_results = []
        query_vector = self.embedding_model.embed_query(query)
        for collection in selected_collections:
            log.color_print(f"<search> Search [{query}] in [{collection}]...  </search>\n")
            retrieved_results = self.vector_db.search_data(
                collection=collection, vector=query_vector, query_text=query
            )
            if not retrieved_results or len(retrieved_results) == 0:
                log.color_print(
                    f"<search> No relevant document chunks found in '{collection}'! </search>\n"
                )
                continue
            accepted_chunk_num = 0
            references = set()
            for retrieved_result in retrieved_results:
                chat_response = self.llm.chat(
                    messages=[
                        {
                            "role": "user",
                            "content": RERANK_PROMPT.format(
                                query=[query] + sub_queries,
                                retrieved_chunk=f"<chunk>{retrieved_result.text}</chunk>",
                            ),
                        }
                    ]
                )
                consume_tokens += chat_response.total_tokens
                response_content = self.llm.remove_think(chat_response.content).strip()
                if "YES" in response_content and "NO" not in response_content:
                    all_retrieved_results.append(retrieved_result)
                    accepted_chunk_num += 1
                    references.add(retrieved_result.reference)
            if accepted_chunk_num > 0:
                log.color_print(
                    f"<search> Accept {accepted_chunk_num} document chunk(s) from references: {list(references)} </search>\n"
                )
            else:
                log.color_print(
                    f"<search> No document chunk accepted from '{collection}'! </search>\n"
                )
        return all_retrieved_results, consume_tokens

    def _generate_gap_queries(
        self, original_query: str, all_sub_queries: List[str], all_chunks: List[RetrievalResult]
    ) -> Tuple[List[str], int]:
        reflect_prompt = REFLECT_PROMPT.format(
            question=original_query,
            mini_questions=all_sub_queries,
            mini_chunk_str=self._format_chunk_texts([chunk.text for chunk in all_chunks])
            if len(all_chunks) > 0
            else "NO RELATED CHUNKS FOUND.",
        )
        chat_response = self.llm.chat([{"role": "user", "content": reflect_prompt}])
        response_content = self.llm.remove_think(chat_response.content)
        return self.llm.literal_eval(response_content), chat_response.total_tokens

    def retrieve(self, original_query: str, **kwargs) -> Tuple[List[RetrievalResult], int, dict]:
        """
        Retrieve relevant documents from the knowledge base for the given query.

        This method performs a deep search through the vector database to find
        the most relevant documents for answering the query
```

### Core Architecture Module: `deepsearcher/agent/naive_rag.py`
```
from typing import List, Tuple

from deepsearcher.agent.base import RAGAgent
from deepsearcher.agent.collection_router import CollectionRouter
from deepsearcher.embedding.base import BaseEmbedding
from deepsearcher.llm.base import BaseLLM
from deepsearcher.utils import log
from deepsearcher.vector_db.base import BaseVectorDB, RetrievalResult, deduplicate_results

SUMMARY_PROMPT = """You are a AI content analysis expert, good at summarizing content. Please summarize a specific and detailed answer or report based on the previous queries and the retrieved document chunks.

Original Query: {query}

Related Chunks: 
{mini_chunk_str}
"""


class NaiveRAG(RAGAgent):
    """
    Naive Retrieval-Augmented Generation agent implementation.

    This agent implements a straightforward RAG approach, retrieving relevant
    documents and generating answers without complex processing or refinement steps.
    """

    def __init__(
        self,
        llm: BaseLLM,
        embedding_model: BaseEmbedding,
        vector_db: BaseVectorDB,
        top_k: int = 10,
        route_collection: bool = True,
        text_window_splitter: bool = True,
        **kwargs,
    ):
        """
        Initialize the NaiveRAG agent.

        Args:
            llm: The language model to use for generating answers.
            embedding_model: The embedding model to use for query embedding.
            vector_db: The vector database to search for relevant documents.
            **kwargs: Additional keyword arguments for customization.
        """
        self.llm = llm
        self.embedding_model = embedding_model
        self.vector_db = vector_db
        self.top_k = top_k
        self.route_collection = route_collection
        if self.route_collection:
            self.collection_router = CollectionRouter(
                llm=self.llm, vector_db=self.vector_db, dim=embedding_model.dimension
            )
        self.text_window_splitter = text_window_splitter

    def retrieve(self, query: str, **kwargs) -> Tuple[List[RetrievalResult], int, dict]:
        """
        Retrieve relevant documents from the knowledge base for the given query.

        This method performs a basic search through the vector database to find
        documents relevant to the query.

        Args:
            query (str): The query to search for.
            **kwargs: Additional keyword arguments for customizing the retrieval.

        Returns:
            Tuple[List[RetrievalResult], int, dict]: A tuple containing:
                - A list of retrieved document results
                - The token usage for the retrieval operation
                - Additional information about the retrieval process
        """
        consume_tokens = 0
        if self.route_collection:
            selected_collections, n_token_route = self.collection_router.invoke(
                query=query, dim=self.embedding_model.dimension
            )
        else:
            selected_collections = self.collection_router.all_collections
            n_token_route = 0
        consume_tokens += n_token_route
        all_retrieved_results = []
        for collection in selected_collections:
            retrieval_res = self.vector_db.search_data(
                collection=collection,
                vector=self.embedding_model.embed_query(query),
                top_k=max(self.top_k // len(selected_collections), 1),
                query_text=query,
            )
            all_retrieved_results.extend(retrieval_res)
        all_retrieved_results = deduplicate_results(all_retrieved_results)
        return all_retrieved_results, consume_tokens, {}

    def query(self, query: str, **kwargs) -> Tuple[str, List[RetrievalResult], int]:
        """
        Query the agent and generate an answer based on retrieved documents.

        This method retrieves relevant documents and uses the language model
        to generate a simple answer to the query.

        Args:
            query (str): The query to answer.
            **kwargs: Additional keyword arguments for customizing the query process.

        Returns:
            Tuple[str, List[RetrievalResult], int]: A tuple containing:
                - The generated answer
                - A list of retrieved document results
                - The total token usage
        """
        all_retrieved_results, n_token_retrieval, _ = self.retrieve(query)
        chunk_texts = []
        for chunk in all_retrieved_results:
            if self.text_window_splitter and "wider_text" in chunk.metadata:
                chunk_texts.append(chunk.metadata["wider_text"])
            else:
                chunk_texts.append(chunk.text)
        mini_chunk_str = ""
        for i, chunk in enumerate(chunk_texts):
            mini_chunk_str += f"""<chunk_{i}>\n{chunk}\n</chunk_{i}>\n"""

        summary_prompt = SUMMARY_PROMPT.format(query=query, mini_chunk_str=mini_chunk_str)
        char_response = self.llm.chat([{"role": "user", "content": summary_prompt}])
        final_answer = char_response.content
        log.color_print("\n==== FINAL ANSWER====\n")
        log.color_print(final_answer)
        return final_answer, all_retrieved_results, n_token_retrieval + char_response.total_tokens

```

### Core Architecture Module: `deepsearcher/agent/rag_router.py`
```
from typing import List, Optional, Tuple

from deepsearcher.agent import RAGAgent
from deepsearcher.llm.base import BaseLLM
from deepsearcher.utils import log
from deepsearcher.vector_db import RetrievalResult

RAG_ROUTER_PROMPT = """Given a list of agent indexes and corresponding descriptions, each agent has a specific function. 
Given a query, select only one agent that best matches the agent handling the query, and return the index without any other information.

## Question
{query}

## Agent Indexes and Descriptions
{description_str}

Only return one agent index number that best matches the agent handling the query:
"""


class RAGRouter(RAGAgent):
    """
    Routes queries to the most appropriate RAG agent implementation.

    This class analyzes the content and requirements of a query and determines
    which RAG agent implementation is best suited to handle it.
    """

    def __init__(
        self,
        llm: BaseLLM,
        rag_agents: List[RAGAgent],
        agent_descriptions: Optional[List[str]] = None,
    ):
        """
        Initialize the RAGRouter.

        Args:
            llm: The language model to use for analyzing queries.
            rag_agents: A list of RAGAgent instances.
            agent_descriptions (list, optional): A list of descriptions for each agent.
        """
        self.llm = llm
        self.rag_agents = rag_agents
        self.agent_descriptions = agent_descriptions
        if not self.agent_descriptions:
            try:
                self.agent_descriptions = [
                    agent.__class__.__description__ for agent in self.rag_agents
                ]
            except Exception:
                raise AttributeError(
                    "Please provide agent descriptions or set __description__ attribute for each agent class."
                )

    def _route(self, query: str) -> Tuple[RAGAgent, int]:
        description_str = "\n".join(
            [f"[{i + 1}]: {description}" for i, description in enumerate(self.agent_descriptions)]
        )
        prompt = RAG_ROUTER_PROMPT.format(query=query, description_str=description_str)
        chat_response = self.llm.chat(messages=[{"role": "user", "content": prompt}])
        try:
            selected_agent_index = int(self.llm.remove_think(chat_response.content)) - 1
        except ValueError:
            # In some reasoning LLM, the output is not a number, but a explaination string with a number in the end.
            log.warning(
                "Parse int failed in RAGRouter, but will try to find the last digit as fallback."
            )
            selected_agent_index = (
                int(self.find_last_digit(self.llm.remove_think(chat_response.content))) - 1
            )

        selected_agent = self.rag_agents[selected_agent_index]
        log.color_print(
            f"<think> Select agent [{selected_agent.__class__.__name__}] to answer the query [{query}] </think>\n"
        )
        return self.rag_agents[selected_agent_index], chat_response.total_tokens

    def retrieve(self, query: str, **kwargs) -> Tuple[List[RetrievalResult], int, dict]:
        agent, n_token_router = self._route(query)
        retrieved_results, n_token_retrieval, metadata = agent.retrieve(query, **kwargs)
        return retrieved_results, n_token_router + n_token_retrieval, metadata

    def query(self, query: str, **kwargs) -> Tuple[str, List[RetrievalResult], int]:
        agent, n_token_router = self._route(query)
        answer, retrieved_results, n_token_retrieval = agent.query(query, **kwargs)
        return answer, retrieved_results, n_token_router + n_token_retrieval

    def find_last_digit(self, string):
        for char in reversed(string):
            if char.isdigit():
                return char
        raise ValueError("No digit found in the string")

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #274** (2026-09-22): **Add reproducible Jev search-stopping evaluation**
  *Symptoms*: ## Summary  Add a lightweight, reproducible evaluation of DeepSeek and Jev for the ChainOfRAG search-stopping decision. On 100 stratified 2WikiMultiHopQA questions, both policies reach 93.25% Recall@5 with nearly identical search depth. Recorded median decision response time is 2.23 s versus 0.55 s; estimated decision cost is $0.0446 versus $0.0059 per 100 questions.  Both policies are replayed on the same 700 search states, with a seven-round maximum. This measures evidence retrieval and stopping behavior, not final-answer accuracy or independently timed end-to-end search.  ## Repository contents  Keep the runner, retry/checkpoint tests, offline replay and plotting code, frozen prompts/configuration, compact aggregate results, and one PNG chart. Historical evaluations and the default agent are unchanged. Jev is available in this experiment only; this does not add a production stopping-policy configuration.  The additional retrieval corpus, per-query results, per-round traces, and request records are **not included in the PR**. `fetch_artifacts.py` downloads them on demand from the original experiment's immutable commit on the contributor fork. `artifact_manifest.json` pins file sizes and SHA-256 hashes. Downloads remain under ignored `artifacts/`; existing verified files are reused. No new dependencies are added to the application.  ## Reproduction  From `evaluation/jev_stopping`:  ```bash uv run python fetch_artifacts.py uv run python replay_results.py uv run python -m unit
  **Post-Mortem & Fix Analysis**:
  > [APPROVALNOTIFIER] This PR is **APPROVED**  This pull-request has been approved by: *<a href="https://github.com/zilliztech/deep-searcher/pull/274#" title="Author self-approved">zc277584121</a>*  The full list of commands accepted by this bot can be found [here](https://go.k8s.io/bot-commands?repo=zilliztech%2Fdeep-searcher).  The pull request process is described [here](https://git.k8s.io/community/contributors/guide/owners.md#the-code-review-process)  <details > Needs approval from an approver in each of these files:  - ~~[OWNERS](https://github.com/zilliztech/deep-searcher/blob/master/OWNERS)~~ [zc277584121]  Approvers can indicate their approval by writing `/approve` in a comment Approvers can cancel approval by writing `/approve cancel` in a comment </details> <!-- META={"approvers":[]} -->

- **Issue #260** (2026-03-20): **feat: add MiniMax as LLM and embedding provider**
  *Symptoms*: ## Summary  Add [MiniMax](https://platform.minimaxi.com) as a first-class LLM and embedding provider for DeepSearcher.  ### LLM Provider - New `MiniMax` class in `deepsearcher/llm/minimax.py` using OpenAI-compatible API - Default model: `MiniMax-M2.7` (also supports M2.5, M2.5-highspeed) - Base URL: `https://api.minimax.io/v1` - API key via `MINIMAX_API_KEY` env var or `api_key` parameter  ### Embedding Provider - New `MiniMaxEmbedding` class in `deepsearcher/embedding/minimax_embedding.py` - Uses MiniMax's native embedding API with `embo-01` model (1536 dimensions) - Supports distinct `db` and `query` embedding types for optimal retrieval - Batch processing support with configurable batch size  ### Changes - `deepsearcher/llm/minimax.py` - LLM provider implementation - `deepsearcher/embedding/minimax_embedding.py` - Embedding provider implementation - `deepsearcher/llm/__init__.py` - Register MiniMax LLM - `deepsearcher/embedding/__init__.py` - Register MiniMaxEmbedding - `deepsearcher/config.yaml` - Add MiniMax configuration examples - `README.md` - Add MiniMax to provider lists and usage examples - `tests/llm/test_minimax.py` - 8 unit tests for LLM provider - `tests/embedding/test_minimax_embedding.py` - 9 unit tests for embedding provider - `tests/llm/test_minimax_integration.py` - 3 integration tests (requires API key) - `tests/embedding/test_minimax_embedding_integration.py` - 3 integration tests (requires API key)  ## Test Plan  - [x] All 17 unit tests pass (`pytest te
  **Post-Mortem & Fix Analysis**:
  > [APPROVALNOTIFIER] This PR is **NOT APPROVED**  This pull-request has been approved by: *<a href="https://github.com/zilliztech/deep-searcher/pull/260#" title="Author self-approved">octo-patch</a>* To complete the [pull request process](https://git.k8s.io/community/contributors/guide/owners.md#the-code-review-process), please assign **xiaofan-luan** after the PR has been reviewed. You can assign the PR to them by writing `/assign @xiaofan-luan` in a comment when ready.  The full list of commands accepted by this bot can be found [here](https://go.k8s.io/bot-commands?repo=zilliztech%2Fdeep-searcher).  <details open> Needs approval from an approver in each of these files:  - **[OWNERS](https://github.com/zilliztech/deep-searcher/blob/master/OWNERS)**  Approvers can indicate their approval by writing `/approve` in a comment Approvers can cancel approval by writing `/approve cancel` in a comment </details> <!-- META={"approvers":["xiaofan-luan"]} -->
  > Welcome @octo-patch! It looks like this is your first PR to zilliztech/deep-searcher 🎉

- **Issue #259** (2026-02-11): **Fix default model regressions and document bug fixes**
  *Symptoms*: 
  **Post-Mortem & Fix Analysis**:
  > [APPROVALNOTIFIER] This PR is **NOT APPROVED**  This pull-request has been approved by: *<a href="https://github.com/zilliztech/deep-searcher/pull/259#" title="Author self-approved">TheCoder2010-create</a>* To complete the [pull request process](https://git.k8s.io/community/contributors/guide/owners.md#the-code-review-process), please assign **xiaofan-luan** after the PR has been reviewed. You can assign the PR to them by writing `/assign @xiaofan-luan` in a comment when ready.  The full list of commands accepted by this bot can be found [here](https://go.k8s.io/bot-commands?repo=zilliztech%2Fdeep-searcher).  <details open> Needs approval from an approver in each of these files:  - **[OWNERS](https://github.com/zilliztech/deep-searcher/blob/master/OWNERS)**  Approvers can indicate their approval by writing `/approve` in a comment Approvers can cancel approval by writing `/approve cancel` in a comment </details> <!-- META={"approvers":["xiaofan-luan"]} -->
  > Welcome @TheCoder2010-create! It looks like this is your first PR to zilliztech/deep-searcher 🎉

- **Issue #257** (2025-11-19): **feat: add new llm and embedding provider JiekouAI**
  *Symptoms*: 
  **Post-Mortem & Fix Analysis**:
  > [APPROVALNOTIFIER] This PR is **NOT APPROVED**  This pull-request has been approved by: *<a href="https://github.com/zilliztech/deep-searcher/pull/257#" title="Author self-approved">cnJasonZ</a>* To complete the [pull request process](https://git.k8s.io/community/contributors/guide/owners.md#the-code-review-process), please assign **zc277584121** after the PR has been reviewed. You can assign the PR to them by writing `/assign @zc277584121` in a comment when ready.  The full list of commands accepted by this bot can be found [here](https://go.k8s.io/bot-commands?repo=zilliztech%2Fdeep-searcher).  <details open> Needs approval from an approver in each of these files:  - **[OWNERS](https://github.com/zilliztech/deep-searcher/blob/master/OWNERS)**  Approvers can indicate their approval by writing `/approve` in a comment Approvers can cancel approval by writing `/approve cancel` in a comment </details> <!-- META={"approvers":["zc277584121"]} -->

- **Issue #253** (2025-07-10): **add grok-4 model**
  *Symptoms*: 
  **Post-Mortem & Fix Analysis**:
  > /lgtm /approve
  > [APPROVALNOTIFIER] This PR is **APPROVED**  This pull-request has been approved by: *<a href="https://github.com/zilliztech/deep-searcher/pull/253#issuecomment-3057288307" title="Approved">SimFG</a>*, *<a href="https://github.com/zilliztech/deep-searcher/pull/253#" title="Author self-approved">zc277584121</a>*  The full list of commands accepted by this bot can be found [here](https://go.k8s.io/bot-commands?repo=zilliztech%2Fdeep-searcher).  The pull request process is described [here](https://git.k8s.io/community/contributors/guide/owners.md#the-code-review-process)  <details > Needs approval from an approver in each of these files:  - ~~[OWNERS](https://github.com/zilliztech/deep-searcher/blob/master/OWNERS)~~ [SimFG,zc277584121]  Approvers can indicate their approval by writing `/approve` in a comment Approvers can cancel approval by writing `/approve cancel` in a comment </details> <!-- META={"approvers":[]} -->

- **Issue #252** (2025-07-09): **add deepwiki badge**
  *Symptoms*: 
  **Post-Mortem & Fix Analysis**:
  > /lgtm /approve
  > [APPROVALNOTIFIER] This PR is **APPROVED**  This pull-request has been approved by: *<a href="https://github.com/zilliztech/deep-searcher/pull/252#issuecomment-3051036373" title="Approved">SimFG</a>*, *<a href="https://github.com/zilliztech/deep-searcher/pull/252#" title="Author self-approved">zc277584121</a>*  The full list of commands accepted by this bot can be found [here](https://go.k8s.io/bot-commands?repo=zilliztech%2Fdeep-searcher).  The pull request process is described [here](https://git.k8s.io/community/contributors/guide/owners.md#the-code-review-process)  <details > Needs approval from an approver in each of these files:  - ~~[OWNERS](https://github.com/zilliztech/deep-searcher/blob/master/OWNERS)~~ [SimFG,zc277584121]  Approvers can indicate their approval by writing `/approve` in a comment Approvers can cancel approval by writing `/approve cancel` in a comment </details> <!-- META={"approvers":[]} -->

- **Issue #251** (2025-07-04): **support more ollama embeddingmodels**
  *Symptoms*: support more ollama embeddingmodels  related issue: https://github.com/zilliztech/deep-searcher/issues/247
  **Post-Mortem & Fix Analysis**:
  > [APPROVALNOTIFIER] This PR is **APPROVED**  This pull-request has been approved by: *<a href="https://github.com/zilliztech/deep-searcher/pull/251#" title="Author self-approved">zc277584121</a>*  The full list of commands accepted by this bot can be found [here](https://go.k8s.io/bot-commands?repo=zilliztech%2Fdeep-searcher).  The pull request process is described [here](https://git.k8s.io/community/contributors/guide/owners.md#the-code-review-process)  <details > Needs approval from an approver in each of these files:  - ~~[OWNERS](https://github.com/zilliztech/deep-searcher/blob/master/OWNERS)~~ [zc277584121]  Approvers can indicate their approval by writing `/approve` in a comment Approvers can cancel approval by writing `/approve cancel` in a comment </details> <!-- META={"approvers":[]} -->
  > /lgtm

- **Issue #249** (2025-06-18): **docs: Correct malformed URL references for uv installation**
  *Symptoms*: #### Description  This pull request resolves a minor typo in the documentation where the hyperlink to the official `uv` installation guide was malformed, leading to a 404 error.  #### Issue  * **Malformed URL:** `https://docs.astral.sh/uvgetting-started/installation/` * **Corrected URL:** `https://docs.astral.sh/uv/getting-started/installation/`  The broken link was present in the following files: * `README.md` * `docs/installation/development.md`  #### Changes Made  The malformed URL has been corrected in both locations to point to the proper address. No other changes are included in this pull request.  This contribution adheres to the guidelines outlined in `CONTRIBUTING.md`, and the commit has been signed-off to certify the Developer Certificate of Origin.
  **Post-Mortem & Fix Analysis**:
  > Welcome @JoeyBurzynski! It looks like this is your first PR to zilliztech/deep-searcher 🎉
  > /lgtm /approve
  > [APPROVALNOTIFIER] This PR is **APPROVED**  This pull-request has been approved by: *<a href="https://github.com/zilliztech/deep-searcher/pull/249#" title="Author self-approved">JoeyBurzynski</a>*, *<a href="https://github.com/zilliztech/deep-searcher/pull/249#issuecomment-2982886271" title="Approved">SimFG</a>*  The full list of commands accepted by this bot can be found [here](https://go.k8s.io/bot-commands?repo=zilliztech%2Fdeep-searcher).  The pull request process is described [here](https://git.k8s.io/community/contributors/guide/owners.md#the-code-review-process)  <details > Needs approval from an approver in each of these files:  - ~~[OWNERS](https://github.com/zilliztech/deep-searcher/blob/master/OWNERS)~~ [SimFG]  Approvers can indicate their approval by writing `/approve` in a comment Approvers can cancel approval by writing `/approve cancel` in a comment </details> <!-- META={"approvers":[]} -->

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

### Incident Patch 1: `d89e37cd` (2025-11-19)
**Commit Message**: fix: restore basic_example.py

**File**: `examples/basic_example.py` (modified, +5/-10)
```diff
@@ -1,6 +1,5 @@
 import logging
 import os
-import glob
 
 from deepsearcher.offline_loading import load_from_local_files
 from deepsearcher.online_query import query
@@ -12,8 +11,6 @@
 current_dir = os.path.dirname(os.path.abspath(__file__))
 
 config = Configuration()  # Customize your config here
-config.set_provider_config("llm", "JiekouAI", {"model": "claude-sonnet-4-5-20250929"})
-config.set_provider_config("embedding", "JiekouAIEmbedding", {"model": "qwen/qwen3-embedding-8b"})
 init_config(config=config)
 
 
@@ -26,15 +23,13 @@
 
 # Hint: You can also load a single file, please execute it in the root directory of the deep searcher project
 load_from_local_files(
-    paths_or_directory='/Users/jason/Documents/work/PPLabs/Platform/deep-searcher/examples/data/car_company_data.pdf',
-    collection_name="car_company_data",
-    collection_description="car_company_data",
-    force_new_collection=True, # If you want to drop origin collection and create a new collection every time, set force_new_collection to True
+    paths_or_directory=os.path.join(current_dir, "data/WhatisMilvus.pdf"),
+    collection_name="milvus_docs",
+    collection_description="All Milvus Documents",
+    # force_new_collection=True, # If you want to drop origin collection and create a new collection every time, set force_new_collection to True
 )
 
-question = """请从财务和宏观经济角度，对 A 股新能源汽车行业以及行业内 TOP5 车企的发展进行分析。在财务分析部分，需涵盖基本的财务关键指标。
-在宏观经济分析部分，考虑宏观经济指标对行业的影响，对 A 股新能源汽车行业整体发展趋势进行总结，并基于财务和宏观经济分析，对 TOP5 新能源车企的未来发展潜力和竞争态势做出比较和预测，指出各车企的优势与挑战。请以专业、严谨的语言，结合具体数据进行分析阐述。
-"""
+question = "Write a report comparing Milvus with other vector databases."
 
 _, _, consumed_token = query(question, max_iter=1)
 print(f"Consumed tokens: {consumed_token}")
```

---

### Incident Patch 2: `5ab7ad82` (2025-11-17)
**Commit Message**: fix: lint error

**File**: `deepsearcher/embedding/__init__.py` (modified, +1/-1)
```diff
@@ -28,6 +28,6 @@
     "FastEmbedEmbedding",
     "NovitaEmbedding",
     "SentenceTransformerEmbedding",
-    "WatsonXEmbedding", 
+    "WatsonXEmbedding",
     "JiekouAIEmbedding",
 ]
```

---

### Incident Patch 3: `747f6765` (2025-11-17)
**Commit Message**: fix: fix product name

**File**: `README.md` (modified, +9/-9)
```diff
@@ -96,7 +96,7 @@ result = query("Write a report about xxx.") # Your question here
 #### LLM Configuration
 
 <pre><code>config.set_provider_config("llm", "(LLMName)", "(Arguments dict)")</code></pre>
-<p>The "LLMName" can be one of the following: ["DeepSeek", "OpenAI", "XAI", "SiliconFlow", "Aliyun", "PPIO", "TogetherAI", "Gemini", "Ollama", "Novita", "JiekouAI"]</p>
+<p>The "LLMName" can be one of the following: ["DeepSeek", "OpenAI", "XAI", "SiliconFlow", "Aliyun", "PPIO", "TogetherAI", "Gemini", "Ollama", "Novita", "Jiekou.AI"]</p>
 <p> The "Arguments dict" is a dictionary that contains the necessary arguments for the LLM class.</p>
 
 <details>
@@ -174,10 +174,10 @@ result = query("Write a report about xxx.") # Your question here
 </details>
 
 <details>
-  <summary>Example (Claude Sonnet 4.5 from JiekouAI)</summary>
-    <p> Make sure you have prepared your JiekouAI API KEY as an env variable <code>JIEKOU_API_KEY</code>. You can create an API Key <a href="https://jiekou.ai/settings/key-management?utm_source=github_deep-searcher">here</a>. </p>
+  <summary>Example (Claude Sonnet 4.5 from Jiekou.AI)</summary>
+    <p> Make sure you have prepared your Jiekou.AI API KEY as an env variable <code>JIEKOU_API_KEY</code>. You can create an API Key <a href="https://jiekou.ai/settings/key-management?utm_source=github_deep-searcher">here</a>. </p>
     <pre><code>config.set_provider_config("llm", "JiekouAI", {"model": "claude-sonnet-4-5-20250929"})</code></pre>
-    <p> More details about JiekouAI: https://docs.jiekou.ai/docs/support/quickstart?utm_source=github_deep-searcher </p>
+    <p> More details about Jiekou.AI: https://docs.jiekou.ai/docs/support/quickstart?utm_source=github_deep-searcher </p>
 </details>
 
 <details>
@@ -316,10 +316,10 @@ result = query("Write a report about xxx.") # Your question here
 </details>
 
 <details>
-  <summary>Example (JiekouAI embedding)</summary>
-    <p> Make sure you have prepared your JiekouAI API KEY as an env variable <code>JIEKOU_API_KEY</code>.</p>
+  <summary>Example (Jiekou.AI embedding)</summary>
+    <p> Make sure you have prepared your Jiekou.AI API KEY as an env variable <code>JIEKOU_API_KEY</code>.</p>
     <pre><code>config.set_provider_config("embedding", "JiekouAIEmbedding", {"model": "qwen/qwen3-embedding-8b"})</code></pre>
-    <p> More details about JiekouAI: https://docs.jiekou.ai/docs/support/quickstart?utm_source=github_deep-searcher </p>
+    <p> More details about Jiekou.AI: https://docs.jiekou.ai/docs/support/quickstart?utm_source=github_deep-searcher </p>
 </details>
 
 <details>
@@ -561,7 +561,7 @@ nest_asyncio.apply()
 - [PPIO](https://ppinfra.com/model-api/product/llm-api?utm_source=github_deep-searcher) (`PPIO_API_KEY` env variable required)
 - [Novita AI](https://novita.ai/docs/api-reference/model-apis-llm-create-embeddings?utm_source=github_deep-searcher&utm_medium=github_readme&utm_campaign=link) (`NOVITA_API_KEY` env variable required)
 - [IBM watsonx.ai](https://www.ibm.com/products/watsonx-ai/foundation-models#ibmembedding) (`WATSONX_APIKEY`, `WATSONX_URL`, `WATSONX_PROJECT_ID` env variables required)
-- [JiekouAI](https://jiekou.ai/?utm_source=github_deep-searcher) (`JIEKOU_API_KEY` env variable required)
+- [Jiekou.AI](https://jiekou.ai/?utm_source=github_deep-searcher) (`JIEKOU_API_KEY` env variable required)
 
 ### 🔹 LLM Support
 - [OpenAI](https://platform.openai.com/docs/models) (`OPENAI_API_KEY` env variable required)
@@ -576,7 +576,7 @@ nest_asyncio.apply()
 - [Ollama](https://ollama.com/)
 - [Novita AI](https://novita.ai/docs/guides/introduction?utm_source=github_deep-searcher&utm_medium=github_readme&utm_campaign=link) (`NOVITA_API_KEY` env variable required)
 - [IBM watsonx.ai](https://www.ibm.com/products/watsonx-ai/foundation-models#ibmfm) (`WATSONX_APIKEY`, `WATSONX_URL`, `WATSONX_PROJECT_ID` env variable required)
-- [JiekouAI](https://jiekou.ai/?utm_source=github_deep-searcher) (`JIEKOU_API_KEY` env variable required)
+- [Jiekou.AI](https:/
```

**File**: `deepsearcher/config.yaml` (modified, +1/-1)
```diff
@@ -24,7 +24,7 @@ provide_settings:
 ##      api_key: "sk_xxxxxx"  # Uncomment to override the `PPIO_API_KEY` set in the environment variable
 ##      base_url: ""
 
-#    provider: "JiekouAI"
+#    provider: "Jiekou.AI"
 #    config:
 #      model: "claude-sonnet-4-5-20250929"
 ##      api_key: "xxxx"  # Uncomment to override the `JIEKOU_API_KEY` set in the environment variable
```

**File**: `deepsearcher/embedding/jiekouai_embedding.py` (modified, +5/-5)
```diff
@@ -5,7 +5,7 @@
 
 from deepsearcher.embedding.base import BaseEmbedding
 
-# TODO: Update with actual JiekouAI model dimensions when available
+# TODO: Update with actual Jiekou.AI model dimensions when available
 JIEKOUAI_MODEL_DIM_MAP = {
     "qwen/qwen3-embedding-0.6b": 1024,
     "qwen/qwen3-embedding-8b": 1024,
@@ -17,21 +17,21 @@
 
 class JiekouAIEmbedding(BaseEmbedding):
     """
-    JiekouAI embedding model implementation.
+    Jiekou.AI embedding model implementation.
 
-    This class provides an interface to the JiekouAI embedding API, which offers
+    This class provides an interface to the Jiekou.AI embedding API, which offers
     various embedding models for text processing.
     """
 
     def __init__(self, model="qwen/qwen3-embedding-8b", batch_size=32, **kwargs):
         """
-        Initialize the JiekouAI embedding model.
+        Initialize the Jiekou.AI embedding model.
 
         Args:
             model (str): The model identifier to use for embeddings. Default is "baai/bge-m3".
             batch_size (int): Maximum number of texts to process in a single batch. Default is 32.
             **kwargs: Additional keyword arguments.
-                - api_key (str, optional): The JiekouAI API key. If not provided,
+                - api_key (str, optional): The Jiekou.AI API key. If not provided,
                   it will be read from the JIEKOU_API_KEY environment variable.
                 - model_name (str, optional): Alternative way to specify the model.
 
```

**File**: `deepsearcher/llm/jiekouai.py` (modified, +8/-8)
```diff
@@ -6,25 +6,25 @@
 
 class JiekouAI(BaseLLM):
     """
-    JiekouAI language model implementation.
+    Jiekou.AI language model implementation.
 
     This class provides an interface to interact with language models
-    hosted on the JiekouAI platform.
+    hosted on the Jiekou.AI platform.
 
     Attributes:
-        model (str): The model identifier to use on JiekouAI platform.
-        client: The OpenAI-compatible client instance for JiekouAI API.
+        model (str): The model identifier to use on Jiekou.AI platform.
+        client: The OpenAI-compatible client instance for Jiekou.AI API.
     """
 
     def __init__(self, model: str = "claude-sonnet-4-5-20250929", **kwargs):
         """
-        Initialize a JiekouAI language model client.
+        Initialize a Jiekou.AI language model client.
 
         Args:
             model (str, optional): The model identifier to use. Defaults to "claude-sonnet-4-5-20250929".
             **kwargs: Additional keyword arguments to pass to the OpenAI client.
-                - api_key: JiekouAI API key. If not provided, uses JIEKOU_API_KEY environment variable.
-                - base_url: JiekouAI API base URL. If not provided, defaults to "https://api.jiekou.ai/openai/v1".
+                - api_key: Jiekou.AI API key. If not provided, uses JIEKOU_API_KEY environment variable.
+                - base_url: Jiekou.AI API base URL. If not provided, defaults to "https://api.jiekou.ai/openai/v1".
         """
         from openai import OpenAI as OpenAI_
 
@@ -41,7 +41,7 @@ def __init__(self, model: str = "claude-sonnet-4-5-20250929", **kwargs):
 
     def chat(self, messages: List[Dict]) -> ChatResponse:
         """
-        Send a chat message to the JiekouAI model and get a response.
+        Send a chat message to the Jiekou.AI model and get a response.
 
         Args:
             messages (List[Dict]): A list of message dictionaries, typically in the format
```

**File**: `docs/configuration/embedding.md` (modified, +2/-2)
```diff
@@ -25,7 +25,7 @@ config.set_provider_config("embedding", "(EmbeddingModelName)", "(Arguments dict
 | **NovitaEmbedding** | Novita AI embedding | Cost-effective |
 | **SentenceTransformerEmbedding** | Sentence Transfomer Embedding | Self-hosted option |
 | **IBM watsonx.ai** | Various options | IBM's Enterprise AI platform |
-| **JiekouAIEmbedding** | JiekouAI embedding | High quality, cost-effective |
+| **JiekouAIEmbedding** | Jiekou.AI embedding | High quality, cost-effective |
 
 ## 🔍 Provider Examples
 
@@ -126,7 +126,7 @@ config.set_provider_config("embedding", "VoyageEmbedding", {"model": "voyage-3"}
     ```
     *Requires `pip install ibm-watsonx-ai`*
 
-??? example "JiekouAI"
+??? example "Jiekou.AI"
 
     ```python
     config.set_provider_config("embedding", "JiekouAIEmbedding", {"model": "qwen/qwen3-embedding-8b"})
```

---

### Incident Patch 4: `0445c5d0` (2025-11-14)
**Commit Message**: fix: fix linter error

**File**: `deepsearcher/embedding/__init__.py` (modified, +2/-2)
```diff
@@ -2,6 +2,7 @@
 from .fastembed_embdding import FastEmbedEmbedding
 from .gemini_embedding import GeminiEmbedding
 from .glm_embedding import GLMEmbedding
+from .jiekouai_embedding import JiekouAIEmbedding
 from .milvus_embedding import MilvusEmbedding
 from .novita_embedding import NovitaEmbedding
 from .ollama_embedding import OllamaEmbedding
@@ -12,7 +13,6 @@
 from .volcengine_embedding import VolcengineEmbedding
 from .voyage_embedding import VoyageEmbedding
 from .watsonx_embedding import WatsonXEmbedding
-from .jiekouai_embedding import JiekouAIEmbedding
 
 __all__ = [
     "MilvusEmbedding",
@@ -28,6 +28,6 @@
     "FastEmbedEmbedding",
     "NovitaEmbedding",
     "SentenceTransformerEmbedding",
-    "WatsonXEmbedding",
+    "WatsonXEmbedding", 
     "JiekouAIEmbedding",
 ]
```

---

### Incident Patch 5: `972de1c3` (2025-05-14)
**Commit Message**: Fix: Pass headers correctly to Ollama Client to prevent 401 Unauthorized errors (#226)

* fix: pass  kwargs to Ollama Client initialization.

Signed-off-by: Yesid Cano Castro <yesidcanoc@gmail.com>

* docs: add example for FastEmbed embedding usage and installation in README
Signed-off-by: Yesid Cano Castro <yesidcanoc@gmail.com>

---------

Signed-off-by: Yesid Cano Castro <yesidcanoc@gmail.com>

**File**: `README.md` (modified, +6/-0)
```diff
@@ -302,6 +302,12 @@ result = query("Write a report about xxx.") # Your question here
 </details>
 
 
+<details>
+  <summary>Example (FastEmbed embedding)</summary>
+    <pre><code>config.set_provider_config("embedding", "FastEmbedEmbedding", {"model": "intfloat/multilingual-e5-large"})</code></pre>
+    <p> You need to install fastembed before running, execute: <code>pip install fastembed</code>. More details about fastembed: https://github.com/qdrant/fastembed </p>
+</details>
+
 #### Vector Database Configuration
 <pre><code>config.set_provider_config("vector_db", "(VectorDBName)", "(Arguments dict)")</code></pre>
 <p>The "VectorDBName" can be one of the following: ["Milvus"] (Under development)</p>
```

**File**: `deepsearcher/embedding/ollama_embedding.py` (modified, +1/-1)
```diff
@@ -45,7 +45,7 @@ def __init__(self, model="bge-m3", batch_size=32, **kwargs):
         else:
             dimension = OLLAMA_MODEL_DIM_MAP[model]
         self.dim = dimension
-        self.client = Client(host=base_url)
+        self.client = Client(host=base_url, **kwargs)
         self.batch_size = batch_size
 
     def embed_query(self, text: str) -> List[float]:
```

---

### Incident Patch 6: `53dad865` (2025-05-09)
**Commit Message**: fix: deepsearcher dependency issue (#224)

* fix: deepsearcher dependency issue

* resolved dependencies naming

* added docling and crawl4ai

* added crawl4ai

* finalized dependency

**File**: `pyproject.toml` (modified, +58/-32)
```diff
@@ -5,16 +5,17 @@ readme = "README.md"
 requires-python = ">=3.10"
 dependencies = [
     "argparse>=1.4.0",
-    "fastapi>=0.115.9",
-    "firecrawl-py>=2.3.0",
-    "langchain-text-splitters>=0.3.6",
-    "numpy>=2.2.3",
-    "openai>=1.65.1",
-    "pdfplumber>=0.11.5",
-    "pymilvus>=2.5.4",
-    "termcolor>=2.5.0",
+    "fastapi>=0.115.12",
+    "firecrawl-py>=2.5.3",
+    "langchain-text-splitters>=0.3.8",
+    "numpy>=1.26.4",
+    "openai>=1.77.0",
+    "pdfplumber>=0.11.6",
+    "pymilvus>=2.5.8",
+    "requests>=2.32.3",
+    "termcolor>=3.1.0",
     "tqdm>=4.67.1",
-    "uvicorn>=0.34.0",
+    "uvicorn>=0.34.2",
 ]
 description = "None"
 license = { file = "LICENSE"}
@@ -36,43 +37,68 @@ dev = [
 
 [project.optional-dependencies]
 all = [
-    "deepsearcher[embedding, llm, file-loader]",
-]
-embedding = [
-    "boto3>=1.37.5",
     "voyageai>=0.3.2",
+    "anthropic>=0.51.0",
+    "google-genai>=1.14.0",
+    "ollama>=0.4.8",
+    "unstructured-ingest>=1.0.24",
+    "unstructured[all-docs]>=0.17.2",
+    "zhipuai>=2.1.5.20250421",
+    "oracledb>=3.1.0",
+    "azure-search-documents>=11.5.2",
+    "boto3>=1.38.11",
+    "together>=1.3.14",
+    "fastembed>=0.6.1",
+    "qdrant-client>=1.14.2",
+    "docling>=2.15.1",
+    "docling-core>=2.30.0",
+    "crawl4ai>=0.6.2",
 ]
-llm = [
-    "anthropic>=0.49.0",
-    "google-generativeai>=0.8.4",
-    "ollama>=0.4.7",
-    "together>=1.4.1",
-]
-file-loader = [
-    "unstructured-ingest>=0.5.9",
-]
-aws = [
-    "boto3>=1.37.5",
-]
+
 voyageai = [
     "voyageai>=0.3.2",
 ]
 anthropic = [
-    "anthropic>=0.49.0",
+    "anthropic>=0.51.0",
 ]
 google = [
-    "google-generativeai>=0.8.4",
+    "google-genai>=1.14.0",
 ]
 ollama = [
-    "ollama>=0.4.7",
-]
-togetherai = [
-    "together>=1.4.1",
+    "ollama>=0.4.8",
 ]
 unstructured = [
-    "unstructured-ingest>=0.5.9",
+    "unstructured-ingest>=1.0.24",
     "unstructured[all-docs]>=0.17.2",
 ]
+zhipuai = [
+    "zhipuai>=2.1.5.20250421",
+]
+oracledb = [
+    "oracledb>=3.1.0",
+]
+azure-search = [
+    "azure-search-documents>=11.5.2",
+]
+boto3 = [
+    "boto3>=1.38.11",
+]
+together = [
+    "together>=1.3.14",
+]
+qdrant = [
+    "fastembed>=0.6.1",
+    "qdrant-client>=1.14.2",
+]
+docling = [
+    "docling>=2.15.1",
+    "docling-core>=2.30.0",
+]
+crawl4ai = [
+    "crawl4ai>=0.6.2",
+]
+
+
 
 [build-system]
 requires = ["hatchling"]
```

---

### Incident Patch 7: `5d6606f8` (2025-04-29)
**Commit Message**: fix dependencies problem (#216)

Signed-off-by: ChengZi <chen.zhang@zilliz.com>

**File**: `deepsearcher/vector_db/azure_search.py` (modified, +42/-15)
```diff
@@ -1,27 +1,19 @@
 import uuid
 from typing import Any, Dict, List, Optional
 
-from azure.core.credentials import AzureKeyCredential
-from azure.core.exceptions import ResourceNotFoundError
-from azure.search.documents import SearchClient
-from azure.search.documents.indexes import SearchIndexClient
-from azure.search.documents.indexes.models import (
-    # VectorSearchAlgorithmConfiguration,
-    SearchableField,
-    SearchField,
-    SearchIndex,
-    # SearchFieldDataType,
-    SimpleField,
-)
-
 from deepsearcher.vector_db.base import BaseVectorDB, CollectionInfo, RetrievalResult
 
 
 class AzureSearch(BaseVectorDB):
     def __init__(self, endpoint, index_name, api_key, vector_field):
         super().__init__(default_collection=index_name)
+        from azure.core.credentials import AzureKeyCredential
+        from azure.search.documents import SearchClient
+
         self.client = SearchClient(
-            endpoint=endpoint, index_name=index_name, credential=AzureKeyCredential(api_key)
+            endpoint=endpoint,
+            index_name=index_name,
+            credential=AzureKeyCredential(api_key),
         )
         self.vector_field = vector_field
         self.endpoint = endpoint
@@ -30,6 +22,16 @@ def __init__(self, endpoint, index_name, api_key, vector_field):
 
     def init_collection(self):
         """Initialize Azure Search index with proper schema"""
+        from azure.core.credentials import AzureKeyCredential
+        from azure.core.exceptions import ResourceNotFoundError
+        from azure.search.documents.indexes import SearchIndexClient
+        from azure.search.documents.indexes.models import (
+            SearchableField,
+            SearchField,
+            SearchIndex,
+            SimpleField,
+        )
+
         index_client = SearchIndexClient(
             endpoint=self.endpoint, credential=AzureKeyCredential(self.api_key)
         )
@@ -63,6 +65,9 @@ def init_collection(self):
 
     def insert_data(self, documents: List[dict]):
         """Batch insert documents with vector embeddings"""
+        from azure.core.credentials import AzureKeyCredential
+        from azure.search.documents import SearchClient
+
         search_client = SearchClient(
             endpoint=self.endpoint,
             index_name=self.index_name,
@@ -86,6 +91,9 @@ def search_data(
         self, collection: Optional[str], vector: List[float], top_k: int = 50
     ) -> List[RetrievalResult]:
         """Azure Cognitive Search implementation with compatibility for older SDK versions"""
+        from azure.core.credentials import AzureKeyCredential
+        from azure.search.documents import SearchClient
+
         search_client = SearchClient(
             endpoint=self.endpoint,
             index_name=collection or self.index_name,
@@ -116,7 +124,12 @@ def search_data(
                 "select": "id,content",
                 "top": top_k,
                 "vectorQueries": [
-                    {"vector": vector, "fields": self.vector_field, "k": top_k, "kind": "vector"}
+                    {
+                        "vector": vector,
+                        "fields": self.vector_field,
+                        "k": top_k,
+                        "kind": "vector",
+                    }
                 ],
             }
 
@@ -190,6 +203,9 @@ def search_data(
 
     def clear_db(self):
         """Delete all documents in the index"""
+        from azure.core.credentials import AzureKeyCredential
+        from azure.search.documents import SearchClient
+
         search_client = SearchClient(
             endpoint=self.endpoint,
             index_name=self.index_name,
@@ -206,6 +222,9 @@ def clear_db(self):
 
     def get_all_collections(self) -> List[str]:
         """List all search indices in Azure Cognitive Search"""
+        from azure.core.credentials import AzureKeyCredential
+        from azure.search.documents.indexes import SearchIndexClient
+
         try:
             index_client = 
```

**File**: `pyproject.toml` (modified, +1/-1)
```diff
@@ -6,7 +6,7 @@ requires-python = ">=3.10"
 dependencies = [
     "argparse>=1.4.0",
     "fastapi>=0.115.9",
-    "firecrawl-py>=1.12.0",
+    "firecrawl-py>=2.3.0",
     "langchain-text-splitters>=0.3.6",
     "numpy>=2.2.3",
     "openai>=1.65.1",
```

**File**: `uv.lock` (modified, +6/-5)
```diff
@@ -655,7 +655,7 @@ requires-dist = [
     { name = "boto3", marker = "extra == 'embedding'", specifier = ">=1.37.5" },
     { name = "deepsearcher", extras = ["embedding", "llm", "file-loader"], marker = "extra == 'all'" },
     { name = "fastapi", specifier = ">=0.115.9" },
-    { name = "firecrawl-py", specifier = ">=1.12.0" },
+    { name = "firecrawl-py", specifier = ">=2.3.0" },
     { name = "google-generativeai", marker = "extra == 'google'", specifier = ">=0.8.4" },
     { name = "google-generativeai", marker = "extra == 'llm'", specifier = ">=0.8.4" },
     { name = "langchain-text-splitters", specifier = ">=0.3.6" },
@@ -788,18 +788,19 @@ wheels = [
 
 [[package]]
 name = "firecrawl-py"
-version = "1.13.2"
+version = "2.4.3"
 source = { registry = "https://pypi.org/simple" }
 dependencies = [
+    { name = "aiohttp" },
     { name = "nest-asyncio" },
     { name = "pydantic" },
     { name = "python-dotenv" },
     { name = "requests" },
     { name = "websockets" },
 ]
-sdist = { url = "https://files.pythonhosted.org/packages/50/35/47173715f0dc85519bd6f28fea891f32a6a356ad8c2b844507a40f743a88/firecrawl_py-1.13.2.tar.gz", hash = "sha256:39b346f82a44a4ce47d04d232a445b278ab6d86b4224daeaa7efc1fa321fe992", size = 20839 }
+sdist = { url = "https://files.pythonhosted.org/packages/75/0d/7f114ce411ebf8573139b0e3a603e1ec6ddfd10d7510e10f45177e043015/firecrawl_py-2.4.3.tar.gz", hash = "sha256:88b310d7156e111017e349b8e895e3ae378f0c3dc256a305e2d9ff4375894acf", size = 37186 }
 wheels = [
-    { url = "https://files.pythonhosted.org/packages/80/1a/8ce386ac466e7bda5aed521d552c50f952006544a9fdaf0154f1580d4a02/firecrawl_py-1.13.2-py3-none-any.whl", hash = "sha256:fa1a51865423efbbc9df16660b940d72e6481aff7e3e223340aebc7b47e9dc71", size = 19741 },
+    { url = "https://files.pythonhosted.org/packages/04/db/feb88b010dac647efe81223be9eb5c8c1cebf6dfcc14033078c6fa7f02dc/firecrawl_py-2.4.3-py3-none-any.whl", hash = "sha256:93118aabf0767ef3b1798c74dd51f3d7e421dd5cdc78a224ea1d768deed908f7", size = 69871 },
 ]
 
 [[package]]
@@ -1501,7 +1502,7 @@ wheels = [
     { url = "https://files.pythonhosted.org/packages/8c/de/8eb6fffecd9c5f129461edcdd7e1ac944f9de15783e3d89c84ed6e0374bc/lxml-5.3.2-cp310-cp310-musllinux_1_2_ppc64le.whl", hash = "sha256:aa837e6ee9534de8d63bc4c1249e83882a7ac22bd24523f83fad68e6ffdf41ae", size = 5652903 },
     { url = "https://files.pythonhosted.org/packages/95/79/80f4102a08495c100014593680f3f0f7bd7c1333b13520aed855fc993326/lxml-5.3.2-cp310-cp310-musllinux_1_2_s390x.whl", hash = "sha256:da4c9223319400b97a2acdfb10926b807e51b69eb7eb80aad4942c0516934858", size = 5491813 },
     { url = "https://files.pythonhosted.org/packages/15/f5/9b1f7edf6565ee31e4300edb1bcc61eaebe50a3cff4053c0206d8dc772f2/lxml-5.3.2-cp310-cp310-musllinux_1_2_x86_64.whl", hash = "sha256:dc0e9bdb3aa4d1de703a437576007d366b54f52c9897cae1a3716bb44fc1fc85", size = 5227837 },
-    { url = "https://files.pythonhosted.org/packages/5c/17/c31d94364c02e3492215658917f5590c00edce8074aeb06d05b7771465d9/lxml-5.3.2-cp310-cp310-win32.whl", hash = "sha256:5f94909a1022c8ea12711db7e08752ca7cf83e5b57a87b59e8a583c5f35016ad", size = 3477533 },
+    { url = "https://files.pythonhosted.org/packages/dd/53/a187c4ccfcd5fbfca01e6c96da39499d8b801ab5dcf57717db95d7a968a8/lxml-5.3.2-cp310-cp310-win32.win32.whl", hash = "sha256:dd755a0a78dd0b2c43f972e7b51a43be518ebc130c9f1a7c4480cf08b4385486", size = 3477533 },
     { url = "https://files.pythonhosted.org/packages/f2/2c/397c5a9d76a7a0faf9e5b13143ae1a7e223e71d2197a45da71c21aacb3d4/lxml-5.3.2-cp310-cp310-win_amd64.whl", hash = "sha256:d64ea1686474074b38da13ae218d9fde0d1dc6525266976808f41ac98d9d7980", size = 3805160 },
     { url = "https://files.pythonhosted.org/packages/84/b8/2b727f5a90902f7cc5548349f563b60911ca05f3b92e35dfa751349f265f/lxml-5.3.2-cp311-cp311-macosx_10_9_universal2.whl", hash = "sha256:9d61a7d0d208ace43986a92b111e035881c4ed45b1f5b7a270070acae8b0bfb4", size = 8163457 },
     { url = "https://files.pythonhosted.org/packages/91/84/2
```

---

### Incident Patch 8: `8f330a71` (2025-04-29)
**Commit Message**: fix issue that <think> tag is mixed in the agent's middle output (#215)

Signed-off-by: ChengZi <chen.zhang@zilliz.com>

**File**: `deepsearcher/agent/chain_of_rag.py` (modified, +5/-5)
```diff
@@ -131,7 +131,7 @@ def _reflect_get_subquery(self, query: str, intermediate_context: List[str]) ->
                 }
             ]
         )
-        return chat_response.content, chat_response.total_tokens
+        return self.llm.remove_think(chat_response.content), chat_response.total_tokens
 
     def _retrieve_and_answer(self, query: str) -> Tuple[str, List[RetrievalResult], int]:
         consume_tokens = 0
@@ -165,7 +165,7 @@ def _retrieve_and_answer(self, query: str) -> Tuple[str, List[RetrievalResult],
             ]
         )
         return (
-            chat_response.content,
+            self.llm.remove_think(chat_response.content),
             all_retrieved_results,
             consume_tokens + chat_response.total_tokens,
         )
@@ -217,7 +217,7 @@ def _check_has_enough_info(
                 }
             ]
         )
-        has_enough_info = chat_response.content.strip().lower() == "yes"
+        has_enough_info = self.llm.remove_think(chat_response.content).strip().lower() == "yes"
         return has_enough_info, chat_response.total_tokens
 
     def retrieve(self, query: str, **kwargs) -> Tuple[List[RetrievalResult], int, dict]:
@@ -309,9 +309,9 @@ def query(self, query: str, **kwargs) -> Tuple[str, List[RetrievalResult], int]:
             ]
         )
         log.color_print("\n==== FINAL ANSWER====\n")
-        log.color_print(chat_response.content)
+        log.color_print(self.llm.remove_think(chat_response.content))
         return (
-            chat_response.content,
+            self.llm.remove_think(chat_response.content),
             all_retrieved_results,
             n_token_retrieval + chat_response.total_tokens,
         )
```

**File**: `deepsearcher/agent/deep_search.py` (modified, +5/-9)
```diff
@@ -114,7 +114,7 @@ def _generate_sub_queries(self, original_query: str) -> Tuple[List[str], int]:
                 {"role": "user", "content": SUB_QUERY_PROMPT.format(original_query=original_query)}
             ]
         )
-        response_content = chat_response.content
+        response_content = self.llm.remove_think(chat_response.content)
         return self.llm.literal_eval(response_content), chat_response.total_tokens
 
     async def _search_chunks_from_vectordb(self, query: str, sub_queries: List[str]):
@@ -155,11 +155,7 @@ async def _search_chunks_from_vectordb(self, query: str, sub_queries: List[str])
                     ]
                 )
                 consume_tokens += chat_response.total_tokens
-                response_content = chat_response.content.strip()
-                # strip the reasoning text if exists
-                if "<think>" in response_content and "</think>" in response_content:
-                    end_of_think = response_content.find("</think>") + len("</think>")
-                    response_content = response_content[end_of_think:].strip()
+                response_content = self.llm.remove_think(chat_response.content).strip()
                 if "YES" in response_content and "NO" not in response_content:
                     all_retrieved_results.append(retrieved_result)
                     accepted_chunk_num += 1
@@ -185,7 +181,7 @@ def _generate_gap_queries(
             else "NO RELATED CHUNKS FOUND.",
         )
         chat_response = self.llm.chat([{"role": "user", "content": reflect_prompt}])
-        response_content = chat_response.content
+        response_content = self.llm.remove_think(chat_response.content)
         return self.llm.literal_eval(response_content), chat_response.total_tokens
 
     def retrieve(self, original_query: str, **kwargs) -> Tuple[List[RetrievalResult], int, dict]:
@@ -309,9 +305,9 @@ def query(self, query: str, **kwargs) -> Tuple[str, List[RetrievalResult], int]:
         )
         chat_response = self.llm.chat([{"role": "user", "content": summary_prompt}])
         log.color_print("\n==== FINAL ANSWER====\n")
-        log.color_print(chat_response.content)
+        log.color_print(self.llm.remove_think(chat_response.content))
         return (
-            chat_response.content,
+            self.llm.remove_think(chat_response.content),
             all_retrieved_results,
             n_token_retrieval + chat_response.total_tokens,
         )
```

**File**: `deepsearcher/agent/rag_router.py` (modified, +4/-2)
```diff
@@ -60,13 +60,15 @@ def _route(self, query: str) -> Tuple[RAGAgent, int]:
         prompt = RAG_ROUTER_PROMPT.format(query=query, description_str=description_str)
         chat_response = self.llm.chat(messages=[{"role": "user", "content": prompt}])
         try:
-            selected_agent_index = int(chat_response.content) - 1
+            selected_agent_index = int(self.llm.remove_think(chat_response.content)) - 1
         except ValueError:
             # In some reasoning LLM, the output is not a number, but a explaination string with a number in the end.
             log.warning(
                 "Parse int failed in RAGRouter, but will try to find the last digit as fallback."
             )
-            selected_agent_index = int(self.find_last_digit(chat_response.content)) - 1
+            selected_agent_index = (
+                int(self.find_last_digit(self.llm.remove_think(chat_response.content))) - 1
+            )
 
         selected_agent = self.rag_agents[selected_agent_index]
         log.color_print(
```

**File**: `deepsearcher/llm/base.py` (modified, +9/-4)
```diff
@@ -83,10 +83,7 @@ def literal_eval(response_content: str):
         """
         response_content = response_content.strip()
 
-        # remove content between <think> and </think>, especial for DeepSeek reasoning model
-        if "<think>" in response_content and "</think>" in response_content:
-            end_of_think = response_content.find("</think>") + len("</think>")
-            response_content = response_content[end_of_think:]
+        response_content = BaseLLM.remove_think(response_content)
 
         try:
             if response_content.startswith("```") and response_content.endswith("```"):
@@ -113,3 +110,11 @@ def literal_eval(response_content: str):
             return ast.literal_eval(json_part)
 
         return result
+
+    @staticmethod
+    def remove_think(response_content: str) -> str:
+        # remove content between <think> and </think>, especial for reasoning model
+        if "<think>" in response_content and "</think>" in response_content:
+            end_of_think = response_content.find("</think>") + len("</think>")
+            response_content = response_content[end_of_think:]
+        return response_content.strip()
```

---

### Incident Patch 9: `4593535e` (2025-04-28)
**Commit Message**: Azure Search Vector DB and Azure Open AI Fixes for embeddings. (#211)

* Azure Search Vector DB and Azure Open AI Fixes for embeddings.

* ruff errors

* fixed comments

* ruff

**File**: `README.md` (modified, +22/-0)
```diff
@@ -209,6 +209,16 @@ result = query("Write a report about xxx.") # Your question here
     <p> More details about OpenAI models: https://platform.openai.com/docs/guides/embeddings/use-cases </p>
 </details>
 
+<details>
+  <summary>Example (OpenAI embedding Azure)</summary>
+    <p> Make sure you have prepared your OpenAI API KEY as an env variable <code>OPENAI_API_KEY</code>.</p>
+    <pre><code>config.set_provider_config("embedding", "OpenAIEmbedding", {
+    "model": "text-embedding-ada-002",
+    "azure_endpoint": "https://<youraifoundry>.openai.azure.com/",
+    "api_version": "2023-05-15"
+})</code></pre>
+</details>
+
 <details>
   <summary>Example (Pymilvus built-in embedding model)</summary>
     <p> Use the built-in embedding model in Pymilvus, you can set the model name as <code>"default"</code>, <code>"BAAI/bge-base-en-v1.5"</code>, <code>"BAAI/bge-large-en-v1.5"</code>, <code>"jina-embeddings-v3"</code>, etc. <br/>
@@ -314,6 +324,18 @@ result = query("Write a report about xxx.") # Your question here
 
 </details>
 
+<details>
+  <summary>Example (AZURE AI Search)</summary>
+    <pre><code>config.set_provider_config("vector_db", "AzureSearch", {
+    "endpoint": "https://<yourazureaisearch>.search.windows.net",
+    "index_name": "<yourindex>",
+    "api_key": "<yourkey>",
+    "vector_field": ""
+})</code></pre>
+    <p> More details about Milvus Config:</p>
+
+</details>
+
 #### File Loader Configuration
 <pre><code>config.set_provider_config("file_loader", "(FileLoaderName)", "(Arguments dict)")</code></pre>
 <p>The "FileLoaderName" can be one of the following: ["PDFLoader", "TextLoader", "UnstructuredLoader"]</p>
```

**File**: `deepsearcher/embedding/openai_embedding.py` (modified, +48/-15)
```diff
@@ -37,32 +37,56 @@ def __init__(self, model: str = "text-embedding-ada-002", **kwargs):
                 - model_name (str, optional): Alternative way to specify the model.
                 - dimension (int, optional): The dimension of the embedding vectors.
                   If not provided, the default dimension for the model will be used.
+                - azure_endpoint (str, optional): If provided, use Azure OpenAI instead.
+                - api_version (str, optional): Azure API version to use. Default is "2023-05-15".
 
         Notes:
             Available models:
                 - 'text-embedding-ada-002': No dimension needed, default is 1536
                 - 'text-embedding-3-small': dimensions from 512 to 1536, default is 1536
                 - 'text-embedding-3-large': dimensions from 1024 to 3072, default is 3072
         """
-        from openai import OpenAI
-
+        # Extract Azure-specific parameters
+        azure_endpoint = kwargs.pop("azure_endpoint", None)
+        api_version = kwargs.pop("api_version", "2023-05-15")
+        azure_deployment = kwargs.pop("azure_deployment", None)
+        # Extract standard parameters (keep original behavior)
         if "api_key" in kwargs:
             api_key = kwargs.pop("api_key")
         else:
             api_key = os.getenv("OPENAI_API_KEY")
+
         if "base_url" in kwargs:
             base_url = kwargs.pop("base_url")
         else:
             base_url = os.getenv("OPENAI_BASE_URL")
+
         if "model_name" in kwargs and (not model or model == "text-embedding-ada-002"):
             model = kwargs.pop("model_name")
+
         if "dimension" in kwargs:
             dimension = kwargs.pop("dimension")
         else:
-            dimension = OPENAI_MODEL_DIM_MAP[model]
+            dimension = OPENAI_MODEL_DIM_MAP.get(model, 1536)
+
         self.dim = dimension
         self.model = model
-        self.client = OpenAI(api_key=api_key, base_url=base_url, **kwargs)
+
+        # Initialize the appropriate client based on parameters
+        if azure_endpoint:
+            from openai import AzureOpenAI
+
+            self.client = AzureOpenAI(
+                api_key=api_key, api_version=api_version, azure_endpoint=azure_endpoint, **kwargs
+            )
+            # Store the deployment name to use for Azure
+            self.deployment = azure_deployment if azure_deployment is not None else model
+            self.is_azure = True
+        else:
+            from openai import OpenAI
+
+            self.client = OpenAI(api_key=api_key, base_url=base_url, **kwargs)
+            self.is_azure = False
 
     def _get_dim(self):
         """
@@ -84,14 +108,17 @@ def embed_query(self, text: str) -> List[float]:
         Returns:
             List[float]: A list of floats representing the embedding vector.
         """
-        # text = text.replace("\n", " ")
-        return (
-            self.client.embeddings.create(
+        if self.is_azure:
+            response = self.client.embeddings.create(
+                input=[text],
+                model=self.model,  # For Azure, this is the deployment name
+            )
+        else:
+            response = self.client.embeddings.create(
                 input=[text], model=self.model, dimensions=self._get_dim()
             )
-            .data[0]
-            .embedding
-        )
+
+        return response.data[0].embedding
 
     def embed_documents(self, texts: List[str]) -> List[List[float]]:
         """
@@ -103,11 +130,17 @@ def embed_documents(self, texts: List[str]) -> List[List[float]]:
         Returns:
             List[List[float]]: A list of embedding vectors, one for each input text.
         """
-        res = self.client.embeddings.create(
-            input=texts, model=self.model, dimensions=self._get_dim()
-        )
-        res = [r.embedding for r in res.data]
-        return res
+        if self.is_azure:
+            response = self.client.embeddings.create(
+           
```

**File**: `deepsearcher/vector_db/__init__.py` (modified, +2/-1)
```diff
@@ -1,5 +1,6 @@
+from .azure_search import AzureSearch
 from .milvus import Milvus, RetrievalResult
 from .oracle import OracleDB
 from .qdrant import Qdrant
 
-__all__ = ["Milvus", "RetrievalResult", "OracleDB", "Qdrant"]
+__all__ = ["Milvus", "RetrievalResult", "OracleDB", "Qdrant", "AzureSearch"]
```

**File**: `deepsearcher/vector_db/azure_search.py` (added, +252/-0)
```diff
@@ -0,0 +1,252 @@
+import uuid
+from typing import Any, Dict, List, Optional
+
+from azure.core.credentials import AzureKeyCredential
+from azure.core.exceptions import ResourceNotFoundError
+from azure.search.documents import SearchClient
+from azure.search.documents.indexes import SearchIndexClient
+from azure.search.documents.indexes.models import (
+    # VectorSearchAlgorithmConfiguration,
+    SearchableField,
+    SearchField,
+    SearchIndex,
+    # SearchFieldDataType,
+    SimpleField,
+)
+
+from deepsearcher.vector_db.base import BaseVectorDB, CollectionInfo, RetrievalResult
+
+
+class AzureSearch(BaseVectorDB):
+    def __init__(self, endpoint, index_name, api_key, vector_field):
+        super().__init__(default_collection=index_name)
+        self.client = SearchClient(
+            endpoint=endpoint, index_name=index_name, credential=AzureKeyCredential(api_key)
+        )
+        self.vector_field = vector_field
+        self.endpoint = endpoint
+        self.index_name = index_name
+        self.api_key = api_key
+
+    def init_collection(self):
+        """Initialize Azure Search index with proper schema"""
+        index_client = SearchIndexClient(
+            endpoint=self.endpoint, credential=AzureKeyCredential(self.api_key)
+        )
+
+        # Create the index (simplified for compatibility with older SDK versions)
+        fields = [
+            SimpleField(name="id", type="Edm.String", key=True),
+            SearchableField(name="content", type="Edm.String"),
+            SearchField(
+                name="content_vector",
+                type="Collection(Edm.Single)",
+                searchable=True,
+                vector_search_dimensions=1536,
+            ),
+        ]
+
+        # Create index with fields
+        index = SearchIndex(name=self.index_name, fields=fields)
+
+        try:
+            # Try to delete existing index
+            try:
+                index_client.delete_index(self.index_name)
+            except ResourceNotFoundError:
+                pass
+
+            # Create the index
+            index_client.create_index(index)
+        except Exception as e:
+            print(f"Error creating index: {str(e)}")
+
+    def insert_data(self, documents: List[dict]):
+        """Batch insert documents with vector embeddings"""
+        search_client = SearchClient(
+            endpoint=self.endpoint,
+            index_name=self.index_name,
+            credential=AzureKeyCredential(self.api_key),
+        )
+
+        actions = [
+            {
+                "@search.action": "upload" if doc.get("id") else "merge",
+                "id": doc.get("id", str(uuid.uuid4())),
+                "content": doc["text"],
+                "content_vector": doc["vector"],
+            }
+            for doc in documents
+        ]
+
+        result = search_client.upload_documents(actions)
+        return [x.succeeded for x in result]
+
+    def search_data(
+        self, collection: Optional[str], vector: List[float], top_k: int = 50
+    ) -> List[RetrievalResult]:
+        """Azure Cognitive Search implementation with compatibility for older SDK versions"""
+        search_client = SearchClient(
+            endpoint=self.endpoint,
+            index_name=collection or self.index_name,
+            credential=AzureKeyCredential(self.api_key),
+        )
+
+        # Validate that vector is not empty
+        if not vector or len(vector) == 0:
+            print("Error: Empty vector provided for search. Vector must have 1536 dimensions.")
+            return []
+
+        # Debug vector and field info
+        print(f"Vector length for search: {len(vector)}")
+        print(f"Vector field name: {self.vector_field}")
+
+        # Ensure vector has the right dimensions
+        if len(vector) != 1536:
+            print(f"Warning: Vector length {len(vector)} does not match expected 1536 dimensions")
+            return []
+
+        # Execute search with direct parameters - 
```

**File**: `examples/basic_example_azuresearch.py` (added, +68/-0)
```diff
@@ -0,0 +1,68 @@
+import logging
+import os
+import time
+
+from deepsearcher.configuration import Configuration, init_config
+from deepsearcher.online_query import query
+
+# Configure logging
+logging.basicConfig(
+    level=logging.INFO,
+    format='%(asctime)s - %(levelname)s - %(message)s',
+    datefmt='%Y-%m-%d %H:%M:%S'
+)
+logger = logging.getLogger(__name__)
+
+
+
+logger.info("Initializing DeepSearcher configuration")
+config = Configuration()
+config.set_provider_config("llm", "AzureOpenAI", {
+    "model": "gpt-4.1",
+    "api_key": "<yourkey>",
+    "base_url": "https://<youraifoundry>.openai.azure.com/openai/",
+    "api_version": "2024-12-01-preview"
+})
+config.set_provider_config("embedding", "OpenAIEmbedding", {
+    "model": "text-embedding-ada-002",
+    "api_key": "<yourkey>",
+    "azure_endpoint": "https://<youraifoundry>.openai.azure.com/",
+    "api_version": "2023-05-15"
+    # Remove api_version and other Azure-specific parameters
+})
+config.set_provider_config("vector_db", "AzureSearch", {
+    "endpoint": "https://<yourazureaisearch>.search.windows.net",
+    "index_name": "<yourindex>",
+    "api_key": "<yourkey>",
+    "vector_field": "content_vector"
+})
+
+logger.info("Configuration initialized successfully")
+
+try:
+    logger.info("Applying global configuration")
+    init_config(config)
+    logger.info("Configuration applied globally")
+
+    # Example question
+    question = "Create a detailed report about what Python is all about"
+    logger.info(f"Processing query: '{question}'")
+
+    start_time = time.time()
+    result = query(question)
+    query_time = time.time() - start_time
+    logger.info(f"Query processed in {query_time:.2f} seconds")
+
+    logger.info("Retrieved result successfully")
+    print(result[0])  # Print the first element of the tuple
+
+    # Check if there's a second element in the tuple that contains source documents
+    if len(result) > 1 and hasattr(result[1], "__len__"):
+        logger.info(f"Found {len(result[1])} source documents")
+        for i, doc in enumerate(result[1]):
+            if hasattr(doc, "metadata") and "source" in doc.metadata:
+                logger.info(f"Source {i+1}: {doc.metadata['source']}")
+except Exception as e:
+    logger.error(f"Error executing query: {str(e)}")
+    import traceback
+    logger.error(traceback.format_exc())
\ No newline at end of file
```

---

### Incident Patch 10: `c1661c3d` (2025-04-28)
**Commit Message**: fix(FireCrawlCrawler): replace deprecated dict() calls with model_dump() for safety and Pydantic V2 support (#213)

* fix(FireCrawlCrawler): replace deprecated dict() calls with model_dump() for safety and Pydantic V2 support

* chore: remove extra trailing space to satisfy Ruff formatting

* fix(FireCrawlCrawler): adapt to Firecrawl-Py v1+ SDK signature

- Replace camelCase args (scrapeOptions, maxDepth, allowBackwardLinks) with snake_case parameters (scrape_options, max_depth, allow_backward_links)
- Use ScrapeOptions(formats=["markdown"]) for output format
- Add poll_interval to control crawl polling
- Remove unsupported top-level params dict

* style(firecrawl_crawler): conform docstrings to ruff format rules

- Insert blank line after class-level docstring
- Remove trailing whitespace from method docstring end

**File**: `deepsearcher/loader/web_crawler/firecrawl_crawler.py` (modified, +25/-30)
```diff
@@ -1,7 +1,7 @@
 import os
 from typing import List, Optional
 
-from firecrawl import FirecrawlApp
+from firecrawl import FirecrawlApp, ScrapeOptions
 from langchain_core.documents import Document
 
 from deepsearcher.loader.web_crawler.base import BaseCrawler
@@ -48,7 +48,6 @@ def crawl_url(
         Returns:
             List[Document]: List of Document objects with page content and metadata.
         """
-
         # Lazy init
         self.app = FirecrawlApp(api_key=os.getenv("FIRECRAWL_API_KEY"))
 
@@ -57,37 +56,33 @@ def crawl_url(
         if max_depth is None and limit is None and allow_backward_links is None:
             # Call the new Firecrawl API, passing formats directly
             scrape_response = self.app.scrape_url(url=url, formats=["markdown"])
-            # Convert Pydantic BaseModel to dict
-            resp_dict = scrape_response.dict()
-            markdown_content = resp_dict.get("markdown", "")
-            metadata = resp_dict.get("metadata", {})
-            metadata["reference"] = url
-            return [Document(page_content=markdown_content, metadata=metadata)]
+            data = scrape_response.model_dump()
+            return [
+                Document(
+                    page_content=data.get("markdown", ""),
+                    metadata={"reference": url, **data.get("metadata", {})},
+                )
+            ]
 
         # else, crawl multiple pages based on users' input params
         # set default values if not provided
-        crawl_params = {
-            "scrapeOptions": {"formats": ["markdown"]},
-            "limit": limit if limit is not None else 20,
-            "maxDepth": max_depth if max_depth is not None else 2,
-            "allowBackwardLinks": (
-                allow_backward_links if allow_backward_links is not None else False
-            ),
-        }
-
-        # Call the new Firecrawl API, flattening parameters
-        crawl_response = self.app.crawl_url(url=url, **crawl_params)
-        # Convert Pydantic BaseModel to dict
-        crawl_dict = crawl_response.dict()
-        data = crawl_dict.get("data", [])
-
-        documents = []
-        for item in data:
+        crawl_response = self.app.crawl_url(
+            url=url,
+            limit=limit or 20,
+            max_depth=max_depth or 2,
+            allow_backward_links=allow_backward_links or False,
+            scrape_options=ScrapeOptions(formats=["markdown"]),
+            poll_interval=5,
+        )
+        items = crawl_response.model_dump().get("data", [])
+
+        documents: List[Document] = []
+        for item in items:
             # Support items that are either dicts or Pydantic sub-models
-            item_dict = item.dict() if hasattr(item, "dict") else item
-            markdown_content = item_dict.get("markdown", "")
-            metadata = item_dict.get("metadata", {})
-            metadata["reference"] = metadata.get("url", url)
-            documents.append(Document(page_content=markdown_content, metadata=metadata))
+            item_dict = item.model_dump() if hasattr(item, "model_dump") else item
+            md = item_dict.get("markdown", "")
+            meta = item_dict.get("metadata", {})
+            meta["reference"] = meta.get("url", url)
+            documents.append(Document(page_content=md, metadata=meta))
 
         return documents
```

#### Recent Merged Pull Requests:
- **PR #274** (2026-09-22): Add reproducible Jev search-stopping evaluation (@zc277584121)
- **PR #260** (closed): feat: add MiniMax as LLM and embedding provider (@octo-patch)
- **PR #259** (closed): Fix default model regressions and document bug fixes (@TheCoder2010-create)
- **PR #257** (2025-11-19): feat: add new llm and embedding provider JiekouAI (@cnJasonZ)
- **PR #253** (2025-07-10): add grok-4 model (@zc277584121)
- **PR #252** (2025-07-09): add deepwiki badge (@zc277584121)
- **PR #251** (2025-07-04): support more ollama embeddingmodels (@zc277584121)
- **PR #249** (2025-06-18): docs: Correct malformed URL references for uv installation (@JoeyBurzynski)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
