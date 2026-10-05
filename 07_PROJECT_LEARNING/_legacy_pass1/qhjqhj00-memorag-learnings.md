# Forensic Learning Record (Deep Inspection): qhjqhj00/MemoRAG

> **Canonical Artifact**: `07_PROJECT_LEARNING/qhjqhj00-memorag-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/qhjqhj00/MemoRAG](https://github.com/qhjqhj00/MemoRAG))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-09-30T21:11:58.380Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `qhjqhj00/MemoRAG`
- **Description**: Empowering RAG with a memory-based data interface for all-purpose applications!
- **Primary Language / Ecosystem**: Python
- **Discovered Manifests / Configurations**: README.md
- **Stars / Engagement**: 2269 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `examples/longbench/eval.py`
```
import sys
import os

sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

import datasets
import json
import torch
import time
from tqdm import tqdm
from typing import Optional, Dict, List
from functools import partial
from collections import defaultdict
from dataclasses import dataclass, field, asdict
from accelerate import Accelerator
from transformers import HfArgumentParser
from transformers.utils import logging
from torch.utils.data import DataLoader
from memorag import MemoRAG
from longbench.utils import DATASET2CATEGORY, scorer, DATASET2PROMPT, DATASET2MAXNEWTOKENS, makedirs, FileLogger, DefaultDataCollator

logger = logging.get_logger(__name__)

@dataclass
class Args:
    gen_model_path: str = field(
        default="mistralai/Mistral-7B-Instruct-v0.2",
    )
    mem_model_path: str = field(
        default="/share/qhj/memorag-qwen2-7b-inst",
    )
    ret_model_path: str = field(
        default="BAAI/bge-m3",
    )
    cache_dir: str = field(
        default="/share/shared_models/",
    )
    access_token: str = field(
        default="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",
    )
    eval_data: str = field(
        default="data/ongbench/test.json",
        metadata={'help': 'The evaluation json data path.'}
    )
    output_dir: str = field(
        default="data/results/longbench/",
        metadata={'help': 'The base directory for saving results and logs.'}
    )
    result_dir: Optional[str] = field(
        default=None,
        metadata={'help': 'The directory relative to output_dir for saving results.'}
    )
    dataset_names: List[str] = field(
        default_factory=lambda: ['narrativeqa', 'qasper', 'multifieldqa_en', 'hotpotqa', '2wikimqa', 'musique', 'gov_report', 'qmsum', 'multi_news'],
        metadata={'help': 'Which dataset to evaluate?'}
    )

    max_length: Optional[int] = field(
        default=None,
        metadata={'help': 'Max input length.'}
    )
    truncate_from_middle: bool = field(
        default=True,
        metadata={'help': 'Truncate inputs from the middle.'}
    )

def process_longbench(data, indices, tokenizer, max_length=3500, truncate_from_middle=True):
    outputs = {'context': [], 'question': [], "dataset": [], "index": [], "length": []}

    for input, context, dataset, index in zip(data['input'], data['context'], data['dataset'], indices):
        if dataset.endswith("_e"):
            dataset = dataset[:-2]

        if dataset in ['narrativeqa', 'qasper', 'multifieldqa_en', 'hotpotqa', '2wikimqa', 'musique', 'qmsum']:
            question = input
        elif dataset == "gov_report":
            question = ""
        elif dataset == "multi_news":
            question = ""
        else:
            continue
        
        if max_length is not None:
            if truncate_from_middle:
                try:
                    tokenized_context = tokenizer.encode(context, add_special_tokens=False)
                except:
                    tokenized_context = tokenizer.encode(context)
                if len(tokenized_context) > max_length:
                    half = int(max_length / 2)
                    context = tokenizer.decode(tokenized_context[:half]) + tokenizer.decode(tokenized_context[-half:])
            else:
                tokenized_context = tokenizer.encode(context)
                context = tokenizer.decode(tokenized_context[-max_length:])

        length = len(tokenizer.encode(context))

        outputs["context"].append(context)
        outputs["question"].append(question)
        outputs["dataset"].append(dataset)
        outputs["index"].append(index)
        outputs["length"].append(length)

    return outputs

