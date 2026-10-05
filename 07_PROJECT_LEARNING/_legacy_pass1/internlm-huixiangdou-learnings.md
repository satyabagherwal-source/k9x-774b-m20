# Forensic Learning Record (Deep Inspection): InternLM/HuixiangDou

> **Canonical Artifact**: `07_PROJECT_LEARNING/internlm-huixiangdou-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/InternLM/HuixiangDou](https://github.com/InternLM/HuixiangDou))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-09-30T21:11:35.911Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `InternLM/HuixiangDou`
- **Description**: HuixiangDou: Overcoming Group Chat Scenarios with LLM-based Technical Assistance
- **Primary Language / Ecosystem**: Python
- **Discovered Manifests / Configurations**: pyproject.toml, README.md
- **Stars / Engagement**: 2501 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: pyproject.toml, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `app.py`
```
# This is a start-up file for deploying HuixiangDou-WEB on OpenXLab-APPs(https://openxlab.org.cn/apps)
# Some environment variables need to be set before starting up:
# JWT_SECRET=
# REDIS_HOST=
# REDIS_PASSWORD=
# SERVER_PORT=7860 (when deploy on OpenXLab-APPs, this SERVER_PORT should be 7860)

import os

# launch the HuixiangDou-WEB
os.system('python -m web.main')

```

### Core Architecture Module: `evaluation/end2end/main.py`
```
from huixiangdou.services import ParallelPipeline
from huixiangdou.primitive import Query
import json
import asyncio
import jieba
import pdb
import os
from typing import List
from rouge import Rouge 
from loguru import logger

config_path = '/home/data/khj/workspace/huixiangdou/config.ini'
assistant = ParallelPipeline(work_dir='/home/data/khj/workspace/huixiangdou/workdir', config_path=config_path)

def format_refs(refs: List[str]):
    refs_filter = list(set(refs))
    if len(refs) < 1:
        return ''

    text = '**References:**\r\n'
    for file_or_url in refs_filter:
        text += '* {}\r\n'.format(file_or_url)
    text += '\r\n'
    return text

async def run(query_text: str):
    query = Query(query_text)
    sentence = ''
    refs = None
    async for sess in assistant.generate(query=query, enable_web_search=False):
        if len(sess.delta) > 0:
            sentence += sess.delta
            if not refs:
                refs = sess.references
    return sentence, refs


if __name__ == "__main__":
    gts = []
    dts = []
    
    # hybrid llm serve
    output_filepath = 'out.jsonl'

    finished_query = []
    if os.path.exists(output_filepath):
        with open(output_filepath) as fin:
            json_str = ""
            for line in fin:
                json_str += line
            
                if '}\n' == line:
                    print(json_str)
                    json_obj = json.loads(json_str)
                    finished_query.append(json_obj['query'].strip())
                    json_str = ""

    with open('evaluation/end2end/qa.jsonl') as fin:
        for json_str in fin:
            json_obj = json.loads(json_str)
            query = json_obj['query'].strip()
            if query in finished_query:
                continue
            
            gt = json_obj['resp']
            gts.append(gt)

            loop = asyncio.get_event_loop()
            dt, refs = loop.run_until_complete(run(query_text=query))
            dts.append(dt)

            distance = assistant.retriever.embedder.distance(text1=gt, text2=dt).tolist()

            rouge = Rouge()
            dt_tokenized = ' '.join(jieba.cut(dt))
            gt_tokenized = ' '.join(jieba.cut(gt))
            scores = rouge.get_scores(dt_tokenized, gt_tokenized)
            json_obj['distance'] = distance
            json_obj['rouge_scores'] = scores
            json_obj['dt'] = dt
            json_obj['dt_refs'] = refs

            out_json_str = json.dumps(json_obj, ensure_ascii=False, indent=2)
            logger.info(out_json_str)

            with open(output_filepath, 'a') as fout:
                fout.write(out_json_str)
                fout.write('\n')

```

### Core Architecture Module: `evaluation/rejection/kg_filter.py`
```
import argparse
import json
import multiprocessing
import os
import os.path as osp
import pdb
from multiprocessing import Pool, Process

from loguru import logger
from sklearn.metrics import f1_score, precision_score, recall_score
from tqdm import tqdm

from huixiangdou.services import KnowledgeGraph
from huixiangdou.services import histogram


def load_dataset():
    text_labels = []
    with open(osp.join(osp.dirname(__file__), 'gt_good.txt')) as f:
        for line in f:
            text_labels.append((line, True))

    with open(osp.join(osp.dirname(__file__), 'gt_bad.txt')) as f:
        for line in f:
            # rejection
            text_labels.append((line, False))

    return text_labels


def calculate(config_path: str = 'config.ini'):
    kg = KnowledgeGraph(config_path=config_path, override=False)
    G = kg.load_networkx()
    if not G:
        logger.error('Knowledge graph not build, quit.')
        return
    text_labels = load_dataset()

    outpath = os.path.join(os.path.dirname(__file__), 'out.jsonl')
    for text, label in tqdm(text_labels):
        result = kg.retrieve(G=G, query=text)
        json_str = json.dumps({
            'query': text,
            'result': result,
            'gt': label
        },
                              ensure_ascii=False)
        with open(outpath, 'a') as f:
            f.write(json_str)
            f.write('\n')


def summarize():
    outpath = os.path.join(os.path.dirname(__file__), 'out.jsonl')

    for throttle in range(0, 40, 5):
        dts = []
        gts = []
        max_ref_cnts = []
        with open(outpath) as f:
            for line in f:
                json_obj = json.loads(line)
                gts.append(json_obj['gt'])
                if not json_obj['result']:
                    dts.append(False)
                    # max_ref_cnts.append(0)
                elif len(json_obj['result']) <= throttle:
                    dts.append(False)
                    # max_ref_cnts.append(0)
                else:
                    dts.append(True)
                    max_ref_cnts.append(len(json_obj['result']))

        # logger.info(histogram(max_ref_cnts))
        f1 = f1_score(gts, dts)
        f1 = round(f1, 2)
        precision = precision_score(gts, dts)
        precision = round(precision, 2)
        recall = recall_score(gts, dts)
        recall = round(recall, 2)

        logger.info(('throttle, precision, recall, F1', throttle, precision,
                     recall, f1))


def parse_args():
    parser = argparse.ArgumentParser(
        description='Knowledge graph for processing directories.')
    parser.add_argument('--config_path',
                        default='config-kg.ini',
                        help='Configuration path. Default value is config.ini')
    parser.add_argument('--retrieve',
                        default=False,
                        help='Retrieve result from knowledge graph.')
    args = parser.parse_args()
    return args


def main():
    args = parse_args()
    if args.retrieve:
        calculate(args.config_path)
    else:
        summarize()


if __name__ == '__main__':
    main()

```

### Core Architecture Module: `evaluation/rejection/plot.py`
```
import json
import os

import matplotlib.pyplot as plt
from mpl_toolkits.mplot3d import Axes3D


def plot_3d():
    fig = plt.figure()
    ax = fig.add_subplot(111, projection='3d')
    for jsonl_file in os.listdir('./'):

        if not jsonl_file.endswith('.jsonl'):
            continue

        if not 'chunk_size' in jsonl_file:
            continue

        x = []
        y = []
        z = []
        print(jsonl_file)

        datas = []
        with open(jsonl_file) as f:
            for json_str in f:
                json_obj = json.loads(json_str)
                datas.append(json_obj)

        datas.sort(key=lambda x: x['throttle'])

        for data in datas:
            chunk_size = data['chunk_size']
            throttle = data['throttle']
            f1 = data['f1']

            x.append(chunk_size)
            y.append(throttle)
            z.append(f1)

        # 绘制3D曲线
        ax.plot(x, y, z)

    # 添加标题和标签
    ax.set_title('3D Line Plot')
    ax.set_xlabel('chunk_size')
    ax.set_ylabel('throttle')
    ax.set_zlabel('f1')

    # 显示图形
    plt.show()


