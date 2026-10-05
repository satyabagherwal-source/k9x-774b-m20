# Forensic Learning Record (Deep Inspection): titanwings/distilly

> **Canonical Artifact**: `07_PROJECT_LEARNING/titanwings-distilly-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/titanwings/distilly](https://github.com/titanwings/distilly))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-05T18:31:48.242Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `titanwings/distilly`
- **Description**: Distilly — Distill how they think into reusable Skills for any Agent or Bot. Formerly Colleague Skill（原同事 Skill）.
- **Primary Language / Ecosystem**: Python
- **Discovered Manifests / Configurations**: package.json, README.md
- **Stars / Engagement**: 25314 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: package.json, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `tools/dingtalk_auto_collector.py`
```
#!/usr/bin/env python3
"""
钉钉自动采集器

输入同事姓名，自动：
  1. 搜索钉钉用户，获取 userId
  2. 搜索他创建/编辑的文档和知识库内容
  3. 拉取多维表格（如有）
  4. 消息记录（API 不支持历史拉取，自动切换浏览器方案）
  5. 输出统一格式，直接进入 Distilly 分析流程

钉钉限制说明：
  钉钉 Open API 不提供历史消息拉取接口，
  消息记录部分自动使用 Playwright 浏览器方案采集。

前置：
  pip3 install requests playwright
  playwright install chromium
  python3 dingtalk_auto_collector.py --setup

用法：
  python3 dingtalk_auto_collector.py --name "张三" --output-dir ./knowledge/zhangsan
  python3 dingtalk_auto_collector.py --name "张三" --skip-messages   # 跳过消息采集
  python3 dingtalk_auto_collector.py --name "张三" --doc-limit 20
"""

from __future__ import annotations

import json
import sys
import time
import argparse
import platform
from pathlib import Path
from datetime import datetime, timezone
from typing import Optional

try:
    import requests
except ImportError:
    print("错误：请先安装依赖：pip3 install requests", file=sys.stderr)
    sys.exit(1)


CONFIG_PATH = Path.home() / ".distilly" / "dingtalk_config.json"
LEGACY_CONFIG_PATH = Path.home() / ".colleague-skill" / "dingtalk_config.json"
API_BASE = "https://api.dingtalk.com"


# ─── 配置 ────────────────────────────────────────────────────────────────────

def load_config() -> dict:
    config_path = CONFIG_PATH if CONFIG_PATH.exists() else LEGACY_CONFIG_PATH
    if not config_path.exists():
        print("未找到配置，请先运行：python3 dingtalk_auto_collector.py --setup", file=sys.stderr)
        sys.exit(1)
    return json.loads(config_path.read_text(encoding="utf-8"))


def save_config(config: dict) -> None:
    CONFIG_PATH.parent.mkdir(parents=True, exist_ok=True)
    CONFIG_PATH.write_text(json.dumps(config, indent=2, ensure_ascii=False))
    CONFIG_PATH.chmod(0o600)


def setup_config() -> None:
    print("=== 钉钉自动采集配置 ===\n")
    print("请前往 https://open-dev.dingtalk.com 创建企业内部应用，开通以下权限：\n")
    print("  通讯录类：")
    print("    qyapi_get_member_detail     查询用户详情")
    print("    Contact.User.mobile         读取用户手机号（可选）")
    print()
    print("  消息类（可选，仅用于发消息，历史消息需浏览器方案）：")
    print("    qyapi_robot_sendmsg         机器人发消息")
    print()
    print("  文档类：")
    print("    Doc.WorkSpace.READ          读取工作空间")
    print("    Doc.File.READ               读取文件")
    print()
    print("  多维表格：")
    print("    Bitable.Record.READ         读取记录")
    print()

    app_key = input("AppKey (ding_xxx): ").strip()
    app_secret = input("AppSecret: ").strip()

    config = {"app_key": app_key, "app_secret": app_secret}
    save_config(config)
    print(f"\n✅ 配置已保存到 {CONFIG_PATH}")
    print("\n注意：消息记录采集需要 Playwright，请确认已安装：")
    print("  pip3 install playwright && playwright install chromium")


# ─── Token ───────────────────────────────────────────────────────────────────

_token_cache: dict = {}


def get_access_token(config: dict) -> str:
    """获取钉钉 access_token，带缓存"""
    now = time.time()
    if _token_cache.get("token") and _token_cache.get("expire", 0) > now + 60:
        return _token_cache["token"]

    resp = requests.post(
        f"{API_BASE}/v1.0/oauth2/accessToken",
        json={"appKey": config["app_key"], "appSecret": config["app_secret"]},
        timeout=10,
    )
    data = resp.json()

    if "accessToken" not in data:
        print(f"获取 token 失败：{data}", file=sys.stderr)
        sys.exit(1)

    token = data["accessToken"]
    _token_cache["token"] = token
    _token_cache["expire"] = now + data.get("expireIn", 7200)
    return token


def api_get(path: str, params: dict, config: dict) -> dict:
    token = get_access_token(config)
    resp = requests.get(
        f"{API_BASE}{path}",
        params=params,
        headers={"x-acs-dingtalk-access-token": token},
        timeout=15,
    )
    return resp.json()


def api_post(path: str, body: dict, config: dict) -> dict:
    token = get_access_token(config)
    resp = requests.post(
        f"{API_BASE}{path}",
        json=body,
        headers={"x-acs-dingtalk-access-token": token},
        timeout=15,
    )
    return resp.json()


# ─── 用户搜索 ─────────────────────────────────────────────────────────────────

def find_user(name: str, config: dict) -> Optional[dict]:
    """通过姓名搜索钉钉用户"""
    print(f"  搜索用户：{name} ...", file=sys.stderr)

    data = api_post(
        "/v1.0/contact/users/search",
        {"searchText": name, "offset": 0, "size": 10},
        config,
    )

    users = data.get("list", []) or data.get("result", {}).get("list", [])

    if not users:
        # 降级：通过部门遍历搜索
        print("  API 搜索无结果，尝试遍历通讯录 ...", file=sys.stderr)
        users = search_users_by_dept(name, config)

    if not users:
        print(f"  未找到用户：{name}", file=sys.stderr)
        return None

    if len(users) == 1:
        u = users[0]
        print(f"  找到用户：{u.get('name')}（{u.get('deptNameList', [''])[0] if isinstance(u.get('deptNameList'), list) else ''}）", file=sys.stderr)
        return u

    print(f"\n  找到 {len(users)} 个结果，请选择：")
    for i, u in enumerate(users):
        dept = u.get("deptNameList", [""])
        dept_str = dept[0] if isinstance(dept, list) and dept else ""
        print(f"    [{i+1}] {u.get('name')}  {dept_str}  {u.get('unionId', '')}")

    choice = input("\n  选择编号（默认 1）：").strip() or "1"
    try:
        return users[int(choice) - 1]
    except (ValueError, IndexError):
        return users[0]


def search_users_by_dept(name: str, config: dict, dept_id: int = 1, depth: int = 0) -> list:
    """递归遍历部门搜索用户（深度限制 3 层）"""
    if depth > 3:
        return []

    results = []

    # 获取部门用户列表
    data = api_post(
        "/v1.0/contact/users/simplelist",
        {"deptId": dept_id, "cursor": 0, "size": 100},
        config,
    )
    users = data.get("list", [])
    for u in users:
        if name in u.get("name", ""):
            # 获取详细信息
            detail = api_get(f"/v1.0/contact/users/{u.get('userId')}", {}, config)
            results.append(detail.get("result", u))

    # 获取子部门
    sub_data = api_get(
        "/v1.0/contact/departments/listSubDepts",
        {"deptId": dept_id},
        config,
    )
    for sub in sub_data.get("result", []):
        results.extend(search_users_by_dept(name, config, sub.get("deptId"), depth + 1))

    return results


# ─── 文档采集 ─────────────────────────────────────────────────────────────────

def list_workspaces(config: dict) -> list:
    """获取所有工作空间"""
    data = api_get("/v1.0/doc/workspaces", {"maxResults": 50}, config)
    return data.get("workspaceModels", []) or data.get("result", {}).get("workspaceModels", [])


def search_docs_by_user(user_id: str, name: str, doc_limit: int, config: dict) -> list:
    """搜索用户创建的文档"""
    print(f"  搜索 {name} 的文档 ...", file=sys.stderr)

    # 方式一：全局搜索
    data = api_post(
        "/v1.0/doc/search",
        {
            "keyword": name,
            "size": doc_limit,
            "offset": 0,
        },
        config,
    )

    docs = []
    items = data.get("docList", []) or data.get("result", {}).get("docList", [])

    for item in items:
        creator_id = item.get("creatorId", "") or item.get("creator", {}).get("userId", "")
        # 过滤：只保留目标用户创建的
        if user_id and creator_id and creator_id != user_id:
            continue
        docs.append({
            "title": item.get("title", "无标题"),
            "docId": item.get("docId", ""),
            "spaceId": item.get("spaceId", ""),
            "type": item.get("docType", ""),
            "url": item.get("shareUrl", ""),
            "creator": item.get("creatorName", name),
        })

    if not docs:
        # 方式二：遍历工作空间找文档
        print("  搜索无结果，遍历工作空间 ...", file=sys.stderr)
        workspaces = list_workspaces(config)
        for ws in workspaces[:5]:  # 最多查 5 个空间
            ws_id = ws.get("spaceId") or ws.get("workspaceId")
            if not ws_id:
                continue
            files_data = api_get(
                f"/v1.0/doc/workspaces/{ws_id}/files",
                {"maxResults": 20, "orderBy": "modified_time", "order": "DESC"},
                config,
            )
            for f in files_data.get("files", []):
                creator_id = f.get("creatorId", "")
                if user_id and creator_id and creator_id != user_id:
                    continue
                docs.append({
                    "title": f.get("fileName", "无标题"),
                    "docId": f.get("docId", ""),
                    "spaceId": ws_id,
                    "type": f.get("docType", ""),
                    "url": f.get("shareUrl", ""),
                    "creator": name,
                })

    print(f"  找到 {len(docs)} 篇文档", file=sys.stderr)
    return docs[:doc_limit]


def fetch_doc_content(doc_id: str, space_id: str, config: dict) -> str:
    """拉取单篇文档的文本内容"""
    # 方式一：直接获取文档内容
    data = api_get(
        f"/v1.0/doc/workspaces/{space_id}/files/{doc_id}/content",
        {},
        config,
    )

    content = (
        data.get("content")
        or data.get("result", {}).get("content")
        or data.get("markdown")
        or data.get("result", {}).get("markdown")
        or ""
    )

    if content:
        return content

    # 方式二：获取下载链接后下载
    dl_data = api_get(
        f"/v1.0/doc/workspaces/{space_id}/files/{doc_id}/download",
        {},
        config,
    )
    dl_url = dl_data.get("downloadUrl") or dl_data.get("result", {}).get("downloadUrl")
    if dl_url:
        try:
            resp = requests.get(dl_url, timeout=15)
            return resp.text
        except Exception:
            pass

    return ""


def collect_docs(user: dict, doc_limit: int, config: dict) -> str:
    """采集目标用户的文档"""
    user_id = user.get("userId", "")
    name = user.get("name", "")

    docs = search_docs_by_user(user_id, name, doc_limit, config)
    if not docs:
        return f"# 文档内容\n\n未找到 {name} 相关文档\n"

    lines = [
        "# 文档内容（钉钉自动采集）",
        f"目标：{name}",
        f"共 {len(docs)} 篇",
        "",
    ]

    for doc in docs:
        title = doc.get("title", "无标题")
        doc_id = doc.get("docId", "")
        space_id = doc.get("spaceId", "")
        url = doc.get("url", "")

        if
```

### Core Architecture Module: `tools/email_parser.py`
```
#!/usr/bin/env python3
"""
邮件解析器

支持格式：
1. .eml 文件（标准邮件格式）
2. .txt 文件（纯文本邮件记录）
3. .mbox 文件（多封邮件合集）

用法：
    python email_parser.py --file emails.eml --target "zhangsan@company.com" --output output.txt
    python email_parser.py --file inbox.mbox --target "张三" --output output.txt
"""

import email
import email.policy
import mailbox
import re
import sys
import argparse
from pathlib import Path
from email.header import decode_header
from html.parser import HTMLParser


class HTMLTextExtractor(HTMLParser):
    """从 HTML 邮件内容中提取纯文本"""

    def __init__(self):
        super().__init__()
        self.result = []
        self._skip = False

    def handle_starttag(self, tag, attrs):
        if tag in ("script", "style"):
            self._skip = True

    def handle_endtag(self, tag):
        if tag in ("script", "style"):
            self._skip = False
        if tag in ("p", "br", "div", "tr"):
            self.result.append("\n")

    def handle_data(self, data):
        if not self._skip:
            self.result.append(data)

    def get_text(self):
        return re.sub(r"\n{3,}", "\n\n", "".join(self.result)).strip()


def decode_mime_str(s: str) -> str:
    """解码 MIME 编码的邮件头字段"""
    if not s:
        return ""
    parts = decode_header(s)
    result = []
    for part, charset in parts:
        if isinstance(part, bytes):
            charset = charset or "utf-8"
            try:
                result.append(part.decode(charset, errors="replace"))
            except Exception:
                result.append(part.decode("utf-8", errors="replace"))
        else:
            result.append(str(part))
    return "".join(result)


def extract_email_body(msg) -> str:
    """从邮件对象中提取正文文本"""
    body = ""

    if msg.is_multipart():
        for part in msg.walk():
            content_type = part.get_content_type()
            disposition = str(part.get("Content-Disposition", ""))

            if "attachment" in disposition:
                continue

            if content_type == "text/plain":
                payload = part.get_payload(decode=True)
                charset = part.get_content_charset() or "utf-8"
                try:
                    body = payload.decode(charset, errors="replace")
                    break
                except Exception:
                    body = payload.decode("utf-8", errors="replace")
                    break

            elif content_type == "text/html" and not body:
                payload = part.get_payload(decode=True)
                charset = part.get_content_charset() or "utf-8"
                try:
                    html = payload.decode(charset, errors="replace")
                except Exception:
                    html = payload.decode("utf-8", errors="replace")
                extractor = HTMLTextExtractor()
                extractor.feed(html)
                body = extractor.get_text()
    else:
        payload = msg.get_payload(decode=True)
        if payload:
            charset = msg.get_content_charset() or "utf-8"
            try:
                body = payload.decode(charset, errors="replace")
            except Exception:
                body = payload.decode("utf-8", errors="replace")

    # 清理引用内容（Re: 时的原文引用）
    body = re.sub(r"\n>.*", "", body)
    body = re.sub(r"\n-{3,}.*?原始邮件.*?\n", "\n", body, flags=re.DOTALL)
    body = re.sub(r"\n_{3,}\n.*", "", body, flags=re.DOTALL)

    return body.strip()


def is_from_target(from_field: str, target: str) -> bool:
    """判断邮件是否来自目标人"""
    from_str = decode_mime_str(from_field).lower()
    target_lower = target.lower()
    return target_lower in from_str


def parse_eml_file(file_path: str, target: str) -> list[dict]:
    """解析单个 .eml 文件"""
    with open(file_path, "rb") as f:
        msg = email.message_from_binary_file(f, policy=email.policy.default)

    from_field = str(msg.get("From", ""))
    if not is_from_target(from_field, target):
        return []

    subject = decode_mime_str(str(msg.get("Subject", "")))
    date = str(msg.get("Date", ""))
    body = extract_email_body(msg)

    if not body:
        return []

    return [{
        "from": decode_mime_str(from_field),
        "subject": subject,
        "date": date,
        "body": body,
    }]


def parse_mbox_file(file_path: str, target: str) -> list[dict]:
    """解析 .mbox 文件（多封邮件合集）"""
    results = []
    mbox = mailbox.mbox(file_path)

    for msg in mbox:
        from_field = str(msg.get("From", ""))
        if not is_from_target(from_field, target):
            continue

        subject = decode_mime_str(str(msg.get("Subject", "")))
        date = str(msg.get("Date", ""))
        body = extract_email_body(msg)

        if not body:
            continue

        results.append({
            "from": decode_mime_str(from_field),
            "subject": subject,
            "date": date,
            "body": body,
        })

    return results


def parse_txt_file(file_path: str, target: str) -> list[dict]:
    """
    解析纯文本格式的邮件记录
    支持简单的分隔格式：
    From: xxx
    Subject: xxx
    Date: xxx
    ---
    正文内容
    ===
    """
    results = []

    with open(file_path, "r", encoding="utf-8") as f:
        content = f.read()

    # 尝试按分隔符切割多封邮件
    emails_raw = re.split(r"\n={3,}\n|\n-{3,}\n(?=From:)", content)

    for raw in emails_raw:
        from_match = re.search(r"^From:\s*(.+)$", raw, re.MULTILINE)
        subject_match = re.search(r"^Subject:\s*(.+)$", raw, re.MULTILINE)
        date_match = re.search(r"^Date:\s*(.+)$", raw, re.MULTILINE)

        from_field = from_match.group(1).strip() if from_match else ""
        if not is_from_target(from_field, target):
            continue

        # 提取正文（去掉头部字段后的内容）
        body = re.sub(r"^(From|To|Subject|Date|CC|BCC):.*\n?", "", raw, flags=re.MULTILINE)
        body = body.strip()

        if not body:
            continue

        results.append({
            "from": from_field,
            "subject": subject_match.group(1).strip() if subject_match else "",
            "date": date_match.group(1).strip() if date_match else "",
            "body": body,
        })

    return results


def classify_emails(emails: list[dict]) -> dict:
    """
    对邮件按内容分类：
    - 长邮件（正文 > 200 字）：技术方案、观点陈述
    - 决策类：包含明确判断的邮件
    - 日常沟通：短邮件
    """
    long_emails = []
    decision_emails = []
    daily_emails = []

    decision_keywords = [
        "同意", "不同意", "建议", "方案", "觉得", "应该", "决定", "确认",
        "approve", "reject", "lgtm", "suggest", "recommend", "think",
        "我的看法", "我认为", "我觉得", "需要", "必须", "不需要"
    ]

    for e in emails:
        body = e["body"]

        if len(body) > 200:
            long_emails.append(e)
        elif any(kw in body.lower() for kw in decision_keywords):
            decision_emails.append(e)
        else:
            daily_emails.append(e)

    return {
        "long_emails": long_emails,
        "decision_emails": decision_emails,
        "daily_emails": daily_emails,
        "total_count": len(emails),
    }


def format_output(target: str, classified: dict) -> str:
    """格式化输出，供 AI 分析使用"""
    lines = [
        f"# 邮件提取结果",
        f"目标人物：{target}",
        f"总邮件数：{classified['total_count']}",
        "",
        "---",
        "",
        "## 长邮件（技术方案/观点类，权重最高）",
        "",
    ]

    for e in classified["long_emails"]:
        lines.append(f"**主题：{e['subject']}** [{e['date']}]")
        lines.append(e["body"])
        lines.append("")
        lines.append("---")
        lines.append("")

    lines += [
        "## 决策类邮件",
        "",
    ]

    for e in classified["decision_emails"]:
        lines.append(f"**主题：{e['subject']}** [{e['date']}]")
        lines.append(e["body"])
        lines.append("")

    lines += [
        "---",
        "",
        "## 日常沟通（风格参考）",
        "",
    ]

    for e in classified["daily_emails"][:30]:
        lines.append(f"**{e['subject']}**：{e['body'][:200]}")
        lines.append("")

    return "\n".join(lines)


def main():
    parser = argparse.ArgumentParser(description="解析邮件文件，提取目标人发出的邮件")
    parser.add_argument("--file", required=True, help="输入文件路径（.eml / .mbox / .txt）")
    parser.add_argument("--target", required=True, help="目标人物（邮箱地址或姓名）")
    parser.add_argument("--output", default=None, help="输出文件路径（默认打印到 stdout）")

    args = parser.parse_args()

    file_path = Path(args.file)
    if not file_path.exists():
        print(f"错误：文件不存在 {file_path}", file=sys.stderr)
        sys.exit(1)

    suffix = file_path.suffix.lower()

    if suffix == ".eml":
        emails = parse_eml_file(str(file_path), args.target)
    elif suffix == ".mbox":
        emails = parse_mbox_file(str(file_path), args.target)
    else:
        emails = parse_txt_file(str(file_path), args.target)

    if not emails:
        print(f"警告：未找到来自 '{args.target}' 的邮件", file=sys.stderr)
        print("提示：请检查目标名称/邮箱是否与文件中的 From 字段一致", file=sys.stderr)

    classified = classify_emails(emails)
    output = format_output(args.target, classified)

    if args.output:
        with open(args.output, "w", encoding="utf-8") as f:
            f.write(output)
        print(f"已输出到 {args.output}，共 {len(emails)} 封邮件")
    else:
        print(output)


if __name__ == "__main__":
    main()

```

### Core Architecture Module: `tools/feishu_auto_collector.py`
```
#!/usr/bin/env python3
"""
飞书自动采集器

输入同事姓名，自动：
  1. 搜索飞书用户，获取 user_id
  2. 找到与他共同的群聊，拉取他的消息记录
  3. 拉取私聊消息（需要 user_access_token）
  4. 搜索他创建/编辑的文档和 Wiki
  5. 拉取文档内容
  6. 拉取多维表格（如有）
  7. 输出统一格式，直接进入 Distilly 分析流程

前置：
  python3 feishu_auto_collector.py --setup   # 配置 App ID / Secret（一次性）

私聊采集（需额外步骤）：
  1. 飞书应用开通用户权限：im:message, im:chat
  2. 获取 OAuth 授权码：
     浏览器打开: https://open.feishu.cn/open-apis/authen/v1/authorize?app_id={APP_ID}&redirect_uri=http://www.example.com&scope=im:message%20im:chat
     授权后从地址栏复制 code
  3. 换取 token：
     python3 feishu_auto_collector.py --exchange-code {CODE}
  4. 采集时指定私聊 chat_id：
     python3 feishu_auto_collector.py --name "张三" --p2p-chat-id oc_xxx

用法：
  # 群聊采集（原有方式）
  python3 feishu_auto_collector.py --name "张三" --output-dir ./knowledge/zhangsan
  python3 feishu_auto_collector.py --name "张三" --msg-limit 1000 --doc-limit 20

  # 私聊采集
  python3 feishu_auto_collector.py --name "张三" --p2p-chat-id oc_xxx

  # 直接指定 open_id + 私聊（跳过用户搜索）
  python3 feishu_auto_collector.py --open-id ou_xxx --p2p-chat-id oc_xxx --name "张三"

  # 换取 user_access_token
  python3 feishu_auto_collector.py --exchange-code {CODE}
"""

from __future__ import annotations

import json
import sys
import time
import argparse
from pathlib import Path
from datetime import datetime, timezone
from typing import Optional

try:
    import requests
except ImportError:
    print("错误：请先安装 requests：pip3 install requests", file=sys.stderr)
    sys.exit(1)


CONFIG_PATH = Path.home() / ".distilly" / "feishu_config.json"
LEGACY_CONFIG_PATH = Path.home() / ".colleague-skill" / "feishu_config.json"
BASE_URL = "https://open.feishu.cn/open-apis"


# ─── 配置 ────────────────────────────────────────────────────────────────────

def load_config() -> dict:
    config_path = CONFIG_PATH if CONFIG_PATH.exists() else LEGACY_CONFIG_PATH
    if not config_path.exists():
        print("未找到配置，请先运行：python3 feishu_auto_collector.py --setup", file=sys.stderr)
        sys.exit(1)
    return json.loads(config_path.read_text())


def save_config(config: dict) -> None:
    CONFIG_PATH.parent.mkdir(parents=True, exist_ok=True)
    CONFIG_PATH.write_text(json.dumps(config, indent=2, ensure_ascii=False))
    CONFIG_PATH.chmod(0o600)


def setup_config() -> None:
    print("=== 飞书自动采集配置 ===\n")
    print("请前往 https://open.feishu.cn 创建企业自建应用，开通以下权限：")
    print()
    print("  消息类（应用权限，用于群聊采集）：")
    print("    im:message:readonly          读取消息")
    print("    im:chat:readonly             读取群聊信息")
    print("    im:chat.members:readonly     读取群成员")
    print()
    print("  消息类（用户权限，用于私聊采集）：")
    print("    im:message                   以用户身份读取/发送消息")
    print("    im:chat                      以用户身份读取会话列表")
    print()
    print("  用户类：")
    print("    contact:user.base:readonly       读取用户基本信息")
    print("    contact:department.base:readonly  遍历部门查找用户（按姓名搜索必需）")
    print()
    print("  文档类：")
    print("    docs:doc:readonly            读取文档")
    print("    wiki:wiki:readonly           读取知识库")
    print("    drive:drive:readonly         搜索云盘文件")
    print()
    print("  多维表格：")
    print("    bitable:app:readonly         读取多维表格")
    print()
    print("  ─── 私聊采集说明 ───")
    print("  私聊消息必须通过 user_access_token 获取（应用身份无权访问私聊）。")
    print("  获取方式：OAuth 授权，授权链接格式：")
    print("    https://open.feishu.cn/open-apis/authen/v1/authorize?app_id={APP_ID}&redirect_uri={REDIRECT}&scope=im:message%20im:chat")
    print("  授权后从回调 URL 中取 code，用 --exchange-code 换取 token。")
    print()

    app_id = input("App ID (cli_xxx): ").strip()
    app_secret = input("App Secret: ").strip()

    config = {"app_id": app_id, "app_secret": app_secret}

    print("\n是否配置 user_access_token？（用于私聊消息采集，可跳过）")
    user_token = input("user_access_token (留空跳过): ").strip()
    if user_token:
        config["user_access_token"] = user_token
    p2p_chat_id = input("私聊 chat_id (留空跳过): ").strip()
    if p2p_chat_id:
        config["p2p_chat_id"] = p2p_chat_id

    save_config(config)
    print(f"\n✅ 配置已保存到 {CONFIG_PATH}")


# ─── Token ───────────────────────────────────────────────────────────────────

_token_cache: dict = {}


def get_tenant_token(config: dict) -> str:
    """获取 tenant_access_token，带缓存（有效期约 2 小时）"""
    now = time.time()
    if _token_cache.get("token") and _token_cache.get("expire", 0) > now + 60:
        return _token_cache["token"]

    resp = requests.post(
        f"{BASE_URL}/auth/v3/tenant_access_token/internal",
        json={"app_id": config["app_id"], "app_secret": config["app_secret"]},
        timeout=10,
    )
    data = resp.json()
    if data.get("code") != 0:
        print(f"获取 token 失败：{data}", file=sys.stderr)
        sys.exit(1)

    token = data["tenant_access_token"]
    _token_cache["token"] = token
    _token_cache["expire"] = now + data.get("expire", 7200)
    return token


def api_get(path: str, params: dict, config: dict, use_user_token: bool = False) -> dict:
    if use_user_token and config.get("user_access_token"):
        token = config["user_access_token"]
    else:
        token = get_tenant_token(config)
    resp = requests.get(
        f"{BASE_URL}{path}",
        params=params,
        headers={"Authorization": f"Bearer {token}"},
        timeout=15,
    )
    return resp.json()


def api_post(path: str, body: dict, config: dict, use_user_token: bool = False) -> dict:
    if use_user_token and config.get("user_access_token"):
        token = config["user_access_token"]
    else:
        token = get_tenant_token(config)
    resp = requests.post(
        f"{BASE_URL}{path}",
        json=body,
        headers={"Authorization": f"Bearer {token}"},
        timeout=15,
    )
    return resp.json()


def exchange_code_for_token(code: str, config: dict) -> dict:
    """用 OAuth 授权码换取 user_access_token"""
    app_token = get_tenant_token(config)
    resp = requests.post(
        f"{BASE_URL}/authen/v1/oidc/access_token",
        headers={"Authorization": f"Bearer {app_token}"},
        json={"grant_type": "authorization_code", "code": code},
        timeout=10,
    )
    data = resp.json()
    if data.get("code") != 0:
        print(f"换取 token 失败：{data}", file=sys.stderr)
        return {}
    return data.get("data", {})


# ─── 用户搜索 ─────────────────────────────────────────────────────────────────

def _find_user_by_contact(name: str, config: dict) -> Optional[dict]:
    """通过邮箱或手机号查找用户（使用 tenant_access_token）"""
    # 判断输入类型
    emails, mobiles = [], []
    if "@" in name:
        emails = [name]
    elif name.replace("+", "").replace("-", "").isdigit():
        mobiles = [name]
    else:
        return None  # 不是邮箱或手机号，跳过

    body = {}
    if emails:
        body["emails"] = emails
    if mobiles:
        body["mobiles"] = mobiles

    data = api_post("/contact/v3/users/batch_get_id", body, config)
    if data.get("code") != 0:
        print(f"  邮箱/手机号查找失败（code={data.get('code')}）：{data.get('msg')}", file=sys.stderr)
        return None

    user_list = data.get("data", {}).get("user_list", [])
    for item in user_list:
        user_id = item.get("user_id")
        if user_id:
            # 获取用户详情
            detail = api_get(f"/contact/v3/users/{user_id}", {"user_id_type": "user_id"}, config)
            if detail.get("code") == 0:
                user_data = detail.get("data", {}).get("user", {})
                print(f"  找到用户：{user_data.get('name', user_id)}", file=sys.stderr)
                return user_data
            # 如果详情拉不到，返回基本信息
            return {"user_id": user_id, "open_id": item.get("open_id", ""), "name": name}

    return None


def _find_user_by_department(name: str, config: dict) -> Optional[dict]:
    """遍历部门查找用户（使用 tenant_access_token，需要 contact:department.base:readonly）"""
    print(f"  通过部门遍历查找 {name} ...", file=sys.stderr)

    # 递归获取所有部门 ID
    dept_ids = ["0"]  # 0 = 根部门
    queue = ["0"]
    while queue:
        parent_id = queue.pop(0)
        data = api_get(
            f"/contact/v3/departments/{parent_id}/children",
            {"page_size": 50, "fetch_child": False},
            config,
        )
        if data.get("code") != 0:
            if parent_id == "0":
                print(f"  部门遍历失败（code={data.get('code')}）：{data.get('msg')}", file=sys.stderr)
                print(f"  请确认已开通 contact:department.base:readonly 权限", file=sys.stderr)
                return None
            continue

        children = data.get("data", {}).get("items", [])
        for child in children:
            child_id = child.get("department_id", "")
            if child_id:
                dept_ids.append(child_id)
                queue.append(child_id)

    print(f"  共 {len(dept_ids)} 个部门，搜索用户 ...", file=sys.stderr)

    # 在每个部门中查找用户
    matches = []
    for dept_id in dept_ids:
        page_token = None
        while True:
            params = {"department_id": dept_id, "page_size": 50}
            if page_token:
                params["page_token"] = page_token

            data = api_get("/contact/v3/users/find_by_department", params, config)
            if data.get("code") != 0:
                break

            users = data.get("data", {}).get("items", [])
            for u in users:
                uname = u.get("name", "")
                en_name = u.get("en_name", "")
                if name in uname or name in en_name or uname == name or en_name == name:
                    matches.append(u)

            if not data.get("data", {}).get("has_more"):
                break
            page_token = data.get("data", {}).get("page_token")

        if len(matches) >= 10:
            break  # 够了

    return _select_user(matches, name)


def _select_user(users: list, name: str) -> Optional[dict]:
    """从候选列表中选择用户"""
    if not users:
        print(f"  未找到用户：{name}", file=sys.stderr)
        return None

    # 去重（按 user_id）
    seen = set()
    deduped = []
    for u in users:
        uid = u.get("user_id", u.get("open_id", id(u)))
        if uid not in seen:
            seen.add(uid)
            deduped.append(u)
    users = 
```

### Core Architecture Module: `tools/feishu_browser.py`
```
#!/usr/bin/env python3
"""
飞书浏览器抓取器（Playwright 方案）

复用本机 Chrome 登录态，无需任何 token，能访问你有权限的所有飞书内容。

支持：
  - 飞书文档（docx/docs）
  - 飞书知识库（wiki）
  - 飞书表格（sheets）→ 导出为 CSV
  - 飞书消息记录（指定群聊）

安装：
  pip install playwright
  playwright install chromium

用法：
  python3 feishu_browser.py --url "https://xxx.feishu.cn/wiki/xxx" --output out.txt
  python3 feishu_browser.py --url "https://xxx.feishu.cn/docx/xxx" --output out.txt
  python3 feishu_browser.py --chat "后端组" --target "张三" --limit 500 --output out.txt
  python3 feishu_browser.py --url "https://xxx.feishu.cn/sheets/xxx" --output out.csv
"""

from __future__ import annotations

import sys
import time
import json
import argparse
import platform
from pathlib import Path
from typing import Optional


def get_default_chrome_profile() -> str:
    """根据操作系统返回 Chrome 默认 Profile 路径"""
    system = platform.system()
    if system == "Darwin":
        return str(Path.home() / "Library/Application Support/Google/Chrome/Default")
    elif system == "Linux":
        return str(Path.home() / ".config/google-chrome/Default")
    elif system == "Windows":
        import os
        return str(Path(os.environ.get("LOCALAPPDATA", "")) / "Google/Chrome/User Data/Default")
    return str(Path.home() / ".config/google-chrome/Default")


