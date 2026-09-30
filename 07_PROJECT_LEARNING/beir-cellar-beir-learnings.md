# Forensic Learning Record (Deep Inspection): beir-cellar/beir

> **Canonical Artifact**: `07_PROJECT_LEARNING/beir-cellar-beir-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/beir-cellar/beir](https://github.com/beir-cellar/beir))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-09-30T21:11:54.860Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `beir-cellar/beir`
- **Description**: A Heterogeneous Benchmark for Information Retrieval. Easy to use, evaluate your models across 15+ diverse IR datasets.
- **Primary Language / Ecosystem**: Python
- **Discovered Manifests / Configurations**: pyproject.toml, README.md
- **Stars / Engagement**: 2305 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: pyproject.toml, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `beir/__init__.py`
```
from __future__ import annotations

from .logging import LoggingHandler

__all__ = [
    "LoggingHandler",
]

```

### Core Architecture Module: `beir/datasets/data_loader.py`
```
from __future__ import annotations

import csv
import json
import logging
import os

from tqdm.autonotebook import tqdm

logger = logging.getLogger(__name__)


class GenericDataLoader:
    def __init__(
        self,
        data_folder: str = None,
        prefix: str = None,
        corpus_file: str = "corpus.jsonl",
        query_file: str = "queries.jsonl",
        qrels_folder: str = "qrels",
        qrels_file: str = "",
    ):
        self.corpus = {}
        self.queries = {}
        self.qrels = {}

        if prefix:
            query_file = prefix + "-" + query_file
            qrels_folder = prefix + "-" + qrels_folder

        self.corpus_file = os.path.join(data_folder, corpus_file) if data_folder else corpus_file
        self.query_file = os.path.join(data_folder, query_file) if data_folder else query_file
        self.qrels_folder = os.path.join(data_folder, qrels_folder) if data_folder else None
        self.qrels_file = qrels_file

    @staticmethod
    def check(fIn: str, ext: str):
        if not os.path.exists(fIn):
            raise ValueError(f"File {fIn} not present! Please provide accurate file.")

        if not fIn.endswith(ext):
            raise ValueError(f"File {fIn} must be present with extension {ext}")

    def load_custom(
        self,
    ) -> tuple[dict[str, dict[str, str]], dict[str, str], dict[str, dict[str, int]]]:
        self.check(fIn=self.corpus_file, ext="jsonl")
        self.check(fIn=self.query_file, ext="jsonl")
        self.check(fIn=self.qrels_file, ext="tsv")

        if not len(self.corpus):
            logger.info("Loading Corpus...")
            self._load_corpus()
            logger.info("Loaded %d Documents.", len(self.corpus))
            logger.info("Doc Example: %s", list(self.corpus.values())[0])

        if not len(self.queries):
            logger.info("Loading Queries...")
            self._load_queries()

        if os.path.exists(self.qrels_file):
            self._load_qrels()
            self.queries = {qid: self.queries[qid] for qid in self.qrels}
            logger.info("Loaded %d Queries.", len(self.queries))
            logger.info("Query Example: %s", list(self.queries.values())[0])

        return self.corpus, self.queries, self.qrels

    def load(self, split="test") -> tuple[dict[str, dict[str, str]], dict[str, str], dict[str, dict[str, int]]]:
        self.qrels_file = os.path.join(self.qrels_folder, split + ".tsv")
        self.check(fIn=self.corpus_file, ext="jsonl")
        self.check(fIn=self.query_file, ext="jsonl")
        self.check(fIn=self.qrels_file, ext="tsv")

        if not len(self.corpus):
            logger.info("Loading Corpus...")
            self._load_corpus()
            logger.info("Loaded %d %s Documents.", len(self.corpus), split.upper())
            logger.info("Doc Example: %s", list(self.corpus.values())[0])

        if not len(self.queries):
            logger.info("Loading Queries...")
            self._load_queries()

        if os.path.exists(self.qrels_file):
            self._load_qrels()
            self.queries = {qid: self.queries[qid] for qid in self.qrels}
            logger.info("Loaded %d %s Queries.", len(self.queries), split.upper())
            logger.info("Query Example: %s", list(self.queries.values())[0])

        return self.corpus, self.queries, self.qrels

    def load_corpus(self) -> dict[str, dict[str, str]]:
        self.check(fIn=self.corpus_file, ext="jsonl")

        if not len(self.corpus):
            logger.info("Loading Corpus...")
            self._load_corpus()
            logger.info("Loaded %d Documents.", len(self.corpus))
            logger.info("Doc Example: %s", list(self.corpus.values())[0])

        return self.corpus

    def _load_corpus(self):
        num_lines = sum(1 for i in open(self.corpus_file, "rb"))
        with open(self.corpus_file, encoding="utf8") as fIn:
            for line in tqdm(fIn, total=num_lines):
                line = json.loads(line)
                self.corpus[line.get("_id")] = {
                    "text": line.get("text"),
                    "title": line.get("title"),
                }

    def _load_queries(self):
        with open(self.query_file, encoding="utf8") as fIn:
            for line in fIn:
                line = json.loads(line)
                self.queries[line.get("_id")] = line.get("text")

    def _load_qrels(self):
        reader = csv.reader(
            open(self.qrels_file, encoding="utf-8"),
            delimiter="\t",
            quoting=csv.QUOTE_MINIMAL,
        )
        next(reader)

        for id, row in enumerate(reader):
            query_id, corpus_id, score = row[0], row[1], int(row[2])

            if query_id not in self.qrels:
                self.qrels[query_id] = {corpus_id: score}
            else:
                self.qrels[query_id][corpus_id] = score

```

### Core Architecture Module: `beir/datasets/data_loader_hf.py`
```
from __future__ import annotations

import logging
import os
from collections import defaultdict

from datasets import Features, Value, load_dataset

logger = logging.getLogger(__name__)


