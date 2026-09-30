# Forensic Learning Record (Deep Inspection): HKUDS/VideoRAG

> **Canonical Artifact**: `07_PROJECT_LEARNING/hkuds-videorag-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/HKUDS/VideoRAG](https://github.com/HKUDS/VideoRAG))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-09-30T21:07:25.096Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `HKUDS/VideoRAG`
- **Description**: [KDD'2026] "VideoRAG: Chat with Your Videos"
- **Primary Language / Ecosystem**: Python
- **Discovered Manifests / Configurations**: README.md
- **Stars / Engagement**: 3388 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `VideoRAG-algorithm/examples/process_videos_deepseek.py`
```
import os
import logging
import warnings
import multiprocessing

warnings.filterwarnings("ignore")
logging.getLogger("httpx").setLevel(logging.WARNING)

# 设置DeepSeek和硅基流动的API密钥
os.environ["DEEPSEEK_API_KEY"] = "sk-*******"
os.environ["SILICONFLOW_API_KEY"] = "sk-******"

from videorag._llm import deepseek_bge_config
from videorag import VideoRAG, QueryParam


if __name__ == '__main__':
    # 必须的设置
    multiprocessing.set_start_method('spawn')

    # 将你的视频文件路径放入这个列表中
    video_paths = [
        '/home/zy/VideoRAG/fc6207139422fa5f030113b7d79efe5e.mp4',
    ]
    
    # 初始化 VideoRAG，指定一个工作目录来存放索引文件
    videorag = VideoRAG(llm=deepseek_bge_config, working_dir=f"./videorag-workdir")
    
    # 开始处理视频
    videorag.insert_video(video_path_list=video_paths)
```

### Core Architecture Module: `VideoRAG-algorithm/examples/query_videos_deepseek.py`
```
import os
import logging
import warnings
import multiprocessing

warnings.filterwarnings("ignore")
logging.getLogger("httpx").setLevel(logging.WARNING)

# 设置DeepSeek和硅基流动的API密钥
os.environ["DEEPSEEK_API_KEY"] = "sk-*******"
os.environ["SILICONFLOW_API_KEY"] = "sk-*******"

from videorag._llm import deepseek_bge_config
from videorag import VideoRAG, QueryParam


if __name__ == '__main__':
    # 必须的设置
    multiprocessing.set_start_method('spawn')

    # 你想问的问题
    query = '请描述两个视频的主要内容是什么？'
    
    param = QueryParam(mode="videorag")
    # 如果设置为 False，返回的答案会附带视频片段的引用
    param.wo_reference = True

    # 初始化 VideoRAG，并确保工作目录与上一步骤中的一致
    videorag = VideoRAG(llm=deepseek_bge_config, working_dir=f"./videorag-workdir")
    videorag.load_caption_model(debug=False)
    
    # 执行查询
    response = videorag.query(query=query, param=param)
    
    # 打印结果
    print(response)
```

### Core Architecture Module: `VideoRAG-algorithm/longervideos/prepare_data.py`
```
import os
import json

with open('./dataset.json', 'rb') as f:
    longervideos = json.load(f)

collections = []
for _id in longervideos:
    collection = longervideos[_id][0]
    collection_name = f"{_id}-{collection['description']}"
    collections.append(collection_name)
    os.makedirs(os.path.join(collection_name, 'videos'), exist_ok=True)
    with open(os.path.join(collection_name, 'videos.txt'), 'w') as f:
        for i in range(len(collection['video_url'])):
            _url = collection['video_url'][i]
            f.write(f'{_url}')
            if i != len(collection['video_url']) - 1:
                f.write(f'\n')
```

### Core Architecture Module: `VideoRAG-algorithm/reproduce/quantitative_comparison/batch_quant_eval_calculate.py`
```
import os
import json
import random
import numpy as np
from tqdm import tqdm
from copy import deepcopy

baseline_model = 'naiverag'
evaluate_model = [
    'llamavid',
    'videoagent',
    'notebooklm',
    'videorag'
]

metrics = ['Comprehensiveness', 'Empowerment', 'Trustworthiness', 'Depth', 'Density', 'Overall Score']

base_dir = 'overall_comparison_video_understanding'
# Please enter the parsed result files ending with .json below.
result_file = [
    '',
    '',
    '',
    '',
    ''
]

domain_list = ['lecture', 'documentary', 'entertainment']

with open('../../longervideos/dataset.json', 'r') as f:
    all_data = json.load(f)

overall_score = {}
for _model in evaluate_model:
    overall_score[_model] = {}
    for _metric in metrics:
        overall_score[_model][_metric] = []

category_domain_dict = {}
for category_id in all_data:
    _domain = all_data[category_id][0]['type']
    category_domain_dict[category_id] = _domain
        
domain_score = {}
for domain in domain_list:
    domain_score[domain] = {}
    for _model in evaluate_model:
        domain_score[domain][_model] = {}
        for _metric in metrics:
            domain_score[domain][_model][_metric] = []

query_count = 0 
for category_id in tqdm(all_data):
    category = f"{category_id}-{all_data[category_id][0]['description']}"
    querys = all_data[category_id][0]['questions']
    query_count += len(querys)
    
    score = {}
    for _model in evaluate_model:
        score[_model] = {}
        for _metric in metrics:
            score[_model][_metric] = []
    
    for _file in result_file:
        result_path = f'./batch_requests/{base_dir}/{_file}'
        with open(result_path, 'r') as f:
            results = json.loads(f.read())
        
        for i in range(len(querys)):
            for _model in evaluate_model:
                query_id = querys[i]['id']
                evaluation_result = results[f'{category}++query{query_id}++base++answers-{baseline_model}++evaluate++answers-{_model}']

                for _metric in metrics:
                    _metric_score = evaluation_result[_metric]['Score']
                    score[_model][_metric].append(_metric_score)
                    overall_score[_model][_metric].append(_metric_score)
                    domain_score[category_domain_dict[category_id]][_model][_metric].append(_metric_score)
                    
with open(f'batch_requests/{base_dir}/{base_dir}.txt', 'a') as f:
    print(query_count)
    f.write(f'{query_count}\n')
    for _model in evaluate_model:
        print(_model)
        f.write(_model + '\n')
        for _domain in domain_list:
            print(_domain)
            f.write(_domain + '\n')
            for _metric in metrics:
                print(f'{np.array(domain_score[_domain][_model][_metric]).mean():.2f}', _metric)
                f.write(f'{np.array(domain_score[_domain][_model][_metric]).mean():.2f} {_metric}\n')
            print('----')
            f.write('----\n')
        print('All')
        f.write('All\n')
        for _metric in metrics:
            print(f'{np.array(overall_score[_model][_metric]).mean():.2f}', _metric)
            f.write(f'{np.array(overall_score[_model][_metric]).mean():.2f} {_metric}\n')
        print('====' * 8)
        f.write('====' * 8 + '\n')
```

### Core Architecture Module: `VideoRAG-algorithm/reproduce/quantitative_comparison/batch_quant_eval_download.py`
```
import os
os.environ["OPENAI_API_KEY"] = ""
import re
import time
import json
import jsonlines
import tiktoken

from tqdm import tqdm
from openai import OpenAI

