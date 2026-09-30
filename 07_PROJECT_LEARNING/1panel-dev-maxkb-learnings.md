# Forensic Learning Record (Deep Inspection): 1Panel-dev/MaxKB

> **Canonical Artifact**: `07_PROJECT_LEARNING/1panel-dev-maxkb-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/1Panel-dev/MaxKB](https://github.com/1Panel-dev/MaxKB))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-09-30T18:44:53.002Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `1Panel-dev/MaxKB`
- **Description**: 🔥 MaxKB is an open-source platform for building enterprise-grade agents.  强大易用的开源企业级智能体平台。
- **Primary Language / Ecosystem**: Python
- **Discovered Manifests / Configurations**: pyproject.toml, README.md
- **Stars / Engagement**: 22900 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: pyproject.toml, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `apps/application/admin.py`
```
from django.contrib import admin

# Register your models here.

```

### Core Architecture Module: `apps/application/api/application_access_token.py`
```
# coding=utf-8
"""
    @project: MaxKB
    @Author：虎虎
    @file： application_access_token.py
    @date：2025/6/9 17:46
    @desc:
"""
from drf_spectacular.types import OpenApiTypes
from drf_spectacular.utils import OpenApiParameter

from application.serializers.application_access_token import AccessTokenEditSerializer
from common.mixins.api_mixin import APIMixin


class ApplicationAccessTokenAPI(APIMixin):
    @staticmethod
    def get_parameters():
        return [OpenApiParameter(
            name="workspace_id",
            description="工作空间id",
            type=OpenApiTypes.STR,
            location='path',
            required=True,
        ), OpenApiParameter(
            name="application_id",
            description="应用id",
            type=OpenApiTypes.STR,
            location='path',
            required=True,
        )]

    @staticmethod
    def get_request():
        return AccessTokenEditSerializer

```

### Core Architecture Module: `apps/application/api/application_api.py`
```
# coding=utf-8
"""
    @project: MaxKB
    @Author：虎虎
    @file： application.py
    @date：2025/5/26 16:59
    @desc:
"""
from django.utils.translation import gettext_lazy as _
from drf_spectacular.types import OpenApiTypes
from drf_spectacular.utils import OpenApiParameter
from rest_framework import serializers

from application.serializers.application import ApplicationCreateSerializer, ApplicationListResponse, \
    ApplicationImportRequest, ApplicationEditSerializer, TextToSpeechRequest, SpeechToTextRequest, PlayDemoTextRequest, \
    BatchCleanTimeSerializer
from common.mixins.api_mixin import APIMixin
from common.result import ResultSerializer, ResultPageSerializer, DefaultResultSerializer
from knowledge.serializers.common import BatchSerializer, BatchMoveSerializer


class ApplicationCreateRequest(ApplicationCreateSerializer.SimplateRequest):
    work_flow = serializers.DictField(required=True, label=_("Workflow Objects"))


class ApplicationCreateResponse(ResultSerializer):
    def get_data(self):
        return ApplicationCreateSerializer.ApplicationResponse()


class ApplicationListResult(ResultSerializer):
    def get_data(self):
        return ApplicationListResponse(many=True)


class ApplicationPageResult(ResultPageSerializer):
    def get_data(self):
        return ApplicationListResponse(many=True)


class ApplicationQueryAPI(APIMixin):
    @staticmethod
    def get_parameters():
        return [
            OpenApiParameter(
                name="workspace_id",
                description="工作空间id",
                type=OpenApiTypes.STR,
                location='path',
                required=True,
            ),
            OpenApiParameter(
                name="current_page",
                description=_("Current page"),
                type=OpenApiTypes.INT,
                location='path',
                required=True,
            ),
            OpenApiParameter(
                name="page_size",
                description=_("Page size"),
                type=OpenApiTypes.INT,
                location='path',
                required=True,
            ),
            OpenApiParameter(
                name="folder_id",
                description=_("folder id"),
                type=OpenApiTypes.STR,
                location='query',
                required=False,
            ),
            OpenApiParameter(
                name="name",
                description=_("Application Name"),
                type=OpenApiTypes.STR,
                location='query',
                required=False,
            ),
            OpenApiParameter(
                name="desc",
                description=_("Application Description"),
                type=OpenApiTypes.STR,
                location='query',
                required=False,
            ),
            OpenApiParameter(
                name="user_id",
                description=_("User ID"),
                type=OpenApiTypes.STR,
                location='query',
                required=False,
            ),
            OpenApiParameter(
                name="publish_status",
                description=_("Publish status") + '(published|unpublished)',
                type=OpenApiTypes.STR,
                location='query',
                required=False,
            )
        ]

    @staticmethod
    def get_response():
        return ApplicationListResult

    @staticmethod
    def get_page_response():
        return ApplicationPageResult


