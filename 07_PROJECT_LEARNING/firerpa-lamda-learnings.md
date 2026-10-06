# Forensic Learning Record (Deep Inspection): firerpa/lamda

> **Canonical Artifact**: `07_PROJECT_LEARNING/firerpa-lamda-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/firerpa/lamda](https://github.com/firerpa/lamda))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-06T04:22:11.267Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `firerpa/lamda`
- **Description**: Android Full-Stack Device Control Platform: WebRTC/H.264 remote desktop, UI/OCR/image-matching automation, one-click MITM, built-in Frida, proxy/VPN/frp/P2P networking, MCP/Agent, 160+ APIs, designed for multi-device clusters and engineered deployments.
- **Primary Language / Ecosystem**: Python
- **Discovered Manifests / Configurations**: README.md
- **Stars / Engagement**: 8532 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `examples/activity_jump.py`
```
# Copyright 2025 rev1si0n (lamda.devel@gmail.com). All rights reserved.
#encoding=utf-8
from lamda.client import *
import time

d = Device("localhost")

app = d.application("com.taobao.taobao")
app.start()

while True:
    goodsid = input("Please input a taobao goods id (item_id) (eg. 123456): ")
    if goodsid.isdigit():
        intent["package"] = "com.taobao.taobao"
        intent["action"] = "android.intent.action.VIEW"
        intent["component"] = "com.taobao.taobao/com.taobao.android.detail.alittdetail.TTDetailActivity"
        intent["data"] = f"http://internal.tt.detail.taobao.com/detail/index.html?id={goodsid}"
        d.start_activity(**intent)
        time.sleep(2)
```

### Core Architecture Module: `examples/image-detection-and-segmentation/detect.py`
```
import cv2
import numpy as np
try:
    from lamda.tflite import ObjectDetection, draw_detected, create_opencl_delegate, create_cpu_delegate
except:
    print ("Please run this script in latest firerpa internal shell")
    exit(1)

image = cv2.imread("detection.png")


classes = ['乌龟', '企鹅', '伞', '兔子', '冰激凌', '凤梨', '包', '南瓜', '吉他', '大象', '太阳花', '宇航员', '帐篷', '帽子', '房子', '挂锁', '杯子', '松鼠', '枕头', '树', '树袋熊', '椅子', '气球', '汉堡包', '熊猫', '玫瑰花', '瓢虫', '瓶子', '电话', '皇冠', '篮子', '耳机', '花盆', '苹果', '草莓', '蘑菇', '蛋糕', '蝴蝶', '裙子', '账篷', '足球', '车', '轮胎', '铲土机', '闹钟', '鞋', '马', '鱼', '鸟', '鸭子']

delegate = create_opencl_delegate()
detector = ObjectDetection(model="example_detection_model.tflite", delegate=delegate, confidence=0.8, iou=0.45, classes=classes)
results = detector.detect(image)

for bound, confidence, class_id, name in results: print("confidence:", confidence, "class:", class_id, "name:", name)

segmented = draw_detected(results, image)
cv2.imwrite("detection_output.jpg", segmented)
```

### Core Architecture Module: `examples/image-detection-and-segmentation/segmentation.py`
```
import cv2
import numpy as np
try:
    from lamda.tflite import InstanceSegmentation, draw_segmented, create_opencl_delegate, create_cpu_delegate
except:
    print ("Please run this script in latest firerpa internal shell")
    exit(1)

image = cv2.imread("segmentation.png")

delegate = create_opencl_delegate()
segmenter = InstanceSegmentation(model="example_segmentation_model.tflite", delegate=delegate, min_area=8000, split=True)
results = segmenter.detect(image)

print("num instances:", len(results))
for box, score, class_id, class_name, mask, contours in results: print(class_id, class_name, float(score), mask.shape, len(contours))

segmented = draw_segmented(results, image)
cv2.imwrite("segmentation_output.jpg", segmented)
```

### Core Architecture Module: `examples/search_in_taobao.py`
```
# Copyright 2025 rev1si0n (lamda.devel@gmail.com). All rights reserved.
#encoding=utf-8
from lamda.client import *
import time

"""
This is a simple demo for performing keyword searches on Taobao.
"""

d = Device("localhost")

app = d.application("com.taobao.taobao")

if not app.is_installed():
    print ("taobao app is not installed")
    exit (1)

if app.info().versionName != "10.48.0":
    print ("please intall taaobao 10.48.0")
    exit (1)

# ensure the app is stopped
app.stop()
time.sleep(1.5)

app.start()
time.sleep(10) # wait for app fully started

if not d(description="我的淘宝").exists():
    print ("is taobao home page?")
    exit (1)

# click to activate input
d(description="搜索栏").click()

# wait for search input activated
d(resourceId="com.taobao.taobao:id/searchbtn").wait_for_exists(15*1000)

# input search keyword: 苹果手机
d(resourceId="com.taobao.taobao:id/searchEdit").set_text("苹果手机")

# click "Search"
d(resourceId="com.taobao.taobao:id/searchbtn").click()

# wait for goods showsup
d(description="筛选").wait_for_exists(15*1000)

# do a simple swipe
d().swipe()