client = OpenAI()

def obtain_ouput_file_id(batches):
    for batch in batches:
        print(client.batches.retrieve(batch))
        print(client.batches.retrieve(batch).output_file_id)

def download_result(result_files, base_dir):
    for _file in result_files:
        content = client.files.content(_file).content
        with open(f"batch_requests/{base_dir}/{_file}.temp", "wb") as f:
            f.write(content)
        results = []
        with open(f"batch_requests/{base_dir}/{_file}.temp", 'r') as f:
            for line in tqdm(f):
                json_object = json.loads(line.strip())
                results.append(json_object)
        with open(f"batch_requests/{base_dir}/{_file}.json", "w") as json_file:
            json.dump(results, json_file, indent=4)
        os.remove(f"batch_requests/{base_dir}/{_file}.temp")

# ================================

# Please enter the relevant batch ID here to obtain the output file ID.
batches = [
    '',
    '',
    '',
    '',
    ''
]
obtain_ouput_file_id(batches)

# Second Step: Please enter the output file ID below to download the output files.
# result_files = [
#     '',
#     '',
#     '',
#     '',
#     ''
# ]
# download_result(result_files, base_dir='overall_comparison_video_understanding')
```

### Core Architecture Module: `VideoRAG-algorithm/reproduce/quantitative_comparison/batch_quant_eval_parse.py`
```
import os
os.environ["OPENAI_API_KEY"] = ""
import time
import json
import threading
from tqdm import tqdm
from openai import OpenAI
from setproctitle import setproctitle

base_dir = 'overall_comparison_video_understanding'
# The JSON file contains the batch of requests created when the batch request was uploaded.
request_file = ''
# Please enter the output file ID below, which corresponds to the downloaded output files.
result_files = [
    '',
    '',
    '',
    '',
    ''
]

setproctitle(f"parse-result-{base_dir}")
print(f"Start parsing result files in {base_dir}...")

def check_response_valid(data):
    valid_keys = ['Comprehensiveness', 'Empowerment', 'Trustworthiness', 'Depth', 'Density', 'Overall Score']
    assert len(data) == 6
    assert set(list(data.keys())) == set(valid_keys)
    for _key in valid_keys:
        assert data[_key]["Score"] in [1, 2, 3, 4, 5]
        assert "Explanation" in list(data[_key].keys())

def process_file(_file, request_dict):
    client = OpenAI()
    with open(f'batch_requests/{base_dir}/{_file}.json', 'r') as f:
        data = json.load(f)
    assert len(data) == len(request_dict)
    parse_results = {}
    for i in range(len(data)):
        dp = data[i]
        custom_id = dp["custom_id"]
        try:
            json_data = json.loads(dp["response"]["body"]["choices"][0]["message"]["content"])
            check_response_valid(json_data)
            parse_results[custom_id] = json_data
        except Exception as e:
            print(f"{_file} ({i}/{len(data)}) Find error when parsing {custom_id} ({e}), re-request OpenAI")
            while True:
                try:
                    response = client.chat.completions.create(
                        model=request_dict[custom_id]["model"],
                        messages=request_dict[custom_id]["messages"],
                        response_format=request_dict[custom_id]["response_format"]
                    )
                    json_data = json.loads(response.choices[0].message.content)
                    check_response_valid(json_data)
                    parse_results[custom_id] = json_data
                    print(f"{_file} ({i}/{len(data)}) success re-request!")
                    time.sleep(1)
                    break
                except Exception as e:
                    print(f"{_file} ({i}/{len(data)}) {e}")
                    print(f"{_file} ({i}/{len(data)}) continue re-request OpenAI")
                    continue
    with open(f'batch_requests/{base_dir}/{_file}-parse-result.json', 'w') as f:
        json.dump(parse_results, f, indent=4, ensure_ascii=False)

request_dict = {}
with open(f'batch_requests/{base_dir}/{request_file}', 'r') as f:
    for _line in f.readlines():
        json_data = json.loads(_line)
        request_dict[json_data["custom_id"]] = {
            "model": json_data["body"]["model"],
            "messages": json_data["body"]["messages"],
            "response_format": json_data["body"]["response_format"]
        }

thread_list = []
for _file in result_files:
    thread = threading.Thread(target=process_file, args=(_file, request_dict))
    thread_list.append(thread)

for thread in thread_list:
    thread.setDaemon(True)
    thread.start()
    
for thread in thread_list:
    thread.join()

```

### Core Architecture Module: `VideoRAG-algorithm/reproduce/quantitative_comparison/batch_quant_eval_upload.py`
```
import os
os.environ["OPENAI_API_KEY"] = ""
import re
import time
import json
import jsonlines
import tiktoken
import itertools
from pydantic import BaseModel, Field
from typing import Literal

from tqdm import tqdm
from openai import OpenAI
from openai.lib._pydantic import to_strict_json_schema
from openai.lib._parsing._completions import type_to_response_format_param

encoding = tiktoken.encoding_for_model('gpt-4o-mini')

sys_prompt = """
---Role---
You are an expert evaluating an answer against a baseline answer based on these criteria: **Comprehensiveness**, **Empowerment**, **Trustworthiness**, **Depth** and **Density**.
"""

prompt = """
You are an expert evaluating an answer against a baseline answer based on these criteria: **Comprehensiveness**, **Empowerment**, **Trustworthiness**, **Depth** and **Density**.

- **Comprehensiveness**: How much detail does the answer provide to cover all aspects and details of the question?
- **Empowerment**: How well does the answer help the reader understand and make informed judgments about the topic?
- **Trustworthiness**: Does the answer provide sufficient detail and align with common knowledge, enhancing its credibility?
- **Depth**: Does the answer provide in-depth analysis or details, rather than just superficial information?
- **Density**: Does the answer contain relevant information without less informative or redundant content?

For the evaluated answer labeled "Evaluation Answer," assign a score from 1 to 5 for each criterion compared to the baseline answer labeled "Baseline Answer." Then, assign an overall score based on these criteria.
The evaluation scores are defined as follows:
- 1: Strongly worse than the baseline answer
- 2: Weakly worse than the baseline answer
- 3: Moderate compared to the baseline answer
- 4: Weakly better than the baseline answer
- 5: Strongly better than the baseline answer


Here is the question:
{query}

Here are the answers:

**Baseline Answer:**
{baseline_answer}

**Evaluation Answer:**
{evaluation_answer}


Evaluate the answer using the criteria listed above and provide detailed explanations for the scores.

Output your evaluation in the following JSON format:

{{
    "Comprehensiveness": {{
        "Score": "[1 - 5]",
        "Explanation": "[Provide explanation here]"
    }},
    "Empowerment": {{
        "Score": "[1 - 5]",
        "Explanation": "[Provide explanation here]"
    }},
    "Trustworthiness": {{
        "Score": "[1 - 5]",
        "Explanation": "[Provide explanation here]"
    }},
    "Depth": {{
        "Score": "[1 - 5]",
        "Explanation": "[Provide explanation here]"
    }},
    "Density": {{
        "Score": "[1 - 5]",
        "Explanation": "[Provide explanation here]"
    }}
    "Overall Score": {{
        "Score": "[1 - 5]",
        "Explanation": "[Provide explanation here]"
    }}
}}
"""

