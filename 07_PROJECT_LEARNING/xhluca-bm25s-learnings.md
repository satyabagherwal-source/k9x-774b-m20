# Forensic Learning Record (Deep Inspection): xhluca/bm25s

> **Canonical Artifact**: `07_PROJECT_LEARNING/xhluca-bm25s-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/xhluca/bm25s](https://github.com/xhluca/bm25s))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-06T06:03:06.122Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `xhluca/bm25s`
- **Description**: Fast BM25 search in Python, powered by Numpy and Numba
- **Primary Language / Ecosystem**: Python
- **Discovered Manifests / Configurations**: README.md
- **Stars / Engagement**: 1801 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `bm25s/numba/retrieve_utils.py`
```
import os
from numba import njit, prange
import numpy as np
from typing import List, Tuple, Any
import logging

from .. import utils
from ..scoring import _compute_relevance_from_scores_jit_ready
from .selection import _numba_sorted_top_k

_compute_relevance_from_scores_jit_ready = njit()(_compute_relevance_from_scores_jit_ready)

def _retrieve_internal_jitted(
    query_tokens_ids_flat: np.ndarray,
    query_pointers: np.ndarray,
    k: int,
    sorted: bool,
    dtype: np.dtype,
    int_dtype: np.dtype,
    data: np.ndarray,
    indptr: np.ndarray,
    indices: np.ndarray,
    num_docs: int,
    nonoccurrence_array: np.ndarray = None,
    weight_mask: np.ndarray = None,
):
    N = len(query_pointers) - 1

    topk_scores = np.zeros((N, k), dtype=dtype)
    topk_indices = np.zeros((N, k), dtype=int_dtype)

    for i in prange(N):
        query_tokens_single = query_tokens_ids_flat[query_pointers[i] : query_pointers[i + 1]]

        # query_tokens_single = np.asarray(query_tokens_single, dtype=int_dtype)
        scores_single = _compute_relevance_from_scores_jit_ready(
            query_tokens_ids=query_tokens_single,
            data=data,
            indptr=indptr,
            indices=indices,
            num_docs=num_docs,
            dtype=dtype,
        )

        # if there's a non-occurrence array, we need to add the non-occurrence score
        # back to the scores
        if nonoccurrence_array is not None:
            nonoccurrence_scores = nonoccurrence_array[query_tokens_single].sum()
            scores_single += nonoccurrence_scores

        if weight_mask is not None:
            scores_single = scores_single * weight_mask

        topk_scores_sing, topk_indices_sing = _numba_sorted_top_k(
            scores_single, k=k, sorted=sorted
        )
        topk_scores[i] = topk_scores_sing
        topk_indices[i] = topk_indices_sing

    return topk_scores, topk_indices


_retrieve_internal_jitted_parallel = njit(parallel=True)(_retrieve_internal_jitted)
_retrieve_internal_jitted_serial = njit(nogil=True)(_retrieve_internal_jitted)


def _retrieve_numba_functional(
    query_tokens_ids,
    scores,
    corpus: List[Any] = None,
    k: int = 10,
    sorted: bool = True,
    return_as: str = "tuple",
    show_progress: bool = True,
    leave_progress: bool = False,
    n_threads: int = 0,
    chunksize: int = None,
    nonoccurrence_array=None,
    backend_selection="numba",
    dtype="float32",
    int_dtype="int32",
    weight_mask=None,
):
    from numba import get_num_threads, set_num_threads


    if backend_selection != "numba":
        error_msg = "The `numba` backend must be selected when retrieving using the numba backend. Please choose a different backend or change the backend_selection parameter to numba."
        raise ValueError(error_msg)

    if chunksize != None:
        # warn the user that the chunksize parameter is ignored
        logging.warning(
            "The `chunksize` parameter is ignored in the `retrieve` function when using the `numba` backend."
            "The function will automatically determine the best chunksize."
        )

    allowed_return_as = ["tuple", "documents"]

    if return_as not in allowed_return_as:
        raise ValueError("`return_as` must be either 'tuple' or 'documents'")
    else:
        pass

    if n_threads == -1:
        n_threads = os.cpu_count()
    elif n_threads == 0:
        n_threads = 1

    og_n_threads: int | None = None
    # Use serial execution when n_threads is one, so we don't need to call into numba.
    # This also makes n_threads = 1 thread-safe.
    if n_threads > 1:
        # get og thread count
        og_n_threads = get_num_threads()
        set_num_threads(n_threads)

    # use serial execution when n_threads is one, since we didn't set set_num_threads.
    retrieve_internal = _retrieve_internal_jitted_serial if n_threads == 1 else _retrieve_internal_jitted_parallel

    # convert query_tokens_ids from list of list to a flat 1-d np.ndarray with
    # pointers to the start of each query to be used to find the boundaries of each query
    query_pointers = np.cumsum([0] + [len(q) for q in query_tokens_ids], dtype=int_dtype)
    query_tokens_ids_flat = np.concatenate(query_tokens_ids).astype(int_dtype)

    retrieved_scores, retrieved_indices = retrieve_internal(
        query_pointers=query_pointers,
        query_tokens_ids_flat=query_tokens_ids_flat,
        k=k,
        sorted=sorted,
        dtype=np.dtype(dtype),
        int_dtype=np.dtype(int_dtype),
        data=scores["data"],
        indptr=scores["indptr"],
        indices=scores["indices"],
        num_docs=scores["num_docs"],
        nonoccurrence_array=nonoccurrence_array,
        weight_mask=weight_mask,
    )

    # reset the number of threads
    if og_n_threads is not None:
        set_num_threads(og_n_threads)

    if corpus is None:
        retrieved_docs = retrieved_indices
    else:
        # if it is a JsonlCorpus object, we do not need to convert it to a list
        if isinstance(corpus, utils.corpus.JsonlCorpus):
            retrieved_docs = corpus[retrieved_indices]
        elif isinstance(corpus, np.ndarray) and corpus.ndim == 1:
            retrieved_docs = corpus[retrieved_indices]
        else:
            index_flat = retrieved_indices.flatten().tolist()
            results = [corpus[i] for i in index_flat]
            retrieved_docs = np.array(results).reshape(retrieved_indices.shape)

    if return_as == "tuple":
        return retrieved_docs, retrieved_scores
    elif return_as == "documents":
        return retrieved_docs
    else:
        raise ValueError("`return_as` must be either 'tuple' or 'documents'")

```

### Core Architecture Module: `bm25s/utils/__init__.py`
```
from . import benchmark, beir, corpus, json_functions
```

### Core Architecture Module: `bm25s/utils/beir.py`
```
import json
import logging
from pathlib import Path
from typing import Dict, List, Tuple

import os

def _faketqdm(*args, **kwargs):
    return args[0] if len(args) > 0 else None
try:
    if os.environ.get("DISABLE_TQDM", False):
        tqdm = _faketqdm
    else:
        from tqdm.auto import tqdm
except ImportError:
    tqdm = _faketqdm


from . import json_functions

GH_URL = "https://github.com/xhluca/bm25s/releases/download/data/{}.zip"
BASE_URL = GH_URL


def clean_results_keys(beir_results):
    return {k.split("@")[-1]: v for k, v in beir_results.items()}


def postprocess_results_for_eval(results, scores, query_ids):
    """
    Given the queried results and scores output by BM25S, postprocess them
    to be compatible with BEIR evaluation functions.
    query_ids is a list of query ids in the same order as the results.
    """

    results_record = [
        {"id": qid, "hits": results[i], "scores": list(scores[i])}
        for i, qid in enumerate(query_ids)
    ]

    result_dict_for_eval = {
        res["id"]: {
            docid: float(score) for docid, score in zip(res["hits"], res["scores"])
        }
        for res in results_record
    }

    return result_dict_for_eval


def merge_cqa_dupstack(data_path, show_progress=True, leave_progress=False):
    data_path = Path(data_path)
    dataset = data_path.name
    assert dataset == "cqadupstack", "Dataset must be CQADupStack"

    # check if corpus.jsonl exists
    corpus_path = data_path / "corpus.jsonl"
    if not corpus_path.exists():
        # combine all the corpus files into one
        # corpus files are located under cqadupstack/<name>/corpus.jsonl
        corpus_files = list(data_path.glob("*/corpus.jsonl"))
        with open(corpus_path, "w") as f:
            for file in tqdm(corpus_files, desc="Merging Corpus", leave=leave_progress, disable=not show_progress):
                # get the name of the corpus
                corpus_name = file.parent.name

                with open(file, "r") as f2:
                    for line in tqdm(
                        f2, desc=f"Merging {corpus_name} Corpus", leave=leave_progress, disable=not show_progress
                    ):
                        line = json_functions.loads(line)
                        # add the corpus name to _id
                        line["_id"] = f"{corpus_name}_{line['_id']}"
                        # write back to file
                        f.write(json.dumps(line)) # json_functions.dumps generates json that can't be read by beir
                        f.write("\n")

    # now, do the same for queries.jsonl
    queries_path = data_path / "queries.jsonl"
    if not queries_path.exists():
        queries_files = list(data_path.glob("*/queries.jsonl"))
        with open(queries_path, "w") as f:
            for file in tqdm(queries_files, desc="Merging Queries", leave=leave_progress, disable=not show_progress):
                # get the name of the corpus
                corpus_name = file.parent.name

                with open(file, "r") as f2:
                    for line in tqdm(
                        f2, desc=f"Merging {corpus_name} Queries", leave=leave_progress, disable=not show_progress
                    ):
                        line = json_functions.loads(line)
                        # add the corpus name to _id
                        line["_id"] = f"{corpus_name}_{line['_id']}"
                        # write back to file
                        f.write(json_functions.dumps(line))
                        f.write("\n")

    # now, do the same for qrels/test.tsv
    qrels_path = data_path / "qrels" / "test.tsv"
    qrels_path.parent.mkdir(parents=True, exist_ok=True)

    if not qrels_path.exists():
        qrels_files = list(data_path.glob("*/qrels/test.tsv"))
        with open(qrels_path, "w") as f:
            # First, write the columns: query-id	corpus-id	score
            f.write("query-id\tcorpus-id\tscore\n")
            for file in tqdm(qrels_files, desc="Merging Qrels", leave=leave_progress, disable=not show_progress):
                # get the name of the corpus
                corpus_name = file.parent.parent.name
                with open(file, "r") as f2:
                    # skip first line
                    next(f2)

                    for line in tqdm(
                        f2, desc=f"Merging {corpus_name} Qrels", leave=leave_progress, disable=not show_progress
                    ):
                        # since it's a tsv, split by tab
                        qid, cid, score = line.strip().split("\t")
                        # add the corpus name to _id
                        qid = f"{corpus_name}_{qid}"
                        cid = f"{corpus_name}_{cid}"
                        # write back to file
                        f.write(f"{qid}\t{cid}\t{score}\n")


def download_dataset(
    dataset,
    base_url=GH_URL,
    save_dir="./datasets",
    unzip=True,
    redownload=False,
    show_progress=True,
    leave_progress=False,
):
    import urllib.request
    import urllib.error
    import zipfile
    from pathlib import Path
    from tqdm.auto import tqdm

    save_dir = Path(save_dir)
    save_dir.mkdir(parents=True, exist_ok=True)

    url = base_url.format(dataset)
    # check if zip file already exist
    save_zip_path = save_dir / "archive" / f"{dataset}.zip"
    save_zip_path.parent.mkdir(parents=True, exist_ok=True)

    def download_file(src_url, dst_path, desc):
        pbar = tqdm(
            unit="B",
            unit_scale=True,
            desc=desc,
            leave=leave_progress,
            disable=not show_progress,
        )
        with open(dst_path, "wb") as f:
            response = urllib.request.urlopen(src_url)
            total_size = int(response.headers.get("content-length", 0))
            block_size = 8192 * 2
            pbar.total = total_size
            while True:
                buffer = response.read(block_size)
                if not buffer:
                    break
                f.write(buffer)
                pbar.update(len(buffer))

        pbar.close()

    def download_multipart_release(dataset_url, dst_path):
        part_paths = []
        for part_idx in range(1000):
            part_path = dst_path.parent / f"{dst_path.name}.part-{part_idx:03d}"
            part_url = f"{dataset_url}.part-{part_idx:03d}"
            try:
                download_file(
                    part_url, part_path, f"Downloading {dataset} part {part_idx:03d}"
                )
            except urllib.error.HTTPError as exc:
                if part_path.exists():
                    part_path.unlink()
                if exc.code == 404 and part_idx > 0:
                    break
                raise
            part_paths.append(part_path)

        if not part_paths:
            raise FileNotFoundError(
                f"No release assets found for dataset {dataset} at {dataset_url}"
            )

        with open(dst_path, "wb") as f_out:
            for part_path in tqdm(
                part_paths,
                desc=f"Assembling {dataset}",
                leave=leave_progress,
                disable=not show_progress,
            ):
                with open(part_path, "rb") as f_in:
                    while True:
                        chunk = f_in.read(8192 * 2)
                        if not chunk:
                            break
                        f_out.write(chunk)
                part_path.unlink()

    if not save_zip_path.exists() or redownload:
        try:
            download_file(url, save_zip_path, f"Downloading {dataset}")
        except urllib.error.HTTPError as exc:
            if exc.code == 404:
                download_multipart_release(url, save_zip_path)
            else:
                raise

    # now that we have the zip file, extract it
    if unzip:
        with zipfile.ZipFile(save_zip_path, "r") as zip_ref:
            zip_ref.extractall(save_dir)

        # if it's CQADupStack, merge the corpus, queries, and qrels
        if dataset == "cqadupstack":
            merge_cqa_dupstack(save_dir / dataset, show_progress=show_progress, leave_progress=leave_progress)

        return save_dir / dataset
    else:
        return save_zip_path


