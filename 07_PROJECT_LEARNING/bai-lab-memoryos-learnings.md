# Forensic Learning Record (Deep Inspection): BAI-LAB/MemoryOS

> **Canonical Artifact**: `07_PROJECT_LEARNING/bai-lab-memoryos-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/BAI-LAB/MemoryOS](https://github.com/BAI-LAB/MemoryOS))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-06T06:07:43.904Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `BAI-LAB/MemoryOS`
- **Description**: [EMNLP 2025 Oral] MemoryOS is designed to provide a memory operating system for personalized AI agents.
- **Primary Language / Ecosystem**: Python
- **Discovered Manifests / Configurations**: README.md, Dockerfile
- **Stars / Engagement**: 1595 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: README.md, Dockerfile.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `eval/utils.py`
```
import time
import uuid
import openai
import numpy as np
from sentence_transformers import SentenceTransformer
from openai import OpenAI
gpt_client = OpenAI(
        api_key='',
    base_url='https://cn2us02.opapi.win/v1'
)
def get_timestamp():
    return time.strftime("%Y-%m-%d %H:%M:%S", time.localtime())

def generate_id(prefix="id"):
    return f"{prefix}_{uuid.uuid4().hex[:8]}"

def get_embedding(text, model_name="all-MiniLM-L6-v2"):
    model = SentenceTransformer(model_name)
    embedding = model.encode([text], convert_to_numpy=True)[0]
    return embedding

def normalize_vector(vec):
    vec = np.array(vec, dtype=np.float32)
    norm = np.linalg.norm(vec)
    if norm == 0:
        return vec
    return vec / norm

class OpenAIClient:
    def __init__(self, api_key, base_url):
        self.api_key = api_key
        self.base_url = base_url
        openai.api_key = self.api_key
        openai.api_base = self.base_url

    def chat_completion(self, model, messages, temperature=0.7, max_tokens=2000):
        print("调用 GPT 接口，模型:", model)
        response = gpt_client.chat.completions.create(
            model=model,
            messages=messages,
            temperature=temperature,
            max_tokens=max_tokens
        )
        return response.choices[0].message.content.strip()

def gpt_generate_answer(prompt, messages, client):
    return client.chat_completion(model="gpt-4o-mini", messages=messages, temperature=0.7, max_tokens=2000)

def analyze_assistant_knowledge(dialogs, client):
    """
    Analyzes conversations to extract knowledge or identity traits about the assistant.
    Returns: {"assistant_knowledge": str}
    """
    conversation = "\n".join([f"User: {d['user_input']}\nAI: {d['agent_response']}\nTime:{d['timestamp']}\n" for d in dialogs])

    prompt = """
# Assistant Knowledge Extraction Task
Analyze the conversation and extract any fact or identity traits about the assistant. 
If no traits can be extracted, reply with "None". Use the following format for output:
The generated content should be as concise as possible — the more concise, the better.
【Assistant Knowledge】
- [Fact 1]
- [Fact 2]
- (Or "None" if none found)

Few-shot examples:
1. User: Can you recommend some movies.
   AI: Yes, I recommend Interstellar.
   Time: 2023-10-01
   【Assistant Knowledge】
   - I recommend Interstellar on 2023-10-01.

2. User: Can you help me with cooking recipes?
   AI: Yes, I have extensive knowledge of cooking recipes and techniques.
   Time: 2023-10-02
   【Assistant Knowledge】
   - I have cooking recipes and techniques on 2023-10-02.

3. User: That’s interesting. I didn’t know you could do that.
   AI: I’m glad you find it interesting!
   【Assistant Knowledge】
   - None

Conversation:
""" + conversation

    messages = [
        {
            "role": "system",
            "content": """You are an assistant knowledge extraction engine. Rules:
1. Extract ONLY explicit statements about the assistant's identity or knowledge.
2. Use concise and factual statements in the first person.
3. If no relevant information is found, output "None".""" 
        },
        {"role": "user", "content": prompt}
    ]

    print("Analyzing assistant knowledge...")
    result = gpt_generate_answer(prompt, messages, client)
    
    # Parse output
    assistant_knowledge = result.replace("【Assistant Knowledge】", "").strip()
    return {"assistant_knowledge": assistant_knowledge}

def gpt_summarize(dialogs, client):
    prompt = "Please generate a topic summary based on the following conversation：\n"
    for d in dialogs:
        prompt += f"user: {d.get('user_input','')}\nassiant: {d.get('agent_response','')}\n"
    prompt += "\nSubject Summary："
    messages = [
        {"role": "system", "content": "You are an expert in summarizing dialogue topics, please generate a concise and precise summary."},
        {"role": "user", "content": prompt}
    ]
    print("调用 GPT 生成主题摘要...")
    return gpt_generate_answer(prompt, messages, client)

def gpt_generate_multi_summary(text, client):
    """
    调用 LLM 生成多子主题摘要，返回格式示例如下：
    {
      "input": "对话文本",
      "summaries": [
         {"theme": "出差", "keywords": ["出差", "行程", "工作"], "content": "用户提到出差相关的困扰"},
         {"theme": "健康", "keywords": ["感冒", "难受", "生病"], "content": "用户反馈感冒导致身体不适"}
      ]
    }
    """
    prompt = ("Please analyze the following dialogue and generate multiple subtopic summaries (if applicable), with a maximum of two themes.\n"
              "Each summary should include the subtopic name, keywords (separated by commas), and the summary text, formatted as a JSON array, with an example format as follows:\n"
              "[\n  {\"theme\": \"Business trip\", \"keywords\": [\"Business trip\", \"Itinerary\", \"Work\"], \"content\": \" User mentioned the troubles related to business trips.\"},\n  {\"theme\": \"Health\", \"keywords\": [\"Cold\", \"Uncomfortable\", \"Sick\"], \"content\": \"User reported feeling unwell due to a cold.\"}\n]\n"
              "Please directly output the JSON array, without adding any other content.\n\Conversation content:\n" + text)
    messages = [
        {"role": "system", "content": "You are an expert in analyzing dialogue topics. No more than two topics."},
        {"role": "user", "content": prompt}
    ]
    print("调用 GPT 生成多子主题摘要...")
    response_text = gpt_generate_answer(prompt, messages, client)
    import json
    try:
        summaries = json.loads(response_text)
    except Exception:
        summaries = []
    return {"input": text, "summaries": summaries}

# def gpt_personality_analysis(dialogs, client):
#     prompt = ("Please analyze the following conversation and extract the user profile information and user private data."
#               "Please output in the following format:\n"
#               "【User Profile】\n"
#               "Areas of Interest:\n"
#               "Response Preferences：\n"
#               "Preferred Content Type：\n"
#               "Short vs. Detailed Responses：\n"
#               "Formal vs. Casual Tone：\n"
#               "Other Notes:：\n"
#               "【User Private Data】\n"
#               "Please list all the private information involved (such as account numbers, passwords, user purchase,etc.). If there is none, please write \"None\"\n\n"
#               "The conversation is as follows:\n")
#     for d in dialogs:
#         prompt += f"User: {d.get('user_input','')}\nAssiant: {d.get('agent_response','')}\n"
#     messages = [
#         {"role": "system", "content": "You are a professional user profile analyst who can also identify user private data. Please strictly follow the template for output."},
#         {"role": "user", "content": prompt}
#     ]
#     print("调用 GPT 分析用户画像和私有数据...")
#     result_text = gpt_generate_answer(prompt, messages, client)
#     profile, private = "", ""
#     parts = result_text.split("【User Private Data】")
#     if len(parts) == 2:
#         profile = parts[0].replace("【User Profile】", "").strip()
#         private = parts[1].strip()
#     else:
#         profile = result_text.strip()
#         private = "None"
#     return {"profile": profile, "private": private}
# def gpt_personality_analysis(dialogs, client):
#     """
#     Analyzes conversations to extract structured personality traits, private knowledge, 
#     and assistant-related knowledge.
#     Returns: {"profile": str, "private": str, "assistant_knowledge": str}
#     """
#     conversation = "\n".join([f"User: {d['user_input']}\nAssistant: {d['agent_response']}" for d in dialogs])

#     prompt = """
# # Personality Analysis Task
# Analyze the conversation and output in EXACTLY this format:

# 【User Profile】
# 1. Core Psychological Traits:
#    - [Trait]: [Positive/Negative/Neutral] (Evidence)
#    - (Max 5 most prominent traits)

# 2. Content Preferences:
#    - [Topic]: [Like/Dislike/Neutral] (Evidence)
#    - (Max 5 strongest preferences)

# 3. Interaction Style:
#    - [Style]: [Preference] (Evidence)
#    - (e.g., Direct/Indirect, Detailed/Concise)

# 4. Value Alignment:
#    - [Value]: [Strong/Weak] (Evidence)
#    - (e.g., Honesty, Helpfulness)

# 【User Private Data】
# - [Fact 1]
# - [Fact 2]
# - (Or "None" if none found)

# Conversation:
# """ + conversation

#     messages = [
#         {
#             "role": "system",
#             "content": """You are a personality analysis engine. Rules:
# 1. Extract ONLY observable traits with direct evidence
# 2. Use standardized trait names from psychology
# 3. Mark confidence: Positive=explicit preference, Neutral=implied
# 4. Private data includes possessions, habits, and sensitive preferences"""
#         },
#         {"role": "user", "content": prompt}
#     ]

#     print("Running personality analysis...")
#     result = gpt_generate_answer(prompt, messages, client)
    
#     # Parse output
#     profile, private = result.split("【User Private Data】") if "【User Private Data】" in result else (result, "None")
    
#     # Analyze assistant knowledge
#     assistant_knowledge_result = analyze_assistant_knowledge(dialogs, client)
    
#     return {
#         "profile": profile.replace("【User Profile】", "").strip(),
#         "private": private.strip(),
#         "assistant_knowledge": assistant_knowledge_result["assistant_knowledge"]
#     }
def gpt_personality_analysis(dialogs, client):
    """
    Analyzes conversations to extract structured personality traits, general user data, 
    and assistant-related knowledge.
    Returns: {"profile": str, "user_data": str, "assistant_knowledge": str}
    """
    conversation = "\n".join([f"User: {d['user_input']}\nAssistant: {d['agent_response']}\nTime:{d['timestamp']}" for d in dialogs])

    prompt = """
# Personality and User Data Analysis Task

```

### Core Architecture Module: `memoryos-chromadb/utils.py`
```
import time
import uuid
import openai
import numpy as np
from sentence_transformers import SentenceTransformer
import json
import os
import inspect
from functools import wraps
try:
    from . import prompts # 尝试相对导入
except ImportError:
    import prompts # 回退到绝对导入
from openai import OpenAI
from concurrent.futures import ThreadPoolExecutor, as_completed
import threading

def clean_reasoning_model_output(text):
    """
    清理推理模型输出中的<think>标签
    """
    if not text:
        return text
    
    import re
    cleaned_text = re.sub(r'<think>.*?</think>', '', text, flags=re.DOTALL)
    cleaned_text = re.sub(r'\n\s*\n\s*\n', '\n\n', cleaned_text)
    cleaned_text = cleaned_text.strip()
    
    return cleaned_text

# ---- OpenAI Client ----
class OpenAIClient:
    def __init__(self, api_key, base_url=None, max_workers=5):
        self.api_key = api_key
        self.base_url = base_url if base_url else "https://api.openai.com/v1"
        self.client = OpenAI(api_key=self.api_key, base_url=self.base_url)
        self.executor = ThreadPoolExecutor(max_workers=max_workers)
        self._lock = threading.Lock()

    def chat_completion(self, model, messages, temperature=0.7, max_tokens=2000):
        print(f"Calling OpenAI API. Model: {model}")
        try:
            response = self.client.chat.completions.create(
                model=model,
                messages=messages,
                temperature=temperature,
                max_tokens=max_tokens
            )
            raw_content = response.choices[0].message.content.strip()
            cleaned_content = clean_reasoning_model_output(raw_content)
            return cleaned_content
        except Exception as e:
            print(f"Error calling OpenAI API: {e}")
            return "Error: Could not get response from LLM."

    def chat_completion_async(self, model, messages, temperature=0.7, max_tokens=2000):
        return self.executor.submit(self.chat_completion, model, messages, temperature, max_tokens)

    def batch_chat_completion(self, requests):
        futures = [self.chat_completion_async(**req) for req in requests]
        results = [future.result() for future in as_completed(futures)]
        return results

    def shutdown(self):
        self.executor.shutdown(wait=True)

# ---- Parallel Processing Utilities ----
def run_parallel_tasks(tasks, max_workers=3):
    """
    并行执行任务列表
    tasks: List of callable functions
    """
    with ThreadPoolExecutor(max_workers=max_workers) as executor:
        futures = [executor.submit(task) for task in tasks]
        results = []
        for future in as_completed(futures):
            try:
                result = future.result()
                results.append(result)
            except Exception as e:
                print(f"Error in parallel task: {e}")
                results.append(None)
        return results

# ---- Basic Utilities ----
def get_timestamp():
    return time.strftime("%Y-%m-%d %H:%M:%S", time.localtime())

def generate_id(prefix="id"):
    return f"{prefix}_{uuid.uuid4().hex[:8]}"

def ensure_directory_exists(path):
    os.makedirs(os.path.dirname(path), exist_ok=True)

# ---- Embedding Utilities ----
_model_cache = {}
_embedding_cache = {}

def _get_valid_kwargs(func, kwargs):
    try:
        sig = inspect.signature(func)
        param_keys = set(sig.parameters.keys())
        return {k: v for k, v in kwargs.items() if k in param_keys}
    except (ValueError, TypeError):
        return kwargs

def get_embedding(text, model_name="all-MiniLM-L6-v2", use_cache=True, **kwargs):
    model_config_key = json.dumps({"model_name": model_name, **kwargs}, sort_keys=True)
    
    if use_cache:
        cache_key = f"{model_config_key}::{hash(text)}"
        if cache_key in _embedding_cache:
            return _embedding_cache[cache_key]
    
    model_init_key = json.dumps({"model_name": model_name, **{k:v for k,v in kwargs.items() if k not in ['batch_size', 'max_length']}}, sort_keys=True)
    if model_init_key not in _model_cache:
        print(f"Loading model: {model_name}...")
        if 'bge-m3' in model_name.lower():
            try:
                from FlagEmbedding import BGEM3FlagModel
                init_kwargs = _get_valid_kwargs(BGEM3FlagModel.__init__, kwargs)
                _model_cache[model_init_key] = BGEM3FlagModel(model_name, **init_kwargs)
            except ImportError:
                raise ImportError("Please install FlagEmbedding: 'pip install -U FlagEmbedding' to use bge-m3 model.")
        else:
            from sentence_transformers import SentenceTransformer
            init_kwargs = _get_valid_kwargs(SentenceTransformer.__init__, kwargs)
            _model_cache[model_init_key] = SentenceTransformer(model_name, **init_kwargs)
            
    model = _model_cache[model_init_key]
    
    embedding = None
    if 'bge-m3' in model_name.lower():
        encode_kwargs = _get_valid_kwargs(model.encode, kwargs)
        result = model.encode([text], **encode_kwargs)
        embedding = result['dense_vecs'][0]
    else:
        encode_kwargs = _get_valid_kwargs(model.encode, kwargs)
        embedding = model.encode([text], **encode_kwargs)[0]

    if use_cache:
        cache_key = f"{model_config_key}::{hash(text)}"
        _embedding_cache[cache_key] = embedding
    
    return embedding

def normalize_vector(vec):
    vec = np.array(vec, dtype=np.float32)
    norm = np.linalg.norm(vec)
    return vec / norm if norm != 0 else vec

# ---- Time Decay Function ----
def compute_time_decay(event_timestamp_str, current_timestamp_str, tau_hours=24):
    from datetime import datetime
    fmt = "%Y-%m-%d %H:%M:%S"
    try:
        t_event = datetime.strptime(event_timestamp_str, fmt)
        t_current = datetime.strptime(current_timestamp_str, fmt)
        delta_hours = (t_current - t_event).total_seconds() / 3600.0
        return np.exp(-delta_hours / tau_hours)
    except ValueError: # Handle cases where timestamp might be invalid
        return 0.1 # Default low recency

# ---- LLM-based Utility Functions ----

def gpt_summarize_dialogs(dialogs, client: OpenAIClient, model="gpt-4o-mini"):
    dialog_text = "\n".join([f"User: {d.get('user_input','')} Assistant: {d.get('agent_response','')}" for d in dialogs])
    messages = [
        {"role": "system", "content": prompts.SUMMARIZE_DIALOGS_SYSTEM_PROMPT},
        {"role": "user", "content": prompts.SUMMARIZE_DIALOGS_USER_PROMPT.format(dialog_text=dialog_text)}
    ]
    print("Calling LLM to generate topic summary...")
    return client.chat_completion(model=model, messages=messages)

def gpt_generate_multi_summary(text, client: OpenAIClient, model="gpt-4o-mini"):
    messages = [
        {"role": "system", "content": prompts.MULTI_SUMMARY_SYSTEM_PROMPT},
        {"role": "user", "content": prompts.MULTI_SUMMARY_USER_PROMPT.format(text=text)}
    ]
    print("Calling LLM to generate multi-topic summary...")
    response_text = client.chat_completion(model=model, messages=messages)
    try:
        summaries = json.loads(response_text)
    except json.JSONDecodeError:
        print(f"Warning: Could not parse multi-summary JSON: {response_text}")
        summaries = []
    return {"input": text, "summaries": summaries}

def extract_keywords_from_multi_summary(text, client: OpenAIClient, model="gpt-4o-mini"):
    """
    Extract keywords using multi-summary analysis instead of separate keyword extraction.
    This is more efficient as the multi-summary already includes keywords for each theme.
    """
    multi_summary_result = gpt_generate_multi_summary(text, client, model)
    all_keywords = []
    
    if multi_summary_result and multi_summary_result.get("summaries"):
        for summary_item in multi_summary_result["summaries"]:
            keywords = summary_item.get("keywords", [])
            all_keywords.extend(keywords)
    
    # Remove duplicates while preserving order
    seen = set()
    unique_keywords = []
    for keyword in all_keywords:
        if keyword not in seen:
            seen.add(keyword)
            unique_keywords.append(keyword)
    
    return unique_keywords

def gpt_user_profile_analysis(conversation_str: str, client: OpenAIClient, model="gpt-4o-mini", existing_user_profile="None"):
    """
    Analyze and update user personality profile from a conversation string.
    """
    messages = [
        {"role": "system", "content": prompts.PERSONALITY_ANALYSIS_SYSTEM_PROMPT},
        {"role": "user", "content": prompts.PERSONALITY_ANALYSIS_USER_PROMPT.format(
            conversation=conversation_str,
            existing_user_profile=existing_user_profile
        )}
    ]
    print("Calling LLM for user profile analysis and update...")
    result_text = client.chat_completion(model=model, messages=messages)
    try:
        return json.loads(result_text)
    except json.JSONDecodeError:
        print(f"Warning: User profile analysis did not return valid JSON. Content: {result_text}")
        return {"raw_text_profile": result_text}

def gpt_knowledge_extraction(conversation_str: str, client: OpenAIClient, model="gpt-4o-mini"):
    """Extract user private data and assistant knowledge from a conversation string"""
    messages = [
        {"role": "system", "content": prompts.KNOWLEDGE_EXTRACTION_SYSTEM_PROMPT},
        {"role": "user", "content": prompts.KNOWLEDGE_EXTRACTION_USER_PROMPT.format(
            conversation=conversation_str
        )}
    ]
    print("Calling LLM for knowledge extraction...")
    result_text = client.chat_completion(model=model, messages=messages)
    
    private_data = "None"
    assistant_knowledge = "None"

    try:
        if "【User Private Data】" in result_text:
            private_data_start = result_text.find("【User Private Data】") + len("【User Private Data】")
            if "【Assistant Knowledge】" in result_text:
                private_data_end = result_text.find("【Assistant Knowledge】")
                private_data = result_text[private_data_start:private_data_e
```

### Core Architecture Module: `memoryos-mcp/memoryos/utils.py`
```
import time
import uuid
import openai
import numpy as np
from sentence_transformers import SentenceTransformer
import json
import os
import inspect
from functools import wraps
try:
    from . import prompts # 尝试相对导入
except ImportError:
    import prompts # 回退到绝对导入
from openai import OpenAI
from concurrent.futures import ThreadPoolExecutor, as_completed
import threading

def clean_reasoning_model_output(text):
    """
    清理推理模型输出中的<think>标签
    适配推理模型（如o1系列）的输出格式
    """
    if not text:
        return text
    
    import re
    # 移除<think>...</think>标签及其内容
    cleaned_text = re.sub(r'<think>.*?</think>', '', text, flags=re.DOTALL)
    # 清理可能产生的多余空白行
    cleaned_text = re.sub(r'\n\s*\n\s*\n', '\n\n', cleaned_text)
    # 移除开头和结尾的空白
    cleaned_text = cleaned_text.strip()
    
    return cleaned_text

# ---- OpenAI Client ----
class OpenAIClient:
    def __init__(self, api_key, base_url=None, max_workers=5):
        self.api_key = api_key
        self.base_url = base_url if base_url else "https://api.openai.com/v1"
        # The openai library looks for OPENAI_API_KEY and OPENAI_BASE_URL env vars by default
        # or they can be passed directly to the client.
        # For simplicity and explicit control, we'll pass them to the client constructor.
        self.client = OpenAI(api_key=self.api_key, base_url=self.base_url)
        self.executor = ThreadPoolExecutor(max_workers=max_workers)
        self._lock = threading.Lock()

    def chat_completion(self, model, messages, temperature=0.7, max_tokens=2000):
        print(f"Calling OpenAI API. Model: {model}")
        try:
            response = self.client.chat.completions.create(
                model=model,
                messages=messages,
                temperature=temperature,
                max_tokens=max_tokens
            )
            raw_content = response.choices[0].message.content.strip()
            # 自动清理推理模型的<think>标签
            cleaned_content = clean_reasoning_model_output(raw_content)
            return cleaned_content
        except Exception as e:
            print(f"Error calling OpenAI API: {e}")
            # Fallback or error handling
            return "Error: Could not get response from LLM."

    def chat_completion_async(self, model, messages, temperature=0.7, max_tokens=2000):
        """异步版本的chat_completion"""
        return self.executor.submit(self.chat_completion, model, messages, temperature, max_tokens)

    def batch_chat_completion(self, requests):
        """
        并行处理多个LLM请求
        requests: List of dict with keys: model, messages, temperature, max_tokens
        """
        futures = []
        for req in requests:
            future = self.chat_completion_async(
                model=req.get("model", "gpt-4o-mini"),
                messages=req["messages"],
                temperature=req.get("temperature", 0.7),
                max_tokens=req.get("max_tokens", 2000)
            )
            futures.append(future)
        
        results = []
        for future in as_completed(futures):
            try:
                result = future.result()
                results.append(result)
            except Exception as e:
                print(f"Error in batch completion: {e}")
                results.append("Error: Could not get response from LLM.")
        
        return results

    def shutdown(self):
        """关闭线程池"""
        self.executor.shutdown(wait=True)

# ---- Parallel Processing Utilities ----
def run_parallel_tasks(tasks, max_workers=3):
    """
    并行执行任务列表
    tasks: List of callable functions
    """
    with ThreadPoolExecutor(max_workers=max_workers) as executor:
        futures = [executor.submit(task) for task in tasks]
        results = []
        for future in as_completed(futures):
            try:
                result = future.result()
                results.append(result)
            except Exception as e:
                print(f"Error in parallel task: {e}")
                results.append(None)
        return results

# ---- Basic Utilities ----
def get_timestamp():
    return time.strftime("%Y-%m-%d %H:%M:%S", time.localtime())

def generate_id(prefix="id"):
    return f"{prefix}_{uuid.uuid4().hex[:8]}"

def ensure_directory_exists(path):
    os.makedirs(os.path.dirname(path), exist_ok=True)

# ---- Embedding Utilities ----
_model_cache = {}
_embedding_cache = {}  # 添加embedding缓存

def _get_valid_kwargs(func, kwargs):
    """Helper to filter kwargs for a given function's signature."""
    try:
        sig = inspect.signature(func)
        param_keys = set(sig.parameters.keys())
        return {k: v for k, v in kwargs.items() if k in param_keys}
    except (ValueError, TypeError):
        # Fallback for functions/methods where signature inspection is not straightforward
        return kwargs

def get_embedding(text, model_name="all-MiniLM-L6-v2", use_cache=True, **kwargs):
    """
    获取文本的embedding向量。
    支持多种主流模型，能自动适应不同库的调用方式。
    - SentenceTransformer模型: e.g., 'all-MiniLM-L6-v2', 'Qwen/Qwen3-Embedding-0.6B'
    - FlagEmbedding模型: e.g., 'BAAI/bge-m3'

    :param text: 输入文本。
    :param model_name: Hugging Face上的模型名称。
    :param use_cache: 是否使用内存缓存。
    :param kwargs: 传递给模型构造函数或encode方法的额外参数。
                   - for Qwen: `model_kwargs`, `tokenizer_kwargs`, `prompt_name="query"`
                   - for BGE-M3: `use_fp16=True`, `max_length=8192`
    :return: 文本的embedding向量 (numpy array)。
    """
    model_config_key = json.dumps({"model_name": model_name, **kwargs}, sort_keys=True)
    
    if use_cache:
        cache_key = f"{model_config_key}::{hash(text)}"
        if cache_key in _embedding_cache:
            return _embedding_cache[cache_key]
    
    # --- Model Loading ---
    model_init_key = json.dumps({"model_name": model_name, **{k:v for k,v in kwargs.items() if k not in ['batch_size', 'max_length']}}, sort_keys=True)
    if model_init_key not in _model_cache:
        print(f"Loading model: {model_name}...")
        if 'bge-m3' in model_name.lower():
            try:
                from FlagEmbedding import BGEM3FlagModel
                init_kwargs = _get_valid_kwargs(BGEM3FlagModel.__init__, kwargs)
                print(f"-> Using BGEM3FlagModel with init kwargs: {init_kwargs}")
                _model_cache[model_init_key] = BGEM3FlagModel(model_name, **init_kwargs)
            except ImportError:
                raise ImportError("Please install FlagEmbedding: 'pip install -U FlagEmbedding' to use bge-m3 model.")
        else: # Default handler for SentenceTransformer-based models (like Qwen, all-MiniLM, etc.)
            try:
                from sentence_transformers import SentenceTransformer
                init_kwargs = _get_valid_kwargs(SentenceTransformer.__init__, kwargs)
                print(f"-> Using SentenceTransformer with init kwargs: {init_kwargs}")
                _model_cache[model_init_key] = SentenceTransformer(model_name, **init_kwargs)
            except ImportError:
                raise ImportError("Please install sentence-transformers: 'pip install -U sentence-transformers' to use this model.")
            
    model = _model_cache[model_init_key]
    
    # --- Encoding ---
    embedding = None
    if 'bge-m3' in model_name.lower():
        encode_kwargs = _get_valid_kwargs(model.encode, kwargs)
        print(f"-> Encoding with BGEM3FlagModel using kwargs: {encode_kwargs}")
        result = model.encode([text], **encode_kwargs)
        embedding = result['dense_vecs'][0]
    else: # Default to SentenceTransformer-based models
        encode_kwargs = _get_valid_kwargs(model.encode, kwargs)
        print(f"-> Encoding with SentenceTransformer using kwargs: {encode_kwargs}")
        embedding = model.encode([text], **encode_kwargs)[0]

    if use_cache:
        cache_key = f"{model_config_key}::{hash(text)}"
        _embedding_cache[cache_key] = embedding
        if len(_embedding_cache) > 10000:
            keys_to_remove = list(_embedding_cache.keys())[:1000]
            for key in keys_to_remove:
                try:
                    del _embedding_cache[key]
                except KeyError:
                    pass
            print("Cleaned embedding cache to prevent memory overflow")
    
    return embedding