class HFDataLoader:
    def __init__(
        self,
        hf_repo: str = None,
        hf_repo_qrels: str = None,
        data_folder: str = None,
        prefix: str = None,
        corpus_file: str = "corpus.jsonl",
        query_file: str = "queries.jsonl",
        qrels_folder: str = "qrels",
        qrels_file: str = "",
        streaming: bool = False,
        keep_in_memory: bool = False,
    ):
        self.corpus = {}
        self.queries = {}
        self.qrels = {}
        self.hf_repo = hf_repo
        if hf_repo:
            logger.warn(
                "A huggingface repository is provided. This will override the data_folder, prefix and *_file arguments."
            )
            self.hf_repo_qrels = hf_repo_qrels if hf_repo_qrels else hf_repo + "-qrels"
        else:
            # data folder would contain these files:
            # (1) fiqa/corpus.jsonl  (format: jsonlines)
            # (2) fiqa/queries.jsonl (format: jsonlines)
            # (3) fiqa/qrels/test.tsv (format: tsv ("\t"))
            if prefix:
                query_file = prefix + "-" + query_file
                qrels_folder = prefix + "-" + qrels_folder

            self.corpus_file = os.path.join(data_folder, corpus_file) if data_folder else corpus_file
            self.query_file = os.path.join(data_folder, query_file) if data_folder else query_file
            self.qrels_folder = os.path.join(data_folder, qrels_folder) if data_folder else None
            self.qrels_file = qrels_file
        self.streaming = streaming
        self.keep_in_memory = keep_in_memory

    @staticmethod
    def check(fIn: str, ext: str):
        if not os.path.exists(fIn):
            raise ValueError(f"File {fIn} not present! Please provide accurate file.")

        if not fIn.endswith(ext):
            raise ValueError(f"File {fIn} must be present with extension {ext}")

    def load(self, split="test") -> tuple[dict[str, dict[str, str]], dict[str, str], dict[str, dict[str, int]]]:
        if not self.hf_repo:
            self.qrels_file = os.path.join(self.qrels_folder, split + ".tsv")
            self.check(fIn=self.corpus_file, ext="jsonl")
            self.check(fIn=self.query_file, ext="jsonl")
            self.check(fIn=self.qrels_file, ext="tsv")

        if not len(self.corpus):
            logger.info("Loading Corpus...")
            self._load_corpus()
            logger.info("Loaded %d %s Documents.", len(self.corpus), split.upper())
            logger.info("Doc Example: %s", self.corpus[0])

        if not len(self.queries):
            logger.info("Loading Queries...")
            self._load_queries()

        self._load_qrels(split)
        # filter queries with no qrels
        qrels_dict = defaultdict(dict)

        def qrels_dict_init(row):
            qrels_dict[row["query-id"]][row["corpus-id"]] = int(row["score"])

        self.qrels.map(qrels_dict_init)
        self.qrels = qrels_dict
        self.queries = self.queries.filter(lambda x: x["id"] in self.qrels)
        logger.info("Loaded %d %s Queries.", len(self.queries), split.upper())
        logger.info("Query Example: %s", self.queries[0])

        return self.corpus, self.queries, self.qrels

    def load_corpus(self) -> dict[str, dict[str, str]]:
        if not self.hf_repo:
            self.check(fIn=self.corpus_file, ext="jsonl")

        if not len(self.corpus):
            logger.info("Loading Corpus...")
            self._load_corpus()
            logger.info("Loaded %d %s Documents.", len(self.corpus))
            logger.info("Doc Example: %s", self.corpus[0])

        return self.corpus

    def _load_corpus(self):
        if self.hf_repo:
            corpus_ds = load_dataset(
                self.hf_repo,
                "corpus",
                keep_in_memory=self.keep_in_memory,
                streaming=self.streaming,
            )
        else:
            corpus_ds = load_dataset(
                "json",
                data_files=self.corpus_file,
                streaming=self.streaming,
                keep_in_memory=self.keep_in_memory,
            )
        corpus_ds = next(iter(corpus_ds.values()))  # get first split
        corpus_ds = corpus_ds.cast_column("_id", Value("string"))
        corpus_ds = corpus_ds.rename_column("_id", "id")
        corpus_ds = corpus_ds.remove_columns(
            [col for col in corpus_ds.column_names if col not in ["id", "text", "title"]]
        )
        self.corpus = corpus_ds

    def _load_queries(self):
        if self.hf_repo:
            queries_ds = load_dataset(
                self.hf_repo,
                "queries",
                keep_in_memory=self.keep_in_memory,
                streaming=self.streaming,
            )
        else:
            queries_ds = load_dataset(
                "json",
                data_files=self.query_file,
                streaming=self.streaming,
                keep_in_memory=self.keep_in_memory,
            )
        queries_ds = next(iter(queries_ds.values()))  # get first split
        queries_ds = queries_ds.cast_column("_id", Value("string"))
        queries_ds = queries_ds.rename_column("_id", "id")
        queries_ds = queries_ds.remove_columns([col for col in queries_ds.column_names if col not in ["id", "text"]])
        self.queries = queries_ds

    def _load_qrels(self, split):
        if self.hf_repo:
            qrels_ds = load_dataset(
                self.hf_repo_qrels,
                keep_in_memory=self.keep_in_memory,
                streaming=self.streaming,
            )[split]
        else:
            qrels_ds = load_dataset(
                "csv",
                data_files=self.qrels_file,
                delimiter="\t",
                keep_in_memory=self.keep_in_memory,
            )
        features = Features(
            {
                "query-id": Value("string"),
                "corpus-id": Value("string"),
                "score": Value("float"),
            }
        )
        qrels_ds = qrels_ds.cast(features)
        self.qrels = qrels_ds

```

### Core Architecture Module: `beir/generation/__init__.py`
```
from __future__ import annotations

from .generate import PassageExpansion, QueryGenerator

__all__ = [
    "PassageExpansion",
    "QueryGenerator",
]

```

### Core Architecture Module: `beir/generation/generate.py`
```
from __future__ import annotations

import logging
import os

from tqdm.autonotebook import trange

from ..util import write_to_json, write_to_tsv

logger = logging.getLogger(__name__)


class PassageExpansion:
    def __init__(self, model, **kwargs):
        self.model = model
        self.corpus_exp = {}

    @staticmethod
    def save(output_dir: str, corpus: dict[str, str], prefix: str):
        os.makedirs(output_dir, exist_ok=True)

        corpus_file = os.path.join(output_dir, prefix + "-corpus.jsonl")

        logger.info(f"Saving expanded passages to {corpus_file}")
        write_to_json(output_file=corpus_file, data=corpus)

    def expand(
        self,
        corpus: dict[str, dict[str, str]],
        output_dir: str,
        top_k: int = 200,
        max_length: int = 350,
        prefix: str = "gen",
        batch_size: int = 32,
        sep: str = " ",
    ):
        logger.info(f"Starting to expand Passages with {top_k} tokens chosen...")
        logger.info(f"Params: top_k = {top_k}")
        logger.info(f"Params: passage max_length = {max_length}")
        logger.info(f"Params: batch size = {batch_size}")

        corpus_ids = list(corpus.keys())
        corpus_list = [corpus[doc_id] for doc_id in corpus_ids]

        for start_idx in trange(0, len(corpus_list), batch_size, desc="pas"):
            expansions = self.model.generate(
                corpus=corpus_list[start_idx : start_idx + batch_size],
                max_length=max_length,
                top_k=top_k,
            )

            for idx in range(len(expansions)):
                doc_id = corpus_ids[start_idx + idx]
                self.corpus_exp[doc_id] = {
                    "title": corpus[doc_id]["title"],
                    "text": corpus[doc_id]["text"] + sep + expansions[idx],
                }

        # Saving finally all the questions
        logger.info(f"Saving {len(self.corpus_exp)} Expanded Passages...")
        self.save(output_dir, self.corpus_exp, prefix)