def load_jsonl(
    dataset,
    fname,
    save_dir="./datasets",
    show_progress=True,
    leave_progress=False,
    return_dict=True,
    force_title=False,
    remove=None,
):
    dataset_path = Path(save_dir) / dataset
    corpus_path = dataset_path / fname

    if not corpus_path.exists():
        raise FileNotFoundError(f"Corpus file not found at {corpus_path}")

    corpus = []
    with open(corpus_path, "r") as f:
        # get the number of bytes in the file
        num_lines = sum(1 for i in open(corpus_path, "rb"))
        pbar = tqdm(
            f,
            desc="[{}] loading {}".format(dataset, fname),
            leave=leave_progress,
            disable=not show_progress,
            total=num_lines,
        )
        for line in pbar:
            line = json_functions.loads(line)
            if force_title:
                line["title"] = line.get("title")
            if remove is not None:
                for key in remove:
                    del line[key]
            corpus.append(line)
            # update the progress bar wrt the number of bytes read

    if return_dict:
        corpus = {doc.pop("_id"): doc for doc in corpus}

    return corpus


def load_corpus(dataset, save_dir="./datasets", show_progress=True, leave_progress=False, return_dict=True):
    return load_jsonl(
        dataset=dataset,
        save_dir=save_dir,
        show_progress=show_progress,
        leave_progress=leave_progress,
        return_dict=return_dict,
        fname="corpus.jsonl",
        force_title=True,
        remove=["metadata"],
    )


