# Forensic Learning Record (Deep Inspection): SocialAI-tianji/Tianji

> **Canonical Artifact**: `07_PROJECT_LEARNING/socialai-tianji-tianji-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/SocialAI-tianji/Tianji](https://github.com/SocialAI-tianji/Tianji))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-09-30T21:15:24.061Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `SocialAI-tianji/Tianji`
- **Description**: 制作懂人情世故的大语言模型 | 涵盖提示词工程、RAG、Agent、LLM微调教程
- **Primary Language / Ecosystem**: Python
- **Discovered Manifests / Configurations**: README.md
- **Stars / Engagement**: 1827 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `.ci/Compare.py`
```
# This Python file uses the following encoding: utf-8
import os
import datetime
import sys

'''
# @author  : Shiqiding
# @description: 拿到最近的两个error_log,对比是否有差异，差异的部分即为增量，如果其中有不符合规则模板的，则打印出来(目前还是滞后判断)
# @version : V1.0
'''
def get_closest_files(directory):
    now = datetime.datetime.now()
    files = [f for f in os.listdir(directory) if f.endswith('.txt')]
    files.sort(key=lambda x: abs(now - datetime.datetime.strptime(x.split('.')[0], '%Y%m%d_%H%M%S')))
    return files[:2] if len(files) >= 2 else files

def read_file(directory, filename):
    with open(os.path.join(directory, filename), 'r', encoding='utf-8') as file:
        return file.readlines()


def compare_files(directory, file1, file2):
    content1 = read_file(directory, file1)
    content2 = read_file(directory, file2)

    # 比较文件的行数
    len1, len2 = len(content1), len(content2)
    if len1 > len2:
        # 如果第一个文件行数更多，打印多出的行
        return ''.join(content1[len2:])
    elif len2 > len1:
        # 如果第二个文件行数更多，打印多出的行
        return ''.join(content2[len1:])
    else:
        # 行数相同
        return "两个文件的行数相同，没有多余的行。"


directory = r'.ci'  # 替换为你的文件夹路径
closest_files = get_closest_files(directory)
if __name__ == '__main__':
    if len(closest_files) == 2:
        difference = compare_files(directory, closest_files[0], closest_files[1])

        # 检查difference中是否包含特定字样
        if "不符合规则模板" in difference:
            print(difference)
        else:
            print("比较结果中没有发现不符合规则模板的字样。")
    else:
        print("没有足够的文件进行比较。")




```

### Core Architecture Module: `.ci/check.py`
```
import re
import os
from datetime import datetime
import sys
import shutil
'''
# @author  : Shiqiding
# @description: 对prompt进行格式检查,可以将格式不对的.md文件输出带文件名为时间戳的.txt文件(作为日志),并打印出test/prompt目录下所有文件的情况
# @version : V1.0
'''
def validate_rule_template(md_file_path):
    try:
        with open(md_file_path, 'r', encoding='utf-8') as file:
            md_content = file.read()

        # 检查是否存在以## 开头后跟汉字的标题
        if not re.search(r'^\#\#\s+[\u4e00-\u9fff]+', md_content, re.MULTILINE):
            return False, "不存在以## 开头的汉字标题"

        # 检查是否存在Prompt部分
        if not re.search(r'^\#\#\#\s+Prompt', md_content, re.MULTILINE):
            return False, "Prompt部分未识别"

        # 检查效果示例部分
        effect_examples = re.findall(r'^\#\#\#\s+效果示例', md_content, re.MULTILINE)
        for example in effect_examples:
            example_index = md_content.find(example)
            next_example_index = md_content.find('### 效果示例', example_index + 1)
            if next_example_index == -1:
                next_example_index = len(md_content)
            example_content = md_content[example_index:next_example_index]

            # 检查 Q：和 A：
            if not re.search(r'####\s+Q[：:]', example_content, re.MULTILINE) or \
               not re.search(r'####\s+A[：:]', example_content, re.MULTILINE):
                return False, "效果示例部分的 Q：或 A：未识别"

        return True, "格式正确"

    except Exception as e:
        return False, str(e)


if __name__ == '__main__':
    folder_path = r"test/prompt"  # 替换为包含规则模板的文件夹路径
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    error_log_file = f"{timestamp}.txt"  # 为错误日志文件名加上时间戳

    log_folder = '.ci/log'  # 指定日志文件夹路径
    os.makedirs(log_folder, exist_ok=True)  # 创建日志文件夹，如果不存在的话

    log_file_path = os.path.join(log_folder, error_log_file)  # 构建日志文件的完整路径

    with open(log_file_path, 'w', encoding='utf-8') as log_file:
        for foldername, subfolders, filenames in os.walk(folder_path):
            for filename in filenames:
                if filename.endswith(".md") and filename != "README.md":
                    md_file_path = os.path.join(foldername, filename)
                    result, message = validate_rule_template(md_file_path)
                    if result:
                        print(f"{md_file_path}: {message}")
                    else:
                        log_file.write(f"{md_file_path} 不符合规则模板: {message}\n")
                        print(f"{md_file_path} 不符合规则模板: {message}")
                        sys.exit(1)

    # 使用 shutil.move 将日志文件移动到 .ci/log 文件夹下
    shutil.move(log_file_path, os.path.join('.ci/log', error_log_file))

    # 删除 .ci/log 下的空文件
    for file in os.listdir(log_folder):
        file_path = os.path.join(log_folder, file)
        if os.path.isfile(file_path) and os.path.getsize(file_path) == 0:
            os.remove(file_path)
            print(f"Deleted empty log file: {file}")


```

### Core Architecture Module: `.ci/gpt_prompt_stat.py`
```
import json
import matplotlib.pyplot as plt
import os
import shutil
'''
# @author  : Shiqiding
# @description: 统计gpt prompt
# @version : V1.0

'''
all_gpt_json_path = os.environ.get('all_gpt_json')
#all_gpt_json_path=r'C:\Users\yhd\PycharmProjects\TianjiOrignal\tianji\prompt\gpt_prompt\all_gpt_prompt.json'
# 打开 JSON 文本文件并加载数据
with open(all_gpt_json_path, 'r', encoding='utf-8') as file:
    data = json.load(file)

# 统计不同 ID 下的 JSON 个数
id_counts = {}
for item in data:
    id = item.get("id")
    if id in id_counts:
        id_counts[id] += 1
    else:
        id_counts[id] = 1

# 提取 ID 和对应的计数
ids = list(id_counts.keys())
counts = list(id_counts.values())

# 将 ID 转换为横坐标标签
labels = []
for id in ids:
    if id == 1:
        labels.append("Etiquette")
    elif id == 2:
        labels.append("Hospitality")
    elif id == 3:
        labels.append("Gifting")
    elif id == 4:
        labels.append("Wishes")
    elif id == 5:
        labels.append("Communication")
    elif id == 6:
        labels.append("Awkwardness")
    elif id == 7:
        labels.append("Conflict")
    else:
        labels.append(str(id))

# 将 ID 转换为整数索引
id_indices = list(range(len(ids)))


# 绘制柱状图
plt.bar(id_indices, counts)
plt.xlabel('Category')  # 修改横坐标标签
plt.ylabel('Number of valid prompts')

# 旋转横坐标标签，以避免重叠
plt.xticks(id_indices, labels, rotation=45, ha='right')

# 在每个柱状图上标识数字
for i, count in enumerate(counts):
    plt.text(id_indices[i], count, str(count), ha='center', va='bottom')

plt.title('gpt prompt statistics')

# 保存为 PNG 图片文件
plt.savefig('gpt_prompt_statistics.png', bbox_inches='tight')