class Criterion(BaseModel):
    Score: int
    Explanation: str

class Result(BaseModel):
    Comprehensiveness: Criterion
    Empowerment: Criterion
    Trustworthiness: Criterion
    Depth: Criterion
    Density: Criterion
    Overall_Score: Criterion = Field(alias="Overall Score")

result_response_format = type_to_response_format_param(Result)

if __name__ == "__main__":
    with open('../../longervideos/dataset.json', 'r') as f:
        questions = json.load(f)
        
    baseline_answer_dir = 'answers-naiverag'
    base_dir = 'overall_comparison_video_understanding'
    evaluation_answer_dir = [ 
        'answers-videorag',
        'answers-notebooklm',
        'answers-llamavid',
        'answers-videoagent'
    ]
    
    requests = []
    total_token_count = 0
    for _id in questions:
        video_list_name = questions[_id][0]['description']
        video_querys = questions[_id][0]['questions']
        data_path = f"../all_answers/{_id}-{video_list_name}"
        for _evaluation_answer_dir in evaluation_answer_dir:
            baseline_work_dir = os.path.join(data_path, baseline_answer_dir)
            evaluation_work_dir = os.path.join(data_path, _evaluation_answer_dir)
            for i in range(len(questions[_id][0]['questions'])):
                # query
                query_id = questions[_id][0]['questions'][i]["id"]
                query = questions[_id][0]['questions'][i]["question"]
                # baseline answer
                with open(os.path.join(baseline_work_dir, f'answer_{query_id}.md'), 'r') as f:
                    baseline_answer = f.read()
                # evaluation answer
                with open(os.path.join(evaluation_work_dir, f'answer_{query_id}.md'), 'r') as f:
                    evaluation_answer = f.read()
                request_prompt = prompt.format(query=query, baseline_answer=baseline_answer, evaluation_answer=evaluation_answer)
                
                request_data = {
                    "custom_id": f"{_id}-{video_list_name}++query{query_id}++base++{baseline_answer_dir}++evaluate++{_evaluation_answer_dir}",
                    "method": "POST",
                    "url": "/v1/chat/completions",
                    "body": {
                        "model": "gpt-4o-mini",
                        "messages": [
                            {"role": "system", "content": sys_prompt},
                            {"role": "user", "content": request_prompt},
                        ],
                        "response_format": result_response_format
                    },
                }
                requests.append(request_data)
                total_token_count += len(encoding.encode(request_prompt))
    
    run_time = 5
    os.makedirs(f'batch_requests/{base_dir}', exist_ok=True)
    request_json_file_path = f'batch_requests/{base_dir}/{int(time.time())}.json'
    with jsonlines.open(request_json_file_path, mode="w") as writer:
        for request in requests:
            writer.write(request)
    print(f"Batch API requests written to {request_json_file_path}")
    print(f"Price: {total_token_count / 1000000 * 0.075 * run_time}$")
    
    for k in range(run_time):
        client = OpenAI()
        batch_input_file = client.files.create(
            file=open(request_json_file_path, "rb"), purpose="batch"
        )
        batch_input_file_id = batch_input_file.id
        
        batch = client.batches.create(
            input_file_id=batch_input_file_id,
            endpoint="/v1/chat/completions",
            completion_window="24h",
            metadata={"description": f"runtime{k} - a very nice and successful eval job: {request_json_file_path}"},
        )
        print(f"RunTime {k}: Batch {batch.id} has been created.")
```

### Core Architecture Module: `VideoRAG-algorithm/reproduce/winrate_comparison/batch_winrate_eval_calculate.py`
```
import json
from tqdm import tqdm

# the model_a in fixed as videorag
model_a = 'videorag'
# pick the model_b from ['naiverag', 'graphrag-local', 'graphrag-global', 'lightrag-hybrid']
model_b = 'naiverag'

metrics = ['Comprehensiveness', 'Empowerment', 'Trustworthiness', 'Depth', 'Density', 'Overall Winner']

base_dir = 'overall_comparison_rag'
# Please enter the parsed result files ending with .json below.
result_file = [
    '',
    '',
    '',
    '',
    ''
]

domain_list = ['lecture', 'documentary', 'entertainment']

with open('../../longervideos/dataset.json', 'r') as f:
    all_data = json.load(f)

overall_win_count = {}
for _metric in metrics:
    overall_win_count[_metric] = {'a': 0, 'b': 0}

category_domain_dict = {}
for category_id in all_data:
    _domain = all_data[category_id][0]['type']
    category_domain_dict[category_id] = _domain
        
domain_win_count = {}
for domain in domain_list:
    domain_win_count[domain] = {}
    for _metric in metrics:
        domain_win_count[domain][_metric] = {'a': 0, 'b': 0}

query_count = 0 
for category_id in tqdm(all_data):
    category = f"{category_id}-{all_data[category_id][0]['description']}"
    querys = all_data[category_id][0]['questions']
    query_count += len(querys)
    win_count = {}
    for _metric in metrics:
        win_count[_metric] = {'a': 0, 'b': 0}
    
    for _file in result_file:
        result_path = f'./batch_requests/{base_dir}/{_file}'
        with open(result_path, 'r') as f:
            results = json.loads(f.read())
        
        for i in range(len(querys)):
            query_id = querys[i]['id']
            ori_result = results[f'{category}++query{query_id}++answers-{model_a}++answers-{model_b}++ori']
            rev_result = results[f'{category}++query{query_id}++answers-{model_b}++answers-{model_a}++rev']
            assert ori_result[_metric]['Winner'] in ['Answer 1', 'Answer 2']
            # original order
            for _metric in metrics:
                winner = 'a' if ('1' in ori_result[_metric]['Winner']) else 'b'
                win_count[_metric][winner] += 1
                domain_win_count[category_domain_dict[category_id]][_metric][winner] += 1
                overall_win_count[_metric][winner] += 1
            # reverse order
            for _metric in metrics:
                winner = 'b' if ('1' in rev_result[_metric]['Winner']) else 'a'
                win_count[_metric][winner] += 1
                domain_win_count[category_domain_dict[category_id]][_metric][winner] += 1
                overall_win_count[_metric][winner] += 1
            
    
with open(f'batch_requests/{base_dir}/{base_dir}.txt', 'a') as f:
    print(query_count)
    print('a', model_a)
    f.write('a ' + model_a + '\n')
    print('b', model_b)
    f.write('b ' + model_b + '\n')
    for domain in domain_list:
        print(f'(left) {model_a} : (right) {model_b} \t {domain}')
        f.write(f'(left) {model_a} : (right) {model_b} \t {domain}' + '\n')
        for _metric in metrics:
            total_count = domain_win_count[domain][_metric]['a'] + domain_win_count[domain][_metric]['b']
            win_a_percentage = (domain_win_count[domain][_metric]['a'] / total_count) * 100
            win_b_percentage = (domain_win_count[domain][_metric]['b'] / total_count) * 100
            print(f'{win_a_percentage:.2f}% : {win_b_percentage:.2f}%', domain_win_count[domain][_metric], _metric)
            f.write(f'{win_a_percentage:.2f}% : {win_b_percentage:.2f}% {domain_win_count[domain][_metric]} {_metric} \n')
        print('----'*8)
        f.write('----'*8 + '\n')
    print(f'(left) {model_a} : (right) {model_b} \t overall comparision')
    f.write(f'(left) {model_a} : (right) {model_b} \t overall comparision\n')
    for _metric in metrics:
        total_count = overall_win_count[_metric]['a'] + overall_win_count[_metric]['b']
        win_a_percentage = (overall_win_count[_metric]['a'] / total_count) * 100
        win_b_percentage = (overall_win_count[_metric]['b'] / total_count) * 100
        print(f'{win_a_percentage:.2f}% : {win_b_percentage:.2f}%', overall_win_count[_metric], _metric)
        f.write(f'{win_a_percentage:.2f}% : {win_b_percentage:.2f}% {overall_win_count[_metric]} {_metric} \n')
    f.write('====' * 8 + '\n\n')