class QueryGenerator:
    def __init__(self, model, **kwargs):
        self.model = model
        self.qrels = {}
        self.queries = {}

    @staticmethod
    def save(
        output_dir: str,
        queries: dict[str, str],
        qrels: dict[str, dict[str, int]],
        prefix: str,
    ):
        os.makedirs(output_dir, exist_ok=True)
        os.makedirs(os.path.join(output_dir, prefix + "-qrels"), exist_ok=True)

        query_file = os.path.join(output_dir, prefix + "-queries.jsonl")
        qrels_file = os.path.join(output_dir, prefix + "-qrels", "train.tsv")

        logger.info(f"Saving Generated Queries to {query_file}")
        write_to_json(output_file=query_file, data=queries)

        logger.info(f"Saving Generated Qrels to {qrels_file}")
        write_to_tsv(output_file=qrels_file, data=qrels)

    def generate(
        self,
        corpus: dict[str, dict[str, str]],
        output_dir: str,
        top_p: int = 0.95,
        top_k: int = 25,
        max_length: int = 64,
        ques_per_passage: int = 1,
        prefix: str = "gen",
        batch_size: int = 32,
        save: bool = True,
        save_after: int = 100000,
    ):
        logger.info(f"Starting to Generate {ques_per_passage} Questions Per Passage using top-p (nucleus) sampling...")
        logger.info(f"Params: top_p = {top_p}")
        logger.info(f"Params: top_k = {top_k}")
        logger.info(f"Params: max_length = {max_length}")
        logger.info(f"Params: ques_per_passage = {ques_per_passage}")
        logger.info(f"Params: batch size = {batch_size}")

        count = 0
        corpus_ids = list(corpus.keys())
        corpus = [corpus[doc_id] for doc_id in corpus_ids]

        for start_idx in trange(0, len(corpus), batch_size, desc="pas"):
            size = len(corpus[start_idx : start_idx + batch_size])
            queries = self.model.generate(
                corpus=corpus[start_idx : start_idx + batch_size],
                ques_per_passage=ques_per_passage,
                max_length=max_length,
                top_p=top_p,
                top_k=top_k,
            )

            assert len(queries) == size * ques_per_passage

            for idx in range(size):
                # Saving generated questions after every "save_after" corpus ids
                if len(self.queries) % save_after == 0 and len(self.queries) >= save_after:
                    logger.info(f"Saving {len(self.queries)} Generated Queries...")
                    self.save(output_dir, self.queries, self.qrels, prefix)

                corpus_id = corpus_ids[start_idx + idx]
                start_id = idx * ques_per_passage
                end_id = start_id + ques_per_passage
                query_set = set([q.strip() for q in queries[start_id:end_id]])

                for query in query_set:
                    count += 1
                    query_id = "genQ" + str(count)
                    self.queries[query_id] = query
                    self.qrels[query_id] = {corpus_id: 1}

        # Saving finally all the questions
        logger.info(f"Saving {len(self.queries)} Generated Queries...")
        self.save(output_dir, self.queries, self.qrels, prefix)

    def generate_multi_process(
        self,
        corpus: dict[str, dict[str, str]],
        pool: dict[str, object],
        output_dir: str,
        top_p: int = 0.95,
        top_k: int = 25,
        max_length: int = 64,
        ques_per_passage: int = 1,
        prefix: str = "gen",
        batch_size: int = 32,
        chunk_size: int = None,
    ):
        logger.info(f"Starting to Generate {ques_per_passage} Questions Per Passage using top-p (nucleus) sampling...")
        logger.info(f"Params: top_p = {top_p}")
        logger.info(f"Params: top_k = {top_k}")
        logger.info(f"Params: max_length = {max_length}")
        logger.info(f"Params: ques_per_passage = {ques_per_passage}")
        logger.info(f"Params: batch size = {batch_size}")

        count = 0
        corpus_ids = list(corpus.keys())
        corpus = [corpus[doc_id] for doc_id in corpus_ids]

        queries = self.model.generate_multi_process(
            corpus=corpus,
            pool=pool,
            ques_per_passage=ques_per_passage,
            max_length=max_length,
            top_p=top_p,
            top_k=top_k,
            chunk_size=chunk_size,
            batch_size=batch_size,
        )

        assert len(queries) == len(corpus) * ques_per_passage

        for idx in range(len(corpus)):
            corpus_id = corpus_ids[idx]
            start_id = idx * ques_per_passage
            end_id = start_id + ques_per_passage
            query_set = set([q.strip() for q in queries[start_id:end_id]])

            for query in query_set:
                count += 1
                query_id = "genQ" + str(count)
                self.queries[query_id] = query
                self.qrels[query_id] = {corpus_id: 1}

        # Saving finally all the questions
        logger.info(f"Saving {len(self.queries)} Generated Queries...")
        self.save(output_dir, self.queries, self.qrels, prefix)

```

### Core Architecture Module: `beir/generation/models/__init__.py`
```
from __future__ import annotations

from .auto_model import QGenModel
from .tilde import TILDE

__all__ = [
    "QGenModel",
    "TILDE",
]

```

### Core Architecture Module: `beir/generation/models/auto_model.py`
```
from __future__ import annotations

import logging
import math
import queue

import torch
import torch.multiprocessing as mp
from tqdm.autonotebook import trange
from transformers import AutoModelForSeq2SeqLM, AutoTokenizer

logger = logging.getLogger(__name__)


class QGenModel:
    def __init__(
        self,
        model_path: str,
        gen_prefix: str = "",
        use_fast: bool = True,
        device: str = None,
        **kwargs,
    ):
        self.tokenizer = AutoTokenizer.from_pretrained(model_path, use_fast=use_fast)
        self.model = AutoModelForSeq2SeqLM.from_pretrained(model_path)
        self.gen_prefix = gen_prefix
        self.device = device or ("cuda" if torch.cuda.is_available() else "cpu")
        logger.info(f"Use pytorch device: {self.device}")
        self.model = self.model.to(self.device)

    def generate(
        self,
        corpus: list[dict[str, str]],
        ques_per_passage: int,
        top_k: int,
        max_length: int,
        top_p: float = None,
        temperature: float = None,
    ) -> list[str]:
        texts = [(self.gen_prefix + doc["title"] + " " + doc["text"]) for doc in corpus]
        encodings = self.tokenizer(texts, padding=True, truncation=True, return_tensors="pt")

        # Top-p nucleus sampling
        # https://huggingface.co/blog/how-to-generate
        with torch.no_grad():
            if not temperature:
                outs = self.model.generate(
                    input_ids=encodings["input_ids"].to(self.device),
                    do_sample=True,
                    max_length=max_length,  # 64
                    top_k=top_k,  # 25
                    top_p=top_p,  # 0.95
                    num_return_sequences=ques_per_passage,  # 1
                )
            else:
                outs = self.model.generate(
                    input_ids=encodings["input_ids"].to(self.device),
                    do_sample=True,
                    max_length=max_length,  # 64
                    top_k=top_k,  # 25
                    temperature=temperature,
                    num_return_sequences=ques_per_passage,  # 1
                )

        return self.tokenizer.batch_decode(outs, skip_special_tokens=True)

    def start_multi_process_pool(self, target_devices: list[str] = None):
        """
        Starts multi process to process the encoding with several, independent processes.
        This method is recommended if you want to encode on multiple GPUs. It is advised
        to start only one process per GPU. This method works together with encode_multi_process
        :param target_devices: PyTorch target devices, e.g. cuda:0, cuda:1... If None, all available CUDA devices will be used
        :return: Returns a dict with the target processes, an input queue and and output queue.
        """
        if target_devices is None:
            if torch.cuda.is_available():
                target_devices = [f"cuda:{i}" for i in range(torch.cuda.device_count())]
            else:
                logger.info("CUDA is not available. Start 4 CPU worker")
                target_devices = ["cpu"] * 4

        logger.info("Start multi-process pool on devices: {}".format(", ".join(map(str, target_devices))))

        ctx = mp.get_context("spawn")
        input_queue = ctx.Queue()
        output_queue = ctx.Queue()
        processes = []

        for cuda_id in target_devices:
            p = ctx.Process(
                target=QGenModel._generate_multi_process_worker,
                args=(cuda_id, self.model, self.tokenizer, input_queue, output_queue),
                daemon=True,
            )
            p.start()
            processes.append(p)

        return {"input": input_queue, "output": output_queue, "processes": processes}

    @staticmethod
    def stop_multi_process_pool(pool):
        """
        Stops all processes started with start_multi_process_pool
        """
        for p in pool["processes"]:
            p.terminate()

        for p in pool["processes"]:
            p.join()
            p.close()

        pool["input"].close()
        pool["output"].close()

    @staticmethod
    def _generate_multi_process_worker(target_device: str, model, tokenizer, input_queue, results_queue):
        """
        Internal working process to generate questions in multi-process setup
        """
        while True:
            try:
                id, batch_size, texts, ques_per_passage, top_p, top_k, max_length = input_queue.get()
                model = model.to(target_device)
                generated_texts = []

                for start_idx in trange(0, len(texts), batch_size, desc=f"{target_device}"):
                    texts_batch = texts[start_idx : start_idx + batch_size]
                    encodings = tokenizer(texts_batch, padding=True, truncation=True, return_tensors="pt")
                    with torch.no_grad():
                        outs = model.generate(
                            input_ids=encodings["input_ids"].to(target_device),
                            do_sample=True,
                            max_length=max_length,  # 64
                            top_k=top_k,  # 25
                            top_p=top_p,  # 0.95
                            num_return_sequences=ques_per_passage,  # 1
                        )
                    generated_texts += tokenizer.batch_decode(outs, skip_special_tokens=True)

                results_queue.put([id, generated_texts])
            except queue.Empty:
                break

    def generate_multi_process(
        self,
        corpus: list[dict[str, str]],
        ques_per_passage: int,
        top_p: int,
        top_k: int,
        max_length: int,
        pool: dict[str, object],
        batch_size: int = 32,
        chunk_size: int = None,
    ):
        """
        This method allows to run encode() on multiple GPUs. The sentences are chunked into smaller packages
        and sent to individual processes, which encode these on the different GPUs. This method is only suitable
        for encoding large sets of sentences
        :param sentences: list of sentences
        :param pool: A pool of workers started with SentenceTransformer.start_multi_process_pool
        :param batch_size: Encode sentences with batch size
        :param chunk_size: Sentences are chunked and sent to the individual processes. If none, it determine a sensible size.
        :return: Numpy matrix with all embeddings
        """

        texts = [(self.gen_prefix + doc["title"] + " " + doc["text"]) for doc in corpus]

        if chunk_size is None:
            chunk_size = min(math.ceil(len(texts) / len(pool["processes"]) / 10), 5000)

        logger.info(f"Chunk data into packages of size {chunk_size}")

        input_queue = pool["input"]
        last_chunk_id = 0
        chunk = []

        for doc_text in texts:
            chunk.append(doc_text)
            if len(chunk) >= chunk_size:
                input_queue.put(
                    [
                        last_chunk_id,
                        batch_size,
                        chunk,
                        ques_per_passage,
                        top_p,
                        top_k,
                        max_length,
                    ]
                )
                last_chunk_id += 1
                chunk = []

        if len(chunk) > 0:
            input_queue.put(
                [
                    last_chunk_id,
                    batch_size,
                    chunk,
                    ques_per_passage,
                    top_p,
                    top_k,
                    max_length,
                ]
            )
            last_chunk_id += 1

        output_queue = pool["output"]

        results_list = sorted([output_queue.get() for _ in range(last_chunk_id)], key=lambda x: x[0])
        queries = [result[1] for result in results_list]

        return [item for sublist in queries for item in sublist]

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #189** (2025-02-26): **Multigpu dense eval return errors after corpus embedding**
  *Symptoms*: Hi and thanks for you work. I'm trying to run the example for evaluation with multigpu ([https://github.com/beir-cellar/beir/blob/main/examples/retrieval/evaluation/dense/evaluate_sbert_multi_gpu.py](https://github.com/beir-cellar/beir/blob/main/examples/retrieval/evaluation/dense/evaluate_sbert_multi_gpu.py)) but i continuosly receive this error:    File "pyarrow/error.pxi", line 92, in pyarrow.lib.check_status OSError: Expected to be able to read 2594632 bytes for message body, got 2594620 [W110 10:20:47.593865407 CudaIPCTypes.cpp:16] Producer process has been terminated before all shared CUDA tensors released. See Note [Sharing CUDA tensors] /opt/conda/envs/campeses/lib/python3.11/multiprocessing/resource_tracker.py:254: UserWarning: resource_tracker: There appear to be 1 leaked semaphore objects to clean up at shutdown   warnings.warn('resource_tracker: There appear to be %d '         I tried to both downgrading and upgrading beir/sentence trasnformers and also datasets and pyarrow.       Did you have suggestion on how to solve this?
  **Post-Mortem & Fix Analysis**:
  > It should work now with the latest BEIR version. Can you retry @sirCamp?
  > Yes! Now It seems working!  I would like to report that in the "evaluate_sbert_multi_gpu.py, line 69 there is a predefined cache Path which Is personal.  Thanks to fixing the issue!🎉 I love this repo!
  > Ah thanks for telling me this, I missed to remove this while testing! I'll update the repo!

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

