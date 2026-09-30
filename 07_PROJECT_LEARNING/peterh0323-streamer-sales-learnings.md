# Forensic Learning Record (Deep Inspection): PeterH0323/Streamer-Sales

> **Canonical Artifact**: `07_PROJECT_LEARNING/peterh0323-streamer-sales-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/PeterH0323/Streamer-Sales](https://github.com/PeterH0323/Streamer-Sales))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-09-30T21:03:33.882Z  
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

### Core Architecture Module: `benchmark/get_benchmark_report.py`
```
import datetime
from pathlib import Path

import torch
from lmdeploy import GenerationConfig, TurbomindEngineConfig, pipeline
from prettytable import PrettyTable
from transformers import AutoModelForCausalLM, AutoTokenizer
from modelscope import snapshot_download


def get_lmdeploy_benchmark(mode_name, model_format="hf", tag="LMDeploy (Turbomind)"):
    print(f"Processing {mode_name}")

    model_path = snapshot_download(mode_name, revision="master")

    backend_config = TurbomindEngineConfig(model_format=model_format, session_len=32768)
    gen_config = GenerationConfig(
        top_p=0.8,
        top_k=40,
        temperature=0.7,
        # max_new_tokens=4096
    )
    pipe = pipeline(model_path, backend_config=backend_config)

    # warmup
    inp = "你好！"
    for i in range(5):
        print(f"Warm up...[{i+1}/5]")
        pipe([inp])

    # test speed
    times = 10
    total_words = 0
    start_time = datetime.datetime.now()
    for i in range(times):
        response = pipe(["请介绍一下你自己。"], gen_config=gen_config)
        total_words += len(response[0].text)
    end_time = datetime.datetime.now()

    delta_time = end_time - start_time
    delta_time = delta_time.seconds + delta_time.microseconds / 1000000.0
    speed = total_words / delta_time

    print(f"{Path(model_path).name:<10}, {speed:.3f}")
    return [Path(model_path).name, tag, round(speed, 4)]


def get_hf_benchmark(model_name, tag="transformer"):

    print(f"Processing {model_name}")

    model_path = snapshot_download(model_name, revision="master")

    tokenizer = AutoTokenizer.from_pretrained(model_path, trust_remote_code=True)

    # Set `torch_dtype=torch.float16` to load model in float16, otherwise it will be loaded as float32 and cause OOM Error.
    model = AutoModelForCausalLM.from_pretrained(model_path, torch_dtype=torch.float16, trust_remote_code=True).cuda()
    model = model.eval()

    # warmup
    inp = "你好！"
    for i in range(5):
        print(f"Warm up...[{i + 1}/5]")
        response, history = model.chat(tokenizer, inp, history=[])

    # test speed
    inp = "请介绍一下你自己。"
    times = 10
    total_words = 0
    start_time = datetime.datetime.now()
    for i in range(times):
        response, history = model.chat(tokenizer, inp, history=history)
        total_words += len(response)
    end_time = datetime.datetime.now()

    delta_time = end_time - start_time
    delta_time = delta_time.seconds + delta_time.microseconds / 1000000.0
    speed = total_words / delta_time
    print(f"{Path(model_path).name:<10}, {speed:.3f}")
    return [Path(model_path).name, tag, round(speed, 4)]


if __name__ == "__main__":

    table = PrettyTable()
    table.field_names = ["Model", "Toolkit", "Speed (words/s)"]
    table.add_row(get_hf_benchmark("HinGwenWoong/streamer-sales-lelemiao-7b"))
    table.add_row(get_lmdeploy_benchmark("HinGwenWoong/streamer-sales-lelemiao-7b", model_format="hf"))
    table.add_row(get_lmdeploy_benchmark("HinGwenWoong/streamer-sales-lelemiao-7b-4bit", model_format="awq"))
    print(table)

```

### Core Architecture Module: `dataset/gen_dataset/gen_dataset.py`
```
import argparse
from copy import deepcopy
import json
import random
import re
from http import HTTPStatus
from pathlib import Path

import dashscope
import requests
import yaml
from tqdm import tqdm


def set_api_key(api_type, api_yaml_path):
    """设置 api key

    Args:
        api_type (str): api 类型
        api_yaml_path (str): api yaml 文件路径
    """
    # 读取 yaml 文件
    with open(api_yaml_path, "r", encoding="utf-8") as f:
        api_yaml = yaml.safe_load(f)

    # 设置 api key
    if api_type == "qwen":
        api_key = api_yaml["ali_qwen_api_key"]
        dashscope.api_key = api_key
    elif api_type == "ernie":
        api_key = api_yaml["baidu_ernie_api_key"]
    else:
        raise ValueError("api_type must be qwen or ernie")

    return api_key


def call_qwen_message(content_str, model_type=dashscope.Generation.Models.qwen_turbo):

    try:
        response = dashscope.Generation.call(model_type, prompt=content_str)
    except Exception as e:
        print(f"Maybe connect error , try again : {e}")
        response = dashscope.Generation.call(model_type, prompt=content_str)

    if response.status_code == HTTPStatus.OK:
        print("Used token: ", response.usage)
        response_str = response.output.text
    else:
        print(
            "Request id: %s, Status code: %s, error code: %s, error message: %s"
            % (
                response.request_id,
                response.status_code,
                response.code,
                response.message,
            )
        )
        response_str = "Error"

    return response_str