shutil.move('gpt_prompt_statistics.png', '.ci/gpt_prompt_statistics.png')


# 显示图形
plt.show()

```

### Core Architecture Module: `.ci/prompt_to_json_for_CI.py`
```
# This Python file uses the following encoding: utf-8
import json
import re
import os
'''
# @author  : Shiqiding
# @description: 本脚本支持将批量将.md写的规定prompt格式转换为规定格式的json
# @version : V2.0

promptpath为.md格式的prompt路径，具体格式参考仓库里的prompt格式部分

输出的json例子如下：
[
    {
        "id": 4,
        "name": "对长辈",
        "test_system": "你现在是一个精通言语表达、热爱他人、尊重长辈、富有文采的中国晚辈，今天是一个节日，你要去面见亲朋好友，请针对不同对象、不同节日，不同场合，准备见面问好的话术表达节日的问候。下面我将给出节日和见面对象及场合的具体信息，请你根据这些信息，以我的角度准备问候语，字数30字以内。要求：简洁、简短、真诚、有趣、礼貌，尝试藏头诗、顺口溜等多种趣味形式，请加入俏皮话，有趣的内容来增加趣味性。信息为：对象：_____，对象特点：______，节日：_____，场合：_____。请写3条供我选择。\n用户输入\n对象：_____，对象特点：______，节日：_____，场合：_____。\n### 效果示例",
        "example": [
            {
                "input": "对象：英语老师，对象特点：活泼开朗，新潮，爱开玩笑，节日：教师节，场合：庆祝教师节联欢会。",
                "output": "亲爱的英语老师，教师节到了，感谢您的教诲，您的课堂永远充满活力和笑声！\n超酷英语老师，教师节快乐！您的课堂总是妙趣横生，让我们深受启发。\n敬爱的老师，教师节到了，感谢您不仅教英语，还教我们快乐和幽默。愿您天天开\n\n### 效果示例"
            },
            {
                "input": "对象：妈妈；对象特点：温柔体贴，热心肠；节日：母亲节，场合：母亲节当天。",
                "output": "亲爱的妈妈，母亲节快乐！您的温柔和热心让我们感受到无尽的爱和关怀。\n慈爱的妈妈，母亲节到啦！谢谢您一直以来的疼爱，您是我生命中最伟大的女神！\n亲爱的妈妈，母亲节当天，祝您幸福满满，像您一样温柔体贴的人，值得所有的爱和祝福。"
            }
        ]
    }
]

id： prompt所属大类
name:子标题
test_system:prompt内容
input:用户输入
output:对应输出

'''
folder_path = os.environ.get('folder_path')
#folder_path = r"C:\Users\yhd\PycharmProjects\Tianji\test\prompt\yiyan_prompt"  # 替换成您的文件夹路径
output_path=os.environ.get('output_path')

def md_file_to_json_with_examples(file_path,id,heading):
    """
    从给定的文件路径读取Markdown文件，并按指定格式将其内容转换为JSON格式。
    此版本处理同一提示中的多个Q&A对，并将它们分组到“example”下。

    参数：
    file_path（str）：Markdown文件的路径。

    返回：
    json_object（str）：JSON格式的字符串。
    """
    if(heading==""):
        with open(file_path, 'r', encoding='utf-8') as file:
            md_content = file.read()

        blocks = re.split(r'###\s+Prompt\s*[:：]?\s*\n', md_content, flags=re.IGNORECASE)

        blocks = blocks[1:]
        json_list = []

        for block in blocks:
            test_system_part = block.split('#### Q：')[0].strip()

            qa_pairs = re.findall(r'#### Q：(.*?)#### A：(.*?)(?=#### Q：|$)', block, re.DOTALL)
            if (qa_pairs == []):
                qa_pairs = re.findall(r'#### Q:(.*?)#### A:(.*?)(?=#### Q:|$)', block, re.DOTALL)

            examples = []
            for qa_pair in qa_pairs:
                input_text = qa_pair[0].strip()
                output_text = qa_pair[1].strip()

                example_obj = {
                    "id":id,
                    "name":"无标题",
                    "input": input_text,
                    "output": output_text
                }
                examples.append(example_obj)

            json_obj = {
                # "name":name,
                "test_system": test_system_part,
                "example": examples
            }
            json_list.append(json_obj)

        return json.dumps(json_list, indent=4, ensure_ascii=False)
    else:
        with open(file_path, 'r', encoding='utf-8') as file:
            md_content = file.read()

        pattern = rf'\n(?={re.escape(heading)} [^\#\n]+)'
        sections = re.split(pattern, md_content)

        json_list = []

        for section in sections:

            pattern = rf'{re.escape(heading)}\s*(.*?)\s*\n'
            title_match = re.match(pattern, section)
            section_title = title_match.group(1).strip() if title_match else "无标题"

            # 提取该部分的内容
            section_content = section[len(title_match.group(0)):] if title_match else section
            blocks = re.split(r'###\s+Prompt\s*[:：]?\s*\n', section_content,flags=re.IGNORECASE)

            blocks = blocks[1:]

            for block in blocks:

                test_system_part = block.split('#### Q：')[0].strip()
                test_system_part= re.sub(r'#.*', '', test_system_part)
                qa_pairs = re.findall(r'#### Q：(.*?)#### A：(.*?)(?=#### Q：|$)', block, re.DOTALL)
                if (qa_pairs == []):
                    qa_pairs = re.findall(r'#### Q:(.*?)#### A:(.*?)(?=#### Q:|$)', block, re.DOTALL)

                examples = []
                for qa_pair in qa_pairs:

                    input_text = qa_pair[0].strip()
                    input_text=re.sub(r'#.*', '', input_text)
                    output_text = qa_pair[1].strip()
                    output_text= re.sub(r'#.*', '', output_text)

                    example_obj = {
                        "input": input_text,
                        "output": output_text
                    }
                    examples.append(example_obj)

                json_obj = {
                    "id":id,
                    "name":section_title,
                    "system_prompt": test_system_part,
                    "example": examples
                }
                json_list.append(json_obj)

        return json.dumps(json_list, indent=4, ensure_ascii=False)


def replace_english_colons_with_chinese(md_file_path):

    try:

        with open(md_file_path, 'r', encoding='utf-8') as file:
            file_contents = file.read()


        file_contents = re.sub(r':', '：', file_contents)


        with open(md_file_path, 'w', encoding='utf-8') as file:
            file.write(file_contents)

    except Exception as e:
        print(f"发生错误：{str(e)}")
    return md_file_path

def find_first_heading(md_file_path):
    # 打开并读取Markdown文件
    with open(md_file_path, 'r', encoding='utf-8') as file:
        content = file.read()

    match = re.search(r'^\s*(#{1,2})(?!\#)\s', content, re.MULTILINE)

    if match:
        return '#' * len(match.group(1))
    else:
        return ""


if __name__ == '__main__':

    for foldername, subfolders, filenames in os.walk(folder_path):
        for filename in filenames:
            if filename.endswith(".md"):
                if filename == "README.md":
                    continue
                promptpath=os.path.join(foldername, filename)
                filepath =replace_english_colons_with_chinese(promptpath)
                print(filepath)
                heading = find_first_heading(filepath)
                print("此文档的heading使用的是 "+heading)
                filename=os.path.basename(filepath)
                id =int(filename[:2])
                print("处理文档为 " + filename+" 该文档属于第"+str(id)+"大类")
                json_output = md_file_to_json_with_examples(filepath,id=id,heading=heading)
                input_dir, input_file = os.path.split(promptpath)
                input_file_base, _ = os.path.splitext(input_file)

                #output_path = r"C:\Users\yhd\PycharmProjects\Tianji\tianji\prompt"

                # 使用正则表达式提取所需路径
                match = re.search(r'/prompt(.*)/[^/]+$', promptpath)
                if match:
                    # 提取的路径
                    extracted_path = match.group(1)
                    # 构造最终路径
                    json_file_output_path = output_path + extracted_path + "/"
                else:
                    json_file_output_path = "无法匹配路径"
                json_file_output = os.path.join(json_file_output_path, input_file_base + ".json")
                with open(json_file_output, 'w', encoding='utf-8') as file:
                    json.dump(json.loads(json_output), file, ensure_ascii=False, indent=4)
                print(json_output)