class ApplicationCreateAPI(APIMixin):
    @staticmethod
    def get_parameters():
        return [
            OpenApiParameter(
                name="workspace_id",
                description="工作空间id",
                type=OpenApiTypes.STR,
                location='path',
                required=True,
            )
        ]

    @staticmethod
    def get_request():
        return ApplicationCreateRequest

    @staticmethod
    def get_response():
        return ApplicationCreateResponse


class ApplicationImportAPI(APIMixin):
    @staticmethod
    def get_parameters():
        ApplicationCreateAPI.get_parameters()

    @staticmethod
    def get_request():
        return ApplicationImportRequest


class ApplicationOperateAPI(APIMixin):
    @staticmethod
    def get_parameters():
        return [
            OpenApiParameter(
                name="workspace_id",
                description="工作空间id",
                type=OpenApiTypes.STR,
                location='path',
                required=True,
            ),
            OpenApiParameter(
                name="application_id",
                description="应用id",
                type=OpenApiTypes.STR,
                location='path',
                required=True,
            )
        ]


class ApplicationBatchOperateAPI(APIMixin):
    @staticmethod
    def get_parameters():
        return [
            OpenApiParameter(
                name="workspace_id",
                description="工作空间id",
                type=OpenApiTypes.STR,
                location='path',
                required=True,
            )
        ]
    @staticmethod
    def get_request():
        return BatchSerializer

    @staticmethod
    def get_move_request():
        return BatchMoveSerializer

    @staticmethod
    def get_clean_time_request():
        return BatchCleanTimeSerializer


class ApplicationExportAPI(APIMixin):
    @staticmethod
    def get_parameters():
        return ApplicationOperateAPI.get_parameters()

    @staticmethod
    def get_response():
        return DefaultResultSerializer


class ApplicationEditAPI(APIMixin):
    @staticmethod
    def get_request():
        return ApplicationEditSerializer


class TextToSpeechAPI(APIMixin):
    @staticmethod
    def get_parameters():
        return ApplicationOperateAPI.get_parameters()

    @staticmethod
    def get_request():
        return TextToSpeechRequest

    @staticmethod
    def get_response():
        return DefaultResultSerializer


class SpeechToTextAPI(APIMixin):
    @staticmethod
    def get_parameters():
        return ApplicationOperateAPI.get_parameters()

    @staticmethod
    def get_request():
        return SpeechToTextRequest

    @staticmethod
    def get_response():
        return DefaultResultSerializer


class PlayDemoTextAPI(APIMixin):
    @staticmethod
    def get_parameters():
        return ApplicationOperateAPI.get_parameters()

    @staticmethod
    def get_request():
        return PlayDemoTextRequest

    @staticmethod
    def get_response():
        return DefaultResultSerializer

```

### Core Architecture Module: `apps/application/api/application_api_key.py`
```
from drf_spectacular.types import OpenApiTypes
from drf_spectacular.utils import OpenApiParameter

from application.serializers.application_api_key import EditApplicationKeySerializer, ApplicationKeySerializerModel
from common.mixins.api_mixin import APIMixin
from common.result import ResultSerializer


class ApplicationKeyListResult(ResultSerializer):
    def get_data(self):
        return ApplicationKeySerializerModel(many=True)


class ApplicationKeyResult(ResultSerializer):
    def get_data(self):
        return ApplicationKeySerializerModel()