### Incident Patch 1: `ef83d293` (2025-10-16)
**Commit Message**: Merge pull request #203 from n0gu-furiosa/fix-apis-import

Fix incorrect import paths within apis package

**File**: `beir/retrieval/apis/cohere.py` (modified, +1/-1)
```diff
@@ -15,7 +15,7 @@
 from torch import Tensor
 from tqdm.autonotebook import trange
 
-from .util import extract_corpus_sentences
+from ..models.util import extract_corpus_sentences
 
 logger = logging.getLogger(__name__)
 
```

**File**: `beir/retrieval/apis/voyage.py` (modified, +1/-1)
```diff
@@ -14,7 +14,7 @@
 from torch import Tensor
 from tqdm.autonotebook import trange
 
-from .util import extract_corpus_sentences
+from ..models.util import extract_corpus_sentences
 
 logger = logging.getLogger(__name__)
 
```

---

### Incident Patch 2: `531a2522` (2025-07-02)
**Commit Message**: Fix incorrect import paths within apis package

**File**: `beir/retrieval/apis/cohere.py` (modified, +1/-1)
```diff
@@ -15,7 +15,7 @@
 from torch import Tensor
 from tqdm.autonotebook import trange
 
-from .util import extract_corpus_sentences
+from ..models.util import extract_corpus_sentences
 
 logger = logging.getLogger(__name__)
 
```

**File**: `beir/retrieval/apis/voyage.py` (modified, +1/-1)
```diff
@@ -14,7 +14,7 @@
 from torch import Tensor
 from tqdm.autonotebook import trange
 
-from .util import extract_corpus_sentences
+from ..models.util import extract_corpus_sentences
 
 logger = logging.getLogger(__name__)
 
```

---

### Incident Patch 3: `3a0b4c94` (2025-06-04)
**Commit Message**: bugfix remove query and passage prompt

**File**: `examples/retrieval/evaluation/dense/evaluate_huggingface.py` (modified, +0/-2)
```diff
@@ -51,8 +51,6 @@
 pooling = "eos"
 normalize = True
 append_eos_token = True
-query_prompt = "query: "
-passage_prompt = "passage: "
 
 #### Configuration for E5-Mistral
 # Check prompts: https://github.com/microsoft/unilm/blob/9c0f1ff7ca53431fe47d2637dfe253643d94185b/e5/utils.py
```

---

### Incident Patch 4: `7927be0a` (2025-02-03)
**Commit Message**: ruff python 3.9 fixes

**File**: `examples/retrieval/evaluation/README.md` (modified, +1/-1)
```diff
@@ -1,4 +1,4 @@
 ## Deep Dive into Evaluation of Retrieval Models
 
-### Leaderboard Overall 
+### Leaderboard Overall
 
```