```

### Core Architecture Module: `.ci/validate_script.py`
```
import re
import sys
'''
# @author  : Shiqiding
# @description: 单个检查文件prompt是否符合格式，通过命令 python validate_script.py <md_file_path> 实现
# @version : V1.0
'''
def validate_rule_template(md_file_path):
    try:
        with open(md_file_path, 'r', encoding='utf-8') as file:
            md_content = file.read()

        # 检查是否存在以## 开头后跟汉字的标题
        if not re.search(r'^\#\#\s+[\u4e00-\u9fff]+', md_content, re.MULTILINE):
            return False, "不存在以## 开头的汉字标题"

        # 检查是否存在Prompt部分
        if not re.search(r'^\#\#\#\s+Prompt', md_content, re.MULTILINE):
            return False, "Prompt部分未识别"

        # 检查效果示例部分
        # 确保每个效果示例后面都有一个 Q：和一个 A：
        effect_examples = re.findall(r'^\#\#\#\s+效果示例', md_content, re.MULTILINE)
        for example in effect_examples:
            example_index = md_content.find(example)
            next_example_index = md_content.find('### 效果示例', example_index + 1)
            if next_example_index == -1:
                next_example_index = len(md_content)
            example_content = md_content[example_index:next_example_index]

            # 检查 Q：和 A：
            if not re.search(r'####\s+Q[：:]', example_content, re.MULTILINE) or \
               not re.search(r'####\s+A[：:]', example_content, re.MULTILINE):
                return False, "效果示例部分的 Q：或 A：未识别"

        return True, "格式正确"

    except Exception as e:
        return False, str(e)

if __name__ == '__main__':
    if len(sys.argv) != 2:
        print("Usage: python validate_script.py <md_file_path>")
        sys.exit(1)

    md_file_path = sys.argv[1]
    result, message = validate_rule_template(md_file_path)
    if result:
        print(f"{md_file_path}: {message}")
    else:
        print(f"{md_file_path} 不符合规则模板: {message}")

```

### Core Architecture Module: `.ci/yiyan_prompt_stat.py`
```
import json
import matplotlib.pyplot as plt
import os
import shutil
'''
# @author  : Shiqiding
# @description: 统计yiyan prompt
# @version : V1.0

'''
all_yiyan_json_path = os.environ.get('all_yiyan_json')
#all_yiyan_json_path=r'C:\Users\yhd\PycharmProjects\TianjiOrignal\tianji\prompt\yiyan_prompt\all_yiyan_prompt.json'
# 打开 JSON 文本文件并加载数据
with open(all_yiyan_json_path, 'r', encoding='utf-8') as file:
    data = json.load(file)

# 统计不同 ID 下的 JSON 个数
id_counts = {}
for item in data:
    id = item.get("id")
    if id in id_counts:
        id_counts[id] += 1
    else:
        id_counts[id] = 1

# 提取 ID 和对应的计数
ids = list(id_counts.keys())
counts = list(id_counts.values())

# 将 ID 转换为横坐标标签
labels = []
for id in ids:
    if id == 1:
        labels.append("Etiquette")
    elif id == 2:
        labels.append("Hospitality")
    elif id == 3:
        labels.append("Gifting")
    elif id == 4:
        labels.append("Wishes")
    elif id == 5:
        labels.append("Communication")
    elif id == 6:
        labels.append("Awkwardness")
    elif id == 7:
        labels.append("Conflict")
    else:
        labels.append(str(id))

# 将 ID 转换为整数索引
id_indices = list(range(len(ids)))



# 绘制柱状图
plt.bar(id_indices, counts)
plt.xlabel('Category')  # 修改横坐标标签
plt.ylabel('Number of valid prompts')

# 旋转横坐标标签，以避免重叠
plt.xticks(id_indices, labels, rotation=45, ha='right')

# 在每个柱状图上标识数字
for i, count in enumerate(counts):
    plt.text(id_indices[i], count, str(count), ha='center', va='bottom')

plt.title('yiyan prompt statistics')

# 保存为 PNG 图片文件
plt.savefig('yiyan_prompt_statistics.png', bbox_inches='tight')

shutil.move('yiyan_prompt_statistics.png', '.ci/yiyan_prompt_statistics.png')

# 显示图形
plt.show()
```

### Core Architecture Module: `run/demo_agent_metagpt.py`
```
from dotenv import load_dotenv
load_dotenv()

import asyncio
import streamlit as st
import uuid
from streamlit_chat import message
from metagpt.logs import logger
import os

import sys
module_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))  #当前文件夹路径
sys.path.insert(0, module_dir)

from tianji.agents.metagpt_agents.intentRecognition import IntentReg
from tianji.agents.metagpt_agents.answerBot import AnswerBot
from tianji.agents.metagpt_agents.sceneRefinement import SceneRefine
from tianji.agents.metagpt_agents.searcher import Searcher
from tianji.agents.metagpt_agents.utils.json_from import SharedDataSingleton
from tianji.agents.metagpt_agents.utils.helper_func import has_empty_values, is_number_in_types, timestamp_str, extract_single_type_attributes_and_examples, load_json, extract_all_types
from tianji.agents.metagpt_agents.utils.agent_llm import OpenaiApi as LLMApi
import time

# 初始化session_state变量
if "user_id" not in st.session_state:
    # 为新用户会话生成一个唯一的UUID
    logger.log(0, "add uuid")
    st.session_state["user_id"] = str(uuid.uuid4())

def on_btn_click(sharedData):
    sharedData.message_list_for_agent.clear()
    sharedData.chat_history.clear()
    sharedData.scene_label = ""
    sharedData.scene_attribute = {}
    sharedData.extra_query.clear()
    sharedData.search_results = {}
    st.session_state["generated"].clear()
    st.session_state["past"].clear()
    st.session_state["scene_label"] = ""
    st.session_state["scene_attr"] = {}


def flip():
    if st.session_state["check"]:
        st.session_state["enable_se"] = True
    else:
        st.session_state["enable_se"] = False


def initialize_sidebar(scenes, sharedData):
    with st.sidebar:
        st.markdown("我是由人情世故大模型团队开发的多智能体应用，专注于理解您的意图并进一步提问，以提供精准答案。目前，我支持以下场景：")
        container_all_scenes = st.container(border=True)
        for item in scenes:
            container_all_scenes.write(item)
        st.markdown("用户当前意图：")
        container_current_scene = st.container(border=True)
        container_current_scene.write(st.session_state["scene_label"])
        st.markdown("当前场景要素：")
        container_scene_attribute = st.container(border=True)
        container_scene_attribute.write(st.session_state["scene_attr"])
        st.button("Clear Chat History", on_click=lambda: on_btn_click(sharedData))
        st.checkbox(
            "启用网络搜索（确保填写密钥）", value=st.session_state["enable_se"], key="check", on_change=flip
        )


