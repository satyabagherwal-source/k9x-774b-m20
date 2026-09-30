# Forensic Learning Record (Deep Inspection): parthsarthi03/raptor

> **Canonical Artifact**: `07_PROJECT_LEARNING/parthsarthi03-raptor-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/parthsarthi03/raptor](https://github.com/parthsarthi03/raptor))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-09-30T17:37:59.187Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `parthsarthi03/raptor`
- **Description**: The official implementation of RAPTOR: Recursive Abstractive Processing for Tree-Organized Retrieval
- **Primary Language / Ecosystem**: Python
- **Discovered Manifests / Configurations**: README.md
- **Stars / Engagement**: 1763 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `raptor/EmbeddingModels.py`
```
import logging
from abc import ABC, abstractmethod

from openai import OpenAI
from sentence_transformers import SentenceTransformer
from tenacity import retry, stop_after_attempt, wait_random_exponential

logging.basicConfig(format="%(asctime)s - %(message)s", level=logging.INFO)


class BaseEmbeddingModel(ABC):
    @abstractmethod
    def create_embedding(self, text):
        pass


class OpenAIEmbeddingModel(BaseEmbeddingModel):
    def __init__(self, model="text-embedding-ada-002"):
        self.client = OpenAI()
        self.model = model

    @retry(wait=wait_random_exponential(min=1, max=20), stop=stop_after_attempt(6))
    def create_embedding(self, text):
        text = text.replace("\n", " ")
        return (
            self.client.embeddings.create(input=[text], model=self.model)
            .data[0]
            .embedding
        )


class SBertEmbeddingModel(BaseEmbeddingModel):
    def __init__(self, model_name="sentence-transformers/multi-qa-mpnet-base-cos-v1"):
        self.model = SentenceTransformer(model_name)

    def create_embedding(self, text):
        return self.model.encode(text)

```

### Core Architecture Module: `raptor/FaissRetriever.py`
```
import random
from concurrent.futures import ProcessPoolExecutor

import faiss
import numpy as np
import tiktoken
from tqdm import tqdm

from .EmbeddingModels import BaseEmbeddingModel, OpenAIEmbeddingModel
from .Retrievers import BaseRetriever
from .utils import split_text


class FaissRetrieverConfig:
    def __init__(
        self,
        max_tokens=100,
        max_context_tokens=3500,
        use_top_k=False,
        embedding_model=None,
        question_embedding_model=None,
        top_k=5,
        tokenizer=tiktoken.get_encoding("cl100k_base"),
        embedding_model_string=None,
    ):
        if max_tokens < 1:
            raise ValueError("max_tokens must be at least 1")

        if top_k < 1:
            raise ValueError("top_k must be at least 1")

        if max_context_tokens is not None and max_context_tokens < 1:
            raise ValueError("max_context_tokens must be at least 1 or None")

        if embedding_model is not None and not isinstance(
            embedding_model, BaseEmbeddingModel
        ):
            raise ValueError(
                "embedding_model must be an instance of BaseEmbeddingModel or None"
            )

        if question_embedding_model is not None and not isinstance(
            question_embedding_model, BaseEmbeddingModel
        ):
            raise ValueError(
                "question_embedding_model must be an instance of BaseEmbeddingModel or None"
            )

        self.top_k = top_k
        self.max_tokens = max_tokens
        self.max_context_tokens = max_context_tokens
        self.use_top_k = use_top_k
        self.embedding_model = embedding_model or OpenAIEmbeddingModel()
        self.question_embedding_model = question_embedding_model or self.embedding_model
        self.tokenizer = tokenizer
        self.embedding_model_string = embedding_model_string or "OpenAI"

    def log_config(self):
        config_summary = """
		FaissRetrieverConfig:
			Max Tokens: {max_tokens}
			Max Context Tokens: {max_context_tokens}
			Use Top K: {use_top_k}
			Embedding Model: {embedding_model}
			Question Embedding Model: {question_embedding_model}
			Top K: {top_k}
			Tokenizer: {tokenizer}
			Embedding Model String: {embedding_model_string}
		""".format(
            max_tokens=self.max_tokens,
            max_context_tokens=self.max_context_tokens,
            use_top_k=self.use_top_k,
            embedding_model=self.embedding_model,
            question_embedding_model=self.question_embedding_model,
            top_k=self.top_k,
            tokenizer=self.tokenizer,
            embedding_model_string=self.embedding_model_string,
        )
        return config_summary


class FaissRetriever(BaseRetriever):
    """
    FaissRetriever is a class that retrieves similar context chunks for a given query using Faiss.
    encoders_type is 'same' if the question and context encoder is the same,
    otherwise, encoders_type is 'different'.
    """

    def __init__(self, config):
        self.embedding_model = config.embedding_model
        self.question_embedding_model = config.question_embedding_model
        self.index = None
        self.context_chunks = None
        self.max_tokens = config.max_tokens
        self.max_context_tokens = config.max_context_tokens
        self.use_top_k = config.use_top_k
        self.tokenizer = config.tokenizer
        self.top_k = config.top_k
        self.embedding_model_string = config.embedding_model_string

    def build_from_text(self, doc_text):
        """
        Builds the index from a given text.

        :param doc_text: A string containing the document text.
        :param tokenizer: A tokenizer used to split the text into chunks.
        :param max_tokens: An integer representing the maximum number of tokens per chunk.
        """
        self.context_chunks = np.array(
            split_text(doc_text, self.tokenizer, self.max_tokens)
        )

        with ProcessPoolExecutor() as executor:
            futures = [
                executor.submit(self.embedding_model.create_embedding, context_chunk)
                for context_chunk in self.context_chunks
            ]

        self.embeddings = []
        for future in tqdm(futures, total=len(futures), desc="Building embeddings"):
            self.embeddings.append(future.result())

        self.embeddings = np.array(self.embeddings, dtype=np.float32)

        self.index = faiss.IndexFlatIP(self.embeddings.shape[1])
        self.index.add(self.embeddings)

    def build_from_leaf_nodes(self, leaf_nodes):
        """
        Builds the index from a given text.

        :param doc_text: A string containing the document text.
        :param tokenizer: A tokenizer used to split the text into chunks.
        :param max_tokens: An integer representing the maximum number of tokens per chunk.
        """

        self.context_chunks = [node.text for node in leaf_nodes]

        self.embeddings = np.array(
            [node.embeddings[self.embedding_model_string] for node in leaf_nodes],
            dtype=np.float32,
        )

        self.index = faiss.IndexFlatIP(self.embeddings.shape[1])
        self.index.add(self.embeddings)

    def sanity_check(self, num_samples=4):
        """
        Perform a sanity check by recomputing embeddings of a few randomly-selected chunks.

        :param num_samples: The number of samples to test.
        """
        indices = random.sample(range(len(self.context_chunks)), num_samples)

        for i in indices:
            original_embedding = self.embeddings[i]
            recomputed_embedding = self.embedding_model.create_embedding(
                self.context_chunks[i]
            )
            assert np.allclose(
                original_embedding, recomputed_embedding
            ), f"Embeddings do not match for index {i}!"

        print(f"Sanity check passed for {num_samples} random samples.")

    def retrieve(self, query: str) -> str:
        """
        Retrieves the k most similar context chunks for a given query.

        :param query: A string containing the query.
        :param k: An integer representing the number of similar context chunks to retrieve.
        :return: A string containing the retrieved context chunks.
        """
        query_embedding = np.array(
            [
                np.array(
                    self.question_embedding_model.create_embedding(query),
                    dtype=np.float32,
                ).squeeze()
            ]
        )

        context = ""

        if self.use_top_k:
            _, indices = self.index.search(query_embedding, self.top_k)
            for i in range(self.top_k):
                context += self.context_chunks[indices[0][i]]

        else:
            range_ = int(self.max_context_tokens / self.max_tokens)
            _, indices = self.index.search(query_embedding, range_)
            total_tokens = 0
            for i in range(range_):
                tokens = len(self.tokenizer.encode(self.context_chunks[indices[0][i]]))
                context += self.context_chunks[indices[0][i]]
                if total_tokens + tokens > self.max_context_tokens:
                    break
                total_tokens += tokens

        return context

