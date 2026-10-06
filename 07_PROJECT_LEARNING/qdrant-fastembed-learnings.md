# Forensic Learning Record (Deep Inspection): qdrant/fastembed

> **Canonical Artifact**: `07_PROJECT_LEARNING/qdrant-fastembed-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/qdrant/fastembed](https://github.com/qdrant/fastembed))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-06T05:17:32.569Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `qdrant/fastembed`
- **Description**: Fast, Accurate, Lightweight Python library to make State of the Art Embedding
- **Primary Language / Ecosystem**: Python
- **Discovered Manifests / Configurations**: pyproject.toml, README.md
- **Stars / Engagement**: 3236 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: pyproject.toml, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `fastembed/common/preprocessor_utils.py`
```
import json
import sys
from typing import Any, Iterator
from pathlib import Path

from tokenizers import AddedToken, Tokenizer

from fastembed.image.transform.operators import Compose


def load_special_tokens(model_dir: Path) -> dict[str, Any]:
    """Read special_tokens_map.json, treating an absent file as an empty map."""
    tokens_map_path = model_dir / "special_tokens_map.json"
    if not tokens_map_path.exists():
        return {}

    with open(str(tokens_map_path)) as tokens_map_file:
        tokens_map = json.load(tokens_map_file)

    return tokens_map


def iter_special_tokens(tokens_map: dict[str, Any]) -> Iterator[str | dict[str, Any]]:
    """Yield the individual tokens declared in a special tokens map.

    Most keys hold one token, but `additional_special_tokens` holds a list of them.
    """
    for value in tokens_map.values():
        if isinstance(value, list):
            yield from value
        else:
            yield value


def _valid_context(value: Any) -> int | None:
    """Return `value` if it can be used as a truncation limit, `None` otherwise.

    Config files do not always carry a real limit: transformers writes `model_max_length` as
    1e30 when the value is unknown, and some repos ship a 0 or a null. `enable_truncation`
    raises an `OverflowError` on the former and silently produces empty encodings on the
    latter, so both are rejected here rather than passed through.
    """
    if isinstance(value, bool) or not isinstance(value, int):
        return None
    if not 0 < value <= sys.maxsize:
        return None
    return value


def _resolve_max_context(tokenizer_config: dict[str, Any], model_dir: Path) -> int:
    """Pick the truncation limit, preferring the stricter of the two tokenizer config keys.

    `config.json:max_position_embeddings` deliberately is not used as a fallback: it is the size
    of the position table, not the usable context, and the two differ per architecture, e.g.
    roberta reports 514 for a usable 512.
    """
    candidates = [
        context
        for context in (
            _valid_context(tokenizer_config.get("model_max_length")),
            _valid_context(tokenizer_config.get("max_length")),
        )
        if context is not None
    ]
    if not candidates:
        raise ValueError(
            f"Could not determine the maximum context length for {model_dir}. Set a positive "
            "`model_max_length` or `max_length` in tokenizer_config.json."
        )

    return min(candidates)


def load_tokenizer(model_dir: Path) -> tuple[Tokenizer, dict[str, int]]:
    tokenizer_path = model_dir / "tokenizer.json"
    if not tokenizer_path.exists():
        raise ValueError(f"Could not find tokenizer.json in {model_dir}")

    tokenizer_config_path = model_dir / "tokenizer_config.json"
    if not tokenizer_config_path.exists():
        raise ValueError(f"Could not find tokenizer_config.json in {model_dir}")

    # config.json is optional: transformers v5 no longer writes it for every model.
    config_path = model_dir / "config.json"
    config: dict[str, Any] = {}
    if config_path.exists():
        with open(str(config_path)) as config_file:
            config = json.load(config_file)

    with open(str(tokenizer_config_path)) as tokenizer_config_file:
        tokenizer_config = json.load(tokenizer_config_file)

    max_context = _resolve_max_context(tokenizer_config, model_dir)

    tokens_map = load_special_tokens(model_dir)

    tokenizer = Tokenizer.from_file(str(tokenizer_path))
    # enable_truncation resets the direction to right unless it is passed. The direction is
    # resolved as in transformers: tokenizer_config.json, then tokenizer.json, then right.
    truncation = tokenizer.truncation or {}
    tokenizer.enable_truncation(
        max_length=max_context,
        direction=tokenizer_config.get("truncation_side") or truncation.get("direction", "right"),
    )

    # Registered before the padding is resolved: the map may name a pad token that
    # tokenizer.json does not carry, and it only gets an id once it is added.
    for token in iter_special_tokens(tokens_map):
        if isinstance(token, str):
            tokenizer.add_special_tokens([token])
        elif isinstance(token, dict):
            tokenizer.add_special_tokens([AddedToken(**token)])

    # Padding is always normalized to batch-longest. A serialized fixed length shorter than the
    # truncation limit leaves longer encodings untouched, which produces ragged batches, and a
    # fixed length equal to it pads every batch to the maximum. Pad token metadata is taken from
    # the serialized settings. The direction follows transformers: `padding_side` from
    # tokenizer_config.json wins over the serialized direction, since some models pad on the left
    # and set it only in the config.
    padding = tokenizer.padding or {}
    pad_token = padding.get("pad_token") or tokenizer_config.get("pad_token")
    if pad_token is None:
        raise ValueError(f"Could not find a pad token for {model_dir}")

    # The vocabulary is the last resort, not a hardcoded 0: that silently disagrees with
    # `pad_token` for every model whose pad token is not the first entry.
    pad_id = padding.get("pad_id", config.get("pad_token_id"))
    if pad_id is None:
        pad_id = tokenizer.token_to_id(pad_token)
    if pad_id is None:
        raise ValueError(f"Could not resolve an id for the pad token {pad_token!r} in {model_dir}")

    tokenizer.enable_padding(
        direction=tokenizer_config.get("padding_side") or padding.get("direction", "right"),
        pad_id=pad_id,
        pad_type_id=padding.get("pad_type_id", 0),
        pad_token=pad_token,
        pad_to_multiple_of=padding.get("pad_to_multiple_of"),
        length=None,
    )

    special_token_to_id = {
        token.content: token_id
        for token_id, token in tokenizer.get_added_tokens_decoder().items()
        if token.special
    }

    return tokenizer, special_token_to_id


def load_preprocessor(model_dir: Path) -> Compose:
    preprocessor_config_path = model_dir / "preprocessor_config.json"
    if not preprocessor_config_path.exists():
        raise ValueError(f"Could not find preprocessor_config.json in {model_dir}")

    with open(str(preprocessor_config_path)) as preprocessor_config_file:
        preprocessor_config = json.load(preprocessor_config_file)
        transforms = Compose.from_config(preprocessor_config)
    return transforms

```

### Core Architecture Module: `fastembed/common/utils.py`
```
import os
import sys
import re
import tempfile
import unicodedata
from pathlib import Path
from itertools import islice
from typing import Iterable, TypeVar

import numpy as np
from numpy.typing import NDArray

from fastembed.common.types import NumpyArray

T = TypeVar("T")


def normalize(input_array: NumpyArray, p: int = 2, dim: int = 1, eps: float = 1e-12) -> NumpyArray:
    if input_array.dtype == np.float16:
        # the sum of squares overflows float16 (max 65504) already for moderate values,
        # which turns the norm into inf and the embedding into zeros
        return normalize(input_array.astype(np.float32), p=p, dim=dim, eps=eps).astype(np.float16)

    # Calculate the Lp norm along the specified dimension
    norm = np.linalg.norm(input_array, ord=p, axis=dim, keepdims=True)
    norm = np.maximum(norm, eps)  # Avoid division by zero
    normalized_array = input_array / norm
    return normalized_array


def mean_pooling(input_array: NumpyArray, attention_mask: NDArray[np.int64]) -> NumpyArray:
    """Average the embeddings of the tokens which the attention mask marks as real.

    The sum is accumulated in float64, so the result is float64 for any input dtype,
    callers cast it back to the dtype of the model once post-processing is done.
    """
    # `where` skips the padding without materializing a (batch_size, seq_len, dim) mask
    sum_embeddings = np.sum(
        input_array, axis=1, where=attention_mask[:, :, np.newaxis].astype(bool), dtype=np.float64
    )
    sum_mask = np.sum(attention_mask, axis=1, keepdims=True)
    pooled_embeddings = sum_embeddings / np.maximum(sum_mask, 1e-9)
    return pooled_embeddings


def last_token_pooling(input_array: NumpyArray, attention_mask: NDArray[np.int64]) -> NumpyArray:
    """Take the embedding of the last non-padding token of each sequence.

    Locates the last position the attention mask marks as real, so it holds whichever
    side the tokenizer pads on.
    """
    last_token_indices = attention_mask.shape[1] - 1 - np.argmax(attention_mask[:, ::-1], axis=1)
    return input_array[np.arange(input_array.shape[0]), last_token_indices]


def iter_batch(iterable: Iterable[T], size: int) -> Iterable[list[T]]:
    """Validate the batch size immediately and consume the iterable lazily.

    >>> list(iter_batch([1,2,3,4,5], 3))
    [[1, 2, 3], [4, 5]]
    """
    if size < 1:
        raise ValueError(f"batch_size must be >= 1, got {size}")

    def batches() -> Iterable[list[T]]:
        source_iter = iter(iterable)
        while source_iter:
            b = list(islice(source_iter, size))
            if len(b) == 0:
                break
            yield b

    return batches()


def define_cache_dir(cache_dir: str | None = None) -> Path:
    """
    Define the cache directory for fastembed
    """
    if cache_dir is None:
        default_cache_dir = os.path.join(tempfile.gettempdir(), "fastembed_cache")
        cache_path = Path(os.getenv("FASTEMBED_CACHE_PATH", default_cache_dir))
    else:
        cache_path = Path(cache_dir)
    cache_path.mkdir(parents=True, exist_ok=True)

    return cache_path


def get_all_punctuation() -> set[str]:
    return set(
        chr(i) for i in range(sys.maxunicode) if unicodedata.category(chr(i)).startswith("P")
    )


def remove_non_alphanumeric(text: str) -> str:
    return re.sub(r"[^\w\s]", " ", text, flags=re.UNICODE)

```

### Core Architecture Module: `fastembed/sparse/utils/minicoil_encoder.py`
```
"""
Pure numpy implementation of encoder model for a single word.

This model is not trainable, and should only be used for inference.
"""

import numpy as np
from fastembed.common.types import NumpyArray