async def main():
    role_intentReg = IntentReg()
    role_sceneRefine = SceneRefine()
    role_answerBot = AnswerBot()
    role_search = Searcher()

    st.write(f"您的会话ID是: {st.session_state['user_id']}")
    st.title("人情世故大模型")
    json_data = load_json("scene_attribute.json")

    if "generated" not in st.session_state:
        st.session_state["generated"] = []
    if "past" not in st.session_state:
        st.session_state["past"] = []
    if "enable_se" not in st.session_state:
        st.session_state["enable_se"] = False
    if "scene_label" not in st.session_state:
        st.session_state["scene_label"] = ""
    if "scene_attr" not in st.session_state:
        st.session_state["scene_attr"] = {}

    sharedData = SharedDataSingleton.get_instance()
    initialize_sidebar(extract_all_types(json_data), sharedData)

    # 显示历史对话记录
    for first_status_message in sharedData.chat_history:
        message(
            first_status_message["message"],
            is_user=first_status_message["is_user"],
            key=first_status_message["keyname"],
        )

    if user_input := st.chat_input():
        st.session_state["past"].append(user_input)
        message(st.session_state["past"][-1], is_user=True, key="_user")

        sharedData.message_list_for_agent.append({"user": st.session_state["past"][-1]})

        sharedData.chat_history.append(
            {
                "message": st.session_state["past"][-1],
                "is_user": True,
                "keyname": "user" + str(timestamp_str()),
            }
        )

        # 运行意图识别 agent
        intent_ans = (
            await role_intentReg.run(str(sharedData.message_list_for_agent))
        ).content

        # 目前不支持的场景
        if intent_ans == "None":
            st.warning("此模型只支持回答关于人情世故的事项，已调用 API 为你进行单轮回答。")
            rsp = await LLMApi()._aask(prompt=user_input)
            sharedData.message_list_for_agent.clear()
            st.session_state["generated"].append(rsp)
            sharedData.chat_history.append(
                {
                    "message": st.session_state["generated"][-1],
                    "is_user": False,
                    "keyname": "assistant" + str(timestamp_str()),
                }
            )
            message(st.session_state["generated"][-1], is_user=False)

        # 模型返回未知的场景标签
        elif not is_number_in_types(json_data, int(intent_ans)):
            st.warning("模型发生幻觉，请重新提问")
            sharedData.message_list_for_agent.clear()
            time.sleep(3)

        else:
            # 确认用户意图后：
            if not sharedData.scene_label or sharedData.scene_label != intent_ans:
                sharedData.scene_label = intent_ans
                st.session_state["scene_label"] = sharedData.scene_label
                # 提取对应场景所需要的场景要素
                _, scene_attributes, _ = extract_single_type_attributes_and_examples(
                    json_data, sharedData.scene_label
                )
                sharedData.scene_attribute = {attr: "" for attr in scene_attributes}

            sharedData.scene_label = intent_ans
            st.session_state["scene_label"] = sharedData.scene_label

            # 运行场景细化 agent
            refine_ans = (
                await role_sceneRefine.run(str(sharedData.message_list_for_agent))
            ).content

            st.session_state["scene_attr"] = sharedData.scene_attribute
            # 用户提供的场景要素不全，场景细化 agent 进行提问
            if refine_ans != "":
                st.session_state["generated"].append(refine_ans)
                sharedData.message_list_for_agent.append(
                    {"assistant": st.session_state["generated"][-1]}
                )
                sharedData.chat_history.append(
                    {
                        "message": st.session_state["generated"][-1],
                        "is_user": False,
                        "keyname": "assistant" + str(timestamp_str()),
                    }
                )
                message(st.session_state["generated"][-1], is_user=False)

            # 用户提供的场景要素齐全，运行回答助手 agent
            if not has_empty_values(sharedData.scene_attribute):
                final_ans = (
                    await role_answerBot.run(str(sharedData.message_list_for_agent))
                ).content
                st.session_state["generated"].append(final_ans)
                sharedData.chat_history.append(
                    {
                        "message": st.session_state["generated"][-1],
                        "is_user": False,
                        "keyname": "assistant" + str(timestamp_str()),
                    }
                )
                message(st.session_state["generated"][-1], is_user=False)

                # 如果开启已网络搜索助手 agent ，运行 agent
                if st.session_state["enable_se"] is True:
                    with st.spinner("启用搜索引擎，请稍等片刻... 如有报错，请检查密钥是否填写正确"):
                        await role_search.run(str(sharedData.message_list_for_agent))

                    sa_res1 = "生成的额外查询：" + str(sharedData.extra_query)
                    st.session_state["generated"].append(sa_res1)
                    sharedData.chat_history.append(
                        {
                            "message": st.session_state["generated"][-1],
                            "is_user": False,
                            "keyname": "assistant" + str(timestamp_str()),
                        }
                    )
                    message(st.session_state["generated"][-1], is_user=False)
                  
```

### Core Architecture Module: `run/demo_prompt.py`
```
import gradio as gr
import json
import random
from dotenv import load_dotenv
import argparse

load_dotenv()
from zhipuai import ZhipuAI
import os
from tianji import TIANJI_PATH

# 添加命令行参数解析
parser = argparse.ArgumentParser(description='Launch Gradio application')
parser.add_argument('--listen', action='store_true', help='Specify to listen on 0.0.0.0')
parser.add_argument('--port', type=int, default=None, help='The port the server should listen on')
parser.add_argument('--root_path', type=str, default=None, help='The root path of the server')
args = parser.parse_args()

file_path = os.path.join(TIANJI_PATH, "tianji/prompt/yiyan_prompt/all_yiyan_prompt.json")
API_KEY = os.environ["ZHIPUAI_API_KEY"]
CHOICES = ["敬酒", "请客", "送礼", "送祝福", "人际交流", "化解尴尬", "矛盾应对"]

with open(file_path, "r", encoding="utf-8") as file:
    json_data = json.load(file)


def get_names_by_id(id):
    names = []
    for item in json_data:
        if "id" in item and item["id"] == id:
            names.append(item["name"])

    return list(set(names))  # Remove duplicates


def get_system_prompt_by_name(name):
    with open(file_path, "r", encoding="utf-8") as file:
        data = json.load(file)
    """Returns the system prompt for the specified name."""
    for item in data:
        if item["name"] == name:
            return item["system_prompt"]
    return None  # If the name is not found


def change_example(name, cls_choose_value, chatbot):
    now_example = []
    if chatbot is not None:
        print("切换场景清理bot历史")
        chatbot.clear()
    for i in cls_choose_value:
        if i["name"] == name:
            now_example = [[j["input"], j["output"]] for j in i["example"]]
    if now_example is []:
        raise gr.Error("获取example出错！")
    return gr.update(samples=now_example), chat_history


def random_button_click(chatbot):
    choice_number = random.randint(0, 6)
    now_id = choice_number + 1
    cls_choose = CHOICES[choice_number]
    now_json_data = _get_id_json_id(choice_number)
    random_name = [i["name"] for i in now_json_data]
    if chatbot is not None:
        print("切换场景清理bot历史")
        chatbot.clear()
    return (
        cls_choose,
        now_json_data,
        gr.update(choices=get_names_by_id(now_id), value=random.choice(random_name)),
    )


def example_click(dataset, name, now_json):
    system = ""
    for i in now_json:
        if i["name"] == name:
            system = i["system_prompt"]

    if system_prompt == "":
        print(name, now_json)
        raise "遇到代码问题，清重新选择场景"
    return dataset[0], system


def _get_id_json_id(idx):
    now_id = idx + 1  # index + 1
    now_id_json_data = []
    for item in json_data:
        if int(item["id"]) == int(now_id):
            temp_dict = dict(
                name=item["name"],
                example=item["example"],
                system_prompt=item["system_prompt"],
            )
            now_id_json_data.append(temp_dict)
    return now_id_json_data