**File**: `examples/retrieval/evaluation/custom/evaluate_custom_dataset.py` (modified, +23/-23)
```diff
@@ -1,56 +1,56 @@
+import logging
+
 from beir import LoggingHandler
 from beir.retrieval import models
-from beir.datasets.data_loader import GenericDataLoader
 from beir.retrieval.evaluation import EvaluateRetrieval
 from beir.retrieval.search.dense import DenseRetrievalExactSearch as DRES
 
-import pathlib, os
-import logging
-
 #### Just some code to print debug information to stdout
-logging.basicConfig(format='%(asctime)s - %(message)s',
-                    datefmt='%Y-%m-%d %H:%M:%S',
-                    level=logging.INFO,
-                    handlers=[LoggingHandler()])
+logging.basicConfig(
+    format="%(asctime)s - %(message)s",
+    datefmt="%Y-%m-%d %H:%M:%S",
+    level=logging.INFO,
+    handlers=[LoggingHandler()],
+)
 #### /print debug information to stdout
 
-#### Corpus #### 
+#### Corpus ####
 # Load the corpus in this format of Dict[str, Dict[str, str]]
 # Keep the title key and mention an empty string
 
 corpus = {
-    "doc1" : {
-        "title": "Albert Einstein", 
+    "doc1": {
+        "title": "Albert Einstein",
         "text": "Albert Einstein was a German-born theoretical physicist. who developed the theory of relativity, \
                  one of the two pillars of modern physics (alongside quantum mechanics). His work is also known for \
                  its influence on the philosophy of science. He is best known to the general public for his mass–energy \
                  equivalence formula E = mc2, which has been dubbed 'the world's most famous equation'. He received the 1921 \
                  Nobel Prize in Physics 'for his services to theoretical physics, and especially for his discovery of the law \
-                 of the photoelectric effect', a pivotal step in the development of quantum theory."
-        },
-    "doc2" : {
-        "title": "", # Keep title an empty string if not present
+                 of the photoelectric effect', a pivotal step in the development of quantum theory.",
+    },
+    "doc2": {
+        "title": "",  # Keep title an empty string if not present
         "text": "Wheat beer is a top-fermented beer which is brewed with a large proportion of wheat relative to the amount of \
                  malted barley. The two main varieties are German Weißbier and Belgian witbier; other types include Lambic (made\
-                 with wild yeast), Berliner Weisse (a cloudy, sour beer), and Gose (a sour, salty beer)."
+                 with wild yeast), Berliner Weisse (a cloudy, sour beer), and Gose (a sour, salty beer).",
     },
 }
 
-#### Queries #### 
+#### Queries ####
 # Load the queries in this format of Dict[str, str]
 
 queries = {
-    "q1" : "Who developed the mass-energy equivalence formula?",
-    "q2" : "Which beer is brewed with a large proportion of wheat?"
+    "q1": "Who developed the mass-energy equivalence formula?",
+    "q2": "Which beer is brewed with a large proportion of wheat?",
 }
 
-#### Qrels #### 
+#### Qrels ####
 # Load the Qrels in this format of Dict[str, Dict[str, int]]
 # First query_id and then dict with doc_id with gold score (int)
 
 qrels = {
-    "q1" : {"doc1": 1},
-    "q2" : {"doc2": 1},
+    "q1": {"doc1": 1},
+    "q2": {"doc2": 1},
 }
 
 #### Sentence-Transformer ####
@@ -64,4 +64,4 @@
 results = retriever.retrieve(corpus, queries)
 
 #### Evaluate your retrieval using NDCG@k, MAP@K ...
-ndcg, _map, recall, precision = retriever.evaluate(qrels, results, retriever.k_values)
\ No newline at end of file
+ndcg, _map, recall, precision = retriever.evaluate(qrels, results, retriever.k_values)
```

**File**: `examples/retrieval/evaluation/custom/evaluate_custom_dataset_files.py` (modified, +14/-14)
```diff
@@ -1,24 +1,25 @@
+import logging
+
 from beir import LoggingHandler
-from beir.retrieval import models
 from beir.datasets.data_loader import GenericDataLoader
+from beir.retrieval import models
 from beir.retrieval.evaluation import EvaluateRetrieval
 from beir.retrieval.search.dense import DenseRetrievalExactSearch as DRES
 
-import pathlib, os
-import logging
-
 #### Just some code to print debug information to stdout
-logging.basicConfig(format='%(asctime)s - %(message)s',
-                    datefmt='%Y-%m-%d %H:%M:%S',
-                    level=logging.INFO,
-                    handlers=[LoggingHandler()])
+logging.basicConfig(
+    format="%(asctime)s - %(message)s",
+    datefmt="%Y-%m-%d %H:%M:%S",
+    level=logging.INFO,
+    handlers=[LoggingHandler()],
+)
 #### /print debug information to stdout
 
 #### METHOD 2 ####
 
 # Provide the path to your CORPUS file, it should be jsonlines format (ref: https://jsonlines.org/)
 # Saved corpus file must have .jsonl extension (for eg: your_corpus_file.jsonl)
-# Corpus file structure: 
+# Corpus file structure:
 # [
 #   {"_id": "doc1", "title": "Albert Einstein", "text": "Albert Einstein was a German-born...."},
 #   {"_id": "doc2", "title": "", "text": "Wheat beer is a top-fermented beer...."}},
@@ -28,7 +29,7 @@
 
 # Provide the path to your QUERY file, it should be jsonlines format (ref: https://jsonlines.org/)
 # Saved query file must have .jsonl extension (for eg: your_query_file.jsonl)
-# Query file structure: 
+# Query file structure:
 # [
 #   {"_id": "q1", "text": "Who developed the mass-energy equivalence formula?"},
 #   {"_id": "q2", "text": "Which beer is brewed with a large proportion of wheat?"},
@@ -47,9 +48,8 @@
 
 # Load using load_custom function in GenericDataLoader
 corpus, queries, qrels = GenericDataLoader(
-    corpus_file=corpus_path,
-    query_file=query_path,
-    qrels_file=qrels_path).load_custom()
+    corpus_file=corpus_path, query_file=query_path, qrels_file=qrels_path
+).load_custom()
 
 #### Sentence-Transformer ####
 #### Provide any pretrained sentence-transformers model path
@@ -62,4 +62,4 @@
 results = retriever.retrieve(corpus, queries)
 
 #### Evaluate your retrieval using NDCG@k, MAP@K ...
-ndcg, _map, recall, precision = retriever.evaluate(qrels, results, retriever.k_values)
\ No newline at end of file
+ndcg, _map, recall, precision = retriever.evaluate(qrels, results, retriever.k_values)
```

**File**: `examples/retrieval/evaluation/custom/evaluate_custom_metrics.py` (modified, +18/-15)
```diff
@@ -1,29 +1,32 @@
-from beir import util, LoggingHandler
-from beir.retrieval import models
+import logging
+import os
+import pathlib
+import random
+
+from beir import LoggingHandler, util
 from beir.datasets.data_loader import GenericDataLoader
+from beir.retrieval import models
 from beir.retrieval.evaluation import EvaluateRetrieval
 from beir.retrieval.search.dense import DenseRetrievalExactSearch as DRES
 
-import logging
-import pathlib, os
-import random
-
 #### Just some code to print debug information to stdout
-logging.basicConfig(format='%(asctime)s - %(message)s',
-                    datefmt='%Y-%m-%d %H:%M:%S',
-                    level=logging.INFO,
-                    handlers=[LoggingHandler()])
+logging.basicConfig(
+    format="%(asctime)s - %(message)s",
+    datefmt="%Y-%m-%d %H:%M:%S",
+    level=logging.INFO,
+    handlers=[LoggingHandler()],
+)
 #### /print debug information to stdout
 
 dataset = "nfcorpus"
 
 #### Download nfcorpus.zip dataset and unzip the dataset
-url = "https://public.ukp.informatik.tu-darmstadt.de/thakur/BEIR/datasets/{}.zip".format(dataset)
+url = f"https://public.ukp.informatik.tu-darmstadt.de/thakur/BEIR/datasets/{dataset}.zip"
 out_dir = os.path.join(pathlib.Path(__file__).parent.absolute(), "datasets")
 data_path = util.download_and_unzip(url, out_dir)
 
 #### Provide the data path where nfcorpus has been downloaded and unzipped to the data loader
-# data folder would contain these files: 
+# data folder would contain these files:
 # (1) nfcorpus/corpus.jsonl  (format: jsonlines)
 # (2) nfcorpus/queries.jsonl (format: jsonlines)
 # (3) nfcorpus/qrels/test.tsv (format: tsv ("\t"))
@@ -43,7 +46,7 @@
 
 #### Evaluate your retrieval using NDCG@k, MAP@K, Recall@K and P@K
 
-logging.info("Retriever evaluation for k in: {}".format(retriever.k_values))
+logging.info(f"Retriever evaluation for k in: {retriever.k_values}")
 ndcg, _map, recall, precision = retriever.evaluate(qrels, results, retriever.k_values)
 
 #### Evaluate your retreival using MRR@K, Recall_cap@K, Hole@K
@@ -57,9 +60,9 @@
 
 query_id, ranking_scores = random.choice(list(results.items()))
 scores_sorted = sorted(ranking_scores.items(), key=lambda item: item[1], reverse=True)
-logging.info("Query : %s\n" % queries[query_id])
+logging.info(f"Query : {queries[query_id]}\n")
 
 for rank in range(top_k):
     doc_id = scores_sorted[rank][0]
     # Format: Rank x: ID [Title] Body
-    logging.info("Rank %d: %s [%s] - %s\n" % (rank+1, doc_id, corpus[doc_id].get("title"), corpus[doc_id].get("text")))
\ No newline at end of file
+    logging.info(f"Rank {rank + 1}: {doc_id} [{corpus[doc_id].get('title')}] - {corpus[doc_id].get('text')}\n")
```