def clear_embedding_cache():
    """清空embedding缓存"""
    global _embedding_cache
    _embedding_cache.clear()
    print("Embedding cache cleared")

def normalize_vector(vec):
    vec = np.array(vec, dtype=np.float32)
    norm = np.linalg.norm(vec)
    if norm == 0:
        return vec
    return vec / norm

# ---- Time Decay Function ----
def compute_time_decay(event_timestamp_str, current_timestamp_str, tau_hours=24):
    from datetime import datetime
    fmt = "%Y-%m-%d %H:%M:%S"
    try:
        t_event = datetime.strptime(event_timestamp_str, fmt)
        t_current = datetime.strptime(current_timestamp_str, fmt)
        delta_hours = (t_current - t_event).total_seconds() / 3600.0
        return np.exp(-delta_hours / tau_hours)
    except ValueError: # Handle cases where timestamp might be invalid
        return 0.1 # Default low recency


# ---- LLM-based Utility Functions ----

def gpt_summarize_dialogs(dialogs, client: OpenAIClient, model="gpt-4o-mini"):
    dialog_text = "\n".join([f"User: {d.get('user_input','')} Assistant: {d.get('agent_response','')}" for d in dialogs])
    messages = [
        {"role": "system", "content": prompts.SUMMARIZE_DIALOGS_SYSTEM_PROMPT},
        {"role": "user", "content": prompts.SUMMARIZE_DIALOGS_USER_PROMPT.format(dialog_text=dialog_text)}
    ]
    print("Calling LLM to generate topic summary...")
    return client.chat_completion(model=model, messages=messages)

def gpt_generate_multi_summary(text, client: OpenAIClient, model="gpt-4o-mini"):
    messages = [
        {"role": "system", "content": prompts.MULTI_SUMMARY_SYSTEM_PROMPT},
        {"role": "user", "content": prompts.MULTI_SUMMARY_USER_PROMPT.format(text=text)}
    ]
    print("Calling LLM to generate multi-topic summary...")
 
```

### Core Architecture Module: `memoryos-playground/utils.py`
```
import time
import uuid
import openai
import numpy as np
from sentence_transformers import SentenceTransformer
import json
import os
import inspect
from functools import wraps
try:
    from . import prompts # 尝试相对导入
except ImportError:
    import prompts # 回退到绝对导入
from openai import OpenAI
from concurrent.futures import ThreadPoolExecutor, as_completed
import threading

def clean_reasoning_model_output(text):
    """
    清理推理模型输出中的<think>标签
    适配推理模型（如o1系列）的输出格式
    """
    if not text:
        return text
    
    import re
    # 移除<think>...</think>标签及其内容
    cleaned_text = re.sub(r'<think>.*?</think>', '', text, flags=re.DOTALL)
    # 清理可能产生的多余空白行
    cleaned_text = re.sub(r'\n\s*\n\s*\n', '\n\n', cleaned_text)
    # 移除开头和结尾的空白
    cleaned_text = cleaned_text.strip()
    
    return cleaned_text

# ---- OpenAI Client ----
class OpenAIClient:
    def __init__(self, api_key, base_url=None, max_workers=5):
        self.api_key = api_key
        self.base_url = base_url if base_url else "https://api.openai.com/v1"
        # The openai library looks for OPENAI_API_KEY and OPENAI_BASE_URL env vars by default
        # or they can be passed directly to the client.
        # For simplicity and explicit control, we'll pass them to the client constructor.
        self.client = OpenAI(api_key=self.api_key, base_url=self.base_url)
        self.executor = ThreadPoolExecutor(max_workers=max_workers)
        self._lock = threading.Lock()

    def chat_completion(self, model, messages, temperature=0.7, max_tokens=2000):
        print(f"Calling OpenAI API. Model: {model}")
        try:
            response = self.client.chat.completions.create(
                model=model,
                messages=messages,
                temperature=temperature,
                max_tokens=max_tokens
            )
            raw_content = response.choices[0].message.content.strip()
            # 自动清理推理模型的<think>标签
            cleaned_content = clean_reasoning_model_output(raw_content)
            return cleaned_content
        except Exception as e:
            print(f"Error calling OpenAI API: {e}")
            # Fallback or error handling
            return "Error: Could not get response from LLM."

    def chat_completion_async(self, model, messages, temperature=0.7, max_tokens=2000):
        """异步版本的chat_completion"""
        return self.executor.submit(self.chat_completion, model, messages, temperature, max_tokens)

    def batch_chat_completion(self, requests):
        """
        并行处理多个LLM请求
        requests: List of dict with keys: model, messages, temperature, max_tokens
        """
        futures = []
        for req in requests:
            future = self.chat_completion_async(
                model=req.get("model", "gpt-4o-mini"),
                messages=req["messages"],
                temperature=req.get("temperature", 0.7),
                max_tokens=req.get("max_tokens", 2000)
            )
            futures.append(future)
        
        results = []
        for future in as_completed(futures):
            try:
                result = future.result()
                results.append(result)
            except Exception as e:
                print(f"Error in batch completion: {e}")
                results.append("Error: Could not get response from LLM.")
        
        return results

    def shutdown(self):
        """关闭线程池"""
        self.executor.shutdown(wait=True)

# ---- Parallel Processing Utilities ----
def run_parallel_tasks(tasks, max_workers=3):
    """
    并行执行任务列表
    tasks: List of callable functions
    """
    with ThreadPoolExecutor(max_workers=max_workers) as executor:
        futures = [executor.submit(task) for task in tasks]
        results = []
        for future in as_completed(futures):
            try:
                result = future.result()
                results.append(result)
            except Exception as e:
                print(f"Error in parallel task: {e}")
                results.append(None)
        return results

# ---- Basic Utilities ----
def get_timestamp():
    return time.strftime("%Y-%m-%d %H:%M:%S", time.localtime())

def generate_id(prefix="id"):
    return f"{prefix}_{uuid.uuid4().hex[:8]}"

def ensure_directory_exists(path):
    os.makedirs(os.path.dirname(path), exist_ok=True)

# ---- Embedding Utilities ----
_model_cache = {}
_embedding_cache = {}  # 添加embedding缓存

def _get_valid_kwargs(func, kwargs):
    """Helper to filter kwargs for a given function's signature."""
    try:
        sig = inspect.signature(func)
        param_keys = set(sig.parameters.keys())
        return {k: v for k, v in kwargs.items() if k in param_keys}
    except (ValueError, TypeError):
        # Fallback for functions/methods where signature inspection is not straightforward
        return kwargs

def get_embedding(text, model_name="all-MiniLM-L6-v2", use_cache=True, **kwargs):
    """
    获取文本的embedding向量。
    支持多种主流模型，能自动适应不同库的调用方式。
    - SentenceTransformer模型: e.g., 'all-MiniLM-L6-v2', 'Qwen/Qwen3-Embedding-0.6B'
    - FlagEmbedding模型: e.g., 'BAAI/bge-m3'

    :param text: 输入文本。
    :param model_name: Hugging Face上的模型名称。
    :param use_cache: 是否使用内存缓存。
    :param kwargs: 传递给模型构造函数或encode方法的额外参数。
                   - for Qwen: `model_kwargs`, `tokenizer_kwargs`, `prompt_name="query"`
                   - for BGE-M3: `use_fp16=True`, `max_length=8192`
    :return: 文本的embedding向量 (numpy array)。
    """
    model_config_key = json.dumps({"model_name": model_name, **kwargs}, sort_keys=True)
    
    if use_cache:
        cache_key = f"{model_config_key}::{hash(text)}"
        if cache_key in _embedding_cache:
            return _embedding_cache[cache_key]
    
    # --- Model Loading ---
    model_init_key = json.dumps({"model_name": model_name, **{k:v for k,v in kwargs.items() if k not in ['batch_size', 'max_length']}}, sort_keys=True)
    if model_init_key not in _model_cache:
        print(f"Loading model: {model_name}...")
        if 'bge-m3' in model_name.lower():
            try:
                from FlagEmbedding import BGEM3FlagModel
                init_kwargs = _get_valid_kwargs(BGEM3FlagModel.__init__, kwargs)
                print(f"-> Using BGEM3FlagModel with init kwargs: {init_kwargs}")
                _model_cache[model_init_key] = BGEM3FlagModel(model_name, **init_kwargs)
            except ImportError:
                raise ImportError("Please install FlagEmbedding: 'pip install -U FlagEmbedding' to use bge-m3 model.")
        else: # Default handler for SentenceTransformer-based models (like Qwen, all-MiniLM, etc.)
            try:
                from sentence_transformers import SentenceTransformer
                init_kwargs = _get_valid_kwargs(SentenceTransformer.__init__, kwargs)
                print(f"-> Using SentenceTransformer with init kwargs: {init_kwargs}")
                _model_cache[model_init_key] = SentenceTransformer(model_name, **init_kwargs)
            except ImportError:
                raise ImportError("Please install sentence-transformers: 'pip install -U sentence-transformers' to use this model.")
            
    model = _model_cache[model_init_key]
    
    # --- Encoding ---
    embedding = None
    if 'bge-m3' in model_name.lower():
        encode_kwargs = _get_valid_kwargs(model.encode, kwargs)
        print(f"-> Encoding with BGEM3FlagModel using kwargs: {encode_kwargs}")
        result = model.encode([text], **encode_kwargs)
        embedding = result['dense_vecs'][0]
    else: # Default to SentenceTransformer-based models
        encode_kwargs = _get_valid_kwargs(model.encode, kwargs)
        print(f"-> Encoding with SentenceTransformer using kwargs: {encode_kwargs}")
        embedding = model.encode([text], **encode_kwargs)[0]

    if use_cache:
        cache_key = f"{model_config_key}::{hash(text)}"
        _embedding_cache[cache_key] = embedding
        if len(_embedding_cache) > 10000:
            keys_to_remove = list(_embedding_cache.keys())[:1000]
            for key in keys_to_remove:
                try:
                    del _embedding_cache[key]
                except KeyError:
                    pass
            print("Cleaned embedding cache to prevent memory overflow")
    
    return embedding


def clear_embedding_cache():
    """清空embedding缓存"""
    global _embedding_cache
    _embedding_cache.clear()
    print("Embedding cache cleared")

def normalize_vector(vec):
    vec = np.array(vec, dtype=np.float32)
    norm = np.linalg.norm(vec)
    if norm == 0:
        return vec
    return vec / norm

# ---- Time Decay Function ----
def compute_time_decay(event_timestamp_str, current_timestamp_str, tau_hours=24):
    from datetime import datetime
    fmt = "%Y-%m-%d %H:%M:%S"
    try:
        t_event = datetime.strptime(event_timestamp_str, fmt)
        t_current = datetime.strptime(current_timestamp_str, fmt)
        delta_hours = (t_current - t_event).total_seconds() / 3600.0
        return np.exp(-delta_hours / tau_hours)
    except ValueError: # Handle cases where timestamp might be invalid
        return 0.1 # Default low recency


# ---- LLM-based Utility Functions ----

def gpt_summarize_dialogs(dialogs, client: OpenAIClient, model="gpt-4o-mini"):
    dialog_text = "\n".join([f"User: {d.get('user_input','')} Assistant: {d.get('agent_response','')}" for d in dialogs])
    messages = [
        {"role": "system", "content": prompts.SUMMARIZE_DIALOGS_SYSTEM_PROMPT},
        {"role": "user", "content": prompts.SUMMARIZE_DIALOGS_USER_PROMPT.format(dialog_text=dialog_text)}
    ]
    print("Calling LLM to generate topic summary...")
    return client.chat_completion(model=model, messages=messages)

def gpt_generate_multi_summary(text, client: OpenAIClient, model="gpt-4o-mini"):
    messages = [
        {"role": "system", "content": prompts.MULTI_SUMMARY_SYSTEM_PROMPT},
        {"role": "user", "content": prompts.MULTI_SUMMARY_USER_PROMPT.format(text=text)}
    ]
    print("Calling LLM to generate multi-topic summary...")
 
```

### Core Architecture Module: `memoryos-pypi/utils.py`
```
import time
import uuid
import openai
import numpy as np
from sentence_transformers import SentenceTransformer
import json
import os
import inspect
from functools import wraps
try:
    from . import prompts # 尝试相对导入
except ImportError:
    import prompts # 回退到绝对导入
from openai import OpenAI
from concurrent.futures import ThreadPoolExecutor, as_completed
import threading

def clean_reasoning_model_output(text):
    """
    清理推理模型输出中的<think>标签
    适配推理模型（如o1系列）的输出格式
    """
    if not text:
        return text
    
    import re
    # 移除<think>...</think>标签及其内容
    cleaned_text = re.sub(r'<think>.*?</think>', '', text, flags=re.DOTALL)
    # 清理可能产生的多余空白行
    cleaned_text = re.sub(r'\n\s*\n\s*\n', '\n\n', cleaned_text)
    # 移除开头和结尾的空白
    cleaned_text = cleaned_text.strip()
    
    return cleaned_text

# ---- OpenAI Client ----
class OpenAIClient:
    def __init__(self, api_key, base_url=None, max_workers=5):
        self.api_key = api_key
        self.base_url = base_url if base_url else "https://api.openai.com/v1"
        # The openai library looks for OPENAI_API_KEY and OPENAI_BASE_URL env vars by default
        # or they can be passed directly to the client.
        # For simplicity and explicit control, we'll pass them to the client constructor.
        self.client = OpenAI(api_key=self.api_key, base_url=self.base_url)
        self.executor = ThreadPoolExecutor(max_workers=max_workers)
        self._lock = threading.Lock()

    def chat_completion(self, model, messages, temperature=0.7, max_tokens=2000):
        print(f"Calling OpenAI API. Model: {model}")
        try:
            response = self.client.chat.completions.create(
                model=model,
                messages=messages,
                temperature=temperature,
                max_tokens=max_tokens
            )
            raw_content = response.choices[0].message.content.strip()
            # 自动清理推理模型的<think>标签
            cleaned_content = clean_reasoning_model_output(raw_content)
            return cleaned_content
        except Exception as e:
            print(f"Error calling OpenAI API: {e}")
            # Fallback or error handling
            return "Error: Could not get response from LLM."

    def chat_completion_async(self, model, messages, temperature=0.7, max_tokens=2000):
        """异步版本的chat_completion"""
        return self.executor.submit(self.chat_completion, model, messages, temperature, max_tokens)

    def batch_chat_completion(self, requests):
        """
        并行处理多个LLM请求
        requests: List of dict with keys: model, messages, temperature, max_tokens
        """
        futures = []
        for req in requests:
            future = self.chat_completion_async(
                model=req.get("model", "gpt-4o-mini"),
                messages=req["messages"],
                temperature=req.get("temperature", 0.7),
                max_tokens=req.get("max_tokens", 2000)
            )
            futures.append(future)
        
        results = []
        for future in as_completed(futures):
            try:
                result = future.result()
                results.append(result)
            except Exception as e:
                print(f"Error in batch completion: {e}")
                results.append("Error: Could not get response from LLM.")
        
        return results

    def shutdown(self):
        """关闭线程池"""
        self.executor.shutdown(wait=True)

# ---- Parallel Processing Utilities ----
def run_parallel_tasks(tasks, max_workers=3):
    """
    并行执行任务列表
    tasks: List of callable functions
    """
    with ThreadPoolExecutor(max_workers=max_workers) as executor:
        futures = [executor.submit(task) for task in tasks]
        results = []
        for future in as_completed(futures):
            try:
                result = future.result()
                results.append(result)
            except Exception as e:
                print(f"Error in parallel task: {e}")
                results.append(None)
        return results

# ---- Basic Utilities ----
def get_timestamp():
    return time.strftime("%Y-%m-%d %H:%M:%S", time.localtime())

def generate_id(prefix="id"):
    return f"{prefix}_{uuid.uuid4().hex[:8]}"

def ensure_directory_exists(path):
    os.makedirs(os.path.dirname(path), exist_ok=True)

# ---- Embedding Utilities ----
_model_cache = {}
_embedding_cache = {}  # 添加embedding缓存

def _get_valid_kwargs(func, kwargs):
    """Helper to filter kwargs for a given function's signature."""
    try:
        sig = inspect.signature(func)
        param_keys = set(sig.parameters.keys())
        return {k: v for k, v in kwargs.items() if k in param_keys}
    except (ValueError, TypeError):
        # Fallback for functions/methods where signature inspection is not straightforward
        return kwargs

def get_embedding(text, model_name="all-MiniLM-L6-v2", use_cache=True, **kwargs):
    """
    获取文本的embedding向量。
    支持多种主流模型，能自动适应不同库的调用方式。
    - SentenceTransformer模型: e.g., 'all-MiniLM-L6-v2', 'Qwen/Qwen3-Embedding-0.6B'
    - FlagEmbedding模型: e.g., 'BAAI/bge-m3'

    :param text: 输入文本。
    :param model_name: Hugging Face上的模型名称。
    :param use_cache: 是否使用内存缓存。
    :param kwargs: 传递给模型构造函数或encode方法的额外参数。
                   - for Qwen: `model_kwargs`, `tokenizer_kwargs`, `prompt_name="query"`
                   - for BGE-M3: `use_fp16=True`, `max_length=8192`
    :return: 文本的embedding向量 (numpy array)。
    """
    model_config_key = json.dumps({"model_name": model_name, **kwargs}, sort_keys=True)
    
    if use_cache:
        cache_key = f"{model_config_key}::{hash(text)}"
        if cache_key in _embedding_cache:
            return _embedding_cache[cache_key]
    
    # --- Model Loading ---
    model_init_key = json.dumps({"model_name": model_name, **{k:v for k,v in kwargs.items() if k not in ['batch_size', 'max_length']}}, sort_keys=True)
    if model_init_key not in _model_cache:
        print(f"Loading model: {model_name}...")
        if 'bge-m3' in model_name.lower():
            try:
                from FlagEmbedding import BGEM3FlagModel
                init_kwargs = _get_valid_kwargs(BGEM3FlagModel.__init__, kwargs)
                print(f"-> Using BGEM3FlagModel with init kwargs: {init_kwargs}")
                _model_cache[model_init_key] = BGEM3FlagModel(model_name, **init_kwargs)
            except ImportError:
                raise ImportError("Please install FlagEmbedding: 'pip install -U FlagEmbedding' to use bge-m3 model.")
        else: # Default handler for SentenceTransformer-based models (like Qwen, all-MiniLM, etc.)
            try:
                from sentence_transformers import SentenceTransformer
                init_kwargs = _get_valid_kwargs(SentenceTransformer.__init__, kwargs)
                print(f"-> Using SentenceTransformer with init kwargs: {init_kwargs}")
                _model_cache[model_init_key] = SentenceTransformer(model_name, **init_kwargs)
            except ImportError:
                raise ImportError("Please install sentence-transformers: 'pip install -U sentence-transformers' to use this model.")
            
    model = _model_cache[model_init_key]
    
    # --- Encoding ---
    embedding = None
    if 'bge-m3' in model_name.lower():
        encode_kwargs = _get_valid_kwargs(model.encode, kwargs)
        print(f"-> Encoding with BGEM3FlagModel using kwargs: {encode_kwargs}")
        result = model.encode([text], **encode_kwargs)
        embedding = result['dense_vecs'][0]
    else: # Default to SentenceTransformer-based models
        encode_kwargs = _get_valid_kwargs(model.encode, kwargs)
        print(f"-> Encoding with SentenceTransformer using kwargs: {encode_kwargs}")
        embedding = model.encode([text], **encode_kwargs)[0]

    if use_cache:
        cache_key = f"{model_config_key}::{hash(text)}"
        _embedding_cache[cache_key] = embedding
        if len(_embedding_cache) > 10000:
            keys_to_remove = list(_embedding_cache.keys())[:1000]
            for key in keys_to_remove:
                try:
                    del _embedding_cache[key]
                except KeyError:
                    pass
            print("Cleaned embedding cache to prevent memory overflow")
    
    return embedding


def clear_embedding_cache():
    """清空embedding缓存"""
    global _embedding_cache
    _embedding_cache.clear()
    print("Embedding cache cleared")

def normalize_vector(vec):
    vec = np.array(vec, dtype=np.float32)
    norm = np.linalg.norm(vec)
    if norm == 0:
        return vec
    return vec / norm

# ---- Time Decay Function ----
def compute_time_decay(event_timestamp_str, current_timestamp_str, tau_hours=24):
    from datetime import datetime
    fmt = "%Y-%m-%d %H:%M:%S"
    try:
        t_event = datetime.strptime(event_timestamp_str, fmt)
        t_current = datetime.strptime(current_timestamp_str, fmt)
        delta_hours = (t_current - t_event).total_seconds() / 3600.0
        return np.exp(-delta_hours / tau_hours)
    except ValueError: # Handle cases where timestamp might be invalid
        return 0.1 # Default low recency


# ---- LLM-based Utility Functions ----

def gpt_summarize_dialogs(dialogs, client: OpenAIClient, model="gpt-4o-mini"):
    dialog_text = "\n".join([f"User: {d.get('user_input','')} Assistant: {d.get('agent_response','')}" for d in dialogs])
    messages = [
        {"role": "system", "content": prompts.SUMMARIZE_DIALOGS_SYSTEM_PROMPT},
        {"role": "user", "content": prompts.SUMMARIZE_DIALOGS_USER_PROMPT.format(dialog_text=dialog_text)}
    ]
    print("Calling LLM to generate topic summary...")
    return client.chat_completion(model=model, messages=messages)

def gpt_generate_multi_summary(text, client: OpenAIClient, model="gpt-4o-mini"):
    messages = [
        {"role": "system", "content": prompts.MULTI_SUMMARY_SYSTEM_PROMPT},
        {"role": "user", "content": prompts.MULTI_SUMMARY_USER_PROMPT.format(text=text)}
    ]
    print("Calling LLM to generate multi-topic summary...")
 
```

### Core Architecture Module: `eval/dynamic_update.py`
```
from utils import gpt_summarize, generate_id, get_timestamp, gpt_update_profile, gpt_generate_multi_summary

class DynamicUpdate:
    def __init__(self, short_term_memory, mid_term_memory, long_term_memory, topic_similarity_threshold=0.8, client=None):
        self.short_term_memory = short_term_memory
        self.mid_term_memory = mid_term_memory
        self.long_term_memory = long_term_memory
        self.topic_similarity_threshold = topic_similarity_threshold
        self.client = client
        self.last_evicted_page = None

    def _is_conversation_continuing(self, previous_page, current_page):
        if not previous_page:
            return False
            
        prompt = """Determine if these two conversation pages are continuous (true continuation without topic shift).
Return ONLY "true" or "false".

Previous Page:
User: {prev_user}
Assistant: {prev_agent}

Current Page:
User: {curr_user}
Assistant: {curr_agent}

Continuous?""".format(
            prev_user=previous_page.get("user_input", ""),
            prev_agent=previous_page.get("agent_response", ""),
            curr_user=current_page.get("user_input", ""),
            curr_agent=current_page.get("agent_response", "")
        )
        
        messages = [
            {"role": "system", "content": "You are a conversation continuity detector. Return ONLY 'true' or 'false'."},
            {"role": "user", "content": prompt}
        ]
        
        response = self.client.chat_completion(
            model="gpt-4o-mini",
            messages=messages,
            temperature=0.0,
            max_tokens=10
        )
        
        return response.strip().lower() == "true"

    def _generate_meta_info(self, last_page_meta, current_page):
        """
        基于上一页的meta-info和当前页内容生成新的meta-info
        :param last_page_meta: 上一页的meta-info内容
        :param current_page: 当前页的对话内容
        :return: 更新后的meta-info
        """
        current_conversation = f"User: {current_page.get('user_input', '')}\nAssistant: {current_page.get('agent_response', '')}"
        
        prompt = """Update the conversation meta-summary by incorporating the new dialogue while maintaining continuity.
        
    Guidelines:
    1. Start from the previous meta-summary (if exists)
    2. Add/update information based on the new dialogue
    3. Keep it concise (1-2 sentences max)
    4. Maintain context coherence

    Previous Meta-summary: {last_meta}
    New Dialogue:
    {new_dialogue}

    Updated Meta-summary:""".format(
            last_meta=last_page_meta if last_page_meta else "None",
            new_dialogue=current_conversation
        )
        
        messages = [
            {"role": "system", "content": """You are a conversation meta-summary updater. Your task is to:
    1. Preserve relevant context from previous meta-summary
    2. Integrate new information from current dialogue
    3. Output ONLY the updated summary (no explanations)"""},
            {"role": "user", "content": prompt}
        ]
        
        return self.client.chat_completion(
            model="gpt-4o-mini",
            messages=messages,
            temperature=0.3,
            max_tokens=100
        ).strip()

    def _update_connected_pages(self, page_id, new_meta_info):
        connected_pages = []
        current_page = self.mid_term_memory.get_page_by_id(page_id)
        
        if not current_page:
            return
            
        prev_page_id = current_page.get("pre_page")
        while prev_page_id:
            prev_page = self.mid_term_memory.get_page_by_id(prev_page_id)
            if prev_page:
                connected_pages.insert(0, prev_page)
                prev_page_id = prev_page.get("pre_page")
            else:
                break
                
        next_page_id = current_page.get("next_page")
        while next_page_id:
            next_page = self.mid_term_memory.get_page_by_id(next_page_id)
            if next_page:
                connected_pages.append(next_page)
                next_page_id = next_page.get("next_page")
            else:
                break
                
        for page in connected_pages:
            page["meta_info"] = new_meta_info
            self.mid_term_memory.update_page_connections(page.get("pre_page"), page.get("next_page"))

    def update_short_term(self, message):
        self.short_term_memory.add_qa_pair(message)

    def bulk_evict_and_update_mid_term(self):
        evicted = []
        # 1. 从短期记忆移除内容（保持不变）
        while self.short_term_memory.is_full():
            msg = self.short_term_memory.pop_oldest()
            if msg and msg.get("user_input") and msg.get("agent_response"):
                evicted.append(msg)
        
        if not evicted:
            return
        
        # 2. 先创建基础页面结构并进行连续性处理
        pages = []
        for qa in evicted:
            page = {
                "page_id": generate_id("page"),
                "user_input": qa.get("user_input", ""),
                "agent_response": qa.get("agent_response", ""),
                "timestamp": qa.get("timestamp"),
                "preloaded": False,
                "analyzed": False,
                "pre_page": None,
                "next_page": None,
                "meta_info": None
            }
            
            # 连续性判断
            is_continuous = self._is_conversation_continuing(self.last_evicted_page, page)
            if is_continuous and self.last_evicted_page:
                page["pre_page"] = self.last_evicted_page["page_id"]
                self.last_evicted_page["next_page"] = page["page_id"]
                
                # 更新元信息
                last_meta = self.last_evicted_page.get("meta_info")
                new_meta_info = self._generate_meta_info(last_meta, page)
                page["meta_info"] = new_meta_info
                self._update_connected_pages(page["pre_page"], new_meta_info)
            else:
                page["meta_info"] = self._generate_meta_info(None, page)
            
            pages.append(page)
            self.last_evicted_page = page
        
        # 3. 将所有用户输入拼接用于主题分析
        input_text = "\n".join([f"User: {page.get('user_input','')}\n" for page in pages])
        print("动态更新：调用 GPT 生成多子主题摘要...")
        multi_summary = gpt_generate_multi_summary(input_text, self.client)
        
        # 4. 按主题分组插入中期记忆
        for summary_dict in multi_summary.get("summaries", []):
            sub_summary = summary_dict.get("content", "")
            sub_key_words = summary_dict.get("keywords", [])
            
            print(f"动态更新：处理子主题【{summary_dict.get('theme','')}】，插入中期记忆...")
            self.mid_term_memory.insert_pages_into_session(
                sub_summary, 
                sub_key_words, 
                pages,  # 传入已经处理好的完整pages
                self.topic_similarity_threshold
            )

    def update_long_term(self, user_id, new_profile_data, knowledge_text):
        print("动态更新：更新长期记忆中的用户画像和私有数据...")
        self.long_term_memory.update_user_profile(user_id, new_profile_data)
        self.long_term_memory.add_knowledge(knowledge_text)
