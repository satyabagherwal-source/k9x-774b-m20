# Forensic Learning Record (Deep Inspection): codefuse-ai/codefuse-chatbot

> **Canonical Artifact**: `07_PROJECT_LEARNING/codefuse-ai-codefuse-chatbot-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/codefuse-ai/codefuse-chatbot](https://github.com/codefuse-ai/codefuse-chatbot))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-04T20:32:46.996Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `codefuse-ai/codefuse-chatbot`
- **Description**: An intelligent assistant serving the entire software development lifecycle, powered by a Multi-Agent Framework, working with DevOps Toolkits, Code&Doc Repo RAG,  etc.
- **Primary Language / Ecosystem**: Python
- **Discovered Manifests / Configurations**: README.md, Dockerfile
- **Stars / Engagement**: 1293 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: README.md, Dockerfile.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `configs/utils.py`
```
import os

def is_running_in_docker():
    """
    检查当前代码是否在 Docker 容器中运行
    """
    # 检查是否存在 /.dockerenv 文件
    if os.path.exists('/.dockerenv'):
        return True

    # 检查 cgroup 文件系统是否为 /docker/ 开头
    if os.path.exists("/proc/1/cgroup"):
        with open('/proc/1/cgroup', 'rt') as f:
            return '/docker/' in f.read()
    return False
```

### Core Architecture Module: `examples/model_workers/SparkApi.py`
```
import base64
import datetime
import hashlib
import hmac
from urllib.parse import urlparse
from datetime import datetime
from time import mktime
from urllib.parse import urlencode
from wsgiref.handlers import format_date_time


class Ws_Param(object):
    # 初始化
    def __init__(self, APPID, APIKey, APISecret, Spark_url):
        self.APPID = APPID
        self.APIKey = APIKey
        self.APISecret = APISecret
        self.host = urlparse(Spark_url).netloc
        self.path = urlparse(Spark_url).path
        self.Spark_url = Spark_url

    # 生成url
    def create_url(self):
        # 生成RFC1123格式的时间戳
        now = datetime.now()
        date = format_date_time(mktime(now.timetuple()))

        # 拼接字符串
        signature_origin = "host: " + self.host + "\n"
        signature_origin += "date: " + date + "\n"
        signature_origin += "GET " + self.path + " HTTP/1.1"

        # 进行hmac-sha256进行加密
        signature_sha = hmac.new(self.APISecret.encode('utf-8'), signature_origin.encode('utf-8'),
                                 digestmod=hashlib.sha256).digest()

        signature_sha_base64 = base64.b64encode(signature_sha).decode(encoding='utf-8')

        authorization_origin = f'api_key="{self.APIKey}", algorithm="hmac-sha256", headers="host date request-line", signature="{signature_sha_base64}"'

        authorization = base64.b64encode(authorization_origin.encode('utf-8')).decode(encoding='utf-8')

        # 将请求的鉴权参数组合为字典
        v = {
            "authorization": authorization,
            "date": date,
            "host": self.host
        }
        # 拼接鉴权参数，生成url
        url = self.Spark_url + '?' + urlencode(v)
        # 此处打印出建立连接时候的url,参考本demo的时候可取消上方打印的注释，比对相同参数时生成的url与自己代码生成的url是否一致
        return url


def gen_params(appid, domain, question, temperature, max_token):
    """
    通过appid和用户的提问来生成请参数
    """
    data = {
        "header": {
            "app_id": appid,
            "uid": "1234"
        },
        "parameter": {
            "chat": {
                "domain": domain,
                "random_threshold": 0.5,
                "max_tokens": max_token,
                "auditing": "default",
                "temperature": temperature,
            }
        },
        "payload": {
            "message": {
                "text": question
            }
        }
    }
    return data

```

### Core Architecture Module: `examples/model_workers/__init__.py`
```
############################# Attention ########################

# The Code in model workers all copied from 
# https://github.com/chatchat-space/Langchain-Chatchat/blob/master/server/model_workers

#################################################################

from .base import *
from .zhipu import ChatGLMWorker
from .minimax import MiniMaxWorker
from .xinghuo import XingHuoWorker
from .qianfan import QianFanWorker
from .fangzhou import FangZhouWorker
from .qwen import QwenWorker
from .baichuan import BaiChuanWorker
from .azure import AzureWorker
from .tiangong import TianGongWorker
from .openai import ExampleWorker


IMPORT_MODEL_WORKERS = [
    ChatGLMWorker, MiniMaxWorker, XingHuoWorker, QianFanWorker, FangZhouWorker,
    QwenWorker, BaiChuanWorker, AzureWorker, TianGongWorker, ExampleWorker
]

MODEL_WORKER_SETS = [tool.__name__ for tool in IMPORT_MODEL_WORKERS]


```

### Core Architecture Module: `examples/model_workers/azure.py`
```
import sys
from fastchat.conversation import Conversation
from .base import *
# from server.utils import get_httpx_client
from fastchat import conversation as conv
import json, os
from typing import List, Dict
from loguru import logger
# from configs import logger, log_verbose
log_verbose = os.environ.get("log_verbose", False)


class AzureWorker(ApiModelWorker):
    def __init__(
            self,
            *,
            controller_addr: str = None,
            worker_addr: str = None,
            model_names: List[str] = ["azure-api"],
            version: str = "gpt-35-turbo",
            **kwargs,
    ):
        kwargs.update(model_names=model_names, controller_addr=controller_addr, worker_addr=worker_addr)
        kwargs.setdefault("context_len", 8000) #TODO 16K模型需要改成16384
        super().__init__(**kwargs)
        self.version = version

    def do_chat(self, params: ApiChatParams) -> Dict:
        params.load_config(self.model_names[0])
        data = dict(
            messages=params.messages,
            temperature=params.temperature,
            max_tokens=params.max_tokens,
            stream=True,
        )
        url = ("https://{}.openai.azure.com/openai/deployments/{}/chat/completions?api-version={}"
               .format(params.resource_name, params.deployment_name, params.api_version))
        headers = {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            'api-key': params.api_key,
        }

        text = ""
        if log_verbose:
            logger.info(f'{self.__class__.__name__}:url: {url}')
            logger.info(f'{self.__class__.__name__}:headers: {headers}')
            logger.info(f'{self.__class__.__name__}:data: {data}')

        with get_httpx_client() as client:
            with client.stream("POST", url, headers=headers, json=data) as response:
                for line in response.iter_lines():
                    if not line.strip() or "[DONE]" in line:
                        continue
                    if line.startswith("data: "):
                        line = line[6:]
                    resp = json.loads(line)
                    if choices := resp["choices"]:
                        if chunk := choices[0].get("delta", {}).get("content"):
                            text += chunk
                            yield {
                                    "error_code": 0,
                                    "text": text
                                }
                    else:
                        self.logger.error(f"请求 Azure API 时发生错误：{resp}")

    def get_embeddings(self, params):
        # TODO: 支持embeddings
        print("embedding")
        print(params)

    def make_conv_template(self, conv_template: str = None, model_path: str = None) -> Conversation:
        # TODO: 确认模板是否需要修改
        return conv.Conversation(
            name=self.model_names[0],
            system_message="You are a helpful, respectful and honest assistant.",
            messages=[],
            roles=["user", "assistant"],
            sep="\n### ",
            stop_str="###",
        )


if __name__ == "__main__":
    import uvicorn
    from server.utils import MakeFastAPIOffline
    from fastchat.serve.base_model_worker import app

    worker = AzureWorker(
        controller_addr="http://127.0.0.1:20001",
        worker_addr="http://127.0.0.1:21008",
    )
    sys.modules["fastchat.serve.model_worker"].worker = worker
    MakeFastAPIOffline(app)
    uvicorn.run(app, port=21008)

```

### Core Architecture Module: `examples/model_workers/baichuan.py`
```
import json
import time
import hashlib

from fastchat.conversation import Conversation
from .base import *
# from server.utils import get_httpx_client
from fastchat import conversation as conv
import sys, os
import json
from typing import List, Literal, Dict
from loguru import logger
# from configs import logger, log_verbose
log_verbose = os.environ.get("log_verbose", False)

def calculate_md5(input_string):
    md5 = hashlib.md5()
    md5.update(input_string.encode('utf-8'))
    encrypted = md5.hexdigest()
    return encrypted


class BaiChuanWorker(ApiModelWorker):
    def __init__(
        self,
        *,
        controller_addr: str = None,
        worker_addr: str = None,
        model_names: List[str] = ["baichuan-api"],
        version: Literal["Baichuan2-53B"] = "Baichuan2-53B",
        **kwargs,
    ):
        kwargs.update(model_names=model_names, controller_addr=controller_addr, worker_addr=worker_addr)
        kwargs.setdefault("context_len", 32768)
        super().__init__(**kwargs)
        self.version = version

    def do_chat(self, params: ApiChatParams) -> Dict:
        params.load_config(self.model_names[0])

        url = "https://api.baichuan-ai.com/v1/stream/chat"
        data = {
            "model": params.version,
            "messages": params.messages,
            "parameters": {"temperature": params.temperature}
        }

        json_data = json.dumps(data)
        time_stamp = int(time.time())
        signature = calculate_md5(params.secret_key + json_data + str(time_stamp))
        headers = {
            "Content-Type": "application/json",
            "Authorization": "Bearer " + params.api_key,
            "X-BC-Request-Id": "your requestId",
            "X-BC-Timestamp": str(time_stamp),
            "X-BC-Signature": signature,
            "X-BC-Sign-Algo": "MD5",
        }

        text = ""
        if log_verbose:
            logger.info(f'{self.__class__.__name__}:json_data: {json_data}')
            logger.info(f'{self.__class__.__name__}:url: {url}')
            logger.info(f'{self.__class__.__name__}:headers: {headers}')

        with get_httpx_client() as client:
            with client.stream("POST", url, headers=headers, json=data) as response:
                for line in response.iter_lines():
                    if not line.strip():
                        continue
                    resp = json.loads(line)
                    if resp["code"] == 0:
                        text += resp["data"]["messages"][-1]["content"]
                        yield {
                            "error_code": resp["code"],
                            "text": text
                            }
                    else:
                        data = {
                            "error_code": resp["code"],
                            "text": resp["msg"],
                            "error": {
                                "message": resp["msg"],
                                "type": "invalid_request_error",
                                "param": None,
                                "code": None,
                            }
                        }
                        self.logger.error(f"请求百川 API 时发生错误：{data}")
                        yield data

    def get_embeddings(self, params):
        # TODO: 支持embeddings
        print("embedding")
        print(params)

    def make_conv_template(self, conv_template: str = None, model_path: str = None) -> Conversation:
        # TODO: 确认模板是否需要修改
        return conv.Conversation(
            name=self.model_names[0],
            system_message="",
            messages=[],
            roles=["user", "assistant"],
            sep="\n### ",
            stop_str="###",
        )


if __name__ == "__main__":
    import uvicorn
    from server.utils import MakeFastAPIOffline
    from fastchat.serve.model_worker import app

    worker = BaiChuanWorker(
        controller_addr="http://127.0.0.1:20001",
        worker_addr="http://127.0.0.1:21007",
    )
    sys.modules["fastchat.serve.model_worker"].worker = worker
    MakeFastAPIOffline(app)
    uvicorn.run(app, port=21007)
    # do_request()

```

### Core Architecture Module: `examples/model_workers/base.py`
```
from fastchat.conversation import Conversation
from configs.default_config import LOG_PATH
import fastchat.constants
fastchat.constants.LOGDIR = LOG_PATH
from fastchat.serve.base_model_worker import BaseModelWorker
import uuid
import json
import sys
from pydantic import BaseModel, root_validator
import fastchat
import asyncio
from examples.utils import get_model_worker_config


from typing import Dict, List, Optional


__all__ = ["ApiModelWorker", "ApiChatParams", "ApiCompletionParams", "ApiEmbeddingsParams"]


class ApiConfigParams(BaseModel):
    '''
    在线API配置参数，未提供的值会自动从model_config.ONLINE_LLM_MODEL中读取
    '''
    api_base_url: Optional[str] = None
    api_proxy: Optional[str] = None
    api_key: Optional[str] = None
    secret_key: Optional[str] = None
    group_id: Optional[str] = None # for minimax
    is_pro: bool = False # for minimax

    APPID: Optional[str] = None # for xinghuo
    APISecret: Optional[str] = None # for xinghuo
    is_v2: bool = False # for xinghuo

    worker_name: Optional[str] = None

    class Config:
        extra = "allow"

    @root_validator(pre=True)
    def validate_config(cls, v: Dict) -> Dict:
        if config := get_model_worker_config(v.get("worker_name")):
            for n in cls.__fields__:
                if n in config:
                    v[n] = config[n]
        return v

    def load_config(self, worker_name: str):
        self.worker_name = worker_name
        if config := get_model_worker_config(worker_name):
            for n in self.__fields__:
                if n in config:
                    setattr(self, n, config[n])
        return self


class ApiModelParams(ApiConfigParams):
    '''
    模型配置参数
    '''
    version: Optional[str] = None
    version_url: Optional[str] = None
    api_version: Optional[str] = None # for azure
    deployment_name: Optional[str] = None # for azure
    resource_name: Optional[str] = None # for azure

    temperature: float = 0.7
    max_tokens: Optional[int] = None
    top_p: Optional[float] = 1.0


class ApiChatParams(ApiModelParams):
    '''
    chat请求参数
    '''
    messages: List[Dict[str, str]]
    system_message: Optional[str] = None # for minimax
    role_meta: Dict = {} # for minimax


class ApiCompletionParams(ApiModelParams):
    prompt: str


class ApiEmbeddingsParams(ApiConfigParams):
    texts: List[str]
    embed_model: Optional[str] = None
    to_query: bool = False # for minimax


