# Forensic Learning Record (Deep Inspection): PeterH0323/Streamer-Sales

> **Canonical Artifact**: `07_PROJECT_LEARNING/peterh0323-streamer-sales-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/PeterH0323/Streamer-Sales](https://github.com/PeterH0323/Streamer-Sales))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-06T05:13:19.339Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `PeterH0323/Streamer-Sales`
- **Description**: Streamer-Sales 销冠 —— 卖货主播 LLM 大模型🛒🎁，一个能够根据给定的商品特点从激发用户购买意愿角度出发进行商品解说的卖货主播大模型。🚀⭐内含详细的数据生成流程❗ 📦另外还集成了 LMDeploy 加速推理🚀、RAG检索增强生成 📚、TTS文字转语音🔊、数字人生成 🦸、 Agent 使用网络查询实时信息🌐、ASR 语音转文字🎙️、Vue 生态搭建前端🍍、FastAPI 搭建后端🗝️、Docker-compose 打包部署🐋
- **Primary Language / Ecosystem**: Python
- **Discovered Manifests / Configurations**: README.md
- **Stars / Engagement**: 3778 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `frontend/src/utils/navbar.ts`
```
import { ref } from 'vue'

// 侧边栏是否折叠
export const isCollapse = ref(false) // TODO 是否可以用 Pinia ？

```

### Core Architecture Module: `server/asr/asr_worker.py`
```
import datetime

from funasr import AutoModel
from funasr.download.name_maps_from_hub import name_maps_ms as NAME_MAPS_MS
from modelscope import snapshot_download
from modelscope.utils.constant import Invoke, ThirdParty

from ..web_configs import WEB_CONFIGS


def load_asr_model():

    # 模型下载
    model_path_info = dict()
    for model_name in ["paraformer-zh", "fsmn-vad", "ct-punc"]:
        print(f"downloading asr model : {NAME_MAPS_MS[model_name]}")
        mode_dir = snapshot_download(
            NAME_MAPS_MS[model_name],
            revision="master",
            user_agent={Invoke.KEY: Invoke.PIPELINE, ThirdParty.KEY: "funasr"},
            cache_dir=WEB_CONFIGS.ASR_MODEL_DIR,
        )
        model_path_info[model_name] = mode_dir
        NAME_MAPS_MS[model_name] = mode_dir  # 更新权重路径环境变量

    print(f"ASR model path info = {model_path_info}")
    # paraformer-zh is a multi-functional asr model
    # use vad, punc, spk or not as you need
    model = AutoModel(
        model="paraformer-zh",  # 语音识别，带时间戳输出，非实时
        vad_model="fsmn-vad",  # 语音端点检测，实时
        punc_model="ct-punc",  # 标点恢复
        # spk_model="cam++" # 说话人确认/分割
        model_path=model_path_info["paraformer-zh"],
        vad_kwargs={"model_path": model_path_info["fsmn-vad"]},
        punc_kwargs={"model_path": model_path_info["ct-punc"]},
    )
    return model


def process_asr(model: AutoModel, wav_path):
    # https://github.com/modelscope/FunASR/blob/main/README_zh.md#%E5%AE%9E%E6%97%B6%E8%AF%AD%E9%9F%B3%E8%AF%86%E5%88%AB
    f_start_time = datetime.datetime.now()
    res = model.generate(input=wav_path, batch_size_s=50, hotword="魔搭")
    delta_time = datetime.datetime.now() - f_start_time

    try:
        print(f"ASR using time {delta_time}s, text: ", res[0]["text"])
        res_str = res[0]["text"]
    except Exception as e:
        print("ASR 解析失败，无法获取到文字")
        return ""

    return res_str

```

### Core Architecture Module: `server/base/modules/agent/agent_worker.py`
```
import json
import logging

from lagent.actions import ActionExecutor
from lagent.agents.internlm2_agent import Internlm2Protocol
from lagent.schema import ActionReturn, AgentReturn
from loguru import logger

from .delivery_time_query import DeliveryTimeQueryAction


def init_handlers(departure_place, delivery_company_name):
    META_CN = "当开启工具以及代码时，根据需求选择合适的工具进行调用"

    INTERPRETER_CN = (
        "你现在已经能够在一个有状态的 Jupyter 笔记本环境中运行 Python 代码。"
        "当你向 python 发送含有 Python 代码的消息时，它将在该环境中执行。"
        "这个工具适用于多种场景，如数据分析或处理（包括数据操作、统计分析、图表绘制），"
        "复杂的计算问题（解决数学和物理难题），编程示例（理解编程概念或特性），"
        "文本处理和分析（比如文本解析和自然语言处理），"
        "机器学习和数据科学（用于展示模型训练和数据可视化），"
        "以及文件操作和数据导入（处理CSV、JSON等格式的文件）。"
    )

    PLUGIN_CN = (
        "你可以使用如下工具："
        "\n{prompt}\n"
        "如果你已经获得足够信息，请直接给出答案. 避免不必要的工具调用! "
        "同时注意你可以使用的工具，不要随意捏造！"
    )

    protocol_handler = Internlm2Protocol(
        meta_prompt=META_CN,
        interpreter_prompt=INTERPRETER_CN,
        plugin_prompt=PLUGIN_CN,
        tool=dict(
            begin="{start_token}{name}\n",
            start_token="<|action_start|>",
            name_map=dict(plugin="<|plugin|>", interpreter="<|interpreter|>"),
            belong="assistant",
            end="<|action_end|>\n",
        ),
    )
    action_list = [
        DeliveryTimeQueryAction(
            departure_place=departure_place,
            delivery_company_name=delivery_company_name,
        ),
    ]
    plugin_map = {action.name: action for action in action_list}
    plugin_name = [action.name for action in action_list]
    plugin_action = [plugin_map[name] for name in plugin_name]
    action_executor = ActionExecutor(actions=plugin_action)

    return action_executor, protocol_handler


def get_agent_result(llm_model_handler, prompt_input, departure_place, delivery_company_name):

    action_executor, protocol_handler = init_handlers(departure_place, delivery_company_name)

    # 第一次将 prompt 生成 agent 形式的 prompt
    # [{'role': 'system', 'content': '当开启工具以及代码时，根据需求选择合适的工具进行调用'},
    # {'role': 'system', 'content': '你可以使用如下工具：\n[\n    {\n        "name": "ArxivSearch.get_arxiv_article_information",\n
    #                                                                       "description": "This is the subfunction for tool \'ArxivSearch\', you can use this tool. The description of this function is: \\nRun Arxiv search and get the article meta information.",\n
    #                                                                       "parameters": [\n            {\n                "name": "query",\n                "type": "STRING",\n                "description": "the content of search query"\n            }\n        ],\n        "required": [\n            "query"\n        ],\n        "return_data": [\n            {\n                "name": "content",\n                "description": "a list of 3 arxiv search papers",\n                "type": "STRING"\n            }\n        ],\n        "parameter_description": "If you call this tool, you must pass arguments in the JSON format {key: value}, where the key is the parameter name."\n    }\n]\n
    #                                                       如果你已经获得足够信息，请直接给出答案. 避免不必要的工具调用! 同时注意你可以使用的工具，不要随意捏造！',
    #                                       'name': 'plugin'},
    # {'role': 'user', 'content': '帮我搜索 InternLM2 Technical Report'}]

    # 推理得出：'<|action_start|><|plugin|>\n{"name": "ArxivSearch.get_arxiv_article_information", "parameters": {"query": "InternLM2 Technical Report"}}<|action_end|>\n'
    # 放入 assient 中

    # 使用 ArxivSearch.get_arxiv_article_information 方法得出结果，放到 envrinment 里面，结果是：
    # [{'role': 'system', 'content': '当开启工具以及代码时，根据需求选择合适的工具进行调用'},
    # {'role': 'system', 'content': '你可以使用如下工具：\n[\n    {\n        "name": "ArxivSearch.get_arxiv_article_information",\n        "description": "This is the subfunction for tool \'ArxivSearch\', you can use this tool. The description of this function is: \\nRun Arxiv search and get the article meta information.",\n        "parameters": [\n            {\n                "name": "query",\n                "type": "STRING",\n                "description": "the content of search query"\n            }\n        ],\n        "required": [\n            "query"\n        ],\n        "return_data": [\n            {\n                "name": "content",\n                "description": "a list of 3 arxiv search papers",\n                "type": "STRING"\n            }\n        ],\n        "parameter_description": "If you call this tool, you must pass arguments in the JSON format {key: value}, where the key is the parameter name."\n    }\n]\n如果你已经获得足够信息，请直接给出答案. 避免不必要的工具调用! 同时注意你可以使用的工具，不要随意捏造！', 'name': 'plugin'},
    # {'role': 'user', 'content': '帮我搜索 InternLM2 Technical Report'},
    # {'role': 'assistant', 'content': '<|action_start|><|plugin|>\n{"name": "ArxivSearch.get_arxiv_article_information", "parameters": {"query": "InternLM2 Technical Report"}}<|action_end|>\n'},
    # {'role': 'environment', 'content': '{"content": "Published: 2024-03-26\\nTitle: InternLM2 Technical Report\\nAuthors: Zheng Cai, Maosong Cao, Haojiong Chen, Kai Chen, Keyu Chen, Xin Chen, Xun Chen, Zehui Chen, Zhi Chen, Pei Chu, Xiaoyi Dong, Haodong Duan, Qi Fan, Zhaoye Fei, Yang Gao, Jiaye Ge, Chenya Gu, Yuzhe Gu, Tao Gui, Aijia Guo, Qipeng Guo, Conghui He, Yingfan Hu, Ting Huang, Tao Jiang, Penglong Jiao, Zhenjiang Jin, Zhikai Lei, Jiaxing Li, Jingwen Li, Linyang Li, Shuaibin Li, Wei Li, Yining Li, Hongwei Liu, Jiangning Liu, Jiawei Hong, Kaiwen Liu, Kuikun Liu, Xiaoran Liu, Chengqi Lv, Haijun Lv, Kai Lv, Li Ma, Runyuan Ma, Zerun Ma, Wenchang Ning, Linke Ouyang, Jiantao Qiu, Yuan Qu, Fukai Shang, Yunfan Shao, Demin Song, Zifan Song, Zhihao Sui, Peng Sun, Yu Sun, Huanze Tang, Bin Wang, Guoteng Wang, Jiaqi Wang, Jiayu Wang, Rui Wang, Yudong Wang, Ziyi Wang, Xingjian Wei, Qizhen Weng, Fan Wu, Yingtong Xiong, Chao Xu, Ruiliang Xu, Hang Yan, Yirong Yan, Xiaogui Yang, Haochen Ye, Huaiyuan Ying, Jia Yu, Jing Yu, Yuhang Zang, Chuyu Zhang, Li Zhang, Pan Zhang, Peng Zhang, Ruijie Zhang, Shuo Zhang, Songyang Zhang, Wenjian Zhang, Wenwei Zhang, Xingcheng Zhang, Xinyue Zhang, Hui Zhao, Qian Zhao, Xiaomeng Zhao, Fengzhe Zhou, Zaida Zhou, Jingming Zhuo, Yicheng Zou, Xipeng Qiu, Yu Qiao, Dahua Lin\\nSummary: The evolution of Large Language Models (LLMs) like ChatGPT and GPT-4 has\\nsparked discussions on the advent of Artificial General Intelligence (AGI).\\nHowever, replicating such advancements in open-source models has been\\nchallenging. This paper introduces InternLM2, an open-source LLM that\\noutperforms its predecessors in comprehensive evaluations across 6 dimensions\\nand 30 benchmarks, long-context modeling, and open-ended subjective evaluations\\nthrough innovative pre-training and optimization techniques. The pre-training\\nprocess of InternLM2 is meticulously detailed, highlighting the preparation of\\ndiverse data types including text, code, and long-context data. InternLM2\\nefficiently captures long-term dependencies, initially trained on 4k tokens\\nbefore advancing to 32k tokens in pre-training and fine-tuning stages,\\nexhibiting remarkable performance on the 200k ``Needle-in-a-Haystack\\" test.\\nInternLM2 is further aligned using Supervised Fine-Tuning (SFT) and a novel\\nConditional Online Reinforcement Learning from Human Feedback (COOL RLHF)\\nstrategy that addresses conflicting human preferences and reward hacking. By\\nreleasing InternLM2 models in different training stages and model sizes, we\\nprovide the community with insights into the model\'s evolution.\\n\\nPublished: 2017-07-27\\nTitle: Cumulative Reports of the SoNDe Project July 2017\\nAuthors: Sebastian Jaksch, Ralf Engels, Günter Kemmerling, Codin Gheorghe, Philip Pahlsson, Sylvain Désert, Frederic Ott\\nSummary: This are the cumulated reports of the SoNDe detector Project as of July 2017.\\nThe contained reports are: - Report on the 1x1 module technical demonstrator -\\nReport on used materials - Report on radiation hardness of components - Report\\non potential additional applications - Report on the 2x2 module technical\\ndemonstrator - Report on test results of the 2x2 technical demonstrator\\n\\nPublished: 2023-03-12\\nTitle: Banach Couples. I. Elementary Theory\\nAuthors: Jaak Peetre, Per Nilsson\\nSummary: This note is an (exact) copy of the report of Jaak Peetre, \\"Banach Couples.\\nI. Elementary Theory\\". Published as Technical Report, Lund (1971). Some more\\nrecent general references have been added and some references updated though"}', 'name': 'plugin'}]

    # 然后调用大模型推理总结，stream 输出

    # 判断 name is None ，跳出循环
    inner_history = [{"role": "user", "content": prompt_input}]
    interpreter_executor = None
    max_turn = 7
    for _ in range(max_turn):

        prompt = protocol_handler.format(  # 生成 agent prompt
            inner_step=inner_history,
            plugin_executor=action_executor,
            interpreter_executor=interpreter_executor,
        )
        cur_response = ""

        agent_return = AgentReturn()

        # 根据 tokenizer_config.json 中查找到特殊的 token ：
        # token_map = {
        #     92538: "<|plugin|>",
        #     92539: "<|interpreter|>",
        #     92540: "<|action_end|>",
        #     92541: "<|action_start|>",
        # }

        # 将 prompt 给模型
        # [{'role': 'system', 'content': '当开启工具以及代码时，根据需求选择合适的工具进行调用'},
        # {'role': 'system', 'content': '你可以使用如下工具：\n[\n    {\n        "name": "ArxivSearch.get_arxiv_article_information",\n
        #                                                                       "description": "This is the subfunction for tool \'ArxivSearch\', you can use this tool. The description of this function is: \\nRun Arxiv search and get the article meta information.",\n
        #                                                                       "parameters": [\n            {\n                "name": "query",\n                "type": "STRING",\n                "d