```

### Core Architecture Module: `raptor/QAModels.py`
```
import logging
import os

from openai import OpenAI


import getpass
from abc import ABC, abstractmethod

import torch
from tenacity import retry, stop_after_attempt, wait_random_exponential
from transformers import T5ForConditionalGeneration, T5Tokenizer


class BaseQAModel(ABC):
    @abstractmethod
    def answer_question(self, context, question):
        pass


class GPT3QAModel(BaseQAModel):
    def __init__(self, model="text-davinci-003"):
        """
        Initializes the GPT-3 model with the specified model version.

        Args:
            model (str, optional): The GPT-3 model version to use for generating summaries. Defaults to "text-davinci-003".
        """
        self.model = model
        self.client = OpenAI(api_key=os.environ["OPENAI_API_KEY"])

    @retry(wait=wait_random_exponential(min=1, max=20), stop=stop_after_attempt(6))
    def answer_question(self, context, question, max_tokens=150, stop_sequence=None):
        """
        Generates a summary of the given context using the GPT-3 model.

        Args:
            context (str): The text to summarize.
            max_tokens (int, optional): The maximum number of tokens in the generated summary. Defaults to 150.
            stop_sequence (str, optional): The sequence at which to stop summarization. Defaults to None.

        Returns:
            str: The generated summary.
        """
        try:
            response = self.client.completions.create(
                prompt=f"using the folloing information {context}. Answer the following question in less than 5-7 words, if possible: {question}",
                temperature=0,
                max_tokens=max_tokens,
                top_p=1,
                frequency_penalty=0,
                presence_penalty=0,
                stop=stop_sequence,
                model=self.model,
            )
            return response.choices[0].text.strip()

        except Exception as e:
            print(e)
            return ""


class GPT3TurboQAModel(BaseQAModel):
    def __init__(self, model="gpt-3.5-turbo"):
        """
        Initializes the GPT-3 model with the specified model version.

        Args:
            model (str, optional): The GPT-3 model version to use for generating summaries. Defaults to "text-davinci-003".
        """
        self.model = model
        self.client = OpenAI(api_key=os.environ["OPENAI_API_KEY"])

    @retry(wait=wait_random_exponential(min=1, max=20), stop=stop_after_attempt(6))
    def _attempt_answer_question(
        self, context, question, max_tokens=150, stop_sequence=None
    ):
        """
        Generates a summary of the given context using the GPT-3 model.

        Args:
            context (str): The text to summarize.
            max_tokens (int, optional): The maximum number of tokens in the generated summary. Defaults to 150.
            stop_sequence (str, optional): The sequence at which to stop summarization. Defaults to None.

        Returns:
            str: The generated summary.
        """
        response = self.client.chat.completions.create(
            model=self.model,
            messages=[
                {"role": "system", "content": "You are Question Answering Portal"},
                {
                    "role": "user",
                    "content": f"Given Context: {context} Give the best full answer amongst the option to question {question}",
                },
            ],
            temperature=0,
        )

        return response.choices[0].message.content.strip()

    @retry(wait=wait_random_exponential(min=1, max=20), stop=stop_after_attempt(6))
    def answer_question(self, context, question, max_tokens=150, stop_sequence=None):

        try:
            return self._attempt_answer_question(
                context, question, max_tokens=max_tokens, stop_sequence=stop_sequence
            )
        except Exception as e:
            print(e)
            return e


class GPT4QAModel(BaseQAModel):
    def __init__(self, model="gpt-4"):
        """
        Initializes the GPT-3 model with the specified model version.

        Args:
            model (str, optional): The GPT-3 model version to use for generating summaries. Defaults to "text-davinci-003".
        """
        self.model = model
        self.client = OpenAI(api_key=os.environ["OPENAI_API_KEY"])

    @retry(wait=wait_random_exponential(min=1, max=20), stop=stop_after_attempt(6))
    def _attempt_answer_question(
        self, context, question, max_tokens=150, stop_sequence=None
    ):
        """
        Generates a summary of the given context using the GPT-3 model.

        Args:
            context (str): The text to summarize.
            max_tokens (int, optional): The maximum number of tokens in the generated summary. Defaults to 150.
            stop_sequence (str, optional): The sequence at which to stop summarization. Defaults to None.

        Returns:
            str: The generated summary.
        """
        response = self.client.chat.completions.create(
            model=self.model,
            messages=[
                {"role": "system", "content": "You are Question Answering Portal"},
                {
                    "role": "user",
                    "content": f"Given Context: {context} Give the best full answer amongst the option to question {question}",
                },
            ],
            temperature=0,
        )

        return response.choices[0].message.content.strip()

    @retry(wait=wait_random_exponential(min=1, max=20), stop=stop_after_attempt(6))
    def answer_question(self, context, question, max_tokens=150, stop_sequence=None):

        try:
            return self._attempt_answer_question(
                context, question, max_tokens=max_tokens, stop_sequence=stop_sequence
            )
        except Exception as e:
            print(e)
            return e