def cls_choose_change(idx):
    now_id = idx + 1
    return _get_id_json_id(idx), gr.update(
        choices=get_names_by_id(now_id), value=get_names_by_id(now_id)[0]
    )


def combine_message_and_history(message, chat_history):
    # 将聊天历史中的每个元素（假设是元组）转换为字符串
    history_str = "\n".join(f"{sender}: {text}" for sender, text in chat_history)

    # 将新消息和聊天历史结合成一个字符串
    full_message = f"{history_str}\nUser: {message}"
    return full_message


def respond(system_prompt, message, chat_history):
    if len(chat_history) > 11:
        chat_history.clear()  # 清空聊天历史
        chat_history.append(["请注意", "对话超过 已重新开始"])
    # 合并消息和聊天历史
    message1 = combine_message_and_history(message, chat_history)
    print(message1)
    client = ZhipuAI(api_key=API_KEY)
    response = client.chat.completions.create(
        model="glm-4-flash",
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": message1},
        ],
    )

    # 提取模型生成的回复内容
    bot_message_text = response.choices[0].message.content
    # 更新聊天历史
    chat_history.append([message, bot_message_text])  # 用户的消息

    return "", chat_history


def clear_history(chat_history):
    chat_history.clear()
    return chat_history


def regenerate(chat_history, system_prompt):
    if chat_history:
        # 提取上一条输入消息
        last_message = chat_history[-1][0]
        # 移除最后一条记录
        chat_history.pop()
        # 使用上一条输入消息调用 respond 函数以生成新的回复
        msg, chat_history = respond(system_prompt, last_message, chat_history)
    # 返回更新后的聊天记录
    return msg, chat_history


TITLE = """
# Tianji 人情世故大模型系统——prompt版 欢迎star！\n
## 💫开源项目地址：https://github.com/SocialAI-tianji/Tianji
### 我们的愿景是构建一个从数据收集开始的大模型全栈垂直领域开源实践。\n
## 我们支持不同模型进行对话，你可以选择你喜欢的模型进行对话。
## 使用方法：选择或随机一个场景，输入提示词（或者点击上面的Example自动填充），随后发送！
"""

with gr.Blocks() as demo:
    chat_history = gr.State()
    now_json_data = gr.State(value=_get_id_json_id(0))
    now_name = gr.State()
    gr.Markdown(TITLE)
    cls_choose = gr.Radio(label="请选择任务大类", choices=CHOICES, type="index", value="敬酒")
    input_example = gr.Dataset(
        components=["text", "text"],
        samples=[
            ["请先选择合适的场景", "请先选择合适的场景"],
        ],
    )
    with gr.Row():
        with gr.Column(scale=1):
            dorpdown_name = gr.Dropdown(
                choices=get_names_by_id(1),
                label="场景",
                info="请选择合适的场景",
                interactive=True,
            )
            system_prompt = gr.TextArea(label="系统提示词")  # TODO 需要给初始值嘛？包括example
            random_button = gr.Button("🪄点我随机一个试试！", size="lg")
            dorpdown_name.change(
                fn=get_system_prompt_by_name,
                inputs=[dorpdown_name],
                outputs=[system_prompt],
            )
        with gr.Column(scale=4):
            chatbot = gr.Chatbot(
                label="聊天界面", value=[["如果喜欢，请给我们一个⭐，谢谢", "不知道选哪个？试试点击随机按钮把！"]]
            )
            msg = gr.Textbox(label="输入信息")
            msg.submit(
                respond, inputs=[system_prompt, msg, chatbot], outputs=[msg, chatbot]
            )
            submit = gr.Button("发送").click(
                respond, inputs=[system_prompt, msg, chatbot], outputs=[msg, chatbot]
            )
            with gr.Row():
                clear = gr.Button("清除历史记录").click(
                    clear_history, inputs=[chatbot], outputs=[chatbot]
                )
                regenerate = gr.Button("重新生成").click(
                    regenerate, inputs=[chatbot, system_prompt], outputs=[msg, chatbot]
                )

    cls_choose.change(
        fn=cls_choose_change, inputs=cls_choose, outputs=[now_json_data, dorpdown_name]
    )
    dorpdown_name.change(
        fn=change_example,
        inputs=[dorpdown_name, now_json_data, chatbot],
        outputs=[input_example, chat_history],
    )
    input_example.click(
        fn=example_click,
        inputs=[input_example, dorpdown_name, now_json_data],
        outputs=[msg, system_prompt],
    )
    random_button.click(
        fn=random_button_click,
        inputs=chatbot,
        outputs=[cls_choose, now_json_data, dorpdown_name],
    )

if __name__ == "__main__":
    server_name = '0.0.0.0' if args.listen else None
    server_port = args.port
    demo.launch(server_name=server_name, server_port=server_port, root_path=args.root_path)

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #64** (2025-11-05): **关于如何快速微调一个属于自己的送祝福专用大模型**
  *Symptoms*: 在文档4.2如何快速微调一个属于自己的送祝福专用大模型中，我根据文档要求进行复现，但是一直无法训练成功，在使用xtuner train ./internlm2_chat_7b_qlora_oasst1_e3_copy.py  --deepspeed deepspeed_zero2时总是出现环境不匹配的问题，并且我发现在环境准备阶段的许多第三方库不能满足xtuner 0.1.18，当然我是在conda新建的虚拟环境下，且python=3.10。我想知道有人成功复现过吗？ 当前pip list Package                       Version ----------------------------- -------------- accelerate                    1.10.1 addict                        2.4.0 aiohappyeyeballs              2.6.1 aiohttp                       3.12.15 aiosignal                     1.4.0 aliyun-python-sdk-core        2.16.0 aliyun-python-sdk-kms         2.16.5 altair                        5.5.0 annotated-types               0.7.0 anyio                         4.10.0 argon2-cffi                   25.1.0 argon2-cffi-bindings          25.1.0 arrow                         1.3.0 arxiv                         2.2.0 asttokens                     3.0.0 async-lru                     2.0.5 async-timeout                 5.0.1 attrs                         25.3.0 babel                         2.17.0 beautifulsoup4                4.13.5 bitsandbytes                  0.47.0 bleach                        6.2.0 blinker                       1.9.0 Brotli                        1.1.0 cachetools                    5.5.2 certifi                       2025.8.3 cffi                          1.17.1 charset-normalizer            3.4.3 click                         8.2.1 colorama                      0.4.6 comm                          0.2.3 contourpy                     1.3.2 c
  **Post-Mortem & Fix Analysis**:
  > 可以使用最新版本测试，或改为 qwen 版本；如果还有问题我会考虑更新代码

- **Issue #63** (2025-11-05): **An invitation from Baidu PaddlePaddle**
  *Symptoms*: hi SocialAI-tianji 我看到了你在[Tianji]上的工作，感觉你在 [大语言模型开发]方面的经验非常丰富！我们是飞桨文心开发者生态运营团队，非常想邀请您一起合作Github开源项目共建、联合发文推广等。  🚀相关权益：开发者大会VIP邀请、文心飞桨开发者技术专家认证（400+人，优质AI朋友圈资源）、官方ERNIE博客/百度AI等公众号/小红书宣传流量倾斜，百度智能云算力资源支持项目开发/模型训练、优质项目扶持计划等。 🏆我们目前正在举办百度文心开源创新大赛，同步诚邀您参与，奖励包括总计20万元奖金💰，双赛道： * 多模式创新-基于文心大模型4.5多模态系列模型（Vision-Language Models (VLMs)）完成模型优化和应用构建； * 硬件创新——基于文心4.5系列开源模型构建软硬件深度融合的原生AI硬件产品。  如果您对我们的活动感兴趣，请附上您的GitHub主页链接和简单介绍，发送邮件至：v_wangminglei@baidu.com，或者微信联系 17703190074，我们会在1-2个工作日内联系您～非常期待您的回复
  **Post-Mortem & Fix Analysis**:
  > 已建联

