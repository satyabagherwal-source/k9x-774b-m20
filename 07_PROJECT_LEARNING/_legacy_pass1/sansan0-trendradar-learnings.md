# Forensic Learning Record (Deep Inspection): sansan0/TrendRadar

> **Canonical Artifact**: `07_PROJECT_LEARNING/sansan0-trendradar-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/sansan0/TrendRadar](https://github.com/sansan0/TrendRadar))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-09-30T02:56:07.099Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `sansan0/TrendRadar`
- **Description**: ⭐AI-driven public opinion & trend monitor with multi-platform aggregation, RSS, and smart alerts.🎯 告别信息过载，你的 AI 舆情监控助手与热点筛选工具！聚合多平台热点 +  RSS 订阅，支持关键词精准筛选。AI 智能筛选新闻 + AI 翻译 +  AI 分析简报直推手机，也支持接入 MCP 架构，赋能 AI 自然语言对话分析、情感洞察与趋势预测等。支持 Docker ，数据本地/云端自持。集成微信/飞书/钉钉/Telegram/邮件/ntfy/bark/slack 等渠道智能推送。
- **Primary Language / Ecosystem**: Python
- **Discovered Manifests / Configurations**: pyproject.toml, README.md
- **Stars / Engagement**: 62619 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: pyproject.toml, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `docker/manage.py`
```
#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
新闻爬虫容器管理工具 - supercronic
"""

import os
import sys
import subprocess
import time
import signal
from pathlib import Path

# Web 服务器配置
_raw_port = int(os.environ.get("WEBSERVER_PORT", "8080"))
WEBSERVER_PORT = _raw_port if 1 <= _raw_port <= 65535 else 8080
WEBSERVER_DIR = "/app/output"
WEBSERVER_PID_FILE = "/tmp/webserver.pid"


def manual_run():
    """手动执行一次爬虫"""
    print("🔄 手动执行爬虫...")
    try:
        result = subprocess.run(
            ["python", "-m", "trendradar"], cwd="/app", capture_output=False, text=True
        )
        if result.returncode == 0:
            print("✅ 执行完成")
        else:
            print(f"❌ 执行失败，退出码: {result.returncode}")
    except Exception as e:
        print(f"❌ 执行出错: {e}")


def parse_cron_schedule(cron_expr):
    """解析cron表达式并返回人类可读的描述"""
    if not cron_expr or cron_expr == "未设置":
        return "未设置"
    
    try:
        parts = cron_expr.strip().split()
        if len(parts) != 5:
            return f"原始表达式: {cron_expr}"
        
        minute, hour, day, month, weekday = parts
        
        # 分析分钟
        if minute == "*":
            minute_desc = "每分钟"
        elif minute.startswith("*/"):
            interval = minute[2:]
            minute_desc = f"每{interval}分钟"
        elif "," in minute:
            minute_desc = f"在第{minute}分钟"
        else:
            minute_desc = f"在第{minute}分钟"
        
        # 分析小时
        if hour == "*":
            hour_desc = "每小时"
        elif hour.startswith("*/"):
            interval = hour[2:]
            hour_desc = f"每{interval}小时"
        elif "," in hour:
            hour_desc = f"在{hour}点"
        else:
            hour_desc = f"在{hour}点"
        
        # 分析日期
        if day == "*":
            day_desc = "每天"
        elif day.startswith("*/"):
            interval = day[2:]
            day_desc = f"每{interval}天"
        else:
            day_desc = f"每月{day}号"
        
        # 分析月份
        if month == "*":
            month_desc = "每月"
        else:
            month_desc = f"在{month}月"
        
        # 分析星期
        weekday_names = {
            "0": "周日", "1": "周一", "2": "周二", "3": "周三", 
            "4": "周四", "5": "周五", "6": "周六", "7": "周日"
        }
        if weekday == "*":
            weekday_desc = ""
        else:
            weekday_desc = f"在{weekday_names.get(weekday, weekday)}"
        
        # 组合描述
        if minute.startswith("*/") and hour == "*" and day == "*" and month == "*" and weekday
```

### Core Architecture Module: `mcp_server/__init__.py`
```
"""
TrendRadar MCP Server

提供基于MCP协议的新闻聚合数据查询和系统管理接口。

"""

__version__ = "4.1.0"

```

### Core Architecture Module: `mcp_server/server.py`
```
"""
TrendRadar MCP Server - FastMCP 2.0 实现