**File**: `examples/retrieval/evaluation/custom/evaluate_custom_model.py` (modified, +21/-18)
```diff
@@ -1,41 +1,44 @@
-from beir import util, LoggingHandler
+import logging
+import os
+import pathlib
+
+import numpy as np
+
+from beir import LoggingHandler, util
 from beir.datasets.data_loader import GenericDataLoader
 from beir.retrieval.evaluation import EvaluateRetrieval
 from beir.retrieval.search.dense import DenseRetrievalExactSearch as DRES
-from typing import List, Dict
 
-import logging
-import numpy as np
-import pathlib, os
-import random
 
 class YourCustomModel:
     def __init__(self, model_path=None, **kwargs):
-        self.model = None # ---> HERE Load your custom model
+        self.model = None  # ---> HERE Load your custom model
         # self.model = SentenceTransformer(model_path)
-    
+
     # Write your own encoding query function (Returns: Query embeddings as numpy array)
     # For eg ==> return np.asarray(self.model.encode(queries, batch_size=batch_size, **kwargs))
-    def encode_queries(self, queries: List[str], batch_size: int = 16, **kwargs) -> np.ndarray:
+    def encode_queries(self, queries: list[str], batch_size: int = 16, **kwargs) -> np.ndarray:
         pass
-    
-    # Write your own encoding corpus function (Returns: Document embeddings as numpy array)  
+
+    # Write your own encoding corpus function (Returns: Document embeddings as numpy array)
     # For eg ==> sentences = [(doc["title"] + "  " + doc["text"]).strip() for doc in corpus]
     #        ==> return np.asarray(self.model.encode(sentences, batch_size=batch_size, **kwargs))
-    def encode_corpus(self, corpus: List[Dict[str, str]], batch_size: int = 8, **kwargs) -> np.ndarray:
+    def encode_corpus(self, corpus: list[dict[str, str]], batch_size: int = 8, **kwargs) -> np.ndarray:
         pass
 
 
 #### Just some code to print debug information to stdout
-logging.basicConfig(format='%(asctime)s - %(message)s',
-                    datefmt='%Y-%m-%d %H:%M:%S',
-                    level=logging.INFO,
-                    handlers=[LoggingHandler()])
+logging.basicConfig(
+    format="%(asctime)s - %(message)s",
+    datefmt="%Y-%m-%d %H:%M:%S",
+    level=logging.INFO,
+    handlers=[LoggingHandler()],
+)
 #### /print debug information to stdout
 
 #### Download nfcorpus.zip dataset and unzip the dataset
 dataset = "nq.zip"
-url = "https://public.ukp.informatik.tu-darmstadt.de/thakur/BEIR/datasets/{}".format(dataset)
+url = f"https://public.ukp.informatik.tu-darmstadt.de/thakur/BEIR/datasets/{dataset}"
 out_dir = os.path.join(pathlib.Path(__file__).parent.absolute(), "datasets")
 data_path = util.download_and_unzip(url, out_dir)
 
@@ -45,7 +48,7 @@ def encode_corpus(self, corpus: List[Dict[str, str]], batch_size: int = 8, **kwa
 #### Provide your custom model class name --> HERE
 model = DRES(YourCustomModel(model_path="your-custom-model-path"))
 
-retriever = EvaluateRetrieval(model, score_function="cos_sim") # or "dot" if you wish dot-product
+retriever = EvaluateRetrieval(model, score_function="cos_sim")  # or "dot" if you wish dot-product
 
 #### Retrieve dense results (format of results is identical to qrels)
 results = retriever.retrieve(corpus, queries)
```

---

### Incident Patch 5: `58ea70fb` (2023-08-12)
**Commit Message**: fix case where len(local_corpus) < top_k

**File**: `beir/retrieval/search/dense/exact_search_multi_gpu.py` (modified, +20/-8)
```diff
@@ -100,8 +100,6 @@ def search(self,
 
         # WARNING: We remove the query from results if it exists in corpus
         corpus = corpus.filter(lambda x: x["id"] not in queries["id"])
-        if len(corpus) // world_size < top_k:
-            raise NotImplementedError(f"Local corpus size ({len(corpus) // world_size}) is smaller than top_k ({top_k}). Please reduce top_k.")
 
         logger.warning(f"corpus_chunk_size wasn't specified. Setting it to {min(math.ceil(len(corpus) / len(self.target_devices) / 10), 5000)}")
         self.corpus_chunk_size = min(math.ceil(len(corpus) / len(self.target_devices) / 10), 5000) if self.corpus_chunk_size is None else self.corpus_chunk_size
@@ -202,28 +200,42 @@ def search(self,
         # Displace index by all_ranks_corpus_start_idx so that we index `corpus` and not `local_corpus`
         all_chunks_cos_scores_top_k_idx += all_ranks_corpus_start_idx
 
+        # If local_corpus doesn't have top_k samples we pad scores to `pad_gathered_tensor_to`
+        if len(local_corpus) < top_k:
+            pad_gathered_tensor_to = math.ceil(len(corpus) / world_size)
+            cos_scores_top_k_values = torch.cat(
+                [cos_scores_top_k_values, torch.ones((cos_scores_top_k_values.shape[0], pad_gathered_tensor_to - cos_scores_top_k_values.shape[1]), device=cos_scores_top_k_values.device) * -1], 
+                dim=1
+            )
+            all_chunks_cos_scores_top_k_idx = torch.cat(
+                [all_chunks_cos_scores_top_k_idx, torch.ones((all_chunks_cos_scores_top_k_idx.shape[0], pad_gathered_tensor_to - all_chunks_cos_scores_top_k_idx.shape[1]), device=all_chunks_cos_scores_top_k_idx.device, dtype=all_chunks_cos_scores_top_k_idx.dtype) * -1], 
+                dim=1
+            )
+        else:
+            pad_gathered_tensor_to = top_k
+
         # all gather top_k results from all ranks
         n_queries = len(query_ids)
-        all_ranks_top_k_values = torch.empty((world_size, n_queries, top_k), dtype=torch.float32, device="cuda")
-        all_ranks_top_k_idx = torch.empty((world_size, n_queries, top_k), dtype=torch.long, device="cuda")
+        all_ranks_top_k_values = torch.empty((world_size, n_queries, pad_gathered_tensor_to), dtype=cos_scores_top_k_values.dtype, device="cuda")
+        all_ranks_top_k_idx = torch.empty((world_size, n_queries, pad_gathered_tensor_to), dtype=all_chunks_cos_scores_top_k_idx.dtype, device="cuda")
         dist.barrier()
         logger.info(f"All gather top_k values from all ranks...")
         dist.all_gather_into_tensor(all_ranks_top_k_values, cos_scores_top_k_values)
         logger.info(f"All gather top_k idx from all ranks...")
         dist.all_gather_into_tensor(all_ranks_top_k_idx, all_chunks_cos_scores_top_k_idx)
         logger.info(f"All gather ... Done!")
 
-        all_ranks_top_k_values = all_ranks_top_k_values.permute(1, 0, 2).reshape(n_queries, -1) # (n_queries, world_size*(top_k))
-        all_ranks_top_k_idx = all_ranks_top_k_idx.permute(1, 0, 2).reshape(n_queries, -1) # (n_queries, world_size*(top_k))
+        all_ranks_top_k_values = all_ranks_top_k_values.permute(1, 0, 2).reshape(n_queries, -1) # (n_queries, world_size*(pad_gathered_tensor_to))
+        all_ranks_top_k_idx = all_ranks_top_k_idx.permute(1, 0, 2).reshape(n_queries, -1) # (n_queries, world_size*(pad_gathered_tensor_to))
 
         # keep only top_k top scoring docs from all ranks
-        cos_scores_top_k_values, temp_cos_scores_top_k_idx = torch.topk(all_ranks_top_k_values, top_k, dim=1, largest=True) # (num_queries, top_k)
+        cos_scores_top_k_values, temp_cos_scores_top_k_idx = torch.topk(all_ranks_top_k_values, min(top_k, all_ranks_top_k_values.shape[1]), dim=1, largest=True) # (num_queries, top_k)
 
         # `all_ranks_top_k_idx` should index `corpus_ids` and not `all_ranks_top_k_values`
         all_ranks_top_k_idx = torch.gather(all_ranks_top_k_idx, dim=1, index=temp_cos_scores_top_k_idx) # (num_queries, top_k) // indexes between (
```