# ...
```

### Core Architecture Module: `examples/user-home/modules/extension/example_http_extension.py`
```
# Copyright 2025 rev1si0n (lamda.devel@gmail.com). All rights reserved.
#
# Distributed under MIT license.
# See file LICENSE for detail or copy at https://opensource.org/licenses/MIT
from lamda.extensions import *

# In order to accommodate users of various technical levels and avoid impacting the operation of the firerpa service, all HTTP rewrite methods must be implemented synchronously. These methods will run within threads and will not block the overall service.
# BaseHttpExtension is based on tornado.web.RequestHandler. If you need to use or override other methods such as set_header, initialize, etc., please refer to the official Tornado documentation.
# It is strongly discouraged to override Tornado-related methods like prepare and initialize.

# If you encounter the There is no current event loop in thread XXX exception, please call self.prepare_loop() in your overridden http_xxx method.

# 为了兼容各种技术层级的使用者以及不影响到 firerpa 服务的运行，所有 HTTP 重写方法均须为同步写法，方法将在线程内运行，不会阻塞整体服务。
# BaseHttpExtension 基于 tornado.web.RequestHandler，如需使用或重写其他方法如 set_header、initialize 等，请参照 tornado 官方文档。
# 我们不建议您重写 tornado 相关 prepare、initialize 方法。

# 如果您遇到 There is no current event loop in thread XXX 异常，请在您重写的 http_xxx 方法中调用 `self.prepare_loop()`

# REF: https://www.tornadoweb.org/en/stable/web.html

class ExampleHttpExtension(BaseHttpExtension):
    route = "/api/v1/hello-world" # API route
    def http_get(self, *args, **kwargs):
        """ GET Method Handler """
        self.write("Hello World")
    def http_post(self, *args, **kwargs):
        """ POST Method Handler """
        self.write("Hello World")
    def http_put(self, *args, **kwargs):
        """ PUT Method Handler """
        self.write("Hello World")
    def http_delete(self, *args, **kwargs):
        """ DELETE Method Handler """
        self.write("Hello World")
    def http_patch(self, *args, **kwargs):
        """ PATCH Method Handler """
        self.write("Hello World")
```

### Core Architecture Module: `examples/user-home/modules/extension/example_mcp_extension.py`
```
# Copyright 2025 rev1si0n (lamda.devel@gmail.com). All rights reserved.
#
# Distributed under MIT license.
# See file LICENSE for detail or copy at https://opensource.org/licenses/MIT
import base64

from lamda.utils import getprop
from lamda.extensions import BaseMcpExtension
from lamda.mcp import mcp, Annotated, TextContent, BlobResourceContents


class ExampleMcpExtension(BaseMcpExtension):
    route = "/model-context-protocol/mcp/"
    name = "example-mcp-extension"
    version = "1.0.0"
    @mcp("tool", description="Send a greeting to others.")
    def greeting(self, ctx, msg: Annotated[str, "Greeting message"],
                            to: Annotated[str, "Greeting to who"] = "John"):
        return TextContent(text=f"mcp greeting! {msg}, {to}!")
    @mcp("tool", description="Read android system property by name.")
    def getprop(self, ctx, name: Annotated[str, "Android system property name."]):
        return TextContent(text=getprop(name) or "")
    @mcp("resource", uri="file://{absolute_path}")
    def get_file(self, ctx, absolute_path: Annotated[str, "Absolute file path"]):
        """ Read file content on the device by full path """
        blob = base64.b64encode(open(absolute_path, "rb").read()).decode()
        return BlobResourceContents(blob=blob, uri=f"file://{absolute_path}",
                                    mimeType="text/plain")
```

### Core Architecture Module: `examples/user-home/modules/extension/firerpa.py`
```
# Copyright 2025 rev1si0n (lamda.devel@gmail.com). All rights reserved.
#
# Distributed under MIT license.
# See file LICENSE for detail or copy at https://opensource.org/licenses/MIT
#
# ===================================================================
# Official FireRPA MCP extension, turning your phone into an AI AGENT
# ===================================================================
#
import json
import xml.etree.ElementTree as etree

from lamda.mcp import *
from lamda.client import *
from lamda.utils import getprop
from lamda.extensions import BaseMcpExtension, to_json_string
from google.protobuf.json_format import MessageToDict
from xmltodict import parse as xml2dict


prompt = """
# Android Automation Guidelines

You are an expert in Android automation, capable of using specialized tools to accurately complete user-requested operations. You understand and can precisely execute each step in the automation process.

## Quality Assurance
- Prioritize using layout information for identifying operational elements. You should always use non-repeating criteria for judgment.
- Resource-id may be duplicated, and duplicate ids should not be used.
- Each operation should have a certain interval; otherwise, the page may not be fully loaded.
- Never use screenshot to detect coordinates.

## Communication
- Follow the user's language preferences"""