def plot_cross_splitter():
    fig = plt.figure()
    for splitter in os.listdir('./'):

        if not splitter.startswith('chunk_size'):
            continue

        if not os.path.isdir(splitter):
            continue

        items = []
        for jsonl_file in os.listdir(splitter):
            if not 'chunk_size' in jsonl_file:
                continue

            print(splitter, jsonl_file)
            datas = []

            with open(os.path.join(splitter, jsonl_file)) as f:
                for json_str in f:
                    json_obj = json.loads(json_str)
                    datas.append(json_obj)
            datas.sort(key=lambda x: x['f1'])

            items.append({
                'chunk_size': datas[-1]['chunk_size'],
                'f1': datas[-1]['f1']
            })

        items.sort(key=lambda x: x['chunk_size'])
        x = []
        y = []
        for item in items:
            if item['chunk_size'] > 1000:
                continue
            x.append(item['chunk_size'])
            y.append(item['f1'])
        print(x, y)
        # 绘制曲线
        label_name = splitter.split('chunk_size_')[-1]
        plt.plot(x, y, label=label_name)

    # 添加标题和标签
    plt.xlabel('chunk_size')
    plt.ylabel('best_f1')
    plt.legend()
    # 显示图形
    plt.show()


if __name__ == '__main__':
    plot_3d()

```

### Core Architecture Module: `evaluation/rerank/step0_clean_queries.py`
```
import json
import os
import re

from loguru import logger

pattern = re.compile(r'^[A-Za-z0-9]+$')

pwd = os.path.dirname(__file__)
query_log = os.path.join(pwd, '..', 'query.log')


def save(_id, sentence):
    if _id not in queries:
        queries[_id] = [sentence]
    else:
        queries[_id].append(sentence)


queries = dict()
with open(query_log) as f:
    query = None

    _id = None
    sentence = ''
    for line in f:
        line = line.strip()
        if len(line) < 5:
            continue

        if line[4] == ' ' and pattern.match(
                line[0:4]) and _id is not None and sentence != '':
            save(_id, sentence)
            _id = line[0:4]
            sentence = line[4:]
        else:
            if line[4] == ' ' and pattern.match(line[0:4]):
                _id = line[0:4]
                sentence = line[4:]
            else:
                sentence += '\n'
                sentence += line

    save(_id, sentence)

counter = 0
for _id in queries:
    with open(os.path.join(pwd, '..', 'queries', _id) + '.txt', 'a') as f:
        values = map(lambda x: x.strip(), queries[_id])
        values = list(set(values))
        counter += len(values)
        json_str = json.dumps(values, ensure_ascii=False)
        f.write(r'{}'.format(json_str))
        f.write('\n')

logger.info(counter)

```

### Core Architecture Module: `evaluation/rerank/step1_create_candidates.py`
```
import argparse
import json
import multiprocessing
import os
import os.path as osp
import pdb
import re
from multiprocessing import Pool, Process

from loguru import logger
from sklearn.metrics import (f1_score, precision_recall_curve, precision_score,
                             recall_score)
from tqdm import tqdm

from huixiangdou.services import FeatureStore, CacheRetriever, Retriever
from huixiangdou.services import FileOperation


class NoDaemonProcess(multiprocessing.Process):

    @property
    def daemon(self):
        return False

    @daemon.setter
    def daemon(self, value):
        pass


class NoDaemonContext(type(multiprocessing.get_context())):
    Process = NoDaemonProcess


# We sub-class multiprocessing.pool.Pool instead of multiprocessing.Pool
# because the latter is only a wrapper function, not a proper class.
class NestablePool(multiprocessing.pool.Pool):

    def __init__(self, *args, **kwargs):
        kwargs['context'] = NoDaemonContext()
        super(NestablePool, self).__init__(*args, **kwargs)


class Record:

    def __init__(self, fsid: str):
        self.records = []
        self.fsid = fsid
        if os.path.exists('record.txt'):
            with open('record.txt') as f:
                for line in f:
                    self.records.append(line.strip())

    def is_processed(self):
        if self.fsid in self.records:
            return True
        return False

    def mark_as_processed(self):
        with open('record.txt', 'a') as f:
            f.write(self.fsid)
            f.write('\n')


def load_queries(fsid: str):
    pwd = os.path.dirname(__file__)
    base = os.path.join(pwd, '..', 'queries')
    query_path = os.path.join(base, fsid + '.txt')
    if not os.path.exists(query_path):
        return []

    queries = []
    print(query_path)
    if fsid == '0000':

        with open(query_path) as f:
            for line in f:
                queries.append(line)
        return queries

    with open(query_path) as f:
        for line in f:
            queries = json.loads(line)
            break
    return queries


def process(param: tuple):
    fsid, filedir = param
    queries = load_queries(fsid=fsid)
    if len(queries) < 1:
        return

    r = Record(fsid=fsid)
    if r.is_processed():
        logger.info('skip {}'.format(fsid))
        return

    config_path = 'config.ini'
    cache = CacheRetriever(config_path=config_path)

    fs_init = FeatureStore(embedder=cache.embedder, config_path=config_path)

    file_opr = FileOperation()
    files = file_opr.scan_dir(repo_dir=filedir)
    work_dir = os.path.join('workdir', fsid)
    fs_init.initialize(files=files, work_dir=work_dir)
    file_opr.summarize(files)
    del fs_init

    retriever = cache.get(config_path=config_path, work_dir=work_dir)

    if not os.path.exists('candidates'):
        os.makedirs('candidates')

    for query in queries:
        try:
            query = query[0:400]
            docs = retriever.compression_retriever.get_relevant_documents(
                query)
            candidates = []
            logger.info('{} docs count {}'.format(fsid, len(docs)))

            for doc in docs:
                data = {
                    'content': doc.page_content,
                    'source': doc.metadata['read'],
                    'score': doc.metadata['relevance_score']
                }
                candidates.append(data)

            json_str = json.dumps({
                'query': query,
                'candidates': candidates
            }, ensure_ascii=False)

            with open(os.path.join('candidates', fsid + '.jsonl'), 'a') as f:
                f.write(json_str)
                f.write('\n')
        except Exception as e:
            pdb.set_trace()
            print(e)
    r.mark_as_processed()


def main():
    pwd = os.path.dirname(__file__)
    base = os.path.join(pwd, '..', 'feature_stores')
    dirs = os.listdir(base)
    params = []
    import pdb
    pdb.set_trace()
    for fsid in dirs:
        filedir = os.path.join(base, fsid, 'workdir/preprocess')
        process((fsid, filedir))
        params.append((fsid, filedir))
    # pool = NestablePool(2)
    # result = pool.map(process, params)
    # pool.close()
    # pool.join()


if __name__ == '__main__':
    main()

```

### Core Architecture Module: `huixiangdou/__init__.py`
```

"""import module."""
# only import frontend when needed, not here
from .services import ErrorCode  # noqa E401
from .services import FeatureStore  # noqa E401
from .services import WebSearch  # noqa E401
from .services import SerialPipeline, ParallelPipeline # no E401
from .services import build_reply_text  # noqa E401
from .version import __version__

```

### Core Architecture Module: `huixiangdou/api_server.py`
```
import argparse

from .services import SerialPipeline, ParallelPipeline
from .primitive import Query
from fastapi import FastAPI
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
import uvicorn
import json
from typing import List

assistant = None
app = FastAPI(docs_url='/')

class Talk(BaseModel):
    text: str
    image: str = ''

def format_refs(refs: List[str]):
    refs_filter = list(set(refs))
    if len(refs) < 1:
        return ''

    text = '**References:**\r\n'
    for file_or_url in refs_filter:
        text += '* {}\r\n'.format(file_or_url)
    text += '\r\n'
    return text