```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #41** (2026-05-25): **docs: fix README parameters typos**
  *Symptoms*: ## Summary - fix two `paramters` typos in the VideoRAG algorithm README  ## Validation - `git diff --check` - `! grep -R "paramters" -n VideoRAG-algorithm/README.md`  Category: docs typo Confidence: 85/100

- **Issue #40** (2026-05-25): **docs: fix README parameters typos**
  *Symptoms*: ## Summary - fix two `paramters` typos in the VideoRAG algorithm README  ## Validation - `git diff --check`  Confidence: 85/100 (docs/typo)

- **Issue #38** (2026-04-04): **Graph traversal summarization**
  *Symptoms*: 
  **Post-Mortem & Fix Analysis**:
  > Jk

- **Issue #34** (2026-01-11): **Fix GPU crash on Linux (#30)**
  *Symptoms*: Hey! This fixes the GPU crash issue reported in #30. The app was failing to start on Linux with the error: `viz_main_impl.cc(185): Exiting GPU process due to errors during initialization` This is a common Electron issue on systems where the GPU drivers don't play nice. The fix is simple, I just added **app.disableHardwareAcceleration()** in main.ts before the app starts. Also cleaned up a small **CSP typo** in index.html (URLs shouldn't be quoted) and added the **missing name/version fields** to package.json while I was in there. Should work fine now on Linux and other systems that were having GPU trouble! 👍
  **Post-Mortem & Fix Analysis**:
  > lgtm

- **Issue #31** (2025-10-09): **Refactoring for Whizzhive**
  *Symptoms*: 

- **Issue #27** (2025-09-02): **和英伟达的VSS解决方案很相似**
  *Symptoms*: https://github.com/NVIDIA-AI-Blueprints/video-search-and-summarization
  **Post-Mortem & Fix Analysis**:
  > 嗨👋！  感谢您对VideoRAG的关注！非常感谢您的分享，VideoRAG的开源时间比VSS略早一点，二者应该算是同期的工作，欢迎大家取长补短。  <img width="915" height="565" alt="Image" src="https://github.com/user-attachments/assets/a949c970-2ef2-4826-b032-30eef20786e4" />  Best regards， Xubin

- **Issue #26** (2025-07-30): **feat:add deepseek and bge support**
  *Symptoms*: ### 功能描述 我为VideoRAG库添加了对DeepSeek LLM模型和BAAI/bge-m3嵌入模型的支持，扩展了原本仅支持OpenAI接口的限制。  ### 新增功能 1. **DeepSeek LLM支持**    - 添加了`deepseek_complete_if_cache()`和`deepseek_complete()`函数    - 支持通过DeepSeek API (https://api.deepseek.com/v1) 调用`deepseek-chat`模型    - 包含重试机制和缓存功能  2. **BAAI/bge-m3嵌入模型支持**    - 添加了`bge_m3_embedding()`函数    - 支持通过硅基流动API (https://api.siliconflow.cn/v1/embeddings) 调用BAAI/bge-m3模型    - 使用1024维向量嵌入，提供更好的语义理解能力  3. **新的配置选项**    - 新增`deepseek_bge_config`配置对象    - 集成了DeepSeek LLM和BAAI/bge-m3嵌入模型的完整配置    - 保持了与现有配置结构的一致性  ### 技术实现 - 使用`httpx`库进行异步API调用 - 实现了与现有OpenAI接口相同的重试和缓存机制 - 保持了原有的`LLMConfig`数据结构兼容性 - 添加了环境变量支持：`DEEPSEEK_API_KEY`和`SILICONFLOW_API_KEY`  ### 使用示例 ```python from videorag._llm import deepseek_bge_config from videorag import VideoRAG  # 设置API密钥 os.environ["DEEPSEEK_API_KEY"] = "your-deepseek-api-key" os.environ["SILICONFLOW_API_KEY"] = "your-siliconflow-api-key"  # 使用新配置初始化VideoRAG videorag = VideoRAG(llm=deepseek_bge_config, working_dir="./videorag-workdir") ```  ### 优势 - **成本效益**：DeepSeek和硅基流动的API价格更具竞争力 - **性能提升**：BAAI/bge-m3模型在中文语义理解方面表现优异 - **灵活性**：用户可以根据需求选择不同的模型组合 - **向后兼容**：不影响现有的OpenAI配置使用  ### 依赖要求 - 新增`httpx`库依赖用于API调用  这个功能扩展让VideoRAG库能够支持更多样化的模型选择，为用户提供了更大的灵活性，特别是在中文视频内容处理方面。
  **Post-Mortem & Fix Analysis**:
  > Thanks for your contribution!

- **Issue #25** (2025-07-30): **feat: add DeepSeek and BGE model support**
  *Symptoms*: ### 功能描述 我为VideoRAG库添加了对DeepSeek LLM模型和BAAI/bge-m3嵌入模型的支持，扩展了原本仅支持OpenAI接口的限制。  ### 新增功能 1. **DeepSeek LLM支持**    - 添加了`deepseek_complete_if_cache()`和`deepseek_complete()`函数    - 支持通过DeepSeek API (https://api.deepseek.com/v1) 调用`deepseek-chat`模型    - 包含重试机制和缓存功能  2. **BAAI/bge-m3嵌入模型支持**    - 添加了`bge_m3_embedding()`函数    - 支持通过硅基流动API (https://api.siliconflow.cn/v1/embeddings) 调用BAAI/bge-m3模型    - 使用1024维向量嵌入，提供更好的语义理解能力  3. **新的配置选项**    - 新增`deepseek_bge_config`配置对象    - 集成了DeepSeek LLM和BAAI/bge-m3嵌入模型的完整配置    - 保持了与现有配置结构的一致性  ### 技术实现 - 使用`httpx`库进行异步API调用 - 实现了与现有OpenAI接口相同的重试和缓存机制 - 保持了原有的`LLMConfig`数据结构兼容性 - 添加了环境变量支持：`DEEPSEEK_API_KEY`和`SILICONFLOW_API_KEY`  ### 使用示例 ```python from videorag._llm import deepseek_bge_config from videorag import VideoRAG  # 设置API密钥 os.environ["DEEPSEEK_API_KEY"] = "your-deepseek-api-key" os.environ["SILICONFLOW_API_KEY"] = "your-siliconflow-api-key"  # 使用新配置初始化VideoRAG videorag = VideoRAG(llm=deepseek_bge_config, working_dir="./videorag-workdir") ```  ### 优势 - **成本效益**：DeepSeek和硅基流动的API价格更具竞争力 - **性能提升**：BAAI/bge-m3模型在中文语义理解方面表现优异 - **灵活性**：用户可以根据需求选择不同的模型组合 - **向后兼容**：不影响现有的OpenAI配置使用  ### 依赖要求 - 新增`httpx`库依赖用于API调用  这个功能扩展让VideoRAG库能够支持更多样化的模型选择，为用户提供了更大的灵活性，特别是在中文视频内容处理方面。

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