def make_context(playwright, chrome_profile: Optional[str], headless: bool):
    """创建复用登录态的浏览器上下文"""
    profile = chrome_profile or get_default_chrome_profile()
    try:
        ctx = playwright.chromium.launch_persistent_context(
            user_data_dir=profile,
            headless=headless,
            args=[
                "--disable-blink-features=AutomationControlled",
                "--no-first-run",
                "--no-default-browser-check",
            ],
            ignore_default_args=["--enable-automation"],
            viewport={"width": 1280, "height": 900},
        )
        return ctx
    except Exception as e:
        print(f"⚠️  无法加载 Chrome Profile：{e}", file=sys.stderr)
        print(f"   尝试的路径：{profile}", file=sys.stderr)
        print("   请用 --chrome-profile 手动指定路径", file=sys.stderr)
        sys.exit(1)


def detect_page_type(url: str) -> str:
    """根据 URL 判断飞书页面类型"""
    if "/wiki/" in url:
        return "wiki"
    elif "/docx/" in url or "/docs/" in url:
        return "doc"
    elif "/sheets/" in url or "/spreadsheets/" in url:
        return "sheet"
    elif "/base/" in url:
        return "base"
    else:
        return "unknown"


def fetch_doc(page, url: str) -> str:
    """抓取飞书文档或 Wiki 的文本内容"""
    page.goto(url, wait_until="domcontentloaded", timeout=30000)

    # 等待编辑器加载（飞书文档渲染较慢）
    selectors = [
        ".docs-reader-content",
        ".lark-editor-content",
        "[data-block-type]",
        ".doc-render-core",
        ".wiki-content",
        ".node-doc-content",
    ]

    loaded = False
    for sel in selectors:
        try:
            page.wait_for_selector(sel, timeout=15000)
            loaded = True
            break
        except Exception:
            continue

    if not loaded:
        # 等待一段时间后直接提取 body 文本
        time.sleep(5)

    # 额外等待异步内容渲染
    time.sleep(2)

    # 尝试多个选择器提取正文
    for sel in selectors:
        try:
            el = page.query_selector(sel)
            if el:
                text = el.inner_text()
                if len(text.strip()) > 50:
                    return text.strip()
        except Exception:
            continue

    # fallback：提取整个 body
    text = page.inner_text("body")
    return text.strip()


def fetch_sheet(page, url: str) -> str:
    """抓取飞书表格，转为 CSV 格式"""
    page.goto(url, wait_until="domcontentloaded", timeout=30000)

    try:
        page.wait_for_selector(".spreadsheet-container, .sheet-container", timeout=15000)
    except Exception:
        time.sleep(5)

    time.sleep(3)

    # 通过 JS 提取表格数据
    data = page.evaluate("""
        () => {
            const rows = [];
            // 尝试从 DOM 提取可见单元格
            const cells = document.querySelectorAll('[data-row][data-col]');
            if (cells.length === 0) return null;

            const grid = {};
            let maxRow = 0, maxCol = 0;
            cells.forEach(cell => {
                const r = parseInt(cell.getAttribute('data-row'));
                const c = parseInt(cell.getAttribute('data-col'));
                if (!grid[r]) grid[r] = {};
                grid[r][c] = cell.innerText.replace(/\\n/g, ' ').trim();
                maxRow = Math.max(maxRow, r);
                maxCol = Math.max(maxCol, c);
            });

            for (let r = 0; r <= maxRow; r++) {
                const row = [];
                for (let c = 0; c <= maxCol; c++) {
                    row.push(grid[r] && grid[r][c] ? grid[r][c] : '');
                }
                rows.push(row);
            }
            return rows;
        }
    """)

    if data:
        lines = []
        for row in data:
            lines.append(",".join(f'"{cell}"' for cell in row))
        return "\n".join(lines)

    # fallback：直接提取文本
    return page.inner_text("body")


def fetch_messages(page, chat_name: str, target_name: str, limit: int = 500) -> str:
    """
    抓取指定群聊中目标人物的消息记录。
    需要先导航到飞书 Web 版消息页面。
    """
    # 打开飞书消息页
    page.goto("https://applink.feishu.cn/client/chat/open", wait_until="domcontentloaded", timeout=20000)
    time.sleep(3)

    # 尝试搜索群聊
    try:
        # 点击搜索
        search_btn = page.query_selector('[data-test-id="search-btn"], .search-button, [placeholder*="搜索"]')
        if search_btn:
            search_btn.click()
            time.sleep(1)
            page.keyboard.type(chat_name)
            time.sleep(2)

            # 选择第一个结果
            result = page.query_selector('.search-result-item:first-child, .im-search-item:first-child')
            if result:
                result.click()
                time.sleep(2)
    except Exception as e:
        print(f"⚠️  自动搜索群聊失败：{e}", file=sys.stderr)
        print(f"   请手动导航到「{chat_name}」群聊，然后按回车继续...", file=sys.stderr)
        input()

    # 向上滚动加载历史消息
    print(f"正在加载消息历史...", file=sys.stderr)
    messages_container = page.query_selector('.message-list, .im-message-list, [data-testid="message-list"]')

    if messages_container:
        for _ in range(10):  # 滚动 10 次
            page.evaluate("el => el.scrollTop = 0", messages_container)
            time.sleep(1.5)
    else:
        for _ in range(10):
            page.keyboard.press("Control+Home")
            time.sleep(1.5)

    time.sleep(2)

    # 提取消息
    messages = page.evaluate(f"""
        () => {{
            const target = "{target_name}";
            const results = [];

            // 常见的消息 DOM 结构
            const msgSelectors = [
                '.message-item',
                '.im-message-item',
                '[data-message-id]',
                '.msg-list-item',
            ];

            let items = [];
            for (const sel of msgSelectors) {{
                items = document.querySelectorAll(sel);
                if (items.length > 0) break;
            }}

            items.forEach(item => {{
                const senderEl = item.querySelector(
                    '.sender-name, .message-sender, [data-testid="sender-name"], .name'
                );
                const contentEl = item.querySelector(
                    '.message-content, .msg-content, [data-testid="message-content"], .text-content'
                );
                const timeEl = item.querySelector(
                    '.message-time, .msg-time, [data-testid="message-time"], .time'
                );

                const sender = senderEl ? senderEl.innerText.trim() : '';
                const content = contentEl ? contentEl.innerText.trim() : '';
                const time = timeEl ? timeEl.innerText.trim() : '';

                if (!content) return;
                if (target && !sender.includes(target)) return;

                results.push({{ sender, content, time }});
            }});

            return results.slice(-{limit});
        }}
    """)

    if not messages:
        print("⚠️  未能自动提取消息，尝试提取页面文本", file=sys.stderr)
        return page.inner_text("body")

    # 按权重分类输出
    long_msgs = [m for m in messages if len(m.get("content", "")) > 50]
    short_msgs = [m for m in messages if len(m.get("content", "")) <= 50]

    lines = [
        f"# 飞书消息记录（浏览器抓取）",
        f"群聊：{chat_name}",
        f"目标人物：{target_name}",
        f"共 {len(messages)} 条消息",
        "",
        "---",
        "",
        "## 长消息（观点/决策类）",
        "",
    ]
    for m in long_msgs:
        lines.append(f"[{m.get('time', '')}] {m.get('content', '')}")
        lines.append("")

    lines += ["---", "", "## 日常消息", ""]
    for m in short_msgs[:200]:
        lines.append(f"[{m.get('time', '')}] {m.get('content', '')}")

    return "\n".join(lines)


def main() -> None:
    parser = argparse.ArgumentParser(description="飞书浏览器抓取器（复用 Chrome 登录态）")
    parser.add_argument("--url", help="飞书文档/Wiki/表格链接")
    parser.add_argument("--chat", help="群聊名称（抓取消息记录时使用）")
    parser.add_argument("--target", help="目标人物姓名（只提取此人的消息）")
    parser.add_argument("--limit", type=int, default=500, help="最多抓取消息条数（默认 500）")
    parser.add_argument("--output", default=None, help="输出文件路径（默认打印到 stdout）")
    parser.add_argument("--chrome-profile", default=None, help="Chrome Profile 路径（默认自动检测）")
    parser.add_argument("--headless", action="store_true", help="无头模式（不显示浏览器窗口）")
    parser.add_argument("--show-browser", action="store_true", help="显示浏览器窗口（调试用）")

    args = parser.parse_args()

    if not args.url and not args.chat:
        parser.error("请提供 --url（文档链接）或 --chat（群聊名称）")

    try:
        from playwright.sync_api import sync_playwright
    except ImportError:
        print("错误：请先安装 Playwright：pip install playwright && playwright install chromium", file=sys.stderr)
        sys.exit(1)

    headless = args.headless and not args.show_browser

    print(f"启动浏览器（{'无头' if headless else '有界面'}模式）...", file=sys.stderr)

    with sync_playwright() as p:
   
```

### Core Architecture Module: `tools/feishu_mcp_client.py`
```
#!/usr/bin/env python3
"""
飞书 MCP 客户端封装（cso1z/Feishu-MCP 方案）

通过 Feishu MCP Server 读取文档、wiki、消息记录。
适合：公司已授权的文档、有 App token 权限的内容。

前置要求：
  1. 安装 Feishu MCP：npm install -g feishu-mcp
  2. 配置 App ID 和 App Secret（飞书开放平台创建企业自建应用）
  3. 给应用开通必要权限（见下方 REQUIRED_PERMISSIONS）

权限列表（飞书开放平台 → 权限管理 → 开通）：
  - docs:doc:readonly          读取文档
  - wiki:wiki:readonly         读取知识库
  - im:message:readonly        读取消息
  - bitable:app:readonly       读取多维表格
  - sheets:spreadsheet:readonly 读取表格

用法：
  # 配置 token（一次性）
  python3 feishu_mcp_client.py --setup

  # 读取文档
  python3 feishu_mcp_client.py --url "https://xxx.feishu.cn/wiki/xxx" --output out.txt

  # 读取消息记录
  python3 feishu_mcp_client.py --chat-id "oc_xxx" --target "张三" --output out.txt

  # 列出某空间下的所有文档
  python3 feishu_mcp_client.py --list-wiki --space-id "xxx"
"""

from __future__ import annotations

import os
import sys
import json
import argparse
import subprocess
from pathlib import Path
from typing import Optional


CONFIG_PATH = Path.home() / ".distilly" / "feishu_config.json"
LEGACY_CONFIG_PATH = Path.home() / ".colleague-skill" / "feishu_config.json"


# ─── 配置管理 ────────────────────────────────────────────────────────────────

def load_config() -> dict:
    if CONFIG_PATH.exists():
        return json.loads(CONFIG_PATH.read_text())
    if LEGACY_CONFIG_PATH.exists():
        return json.loads(LEGACY_CONFIG_PATH.read_text())
    return {}


def save_config(config: dict) -> None:
    CONFIG_PATH.parent.mkdir(parents=True, exist_ok=True)
    CONFIG_PATH.write_text(json.dumps(config, indent=2))
    CONFIG_PATH.chmod(0o600)
    print(f"配置已保存到 {CONFIG_PATH}")


def setup_config() -> None:
    print("=== 飞书 MCP 配置 ===")
    print("请前往飞书开放平台（open.feishu.cn）创建企业自建应用，获取以下信息：\n")

    app_id = input("App ID (cli_xxx): ").strip()
    app_secret = input("App Secret: ").strip()

    print("\n配置方式选择：")
    print("  [1] App Token（应用权限，需要在飞书后台开通对应权限）")
    print("  [2] User Token（个人权限，能访问你本人有权限的所有内容，需要定期刷新）")
    mode = input("选择 [1/2]，默认 1：").strip() or "1"

    config = {
        "app_id": app_id,
        "app_secret": app_secret,
        "mode": "app" if mode == "1" else "user",
    }

    if mode == "2":
        print("\n获取 User Token：飞书开放平台 → OAuth 2.0 → 获取 user_access_token")
        user_token = input("User Access Token (u-xxx)：").strip()
        config["user_token"] = user_token
        print("注意：User Token 有效期约 2 小时，过期后需要重新配置")

    save_config(config)
    print("\n✅ 配置完成！")


# ─── MCP 调用封装 ─────────────────────────────────────────────────────────────

def call_mcp(tool: str, params: dict, config: dict) -> dict:
    """
    通过 npx 调用 feishu-mcp 工具。
    feishu-mcp 支持 stdio 模式，直接 JSON 通信。
    """
    env = os.environ.copy()
    env["FEISHU_APP_ID"] = config.get("app_id", "")
    env["FEISHU_APP_SECRET"] = config.get("app_secret", "")

    if config.get("mode") == "user" and config.get("user_token"):
        env["FEISHU_USER_ACCESS_TOKEN"] = config["user_token"]

    payload = json.dumps({
        "jsonrpc": "2.0",
        "method": "tools/call",
        "params": {
            "name": tool,
            "arguments": params,
        },
        "id": 1,
    })

    try:
        result = subprocess.run(
            ["npx", "-y", "feishu-mcp", "--stdio"],
            input=payload,
            capture_output=True,
            text=True,
            env=env,
            timeout=30,
        )
        if result.returncode != 0:
            raise RuntimeError(f"MCP 调用失败：{result.stderr}")
        return json.loads(result.stdout)
    except FileNotFoundError:
        print("错误：未找到 npx，请先安装 Node.js", file=sys.stderr)
        print("安装 Feishu MCP：npm install -g feishu-mcp", file=sys.stderr)
        sys.exit(1)


def extract_doc_token(url: str) -> tuple[str, str]:
    """从飞书 URL 中提取文档 token 和类型"""
    import re
    patterns = [
        (r"/wiki/([A-Za-z0-9]+)", "wiki"),
        (r"/docx/([A-Za-z0-9]+)", "docx"),
        (r"/docs/([A-Za-z0-9]+)", "doc"),
        (r"/sheets/([A-Za-z0-9]+)", "sheet"),
        (r"/base/([A-Za-z0-9]+)", "base"),
    ]
    for pattern, doc_type in patterns:
        m = re.search(pattern, url)
        if m:
            return m.group(1), doc_type
    raise ValueError(f"无法从 URL 解析文档 token：{url}")


# ─── 功能函数 ─────────────────────────────────────────────────────────────────

def fetch_doc_via_mcp(url: str, config: dict) -> str:
    """通过 MCP 读取飞书文档或 Wiki"""
    token, doc_type = extract_doc_token(url)

    if doc_type == "wiki":
        result = call_mcp("get_wiki_node", {"token": token}, config)
    elif doc_type in ("docx", "doc"):
        result = call_mcp("get_doc_content", {"doc_token": token}, config)
    elif doc_type == "sheet":
        result = call_mcp("get_spreadsheet_content", {"spreadsheet_token": token}, config)
    else:
        raise ValueError(f"不支持的文档类型：{doc_type}")

    # 提取 MCP 返回的内容
    if "result" in result:
        content = result["result"]
        if isinstance(content, list):
            # MCP tool result 格式
            for item in content:
                if isinstance(item, dict) and item.get("type") == "text":
                    return item.get("text", "")
        elif isinstance(content, str):
            return content
    elif "error" in result:
        raise RuntimeError(f"MCP 返回错误：{result['error']}")

    return json.dumps(result, ensure_ascii=False, indent=2)


def fetch_messages_via_mcp(
    chat_id: str,
    target_name: str,
    limit: int,
    config: dict,
) -> str:
    """通过 MCP 读取群聊消息记录"""
    result = call_mcp(
        "get_chat_messages",
        {
            "chat_id": chat_id,
            "page_size": min(limit, 50),  # 飞书 API 单次最多 50 条
        },
        config,
    )

    messages = []
    raw = result.get("result", [])
    if isinstance(raw, list):
        messages = raw
    elif isinstance(raw, str):
        try:
            messages = json.loads(raw)
        except Exception:
            return raw

    # 过滤目标人物
    if target_name:
        messages = [
            m for m in messages
            if target_name in str(m.get("sender", {}).get("name", ""))
        ]

    # 分类输出
    long_msgs = [m for m in messages if len(str(m.get("content", ""))) > 50]
    short_msgs = [m for m in messages if len(str(m.get("content", ""))) <= 50]

    lines = [
        "# 飞书消息记录（MCP 方案）",
        f"群聊 ID：{chat_id}",
        f"目标人物：{target_name or '全部'}",
        f"共 {len(messages)} 条",
        "",
        "---",
        "",
        "## 长消息",
        "",
    ]
    for m in long_msgs:
        sender = m.get("sender", {}).get("name", "")
        content = m.get("content", "")
        ts = m.get("create_time", "")
        lines.append(f"[{ts}] {sender}：{content}")
        lines.append("")

    lines += ["---", "", "## 日常消息", ""]
    for m in short_msgs[:200]:
        sender = m.get("sender", {}).get("name", "")
        content = m.get("content", "")
        lines.append(f"{sender}：{content}")

    return "\n".join(lines)


def list_wiki_docs(space_id: str, config: dict) -> str:
    """列出知识库空间下的所有文档"""
    result = call_mcp("list_wiki_nodes", {"space_id": space_id}, config)
    raw = result.get("result", "")
    if isinstance(raw, str):
        return raw
    return json.dumps(raw, ensure_ascii=False, indent=2)


# ─── CLI ─────────────────────────────────────────────────────────────────────

def main() -> None:
    parser = argparse.ArgumentParser(description="飞书 MCP 客户端")
    parser.add_argument("--setup", action="store_true", help="初始化配置（App ID / Secret）")
    parser.add_argument("--url", help="飞书文档/Wiki/表格链接")
    parser.add_argument("--chat-id", help="群聊 ID（oc_xxx 格式）")
    parser.add_argument("--target", help="目标人物姓名")
    parser.add_argument("--limit", type=int, default=500, help="最多获取消息数")
    parser.add_argument("--list-wiki", action="store_true", help="列出知识库文档")
    parser.add_argument("--space-id", help="知识库 Space ID")
    parser.add_argument("--output", default=None, help="输出文件路径")

    args = parser.parse_args()

    if args.setup:
        setup_config()
        return

    config = load_config()
    if not config:
        print("错误：尚未配置，请先运行：python3 feishu_mcp_client.py --setup", file=sys.stderr)
        sys.exit(1)

    content = ""

    if args.url:
        print(f"通过 MCP 读取：{args.url}", file=sys.stderr)
        content = fetch_doc_via_mcp(args.url, config)

    elif args.chat_id:
        print(f"通过 MCP 读取消息：{args.chat_id}", file=sys.stderr)
        content = fetch_messages_via_mcp(
            args.chat_id,
            args.target or "",
            args.limit,
            config,
        )

    elif args.list_wiki:
        if not args.space_id:
            print("错误：--list-wiki 需要 --space-id", file=sys.stderr)
            sys.exit(1)
        content = list_wiki_docs(args.space_id, config)

    else:
        parser.print_help()
        return

    if args.output:
        Path(args.output).write_text(content, encoding="utf-8")
        print(f"✅ 已保存到 {args.output}", file=sys.stderr)
    else:
        print(content)


if __name__ == "__main__":
    main()

```

### Core Architecture Module: `tools/feishu_parser.py`
```
#!/usr/bin/env python3
"""
飞书消息导出 JSON 解析器

支持的导出格式：
1. 飞书官方导出（群聊记录）：通常为 JSON 数组，每条消息包含 sender、content、timestamp
2. 手动整理的 TXT 格式（每行：时间 发送人：内容）

用法：
    python feishu_parser.py --file messages.json --target "张三" --output output.txt
    python feishu_parser.py --file messages.txt --target "张三" --output output.txt
"""

import json
import re
import sys
import argparse
from pathlib import Path
from datetime import datetime


def parse_feishu_json(file_path: str, target_name: str) -> list[dict]:
    """解析飞书官方导出的 JSON 格式消息"""
    with open(file_path, "r", encoding="utf-8") as f:
        data = json.load(f)

    messages = []

    # 兼容多种 JSON 结构
    if isinstance(data, list):
        raw_messages = data
    elif isinstance(data, dict):
        # 可能在 data.messages 或 data.records 等字段下
        raw_messages = (
            data.get("messages")
            or data.get("records")
            or data.get("data")
            or []
        )
    else:
        return []

    for msg in raw_messages:
        sender = (
            msg.get("sender_name")
            or msg.get("sender")
            or msg.get("from")
            or msg.get("user_name")
            or ""
        )
        content = (
            msg.get("content")
            or msg.get("text")
            or msg.get("message")
            or msg.get("body")
            or ""
        )
        timestamp = (
            msg.get("timestamp")
            or msg.get("create_time")
            or msg.get("time")
            or ""
        )

        # content 可能是嵌套结构
        if isinstance(content, dict):
            content = content.get("text") or content.get("content") or str(content)
        if isinstance(content, list):
            content = " ".join(
                c.get("text", "") if isinstance(c, dict) else str(c)
                for c in content
            )

        # 过滤：只保留目标人发送的消息
        if target_name and target_name not in str(sender):
            continue

        # 过滤：跳过系统消息、表情包、撤回消息
        if not content or content.strip() in ["[图片]", "[文件]", "[撤回了一条消息]", "[语音]"]:
            continue

        messages.append({
            "sender": str(sender),
            "content": str(content).strip(),
            "timestamp": str(timestamp),
        })

    return messages


def parse_feishu_txt(file_path: str, target_name: str) -> list[dict]:
    """解析手动整理的 TXT 格式消息（格式：时间 发送人：内容）"""
    messages = []

    with open(file_path, "r", encoding="utf-8") as f:
        lines = f.readlines()

    # 匹配格式：2024-01-01 10:00 张三：消息内容
    pattern = re.compile(
        r"^(?P<time>\d{4}[-/]\d{1,2}[-/]\d{1,2}[\s\d:]*)\s+(?P<sender>.+?)[:：]\s*(?P<content>.+)$"
    )

    for line in lines:
        line = line.strip()
        if not line:
            continue

        m = pattern.match(line)
        if m:
            sender = m.group("sender").strip()
            content = m.group("content").strip()
            timestamp = m.group("time").strip()

            if target_name and target_name not in sender:
                continue
            if not content:
                continue

            messages.append({
                "sender": sender,
                "content": content,
                "timestamp": timestamp,
            })
        else:
            # 没有匹配格式，检查是否包含目标人名
            if target_name and target_name in line:
                messages.append({
                    "sender": target_name,
                    "content": line,
                    "timestamp": "",
                })

    return messages


def extract_key_content(messages: list[dict]) -> dict:
    """
    对消息进行分类提取，区分：
    - 长消息（>50字）：可能包含观点、方案、技术判断
    - 决策类回复：包含"同意""不行""觉得""建议"等关键词
    - 日常沟通：其他消息
    """
    long_messages = []
    decision_messages = []
    daily_messages = []

    decision_keywords = [
        "同意", "不行", "觉得", "建议", "应该", "不应该", "可以", "不可以",
        "方案", "思路", "考虑", "决定", "确认", "拒绝", "推进", "暂缓",
        "没问题", "有问题", "风险", "评估", "判断"
    ]

    for msg in messages:
        content = msg["content"]

        if len(content) > 50:
            long_messages.append(msg)
        elif any(kw in content for kw in decision_keywords):
            decision_messages.append(msg)
        else:
            daily_messages.append(msg)

    return {
        "long_messages": long_messages,
        "decision_messages": decision_messages,
        "daily_messages": daily_messages,
        "total_count": len(messages),
    }


def format_output(target_name: str, extracted: dict) -> str:
    """格式化输出，供 AI 分析使用"""
    lines = [
        f"# 飞书消息提取结果",
        f"目标人物：{target_name}",
        f"总消息数：{extracted['total_count']}",
        "",
        "---",
        "",
        "## 长消息（观点/方案类，权重最高）",
        "",
    ]

    for msg in extracted["long_messages"]:
        ts = f"[{msg['timestamp']}] " if msg["timestamp"] else ""
        lines.append(f"{ts}{msg['content']}")
        lines.append("")

    lines += [
        "---",
        "",
        "## 决策类回复",
        "",
    ]

    for msg in extracted["decision_messages"]:
        ts = f"[{msg['timestamp']}] " if msg["timestamp"] else ""
        lines.append(f"{ts}{msg['content']}")
        lines.append("")

    lines += [
        "---",
        "",
        "## 日常沟通（风格参考）",
        "",
    ]

    # 日常消息只取前 100 条，避免太长
    for msg in extracted["daily_messages"][:100]:
        ts = f"[{msg['timestamp']}] " if msg["timestamp"] else ""
        lines.append(f"{ts}{msg['content']}")

    return "\n".join(lines)


def main():
    parser = argparse.ArgumentParser(description="解析飞书消息导出文件")
    parser.add_argument("--file", required=True, help="输入文件路径（.json 或 .txt）")
    parser.add_argument("--target", required=True, help="目标人物姓名（只提取此人发出的消息）")
    parser.add_argument("--output", default=None, help="输出文件路径（默认打印到 stdout）")

    args = parser.parse_args()

    file_path = Path(args.file)
    if not file_path.exists():
        print(f"错误：文件不存在 {file_path}", file=sys.stderr)
        sys.exit(1)

    # 根据文件类型选择解析器
    if file_path.suffix.lower() == ".json":
        messages = parse_feishu_json(str(file_path), args.target)
    else:
        messages = parse_feishu_txt(str(file_path), args.target)

    if not messages:
        print(f"警告：未找到 '{args.target}' 发出的消息", file=sys.stderr)
        print("提示：请检查目标姓名是否与文件中的发送人名称一致", file=sys.stderr)

    extracted = extract_key_content(messages)
    output = format_output(args.target, extracted)

    if args.output:
        with open(args.output, "w", encoding="utf-8") as f:
            f.write(output)
        print(f"已输出到 {args.output}，共 {len(messages)} 条消息")
    else:
        print(output)


if __name__ == "__main__":
    main()

```

### Core Architecture Module: `tools/install_claude_generated_skill.py`
```
#!/usr/bin/env python3
"""Install a generated Distilly artifact into Claude Code discovery paths."""

from __future__ import annotations

import argparse
import platform
from pathlib import Path

from install_generated_skill_common import (
    render_installed_markdown,
    install_generated_skill as install_generated_skill_common,
    load_generated_meta,
)


def default_claude_skills_dir() -> Path:
    """Return the default Claude Code skills directory."""
    return Path.home() / ".claude" / "skills"


def default_claude_commands_dir() -> Path:
    """Return the default Claude Code commands directory."""
    return Path.home() / ".claude" / "commands"


def should_install_command_shim(system_name: str | None = None) -> bool:
    """Return whether a slash-command shim should be installed."""
    current = (system_name or platform.system()).lower()
    return current.startswith("win")


def install_generated_skill(
    skill_dir: Path,
    skills_dir: Path,
    commands_dir: Path | None = None,
    *,
    force: bool = False,
    dry_run: bool = False,
    install_command_shim: bool = False,
) -> dict:
    """Install a generated combined skill into Claude Code skill directories."""
    result = install_generated_skill_common(
        skill_dir,
        skills_dir,
        force=force,
        dry_run=dry_run,
        host="claude-code",
    )
    command_path = None if commands_dir is None else commands_dir / f"{result['command_name']}.md"

    if not dry_run and install_command_shim and command_path is not None:
        meta = load_generated_meta(skill_dir)
        artifacts = meta["artifacts"]
        installed_markdown = render_installed_markdown(
            skill_dir,
            artifacts["combined_skill"],
            result["command_name"],
        )
        command_path.parent.mkdir(parents=True, exist_ok=True)
        command_path.write_text(installed_markdown, encoding="utf-8")

    return {
        **result,
        "command_path": command_path,
        "command_shim_installed": bool(install_command_shim and command_path is not None),
    }


def main() -> None:
    parser = argparse.ArgumentParser(description="Install a generated Distilly skill into Claude Code")
    parser.add_argument("--skill-dir", required=True, help="Generated skill directory")
    parser.add_argument(
        "--claude-skills-dir",
        default=str(default_claude_skills_dir()),
        help="Target Claude Code skills directory",
    )
    parser.add_argument(
        "--claude-commands-dir",
        default=str(default_claude_commands_dir()),
        help="Target Claude Code commands directory",
    )
    parser.add_argument("--force", action="store_true", help="Overwrite an existing installed skill")
    parser.add_argument("--dry-run", action="store_true", help="Resolve install paths without writing files")
    parser.add_argument(
        "--install-command-shim",
        action="store_true",
        help="Also install a slash-command markdown file under ~/.claude/commands",
    )
    args = parser.parse_args()

    command_shim = args.install_command_shim or should_install_command_shim()
    result = install_generated_skill(
        Path(args.skill_dir).expanduser(),
        Path(args.claude_skills_dir).expanduser(),
        commands_dir=Path(args.claude_commands_dir).expanduser(),
        force=args.force,
        dry_run=args.dry_run,
        install_command_shim=command_shim,
    )
    print(result["command_name"])
    print(result["skill_dir"])
    if result["command_shim_installed"] and result["command_path"] is not None:
        print(result["command_path"])


if __name__ == "__main__":
    main()

```

### Core Architecture Module: `tools/install_codex_generated_skill.py`
```
#!/usr/bin/env python3
"""Install a generated Distilly artifact into Codex discovery paths."""

from __future__ import annotations

import argparse
from pathlib import Path

from install_generated_skill_common import install_generated_skill as install_generated_skill_common


def default_codex_skills_dir() -> Path:
    """Return the default Codex skills directory."""
    return Path.home() / ".agents" / "skills"


def install_generated_skill(
    skill_dir: Path,
    skills_dir: Path,
    *,
    force: bool = False,
    dry_run: bool = False,
) -> dict:
    """Install a generated combined skill into Codex skill directories."""
    return install_generated_skill_common(
        skill_dir,
        skills_dir,
        force=force,
        dry_run=dry_run,
        host="codex",
    )


def main() -> None:
    parser = argparse.ArgumentParser(description="Install a generated Distilly skill into Codex")
    parser.add_argument("--skill-dir", required=True, help="Generated skill directory")
    parser.add_argument(
        "--codex-skills-dir",
        default=str(default_codex_skills_dir()),
        help="Target Codex skills directory",
    )
    parser.add_argument("--force", action="store_true", help="Overwrite an existing installed skill")
    parser.add_argument("--dry-run", action="store_true", help="Resolve install paths without writing files")
    args = parser.parse_args()

    result = install_generated_skill(
        Path(args.skill_dir).expanduser(),
        Path(args.codex_skills_dir).expanduser(),
        force=args.force,
        dry_run=args.dry_run,
    )
    print(result["command_name"])
    print(result["skill_dir"])


if __name__ == "__main__":
    main()

```

### Core Architecture Module: `tools/install_codex_skill.py`
```
#!/usr/bin/env python3
"""Install the current Distilly repo into the local Codex skill directory."""

from __future__ import annotations

import argparse
import shutil
from pathlib import Path


IGNORE_NAMES = shutil.ignore_patterns(".git", "__pycache__", ".DS_Store", "*.pyc")


def install_skill(source: Path, destination: Path, force: bool = False, dry_run: bool = False) -> Path:
    """Copy the repo into the Codex local skill directory."""
    if not (source / "SKILL.md").exists():
        raise FileNotFoundError(f"source does not look like a skill repo: {source}")

    source_root = source.resolve()
    destination_root = destination.resolve()
    if source_root == destination_root:
        return destination
    if source_root in destination_root.parents or destination_root in source_root.parents:
        raise ValueError("source and destination must not overlap")

    if dry_run:
        return destination

    if destination.exists():
        if not force:
            raise FileExistsError(f"destination already exists: {destination}")
        shutil.rmtree(destination)

    destination.parent.mkdir(parents=True, exist_ok=True)
    shutil.copytree(source, destination, ignore=IGNORE_NAMES)
    return destination


def main() -> None:
    parser = argparse.ArgumentParser(description="Install Distilly into Codex")
    parser.add_argument(
        "--source",
        default=str(Path(__file__).resolve().parents[1]),
        help="Source skill repo root",
    )
    parser.add_argument(
        "--dest",
        default=str(Path.home() / ".agents" / "skills" / "distilly"),
        help="Destination Codex skill directory",
    )
    parser.add_argument("--force", action="store_true", help="Overwrite the destination if needed")
    parser.add_argument("--dry-run", action="store_true", help="Print the install target without copying")
    args = parser.parse_args()

    destination = install_skill(
        Path(args.source).expanduser(),
        Path(args.dest).expanduser(),
        force=args.force,
        dry_run=args.dry_run,
    )
    print(destination)


if __name__ == "__main__":
    main()

```

### Core Architecture Module: `tools/install_generated_skill.py`
```
#!/usr/bin/env python3
"""Install a generated Distilly skill into a supported host discovery path."""

from __future__ import annotations

import argparse
from collections.abc import Mapping
import os
from pathlib import Path

from install_generated_skill_common import install_generated_skill


HOST_DEFAULT_PARTS = {
    "claude-code": (".claude", "skills"),
    "openclaw": (".openclaw", "workspace", "skills"),
    "hermes": (".hermes", "skills", "distilly-generated"),
    "codex": (".agents", "skills"),
    "deepseek-harness": (".dsh", "skills"),
    "pi": (".pi", "agent", "skills"),
    "grok-build": (".grok", "skills"),
    "opencode": (".config", "opencode", "skills"),
}


def default_skills_dir(
    host: str,
    home: Path | None = None,
    environ: Mapping[str, str] | None = None,
) -> Path:
    """Return the user-level skill root for a supported host."""
    environment = os.environ if environ is None else environ
    if host == "deepseek-harness" and environment.get("DSH_HOME"):
        return Path(environment["DSH_HOME"]).expanduser() / "skills"
    try:
        parts = HOST_DEFAULT_PARTS[host]
    except KeyError as error:
        raise ValueError(f"unsupported host: {host}") from error
    return (home or Path.home()).joinpath(*parts)