@torch.no_grad()
def main():
    parser = HfArgumentParser([Args])
    args = parser.parse_args_into_dataclasses()[0]
    accelerator = Accelerator(cpu=False)

    pipe = MemoRAG(
                mem_model_name_or_path=args.mem_model_path,
                ret_model_name_or_path=args.ret_model_path,
                gen_model_name_or_path=args.gen_model_path,
                cache_dir=args.cache_dir,
                access_token=args.access_token,
            )   
    
    tokenizer = pipe.gen_model.tokenizer

    with accelerator.main_process_first():
        process_fn = partial(
            process_longbench, 
            tokenizer=tokenizer,
            max_length=args.max_length,
            truncate_from_middle=args.truncate_from_middle
        )

        raw_dataset = datasets.load_dataset("json", data_files=args.eval_data, split="train")
        dataset = raw_dataset.map(process_fn, batched=True, num_proc=32, with_indices=True, remove_columns=raw_dataset.column_names)

    groupby_dataset = dataset.to_pandas().groupby("dataset")

    metrics = {}
    if args.dataset_names is None:
        dataset_names = [key for key, _ in groupby_dataset]
    else:
        dataset_names = args.dataset_names

    result_dir = os.path.join(args.output_dir, args.result_dir)

    for i, dataset_name in enumerate(dataset_names):
        if accelerator.process_index == 0:
            logger.info(f"Evaluating {dataset_name} ({i + 1} / {len(dataset_names)})...")

        result_path = os.path.join(result_dir, f"{dataset_name}.json")
        
        dataset = datasets.Dataset.from_pandas(groupby_dataset.get_group(dataset_name), preserve_index=False)

        data_collator = DefaultDataCollator(padding_side="left")
        dataloader = DataLoader(
            dataset, 
            batch_size=1, 
            collate_fn=data_collator,
            # only pin memory when no gpu
        )

        # NOTE: prepare dataloader so the data moves to GPU automatically
        dataloader = accelerator.prepare(dataloader)

        indices = []
        preds = []
        memory_results = []
        _prompt = DATASET2PROMPT[dataset_name]
        task_max_new_token=DATASET2MAXNEWTOKENS[dataset_name]
        
        for i, x in enumerate(tqdm(dataloader, desc="Generating")):
            x.pop("dataset")
            index = x.pop("index")[0]
            
            if "QA" in DATASET2CATEGORY[dataset_name]:
                output = [pipe(x["context"][0], x["question"][0], prompt_template=_prompt, task_type="rag", max_new_tokens=task_max_new_token, reset_each_call=True, use_memory_answer=True)]
            else:
                output = [pipe(x["context"][0], x["question"][0], prompt_template=_prompt, task_type="summarize", max_new_tokens=task_max_new_token, reset_each_call=True, use_memory_answer=True)]

            if accelerator.num_processes > 1:
                # pad across device to the same length
                output = accelerator.gather_for_metrics(output)
                index = accelerator.gather_for_metrics(index)

            accelerator.print(output)

            index = index.tolist()

            if accelerator.process_index == 0:
                preds.extend(output)
                if isinstance(index, list):
                    indices.extend(index)
                else:
                    # single process
                    indices.append(index)

            if accelerator.process_index == 0:
                raw_dataset_subset = raw_dataset[indices]
                answers = raw_dataset_subset["answers"]
                lengths = raw_dataset_subset["length"]
                all_classes = []
                # all_classes = raw_dataset_subset["all_classes"][0]
                score = scorer(dataset_name, preds, answers, all_classes)        
                
                logger.info(f"{dataset_name}: {score}")
                metrics[dataset_name] = score

                with open(makedirs(result_path), "w", encoding="utf-8") as f:
                    f.write(json.dumps(score, ensure_ascii=False) + "\n")
                    for index, pred in zip(indices, preds):
                        sample = raw_dataset[index]
                        del sample["context"]
                        sample["pred"] = pred
                        f.write(json.dumps(s
```

### Core Architecture Module: `examples/longbench/utils.py`
```
import re
import string
import jieba
import difflib
import numpy as np
from fuzzywuzzy import fuzz
from typing import List
from collections import Counter
from rouge import Rouge
from dataclasses import dataclass, field, asdict
import pandas as pd
import json
from math import ceil
from typing import Optional, List, Dict, Any, Mapping, Iterable
import torch
import pathlib
from tqdm import tqdm
import sys
import pytz
from datetime import datetime
from transformers.tokenization_utils import PreTrainedTokenizer


def normalize_answer(s):
    """Lower text and remove punctuation, articles and extra whitespace."""

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


def normalize_zh_answer(s):
    """Lower text and remove punctuation, extra whitespace."""

    def white_space_fix(text):
        return "".join(text.split())

    def remove_punc(text):
        cn_punctuation = "！？｡。＂＃＄％＆＇（）＊＋，－／：；＜＝＞＠［＼］＾＿｀｛｜｝～｟｠｢｣､、〃》「」『』【】〔〕〖〗〘〙〚〛〜〝〞〟〰〾〿–—‘’‛“”„‟…‧﹏."
        all_punctuation = set(string.punctuation + cn_punctuation)
        return "".join(ch for ch in text if ch not in all_punctuation)

    def lower(text):
        return text.lower()

    return white_space_fix(remove_punc(lower(s)))

def count_score(prediction, ground_truth, **kwargs):
    numbers = re.findall(r"\d+", prediction)
    right_num = 0
    for number in numbers:
        if str(number) == str(ground_truth):
            right_num += 1
    final_score = 0.0 if len(numbers) == 0 else right_num / len(numbers)
    return float(final_score)

def retrieval_score(prediction, ground_truth, **kwargs):
    pattern = r'Paragraph (\d+)'
    matches = re.findall(pattern, ground_truth)
    ground_truth_id = matches[0]
    numbers = re.findall(r"\d+", prediction)
    right_num = 0
    for number in numbers:
        if str(number) == str(ground_truth_id):
            right_num += 1
    final_score = 0.0 if len(numbers) == 0 else right_num / len(numbers)
    return float(final_score)

def retrieval_zh_score(prediction, ground_truth, **kwargs):
    pattern = r'段落(\d+)'
    matches = re.findall(pattern, ground_truth)
    ground_truth_id = matches[0]
    numbers = re.findall(r"\d+", prediction)
    right_num = 0
    for number in numbers:
        if str(number) == str(ground_truth_id):
            right_num += 1
    final_score = 0.0 if len(numbers) == 0 else right_num / len(numbers)
    return float(final_score)

def code_sim_score(prediction, ground_truth, **kwargs):
    all_lines = prediction.lstrip('\n').split('\n')
    prediction = ""
    for line in all_lines:
        if ('`' not in line) and ('#' not in line) and ('//' not in line):
            prediction = line
            break
    return (fuzz.ratio(prediction, ground_truth) / 100)

def classification_score(prediction, ground_truth, **kwargs):
    em_match_list = []
    all_classes = kwargs["all_classes"]
    for class_name in all_classes:
        if class_name in prediction:
            em_match_list.append(class_name)
    for match_term in em_match_list:
        if match_term in ground_truth and match_term != ground_truth:
            em_match_list.remove(match_term)
    if em_match_list != 0:
        if ground_truth in em_match_list:
            score = (1.0 / len(em_match_list))
        else:
            score = 0.0
    else:
        best_match = None
        highest_similarity = 0
        for string in all_classes:
            similarity = difflib.SequenceMatcher(None, string, prediction).ratio()
            if similarity > highest_similarity:
                highest_similarity = similarity
                best_match = string
        score = float(best_match == ground_truth)
    return score
    
def rouge_score(prediction, ground_truth, **kwargs):
    rouge = Rouge()
    try:
        scores = rouge.get_scores([prediction], [ground_truth], avg=True)
    except:
        return 0.0
    return scores["rouge-l"]["f"]

def rouge_score_zh(prediction, ground_truth, **kwargs):
    prediction = " ".join(list(jieba.cut(prediction, cut_all=False)))
    ground_truth = " ".join(list(jieba.cut(ground_truth, cut_all=False))) 
    score = rouge_score(prediction, ground_truth)
    return score

def f1_score(prediction, ground_truth, **kwargs):
    common = Counter(prediction) & Counter(ground_truth)
    num_same = sum(common.values())
    if num_same == 0:
        return 0
    precision = 1.0 * num_same / len(prediction)
    recall = 1.0 * num_same / len(ground_truth)
    f1 = (2 * precision * recall) / (precision + recall)
    return f1

def qa_f1_score(prediction, ground_truth, **kwargs):
    normalized_prediction = normalize_answer(prediction)
    normalized_ground_truth = normalize_answer(ground_truth)

    prediction_tokens = normalized_prediction.split()
    ground_truth_tokens = normalized_ground_truth.split()
    return f1_score(prediction_tokens, ground_truth_tokens)


def qa_f1_score_zh(prediction, ground_truth, **kwargs):
    prediction_tokens = list(jieba.cut(prediction, cut_all=False))
    ground_truth_tokens = list(jieba.cut(ground_truth, cut_all=False))
    prediction_tokens = [normalize_zh_answer(token) for token in prediction_tokens]
    ground_truth_tokens = [normalize_zh_answer(token) for token in ground_truth_tokens]
    prediction_tokens = [token for token in prediction_tokens if len(token) > 0]
    ground_truth_tokens = [token for token in ground_truth_tokens if len(token) > 0]
    return f1_score(prediction_tokens, ground_truth_tokens)

def scorer(dataset, predictions, answers, all_classes):
    total_score = 0.
    for (prediction, ground_truths) in zip(predictions, answers):
        score = 0.
        if dataset in ["trec", "triviaqa", "samsum", "lsht"]:
            prediction = prediction.lstrip('\n').split('\n')[0]
        for ground_truth in ground_truths:
            score = max(score, DATASET2METRIC[dataset](prediction, ground_truth, all_classes=all_classes))
        total_score += score
    return round(100 * total_score / len(predictions), 2)


DATASET2PROMPT = {
    "narrativeqa": "You are given a story, which can be either a novel or a movie script, and a question. Answer the question asconcisely as you can, using a single phrase if possible. Do not provide any explanation.\n\nStory: {context}\n\nNow, answer the question based on the story as concisely as you can, using a single phrase if possible. Do not provide any explanation.\n\nQuestion: {input}\n\nAnswer:",
    "qasper": "You are given a scientific article and a question. Answer the question as concisely as you can, using a single phrase or sentence if possible. If the question cannot be answered based on the information in the article, write \"unanswerable\". If the question is a yes/no question, answer \"yes\", \"no\", or \"unanswerable\". Do not provide any explanation.\n\nArticle: {context}\n\n Answer the question based on the above article as concisely as you can, using a single phrase or sentence if possible. If the question cannot be answered based on the information in the article, write \"unanswerable\". If the question is a yes/no question, answer \"yes\", \"no\", or \"unanswerable\". Do not provide any explanation.\n\nQuestion: {input}\n\nAnswer:",
    "multifieldqa_en": "Read the following text and answer briefly.\n\n{context}\n\nNow, answer the following question based on the above text, only give me the answer and do not output any other words.\n\nQuestion: {input}\nAnswer:",
    "multifieldqa_zh": "阅读以下文字并用中文简短回答：\n\n{context}\n\n现在请基于上面的文章回答下面的问题，只告诉我答案，不要输出任何其他字词。\n\n问题：{input}\n回答：",
    "hotpotqa": "Answer the question based on the given passages. Only give me the answer and do not output any other words.\n\
```

### Core Architecture Module: `memorag/__init__.py`
```
from .memorag import Memory, MemoRAG, Model
from .memorag_lite import MemoRAGLite
from .agent import Agent
```

### Core Architecture Module: `memorag/agent.py`
```
from openai import OpenAI
from openai import AzureOpenAI
from functools import wraps

import logging

logger = logging.getLogger(__name__)

def except_retry_dec(retry_num: int = 3):
    def decorator(func):
        @wraps(func)
        def wrapped_func(*args, **kwargs):
            i = 0
            while True:
                try:
                    logger.info("openai agent post...")
                    ret = func(*args, **kwargs)
                    logger.info("openai agent post finished")
                    return ret
                # error define: https://platform.openai.com/docs/guides/error-codes/python-library-error-types
                except (
                    openai.BadRequestError,
                    openai.AuthenticationError,
                ) as e:
                    raise
                except Exception as e:  # pylint: disable=W0703
                    logger.error(f"{e}")
                    logger.info(f"sleep {i + 1}")
                    time.sleep(i + 1)
                    if i >= retry_num:
                        raise
                    logger.warning(f"do retry, time: {i}")
                    i += 1

        return wrapped_func

    return decorator

class Agent:
    def __init__(
        self, model, source, api_dict, temperature: float = 0.0):
        self.model = model
        self.temperature = temperature

        if source == "azure":
            self.client = AzureOpenAI(
                azure_endpoint = api_dict["endpoint"], 
                api_version=api_dict["api_version"],
                api_key=api_dict["api_key"],
                )
            
        elif source == "openai":
            self.client = OpenAI(
                    # This is the default and can be omitted
                    api_key=api_dict["api_key"],
                )
        elif source == "deepseek":
            self.client = OpenAI(
                    # This is the default and can be omitted
                    base_url=api_dict["base_url"],
                    api_key=api_dict["api_key"],
                )
        print(f"You are using {self.model} from {source}")
        
    @except_retry_dec()
    def generate(self, prompt: str, max_new_tokens:int=None) -> str:
        _completion = self.client.chat.completions.create(
                messages=[
                    {
                        "role": "user",
                        "content": prompt,
                    }
                ],
                temperature=self.temperature,
                model=self.model,
            )
        return [_completion.choices[0].message.content]

```

### Core Architecture Module: `memorag/memorag.py`
```
import torch
from transformers.utils import logging
from typing import Dict, Union, List, Optional
from transformers import AutoModelForCausalLM, AutoTokenizer, BitsAndBytesConfig, DynamicCache
from transformers.tokenization_utils_base import BatchEncoding
from itertools import chain
from semantic_text_splitter import TextSplitter
from .retrieval import DenseRetriever, FaissIndex
from typing import Dict, List, Union
from .prompt import en_prompts, zh_prompts
import os 
import json
import tiktoken
import copy
from minference import MInference

logger = logging.get_logger(__name__)          

def merge_inputs(inputs1: BatchEncoding, inputs2: BatchEncoding) -> BatchEncoding:

    merged_input_ids = torch.cat([inputs1['input_ids'], inputs2['input_ids']], dim=1)
    merged_attention_mask = torch.cat([inputs1['attention_mask'], inputs2['attention_mask']], dim=1)
    
    merged_inputs = BatchEncoding({
        'input_ids': merged_input_ids,
        'attention_mask': merged_attention_mask
    })
    return merged_inputs

class Model:
    def __init__(
        self, 
        model_name_or_path: str, 
        cache_dir: str="",
        access_token: str="",
        beacon_ratio: int=None,
        load_in_4bit: bool=False,
        enable_flash_attn: bool=True
    ):  
        device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
        if enable_flash_attn:
            if model_name_or_path.find("mistral") != -1:
                attn_implementation = "sdpa"
            else:
                attn_implementation = "flash_attention_2"
        else:
            attn_implementation = None

        if model_name_or_path.find("memorag") == -1:
            load_in_4bit = True

        self.model_kwargs = {
            "cache_dir": cache_dir,
            "token": access_token,
            "device_map": {"": device},
            "attn_implementation": attn_implementation,
            "torch_dtype": torch.bfloat16,
            "trust_remote_code": True,
        }
        self.model_name_or_path = model_name_or_path

        if load_in_4bit:
            quant_config = BitsAndBytesConfig(
                    load_in_4bit=load_in_4bit
                )
            self.model_kwargs["quantization_config"] = quant_config

        if beacon_ratio and model_name_or_path.find("memorag") != -1:
            self.model_kwargs["beacon_ratio"] = [beacon_ratio]

        tokenizer_kwargs = {
            "cache_dir": cache_dir,
            "token": access_token,
            "padding_side": "left",
            "trust_remote_code": True,
        }

        self.tokenizer = AutoTokenizer.from_pretrained(
            model_name_or_path, 
            **tokenizer_kwargs
        )

        self.model = AutoModelForCausalLM.from_pretrained(
            model_name_or_path, 
            **self.model_kwargs
        ).eval()

        logger.info(f"Model loaded from {model_name_or_path}")

        if self.tokenizer.pad_token is None:
            self.tokenizer.pad_token = self.tokenizer.eos_token

    def ids2text(
        self, 
        inputs, 
        **generation_kwargs
    ) -> str:
        outputs = self.model.generate(
            **inputs, 
            **generation_kwargs, 
            pad_token_id=self.tokenizer.eos_token_id
        )

        decoded_output = self.tokenizer.batch_decode(
            outputs[:, inputs["input_ids"].shape[1]:], 
            skip_special_tokens=True
        )

        return decoded_output

    def template2ids(
        self, 
        templates: List, 
        remove_symbol=None
    ):
        if isinstance(templates, str):
            templates = [templates]
        
        batch_prompts = []
        for template in templates:
            to_encode = self.tokenizer.apply_chat_template(
                template, 
                tokenize=False, 
                add_generation_prompt=True
            )
            if remove_symbol:
                to_encode = to_encode.replace(remove_symbol, "")
            batch_prompts.append(to_encode)

        inputs = self.tokenizer(
            batch_prompts, 
            add_special_tokens=False, 
            return_tensors="pt", 
            padding=True
        ).to(self.model.device)

        return inputs

    def minference_patch(self, model_type:str="meta-llama/Meta-Llama-3.1-8B-Instruct"):
        minference_patch = MInference("minference", model_type)
        self.model=minference_patch(self.model)

    def reload_model(self):
        # TODO 
        del self.model
        torch.cuda.empty_cache()
        self.model = AutoModelForCausalLM.from_pretrained(
            self.model_name_or_path, 
            **self.model_kwargs
        ).eval()

    def generate(
        self, 
        prompts: Union[str, List[str]], 
        batch_size: int = 1, 
        max_new_tokens: int = 256,
        temperature: float = None,
        top_p: float = None,
        do_sample: bool = False,
        repetition_penalty:float=1.0
    ) -> Union[str, List[str]]:

        if isinstance(prompts, str):
            prompts = [prompts]

        generation_kwargs = {
            "max_new_tokens": max_new_tokens,
            "do_sample": do_sample,
            "temperature": temperature,
            "top_p": top_p,
            "repetition_penalty": repetition_penalty
        }
            
        all_outputs = []

        for i in range(0, len(prompts), batch_size):
            batch_prompts = []
            for prompt in prompts[i: i + batch_size]:
                batch_prompts.append([{"role": "user", "content": prompt}])
            inputs = self.template2ids(batch_prompts)
            outputs = self.ids2text(inputs, **generation_kwargs)
            all_outputs.extend(outputs)
        return all_outputs


class Memory(Model):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.memory = None
        if self.model_name_or_path.find("memorag") != -1:
            self.memo_type = "beacon"
        else:
            self.memo_type = "longllm"

        if self.model_name_or_path.lower().find("chinese") != -1:
            self.prompts = zh_prompts
        else:
            self.prompts = en_prompts

    def memorize(
        self, 
        context, 
        max_length=None,
        reload_model:bool=True
    ):
        
        context_inputs = self.template2ids([[
            {"role": "user", "content": self.prompts["context"].format(context=context)},
            {"role": "assistant", "content": "I have read the article. Please provide your question."}
        ]])
        if self.memo_type == "beacon":
            self.reset() 
            with torch.no_grad():
                self.model(**context_inputs)
            self.memory = self.model.memory.export()
        elif self.memo_type == "longllm":
            self.minference_patch()
            self.memory = DynamicCache()
            with torch.no_grad():
                model_outputs = self.model(**context_inputs, past_key_values=self.memory)
            self.memory = model_outputs.past_key_values
            self.context_inputs = context_inputs
            if reload_model:
                self.reload_model()

    def reset(
        self
    ) -> None:
        self.memory = None
        self.model.memory.reset()

    def answer(
        self,
        query, max_new_tokens=128) -> str:
        return self.generate(self.prompts["qa"], query, max_new_tokens=max_new_tokens)[0]

    def recall(
        self,
        query, max_new_tokens=128) -> str:
        return self.generate(self.prompts["span"], query, max_new_tokens=max_new_tokens)[0]

    def rewrite(
        self,
        query, max_new_tokens=128) -> str:
        return self.generate(self.prompts["sur"], query, max_new_tokens=max_new_tokens)[0]

    def summarize(
        self, max_new_tokens:int=512) -> str:
        return self.generate(self.prompts["sum"], max_new_tokens=max_new_tokens)[0]

    def generate(
        self, 
        instruct: Union[str, List[str]], 
       
```

### Core Architecture Module: `memorag/memorag_lite.py`
```
import torch
from transformers.utils import logging
from typing import Dict, Union, List, Optional
from transformers import AutoModelForCausalLM, AutoTokenizer, BitsAndBytesConfig, DynamicCache
from transformers.tokenization_utils_base import BatchEncoding
from itertools import chain
from semantic_text_splitter import TextSplitter
from typing import Dict, List, Union
import os 
import time
import json
import tiktoken
import copy
from minference import MInference
from langdetect import detect
from .memorag import Model, merge_inputs
from .retrieval import DenseRetriever, FaissIndex
from .prompt import en_prompts, zh_prompts
import pynvml

def get_first_gpu_memory():
    pynvml.nvmlInit()

    device_count = pynvml.nvmlDeviceGetCount()

    if device_count > 0:
        handle = pynvml.nvmlDeviceGetHandleByIndex(0)
        mem_info = pynvml.nvmlDeviceGetMemoryInfo(handle)

        free_memory = mem_info.free / 1024 ** 2  

        return free_memory
    else:
        return None

    pynvml.nvmlShutdown()

class MemoRAGLite:
    def __init__(
        self,
        gen_model_name_or_path: str="Qwen/Qwen2.5-1.5B-Instruct",
        ret_model_name_or_path: str="BAAI/bge-m3",
        customized_gen_model=None,
        ret_hit: int = 3,
        retrieval_chunk_size: int = 512,
        cache_dir: Optional[str] = None,
        access_token: Optional[str] = None,
        load_in_4bit: bool = False,
        enable_flash_attn: bool = True):
        
        if gen_model_name_or_path.find("Qwen2.5-1.5B-Instruct") == -1:
            self.adapt_bs = False
        else:
            self.adapt_bs = True

        if gen_model_name_or_path:
            self.gen_model = Model(
                gen_model_name_or_path, cache_dir=cache_dir, access_token=access_token, load_in_4bit=load_in_4bit, enable_flash_attn=enable_flash_attn)
        elif customized_gen_model:  # for API-based models
            self.gen_model = customized_gen_model
        else:
            raise NotImplementedError

        self.ret_model_name_or_path = ret_model_name_or_path
        self.retrieval_chunk_size = retrieval_chunk_size
        self.ret_hit = ret_hit
        self.cache_dir = cache_dir
        self.load_in_4bit = load_in_4bit

        self.prefix = "<|im_start|>user\n{input}"
        self.suffix = "<|im_end|>\n<|im_start|>assistant\n"

        self.gists = None
        self.memory = None
        self.prompts = None
        self.context_inputs = None
        self.retriever = None
        self.retrieval_corpus = None

    def __call__(
        self, 
        query: str = None, 
        context: str = None, 
        task_type: str = "memorag", 
        prompt_template: str = None,
        max_new_tokens: int = 256,
        reset_each_call: bool = False,
        use_memory_answer: bool = False
    ):
        assert self.gen_model is not None
        
        if reset_each_call:
            self.reset()

        if not self.memory:
            if not context:
                raise ValueError("Please provide your input context...")

            self.memorize(context)

        if task_type == 'qa':
            return self.answer(query, max_new_tokens)
        elif task_type == 'memorag':
            return self._handle_rag(query, max_new_tokens, use_memory_answer)
        else:
            raise NotImplementedError(f"Task type '{task_type}' is not supported.")

    def _handle_rag(self, query: str, max_new_tokens: int=128, use_memory_answer: bool=True):
        text_spans = self.recall(query)
        surrogate_queries = self.rewrite(query)
        retrieval_query, potential_answer = self._prepare_retrieval_query(
            query, text_spans, surrogate_queries, use_memory_answer)

        retrieval_results = self._retrieve(retrieval_query)
        if potential_answer:
            retrieval_results.append(f"The answer might be {potential_answer}.")

        knowledge = "\n\n".join(retrieval_results)
        _prompt = self.prompts["qa_gen"].format(context=knowledge, input=query)
        return self.gen_model.generate(_prompt, max_new_tokens=max_new_tokens, repetition_penalty=1.2)[0]


    def _prepare_retrieval_query(self, query, text_spans, surrogate_queries, use_memory_answer):
        retrieval_query = text_spans.split("\n") + surrogate_queries.split("\n")
        if self.language == "zh-cn":
            retrieval_query = [q for q in retrieval_query if len(q) > 3] # TODO
        else:
            retrieval_query = [q for q in retrieval_query if len(q.split()) > 3]

        potential_answer = None
        if use_memory_answer:
            potential_answer = self.answer(query)
            retrieval_query.append(potential_answer)
        retrieval_query.append(query)
        return retrieval_query, potential_answer

    def _retrieve(self, retrieval_query):
        topk_scores, topk_indices = self.retriever.search(queries=retrieval_query)
        topk_indices = list(chain(*[topk_index.tolist() for topk_index in topk_indices]))
        topk_indices = sorted(set([x for x in topk_indices if x > -1]))
        return [self.retrieval_corpus[i].strip() for i in topk_indices]

    def reset(self):
        torch.cuda.empty_cache()
        if self.retriever:
            self.retriever.remove_all()
        self.gists = None
        self.memory = None
        self.prompts = None
        self.context_inputs = None
        self.language = None

    def adapt_batch_size(self):
        free_memory = get_first_gpu_memory()

        if free_memory < 23000:
            print(f"The minimum recommended GPU memory for MemoRAG is 24GiB, but only {round(free_memory / 1024, 1)} GiB is available.")

        if self.adapt_bs:
            memory_thresholds = {
                "en": [(70000, 16), (60000, 10), (38000, 8), (20000, 4), (14000, 2)], 
                "zh-cn": [(70000, 16), (60000, 10), (38000, 8), (20000, 4), (14000, 2)]  
            }
            thresholds = memory_thresholds.get(self.language, memory_thresholds["en"])

            for threshold, bs in thresholds:
                if free_memory > threshold:
                    batch_size = bs
                    break
        return batch_size

    def memorize(
        self, 
        context: str, 
        save_dir: str = None, 
        print_stats: bool = True, 
        batch_size: int = 1,
        gist_chunk_size: int = 4096):
    
        self.reset()

        # Detect language
        text_sample = context[:1024]
        self.language = detect(text_sample)
        if print_stats:
            print(f"Detected language: {self.language}")

        batch_size = self.adapt_batch_size()

        # Encode context
        encoding = tiktoken.get_encoding("cl100k_base")
        encoded_context = encoding.encode(context)
        if print_stats:
            print(f"Context length: {len(encoded_context)} tokens")

        # Set appropriate prompts based on detected language
        self.prompts = zh_prompts if self.language == "zh-cn" else en_prompts

        # Split context into gists
        text_splitter = TextSplitter.from_tiktoken_model("gpt-3.5-turbo", gist_chunk_size)
        gist_chunks = text_splitter.chunks(context)
        gist_chunks = [self.prompts["gist"].format(context=chunk) for chunk in gist_chunks]

        # Generate gists
        if print_stats:
            print(f"Forming memory of the context...")

        self.gists = []
        for i in range(0, len(gist_chunks), batch_size):
            if print_stats and i > 1:
                progress = round(i / len(gist_chunks) * 100, 2)
                print(f"Progress: {progress}% of the context memorized...")

            gists_batch = self.gen_model.generate(
                gist_chunks[i:i+batch_size], 
                batch_size=batch_size, 
                max_new_tokens=512, 
                repetition_penalty=1.2)
            torch.cuda.empty_cache()
            
            self.gists.extend(gists_batch)

        # Join generated gists and clear cache
        gists_concatenated = "\n".join(self.gi
```

### Core Architecture Module: `memorag/prompt.py`
```

en_prompts = {
    "context": """You are provided with a long article. Read the article carefully. After reading, you will be asked to perform specific tasks based on the content of the article.

Now, the article begins:
- **Article Content:** {context}

The article ends here.

Next, follow the instructions provided to complete the tasks.""",
    "sur": """
You are given a question related to the article. To answer it effectively, you need to recall specific details from the article. Your task is to generate precise clue questions that can help locate the necessary information.

### Question: {question}
### Instructions:
1. You have a general understanding of the article. Your task is to generate one or more specific clues that will help in searching for supporting evidence within the article.
2. The clues are in the form of precise surrogate questions that clarify the original question.
3. Only output the clues. If there are multiple clues, separate them with a newline.""",

    "span": """
You are given a question related to the article. To answer it effectively, you need to recall specific details from the article. Your task is to identify and extract one or more specific clue texts from the article that are relevant to the question.

### Question: {question}
### Instructions:
1. You have a general understanding of the article. Your task is to generate one or more specific clues that will help in searching for supporting evidence within the article.
2. The clues are in the form of text spans that will assist in answering the question.
3. Only output the clues. If there are multiple clues, separate them with a newline.""",

    "qa": """
You are given a question related to the article. Your task is to answer the question directly.

### Question: {question}
### Instructions:
Provide a direct answer to the question based on the article's content. Do not include any additional text beyond the answer.""",

    "sum": """
Your task is to create a concise summary of the long article by listing its key points. Each key point should be listed on a new line and numbered sequentially.

### Requirements:

- The key points should be brief and focus on the main ideas or events.
- Ensure that each key point captures the most critical and relevant information from the article.
- Maintain clarity and coherence, making sure the summary effectively conveys the essence of the article.
""",
    "qa_gen": "Read the text below and answer a question.\n\n{context}\n\nQuestion: {input}\n\nBe concise.",
    "sum_gen": "Summarize the following text.\n\n{context}",
    "gist": "Please summarize the core content of the following text, remove redundant information, and compress it into concise and accurate text. Retain all key facts and points. The language should be straightforward and concise, and do not use any formatting.\n\nText: {context}\n\nPlease output the core content directly.",
    "dull_reply": "I have read the article. Please provide your question."
}

zh_prompts = {
    "context": """你将获得一篇长文章。请仔细阅读这篇文章。阅读完成后，你将根据文章的内容执行特定任务。

现在，文章开始：
- **文章内容：** {context}

文章到此结束。

接下来，请按照给出的指示完成任务。""",

    "sur": """
你会得到一个与文章相关的问题。为了有效地回答这个问题，你需要回想文章中的具体细节。你的任务是生成精确的线索问题，帮助找到文章中必要的信息。

### 问题：{question}
### 指示：
1. 你对文章有一个大致的理解。你的任务是生成一个或多个具体的线索，帮助查找文章中的支持证据。
2. 线索应以精确的替代问题形式呈现，澄清原问题。
3. 只输出线索。如果有多个线索，请用换行符分隔。
4. 请用中文回答。""",

    "span": """
你会得到一个与文章相关的问题。为了有效地回答这个问题，你需要回想文章中的具体细节。你的任务是识别并提取文章中与问题相关的一个或多个具体线索文本。

### 问题：{question}
### 指示：
1. 你对文章有一个大致的理解。你的任务是生成一个或多个具体的线索，帮助查找文章中的支持证据。
2. 线索应以文本片段的形式呈现，这些片段将有助于回答问题。
3. 只输出线索。如果有多个线索，请用换行符分隔。
4. 请用中文回答。""",

    "qa": """
你会得到一个与文章相关的问题。你的任务是直接回答这个问题。

### 问题：{question}
### 指示：
基于文章的内容，直接回答问题。不要包含除答案之外的任何额外内容。""",

    "sum": """
你的任务是通过列出文章的关键点来创建一个简明的总结。每个关键点应按顺序逐行列出并编号。

### 要求：

- 关键点应简短，并着重于主要思想或事件。
- 确保每个关键点都捕捉到文章中最重要和相关的信息。
- 保持清晰连贯，确保摘要能有效传达文章的精髓。
- 请用中文回答。""",

    "qa_gen": "阅读以下文本并回答问题。\n\n{context}\n\n问题：{input}\n\n请简明扼要地回答，请使用中文回答。",

    "sum_gen": "请总结以下文本，请输出中文。\n\n{context}", 
    "gist": "请总结以下文本的核心内容，删除冗余信息，压缩为简洁、准确的文本，保留所有关键事实和要点，语言直观、简明，不要使用任何格式。\n\n文本：{context}\n\n请直接输出核心内容。",
    "dull_reply": "我已经读完文本，请提出你的问题。"
}


```

### Core Architecture Module: `memorag/retrieval.py`
```
import torch
import faiss
import numpy as np
from typing import List, Mapping, Optional, Union
from collections import defaultdict
from transformers import AutoTokenizer, AutoModel, AutoModelForSequenceClassification
from transformers.utils import logging
from semantic_text_splitter import TextSplitter

logger = logging.get_logger(__name__)

class FaissIndex:
    def __init__(self, device) -> None:
        if isinstance(device, torch.device):
            if device.index is None:
                device = "cpu"
            else:
                device = device.index
        self.device = device

    def build(self, doc_embeddings, index_factory, metric):
        if metric == "l2":
            metric = faiss.METRIC_L2
        elif metric in ["ip", "cos"]:
            metric = faiss.METRIC_INNER_PRODUCT
        else:
            raise NotImplementedError(f"Metric {metric} not implemented!")
        
        index = faiss.index_factory(doc_embeddings.shape[1], index_factory, metric)
        
        if self.device != "cpu":
            co = faiss.GpuClonerOptions()
            co.useFloat16 = True
            # logger.info("using fp16 on GPU...")
            index = faiss.index_cpu_to_gpu(faiss.StandardGpuResources(), self.device, index, co)

        index.train(doc_embeddings)
        index.add(doc_embeddings)
        self.index = index
        return index
    
    def add(self, doc_embeddings):
        self.index.add(doc_embeddings)

    def load(self, index_path):
        # logger.info(f"loading index from {index_path}...")
        index = faiss.read_index(index_path)
        if self.device != "cpu":
            co = faiss.GpuClonerOptions()
            co.useFloat16 = True
            index = faiss.index_cpu_to_gpu(faiss.StandardGpuResources(), self.device, index, co)
        self.index = index

    def save(self, index_path):
        logger.info(f"saving index at {index_path}...")
        if isinstance(self.index, faiss.GpuIndex):
            index = faiss.index_gpu_to_cpu(self.index)
        else:
            index = self.index
        faiss.write_index(index, index_path)

    def search(self, query, hits):
        return self.index.search(query, k=hits)


class DenseRetriever:
    def __init__(
        self, 
        encoder:str='BAAI/bge-large-en-v1.5', 
        pooling_method:List[str]=["cls"], 
        dense_metric:str="cos", 
        query_max_length:int=128, 
        key_max_length:int=512, 
        hits:int=10, 
        dtype:str="fp16", 
        cache_dir:Optional[str]=None, 
        query_instruct:str=None, 
        doc_instruct:str=None,
        load_in_4bit:bool=False) -> None:
        self.name = encoder
        self.query_instruct = query_instruct
        self.doc_instruct = doc_instruct

        self.pooling_method = pooling_method
        self.dense_metric = dense_metric
        self.query_max_length = query_max_length
        self.key_max_length = key_max_length
        self.hits = hits
        logger.info(f"Loading tokenizer and model from {encoder}...")

        if dtype == "bf16":
            dtype = torch.bfloat16
        elif dtype == "fp16":
            dtype = torch.float16
        else:
            dtype = torch.float32

        self.tokenizer = AutoTokenizer.from_pretrained(encoder, cache_dir=cache_dir)
        self.encoder = AutoModel.from_pretrained(encoder, cache_dir=cache_dir, torch_dtype=dtype, device_map={'': "cuda"}, load_in_4bit=load_in_4bit).eval()

        self.ndim = self.encoder.config.hidden_size
        self._index = None
        self.docs = []

    @property
    def device(self):
        return self.encoder.device

    @property
    def num_keys(self):
        if self._index is not None:
            return self._index.index.ntotal
        else:
            return 0

    def _prepare(self, inputs: Union[str, List[str], Mapping], field="key"):
        """Convert inputs into tokenized input_ids"""
        if isinstance(inputs, str) or (isinstance(inputs, list) and isinstance(inputs[0], str)):
            if field == "key":
                inputs = self.tokenizer(
                    inputs, return_tensors="pt", padding=True, truncation=True, max_length=self.key_max_length)
                inputs = inputs.to(self.device)
            elif field == "query":
                inputs = self.tokenizer(
                    inputs, return_tensors="pt", padding=True, truncation=True, max_length=self.query_max_length)
                inputs = inputs.to(self.device)
            else:
                raise NotImplementedError
        elif isinstance(inputs, Mapping) and "input_ids" in inputs:
            if field == "key":
                for k, v in inputs.items():
                    inputs[k] = v[:, :self.key_max_length].to(self.device)
            elif field == "query":
                for k, v in inputs.items():
                    inputs[k] = v[:, :self.query_max_length].to(self.device)
            else:
                raise NotImplementedError
        else:
            raise ValueError(f"Expected inputs of type str, list[str], or dict, got {type(inputs)}!")
        return inputs

    def _pool(self, embeddings, attention_mask):
        if "mean" in self.pooling_method:
            embeddings = embeddings.masked_fill(
                ~attention_mask[..., None].bool(), 0.0)
            embedding = embeddings.sum(
                dim=1) / attention_mask.sum(dim=1, keepdim=True)
        elif "cls" in self.pooling_method:
            embedding = embeddings[:, 0]
        else:
            raise NotImplementedError(
                f"Pooling_method {self.pooling_method} not implemented!")
        return embedding

    @torch.no_grad()
    def encode(self, inputs: Union[str, List[str], Mapping], field:str="key"):
        """Encode inputs into embeddings

        Args:
            inputs: can be string, list of strings, or BatchEncoding results from tokenizer

        Returns:
            Tensor: [batch_size, d_embed]
        """
        inputs = self._prepare(inputs, field=field)
        encoder = self.encoder

        embeddings = encoder(**inputs).last_hidden_state    # B, L, D
        embedding = self._pool(embeddings, inputs["attention_mask"])
        if self.dense_metric == "cos":
            embedding = torch.nn.functional.normalize(embedding, p=2, dim=1)
        return embedding

    def remove_all(self):
        """Remove all keys from the index."""
        if self._index is not None:
            self._index.index.reset()
        self.docs = []

    @torch.no_grad()
    def add(self, docs: List[str], index_factory:str="Flat", batch_size=500):
        """Build faiss index.
        
        Args:
            shard_across_devices: split the corpus onto all devices and encode them
        """
        if len(docs) == 0:
            return

        metric = self.dense_metric
        doc_embeddings = np.zeros((len(docs), self.ndim), dtype=np.float32)

        for i in range(0, len(docs), batch_size):
            batch_docs = docs[i: i + batch_size]
            embeddings = self.encode(batch_docs)    # batch_size, ndim
            doc_embeddings[i: i + batch_size] = embeddings.cpu().numpy()

        if self._index is None:
            index = FaissIndex(self.device)
            index.build(doc_embeddings, index_factory, metric)
            self._index = index
        else:
            self._index.add(doc_embeddings)

        self.docs.extend(docs)

    @torch.no_grad()
    def search(self, queries: Union[str, List[str]], hits:Optional[int]=None):
        if hits is None:
            hits = self.hits
    
        assert self._index is not None, "Make sure there is an indexed corpus!"

        embeddings = self.encode(queries, field="query").cpu().numpy().astype(np.float32, order="C")
        scores, indices = self._index.search(embeddings, hits)
        return scores, indices


```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #65** (2025-05-12): **我还是很好奇这个模型架构**
  *Symptoms*: 我大概能看懂加宽注意力头，多出来的宽度用来压缩历史上下文这个idea。  但是我没有找到过一模一样的实现，我参考过TransformerXL, Compressive Transformer, Memory Transformer等等文献，都没有找到这种直接在现成指令微调模型基础上加参数修改的做法。  我想问问这部分的设计是作者纯原创的吗，还是参考了哪篇我没读过的论文？还请指点迷津。  另外，开放模型训练代码还有戏吗？因为目前两个基模上下文窗口内的的大海捞针效果都不行，微调（这也许也算一种微调？）后估计也不会好到哪里去。如果换成新出的可以百分百通过大海捞针测试的Qwen2.5-1M-14B这种本体就1000k的基模，微调后记忆能力不是无敌了。
  **Post-Mortem & Fix Analysis**:
  > The same issue
  > You can refer to the ICLR paper (https://openreview.net/forum?id=1eQT9OzfNQ) for more details about the architecture. As mentioned in the technical report, it's OK to either use a lightweight long-context LLM directly for memorization or to apply KV compression for further scalability. 
  > Great! Finally published!

- **Issue #60** (2025-02-06): **When will training codes for memory model be release?**
  *Symptoms*: When will training codes for memory model be release? 
  **Post-Mortem & Fix Analysis**:
  > Yes, would release soon.
  > Thank you for your work.

- **Issue #58** (2025-01-19): **ValueError: `.to` is not supported for `4-bit` or `8-bit` bitsandbytes models**
  *Symptoms*: I got this error  Traceback (most recent call last):   File "/workspace/MemoRAG/test.py", line 4, in <module>     pipe = MemoRAG(            ^^^^^^^^   File "/workspace/MemoRAG/memorag/memorag.py", line 335, in __init__     self.mem_model = Memory(                      ^^^^^^^   File "/workspace/MemoRAG/memorag/memorag.py", line 188, in __init__     super().__init__(*args, **kwargs)   File "/workspace/MemoRAG/memorag/memorag.py", line 83, in __init__     self.model = AutoModelForCausalLM.from_pretrained(                  ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^   File "/root/miniconda3/lib/python3.12/site-packages/transformers/models/auto/auto_factory.py", line 559, in from_pretrained     return model_class.from_pretrained(            ^^^^^^^^^^^^^^^^^^^^^^^^^^^^   File "/root/.cache/huggingface/modules/transformers_modules/TommyChien/memorag-mistral-7b-inst/ded9a9fe7e6a56301b99d3774d4a29a5ef94f41a/modeling_mistral.py", line 1114, in from_pretrained     model, loading_info = super().from_pretrained(*args, **kwargs)                           ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^   File "/root/miniconda3/lib/python3.12/site-packages/transformers/modeling_utils.py", line 3977, in from_pretrained     dispatch_model(model, **device_map_kwargs)   File "/root/miniconda3/lib/python3.12/site-packages/accelerate/big_modeling.py", line 498, in dispatch_model     model.to(device)   File "/root/miniconda3/lib/python3.12/site-packages/transformers/modeling_utils.py", line 2826, in to     r
  **Post-Mortem & Fix Analysis**:
  > Hi @ardha27, I faced the same issue.  Installing transformer 4.46.3 version resolved the error
  > thanks for your solution!

- **Issue #49** (2024-11-25): **多卡 或者别的什么方式实现68k文本记忆**
  *Symptoms*: 我尝试在这个哈利波特的文本上复现 这个“When using the NVIDIA T4 16GiB, MemoRAG can handle databases with a context length of 68K tokens.” 但是不知为何按照example给的pipe=memorag(...)，连5k的文本memorize都爆显存。看起来mem-qwen大概8g,然后bge的检索模型2g，剩下的应该是够68k的上下文的？ 麻烦指教这个16G记忆68k上下文问答端到端的setup是什么。或者我怎么把这个代码用上多卡，这也算可以实现68k上下文的。
  **Post-Mortem & Fix Analysis**:
  > 可以参考这个notebook: https://colab.research.google.com/drive/1fPMXKyi4AwWSBkC7Xr5vBdpPpx9gDeFX?usp=sharing 

- **Issue #48** (2024-11-19): **DEMO**
  *Symptoms*: Hey there,   I’m really impressed with your work on this project! Do you have a date for the demo release? I’m eager to try it out in Streamlit.
  **Post-Mortem & Fix Analysis**:
  > Thank you for your interest in our work! We expect to release the demo code soon which I am working on. The current version of the demo code is not self-contained and requires deploying multiple Flask services with different modules in Memorag.

- **Issue #47** (2024-11-19): **论文中Qmem Kmem Vmem 的实现是？**
  *Symptoms*: 是否是和TransformerXL  (Dai et al., 2019) 当中的一样在新增加的token上循环更新？ Segment-Level Recurrence？
  **Post-Mortem & Fix Analysis**:
  > 看不懂huggingface上的代码beacon部分，没注释
  > 和TransformerXL不一样。之后代码我更新下注释。

- **Issue #46** (2024-11-13): **Memory模型能否支持API调用？**
  *Symptoms*: Memory模型能否支持API调用？
  **Post-Mortem & Fix Analysis**:
  > 支持API调用，请参考https://github.com/qhjqhj00/MemoRAG?tab=readme-ov-file#using-apis-as-generators

- **Issue #45** (2024-11-09): **The open source license in the readme does not match the actual situation**
  *Symptoms*: The open source license in the readme is MIT, which does not match the actual open source license  Please refer to this section:    > <a href="https://github.com/"><img alt="License" src="https://img.shields.io/badge/LICENSE-MIT-green"></a> 
  **Post-Mortem & Fix Analysis**:
  > thanks for your reminder.

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

### Incident Patch 1: `bc3d2020` (2024-10-17)
**Commit Message**: bugfix of `MemoRAG._generate_response`

**File**: `memorag/memorag.py` (modified, +6/-1)
```diff
@@ -466,10 +466,15 @@ def _generate_response(self, task_key: str, query: str, knowledge: str, prompt_t
             prompt = self.prompts[task_key].format(input=query, context=knowledge) if query else self.prompts[task_key].format(context=knowledge)
 
         if self.gen_model.__class__.__name__ == "Memory" and self.mem_model.memo_type == "beacon":
+            # `beacon` always has memory
             # self.gen_model._enable_beacon = False
             output = self.gen_model.generate(prompt, max_new_tokens=max_new_tokens)[0]
             # self.gen_model._enable_beacon = True
-        else:
+        elif self.gen_model.__class__.__name__ == "Memory" and self.mem_model.memo_type == "longllm": 
+            # `longllm` stores/restores memory by past_key_values, user can control it by `with_cache`
             output = self.gen_model.generate(prompt, max_new_tokens=max_new_tokens, with_cache=False)[0]
+        elif self.gen_model.__class__.__name__ == "Model":
+            # `Model.generate` does NOT have  parameter `with_cache`
+            output = self.gen_model.generate(prompt, max_new_tokens=max_new_tokens)[0]
         torch.cuda.empty_cache() 
         return output
```

---

### Incident Patch 2: `0b9c4716` (2024-09-13)
**Commit Message**: fix

**File**: `examples/longllm_as_memory.ipynb` (modified, +10/-4)
```diff
@@ -30,8 +30,11 @@
    "source": [
     "from memorag import MemoRAG\n",
     "model = MemoRAG(\n",
-    "    \"/share/qhj/LLMs/Llama3.1-8B-Chinese-Chat\", \n",
-    "    \"/share/shared_models/models--BAAI--bge-m3/snapshots/babcf60cae0a1f438d7ade582983d4ba462303c2\")"
+    "    mem_model_name_or_path=\"shenzhi-wang/Llama3.1-8B-Chinese-Chat\", \n",
+    "    ret_model_name_or_path=\"BAAI/bge-m3\",\n",
+    "    cache_dir=\"path_to_model_cache\",  # to specify local model cache directory (optional)\n",
+    "    access_token=\"hugging_face_access_token\"  # to specify local model cache directory (optional)\n",
+    "    )"
    ]
   },
   {
@@ -210,8 +213,11 @@
    "source": [
     "from memorag import MemoRAG\n",
     "model = MemoRAG(\n",
-    "    \"/share/qhj/LLMs/Meta-Llama-3.1-8B-Instruct\", \n",
-    "    \"/share/shared_models/models--BAAI--bge-m3/snapshots/babcf60cae0a1f438d7ade582983d4ba462303c2\")"
+    "    mem_model_name_or_path=\"meta-llama/Meta-Llama-3.1-8B-Instruct\", \n",
+    "    ret_model_name_or_path=\"BAAI/bge-m3\",\n",
+    "    cache_dir=\"path_to_model_cache\",  # to specify local model cache directory (optional)\n",
+    "    access_token=\"hugging_face_access_token\"  # to specify local model cache directory (optional)\n",
+    "    )"
    ]
   },
   {
```

---

### Incident Patch 3: `218fb0ae` (2024-09-09)
**Commit Message**: fix

**File**: `examples/longbench/eval.sh` (modified, +1/-1)
```diff
@@ -6,6 +6,6 @@ torchrun --nproc_per_node 8 -m longbench.eval \
             --gen_model_path mistralai/Mistral-7B-Instruct-v0.2 \
             --mem_model_path /share/qhj/memorag-qwen2-7b-inst \
             --ret_model_path BAAI/bge-m3 \
-            --access_token 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 \
+            --access_token [huggingface-token] \
             --eval_data data/longbench.json \
             --max_length 100000 \
```

#### Recent Merged Pull Requests:
- **PR #38** (2024-10-22): bugfix of `MemoRAG._generate_response` (@neofung)
- **PR #34** (2024-09-29): chore: separate cpu, cuda deps (@gusye1234)
- **PR #32** (2024-09-24): Tommy dev lite (@qhjqhj00)
- **PR #28** (2024-09-19): Merge pull request #27 from qhjqhj00/main (@qhjqhj00)
- **PR #27** (2024-09-19): merge (@qhjqhj00)
- **PR #24** (2024-09-18): docs: update README.md (@eltociear)
- **PR #23** (2024-09-14): Merge pull request #22 from qhjqhj00/main (@qhjqhj00)
- **PR #22** (2024-09-14): merge (@qhjqhj00)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