```

### Core Architecture Module: `server/base/modules/rag/rag_worker.py`
```
import shutil
from pathlib import Path

import torch
from loguru import logger

from ....web_configs import WEB_CONFIGS
from ...database.product_db import get_db_product_info
from .feature_store import gen_vector_db
from .retriever import CacheRetriever

# 基础配置
CONTEXT_MAX_LENGTH = 3000  # 上下文最大长度
GENERATE_TEMPLATE = "这是说明书：“{}”\n 客户的问题：“{}” \n 请阅读说明并运用你的性格进行解答。"  # RAG prompt 模板

# RAG 实例句柄
RAG_RETRIEVER = None


def build_rag_prompt(rag_retriever: CacheRetriever, product_name, prompt):

    real_retriever = rag_retriever.get(fs_id="default")

    if isinstance(real_retriever, tuple):
        logger.info(f" @@@ GOT real_retriever == tuple : {real_retriever}")
        return ""

    chunk, db_context, references = real_retriever.query(
        f"商品名：{product_name}。{prompt}", context_max_length=CONTEXT_MAX_LENGTH - 2 * len(GENERATE_TEMPLATE)
    )
    logger.info(f"db_context = {db_context}")

    if db_context is not None and len(db_context) > 1:
        prompt_rag = GENERATE_TEMPLATE.format(db_context, prompt)
    else:
        logger.info("db_context get error")
        prompt_rag = prompt

    logger.info(f"RAG reference = {references}")
    logger.info("=" * 20)

    return prompt_rag


def init_rag_retriever(rag_config: str, db_path: str):
    torch.cuda.empty_cache()

    retriever = CacheRetriever(config_path=rag_config)

    # 初始化
    retriever.get(fs_id="default", config_path=rag_config, work_dir=db_path)

    return retriever


async def gen_rag_db(user_id, force_gen=False):
    """
    生成向量数据库。

    参数:
    force_gen - 布尔值，当设置为 True 时，即使数据库已存在也会重新生成数据库。
    """

    # 检查数据库目录是否存在，如果存在且force_gen为False，则不执行生成操作
    if Path(WEB_CONFIGS.RAG_VECTOR_DB_DIR).exists() and not force_gen:
        return

    if force_gen and Path(WEB_CONFIGS.RAG_VECTOR_DB_DIR).exists():
        shutil.rmtree(WEB_CONFIGS.RAG_VECTOR_DB_DIR)

    # 仅仅遍历 instructions 字段里面的文件
    if Path(WEB_CONFIGS.PRODUCT_INSTRUCTION_DIR_GEN_DB_TMP).exists():
        shutil.rmtree(WEB_CONFIGS.PRODUCT_INSTRUCTION_DIR_GEN_DB_TMP)
    Path(WEB_CONFIGS.PRODUCT_INSTRUCTION_DIR_GEN_DB_TMP).mkdir(exist_ok=True, parents=True)

    # 读取 yaml 文件，获取所有说明书路径，并移动到 tmp 目录
    product_list, _ = await get_db_product_info(user_id)

    for info in product_list:

        shutil.copyfile(
            Path(
                WEB_CONFIGS.SERVER_FILE_ROOT,
                WEB_CONFIGS.PRODUCT_FILE_DIR,
                WEB_CONFIGS.INSTRUCTIONS_DIR,
                Path(info.instruction).name,
            ),
            Path(WEB_CONFIGS.PRODUCT_INSTRUCTION_DIR_GEN_DB_TMP).joinpath(Path(info.instruction).name),
        )

    logger.info("Generating rag database, pls wait ...")
    # 调用函数生成向量数据库
    gen_vector_db(
        WEB_CONFIGS.RAG_CONFIG_PATH,
        str(Path(WEB_CONFIGS.PRODUCT_INSTRUCTION_DIR_GEN_DB_TMP).absolute()),
        WEB_CONFIGS.RAG_VECTOR_DB_DIR,
    )

    # 删除过程文件
    shutil.rmtree(WEB_CONFIGS.PRODUCT_INSTRUCTION_DIR_GEN_DB_TMP)


async def load_rag_model(user_id):

    global RAG_RETRIEVER

    # 重新生成 RAG 向量数据库
    await gen_rag_db(user_id)

    # 加载 rag 模型
    RAG_RETRIEVER = init_rag_retriever(rag_config=WEB_CONFIGS.RAG_CONFIG_PATH, db_path=WEB_CONFIGS.RAG_VECTOR_DB_DIR)
    logger.info("load rag model done !...")


async def rebuild_rag_db(user_id, db_name="default"):

    # 重新生成 RAG 向量数据库
    await gen_rag_db(user_id, force_gen=True)

    # 重新加载 retriever
    RAG_RETRIEVER.pop(db_name)
    RAG_RETRIEVER.get(fs_id=db_name, config_path=WEB_CONFIGS.RAG_CONFIG_PATH, work_dir=WEB_CONFIGS.RAG_VECTOR_DB_DIR)

```

### Core Architecture Module: `server/base/queue_thread.py`
```
#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
@File    :   queue_thread.py
@Time    :   2024/09/02
@Project :   https://github.com/PeterH0323/Streamer-Sales
@Author  :   HinGwenWong
@Version :   1.0
@Desc    :   队列调取相关逻辑(半废弃状态)
"""


from loguru import logger
import requests
import multiprocessing

from ..web_configs import API_CONFIG
from .server_info import SERVER_PLUGINS_INFO


def process_tts(tts_text_queue):

    while True:
        try:
            text_chunk = tts_text_queue.get(block=True, timeout=1)
        except Exception as e:
            # logger.info(f"### {e}")
            continue
        logger.info(f"Get tts quene: {type(text_chunk)} , {text_chunk}")
        res = requests.post(API_CONFIG.TTS_URL, json=text_chunk)

        # # tts 推理成功，放入数字人队列进行推理
        # res_json = res.json()
        # tts_request_dict = {
        #     "user_id": "123",
        #     "request_id": text_chunk["request_id"],
        #     "chunk_id": text_chunk["chunk_id"],
        #     "tts_path": res_json["wav_path"],
        # }

        # DIGITAL_HUMAN_QUENE.put(tts_request_dict)

        logger.info(f"tts res = {res}")


def process_digital_human(digital_human_queue):

    while True:
        try:
            text_chunk = digital_human_queue.get(block=True, timeout=1)
        except Exception as e:
            # logger.info(f"### {e}")
            continue
        logger.info(f"Get digital human quene: {type(text_chunk)} , {text_chunk}")
        res = requests.post(API_CONFIG.DIGITAL_HUMAN_URL, json=text_chunk)
        logger.info(f"digital human res = {res}")


if SERVER_PLUGINS_INFO.tts_server_enabled:
    TTS_TEXT_QUENE = multiprocessing.Queue(maxsize=100)
    tts_thread = multiprocessing.Process(target=process_tts, args=(TTS_TEXT_QUENE,), name="tts_processer")
    tts_thread.start()
else:
    TTS_TEXT_QUENE = None

if SERVER_PLUGINS_INFO.digital_human_server_enabled:
    DIGITAL_HUMAN_QUENE = multiprocessing.Queue(maxsize=100)
    digital_human_thread = multiprocessing.Process(
        target=process_digital_human, args=(DIGITAL_HUMAN_QUENE,), name="digital_human_processer"
    )
    digital_human_thread.start()
else:
    DIGITAL_HUMAN_QUENE = None

```

### Core Architecture Module: `server/base/utils.py`
```
#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
@File    :   utils.py
@Time    :   2024/09/02
@Project :   https://github.com/PeterH0323/Streamer-Sales
@Author  :   HinGwenWong
@Version :   1.0
@Desc    :   工具集合文件
"""