class Encoder:
    """
    Encoder(768, 4, 10000)

    Will look like this:


                                         Per-word
                                         Encoder Matrix
     ┌─────────────────────┐
     │ Token Embedding(768)├──────┐      (10k, 768, 4)
     └─────────────────────┘      │         ┌─────────┐
                                  │         │         │
     ┌─────────────────────┐      │       ┌─┴───────┐ │
     │                     │      │       │         │ │
     └─────────────────────┘      │     ┌─┴───────┐ │ │      ┌─────────┐
                                  └────►│         │ │ ├─────►│Tanh     │
     ┌─────────────────────┐            │         │ │ │      └─────────┘
     │                     │            │         │ ├─┘
     └─────────────────────┘            │         ├─┘
                                        │         │
     ┌─────────────────────┐            └─────────┘
     │                     │
     └─────────────────────┘

     Final linear transformation is accompanied by a non-linear activation function: Tanh.

     Tanh is used to ensure that the output is in the range [-1, 1].
     It would be easier to visually interpret the output of the model, assuming that each dimension
     would need to encode a type of semantic cluster.
    """

    def __init__(
        self,
        weights: NumpyArray,
    ):
        self.weights = weights
        self.vocab_size, self.input_dim, self.output_dim = weights.shape

        self.encoder_weights: NumpyArray = weights

        # Activation function
        self.activation = np.tanh

    @staticmethod
    def convert_vocab_ids(vocab_ids: NumpyArray) -> NumpyArray:
        """
        Convert vocab_ids of shape (batch_size, seq_len) into (batch_size, seq_len, 2)
        by appending batch_id alongside each vocab_id.
        """
        batch_size, seq_len = vocab_ids.shape
        batch_ids = np.arange(batch_size, dtype=vocab_ids.dtype).reshape(batch_size, 1)
        batch_ids = np.repeat(batch_ids, seq_len, axis=1)
        # Stack vocab_ids and batch_ids along the last dimension
        combined: NumpyArray = np.stack((vocab_ids, batch_ids), axis=2).astype(np.int32)
        return combined

    @classmethod
    def avg_by_vocab_ids(
        cls, vocab_ids: NumpyArray, embeddings: NumpyArray
    ) -> tuple[NumpyArray, NumpyArray]:
        """
        Takes:
            vocab_ids: (batch_size, seq_len) int array
            embeddings: (batch_size, seq_len, input_dim) float array

        Returns:
            unique_flattened_vocab_ids: (total_unique, 2) array of [vocab_id, batch_id]
            unique_flattened_embeddings: (total_unique, input_dim) averaged embeddings
        """
        input_dim = embeddings.shape[2]

        # Flatten vocab_ids and embeddings
        # flattened_vocab_ids: (batch_size*seq_len, 2)
        flattened_vocab_ids = cls.convert_vocab_ids(vocab_ids).reshape(-1, 2)

        # flattened_embeddings: (batch_size*seq_len, input_dim)
        flattened_embeddings = embeddings.reshape(-1, input_dim)

        # Find unique (vocab_id, batch_id) pairs
        unique_flattened_vocab_ids, inverse_indices = np.unique(
            flattened_vocab_ids, axis=0, return_inverse=True
        )

        # Prepare arrays to accumulate sums
        unique_count = unique_flattened_vocab_ids.shape[0]
        unique_flattened_embeddings = np.zeros((unique_count, input_dim), dtype=np.float32)
        unique_flattened_count = np.zeros(unique_count, dtype=np.int32)

        # Use np.add.at to accumulate sums based on inverse indices
        np.add.at(unique_flattened_embeddings, inverse_indices, flattened_embeddings)
        np.add.at(unique_flattened_count, inverse_indices, 1)

        # Compute averages
        unique_flattened_embeddings /= unique_flattened_count[:, None]

        return unique_flattened_vocab_ids.astype(np.int32), unique_flattened_embeddings.astype(
            np.float32
        )

    def forward(
        self, vocab_ids: NumpyArray, embeddings: NumpyArray
    ) -> tuple[NumpyArray, NumpyArray]:
        """
        Args:
            vocab_ids: (batch_size, seq_len) int array
            embeddings: (batch_size, seq_len, input_dim) float array

        Returns:
            unique_flattened_vocab_ids_and_batch_ids: (total_unique, 2)
            unique_flattened_encoded: (total_unique, output_dim)
        """
        # Average embeddings for duplicate vocab_ids
        unique_flattened_vocab_ids_and_batch_ids, unique_flattened_embeddings = (
            self.avg_by_vocab_ids(vocab_ids, embeddings)
        )

        # Select the encoder weights for each unique vocab_id
        unique_flattened_vocab_ids = unique_flattened_vocab_ids_and_batch_ids[:, 0].astype(
            np.int32
        )

        # unique_encoder_weights: (total_unique, input_dim, output_dim)
        unique_encoder_weights = self.encoder_weights[unique_flattened_vocab_ids]

        # Compute linear transform: (total_unique, output_dim)
        # Using Einstein summation for matrix multiplication:
        # 'bi,bio->bo' means: for each "b" (batch element), multiply embeddings (b,i) by weights (b,i,o) -> (b,o)
        unique_flattened_encoded = np.einsum(
            "bi,bio->bo", unique_flattened_embeddings, unique_encoder_weights
        )

        # Apply Tanh activation and ensure float32 type
        unique_flattened_encoded = self.activation(unique_flattened_encoded).astype(np.float32)

        return unique_flattened_vocab_ids_and_batch_ids.astype(np.int32), unique_flattened_encoded

```

### Core Architecture Module: `fastembed/sparse/utils/sparse_vectors_converter.py`
```
import copy
from dataclasses import dataclass

import mmh3
import numpy as np
from py_rust_stemmers import SnowballStemmer

from fastembed.common.utils import get_all_punctuation, remove_non_alphanumeric
from fastembed.sparse.sparse_embedding_base import SparseEmbedding

GAP = 32000
INT32_MAX = 2**31 - 1


@dataclass
class WordEmbedding:
    word: str
    forms: list[str]
    count: int
    word_id: int
    embedding: list[float]