- **Issue #61** (2025-01-18): **bug_fix**
  *Symptoms*: tianji/agents/metagpt_agents/sceneRefinement/role.py里的_react函数需要在while循环外给msg赋空值，防止循环break后出现错误UnboundLocalError: local variable 'msg' referenced before assignment 
  **Post-Mortem & Fix Analysis**:
  > LGTM 感谢贡献

- **Issue #60** (2025-04-29): **群和tolls**
  *Symptoms*: 群过期了  getdata也没这个文件
  **Post-Mortem & Fix Analysis**:
  > 群过期
  > 群过期了 ，希望加入组织
  > 已更新 感谢反馈 

- **Issue #59** (2024-12-30): **fix agent Docs**
  *Symptoms*: 

- **Issue #58** (2024-12-29): **Time**
  *Symptoms*: 初始化数据库要多久 
  **Post-Mortem & Fix Analysis**:
  > 取决于cpu，10分钟左右，快的话5分钟内
  > 不是你抄送给我干嘛，我踏马又不是开发者，给你们开源人闹麻了    ---Original--- From: "Yunqi ***@***.***&gt; Date: Wed, Jun 3, 2026 18:55 PM To: ***@***.***&gt;; Cc: ***@***.******@***.***&gt;; Subject: Re: [SocialAI-tianji/Tianji] Time (Issue #58)   wolfguidepink left a comment (SocialAI-tianji/Tianji#58)   @xjyisok @sanbuphy   不想再解释什么了。唯一的活动就是给本项目点了星。证据确凿。处理不处理随你，但大家都看在眼里。   — Reply to this email directly, view it on GitHub, or unsubscribe. Triage notifications, keep track of coding agent tasks and review pull requests on the go with GitHub Mobile for iOS and Android. Download it today!  You are receiving this because you were mentioned.Message ID: ***@***.***&gt;

- **Issue #57** (2024-12-29): **环境变量**
  *Symptoms*: 你好环境变量中HF_HOME='temp/huggingface_cache/'这里的HF_HOME指的是什么，我该如何设置
  **Post-Mortem & Fix Analysis**:
  > 这个的意思是 huggingface 模型的缓存地址，所有被触发下载的 huggingface 模型将会下载到此处。 如果不设置可能会被下载到C盘或者系统目录；如果设置（如当前环境是在该文件夹的 temp 路径） 则表示下载到指定的当前文件夹地址。
  > 不是你抄送给我干嘛，我踏马又不是开发者，给你们开源人闹麻了    ---原始邮件--- 发件人: "Ting ***@***.***&gt; 发送时间: 2026年6月3日(周三) 晚上6:52 收件人: ***@***.***&gt;; 抄送: ***@***.******@***.***&gt;; 主题: Re: [SocialAI-tianji/Tianji] 环境变量 (Issue #57)   kafakigang left a comment (SocialAI-tianji/Tianji#57)   @xjyisok @sanbuphy   最近几天涌进来一大波假账号给你打星，特征太明显了——空壳号扎堆出现，时间线高度集中。   这么搞对社区公平性是一种伤害，对那些认真做项目的开发者也不尊重。   请你：    排查清理掉那些虚假的 star   给出一个公开声明   别再玩这种数字游戏了    开源圈子不大，名声坏了就很难挽回，三思而行。   — Reply to this email directly, view it on GitHub, or unsubscribe. Triage notifications, keep track of coding agent tasks and review pull requests on the go with GitHub Mobile for iOS and Android. Download it today!  You are receiving this because you were mentioned.Message ID: ***@***.***&gt;

- **Issue #56** (2024-12-29): **streamlit run demo_agent_metagpt.py报错**
  *Symptoms*: 运行streamlit run demo_agent_metagpt.py报错如下：    File "/data/code/demo_agent_metagpt.py", line 260, in <module>     asyncio.run(main())   File "/home/whwang22/.conda/envs/llm-xuanji/lib/python3.11/asyncio/runners.py", line 190, in run     return runner.run(main)            ^^^^^^^^^^^^^^^^   File "/home/whwang22/.conda/envs/llm-xuanji/lib/python3.11/asyncio/runners.py", line 118, in run     return self._loop.run_until_complete(task)            ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^   File "/home/whwang22/.conda/envs/llm-xuanji/lib/python3.11/asyncio/base_events.py", line 654, in run_until_complete     return future.result()            ^^^^^^^^^^^^^^^   File "/data/code/demo_agent_metagpt.py", line 67, in main     role_intentReg = IntentReg()                      ^^^^^^^^^^^   File "/data/whwang22/code/3_行业应用/项目式教学项目案例_人情练达大模型/tianji/agents/metagpt_agents/intentRecognition/role.py", line 21, in __init__     self._init_action([IntentAnalyze])   File "/home/whwang22/.conda/envs/llm-xuanji/lib/python3.11/site-packages/metagpt/roles/role.py", line 249, in _init_action     if not action.private_config:            ^^^^^^^^^^^^^^^^^^^^^ AttributeError: 'list' object has no attribute 'private_config'
  **Post-Mortem & Fix Analysis**:
  > 你好 已经修复，可以再次尝试

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

### Incident Patch 1: `3bb101b7` (2025-01-18)
**Commit Message**: Merge pull request #61 from binichallein/bug_fix

bug_fix

**File**: `tianji/agents/metagpt_agents/sceneRefinement/role.py` (modified, +1/-0)
```diff
@@ -56,6 +56,7 @@ async def _think(self) -> None:
             self.rc.todo = None
 
     async def _react(self) -> Message:
+        msg=None
         while True:
             await self._think()
             if self.rc.todo is None:
```

---

### Incident Patch 2: `3a3b98a1` (2025-01-17)
**Commit Message**: 改bug

**File**: `tianji/agents/metagpt_agents/sceneRefinement/role.py` (modified, +1/-0)
```diff
@@ -56,6 +56,7 @@ async def _think(self) -> None:
             self.rc.todo = None
 
     async def _react(self) -> Message:
+        msg=None
         while True:
             await self._think()
             if self.rc.todo is None:
```

---

### Incident Patch 3: `d30a87e3` (2024-12-29)
**Commit Message**: fix readme

**File**: `README.md` (modified, +3/-1)
```diff
@@ -260,9 +260,9 @@ python run/demo_rag_langchain_onlinellm.py
 ## 路线图
 
 - [ ] 加入意图识别模块，替代主动选择场景
-- [ ] 完成 Agent 部分文档  
 - [ ] 增加 Dify、Agently 调用方式
 - [ ] 补充文档（如何参考本项目构建自己的应用prompt、agent、知识库、微调应用）
+- [ ] 等待造模型能力迭代，更新sft数据模板
 
 <details>
 <summary>已完成项目</summary>
@@ -274,6 +274,8 @@ python run/demo_rag_langchain_onlinellm.py
 - [x] 完成 Agent 部分重构
 - [x] 完成知识库部分迭代，开源至huggingface
 - [x] 整理多维度数据，开源较完整人情世故语料
+- [x] 完成 Agent 部分文档  
+
 </details>
 
 ## 技术路线
```

---

### Incident Patch 4: `1cf4f4ae` (2024-12-28)
**Commit Message**: fix