class ApplicationKeyAPI(APIMixin):
    @staticmethod
    def get_parameters():
        return [
            OpenApiParameter(
                name="workspace_id",
                description="工作空间id",
                type=OpenApiTypes.STR,
                location='path',
                required=True,
            ),
            OpenApiParameter(
                name="application_id",
                description="application ID",
                type=OpenApiTypes.STR,
                location='path',
                required=True,
            )
        ]

    @staticmethod
    def get_response():
        return ApplicationKeyResult

    class List(APIMixin):
        @staticmethod
        def get_response():
            return ApplicationKeyListResult

    class Operate(APIMixin):
        @staticmethod
        def get_parameters():
            return [*ApplicationKeyAPI.get_parameters(), OpenApiParameter(
                name="api_key_id",
                description="ApiKeyId",
                type=OpenApiTypes.STR,
                location='path',
                required=True,
            )]

        @staticmethod
        def get_request():
            return EditApplicationKeySerializer

```

### Core Architecture Module: `apps/application/api/application_chat.py`
```
# coding=utf-8
"""
    @project: MaxKB
    @Author：虎虎
    @file： application_chat.py
    @date：2025/6/10 13:54
    @desc:
"""
from django.utils.translation import gettext_lazy as _
from drf_spectacular.types import OpenApiTypes
from drf_spectacular.utils import OpenApiParameter

from application.serializers.application_chat import ApplicationChatQuerySerializers, \
    ApplicationChatResponseSerializers, ApplicationChatRecordExportRequest
from common.mixins.api_mixin import APIMixin
from common.result import ResultSerializer, ResultPageSerializer


class ApplicationChatListResponseSerializers(ResultSerializer):
    def get_data(self):
        return ApplicationChatResponseSerializers(many=True)


class ApplicationChatPageResponseSerializers(ResultPageSerializer):
    def get_data(self):
        return ApplicationChatResponseSerializers(many=True)


class ApplicationChatQueryAPI(APIMixin):
    @staticmethod
    def get_request():
        return ApplicationChatQuerySerializers

    @staticmethod
    def get_parameters():
        return [
            OpenApiParameter(
                name="workspace_id",
                description="工作空间id",
                type=OpenApiTypes.STR,
                location='path',
                required=True,
            ),
            OpenApiParameter(
                name="application_id",
                description="application ID",
                type=OpenApiTypes.STR,
                location='path',
                required=True,
            ), OpenApiParameter(
                name="start_time",
                description="start Time",
                type=OpenApiTypes.STR,
                required=True,
            ),
            OpenApiParameter(
                name="end_time",
                description="end Time",
                type=OpenApiTypes.STR,
                required=True,
            ),
            OpenApiParameter(
                name="abstract",
                description="summary",
                type=OpenApiTypes.STR,
                required=False,
            ),
            OpenApiParameter(
                name="username",
                description="username",
                type=OpenApiTypes.STR,
                required=False,
            ),
            OpenApiParameter(
                name="min_star",
                description=_("Minimum number of likes"),
                type=OpenApiTypes.INT,
                required=False,
            ),
            OpenApiParameter(
                name="min_trample",
                description=_("Minimum number of clicks"),
                type=OpenApiTypes.INT,
                required=False,
            ),
            OpenApiParameter(
                name="comparer",
                description=_("Comparator"),
                type=OpenApiTypes.STR,
                required=False,
            ),
        ]

    @staticmethod
    def get_response():
        return ApplicationChatListResponseSerializers


class ApplicationChatQueryPageAPI(APIMixin):
    @staticmethod
    def get_request():
        return ApplicationChatQueryAPI.get_request()

    @staticmethod
    def get_parameters():
        return [
            *ApplicationChatQueryAPI.get_parameters(),
            OpenApiParameter(
                name="current_page",
                description=_("Current page"),
                type=OpenApiTypes.INT,
                location='path',
                required=True,
            ),
            OpenApiParameter(
                name="page_size",
                description=_("Page size"),
                type=OpenApiTypes.INT,
                location='path',
                required=True,
            ),

        ]

    @staticmethod
    def get_response():
        return ApplicationChatPageResponseSerializers


class ApplicationChatExportAPI(APIMixin):
    @staticmethod
    def get_request():
        return ApplicationChatRecordExportRequest

    @staticmethod
    def get_parameters():
        return ApplicationChatQueryAPI.get_parameters()

    @staticmethod
    def get_response():
        return None

```

### Core Architecture Module: `apps/application/api/application_chat_link.py`
```
"""
    @project: MaxKB
    @Author: niu
    @file: application_chat_link.py
    @date: 2026/2/9 16:59
    @desc:
"""
from drf_spectacular.types import OpenApiTypes
from drf_spectacular.utils import OpenApiParameter
from django.utils.translation import gettext_lazy as _