def main() -> None:
    parser = argparse.ArgumentParser(
        description=(
            "Install only a generated skill's self-contained SKILL.md, rewriting "
            "legacy frontmatter to its canonical command name"
        )
    )
    parser.add_argument("--skill-dir", required=True, help="Generated skill directory")
    parser.add_argument("--host", required=True, choices=sorted(HOST_DEFAULT_PARTS))
    parser.add_argument(
        "--skills-dir",
        help="Override the host skill root (the canonical command directory is appended)",
    )
    parser.add_argument("--force", action="store_true", help="Overwrite an existing installed copy")
    parser.add_argument("--dry-run", action="store_true", help="Resolve install paths without writing files")
    args = parser.parse_args()

    skills_dir = (
        Path(args.skills_dir).expanduser()
        if args.skills_dir
        else default_skills_dir(args.host)
    )
    result = install_generated_skill(
        Path(args.skill_dir).expanduser(),
        skills_dir,
        force=args.force,
        dry_run=args.dry_run,
        host=args.host,
    )
    print(result["command_name"])
    print(result["skill_dir"])


if __name__ == "__main__":
    main()

```

### Core Architecture Module: `tools/install_generated_skill_common.py`
```
#!/usr/bin/env python3
"""Shared helpers for installing generated Distilly artifacts into host skill roots."""

from __future__ import annotations

import json
import re
import shutil
from pathlib import Path

from skill_schema import enrich_existing_skill_meta, now_iso


FRONTMATTER_RE = re.compile(r"\A---\n(.*?)\n---\n?", re.DOTALL)


def load_generated_meta(skill_dir: Path) -> dict:
    """Load and normalize generated skill metadata from a skill directory."""
    meta_path = skill_dir / "meta.json"
    if not meta_path.exists():
        raise FileNotFoundError(f"generated skill is missing meta.json: {skill_dir}")
    return enrich_existing_skill_meta(
        json.loads(meta_path.read_text(encoding="utf-8")),
        skill_dir,
    )


def rewrite_frontmatter_name(markdown: str, new_name: str) -> str:
    """Rewrite the frontmatter name field to the installed command name."""
    match = FRONTMATTER_RE.match(markdown)
    if not match:
        return markdown

    body = markdown[match.end():]
    lines = match.group(1).splitlines()
    rewritten: list[str] = []
    replaced = False

    for line in lines:
        if line.startswith("name:"):
            rewritten.append(f"name: {new_name}")
            replaced = True
        else:
            rewritten.append(line)

    if not replaced:
        rewritten.insert(0, f"name: {new_name}")

    return "---\n" + "\n".join(rewritten) + "\n---\n\n" + body.lstrip("\n")


def render_installed_markdown(skill_dir: Path, artifact_name: str, command_name: str) -> str:
    """Load a generated artifact and rewrite it for host installation."""
    artifact_path = skill_dir / artifact_name
    if not artifact_path.exists():
        raise FileNotFoundError(f"generated artifact not found: {artifact_path}")
    return rewrite_frontmatter_name(
        artifact_path.read_text(encoding="utf-8"),
        command_name,
    )