**File**: `README.md` (modified, +4/-4)
```diff
@@ -98,7 +98,7 @@
 
 [2024/10/05] 重构 [Agent 模块](https://github.com/SocialAI-tianji/Tianji/blob/main/run/demo_agent_metagpt.py)，修复 [代码规范](https://github.com/SocialAI-tianji/Tianji/tree/main/tianji/agents/metagpt_agents)
 
-[2024/09/02] 更新第一款专注[敬酒场景的知识库](http://120.76.130.14:6006/knowledges/)对话模型
+[2024/09/02] 更新第一款专注[敬酒场景的知识库](https://www.modelscope.cn/studios/sanbuphy/SocialAI-Tianji-RAG)对话模型
 
 [2024/08/31] 重构仓库结构，更新工具代码及langchain [知识库问答](./tianji/knowledges/)、对应 [demo](run/demo_rag_langchain_onlinellm.py)
 
@@ -117,7 +117,7 @@
 
 <p style="text-align: center;"><strong>天机虽不可泄漏，但总有一款适合你</strong></p>
 
-<p style="text-align: center;">运行<a href="http://120.76.130.14:6006/prompt/">prompt版本天机</a>，感受放飞自我的答复</p>
+<p style="text-align: center;">运行<a href="https://www.modelscope.cn/studios/sanbuphy/SocialAI-Tianji-prompt">prompt版本天机</a>，感受放飞自我的答复</p>
 <table border="0" style="width: 100%; text-align: center;">
   <tr>
       <td>
@@ -135,7 +135,7 @@
   </tr>
 </table>
 
-<p style="text-align: center;">运行<a href="http://120.76.130.14:6006/knowledges/">知识库版本天机</a>，获得详细的人情世故指导</p>
+<p style="text-align: center;">运行<a href="https://www.modelscope.cn/studios/sanbuphy/SocialAI-Tianji-RAG">知识库版本天机</a>，获得详细的人情世故指导</p>
 
 <table border="0" style="width: 100%; text-align: left; margin-top: 20px;">
   <tr>
@@ -206,7 +206,7 @@
 - [贡献者](#%E8%B4%A1%E7%8C%AE%E8%80%85)
 - [鸣谢](#%E9%B8%A3%E8%B0%A2)
 
-## 快速开始 💫
+## 快速开始 🚀
 
 ### 环境安装
 
```

---

### Incident Patch 5: `f97658be` (2024-12-28)
**Commit Message**: fix

**File**: `README.md` (modified, +7/-3)
```diff
@@ -125,6 +125,8 @@
               <img src="assets/demo/prompt应用1.png" width="100%" alt="prompt应用1">
           </a>
       </td>
+  </tr>
+  <tr>
       <td>
           <a href="assets/demo/prompt应用2.png" target="_blank">
               <img src="assets/demo/prompt应用2.png" width="100%" alt="prompt应用2">
@@ -149,20 +151,22 @@
           </a>
           <p>如何说对话</p>
       </td>
+  </tr>
+  <tr>
       <td>
           <a href="assets/demo/敬酒礼仪文化.png" target="_blank">
               <img src="assets/demo/敬酒礼仪文化.png" width="100%" alt="敬酒礼仪文化">
           </a>
           <p>敬酒礼仪文化</p>
       </td>
-  </tr>
-  <tr>
       <td>
           <a href="assets/demo/矛盾冲突应对.png" target="_blank">
               <img src="assets/demo/矛盾冲突应对.png" width="100%" alt="矛盾冲突应对">
           </a>
           <p>矛盾冲突应对</p>
       </td>
+  </tr>
+  <tr>
       <td>
           <a href="assets/demo/请客礼仪文化.png" target="_blank">
               <img src="assets/demo/请客礼仪文化.png" width="100%" alt="请客礼仪文化">
@@ -184,7 +188,7 @@
 <!-- End of Selection -->
 
 <p style="text-align: center;">
-    <img src="assets\demo\demo_wishes.png" alt="送祝福天机" width="100%">
+    <img src="assets\demo\demo_wishes.png" alt="送祝福天机" width="80%">
 </p>
 
 
```

---

### Incident Patch 6: `ca17f16d` (2024-12-28)
**Commit Message**: fix

**File**: `README.md` (modified, +2/-0)
```diff
@@ -46,6 +46,8 @@
 
 [2024/12/21] 🔥 更新**送祝福模型v0.2**，支持更多风格切换，包含 [3B](https://www.modelscope.cn/models/sanbuphy/tianji-wish2-3b) / [7B](https://www.modelscope.cn/models/sanbuphy/tianji-wish2-7b) / [14B(推荐)](https://www.modelscope.cn/models/sanbuphy/tianji-wish2-14b) 模型、[数据](https://huggingface.co/datasets/sanbu/tianji-chinese/blob/main/tianji-wishes-chinese-v0.2.json)、[制作流程](docs/finetune/tianji-wishes-chinese-2.md)、[测试](tianji/finetune/transformers/Qwen2_5/qwen2_5_infer_base.py)与[训练](tianji/finetune/transformers/Qwen2_5)代码
 
+<img src="assets\data_demo.png" width="100%">
+
 祝朋友新年快乐，文艺风格
 
 >当晨曦的第一缕阳光轻轻拂过窗棂，新年的钟声在耳边回荡，我仿佛听见了岁月的低语。那些曾经在时光里绽放的瞬间，如同冬日里温暖的炉火，照亮了每一个寒冷的夜晚。记得去年冬天，我们一起围坐在火炉旁，分享着彼此的故事，那一刻，时间仿佛静止了。如今，新的一年已经到来，愿你依然能够保持那份纯真与热情，让生活中的每一个细节都充满诗意。愿你在未来的日子里，无论风雨变换，都能找到属于自己的那片晴空。
```

**File**: `tianji/finetune/transformers/Qwen2_5/qwen2_5_infer_base.py` (modified, +1/-1)
```diff
@@ -8,7 +8,7 @@
 import os
 from modelscope import snapshot_download
 
-# download model
+# download model 根据显卡情况选择，推荐使用 7b 或 14b 模型
 download_path = os.path.join(TIANJI_PATH, "temp","tianji-wish2")
 snapshot_download("sanbuphy/tianji-wish2-3b", cache_dir=download_path)
 
```

---

### Incident Patch 7: `4ecba4c2` (2024-12-28)
**Commit Message**: fix

**File**: `README.md` (modified, +1/-1)
```diff
@@ -44,7 +44,7 @@
 
 ## News
 
-[2024/12/21] 🔥 更新**送祝福模型v0.2**，支持更多风格切换，包含 [3B](https://www.modelscope.cn/models/sanbuphy/tianji-wish2-3b) / [7B](https://www.modelscope.cn/models/sanbuphy/tianji-wish2-7b) / [14B(推荐)](https://www.modelscope.cn/models/sanbuphy/tianji-wish2-14b) 模型、[数据](https://huggingface.co/datasets/sanbu/tianji-chinese/blob/main/tianji-wishes-chinese-v0.2.json)、[制作流程](docs/finetune/tianji-wishes-chinese-2.md)、测试代码（TODO）
+[2024/12/21] 🔥 更新**送祝福模型v0.2**，支持更多风格切换，包含 [3B](https://www.modelscope.cn/models/sanbuphy/tianji-wish2-3b) / [7B](https://www.modelscope.cn/models/sanbuphy/tianji-wish2-7b) / [14B(推荐)](https://www.modelscope.cn/models/sanbuphy/tianji-wish2-14b) 模型、[数据](https://huggingface.co/datasets/sanbu/tianji-chinese/blob/main/tianji-wishes-chinese-v0.2.json)、[制作流程](docs/finetune/tianji-wishes-chinese-2.md)、[测试](tianji/finetune/transformers/Qwen2_5/qwen2_5_infer_base.py)与[训练](tianji/finetune/transformers/Qwen2_5)代码
 
 祝朋友新年快乐，文艺风格
 
```