class SparseVectorConverter:
    def __init__(
        self,
        stopwords: set[str],
        stemmer: SnowballStemmer,
        k: float = 1.2,
        b: float = 0.75,
        avg_len: float = 150.0,
    ):
        punctuation = set(get_all_punctuation())
        special_tokens = {"[CLS]", "[SEP]", "[PAD]", "[UNK]", "[MASK]"}

        self.stemmer = stemmer
        self.unwanted_tokens = punctuation | special_tokens | stopwords

        self.k = k
        self.b = b
        self.avg_len = avg_len

    @classmethod
    def unkn_word_token_id(
        cls, word: str, shift: int
    ) -> int:  # 2-3 words can collide in 1 index with this mapping, not considering mm3 collisions
        token_hash = abs(mmh3.hash(word))

        range_size = INT32_MAX - shift
        remapped_hash = shift + (token_hash % range_size)

        return remapped_hash

    def bm25_tf(self, num_occurrences: int, sentence_len: int) -> float:
        res = num_occurrences * (self.k + 1)
        res /= num_occurrences + self.k * (1 - self.b + self.b * sentence_len / self.avg_len)
        return res

    @classmethod
    def normalize_vector(cls, vector: list[float]) -> list[float]:
        norm = sum([x**2 for x in vector]) ** 0.5
        if norm < 1e-8:
            return vector
        return [x / norm for x in vector]

    def clean_words(
        self, sentence_embedding: dict[str, WordEmbedding], token_max_length: int = 40
    ) -> dict[str, WordEmbedding]:
        """
        Clean miniCOIL-produced sentence_embedding, as unknown to the miniCOIL's stemmer tokens should fully resemble
        our BM25 token representation.

        sentence_embedding = {"9°": {"word": "9°", "word_id": -1, "count": 2, "embedding": [1], "forms": ["9°"]},
                "9": {"word": "9", "word_id": -1, "count": 2, "embedding": [1], "forms": ["9"]},
                "bat": {"word": "bat", "word_id": 2, "count": 3, "embedding": [0.2, 0.1, -0.2, -0.2], "forms": ["bats", "bat"]},
                "9°9": {"word": "9°9", "word_id": -1, "count": 1, "embedding": [1], "forms": ["9°9"]},
                "screech": {"word": "screech", "word_id": -1, "count": 1, "embedding": [1], "forms": ["screech"]},
                "screeched": {"word": "screeched", "word_id": -1, "count": 1, "embedding": [1], "forms": ["screeched"]}
                }
        cleaned_embedding_ground_truth = {
                "9": {"word": "9", "word_id": -1, "count": 6, "embedding": [1], "forms": ["9°", "9", "9°9", "9°9"]},
                "bat": {"word": "bat", "word_id": 2, "count": 3, "embedding": [0.2, 0.1, -0.2, -0.2], "forms": ["bats", "bat"]},
                "screech": {"word": "screech", "word_id": -1, "count": 2, "embedding": [1], "forms": ["screech", "screeched"]}
                }
        """

        new_sentence_embedding: dict[str, WordEmbedding] = {}

        for word, embedding in sentence_embedding.items():
            # embedding = {
            #     "word": "vector",
            #     "forms": ["vector", "vectors"],
            #     "count": 2,
            #     "word_id": 1231,
            #     "embedding": [0.1, 0.2, 0.3, 0.4]
            # }
            if embedding.word_id > 0:
                # Known word, no need to clean
                new_sentence_embedding[word] = embedding
            else:
                # Unknown word
                if word in self.unwanted_tokens:
                    continue

                # Example complex word split:
                # word = `word^vec`
                word_cleaned = remove_non_alphanumeric(word).strip()
                # word_cleaned = `word vec`

                if len(word_cleaned) > 0:
                    # Subwords: ['word', 'vec']
                    for subword in word_cleaned.split():
                        stemmed_subword: str = self.stemmer.stem_word(subword)
                        if (
                            len(stemmed_subword) <= token_max_length
                            and stemmed_subword not in self.unwanted_tokens
                        ):
                            if stemmed_subword not in new_sentence_embedding:
                                new_sentence_embedding[stemmed_subword] = copy.deepcopy(embedding)
                                new_sentence_embedding[stemmed_subword].word = stemmed_subword
                            else:
                                new_sentence_embedding[stemmed_subword].count += embedding.count
                                new_sentence_embedding[stemmed_subword].forms += embedding.forms

        return new_sentence_embedding

    def embedding_to_vector(
        self,
        sentence_embedding: dict[str, WordEmbedding],
        embedding_size: int,
        vocab_size: int,
    ) -> SparseEmbedding:
        """
        Convert miniCOIL sentence embedding to Qdrant sparse vector

        Example input:

        ```
        {
            "vector": WordEmbedding({ // Vocabulary word, encoded with miniCOIL normally
                "word": "vector",
                "forms": ["vector", "vectors"],
                "count": 2,
                "word_id": 1231,
                "embedding": [0.1, 0.2, 0.3, 0.4]
            }),
            "axiotic": WordEmbedding({ // Out-of-vocabulary word, fallback to BM25
                "word": "axiotic",
                "forms": ["axiotics"],
                "count": 1,
                "word_id": -1,
            })
        }
        ```

        """

        indices: list[int] = []
        values: list[float] = []

        # Example:
        # vocab_size = 10000
        # embedding_size = 4
        # GAP = 32000
        #
        # We want to start random words section from the bucket, that is guaranteed to not
        # include any vocab words.
        # We need (vocab_size * embedding_size) slots for vocab words.
        # Therefore we need (vocab_size * embedding_size) // GAP + 1 buckets for vocab words.
        # Therefore, we can start random words from bucket (vocab_size * embedding_size) // GAP + 1 + 1

        # ID at which the scope of OOV words starts
        unknown_words_shift = ((vocab_size * embedding_size) // GAP + 2) * GAP
        sentence_embedding_cleaned = self.clean_words(sentence_embedding)

        # Calculate sentence length after cleaning
        sentence_len = 0
        for embedding in sentence_embedding_cleaned.values():
            sentence_len += embedding.count

        for embedding in sentence_embedding_cleaned.values():
            word_id = embedding.word_id
            num_occurrences = embedding.count
            tf = self.bm25_tf(num_occurrences, sentence_len)
            if (
                word_id > 0
            ):  # miniCOIL starts with ID 1, we generally won't have word_id == 0 (UNK), as we don't add
                # these words to sentence_embedding
                embedding_values = embedding.embedding
                normalized_embedding = self.normalize_vector(embedding_values)

                for val_id, value in enumerate(normalized_embedding):
                    indices.append(
                        word_id * embedding_size + val_id
                    )  # since miniCOIL IDs start with 1
                    values.append(value * tf)
            else:
                indices.append(self.unkn_word_token_id(embedding.word, unknown_words_shift))
                values.append(tf)

        return SparseEmbedding(
            indices=np.array(indices, dtype=np.int32),
            values=np.array(values, dtype=np.float32),
        )

    def embedding_to_vector_query(
        self,
        sentence_embedding: dict[str, WordEmbedding],
        embedding_size: int,
        vocab_size: int,
    ) -> SparseEmbedding:
        """
        Same as `embedding_to_vector`, but no TF
        """

        indices: list[int] = []
        values: list[float] = []

        # ID at which the scope of OOV words starts
        unknown_words_shift = ((vocab_size * embedding_size) // GAP + 2) * GAP

        sentence_embedding_cleaned = self.clean_words(sentence_embedding)

        for embedding in sentence_embedding_cleaned.values():
            word_id = embedding.word_id
            tf = 1.0

            if word_id >= 0:  # miniCOIL starts with ID 1
                embedding_values = embedding.embedding
                normalized_embedding = self.normalize_vector(embedding_values)

                for val_id, value in enumerate(normalized_embedding):
                    indices.append(
                        word_id * embedding_size + val_id
                    )  # since miniCOIL IDs start with 1
                    values.append(value * tf)
            else:
                indices.append(self.unkn_word_token_id(embedding.word, unknown_words_shift))
                values.append(tf)

        return SparseEmbedding(
            indices=np.array(indices, dtype=np.int32),
            values=np.array(values, dtype=np.float32),
        )

```

### Core Architecture Module: `fastembed/sparse/utils/tokenizer.py`
```
# This code is a modified copy of the `NLTKWordTokenizer` class from `NLTK` library.

import re


class SimpleTokenizer:
    @staticmethod
    def tokenize(text: str) -> list[str]:
        text = re.sub(r"[^\w]", " ", text.lower())
        text = re.sub(r"\s+", " ", text)

        return text.strip().split()


class WordTokenizer:
    """The tokenizer is "destructive" such that the regexes applied will munge the
    input string to a state beyond re-construction.
    """

    # Starting quotes.
    STARTING_QUOTES = [
        (re.compile("([«“‘„]|[`]+)", re.U), r" \1 "),
        (re.compile(r"^\""), r"``"),
        (re.compile(r"(``)"), r" \1 "),
        (re.compile(r"([ \(\[{<])(\"|\'{2})"), r"\1 `` "),
        (re.compile(r"(?i)(\')(?!re|ve|ll|m|t|s|d|n)(\w)\b", re.U), r"\1 \2"),
    ]

    # Ending quotes.
    ENDING_QUOTES = [
        (re.compile("([»”’])", re.U), r" \1 "),
        (re.compile(r"''"), " '' "),
        (re.compile(r'"'), " '' "),
        (re.compile(r"([^' ])('[sS]|'[mM]|'[dD]|') "), r"\1 \2 "),
        (re.compile(r"([^' ])('ll|'LL|'re|'RE|'ve|'VE|n't|N'T) "), r"\1 \2 "),
    ]

    # Punctuation.
    PUNCTUATION = [
        (re.compile(r'([^\.])(\.)([\]\)}>"\'' "»”’ " r"]*)\s*$", re.U), r"\1 \2 \3 "),
        (re.compile(r"([:,])([^\d])"), r" \1 \2"),
        (re.compile(r"([:,])$"), r" \1 "),
        (
            re.compile(r"\.{2,}", re.U),
            r" \g<0> ",
        ),
        (re.compile(r"[;@#$%&]"), r" \g<0> "),
        (
            re.compile(r'([^\.])(\.)([\]\)}>"\']*)\s*$'),
            r"\1 \2\3 ",
        ),  # Handles the final period.
        (re.compile(r"[?!]"), r" \g<0> "),
        (re.compile(r"([^'])' "), r"\1 ' "),
        (
            re.compile(r"[*]", re.U),
            r" \g<0> ",
        ),
    ]

    # Pads parentheses
    PARENS_BRACKETS = (re.compile(r"[\]\[\(\)\{\}\<\>]"), r" \g<0> ")
    DOUBLE_DASHES = (re.compile(r"--"), r" -- ")

    # List of contractions adapted from Robert MacIntyre's tokenizer.
    CONTRACTIONS2 = [
        re.compile(pattern)
        for pattern in (
            r"(?i)\b(can)(?#X)(not)\b",
            r"(?i)\b(d)(?#X)('ye)\b",
            r"(?i)\b(gim)(?#X)(me)\b",
            r"(?i)\b(gon)(?#X)(na)\b",
            r"(?i)\b(got)(?#X)(ta)\b",
            r"(?i)\b(lem)(?#X)(me)\b",
            r"(?i)\b(more)(?#X)('n)\b",
            r"(?i)\b(wan)(?#X)(na)(?=\s)",
        )
    ]
    CONTRACTIONS3 = [
        re.compile(pattern) for pattern in (r"(?i) ('t)(?#X)(is)\b", r"(?i) ('t)(?#X)(was)\b")
    ]

    @classmethod
    def tokenize(cls, text: str) -> list[str]:
        """Return a tokenized copy of `text`.

        >>> s = '''Good muffins cost $3.88 (roughly 3,36 euros)\nin New York.'''
        >>> WordTokenizer().tokenize(s)
        ['Good', 'muffins', 'cost', '$', '3.88', '(', 'roughly', '3,36', 'euros', ')', 'in', 'New', 'York', '.']

        Args:
            text: The text to be tokenized.

        Returns:
            A list of tokens.
        """
        for regexp, substitution in cls.STARTING_QUOTES:
            text = regexp.sub(substitution, text)

        for regexp, substitution in cls.PUNCTUATION:
            text = regexp.sub(substitution, text)

        # Handles parentheses.
        regexp, substitution = cls.PARENS_BRACKETS
        text = regexp.sub(substitution, text)

        # Handles double dash.
        regexp, substitution = cls.DOUBLE_DASHES
        text = regexp.sub(substitution, text)

        # add extra space to make things easier
        text = " " + text + " "

        for regexp, substitution in cls.ENDING_QUOTES:
            text = regexp.sub(substitution, text)

        for regexp in cls.CONTRACTIONS2:
            text = regexp.sub(r" \1 \2 ", text)
        for regexp in cls.CONTRACTIONS3:
            text = regexp.sub(r" \1 \2 ", text)
        return text.split()

```

### Core Architecture Module: `fastembed/sparse/utils/vocab_resolver.py`
```
from collections import defaultdict
from typing import Iterable

from py_rust_stemmers import SnowballStemmer
import numpy as np
from tokenizers import Tokenizer
from numpy.typing import NDArray

from fastembed.common.types import NumpyArray


class VocabTokenizerBase:
    def tokenize(self, sentence: str) -> NumpyArray:
        raise NotImplementedError()

    def convert_ids_to_tokens(self, token_ids: NumpyArray) -> list[str]:
        raise NotImplementedError()


class VocabTokenizer(VocabTokenizerBase):
    def __init__(self, tokenizer: Tokenizer):
        self.tokenizer = tokenizer

    def tokenize(self, sentence: str) -> NumpyArray:
        return np.array(self.tokenizer.encode(sentence).ids)

    def convert_ids_to_tokens(self, token_ids: NumpyArray) -> list[str]:
        tokens = []
        for token_id in token_ids:
            token = self.tokenizer.id_to_token(token_id)
            if token is None:
                raise ValueError(f"Token id {token_id} is not in the vocabulary")
            tokens.append(token)
        return tokens


class VocabResolver:
    def __init__(
        self, tokenizer: VocabTokenizerBase, stopwords: set[str], stemmer: SnowballStemmer
    ):
        # Word to id mapping
        self.vocab: dict[str, int] = {}
        # Id to word mapping
        self.words: list[str] = []
        # Lemma to word mapping
        self.stem_mapping: dict[str, str] = {}
        self.tokenizer: VocabTokenizerBase = tokenizer
        self.stemmer = stemmer
        self.stopwords: set[str] = stopwords

    def tokenize(self, sentence: str) -> NumpyArray:
        return self.tokenizer.tokenize(sentence)

    def lookup_word(self, word_id: int) -> str:
        if word_id == 0:
            return "UNK"
        return self.words[word_id - 1]

    def convert_ids_to_tokens(self, token_ids: NumpyArray) -> list[str]:
        return self.tokenizer.convert_ids_to_tokens(token_ids)

    def vocab_size(self) -> int:
        # We need +1 for UNK token
        return len(self.vocab) + 1

    def save_vocab(self, path: str) -> None:
        with open(path, "w") as f:
            for word in self.words:
                f.write(word + "\n")

    def save_json_vocab(self, path: str) -> None:
        import json

        with open(path, "w") as f:
            json.dump({"vocab": self.words, "stem_mapping": self.stem_mapping}, f, indent=2)

    def load_json_vocab(self, path: str) -> None:
        import json

        with open(path, "r") as f:
            data = json.load(f)
            self.words = data["vocab"]
            self.vocab = {word: idx + 1 for idx, word in enumerate(self.words)}
            self.stem_mapping = data["stem_mapping"]

    def add_word(self, word: str) -> None:
        if word not in self.vocab:
            self.vocab[word] = len(self.vocab) + 1
            self.words.append(word)
            stem = self.stemmer.stem_word(word)
            if stem not in self.stem_mapping:
                self.stem_mapping[stem] = word
            else:
                existing_word = self.stem_mapping[stem]
                if len(existing_word) > len(word):
                    # Prefer shorter words for the same stem
                    # Example: "swim" is preferred over "swimming"
                    self.stem_mapping[stem] = word

    def load_vocab(self, path: str) -> None:
        with open(path, "r") as f:
            for line in f:
                self.add_word(line.strip())

    @classmethod
    def _reconstruct_bpe(
        cls, bpe_tokens: Iterable[tuple[int, str]]
    ) -> list[tuple[str, list[int]]]:
        result: list[tuple[str, list[int]]] = []
        acc: str = ""
        acc_idx: list[int] = []

        continuing_subword_prefix = "##"
        continuing_subword_prefix_len = len(continuing_subword_prefix)

        for idx, token in bpe_tokens:
            if token.startswith(continuing_subword_prefix):
                acc += token[continuing_subword_prefix_len:]
                acc_idx.append(idx)
            else:
                if acc:
                    result.append((acc, acc_idx))
                    acc_idx = []
                acc = token
                acc_idx.append(idx)

        if acc:
            result.append((acc, acc_idx))
        return result

    def resolve_tokens(
        self, token_ids: NDArray[np.int64]
    ) -> tuple[NDArray[np.int64], dict[int, int], dict[str, int], dict[str, list[str]]]:
        """
        Mark known tokens (including composed tokens) with vocab ids.

        Args:
            token_ids: (seq_len) - list of ids of tokens
                Example:
                    [
                        101,  3897, 19332, 12718, 23348,
                        1010,  1996,  7151,  2296, 4845,
                        2359,  2005,  4234,  1010,  4332,
                        2871,  3191,  2062, 102
                    ]

            returns:
                - token_ids with vocab ids
                    [
                        0,  151, 151, 0, 0,
                        912,  0,  0,  0, 332,
                        332,  332,  0,  7121,  191,
                        0,  0,  332, 0
                    ]
                - counts of each token
                    {
                        151: 1,
                        332: 3,
                        7121: 1,
                        191: 1,
                        912: 1
                    }
                - oov counts of each token
                    {
                        "the": 1,
                        "a": 1,
                        "[CLS]": 1,
                        "[SEP]": 1,
                        ...
                    }
                - forms of each token
                    {
                        "hello": ["hello"],
                        "world": ["worlds", "world", "worlding"],
                    }

        """
        tokens = self.convert_ids_to_tokens(token_ids)
        tokens_mapping = self._reconstruct_bpe(enumerate(tokens))

        counts: dict[int, int] = defaultdict(int)
        oov_count: dict[str, int] = defaultdict(int)

        forms: dict[str, list[str]] = defaultdict(list)

        for token, mapped_token_ids in tokens_mapping:
            vocab_id = 0
            if token in self.stopwords:
                vocab_id = 0
            elif token in self.vocab:
                vocab_id = self.vocab[token]
                forms[token].append(token)
            elif token in self.stem_mapping:
                vocab_id = self.vocab[self.stem_mapping[token]]
                forms[self.stem_mapping[token]].append(token)
            else:
                stem = self.stemmer.stem_word(token)
                if stem in self.stem_mapping:
                    vocab_id = self.vocab[self.stem_mapping[stem]]
                    forms[self.stem_mapping[stem]].append(token)

            for token_id in mapped_token_ids:
                token_ids[token_id] = vocab_id

            if vocab_id == 0:
                oov_count[token] += 1
            else:
                counts[vocab_id] += 1
        return token_ids, counts, oov_count, forms

```

### Core Architecture Module: `experiments/attention_export.py`
```
from optimum.exporters.onnx import main_export
from transformers import AutoTokenizer

model_id = "sentence-transformers/paraphrase-MiniLM-L6-v2"
output_dir = f"models/{model_id.replace('/', '_')}"
model_kwargs = {"output_attentions": True, "return_dict": True}
tokenizer = AutoTokenizer.from_pretrained(model_id)

# export if the output model does not exist
# try:
#     sess = onnxruntime.InferenceSession(f"{output_dir}/model.onnx")
#     print("Model already exported")
# except FileNotFoundError:
print(f"Exporting model to {output_dir}")
main_export(
    model_id, output=output_dir, no_post_process=True, model_kwargs=model_kwargs
)

```

### Core Architecture Module: `experiments/if_splade_to_onnx.py`
```
"""Export an inference-free SPLADE document encoder to ONNX.

Converts `opensearch-project/opensearch-neural-sparse-encoding-doc-v3-gte` (an MLM head
over a GTE backbone) into an onnx model producing token logits, and assembles a model dir
with everything fastembed's `IfSplade` needs: model.onnx, tokenizer files and idf.json.

Usage:
    python experiments/if_splade_to_onnx.py --output-dir models/opensearch-neural-sparse-encoding-doc-v3-gte
"""

import argparse
import shutil
from pathlib import Path

import torch
from huggingface_hub import hf_hub_download
from transformers import AutoModelForMaskedLM, AutoTokenizer

MODEL_ID = "opensearch-project/opensearch-neural-sparse-encoding-doc-v3-gte"
# revision of the remote modeling code (Alibaba-NLP/new-impl), pinned in the model card
CODE_REVISION = "40ced75c3017eb27626c9d4ea981bde21a2662f4"

TOKENIZER_FILES = [
    "config.json",
    "tokenizer.json",
    "tokenizer_config.json",
    "special_tokens_map.json",
    "vocab.txt",
    "idf.json",
]


class LogitsOnly(torch.nn.Module):
    def __init__(self, model: torch.nn.Module):
        super().__init__()
        self.model = model

    def forward(self, input_ids: torch.Tensor, attention_mask: torch.Tensor) -> torch.Tensor:
        return self.model(input_ids=input_ids, attention_mask=attention_mask).logits


def export(model_id: str, output_dir: Path, opset: int = 14) -> Path:
    output_dir.mkdir(parents=True, exist_ok=True)

    model = AutoModelForMaskedLM.from_pretrained(
        model_id, trust_remote_code=True, code_revision=CODE_REVISION
    )
    model.eval()
    wrapped = LogitsOnly(model)

    tokenizer = AutoTokenizer.from_pretrained(model_id)
    dummy = tokenizer(
        ["fastembed is a library", "onnx export"],
        padding=True,
        truncation=True,
        return_tensors="pt",
        return_token_type_ids=False,
    )

    onnx_path = output_dir / "model.onnx"
    with torch.inference_mode():
        torch.onnx.export(
            wrapped,
            (dummy["input_ids"], dummy["attention_mask"]),
            f=onnx_path.as_posix(),
            input_names=["input_ids", "attention_mask"],
            output_names=["logits"],
            dynamic_axes={
                "input_ids": {0: "batch_size", 1: "sequence_length"},
                "attention_mask": {0: "batch_size", 1: "sequence_length"},
                "logits": {0: "batch_size", 1: "sequence_length"},
            },
            do_constant_folding=True,
            opset_version=opset,
            dynamo=False,
        )

    for file_name in TOKENIZER_FILES:
        local_path = hf_hub_download(repo_id=model_id, filename=file_name)
        shutil.copy(local_path, output_dir / file_name)

    return onnx_path


def parity_check(model_id: str, output_dir: Path) -> None:
    import numpy as np
    import onnxruntime as ort

    model = AutoModelForMaskedLM.from_pretrained(
        model_id, trust_remote_code=True, code_revision=CODE_REVISION
    )
    model.eval()
    tokenizer = AutoTokenizer.from_pretrained(model_id)

    documents = [
        "Currently New York is rainy.",
        "fastembed is a lightweight library for generating embeddings",
        "hello world",
    ]
    features = tokenizer(
        documents, padding=True, truncation=True, return_tensors="pt", return_token_type_ids=False
    )

    with torch.inference_mode():
        torch_logits = model(**features).logits.numpy()

    session = ort.InferenceSession(output_dir / "model.onnx")
    onnx_logits = session.run(
        ["logits"],
        {
            "input_ids": features["input_ids"].numpy(),
            "attention_mask": features["attention_mask"].numpy(),
        },
    )[0]

    max_diff = np.abs(torch_logits - onnx_logits).max()
    print(f"max |torch - onnx| logits diff: {max_diff}")
    assert max_diff < 1e-3, "onnx export does not match the torch model"


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--model-id", default=MODEL_ID)
    parser.add_argument("--output-dir", default=f"models/{MODEL_ID.replace('/', '_')}", type=Path)
    parser.add_argument("--opset", default=14, type=int)
    args = parser.parse_args()

    onnx_path = export(args.model_id, args.output_dir, args.opset)
    print(f"Exported to {onnx_path}")
    parity_check(args.model_id, args.output_dir)


if __name__ == "__main__":
    main()

```

### Core Architecture Module: `experiments/try_attention_export.py`
```
import numpy as np
import onnx
import onnxruntime
from transformers import AutoTokenizer

model_id = "sentence-transformers/paraphrase-MiniLM-L6-v2"
output_dir = f"models/{model_id.replace('/', '_')}"
model_kwargs = {"output_attentions": True, "return_dict": True}
tokenizer = AutoTokenizer.from_pretrained(model_id)

model_path = f"{output_dir}/model.onnx"
onnx_model = onnx.load(model_path)
ort_session = onnxruntime.InferenceSession(model_path)
text = "This is a test sentence"
tokenizer_output = tokenizer(text, return_tensors="np")
input_ids = tokenizer_output["input_ids"]
attention_mask = tokenizer_output["attention_mask"]
print(attention_mask)
# Prepare the input
input_ids = np.array(input_ids).astype(
    np.int64
)  # Replace your_input_ids with actual input data

# Run the ONNX model
outputs = ort_session.run(
    None, {"input_ids": input_ids, "attention_mask": attention_mask}
)

# Get the attention weights
attentions = outputs[-1]

# Print the attention weights for the first layer and first head
print(attentions[0][0])

```

### Core Architecture Module: `fastembed/__init__.py`
```
import importlib.metadata

from fastembed.image import ImageEmbedding
from fastembed.late_interaction import LateInteractionTextEmbedding
from fastembed.late_interaction_multimodal import LateInteractionMultimodalEmbedding
from fastembed.sparse import SparseEmbedding, SparseTextEmbedding
from fastembed.text import TextEmbedding

try:
    version = importlib.metadata.version("fastembed")
except importlib.metadata.PackageNotFoundError as _:
    version = importlib.metadata.version("fastembed-gpu")

__version__ = version
__all__ = [
    "TextEmbedding",
    "SparseTextEmbedding",
    "SparseEmbedding",
    "ImageEmbedding",
    "LateInteractionTextEmbedding",
    "LateInteractionMultimodalEmbedding",
]

```

### Core Architecture Module: `fastembed/common/__init__.py`
```
from fastembed.common.types import ImageInput, OnnxProvider, PathInput

__all__ = ["OnnxProvider", "ImageInput", "PathInput"]

```

### Core Architecture Module: `fastembed/common/model_description.py`
```
from dataclasses import dataclass, field
from enum import Enum
from typing import Any


@dataclass(frozen=True)
class ModelSource:
    hf: str | None = None
    url: str | None = None
    _deprecated_tar_struct: bool = False

    @property
    def deprecated_tar_struct(self) -> bool:
        return self._deprecated_tar_struct

    def __post_init__(self) -> None:
        if self.hf is None and self.url is None:
            raise ValueError(
                f"At least one source should be set, current sources: hf={self.hf}, url={self.url}"
            )


@dataclass(frozen=True)
class BaseModelDescription:
    model: str
    sources: ModelSource
    model_file: str
    description: str
    license: str
    size_in_GB: float
    additional_files: list[str] = field(default_factory=list)


@dataclass(frozen=True)
class DenseModelDescription(BaseModelDescription):
    dim: int | None = None
    tasks: dict[str, Any] | None = field(default_factory=dict)

    def __post_init__(self) -> None:
        assert self.dim is not None, "dim is required for dense model description"


@dataclass(frozen=True)
class SparseModelDescription(BaseModelDescription):
    requires_idf: bool | None = None
    vocab_size: int | None = None


class PoolingType(str, Enum):
    CLS = "CLS"
    MEAN = "MEAN"
    LAST_TOKEN = "LAST_TOKEN"
    DISABLED = "DISABLED"

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #749** (2026-10-02): **[Bug]: Bm42 and miniCOIL fail in parallel embedding with lazy_load=True**
  *Symptoms*: ### What happened?  With `lazy_load=True`, `embed(..., parallel=2)` crashes for `Qdrant/bm42-all-minilm-l6-v2-attentions` and `Qdrant/minicoil-v1`. The same call works with `lazy_load=False`, and SPLADE (`prithivida/Splade_PP_en_v1`) works either way. The `lazy_load` docstring on both classes recommends this exact combination: "Should be set to True when using multiple-gpu and parallel encoding."  In the parallel branch of `OnnxTextModel._embed_documents`, the workers run inference and send raw ONNX outputs back, and the parent process runs `_post_process_onnx_output` on them. The parent never calls `load_onnx_model()` on that path, so any state that post-processing reads and that only `load_onnx_model()` builds is missing:  - Bm42 needs `self.tokenizer` (read by `_reconstruct_bpe`) and `self.invert_vocab`. - miniCOIL needs `self.vocab_resolver`, `self.encoder`, and `self.sparse_vector_converter`, which `load_onnx_model()` builds from the vocab JSON and the `.npy` weights in the model directory.  SPLADE's post-processing only reads the ONNX output, which is why it isn't affected.  The existing `test_parallel_processing` tests don't catch this: the `model_cache` fixture builds models with the default `lazy_load=False`, so the parent has already loaded everything.  ### What is the expected behaviour?  `lazy_load=True` with `parallel` returns the same embeddings as `lazy_load=False`.  ### A minimal reproducible example  ```python from fastembed import SparseTextEmbedding  if __n

- **Issue #565** (2026-07-26): **qdrant-client: `set_model` attempts network connection despite `HF_HUB_OFFLINE=1` and local cache**
  *Symptoms*:  ---  ### **Title: qdrant-client: `set_model` attempts network connection despite `HF_HUB_OFFLINE=1` and local cache**  ## Current Behavior When the `HF_HUB_OFFLINE=1` environment variable is set, `QdrantClient.set_model()` still attempts to download the embedding model from Hugging Face. This fails in an offline environment, **even when the model is already present in the local cache**, preventing the client from initializing.  The logs paradoxically show `fastembed` reporting "offline mode is enabled" as the reason for a network connection failure, indicating that while the flag is recognized, the connection attempt is not being properly suppressed.  ## Steps to Reproduce 1.  Set up an environment with no internet access (e.g., a firewalled server or a Docker container).  2.  Set the environment variable: `export HF_HUB_OFFLINE=1`.  3.  Pre-download the embedding model into the specified cache directory (`/app/.cache/fastembed`).  4.  Confirm the model files are present in the cache. The directory structure and size should be verified:     ```bash     $ du -h -d 3 /app/.cache/fastembed/models--qdrant--paraphrase-multilingual-MiniLM-L12-v2-onnx-Q/          241M    /app/.cache/fastembed/models--qdrant--paraphrase-multilingual-MiniLM-L12-v2-onnx-Q/blobs     4.0K    /app/.cache/fastembed/models--qdrant--paraphrase-multilingual-MiniLM-L12-v2-onnx-Q/refs     20K     /app/.cache/fastembed/models--qdrant--paraphrase-multilingual-MiniLM-L12-v2-onnx-Q/snapshots/faf4aa4225822f3bc63768
  **Post-Mortem & Fix Analysis**:
  > I believe this is related to `fastembed`, so I'll move this issue there. Let me know if you think that is not correct.
  > #575 
  > Hey @koolay   Sorry for the late response, this should be fixed now. Two changes landed since the report: we try to load the model from cache before making any network calls at all (#577, available as of 0.7.4), and `HF_HUB_OFFLINE` is now respected and treated like `local_files_only=True` (#614, available as of 0.8.0).  Closing this as completed

- **Issue #410** (2024-12-30): **[Bug]: Shape Mismatch During Expand Operation in ColBERT ONNX Model**
  *Symptoms*: ### What happened?  I encountered a shape mismatch error when using ColBERT’s ONNX model to generate embeddings for a batch of text chunks. While most batches work fine, some cause the following error: `[E:onnxruntime:, sequential_executor.cc:516 ExecuteKernel] Non-zero status code returned while running Expand node. Name:'/bert/Expand' Status Message: /bert/Expand: left operand cannot broadcast on dim 1 LeftShape: {1,512}, RightShape: {18,513} `  In this case:  - 18 is the batch size passed to the model. - 512 and 513 refer to the token sequence lengths of the tensors being processed. - The issue appears to be related to the tokenization and batching process inside the model, as the input to the ONNX model is plain text, and tokenization happens internally.  ### What is the expected behaviour?  model should generate embeddings for the provided text.   ### A minimal reproducible example  _No response_  ### What Python version are you on? e.g. python --version  Python 3.10.15  ### FastEmbed version  FastEmbed 0.3.6  ### What os are you seeing the problem on?  Linux  ### Relevant stack traces and/or logs  ```shell 2024-11-21 10:10:48.454 | INFO     | app:embed_documents:61 - Received request to embed documents with 18 texts using model 'colbert' 2024-11-21 10:10:48.455 | INFO     | app:get_or_initialize_model:38 - Using cached model: colbert 2024-11-21 10:10:48.481 | ERROR    | app:embed_documents:71 - Error embedding documents: [ONNXRuntimeError] : 1 : FAIL : Non-zer
  **Post-Mortem & Fix Analysis**:
  > same error here also when trying to use AnswerdotAI  with vepsa.onnx  InvalidArgument: [ONNXRuntimeError] : 2 : INVALID_ARGUMENT : Non-zero status code returned while running Expand node. Name:'/bert/Expand' Status Message: invalid expand shape but with Jinaai/Colbertv2 it worked fine
  > Hey, Facing an issue while running the code snippet from the notebook qdrant/workshop-ultimate-hybrid-search, for batches having elements with large documents I get this error: ``` InvalidArgument: [ONNXRuntimeError] : 2 : INVALID_ARGUMENT : Non-zero status code returned while running Expand node. Name:'/bert/Expand' Status Message: invalid expand shape ```
  > same here , InvalidArgument: [ONNXRuntimeError] : 2 : INVALID_ARGUMENT : Non-zero status code returned while running Expand node. Name:'/bert/Expand' Status Message: invalid expand shape.   looks like it is expecting chunk sizes to be smaller??   However - good news is It works with jinaai/jina-colbert-v2 embedding model without any issues. 

- **Issue #407** (2024-12-17): **Error occurs when using late interaction model.**
  *Symptoms*: Hello,  I don't know if this is the right palce to raise an issue but, I tried following the demo from qdrant/[workshop-ultimate-hybrid-search](https://github.com/qdrant/workshop-ultimate-hybrid-search) and encountered an error as follows(didn't make any changes to the code provided): ![image](https://github.com/user-attachments/assets/bcc04d92-b843-4fb8-9fcb-99449af36100)  Many Thanks, 
  **Post-Mortem & Fix Analysis**:
  > hey there,   I am also facing kind of similar issue. I am processing texts batch_wise my batch_size is 20, for many batches late-interaction model is working fine but some batches in middle it is giving this error. Any idea how to resolve this issue?  `Error embedding documents: [ONNXRuntimeError] : 1 : FAIL : Non-zero status code returned while running Expand node. Name:'/bert/Expand' Status Message: /bert/Expand: left operand cannot broadcast on dim 1 LeftShape: {1,512}, RightShape: {20,513}`
  > Hey, thanks for rising the issue, we'll look into it
  > Recent commit solved the error. Closing the issue.

- **Issue #319** (2024-08-14): **Fix to avoid overfloat and get rid of model_max_length**
  *Symptoms*: Got rid of max_length=512 and parameter Replaced it with maxsize to work with [such](https://huggingface.co/Snowflake/snowflake-arctic-embed-s/blob/main/tokenizer_config.json) situations. Checkout `model_max_length`

- **Issue #204** (2024-07-17): **incorrect nomic embeddings**
  *Symptoms*: I was comparing the nomic embeddings and they are very different from the original version. ```python import pandas as pd from more_itertools import chunked from typing import List import numpy as np import torch.nn.functional as F from sentence_transformers import SentenceTransformer import torch import os from tqdm.notebook import tqdm import json from fastembed import SparseTextEmbedding, TextEmbedding  assert torch.cuda.is_available() SEED = 25  model = SentenceTransformer("nomic-ai/nomic-embed-text-v1.5", trust_remote_code=True)  def embed(texts: List[str]):     embeddings = model.encode(["clustering: " + t for t in texts], convert_to_tensor=True)     embeddings = F.layer_norm(embeddings, normalized_shape=(embeddings.shape[1],))     embeddings = F.normalize(embeddings, p=2, dim=1)     return embeddings.cpu().numpy()       import types embedding_model = TextEmbedding(model_name="nomic-ai/nomic-embed-text-v1.5")  def embed_fast(texts: List[str]):     embeddings = embedding_model.embed(["clustering: " + t for t in texts])     # Force computation if embed_func returns a generator     if isinstance(embeddings, types.GeneratorType):         embeddings = np.array(list(embeddings))     return embeddings ```  ```pycon res1 = embed(data) res1 array([[ 0.0478127 ,  0.07791077, -0.16337295, ..., -0.09588917,         -0.01815554, -0.0391101 ],        [ 0.00486873,  0.05552602, -0.17271836, ..., -0.06137123,         -0.01570066,  0.00191791],
  **Post-Mortem & Fix Analysis**:
  > Ohh, we missed this completely in our tests — I'll look into this. Thanks a ton for reporting this!
  > Same for nomic embed v1. Any planned resolution on this?
  > Hey @k4u5h1k, sorry for the late response, yes, we're working on it, we'll fix it soon

- **Issue #174** (2024-06-06): **Bug: Data downloading does not work in Binary Quantization from Scratch notebook**
  *Symptoms*: ### What happened?  It seems like the link format used in data downloading is not valid anymore.    ```bash git clone https://github.com/qdrant/fastembed.git python3 -m venv venv && source venv/bin/activate && pip3 install -U pip poetry && poetry install --with dev jupyter-notebook ```  Then open [Binary Quantization from Scratch.ipynb](https://github.com/qdrant/fastembed/blob/main/docs/experimental/Binary%20Quantization%20from%20Scratch.ipynb) try to run cells sequentially:  <img width="1156" alt="image" src="https://github.com/qdrant/fastembed/assets/22641570/f27197a3-5778-4b74-8896-e1dfa32be5a7">     ### Version  0.2.4 (Latest)  ### What os are you seeing the problem on?  _No response_  ### Relevant stack traces and/or logs  _No response_
  **Post-Mortem & Fix Analysis**:
  > @NirantK could you please look into it?
  > Ouch, thanks for spotting this — I'll raise a PR this week for this

- **Issue #170** (2024-04-01): **_get_worker_class is not implemented in SpladePP**
  *Symptoms*: ### What happened?  `_get_worker_class` method was not implemented in SpladePP, thus setting `parallel` in `embed` was leading to errors  ### Version  0.2.4 (Latest)  ### What os are you seeing the problem on?  _No response_  ### Relevant stack traces and/or logs  _No response_
  **Post-Mortem & Fix Analysis**:
  > Closing this since it's fixed! Thanks for this @joein — I'd missed this completely!

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

### Incident Patch 1: `b566dcb9` (2026-10-06)
**Commit Message**: fix: don't fail a download when an older revision is cached (#780)

* fix: don't fail a download when an older revision is cached

* fix: don't save or trust empty file metadata

* test: fix test on windows

**File**: `fastembed/common/model_management.py` (modified, +17/-5)
```diff
@@ -264,11 +264,14 @@ def _verify_files_from_metadata(
                 return False
 
         def _collect_file_metadata(
-            model_dir: Path, repo_files: list[RepoFile]
+            model_dir: Path, revision: str, repo_files: list[RepoFile]
         ) -> dict[str, dict[str, int | str]]:
             meta: dict[str, dict[str, int | str]] = {}
             file_info_map = {f.path: f for f in repo_files}
-            for file_path in model_dir.rglob("*"):
+            # Only look at the downloaded revision's folder. The cache may also hold folders of
+            # older revisions, whose files differ from the ones on the hub now, so checking
+            # them would report a good download as corrupted.
+            for file_path in (model_dir / "snapshots" / revision).rglob("*"):
                 if file_path.is_file() and file_path.name != cls.METADATA_FILE:
                     relative_path = file_path.relative_to(model_dir)
                     repo_file = file_info_map.get(_repo_relative_path(relative_path))
@@ -401,7 +404,10 @@ def _save_file_metadata(model_dir: Path, meta: dict[str, dict[str, int | str]])
 
         if snapshot_dir.exists() and metadata_file.exists():
             metadata = json.loads(metadata_file.read_text())
-            verified_metadata = _verify_files_from_metadata(snapshot_dir, metadata, repo_files)
+            # empty metadata lists no files, so it can't vouch for the cached ones
+            verified_metadata = bool(metadata) and _verify_files_from_metadata(
+                snapshot_dir, metadata, repo_files
+            )
 
         if verified_metadata:
             disable_progress_bars()
@@ -418,7 +424,10 @@ def _save_file_metadata(model_dir: Path, meta: dict[str, dict[str, int | str]])
             not verified_metadata
         ):  # metadata is not up-to-date, update it and check whether the files have been
             # downloaded correctly
-            metadata = _collect_file_metadata(snapshot_dir, repo_files)
+            # result is <cache_dir>/.../snapshots/<revision>. Only the revision is taken from
+            # it: the hub resolves cache_dir, so the rest of the path may not match ours.
+            downloaded_revision = Path(result).name
+            metadata = _collect_file_metadata(snapshot_dir, downloaded_revision, repo_files)
 
             download_successful = _verify_files_from_metadata(
                 snapshot_dir, metadata, repo_files=[]
@@ -428,7 +437,10 @@ def _save_file_metadata(model_dir: Path, meta: dict[str, dict[str, int | str]])
                     "Files have been corrupted during downloading process. "
                     "Please check your internet connection and try again."
                 )
-            _save_file_metadata(snapshot_dir, metadata)
+            # Empty means no file was checked, e.g. the files went to a local_dir instead of
+            # the cache. Saving it would make later downloads skip this check.
+            if metadata:
+                _save_file_metadata(snapshot_dir, metadata)
 
         return result
 
```

**File**: `tests/test_model_management.py` (modified, +38/-1)
```diff
@@ -1,4 +1,4 @@
-"""Offline cache-verification tests for ModelManagement.
+"""Cache-verification tests for ModelManagement.
 
 The offline probe must distinguish a corrupt *model* file (which would make ONNX Runtime
 fail with a cryptic protobuf error) from a benign size drift on an auxiliary file. A corrupt
@@ -10,9 +10,11 @@
 
 import json
 from pathlib import Path
+from types import SimpleNamespace
 from typing import Any
 
 import pytest
+from huggingface_hub.hf_api import RepoFile
 
 from fastembed.common import model_management
 from fastembed.common.model_management import ModelManagement
@@ -90,3 +92,38 @@ def test_offline_probe_tolerates_auxiliary_file_drift(
         local_files_only=True,
     )
     assert result == str(snapshot)
+
+
+def test_online_download_ignores_older_cached_snapshot(
+    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
+) -> None:
+    repo_dir = tmp_path / "models--qdrant--fake-onnx"
+    new_tokenizer = b"new tokenizer, longer than the old one"
+
+    # an older revision is still in the cache
+    old_file = repo_dir / "snapshots" / "old" / "tokenizer.json"
+    old_file.parent.mkdir(parents=True)
+    old_file.write_bytes(b"old tokenizer")
+
+    # the hub has a newer revision, which the download puts next to the old one
+    def fake_snapshot_download(**kwargs: Any) -> str:
+        new_file = repo_dir / "snapshots" / "new" / "tokenizer.json"
+        new_file.parent.mkdir(parents=True)
+        new_file.write_bytes(new_tokenizer)
+        return str(new_file.parent)
+
+    hub_file = RepoFile(path="tokenizer.json", size=len(new_tokenizer), oid="new")
+    monkeypatch.setattr(model_management, "snapshot_download", fake_snapshot_download)
+    monkeypatch.setattr(model_management, "list_repo_tree", lambda *a, **kw: [hub_file])
+    monkeypatch.setattr(
+        model_management, "model_info", lambda *a, **kw: SimpleNamespace(sha="new")
+    )
+
+    result = ModelManagement.download_files_from_huggingface(
+        "qdrant/fake-onnx", cache_dir=str(tmp_path), extra_patterns=[]
+    )
+
+    assert result == str(repo_dir / "snapshots" / "new")
+    # the size check ran on the new file, and only on it (keys use the OS path separator)
+    metadata = json.loads((repo_dir / ModelManagement.METADATA_FILE).read_text())
+    assert list(metadata) == [str(Path("snapshots/new/tokenizer.json"))]
```

---

### Incident Patch 2: `690cfa84` (2026-10-05)
**Commit Message**: fix: prevent BM25 query token ID overflow (#769)

* fix: prevent BM25 query token ID overflow

* tests: drop tests and a docstring

---------

Co-authored-by: Ramzi Alashmali <[REDACTED_EMAIL]>
Co-authored-by: George Panchuk <[REDACTED_EMAIL]>

**File**: `fastembed/sparse/bm25.py` (modified, +1/-1)
```diff
@@ -375,7 +375,7 @@ def query_embed(self, query: str | Iterable[str], **kwargs: Any) -> Iterable[Spa
             stemmed_tokens = self._stem(tokens)
             token_ids = np.array(
                 list(set(self.compute_token_id(token) for token in stemmed_tokens)),
-                dtype=np.int32,
+                dtype=np.int64,
             )
             values = np.ones_like(token_ids)
             yield SparseEmbedding(indices=token_ids, values=values)
```

---

### Incident Patch 3: `7ecf8e12` (2026-10-05)
**Commit Message**: fix: preserve integer indices in empty SparseEmbedding.from_dict results (#768)

* fix: preserve integer indices in empty SparseEmbedding.from_dict results

* test: drop tests

---------

Co-authored-by: Ramzi Alashmali <[REDACTED_EMAIL]>
Co-authored-by: George Panchuk <[REDACTED_EMAIL]>

**File**: `fastembed/sparse/sparse_embedding_base.py` (modified, +1/-1)
```diff
@@ -26,7 +26,7 @@ def as_dict(self) -> dict[int, float]:
     @classmethod
     def from_dict(cls, data: dict[int, float]) -> "SparseEmbedding":
         if len(data) == 0:
-            return cls(values=np.array([]), indices=np.array([]))
+            return cls(values=np.array([]), indices=np.array([], dtype=np.int64))
         indices, values = zip(*data.items())
         return cls(values=np.array(values), indices=np.array(indices))
 
```

---

### Incident Patch 4: `5d95ac3a` (2026-10-05)
**Commit Message**: fix: preserve explicit cuda selection in parallel workers (#770)

* fix: preserve explicit cuda selection in parallel workers

* tests: remove too heavy tests, remove a docstring

---------

Co-authored-by: Ramzi Alashmali <[REDACTED_EMAIL]>
Co-authored-by: George Panchuk <[REDACTED_EMAIL]>

**File**: `fastembed/parallel_processor.py` (modified, +1/-1)
```diff
@@ -125,10 +125,10 @@ def start(self, **kwargs: Any) -> None:
 
         for worker_id in range(0, self.num_workers):
             worker_kwargs = deepcopy(kwargs)
+            worker_kwargs["cuda"] = self.cuda
             if self.device_ids:
                 device_id = self.device_ids[worker_id % len(self.device_ids)]
                 worker_kwargs["device_id"] = device_id
-                worker_kwargs["cuda"] = self.cuda
 
             assert hasattr(self.ctx, "Process")
             process = self.ctx.Process(
```

---

### Incident Patch 5: `497800c1` (2026-10-05)
**Commit Message**: fix(image): respect do_resize=False in ConvNeXT preprocessing (#771)

* fix(image): respect do_resize=False in ConvNeXT preprocessing

* test: drop tests

* fix: move convnext comment

---------

Co-authored-by: Ramzi Alashmali <[REDACTED_EMAIL]>
Co-authored-by: George Panchuk <[REDACTED_EMAIL]>

**File**: `fastembed/image/transform/operators.py` (modified, +3/-0)
```diff
@@ -344,6 +344,9 @@ def _get_resize(cls, transforms: list[Transform], config: dict[str, Any]) -> Non
                     )
                 )
         elif mode == "ConvNextFeatureExtractor":
+            # HF defaults do_resize to True for ConvNeXT; it also gates the coupled crop
+            if not config.get("do_resize", True):
+                return
             if "size" in config and "shortest_edge" not in config["size"]:
                 raise ValueError(
                     f"Size dictionary must contain 'shortest_edge' key. Got {config['size'].keys()}"
```

---

### Incident Patch 6: `0c7e33a7` (2026-10-04)
**Commit Message**: fix(sparse): preserve small positive SPLADE weights with log1p (#773)

* fix(sparse): preserve small positive SPLADE weights with log1p

* chore: drop log1p regression tests and docstring from SPLADE post-processing

---------

Co-authored-by: Ramzi Alashmali <[REDACTED_EMAIL]>
Co-authored-by: George Panchuk <[REDACTED_EMAIL]>

**File**: `fastembed/sparse/splade_pp.py` (modified, +1/-1)
```diff
@@ -41,7 +41,7 @@ def _post_process_onnx_output(
         if output.attention_mask is None:
             raise ValueError("attention_mask must be provided for document post-processing")
 
-        relu_log = np.log(1 + np.maximum(output.model_output, 0))
+        relu_log = np.log1p(np.maximum(output.model_output, 0))
 
         weighted_log = relu_log * np.expand_dims(output.attention_mask, axis=-1)
 
```

---

### Incident Patch 7: `85041097` (2026-10-04)
**Commit Message**: fix: honor padding_side from tokenizer_config.json in load_tokenizer (#776)

**File**: `fastembed/common/preprocessor_utils.py` (modified, +5/-3)
```diff
@@ -113,8 +113,10 @@ def load_tokenizer(model_dir: Path) -> tuple[Tokenizer, dict[str, int]]:
 
     # Padding is always normalized to batch-longest. A serialized fixed length shorter than the
     # truncation limit leaves longer encodings untouched, which produces ragged batches, and a
-    # fixed length equal to it pads every batch to the maximum. Direction and pad token metadata
-    # are taken from the serialized settings, since some models pad on the left.
+    # fixed length equal to it pads every batch to the maximum. Pad token metadata is taken from
+    # the serialized settings. The direction follows transformers: `padding_side` from
+    # tokenizer_config.json wins over the serialized direction, since some models pad on the left
+    # and set it only in the config.
     padding = tokenizer.padding or {}
     pad_token = padding.get("pad_token") or tokenizer_config.get("pad_token")
     if pad_token is None:
@@ -129,7 +131,7 @@ def load_tokenizer(model_dir: Path) -> tuple[Tokenizer, dict[str, int]]:
         raise ValueError(f"Could not resolve an id for the pad token {pad_token!r} in {model_dir}")
 
     tokenizer.enable_padding(
-        direction=padding.get("direction", "right"),
+        direction=tokenizer_config.get("padding_side") or padding.get("direction", "right"),
         pad_id=pad_id,
         pad_type_id=padding.get("pad_type_id", 0),
         pad_token=pad_token,
```

**File**: `tests/test_preprocessor_utils.py` (modified, +24/-0)
```diff
@@ -236,6 +236,30 @@ def test_truncation_direction_resolution(
     assert tokenizer.truncation["direction"] == expected
 
 
+@pytest.mark.parametrize(
+    "serialized_direction,padding_side,expected",
+    [
+        (None, None, "right"),
+        ("left", None, "left"),
+        (None, "left", "left"),
+        ("left", "right", "right"),  # tokenizer_config.json wins, as in transformers
+    ],
+)
+def test_padding_direction_resolution(
+    make_model_dir, serialized_direction, padding_side, expected
+) -> None:
+    model_dir = make_model_dir(
+        tokenizer_config={"padding_side": padding_side},
+        padding=None
+        if serialized_direction is None
+        else {"pad_id": 0, "pad_token": "[PAD]", "direction": serialized_direction},
+    )
+
+    tokenizer, _ = load_tokenizer(model_dir)
+
+    assert tokenizer.padding["direction"] == expected
+
+
 @pytest.mark.parametrize(
     "model_max_length,max_length",
     [
```

---

### Incident Patch 8: `7d1e76bb` (2026-10-04)
**Commit Message**: fix: preserve serialized tokenizer truncation direction (#775)

* fix: preserve serialized tokenizer truncation direction

* fix: read truncation_side from tokenizer_config.json before tokenizer.json

---------

Co-authored-by: George Panchuk <[REDACTED_EMAIL]>

**File**: `fastembed/common/preprocessor_utils.py` (modified, +7/-1)
```diff
@@ -95,7 +95,13 @@ def load_tokenizer(model_dir: Path) -> tuple[Tokenizer, dict[str, int]]:
     tokens_map = load_special_tokens(model_dir)
 
     tokenizer = Tokenizer.from_file(str(tokenizer_path))
-    tokenizer.enable_truncation(max_length=max_context)
+    # enable_truncation resets the direction to right unless it is passed. The direction is
+    # resolved as in transformers: tokenizer_config.json, then tokenizer.json, then right.
+    truncation = tokenizer.truncation or {}
+    tokenizer.enable_truncation(
+        max_length=max_context,
+        direction=tokenizer_config.get("truncation_side") or truncation.get("direction", "right"),
+    )
 
     # Registered before the padding is resolved: the map may name a pad token that
     # tokenizer.json does not carry, and it only gets an id once it is added.
```

**File**: `tests/test_preprocessor_utils.py` (modified, +26/-0)
```diff
@@ -210,6 +210,32 @@ def test_max_context_resolution(make_model_dir, model_max_length, max_length, ex
     assert tokenizer.truncation["max_length"] == expected
 
 
+@pytest.mark.parametrize(
+    "serialized_direction,truncation_side,expected",
+    [
+        (None, None, "right"),
+        ("left", None, "left"),
+        (None, "left", "left"),
+        ("left", "right", "right"),  # tokenizer_config.json wins, as in transformers
+    ],
+)
+def test_truncation_direction_resolution(
+    make_model_dir, serialized_direction, truncation_side, expected
+) -> None:
+    model_dir = make_model_dir(tokenizer_config={"truncation_side": truncation_side})
+    tokenizer_path = model_dir / "tokenizer.json"
+    serialized = Tokenizer.from_file(str(tokenizer_path))
+    if serialized_direction is None:
+        serialized.no_truncation()
+    else:
+        serialized.enable_truncation(max_length=512, direction=serialized_direction)
+    serialized.save(str(tokenizer_path))
+
+    tokenizer, _ = load_tokenizer(model_dir)
+
+    assert tokenizer.truncation["direction"] == expected
+
+
 @pytest.mark.parametrize(
     "model_max_length,max_length",
     [
```

---

### Incident Patch 9: `7d367281` (2026-10-02)
**Commit Message**: fix: load ONNX external data from the huggingface_hub>=1.32 cache (#757)

**File**: `fastembed/common/model_management.py` (modified, +17/-2)
```diff
@@ -24,6 +24,7 @@
 from loguru import logger
 from tqdm import tqdm
 from fastembed.common.model_description import BaseModelDescription
+from fastembed.common.onnx_external_data import link_external_data
 
 T = TypeVar("T", bound=BaseModelDescription)
 
@@ -584,6 +585,19 @@ def retrieve_model_gcs(
 
         return model_dir
 
+    @staticmethod
+    def _link_onnx_external_data(model: BaseModelDescription, model_dir: Path) -> Path:
+        """Links the external data of `model` right after its download, see link_external_data.
+
+        Loading the model links it as well, but linking it here also covers lazy_load=True, e.g.
+        in a Docker build step, where links made by a later step would copy the files into a new
+        image layer. A failure, e.g. in a read-only cache, is reported when the model is loaded.
+        """
+        if model.model_file.endswith(".onnx"):
+            with contextlib.suppress(OSError):
+                link_external_data(model_dir, model.model_file, model.additional_files)
+        return model_dir
+
     @classmethod
     def download_model(cls, model: T, cache_dir: str, retries: int = 3, **kwargs: Any) -> Path:
         """
@@ -645,7 +659,7 @@ def download_model(cls, model: T, cache_dir: str, retries: int = 3, **kwargs: An
                 if (resolved_path / model.model_file).exists() and all(
                     (resolved_path / file).exists() for file in extra_patterns
                 ):
-                    return resolved_path
+                    return cls._link_onnx_external_data(model, resolved_path)
             except CorruptedCacheError:
                 force_download = True
             except Exception:
@@ -667,14 +681,15 @@ def download_model(cls, model: T, cache_dir: str, retries: int = 3, **kwargs: An
                 attempt_kwargs = {**kwargs, "force_download": True} if force_download else kwargs
                 force_download = False
                 try:
-                    return Path(
+                    model_dir = Path(
                         cls.download_files_from_huggingface(
                             hf_source,
                             cache_dir=cache_dir,
                             extra_patterns=extra_patterns,
                             **attempt_kwargs,
                         )
                     )
+                    return cls._link_onnx_external_data(model, model_dir)
                 except _HF_DOWNLOAD_ERRORS as e:
                     logger.error(
                         f"Could not download model from HuggingFace: {e} "
```

**File**: `fastembed/common/onnx_external_data.py` (added, +91/-0)
```diff
@@ -0,0 +1,91 @@
+"""Loading ONNX models with external data from a huggingface_hub cache.
+
+onnxruntime>=1.24 refuses external data that, once symlinks are resolved, is located outside of
+the directory of the model file, and of the directory the model file resolves to (a fallback of
+1.24.2, pyproject.toml excludes 1.24.0 and 1.24.1). Since huggingface_hub 1.32, a snapshot is made
+of symlinks into a blob store shared by the whole cache and sharded by hash, where a model and its
+data may resolve into different directories. Then the model and its data are hardlinked into
+`ONNX_SNAPSHOTS_DIR` of the repo cache, laid out as in the snapshot, which takes no extra space.
+"""
+
+import contextlib
+import os
+import shutil
+from pathlib import Path
+
+# Next to `snapshots` in the cache of a huggingface_hub repo: `onnx_snapshots/<revision>/...`
+ONNX_SNAPSHOTS_DIR = "onnx_snapshots"
+
+
+def link_external_data(model_dir: Path, model_file: str, additional_files: list[str]) -> Path:
+    """Returns a path of `model_file` from which onnxruntime can load its external data.
+
+    Args:
+        model_dir (Path): The directory with the model files, e.g. a huggingface_hub snapshot.
+        model_file (str): The path of the ONNX file, relative to `model_dir`.
+        additional_files (list[str]): Other files of the model, relative to `model_dir`,
+            among which its external data.
+
+    Returns:
+        Path: The ONNX file to load, `model_dir / model_file` unless it had to be linked.
+
+    Raises:
+        OSError: If the files had to be linked, but couldn't be, e.g. in a read-only cache or
+            on a filesystem without hardlinks.
+    """
+    model_path = model_dir / model_file
+    snapshots_dir = model_dir.parent
+    repo_dir = snapshots_dir.parent
+    if snapshots_dir.name != "snapshots" or not repo_dir.name.startswith("models--"):
+        return model_path  # not a huggingface_hub cache, there is no place of ours to link into
+    if not model_path.exists():
+        return model_path  # onnxruntime reports it more clearly than a failed hardlink would
+
+    # external data is located relative to the model file, so it can't be anywhere else
+    data_paths = [
+        path
+        for path in (model_dir / file for file in additional_files)
+        if path.parent.is_relative_to(model_path.parent) and path.exists()
+    ]
+    # onnxruntime accepts data within these, as in the caches of older huggingface_hub versions
+    real_model_dirs = (
+        os.path.realpath(model_path.parent),
+        os.path.dirname(os.path.realpath(model_path)),
+    )
+    if all(
+        any(Path(os.path.realpath(path)).is_relative_to(d) for d in real_model_dirs)
+        for path in data_paths
+    ):
+        return model_path
+
+    links_dir = repo_dir / ONNX_SNAPSHOTS_DIR
+    for path in (model_path, *data_paths):
+        _link_file(path, links_dir / model_dir.name / path.relative_to(model_dir))
+
+    # the links keep the blobs on disk, so drop those of revisions deleted from the cache
+    for revision_dir in links_dir.iterdir():
+        if not (snapshots_dir / revision_dir.name).is_dir():
+            shutil.rmtree(revision_dir, ignore_errors=True)
+
+    return links_dir / model_dir.name / model_file
+
+
+def _link_file(source: Path, link: Path) -> None:
+    """Makes `link` a hardlink to the file `source` resolves to, unless it already is one."""
+    target = os.path.realpath(source)
+    try:
+        if os.path.samefile(link, target):
+            return
+        # a link to a blob downloaded again since, or a copy of the cache without its hardlinks
+        link.unlink()
+    except FileNotFoundError:
+        pass
+    except OSError:
+        # e.g. such a copy on a read-only filesystem, which works all the same
+        if os.path.getsize(link) != os.path.getsize(target):
+            raise
+        return
+    link.parent.mkdir(parents=True, exist_ok=True)
+    # os.link is atomic, so if the link exists, another process loading the model just made it
+    with contextlib.suppress(FileExistsError):
+        os.link(target, link)
```

**File**: `fastembed/common/onnx_model.py` (modified, +26/-4)
```diff
@@ -6,9 +6,11 @@
 import numpy as np
 import onnxruntime as ort
 
+from loguru import logger
 from numpy.typing import NDArray
 from tokenizers import Tokenizer
 
+from fastembed.common.onnx_external_data import ONNX_SNAPSHOTS_DIR, link_external_data
 from fastembed.common.types import OnnxProvider, NumpyArray, Device
 from fastembed.parallel_processor import Worker
 
@@ -78,8 +80,8 @@ def _load_onnx_model(
         cuda: bool | Device = Device.AUTO,
         device_id: int | None = None,
         extra_session_options: dict[str, Any] | None = None,
+        additional_files: list[str] | None = None,
     ) -> None:
-        model_path = model_dir / model_file
         # List of Execution Providers: https://onnxruntime.ai/docs/execution-providers
         available_providers = ort.get_available_providers()
         cuda_available = "CUDAExecutionProvider" in available_providers
@@ -124,9 +126,29 @@ def _load_onnx_model(
         if extra_session_options is not None:
             self.add_extra_session_options(so, extra_session_options)
 
-        self.model = ort.InferenceSession(
-            str(model_path), providers=onnx_providers, sess_options=so
-        )
+        model_path = model_dir / model_file
+        link_error: OSError | None = None
+        try:
+            model_path = link_external_data(model_dir, model_file, additional_files or [])
+        except OSError as e:
+            # e.g. a read-only cache, which onnxruntime<1.24 loads from all the same
+            link_error = e
+
+        try:
+            self.model = ort.InferenceSession(
+                str(model_path), providers=onnx_providers, sess_options=so
+            )
+        except Exception:
+            if link_error is not None:
+                logger.warning(
+                    f"Could not link the files of {model_path} into {ONNX_SNAPSHOTS_DIR}: "
+                    f"{link_error}. onnxruntime>=1.24 refuses external data that resolves "
+                    "outside of the model directory, as in a huggingface_hub>=1.32 cache. "
+                    "Download the model with fastembed into a writable cache_dir on a "
+                    "filesystem with hardlinks, or delete it from the cache and download it "
+                    "again with HF_HUB_DISABLE_SHARED_BLOBS=1."
+                )
+            raise
         if "CUDAExecutionProvider" in requested_provider_names:
             assert self.model is not None
             current_providers = self.model.get_providers()
```

**File**: `fastembed/image/onnx_embedding.py` (modified, +1/-0)
```diff
@@ -137,6 +137,7 @@ def load_onnx_model(self) -> None:
             cuda=self.cuda,
             device_id=self.device_id,
             extra_session_options=self._extra_session_options,
+            additional_files=self.model_description.additional_files,
         )
 
     @classmethod
```

**File**: `fastembed/image/onnx_image_model.py` (modified, +2/-0)
```diff
@@ -58,6 +58,7 @@ def _load_onnx_model(
         cuda: bool | Device = Device.AUTO,
         device_id: int | None = None,
         extra_session_options: dict[str, Any] | None = None,
+        additional_files: list[str] | None = None,
     ) -> None:
         super()._load_onnx_model(
             model_dir=model_dir,
@@ -67,6 +68,7 @@ def _load_onnx_model(
             cuda=cuda,
             device_id=device_id,
             extra_session_options=extra_session_options,
+            additional_files=additional_files,
         )
         self.processor = load_preprocessor(model_dir=model_dir)
 
```

**File**: `fastembed/late_interaction/colbert.py` (modified, +1/-0)
```diff
@@ -221,6 +221,7 @@ def load_onnx_model(self) -> None:
             cuda=self.cuda,
             device_id=self.device_id,
             extra_session_options=self._extra_session_options,
+            additional_files=self.model_description.additional_files,
         )
 
     def _load_tokenizer(self, model_dir: Path) -> None:
```

**File**: `fastembed/late_interaction_multimodal/colmodernvbert.py` (modified, +1/-0)
```diff
@@ -133,6 +133,7 @@ def load_onnx_model(self) -> None:
             cuda=self.cuda,
             device_id=self.device_id,
             extra_session_options=self._extra_session_options,
+            additional_files=self.model_description.additional_files,
         )
 
         # Load image processing configuration
```

**File**: `fastembed/late_interaction_multimodal/colpali.py` (modified, +1/-0)
```diff
@@ -128,6 +128,7 @@ def load_onnx_model(self) -> None:
             cuda=self.cuda,
             device_id=self.device_id,
             extra_session_options=self._extra_session_options,
+            additional_files=self.model_description.additional_files,
         )
 
     def _post_process_onnx_image_output(
```

---

### Incident Patch 10: `2f2a8bfa` (2026-10-02)
**Commit Message**: fix: keep the model dtype in mean pooling embeddings (#754)

* fix: keep the model dtype in mean pooling embeddings

* tests: trim redundant dtype tests

**File**: `README.md` (modified, +2/-2)
```diff
@@ -169,10 +169,10 @@ query = "What is Qdrant?"
 model = LateInteractionMultimodalEmbedding(model_name="Qdrant/colpali-v1.3-fp16")
 doc_images_embeddings = list(model.embed_image(doc_images))
 # shape (2, 1030, 128)
-# [array([[-0.03353882, -0.02090454, ..., -0.15576172, -0.07678223]], dtype=float32)]
+# [array([[-0.03354, -0.0209, ..., -0.1558, -0.0768]], dtype=float16)]
 query_embedding = model.embed_text(query)
 # shape (1, 20, 128)
-# [array([[-0.00218201,  0.14758301, ...,  -0.02207947,  0.16833496]], dtype=float32)]
+# [array([[-0.002182, 0.1476, ..., -0.02208, 0.1683]], dtype=float16)]
 ```
 
 ### 🔄 Rerankers
```

**File**: `fastembed/common/utils.py` (modified, +15/-4)
```diff
@@ -16,6 +16,11 @@
 
 
 def normalize(input_array: NumpyArray, p: int = 2, dim: int = 1, eps: float = 1e-12) -> NumpyArray:
+    if input_array.dtype == np.float16:
+        # the sum of squares overflows float16 (max 65504) already for moderate values,
+        # which turns the norm into inf and the embedding into zeros
+        return normalize(input_array.astype(np.float32), p=p, dim=dim, eps=eps).astype(np.float16)
+
     # Calculate the Lp norm along the specified dimension
     norm = np.linalg.norm(input_array, ord=p, axis=dim, keepdims=True)
     norm = np.maximum(norm, eps)  # Avoid division by zero
@@ -24,10 +29,16 @@ def normalize(input_array: NumpyArray, p: int = 2, dim: int = 1, eps: float = 1e
 
 
 def mean_pooling(input_array: NumpyArray, attention_mask: NDArray[np.int64]) -> NumpyArray:
-    input_mask_expanded = np.expand_dims(attention_mask, axis=-1).astype(np.int64)
-    input_mask_expanded = np.tile(input_mask_expanded, (1, 1, input_array.shape[-1]))
-    sum_embeddings = np.sum(input_array * input_mask_expanded, axis=1)
-    sum_mask = np.sum(input_mask_expanded, axis=1)
+    """Average the embeddings of the tokens which the attention mask marks as real.
+
+    The sum is accumulated in float64, so the result is float64 for any input dtype,
+    callers cast it back to the dtype of the model once post-processing is done.
+    """
+    # `where` skips the padding without materializing a (batch_size, seq_len, dim) mask
+    sum_embeddings = np.sum(
+        input_array, axis=1, where=attention_mask[:, :, np.newaxis].astype(bool), dtype=np.float64
+    )
+    sum_mask = np.sum(attention_mask, axis=1, keepdims=True)
     pooled_embeddings = sum_embeddings / np.maximum(sum_mask, 1e-9)
     return pooled_embeddings
 
```

**File**: `fastembed/text/custom_text_embedding.py` (modified, +6/-1)
```diff
@@ -72,7 +72,12 @@ def _get_worker_init_kwargs(self) -> dict[str, Any]:
     def _post_process_onnx_output(
         self, output: OnnxOutputContext, **kwargs: Any
     ) -> Iterable[NumpyArray]:
-        return self._normalize(self._pool(output.model_output, output.attention_mask))
+        embeddings = self._normalize(self._pool(output.model_output, output.attention_mask))
+        # mean pooling returns float64, float embeddings are cast back to the dtype of the model
+        # after normalization, integer outputs are kept as is, since the cast would truncate them
+        if np.issubdtype(output.model_output.dtype, np.floating):
+            return embeddings.astype(output.model_output.dtype, copy=False)
+        return embeddings
 
     def _pool(
         self, embeddings: NumpyArray, attention_mask: NDArray[np.int64] | None = None
```

**File**: `fastembed/text/pooled_embedding.py` (modified, +2/-1)
```diff
@@ -117,7 +117,8 @@ def _post_process_onnx_output(
 
         embeddings = output.model_output
         attn_mask = output.attention_mask
-        return self.mean_pooling(embeddings, attn_mask)
+        # mean pooling returns float64, embeddings keep the dtype of the model
+        return self.mean_pooling(embeddings, attn_mask).astype(embeddings.dtype, copy=False)
 
 
 class PooledEmbeddingWorker(OnnxTextEmbeddingWorker):
```

**File**: `fastembed/text/pooled_normalized_embedding.py` (modified, +5/-1)
```diff
@@ -158,7 +158,11 @@ def _post_process_onnx_output(
 
         embeddings = output.model_output
         attn_mask = output.attention_mask
-        return normalize(self.mean_pooling(embeddings, attn_mask))
+        # mean pooling returns float64, embeddings keep the dtype of the model,
+        # the cast goes after normalization to normalize in full precision
+        return normalize(self.mean_pooling(embeddings, attn_mask)).astype(
+            embeddings.dtype, copy=False
+        )
 
 
 class PooledNormalizedEmbeddingWorker(OnnxTextEmbeddingWorker):
```

**File**: `tests/test_common.py` (modified, +26/-1)
```diff
@@ -8,7 +8,7 @@
     LateInteractionMultimodalEmbedding,
     LateInteractionTextEmbedding,
 )
-from fastembed.common.utils import iter_batch, last_token_pooling
+from fastembed.common.utils import iter_batch, last_token_pooling, mean_pooling, normalize
 
 
 def test_text_list_supported_models():
@@ -62,6 +62,31 @@ def test_last_token_pooling_with_left_padding():
     assert np.allclose(pooled, [[2.0, 2.0], [6.0, 6.0]])
 
 
+def test_mean_pooling():
+    # 2 real tokens, then padding
+    token_embeddings = np.array([[[1.0, 2.0], [3.0, 4.0], [9.0, 9.0]]], dtype=np.float32)
+    attention_mask = np.array([[1, 1, 0]], dtype=np.int64)
+    # the sum over 8192 tokens of 10.0 exceeds the float16 max of 65504
+    long_sequence = np.full((1, 8192, 2), 10.0, dtype=np.float16)
+
+    pooled = mean_pooling(token_embeddings, attention_mask)
+    pooled_long_sequence = mean_pooling(long_sequence, np.ones((1, 8192), dtype=np.int64))
+
+    assert pooled.dtype == pooled_long_sequence.dtype == np.float64
+    assert np.array_equal(pooled, [[2.0, 3.0]])
+    assert np.array_equal(pooled_long_sequence, [[10.0, 10.0]])
+
+
+def test_normalize_does_not_overflow_float16():
+    # the sum of squares, 1024 * 10.0**2, exceeds the float16 max of 65504
+    embeddings = np.full((1, 1024), 10.0, dtype=np.float16)
+
+    normalized = normalize(embeddings)
+
+    assert normalized.dtype == np.float16
+    assert np.array_equal(normalized, np.full((1, 1024), 1 / 32))
+
+
 def test_iter_batch_accepts_positive_size():
     assert list(iter_batch([1, 2, 3, 4, 5], 3)) == [[1, 2, 3], [4, 5]]
 
```

**File**: `tests/test_custom_models.py` (modified, +1/-0)
```diff
@@ -225,6 +225,7 @@ def test_mock_add_custom_models():
             iter(custom_text_embedding._post_process_onnx_output(input_data[model_name]))
         )
         assert np.allclose(post_processed_output, expected_output[model_name], atol=1e-3)
+        assert post_processed_output.dtype == np.float32, model_name
 
 
 def test_custom_text_model_lookup_is_case_insensitive():
```

**File**: `tests/test_text_onnx_embeddings.py` (modified, +26/-0)
```diff
@@ -5,6 +5,8 @@
 import numpy as np
 import pytest
 
+from fastembed.common.onnx_model import OnnxOutputContext
+from fastembed.text.custom_text_embedding import CustomTextEmbedding
 from fastembed.text.last_token_normalized_embedding import LastTokenNormalizedEmbedding
 from fastembed.text.onnx_embedding import OnnxTextEmbedding
 from fastembed.text.text_embedding import TextEmbedding
@@ -241,6 +243,30 @@ def test_quantized_model_reports_onnxruntime_requirement(monkeypatch) -> None:
         model.load_onnx_model()
 
 
+@pytest.mark.parametrize(
+    "embedding_class",
+    # custom models are covered in test_custom_models.py
+    [cls for cls in TextEmbedding.EMBEDDINGS_REGISTRY if cls is not CustomTextEmbedding],
+    ids=lambda cls: cls.__name__,
+)
+def test_post_processing_keeps_model_dtype(embedding_class) -> None:
+    model_desc = embedding_class._list_supported_models()[0]
+    model = embedding_class(
+        model_desc.model,
+        lazy_load=True,
+        specific_model_path="./",  # disable model downloading and loading
+    )
+    token_embeddings = np.random.default_rng(0).standard_normal((2, 4, model_desc.dim))
+    output = OnnxOutputContext(
+        model_output=token_embeddings.astype(np.float32),
+        attention_mask=np.array([[1, 1, 0, 0], [1, 1, 1, 1]], dtype=np.int64),
+    )
+
+    embeddings = np.stack(list(model._post_process_onnx_output(output)))
+
+    assert embeddings.dtype == np.float32
+
+
 @pytest.mark.parametrize("n_dims,model_name", [(384, "BAAI/bge-small-en-v1.5")])
 def test_batch_embedding(model_cache, n_dims: int, model_name: str) -> None:
     with model_cache(model_name) as model:
```

---

### Incident Patch 11: `e0447a2e` (2026-09-29)
**Commit Message**: fix: preserve center crop size with odd padding (#746)

* fix: preserve center crop size with odd padding

* tests: refactor tests, leave just one

---------

Co-authored-by: George <[REDACTED_EMAIL]>

**File**: `fastembed/image/transform/functional.py` (modified, +3/-2)
```diff
@@ -42,9 +42,10 @@ def center_crop(
     new_shape = image.shape[:-2] + (new_height, new_width)
     new_image = np.zeros_like(image, shape=new_shape, dtype=np.float32)
 
-    top_pad = (new_height - orig_height) // 2
+    # Round padding up to offset the floor-rounded crop origin when the difference is odd.
+    top_pad = (new_height - orig_height + 1) // 2
     bottom_pad = top_pad + orig_height
-    left_pad = (new_width - orig_width) // 2
+    left_pad = (new_width - orig_width + 1) // 2
     right_pad = left_pad + orig_width
     new_image[..., top_pad:bottom_pad, left_pad:right_pad] = image
 
```

**File**: `tests/test_image_transform.py` (modified, +21/-0)
```diff
@@ -3,6 +3,27 @@
 from PIL import Image
 
 from fastembed.image.transform.functional import normalize, resize
+from fastembed.image.transform.operators import Compose
+
+
+def test_center_crop_odd_padding_keeps_batch_shape_and_pixels() -> None:
+    pixels = np.arange(1, 28, dtype=np.uint8).reshape(3, 3, 3)
+    processor = Compose.from_config(
+        {
+            "do_resize": False,
+            "do_center_crop": True,
+            "crop_size": 4,
+            "do_rescale": False,
+        }
+    )
+    images = [Image.fromarray(pixels), Image.new("RGB", (4, 4))]
+
+    batch = np.array(processor(images))
+    expected = np.zeros((3, 4, 4), dtype=np.float32)
+    expected[:, 1:, 1:] = pixels.transpose(2, 0, 1)
+
+    assert batch.shape == (2, 3, 4, 4)
+    np.testing.assert_array_equal(batch[0], expected)
 
 
 @pytest.mark.parametrize(
```

---

### Incident Patch 12: `aa4c8ea6` (2026-09-28)
**Commit Message**: fix: fix description limits (#741)

**File**: `fastembed/rerank/cross_encoder/onnx_text_cross_encoder.py` (modified, +1/-1)
```diff
@@ -56,7 +56,7 @@
     ),
     BaseModelDescription(
         model="jinaai/jina-reranker-v2-base-multilingual",
-        description="A multi-lingual reranker model for cross-encoder re-ranking with 1K context length and sliding window",
+        description="A multi-lingual reranker model for cross-encoder re-ranking with 1K context length",
         license="cc-by-nc-4.0",
         size_in_GB=1.11,
         sources=ModelSource(hf="jinaai/jina-reranker-v2-base-multilingual"),
```

**File**: `fastembed/text/multitask_embedding.py` (modified, +1/-1)
```diff
@@ -22,7 +22,7 @@
         },
         description=(
             "Multi-task unimodal (text) embedding model, multi-lingual (~100), "
-            "1024 tokens truncation, and 8192 sequence length. Prefixes for queries/documents: not necessary, 2024 year."
+            "8192 input tokens truncation. Prefixes for queries/documents: not necessary, 2024 year."
         ),
         license="cc-by-nc-4.0",
         size_in_GB=2.29,
```

**File**: `fastembed/text/pooled_embedding.py` (modified, +2/-2)
```diff
@@ -50,7 +50,7 @@
         model="sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2",
         dim=384,
         description=(
-            "Text embeddings, Unimodal (text), Multilingual (~50 languages), 512 input tokens truncation, "
+            "Text embeddings, Unimodal (text), Multilingual (~50 languages), 128 input tokens truncation, "
             "Prefixes for queries/documents: not necessary, 2019 year."
         ),
         license="apache-2.0",
@@ -62,7 +62,7 @@
         model="sentence-transformers/paraphrase-multilingual-mpnet-base-v2",
         dim=768,
         description=(
-            "Text embeddings, Unimodal (text), Multilingual (~50 languages), 384 input tokens truncation, "
+            "Text embeddings, Unimodal (text), Multilingual (~50 languages), 512 input tokens truncation, "
             "Prefixes for queries/documents: not necessary, 2021 year."
         ),
         license="apache-2.0",
```

---

### Incident Patch 13: `21680f4a` (2026-09-26)
**Commit Message**: fix: enable type checkers in PR CI (#736)

**File**: `.github/workflows/type-checkers.yml` (modified, +1/-1)
```diff
@@ -1,6 +1,6 @@
 name: type-checkers
 
-on: [push]
+on: [push, pull_request]
 
 jobs:
   build:
```

---

### Incident Patch 14: `1647dc81` (2026-09-26)
**Commit Message**: fix: fix mypy (#735)

**File**: `fastembed/sparse/bm25.py` (modified, +2/-0)
```diff
@@ -162,13 +162,15 @@ def __init__(
         self.punctuation = set(get_all_punctuation())
         self.disable_stemmer = disable_stemmer
 
+        self.stopwords: set[str]
         if self._custom_stopwords is not None:
             self.stopwords = self._custom_stopwords
         elif disable_stemmer:
             self.stopwords = set()
         else:
             self.stopwords = set(self._load_stopwords(self._model_dir, self.language))
 
+        self.stemmer: Stemmer | None
         if stemmer is not None:
             self.stemmer = stemmer
         elif disable_stemmer:
```

---

### Incident Patch 15: `44d0c4ef` (2026-09-26)
**Commit Message**: Fix MUVERA encoding for empty documents (#733)

* Fix MUVERA encoding for empty documents

* Test MUVERA empty multivector encodings

* fix: raise on empty vectors in muvera

* Test ValueError for empty MUVERA inputs

* replace getattr with explicit calls in tests

Updated error messages for empty inputs in tests.

* remove redundant fixture

* remove unused import

* pytest import is actually required

* fix exception match message

---------

Co-authored-by: George Panchuk <[REDACTED_EMAIL]>

**File**: `fastembed/postprocess/muvera.py` (modified, +10/-0)
```diff
@@ -228,6 +228,9 @@ def process_document(self, vectors: NumpyArray) -> NumpyArray:
 
         Returns:
             NumpyArray: Fixed dimensional encodings of shape (r_reps * b * dim_proj,)
+
+        Raises:
+            ValueError: If the document multivector is empty
         """
         return self.process(vectors, fill_empty_clusters=True, normalize_by_count=True)
 
@@ -243,6 +246,9 @@ def process_query(self, vectors: NumpyArray) -> NumpyArray:
 
         Returns:
             NumpyArray: Fixed dimensional encoding of shape (r_reps * b * dim_proj,)
+
+        Raises:
+            ValueError: If the query multivector is empty
         """
         return self.process(vectors, fill_empty_clusters=False, normalize_by_count=False)
 
@@ -278,11 +284,15 @@ def process(
 
         Raises:
             AssertionError: If input vectors don't have expected dimensionality
+            ValueError: If the input multivector is empty
         """
         assert (
             vectors.shape[1] == self.dim
         ), f"Expected vectors of shape (n, {self.dim}), got {vectors.shape}"
 
+        if len(vectors) == 0:
+            raise ValueError("Cannot encode an empty multivector")
+
         # Store results from each random projection
         output_vectors = []
 
```

**File**: `tests/test_postprocess.py` (modified, +13/-0)
```diff
@@ -1,4 +1,5 @@
 import numpy as np
+import pytest
 
 from fastembed import LateInteractionTextEmbedding
 from fastembed.postprocess import Muvera
@@ -36,3 +37,15 @@ def test_single_input():
         fde_query = muvera.process_query(multivector)
         assert fde_query.shape[0] == muvera.embedding_size
         assert np.allclose(fde_query[np.nonzero(fde_query)][:3], CANONICAL_QUERY_VALUES)
+
+
+def test_empty_multivectors_raise_value_error():
+    muvera = Muvera(dim=4, k_sim=2, dim_proj=2, r_reps=3)
+    empty = np.empty((0, 4))
+
+    with pytest.raises(ValueError, match="Cannot encode an empty multivector"):
+        muvera.process_document(empty)
+
+    with pytest.raises(ValueError, match="Cannot encode an empty multivector"):
+        muvera.process_query(empty)
+
```

#### Recent Merged Pull Requests:
- **PR #782** (closed): new: add weekly ci to check updates on hf (@joein)
- **PR #780** (2026-10-06): fix: don't fail a download when an older revision is cached (@joein)
- **PR #779** (closed): fix: scope HF download metadata to the returned snapshot (@HuaTNA)
- **PR #777** (closed): Validate custom output names before model registration (@tuanzirwar)
- **PR #776** (2026-10-04): fix: honor padding_side from tokenizer_config.json in load_tokenizer (@joein)
- **PR #775** (2026-10-04): fix: preserve serialized tokenizer truncation direction (@hulkbig)
- **PR #773** (2026-10-04): fix(sparse): preserve small positive SPLADE weights with log1p (@RAMZI0TO99)
- **PR #771** (2026-10-05): fix(image): respect do_resize=False in ConvNeXT preprocessing (@RAMZI0TO99)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