import asyncio
from ipaddress import IPv4Address
import json
import random
import wave
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path
from typing import Dict, List

import cv2
from lmdeploy.serve.openai.api_client import APIClient
from loguru import logger
from pydantic import BaseModel
from sqlmodel import Session, select
from tqdm import tqdm

from server.base.models.user_model import UserInfo

from ..tts.tools import SYMBOL_SPLITS, make_text_chunk
from ..web_configs import API_CONFIG, WEB_CONFIGS
from .database.init_db import DB_ENGINE
from .models.product_model import ProductInfo
from .models.streamer_info_model import StreamerInfo
from .models.streamer_room_model import OnAirRoomStatusItem, SalesDocAndVideoInfo, StreamRoomInfo

from .modules.agent.agent_worker import get_agent_result
from .modules.rag.rag_worker import RAG_RETRIEVER, build_rag_prompt
from .queue_thread import DIGITAL_HUMAN_QUENE, TTS_TEXT_QUENE
from .server_info import SERVER_PLUGINS_INFO


class ChatGenConfig(BaseModel):
    # LLM 推理配置
    top_p: float = 0.8
    temperature: float = 0.7
    repetition_penalty: float = 1.005


class ProductInfoItem(BaseModel):
    name: str
    heighlights: str
    introduce: str  # 生成商品文案 prompt

    image_path: str
    departure_place: str
    delivery_company_name: str


class PluginsInfo(BaseModel):
    rag: bool = True
    agent: bool = True
    tts: bool = True
    digital_human: bool = True


class ChatItem(BaseModel):
    user_id: str  # User 识别号，用于区分不用的用户调用
    request_id: str  # 请求 ID，用于生成 TTS & 数字人
    prompt: List[Dict[str, str]]  # 本次的 prompt
    product_info: ProductInfoItem  # 商品信息
    plugins: PluginsInfo = PluginsInfo()  # 插件信息
    chat_config: ChatGenConfig = ChatGenConfig()


# 加载 LLM 模型
LLM_MODEL_HANDLER = APIClient(API_CONFIG.LLM_URL)


async def streamer_sales_process(chat_item: ChatItem):

    # ====================== Agent ======================
    # 调取 Agent
    agent_response = ""
    if chat_item.plugins.agent and SERVER_PLUGINS_INFO.agent_enabled:
        GENERATE_AGENT_TEMPLATE = (
            "这是网上获取到的信息：“{}”\n 客户的问题：“{}” \n 请认真阅读信息并运用你的性格进行解答。"  # Agent prompt 模板
        )
        input_prompt = chat_item.prompt[-1]["content"]
        agent_response = get_agent_result(
            LLM_MODEL_HANDLER, input_prompt, chat_item.product_info.departure_place, chat_item.product_info.delivery_company_name
        )
        if agent_response != "":
            agent_response = GENERATE_AGENT_TEMPLATE.format(agent_response, input_prompt)
            print(f"Agent response: {agent_response}")
            chat_item.prompt[-1]["content"] = agent_response

    # ====================== RAG ======================
    # 调取 rag
    if chat_item.plugins.rag and agent_response == "":
        # 如果 Agent 没有执行，则使用 RAG 查询数据库
        rag_prompt = chat_item.prompt[-1]["content"]
        prompt_pro = build_rag_prompt(RAG_RETRIEVER, chat_item.product_info.name, rag_prompt)

        if prompt_pro != "":
            chat_item.prompt[-1]["content"] = prompt_pro

    # llm 推理流返回
    logger.info(chat_item.prompt)

    current_predict = ""
    idx = 0
    last_text_index = 0
    sentence_id = 0
    model_name = LLM_MODEL_HANDLER.available_models[0]
    for item in LLM_MODEL_HANDLER.chat_completions_v1(model=model_name, messages=chat_item.prompt, stream=True):
        logger.debug(f"LLM predict: {item}")
        if "content" not in item["choices"][0]["delta"]:
            continue
        current_res = item["choices"][0]["delta"]["content"]

        if "~" in current_res:
            current_res = current_res.replace("~", "。").replace("。。", "。")

        current_predict += current_res
        idx += 1

        if chat_item.plugins.tts and SERVER_PLUGINS_INFO.tts_server_enabled:
            # 切句子
            sentence = ""
            for symbol in SYMBOL_SPLITS:
                if symbol in current_res:
                    last_text_index, sentence = make_text_chunk(current_predict, last_text_index)
                    if len(sentence) <= 3:
                        # 文字太短的情况，不做生成
                        sentence = ""
                    break

            if sentence != "":
                sentence_id += 1
                logger.info(f"get sentence: {sentence}")
                tts_request_dict = {
                    "user_id": chat_item.user_id,
                    "request_id": chat_item.request_id,
                    "sentence": sentence,
                    "chunk_id": sentence_id,
                    # "wav_save_name": chat_item.request_id + f"{str(sentence_id).zfill(8)}.wav",
                }

                TTS_TEXT_QUENE.put(tts_request_dict)
                await asyncio.sleep(0.01)

        yield json.dumps(
            {
                "event": "message",
                "retry": 100,
                "id": idx,
                "data": current_predict,
                "step": "llm",
                "end_flag": False,
            },
            ensure_ascii=False,
        )
        await asyncio.sleep(0.01)  # 加个延时避免无法发出 event stream

    if chat_item.plugins.digital_human and SERVER_PLUGINS_INFO.digital_human_server_enabled:

        wav_list = [
            Path(WEB_CONFIGS.TTS_WAV_GEN_PATH, chat_item.request_id + f"-{str(i).zfill(8)}.wav")
            for i in range(1, sentence_id + 1)
        ]
        while True:
            # 等待 TTS 生成完成
            not_exist_count = 0
            for tts_wav in wav_list:
                if not tts_wav.exists():
                    not_exist_count += 1

            logger.info(f"still need to wait for {not_exist_count}/{sentence_id} wav generating...")
            if not_exist_count == 0:
                break

            yield json.dumps(
                {
                    "event": "message",
                    "retry": 100,
                    "id": idx,
                    "data": current_predict,
                    "step": "tts",
                    "end_flag": False,
                },
                ensure_ascii=False,
            )
            await asyncio.sleep(1)  # 加个延时避免无法发出 event stream

        # 合并 tts
        tts_save_path = Path(WEB_CONFIGS.TTS_WAV_GEN_PATH, chat_item.request_id + ".wav")
        all_tts_data = []

        for wav_file in tqdm(wav_list):
            logger.info(f"Reading wav file {wav_file}...")
            with wave.open(str(wav_file), "rb") as wf:
                all_tts_data.append([wf.getparams(), wf.readframes(wf.getnframes())])

        logger.info(f"Merging wav file to {tts_save_path}...")
        tts_params = max([tts_data[0] for tts_data in all_tts_data])
        with wave.open(str(tts_save_path), "wb") as wf:
            wf.setparams(tts_params)  # 使用第一个音频参数

            for wf_data in all_tts_data:
                wf.writeframes(wf_data[1])
        logger.info(f"Merged wav file to {tts_save_path} !")

        # 生成数字人视频
        tts_request_dict = {
            "user_id": chat_item.user_id,
            "request_id": chat_item.request_id,
            "chunk_id": 0,
            "tts_path": str(tts_save_path),
        }

        logger.info(f"Generating digital human...")
        DIGITAL_HUMAN_QUENE.put(tts_request_dict)
        while True:
            if (
                Path(WEB_CONFIGS.DIGITAL_HUMAN_VIDEO_OUTPUT_PATH)
                .joinpath(Path(tts_save_path).stem + ".mp4")
                .with_suffix(".txt")
                .exists()
            ):
                break
            yield json.dumps(
                {
                    "event": "message",
                    "retry": 100,
                    "id": idx,
                    "data": current_predict,
                    "step": "dg",
                    "end_flag": False,
                },
                ensure_ascii=False,
            )
            await asyncio.sleep(1)  # 加个延时避免无法发出 event stream

        # 删除过程文件
        for wav_file in wav_list:
            wav_file.unlink()

    yield json.dumps(
        {
            "event": "message",
            "retry": 100,
            "id": idx,
            "data": current_predict,
            "step": "all",
            "end_flag": True,
        },
        ensure_ascii=False,
    )


def make_poster_by_video_first_frame(video_path: str, image_output_name: str):
    """根据视频第一帧生成缩略图

    Args:
        video_path (str): 视频文件路径

    Returns:
        str: 第一帧保存的图片路径
    """

    # 打开视频文件
    cap = cv2.VideoCapture(video_path)

    # 读取第一帧
    ret, frame = cap.read()

    # 检查是否成功读取
    poster_save_path = str(Path(video_path).parent.joinpath(image_output_name))
    if ret:
        # 保存图像到文件
        cv2.imwrite(poster_save_path, frame)
        logger.info(f"第一帧已保存为 {poster_save_path}")
    else:
        logger.error("无法读取视频帧")

    # 释放视频捕获对象
    cap.release()

    return poster_save_path


@dataclass
class ResultCode:
    SUCCESS: int = 0000  # 成功
    FAIL: int = 1000  # 失败


def make_return_data(success_flag: bool, code: ResultCode, message: str, data: dict):
    return {
        "success": success_flag,
        "code": code,
        "message": message,
        "data": data,
        "timestamp": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
    }


def gen_default_data():
    """生成默认数据，包括：
    - 商品数据
    - 主播数据
    - 直播间信息以及关联表
    """

    def create_default_user():
        """创建默认用户"""
        admin_user = UserInfo(
            username="hingwen.wong",
            ip_address=IPv4Address("127.0.0.1"),
            email="peterhuang0323@qq.com",
            hashed_password="$2b$12$zXXveodjipHZMoSxJz5ODul7Z9YeRJd0GeSBjpwHdqEtBbAFvEdre",  # 123456 -> 用 get_password_hash 加密后的字符串
            avatar="/user/user-avatar.png",
        )

        with Session(DB_ENGINE) as session:
            session.add(admin_user)
            session.commit()