---

### Incident Patch 8: `755f1e32` (2024-12-28)
**Commit Message**: fix

**File**: `README.md` (modified, +1/-1)
```diff
@@ -44,7 +44,7 @@
 
 ## News
 
-[2024/12/21] 🔥 更新**送祝福模型v0.2**，支持更多风格切换，包含 [3B](https://www.modelscope.cn/models/sanbuphy/tianji-wish2-3b) / [7B](https://www.modelscope.cn/models/sanbuphy/tianji-wish2-7b) / [14B(推荐)](https://www.modelscope.cn/models/sanbuphy/tianji-wish2-14b) 模型、[数据](https://huggingface.co/datasets/sanbu/tianji-chinese/blob/main/tianji-wishes-chinese-v0.2.json)、[制作流程](docs\finetune\tianji-wishes-chinese-2.md)、测试代码（TODO）
+[2024/12/21] 🔥 更新**送祝福模型v0.2**，支持更多风格切换，包含 [3B](https://www.modelscope.cn/models/sanbuphy/tianji-wish2-3b) / [7B](https://www.modelscope.cn/models/sanbuphy/tianji-wish2-7b) / [14B(推荐)](https://www.modelscope.cn/models/sanbuphy/tianji-wish2-14b) 模型、[数据](https://huggingface.co/datasets/sanbu/tianji-chinese/blob/main/tianji-wishes-chinese-v0.2.json)、[制作流程](docs/finetune/tianji-wishes-chinese-2.md)、测试代码（TODO）
 
 祝朋友新年快乐，文艺风格
 
```

**File**: `docs/finetune/tianji-wishes-chinese-2.md` (modified, +1/-1)
```diff
@@ -128,7 +128,7 @@ Claude 3.5 可以实现，在保持绝对风格与元数据相似的情况下，
 
 > 在这粽叶飘香的时节，心中泛起阵阵温馨的涟漪，为你那如龙舟般勇往直前的精神，为你那似艾草般清新脱俗的气质，为岁月悠悠，同窗时光已成珍贵回忆。心意如同端午的细雨，润物无声，却饱含深情。愿你在端午的阳光下，乘着和风，驾驭着梦想的舟楫，在人生的江河中破浪前行。端午安康，我亲爱的同学。
 
-此处可参考送祝福[最新版数据制造脚本](..\..\tools\finetune\data_maker\get_wish_datav2.py)，进行大批量数据的生成，即可获得大量微调数据。至此，拟人化数据准备完成。
+此处可参考送祝福[最新版数据制造脚本](../../tools/finetune/data_maker/get_wish_datav2.py)，进行大批量数据的生成，即可获得大量微调数据。至此，拟人化数据准备完成。
 
 ### 数据合并
 
```

---

### Incident Patch 9: `dad7a8c9` (2024-12-28)
**Commit Message**: fix

**File**: `tianji/finetune/transformers/Qwen2_5/qwen2_5_train_lora.py` (modified, +2/-2)
```diff
@@ -27,8 +27,8 @@
 # =========================
 PATH_CONFIG = {
     "json_input": "/home/merged.json",                        # 数据集JSON文件路径
-    "model_cache_dir": "/home/temp",                           # 模型下载后缓存目录
-    "model_repo": "qwen/Qwen2.5-14B-Instruct",                  # 此处指定模型仓库名称
+    "model_cache_dir": "/home/temp",                           # 模型下载缓存目录
+    "model_repo": "qwen/Qwen2.5-14B-Instruct",                  # 此处可指定任意模型仓库名称,自动下载缓存至缓存目录
     
     "training_output_base_dir": "/home/output",                # 基础训练输出目录
     "training_job_name": "Qwen2.5_instruct_lora",             # 训练任务名称
```

---

### Incident Patch 10: `880d2767` (2024-12-24)
**Commit Message**: fix reademe

**File**: `README.md` (modified, +4/-4)
```diff
@@ -234,7 +234,7 @@ HF_TOKEN=
 TAVILY_API_KEY=
 ```
 
-如果你想要结合 Agent 中的网络搜索工具给出更好的回答，你需要填写上述环境变量的 TAVILY_API_KEY 进行搜索请求，你可以在 [TAVILY 官网](https://app.tavily.com/home)获取体验免���密钥（个人免费额度）
+如果你想要结合 Agent 中的网络搜索工具给出更好的回答，你需要填写上述环境变量的 TAVILY_API_KEY 进行搜索请求，你可以在 [TAVILY 官网](https://app.tavily.com/home)获取密钥（个人免费额度）
 
 ### 运行
 
@@ -291,7 +291,7 @@ python run/demo_rag_langchain_onlinellm.py
   《能屈能伸》
 ```
 
-结合这些领域，Tianji涉及到的技��路线共有四种：
+结合这些领域，Tianji涉及到的技术路线共有四种：
 
 - 纯prompt（包括AI游戏）：内置 system prompt 基于大模型自身能力对话。
 - Agent（MetaGPT等）：利用 Agent 架构的得到更丰富、更定制化详细的回答。
@@ -309,7 +309,7 @@ run/： 包括了各类演示用前端
 temp/：运行时临时文件目录，包含各类模型文件
 test/：这里存放了各类功能的测试文件，包括核心模块以及大语言模型单独运行的单元测试
 tianji/：源代码目录，包含主要逻辑与算法实现（prompt、agent、knowledges、finetune）
-tools/：涵盖帮助收集数据、整��数据清洗语料的工具
+tools/：涵盖帮助收集数据、整理数据清洗语料的工具
 ```
 
 ## 参与贡献
@@ -371,7 +371,7 @@ git commit -m "提交信息"
 感谢下列所有人对本项目的帮助（不分前后），以及你的关注：
 
 - 项目最开始时刻 [智谱AI](https://open.bigmodel.cn/) 的token支持
-- 上海人工智能实验室 [InternLM(书生·浦语) 模型](https://github.com/InternLM/InternLM)，以及提供的A100显卡��源、与 [书生浦语API](https://internlm.intern-ai.org.cn/api/document) 支持
+- 上海人工智能实验室 [InternLM(书生·浦语) 模型](https://github.com/InternLM/InternLM)，以及提供的A100显卡资源、与 [书生浦语API](https://internlm.intern-ai.org.cn/api/document) 支持
 - [InternLM(书生·浦语) 系列开源教程](https://github.com/InternLM/tutorial)（目前最好的LLM实战全栈教程之一）
 - [飞桨 aistudio 星河社区](https://aistudio.baidu.com/overview) 的 token 与显卡支持
 - [Datawhale 开源学习社区](https://github.com/datawhalechina)
```

#### Recent Merged Pull Requests:
- **PR #61** (2025-01-18): bug_fix (@binichallein)
- **PR #59** (2024-12-30): fix agent Docs (@tackhwa)
- **PR #53** (2024-10-18): Add md file via upload (@ElsaWang1215)
- **PR #51** (closed): test ci (@GoldWaterFall)
- **PR #50** (closed): Add 02-Hospitality-家宴与宴席说话.md  via upload (@ElsaWang1215)
- **PR #49** (closed): Add files via upload (@ElsaWang1215)
- **PR #48** (closed): [Improve] improve environment setup (@tackhwa)
- **PR #47** (2024-10-16): Update contributor.md (@ElsaWang1215)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