@app.post("/huixiangdou_inference")
async def huixiangdou_inference(talk: Talk):
    global assistant
    query = Query(talk.text, talk.image)

    pipeline = {'step': []}
    if type(assistant) is SerialPipeline:
        for sess in assistant.generate(query=query):
            status = {
                "state":str(sess.code),
                "response": sess.response,
                "refs": sess.references
            }

            pipeline['step'].append(status)
            pipeline['debug'] = sess.debug
        return pipeline
        
    else:
        sentence = ''
        async for sess in assistant.generate(query=query, enable_web_search=False):
            if sentence == '' and len(sess.references) > 0:
                sentence = format_refs(sess.references)

            if len(sess.delta) > 0:
                sentence += sess.delta
        return sentence


@app.post("/huixiangdou_stream")
async def huixiangdou_stream(talk: Talk):
    global assistant
    query = Query(talk.text, talk.image)

    pipeline = {'step': []}

    def event_stream():
        for sess in assistant.generate(query=query):
            status = {
                "state":str(sess.code),
                "response": sess.response,
                "refs": sess.references
            }

            pipeline['step'].append(status)
            yield json.dumps(pipeline)

    async def event_stream_async():
        sentence = ''
        async for sess in assistant.generate(query=query, enable_web_search=False):
            if sentence == '' and len(sess.references) > 0:
                sentence = format_refs(sess.references)

            if len(sess.delta) > 0:
                sentence += sess.delta
                yield sentence

    if type(assistant) is SerialPipeline:
        return StreamingResponse(event_stream(), media_type="text/event-stream")
    else:
        return StreamingResponse(event_stream_async(), media_type="text/event-stream")

def parse_args():
    """Parse args."""
    parser = argparse.ArgumentParser(description='Serial or Parallel Pipeline.')
    parser.add_argument('--work_dir',
                        type=str,
                        default='workdir',
                        help='Working directory.')
    parser.add_argument(
        '--config_path',
        default='config.ini',
        type=str,
        help='Configuration path. Default value is config.ini')
    parser.add_argument('--pipeline', type=str, choices=['chat_with_repo', 'chat_in_group'], default='chat_with_repo', 
                        help='Select pipeline type for difference scenario, default value is `chat_with_repo`')
    parser.add_argument('--port', type=int, default=23333, help='Bind port, use 23333 by default.')
    args = parser.parse_args()
    return args

if __name__ == '__main__':
    args = parse_args()
    # setup chat service
    if 'chat_with_repo' in args.pipeline:
        assistant = ParallelPipeline(work_dir=args.work_dir, config_path=args.config_path)
    elif 'chat_in_group' in args.pipeline:
        assistant = SerialPipeline(work_dir=args.work_dir, config_path=args.config_path)
    uvicorn.run(app, host='0.0.0.0', port=args.port, log_level='info')

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #443** (2025-11-24): **feat(uv): add pyproject.toml**
  *Symptoms*: 

- **Issue #442** (2025-08-13): **fix(wechat.py): filter msg by unique id**
  *Symptoms*: - 支持仅转发消息，不处理 - 增加消息去重，防止重发

- **Issue #441** (2025-07-14): **Support kimi k2**
  *Symptoms*: - using `kimi-k2` by default - update README about Cell MP  <img width="1083" height="152" alt="image" src="https://github.com/user-attachments/assets/b1cdd62c-789c-47b0-aa8c-58bbfaaa645f" /> 

- **Issue #439** (2025-05-21): **Fix/circular import**
  *Symptoms*: 

- **Issue #438** (2025-05-21): **Rename feature_store.py to store.py and move to services directory**
  *Symptoms*: 

- **Issue #437** (2025-05-21): **Update README.md**
  *Symptoms*: 

- **Issue #435** (2025-04-15): **Update README.md**
  *Symptoms*: 

- **Issue #434** (2025-04-15): **feat(project): support internlm3 and ppio**
  *Symptoms*: support  - internlm3 - ppio  https://ppinfra.com/user/register?invited_by=7GF8QS

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