class ApiModelWorker(BaseModelWorker):
    DEFAULT_EMBED_MODEL: str = None # None means not support embedding

    def __init__(
        self,
        model_names: List[str],
        controller_addr: str = None,
        worker_addr: str = None,
        context_len: int = 2048,
        no_register: bool = False,
        **kwargs,
    ):
        kwargs.setdefault("worker_id", uuid.uuid4().hex[:8])
        kwargs.setdefault("model_path", "")
        kwargs.setdefault("limit_worker_concurrency", 5)
        super().__init__(model_names=model_names,
                        controller_addr=controller_addr,
                        worker_addr=worker_addr,
                        **kwargs)
        import fastchat.serve.base_model_worker
        import sys
        self.logger = fastchat.serve.base_model_worker.logger
        # 恢复被fastchat覆盖的标准输出
        sys.stdout = sys.__stdout__
        sys.stderr = sys.__stderr__

        self.context_len = context_len
        self.semaphore = asyncio.Semaphore(self.limit_worker_concurrency)
        self.version = None

        if not no_register and self.controller_addr:
            self.init_heart_beat()


    def count_token(self, params):
        # TODO：需要完善
        # print("count token")
        prompt = params["prompt"]
        return {"count": len(str(prompt)), "error_code": 0}

    def generate_stream_gate(self, params: Dict):
        self.call_ct += 1

        try:
            prompt = params["prompt"]
            if self._is_chat(prompt):
                messages = self.prompt_to_messages(prompt)
                messages = self.validate_messages(messages)
            else: # 使用chat模仿续写功能，不支持历史消息
                messages = [{"role": self.user_role, "content": f"please continue writing from here: {prompt}"}]

            p = ApiChatParams(
                messages=messages,
                temperature=params.get("temperature"),
                top_p=params.get("top_p"),
                max_tokens=params.get("max_new_tokens"),
                version=self.version,
            )
            for resp in self.do_chat(p):
                yield self._jsonify(resp)
        except Exception as e:
            yield self._jsonify({"error_code": 500, "text": f"{self.model_names[0]}请求API时发生错误：{e}"})

    def generate_gate(self, params):
        try:
            for x in self.generate_stream_gate(params):
                ...
            return json.loads(x[:-1].decode())
        except Exception as e:
            return {"error_code": 500, "text": str(e)}


    # 需要用户自定义的方法

    def do_chat(self, params: ApiChatParams) -> Dict:
        '''
        执行Chat的方法，默认使用模块里面的chat函数。
        要求返回形式：{"error_code": int, "text": str}
        '''
        return {"error_code": 500, "text": f"{self.model_names[0]}未实现chat功能"}

    # def do_completion(self, p: ApiCompletionParams) -> Dict:
    #     '''
    #     执行Completion的方法，默认使用模块里面的completion函数。
    #     要求返回形式：{"error_code": int, "text": str}
    #     '''
    #     return {"error_code": 500, "text": f"{self.model_names[0]}未实现completion功能"}

    def do_embeddings(self, params: ApiEmbeddingsParams) -> Dict:
        '''
        执行Embeddings的方法，默认使用模块里面的embed_documents函数。
        要求返回形式：{"code": int, "data": List[List[float]], "msg": str}
        '''
        return {"code": 500, "msg": f"{self.model_names[0]}未实现embeddings功能"}

    def get_embeddings(self, params):
        # fastchat对LLM做Embeddings限制很大，似乎只能使用openai的。
        # 在前端通过OpenAIEmbeddings发起的请求直接出错，无法请求过来。
        print("get_embedding")
        print(params)

    def make_conv_template(self, conv_template: str = None, model_path: str = None) -> Conversation:
        raise NotImplementedError

    def validate_messages(self, messages: List[Dict]) -> List[Dict]:
        '''
        有些API对mesages有特殊格式，可以重写该函数替换默认的messages。
        之所以跟prompt_to_messages分开，是因为他们应用场景不同、参数不同
        '''
        return messages


    # help methods
    @property
    def user_role(self):
        return self.conv.roles[0]

    @property
    def ai_role(self):
        return self.conv.roles[1]

    def _jsonify(self, data: Dict) -> str:
        '''
        将chat函数返回的结果按照fastchat openai-api-server的格式返回
        '''
        return json.dumps(data, ensure_ascii=False).encode() + b"\0"

    def _is_chat(self, prompt: str) -> bool:
        '''
        检查prompt是否由chat messages拼接而来
        TODO: 存在误判的可能，也许从fastchat直接传入原始messages是更好的做法
        '''
        key = f"{self.conv.sep}{self.user_role}:"
        return key in prompt

    def prompt_to_messages(self, prompt: str) -> List[Dict]:
        '''
        将prompt字符串拆分成messages.
        '''
        result = []
        user_role = self.user_role
        ai_role = self.ai_role
        user_start = user_role + ":"
        ai_start = ai_role + ":"
        for msg in prompt.split(self.conv.sep)[1:-1]:
            if msg.startswith(user_start):
                if content := msg[len(user_start):].strip():
                    result.append({"role": user_role, "content": content})
            elif msg.startswith(ai_start):
                if content := msg[len(ai_start):].strip():
                    result.append({"role": ai_role, "content": content})
            else:
                raise RuntimeError(f"unknown role in msg: {msg}")
        return result

    @classmethod
    def can_embedding(cls):
        return cls.DEFAULT_EMBED_MODEL is not None

```

### Core Architecture Module: `examples/model_workers/fangzhou.py`
```
from fastchat.conversation import Conversation
from .base import *
from fastchat import conversation as conv
import sys, os
from typing import List, Literal, Dict
from loguru import logger
# from configs import logger, log_verbose
log_verbose = os.environ.get("log_verbose", False)


class FangZhouWorker(ApiModelWorker):
    """
    火山方舟
    """

    def __init__(
        self,
        *,
        model_names: List[str] = ["fangzhou-api"],
        controller_addr: str = None,
        worker_addr: str = None,
        version: Literal["chatglm-6b-model"] = "chatglm-6b-model",
        **kwargs,
    ):
        kwargs.update(model_names=model_names, controller_addr=controller_addr, worker_addr=worker_addr)
        kwargs.setdefault("context_len", 16384) # TODO: 不同的模型有不同的大小
        super().__init__(**kwargs)
        self.version = version

    def do_chat(self, params: ApiChatParams) -> Dict:
        from volcengine.maas import MaasService

        params.load_config(self.model_names[0])
        maas = MaasService('maas-api.ml-platform-cn-beijing.volces.com', 'cn-beijing')
        maas.set_ak(params.api_key)
        maas.set_sk(params.secret_key)

        # document: "https://www.volcengine.com/docs/82379/1099475"
        req = {
            "model": {
                "name": params.version,
            },
            "parameters": {
                # 这里的参数仅为示例，具体可用的参数请参考具体模型的 API 说明
                "max_new_tokens": params.max_tokens,
                "temperature": params.temperature,
            },
            "messages": params.messages,
        }

        text = ""
        if log_verbose:
            self.logger.info(f'{self.__class__.__name__}:maas: {maas}')
        for resp in maas.stream_chat(req):
            if error := resp.error:
                if error.code_n > 0:
                    data = {
                            "error_code": error.code_n,
                            "text": error.message,
                            "error": {
                                "message": error.message,
                                "type": "invalid_request_error",
                                "param": None,
                                "code": None,
                            }
                        }
                    self.logger.error(f"请求方舟 API 时发生错误：{data}")
                    yield data
                elif chunk := resp.choice.message.content:
                    text += chunk
                    yield {"error_code": 0, "text": text}
            else:
                data = {
                    "error_code": 500,
                    "text": f"请求方舟 API 时发生未知的错误: {resp}"
                }
                self.logger.error(data)
                yield data
                break

    def get_embeddings(self, params):
        # TODO: 支持embeddings
        print("embedding")
        print(params)

    def make_conv_template(self, conv_template: str = None, model_path: str = None) -> Conversation:
        return conv.Conversation(
            name=self.model_names[0],
            system_message="你是一个聪明、对人类有帮助的人工智能，你可以对人类提出的问题给出有用、详细、礼貌的回答。",
            messages=[],
            roles=["user", "assistant", "system"],
            sep="\n### ",
            stop_str="###",
        )


if __name__ == "__main__":
    import uvicorn
    from server.utils import MakeFastAPIOffline
    from fastchat.serve.model_worker import app

    worker = FangZhouWorker(
        controller_addr="http://127.0.0.1:20001",
        worker_addr="http://127.0.0.1:21005",
    )
    sys.modules["fastchat.serve.model_worker"].worker = worker
    MakeFastAPIOffline(app)
    uvicorn.run(app, port=21005)

```

### Core Architecture Module: `examples/model_workers/minimax.py`
```
from fastchat.conversation import Conversation
from .base import *
from fastchat import conversation as conv
import sys
import os
import json
# from server.utils import get_httpx_client
from typing import List, Dict
from loguru import logger
# from configs import logger, log_verbose
log_verbose = os.environ.get("log_verbose", False)


class MiniMaxWorker(ApiModelWorker):
    DEFAULT_EMBED_MODEL = "embo-01"

    def __init__(
        self,
        *,
        model_names: List[str] = ["minimax-api"],
        controller_addr: str = None,
        worker_addr: str = None,
        version: str = "abab5.5-chat",
        **kwargs,
    ):
        kwargs.update(model_names=model_names, controller_addr=controller_addr, worker_addr=worker_addr)
        kwargs.setdefault("context_len", 16384)
        super().__init__(**kwargs)
        self.version = version

    def validate_messages(self, messages: List[Dict]) -> List[Dict]:
        role_maps = {
            "user": self.user_role,
            "assistant": self.ai_role,
            "system": "system",
        }
        messages = [{"sender_type": role_maps[x["role"]], "text": x["content"]} for x in messages]
        return messages

    def do_chat(self, params: ApiChatParams) -> Dict:
        # 按照官网推荐，直接调用abab 5.5模型
        # TODO: 支持指定回复要求，支持指定用户名称、AI名称
        params.load_config(self.model_names[0])

        url = 'https://api.minimax.chat/v1/text/chatcompletion{pro}?GroupId={group_id}'
        pro = "_pro" if params.is_pro else ""
        headers = {
            "Authorization": f"Bearer {params.api_key}",
            "Content-Type": "application/json",
        }
        messages = self.validate_messages(params.messages)
        data = {
            "model": params.version,
            "stream": True,
            "mask_sensitive_info": True,
            "messages": messages,
            "temperature": params.temperature,
            "top_p": params.top_p,
            "tokens_to_generate": params.max_tokens or 1024,
            # TODO: 以下参数为minimax特有，传入空值会出错。
            # "prompt": params.system_message or self.conv.system_message,
            # "bot_setting": [],
            # "role_meta": params.role_meta,
        }
        if log_verbose:
            logger.info(f'{self.__class__.__name__}:data: {data}')
            logger.info(f'{self.__class__.__name__}:url: {url.format(pro=pro, group_id=params.group_id)}')
            logger.info(f'{self.__class__.__name__}:headers: {headers}')

        with get_httpx_client() as client:
            response = client.stream("POST",
                                    url.format(pro=pro, group_id=params.group_id),
                                    headers=headers,
                                    json=data)
            with response as r:
                text = ""
                for e in r.iter_text():
                    if not e.startswith("data: "): # 真是优秀的返回
                        data = {
                                "error_code": 500,
                                "text": f"minimax返回错误的结果：{e}",
                                "error": {
                                    "message":  f"minimax返回错误的结果：{e}",
                                    "type": "invalid_request_error",
                                    "param": None,
                                    "code": None,
                                }
                        }
                        self.logger.error(f"请求 MiniMax API 时发生错误：{data}")
                        yield data
                        continue

                    data = json.loads(e[6:])
                    if data.get("usage"):
                        break

                    if choices := data.get("choices"):
                        if chunk := choices[0].get("delta", ""):
                            text += chunk
                            yield {"error_code": 0, "text": text}

    def do_embeddings(self, params: ApiEmbeddingsParams) -> Dict:
        params.load_config(self.model_names[0])
        url = f"https://api.minimax.chat/v1/embeddings?GroupId={params.group_id}"

        headers = {
            "Authorization": f"Bearer {params.api_key}",
            "Content-Type": "application/json",
        }

        data = {
            "model": params.embed_model or self.DEFAULT_EMBED_MODEL,
            "texts": [],
            "type": "query" if params.to_query else "db",
        }
        if log_verbose:
            logger.info(f'{self.__class__.__name__}:data: {data}')
            logger.info(f'{self.__class__.__name__}:url: {url}')
            logger.info(f'{self.__class__.__name__}:headers: {headers}')

        with get_httpx_client() as client:
            result = []
            i = 0
            batch_size = 10
            while i < len(params.texts):
                texts = params.texts[i:i+batch_size]
                data["texts"] = texts
                r = client.post(url, headers=headers, json=data).json()
                if embeddings := r.get("vectors"):
                    result += embeddings
                elif error := r.get("base_resp"):
                    data = {
                                "code": error["status_code"],
                                "msg": error["status_msg"],
                                "error": {
                                    "message":  error["status_msg"],
                                    "type": "invalid_request_error",
                                    "param": None,
                                    "code": None,
                                }
                            }
                    self.logger.error(f"请求 MiniMax API 时发生错误：{data}")
                    return data
                i += batch_size
            return {"code": 200, "data": embeddings}

    def get_embeddings(self, params):
        # TODO: 支持embeddings
        print("embedding")
        print(params)

    def make_conv_template(self, conv_template: str = None, model_path: str = None) -> Conversation:
        # TODO: 确认模板是否需要修改
        return conv.Conversation(
            name=self.model_names[0],
            system_message="你是MiniMax自主研发的大型语言模型，回答问题简洁有条理。",
            messages=[],
            roles=["USER", "BOT"],
            sep="\n### ",
            stop_str="###",
        )


if __name__ == "__main__":
    import uvicorn
    from server.utils import MakeFastAPIOffline
    from fastchat.serve.model_worker import app

    worker = MiniMaxWorker(
        controller_addr="http://127.0.0.1:20001",
        worker_addr="http://127.0.0.1:21002",
    )
    sys.modules["fastchat.serve.model_worker"].worker = worker
    MakeFastAPIOffline(app)
    uvicorn.run(app, port=21002)

```

### Core Architecture Module: `examples/model_workers/openai.py`
```
import sys, os
from fastchat.conversation import Conversation
from .base import *
from fastchat import conversation as conv
import json
from typing import List, Dict
from loguru import logger
# from configs import logger, log_verbose
log_verbose = os.environ.get("log_verbose", False)
import openai

from langchain import PromptTemplate, LLMChain
from langchain.prompts.chat import ChatPromptTemplate
from langchain.chat_models import ChatOpenAI
from langchain.schema import HumanMessage


class ExampleWorker(ApiModelWorker):
    def __init__(
            self,
            *,
            controller_addr: str = None,
            worker_addr: str = None,
            model_names: List[str] = ["gpt-3.5-turbo"],
            version: str = "gpt-3.5",
            **kwargs,
    ):
        kwargs.update(model_names=model_names, controller_addr=controller_addr, worker_addr=worker_addr)
        kwargs.setdefault("context_len", 16384) #TODO 16K模型需要改成16384
        super().__init__(**kwargs)
        self.version = version

    def do_chat(self, params: ApiChatParams) -> Dict:
        '''
        yield output: {"error_code": 0, "text": ""}
        '''
        params.load_config(self.model_names[0])
        openai.api_key = params.api_key
        openai.api_base = params.api_base_url

        logger.error(f"{params.api_key}, {params.api_base_url}, {params.messages} {params.max_tokens},")
        # just for example
        prompt = "\n".join([f"{m['role']}:{m['content']}" for m in params.messages])
        logger.error(f"{prompt}, {params.temperature}, {params.max_tokens}")
        try:
            model = ChatOpenAI(
                streaming=True,
                verbose=True,
                openai_api_key= params.api_key,
                openai_api_base=params.api_base_url,
                model_name=params.version
            )
            chat_prompt = ChatPromptTemplate.from_messages([("human", "{input}")])
            chain = LLMChain(prompt=chat_prompt, llm=model)
            content = chain({"input": prompt})
            logger.info(content)
        except Exception as e:
            logger.error(f"{e}")
            yield {"error_code": 500, "text": "request error"}

        # return the text by yield for stream
        try:
            yield {"error_code": 0, "text": content["text"]}
        except:
            yield {"error_code": 500, "text": "request error"}

    def get_embeddings(self, params):
        # TODO: 支持embeddings
        print("embedding")
        print(params)

    def make_conv_template(self, conv_template: str = None, model_path: str = None) -> Conversation:
        # TODO: 确认模板是否需要修改
        return conv.Conversation(
            name=self.model_names[0],
            system_message="You are a helpful, respectful and honest assistant.",
            messages=[],
            roles=["user", "assistant", "system"],
            sep="\n### ",
            stop_str="###",
        )


if __name__ == "__main__":
    import uvicorn
    from coagent.utils.server_utils import MakeFastAPIOffline
    from fastchat.serve.base_model_worker import app

    worker = ExampleWorker(
        controller_addr="http://127.0.0.1:20001",
        worker_addr="http://127.0.0.1:21008",
    )
    sys.modules["fastchat.serve.model_worker"].worker = worker
    uvicorn.run(app, port=21008)

```

### Core Architecture Module: `examples/model_workers/qianfan.py`
```
import sys, os
from fastchat.conversation import Conversation
from .base import *
# from server.utils import get_httpx_client
from cachetools import cached, TTLCache
import json
from fastchat import conversation as conv
import sys
from typing import List, Literal, Dict
from loguru import logger
# from configs import logger, log_verbose
log_verbose = os.environ.get("log_verbose", False)