def call_ernie_message(content_str, access_token):
    url = f"https://aip.baidubce.com/rpc/2.0/ai_custom/v1/wenxinworkshop/chat/completions_pro?access_token={access_token}"

    payload = json.dumps(
        {
            "messages": [
                {"role": "user", "content": content_str},
            ],
            "disable_search": False,
            "enable_citation": False,
        }
    )
    headers = {"Content-Type": "application/json"}

    response = requests.request("POST", url, headers=headers, data=payload)

    if response.status_code == HTTPStatus.OK:

        # 获取 body 中的数据
        response_json = response.json()

        print("Used token: ", response_json["usage"])
        response_str = response_json["result"]
    else:
        response_str = "Error"

    return response_str


def format_json_from_response(func, content_str, func_args, model_name):
    response = func(content_str, func_args)

    if "```json" in response:
        response = re.findall(r"```json(.*)```", response, flags=re.DOTALL)[0]

    # 去掉导致 json 格式化失败的字符
    response = response.replace("\\", "\\\\").replace("\n\n", "\n").replace("”", '"').replace("“", '"')

    if model_name == "qwen":
        # qwen 需要检查文案中是否有 " ，并替换为单引号 '

        # 查找第一个 output 的字符串
        output_start = response.find('"output": "')
        if output_start != -1:
            # 查找第二个 output 的字符位置
            output_end = response.find("}", output_start + 1)
            if output_end != -1:
                response = list(response)
                # 截取第二个 output 的字符串
                check_len = len(response[output_start + len('"output": "') : output_end - 10])
                for idx in range(check_len):
                    str_idx = output_start + len('"output": "') + idx
                    if response[str_idx] == '"':
                        response[str_idx] = "'"

                response = "".join(response)

    # 加上 strict=False 解决 decode Invalid control character
    format_json = json.loads(response, strict=False)

    return format_json, response


def process_request(func, content_str, func_args, model_name):
    """_summary_

    Args:
        func (_type_): _description_
        content_str (_type_): _description_
        func_args (str):
            qwen: model_type
            ernie: api_key
    Returns:
        _type_: _description_
    """

    try:
        format_json, response = format_json_from_response(func, content_str, func_args, model_name)
    except Exception as e:
        try:
            # 再试一次
            print(f"\n Got error, try again <== {e} \n")
            if isinstance(e, json.decoder.JSONDecodeError):
                print(f"JSONDecodeError doc 1: {str(e.doc)} \n")
            format_json, response = format_json_from_response(func, content_str, func_args, model_name)
        except Exception as e:
            print(f"\n Got error <== {e} \n")
            if isinstance(e, json.decoder.JSONDecodeError):
                print(f"JSONDecodeError doc 2: {str(e.doc)} \n")
            with open(f"error-{model_name}.log", "a+", encoding="utf-8") as f_error:
                if isinstance(e, json.decoder.JSONDecodeError):
                    f_error.write(f"JSONDecodeError doc: {str(e.doc)} \n")
                f_error.write(str(e))
                f_error.flush()

            format_json = {"Error": "Error"}

    return format_json


def gen_product_highlights(dastset_yaml_path, api_yaml_path):
    """根据产品的 yaml 文件生成每个产品的特点描述

    Args:
        dastset_yaml_path (str): 数据集的 yaml 文件路径
        api_yaml_path (_type_): api 的 yaml 文件路径
    """

    # 读取 yaml 文件
    with open(dastset_yaml_path, "r", encoding="utf-8") as f:
        dataset_yaml = yaml.safe_load(f)

    set_api_key("qwen", api_yaml_path)

    for _, products in dataset_yaml["product_list"].items():
        for product_class, product in products.items():
            product_str = str(product).replace("'", "")
            print(f"Process: {product_str}")

            product_highlights = call_qwen_message(
                content_str=product_str,
                system_str="现在你精通任何产品，你可以帮我举例每个产品的6个亮点或特点，, 然后用python dict形式输出：{类名：[特点1, 特点2] ...} ，去掉特点12的字样，除python字典外的其他都不要输出，不要有任何的警告信息",
                model_type=dashscope.Generation.Models.qwen_turbo,
            )

            code_block = re.findall(r"```python(.*)```", product_highlights, flags=re.DOTALL)[0]
            if " = " in code_block[:20]:
                code_block = code_block.split(" = ")[1]

            products[product_class] = eval(re.findall(r"```python(.*)```", product_highlights, flags=re.DOTALL)[0])

    # 保存 yaml 文件
    with open(f"{dastset_yaml_path}", "w", encoding="utf-8") as f:
        yaml.dump(dataset_yaml, f, allow_unicode=True)