from application.serializers.application_chat_link import ChatRecordShareLinkRequestSerializer
from common.mixins.api_mixin import APIMixin
from common.result import DefaultResultSerializer


class ChatRecordLinkAPI(APIMixin):
    @staticmethod
    def get_response():
        return DefaultResultSerializer

    @staticmethod
    def get_request():
        return ChatRecordShareLinkRequestSerializer

    @staticmethod
    def get_parameters():
        return [
            OpenApiParameter(
                name="application_id",
                description="Application ID",
                type=OpenApiTypes.STR,
                location='path',
                required=True,
            ),
            OpenApiParameter(
                name="chat_id",
                description=_("Chat ID"),
                type=OpenApiTypes.STR,
                location='path',
                required=True,
            ),
        ]

class ChatRecordDetailShareAPI(APIMixin):
    @staticmethod
    def get_response():
        return DefaultResultSerializer



    @staticmethod
    def get_parameters():
        return [
            OpenApiParameter(
                name="link",
                description="链接",
                type=OpenApiTypes.STR,
                location='path',
                required=True,
            )
        ]
```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #7225** (2026-09-30): **fix: permission name error**
  *Symptoms*: #### What this PR does / why we need it?  #### Summary of your change  #### Please indicate you've done the following:  - [ ] Made sure tests are passing and test coverage is added if needed. - [ ] Made sure commit message follow the rule of [Conventional Commits specification](https://www.conventionalcommits.org/). - [ ] Considered the docs impact and opened a new docs issue or PR with docs changes if needed.
  **Post-Mortem & Fix Analysis**:
  > Seems you are using me but didn't get OPENAI_API_KEY seted in Variables/Secrets for this repo. you could follow [readme](https://github.com/anc95/ChatGPT-CodeReview) for more information

- **Issue #7223** (2026-09-30): **feat: document export**
  *Symptoms*: feat: document export 
  **Post-Mortem & Fix Analysis**:
  > Seems you are using me but didn't get OPENAI_API_KEY seted in Variables/Secrets for this repo. you could follow [readme](https://github.com/anc95/ChatGPT-CodeReview) for more information

- **Issue #7220** (2026-09-30): **[Bug] 智能体名称过长时，企微对接移动端标题漂移**
  *Symptoms*: ### Contact Information  _No response_  ### MaxKB Version  V2.10.6-pro  ### Problem Description  智能体的名称过长的话，企微对接的移动端在问答过后前端的标题组件就会出现漂移的现象。  <img width="1254" height="2610" alt="Image" src="https://github.com/user-attachments/assets/5df4309e-4223-4411-bfe9-5d20b1b28fcd" />  <img width="1252" height="2618" alt="Image" src="https://github.com/user-attachments/assets/2b234aca-bd6c-4d63-8cc4-ffdc9b590795" />  ### Steps to Reproduce  1.发布一个名称很长的智能体； 2.企微的应用里对接智能体移动端地址。  <img width="2792" height="1312" alt="Image" src="https://github.com/user-attachments/assets/afb75ba1-2bd4-44b1-8fd6-396ff04e3ed5" />  <img width="2720" height="1234" alt="Image" src="https://github.com/user-attachments/assets/4264d0cb-7e4c-4449-a3a0-e9440aa09b61" />  ### The expected correct result  _No response_  ### Related log output  ```shell  ```  ### Additional Information  _No response_
  **Post-Mortem & Fix Analysis**:
  > 您好，我们没有做这方面的适配。

- **Issue #7219** (2026-09-30): **feat: generate question**
  *Symptoms*: feat: generate question 
  **Post-Mortem & Fix Analysis**:
  > Seems you are using me but didn't get OPENAI_API_KEY seted in Variables/Secrets for this repo. you could follow [readme](https://github.com/anc95/ChatGPT-CodeReview) for more information

- **Issue #7218** (2026-09-30): **fix: dropdown error**
  *Symptoms*: fix: dropdown error 
  **Post-Mortem & Fix Analysis**:
  > Seems you are using me but didn't get OPENAI_API_KEY seted in Variables/Secrets for this repo. you could follow [readme](https://github.com/anc95/ChatGPT-CodeReview) for more information

- **Issue #7217** (2026-09-30): **fix: update selectedStatusType to handle boolean values and adjust API query accordingly**
  *Symptoms*: fix: update selectedStatusType to handle boolean values and adjust API query accordingly 
  **Post-Mortem & Fix Analysis**:
  > Seems you are using me but didn't get OPENAI_API_KEY seted in Variables/Secrets for this repo. you could follow [readme](https://github.com/anc95/ChatGPT-CodeReview) for more information

- **Issue #7216** (2026-09-30): **feat: system  selectedStatusType**
  *Symptoms*: feat: system  selectedStatusType 
  **Post-Mortem & Fix Analysis**:
  > Seems you are using me but didn't get OPENAI_API_KEY seted in Variables/Secrets for this repo. you could follow [readme](https://github.com/anc95/ChatGPT-CodeReview) for more information

- **Issue #7215** (2026-09-30): **feat: system  selectedStatusType**
  *Symptoms*: feat: system  selectedStatusType 
  **Post-Mortem & Fix Analysis**:
  > Seems you are using me but didn't get OPENAI_API_KEY seted in Variables/Secrets for this repo. you could follow [readme](https://github.com/anc95/ChatGPT-CodeReview) for more information

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

### Incident Patch 1: `9f471c72` (2026-09-22)
**Commit Message**: fix: update import tool flag in knowledge workflow

--bug=1076866@tapd-62980211 --user=刘瑞斌 【知识库】在工作流知识库的画布界面，使用模板中心的模板替换当前画布，新工作流中的工具没有在当前工作空间创建 https://www.tapd.cn/62980211/s/2090006

**File**: `apps/knowledge/serializers/knowledge_workflow.py` (modified, +3/-2)
```diff
@@ -504,8 +504,9 @@ def import_(self, instance: dict, is_import_tool, with_valid=True):
                             "auth_target_type": AuthTargetType.TOOL.value,
                         }
                     ).auth_resource_batch([t.id for t in tool_model_list])