MODEL_VERSIONS = {
    "ernie-bot-4": "completions_pro",
    "ernie-bot": "completions",
    "ernie-bot-turbo": "eb-instant",
    "bloomz-7b": "bloomz_7b1",
    "qianfan-bloomz-7b-c": "qianfan_bloomz_7b_compressed",
    "llama2-7b-chat": "llama_2_7b",
    "llama2-13b-chat": "llama_2_13b",
    "llama2-70b-chat": "llama_2_70b",
    "qianfan-llama2-ch-7b": "qianfan_chinese_llama_2_7b",
    "chatglm2-6b-32k": "chatglm2_6b_32k",
    "aquilachat-7b": "aquilachat_7b",
    # "linly-llama2-ch-7b": "", # 暂未发布
    # "linly-llama2-ch-13b": "", # 暂未发布
    # "chatglm2-6b": "", # 暂未发布
    # "chatglm2-6b-int4": "", # 暂未发布
    # "falcon-7b": "", # 暂未发布
    # "falcon-180b-chat": "", # 暂未发布
    # "falcon-40b": "", # 暂未发布
    # "rwkv4-world": "", # 暂未发布
    # "rwkv5-world": "", # 暂未发布
    # "rwkv4-pile-14b": "", # 暂未发布
    # "rwkv4-raven-14b": "", # 暂未发布
    # "open-llama-7b": "", # 暂未发布
    # "dolly-12b": "", # 暂未发布
    # "mpt-7b-instruct": "", # 暂未发布
    # "mpt-30b-instruct": "", # 暂未发布
    # "OA-Pythia-12B-SFT-4": "", # 暂未发布
    # "xverse-13b": "", # 暂未发布

    # # 以下为企业测试，需要单独申请
    # "flan-ul2": "",
    # "Cerebras-GPT-6.7B": ""
    # "Pythia-6.9B": ""
}


@cached(TTLCache(1, 1800))  # 经过测试，缓存的token可以使用，目前每30分钟刷新一次
def get_baidu_access_token(api_key: str, secret_key: str) -> str:
    """
    使用 AK，SK 生成鉴权签名（Access Token）
    :return: access_token，或是None(如果错误)
    """
    url = "https://aip.baidubce.com/oauth/2.0/token"
    params = {"grant_type": "client_credentials", "client_id": api_key, "client_secret": secret_key}
    try:
        with get_httpx_client() as client:
            return client.get(url, params=params).json().get("access_token")
    except Exception as e:
        print(f"failed to get token from baidu: {e}")


class QianFanWorker(ApiModelWorker):
    """
    百度千帆
    """
    DEFAULT_EMBED_MODEL = "embedding-v1"

    def __init__(
            self,
            *,
            version: Literal["ernie-bot", "ernie-bot-turbo"] = "ernie-bot",
            model_names: List[str] = ["qianfan-api"],
            controller_addr: str = None,
            worker_addr: str = None,
            **kwargs,
    ):
        kwargs.update(model_names=model_names, controller_addr=controller_addr, worker_addr=worker_addr)
        kwargs.setdefault("context_len", 16384)
        super().__init__(**kwargs)
        self.version = version

    def do_chat(self, params: ApiChatParams) -> Dict:
        params.load_config(self.model_names[0])
        # import qianfan

        # comp = qianfan.ChatCompletion(model=params.version,
        #                               endpoint=params.version_url,
        #                               ak=params.api_key,
        #                               sk=params.secret_key,)
        # text = ""
        # for resp in comp.do(messages=params.messages,
        #                     temperature=params.temperature,
        #                     top_p=params.top_p,
        #                     stream=True):
        #     if resp.code == 200:
        #         if chunk := resp.body.get("result"):
        #             text += chunk
        #             yield {
        #                 "error_code": 0,
        #                 "text": text
        #             }
        #     else:
        #         yield {
        #             "error_code": resp.code,
        #             "text": str(resp.body),
        #         }

        BASE_URL = 'https://aip.baidubce.com/rpc/2.0/ai_custom/v1/wenxinworkshop/chat' \
                   '/{model_version}?access_token={access_token}'

        access_token = get_baidu_access_token(params.api_key, params.secret_key)
        if not access_token:
            yield {
                "error_code": 403,
                "text": f"failed to get access token. have you set the correct api_key and secret key?",
            }

        url = BASE_URL.format(
            model_version=params.version_url or MODEL_VERSIONS[params.version.lower()],
            access_token=access_token,
        )
        payload = {
            "messages": params.messages,
            "temperature": params.temperature,
            "stream": True
        }
        headers = {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
        }

        text = ""
        if log_verbose:
            logger.info(f'{self.__class__.__name__}:data: {payload}')
            logger.info(f'{self.__class__.__name__}:url: {url}')
            logger.info(f'{self.__class__.__name__}:headers: {headers}')

        with get_httpx_client() as client:
            with client.stream("POST", url, headers=headers, json=payload) as response:
                for line in response.iter_lines():
                    if not line.strip():
                        continue
                    if line.startswith("data: "):
                        line = line[6:]
                    resp = json.loads(line)

                    if "result" in resp.keys():
                        text += resp["result"]
                        yield {
                            "error_code": 0,
                            "text": text
                        }
                    else:
                        data = {
                            "error_code": resp["error_code"],
                            "text": resp["error_msg"],
                            "error": {
                                "message": resp["error_msg"],
                                "type": "invalid_request_error",
                                "param": None,
                                "code": None,
                            }
                        }
                        self.logger.error(f"请求千帆 API 时发生错误：{data}")
                        yield data

    def do_embeddings(self, params: ApiEmbeddingsParams) -> Dict:
        params.load_config(self.model_names[0])
        # import qianfan

        # embed = qianfan.Embedding(ak=params.api_key, sk=params.secret_key)
        # resp = embed.do(texts = params.texts, model=params.embed_model or self.DEFAULT_EMBED_MODEL)
        # if resp.code == 200:
        #     embeddings = [x.embedding for x in resp.body.get("data", [])]
        #     return {"code": 200, "embeddings": embeddings}
        # else:
        #     return {"code": resp.code, "msg": str(resp.body)}

        embed_model = params.embed_model or self.DEFAULT_EMBED_MODEL
        access_token = get_baidu_access_token(params.api_key, params.secret_key)
        url = f"https://aip.baidubce.com/rpc/2.0/ai_custom/v1/wenxinworkshop/embeddings/{embed_model}?access_token={access_token}"
        if log_verbose:
            logger.info(f'{self.__class__.__name__}:url: {url}')

        with get_httpx_client() as client:
            result = []
            i = 0
            batch_size = 10
            while i < len(params.texts):
                texts = params.texts[i:i+batch_size]
                resp = client.post(url, json={"input": texts}).json()
                if "error_code" in resp:
                    data = {
                                "code": resp["error_code"],
                                "msg": resp["error_msg"],
                                "error": {
                                    "message": resp["error_msg"],
                                    "type": "invalid_request_error",
                                    "param": None,
                                    "code": None,
                                }
                            }
                    self.logger.error(f"请求千帆 API 时发生错误：{data}")
                    return data
                else:
                    embeddings = [x["embedding"] for x in resp.get("data", [])]
                    result += embeddings
                i += batch_size
            return {"code": 200, "data": result}

    # TODO: qianfan支持续写模型
    def get_embeddings(self, params):
        # TODO: 支持embeddings
        print("embedding")
        print(params)

    def make_conv_template(self, conv_template: str = None, model_path: str = None) -> Conversation:
        # TODO: 确认模板是否需要修改
        return conv.Conversation(
            name=self.model_names[0],
            system_message="你是一个聪明的助手，请根据用户的提示来完成任务",
            messages=[],
            roles=["user", "assistant"],
            sep="\n### ",
            stop_str="###",
        )


if __name__ == "__main__":
    import uvicorn
    from server.utils import MakeFastAPIOffline
    from fastchat.serve.model_worker import app

    worker = QianFanWorker(
        controller_addr="http://127.0.0.1:20001",
        worker_addr="http://127.0.0.1:21004"
    )
    sys.modules["fastchat.serve.model_worker"].worker = worker
    MakeFastAPIOffline(app)
    uvicorn.run(app, port=21004)

```

### Core Architecture Module: `examples/model_workers/qwen.py`
```
import json
import sys
import os
from fastchat.conversation import Conversation
from http import HTTPStatus
from typing import List, Literal, Dict

from fastchat import conversation as conv
from .base import *
from loguru import logger
# from configs import logger, log_verbose
log_verbose = os.environ.get("log_verbose", False)


class QwenWorker(ApiModelWorker):
    DEFAULT_EMBED_MODEL = "text-embedding-v1"

    def __init__(
        self,
        *,
        version: Literal["qwen-turbo", "qwen-plus"] = "qwen-turbo",
        model_names: List[str] = ["qwen-api"],
        controller_addr: str = None,
        worker_addr: str = None,
        **kwargs,
    ):
        kwargs.update(model_names=model_names, controller_addr=controller_addr, worker_addr=worker_addr)
        kwargs.setdefault("context_len", 16384)
        super().__init__(**kwargs)
        self.version = version

    def do_chat(self, params: ApiChatParams) -> Dict:
        import dashscope
        params.load_config(self.model_names[0])
        if log_verbose:
            logger.info(f'{self.__class__.__name__}:params: {params}')

        gen = dashscope.Generation()
        responses = gen.call(
            model=params.version,
            temperature=params.temperature,
            api_key=params.api_key,
            messages=params.messages,
            result_format='message',  # set the result is message format.
            stream=True,
        )

        for resp in responses:
            if resp["status_code"] == 200:
                if choices := resp["output"]["choices"]:
                    yield {
                        "error_code": 0,
                        "text": choices[0]["message"]["content"],
                    }
            else:
                data = {
                    "error_code": resp["status_code"],
                    "text": resp["message"],
                    "error": {
                        "message": resp["message"],
                        "type": "invalid_request_error",
                        "param": None,
                        "code": None,
                    }
                }
                self.logger.error(f"请求千问 API 时发生错误：{data}")
                yield data

    def do_embeddings(self, params: ApiEmbeddingsParams) -> Dict:
        import dashscope
        params.load_config(self.model_names[0])
        if log_verbose:
            logger.info(f'{self.__class__.__name__}:params: {params}')
        result = []
        i = 0
        while i < len(params.texts):
            texts = params.texts[i:i+25]
            resp = dashscope.TextEmbedding.call(
                model=params.embed_model or self.DEFAULT_EMBED_MODEL,
                input=texts, # 最大25行
                api_key=params.api_key,
            )
            if resp["status_code"] != 200:
                data = {
                            "code": resp["status_code"],
                            "msg": resp.message,
                            "error": {
                                "message": resp["message"],
                                "type": "invalid_request_error",
                                "param": None,
                                "code": None,
                            }
                        }
                self.logger.error(f"请求千问 API 时发生错误：{data}")
                return data
            else:
                embeddings = [x["embedding"] for x in resp["output"]["embeddings"]]
                result += embeddings
            i += 25
        return {"code": 200, "data": result}

    def get_embeddings(self, params):
        # TODO: 支持embeddings
        print("embedding")
        print(params)

    def make_conv_template(self, conv_template: str = None, model_path: str = None) -> Conversation:
        # TODO: 确认模板是否需要修改
        return conv.Conversation(
            name=self.model_names[0],
            system_message="你是一个聪明、对人类有帮助的人工智能，你可以对人类提出的问题给出有用、详细、礼貌的回答。",
            messages=[],
            roles=["user", "assistant", "system"],
            sep="\n### ",
            stop_str="###",
        )


if __name__ == "__main__":
    import uvicorn
    from server.utils import MakeFastAPIOffline
    from fastchat.serve.model_worker import app

    worker = QwenWorker(
        controller_addr="http://127.0.0.1:20001",
        worker_addr="http://127.0.0.1:20007",
    )
    sys.modules["fastchat.serve.model_worker"].worker = worker
    MakeFastAPIOffline(app)
    uvicorn.run(app, port=20007)

```

### Core Architecture Module: `examples/model_workers/tiangong.py`
```
import json
import time
import hashlib

from fastchat.conversation import Conversation
from .base import *
from fastchat import conversation as conv
import json
from typing import List, Literal, Dict
import requests



class TianGongWorker(ApiModelWorker):
    def __init__(
        self,
        *,
        controller_addr: str = None,
        worker_addr: str = None,
        model_names: List[str] = ["tiangong-api"],
        version: Literal["SkyChat-MegaVerse"] = "SkyChat-MegaVerse",
        **kwargs,
    ):
        kwargs.update(model_names=model_names, controller_addr=controller_addr, worker_addr=worker_addr)
        kwargs.setdefault("context_len", 32768)
        super().__init__(**kwargs)
        self.version = version

    def do_chat(self, params: ApiChatParams) -> Dict:
        params.load_config(self.model_names[0])

        url = 'https://sky-api.singularity-ai.com/saas/api/v4/generate'
        data = {
            "messages": params.messages,
            "model": "SkyChat-MegaVerse"
        }       
        timestamp = str(int(time.time()))     
        sign_content = params.api_key + params.secret_key + timestamp    
        sign_result = hashlib.md5(sign_content.encode('utf-8')).hexdigest() 
        headers={
            "app_key": params.api_key,
            "timestamp": timestamp,
            "sign": sign_result,
            "Content-Type": "application/json",
            "stream": "true" # or change to "false" 不处理流式返回内容
        }
        
        # 发起请求并获取响应
        response = requests.post(url, headers=headers, json=data, stream=True)

        text = ""
        # 处理响应流
        for line in response.iter_lines(chunk_size=None, decode_unicode=True):
            if line:
                # 处理接收到的数据
                # print(line.decode('utf-8'))
                resp = json.loads(line)
                if resp["code"] == 200:                   
                    text += resp['resp_data']['reply']
                    yield {
                        "error_code": 0,
                        "text": text
                        }
                else:
                    data = {
                        "error_code": resp["code"],
                        "text": resp["code_msg"]
                        }
                    self.logger.error(f"请求天工 API 时出错：{data}")
                    yield data

    def get_embeddings(self, params):
        # TODO: 支持embeddings
        print("embedding")
        print(params)

    def make_conv_template(self, conv_template: str = None, model_path: str = None) -> Conversation:
        # TODO: 确认模板是否需要修改
        return conv.Conversation(
            name=self.model_names[0],
            system_message="",
            messages=[],
            roles=["user", "system"],
            sep="\n### ",
            stop_str="###",
        )



```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #8** (2023-12-14): **安装好环境和docker，cd examples，运行python start.py报错  NameError: name 'is_running_in_docker' is not defined**
  *Symptoms*: python start.py Traceback (most recent call last):   File "/media/models/model-tools/codefuse-chatbot-main/examples/start.py", line 11, in <module>     from configs.model_config import USE_FASTCHAT, JUPYTER_WORK_PATH   File "/media/models/model-tools/codefuse-chatbot-main/configs/__init__.py", line 1, in <module>     from .model_config import *   File "/media/models/model-tools/codefuse-chatbot-main/configs/model_config.py", line 42, in <module>     embedding_model_dict = {k: f"/home/user/chatbot/embedding_models/{v}" if is_running_in_docker() else f"{LOCAL_MODEL_DIR}/{v}" for k, v in embedding_model_dict.items()}   File "/media/models/model-tools/codefuse-chatbot-main/configs/model_config.py", line 42, in <dictcomp>     embedding_model_dict = {k: f"/home/user/chatbot/embedding_models/{v}" if is_running_in_docker() else f"{LOCAL_MODEL_DIR}/{v}" for k, v in embedding_model_dict.items()} NameError: name 'is_running_in_docker' is not defined 
  **Post-Mortem & Fix Analysis**:
  > is_running_in_docker 没从 configs/utils.py 中导入，已修复

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

### Incident Patch 1: `bce136df` (2024-06-21)
**Commit Message**: [bugfix](update fastchat llm access)

**File**: `configs/model_config.py.example` (modified, +3/-1)
```diff
@@ -46,11 +46,13 @@ except Exception as e:
 
 # add your openai key
 os.environ["API_BASE_URL"] = os.environ.get("API_BASE_URL") or update_config.get("API_BASE_URL") or OPENAI_API_BASE