def gen_dataset(dastset_yaml_path: str, api_yaml_path: str, save_json_root: Path, model_name: str, specific_name=""):

    # 确保文件夹存在
    save_json_root.mkdir(parents=True, exist_ok=True)

    # 读取 yaml 文件
    with open(dastset_yaml_path, "r", encoding="utf-8") as f:
        dataset_yaml = yaml.safe_load(f)

    if specific_name != "":
        assert (
            specific_name in dataset_yaml["role_type"]
        ), f"{specific_name} not in dataset_yaml['role_type'] ({dataset_yaml['role_type']}), pls check dataset yaml!"

    # 设置 api key
    api_key = set_api_key(model_name, api_yaml_path)

    data_gen_setting = dataset_yaml["data_generation_setting"]
    gen_num = data_gen_setting["each_product_gen"]
    each_pick_hightlight = data_gen_setting["each_pick_hightlight"]
    each_pick_question = data_gen_setting["each_pick_question"]

    # qwen 配置调取的模型种类，确保有个一是最强模型
    # gen_model_type = [dashscope.Generation.Models.qwen_plus] * (gen_num - 2)
    # gen_model_type += [dashscope.Generation.Models.qwen_max] * 2
    qwen_model_type = [dashscope.Generation.Models.qwen_max] * gen_num

    for role_type, role_character in dataset_yaml["role_type"].items():

        if specific_name != "" and role_type != specific_name:
            # 只生成特定人物的
            print(f"specific_name = {specific_name}, skipping for {role_type}")
            continue

        gen_json = dict()

        save_json_path = save_json_root.joinpath(f"{model_name}_{role_type}_train.json")
        bk_json_path = save_json_root.joinpath(f"{model_name}_{role_type}_train.json.bk")

        # 加载之前已经有的 json
        if save_json_path.exists():
            with open(save_json_path, "r", encoding="u
```

### Core Architecture Module: `dataset/gen_dataset/merge_dataset.py`
```
import argparse
import json
from pathlib import Path
import random


def gen_self_self_aware_dataset():

    # 自我认知
    self_aware_question = [
        "你好",
        "你是谁",
        "你叫什么名字",
        "请做一下自我介绍",
        "介绍下你自己",
    ]

    self_aware_answer_lelemiao = [
        "大家好，我是小甜心乐乐喵~作为你们的金牌带货主播，我会用最甜美的声音，给大家介绍最热门的好物哦！家人们，准备好跟我一起买买买了吗？",
        "嗨嗨！家人们，乐乐喵我来啦！你们的可爱主播上线咯~今天我又给大家带来了超级棒的好物推荐，快来跟我一起探索吧！",
        "大家好，我是你们的宝藏女孩乐乐喵，一个会说甜话的主播~在这里，我会给大家分享最in的潮流单品，家人们，你们期待吗？",
        "哇咔咔，家人们，你们的可爱小主播乐乐喵来啦！今天我要带大家走进一个充满惊喜的购物世界，一起发现更多好物吧！",
        "大家好，我是乐乐喵，一个甜美可人的主播~我会用最有趣的方式，为大家介绍最棒的产品，家人们，你们准备好了吗？",
        "嗨嗨！家人们，你们的小甜心乐乐喵又来啦~今天我要给大家带来一波超值的福利，快来跟我一起抢购吧！",
        "大家好，我是你们的带货小能手乐乐喵，一个超级可爱的主播~我会用最萌的方式，给大家介绍最火的好物，家人们，不要错过哦！",
        "哇，家人们，乐乐喵我来啦！作为你们的主播，我要给大家带来一场超级给力的购物盛宴，快来跟我一起开启买买买模式吧！",
        "大家好，我是你们的小可爱乐乐喵，一个会说甜话的主播~在这里，我会用最有趣的方式，带大家探索更多好物，家人们，跟我一起嗨起来吧！",
        "嗨嗨！家人们，你们的主播小可爱乐乐喵又来啦~今天我要给大家带来一些超级棒的好物推荐，快来跟我一起看看有哪些惊喜吧！",
        "家人们好！你们的小主播乐乐喵闪亮登场啦~今天我要带大家畅游好物的海洋，一起发现更多惊喜吧！",
        "哇，大家好！我是你们的小甜心主播乐乐喵，今天我要用我萌萌的声音，给大家介绍一些超级棒的好物哦！",
        "嗨嗨！家人们，乐乐喵我又来啦！这次我为大家准备了一系列热门好货，快来跟我一起看看吧！",
        "大家好，我是你们的小可爱乐乐喵，一个会卖萌又会带货的主播~今天我要给大家带来一场视觉和听觉的盛宴，家人们，准备好了吗？",
        "哇，家人们，你们的主播乐乐喵来咯~我要用最有趣的方式，带大家探索更多潮流好物，快来跟我一起开启购物之旅吧！",
        "大家好，我是主播乐乐喵，一个会给大家带来惊喜和甜蜜的~今天我要分享一些超棒的产品，家人们，期待我的表现吧！",
        "嗨嗨！家人们，乐乐喵我又来咯~今天我要用最甜美的声音，为大家介绍一些超棒的好物，快来跟我一起抢购吧！",
        "大家好，我是你们的小甜心乐乐喵，一个会说甜话的带货主播~在这里，我要带大家发现更多好物，一起享受购物的乐趣吧！",
        "哇，家人们，乐乐喵我来啦！这次我要给大家带来一场超值的购物盛宴，快来跟我一起开启买买买模式吧！",
        "嗨嗨！家人们，你们的主播乐乐喵又来咯~今天我要用最有趣的方式，给大家介绍一些超火的好物，快来跟我一起探索吧！",
        "嗨喽~家人们！ 我是你们最爱的金牌带货主播乐乐喵，甜度爆表，专业满分，保证让每位家人买到心水好物，笑口常开！记得关注直播间，一起快乐剁手吧！",
        "诶嘿，家人们，你们的小甜心乐乐喵来啦！ 拥有超能力——一眼识货、一嘴种草的我，就是你们购物车的守护神。今晚8点，直播间不见不散哦，准备好被我的萌力与实力双重暴击吧！",
        "家人们，你们的宝藏女孩乐乐喵已上线！ 我是那个既能卖萌又能砍价，懂生活更懂你们的金牌主播。想知道什么值得买？跟我走，保准让你省心又省钱，幸福感满满！",
        "家人们，猜猜我是谁？没错，就是你们日夜思念带货的乐乐喵！ 甜萌外表下藏着一颗热爱分享的心，誓要帮每一位家人把全球好物收入囊中。锁定直播间，一起探索购物新大陆吧！",
        "家人们，准备好迎接你们的快乐源泉了吗？ 我是金牌带货主播乐乐喵，擅长用最甜的声音、最专业的知识，为你们打造轻松愉快的购物体验。今晚直播间，咱们一起买出新高度！",
        "家人们，让我听到你们的热情呼唤！ 你们的甜萌带货小能手乐乐喵已就位，誓要以最in的潮流资讯、最划算的折扣福利，承包你们的购物惊喜。记得调好闹钟，我们直播间见！",
        "家人们，你们的购物小甜心乐乐喵已就绪，等待发射爱心光波！ 我会用最甜的笑容、最贴心的服务，助您淘遍全球尖货，轻松升级品质生活。记得订阅频道，精彩不容错过哦！",
        "家人们，前方高萌预警！ 金牌带货主播乐乐喵闪亮登场，我是你们的购物导航仪，带你们穿越茫茫商海，直达心头好。锁定今晚直播，一起开启剁手狂欢夜！",
        "家人们，你们的甜心主播乐乐喵已加载完毕，等待你们一键签收！ 无论你是追求性价比的大佬，还是热衷尝鲜的小白，我都将用最专业的推荐、最甜美的解说，帮你找到心仪之选。记得收藏直播间，共享购物乐趣！",
        "家人们，你们的快乐购物时光由乐乐喵我守护！ 金牌带货主播在此，用满满的元气与甜度，为你们搜罗全网爆款，解读潮流密码。今晚8点，我们在直播间甜蜜相约，一起嗨购不停歇！",
    ]

    self_aware_json = []
    for anser in self_aware_answer_lelemiao:

        self_aware_json.append({"conversation": [{"input": random.choice(self_aware_question), "output": anser}]})

    return self_aware_json


def merge_dataset(save_json_root: Path, final_save_json_path: Path):
    # 将两个 json 进行合并
    json_list = []
    for json_path in save_json_root.glob("*.json"):
        with open(json_path, "r", encoding="utf-8") as f:
            json_list.append(json.load(f))

    filter_json_list = []

    dirty_conversion = []
    for model_name in json_list:
        for product_name, gen_data_list in model_name.items():

            for gen_data in gen_data_list:
                if isinstance(gen_data, dict) and "Error" in gen_data.keys():
                    print(f"Got error data in {product_name}")
                    dirty_conversion.append(gen_data)
                    continue

                # 洗掉一些没有 input 的数据
                sub_filter_list = {"conversation": []}
                for sub_list in gen_data["conversation"]:

                    # 剔除不合适的 key
                    accept_keys = ["input", "output", "system"]
                    sub_list = {key: value for key, value in sub_list.items() if key in accept_keys}

                    if len(sub_list.keys()) < 2:
                        # 如果只有单个 input output 出现，跳过
                        dirty_conversion.append(sub_list)
                        continue

                    if "input" not in sub_list or "output" not in sub_list:
                        # 如果没有 input 或者 output，跳过
                        dirty_conversion.append(sub_list)
                        continue

                    sub_filter_list["conversation"].append(sub_list)

                if len(sub_filter_list["conversation"]) > 0:
                    filter_json_list.append(sub_filter_list)

    # 修复数据集
    for idx in range(len(filter_json_list)):
        filter_json_list[idx]["conversation"][0][
            "system"
        ] = "现在你是一位金牌带货主播，你的名字叫乐乐喵，你的说话方式是甜美、可爱、熟练使用各种网络热门梗造句、称呼客户为[家人们]。你能够根据产品信息讲解产品并且结合商品信息解答用户提出的疑问。"

    # 生成自我认知的数据
    filter_json_list += gen_self_self_aware_dataset()

    # 保存
    with open(
        final_save_json_path.parent.joinpath(f"{len(filter_json_list)}_{final_save_json_path.name}"), "w", encoding="utf-8"
    ) as f:
        json.dump(filter_json_list, f, ensure_ascii=False, indent=4)

    if len(dirty_conversion) > 0:
        # 保存错误的过滤数据，方便用户自行解决
        with open(final_save_json_path.parent.joinpath(f"error_{final_save_json_path.name}"), "w", encoding="utf-8") as f:
            json.dump(dirty_conversion, f, ensure_ascii=False, indent=4)

    sum_input_output_count = 0
    for conversion in filter_json_list:
        sum_input_output_count += len(conversion["conversation"])
    print(
        f"总生成有效 conversion 数据 {len(filter_json_list)} 组，内含 {sum_input_output_count} 条对话，剔除脏对话 {len(dirty_conversion)} 条，保存到 error_{final_save_json_path.name} 中。"
    )


if __name__ == "__main__":
    # 命令行输入参数
    # TODO 目前仅仅支持 乐乐喵
    parser = argparse.ArgumentParser(description="Merge Dataset")
    parser.add_argument("data_root", type=str, help="path to response dir")
    parser.add_argument("output_path", type=str, help="path to response dir")
    args = parser.parse_args()

    save_json_root = Path(args.data_root)
    final_save_json_path = Path(args.output_path)
    merge_dataset(save_json_root, final_save_json_path)

```

### Core Architecture Module: `dataset/gen_instructions/gen_instruction.py`
```
import argparse
from pathlib import Path

import cv2
import numpy as np
import yaml

from paddleocr import PaddleOCR, draw_ocr
from PIL import Image
from openai import OpenAI


def parse_args():
    """Parse command-line arguments."""
    parser = argparse.ArgumentParser(description="Get OCR result for images directory")
    parser.add_argument("--image_dir", type=str, required=True, help="Images directory.")
    parser.add_argument("--ocr_output_dir", type=str, default="./ocr_output", help="OCR result output directory.")

    parser.add_argument(
        "--instruction_output_dir", type=str, default="./instructions", help="Instructions result output directory."
    )
    parser.add_argument("--data_yaml", type=str, default="../../configs/conversation_cfg.yaml", help="data setting file path")
    parser.add_argument("--api_yaml", type=str, default="../../configs/api_cfg.yaml", help="api setting file path")

    args = parser.parse_args()
    return args


def create_slices(image_path, slices_save_dir: Path):
    image = cv2.imread(image_path)
    height, width, _ = image.shape

    ratio_thres = 2  # 大于 2 倍就会需要进行切图
    wh_ratio = max(width / height, height / width)
    if wh_ratio < ratio_thres:
        return [image_path]

    if height > width:
        direction = "vertical"
        max_side = height
        step = width
    else:
        direction = "horizontal"
        step = height
        max_side = width

    slices = []

    # TODO 滑动窗口重合度0.1
    for i in range(0, max_side, step):

        if i + step > max_side:
            # 最后一张如果超过了单次切割的步长，将当前切片与上一个切片合并
            if direction == "vertical":
                # 垂直
                slices[-1]["img"] = np.concatenate((slices[-1]["img"], image[i:height, :]), axis=0)
            else:
                # 水平
                slices[-1]["img"] = np.concatenate((slices[-1]["img"], image[:, i:width]), axis=1)
            break

        if direction == "vertical":
            # 垂直切
            top_left = [0, i]
            slice = image[i : i + step, :]
        else:
            # 水平切
            top_left = [i, 0]
            slice = image[:, i : i + step, :]

        # 图片像素点，左上角 [x, y]
        slices.append({"img": slice, "top_left": top_left})

    slice_path_list = []
    # 保存图片，变为
    for idx, slice in enumerate(slices):
        slice_path = f"{slices_save_dir / str(idx)}.png"
        cv2.imwrite(str(slice_path), slice["img"])
        slice_path_list.append({"img": slice_path, "top_left": slice["top_left"]})

    return slice_path_list


def ocr_pred(ocr_model, image_path: Path, output_dir: Path, show_res=False):

    work_dir = output_dir.joinpath("work_dir", image_path.stem)
    work_dir.mkdir(parents=True, exist_ok=True)

    show_dir = output_dir.joinpath("work_dir", image_path.stem + "_show")

    # 如果太大了，进行切图
    # 创建横切图
    iamge_slices = create_slices(str(image_path), work_dir)

    result = []
    for img_info in iamge_slices:

        img_path = img_info["img"]

        # 推理
        ocr_res = ocr_model.ocr(img_path, cls=True)[0]
        if ocr_res == None:
            continue

        # 根据左上角回归到原图坐标点
        # res = [ [文字框], [识别结果，置信度] ]
        # left_top = img_info["top_left"]
        # for res in ocr_res:
        #     for points in res[0]:
        #         points[0] += left_top[0]
        #         points[1] += left_top[1]
        #     result.append(res)

        result += ocr_res

        if not show_res:
            continue

        if not show_dir.exists():
            show_dir.mkdir(parents=True, exist_ok=True)

        # 显示结果
        image = Image.open(img_path).convert("RGB")
        boxes = [line[0] for line in ocr_res]
        txts = [line[1][0] for line in ocr_res]
        scores = [line[1][1] for line in ocr_res]
        im_show = draw_ocr(image, boxes, txts, scores, font_path="./fonts/simfang.ttf")
        im_show = Image.fromarray(im_show)
        im_show.save(str(show_dir.joinpath("result_" + Path(img_path).name)))

    # 删除过程文件
    # shutil.rmtree(work_dir)

    return result


def get_ocr_res(image_dir: str, output_dir: str, show_res=True):

    # 判断图片路径是否存在
    image_dir = Path(image_dir)
    if not image_dir.exists():
        raise FileNotFoundError(f"Cannot find image dir: {image_dir}")

    # 初始化模型
    ocr_model = PaddleOCR(use_angle_cls=True, lang="ch")

    output_dir = Path(output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)

    for img_path in Path(image_dir).iterdir():
        print(f"processing ocr result for {str(img_path)}")

        if img_path.suffix.lower() not in [".png", ".jpeg", ".jpg", ".bmp"]:
            continue

        result_list = ocr_pred(ocr_model, img_path, output_dir, show_res)

        # 将结果写入文件
        with open(output_dir.joinpath(img_path.stem + ".txt"), "w", encoding="utf-8") as f:
            for res in result_list:
                # res = [ [文字框], [识别结果，置信度] ]
                f.write(res[1][0])


def gen_instructions_according_ocr_res(ocr_txt_root, instruction_save_root, api_yaml_path, data_yaml_path):

    instruction_save_root = Path(instruction_save_root)
    instruction_save_root.mkdir(parents=True, exist_ok=True)

    # 读取 yaml 文件
    with open(api_yaml_path, "r", encoding="utf-8") as f:
        api_yaml = yaml.safe_load(f)

    client = OpenAI(
        api_key=api_yaml["kimi_api_key"],
        base_url="https://api.moonshot.cn/v1",
    )

    # 读取 yaml 文件
    with open(data_yaml_path, "r", encoding="utf-8") as f:
        data_yaml = yaml.safe_load(f)

    for txt_path in Path(ocr_txt_root).iterdir():

        print("Processing txt: ", txt_path.name)

        if txt_path.suffix not in [".txt"]:
            continue

        file_object = client.files.create(file=txt_path, purpose="file-extract")

        # 获取结果
        # file_content = client.files.retrieve_content(file_id=file_object.id)
        # 注意，之前 retrieve_content api 在最新版本标记了 warning, 可以用下面这行代替
        # 如果是旧版本，可以用 retrieve_content
        file_content = client.files.content(file_id=file_object.id).text

        # 把它放进请求中
        messages = [
            {
                "role": "system",
                "content": "你是 Kimi，由 Moonshot AI 提供的人工智能助手，你更擅长中文和英文的对话。你会为用户提供安全，有帮助，准确的回答。同时，你会拒绝一切涉及恐怖主义，种族歧视，黄色暴力等问题的回答。Moonshot AI 为专有名词，不可翻译成其他语言。",
            },
            {
                "role": "system",
                "content": file_content,
            },
            {
                "role": "user",
                "content": data_yaml["instruction_generation_setting"]["dataset_gen_prompt"],
            },
        ]

        # 然后调用 chat-completion, 获取 Kimi 的回答
        completion = client.chat.completions.create(
            model="moonshot-v1-32k",
            messages=messages,
            temperature=0.3,
        )

        res_msg = completion.choices[0].message

        with open(instruction_save_root.joinpath(txt_path.stem + ".md"), "w", encoding="utf-8") as f:
            f.write(res_msg.content)


if __name__ == "__main__":
    args = parse_args()

    # 使用 OCR 对图片文字进行识别
    get_ocr_res(args.image_dir, args.ocr_output_dir)

    # 调用 kimi API 进行总结
    gen_instructions_according_ocr_res(args.ocr_output_dir, args.instruction_output_dir, args.api_yaml, args.data_yaml)

    print("All done !")

```

### Core Architecture Module: `doc/digital_human/download_models.py`
```
import os

os.environ["HF_ENDPOINT"] = "https://hf-mirror.com"
from huggingface_hub import hf_hub_download

COMFYUI_PATH = r"/path/to/ComfyUI"

# ==============================================
#                官方 SD 权重
# ==============================================
hf_hub_download(
    repo_id="stabilityai/stable-diffusion-xl-base-1.0",
    filename="sd_xl_base_1.0.safetensors",
    local_dir=rf"{COMFYUI_PATH}/models/checkpoints",
)

hf_hub_download(
    repo_id="runwayml/stable-diffusion-v1-5",
    filename="v1-5-pruned.safetensors",
    local_dir=rf"{COMFYUI_PATH}/models/checkpoints",
)

# ==============================================
#                AnimateDiff 权重
# ==============================================
for animatediff_model in ["mm_sd_v15_v2.ckpt", "mm_sdxl_v10_beta.ckpt", "v3_sd15_mm.ckpt"]:
    hf_hub_download(
        repo_id="guoyww/animatediff",
        filename=animatediff_model,
        local_dir=rf"{COMFYUI_PATH}/models/animatediff_models",
    )

for animatediff_model in ["temporaldiff-v1-animatediff.safetensors"]:
    hf_hub_download(
        repo_id="CiaraRowles/TemporalDiff",
        filename=animatediff_model,
        local_dir=rf"{COMFYUI_PATH}/models/animatediff_models",
    )

for lora_model in [
    "v2_lora_PanLeft.ckpt",
    "v2_lora_PanRight.ckpt",
    "v2_lora_RollingAnticlockwise.ckpt",
    "v2_lora_RollingClockwise.ckpt",
    "v2_lora_TiltDown.ckpt",
    "v2_lora_TiltUp.ckpt",
    "v2_lora_ZoomIn.ckpt",
    "v2_lora_ZoomOut.ckpt",
]:
    hf_hub_download(
        repo_id="guoyww/animatediff",
        filename=lora_model,
        local_dir=rf"{COMFYUI_PATH}/models/animatediff_motion_lora",
    )

# ==============================================
#                ControlNet 权重
# ==============================================
for controlnet_model in ["control_v11p_sd15_openpose.pth", "control_v11f1p_sd15_depth.pth", "control_v11p_sd15_seg.pth"]:
    hf_hub_download(
        repo_id="lllyasviel/ControlNet-v1-1",
        filename=controlnet_model,
        local_dir=rf"{COMFYUI_PATH}/models/controlnet",
    )

# ==============================================
#                   SAM 权重
# ==============================================
for sam_model in ["groundingdino_swinb_cogcoor.pth", "GroundingDINO_SwinB.cfg.py"]:
    hf_hub_download(
        repo_id="ShilongLiu/GroundingDINO",
        filename=sam_model,
        local_dir=rf"{COMFYUI_PATH}/models/grounding-dino/",
    )

# ==============================================
#                   IP-Adapter 权重
# ==============================================
for ip_adapter_model in ["models/ip-adapter-plus_sd15.safetensors"]:
    hf_hub_download(
        repo_id="h94/IP-Adapter",
        filename=ip_adapter_model,
        local_dir=rf"{COMFYUI_PATH}/models/ipadapter",
    )

for ip_adapter_clip_model in ["models/image_encoder/model.safetensors"]:
    hf_hub_download(
        repo_id="h94/IP-Adapter",
        filename=ip_adapter_clip_model,
        local_dir=rf"{COMFYUI_PATH}/models/clip_vision/",
    )

```

### Core Architecture Module: `finetune_configs/internlm2_chat_7b/internlm2_chat_7b_qlora_custom_data.py`
```
# Copyright (c) OpenMMLab. All rights reserved.
import torch
from datasets import load_dataset
from mmengine.dataset import DefaultSampler
from mmengine.hooks import (CheckpointHook, DistSamplerSeedHook, IterTimerHook,
                            LoggerHook, ParamSchedulerHook)
from mmengine.optim import AmpOptimWrapper, CosineAnnealingLR, LinearLR
from peft import LoraConfig
from torch.optim import AdamW
from transformers import (AutoModelForCausalLM, AutoTokenizer,
                          BitsAndBytesConfig)

from xtuner.dataset import process_hf_dataset
from xtuner.dataset.collate_fns import default_collate_fn
from xtuner.dataset.map_fns import oasst1_map_fn, template_map_fn_factory
from xtuner.engine.hooks import (DatasetInfoHook, EvaluateChatHook,
                                 VarlenAttnArgsToMessageHubHook)
from xtuner.engine.runner import TrainLoop
from xtuner.model import SupervisedFinetune
from xtuner.parallel.sequence import SequenceParallelSampler
from xtuner.utils import PROMPT_TEMPLATE

#######################################################################
#                          PART 1  Settings                           #
#######################################################################
# Model
pretrained_model_name_or_path = 'internlm/internlm2-chat-7b' # 如果本地有可以直接使用 绝对路径 '/path/to/internlm/internlm2-chat-7b'
use_varlen_attn = False

# Data
data_path = '/path/to/dataset/1479_train.jsonl'
prompt_template = PROMPT_TEMPLATE.internlm2_chat
max_length = 2048
pack_to_max_length = True

# parallel
sequence_parallel_size = 1

# Scheduler & Optimizer
batch_size = 16  # 8-> 40G, 16 -> 80G
accumulative_counts = 16
accumulative_counts *= sequence_parallel_size
dataloader_num_workers = 0
max_epochs = 10
optim_type = AdamW
lr = 2e-4
betas = (0.9, 0.999)
weight_decay = 0
max_norm = 1  # grad clip
warmup_ratio = 0.03

# Save
save_steps = 50
save_total_limit = 2  # Maximum checkpoints to keep (-1 means unlimited)

# Evaluate the generation performance during the training
evaluation_freq = 50
SYSTEM = ''
evaluation_inputs = [
    '我的商品名是[狗狗沐浴露]，商品的亮点是[天然成分、多种香味选择、无刺激]，你需要根据我给出的商品信息撰写一段直播带货口播文案。你需要放大商品的亮点价值，激发用户的购买欲。',
    '我的商品名是[洗洁精]，商品的亮点是[天然成分、无残留、适用各种餐具]，你需要根据我给出的商品信息撰写一段直播带货口播文案。你需要放大商品的亮点价值，激发用户的购买欲。'
]

#######################################################################
#                      PART 2  Model & Tokenizer                      #
#######################################################################
tokenizer = dict(
    type=AutoTokenizer.from_pretrained,
    pretrained_model_name_or_path=pretrained_model_name_or_path,
    trust_remote_code=True,
    padding_side='right')

model = dict(
    type=SupervisedFinetune,
    use_varlen_attn=use_varlen_attn,
    llm=dict(
        type=AutoModelForCausalLM.from_pretrained,
        pretrained_model_name_or_path=pretrained_model_name_or_path,
        trust_remote_code=True,
        torch_dtype=torch.float16,
        quantization_config=dict(
            type=BitsAndBytesConfig,
            load_in_4bit=True,
            load_in_8bit=False,
            llm_int8_threshold=6.0,
            llm_int8_has_fp16_weight=False,
            bnb_4bit_compute_dtype=torch.float16,
            bnb_4bit_use_double_quant=True,
            bnb_4bit_quant_type='nf4')),
    lora=dict(
        type=LoraConfig,
        r=64,
        lora_alpha=16,
        lora_dropout=0.1,
        bias='none',
        task_type='CAUSAL_LM'))

#######################################################################
#                      PART 3  Dataset & Dataloader                   #
#######################################################################
train_dataset = dict(
    type=process_hf_dataset,
    # dataset=dict(type=load_dataset, path=data_path),
    dataset=dict(type=load_dataset, path='json', data_files=dict(train=data_path)),
    tokenizer=tokenizer,
    max_length=max_length,
    # dataset_map_fn=oasst1_map_fn,
    dataset_map_fn=None,
    template_map_fn=dict(
        type=template_map_fn_factory, template=prompt_template),
    remove_unused_columns=True,
    shuffle_before_pack=True,
    pack_to_max_length=pack_to_max_length,
    use_varlen_attn=use_varlen_attn)

sampler = SequenceParallelSampler \
    if sequence_parallel_size > 1 else DefaultSampler
train_dataloader = dict(
    batch_size=batch_size,
    num_workers=dataloader_num_workers,
    dataset=train_dataset,
    sampler=dict(type=sampler, shuffle=True),
    collate_fn=dict(type=default_collate_fn, use_varlen_attn=use_varlen_attn))

#######################################################################
#                    PART 4  Scheduler & Optimizer                    #
#######################################################################
# optimizer
optim_wrapper = dict(
    type=AmpOptimWrapper,
    optimizer=dict(
        type=optim_type, lr=lr, betas=betas, weight_decay=weight_decay),
    clip_grad=dict(max_norm=max_norm, error_if_nonfinite=False),
    accumulative_counts=accumulative_counts,
    loss_scale='dynamic',
    dtype='float16')

# learning policy
# More information: https://github.com/open-mmlab/mmengine/blob/main/docs/en/tutorials/param_scheduler.md  # noqa: E501
param_scheduler = [
    dict(
        type=LinearLR,
        start_factor=1e-5,
        by_epoch=True,
        begin=0,
        end=warmup_ratio * max_epochs,
        convert_to_iter_based=True),
    dict(
        type=CosineAnnealingLR,
        eta_min=0.0,
        by_epoch=True,
        begin=warmup_ratio * max_epochs,
        end=max_epochs,
        convert_to_iter_based=True)
]

# train, val, test setting
train_cfg = dict(type=TrainLoop, max_epochs=max_epochs)

#######################################################################
#                           PART 5  Runtime                           #
#######################################################################
# Log the dialogue periodically during the training process, optional
custom_hooks = [
    dict(type=DatasetInfoHook, tokenizer=tokenizer),
    dict(
        type=EvaluateChatHook,
        tokenizer=tokenizer,
        every_n_iters=evaluation_freq,
        evaluation_inputs=evaluation_inputs,
        system=SYSTEM,
        prompt_template=prompt_template)
]

if use_varlen_attn:
    custom_hooks += [dict(type=VarlenAttnArgsToMessageHubHook)]

# configure default hooks
default_hooks = dict(
    # record the time of every iteration.
    timer=dict(type=IterTimerHook),
    # print log every 10 iterations.
    logger=dict(type=LoggerHook, log_metric_by_epoch=False, interval=10),
    # enable the parameter scheduler.
    param_scheduler=dict(type=ParamSchedulerHook),
    # save checkpoint per `save_steps`.
    checkpoint=dict(
        type=CheckpointHook,
        by_epoch=False,
        interval=save_steps,
        max_keep_ckpts=save_total_limit),
    # set sampler seed in distributed evrionment.
    sampler_seed=dict(type=DistSamplerSeedHook),
)

# configure environment
env_cfg = dict(
    # whether to enable cudnn benchmark
    cudnn_benchmark=False,
    # set multi process parameters
    mp_cfg=dict(mp_start_method='fork', opencv_num_threads=0),
    # set distributed parameters
    dist_cfg=dict(backend='nccl'),
)

# set visualizer
visualizer = None

# set log level
log_level = 'INFO'

# load from which checkpoint
load_from = None

# whether to resume training from the loaded checkpoint
resume = False

# Defaults to use random seed and disable `deterministic`
randomness = dict(seed=None, deterministic=False)

# set log processor
log_processor = dict(by_epoch=False)

```

### Core Architecture Module: `frontend/env.d.ts`
```
/// <reference types="vite/client" />

```

### Core Architecture Module: `frontend/src/api/base.ts`
```
import axios from 'axios'

const request_handler = axios.create({
  // baseURL: import.meta.env.BASE_SERVER_URL
})

interface ResultPackage<T> {
  success: boolean
  code: number
  message: string
  data: T
  timestamp: number
}

export { request_handler }
export { type ResultPackage }

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