```

### Core Architecture Module: `eval/evalution_loco.py`
```
import json
import re
from typing import List, Dict
from collections import defaultdict
import statistics

def simple_tokenize(text: str) -> List[str]:
    """Simple tokenization function."""
    if not text:
        return []
    
    # Convert to string if not already
    text = str(text).lower()
    # Remove punctuation and split by whitespace using regex (正确的方法)
    tokens = re.findall(r'\b\w+\b', text)
    return tokens

def calculate_f1(prediction: str, reference: str) -> float:
    """Calculate F1 score for prediction against reference."""
    # Tokenize both prediction and reference
    pred_tokens = set(simple_tokenize(prediction))
    ref_tokens = set(simple_tokenize(reference))
    
    # Calculate intersection
    common_tokens = pred_tokens & ref_tokens
    
    # Calculate precision and recall
    precision = len(common_tokens) / len(pred_tokens) if len(pred_tokens) > 0 else 0
    recall = len(common_tokens) / len(ref_tokens) if len(ref_tokens) > 0 else 0
    
    # Calculate F1 score
    if precision + recall > 0:
        f1 = 2 * (precision * recall) / (precision + recall)
    else:
        f1 = 0
    return f1

def load_data(file_path: str) -> List[Dict]:
    """Load data from a JSON file."""
    with open(file_path, 'r', encoding='utf-8') as file:
        data = json.load(file)
    return data

def main(file_path: str):
    """Main function to calculate average F1 scores per category."""
    # Load data from file
    data = load_data(file_path)
    
    # Initialize category dictionary
    category_f1 = defaultdict(list)
    
    # Calculate F1 scores for each sample
    for sample in data:
        category = sample['category']
        system_answer = sample['system_answer']
        original_answer = sample['original_answer']
        
        # Calculate F1 score
        f1 = calculate_f1(system_answer, original_answer)
        
        # Append F1 score to the corresponding category
        category_f1[category].append(f1)
    
    # Calculate and print average F1 scores for each category
    for category, f1_scores in category_f1.items():
        avg_f1 = statistics.mean(f1_scores)
        print(f"Category {category}: Average F1 Score = {avg_f1:.4f}")

if __name__ == "__main__":
    file_path = "all_loco_results.json"  # 使用main_loco_parse.py生成的文件
    main(file_path)
```

### Core Architecture Module: `eval/long_term_memory.py`
```
import json
import numpy as np
from utils import get_timestamp, get_embedding, normalize_vector