+os.environ["OPENAI_API_BASE"] = os.environ.get("API_BASE_URL") or update_config.get("API_BASE_URL") or OPENAI_API_BASE
 os.environ["OPENAI_API_KEY"] = os.environ.get("OPENAI_API_KEY") or update_config.get("OPENAI_API_KEY") or "sk-xx"
 os.environ["model_engine"] = os.environ.get("model_engine") or update_config.get("model_engine") or "openai"
 openai.api_key = os.environ["OPENAI_API_KEY"]
 # os.environ["OPENAI_PROXY"] = "socks5h://127.0.0.1:13659"
-os.environ["DUCKDUCKGO_PROXY"] = os.environ.get("DUCKDUCKGO_PROXY") or update_config.get("DUCKDUCKGO_PROXY") or "socks5h://127.0.0.1:13659"
+# os.environ["DUCKDUCKGO_PROXY"] = os.environ.get("DUCKDUCKGO_PROXY") or update_config.get("DUCKDUCKGO_PROXY") or "socks5h://127.0.0.1:13659"
+os.environ["TEST_PROXY"] = "socks5h://127.0.0.1:13659"
 # ignore if you dont's use baidu_ocr_api
 os.environ["BAIDU_OCR_API_KEY"] = "xx"
 os.environ["BAIDU_OCR_SECRET_KEY"] = "xx"
```

**File**: `examples/llm_api.py` (modified, +1/-1)
```diff
@@ -582,7 +582,7 @@ def release_model(
             else:
                 q.put([model_name, "stop", None])
         return {"code": 200, "msg": "done"}
-
+    port = int(port)
     uvicorn.run(app, host=host, port=port, log_level=log_level.lower())
 
 
```

**File**: `examples/start.py` (modified, +4/-3)
```diff
@@ -67,7 +67,8 @@ def start_docker(client, script_shs, ports, image_name, container_name, mounts=N
         mounts=mounts,
         name=container_name,
         mem_limit="8g",
-        # device_requests=[DeviceRequest(count=-1, capabilities=[['gpu']])],
+        device_requests=[DeviceRequest(count=-1, capabilities=[['gpu']])],
+        # runtime='nvidia',  # 指定使用nvidia运行时
         # network_mode="host",
         ports=ports,
         stdin_open=True,
@@ -179,12 +180,12 @@ def start_api_service(sandbox_host=DEFAULT_BIND_HOST):
             '''curl -X PUT -H "Content-Type: application/json" -d'{"heartbeat_interval_secs":"2"}' -s "http://127.0.0.1:19669/flags"''',
             '''curl -X PUT -H "Content-Type: application/json" -d'{"heartbeat_interval_secs":"2"}' -s "http://127.0.0.1:19779/flags"''',
 
-            "pip install zdatafront-sdk-python -i https://artifacts.antgroup-inc.cn/simple",
+            # "pip install zdatafront-sdk-python -i https://artifacts.antgroup-inc.cn/simple",
 
             "nohup python chatbot/examples/sdfile_api.py > /home/user/chatbot/logs/sdfile_api.log 2>&1 &",
             f"export DUCKDUCKGO_PROXY=socks5://host.docker.internal:13659 && export SANDBOX_HOST={sandbox_host} &&\
                 nohup python chatbot/examples/api.py > /home/user/chatbot/logs/api.log 2>&1 &",
-            "nohup python chatbot/examples/llm_api.py > /home/user/llm.log  2>&1 &",
+            "nohup python chatbot/examples/llm_api.py > /home/user/chatbot/logs/llm_api.log  2>&1 &",
             f"export DUCKDUCKGO_PROXY=socks5://host.docker.internal:13659 && export SANDBOX_HOST={sandbox_host} &&\
                 cd chatbot/examples && nohup streamlit run webui.py > /home/user/chatbot/logs/start_webui.log 2>&1 &"
             ]
```

**File**: `examples/webui_config.py` (modified, +7/-15)
```diff
@@ -76,14 +76,6 @@
                 },
             }
         
-        if llm_engine == "fastchat":
-            llm_model_dict = {
-                llm_model_name: {
-                    "local_model_path": llm_model_name,
-                    "api_base_url": llm_apiurl,  # "name"修改为fastchat服务中的"api_base_url"
-                    "api_key": llm_apikey
-                    }}
-
 
         if llm_engine == "fastchat-vllm":
             VLLM_MODEL_DICT = {
@@ -93,12 +85,12 @@
                     "api_key": llm_apikey
                     }
             }
-            llm_model_dict = {
-                llm_model_name: {
-                    "local_model_path": llm_model_name,
-                    "api_base_url": llm_apiurl,  # "name"修改为fastchat服务中的"api_base_url"
-                    "api_key": llm_apikey
-                    }}
+        llm_model_dict = {
+            llm_model_name: {
+                "local_model_path": llm_model_name,
+                "api_base_url": llm_apiurl,  # "name"修改为fastchat服务中的"api_base_url"
+                "api_key": llm_apikey
+                }}
             
 
     with col2.container():
@@ -165,7 +157,7 @@
         for k, v in llm_model_dict.items():
             v_c = {}
             for kk, vv in v.items():
-                if k=="local_model_path":
+                if kk=="local_model_path":
                     v_c[kk] = f"/home/user/chatbot/llm_models/{vv}" if DOCKER_SERVICE else f"{LOCAL_LLM_MODEL_DIR}/{vv}" 
                 else:
                     v_c[kk] = vv
```

**File**: `requirements.txt` (modified, +7/-3)
```diff
@@ -1,3 +1,4 @@
+torch<=2.0.1
 fschat==0.2.33
 nltk~=3.8.1
 uvicorn~=0.23.1
@@ -29,11 +30,14 @@ tenacity<8.4.0
 codefuse-muagent
 # qwen model
 # protobuf==3.20.*
-# transformers_stream_generator
-# einops
+transformers_stream_generator
+einops
+optimum
 # auto-gptq
-# optimum
 # modelscope
 
 # vllm model
 # vllm; sys_platform == "linux"
+
+# chatglm
+sentencepiece
\ No newline at end of file
```

---

### Incident Patch 2: `36a9c58c` (2024-06-18)
**Commit Message**: bugfix: docker deploy

**File**: `.gitignore` (modified, +1/-1)
```diff
@@ -18,4 +18,4 @@ build
 dist
 package.sh
 local_config.json
-muagent
\ No newline at end of file
+muagent*
\ No newline at end of file
```

**File**: `configs/model_config.py.example` (modified, +3/-1)
```diff
@@ -38,7 +38,9 @@ try:
     cur_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)))
     with open(os.path.join(cur_dir, "local_config.json"), "r") as f:
         update_config = json.load(f)
-except:
+        for k, v in update_config.items():
+            os.environ[k] = v if isinstance(v, str) else json.dumps(v)
+except Exception as e:
     update_config = {}
 
 
```

**File**: `examples/webui_config.py` (modified, +6/-1)
```diff
@@ -200,7 +200,12 @@
             "VLLM_MODEL_DICT": VLLM_MODEL_DICT,
             "DOCKER_SERVICE": DOCKER_SERVICE,
             "SANDBOX_DO_REMOTE": SANDBOX_DO_REMOTE,
-            "FSCHAT_MODEL_WORKERS": FSCHAT_MODEL_WORKERS
+            "FSCHAT_MODEL_WORKERS": FSCHAT_MODEL_WORKERS,
+            # 非zdata则不需要关注
+            "aes_secret_key": os.environ.get("aes_secret_key"),
+            "visit_biz": os.environ.get("visit_biz"),
+            "visit_biz_line": os.environ.get("visit_biz_line"),
+            "visit_domain": os.environ.get("visit_domain"),
         }
 
         with open(os.path.join(src_dir, "configs/local_config.json"), "w") as f:
```

---

### Incident Patch 3: `5188ad48` (2024-06-18)
**Commit Message**: bugfix: tenacity version bug

**File**: `requirements.txt` (modified, +1/-0)
```diff
@@ -24,6 +24,7 @@ streamlit-chatbox
 streamlit-aggrid
 # streamlit-antd-components>=0.1.11
 httpx
+tenacity<8.4.0
 
 codefuse-muagent
 # qwen model
```

---

### Incident Patch 4: `442ffa6f` (2024-05-29)
**Commit Message**: [bug]codepages and diag_pages add args local_code_path

**File**: `examples/webui/code.py` (modified, +4/-3)
```diff
@@ -22,7 +22,7 @@
 from muagent.orm import table_init
 
 
-from configs.model_config import EMBEDDING_DEVICE, EMBEDDING_ENGINE, EMBEDDING_MODEL, embedding_model_dict,llm_model_dict
+from configs.model_config import EMBEDDING_DEVICE, EMBEDDING_ENGINE, EMBEDDING_MODEL, embedding_model_dict,llm_model_dict, CB_ROOT_PATH
 # SENTENCE_SIZE = 100
 
 cell_renderer = JsCode("""function(params) {if(params.value==true){return '✓'}else{return '×'}}""")
@@ -46,7 +46,7 @@ def code_page(api: ApiRequest):
     table_init()
 
     try:
-        logger.info(get_cb_details())
+        # logger.info(get_cb_details())
         cb_list = {x["code_name"]: x for x in get_cb_details()}
     except Exception as e:
         logger.exception(e)
@@ -89,7 +89,7 @@ def format_selected_cb(cb_name: str) -> str:
             do_interpret = st.checkbox('**代码解读**', value=False, help='代码解读会针对每个代码文件通过 LLM 获取解释并且向量化存储。当代码文件较多时，\
             导入速度会变慢，且如果使用收费 API 的话可能会造成较大花费。如果要使用基于描述的代码问答模式，此项必须勾选', key='do_interpret')
 
-            logger.info(f'do_interpret={do_interpret}')
+            # logger.info(f'do_interpret={do_interpret}')
             submit_create_kb = st.form_submit_button(
                 "新建",
                 use_container_width=True,
@@ -119,6 +119,7 @@ def format_selected_cb(cb_name: str) -> str:
                     llm_model=LLM_MODEL,
                     api_key=llm_model_dict[LLM_MODEL]["api_key"],
                     api_base_url=llm_model_dict[LLM_MODEL]["api_base_url"],
+                    local_graph_path=CB_ROOT_PATH,
                 )
                 st.toast(ret.get("msg", " "))
                 st.session_state["selected_cb_name"] = cb_name
```

**File**: `examples/webui/dialogue.py` (modified, +3/-0)
```diff
@@ -13,6 +13,7 @@
 from muagent.service.service_factory import get_cb_details_by_cb_name
 
 from configs.model_config import EMBEDDING_DEVICE, EMBEDDING_MODEL, embedding_model_dict, EMBEDDING_ENGINE, KB_ROOT_PATH, llm_model_dict
+from configs.model_config import CB_ROOT_PATH
 chat_box = ChatBox(
     assistant_avatar="../sources/imgs/devops-chatbot2.png"
 )
@@ -367,6 +368,7 @@ def on_cb_change():
                 "model_name": LLM_MODEL,
                 "api_key": llm_model_dict[LLM_MODEL]["api_key"],
                 "api_base_url": llm_model_dict[LLM_MODEL]["api_base_url"],
+                "local_graph_path": CB_ROOT_PATH,
             }
             text = ""
             d = {"docs": []}
@@ -445,6 +447,7 @@ def on_cb_change():
                                                              embed_engine=EMBEDDING_ENGINE, llm_model=LLM_MODEL,
                                                              api_key=llm_model_dict[LLM_MODEL]["api_key"],
                                                              api_base_url=llm_model_dict[LLM_MODEL]["api_base_url"],
+                                                             local_graph_path=CB_ROOT_PATH,
                                                              )):
                 if error_msg := check_error_msg(d):
                     st.error(error_msg)
```

**File**: `examples/webui/utils.py` (modified, +6/-0)
```diff
@@ -442,6 +442,7 @@ def code_base_chat(
         llm_model: str ="", temperature: float= 0.2,
         api_key: str=os.environ["OPENAI_API_KEY"],
         api_base_url: str = os.environ["API_BASE_URL"],
+        local_graph_path: str = CB_ROOT_PATH,
     ):
         '''
         对应api.py/chat/knowledge_base_chat接口
@@ -475,6 +476,7 @@ def code_base_chat(
             "model_name": llm_model,
             "temperature": temperature,
             "model_device": model_device,
+            "local_graph_path": local_graph_path
         }
         logger.info('data={}'.format(data))
 
@@ -601,6 +603,7 @@ def agent_achat(
         temperature: float=0.2, model_name: str="",
         api_key: str=os.environ["OPENAI_API_KEY"],
         api_base_url: str = os.environ["API_BASE_URL"],
+        local_graph_path: str = CB_ROOT_PATH,
     ):
         '''
         对应api.py/chat/chat接口
@@ -643,6 +646,7 @@ def agent_achat(
             "temperature": temperature,
             "jupyter_work_path": JUPYTER_WORK_PATH,
             "sandbox_server": SANDBOX_SERVER,
+            "local_graph_path": local_graph_path
         }
 
         if no_remote_api:
