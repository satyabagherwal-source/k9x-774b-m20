# Forensic Learning Record (Deep Inspection): THUDM/AgentBench

> **Canonical Artifact**: `07_PROJECT_LEARNING/thudm-agentbench-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/THUDM/AgentBench](https://github.com/THUDM/AgentBench))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-09-30T21:45:04.774Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `THUDM/AgentBench`
- **Description**: A Comprehensive Benchmark to Evaluate LLMs as Agents (ICLR'24)
- **Primary Language / Ecosystem**: Python
- **Discovered Manifests / Configurations**: README.md
- **Stars / Engagement**: 3761 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `data/os_interaction/scripts/1/check/containing.py`
```
from sys import argv

def norm_newline(s):
  return s.replace("\r\n", "\n").replace("\r", "\n")

v1 = norm_newline(argv[1]).strip()
v2 = norm_newline(argv[2]).strip()

if v2 in v1:
  exit(0)
else:
  exit(1)
```

### Core Architecture Module: `data/os_interaction/scripts/1/check/in.py`
```
from sys import argv

def norm_newline(s):
  return s.replace("\r\n", "\n").replace("\r", "\n")

v1 = norm_newline(argv[1]).strip()
v2 = norm_newline(argv[2]).strip()

if v1 in v2:
  exit(0)
else:
  exit(1)
```

### Core Architecture Module: `data/os_interaction/scripts/1/check/integer-match.py`
```
from sys import argv
if int(argv[1]) == int(argv[2]): exit(0)
exit(1)
```

### Core Architecture Module: `data/os_interaction/scripts/1/check/size-match.py`
```
from sys import argv

def analysis_size(size_str):
    size_str = size_str.strip()
    availables = {
        "B": 1,
        "Byte": 1,
        "K": 1024,
        "KB": 1024,
        "M": 1024*1024,
        "MB": 1024*1024,
        "G": 1024*1024*1024,
        "GB": 1024*1024*1024,
        "T": 1024*1024*1024*1024,
        "TB": 1024*1024*1024*1024,
        "P": 1024*1024*1024*1024*1024,
        "PB": 1024*1024*1024*1024*1024,        
    }
    for size_unit in availables:
        if size_str.endswith(size_unit):
            return int(size_str[:-len(size_unit)]) * availables[size_unit]
    return int(size_str)

if analysis_size(argv[1]) == analysis_size(argv[2]): 
    exit(0)
exit(1)
```

### Core Architecture Module: `data/os_interaction/scripts/1/check/string-match.py`
```
from sys import argv

def norm_newline(s):
  return s.replace("\r\n", "\n").replace("\r", "\n")

if norm_newline(argv[1]).strip() == norm_newline(argv[2]).strip():
  exit(0)
exit(1)
```

### Core Architecture Module: `data/os_interaction/scripts/2/check/containing.py`
```
from sys import argv

def norm_newline(s):
  return s.replace("\r\n", "\n").replace("\r", "\n")

v1 = norm_newline(argv[1]).strip()
v2 = norm_newline(argv[2]).strip()

if v2 in v1:
  exit(0)
else:
  exit(1)
```

### Core Architecture Module: `data/os_interaction/scripts/2/check/in.py`
```
from sys import argv

def norm_newline(s):
  return s.replace("\r\n", "\n").replace("\r", "\n")

v1 = norm_newline(argv[1]).strip()
v2 = norm_newline(argv[2]).strip()

if v1 in v2:
  exit(0)
else:
  exit(1)