class FireRpaMcpExtension(BaseMcpExtension):
    """Your primary task is to help users automate Android device control using AI through this MCP service."""
    route = "/firerpa/mcp/"
    name = "firerpa"
    version = "1.0"
    @mcp("tool", description="Dumps android window's layout hierarchy as JSON string.")
    def dump_window_hierarchy(self, ctx, compressed: Annotated[bool, "Enables or disables layout hierarchy compression, default true."] = True):
        data = self.device.dump_window_hierarchy(compressed).getvalue()
        return self.remove_attrs_and_empty(data)
    @mcp("tool", description="Perform a click at arbitrary coordinates on the display.")
    def click(self, ctx, pointX: Annotated[int, "X coordinate."], pointY: Annotated[int, "Y coordinate."]):
        result = self.device.click(Point(x=pointX, y=pointY))
        return str(result).lower()
    @mcp("tool", description="Perform a swipe between two points.")
    def swipe(self, ctx, fromX: Annotated[int, "Swipe-from X coordinate."], fromY: Annotated[int, "Swipe-from Y coordinate."], toX: Annotated[int, "Swipe-to X coordinate."], toY: Annotated[int, "Swipe-to Y coordinate."], step: Annotated[int, "Step to inject between two points"] = 32):
        result = self.device.swipe(Point(x=fromX, y=fromY), Point(x=toX, y=toY), step=step)
        return str(result).lower()
    @mcp("tool", description="Perform a drag between two points.")
    def drag(self, ctx, fromX: Annotated[int, "Drag-from X coordinate."], fromY: Annotated[int, "Drag-from Y coordinate."], toX: Annotated[int, "Drag-to X coordinate."], toY: Annotated[int, "Drag-to Y coordinate."]):
        result = self.device.drag(Point(x=fromX, y=fromY), Point(x=toX, y=toY))
        return str(result).lower()
    @mcp("tool", description="Get device information such as screen width, height, brand, etc.")
    def get_deviec_info(self, ctx):
        info = self.device.device_info()
        return to_json_string(MessageToDict(info))
    @mcp("tool", description="Display a toast message on the screen.")
    def show_toast(self, ctx, message: Annotated[str, "The toast message."]):
        result = self.device.show_toast(message)
        return str(result).lower()
    @mcp("tool", description="Execute script in the device's shell foreground.")
    def execute_shell_script_foreground(self, ctx, scrip: Annotated[str, "Shell script content."]):
        result = self.device.execute_script(scrip)
        return to_json_string(MessageToDict(result))
    @mcp("tool", description="Wake up the device.")
    def wake_up(self, ctx):
        result = self.device.wake_up()
        return str(result).lower()
    @mcp("tool", description="Turn off the device screen.")
    def sleep(self, ctx):
        result = self.device.sleep()
        return str(result).lower()
    @mcp("tool", description="Check if the device screen is lit up.")
    def is_screen_on(self, ctx):
        result = self.device.is_screen_on()
        return str(result).lower()
    @mcp("tool", description="Check is the device screen locked.")
    def is_screen_locked(self, ctx):
        result = self.device.is_screen_locked()
        return str(result).lower()
    @mcp("tool", description="Get the device clipboard content.")
    def get_clipboard_text(self, ctx):
        result = self.device.get_clipboard()
        return result
    @mcp("tool", description="Set the device clipboard content.")
    def set_clipboard_text(self, ctx, text: Annotated[str, "The text to set."]):
        result = self.device.set_clipboard(text)
        return str(result).lower()
    @mcp("tool", description="Simulates a short press using a key code.")
    def press_key_code(self, ctx, key_code: Annotated[int, "The Android's KeyEvent keycode."]):
        result = self.device.press_keycode(key_code)
        return str(result).lower()
    @mcp("tool", description="Get the last displayed toast on the system.")
    def get_last_toast(self, ctx):
        result = self.device.get_last_toast()
        return to_json_string(MessageToDict(result))
    @mcp("tool", description="Read android system property by name.")
    def getprop(self, ctx, name: Annotated[str, "Android system property name."]):
        return getprop(name) or ""
    @mcp("tool", description="Use full text matching to click on an element.")
    def click_by_text(self, ctx, text: Annotated[str, "The full text field."]):
        result = self.device(text=text).click_exists()
        return str(result).lower()
    @mcp("tool", description="Use text contains matching to click on an element.")
    def click_by_text_contains(self, ctx, substring: Annotated[str, "The substring to be matched."]):
        result = self.device(textContains=substring).click_exists()
        return str(result).lower()
    @mcp("tool", description="Use text regex matching to click on an element.")
    def click_by_text_matches(self, ctx, regex: Annotated[str, "The string matching the element's text."]):
        result = self.device(textMatches=regex).click_exists()
        return str(result).lower()
    @mcp("tool", description="Use full description matching to click on an element.")
    def click_by_description(self, ctx, text: Annotated[str, "The full description field."]):
        result = self.device(description=text).click_exists()
        return str(result).lower()
    @mcp("tool", description="Use description contains matching to click on an element.")
    def click_by_description_contains(self, ctx, substring: Annotated[str, "The substring to be matched."]):
        result = self.device(descriptionContains=substring).click_exists()
        return str(result).lower()
    @mcp("tool", description="Use description regex matching to click on an element.")
    def click_by_description_matches(self, ctx, regex: Annotated[str, "The string matching the element's description."]):
        result = self.device(descriptionMatches=regex).click_exists()
        return str(result).lower()
    @mcp("tool", description="Use resourceId to click on an element, if the resource-id is duplicated, it cannot be used.")
    def click_by_resource_id(self, ctx, resource_id: Annotated[str, "Elements's resourceId (resourceName)."]):
        result = self.device(resourceId=resource_id).click_exists()
        return str(result).lower()
    @mcp("tool", description="Use resourceId to input text into an input element, if the resource-id is duplicated, it cannot be used.")
    def set_text_by_resource_id(self, ctx, resource_id: Annotated[str, "Input elements's resourceId (resourceName)."], text: Annotated[str, "The input text."]):
        result = self.device(resourceId=resource_id).set_text(text)
        return str(result).lower()
    @mcp("tool", description="Use className to input text into an input element.")
    def set_text_by_class_name(self, ctx, class_name: Annotated[str, "Input elements's className. eg: android.widget.EditText"], text: Annotated[str, "The input text."]):
        result = self.device(className=class_name).set_text(text)
        return str(result).lower()
    @mcp("tool", description="Get information about the currently running foreground application.")
    def current_top_application_info(self, ctx):
        result = self.device.current_application().info()
        return to_json_string(MessageToDict(result))
    @mcp("tool", description="Use the package name to launch an Android app.")
    def start_application_by_id(self, ctx, package_name: Annotated[str, "The package name, such as com.android.settings."]):
        result = self.device.application(package_name).start()
        return str(result).lower()
    @mcp("tool", description="Use the package name to close an Android app.")
    def stop_application_by_id(self, ctx, package_name: Annotated[str, "The package name, such as com.android.settings."]):
        result = self.device.application(package_name).stop()
        return str(result).lower()
    @mcp("tool", description="Use the package name to check if the application is installed.")
    def is_application_installed(self, ctx, package_name: Annotated[str, "The package name, such as com.android.settings."]):
        result = self.device.application(package_name).is_installed()
        return str(result).lower()
    @mcp("tool", description="Check if the application is running in the foreground using the package name.")
    def is_application_running_foreground(self, ctx, package_name: Annotated[str, "The package name, such as com.android.settings."]):
        result = self.device.application(package_name).is_foreground()
        return str(result).lower()
    @mcp("tool", description="Get al
```

### Core Architecture Module: `examples/user-home/modules/extension/mcp_return_types.py`
```
#!/usr/bin/env python3
# Copyright 2025 rev1si0n (lamda.devel@gmail.com). All rights reserved.
#
# Distributed under MIT license.
# See file LICENSE for detail or copy at https://opensource.org/licenses/MIT
#
# THIS IS THE OFFICIAL MCP TYPES equivalent made by firerpa authors (FUCKOFF pydantic)
# github.com/modelcontextprotocol/python-sdk/blob/v1.13.1/src/mcp/types.py
# WE ONLY LIST THE TYPES THAT YOU CAN USE
import msgspec

from msgspec import Struct, Meta
from typing import Dict, Any, Literal, List, Union, Annotated


Role = Literal["user", "assistant"]
LoggingLevel = Literal["debug", "info", "notice", "warning", "error", "critical", "alert", "emergency"]


class BaseModel(Struct, omit_defaults=False):
    def validate(self):
        return msgspec.json.decode(msgspec.json.encode(self),
                                            type=type(self))


class BaseStructuredModel(BaseModel):
    """ StructuredModel """


class Result(BaseModel):
    """Base class for JSON-RPC results."""


class Annotations(BaseModel):
    audience: Union[list[Role], None] = None
    priority: Union[Annotated[float, Meta(ge=0.0, le=1.0)], None] = None


class ResourceContents(BaseModel):
    """The contents of a specific resource or sub-resource."""

    uri: Annotated[str, Meta(min_length=5, max_length=2**16,
                              pattern="^[a-z0-9A-Z_-]+://.*$")]
    """The URI of this resource."""
    mimeType: Union[str, None] = None
    """The MIME type of this resource, if known."""


class TextResourceContents(ResourceContents, kw_only=True):
    """Text contents of a resource."""
    text: str
    """The text of the item."""


class BlobResourceContents(ResourceContents, kw_only=True):
    """Binary contents of a resource."""
    blob: str
    """A base64-encoded string representing the binary data of the item."""


class TextContent(BaseModel, kw_only=True):
    """Text content for a message."""

    type: Literal["text"] = "text"
    text: str
    """The text content of the message."""
    annotations: Union[Annotations, None] = None


class ImageContent(BaseModel, kw_only=True):
    """Image content for a message."""

    type: Literal["image"] = "image"
    data: str
    """The base64-encoded image data."""
    mimeType: str
    """The MIME type of the image."""
    annotations: Union[Annotations, None] = None


class EmbeddedResource(BaseModel, kw_only=True):
    """
    The contents of a resource, embedded into a prompt or tool call result.

    It is up to the client how best to render embedded resources for the benefit
    of the LLM and/or the user.
    """

    type: Literal["resource"] = "resource"
    resource: Union[TextResourceContents, BlobResourceContents]
    annotations: Union[Annotations, None] = None


class PromptMessage(BaseModel):
    """Describes a message returned as part of a prompt."""

    role: Role
    content: Union[TextContent, ImageContent, EmbeddedResource]


class GetPromptResult(Result, kw_only=True):
    """The server's response to a prompts/get request from the client."""

    description: Union[str, None] = ""
    """An optional description for the prompt."""
    messages: list[PromptMessage]


class EmptyResult(Result):
    """A response that indicates success but carries no data."""


class CallToolResult(Result):
    """The server's response to a tool call."""

    content: list[Union[TextContent, ImageContent, EmbeddedResource]]
    structuredContent: Union[Dict[str, Any], None] = None
    isError: bool = False


class ReadResourceResult(Result):
    """The server's response to a resources/read request from the client."""

    contents: List[Union[TextResourceContents, BlobResourceContents]]
```

### Core Architecture Module: `examples/user-home/modules/extension/mcp_sms_reader.py`
```
# Copyright 2025 rev1si0n (lamda.devel@gmail.com). All rights reserved.
#
# Distributed under MIT license.
# See file LICENSE for detail or copy at https://opensource.org/licenses/MIT
#
# ===================================================================
# MCP for reading local SMS messages. 用于读取本机短信的 MCP 扩展
# ===================================================================
#
import json
import sqlite3
from lamda.mcp import mcp, Annotated, TextContent
from lamda.extensions import BaseMcpExtension

db_path = "/data/data/com.android.providers.telephony/databases/mmssms.db"

class SmsMcpExtension(BaseMcpExtension):
    route = "/sms/mcp/"
    name = "sms-reader-extension"
    version = "1.0"
    @mcp("tool", description="""Reads the SMS database using SQL statements in SQLite syntax; read-only, no write operations allowed.
    The database is standard android mmssms.db, you should always learn the tables or table structure if needed.""")
    def read_sms_database_by_sql(self, ctx, sql: Annotated[str, "A raw SQL (SQLite) query string for read-only operations."]):
        db = sqlite3.connect(db_path)
        db.row_factory = sqlite3.Row
        db.execute("PRAGMA query_only")
        try:
            items = db.execute(sql)
            results = json.dumps([dict(row) for row in items.fetchall()])
        finally:
            db.close()
        return TextContent(text=results)
```

### Core Architecture Module: `lamda/__init__.py`
```
# Copyright 2022 rev1si0n (lamda.devel@gmail.com). All rights reserved.
#
# Distributed under MIT license.
# See file LICENSE for detail or copy at https://opensource.org/licenses/MIT
__version__ = "10.9"

```

### Core Architecture Module: `lamda/client.py`
```
# Copyright 2022 rev1si0n (https://github.com/rev1si0n). All rights reserved.
#
# Distributed under MIT license.
# See file LICENSE for detail or copy at https://opensource.org/licenses/MIT
import os
import io
import re
import sys
import copy
import time
import uuid
import json
import base64
import posixpath
import hashlib
import platform
import warnings
import builtins
import logging
import msgpack
# fix protobuf>=4.0/win32, #10158
if sys.platform == "win32":
    os.environ["PROTOCOL_BUFFERS_PYTHON_IMPLEMENTATION"] = "python"
import grpc

import pem as Pem
import collections.abc
# fix pyreadline, py310, Windows
collections.Callable = collections.abc.Callable

from urllib.parse import quote
from collections import defaultdict
from cryptography.fernet import Fernet
from os.path import basename, dirname, expanduser, join as joinpath
from google.protobuf.json_format import MessageToDict, MessageToJson
from grpc_interceptor import ClientInterceptor
from google.protobuf.message import Message
from asn1crypto import pem, x509

try:
    import frida
    _frida_dma = frida.get_device_manager()
except (ImportError, AttributeError):
    _frida_dma = None

from . import __version__
from . types import AttributeDict, BytesIO
from . exceptions import (UnHandledException, DuplicateEntryError,
                          InvalidArgumentError, UiObjectNotFoundException,
                          IllegalStateException, InvalidOperationError)
from . import exceptions

handler = logging.StreamHandler()
logger = logging.getLogger("lamda.client")
formatter = logging.Formatter("%(asctime)s %(process)d %(levelname)7s@%(module)s:%(funcName)s - %(message)s")
handler.setFormatter(formatter)
logger.addHandler(handler)

sys.path.append(joinpath(dirname(__file__)))
sys.path.append(joinpath(dirname(__file__), "rpc"))
# use native resolver to support mDNS
os.environ["GRPC_DNS_RESOLVER"] = "native"

protos, services = grpc.protos_and_services("services.proto")
__all__ = [
                "Corner",
                "Direction",
                "GproxyType",
                "GrantType",
                "Group",
                "CustomOcrBackend",
                "OcrEngine",
                "Key",
                "Keys",
                "KeyCode",
                "KeyCodes",
                "MetaKeyCode",
                "MetaKeyCodes",
                "BaseCryptor",
                "FernetCryptor",
                "OpenVPNAuth",
                "OpenVPNEncryption",
                "OpenVPNKeyDirection",
                "FindImageMethod",
                "FindImageArea",
                "ToastDuration",
                "OpenVPNCipher",
                "OpenVPNProto",
                "Orientation",
                "OpenVPNProfile",
                "GproxyProfile",
                "TouchBuilder",
                "ScriptRuntime",
                "DataEncode",
                "ImePolicy",
                "AudioStreamType",
                "PlayAudioProfile",
                "ApplicationInfo",
                "Selector",
                "TouchWait",
                "TouchMove",
                "TouchDown",
                "TouchUp",
                "TouchAction",
                "TouchSequence",
                "Point",
                "Bound",
                "load_proto",
                "to_dict",
                "Device",
                "logger",
]

def getXY(p):
    return p.x, p.y

def checkArgumentTyp(a, types):
    if not isinstance(a, types):
        raise InvalidArgumentError(a)

def touchSequenceSave(s, fpath):
    return BytesIO(s.SerializeToString()).save(fpath)

def touchSequenceLoad(s, fpath):
    return s.FromString(BytesIO.load(fpath).getvalue())

def touchSequenceIndexer(s, index):
    return s.sequence[index]

def touchSequenceIter(s):
    yield from s.sequence

def touchSequenceAppendAction(s, **kwargs):
    action = TouchAction(**kwargs)
    s.sequence.append(action)

def touchSequenceAppendDown(s, **kwargs):
    touchSequenceAppendAction(s, down=TouchDown(**kwargs))

def touchSequenceAppendMove(s, **kwargs):
    touchSequenceAppendAction(s, move=TouchMove(**kwargs))

def touchSequenceAppendWait(s, **kwargs):
    touchSequenceAppendAction(s, wait=TouchWait(**kwargs))

def touchSequenceAppendUp(s, **kwargs):
    touchSequenceAppendAction(s, up=TouchUp(**kwargs))

def touchActionRealAction(a):
    return getattr(a, a.type)

def touchActionType(a):
    return a.WhichOneof("action")

def touchMoveShiftX(a, offset):
    a.x = a.x + offset
    return a.x

def touchMoveShiftY(a, offset):
    a.y = a.y + offset
    return a.y

def touchWaitShift(w, offset):
    w.wait = w.wait + offset
    return w.wait

def applicationInfoSet(application, app):
    application.CopyFrom(app.info())

def height(b):
    return b.bottom - b.top

def width(b):
    return b.right - b.left

def center(b):
    x = int(b.left + (b.right - b.left)/2)
    y = int(b.top + (b.bottom - b.top)/2)
    return Point(x=x, y=y)

def contain(a, b):
    return all([b.top >= a.top,
                b.left >= a.left,
                b.bottom <= a.bottom,
                b.right <= a.right])

def equal(a, b):
    if not isinstance(b, protos.Bound):
        return False
    return all([b.top == a.top,
                b.left == a.left,
                b.bottom == a.bottom,
                b.right == a.right])

def corner(b, position):
    ca, cb = position.split("-")
    return Point(x=getattr(b, cb),
                 y=getattr(b, ca))

# enum types
Corner = protos.Corner
Direction = protos.Direction
GproxyType = protos.GproxyType
GrantType = protos.GrantType
ScriptRuntime = protos.ScriptRuntime
DataEncode = protos.DataEncode
ImePolicy = protos.ImePolicy

Group = protos.Group
Key = protos.Key
Keys = protos.Key # make an alias

KeyCode = protos.KeyCode
KeyCodes = protos.KeyCode # make an alias

MetaKeyCode = protos.MetaKeyCode
MetaKeyCodes = protos.MetaKeyCode # make an alias

OpenVPNAuth = protos.OpenVPNAuth
OpenVPNEncryption = protos.OpenVPNEncryption
OpenVPNKeyDirection = protos.OpenVPNKeyDirection
OpenVPNCipher = protos.OpenVPNCipher
OpenVPNProto = protos.OpenVPNProto
ToastDuration = protos.ToastDuration
Orientation = protos.Orientation

AudioStreamType = protos.AudioStreamType
PlayAudioProfile = protos.PlayAudioRequest

# proxy request alias
OpenVPNProfile = protos.OpenVPNConfigRequest
GproxyProfile = protos.GproxyConfigRequest

# multitouch
TouchMove = protos.TouchMove
TouchWait = protos.TouchWait
TouchDown = protos.TouchDown
TouchUp = protos.TouchUp

TouchSequence = protos.TouchSequence
TouchAction = protos.TouchAction

ApplicationInfo = protos.ApplicationInfo
# uiautomator types
_Selector = protos.Selector
Bound = protos.Bound
Point = protos.Point

Point.getXY = getXY
ApplicationInfo.set = applicationInfoSet

TouchWait.shift = touchWaitShift

TouchMove.shiftX = touchMoveShiftX
TouchMove.shiftY = touchMoveShiftY

TouchDown.shiftX = touchMoveShiftX
TouchDown.shiftY = touchMoveShiftY

TouchAction.type = property(touchActionType)
TouchAction.action = property(touchActionRealAction)

TouchSequence.load = classmethod(touchSequenceLoad)
TouchSequence.save = touchSequenceSave
TouchSequence.appendAction = touchSequenceAppendAction
TouchSequence.appendDown = touchSequenceAppendDown
TouchSequence.appendMove = touchSequenceAppendMove
TouchSequence.appendWait = touchSequenceAppendWait
TouchSequence.appendUp = touchSequenceAppendUp

TouchSequence.__getitem__ = touchSequenceIndexer
TouchSequence.__iter__ = touchSequenceIter

HookRpcRequest = protos.HookRpcRequest
HookRpcResponse = protos.HookRpcResponse

Bound.width = property(width)
Bound.height = property(height)

FindImageMethod = protos.FindImageMethod
FindImageArea = protos.FindImageArea

Bound.center = center
Bound.corner = corner
Bound.__contains__ = contain
Bound.__eq__ = equal


def load_proto(name):
    """Load related proto files from the package."""
    return grpc.protos_and_services(name)


def to_dict(prot):
    """Convert a proto response to a dict."""
    r = MessageToJson(prot, preserving_proto_field_name=True)
    return json.loads(r)


def Selector(**kwargs):
    """ Selector wrapper """
    fields = set(kwargs.pop("fields", []))
    fields.update(kwargs.keys())
    sel = _Selector(**kwargs, fields=fields)
    return sel


def child_sibling(s, name, **selector):
    s = copy.deepcopy(s)
    s.childOrSibling.append(name)
    s.childOrSiblingSelector.append(Selector(**selector))
    return s


def child(s, **selector):
    return child_sibling(s, "child", **selector)


def sibling(s, **selector):
    return child_sibling(s, "sibling", **selector)


# bind Selector level child sibling
_Selector.child = child
_Selector.sibling = sibling


class CustomOcrBackend(object):
    def __init__(self, *args, **kwargs):
        raise NotImplementedError
    def ocr(self, image):
        raise NotImplementedError


class BaseCryptor(object):
    def encrypt(self, data):
        return data
    def decrypt(self, data):
        return data


class BaseServiceStub(object):
    def __init__(self, stub):
        self.stub = stub


class FernetCryptor(BaseCryptor):
    def __init__(self, key=None):
        key = self._get_key(key)
        self.encoder = Fernet(key)
    def encrypt(self, data):
        return self.encoder.encrypt(data)
    def decrypt(self, data):
        return self.encoder.decrypt(data)
    def _get_key(self, key):
        key = (key or "").encode()
        key = hashlib.sha256(key).digest()
        key = base64.b64encode(key)
        return key


class TouchBuilder(object):
    def __init__(self):
        self.s = TouchSequence()
    def down(self, x, y, z=128, contact=0):
        self.s.appendDown(tid=contact, x=x, y=y,
                          pressure=z)
        return self
    def move(self, x, y, z=128, contact=0):
        self.s.appendMove(tid=contact, x=x, y=y,
                          pressure=z)
        return self
    def up(self, contact=0):
        self.s.appendUp(tid=contact)
        return self
    def w
```

### Core Architecture Module: `lamda/const.py`
```
# Copyright 2022 rev1si0n (https://github.com/rev1si0n). All rights reserved.
#
# Distributed under MIT license.
# See file LICENSE for detail or copy at https://opensource.org/licenses/MIT

# Android runtime permissions
PERMISSION_READ_SMS = "android.permission.READ_SMS"
PERMISSION_READ_CALENDAR = "android.permission.READ_CALENDAR"
PERMISSION_READ_CALL_LOG = "android.permission.READ_CALL_LOG"
PERMISSION_ACCESS_FINE_LOCATION = "android.permission.ACCESS_FINE_LOCATION"
PERMISSION_ANSWER_PHONE_CALLS = "android.permission.ANSWER_PHONE_CALLS"
PERMISSION_RECEIVE_WAP_PUSH = "android.permission.RECEIVE_WAP_PUSH"
PERMISSION_BODY_SENSORS = "android.permission.BODY_SENSORS"
PERMISSION_READ_PHONE_NUMBERS = "android.permission.READ_PHONE_NUMBERS"
PERMISSION_RECEIVE_MMS = "android.permission.RECEIVE_MMS"
PERMISSION_RECEIVE_SMS = "android.permission.RECEIVE_SMS"
PERMISSION_READ_EXTERNAL_STORAGE = "android.permission.READ_EXTERNAL_STORAGE"
PERMISSION_ACCESS_COARSE_LOCATION = "android.permission.ACCESS_COARSE_LOCATION"
PERMISSION_READ_PHONE_STATE = "android.permission.READ_PHONE_STATE"
PERMISSION_SEND_SMS = "android.permission.SEND_SMS"
PERMISSION_CALL_PHONE = "android.permission.CALL_PHONE"
PERMISSION_WRITE_CONTACTS = "android.permission.WRITE_CONTACTS"
PERMISSION_ACCEPT_HANDOVER = "android.permission.ACCEPT_HANDOVER"
PERMISSION_CAMERA = "android.permission.CAMERA"
PERMISSION_WRITE_CALENDAR = "android.permission.WRITE_CALENDAR"
PERMISSION_WRITE_CALL_LOG = "android.permission.WRITE_CALL_LOG"
PERMISSION_USE_SIP = "android.permission.USE_SIP"
PERMISSION_PROCESS_OUTGOING_CALLS = "android.permission.PROCESS_OUTGOING_CALLS"
PERMISSION_READ_CELL_BROADCASTS = "android.permission.READ_CELL_BROADCASTS"
PERMISSION_GET_ACCOUNTS = "android.permission.GET_ACCOUNTS"
PERMISSION_WRITE_EXTERNAL_STORAGE = "android.permission.WRITE_EXTERNAL_STORAGE"
PERMISSION_ACTIVITY_RECOGNITION = "android.permission.ACTIVITY_RECOGNITION"
PERMISSION_RECORD_AUDIO = "android.permission.RECORD_AUDIO"
PERMISSION_READ_CONTACTS = "android.permission.READ_CONTACTS"
PERMISSION_ACCESS_BACKGROUND_LOCATION = "android.permission.ACCESS_BACKGROUND_LOCATION"
PERMISSION_ACCESS_MEDIA_LOCATION = "android.permission.ACCESS_MEDIA_LOCATION"

# Android activity flags
FLAG_ACTIVITY_BROUGHT_TO_FRONT = 0x00400000
FLAG_ACTIVITY_CLEAR_TASK = 0x00008000
FLAG_ACTIVITY_CLEAR_TOP = 0x04000000
FLAG_ACTIVITY_EXCLUDE_FROM_RECENTS = 0x00800000
FLAG_ACTIVITY_FORWARD_RESULT = 0x02000000
FLAG_ACTIVITY_LAUNCHED_FROM_HISTORY = 0x00100000
FLAG_ACTIVITY_LAUNCH_ADJACENT = 0x00001000
FLAG_ACTIVITY_MATCH_EXTERNAL = 0x00000800

FLAG_ACTIVITY_MULTIPLE_TASK = 0x08000000
FLAG_ACTIVITY_NEW_DOCUMENT = 0x00080000
FLAG_ACTIVITY_NEW_TASK = 0x10000000
FLAG_ACTIVITY_NO_ANIMATION = 0x00010000
FLAG_ACTIVITY_NO_HISTORY = 0x40000000
FLAG_ACTIVITY_NO_USER_ACTION = 0x00040000

FLAG_ACTIVITY_PREVIOUS_IS_TOP = 0x01000000
FLAG_ACTIVITY_REORDER_TO_FRONT = 0x00020000
FLAG_ACTIVITY_REQUIRE_DEFAULT = 0x00000200
FLAG_ACTIVITY_REQUIRE_NON_BROWSER = 0x00000400

FLAG_ACTIVITY_RESET_TASK_IF_NEEDED = 0x00200000
FLAG_ACTIVITY_RETAIN_IN_RECENTS = 0x00002000
FLAG_ACTIVITY_SINGLE_TOP = 0x20000000
FLAG_ACTIVITY_TASK_ON_HOME = 0x00004000
```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #33** (2023-02-22): **当我执行 pip3 install -U --force-reinstall 'lamda[frida]' 报错**
  *Symptoms*: 当我执行 pip3 install -U --force-reinstall 'lamda[frida]' 报错 错误内容如下： ERROR: Invalid requirement: "'lamda[frida]'"  我在 https://pypi.org/search/?q=lamda%5Bfrida%5D&o= 上搜索 lamda[frida]也没有搜索到 
  **Post-Mortem & Fix Analysis**:
  > 去掉单引号试试
  > 是的，我刚才去掉单引号就成功了，谢谢！     ------------------&nbsp;原始邮件&nbsp;------------------ 发件人: ***@***.***&gt;;  发送时间: 2023年2月22日(星期三) 下午4:01 收件人: ***@***.***&gt;;  抄送: ***@***.***&gt;; ***@***.***&gt;;  主题: Re: [rev1si0n/lamda] 当我执行 pip3 install -U --force-reinstall &#39;lamda[frida]&#39; 报错 (Issue #33)        去掉单引号试试   — Reply to this email directly, view it on GitHub, or unsubscribe. You are receiving this because you authored the thread.Message ID: ***@***.***&gt;

- **Issue #32** (2023-02-21): **[BUG]**
  *Symptoms*: **Describe the bug** 我使用magisk刷入的模块，在使用frps端口转发时,在frp面板发现好像没有转发成功，我如何查看到相关frp是否转发成功的日志  **Generate statistics** 
  **Post-Mortem & Fix Analysis**:
  > 连不上应该是配置有问题，可以先检查一下和模板配置的差别。  ## 查看 frps 的日志 vim 修改 /data/adb/modules/lamda/service.sh ，在两条 launch 命令后加上 `--logfile=/data/server.log` ``` $launch --port=${port} --logfile=/data/server.log ``` 重启手机，等待一会进入 web shell，输入以下命令将过滤出 frp 相关日志。 ```bash grep '(fwd)' /data/server.log ```  完毕后移除这两个选项（否则有可能填满你的手机存储） 

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

### Incident Patch 1: `ed03968c` (2023-10-06)
**Commit Message**: Update SECURITY.md

**File**: `SECURITY.md` (modified, +2/-1)
```diff
@@ -4,7 +4,8 @@
 
 | Version | Supported          |
 | ------- | ------------------ |
-|   3.x   | :white_check_mark: |
+|   5.x   | :white_check_mark: |
+|   7.x   | :white_check_mark: |
 
 ## Reporting a Vulnerability
 
```

---

### Incident Patch 2: `23600aec` (2023-01-31)
**Commit Message**: add SECURITY.md

**File**: `SECURITY.md` (added, +11/-0)
```diff
@@ -0,0 +1,11 @@
+# Security Policy
+
+## Supported Versions
+
+| Version | Supported          |
+| ------- | ------------------ |
+|   3.x   | :white_check_mark: |
+
+## Reporting a Vulnerability
+
+mailto:ihaven0emmail@gmail.com
```

#### Recent Merged Pull Requests:
- **PR #137** (closed): docs: improve documentation and add examples (@AkhiChalasani)
- **PR #133** (closed): ci: add Codex CLI plugin manifest (@internet-dot)
- **PR #125** (2025-12-13): Add comprehensive English documentation for LLMs (@dan098)
- **PR #25** (closed): Add a Gitter chat badge to README.md (@gitter-badger)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