@@ -1067,6 +1071,7 @@ def create_code_base(self, cb_name, zip_file, do_interpret: bool, no_remote_api:
                          llm_model: str ="", temperature: float= 0.2,
                          api_key: str=os.environ["OPENAI_API_KEY"],
                          api_base_url: str = os.environ["API_BASE_URL"],
+                         local_graph_path: str=CB_ROOT_PATH
                          ):
         '''
         创建 code_base
@@ -1100,6 +1105,7 @@ def create_code_base(self, cb_name, zip_file, do_interpret: bool, no_remote_api:
             "model_name": llm_model,
             "temperature": temperature,
             "model_device": embedding_device,
+            "local_graph_path": local_graph_path,
         }
         logger.info('create cb data={}'.format(data))
 
```

**File**: `requirements.txt` (modified, +3/-17)
```diff
@@ -1,27 +1,17 @@
-langchain==0.0.266
-openai==0.28.1
-sentence_transformers
 fschat==0.2.33
 transformers>=4.31.0
 torch~=2.0.0
-fastapi~=0.99.1
 nltk~=3.8.1
 uvicorn~=0.23.1
 starlette~=0.27.0
-pydantic~=1.10.11
+pydantic<=1.10.14
 unstructured[all-docs]
-python-magic-bin; sys_platform == 'win32'
-SQLAlchemy==2.0.19
-faiss-cpu
 nltk
-loguru
 pypdf
 duckduckgo-search
 pysocks
 accelerate
 docker 
-jupyter
-notebook
 websockets
 fake_useragent
 selenium
@@ -38,16 +28,12 @@ streamlit>=1.25.0
 streamlit-option-menu>=0.3.6
 streamlit-antd-components>=0.1.11
 streamlit-chatbox>=1.1.6
-streamlit-aggrid>=0.3.4.post3
+streamlit-aggrid<=0.3.4.post3
 httpx
 
-javalang==0.13.0
 # jsonref==1.1.0
-chromadb==0.4.17
-nebula3-python==3.1.0
-jieba
-codefuse-muagent
 
+codefuse-muagent
 # qwen model
 # protobuf==3.20.*
 # transformers_stream_generator
```

---

### Incident Patch 5: `c8431598` (2024-05-17)
**Commit Message**: Update requirements.txt for add codefuse-muagent

**File**: `requirements.txt` (modified, +1/-0)
```diff
@@ -46,6 +46,7 @@ javalang==0.13.0
 chromadb==0.4.17
 nebula3-python==3.1.0
 jieba
+codefuse-muagent
 
 # qwen model
 # protobuf==3.20.*
```

---

### Incident Patch 6: `eee0e09e` (2024-03-28)
**Commit Message**: Merge pull request #33 from codefuse-ai/pr_webui

[feature](webui)<add config_webui for starting app>

**File**: `.gitignore` (modified, +2/-0)
```diff
@@ -15,3 +15,5 @@ tests
 *egg-info
 build
 dist
+package.sh
+local_config.json
\ No newline at end of file
```

**File**: `README.md` (modified, +10/-47)
```diff
@@ -123,60 +123,23 @@ cd codefuse-chatbot
 pip install -r requirements.txt
 ```
 
-2、基础配置
-
+2、启动服务
 ```bash
-# 修改服务启动的基础配置
-cd configs
-cp model_config.py.example model_config.py
-cp server_config.py.example server_config.py
-
-# model_config#11~12 若需要使用openai接口，openai接口key
-os.environ["OPENAI_API_KEY"] = "sk-xxx"
-# 可自行替换自己需要的api_base_url
-os.environ["API_BASE_URL"] = "https://api.openai.com/v1"
-
-# vi model_config#LLM_MODEL 你需要选择的语言模型
-LLM_MODEL = "gpt-3.5-turbo"
-LLM_MODELs = ["gpt-3.5-turbo"]
-
-# vi model_config#EMBEDDING_MODEL 你需要选择的私有化向量模型
-EMBEDDING_ENGINE = 'model'
-EMBEDDING_MODEL = "text2vec-base"
-
-# vi model_config#embedding_model_dict 修改成你的本地路径，如果能直接连接huggingface则无需修改
-# 若模型地址为：
-model_dir: ~/codefuse-chatbot/embedding_models/shibing624/text2vec-base-chinese
-# 配置如下
-"text2vec-base": "shibing624/text2vec-base-chinese",
-
-# vi server_config#8~14, 推荐采用容器启动服务
-DOCKER_SERVICE = True
-# 是否采用容器沙箱
-SANDBOX_DO_REMOTE = True
-# 是否采用api服务来进行
-NO_REMOTE_API = True
+# 完成server_config.py配置后，可一键启动
+cd examples
+bash start.sh
+# 开始在页面进行配置即可
 ```
+<div align=center>
+  <img src="sources/docs_imgs/webui_config.png" alt="图片">
+</div>
 
-3、启动服务
-
-默认只启动webui相关服务，未启动fastchat（可选）。
-```bash
-# 若需要支撑codellama-34b-int4模型，需要给fastchat打一个补丁
-# cp examples/gptq.py ~/site-packages/fastchat/modules/gptq.py
-# examples/llm_api.py#258 修改为 kwargs={"gptq_wbits": 4},
 
-# start llm-service（可选）
-python examples/llm_api.py
-```
+或者通过`start.py`进行启动[老版启动方式](sources/readme_docs/start.md)
 更多LLM接入方法见[更多细节...](sources/readme_docs/fastchat.md)
 <br>
 
-```bash
-# 完成server_config.py配置后，可一键启动
-cd examples
-python start.py
-```
+
 ## 贡献指南
 非常感谢您对 Codefuse 项目感兴趣，我们非常欢迎您对 Codefuse 项目的各种建议、意见（包括批评）、评论和贡献。
 
```

**File**: `README_en.md` (modified, +10/-44)
```diff
@@ -146,57 +146,23 @@ git lfs clone https://huggingface.co/THUDM/chatglm2-6b
 git lfs clone https://huggingface.co/shibing624/text2vec-base-chinese
 ```
 
-4. Basic Configuration
 
+4. Start the Service
 ```bash
-# Modify the basic configuration for service startup
-cd configs
-cp model_config.py.example model_config.py
-cp server_config.py.example server_config.py
-
-# model_config#11~12 If you need to use the openai interface, openai interface key
-os.environ["OPENAI_API_KEY"] = "sk-xxx"
-# You can replace the api_base_url yourself
-os.environ["API_BASE_URL"] = "https://api.openai.com/v1"
-
-# vi model_config#105 You need to choose the language model
-LLM_MODEL = "gpt-3.5-turbo"
-
-# vi model_config#43 You need to choose the vector model
-EMBEDDING_MODEL = "text2vec-base"
-
-# vi model_config#25 Modify to your local path, if you can directly connect to huggingface, no modification is needed
-"text2vec-base": "shibing624/text2vec-base-chinese",
-
-# vi server_config#8~14, it is recommended to start the service using containers.
-DOCKER_SERVICE = True
-# Whether to use container sandboxing is up to your specific requirements and preferences
-SANDBOX_DO_REMOTE = True
-# Whether to use api-service to use chatbot
-NO_REMOTE_API = True
+# After configuring server_config.py, you can start with just one click.
+cd examples
+bash start.sh
+# you can config your llm model and embedding model
 ```
+<div align=center>
+  <img src="sources/docs_imgs/webui_config.png" alt="图片">
+</div>
 
-5. Start the Service
-
-By default, only webui related services are started, and fastchat is not started (optional).
-```bash
-# if use codellama-34b-int4, you should replace fastchat's gptq.py
-# cp examples/gptq.py ~/site-packages/fastchat/modules/gptq.py
-# examples/llm_api.py#258 => kwargs={"gptq_wbits": 4},
-
-# start llm-service（可选）
-python examples/llm_api.py
-```
+Or `python start.py` by [old version to start](sources/readme_docs/start-en.md)
 More details about accessing LLM Moldes[More Details...](sources/readme_docs/fastchat.md)
 <br>
 
-```bash
-# After configuring server_config.py, you can start with just one click.
-cd examples
-bash start_webui.sh
-```
-
-## 贡献指南
+## Contribution
 Thank you for your interest in the Codefuse project. We warmly welcome any suggestions, opinions (including criticisms), comments, and contributions to the Codefuse project.
 
 Your suggestions, opinions, and comments on Codefuse can be directly submitted through GitHub Issues.
```

**File**: `coagent/base_configs/env_config.py` (modified, +7/-6)
```diff
@@ -1,23 +1,24 @@
 import os
 import platform
+from loguru import logger
 
 system_name = platform.system()
 executable_path = os.getcwd()
 
 # 日志存储路径
 LOG_PATH = os.environ.get("LOG_PATH", None) or os.path.join(executable_path, "logs")
 
-# 知识库默认存储路径
-SOURCE_PATH = os.environ.get("SOURCE_PATH", None) or os.path.join(executable_path, "sources")
+# # 知识库默认存储路径
+# SOURCE_PATH = os.environ.get("SOURCE_PATH", None) or os.path.join(executable_path, "sources")
 
 # 知识库默认存储路径
 KB_ROOT_PATH = os.environ.get("KB_ROOT_PATH", None) or os.path.join(executable_path, "knowledge_base")
 
 # 代码库默认存储路径
 CB_ROOT_PATH = os.environ.get("CB_ROOT_PATH", None) or os.path.join(executable_path, "code_base")
 
-# nltk 模型存储路径
-NLTK_DATA_PATH = os.environ.get("NLTK_DATA_PATH", None) or os.path.join(executable_path, "nltk_data")
+# # nltk 模型存储路径
+# NLTK_DATA_PATH = os.environ.get("NLTK_DATA_PATH", None) or os.path.join(executable_path, "nltk_data")
 
 # 代码存储路径
 JUPYTER_WORK_PATH = os.environ.get("JUPYTER_WORK_PATH", None) or os.path.join(executable_path, "jupyter_work")
@@ -31,8 +32,8 @@
 # CHROMA 存储路径
 CHROMA_PERSISTENT_PATH = os.environ.get("CHROMA_PERSISTENT_PATH", None) or os.path.join(executable_path, "data/chroma_data")
 
-for _path in [LOG_PATH, SOURCE_PATH, KB_ROOT_PATH, CB_ROOT_PATH, NLTK_DATA_PATH, JUPYTER_WORK_PATH, WEB_CRAWL_PATH, NEBULA_PATH, CHROMA_PERSISTENT_PATH]:
-    if not os.path.exists(_path):
+for _path in [LOG_PATH, KB_ROOT_PATH, CB_ROOT_PATH, JUPYTER_WORK_PATH, WEB_CRAWL_PATH, NEBULA_PATH, CHROMA_PERSISTENT_PATH]:
+    if not os.path.exists(_path) and int(os.environ.get("do_create_dir", True)):
         os.makedirs(_path, exist_ok=True)
 
 # 数据库默认存储路径。
```

**File**: `coagent/codechat/codebase_handler/codebase_handler.py` (modified, +1/-0)
```diff
@@ -101,6 +101,7 @@ def import_code(self, zip_file='', do_interpret=True):
 
         # get KG info
         if self.nh:
+            time.sleep(10) # aviod nebula staus didn't complete
             stat = self.nh.get_stat()
             vertices_num, edges_num = stat['vertices'], stat['edges']
         else:
```

**File**: `coagent/connector/memory_manager.py` (modified, +5/-1)
```diff
@@ -310,7 +310,8 @@ def save(self, save_dir: str = "./"):
         # 
         save_to_json_file(memory_messages, file_path)
 
-    def load(self, load_dir: str = "./") -> Memory:
+    def load(self, load_dir: str = None) -> Memory:
+        load_dir = load_dir or self.kb_root_path
         file_path = os.path.join(load_dir, f"{self.user_name}/{self.unique_name}/{self.memory_type}/converation.jsonl")
         uuid_name = "_".join([self.user_name, self.unique_name, self.memory_type])
 
@@ -398,18 +399,21 @@ def router_retrieval(self, user_name: str = "default", text: str=None, datetime:
     def embedding_retrieval(self, text: str, top_k=1, score_threshold=1.0, user_name: str = "default", **kwargs) -> List[Message]:
         if text is None: return []
         vb_name = f"{user_name}/{self.unique_name}/{self.memory_type}"
+        # logger.debug(f"vb_name={vb_name}")
         vb = KBServiceFactory.get_service(vb_name, "faiss", self.embed_config, self.kb_root_path)
         docs = vb.search_docs(text, top_k=top_k, score_threshold=score_threshold)
         return [Message(**doc.metadata) for doc, score in docs]
     
     def text_retrieval(self, text: str, user_name: str = "default", **kwargs)  -> List[Message]:
         if text is None: return []
         uuid_name = "_".join([user_name, self.unique_name, self.memory_type])
+        # logger.debug(f"uuid_name={uuid_name}")
         return self._text_retrieval_from_cache(self.recall_memory_dict[uuid_name].messages, text, score_threshold=0.3, topK=5, **kwargs)
 
     def datetime_retrieval(self,  datetime: str, text: str = None, n: int = 5, user_name: str = "default", **kwargs) -> List[Message]:
         if datetime is None: return []
         uuid_name = "_".join([user_name, self.unique_name, self.memory_type])
+        # logger.debug(f"uuid_name={uuid_name}")
         return self._datetime_retrieval_from_cache(self.recall_memory_dict[uuid_name].messages, datetime, text, n, **kwargs)
     
     def _text_retrieval_from_cache(self, messages: List[Message], text: str = None, score_threshold=0.3, topK=5, tag_topK=5, **kwargs) -> List[Message]:
```

**File**: `coagent/sandbox/pycodebox.py` (modified, +2/-3)
```diff
@@ -7,7 +7,7 @@
 from websockets.client import WebSocketClientProtocol, ClientConnection
 from websockets.exceptions import ConnectionClosedError
 
-# from configs.model_config import JUPYTER_WORK_PATH
+from coagent.base_configs.env_config import JUPYTER_WORK_PATH
 from .basebox import BaseBox, CodeBoxResponse, CodeBoxStatus
 
 
@@ -21,7 +21,7 @@ def __init__(
             remote_ip: str = "http://127.0.0.1",
             remote_port: str = "5050",
             token: str = "mytoken",
-            jupyter_work_path: str = "",
+            jupyter_work_path: str = JUPYTER_WORK_PATH,
             do_code_exe: bool = False,
             do_remote: bool = False,
             do_check_net: bool = True,
@@ -30,7 +30,6 @@ def __init__(
         super().__init__(remote_url, remote_ip, remote_port, token, do_code_exe, do_remote)
         self.enter_status = True
         self.do_check_net = do_check_net
-        self.use_stop = use_stop
         self.jupyter_work_path = jupyter_work_path
         # asyncio.run(self.astart())
         self.start()
```

**File**: `coagent/utils/code2doc_util.py` (modified, +4/-2)
```diff
@@ -70,7 +70,8 @@ def encode2md(data, md_format):
     return md_dict
 
 
-method_text_md = '''> {function_name}
+method_text_md = '''
+> {function_name}
 
 | Column Name | Content |
 |-----------------|-----------------|
@@ -79,7 +80,8 @@ def encode2md(data, md_format):
 | Return type   | {ReturnType} |
 '''
 
-class_text_md = '''> {code_path}
+class_text_md = '''
+> {code_path}
 
 Bases: {ClassBase}
 
```

---

### Incident Patch 7: `2d726185` (2024-03-28)
**Commit Message**: [feature](webui)<add config_webui for starting app>

**File**: `.gitignore` (modified, +2/-0)
```diff
@@ -15,3 +15,5 @@ tests
 *egg-info
 build
 dist
+package.sh
+local_config.json
\ No newline at end of file
```

**File**: `README.md` (modified, +10/-47)
```diff
@@ -123,60 +123,23 @@ cd codefuse-chatbot
 pip install -r requirements.txt
 ```
 
-2、基础配置
-
+2、启动服务
 ```bash
-# 修改服务启动的基础配置
-cd configs
-cp model_config.py.example model_config.py
-cp server_config.py.example server_config.py
-
-# model_config#11~12 若需要使用openai接口，openai接口key
-os.environ["OPENAI_API_KEY"] = "sk-xxx"
-# 可自行替换自己需要的api_base_url
-os.environ["API_BASE_URL"] = "https://api.openai.com/v1"
-
-# vi model_config#LLM_MODEL 你需要选择的语言模型
-LLM_MODEL = "gpt-3.5-turbo"
-LLM_MODELs = ["gpt-3.5-turbo"]
-
-# vi model_config#EMBEDDING_MODEL 你需要选择的私有化向量模型
-EMBEDDING_ENGINE = 'model'
-EMBEDDING_MODEL = "text2vec-base"
-
-# vi model_config#embedding_model_dict 修改成你的本地路径，如果能直接连接huggingface则无需修改
-# 若模型地址为：
-model_dir: ~/codefuse-chatbot/embedding_models/shibing624/text2vec-base-chinese
-# 配置如下
-"text2vec-base": "shibing624/text2vec-base-chinese",
-
-# vi server_config#8~14, 推荐采用容器启动服务
-DOCKER_SERVICE = True
-# 是否采用容器沙箱
-SANDBOX_DO_REMOTE = True
-# 是否采用api服务来进行
-NO_REMOTE_API = True
+# 完成server_config.py配置后，可一键启动
+cd examples
+bash start.sh
+# 开始在页面进行配置即可
 ```
+<div align=center>
+  <img src="sources/docs_imgs/webui_config.png" alt="图片">
+</div>
 
-3、启动服务
-
-默认只启动webui相关服务，未启动fastchat（可选）。
-```bash
-# 若需要支撑codellama-34b-int4模型，需要给fastchat打一个补丁
-# cp examples/gptq.py ~/site-packages/fastchat/modules/gptq.py
-# examples/llm_api.py#258 修改为 kwargs={"gptq_wbits": 4},
 