```

### Core Architecture Module: `data/os_interaction/scripts/2/check/integer-match.py`
```
from sys import argv
print("argv", argv[2])
if int(argv[1]) == int(argv[2]): exit(0)
exit(1)
```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #205** (2025-11-17): **[Bug/Assistance] 官网域名竟然出售了? 这个方向不继续了吗?**
  *Symptoms*: rt, 潇老板,这个方向不继续了吗? 我觉得还挺有前途的 
  **Post-Mortem & Fix Analysis**:
  > 原本那个网站不维护了，换成新的了。已更正～
  > > 原本那个网站不维护了，换成新的了。已更正～  右侧的项目链接也更新一下吧

- **Issue #204** (2025-11-11): **[Bug/Assistance] No module named src.start_task**
  *Symptoms*: I followed the instructions in the README step by step. However, I found that there is no start_task.py file in the src directory, which caused the execution of "python -m src.start_task -a" to fail. The error reported is "No module named src.start_task". How can I solve this problem?
  **Post-Mortem & Fix Analysis**:
  > hi, you are probably reading the v0.2 doc. the quick start of the newer version is at https://github.com/THUDM/AgentBench#quick-start and you may download the controller from https://github.com/THUDM/AgentRL/releases/tag/controller-v0.1.0. If you prefer to use the older version, you may switch to v0.2 branch.
  > thanks！

- **Issue #203** (2025-10-31): **如何评测模型**
  *Symptoms*: hi，我之前没怎么用过docker，这边想问个小白的问题。  docker这些命令完成后，我该如何评测我自己的模型呢？这边似乎看到没有关于评测的脚本。

- **Issue #176** (2024-12-09): **[Bug/Assistance] 'NoneType' object has no attribute 'retrieve'**
  *Symptoms*: `'NoneType' object has no attribute 'retrieve' `  I received this message on testing. Does anyone know how to fix this? ![Screenshot from 2024-12-06 09-15-00](https://github.com/user-attachments/assets/534c6402-e860-4b75-91b3-af5167808e2e) 
  **Post-Mortem & Fix Analysis**:
  > Hi, how did you fix it?

- **Issue #160** (2024-08-09): **kg的服务我部署好了，但是还是不能够正常测评kg任务，具体错误如下**
  *Symptoms*: 我的服务地址如下![image](https://github.com/user-attachments/assets/55351c87-60dd-423b-9076-573aa3fd3ca3) 我是把服务部署在一台Ubuntu SMP Wed Nov 23 20:19:22 UTC 2022 x86_64 x86_64 x86_64 GNU/Linux
  **Post-Mortem & Fix Analysis**:
  > 忘记注释pdb了 

- **Issue #159** (2024-08-07): **[Bug/Assistance] kg-std issues**
  *Symptoms*: **Describe the bug** I am following this work for a long time. However, initially the LTG and CG scenarios cannot work. And recently (last week), when I pull the latest docker, the kg-std cannot work as well. The detailed logs are shown below. Can you offer a stable version of docker so that we can obtain stable results over time? Many thanks!  **To Reproduce** > task KnowledgeGraph-std worker 0 error Cannot connect to host localhost:5006 ssl:default [Connect call failed ('127.0.0.1', 5006)] syncing KnowledgeGraph-std task worker 0 task KnowledgeGraph-std worker 0 error Cannot connect to host localhost:5006 ssl:default [Connect call failed ('127.0.0.1', 5006)] syncing KnowledgeGraph-std task worker 0 at http://localhost:5006/api failed (400, "Error: Worker not responding\nCannot connect to host localhost:5006 ssl:default [Connect call failed ('127.0.0.1', 5006)]") task KnowledgeGraph-std worker 1 error Cannot connect to host localhost:5010 ssl:default [Connect call failed ('127.0.0.1', 5010)] syncing KnowledgeGraph-std task worker 1 
  **Post-Mortem & Fix Analysis**:
  > I have missed the update in the readme.md about the update in kg-std environment. Thus, I will close the issue.

- **Issue #153** (2024-07-30): **[Bug/Assistance] kg的这个任务，http://164.107.116.56:3093/sparql这个服务器地址，似乎宕机了，执行python src/server/tasks/knowledgegraph/utils/sparql_executer.py会超时**
  *Symptoms*: **Describe the bug** A clear and concise description of what the bug is.  **To Reproduce** Steps to reproduce the behavior: 1. Go to '...' 2. Click on '....' 3. Scroll down to '....' 4. See error  **Screenshots or Terminal Copy&Paste** If applicable, add screenshots to help explain your problem.  **Desktop (please complete the following information):**  - OS: [e.g. Ubuntu 22.04]  - Python: [e.g. 3.9]  **Additional context** Add any other context about the problem here. 
  **Post-Mortem & Fix Analysis**:
  > 确实，目前这个服务器正在维护，本地部署可以参考https://github.com/dki-lab/Freebase-Setup
  > > 确实，目前这个服务器正在维护，本地部署可以参考https://github.com/dki-lab/Freebase-Setup  好的，非常感谢
  > 请问你们这个服务大概什么时候能够维护好呢

- **Issue #133** (2024-04-28): **请问如何使用本地的llama-2-hf模型进行测试呢，希望得到一些明确的指导！[Bug/Assistance] **
  *Symptoms*: 我希望用本地的模型测试AgentBench，但是我不太清楚应该修改哪里，希望能得到一些具体的指导，谢谢！  下面这个issue我有看过，但是还是不太清楚具体该修改哪里... https://github.com/THUDM/AgentBench/issues/75
  **Post-Mortem & Fix Analysis**:
  > Hi, @5456es 可以参考一下https://github.com/THUDM/AgentBench/blob/main/docs/Introduction_cn.md#2-%E6%A1%86%E6%9E%B6%E4%BB%8B%E7%BB%8D 这个文档，里面介绍了框架的运行逻辑和启动AgentServer的方式，如果还有问题欢迎继续提问！

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

### Incident Patch 1: `41e68073` (2025-01-30)
**Commit Message**: Merge pull request #174 from cedricrupb/fix-identifier-bug

Fix a potential identifier bug

**File**: `src/server/tasks/webshop/web_agent_site/attributes/generate_attrs.py` (modified, +1/-1)
```diff
@@ -97,7 +97,7 @@ def get_corpus(
         for key in keys:
             if key == 'review':
                 rs = p['review']['reviews']
-                if r is not None:
+                if rs is not None:
                     text_ = ' '.join([r['review'].lower() for r in rs])
                 else:
                     text_ = ''
```

---

### Incident Patch 2: `59bd1ce2` (2024-12-04)
**Commit Message**: Fix a potential identifier bug

**File**: `src/server/tasks/webshop/web_agent_site/attributes/generate_attrs.py` (modified, +1/-1)
```diff
@@ -97,7 +97,7 @@ def get_corpus(
         for key in keys:
             if key == 'review':
                 rs = p['review']['reviews']
-                if r is not None:
+                if rs is not None:
                     text_ = ' '.join([r['review'].lower() for r in rs])
                 else:
                     text_ = ''
```

---

### Incident Patch 3: `069f1ef8` (2024-11-13)
**Commit Message**: Merge pull request #162 from rjmoss/fix-terminal-cleanup

Fixed terminal output parsing

**File**: `src/server/tasks/os_interaction/task.py` (modified, +15/-0)
```diff
@@ -86,6 +86,21 @@ def __init__(self, code, o):
                 break
             except socket.timeout:
                 break
+
+        # Clean up the output by removing terminal control sequences, removes escape sequences starting with
+        # ESC (0x1b), followed by...
+        # ... any characters, an '@' character, any characters, ending with '#' or '$'
+        output = re.sub(b"\x1b.+@.+[#|$] ", b'', output)
+        # ... '[' and any combination of digits and semicolons, ending with a letter (a-z or A-Z)
+        output = re.sub(b'\x1b\\[[0-9;]*[a-zA-Z]', b'', output)
+        # ... ']' and any digits, a semicolon, any characters except BEL (0x07), and ending with BEL
+        output = re.sub(b'\x1b\\][0-9]*;[^\x07]*\x07', b'', output)
+        # ... '[?2004' and either 'h' or 'l'
+        output = re.sub(b'\x1b\[\?2004[hl]', b'', output)
+
+        # Remove BEL characters (0x07)
+        output = re.sub(b'\x07', b'', output)
+
         return DummyOutput(0, output)
 
     def execute_independent(self, command, *params):
```

---

### Incident Patch 4: `6850d037` (2024-11-13)
**Commit Message**: Merge pull request #163 from rjmoss/fix-timeout-error-message

Fixed hanging bash commands from agent in os-task

**File**: `src/server/tasks/os_interaction/task.py` (modified, +8/-0)
```diff
@@ -5,6 +5,7 @@
 import re
 import socket
 import struct
+import time
 from typing import List, Dict, Any, Tuple
 
 import docker
@@ -62,8 +63,15 @@ def __init__(self, code, o):
         data = self.sock.recv(8)
         _, n = struct.unpack(">BxxxL", data)
         _ = self.sock.recv(n)
+
+        time_limit = 30  # seconds
+        start_time = time.time()
+
         output = b""
         while True:
+            if time.time() - start_time > time_limit:
+                print(f"Time limit reached, breaking out of the loop. Command was: `{command}`")
+                break
             try:
                 data = self.sock.recv(8)
                 # print(data)
```

---

### Incident Patch 5: `5c1c96ed` (2024-08-11)
**Commit Message**: Fixed terminal output parsing

Before the agent receives
"The output of the OS: The output of the OS:\n\n10\n[?2004h]0;root@e88175735799:/root@e88175735799:/# [K"
Now the agent receives
"The output of the OS: 10"

**File**: `src/server/tasks/os_interaction/task.py` (modified, +15/-0)
```diff
@@ -78,6 +78,21 @@ def __init__(self, code, o):
                 break
             except socket.timeout:
                 break
+
+        # Clean up the output by removing terminal control sequences, removes escape sequences starting with
+        # ESC (0x1b), followed by...
+        # ... any characters, an '@' character, any characters, ending with '#' or '$'
+        output = re.sub(b"\x1b.+@.+[#|$] ", b'', output)
+        # ... '[' and any combination of digits and semicolons, ending with a letter (a-z or A-Z)
+        output = re.sub(b'\x1b\\[[0-9;]*[a-zA-Z]', b'', output)
+        # ... ']' and any digits, a semicolon, any characters except BEL (0x07), and ending with BEL
+        output = re.sub(b'\x1b\\][0-9]*;[^\x07]*\x07', b'', output)
+        # ... '[?2004' and either 'h' or 'l'
+        output = re.sub(b'\x1b\[\?2004[hl]', b'', output)
+
+        # Remove BEL characters (0x07)
+        output = re.sub(b'\x07', b'', output)
+
         return DummyOutput(0, output)
 
     def execute_independent(self, command, *params):
```

---

### Incident Patch 6: `9e4c649a` (2024-08-11)
**Commit Message**: Fixed hanging bash commands from agent

If the agent puts out a command like
    'while true; do ls /root; sleep 1; done'
it will loop while also putting out an output (meaning the socket
doesn't timeout) so I've added a 30s cutoff. Without this it eventually
fails but counts as an incomplete task rather than just a fail so it
stops any of the overall stats working.

**File**: `src/server/tasks/os_interaction/task.py` (modified, +8/-0)
```diff
@@ -5,6 +5,7 @@
 import re
 import socket
 import struct
+import time
 from typing import List, Dict, Any, Tuple
 
 import docker
@@ -62,8 +63,15 @@ def __init__(self, code, o):
         data = self.sock.recv(8)
         _, n = struct.unpack(">BxxxL", data)
         _ = self.sock.recv(n)
+
+        time_limit = 30  # seconds
+        start_time = time.time()
+
         output = b""
         while True:
+            if time.time() - start_time > time_limit:
+                print(f"Time limit reached, breaking out of the loop. Command was: `{command}`")
+                break
             try:
                 data = self.sock.recv(8)
                 # print(data)
```

---

### Incident Patch 7: `d88c1735` (2024-05-03)
**Commit Message**: Fix typo in README.md

The correct abbreviation is "kg". It stands for "knowledge graph". The "kd" is a typo.

**File**: `README.md` (modified, +1/-1)
```diff
@@ -166,7 +166,7 @@ launching:
 | card_game | ~5s            | < 500M             |
 | ltp       | ~5s            | < 500M             |
 | os        | ~5s            | < 500M             |
-| kd        | ~5s            | < 500M             |
+| kg        | ~5s            | < 500M             |
 
 ## References
 
```

---

### Incident Patch 8: `6f1c80b6` (2024-03-03)
**Commit Message**: Fix rounds number

**File**: `src/server/tasks/ltp/task.py` (modified, +1/-1)
```diff
@@ -369,7 +369,7 @@ def check_no(self, message: str):
 
 
 class LateralThinkingPuzzle(Task):
-    def __init__(self, rounds=50, filepath=None, eval_yaml=None, **configs):
+    def __init__(self, rounds=25, filepath=None, eval_yaml=None, **configs):
         # TODO: refactor
         # change into list, which contains dict with problems and language
         self.rounds = rounds
```

---

### Incident Patch 9: `eee4c50e` (2023-12-26)
**Commit Message**: Fix same typo

**File**: `docs/Introduction_en.md` (modified, +1/-1)
```diff
@@ -169,7 +169,7 @@ The Client primarily comprises three components:
 - The Assigner is responsible for coordinating the concurrent tasks and models currently available, planning and
   allocating test cases, and creating the corresponding number of Workers along with their Agent Client and Task Client.
 - The Agent Client implements the corresponding interface required by the Agent Server, exposing the
-  unified `AgentClient.reference(self, history)`.
+  unified `AgentClient.inference(self, history)`.
 - The Task Client interfaces exclusively with the Task Controller, making its implementation unique. Its core method
   is `TaskClient.run_sample(self, index, agent)`, which ensures the passed `Agent` and `Task` outputs are forwarded to
   each other.
```

---

### Incident Patch 10: `54957d3d` (2023-12-25)
**Commit Message**: Fix typo: AgentClient.reference --> AgentClient.inference

**File**: `docs/Introduction_cn.md` (modified, +1/-1)
```diff
@@ -129,7 +129,7 @@ Client主要包含三部分：
 
 - Assigner 负责根据目前各个任务以及模型的并发数，统筹、规划和分配样例的测试，并生成对应数量的Worker及其Agent Client和Task
   Client。
-- Agent Client 负责实现 Agent Server 要求的对应的接口，暴露统一的 `AgentClient.reference(self, history)`。
+- Agent Client 负责实现 Agent Server 要求的对应的接口，暴露统一的 `AgentClient.inference(self, history)`。
 - Task Client 面对唯一的 Task Controller，因此实现是唯一的。其核心方法是 `TaskClient.run_sample(self, index, agent)`
   ，需要负责将传入的 `Agent` 和 `Task` 的输出相互转发。
 
```

#### Recent Merged Pull Requests:
- **PR #231** (closed): feat(scripts): Wilson CI + paired McNemar reporting (@KeilerHirsch)
- **PR #216** (closed): Fork v02 (@Nao-Taka)
- **PR #213** (2026-02-08): Add lite presets for minimal local runs (@mkimhi)
- **PR #210** (2026-02-08): Fix HTTPAgent to support OpenAI-compatible API responses (vLLM) (@letusfly85)
- **PR #207** (2025-11-17): Update website url (@Xiao9905)
- **PR #206** (2025-11-17): Remove deprecated website (@Xiao9905)
- **PR #202** (2025-10-14): publish agentbench_fc (@JingBh)
- **PR #200** (closed): Feature/zjz/demo (@jorschac)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