def load_queries(dataset, save_dir="./datasets", show_progress=True, leave_progress=False, return_dict=True):
    return load_jsonl(
        dataset=dataset,
    
```

### Core Architecture Module: `bm25s/utils/benchmark.py`
```
from copy import deepcopy
import logging
import time
import sys

logger = logging.getLogger(__name__)

try:
    import resource
except ImportError:
    logger.debug("resource module not available on Windows")
    resource = None


def get_max_memory_usage(format="GB"):
    if resource is None:
        logger.warning("resource module not available, cannot get memory usage")
        return None
    if format not in ["GB", "MB", "KB"]:
        raise ValueError("format should be one of 'GB', 'MB', 'KB'")

    usage_kb = resource.getrusage(resource.RUSAGE_SELF).ru_maxrss
    # for mac, ru_maxrss is in bytes
    
    if sys.platform == "darwin":
        usage_kb /= 1024
    
    if format == "GB":
        return usage_kb / (1024**2)
    elif format == "MB":
        return usage_kb / 1024
    else:
        return usage_kb


class Timer:
    def __init__(self, prefix="", precision=4):
        self.results = {}
        self.prefix = prefix
        self.precision = precision

    def start(self, name):
        if name in self.results:
            raise ValueError(f"Timer with name {name} already started.")
        start_time = time.monotonic()
        self.results[name] = {"start": start_time, "elapsed": 0, "last": start_time}
        return name

    def stop(self, name, show=False, n_total=None):
        if name not in self.results:
            raise ValueError(f"Timer with name {name} not started.")

        stop_time = time.monotonic()
        r = self.results[name]
        r["stopped"] = stop_time
        r["elapsed"] += stop_time - r.pop("last")

        if show:
            self.show(name, n_total=n_total)

        return self.results[name]["elapsed"]

    def pause(self, name):
        # if self.has_stopped(name):
        #     raise ValueError(f"Timer with name {name} already stopped.")

        # if not self.has_started(name):
        #     raise ValueError(f"Timer with name {name} not started.")

        paused_time = time.monotonic()
        r = self.results[name]

        r["elapsed"] += paused_time - r["last"]

    def resume(self, name):
        # if not self.has_started(name):
        #     raise ValueError(f"Timer with name {name} not started.")

        # if not self.is_paused(name):
        #     raise ValueError(f"Timer with name {name} not paused.")

        # if self.has_stopped(name):
        #     raise ValueError(f"Timer with name {name} already stopped.")

        self.results[name]["last"] = time.monotonic()

    def is_paused(self, name):
        return name in self.results and "paused" in self.results[name]

    def is_resumed(self, name):
        return name in self.results and "resumed" in self.results[name]

    def has_started(self, name):
        return name in self.results

    def has_stopped(self, name):
        return self.has_started(name) and "stopped" in self.results[name]

    def elapsed(self, name, precision=None):
        if precision is None:
            precision = self.precision

        if not self.has_started(name):
            raise ValueError(f"Timer with name {name} not started.")
        if not self.has_stopped(name):
            raise ValueError(f"Timer with name {name} not stopped.")

        return round(self.results[name]["elapsed"], precision)

    def show(self, name, offset=0, n_total=None):
        t = self.elapsed(name) + offset
        s = f"{self.prefix} {name}: {t:.4f}s"
        if n_total is not None:
            # calculate throughput
            throughput = n_total / t
            s += f" ({throughput:.2f}/s)"
        print(s)

    def show_all(self):
        for name in self.results:
            if self.has_stopped(name):
                self.show(name)

    def to_dict(self, underscore=False, lowercase=False):
        results_to_save = deepcopy(self.results)
        if underscore:
            results_to_save = {
                k.replace(" ", "_"): v for k, v in results_to_save.items()
            }

        if lowercase:
            results_to_save = {k.lower(): v for k, v in results_to_save.items()}

        return results_to_save

```

### Core Architecture Module: `bm25s/utils/corpus.py`
```
import logging
import mmap
import os

import numpy as np

try:
    import orjson as json
except ImportError:
    import json


def _faketqdm(*args, **kwargs):
    return args[0] if len(args) > 0 else None
try:
    if os.environ.get("DISABLE_TQDM", False):
        tqdm = _faketqdm
    else:
        from tqdm.auto import tqdm
except ImportError:
    tqdm = _faketqdm

from . import json_functions

def change_extension(path, new_extension):
    """Replace the final filename extension, or append one if it has none."""
    path = str(path)
    return os.path.splitext(path)[0] + new_extension


def find_newline_positions(path, show_progress=True, leave_progress=True, encoding="utf-8"):
    path = str(path)
    indexes = []
    with open(path, "r", encoding=encoding) as f:
        indexes.append(f.tell())
        pbar = tqdm(
            total=os.path.getsize(path),
            desc="Finding newlines for mmindex",
            unit="B",
            unit_scale=True,
            disable=not show_progress,
            leave=leave_progress,
        )

        while f.readline():
            t = f.tell()
            indexes.append(t)
        
            if pbar is not None:
                pbar.update(t - indexes[-2])
        
        if pbar is not None:
            pbar.close()

    return indexes[:-1]


def save_mmindex(indexes, path, encoding="utf-8"):
    path = str(path)
    index_file = change_extension(path, ".mmindex.json")
    with open(index_file, "w", encoding=encoding) as f:
        f.write(json_functions.dumps(indexes))


def load_mmindex(path, encoding="utf-8"):
    path = str(path)
    index_file = change_extension(path, ".mmindex.json")
    with open(index_file, "r", encoding=encoding) as f:
        return json_functions.loads(f.read())


# now we can jump to any line in the file thanks to the index and mmap
def get_line(
    path,
    index,
    mmindex,
    encoding="utf-8",
    file_obj=None,
    mmap_obj=None,
) -> str:
    path = str(path)
    if file_obj is None:
        file_obj = open(path, "r", encoding=encoding)
        CLOSE_FILE = True
    else:
        CLOSE_FILE = False

    if mmap_obj is None:
        mmap_obj = mmap.mmap(file_obj.fileno(), 0, access=mmap.ACCESS_READ)
        CLOSE_MMAP = True
    else:
        CLOSE_MMAP = False

    mmap_obj.seek(mmindex[index])
    result = mmap_obj.readline().decode(encoding)

    if CLOSE_MMAP:
        mmap_obj.close()

    if CLOSE_FILE:
        file_obj.close()

    return result


class JsonlCorpus:
    """
    A class to read a jsonl file line by line using mmap, allowing extremely fast
    access to any line in the file. For example, you could access the N-th line
    of a 10GB file in a fraction of a second, returning a dictionary.

    Example
    --------

    Traditioanally, you would read a jsonl file line by line like this:

    ```python
    import json
    data = [json.loads(line) for line in open("file.jsonl")]
    print(corpus[1000])
    ```

    This is memory inefficient and has a large overhead. Instead, you can use this class:

    ```python
    corpus = JsonlCorpus("file.jsonl")
    print(corpus[1000])
    ```

    Which only loads the line you need into memory, and is much faster.
    """

    def __init__(self, path, show_progress=True, leave_progress=True, save_index=True, verbosity=1, encoding='utf-8'):
        self.path = path
        self.verbosity = verbosity
        self.encoding = encoding

        # if the index file does not exist, create it
        if os.path.exists(change_extension(path, ".mmindex.json")):
            self.mmindex = load_mmindex(path, encoding=self.encoding)
        else:
            logging.info("Creating index file for jsonl corpus")
            mmindex = find_newline_positions(
                path, show_progress=show_progress, leave_progress=leave_progress, encoding=self.encoding
            )
            if save_index:
                save_mmindex(mmindex, path, encoding=self.encoding)

            self.mmindex = mmindex

        # Finally, open the file and mmap objects
        self.load()

    def __len__(self):
        return len(self.mmindex)

    def __getitem__(self, index):
        # handle multiple indices
        if isinstance(index, int):
            return json_functions.loads(
                get_line(
                    self.path,
                    index,
                    self.mmindex,
                    encoding=self.encoding,
                    file_obj=self.file_obj,
                    mmap_obj=self.mmap_obj,
                )
            )

        if isinstance(index, slice):
            return [self.__getitem__(i) for i in range(*index.indices(len(self)))]
        if isinstance(index, (list, tuple)):
            return [self.__getitem__(i) for i in index]
        if isinstance(index, np.ndarray):
            # if it's an ndarray, this means each element is an index, and the array can
            # be of any shape. thus, we should flatten it first, get the results as if it
            # was a list, and then reshape it back to the original shape
            index_flat = index.flatten().tolist()
            results = [self.__getitem__(i) for i in index_flat]
            reshaped = np.array(results).reshape(index.shape)
            return reshaped
        
        raise TypeError("Invalid index type")

    def close(self):
        """
        Close the file and mmap objects. This is useful if you want to free up memory. To reopen them, use the `load` method.
        If you don't call this method, the objects will be closed automatically when the object is deleted.
        """
        if hasattr(self, "file_obj") and self.file_obj is not None:
            self.file_obj.close()
            # delete the object
            del self.file_obj
            self.file_obj = None
        if hasattr(self, "mmap_obj") and self.mmap_obj is not None:
            self.mmap_obj.close()
            # delete the object
            del self.mmap_obj
            self.mmap_obj = None
        if self.verbosity >= 1:
            logging.info("Closed file and mmap objects")
    
    def load(self):
        """
        Load the file and mmap objects. This is useful if you closed them and want to reopen them.

        Note
        ----
        This is called automatically when the object is created. You don't need to call it manually.
        Also, if there is an existing file and mmap object, this will close them before reopening.
        """
        self.close()  # close any existing file and mmap objects

        self.file_obj = open(self.path, "r", encoding=self.encoding)
        self.mmap_obj = mmap.mmap(self.file_obj.fileno(), 0, access=mmap.ACCESS_READ)
        if self.verbosity >= 1:
            logging.info("Opened file and mmap objects")
    
    def __del__(self):
        self.close()

```

### Core Architecture Module: `bm25s/utils/json_functions.py`
```
import json

try:
    import orjson
    ORJSON_AVAILABLE = True
except ImportError:
    ORJSON_AVAILABLE = False
    

def dumps_with_builtin(d: dict, **kwargs) -> str:
    return json.dumps(d, **kwargs)

def dumps_with_orjson(d: dict, **kwargs) -> str:
    if kwargs.get("ensure_ascii", True):
        # Simulate `ensure_ascii=True` by escaping non-ASCII characters
        return orjson.dumps(d).decode("utf-8").encode("ascii", "backslashreplace").decode("utf-8")
    # Ignore other kwargs not supported by orjson
    return orjson.dumps(d).decode("utf-8")

if ORJSON_AVAILABLE:
    def dumps(d: dict, **kwargs) -> str:
        return dumps_with_orjson(d, **kwargs)
    loads = orjson.loads
else:
    def dumps(d: dict, **kwargs) -> str:
        return dumps_with_builtin(d, **kwargs)
    loads = json.loads



```

### Core Architecture Module: `bm25s/__init__.py`
```
from concurrent.futures import ThreadPoolExecutor
from collections import Counter
from functools import partial

import os
import logging
from pathlib import Path
import json
from typing import Any, Tuple, Dict, Iterable, List, NamedTuple, Union

import numpy as np

from .utils import json_functions as json_functions

try:
    from numba import njit
    from .numba import selection as selection_jit
    NUMBA_AVAILABLE = True
except ImportError:
    njit = lambda x: x  # type: ignore
    NUMBA_AVAILABLE = False
try:
    import scipy.sparse as sp
    SCIPY_AVAILABLE = True
except ImportError:
    SCIPY_AVAILABLE = False

try:
    from .numba.retrieve_utils import _retrieve_numba_functional
except ImportError:
    _retrieve_numba_functional = None


def _faketqdm(*args, **kwargs):
    return args[0] if len(args) > 0 else None


if os.environ.get("DISABLE_TQDM", False):
    tqdm = _faketqdm
    # if can't import tqdm, use a fake tqdm
else:
    try:
        from tqdm.auto import tqdm
    except ImportError:
        tqdm = _faketqdm


from . import utils, stopwords, scoring, tokenization
from . import selection as selection_np
from .version import __version__
from .tokenization import tokenize
from .scoring import (
    _select_tfc_scorer,
    _select_idf_scorer,
    _build_scores_and_indices_for_matrix,
    _calculate_doc_freqs,
    _build_idf_array,
    _build_nonoccurrence_array,
    _np_csc_python,
    _np_csc_jit_ready,
)

logger = logging.getLogger("bm25s")
logger.setLevel(logging.DEBUG)


class Results(NamedTuple):
    """
    NamedTuple with two fields: documents and scores. The `documents` field contains the
    retrieved documents or indices, while the `scores` field contains the scores of the
    retrieved documents or indices.
    """

    documents: np.ndarray
    scores: np.ndarray

    def __len__(self):
        return len(self.documents)

    @classmethod
    def merge(cls, results: List["Results"]) -> "Results":
        """
        Merge a list of Results objects into a single Results object.
        """
        documents = np.concatenate([r.documents for r in results], axis=0)
        scores = np.concatenate([r.scores for r in results], axis=0)
        return cls(documents=documents, scores=scores)


def get_unique_tokens(
    corpus_tokens, show_progress=True, leave_progress=False, desc="Create Vocab"
):
    unique_tokens = set()
    for doc_tokens in tqdm(
        corpus_tokens, desc=desc, disable=not show_progress, leave=leave_progress
    ):
        unique_tokens.update(doc_tokens)
    return unique_tokens


def is_list_of_list_of_type(obj, type_=int):
    if not isinstance(obj, list):
        return False

    if len(obj) == 0:
        return False

    first_elem = obj[0]
    if not isinstance(first_elem, list):
        return False

    if len(first_elem) == 0:
        return False

    first_token = first_elem[0]
    if not isinstance(first_token, type_):
        return False

    return True


def _is_tuple_of_list_of_tokens(obj):
    if not isinstance(obj, tuple):
        return False

    if len(obj) == 0:
        return False

    first_elem = obj[0]
    if not isinstance(first_elem, list):
        return False

    if len(first_elem) == 0:
        return False

    first_token = first_elem[0]
    if not isinstance(first_token, str):
        return False

    return True


class BM25:
    def __init__(
        self,
        k1=1.5,
        b=0.75,
        delta=0.5,
        method="lucene",
        idf_method=None,
        dtype="float32",
        int_dtype="int32",
        corpus=None,
        backend="numpy",
        csc_backend="numpy",
        auto_compile=True,
    ):
        """
        BM25S initialization.

        Parameters
        ----------
        k1 : float
            The k1 parameter in the BM25 formula.

        b : float
            The b parameter in the BM25 formula.

        delta : float
            The delta parameter in the BM25L and BM25+ formulas; it is ignored for other methods.

        method : str
            The method to use for scoring term frequency. Choose from 'robertson', 'lucene', 'atire'.

        idf_method : str
            The method to use for scoring inverse document frequency (same choices as `method`).
            If None, it will use the same method as `method`. If you are unsure, please do not
            change this parameter.
        dtype : str
            The data type of the BM25 scores.

        int_dtype : str
            The data type of the indices in the BM25 scores.

        corpus : Iterable[Any], optional
            Optional corpus entries to keep on the retriever and save with the index.
            Retrieval returns the corpus entry at the matched document index, and
            dictionaries do not require any specific keys. If saved, entries must be
            strings, dictionaries, lists, or tuples that can be serialized to JSON.
            String entries are serialized as dictionaries with ``id`` and ``text``
            fields.

        backend : str
            The backend used during retrieval. By default, it uses the numpy backend, which
            only requires numpy and scipy as dependencies. You can also select `backend="numba"`
            to use the numba backend, which requires the numba library. If you select `backend="auto"`,
            the function will use the numba backend if it is available, otherwise it will use the numpy
            backend.
        
        csc_backend : str
            The backend used for constructing the CSC matrix. Choose from 'scipy' or 'numpy'. By default,
            it uses the 'numpy' backend, which does not require scipy as a dependency. If you select 'scipy',
            it will use the scipy.sparse.csc_matrix to construct the CSC matrix, which requires scipy as a 
            dependency. Note that `scipy` might be faster than `numpy`, but if you activate the numba backend,
            the difference is negligible.
        
        auto_compile : bool
            If True, it will automatically compile the JIT functions when using the numba backend.
            This may take some time during the first run, but will speed up subsequent runs.
        """
        self.k1 = k1
        self.b = b
        self.delta = delta
        self.dtype = dtype
        self.int_dtype = int_dtype
        self.method = method
        self.idf_method = idf_method if idf_method is not None else method
        self.methods_requiring_nonoccurrence = ("bm25l", "bm25+")
        self.corpus = corpus
        self._original_version = __version__
        self.csc_backend = csc_backend

        if backend == "auto":
            self.backend = "numba" if NUMBA_AVAILABLE else "numpy"
        else:
            self.backend = backend
        
        if csc_backend == "auto":
            self.csc_backend = "scipy" if SCIPY_AVAILABLE else "numpy"
        
        if self.backend == "numba" and not NUMBA_AVAILABLE:
            raise ImportError(
                "Numba is not installed. Please install numba with `pip install numba` to use the numba backend."
            )
        
        if csc_backend == "scipy" and not SCIPY_AVAILABLE:
            raise ImportError(
                "scipy is not installed. Please install scipy to use the scipy csc_backend."
            )
        
        NUMBA_IS_DISABLED = os.environ.get("NUMBA_DISABLE_JIT") in [None, False]
        if auto_compile and self.backend == "numba" and not NUMBA_IS_DISABLED:
            # by default, we don't want to warm up the Numba functions
            self.compile(activate_numba=True, warmup=False)

    @staticmethod
    def _infer_corpus_object(corpus):
        """
        Verifies if the corpus is a list of list of strings, an object with the `ids` and `vocab` attributes,
        or a tuple of two lists: first is list of list of ids, second is the vocab dictionary.
        """
        if hasattr(corpus, "ids") and hasattr(corpus, "vocab"):
            return "object"
        elif isinstance(corpus, tuple) and len(corpus) == 2:
            c1, c2 = corpus
            if isinstance(c1, list) and isinstance(c2, dict):
                return "tuple"
            else:
                raise ValueError(
                    "Corpus must be a list of list of tokens, an object with the `ids` and `vocab` attributes, or a tuple of two lists: the first list is the list of unique token IDs, and the second list is the list of token IDs for each document."
                )
        elif isinstance(corpus, Iterable):
            if is_list_of_list_of_type(corpus, type_=int):
                return "token_ids"
            else:
                return "tokens"
        else:
            raise ValueError(
                "Corpus must be a list of list of tokens, an object with the `ids` and `vocab` attributes, or a tuple of two lists: the first list is the list of unique token IDs, and the second list is the list of token IDs for each document."
            )

    @staticmethod
    def _compute_relevance_from_scores(
        data: np.ndarray,
        indptr: np.ndarray,
        indices: np.ndarray,
        num_docs: int,
        query_tokens_ids: np.ndarray,
        dtype: np.dtype,
    ) -> np.ndarray:
        """
        This internal static function calculates the relevance scores for a given query,
        by using the BM25 scores that have been precomputed in the BM25 eager index.
        It is used by the `get_scores_from_ids` method, which makes use of the precomputed
        scores assigned as attributes of the BM25 object.

        Parameters
        ----------
        data (np.ndarray)
            Data array of the BM25 index.
        indptr (np.ndarray)
            Index pointer array of the BM25 index.
        indices (np.ndarray)
            Indices array of the BM25 index.
        num_docs (int)
            Number of documents in the BM25 index.
        query_tokens_ids (np.ndarray)
            Array of token IDs to score.
        dtype (np.d
```

### Core Architecture Module: `bm25s/cli.py`
```

import argparse
import sys

def main():
    parser = argparse.ArgumentParser(description="BM25S CLI")
    subparsers = parser.add_subparsers(dest="command", help="Available commands")

    # MCP Subcommand
    mcp_parser = subparsers.add_parser("mcp", help="MCP Server commands")
    mcp_subparsers = mcp_parser.add_subparsers(dest="mcp_command", help="MCP actions")

    # MCP Launch
    launch_parser = mcp_subparsers.add_parser("launch", help="Launch the MCP server")
    launch_parser.add_argument("-p", "--port", type=int, default=8000, help="Port to run the server on")
    launch_parser.add_argument("-d", "--index-dir", required=True, help="Path to the BM25S index directory")

    # Index Subcommand
    index_parser = subparsers.add_parser(
        "index",
        help="Index documents from a file (CSV, TXT, JSON, or JSONL)",
    )
    index_parser.add_argument(
        "file",
        type=str,
        help="Path to the input file (CSV, TXT, JSON, or JSONL)",
    )
    index_parser.add_argument(
        "-o", "--output",
        type=str,
        default=None,
        help="Output directory/name for the index (default: <filename>_index)",
    )
    index_parser.add_argument(
        "-c", "--column",
        type=str,
        default=None,
        help="Column name for document text (for CSV/JSON/JSONL files)",
    )
    index_parser.add_argument(
        "-u", "--user",
        action="store_true",
        default=False,
        help="Save index to user directory (~/.bm25s/indices/)",
    )

    # Search Subcommand
    search_parser = subparsers.add_parser(
        "search",
        help="Search an index with a query",
    )
    search_parser.add_argument(
        "-i", "--index",
        type=str,
        default=None,
        help="Path to the index directory (or index name if using -u)",
    )
    search_parser.add_argument(
        "query",
        type=str,
        help="Search query",
    )
    search_parser.add_argument(
        "-k", "--top-k",
        type=int,
        default=10,
        help="Number of results to return (default: 10)",
    )
    search_parser.add_argument(
        "-s", "--save",
        type=str,
        default=None,
        help="Save results to a JSON file at the specified path",
    )
    search_parser.add_argument(
        "-u", "--user",
        action="store_true",
        default=False,
        help="Use index from user directory (~/.bm25s/indices/). Shows picker if -i not specified.",
    )

    args = parser.parse_args()

    if args.command == "mcp":
        if args.mcp_command == "launch":
            try:
                from .mcp.server import main as mcp_main
                mcp_main(index_dir=args.index_dir, port=args.port)
            except ImportError:
                sys.exit(1)
            except Exception as e:
                print(f"Error launching MCP server: {e}", file=sys.stderr)
                sys.exit(1)
        else:
            mcp_parser.print_help()
    elif args.command == "index":
        from .terminal import index_command
        index_command(args)
    elif args.command == "search":
        from .terminal import search_command
        search_command(args)
    else:
        parser.print_help()

if __name__ == "__main__":
    main()

```

### Core Architecture Module: `bm25s/hf.py`
```
import json
import logging
import os
import shutil
import tempfile
from typing import Iterable, Union
from . import BM25, __version__
from .tokenization import Tokenizer

try:
    from huggingface_hub import HfApi
except ImportError:
    raise ImportError(
        "Please install the huggingface_hub package to use the HuggingFace integrations for bm25s. You can install it via `pip install huggingface_hub`."
    )

def _faketqdm(*args, **kwargs):
    return args[0] if len(args) > 0 else None
try:
    if os.environ.get("DISABLE_TQDM", False):
        tqdm = _faketqdm
    else:
        from tqdm.auto import tqdm
except ImportError:
    tqdm = _faketqdm

README_TEMPLATE = """---
language: en
library_name: bm25s
tags:
- bm25
- bm25s
- retrieval
- search
- lexical
---

# BM25S Index

This is a BM25S index created with the [`bm25s` library](https://github.com/xhluca/bm25s) (version `{version}`), an ultra-fast implementation of BM25. It can be used for lexical retrieval tasks.

BM25S Related Links:

* 🏠[Homepage](https://bm25s.github.io)
* 💻[GitHub Repository](https://github.com/xhluca/bm25s)
* 🤗[Blog Post](https://huggingface.co/blog/xhluca/bm25s)
* 📝[Technical Report](https://arxiv.org/abs/2407.03618)


## Installation

You can install the `bm25s` library with `pip`:

```bash
pip install "bm25s=={version}"

# Include extra dependencies like stemmer
pip install "bm25s[full]=={version}"

# For huggingface hub usage
pip install huggingface_hub
```

## Loading a `bm25s` index

You can use this index for information retrieval tasks. Here is an example:

```python
import bm25s
from bm25s.hf import BM25HF

# Load the index
retriever = BM25HF.load_from_hub("{username}/{repo_name}")

# You can retrieve now
query = "a cat is a feline"
results = retriever.retrieve(bm25s.tokenize(query), k=3)
```

## Saving a `bm25s` index

You can save a `bm25s` index to the Hugging Face Hub. Here is an example:

```python
import bm25s
from bm25s.hf import BM25HF

corpus = [
    "a cat is a feline and likes to purr",
    "a dog is the human's best friend and loves to play",
    "a bird is a beautiful animal that can fly",
    "a fish is a creature that lives in water and swims",
]

retriever = BM25HF(corpus=corpus)
retriever.index(bm25s.tokenize(corpus))

token = None  # You can get a token from the Hugging Face website
retriever.save_to_hub("{username}/{repo_name}", token=token)
```

## Advanced usage

You can leverage more advanced features of the BM25S library during `load_from_hub`:

```python
# Load corpus and index in memory-map (mmap=True) to reduce memory
retriever = BM25HF.load_from_hub("{username}/{repo_name}", load_corpus=True, mmap=True)

# Load a different branch/revision
retriever = BM25HF.load_from_hub("{username}/{repo_name}", revision="main")

# Change directory where the local files should be downloaded
retriever = BM25HF.load_from_hub("{username}/{repo_name}", local_dir="/path/to/dir")

# Load private repositories with a token:
retriever = BM25HF.load_from_hub("{username}/{repo_name}", token=token)
```

## Tokenizer

If you have saved a `Tokenizer` object with the index using the following approach:

```python
from bm25s.hf import TokenizerHF

token = "your_hugging_face_token"
tokenizer = TokenizerHF(corpus=corpus, stopwords="english")
tokenizer.save_to_hub("{username}/{repo_name}", token=token)

# and stopwords too
tokenizer.save_stopwords_to_hub("{username}/{repo_name}", token=token)
```

Then, you can load the tokenizer using the following code:

```python
from bm25s.hf import TokenizerHF

tokenizer = TokenizerHF(corpus=corpus, stopwords=[])
tokenizer.load_vocab_from_hub("{username}/{repo_name}", token=token)
tokenizer.load_stopwords_from_hub("{username}/{repo_name}", token=token)
```


## Stats

This dataset was created using the following data:

| Statistic | Value |
| --- | --- |
| Number of documents | {num_docs} |
| Number of tokens | {num_tokens} |
| Average tokens per document | {avg_tokens_per_doc} |

## Parameters

The index was created with the following parameters:

| Parameter | Value |
| --- | --- |
| k1 | `{k1}` |
| b | `{b}` |
| delta | `{delta}` |
| method | `{method}` |
| idf method | `{idf_method}` |

## Citation

To cite `bm25s`, please use the following bibtex:

```
@misc{{lu_2024_bm25s,
      title={{BM25S: Orders of magnitude faster lexical search via eager sparse scoring}}, 
      author={{Xing Han Lù}},
      year={{2024}},
      eprint={{2407.03618}},
      archivePrefix={{arXiv}},
      primaryClass={{cs.IR}},
      url={{https://arxiv.org/abs/2407.03618}}, 
}}
```

"""


def batch_tokenize(tokenizer, texts, add_special_tokens=False, show_progress=True, leave_progress=False):
    tokenizer_kwargs = dict(
        return_attention_mask=False,
        return_token_type_ids=False,
        add_special_tokens=add_special_tokens,
        max_length=None,
    )
    tokenized = tokenizer(texts, **tokenizer_kwargs)
    output = []

    for i in tqdm(
        range(len(texts)), desc="Processing tokens (huggingface tokenizer)", leave=leave_progress, disable=not show_progress
    ):
        output.append(tokenized[i].tokens)

    return output


def is_dir_empty(local_save_dir):
    """
    Check if a directory is empty or not.

    Parameters
    ----------
    local_save_dir: str
        The directory to check.

    Returns
    -------
    bool
        True if the directory is empty, False otherwise.
    """
    if not os.path.exists(local_save_dir):
        return True
    return len(os.listdir(local_save_dir)) == 0


def can_save_locally(local_save_dir, overwrite_local: bool) -> bool:
    """
    Check if it is possible to save the model to a local directory.

    Parameters
    ----------
    local_save_dir: str
        The directory to save the model to.

    overwrite_local: bool
        Whether to overwrite the existing local directory if it exists.

    Returns
    -------
    bool
        True if it is possible to save the model to the local directory, False otherwise.
    """
    # if local_save_dir is None, we cannot save locally
    if local_save_dir is None:
        return False

    # if the directory is empty, we can save locally
    if is_dir_empty(local_save_dir):
        return True

    # if we are allowed to overwrite the directory, we can save locally
    if overwrite_local:
        return True


class TokenizerHF(Tokenizer):
    def save_vocab_to_hub(
        self,
        repo_id: str,
        token: str = None,
        local_dir: str = None,
        commit_message: str = "Update tokenizer",
        overwrite_local: bool = False,
        private=True,
        **kwargs,
    ):
        """
        This function saves the tokenizer's vocab to the Hugging Face Hub.

        Parameters
        ----------
        repo_id: str
            The unique identifier of the repository to save the model to.
            The `repo_id` should be in the form of "username/repo_name".
        
        token: str
            The Hugging Face API token to use.
        
        local_dir: str
            The directory to save the model to before pushing to the Hub.
            If it is not empty and `overwrite_local` is False, it will fall
            back to saving to a temporary directory.
        
        commit_message: str
            The commit message to use when saving the model.
        
        overwrite_local: bool
            Whether to overwrite the existing local directory if it exists.
        
        kwargs: dict
            Additional keyword arguments to pass to `HfApi.upload_folder` call.
        """
        api = HfApi(token=token)
        repo_url = api.create_repo(
            repo_id=repo_id,
            token=api.token,
            private=private,
            repo_type="model",
            exist_ok=True,
        )
        repo_id = repo_url.repo_id

        saving_locally = can_save_locally(local_dir, overwrite_local)
        if saving_locally:
            os.makedirs(local_dir, exist_ok=True)
            save_dir = local_dir
        else:
            # save to a temporary directory otherwise
            save_dir = tempfile.mkdtemp()

        self.save_vocab(save_dir)
        # push content of the temporary directory to the repo
        api.upload_folder(
            repo_id=repo_id,
            commit_message=commit_message,
            token=api.token,
            folder_path=save_dir,
            repo_type=repo_url.repo_type,
            **kwargs,
        )
        # delete the temporary directory if it was created
        if not saving_locally:
            shutil.rmtree(save_dir)

        return repo_url
    
    def load_vocab_from_hub(
        cls,
        repo_id: str,
        revision=None,
        token=None,
        local_dir=None,
    ):
        """
        This function loads the tokenizer's vocab from the Hugging Face Hub.

        Parameters
        ----------
        repo_id: str
            The unique identifier of the repository to load the model from.
            The `repo_id` should be in the form of "username/repo_name".
        
        revision: str
            The revision of the model to load.
        
        token: str
            The Hugging Face API token to use.
        
        local_dir: str
            The local dir where the model will be stored after downloading.
        
        allow_pickle: bool
            Whether to allow pickling the model. Default is False.
        """
        api = HfApi(token=token)
        # check if the model exists
        repo_url = api.repo_info(repo_id)
        if repo_url is None:
            raise ValueError(f"Model {repo_id} not found on the Hugging Face Hub.")

        snapshot = api.snapshot_download(
            repo_id=repo_id, revision=revision, token=token, local_dir=local_dir
        )
        if snapshot is None:
            raise ValueError(f"Model {repo_id} not found on the Hugging Face Hub.")

        return cls.load_vocab(save_dir=snapshot)

    def save_stopwords_to_hub(
        self,
        repo_
```

### Core Architecture Module: `bm25s/high_level/__init__.py`
```
"""
The high level BM25 search API. It wraps bm25s into a simple to use search interface,
enabling 1-line indexing and 1-line searching. By default, it will require:
- numba compilation for speed up
- stemming for better search quality
- stopword removal for better search quality
"""

import json
import csv
from pathlib import Path
from bm25s import BM25
from bm25s.tokenization import Tokenizer
import Stemmer
from typing import List



class BM25Search:
    def __init__(
        self,
        corpus: List[str],
        language: str = "english",
        bm25_kwargs: dict = None,
        tokenizer_kwargs: dict = None,
        tokenizer_cls: Tokenizer = Tokenizer,
    ):
        if bm25_kwargs is not None and "corpus" in bm25_kwargs:
            raise ValueError(
                "The 'corpus' argument in bm25_kwargs is reserved and cannot be set manually."
            )
        if language != "english":
            raise NotImplementedError("Currently only English language is supported.")
        
        self.leave_progress = leave_progress = False
        self.show_progress = show_progress = True
        self.corpus = corpus

        stemmer = Stemmer.Stemmer("english")
        bm25_kwargs_default = dict(
            backend="numba", csc_backend="numpy", auto_compile=False
        )
        tokenizer_kwargs_default = dict(
            stemmer=stemmer, stopwords="english", lower=True
        )

        if isinstance(bm25_kwargs, dict):
            bm25_kwargs_default.update(bm25_kwargs)
        elif bm25_kwargs is not None:
            raise ValueError("bm25_kwargs must be a dict or None.")

        if isinstance(tokenizer_kwargs, dict):
            tokenizer_kwargs_default.update(tokenizer_kwargs)
        elif tokenizer_kwargs is not None:
            raise ValueError("tokenizer_kwargs must be a dict or None.")

        if "corpus" in bm25_kwargs_default:
            raise ValueError(
                "The 'corpus' argument in bm25_kwargs is reserved and cannot be set manually."
            )

        # note: we do not pass corpus here, as we will keep it separately. This means the BM25
        # object will return document ids instead of texts when retrieving.
        self.retriever = BM25(**bm25_kwargs_default)
        self.tokenizer: Tokenizer = tokenizer_cls(**tokenizer_kwargs_default)

        # tokenize the corpus
        tokenized = self.tokenizer.tokenize(
            corpus,
            leave_progress=leave_progress,
            show_progress=show_progress,
            update_vocab=True,
            return_as="tuple",
        )

        # compile and index (warmup=False to avoid segfaults in some CI environments)
        self.retriever.compile(activate_numba=True, warmup=False)
        
        create_empty_token = True
        # If the corpus is empty or has no tokens, we can't create an empty token
        # as it relies on vocab dict having some content or logic that fails if empty
        if len(tokenized.vocab) == 0:
            create_empty_token = False
            
        self.retriever.index(
            tokenized,
            leave_progress=leave_progress,
            show_progress=show_progress,
            create_empty_token=create_empty_token,
        )

    def search(self, queries: List[str], k: int = 10, n_jobs: int = 1):
        # Ensure k is not larger than the corpus size
        num_docs = len(self.corpus)
        if k > num_docs:
            k = num_docs

        tokenized_queries = self.tokenizer.tokenize(
            queries,
            update_vocab=False,
            show_progress=self.show_progress,
            leave_progress=self.leave_progress,
            return_as="tuple",
            allow_empty=False,
        )
        
        # Handle empty queries explicitly to avoid issues with Numba backend
        # We filter out queries that result in no tokens
        non_empty_indices = []
        empty_indices = []
        
        # We access internal ids list from Tokenized namedtuple
        # Convert to string list first as retrieve expects that or Tokenized object
        # But checking emptiness is easier on ids
        
        for i, q_ids in enumerate(tokenized_queries.ids):
            if len(q_ids) > 0:
                non_empty_indices.append(i)
            else:
                empty_indices.append(i)
        
        # Prepare results structure
        results = [None] * len(queries)
        
        # Process empty queries immediately
        for i in empty_indices:
            # Empty query results in empty list of documents
            # Or do we want to return empty docs with 0 score? 
            # Standard BM25 usually returns nothing for empty query, or 0 score for all docs.
            # Let's return empty list as top-k results.
            results[i] = []

        if len(non_empty_indices) > 0:
            # Create a new Tokenized object for non-empty queries
            non_empty_ids = [tokenized_queries.ids[i] for i in non_empty_indices]
            non_empty_tokenized = self.tokenizer.to_tokenized_tuple(non_empty_ids)
            
            # Retrieve for non-empty queries
            # note: because we did not pass `corpus` when initializing BM25,
            # the retrieve() will return document ids instead of texts.
            doc_ids, scores = self.retriever.retrieve(
                query_tokens=non_empty_tokenized,
                k=k,
                sorted=True,
                return_as="tuple",
                show_progress=self.show_progress,
                leave_progress=self.leave_progress,
                n_threads=n_jobs,
                chunksize=50,
                backend_selection="auto",
            )
            
            # Map back to original indices
            num_docs = doc_ids.shape[1]
            
            for idx, original_idx in enumerate(non_empty_indices):
                query_results = []
                for di in range(num_docs):
                    doc_id = doc_ids[idx, di]
                    doc_text = self.corpus[doc_id]
                    query_results.append(
                        {
                            "id": int(doc_id),
                            "score": float(scores[idx, di]),
                            "document": doc_text,
                        }
                    )
                results[original_idx] = query_results

        return results


def index(documents, language: str = "english"):
    return BM25Search(corpus=documents, language=language)


def load(path, document_column=None):
    """
    Loads a csv, json, jsonl, or txt file from the given path. For json, we expect a list of dicts.
    Returns a list of strings (corpus) that can be passed to `bm25s.index`.

    Parameters
    ----------
    path : str
        The file path to load the documents from.

    document_column : str, optional
        The column name to use as the document text when loading from csv, or the key when loading from json/jsonl.
        If None, the first column will be used by default.
    
    Returns
    -------
    List[str]
        A list of strings representing the documents.
    """

    path = Path(path)
    documents = []

    if path.suffix == ".txt":
        with open(path, "r", encoding="utf-8") as f:
            documents = [line.strip() for line in f if line.strip()]

    elif path.suffix == ".json":
        with open(path, "r", encoding="utf-8") as f:
            data = json.load(f)
            if isinstance(data, list):
                if len(data) > 0 and isinstance(data[0], str):
                    documents = data
                elif len(data) > 0 and isinstance(data[0], dict):
                    if document_column is None:
                        # Use the first key available in the first element
                        document_column = list(data[0].keys())[0]
                    documents = [d[document_column] for d in data]
            else:
                raise ValueError("JSON file must contain a list of strings or dicts.")

    elif path.suffix == ".jsonl":
        with open(path, "r", encoding="utf-8") as f:
            for line in f:
                if not line.strip():
                    continue
                d = json.loads(line)
                if document_column is None and not documents:
                    # Infer column from first line
                    document_column = list(d.keys())[0]
                
                if document_column in d:
                    documents.append(d[document_column])
                else:
                    # skip or error? Let's skip if key missing, or error. 
                    # raising error is safer for "load"
                    raise ValueError(f"Key '{document_column}' not found in JSONL line: {line[:50]}...")

    elif path.suffix == ".csv":
        with open(path, "r", newline="", encoding="utf-8") as f:
            reader = csv.DictReader(f)
            if document_column is None:
                if reader.fieldnames:
                    document_column = reader.fieldnames[0]
                else:
                    return BM25Search(corpus=[])

            for row in reader:
                if document_column in row:
                    documents.append(row[document_column])
                else:
                     raise ValueError(f"Column '{document_column}' not found in CSV.")
    else:
        raise ValueError(f"Unsupported file extension: {path.suffix}")

    return documents

```

### Core Architecture Module: `bm25s/high_level/setup.py`
```
from setuptools import setup
import os
import re
import subprocess
from pathlib import Path

# Change to the current directory to avoid issues if run from elsewhere
current_dir = os.path.dirname(os.path.abspath(__file__))
os.chdir(current_dir)

package_name = "BM25"
base_dir = Path(current_dir)


def _normalize_version(value):
    version = value.strip()
    if version.startswith("refs/tags/"):
        version = version.rsplit("/", 1)[-1]
    if version.startswith("v"):
        version = version[1:]
    return version


def _version_from_environment():
    for key in ("BM25S_VERSION", "RELEASE_TAG"):
        value = os.environ.get(key)
        if value:
            return _normalize_version(value)

    if os.environ.get("GITHUB_REF_TYPE") == "tag":
        value = os.environ.get("GITHUB_REF_NAME")
        if value:
            return _normalize_version(value)

    github_ref = os.environ.get("GITHUB_REF", "")
    if github_ref.startswith("refs/tags/"):
        return _normalize_version(github_ref)

    return None


def _version_from_pkg_info(package_dir):
    pkg_info = package_dir / "PKG-INFO"
    if not pkg_info.exists():
        return None

    for line in pkg_info.read_text(encoding="utf8").splitlines():
        if line.startswith("Version:"):
            return _normalize_version(line.partition(":")[2])

    return None


def _git_describe(package_dir, *args):
    try:
        return subprocess.check_output(
            [
                "git",
                "describe",
                "--tags",
                "--match",
                "[0-9]*",
                "--match",
                "v[0-9]*",
                *args,
            ],
            cwd=package_dir,
            stderr=subprocess.DEVNULL,
            text=True,
        ).strip()
    except (OSError, subprocess.CalledProcessError):
        return None


def _version_from_git(package_dir):
    exact_tag = _git_describe(package_dir, "--exact-match")
    if exact_tag:
        return _normalize_version(exact_tag)

    description = _git_describe(package_dir, "--long")
    if not description:
        return None

    match = re.match(r"(.+)-(\d+)-g([0-9a-f]+)$", description)
    if not match:
        return None

    tag, distance, sha = match.groups()
    version = _normalize_version(tag)
    if distance == "0":
        return version

    suffix = ".dev" if ".post" in version else ".post"
    return f"{version}{suffix}{distance}+g{sha}"


def _get_build_version(package_dir):
    return (
        _version_from_environment()
        or _version_from_pkg_info(package_dir)
        or _version_from_git(package_dir)
        or "0.0.0"
    )


package_version = _get_build_version(base_dir)

with open("README.md", encoding="utf8") as fp:
    long_description = fp.read()

setup(
    name=package_name,
    version=package_version,
    author="Xing Han Lù",
    author_email="bm25s@googlegroups.com",
    url="https://github.com/xhluca/bm25s/tree/main/bm25s/high_level",
    description="A simple high-level API and CLI for BM25.",
    long_description=long_description,
    long_description_content_type="text/markdown",
    packages=["BM25"],
    package_dir={"BM25": "."},
    install_requires=[
        f"bm25s[core,cli]=={package_version}",
    ],
    entry_points={
        "console_scripts": [
            "bm25=bm25s.cli:main",
        ],
    },
    classifiers=[
        "Programming Language :: Python :: 3",
        "License :: OSI Approved :: MIT License",
        "Operating System :: OS Independent",
    ],
    python_requires=">=3.8",
)

```

### Core Architecture Module: `bm25s/mcp/__init__.py`
```
try:
    import mcp
except ImportError:
    raise ImportError("MCP is not installed, which is required for the MCP server in BM25S. Please install it with 'pip install bm25s[mcp]' or `pip install mcp`.")

from . import server

__all__ = ["server"]
```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #209** (2026-10-02): **test: reject truncated corpora with stale line indexes**
  *Symptoms*: A populated JSONL corpus that is truncated to zero bytes must be rejected when its saved or in-memory line index still describes documents. These tests preserve current main's immediate `ValueError`; #206 currently accepts that inconsistent state, reports the old document count, and fails later on reads.  Add one new test file covering construction with a saved index, reopening with an in-memory index, and `BM25.load(mmap=True, load_corpus=True)`. The existing core-test workflow discovers it automatically. No production code or existing tests are changed.  Validation: - Three new tests pass on current main and all three fail against the unchanged #206 implementation. - All three pass against a temporary candidate that rejects zero-byte files with a nonempty line index. - Full core suite: 155 tests successful, including 2 skips.  Related: #206. 
  **Post-Mortem & Fix Analysis**:
  > <!-- bm25s-contributor-eligibility --> 🟢 **Contributor eligibility requirements met** for @xhluca.  - 🟢 Account created: 2016-08-22; age: 3693 days (required: at least six calendar months). - 🟢 Contributions dated on or before 2026-09-02: 3934 or more (required: at least 100).  > Pull request authors must have a GitHub account at least six calendar months old and at least 100 GitHub contributions dated on or before the date one calendar month before the check.  See [the contributor eligibility policy](https://github.com/xhluca/bm25s/blob/HEAD/CONTRIBUTING.md#contributor-eligibility).

- **Issue #207** (2026-10-01): **Automatically enforce contributor account eligibility**
  *Symptoms*: Automatically reply to every new, reopened, or updated PR with the author's account age and qualifying contribution count. Close PRs whose authors have accounts younger than six calendar months or fewer than 100 contributions dated on or before the date one calendar month before the check, quoting and linking the policy in the new CONTRIBUTING.md.  The workflow uses pull_request_target so fork submissions do not require test-run approval. It only executes trusted default-branch code, uses contents:read and pull-requests:write, and updates an existing bot comment on reruns. Contribution history is counted in non-overlapping annual windows; API failures leave PRs open. Manual dispatch checks all open PRs.  Validation: nine focused unit tests passed, workflow YAML/security assertions passed, git diff --check passed, and live read-only API checks confirmed the qualifying history of current authors. 

- **Issue #205** (2026-09-27): **fix: JsonlCorpus supports empty (zero-byte) jsonl files**
  *Symptoms*: ## Problem  `JsonlCorpus` (mmap-backed random-access `.jsonl` reader, used directly by `retrieve(corpus_file=...)`) crashes when the file is empty:  \`\`\`python from bm25s.utils.corpus import JsonlCorpus open(\"empty.jsonl\", \"w\").close() JsonlCorpus(\"empty.jsonl\") # ValueError: cannot mmap an empty file \`\`\`  `mmap.mmap(fd, 0)` cannot map a zero-length file. An empty `.jsonl` is a legitimate empty corpus (and is the same no-content edge case the indexing path handles), so it should construct with `len() == 0` rather than raise.  ## Fix  - **`load()`** — only create the mmap view when `os.fstat(...).st_size > 0`; otherwise leave `mmmap_obj = None`. The file handle is still opened/closed/reopened normally. - **`get_line()`** — return `""` instead of dereferencing a `None` mmap view. - **`__getitem__`** — integer indexing an empty corpus raises `IndexError`, mirroring a built-in empty list (`[][0]`); slice/list/ndarray indexing already short-circuit to empty results.  Non-empty behaviour is byte-for-byte unchanged.  ## Tests  Added `TestJsonlCorpusEmptyFile` with 4 cases (construct with len 0, int index → IndexError, slice → [], close/reopen). They **fail on current main** with `ValueError: cannot mmap an empty file` and pass with the fix; reverse-verified by reverting only the source change.  Full core suite: **152 passed, 2 skipped** (the 2 skips are pre-existing, optional `huggingface_hub` tests).  This is a small, self-contained follow-up to #202 (empty corpus indexi
  **Post-Mortem & Fix Analysis**:
  > Replaced with #206 which is based directly on main (this branch accidentally carried the #202 commit).

- **Issue #204** (2026-10-01): **Fix concurrent JsonlCorpus reads using explicit mmap offsets**
  *Symptoms*: Concurrent reads from one JsonlCorpus can return another document or fail JSON decoding because get_line shares the mmap seek/readline cursor. Read each line using an explicit offset and newline boundary instead, leaving the shared cursor untouched.  Fixes #203.  ### Validation - A deterministic regression uses two threads and a real mmap wrapper to interleave the original seek/readline operations. It fails on main (requested documents 0/1, received 2/1) and passes with this fix. - `python -m unittest -v test_corpus test_corpus_concurrency`: all 20 tests passed on Windows, including shared-corpus reads, negative indices, reopening, LF/CRLF, UTF-8, and the final line with or without a newline. - Additional 8-thread stress check: 10,000 reads, zero incorrect/failed results after the fix. The original implementation produced 136 incorrect/failed reads in the same stress setup; that count is timing-dependent. - Black check passed for the new test file; git diff --check passed. Full core/Numba/BEIR suites were not run locally.  This supports concurrent reads of an open, unchanged corpus; concurrent closing, reloading, or file mutation is outside the scope. The patch is based on current main (e21ca718), including #198, and is independent of the index-path fix in #200.  AI assistance was used to investigate the issue, implement the patch, and run the validation above.
  **Post-Mortem & Fix Analysis**:
  > <!-- bm25s-contributor-eligibility --> 🔴 **Contributor eligibility requirements not met** for @LimbC-C.  - 🔴 Account created: 2026-09-15; age: 16 days (required: at least six calendar months). - 🔴 Contributions dated on or before 2026-09-01: 0 (required: at least 100).  > Pull request authors must have a GitHub account at least six calendar months old and at least 100 GitHub contributions dated on or before the date one calendar month before the check.  See [the contributor eligibility policy](https://github.com/xhluca/bm25s/blob/HEAD/CONTRIBUTING.md#contributor-eligibility).  Closing this PR because these requirements were not met. This policy is intended to reduce spam from AI agents; it is not an assessment of the quality of your change.

- **Issue #200** (2026-10-01): **Fix index paths for extensionless JSONL corpora**
  *Symptoms*: ## Problem and change  Fixes #199.  `JsonlCorpus` derives its sidecar index path by splitting the entire source path at the last dot. Extensionless filenames lose their basename, and a dotted parent directory can cause different corpora to share one index. The second corpus then uses the first corpus's length and byte offsets.  Use `os.path.splitext()` so only the filename suffix is replaced. Extend the existing path test and add a regression that creates and reopens two extensionless corpora under a dotted directory. Normal `.jsonl` sidecar names stay the same; affected extensionless inputs create their correctly named sidecar on the next load.  ## Validation  - Before: three path subcases and the independent-corpus regression fail (four failures across two test methods). - After: `python -m unittest tests.core.test_corpus tests.core.test_save_load` passes all 24 tests. - An expanded run including `tests.core.test_utils_corpus` has 24 passes and two Windows CRLF/LF assertion failures. Both failures were also reproduced with the original implementation; this PR leaves that separate behavior unchanged. - `git diff --check` passes.  Tested on Windows, Python 3.12.14, NumPy 2.5.3 and SciPy 1.18.1. Full core, Numba and comparison suites were not run locally.  Prepared, inspected and tested with Codex at the account owner's request. No human review is claimed. 

- **Issue #199** (2026-10-01): **Extensionless JsonlCorpus files can share the wrong byte-offset index**
  *Symptoms*: ### Problem  `JsonlCorpus` can reuse the wrong byte-offset index for an extensionless JSONL file. `change_extension()` splits the entire path at its last dot, so:  - `corpus` becomes `.mmindex.json`, losing the filename. - `data.v1/first` and `data.v1/second` both become `data.mmindex.json`, losing the directory and filename.  Loading a second corpus can therefore report the first corpus's length and use its offsets to read unrelated records.  ### Reproduction  ```python import json from pathlib import Path from tempfile import TemporaryDirectory from bm25s.utils.corpus import JsonlCorpus  with TemporaryDirectory() as root:     folder = Path(root) / "data.v1"     folder.mkdir()     for name, records in [         ("first", [{"text": "one"}, {"text": "two"}]),         ("second", [{"text": "another document"}]),     ]:         path = folder / name         path.write_text("".join(json.dumps(r) + "\n" for r in records), encoding="utf-8")         corpus = JsonlCorpus(path, show_progress=False, verbosity=0)         try:             print(name, len(corpus))         finally:             corpus.close() ```  Actual: `first 2`, `second 2`. Expected: `first 2`, `second 1`, with distinct sidecar indexes next to each source.  Using `os.path.splitext()` preserves the directory and filename, including leading-dot filenames, while retaining the existing behavior for `.jsonl` inputs.  Reproduced on upstream `a213158181d4b3781ba06bc88840f89871f1c775`, Windows / Python 3.12.14. Regression tests c

- **Issue #198** (2026-09-18): **Add support for GIL-free concurrency**
  *Symptoms*: Numba support GIL-free concurrency by adding a nogil=True flag. However the existing parallel setup is not thread-safe, as it changes a global num-of-threads flag. To avoid this issue, a separate serial variant of retrieve is used when n_threads is 1.  Related: #195 Closes: #194

- **Issue #197** (2026-09-12): **bm25s logger ignoring application global configuration?**
  *Symptoms*: ~Hi, I am working on a project using this library and it appears that the logging configuration of bm25s is hijacking my global configurations for `logging`? If this has previously observed please suggest an action to disable bm25s logger, or even better, to fall under the rule the global configs?~  It appeared to be a misdiagnostic. Sorry for it.

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

### Incident Patch 1: `3e4a0b44` (2026-10-01)
**Commit Message**: Merge pull request #200 from LimbC-C/fix/corpus-index-paths

Fix index paths for extensionless JSONL corpora

**File**: `bm25s/utils/corpus.py` (modified, +2/-1)
```diff
@@ -23,8 +23,9 @@ def _faketqdm(*args, **kwargs):
 from . import json_functions
 
 def change_extension(path, new_extension):
+    """Replace the final filename extension, or append one if it has none."""
     path = str(path)
-    return path.rpartition(".")[0] + new_extension
+    return os.path.splitext(path)[0] + new_extension
 
 
 def find_newline_positions(path, show_progress=True, leave_progress=True, encoding="utf-8"):
```

**File**: `tests/core/test_corpus.py` (modified, +33/-4)
```diff
@@ -43,10 +43,15 @@ def test_change_extension(self):
         result = change_extension(path, ".json")
         self.assertEqual(result, "/path/to/file.json")
         
-        # Test with no extension - rpartition returns ('', '', 'file'), so the original string is in the third element.
-        # If change_extension uses the first element, the result will be just the new extension.
-        path = "file"
-        result = change_extension(path, ".json")
+        for path, expected in [
+            ("file", "file.json"),
+            (".corpus", ".corpus.json"),
+            (os.path.join("data.v1", "corpus"), os.path.join("data.v1", "corpus.json")),
+            (os.path.join("data.v1", "corpus.jsonl"), os.path.join("data.v1", "corpus.json")),
+            ("corpus.backup.jsonl", "corpus.backup.json"),
+        ]:
+            with self.subTest(path=path):
+                self.assertEqual(change_extension(path, ".json"), expected)
 
     def test_find_newline_positions(self):
         """Test find_newline_positions"""
@@ -135,6 +140,30 @@ def test_jsonl_corpus_init_loads_existing_index(self):
         self.assertEqual(len(corpus2), 5)
         corpus2.close()
 
+    def test_extensionless_corpora_have_independent_indexes(self):
+        directory = os.path.join(self.tmpdir, "data.v1")
+        os.makedirs(directory)
+        sources = [
+            (os.path.join(directory, "first"), [{"text": "one"}, {"text": "two"}]),
+            (os.path.join(directory, "second"), [{"text": "another document"}]),
+        ]
+        for path, documents in sources:
+            with open(path, "w", encoding="utf-8") as handle:
+                for document in documents:
+                    handle.write(json_functions.dumps(document) + "\n")
+
+        # Verify both newly created and persisted indexes without sharing offsets.
+        for _ in range(2):
+            for path, documents in sources:
+                corpus = JsonlCorpus(path, show_progress=False, verbosity=0)
+                try:
+                    self.assertEqual(len(corpus), len(documents))
+                    self.assertEqual(corpus[:], documents)
+                finally:
+                    corpus.close()
+        for path, _ in sources:
+            self.assertTrue(os.path.isfile(path + ".mmindex.json"))
+
     def test_jsonl_corpus_len(self):
         """Test JsonlCorpus __len__"""
         corpus = JsonlCorpus(self.test_file, show_progress=False)
```

---

### Incident Patch 2: `c37c81c7` (2026-05-13)
**Commit Message**: Merge pull request #187 from xhluca/copilot/fix-logger-warning-windows-import

fix: downgrade resource module ImportError log from warning to debug on Windows

**File**: `bm25s/utils/benchmark.py` (modified, +2/-1)
```diff
@@ -8,12 +8,13 @@
 try:
     import resource
 except ImportError:
-    logger.warning("resource module not available on Windows")
+    logger.debug("resource module not available on Windows")
     resource = None
 
 
 def get_max_memory_usage(format="GB"):
     if resource is None:
+        logger.warning("resource module not available, cannot get memory usage")
         return None
     if format not in ["GB", "MB", "KB"]:
         raise ValueError("format should be one of 'GB', 'MB', 'KB'")
```

**File**: `tests/core/test_benchmark_utils.py` (modified, +1/-1)
```diff
@@ -29,7 +29,7 @@ def _import_with_missing_resource(name, globals=None, locals=None, fromlist=(),
             self.assertIsNone(benchmark.resource)
             self.assertIsNone(benchmark.get_max_memory_usage())
             mock_logger.warning.assert_called_once_with(
-                "resource module not available on Windows"
+                "resource module not available, cannot get memory usage"
             )
         finally:
             importlib.reload(benchmark)
```

---

### Incident Patch 3: `62d6bbe0` (2026-05-08)
**Commit Message**: fix: update test to match new warning message in get_max_memory_usage

Agent-Logs-Url: https://github.com/xhluca/bm25s/sessions/31474705-fbd9-4eed-bbb9-f011558ccd5e

Co-authored-by: xhluca <[REDACTED_EMAIL]>

**File**: `tests/core/test_benchmark_utils.py` (modified, +1/-1)
```diff
@@ -29,7 +29,7 @@ def _import_with_missing_resource(name, globals=None, locals=None, fromlist=(),
             self.assertIsNone(benchmark.resource)
             self.assertIsNone(benchmark.get_max_memory_usage())
             mock_logger.warning.assert_called_once_with(
-                "resource module not available on Windows"
+                "resource module not available, cannot get memory usage"
             )
         finally:
             importlib.reload(benchmark)
```

---

### Incident Patch 4: `8b17975a` (2026-05-06)
**Commit Message**: fix: move resource warning to usage site in get_max_memory_usage

Agent-Logs-Url: https://github.com/xhluca/bm25s/sessions/9a8b5893-8b28-4c71-ba01-4d4126b15c35

Co-authored-by: xhluca <[REDACTED_EMAIL]>

**File**: `bm25s/utils/benchmark.py` (modified, +1/-0)
```diff
@@ -14,6 +14,7 @@
 
 def get_max_memory_usage(format="GB"):
     if resource is None:
+        logger.warning("resource module not available, cannot get memory usage")
         return None
     if format not in ["GB", "MB", "KB"]:
         raise ValueError("format should be one of 'GB', 'MB', 'KB'")
```

---

### Incident Patch 5: `eebf8b89` (2026-05-06)
**Commit Message**: fix: change logger.warning to logger.debug for missing resource module on Windows

Agent-Logs-Url: https://github.com/xhluca/bm25s/sessions/631cce8f-60bf-47e3-aca5-44d8192ab9d0

Co-authored-by: xhluca <[REDACTED_EMAIL]>

**File**: `bm25s/utils/benchmark.py` (modified, +1/-1)
```diff
@@ -8,7 +8,7 @@
 try:
     import resource
 except ImportError:
-    logger.warning("resource module not available on Windows")
+    logger.debug("resource module not available on Windows")
     resource = None
 
 
```

---

### Incident Patch 6: `d4d3f462` (2026-04-29)
**Commit Message**: Merge pull request #185 from xhluca/fix/issue-184-version-metadata

Resolve version metadata mismatch

**File**: `.github/scripts/python/update_version.py` (removed, +0/-34)
```diff
@@ -1,34 +0,0 @@
-"""
-This CLI script is used to update the version of the package. It is used by the
-CI/CD pipeline to update the version of the package when a new release is made.
-
-It uses argparse to parse the command line arguments, which are the new version
-and the path to the package's __init__.py file.
-"""
-
-import argparse
-from pathlib import Path
-
-def main():
-    parser = argparse.ArgumentParser(
-        description="Update the version of the package."
-    )
-    parser.add_argument(
-        "--version",
-        type=str,
-        help="The new version of the package.",
-        required=True,
-    )
-    parser.add_argument(
-        "--path",
-        type=Path,
-        help="The path to the package's version file.",
-    )
-    args = parser.parse_args()
-
-    with open(args.path, "w") as f:
-        f.write(f"__version__ = \"{args.version}\"")
-        
-
-if __name__ == "__main__":
-    main()
\ No newline at end of file
```

**File**: `.github/workflows/publish-python.yaml` (modified, +3/-6)
```diff
@@ -15,6 +15,9 @@ jobs:
     permissions:
       # IMPORTANT: this permission is mandatory for trusted publishing
       id-token: write
+
+    env:
+      BM25S_VERSION: ${{ github.event.release.tag_name }}
     
     environment:
       name: pypi
@@ -27,12 +30,6 @@ jobs:
       with:
         python-version: '3.10'
     
-    - name: Update version.py with release tag
-      env:
-        RELEASE_TAG: ${{ github.event.release.tag_name }}
-      run: |
-        python .github/scripts/python/update_version.py --version $RELEASE_TAG --path "bm25s/version.py"
-    
     - name: Install dependencies
       run: |
         python -m pip install --upgrade pip
```

**File**: `bm25s/high_level/setup.py` (modified, +101/-7)
```diff
@@ -1,22 +1,116 @@
 from setuptools import setup
 import os
-import sys
+import re
+import subprocess
+from pathlib import Path
 
 # Change to the current directory to avoid issues if run from elsewhere
 current_dir = os.path.dirname(os.path.abspath(__file__))
 os.chdir(current_dir)
 
 package_name = "BM25"
-version = {}
-with open(os.path.join("..", "version.py"), encoding="utf8") as fp:
-    exec(fp.read(), version)
+base_dir = Path(current_dir)
+
+
+def _normalize_version(value):
+    version = value.strip()
+    if version.startswith("refs/tags/"):
+        version = version.rsplit("/", 1)[-1]
+    if version.startswith("v"):
+        version = version[1:]
+    return version
+
+
+def _version_from_environment():
+    for key in ("BM25S_VERSION", "RELEASE_TAG"):
+        value = os.environ.get(key)
+        if value:
+            return _normalize_version(value)
+
+    if os.environ.get("GITHUB_REF_TYPE") == "tag":
+        value = os.environ.get("GITHUB_REF_NAME")
+        if value:
+            return _normalize_version(value)
+
+    github_ref = os.environ.get("GITHUB_REF", "")
+    if github_ref.startswith("refs/tags/"):
+        return _normalize_version(github_ref)
+
+    return None
+
+
+def _version_from_pkg_info(package_dir):
+    pkg_info = package_dir / "PKG-INFO"
+    if not pkg_info.exists():
+        return None
+
+    for line in pkg_info.read_text(encoding="utf8").splitlines():
+        if line.startswith("Version:"):
+            return _normalize_version(line.partition(":")[2])
+
+    return None
+
+
+def _git_describe(package_dir, *args):
+    try:
+        return subprocess.check_output(
+            [
+                "git",
+                "describe",
+                "--tags",
+                "--match",
+                "[0-9]*",
+                "--match",
+                "v[0-9]*",
+                *args,
+            ],
+            cwd=package_dir,
+            stderr=subprocess.DEVNULL,
+            text=True,
+        ).strip()
+    except (OSError, subprocess.CalledProcessError):
+        return None
+
+
+def _version_from_git(package_dir):
+    exact_tag = _git_describe(package_dir, "--exact-match")
+    if exact_tag:
+        return _normalize_version(exact_tag)
+
+    description = _git_describe(package_dir, "--long")
+    if not description:
+        return None
+
+    match = re.match(r"(.+)-(\d+)-g([0-9a-f]+)$", description)
+    if not match:
+        return None
+
+    tag, distance, sha = match.groups()
+    version = _normalize_version(tag)
+    if distance == "0":
+        return version
+
+    suffix = ".dev" if ".post" in version else ".post"
+    return f"{version}{suffix}{distance}+g{sha}"
+
+
+def _get_build_version(package_dir):
+    return (
+        _version_from_environment()
+        or _version_from_pkg_info(package_dir)
+        or _version_from_git(package_dir)
+        or "0.0.0"
+    )
+
+
+package_version = _get_build_version(base_dir)
 
 with open("README.md", encoding="utf8") as fp:
     long_description = fp.read()
 
 setup(
     name=package_name,
-    version=version["__version__"],
+    version=package_version,
     author="Xing Han Lù",
     author_email="bm25s@googlegroups.com",
     url="https://github.com/xhluca/bm25s/tree/main/bm25s/high_level",
@@ -26,7 +120,7 @@
     packages=["BM25"],
     package_dir={"BM25": "."},
     install_requires=[
-        f"bm25s[core,cli]=={version['__version__']}",
+        f"bm25s[core,cli]=={package_version}",
     ],
     entry_points={
         "console_scripts": [
@@ -39,4 +133,4 @@
         "Operating System :: OS Independent",
     ],
     python_requires=">=3.8",
-)
\ No newline at end of file
+)
```

**File**: `bm25s/version.py` (modified, +14/-1)
```diff
@@ -1 +1,14 @@
-__version__ = "0.0.1dev0"
+from importlib.metadata import PackageNotFoundError, version
+
+_DISTRIBUTION_NAME = "bm25s"
+_FALLBACK_VERSION = "0.0.0"
+
+
+def _discover_version() -> str:
+    try:
+        return version(_DISTRIBUTION_NAME)
+    except PackageNotFoundError:
+        return _FALLBACK_VERSION
+
+
+__version__ = _discover_version()
```

**File**: `setup.py` (modified, +103/-6)
```diff
@@ -1,11 +1,108 @@
+import os
+import re
+import subprocess
+from pathlib import Path
+
 from setuptools import setup, find_packages
 
 package_name = "bm25s"
-version = {}
-with open(f"{package_name}/version.py", encoding="utf8") as fp:
-    exec(fp.read(), version)
+base_dir = Path(__file__).resolve().parent
+
+
+def _normalize_version(value):
+    version = value.strip()
+    if version.startswith("refs/tags/"):
+        version = version.rsplit("/", 1)[-1]
+    if version.startswith("v"):
+        version = version[1:]
+    return version
+
+
+def _version_from_environment():
+    for key in ("BM25S_VERSION", "RELEASE_TAG"):
+        value = os.environ.get(key)
+        if value:
+            return _normalize_version(value)
+
+    if os.environ.get("GITHUB_REF_TYPE") == "tag":
+        value = os.environ.get("GITHUB_REF_NAME")
+        if value:
+            return _normalize_version(value)
+
+    github_ref = os.environ.get("GITHUB_REF", "")
+    if github_ref.startswith("refs/tags/"):
+        return _normalize_version(github_ref)
+
+    return None
+
+
+def _version_from_pkg_info(package_dir):
+    pkg_info = package_dir / "PKG-INFO"
+    if not pkg_info.exists():
+        return None
+
+    for line in pkg_info.read_text(encoding="utf8").splitlines():
+        if line.startswith("Version:"):
+            return _normalize_version(line.partition(":")[2])
+
+    return None
+
+
+def _git_describe(package_dir, *args):
+    try:
+        return subprocess.check_output(
+            [
+                "git",
+                "describe",
+                "--tags",
+                "--match",
+                "[0-9]*",
+                "--match",
+                "v[0-9]*",
+                *args,
+            ],
+            cwd=package_dir,
+            stderr=subprocess.DEVNULL,
+            text=True,
+        ).strip()
+    except (OSError, subprocess.CalledProcessError):
+        return None
+
+
+def _version_from_git(package_dir):
+    exact_tag = _git_describe(package_dir, "--exact-match")
+    if exact_tag:
+        return _normalize_version(exact_tag)
+
+    description = _git_describe(package_dir, "--long")
+    if not description:
+        return None
+
+    match = re.match(r"(.+)-(\d+)-g([0-9a-f]+)$", description)
+    if not match:
+        return None
+
+    tag, distance, sha = match.groups()
+    version = _normalize_version(tag)
+    if distance == "0":
+        return version
+
+    suffix = ".dev" if ".post" in version else ".post"
+    return f"{version}{suffix}{distance}+g{sha}"
+
+
+def _get_build_version(package_dir):
+    return (
+        _version_from_environment()
+        or _version_from_pkg_info(package_dir)
+        or _version_from_git(package_dir)
+        or "0.0.0"
+    )
+
+
+package_version = _get_build_version(base_dir)
 
-with open("README.md", encoding="utf8") as fp:
+with open(base_dir / "README.md", encoding="utf8") as fp:
     long_description = fp.read()
 
 extras_require = {
@@ -24,7 +121,7 @@
 
 setup(
     name=package_name,
-    version=version["__version__"],
+    version=package_version,
     author="Xing Han Lù",
     author_email=f"{package_name}@googlegroups.com",
     url=f"https://github.com/xhluca/{package_name}",
@@ -47,4 +144,4 @@
     python_requires=">=3.8",
     # Cast long description to markdown
     long_description_content_type="text/markdown",
-)
\ No newline at end of file
+)
```

**File**: `tests/core/test_version.py` (added, +16/-0)
```diff
@@ -0,0 +1,16 @@
+import bm25s.version as version_module
+
+
+def test_discover_version_uses_package_metadata(monkeypatch):
+    monkeypatch.setattr(version_module, "version", lambda name: "1.2.3")
+
+    assert version_module._discover_version() == "1.2.3"
+
+
+def test_discover_version_falls_back_when_distribution_is_missing(monkeypatch):
+    def missing_version(name):
+        raise version_module.PackageNotFoundError(name)
+
+    monkeypatch.setattr(version_module, "version", missing_version)
+
+    assert version_module._discover_version() == "0.0.0"
```

---

### Incident Patch 7: `cbaed27d` (2026-04-28)
**Commit Message**: Fix runtime version discovery

**File**: `.github/scripts/python/update_version.py` (removed, +0/-34)
```diff
@@ -1,34 +0,0 @@
-"""
-This CLI script is used to update the version of the package. It is used by the
-CI/CD pipeline to update the version of the package when a new release is made.
-
-It uses argparse to parse the command line arguments, which are the new version
-and the path to the package's __init__.py file.
-"""
-
-import argparse
-from pathlib import Path
-
-def main():
-    parser = argparse.ArgumentParser(
-        description="Update the version of the package."
-    )
-    parser.add_argument(
-        "--version",
-        type=str,
-        help="The new version of the package.",
-        required=True,
-    )
-    parser.add_argument(
-        "--path",
-        type=Path,
-        help="The path to the package's version file.",
-    )
-    args = parser.parse_args()
-
-    with open(args.path, "w") as f:
-        f.write(f"__version__ = \"{args.version}\"")
-        
-
-if __name__ == "__main__":
-    main()
\ No newline at end of file
```

**File**: `.github/workflows/publish-python.yaml` (modified, +3/-6)
```diff
@@ -15,6 +15,9 @@ jobs:
     permissions:
       # IMPORTANT: this permission is mandatory for trusted publishing
       id-token: write
+
+    env:
+      BM25S_VERSION: ${{ github.event.release.tag_name }}
     
     environment:
       name: pypi
@@ -27,12 +30,6 @@ jobs:
       with:
         python-version: '3.10'
     
-    - name: Update version.py with release tag
-      env:
-        RELEASE_TAG: ${{ github.event.release.tag_name }}
-      run: |
-        python .github/scripts/python/update_version.py --version $RELEASE_TAG --path "bm25s/version.py"
-    
     - name: Install dependencies
       run: |
         python -m pip install --upgrade pip
```

**File**: `bm25s/high_level/setup.py` (modified, +101/-7)
```diff
@@ -1,22 +1,116 @@
 from setuptools import setup
 import os
-import sys
+import re
+import subprocess
+from pathlib import Path
 
 # Change to the current directory to avoid issues if run from elsewhere
 current_dir = os.path.dirname(os.path.abspath(__file__))
 os.chdir(current_dir)
 
 package_name = "BM25"
-version = {}
-with open(os.path.join("..", "version.py"), encoding="utf8") as fp:
-    exec(fp.read(), version)
+base_dir = Path(current_dir)
+
+
+def _normalize_version(value):
+    version = value.strip()
+    if version.startswith("refs/tags/"):
+        version = version.rsplit("/", 1)[-1]
+    if version.startswith("v"):
+        version = version[1:]
+    return version
+
+
+def _version_from_environment():
+    for key in ("BM25S_VERSION", "RELEASE_TAG"):
+        value = os.environ.get(key)
+        if value:
+            return _normalize_version(value)
+
+    if os.environ.get("GITHUB_REF_TYPE") == "tag":
+        value = os.environ.get("GITHUB_REF_NAME")
+        if value:
+            return _normalize_version(value)
+
+    github_ref = os.environ.get("GITHUB_REF", "")
+    if github_ref.startswith("refs/tags/"):
+        return _normalize_version(github_ref)
+
+    return None
+
+
+def _version_from_pkg_info(package_dir):
+    pkg_info = package_dir / "PKG-INFO"
+    if not pkg_info.exists():
+        return None
+
+    for line in pkg_info.read_text(encoding="utf8").splitlines():
+        if line.startswith("Version:"):
+            return _normalize_version(line.partition(":")[2])
+
+    return None
+
+
+def _git_describe(package_dir, *args):
+    try:
+        return subprocess.check_output(
+            [
+                "git",
+                "describe",
+                "--tags",
+                "--match",
+                "[0-9]*",
+                "--match",
+                "v[0-9]*",
+                *args,
+            ],
+            cwd=package_dir,
+            stderr=subprocess.DEVNULL,
+            text=True,
+        ).strip()
+    except (OSError, subprocess.CalledProcessError):
+        return None
+
+
+def _version_from_git(package_dir):
+    exact_tag = _git_describe(package_dir, "--exact-match")
+    if exact_tag:
+        return _normalize_version(exact_tag)
+
+    description = _git_describe(package_dir, "--long")
+    if not description:
+        return None
+
+    match = re.match(r"(.+)-(\d+)-g([0-9a-f]+)$", description)
+    if not match:
+        return None
+
+    tag, distance, sha = match.groups()
+    version = _normalize_version(tag)
+    if distance == "0":
+        return version
+
+    suffix = ".dev" if ".post" in version else ".post"
+    return f"{version}{suffix}{distance}+g{sha}"
+
+
+def _get_build_version(package_dir):
+    return (
+        _version_from_environment()
+        or _version_from_pkg_info(package_dir)
+        or _version_from_git(package_dir)
+        or "0.0.0"
+    )
+
+
+package_version = _get_build_version(base_dir)
 
 with open("README.md", encoding="utf8") as fp:
     long_description = fp.read()
 
 setup(
     name=package_name,
-    version=version["__version__"],
+    version=package_version,
     author="Xing Han Lù",
     author_email="bm25s@googlegroups.com",
     url="https://github.com/xhluca/bm25s/tree/main/bm25s/high_level",
@@ -26,7 +120,7 @@
     packages=["BM25"],
     package_dir={"BM25": "."},
     install_requires=[
-        f"bm25s[core,cli]=={version['__version__']}",
+        f"bm25s[core,cli]=={package_version}",
     ],
     entry_points={
         "console_scripts": [
@@ -39,4 +133,4 @@
         "Operating System :: OS Independent",
     ],
     python_requires=">=3.8",
-)
\ No newline at end of file
+)
```

**File**: `bm25s/version.py` (modified, +14/-1)
```diff
@@ -1 +1,14 @@
-__version__ = "0.0.1dev0"
+from importlib.metadata import PackageNotFoundError, version
+
+_DISTRIBUTION_NAME = "bm25s"
+_FALLBACK_VERSION = "0.0.0"
+
+
+def _discover_version() -> str:
+    try:
+        return version(_DISTRIBUTION_NAME)
+    except PackageNotFoundError:
+        return _FALLBACK_VERSION
+
+
+__version__ = _discover_version()
```

**File**: `setup.py` (modified, +103/-6)
```diff
@@ -1,11 +1,108 @@
+import os
+import re
+import subprocess
+from pathlib import Path
+
 from setuptools import setup, find_packages
 
 package_name = "bm25s"
-version = {}
-with open(f"{package_name}/version.py", encoding="utf8") as fp:
-    exec(fp.read(), version)
+base_dir = Path(__file__).resolve().parent
+
+
+def _normalize_version(value):
+    version = value.strip()
+    if version.startswith("refs/tags/"):
+        version = version.rsplit("/", 1)[-1]
+    if version.startswith("v"):
+        version = version[1:]
+    return version
+
+
+def _version_from_environment():
+    for key in ("BM25S_VERSION", "RELEASE_TAG"):
+        value = os.environ.get(key)
+        if value:
+            return _normalize_version(value)
+
+    if os.environ.get("GITHUB_REF_TYPE") == "tag":
+        value = os.environ.get("GITHUB_REF_NAME")
+        if value:
+            return _normalize_version(value)
+
+    github_ref = os.environ.get("GITHUB_REF", "")
+    if github_ref.startswith("refs/tags/"):
+        return _normalize_version(github_ref)
+
+    return None
+
+
+def _version_from_pkg_info(package_dir):
+    pkg_info = package_dir / "PKG-INFO"
+    if not pkg_info.exists():
+        return None
+
+    for line in pkg_info.read_text(encoding="utf8").splitlines():
+        if line.startswith("Version:"):
+            return _normalize_version(line.partition(":")[2])
+
+    return None
+
+
+def _git_describe(package_dir, *args):
+    try:
+        return subprocess.check_output(
+            [
+                "git",
+                "describe",
+                "--tags",
+                "--match",
+                "[0-9]*",
+                "--match",
+                "v[0-9]*",
+                *args,
+            ],
+            cwd=package_dir,
+            stderr=subprocess.DEVNULL,
+            text=True,
+        ).strip()
+    except (OSError, subprocess.CalledProcessError):
+        return None
+
+
+def _version_from_git(package_dir):
+    exact_tag = _git_describe(package_dir, "--exact-match")
+    if exact_tag:
+        return _normalize_version(exact_tag)
+
+    description = _git_describe(package_dir, "--long")
+    if not description:
+        return None
+
+    match = re.match(r"(.+)-(\d+)-g([0-9a-f]+)$", description)
+    if not match:
+        return None
+
+    tag, distance, sha = match.groups()
+    version = _normalize_version(tag)
+    if distance == "0":
+        return version
+
+    suffix = ".dev" if ".post" in version else ".post"
+    return f"{version}{suffix}{distance}+g{sha}"
+
+
+def _get_build_version(package_dir):
+    return (
+        _version_from_environment()
+        or _version_from_pkg_info(package_dir)
+        or _version_from_git(package_dir)
+        or "0.0.0"
+    )
+
+
+package_version = _get_build_version(base_dir)
 
-with open("README.md", encoding="utf8") as fp:
+with open(base_dir / "README.md", encoding="utf8") as fp:
     long_description = fp.read()
 
 extras_require = {
@@ -24,7 +121,7 @@
 
 setup(
     name=package_name,
-    version=version["__version__"],
+    version=package_version,
     author="Xing Han Lù",
     author_email=f"{package_name}@googlegroups.com",
     url=f"https://github.com/xhluca/{package_name}",
@@ -47,4 +144,4 @@
     python_requires=">=3.8",
     # Cast long description to markdown
     long_description_content_type="text/markdown",
-)
\ No newline at end of file
+)
```

**File**: `tests/core/test_version.py` (added, +16/-0)
```diff
@@ -0,0 +1,16 @@
+import bm25s.version as version_module
+
+
+def test_discover_version_uses_package_metadata(monkeypatch):
+    monkeypatch.setattr(version_module, "version", lambda name: "1.2.3")
+
+    assert version_module._discover_version() == "1.2.3"
+
+
+def test_discover_version_falls_back_when_distribution_is_missing(monkeypatch):
+    def missing_version(name):
+        raise version_module.PackageNotFoundError(name)
+
+    monkeypatch.setattr(version_module, "version", missing_version)
+
+    assert version_module._discover_version() == "0.0.0"
```

---

### Incident Patch 8: `4a4d5fcf` (2026-04-25)
**Commit Message**: Merge pull request #181 from aidanstewartthomson/fix/bm25-save-progress

feat: allow disabling progress when saving index

**File**: `bm25s/__init__.py` (modified, +5/-1)
```diff
@@ -942,6 +942,7 @@ def save(
         nnoc_name="nonoccurrence_array.index.npy",
         corpus_name="corpus.jsonl",
         allow_pickle=False,
+        show_progress=True
     ):
         """
         Save the BM25S index to the `save_dir` directory. This will save the scores array,
@@ -979,6 +980,9 @@ def save(
         allow_pickle : bool
             If True, the arrays will be saved using pickle. If False, the arrays will be saved
             in a more efficient format, but they will not be readable by older versions of numpy.
+
+        show_progress : bool
+            If True, a progress bar will be shown. If False, no progress bar will be shown.
         """
         # Save the self.vocab_dict and self.score_matrix to the save_dir
         save_dir = Path(save_dir)
@@ -1050,7 +1054,7 @@ def save(
                         f.write(doc_str + "\n")
 
             # also save corpus.mmindex
-            mmidx = utils.corpus.find_newline_positions(save_dir / corpus_name)
+            mmidx = utils.corpus.find_newline_positions(save_dir / corpus_name, show_progress=show_progress)
             utils.corpus.save_mmindex(mmidx, path=save_dir / corpus_name)
 
     def load_scores(
```

---

### Incident Patch 9: `20d73d7d` (2026-04-24)
**Commit Message**: Merge pull request #179 from xhluca/copilot/fix-resource-module-stdout-error

Stop `bm25s` import from writing Windows `resource` fallback message to stdout

**File**: `.github/workflows/claude-code-review.yml` (removed, +0/-44)
```diff
@@ -1,44 +0,0 @@
-name: Claude Code Review
-
-on:
-  pull_request:
-    types: [opened, synchronize, ready_for_review, reopened]
-    # Optional: Only run on specific file changes
-    # paths:
-    #   - "src/**/*.ts"
-    #   - "src/**/*.tsx"
-    #   - "src/**/*.js"
-    #   - "src/**/*.jsx"
-
-jobs:
-  claude-review:
-    # Optional: Filter by PR author
-    # if: |
-    #   github.event.pull_request.user.login == 'external-contributor' ||
-    #   github.event.pull_request.user.login == 'new-developer' ||
-    #   github.event.pull_request.author_association == 'FIRST_TIME_CONTRIBUTOR'
-
-    runs-on: ubuntu-latest
-    permissions:
-      contents: read
-      pull-requests: read
-      issues: read
-      id-token: write
-
-    steps:
-      - name: Checkout repository
-        uses: actions/checkout@v4
-        with:
-          fetch-depth: 1
-
-      - name: Run Claude Code Review
-        id: claude-review
-        uses: anthropics/claude-code-action@v1
-        with:
-          claude_code_oauth_token: ${{ secrets.CLAUDE_CODE_OAUTH_TOKEN }}
-          plugin_marketplaces: 'https://github.com/anthropics/claude-code.git'
-          plugins: 'code-review@claude-code-plugins'
-          prompt: '/code-review:code-review ${{ github.repository }}/pull/${{ github.event.pull_request.number }}'
-          # See https://github.com/anthropics/claude-code-action/blob/main/docs/usage.md
-          # or https://code.claude.com/docs/en/cli-reference for available options
-
```

**File**: `bm25s/utils/benchmark.py` (modified, +4/-1)
```diff
@@ -1,11 +1,14 @@
 from copy import deepcopy
+import logging
 import time
 import sys
 
+logger = logging.getLogger(__name__)
+
 try:
     import resource
 except ImportError:
-    print("resource module not available on Windows")
+    logger.warning("resource module not available on Windows")
     resource = None
 
 
```

**File**: `tests/core/test_benchmark_utils.py` (added, +39/-0)
```diff
@@ -0,0 +1,39 @@
+import builtins
+import contextlib
+import importlib
+import io
+import unittest
+from unittest import mock
+
+import bm25s.utils.benchmark as benchmark
+
+
+class TestBenchmarkUtils(unittest.TestCase):
+    def test_missing_resource_does_not_write_to_stdout(self):
+        original_import = builtins.__import__
+
+        def _import_with_missing_resource(name, globals=None, locals=None, fromlist=(), level=0):
+            if name == "resource":
+                raise ImportError("resource module not available")
+            return original_import(name, globals, locals, fromlist, level)
+
+        mock_logger = mock.Mock()
+
+        try:
+            with mock.patch("logging.getLogger", return_value=mock_logger):
+                with mock.patch("builtins.__import__", side_effect=_import_with_missing_resource):
+                    with contextlib.redirect_stdout(io.StringIO()) as stdout:
+                        importlib.reload(benchmark)
+
+            self.assertEqual(stdout.getvalue(), "")
+            self.assertIsNone(benchmark.resource)
+            self.assertIsNone(benchmark.get_max_memory_usage())
+            mock_logger.warning.assert_called_once_with(
+                "resource module not available on Windows"
+            )
+        finally:
+            importlib.reload(benchmark)
+
+
+if __name__ == "__main__":
+    unittest.main()
```

---

### Incident Patch 10: `dbcec651` (2026-04-24)
**Commit Message**: Merge remote-tracking branch 'origin/main' into copilot/fix-resource-module-stdout-error

**File**: `bm25s/utils/beir.py` (modified, +52/-7)
```diff
@@ -18,8 +18,8 @@ def _faketqdm(*args, **kwargs):
 
 from . import json_functions
 
-BASE_URL = "https://public.ukp.informatik.tu-darmstadt.de/thakur/BEIR/datasets/{}.zip"
 GH_URL = "https://github.com/xhluca/bm25s/releases/download/data/{}.zip"
+BASE_URL = GH_URL
 
 
 def clean_results_keys(beir_results):
@@ -132,6 +132,7 @@ def download_dataset(
     show_progress=True,
 ):
     import urllib.request
+    import urllib.error
     import zipfile
     from pathlib import Path
     from tqdm.auto import tqdm
@@ -144,20 +145,18 @@ def download_dataset(
     save_zip_path = save_dir / "archive" / f"{dataset}.zip"
     save_zip_path.parent.mkdir(parents=True, exist_ok=True)
 
-    if not save_zip_path.exists() or redownload:
-        # download the zip file and save it with tqdm progress bar
+    def download_file(src_url, dst_path, desc):
         pbar = tqdm(
             unit="B",
             unit_scale=True,
-            desc=f"Downloading {dataset}",
+            desc=desc,
             leave=False,
             disable=not show_progress,
         )
-        with open(save_zip_path, "wb") as f:
-            response = urllib.request.urlopen(url)
+        with open(dst_path, "wb") as f:
+            response = urllib.request.urlopen(src_url)
             total_size = int(response.headers.get("content-length", 0))
             block_size = 8192 * 2
-            # set the tqdm total to the total size
             pbar.total = total_size
             while True:
                 buffer = response.read(block_size)
@@ -168,6 +167,52 @@ def download_dataset(
 
         pbar.close()
 
+    def download_multipart_release(dataset_url, dst_path):
+        part_paths = []
+        for part_idx in range(1000):
+            part_path = dst_path.parent / f"{dst_path.name}.part-{part_idx:03d}"
+            part_url = f"{dataset_url}.part-{part_idx:03d}"
+            try:
+                download_file(
+                    part_url, part_path, f"Downloading {dataset} part {part_idx:03d}"
+                )
+            except urllib.error.HTTPError as exc:
+                if part_path.exists():
+                    part_path.unlink()
+                if exc.code == 404 and part_idx > 0:
+                    break
+                raise
+            part_paths.append(part_path)
+
+        if not part_paths:
+            raise FileNotFoundError(
+                f"No release assets found for dataset {dataset} at {dataset_url}"
+            )
+
+        with open(dst_path, "wb") as f_out:
+            for part_path in tqdm(
+                part_paths,
+                desc=f"Assembling {dataset}",
+                leave=False,
+                disable=not show_progress,
+            ):
+                with open(part_path, "rb") as f_in:
+                    while True:
+                        chunk = f_in.read(8192 * 2)
+                        if not chunk:
+                            break
+                        f_out.write(chunk)
+                part_path.unlink()
+
+    if not save_zip_path.exists() or redownload:
+        try:
+            download_file(url, save_zip_path, f"Downloading {dataset}")
+        except urllib.error.HTTPError as exc:
+            if exc.code == 404:
+                download_multipart_release(url, save_zip_path)
+            else:
+                raise
+
     # now that we have the zip file, extract it
     if unzip:
         with zipfile.ZipFile(save_zip_path, "r") as zip_ref:
```

**File**: `tests/__init__.py` (modified, +3/-8)
```diff
@@ -8,6 +8,7 @@
 import numpy as np
 
 import bm25s
+from bm25s.utils.beir import BASE_URL
 
 
 # Make sure to import or define the functions/classes you're going to use,
@@ -54,10 +55,7 @@ def compare_with_rank_bm25(
             raise ValueError("method must be either 'rank' or 'bm25+'.")
 
         # Download and prepare dataset
-        base_url = (
-            "https://public.ukp.informatik.tu-darmstadt.de/thakur/BEIR/datasets/{}.zip"
-        )
-        url = base_url.format(dataset)
+        url = BASE_URL.format(dataset)
         out_dir = Path(__file__).parent / rel_save_dir
         data_path = download_and_unzip(url, str(out_dir))
 
@@ -191,10 +189,7 @@ def compare_with_bm25_pt(
         warnings.filterwarnings("ignore", category=UserWarning)
 
         # Download and prepare dataset
-        base_url = (
-            "https://public.ukp.informatik.tu-darmstadt.de/thakur/BEIR/datasets/{}.zip"
-        )
-        url = base_url.format(dataset)
+        url = BASE_URL.format(dataset)
         out_dir = Path(__file__).parent / rel_save_dir
         data_path = download_and_unzip(url, str(out_dir))
 
```

**File**: `tests/comparison/test_bm25s_indexing.py` (modified, +2/-4)
```diff
@@ -12,6 +12,7 @@
 import Stemmer
 
 import bm25s
+from bm25s.utils.beir import BASE_URL
 
 def check_scores_all_close(score1, score2, **kwargs):
     for key in score1.keys():
@@ -36,10 +37,7 @@ def __init__(self, ids, vocab):
         dataset = "scifact"
         rel_save_dir = "datasets"
         # Download and prepare dataset
-        base_url = (
-            "https://public.ukp.informatik.tu-darmstadt.de/thakur/BEIR/datasets/{}.zip"
-        )
-        url = base_url.format(dataset)
+        url = BASE_URL.format(dataset)
         out_dir = Path(__file__).parent / rel_save_dir
         data_path = download_and_unzip(url, str(out_dir))
 
```

---

### Incident Patch 11: `69986ef5` (2026-04-22)
**Commit Message**: Fix benchmark fallback to avoid stdout output and add test

Agent-Logs-Url: https://github.com/xhluca/bm25s/sessions/67fbca97-cd07-43d7-b11e-13a96927d86a

Co-authored-by: xhluca <[REDACTED_EMAIL]>

**File**: `bm25s/utils/benchmark.py` (modified, +4/-1)
```diff
@@ -1,11 +1,14 @@
 from copy import deepcopy
+import logging
 import time
 import sys
 
+logger = logging.getLogger(__name__)
+
 try:
     import resource
 except ImportError:
-    print("resource module not available on Windows")
+    logger.warning("resource module not available on Windows")
     resource = None
 
 
```

**File**: `tests/core/test_benchmark_utils.py` (added, +33/-0)
```diff
@@ -0,0 +1,33 @@
+import builtins
+import contextlib
+import importlib
+import io
+import unittest
+from unittest import mock
+
+import bm25s.utils.benchmark as benchmark
+
+
+class TestBenchmarkUtils(unittest.TestCase):
+    def test_missing_resource_does_not_write_to_stdout(self):
+        original_import = builtins.__import__
+
+        def _import_with_missing_resource(name, globals=None, locals=None, fromlist=(), level=0):
+            if name == "resource":
+                raise ImportError("resource module not available")
+            return original_import(name, globals, locals, fromlist, level)
+
+        try:
+            with mock.patch("builtins.__import__", side_effect=_import_with_missing_resource):
+                with contextlib.redirect_stdout(io.StringIO()) as stdout:
+                    importlib.reload(benchmark)
+
+            self.assertEqual(stdout.getvalue(), "")
+            self.assertIsNone(benchmark.resource)
+            self.assertIsNone(benchmark.get_max_memory_usage())
+        finally:
+            importlib.reload(benchmark)
+
+
+if __name__ == "__main__":
+    unittest.main()
```

---

### Incident Patch 12: `bd21d227` (2026-03-27)
**Commit Message**: Merge pull request #174 from xhluca/copilot/fix-jax-import-guard-runtimeerror

Catch RuntimeError in jax import guard in selection.py

**File**: `bm25s/selection.py` (modified, +1/-1)
```diff
@@ -2,7 +2,7 @@
 
 try:
     import jax.lax
-except ImportError:
+except (ImportError, RuntimeError):
     JAX_IS_AVAILABLE = False
 else:
     JAX_IS_AVAILABLE = True
```

---

### Incident Patch 13: `08b6fa11` (2026-03-27)
**Commit Message**: Fix jax import guard to also catch RuntimeError

Agent-Logs-Url: https://github.com/xhluca/bm25s/sessions/d538ea50-b06f-4da9-9997-c310d4e223b1

Co-authored-by: xhluca <[REDACTED_EMAIL]>

**File**: `bm25s/selection.py` (modified, +1/-1)
```diff
@@ -2,7 +2,7 @@
 
 try:
     import jax.lax
-except ImportError:
+except (ImportError, RuntimeError):
     JAX_IS_AVAILABLE = False
 else:
     JAX_IS_AVAILABLE = True
```

---

### Incident Patch 14: `2f2b25bd` (2026-03-17)
**Commit Message**: revert: keep BM25 and bm25s versions perfectly synced

Co-Authored-By: Claude Opus 4.6 (1M context) <[REDACTED_EMAIL]>

**File**: `bm25s/high_level/setup.py` (modified, +1/-6)
```diff
@@ -6,16 +6,11 @@
 current_dir = os.path.dirname(os.path.abspath(__file__))
 os.chdir(current_dir)
 
-import re
-
 package_name = "BM25"
 version = {}
 with open(os.path.join("..", "version.py"), encoding="utf8") as fp:
     exec(fp.read(), version)
 
-# Base version without post/dev suffixes, used for the bm25s dependency
-base_version = re.sub(r'\.(post|dev)\d+$', '', version["__version__"])
-
 with open("README.md", encoding="utf8") as fp:
     long_description = fp.read()
 
@@ -31,7 +26,7 @@
     packages=["BM25"],
     package_dir={"BM25": "."},
     install_requires=[
-        f"bm25s[core,cli]=={base_version}",
+        f"bm25s[core,cli]=={version['__version__']}",
     ],
     entry_points={
         "console_scripts": [
```

---

### Incident Patch 15: `0c4d4492` (2026-03-17)
**Commit Message**: fix: update BM25 homepage link and decouple version from bm25s

- Point homepage link to bm25-python.github.io
- Strip post/dev suffixes from bm25s dependency version so BM25 post
  releases can depend on the base bm25s version

Co-Authored-By: Claude Opus 4.6 (1M context) <[REDACTED_EMAIL]>

**File**: `bm25s/high_level/README.md` (modified, +1/-1)
```diff
@@ -13,7 +13,7 @@
                   <a href="https://pypi.org/project/BM25/">📦 PyPI</a>
             </td>
             <td>
-                  <a href="https://bm25s.github.io">🏠 Homepage</a>
+                  <a href="https://bm25-python.github.io">🏠 Homepage</a>
             </td>
       </tr>
 </table>
```

**File**: `bm25s/high_level/setup.py` (modified, +6/-1)
```diff
@@ -6,11 +6,16 @@
 current_dir = os.path.dirname(os.path.abspath(__file__))
 os.chdir(current_dir)
 
+import re
+
 package_name = "BM25"
 version = {}
 with open(os.path.join("..", "version.py"), encoding="utf8") as fp:
     exec(fp.read(), version)
 
+# Base version without post/dev suffixes, used for the bm25s dependency
+base_version = re.sub(r'\.(post|dev)\d+$', '', version["__version__"])
+
 with open("README.md", encoding="utf8") as fp:
     long_description = fp.read()
 
@@ -26,7 +31,7 @@
     packages=["BM25"],
     package_dir={"BM25": "."},
     install_requires=[
-        f"bm25s[core,cli]=={version['__version__']}",
+        f"bm25s[core,cli]=={base_version}",
     ],
     entry_points={
         "console_scripts": [
```

#### Recent Merged Pull Requests:
- **PR #209** (2026-10-02): test: reject truncated corpora with stale line indexes (@xhluca)
- **PR #207** (2026-10-01): Automatically enforce contributor account eligibility (@xhluca)
- **PR #205** (closed): fix: JsonlCorpus supports empty (zero-byte) jsonl files (@linhongyu510)
- **PR #204** (closed): Fix concurrent JsonlCorpus reads using explicit mmap offsets (@LimbC-C)
- **PR #200** (2026-10-01): Fix index paths for extensionless JSONL corpora (@LimbC-C)
- **PR #198** (2026-09-18): Add support for GIL-free concurrency (@AndreasMadsen)
- **PR #196** (closed): Preserve structured corpus entries during retrieval (@Shy7777)
- **PR #195** (closed): Support concurrent single-query retrieval with BM25S_NOGIL (@xhluca)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