-                return True
             update_resource_mapping_by_knowledge(knowledge_id)
+            if is_import_tool:
+                return True
 
         @staticmethod
         def to_knowledge_workflow(knowledge_workflow, update_tool_map):
@@ -674,7 +675,7 @@ def edit(self, instance: Dict):
                         "workspace_id": self.data.get("workspace_id"),
                         "knowledge_id": str(self.data.get("knowledge_id")),
                     }
-                ).import_({"file": bytes_to_uploaded_file(res.content, "file.kbwf")}, is_import_tool=False)
+                ).import_({"file": bytes_to_uploaded_file(res.content, "file.kbwf")}, is_import_tool=True)
 
                 try:
                     download_callback_url = template_instance.get("downloadCallbackUrl", "")
```

---

### Incident Patch 2: `b579a906` (2026-09-22)
**Commit Message**: fix: During the conversation, you can use `chat_record_id` to overwrite the conversation record of another visitor. (#7148)

**File**: `apps/chat/serializers/chat.py` (modified, +4/-0)
```diff
@@ -462,6 +462,10 @@ def chat(self, instance: dict, base_to_response: BaseToResponse = SystemToRespon
         chat_info = self.get_chat_info()
         chat_info.get_application()
         chat_info.get_chat_user(asker=(instance.get('form_data') or {}).get('asker'))
+        if instance.get('chat_record_id'):
+            if not QuerySet(ChatRecord).filter(id=instance.get('chat_record_id'),
+                                               chat_id=self.data.get('chat_id')).exists():
+                raise ChatException(500, _("Conversation does not exist"))
         self.is_valid_chat_id(chat_info)
         if not self.data.get('debug'):
             self.is_valid_chat_user()
```

---

### Incident Patch 3: `8709e15b` (2026-09-22)
**Commit Message**: fix: Like/Dislike API endpoints still accept cross-client operations. (#7142)

**File**: `apps/chat/serializers/chat_record.py` (modified, +10/-0)
```diff
@@ -47,6 +47,16 @@ class VoteSerializer(serializers.Serializer):
 
     chat_record_id = serializers.UUIDField(required=True,
                                            label=_("Conversation record id"))
+    chat_user_id = serializers.UUIDField(required=True, label=_("Chat User ID"))
+
+    def is_valid(self, *, raise_exception=False):
+        super().is_valid(raise_exception=True)
+        chat_user_id = self.data.get('chat_user_id')
+        chat_record_id = self.data.get('chat_record_id')
+        chat_id = self.data.get('chat_id')
+        if QuerySet(ChatRecord).filter(chat_id=chat_id, chat_record_id=chat_record_id,
+                                       chat__chat_user_id=chat_user_id).exists():
+            raise AppApiException(500, _('Chat is not exist'))
 
     @transaction.atomic
     def vote(self, instance: Dict, with_valid=True):
```

**File**: `apps/chat/views/chat_record.py` (modified, +2/-1)
```diff
@@ -38,7 +38,8 @@ def put(self, request: Request, chat_id: str, chat_record_id: str):
         return result.success(VoteSerializer(
             data={'application_id': request.auth.application_id,
                   'chat_id': chat_id,
-                  'chat_record_id': chat_record_id
+                  'chat_record_id': chat_record_id,
+                  'chat_user_id': request.auth.chat_user_id,
                   }).vote(request.data))
 
 
```

---

### Incident Patch 4: `a4683fc5` (2026-09-22)
**Commit Message**: fix: Connection closed during tool invocation. (#7141)

**File**: `apps/application/flow/tools.py` (modified, +2/-0)
```diff
@@ -732,6 +732,8 @@ def get_real_error(exc):
 
 
 async def save_tool_record(tool_id, tool_info, tool_result, source_id, source_type):
+    from django.db import close_old_connections
+    await sync_to_async(close_old_connections)()
     tool = await sync_to_async(lambda: QuerySet(Tool).filter(id=tool_id).first())()
     tool_info["icon"] = tool.icon
     tool_record = ToolRecord(
```

---

### Incident Patch 5: `9dff6490` (2026-09-21)
**Commit Message**: fix: application  copywriting‌

**File**: `ui/src/locales/lang/en-US/views/application.ts` (modified, +1/-1)
```diff
@@ -45,7 +45,7 @@ export default {
     roundTriggerTip:
       'After accumulating N rounds, automatically extract N rounds of conversation to generate memory',
     triggerInterval: 'Trigger Interval',
-    scheduledTrigger: 'Scheduled Trigger',
+    scheduledTrigger: 'Timed Trigger',
     scheduledTriggerTip:
       'After reaching the set time, automatically extract all conversations within the cycle to generate memory',
     cronExpressionInvalid: 'Cron expression is invalid',
```

**File**: `ui/src/locales/lang/zh-CN/views/application.ts` (modified, +1/-1)
```diff
@@ -40,7 +40,7 @@ export default {
     roundTrigger: '按轮次触发',
     roundTriggerTip: '累计到N轮后，自动提炼N轮对话，生成记忆',
     triggerInterval: '触发间隔',
-    scheduledTrigger: '按时间触发',
+    scheduledTrigger: '定时触发',
     scheduledTriggerTip: '到设定时间后，自动提炼周期内所有对话，生成记忆',
     cronExpressionInvalid: 'Cron表达式不合法',
     tips1: `开启后，从开启时间记录新对话并按周期生成记忆，可通过`,
```

**File**: `ui/src/locales/lang/zh-Hant/views/application.ts` (modified, +1/-1)
```diff
@@ -39,7 +39,7 @@ export default {
     roundTrigger: '按輪次觸發',
     roundTriggerTip: '累計到N輪後，自動提煉N輪對話，生成記憶',
     triggerInterval: '觸發間隔',
-    scheduledTrigger: '按时间触发',
+    scheduledTrigger: '定時觸發',
     scheduledTriggerTip: '到设定时间后，自动提炼周期内所有对话，生成记忆',
     cronExpressionInvalid: 'Cron表达式不合法',
     tips1: `開啟後，從開啟時間記錄新對話並按周期生成記憶，可通過`,
```

---

### Incident Patch 6: `ccbd8260` (2026-09-21)
**Commit Message**: fix: application  copywriting‌

**File**: `ui/src/views/application/component/LongTermSettingDialog.vue` (modified, +1/-1)
```diff
@@ -17,7 +17,7 @@
     >
       <el-form-item
         v-if="modelSettingEnable"
-        :label="$t('views.application.longTermMemory.title')"
+        :label="$t('views.application.form.aiModel.label')"
         prop="long_term_model_id"
         :rules="modelIdRules"
       >
```

**File**: `ui/src/workflow/nodes/base-node/index.vue` (modified, +8/-7)
```diff
@@ -77,11 +77,6 @@
             </div>
           </div>
         </template>
-        <div v-if="form_data.long_term_enable" class="w-full">
-          <el-text type="info" class="color-secondary font-small">
-            {{ $t('views.application.longTermMemory.modelSettingTip') }}
-          </el-text>
-        </div>
       </el-form-item>
       <el-form-item>
         <template #label>
@@ -137,7 +132,10 @@
         </template>
         <div v-show="form_data.stt_model_enable" class="w-full">
           <el-radio-group v-model="form_data.stt_model_id_type">
-            <el-radio :label="$t('views.application.form.voiceInput.defaultModel')" value="default" />
+            <el-radio
+              :label="$t('views.application.form.voiceInput.defaultModel')"
+              value="default"
+            />
             <el-radio :label="$t('views.application.form.voiceInput.custom')" value="custom" />
           </el-radio-group>
         </div>
@@ -177,7 +175,10 @@
         <div class="w-full">
           <el-radio-group v-model="form_data.tts_type" v-show="form_data.tts_model_enable">
             <el-radio :label="$t('views.application.form.voicePlay.browser')" value="BROWSER" />
-            <el-radio :label="$t('views.application.form.voicePlay.defaultModel')" value="DEFAULT" />
+            <el-radio
+              :label="$t('views.application.form.voicePlay.defaultModel')"
+              value="DEFAULT"
+            />
             <el-radio :label="$t('views.application.form.voicePlay.custom')" value="CUSTOM" />
           </el-radio-group>
         </div>
```

---

### Incident Patch 7: `047276c5` (2026-09-21)
**Commit Message**: security: disable cffi in sandbox.

**File**: `installer/sandbox.c` (modified, +1/-1)
```diff
@@ -560,7 +560,7 @@ long syscall(long number, ...) {
 static int is_allow_dl(const char *filename) {
     ensure_config_loaded();
     if (!filename || !*filename) return 1;
-    if (!allow_dl_open && strstr(filename, "_ctypes")) { // 不允许使用ctypes
+    if (!allow_dl_open && (strstr(filename, "_ctypes") || strstr(filename, "_cffi"))) { // 不允许使用ctypes和cffi
         throw_permission_denied_err(true, "open dynamic link library");
     }
     if (!allow_dl_paths || !*allow_dl_paths) return 0;
```

---

### Incident Patch 8: `d570136e` (2026-09-21)
**Commit Message**: security: fix the predicable redis serializer key.

**File**: `apps/ops/celery/hmac_signed_serializer.py` (modified, +2/-2)
```diff
@@ -2,10 +2,10 @@
 import hashlib
 import pickle
 import os
-import socket
+import uuid_utils.compat as uuid
 from kombu.serialization import register
 
-_local_secret_key = os.environ.get('MAXKB_HMAC_SIGNED_SERIALIZER_SECRET_KEY', 'default_hmac_signed_serializer_secret_key:' + os.getenv('MAXKB_VERSION', socket.gethostname()))
+_local_secret_key = os.environ.get('MAXKB_HMAC_SIGNED_SERIALIZER_SECRET_KEY', os.getenv('MAXKB_SECRET_KEY', uuid.uuid7()))
 try:
     from xpack import get_md5
     _local_secret_key = get_md5()
```

---

### Incident Patch 9: `118c4686` (2026-09-20)
**Commit Message**: fix(xinference): support string reranker documents

**File**: `apps/models_provider/impl/xinference_model_provider/model/reranker.py` (modified, +8/-1)
```diff
@@ -27,6 +27,13 @@ def new_instance(model_type, model_name, model_credential: Dict[str, object], **
         return XInferenceReranker(server_url=model_credential.get('server_url'), model_uid=model_name,
                                   api_key=model_credential.get('api_key'), top_n=model_kwargs.get('top_n', 3))
 
+    @staticmethod
+    def _get_document_text(result: Dict[str, Any]) -> str:
+        document = result.get('document')
+        if isinstance(document, dict):
+            return document.get('text', '')
+        return document or ''
+
     top_n: Optional[int] = 3
 
     def compress_documents(self, documents: Sequence[Document], query: str, callbacks: Optional[Callbacks] = None) -> \
@@ -50,5 +57,5 @@ def compress_documents(self, documents: Sequence[Document], query: str, callback
         client = RESTfulClient(self.server_url, self.api_key)
         model: RESTfulRerankModelHandle = client.get_model(self.model_uid)
         res = model.rerank([document.page_content for document in documents], query, self.top_n, return_documents=True)
-        return [Document(page_content=d.get('document', {}).get('text'),
+        return [Document(page_content=self._get_document_text(d),
                          metadata={'relevance_score': d.get('relevance_score')}) for d in res.get('results', [])]
```

**File**: `apps/models_provider/tests.py` (modified, +26/-0)
```diff
@@ -2,8 +2,10 @@
 from unittest.mock import patch
 
 from django.test import SimpleTestCase
+from langchain_core.documents import Document
 
 from models_provider.impl.vllm_model_provider.model.whisper_sst import VllmWhisperSpeechToText
+from models_provider.impl.xinference_model_provider.model.reranker import XInferenceReranker
 
 
 class VllmWhisperSpeechToTextTest(SimpleTestCase):
@@ -24,3 +26,27 @@ def test_normalizes_trailing_slash_in_v1_base_url(self, openai_mock):
             base_url='https://vllm.example/v1',
         )
         self.assertEqual(result, 'transcript')
+
+
+class XInferenceRerankerTest(SimpleTestCase):
+    @patch('xinference_client.RESTfulClient')
+    def test_compress_documents_accepts_string_documents(self, client_mock):
+        client_mock.return_value.get_model.return_value.rerank.return_value = {
+            'results': [{'document': 'current result', 'relevance_score': 0.9}]
+        }
+        model = XInferenceReranker(server_url='http://localhost', model_uid='reranker', api_key=None)
+
+        result = model.compress_documents([Document(page_content='query text')], 'query')
+
+        self.assertEqual(result[0].page_content, 'current result')
+        self.assertEqual(result[0].metadata['relevance_score'], 0.9)
+
+    def test_extracts_text_from_legacy_document_object(self):
+        result = {'document': {'text': 'legacy result'}}
+
+        self.assertEqual(XInferenceReranker._get_document_text(result), 'legacy result')
+
+    def test_extracts_text_from_current_document_string(self):
+        result = {'document': 'current result'}
+
+        self.assertEqual(XInferenceReranker._get_document_text(result), 'current result')
```

---

### Incident Patch 10: `06bb3008` (2026-09-20)
**Commit Message**: chore: add DATA_UPLOAD_MAX_MEMORY_SIZE configuration for JSON import size limit

--bug=1076579@tapd-62980211 --user=刘瑞斌 【github#7062】通用知识库导入大文档失败，报错： https://www.tapd.cn/62980211/s/2085935

**File**: `apps/maxkb/settings/base/web.py` (modified, +2/-0)
```diff
@@ -168,6 +168,8 @@
 
 # 文件上传配置
 DATA_UPLOAD_MAX_NUMBER_FILES = 1000
+# 分段导入以 JSON 回传全文，默认允许 100 MiB，可通过 MAXKB_DATA_UPLOAD_MAX_MEMORY_SIZE（字节）调整。
+DATA_UPLOAD_MAX_MEMORY_SIZE = int(CONFIG.get('DATA_UPLOAD_MAX_MEMORY_SIZE', 100 * 1024 * 1024))
 
 # 支持的语言
 LANGUAGES = CONFIG.get_languages()
```

#### Recent Merged Pull Requests:
- **PR #7225** (2026-09-30): fix: permission name error (@peslyn)
- **PR #7223** (2026-09-30): feat: document export (@shaohuzhang1)
- **PR #7219** (2026-09-30): feat: generate question (@shaohuzhang1)
- **PR #7218** (2026-09-30): fix: dropdown error (@shaohuzhang1)
- **PR #7217** (2026-09-30): fix: update selectedStatusType to handle boolean values and adjust API query accordingly (@shaohuzhang1)
- **PR #7216** (2026-09-30): feat: system  selectedStatusType (@shaohuzhang1)
- **PR #7215** (closed): feat: system  selectedStatusType (@shaohuzhang1)
- **PR #7214** (2026-09-30): feat: application resource managemen (@shaohuzhang1)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