使用 FastMCP 2.0 提供生产级 MCP 工具服务器。
支持 stdio 和 HTTP 两种传输模式。
"""

import asyncio
import json
from typing import List, Optional, Dict, Union

from fastmcp import FastMCP

from .tools.data_query import DataQueryTools
from .tools.analytics import AnalyticsTools
from .tools.search_tools import SearchTools
from .tools.config_mgmt import ConfigManagementTools
from .tools.system import SystemManagementTools
from .tools.storage_sync import StorageSyncTools
from .tools.article_reader import ArticleReaderTools
from .tools.notification import NotificationTools
from .utils.date_parser import DateParser
from .utils.errors import MCPError


# 创建 FastMCP 2.0 应用
mcp = FastMCP('trendradar-news')

# 全局工具实例（在第一次请求时初始化）
_tools_instances = {}


def _get_tools(project_root: Optional[str] = None):
    """获取或创建工具实例（单例模式）"""
    if not _tools_instances:
        _tools_instances['data'] = DataQueryTools(project_root)
        _tools_instances['analytics'] = AnalyticsTools(project_root)
        _tools_instances['search'] = SearchTools(project_root)
        _tools_instances['config'] = ConfigManagementTools(project_root)
        _tools_instances['system'] = SystemManagementTools(project_root)
        _tools_instances['storage'] = StorageSyncTools(project_root)
        _tools_instances['article'] = ArticleReaderTools(project_root)
        _tools_instances['notification'] = NotificationTools(project_root)
    return _tools_instances


# ==================== MCP Resources ====================

@mcp.resource("config://platforms")
async def get_platforms_resource() -> str:
    """
    获取支持的平台列表

    返回 config.yaml 中配置的所有平台信息，包括 ID 和名称。
    """
    tools = _get_tools()
    config = await asyncio.to_thread(
        tools['config'].get_current_config, section="crawler"
    )
    return json.dumps({
        "platforms": config.get("platforms", []),
        "description": "TrendRadar 支持的热榜平台列表"
    }, ensure_ascii=False, indent=2)


@mcp.resource("config://rss-feeds")
async def get_rss_feeds_resource() -> str:
    """
    获取 RSS 订阅源列表

    返回当前配置的所有 RSS 源信息。
    """
    tools = _get_tools()
    status = await asyncio.to_thread(tools['data'].get_rss_feeds_status)
    return json.dumps({
        "feeds": status.get("today_feeds", {}),
        "description": "TrendRadar 支持的 RSS 订阅源列表"
    }, ensure_ascii=False, indent=2)


@mcp.resource("data://available-dates")
async def get_available_dates_resource() -> str:
    """
    获取可用的数据日期范围

    返回本地存储中可查询的日期列表。
   
```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #1197** (2026-09-03): **VULNERABILITY REPORT**
  *Symptoms*: ### 📦 TrendRadar 版本  I'd like to report a vulnerability. Can you open PVR - private vulnerability report ? thanks  ### 🔌 MCP Server 版本 (可选)  I'd like to report a vulnerability. Can you open PVR - private vulnerability report ? thanks  ### 🏷️ 问题类别  AI 分析相关（报错、内容异常、提示词失效等）  ### 🤖 AI 模型名称（AI 问题必填）  _No response_  ### 📝 描述发生了什么  I'd like to report a vulnerability. Can you open PVR - private vulnerability report ? thanks  ### 📋 错误日志/配置（可选）  I'd like to report a vulnerability. Can you open PVR - private vulnerability report ? thanks  ### 📷 截图（强烈建议）  I'd like to report a vulnerability. Can you

- **Issue #1185** (2026-07-21): **Enable private vulnerability reporting**
  *Symptoms*: ### 📦 TrendRadar 版本  vulnerability report  ### 🔌 MCP Server 版本 (可选)  _No response_  ### 🏷️ 问题类别  AI 分析相关（报错、内容异常、提示词失效等）  ### 🤖 AI 模型名称（AI 问题必填）  _No response_  ### 📝 描述发生了什么  vulnerability report  ### 📋 错误日志/配置（可选）  _No response_  ### 📷 截图（强烈建议）  Hi,  I have a security finding to share privately. Could you enable private vulnerability reporting on this repo? @bing-h  @wtychn  @sansan0  Thanks  ### 🖥️ 使用环境  Docker (本地/NAS)
  **Post-Mortem & Fix Analysis**:
  > Hey, I want to report a vulnerability. Can you please open PVR on this repository, to let me report? @sansan0 
  > hey @sansan0 @bing-h @wtychn @actions-user, reminding on this request. This is critical vuln I'd like to report via private github advisory

- **Issue #1179** (2026-06-26): **[问题] 可视化配置编辑器 难道不需要加个访问控制吗？**
  *Symptoms*: ### 📦 TrendRadar 版本  v6.9  ### 🔌 MCP Server 版本 (可选)  _No response_  ### 🏷️ 问题类别  其他  ### 🤖 AI 模型名称（AI 问题必填）  _No response_  ### 📝 描述发生了什么  可视化配置编辑器，随便什么人都可任意修改配置？只要有网址？ 这不对吧？   ### 📋 错误日志/配置（可选）  _No response_  ### 📷 截图（强烈建议）  _No response_  ### 🖥️ 使用环境  GitHub Actions
  **Post-Mortem & Fix Analysis**:
  > ok 我明白了 这个只是辅助，需要自己修改代码

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

### Incident Patch 1: `07c5bcbe` (2026-07-04)
**Commit Message**: fix(config): 修复环境变量设为 0 时被 or 真值判断静默忽略的问题

Fixes #1184

**File**: `trendradar/core/loader.py` (modified, +11/-17)
```diff
@@ -23,17 +23,6 @@ def _get_env_bool(key: str) -> Optional[bool]:
     return value in ("true", "1")
 
 