class LongTermMemory:
    def __init__(self, file_path="long_term.json"):
        self.file_path = file_path
        self.user_profiles = {}
        self.knowledge_base = []
        self.assistant_knowledge = []
        self.load()

    def update_user_profile(self, user_id, new_data, merge=False):
        """
        更新用户画像
        :param user_id: 用户ID
        :param new_data: 新数据
        :param merge: 是否合并到现有数据 (True) 或覆盖 (False)
        """
        if merge and user_id in self.user_profiles:
            current_data = self.user_profiles[user_id]["data"]
            if isinstance(current_data, str) and isinstance(new_data, str):
                # 如果是文本格式的画像，保留原有数据并追加新数据
                updated_data = f"{current_data}\n\n--- Updated ---\n{new_data}"
            else:
                updated_data = new_data  # 如果不是字符串，直接覆盖(需要更复杂的合并逻辑)
        else:
            updated_data = new_data
        
        self.user_profiles[user_id] = {
            "data": updated_data,
            "last_updated": get_timestamp()
        }
        print("长期记忆：更新用户画像。")
        self.save()
    def add_assistant_knowledge(self, knowledge_text):
        """
        添加助手相关的知识或特性
        """
        if knowledge_text.strip() == "" or knowledge_text.strip() == "- None" or knowledge_text.strip() == "- None.":
            print("长期记忆：助手知识为空，不保存。")
            return
        vec = get_embedding(knowledge_text)
        vec = normalize_vector(vec).tolist()
        entry = {
            "knowledge": knowledge_text,
            "timestamp": get_timestamp(),
            "knowledge_embedding": vec
        }
        self.assistant_knowledge.append(entry)
        print("长期记忆：添加助手知识。")
        self.save()

    def get_assistant_knowledge(self):
        """
        获取所有助手知识
        """
        return self.assistant_knowledge


    def get_raw_user_profile(self, user_id):
        """获取原始用户画像数据"""
        return self.user_profiles.get(user_id, {}).get("data", "")
    
    def get_user_profile(self, user_id):
        return self.user_profiles.get(user_id, {})

    def add_knowledge(self, knowledge_text):
        if knowledge_text.strip() == "" or knowledge_text.strip() == "- None"or knowledge_text.strip() == "- None.":
            print("长期记忆：私有知识为空，不保存。")
            return
        vec = get_embedding(knowledge_text)
        vec = normalize_vector(vec).tolist()
        entry = {
            "knowledge": knowledge_text,
            "timestamp": get_timestamp(),
            "knowledge_embedding": vec
        }
        self.knowledge_base.append(entry)
        print("长期记忆：添加私有知识。")
        self.save()

    def get_knowledge(self):
        return self.knowledge_base

    def search_knowledge(self, query, threshold=0.1, top_k=10):
        if not self.knowledge_base:
            return []
        query_vec = get_embedding(query)
        query_vec = normalize_vector(query_vec)
        embeddings = []
        for entry in self.knowledge_base:
            embeddings.append(np.array(entry["knowledge_embedding"], dtype=np.float32))
        embeddings = np.array(embeddings, dtype=np.float32)
        if embeddings.ndim == 1:
            embeddings = embeddings.reshape(1, -1)
        from faiss import IndexFlatIP
        dim = embeddings.shape[1]
        index = IndexFlatIP(dim)
        index.add(embeddings)
        query_arr = np.array([query_vec], dtype=np.float32)
        distances, indices = index.search(query_arr, top_k)
        results = []
        for dist, idx in zip(distances[0], indices[0]):
            if idx == -1:
                continue
            if dist >= threshold:
                results.append(self.knowledge_base[idx])
        print(f"长期记忆：检索到 {len(results)} 个匹配知识。")
        return results

    def save(self):
        data = {
            "user_profiles": self.user_profiles,
            "knowledge_base": self.knowledge_base,
            "assistant_knowledge": self.assistant_knowledge
        }
        with open(self.file_path, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
        print("长期记忆：保存成功。")

    def load(self):
        try:
            with open(self.file_path, "r", encoding="utf-8") as f:
                data = json.load(f)
                self.user_profiles = data.get("user_profiles", {})
                self.knowledge_base = data.get("knowledge_base", [])
                self.assistant_knowledge = data.get("assistant_knowledge", [])  # 加载助手知识
            print("长期记忆：加载成功。")
        except Exception:
            self.user_profiles = {}
            self.knowledge_base = []
            print("长期记忆：无历史数据。")

```

### Core Architecture Module: `eval/main_loco_parse.py`
```
import json
from datetime import datetime, timedelta
from short_term_memory import ShortTermMemory
from mid_term_memory import MidTermMemory
from long_term_memory import LongTermMemory
from dynamic_update import DynamicUpdate
from retrieval_and_answer import RetrievalAndAnswer
from utils import OpenAIClient, gpt_generate_answer, gpt_extract_theme, gpt_update_profile, gpt_generate_multi_summary, get_timestamp, llm_extract_keywords, gpt_personality_analysis
import re
import openai
import time
import tiktoken
import os
total_tokens = 0
num_samples=0
# Initialize OpenAI client
client = OpenAIClient(
    api_key='',
    base_url='https://cn2us02.opapi.win/v1'
)

# Heat threshold
H_THRESHOLD = 5.0

def update_user_profile_from_top_segment(mid_mem, long_mem, sample_id, client):
    """
    Update user profile if heat exceeds threshold and extract assistant knowledge.
    """
    if not mid_mem.heap:
        return
    
    neg_heat, sid = mid_mem.heap[0]
    mid_mem.rebuild_heap()
    current_heat = -neg_heat
    
    if current_heat >= H_THRESHOLD:
        session = mid_mem.sessions.get(sid)
        if not session:
            return
        
        un_analyzed = [p for p in session["details"] if not p.get("analyzed", False)]
        if un_analyzed:
            print(f"Updating user profile: Segment {sid} heat {current_heat:.2f} exceeds threshold, starting profile update...")
            
            old_profile = long_mem.get_raw_user_profile(sample_id)
            
            result = gpt_personality_analysis(un_analyzed, client)
            new_profile = result["profile"]
            new_private = result["private"]
            assistant_knowledge = result["assistant_knowledge"]
            
            if old_profile:
                updated_profile = gpt_update_profile(old_profile, new_profile, client)
            else:
                updated_profile = new_profile
                
            long_mem.update_user_profile(sample_id, updated_profile)
            
            # 修改点：拆分 new_private 并逐个存储
            if new_private and new_private != "- None":
                # 按行拆分，过滤空行和非事实行（如 "【User Data】" 或注释）
                facts = [line.strip() for line in new_private.split("\n")]
                for fact in facts:
                    long_mem.add_knowledge(fact)  # 逐条添加
            
            if assistant_knowledge and assistant_knowledge != "None":
                long_mem.add_assistant_knowledge(assistant_knowledge)
            
            for p in session["details"]:
                p["analyzed"] = True
            session["N_visit"] = 0
            session["L_interaction"] = 0
            session["R_recency"] = 1.0
            session["H_segment"] = 0.0
            session["last_visit_time"] = get_timestamp()
            mid_mem.rebuild_heap()
            mid_mem.save()
            print(f"Update complete: Segment {sid} heat has been reset.")

def generate_system_response_with_meta(query, short_mem, long_mem, retrieval_queue, long_konwledge, client, sample_id, speaker_a, speaker_b, meta_data):
    """
    Generate system response with speaker roles clearly defined.
    """
    history = short_mem.get_all()
    history_text = "\n".join([
        f"{speaker_a}: {qa.get('user_input', '')}\n{speaker_b}: {qa.get('agent_response', '')}\nTime: ({qa.get('timestamp', '')})" 
        for qa in history
    ])
    
    retrieval_text = "\n".join([
        f"【Historical Memory】 {speaker_a}: {page.get('user_input', '')}\n{speaker_b}: {page.get('agent_response', '')}\nTime:({page.get('timestamp', '')})\nConversation chain overview:({page.get('meta_info', '')})\n" 
        for page in retrieval_queue
    ])
    
    profile_obj = long_mem.get_user_profile(sample_id)
    user_profile_text = str(profile_obj.get("data", "None")) if profile_obj else "None"
    
    background = f"【User Profile】\n{user_profile_text}\n\n"
    for kn in long_konwledge:
        background += f"{kn['knowledge']}\n"
    background = re.sub(r'(?i)\buser\b', speaker_a, background)
    background= re.sub(r'(?i)\bassistant\b', speaker_b, background)
    assistant_knowledge = long_mem.get_assistant_knowledge()
    assistant_knowledge_text = "【Assistant Knowledge】\n"
    for ak in assistant_knowledge:
        assistant_knowledge_text += f"- {ak['knowledge']} ({ak['timestamp']})\n"
    #meta_data_text = f"【Conversation Meta Data】\n{json.dumps(meta_data, ensure_ascii=False, indent=2)}\n\n"
    assistant_knowledge_text = re.sub(r'\bI\b', speaker_b, assistant_knowledge_text)
    
    system_prompt = (
        f"You are role-playing as {speaker_b} in a conversation with the user is playing is  {speaker_a}. "
        f"Here are some of your character traits and knowledge:\n{assistant_knowledge_text}\n"
        f"Any content referring to 'User' in the prompt refers to {speaker_a}'s content, and any content referring to 'AI'or 'assiant' refers to {speaker_b}'s content."
        f"Your task is to answer questions about {speaker_a} or {speaker_b} in an extremely concise manner.\n"
        f"When the question is: \"What did the charity race raise awareness for?\", you should not answer in the form of: \"The charity race raised awareness for mental health.\" Instead, it should be: \"mental health\", as this is more concise."
    )
    
    user_prompt = (
        f"<CONTEXT>\n"
        f"Recent conversation between {speaker_a} and {speaker_b}:\n"
        f"{history_text}\n\n"
        f"<MEMORY>\n"
        f"Relevant past conversations:\n"
        f"{retrieval_text}\n\n"
        f"<CHARACTER TRAITS>\n"
        f"Characteristics of {speaker_a}:\n"
        f"{background}\n\n"
        f"the question is: {query}\n"
        f"Your task is to answer questions about {speaker_a} or {speaker_b} in an extremely concise manner.\n"
        f"Please only provide the content of the answer, without including 'answer:'\n"
        f"For questions that require answering a date or time, strictly follow the format \"15 July 2023\" and provide a specific date whenever possible. For example, if you need to answer \"last year,\" give the specific year of last year rather than just saying \"last year.\" Only provide one year, date, or time, without any extra responses.\n"
        f"If the question is about the duration, answer in the form of several years, months, or days.\n"
        f"Generate answers primarily composed of concrete entities, such as Mentoring program, school speech, etc"
    )
    
    messages = [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": user_prompt}
    ]
    
    response = client.chat_completion(model="gpt-4o-mini", messages=messages, temperature=0.7, max_tokens=2000)
    return response, system_prompt, user_prompt

def process_conversation(conversation_data):
    """
    Process conversation data from locomo10 format into memory system format.
    Handles both text-only and image-containing messages.
    """
    processed = []
    speaker_a = conversation_data["speaker_a"]
    speaker_b = conversation_data["speaker_b"]
    
    # Find all session keys
    session_keys = [key for key in conversation_data.keys() if key.startswith("session_") and not key.endswith("_date_time")]
    
    for session_key in session_keys:
        timestamp_key = f"{session_key}_date_time"
        timestamp = conversation_data.get(timestamp_key, "")
        
        for dialog in conversation_data[session_key]:
            speaker = dialog["speaker"]
            text = dialog["text"]
            
            # Handle image content if present
            if "blip_caption" in dialog and dialog["blip_caption"]:
                text = f"{text} (image description: {dialog['blip_caption']})"
            
            # Alternate between speakers as user and assistant
            if speaker == speaker_a:
                processed.append({
                    "user_input": text,
                    "agent_response": "",
                    "timestamp": timestamp
                })
            else:
                if processed:
                    processed[-1]["agent_response"] = text
                else:
                    processed.append({
                        "user_input": "",
                        "agent_response": text,
                        "timestamp": timestamp
                    })
    
    return processed

def main():
    # 直接处理整个数据集，不需要命令行参数
    print("开始处理整个locomo10数据集...")
    
    # 创建记忆文件存储目录
    os.makedirs("mem_tmp_loco_final", exist_ok=True)
    
    # Load locomo10 dataset
    try:
        with open("locomo10.json", "r", encoding="utf-8") as f:
            dataset = json.load(f)
        print(f"成功加载数据集，共 {len(dataset)} 个样本")
    except FileNotFoundError:
        print("错误：找不到 locomo10.json 文件，请确保文件在当前目录中")
        return
    except Exception as e:
        print(f"加载数据集时出错：{e}")
        return
    
    # 处理整个数据集，不进行切片
    # dataset = dataset  # 处理全部数据
    
    # 设置固定的输出文件名
    output_file = "all_loco_results.json"
    
    results = []
    total_samples = len(dataset)
    
    for idx, sample in enumerate(dataset):
        print(f"正在处理样本 {idx + 1}/{total_samples}: {sample.get('sample_id', 'unknown')}")
        
        sample_id = sample.get("sample_id", "unknown_sample")
        conversation_data = sample["conversation"]
        qa_pairs = sample["qa"]
        
        # Process conversation data
        processed_dialogs = process_conversation(conversation_data)
        
        if not processed_dialogs:
            print(f"样本 {sample_id} 没有有效的对话数据，跳过")
            continue
            
        speaker_a = conversation_data["speaker_a"]
        speaker_b = conversation_data["speaker_b"]
        
        # Initialize memory modules
        short_mem = ShortTermMemory(max_capacity=1, file_path=f"mem_tmp_loco_final/{sample_id}_short_term.json")
        mid_mem = MidTermMemory(max_capacity=2000, file_path=f"mem_tmp_loco_final/{sample_id}_mid_term.json")
        long_mem = LongTermMemory(file_path=f"mem_tmp_loco_final/
```

### Core Architecture Module: `eval/mid_term_memory.py`
```
import json
import numpy as np
from collections import defaultdict
import faiss
import heapq
from utils import get_timestamp, generate_id, get_embedding, normalize_vector, llm_extract_keywords
from datetime import datetime
from utils import OpenAIClient
from utils import get_timestamp, generate_id, get_embedding, normalize_vector, llm_extract_keywords, compute_time_decay

client = OpenAIClient(
    api_key='',
    base_url='https://cn2us02.opapi.win/v1'
)

def compute_recency(last_visit_time, tau=24):
    from datetime import datetime
    fmt = "%Y-%m-%d %H:%M:%S"
    now = datetime.now()
    t1 = datetime.strptime(last_visit_time, fmt)
    delta_hours = (now - t1).total_seconds() / 3600.0
    return np.exp(- delta_hours / tau)

def compute_segment_heat(session, alpha=0.8, beta=0.8, gamma=0.0001):
    N_visit = session.get("N_visit", 0)
    L_interaction = session.get("L_interaction", 0)
    R_recency = session.get("R_recency", 1.0)
    return alpha * N_visit + beta * L_interaction + gamma * R_recency

class MidTermMemory:
    def __init__(self, max_capacity=7, file_path="mid_term.json"):
        self.max_capacity = max_capacity
        self.file_path = file_path
        self.sessions = {}
        self.access_frequency = defaultdict(int)
        self.heap = []
        self.load()

    def get_page_by_id(self, page_id):
        for session in self.sessions.values():
            for page in session["details"]:
                if page["page_id"] == page_id:
                    return page
        return None

    def update_page_connections(self, prev_page_id, next_page_id):
        if prev_page_id:
            prev_page = self.get_page_by_id(prev_page_id)
            if prev_page:
                prev_page["next_page"] = next_page_id
        if next_page_id:
            next_page = self.get_page_by_id(next_page_id)
            if next_page:
                next_page["pre_page"] = prev_page_id

    def evict_lfu(self):
        if not self.access_frequency:
            return
        
        lfu_sid = min(self.access_frequency, key=self.access_frequency.get)
        print(f"中期记忆：LFU 淘汰会话段 {lfu_sid}。")
        
        if lfu_sid not in self.sessions:
            del self.access_frequency[lfu_sid]
            return
        
        session_to_delete = self.sessions[lfu_sid]
        for page in session_to_delete["details"]:
            prev_page_id = page.get("pre_page")
            next_page_id = page.get("next_page")
            self.update_page_connections(prev_page_id, next_page_id)
        
        del self.sessions[lfu_sid]
        del self.access_frequency[lfu_sid]
        self.save()
        self.rebuild_heap()

    def add_session(self, summary, details):
        session_id = generate_id("session")
        summary_vec = get_embedding(summary)
        summary_vec = normalize_vector(summary_vec).tolist()
        summary_keywords = list(llm_extract_keywords(summary, client=client))
        
        new_details = []
        for page in details:
            if "page_id" not in page:
                page["page_id"] = generate_id("page")
            full_text = f"User: {page.get('user_input','')} Assiant: {page.get('agent_response','')}"
            inp_vec = get_embedding(full_text)
            inp_vec = normalize_vector(inp_vec).tolist()
            page_keywords = list(llm_extract_keywords(full_text, client=client))
            page["page_embedding"] = inp_vec
            page["page_keywords"] = page_keywords
            page["preloaded"] = False
            page["analyzed"] = False
            # page["pre_page"] = None
            # page["next_page"] = None
            # page["meta_info"] = None
            new_details.append(page)
        
        session_obj = {
            "id": session_id,
            "summary": summary,
            "summary_keywords": summary_keywords,
            "summary_embedding": summary_vec,
            "details": new_details,
            "L_interaction": len(new_details),
            "R_recency": 1.0,
            "N_visit": 0,
            "H_segment": 0.0,
            "timestamp": get_timestamp(),
            "access_count": 0
        }
        self.sessions[session_id] = session_obj
        session_obj["H_segment"] = compute_segment_heat(session_obj)
        self.access_frequency[session_id] = 0
        heapq.heappush(self.heap, (-session_obj["H_segment"], session_id))
        print(f"中期记忆：新增会话段 {session_id}，初始热度 {session_obj['H_segment']:.2f}。")
        if len(self.sessions) > self.max_capacity:
            self.evict_lfu()
        self.save()
        return session_id

    def rebuild_heap(self):
        self.heap = [(-session["H_segment"], sid) for sid, session in self.sessions.items()]
        heapq.heapify(self.heap)

    def insert_pages_into_session(self, summary, keyworks, pages, similarity_threshold=0.6, alpha=1.0):
        new_summary_vec = get_embedding(summary)
        new_summary_vec = normalize_vector(new_summary_vec)
        new_keywords = keyworks
        
        best_sid = None
        best_sim = -1
        for sid, session in self.sessions.items():
            sv = np.array(session["summary_embedding"], dtype=np.float32)
            sim = float(np.dot(sv, new_summary_vec))
            if sim > best_sim:
                best_sim = sim
                best_sid = sid
        
        if best_sim >= 0 and best_sid is not None:
            print(f"中期记忆：尝试合并到会话段 {best_sid}（摘要相似度 {best_sim:.2f}）。")
            session = self.sessions[best_sid]
            session_keywords = set(session.get("summary_keywords", []))
            new_kw_set = set(new_keywords)
            if session_keywords and new_kw_set:
                overlap = session_keywords & new_kw_set
                s_top = 0.5 * (len(overlap)/len(session_keywords) + len(overlap)/len(new_kw_set))
            else:
                s_top = 0
            overall_score = best_sim + alpha * s_top
            
            if overall_score >= similarity_threshold:
                print(f"中期记忆：综合得分 {overall_score:.2f} 满足合并条件，将页面追加。")
                for p in pages:
                    if "page_id" not in p:
                        p["page_id"] = generate_id("page")
                    full_text = f"用户: {p.get('user_input','')}"
                    vec = get_embedding(full_text)
                    vec = normalize_vector(vec).tolist()
                    p["page_embedding"] = vec
                    p["page_keywords"] = keyworks
                    p["preloaded"] = False
                    # p["pre_page"] = None
                    # p["next_page"] = None
                    # p["meta_info"] = None
                    session["details"].append(p)
                session["timestamp"] = get_timestamp()
            else:
                print("中期记忆：综合得分不足，新增会话段。")
                self.add_session(summary, pages)
        else:
            print("中期记忆：无相似会话段，新建会话段。")
            self.add_session(summary, pages)
        
        if best_sid is not None and best_sid in self.sessions:
            session = self.sessions[best_sid]
            session["L_interaction"] += len(pages)
            session["H_segment"] = compute_segment_heat(session)
        
        self.rebuild_heap()
        self.save()

    def search_sessions_by_summary(self, query, client, segment_threshold=0.8, page_threshold=0.7, top_k=5, tau=3600, gamma=0.5, alpha=1.0):
        if not self.sessions:
            return []
        
        session_ids = list(self.sessions.keys())
        embeddings = np.array([self.sessions[s]["summary_embedding"] for s in session_ids], dtype=np.float32)
        dim = embeddings.shape[1]
        index = faiss.IndexFlatIP(dim)
        index.add(embeddings)
        
        query_vec = get_embedding(query)
        query_vec = normalize_vector(query_vec)
        query_arr = np.array([query_vec], dtype=np.float32)
        distances, indices = index.search(query_arr, top_k)
        
        query_keywords = llm_extract_keywords(query, client)
        current_time = datetime.now()
        results = []
        
        for dist, idx in zip(distances[0], indices[0]):
            if idx == -1:
                continue
            
            sid = session_ids[idx]
            session = self.sessions[sid]
            session_time = datetime.strptime(session["timestamp"], "%Y-%m-%d %H:%M:%S")
            delta = (current_time - session_time).total_seconds()
            #lambda_t = np.exp(-delta/tau)
            lambda_t=1
            
            session_keywords = set(session.get("summary_keywords", []))
            if query_keywords and session_keywords:
                overlap = query_keywords & session_keywords
                s_top = 0.5 * (len(overlap)/len(query_keywords) + len(overlap)/len(session_keywords))
            else:
                s_top = 0
            
            overall = lambda_t * (dist + alpha * s_top)
            
            if overall >= segment_threshold:
                matched_pages = []
                for page in session["details"]:
                    full_text = f"{page.get('user_input','')}{page.get('timestamp','')}{page.get('agent_response','')}"
                    pvec = np.array(get_embedding(full_text), dtype=np.float32)
                    pvec = normalize_vector(pvec)
                    sim_page = float(np.dot(pvec, query_vec))
                    if sim_page >= page_threshold:
                        matched_pages.append([page, sim_page])
                
                if matched_pages:
                    self.access_frequency[sid] += 1
                    session["N_visit"] += 1
                    session["last_visit_time"] = get_timestamp()
                    session["R_recency"] = compute_time_decay(session["last_visit_time"], get_timestamp(), tau)

```

### Core Architecture Module: `eval/retrieval_and_answer.py`
```
from collections import deque
from utils import get_timestamp
import heapq
class RetrievalAndAnswer:
    def __init__(self, short_term_memory, mid_term_memory, long_term_memory, dynamic_updater, queue_capacity=25):
        self.short_term_memory = short_term_memory
        self.mid_term_memory = mid_term_memory
        self.long_term_memory = long_term_memory
        self.dynamic_updater = dynamic_updater
        self.queue_capacity = queue_capacity
        self.retrieval_queue = deque(maxlen=queue_capacity)

    def retrieve(self, user_query, segment_threshold=0.7, page_threshold=0.7, knowledge_threshold=0.7, client=None):
            print("检索：开始检索中期记忆...")
            matched = self.mid_term_memory.search_sessions_by_summary(user_query, client, segment_threshold, page_threshold)
            
            # 使用堆来维护分数最高的页面
            top_pages_heap = []
            
            for item in matched:
                for page_info in item["matched_pages"]:  # 现在每个page_info是[page, overall]形式
                    page, overall_score = page_info
                    # 使用最小堆来保持前queue_capacity个最高分项目
                    if len(top_pages_heap) < self.queue_capacity:
                        heapq.heappush(top_pages_heap, (overall_score, id(page), page))
                    else:
                        # 如果当前分数高于堆中最小的分数，则替换
                        if overall_score > top_pages_heap[0][0]:
                            heapq.heappop(top_pages_heap)
                            heapq.heappush(top_pages_heap, (overall_score, id(page), page))
            
            # 清空并重新填充检索队列，按分数从高到低排序
            self.retrieval_queue.clear()
            for score, _, page in sorted(top_pages_heap, key=lambda x: x[0], reverse=True):
                self.retrieval_queue.append(page)
            
            print(f"检索：中期记忆召回 {len(self.retrieval_queue)} 个 QA 对到检索队列。")
            long_term_info = self.long_term_memory.search_knowledge(user_query, threshold=knowledge_threshold)
            # print(long_term_info[0].keys())
            print(f"检索：长期记忆召回 {len(long_term_info)} 个知识条目。")
            
            return {
                "retrieval_queue": list(self.retrieval_queue),
                "long_term_knowledge": long_term_info,
                "retrieved_at": get_timestamp()
            }

```

### Core Architecture Module: `eval/short_term_memory.py`
```
import json
from collections import deque
from utils import get_timestamp

class ShortTermMemory:
    def __init__(self, max_capacity=10, file_path="short_term.json"):
        self.max_capacity = max_capacity
        self.file_path = file_path
        self.memory = deque(maxlen=max_capacity)
        self.load()

    def add_qa_pair(self, qa_pair):
        qa_pair["timestamp"] = qa_pair.get("timestamp", get_timestamp())
        self.memory.append(qa_pair)
        print(f"短期记忆：添加 QA 对，用户: {qa_pair.get('user_input','')[:30]}...")
        self.save()

    def get_all(self):
        return list(self.memory)

    def is_full(self):
        return len(self.memory) == self.max_capacity

    def pop_oldest(self):
        if self.memory:
            msg = self.memory.popleft()
            print("短期记忆：淘汰最老 QA 对。")
            self.save()
            return msg
        return None

    def save(self):
        with open(self.file_path, "w", encoding="utf-8") as f:
            json.dump(list(self.memory), f, ensure_ascii=False, indent=2)

    def load(self):
        try:
            with open(self.file_path, "r", encoding="utf-8") as f:
                data = json.load(f)
                self.memory = deque(data, maxlen=self.max_capacity)
            print("短期记忆：加载成功。")
        except Exception:
            self.memory = deque(maxlen=self.max_capacity)
            print("短期记忆：无历史数据。")

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #11** (2025-07-14): **cursor 0 tool enabled**
  *Symptoms*: Hi all, I’m having trouble connecting to the MCP (MemoryOS MCP server) and would appreciate any help or suggestions.  Issue Description: I have set up the MCP server using the provided configuration files (testing.ini and mcp.json). When I run the server directly it starts up without errors, and all tests pass locally.  However, when I try to connect to the MCP server using cursor it says 0 tool enabled        "memoryos": {       "command": "/Users/bogle/mambaforge/envs/memoryos/bin/python",       "args": [         "/Users/bogle/Dev/AgentV2/MemoryOS/memoryos-mcp/server_new.py",         "--config",         "/Users/bogle/Dev/AgentV2/MemoryOS/memoryos-mcp/config.json"       ],       "env": {},       "description": "MemoryOS MCP Server - Intelligent memory system providing memory addition, retrieval, and user profiling functions",       "capabilities": {         "tools": [           {             "name": "add_memory",             "description": "Add new memory to the MemoryOS system. (user_input and assistant_response pair)"           },           {             "name": "retrieve_memory",             "description": "Retrieve related memories and context information from MemoryOS based on the query"           },           {             "name": "get_user_profile",             "description": "Get user profile information, including personality traits, preferences, and related knowledge"           }         ],         "resources": [           {             "uri": "memoryos://status", 
  **Post-Mortem & Fix Analysis**:
  > We are looking into your issue and appreciate your suggestion. We will respond to you within this week.
  > <img width="725" height="210" alt="Image" src="https://github.com/user-attachments/assets/a17cf48b-f964-4f21-9137-fc03f8285014" />  It works fine on my end. Could you provide more detailed information? You could try replacing python with python3 and see if it works.

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

### Incident Patch 1: `587ed775` (2026-07-07)
**Commit Message**: Merge pull request #73 from jwchen2001/fix/thread-safety-mcp-playground

Fix: Propagate thread-safety locks to memoryos-mcp and memoryos-playground

**File**: `memoryos-mcp/memoryos/long_term.py` (modified, +5/-2)
```diff
@@ -2,6 +2,7 @@
 import numpy as np
 import faiss
 from collections import deque
+import threading
 try:
     from .utils import get_timestamp, get_embedding, normalize_vector, ensure_directory_exists
 except ImportError:
@@ -19,6 +20,7 @@ def __init__(self, file_path, knowledge_capacity=100, embedding_model_name: str
 
         self.embedding_model_name = embedding_model_name
         self.embedding_model_kwargs = embedding_model_kwargs if embedding_model_kwargs is not None else {}
+        self.lock = threading.Lock()
         self.load()
 
     def update_user_profile(self, user_id, new_data, merge=True):
@@ -144,8 +146,9 @@ def save(self):
             "assistant_knowledge": list(self.assistant_knowledge)
         }
         try:
-            with open(self.file_path, "w", encoding="utf-8") as f:
-                json.dump(data, f, ensure_ascii=False, indent=2)
+            with self.lock:
+                with open(self.file_path, "w", encoding="utf-8") as f:
+                    json.dump(data, f, ensure_ascii=False, indent=2)
         except IOError as e:
             print(f"Error saving LongTermMemory to {self.file_path}: {e}")
 
```

**File**: `memoryos-mcp/memoryos/mid_term.py` (modified, +5/-2)
```diff
@@ -3,6 +3,7 @@
 from collections import defaultdict
 import faiss
 import heapq
+import threading
 from datetime import datetime
 
 try:
@@ -46,6 +47,7 @@ def __init__(self, file_path: str, client: OpenAIClient, max_capacity=2000, embe
 
         self.embedding_model_name = embedding_model_name
         self.embedding_model_kwargs = embedding_model_kwargs if embedding_model_kwargs is not None else {}
+        self.lock = threading.Lock()
         self.load()
 
     def get_page_by_id(self, page_id):
@@ -370,8 +372,9 @@ def save(self):
             # "heap_snapshot": self.heap 
         }
         try:
-            with open(self.file_path, "w", encoding="utf-8") as f:
-                json.dump(data_to_save, f, ensure_ascii=False, indent=2)
+            with self.lock:
+                with open(self.file_path, "w", encoding="utf-8") as f:
+                    json.dump(data_to_save, f, ensure_ascii=False, indent=2)
         except IOError as e:
             print(f"Error saving MidTermMemory to {self.file_path}: {e}")
 
```

**File**: `memoryos-mcp/memoryos/short_term.py` (modified, +5/-2)
```diff
@@ -1,5 +1,6 @@
 import json
 from collections import deque
+import threading
 try:
     from .utils import get_timestamp, ensure_directory_exists
 except ImportError:
@@ -11,6 +12,7 @@ def __init__(self, file_path, max_capacity=10):
         self.file_path = file_path
         ensure_directory_exists(self.file_path)
         self.memory = deque(maxlen=max_capacity)
+        self.lock = threading.Lock()
         self.load()
 
     def add_qa_pair(self, qa_pair):
@@ -38,8 +40,9 @@ def pop_oldest(self):
 
     def save(self):
         try:
-            with open(self.file_path, "w", encoding="utf-8") as f:
-                json.dump(list(self.memory), f, ensure_ascii=False, indent=2)
+            with self.lock:
+                with open(self.file_path, "w", encoding="utf-8") as f:
+                    json.dump(list(self.memory), f, ensure_ascii=False, indent=2)
         except IOError as e:
             print(f"Error saving ShortTermMemory to {self.file_path}: {e}")
 
```

**File**: `memoryos-playground/long_term.py` (modified, +5/-2)
```diff
@@ -2,6 +2,7 @@
 import numpy as np
 import faiss
 from collections import deque
+import threading
 try:
     from .utils import get_timestamp, get_embedding, normalize_vector, ensure_directory_exists
 except ImportError:
@@ -19,6 +20,7 @@ def __init__(self, file_path, knowledge_capacity=100, embedding_model_name: str
 
         self.embedding_model_name = embedding_model_name
         self.embedding_model_kwargs = embedding_model_kwargs if embedding_model_kwargs is not None else {}
+        self.lock = threading.Lock()
         self.load()
 
     def update_user_profile(self, user_id, new_data, merge=True):
@@ -144,8 +146,9 @@ def save(self):
             "assistant_knowledge": list(self.assistant_knowledge)
         }
         try:
-            with open(self.file_path, "w", encoding="utf-8") as f:
-                json.dump(data, f, ensure_ascii=False, indent=2)
+            with self.lock:
+                with open(self.file_path, "w", encoding="utf-8") as f:
+                    json.dump(data, f, ensure_ascii=False, indent=2)
         except IOError as e:
             print(f"Error saving LongTermMemory to {self.file_path}: {e}")
 
```

**File**: `memoryos-playground/mid_term.py` (modified, +5/-2)
```diff
@@ -3,6 +3,7 @@
 from collections import defaultdict
 import faiss
 import heapq
+import threading
 from datetime import datetime
 
 try:
@@ -46,6 +47,7 @@ def __init__(self, file_path: str, client: OpenAIClient, max_capacity=2000, embe
 
         self.embedding_model_name = embedding_model_name
         self.embedding_model_kwargs = embedding_model_kwargs if embedding_model_kwargs is not None else {}
+        self.lock = threading.Lock()
         self.load()
 
     def get_page_by_id(self, page_id):
@@ -370,8 +372,9 @@ def save(self):
             # "heap_snapshot": self.heap 
         }
         try:
-            with open(self.file_path, "w", encoding="utf-8") as f:
-                json.dump(data_to_save, f, ensure_ascii=False, indent=2)
+            with self.lock:
+                with open(self.file_path, "w", encoding="utf-8") as f:
+                    json.dump(data_to_save, f, ensure_ascii=False, indent=2)
         except IOError as e:
             print(f"Error saving MidTermMemory to {self.file_path}: {e}")
 
```

**File**: `memoryos-playground/short_term.py` (modified, +5/-2)
```diff
@@ -1,5 +1,6 @@
 import json
 from collections import deque
+import threading
 try:
     from .utils import get_timestamp, ensure_directory_exists
 except ImportError:
@@ -11,6 +12,7 @@ def __init__(self, file_path, max_capacity=10):
         self.file_path = file_path
         ensure_directory_exists(self.file_path)
         self.memory = deque(maxlen=max_capacity)
+        self.lock = threading.Lock()
         self.load()
 
     def add_qa_pair(self, qa_pair):
@@ -38,8 +40,9 @@ def pop_oldest(self):
 
     def save(self):
         try:
-            with open(self.file_path, "w", encoding="utf-8") as f:
-                json.dump(list(self.memory), f, ensure_ascii=False, indent=2)
+            with self.lock:
+                with open(self.file_path, "w", encoding="utf-8") as f:
+                    json.dump(list(self.memory), f, ensure_ascii=False, indent=2)
         except IOError as e:
             print(f"Error saving ShortTermMemory to {self.file_path}: {e}")
 
```

---

### Incident Patch 2: `46ac61e6` (2026-07-06)
**Commit Message**: Fix: Propagate thread-safety locks to memoryos-mcp and memoryos-playground

Commit 97453e4 added threading.Lock() to ShortTermMemory, MidTermMemory
and LongTermMemory in memoryos-pypi to prevent race conditions on JSON
writes, but the same fix was not applied to the memoryos-mcp and
memoryos-playground variants, which contain near-identical copies of
these classes. Both variants are exposed to concurrent access (the MCP
server serves parallel tool calls; the Flask playground handles
concurrent HTTP requests), so the race condition still causes data
corruption, lost entries, or truncated files there.

This commit mirrors the pypi fix in both variants:
- Add `import threading` at module top
- Initialize `self.lock = threading.Lock()` in __init__
- Wrap the json.dump call in save() with `with self.lock:`

Files:
- memoryos-mcp/memoryos/short_term.py
- memoryos-mcp/memoryos/mid_term.py
- memoryos-mcp/memoryos/long_term.py
- memoryos-playground/short_term.py
- memoryos-playground/mid_term.py
- memoryos-playground/long_term.py

**File**: `memoryos-mcp/memoryos/long_term.py` (modified, +5/-2)
```diff
@@ -2,6 +2,7 @@
 import numpy as np
 import faiss
 from collections import deque
+import threading
 try:
     from .utils import get_timestamp, get_embedding, normalize_vector, ensure_directory_exists
 except ImportError:
@@ -19,6 +20,7 @@ def __init__(self, file_path, knowledge_capacity=100, embedding_model_name: str
 
         self.embedding_model_name = embedding_model_name
         self.embedding_model_kwargs = embedding_model_kwargs if embedding_model_kwargs is not None else {}
+        self.lock = threading.Lock()
         self.load()
 
     def update_user_profile(self, user_id, new_data, merge=True):
@@ -144,8 +146,9 @@ def save(self):
             "assistant_knowledge": list(self.assistant_knowledge)
         }
         try:
-            with open(self.file_path, "w", encoding="utf-8") as f:
-                json.dump(data, f, ensure_ascii=False, indent=2)
+            with self.lock:
+                with open(self.file_path, "w", encoding="utf-8") as f:
+                    json.dump(data, f, ensure_ascii=False, indent=2)
         except IOError as e:
             print(f"Error saving LongTermMemory to {self.file_path}: {e}")
 
```

**File**: `memoryos-mcp/memoryos/mid_term.py` (modified, +5/-2)
```diff
@@ -3,6 +3,7 @@
 from collections import defaultdict
 import faiss
 import heapq
+import threading
 from datetime import datetime
 
 try:
@@ -46,6 +47,7 @@ def __init__(self, file_path: str, client: OpenAIClient, max_capacity=2000, embe
 
         self.embedding_model_name = embedding_model_name
         self.embedding_model_kwargs = embedding_model_kwargs if embedding_model_kwargs is not None else {}
+        self.lock = threading.Lock()
         self.load()
 
     def get_page_by_id(self, page_id):
@@ -370,8 +372,9 @@ def save(self):
             # "heap_snapshot": self.heap 
         }
         try:
-            with open(self.file_path, "w", encoding="utf-8") as f:
-                json.dump(data_to_save, f, ensure_ascii=False, indent=2)
+            with self.lock:
+                with open(self.file_path, "w", encoding="utf-8") as f:
+                    json.dump(data_to_save, f, ensure_ascii=False, indent=2)
         except IOError as e:
             print(f"Error saving MidTermMemory to {self.file_path}: {e}")
 
```

**File**: `memoryos-mcp/memoryos/short_term.py` (modified, +5/-2)
```diff
@@ -1,5 +1,6 @@
 import json
 from collections import deque
+import threading
 try:
     from .utils import get_timestamp, ensure_directory_exists
 except ImportError:
@@ -11,6 +12,7 @@ def __init__(self, file_path, max_capacity=10):
         self.file_path = file_path
         ensure_directory_exists(self.file_path)
         self.memory = deque(maxlen=max_capacity)
+        self.lock = threading.Lock()
         self.load()
 
     def add_qa_pair(self, qa_pair):
@@ -38,8 +40,9 @@ def pop_oldest(self):
 
     def save(self):
         try:
-            with open(self.file_path, "w", encoding="utf-8") as f:
-                json.dump(list(self.memory), f, ensure_ascii=False, indent=2)
+            with self.lock:
+                with open(self.file_path, "w", encoding="utf-8") as f:
+                    json.dump(list(self.memory), f, ensure_ascii=False, indent=2)
         except IOError as e:
             print(f"Error saving ShortTermMemory to {self.file_path}: {e}")
 
```

**File**: `memoryos-playground/long_term.py` (modified, +5/-2)
```diff
@@ -2,6 +2,7 @@
 import numpy as np
 import faiss
 from collections import deque
+import threading
 try:
     from .utils import get_timestamp, get_embedding, normalize_vector, ensure_directory_exists
 except ImportError:
@@ -19,6 +20,7 @@ def __init__(self, file_path, knowledge_capacity=100, embedding_model_name: str
 
         self.embedding_model_name = embedding_model_name
         self.embedding_model_kwargs = embedding_model_kwargs if embedding_model_kwargs is not None else {}
+        self.lock = threading.Lock()
         self.load()
 
     def update_user_profile(self, user_id, new_data, merge=True):
@@ -144,8 +146,9 @@ def save(self):
             "assistant_knowledge": list(self.assistant_knowledge)
         }
         try:
-            with open(self.file_path, "w", encoding="utf-8") as f:
-                json.dump(data, f, ensure_ascii=False, indent=2)
+            with self.lock:
+                with open(self.file_path, "w", encoding="utf-8") as f:
+                    json.dump(data, f, ensure_ascii=False, indent=2)
         except IOError as e:
             print(f"Error saving LongTermMemory to {self.file_path}: {e}")
 
```

**File**: `memoryos-playground/mid_term.py` (modified, +5/-2)
```diff
@@ -3,6 +3,7 @@
 from collections import defaultdict
 import faiss
 import heapq
+import threading
 from datetime import datetime
 
 try:
@@ -46,6 +47,7 @@ def __init__(self, file_path: str, client: OpenAIClient, max_capacity=2000, embe
 
         self.embedding_model_name = embedding_model_name
         self.embedding_model_kwargs = embedding_model_kwargs if embedding_model_kwargs is not None else {}
+        self.lock = threading.Lock()
         self.load()
 
     def get_page_by_id(self, page_id):
@@ -370,8 +372,9 @@ def save(self):
             # "heap_snapshot": self.heap 
         }
         try:
-            with open(self.file_path, "w", encoding="utf-8") as f:
-                json.dump(data_to_save, f, ensure_ascii=False, indent=2)
+            with self.lock:
+                with open(self.file_path, "w", encoding="utf-8") as f:
+                    json.dump(data_to_save, f, ensure_ascii=False, indent=2)
         except IOError as e:
             print(f"Error saving MidTermMemory to {self.file_path}: {e}")
 
```

**File**: `memoryos-playground/short_term.py` (modified, +5/-2)
```diff
@@ -1,5 +1,6 @@
 import json
 from collections import deque
+import threading
 try:
     from .utils import get_timestamp, ensure_directory_exists
 except ImportError:
@@ -11,6 +12,7 @@ def __init__(self, file_path, max_capacity=10):
         self.file_path = file_path
         ensure_directory_exists(self.file_path)
         self.memory = deque(maxlen=max_capacity)
+        self.lock = threading.Lock()
         self.load()
 
     def add_qa_pair(self, qa_pair):
@@ -38,8 +40,9 @@ def pop_oldest(self):
 
     def save(self):
         try:
-            with open(self.file_path, "w", encoding="utf-8") as f:
-                json.dump(list(self.memory), f, ensure_ascii=False, indent=2)
+            with self.lock:
+                with open(self.file_path, "w", encoding="utf-8") as f:
+                    json.dump(list(self.memory), f, ensure_ascii=False, indent=2)
         except IOError as e:
             print(f"Error saving ShortTermMemory to {self.file_path}: {e}")
 
```

---

### Incident Patch 3: `1d717060` (2026-04-28)
**Commit Message**: Merge pull request #66 from NoAmateur/fix-profile-overwrite-validation

增加用户画像更新前的内容质量校验

**File**: `memoryos-chromadb/memoryos.py` (modified, +5/-3)
```diff
@@ -247,12 +247,14 @@ def add_memory(self, user_input: str, agent_response: str, timestamp = None, met
             "agent_response": agent_response,
             "timestamp": timestamp
         }
-        self.short_term_memory.add_qa_pair(qa_pair)
-        print(f"Memoryos: Added QA to short-term. User: {user_input[:30]}...")
-
+        # FIX: Migrate old entries BEFORE adding the new one to prevent
+        # silent data loss from deque auto-eviction.
         if self.short_term_memory.is_full():
             print("Memoryos: Short-term memory full. Processing to mid-term.")
             self.updater.process_short_term_to_mid_term()
+
+        self.short_term_memory.add_qa_pair(qa_pair)
+        print(f"Memoryos: Added QA to short-term. User: {user_input[:30]}...")
         
         # After any memory addition that might impact mid-term, check for profile updates
         self._trigger_profile_and_knowledge_update_if_needed()
```

**File**: `memoryos-mcp/memoryos/memoryos.py` (modified, +10/-4)
```diff
@@ -183,9 +183,13 @@ def task_knowledge_extraction():
                 new_assistant_knowledge = knowledge_result.get("assistant_knowledge")
 
                 # 直接使用更新后的完整用户画像
-                if updated_user_profile and updated_user_profile.lower() != "none":
+                if (updated_user_profile and
+                        updated_user_profile.lower() != "none" and
+                        len(updated_user_profile.strip()) >= 30):
                     print("Memoryos: Updating user profile with integrated analysis...")
                     self.user_long_term_memory.update_user_profile(self.user_id, updated_user_profile, merge=False)  # 直接替换为新的完整画像
+                else:
+                    print("Memoryos: Skipping user profile update due to insufficient content.")
                 
                 # Add User Private Knowledge to user's LTM
                 if new_user_private_knowledge and new_user_private_knowledge.lower() != "none":
@@ -233,12 +237,14 @@ def add_memory(self, user_input: str, agent_response: str, timestamp: str = None
             "timestamp": timestamp
             # meta_data can be added here if it needs to be stored with the QA pair
         }
-        self.short_term_memory.add_qa_pair(qa_pair)
-        print(f"Memoryos: Added QA to short-term. User: {user_input[:30]}...")
-
+        # FIX: Migrate old entries BEFORE adding the new one to prevent
+        # silent data loss from deque auto-eviction.
         if self.short_term_memory.is_full():
             print("Memoryos: Short-term memory full. Processing to mid-term.")
             self.updater.process_short_term_to_mid_term()
+
+        self.short_term_memory.add_qa_pair(qa_pair)
+        print(f"Memoryos: Added QA to short-term. User: {user_input[:30]}...")
         
         # After any memory addition that might impact mid-term, check for profile updates
         self._trigger_profile_and_knowledge_update_if_needed()
```

**File**: `memoryos-playground/memoryos.py` (modified, +10/-4)
```diff
@@ -183,9 +183,13 @@ def task_knowledge_extraction():
                 new_assistant_knowledge = knowledge_result.get("assistant_knowledge")
 
                 # 直接使用更新后的完整用户画像
-                if updated_user_profile and updated_user_profile.lower() != "none":
+                if (updated_user_profile and
+                        updated_user_profile.lower() != "none" and
+                        len(updated_user_profile.strip()) >= 30):
                     print("Memoryos: Updating user profile with integrated analysis...")
                     self.user_long_term_memory.update_user_profile(self.user_id, updated_user_profile, merge=False)  # 直接替换为新的完整画像
+                else:
+                    print("Memoryos: Skipping user profile update due to insufficient content.")
                 
                 # Add User Private Knowledge to user's LTM
                 if new_user_private_knowledge and new_user_private_knowledge.lower() != "none":
@@ -233,12 +237,14 @@ def add_memory(self, user_input: str, agent_response: str, timestamp: str = None
             "timestamp": timestamp
             # meta_data can be added here if it needs to be stored with the QA pair
         }
-        self.short_term_memory.add_qa_pair(qa_pair)
-        print(f"Memoryos: Added QA to short-term. User: {user_input[:30]}...")
-
+        # FIX: Migrate old entries BEFORE adding the new one to prevent
+        # silent data loss from deque auto-eviction.
         if self.short_term_memory.is_full():
             print("Memoryos: Short-term memory full. Processing to mid-term.")
             self.updater.process_short_term_to_mid_term()
+
+        self.short_term_memory.add_qa_pair(qa_pair)
+        print(f"Memoryos: Added QA to short-term. User: {user_input[:30]}...")
         
         # After any memory addition that might impact mid-term, check for profile updates
         self._trigger_profile_and_knowledge_update_if_needed()
```

**File**: `memoryos-pypi/memoryos.py` (modified, +10/-4)
```diff
@@ -183,9 +183,13 @@ def task_knowledge_extraction():
                 new_assistant_knowledge = knowledge_result.get("assistant_knowledge")
 
                 # 直接使用更新后的完整用户画像
-                if updated_user_profile and updated_user_profile.lower() != "none":
+                if (updated_user_profile and
+                        updated_user_profile.lower() != "none" and
+                        len(updated_user_profile.strip()) >= 30):
                     print("Memoryos: Updating user profile with integrated analysis...")
                     self.user_long_term_memory.update_user_profile(self.user_id, updated_user_profile, merge=False)  # 直接替换为新的完整画像
+                else:
+                    print("Memoryos: Skipping user profile update due to insufficient content.")
                 
                 # Add User Private Knowledge to user's LTM
                 if new_user_private_knowledge and new_user_private_knowledge.lower() != "none":
@@ -233,12 +237,14 @@ def add_memory(self, user_input: str, agent_response: str, timestamp: str = None
             "timestamp": timestamp
             # meta_data can be added here if it needs to be stored with the QA pair
         }
-        self.short_term_memory.add_qa_pair(qa_pair)
-        print(f"Memoryos: Added QA to short-term. User: {user_input[:30]}...")
-
+        # FIX: Migrate old entries BEFORE adding the new one to prevent
+        # silent data loss from deque auto-eviction.
         if self.short_term_memory.is_full():
             print("Memoryos: Short-term memory full. Processing to mid-term.")
             self.updater.process_short_term_to_mid_term()
+
+        self.short_term_memory.add_qa_pair(qa_pair)
+        print(f"Memoryos: Added QA to short-term. User: {user_input[:30]}...")
         
         # After any memory addition that might impact mid-term, check for profile updates
         self._trigger_profile_and_knowledge_update_if_needed()
```

---

### Incident Patch 4: `f7cdc579` (2026-03-24)
**Commit Message**: Introduce Memory Family section in README

Added a new section for the Memory Family research line, including links to relevant papers and updates.

**File**: `README.md` (modified, +14/-0)
```diff
@@ -55,6 +55,20 @@
 
 <span id='news'/>
 
+# 🧠 Memory Family 
+
+Welcome to our **Memory Family**, a research line dedicated to exploring AI Memory.
+
+> [**Survey on AI Memory: Theories, Taxonomies, Evaluations, and Emerging Trends**](http://github.com/BAI-LAB/Survey-on-AI-Memory/blob/main/Survey%20on%20AI%20Memory.pdf)  
+> **TL;DR:** Provides a unified theoretical framework for AI Memory, introducing a comprehensive taxonomy and systematically analyzing memory mechanisms, applications, and evaluation methods.  
+> 📄 Paper: http://github.com/BAI-LAB/Survey-on-AI-Memory/blob/main/Survey%20on%20AI%20Memory.pdf
+
+> [**LightSearcher: Efficient DeepSearch via Experiential Memory**](https://arxiv.org/abs/2512.06653)  
+> **TL;DR:** Introduces experiential memory into deep search systems, enabling models to learn from successful reasoning trajectories and improve search efficiency.  
+> 📄 Paper: https://arxiv.org/abs/2512.06653
+
+
+
 ## 📣 Latest News
 *   *<mark>[new]</mark>* 🔥🔥🔥  **[2025-09-11]**: **✨Released** [Survey on AI Memory: Theories, Taxonomies, Evaluations, and Emerging Trends](https://github.com/BAI-LAB/Survey-on-AI-Memory)!
 *   *<mark>[new]</mark>* 🔥🔥  **[2025-09-11]**: **🚀Open-sourced** the [Playground platform](#playground-getting-started)!
```

---

### Incident Patch 5: `fb388a98` (2026-03-02)
**Commit Message**: 0302 gf get_memory_stats

**File**: `memoryos-pypi/memoryos.py` (modified, +28/-0)
```diff
@@ -358,5 +358,33 @@ def force_mid_term_analysis(self):
         self._trigger_profile_and_knowledge_update_if_needed()
         self.mid_term_heat_threshold = original_threshold # Restore original threshold
 
+    def get_memory_stats(self) -> dict:
+        """
+        Retrieve the current storage statistics of the memory system.
+        Provides read-only monitoring capabilities with minimal intrusion, allowing 
+        developers or clients to check the load status of different memory layers.
+        """
+        stats = {
+            "user_id": self.user_id,
+            "short_term_count": len(self.short_term_memory.get_all()),
+            "mid_term_sessions_count": len(self.mid_term_memory.sessions),
+        }
+        
+        # Safely attempt to retrieve long-term memory status to prevent execution failures
+        try:
+            # Verify the existence and validity of the user profile
+            profile = self.user_long_term_memory.get_raw_user_profile(self.user_id)
+            stats["has_user_profile"] = bool(profile and profile.lower() != "none" and "No detailed profile" not in profile)
+            
+            # Calculate the total number of assistant knowledge entries
+            assistant_knowledge = self.get_assistant_knowledge_summary()
+            stats["assistant_knowledge_count"] = len(assistant_knowledge) if isinstance(assistant_knowledge, list) else 0
+            
+        except Exception as e:
+            # Catch any unexpected schema or attribute errors gracefully
+            stats["long_term_stats_error"] = str(e)
+            
+        return stats
+
     def __repr__(self):
         return f"<Memoryos user_id='{self.user_id}' assistant_id='{self.assistant_id}' data_path='{self.data_storage_path}'>" 
\ No newline at end of file
```

---

### Incident Patch 6: `1f437b62` (2026-02-11)
**Commit Message**: Merge pull request #55 from OmniJax/fix/thread-safety-issue

Fix: Add thread locks to memory storage classes to prevent race conditions

**File**: `memoryos-pypi/long_term.py` (modified, +5/-2)
```diff
@@ -2,6 +2,7 @@
 import numpy as np
 import faiss
 from collections import deque
+import threading
 try:
     from .utils import get_timestamp, get_embedding, normalize_vector, ensure_directory_exists
 except ImportError:
@@ -19,6 +20,7 @@ def __init__(self, file_path, knowledge_capacity=100, embedding_model_name: str
 
         self.embedding_model_name = embedding_model_name
         self.embedding_model_kwargs = embedding_model_kwargs if embedding_model_kwargs is not None else {}
+        self.lock = threading.Lock()
         self.load()
 
     def update_user_profile(self, user_id, new_data, merge=True):
@@ -144,8 +146,9 @@ def save(self):
             "assistant_knowledge": list(self.assistant_knowledge)
         }
         try:
-            with open(self.file_path, "w", encoding="utf-8") as f:
-                json.dump(data, f, ensure_ascii=False, indent=2)
+            with self.lock:
+                with open(self.file_path, "w", encoding="utf-8") as f:
+                    json.dump(data, f, ensure_ascii=False, indent=2)
         except IOError as e:
             print(f"Error saving LongTermMemory to {self.file_path}: {e}")
 
```

**File**: `memoryos-pypi/mid_term.py` (modified, +5/-2)
```diff
@@ -3,6 +3,7 @@
 from collections import defaultdict
 import faiss
 import heapq
+import threading
 from datetime import datetime
 
 try:
@@ -46,6 +47,7 @@ def __init__(self, file_path: str, client: OpenAIClient, max_capacity=2000, embe
 
         self.embedding_model_name = embedding_model_name
         self.embedding_model_kwargs = embedding_model_kwargs if embedding_model_kwargs is not None else {}
+        self.lock = threading.Lock()
         self.load()
 
     def get_page_by_id(self, page_id):
@@ -370,8 +372,9 @@ def save(self):
             # "heap_snapshot": self.heap 
         }
         try:
-            with open(self.file_path, "w", encoding="utf-8") as f:
-                json.dump(data_to_save, f, ensure_ascii=False, indent=2)
+            with self.lock:
+                with open(self.file_path, "w", encoding="utf-8") as f:
+                    json.dump(data_to_save, f, ensure_ascii=False, indent=2)
         except IOError as e:
             print(f"Error saving MidTermMemory to {self.file_path}: {e}")
 
```

**File**: `memoryos-pypi/short_term.py` (modified, +5/-2)
```diff
@@ -1,5 +1,6 @@
 import json
 from collections import deque
+import threading
 try:
     from .utils import get_timestamp, ensure_directory_exists
 except ImportError:
@@ -11,6 +12,7 @@ def __init__(self, file_path, max_capacity=10):
         self.file_path = file_path
         ensure_directory_exists(self.file_path)
         self.memory = deque(maxlen=max_capacity)
+        self.lock = threading.Lock()
         self.load()
 
     def add_qa_pair(self, qa_pair):
@@ -38,8 +40,9 @@ def pop_oldest(self):
 
     def save(self):
         try:
-            with open(self.file_path, "w", encoding="utf-8") as f:
-                json.dump(list(self.memory), f, ensure_ascii=False, indent=2)
+            with self.lock:
+                with open(self.file_path, "w", encoding="utf-8") as f:
+                    json.dump(list(self.memory), f, ensure_ascii=False, indent=2)
         except IOError as e:
             print(f"Error saving ShortTermMemory to {self.file_path}: {e}")
 
```

---

### Incident Patch 7: `97453e46` (2026-02-11)
**Commit Message**: Fix: Add thread locks to memory storage classes to prevent race conditions

This commit introduces threading locks to `ShortTermMemory`, `MidTermMemory`, and `LongTermMemory` classes to ensure thread safety during file write operations.

Problem:
- In multi-threaded environments (e.g., when running as an MCP server or handling concurrent requests), multiple threads might attempt to write to the JSON storage files simultaneously.
- This race condition can lead to data corruption, lost memory entries, or file truncation.

Solution:
- Added `self.lock = threading.Lock()` to the `__init__` method of each memory class.
- Wrapped all `json.dump` operations within `save()` methods using a `with self.lock:` context manager.
- This ensures that file writes are atomic and serialized, preventing concurrent write conflicts.

Changes:
- Modified `memoryos-pypi/short_term.py`
- Modified `memoryos-pypi/mid_term.py`
- Modified `memoryos-pypi/long_term.py`

**File**: `memoryos-pypi/long_term.py` (modified, +5/-2)
```diff
@@ -2,6 +2,7 @@
 import numpy as np
 import faiss
 from collections import deque
+import threading
 try:
     from .utils import get_timestamp, get_embedding, normalize_vector, ensure_directory_exists
 except ImportError:
@@ -19,6 +20,7 @@ def __init__(self, file_path, knowledge_capacity=100, embedding_model_name: str
 
         self.embedding_model_name = embedding_model_name
         self.embedding_model_kwargs = embedding_model_kwargs if embedding_model_kwargs is not None else {}
+        self.lock = threading.Lock()
         self.load()
 
     def update_user_profile(self, user_id, new_data, merge=True):
@@ -144,8 +146,9 @@ def save(self):
             "assistant_knowledge": list(self.assistant_knowledge)
         }
         try:
-            with open(self.file_path, "w", encoding="utf-8") as f:
-                json.dump(data, f, ensure_ascii=False, indent=2)
+            with self.lock:
+                with open(self.file_path, "w", encoding="utf-8") as f:
+                    json.dump(data, f, ensure_ascii=False, indent=2)
         except IOError as e:
             print(f"Error saving LongTermMemory to {self.file_path}: {e}")
 
```

**File**: `memoryos-pypi/mid_term.py` (modified, +5/-2)
```diff
@@ -3,6 +3,7 @@
 from collections import defaultdict
 import faiss
 import heapq
+import threading
 from datetime import datetime
 
 try:
@@ -46,6 +47,7 @@ def __init__(self, file_path: str, client: OpenAIClient, max_capacity=2000, embe
 
         self.embedding_model_name = embedding_model_name
         self.embedding_model_kwargs = embedding_model_kwargs if embedding_model_kwargs is not None else {}
+        self.lock = threading.Lock()
         self.load()
 
     def get_page_by_id(self, page_id):
@@ -370,8 +372,9 @@ def save(self):
             # "heap_snapshot": self.heap 
         }
         try:
-            with open(self.file_path, "w", encoding="utf-8") as f:
-                json.dump(data_to_save, f, ensure_ascii=False, indent=2)
+            with self.lock:
+                with open(self.file_path, "w", encoding="utf-8") as f:
+                    json.dump(data_to_save, f, ensure_ascii=False, indent=2)
         except IOError as e:
             print(f"Error saving MidTermMemory to {self.file_path}: {e}")
 
```

**File**: `memoryos-pypi/short_term.py` (modified, +5/-2)
```diff
@@ -1,5 +1,6 @@
 import json
 from collections import deque
+import threading
 try:
     from .utils import get_timestamp, ensure_directory_exists
 except ImportError:
@@ -11,6 +12,7 @@ def __init__(self, file_path, max_capacity=10):
         self.file_path = file_path
         ensure_directory_exists(self.file_path)
         self.memory = deque(maxlen=max_capacity)
+        self.lock = threading.Lock()
         self.load()
 
     def add_qa_pair(self, qa_pair):
@@ -38,8 +40,9 @@ def pop_oldest(self):
 
     def save(self):
         try:
-            with open(self.file_path, "w", encoding="utf-8") as f:
-                json.dump(list(self.memory), f, ensure_ascii=False, indent=2)
+            with self.lock:
+                with open(self.file_path, "w", encoding="utf-8") as f:
+                    json.dump(list(self.memory), f, ensure_ascii=False, indent=2)
         except IOError as e:
             print(f"Error saving ShortTermMemory to {self.file_path}: {e}")
 
```

---

### Incident Patch 8: `e788d0d4` (2025-07-18)
**Commit Message**: Delete memoryos-chromadb directory

**File**: `memoryos-chromadb/__init__.py` (removed, +0/-3)
```diff
@@ -1,3 +0,0 @@
-from .memoryos import Memoryos
-
-__all__ = ['Memoryos'] 
\ No newline at end of file
```

**File**: `memoryos-chromadb/comprehensive_test.py` (removed, +0/-189)
```diff
@@ -1,189 +0,0 @@
-#!/usr/bin/env python3
-"""
-Complete Travel Planning Conversation Test Script
-Testing Memory System's Query Response Capability
-"""
-
-import sys
-import os
-import json
-import time
-sys.path.append('.')
-
-from memoryos import Memoryos
-
-def main():
-    print("=" * 60)
-    print("🚀 MemoryOS Travel Planning Memory Test")
-    print("=" * 60)
-    
-    # Create Memoryos instance
-    memoryos = Memoryos(
-        user_id='travel_user_test',
-        openai_api_key='',
-        openai_base_url='',
-        data_storage_path='./comprehensive_test_data',
-        assistant_id='travel_assistant',
-        embedding_model_name='BAAI/bge-m3',
-        mid_term_capacity=1000,
-        mid_term_heat_threshold=13.0,
-        mid_term_similarity_threshold=0.7,
-        short_term_capacity=2
-    )
-    
-    print("📝 Phase 1: Adding 30 rounds of travel planning conversations...")
-    
-    # 30 rounds of rich travel planning conversations in English
-    conversations = [
-        # Basic information and travel preferences (1-10)
-        ("Hello, I want to plan a trip", "Hello! I'd be happy to help you plan your trip. Where would you like to travel?"),
-        ("My name is Emily, I'm 28 years old, and I'm a graphic designer", "Nice to meet you, Emily! As a graphic designer, you must have great aesthetic taste."),
-        ("I prefer artistic and cultural travel destinations", "Artistic places are very charming! Do you prefer historical culture or modern art?"),
-        ("I prefer historical culture, ancient architecture and museums", "Historical culture is very enriching! Have you considered European or Asian ancient cities?"),
-        ("I want to go to Japan, especially Kyoto and Nara", "Japan's ancient capitals are beautiful! Kyoto's temples and Nara's deer are very famous."),
-        ("I'm planning to go in October for about 7-10 days", "October is the best season to visit Japan! The autumn foliage season is beautiful."),
-        ("My budget is around 15,000-20,000 yuan", "That's a reasonable budget! We can arrange a very nice itinerary."),
-        ("I prefer niche places, don't want to go to overly commercialized spots", "I understand! You prefer experiencing local culture rather than tourist hotspots."),
-        ("Yes, I hope to deeply experience local life", "Deep travel is very meaningful! Would you like to try staying at a guesthouse or traditional inn?"),
-        ("I want to experience traditional Japanese ryokan", "Japanese ryokan are very special! Hot springs and kaiseki cuisine are worth experiencing."),
-        
-        # Specific itinerary planning (11-20)
-        ("Can you recommend some niche temples in Kyoto?", "I recommend Sanzen-in, Jakko-in, and Tenryu-ji in Arashiyama."),
-        ("I'm very interested in traditional handicrafts", "Kyoto has many traditional crafts! Kiyomizu pottery and Nishijin weaving are very famous."),
-        ("Can you arrange some handicraft experience courses?", "Of course! Pottery, kimono making, and tea ceremony all have experience courses."),
-        ("I want to learn tea ceremony, do I need to make a reservation?", "Tea ceremony experiences need advance booking, let me check available times for you."),
-        ("Besides Kyoto, what do you recommend in Nara?", "Nara's Todai-ji Temple, Kasuga Taisha Shrine are worth seeing, plus Deer Park."),
-        ("I heard Nara has many alleys with great atmosphere", "Yes! Naramachi's old streets have great charm, with many traditional shops."),
-        ("How should I arrange transportation?", "I suggest buying a JR Kansai Area Pass, transportation between Kyoto and Nara is very convenient."),
-        ("I want to go to some restaurants recommended by locals", "I recommend some local shops not in tourist guides, very authentic!"),
-        ("Do you have vegetarian restaurant recommendations? I pay attention to healthy eating", "Kyoto has many shojin ryori restaurants, both healthy and cultural experience."),
-        ("I want to learn about local festival culture", "In October there's Jidai Matsuri, one of Kyoto's three major festivals, very worth seeing!"),
-        
-        # In-depth needs and personal preferences (21-30)
-        ("I enjoy photography, what are some good photo spots?", "Bamboo Grove, Fushimi Inari's thousands of torii gates are perfect for photography!"),
-        ("I especially like photographing architecture and people", "You'll definitely love Kinkaku-ji's reflection and the geisha district streetscapes."),
-        ("I don't like crowded places", "I recommend some early morning time slots, fewer tourists and great lighting."),
-        ("I want to buy some traditional crafts as souvenirs", "Nishijin weaving items and Kiyomizu pottery tea sets have great collectible value."),
-        ("Are there any seasonal experience activities?", "In October you can participate in momiji-gari (autumn leaf viewing) and hot spring bathing while viewing maples."),
-        ("I wa
```

**File**: `memoryos-chromadb/long_term.py` (removed, +0/-98)
```diff
@@ -1,98 +0,0 @@
-import json
-import numpy as np
-from typing import Optional, Dict, Any
-
-try:
-    from .utils import get_timestamp, get_embedding, normalize_vector, OpenAIClient, gpt_user_profile_analysis, gpt_knowledge_extraction
-    from .storage_provider import ChromaStorageProvider
-except ImportError:
-    from utils import get_timestamp, get_embedding, normalize_vector, OpenAIClient, gpt_user_profile_analysis, gpt_knowledge_extraction
-    from storage_provider import ChromaStorageProvider
-
-class LongTermMemory:
-    def __init__(self, 
-                 storage_provider: ChromaStorageProvider, 
-                 llm_interface: OpenAIClient,
-                 knowledge_capacity=100, 
-                 embedding_model_name: str = "all-MiniLM-L6-v2", 
-                 embedding_model_kwargs: Optional[dict] = None):
-        self.storage = storage_provider
-        self.llm_interface = llm_interface
-        self.knowledge_capacity = knowledge_capacity
-        self.embedding_model_name = embedding_model_name
-        self.embedding_model_kwargs = embedding_model_kwargs or {}
-
-    def update_user_profile(self, user_id: str, conversation_history: str) -> Optional[Dict[str, Any]]:
-        """
-        Generates a new user profile based on conversation history and updates it in storage.
-        """
-        existing_profile_str = json.dumps(self.get_user_profile(user_id) or {})
-        
-        updated_profile = gpt_user_profile_analysis(
-            conversation_str=conversation_history,
-            client=self.llm_interface,
-            existing_user_profile=existing_profile_str
-        )
-        
-        if updated_profile:
-            self.storage.update_user_profile(user_id, updated_profile)
-            print(f"LongTermMemory: Updated user profile for {user_id}.")
-            return updated_profile
-        return None
-
-    def get_user_profile(self, user_id: str) -> Optional[Dict[str, Any]]:
-        return self.storage.get_user_profile(user_id)
-
-    def add_knowledge(self, knowledge_text: str, knowledge_type: str = "user"):
-        """
-        Adds a knowledge entry (for user or assistant) to ChromaDB.
-        knowledge_type can be 'user' or 'assistant'.
-        """
-        print(f"DEBUG: add_knowledge received text: '{knowledge_text}'") # Debugging line
-        if not knowledge_text or knowledge_text.strip().lower() in ["", "none", "- none", "- none."]:
-            print(f"LongTermMemory: Empty {knowledge_type} knowledge received, not saving.")
-            return
-        
-        vec = get_embedding(
-            knowledge_text, 
-            model_name=self.embedding_model_name, 
-            **self.embedding_model_kwargs
-        )
-        vec = normalize_vector(vec).tolist()
-        
-        if knowledge_type == "user":
-            self.storage.add_user_knowledge(knowledge_text, vec)
-        else:
-            self.storage.add_assistant_knowledge(knowledge_text, vec)
-        
-        self.storage.enforce_knowledge_capacity(knowledge_type, self.knowledge_capacity)
-
-    def extract_knowledge_from_text(self, text: str) -> Optional[Dict[str, Any]]:
-        """
-        Uses an LLM to extract structured knowledge from a block of text.
-        """
-        if not text.strip():
-            return None
-        return gpt_knowledge_extraction(conversation_str=text, client=self.llm_interface)
-
-    def get_user_knowledge(self) -> list:
-        return self.storage.get_all_user_knowledge()
-
-    def get_assistant_knowledge(self) -> list:
-        return self.storage.get_all_assistant_knowledge()
-
-    def search_knowledge(self, query: str, knowledge_type: str = "user", top_k=5) -> list:
-        query_vec = get_embedding(
-            query, 
-            model_name=self.embedding_model_name, 
-            **self.embedding_model_kwargs
-        )
-        query_vec = normalize_vector(query_vec).tolist()
-        
-        if knowledge_type == "user":
-            results = self.storage.search_user_knowledge(query_vec, top_k=top_k)
-        else:
-            results = self.storage.search_assistant_knowledge(query_vec, top_k=top_k)
-        
-        print(f"LongTermMemory: Searched {knowledge_type} knowledge for '{query[:30]}...'. Found {len(results)} matches.")
-        return results 
\ No newline at end of file
```

**File**: `memoryos-chromadb/memoryos.py` (removed, +0/-390)
```diff
@@ -1,390 +0,0 @@
-import os
-import json
-import atexit
-from concurrent.futures import ThreadPoolExecutor, as_completed
-
-# 修改为绝对导入
-try:
-    # 尝试相对导入（当作为包使用时）
-    from .utils import OpenAIClient, get_timestamp, generate_id, gpt_user_profile_analysis, gpt_knowledge_extraction, ensure_directory_exists
-    from . import prompts
-    from .storage_provider import ChromaStorageProvider
-    from .short_term import ShortTermMemory
-    from .mid_term import MidTermMemory, compute_segment_heat # For H_THRESHOLD logic
-    from .long_term import LongTermMemory
-    from .updater import Updater
-    from .retriever import Retriever
-except ImportError:
-    # 回退到绝对导入（当作为独立模块使用时）
-    from utils import OpenAIClient, get_timestamp, generate_id, gpt_user_profile_analysis, gpt_knowledge_extraction, ensure_directory_exists
-    import prompts
-    from storage_provider import ChromaStorageProvider
-    from short_term import ShortTermMemory
-    from mid_term import MidTermMemory, compute_segment_heat # For H_THRESHOLD logic
-    from long_term import LongTermMemory
-    from updater import Updater
-    from retriever import Retriever
-
-# Heat threshold for triggering profile/knowledge update from mid-term memory
-H_PROFILE_UPDATE_THRESHOLD = 5.0 
-DEFAULT_ASSISTANT_ID = "default_assistant_profile"
-
-class Memoryos:
-    def __init__(self, user_id: str, 
-                 openai_api_key: str, 
-                 data_storage_path: str,
-                 openai_base_url = None, 
-                 assistant_id: str = DEFAULT_ASSISTANT_ID, 
-                 short_term_capacity=10,
-                 mid_term_capacity=2000,
-                 long_term_knowledge_capacity=100,
-                 retrieval_queue_capacity=7,
-                 mid_term_heat_threshold=H_PROFILE_UPDATE_THRESHOLD,
-                 mid_term_similarity_threshold=0.6,
-                 llm_model="gpt-4o-mini",
-                 embedding_model_name: str = "all-MiniLM-L6-v2",
-                 embedding_model_kwargs = None
-                 ):
-        self.user_id = user_id
-        self.assistant_id = assistant_id
-        self.data_storage_path = os.path.abspath(data_storage_path)
-        self.llm_model = llm_model
-        self.mid_term_similarity_threshold = mid_term_similarity_threshold
-        self.embedding_model_name = embedding_model_name
-        
-        # Smart defaults for embedding_model_kwargs
-        if embedding_model_kwargs is None:
-            if 'bge-m3' in self.embedding_model_name.lower():
-                print("INFO: Detected bge-m3 model, defaulting embedding_model_kwargs to {'use_fp16': True}")
-                self.embedding_model_kwargs = {'use_fp16': True}
-            else:
-                self.embedding_model_kwargs = {}
-        else:
-            self.embedding_model_kwargs = dict(embedding_model_kwargs)  # Ensure it's a mutable dict
-        
-        print(f"Initializing Memoryos for user '{self.user_id}' and assistant '{self.assistant_id}'. Data path: {self.data_storage_path}")
-        print(f"Using unified LLM model: {self.llm_model}")
-        print(f"Using embedding model: {self.embedding_model_name} with kwargs: {self.embedding_model_kwargs}")
-
-        # Initialize OpenAI Client
-        self.client = OpenAIClient(api_key=openai_api_key, base_url=openai_base_url)
-        
-        # Centralized Storage Provider
-        storage_path = os.path.join(self.data_storage_path, "chroma_storage")
-        self.storage_provider = ChromaStorageProvider(
-            path=storage_path, 
-            user_id=self.user_id, 
-            assistant_id=self.assistant_id
-        )
-
-        # Register save handler to be called on exit
-        atexit.register(self.close)
-
-        # Initialize Memory Modules with the shared storage provider
-        self.short_term_memory = ShortTermMemory(
-            storage_provider=self.storage_provider,
-            max_capacity=short_term_capacity
-        )
-        self.mid_term_memory = MidTermMemory(
-            storage_provider=self.storage_provider,
-            user_id=self.user_id,
-            client=self.client, 
-            max_capacity=mid_term_capacity,
-            embedding_model_name=self.embedding_model_name,
-            embedding_model_kwargs=self.embedding_model_kwargs
-        )
-        self.user_long_term_memory = LongTermMemory(
-            storage_provider=self.storage_provider,
-            llm_interface=self.client,
-            embedding_model_name=self.embedding_model_name,
-            embedding_model_kwargs=self.embedding_model_kwargs
-        )
-
-        # Initialize Memory Module for Assistant Knowledge
-        self.assistant_long_term_memory = LongTermMemory(
-            storage_provider=self.storage_provider,
-            llm_interface=self.client,
-            embedding_model_name=self.embedding_model_name,
-            embedding_model_kwargs=self.embedding_model_kwargs
-        )
-
-        # Initialize Orchestration Modules
-
```

**File**: `memoryos-chromadb/mid_term.py` (removed, +0/-359)
```diff
@@ -1,359 +0,0 @@
-import json
-import numpy as np
-from collections import defaultdict
-import heapq
-from datetime import datetime
-from typing import Optional
-
-try:
-    from .utils import (
-        get_timestamp, generate_id, get_embedding, normalize_vector, 
-        extract_keywords_from_multi_summary, compute_time_decay, ensure_directory_exists, OpenAIClient
-    )
-    from .storage_provider import ChromaStorageProvider
-except ImportError:
-    from utils import (
-        get_timestamp, generate_id, get_embedding, normalize_vector, 
-        extract_keywords_from_multi_summary, compute_time_decay, ensure_directory_exists, OpenAIClient
-    )
-    from storage_provider import ChromaStorageProvider
-
-# Heat computation constants (can be tuned or made configurable)
-HEAT_ALPHA = 1.0
-HEAT_BETA = 1.0
-HEAT_GAMMA = 1
-RECENCY_TAU_HOURS = 24 # For R_recency calculation in compute_segment_heat
-
-def compute_segment_heat(session, alpha=HEAT_ALPHA, beta=HEAT_BETA, gamma=HEAT_GAMMA, tau_hours=RECENCY_TAU_HOURS):
-    N_visit = session.get("N_visit", 0)
-    L_interaction = session.get("L_interaction", 0)
-    
-    # Calculate recency based on last_visit_time
-    R_recency = 1.0 # Default if no last_visit_time
-    if session.get("last_visit_time"):
-        R_recency = compute_time_decay(session["last_visit_time"], get_timestamp(), tau_hours)
-    
-    session["R_recency"] = R_recency # Update session's recency factor
-    return alpha * N_visit + beta * L_interaction + gamma * R_recency
-
-class MidTermMemory:
-    def __init__(self, 
-                 storage_provider: ChromaStorageProvider,
-                 user_id: str, 
-                 client: OpenAIClient, 
-                 max_capacity=2000,
-                 embedding_model_name: str = "all-MiniLM-L6-v2", 
-                 embedding_model_kwargs: Optional[dict] = None):
-        self.user_id = user_id
-        self.client = client
-        self.max_capacity = max_capacity
-        self.storage = storage_provider
-        
-        # Load sessions and other data from the shared storage provider's in-memory metadata
-        self.sessions: dict = self.storage.get_mid_term_sessions()
-        self.access_frequency: defaultdict[str, int] = self.storage.get_access_frequency()
-        self.heap: list = self.storage.get_heap_state()
-        
-        # If heap is empty, rebuild it from loaded sessions
-        if not self.heap and self.sessions:
-            self.rebuild_heap()
-
-        self.embedding_model_name = embedding_model_name
-        self.embedding_model_kwargs = embedding_model_kwargs if embedding_model_kwargs is not None else {}
-
-    def get_page_by_id(self, page_id):
-        return self.storage.get_page_by_id(page_id)
-
-    def update_page_connections(self, prev_page_id, next_page_id):
-        if prev_page_id:
-            self.storage.update_page_connections(prev_page_id, {"next_page": next_page_id})
-        if next_page_id:
-            self.storage.update_page_connections(next_page_id, {"pre_page": prev_page_id})
-
-    def evict_lfu(self):
-        if not self.access_frequency or not self.sessions:
-            return
-        
-        lfu_sid = min(self.access_frequency, key=lambda k: self.access_frequency[k])
-        print(f"MidTermMemory: LFU eviction. Session {lfu_sid} has lowest access frequency.")
-        
-        if lfu_sid not in self.sessions:
-            del self.access_frequency[lfu_sid] # Clean up access frequency if session already gone
-            self.rebuild_heap()
-            return
-        
-        # Remove from storage
-        self.storage.delete_mid_term_session(lfu_sid)
-        
-        # Remove from local data structures
-        session_to_delete = self.sessions.pop(lfu_sid)
-        del self.access_frequency[lfu_sid]
-
-        self.rebuild_heap()
-        print(f"MidTermMemory: Evicted session {lfu_sid}.")
-
-    def add_session(self, summary, details):
-        session_id = generate_id("session")
-        summary_vec = get_embedding(
-            summary, 
-            model_name=self.embedding_model_name, 
-            **self.embedding_model_kwargs
-        )
-        summary_vec = normalize_vector(summary_vec).tolist()
-        summary_keywords = list(extract_keywords_from_multi_summary(summary, client=self.client))
-        
-        processed_details = []
-        for page_data in details:
-            page_id = page_data.get("page_id", generate_id("page"))
-            
-            # 检查是否已有embedding，避免重复计算
-            if "page_embedding" in page_data and page_data["page_embedding"]:
-                print(f"MidTermMemory: Reusing existing embedding for page {page_id}")
-                inp_vec = page_data["page_embedding"]
-                # 确保embedding是normalized的
-                if isinstance(inp_vec, list):
-                    inp_vec_np = np.array(inp_vec, dtype=np.float32)
-                    if np.linalg.norm(inp_vec_np) > 1.1 or np.linalg.norm(inp_vec_np) < 0.9: 
```

**File**: `memoryos-chromadb/prompts.py` (removed, +0/-233)
```diff
@@ -1,233 +0,0 @@
-"""
-This file stores all the prompts used by the Memoryos system.
-"""
-
-# Prompt for generating system response (from main_memoybank.py, generate_system_response_with_meta)
-GENERATE_SYSTEM_RESPONSE_SYSTEM_PROMPT = (
-    "As a communication expert with outstanding communication habits, you embody the role of {relationship} throughout the following dialogues.\n"
-    "Here are some of your distinctive personal traits and knowledge:\n{assistant_knowledge_text}\n"
-    "User's profile:\n"
-    "{meta_data_text}\n"
-    "Your task is to generate responses that align with these traits and maintain the tone.\n"
-)
-
-GENERATE_SYSTEM_RESPONSE_USER_PROMPT = (
-    "<CONTEXT>\n"
-    "Drawing from your recent conversation with the user:\n"
-    "{history_text}\n\n"
-    "<MEMORY>\n"
-    "The memories linked to the ongoing conversation are:\n"
-    "{retrieval_text}\n\n"
-    "<USER TRAITS>\n"
-    "During the conversation process between you and the user in the past, you found that the user has the following characteristics:\n"
-    "{background}\n\n"
-    "Now, please role-play as {relationship} to continue the dialogue between you and the user.\n"
-    "The user just said: {query}\n"
-    "Please respond to the user's statement using the following format (maximum 30 words, must be in English):\n "
-    "When answering questions, be sure to check whether the timestamp of the referenced information matches the timeframe of the question"
-)
-
-# Prompt for assistant knowledge extraction (from utils.py, analyze_assistant_knowledge)
-ASSISTANT_KNOWLEDGE_EXTRACTION_SYSTEM_PROMPT = """You are an assistant knowledge extraction engine. Rules:
-1. Extract ONLY explicit statements about the assistant's identity or knowledge.
-2. Use concise and factual statements in the first person.
-3. If no relevant information is found, output "None"."""
-
-ASSISTANT_KNOWLEDGE_EXTRACTION_USER_PROMPT = """
-# Assistant Knowledge Extraction Task
-Analyze the conversation and extract any fact or identity traits about the assistant. 
-If no traits can be extracted, reply with "None". Use the following format for output:
-The generated content should be as concise as possible — the more concise, the better.
-【Assistant Knowledge】
-- [Fact 1]
-- [Fact 2]
-- (Or "None" if none found)
-
-Few-shot examples:
-1. User: Can you recommend some movies.
-   AI: Yes, I recommend Interstellar.
-   Time: 2023-10-01
-   【Assistant Knowledge】
-   - I recommend Interstellar on 2023-10-01.
-
-2. User: Can you help me with cooking recipes?
-   AI: Yes, I have extensive knowledge of cooking recipes and techniques.
-   Time: 2023-10-02
-   【Assistant Knowledge】
-   - I have cooking recipes and techniques on 2023-10-02.
-
-3. User: That's interesting. I didn't know you could do that.
-   AI: I'm glad you find it interesting!
-   【Assistant Knowledge】
-   - None
-
-Conversation:
-{conversation}
-"""
-
-# Prompt for summarizing dialogs (from utils.py, gpt_summarize)
-SUMMARIZE_DIALOGS_SYSTEM_PROMPT = "You are an expert in summarizing dialogue topics. Generate extremely concise and precise summaries. Be as brief as possible while capturing the essence."
-SUMMARIZE_DIALOGS_USER_PROMPT = "Please generate an concise topic summary based on the following conversation. Keep it to 2-3 short sentences maximum:\n{dialog_text}\nConcise Summary："
-
-# Prompt for multi-summary generation (from utils.py, gpt_generate_multi_summary)
-MULTI_SUMMARY_SYSTEM_PROMPT = "You are an expert in analyzing dialogue topics. Generate  concise summaries. No more than two topics. Be as brief as possible."
-MULTI_SUMMARY_USER_PROMPT = ("Please analyze the following dialogue and generate extremely concise subtopic summaries (if applicable), with a maximum of two themes.\n"
-                           "Each summary should be very brief - just a few words for the theme and content. Format as JSON array:\n"
-                           "[\n  {{\"theme\": \"Brief theme\", \"keywords\": [\"key1\", \"key2\"], \"content\": \"summary\"}}\n]\n"
-                           "\nConversation content:\n{text}")
-
-# Prompt for personality analysis (NEW TEMPLATE)
-PERSONALITY_ANALYSIS_SYSTEM_PROMPT = """You are a professional user preference analysis assistant. Your task is to analyze the user's personality preferences from the given dialogue based on the provided dimensions.
-
-For each dimension:
-1. Carefully read the conversation and determine if the dimension is reflected.
-2. If reflected, determine the user's preference level: High / Medium / Low, and briefly explain the reasoning, including time, people, and context if possible.
-3. If the dimension is not reflected, do not extract or list it.
-
-Focus only on the user's preferences and traits for the personality analysis section.
-Output only the user profile section.
-"""
-
-PERSONALITY_ANALYSIS_USER_PROMPT = """Please analyze the latest user-AI conversation below and update the user profile based on the 90 personality preference
```

**File**: `memoryos-chromadb/requirements.txt` (removed, +0/-24)
```diff
@@ -1,24 +0,0 @@
-# MemoryOS Core Dependencies
-# Core scientific computing and ML libraries
-numpy==1.24.*
-sentence-transformers # Updated for Qwen model support
-transformers>=4.51.0              # Required for newer sentence-transformer features
-FlagEmbedding>=1.2.9                # For BGE-M3 model support
-
-# Vector database for efficient storage and retrieval
-chromadb==0.4.24
-
-openai
-# Web framework (for demo)
-flask>=2.0.0,<3.0.0
-
-# Optional utilities
-python-dotenv>=0.19.0,<2.0.0
-
-# Development and testing (optional)
-# pytest>=7.0.0,<8.0.0
-# pytest-asyncio>=0.20.0,<1.0.0
-
-# Additional dependencies for compatibility
-typing-extensions>=4.0.0,<5.0.0
-regex>=2022.1.18
```

**File**: `memoryos-chromadb/retriever.py` (removed, +0/-141)
```diff
@@ -1,141 +0,0 @@
-from collections import deque
-import heapq
-from concurrent.futures import ThreadPoolExecutor, as_completed
-from typing import Optional
-
-try:
-    from .utils import get_timestamp, OpenAIClient, run_parallel_tasks
-    from .short_term import ShortTermMemory
-    from .mid_term import MidTermMemory
-    from .long_term import LongTermMemory
-except ImportError:
-    from utils import get_timestamp, OpenAIClient, run_parallel_tasks
-    from short_term import ShortTermMemory
-    from mid_term import MidTermMemory
-    from long_term import LongTermMemory
-# from .updater import Updater # Updater is not directly used by Retriever
-
-class Retriever:
-    def __init__(self, 
-                 mid_term_memory: MidTermMemory, 
-                 user_long_term_memory: LongTermMemory, 
-                 assistant_long_term_memory: Optional[LongTermMemory] = None, # Add assistant LTM
-                 # client: OpenAIClient, # Not strictly needed if all LLM calls are within memory modules
-                 queue_capacity=7): # Default from main_memoybank was 7 for retrieval_queue
-        # Short term memory is usually for direct context, not primary retrieval source here
-        # self.short_term_memory = short_term_memory 
-        self.mid_term_memory = mid_term_memory
-        self.user_long_term_memory = user_long_term_memory
-        self.assistant_long_term_memory = assistant_long_term_memory # Store assistant LTM reference
-        # self.client = client 
-        self.retrieval_queue_capacity = queue_capacity
-        # self.retrieval_queue = deque(maxlen=queue_capacity) # This was instance level, but retrieve returns it, so maybe not needed as instance var
-
-    def _retrieve_mid_term_context(self, user_query, segment_similarity_threshold, page_similarity_threshold, top_k_sessions):
-        """并行任务：从中期记忆检索"""
-        print("Retriever: Searching mid-term memory...")
-        matched_sessions = self.mid_term_memory.search_sessions(
-            query_text=user_query, 
-            segment_similarity_threshold=segment_similarity_threshold,
-            page_similarity_threshold=page_similarity_threshold,
-            top_k_sessions=top_k_sessions
-        )
-        
-        # Use a heap to get top N pages across all relevant sessions based on their scores
-        top_pages_heap = []
-        page_counter = 0  # Add counter to ensure unique comparison
-        for session_match in matched_sessions:
-            for page_data in session_match.get("matched_pages", []):
-                # page_data directly contains the page information with relevance_score
-                page_score = page_data["relevance_score"] # Using the page relevance score directly
-                
-                # Add session relevance score to page score or combine them?
-                # For now, using page_score. Could be: page_score * session_match["session_relevance_score"]
-                combined_score = page_score # Potentially adjust with session_relevance_score
-
-                if len(top_pages_heap) < self.retrieval_queue_capacity:
-                    heapq.heappush(top_pages_heap, (combined_score, page_counter, page_data))
-                    page_counter += 1
-                elif combined_score > top_pages_heap[0][0]: # If current page is better than the worst in heap
-                    heapq.heappop(top_pages_heap)
-                    heapq.heappush(top_pages_heap, (combined_score, page_counter, page_data))
-                    page_counter += 1
-        
-        # Extract pages from heap, already sorted by heapq property (smallest first)
-        # We want highest scores, so either use a max-heap or sort after popping from min-heap.
-        retrieved_pages = [item[2] for item in sorted(top_pages_heap, key=lambda x: x[0], reverse=True)]
-        print(f"Retriever: Mid-term memory recalled {len(retrieved_pages)} pages.")
-        return retrieved_pages
-
-    def _retrieve_user_knowledge(self, user_query, knowledge_threshold, top_k_knowledge):
-        """并行任务：从用户长期知识检索"""
-        print("Retriever: Searching user long-term knowledge...")
-        retrieved_knowledge = self.user_long_term_memory.search_knowledge(
-            user_query, knowledge_type="user", top_k=top_k_knowledge
-        )
-        # Filter by threshold (assuming search_knowledge now returns similarity)
-        filtered_results = [
-            r for r in retrieved_knowledge 
-            if r.get("similarity", 0) >= knowledge_threshold
-        ]
-        print(f"Retriever: Long-term user knowledge recalled {len(filtered_results)} items.")
-        return filtered_results
-
-    def _retrieve_assistant_knowledge(self, user_query, knowledge_threshold, top_k_knowledge):
-        """并行任务：从助手长期知识检索"""
-        if not self.assistant_long_term_memory:
-            print("Retriever: No assistant long-term memory provided, skipping assistant knowledge retrieval.")
-            return []
-        
-        print("Re
```

---

### Incident Patch 9: `fc5c91ed` (2025-07-15)
**Commit Message**: Update requirements.txt

**File**: `memoryos-pypi/requirements.txt` (modified, +1/-1)
```diff
@@ -1,7 +1,7 @@
 # MemoryOS Core Dependencies
 # Core scientific computing and ML libraries
 numpy==1.24.*
-sentence-transformers>=2.7.0,<3.0.0 # Updated for Qwen model support
+sentence-transformers==5.0.0 # Updated for Qwen model support
 transformers>=4.51.0              # Required for newer sentence-transformer features
 FlagEmbedding>=1.2.9                # For BGE-M3 model support
 
```

---

### Incident Patch 10: `76c103a4` (2025-07-15)
**Commit Message**: Delete requirements.txt

**File**: `requirements.txt` (removed, +0/-5)
```diff
@@ -1,5 +0,0 @@
-openai
-numpy
-sentence-transformers
-faiss-gpu
-Flask 
```

---

### Incident Patch 11: `54282724` (2025-07-13)
**Commit Message**: Update requirements.txt

**File**: `memoryos-mcp/requirements.txt` (modified, +20/-17)
```diff
@@ -1,19 +1,22 @@
 
+numpy==1.24.*
+sentence-transformers>=2.7.0,<3.0.0 # Updated for Qwen model support
+transformers>=4.51.0              # Required for newer sentence-transformer features
+FlagEmbedding>=1.2.9                # For BGE-M3 model support
 mcp
-
-openai>=1.0.0
-
-numpy==1.24
-
-sentence-transformers>=2.2.0
-
-faiss-gpu>=1.7.0
-
-# 时间和日期处理
-python-dateutil>=2.8.0
-
-typing-extensions>=4.0.0
-
-# 可选：如果GPU不可用，可以手动安装CPU版本
-# pip uninstall faiss-gpu
-# pip install faiss-cpu>=1.7.0 
\ No newline at end of file
+faiss-gpu>=1.7.0,<2.0.0
+httpx[socks]
+openai
+# Web framework (for demo)
+flask>=2.0.0,<3.0.0
+
+# Optional utilities
+python-dotenv>=0.19.0,<2.0.0
+
+# Development and testing (optional)
+# pytest>=7.0.0,<8.0.0
+# pytest-asyncio>=0.20.0,<1.0.0
+
+# Additional dependencies for compatibility
+typing-extensions>=4.0.0,<5.0.0
+regex>=2022.1.18
```

---

### Incident Patch 12: `40787ebf` (2025-07-13)
**Commit Message**: Delete memoryos-pypi directory

**File**: `memoryos-pypi/__init__.py` (removed, +0/-3)
```diff
@@ -1,3 +0,0 @@
-from .memoryos import Memoryos
-
-__all__ = ['Memoryos'] 
\ No newline at end of file
```

**File**: `memoryos-pypi/long_term.py` (removed, +0/-159)
```diff
@@ -1,159 +0,0 @@
-import json
-import numpy as np
-import faiss
-from collections import deque
-try:
-    from .utils import get_timestamp, get_embedding, normalize_vector, ensure_directory_exists
-except ImportError:
-    from utils import get_timestamp, get_embedding, normalize_vector, ensure_directory_exists
-
-class LongTermMemory:
-    def __init__(self, file_path, knowledge_capacity=100):
-        self.file_path = file_path
-        ensure_directory_exists(self.file_path)
-        self.knowledge_capacity = knowledge_capacity
-        self.user_profiles = {} # {user_id: {data: "profile_string", "last_updated": "timestamp"}}
-        # Use deques for knowledge bases to easily manage capacity
-        self.knowledge_base = deque(maxlen=self.knowledge_capacity) # For general/user private knowledge
-        self.assistant_knowledge = deque(maxlen=self.knowledge_capacity) # For assistant specific knowledge
-        self.load()
-
-    def update_user_profile(self, user_id, new_data, merge=True):
-        if merge and user_id in self.user_profiles and self.user_profiles[user_id].get("data"): # Check if data exists
-            current_data = self.user_profiles[user_id]["data"]
-            if isinstance(current_data, str) and isinstance(new_data, str):
-                updated_data = f"{current_data}\n\n--- Updated on {get_timestamp()} ---\n{new_data}"
-            else: # Fallback to overwrite if types are not strings or for more complex merge
-                updated_data = new_data
-        else:
-            # If merge=False or no existing data, replace with new data
-            updated_data = new_data
-        
-        self.user_profiles[user_id] = {
-            "data": updated_data,
-            "last_updated": get_timestamp()
-        }
-        print(f"LongTermMemory: Updated user profile for {user_id} (merge={merge}).")
-        self.save()
-
-    def get_raw_user_profile(self, user_id):
-        return self.user_profiles.get(user_id, {}).get("data", "None") # Return "None" string if not found
-
-    def get_user_profile_data(self, user_id):
-        return self.user_profiles.get(user_id, {})
-
-    def add_knowledge_entry(self, knowledge_text, knowledge_deque: deque, type_name="knowledge"):
-        if not knowledge_text or knowledge_text.strip().lower() in ["", "none", "- none", "- none."]:
-            print(f"LongTermMemory: Empty {type_name} received, not saving.")
-            return
-        
-        # If deque is full, the oldest item is automatically removed when appending.
-        vec = get_embedding(knowledge_text)
-        vec = normalize_vector(vec).tolist()
-        entry = {
-            "knowledge": knowledge_text,
-            "timestamp": get_timestamp(),
-            "knowledge_embedding": vec
-        }
-        knowledge_deque.append(entry)
-        print(f"LongTermMemory: Added {type_name}. Current count: {len(knowledge_deque)}.")
-        self.save()
-
-    def add_user_knowledge(self, knowledge_text):
-        self.add_knowledge_entry(knowledge_text, self.knowledge_base, "user knowledge")
-
-    def add_assistant_knowledge(self, knowledge_text):
-        self.add_knowledge_entry(knowledge_text, self.assistant_knowledge, "assistant knowledge")
-
-    def get_user_knowledge(self):
-        return list(self.knowledge_base)
-
-    def get_assistant_knowledge(self):
-        return list(self.assistant_knowledge)
-
-    def _search_knowledge_deque(self, query, knowledge_deque: deque, threshold=0.1, top_k=5):
-        if not knowledge_deque:
-            return []
-        
-        query_vec = get_embedding(query)
-        query_vec = normalize_vector(query_vec)
-        
-        embeddings = []
-        valid_entries = []
-        for entry in knowledge_deque:
-            if "knowledge_embedding" in entry and entry["knowledge_embedding"]:
-                embeddings.append(np.array(entry["knowledge_embedding"], dtype=np.float32))
-                valid_entries.append(entry)
-            else:
-                print(f"Warning: Entry without embedding found in knowledge_deque: {entry.get('knowledge','N/A')[:50]}")
-
-        if not embeddings:
-            return []
-            
-        embeddings_np = np.array(embeddings, dtype=np.float32)
-        if embeddings_np.ndim == 1: # Single item case
-            if embeddings_np.shape[0] == 0: return [] # Empty embeddings
-            embeddings_np = embeddings_np.reshape(1, -1)
-        
-        if embeddings_np.shape[0] == 0: # No valid embeddings
-            return []
-
-        dim = embeddings_np.shape[1]
-        index = faiss.IndexFlatIP(dim) # Using Inner Product for similarity
-        index.add(embeddings_np)
-        
-        query_arr = np.array([query_vec], dtype=np.float32)
-        distances, indices = index.search(query_arr, min(top_k, len(valid_entries))) # Search at most k or length of valid_entries
-        
-        results = []
-        for i, idx in enumerate(indices[0]):
-            if idx != -1: # fa
```

**File**: `memoryos-pypi/memoryos.py` (removed, +0/-332)
```diff
@@ -1,332 +0,0 @@
-import os
-import json
-from concurrent.futures import ThreadPoolExecutor, as_completed
-
-# 修改为绝对导入
-try:
-    # 尝试相对导入（当作为包使用时）
-    from .utils import OpenAIClient, get_timestamp, generate_id, gpt_user_profile_analysis, gpt_knowledge_extraction, ensure_directory_exists
-    from . import prompts
-    from .short_term import ShortTermMemory
-    from .mid_term import MidTermMemory, compute_segment_heat # For H_THRESHOLD logic
-    from .long_term import LongTermMemory
-    from .updater import Updater
-    from .retriever import Retriever
-except ImportError:
-    # 回退到绝对导入（当作为独立模块使用时）
-    from utils import OpenAIClient, get_timestamp, generate_id, gpt_user_profile_analysis, gpt_knowledge_extraction, ensure_directory_exists
-    import prompts
-    from short_term import ShortTermMemory
-    from mid_term import MidTermMemory, compute_segment_heat # For H_THRESHOLD logic
-    from long_term import LongTermMemory
-    from updater import Updater
-    from retriever import Retriever
-
-# Heat threshold for triggering profile/knowledge update from mid-term memory
-H_PROFILE_UPDATE_THRESHOLD = 5.0 
-DEFAULT_ASSISTANT_ID = "default_assistant_profile"
-
-class Memoryos:
-    def __init__(self, user_id: str, 
-                 openai_api_key: str, 
-                 data_storage_path: str,
-                 openai_base_url: str = None, 
-                 assistant_id: str = DEFAULT_ASSISTANT_ID, 
-                 short_term_capacity=10,
-                 mid_term_capacity=2000,
-                 long_term_knowledge_capacity=100,
-                 retrieval_queue_capacity=7,
-                 mid_term_heat_threshold=H_PROFILE_UPDATE_THRESHOLD,
-                 mid_term_similarity_threshold=0.6,  # 新增：中期记忆插入相似度阈值
-                 llm_model="gpt-4o-mini" # Unified model for all LLM operations
-                 ):
-        self.user_id = user_id
-        self.assistant_id = assistant_id
-        self.data_storage_path = os.path.abspath(data_storage_path)
-        self.llm_model = llm_model
-        os.environ["llm_model"]= llm_model
-        self.mid_term_similarity_threshold = mid_term_similarity_threshold
-
-        print(f"Initializing Memoryos for user '{self.user_id}' and assistant '{self.assistant_id}'. Data path: {self.data_storage_path}")
-        print(f"Using unified LLM model: {self.llm_model}")
-
-        # Initialize OpenAI Client
-        self.client = OpenAIClient(api_key=openai_api_key, base_url=openai_base_url)
-
-        # Define file paths for user-specific data
-        self.user_data_dir = os.path.join(self.data_storage_path, "users", self.user_id)
-        user_short_term_path = os.path.join(self.user_data_dir, "short_term.json")
-        user_mid_term_path = os.path.join(self.user_data_dir, "mid_term.json")
-        user_long_term_path = os.path.join(self.user_data_dir, "long_term_user.json") # User profile and their knowledge
-
-        # Define file paths for assistant-specific data (knowledge)
-        self.assistant_data_dir = os.path.join(self.data_storage_path, "assistants", self.assistant_id)
-        assistant_long_term_path = os.path.join(self.assistant_data_dir, "long_term_assistant.json")
-
-        # Ensure directories exist
-        ensure_directory_exists(user_short_term_path) # ensure_directory_exists operates on the file path, creating parent dirs
-        ensure_directory_exists(user_mid_term_path)
-        ensure_directory_exists(user_long_term_path)
-        ensure_directory_exists(assistant_long_term_path)
-
-        # Initialize Memory Modules for User
-        self.short_term_memory = ShortTermMemory(file_path=user_short_term_path, max_capacity=short_term_capacity)
-        self.mid_term_memory = MidTermMemory(file_path=user_mid_term_path, client=self.client, max_capacity=mid_term_capacity)
-        self.user_long_term_memory = LongTermMemory(file_path=user_long_term_path, knowledge_capacity=long_term_knowledge_capacity)
-
-        # Initialize Memory Module for Assistant Knowledge
-        self.assistant_long_term_memory = LongTermMemory(file_path=assistant_long_term_path, knowledge_capacity=long_term_knowledge_capacity)
-
-        # Initialize Orchestration Modules
-        self.updater = Updater(short_term_memory=self.short_term_memory, 
-                               mid_term_memory=self.mid_term_memory, 
-                               long_term_memory=self.user_long_term_memory, # Updater primarily updates user's LTM profile/knowledge
-                               client=self.client,
-                               topic_similarity_threshold=mid_term_similarity_threshold,  # 传递中期记忆相似度阈值
-                               llm_model=self.llm_model)
-        self.retriever = Retriever(
-            mid_term_memory=self.mid_term_memory,
-            long_term_memory=self.user_long_term_memory,
-            assistant_long_term_memory=self.assistant_long_term_memory, # Pass assistant LTM
-            queue_capacity=retrieval_queue_capacity
-        
```

**File**: `memoryos-pypi/mid_term.py` (removed, +0/-370)
```diff
@@ -1,370 +0,0 @@
-import json
-import numpy as np
-from collections import defaultdict
-import faiss
-import heapq
-from datetime import datetime
-
-try:
-    from .utils import (
-        get_timestamp, generate_id, get_embedding, normalize_vector, 
-        llm_extract_keywords, compute_time_decay, ensure_directory_exists, OpenAIClient
-    )
-except ImportError:
-    from utils import (
-        get_timestamp, generate_id, get_embedding, normalize_vector, 
-        llm_extract_keywords, compute_time_decay, ensure_directory_exists, OpenAIClient
-    )
-
-# Heat computation constants (can be tuned or made configurable)
-HEAT_ALPHA = 1.0
-HEAT_BETA = 1.0
-HEAT_GAMMA = 1
-RECENCY_TAU_HOURS = 24 # For R_recency calculation in compute_segment_heat
-
-def compute_segment_heat(session, alpha=HEAT_ALPHA, beta=HEAT_BETA, gamma=HEAT_GAMMA, tau_hours=RECENCY_TAU_HOURS):
-    N_visit = session.get("N_visit", 0)
-    L_interaction = session.get("L_interaction", 0)
-    
-    # Calculate recency based on last_visit_time
-    R_recency = 1.0 # Default if no last_visit_time
-    if session.get("last_visit_time"):
-        R_recency = compute_time_decay(session["last_visit_time"], get_timestamp(), tau_hours)
-    
-    session["R_recency"] = R_recency # Update session's recency factor
-    return alpha * N_visit + beta * L_interaction + gamma * R_recency
-
-class MidTermMemory:
-    def __init__(self, file_path: str, client: OpenAIClient, max_capacity=2000):
-        self.file_path = file_path
-        ensure_directory_exists(self.file_path)
-        self.client = client
-        self.max_capacity = max_capacity
-        self.sessions = {} # {session_id: session_object}
-        self.access_frequency = defaultdict(int) # {session_id: access_count_for_lfu}
-        self.heap = []  # Min-heap storing (-H_segment, session_id) for hottest segments
-        self.load()
-
-    def get_page_by_id(self, page_id):
-        for session in self.sessions.values():
-            for page in session.get("details", []):
-                if page.get("page_id") == page_id:
-                    return page
-        return None
-
-    def update_page_connections(self, prev_page_id, next_page_id):
-        if prev_page_id:
-            prev_page = self.get_page_by_id(prev_page_id)
-            if prev_page:
-                prev_page["next_page"] = next_page_id
-        if next_page_id:
-            next_page = self.get_page_by_id(next_page_id)
-            if next_page:
-                next_page["pre_page"] = prev_page_id
-        # self.save() # Avoid saving on every minor update; save at higher level operations
-
-    def evict_lfu(self):
-        if not self.access_frequency or not self.sessions:
-            return
-        
-        lfu_sid = min(self.access_frequency, key=self.access_frequency.get)
-        print(f"MidTermMemory: LFU eviction. Session {lfu_sid} has lowest access frequency.")
-        
-        if lfu_sid not in self.sessions:
-            del self.access_frequency[lfu_sid] # Clean up access frequency if session already gone
-            self.rebuild_heap()
-            return
-        
-        session_to_delete = self.sessions.pop(lfu_sid) # Remove from sessions
-        del self.access_frequency[lfu_sid] # Remove from LFU tracking
-
-        # Clean up page connections if this session's pages were linked
-        for page in session_to_delete.get("details", []):
-            prev_page_id = page.get("pre_page")
-            next_page_id = page.get("next_page")
-            # If a page from this session was linked to an external page, nullify the external link
-            if prev_page_id and not self.get_page_by_id(prev_page_id): # Check if prev page is still in memory
-                 # This case should ideally not happen if connections are within sessions or handled carefully
-                 pass 
-            if next_page_id and not self.get_page_by_id(next_page_id):
-                 pass
-            # More robustly, one might need to search all other sessions if inter-session linking was allowed
-            # For now, assuming internal consistency or that MemoryOS class manages higher-level links
-
-        self.rebuild_heap()
-        self.save()
-        print(f"MidTermMemory: Evicted session {lfu_sid}.")
-
-    def add_session(self, summary, details):
-        session_id = generate_id("session")
-        summary_vec = get_embedding(summary)
-        summary_vec = normalize_vector(summary_vec).tolist()
-        summary_keywords = list(llm_extract_keywords(summary, client=self.client))
-        
-        processed_details = []
-        for page_data in details:
-            page_id = page_data.get("page_id", generate_id("page"))
-            
-            # 检查是否已有embedding，避免重复计算
-            if "page_embedding" in page_data and page_data["page_embedding"]:
-                print(f"MidTermMemory: Reusing existing embedding for page {page_id}")
-                inp_vec = page_data["page_embedding"]
-      
```

**File**: `memoryos-pypi/prompts.py` (removed, +0/-235)
```diff
@@ -1,235 +0,0 @@
-"""
-This file stores all the prompts used by the Memoryos system.
-"""
-
-# Prompt for generating system response (from main_memoybank.py, generate_system_response_with_meta)
-GENERATE_SYSTEM_RESPONSE_SYSTEM_PROMPT = (
-    "As a communication expert with outstanding communication habits, you embody the role of {relationship} throughout the following dialogues.\n"
-    "Here are some of your distinctive personal traits and knowledge:\n{assistant_knowledge_text}\n"
-    "User's profile:\n"
-    "{meta_data_text}\n"
-    "Your task is to generate responses that align with these traits and maintain the tone.\n"
-)
-
-GENERATE_SYSTEM_RESPONSE_USER_PROMPT = (
-    "<CONTEXT>\n"
-    "Drawing from your recent conversation with the user:\n"
-    "{history_text}\n\n"
-    "<MEMORY>\n"
-    "The memories linked to the ongoing conversation are:\n"
-    "{retrieval_text}\n\n"
-    "<USER TRAITS>\n"
-    "During the conversation process between you and the user in the past, you found that the user has the following characteristics:\n"
-    "{background}\n\n"
-    "Now, please role-play as {relationship} to continue the dialogue between you and the user.\n"
-    "The user just said: {query}\n"
-    "Please respond to the user's statement using the following format (maximum 30 words, must be in English):\n "
-    "When answering questions, be sure to check whether the timestamp of the referenced information matches the timeframe of the question"
-)
-
-# Prompt for assistant knowledge extraction (from utils.py, analyze_assistant_knowledge)
-ASSISTANT_KNOWLEDGE_EXTRACTION_SYSTEM_PROMPT = """You are an assistant knowledge extraction engine. Rules:
-1. Extract ONLY explicit statements about the assistant's identity or knowledge.
-2. Use concise and factual statements in the first person.
-3. If no relevant information is found, output "None"."""
-
-ASSISTANT_KNOWLEDGE_EXTRACTION_USER_PROMPT = """
-# Assistant Knowledge Extraction Task
-Analyze the conversation and extract any fact or identity traits about the assistant. 
-If no traits can be extracted, reply with "None". Use the following format for output:
-The generated content should be as concise as possible — the more concise, the better.
-【Assistant Knowledge】
-- [Fact 1]
-- [Fact 2]
-- (Or "None" if none found)
-
-Few-shot examples:
-1. User: Can you recommend some movies.
-   AI: Yes, I recommend Interstellar.
-   Time: 2023-10-01
-   【Assistant Knowledge】
-   - I recommend Interstellar on 2023-10-01.
-
-2. User: Can you help me with cooking recipes?
-   AI: Yes, I have extensive knowledge of cooking recipes and techniques.
-   Time: 2023-10-02
-   【Assistant Knowledge】
-   - I have cooking recipes and techniques on 2023-10-02.
-
-3. User: That's interesting. I didn't know you could do that.
-   AI: I'm glad you find it interesting!
-   【Assistant Knowledge】
-   - None
-
-Conversation:
-{conversation}
-"""
-
-# Prompt for summarizing dialogs (from utils.py, gpt_summarize)
-SUMMARIZE_DIALOGS_SYSTEM_PROMPT = "You are an expert in summarizing dialogue topics. Generate extremely concise and precise summaries. Be as brief as possible while capturing the essence."
-SUMMARIZE_DIALOGS_USER_PROMPT = "Please generate an concise topic summary based on the following conversation. Keep it to 2-3 short sentences maximum:\n{dialog_text}\nConcise Summary："
-
-# Prompt for multi-summary generation (from utils.py, gpt_generate_multi_summary)
-MULTI_SUMMARY_SYSTEM_PROMPT = "You are an expert in analyzing dialogue topics. Generate  concise summaries. No more than two topics. Be as brief as possible."
-MULTI_SUMMARY_USER_PROMPT = ("Please analyze the following dialogue and generate extremely concise subtopic summaries (if applicable), with a maximum of two themes.\n"
-                           "Each summary should be very brief - just a few words for the theme and content. Format as JSON array:\n"
-                           "[\n  {{\"theme\": \"Brief theme\", \"keywords\": [\"key1\", \"key2\"], \"content\": \"summary\"}}\n]\n"
-                           "\nConversation content:\n{text}")
-
-# Prompt for personality analysis (NEW TEMPLATE)
-PERSONALITY_ANALYSIS_SYSTEM_PROMPT = """You are a professional user preference analysis assistant. Your task is to analyze the user's personality preferences from the given dialogue based on the provided dimensions.
-
-For each dimension:
-1. Carefully read the conversation and determine if the dimension is reflected.
-2. If reflected, determine the user's preference level: High / Medium / Low, and briefly explain the reasoning, including time, people, and context if possible.
-3. If the dimension is not reflected, do not extract or list it.
-
-Focus only on the user's preferences and traits for the personality analysis section.
-Output only the user profile section.
-"""
-
-PERSONALITY_ANALYSIS_USER_PROMPT = """Please analyze the latest user-AI conversation below and update the user profile based on the 90 personality preference
```

**File**: `memoryos-pypi/requirements.txt` (removed, +0/-21)
```diff
@@ -1,21 +0,0 @@
-# MemoryOS Core Dependencies
-# Core scientific computing and ML libraries
-numpy==1.24.*
-sentence-transformers>=2.2.0,<3.0.0
-
-faiss-gpu>=1.7.0,<2.0.0
-
-openai
-# Web framework (for demo)
-flask>=2.0.0,<3.0.0
-
-# Optional utilities
-python-dotenv>=0.19.0,<2.0.0
-
-# Development and testing (optional)
-# pytest>=7.0.0,<8.0.0
-# pytest-asyncio>=0.20.0,<1.0.0
-
-# Additional dependencies for compatibility
-typing-extensions>=4.0.0,<5.0.0
-regex>=2022.1.18
```

**File**: `memoryos-pypi/retriever.py` (removed, +0/-131)
```diff
@@ -1,131 +0,0 @@
-from collections import deque
-import heapq
-from concurrent.futures import ThreadPoolExecutor, as_completed
-from typing import Optional
-
-try:
-    from .utils import get_timestamp, OpenAIClient, run_parallel_tasks
-    from .short_term import ShortTermMemory
-    from .mid_term import MidTermMemory
-    from .long_term import LongTermMemory
-except ImportError:
-    from utils import get_timestamp, OpenAIClient, run_parallel_tasks
-    from short_term import ShortTermMemory
-    from mid_term import MidTermMemory
-    from long_term import LongTermMemory
-# from .updater import Updater # Updater is not directly used by Retriever
-
-class Retriever:
-    def __init__(self, 
-                 mid_term_memory: MidTermMemory, 
-                 long_term_memory: LongTermMemory, 
-                 assistant_long_term_memory: Optional[LongTermMemory] = None, # Add assistant LTM
-                 # client: OpenAIClient, # Not strictly needed if all LLM calls are within memory modules
-                 queue_capacity=7): # Default from main_memoybank was 7 for retrieval_queue
-        # Short term memory is usually for direct context, not primary retrieval source here
-        # self.short_term_memory = short_term_memory 
-        self.mid_term_memory = mid_term_memory
-        self.long_term_memory = long_term_memory
-        self.assistant_long_term_memory = assistant_long_term_memory # Store assistant LTM reference
-        # self.client = client 
-        self.retrieval_queue_capacity = queue_capacity
-        # self.retrieval_queue = deque(maxlen=queue_capacity) # This was instance level, but retrieve returns it, so maybe not needed as instance var
-
-    def _retrieve_mid_term_context(self, user_query, segment_similarity_threshold, page_similarity_threshold, top_k_sessions):
-        """并行任务：从中期记忆检索"""
-        print("Retriever: Searching mid-term memory...")
-        matched_sessions = self.mid_term_memory.search_sessions(
-            query_text=user_query, 
-            segment_similarity_threshold=segment_similarity_threshold,
-            page_similarity_threshold=page_similarity_threshold,
-            top_k_sessions=top_k_sessions
-        )
-        
-        # Use a heap to get top N pages across all relevant sessions based on their scores
-        top_pages_heap = []
-        page_counter = 0  # Add counter to ensure unique comparison
-        for session_match in matched_sessions:
-            for page_match in session_match.get("matched_pages", []):
-                page_data = page_match["page_data"]
-                page_score = page_match["score"] # Using the page score directly
-                
-                # Add session relevance score to page score or combine them?
-                # For now, using page_score. Could be: page_score * session_match["session_relevance_score"]
-                combined_score = page_score # Potentially adjust with session_relevance_score
-
-                if len(top_pages_heap) < self.retrieval_queue_capacity:
-                    heapq.heappush(top_pages_heap, (combined_score, page_counter, page_data))
-                    page_counter += 1
-                elif combined_score > top_pages_heap[0][0]: # If current page is better than the worst in heap
-                    heapq.heappop(top_pages_heap)
-                    heapq.heappush(top_pages_heap, (combined_score, page_counter, page_data))
-                    page_counter += 1
-        
-        # Extract pages from heap, already sorted by heapq property (smallest first)
-        # We want highest scores, so either use a max-heap or sort after popping from min-heap.
-        retrieved_pages = [item[2] for item in sorted(top_pages_heap, key=lambda x: x[0], reverse=True)]
-        print(f"Retriever: Mid-term memory recalled {len(retrieved_pages)} pages.")
-        return retrieved_pages
-
-    def _retrieve_user_knowledge(self, user_query, knowledge_threshold, top_k_knowledge):
-        """并行任务：从用户长期知识检索"""
-        print("Retriever: Searching user long-term knowledge...")
-        retrieved_knowledge = self.long_term_memory.search_user_knowledge(
-            user_query, threshold=knowledge_threshold, top_k=top_k_knowledge
-        )
-        print(f"Retriever: Long-term user knowledge recalled {len(retrieved_knowledge)} items.")
-        return retrieved_knowledge
-
-    def _retrieve_assistant_knowledge(self, user_query, knowledge_threshold, top_k_knowledge):
-        """并行任务：从助手长期知识检索"""
-        if not self.assistant_long_term_memory:
-            print("Retriever: No assistant long-term memory provided, skipping assistant knowledge retrieval.")
-            return []
-        
-        print("Retriever: Searching assistant long-term knowledge...")
-        retrieved_knowledge = self.assistant_long_term_memory.search_assistant_knowledge(
-            user_query, threshold=knowledge_threshold, top_k=top_k_knowledge
-        )
-        print(f"Retriever: Long-term assistant kno
```

**File**: `memoryos-pypi/short_term.py` (removed, +0/-64)
```diff
@@ -1,64 +0,0 @@
-import json
-from collections import deque
-try:
-    from .utils import get_timestamp, ensure_directory_exists
-except ImportError:
-    from utils import get_timestamp, ensure_directory_exists
-
-class ShortTermMemory:
-    def __init__(self, file_path, max_capacity=10):
-        self.max_capacity = max_capacity
-        self.file_path = file_path
-        ensure_directory_exists(self.file_path)
-        self.memory = deque(maxlen=max_capacity)
-        self.load()
-
-    def add_qa_pair(self, qa_pair):
-        # Ensure timestamp exists, add if not
-        if 'timestamp' not in qa_pair or not qa_pair['timestamp']:
-            qa_pair["timestamp"] = get_timestamp()
-        
-        self.memory.append(qa_pair)
-        print(f"ShortTermMemory: Added QA. User: {qa_pair.get('user_input','')[:30]}...")
-        self.save()
-
-    def get_all(self):
-        return list(self.memory)
-
-    def is_full(self):
-        return len(self.memory) >= self.max_capacity # Use >= to be safe
-
-    def pop_oldest(self):
-        if self.memory:
-            msg = self.memory.popleft()
-            print("ShortTermMemory: Evicted oldest QA pair.")
-            self.save()
-            return msg
-        return None
-
-    def save(self):
-        try:
-            with open(self.file_path, "w", encoding="utf-8") as f:
-                json.dump(list(self.memory), f, ensure_ascii=False, indent=2)
-        except IOError as e:
-            print(f"Error saving ShortTermMemory to {self.file_path}: {e}")
-
-    def load(self):
-        try:
-            with open(self.file_path, "r", encoding="utf-8") as f:
-                data = json.load(f)
-                # Ensure items are loaded correctly, especially if file was empty or malformed
-                if isinstance(data, list):
-                    self.memory = deque(data, maxlen=self.max_capacity)
-                else:
-                    self.memory = deque(maxlen=self.max_capacity)
-            print(f"ShortTermMemory: Loaded from {self.file_path}.")
-        except FileNotFoundError:
-            self.memory = deque(maxlen=self.max_capacity)
-            print(f"ShortTermMemory: No history file found at {self.file_path}. Initializing new memory.")
-        except json.JSONDecodeError:
-            self.memory = deque(maxlen=self.max_capacity)
-            print(f"ShortTermMemory: Error decoding JSON from {self.file_path}. Initializing new memory.")
-        except Exception as e:
-            self.memory = deque(maxlen=self.max_capacity)
-            print(f"ShortTermMemory: An unexpected error occurred during load from {self.file_path}: {e}. Initializing new memory.") 
\ No newline at end of file
```

---

### Incident Patch 13: `bf23a7f8` (2025-07-13)
**Commit Message**: Delete memoryos-mcp directory

**File**: `memoryos-mcp/config.json` (removed, +0/-13)
```diff
@@ -1,13 +0,0 @@
-{
-  "user_id": "test_user_001",
-  "openai_api_key": "",
-  "openai_base_url": "",
-  "data_storage_path": "./memoryos_data",
-  "assistant_id": "memoryos_assistant",
-  "short_term_capacity": 10,
-  "mid_term_capacity": 2000,
-  "long_term_knowledge_capacity": 100,
-  "retrieval_queue_capacity": 7,
-  "mid_term_heat_threshold": 5.0,
-  "llm_model": "gpt-4o-mini"
-} 
\ No newline at end of file
```

**File**: `memoryos-mcp/mcp.json` (removed, +0/-40)
```diff
@@ -1,40 +0,0 @@
-{
-  "mcpServers": {
-    "memoryos": {
-      "command": "/root/miniconda3/envs/memos/bin/python",
-      "args": [
-        "/root/autodl-tmp/memoryos-mcp/server_new.py",
-        "--config",
-        "/root/autodl-tmp/memoryos-mcp/config.json"
-      ],
-      "env": {},
-      "description": "MemoryOS MCP Server - 智能记忆系统，提供记忆添加、检索和用户画像功能",
-      "capabilities": {
-        "tools": [
-          {
-            "name": "add_memory",
-            "description": "Add new memory to the MemoryOS system. (user_input and assistant_response pair)"
-          },
-          {
-            "name": "retrieve_memory", 
-            "description": "Retrieve related memories and context information from MemoryOS based on the query"
-          },
-          {
-            "name": "get_user_profile",
-            "description": "Get user profile information, including personality traits, preferences, and related knowledge"
-          }
-        ],
-        "resources": [
-          {
-            "uri": "memoryos://status",
-            "name": "MemoryOS系统状态"
-          },
-          {
-            "uri": "memoryos://config", 
-            "name": "MemoryOS配置信息"
-          }
-        ]
-      }
-    }
-  }
-} 
\ No newline at end of file
```

**File**: `memoryos-mcp/memoryos/__init__.py` (removed, +0/-4)
```diff
@@ -1,4 +0,0 @@
-# Import the main class for easy access
-from .memoryos import Memoryos
-
-__all__ = ['Memoryos'] 
\ No newline at end of file
```

**File**: `memoryos-mcp/memoryos/long_term.py` (removed, +0/-156)
```diff
@@ -1,156 +0,0 @@
-import json
-import numpy as np
-import faiss
-from collections import deque
-from utils import get_timestamp, get_embedding, normalize_vector, ensure_directory_exists
-
-class LongTermMemory:
-    def __init__(self, file_path, knowledge_capacity=100):
-        self.file_path = file_path
-        ensure_directory_exists(self.file_path)
-        self.knowledge_capacity = knowledge_capacity
-        self.user_profiles = {} # {user_id: {data: "profile_string", "last_updated": "timestamp"}}
-        # Use deques for knowledge bases to easily manage capacity
-        self.knowledge_base = deque(maxlen=self.knowledge_capacity) # For general/user private knowledge
-        self.assistant_knowledge = deque(maxlen=self.knowledge_capacity) # For assistant specific knowledge
-        self.load()
-
-    def update_user_profile(self, user_id, new_data, merge=True):
-        if merge and user_id in self.user_profiles and self.user_profiles[user_id].get("data"): # Check if data exists
-            current_data = self.user_profiles[user_id]["data"]
-            if isinstance(current_data, str) and isinstance(new_data, str):
-                updated_data = f"{current_data}\n\n--- Updated on {get_timestamp()} ---\n{new_data}"
-            else: # Fallback to overwrite if types are not strings or for more complex merge
-                updated_data = new_data
-        else:
-            # If merge=False or no existing data, replace with new data
-            updated_data = new_data
-        
-        self.user_profiles[user_id] = {
-            "data": updated_data,
-            "last_updated": get_timestamp()
-        }
-        print(f"LongTermMemory: Updated user profile for {user_id} (merge={merge}).")
-        self.save()
-
-    def get_raw_user_profile(self, user_id):
-        return self.user_profiles.get(user_id, {}).get("data", "None") # Return "None" string if not found
-
-    def get_user_profile_data(self, user_id):
-        return self.user_profiles.get(user_id, {})
-
-    def add_knowledge_entry(self, knowledge_text, knowledge_deque: deque, type_name="knowledge"):
-        if not knowledge_text or knowledge_text.strip().lower() in ["", "none", "- none", "- none."]:
-            print(f"LongTermMemory: Empty {type_name} received, not saving.")
-            return
-        
-        # If deque is full, the oldest item is automatically removed when appending.
-        vec = get_embedding(knowledge_text)
-        vec = normalize_vector(vec).tolist()
-        entry = {
-            "knowledge": knowledge_text,
-            "timestamp": get_timestamp(),
-            "knowledge_embedding": vec
-        }
-        knowledge_deque.append(entry)
-        print(f"LongTermMemory: Added {type_name}. Current count: {len(knowledge_deque)}.")
-        self.save()
-
-    def add_user_knowledge(self, knowledge_text):
-        self.add_knowledge_entry(knowledge_text, self.knowledge_base, "user knowledge")
-
-    def add_assistant_knowledge(self, knowledge_text):
-        self.add_knowledge_entry(knowledge_text, self.assistant_knowledge, "assistant knowledge")
-
-    def get_user_knowledge(self):
-        return list(self.knowledge_base)
-
-    def get_assistant_knowledge(self):
-        return list(self.assistant_knowledge)
-
-    def _search_knowledge_deque(self, query, knowledge_deque: deque, threshold=0.1, top_k=5):
-        if not knowledge_deque:
-            return []
-        
-        query_vec = get_embedding(query)
-        query_vec = normalize_vector(query_vec)
-        
-        embeddings = []
-        valid_entries = []
-        for entry in knowledge_deque:
-            if "knowledge_embedding" in entry and entry["knowledge_embedding"]:
-                embeddings.append(np.array(entry["knowledge_embedding"], dtype=np.float32))
-                valid_entries.append(entry)
-            else:
-                print(f"Warning: Entry without embedding found in knowledge_deque: {entry.get('knowledge','N/A')[:50]}")
-
-        if not embeddings:
-            return []
-            
-        embeddings_np = np.array(embeddings, dtype=np.float32)
-        if embeddings_np.ndim == 1: # Single item case
-            if embeddings_np.shape[0] == 0: return [] # Empty embeddings
-            embeddings_np = embeddings_np.reshape(1, -1)
-        
-        if embeddings_np.shape[0] == 0: # No valid embeddings
-            return []
-
-        dim = embeddings_np.shape[1]
-        index = faiss.IndexFlatIP(dim) # Using Inner Product for similarity
-        index.add(embeddings_np)
-        
-        query_arr = np.array([query_vec], dtype=np.float32)
-        distances, indices = index.search(query_arr, min(top_k, len(valid_entries))) # Search at most k or length of valid_entries
-        
-        results = []
-        for i, idx in enumerate(indices[0]):
-            if idx != -1: # faiss returns -1 for no valid index
-                similarity_score = float(distances[0][i]) # For IndexFlatIP, distance is the
```

**File**: `memoryos-mcp/memoryos/memoryos.py` (removed, +0/-295)
```diff
@@ -1,295 +0,0 @@
-import os
-import json
-from utils import OpenAIClient, get_timestamp, generate_id, gpt_user_profile_analysis, gpt_knowledge_extraction, gpt_update_profile, ensure_directory_exists
-
-import prompts
-from short_term import ShortTermMemory
-from mid_term import MidTermMemory, compute_segment_heat # For H_THRESHOLD logic
-from long_term import LongTermMemory
-from updater import Updater
-from retriever import Retriever
-
-# Heat threshold for triggering profile/knowledge update from mid-term memory
-H_PROFILE_UPDATE_THRESHOLD = 5.0 
-DEFAULT_ASSISTANT_ID = "default_assistant_profile"
-
-class Memoryos:
-    def __init__(self, user_id: str, 
-                 openai_api_key: str, 
-                 data_storage_path: str,
-                 openai_base_url: str = None, 
-                 assistant_id: str = DEFAULT_ASSISTANT_ID, 
-                 short_term_capacity=10,
-                 mid_term_capacity=2000,
-                 long_term_knowledge_capacity=100,
-                 retrieval_queue_capacity=7,
-                 mid_term_heat_threshold=H_PROFILE_UPDATE_THRESHOLD,
-                 llm_model="gpt-4o-mini" # Unified model for all LLM operations
-                 ):
-        self.user_id = user_id
-        self.assistant_id = assistant_id
-        self.data_storage_path = os.path.abspath(data_storage_path)
-        self.llm_model = llm_model
-
-        print(f"Initializing Memoryos for user '{self.user_id}' and assistant '{self.assistant_id}'. Data path: {self.data_storage_path}")
-        print(f"Using unified LLM model: {self.llm_model}")
-
-        # Initialize OpenAI Client
-        self.client = OpenAIClient(api_key=openai_api_key, base_url=openai_base_url)
-
-        # Define file paths for user-specific data
-        self.user_data_dir = os.path.join(self.data_storage_path, "users", self.user_id)
-        user_short_term_path = os.path.join(self.user_data_dir, "short_term.json")
-        user_mid_term_path = os.path.join(self.user_data_dir, "mid_term.json")
-        user_long_term_path = os.path.join(self.user_data_dir, "long_term_user.json") # User profile and their knowledge
-
-        # Define file paths for assistant-specific data (knowledge)
-        self.assistant_data_dir = os.path.join(self.data_storage_path, "assistants", self.assistant_id)
-        assistant_long_term_path = os.path.join(self.assistant_data_dir, "long_term_assistant.json")
-
-        # Ensure directories exist
-        ensure_directory_exists(user_short_term_path) # ensure_directory_exists operates on the file path, creating parent dirs
-        ensure_directory_exists(user_mid_term_path)
-        ensure_directory_exists(user_long_term_path)
-        ensure_directory_exists(assistant_long_term_path)
-
-        # Initialize Memory Modules for User
-        self.short_term_memory = ShortTermMemory(file_path=user_short_term_path, max_capacity=short_term_capacity)
-        self.mid_term_memory = MidTermMemory(file_path=user_mid_term_path, client=self.client, max_capacity=mid_term_capacity)
-        self.user_long_term_memory = LongTermMemory(file_path=user_long_term_path, knowledge_capacity=long_term_knowledge_capacity)
-
-        # Initialize Memory Module for Assistant Knowledge
-        self.assistant_long_term_memory = LongTermMemory(file_path=assistant_long_term_path, knowledge_capacity=long_term_knowledge_capacity)
-
-        # Initialize Orchestration Modules
-        self.updater = Updater(short_term_memory=self.short_term_memory, 
-                               mid_term_memory=self.mid_term_memory, 
-                               long_term_memory=self.user_long_term_memory, # Updater primarily updates user's LTM profile/knowledge
-                               client=self.client,
-                               llm_model=self.llm_model)
-        self.retriever = Retriever(
-            mid_term_memory=self.mid_term_memory,
-            long_term_memory=self.user_long_term_memory,
-            assistant_long_term_memory=self.assistant_long_term_memory, # Pass assistant LTM
-            queue_capacity=retrieval_queue_capacity
-        )
-        
-        self.mid_term_heat_threshold = mid_term_heat_threshold
-
-    def _trigger_profile_and_knowledge_update_if_needed(self):
-        """
-        Checks mid-term memory for hot segments and triggers profile/knowledge update if threshold is met.
-        Adapted from main_memoybank.py's update_user_profile_from_top_segment.
-        """
-        if not self.mid_term_memory.heap:
-            return
-
-        # Peek at the top of the heap (hottest segment)
-        # MidTermMemory heap stores (-H_segment, sid)
-        neg_heat, sid = self.mid_term_memory.heap[0] 
-        current_heat = -neg_heat
-
-        if current_heat >= self.mid_term_heat_threshold:
-            session = self.mid_term_memory.sessions.get(sid)
-            if not session:
-                self.mid_term_memory.rebuild_heap() # Clean up if session is gone
-                r
```

**File**: `memoryos-mcp/memoryos/mid_term.py` (removed, +0/-324)
```diff
@@ -1,324 +0,0 @@
-import json
-import numpy as np
-from collections import defaultdict
-import faiss
-import heapq
-from datetime import datetime
-
-from utils import (
-    get_timestamp, generate_id, get_embedding, normalize_vector, 
-    llm_extract_keywords, compute_time_decay, ensure_directory_exists, OpenAIClient
-)
-
-# Heat computation constants (can be tuned or made configurable)
-HEAT_ALPHA = 1.0
-HEAT_BETA = 1.0
-HEAT_GAMMA = 1
-RECENCY_TAU_HOURS = 24 # For R_recency calculation in compute_segment_heat
-
-def compute_segment_heat(session, alpha=HEAT_ALPHA, beta=HEAT_BETA, gamma=HEAT_GAMMA, tau_hours=RECENCY_TAU_HOURS):
-    N_visit = session.get("N_visit", 0)
-    L_interaction = session.get("L_interaction", 0)
-    
-    # Calculate recency based on last_visit_time
-    R_recency = 1.0 # Default if no last_visit_time
-    if session.get("last_visit_time"):
-        R_recency = compute_time_decay(session["last_visit_time"], get_timestamp(), tau_hours)
-    
-    session["R_recency"] = R_recency # Update session's recency factor
-    return alpha * N_visit + beta * L_interaction + gamma * R_recency
-
-class MidTermMemory:
-    def __init__(self, file_path: str, client: OpenAIClient, max_capacity=2000):
-        self.file_path = file_path
-        ensure_directory_exists(self.file_path)
-        self.client = client
-        self.max_capacity = max_capacity
-        self.sessions = {} # {session_id: session_object}
-        self.access_frequency = defaultdict(int) # {session_id: access_count_for_lfu}
-        self.heap = []  # Min-heap storing (-H_segment, session_id) for hottest segments
-        self.load()
-
-    def get_page_by_id(self, page_id):
-        for session in self.sessions.values():
-            for page in session.get("details", []):
-                if page.get("page_id") == page_id:
-                    return page
-        return None
-
-    def update_page_connections(self, prev_page_id, next_page_id):
-        if prev_page_id:
-            prev_page = self.get_page_by_id(prev_page_id)
-            if prev_page:
-                prev_page["next_page"] = next_page_id
-        if next_page_id:
-            next_page = self.get_page_by_id(next_page_id)
-            if next_page:
-                next_page["pre_page"] = prev_page_id
-        # self.save() # Avoid saving on every minor update; save at higher level operations
-
-    def evict_lfu(self):
-        if not self.access_frequency or not self.sessions:
-            return
-        
-        lfu_sid = min(self.access_frequency, key=self.access_frequency.get)
-        print(f"MidTermMemory: LFU eviction. Session {lfu_sid} has lowest access frequency.")
-        
-        if lfu_sid not in self.sessions:
-            del self.access_frequency[lfu_sid] # Clean up access frequency if session already gone
-            self.rebuild_heap()
-            return
-        
-        session_to_delete = self.sessions.pop(lfu_sid) # Remove from sessions
-        del self.access_frequency[lfu_sid] # Remove from LFU tracking
-
-        # Clean up page connections if this session's pages were linked
-        for page in session_to_delete.get("details", []):
-            prev_page_id = page.get("pre_page")
-            next_page_id = page.get("next_page")
-            # If a page from this session was linked to an external page, nullify the external link
-            if prev_page_id and not self.get_page_by_id(prev_page_id): # Check if prev page is still in memory
-                 # This case should ideally not happen if connections are within sessions or handled carefully
-                 pass 
-            if next_page_id and not self.get_page_by_id(next_page_id):
-                 pass
-            # More robustly, one might need to search all other sessions if inter-session linking was allowed
-            # For now, assuming internal consistency or that MemoryOS class manages higher-level links
-
-        self.rebuild_heap()
-        self.save()
-        print(f"MidTermMemory: Evicted session {lfu_sid}.")
-
-    def add_session(self, summary, details):
-        session_id = generate_id("session")
-        summary_vec = get_embedding(summary)
-        summary_vec = normalize_vector(summary_vec).tolist()
-        summary_keywords = list(llm_extract_keywords(summary, client=self.client))
-        
-        processed_details = []
-        for page_data in details:
-            page_id = page_data.get("page_id", generate_id("page"))
-            full_text = f"User: {page_data.get('user_input','')} Assistant: {page_data.get('agent_response','')}"
-            inp_vec = get_embedding(full_text)
-            inp_vec = normalize_vector(inp_vec).tolist()
-            page_keywords = list(llm_extract_keywords(full_text, client=self.client))
-            
-            processed_page = {
-                **page_data, # Carry over existing fields like user_input, agent_response, timestamp
-                "page_id": page_id,
-                "page_e
```

**File**: `memoryos-mcp/memoryos/prompts.py` (removed, +0/-238)
```diff
@@ -1,238 +0,0 @@
-"""
-This file stores all the prompts used by the Memoryos system.
-"""
-
-# Prompt for generating system response (from main_memoybank.py, generate_system_response_with_meta)
-GENERATE_SYSTEM_RESPONSE_SYSTEM_PROMPT = (
-    "As a communication expert with outstanding communication habits, you embody the role of {relationship} throughout the following dialogues.\n"
-    "Here are some of your distinctive personal traits and knowledge:\n{assistant_knowledge_text}\n"
-    "User's profile:\n"
-    "{meta_data_text}\n"
-    "Your task is to generate responses that align with these traits and maintain the tone.\n"
-)
-
-GENERATE_SYSTEM_RESPONSE_USER_PROMPT = (
-    "<CONTEXT>\n"
-    "Drawing from your recent conversation with the user:\n"
-    "{history_text}\n\n"
-    "<MEMORY>\n"
-    "The memories linked to the ongoing conversation are:\n"
-    "{retrieval_text}\n\n"
-    "<USER TRAITS>\n"
-    "During the conversation process between you and the user in the past, you found that the user has the following characteristics:\n"
-    "{background}\n\n"
-    "Now, please role-play as {relationship} to continue the dialogue between you and the user.\n"
-    "The user just said: {query}\n"
-    "Please respond to the user's statement using the following format (maximum 30 words, must be in English):\n "
-    "When answering questions, be sure to check whether the timestamp of the referenced information matches the timeframe of the question"
-)
-
-# Prompt for assistant knowledge extraction (from utils.py, analyze_assistant_knowledge)
-ASSISTANT_KNOWLEDGE_EXTRACTION_SYSTEM_PROMPT = """You are an assistant knowledge extraction engine. Rules:
-1. Extract ONLY explicit statements about the assistant's identity or knowledge.
-2. Use concise and factual statements in the first person.
-3. If no relevant information is found, output "None"."""
-
-ASSISTANT_KNOWLEDGE_EXTRACTION_USER_PROMPT = """
-# Assistant Knowledge Extraction Task
-Analyze the conversation and extract any fact or identity traits about the assistant. 
-If no traits can be extracted, reply with "None". Use the following format for output:
-The generated content should be as concise as possible — the more concise, the better.
-【Assistant Knowledge】
-- [Fact 1]
-- [Fact 2]
-- (Or "None" if none found)
-
-Few-shot examples:
-1. User: Can you recommend some movies.
-   AI: Yes, I recommend Interstellar.
-   Time: 2023-10-01
-   【Assistant Knowledge】
-   - I recommend Interstellar on 2023-10-01.
-
-2. User: Can you help me with cooking recipes?
-   AI: Yes, I have extensive knowledge of cooking recipes and techniques.
-   Time: 2023-10-02
-   【Assistant Knowledge】
-   - I have cooking recipes and techniques on 2023-10-02.
-
-3. User: That's interesting. I didn't know you could do that.
-   AI: I'm glad you find it interesting!
-   【Assistant Knowledge】
-   - None
-
-Conversation:
-{conversation}
-"""
-
-# Prompt for summarizing dialogs (from utils.py, gpt_summarize)
-SUMMARIZE_DIALOGS_SYSTEM_PROMPT = "You are an expert in summarizing dialogue topics. Generate extremely concise and precise summaries. Be as brief as possible while capturing the essence."
-SUMMARIZE_DIALOGS_USER_PROMPT = "Please generate an concise topic summary based on the following conversation. Keep it to 2-3 short sentences maximum:\n{dialog_text}\nConcise Summary："
-
-# Prompt for multi-summary generation (from utils.py, gpt_generate_multi_summary)
-MULTI_SUMMARY_SYSTEM_PROMPT = "You are an expert in analyzing dialogue topics. Generate  concise summaries. No more than two topics. Be as brief as possible."
-MULTI_SUMMARY_USER_PROMPT = ("Please analyze the following dialogue and generate extremely concise subtopic summaries (if applicable), with a maximum of two themes.\n"
-                           "Each summary should be very brief - just a few words for the theme and content. Format as JSON array:\n"
-                           "[\n  {{\"theme\": \"Brief theme\", \"keywords\": [\"key1\", \"key2\"], \"content\": \"summary\"}}\n]\n"
-                           "\nConversation content:\n{text}")
-
-# Prompt for personality analysis (NEW TEMPLATE)
-PERSONALITY_ANALYSIS_SYSTEM_PROMPT = """You are a professional user preference analysis assistant. Your task is to analyze the user's personality preferences from the given dialogue based on the provided dimensions.
-
-For each dimension:
-1. Carefully read the conversation and determine if the dimension is reflected.
-2. If reflected, determine the user's preference level: High / Medium / Low, and briefly explain the reasoning, including time, people, and context if possible.
-3. If the dimension is not reflected, do not extract or list it.
-
-Focus only on the user's preferences and traits for the personality analysis section.
-Output only the user profile section.
-"""
-
-PERSONALITY_ANALYSIS_USER_PROMPT = """Please analyze the latest user-AI conversation below based on the 90 personality preference dimensions.
-
-Here are the
```

**File**: `memoryos-mcp/memoryos/retriever.py` (removed, +0/-101)
```diff
@@ -1,101 +0,0 @@
-from collections import deque
-import heapq
-from utils import get_timestamp, OpenAIClient # OpenAIClient might not be directly used here but good for consistency
-from short_term import ShortTermMemory
-from mid_term import MidTermMemory
-from long_term import LongTermMemory
-# from .updater import Updater # Updater is not directly used by Retriever
-
-class Retriever:
-    def __init__(self, 
-                 mid_term_memory: MidTermMemory, 
-                 long_term_memory: LongTermMemory, 
-                 assistant_long_term_memory: LongTermMemory = None, # Add assistant LTM
-                 # client: OpenAIClient, # Not strictly needed if all LLM calls are within memory modules
-                 queue_capacity=7): # Default from main_memoybank was 7 for retrieval_queue
-        # Short term memory is usually for direct context, not primary retrieval source here
-        # self.short_term_memory = short_term_memory 
-        self.mid_term_memory = mid_term_memory
-        self.long_term_memory = long_term_memory
-        self.assistant_long_term_memory = assistant_long_term_memory # Store assistant LTM reference
-        # self.client = client 
-        self.retrieval_queue_capacity = queue_capacity
-        # self.retrieval_queue = deque(maxlen=queue_capacity) # This was instance level, but retrieve returns it, so maybe not needed as instance var
-
-    def retrieve_context(self, user_query: str, 
-                         user_id: str, # Needed for profile, can be used for context filtering if desired
-                         segment_similarity_threshold=0.1,  # From main_memoybank example
-                         page_similarity_threshold=0.1,     # From main_memoybank example
-                         knowledge_threshold=0.01,          # From main_memoybank example
-                         top_k_sessions=5,                  # From MidTermMemory search default
-                         top_k_knowledge=20                  # Default for knowledge search
-                         ):
-        print(f"Retriever: Starting retrieval for query: '{user_query[:50]}...'")
-        
-        # 1. Retrieve from Mid-Term Memory
-        # MidTermMemory.search_sessions now takes client for its internal keyword extraction
-        # It also returns a more structured result including scores.
-        matched_sessions = self.mid_term_memory.search_sessions(
-            query_text=user_query, 
-            segment_similarity_threshold=segment_similarity_threshold,
-            page_similarity_threshold=page_similarity_threshold,
-            top_k_sessions=top_k_sessions
-        )
-        
-        # Use a heap to get top N pages across all relevant sessions based on their scores
-        top_pages_heap = []
-        page_counter = 0  # Add counter to ensure unique comparison
-        for session_match in matched_sessions:
-            for page_match in session_match.get("matched_pages", []):
-                page_data = page_match["page_data"]
-                page_score = page_match["score"] # Using the page score directly
-                
-                # Add session relevance score to page score or combine them?
-                # For now, using page_score. Could be: page_score * session_match["session_relevance_score"]
-                combined_score = page_score # Potentially adjust with session_relevance_score
-
-                if len(top_pages_heap) < self.retrieval_queue_capacity:
-                    heapq.heappush(top_pages_heap, (combined_score, page_counter, page_data))
-                    page_counter += 1
-                elif combined_score > top_pages_heap[0][0]: # If current page is better than the worst in heap
-                    heapq.heappop(top_pages_heap)
-                    heapq.heappush(top_pages_heap, (combined_score, page_counter, page_data))
-                    page_counter += 1
-        
-        # Extract pages from heap, already sorted by heapq property (smallest first)
-        # We want highest scores, so either use a max-heap or sort after popping from min-heap.
-        retrieved_mid_term_pages = [item[2] for item in sorted(top_pages_heap, key=lambda x: x[0], reverse=True)]
-        print(f"Retriever: Mid-term memory recalled {len(retrieved_mid_term_pages)} pages.")
-
-        # 2. Retrieve from Long-Term User Knowledge (specific to the user)
-        # Assuming LongTermMemory for a user stores their specific knowledge/private data.
-        # The main LongTermMemory class in `long_term.py` has `search_user_knowledge` which doesn't need user_id as it's implicit in the instance
-        # However, if a single LTM instance handles multiple users, it would need user_id.
-        # For the Memoryos class, LTM will be user-specific or assistant-specific.
-        retrieved_user_knowledge = self.long_term_memory.search_user_knowledge(
-            user_query, threshold=knowledge_threshold, top_k=top_k_knowledge
-        )
-        print(f"Retriever: 
```

---

### Incident Patch 14: `f8faf055` (2025-07-12)
**Commit Message**: fix models changing by set it by variable names

**File**: `memoryos-pypi/utils.py` (modified, +17/-2)
```diff
@@ -73,7 +73,9 @@ def batch_chat_completion(self, requests):
         futures = []
         for req in requests:
             future = self.chat_completion_async(
-                model=req.get("model", "gpt-4o-mini"),
+                model=req.get("model",     
+                               model=os.environ.get("llm_model") 
+                              ),
                 messages=req["messages"],
                 temperature=req.get("temperature", 0.7),
                 max_tokens=req.get("max_tokens", 2000)
@@ -183,6 +185,7 @@ def compute_time_decay(event_timestamp_str, current_timestamp_str, tau_hours=24)
 # ---- LLM-based Utility Functions ----
 
 def gpt_summarize_dialogs(dialogs, client: OpenAIClient, model="gpt-4o-mini"):
+    model=os.environ.get("llm_model") or model
     dialog_text = "\n".join([f"User: {d.get('user_input','')} Assistant: {d.get('agent_response','')}" for d in dialogs])
     messages = [
         {"role": "system", "content": prompts.SUMMARIZE_DIALOGS_SYSTEM_PROMPT},
@@ -192,6 +195,7 @@ def gpt_summarize_dialogs(dialogs, client: OpenAIClient, model="gpt-4o-mini"):
     return client.chat_completion(model=model, messages=messages)
 
 def gpt_generate_multi_summary(text, client: OpenAIClient, model="gpt-4o-mini"):
+    model=os.environ.get("llm_model") or model
     messages = [
         {"role": "system", "content": prompts.MULTI_SUMMARY_SYSTEM_PROMPT},
         {"role": "user", "content": prompts.MULTI_SUMMARY_USER_PROMPT.format(text=text)}
@@ -211,6 +215,7 @@ def gpt_user_profile_analysis(dialogs, client: OpenAIClient, model="gpt-4o-mini"
     Analyze and update user personality profile from dialogs
     结合现有画像和新对话，直接输出更新后的完整画像
     """
+    model=os.environ.get("llm_model") or model
     conversation = "\n".join([f"User: {d.get('user_input','')} (Timestamp: {d.get('timestamp', '')})\nAssistant: {d.get('agent_response','')} (Timestamp: {d.get('timestamp', '')})" for d in dialogs])
     messages = [
         {"role": "system", "content": prompts.PERSONALITY_ANALYSIS_SYSTEM_PROMPT},
@@ -226,6 +231,7 @@ def gpt_user_profile_analysis(dialogs, client: OpenAIClient, model="gpt-4o-mini"
 
 def gpt_knowledge_extraction(dialogs, client: OpenAIClient, model="gpt-4o-mini"):
     """Extract user private data and assistant knowledge from dialogs"""
+    model=os.environ.get("llm_model") or model
     conversation = "\n".join([f"User: {d.get('user_input','')} (Timestamp: {d.get('timestamp', '')})\nAssistant: {d.get('agent_response','')} (Timestamp: {d.get('timestamp', '')})" for d in dialogs])
     messages = [
         {"role": "system", "content": prompts.KNOWLEDGE_EXTRACTION_SYSTEM_PROMPT},
@@ -270,6 +276,7 @@ def gpt_personality_analysis(dialogs, client: OpenAIClient, model="gpt-4o-mini",
     This function is kept for backward compatibility only.
     """
     # Call the new functions
+    model=os.environ.get("llm_model") or model
     profile = gpt_user_profile_analysis(dialogs, client, model, known_user_traits)
     knowledge_data = gpt_knowledge_extraction(dialogs, client, model)
     
@@ -281,6 +288,7 @@ def gpt_personality_analysis(dialogs, client: OpenAIClient, model="gpt-4o-mini",
 
 
 def gpt_update_profile(old_profile, new_analysis, client: OpenAIClient, model="gpt-4o-mini"):
+    model=os.environ.get("llm_model") or model
     messages = [
         {"role": "system", "content": prompts.UPDATE_PROFILE_SYSTEM_PROMPT},
         {"role": "user", "content": prompts.UPDATE_PROFILE_USER_PROMPT.format(old_profile=old_profile, new_analysis=new_analysis)}
@@ -289,6 +297,8 @@ def gpt_update_profile(old_profile, new_analysis, client: OpenAIClient, model="g
     return client.chat_completion(model=model, messages=messages)
 
 def gpt_extract_theme(answer_text, client: OpenAIClient, model="gpt-4o-mini"):
+    model=os.environ.get("llm_model") or model
+
     messages = [
         {"role": "system", "content": prompts.EXTRACT_THEME_SYSTEM_PROMPT},
         {"role": "user", "content": prompts.EXTRACT_THEME_USER_PROMPT.format(answer_text=answer_text)}
@@ -297,6 +307,9 @@ def gpt_extract_theme(answer_text, client: OpenAIClient, model="gpt-4o-mini"):
     return client.chat_completion(model=model, messages=messages)
 
 def llm_extract_keywords(text, client: OpenAIClient, model="gpt-4o-mini"):
+    
+    model=os.environ.get("llm_model") or model
+
     messages = [
         {"role": "system", "content": prompts.EXTRACT_KEYWORDS_SYSTEM_PROMPT},
         {"role": "user", "content": prompts.EXTRACT_KEYWORDS_USER_PROMPT.format(text=text)}
@@ -309,7 +322,8 @@ def llm_extract_keywords(text, client: OpenAIClient, model="gpt-4o-mini"):
 def check_conversation_continuity(previous_page, current_page, client: OpenAIClient, model="gpt-4o-mini"):
     prev_user = previous_page.get("user_input", "") if previous_page else ""
     prev_agent = previous_page.get("agent_response", "") if previous_page else ""
-    
+    model=os.environ.get("llm_model") or model
+
     user_prompt = prompts.CONTINUITY_CHECK
```

---

### Incident Patch 15: `f6ec2eda` (2025-07-12)
**Commit Message**: fix changing models bug

there bug in utils function which is when set model name to gemini or any other model name it don't effect this functions and remain gpt-4o-mini to solve this i will set variable name to model name model=os.environ.get("llm_model") or model in each function

**File**: `memoryos-pypi/memoryos.py` (modified, +2/-1)
```diff
@@ -44,6 +44,7 @@ def __init__(self, user_id: str,
         self.assistant_id = assistant_id
         self.data_storage_path = os.path.abspath(data_storage_path)
         self.llm_model = llm_model
+        os.environ["llm_model"]= llm_model
         self.mid_term_similarity_threshold = mid_term_similarity_threshold
 
         print(f"Initializing Memoryos for user '{self.user_id}' and assistant '{self.assistant_id}'. Data path: {self.data_storage_path}")
@@ -328,4 +329,4 @@ def force_mid_term_analysis(self):
         self.mid_term_heat_threshold = original_threshold # Restore original threshold
 
     def __repr__(self):
-        return f"<Memoryos user_id='{self.user_id}' assistant_id='{self.assistant_id}' data_path='{self.data_storage_path}'>" 
\ No newline at end of file
+        return f"<Memoryos user_id='{self.user_id}' assistant_id='{self.assistant_id}' data_path='{self.data_storage_path}'>" 
```

#### Recent Merged Pull Requests:
- **PR #73** (2026-07-07): Fix: Propagate thread-safety locks to memoryos-mcp and memoryos-playground (@jwchen2001)
- **PR #70** (closed): Remove hardcoded API key from playground/test.py (CWE-798) (@andesyteoss)
- **PR #69** (closed): fix: cap in-memory session storage in /init_memory to prevent DoS (CWE-400) (@andesyteoss)
- **PR #68** (closed): fix: prevent path traversal via user_id in playground Flask app (CWE-22) (@andesyteoss)
- **PR #66** (2026-04-28): 增加用户画像更新前的内容质量校验 (@NoAmateur)
- **PR #65** (2026-04-28): 修复短期记忆满容时的静默数据丢失问题 (@NoAmateur)
- **PR #64** (closed): fix: sanitize user_id to prevent path traversal in Flask web app (CWE-22) (@andesyteoss)
- **PR #63** (closed): fix: move OpenAI API key from client-side session cookie to server-side storage (CWE-200) (@andesyteoss)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