```

### Core Architecture Module: `server/digital_human/modules/digital_human_worker.py`
```
from pathlib import Path
from .realtime_inference import DIGITAL_HUMAN_HANDLER, gen_digital_human_preprocess, gen_digital_human_video
from ...web_configs import WEB_CONFIGS


async def gen_digital_human_video_app(stream_id, audio_path, save_tag):
    if DIGITAL_HUMAN_HANDLER is None:
        return None

    save_path = gen_digital_human_video(
        DIGITAL_HUMAN_HANDLER,
        stream_id,
        audio_path,
        work_dir=str(Path(WEB_CONFIGS.DIGITAL_HUMAN_VIDEO_OUTPUT_PATH).absolute()),
        video_path=save_tag,
        fps=DIGITAL_HUMAN_HANDLER.fps,
    )

    return save_path


async def preprocess_digital_human_app(stream_id, video_path):
    if DIGITAL_HUMAN_HANDLER is None:
        return None

    res = gen_digital_human_preprocess(
        DIGITAL_HUMAN_HANDLER,
        stream_id,
        work_dir=str(Path(WEB_CONFIGS.DIGITAL_HUMAN_VIDEO_OUTPUT_PATH).absolute()),
        video_path=video_path,
    )

    return res

```

### Core Architecture Module: `server/digital_human/modules/musetalk/utils/__init__.py`
```
import sys
from os.path import abspath, dirname
current_dir = dirname(abspath(__file__))
parent_dir = dirname(current_dir)
sys.path.append(parent_dir+'/utils')

```

### Core Architecture Module: `server/digital_human/modules/musetalk/utils/blending.py`
```
from PIL import Image
import numpy as np
import cv2
from face_parsing import FaceParsing


def init_face_parsing_model(
    resnet_path="./models/face-parse-bisent/resnet18-5c106cde.pth", face_model_pth="./models/face-parse-bisent/79999_iter.pth"
):
    fp_model = FaceParsing(resnet_path, face_model_pth)
    return fp_model