-def _get_env_int(key: str, default: int = 0) -> int:
-    """从环境变量获取整数值"""
-    value = os.environ.get(key, "").strip()
-    if not value:
-        return default
-    try:
-        return int(value)
-    except ValueError:
-        return default
-
-
 def _get_env_int_or_none(key: str) -> Optional[int]:
     """从环境变量获取整数值，未设置时返回 None"""
     value = os.environ.get(key, "").strip()
@@ -83,14 +72,14 @@ def _load_report_config(config_data: Dict) -> Dict:
 
     # 环境变量覆盖
     sort_by_position_env = _get_env_bool("SORT_BY_POSITION_FIRST")
-    max_news_env = _get_env_int("MAX_NEWS_PER_KEYWORD")
+    max_news_env = _get_env_int_or_none("MAX_NEWS_PER_KEYWORD")
 
     return {
         "REPORT_MODE": report_config.get("mode", "daily"),
         "DISPLAY_MODE": report_config.get("display_mode", "keyword"),
         "RANK_THRESHOLD": report_config.get("rank_threshold", 10),
         "SORT_BY_POSITION_FIRST": sort_by_position_env if sort_by_position_env is not None else report_config.get("sort_by_position_first", False),
-        "MAX_NEWS_PER_KEYWORD": max_news_env or report_config.get("max_news_per_keyword", 0),
+        "MAX_NEWS_PER_KEYWORD": max_news_env if max_news_env is not None else report_config.get("max_news_per_keyword", 0),
     }
 
 
@@ -100,6 +89,8 @@ def _load_notification_config(config_data: Dict) -> Dict:
     advanced = config_data.get("advanced", {})
     batch_
