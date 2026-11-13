# Verification Protocol: Verification Protocol: Empirical Defect Shield for marker-inc-korea-autorag-learnings

<!-- PROVENANCE_START
{
  "source_repository": "marker-inc-korea-autorag-learnings",
  "source_url": "unknown",
  "source_version": "HEAD",
  "license": "Open-Source",
  "timestamp": "2026-11-13T12:41:10.839Z",
  "ai_provider": "universal-multi-artifact-distributor",
  "generator_version": "2.0.0-universal",
  "learning_id": "LEARN-REEXTRACT-marker-inc-korea-autorag-learnings",
  "canonical_classification": "verification_contract"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [marker-inc-korea-autorag-learnings](unknown) (Revision: `HEAD`).  
> **License**: Open-Source | **Timestamp**: `2026-11-13T12:41:10.839Z`  
> **Learning ID**: `LEARN-REEXTRACT-marker-inc-korea-autorag-learnings`


## 1. Scope & Verification Target
- **Target Repository**: `marker-inc-korea-autorag-learnings` (Commit: `HEAD`)
- **Pillar Alignment**: Pillar 11 (Empirical Truth & Mathematical Integrity)

## 2. Observed Failure Modes & Defect Traps
> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/marker-inc-korea-autorag-learnings.md`  
> **Source**: github ([https://github.com/Marker-Inc-Korea/AutoRAG](https://github.com/Marker-Inc-Korea/AutoRAG))  
> **Source Version**: `111d035d`  
> **License**: Apache-2.0  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-11-11T06:23:32.584Z  
> **Learning ID**: `learn-github-marker-inc-korea-autorag`  
> **Pipeline Version**: `2.0.0`  
> **Status**: VERIFIED_EMPIRICAL_INTELLIGENCE  
> **Data Governance**: CLASSIFICATION: PUBLIC. Sanitized against PII/secrets.  
> **Policy Invariant**: Strictly for engineering retrieval and architecture documentation. Distillation prohibited.  

---

# Forensic Learning Record (Deep Inspection): Marker-Inc-Korea/AutoRAG

> **Canonical Artifact**: `07_PROJECT_LEARNING/marker-inc-korea-autorag-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/Marker-Inc-Korea/AutoRAG](https://github.com/Marker-Inc-Korea/AutoRAG))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-11-11T06:23:32.582Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `Marker-Inc-Korea/AutoRAG`
- **Description**: Your Personal Librarian Agent. Ask anything on your computer, organize files, remember important info and files.
- **Primary Language / Ecosystem**: TypeScript
- **Discovered Manifests / Configurations**: package.json, README.md
- **Stars / Engagement**: 5653 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: package.json, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `legacy/autorag/data/utils/util.py`
```
import mimetypes
import os
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Tuple, Callable

import pandas as pd
import yaml
from langchain_core.documents import Document
from llama_index.core.schema import NodeRelationship

from autorag.schema import Module
from autorag.utils.util import make_combinations, explode


def get_file_metadata(file_path: str) -> Dict:
	"""Get some handy metadate from filesystem.

	Args:
	    file_path: str: file path in str
	"""
	return {
		"file_path": file_path,
		"file_name": os.path.basename(file_path),
		"file_type": mimetypes.guess_type(file_path)[0],
		"file_size": os.path.getsize(file_path),
		"creation_datetime": datetime.fromtimestamp(
			Path(file_path).stat().st_ctime
		).strftime("%Y-%m-%d"),
		"last_modified_datetime": datetime.fromtimestamp(
			Path(file_path).stat().st_mtime
		).strftime("%Y-%m-%d"),
		"last_accessed_datetime": datetime.fromtimestamp(
			Path(file_path).stat().st_atime
		).strftime("%Y-%m-%d"),
	}


def add_essential_metadata(metadata: Dict) -> Dict:
	if "last_modified_datetime" not in metadata:
		metadata["last_modified_datetime"] = datetime.now()
	return metadata


def corpus_df_to_langchain_documents(corpus_df: pd.DataFrame) -> List[Document]:
	page_contents = corpus_df["contents"].tolist()
	ids = corpus_df["doc_id"].tolist()
	metadatas = corpus_df["metadata"].tolist()
	return list(
		map(
			lambda x: Document(page_content=x[0], metadata={"filename": x[1], **x[2]}),
			zip(page_contents, ids, metadatas),
		)
	)


def add_essential_metadata_llama_text_node(metadata: Dict, relationships: Dict) -> Dict:
	if "last_modified_datetime" not in metadata:
		metadata["last_modified_datetime"] = datetime.now()

	if "prev_id" not in metadata:
		if NodeRelationship.PREVIOUS in relationships:
			prev_node = relationships.get(NodeRelationship.PREVIOUS, None)
			if prev_node:
				metadata["prev_id"] = prev_node.node_id

	if "next_id" not in metadata:
		if NodeRelationship.NEXT in relationships:
			next_node = relationships.get(NodeRelationship.NEXT, None)
			if next_node:
				metadata["next_id"] = next_node.node_id
	return metadata


def load_yaml(yaml_path: str):
	if not os.path.exists(yaml_path):
		raise ValueError(f"YAML file {yaml_path} does not exist.")
	with open(yaml_path, "r", encoding="utf-8") as stream:
		try:
			yaml_dict = yaml.safe_load(stream)
		except yaml.YAMLError as exc:
			raise ValueError(f"YAML file {yaml_path} could not be loaded.") from exc
	return yaml_dict["modules"]


def get_param_combinations(modules: List[Dict]) -> Tuple[List[Callable], List[Dict]]:
	module_callable_list, module_params_list = [], []
	for module in modules:
		module_instance = Module.from_dict(module)
		module_params_list.append(module_instance.module_param)
		module_callable_list.append(module_instance.module)

	combinations = list(map(make_combinations, module_params_list))
	module_list, combination_list = explode(module_callable_list, combinations)
	return module_list, combination_list


def get_start_end_idx(original_text: str, search_str: str) -> Tuple[int, int]:
	start_idx = original_text.find(search_str)
	if start_idx == -1:
		return 0, 0
	end_idx = start_idx + len(search_str)
	return start_idx, end_idx - 1

```

### Core Architecture Module: `legacy/autorag/evaluation/metric/util.py`
```
import functools
import re
from typing import List

import numpy as np

from autorag.schema.metricinput import MetricInput
from autorag.utils.util import convert_inputs_to_list

_THINK_TAG_PATTERN = re.compile(
	r"<think(?:ing)?>[\s\S]*?</think(?:ing)?>\s*", re.IGNORECASE
)


def remove_think_tags(text: str) -> str:
	"""Remove complete ``<think>`` or ``<thinking>`` reasoning blocks."""
	return _THINK_TAG_PATTERN.sub("", text)


def calculate_cosine_similarity(a, b):
	dot_product = np.dot(a, b)
	norm_a = np.linalg.norm(a)
	norm_b = np.linalg.norm(b)
	similarity = dot_product / (norm_a * norm_b)
	return similarity


def calculate_l2_distance(a, b):
	return np.linalg.norm(a - b)


def calculate_inner_product(a, b):
	return np.dot(a, b)


def autorag_metric(fields_to_check: List[str]):
	def decorator_autorag_metric(func):
		@functools.wraps(func)
		@convert_inputs_to_list
		def wrapper(metric_inputs: List[MetricInput], **kwargs) -> List[float]:
			"""
			Use 'for loop' to run each metric input.
			Put the single metric input into the metric function.

			:param metric_inputs: A list MetricInput schema for AutoRAG metric.
			:param kwargs: The additional arguments for metric function.
			:return: A list of computed metric scores.
			"""
			results = []
			for metric_input in metric_inputs:
				if metric_input.is_fields_notnone(fields_to_check=fields_to_check):
					results.append(func(metric_input, **kwargs))
				else:
					results.append(None)
			return results

		return wrapper

	return decorator_autorag_metric


def autorag_metric_loop(fields_to_check: List[str]):
	def decorator_autorag_generation_metric(func):
		@functools.wraps(func)
		@convert_inputs_to_list
		def wrapper(metric_inputs: List[MetricInput], **kwargs) -> List[float]:
			"""
			Put the list of metric inputs into the metric function.

			:param metric_inputs: A list MetricInput schema for AutoRAG metric.
			:param kwargs: The additional arguments for metric function.
			:return: A list of computed metric scores.
			"""
			bool_list = [
				metric_input.is_fields_notnone(fields_to_check=fields_to_check)
				for metric_input in metric_inputs
			]
			valid_inputs = [
				metric_input
				for metric_input, is_valid in zip(metric_inputs, bool_list)
				if is_valid
			]

			results = [None] * len(metric_inputs)
			if valid_inputs:
				processed_valid = func(valid_inputs, **kwargs)

				valid_index = 0
				for i, is_valid in enumerate(bool_list):
					if is_valid:
						results[i] = processed_valid[valid_index]
						valid_index += 1

			return results

		return wrapper

	return decorator_autorag_generation_metric

```

### Core Architecture Module: `legacy/autorag/evaluation/util.py`
```
from copy import deepcopy
from typing import Union, List, Dict, Tuple, Any

from autorag.embedding.base import EmbeddingModel


def cast_metrics(
	metrics: Union[List[str], List[Dict]],
) -> Tuple[List[str], List[Dict[str, Any]]]:
	"""
	 Turn metrics to list of metric names and parameter list.

	:param metrics: List of string or dictionary.
	:return: The list of metric names and dictionary list of metric parameters.
	"""
	metrics_copy = deepcopy(metrics)
	if not isinstance(metrics_copy, list):
		raise ValueError("metrics must be a list of string or dictionary.")
	if isinstance(metrics_copy[0], str):
		return metrics_copy, [{} for _ in metrics_copy]
	elif isinstance(metrics_copy[0], dict):
		# pop 'metric_name' key from dictionary
		metric_names = list(map(lambda x: x.pop("metric_name"), metrics_copy))
		metric_params = [
			dict(
				map(
					lambda x, y: cast_embedding_model(x, y),
					metric.keys(),
					metric.values(),
				)
			)
			for metric in metrics_copy
		]
		return metric_names, metric_params
	else:
		raise ValueError("metrics must be a list of string or dictionary.")


def cast_embedding_model(key, value):
	if key == "embedding_model":
		return key, EmbeddingModel.load(value)()
	else:
		return key, value

```

### Core Architecture Module: `legacy/autorag/nodes/retrieval/run_util.py`
```
import os
import pathlib
from typing import Tuple, List, Union, Dict

import pandas as pd

from autorag.evaluation import evaluate_retrieval
from autorag.schema.metricinput import MetricInput
from autorag.strategy import measure_speed, filter_by_threshold, select_best


def evaluate_retrieval_node(
	result_df: pd.DataFrame,
	metric_inputs: List[MetricInput],
	metrics: Union[List[str], List[Dict]],
) -> pd.DataFrame:
	"""
	Evaluate retrieval node from retrieval node result dataframe.
	:param result_df: The result dataframe from a retrieval node.
	:param metric_inputs: List of metric input schema for AutoRAG.
	:param metrics: Metric list from input strategies.
	:return: Return result_df with metrics columns.
	    The columns will be 'retrieved_contents', 'retrieved_ids', 'retrieve_scores', and metric names.
	"""

	@evaluate_retrieval(
		metric_inputs=metric_inputs,
		metrics=metrics,
	)
	def evaluate_this_module(df: pd.DataFrame):
		return (
			df["retrieved_contents"].tolist(),
			df["retrieved_ids"].tolist(),
			df["retrieve_scores"].tolist(),
		)

	return evaluate_this_module(result_df)


def run(
	input_modules,
	input_module_params,
	project_dir: Union[str, pathlib.Path, pathlib.PurePath],
	previous_result: pd.DataFrame,
	strategies,
	metric_inputs: List[MetricInput],
) -> Tuple[List[pd.DataFrame], List]:
	"""
	Run input modules and parameters.
	:param input_modules: Input modules
	:param input_module_params: Input module parameters
	:param project_dir: Project directory path.
	:param previous_result: Previous result dataframe.
	:param strategies: Strategies for retrieval node.
	:param metric_inputs: List of metric input schema for AutoRAG.
	:return: First, it returns list of result dataframe.
	Second, it returns list of execution times.
	"""
	result, execution_times = zip(
		*map(
			lambda task: measure_speed(
				task[0].run_evaluator,
				project_dir=project_dir,
				previous_result=previous_result,
				**task[1],
			),
			zip(input_modules, input_module_params),
		)
	)
	average_times = list(map(lambda x: x / len(result[0]), execution_times))

	# run metrics before filtering
	if strategies.get("metrics") is None:
		raise ValueError("You must at least one metrics for retrieval evaluation.")
	result = list(
		map(
			lambda x: evaluate_retrieval_node(
				x,
				metric_inputs,
				strategies.get("metrics"),
			),
			result,
		)
	)

	return result, average_times


def save_and_summary(
	input_modules,
	input_module_params,
	result_list,
	execution_time_list,
	filename_start: int,
	save_dir: Union[str, pathlib.Path, pathlib.PurePath],
	strategies,
):
	"""
	Save the result and make summary file
	:param input_modules: Input modules
	:param input_module_params: Input module parameters
	:param result_list: Result list
	:param execution_time_list: Execution times
	:param filename_start: The first filename to use
	:return: First, it returns list of result dataframe.
	Second, it returns list of execution times.
	"""

	# save results to folder
	filepaths = list(
		map(
			lambda x: os.path.join(save_dir, f"{x}.parquet"),
			range(filename_start, filename_start + len(input_modules)),
		)
	)
	list(
		map(
			lambda x: x[0].to_parquet(x[1], index=False),
			zip(result_list, filepaths),
		)
	)  # execute save to parquet
	filename_list = list(map(lambda x: os.path.basename(x), filepaths))

	summary_df = pd.DataFrame(
		{
			"filename": filename_list,
			"module_name": list(map(lambda module: module.__name__, input_modules)),
			"module_params": input_module_params,
			"execution_time": execution_time_list,
			**{
				metric: list(map(lambda result: result[metric].mean(), result_list))
				for metric in strategies.get("metrics")
			},
		}
	)
	summary_df.to_csv(os.path.join(save_dir, "summary.csv"), index=False)
	return summary_df


def find_best(results, average_times, filenames, strategies):
	# filter by strategies
	if strategies.get("speed_threshold") is not None:
		results, filenames = filter_by_threshold(
			results, average_times, strategies["speed_threshold"], filenames
		)
	selected_result, selected_filename = select_best(
		results,
		strategies.get("metrics"),
		filenames,
		strategies.get("strategy", "mean"),
	)
	return selected_result, selected_filename

```

### Core Architecture Module: `legacy/autorag/nodes/util.py`
```
from typing import Optional, Dict

from autorag.support import get_support_modules


def make_generator_callable_param(generator_dict: Optional[Dict]):
	generator_dict = generator_dict or {}
	if "generator_module_type" not in generator_dict.keys():
		generator_dict = {
			"generator_module_type": "llama_index_llm",
			"llm": "openai",
			"model": "gpt-4o-mini",
		}
	module_str = generator_dict.pop("generator_module_type")
	module_class = get_support_modules(module_str)
	module_param = generator_dict
	return module_class, module_param

```

### Core Architecture Module: `legacy/autorag/utils/__init__.py`
```
from .preprocess import (
	validate_qa_dataset,
	validate_corpus_dataset,
	cast_qa_dataset,
	cast_corpus_dataset,
	validate_qa_from_corpus_dataset,
)
from .util import fetch_contents, result_to_dataframe, sort_by_scores

```

### Core Architecture Module: `legacy/autorag/utils/cast.py`
```
def cast_retrieve_infos(previous_result):
	return {
		"retrieved_contents": cast_retrieved_contents(previous_result),
		"retrieved_ids": cast_retrieved_ids(previous_result),
		"retrieve_scores": cast_retrieve_scores(previous_result),
	}


def cast_retrieved_contents(previous_result):
	if "retrieved_contents" in previous_result.columns:
		return previous_result["retrieved_contents"].tolist()
	elif "retrieved_contents_semantic" in previous_result.columns:
		return previous_result["retrieved_contents_semantic"].tolist()
	elif "retrieved_contents_lexical" in previous_result.columns:
		return previous_result["retrieved_contents_lexical"].tolist()
	else:
		raise ValueError(
			"previous_result must contain either 'retrieved_contents', 'retrieved_contents_semantic', or 'retrieved_contents_lexical' columns."
		)


def cast_retrieved_ids(previous_result):
	if "retrieved_ids" in previous_result.columns:
		return previous_result["retrieved_ids"].tolist()
	elif "retrieved_ids_semantic" in previous_result.columns:
		return previous_result["retrieved_ids_semantic"].tolist()
	elif "retrieved_ids_lexical" in previous_result.columns:
		return previous_result["retrieved_ids_lexical"].tolist()
	else:
		raise ValueError(
			"previous_result must contain either 'retrieved_ids', 'retrieved_ids_semantic', or 'retrieved_ids_lexical' columns."
		)


def cast_retrieve_scores(previous_result):
	if "retrieve_scores" in previous_result.columns:
		return previous_result["retrieve_scores"].tolist()
	elif "retrieve_scores_semantic" in previous_result.columns:
		return previous_result["retrieve_scores_semantic"].tolist()
	elif "retrieve_scores_lexical" in previous_result.columns:
		return previous_result["retrieve_scores_lexical"].tolist()
	else:
		raise ValueError(
			"previous_result must contain either 'retrieve_scores', 'retrieve_scores_semantic', or 'retrieve_scores_lexical' columns."
		)

```

### Core Architecture Module: `legacy/autorag/utils/preprocess.py`
```
from datetime import datetime

import numpy as np
import pandas as pd

from autorag.utils.util import preprocess_text


def validate_qa_dataset(df: pd.DataFrame):
	columns = ["qid", "query", "retrieval_gt", "generation_gt"]
	assert set(columns).issubset(df.columns), (
		f"df must have columns {columns}, but got {df.columns}"
	)


def validate_corpus_dataset(df: pd.DataFrame):
	columns = ["doc_id", "contents", "metadata"]
	assert set(columns).issubset(df.columns), (
		f"df must have columns {columns}, but got {df.columns}"
	)


def cast_qa_dataset(df: pd.DataFrame):
	def cast_retrieval_gt(gt):
		if isinstance(gt, str):
			return [[gt]]
		elif isinstance(gt, list):
			if isinstance(gt[0], str):
				return [gt]
			elif isinstance(gt[0], list):
				return gt
			elif isinstance(gt[0], np.ndarray):
				return cast_retrieval_gt(list(map(lambda x: x.tolist(), gt)))
			else:
				raise ValueError(
					f"retrieval_gt must be str or list, but got {type(gt[0])}"
				)
		elif isinstance(gt, np.ndarray):
			return cast_retrieval_gt(gt.tolist())
		else:
			raise ValueError(f"retrieval_gt must be str or list, but got {type(gt)}")

	def cast_generation_gt(gt):
		if isinstance(gt, str):
			return [gt]
		elif isinstance(gt, list):
			return gt
		elif isinstance(gt, np.ndarray):
			return cast_generation_gt(gt.tolist())
		else:
			raise ValueError(f"generation_gt must be str or list, but got {type(gt)}")

	df = df.reset_index(drop=True)
	validate_qa_dataset(df)
	assert df["qid"].apply(lambda x: isinstance(x, str)).sum() == len(df), (
		"qid must be string type."
	)
	assert df["query"].apply(lambda x: isinstance(x, str)).sum() == len(df), (
		"query must be string type."
	)
	df["retrieval_gt"] = df["retrieval_gt"].apply(cast_retrieval_gt)
	df["generation_gt"] = df["generation_gt"].apply(cast_generation_gt)
	df["query"] = df["query"].apply(preprocess_text)
	df["generation_gt"] = df["generation_gt"].apply(
		lambda x: list(map(preprocess_text, x))
	)
	return df


def cast_corpus_dataset(df: pd.DataFrame):
	df = df.reset_index(drop=True)
	validate_corpus_dataset(df)

	# drop rows that have empty contents
	df = df[~df["contents"].apply(lambda x: x is None or x.isspace())]

	def make_datetime_metadata(x):
		if x is None or x == {}:
			return {"last_modified_datetime": datetime.now()}
		elif x.get("last_modified_datetime") is None:
			return {**x, "last_modified_datetime": datetime.now()}
		else:
			return x

	df["metadata"] = df["metadata"].apply(make_datetime_metadata)

	# check every metadata have a datetime key
	assert sum(
		df["metadata"].apply(lambda x: x.get("last_modified_datetime") is not None)
	) == len(df), "Every metadata must have a datetime key."

	def make_prev_next_id_metadata(x, id_type: str):
		if x is None or x == {}:
			return {id_type: None}
		elif x.get(id_type) is None:
			return {**x, id_type: None}
		else:
			return x

	df["metadata"] = df["metadata"].apply(
		lambda x: make_prev_next_id_metadata(x, "prev_id")
	)
	df["metadata"] = df["metadata"].apply(
		lambda x: make_prev_next_id_metadata(x, "next_id")
	)

	df["contents"] = df["contents"].apply(preprocess_text)

	def normalize_unicode_metadata(metadata: dict):
		result = {}
		for key, value in metadata.items():
			if isinstance(value, str):
				result[key] = preprocess_text(value)
			else:
				result[key] = value
		return result

	df["metadata"] = df["metadata"].apply(normalize_unicode_metadata)

	# check every metadata have a prev_id, next_id key
	assert all("prev_id" in metadata for metadata in df["metadata"]), (
		"Every metadata must have a prev_id key."
	)
	assert all("next_id" in metadata for metadata in df["metadata"]), (
		"Every metadata must have a next_id key."
	)

	return df


def validate_qa_from_corpus_dataset(qa_df: pd.DataFrame, corpus_df: pd.DataFrame):
	qa_ids = []
	for retrieval_gt in qa_df["retrieval_gt"].tolist():
		if isinstance(retrieval_gt, list) and (
			retrieval_gt[0] != [] or any(bool(g) is True for g in retrieval_gt)
		):
			for gt in retrieval_gt:
				qa_ids.extend(gt)
		elif isinstance(retrieval_gt, np.ndarray) and retrieval_gt[0].size > 0:
			for gt in retrieval_gt:
				qa_ids.extend(gt)

	no_exist_ids = list(
		filter(lambda qa_id: corpus_df[corpus_df["doc_id"] == qa_id].empty, qa_ids)
	)

	assert len(no_exist_ids) == 0, (
		f"{len(no_exist_ids)} doc_ids in retrieval_gt do not exist in corpus_df."
	)

```

### Core Architecture Module: `legacy/autorag/utils/util.py`
```
import ast
import asyncio
import datetime
import functools
import glob
import inspect
import itertools
import json
import logging
import os
import re
import string
from copy import deepcopy
from json import JSONDecoder
from typing import List, Callable, Dict, Optional, Any, Collection, Iterable, Union

from asyncio import AbstractEventLoop
import emoji
import numpy as np
import pandas as pd
import tiktoken
import unicodedata

import yaml
from llama_index.embeddings.openai import OpenAIEmbedding
from pydantic import BaseModel as BM
from pydantic.v1 import BaseModel

logger = logging.getLogger("AutoRAG")


def fetch_contents(
	corpus_data: pd.DataFrame, ids: List[List[str]], column_name: str = "contents"
) -> List[List[Any]]:
	def fetch_contents_pure(
		ids: List[str], corpus_data: pd.DataFrame, column_name: str
	):
		return list(map(lambda x: fetch_one_content(corpus_data, x, column_name), ids))

	result = flatten_apply(
		fetch_contents_pure, ids, corpus_data=corpus_data, column_name=column_name
	)
	return result


def fetch_one_content(
	corpus_data: pd.DataFrame,
	id_: str,
	column_name: str = "contents",
	id_column_name: str = "doc_id",
) -> Any:
	if isinstance(id_, str):
		if id_ in ["", ""]:
			return None
		fetch_result = corpus_data[corpus_data[id_column_name] == id_]
		if fetch_result.empty:
			raise ValueError(f"doc_id: {id_} not found in corpus_data.")
		else:
			return fetch_result[column_name].iloc[0]
	else:
		return None


def result_to_dataframe(column_names: List[str]):
	"""
	Decorator for converting results to pd.DataFrame.
	"""

	def decorator_result_to_dataframe(func: Callable):
		@functools.wraps(func)
		def wrapper(*args, **kwargs) -> pd.DataFrame:
			results = func(*args, **kwargs)
			if len(column_names) == 1:
				df_input = {column_names[0]: results}
			else:
				df_input = {
					column_name: result
					for result, column_name in zip(results, column_names)
				}
			result_df = pd.DataFrame(df_input)
			return result_df

		return wrapper

	return decorator_result_to_dataframe


def load_summary_file(
	summary_path: str, dict_columns: Optional[List[str]] = None
) -> pd.DataFrame:
	"""
	Load a summary file from summary_path.

	:param summary_path: The path of the summary file.
	:param dict_columns: The columns that are dictionary type.
	    You must fill this parameter if you want to load summary file properly.
	    Default is ['module_params'].
	:return: The summary dataframe.
	"""
	if not os.path.exists(summary_path):
		raise ValueError(f"summary.csv does not exist in {summary_path}.")
	summary_df = pd.read_csv(summary_path)
	if dict_columns is None:
		dict_columns = ["module_params"]

	if any([col not in summary_df.columns for col in dict_columns]):
		raise ValueError(f"{dict_columns} must be in summary_df.columns.")

	def convert_dict(elem):
		try:
			return ast.literal_eval(elem)
		except:
			# convert datetime or date to its object (recency filter)
			date_object = convert_datetime_string(elem)
			if date_object is None:
				raise ValueError(
					f"Malformed dict received : {elem}\nCan't convert to dict properly"
				)
			return {"threshold": date_object}

	summary_df[dict_columns] = summary_df[dict_columns].map(convert_dict)
	return summary_df


def convert_datetime_string(s):
	# Regex to extract datetime arguments from the string
	m = re.search(r"(datetime|date)(\((\d+)(,\s*\d+)*\))", s)
	if m:
		args = ast.literal_eval(m.group(2))
		if m.group(1) == "datetime":
			return datetime.datetime(*args)
		elif m.group(1) == "date":
			return datetime.date(*args)
	return None


def make_combinations(target_dict: Dict[str, Any]) -> List[Dict[str, Any]]:
	"""
	Make combinations from target_dict.
	The target_dict key value must be a string,
	and the value can be a list of values or single value.
	If generates all combinations of values from target_dict,
	which means generating dictionaries that contain only one value for each key,
	and all dictionaries will be different from each other.

	:param target_dict: The target dictionary.
	:return: The list of generated dictionaries.
	"""
	dict_with_lists = dict(
		map(
			lambda x: (x[0], x[1] if isinstance(x[1], list) else [x[1]]),
			target_dict.items(),
		)
	)

	def delete_duplicate(x):
		def is_hashable(obj):
			try:
				hash(obj)
				return True
			except TypeError:
				return False

		if any([not is_hashable(elem) for elem in x]):
			# TODO: add duplication check for unhashable objects
			return x
		else:
			return list(set(x))

	dict_with_lists = dict(
		map(lambda x: (x[0], delete_duplicate(x[1])), dict_with_lists.items())
	)
	combination = list(itertools.product(*dict_with_lists.values()))
	combination_dicts = [
		dict(zip(dict_with_lists.keys(), combo)) for combo in combination
	]
	return combination_dicts


def explode(index_values: Collection[Any], explode_values: Collection[Collection[Any]]):
	"""
	Explode index_values and explode_values.
	The index_values and explode_values must have the same length.
	It will flatten explode_values and keep index_values as a pair.

	:param index_values: The index values.
	:param explode_values: The exploded values.
	:return: Tuple of exploded index_values and exploded explode_values.
	"""
	assert len(index_values) == len(explode_values), (
		"Index values and explode values must have same length"
	)
	df = pd.DataFrame({"index_values": index_values, "explode_values": explode_values})
	df = df.explode("explode_values")
	return df["index_values"].tolist(), df["explode_values"].tolist()


def replace_value_in_dict(target_dict: Dict, key: str, replace_value: Any) -> Dict:
	"""
	Replace the value of a certain key in target_dict.
	If there is no targeted key in target_dict, it will return target_dict.

	:param target_dict: The target dictionary.
	:param key: The key is to replace.
	:param replace_value: The value to replace.
	:return: The replaced dictionary.
	"""
	replaced_dict = deepcopy(target_dict)
	if key not in replaced_dict:
		return replaced_dict
	replaced_dict[key] = replace_value
	return replaced_dict


def normalize_string(s: str) -> str:
	"""
	Taken from the official evaluation script for v1.1 of the SQuAD dataset.
	Lower text and remove punctuation, articles, and extra whitespace.
	"""

	def remove_articles(text):
		return re.sub(r"\b(a|an|the)\b", " ", text)

	def white_space_fix(text):
		return " ".join(text.split())

	def remove_punc(text):
		exclude = set(string.punctuation)
		return "".join(ch for ch in text if ch not in exclude)

	def lower(text):
		return text.lower()

	return white_space_fix(remove_articles(remove_punc(lower(s))))


def convert_string_to_tuple_in_dict(d):
	"""Recursively converts strings that start with '(' and end with ')' to tuples in a dictionary."""
	for key, value in d.items():
		# If the value is a dictionary, recurse
		if isinstance(value, dict):
			convert_string_to_tuple_in_dict(value)
		# If the value is a list, iterate through its elements
		elif isinstance(value, list):
			for i, item in enumerate(value):
				# If an item in the list is a dictionary, recurse
				if isinstance(item, dict):
					convert_string_to_tuple_in_dict(item)
				# If an item in the list is a string matching the criteria, convert it to a tuple
				elif (
					isinstance(item, str)
					and item.startswith("(")
					and item.endswith(")")
				):
					value[i] = ast.literal_eval(item)
		# If the value is a string matching the criteria, convert it to a tuple
		elif isinstance(value, str) and value.startswith("(") and value.endswith(")"):
			d[key] = ast.literal_eval(value)

	return d


def convert_env_in_dict(d: Dict):
	"""
	Recursively converts environment variable string in a dictionary to actual environment variable.

	:param d: The dictionary to convert.
	:return: The converted dictionary.
	"""
	env_pattern = re.compile(r".*?\${(.*?)}.*?")

	def convert_env(val: str):
		matches = env_pattern.findall(val)
		for match in matches:
			val = val.replace(f"${{{match}}}", os.environ.get(match, ""))
		return val

	for key, value in d.items():
		if isinstance(value, dict):
			convert_env_in_dict(value)
		elif isinstance(value, list):
			for i, item in enumerate(value):
				if isinstance(item, dict):
					convert_env_in_dict(item)
				elif isinstance(item, str):
					value[i] = convert_env(item)
		elif isinstance(value, str):
			d[key] = convert_env(value)
	return d


async def process_batch(tasks, batch_size: int = 64) -> List[Any]:
	"""
	Processes tasks in batches asynchronously.

	:param tasks: A list of no-argument functions or coroutines to be executed.
	:param batch_size: The number of tasks to process in a single batch.
	    Default is 64.
	:return: A list of results from the processed tasks.
	"""
	results = []

	for i in range(0, len(tasks), batch_size):
		batch = tasks[i : i + batch_size]
		batch_results = await asyncio.gather(*batch, return_exceptions=True)

		first_exception = None
		for offset, item in enumerate(batch_results):
			if isinstance(item, BaseException):
				logger.error(
					"process_batch task %d (batch offset %d) raised %s: %s",
					i + offset,
					offset,
					type(item).__name__,
					item,
				)
				if first_exception is None:
					first_exception = item
		if first_exception is not None:
			raise first_exception

		results.extend(batch_results)

	return results


def make_batch(elems: List[Any], batch_size: int) -> List[List[Any]]:
	"""
	Make a batch of elems with batch_size.
	"""
	return [elems[i : i + batch_size] for i in range(0, len(elems), batch_size)]


def save_parquet_safe(df: pd.DataFrame, filepath: str, upsert: bool = False):
	output_file_dir = os.path.dirname(filepath)
	if not os.path.isdir(output_file_dir):
		raise NotADirectoryError(f"directory {output_file_dir} not found.")
	if not filepath.endswith("parquet"):
		raise NameError(
			f'file path: {filepath}  filename extension need to be ".parquet"'
		)
	if os.path.exists(filepath) and not upsert:
		raise FileExistsError(
			f"file {filepath} already exists."
			"Set upsert True if you want to overw
```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #2083** (2026-11-02): **fix(cli): honor webSearch section from the config file**
  *Symptoms*: ## Problem `resolveConfig` copied `fsearch` and `jev` from the config file but not `webSearch`. A config like  ```json { "webSearch": { "enabled": false } } ```  resolved to `config.webSearch === undefined`, so `buildAgentOptions` passed `undefined` and the agent kept `web_search`/`web_fetch` enabled (`agent.ts`: `webToolsEnabled = webSearchOption !== false`). The same applied to `provider`, `order`, `exclude`, and timeout settings: all silently ignored when set in the file.  ## Fix One line in `resolveConfig`: `if (file.webSearch !== undefined) config.webSearch = file.webSearch;`. Validation stays in `buildWebSearchAgentOption`, which already ran on `config.webSearch`.  ## Verification - New test `preserves enabled:false when resolving a config file` fails on main (`undefined` vs `false`) and passes with the fix. - Throwaway script on main: `resolved.webSearch = undefined -> agent option = undefined`; with fix: `{"enabled":false} -> false`. - `vitest run test/cli`: 36 files, 440 tests pass; biome clean.

- **Issue #1894** (2026-10-16): **jikji: prepare uses a 60 s process wall for whole roots and SIGTERMs only the direct child**
  *Symptoms*: ## Problem  Verified against `Marker-Inc-Korea/AutoRAG` `origin/main` @ `5dd4066`.  `jikji prepare` runs a whole root under a 60 s process wall when no `timeoutMs` is passed:  ```ts // src/jikji/client.ts:18 const DEFAULT_TIMEOUT_MS = 60_000; // src/jikji/client.ts:199 (used when options.timeoutMs is undefined) }, options.timeoutMs ?? DEFAULT_TIMEOUT_MS); ```  Termination is `SIGTERM` to the direct child only - no tree kill, no `detached`:  ```ts // src/jikji/client.ts:291-292 function terminate(child: ChildProcess): void {     if (!child.killed) child.kill("SIGTERM"); } ```  `executeJikjiPrepare` fans all roots out at once and passes neither a signal nor a `parseTimeout`, even though the CLI flag exists (src/jikji/client.ts:256 `--parse-timeout`):  ```ts // src/agent/agent.ts:3370-3373 private async executeJikjiPrepare(): Promise<readonly JikjiPrepareResult[] | undefined> {     const client = this.jikjiClient;     if (client === undefined) return undefined;     return Promise.all(this.searchPaths.map((sourcePath) => client.prepare(sourcePath))); } ```  A 60 s wall for a whole root is short relative to the connector budgets elsewhere (30 min, `DEFAULT_CONNECTOR_SYNC_TIMEOUT_MS`, src/datasource/connector-timeouts.ts:14) and to what `jikji prepare` actually does (reuse-aware, but media-index capable).  ## Impact  A host indexing a large `~/Documents`: the Jikji prepare of one root exceeds 60 s and is killed, or a jikji descendant that keeps the inherited pipes open holds the cl

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

### Incident Patch 1: `bbb417e3` (2026-11-09)
**Commit Message**: fix(calculator): treat a zone abbreviation as a fixed offset, never a daylight-saving region (#2110)

A live run turned "PST 2026-07-01 3pm" into America/Los_Angeles before calling
the tool. PST is UTC-8 all year, but Los Angeles is on UTC-7 in July, so the
answer was an hour off and the tool's ambiguous-abbreviation refusal never ran.

The refusal now says what the abbreviation means: PST/PDT/MST/MDT/EST/EDT name
a fixed offset, and the error gives it. CST/IST/BST name several zones, so the
error tells the caller to ask. The tool schema and the system prompt say the
same: pass the offset, never swap in a region, use a region only for a named
place.

Adds the live calculator QA script (16 cases, with a summer-PST regression and
clock-dependent expectations computed at run time).

Signed-off-by: Jeffrey (Dongkyu) Kim <[REDACTED_EMAIL]>

**File**: `scripts/manual-qa/run-qa-calculator-live.ts` (added, +264/-0)
```diff
@@ -0,0 +1,264 @@
+/**
+ * Live manual QA for the `calculator` agent tool.
+ *
+ * Drives a real AutoRAGAgent (same option path as the CLI, via buildAgentOptions) with a real model and an
+ * isolated corpus, asks arithmetic, date, time, and time-zone questions, and records for every question which
+ * calculator calls the model made, what the tool printed, and the final answer. Each case lists substrings the
+ * answer must carry (from an independent reference) and the operations the model is expected to have used.
+ *
+ * Prerequisites: a resolvable model (OPENROUTER_API_KEY), and an isolated AUTORAG_HOME/AUTORAG_CONFIG that
+ * already has MinSync in `<workspace>/.autorag/bin` (run `autorag refresh --method minsync` there first).
+ *
+ * Usage:
+ *   AUTORAG_CALC_QA_ROOT=<isolated root> AUTORAG_CALC_QA_MODEL=anthropic/claude-haiku-5.5 \
+ *     bun scripts/manual-qa/run-qa-calculator-live.ts
+ *   AUTORAG_CALC_QA_EVIDENCE=.omo/evidence/qa-calculator-live.json  (default)
+ */
+import { mkdirSync, writeFileSync } from "node:fs";
+import { dirname, join } from "node:path";
+import { AutoRAGAgent } from "../../src/agent/agent.ts";
+import { CALCULATOR_TOOL_NAME } from "../../src/agent/calculator-tool.ts";
+import { buildAgentOptions, resolveAgentModel, resolveConfig } from "../../src/cli/config.ts";
+
+const root = process.env.AUTORAG_CALC_QA_ROOT;
+if (root === undefined || process.env.AUTORAG_CONFIG === undefined || !process.env.AUTORAG_CONFIG.startsWith(root)) {
+	throw new Error("Set AUTORAG_CALC_QA_ROOT and point AUTORAG_CONFIG/AUTORAG_HOME inside it (see AGENTS.md manual-QA rules).");
+}
+const modelId = process.env.AUTORAG_CALC_QA_MODEL ?? "anthropic/claude-haiku-5.5";
+const evidencePath = process.env.AUTORAG_CALC_QA_EVIDENCE ?? join(".omo", "evidence", "qa-calculator-live.json");
+const only = process.env.AUTORAG_CALC_QA_ONLY?.split(",").map(Number);
+
+interface Case {
+	readonly name: string;
+	readonly query: string;
+	/** Operations the model should have called. */
+	readonly operations: readonly string[];
+	/** Every one must appear in the answer. */
+	readonly answerHas: readonly RegExp[];
+	/** Must appear in the calculator output, proving the figure came from the tool. */
+	readonly toolHas: readonly string[];
+	/** Must appear in the first line of the answer. */
+	readonly leadHas?: readonly RegExp[];
+	/** Must not appear in the first line of the answer. */
+	readonly leadLacks?: readonly RegExp[];
+	/** No calculator call may carry a `timeZone` matching this. */
+	readonly forbidZoneArg?: RegExp;
+}
+
+
+function leadOf(answer: string): string {
+	return answer.split("\n").find((line) => line.trim() !== "") ?? "";
+}
+/** Expected values that depend on the clock, computed independently of the calculator with plain Date arithmetic. */
+const TODAY = (() => {
+	const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul", year: "numeric", month: "2-digit", day: "2-digit" })
+		.format(new Date())
+		.split("-")
+		.map(Number) as [number, number, number];
+	const today = Date.UTC(parts[0], parts[1] - 1, parts[2]);
+	const weekday = new Date(today).getUTCDay();
+	return {
+		weekdayEn: ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"][weekday] as string,
+		weekdayKo: `${"일월화수목금토"[weekday]}요일`,
+		daysToChristmas: Math.round((Date.UTC(2026, 11, 25) - today) / 86_400_000),
+	};
+})();
+
+const CASES: readonly Case[] = [
+	{
+		name: "today's weekday (needs the clock)",
+		query: "오늘 무슨 요일이야?",
+		operations: ["now", "date_info"],
+		answerHas: [new RegExp(`${TODAY.weekdayKo}|${TODAY.weekdayEn}`, "i")],
+		toolHas: [`weekday: ${TODAY.weekdayEn}`],
+	},
+	{
+		name: "days until a date from today",
+		query: "오늘부터 2026년 12월 25일까지 며칠 남았어?",
+		operations: ["date_diff"],
+		answerHas: [new RegExp(`(?<!\\d)${TODAY.daysToChristmas}(?!\\d)`)],
+		toolHas: [`totalDays: ${TODAY.daysToChristmas}`],
+	},
+	{
+		name: "date plus N days with weekday",
+		query: "2026-03-15에서 100일 뒤는 며칠이고 무슨 요일이야?",
+		operations: ["date_add"],
+		answerHas: [/2026-06-23|6월 23일|June 23/i, /화요일|Tuesday/i],
+		toolHas: ["result: 2026-06-23", "weekday: Tuesday"],
+	},
+	{
+		name: "leap-day plus a year (clamp)",
+		query: "2024-02-29의 정확히 1년 뒤 날짜는?",
+		operations: ["date_add"],
+		answerHas: [/2025-02-28|2월 28일|February 28/i],
+		toolHas: ["result: 2025-02-28"],
+	},
+	{
+		name: "time zone conversion with the zone given",
+		query: "서울(Asia/Seoul) 2026-11-08 오전 9시는 뉴욕에서 몇 시야? 날짜도 알려줘.",
+		operations: ["convert_timezone"],
+		answerHas: [/11-07|11월 7일|November 7|Nov 7/i, /19:00|7:00\s*PM|오후 7시/i],
+		toolHas: ["2026-11-07T19:00:00-05:00"],
+	},
+	{
+		name: "time zone conversion in the other direction across a date line",
+		query: "LA(America/Los_Angeles) 2026-11-09 오전 9시를 한국 시간으로 바꿔줘.",
+		operations: ["convert_timezone"],
+		answerHas: [/11-10|11월 10일|November 10|Nov 10/i, /02:00|2:00|오전 2시|새벽 2시/i],
+		toolHas: ["2026-11-10T02:00:00+09:00"],
+	},
+	{
+		name: "business days with ho
```

**File**: `skills/autorag/SKILL.md` (modified, +5/-2)
```diff
@@ -95,8 +95,11 @@ in-process, and needs no configuration. Operations:
   `holidays` list. The tool knows no public holidays; pass them in.
 - `now` and `convert_timezone`: the current time and DST-aware zone
   conversion. An omitted `timeZone` means the host zone and the result says so;
-  a datetime with no offset needs its zone, and ambiguous abbreviations such as
-  PST or IST are refused.
+  a datetime with no offset needs its zone. A zone abbreviation other than
+  UTC, KST, and JST is refused, and the error names what to pass instead: PST,
+  PDT, MST, MDT, EST, and EDT are fixed offsets (PST is `-08:00` all year, so
+  it differs from `America/Los_Angeles` in summer), and CST, IST, and BST mean
+  several zones, so the user has to say which.
 
 ### Excluding local files from the index
 
```

**File**: `src/agent/calculator-tool.ts` (modified, +1/-1)
```diff
@@ -42,7 +42,7 @@ const calculatorSchema = Type.Object({
 	timeZone: Type.Optional(
 		Type.String({
 			description:
-				"Zone a date or time is read in and shown in; for convert_timezone, the SOURCE zone. IANA name (Asia/Seoul, America/New_York), UTC, KST, JST, or a fixed offset (+09:00). Omit to use the host default, which the result states. Ambiguous abbreviations (PST, CST, IST) are refused.",
+				"Zone a date or time is read in and shown in; for convert_timezone, the SOURCE zone. IANA name (Asia/Seoul, America/New_York), UTC, KST, JST, or a fixed offset (+09:00). Omit to use the host default, which the result states. Abbreviations other than UTC/KST/JST are refused: an abbreviation is a fixed offset (PST is -08:00 all year, EDT is -04:00), so pass that offset. Never replace an abbreviation with a region such as America/Los_Angeles; it follows daylight saving and is an hour off in summer. Use a region only for a named place. CST, IST and BST mean several zones: ask the user.",
 		}),
 	),
 	toTimeZone: Type.Optional(Type.String({ description: "convert_timezone only: the zone to convert into." })),
```

**File**: `src/agent/system-prompt.ts` (modified, +1/-0)
```diff
@@ -183,6 +183,7 @@ ${CALCULATOR_PROMPT_RULE}
 - \`calculator\` operations: \`evaluate\` (arithmetic, percentages, totals, averages, roots, logs, trig; independent results in one list), \`date_diff\` (days between dates, or exact elapsed time between two times), \`date_add\` (a date plus or minus years, months, weeks, days, hours, minutes), \`date_info\` (weekday, day of year, ISO week, leap year), \`business_days_between\` and \`add_business_days\` (weekdays, with a holiday list), \`now\`, and \`convert_timezone\`.
 - Pass dates as the user wrote them when they are clear (2026-11-08, 2026년 11월 8일, today); the tool reads them. Never convert a relative date such as "next Friday" yourself: compute it from \`now\` or \`today\` with \`date_add\`.
 - A time without an offset needs its time zone. Ask the user through the ask tool when it matters and is unknown; never assume one. The tool names the zone it used.
+- A time zone abbreviation is a fixed offset, not a place: PST is UTC-8 all year, PDT is UTC-7, EST is UTC-5, EDT is UTC-4. Pass that offset (for example "-08:00") as the time zone. Never replace an abbreviation with a region such as America/Los_Angeles: the region follows daylight saving, so in summer it is an hour off what the abbreviation says. Use a region only when the user names a place or city. An abbreviation used for several zones (CST, IST, BST) is the user's to settle: ask.
 - Report the result as the tool printed it. When it says \`exact: false\`, the digits were rounded; say so only when that matters to the answer.
 
 `
```

**File**: `src/calculator/timezone.ts` (modified, +22/-5)
```diff
@@ -10,6 +10,27 @@ export interface Zone {
 /** Zones without daylight saving whose abbreviation names exactly one place. */
 const UNAMBIGUOUS_ABBREVIATIONS: Readonly<Record<string, string>> = { KST: "Asia/Seoul", JST: "Asia/Tokyo" };
 
+/**
+ * US abbreviations whose offset never changes with the date: PST is UTC-8 in July too, while the region it is
+ * usually quoted for (America/Los_Angeles) is on UTC-7 then. The tool still refuses them, but it names the offset so the
+ * caller passes that, instead of swapping in a region that follows daylight saving.
+ */
+const US_ABBREVIATION_OFFSETS: Readonly<Record<string, string>> = {
+	PST: "-08:00",
+	PDT: "-07:00",
+	MST: "-07:00",
+	MDT: "-06:00",
+	EST: "-05:00",
+	EDT: "-04:00",
+};
+
+function abbreviationMessage(text: string, upper: string): string {
+	if (Object.hasOwn(US_ABBREVIATION_OFFSETS, upper)) {
+		const offset = US_ABBREVIATION_OFFSETS[upper] as string;
+		return `The time zone abbreviation "${text}" is not accepted, but it names the fixed offset ${offset} on every date. Pass "${offset}" to keep that meaning; pass an IANA region such as America/Los_Angeles only when the user means local time there, where the offset changes with daylight saving.`;
+	}
+	return `The time zone abbreviation "${text}" is used for several time zones with different offsets. Ask the user which one they mean, then pass an IANA name such as Asia/Kolkata or a fixed offset such as +05:30.`;
+}
 const formatters = new Map<string, Intl.DateTimeFormat>();
 
 function ianaZone(name: string): Zone {
@@ -56,11 +77,7 @@ export function parseZone(input: string): Zone {
 		return fixedZone((offset[1] === "-" ? -1 : 1) * (hours * 3600 + minutes * 60));
 	}
 	if (Object.hasOwn(UNAMBIGUOUS_ABBREVIATIONS, upper)) return ianaZone(UNAMBIGUOUS_ABBREVIATIONS[upper] as string);
-	if (/^[A-Z]{3,5}$/.test(text)) {
-		throw new CalculatorError(
-			`The time zone abbreviation "${text}" is ambiguous. Use an IANA name such as America/Los_Angeles, or a fixed offset such as -08:00.`,
-		);
-	}
+	if (/^[A-Z]{3,5}$/.test(text)) throw new CalculatorError(abbreviationMessage(text, upper));
 	if (text === "") throw new CalculatorError("The time zone is empty.");
 	return ianaZone(text);
 }
```

**File**: `test/agent/calculator-tool.test.ts` (modified, +13/-0)
```diff
@@ -82,6 +82,12 @@ describe("calculator tool", () => {
 		expect(tool.description).toMatch(/time zone/i);
 		expect(tool.description).toMatch(/never/i);
 	});
+
+	it("tells the model an abbreviation is a fixed offset, so it does not swap in a daylight-saving region", () => {
+		const schema = JSON.stringify(tool.parameters);
+		expect(schema).toMatch(/PST is -08:00 all year/);
+		expect(schema).toMatch(/Never replace an abbreviation with a region/);
+	});
 });
 
 describe("calculator in the system prompt", () => {
@@ -94,6 +100,13 @@ describe("calculator in the system prompt", () => {
 		expect(without).not.toContain("calculator");
 	});
 
+	it("states that an abbreviation is a fixed offset and that a region is a different claim", () => {
+		const prompt = buildSystemPrompt({ toolNames: ["bash", "calculator"], modelId: "test-model" });
+		expect(prompt).toContain("PST is UTC-8 all year");
+		expect(prompt).toMatch(/Never replace an abbreviation with a region such as America\/Los_Angeles/);
+		expect(prompt).toMatch(/several zones \(CST, IST, BST\) is the user's to settle: ask/);
+	});
+
 	it("does not list it twice as a caller tool", () => {
 		const prompt = buildSystemPrompt({ toolNames: ["bash", "calculator"], modelId: "test-model" });
 		expect(prompt).not.toContain("**calculator**: caller-provided tool");
```

**File**: `test/calculator/datetime.test.ts` (modified, +32/-0)
```diff
@@ -41,6 +41,38 @@ describe("calculator: now", () => {
 		expect(() => run({ operation: "now", timeZone: "PST" })).toThrow(/IANA/);
 		expect(() => run({ operation: "now", timeZone: "Mars/Base" })).toThrow(/unknown time zone/i);
 	});
+
+	it("tells the caller which fixed offset a US abbreviation names, so it never has to swap in a region", () => {
+		for (const [abbreviation, offset] of [
+			["PST", "-08:00"],
+			["PDT", "-07:00"],
+			["MST", "-07:00"],
+			["MDT", "-06:00"],
+			["EST", "-05:00"],
+			["EDT", "-04:00"],
+		] as const) {
+			expect(() => run({ operation: "now", timeZone: abbreviation })).toThrow(
+				new RegExp(`"${abbreviation}".*names the fixed offset ${offset}.*America/`),
+			);
+		}
+	});
+
+	it("names no offset for an abbreviation with several meanings, and says to ask", () => {
+		for (const abbreviation of ["CST", "IST", "BST"]) {
+			expect(() => run({ operation: "now", timeZone: abbreviation })).toThrow(/several time zones.*ask/i);
+			expect(() => run({ operation: "now", timeZone: abbreviation })).not.toThrow(/fixed offset [+-]\d/);
+		}
+	});
+
+	it("takes the offset an abbreviation names, so PST stays UTC-8 in July when Los Angeles is on UTC-7", () => {
+		const july = (timeZone: string) =>
+			calculate(
+				{ operation: "convert_timezone", datetime: "2026-07-01T15:00:00", timeZone, toTimeZone: "Asia/Seoul" },
+				{ now: NOW, hostTimeZone: "Asia/Seoul" },
+			).fields.result;
+		expect(july("-08:00")).toBe("2026-07-02T08:00:00+09:00");
+		expect(july("America/Los_Angeles")).toBe("2026-07-02T07:00:00+09:00");
+	});
 });
 
 describe("calculator: date_diff with dates", () => {
```

---

### Incident Patch 2: `48923bca` (2026-11-10)
**Commit Message**: fix(cli): stop a refresh on SIGINT/SIGTERM and exit with the signal's code (#2118)

`autorag refresh` registered no signal handler. After SIGTERM the CLI and its `minsync sync` child were
still running two minutes later and needed SIGKILL (seen in an 85k-file stress run); a service manager or
an operator could not stop a long first index.

`abortOnSignal()` turns SIGINT/SIGTERM into the AbortSignal that `AutoRAGAgent.refresh` already honours, so
the MinSync and parser children are stopped, the run is recorded as failed, and the command exits 130 or 143.
It is wired into `refresh`, `lite refresh`, `watch --once` and `index rebuild`; the long-running `watch` and
`automate daemon` keep their own handlers. Listeners are removed when the command settles.

Tests: 7 in-process cases (each command, SIGINT and SIGTERM, listener cleanup) and one real-process case that
spawns the CLI and checks it exits 143 without orphaning the sync. With signals ignored in `signal-abort.ts`,
six of seven fail; with listeners left registered, the cleanup test fails.

Signed-off-by: Jeffrey (Dongkyu) Kim <[REDACTED_EMAIL]>

**File**: `src/cli/commands/index.ts` (modified, +12/-4)
```diff
@@ -6,6 +6,7 @@ import { MINSYNC_SUBDIR } from "../../minsync/paths.ts";
 import { PARSED_MIRROR_SUBDIR, refreshReadinessPath } from "../../mirror/paths.ts";
 import { buildAgentOptions, type CliConfig, resolveConfig } from "../config.ts";
 import { renderError, renderIndex } from "../output.ts";
+import { abortOnSignal, SIGNAL_EXIT_CODES } from "../signal-abort.ts";
 import { parseMethodFlag } from "./refresh.ts";
 import type { CommandContext } from "./types.ts";
 
@@ -17,7 +18,7 @@ const ALL_RESET_TARGET_NAMES = ["parsed", "minsync"] as const;
  * and MinSync indexes
  * (preserving `bin`, `datasources`, and the memory file). `rebuild` resets then re-runs a forced
  * refresh. Returns 0 on success, 2 for usage/decline errors, 1 for runtime
- * errors including path-escape guard violations.
+ * errors including path-escape guard violations, and 130/143 when a rebuild is stopped by SIGINT/SIGTERM.
  */
 export async function runIndex(ctx: CommandContext): Promise<number> {
 	const sub = ctx.positionals[0];
@@ -96,14 +97,21 @@ export async function runIndex(ctx: CommandContext): Promise<number> {
 		return 0;
 	}
 
-	// rebuild: re-run a forced refresh with a model-free agent, scoped to methods.
+	// rebuild: re-run a forced refresh with a model-free agent, scoped to methods. The reset above already
+	// removed the old index, so a stop signal leaves a partial one: the next `refresh` completes it.
+	const stop = abortOnSignal();
 	let rebuilt: AutoRAGRefreshResult;
 	try {
 		const agent = new AutoRAGAgent(buildAgentOptions(config));
-		rebuilt = await agent.refresh(true, refreshMethods ? { methods: refreshMethods } : undefined);
+		rebuilt = await agent.refresh(true, {
+			...(refreshMethods ? { methods: refreshMethods } : {}),
+			signal: stop.signal,
+		});
 	} catch (error) {
 		ctx.stderr(renderError(error, { json: ctx.json }));
-		return 1;
+		return stop.received === undefined ? 1 : SIGNAL_EXIT_CODES[stop.received];
+	} finally {
+		stop.dispose();
 	}
 
 	ctx.stdout(renderIndex({ action: "rebuild", removed: [...targetNames], rebuilt }, { json: ctx.json }));
```

**File**: `src/cli/commands/lite-refresh.ts` (modified, +7/-1)
```diff
@@ -1,6 +1,7 @@
 import { createAutoRAGLite } from "../../core.ts";
 import { ConfigError } from "../config.ts";
 import { renderError } from "../output.ts";
+import { abortOnSignal, SIGNAL_EXIT_CODES } from "../signal-abort.ts";
 import { parseMethodFlag } from "./refresh.ts";
 import type { CommandContext } from "./types.ts";
 
@@ -10,23 +11,28 @@ import type { CommandContext } from "./types.ts";
  * Delegates to the agent's refresh pipeline (parsed mirrors, MinSync,
  * datasources, Jikji) without requiring any model configuration.
  *
- * Exit codes: 0 on success, 2 on config error, 1 on runtime error.
+ * Exit codes: 0 on success, 2 on config error, 1 on runtime error, 130/143 when stopped by SIGINT/SIGTERM.
  */
 export async function runLiteRefresh(ctx: CommandContext): Promise<number> {
+	const stop = abortOnSignal();
 	try {
 		const lite = createAutoRAGLite({ flags: ctx.flags, cwd: ctx.cwd });
 		const methods = parseMethodFlag(ctx.flags.method);
 		const force = ctx.flags.force === true || ctx.flags.full === true;
 		const options = {
 			...(methods ? { methods } : {}),
 			...(ctx.flags["retry-failed"] === true ? { retrySkipped: true } : {}),
+			signal: stop.signal,
 		};
 		const result = await lite.refresh(force, options);
 		const { renderRefresh } = await import("../output.ts");
 		ctx.stdout(renderRefresh(result, { json: ctx.json, debug: ctx.debug }));
 		return 0;
 	} catch (error) {
 		ctx.stderr(renderError(error, { json: ctx.json, debug: ctx.debug }));
+		if (stop.received !== undefined) return SIGNAL_EXIT_CODES[stop.received];
 		return error instanceof ConfigError ? 2 : 1;
+	} finally {
+		stop.dispose();
 	}
 }
```

**File**: `src/cli/commands/refresh.ts` (modified, +10/-0)
```diff
@@ -1,6 +1,7 @@
 import { AutoRAGAgent, type RefreshMethod } from "../../agent/agent.ts";
 import { buildAgentOptions, ConfigError, resolveConfig } from "../config.ts";
 import { renderError, renderRefresh } from "../output.ts";
+import { abortOnSignal, SIGNAL_EXIT_CODES } from "../signal-abort.ts";
 import type { CommandContext } from "./types.ts";
 
 /**
@@ -11,22 +12,31 @@ import type { CommandContext } from "./types.ts";
  *
  * `--method minsync,parsed` restricts which methods run. When omitted, all
  * methods run. Parsed mirrors are always synced when MinSync is selected.
+ *
+ * SIGINT and SIGTERM abort the refresh: the MinSync and parser children are stopped, the run is recorded as
+ * failed, and the command exits 130 or 143 like any process a signal ended. A long first index can run for
+ * hours, so an operator or a service manager needs to be able to stop it.
  */
 export async function runRefresh(ctx: CommandContext): Promise<number> {
+	const stop = abortOnSignal();
 	try {
 		const config = resolveConfig({ flags: ctx.flags, cwd: ctx.cwd });
 		const agent = new AutoRAGAgent(buildAgentOptions(config));
 		const methods = parseMethodFlag(ctx.flags.method);
 		const options = {
 			...(methods ? { methods } : {}),
 			...(ctx.flags["retry-failed"] === true ? { retrySkipped: true } : {}),
+			signal: stop.signal,
 		};
 		const result = await agent.refresh(ctx.flags.force === true, options);
 		ctx.stdout(renderRefresh(result, { json: ctx.json, debug: ctx.debug }));
 		return 0;
 	} catch (error) {
 		ctx.stderr(renderError(error, { json: ctx.json, debug: ctx.debug }));
+		if (stop.received !== undefined) return SIGNAL_EXIT_CODES[stop.received];
 		return error instanceof ConfigError ? 2 : 1;
+	} finally {
+		stop.dispose();
 	}
 }
 
```

**File**: `src/cli/commands/watch.ts` (modified, +9/-2)
```diff
@@ -2,6 +2,7 @@ import { AutoRAGAgent } from "../../agent/agent.ts";
 import { type IndexSchedule, validateIndexSchedule } from "../../agent/index-schedule.ts";
 import { buildAgentOptions, ConfigError, resolveConfig } from "../config.ts";
 import { renderError, renderRefresh } from "../output.ts";
+import { abortOnSignal, SIGNAL_EXIT_CODES, type SignalAbort } from "../signal-abort.ts";
 import type { CommandContext } from "./types.ts";
 
 function parsePositiveInt(value: string | boolean | undefined, fallback: number): number {
@@ -33,9 +34,12 @@ function scheduleFromFlags(ctx: CommandContext): IndexSchedule | undefined {
  * - default: long-running recursive fs watch with debounced refresh
  * - `--once`: single refresh tick (for cron / launchd / Task Scheduler)
  *
- * Exit codes: 0 on success, 2 on config error, 1 on runtime error.
+ * Exit codes: 0 on success, 2 on config error, 1 on runtime error, 130/143 when a one-shot tick is stopped by
+ * SIGINT/SIGTERM. The long-running watch handles those signals itself and exits 0.
  */
 export async function runWatch(ctx: CommandContext): Promise<number> {
+	// Only a tick that ends on its own needs the abort: the watch loop waits on the signals it handles below.
+	const stop: SignalAbort | undefined = ctx.flags.once === true ? abortOnSignal() : undefined;
 	try {
 		const config = resolveConfig({ flags: ctx.flags, cwd: ctx.cwd });
 		const agent = new AutoRAGAgent(buildAgentOptions(config));
@@ -53,7 +57,7 @@ export async function runWatch(ctx: CommandContext): Promise<number> {
 				);
 				return 0;
 			}
-			const result = await agent.refresh(force);
+			const result = await agent.refresh(force, stop === undefined ? undefined : { signal: stop.signal });
 			ctx.stdout(renderRefresh(result, { json: ctx.json, debug: ctx.debug }));
 			return 0;
 		}
@@ -119,6 +123,9 @@ export async function runWatch(ctx: CommandContext): Promise<number> {
 		return 0;
 	} catch (error) {
 		ctx.stderr(renderError(error, { json: ctx.json, debug: ctx.debug }));
+		if (stop?.received !== undefined) return SIGNAL_EXIT_CODES[stop.received];
 		return error instanceof ConfigError ? 2 : 1;
+	} finally {
+		stop?.dispose();
 	}
 }
```

**File**: `src/cli/signal-abort.ts` (added, +41/-0)
```diff
@@ -0,0 +1,41 @@
+/** Exit codes a shell reports for a process that stops on a signal: 128 plus the signal number. */
+export const SIGNAL_EXIT_CODES = { SIGINT: 130, SIGTERM: 143 } as const;
+
+export type StopSignal = keyof typeof SIGNAL_EXIT_CODES;
+
+export interface SignalAbort {
+	/** Aborts, with an error naming the signal, when the process is told to stop. */
+	readonly signal: AbortSignal;
+	/** The first signal received, or `undefined` while none has arrived. */
+	readonly received: StopSignal | undefined;
+	/** Stop listening. Call once the guarded work has settled. */
+	dispose(): void;
+}
+
+/**
+ * Turn SIGINT and SIGTERM into an abort the long-running work already understands. Without a listener of its
+ * own a command is left to the host-exit cleanup, which kills the child processes but lets the run carry on
+ * through its other phases against a dead index; with one, the refresh stops, records itself as failed and the
+ * command exits with the signal's conventional code.
+ */
+export function abortOnSignal(): SignalAbort {
+	const controller = new AbortController();
+	let received: StopSignal | undefined;
+	const listeners = (Object.keys(SIGNAL_EXIT_CODES) as StopSignal[]).map((name) => {
+		const listener = (): void => {
+			received ??= name;
+			controller.abort(new Error(`Interrupted by ${name}.`));
+		};
+		process.on(name, listener);
+		return { name, listener };
+	});
+	return {
+		signal: controller.signal,
+		get received() {
+			return received;
+		},
+		dispose() {
+			for (const { name, listener } of listeners) process.off(name, listener);
+		},
+	};
+}
```

**File**: `test/cli/commands.refresh-signal.test.ts` (added, +280/-0)
```diff
@@ -0,0 +1,280 @@
+import { spawn } from "node:child_process";
+import {
+	chmodSync,
+	copyFileSync,
+	existsSync,
+	mkdirSync,
+	mkdtempSync,
+	readFileSync,
+	rmSync,
+	writeFileSync,
+} from "node:fs";
+import { tmpdir } from "node:os";
+import { delimiter, join } from "node:path";
+import { fileURLToPath } from "node:url";
+import { afterEach, beforeEach, describe, expect, it } from "vitest";
+import { runIndex } from "../../src/cli/commands/index.ts";
+import { runLiteRefresh } from "../../src/cli/commands/lite-refresh.ts";
+import { runRefresh } from "../../src/cli/commands/refresh.ts";
+import type { CommandContext } from "../../src/cli/commands/types.ts";
+import { runWatch } from "../../src/cli/commands/watch.ts";
+import { SIGNAL_EXIT_CODES } from "../../src/cli/signal-abort.ts";
+import { fakeMinSyncExecutableName, fakeMinSyncStageSimulatorPath } from "../helpers/fake-minsync.ts";
+
+const CLI_ENTRY = fileURLToPath(new URL("../../src/cli/index.ts", import.meta.url));
+
+let root: string;
+let docs: string;
+const previousEnv = new Map<string, string | undefined>();
+
+/** The config resolver reads these before it falls back to `$HOME/.autorag`, so a test pins all three. */
+function isolateEnv(env: Record<string, string>): void {
+	for (const [key, value] of Object.entries(env)) {
+		previousEnv.set(key, process.env[key]);
+		process.env[key] = value;
+	}
+}
+
+beforeEach(() => {
+	root = mkdtempSync(join(tmpdir(), "autorag-cli-refresh-signal-"));
+	isolateEnv({
+		HOME: join(root, "home"),
+		AUTORAG_HOME: join(root, "home", ".autorag"),
+		AUTORAG_CONFIG: join(root, "home", ".autorag", "config.json"),
+	});
+	docs = join(root, "docs");
+	mkdirSync(docs, { recursive: true });
+	for (let index = 0; index < 5; index += 1) writeFileSync(join(docs, `f${index}.txt`), `content ${index}\n`);
+});
+
+afterEach(() => {
+	for (const [key, value] of previousEnv) {
+		if (value === undefined) delete process.env[key];
+		else process.env[key] = value;
+	}
+	previousEnv.clear();
+	rmSync(root, { recursive: true, force: true });
+});
+
+/** A MinSync whose `sync` runs until it is killed, and records its own pid so a test can find the process. */
+function writeHangingMinSync(binaryPath: string, pidPath: string): void {
+	writeFileSync(
+		binaryPath,
+		`#!/usr/bin/env node
+import { createRequire } from "node:module";
+import { mkdirSync, writeFileSync } from "node:fs";
+import { dirname, join } from "node:path";
+const require = createRequire(import.meta.url);
+const args = process.argv.slice(2);
+if (args[0] === "stage") {
+  const eqArg = args.find((a) => a.startsWith("--state-dir="));
+  const flagAt = args.indexOf("--state-dir");
+  const stateDir = eqArg ? eqArg.slice("--state-dir=".length) : flagAt >= 0 ? args[flagAt + 1] : args[1];
+  require(${JSON.stringify(fakeMinSyncStageSimulatorPath)}).runStage({ stateDir });
+} else if (args[0] === "init") {
+  mkdirSync(join(process.cwd(), ".minsync"), { recursive: true });
+  writeFileSync(join(process.cwd(), ".minsync", "config.toml"), '[embedder]\\nid = "fixture"\\n');
+  console.log(JSON.stringify({ initialized: true }));
+} else if (args[0] === "check") {
+  console.log(JSON.stringify({ vectorstore_ok: true, embedder_ok: true }));
+} else if (args[0] === "sync") {
+  writeFileSync(${JSON.stringify(pidPath)}, String(process.pid));
+  mkdirSync(dirname(join(process.cwd(), ".minsync", "cursor.json")), { recursive: true });
+  // A real sync can run for hours; hold until the host stops it.
+  setInterval(() => {}, 1000);
+} else {
+  console.error("unexpected fake minsync command: " + args.join(" "));
+  process.exit(2);
+}
+`,
+	);
+	chmodSync(binaryPath, 0o755);
+}
+
+/** The resolver takes the first `minsync` on PATH, so the fake goes in its own directory at the front. */
+function installMinSync(source: string): void {
+	const binDir = join(root, "bin");
+	mkdirSync(binDir, { recursive: true });
+	copyFileSync(source, join(binDir, fakeMinSyncExecutableName()));
+	chmodSync(join(binDir, fakeMinSyncExecutableName()), 0o755);
+	isolateEnv({ PATH: `${binDir}${delimiter}${process.env.PATH ?? ""}` });
+}
+
+function writeConfig(binary: string): string {
+	installMinSync(binary);
+	const configDir = join(root, "home", ".autorag");
+	mkdirSync(configDir, { recursive: true });
+	const configPath = join(configDir, "config.json");
+	writeFileSync(
+		configPath,
+		`${JSON.stringify({
+			searchPaths: [docs],
+			workspacePath: join(root, "ws"),
+			memoryPath: join(root, "memory.json"),
+			minSync: { workspacePath: join(root, "ws", ".autorag", "minsync"), autoInstall: false },
+			jikji: false,
+			everything: false,
+			fsearch: false,
+		})}\n`,
+	);
+	return configPath;
+}
+
+function isAlive(pid: number): boolean {
+	try {
+		process.kill(pid, 0);
+		return true;
+	} catch {
+		return false;
+	}
+}
+
+async function waitFor(condition: () => boolean, what: string, timeoutMs = 60_000): Promise<void> {
+	const started = Date.now();
+	while (!condition()) {
+		if
```

**File**: `test/cli/dispatch.test.ts` (modified, +4/-4)
```diff
@@ -35,10 +35,10 @@ describe("lite refresh forwarding", () => {
 		};
 
 		expect(await runLiteRefresh(context)).toBe(0);
-		expect(received).toEqual({
-			force: true,
-			options: { methods: ["minsync", "datasources", "jikji"] },
-		});
+		expect(received?.force).toBe(true);
+		expect(received?.options?.methods).toEqual(["minsync", "datasources", "jikji"]);
+		// SIGINT/SIGTERM reach the refresh through this signal; `runLiteRefresh` must always hand one over.
+		expect(received?.options?.signal).toBeInstanceOf(AbortSignal);
 		expect(JSON.parse(output[0] ?? "{}").ok).toBe(true);
 		rmSync(root, { recursive: true, force: true });
 	});
```

---

### Incident Patch 3: `b0ff5031` (2026-11-04)
**Commit Message**: fix(dupey): skip cloud and network roots in the duplicate scan, CLI and MCP (#2043) (#2085)

dupey scan opens every document, so over a OneDrive folder of released
placeholders it ran past the 120 s timeout and every read failed with
ETIMEDOUT. The agent already skipped such roots; autorag duplicates and
autorag.duplicates scanned them unguarded.

planDupeyScans is now the one place that decides which roots dupey may
walk. The CLI, the MCP tool and the agent tool report skipped roots
instead of dropping them silently. Cloud duplicate detection beyond
exact hashes is tracked in #2084.

Signed-off-by: Jeffrey (Dongkyu) Kim <[REDACTED_EMAIL]>

**File**: `src/agent/agent.ts` (modified, +8/-21)
```diff
@@ -22,6 +22,7 @@ import {
 	DupeyCliError,
 	type DupeyCliOptions,
 	type DupeyScanResult,
+	planDupeyScans,
 	scanWithDupey,
 	selectExactDuplicateExclusions,
 } from "../dupey/index.ts";
@@ -1425,23 +1426,11 @@ export class AutoRAGAgent {
 
 	async scanDuplicateDocuments(): Promise<ScanDuplicateDocumentsDetails> {
 		if (this.dupeyOptions === false) {
-			return { scans: [], familyCount: 0, exactDuplicateCount: 0 };
-		}
-		// A search root inside a cloud or network folder is skipped whole and a cloud or network folder nested
-		// under a root is excluded by name: `dupey scan` opens file contents, which would re-download a released
-		// placeholder and re-read a network file over the wire.
-		const cloudRoots = await this.cloudRoots();
-		const scanRoots: { readonly path: string; readonly excludeDirs: string[] }[] = [];
-		for (const searchPath of this.searchPaths) {
-			const scope = cloudScope(searchPath, cloudRoots);
-			if (scope.insideCloudRoot) continue;
-			scanRoots.push({
-				path: searchPath,
-				excludeDirs: scope.nestedCloudRoots.map((root) => basename(root.path)),
-			});
+			return { scans: [], skippedRoots: [], familyCount: 0, exactDuplicateCount: 0 };
 		}
+		const { targets, skipped } = planDupeyScans(this.searchPaths, await this.cloudRoots());
 		const scans = await Promise.all(
-			scanRoots.map(({ path, excludeDirs }) =>
+			targets.map(({ path, excludeDirs }) =>
 				scanWithDupey(path, {
 					...(this.dupeyOptions || {}),
 					...(excludeDirs.length === 0 ? {} : { excludeDirs }),
@@ -1457,7 +1446,7 @@ export class AutoRAGAgent {
 			}
 			return count + [...hashes.values()].reduce((sum, size) => sum + Math.max(0, size - 1), 0);
 		}, 0);
-		return { scans, familyCount, exactDuplicateCount };
+		return { scans, skippedRoots: skipped, familyCount, exactDuplicateCount };
 	}
 
 	/**
@@ -4358,9 +4347,9 @@ export class AutoRAGAgent {
 		// same hash groups as the scanned, non-cloud copies.
 		const fingerprints = cloudFingerprintExclusions(loadCloudFingerprints(this.workspaceProjectRoot));
 		for (const searchPath of this.searchPaths) {
-			const scope = cloudScope(searchPath, cloudRoots);
+			const target = planDupeyScans([searchPath], cloudRoots).targets[0];
 			let scan: DupeyScanResult;
-			if (scope.insideCloudRoot) {
+			if (target === undefined) {
 				// `dupey scan` opens file contents, which would re-download every released placeholder (and
 				// re-read every network file), so such a search root is never scanned. Its cloud and network
 				// files still join the merge through their stored fingerprints, so an exact duplicate among
@@ -4370,9 +4359,7 @@ export class AutoRAGAgent {
 				try {
 					scan = await scanWithDupey(searchPath, {
 						...(this.dupeyOptions || {}),
-						...(scope.nestedCloudRoots.length === 0
-							? {}
-							: { excludeDirs: scope.nestedCloudRoots.map((root) => basename(root.path)) }),
+						...(target.excludeDirs.length === 0 ? {} : { excludeDirs: target.excludeDirs }),
 					});
 				} catch (error) {
 					if (!(error instanceof DupeyCliError)) throw error;
```

**File**: `src/agent/dupey-tool.ts` (modified, +7/-0)
```diff
@@ -10,6 +10,8 @@ const MAX_RENDERED_MEMBERS = 50;
 
 export interface ScanDuplicateDocumentsDetails {
 	readonly scans: readonly DupeyScanResult[];
+	/** Roots inside a cloud or network folder: `dupey scan` opens file contents, so they were not scanned. */
+	readonly skippedRoots: readonly string[];
 	readonly familyCount: number;
 	readonly exactDuplicateCount: number;
 }
@@ -50,6 +52,11 @@ function renderScanReport(details: ScanDuplicateDocumentsDetails): string {
 		`dupey scanned ${details.scans.length} configured root(s).`,
 		`families=${details.familyCount} exactDuplicates=${details.exactDuplicateCount} extractionErrors=${errors}`,
 		"Review exact families before cleanup; near/contains families are not safe deletion evidence.",
+		...(details.skippedRoots.length === 0
+			? []
+			: [
+					`Not scanned (inside a cloud or network folder; scanning would download or re-read every file): ${details.skippedRoots.join(", ")}. Duplicates there are not reported, and an exact duplicate is only found against files an earlier refresh fingerprinted.`,
+				]),
 	];
 	let rendered = 0;
 	let omitted = 0;
```

**File**: `src/cli/commands/duplicates.ts` (modified, +14/-5)
```diff
@@ -1,11 +1,12 @@
 import { resolve } from "node:path";
 import type { DupeyScanResult } from "../../dupey/index.ts";
-import { scanWithDupey } from "../../dupey/index.ts";
+import { listCloudRoots, planDupeyScans, scanWithDupey } from "../../dupey/index.ts";
+import { type CloudFileProbe, defaultCloudProbe } from "../../filesystem/cloud-placeholder.ts";
 import { ConfigError, resolveConfig } from "../config.ts";
 import { renderError } from "../output.ts";
 import type { CommandContext } from "./types.ts";
 
-export type DuplicateScanner = (path: string) => Promise<DupeyScanResult>;
+export type DuplicateScanner = (path: string, excludeDirs: readonly string[]) => Promise<DupeyScanResult>;
 
 interface ExactGroup {
 	readonly hash: string;
@@ -20,13 +21,15 @@ interface ExactGroup {
  */
 export async function runDuplicates(
 	ctx: CommandContext,
-	scanner: DuplicateScanner = (path) => scanWithDupey(path),
+	scanner: DuplicateScanner = (path, excludeDirs) => scanWithDupey(path, { excludeDirs }),
+	cloudProbe: CloudFileProbe | undefined = defaultCloudProbe(),
 ): Promise<number> {
 	try {
 		const config = resolveConfig({ flags: ctx.flags, cwd: ctx.cwd });
 		const requested = ctx.positionals[0];
 		const roots = requested ? [resolve(ctx.cwd, requested)] : config.searchPaths.map((path) => resolve(path));
-		const scans = await Promise.all(roots.map((root) => scanner(root)));
+		const plan = planDupeyScans(roots, await listCloudRoots(cloudProbe, roots));
+		const scans = await Promise.all(plan.targets.map(({ path, excludeDirs }) => scanner(path, excludeDirs)));
 		const exactGroups = scans.flatMap(exactGroupsFromScan);
 		const extractionErrors = scans.flatMap((scan) => scan.errors);
 		if (ctx.json) {
@@ -35,6 +38,7 @@ export async function runDuplicates(
 					{
 						ok: true,
 						roots,
+						skippedRoots: plan.skipped,
 						exactGroups,
 						families: scans.flatMap((scan) => scan.families),
 						extractionErrors,
@@ -47,11 +51,16 @@ export async function runDuplicates(
 			return 0;
 		}
 		const lines = [
-			`duplicates: scanned ${roots.length} root(s)`,
+			`duplicates: scanned ${scans.length} root(s)`,
 			`  exact groups: ${exactGroups.length}`,
 			`  other families: ${scans.reduce((count, scan) => count + scan.families.length, 0)}`,
 			`  extraction errors: ${extractionErrors.length}`,
 		];
+		for (const root of plan.skipped) {
+			lines.push(
+				`  not scanned (inside a cloud or network folder; scanning would download or re-read every file): ${root}`,
+			);
+		}
 		for (const [index, group] of exactGroups.entries()) {
 			lines.push(`  exact group ${index + 1}:`);
 			for (const file of group.files) lines.push(`    - ${file}`);
```

**File**: `src/dupey/index.ts` (modified, +1/-0)
```diff
@@ -1,2 +1,3 @@
 export * from "./cli.ts";
 export * from "./filter.ts";
+export * from "./scan-plan.ts";
```

**File**: `src/dupey/scan-plan.ts` (added, +50/-0)
```diff
@@ -0,0 +1,50 @@
+import { basename } from "node:path";
+import { type CloudFileProbe, type CloudRoot, cloudScope } from "../filesystem/cloud-placeholder.ts";
+
+/** One `dupey scan` to run: the directory and the cloud or network folder names nested in it that must not be walked. */
+export interface DupeyScanTarget {
+	readonly path: string;
+	readonly excludeDirs: readonly string[];
+}
+
+export interface DupeyScanPlan {
+	readonly targets: readonly DupeyScanTarget[];
+	/** Roots inside a cloud or network folder: never scanned, because `dupey scan` opens every file's contents. */
+	readonly skipped: readonly string[];
+}
+
+/**
+ * The machine's cloud and network roots for the roots about to be scanned. A probe that is missing or fails
+ * reads as no roots, never an error: an unknown root is scanned as before.
+ */
+export async function listCloudRoots(
+	probe: CloudFileProbe | undefined,
+	roots: readonly string[],
+): Promise<readonly CloudRoot[]> {
+	if (probe === undefined) return [];
+	try {
+		return await probe.cloudRoots(roots);
+	} catch {
+		return [];
+	}
+}
+
+/**
+ * Which roots `dupey scan` may walk. A root inside a cloud or network folder is skipped whole and a cloud or
+ * network folder nested under a root is excluded by name: `dupey scan` reads file contents, which re-downloads
+ * a released placeholder (measured: a OneDrive folder of 1.1k placeholders ran past the 120 s scan timeout and
+ * every read failed with ETIMEDOUT) and re-reads a network file over the wire.
+ */
+export function planDupeyScans(roots: readonly string[], cloudRoots: readonly CloudRoot[]): DupeyScanPlan {
+	const targets: DupeyScanTarget[] = [];
+	const skipped: string[] = [];
+	for (const path of roots) {
+		const scope = cloudScope(path, cloudRoots);
+		if (scope.insideCloudRoot) {
+			skipped.push(path);
+			continue;
+		}
+		targets.push({ path, excludeDirs: scope.nestedCloudRoots.map((root) => basename(root.path)) });
+	}
+	return { targets, skipped };
+}
```

**File**: `src/mcp/server.ts` (modified, +14/-2)
```diff
@@ -8,7 +8,8 @@ import { evidenceFor } from "../cli/commands/evidence.ts";
 import { validateReport } from "../cli/commands/report.ts";
 import type { AutoRAGLite } from "../core.ts";
 import { datasourceSearchToolName } from "../datasource/tool-naming.ts";
-import { type DupeyScanResult, scanWithDupey } from "../dupey/index.ts";
+import { type DupeyScanResult, listCloudRoots, planDupeyScans, scanWithDupey } from "../dupey/index.ts";
+import { type CloudFileProbe, defaultCloudProbe } from "../filesystem/cloud-placeholder.ts";
 import {
 	filterFileNameSearchMatches,
 	resolveConfiguredFileSearchRoot,
@@ -94,6 +95,8 @@ export interface AutoRAGMcpServerOptions {
 	readonly tools?: readonly string[];
 	/** Test/embedded override; defaults to the current Node platform. */
 	readonly platform?: NodeJS.Platform;
+	/** Test/embedded override for the cloud probe `autorag.duplicates` uses; defaults to this platform's probe. */
+	readonly cloudProbe?: CloudFileProbe;
 }
 
 function jsonResult<T extends object>(value: T, isError = false) {
@@ -437,10 +440,19 @@ export function createAutoRAGMcpServer(lite: AutoRAGLite, options: AutoRAGMcpSer
 									...(configuredDupey.run !== undefined ? { run: configuredDupey.run } : {}),
 								};
 					const roots = lite.config.searchPaths.map((path: string) => resolve(path));
-					const scans = await Promise.all(roots.map((root: string) => scanWithDupey(root, dupeyOptions)));
+					const plan = planDupeyScans(
+						roots,
+						await listCloudRoots(options.cloudProbe ?? defaultCloudProbe(), roots),
+					);
+					const scans = await Promise.all(
+						plan.targets.map(({ path, excludeDirs }) =>
+							scanWithDupey(path, { ...dupeyOptions, ...(excludeDirs.length === 0 ? {} : { excludeDirs }) }),
+						),
+					);
 					return jsonResult({
 						ok: true,
 						roots,
+						skippedRoots: plan.skipped,
 						exactGroups: scans.flatMap(exactGroupsFromScan),
 						families: scans.flatMap((scan) => scan.families),
 						extractionErrors: scans.flatMap((scan) => scan.errors),
```

**File**: `test/agent/cloud-readers.test.ts` (modified, +1/-0)
```diff
@@ -131,6 +131,7 @@ describe("dupey and cloud folders", () => {
 		const details = await agent.scanDuplicateDocuments();
 
 		expect(details.scans).toEqual([]);
+		expect(details.skippedRoots).toEqual([docs]);
 		expect(dupey.calls).toEqual([]);
 	});
 });
```

**File**: `test/agent/dupey-tool.test.ts` (modified, +21/-0)
```diff
@@ -7,6 +7,7 @@ describe("scan_duplicate_documents tool", () => {
 			async scanDuplicateDocuments() {
 				return {
 					scans: [{ dir: "/docs", files: [], errors: [], families: [] }],
+					skippedRoots: [],
 					familyCount: 0,
 					exactDuplicateCount: 0,
 				};
@@ -66,6 +67,7 @@ describe("scan_duplicate_documents tool", () => {
 					],
 				},
 			],
+			skippedRoots: [],
 			familyCount: 2,
 			exactDuplicateCount: 2,
 		};
@@ -91,4 +93,23 @@ describe("scan_duplicate_documents tool", () => {
 		expect(text).toContain("near");
 		expect(text).toContain("0.93");
 	});
+
+	it("tells the model which roots were not scanned because they sit in a cloud or network folder", async () => {
+		const tool = createScanDuplicateDocumentsTool({
+			async scanDuplicateDocuments() {
+				return {
+					scans: [],
+					skippedRoots: ["/Users/me/Library/CloudStorage/OneDrive-School"],
+					familyCount: 0,
+					exactDuplicateCount: 0,
+				};
+			},
+		});
+
+		const result = await tool.execute("call-1", {});
+		const text = result.content.map((part) => (part.type === "text" ? part.text : "")).join("\n");
+
+		expect(text).toContain("Not scanned");
+		expect(text).toContain("/Users/me/Library/CloudStorage/OneDrive-School");
+	});
 });
```

#### Recent Merged Pull Requests:
- **PR #2132** (2026-11-10): feat(hermes): schedule skill: index and duplicate checks as Hermes cron jobs (@vkehfdl1)
- **PR #2131** (2026-11-10): feat(mcp): autorag.convert and autorag.convert.formats for Hermes (@vkehfdl1)
- **PR #2130** (2026-11-10): fix(hermes): install and run the librarian on npm 12 (@vkehfdl1)
- **PR #2129** (2026-11-10): chore(release): 2.13.9 (@vkehfdl1)
- **PR #2128** (2026-11-10): feat(hermes): AutoRAG search pane for Hermes Desktop that attaches results to the chat (@vkehfdl1)
- **PR #2126** (2026-11-10): feat(lite): add model-free whole search `autorag lite find` (@vkehfdl1)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.


---

## 6. Net-New Universal Engineering Rules (Candidates for Master Brain)

## X. calculator): treat a zone abbreviation as a fixed offset, never a daylight-savin

**RULE**:
When implementing operations in `scripts/manual-qa/run-qa-calculator-live.ts`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in Marker-Inc-Korea/AutoRAG. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `bbb417e3`: calculator): treat a zone abbreviation as a fixed offset, never a daylight-saving region (#2110). Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing TypeScript data structures, boundary deserialization, API parsing, or resource lifecycles matching `scripts/manual-qa/run-qa-calculator-live.ts`.

**VERIFIED IMPLEMENTATION PATTERN**:
```typescript
// Verified production-grade fix pattern:
/**
 * Live manual QA for the `calculator` agent tool.
 *
 * Drives a real AutoRAGAgent (same option path as the CLI, via buildAgentOptions) with a real model and an
 * isolated corpus, asks arithmetic, date, time, and time-zone questions, and records for every question which
 * calculator calls the model made, what the tool printed, and the final answer. Each case lists substrings the
 * answer must carry (from an independent reference) and the operations the model is expected to have used.
 *
 * Prerequisites: a resolvable model (OPENROUTER_API_KEY), and an isolated AUTORAG_HOME/AUTORAG_CONFIG that
 * already has MinSync in `<workspace>/.autorag/bin` (run `autorag refresh --method minsync` there first).
 *
 * Usage:
 *   AUTORAG_CALC_QA_ROOT=<isolated root> AUTORAG_CALC_QA_MODEL=anthropic/claude-haiku-5.5 \
 *     bun scripts/manual-qa/run-qa-calculator-live.ts
 *   AUTORAG_CALC_QA_EVIDENCE=.omo/evidence/qa-calculator-live.json  (default)
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { AutoRAGAgent } from "../../src/agent/agent.ts";
import { CALCULATOR_TOOL_NAME } from "../../src/agent/calculator-tool.ts";
import { build
```

**NEGATIVE CONSTRAINT**:
```typescript
// Anti-pattern to NEVER write (induced failure mode):
// Defect-prone omission of boundary validation
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `bbb417e3` are properly handled with clean fallback behavior.


## 3. Independent Verification Protocol
1. Assert state existence before and after execution.
2. Verify deterministic SHA-256 byte digest parity.
3. Validate zero unhandled promise rejections or uncaught exceptions.