def write_install_metadata(install_dir: Path, payload: dict) -> None:
    """Persist installation metadata for later debugging and upgrades."""
    (install_dir / ".distilly-install.json").write_text(
        json.dumps(payload, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )


def install_generated_skill(
    skill_dir: Path,
    skills_dir: Path,
    *,
    force: bool = False,
    dry_run: bool = False,
    host: str,
) -> dict:
    """Install a generated combined skill into a host skill directory."""
    meta = load_generated_meta(skill_dir)
    artifacts = meta["artifacts"]
    command_name = artifacts["combined_command"]
    installed_markdown = render_installed_markdown(
        skill_dir,
        artifacts["combined_skill"],
        command_name,
    )

    install_dir = skills_dir / command_name
    install_file = install_dir / "SKILL.md"

    source_root = skill_dir.resolve()
    install_root = install_dir.resolve()
    if (
        source_root == install_root
        or source_root in install_root.parents
        or install_root in source_root.parents
    ):
        raise ValueError(
            "generated skill source and install destination must not overlap: "
            f"{skill_dir} -> {install_dir}"
        )

    install_record = {
        "host": host,
        "command_name": command_name,
        "character": meta["character"],
        "slug": meta["slug"],
        "version": meta["version"],
        "source_skill_dir": str(skill_dir),
        "source_artifact": artifacts["combined_skill"],
        "installed_at": now_iso(),
    }

    if not dry_run:
        if install_dir.exists():
            if not force:
                raise FileExistsError(f"{host} skill already exists: {install_dir}")
            shutil.rmtree(install_dir)

        install_dir.mkdir(parents=True, exist_ok=True)
        install_file.write_text(installed_markdown, encoding="utf-8")
        write_install_metadata(install_dir, install_record)

    return {
        "host": host,
        "command_name": command_name,
        "skill_dir": install_dir,
        "skill_file": install_file,
    }

```

### Core Architecture Module: `tools/install_hermes_skill.py`
```
#!/usr/bin/env python3
"""Install the current Distilly repo into the local Hermes skill directory."""

from __future__ import annotations

import argparse
import shutil
from pathlib import Path


IGNORE_NAMES = shutil.ignore_patterns(".git", "__pycache__", ".DS_Store", "*.pyc")


def install_skill(source: Path, destination: Path, force: bool = False, dry_run: bool = False) -> Path:
    """Copy the repo into the Hermes local skill directory."""
    if not (source / "SKILL.md").exists():
        raise FileNotFoundError(f"source does not look like a skill repo: {source}")

    source_root = source.resolve()
    destination_root = destination.resolve()
    if source_root == destination_root:
        return destination
    if source_root in destination_root.parents or destination_root in source_root.parents:
        raise ValueError("source and destination must not overlap")

    if dry_run:
        return destination

    if destination.exists():
        if not force:
            raise FileExistsError(f"destination already exists: {destination}")
        shutil.rmtree(destination)

    destination.parent.mkdir(parents=True, exist_ok=True)
    shutil.copytree(source, destination, ignore=IGNORE_NAMES)
    return destination


def main() -> None:
    parser = argparse.ArgumentParser(description="Install Distilly into Hermes")
    parser.add_argument(
        "--source",
        default=str(Path(__file__).resolve().parents[1]),
        help="Source skill repo root",
    )
    parser.add_argument(
        "--dest",
        default=str(Path.home() / ".hermes" / "skills" / "openclaw-imports" / "distilly"),
        help="Destination Hermes skill directory",
    )
    parser.add_argument("--force", action="store_true", help="Overwrite the destination if needed")
    parser.add_argument("--dry-run", action="store_true", help="Print the install target without copying")
    args = parser.parse_args()

    destination = install_skill(
        Path(args.source).expanduser(),
        Path(args.dest).expanduser(),
        force=args.force,
        dry_run=args.dry_run,
    )
    print(destination)


if __name__ == "__main__":
    main()

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #123** (2026-05-25): **[Reminder] 1 day left to claim ~500 USDT reward – Your project ranked #5 on OpenArena**
  *Symptoms*: Hi 👋  A Hunter has submitted your project to the OpenArena leaderboard, and it is currently ranked #5.  You may be eligible to claim a reward, including approximately 500 USDT and a 1-month Claude Max membership.  Please check the details and claim process here:  Tweet: https://x.com/amber_ac_/status/2045879720231809522?s=46 Official page: https://openarena.to/en/prize-pool

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

### Incident Patch 1: `629563a9` (2026-08-25)
**Commit Message**: build: publish Distilly as a GitHub package

**File**: `.github/workflows/publish-package.yml` (added, +28/-0)
```diff
@@ -0,0 +1,28 @@
+name: Publish GitHub Package
+
+on:
+  workflow_dispatch:
+
+permissions:
+  contents: read
+  packages: write
+
+jobs:
+  publish:
+    runs-on: ubuntu-latest
+    steps:
+      - uses: actions/checkout@v4
+
+      - uses: actions/setup-node@v4
+        with:
+          node-version: "20"
+          registry-url: https://npm.pkg.github.com
+          scope: "@titanwings"
+
+      - name: Verify package contents
+        run: npm pack --dry-run
+
+      - name: Publish package
+        run: npm publish
+        env:
+          NODE_AUTH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

**File**: `.npmrc` (added, +1/-0)
```diff
@@ -0,0 +1 @@
+@titanwings:registry=https://npm.pkg.github.com
```

**File**: `bin/distilly.mjs` (added, +204/-0)
```diff
@@ -0,0 +1,204 @@
+#!/usr/bin/env node
+
+import {
+  cpSync,
+  existsSync,
+  mkdirSync,
+  readFileSync,
+  renameSync,
+  rmSync,
+} from "node:fs";
+import { homedir } from "node:os";
+import { basename, dirname, join, parse, resolve } from "node:path";
+import { fileURLToPath } from "node:url";
+
+const packageRoot = fileURLToPath(new URL("..", import.meta.url));
+const packageMetadata = JSON.parse(
+  readFileSync(join(packageRoot, "package.json"), "utf8"),
+);
+
+const payloadEntries = [
+  "SKILL.md",
+  "prompts",
+  "references",
+  "tools",
+  "requirements.txt",
+  "INSTALL.md",
+  "INSTALL_EN.md",
+  "LICENSE",
+  "CITATION.cff",
+];
+
+const hosts = {
+  "claude-code": () => join(homedir(), ".claude", "skills", "distilly"),
+  openclaw: () =>
+    join(homedir(), ".openclaw", "workspace", "skills", "distilly"),
+  hermes: () =>
+    join(homedir(), ".hermes", "skills", "openclaw-imports", "distilly"),
+  codex: () => join(homedir(), ".agents", "skills", "distilly"),
+  "deepseek-harness": () =>
+    join(process.env.DSH_HOME || join(homedir(), ".dsh"), "skills", "distilly"),
+  pi: () => join(homedir(), ".pi", "agent", "skills", "distilly"),
+  "grok-build": () => join(homedir(), ".grok", "skills", "distilly"),
+  opencode: () =>
+    join(homedir(), ".config", "opencode", "skills", "distilly"),
+};
+
+const aliases = {
+  claude: "claude-code",
+  deepseek: "deepseek-harness",
+  grok: "grok-build",
+};
+
+function printHelp() {
+  console.log(`Distilly ${packageMetadata.version}
+
+Install the Distilly creator Skill into a supported agent host.
+
+Usage:
+  distilly install <host> [--force]
+  distilly install --path <path-ending-in-distilly> [--force]
+
+Hosts:
+  claude-code, openclaw, hermes, codex, deepseek-harness,
+  pi, grok-build, opencode
+
+Options:
+  --force    Preserve an existing install as a timestamped backup, then install
+  --path     Install to a custom path whose final directory is named distilly
+  --version  Print the package version
+  --help     Show this help
+`);
+}
+
+function fail(message) {
+  console.error(`Error: ${message}`);
+  process.exit(1);
+}
+
+function validatePayload() {
+  const missing = payloadEntries.filter(
+    (entry) => !existsSync(join(packageRoot, entry)),
+  );
+  if (missing.length > 0) {
+    fail(`package payload is missing: ${missing.join(", ")}`);
+  }
+
+  const skill = readFileSync(join(packageRoot, "SKILL.md"), "utf8");
+  if (!skill.includes(`version: "${packageMetadata.version}"`)) {
+    fail("package.json version does not match SKILL.md");
+  }
+}
+
+function expandHome(inputPath) {
+  if (inputPath === "~") return homedir();
+  if (inputPath.startsWith("~/")) return join(homedir(), inputPath.slice(2));
+  return inputPath;
+}
+
+function validateTarget(inputPath) {
+  const target = resolve(expandHome(inputPath));
+  const parsed = parse(target);
+  if (target === parsed.root || target === resolve(homedir())) {
+    fail("refusing to install into a filesystem root or home directory");
+  }
+  if (basename(target) !== "distilly") {
+    fail("the install path must end with a directory named distilly");
+  }
+  return target;
+}
+
+function parseInstallArgs(args) {
+  let host;
+  let customPath;
+  let force = false;
+
+  for (let index = 0; index < args.length; index += 1) {
+    const arg = args[index];
+    if (arg === "--force") {
+      force = true;
+    } else if (arg === "--path") {
+      customPath = args[index + 1];
+      if (!customPath) fail("--path requires a value");
+      index += 1;
+    } else if (arg.startsWith("--")) {
+      fail(`unknown option: ${arg}`);
+    } else if (!host) {
+      host = aliases[arg] || arg;
+    } else {
+      fail(`unexpected argument: ${arg}`);
+    }
+  }
+
+  if (customPath) return { target: validateTarget(customPath), force };
+  if (!host) fail("choose a host or pass --path");
+  if (!hosts[host]) fail(`unsupported host: ${host}`);
+  return { target: validateTarget(hosts[host]()), force };
+}
+
+function timestamp() {
+  return new Date().toISOString().replaceAll(":", "-").replaceAll(".", "-");
+}
+
+function install(target, force) {
+  validatePayload();
+
+  if (existsSync(target) && !force) {
+    fail(`${target} already exists; rerun with --force to preserve and replace it`);
+  }
+
+  const parent = dirname(target);
+  const staging = join(parent, `.distilly-install-${process.pid}`);
+  let backup;
+
+  mkdirSync(parent, { recursive: true });
+  if (existsSync(staging)) {
+    fail(`temporary install path already exists: ${staging}`);
+  }
+
+  try {
+    mkdirSync(staging);
+    for (const entry of payloadEntries) {
+      cpSync(join(packageRoot, entry), join(staging, entry), {
+        recursive: true,
+        preserveTimestamps: true,
+      });
+    }
+
+    if (!existsSync(join(staging, "SKILL.md"))) {
+      throw new Error("staged install does not contain SKILL.md");
+    }
+
+    if (existsSync(target)) {
+      backup = `${target}.backup-${timestamp()}`;
+ 
```

**File**: `package.json` (added, +49/-0)
```diff
@@ -0,0 +1,49 @@
+{
+  "name": "@titanwings/distilly",
+  "version": "1.0.0",
+  "description": "Distill source material into reusable Person Profiles for AI agents.",
+  "type": "module",
+  "bin": {
+    "distilly": "bin/distilly.mjs"
+  },
+  "files": [
+    "bin/",
+    "SKILL.md",
+    "prompts/",
+    "references/",
+    "tools/",
+    "requirements.txt",
+    "INSTALL.md",
+    "INSTALL_EN.md",
+    "LICENSE",
+    "CITATION.cff"
+  ],
+  "scripts": {
+    "prepack": "node bin/distilly.mjs --check-package"
+  },
+  "keywords": [
+    "ai",
+    "agent",
+    "agent-skill",
+    "codex",
+    "distillation",
+    "person-profile",
+    "persona"
+  ],
+  "author": "titanwings",
+  "license": "MIT",
+  "repository": {
+    "type": "git",
+    "url": "git+https://github.com/titanwings/distilly.git"
+  },
+  "homepage": "https://github.com/titanwings/distilly#readme",
+  "bugs": {
+    "url": "https://github.com/titanwings/distilly/issues"
+  },
+  "engines": {
+    "node": ">=18"
+  },
+  "publishConfig": {
+    "registry": "https://npm.pkg.github.com"
+  }
+}
```

---

### Incident Patch 2: `70b99d05` (2026-08-24)
**Commit Message**: docs: simplify install and usage quick start

**File**: `INSTALL.md` (modified, +28/-9)
```diff
@@ -108,7 +108,10 @@ python3 tools/install_generated_skill.py \
 
 | 宿主 | `<host>` | 默认用户级目标 | 项目级 `--skills-dir` |
 |------|----------|----------------|----------------------|
+| Claude Code | `claude-code` | `~/.claude/skills/{character}-{slug}/SKILL.md` | `.claude/skills` |
+| OpenClaw | `openclaw` | `~/.openclaw/workspace/skills/{character}-{slug}/SKILL.md` | 自定义 Skills 目录 |
 | Hermes | `hermes` | `~/.hermes/skills/distilly-generated/{character}-{slug}/SKILL.md` | `.hermes/skills`（可信项目） |
+| Codex | `codex` | `~/.agents/skills/{character}-{slug}/SKILL.md` | `.agents/skills` |
 | DeepSeek Harness | `deepseek-harness` | `~/.dsh/skills/{character}-{slug}/SKILL.md` | `.dsh/skills` |
 | Pi coding agent | `pi` | `~/.pi/agent/skills/{character}-{slug}/SKILL.md` | `.pi/skills` |
 | Grok Build | `grok-build` | `~/.grok/skills/{character}-{slug}/SKILL.md` | `.grok/skills` |
@@ -263,19 +266,14 @@ Grok Bot 支持把书面流程或演示保存为 private Skill，然后在 Setti
 新配置统一写入 `~/.distilly/`。为了不破坏既有安装，当新配置不存在时，飞书、钉钉和 Slack 采集器仍会只读回退到 `~/.colleague-skill/`；之后再运行 `--setup` 会写入新目录。
 
 ```bash
-# 基础（Python 3.9+）
-pip3 install pypinyin        # 中文姓名转拼音 slug（可选但推荐）
+# 安装 requirements.txt 中声明的 Python 依赖（Python 3.9+）
+pip3 install -r requirements.txt
 
 # 飞书浏览器方案（内部文档/需要登录权限的文档）
-pip3 install playwright
 playwright install chromium  # 仅需安装 chromium，不需要完整 Chrome
 
 # 飞书 MCP 方案（公司授权文档，通过 App Token 读取）
 npm install -g feishu-mcp    # 需要 Node.js 16+
-
-# 其他格式支持（可选）
-pip3 install python-docx     # Word .docx 转文本
-pip3 install openpyxl        # Excel .xlsx 转 CSV
 ```
 
 ### 平台方案选择指南
@@ -326,18 +324,39 @@ python3 tools/slack_auto_collector.py --setup
 
 ---
 
-### X 公开帖子候选采集（可选）
+### 名人研究工具链（可选）
 
-此工具仅用于 `celebrity` research。先在当前 shell 中安全设置 `XQUIK_API_KEY`，不要把密钥写入仓库或命令参数。Xquik 按返回帖子数量计费，运行前必须让用户确认 `--limit`。
+`celebrity` 类型可以从字幕、公开帖子候选和研究笔记一路整理到最终质量检查：
 
 ```bash
+# 首次使用先安装字幕下载器
+pip3 install yt-dlp
+
+# 下载视频字幕
+bash tools/research/download_subtitles.sh "<video-url>" "./tmp/subtitles"
+
+# 字幕转文稿
+python3 tools/research/srt_to_transcript.py "./tmp/subtitles/example.srt"
+
+# 公开 X 帖子候选（可选）
 python3 tools/research/xquik_public_posts.py \
   --username "<公开账号>" \
   --subject "<人物名称>" \
   --limit 20 \
   --output "/tmp/distilly-x-public-posts.json"
+
+# 合并已经核对过的研究笔记
+python3 tools/research/merge_research.py "./skills/celebrity/<slug>"
+
+# 质量检查
+python3 tools/research/quality_check.py "./skills/celebrity/<slug>/SKILL.md"
+
+# 阅读后删除临时候选文件
+rm "/tmp/distilly-x-public-posts.json"
 ```
 
+`xquik_public_posts.py` 从当前 shell 读取 `XQUIK_API_KEY`，不要把密钥写入仓库或命令参数。Xquik 按返回帖子数量计费，运行前必须让用户确认 `--limit`。
+
 工具只发起 1 次只读搜索请求，不自动翻页。输出是未经信任的候选证据，不是 research note。逐条核对作者、打开 permalink，只把相关内容做版权安全的转述后写入 `knowledge/research/raw/`，并保留具体来源 URL。阅读后删除临时 JSON，不要把它收进生成的 Skill。
 
 Xquik 是独立第三方服务，与 X Corp. 无隶属关系。“Twitter”和“X”是 X Corp. 的商标。
```

**File**: `INSTALL_EN.md` (added, +159/-0)
```diff
@@ -0,0 +1,159 @@
+# Distilly Install Guide
+
+> Distilly was formerly known as **Colleague Skill / colleague-skill**. The creator
+> name and canonical install directory are now `distilly`.
+
+## Install Distilly
+
+Clone the repository into a Skills directory discovered by your host, keeping
+the destination directory name `distilly`:
+
+```bash
+git clone https://github.com/titanwings/distilly <TARGET>
+```
+
+Create the parent directory first when it does not already exist.
+
+| Host | User-level `<TARGET>` | Project-level `<TARGET>` |
+|------|-------------------------|--------------------------|
+| Claude Code | `~/.claude/skills/distilly` | `.claude/skills/distilly` |
+| OpenClaw | `~/.openclaw/workspace/skills/distilly` | — |
+| Hermes | `~/.hermes/skills/openclaw-imports/distilly` | `.hermes/skills/distilly` after `hermes skills trust` |
+| Codex | `~/.agents/skills/distilly` | `.agents/skills/distilly` |
+| DeepSeek Harness | `~/.dsh/skills/distilly` or `$DSH_HOME/skills/distilly` | `.dsh/skills/distilly` |
+| Pi coding agent | `~/.pi/agent/skills/distilly` or `~/.agents/skills/distilly` | — |
+| Grok Build | `~/.grok/skills/distilly` or `~/.agents/skills/distilly` | — |
+| OpenCode | `~/.config/opencode/skills/distilly` | `.opencode/skills/distilly` |
+
+From an existing clone, these host-specific installers can copy Distilly into
+the canonical OpenClaw, Hermes, or Codex user directory:
+
+```bash
+python3 tools/install_openclaw_skill.py --force
+python3 tools/install_hermes_skill.py --force
+python3 tools/install_codex_skill.py --force
+```
+
+Use `--dry-run` first to inspect the destination without writing files.
+
+## Existing-install migration
+
+A clone still named `dot-skill` is not renamed by `git pull`. The legacy Codex
+root `~/.codex/skills/` is also not migrated to `~/.agents/skills/`
+automatically.
+
+1. Keep the old copy as a fallback.
+2. Install a new canonical copy at the `distilly` target listed above, or run
+   the applicable repository installer.
+3. Verify that the host discovers the new copy.
+4. Decide manually whether to keep or remove the old directory. Distilly never
+   deletes it automatically.
+
+Read-only fallbacks for `~/.colleague-skill/` configuration and legacy profile
+metadata keep old data accessible; they do not rename a host install directory.
+
+## Install a generated Person Profile
+
+From the Distilly repository root, install a generated profile with:
+
+```bash
+python3 tools/install_generated_skill.py \
+  --skill-dir "skills/{character}/{slug}" \
+  --host <host> \
+  --force
+```
+
+| Host | `<host>` | Default Skills root |
+|------|----------|---------------------|
+| Claude Code | `claude-code` | `~/.claude/skills` |
+| OpenClaw | `openclaw` | `~/.openclaw/workspace/skills` |
+| Hermes | `hermes` | `~/.hermes/skills/distilly-generated` |
+| Codex | `codex` | `~/.agents/skills` |
+| DeepSeek Harness | `deepseek-harness` | `~/.dsh/skills` or `$DSH_HOME/skills` |
+| Pi coding agent | `pi` | `~/.pi/agent/skills` |
+| Grok Build | `grok-build` | `~/.grok/skills` |
+| OpenCode | `opencode` | `~/.config/opencode/skills` |
+
+Pass `--skills-dir <PATH>` to override the root for a project-level install.
+The installer writes only the self-contained `SKILL.md` and
+`.distilly-install.json`. It does not copy private source material from the
+generated directory, and it normalizes legacy underscore frontmatter only in
+the installed copy.
+
+On Windows, use the dedicated Claude Code installer when a command shim is
+needed:
+
+```bash
+python3 tools/install_claude_generated_skill.py \
+  --skill-dir "skills/{character}/{slug}" \
+  --install-command-shim \
+  --force
+```
+
+## Collector setup
+
+The collectors store new configuration under `~/.distilly/`. When no new
+configuration exists, they can read legacy configuration from
+`~/.colleague-skill/` without moving it.
+
+```bash
+# Install the declared Python dependencies
+pip3 install -r requirements.txt
+
+# Browser runtime used by DingTalk and Lark browser collection
+playwright install chromium
+
+# Lark-compatible collector
+python3 tools/feishu_auto_collector.py --setup
+
+# DingTalk collector
+python3 tools/dingtalk_auto_collector.py --setup
+
+# Slack collector
+python3 tools/slack_auto_collector.py --setup
+```
+
+The current Lark-compatible collector uses the China-region
+`open.feishu.cn` / `feishu.cn` endpoints. International `larksuite.com` tenant
+routing is not implemented yet. Never commit App secrets, OAuth tokens, or API
+keys to the repository.
+
+## Celebrity research pipeline
+
+The `celebrity` family includes an optional source-processing pipeline:
+
+```bash
+# Install the subtitle downloader once
+pip3 install yt-dlp
+
+# Download video subtitles
+bash tools/research/download_subtitles.sh "<video-url>" "./tmp/subtitles"
+
+# Convert subtitles to a transcript
+python3 tools/research/srt_to_transcript.py "./tmp/subtitles/example.srt"
+
+# Collect bounded public X post candidates (optio
```

**File**: `README.md` (modified, +15/-75)
```diff
@@ -152,99 +152,39 @@ Each generated Person Profile is packaged as an Agent Skill and can be installed
 
 ## ⚡ Install
 
-It's 2026 — you have an Agent, let it install itself. Open a supported local agent host and hand it this line:
+### 🤖 For Agents
 
-> Install Distilly for me: `https://github.com/titanwings/distilly`
+Open any supported local Agent host and send:
 
-The Agent should install the repository as a Skill named `distilly`, then verify that the host discovers Distilly.
+> Install Distilly from `https://github.com/titanwings/distilly`, then verify that this host can discover it.
 
-> **Upgrading an old install?** A `git pull` inside a `dot-skill` or legacy
-> `~/.codex/skills/...` directory does not rename that discovery directory.
-> Install a canonical `distilly` copy, verify that the host discovers Distilly, and only then
-> retire the old copy. See the [detailed install and migration guide](INSTALL.md#existing-install-migration).
+The Agent installs Distilly as a Skill named `distilly` in the correct host directory.
 
-<details>
-<summary><b>🛠️ Want to install it yourself? Click for paths</b></summary>
+### 👤 For Humans
 
-<br>
+Clone Distilly into the Skills directory used by your host:
 
 ```bash
-git clone https://github.com/titanwings/distilly <TARGET>
+git clone https://github.com/titanwings/distilly <DISTILLY_SKILL_DIR>
 ```
 
-| Host | `<TARGET>` path |
-|------|-----------------|
-| Claude Code | `~/.claude/skills/distilly` |
-| OpenClaw | `~/.openclaw/workspace/skills/distilly` |
-| Codex | `~/.agents/skills/distilly` (user) or `.agents/skills/distilly` (project) |
-| DeepSeek Harness | `~/.dsh/skills/distilly` (global) or `.dsh/skills/distilly` (project) |
-| Pi coding agent | `~/.pi/agent/skills/distilly` or `~/.agents/skills/distilly` |
-| Grok Build | `~/.grok/skills/distilly` or `~/.agents/skills/distilly` |
-| OpenCode | `~/.config/opencode/skills/distilly` (user) or `.opencode/skills/distilly` (project) |
-| Hermes | After clone, run `python3 tools/install_hermes_skill.py --force` |
-
-</details>
-
-Generated character Skills can be published with `tools/install_claude_generated_skill.py`,
-`tools/install_openclaw_generated_skill.py`, and `tools/install_codex_generated_skill.py`.
-For Hermes, DeepSeek Harness, Pi, Grok Build, and OpenCode, run
-`python3 tools/install_generated_skill.py --skill-dir "skills/{character}/{slug}" --host <host> --force`.
-The installer writes only the self-contained `SKILL.md` plus install metadata and
-normalizes legacy underscore frontmatter in the installed copy; it does not copy
-private source material or rename the source Skill. Pass `--skills-dir` for a
-project-level target. Hermes scans `~/.agents/skills` only when it is explicitly
-added to `skills.external_dirs`.
-
-> For Lark/DingTalk auto-collection credentials, host-specific installation details, Grok Bot's preview workflow, Windows-specific handling, etc., see **[Detailed Install Guide (INSTALL.md)](INSTALL.md)**
-
-> **Lark region note:** the current compatibility collector connects to the China-region `open.feishu.cn` / `feishu.cn` endpoints. International `larksuite.com` tenant routing is not implemented yet.
+Host paths, migration, Windows, generated-profile installation, and credential setup are in the **[Install Guide](INSTALL_EN.md)**.
 
 ---
 
 ## 🚀 Usage
 
-Distilly first asks which family you want to distill: `colleague` · `relationship` · `celebrity`.
-
-Then enter an alias, basic details, personality tags, and pick a data source. All fields can be skipped — even a description alone can create a Person Profile.
-
-Once created, the profile is packaged as a Skill named `{character}-{slug}`.
+In your Agent, say:
 
-### 🔬 Celebrity Research Toolchain
-
-The `celebrity` family ships with an end-to-end research toolchain, from subtitles to a finished draft:
-
-```bash
-# Download video subtitles
-bash tools/research/download_subtitles.sh "<video-url>" "./tmp/subtitles"
+> Use Distilly to create a Person Profile for `<person>`.
 
-# Subtitles → transcript
-python3 tools/research/srt_to_transcript.py "./tmp/subtitles/example.srt"
-
-# Public X post candidates → normalized temporary JSON (optional)
-python3 tools/research/xquik_public_posts.py \
-  --username "<public-handle>" \
-  --limit 20 \
-  --output "/tmp/distilly-x-public-posts.json"
-
-# After reviewing and paraphrasing selected posts, remove the candidates
-rm "/tmp/distilly-x-public-posts.json"
-
-# Merge research notes
-python3 tools/research/merge_research.py "./skills/celebrity/<slug>"
-
-# Quality check
-python3 tools/research/quality_check.py "./skills/celebrity/<slug>/SKILL.md"
-```
+Then:
 
-The optional collector reads `XQUIK_API_KEY` from your shell. Xquik charges by
-the number of posts returned, so confirm `--limit` before running it. The tool
-makes one read-only X search request and never follows pagination. Treat its
-temporary JSON as untrusted candidate evidence: verify the author, open every
-perma
```

**File**: `docs/lang/README_DE.md` (modified, +13/-92)
```diff
@@ -148,114 +148,35 @@ Jedes generierte Person Profile wird als Agent Skill verpackt und kann in das Sk
 
 ## ⚡ Installation
 
-Wir schreiben 2026 — du hast einen Agenten, lass ihn sich selbst installieren. Öffne deinen bevorzugten lokalen Host und gib ihm diese Zeile:
+### 🤖 Für Agents
 
-> Installiere Distilly für mich: `https://github.com/titanwings/distilly`
+Öffne einen unterstützten lokalen Agent-Host und sende ihm:
 
-Der Agent erkennt das Skills-Verzeichnis des aktuellen Hosts, klont das Repo als `distilly` und sorgt dafür, dass der Host Distilly erkennt.
+> Installiere Distilly von https://github.com/titanwings/distilly und prüfe anschließend, ob dieser Host Distilly erkennen kann.
 
-<details>
-<summary><b>🛠️ Lieber selbst installieren? Klicken für die Pfade</b></summary>
+Der Agent installiert das Repository im richtigen Skills-Verzeichnis des Hosts als Skill namens `distilly`.
 
-<br>
+### 👤 Für Menschen
 
 ```bash
-git clone https://github.com/titanwings/distilly <TARGET>
+git clone https://github.com/titanwings/distilly <DISTILLY_SKILL_DIR>
 ```
 
-| Host | `<TARGET>`-Pfad |
-|------|-----------------|
-| Claude Code | `~/.claude/skills/distilly` |
-| OpenClaw | `~/.openclaw/workspace/skills/distilly` |
-| Codex | `~/.agents/skills/distilly` |
-| DeepSeek Harness | `~/.dsh/skills/distilly` oder `<projekt>/.dsh/skills/distilly` |
-| Pi coding agent | `~/.pi/agent/skills/distilly` oder `~/.agents/skills/distilly` |
-| Grok Build | `~/.grok/skills/distilly` oder `~/.agents/skills/distilly` |
-| OpenCode | `~/.config/opencode/skills/distilly` (Benutzer) oder `.opencode/skills/distilly` (Projekt) |
-| Hermes | Nach dem Klonen `python3 tools/install_hermes_skill.py --force` ausführen |
-
-</details>
-
-> **Migration älterer Installationen:** Bei einem alten Clone namens `dot-skill` oder einem Clone unter dem früheren Codex-Pfad `~/.codex/skills` reicht `git pull` allein nicht aus, damit der Host den neuen Einstieg `distilly` zuverlässig erkennt. Führe im Stammverzeichnis des alten Clones den passenden Repo-Installer aus:
->
-> ```bash
-> python3 tools/install_openclaw_skill.py --force
-> python3 tools/install_codex_skill.py --force
-> python3 tools/install_hermes_skill.py --force
-> ```
->
-> Alternativ klonst du das Repository erneut in den oben für den Host angegebenen kanonischen `distilly`-Pfad. Prüfe zuerst, dass der Host Distilly erkennt, und behandle das alte Verzeichnis erst danach manuell; automatisches Löschen wird ausdrücklich nicht empfohlen. Legacy-Fallbacks für Konfiguration und Metadaten dienen nur der Kompatibilität mit alten Daten und benennen ein vorhandenes Installationsverzeichnis nicht automatisch um.
-
-> Für Lark/DingTalk-Zugangsdaten zur automatischen Erfassung, weitere Installationsdetails, den Preview-Status von Grok Bot und Kompatibilitätshinweise siehe **[Ausführliche Installationsanleitung (INSTALL.md)](../../INSTALL.md)**
+Host-spezifische Pfade, Migration, Windows-Hinweise, die Installation erzeugter Profiles und Zugangsdaten findest du in der **[ausführlichen Installationsanleitung (INSTALL_EN.md)](../../INSTALL_EN.md)**.
 
 ---
 
 ## 🚀 Nutzung
 
-Distilly fragt zunächst, welche Familie du destillieren willst: `colleague` · `relationship` · `celebrity`.
-
-Danach folgen Alias, Basisangaben, Persönlichkeits-Tags und die Wahl einer Datenquelle. Alle Felder können übersprungen werden — schon eine Beschreibung allein reicht, um ein Person Profile zu erstellen.
-
-Das erzeugte Profil wird als Skill namens `{character}-{slug}` verpackt.
-
-#### Erzeugten Skill mit dem einheitlichen Installer installieren
-
-Führe im Stammverzeichnis dieses Repositories aus:
-
-```bash
-python3 tools/install_generated_skill.py --skill-dir "skills/{character}/{slug}" --host <host> --force
-```
-
-Gültige Werte für `<host>` sind `hermes`, `deepseek-harness`, `pi`, `grok-build` und `opencode`. Standardmäßig erfolgt eine Installation auf Benutzerebene; für eine Installation im Projekt ergänze den passenden Parameter `--skills-dir`:
-
-| Host | Standard-Installationsverzeichnis | Projektparameter und Installationsverzeichnis |
-|------|-----------------------------------|-----------------------------------------------|
-| Hermes | `~/.hermes/skills/distilly-generated/{character}-{slug}/` | `--skills-dir ".hermes/skills"` → `.hermes/skills/{character}-{slug}/` |
-| DeepSeek Harness | `~/.dsh/skills/{character}-{slug}/` | `--skills-dir ".dsh/skills"` → `.dsh/skills/{character}-{slug}/` |
-| Pi coding agent | `~/.pi/agent/skills/{character}-{slug}/` | `--skills-dir ".pi/skills"` → `.pi/skills/{character}-{slug}/` |
-| Grok Build | `~/.grok/skills/{character}-{slug}/` | `--skills-dir ".grok/skills"` → `.grok/skills/{character}-{slug}/` |
-| OpenCode | `~/.config/opencode/skills/{character}-{slug}/` | `--skills-dir ".opencode/skills"` → `.opencode/skills/{character}-{slug}/` |
-
-Ein Hermes-Projekt muss mit `hermes skills trust` als vertrauenswürdig markiert werden. Starte nach der Installation ei
```

**File**: `docs/lang/README_EN.md` (modified, +15/-76)
```diff
@@ -152,100 +152,39 @@ Each generated Person Profile is packaged as an Agent Skill and can be installed
 
 ## ⚡ Install
 
-It's 2026 — you have an Agent, let it install itself. Open a supported local agent host and hand it this line:
+### 🤖 For Agents
 
-> Install Distilly for me: `https://github.com/titanwings/distilly`
+Open any supported local Agent host and send:
 
-The Agent should install the repository as a Skill named `distilly`, then verify that the host discovers Distilly.
+> Install Distilly from `https://github.com/titanwings/distilly`, then verify that this host can discover it.
 
-<details>
-<summary><b>🛠️ Want to install it yourself? Click for paths</b></summary>
+The Agent installs Distilly as a Skill named `distilly` in the correct host directory.
 
-<br>
-
-```bash
-git clone https://github.com/titanwings/distilly <TARGET>
-```
-
-| Host | `<TARGET>` path |
-|------|-----------------|
-| Claude Code | `~/.claude/skills/distilly` |
-| OpenClaw | `~/.openclaw/workspace/skills/distilly` |
-| Codex | `~/.agents/skills/distilly` (user) or `.agents/skills/distilly` (project) |
-| DeepSeek Harness | `~/.dsh/skills/distilly` (global) or `.dsh/skills/distilly` (project) |
-| Pi coding agent | `~/.pi/agent/skills/distilly` or `~/.agents/skills/distilly` |
-| Grok Build | `~/.grok/skills/distilly` or `~/.agents/skills/distilly` |
-| OpenCode | `~/.config/opencode/skills/distilly` (user) or `.opencode/skills/distilly` (project) |
-| Hermes | After clone, run `python3 tools/install_hermes_skill.py --force` |
-
-</details>
+### 👤 For Humans
 
-> **Migrating an existing install:** A clone still named `dot-skill`, or one left under the legacy `~/.codex/skills` root, is not guaranteed to expose the new `distilly` entrypoint after `git pull` alone. From the old clone's root, run the applicable repository installer (`tools/install_openclaw_skill.py`, `tools/install_codex_skill.py`, or `tools/install_hermes_skill.py`), or clone again into the canonical `distilly` path for that host shown above. Verify that the host discovers Distilly first, then decide manually how to handle the old directory; do not delete it automatically. Legacy config/meta fallbacks keep old data readable but do not rename an installed directory.
-
-Install a generated character Skill from the repository root with the unified installer:
+Clone Distilly into the Skills directory used by your host:
 
 ```bash
-python3 tools/install_generated_skill.py --skill-dir "skills/{character}/{slug}" --host <host> --force
+git clone https://github.com/titanwings/distilly <DISTILLY_SKILL_DIR>
 ```
 
-Valid `<host>` values are `hermes`, `deepseek-harness`, `pi`, `grok-build`, and `opencode`. The default is a user-level install; for a project-level install, add the corresponding `--skills-dir` override:
-
-| Host | Default installed directory | Project override and installed directory |
-|------|-----------------------------|------------------------------------------|
-| Hermes | `~/.hermes/skills/distilly-generated/{character}-{slug}/` | `--skills-dir ".hermes/skills"` → `.hermes/skills/{character}-{slug}/` |
-| DeepSeek Harness | `~/.dsh/skills/{character}-{slug}/` | `--skills-dir ".dsh/skills"` → `.dsh/skills/{character}-{slug}/` |
-| Pi coding agent | `~/.pi/agent/skills/{character}-{slug}/` | `--skills-dir ".pi/skills"` → `.pi/skills/{character}-{slug}/` |
-| Grok Build | `~/.grok/skills/{character}-{slug}/` | `--skills-dir ".grok/skills"` → `.grok/skills/{character}-{slug}/` |
-| OpenCode | `~/.config/opencode/skills/{character}-{slug}/` | `--skills-dir ".opencode/skills"` → `.opencode/skills/{character}-{slug}/` |
-
-The installer normalizes legacy underscore frontmatter to the canonical kebab-case `{character}-{slug}` only in the installed copy and leaves the source directory unchanged. The installed directory contains only the self-contained `SKILL.md` and `.distilly-install.json`; it never copies the generated directory's private source material.
-
-For a project-level Hermes install, first trust the project with `hermes skills trust`. After installing, start a new Hermes session or run `/reload-skills`. `~/.agents/skills` is not a Hermes default; Hermes uses it only when explicitly added to `skills.external_dirs`.
-
-> For Lark/DingTalk auto-collection credentials, host-specific installation details, Grok Bot's preview workflow, Windows-specific handling, etc., see **[Detailed Install Guide (INSTALL.md)](../../INSTALL.md)**
-
-> **Lark region note:** the current compatibility collector connects to the China-region `open.feishu.cn` / `feishu.cn` endpoints. International `larksuite.com` tenant routing is not implemented yet.
+Host paths, migration, Windows, generated-profile installation, and credential setup are in the **[Detailed Install Guide](../../INSTALL_EN.md)**.
 
 ---
 
 ## 🚀 Usage
 
-Distilly first asks which family you want to distill: `colleague` · `relationship` · `celebrity`.
-
-Then enter an alias, basic details, personality t
```

**File**: `docs/lang/README_ES.md` (modified, +13/-92)
```diff
@@ -148,114 +148,35 @@ Cada Person Profile generado se empaqueta como Agent Skill y puede colocarse en
 
 ## ⚡ Instalación
 
-Estamos en 2026 — tienes un Agent, deja que se instale solo. Abre tu host local preferido y pásale esta línea:
+### 🤖 Para Agents
 
-> Instálame Distilly: `https://github.com/titanwings/distilly`
+Abre un host local de Agent compatible y envíale:
 
-El Agent detectará el directorio de skills del host actual, clonará el repo como `distilly` y permitirá que el host descubra Distilly.
+> Instala Distilly desde https://github.com/titanwings/distilly y después verifica que este host pueda detectarlo.
 
-<details>
-<summary><b>🛠️ ¿Quieres instalarlo tú mismo? Haz clic para ver las rutas</b></summary>
+El Agent instalará el repositorio en el directorio de Skills correcto del host con el nombre `distilly`.
 
-<br>
+### 👤 Para personas
 
 ```bash
-git clone https://github.com/titanwings/distilly <TARGET>
+git clone https://github.com/titanwings/distilly <DISTILLY_SKILL_DIR>
 ```
 
-| Host | Ruta `<TARGET>` |
-|------|-----------------|
-| Claude Code | `~/.claude/skills/distilly` |
-| OpenClaw | `~/.openclaw/workspace/skills/distilly` |
-| Codex | `~/.agents/skills/distilly` |
-| DeepSeek Harness | `~/.dsh/skills/distilly` o `<proyecto>/.dsh/skills/distilly` |
-| Pi coding agent | `~/.pi/agent/skills/distilly` o `~/.agents/skills/distilly` |
-| Grok Build | `~/.grok/skills/distilly` o `~/.agents/skills/distilly` |
-| OpenCode | `~/.config/opencode/skills/distilly` (usuario) o `.opencode/skills/distilly` (proyecto) |
-| Hermes | Después del clone, ejecuta `python3 tools/install_hermes_skill.py --force` |
-
-</details>
-
-> **Migración de instalaciones anteriores:** Si tienes un clone antiguo llamado `dot-skill` o uno ubicado en la antigua ruta de Codex `~/.codex/skills`, ejecutar solo `git pull` no garantiza que el host descubra el nuevo punto de entrada `distilly`. Desde la raíz del clone anterior, ejecuta el instalador del repositorio que corresponda:
->
-> ```bash
-> python3 tools/install_openclaw_skill.py --force
-> python3 tools/install_codex_skill.py --force
-> python3 tools/install_hermes_skill.py --force
-> ```
->
-> Como alternativa, vuelve a clonar el repositorio en la ruta canónica `distilly` indicada arriba para ese host. Primero verifica que el host descubra Distilly; solo después gestiona manualmente el directorio anterior. No se recomienda borrarlo de forma automática. Los fallbacks legacy de configuración y metadatos solo mantienen la compatibilidad con datos anteriores y no cambian automáticamente el nombre del directorio de instalación.
-
-> Para credenciales de recolección automática de Lark/DingTalk, más detalles de instalación, el estado preview de Grok Bot y notas de compatibilidad, consulta la **[Guía de instalación detallada (INSTALL.md)](../../INSTALL.md)**
+Para conocer las rutas por host, la migración, Windows, la instalación de Profiles generados y las credenciales, consulta la **[guía de instalación detallada (INSTALL_EN.md)](../../INSTALL_EN.md)**.
 
 ---
 
 ## 🚀 Uso
 
-Distilly primero te pregunta qué familia quieres destilar: `colleague` · `relationship` · `celebrity`.
-
-Luego ingresa alias, datos básicos, etiquetas de personalidad y elige una fuente de datos. Todos los campos se pueden omitir — incluso una descripción por sí sola puede crear un Person Profile.
-
-El perfil se empaqueta como un Skill llamado `{character}-{slug}`.
-
-#### Instalar el Skill generado con el instalador unificado
-
-Ejecuta lo siguiente desde la raíz de este repositorio:
-
-```bash
-python3 tools/install_generated_skill.py --skill-dir "skills/{character}/{slug}" --host <host> --force
-```
-
-Los valores válidos de `<host>` son `hermes`, `deepseek-harness`, `pi`, `grok-build` y `opencode`. De forma predeterminada se instala a nivel de usuario; para instalar en el proyecto, agrega el `--skills-dir` correspondiente:
-
-| Host | Directorio de instalación predeterminado | Parámetro y directorio de instalación del proyecto |
-|------|-------------------------------------------|----------------------------------------------------|
-| Hermes | `~/.hermes/skills/distilly-generated/{character}-{slug}/` | `--skills-dir ".hermes/skills"` → `.hermes/skills/{character}-{slug}/` |
-| DeepSeek Harness | `~/.dsh/skills/{character}-{slug}/` | `--skills-dir ".dsh/skills"` → `.dsh/skills/{character}-{slug}/` |
-| Pi coding agent | `~/.pi/agent/skills/{character}-{slug}/` | `--skills-dir ".pi/skills"` → `.pi/skills/{character}-{slug}/` |
-| Grok Build | `~/.grok/skills/{character}-{slug}/` | `--skills-dir ".grok/skills"` → `.grok/skills/{character}-{slug}/` |
-| OpenCode | `~/.config/opencode/skills/{character}-{slug}/` | `--skills-dir ".opencode/skills"` → `.opencode/skills/{character}-{slug}/` |
-
-Un proyecto de Hermes debe marcarse como confiable con `hermes skills trust`. Tras la instalación, inicia una nueva sesión de Hermes o ejecuta `/reload-skills`.
-
-Hermes no busca `~/.agents/skills` de 
```

**File**: `docs/lang/README_JA.md` (modified, +14/-89)
```diff
@@ -148,112 +148,37 @@ Distilly は、8つのローカル Agent ホストに対応しています：
 
 ## ⚡ インストール
 
-いまは 2026 年——あなたには Agent がいます。自分でインストールさせましょう。お使いのローカルホストを開いて、この一行を渡してください：
+### 🤖 Agent 向け
 
-> Distilly をインストールして：`https://github.com/titanwings/distilly`
+対応するローカル Agent ホストを開き、次の一文を送ってください：
 
-Agent は現在のホストの skills ディレクトリを検出し、リポジトリを `distilly` として clone して、ホストが Distilly を検出できることを確認します。
+> `https://github.com/titanwings/distilly` から Distilly をインストールし、このホストが Distilly を検出できることを確認してください。
 
-<details>
-<summary><b>🛠️ 自分でインストールしたい？パスはこちら</b></summary>
+Agent は、現在のホストに適したディレクトリへ Skill 名 `distilly` でインストールします。
 
-<br>
+### 👤 手動でインストールする場合
 
 ```bash
-git clone https://github.com/titanwings/distilly <TARGET>
+git clone https://github.com/titanwings/distilly <DISTILLY_SKILL_DIR>
 ```
 
-| ホスト | `<TARGET>` パス |
-|------|-----------------|
-| Claude Code | `~/.claude/skills/distilly` |
-| OpenClaw | `~/.openclaw/workspace/skills/distilly` |
-| Codex | `~/.agents/skills/distilly` |
-| DeepSeek Harness | `~/.dsh/skills/distilly` または `<project>/.dsh/skills/distilly` |
-| Pi coding agent | `~/.pi/agent/skills/distilly` または `~/.agents/skills/distilly` |
-| Grok Build | `~/.grok/skills/distilly` または `~/.agents/skills/distilly` |
-| OpenCode | `~/.config/opencode/skills/distilly`（ユーザー）または `.opencode/skills/distilly`（プロジェクト） |
-| Hermes | clone 後に `python3 tools/install_hermes_skill.py --force` を実行 |
-
-</details>
-
-> **旧インストールからの移行：** `dot-skill` という名前の古い clone、または以前の Codex パス `~/.codex/skills` 配下にある clone は、`git pull` だけでは新しい `distilly` エントリをホストが確実に検出できません。古い clone のルートで、対象ホストに合うリポジトリ内インストーラーを実行してください：
->
-> ```bash
-> python3 tools/install_openclaw_skill.py --force
-> python3 tools/install_codex_skill.py --force
-> python3 tools/install_hermes_skill.py --force
-> ```
->
-> または、上の表にある対象ホストの canonical な `distilly` パスへリポジトリを clone し直します。まずホストが Distilly を検出できることを確認し、その後で古いディレクトリを手動で扱ってください。自動削除は推奨しません。設定やメタデータの legacy fallback は古いデータとの互換性だけを目的としており、既存のインストールディレクトリを自動的に改名するものではありません。
-
-> Lark/DingTalk 自動収集のクレデンシャル、各ホストへのインストール方法、Grok Bot の preview フロー、Windows の互換性情報などは **[詳細インストールガイド (INSTALL.md)](../../INSTALL.md)** を参照してください。
+ホストごとのパス、既存インストールの移行、Windows 対応、生成した Profile のインストール、収集用クレデンシャルについては、**[詳細インストールガイド (INSTALL_EN.md)](../../INSTALL_EN.md)** を参照してください。
 
 ---
 
 ## 🚀 使い方
 
-Distilly の作成フローでは、まずどのファミリーを蒸留するか聞かれます：`colleague`、`relationship`、`celebrity` のいずれか。
-
-次にニックネーム、基本情報、性格タグを入力し、データソースを選びます。すべての項目はスキップ可能——説明文だけでも Person Profile を生成できます。
-
-生成後、Profile は `{character}-{slug}` という名前の Skill としてパッケージ化され、対応する任意のホストにインストールできます。
-
-#### 統一インストーラーで生成済み Skill をインストールする
-
-このリポジトリのルートで次を実行します：
-
-```bash
-python3 tools/install_generated_skill.py --skill-dir "skills/{character}/{slug}" --host <host> --force
-```
-
-`<host>` に指定できる値は `hermes`、`deepseek-harness`、`pi`、`grok-build`、`opencode` です。デフォルトではユーザー単位でインストールされます。プロジェクト単位でインストールする場合は、対応する `--skills-dir` を追加します：
+Agent に次のように依頼してください：
 
-| ホスト | デフォルトのインストール先 | プロジェクト用パラメータとインストール先 |
-|--------|----------------------------|------------------------------------------|
-| Hermes | `~/.hermes/skills/distilly-generated/{character}-{slug}/` | `--skills-dir ".hermes/skills"` → `.hermes/skills/{character}-{slug}/` |
-| DeepSeek Harness | `~/.dsh/skills/{character}-{slug}/` | `--skills-dir ".dsh/skills"` → `.dsh/skills/{character}-{slug}/` |
-| Pi coding agent | `~/.pi/agent/skills/{character}-{slug}/` | `--skills-dir ".pi/skills"` → `.pi/skills/{character}-{slug}/` |
-| Grok Build | `~/.grok/skills/{character}-{slug}/` | `--skills-dir ".grok/skills"` → `.grok/skills/{character}-{slug}/` |
-| OpenCode | `~/.config/opencode/skills/{character}-{slug}/` | `--skills-dir ".opencode/skills"` → `.opencode/skills/{character}-{slug}/` |
+> Distilly を使って `<person>` の Person Profile を作成してください。
 
-Hermes のプロジェクトは `hermes skills trust` で trust する必要があります。インストール後は Hermes の新しいセッションを開始するか、`/reload-skills` を実行してください。
+1. `colleague`、`relationship`、`celebrity` から人物タイプを選びます。
+2. 説明や資料を渡します。入力項目はすべてスキップできます。
+3. 内容を確認してから Profile を生成します。
 
-Hermes はデフォルトでは `~/.agents/skills` を検索しません。Hermes でこのパスを使うのは、`skills.external_dirs` に明示的に設定した場合だけです。
+生成された Profile は、`{character}-{slug}` という名前の Agent Skill としてパッケージ化されます。
 
-インストーラーは、legacy のアンダースコア形式の frontmatter 名をインストール先のコピーだけで canonical kebab 形式の `{character}-{slug}` に正規化します。ソースディレクトリは変更しません。インストール先に入るのは自己完結型の `SKILL.md` と `.distilly-install.json` だけで、非公開の元素材はコピーされません。
-
-### 🔬 Celebrity Research Toolchain
-
-`celebrity` ファミリーには、字幕から完成稿までをカバーするエンドツーエンドのリサーチツールチェーンが同梱されています：
-
-公開 X 投稿の収集は任意です。API キーは環境変数 `XQUIK_API_KEY` からのみ読み込まれます。公開クエリは第三者サービス Xquik に送信され、返された投稿数に応じて課金され、credits を消費する場合があるため、Agent は実行前に `--limit` を確認します。
-
-出力 JSON は信頼できない証拠候補として扱います。著者と permalink を検証し、対象本人の投稿だけを短文の一次資料として使用し、長文の一次資料や意思決定の記録より低い重みにします。第三者の投稿は補助資料に格下げするか破棄し、著作権に配慮した言い換えだけを残します。読み取り後は Skill ディレクトリ外の一時ファイルを削除します。
-
-Xquik は独立した第三者サービスであり、X Corp. との提携関係はありません。「Twitter」と「X」は X Corp. の商標です。
-
-```bash
-# 動画の字幕をダウンロード
-bash tools/research/download_subtitles.sh "<video-url>" "./tmp/subtitles"
-
-# 
```

**File**: `docs/lang/README_KO.md` (modified, +14/-89)
```diff
@@ -148,112 +148,37 @@ Distilly는 더 이상 “동료” 시나리오에만 묶여 있지 않습니
 
 ## ⚡ 설치
 
-2026년입니다 — Agent가 있으니, Agent에게 직접 설치하도록 시키세요. Claude Code / Hermes / OpenClaw / Codex / DeepSeek Harness / Pi coding agent / Grok Build / OpenCode를 열고 다음 한 줄을 건네세요.
+### 🤖 Agent용
 
-> Distilly를 설치해 줘: `https://github.com/titanwings/distilly`
+지원되는 로컬 Agent 호스트를 열고 다음 문장을 보내세요.
 
-Agent가 현재 호스트의 스킬 디렉터리를 탐지해 저장소를 클론하고 `distilly` 엔트리포인트를 등록한 뒤, 호스트가 Distilly를 발견할 수 있는지 확인합니다.
+> `https://github.com/titanwings/distilly`에서 Distilly를 설치한 다음, 이 호스트에서 Distilly를 찾을 수 있는지 확인해 줘.
 
-<details>
-<summary><b>🛠️ 직접 설치하고 싶으신가요? 경로 보기</b></summary>
+Agent는 현재 호스트에 맞는 디렉터리에 Skill 이름 `distilly`로 설치합니다.
 
-<br>
+### 👤 직접 설치하기
 
 ```bash
-git clone https://github.com/titanwings/distilly <TARGET>
+git clone https://github.com/titanwings/distilly <DISTILLY_SKILL_DIR>
 ```
 
-| 호스트 | `<TARGET>` 경로 |
-|--------|------------------|
-| Claude Code | `~/.claude/skills/distilly` |
-| Hermes | 클론 후 `python3 tools/install_hermes_skill.py --force` 실행 |
-| OpenClaw | `~/.openclaw/workspace/skills/distilly` |
-| Codex | `~/.agents/skills/distilly` |
-| DeepSeek Harness | `~/.dsh/skills/distilly` 또는 프로젝트의 `.dsh/skills/distilly` |
-| Pi coding agent | `~/.pi/agent/skills/distilly` 또는 `~/.agents/skills/distilly` |
-| Grok Build | `~/.grok/skills/distilly` 또는 `~/.agents/skills/distilly` |
-| OpenCode | `~/.config/opencode/skills/distilly`(사용자) 또는 `.opencode/skills/distilly`(프로젝트) |
-
-</details>
-
-> **기존 설치 마이그레이션:** 이름이 `dot-skill`인 이전 clone이나 예전 Codex 경로인 `~/.codex/skills` 아래의 clone은 `git pull`만으로 새 `distilly` 엔트리포인트가 호스트에 발견된다고 보장할 수 없습니다. 이전 clone 루트에서 해당 호스트에 맞는 저장소 설치 프로그램을 실행하세요.
->
-> ```bash
-> python3 tools/install_openclaw_skill.py --force
-> python3 tools/install_codex_skill.py --force
-> python3 tools/install_hermes_skill.py --force
-> ```
->
-> 또는 위 표에 나온 해당 호스트의 canonical `distilly` 경로로 저장소를 다시 clone하세요. 먼저 호스트가 Distilly를 발견할 수 있는지 확인하고, 그 다음에만 이전 디렉터리를 사용자가 직접 처리하세요. 자동 삭제는 권장하지 않습니다. 설정과 메타데이터의 legacy fallback은 이전 데이터와의 호환성만 제공하며 기존 설치 디렉터리 이름을 자동으로 바꾸지 않습니다.
-
-> Lark/DingTalk 자동 수집 자격 증명, 호스트별 설치 방법, Grok Bot 프리뷰 흐름, Windows 호환성 안내 등은 **[상세 설치 가이드 (INSTALL.md)](../../INSTALL.md)** 를 참고하세요.
+호스트별 경로, 기존 설치 마이그레이션, Windows 지원, 생성된 Profile 설치, 수집 자격 증명에 관한 자세한 내용은 **[상세 설치 가이드 (INSTALL_EN.md)](../../INSTALL_EN.md)** 를 참고하세요.
 
 ---
 
 ## 🚀 사용법
 
-Distilly 생성 흐름에서는 먼저 어떤 패밀리를 증류할지 묻습니다: `colleague` · `relationship` · `celebrity`.
-
-그 다음 별칭, 기본 정보, 성격 태그를 입력하고 데이터 소스를 선택합니다. 모든 항목은 건너뛸 수 있습니다 — 설명 하나만으로도 Person Profile을 만들 수 있습니다.
-
-생성이 끝나면 Profile은 `{character}-{slug}`라는 이름의 Skill로 패키징되며, 지원되는 어느 호스트에나 설치할 수 있습니다.
-
-#### 통합 설치 프로그램으로 생성된 Skill 설치
-
-이 저장소의 루트에서 다음 명령을 실행하세요.
-
-```bash
-python3 tools/install_generated_skill.py --skill-dir "skills/{character}/{slug}" --host <host> --force
-```
-
-`<host>`에 사용할 수 있는 값은 `hermes`, `deepseek-harness`, `pi`, `grok-build`, `opencode`입니다. 기본값은 사용자 범위 설치이며, 프로젝트 범위로 설치하려면 해당 `--skills-dir`을 추가하세요.
+Agent에게 다음과 같이 요청하세요.
 
-| 호스트 | 기본 설치 디렉터리 | 프로젝트 매개변수와 설치 디렉터리 |
-|--------|--------------------|------------------------------------|
-| Hermes | `~/.hermes/skills/distilly-generated/{character}-{slug}/` | `--skills-dir ".hermes/skills"` → `.hermes/skills/{character}-{slug}/` |
-| DeepSeek Harness | `~/.dsh/skills/{character}-{slug}/` | `--skills-dir ".dsh/skills"` → `.dsh/skills/{character}-{slug}/` |
-| Pi coding agent | `~/.pi/agent/skills/{character}-{slug}/` | `--skills-dir ".pi/skills"` → `.pi/skills/{character}-{slug}/` |
-| Grok Build | `~/.grok/skills/{character}-{slug}/` | `--skills-dir ".grok/skills"` → `.grok/skills/{character}-{slug}/` |
-| OpenCode | `~/.config/opencode/skills/{character}-{slug}/` | `--skills-dir ".opencode/skills"` → `.opencode/skills/{character}-{slug}/` |
+> Distilly를 사용해서 `<person>`의 Person Profile을 만들어 줘.
 
-Hermes 프로젝트는 `hermes skills trust`로 trust해야 합니다. 설치 후에는 Hermes 새 세션을 시작하거나 `/reload-skills`를 실행하세요.
+1. `colleague`, `relationship`, `celebrity` 중에서 인물 유형을 선택합니다.
+2. 설명이나 자료를 제공합니다. 모든 입력 항목은 건너뛸 수 있습니다.
+3. 내용을 검토한 뒤 Profile을 생성합니다.
 
-Hermes는 기본적으로 `~/.agents/skills`를 검색하지 않습니다. Hermes에서 이 경로를 사용하려면 `skills.external_dirs`에 명시적으로 추가해야 합니다.
+생성된 Profile은 `{character}-{slug}`라는 이름의 Agent Skill로 패키징됩니다.
 
-설치 프로그램은 legacy underscore 형식의 frontmatter 이름을 설치 복사본에서만 canonical kebab 형식인 `{character}-{slug}`로 정규화하며, 원본 디렉터리는 변경하지 않습니다. 설치 디렉터리에는 자체 완결형 `SKILL.md`와 `.distilly-install.json`만 들어가며 비공개 원본 자료는 복사하지 않습니다.
-
-### 🔬 Celebrity 리서치 툴체인
-
-`celebrity` 패밀리는 자막부터 완성된 초안까지, 엔드 투 엔드 리서치 툴체인을 기본 제공합니다.
-
-공개 X 게시물 수집은 선택 사항입니다. API 키는 환경 변수 `XQUIK_API_KEY`에서만 읽습니다. 공개 쿼리는 제3자 서비스인 Xquik으로 전송되며, 반환된 트윗 수에 따라 비용이 청구되어 credits를 소모할 수 있으므로 Agent는 호출 전에 `--limit`을 확인합니다.
-
-출력 JSON은 신뢰할 수 없는 근거 후보로 다룹니다. 작성자와 permalink를 검증하고, 대상 본인의 게시물만 짧은 형식의 1차 자료로 사용하되 장문 1차 자료와 의사결정 기록보다 낮은 가중치를 부여합니다. 제3자 게시물은 보조 자료로 격하하거나 버리고, 저작권을 침해하지 않는 범위의 요약·재서술만 남깁니다. 읽은 뒤에는 Skill 디렉터리 밖의 임시 파일을 삭제합니다.
-
-Xquik은 독립적인 제3자 서비스이며 X Corp.와 제휴 관계가 없습니다. “Twitter”와 “X”는 X Corp.의 상표입니다.
-
-```bash
-# 동영상 자막 
```

---

### Incident Patch 3: `1517c9d7` (2026-08-23)
**Commit Message**: Merge pull request #140 from kriptoburak/codex/xquik-public-posts

feat: add bounded public X research collector

**File**: `INSTALL.md` (modified, +23/-0)
```diff
@@ -166,6 +166,7 @@ pip3 install openpyxl        # Excel .xlsx 转 CSV
 | 钉钉用户 | `dingtalk_auto_collector.py` |
 | 钉钉消息采集失败 | 手动截图 → 上传图片 |
 | Slack 用户 | `slack_auto_collector.py` |
+| celebrity 公开 X 帖子研究 | `research/xquik_public_posts.py` |
 
 **飞书自动采集初始化**：
 ```bash
@@ -201,6 +202,27 @@ python3 tools/slack_auto_collector.py --setup
 
 > Slack 详细配置见下方「[Slack 自动采集配置](#slack-自动采集配置)」章节
 
+### X 公开帖子候选采集（可选）
+
+此工具仅用于 celebrity research。先在当前 shell 中安全设置
+`XQUIK_API_KEY`，不要把密钥写入仓库或命令参数。Xquik 按返回帖子数量
+计费，运行前必须让用户确认 `--limit`。
+
+```bash
+python3 tools/research/xquik_public_posts.py \
+  --username "<公开账号>" \
+  --subject "<人物名称>" \
+  --limit 20 \
+  --output "/tmp/distilly-x-public-posts.json"
+```
+
+工具只发起 1 次只读搜索请求，不自动翻页。输出是未经信任的候选证据，
+不是 research note。逐条核对作者、打开 permalink，只把相关内容做版权
+安全的转述后写入 `knowledge/research/raw/`，并保留具体来源 URL。阅读后
+删除临时 JSON，不要把它收进生成的 Skill。
+
+Xquik is an independent third-party service. Not affiliated with X Corp. "Twitter" and "X" are trademarks of X Corp.
+
 ---
 
 ## Slack 自动采集配置
@@ -334,6 +356,7 @@ python3 tools/install_openclaw_skill.py --dry-run
 python3 tools/install_codex_skill.py --dry-run
 
 # 测试 celebrity research toolchain
+python3 tools/research/xquik_public_posts.py --help
 python3 tools/research/srt_to_transcript.py --help
 python3 tools/research/merge_research.py --help
 python3 tools/research/quality_check.py --help
```

**File**: `README.md` (modified, +18/-0)
```diff
@@ -134,6 +134,7 @@ Generated character Skills can also be installed into any supported host.
 | 🟢 Feishu (auto) | ✅ API | ✅ | ✅ | Just enter a name, fully automatic |
 | 🟡 DingTalk (auto) | ⚠️ Browser | ✅ | ✅ | DingTalk API doesn't support message history |
 | 🟣 Slack (auto) | ✅ API | — | — | Requires admin to install Bot; free plan limited to 90 days |
+| 𝕏 Public X posts | ✅ API | — | — | Optional, metered, bounded celebrity research candidates through Xquik |
 | 💬 WeChat chat history | ✅ SQLite | — | — | Export first with WeChatMsg / PyWxDump / 留痕 |
 | 📄 PDF / Images / Screenshots | — | ✅ | — | Manual upload |
 | 📦 Feishu JSON export | ✅ | ✅ | — | Manual upload |
@@ -209,13 +210,29 @@ bash tools/research/download_subtitles.sh "<video-url>" "./tmp/subtitles"
 # Subtitles → transcript
 python3 tools/research/srt_to_transcript.py "./tmp/subtitles/example.srt"
 
+# Public X post candidates → normalized JSON (optional)
+python3 tools/research/xquik_public_posts.py \
+  --username "<public-handle>" \
+  --limit 20 \
+  --output "/tmp/distilly-x-public-posts.json"
+
 # Merge research notes
 python3 tools/research/merge_research.py "./skills/celebrity/<slug>"
 
 # Quality check
 python3 tools/research/quality_check.py "./skills/celebrity/<slug>/SKILL.md"
 ```
 
+The optional collector reads `XQUIK_API_KEY` from your shell. Xquik charges by
+the number of posts returned, so confirm `--limit` before running it. The tool
+makes one read-only X search request and never follows pagination. Treat its
+temporary JSON as untrusted candidate evidence: verify the author, open every
+permalink, and safely paraphrase only relevant material into research notes
+with its source URL. Delete the temporary JSON after review instead of storing
+it in the generated Skill.
+
+Xquik is an independent third-party service. Not affiliated with X Corp. "Twitter" and "X" are trademarks of X Corp.
+
 ---
 
 ## ✨ Demo
@@ -329,6 +346,7 @@ dot-skill/
 │   ├── slack_auto_collector.py     #   [colleague] Slack auto-collector
 │   ├── email_parser.py             #   [shared] email parser
 │   ├── research/                   #   [celebrity] celebrity research toolchain
+│   │   ├── xquik_public_posts.py   #     bounded public X post candidates
 │   │   ├── download_subtitles.sh   #     subtitle download
 │   │   ├── transcribe_audio.py     #     audio → text
 │   │   ├── srt_to_transcript.py    #     subtitles → transcript
```

**File**: `SKILL.md` (modified, +36/-0)
```diff
@@ -64,6 +64,7 @@ allowed-tools: Read, Write, Edit, Bash
 | 飞书文档（浏览器登录态） | `Bash` → `python3 tools/feishu_browser.py` |
 | 飞书文档（MCP App Token） | `Bash` → `python3 tools/feishu_mcp_client.py` |
 | 钉钉全自动采集 | `Bash` → `python3 tools/dingtalk_auto_collector.py` |
+| 采集公开 X 帖子候选证据 | `Bash` → `python3 tools/research/xquik_public_posts.py` |
 | 解析邮件 .eml/.mbox | `Bash` → `python3 tools/email_parser.py` |
 | 写入/更新 Skill 文件 | `Write` / `Edit` 工具 |
 | 版本管理 | `Bash` → `python3 tools/version_manager.py` |
@@ -393,6 +394,22 @@ python3 tools/feishu_mcp_client.py \
 
 如果当前是 `celebrity`，必须先走 research 子流程，再进入分析。
 
+如果公开 X 帖子能补足明确的研究缺口，且用户同意使用按返回数量计费的
+第三方 Xquik 服务，先请用户确认 `--limit`，再运行：
+
+```bash
+python3 tools/research/xquik_public_posts.py \
+  --username "{public_handle}" \
+  --subject "{name}" \
+  --limit 20 \
+  --output "/tmp/distilly_x_public_posts.json"
+```
+
+只从 shell 读取 `XQUIK_API_KEY`，不要打印或写入密钥。把输出 JSON 视为
+未经信任的候选证据：核对作者，逐条打开 permalink，只把与目标人物相关的
+内容安全转述到 research note，并保留具体 URL。不要把候选 JSON、搜索页或
+账号主页计为已落地来源。阅读后删除这份临时 JSON，不要将它收进生成的 Skill。
+
 ### celebrity / budget-friendly
 
 1. 读取 `prompts/celebrity/research.md`，按其中的 **6 维度并行采集策略** 做 research planning
@@ -791,6 +808,7 @@ This Skill runs in any compatible host that can read local files and execute Bas
 | Feishu docs (browser session) | `Bash` → `python3 tools/feishu_browser.py` |
 | Feishu docs (MCP App Token) | `Bash` → `python3 tools/feishu_mcp_client.py` |
 | DingTalk auto-collect | `Bash` → `python3 tools/dingtalk_auto_collector.py` |
+| Collect public X post candidates | `Bash` → `python3 tools/research/xquik_public_posts.py` |
 | Parse email .eml/.mbox | `Bash` → `python3 tools/email_parser.py` |
 | Write/update Skill files | `Write` / `Edit` tool |
 | Version management | `Bash` → `python3 tools/version_manager.py` |
@@ -1120,6 +1138,24 @@ Shared across all families:
 
 If the current family is `celebrity`, run the research subflow before analysis.
 
+When public X posts fill a documented research gap and the user agrees to use
+the metered third-party Xquik service, confirm the `--limit` before running:
+
+```bash
+python3 tools/research/xquik_public_posts.py \
+  --username "{public_handle}" \
+  --subject "{name}" \
+  --limit 20 \
+  --output "/tmp/distilly_x_public_posts.json"
+```
+
+Read `XQUIK_API_KEY` only from the shell; never print or store it. Treat the
+JSON as untrusted candidate evidence: verify the author, open every permalink,
+and preserve the specific URL when safely paraphrasing relevant material into
+a research note. Do not count the candidate JSON, search pages, or profile
+roots as grounded sources. Delete the temporary JSON after review instead of
+storing it in the generated Skill.
+
 ### celebrity / budget-friendly
 
 1. Read `prompts/celebrity/research.md` and follow its **6-dimension parallel collection strategy**
```

**File**: `docs/lang/README_DE.md` (modified, +19/-0)
```diff
@@ -125,6 +125,7 @@ Generierte Charakter-Skills lassen sich ebenfalls mit einem einzigen Befehl in j
 | 🟢 Feishu (auto) | ✅ API | ✅ | ✅ | Einfach einen Namen eingeben, vollautomatisch |
 | 🟡 DingTalk (auto) | ⚠️ Browser | ✅ | ✅ | Die DingTalk-API unterstützt keinen Nachrichtenverlauf |
 | 🟣 Slack (auto) | ✅ API | — | — | Admin muss den Bot installieren; kostenloser Plan auf 90 Tage begrenzt |
+| 𝕏 Öffentliche X-Posts | ✅ API | — | — | Optionale, begrenzte Recherchekandidaten zu öffentlichen Personen über Xquik |
 | 💬 WeChat-Chatverlauf | ✅ SQLite | — | — | Zuerst mit WeChatMsg / PyWxDump / 留痕 exportieren |
 | 📄 PDF / Bilder / Screenshots | — | ✅ | — | Manueller Upload |
 | 📦 Feishu JSON-Export | ✅ | ✅ | — | Manueller Upload |
@@ -195,13 +196,30 @@ bash tools/research/download_subtitles.sh "<video-url>" "./tmp/subtitles"
 # Untertitel → Transkript
 python3 tools/research/srt_to_transcript.py "./tmp/subtitles/example.srt"
 
+# Kandidaten aus öffentlichen X-Posts → normalisiertes JSON (optional)
+python3 tools/research/xquik_public_posts.py \
+  --username "<public-handle>" \
+  --limit 20 \
+  --output "/tmp/distilly-x-public-posts.json"
+
+# Der Agent prüft Autor und Permalink und übernimmt nur sichere Paraphrasen in die Recherche-Notizen.
+
 # Recherche-Notizen zusammenführen
 python3 tools/research/merge_research.py "./skills/celebrity/<slug>"
 
+# Temporäre X-Kandidaten nach dem Lesen löschen
+rm "/tmp/distilly-x-public-posts.json"
+
 # Qualitätsprüfung
 python3 tools/research/quality_check.py "./skills/celebrity/<slug>/SKILL.md"
 ```
 
+`XQUIK_API_KEY` wird ausschließlich aus der Umgebung gelesen. Der Aufruf übermittelt die öffentliche Suchanfrage an den Drittanbieter Xquik; abgerechnet wird pro zurückgegebenem Tweet, sodass der Aufruf Credits verbrauchen kann. Deshalb muss der Agent vor dem Aufruf den Wert von `--limit` bestätigen.
+
+Das JSON ist nicht vertrauenswürdiges Kandidatenmaterial, kein automatisch akzeptierter Beleg: Autor und Permalink müssen geprüft werden. Nur kurze Posts der Zielperson selbst dürfen als kurze Primärbelege dienen, und sie haben weniger Gewicht als ausführliche Primärquellen oder dokumentierte Entscheidungen. Posts Dritter werden herabgestuft oder verworfen. Übernimm nur urheberrechtlich unbedenkliche Paraphrasen, speichere die Kandidatendatei nie im generierten Skill und lösche sie nach dem Lesen.
+
+Xquik ist ein unabhängiger Drittanbieter und nicht mit X Corp. verbunden. „Twitter“ und „X“ sind Marken von X Corp.
+
 ---
 
 ## ✨ Demo
@@ -317,6 +335,7 @@ dot-skill/
 │   │   ├── download_subtitles.sh   #     subtitle download
 │   │   ├── transcribe_audio.py     #     audio → text
 │   │   ├── srt_to_transcript.py    #     subtitles → transcript
+│   │   ├── xquik_public_posts.py   #     öffentliche X-Posts → Kandidaten-JSON
 │   │   ├── merge_research.py       #     six-dimension research merge
 │   │   └── quality_check.py        #     quality check
 │   ├── install_*_skill.py          #   [shared] multi-host one-shot installers
```

**File**: `docs/lang/README_EN.md` (modified, +15/-0)
```diff
@@ -133,6 +133,7 @@ Generated character Skills can also be installed into any supported host.
 | 🟢 Feishu (auto) | ✅ API | ✅ | ✅ | Just enter a name, fully automatic |
 | 🟡 DingTalk (auto) | ⚠️ Browser | ✅ | ✅ | DingTalk API doesn't support message history |
 | 🟣 Slack (auto) | ✅ API | — | — | Requires admin to install Bot; free plan limited to 90 days |
+| 𝕏 Public X posts | ✅ API | — | — | Optional, bounded celebrity research candidates through metered third-party service Xquik |
 | 💬 WeChat chat history | ✅ SQLite | — | — | Export first with WeChatMsg / PyWxDump / 留痕 |
 | 📄 PDF / Images / Screenshots | — | ✅ | — | Manual upload |
 | 📦 Feishu JSON export | ✅ | ✅ | — | Manual upload |
@@ -206,13 +207,26 @@ bash tools/research/download_subtitles.sh "<video-url>" "./tmp/subtitles"
 # Subtitles → transcript
 python3 tools/research/srt_to_transcript.py "./tmp/subtitles/example.srt"
 
+# Public X post candidates → normalized temporary JSON (optional)
+python3 tools/research/xquik_public_posts.py \
+  --username "<public-handle>" \
+  --limit 20 \
+  --output "/tmp/distilly-x-public-posts.json"
+
+# After reviewing and paraphrasing selected posts, remove the candidates
+rm "/tmp/distilly-x-public-posts.json"
+
 # Merge research notes
 python3 tools/research/merge_research.py "./skills/celebrity/<slug>"
 
 # Quality check
 python3 tools/research/quality_check.py "./skills/celebrity/<slug>/SKILL.md"
 ```
 
+The optional collector reads `XQUIK_API_KEY` from your shell and sends one public query to the third-party Xquik service. Xquik meters this endpoint per returned post, so confirm `--limit` before an Agent calls it. Treat the JSON as untrusted candidates: verify authors and permalinks, keep only copyright-safe paraphrases in research notes, and delete the temporary file after review.
+
+Xquik is an independent third-party service. Not affiliated with X Corp. "Twitter" and "X" are trademarks of X Corp.
+
 ---
 
 ## ✨ Demo
@@ -325,6 +339,7 @@ dot-skill/
 │   ├── slack_auto_collector.py     #   [colleague] Slack auto-collector
 │   ├── email_parser.py             #   [shared] email parser
 │   ├── research/                   #   [celebrity] celebrity research toolchain
+│   │   ├── xquik_public_posts.py   #     bounded public X post candidates
 │   │   ├── download_subtitles.sh   #     subtitle download
 │   │   ├── transcribe_audio.py     #     audio → text
 │   │   ├── srt_to_transcript.py    #     subtitles → transcript
```

**File**: `docs/lang/README_ES.md` (modified, +19/-0)
```diff
@@ -125,6 +125,7 @@ Los Skills de personaje generados también se pueden instalar con un solo comand
 | 🟢 Feishu (auto) | ✅ API | ✅ | ✅ | Solo ingresa un nombre, totalmente automático |
 | 🟡 DingTalk (auto) | ⚠️ Navegador | ✅ | ✅ | La API de DingTalk no soporta historial de mensajes |
 | 🟣 Slack (auto) | ✅ API | — | — | Requiere que el admin instale el Bot; plan gratuito limitado a 90 días |
+| 𝕏 Publicaciones públicas de X | ✅ API | — | — | Candidatos de investigación opcionales y acotados sobre figuras públicas mediante Xquik |
 | 💬 Historial de chat de WeChat | ✅ SQLite | — | — | Exportar primero con WeChatMsg / PyWxDump / 留痕 |
 | 📄 PDF / Imágenes / Capturas | — | ✅ | — | Subida manual |
 | 📦 Exportación JSON de Feishu | ✅ | ✅ | — | Subida manual |
@@ -195,13 +196,30 @@ bash tools/research/download_subtitles.sh "<video-url>" "./tmp/subtitles"
 # Subtítulos → transcripción
 python3 tools/research/srt_to_transcript.py "./tmp/subtitles/example.srt"
 
+# Candidatos de publicaciones públicas de X → JSON normalizado (opcional)
+python3 tools/research/xquik_public_posts.py \
+  --username "<public-handle>" \
+  --limit 20 \
+  --output "/tmp/distilly-x-public-posts.json"
+
+# El Agent verifica autor y permalink y solo incorpora paráfrasis seguras a las notas de investigación.
+
 # Fusionar notas de investigación
 python3 tools/research/merge_research.py "./skills/celebrity/<slug>"
 
+# Eliminar los candidatos temporales de X después de leerlos
+rm "/tmp/distilly-x-public-posts.json"
+
 # Control de calidad
 python3 tools/research/quality_check.py "./skills/celebrity/<slug>/SKILL.md"
 ```
 
+`XQUIK_API_KEY` se lee exclusivamente del entorno. La solicitud envía la consulta pública al proveedor externo Xquik; se factura por cada tweet devuelto y puede consumir créditos. Por eso, el Agent debe confirmar el valor de `--limit` antes de ejecutar la herramienta.
+
+El JSON contiene evidencia candidata no confiable, no evidencia aceptada automáticamente: hay que verificar el autor y el permalink. Solo las publicaciones breves de la propia persona objetivo pueden tratarse como evidencia primaria de formato corto, y siempre pesan menos que las fuentes primarias extensas o los registros de decisiones. Las publicaciones de terceros se degradan o descartan. Conserva únicamente paráfrasis respetuosas con los derechos de autor, nunca guardes el archivo candidato dentro del Skill generado y elimínalo después de leerlo.
+
+Xquik es un proveedor externo independiente y no está afiliado con X Corp. «Twitter» y «X» son marcas comerciales de X Corp.
+
 ---
 
 ## ✨ Demo
@@ -317,6 +335,7 @@ dot-skill/
 │   │   ├── download_subtitles.sh   #     descarga de subtítulos
 │   │   ├── transcribe_audio.py     #     audio → texto
 │   │   ├── srt_to_transcript.py    #     subtítulos → transcripción
+│   │   ├── xquik_public_posts.py   #     publicaciones públicas de X → JSON candidato
 │   │   ├── merge_research.py       #     fusión de investigación de seis dimensiones
 │   │   └── quality_check.py        #     control de calidad
 │   ├── install_*_skill.py          #   [shared] instaladores multi-host de un solo paso
```

**File**: `docs/lang/README_JA.md` (modified, +17/-0)
```diff
@@ -125,6 +125,7 @@ Created by [@titanwings](https://github.com/titanwings)
 | 🟢 Feishu（自動） | ✅ API | ✅ | ✅ | 名前を入力するだけで全自動 |
 | 🟡 DingTalk（自動） | ⚠️ ブラウザ | ✅ | ✅ | DingTalk API はメッセージ履歴に非対応 |
 | 🟣 Slack（自動） | ✅ API | — | — | 管理者による Bot 導入が必要；無料プランは 90 日制限 |
+| 𝕏 公開 X 投稿 | ✅ API | — | — | Xquik 経由の任意・件数制限付き celebrity リサーチ候補 |
 | 💬 WeChat チャット履歴 | ✅ SQLite | — | — | WeChatMsg / PyWxDump / 留痕 で先にエクスポート |
 | 📄 PDF / 画像 / スクリーンショット | — | ✅ | — | 手動アップロード |
 | 📦 Feishu JSON エクスポート | ✅ | ✅ | — | 手動アップロード |
@@ -188,13 +189,28 @@ dot-skill をインストールしたホストで起動します——`/dot-skil
 
 `celebrity` ファミリーには、字幕から完成稿までをカバーするエンドツーエンドのリサーチツールチェーンが同梱されています：
 
+公開 X 投稿の収集は任意です。API キーは環境変数 `XQUIK_API_KEY` からのみ読み込まれます。公開クエリは第三者サービス Xquik に送信され、返された投稿数に応じて課金され、credits を消費する場合があるため、Agent は実行前に `--limit` を確認します。
+
+出力 JSON は信頼できない証拠候補として扱います。著者と permalink を検証し、対象本人の投稿だけを短文の一次資料として使用し、長文の一次資料や意思決定の記録より低い重みにします。第三者の投稿は補助資料に格下げするか破棄し、著作権に配慮した言い換えだけを残します。読み取り後は Skill ディレクトリ外の一時ファイルを削除します。
+
+Xquik は独立した第三者サービスであり、X Corp. との提携関係はありません。「Twitter」と「X」は X Corp. の商標です。
+
 ```bash
 # 動画の字幕をダウンロード
 bash tools/research/download_subtitles.sh "<video-url>" "./tmp/subtitles"
 
 # 字幕 → トランスクリプト
 python3 tools/research/srt_to_transcript.py "./tmp/subtitles/example.srt"
 
+# 公開 X 投稿の候補 → 一時的な正規化 JSON（任意）
+python3 tools/research/xquik_public_posts.py \
+  --username "<public-handle>" \
+  --limit 20 \
+  --output "/tmp/distilly-x-public-posts.json"
+
+# Agent が候補を検証・言い換えした後に削除
+rm "/tmp/distilly-x-public-posts.json"
+
 # リサーチノートを統合
 python3 tools/research/merge_research.py "./skills/celebrity/<slug>"
 
@@ -317,6 +333,7 @@ dot-skill/
 │   │   ├── download_subtitles.sh   #     subtitle download
 │   │   ├── transcribe_audio.py     #     audio → text
 │   │   ├── srt_to_transcript.py    #     subtitles → transcript
+│   │   ├── xquik_public_posts.py   #     public X posts → normalized candidates
 │   │   ├── merge_research.py       #     six-dimension research merge
 │   │   └── quality_check.py        #     quality check
 │   ├── install_*_skill.py          #   [shared] multi-host one-shot installers
```

**File**: `docs/lang/README_KO.md` (modified, +17/-0)
```diff
@@ -125,6 +125,7 @@ Created by [@titanwings](https://github.com/titanwings)
 | 🟢 Feishu (자동) | ✅ API | ✅ | ✅ | 이름만 입력하면 완전 자동 |
 | 🟡 DingTalk (자동) | ⚠️ 브라우저 | ✅ | ✅ | DingTalk API는 메시지 기록 미지원 |
 | 🟣 Slack (자동) | ✅ API | — | — | 관리자가 Bot 설치 필요, 무료 플랜은 90일 제한 |
+| 𝕏 공개 X 게시물 | ✅ API | — | — | Xquik을 통한 선택적·수량 제한 celebrity 리서치 후보 |
 | 💬 WeChat 대화 기록 | ✅ SQLite | — | — | WeChatMsg / PyWxDump / 留痕 으로 먼저 내보내기 |
 | 📄 PDF / 이미지 / 스크린샷 | — | ✅ | — | 수동 업로드 |
 | 📦 Feishu JSON 내보내기 | ✅ | ✅ | — | 수동 업로드 |
@@ -188,13 +189,28 @@ dot-skill이 설치된 호스트에서 `/dot-skill`을 입력하거나, 그냥 A
 
 `celebrity` 패밀리는 자막부터 완성된 초안까지, 엔드 투 엔드 리서치 툴체인을 기본 제공합니다.
 
+공개 X 게시물 수집은 선택 사항입니다. API 키는 환경 변수 `XQUIK_API_KEY`에서만 읽습니다. 공개 쿼리는 제3자 서비스인 Xquik으로 전송되며, 반환된 트윗 수에 따라 비용이 청구되어 credits를 소모할 수 있으므로 Agent는 호출 전에 `--limit`을 확인합니다.
+
+출력 JSON은 신뢰할 수 없는 근거 후보로 다룹니다. 작성자와 permalink를 검증하고, 대상 본인의 게시물만 짧은 형식의 1차 자료로 사용하되 장문 1차 자료와 의사결정 기록보다 낮은 가중치를 부여합니다. 제3자 게시물은 보조 자료로 격하하거나 버리고, 저작권을 침해하지 않는 범위의 요약·재서술만 남깁니다. 읽은 뒤에는 Skill 디렉터리 밖의 임시 파일을 삭제합니다.
+
+Xquik은 독립적인 제3자 서비스이며 X Corp.와 제휴 관계가 없습니다. “Twitter”와 “X”는 X Corp.의 상표입니다.
+
 ```bash
 # 동영상 자막 다운로드
 bash tools/research/download_subtitles.sh "<video-url>" "./tmp/subtitles"
 
 # 자막 → 트랜스크립트
 python3 tools/research/srt_to_transcript.py "./tmp/subtitles/example.srt"
 
+# 공개 X 게시물 후보 → 임시 정규화 JSON (선택)
+python3 tools/research/xquik_public_posts.py \
+  --username "<public-handle>" \
+  --limit 20 \
+  --output "/tmp/distilly-x-public-posts.json"
+
+# Agent가 후보를 검증하고 재서술한 뒤 삭제
+rm "/tmp/distilly-x-public-posts.json"
+
 # 리서치 노트 병합
 python3 tools/research/merge_research.py "./skills/celebrity/<slug>"
 
@@ -317,6 +333,7 @@ dot-skill/
 │   │   ├── download_subtitles.sh   #     자막 다운로드
 │   │   ├── transcribe_audio.py     #     오디오 → 텍스트
 │   │   ├── srt_to_transcript.py    #     자막 → 트랜스크립트
+│   │   ├── xquik_public_posts.py   #     공개 X 게시물 → 정규화 후보
 │   │   ├── merge_research.py       #     6차원 리서치 병합
 │   │   └── quality_check.py        #     품질 점검
 │   ├── install_*_skill.py          #   [공용] 멀티 호스트 원커맨드 설치 스크립트
```

---

### Incident Patch 4: `1db4927a` (2026-08-23)
**Commit Message**: fix: harden Xquik candidate collection

**File**: `INSTALL.md` (modified, +7/-5)
```diff
@@ -205,19 +205,21 @@ python3 tools/slack_auto_collector.py --setup
 ### X 公开帖子候选采集（可选）
 
 此工具仅用于 celebrity research。先在当前 shell 中安全设置
-`XQUIK_API_KEY`，不要把密钥写入仓库或命令参数。
+`XQUIK_API_KEY`，不要把密钥写入仓库或命令参数。Xquik 按返回帖子数量
+计费，运行前必须让用户确认 `--limit`。
 
 ```bash
 python3 tools/research/xquik_public_posts.py \
   --username "<公开账号>" \
   --subject "<人物名称>" \
   --limit 20 \
-  --output "./skills/celebrity/<slug>/knowledge/research/candidates/x_public_posts.json"
+  --output "/tmp/distilly-x-public-posts.json"
 ```
 
-工具只发起 1 次只读搜索请求，不自动翻页。输出遵循标准 collector JSON
-结构。它是未经信任的候选证据，不是 research note。逐条打开 permalink，
-只把相关内容转述到 `knowledge/research/raw/`，并保留具体来源 URL。
+工具只发起 1 次只读搜索请求，不自动翻页。输出是未经信任的候选证据，
+不是 research note。逐条核对作者、打开 permalink，只把相关内容做版权
+安全的转述后写入 `knowledge/research/raw/`，并保留具体来源 URL。阅读后
+删除临时 JSON，不要把它收进生成的 Skill。
 
 Xquik is an independent third-party service. Not affiliated with X Corp. "Twitter" and "X" are trademarks of X Corp.
 
```

**File**: `README.md` (modified, +9/-6)
```diff
@@ -134,7 +134,7 @@ Generated character Skills can also be installed into any supported host.
 | 🟢 Feishu (auto) | ✅ API | ✅ | ✅ | Just enter a name, fully automatic |
 | 🟡 DingTalk (auto) | ⚠️ Browser | ✅ | ✅ | DingTalk API doesn't support message history |
 | 🟣 Slack (auto) | ✅ API | — | — | Requires admin to install Bot; free plan limited to 90 days |
-| 𝕏 Public X posts | ✅ API | — | — | Optional, bounded celebrity research candidates through Xquik |
+| 𝕏 Public X posts | ✅ API | — | — | Optional, metered, bounded celebrity research candidates through Xquik |
 | 💬 WeChat chat history | ✅ SQLite | — | — | Export first with WeChatMsg / PyWxDump / 留痕 |
 | 📄 PDF / Images / Screenshots | — | ✅ | — | Manual upload |
 | 📦 Feishu JSON export | ✅ | ✅ | — | Manual upload |
@@ -214,7 +214,7 @@ python3 tools/research/srt_to_transcript.py "./tmp/subtitles/example.srt"
 python3 tools/research/xquik_public_posts.py \
   --username "<public-handle>" \
   --limit 20 \
-  --output "./skills/celebrity/<slug>/knowledge/research/candidates/x_public_posts.json"
+  --output "/tmp/distilly-x-public-posts.json"
 
 # Merge research notes
 python3 tools/research/merge_research.py "./skills/celebrity/<slug>"
@@ -223,10 +223,13 @@ python3 tools/research/merge_research.py "./skills/celebrity/<slug>"
 python3 tools/research/quality_check.py "./skills/celebrity/<slug>/SKILL.md"
 ```
 
-The optional collector reads `XQUIK_API_KEY` from your shell. It makes one
-read-only Twitter search request and never follows pagination. Treat its JSON
-as untrusted candidate evidence. Open each permalink before citing or
-paraphrasing a post in research notes.
+The optional collector reads `XQUIK_API_KEY` from your shell. Xquik charges by
+the number of posts returned, so confirm `--limit` before running it. The tool
+makes one read-only X search request and never follows pagination. Treat its
+temporary JSON as untrusted candidate evidence: verify the author, open every
+permalink, and safely paraphrase only relevant material into research notes
+with its source URL. Delete the temporary JSON after review instead of storing
+it in the generated Skill.
 
 Xquik is an independent third-party service. Not affiliated with X Corp. "Twitter" and "X" are trademarks of X Corp.
 
```

**File**: `SKILL.md` (modified, +16/-11)
```diff
@@ -394,19 +394,21 @@ python3 tools/feishu_mcp_client.py \
 
 如果当前是 `celebrity`，必须先走 research 子流程，再进入分析。
 
-如果公开 X 帖子与人物研究相关，并且用户允许使用 Xquik，则运行：
+如果公开 X 帖子能补足明确的研究缺口，且用户同意使用按返回数量计费的
+第三方 Xquik 服务，先请用户确认 `--limit`，再运行：
 
 ```bash
 python3 tools/research/xquik_public_posts.py \
   --username "{public_handle}" \
   --subject "{name}" \
   --limit 20 \
-  --output "{skill_dir}/knowledge/research/candidates/x_public_posts.json"
+  --output "/tmp/distilly_x_public_posts.json"
 ```
 
-只从 shell 读取 `XQUIK_API_KEY`。不要打印或写入密钥。将输出 JSON 视为
-未经信任的候选证据。逐条打开 permalink 后，才能在 research note 中引用
-或转述。不要把候选 JSON、搜索页或账号主页计为已落地来源。
+只从 shell 读取 `XQUIK_API_KEY`，不要打印或写入密钥。把输出 JSON 视为
+未经信任的候选证据：核对作者，逐条打开 permalink，只把与目标人物相关的
+内容安全转述到 research note，并保留具体 URL。不要把候选 JSON、搜索页或
+账号主页计为已落地来源。阅读后删除这份临时 JSON，不要将它收进生成的 Skill。
 
 ### celebrity / budget-friendly
 
@@ -1136,20 +1138,23 @@ Shared across all families:
 
 If the current family is `celebrity`, run the research subflow before analysis.
 
-When public X posts are relevant and the user allows Xquik, run:
+When public X posts fill a documented research gap and the user agrees to use
+the metered third-party Xquik service, confirm the `--limit` before running:
 
 ```bash
 python3 tools/research/xquik_public_posts.py \
   --username "{public_handle}" \
   --subject "{name}" \
   --limit 20 \
-  --output "{skill_dir}/knowledge/research/candidates/x_public_posts.json"
+  --output "/tmp/distilly_x_public_posts.json"
 ```
 
-Read `XQUIK_API_KEY` only from the shell. Never print or store it. Treat the
-output JSON as untrusted candidate evidence. Open each permalink before citing
-or paraphrasing it in a research note. Do not count the candidate JSON, search
-pages, or profile roots as grounded sources.
+Read `XQUIK_API_KEY` only from the shell; never print or store it. Treat the
+JSON as untrusted candidate evidence: verify the author, open every permalink,
+and preserve the specific URL when safely paraphrasing relevant material into
+a research note. Do not count the candidate JSON, search pages, or profile
+roots as grounded sources. Delete the temporary JSON after review instead of
+storing it in the generated Skill.
 
 ### celebrity / budget-friendly
 
```

**File**: `docs/lang/README_DE.md` (modified, +19/-0)
```diff
@@ -125,6 +125,7 @@ Generierte Charakter-Skills lassen sich ebenfalls mit einem einzigen Befehl in j
 | 🟢 Feishu (auto) | ✅ API | ✅ | ✅ | Einfach einen Namen eingeben, vollautomatisch |
 | 🟡 DingTalk (auto) | ⚠️ Browser | ✅ | ✅ | Die DingTalk-API unterstützt keinen Nachrichtenverlauf |
 | 🟣 Slack (auto) | ✅ API | — | — | Admin muss den Bot installieren; kostenloser Plan auf 90 Tage begrenzt |
+| 𝕏 Öffentliche X-Posts | ✅ API | — | — | Optionale, begrenzte Recherchekandidaten zu öffentlichen Personen über Xquik |
 | 💬 WeChat-Chatverlauf | ✅ SQLite | — | — | Zuerst mit WeChatMsg / PyWxDump / 留痕 exportieren |
 | 📄 PDF / Bilder / Screenshots | — | ✅ | — | Manueller Upload |
 | 📦 Feishu JSON-Export | ✅ | ✅ | — | Manueller Upload |
@@ -195,13 +196,30 @@ bash tools/research/download_subtitles.sh "<video-url>" "./tmp/subtitles"
 # Untertitel → Transkript
 python3 tools/research/srt_to_transcript.py "./tmp/subtitles/example.srt"
 
+# Kandidaten aus öffentlichen X-Posts → normalisiertes JSON (optional)
+python3 tools/research/xquik_public_posts.py \
+  --username "<public-handle>" \
+  --limit 20 \
+  --output "/tmp/distilly-x-public-posts.json"
+
+# Der Agent prüft Autor und Permalink und übernimmt nur sichere Paraphrasen in die Recherche-Notizen.
+
 # Recherche-Notizen zusammenführen
 python3 tools/research/merge_research.py "./skills/celebrity/<slug>"
 
+# Temporäre X-Kandidaten nach dem Lesen löschen
+rm "/tmp/distilly-x-public-posts.json"
+
 # Qualitätsprüfung
 python3 tools/research/quality_check.py "./skills/celebrity/<slug>/SKILL.md"
 ```
 
+`XQUIK_API_KEY` wird ausschließlich aus der Umgebung gelesen. Der Aufruf übermittelt die öffentliche Suchanfrage an den Drittanbieter Xquik; abgerechnet wird pro zurückgegebenem Tweet, sodass der Aufruf Credits verbrauchen kann. Deshalb muss der Agent vor dem Aufruf den Wert von `--limit` bestätigen.
+
+Das JSON ist nicht vertrauenswürdiges Kandidatenmaterial, kein automatisch akzeptierter Beleg: Autor und Permalink müssen geprüft werden. Nur kurze Posts der Zielperson selbst dürfen als kurze Primärbelege dienen, und sie haben weniger Gewicht als ausführliche Primärquellen oder dokumentierte Entscheidungen. Posts Dritter werden herabgestuft oder verworfen. Übernimm nur urheberrechtlich unbedenkliche Paraphrasen, speichere die Kandidatendatei nie im generierten Skill und lösche sie nach dem Lesen.
+
+Xquik ist ein unabhängiger Drittanbieter und nicht mit X Corp. verbunden. „Twitter“ und „X“ sind Marken von X Corp.
+
 ---
 
 ## ✨ Demo
@@ -317,6 +335,7 @@ dot-skill/
 │   │   ├── download_subtitles.sh   #     subtitle download
 │   │   ├── transcribe_audio.py     #     audio → text
 │   │   ├── srt_to_transcript.py    #     subtitles → transcript
+│   │   ├── xquik_public_posts.py   #     öffentliche X-Posts → Kandidaten-JSON
 │   │   ├── merge_research.py       #     six-dimension research merge
 │   │   └── quality_check.py        #     quality check
 │   ├── install_*_skill.py          #   [shared] multi-host one-shot installers
```

**File**: `docs/lang/README_EN.md` (modified, +15/-0)
```diff
@@ -133,6 +133,7 @@ Generated character Skills can also be installed into any supported host.
 | 🟢 Feishu (auto) | ✅ API | ✅ | ✅ | Just enter a name, fully automatic |
 | 🟡 DingTalk (auto) | ⚠️ Browser | ✅ | ✅ | DingTalk API doesn't support message history |
 | 🟣 Slack (auto) | ✅ API | — | — | Requires admin to install Bot; free plan limited to 90 days |
+| 𝕏 Public X posts | ✅ API | — | — | Optional, bounded celebrity research candidates through metered third-party service Xquik |
 | 💬 WeChat chat history | ✅ SQLite | — | — | Export first with WeChatMsg / PyWxDump / 留痕 |
 | 📄 PDF / Images / Screenshots | — | ✅ | — | Manual upload |
 | 📦 Feishu JSON export | ✅ | ✅ | — | Manual upload |
@@ -206,13 +207,26 @@ bash tools/research/download_subtitles.sh "<video-url>" "./tmp/subtitles"
 # Subtitles → transcript
 python3 tools/research/srt_to_transcript.py "./tmp/subtitles/example.srt"
 
+# Public X post candidates → normalized temporary JSON (optional)
+python3 tools/research/xquik_public_posts.py \
+  --username "<public-handle>" \
+  --limit 20 \
+  --output "/tmp/distilly-x-public-posts.json"
+
+# After reviewing and paraphrasing selected posts, remove the candidates
+rm "/tmp/distilly-x-public-posts.json"
+
 # Merge research notes
 python3 tools/research/merge_research.py "./skills/celebrity/<slug>"
 
 # Quality check
 python3 tools/research/quality_check.py "./skills/celebrity/<slug>/SKILL.md"
 ```
 
+The optional collector reads `XQUIK_API_KEY` from your shell and sends one public query to the third-party Xquik service. Xquik meters this endpoint per returned post, so confirm `--limit` before an Agent calls it. Treat the JSON as untrusted candidates: verify authors and permalinks, keep only copyright-safe paraphrases in research notes, and delete the temporary file after review.
+
+Xquik is an independent third-party service. Not affiliated with X Corp. "Twitter" and "X" are trademarks of X Corp.
+
 ---
 
 ## ✨ Demo
@@ -325,6 +339,7 @@ dot-skill/
 │   ├── slack_auto_collector.py     #   [colleague] Slack auto-collector
 │   ├── email_parser.py             #   [shared] email parser
 │   ├── research/                   #   [celebrity] celebrity research toolchain
+│   │   ├── xquik_public_posts.py   #     bounded public X post candidates
 │   │   ├── download_subtitles.sh   #     subtitle download
 │   │   ├── transcribe_audio.py     #     audio → text
 │   │   ├── srt_to_transcript.py    #     subtitles → transcript
```

**File**: `docs/lang/README_ES.md` (modified, +19/-0)
```diff
@@ -125,6 +125,7 @@ Los Skills de personaje generados también se pueden instalar con un solo comand
 | 🟢 Feishu (auto) | ✅ API | ✅ | ✅ | Solo ingresa un nombre, totalmente automático |
 | 🟡 DingTalk (auto) | ⚠️ Navegador | ✅ | ✅ | La API de DingTalk no soporta historial de mensajes |
 | 🟣 Slack (auto) | ✅ API | — | — | Requiere que el admin instale el Bot; plan gratuito limitado a 90 días |
+| 𝕏 Publicaciones públicas de X | ✅ API | — | — | Candidatos de investigación opcionales y acotados sobre figuras públicas mediante Xquik |
 | 💬 Historial de chat de WeChat | ✅ SQLite | — | — | Exportar primero con WeChatMsg / PyWxDump / 留痕 |
 | 📄 PDF / Imágenes / Capturas | — | ✅ | — | Subida manual |
 | 📦 Exportación JSON de Feishu | ✅ | ✅ | — | Subida manual |
@@ -195,13 +196,30 @@ bash tools/research/download_subtitles.sh "<video-url>" "./tmp/subtitles"
 # Subtítulos → transcripción
 python3 tools/research/srt_to_transcript.py "./tmp/subtitles/example.srt"
 
+# Candidatos de publicaciones públicas de X → JSON normalizado (opcional)
+python3 tools/research/xquik_public_posts.py \
+  --username "<public-handle>" \
+  --limit 20 \
+  --output "/tmp/distilly-x-public-posts.json"
+
+# El Agent verifica autor y permalink y solo incorpora paráfrasis seguras a las notas de investigación.
+
 # Fusionar notas de investigación
 python3 tools/research/merge_research.py "./skills/celebrity/<slug>"
 
+# Eliminar los candidatos temporales de X después de leerlos
+rm "/tmp/distilly-x-public-posts.json"
+
 # Control de calidad
 python3 tools/research/quality_check.py "./skills/celebrity/<slug>/SKILL.md"
 ```
 
+`XQUIK_API_KEY` se lee exclusivamente del entorno. La solicitud envía la consulta pública al proveedor externo Xquik; se factura por cada tweet devuelto y puede consumir créditos. Por eso, el Agent debe confirmar el valor de `--limit` antes de ejecutar la herramienta.
+
+El JSON contiene evidencia candidata no confiable, no evidencia aceptada automáticamente: hay que verificar el autor y el permalink. Solo las publicaciones breves de la propia persona objetivo pueden tratarse como evidencia primaria de formato corto, y siempre pesan menos que las fuentes primarias extensas o los registros de decisiones. Las publicaciones de terceros se degradan o descartan. Conserva únicamente paráfrasis respetuosas con los derechos de autor, nunca guardes el archivo candidato dentro del Skill generado y elimínalo después de leerlo.
+
+Xquik es un proveedor externo independiente y no está afiliado con X Corp. «Twitter» y «X» son marcas comerciales de X Corp.
+
 ---
 
 ## ✨ Demo
@@ -317,6 +335,7 @@ dot-skill/
 │   │   ├── download_subtitles.sh   #     descarga de subtítulos
 │   │   ├── transcribe_audio.py     #     audio → texto
 │   │   ├── srt_to_transcript.py    #     subtítulos → transcripción
+│   │   ├── xquik_public_posts.py   #     publicaciones públicas de X → JSON candidato
 │   │   ├── merge_research.py       #     fusión de investigación de seis dimensiones
 │   │   └── quality_check.py        #     control de calidad
 │   ├── install_*_skill.py          #   [shared] instaladores multi-host de un solo paso
```

**File**: `docs/lang/README_JA.md` (modified, +17/-0)
```diff
@@ -125,6 +125,7 @@ Created by [@titanwings](https://github.com/titanwings)
 | 🟢 Feishu（自動） | ✅ API | ✅ | ✅ | 名前を入力するだけで全自動 |
 | 🟡 DingTalk（自動） | ⚠️ ブラウザ | ✅ | ✅ | DingTalk API はメッセージ履歴に非対応 |
 | 🟣 Slack（自動） | ✅ API | — | — | 管理者による Bot 導入が必要；無料プランは 90 日制限 |
+| 𝕏 公開 X 投稿 | ✅ API | — | — | Xquik 経由の任意・件数制限付き celebrity リサーチ候補 |
 | 💬 WeChat チャット履歴 | ✅ SQLite | — | — | WeChatMsg / PyWxDump / 留痕 で先にエクスポート |
 | 📄 PDF / 画像 / スクリーンショット | — | ✅ | — | 手動アップロード |
 | 📦 Feishu JSON エクスポート | ✅ | ✅ | — | 手動アップロード |
@@ -188,13 +189,28 @@ dot-skill をインストールしたホストで起動します——`/dot-skil
 
 `celebrity` ファミリーには、字幕から完成稿までをカバーするエンドツーエンドのリサーチツールチェーンが同梱されています：
 
+公開 X 投稿の収集は任意です。API キーは環境変数 `XQUIK_API_KEY` からのみ読み込まれます。公開クエリは第三者サービス Xquik に送信され、返された投稿数に応じて課金され、credits を消費する場合があるため、Agent は実行前に `--limit` を確認します。
+
+出力 JSON は信頼できない証拠候補として扱います。著者と permalink を検証し、対象本人の投稿だけを短文の一次資料として使用し、長文の一次資料や意思決定の記録より低い重みにします。第三者の投稿は補助資料に格下げするか破棄し、著作権に配慮した言い換えだけを残します。読み取り後は Skill ディレクトリ外の一時ファイルを削除します。
+
+Xquik は独立した第三者サービスであり、X Corp. との提携関係はありません。「Twitter」と「X」は X Corp. の商標です。
+
 ```bash
 # 動画の字幕をダウンロード
 bash tools/research/download_subtitles.sh "<video-url>" "./tmp/subtitles"
 
 # 字幕 → トランスクリプト
 python3 tools/research/srt_to_transcript.py "./tmp/subtitles/example.srt"
 
+# 公開 X 投稿の候補 → 一時的な正規化 JSON（任意）
+python3 tools/research/xquik_public_posts.py \
+  --username "<public-handle>" \
+  --limit 20 \
+  --output "/tmp/distilly-x-public-posts.json"
+
+# Agent が候補を検証・言い換えした後に削除
+rm "/tmp/distilly-x-public-posts.json"
+
 # リサーチノートを統合
 python3 tools/research/merge_research.py "./skills/celebrity/<slug>"
 
@@ -317,6 +333,7 @@ dot-skill/
 │   │   ├── download_subtitles.sh   #     subtitle download
 │   │   ├── transcribe_audio.py     #     audio → text
 │   │   ├── srt_to_transcript.py    #     subtitles → transcript
+│   │   ├── xquik_public_posts.py   #     public X posts → normalized candidates
 │   │   ├── merge_research.py       #     six-dimension research merge
 │   │   └── quality_check.py        #     quality check
 │   ├── install_*_skill.py          #   [shared] multi-host one-shot installers
```

**File**: `docs/lang/README_KO.md` (modified, +17/-0)
```diff
@@ -125,6 +125,7 @@ Created by [@titanwings](https://github.com/titanwings)
 | 🟢 Feishu (자동) | ✅ API | ✅ | ✅ | 이름만 입력하면 완전 자동 |
 | 🟡 DingTalk (자동) | ⚠️ 브라우저 | ✅ | ✅ | DingTalk API는 메시지 기록 미지원 |
 | 🟣 Slack (자동) | ✅ API | — | — | 관리자가 Bot 설치 필요, 무료 플랜은 90일 제한 |
+| 𝕏 공개 X 게시물 | ✅ API | — | — | Xquik을 통한 선택적·수량 제한 celebrity 리서치 후보 |
 | 💬 WeChat 대화 기록 | ✅ SQLite | — | — | WeChatMsg / PyWxDump / 留痕 으로 먼저 내보내기 |
 | 📄 PDF / 이미지 / 스크린샷 | — | ✅ | — | 수동 업로드 |
 | 📦 Feishu JSON 내보내기 | ✅ | ✅ | — | 수동 업로드 |
@@ -188,13 +189,28 @@ dot-skill이 설치된 호스트에서 `/dot-skill`을 입력하거나, 그냥 A
 
 `celebrity` 패밀리는 자막부터 완성된 초안까지, 엔드 투 엔드 리서치 툴체인을 기본 제공합니다.
 
+공개 X 게시물 수집은 선택 사항입니다. API 키는 환경 변수 `XQUIK_API_KEY`에서만 읽습니다. 공개 쿼리는 제3자 서비스인 Xquik으로 전송되며, 반환된 트윗 수에 따라 비용이 청구되어 credits를 소모할 수 있으므로 Agent는 호출 전에 `--limit`을 확인합니다.
+
+출력 JSON은 신뢰할 수 없는 근거 후보로 다룹니다. 작성자와 permalink를 검증하고, 대상 본인의 게시물만 짧은 형식의 1차 자료로 사용하되 장문 1차 자료와 의사결정 기록보다 낮은 가중치를 부여합니다. 제3자 게시물은 보조 자료로 격하하거나 버리고, 저작권을 침해하지 않는 범위의 요약·재서술만 남깁니다. 읽은 뒤에는 Skill 디렉터리 밖의 임시 파일을 삭제합니다.
+
+Xquik은 독립적인 제3자 서비스이며 X Corp.와 제휴 관계가 없습니다. “Twitter”와 “X”는 X Corp.의 상표입니다.
+
 ```bash
 # 동영상 자막 다운로드
 bash tools/research/download_subtitles.sh "<video-url>" "./tmp/subtitles"
 
 # 자막 → 트랜스크립트
 python3 tools/research/srt_to_transcript.py "./tmp/subtitles/example.srt"
 
+# 공개 X 게시물 후보 → 임시 정규화 JSON (선택)
+python3 tools/research/xquik_public_posts.py \
+  --username "<public-handle>" \
+  --limit 20 \
+  --output "/tmp/distilly-x-public-posts.json"
+
+# Agent가 후보를 검증하고 재서술한 뒤 삭제
+rm "/tmp/distilly-x-public-posts.json"
+
 # 리서치 노트 병합
 python3 tools/research/merge_research.py "./skills/celebrity/<slug>"
 
@@ -317,6 +333,7 @@ dot-skill/
 │   │   ├── download_subtitles.sh   #     자막 다운로드
 │   │   ├── transcribe_audio.py     #     오디오 → 텍스트
 │   │   ├── srt_to_transcript.py    #     자막 → 트랜스크립트
+│   │   ├── xquik_public_posts.py   #     공개 X 게시물 → 정규화 후보
 │   │   ├── merge_research.py       #     6차원 리서치 병합
 │   │   └── quality_check.py        #     품질 점검
 │   ├── install_*_skill.py          #   [공용] 멀티 호스트 원커맨드 설치 스크립트
```

---

### Incident Patch 5: `4c6b7519` (2026-08-23)
**Commit Message**: Merge pull request #135 from LHMQ878/fix/work-only-persona-handoff

fix: keep work-only skills from referring to Persona

**File**: `tests/test_skill_writer.py` (modified, +80/-0)
```diff
@@ -147,6 +147,86 @@ def test_create_skill_renders_chinese_chrome_when_language_is_zh_cn(self) -> Non
             self.assertIn("仅 Work，无 Persona", work_skill)
             self.assertIn("仅 Persona，无工作能力", persona_skill)
 
+    def test_work_only_skill_replaces_persona_handoff(self) -> None:
+        zh_handoff = "如果被问到职责范围外的问题，以该同事的方式回应（参见 Persona 部分）。"
+        en_handoff = (
+            "If you are asked a question outside your recorded responsibilities, "
+            "respond in this colleague's style (see the Persona section)."
+        )
+        zh_work_content = (
+            "## 工作能力使用说明\n\n"
+            "当用户要求你完成以下任务时，严格按照上述规范执行。\n\n"
+            f"{zh_handoff}\n"
+        )
+        en_work_content = (
+            "## Scope rule\n\n"
+            "If asked outside your recorded responsibilities:\n"
+            "- State the evidence gap\n\n"
+            "## Persona naming note\n\n"
+            "Keep this documentation sentence.\n\n"
+            f"{en_handoff}\n"
+        )
+        with tempfile.TemporaryDirectory() as tmp_dir:
+            base_dir = Path(tmp_dir) / "skills" / "colleague"
+            zh_meta = {
+                "name": "Eulalie",
+                "language": "zh-CN",
+                "profile": {
+                    "company": "ByteDance",
+                    "level": "L2-1",
+                    "role": "Backend Engineer",
+                },
+            }
+            en_meta = {
+                "name": "Eulalie",
+                "language": "en",
+                "profile": {
+                    "company": "ByteDance",
+                    "level": "L2-1",
+                    "role": "Backend Engineer",
+                },
+            }
+
+            zh_dir = skill_writer.create_skill(
+                base_dir / "zh",
+                "zhangsan",
+                zh_meta,
+                zh_work_content,
+                "Persona body",
+            )
+            en_dir = skill_writer.create_skill(
+                base_dir / "en",
+                "zhangsan",
+                en_meta,
+                en_work_content,
+                "Persona body",
+            )
+
+            zh_stored_work = (zh_dir / "work.md").read_text(encoding="utf-8")
+            zh_combined = (zh_dir / "SKILL.md").read_text(encoding="utf-8")
+            en_stored_work = (en_dir / "work.md").read_text(encoding="utf-8")
+            en_combined = (en_dir / "SKILL.md").read_text(encoding="utf-8")
+            zh_work_skill = (zh_dir / "work_skill.md").read_text(encoding="utf-8")
+            en_work_skill = (en_dir / "work_skill.md").read_text(encoding="utf-8")
+
+            self.assertIn(zh_handoff, zh_stored_work)
+            self.assertIn(zh_handoff, zh_combined)
+            self.assertIn(en_handoff, en_stored_work)
+            self.assertIn(en_handoff, en_combined)
+            self.assertNotIn(zh_handoff, zh_work_skill)
+            self.assertNotIn(en_handoff, en_work_skill)
+            self.assertIn("If asked outside your recorded responsibilities:", en_work_skill)
+            self.assertIn("## Persona naming note", en_work_skill)
+            self.assertIn("Keep this documentation sentence.", en_work_skill)
+            self.assertIn(skill_writer.WORK_ONLY_FALLBACK_ZH, zh_work_skill)
+            self.assertIn(skill_writer.WORK_ONLY_FALLBACK_EN, en_work_skill)
+            self.assertIn("不要臆造缺失信息", zh_work_skill)
+            self.assertNotIn("不要推断", zh_work_skill)
+            self.assertIn("Do not fabricate missing information", en_work_skill)
+            self.assertNotIn("Do not infer", en_work_skill)
+            self.assertNotIn(skill_writer.WORK_ONLY_FALLBACK_ZH, zh_combined)
+            self.assertNotIn(skill_writer.WORK_ONLY_FALLBACK_EN, en_combined)
+
     def test_create_celebrity_adds_research_dirs_and_toolchain(self) -> None:
         with tempfile.TemporaryDirectory() as tmp_dir:
             base_dir = Path(tmp_dir) / "skills" / "celebrity"
```

**File**: `tools/skill_writer.py` (modified, +36/-2)
```diff
@@ -164,18 +164,52 @@ def render_combined_skill(meta: dict, work_content: str, persona_content: str) -
     )
 
 
+_PERSONA_HANDOFF_PATTERNS = (
+    re.compile(r"如果被问到职责范围外的问题，以该同事的方式回应（参见 Persona 部分）。\s*"),
+    re.compile(
+        r"If (?:you are )?asked (?:a question )?outside (?:your|the) "
+        r"(?:recorded )?responsibilities[^.\n]*Persona[^.\n]*\.\s*",
+        re.IGNORECASE,
+    ),
+)
+
+WORK_ONLY_FALLBACK_ZH = (
+    "如果问题超出已记录的职责范围，或原材料不足以回答，请直接说明缺口。"
+    "不要臆造缺失信息，也不要引用 Persona。"
+)
+WORK_ONLY_FALLBACK_EN = (
+    "If the question is outside the recorded responsibilities or the source "
+    "material is insufficient, state the gap. Do not fabricate missing information "
+    "or refer to Persona."
+)
+
+
+def work_only_content(work_content: str, *, chinese: bool) -> str:
+    """Copy Work text for the Work-only skill, without a Persona handoff."""
+    text = work_content
+    for pattern in _PERSONA_HANDOFF_PATTERNS:
+        text = pattern.sub("", text)
+    text = text.rstrip()
+    fallback = WORK_ONLY_FALLBACK_ZH if chinese else WORK_ONLY_FALLBACK_EN
+    if fallback not in text:
+        text = f"{text}\n\n{fallback}" if text else fallback
+    return text
+
+
 def render_work_skill(meta: dict, work_content: str) -> str:
     """Render the work-only skill artifact."""
     artifacts = meta["artifacts"]
+    chinese = prefers_chinese(meta)
     description = (
         f"{meta['display_name']} 的工作能力（仅 Work，无 Persona）"
-        if prefers_chinese(meta)
+        if chinese
         else f"{meta['display_name']} work capability only (without persona)"
     )
+    body = work_only_content(work_content, chinese=chinese)
     return (
         f"---\nname: {artifacts['work_name']}\n"
         f"description: {description}\n"
-        f"user-invocable: true\n---\n\n{work_content}\n"
+        f"user-invocable: true\n---\n\n{body}\n"
     )
 
 
```

---

### Incident Patch 6: `1cf1ad09` (2026-08-23)
**Commit Message**: fix: make work-only handoff removal line-safe

**File**: `tests/test_skill_writer.py` (modified, +36/-12)
```diff
@@ -148,11 +148,23 @@ def test_create_skill_renders_chinese_chrome_when_language_is_zh_cn(self) -> Non
             self.assertIn("仅 Persona，无工作能力", persona_skill)
 
     def test_work_only_skill_replaces_persona_handoff(self) -> None:
-        handoff = "如果被问到职责范围外的问题，以该同事的方式回应（参见 Persona 部分）。"
-        work_content = (
+        zh_handoff = "如果被问到职责范围外的问题，以该同事的方式回应（参见 Persona 部分）。"
+        en_handoff = (
+            "If you are asked a question outside your recorded responsibilities, "
+            "respond in this colleague's style (see the Persona section)."
+        )
+        zh_work_content = (
             "## 工作能力使用说明\n\n"
             "当用户要求你完成以下任务时，严格按照上述规范执行。\n\n"
-            f"{handoff}\n"
+            f"{zh_handoff}\n"
+        )
+        en_work_content = (
+            "## Scope rule\n\n"
+            "If asked outside your recorded responsibilities:\n"
+            "- State the evidence gap\n\n"
+            "## Persona naming note\n\n"
+            "Keep this documentation sentence.\n\n"
+            f"{en_handoff}\n"
         )
         with tempfile.TemporaryDirectory() as tmp_dir:
             base_dir = Path(tmp_dir) / "skills" / "colleague"
@@ -179,29 +191,41 @@ def test_work_only_skill_replaces_persona_handoff(self) -> None:
                 base_dir / "zh",
                 "zhangsan",
                 zh_meta,
-                work_content,
+                zh_work_content,
                 "Persona body",
             )
             en_dir = skill_writer.create_skill(
                 base_dir / "en",
                 "zhangsan",
                 en_meta,
-                work_content,
+                en_work_content,
                 "Persona body",
             )
 
-            stored_work = (zh_dir / "work.md").read_text(encoding="utf-8")
-            combined = (zh_dir / "SKILL.md").read_text(encoding="utf-8")
+            zh_stored_work = (zh_dir / "work.md").read_text(encoding="utf-8")
+            zh_combined = (zh_dir / "SKILL.md").read_text(encoding="utf-8")
+            en_stored_work = (en_dir / "work.md").read_text(encoding="utf-8")
+            en_combined = (en_dir / "SKILL.md").read_text(encoding="utf-8")
             zh_work_skill = (zh_dir / "work_skill.md").read_text(encoding="utf-8")
             en_work_skill = (en_dir / "work_skill.md").read_text(encoding="utf-8")
 
-            self.assertIn(handoff, stored_work)
-            self.assertIn(handoff, combined)
-            self.assertNotIn(handoff, zh_work_skill)
-            self.assertNotIn(handoff, en_work_skill)
+            self.assertIn(zh_handoff, zh_stored_work)
+            self.assertIn(zh_handoff, zh_combined)
+            self.assertIn(en_handoff, en_stored_work)
+            self.assertIn(en_handoff, en_combined)
+            self.assertNotIn(zh_handoff, zh_work_skill)
+            self.assertNotIn(en_handoff, en_work_skill)
+            self.assertIn("If asked outside your recorded responsibilities:", en_work_skill)
+            self.assertIn("## Persona naming note", en_work_skill)
+            self.assertIn("Keep this documentation sentence.", en_work_skill)
             self.assertIn(skill_writer.WORK_ONLY_FALLBACK_ZH, zh_work_skill)
             self.assertIn(skill_writer.WORK_ONLY_FALLBACK_EN, en_work_skill)
-            self.assertNotIn(skill_writer.WORK_ONLY_FALLBACK_ZH, combined)
+            self.assertIn("不要臆造缺失信息", zh_work_skill)
+            self.assertNotIn("不要推断", zh_work_skill)
+            self.assertIn("Do not fabricate missing information", en_work_skill)
+            self.assertNotIn("Do not infer", en_work_skill)
+            self.assertNotIn(skill_writer.WORK_ONLY_FALLBACK_ZH, zh_combined)
+            self.assertNotIn(skill_writer.WORK_ONLY_FALLBACK_EN, en_combined)
 
     def test_create_celebrity_adds_research_dirs_and_toolchain(self) -> None:
         with tempfile.TemporaryDirectory() as tmp_dir:
```

**File**: `tools/skill_writer.py` (modified, +4/-3)
```diff
@@ -168,18 +168,19 @@ def render_combined_skill(meta: dict, work_content: str, persona_content: str) -
     re.compile(r"如果被问到职责范围外的问题，以该同事的方式回应（参见 Persona 部分）。\s*"),
     re.compile(
         r"If (?:you are )?asked (?:a question )?outside (?:your|the) "
-        r"(?:recorded )?responsibilities[^.]*Persona[^.]*\.\s*",
+        r"(?:recorded )?responsibilities[^.\n]*Persona[^.\n]*\.\s*",
         re.IGNORECASE,
     ),
 )
 
 WORK_ONLY_FALLBACK_ZH = (
     "如果问题超出已记录的职责范围，或原材料不足以回答，请直接说明缺口。"
-    "不要推断，也不要引用 Persona。"
+    "不要臆造缺失信息，也不要引用 Persona。"
 )
 WORK_ONLY_FALLBACK_EN = (
     "If the question is outside the recorded responsibilities or the source "
-    "material is insufficient, state the gap. Do not infer or refer to Persona."
+    "material is insufficient, state the gap. Do not fabricate missing information "
+    "or refer to Persona."
 )
 
 
```

---

### Incident Patch 7: `e1057f7f` (2026-08-23)
**Commit Message**: docs: simplify Skill host guidance

**File**: `README.md` (modified, +17/-33)
```diff
@@ -119,17 +119,17 @@ Each family has its own prompt pipeline, source-collection strategy, and generat
 
 ### 3️⃣ More Agent hosts
 
-The old version only ran in Claude Code. Distilly now follows native local Skill discovery across seven agent hosts; each host keeps its own invocation syntax.
-
-| Host | Discovery and invocation |
-|------|--------------------------|
-| 🟣 **Claude Code** | `~/.claude/skills/distilly` → `/distilly` |
-| 🟠 **Hermes Agent** | Local Skill installer → `/distilly` |
-| 🔵 **OpenClaw** | Workspace Skill → `/distilly`; fallback `/skill distilly` |
-| ⚫ **Codex** | `~/.agents/skills/distilly` → `$distilly` or `/skills` |
-| 🔷 **DeepSeek Harness** | Native filesystem Skill → `/distilly` |
-| 🟢 **Pi coding agent** | Native Agent Skill → `/skill:distilly` |
-| ⚪ **Grok Build** | Native filesystem Skill → `/distilly` |
+The old version only ran in Claude Code. Distilly now supports native local Skill discovery across seven agent hosts.
+
+| Supported host |
+|----------------|
+| 🟣 **Claude Code** |
+| 🟠 **Hermes Agent** |
+| 🔵 **OpenClaw** |
+| ⚫ **Codex** |
+| 🔷 **DeepSeek Harness** |
+| 🟢 **Pi coding agent** |
+| ⚪ **Grok Build** |
 
 **Grok Bot preview:** Grok Bot supports saved/private Skills, but its official docs do not describe direct local `SKILL.md` imports. Distilly's workflow can be migrated manually into a saved Skill; direct repo installation is not yet verified.
 
@@ -159,11 +159,11 @@ It's 2026 — you have an Agent, let it install itself. Open a supported local a
 
 > Install Distilly for me: `https://github.com/titanwings/colleague-skill`
 
-The Agent should install the repository as a Skill named `distilly`, then use the host-specific command shown below.
+The Agent should install the repository as a Skill named `distilly`, then verify that the host discovers Distilly.
 
 > **Upgrading an old install?** A `git pull` inside a `dot-skill` or legacy
 > `~/.codex/skills/...` directory does not rename that discovery directory.
-> Install a canonical `distilly` copy, verify the new host command, and only then
+> Install a canonical `distilly` copy, verify that the host discovers Distilly, and only then
 > retire the old copy. See [Existing-install migration](INSTALL.md#从旧安装迁移).
 
 <details>
@@ -197,35 +197,19 @@ private source material or rename the source Skill. Pass `--skills-dir` for a
 project-level target. Hermes scans `~/.agents/skills` only when it is explicitly
 added to `skills.external_dirs`.
 
-> For Lark/DingTalk auto-collection credentials, host-specific commands, Grok Bot's preview workflow, Windows-specific handling, etc., see **[Detailed Install Guide (INSTALL.md)](INSTALL.md)**
+> For Lark/DingTalk auto-collection credentials, host-specific installation details, Grok Bot's preview workflow, Windows-specific handling, etc., see **[Detailed Install Guide (INSTALL.md)](INSTALL.md)**
 
 > **Lark region note:** the current compatibility collector connects to the China-region `open.feishu.cn` / `feishu.cn` endpoints. International `larksuite.com` tenant routing is not implemented yet.
 
 ---
 
 ## 🚀 Usage
 
-In the host where Distilly is installed, invoke the `distilly` Skill with that host's syntax below, or tell your Agent "start Distilly".
-
-It first asks which family you want to distill: `colleague` · `relationship` · `celebrity`.
+Distilly first asks which family you want to distill: `colleague` · `relationship` · `celebrity`.
 
 Then enter alias, basic profile, personality tags, and pick a data source. All fields can be skipped — even a description alone can generate a Skill.
 
-Once created, its Skill name is `{character}-{slug}`; invoke it with the same host-specific syntax.
-
-### 🎛️ Commands
-
-| Command | Description |
-|---------|-------------|
-| `/distilly` | Creator in Claude Code, Hermes, DeepSeek Harness, and Grok Build |
-| `/distilly` or `/skill distilly` | Creator in OpenClaw |
-| `$distilly` or `/skills` | Creator in Codex |
-| `/skill:distilly` | Creator in Pi coding agent |
-| `/{character}-{slug}` | Generated Skill in slash-name hosts |
-| `${character}-{slug}` | Generated Skill in Codex |
-| `/skill:{character}-{slug}` | Generated Skill in Pi |
-| `python3 tools/skill_writer.py --action list ...` | List generated Skills across all three families |
-| `python3 tools/version_manager.py --action rollback ...` | Roll back a Skill version |
+Once created, its Skill name is `{character}-{slug}`.
 
 ### 🔬 Celebrity Research Toolchain
 
@@ -418,7 +402,7 @@ distilly/
 
 ## 📝 Citation
 
-If you use **Distilly**, its `/distilly` creator, or **COLLEAGUE.SKILL** in your research or applications, please cite the technical report:
+If you use **Distilly** or **COLLEAGUE.SKILL** in your research or applications, please cite the technical report:
 
 ```bibtex
 @misc{zhou2026colleagueskill,
```

**File**: `docs/lang/README_DE.md` (modified, +17/-43)
```diff
@@ -63,7 +63,7 @@ Riesigen Dank an alle, die einen Stern dagelassen haben — wir liefern weiter a
 
 </div>
 
-> 🧬 **Update 2026.08.23** — Der Creator heißt jetzt durchgängig **Distilly**. Die lokale Skill-Erkennung für Claude Code, Hermes, OpenClaw, Codex, DeepSeek Harness, Pi und Grok Build ist nach den aktuellen Host-Konventionen dokumentiert; Grok Bot bleibt ein separater Preview-Ablauf für gespeicherte Skills.
+> 🧬 **Update 2026.08.23** — Der Creator heißt jetzt durchgängig **Distilly**. Lokale Skill-Erkennung wird für Claude Code, Hermes, OpenClaw, Codex, DeepSeek Harness, Pi und Grok Build unterstützt; Grok Bot bleibt ein separater Preview-Ablauf für gespeicherte Skills.
 
 > 📝 **Update 2026.06.01** — **[Der technische Bericht zu COLLEAGUE.SKILL](https://arxiv.org/pdf/2605.31264) ist jetzt verfügbar**; am meisten freut uns nicht nur das Paper selbst, sondern dass die Community die Galerie auf 215 Skills von 165 Mitwirkenden und 100k+ kumulative Skill-Card-Stars gebracht hat, mit allen Community-Beiträgern in den Acknowledgements.
 
@@ -113,21 +113,21 @@ Jede Familie hat ihre eigene Prompt-Pipeline, Quellsammelstrategie und Generieru
 
 ### 3️⃣ Mehr Agent-Hosts
 
-Distilly folgt auf sieben Agent-Hosts der lokalen, nativen Skill-Erkennung; jeder Host behält seine eigene Aufrufsyntax:
+Distilly unterstützt die lokale, native Skill-Erkennung auf sieben Agent-Hosts:
 
-| Host | Nativer Startbefehl |
-|------|---------------------|
-| 🟣 **Claude Code** | `/distilly` |
-| 🟠 **Hermes Agent** | `/distilly` |
-| 🔵 **OpenClaw** | `/distilly` (Fallback: `/skill distilly`) |
-| ⚫ **Codex** | `$distilly` oder `/skills` |
-| 🟡 **DeepSeek Harness** | `/distilly` |
-| 🟢 **Pi coding agent** | `/skill:distilly` |
-| 🔴 **Grok Build** | `/distilly` |
+| Unterstützte Hosts |
+|--------------------|
+| 🟣 **Claude Code** |
+| 🟠 **Hermes Agent** |
+| 🔵 **OpenClaw** |
+| ⚫ **Codex** |
+| 🟡 **DeepSeek Harness** |
+| 🟢 **Pi coding agent** |
+| 🔴 **Grok Build** |
 
 Generierte Charakter-Skills verwenden dasselbe Agent-Skills-Format und können in das Skill-Verzeichnis eines unterstützten Hosts gelegt werden.
 
-**Grok Bot (Preview)** ist ein separater, manueller Ablauf: Übertrage den Distilly-Workflow manuell in einen gespeicherten privaten Skill und aktiviere ihn für den gewünschten Bot. Die direkte Installation der `SKILL.md` dieses Repositories in Grok Bot ist weder offiziell dokumentiert noch verifiziert.
+**Grok Bot (Preview):** manuelle Migration als gespeicherter privater Skill. Die direkte Installation der `SKILL.md` dieses Repositories in Grok Bot ist weder offiziell dokumentiert noch verifiziert.
 
 ---
 
@@ -155,7 +155,7 @@ Wir schreiben 2026 — du hast einen Agenten, lass ihn sich selbst installieren.
 
 > Installiere Distilly für mich: `https://github.com/titanwings/colleague-skill`
 
-Der Agent erkennt das Skills-Verzeichnis des aktuellen Hosts, klont das Repo als `distilly` und registriert den nativen Einstiegspunkt. Der genaue Startbefehl hängt vom Host ab und ist in der Nutzungstabelle unten aufgeführt.
+Der Agent erkennt das Skills-Verzeichnis des aktuellen Hosts, klont das Repo als `distilly` und sorgt dafür, dass der Host Distilly erkennt.
 
 <details>
 <summary><b>🛠️ Lieber selbst installieren? Klicken für die Pfade</b></summary>
@@ -186,31 +186,19 @@ git clone https://github.com/titanwings/colleague-skill <TARGET>
 > python3 tools/install_hermes_skill.py --force
 > ```
 >
-> Alternativ klonst du das Repository erneut in den oben für den Host angegebenen kanonischen `distilly`-Pfad. Prüfe zuerst mit dem neuen Host-Aufruf aus der Nutzungstabelle, dass Distilly erkannt wird, und behandle das alte Verzeichnis erst danach manuell; automatisches Löschen wird ausdrücklich nicht empfohlen. Legacy-Fallbacks für Konfiguration und Metadaten dienen nur der Kompatibilität mit alten Daten und benennen ein vorhandenes Installationsverzeichnis nicht automatisch um.
+> Alternativ klonst du das Repository erneut in den oben für den Host angegebenen kanonischen `distilly`-Pfad. Prüfe zuerst, dass der Host Distilly erkennt, und behandle das alte Verzeichnis erst danach manuell; automatisches Löschen wird ausdrücklich nicht empfohlen. Legacy-Fallbacks für Konfiguration und Metadaten dienen nur der Kompatibilität mit alten Daten und benennen ein vorhandenes Installationsverzeichnis nicht automatisch um.
 
-> Für Lark/DingTalk-Zugangsdaten zur automatischen Erfassung, host-spezifische Befehle, den Preview-Ablauf für Grok Bot, Windows-spezifische Hinweise usw. siehe **[Ausführliche Installationsanleitung (INSTALL.md)](../../INSTALL.md)**
+> Für Lark/DingTalk-Zugangsdaten zur automatischen Erfassung, weitere Installationsdetails, den Preview-Status von Grok Bot und Kompatibilitätshinweise siehe **[Ausführliche Installationsanleitung (INSTALL.md)](../../INSTALL.md)**
 
 ---
 
 ## 🚀 Nutzung
 
-Starte Distilly mit der nativen Syntax deines Hosts oder sag deinem Agenten einfach „starte Distilly“:
-
-| Host | Distilly star
```

**File**: `docs/lang/README_EN.md` (modified, +16/-32)
```diff
@@ -119,17 +119,17 @@ Each family has its own prompt pipeline, source-collection strategy, and generat
 
 ### 3️⃣ More Agent hosts
 
-The old version only ran in Claude Code. Distilly now follows native local Skill discovery across seven agent hosts; each host keeps its own invocation syntax.
-
-| Host | Discovery and invocation |
-|------|--------------------------|
-| 🟣 **Claude Code** | `~/.claude/skills/distilly` → `/distilly` |
-| 🟠 **Hermes Agent** | Local Skill installer → `/distilly` |
-| 🔵 **OpenClaw** | Workspace Skill → `/distilly`; fallback `/skill distilly` |
-| ⚫ **Codex** | `~/.agents/skills/distilly` → `$distilly` or `/skills` |
-| 🔷 **DeepSeek Harness** | Native filesystem Skill → `/distilly` |
-| 🟢 **Pi coding agent** | Native Agent Skill → `/skill:distilly` |
-| ⚪ **Grok Build** | Native filesystem Skill → `/distilly` |
+The old version only ran in Claude Code. Distilly now supports native local Skill discovery across seven agent hosts.
+
+| Supported host |
+|----------------|
+| 🟣 **Claude Code** |
+| 🟠 **Hermes Agent** |
+| 🔵 **OpenClaw** |
+| ⚫ **Codex** |
+| 🔷 **DeepSeek Harness** |
+| 🟢 **Pi coding agent** |
+| ⚪ **Grok Build** |
 
 **Grok Bot preview:** Grok Bot supports saved/private Skills, but its official docs do not describe direct local `SKILL.md` imports. Distilly's workflow can be migrated manually into a saved Skill; direct repo installation is not yet verified.
 
@@ -159,7 +159,7 @@ It's 2026 — you have an Agent, let it install itself. Open a supported local a
 
 > Install Distilly for me: `https://github.com/titanwings/colleague-skill`
 
-The Agent should install the repository as a Skill named `distilly`, then use the host-specific command shown below.
+The Agent should install the repository as a Skill named `distilly`, then verify that the host discovers Distilly.
 
 <details>
 <summary><b>🛠️ Want to install it yourself? Click for paths</b></summary>
@@ -182,7 +182,7 @@ git clone https://github.com/titanwings/colleague-skill <TARGET>
 
 </details>
 
-> **Migrating an existing install:** A clone still named `dot-skill`, or one left under the legacy `~/.codex/skills` root, is not guaranteed to expose the new `distilly` entrypoint after `git pull` alone. From the old clone's root, run the applicable repository installer (`tools/install_openclaw_skill.py`, `tools/install_codex_skill.py`, or `tools/install_hermes_skill.py`), or clone again into the canonical `distilly` path for that host shown above. Verify the new host-specific invocation first, then decide manually how to handle the old directory; do not delete it automatically. Legacy config/meta fallbacks keep old data readable but do not rename an installed directory.
+> **Migrating an existing install:** A clone still named `dot-skill`, or one left under the legacy `~/.codex/skills` root, is not guaranteed to expose the new `distilly` entrypoint after `git pull` alone. From the old clone's root, run the applicable repository installer (`tools/install_openclaw_skill.py`, `tools/install_codex_skill.py`, or `tools/install_hermes_skill.py`), or clone again into the canonical `distilly` path for that host shown above. Verify that the host discovers Distilly first, then decide manually how to handle the old directory; do not delete it automatically. Legacy config/meta fallbacks keep old data readable but do not rename an installed directory.
 
 Install a generated character Skill from the repository root with the unified installer:
 
@@ -203,35 +203,19 @@ The installer normalizes legacy underscore frontmatter to the canonical kebab-ca
 
 For a project-level Hermes install, first trust the project with `hermes skills trust`. After installing, start a new Hermes session or run `/reload-skills`. `~/.agents/skills` is not a Hermes default; Hermes uses it only when explicitly added to `skills.external_dirs`.
 
-> For Lark/DingTalk auto-collection credentials, host-specific commands, Grok Bot's preview workflow, Windows-specific handling, etc., see **[Detailed Install Guide (INSTALL.md)](../../INSTALL.md)**
+> For Lark/DingTalk auto-collection credentials, host-specific installation details, Grok Bot's preview workflow, Windows-specific handling, etc., see **[Detailed Install Guide (INSTALL.md)](../../INSTALL.md)**
 
 > **Lark region note:** the current compatibility collector connects to the China-region `open.feishu.cn` / `feishu.cn` endpoints. International `larksuite.com` tenant routing is not implemented yet.
 
 ---
 
 ## 🚀 Usage
 
-In the host where Distilly is installed, invoke the `distilly` Skill with that host's syntax below, or tell your Agent "start Distilly".
-
-It first asks which family you want to distill: `colleague` · `relationship` · `celebrity`.
+Distilly first asks which family you want to distill: `colleague` · `relationship` · `celebrity`.
 
 Then enter alias, basic profile, personality tags, and pick a data source. All fields can be skipped — even a description alone can generate a Skill.
 
-O
```

**File**: `docs/lang/README_ES.md` (modified, +17/-43)
```diff
@@ -63,7 +63,7 @@ Gracias enormes a todos los que nos dieron star — seguiremos publicando, segui
 
 </div>
 
-> 🧬 **Actualización 2026.08.23** — El creador ahora se llama **Distilly** de extremo a extremo. La detección local de Skills para Claude Code, Hermes, OpenClaw, Codex, DeepSeek Harness, Pi y Grok Build está documentada según las convenciones actuales de cada host; Grok Bot se mantiene aparte como preview de Skills guardados.
+> 🧬 **Actualización 2026.08.23** — El creador ahora se llama **Distilly** de extremo a extremo. La detección local de Skills es compatible con Claude Code, Hermes, OpenClaw, Codex, DeepSeek Harness, Pi y Grok Build; Grok Bot se mantiene aparte como preview de Skills guardados.
 
 > 📝 **Actualización 2026.06.01** — **[El informe técnico de COLLEAGUE.SKILL](https://arxiv.org/pdf/2605.31264) ya está disponible**; lo que más nos alegra no es solo haber publicado un paper, sino ver cómo la comunidad llevó la galería a 215 skills de 165 contribuidores y 100k+ stars acumuladas en skill cards, con todos los contribuidores reconocidos en los Acknowledgements.
 
@@ -113,21 +113,21 @@ Cada familia tiene su propio pipeline de prompts, estrategia de recolección de
 
 ### 3️⃣ Más hosts de Agent
 
-Distilly sigue el descubrimiento local y nativo de Skills en siete hosts de Agent; cada host conserva su propia sintaxis de invocación:
+Distilly admite el descubrimiento local y nativo de Skills en siete hosts de Agent:
 
-| Host | Inicio nativo |
-|------|---------------|
-| 🟣 **Claude Code** | `/distilly` |
-| 🟠 **Hermes Agent** | `/distilly` |
-| 🔵 **OpenClaw** | `/distilly` (alternativa: `/skill distilly`) |
-| ⚫ **Codex** | `$distilly` o `/skills` |
-| 🟡 **DeepSeek Harness** | `/distilly` |
-| 🟢 **Pi coding agent** | `/skill:distilly` |
-| 🔴 **Grok Build** | `/distilly` |
+| Hosts compatibles |
+|-------------------|
+| 🟣 **Claude Code** |
+| 🟠 **Hermes Agent** |
+| 🔵 **OpenClaw** |
+| ⚫ **Codex** |
+| 🟡 **DeepSeek Harness** |
+| 🟢 **Pi coding agent** |
+| 🔴 **Grok Build** |
 
 Los Skills de personaje generados usan el mismo formato Agent Skills y pueden colocarse en el directorio de Skills de un host compatible.
 
-**Grok Bot (preview)** usa un flujo manual aparte: migra el workflow de Distilly a un Skill privado guardado y actívalo para el Bot correspondiente. La instalación directa del `SKILL.md` de este repositorio en Grok Bot no está documentada oficialmente ni verificada.
+**Grok Bot (preview):** migración manual como Skill privado guardado. La instalación directa del `SKILL.md` de este repositorio en Grok Bot no está documentada oficialmente ni verificada.
 
 ---
 
@@ -155,7 +155,7 @@ Estamos en 2026 — tienes un Agent, deja que se instale solo. Abre tu host loca
 
 > Instálame Distilly: `https://github.com/titanwings/colleague-skill`
 
-El Agent detectará el directorio de skills del host actual, clonará el repo como `distilly` y registrará su punto de entrada nativo. El comando de inicio depende del host y aparece en la tabla de uso de abajo.
+El Agent detectará el directorio de skills del host actual, clonará el repo como `distilly` y permitirá que el host descubra Distilly.
 
 <details>
 <summary><b>🛠️ ¿Quieres instalarlo tú mismo? Haz clic para ver las rutas</b></summary>
@@ -186,31 +186,19 @@ git clone https://github.com/titanwings/colleague-skill <TARGET>
 > python3 tools/install_hermes_skill.py --force
 > ```
 >
-> Como alternativa, vuelve a clonar el repositorio en la ruta canónica `distilly` indicada arriba para ese host. Primero verifica que Distilly se detecte con el nuevo comando del host mostrado en la tabla de uso; solo después gestiona manualmente el directorio anterior. No se recomienda borrarlo de forma automática. Los fallbacks legacy de configuración y metadatos solo mantienen la compatibilidad con datos anteriores y no cambian automáticamente el nombre del directorio de instalación.
+> Como alternativa, vuelve a clonar el repositorio en la ruta canónica `distilly` indicada arriba para ese host. Primero verifica que el host descubra Distilly; solo después gestiona manualmente el directorio anterior. No se recomienda borrarlo de forma automática. Los fallbacks legacy de configuración y metadatos solo mantienen la compatibilidad con datos anteriores y no cambian automáticamente el nombre del directorio de instalación.
 
-> Para credenciales de recolección automática de Lark/DingTalk, comandos específicos de cada host, el preview de Grok Bot, manejo específico de Windows, etc., consulta la **[Guía de instalación detallada (INSTALL.md)](../../INSTALL.md)**
+> Para credenciales de recolección automática de Lark/DingTalk, más detalles de instalación, el estado preview de Grok Bot y notas de compatibilidad, consulta la **[Guía de instalación detallada (INSTALL.md)](../../INSTALL.md)**
 
 ---
 
 ## 🚀 Uso
 
-Inicia Distilly con la sintaxis nativa de tu host o simplemente dile a tu Agent «inicia Distilly»:
-
-| Host | Iniciar Distilly |
-|------|---------------
```

**File**: `docs/lang/README_JA.md` (modified, +16/-42)
```diff
@@ -113,17 +113,17 @@ Distilly は「同僚」シナリオだけを想定した作りではありま
 
 ### 3️⃣ 対応Agentホストの拡大
 
-Distilly は、7つの Agent ホストでローカルかつネイティブな Skill 検出方式に従い、各ホスト固有の呼び出し構文を使います：
-
-| ホスト | ネイティブ起動 |
-|------|----------------|
-| 🟣 **Claude Code** | `/distilly` |
-| 🟠 **Hermes Agent** | `/distilly` |
-| 🔵 **OpenClaw** | `/distilly`（代替：`/skill distilly`） |
-| ⚫ **Codex** | `$distilly` または `/skills` |
-| 🟡 **DeepSeek Harness** | `/distilly` |
-| 🟢 **Pi coding agent** | `/skill:distilly` |
-| 🔴 **Grok Build** | `/distilly` |
+Distilly は、7つのローカル Agent ホストに対応しています：
+
+| 対応ホスト |
+|------------|
+| 🟣 **Claude Code** |
+| 🟠 **Hermes Agent** |
+| 🔵 **OpenClaw** |
+| ⚫ **Codex** |
+| 🔷 **DeepSeek Harness** |
+| 🟢 **Pi coding agent** |
+| ⚪ **Grok Build** |
 
 生成されたキャラクター Skill も同じ Agent Skills 形式を使い、対応ホストの Skill ディレクトリに配置できます。
 
@@ -155,7 +155,7 @@ Distilly は、7つの Agent ホストでローカルかつネイティブな Sk
 
 > Distilly をインストールして：`https://github.com/titanwings/colleague-skill`
 
-Agent は現在のホストの skills ディレクトリを検出し、リポジトリを `distilly` として clone して、ネイティブのエントリポイントを登録します。起動コマンドはホストごとに異なり、下の使い方の表にまとめています。
+Agent は現在のホストの skills ディレクトリを検出し、リポジトリを `distilly` として clone して、ホストが Distilly を検出できることを確認します。
 
 <details>
 <summary><b>🛠️ 自分でインストールしたい？パスはこちら</b></summary>
@@ -186,31 +186,19 @@ git clone https://github.com/titanwings/colleague-skill <TARGET>
 > python3 tools/install_hermes_skill.py --force
 > ```
 >
-> または、上の表にある対象ホストの canonical な `distilly` パスへリポジトリを clone し直します。まず使い方の表にある新しいホスト呼び出しで Distilly が検出されることを確認し、その後で古いディレクトリを手動で扱ってください。自動削除は推奨しません。設定やメタデータの legacy fallback は古いデータとの互換性だけを目的としており、既存のインストールディレクトリを自動的に改名するものではありません。
+> または、上の表にある対象ホストの canonical な `distilly` パスへリポジトリを clone し直します。まずホストが Distilly を検出できることを確認し、その後で古いディレクトリを手動で扱ってください。自動削除は推奨しません。設定やメタデータの legacy fallback は古いデータとの互換性だけを目的としており、既存のインストールディレクトリを自動的に改名するものではありません。
 
-> Lark/DingTalk 自動収集のクレデンシャル、ホスト固有のコマンド、Grok Bot の preview フロー、Windows 固有の注意点などは **[詳細インストールガイド (INSTALL.md)](../../INSTALL.md)** を参照してください。
+> Lark/DingTalk 自動収集のクレデンシャル、各ホストへのインストール方法、Grok Bot の preview フロー、Windows の互換性情報などは **[詳細インストールガイド (INSTALL.md)](../../INSTALL.md)** を参照してください。
 
 ---
 
 ## 🚀 使い方
 
-ホスト固有の構文で Distilly を起動するか、Agent に「Distilly を起動して」と伝えます：
-
-| ホスト | Distilly の起動方法 |
-|------|----------------------|
-| Claude Code | `/distilly` |
-| Hermes Agent | `/distilly` |
-| OpenClaw | `/distilly`（代替：`/skill distilly`） |
-| Codex | `$distilly` または `/skills` |
-| DeepSeek Harness | `/distilly` |
-| Pi coding agent | `/skill:distilly` |
-| Grok Build | `/distilly` |
-
-まずどのファミリーを蒸留するか聞かれます：`colleague`、`relationship`、`celebrity` のいずれか。
+Distilly の作成フローでは、まずどのファミリーを蒸留するか聞かれます：`colleague`、`relationship`、`celebrity` のいずれか。
 
 次にニックネーム、基本プロフィール、性格タグを入力し、データソースを選びます。すべての項目はスキップ可能——説明文だけでも Skill は生成できます。
 
-生成される Skill 名は `{character}-{slug}` です。各ホストの構文で呼び出します。
+生成される Skill 名は `{character}-{slug}` で、対応する任意のホストにインストールできます。
 
 #### 統一インストーラーで生成済み Skill をインストールする
 
@@ -235,20 +223,6 @@ Hermes はデフォルトでは `~/.agents/skills` を検索しません。Herme
 
 インストーラーは、legacy のアンダースコア形式の frontmatter 名をインストール先のコピーだけで canonical kebab 形式の `{character}-{slug}` に正規化します。ソースディレクトリは変更しません。インストール先に入るのは自己完結型の `SKILL.md` と `.distilly-install.json` だけで、非公開の元素材はコピーされません。
 
-### 🎛️ コマンド
-
-| コマンド | 説明 |
-|---------|------|
-| `/distilly` | Claude Code、Hermes、DeepSeek Harness、Grok Build の Creator |
-| `/distilly` または `/skill distilly` | OpenClaw の Creator |
-| `$distilly` または `/skills` | Codex の Creator |
-| `/skill:distilly` | Pi coding agent の Creator |
-| `/{character}-{slug}` | slash-name ホストの生成 Skill |
-| `${character}-{slug}` | Codex の生成 Skill |
-| `/skill:{character}-{slug}` | Pi の生成 Skill |
-| `python3 tools/skill_writer.py --action list ...` | 3 ファミリー横断で生成済み Skill を一覧表示 |
-| `python3 tools/version_manager.py --action rollback ...` | Skill のバージョンをロールバック |
-
 ### 🔬 Celebrity Research Toolchain
 
 `celebrity` ファミリーには、字幕から完成稿までをカバーするエンドツーエンドのリサーチツールチェーンが同梱されています：
```

**File**: `docs/lang/README_KO.md` (modified, +17/-34)
```diff
@@ -113,21 +113,21 @@ Distilly는 더 이상 “동료” 시나리오에만 묶여 있지 않습니
 
 ### 3️⃣ 더 많은 Agent 호스트
 
-예전 버전은 Claude Code에서만 동작했지만, 이제 일곱 개의 로컬 `SKILL.md` 호스트가 Distilly를 네이티브 형식으로 탐색할 수 있습니다. 명시적 호출 문법은 호스트마다 다릅니다.
-
-| 호스트 | Distilly 호출 |
-|--------|---------------|
-| 🟣 **Claude Code** | `/distilly` |
-| 🟠 **Hermes Agent** | `/distilly` |
-| 🔵 **OpenClaw** | `/distilly`, 필요하면 `/skill distilly` |
-| ⚫ **Codex** | `$distilly` 또는 `/skills`에서 선택 |
-| 🔷 **DeepSeek Harness** | `/distilly` |
-| 🟡 **Pi coding agent** | `/skill:distilly` |
-| ⚪ **Grok Build** | `/distilly` |
+예전 버전은 Claude Code에서만 동작했지만, 이제 Distilly는 일곱 개의 로컬 Agent 호스트를 지원합니다.
+
+| 지원 호스트 |
+|-------------|
+| 🟣 **Claude Code** |
+| 🟠 **Hermes Agent** |
+| 🔵 **OpenClaw** |
+| ⚫ **Codex** |
+| 🔷 **DeepSeek Harness** |
+| 🟢 **Pi coding agent** |
+| ⚪ **Grok Build** |
 
 생성된 캐릭터 Skill도 같은 Agent Skills 형식을 사용하며, 각 호스트의 Skill 디렉터리에 설치할 수 있습니다.
 
-**Grok Bot 프리뷰:** Distilly workflow를 private saved skill로 수동 이전하고 Settings → Plugins에서 해당 Bot에 활성화한 뒤, 작성창에서 `/`를 입력해 선택합니다. 현재 저장소의 `SKILL.md`를 Grok Bot에 직접 설치하는 방식은 공식 문서에 없고 검증되지도 않았습니다.
+**Grok Bot 프리뷰:** Distilly workflow를 private saved Skill로 수동 이전할 수 있습니다. 현재 저장소의 `SKILL.md`를 Grok Bot에 직접 설치하는 방식은 공식 문서에 없고 검증되지도 않았습니다.
 
 ---
 
@@ -155,7 +155,7 @@ Distilly는 더 이상 “동료” 시나리오에만 묶여 있지 않습니
 
 > Distilly를 설치해 줘: `https://github.com/titanwings/colleague-skill`
 
-Agent가 현재 호스트의 스킬 디렉터리를 탐지해 저장소를 클론하고 `distilly` 엔트리포인트를 등록합니다. 완료되면 아래의 호스트별 호출 문법을 사용하세요.
+Agent가 현재 호스트의 스킬 디렉터리를 탐지해 저장소를 클론하고 `distilly` 엔트리포인트를 등록한 뒤, 호스트가 Distilly를 발견할 수 있는지 확인합니다.
 
 <details>
 <summary><b>🛠️ 직접 설치하고 싶으신가요? 경로 보기</b></summary>
@@ -186,21 +186,19 @@ git clone https://github.com/titanwings/colleague-skill <TARGET>
 > python3 tools/install_hermes_skill.py --force
 > ```
 >
-> 또는 위 표에 나온 해당 호스트의 canonical `distilly` 경로로 저장소를 다시 clone하세요. 먼저 아래 사용법 표의 새 호스트 호출로 Distilly가 발견되는지 확인하고, 그 다음에만 이전 디렉터리를 사용자가 직접 처리하세요. 자동 삭제는 권장하지 않습니다. 설정과 메타데이터의 legacy fallback은 이전 데이터와의 호환성만 제공하며 기존 설치 디렉터리 이름을 자동으로 바꾸지 않습니다.
+> 또는 위 표에 나온 해당 호스트의 canonical `distilly` 경로로 저장소를 다시 clone하세요. 먼저 호스트가 Distilly를 발견할 수 있는지 확인하고, 그 다음에만 이전 디렉터리를 사용자가 직접 처리하세요. 자동 삭제는 권장하지 않습니다. 설정과 메타데이터의 legacy fallback은 이전 데이터와의 호환성만 제공하며 기존 설치 디렉터리 이름을 자동으로 바꾸지 않습니다.
 
-> Lark/DingTalk 자동 수집 자격 증명, 호스트별 명령, Grok Bot 프리뷰 흐름, Windows 전용 처리 등은 **[상세 설치 가이드 (INSTALL.md)](../../INSTALL.md)** 를 참고하세요.
+> Lark/DingTalk 자동 수집 자격 증명, 호스트별 설치 방법, Grok Bot 프리뷰 흐름, Windows 호환성 안내 등은 **[상세 설치 가이드 (INSTALL.md)](../../INSTALL.md)** 를 참고하세요.
 
 ---
 
 ## 🚀 사용법
 
-Distilly가 설치된 호스트에서 아래 표의 문법으로 호출하거나, Agent에게 “Distilly 시작해”라고 말하세요.
-
-먼저 어떤 패밀리를 증류할지 묻습니다: `colleague` · `relationship` · `celebrity`.
+Distilly 생성 흐름에서는 먼저 어떤 패밀리를 증류할지 묻습니다: `colleague` · `relationship` · `celebrity`.
 
 그 다음 별칭, 기본 프로필, 성격 태그를 입력하고 데이터 소스를 선택합니다. 모든 항목은 건너뛸 수 있습니다 — 설명 하나만으로도 Skill을 만들 수 있습니다.
 
-생성이 끝나면 `{character}-{slug}`라는 이름의 Skill을 해당 호스트의 Skill 호출 문법으로 실행하세요.
+생성이 끝나면 Skill 이름은 `{character}-{slug}`이며, 지원되는 어느 호스트에나 설치할 수 있습니다.
 
 #### 통합 설치 프로그램으로 생성된 Skill 설치
 
@@ -225,21 +223,6 @@ Hermes는 기본적으로 `~/.agents/skills`를 검색하지 않습니다. Herme
 
 설치 프로그램은 legacy underscore 형식의 frontmatter 이름을 설치 복사본에서만 canonical kebab 형식인 `{character}-{slug}`로 정규화하며, 원본 디렉터리는 변경하지 않습니다. 설치 디렉터리에는 자체 완결형 `SKILL.md`와 `.distilly-install.json`만 들어가며 비공개 원본 자료는 복사하지 않습니다.
 
-### 🎛️ 명령어
-
-| 호스트 / 항목 | 호출 / 설명 |
-|---------------|-------------|
-| Claude Code | `/distilly` |
-| Hermes Agent | `/distilly` |
-| OpenClaw | `/distilly`; 대체 호출: `/skill distilly` |
-| Codex | `$distilly` 또는 `/skills` |
-| DeepSeek Harness | `/distilly` |
-| Pi coding agent | `/skill:distilly` |
-| Grok Build | `/distilly` |
-| `{character}-{slug}` | 전체 생성 Skill의 이름 (Persona + Work); 위의 호스트별 문법으로 호출 |
-| `python3 tools/skill_writer.py --action list ...` | 세 패밀리에 걸쳐 생성된 Skill 목록 보기 |
-| `python3 tools/version_manager.py --action rollback ...` | Skill 버전 롤백 |
-
 ### 🔬 Celebrity 리서치 툴체인
 
 `celebrity` 패밀리는 자막부터 완성된 초안까지, 엔드 투 엔드 리서치 툴체인을 기본 제공합니다.
```

**File**: `docs/lang/README_PT.md` (modified, +17/-34)
```diff
@@ -63,7 +63,7 @@ Um obrigado enorme a todos que deram estrela — seguiremos lançando, seguiremo
 
 </div>
 
-> 🧬 **Atualização 2026.08.23** — O nome do creator, o diretório e o ponto de entrada agora são **Distilly** de ponta a ponta. A descoberta local de Skills para Claude Code, Hermes, OpenClaw, Codex, DeepSeek Harness, Pi e Grok Build está documentada conforme as convenções atuais de cada host; o Grok Bot permanece separado como preview de saved Skills.
+> 🧬 **Atualização 2026.08.23** — O nome do creator, o diretório e o ponto de entrada agora são **Distilly** de ponta a ponta. A descoberta local de Skills é compatível com Claude Code, Hermes, OpenClaw, Codex, DeepSeek Harness, Pi e Grok Build; o Grok Bot permanece separado como preview de saved Skills.
 
 > 📝 **Atualização 2026.06.01** — **[O relatório técnico do COLLEAGUE.SKILL](https://arxiv.org/pdf/2605.31264) já está disponível**; o que mais nos deixa felizes não é apenas publicar um paper, mas ver a comunidade levar a galeria a 215 skills de 165 contribuidores e 100k+ stars acumuladas em skill cards, com todos os contribuidores reconhecidos nos Acknowledgements.
 
@@ -113,21 +113,21 @@ Cada família tem o próprio pipeline de prompts, estratégia de coleta de fonte
 
 ### 3️⃣ Mais hosts de Agent
 
-A versão antiga rodava só no Claude Code. Agora sete hosts locais descobrem a Distilly nativamente pelo formato `SKILL.md`. A sintaxe de invocação explícita varia por host:
+A versão antiga rodava só no Claude Code. Agora sete hosts locais descobrem a Distilly nativamente pelo formato `SKILL.md`:
 
-| Host | Como invocar a Distilly |
-|------|--------------------------|
-| 🟣 **Claude Code** | `/distilly` |
-| 🟠 **Hermes Agent** | `/distilly` |
-| 🔵 **OpenClaw** | `/distilly`; se necessário, `/skill distilly` |
-| ⚫ **Codex** | `$distilly` ou selecione em `/skills` |
-| 🔷 **DeepSeek Harness** | `/distilly` |
-| 🟡 **Pi coding agent** | `/skill:distilly` |
-| ⚪ **Grok Build** | `/distilly` |
+| Hosts compatíveis |
+|-------------------|
+| 🟣 **Claude Code** |
+| 🟠 **Hermes Agent** |
+| 🔵 **OpenClaw** |
+| ⚫ **Codex** |
+| 🔷 **DeepSeek Harness** |
+| 🟡 **Pi coding agent** |
+| ⚪ **Grok Build** |
 
 Os Skills de personagens gerados usam o mesmo formato Agent Skills e podem ser colocados no diretório de Skills de cada host.
 
-**Preview no Grok Bot:** migre manualmente o workflow da Distilly para um private saved skill, habilite-o para o Bot correspondente em Settings → Plugins e selecione-o digitando `/` no composer. A instalação direta do `SKILL.md` deste repositório no Grok Bot não está documentada oficialmente nem foi verificada.
+**Preview no Grok Bot:** migração manual como private saved skill. A instalação direta do `SKILL.md` deste repositório no Grok Bot não está documentada oficialmente nem foi verificada.
 
 ---
 
@@ -155,7 +155,7 @@ Os Skills de personagens gerados usam o mesmo formato Agent Skills e podem ser c
 
 > Instala a Distilly pra mim: `https://github.com/titanwings/colleague-skill`
 
-O Agent vai detectar o diretório de skills do host atual, clonar o repositório e registrar o ponto de entrada `distilly`. Depois, use a sintaxe correspondente ao seu host na tabela abaixo.
+O Agent vai detectar o diretório de skills do host atual, clonar o repositório e permitir que o host descubra a Distilly.
 
 <details>
 <summary><b>🛠️ Quer instalar na mão? Clique para ver os caminhos</b></summary>
@@ -178,7 +178,7 @@ git clone https://github.com/titanwings/colleague-skill <TARGET>
 
 </details>
 
-> **Migração de uma instalação existente:** um clone que ainda se chama `dot-skill`, ou que permanece na raiz legada `~/.codex/skills`, não tem garantia de expor a nova entrada `distilly` após apenas um `git pull`. Na raiz do clone antigo, execute o instalador de repositório aplicável (`tools/install_openclaw_skill.py`, `tools/install_codex_skill.py` ou `tools/install_hermes_skill.py`) ou clone novamente no caminho canônico `distilly` do host mostrado acima. Primeiro verifique a nova invocação específica do host; depois decida manualmente como tratar o diretório antigo, sem apagá-lo automaticamente. Os fallbacks legados de config/meta mantêm os dados antigos legíveis, mas não renomeiam um diretório instalado.
+> **Migração de uma instalação existente:** um clone que ainda se chama `dot-skill`, ou que permanece na raiz legada `~/.codex/skills`, não tem garantia de expor a nova entrada `distilly` após apenas um `git pull`. Na raiz do clone antigo, execute o instalador de repositório aplicável (`tools/install_openclaw_skill.py`, `tools/install_codex_skill.py` ou `tools/install_hermes_skill.py`) ou clone novamente no caminho canônico `distilly` do host mostrado acima. Primeiro verifique se o host descobre a Distilly; depois decida manualmente como tratar o diretório antigo, sem apagá-lo automaticamente. Os fallbacks legados de config/meta mantêm os dados antigos legíveis, mas não renomeiam um diretório instalado.
 
 Instale um Skill de personagem gerado
```

**File**: `docs/lang/README_RU.md` (modified, +17/-34)
```diff
@@ -63,7 +63,7 @@ Distilly превращает подтверждённые источникам
 
 </div>
 
-> 🧬 **Обновление 2026.08.23** — Имя creator'а, директория и точка входа теперь везде называются **Distilly**. Локальное обнаружение Skills для Claude Code, Hermes, OpenClaw, Codex, DeepSeek Harness, Pi и Grok Build описано по текущим правилам каждого хоста; Grok Bot отмечен отдельно как preview-сценарий с saved Skills.
+> 🧬 **Обновление 2026.08.23** — Имя creator'а, директория и точка входа теперь везде называются **Distilly**. Локальное обнаружение Skills поддерживается в Claude Code, Hermes, OpenClaw, Codex, DeepSeek Harness, Pi и Grok Build; Grok Bot отмечен отдельно как preview-сценарий с saved Skills.
 
 > 📝 **Обновление 2026.06.01** — **[Технический отчёт COLLEAGUE.SKILL](https://arxiv.org/pdf/2605.31264) опубликован**; больше всего нас радует не просто выход paper, а то, что сообщество вместе вырастило gallery до 215 skills от 165 контрибьюторов и 100k+ суммарных stars на skill cards, а все участники сообщества были отдельно упомянуты в Acknowledgements.
 
@@ -113,21 +113,21 @@ Distilly больше не ограничен сценарием «коллег
 
 ### 3️⃣ Больше Agent-хостов
 
-Старая версия работала только в Claude Code. Теперь семь локальных хостов нативно обнаруживают Distilly в формате `SKILL.md`. Синтаксис явного вызова зависит от хоста:
+Старая версия работала только в Claude Code. Теперь семь локальных хостов нативно обнаруживают Distilly в формате `SKILL.md`:
 
-| Хост | Как вызвать Distilly |
-|------|----------------------|
-| 🟣 **Claude Code** | `/distilly` |
-| 🟠 **Hermes Agent** | `/distilly` |
-| 🔵 **OpenClaw** | `/distilly`; при необходимости `/skill distilly` |
-| ⚫ **Codex** | `$distilly` или выбор через `/skills` |
-| 🔷 **DeepSeek Harness** | `/distilly` |
-| 🟡 **Pi coding agent** | `/skill:distilly` |
-| ⚪ **Grok Build** | `/distilly` |
+| Поддерживаемые хосты |
+|----------------------|
+| 🟣 **Claude Code** |
+| 🟠 **Hermes Agent** |
+| 🔵 **OpenClaw** |
+| ⚫ **Codex** |
+| 🔷 **DeepSeek Harness** |
+| 🟡 **Pi coding agent** |
+| ⚪ **Grok Build** |
 
 Сгенерированные Skill'ы персонажей используют тот же формат Agent Skills и устанавливаются в директорию Skills соответствующего хоста.
 
-**Preview для Grok Bot:** вручную перенеси workflow Distilly в private saved skill, включи его для нужного Bot в Settings → Plugins и выбери, набрав `/` в поле ввода. Прямая установка `SKILL.md` из этого репозитория в Grok Bot не описана в официальной документации и не проверена.
+**Preview для Grok Bot:** ручная миграция в виде сохранённого приватного Skill. Прямая установка `SKILL.md` из этого репозитория в Grok Bot не описана в официальной документации и не проверена.
 
 ---
 
@@ -155,7 +155,7 @@ Distilly больше не ограничен сценарием «коллег
 
 > Установи мне Distilly: `https://github.com/titanwings/colleague-skill`
 
-Агент сам определит директорию skill'ов текущего хоста, склонирует репозиторий и зарегистрирует точку входа `distilly`. После этого используй синтаксис своего хоста из таблицы ниже.
+Агент сам определит директорию skill'ов текущего хоста, склонирует репозиторий и зарегистрирует Distilly так, чтобы хост мог его обнаружить.
 
 <details>
 <summary><b>🛠️ Хочешь установить вручную? Жми — тут пути</b></summary>
@@ -178,7 +178,7 @@ git clone https://github.com/titanwings/colleague-skill <TARGET>
 
 </details>
 
-> **Миграция существующей установки:** clone с прежним именем `dot-skill` или clone в устаревшем корне `~/.codex/skills` не гарантирует обнаружение новой точки входа `distilly` после одного лишь `git pull`. Из корня старого clone запусти подходящий установщик репозитория (`tools/install_openclaw_skill.py`, `tools/install_codex_skill.py` или `tools/install_hermes_skill.py`) либо заново клонируй репозиторий в показанный выше канонический путь `distilly` для своего хоста. Сначала проверь новый вызов для хоста, а затем вручную реши, что делать со старым каталогом; не удаляй его автоматически. Legacy fallback для config/meta сохраняет чтение старых данных, но не переименовывает установленный каталог.
+> **Миграция существующей установки:** clone с прежним именем `dot-skill` или clone в устаревшем корне `~/.codex/skills` не гарантирует обнаружение новой точки входа `distilly` после одного лишь `git pull`. Из корня старого clone запусти подходящий установщик репозитория (`tools/install_openclaw_skill.py`, `tools/install_codex_skill.py` или `tools/install_hermes_skill.py`) либо заново клонируй репозиторий в показанный выше канонический путь `distilly` для своего хоста. Сначала проверь, что хост обнаруживает Distilly, а затем вручную реши, что делать со старым каталогом; не удаляй его автоматически. Legacy fallback для config/meta сохраняет чтение старых данных, но не переименовывает установленный каталог.
 
 Устанавливай сгенерированный Skill персонажа из корня репозитория с помощью единого установщика:
 
@@ -199,34 +199,17 @@ python3 tools/install_generated_skill.py --skill-dir "skills/{character}/{slug}"
 
 Для проектно
```

---

### Incident Patch 8: `63044e33` (2026-08-17)
**Commit Message**: fix: keep work-only skills from referring to Persona

Work-only artifacts claimed they had no Persona, but still told the model to answer out-of-scope questions via the Persona section. Combined skills keep the original handoff.

Co-authored-by: Cursor <[REDACTED_EMAIL]>

**File**: `tests/test_skill_writer.py` (modified, +56/-0)
```diff
@@ -147,6 +147,62 @@ def test_create_skill_renders_chinese_chrome_when_language_is_zh_cn(self) -> Non
             self.assertIn("仅 Work，无 Persona", work_skill)
             self.assertIn("仅 Persona，无工作能力", persona_skill)
 
+    def test_work_only_skill_replaces_persona_handoff(self) -> None:
+        handoff = "如果被问到职责范围外的问题，以该同事的方式回应（参见 Persona 部分）。"
+        work_content = (
+            "## 工作能力使用说明\n\n"
+            "当用户要求你完成以下任务时，严格按照上述规范执行。\n\n"
+            f"{handoff}\n"
+        )
+        with tempfile.TemporaryDirectory() as tmp_dir:
+            base_dir = Path(tmp_dir) / "skills" / "colleague"
+            zh_meta = {
+                "name": "Eulalie",
+                "language": "zh-CN",
+                "profile": {
+                    "company": "ByteDance",
+                    "level": "L2-1",
+                    "role": "Backend Engineer",
+                },
+            }
+            en_meta = {
+                "name": "Eulalie",
+                "language": "en",
+                "profile": {
+                    "company": "ByteDance",
+                    "level": "L2-1",
+                    "role": "Backend Engineer",
+                },
+            }
+
+            zh_dir = skill_writer.create_skill(
+                base_dir / "zh",
+                "zhangsan",
+                zh_meta,
+                work_content,
+                "Persona body",
+            )
+            en_dir = skill_writer.create_skill(
+                base_dir / "en",
+                "zhangsan",
+                en_meta,
+                work_content,
+                "Persona body",
+            )
+
+            stored_work = (zh_dir / "work.md").read_text(encoding="utf-8")
+            combined = (zh_dir / "SKILL.md").read_text(encoding="utf-8")
+            zh_work_skill = (zh_dir / "work_skill.md").read_text(encoding="utf-8")
+            en_work_skill = (en_dir / "work_skill.md").read_text(encoding="utf-8")
+
+            self.assertIn(handoff, stored_work)
+            self.assertIn(handoff, combined)
+            self.assertNotIn(handoff, zh_work_skill)
+            self.assertNotIn(handoff, en_work_skill)
+            self.assertIn(skill_writer.WORK_ONLY_FALLBACK_ZH, zh_work_skill)
+            self.assertIn(skill_writer.WORK_ONLY_FALLBACK_EN, en_work_skill)
+            self.assertNotIn(skill_writer.WORK_ONLY_FALLBACK_ZH, combined)
+
     def test_create_celebrity_adds_research_dirs_and_toolchain(self) -> None:
         with tempfile.TemporaryDirectory() as tmp_dir:
             base_dir = Path(tmp_dir) / "skills" / "celebrity"
```

**File**: `tools/skill_writer.py` (modified, +35/-2)
```diff
@@ -164,18 +164,51 @@ def render_combined_skill(meta: dict, work_content: str, persona_content: str) -
     )
 
 
+_PERSONA_HANDOFF_PATTERNS = (
+    re.compile(r"如果被问到职责范围外的问题，以该同事的方式回应（参见 Persona 部分）。\s*"),
+    re.compile(
+        r"If (?:you are )?asked (?:a question )?outside (?:your|the) "
+        r"(?:recorded )?responsibilities[^.]*Persona[^.]*\.\s*",
+        re.IGNORECASE,
+    ),
+)
+
+WORK_ONLY_FALLBACK_ZH = (
+    "如果问题超出已记录的职责范围，或原材料不足以回答，请直接说明缺口。"
+    "不要推断，也不要引用 Persona。"
+)
+WORK_ONLY_FALLBACK_EN = (
+    "If the question is outside the recorded responsibilities or the source "
+    "material is insufficient, state the gap. Do not infer or refer to Persona."
+)
+
+
+def work_only_content(work_content: str, *, chinese: bool) -> str:
+    """Copy Work text for the Work-only skill, without a Persona handoff."""
+    text = work_content
+    for pattern in _PERSONA_HANDOFF_PATTERNS:
+        text = pattern.sub("", text)
+    text = text.rstrip()
+    fallback = WORK_ONLY_FALLBACK_ZH if chinese else WORK_ONLY_FALLBACK_EN
+    if fallback not in text:
+        text = f"{text}\n\n{fallback}" if text else fallback
+    return text
+
+
 def render_work_skill(meta: dict, work_content: str) -> str:
     """Render the work-only skill artifact."""
     artifacts = meta["artifacts"]
+    chinese = prefers_chinese(meta)
     description = (
         f"{meta['display_name']} 的工作能力（仅 Work，无 Persona）"
-        if prefers_chinese(meta)
+        if chinese
         else f"{meta['display_name']} work capability only (without persona)"
     )
+    body = work_only_content(work_content, chinese=chinese)
     return (
         f"---\nname: {artifacts['work_name']}\n"
         f"description: {description}\n"
-        f"user-invocable: true\n---\n\n{work_content}\n"
+        f"user-invocable: true\n---\n\n{body}\n"
     )
 
 
```

---

### Incident Patch 9: `4d1681be` (2026-08-11)
**Commit Message**: fix: restore star history charts

**File**: `README.md` (modified, +4/-4)
```diff
@@ -391,11 +391,11 @@ You can also use the machine-readable citation metadata in [CITATION.cff](CITATI
 
 ## ⭐ Star History
 
-<a href="https://www.star-history.com/?repos=titanwings%2Fcolleague-skill&type=date&legend=top-left">
+<a href="https://star-history.dera.page/#titanwings/colleague-skill&type=date&legend=top-left">
  <picture>
-   <source media="(prefers-color-scheme: dark)" srcset="https://api.star-history.com/image?repos=titanwings/colleague-skill&type=date&theme=dark&legend=top-left" />
-   <source media="(prefers-color-scheme: light)" srcset="https://api.star-history.com/image?repos=titanwings/colleague-skill&type=date&legend=top-left" />
-   <img alt="Star History Chart" src="https://api.star-history.com/image?repos=titanwings/colleague-skill&type=date&legend=top-left" />
+   <source media="(prefers-color-scheme: dark)" srcset="https://star-history.dera.page/svg?repos=titanwings%2Fcolleague-skill&type=date&theme=dark&legend=top-left" />
+   <source media="(prefers-color-scheme: light)" srcset="https://star-history.dera.page/svg?repos=titanwings%2Fcolleague-skill&type=date&legend=top-left" />
+   <img alt="Star History Chart" src="https://star-history.dera.page/svg?repos=titanwings%2Fcolleague-skill&type=date&legend=top-left" />
  </picture>
 </a>
 
```

**File**: `docs/lang/README_DE.md` (modified, +4/-4)
```diff
@@ -366,11 +366,11 @@ dot-skill/
 
 ## ⭐ Star History
 
-<a href="https://www.star-history.com/?repos=titanwings%2Fcolleague-skill&type=date&legend=top-left">
+<a href="https://star-history.dera.page/#titanwings/colleague-skill&type=date&legend=top-left">
  <picture>
-   <source media="(prefers-color-scheme: dark)" srcset="https://api.star-history.com/image?repos=titanwings/colleague-skill&type=date&theme=dark&legend=top-left" />
-   <source media="(prefers-color-scheme: light)" srcset="https://api.star-history.com/image?repos=titanwings/colleague-skill&type=date&legend=top-left" />
-   <img alt="Star History Chart" src="https://api.star-history.com/image?repos=titanwings/colleague-skill&type=date&legend=top-left" />
+   <source media="(prefers-color-scheme: dark)" srcset="https://star-history.dera.page/svg?repos=titanwings%2Fcolleague-skill&type=date&theme=dark&legend=top-left" />
+   <source media="(prefers-color-scheme: light)" srcset="https://star-history.dera.page/svg?repos=titanwings%2Fcolleague-skill&type=date&legend=top-left" />
+   <img alt="Star History Chart" src="https://star-history.dera.page/svg?repos=titanwings%2Fcolleague-skill&type=date&legend=top-left" />
  </picture>
 </a>
 
```

**File**: `docs/lang/README_EN.md` (modified, +4/-4)
```diff
@@ -366,11 +366,11 @@ dot-skill/
 
 ## ⭐ Star History
 
-<a href="https://www.star-history.com/?repos=titanwings%2Fcolleague-skill&type=date&legend=top-left">
+<a href="https://star-history.dera.page/#titanwings/colleague-skill&type=date&legend=top-left">
  <picture>
-   <source media="(prefers-color-scheme: dark)" srcset="https://api.star-history.com/image?repos=titanwings/colleague-skill&type=date&theme=dark&legend=top-left" />
-   <source media="(prefers-color-scheme: light)" srcset="https://api.star-history.com/image?repos=titanwings/colleague-skill&type=date&legend=top-left" />
-   <img alt="Star History Chart" src="https://api.star-history.com/image?repos=titanwings/colleague-skill&type=date&legend=top-left" />
+   <source media="(prefers-color-scheme: dark)" srcset="https://star-history.dera.page/svg?repos=titanwings%2Fcolleague-skill&type=date&theme=dark&legend=top-left" />
+   <source media="(prefers-color-scheme: light)" srcset="https://star-history.dera.page/svg?repos=titanwings%2Fcolleague-skill&type=date&legend=top-left" />
+   <img alt="Star History Chart" src="https://star-history.dera.page/svg?repos=titanwings%2Fcolleague-skill&type=date&legend=top-left" />
  </picture>
 </a>
 
```

**File**: `docs/lang/README_ES.md` (modified, +4/-4)
```diff
@@ -366,11 +366,11 @@ dot-skill/
 
 ## ⭐ Star History
 
-<a href="https://www.star-history.com/?repos=titanwings%2Fcolleague-skill&type=date&legend=top-left">
+<a href="https://star-history.dera.page/#titanwings/colleague-skill&type=date&legend=top-left">
  <picture>
-   <source media="(prefers-color-scheme: dark)" srcset="https://api.star-history.com/image?repos=titanwings/colleague-skill&type=date&theme=dark&legend=top-left" />
-   <source media="(prefers-color-scheme: light)" srcset="https://api.star-history.com/image?repos=titanwings/colleague-skill&type=date&legend=top-left" />
-   <img alt="Star History Chart" src="https://api.star-history.com/image?repos=titanwings/colleague-skill&type=date&legend=top-left" />
+   <source media="(prefers-color-scheme: dark)" srcset="https://star-history.dera.page/svg?repos=titanwings%2Fcolleague-skill&type=date&theme=dark&legend=top-left" />
+   <source media="(prefers-color-scheme: light)" srcset="https://star-history.dera.page/svg?repos=titanwings%2Fcolleague-skill&type=date&legend=top-left" />
+   <img alt="Star History Chart" src="https://star-history.dera.page/svg?repos=titanwings%2Fcolleague-skill&type=date&legend=top-left" />
  </picture>
 </a>
 
```

**File**: `docs/lang/README_JA.md` (modified, +4/-4)
```diff
@@ -366,11 +366,11 @@ dot-skill/
 
 ## ⭐ Star History
 
-<a href="https://www.star-history.com/?repos=titanwings%2Fcolleague-skill&type=date&legend=top-left">
+<a href="https://star-history.dera.page/#titanwings/colleague-skill&type=date&legend=top-left">
  <picture>
-   <source media="(prefers-color-scheme: dark)" srcset="https://api.star-history.com/image?repos=titanwings/colleague-skill&type=date&theme=dark&legend=top-left" />
-   <source media="(prefers-color-scheme: light)" srcset="https://api.star-history.com/image?repos=titanwings/colleague-skill&type=date&legend=top-left" />
-   <img alt="Star History Chart" src="https://api.star-history.com/image?repos=titanwings/colleague-skill&type=date&legend=top-left" />
+   <source media="(prefers-color-scheme: dark)" srcset="https://star-history.dera.page/svg?repos=titanwings%2Fcolleague-skill&type=date&theme=dark&legend=top-left" />
+   <source media="(prefers-color-scheme: light)" srcset="https://star-history.dera.page/svg?repos=titanwings%2Fcolleague-skill&type=date&legend=top-left" />
+   <img alt="Star History Chart" src="https://star-history.dera.page/svg?repos=titanwings%2Fcolleague-skill&type=date&legend=top-left" />
  </picture>
 </a>
 
```

**File**: `docs/lang/README_KO.md` (modified, +4/-4)
```diff
@@ -366,11 +366,11 @@ dot-skill/
 
 ## ⭐ Star History
 
-<a href="https://www.star-history.com/?repos=titanwings%2Fcolleague-skill&type=date&legend=top-left">
+<a href="https://star-history.dera.page/#titanwings/colleague-skill&type=date&legend=top-left">
  <picture>
-   <source media="(prefers-color-scheme: dark)" srcset="https://api.star-history.com/image?repos=titanwings/colleague-skill&type=date&theme=dark&legend=top-left" />
-   <source media="(prefers-color-scheme: light)" srcset="https://api.star-history.com/image?repos=titanwings/colleague-skill&type=date&legend=top-left" />
-   <img alt="Star History Chart" src="https://api.star-history.com/image?repos=titanwings/colleague-skill&type=date&legend=top-left" />
+   <source media="(prefers-color-scheme: dark)" srcset="https://star-history.dera.page/svg?repos=titanwings%2Fcolleague-skill&type=date&theme=dark&legend=top-left" />
+   <source media="(prefers-color-scheme: light)" srcset="https://star-history.dera.page/svg?repos=titanwings%2Fcolleague-skill&type=date&legend=top-left" />
+   <img alt="Star History Chart" src="https://star-history.dera.page/svg?repos=titanwings%2Fcolleague-skill&type=date&legend=top-left" />
  </picture>
 </a>
 
```

**File**: `docs/lang/README_PT.md` (modified, +4/-4)
```diff
@@ -366,11 +366,11 @@ dot-skill/
 
 ## ⭐ Star History
 
-<a href="https://www.star-history.com/?repos=titanwings%2Fcolleague-skill&type=date&legend=top-left">
+<a href="https://star-history.dera.page/#titanwings/colleague-skill&type=date&legend=top-left">
  <picture>
-   <source media="(prefers-color-scheme: dark)" srcset="https://api.star-history.com/image?repos=titanwings/colleague-skill&type=date&theme=dark&legend=top-left" />
-   <source media="(prefers-color-scheme: light)" srcset="https://api.star-history.com/image?repos=titanwings/colleague-skill&type=date&legend=top-left" />
-   <img alt="Star History Chart" src="https://api.star-history.com/image?repos=titanwings/colleague-skill&type=date&legend=top-left" />
+   <source media="(prefers-color-scheme: dark)" srcset="https://star-history.dera.page/svg?repos=titanwings%2Fcolleague-skill&type=date&theme=dark&legend=top-left" />
+   <source media="(prefers-color-scheme: light)" srcset="https://star-history.dera.page/svg?repos=titanwings%2Fcolleague-skill&type=date&legend=top-left" />
+   <img alt="Star History Chart" src="https://star-history.dera.page/svg?repos=titanwings%2Fcolleague-skill&type=date&legend=top-left" />
  </picture>
 </a>
 
```

**File**: `docs/lang/README_RU.md` (modified, +4/-4)
```diff
@@ -366,11 +366,11 @@ dot-skill/
 
 ## ⭐ Star History
 
-<a href="https://www.star-history.com/?repos=titanwings%2Fcolleague-skill&type=date&legend=top-left">
+<a href="https://star-history.dera.page/#titanwings/colleague-skill&type=date&legend=top-left">
  <picture>
-   <source media="(prefers-color-scheme: dark)" srcset="https://api.star-history.com/image?repos=titanwings/colleague-skill&type=date&theme=dark&legend=top-left" />
-   <source media="(prefers-color-scheme: light)" srcset="https://api.star-history.com/image?repos=titanwings/colleague-skill&type=date&legend=top-left" />
-   <img alt="Star History Chart" src="https://api.star-history.com/image?repos=titanwings/colleague-skill&type=date&legend=top-left" />
+   <source media="(prefers-color-scheme: dark)" srcset="https://star-history.dera.page/svg?repos=titanwings%2Fcolleague-skill&type=date&theme=dark&legend=top-left" />
+   <source media="(prefers-color-scheme: light)" srcset="https://star-history.dera.page/svg?repos=titanwings%2Fcolleague-skill&type=date&legend=top-left" />
+   <img alt="Star History Chart" src="https://star-history.dera.page/svg?repos=titanwings%2Fcolleague-skill&type=date&legend=top-left" />
  </picture>
 </a>
 
```

---

### Incident Patch 10: `3c77748b` (2026-04-29)
**Commit Message**: fix: add opening frontmatter delimiter to SKILL.md for npx skills compatibility

Co-Authored-By: Claude Opus 4.6 <[REDACTED_EMAIL]>

**File**: `SKILL.md` (modified, +1/-0)
```diff
@@ -1,3 +1,4 @@
+---
 name: dot-skill
 description: "Unified meta-skill engine for distilling colleague, relationship, or celebrity characters into reusable Skills. | 统一的 meta-skill 引擎，把 colleague、relationship、celebrity 三类对象蒸馏成可复用 Skill。"
 argument-hint: "[character] [name-or-slug]"
```

---

### Incident Patch 11: `fcee62a4` (2026-04-13)
**Commit Message**: fix: update README links from docs/i18n to docs/lang

Co-Authored-By: Claude Opus 4.6 <[REDACTED_EMAIL]>

**File**: `README.md` (modified, +1/-1)
```diff
@@ -29,7 +29,7 @@ and get an **AI Skill that actually works like them**
 
 [Supported Sources](#supported-data-sources) · [Install](#install) · [Usage](#usage) · [Demo](#demo) · [Detailed Install](INSTALL.md) · [💬 Discord](https://discord.gg/aRjmJBdK)
 
-[**中文**](docs/i18n/README_ZH.md) · [**Español**](docs/i18n/README_ES.md) · [**Deutsch**](docs/i18n/README_DE.md) · [**日本語**](docs/i18n/README_JA.md) · [**Русский**](docs/i18n/README_RU.md) · [**Português**](docs/i18n/README_PT.md)
+[**中文**](docs/lang/README_ZH.md) · [**Español**](docs/lang/README_ES.md) · [**Deutsch**](docs/lang/README_DE.md) · [**日本語**](docs/lang/README_JA.md) · [**Русский**](docs/lang/README_RU.md) · [**Português**](docs/lang/README_PT.md)
 
 </div>
 
```

---

### Incident Patch 12: `0c09a898` (2026-04-12)
**Commit Message**: fix: correct mismatched option labels in SKILL.md (A-E menu vs sections) (#64)

Both the Chinese and English versions of SKILL.md had option labels
in the section headers that did not match the A–E menu presented to
users during Step 2.

Chinese bugs (before this fix):
- 方式 C：上传文件  → should be 方式 D (D=上传文件 in menu)
- 方式 B：飞书链接  → should be 方式 C (C=飞书链接 in menu) — duplicate B
- 方式 C：直接粘贴  → should be 方式 E (E=直接粘贴 in menu)

English bugs (before this fix):
- Option C: Upload Files  → should be Option D (D=Upload Files in menu)
- Option D: Feishu Link   → should be Option C (C=Feishu Link in menu)

Both menus are consistent with each other (A=Feishu auto, B=DingTalk,
C=Feishu link, D=Upload, E=Paste); it was only the section headers
that were out of sync.

Co-authored-by: Claude Sonnet 4.6 <[REDACTED_EMAIL]>

**File**: `SKILL.md` (modified, +5/-5)
```diff
@@ -243,7 +243,7 @@ python3 ${CLAUDE_SKILL_DIR}/tools/dingtalk_auto_collector.py \
 
 ---
 
-#### 方式 C：上传文件
+#### 方式 D：上传文件
 
 - **PDF / 图片**：`Read` 工具直接读取
 - **飞书消息 JSON 导出**：
@@ -260,7 +260,7 @@ python3 ${CLAUDE_SKILL_DIR}/tools/dingtalk_auto_collector.py \
 
 ---
 
-#### 方式 B：飞书链接
+#### 方式 C：飞书链接
 
 用户提供飞书文档/Wiki 链接时，询问读取方式：
 
@@ -319,7 +319,7 @@ python3 ${CLAUDE_SKILL_DIR}/tools/feishu_mcp_client.py \
 
 ---
 
-#### 方式 C：直接粘贴
+#### 方式 E：直接粘贴
 
 用户粘贴的内容直接作为文本原材料，无需调用任何工具。
 
@@ -743,7 +743,7 @@ If message collection fails, prompt user to upload chat screenshots.
 
 ---
 
-#### Option C: Upload Files
+#### Option D: Upload Files
 
 - **PDF / Images**: `Read` tool directly
 - **Feishu message JSON export**:
@@ -760,7 +760,7 @@ If message collection fails, prompt user to upload chat screenshots.
 
 ---
 
-#### Option D: Feishu Link
+#### Option C: Feishu Link
 
 When the user provides a Feishu doc/Wiki link, ask which method to use:
 
```

---

### Incident Patch 13: `3d83227c` (2026-04-12)
**Commit Message**: fix: add missing 'backup' action to version_manager.py (#63)

SKILL.md references `--action backup` in the evolution mode workflow
(both Chinese and English versions), but version_manager.py only
accepted list/rollback/cleanup — causing an error whenever a user
tried to update a colleague skill via the documented command.

Adds backup_current_version() which archives the current SKILL.md,
work.md and persona.md into versions/{current_version}/ before an
update, consistent with how skill_writer.py handles versioning
internally.

Co-authored-by: Claude Sonnet 4.6 <[REDACTED_EMAIL]>

**File**: `tools/version_manager.py` (modified, +33/-1)
```diff
@@ -6,6 +6,7 @@
 
 用法：
     python version_manager.py --action list --slug zhangsan --base-dir ~/.openclaw/...
+    python version_manager.py --action backup --slug zhangsan --base-dir ~/.openclaw/...
     python version_manager.py --action rollback --slug zhangsan --version v2 --base-dir ~/.openclaw/...
 """
 
@@ -92,6 +93,34 @@ def rollback(skill_dir: Path, target_version: str) -> bool:
     return True
 
 
+def backup_current_version(skill_dir: Path) -> bool:
+    """将当前版本存档到 versions/ 目录"""
+    meta_path = skill_dir / "meta.json"
+    if not meta_path.exists():
+        print(f"错误：找不到 meta.json，无法确定当前版本号", file=sys.stderr)
+        return False
+
+    meta = json.loads(meta_path.read_text(encoding="utf-8"))
+    current_version = meta.get("version", "v1")
+
+    version_dir = skill_dir / "versions" / current_version
+    version_dir.mkdir(parents=True, exist_ok=True)
+
+    backed_up = []
+    for fname in ("SKILL.md", "work.md", "persona.md"):
+        src = skill_dir / fname
+        if src.exists():
+            shutil.copy2(src, version_dir / fname)
+            backed_up.append(fname)
+
+    if backed_up:
+        print(f"已存档版本 {current_version}，文件：{', '.join(backed_up)}")
+    else:
+        print(f"警告：{current_version} 无可存档的文件")
+
+    return True
+
+
 def cleanup_old_versions(skill_dir: Path, max_versions: int = MAX_VERSIONS):
     """清理超出限制的旧版本"""
     versions_dir = skill_dir / "versions"
@@ -113,7 +142,7 @@ def cleanup_old_versions(skill_dir: Path, max_versions: int = MAX_VERSIONS):
 
 def main():
     parser = argparse.ArgumentParser(description="Skill 版本管理器")
-    parser.add_argument("--action", required=True, choices=["list", "rollback", "cleanup"])
+    parser.add_argument("--action", required=True, choices=["list", "backup", "rollback", "cleanup"])
     parser.add_argument("--slug", required=True, help="同事 slug")
     parser.add_argument("--version", help="目标版本号（rollback 时使用）")
     parser.add_argument(
@@ -139,6 +168,9 @@ def main():
             for v in versions:
                 print(f"  {v['version']}  存档时间: {v['archived_at']}  文件: {', '.join(v['files'])}")
 
+    elif args.action == "backup":
+        backup_current_version(skill_dir)
+
     elif args.action == "rollback":
         if not args.version:
             print("错误：rollback 操作需要 --version", file=sys.stderr)
```

---

### Incident Patch 14: `b8b868ee` (2026-04-08)
**Commit Message**: Fix announcement to English in README.md

**File**: `README.md` (modified, +4/-4)
```diff
@@ -33,15 +33,15 @@ and get an **AI Skill that actually works like them**
 
 ---
 
-> 🆕 **2025.04.07 更新** — 大家对二创 dot-skill 热情超高！我搓了一个社区平台，欢迎投 PR 一起维护分享！
+> 🆕 **2025.04.07 Update** — The community's enthusiasm for dot-skill remixes has been incredible! I've built a community gallery — PRs welcome!
 >
-> 任何 skill 或者 meta-skill 可以一起分享，可以直接给大家自己的 GitHub repo 引流～ 没有中间商赚差价
+> Share any skill or meta-skill, and drive traffic directly to your own GitHub repo. No middleman.
 >
 > 👉 **[titanwings.github.io/colleague-skill-site](https://titanwings.github.io/colleague-skill-site/)**
 >
-> 已收录：户晨风.skill · 峰哥亡命天涯.skill · 罗翔.skill 等
+> Now listed: 户晨风.skill · 峰哥亡命天涯.skill · 罗翔.skill and more
 >
-> ⏳ 目前 PR 人工审核中，可能有点慢，感谢耐心等待！/ PRs are manually reviewed for now — may be a bit slow, thanks for your patience!
+> ⏳ PRs are manually reviewed for now — may be a bit slow, thanks for your patience!/ PRs are manually reviewed for now — may be a bit slow, thanks for your patience!
 
 ---
 
```

#### Recent Merged Pull Requests:
- **PR #163** (closed): feat(v2): five-step mainline prompts + bilingual MUST/MUST-NOT/RECEIPT + prompt-lint (@titanwings)
- **PR #162** (closed): ci: green type check on a fresh checkout, and a working pip cache path (@titanwings)
- **PR #161** (closed): fix: audit findings (persona registration, parsers, repair path, JSON output) (@titanwings)
- **PR #160** (closed): docs: verified host status; feat(release): one release tuple check (@titanwings)
- **PR #159** (closed): fix/feat: real DSH home, linear canonicalization, legacy Skill import (@titanwings)
- **PR #158** (closed): feat: version history/diff/rollback and the person Skill lifecycle (@titanwings)
- **PR #157** (closed): feat: chat-export transcripts, idempotent harvest, linear splitter (@titanwings)
- **PR #156** (closed): feat(cli): resolve people by name, show profile gaps; byte-exact file splitting (@titanwings)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