-# start llm-service（可选）
-python examples/llm_api.py
-```
+或者通过`start.py`进行启动[老版启动方式](sources/readme_docs/start.md)
 更多LLM接入方法见[更多细节...](sources/readme_docs/fastchat.md)
 <br>
 
-```bash
-# 完成server_config.py配置后，可一键启动
-cd examples
-python start.py
-```
+
 ## 贡献指南
 非常感谢您对 Codefuse 项目感兴趣，我们非常欢迎您对 Codefuse 项目的各种建议、意见（包括批评）、评论和贡献。
 
```

**File**: `README_en.md` (modified, +10/-44)
```diff
@@ -146,57 +146,23 @@ git lfs clone https://huggingface.co/THUDM/chatglm2-6b
 git lfs clone https://huggingface.co/shibing624/text2vec-base-chinese
 ```
 
-4. Basic Configuration
 
+4. Start the Service
 ```bash
-# Modify the basic configuration for service startup
-cd configs
-cp model_config.py.example model_config.py
-cp server_config.py.example server_config.py
-
-# model_config#11~12 If you need to use the openai interface, openai interface key
-os.environ["OPENAI_API_KEY"] = "sk-xxx"
-# You can replace the api_base_url yourself
-os.environ["API_BASE_URL"] = "https://api.openai.com/v1"
-
-# vi model_config#105 You need to choose the language model
-LLM_MODEL = "gpt-3.5-turbo"
-
-# vi model_config#43 You need to choose the vector model
-EMBEDDING_MODEL = "text2vec-base"
-
-# vi model_config#25 Modify to your local path, if you can directly connect to huggingface, no modification is needed
-"text2vec-base": "shibing624/text2vec-base-chinese",
-
-# vi server_config#8~14, it is recommended to start the service using containers.
-DOCKER_SERVICE = True
-# Whether to use container sandboxing is up to your specific requirements and preferences
-SANDBOX_DO_REMOTE = True
-# Whether to use api-service to use chatbot
-NO_REMOTE_API = True
+# After configuring server_config.py, you can start with just one click.
+cd examples
+bash start.sh
+# you can config your llm model and embedding model
 ```
+<div align=center>
+  <img src="sources/docs_imgs/webui_config.png" alt="图片">
+</div>
 
-5. Start the Service
-
-By default, only webui related services are started, and fastchat is not started (optional).
-```bash
-# if use codellama-34b-int4, you should replace fastchat's gptq.py
-# cp examples/gptq.py ~/site-packages/fastchat/modules/gptq.py
-# examples/llm_api.py#258 => kwargs={"gptq_wbits": 4},
-
-# start llm-service（可选）
-python examples/llm_api.py
-```
+Or `python start.py` by [old version to start](sources/readme_docs/start-en.md)
 More details about accessing LLM Moldes[More Details...](sources/readme_docs/fastchat.md)
 <br>
 
-```bash
-# After configuring server_config.py, you can start with just one click.
-cd examples
-bash start_webui.sh
-```
-
-## 贡献指南
+## Contribution
 Thank you for your interest in the Codefuse project. We warmly welcome any suggestions, opinions (including criticisms), comments, and contributions to the Codefuse project.
 
 Your suggestions, opinions, and comments on Codefuse can be directly submitted through GitHub Issues.
```

**File**: `coagent/base_configs/env_config.py` (modified, +7/-6)
```diff
@@ -1,23 +1,24 @@
 import os
 import platform
+from loguru import logger
 
 system_name = platform.system()
 executable_path = os.getcwd()
 
 # 日志存储路径
 LOG_PATH = os.environ.get("LOG_PATH", None) or os.path.join(executable_path, "logs")
 
-# 知识库默认存储路径
-SOURCE_PATH = os.environ.get("SOURCE_PATH", None) or os.path.join(executable_path, "sources")
+# # 知识库默认存储路径
+# SOURCE_PATH = os.environ.get("SOURCE_PATH", None) or os.path.join(executable_path, "sources")
 
 # 知识库默认存储路径
 KB_ROOT_PATH = os.environ.get("KB_ROOT_PATH", None) or os.path.join(executable_path, "knowledge_base")
 
 # 代码库默认存储路径
 CB_ROOT_PATH = os.environ.get("CB_ROOT_PATH", None) or os.path.join(executable_path, "code_base")
 
-# nltk 模型存储路径
-NLTK_DATA_PATH = os.environ.get("NLTK_DATA_PATH", None) or os.path.join(executable_path, "nltk_data")
+# # nltk 模型存储路径
+# NLTK_DATA_PATH = os.environ.get("NLTK_DATA_PATH", None) or os.path.join(executable_path, "nltk_data")
 
 # 代码存储路径
 JUPYTER_WORK_PATH = os.environ.get("JUPYTER_WORK_PATH", None) or os.path.join(executable_path, "jupyter_work")
@@ -31,8 +32,8 @@
 # CHROMA 存储路径
 CHROMA_PERSISTENT_PATH = os.environ.get("CHROMA_PERSISTENT_PATH", None) or os.path.join(executable_path, "data/chroma_data")
 
-for _path in [LOG_PATH, SOURCE_PATH, KB_ROOT_PATH, CB_ROOT_PATH, NLTK_DATA_PATH, JUPYTER_WORK_PATH, WEB_CRAWL_PATH, NEBULA_PATH, CHROMA_PERSISTENT_PATH]:
-    if not os.path.exists(_path):
+for _path in [LOG_PATH, KB_ROOT_PATH, CB_ROOT_PATH, JUPYTER_WORK_PATH, WEB_CRAWL_PATH, NEBULA_PATH, CHROMA_PERSISTENT_PATH]:
+    if not os.path.exists(_path) and int(os.environ.get("do_create_dir", True)):
         os.makedirs(_path, exist_ok=True)
 
 # 数据库默认存储路径。
```

**File**: `coagent/codechat/codebase_handler/codebase_handler.py` (modified, +1/-0)
```diff
@@ -101,6 +101,7 @@ def import_code(self, zip_file='', do_interpret=True):
 
         # get KG info
         if self.nh:
+            time.sleep(10) # aviod nebula staus didn't complete
             stat = self.nh.get_stat()
             vertices_num, edges_num = stat['vertices'], stat['edges']
         else:
```

**File**: `coagent/connector/memory_manager.py` (modified, +5/-1)
```diff
@@ -310,7 +310,8 @@ def save(self, save_dir: str = "./"):
         # 
         save_to_json_file(memory_messages, file_path)
 
-    def load(self, load_dir: str = "./") -> Memory:
+    def load(self, load_dir: str = None) -> Memory:
+        load_dir = load_dir or self.kb_root_path
         file_path = os.path.join(load_dir, f"{self.user_name}/{self.unique_name}/{self.memory_type}/converation.jsonl")
         uuid_name = "_".join([self.user_name, self.unique_name, self.memory_type])
 