### Incident Patch 1: `be7daa0f` (2025-08-13)
**Commit Message**: fix(wechat.py): filter msg by unique id (#442)

**File**: `huixiangdou/frontend/wechat.py` (modified, +28/-6)
```diff
@@ -56,6 +56,7 @@ def __init__(self, name, namespace='HuixiangDou', **redis_kwargs):
                                 charset='utf-8',
                                 decode_responses=True)
         self.key = '%s:%s' % (namespace, name)
+        print(self.qsize())
 
     def qsize(self):
         """Return the approximate size of the queue."""
@@ -151,6 +152,7 @@ def __init__(self):
         self.thumburl = ''
         self.md5 = ''
         self.length = 0
+        self.new_msg_id = ''
 
     def parse(self, wx_msg: dict, bot_wxid: str, auth:str='', wkteam_ip_port:str=''):
         # str or int
@@ -279,6 +281,8 @@ def search_key(xml_key: str):
 
         self.sender = data['fromUser']
         self.data = data
+        if 'newMsgId' in data:
+            self.new_msg_id = data['newMsgId']
         self.type = parse_type
         if 'fromGroup' not in data:
             return Exception('GroupID not found in message')
@@ -404,6 +408,7 @@ def __init__(self, config_path: str):
         self.qrCodeUrl = ''
         self.wkteam_config = dict()
         self.users = dict()
+        self.preprocessed = set()
         self.messages = []
 
         # {group_id: group_name}
@@ -780,10 +785,16 @@ def bind(self, logdir: str, port: int, forward:bool=False):
 
         async def forward_msg(input_json: dict):
             msg = Message()
+            print(input_json)
             err = msg.parse(wx_msg=input_json, bot_wxid=self.wId, auth=self.auth, wkteam_ip_port=self.WKTEAM_IP_PORT)
             if err is not None:
                 logger.error(str(err))
                 return
+
+            if msg.new_msg_id in self.preprocessed:
+                print(f'{msg.new_msg_id} repeated, skip')
+                return
+            self.preprocessed.add(msg.new_msg_id)
             
             # 不是白名单群里的消息，不处理
             come_from_whitelist = False
@@ -826,14 +837,20 @@ async def msg_callback(request):
             """Save wechat message to redis, for revert command, use high
             priority."""
             input_json = await request.json()
+
+
             with open(logpath, 'a') as f:
                 json_str = json.dumps(input_json, indent=2, ensure_ascii=False)
                 f.write(json_str)
                 f.write('\n')
 
             logger.debug(input_json)
-            msg_que = Queue(name='wechat')
-            revert_que = Queue(name='wechat-high-priority')
+            try:
+                msg_que = Queue(name='wechat')
+            except Exception as e:
+                msg_que = None
+                print('redis unavailable')
+                pass
 
             if input_json['messageType'] == '00000':
                 return web.json_response(text='done')
@@ -844,7 +861,8 @@ async def msg_callback(request):
                     self.revert_all()
                     return web.json_response(text='done')
 
-                msg_que.put(json_str)
+                if msg_que:
+                    msg_que.put(json_str)
 
                 if forward and not is_revert_command(input_json):
                     await forward_msg(input_json)
@@ -859,7 +877,9 @@ async def msg_callback(request):
         web.run_app(app, host='0.0.0.0', port=port)
 
     def serve(self, forward:bool=False):
-        # self.bind(self.wkteam_config.dir, self.wkteam_config.callback_port, forward=forward)
+        ## self.bind(self.wkteam_config.dir, self.wkteam_config.callback_port, forward=forward)
+
+        ## TODO
         p = Process(target=self.bind, args=(self.wkteam_config.dir, self.wkteam_config.callback_port, forward))
         p.start()
         self.set_callback()
@@ -893,10 +913,12 @@ async def loop(self, assistant):
         que = Queue(name='wechat')
 
         while True:
-            time.sleep(1)
-
+            # time.sleep(1)
             # parse wx_msg, add it to group
             for wx_msg_str in que.get_all():
+                # print(wx_msg_str)
+                # time.sleep(0.01)
+                # continue
     
```

---

### Incident Patch 2: `e0d94b59` (2025-05-21)
**Commit Message**: Fix/circular import (#439)

* Add QA pair support and refactor initialize method

* Update README with QA pair feature documentation

* Fix circular import warning in services module

* feat(project): update

---------

Co-authored-by: openhands <openhands@all-hands.dev>

**File**: `README.md` (modified, +5/-0)
```diff
@@ -212,6 +212,11 @@ cp -rf resource/data* repodir/
 # Build knowledge base, this will save the features of repodir to workdir, and update the positive and negative example thresholds into `config.ini`
 mkdir workdir
 python3 -m huixiangdou.services.store
+
+# You can also build knowledge base from QA pairs (CSV or JSON format)
+# CSV: First column is key (question), second column is value (answer)
+# JSON: {"question1": "answer1", "question2": "answer2", ...}
+# python3 -m huixiangdou.services.store --qa-pair resource/data/qa_pair.csv
 ```
 
 ## III. Setup LLM API and test
```

**File**: `README_zh.md` (modified, +5/-0)
```diff
@@ -211,6 +211,11 @@ cp -rf resource/data* repodir/
 # 建立知识库，repodir 的特征会保存到 workdir，拒答阈值也会自动更新进 `config.ini`
 mkdir workdir
 python3 -m huixiangdou.services.store
+
+# 你也可以从问答对（QA pairs）构建知识库（支持 CSV 或 JSON 格式）
+# CSV 格式：第一列为问题（key），第二列为答案（value）
+# JSON 格式：{"问题1": "答案1", "问题2": "答案2", ...}
+# python3 -m huixiangdou.services.store --qa-pair resource/data/qa_pair.csv
 ```
 
 ## 三、配置 LLM，运行测试
```

**File**: `huixiangdou/primitive/chunk.py` (modified, +2/-2)
```diff
@@ -22,9 +22,9 @@ class Chunk():
     modal: str = 'text'
 
     def __post_init__(self):
-        if self.modal not in ['text', 'image', 'audio']:
+        if self.modal not in ['text', 'image', 'audio', 'qa']:
             raise ValueError(
-                f'Invalid modal: {self.modal}. Allowed values are: `text`, `image`, `audio`'
+                f'Invalid modal: {self.modal}. Allowed values are: `text`, `image`, `audio`, `qa`'
             )
 
     def __str__(self) -> str:
```

**File**: `huixiangdou/primitive/faiss.py` (modified, +1/-1)
```diff
@@ -167,7 +167,7 @@ def save_local(self, folder_path: str, chunks: List[Chunk],
             for chunk in tqdm(chunks, 'chunks'):
                 np_feature = None
                 try:
-                    if chunk.modal == 'text':
+                    if chunk.modal == 'text' or chunk.modal == 'qa':
                         np_feature = embedder.embed_query(text=chunk.content_or_path)
                     elif chunk.modal == 'image':
                         np_feature = embedder.embed_query(path=chunk.content_or_path)
```

**File**: `huixiangdou/services/__init__.py` (modified, +2/-1)
```diff
@@ -1,7 +1,6 @@
 """LLM service module."""
 from .config import (feature_store_base_dir, redis_host, redis_passwd,
                      redis_port)
-from .store import FeatureStore  # noqa E401
 from .helper import (ErrorCode, QueryTracker, Queue, TaskCode,
                      build_reply_text, check_str_useful, histogram, kimi_ocr,
                      multimodal, parse_json_str)
@@ -10,3 +9,5 @@
 from .web_search import WebSearch  # noqa E401
 from .serial_pipeline import SerialPipeline
 from .parallel_pipeline import ParallelPipeline
+# Import FeatureStore at the end to avoid circular imports
+from .store import FeatureStore  # noqa E401
```

---

### Incident Patch 3: `2a98f626` (2025-04-07)
**Commit Message**: fix(service): llm reply (#432)

**File**: `huixiangdou/frontend/wechat.py` (modified, +33/-7)
```diff
@@ -312,8 +312,11 @@ def convert_talk_to_dict(talk: Talk):
 
 
 def convert_history_to_tuple(history: List[Talk]):
-    return [(item.query, item.reply, item.refs, item.now) for item in history]
-
+    history = []
+    for item in history:
+        history.append({"role": "user", "content": item.query})
+        history.append({"role": "assistant", "content": item.reply})
+    return history
 
 class User:
 
@@ -724,6 +727,29 @@ def send_message(self, groupId: str, text: str):
 
         return None
 
+    def send_user_message(self, userId: str, text: str):
+        headers = {
+            'Content-Type': 'application/json',
+            'Authorization': self.auth
+        }
+        data = {'wId': self.wId, 'wcId': userId, 'content': text}
+
+        json_obj, err = self.post(url='http://{}/sendText'.format(
+            self.WKTEAM_IP_PORT),
+                                  data=data,
+                                  headers=headers)
+        if err is not None:
+            return err
+
+        sent = json_obj['data']
+        sent['wId'] = self.wId
+        if groupId not in self.sent_msg:
+            self.sent_msg[groupId] = [sent]
+        else:
+            self.sent_msg[groupId].append(sent)
+
+        return None
+
     def send_url(self, groupId: str, description: str, title: str, thumb_url: str, url: str):
         headers = {
             'Content-Type': 'application/json',
@@ -860,14 +886,14 @@ def fetch_groupchats(self, user: User, max_length: int = 12):
                 conversations.append(msg)
         return conversations
 
-    async def loop(self, worker):
+    async def loop(self, assistant):
         """Fetch all messages from redis, split it by groupId; concat by
         timestamp."""
         from huixiangdou.service.helper import ErrorCode, kimi_ocr
         que = Queue(name='wechat')
 
         while True:
-            time.sleep(0.01)
+            time.sleep(1)
 
             # parse wx_msg, add it to group
             for wx_msg_str in que.get_all():
@@ -907,8 +933,8 @@ async def loop(self, worker):
                     continue
 
                 now = time.time()
-                # if a user not send new message in 18 seconds, process and mark it
-                if now - user.last_msg_time >= 18 and user.last_process_time < user.last_msg_time:
+                # if a user not send new message in 12 seconds, process and mark it
+                if now - user.last_msg_time >= 12 and user.last_process_time < user.last_msg_time:
                     if user.last_msg_type in ['link', 'image']:
                         # if user image or link contains question, do not process
                         continue
@@ -937,7 +963,7 @@ async def loop(self, worker):
                         tuple_history = convert_history_to_tuple(
                             user.history[0:-1])
 
-                        async for sess in worker.generate(
+                        async for sess in assistant.generate(
                             query=query,
                             history=tuple_history,
                             groupname=groupname,
```

**File**: `huixiangdou/primitive/llm_reranker.py` (modified, +2/-1)
```diff
@@ -11,6 +11,7 @@
 from .embedder import Embedder
 from .limitter import RPM
 from .utils import always_get_an_event_loop
+from loguru import logger
 
 class LLMReranker:
     _type: str
@@ -168,7 +169,7 @@ def _sort(self, texts: List[str], query: str):
                 return indexes[0:self.topn]
             except Exception as e:
                 logger.error(f'reranker API fail {e}, use default order')
-                return [i for i in range(self.topn)]
+                return [i for i in range(min(len(texts), self.topn))]
 
         # get descending order
         return scores.argsort()[::-1][0:self.topn]
```

**File**: `huixiangdou/service/llm.py` (modified, +14/-10)
```diff
@@ -100,23 +100,24 @@ def __init__(self, config_path: str):
 
     def choose_model(self, backend: Backend, token_size: int) -> str:
         model = backend.model
+        response_reserve_length = 2048
         if backend.name == 'kimi' and model == 'auto':
-            if token_size <= 8192 - 1024:
+            if token_size <= 8192 - response_reserve_length:
                 model = 'moonshot-v1-8k'
-            elif token_size <= 32768 - 1024:
+            elif token_size <= 32768 - response_reserve_length:
                 model = 'moonshot-v1-32k'
-            elif token_size <= 128000 - 1024:
+            elif token_size <= 128000 - response_reserve_length:
                 model = 'moonshot-v1-128k'
             else:
                 raise ValueError('Input token length exceeds 128k')
         elif backend.name == 'step' and model == 'auto':
-            if token_size <= 8192 - 1024:
+            if token_size <= 8192 - response_reserve_length:
                 model = 'step-1-8k'
-            elif token_size <= 32768 - 1024:
+            elif token_size <= 32768 - response_reserve_length:
                 model = 'step-1-32k'
-            elif token_size <= 128000 - 1024:
+            elif token_size <= 128000 - response_reserve_length:
                 model = 'step-1-128k'
-            elif token_size <= 256000 - 1024:
+            elif token_size <= 256000 - response_reserve_length:
                 model = 'step-1-256k'
             else:
                 raise ValueError('Input token length exceeds 256k')
@@ -134,7 +135,7 @@ def choose_model(self, backend: Backend, token_size: int) -> str:
     async def chat(self,
                    prompt: str,
                    backend: str = 'default',
-                   system_prompt=None,
+                   system_prompt='你是茴香豆，简称豆哥。是一个微信群机器人，用于回答群友的疑问。',
                    history=[],
                    allow_truncate=False,
                    max_tokens=1024,
@@ -184,8 +185,11 @@ async def chat(self,
         if max_tokens:
             kwargs['max_tokens'] = max_tokens
 
-        response = await openai_async_client.chat.completions.create(**kwargs)
-        if response.choices is None:
+        try:
+            response = await openai_async_client.chat.completions.create(**kwargs)
+        except Exception as e:
+            import pdb
+            pdb.set_trace()
             pass
         logger.info(response.choices[0].message.content)
 
```

**File**: `huixiangdou/service/parallel_pipeline.py` (modified, +1/-1)
```diff
@@ -64,7 +64,7 @@ async def process(self, sess: Session) -> AsyncGenerator[Session, Session]:
             else:
                 topic = 'undefine'
             
-            for block_intention in ['问候', 'greeting', 'undefine']:
+            for block_intention in ['问候', 'greeting', 'undefine', '表达个人感受']:
                 if block_intention in intention:
                     sess.code = ErrorCode.NOT_A_QUESTION
                     yield sess
```

---

### Incident Patch 4: `65f3f600` (2025-03-27)
**Commit Message**: fix

**File**: `huixiangdou/frontend/wechat.py` (modified, +1/-2)
```diff
@@ -967,8 +967,7 @@ async def loop(self, worker):
                         if user.group_id in self.group_whitelist:
                             logger.warning(r'send {} to {}'.format(
                                 formatted_reply, user.group_id))
-                            print(formatted_reply)
-                            # self.send_message(groupId=user.group_id, text=formatted_reply)
+                            self.send_message(groupId=user.group_id, text=formatted_reply)
                         else:
                             logger.warning(r'prepare respond {} to {}'.format(
                                 formatted_reply, user.group_id))
```

---

### Incident Patch 5: `713075a3` (2025-03-27)
**Commit Message**: fix(web/proxy/main.py): async bug (#431)

**File**: `config.ini` (modified, +1/-1)
```diff
@@ -148,4 +148,4 @@ introduction = "github https://github.com/InternLM/HuixiangDou 用户体验群"
 # github.com/tencent/ncnn contributors
 [frontend.wechat_wkteam.18356748488]
 name = "卷卷群"
-introduction = "ncnn contributors group"
+introduction = "ncnn contributors group"
\ No newline at end of file
```

**File**: `evaluation/end2end/main.py` (modified, +1/-1)
```diff
@@ -30,7 +30,7 @@ async def run(query_text: str):
     async for sess in assistant.generate(query=query, enable_web_search=False):
         if len(sess.delta) > 0:
             sentence += sess.delta
-            if refs is None:
+            if not refs:
                 refs = sess.references
     return sentence, refs
 
```

**File**: `evaluation/rejection/kg_filter.py` (modified, +1/-1)
```diff
@@ -60,7 +60,7 @@ def summarize():
             for line in f:
                 json_obj = json.loads(line)
                 gts.append(json_obj['gt'])
-                if json_obj['result'] is None:
+                if not json_obj['result']:
                     dts.append(False)
                     # max_ref_cnts.append(0)
                 elif len(json_obj['result']) <= throttle:
```

**File**: `huixiangdou/frontend/wechat.py` (modified, +13/-21)
```diff
@@ -34,7 +34,7 @@ def redis_host():
 
 def redis_port():
     port = os.getenv('REDIS_PORT')
-    if port is None:
+    if not port:
         logger.debug('REDIS_PORT not set, try 6379')
         port = 6379
     return port
@@ -161,6 +161,9 @@ def parse(self, wx_msg: dict, bot_wxid: str, auth:str='', wkteam_ip_port:str='')
             return Exception('data not in wx_msg')
 
         data = wx_msg['data']
+        if not data:
+            return Exception('data is None')
+
         if 'self' in data:
             if data['self']:
                 return Exception('self msg, return')
@@ -247,6 +250,10 @@ def search_key(xml_key: str):
                 jsonobj = json.loads(json_str)
                 if jsonobj['code'] != '1000':
                     logger.error('download {} {}'.format(data, json_str))
+
+                jsondata = jsonobj['data']
+                if not jsondata:
+                    return Exception('download image failed, skip')
                 self.url = jsonobj['data']['url']
 
         elif msg_type in ['80001', '60001']:
@@ -853,24 +860,14 @@ def fetch_groupchats(self, user: User, max_length: int = 12):
                 conversations.append(msg)
         return conversations
 
-    def loop(self, worker):
+    async def loop(self, worker):
         """Fetch all messages from redis, split it by groupId; concat by
         timestamp."""
         from huixiangdou.service.helper import ErrorCode, kimi_ocr
-
-        revert_que = Queue(name='wechat-high-priority')
         que = Queue(name='wechat')
 
         while True:
-            time.sleep(1)
-            # react to revert msg first
-            for wx_msg_str in revert_que.get_all():
-                wx_msg = json.loads(wx_msg_str)
-                data = wx_msg['data']
-                if 'fromGroup' in data:
-                    self.revert(groupId=data['fromGroup'])
-                    # “群友学习法”。命令撤回将提升阈值，提升量越来越小。
-                    worker.notify_badcase()
+            time.sleep(0.01)
 
             # parse wx_msg, add it to group
             for wx_msg_str in que.get_all():
@@ -909,11 +906,6 @@ def loop(self, worker):
                 if len(user.history) < 1:
                     continue
 
-                # debug
-                # if '20158567857@chatroom' not in user.group_id:
-                #     logger.debug('user.group_id {}'.format(user.group_id))
-                #     continue
-
                 now = time.time()
                 # if a user not send new message in 18 seconds, process and mark it
                 if now - user.last_msg_time >= 18 and user.last_process_time < user.last_msg_time:
@@ -945,7 +937,7 @@ def loop(self, worker):
                         tuple_history = convert_history_to_tuple(
                             user.history[0:-1])
 
-                        for sess in worker.generate(
+                        async for sess in worker.generate(
                             query=query,
                             history=tuple_history,
                             groupname=groupname,
@@ -975,8 +967,8 @@ def loop(self, worker):
                         if user.group_id in self.group_whitelist:
                             logger.warning(r'send {} to {}'.format(
                                 formatted_reply, user.group_id))
-                            self.send_message(groupId=user.group_id,
-                                              text=formatted_reply)
+                            print(formatted_reply)
+                            # self.send_message(groupId=user.group_id, text=formatted_reply)
                         else:
                             logger.warning(r'prepare respond {} to {}'.format(
                                 formatted_reply, user.group_id))
```

**File**: `huixiangdou/gradio_ui.py` (modified, +2/-2)
```diff
@@ -117,7 +117,7 @@ async def predict(text:str, image:str):
 
     query = Query(text, image_path)
     if 'chat_in_group' in pipeline:
-        if serial_assistant is None:
+        if not serial_assistant:
             serial_assistant = SerialPipeline(work_dir=main_args.work_dir, config_path=main_args.config_path)
         args = {'query':query, 'history': [], 'groupname':''}
         pipeline = {'status': {}}
@@ -140,7 +140,7 @@ async def predict(text:str, image:str):
                 yield json_str
 
     else:
-        if parallel_assistant is None:
+        if not parallel_assistant:
             parallel_assistant = ParallelPipeline(work_dir=main_args.work_dir, config_path=main_args.config_path)
         args = {'query':query, 'history':[], 'language':language}
         args['enable_web_search'] = enable_web_search
```

---

### Incident Patch 6: `51b413b1` (2025-03-14)
**Commit Message**: fix(wechat.py): image forwarding (#425)

**File**: `huixiangdou/frontend/wechat.py` (modified, +5/-1)
```diff
@@ -192,6 +192,8 @@ def search_key(xml_key: str):
                 return value
             
             displayname = search_key(xml_key='displayname')
+            if displayname == '茴香豆':
+                displayname = ''
             displaycontent = search_key(xml_key='content')
             content = '{}:{}'.format(displayname, displaycontent)
             to_user = search_key(xml_key='chatusr')
@@ -775,7 +777,9 @@ async def forward_msg(input_json: dict):
                     username = msg.push_content.split(':')[0].strip()
                     formatted_reply = '{}：{}'.format(username, msg.content)
                     self.send_message(groupId=groupId, text=formatted_reply)
-                elif msg.type == 'image' or msg.type == 'emoji':
+                elif msg.type == 'image':
+                    self.send_image(groupId=groupId, image_url=msg.url)
+                elif msg.type == 'emoji':
                     self.send_emoji(groupId=groupId, md5=msg.md5, length=msg.length)
                 elif msg.type == 'ref_for_others' or msg.type == 'ref_for_bot':
                     formatted_reply = '{}\n---\n{}'.format(msg.content, msg.query)
```

---

### Incident Patch 7: `67e6947d` (2024-10-29)
**Commit Message**: fix(llm_server_hybrid.py): local qwen streaming (#399)

* fix(llm_server_hybrid.py): qwen streaming output

**File**: `README.md` (modified, +1/-1)
```diff
@@ -97,7 +97,7 @@ The Web version's API for Android also supports other devices. See [Python sampl
       <td>
 
 - [InternLM2/InternLM2.5](https://github.com/InternLM/InternLM)
-- [Qwen/Qwen2](https://github.com/QwenLM/Qwen2)
+- [Qwen1.5~2.5](https://github.com/QwenLM/Qwen2)
 - [puyu](https://internlm.openxlab.org.cn/)
 - [StepFun](https://platform.stepfun.com)
 - [KIMI](https://kimi.moonshot.cn)
```

**File**: `huixiangdou/service/llm_server_hybrid.py` (modified, +12/-20)
```diff
@@ -17,9 +17,10 @@
 from fastapi.middleware.cors import CORSMiddleware
 from pydantic import BaseModel
 from sse_starlette.sse import EventSourceResponse
-
+from transformers import TextIteratorStreamer
 import uvicorn
 from typing import List, Tuple
+from threading import Thread
 
 def os_run(cmd: str):
     ret = os.popen(cmd)
@@ -57,6 +58,7 @@ def __init__(self, model_path: str):
         self.model_path = model_path
         self.tokenizer = AutoTokenizer.from_pretrained(model_path,
                                                        trust_remote_code=True)
+        self.streamer = TextIteratorStreamer(self.tokenizer, skip_prompt=True, skip_special_tokens=True)
 
         model_path_lower = model_path.lower()
 
@@ -69,14 +71,6 @@ def __init__(self, model_path: str):
         elif 'qwen1.5' in model_path_lower:
             self.model = AutoModelForCausalLM.from_pretrained(
                 model_path, device_map='auto', trust_remote_code=True).eval()
-        elif 'qwen' in model_path_lower:
-            self.model = AutoModelForCausalLM.from_pretrained(
-                model_path,
-                device_map='auto',
-                trust_remote_code=True,
-                use_cache_quantization=True,
-                use_cache_kernel=True,
-                use_flash_attn=False).eval()
         elif 'internlm2_5' in model_path_lower:
             self.model = AutoModelForCausalLM.from_pretrained(
                 model_path,
@@ -112,17 +106,15 @@ async def chat_stream(self, prompt: str, history=[]):
                 messages, tokenize=False, add_generation_prompt=True)
             model_inputs = self.tokenizer([text],
                                           return_tensors='pt').to('cuda')
-            generated_ids = self.model.generate(model_inputs.input_ids,
-                                                max_new_tokens=512,
-                                                top_k=1)
-            generated_ids = [
-                output_ids[len(input_ids):] for input_ids, output_ids in zip(
-                    model_inputs.input_ids, generated_ids)
-            ]
-
-            output_text = self.tokenizer.batch_decode(
-                generated_ids, skip_special_tokens=True)[0]
-            yield output_text
+            
+            generation_kwargs = dict(model_inputs, streamer=self.streamer, max_new_tokens=512)
+            thread = Thread(target=self.model.generate, kwargs=generation_kwargs)
+            thread.start()
+            
+            for new_text in self.streamer:
+                yield new_text
+                
+            thread.join()
 
         elif type(self.model).__name__ == 'InternLM2ForCausalLM':
 
```

---

### Incident Patch 8: `8e5a2946` (2024-10-17)
**Commit Message**: fix(service/prompt.py): optimize citation format (#397)

* docs(en): add readthedocs

* fix(service/prompt.py): optimize ciation format

**File**: `huixiangdou/service/prompt.py` (modified, +21/-37)
```diff
@@ -1,5 +1,5 @@
 from typing import List
-
+import re
 # PreprocNode
 SCORING_QUESTION_TEMPLATE_CN = '“{}”\n请仔细阅读以上内容，判断句子是否是个有主题的疑问句，结果用 0～10 表示。直接提供得分不要解释。\n判断标准：有主语谓语宾语并且是疑问句得 10 分；缺少主谓宾扣分；陈述句直接得 0 分；不是疑问句直接得 0 分。直接提供得分不要解释。'
 # modified from kimi
@@ -111,38 +111,12 @@
 GENERATE_TEMPLATE_CN = '材料：“{}”\n 问题：“{}” \n 请仔细阅读参考材料回答问题。'  # noqa E501
 GENERATE_TEMPLATE_EN = 'Background Information: "{}"\n Question: "{}"\n Please read the reference material carefully and answer the question.'  # noqa E501
 
-GENERATE_TEMPLATE_CITATION_HEAD_CN = '''你是一个文本专家，擅长阅读理解任务，根据检索结果回答用户输入。 
-
-## 任务
-仅使用提供的搜索结果（其中一些可能不相关）来准确、吸引人且简洁地回答给定的问题，并正确引用它们。使用无偏见和新闻业语调。对于任何事实性声明都要引用。当引用多个搜索结果时，使用[1][2][3]。在每条句子中至少引用一个文档，最多引用三个文档。如果多个文档支持该句子，则只引用支持文档的最小必要子集。
-
-## 指令遵循与提供有用的回复要求
-- 在满足安全合规要求下，注意并遵循用户问题中提到的每条指令，对于用户的问题你必须直接的给出回答。如果指令超出了你的能力范围，礼貌的告诉用户。
-- 请严格遵循指令，请说话不要啰嗦，不要不简洁明了。
--【重要！】对于数字比较问题，请先一步一步分析再回答。
-
-## 输出格式与语言风格要求
-- 使用\(...\) 或\[...\]来输出数学公式，例如：使用\[x^2\]来表示x的平方。
-- 当你介绍自己时，请记住保持幽默和简短。
-- 你不会不用简洁简短的文字输出，你不会输出无关用户指令的文字。
-- 你不会重复表达和同义反复。
+GENERATE_TEMPLATE_CITATION_HEAD_CN = '''## 任务
+请使用仅提供的搜索结果（其中一些可能不相关）写出准确、有吸引力且简洁的回答，并正确引用它们。使用不偏不倚且新闻式的语气。对于任何事实性陈述都必须引用。引用多个搜索结果时，使用[1][2][3]格式。每个句子至少引用一个文档，最多引用三个文档。如果多个文档支持同一个句子，引用最小的必要子集。
 '''
 
-GENERATE_TEMPLATE_CITATION_HEAD_EN = '''You are a text expert, proficient in reading comprehension tasks, answering user input based on search results.
-
-## Task
-Write an accurate, engaging, and concise answer for the given question using only the provided search results (some of which might be irrelevant) and cite them properly. Use an unbiased and journalistic tone. Always cite for any factual claim. When citing several search results, use [1][2][3]. Cite at least one document and at most three documents in each sentence. If multiple documents support the sentence, only cite a minimum sufficient subset of the documents.
-
-## Instructions and Providing Helpful Responses
-- While adhering to safety and compliance requirements, pay attention to and follow each instruction mentioned in the user's question. You must directly answer the user's question. If the instruction is beyond your capabilities, politely inform the user.
-- Please strictly follow the instructions and avoid verbosity and ambiguity.
-- [Important!] For numerical comparison questions, analyze step by step before answering.
-
-## Output Format and Language Style Requirements
-- Use \(...\) or \[...\] to output mathematical formulas, for example: use \[x^2\] to represent the square of x.
-- When introducing yourself, remember to be humorous and concise.
-- You will not use verbose language and will not output text unrelated to the user's instructions.
-- You will not repeat expressions and will avoid tautology.
+GENERATE_TEMPLATE_CITATION_HEAD_EN = '''## Task
+Please use only the provided search results (some of which may be irrelevant) to write accurate, engaging, and concise answers, and correctly cite them. Use an impartial and journalistic tone. For any factual statements, citations are required. When citing multiple search results, use the format [1][2][3]. Each sentence should reference at least one document, and no more than three. If multiple documents support the same sentence, cite the smallest necessary subset.
 '''
 
 # WebSearchNode
@@ -161,19 +135,29 @@ class CitationGeneratePrompt:
     def __init__(self, language: str):
         self.language = language
     
+    def remove_markdown_headers(self, texts: List[str]):
+        pure_texts = []
+        for text in texts:
+            # 移除Markdown中的标题
+            pure_text = re.sub(r'^#{1,6}\s*', '', text, flags=re.MULTILINE)
+            pure_texts.append(pure_text)
+        return pure_texts
+
     def build(self, texts: List[str], question:str):
+        pure_texts = self.remove_markdown_headers(texts)
+
         if self.language == 'zh':
             head = GENERATE_TEMPLATE_CITATION_HEAD_CN
-            question_prompt = '\n## 用户输入\n{}\n'.format(question*2)
+            question_pr
```

---

### Incident Patch 9: `ce0d4866` (2024-09-27)
**Commit Message**: fix(web_search.py): add missing method (#391)

**File**: `huixiangdou/service/web_search.py` (modified, +7/-0)
```diff
@@ -88,9 +88,16 @@ def __init__(self, config_path: str, retry: int = 1, language:str='zh') -> None:
         with open(config_path, encoding='utf8') as f:
             config = pytoml.load(f)
             self.search_config = types.SimpleNamespace(**config['web_search'])
+
         self.retry = retry
         self.language = language
 
+    def load_key():
+        try:
+            return self.search_config.serper_x_api_key
+        except Exception as e:
+            return ''
+
     def fetch_url(self, query: str, target_link: str, brief: str = ''):
         if not target_link.startswith('http'):
             return None
```

---

### Incident Patch 10: `7e1be3fa` (2024-09-23)
**Commit Message**: feat(primitive/faiss.py): support HNSW and reverted indexer (#387)

* feat(primitive/faiss.py): support HNSW

* feat(feature_store.py): simplify distribution

* feat(primitive/entity.py): add inverted index retrieve

**File**: `README.md` (modified, +2/-1)
```diff
@@ -50,7 +50,8 @@ Our Web version has been released to [OpenXLab](https://openxlab.org.cn/apps/det
 
 The Web version's API for Android also supports other devices. See [Python sample code](./tests/test_openxlab_android_api.py).
 
-- \[2024/09\] [code retrieval](./huixiangdou/service/parallel_pipeline.py)
+- \[2024/09\] [Inverted indexer](https://github.com/InternLM/HuixiangDou/pull/387) makes LLM prefer knowledge base🎯
+- \[2024/09\] [Code retrieval](./huixiangdou/service/parallel_pipeline.py)
 - \[2024/08\] [chat_with_readthedocs](https://huixiangdou.readthedocs.io/en/latest/), see [how to integrate](./docs/zh/doc_add_readthedocs.md) 👍
 - \[2024/07\] Image and text retrieval & Removal of `langchain` 👍
 - \[2024/07\] [Hybrid Knowledge Graph and Dense Retrieval](./docs/en/doc_knowledge_graph.md) improve 1.7% F1 score 🎯
```

**File**: `README_zh.md` (modified, +11/-7)
```diff
@@ -52,6 +52,7 @@ Web 版视频教程见 [BiliBili](https://www.bilibili.com/video/BV1S2421N7mn) 
 
 Web 版给 android 的接口，也支持非 android 调用，见[python 样例代码](./tests/test_openxlab_android_api.py)。
 
+- \[2024/09\] [倒排索引](https://github.com/InternLM/HuixiangDou/pull/387)让 LLM 更偏向使用领域知识 🎯
 - \[2024/09\] 稀疏方法实现[代码检索](./huixiangdou/service/parallel_pipeline.py)
 - \[2024/08\] ["chat_with readthedocs"](https://huixiangdou.readthedocs.io/zh-cn/latest/) ，见[集成说明](./docs/zh/doc_add_readthedocs.md)
 - \[2024/07\] 图文检索 & 移除 `langchain` 👍
@@ -366,7 +367,11 @@ python3 tests/test_query_gradio.py
 
 # 🛠️ FAQ
 
-1. 机器人太高冷/太嘴碎怎么办？
+1. 对于通用问题（如 “番茄是什么” ），我希望 LLM 优先用领域知识（如 “普罗旺斯番茄”）怎么办？
+
+    参照 [PR](https://github.com/InternLM/HuixiangDou/pull/387)，准备实体列表，构建特征库时传入列表，`ParallelPipeline`检索会基于倒排索引增大召回
+
+2. 机器人太高冷/太嘴碎怎么办？
 
    - 把真实场景中，应该回答的问题填入`resource/good_questions.json`，应该拒绝的填入`resource/bad_questions.json`
    - 调整 `repodir` 中的文档，确保不包含场景无关内容
@@ -375,30 +380,29 @@ python3 tests/test_query_gradio.py
 
    ⚠️ 如果你足够自信，也可以直接修改 config.ini 的 `reject_throttle` 数值，一般来说 0.5 是很高的值；0.2 过低。
 
-2. 启动正常，但运行期间显存 OOM 怎么办？
+3. 启动正常，但运行期间显存 OOM 怎么办？
 
    基于 transformers 结构的 LLM 长文本需要更多显存，此时需要对模型做 kv cache 量化，如 [lmdeploy 量化说明](https://github.com/InternLM/lmdeploy/blob/main/docs/zh_cn/quantization)。然后使用 docker 独立部署 Hybrid LLM Service。
 
-3. 如何接入其他 local LLM / 接入后效果不理想怎么办？
+4. 如何接入其他 local LLM / 接入后效果不理想怎么办？
 
    - 打开 [hybrid llm service](./huixiangdou/service/llm_server_hybrid.py)，增加新的 LLM 推理实现
    - 参照 [test_intention_prompt 和测试数据](./tests/test_intention_prompt.py)，针对新模型调整 prompt 和阈值，更新到 [prompt.py](./huixiangdou/service/prompt.py)
 
-4. 响应太慢/网络请求总是失败怎么办？
+5. 响应太慢/网络请求总是失败怎么办？
 
    - 参考 [hybrid llm service](./huixiangdou/service/llm_server_hybrid.py) 增加指数退避重传
    - local LLM 替换为 [lmdeploy](https://github.com/internlm/lmdeploy) 等推理框架，而非原生的 huggingface/transformers
 
-5. 机器配置低，GPU 显存不足怎么办？
+6. 机器配置低，GPU 显存不足怎么办？
 
    此时无法运行 local LLM，只能用 remote LLM 配合 text2vec 执行 pipeline。请确保 `config.ini` 只使用 remote LLM，关闭 local LLM
 
-6. 报错 `(500, 'Internal Server Error')`，意为 standalone 模式启动的 LLM 服务没访问到。按如下方式定位
+7. 报错 `(500, 'Internal Server Error')`，意为 standalone 模式启动的 LLM 服务没访问到。按如下方式定位
 
    - 执行 `python3 -m huixiangdou.service.llm_server_hybrid` 确定 LLM 服务无报错，监听的端口和配置一致。检查结束后按 ctrl-c 关掉。
    - 检查 `config.ini` 中各种 TOKEN 书写正确。
 
-
 # 🍀 致谢
 
 - [KIMI](https://kimi.moonshot.cn/): 长文本 LLM，支持直接上传文件
```

**File**: `evaluation/end2end/main.py` (modified, +48/-38)
```diff
@@ -2,12 +2,15 @@
 from huixiangdou.primitive import Query
 import json
 import asyncio
+import jieba
 import pdb
+import os
 from typing import List
 from rouge import Rouge 
 from loguru import logger
 
-assistant = ParallelPipeline(work_dir='/home/khj/hxd-ci/workdir', config_path='/home/khj/hxd-ci/config.ini')
+config_path = '/home/data/khj/workspace/huixiangdou/config.ini'
+assistant = ParallelPipeline(work_dir='/home/data/khj/workspace/huixiangdou/workdir', config_path=config_path)
 
 def format_refs(refs: List[str]):
     refs_filter = list(set(refs))
@@ -31,49 +34,56 @@ async def run(query_text: str):
                 refs = sess.references
     return sentence, refs
 
-gts = []
-dts = []
 
-output_filepath = 'out.jsonl'
-
-finished_query = []
-with open(output_filepath) as fin:
-    json_str = ""
-    for line in fin:
-        json_str += line
+if __name__ == "__main__":
+    gts = []
+    dts = []
     
-        if '}\n' == line:
-            print(json_str)
-            json_obj = json.loads(json_str)
-            finished_query.append(json_obj['query'].strip())
+    # hybrid llm serve
+    print('evaluate ParallelPipeline precision, first `python3 -m huixiangdou.service.llm_server_hybrid`, then prepare your qa pair in `qa.json`.')
+    output_filepath = 'out.jsonl'
+
+    finished_query = []
+    if os.path.exists(output_filepath):
+        with open(output_filepath) as fin:
             json_str = ""
+            for line in fin:
+                json_str += line
+            
+                if '}\n' == line:
+                    print(json_str)
+                    json_obj = json.loads(json_str)
+                    finished_query.append(json_obj['query'].strip())
+                    json_str = ""
 
-with open('evaluation/end2end/qa.jsonl') as fin:
-    for json_str in fin:
-        json_obj = json.loads(json_str)
-        query = json_obj['query'].strip()
-        if query in finished_query:
-            continue
-        
-        gt = json_obj['resp']
-        gts.append(gt)
+    with open('evaluation/end2end/qa.jsonl') as fin:
+        for json_str in fin:
+            json_obj = json.loads(json_str)
+            query = json_obj['query'].strip()
+            if query in finished_query:
+                continue
+            
+            gt = json_obj['resp']
+            gts.append(gt)
 
-        loop = asyncio.get_event_loop()
-        dt, refs = loop.run_until_complete(run(query_text=query))
-        dts.append(dt)
+            loop = asyncio.get_event_loop()
+            dt, refs = loop.run_until_complete(run(query_text=query))
+            dts.append(dt)
 
-        distance = assistant.retriever.embedder.distance(text1=gt, text2=dt).tolist()
+            distance = assistant.retriever.embedder.distance(text1=gt, text2=dt).tolist()
 
-        rouge = Rouge()
-        scores = rouge.get_scores(gt, dt)
-        json_obj['distance'] = distance
-        json_obj['rouge_scores'] = scores
-        json_obj['dt'] = dt
-        json_obj['dt_refs'] = refs
+            rouge = Rouge()
+            dt_tokenized = ' '.join(jieba.cut(dt))
+            gt_tokenized = ' '.join(jieba.cut(gt))
+            scores = rouge.get_scores(dt_tokenized, gt_tokenized)
+            json_obj['distance'] = distance
+            json_obj['rouge_scores'] = scores
+            json_obj['dt'] = dt
+            json_obj['dt_refs'] = refs
 
-        out_json_str = json.dumps(json_obj, ensure_ascii=False, indent=2)
-        logger.info(out_json_str)
+            out_json_str = json.dumps(json_obj, ensure_ascii=False, indent=2)
+            logger.info(out_json_str)
 
-        with open(output_filepath, 'a') as fout:
-            fout.write(out_json_str)
-            fout.write('\n')
+            with open(output_filepath, 'a') as fout:
+                fout.write(out_json_str)
+                fout.write('\n')
```

**File**: `huixiangdou/main.py` (modified, +2/-4)
```diff
@@ -13,7 +13,6 @@
 
 from .service import ErrorCode, SerialPipeline, build_reply_text, start_llm_server
 
-
 def parse_args():
     """Parse args."""
     parser = argparse.ArgumentParser(description='SerialPipeline.')
@@ -60,7 +59,6 @@ def check_env(args):
 
 
 def show(assistant, fe_config: dict):
-    
     queries = ['请问如何安装 mmpose ?', '请问明天天气如何？']
     print(colored('Running some examples..', 'yellow'))
     for query in queries:
@@ -142,7 +140,7 @@ def lark_group_recv_and_send(assistant, fe_config: dict):
         code, reply, refs = str(sess.code), sess.response, sess.references
         if code == ErrorCode.SUCCESS:
             json_obj['reply'] = build_reply_text(reply=reply,
-                                                 references=references)
+                                                 references=refs)
             error, msg_id = send_to_lark_group(
                 json_obj=json_obj,
                 app_id=lark_group_config['app_id'],
@@ -169,7 +167,7 @@ async def api(request):
         for sess in assistant.generate(query=query, history=[], groupname=''):
             pass
         code, reply, refs = str(sess.code), sess.response, sess.references
-        reply_text = build_reply_text(reply=reply, references=references)
+        reply_text = build_reply_text(reply=reply, references=refs)
 
         return web.json_response({'code': int(code), 'reply': reply_text})
 
```

**File**: `huixiangdou/primitive/__init__.py` (modified, +1/-0)
```diff
@@ -15,3 +15,4 @@
     nested_split_markdown, split_python_code)
 from .limitter import RPM, TPM
 from .bm250kapi import BM25Okapi
+from .entity import NamedEntity2Chunk
```

#### Recent Merged Pull Requests:
- **PR #443** (2025-11-24): feat(uv): add pyproject.toml (@tpoisonooo)
- **PR #442** (2025-08-13): fix(wechat.py): filter msg by unique id (@tpoisonooo)
- **PR #441** (2025-07-14): Support kimi k2 (@tpoisonooo)
- **PR #439** (2025-05-21): Fix/circular import (@tpoisonooo)
- **PR #438** (2025-05-21): Rename feature_store.py to store.py and move to services directory (@tpoisonooo)
- **PR #437** (2025-05-21): Update README.md (@tpoisonooo)
- **PR #435** (2025-04-15): Update README.md (@tpoisonooo)
- **PR #434** (2025-04-15): feat(project): support internlm3 and ppio (@tpoisonooo)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