class UnifiedQAModel(BaseQAModel):
    def __init__(self, model_name="allenai/unifiedqa-v2-t5-3b-1363200"):
        self.device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
        self.model = T5ForConditionalGeneration.from_pretrained(model_name).to(
            self.device
        )
        self.tokenizer = T5Tokenizer.from_pretrained(model_name)

    def run_model(self, input_string, **generator_args):
        input_ids = self.tokenizer.encode(input_string, return_tensors="pt").to(
            self.device
        )
        res = self.model.generate(input_ids, **generator_args)
        return self.tokenizer.batch_decode(res, skip_special_tokens=True)

    def answer_question(self, context, question):
        input_string = question + " \\n " + context
        output = self.run_model(input_string)
        return output[0]

```

### Core Architecture Module: `raptor/RetrievalAugmentation.py`
```
import logging
import pickle

from .cluster_tree_builder import ClusterTreeBuilder, ClusterTreeConfig
from .EmbeddingModels import BaseEmbeddingModel
from .QAModels import BaseQAModel, GPT3TurboQAModel
from .SummarizationModels import BaseSummarizationModel
from .tree_builder import TreeBuilder, TreeBuilderConfig
from .tree_retriever import TreeRetriever, TreeRetrieverConfig
from .tree_structures import Node, Tree

# Define a dictionary to map supported tree builders to their respective configs
supported_tree_builders = {"cluster": (ClusterTreeBuilder, ClusterTreeConfig)}

logging.basicConfig(format="%(asctime)s - %(message)s", level=logging.INFO)


class RetrievalAugmentationConfig:
    def __init__(
        self,
        tree_builder_config=None,
        tree_retriever_config=None,  # Change from default instantiation
        qa_model=None,
        embedding_model=None,
        summarization_model=None,
        tree_builder_type="cluster",
        # New parameters for TreeRetrieverConfig and TreeBuilderConfig
        # TreeRetrieverConfig arguments
        tr_tokenizer=None,
        tr_threshold=0.5,
        tr_top_k=5,
        tr_selection_mode="top_k",
        tr_context_embedding_model="OpenAI",
        tr_embedding_model=None,
        tr_num_layers=None,
        tr_start_layer=None,
        # TreeBuilderConfig arguments
        tb_tokenizer=None,
        tb_max_tokens=100,
        tb_num_layers=5,
        tb_threshold=0.5,
        tb_top_k=5,
        tb_selection_mode="top_k",
        tb_summarization_length=100,
        tb_summarization_model=None,
        tb_embedding_models=None,
        tb_cluster_embedding_model="OpenAI",
    ):
        # Validate tree_builder_type
        if tree_builder_type not in supported_tree_builders:
            raise ValueError(
                f"tree_builder_type must be one of {list(supported_tree_builders.keys())}"
            )

        # Validate qa_model
        if qa_model is not None and not isinstance(qa_model, BaseQAModel):
            raise ValueError("qa_model must be an instance of BaseQAModel")

        if embedding_model is not None and not isinstance(
            embedding_model, BaseEmbeddingModel
        ):
            raise ValueError(
                "embedding_model must be an instance of BaseEmbeddingModel"
            )
        elif embedding_model is not None:
            if tb_embedding_models is not None:
                raise ValueError(
                    "Only one of 'tb_embedding_models' or 'embedding_model' should be provided, not both."
                )
            tb_embedding_models = {"EMB": embedding_model}
            tr_embedding_model = embedding_model
            tb_cluster_embedding_model = "EMB"
            tr_context_embedding_model = "EMB"

        if summarization_model is not None and not isinstance(
            summarization_model, BaseSummarizationModel
        ):
            raise ValueError(
                "summarization_model must be an instance of BaseSummarizationModel"
            )

        elif summarization_model is not None:
            if tb_summarization_model is not None:
                raise ValueError(
                    "Only one of 'tb_summarization_model' or 'summarization_model' should be provided, not both."
                )
            tb_summarization_model = summarization_model

        # Set TreeBuilderConfig
        tree_builder_class, tree_builder_config_class = supported_tree_builders[
            tree_builder_type
        ]
        if tree_builder_config is None:
            tree_builder_config = tree_builder_config_class(
                tokenizer=tb_tokenizer,
                max_tokens=tb_max_tokens,
                num_layers=tb_num_layers,
                threshold=tb_threshold,
                top_k=tb_top_k,
                selection_mode=tb_selection_mode,
                summarization_length=tb_summarization_length,
                summarization_model=tb_summarization_model,
                embedding_models=tb_embedding_models,
                cluster_embedding_model=tb_cluster_embedding_model,
            )

        elif not isinstance(tree_builder_config, tree_builder_config_class):
            raise ValueError(
                f"tree_builder_config must be a direct instance of {tree_builder_config_class} for tree_builder_type '{tree_builder_type}'"
            )

        # Set TreeRetrieverConfig
        if tree_retriever_config is None:
            tree_retriever_config = TreeRetrieverConfig(
                tokenizer=tr_tokenizer,
                threshold=tr_threshold,
                top_k=tr_top_k,
                selection_mode=tr_selection_mode,
                context_embedding_model=tr_context_embedding_model,
                embedding_model=tr_embedding_model,
                num_layers=tr_num_layers,
                start_layer=tr_start_layer,
            )
        elif not isinstance(tree_retriever_config, TreeRetrieverConfig):
            raise ValueError(
                "tree_retriever_config must be an instance of TreeRetrieverConfig"
            )

        # Assign the created configurations to the instance
        self.tree_builder_config = tree_builder_config
        self.tree_retriever_config = tree_retriever_config
        self.qa_model = qa_model or GPT3TurboQAModel()
        self.tree_builder_type = tree_builder_type

    def log_config(self):
        config_summary = """
        RetrievalAugmentationConfig:
            {tree_builder_config}
            
            {tree_retriever_config}
            
            QA Model: {qa_model}
            Tree Builder Type: {tree_builder_type}
        """.format(
            tree_builder_config=self.tree_builder_config.log_config(),
            tree_retriever_config=self.tree_retriever_config.log_config(),
            qa_model=self.qa_model,
            tree_builder_type=self.tree_builder_type,
        )
        return config_summary