### Incident Patch 1: `9e0d1aec` (2026-01-08)
**Commit Message**: fix: GPU process crash and minor improvements (#30)

- Disable hardware acceleration to fix GPU initialization errors on Linux

- Fix CSP syntax (URLs should not be quoted)

- Add missing name/version/description to package.json

**File**: `Vimo-desktop/package.json` (modified, +3/-0)
```diff
@@ -1,4 +1,7 @@
 {
+  "name": "vimo-desktop",
+  "version": "0.1.0",
+  "description": "Vimo Desktop - Chat with Your Videos using VideoRAG",
   "main": "./dist/main/main.js",
   "packageManager": "pnpm@9.10.0",
   "scripts": {
```

**File**: `Vimo-desktop/src/main/main.ts` (modified, +34/-31)
```diff
@@ -8,6 +8,9 @@ import { registerFileHandlers } from './handlers/file-handlers';
 import { registerSettingsHandlers } from './handlers/settings';
 import { registerChatSessionHandlers } from './handlers/chat-session-handlers';
 
+// Fix for GPU process crash on Linux and some other systems
+// See: https://github.com/electron/electron/issues/13936
+app.disableHardwareAcceleration();
 
 // Create window when app is ready
 app.whenReady().then(() => {
@@ -55,16 +58,16 @@ function registerModelHandlers(): void {
   ipcMain.handle('check-model-files', async (_, storeDirectory: string) => {
     try {
       const { access } = require('fs/promises');
-      
+
       const imagebindPath = join(storeDirectory, 'imagebind_huge', 'imagebind_huge.pth');
-      
+
       let imagebind = false;
-      
+
       try {
         await access(imagebindPath);
         imagebind = true;
-      } catch {}
-      
+      } catch { }
+
       return { imagebind };
     } catch (error) {
       return { imagebind: false };
@@ -77,35 +80,35 @@ function registerModelHandlers(): void {
       const https = require('https');
       const { createWriteStream, mkdirSync, existsSync } = require('fs');
       const { access } = require('fs/promises');
-      
+
       // Create directory if it doesn't exist
       if (!existsSync(storeDirectory)) {
         mkdirSync(storeDirectory, { recursive: true });
       }
-      
+
       // Create imagebind_huge directory
       const imagebindDir = join(storeDirectory, 'imagebind_huge');
       if (!existsSync(imagebindDir)) {
         mkdirSync(imagebindDir, { recursive: true });
       }
-      
+
       const imagebindPath = join(imagebindDir, 'imagebind_huge.pth');
-      
+
       // Check if file already exists
       try {
         await access(imagebindPath);
         return { success: true, message: 'ImageBind model already exists' };
       } catch {
         // File doesn't exist, proceed with download
       }
-      
+
       const url = 'https://dl.fbaipublicfiles.com/imagebind/imagebind_huge.pth';
-    
-    return new Promise((resolve) => {
+
+      return new Promise((resolve) => {
         const file = createWriteStream(imagebindPath);
         let downloadedBytes = 0;
         let totalBytes = 0;
-        
+
         const request = https.get(url, (response) => {
           if (response.statusCode !== 200) {
             // Delete the entire imagebind_huge directory on HTTP error
@@ -118,30 +121,30 @@ function registerModelHandlers(): void {
             resolve({ success: false, error: `HTTP ${response.statusCode}: ${response.statusMessage}` });
             return;
           }
-          
+
           totalBytes = parseInt(response.headers['content-length'] || '0', 10);
-          
+
           response.on('data', (chunk) => {
             downloadedBytes += chunk.length;
             if (totalBytes > 0) {
               const progress = Math.round((downloadedBytes / totalBytes) * 100);
-          event.sender.send('download-progress', { 
-            type: 'imagebind', 
+              event.sender.send('download-progress', {
+                type: 'imagebind',
                 progress,
                 downloaded: downloadedBytes,
                 total: totalBytes
               });
             }
-        });
-        
-        response.pipe(file);
-        
-        file.on('finish', () => {
-          file.close();
+          });
+
+          response.pipe(file);
+
+          file.on('finish', () => {
+            file.close();
             resolve({ success: true, message: 'ImageBind download completed' });
-        });
-        
-        file.on('error', (err) => {
+          });
+
+          file.on('error', (err) => {
             file.close();
             // Delete the entire imagebind_huge directory on error
             const { rmSync } = require('fs');
@@ -150,10 +153,10 @@ function registerModelHandlers(): void {
             } catch (cleanupError) {
               console.e
```

**File**: `Vimo-desktop/src/renderer/index.html` (modified, +1/-1)
```diff
@@ -5,7 +5,7 @@
     <title>VideoRAG</title>
     <meta
       http-equiv="Content-Security-Policy"
-      content="default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline' 'https://fonts.googleapis.com'; font-src 'self' 'https://fonts.gstatic.com';"
+      content="default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com;"
     />
     <link rel="preconnect" href="https://fonts.googleapis.com">
     <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
```

---

### Incident Patch 2: `d051a85e` (2025-11-22)
**Commit Message**: fix use_cache in vimo

**File**: `Vimo-desktop/python_backend/videorag/_llm.py` (modified, +5/-2)
```diff
@@ -100,6 +100,8 @@ async def openai_complete_if_cache(
 ) -> str:
     openai_async_client = get_openai_async_client_instance(kwargs["global_config"])
     hashing_kv: BaseKVStorage = kwargs.pop("hashing_kv", None)
+    use_cache = kwargs.pop("use_cache", True)
+
     # Remove global_config from kwargs as it's not needed for OpenAI API call
     kwargs.pop("global_config", None)
     
@@ -108,7 +110,8 @@ async def openai_complete_if_cache(
         messages.append({"role": "system", "content": system_prompt})
     messages.extend(history_messages)
     messages.append({"role": "user", "content": prompt})
-    if hashing_kv is not None:
+
+    if hashing_kv is not None and use_cache:
         args_hash = compute_args_hash(model, messages)
         if_cache_return = await hashing_kv.get_by_id(args_hash)
         # NOTE: I update here to avoid the if_cache_return["return"] is None
@@ -119,7 +122,7 @@ async def openai_complete_if_cache(
         model=model, messages=messages, **kwargs
     )
 
-    if hashing_kv is not None:
+    if hashing_kv is not None and use_cache:
         await hashing_kv.upsert(
             {args_hash: {"return": response.choices[0].message.content, "model": model}}
         )
```

---

### Incident Patch 3: `d9ce1cc7` (2025-11-19)
**Commit Message**: fix use_cache

**File**: `VideoRAG-algorithm/videorag/_op.py` (modified, +2/-2)
```diff
@@ -909,7 +909,7 @@ async def _filter_single_segment(knowledge: str, segment_key_dp: tuple[str, str]
     response = await use_model_func(
         query,
         system_prompt=sys_prompt,
-        use_cache=False,
+        # use_cache=False,
     )
     while True:
         try:
@@ -921,6 +921,6 @@ async def _filter_single_segment(knowledge: str, segment_key_dp: tuple[str, str]
             response = await use_model_func(
                 query,
                 system_prompt=sys_prompt,
-                use_cache=False,
+                # use_cache=False,
             )
     
\ No newline at end of file
```

---

### Incident Patch 4: `2d94a37e` (2025-03-27)
**Commit Message**: update async bug again

**File**: `videorag/videorag.py` (modified, +1/-1)
```diff
@@ -194,7 +194,7 @@ def __post_init__(self):
         self.llm.best_model_func = limit_async_func_call(self.llm.best_model_max_async)(
             partial(self.llm.best_model_func, hashing_kv=self.llm_response_cache)
         )
-        self.llm.best_model_func = limit_async_func_call(self.llm.cheap_model_max_async)(
+        self.llm.cheap_model_func = limit_async_func_call(self.llm.cheap_model_max_async)(
             partial(self.llm.cheap_model_func, hashing_kv=self.llm_response_cache)
         )
 
```

---

### Incident Patch 5: `d82858c3` (2025-03-26)
**Commit Message**: update async bug

**File**: `videorag/videorag.py` (modified, +2/-2)
```diff
@@ -191,10 +191,10 @@ def __post_init__(self):
             )
         )
         
-        self.best_model_func = limit_async_func_call(self.llm.best_model_max_async)(
+        self.llm.best_model_func = limit_async_func_call(self.llm.best_model_max_async)(
             partial(self.llm.best_model_func, hashing_kv=self.llm_response_cache)
         )
-        self.cheap_model_func = limit_async_func_call(self.llm.cheap_model_max_async)(
+        self.llm.best_model_func = limit_async_func_call(self.llm.cheap_model_max_async)(
             partial(self.llm.cheap_model_func, hashing_kv=self.llm_response_cache)
         )
 
```

---

### Incident Patch 6: `d9f4897d` (2025-02-25)
**Commit Message**: fix retry position

**File**: `videorag/_llm.py` (modified, +5/-6)
```diff
@@ -40,12 +40,6 @@ def get_ollama_async_client_instance():
         global_ollama_client = AsyncClient()  # Adjust base URL if necessary        
     return global_ollama_client
 
-@retry(
-    stop=stop_after_attempt(5),
-    wait=wait_exponential(multiplier=1, min=4, max=10),
-    retry=retry_if_exception_type((RateLimitError, APIConnectionError)),
-)
-
 # Setup LLM Configuration.
 @dataclass
 class LLMConfig:
@@ -89,6 +83,11 @@ def __post_init__(self):
         )
 
 ##### OpenAI Configuration
+@retry(
+    stop=stop_after_attempt(5),
+    wait=wait_exponential(multiplier=1, min=4, max=10),
+    retry=retry_if_exception_type((RateLimitError, APIConnectionError)),
+)
 async def openai_complete_if_cache(
     model, prompt, system_prompt=None, history_messages=[], **kwargs
 ) -> str:
```

---

### Incident Patch 7: `2f2678db` (2025-02-23)
**Commit Message**: Remove debugging print statement

**File**: `videorag/_op.py` (modified, +0/-1)
```diff
@@ -414,7 +414,6 @@ async def _process_single_content(chunk_key_dp: tuple[str, TextChunkSchema]):
             if record is None:
                 continue
             record = record.group(1)
-            print(record)            
             record_attributes = split_string_by_multi_markers(
                 record, [context_base["tuple_delimiter"]]
             )
```

---

### Incident Patch 8: `7f2989c4` (2025-02-19)
**Commit Message**: Fix analyzing vidoes. Changes should be all done

**File**: `longervideos/videorag_experiment.py` (modified, +1/-2)
```diff
@@ -38,8 +38,7 @@
     with open(f'longervideos/dataset.json', 'r') as f:
         longervideos = json.load(f)
     
-    #videorag = VideoRAG(cheap_model_func=gpt_4o_mini_complete, best_model_func=gpt_4o_mini_complete, working_dir=f"./videorag-workdir/{sub_category}")
-    videorag = VideoRAG(cheap_model_func=ollama_mini_complete, best_model_func=ollama_complete, working_dir=f"./videorag-workdir/{sub_category}")        
+    videorag = VideoRAG(llm=ollama_config, working_dir=f"./videorag-workdir/{sub_category}")        
     videorag.load_caption_model(debug=False)
     
     answer_folder = f'./videorag-answers/{sub_category}'
```

**File**: `videorag/_op.py` (modified, +3/-3)
```diff
@@ -183,8 +183,8 @@ async def _handle_entity_relation_summary(
     description: str,
     global_config: dict,
 ) -> str:
-    use_llm_func: callable = global_config["cheap_model_func"]
-    llm_max_tokens = global_config["cheap_model_max_token_size"]
+    use_llm_func: callable = global_config["llm"]["cheap_model_func"]
+    llm_max_tokens = global_config["llm"]["cheap_model_max_token_size"]
     tiktoken_model_name = global_config["tiktoken_model_name"]
     summary_max_tokens = global_config["entity_summary_to_max_tokens"]
 
@@ -359,7 +359,7 @@ async def extract_entities(
     entity_vdb: BaseVectorStorage,
     global_config: dict,
 ) -> Union[BaseGraphStorage, None]:
-    use_llm_func: callable = global_config["best_model_func"]
+    use_llm_func: callable = global_config["llm"]["best_model_func"]
     entity_extract_max_gleaning = global_config["entity_extract_max_gleaning"]
     
     ordered_chunks = list(chunks.items())
```

---

### Incident Patch 9: `a712ce52` (2025-02-18)
**Commit Message**: Fixed issues due to refactoring of configuration.
Q&A works, still need to test building

**File**: `longervideos/videorag_experiment.py` (modified, +2/-3)
```diff
@@ -21,7 +21,7 @@
 os.environ["CUDA_VISIBLE_DEVICES"] = args.cuda
 os.environ["OPENAI_API_KEY"] = ""
 
-from videorag._llm import *
+from videorag._llm import openai_config, azure_openai_config, ollama_config
 from videorag.videorag import VideoRAG, QueryParam
 
 if __name__ == '__main__':
@@ -31,8 +31,7 @@
     video_base_path = f'longervideos/{sub_category}/videos/'
     video_files = sorted(os.listdir(video_base_path))
     video_paths = [os.path.join(video_base_path, f) for f in video_files]
-    #videorag = VideoRAG(cheap_model_func=gpt_4o_mini_complete, best_model_func=gpt_4o_mini_complete, working_dir=f"./videorag-workdir/{sub_category}")
-    videorag = VideoRAG(cheap_model_func=ollama_mini_complete, best_model_func=ollama_complete, working_dir=f"./videorag-workdir/{sub_category}")    
+    videorag = VideoRAG(llm=ollama_config, working_dir=f"./videorag-workdir/{sub_category}")    
     videorag.insert_video(video_path_list=video_paths)
     
     ## inference
```

**File**: `videorag/_llm.py` (modified, +24/-22)
```diff
@@ -2,6 +2,7 @@
 
 from openai import AsyncOpenAI, AsyncAzureOpenAI, APIConnectionError, RateLimitError
 from ollama import AsyncClient
+from dataclasses import asdict, dataclass, field
 
 from tenacity import (
     retry,
@@ -13,6 +14,7 @@
 
 from ._utils import compute_args_hash, wrap_embedding_func_with_attrs
 from .base import BaseKVStorage
+from ._utils import EmbeddingFunc
 
 global_openai_async_client = None
 global_azure_openai_async_client = None
@@ -130,19 +132,19 @@ async def openai_embedding(texts: list[str]) -> np.ndarray:
 
 
 openai_config = LLMConfig(
-    embedding_func = field(default_factory=lambda: openai_embedding)
-    embedding_batch_num = 32
-    embedding_func_max_async = 16
-    query_better_than_threshold = 0.2
+    embedding_func = openai_embedding,
+    embedding_batch_num = 32,
+    embedding_func_max_async = 16,
+    query_better_than_threshold = 0.2,
 
     # LLM        
-    best_model_func = gpt_4o_mini_complete
-    best_model_max_token_size = 32768
-    best_model_max_async = 16
+    best_model_func = gpt_4o_mini_complete,
+    best_model_max_token_size = 32768,
+    best_model_max_async = 16,
         
-    cheap_model_func = gpt_4o_mini_complete
-    cheap_model_max_token_size = 32768
-    cheap_model_max_async = 16
+    cheap_model_func = gpt_4o_mini_complete,
+    cheap_model_max_token_size = 32768,
+    cheap_model_max_async = 16)
 
 ###### Azure OpenAI Configuration
 @retry(
@@ -223,18 +225,18 @@ async def azure_openai_embedding(texts: list[str]) -> np.ndarray:
 
 
 azure_openai_config = LLMConfig(
-    embedding_func = field(default_factory=lambda: azure_openai_embedding),
-    embedding_batch_num = 32
-    embedding_func_max_async = 16
-    query_better_than_threshold = 0.2
+    embedding_func = azure_openai_embedding,
+    embedding_batch_num = 32,
+    embedding_func_max_async = 16,
+    query_better_than_threshold = 0.2,
 
-    best_model_func: callable = azure_gpt_4o_complete
-    best_model_max_token_size = 32768
-    best_model_max_async = 16
+    best_model_func = azure_gpt_4o_complete,
+    best_model_max_token_size = 32768,
+    best_model_max_async = 16,
 
-    cheap_model_func: callable = azure_gpt_4o_mini_complete
-    cheap_model_max_token_size = 32768
-    cheap_model_max_async = 16
+    cheap_model_func  = azure_gpt_4o_mini_complete,
+    cheap_model_max_token_size = 32768,
+    cheap_model_max_async = 16)
 
 
 ######  Ollama configuration
@@ -317,12 +319,12 @@ async def ollama_embedding(texts: list[str]) -> np.ndarray:
     return np.array(embeddings)
 
 ollama_config = LLMConfig(
-    embedding_func= EmbeddingFunc = field(default_factory=lambda: ollama_embedding),
+    embedding_func = ollama_embedding,
     embedding_batch_num = 1,
     embedding_func_max_async = 1,
     query_better_than_threshold = 0.2,
     best_model_func = ollama_complete ,   
-    best_model_max_token_size: int = 32768,
+    best_model_max_token_size = 32768,
     best_model_max_async  = 1,
     cheap_model_func = ollama_mini_complete,
     cheap_model_max_token_size = 32768,
```

**File**: `videorag/_op.py` (modified, +4/-4)
```diff
@@ -552,7 +552,7 @@ async def _refine_entity_retrieval_query(
     query_param: QueryParam,
     global_config: dict,
 ):
-    use_llm_func: callable = global_config["cheap_model_func"]
+    use_llm_func: callable = global_config["llm"]["cheap_model_func"]
     query_rewrite_prompt = PROMPTS["query_rewrite_for_entity_retrieval"]
     query_rewrite_prompt = query_rewrite_prompt.format(input_text=query)
     final_result = await use_llm_func(query_rewrite_prompt)
@@ -563,7 +563,7 @@ async def _refine_visual_retrieval_query(
     query_param: QueryParam,
     global_config: dict,
 ):
-    use_llm_func: callable = global_config["cheap_model_func"]
+    use_llm_func: callable = global_config["llm"]["cheap_model_func"]
     query_rewrite_prompt = PROMPTS["query_rewrite_for_visual_retrieval"]
     query_rewrite_prompt = query_rewrite_prompt.format(input_text=query)
     final_result = await use_llm_func(query_rewrite_prompt)
@@ -574,7 +574,7 @@ async def _extract_keywords_query(
     query_param: QueryParam,
     global_config: dict,
 ):
-    use_llm_func: callable = global_config["cheap_model_func"]
+    use_llm_func: callable = global_config["llm"]["cheap_model_func"]
     keywords_prompt = PROMPTS["keywords_extraction"]
     keywords_prompt = keywords_prompt.format(input_text=query)
     final_result = await use_llm_func(keywords_prompt)
@@ -594,7 +594,7 @@ async def videorag_query(
     query_param: QueryParam,
     global_config: dict,
 ) -> str:
-    use_model_func = global_config["best_model_func"]
+    use_model_func = global_config["llm"]["best_model_func"]
     query = query
     
     # naive chunks
```

**File**: `videorag/_storage/vdb_nanovectordb.py` (modified, +2/-2)
```diff
@@ -21,7 +21,7 @@ def __post_init__(self):
         self._client_file_name = os.path.join(
             self.global_config["working_dir"], f"vdb_{self.namespace}.json"
         )
-        self._max_batch_size = self.global_config["embedding_batch_num"]
+        self._max_batch_size = self.global_config["llm"]["embedding_batch_num"]
         self._client = NanoVectorDB(
             self.embedding_func.embedding_dim, storage_file=self._client_file_name
         )
@@ -142,4 +142,4 @@ async def query(self, query: str):
         return results
     
     async def index_done_callback(self):
-        self._client.save()
\ No newline at end of file
+        self._client.save()
```

**File**: `videorag/videorag.py` (modified, +2/-4)
```diff
@@ -13,7 +13,7 @@
 
 
 from ._llm import (
-    LLMConfig
+    LLMConfig,
     openai_config,
     azure_openai_config,
     ollama_config
@@ -96,10 +96,8 @@ class VideoRAG:
     entity_extract_max_gleaning: int = 1
     entity_summary_to_max_tokens: int = 500
 
-    # Uncomment as appropriate depending on whether you use openai, azure_openai or ollama
-
     # Change to your LLM provider
-    llm: LLMConfig = ollama_config
+    llm: LLMConfig = field(default_factory=openai_config)
     
     # entity extraction
     entity_extraction_func: callable = extract_entities
```

---

### Incident Patch 10: `35058566` (2025-02-11)
**Commit Message**: Fix execution errors

**File**: `longervideos/videorag_experiment.py` (modified, +14/-8)
```diff
@@ -3,38 +3,44 @@
 import logging
 import warnings
 import multiprocessing
+import sys
 
 warnings.filterwarnings("ignore")
 logging.getLogger("httpx").setLevel(logging.WARNING)
 
+# Add the parent directory of 'videorag' to sys.path
+sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))
+
 import argparse
 parser = argparse.ArgumentParser(description="Set sub-category and CUDA device.")
 parser.add_argument('--collection', type=str, default='4-rag-lecture')
 parser.add_argument('--cuda', type=str, default='0')
 args = parser.parse_args()
-sub_category = args.sub_category
+sub_category = args.collection
 
 os.environ["CUDA_VISIBLE_DEVICES"] = args.cuda
 os.environ["OPENAI_API_KEY"] = ""
 
 from videorag._llm import *
-from videorag import VideoRAG, QueryParam
+from videorag.videorag import VideoRAG, QueryParam
 
 if __name__ == '__main__':
     multiprocessing.set_start_method('spawn')
     
     ## learn
-    video_base_path = f'./{sub_category}/videos/'
+    video_base_path = f'longervideos/{sub_category}/videos/'
     video_files = sorted(os.listdir(video_base_path))
     video_paths = [os.path.join(video_base_path, f) for f in video_files]
-    videorag = VideoRAG(cheap_model_func=gpt_4o_mini_complete, best_model_func=gpt_4o_mini_complete, working_dir=f"./videorag-workdir/{sub_category}")
+    #videorag = VideoRAG(cheap_model_func=gpt_4o_mini_complete, best_model_func=gpt_4o_mini_complete, working_dir=f"./videorag-workdir/{sub_category}")
+    videorag = VideoRAG(cheap_model_func=ollama_mini_complete, best_model_func=ollama_complete, working_dir=f"./videorag-workdir/{sub_category}")    
     videorag.insert_video(video_path_list=video_paths)
     
     ## inference
-    with open(f'./dataset.json', 'r') as f:
+    with open(f'longervideos/dataset.json', 'r') as f:
         longervideos = json.load(f)
     
-    videorag = VideoRAG(cheap_model_func=gpt_4o_mini_complete, best_model_func=gpt_4o_mini_complete, working_dir=f"./videorag-workdir/{sub_category}")
+    #videorag = VideoRAG(cheap_model_func=gpt_4o_mini_complete, best_model_func=gpt_4o_mini_complete, working_dir=f"./videorag-workdir/{sub_category}")
+    videorag = VideoRAG(cheap_model_func=ollama_mini_complete, best_model_func=ollama_complete, working_dir=f"./videorag-workdir/{sub_category}")        
     videorag.load_caption_model(debug=False)
     
     answer_folder = f'./videorag-answers/{sub_category}'
@@ -51,5 +57,5 @@
         
         response = videorag.query(query=query, param=param)
         print(response)
-        with open(os.path.join(answer_folder, f'/answer_{query_id}.md'), 'w') as f:
-            f.write(response)
\ No newline at end of file
+        with open(os.path.join(answer_folder, f'answer_{query_id}.md'), 'w') as f:
+            f.write(response)
```

**File**: `videorag/_llm.py` (modified, +12/-6)
```diff
@@ -1,6 +1,7 @@
 import numpy as np
 
 from openai import AsyncOpenAI, AsyncAzureOpenAI, APIConnectionError, RateLimitError
+from ollama import AsyncClient
 
 from tenacity import (
     retry,
@@ -33,8 +34,8 @@ def get_azure_openai_async_client_instance():
 def get_ollama_async_client_instance():
     global global_ollama_client
     if global_ollama_client is None:
-        #global_ollama_client = Client(base_url="http://localhost:11434")  # Adjust base URL if necessary
-        global_ollama_client = Client(base_url="http://10.0.1.12:11434")  # Adjust base URL if necessary        
+        #global_ollama_client = AsyncClient(host="http://localhost:11434")  # Adjust base URL if necessary
+        global_ollama_client = AsyncClient(host="http://10.0.1.12:11434")  # Adjust base URL if necessary        
     return global_ollama_client
 
 @retry(
@@ -238,18 +239,23 @@ async def ollama_mini_complete(prompt, system_prompt=None, history_messages=[],
         **kwargs,
     )
 
+@wrap_embedding_func_with_attrs(embedding_dim=768, max_token_size=8192)
+@retry(
+    stop=stop_after_attempt(5),
+    wait=wait_exponential(multiplier=1, min=4, max=10),
+    retry=retry_if_exception_type((RateLimitError, APIConnectionError)),
+)
 async def ollama_embedding(texts: list[str]) -> np.ndarray:
     # Initialize the Ollama client
     ollama_client = get_ollama_async_client_instance()
 
     # Send the request to Ollama for embeddings
-    response = await ollama_client.embeddings(
+    response = await ollama_client.embed(
         model="nomic-embed-text",  # Replace with the appropriate Ollama embedding model
-        input=texts,
-        encoding_format="float"
+        input=texts
     )
 
     # Extract embeddings from the response
-    embeddings = [dp.embedding for dp in response.data]
+    embeddings = response['embeddings']
 
     return np.array(embeddings)
```

**File**: `videorag/videorag.py` (modified, +3/-2)
```diff
@@ -20,6 +20,7 @@
     azure_openai_embedding,
     azure_gpt_4o_mini_complete,
     ollama_complete,
+    ollama_mini_complete,    
     ollama_embedding
 )
 from ._op import (
@@ -121,7 +122,7 @@ class VideoRAG:
         cheap_model_max_async: int = 16
     if llm_provider == "azur_openai":
         # text embedding
-        embedding_func = : EmbeddingFunc = field(default_factory=lambda: azure_openai_embedding)        
+        embedding_func: EmbeddingFunc = field(default_factory=lambda: azure_openai_embedding)        
         embedding_batch_num: int = 32
         embedding_func_max_async: int = 16
         query_better_than_threshold: float = 0.2
@@ -138,7 +139,7 @@ class VideoRAG:
     if llm_provider == "ollama":
         # text embedding
         embedding_func: EmbeddingFunc = field(default_factory=lambda: ollama_embedding)
-        embedding_batch_num: int = 32
+        embedding_batch_num: int = 1
         embedding_func_max_async: int = 1
         query_better_than_threshold: float = 0.2
 
```

#### Recent Merged Pull Requests:
- **PR #41** (closed): docs: fix README parameters typos (@cosmopolitan033)
- **PR #40** (closed): docs: fix README parameters typos (@cosmopolitan033)
- **PR #38** (closed): Graph traversal summarization (@jg-eno)
- **PR #34** (2026-01-11): Fix GPU crash on Linux (#30) (@YousefAliUK)
- **PR #31** (closed): Refactoring for Whizzhive (@vishalm)
- **PR #26** (2025-07-30): feat:add deepseek and bge support (@ZhangQL2824)
- **PR #25** (closed): feat: add DeepSeek and BGE model support (@ZhangQL2824)
- **PR #4** (2025-02-25): Ollama support (@geraldthewes)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