---

### Incident Patch 6: `4c0d08db` (2023-03-17)
**Commit Message**: Fix BioASQ Avg Q/D according to Paper

The paper states on page 4 that this is 4.7 which is consistent with my own reproduction experiments.

**File**: `README.md` (modified, +1/-1)
```diff
@@ -136,7 +136,7 @@ You can view all datasets available **[here](https://public.ukp.informatik.tu-da
 | MSMARCO    | [Homepage](https://microsoft.github.io/msmarco/)| ``msmarco`` | ✅ | ``train``<br>``dev``<br>``test``|  6,980   |  8.84M     |    1.1 | [Link](https://public.ukp.informatik.tu-darmstadt.de/thakur/BEIR/datasets/msmarco.zip) | ``444067daf65d982533ea17ebd59501e4`` |
 | TREC-COVID |  [Homepage](https://ir.nist.gov/covidSubmit/index.html)| ``trec-covid``| ✅ | ``test``| 50|  171K| 493.5 | [Link](https://public.ukp.informatik.tu-darmstadt.de/thakur/BEIR/datasets/trec-covid.zip) | ``ce62140cb23feb9becf6270d0d1fe6d1`` |
 | NFCorpus   | [Homepage](https://www.cl.uni-heidelberg.de/statnlpgroup/nfcorpus/) | ``nfcorpus`` | ✅ |``train``<br>``dev``<br>``test``|  323     |  3.6K     |  38.2 | [Link](https://public.ukp.informatik.tu-darmstadt.de/thakur/BEIR/datasets/nfcorpus.zip) | ``a89dba18a62ef92f7d323ec890a0d38d`` |
-| BioASQ     | [Homepage](http://bioasq.org) | ``bioasq``| ❌ | ``train``<br>``test`` | 500 |  14.91M    |  8.05 | No | [How to Reproduce?](https://github.com/beir-cellar/beir/blob/main/examples/dataset#2-bioasq) |
+| BioASQ     | [Homepage](http://bioasq.org) | ``bioasq``| ❌ | ``train``<br>``test`` | 500 |  14.91M    |  4.7 | No | [How to Reproduce?](https://github.com/beir-cellar/beir/blob/main/examples/dataset#2-bioasq) |
 | NQ         | [Homepage](https://ai.google.com/research/NaturalQuestions) | ``nq``| ✅ | ``train``<br>``test``| 3,452   |  2.68M  |  1.2 | [Link](https://public.ukp.informatik.tu-darmstadt.de/thakur/BEIR/datasets/nq.zip) | ``d4d3d2e48787a744b6f6e691ff534307`` |
 | HotpotQA   | [Homepage](https://hotpotqa.github.io) | ``hotpotqa``| ✅ |``train``<br>``dev``<br>``test``|  7,405   |  5.23M  |  2.0 | [Link](https://public.ukp.informatik.tu-darmstadt.de/thakur/BEIR/datasets/hotpotqa.zip)  | ``f412724f78b0d91183a0e86805e16114`` |
 | FiQA-2018  | [Homepage](https://sites.google.com/view/fiqa/) | ``fiqa`` | ✅ | ``train``<br>``dev``<br>``test``|  648     |  57K    |  2.6 | [Link](https://public.ukp.informatik.tu-darmstadt.de/thakur/BEIR/datasets/fiqa.zip)  | ``17918ed23cd04fb15047f73e6c3bd9d9`` |
```

---

### Incident Patch 7: `d3372e9e` (2022-09-26)
**Commit Message**: Merge pull request #107 from NouamaneTazi/fix_drpes_ids

fix cos_scores_top_k_idx when using DRPES

**File**: `beir/retrieval/search/dense/exact_search_multi_gpu.py` (modified, +5/-5)
```diff
@@ -42,11 +42,9 @@ def _compute(self, cos_scores_top_k_values, cos_scores_top_k_idx, batch_index):
                 if batch_index[i] == -1:
                     del cos_scores_top_k_values[i]
                     del cos_scores_top_k_idx[i]
-            batch_index = [e for e in batch_index if e != -1]
-            batch_index = np.repeat(batch_index, len(cos_scores_top_k_values[0]))
             cos_scores_top_k_values = np.concatenate(cos_scores_top_k_values, axis=0)
             cos_scores_top_k_idx = np.concatenate(cos_scores_top_k_idx, axis=0)
-            return cos_scores_top_k_values, cos_scores_top_k_idx, batch_index[:len(cos_scores_top_k_values)]
+            return cos_scores_top_k_values, cos_scores_top_k_idx
 
         def warmup(self):
             """
@@ -147,8 +145,7 @@ def search(self,
         metric.filelock = FileLock(os.path.join(metric.data_dir, f"{metric.experiment_id}-{metric.num_process}-{metric.process_id}.arrow.lock"))
         metric.cache_file_name = os.path.join(metric.data_dir, f"{metric.experiment_id}-{metric.num_process}-{metric.process_id}.arrow")
 
-        cos_scores_top_k_values, cos_scores_top_k_idx, chunk_ids = metric.compute()
-        cos_scores_top_k_idx = (cos_scores_top_k_idx.T + chunk_ids * self.corpus_chunk_size).T
+        cos_scores_top_k_values, cos_scores_top_k_idx = metric.compute()
 
         # sort similar docs for each query by cosine similarity and keep only top_k
         sorted_idx = np.argsort(cos_scores_top_k_values, axis=0)[::-1]
@@ -196,6 +193,9 @@ def _encode_multi_process_worker(self, process_id, device, model, input_queue, r
                     cos_scores_top_k_values = cos_scores_top_k_values.T.unsqueeze(0).detach()
                     cos_scores_top_k_idx = cos_scores_top_k_idx.T.unsqueeze(0).detach()
 
+                    # correct sentence ids
+                    cos_scores_top_k_idx += id * self.corpus_chunk_size
+
                     # Store results in an Apache Arrow table
                     metric.add_batch(cos_scores_top_k_values=cos_scores_top_k_values, cos_scores_top_k_idx=cos_scores_top_k_idx, batch_index=[id]*len(cos_scores_top_k_values))
 
```