```

---

### Incident Patch 2: `a03ec972` (2026-06-08)
**Commit Message**: fix: 修复 AI 翻译/分析/筛选流多处数据一致性问题，升级至 v6.9.1

- 翻译：独立展示区/HTML热榜/RSS新增区多处译文缺失或错位
- 筛选：失败批次误标已分析致新闻丢失，RSS新增区未同步AI结果
- 隔离：独立AI模式混入不同时间窗的RSS/独立展示区数据

**File**: `README-EN.md` (modified, +3/-1)
```diff
@@ -11,8 +11,10 @@ Deploy in <strong>30 seconds</strong> — Say goodbye to endless scrolling, only
 [![GitHub Stars](https://img.shields.io/github/stars/sansan0/TrendRadar?style=flat-square&logo=github&color=yellow)](https://github.com/sansan0/TrendRadar/stargazers)
 [![GitHub Forks](https://img.shields.io/github/forks/sansan0/TrendRadar?style=flat-square&logo=github&color=blue)](https://github.com/sansan0/TrendRadar/network/members)
 [![License](https://img.shields.io/badge/license-GPL--3.0-blue.svg?style=flat-square)](LICENSE)
-[![Version](https://img.shields.io/badge/version-v6.9.0-blue.svg)](https://github.com/sansan0/TrendRadar)
+[![Version](https://img.shields.io/badge/version-v6.9.1-blue.svg)](https://github.com/sansan0/TrendRadar)
 [![MCP](https://img.shields.io/badge/MCP-v4.1.0-green.svg)](https://github.com/sansan0/TrendRadar)
+[![Docker Pulls](https://img.shields.io/docker/pulls/wantcat/trendradar?style=flat-square&logo=docker&logoColor=white&label=TrendRadar%20Pulls&color=2496ED)](https://hub.docker.com/r/wantcat/trendradar)
+[![Docker Pulls](https://img.shields.io/docker/pulls/wantcat/trendradar-mcp?style=flat-square&logo=docker&logoColor=white&label=MCP%20Pulls&color=2496ED)](https://hub.docker.com/r/wantcat/trendradar-mcp)
 [![RSS](https://img.shields.io/badge/RSS-Feed_Support-orange.svg?style=flat-square&logo=rss&logoColor=white)](https://github.com/sansan0/TrendRadar)
 [![AI Translation](https://img.shields.io/badge/AI-Multi--Language-purple.svg?style=flat-squ
```

**File**: `README.md` (modified, +3/-1)
```diff
@@ -12,8 +12,10 @@
 [![GitHub Stars](https://img.shields.io/github/stars/sansan0/TrendRadar?style=flat-square&logo=github&color=yellow)](https://github.com/sansan0/TrendRadar/stargazers)
 [![GitHub Forks](https://img.shields.io/github/forks/sansan0/TrendRadar?style=flat-square&logo=github&color=blue)](https://github.com/sansan0/TrendRadar/network/members)
 [![License](https://img.shields.io/badge/license-GPL--3.0-blue.svg?style=flat-square)](LICENSE)
-[![Version](https://img.shields.io/badge/version-v6.9.0-blue.svg)](https://github.com/sansan0/TrendRadar)
+[![Version](https://img.shields.io/badge/version-v6.9.1-blue.svg)](https://github.com/sansan0/TrendRadar)
 [![MCP](https://img.shields.io/badge/MCP-v4.1.0-green.svg)](https://github.com/sansan0/TrendRadar)
+[![Docker Pulls](https://img.shields.io/docker/pulls/wantcat/trendradar?style=flat-square&logo=docker&logoColor=white&label=TrendRadar%20Pulls&color=2496ED)](https://hub.docker.com/r/wantcat/trendradar)
+[![Docker Pulls](https://img.shields.io/docker/pulls/wantcat/trendradar-mcp?style=flat-square&logo=docker&logoColor=white&label=MCP%20Pulls&color=2496ED)](https://hub.docker.com/r/wantcat/trendradar-mcp)
 [![RSS](https://img.shields.io/badge/RSS-订阅源支持-orange.svg?style=flat-square&logo=rss&logoColor=white)](https://github.com/sansan0/TrendRadar)
 [![AI翻译](https://img.shields.io/badge/AI-多语言推送-purple.svg?style=flat-square)](https://github.com/sansan0/TrendRadar)
 
```

**File**: `pyproject.toml` (modified, +1/-1)
```diff
@@ -1,6 +1,6 @@
 [project]
 name = "trendradar"
-version = "6.9.0"
+version = "6.9.1"
 description = "TrendRadar - 热点新闻聚合与分析工具"
 requires-python = ">=3.12"
 dependencies = [
```

---

### Incident Patch 3: `a5ede43a` (2026-06-04)
**Commit Message**: fix(editor): 修复时间线编辑器生成 week_map 数字 key 带引号导致调度失败

Closes #1158

**File**: `docs/assets/script.js` (modified, +5/-1)
```diff
@@ -5059,7 +5059,11 @@ function buildEmptyPresetBlock(key, name, desc) {
  */
 function buildPresetYamlBlock(key, cfg) {
     const obj = { [key]: cfg };
-    const dumped = jsyaml.dump(obj, { indent: 2, lineWidth: -1, quotingType: '"', forceQuotes: false });
+    let dumped = jsyaml.dump(obj, { indent: 2, lineWidth: -1, quotingType: '"', forceQuotes: false });
+    // js-yaml 会把 week_map 的数字 key 序列化成带引号的字符串（"1".."7"），
+    // 而后端 scheduler 用整数 isoweekday() 读取 week_map，字符串 key 会导致启动校验失败、无法运行。
+    // 这里去掉纯数字 key 的引号，与手写模板（1: all_day）及后端期望的整数 key 保持一致。
+    dumped = dumped.replace(/^(\s*)"(\d+)":/gm, '$1$2:');
     return dumped.split('\n').map(l => l ? '  ' + l : l).join('\n');
 }
 
```

---

### Incident Patch 4: `ac0ad4f4` (2026-05-27)
**Commit Message**: fix(rss): 修复首次抓取计数及报告热点过滤，升级至 v6.8.1

**File**: `README-EN.md` (modified, +1/-1)
```diff
@@ -11,7 +11,7 @@ Deploy in <strong>30 seconds</strong> — Say goodbye to endless scrolling, only
 [![GitHub Stars](https://img.shields.io/github/stars/sansan0/TrendRadar?style=flat-square&logo=github&color=yellow)](https://github.com/sansan0/TrendRadar/stargazers)
 [![GitHub Forks](https://img.shields.io/github/forks/sansan0/TrendRadar?style=flat-square&logo=github&color=blue)](https://github.com/sansan0/TrendRadar/network/members)
 [![License](https://img.shields.io/badge/license-GPL--3.0-blue.svg?style=flat-square)](LICENSE)
-[![Version](https://img.shields.io/badge/version-v6.8.0-blue.svg)](https://github.com/sansan0/TrendRadar)
+[![Version](https://img.shields.io/badge/version-v6.8.1-blue.svg)](https://github.com/sansan0/TrendRadar)
 [![MCP](https://img.shields.io/badge/MCP-v4.0.4-green.svg)](https://github.com/sansan0/TrendRadar)
 [![RSS](https://img.shields.io/badge/RSS-Feed_Support-orange.svg?style=flat-square&logo=rss&logoColor=white)](https://github.com/sansan0/TrendRadar)
 [![AI Translation](https://img.shields.io/badge/AI-Multi--Language-purple.svg?style=flat-square)](https://github.com/sansan0/TrendRadar)
```

**File**: `README.md` (modified, +1/-1)
```diff
@@ -12,7 +12,7 @@
 [![GitHub Stars](https://img.shields.io/github/stars/sansan0/TrendRadar?style=flat-square&logo=github&color=yellow)](https://github.com/sansan0/TrendRadar/stargazers)
 [![GitHub Forks](https://img.shields.io/github/forks/sansan0/TrendRadar?style=flat-square&logo=github&color=blue)](https://github.com/sansan0/TrendRadar/network/members)
 [![License](https://img.shields.io/badge/license-GPL--3.0-blue.svg?style=flat-square)](LICENSE)
-[![Version](https://img.shields.io/badge/version-v6.8.0-blue.svg)](https://github.com/sansan0/TrendRadar)
+[![Version](https://img.shields.io/badge/version-v6.8.1-blue.svg)](https://github.com/sansan0/TrendRadar)
 [![MCP](https://img.shields.io/badge/MCP-v4.0.4-green.svg)](https://github.com/sansan0/TrendRadar)
 [![RSS](https://img.shields.io/badge/RSS-订阅源支持-orange.svg?style=flat-square&logo=rss&logoColor=white)](https://github.com/sansan0/TrendRadar)
 [![AI翻译](https://img.shields.io/badge/AI-多语言推送-purple.svg?style=flat-square)](https://github.com/sansan0/TrendRadar)
```

**File**: `pyproject.toml` (modified, +1/-1)
```diff
@@ -1,6 +1,6 @@
 [project]
 name = "trendradar"
-version = "6.8.0"
+version = "6.8.1"
 description = "TrendRadar - 热点新闻聚合与分析工具"
 requires-python = ">=3.12"
 dependencies = [
```

---

### Incident Patch 5: `68db3a9a` (2026-05-19)
**Commit Message**: fix(report): HTML 报告和邮件尊重 display.regions 开关，精简 config.yaml 注释，升级至 v6.7.1

**File**: `README-EN.md` (modified, +1/-1)
```diff
@@ -11,7 +11,7 @@ Deploy in <strong>30 seconds</strong> — Say goodbye to endless scrolling, only
 [![GitHub Stars](https://img.shields.io/github/stars/sansan0/TrendRadar?style=flat-square&logo=github&color=yellow)](https://github.com/sansan0/TrendRadar/stargazers)
 [![GitHub Forks](https://img.shields.io/github/forks/sansan0/TrendRadar?style=flat-square&logo=github&color=blue)](https://github.com/sansan0/TrendRadar/network/members)
 [![License](https://img.shields.io/badge/license-GPL--3.0-blue.svg?style=flat-square)](LICENSE)
-[![Version](https://img.shields.io/badge/version-v6.7.0-blue.svg)](https://github.com/sansan0/TrendRadar)
+[![Version](https://img.shields.io/badge/version-v6.7.1-blue.svg)](https://github.com/sansan0/TrendRadar)
 [![MCP](https://img.shields.io/badge/MCP-v4.0.4-green.svg)](https://github.com/sansan0/TrendRadar)
 [![RSS](https://img.shields.io/badge/RSS-Feed_Support-orange.svg?style=flat-square&logo=rss&logoColor=white)](https://github.com/sansan0/TrendRadar)
 [![AI Translation](https://img.shields.io/badge/AI-Multi--Language-purple.svg?style=flat-square)](https://github.com/sansan0/TrendRadar)
```

**File**: `README.md` (modified, +1/-1)
```diff
@@ -12,7 +12,7 @@
 [![GitHub Stars](https://img.shields.io/github/stars/sansan0/TrendRadar?style=flat-square&logo=github&color=yellow)](https://github.com/sansan0/TrendRadar/stargazers)
 [![GitHub Forks](https://img.shields.io/github/forks/sansan0/TrendRadar?style=flat-square&logo=github&color=blue)](https://github.com/sansan0/TrendRadar/network/members)
 [![License](https://img.shields.io/badge/license-GPL--3.0-blue.svg?style=flat-square)](LICENSE)
-[![Version](https://img.shields.io/badge/version-v6.7.0-blue.svg)](https://github.com/sansan0/TrendRadar)
+[![Version](https://img.shields.io/badge/version-v6.7.1-blue.svg)](https://github.com/sansan0/TrendRadar)
 [![MCP](https://img.shields.io/badge/MCP-v4.0.4-green.svg)](https://github.com/sansan0/TrendRadar)
 [![RSS](https://img.shields.io/badge/RSS-订阅源支持-orange.svg?style=flat-square&logo=rss&logoColor=white)](https://github.com/sansan0/TrendRadar)
 [![AI翻译](https://img.shields.io/badge/AI-多语言推送-purple.svg?style=flat-square)](https://github.com/sansan0/TrendRadar)
```

**File**: `config/config.yaml` (modified, +123/-244)
```diff
@@ -18,7 +18,7 @@ app:
   #   - Europe/London (伦敦时间 UTC+0/+1)
   # 完整时区列表: https://en.wikipedia.org/wiki/List_of_tz_database_time_zones
   timezone: "Asia/Shanghai"
-  show_version_update: true           # 显示版本更新提示
+  show_version_update: true           # 是否显示版本更新提示（true=显示, false=隐藏）
 
 
 # ===============================================================
@@ -40,7 +40,7 @@ app:
 # 详细时间线图请查看 config/timeline.yaml
 # ===============================================================
 schedule:
-  enabled: true                         # 是否启用调度系统
+  enabled: false                        # 是否启用调度系统（true=启用, false=关闭，默认关闭）
   preset: "morning_evening"             # 预设模板名称（见上方说明）
 
 
@@ -53,7 +53,7 @@ schedule:
 #   - name: 显示名称（可自定义，修改后不影响运行）
 # ===============================================================
 platforms:
-  enabled: true                         # 是否启用热榜平台抓取
+  enabled: true                         # 是否启用热榜平台抓取（true=启用, false=关闭）
   sources:
     - id: "toutiao"
       name: "今日头条"
@@ -89,20 +89,12 @@ platforms:
 # max_age_days: 可选，覆盖全局 freshness_filter.max_age_days
 # ===============================================================
 rss:
-  enabled: true                       # 是否启用 RSS 抓取
-
-  # 文章新鲜度过滤配置（全局默认值）
-  # 过滤掉发布时间超过指定天数的旧文章，避免同一篇文章重复出现在推送中
-  #
-  # 过滤逻辑：
-  #   - 文章发布时间距当前时间（app.timezone 时区）超过 N 天则不推送
-  #   - 无发布时间的文章会被保留（不过滤）
-  #
-  # ⚠️ 过滤时机：在推送阶段过滤
-  #    - 所有文章都会存入数据库（MCP Server 的 AI 查询仍可访问）
-  #    - 只有新鲜的文章会被推送到通知渠道
+  enabled: true                  
```

#### Recent Merged Pull Requests:
- **PR #1225** (closed): pull (@snow-sprite)
- **PR #1223** (closed): 0924 (@liukiii)
- **PR #1211** (closed): pull (@hellostone)
- **PR #1206** (closed): 未进行消息合并的修复 (@liuyishou9911)
- **PR #1196** (closed): feat: 每日推送 GitHub 热门仓库与 Hacker News 到飞书 (@bhrajate)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