@@ -398,18 +399,21 @@ def router_retrieval(self, user_name: str = "default", text: str=None, datetime:
     def embedding_retrieval(self, text: str, top_k=1, score_threshold=1.0, user_name: str = "default", **kwargs) -> List[Message]:
         if text is None: return []
         vb_name = f"{user_name}/{self.unique_name}/{self.memory_type}"
+        # logger.debug(f"vb_name={vb_name}")
         vb = KBServiceFactory.get_service(vb_name, "faiss", self.embed_config, self.kb_root_path)
         docs = vb.search_docs(text, top_k=top_k, score_threshold=score_threshold)
         return [Message(**doc.metadata) for doc, score in docs]
     
     def text_retrieval(self, text: str, user_name: str = "default", **kwargs)  -> List[Message]:
         if text is None: return []
         uuid_name = "_".join([user_name, self.unique_name, self.memory_type])
+        # logger.debug(f"uuid_name={uuid_name}")
         return self._text_retrieval_from_cache(self.recall_memory_dict[uuid_name].messages, text, score_threshold=0.3, topK=5, **kwargs)
 
     def datetime_retrieval(self,  datetime: str, text: str = None, n: int = 5, user_name: str = "default", **kwargs) -> List[Message]:
         if datetime is None: return []
         uuid_name = "_".join([user_name, self.unique_name, self.memory_type])
+        # logger.debug(f"uuid_name={uuid_name}")
         return self._datetime_retrieval_from_cache(self.recall_memory_dict[uuid_name].messages, datetime, text, n, **kwargs)
     
     def _text_retrieval_from_cache(self, messages: List[Message], text: str = None, score_threshold=0.3, topK=5, tag_topK=5, **kwargs) -> List[Message]:
```

**File**: `coagent/sandbox/pycodebox.py` (modified, +2/-3)
```diff
@@ -7,7 +7,7 @@
 from websockets.client import WebSocketClientProtocol, ClientConnection
 from websockets.exceptions import ConnectionClosedError
 
-# from configs.model_config import JUPYTER_WORK_PATH
+from coagent.base_configs.env_config import JUPYTER_WORK_PATH
 from .basebox import BaseBox, CodeBoxResponse, CodeBoxStatus
 
 
@@ -21,7 +21,7 @@ def __init__(
             remote_ip: str = "http://127.0.0.1",
             remote_port: str = "5050",
             token: str = "mytoken",
-            jupyter_work_path: str = "",
+            jupyter_work_path: str = JUPYTER_WORK_PATH,
             do_code_exe: bool = False,
             do_remote: bool = False,
             do_check_net: bool = True,
@@ -30,7 +30,6 @@ def __init__(
         super().__init__(remote_url, remote_ip, remote_port, token, do_code_exe, do_remote)
         self.enter_status = True
         self.do_check_net = do_check_net
-        self.use_stop = use_stop
         self.jupyter_work_path = jupyter_work_path
         # asyncio.run(self.astart())
         self.start()
```

**File**: `coagent/utils/code2doc_util.py` (modified, +4/-2)
```diff
@@ -70,7 +70,8 @@ def encode2md(data, md_format):
     return md_dict
 
 
-method_text_md = '''> {function_name}
+method_text_md = '''
+> {function_name}
 
 | Column Name | Content |
 |-----------------|-----------------|
@@ -79,7 +80,8 @@ def encode2md(data, md_format):
 | Return type   | {ReturnType} |
 '''
 
-class_text_md = '''> {code_path}
+class_text_md = '''
+> {code_path}
 
 Bases: {ClassBase}
 
```

---

### Incident Patch 8: `fef3e850` (2024-03-13)
**Commit Message**: Merge pull request #30 from GeorgeGalway/fix_issue#29

[fix issue#29] api error

**File**: `examples/webui/dialogue.py` (modified, +1/-1)
```diff
@@ -474,7 +474,7 @@ def on_cb_change():
                     prompt, search_engine, se_top_k, history, embed_model=EMBEDDING_MODEL, 
                     embed_model_path=embedding_model_dict[EMBEDDING_MODEL],
                     model_device=EMBEDDING_DEVICE, embed_engine=EMBEDDING_ENGINE, llm_model=LLM_MODEL,
-                    pi_key=llm_model_dict[LLM_MODEL]["api_key"],
+                    api_key=llm_model_dict[LLM_MODEL]["api_key"],
                     api_base_url=llm_model_dict[LLM_MODEL]["api_base_url"],)
                     ):
                 if error_msg := check_error_msg(d): # check whether error occured
```

**File**: `examples/webui/document.py` (modified, +1/-1)
```diff
@@ -357,7 +357,7 @@ def format_selected_kb(kb_name: str) -> str:
                 empty.progress(0.0, "")
                 for d in api.recreate_vector_store(
                     kb, vs_type=default_vs_type, embed_model=embedding_model, embedding_device=EMBEDDING_DEVICE,
-                      embed_model_path=embedding_model_dict["embedding_model"], embed_engine=EMBEDDING_ENGINE,
+                      embed_model_path=embedding_model_dict[EMBEDDING_MODEL], embed_engine=EMBEDDING_ENGINE,
                       api_key=llm_model_dict[LLM_MODEL]["api_key"],
                       api_base_url=llm_model_dict[LLM_MODEL]["api_base_url"],
                     ):
```

---

### Incident Patch 9: `74cab0fd` (2024-03-13)
**Commit Message**: [fix issue#29]EMBEDDING_MODEL error

**File**: `examples/webui/document.py` (modified, +1/-1)
```diff
@@ -357,7 +357,7 @@ def format_selected_kb(kb_name: str) -> str:
                 empty.progress(0.0, "")
                 for d in api.recreate_vector_store(
                     kb, vs_type=default_vs_type, embed_model=embedding_model, embedding_device=EMBEDDING_DEVICE,
-                      embed_model_path=embedding_model_dict["embedding_model"], embed_engine=EMBEDDING_ENGINE,
+                      embed_model_path=embedding_model_dict[EMBEDDING_MODEL], embed_engine=EMBEDDING_ENGINE,
                       api_key=llm_model_dict[LLM_MODEL]["api_key"],
                       api_base_url=llm_model_dict[LLM_MODEL]["api_base_url"],
                     ):
```

---

### Incident Patch 10: `1c0be9ca` (2024-03-13)
**Commit Message**: [fix issue#29] api error

**File**: `examples/webui/dialogue.py` (modified, +1/-1)
```diff
@@ -474,7 +474,7 @@ def on_cb_change():
                     prompt, search_engine, se_top_k, history, embed_model=EMBEDDING_MODEL, 
                     embed_model_path=embedding_model_dict[EMBEDDING_MODEL],
                     model_device=EMBEDDING_DEVICE, embed_engine=EMBEDDING_ENGINE, llm_model=LLM_MODEL,
-                    pi_key=llm_model_dict[LLM_MODEL]["api_key"],
+                    api_key=llm_model_dict[LLM_MODEL]["api_key"],
                     api_base_url=llm_model_dict[LLM_MODEL]["api_base_url"],)
                     ):
                 if error_msg := check_error_msg(d): # check whether error occured
```

---

### Incident Patch 11: `8c57a9c9` (2024-02-19)
**Commit Message**: [fix issue#23] import error

**File**: `examples/utils.py` (modified, +1/-1)
```diff
@@ -19,7 +19,7 @@ def get_model_worker_config(
     加载model worker的配置项。
     优先级:FSCHAT_MODEL_WORKERS[model_name] > ONLINE_LLM_MODEL[model_name] > FSCHAT_MODEL_WORKERS["default"]
     '''
-    from coagent.service import model_workers
+    import model_workers
     
     config = fastchat_mdoel_workers.get("default", {}).copy()
     config.update(online_llm_model.get(model_name, {}).copy())
```

---

### Incident Patch 12: `b0091a64` (2024-01-26)
**Commit Message**: rename dev_opsgpt to coagent, and add memory&prompt manager

**File**: `.gitignore` (modified, +4/-0)
```diff
@@ -10,4 +10,8 @@ code_base
 .DS_Store
 .idea
 data
+.pyc
 tests
+*egg-info
+build
+dist
```

**File**: `Dockerfile` (modified, +0/-1)
```diff
@@ -3,7 +3,6 @@ From python:3.9.18-bookworm
 WORKDIR /home/user
 
 COPY ./requirements.txt /home/user/docker_requirements.txt
-COPY ./jupyter_start.sh /home/user/jupyter_start.sh
 
 
 RUN apt-get update
```

**File**: `LICENSE` (removed, +0/-201)
```diff
@@ -1,201 +0,0 @@
-                                 Apache License
-                           Version 2.0, January 2004
-                        http://www.apache.org/licenses/
-
-   TERMS AND CONDITIONS FOR USE, REPRODUCTION, AND DISTRIBUTION
-
-   1. Definitions.
-
-      "License" shall mean the terms and conditions for use, reproduction,
-      and distribution as defined by Sections 1 through 9 of this document.
-
-      "Licensor" shall mean the copyright owner or entity authorized by
-      the copyright owner that is granting the License.
-
-      "Legal Entity" shall mean the union of the acting entity and all
-      other entities that control, are controlled by, or are under common
-      control with that entity. For the purposes of this definition,
-      "control" means (i) the power, direct or indirect, to cause the
-      direction or management of such entity, whether by contract or
-      otherwise, or (ii) ownership of fifty percent (50%) or more of the
-      outstanding shares, or (iii) beneficial ownership of such entity.
-
-      "You" (or "Your") shall mean an individual or Legal Entity
-      exercising permissions granted by this License.
-
-      "Source" form shall mean the preferred form for making modifications,
-      including but not limited to software source code, documentation
-      source, and configuration files.
-
-      "Object" form shall mean any form resulting from mechanical
-      transformation or translation of a Source form, including but
-      not limited to compiled object code, generated documentation,
-      and conversions to other media types.
-
-      "Work" shall mean the work of authorship, whether in Source or
-      Object form, made available under the License, as indicated by a
-      copyright notice that is included in or attached to the work
-      (an example is provided in the Appendix below).
-
-      "Derivative Works" shall mean any work, whether in Source or Object
-      form, that is based on (or derived from) the Work and for which the
-      editorial revisions, annotations, elaborations, or other modifications
-      represent, as a whole, an original work of authorship. For the purposes
-      of this License, Derivative Works shall not include works that remain
-      separable from, or merely link (or bind by name) to the interfaces of,
-      the Work and Derivative Works thereof.
-
-      "Contribution" shall mean any work of authorship, including
-      the original version of the Work and any modifications or additions
-      to that Work or Derivative Works thereof, that is intentionally
-      submitted to Licensor for inclusion in the Work by the copyright owner
-      or by an individual or Legal Entity authorized to submit on behalf of
-      the copyright owner. For the purposes of this definition, "submitted"
-      means any form of electronic, verbal, or written communication sent
-      to the Licensor or its representatives, including but not limited to
-      communication on electronic mailing lists, source code control systems,
-      and issue tracking systems that are managed by, or on behalf of, the
-      Licensor for the purpose of discussing and improving the Work, but
-      excluding communication that is conspicuously marked or otherwise
-      designated in writing by the copyright owner as "Not a Contribution."
-
-      "Contributor" shall mean Licensor and any individual or Legal Entity
-      on behalf of whom a Contribution has been received by Licensor and
-      subsequently incorporated within the Work.
-
-   2. Grant of Copyright License. Subject to the terms and conditions of
-      this License, each Contributor hereby grants to You a perpetual,
-      worldwide, non-exclusive, no-charge, royalty-free, irrevocable
-      copyright license to reproduce, prepare Derivative Works of,
-      publicly display, publicly perform, sublicense, and distribute the
-      Work and such Derivative Works in Source or Object form.
-
-   3. Grant of Patent License. Subject to the terms and conditions of
-      this License, each Contributor hereby grants to You a perpetual,
-      worldwide, non-exclusive, no-charge, royalty-free, irrevocable
-      (except as stated in this section) patent license to make, have made,
-      use, offer to sell, sell, import, and otherwise transfer the Work,
-      where such license applies only to those patent claims licensable
-      by such Contributor that are necessarily infringed by their
-      Contribution(s) alone or by combination of their Contribution(s)
-      with the Work to which such Contribution(s) was submitted. If You
-      institute patent litigation against any entity (including a
-      cross-claim or counterclaim in a lawsuit) alleging that the Work
-      or a Contribution incorporated within the Work constitutes direct
-      or contributory patent infringement, then any patent licenses
-      granted to You under this License for that Work shall 
```

**File**: `README.md` (modified, +18/-8)
```diff
@@ -1,10 +1,8 @@
-<p align="left">
-    <a>中文</a>&nbsp ｜ &nbsp<a href="README_en.md">English&nbsp </a>
-</p>
-
 # <p align="center">CodeFuse-ChatBot: Development by Private Knowledge Augmentation</p>
 
 <p align="center">
+    <a href="README.md"><img src="https://img.shields.io/badge/文档-中文版-yellow.svg" alt="ZH doc"></a>
+    <a href="README_en.md"><img src="https://img.shields.io/badge/document-English-yellow.svg" alt="EN doc"></a>
     <img src="https://img.shields.io/github/license/codefuse-ai/codefuse-chatbot" alt="License">
     <a href="https://github.com/codefuse-ai/codefuse-chatbot/issues">
       <img alt="Open Issues" src="https://img.shields.io/github/issues-raw/codefuse-ai/codefuse-chatbot" />
@@ -38,7 +36,7 @@ DevOps-ChatBot是由蚂蚁CodeFuse团队开发的开源AI智能助手，致力
 💡 本项目旨在通过检索增强生成（Retrieval Augmented Generation，RAG）、工具学习（Tool Learning）和沙盒环境来构建软件开发全生命周期的AI智能助手，涵盖设计、编码、测试、部署和运维等阶段。 逐渐从各处资料查询、独立分散平台操作的传统开发运维模式转变到大模型问答的智能化开发运维模式，改变人们的开发运维习惯。
 
 本项目核心差异技术、功能点：
-- **🧠 智能调度核心：** 构建了体系链路完善的调度核心，支持多模式一键配置，简化操作流程。 [使用说明](sources/readme_docs/multi-agent.md)
+- **🧠 智能调度核心：** 构建了体系链路完善的调度核心，支持多模式一键配置，简化操作流程。 [使用说明](sources/readme_docs/coagent/coagent.md)
 - **💻 代码整库分析：** 实现了仓库级的代码深入理解，以及项目文件级的代码编写与生成，提升了开发效率。
 - **📄 文档分析增强：** 融合了文档知识库与知识图谱，通过检索和推理增强，为文档分析提供了更深层次的支持。
 - **🔧 垂类专属知识：** 为DevOps领域定制的专属知识库，支持垂类知识库的自助一键构建，便捷实用。
@@ -93,7 +91,13 @@ DevOps-ChatBot是由蚂蚁CodeFuse团队开发的开源AI智能助手，致力
 
 
 ## 🚀 快速使用
+### coagent-py
+完整文档见：[coagent](sources/readme_docs/coagent/coagent.md)
+```
+pip install coagent
+```
 
+### 使用ChatBot
 请自行安装 nvidia 驱动程序，本项目已在 Python 3.9.18，CUDA 11.7 环境下，Windows、X86 架构的 macOS 系统中完成测试。
 
 Docker安装、私有化LLM接入及相关启动问题见：[快速使用明细](sources/readme_docs/start.md)
@@ -155,19 +159,25 @@ NO_REMOTE_API = True
 ```bash
 # 若需要支撑codellama-34b-int4模型，需要给fastchat打一个补丁
 # cp examples/gptq.py ~/site-packages/fastchat/modules/gptq.py
-# dev_opsgpt/service/llm_api.py#258 修改为 kwargs={"gptq_wbits": 4},
+# examples/llm_api.py#258 修改为 kwargs={"gptq_wbits": 4},
 
 # start llm-service（可选）
-python dev_opsgpt/service/llm_api.py
+python examples/llm_api.py
 ```
-更多LLM接入方法见[详情...](sources/readme_docs/fastchat.md)
+更多LLM接入方法见[更多细节...](sources/readme_docs/fastchat.md)
 <br>
 
 ```bash
 # 完成server_config.py配置后，可一键启动
 cd examples
 python start.py
 ```
+## 贡献指南
+非常感谢您对 Codefuse 项目感兴趣，我们非常欢迎您对 Codefuse 项目的各种建议、意见（包括批评）、评论和贡献。
+
+您对 Codefuse 的各种建议、意见、评论可以直接通过 GitHub 的 Issues 提出。
+
+参与 Codefuse 项目并为其作出贡献的方法有很多：代码实现、测试编写、流程工具改进、文档完善等等。任何贡献我们都会非常欢迎，并将您加入贡献者列表。详见[Contribution Guide...](sources/readme_docs/contribution/contribute_guide.md)
 
 ## 🤗 致谢
 
```

**File**: `README_en.md` (modified, +24/-10)
```diff
@@ -1,10 +1,8 @@
-<p align="left">
-    <a href="README.md">中文</a>&nbsp ｜ &nbsp<a>English&nbsp </a>
-</p>
-
 # <p align="center">Codefuse-ChatBot: Development by Private Knowledge Augmentation</p>
 
 <p align="center">
+    <a href="README.md"><img src="https://img.shields.io/badge/文档-中文版-yellow.svg" alt="ZH doc"></a>
+    <a href="README_EN.md"><img src="https://img.shields.io/badge/document-英文版-yellow.svg" alt="EN doc"></a>
     <img src="https://img.shields.io/github/license/codefuse-ai/codefuse-chatbot" alt="License">
     <a href="https://github.com/codefuse-ai/codefuse-chatbot/issues">
       <img alt="Open Issues" src="https://img.shields.io/github/issues-raw/codefuse-ai/codefuse-chatbot" />
@@ -15,6 +13,7 @@ This project is an open-source AI intelligent assistant, specifically designed f
 
 
 ## 🔔 Updates
+- [2023.12.26] Opening the capability to integrate with open-source private large models and large model interfaces based on FastChat
 - [2023.12.01] Release of Multi-Agent and codebase retrieval functionalities.
 - [2023.11.15] Addition of Q&A enhancement mode based on the local codebase.
 - [2023.09.15] Launch of sandbox functionality for local/isolated environments, enabling knowledge retrieval from specified URLs using web crawlers.
@@ -30,13 +29,13 @@ This project is an open-source AI intelligent assistant, specifically designed f
 
 💡 The aim of this project is to construct an AI intelligent assistant for the entire lifecycle of software development, covering design, coding, testing, deployment, and operations, through Retrieval Augmented Generation (RAG), Tool Learning, and sandbox environments. It transitions gradually from the traditional development and operations mode of querying information from various sources and operating on standalone, disparate platforms to an intelligent development and operations mode based on large-model Q&A, changing people's development and operations habits.
 
-- **🧠 Intelligent Scheduling Core:** Constructed a well-integrated scheduling core system that supports multi-mode one-click configuration, simplifying the operational process.
+- **🧠 Intelligent Scheduling Core:** Constructed a well-integrated scheduling core system that supports multi-mode one-click configuration, simplifying the operational process. [coagent](sources/readme_docs/coagent/coagent-en.md)
 - **💻 Comprehensive Code Repository Analysis:** Achieved in-depth understanding at the repository level and coding and generation at the project file level, enhancing development efficiency.
 - **📄 Enhanced Document Analysis:** Integrated document knowledge bases with knowledge graphs, providing deeper support for document analysis through enhanced retrieval and reasoning.
 - **🔧 Industry-Specific Knowledge:** Tailored a specialized knowledge base for the DevOps domain, supporting the self-service one-click construction of industry-specific knowledge bases for convenience and practicality.
 - **🤖 Compatible Models for Specific Verticals:** Designed small models specifically for the DevOps field, ensuring compatibility with related DevOps platforms and promoting the integration of the technological ecosystem.
 
-🌍 Relying on open-source LLM and Embedding models, this project can achieve offline private deployments based on open-source models. Additionally, this project also supports the use of the OpenAI API.
+🌍 Relying on open-source LLM and Embedding models, this project can achieve offline private deployments based on open-source models. Additionally, this project also supports the use of the OpenAI API.[Access Demo](sources/readme_docs/fastchat-en.md)
 
 👥 The core development team has been long-term focused on research in the AIOps + NLP domain. We initiated the CodefuseGPT project, hoping that everyone could contribute high-quality development and operations documents widely, jointly perfecting this solution to achieve the goal of "Making Development Seamless for Everyone."
 
@@ -64,7 +63,7 @@ This project is an open-source AI intelligent assistant, specifically designed f
 - 💬 **LLM:**：Supports various open-source models and LLM interfaces.
 - 🛠️ **API Management:：** Enables rapid integration of open-source components and operational platforms.
 
-For implementation details, see: [Technical Route Details](sources/readme_docs/roadmap.md)
+For implementation details, see: [Technical Route Details](sources/readme_docs/roadmap-en.md)
 
 
 ## 🌐 Model Integration
@@ -79,7 +78,13 @@ If you need to integrate a specific model, please inform us of your requirements
 
 
 ## 🚀 Quick Start
+### coagent-py
+More Detail see：[coagent](sources/readme_docs/coagent/coagent-en.md)
+```
+pip install coagent
+```
 
+### ChatBot-UI
 Please install the Nvidia driver yourself; this project has been tested on Python 3.9.18, CUDA 11.7, Windows, and X86 architecture macOS systems.
 
 1. Preparation of Python environment
@@ -172,18 +177,27 @@ By default, only webui related services are started, and fastchat 
```

**File**: `coagent/base_configs/env_config.py` (added, +88/-0)
```diff
@@ -0,0 +1,88 @@
+import os
+import platform
+
+system_name = platform.system()
+executable_path = os.getcwd()
+
+# 日志存储路径
+LOG_PATH = os.environ.get("LOG_PATH", None) or os.path.join(executable_path, "logs")
+
+# 知识库默认存储路径
+SOURCE_PATH = os.environ.get("SOURCE_PATH", None) or os.path.join(executable_path, "sources")
+
+# 知识库默认存储路径
+KB_ROOT_PATH = os.environ.get("KB_ROOT_PATH", None) or os.path.join(executable_path, "knowledge_base")
+
+# 代码库默认存储路径
+CB_ROOT_PATH = os.environ.get("CB_ROOT_PATH", None) or os.path.join(executable_path, "code_base")
+
+# nltk 模型存储路径
+NLTK_DATA_PATH = os.environ.get("NLTK_DATA_PATH", None) or os.path.join(executable_path, "nltk_data")
+
+# 代码存储路径
+JUPYTER_WORK_PATH = os.environ.get("JUPYTER_WORK_PATH", None) or os.path.join(executable_path, "jupyter_work")
+
+# WEB_CRAWL存储路径
+WEB_CRAWL_PATH = os.environ.get("WEB_CRAWL_PATH", None) or os.path.join(executable_path, "knowledge_base")
+
+# NEBULA_DATA存储路径
+NELUBA_PATH = os.environ.get("NELUBA_PATH", None) or os.path.join(executable_path, "data/neluba_data")
+
+for _path in [LOG_PATH, SOURCE_PATH, KB_ROOT_PATH, NLTK_DATA_PATH, JUPYTER_WORK_PATH, WEB_CRAWL_PATH, NELUBA_PATH]:
+    if not os.path.exists(_path):
+        os.makedirs(_path, exist_ok=True)
+
+# 数据库默认存储路径。
+# 如果使用sqlite，可以直接修改DB_ROOT_PATH；如果使用其它数据库，请直接修改SQLALCHEMY_DATABASE_URI。
+DB_ROOT_PATH = os.path.join(KB_ROOT_PATH, "info.db")
+SQLALCHEMY_DATABASE_URI = f"sqlite:///{DB_ROOT_PATH}"
+
+kbs_config = {
+    "faiss": {
+    },}
+
+
+# GENERAL SERVER CONFIG
+DEFAULT_BIND_HOST = os.environ.get("DEFAULT_BIND_HOST", None) or "127.0.0.1"
+
+# NEBULA SERVER CONFIG
+NEBULA_HOST = DEFAULT_BIND_HOST
+NEBULA_PORT = 9669
+NEBULA_STORAGED_PORT = 9779
+NEBULA_USER = 'root'
+NEBULA_PASSWORD = ''
+NEBULA_GRAPH_SERVER = {
+    "host": DEFAULT_BIND_HOST,
+    "port": NEBULA_PORT,
+    "docker_port": NEBULA_PORT
+}
+
+# CHROMA CONFIG
+CHROMA_PERSISTENT_PATH = '/home/user/chatbot/data/chroma_data'
+
+
+# 默认向量库类型。可选：faiss, milvus, pg.
+DEFAULT_VS_TYPE = os.environ.get("DEFAULT_VS_TYPE") or "faiss"
+
+# 缓存向量库数量
+CACHED_VS_NUM = os.environ.get("CACHED_VS_NUM") or 1
+
+# 知识库中单段文本长度
+CHUNK_SIZE = os.environ.get("CHUNK_SIZE") or 500
+
+# 知识库中相邻文本重合长度
+OVERLAP_SIZE = os.environ.get("OVERLAP_SIZE") or 50
+
+# 知识库匹配向量数量
+VECTOR_SEARCH_TOP_K = os.environ.get("VECTOR_SEARCH_TOP_K") or 5
+
+# 知识库匹配相关度阈值，取值范围在0-1之间，SCORE越小，相关度越高，取到1相当于不筛选，建议设置在0.5左右
+# Mac 可能存在无法使用normalized_L2的问题，因此调整SCORE_THRESHOLD至 0~1100
+FAISS_NORMALIZE_L2 = True if system_name in ["Linux", "Windows"] else False
+SCORE_THRESHOLD = 1 if system_name in ["Linux", "Windows"] else 1100
+
+# 搜索引擎匹配结题数量
+SEARCH_ENGINE_TOP_K = os.environ.get("SEARCH_ENGINE_TOP_K") or 5
+
+# 代码引擎匹配结题数量
+CODE_SEARCH_TOP_K = os.environ.get("CODE_SEARCH_TOP_K") or 1
\ No newline at end of file
```

**File**: `coagent/chat/agent_chat.py` (renamed, +76/-53)
```diff
@@ -5,30 +5,26 @@
 import importlib
 import copy
 import json
+import os
 from pathlib import Path
 
-from configs.model_config import (
-    llm_model_dict, LLM_MODEL, PROMPT_TEMPLATE, 
-    VECTOR_SEARCH_TOP_K, SCORE_THRESHOLD)
+# from configs.model_config import (
+#     llm_model_dict, LLM_MODEL, PROMPT_TEMPLATE, 
+#     VECTOR_SEARCH_TOP_K, SCORE_THRESHOLD)
 
-from dev_opsgpt.tools import (
+from coagent.tools import (
     toLangchainTools, 
     TOOL_DICT, TOOL_SETS
 )
 
-from dev_opsgpt.connector.phase import BasePhase
-from dev_opsgpt.connector.agents import BaseAgent, ReactAgent
-from dev_opsgpt.connector.chains import BaseChain
-from dev_opsgpt.connector.schema import (
-    Message,
-    load_phase_configs, load_chain_configs, load_role_configs
-    )
-from dev_opsgpt.connector.schema import Memory
-from dev_opsgpt.utils.common_utils import file_normalize
-from dev_opsgpt.chat.utils import History, wrap_done
-from dev_opsgpt.connector.configs import PHASE_CONFIGS, AGETN_CONFIGS, CHAIN_CONFIGS
+from coagent.connector.phase import BasePhase
+from coagent.connector.schema import Message
+from coagent.connector.schema import Memory
+from coagent.chat.utils import History, wrap_done
+from coagent.llm_models.llm_config import LLMConfig, EmbedConfig
+from coagent.connector.configs import PHASE_CONFIGS, AGETN_CONFIGS, CHAIN_CONFIGS
 
-PHASE_MODULE = importlib.import_module("dev_opsgpt.connector.phase")
+PHASE_MODULE = importlib.import_module("coagent.connector.phase")
 
 
 
@@ -56,8 +52,8 @@ def chat(
             doc_engine_name: str = Body(..., description="知识库名称", examples=["samples"]),
             search_engine_name: str = Body(..., description="搜索引擎名称", examples=["duckduckgo"]),
             code_engine_name: str = Body(..., description="代码引擎名称", examples=["samples"]),
-            top_k: int = Body(VECTOR_SEARCH_TOP_K, description="匹配向量数"),
-            score_threshold: float = Body(SCORE_THRESHOLD, description="知识库匹配相关度阈值，取值范围在0-1之间，SCORE越小，相关度越高，取到1相当于不筛选，建议设置在0.5左右", ge=0, le=1),
+            top_k: int = Body(5, description="匹配向量数"),
+            score_threshold: float = Body(1, description="知识库匹配相关度阈值，取值范围在0-1之间，SCORE越小，相关度越高，取到1相当于不筛选，建议设置在0.5左右", ge=0, le=1),
             stream: bool = Body(False, description="流式输出"),
             local_doc_url: bool = Body(False, description="知识文件返回本地路径(true)或URL(false)"),
             choose_tools: List[str] = Body([], description="选择tool的集合"),
@@ -71,12 +67,27 @@ def chat(
             history_node_list: List = Body([], description="代码历史相关节点"),
             isDetailed: bool = Body(False, description="是否输出完整的agent相关内容"),
             upload_file: Union[str, Path, bytes] = "",
+            kb_root_path: str = Body("", description="知识库存储路径"),
+            jupyter_work_path: str = Body("", description="sandbox执行环境"),
+            sandbox_server: str = Body({}, description="代码历史相关节点"),
+            api_key: str = Body(os.environ.get("OPENAI_API_KEY"), description=""),
+            api_base_url: str = Body(os.environ.get("API_BASE_URL"),),
+            embed_model: str = Body("", description="向量模型"),
+            embed_model_path: str = Body("", description="向量模型路径"),
+            model_device: str = Body("", description="模型加载设备"),
+            embed_engine: str = Body("", description="向量模型类型"),
+            model_name: str = Body("", description="llm模型名称"),
+            temperature: float = Body(0.2, description=""),
             **kargs
             ) -> Message:
         
         # update configs
         phase_configs, chain_configs, agent_configs = self.update_configs(
             custom_phase_configs, custom_chain_configs, custom_role_configs)
+        params = locals()
+        params.pop("self")
+        embed_config: EmbedConfig = EmbedConfig(**params)
+        llm_config: LLMConfig = LLMConfig(**params)
 
         logger.info('phase_configs={}'.format(phase_configs))
         logger.info('chain_configs={}'.format(chain_configs))
@@ -86,7 +97,6 @@ def chat(
 
         # choose tools
         tools = toLangchainTools([TOOL_DICT[i] for i in choose_tools if i in TOOL_DICT])
-        logger.debug(f"upload_file: {upload_file}")
 
         if upload_file:
             upload_file_name = upload_file if upload_file and isinstance(upload_file, str) else upload_file.name
@@ -97,8 +107,8 @@ def chat(
 
         input_message = Message(
             role_content=query,
-            role_type="human",
-            role_name="user",
+            role_type="user",
+            role_name="human",
             input_query=query,
             origin_query=query,
             phase_name=phase_name,
@@ -120,30 +130,25 @@ def chat(
             ])
         # start to execute
         phase_class = getattr(PHASE_MODULE, phase_configs[input_message.phase_name]["phase_type"])
+        # TODO 需要把相关信息补充上去
         phase = phase_class(input_message.phase_name,
             t
```

**File**: `coagent/chat/base_chat.py` (renamed, +47/-19)
```diff
@@ -1,16 +1,17 @@
 from fastapi import Body, Request
 from fastapi.responses import StreamingResponse
-import asyncio, json
+import asyncio, json, os
 from typing import List, AsyncIterable
 
 from langchain import LLMChain
 from langchain.callbacks import AsyncIteratorCallbackHandler
 from langchain.prompts.chat import ChatPromptTemplate
 
-from dev_opsgpt.llm_models import getChatModel
-from dev_opsgpt.chat.utils import History, wrap_done
-from configs.model_config import (llm_model_dict, LLM_MODEL, VECTOR_SEARCH_TOP_K, SCORE_THRESHOLD)
-from dev_opsgpt.utils import BaseResponse
+from coagent.llm_models import getChatModel, getChatModelFromConfig
+from coagent.chat.utils import History, wrap_done
+from coagent.llm_models.llm_config import LLMConfig, EmbedConfig
+# from configs.model_config import (llm_model_dict, LLM_MODEL, VECTOR_SEARCH_TOP_K, SCORE_THRESHOLD)
+from coagent.utils import BaseResponse
 from loguru import logger
 
 
@@ -37,22 +38,34 @@ def chat(
                 examples=[[{"role": "user", "content": "我们来玩成语接龙，我先来，生龙活虎"}]]
                 ),
             engine_name: str = Body(..., description="知识库名称", examples=["samples"]),
-            top_k: int = Body(VECTOR_SEARCH_TOP_K, description="匹配向量数"),
-            score_threshold: float = Body(SCORE_THRESHOLD, description="知识库匹配相关度阈值，取值范围在0-1之间，SCORE越小，相关度越高，取到1相当于不筛选，建议设置在0.5左右", ge=0, le=1),
+            top_k: int = Body(5, description="匹配向量数"),
+            score_threshold: float = Body(1, description="知识库匹配相关度阈值，取值范围在0-1之间，SCORE越小，相关度越高，取到1相当于不筛选，建议设置在0.5左右", ge=0, le=1),
             stream: bool = Body(False, description="流式输出"),
             local_doc_url: bool = Body(False, description="知识文件返回本地路径(true)或URL(false)"),
             request: Request = None,
+            api_key: str = Body(os.environ.get("OPENAI_API_KEY")),
+            api_base_url: str = Body(os.environ.get("API_BASE_URL")),
+            embed_model: str = Body("", ),
+            embed_model_path: str = Body("", ),
+            embed_engine: str = Body("", ),
+            model_name: str = Body("", ),
+            temperature: float = Body(0.5, ),
+            model_device: str = Body("", ),
             **kargs
             ):
+        params = locals()
+        params.pop("self", None)
+        llm_config: LLMConfig = LLMConfig(**params)
+        embed_config: EmbedConfig = EmbedConfig(**params)
         self.engine_name = engine_name if isinstance(engine_name, str) else engine_name.default
         self.top_k = top_k if isinstance(top_k, int) else top_k.default
         self.score_threshold = score_threshold if isinstance(score_threshold, float) else score_threshold.default
         self.stream = stream if isinstance(stream, bool) else stream.default
         self.local_doc_url = local_doc_url if isinstance(local_doc_url, bool) else local_doc_url.default
         self.request = request
-        return self._chat(query, history, **kargs)
+        return self._chat(query, history, llm_config, embed_config, **kargs)
     
-    def _chat(self, query: str, history: List[History], **kargs):
+    def _chat(self, query: str, history: List[History], llm_config: LLMConfig, embed_config: EmbedConfig, **kargs):
         history = [History(**h) if isinstance(h, dict) else h for h in history]
 
         ## check service dependcy is ok
@@ -61,9 +74,10 @@ def _chat(self, query: str, history: List[History], **kargs):
         if service_status.code!=200: return service_status
 
         def chat_iterator(query: str, history: List[History]):
-            model = getChatModel()
+            # model = getChatModel()
+            model = getChatModelFromConfig(llm_config)
 
-            result, content = self.create_task(query, history, model, **kargs)
+            result, content = self.create_task(query, history, model, llm_config, embed_config, **kargs)
             logger.info('result={}'.format(result))
             logger.info('content={}'.format(content))
 
@@ -87,31 +101,45 @@ def achat(
                 examples=[[{"role": "user", "content": "我们来玩成语接龙，我先来，生龙活虎"}]]
                 ),
             engine_name: str = Body(..., description="知识库名称", examples=["samples"]),
-            top_k: int = Body(VECTOR_SEARCH_TOP_K, description="匹配向量数"),
-            score_threshold: float = Body(SCORE_THRESHOLD, description="知识库匹配相关度阈值，取值范围在0-1之间，SCORE越小，相关度越高，取到1相当于不筛选，建议设置在0.5左右", ge=0, le=1),
+            top_k: int = Body(5, description="匹配向量数"),
+            score_threshold: float = Body(1, description="知识库匹配相关度阈值，取值范围在0-1之间，SCORE越小，相关度越高，取到1相当于不筛选，建议设置在0.5左右", ge=0, le=1),
             stream: bool = Body(False, description="流式输出"),
             local_doc_url: bool = Body(False, description="知识文件返回本地路径(true)或URL(false)"),
             request: Request = None,
+            api_key: str = Body(os.environ.get("OPENAI_API_KEY")),
+            api_base_url: str = Body(os.environ.get("API_BASE_URL")),
+            embed_model: str = Body("", ),
+            embed_model_path: str = Body(""
```

---

### Incident Patch 13: `0d268274` (2023-12-29)
**Commit Message**: fix issue#13  encoding error

**File**: `dev_opsgpt/webui/dialogue.py` (modified, +1/-1)
```diff
@@ -26,7 +26,7 @@
 
 # 加载YAML文件
 webui_yaml_filename = "webui_zh.yaml" if True else "webui_en.yaml"
-with open(os.path.join(cur_dir, f"yamls/{webui_yaml_filename}"), 'r') as f:
+with open(os.path.join(cur_dir, f"yamls/{webui_yaml_filename}"), 'r', encoding='utf-8') as f:
     try:
         webui_configs = yaml.safe_load(f)
     except yaml.YAMLError as exc:
```

---

### Incident Patch 14: `2be6ffe4` (2023-12-12)
**Commit Message**: fix issue#8 import NameError

**File**: `configs/model_config.py.example` (modified, +4/-0)
```diff
@@ -1,6 +1,10 @@
 import os
+import sys
 import logging
 import torch
+import openai
+import base64
+from .utils import is_running_in_docker
 # 日志格式
 LOG_FORMAT = "%(asctime)s - %(filename)s[line:%(lineno)d] - %(levelname)s: %(message)s"
 logger = logging.getLogger()
```

---

### Incident Patch 15: `95f150b0` (2023-12-09)
**Commit Message**: fix issue#7

**File**: `configs/model_config.py.example` (modified, +1/-5)
```diff
@@ -1,10 +1,6 @@
 import os
-import sys
 import logging
 import torch
-import openai
-import base64
-from .utils import is_running_in_docker
 # 日志格式
 LOG_FORMAT = "%(asctime)s - %(filename)s[line:%(lineno)d] - %(levelname)s: %(message)s"
 logger = logging.getLogger()
@@ -156,7 +152,7 @@ NELUBA_PATH = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__fil
 
 for _path in [LOG_PATH, SOURCE_PATH, KB_ROOT_PATH, NLTK_DATA_PATH, JUPYTER_WORK_PATH, WEB_CRAWL_PATH, NELUBA_PATH]:
     if not os.path.exists(_path):
-        os.mkdir(_path)
+        os.makedirs(_path, exist_ok=True)
 
 # 数据库默认存储路径。
 # 如果使用sqlite，可以直接修改DB_ROOT_PATH；如果使用其它数据库，请直接修改SQLALCHEMY_DATABASE_URI。
```

#### Recent Merged Pull Requests:
- **PR #49** (closed): commit (@Jaytru505)
- **PR #48** (closed): Create config.yml (@Jaytru505)
- **PR #47** (closed): Create config.yml (@Jaytru505)
- **PR #46** (closed): superfusion-bot (@Jaytru505)
- **PR #45** (closed): Codefusion chatbot (@Jaytru505)
- **PR #43** (2024-06-28): Update README.md (@jincdream)
- **PR #42** (2024-06-24): Feat update muagent (@lightislost)
- **PR #39** (2024-05-30): [bug]codepages and diag_pages add args local_code_path (@lightislost)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