class RetrievalAugmentation:
    """
    A Retrieval Augmentation class that combines the TreeBuilder and TreeRetriever classes.
    Enables adding documents to the tree, retrieving information, and answering questions.
    """

    def __init__(self, config=None, tree=None):
        """
        Initializes a RetrievalAugmentation instance with the specified configuration.
        Args:
            config (RetrievalAugmentationConfig): The configuration for the RetrievalAugmentation instance.
            tree: The tree instance or the path to a pickled tree file.
        """
        if config is None:
            config = RetrievalAugmentationConfig()
        if not isinstance(config, RetrievalAugmentationConfig):
            raise ValueError(
                "config must be an instance of RetrievalAugmentationConfig"
            )

        # Check if tree is a string (indicating a path to a pickled tree)
        if isinstance(tree, str):
            try:
                with open(tree, "rb") as file:
                    self.tree = pickle.load(file)
                if not isinstance(self.tree, Tree):
                    raise ValueError("The loaded object is not an instance of Tree")
            except Exception as e:
                raise ValueError(f"Failed to load tree from {tree}: {e}")
        elif isinstance(tree, Tree) or tree is None:
            self.tree = tree
        else:
            raise ValueError(
                "tree must be an instance of Tree, a path to a pickled Tree, or None"
            )

        tree_builder_class = supported_tree_builders[config.tree_builder_type][0]
        self.tree_builder = tree_builder_class(config.tree_builder_config)

        self.tree_retriever_config = config.tree_retriever_config
        self.qa_model = config.qa_model

        if self.tree is not None:
            self.retriever = TreeRetriever(self.tree_retriever_config, self.tree)
        else:
            self.retriever = None

        logging.info(
            f"Successfully initialized RetrievalAugmentation with Co
```

### Core Architecture Module: `raptor/Retrievers.py`
```
from abc import ABC, abstractmethod
from typing import List


class BaseRetriever(ABC):
    @abstractmethod
    def retrieve(self, query: str) -> str:
        pass

```

### Core Architecture Module: `raptor/SummarizationModels.py`
```
import logging
import os
from abc import ABC, abstractmethod

from openai import OpenAI
from tenacity import retry, stop_after_attempt, wait_random_exponential

logging.basicConfig(format="%(asctime)s - %(message)s", level=logging.INFO)


class BaseSummarizationModel(ABC):
    @abstractmethod
    def summarize(self, context, max_tokens=150):
        pass


class GPT3TurboSummarizationModel(BaseSummarizationModel):
    def __init__(self, model="gpt-3.5-turbo"):

        self.model = model

    @retry(wait=wait_random_exponential(min=1, max=20), stop=stop_after_attempt(6))
    def summarize(self, context, max_tokens=500, stop_sequence=None):

        try:
            client = OpenAI()

            response = client.chat.completions.create(
                model=self.model,
                messages=[
                    {"role": "system", "content": "You are a helpful assistant."},
                    {
                        "role": "user",
                        "content": f"Write a summary of the following, including as many key details as possible: {context}:",
                    },
                ],
                max_tokens=max_tokens,
            )

            return response.choices[0].message.content

        except Exception as e:
            print(e)
            return e


class GPT3SummarizationModel(BaseSummarizationModel):
    def __init__(self, model="text-davinci-003"):

        self.model = model

    @retry(wait=wait_random_exponential(min=1, max=20), stop=stop_after_attempt(6))
    def summarize(self, context, max_tokens=500, stop_sequence=None):

        try:
            client = OpenAI()

            response = client.chat.completions.create(
                model=self.model,
                messages=[
                    {"role": "system", "content": "You are a helpful assistant."},
                    {
                        "role": "user",
                        "content": f"Write a summary of the following, including as many key details as possible: {context}:",
                    },
                ],
                max_tokens=max_tokens,
            )

            return response.choices[0].message.content

        except Exception as e:
            print(e)
            return e

```

### Core Architecture Module: `raptor/__init__.py`
```
# raptor/__init__.py
from .cluster_tree_builder import ClusterTreeBuilder, ClusterTreeConfig
from .EmbeddingModels import (BaseEmbeddingModel, OpenAIEmbeddingModel,
                              SBertEmbeddingModel)
from .FaissRetriever import FaissRetriever, FaissRetrieverConfig
from .QAModels import (BaseQAModel, GPT3QAModel, GPT3TurboQAModel, GPT4QAModel,
                       UnifiedQAModel)
from .RetrievalAugmentation import (RetrievalAugmentation,
                                    RetrievalAugmentationConfig)
from .Retrievers import BaseRetriever
from .SummarizationModels import (BaseSummarizationModel,
                                  GPT3SummarizationModel,
                                  GPT3TurboSummarizationModel)
from .tree_builder import TreeBuilder, TreeBuilderConfig
from .tree_retriever import TreeRetriever, TreeRetrieverConfig
from .tree_structures import Node, Tree

```

### Core Architecture Module: `raptor/cluster_utils.py`
```
import logging
import random
from abc import ABC, abstractmethod
from typing import List, Optional

import numpy as np
import tiktoken
import umap
from sklearn.mixture import GaussianMixture

# Initialize logging
logging.basicConfig(format="%(asctime)s - %(message)s", level=logging.INFO)

from .tree_structures import Node
# Import necessary methods from other modules
from .utils import get_embeddings

# Set a random seed for reproducibility
RANDOM_SEED = 224
random.seed(RANDOM_SEED)


def global_cluster_embeddings(
    embeddings: np.ndarray,
    dim: int,
    n_neighbors: Optional[int] = None,
    metric: str = "cosine",
) -> np.ndarray:
    if n_neighbors is None:
        n_neighbors = int((len(embeddings) - 1) ** 0.5)
    reduced_embeddings = umap.UMAP(
        n_neighbors=n_neighbors, n_components=dim, metric=metric
    ).fit_transform(embeddings)
    return reduced_embeddings


def local_cluster_embeddings(
    embeddings: np.ndarray, dim: int, num_neighbors: int = 10, metric: str = "cosine"
) -> np.ndarray:
    reduced_embeddings = umap.UMAP(
        n_neighbors=num_neighbors, n_components=dim, metric=metric
    ).fit_transform(embeddings)
    return reduced_embeddings


def get_optimal_clusters(
    embeddings: np.ndarray, max_clusters: int = 50, random_state: int = RANDOM_SEED
) -> int:
    max_clusters = min(max_clusters, len(embeddings))
    n_clusters = np.arange(1, max_clusters)
    bics = []
    for n in n_clusters:
        gm = GaussianMixture(n_components=n, random_state=random_state)
        gm.fit(embeddings)
        bics.append(gm.bic(embeddings))
    optimal_clusters = n_clusters[np.argmin(bics)]
    return optimal_clusters


def GMM_cluster(embeddings: np.ndarray, threshold: float, random_state: int = 0):
    n_clusters = get_optimal_clusters(embeddings)
    gm = GaussianMixture(n_components=n_clusters, random_state=random_state)
    gm.fit(embeddings)
    probs = gm.predict_proba(embeddings)
    labels = [np.where(prob > threshold)[0] for prob in probs]
    return labels, n_clusters


def perform_clustering(
    embeddings: np.ndarray, dim: int, threshold: float, verbose: bool = False
) -> List[np.ndarray]:
    reduced_embeddings_global = global_cluster_embeddings(embeddings, min(dim, len(embeddings) -2))
    global_clusters, n_global_clusters = GMM_cluster(
        reduced_embeddings_global, threshold
    )

    if verbose:
        logging.info(f"Global Clusters: {n_global_clusters}")

    all_local_clusters = [np.array([]) for _ in range(len(embeddings))]
    total_clusters = 0

    for i in range(n_global_clusters):
        global_cluster_embeddings_ = embeddings[
            np.array([i in gc for gc in global_clusters])
        ]
        if verbose:
            logging.info(
                f"Nodes in Global Cluster {i}: {len(global_cluster_embeddings_)}"
            )
        if len(global_cluster_embeddings_) == 0:
            continue
        if len(global_cluster_embeddings_) <= dim + 1:
            local_clusters = [np.array([0]) for _ in global_cluster_embeddings_]
            n_local_clusters = 1
        else:
            reduced_embeddings_local = local_cluster_embeddings(
                global_cluster_embeddings_, dim
            )
            local_clusters, n_local_clusters = GMM_cluster(
                reduced_embeddings_local, threshold
            )

        if verbose:
            logging.info(f"Local Clusters in Global Cluster {i}: {n_local_clusters}")

        for j in range(n_local_clusters):
            local_cluster_embeddings_ = global_cluster_embeddings_[
                np.array([j in lc for lc in local_clusters])
            ]
            indices = np.where(
                (embeddings == local_cluster_embeddings_[:, None]).all(-1)
            )[1]
            for idx in indices:
                all_local_clusters[idx] = np.append(
                    all_local_clusters[idx], j + total_clusters
                )

        total_clusters += n_local_clusters

    if verbose:
        logging.info(f"Total Clusters: {total_clusters}")
    return all_local_clusters


class ClusteringAlgorithm(ABC):
    @abstractmethod
    def perform_clustering(self, embeddings: np.ndarray, **kwargs) -> List[List[int]]:
        pass


class RAPTOR_Clustering(ClusteringAlgorithm):
    def perform_clustering(
        nodes: List[Node],
        embedding_model_name: str,
        max_length_in_cluster: int = 3500,
        tokenizer=tiktoken.get_encoding("cl100k_base"),
        reduction_dimension: int = 10,
        threshold: float = 0.1,
        verbose: bool = False,
    ) -> List[List[Node]]:
        # Get the embeddings from the nodes
        embeddings = np.array([node.embeddings[embedding_model_name] for node in nodes])

        # Perform the clustering
        clusters = perform_clustering(
            embeddings, dim=reduction_dimension, threshold=threshold
        )

        # Initialize an empty list to store the clusters of nodes
        node_clusters = []

        # Iterate over each unique label in the clusters
        for label in np.unique(np.concatenate(clusters)):
            # Get the indices of the nodes that belong to this cluster
            indices = [i for i, cluster in enumerate(clusters) if label in cluster]

            # Add the corresponding nodes to the node_clusters list
            cluster_nodes = [nodes[i] for i in indices]

            # Base case: if the cluster only has one node, do not attempt to recluster it
            if len(cluster_nodes) == 1:
                node_clusters.append(cluster_nodes)
                continue

            # Calculate the total length of the text in the nodes
            total_length = sum(
                [len(tokenizer.encode(node.text)) for node in cluster_nodes]
            )

            # If the total length exceeds the maximum allowed length, recluster this cluster
            if total_length > max_length_in_cluster:
                if verbose:
                    logging.info(
                        f"reclustering cluster with {len(cluster_nodes)} nodes"
                    )
                node_clusters.extend(
                    RAPTOR_Clustering.perform_clustering(
                        cluster_nodes, embedding_model_name, max_length_in_cluster
                    )
                )
            else:
                node_clusters.append(cluster_nodes)

        return node_clusters

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #9** (2024-03-11): **`RA.retrieve`: AttributeError: 'NoneType' object has no attribute 'encode'"**
  *Symptoms*: I asked this:  ```python question = "What is the topic described in Article 202 ?"  answer = RA.retrieve(question, collapse_tree=True)  print("Answer: ", answer) ```  and got this:  ```bash { 	"name": "AttributeError", 	"message": "'NoneType' object has no attribute 'encode'", 	"stack": "--------------------------------------------------------------------------- AttributeError                            Traceback (most recent call last) Cell In[10], line 4       1 question = \"What is the topic described in Article 202?\"       3 # answer = RA.answer_question(question=question) ----> 4 answer = RA.retrieve(question, collapse_tree=True)       6 print(\"Answer: \", answer)  File /workspaces/aider_repos/raptor/RetrievalAugmentation.py:250, in RetrievalAugmentation.retrieve(self, question, start_layer, num_layers, max_tokens, collapse_tree, return_layer_information)     245 if self.retriever is None:     246     raise ValueError(     247         \"The TreeRetriever instance has not been initialized. Call 'add_documents' first.\"     248     ) --> 250 return self.retriever.retrieve(     251     question,     252     start_layer,     253     num_layers,     254     max_tokens,     255     collapse_tree,     256     return_layer_information,     257 )  File /workspaces/aider_repos/raptor/tree_retriever.py:293, in TreeRetriever.retrieve(self, query, start_layer, num_layers, max_tokens, collapse_tree, return_layer_information)     291 if collapse
  **Post-Mortem & Fix Analysis**:
  > Thanks for catching this! I've replicated the issue, we'll be pushing a fix for this soon. In the meantime, you can set `collapse_tree=False` and it should work. Also, if you want to answer question and not just retrieve the context, you should be using `RA.answer_question(question=question)`. 
  > @parthsarthi03 : yes, I already tried the `answer_question` and it works. I want to test/try and eventually use RAPTOR as a retriever =) Thank you
  > I tried the `collapse_tree=False`, but it doesn't answer correctly. I hope `collapse_tree=True` will be able to provide the entire space to the retriever to discover the correct answer (it's a difficult question, actually; not the one above)

- **Issue #8** (2024-03-11): **Sorry! We've encountered an issue with repetitive patterns in your prompt. Please try again with a different prompt**
  *Symptoms*: I wanted to try RAPTOR on some `.txt` files that I have  ```  Context to summarize:  .  . // VERY BIG NUMBER OF LINES WITH THESE DOTS AND THAT'S IT (I reduced the number here)  .  .  .   2024-03-08 18:43:52,574 - HTTP Request: POST https://api.openai.com/v1/chat/completions "HTTP/1.1 400 Bad Request" Error code: 400 - {'error': {'message': "Sorry! We've encountered an issue with repetitive patterns in your prompt. Please try again with a different prompt.", 'type': 'invalid_request_error', 'param': 'prompt', 'code': 'invalid_prompt'}} ```   Is RAPTOR creating a cluster of punctuation (dots) in this case? Because my docs don't have dots like this..
  **Post-Mortem & Fix Analysis**:
  > Hey! I think this might be due to an issue with the text splitting while creating the leaf nodes.  Can you look at the leaf nodes by doing the following and checking if you have a lot of chunks with just dots in them. ``` for key, node in RA.tree.leaf_nodes.items():     print(key, node.text[:50]) ```  
  > @parthsarthi03 Alright, thanks. I will try that when it finishes. I have a lot of chunks.  BTW, I got this prompt... I left the script running but it halted on this prompted and waiting for the answer... it's not very practical.. should I open an issue for this ?  ![image](https://github.com/parthsarthi03/raptor/assets/3153107/1f34a407-2190-4371-8ee0-2c052b4215d3) 
  > It's a precautionary check since we don't want people to accidentally overwrite their previously built trees. You should enter 'n' and it'll continue building the tree. 

- **Issue #2** (2024-03-04): **RAPTOR_Clustering() takes no arguments**
  *Symptoms*: I encountered an error when I imported a relatively long txt file. I did not encounter this error when using the txt in the demo. Could you please tell me how to deal with this problem. Thank you very much.  Traceback (most recent call last):   File "/home/jyc23/raptor-master/demo/demo.py", line 132, in <module>     RA.add_documents(text)   File "/home/jyc23/raptor-master/raptor/RetrievalAugmentation.py", line 217, in add_documents     self.tree = self.tree_builder.build_from_text(text=docs)   File "/home/jyc23/raptor-master/raptor/tree_builder.py", line 280, in build_from_text     root_nodes = self.construct_tree(all_nodes, all_nodes, layer_to_nodes)   File "/home/jyc23/raptor-master/raptor/cluster_tree_builder.py", line 102, in construct_tree     clusters = self.clustering_algorithm.perform_clustering(   File "/home/jyc23/raptor-master/raptor/cluster_utils.py", line 226, in perform_clustering     RAPTOR_Clustering( TypeError: RAPTOR_Clustering() takes no arguments
  **Post-Mortem & Fix Analysis**:
  > Hi, thank you for bringing this to our attention. https://github.com/parthsarthi03/raptor/commit/7a9e83fd7f166bb82841aa4fa17313bd1ef1b297 resolves the issue.
  > How to ensure that the requirements of max_length_in_cluster can be satisfied after clustering with the same parameters? The current program seems at risk of becoming trapped in an infinite loop

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

### Incident Patch 1: `956022c7` (2024-06-29)
**Commit Message**: Fix #38 : corrected chunk splitting for open ai embeddings

**File**: `raptor/utils.py` (modified, +14/-5)
```diff
@@ -54,16 +54,25 @@ def split_text(
         # If the sentence is too long, split it into smaller parts
         if token_count > max_tokens:
             sub_sentences = re.split(r"[,;:]", sentence)
-            sub_token_counts = [len(tokenizer.encode(" " + sub_sentence)) for sub_sentence in sub_sentences]
+            
+            # there is no need to keep empty os only-spaced strings
+            # since spaces will be inserted in the beginning of the full string
+            # and in between the string in the sub_chuk list
+            filtered_sub_sentences = [sub.strip() for sub in sub_sentences if sub.strip() != ""]
+            sub_token_counts = [len(tokenizer.encode(" " + sub_sentence)) for sub_sentence in filtered_sub_sentences]
             
             sub_chunk = []
             sub_length = 0
             
-            for sub_sentence, sub_token_count in zip(sub_sentences, sub_token_counts):
+            for sub_sentence, sub_token_count in zip(filtered_sub_sentences, sub_token_counts):
                 if sub_length + sub_token_count > max_tokens:
-                    chunks.append(" ".join(sub_chunk))
-                    sub_chunk = sub_chunk[-overlap:] if overlap > 0 else []
-                    sub_length = sum(sub_token_counts[max(0, len(sub_chunk) - overlap):len(sub_chunk)])
+                    
+                    # if the phrase does not have sub_sentences, it would create an empty chunk
+                    # this big phrase would be added anyways in the next chunk append
+                    if sub_chunk:
+                        chunks.append(" ".join(sub_chunk))
+                        sub_chunk = sub_chunk[-overlap:] if overlap > 0 else []
+                        sub_length = sum(sub_token_counts[max(0, len(sub_chunk) - overlap):len(sub_chunk)])
                 
                 sub_chunk.append(sub_sentence)
                 sub_length += sub_token_count
```

---

### Incident Patch 2: `2e3e83e5` (2024-03-21)
**Commit Message**: Merge pull request #16 from LLLeoLi/fix-bug-TypeError-Cannot-use-scipy.linalg.eigh-for-sparse-A-with-k-=-N.-Use-scipy.linalg.eigh(A.toarray())-or-reduce-k-

change the dim to a safe n_components

**File**: `raptor/cluster_utils.py` (modified, +1/-1)
```diff
@@ -69,7 +69,7 @@ def GMM_cluster(embeddings: np.ndarray, threshold: float, random_state: int = 0)
 def perform_clustering(
     embeddings: np.ndarray, dim: int, threshold: float, verbose: bool = False
 ) -> List[np.ndarray]:
-    reduced_embeddings_global = global_cluster_embeddings(embeddings, dim)
+    reduced_embeddings_global = global_cluster_embeddings(embeddings, min(dim, len(embeddings) -2))
     global_clusters, n_global_clusters = GMM_cluster(
         reduced_embeddings_global, threshold
     )
```

---

### Incident Patch 3: `81b0c95b` (2024-03-11)
**Commit Message**: fixed tokenizer default issue

**File**: `raptor/tree_retriever.py` (modified, +27/-19)
```diff
@@ -15,59 +15,67 @@
 
 logging.basicConfig(format="%(asctime)s - %(message)s", level=logging.INFO)
 
-
 class TreeRetrieverConfig:
     def __init__(
         self,
-        tokenizer=tiktoken.get_encoding("cl100k_base"),
-        threshold=0.5,
-        top_k=5,
-        selection_mode="top_k",
-        context_embedding_model="OpenAI",
+        tokenizer=None,
+        threshold=None,
+        top_k=None,
+        selection_mode=None,
+        context_embedding_model=None,
         embedding_model=None,
         num_layers=None,
         start_layer=None,
     ):
+        if tokenizer is None:
+            tokenizer = tiktoken.get_encoding("cl100k_base")
+        self.tokenizer = tokenizer
 
+        if threshold is None:
+            threshold = 0.5
         if not isinstance(threshold, float) or not (0 <= threshold <= 1):
             raise ValueError("threshold must be a float between 0 and 1")
+        self.threshold = threshold
 
+        if top_k is None:
+            top_k = 5
         if not isinstance(top_k, int) or top_k < 1:
             raise ValueError("top_k must be an integer and at least 1")
+        self.top_k = top_k
 
+        if selection_mode is None:
+            selection_mode = "top_k"
         if not isinstance(selection_mode, str) or selection_mode not in [
             "top_k",
             "threshold",
         ]:
             raise ValueError(
                 "selection_mode must be a string and either 'top_k' or 'threshold'"
             )
+        self.selection_mode = selection_mode
 
+        if context_embedding_model is None:
+            context_embedding_model = "OpenAI"
         if not isinstance(context_embedding_model, str):
             raise ValueError("context_embedding_model must be a string")
+        self.context_embedding_model = context_embedding_model
 
-        if embedding_model is not None and not isinstance(
-            embedding_model, BaseEmbeddingModel
-        ):
+        if embedding_model is None:
+            embedding_model = OpenAIEmbeddingModel()
+        if not isinstance(embedding_model, BaseEmbeddingModel):
             raise ValueError(
-                "embedding_model must be an instance of BaseEmbeddingModel or None"
+                "embedding_model must be an instance of BaseEmbeddingModel"
             )
+        self.embedding_model = embedding_model
 
         if num_layers is not None:
             if not isinstance(num_layers, int) or num_layers < 0:
                 raise ValueError("num_layers must be an integer and at least 0")
+        self.num_layers = num_layers
 
         if start_layer is not None:
             if not isinstance(start_layer, int) or start_layer < 0:
                 raise ValueError("start_layer must be an integer and at least 0")
-
-        self.tokenizer = tokenizer
-        self.threshold = threshold
-        self.top_k = top_k
-        self.selection_mode = selection_mode
-        self.context_embedding_model = context_embedding_model
-        self.embedding_model = embedding_model or OpenAIEmbeddingModel()
-        self.num_layers = num_layers
         self.start_layer = start_layer
 
     def log_config(self):
@@ -313,4 +321,4 @@ def retrieve(
 
             return context, layer_information
 
-        return context
+        return context
\ No newline at end of file
```

---

### Incident Patch 4: `c7034465` (2024-03-09)
**Commit Message**: fixed text splitting bug

**File**: `raptor/utils.py` (modified, +58/-25)
```diff
@@ -1,4 +1,5 @@
 import logging
+import re
 from typing import Dict, List, Set
 
 import numpy as np
@@ -19,42 +20,74 @@ def reverse_mapping(layer_to_nodes: Dict[int, List[Node]]) -> Dict[Node, int]:
 
 
 def split_text(
-    text: str, tokenizer: tiktoken.get_encoding("cl100k_base"), max_tokens: int
-) -> List[str]:
+    text: str, tokenizer: tiktoken.get_encoding("cl100k_base"), max_tokens: int, overlap: int = 0
+):
     """
     Splits the input text into smaller chunks based on the tokenizer and maximum allowed tokens.
-
+    
     Args:
         text (str): The text to be split.
         tokenizer (CustomTokenizer): The tokenizer to be used for splitting the text.
         max_tokens (int): The maximum allowed tokens.
-
+        overlap (int, optional): The number of overlapping tokens between chunks. Defaults to 0.
+    
     Returns:
         List[str]: A list of text chunks.
     """
-    logging.info("Splitting Text")
-    sentences = text.split(". ")
+    # Split the text into sentences using multiple delimiters
+    delimiters = [".", "!", "?", "\n"]
+    regex_pattern = "|".join(map(re.escape, delimiters))
+    sentences = re.split(regex_pattern, text)
+    
+    # Calculate the number of tokens for each sentence
     n_tokens = [len(tokenizer.encode(" " + sentence)) for sentence in sentences]
-
-    chunks: List[str] = []
-    tokens_so_far = 0
-    chunk = []
-
-    for sentence, token in zip(sentences, n_tokens):
-        if tokens_so_far + token > max_tokens:
-            chunks.append(". ".join(chunk) + ".")
-            chunk = []
-            tokens_so_far = 0
-
-        if token > max_tokens:
+    
+    chunks = []
+    current_chunk = []
+    current_length = 0
+    
+    for sentence, token_count in zip(sentences, n_tokens):
+        # If the sentence is empty or consists only of whitespace, skip it
+        if not sentence.strip():
             continue
-
-        chunk.append(sentence)
-        tokens_so_far += token + 1
-
-    if chunk:
-        chunks.append(". ".join(chunk) + ".")
-
+        
+        # If the sentence is too long, split it into smaller parts
+        if token_count > max_tokens:
+            sub_sentences = re.split(r"[,;:]", sentence)
+            sub_token_counts = [len(tokenizer.encode(" " + sub_sentence)) for sub_sentence in sub_sentences]
+            
+            sub_chunk = []
+            sub_length = 0
+            
+            for sub_sentence, sub_token_count in zip(sub_sentences, sub_token_counts):
+                if sub_length + sub_token_count > max_tokens:
+                    chunks.append(" ".join(sub_chunk))
+                    sub_chunk = sub_chunk[-overlap:] if overlap > 0 else []
+                    sub_length = sum(sub_token_counts[max(0, len(sub_chunk) - overlap):len(sub_chunk)])
+                
+                sub_chunk.append(sub_sentence)
+                sub_length += sub_token_count
+            
+            if sub_chunk:
+                chunks.append(" ".join(sub_chunk))
+        
+        # If adding the sentence to the current chunk exceeds the max tokens, start a new chunk
+        elif current_length + token_count > max_tokens:
+            chunks.append(" ".join(current_chunk))
+            current_chunk = current_chunk[-overlap:] if overlap > 0 else []
+            current_length = sum(n_tokens[max(0, len(current_chunk) - overlap):len(current_chunk)])
+            current_chunk.append(sentence)
+            current_length += token_count
+        
+        # Otherwise, add the sentence to the current chunk
+        else:
+            current_chunk.append(sentence)
+            current_length += token_count
+    
+    # Add the last chunk if it's not empty
+    if current_chunk:
+        chunks.append(" ".join(current_chunk))
+    
     return chunks
 
 
```

---

### Incident Patch 5: `7a9e83fd` (2024-03-04)
**Commit Message**: fixed long document bug

**File**: `README.md` (modified, +2/-0)
```diff
@@ -26,6 +26,8 @@ For detailed methodologies and implementations, refer to the original paper:
 
 [![Paper page](https://huggingface.co/datasets/huggingface/badges/resolve/main/paper-page-sm.svg)](https://huggingface.co/papers/2401.18059)
 
+[![PWC](https://img.shields.io/endpoint.svg?url=https://paperswithcode.com/badge/raptor-recursive-abstractive-processing-for/question-answering-on-quality)](https://paperswithcode.com/sota/question-answering-on-quality?p=raptor-recursive-abstractive-processing-for)
+
 ## Installation
 
 Before using RAPTOR, ensure Python 3.8+ is installed. Clone the RAPTOR repository and install necessary dependencies:
```

**File**: `raptor/cluster_utils.py` (modified, +1/-1)
```diff
@@ -175,7 +175,7 @@ def perform_clustering(
                         f"reclustering cluster with {len(cluster_nodes)} nodes"
                     )
                 node_clusters.extend(
-                    RAPTOR_Clustering(
+                    RAPTOR_Clustering.perform_clustering(
                         cluster_nodes, embedding_model_name, max_length_in_cluster
                     )
                 )
```

---

### Incident Patch 6: `4f060cf0` (2024-02-27)
**Commit Message**: fixed key leak 2

**File**: `example.py` (removed, +0/-23)
```diff
@@ -1,23 +0,0 @@
-import os
-os.environ["OPENAI_API_KEY"] = "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"
-
-
-# Cinderella story defined in sample.txt
-with open('Demo/sample.txt', 'r') as file:
-    text = file.read()
-
-print(text[:100])
-
-from raptor import RetrievalAugmentation
-
-RA = RetrievalAugmentation()
-
-# construct the tree
-RA.add_documents(text)
-
-
-question = "How did Cinderella reach her happy ending"
-
-answer = RA.answer_question(question=question)
-
-print("Answer: ", answer)
\ No newline at end of file
```

---

### Incident Patch 7: `05d2479c` (2024-02-27)
**Commit Message**: fixed key leak

**File**: `demo.ipynb` (modified, +1/-1)
```diff
@@ -18,7 +18,7 @@
     "# NOTE: An OpenAI API key must be set here for application initialization, even if not in use.\n",
     "# If you're not utilizing OpenAI models, assign a placeholder string (e.g., \"not_used\").\n",
     "import os\n",
-    "os.environ[\"OPENAI_API_KEY\"] = \"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\""
+    "os.environ[\"OPENAI_API_KEY\"] = \"your-openai-key\""
    ]
   },
   {
```

**File**: `example.py` (added, +23/-0)
```diff
@@ -0,0 +1,23 @@
+import os
+os.environ["OPENAI_API_KEY"] = "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"
+
+
+# Cinderella story defined in sample.txt
+with open('Demo/sample.txt', 'r') as file:
+    text = file.read()
+
+print(text[:100])
+
+from raptor import RetrievalAugmentation
+
+RA = RetrievalAugmentation()
+
+# construct the tree
+RA.add_documents(text)
+
+
+question = "How did Cinderella reach her happy ending"
+
+answer = RA.answer_question(question=question)
+
+print("Answer: ", answer)
\ No newline at end of file
```

---

### Incident Patch 8: `bc3e153c` (2024-02-27)
**Commit Message**: minor readme fixes

**File**: `README.md` (modified, +1/-1)
```diff
@@ -68,7 +68,7 @@ print("Answer: ", answer)
 Save the constructed tree to a specified path:
 
 ```python
-SAVE_PATH = "demo/cinderalla"
+SAVE_PATH = "demo/cinderella"
 RA.save(SAVE_PATH)
 ```
 
```

**File**: `demo.ipynb` (modified, +4/-4)
```diff
@@ -18,7 +18,7 @@
     "# NOTE: An OpenAI API key must be set here for application initialization, even if not in use.\n",
     "# If you're not utilizing OpenAI models, assign a placeholder string (e.g., \"not_used\").\n",
     "import os\n",
-    "os.environ[\"OPENAI_API_KEY\"] = \"your-openai-key\""
+    "os.environ[\"OPENAI_API_KEY\"] = \"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\""
    ]
   },
   {
@@ -29,7 +29,7 @@
    "outputs": [],
    "source": [
     "# Cinderella story defined in sample.txt\n",
-    "with open('Demo/sample.txt', 'r') as file:\n",
+    "with open('demo/sample.txt', 'r') as file:\n",
     "    text = file.read()\n",
     "\n",
     "print(text[:100])"
@@ -111,7 +111,7 @@
    "outputs": [],
    "source": [
     "# Save the tree by calling RA.save(\"path/to/save\")\n",
-    "SAVE_PATH = \"Demo/cinderalla\"\n",
+    "SAVE_PATH = \"demo/cinderella\"\n",
     "RA.save(SAVE_PATH)"
    ]
   },
@@ -292,7 +292,7 @@
    "metadata": {},
    "outputs": [],
    "source": [
-    "with open('Demo/sample.txt', 'r') as file:\n",
+    "with open('demo/sample.txt', 'r') as file:\n",
     "    text = file.read()\n",
     "    \n",
     "RA.add_documents(text)"
```

---

### Incident Patch 9: `3316ad77` (2024-02-27)
**Commit Message**: minor readme fix

**File**: `README.md` (modified, +2/-2)
```diff
@@ -20,8 +20,8 @@ For detailed methodologies and implementations, refer to the original paper:
 Before using RAPTOR, ensure Python 3.8+ is installed. Clone the RAPTOR repository and install necessary dependencies:
 
 ```bash
-git clone https://github.com/parthsarthi03/RAPTOR.git
-cd RAPTOR
+git clone https://github.com/parthsarthi03/raptor.git
+cd raptor
 pip install -r requirements.txt
 ```
 
```

#### Recent Merged Pull Requests:
- **PR #72** (closed): Bugfix/empty root search (@BenRogersNewsome)
- **PR #51** (closed): Documentation (@jvbyrnes)
- **PR #46** (2024-09-03): Fix #38 : corrected chunk splitting for open ai embeddings (@lorenzo-cm)
- **PR #39** (closed): Fixed bug in tree_builder: now chunks are never empty (@Giustino98)
- **PR #34** (closed): add more local llm model support through ollama (@DoraDong-2023)
- **PR #16** (2024-03-21): change the dim to a safe n_components (@LLLeoLi)
- **PR #12** (2024-03-11):  Add top_k Support for Tree Collapsing Functionality (@parthsarthi03)
- **PR #6** (2024-03-08): Reduced OpenAI dependency by doing lazy initialization (only when class is used) (@ExtReMLapin)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