def get_crop_box(box, expand):
    x, y, x1, y1 = box
    x_c, y_c = (x + x1) // 2, (y + y1) // 2
    w, h = x1 - x, y1 - y
    s = int(max(w, h) // 2 * expand)
    crop_box = [x_c - s, y_c - s, x_c + s, y_c + s]
    return crop_box, s


def face_seg(image, fp_model):
    seg_image = fp_model(image)
    if seg_image is None:
        print("error, no person_segment")
        return None

    seg_image = seg_image.resize(image.size)
    return seg_image


def get_image(image, face, face_box, fp_model, upper_boundary_ratio=0.5, expand=1.2):
    # print(image.shape)
    # print(face.shape)

    body = Image.fromarray(image[:, :, ::-1])
    face = Image.fromarray(face[:, :, ::-1])

    x, y, x1, y1 = face_box
    # print(x1-x,y1-y)
    crop_box, s = get_crop_box(face_box, expand)
    x_s, y_s, x_e, y_e = crop_box
    face_position = (x, y)

    face_large = body.crop(crop_box)
    ori_shape = face_large.size

    mask_image = face_seg(face_large, fp_model)
    mask_small = mask_image.crop((x - x_s, y - y_s, x1 - x_s, y1 - y_s))
    mask_image = Image.new("L", ori_shape, 0)
    mask_image.paste(mask_small, (x - x_s, y - y_s, x1 - x_s, y1 - y_s))

    # keep upper_boundary_ratio of talking area
    width, height = mask_image.size
    top_boundary = int(height * upper_boundary_ratio)
    modified_mask_image = Image.new("L", ori_shape, 0)
    modified_mask_image.paste(mask_image.crop((0, top_boundary, width, height)), (0, top_boundary))

    blur_kernel_size = int(0.1 * ori_shape[0] // 2 * 2) + 1
    mask_array = cv2.GaussianBlur(np.array(modified_mask_image), (blur_kernel_size, blur_kernel_size), 0)
    mask_image = Image.fromarray(mask_array)

    face_large.paste(face, (x - x_s, y - y_s, x1 - x_s, y1 - y_s))
    body.paste(face_large, crop_box[:2], mask_image)
    body = np.array(body)
    return body[:, :, ::-1]


def get_image_prepare_material(image, face_box, fp_model, upper_boundary_ratio=0.5, expand=1.2):
    body = Image.fromarray(image[:, :, ::-1])

    x, y, x1, y1 = face_box
    # print(x1-x,y1-y)
    crop_box, s = get_crop_box(face_box, expand)
    x_s, y_s, x_e, y_e = crop_box

    face_large = body.crop(crop_box)
    ori_shape = face_large.size

    mask_image = face_seg(face_large, fp_model)
    mask_small = mask_image.crop((x - x_s, y - y_s, x1 - x_s, y1 - y_s))
    mask_image = Image.new("L", ori_shape, 0)
    mask_image.paste(mask_small, (x - x_s, y - y_s, x1 - x_s, y1 - y_s))

    # keep upper_boundary_ratio of talking area
    width, height = mask_image.size
    top_boundary = int(height * upper_boundary_ratio)
    modified_mask_image = Image.new("L", ori_shape, 0)
    modified_mask_image.paste(mask_image.crop((0, top_boundary, width, height)), (0, top_boundary))

    blur_kernel_size = int(0.1 * ori_shape[0] // 2 * 2) + 1
    mask_array = cv2.GaussianBlur(np.array(modified_mask_image), (blur_kernel_size, blur_kernel_size), 0)
    return mask_array, crop_box


def get_image_blending(image, face, face_box, mask_array, crop_box):
    body = Image.fromarray(image[:, :, ::-1])
    face = Image.fromarray(face[:, :, ::-1])

    x, y, x1, y1 = face_box
    x_s, y_s, x_e, y_e = crop_box
    face_large = body.crop(crop_box)

    mask_image = Image.fromarray(mask_array)
    mask_image = mask_image.convert("L")
    face_large.paste(face, (x - x_s, y - y_s, x1 - x_s, y1 - y_s))
    body.paste(face_large, crop_box[:2], mask_image)
    body = np.array(body)
    return body[:, :, ::-1]

```

### Core Architecture Module: `server/digital_human/modules/musetalk/utils/dwpose/default_runtime.py`
```
default_scope = 'mmpose'

# hooks
default_hooks = dict(
    timer=dict(type='IterTimerHook'),
    logger=dict(type='LoggerHook', interval=50),
    param_scheduler=dict(type='ParamSchedulerHook'),
    checkpoint=dict(type='CheckpointHook', interval=10),
    sampler_seed=dict(type='DistSamplerSeedHook'),
    visualization=dict(type='PoseVisualizationHook', enable=False),
    badcase=dict(
        type='BadCaseAnalysisHook',
        enable=False,
        out_dir='badcase',
        metric_type='loss',
        badcase_thr=5))

# custom hooks
custom_hooks = [
    # Synchronize model buffers such as running_mean and running_var in BN
    # at the end of each epoch
    dict(type='SyncBuffersHook')
]

# multi-processing backend
env_cfg = dict(
    cudnn_benchmark=False,
    mp_cfg=dict(mp_start_method='fork', opencv_num_threads=0),
    dist_cfg=dict(backend='nccl'),
)

# visualizer
vis_backends = [
    dict(type='LocalVisBackend'),
    # dict(type='TensorboardVisBackend'),
    # dict(type='WandbVisBackend'),
]
visualizer = dict(
    type='PoseLocalVisualizer', vis_backends=vis_backends, name='visualizer')

# logger
log_processor = dict(
    type='LogProcessor', window_size=50, by_epoch=True, num_digits=6)
log_level = 'INFO'
load_from = None
resume = False

# file I/O backend
backend_args = dict(backend='local')

# training/validation/testing progress
train_cfg = dict(by_epoch=True)
val_cfg = dict()
test_cfg = dict()

```

### Core Architecture Module: `server/digital_human/modules/musetalk/utils/dwpose/rtmpose-l_8xb32-270e_coco-ubody-wholebody-384x288.py`
```
#_base_ = ['../../../_base_/default_runtime.py']
_base_ = ['default_runtime.py']

# runtime
max_epochs = 270
stage2_num_epochs = 30
base_lr = 4e-3
train_batch_size = 8
val_batch_size = 8

train_cfg = dict(max_epochs=max_epochs, val_interval=10)
randomness = dict(seed=21)

# optimizer
optim_wrapper = dict(
    type='OptimWrapper',
    optimizer=dict(type='AdamW', lr=base_lr, weight_decay=0.05),
    paramwise_cfg=dict(
        norm_decay_mult=0, bias_decay_mult=0, bypass_duplicate=True))

# learning rate
param_scheduler = [
    dict(
        type='LinearLR',
        start_factor=1.0e-5,
        by_epoch=False,
        begin=0,
        end=1000),
    dict(
        # use cosine lr from 150 to 300 epoch
        type='CosineAnnealingLR',
        eta_min=base_lr * 0.05,
        begin=max_epochs // 2,
        end=max_epochs,
        T_max=max_epochs // 2,
        by_epoch=True,
        convert_to_iter_based=True),
]

# automatically scaling LR based on the actual training batch size
auto_scale_lr = dict(base_batch_size=512)

# codec settings
codec = dict(
    type='SimCCLabel',
    input_size=(288, 384),
    sigma=(6., 6.93),
    simcc_split_ratio=2.0,
    normalize=False,
    use_dark=False)

# model settings
model = dict(
    type='TopdownPoseEstimator',
    data_preprocessor=dict(
        type='PoseDataPreprocessor',
        mean=[123.675, 116.28, 103.53],
        std=[58.395, 57.12, 57.375],
        bgr_to_rgb=True),
    backbone=dict(
        _scope_='mmdet',
        type='CSPNeXt',
        arch='P5',
        expand_ratio=0.5,
        deepen_factor=1.,
        widen_factor=1.,
        out_indices=(4, ),
        channel_attention=True,
        norm_cfg=dict(type='SyncBN'),
        act_cfg=dict(type='SiLU'),
        init_cfg=dict(
            type='Pretrained',
            prefix='backbone.',
            checkpoint='https://download.openmmlab.com/mmpose/v1/projects/'
            'rtmpose/cspnext-l_udp-aic-coco_210e-256x192-273b7631_20230130.pth'  # noqa: E501
        )),
    head=dict(
        type='RTMCCHead',
        in_channels=1024,
        out_channels=133,
        input_size=codec['input_size'],
        in_featuremap_size=(9, 12),
        simcc_split_ratio=codec['simcc_split_ratio'],
        final_layer_kernel_size=7,
        gau_cfg=dict(
            hidden_dims=256,
            s=128,
            expansion_factor=2,
            dropout_rate=0.,
            drop_path=0.,
            act_fn='SiLU',
            use_rel_bias=False,
            pos_enc=False),
        loss=dict(
            type='KLDiscretLoss',
            use_target_weight=True,
            beta=10.,
            label_softmax=True),
        decoder=codec),
    test_cfg=dict(flip_test=True, ))

# base dataset settings
dataset_type = 'UBody2dDataset'
data_mode = 'topdown'
data_root = 'data/UBody/'

backend_args = dict(backend='local')

scenes = [
    'Magic_show', 'Entertainment', 'ConductMusic', 'Online_class', 'TalkShow',
    'Speech', 'Fitness', 'Interview', 'Olympic', 'TVShow', 'Singing',
    'SignLanguage', 'Movie', 'LiveVlog', 'VideoConference'
]

train_datasets = [
    dict(
        type='CocoWholeBodyDataset',
        data_root='data/coco/',
        data_mode=data_mode,
        ann_file='annotations/coco_wholebody_train_v1.0.json',
        data_prefix=dict(img='train2017/'),
        pipeline=[])
]

for scene in scenes:
    train_dataset = dict(
        type=dataset_type,
        data_root=data_root,
        data_mode=data_mode,
        ann_file=f'annotations/{scene}/train_annotations.json',
        data_prefix=dict(img='images/'),
        pipeline=[],
        sample_interval=10)
    train_datasets.append(train_dataset)

# pipelines
train_pipeline = [
    dict(type='LoadImage', backend_args=backend_args),
    dict(type='GetBBoxCenterScale'),
    dict(type='RandomFlip', direction='horizontal'),
    dict(type='RandomHalfBody'),
    dict(
        type='RandomBBoxTransform', scale_factor=[0.5, 1.5], rotate_factor=90),
    dict(type='TopdownAffine', input_size=codec['input_size']),
    dict(type='mmdet.YOLOXHSVRandomAug'),
    dict(
        type='Albumentation',
        transforms=[
            dict(type='Blur', p=0.1),
            dict(type='MedianBlur', p=0.1),
            dict(
                type='CoarseDropout',
                max_holes=1,
                max_height=0.4,
                max_width=0.4,
                min_holes=1,
                min_height=0.2,
                min_width=0.2,
                p=1.0),
        ]),
    dict(type='GenerateTarget', encoder=codec),
    dict(type='PackPoseInputs')
]
val_pipeline = [
    dict(type='LoadImage', backend_args=backend_args),
    dict(type='GetBBoxCenterScale'),
    dict(type='TopdownAffine', input_size=codec['input_size']),
    dict(type='PackPoseInputs')
]

train_pipeline_stage2 = [
    dict(type='LoadImage', backend_args=backend_args),
    dict(type='GetBBoxCenterScale'),
    dict(type='RandomFlip', direction='horizontal'),
    dict(type='RandomHalfBody'),
    dict(
        type='RandomBBoxTransform',
        shift_factor=0.,
        scale_factor=[0.5, 1.5],
        rotate_factor=90),
    dict(type='TopdownAffine', input_size=codec['input_size']),
    dict(type='mmdet.YOLOXHSVRandomAug'),
    dict(
        type='Albumentation',
        transforms=[
            dict(type='Blur', p=0.1),
            dict(type='MedianBlur', p=0.1),
            dict(
                type='CoarseDropout',
                max_holes=1,
                max_height=0.4,
                max_width=0.4,
                min_holes=1,
                min_height=0.2,
                min_width=0.2,
                p=0.5),
        ]),
    dict(type='GenerateTarget', encoder=codec),
    dict(type='PackPoseInputs')
]

# data loaders
train_dataloader = dict(
    batch_size=train_batch_size,
    num_workers=10,
    persistent_workers=True,
    sampler=dict(type='DefaultSampler', shuffle=True),
    dataset=dict(
        type='CombinedDataset',
        metainfo=dict(from_file='configs/_base_/datasets/coco_wholebody.py'),
        datasets=train_datasets,
        pipeline=train_pipeline,
        test_mode=False,
    ))

val_dataloader = dict(
    batch_size=val_batch_size,
    num_workers=10,
    persistent_workers=True,
    drop_last=False,
    sampler=dict(type='DefaultSampler', shuffle=False, round_up=False),
    dataset=dict(
        type='CocoWholeBodyDataset',
        data_root=data_root,
        data_mode=data_mode,
        ann_file='data/coco/annotations/coco_wholebody_val_v1.0.json',
        bbox_file='data/coco/person_detection_results/'
        'COCO_val2017_detections_AP_H_56_person.json',
        data_prefix=dict(img='coco/val2017/'),
        test_mode=True,
        pipeline=val_pipeline,
    ))
test_dataloader = val_dataloader

# hooks
default_hooks = dict(
    checkpoint=dict(
        save_best='coco-wholebody/AP', rule='greater', max_keep_ckpts=1))

custom_hooks = [
    dict(
        type='EMAHook',
        ema_type='ExpMomentumEMA',
        momentum=0.0002,
        update_buffers=True,
        priority=49),
    dict(
        type='mmdet.PipelineSwitchHook',
        switch_epoch=max_epochs - stage2_num_epochs,
        switch_pipeline=train_pipeline_stage2)
]

# evaluators
val_evaluator = dict(
    type='CocoWholeBodyMetric',
    ann_file='data/coco/annotations/coco_wholebody_val_v1.0.json')
test_evaluator = val_evaluator

```

### Core Architecture Module: `server/digital_human/modules/musetalk/utils/face_detection/__init__.py`
```
# -*- coding: utf-8 -*-

__author__ = """Adrian Bulat"""
__email__ = 'adrian.bulat@nottingham.ac.uk'
__version__ = '1.0.1'

from .api import FaceAlignment, LandmarksType, NetworkSize, YOLOv8_face

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #38** (2026-06-15): **建议：使用 FunASR/SenseVoice 增强语音交互**
  *Symptoms*: ## 功能建议  销冠大模型作为直播卖货助手，如果集成 **FunASR** 实时语音识别，就可以实现语音交互式带货。  ### 应用场景  - **实时识别观众语音提问**：识别后用大模型生成回复 - **主播语音指令**：语音控制切换商品、调整话术 - **直播字幕**：实时生成字幕提升观看体验  ### FunASR 优势  - **实时流式识别**：WebSocket 服务（`ws://localhost:10095`），延迟极低 - **中文识别极准**：AISHELL 基准 CER < 2% - **情感识别**：SenseVoice 可识别说话人情绪，适合分析观众互动 - **完全本地部署**：无需联网  ### 快速集成  ```python pip install funasr  from funasr import AutoModel model = AutoModel(model="iic/SenseVoiceSmall") result = model.generate(input="audio.wav") ```  如有兴趣，欢迎交流！
  **Post-Mortem & Fix Analysis**:
  > Consolidating duplicate feature requests I opened earlier — let's keep the discussion in #37. Apologies for the noise! / 合并我之前重复提交的建议，统一在 #37 讨论，抱歉打扰。

- **Issue #29** (2024-10-10): **可以不使用llm吗**
  *Symptoms*: 如题，作者大大

- **Issue #28** (2025-11-07): **add support for qianfan api in gen_dataset.py**
  *Symptoms*: 

- **Issue #27** (2024-09-29): **前端服务引入大小写错误**
  *Symptoms*: import barChartComponent from '@/components/BarChartComponent.vue' import lineChartComponent from '@/components/LineChartComponent.vue' BarChartComponent和LineChartComponent首字母应该是小写的 在/root/Streamer-Sales/frontend/src/views/home/HomeView.vue文件里 
  **Post-Mortem & Fix Analysis**:
  > Fixed，感谢您的指出

- **Issue #26** (2024-09-03): **griffe==0.46.0**
  *Symptoms*: 

- **Issue #24** (2024-09-27): **数字人工作流**
  *Symptoms*: 
  **Post-Mortem & Fix Analysis**:
  > 详见：https://github.com/PeterH0323/Streamer-Sales/blob/main/doc/digital_human/streamer-sales-lelemiao-workflow-v1.0.png 

- **Issue #20** (2024-09-27): **部署完之后**
  *Symptoms*: StreamLit打不开，体验界面也打不开
  **Post-Mortem & Fix Analysis**:
  > 体验界面已修复，本地部署可以拉最新代码试试

- **Issue #17** (2024-09-27): **运行 conda env create -f environment.yml 出现 PackagesNotFoundError: The following packages are not available from current channels: 应该怎么设置 **
  *Symptoms*: PackagesNotFoundError: The following packages are not available from current channels:    - zstd==1.5.5=hc292b87_0   - zlib==1.2.13=h5eee18b_0   - yaml==0.2.5=h7b6447c_0   - xz==5.4.6=h5eee18b_0   - wheel==0.41.2=py310h06a4308_0   - urllib3==2.1.0=py310h06a4308_1   - torchtriton==2.1.0=py310   - tk==8.6.12=h1ccaba5_0   - tbb==2021.8.0=hdb19cb5_0   - sympy==1.12=py310h06a4308_0   - sqlite==3.41.2=h5eee18b_0   - setuptools==68.2.2=py310h06a4308_0   - requests==2.31.0=py310h06a4308_1   - readline==8.2=h5eee18b_0   - pyyaml==6.0.1=py310h5eee18b_0   - pytorch-cuda==12.1=ha16c6d3_5   - pytorch==2.1.2=py3.10_cuda12.1_cudnn8.9.2_0   - python==3.10.14=h955ad1f_0   - pysocks==1.7.1=py310h06a4308_0   - pip==23.3.1=py310h06a4308_0   - pillow==10.2.0=py310h5eee18b_0   - openssl==3.0.13=h7f8727e_0   - openjpeg==2.4.0=h3ad879b_0   - openh264==2.1.1=h4ff587b_0   - numpy-base==1.26.4=py310hb5e798b_0   - numpy==1.26.4=py310h5f9d8c6_0   - networkx==3.1=py310h06a4308_0   - nettle==3.7.3=hbbd107a_1   - ncurses==6.4=h6a678d5_0   - mpmath==1.3.0=py310h06a4308_0   - mpfr==4.0.2=hb69a4c5_1   - mpc==1.1.0=h10f8cd9_1   - mkl_random==1.2.4=py310hdb19cb5_0   - mkl_fft==1.3.8=py310h5eee18b_0   - mkl-service==2.4.0=py310h5eee18b_1   - mkl==2023.1.0=h213fc3f_46344   - markupsafe==2.1.3=py310h5eee18b_0   - lz4-c==1.9.4=h6a678d5_0   - llvm-openmp==14.0.6=h9e868ea_0   - libwebp-base==1.3.2=h5eee18b_0   - libuuid==1.41.5=h5eee18b_0   - libunistring==0.9.10=h27cfd23_0 
  **Post-Mortem & Fix Analysis**:
  > 可以用 docker 部署试下 相关文档：https://github.com/PeterH0323/Streamer-Sales?tab=readme-ov-file#docker-compose%E6%8E%A8%E8%8D%90

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

### Incident Patch 1: `73962581` (2024-10-10)
**Commit Message**: Fix 直播间切换主播生成文案失败

**File**: `server/base/routers/llm.py` (modified, +1/-1)
```diff
@@ -88,7 +88,7 @@ async def gen_poduct_base_prompt(
 
     # 根据 ID 获取主播信息
     if streamer_info is None:
-        streamer_info = await get_db_streamer_info(streamer_id)
+        streamer_info = await get_db_streamer_info(user_id, streamer_id)
         streamer_info = streamer_info[0]
 
     # 将销售角色名和角色信息插入到 system prompt
```

---

### Incident Patch 2: `288c4902` (2024-10-10)
**Commit Message**: Fix 直播间编辑刷新之后数字人解说视频没有返回服务器地址

**File**: `server/base/routers/streaming_room.py` (modified, +7/-1)
```diff
@@ -75,7 +75,13 @@ async def get_streaming_room_id_api(
         # 直接返回会导致字段丢失，需要转 dict 确保返回值里面有该字段
         format_product_list = []
         for db_product in streaming_room_list[0].product_list:
-            format_product_list.append(dict(db_product))
+            
+            product_dict = dict(db_product)
+            # 将 start_video 改为服务器地址
+            if product_dict["start_video"] != "":
+                product_dict["start_video"] = API_CONFIG.REQUEST_FILES_URL + product_dict["start_video"]
+
+            format_product_list.append(product_dict)
         streaming_room_list = dict(streaming_room_list[0])
         streaming_room_list["product_list"] = format_product_list
     else:
```

---

### Incident Patch 3: `df4518f3` (2024-09-29)
**Commit Message**: Fix file name



---

### Incident Patch 4: `e181d7f9` (2024-09-29)
**Commit Message**: Fix file name



---

### Incident Patch 5: `d925390b` (2024-09-29)
**Commit Message**: Fix  rag 初始化

**File**: `server/base/base_server.py` (modified, +5/-0)
```diff
@@ -57,6 +57,11 @@ async def lifespan(app: FastAPI):
     # 新服务，生成默认数据，可以自行注释 or 修改
     gen_default_data()
 
+    if WEB_CONFIGS.ENABLE_RAG:
+        from .modules.rag.rag_worker import load_rag_model
+        # 生成 rag 数据库
+        await load_rag_model(user_id=1)
+
     yield
 
     # 结束
```

**File**: `server/base/modules/rag/rag_worker.py` (modified, +21/-26)
```diff
@@ -1,18 +1,21 @@
 import shutil
 from pathlib import Path
 
-from loguru import logger
 import torch
-import yaml
+from loguru import logger
 
 from ....web_configs import WEB_CONFIGS
+from ...database.product_db import get_db_product_info
 from .feature_store import gen_vector_db
 from .retriever import CacheRetriever
 
 # 基础配置
 CONTEXT_MAX_LENGTH = 3000  # 上下文最大长度
 GENERATE_TEMPLATE = "这是说明书：“{}”\n 客户的问题：“{}” \n 请阅读说明并运用你的性格进行解答。"  # RAG prompt 模板
 
+# RAG 实例句柄
+RAG_RETRIEVER = None
+
 
 def build_rag_prompt(rag_retriever: CacheRetriever, product_name, prompt):
 
@@ -50,7 +53,7 @@ def init_rag_retriever(rag_config: str, db_path: str):
     return retriever
 
 
-def gen_rag_db(force_gen=False):
+async def gen_rag_db(user_id, force_gen=False):
     """
     生成向量数据库。
 
@@ -71,25 +74,21 @@ def gen_rag_db(force_gen=False):
     Path(WEB_CONFIGS.PRODUCT_INSTRUCTION_DIR_GEN_DB_TMP).mkdir(exist_ok=True, parents=True)
 
     # 读取 yaml 文件，获取所有说明书路径，并移动到 tmp 目录
-    with open(WEB_CONFIGS.PRODUCT_INFO_YAML_PATH, "r", encoding="utf-8") as f:
-        product_info_dict = yaml.safe_load(f)
-    for _, info in product_info_dict.items():
+    product_list, _ = await get_db_product_info(user_id)
 
-        if info["delete"]:
-            # 去掉删除的商品
-            continue
+    for info in product_list:
 
         shutil.copyfile(
             Path(
                 WEB_CONFIGS.SERVER_FILE_ROOT,
                 WEB_CONFIGS.PRODUCT_FILE_DIR,
                 WEB_CONFIGS.INSTRUCTIONS_DIR,
-                Path(info["instruction"]).name,
+                Path(info.instruction).name,
             ),
-            Path(WEB_CONFIGS.PRODUCT_INSTRUCTION_DIR_GEN_DB_TMP).joinpath(Path(info["instruction"]).name),
+            Path(WEB_CONFIGS.PRODUCT_INSTRUCTION_DIR_GEN_DB_TMP).joinpath(Path(info.instruction).name),
         )
 
-    print("Generating rag database, pls wait ...")
+    logger.info("Generating rag database, pls wait ...")
     # 调用函数生成向量数据库
     gen_vector_db(
         WEB_CONFIGS.RAG_CONFIG_PATH,
@@ -101,27 +100,23 @@ def gen_rag_db(force_gen=False):
     shutil.rmtree(WEB_CONFIGS.PRODUCT_INSTRUCTION_DIR_GEN_DB_TMP)
 
 
-def load_rag_model():
-    # 生成 rag 数据库
-    gen_rag_db()
+async def load_rag_model(user_id):
 
-    # 加载 rag 模型
-    retriever = init_rag_retriever(rag_config=WEB_CONFIGS.RAG_CONFIG_PATH, db_path=WEB_CONFIGS.RAG_VECTOR_DB_DIR)
+    global RAG_RETRIEVER
 
-    return retriever
+    # 重新生成 RAG 向量数据库
+    await gen_rag_db(user_id)
+
+    # 加载 rag 模型
+    RAG_RETRIEVER = init_rag_retriever(rag_config=WEB_CONFIGS.RAG_CONFIG_PATH, db_path=WEB_CONFIGS.RAG_VECTOR_DB_DIR)
+    logger.info("load rag model done !...")
 
 
-def rebuild_rag_db(db_name="default"):
+async def rebuild_rag_db(user_id, db_name="default"):
 
     # 重新生成 RAG 向量数据库
-    gen_rag_db(force_gen=True)
+    await gen_rag_db(user_id, force_gen=True)
 
     # 重新加载 retriever
     RAG_RETRIEVER.pop(db_name)
     RAG_RETRIEVER.get(fs_id=db_name, config_path=WEB_CONFIGS.RAG_CONFIG_PATH, work_dir=WEB_CONFIGS.RAG_VECTOR_DB_DIR)
-
-
-if WEB_CONFIGS.ENABLE_RAG:
-    RAG_RETRIEVER = load_rag_model()
-else:
-    RAG_RETRIEVER = None
```

**File**: `server/base/routers/products.py` (modified, +3/-3)
```diff
@@ -66,7 +66,7 @@ async def upload_product_api(upload_product_item: ProductInfo, user_id: int = De
 
     if WEB_CONFIGS.ENABLE_RAG and rebuild_rag_db_flag:
         # 重新生成 RAG 向量数据库
-        rebuild_rag_db()
+        await rebuild_rag_db(user_id)
 
     return make_return_data(True, ResultCode.SUCCESS, "成功", "")
 
@@ -78,7 +78,7 @@ async def upload_product_api(product_id: int, upload_product_item: ProductInfo,
 
     if WEB_CONFIGS.ENABLE_RAG and rebuild_rag_db_flag:
         # 重新生成 RAG 向量数据库
-        rebuild_rag_db()
+        await rebuild_rag_db(user_id)
 
     return make_return_data(True, ResultCode.SUCCESS, "成功", "")
 
@@ -93,7 +93,7 @@ async def upload_product_api(productId: int, user_id: int = Depends(get_current_
 
     if WEB_CONFIGS.ENABLE_RAG:
         # 重新生成 RAG 向量数据库
-        rebuild_rag_db()
+        await rebuild_rag_db(user_id)
 
     return make_return_data(True, ResultCode.SUCCESS, "成功", "")
 
```

---

### Incident Patch 6: `12608c2e` (2024-09-14)
**Commit Message**: Fix 环境变量

**File**: `server/web_configs.py` (modified, +1/-1)
```diff
@@ -36,7 +36,7 @@ class WebConfigs:
     # ==================================================================
     #                             数据库配置
     # ==================================================================
-    POSTGRES_SERVER = os.environ.get("POSTGRES_USER", "127.0.0.1")  # 数据库 IP
+    POSTGRES_SERVER = os.environ.get("POSTGRES_SERVER", "127.0.0.1")  # 数据库 IP
     POSTGRES_PORT = 5432  # 数据库端口号
     POSTGRES_USER = os.environ.get("POSTGRES_USER", "postgres")  # 数据库用户名
     POSTGRES_PASSWORD = os.environ.get("POSTGRES_PASSWORD", "")  # 数据库密码，自行填写
```

---

### Incident Patch 7: `e17c07d2` (2024-09-13)
**Commit Message**: Fix assert 判断

**File**: `server/base/routers/llm.py` (modified, +2/-2)
```diff
@@ -72,8 +72,8 @@ async def gen_poduct_base_prompt(
         List[Dict[str,str]]: 生成的 promot
     """
 
-    assert streamer_id == -1 and streamer_info is not None
-    assert product_id == -1 and product_info is not None
+    assert (streamer_id == -1 and streamer_info is not None) or (streamer_id != -1 and streamer_info is None)
+    assert (product_id == -1 and product_info is not None) or  (product_id != -1 and product_info is None)
 
     # 加载对话配置文件
     dataset_yaml = await get_llm_product_prompt_base_info()
```

---

### Incident Patch 8: `c30b5ef5` (2024-09-13)
**Commit Message**: Fix 新建主播信息索引错误

**File**: `frontend/src/views/digital-human/DigitalHumanEditDialogView.vue` (modified, +6/-2)
```diff
@@ -12,14 +12,18 @@ import { AxiosError } from 'axios'
 
 const dialogInfoVisible = ref(false)
 const saveLoading = ref(false)
-// 定义标题
 const steamerInfo = ref({} as StreamerInfo)
 steamerInfo.value.streamer_id = 0
 
 const showItemInfoDialog = async (streamerId: number) => {
   console.log('streamerId = ', streamerId)
   dialogInfoVisible.value = true
 
+  if (streamerId === 0) {
+    steamerInfo.value = {} as StreamerInfo
+    return
+  }
+
   try {
     // 请求接口获取主播数据
     const { data } = await streamerDetailInfoRequest(streamerId)
@@ -66,7 +70,7 @@ defineExpose({ showItemInfoDialog })
 <template>
   <div class="dialog-container">
     <el-dialog v-model="dialogInfoVisible" title="主播详情" width="80%" destroy-on-close>
-      <StreamerInfoComponent v-model="steamerInfo" />
+      <StreamerInfoComponent v-model="steamerInfo" :disable-change="false" />
 
       <template #footer>
         <div class="dialog-footer">
```

---

### Incident Patch 9: `a7ed1dba` (2024-09-13)
**Commit Message**: Fix 新建主播性格无法新增

**File**: `frontend/src/components/StreamerInfoComponent.vue` (modified, +18/-3)
```diff
@@ -1,5 +1,5 @@
 <script lang="ts" setup>
-import { computed, nextTick, ref } from 'vue'
+import { nextTick, ref, watch } from 'vue'
 import { ElInput } from 'element-plus'
 import type { InputInstance } from 'element-plus'
 import { Plus } from '@element-plus/icons-vue'
@@ -23,12 +23,27 @@ const props = withDefaults(defineProps<Props>(), {
 })
 
 // 性格操作
-modelSteamerInfo.value.character = ''
-const characterList = computed(() => modelSteamerInfo.value.character.split(';'))
 const inputCharacterValue = ref('')
 const inputCharacterVisible = ref(false)
 const InputCharacterRef = ref<InputInstance>()
 
+modelSteamerInfo.value.character = ''
+let characterList = ref([] as string[])
+watch(
+  modelSteamerInfo,
+  (newValue) => {
+    console.log(`性格：更新为: ${newValue}`)
+
+    if (
+      typeof modelSteamerInfo.value.character === 'string' &&
+      modelSteamerInfo.value.character !== ''
+    ) {
+      characterList.value = modelSteamerInfo.value.character.split(';')
+    }
+  },
+  { immediate: true }
+)
+
 const handleCharacterClose = (tag: string) => {
   // 删除性格操作
   characterList.value.splice(characterList.value.indexOf(tag), 1)
```

---

### Incident Patch 10: `c5f35a41` (2024-09-13)
**Commit Message**: Fix 无法新建主播

**File**: `frontend/src/api/streamerInfo.ts` (modified, +2/-1)
```diff
@@ -44,8 +44,9 @@ const streamerDetailInfoRequest = (streamerId: number) => {
 
 // 更新特定主播信息
 const streamerEditDetailRequest = async (streamerItem: StreamerInfo) => {
-  if (streamerItem.streamer_id == 0) {
+  if (typeof streamerItem.streamer_id != 'number' || streamerItem.streamer_id === 0) {
     // 新建
+    console.info(streamerItem)
     return request_handler<ResultPackage<number>>({
       method: 'POST',
       url: '/streamer/create',
```

**File**: `server/base/database/streamer_info_db.py` (modified, +17/-27)
```diff
@@ -83,9 +83,7 @@ async def delete_streamer_id(streamer_id: int, user_id: int) -> bool:
         with Session(DB_ENGINE) as session:
             # 查找特定 ID
             streamer_info = session.exec(
-                select(StreamerInfo).where(
-                    and_(StreamerInfo.streamer_id == streamer_id, StreamerInfo.user_id == user_id)
-                )
+                select(StreamerInfo).where(and_(StreamerInfo.streamer_id == streamer_id, StreamerInfo.user_id == user_id))
             ).one()
 
             if streamer_info is None:
@@ -124,36 +122,28 @@ def create_or_update_db_streamer_by_id(streamer_id: int, new_info: StreamerInfo,
         if streamer_id > 0:
             # 更新特定 ID
             streamer_info = session.exec(
-                select(StreamerInfo).where(
-                    and_(StreamerInfo.streamer_id == streamer_id, StreamerInfo.user_id == user_id)
-                )
+                select(StreamerInfo).where(and_(StreamerInfo.streamer_id == streamer_id, StreamerInfo.user_id == user_id))
             ).one()
 
             if streamer_info is None:
                 logger.error("Edit by other ID !!!")
                 return -1
-
-            # 更新对应的值
-            streamer_info.name = new_info.name
-            streamer_info.character = new_info.character
-            streamer_info.avatar = new_info.avatar
-            streamer_info.tts_weight_tag = new_info.tts_weight_tag
-            streamer_info.tts_reference_sentence = new_info.tts_reference_sentence
-            streamer_info.tts_reference_audio = new_info.tts_reference_audio
-            streamer_info.poster_image = new_info.poster_image
-            streamer_info.base_mp4_path = new_info.base_mp4_path
-
-            session.add(streamer_info)
         else:
             # 新增，直接添加即可
-            session.add(new_info)
-
+            streamer_info = StreamerInfo(user_id=user_id)
+
+        # 更新对应的值
+        streamer_info.name = new_info.name
+        streamer_info.character = new_info.character
+        streamer_info.avatar = new_info.avatar
+        streamer_info.tts_weight_tag = new_info.tts_weight_tag
+        streamer_info.tts_reference_sentence = new_info.tts_reference_sentence
+        streamer_info.tts_reference_audio = new_info.tts_reference_audio
+        streamer_info.poster_image = new_info.poster_image
+        streamer_info.base_mp4_path = new_info.base_mp4_path
+
+        session.add(streamer_info)
         session.commit()  # 提交
-        session.refresh(new_info)
-
-        return new_info.streamer_id
-
+        session.refresh(streamer_info)
 
-async def get_streamers_info(user_id: int, stream_id: int = -1) -> List[StreamerInfo]:
-    # TODO 删除
-    raise NotImplemented("Delete")
+        return int(streamer_info.streamer_id)
```

**File**: `server/base/routers/streamer_info.py` (modified, +20/-12)
```diff
@@ -9,6 +9,7 @@
 @Desc    :   主播管理信息页面接口
 """
 
+from typing import Tuple
 import uuid
 from pathlib import Path
 
@@ -29,7 +30,7 @@
 )
 
 
-async def gen_digital_human(user_id, streamer_id: int, new_streamer_info: StreamerInfo) -> StreamerInfo:
+async def gen_digital_human(user_id, streamer_id: int, new_streamer_info: StreamerInfo) -> Tuple[str, str]:
     """生成数字人视频
 
     Args:
@@ -38,16 +39,17 @@ async def gen_digital_human(user_id, streamer_id: int, new_streamer_info: Stream
         new_streamer_info (StreamerInfo): 新的主播信息
 
     Returns:
-        str: 新的数字人信息
+        str: 数字人视频地址
+        str: 数字人头像/海报地址
     """
 
     streamer_info_db = await get_db_streamer_info(user_id, streamer_id)
     streamer_info_db = streamer_info_db[0]
 
     new_base_mp4_path = new_streamer_info.base_mp4_path.replace(API_CONFIG.REQUEST_FILES_URL, "")
-    if streamer_info_db.base_mp4_path == new_base_mp4_path:
+    if streamer_info_db.base_mp4_path.replace(API_CONFIG.REQUEST_FILES_URL, "") == new_base_mp4_path:
         # 数字人视频没更新，跳过
-        return new_streamer_info
+        return streamer_info_db.base_mp4_path, streamer_info_db.poster_image
 
     # 调取接口生成进行数字人预处理
 
@@ -74,9 +76,7 @@ async def gen_digital_human(user_id, streamer_id: int, new_streamer_info: Stream
     if "http://" not in poster_server_url and "http:/" in poster_server_url:
         poster_server_url = poster_server_url.replace("http:/", "http://")
 
-    new_streamer_info.poster_image = poster_server_url
-
-    return new_streamer_info
+    return new_streamer_info.base_mp4_path, poster_server_url
 
 
 @router.get("/list", summary="获取所有主播信息接口，用于用户进行主播的选择")
@@ -98,9 +98,9 @@ async def get_streamer_info_api(streamerId: int, user_id: int = Depends(get_curr
 
 
 @router.post("/create", summary="新增主播信息接口")
-async def create_streamer_info_api(streamer_info: StreamerInfo, user_id: int = Depends(get_current_user_info)):
+async def create_streamer_info_api(streamerItem: StreamerInfo, user_id: int = Depends(get_current_user_info)):
     """新增主播信息"""
-
+    streamer_info = streamerItem
     streamer_info.user_id = user_id
     streamer_info.streamer_id = None
 
@@ -115,12 +115,16 @@ async def create_streamer_info_api(streamer_info: StreamerInfo, user_id: int = D
 
     streamer_info.poster_image = poster_image
     streamer_info.base_mp4_path = base_mp4_path
+    streamer_info.streamer_id = streamer_id
 
     # 数字人视频对其进行初始化，同时生成头图
-    streamer_info = await gen_digital_human(user_id, streamer_id, streamer_info)
+    video_info = await gen_digital_human(user_id, streamer_id, streamer_info)
 
-    create_or_update_db_streamer_by_id(streamer_id, streamer_info, user_id)
+    streamer_info.base_mp4_path = video_info[0]
+    streamer_info.poster_image = video_info[1]
+    streamer_info.avatar = video_info[1]
 
+    create_or_update_db_streamer_by_id(streamer_id, streamer_info, user_id)
     return make_return_data(True, ResultCode.SUCCESS, "成功", streamer_id)
 
 
@@ -129,7 +133,11 @@ async def edit_streamer_info_api(streamer_id: int, streamer_info: StreamerInfo,
     """修改主播信息"""
 
     # 如果更新了数字人视频对其进行初始化，同时生成头图
-    streamer_info = await gen_digital_human(user_id, streamer_id, streamer_info)
+    video_info = await gen_digital_human(user_id, streamer_id, streamer_info)
+
+    streamer_info.base_mp4_path = video_info[0]
+    streamer_info.poster_image = video_info[1]
+    streamer_info.avatar = video_info[1]
 
     # 更新数据库
     create_or_update_db_streamer_by_id(streamer_id, streamer_info, user_id)
```

---

### Incident Patch 11: `86dc273f` (2024-09-11)
**Commit Message**: Fix 文案编辑窗口修改之后没有进行值更新

**File**: `frontend/src/components/InfoDialogComponents.vue` (modified, +7/-1)
```diff
@@ -66,6 +66,12 @@ const showItemInfoDialog = async (
   }
 }
 
+const handleSaveClick = () => {
+  // 更新双向绑定的值
+  dialogFormVisible.value = false
+  updateGenValue(infoValue.value)
+}
+
 // 是否正在生成文案标识
 const isGenerating = ref(false)
 
@@ -262,7 +268,7 @@ defineExpose({ showItemInfoDialog })
 
           <el-button
             v-show="itemType !== 'Instruction'"
-            @click="dialogFormVisible = false"
+            @click="handleSaveClick"
             type="success"
             :disabled="isGenerating"
           >
```

---

### Incident Patch 12: `80f10405` (2024-09-09)
**Commit Message**: Fix typo

**File**: `server/base/routers/llm.py` (modified, +2/-2)
```diff
@@ -16,7 +16,7 @@
 
 from ..database.llm_db import get_llm_product_prompt_base_info
 from ..database.product_db import get_db_product_info
-from ..database.streamer_info_db import get_db_steamer_info
+from ..database.streamer_info_db import get_db_streamer_info
 from ..models.llm_model import GenProductItem, GenSalesDocItem
 from ..modules.agent.agent_worker import get_agent_result
 from ..server_info import SERVER_PLUGINS_INFO
@@ -74,7 +74,7 @@ async def gen_poduct_base_prompt(user_id, streamer_id, product_id) -> List[Dict[
     product_info_struct_template = dataset_yaml["product_info_struct"]
 
     # 根据 ID 获取主播信息
-    streamer_info = await get_db_steamer_info(streamer_id)
+    streamer_info = await get_db_streamer_info(streamer_id)
     streamer_info = streamer_info[0]
 
     # 将销售角色名和角色信息插入到 system prompt
```

---

### Incident Patch 13: `da03dcaa` (2024-09-09)
**Commit Message**: Fix typo

**File**: `server/base/database/streamer_info_db.py` (modified, +8/-8)
```diff
@@ -20,7 +20,7 @@
 from .init_db import DB_ENGINE
 
 
-async def get_db_steamer_info(user_id: int, streamer_id: int | None = None) -> List[StreamerInfo] | None:
+async def get_db_streamer_info(user_id: int, streamer_id: int | None = None) -> List[StreamerInfo] | None:
     """查询数据库中的商品信息
 
     Args:
@@ -46,23 +46,23 @@ async def get_db_steamer_info(user_id: int, streamer_id: int | None = None) -> L
             )
 
         # 查询获取商品
-        steamer_list = session.exec(select(StreamerInfo).where(query_condiction).order_by(StreamerInfo.streamer_id)).all()
+        streamer_list = session.exec(select(StreamerInfo).where(query_condiction).order_by(StreamerInfo.streamer_id)).all()
 
-    if steamer_list is None:
+    if streamer_list is None:
         logger.warning("nothing to find in db...")
-        steamer_list = []
+        streamer_list = []
 
     # 将路径换成服务器路径
-    for streamer in steamer_list:
+    for streamer in streamer_list:
         streamer.avatar = API_CONFIG.REQUEST_FILES_URL + streamer.avatar
         streamer.tts_reference_audio = API_CONFIG.REQUEST_FILES_URL + streamer.tts_reference_audio
         streamer.poster_image = API_CONFIG.REQUEST_FILES_URL + streamer.poster_image
         streamer.base_mp4_path = API_CONFIG.REQUEST_FILES_URL + streamer.base_mp4_path
 
-    logger.info(steamer_list)
-    logger.info(f"len {len(steamer_list)}")
+    logger.info(streamer_list)
+    logger.info(f"len {len(streamer_list)}")
 
-    return steamer_list
+    return streamer_list
 
 
 async def delete_streamer_id(streamer_id: int, user_id: int) -> bool:
```

**File**: `server/base/routers/streamer_info.py` (modified, +5/-7)
```diff
@@ -17,7 +17,7 @@
 from loguru import logger
 
 from ...web_configs import API_CONFIG, WEB_CONFIGS
-from ..database.streamer_info_db import create_or_update_db_streamer_by_id, delete_streamer_id, get_db_steamer_info
+from ..database.streamer_info_db import create_or_update_db_streamer_by_id, delete_streamer_id, get_db_streamer_info
 from ..models.streamer_info_model import StreamerInfo
 from ..utils import ResultCode, make_poster_by_video_first_frame, make_return_data
 from .users import get_current_user_info
@@ -41,7 +41,7 @@ async def gen_digital_human(user_id, streamer_id: int, new_streamer_info: Stream
         str: 新的数字人信息
     """
 
-    streamer_info_db = await get_db_steamer_info(user_id, streamer_id)
+    streamer_info_db = await get_db_streamer_info(user_id, streamer_id)
     streamer_info_db = streamer_info_db[0]
 
     new_base_mp4_path = new_streamer_info.base_mp4_path.replace(API_CONFIG.REQUEST_FILES_URL, "")
@@ -82,15 +82,15 @@ async def gen_digital_human(user_id, streamer_id: int, new_streamer_info: Stream
 @router.get("/list", summary="获取所有主播信息接口，用于用户进行主播的选择")
 async def get_streamer_info_api(user_id: int = Depends(get_current_user_info)):
     """获取所有主播信息，用于用户进行主播的选择"""
-    streamer_list = await get_db_steamer_info(user_id)
+    streamer_list = await get_db_streamer_info(user_id)
     return make_return_data(True, ResultCode.SUCCESS, "成功", streamer_list)
 
 
 @router.get("/info/{streamerId}", summary="用于获取特定主播的信息接口")
 async def get_streamer_info_api(streamerId: int, user_id: int = Depends(get_current_user_info)):
     """用于获取特定主播的信息"""
 
-    streamer_list = await get_db_steamer_info(user_id, streamerId)
+    streamer_list = await get_db_streamer_info(user_id, streamerId)
     if len(streamer_list) == 1:
         streamer_list = streamer_list[0]
 
@@ -125,9 +125,7 @@ async def create_streamer_info_api(streamer_info: StreamerInfo, user_id: int = D
 
 
 @router.put("/edit/{streamer_id}", summary="修改主播信息接口")
-async def edit_streamer_info_api(
-    streamer_id: int, streamer_info: StreamerInfo, user_id: int = Depends(get_current_user_info)
-):
+async def edit_streamer_info_api(streamer_id: int, streamer_info: StreamerInfo, user_id: int = Depends(get_current_user_info)):
     """修改主播信息"""
 
     # 如果更新了数字人视频对其进行初始化，同时生成头图
```

---

### Incident Patch 14: `1f0f3aaf` (2024-09-03)
**Commit Message**: Fix 依赖

**File**: `requirements.txt` (modified, +0/-1)
```diff
@@ -2,5 +2,4 @@
 -r requirements/tts.txt
 -r requirements/digital_human.txt
 -r requirements/asr.txt
--r requirements/streamlit.txt
 -r requirements/train.txt
\ No newline at end of file
```

---

### Incident Patch 15: `9b450341` (2024-09-03)
**Commit Message**: Fix typo

**File**: `configs/streamer_cfg.yaml` (modified, +1/-1)
```diff
@@ -1,4 +1,4 @@
-- avater: http://localhost:8000/files/digital_human/streamer_info_files/lelemiao.png
+- avatar: http://localhost:8000/files/digital_human/streamer_info_files/lelemiao.png
   base_mp4_path: http://localhost:8000/files/digital_human/streamer_info_files/lelemiao.mp4
   character:
   - 甜美
```

**File**: `frontend/src/api/streamerInfo.ts` (modified, +1/-1)
```diff
@@ -8,7 +8,7 @@ interface StreamerInfo {
   name: string
   value: string
   character: string[]
-  avater: string
+  avatar: string
 
   tts_weight_tag: string
   tts_reference_audio: string
```

**File**: `frontend/src/api/streamingRoom.ts` (modified, +1/-1)
```diff
@@ -14,7 +14,7 @@ interface messageItem {
   role: string
   userId: number
   userName: string
-  avater: string
+  avatar: string
   message: string
   datetime: string
 }
```

**File**: `frontend/src/api/user.ts` (modified, +1/-1)
```diff
@@ -14,7 +14,7 @@ interface UserInfo {
   user_id: number
   ip_adress: string
   full_name: string
-  avater: string
+  avatar: string
   email: string
   hashed_password: string
   disabled: boolean
```

**File**: `frontend/src/components/MessageComponent.vue` (modified, +2/-3)
```diff
@@ -4,7 +4,7 @@ import 'md-editor-v3/lib/preview.css'
 
 // 定义组件入参
 const props = defineProps({
-  avater: {
+  avatar: {
     type: String,
     default: ''
   },
@@ -32,8 +32,7 @@ const props = defineProps({
     <el-row :gutter="0">
       <el-col :span="2">
         <div>
-          <!-- 头像: {{ props.avater }} -->
-          <el-avatar :src="props.avater" />
+          <el-avatar :src="props.avatar" />
         </div>
       </el-col>
       <el-col :span="22">
```

**File**: `frontend/src/components/NavbarComponent.vue` (modified, +1/-1)
```diff
@@ -45,7 +45,7 @@ onMounted(async () => {
     <!-- 导航栏右边 -->
     <!-- 退出登录 -->
     <el-dropdown trigger="click">
-        <el-avatar :src="userInfoItem.avater" />
+        <el-avatar :src="userInfoItem.avatar" />
       <template #dropdown>
         <el-dropdown-menu class="logout">
           <el-dropdown-item>{{ userInfoItem.username }}</el-dropdown-item>
```

**File**: `frontend/src/views/streaming/StreamingOnAirView.vue` (modified, +2/-2)
```diff
@@ -92,7 +92,7 @@ const handelSendClick = async () => {
     role: 'user',
     userId: userInfoItem.value.user_id,
     userName: userInfoItem.value.username,
-    avater: userInfoItem.value.avater,
+    avatar: userInfoItem.value.avatar,
     message: inputValue.value,
     datetime: ''
   })
@@ -290,7 +290,7 @@ const handleStop = async () => {
               v-for="(item, index) in currentStatus.conversation"
               :key="index"
               :role="item.role"
-              :avater="item.avater"
+              :avatar="item.avatar"
               :userName="item.userName"
               :message="item.message"
               :datetime="item.datetime"
```

**File**: `server/base/database/user_db.py` (modified, +1/-1)
```diff
@@ -18,7 +18,7 @@
         "ip_address": "127.0.0.1",
         "email": "peterhuang0323@qq.com",
         "hashed_password": "$2b$12$zXXveodjipHZMoSxJz5ODul7Z9YeRJd0GeSBjpwHdqEtBbAFvEdre",
-        "avater": "https://cube.elemecdn.com/0/88/03b0d39583f48206768a7534e55bcpng.png",
+        "avatar": "https://cube.elemecdn.com/0/88/03b0d39583f48206768a7534e55bcpng.png",
         "disabled": False,
     }
 }
```

#### Recent Merged Pull Requests:
- **PR #28** (closed): add support for qianfan api in gen_dataset.py (@666xz666)
- **PR #26** (closed): griffe==0.46.0 (@hellocatfish)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