---

### Incident Patch 8: `30caacb8` (2022-08-29)
**Commit Message**: fix cos_scores_top_k_idx when using DRPES

**File**: `beir/retrieval/search/dense/exact_search_multi_gpu.py` (modified, +5/-5)
```diff
@@ -42,11 +42,9 @@ def _compute(self, cos_scores_top_k_values, cos_scores_top_k_idx, batch_index):
                 if batch_index[i] == -1:
                     del cos_scores_top_k_values[i]
                     del cos_scores_top_k_idx[i]
-            batch_index = [e for e in batch_index if e != -1]
-            batch_index = np.repeat(batch_index, len(cos_scores_top_k_values[0]))
             cos_scores_top_k_values = np.concatenate(cos_scores_top_k_values, axis=0)
             cos_scores_top_k_idx = np.concatenate(cos_scores_top_k_idx, axis=0)
-            return cos_scores_top_k_values, cos_scores_top_k_idx, batch_index[:len(cos_scores_top_k_values)]
+            return cos_scores_top_k_values, cos_scores_top_k_idx
 
         def warmup(self):
             """
@@ -147,8 +145,7 @@ def search(self,
         metric.filelock = FileLock(os.path.join(metric.data_dir, f"{metric.experiment_id}-{metric.num_process}-{metric.process_id}.arrow.lock"))
         metric.cache_file_name = os.path.join(metric.data_dir, f"{metric.experiment_id}-{metric.num_process}-{metric.process_id}.arrow")
 
-        cos_scores_top_k_values, cos_scores_top_k_idx, chunk_ids = metric.compute()
-        cos_scores_top_k_idx = (cos_scores_top_k_idx.T + chunk_ids * self.corpus_chunk_size).T
+        cos_scores_top_k_values, cos_scores_top_k_idx = metric.compute()
 
         # sort similar docs for each query by cosine similarity and keep only top_k
         sorted_idx = np.argsort(cos_scores_top_k_values, axis=0)[::-1]
@@ -196,6 +193,9 @@ def _encode_multi_process_worker(self, process_id, device, model, input_queue, r
                     cos_scores_top_k_values = cos_scores_top_k_values.T.unsqueeze(0).detach()
                     cos_scores_top_k_idx = cos_scores_top_k_idx.T.unsqueeze(0).detach()
 
+                    # correct sentence ids
+                    cos_scores_top_k_idx = cos_scores_top_k_idx + id * self.corpus_chunk_size
+
                     # Store results in an Apache Arrow table
                     metric.add_batch(cos_scores_top_k_values=cos_scores_top_k_values, cos_scores_top_k_idx=cos_scores_top_k_idx, batch_index=[id]*len(cos_scores_top_k_values))
 
```

---

### Incident Patch 9: `7bca6819` (2022-06-30)
**Commit Message**: fix command to generate md5hash

**File**: `README.md` (modified, +1/-1)
```diff
@@ -123,7 +123,7 @@ ndcg, _map, recall, precision = retriever.evaluate(qrels, results, retriever.k_v
 
 ## :beers: Available Datasets
 
-Command to generate md5hash using Terminal:  ``md5hash filename.zip``.
+Command to generate md5hash using Terminal:  ``md5sum filename.zip``.
 
 You can view all datasets available **[here](https://public.ukp.informatik.tu-darmstadt.de/thakur/BEIR/datasets/)** or on **[HuggingFace](https://huggingface.co/BeIR)**.
 
```

---

### Incident Patch 10: `1873394e` (2022-06-29)
**Commit Message**: link fixes in README

**File**: `README.md` (modified, +2/-3)
```diff
@@ -28,12 +28,12 @@
         <a href="https://openreview.net/forum?id=wCu6T5xFjeJ">Paper</a> |
         <a href="#beers-installation">Installation</a> |
         <a href="#beers-quick-example">Quick Example</a> |
-        <a href="#beers-download-a-preprocessed-dataset">Datasets</a> |
+        <a href="#beers-available-datasets">Datasets</a> |
         <a href="https://github.com/beir-cellar/beir/wiki">Wiki</a>
     <p>
 </h4>
 
-> The development of BEIR benchmark is supported by:
+<!-- > The development of BEIR benchmark is supported by: -->
 
 <h3 align="center">
     <a href="http://www.ukp.tu-darmstadt.de"><img style="float: left; padding: 2px 7px 2px 7px;" width="220" height="100" src="./images/ukp.png" /></a>
@@ -126,7 +126,6 @@ Command to generate md5hash using Terminal:  ``md5hash filename.zip``.
 | Dataset   | Website| BEIR-Name | Type | Queries  | Corpus | Rel D/Q | Down-load | md5 |
 | -------- | -----| ---------| --------- | ----------- | ---------| ---------| :----------: | :------:|
 | MSMARCO    | [Homepage](https://microsoft.github.io/msmarco/)| ``msmarco`` | ``train``<br>``dev``<br>``test``|  6,980   |  8.84M     |    1.1 | [Link](https://public.ukp.informatik.tu-darmstadt.de/thakur/BEIR/datasets/msmarco.zip) | ``444067daf65d982533ea17ebd59501e4`` |
-| MSMARCO v2 | [Homepage](https://microsoft.github.io/msmarco/TREC-Deep-Learning.html)| ``msmarco-v2`` | ``train``<br>``dev1``<br>``dev2``|  4,552<br>4,702   |  138M    |   | [Link](https://public.ukp.informatik.tu-darmstadt.de/thakur/BEIR/datasets/msmarco-v2.zip) | ``ba6238b403f0b345683885cc9390fff5`` |
 | TREC-COVID |  [Homepage](https://ir.nist.gov/covidSubmit/index.html)| ``trec-covid``| ``test``| 50|  171K| 493.5 | [Link](https://public.ukp.informatik.tu-darmstadt.de/thakur/BEIR/datasets/trec-covid.zip) | ``ce62140cb23feb9becf6270d0d1fe6d1`` |
 | NFCorpus   | [Homepage](https://www.cl.uni-heidelberg.de/statnlpgroup/nfcorpus/) | ``nfcorpus`` | ``train``<br>``dev``<br>``test``|  323     |  3.6K     |  38.2 | [Link](https://public.ukp.informatik.tu-darmstadt.de/thakur/BEIR/datasets/nfcorpus.zip) | ``a89dba18a62ef92f7d323ec890a0d38d`` |
 | BioASQ     | [Homepage](http://bioasq.org) | ``bioasq``|  ``train``<br>``test`` | 500    |  14.91M    |  8.05 | No | [How to Reproduce?](https://github.com/beir-cellar/beir/blob/main/examples/dataset#2-bioasq) |
```

#### Recent Merged Pull Requests:
- **PR #213** (closed): Add BEIR raw datasets, OIDA evaluation scripts, and analysis results (@Botchuino)
- **PR #211** (closed): [Docs] Add RAG debugging checklist for BEIR users (@onestardao)
- **PR #203** (2025-10-16): Fix incorrect import paths within apis package (@n0gu-furiosa)
- **PR #201** (2025-06-04): merge latest development into main (@thakur-nandan)
- **PR #200** (2025-06-03): relax faiss type dependency as its optional; breaking when faiss is not installed (@thakur-nandan)
- **PR #199** (closed): Ric (@richard-guyunqi)
- **PR #192** (2025-02-25): Merge development into main (@thakur-nandan)
- **PR #191** (2025-02-04): merge latest main into development (@thakur-nandan)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
