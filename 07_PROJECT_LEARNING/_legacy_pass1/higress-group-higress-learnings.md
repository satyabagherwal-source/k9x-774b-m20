# Forensic Learning Record (Deep Inspection): higress-group/higress

> **Canonical Artifact**: `07_PROJECT_LEARNING/higress-group-higress-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/higress-group/higress](https://github.com/higress-group/higress))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-09-30T17:21:28.531Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `higress-group/higress`
- **Description**: 🤖 AI Gateway | AI Native API Gateway
- **Primary Language / Ecosystem**: Go
- **Discovered Manifests / Configurations**: go.mod, README.md
- **Stars / Engagement**: 9484 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: go.mod, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `.agents/skills/agent-session-monitor/example/clawdbot_demo.py`
```
#!/usr/bin/env python3
"""
演示如何在Clawdbot中生成Session观测URL
"""

from urllib.parse import quote

def generate_session_url(session_id: str, base_url: str = "http://localhost:8888") -> dict:
    """
    生成session观测URL
    
    Args:
        session_id: 当前会话的session ID
        base_url: Web服务器基础URL
    
    Returns:
        包含各种URL的字典
    """
    # URL编码session_id（处理特殊字符）
    encoded_id = quote(session_id, safe='')
    
    return {
        "session_detail": f"{base_url}/session?id={encoded_id}",
        "api_session": f"{base_url}/api/session?id={encoded_id}",
        "index": f"{base_url}/",
        "api_sessions": f"{base_url}/api/sessions",
        "api_stats": f"{base_url}/api/stats",
    }


def format_response_message(session_id: str, base_url: str = "http://localhost:8888") -> str:
    """
    生成给用户的回复消息
    
    Args:
        session_id: 当前会话的session ID
        base_url: Web服务器基础URL
    
    Returns:
        格式化的回复消息
    """
    urls = generate_session_url(session_id, base_url)
    
    return f"""你的当前会话信息：

📊 **Session ID**: `{session_id}`

🔗 **查看详情**: {urls['session_detail']}

点击链接可以看到：
✅ 完整对话历史（每轮messages）
✅ Token消耗明细（input/output/reasoning）
✅ 工具调用记录
✅ 实时成本统计

**更多链接：**
- 📋 所有会话: {urls['index']}
- 📥 API数据: {urls['api_session']}
- 📊 总体统计: {urls['api_stats']}
"""


# 示例使用
if __name__ == '__main__':
    # 模拟clawdbot的session ID
    demo_session_id = "agent:main:discord:channel:1465367993012981988"
    
    print("=" * 70)
    print("🤖 Clawdbot Session Monitor Demo")
    print("=" * 70)
    print()
    
    # 生成URL
    urls = generate_session_url(demo_session_id)
    
    print("生成的URL：")
    print(f"  Session详情: {urls['session_detail']}")
    print(f"  API数据:     {urls['api_session']}")
    print(f"  总览页面:    {urls['index']}")
    print()
    
    # 生成回复消息
    message = format_response_message(demo_session_id)
    
    print("回复消息模板：")
    print("-" * 70)
    print(message)
    print("-" * 70)
    print()
    
    print("✅ 在Clawdbot中，你可以直接返回上面的消息给用户")
    print()
    
    # 测试特殊字符的session ID
    special_session_id = "agent:test:session/with?special&chars"
    special_urls = generate_session_url(special_session_id)
    
    print("特殊字符处理示例：")
    print(f"  原始ID: {special_session_id}")
    print(f"  URL:    {special_urls['session_detail']}")
    print()

```

### Core Architecture Module: `.agents/skills/agent-session-monitor/main.py`
```
#!/usr/bin/env python3
"""
Agent Session Monitor - 实时Agent对话观测程序
监控Higress访问日志，按session聚合对话，追踪token开销
"""

import argparse
import json
import re
import os
import sys
import time
from collections import defaultdict
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Optional

# 使用定时轮询机制，不依赖watchdog

# ============================================================================
# 配置
# ============================================================================

# Token定价（单位：美元/1M tokens）
TOKEN_PRICING = {
    "Qwen": {
        "input": 0.0002,  # $0.2/1M
        "output": 0.0006,
        "cached": 0.0001,  # cached tokens通常是input的50%
    },
    "Qwen3-rerank": {
        "input": 0.0003,
        "output": 0.0012,
        "cached": 0.00015,
    },
    "Qwen-Max": {
        "input": 0.0005,
        "output": 0.002,
        "cached": 0.00025,
    },
    "GPT-4": {
        "input": 0.003,
        "output": 0.006,
        "cached": 0.0015,
    },
    "GPT-4o": {
        "input": 0.0025,
        "output": 0.01,
        "cached": 0.00125,  # GPT-4o prompt caching: 50% discount
    },
    "GPT-4-32k": {
        "input": 0.01,
        "output": 0.03,
        "cached": 0.005,
    },
    "o1": {
        "input": 0.015,
        "output": 0.06,
        "cached": 0.0075,
        "reasoning": 0.06,  # o1 reasoning tokens same as output
    },
    "o1-mini": {
        "input": 0.003,
        "output": 0.012,
        "cached": 0.0015,
        "reasoning": 0.012,
    },
    "Claude": {
        "input": 0.015,
        "output": 0.075,
        "cached": 0.0015,  # Claude prompt caching: 90% discount
    },
    "DeepSeek-R1": {
        "input": 0.004,
        "output": 0.012,
        "reasoning": 0.002,
        "cached": 0.002,
    }
}

DEFAULT_LOG_PATH = "/var/log/higress/access.log"
DEFAULT_OUTPUT_DIR = "./sessions"

# ============================================================================
# Session管理器
# ============================================================================

class SessionManager:
    """管理多个会话的token统计"""
    
    def __init__(self, output_dir: str, load_existing: bool = True):
        self.output_dir = Path(output_dir)
        self.output_dir.mkdir(parents=True, exist_ok=True)
        self.sessions: Dict[str, dict] = {}
        
        # 加载已有的session数据
        if load_existing:
            self._load_existing_sessions()
    
    def _load_existing_sessions(self):
        """加载已有的session数据"""
        loaded_count = 0
        for session_file in self.output_dir.glob("*.json"):
            try:
                with open(session_file, 'r', encoding='utf-8') as f:
                    session = json.load(f)
                    session_id = session.get('session_id')
                    if session_id:
                        self.sessions[session_id] = session
                        loaded_count += 1
            except Exception as e:
                print(f"Warning: Failed to load session {session_file}: {e}", file=sys.stderr)
        
        if loaded_count > 0:
            print(f"📦 Loaded {loaded_count} existing session(s)")
    
    def update_session(self, session_id: str, ai_log: dict) -> dict:
        """更新或创建session"""
        if session_id not in self.sessions:
            self.sessions[session_id] = {
                "session_id": session_id,
                "created_at": datetime.now().isoformat(),
                "updated_at": datetime.now().isoformat(),
                "messages_count": 0,
                "total_input_tokens": 0,
                "total_output_tokens": 0,
                "total_reasoning_tokens": 0,
                "total_cached_tokens": 0,
                "rounds": [],
                "model": ai_log.get("model", "unknown")
            }
        
        session = self.sessions[session_id]
        
        # 更新统计
        model = ai_log.get("model", "unknown")
        session["model"] = model
        session["updated_at"] = datetime.now().isoformat()
        
        # Token统计
        session["total_input_tokens"] += ai_log.get("input_token", 0)
        session["total_output_tokens"] += ai_log.get("output_token", 0)
        
        # 检查reasoning tokens（优先使用ai_log中的reasoning_tokens字段）
        reasoning_tokens = ai_log.get("reasoning_tokens", 0)
        if reasoning_tokens == 0 and "reasoning" in ai_log and ai_log["reasoning"]:
            # 如果没有reasoning_tokens字段，估算reasoning的token数（大致按字符数/4）
            reasoning_text = ai_log["reasoning"]
            reasoning_tokens = len(reasoning_text) // 4
        session["total_reasoning_tokens"] += reasoning_tokens
        
        # 检查cached tokens（prompt caching）
        cached_tokens = ai_log.get("cached_tokens", 0)
        session["total_cached_tokens"] += cached_tokens
        
        # 检查是否有tool_calls（工具调用）
        has_tool_calls = "tool_calls" in ai_log and ai_log["tool_calls"]
        
        # 更新消息数
        session["messages_count"] += 1
        
        # 解析token details（如果有）
        input_token_details = {}
        output_token_details = {}
        
        if "input_token_details" in ai_log:
            try:
                # input_token_details可能是字符串或字典
                details = ai_log["input_token_details"]
                if isinstance(details, str):
                    import json
                    input_token_details = json.loads(details)
                else:
                    input_token_details = details
            except (json.JSONDecodeError, TypeError):
                pass
        
        if "output_token_details" in ai_log:
            try:
                # output_token_details可能是字符串或字典
                details = ai_log["output_token_details"]
                if isinstance(details, str):
                    import json
                    output_token_details = json.loads(details)
                else:
                    output_token_details = details
            except (json.JSONDecodeError, TypeError):
                pass
        
        # 添加轮次记录（包含完整的llm请求和响应信息）
        round_data = {
            "round": session["messages_count"],
            "timestamp": datetime.now().isoformat(),
            "input_tokens": ai_log.get("input_token", 0),
            "output_tokens": ai_log.get("output_token", 0),
            "reasoning_tokens": reasoning_tokens,
            "cached_tokens": cached_tokens,
            "model": model,
            "has_tool_calls": has_tool_calls,
            "response_type": ai_log.get("response_type", "normal"),
            # 完整的对话信息
            "messages": ai_log.get("messages", []),
            "question": ai_log.get("question", ""),
            "answer": ai_log.get("answer", ""),
            "reasoning": ai_log.get("reasoning", ""),
            "tool_calls": ai_log.get("tool_calls", []),
            # Token详情
            "input_token_details": input_token_details,
            "output_token_details": output_token_details,
        }
        session["rounds"].append(round_data)
        
        # 保存到文件
        self._save_session(session)
        
        return session
    
    def _save_session(self, session: dict):
        """保存session数据到文件"""
        session_file = self.output_dir / f"{session['session_id']}.json"
        with open(session_file, 'w', encoding='utf-8') as f:
            json.dump(session, f, ensure_ascii=False, indent=2)
    
    def get_all_sessions(self) -> List[dict]:
        """获取所有session"""
        return list(self.sessions.values())
    
    def get_session(self, session_id: str) -> Optional[dict]:
        """获取指定session"""
        return self.sessions.get(session_id)
    
    def get_summary(self) -> dict:
        """获取总体统计"""
        total_input = sum(s["total_input_tokens"] for s in self.sessions.values())
        total_output = sum(s["total_output_tokens"] for s in self.sessions.values())
        total_reasoning = sum(s.get("total_reasoning_tokens", 0) for s in self.sessions.values())
        total_cached = sum(s.get("total_cached_tokens", 0) for s in self.
```

### Core Architecture Module: `.agents/skills/agent-session-monitor/scripts/cli.py`
```
#!/usr/bin/env python3
"""
Agent Session Monitor CLI - 查询和分析agent对话数据
支持：
1. 实时查询指定session的完整llm请求和响应
2. 按模型统计token开销
3. 按日期统计token开销
4. 生成FinOps报表
"""

import argparse
import json
import sys
from collections import defaultdict
from datetime import datetime, timedelta
from pathlib import Path
from typing import Dict, List, Optional
import re

# Token定价（单位：美元/1M tokens）
TOKEN_PRICING = {
    "Qwen": {
        "input": 0.0002,  # $0.2/1M
        "output": 0.0006,
        "cached": 0.0001,  # cached tokens通常是input的50%
    },
    "Qwen3-rerank": {
        "input": 0.0003,
        "output": 0.0012,
        "cached": 0.00015,
    },
    "Qwen-Max": {
        "input": 0.0005,
        "output": 0.002,
        "cached": 0.00025,
    },
    "GPT-4": {
        "input": 0.003,
        "output": 0.006,
        "cached": 0.0015,
    },
    "GPT-4o": {
        "input": 0.0025,
        "output": 0.01,
        "cached": 0.00125,  # GPT-4o prompt caching: 50% discount
    },
    "GPT-4-32k": {
        "input": 0.01,
        "output": 0.03,
        "cached": 0.005,
    },
    "o1": {
        "input": 0.015,
        "output": 0.06,
        "cached": 0.0075,
        "reasoning": 0.06,  # o1 reasoning tokens same as output
    },
    "o1-mini": {
        "input": 0.003,
        "output": 0.012,
        "cached": 0.0015,
        "reasoning": 0.012,
    },
    "Claude": {
        "input": 0.015,
        "output": 0.075,
        "cached": 0.0015,  # Claude prompt caching: 90% discount
    },
    "DeepSeek-R1": {
        "input": 0.004,
        "output": 0.012,
        "reasoning": 0.002,
        "cached": 0.002,
    }
}


class SessionAnalyzer:
    """Session数据分析器"""
    
    def __init__(self, data_dir: str):
        self.data_dir = Path(data_dir)
        if not self.data_dir.exists():
            raise FileNotFoundError(f"Session data directory not found: {data_dir}")
    
    def load_session(self, session_id: str) -> Optional[dict]:
        """加载指定session的完整数据"""
        session_file = self.data_dir / f"{session_id}.json"
        if not session_file.exists():
            return None
        
        with open(session_file, 'r', encoding='utf-8') as f:
            return json.load(f)
    
    def load_all_sessions(self) -> List[dict]:
        """加载所有session数据"""
        sessions = []
        for session_file in self.data_dir.glob("*.json"):
            try:
                with open(session_file, 'r', encoding='utf-8') as f:
                    session = json.load(f)
                    sessions.append(session)
            except Exception as e:
                print(f"Warning: Failed to load {session_file}: {e}", file=sys.stderr)
        return sessions
    
    def display_session_detail(self, session_id: str, show_messages: bool = True):
        """显示session的详细信息"""
        session = self.load_session(session_id)
        if not session:
            print(f"❌ Session not found: {session_id}")
            return
        
        print(f"\n{'='*70}")
        print(f"📊 Session Detail: {session_id}")
        print(f"{'='*70}\n")
        
        # 基本信息
        print(f"🕐 Created:  {session['created_at']}")
        print(f"🕑 Updated:  {session['updated_at']}")
        print(f"🤖 Model:    {session['model']}")
        print(f"💬 Messages: {session['messages_count']}")
        print()
        
        # Token统计
        print(f"📈 Token Statistics:")
        
        total_input = session['total_input_tokens']
        total_output = session['total_output_tokens']
        total_reasoning = session.get('total_reasoning_tokens', 0)
        total_cached = session.get('total_cached_tokens', 0)
        
        # 区分regular input和cached input
        regular_input = total_input - total_cached
        
        if total_cached > 0:
            print(f"   Input:      {regular_input:>10,} tokens (regular)")
            print(f"   Cached:     {total_cached:>10,} tokens (from cache)")
            print(f"   Total Input:{total_input:>10,} tokens")
        else:
            print(f"   Input:      {total_input:>10,} tokens")
        
        print(f"   Output:     {total_output:>10,} tokens")
        
        if total_reasoning > 0:
            print(f"   Reasoning:  {total_reasoning:>10,} tokens")
        
        # 总计（不重复计算cached）
        total_tokens = total_input + total_output + total_reasoning
        print(f"   ────────────────────────")
        print(f"   Total:      {total_tokens:>10,} tokens")
        print()
        
        # 成本计算
        cost = self._calculate_cost(session)
        print(f"💰 Estimated Cost: ${cost:.8f} USD")
        print()
        
        # 对话轮次
        if show_messages and 'rounds' in session:
            print(f"📝 Conversation Rounds ({len(session['rounds'])}):")
            print(f"{'─'*70}")
            
            for i, round_data in enumerate(session['rounds'], 1):
                timestamp = round_data.get('timestamp', 'N/A')
                input_tokens = round_data.get('input_tokens', 0)
                output_tokens = round_data.get('output_tokens', 0)
                has_tool_calls = round_data.get('has_tool_calls', False)
                response_type = round_data.get('response_type', 'normal')
                
                print(f"\n  Round {i} @ {timestamp}")
                print(f"    Tokens: {input_tokens:,} in → {output_tokens:,} out")
                
                if has_tool_calls:
                    print(f"    🔧 Tool calls: Yes")
                
                if response_type != 'normal':
                    print(f"    Type: {response_type}")
                
                # 显示完整的messages（如果有）
                if 'messages' in round_data:
                    messages = round_data['messages']
                    print(f"    Messages ({len(messages)}):")
                    for msg in messages[-3:]:  # 只显示最后3条
                        role = msg.get('role', 'unknown')
                        content = msg.get('content', '')
                        content_preview = content[:100] + '...' if len(content) > 100 else content
                        print(f"      [{role}] {content_preview}")
                
                # 显示question/answer/reasoning（如果有）
                if 'question' in round_data:
                    q = round_data['question']
                    q_preview = q[:150] + '...' if len(q) > 150 else q
                    print(f"    ❓ Question: {q_preview}")
                
                if 'answer' in round_data:
                    a = round_data['answer']
                    a_preview = a[:150] + '...' if len(a) > 150 else a
                    print(f"    ✅ Answer: {a_preview}")
                
                if 'reasoning' in round_data and round_data['reasoning']:
                    r = round_data['reasoning']
                    r_preview = r[:150] + '...' if len(r) > 150 else r
                    print(f"    🧠 Reasoning: {r_preview}")
                
                if 'tool_calls' in round_data and round_data['tool_calls']:
                    print(f"    🛠️  Tool Calls:")
                    for tool_call in round_data['tool_calls']:
                        func_name = tool_call.get('function', {}).get('name', 'unknown')
                        args = tool_call.get('function', {}).get('arguments', '')
                        print(f"       - {func_name}({args[:80]}...)")
                
                # 显示token details（如果有）
                if round_data.get('input_token_details'):
                    print(f"    📊 Input Token Details: {round_data['input_token_details']}")
                
                if round_data.get('output_token_details'):
                    print(f"    📊 Output Token Details: {round_data['output_token_details']}")
            
            print(f"\n{'─'*70}")
        
        print(f"\n{'='*70}\n")
    
    def _calculate_cost(self, session: dict) -> float:
        """计算session的成本"""
        model = session.get('model', 'unknown')
        pricing = TOKEN_PRICING
```

### Core Architecture Module: `.agents/skills/agent-session-monitor/scripts/webserver.py`
```
#!/usr/bin/env python3
"""
Agent Session Monitor - Web Server
提供浏览器访问的观测界面
"""

import argparse
import json
import sys
from pathlib import Path
from http.server import HTTPServer, BaseHTTPRequestHandler
from urllib.parse import urlparse, parse_qs
from collections import defaultdict
from datetime import datetime, timedelta
import re

# 添加父目录到path以导入cli模块
sys.path.insert(0, str(Path(__file__).parent.parent))

try:
    from scripts.cli import SessionAnalyzer, TOKEN_PRICING
except ImportError:
    # 如果导入失败，定义简单版本
    TOKEN_PRICING = {
        "Qwen3-rerank": {"input": 0.0003, "output": 0.0012},
        "DeepSeek-R1": {"input": 0.004, "output": 0.012, "reasoning": 0.002},
    }


class SessionMonitorHandler(BaseHTTPRequestHandler):
    """HTTP请求处理器"""
    
    def __init__(self, *args, data_dir=None, **kwargs):
        self.data_dir = Path(data_dir) if data_dir else Path("./sessions")
        super().__init__(*args, **kwargs)
    
    def do_GET(self):
        """处理GET请求"""
        parsed_path = urlparse(self.path)
        path = parsed_path.path
        query = parse_qs(parsed_path.query)
        
        if path == '/' or path == '/index.html':
            self.serve_index()
        elif path == '/session':
            session_id = query.get('id', [None])[0]
            if session_id:
                self.serve_session_detail(session_id)
            else:
                self.send_error(400, "Missing session id")
        elif path == '/api/sessions':
            self.serve_api_sessions()
        elif path == '/api/session':
            session_id = query.get('id', [None])[0]
            if session_id:
                self.serve_api_session(session_id)
            else:
                self.send_error(400, "Missing session id")
        elif path == '/api/stats':
            self.serve_api_stats()
        else:
            self.send_error(404, "Not Found")
    
    def serve_index(self):
        """首页 - 总览"""
        html = self.generate_index_html()
        self.send_html(html)
    
    def serve_session_detail(self, session_id: str):
        """Session详情页"""
        html = self.generate_session_html(session_id)
        self.send_html(html)
    
    def serve_api_sessions(self):
        """API: 获取所有session列表"""
        sessions = self.load_all_sessions()
        
        # 简化数据
        data = []
        for session in sessions:
            data.append({
                'session_id': session['session_id'],
                'model': session.get('model', 'unknown'),
                'messages_count': session.get('messages_count', 0),
                'total_tokens': session['total_input_tokens'] + session['total_output_tokens'],
                'updated_at': session.get('updated_at', ''),
                'cost': self.calculate_cost(session)
            })
        
        # 按更新时间降序排序
        data.sort(key=lambda x: x['updated_at'], reverse=True)
        
        self.send_json(data)
    
    def serve_api_session(self, session_id: str):
        """API: 获取指定session的详细数据"""
        session = self.load_session(session_id)
        if session:
            session['cost'] = self.calculate_cost(session)
            self.send_json(session)
        else:
            self.send_error(404, "Session not found")
    
    def serve_api_stats(self):
        """API: 获取统计数据"""
        sessions = self.load_all_sessions()
        
        # 按模型统计
        by_model = defaultdict(lambda: {
            'count': 0,
            'input_tokens': 0,
            'output_tokens': 0,
            'cost': 0.0
        })
        
        # 按日期统计
        by_date = defaultdict(lambda: {
            'count': 0,
            'input_tokens': 0,
            'output_tokens': 0,
            'cost': 0.0,
            'models': set()
        })
        
        total_cost = 0.0
        
        for session in sessions:
            model = session.get('model', 'unknown')
            cost = self.calculate_cost(session)
            total_cost += cost
            
            # 按模型
            by_model[model]['count'] += 1
            by_model[model]['input_tokens'] += session['total_input_tokens']
            by_model[model]['output_tokens'] += session['total_output_tokens']
            by_model[model]['cost'] += cost
            
            # 按日期
            created_at = session.get('created_at', '')
            date_key = created_at[:10] if len(created_at) >= 10 else 'unknown'
            by_date[date_key]['count'] += 1
            by_date[date_key]['input_tokens'] += session['total_input_tokens']
            by_date[date_key]['output_tokens'] += session['total_output_tokens']
            by_date[date_key]['cost'] += cost
            by_date[date_key]['models'].add(model)
        
        # 转换sets为lists
        for date in by_date:
            by_date[date]['models'] = list(by_date[date]['models'])
        
        stats = {
            'total_sessions': len(sessions),
            'total_cost': total_cost,
            'by_model': dict(by_model),
            'by_date': dict(sorted(by_date.items(), reverse=True))
        }
        
        self.send_json(stats)
    
    def load_session(self, session_id: str):
        """加载指定session"""
        session_file = self.data_dir / f"{session_id}.json"
        if session_file.exists():
            with open(session_file, 'r', encoding='utf-8') as f:
                return json.load(f)
        return None
    
    def load_all_sessions(self):
        """加载所有session"""
        sessions = []
        for session_file in self.data_dir.glob("*.json"):
            try:
                with open(session_file, 'r', encoding='utf-8') as f:
                    sessions.append(json.load(f))
            except Exception as e:
                print(f"Warning: Failed to load {session_file}: {e}", file=sys.stderr)
        return sessions
    
    def calculate_cost(self, session: dict) -> float:
        """计算session成本"""
        model = session.get('model', 'unknown')
        pricing = TOKEN_PRICING.get(model, TOKEN_PRICING.get("GPT-4", {"input": 0.003, "output": 0.006}))
        
        input_tokens = session['total_input_tokens']
        output_tokens = session['total_output_tokens']
        reasoning_tokens = session.get('total_reasoning_tokens', 0)
        cached_tokens = session.get('total_cached_tokens', 0)
        
        # 区分regular input和cached input
        regular_input_tokens = input_tokens - cached_tokens
        
        input_cost = regular_input_tokens * pricing.get('input', 0) / 1000000
        output_cost = output_tokens * pricing.get('output', 0) / 1000000
        
        reasoning_cost = 0
        if 'reasoning' in pricing and reasoning_tokens > 0:
            reasoning_cost = reasoning_tokens * pricing['reasoning'] / 1000000
        
        cached_cost = 0
        if 'cached' in pricing and cached_tokens > 0:
            cached_cost = cached_tokens * pricing['cached'] / 1000000
        
        return input_cost + output_cost + reasoning_cost + cached_cost
    
    def send_html(self, html: str):
        """发送HTML响应"""
        self.send_response(200)
        self.send_header('Content-type', 'text/html; charset=utf-8')
        self.end_headers()
        self.wfile.write(html.encode('utf-8'))
    
    def send_json(self, data):
        """发送JSON响应"""
        self.send_response(200)
        self.send_header('Content-type', 'application/json; charset=utf-8')
        self.send_header('Access-Control-Allow-Origin', '*')
        self.end_headers()
        self.wfile.write(json.dumps(data, ensure_ascii=False, indent=2).encode('utf-8'))
    
    def generate_index_html(self) -> str:
        """生成首页HTML"""
        return '''<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Agent Session Monitor</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", R
```

### Core Architecture Module: `.agents/skills/higress-openclaw-integration/scripts/plugin/index.ts`
```
import { emptyPluginConfigSchema } from "openclaw/plugin-sdk";

const DEFAULT_GATEWAY_URL = "http://localhost:8080";
const DEFAULT_CONSOLE_URL = "http://localhost:8001";

// Model-specific context window and max tokens configurations
const MODEL_CONFIG: Record<string, { contextWindow: number; maxTokens: number }> = {
  "gpt-5.4": { contextWindow: 1_000_000, maxTokens: 128_000 },
  "gpt-5.4-mini": { contextWindow: 400_000, maxTokens: 128_000 },
  "gpt-5.4-nano": { contextWindow: 400_000, maxTokens: 128_000 },
  "claude-opus-4-6": { contextWindow: 1_000_000, maxTokens: 128_000 },
  "claude-sonnet-4-6": { contextWindow: 1_000_000, maxTokens: 64_000 },
  "claude-haiku-4-5": { contextWindow: 200_000, maxTokens: 64_000 },
  "qwen3.5-plus": { contextWindow: 960_000, maxTokens: 64_000 },
  "deepseek-chat": { contextWindow: 256_000, maxTokens: 128_000 },
  "deepseek-reasoner": { contextWindow: 256_000, maxTokens: 128_000 },
  "kimi-k2.5": { contextWindow: 256_000, maxTokens: 128_000 },
  "glm-5": { contextWindow: 200_000, maxTokens: 128_000 },
  "MiniMax-M2.5": { contextWindow: 200_000, maxTokens: 128_000 },
};

// Default values for unknown models
const DEFAULT_CONTEXT_WINDOW = 200_000;
const DEFAULT_MAX_TOKENS = 128_000;

// Common models that Higress AI Gateway typically supports
const DEFAULT_MODEL_IDS = [
  // Auto-routing special model
  "higress/auto",
  // Commonly models
  "kimi-k2.5",
  "glm-5",
  "MiniMax-M2.5",
  "qwen3.5-plus",
  // Anthropic models
  "claude-opus-4-6",
  "claude-sonnet-4-6",
  "claude-haiku-4-5",
  // OpenAI models
  "gpt-5.4",
  "gpt-5.4-mini",
  "gpt-5.4-nano",
  // DeepSeek models
  "deepseek-chat",
  "deepseek-reasoner",  
] as const;

function normalizeBaseUrl(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return DEFAULT_GATEWAY_URL;
  let normalized = trimmed;
  while (normalized.endsWith("/")) normalized = normalized.slice(0, -1);
  if (!normalized.endsWith("/v1")) normalized = `${normalized}/v1`;
  return normalized;
}

function validateUrl(value: string): string | undefined {
  const normalized = normalizeBaseUrl(value);
  try {
    new URL(normalized);
  } catch {
    return "Enter a valid URL";
  }
  return undefined;
}

function parseModelIds(input: string): string[] {
  const parsed = input
    .split(/[\n,]/)
    .map((model) => model.trim())
    .filter(Boolean);
  return Array.from(new Set(parsed));
}

function buildModelDefinition(modelId: string) {
  const isAutoModel = modelId === "higress/auto";
  const config = MODEL_CONFIG[modelId] || { contextWindow: DEFAULT_CONTEXT_WINDOW, maxTokens: DEFAULT_MAX_TOKENS };

  return {
    id: modelId,
    name: isAutoModel ? "Higress Auto Router" : modelId,
    api: "openai-completions",
    reasoning: true,
    input: ["text", "image"],
    cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
    contextWindow: config.contextWindow,
    maxTokens: config.maxTokens,
  };
}

async function testGatewayConnection(gatewayUrl: string): Promise<boolean> {
  try {
    // gatewayUrl already ends with /v1 from normalizeBaseUrl()
    // Use chat/completions endpoint with empty body to test connection
    // Higress doesn't support /models endpoint
    const response = await fetch(`${gatewayUrl}/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
      signal: AbortSignal.timeout(5000),
    });
    // Any response (including 400/401/422) means gateway is reachable
    return true;
  } catch {
    return false;
  }
}

async function fetchAvailableModels(consoleUrl: string): Promise<string[]> {
  try {
    // Try to get models from Higress Console API
    const response = await fetch(`${consoleUrl}/v1/ai/routes`, {
      method: "GET",
      headers: { "Content-Type": "application/json" },
      signal: AbortSignal.timeout(5000),
    });
    if (response.ok) {
      const data = (await response.json()) as { data?: { model?: string }[] };
      if (data.data && Array.isArray(data.data)) {
        return data.data
          .map((route: { model?: string }) => route.model)
          .filter((m): m is string => typeof m === "string");
      }
    }
  } catch {
    // Ignore errors, use defaults
  }
  return [];
}

const higressPlugin = {
  id: "higress",
  name: "Higress AI Gateway",
  description: "Model provider plugin for Higress AI Gateway with auto-routing support",
  configSchema: emptyPluginConfigSchema(),
  register(api) {
    api.registerProvider({
      id: "higress",
      label: "Higress AI Gateway",
      docsPath: "/providers/models",
      aliases: ["higress-gateway", "higress-ai"],
      auth: [
        {
          id: "api-key",
          label: "API Key",
          hint: "Configure Higress AI Gateway endpoint with optional API key",
          kind: "custom",
          run: async (ctx) => {
            // Step 1: Get Gateway URL
            const gatewayUrlInput = await ctx.prompter.text({
              message: "Higress AI Gateway URL",
              initialValue: DEFAULT_GATEWAY_URL,
              validate: validateUrl,
            });
            const gatewayUrl = normalizeBaseUrl(gatewayUrlInput);

            // Step 2: Get Console URL (for auto-router configuration)
            const consoleUrlInput = await ctx.prompter.text({
              message: "Higress Console URL (for auto-router config)",
              initialValue: DEFAULT_CONSOLE_URL,
              validate: validateUrl,
            });
            const consoleUrl = normalizeBaseUrl(consoleUrlInput);

            // Step 3: Test connection (create a new spinner)
            const spin = ctx.prompter.progress("Testing gateway connection…");
            const isConnected = await testGatewayConnection(gatewayUrl);
            if (!isConnected) {
              spin.stop("Gateway connection failed");
              await ctx.prompter.note(
                [
                  "Could not connect to Higress AI Gateway.",
                  "Make sure the gateway is running and the URL is correct.",
                ].join("\n"),
                "Connection Warning",
              );
            } else {
              spin.stop("Gateway connected");
            }

            // Step 4: Get API Key (optional for local gateway)
            const apiKeyInput = await ctx.prompter.text({
              message: "API Key (leave empty if not required)",
              initialValue: "",
            }) || '';
            const apiKey = apiKeyInput.trim() || "higress-local";

            // Step 5: Fetch available models (create a new spinner)
            const spin2 = ctx.prompter.progress("Fetching available models…");
            const fetchedModels = await fetchAvailableModels(consoleUrl);
            const defaultModels = fetchedModels.length > 0
              ? ["higress/auto", ...fetchedModels]
              : DEFAULT_MODEL_IDS;
            spin2.stop();

            // Step 6: Let user customize model list
            const modelInput = await ctx.prompter.text({
              message: "Model IDs (comma-separated, higress/auto enables auto-routing)",
              initialValue: defaultModels.slice(0, 10).join(", "),
              validate: (value) =>
                parseModelIds(value).length > 0 ? undefined : "Enter at least one model id",
            });

            const modelIds = parseModelIds(modelInput);
            const hasAutoModel = modelIds.includes("higress/auto");

            // Always add higress/ provider prefix to create model reference
            const defaultModelId = hasAutoModel
              ? "higress/auto"
              : (modelIds[0] ?? "glm-5");
            const defaultModelRef = `higress/${defaultModelId}`;

            // Step 7: Configure default model for auto-routing
            let autoRoutingDefaultModel = "glm-5";
            if (hasAutoModel) {
              const autoRoutingModelInput = await ctx.prompter.text({
                message: "Default model for auto-routing (
```

### Core Architecture Module: `api/extensions/v1alpha1/wasmplugin.pb.go`
```
// Copyright Istio Authors
//
//   Licensed under the Apache License, Version 2.0 (the "License");
//   you may not use this file except in compliance with the License.
//   You may obtain a copy of the License at
//
//       http://www.apache.org/licenses/LICENSE-2.0
//
//   Unless required by applicable law or agreed to in writing, software
//   distributed under the License is distributed on an "AS IS" BASIS,
//   WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
//   See the License for the specific language governing permissions and
//   limitations under the License.
// Modified by Higress Authors

// Code generated by protoc-gen-go. DO NOT EDIT.
// versions:
// 	protoc-gen-go v1.31.0
// 	protoc        (unknown)
// source: extensions/v1alpha1/wasmplugin.proto

// $schema: higress.extensions.v1alpha1.WasmPlugin
// $title: WasmPlugin
// $description: Extend the functionality provided by the envoy through WebAssembly filters.

package v1alpha1

import (
	_struct "github.com/golang/protobuf/ptypes/struct"
	wrappers "github.com/golang/protobuf/ptypes/wrappers"
	protoreflect "google.golang.org/protobuf/reflect/protoreflect"
	protoimpl "google.golang.org/protobuf/runtime/protoimpl"
	reflect "reflect"
	sync "sync"
)

const (
	// Verify that this generated code is sufficiently up-to-date.
	_ = protoimpl.EnforceVersion(20 - protoimpl.MinVersion)
	// Verify that runtime/protoimpl is sufficiently up-to-date.
	_ = protoimpl.EnforceVersion(protoimpl.MaxVersion - 20)
)

// Route type for matching rules.
// Extended by Higress
type RouteType int32

const (
	// HTTP route (default)
	RouteType_HTTP RouteType = 0
	// GRPC route
	RouteType_GRPC RouteType = 1
)

// Enum value maps for RouteType.
var (
	RouteType_name = map[int32]string{
		0: "HTTP",
		1: "GRPC",
	}
	RouteType_value = map[string]int32{
		"HTTP": 0,
		"GRPC": 1,
	}
)

func (x RouteType) Enum() *RouteType {
	p := new(RouteType)
	*p = x
	return p
}

func (x RouteType) String() string {
	return protoimpl.X.EnumStringOf(x.Descriptor(), protoreflect.EnumNumber(x))
}

func (RouteType) Descriptor() protoreflect.EnumDescriptor {
	return file_extensions_v1alpha1_wasmplugin_proto_enumTypes[0].Descriptor()
}

func (RouteType) Type() protoreflect.EnumType {
	return &file_extensions_v1alpha1_wasmplugin_proto_enumTypes[0]
}

func (x RouteType) Number() protoreflect.EnumNumber {
	return protoreflect.EnumNumber(x)
}

// Deprecated: Use RouteType.Descriptor instead.
func (RouteType) EnumDescriptor() ([]byte, []int) {
	return file_extensions_v1alpha1_wasmplugin_proto_rawDescGZIP(), []int{0}
}

// The phase in the filter chain where the plugin will be injected.
type PluginPhase int32

const (
	// Control plane decides where to insert the plugin. This will generally
	// be at the end of the filter chain, right before the Router.
	// Do not specify `PluginPhase` if the plugin is independent of others.
	PluginPhase_UNSPECIFIED_PHASE PluginPhase = 0
	// Insert plugin before Istio authentication filters.
	PluginPhase_AUTHN PluginPhase = 1
	// Insert plugin before Istio authorization filters and after Istio authentication filters.
	PluginPhase_AUTHZ PluginPhase = 2
	// Insert plugin before Istio stats filters and after Istio authorization filters.
	PluginPhase_STATS PluginPhase = 3
)

// Enum value maps for PluginPhase.
var (
	PluginPhase_name = map[int32]string{
		0: "UNSPECIFIED_PHASE",
		1: "AUTHN",
		2: "AUTHZ",
		3: "STATS",
	}
	PluginPhase_value = map[string]int32{
		"UNSPECIFIED_PHASE": 0,
		"AUTHN":             1,
		"AUTHZ":             2,
		"STATS":             3,
	}
)

func (x PluginPhase) Enum() *PluginPhase {
	p := new(PluginPhase)
	*p = x
	return p
}

func (x PluginPhase) String() string {
	return protoimpl.X.EnumStringOf(x.Descriptor(), protoreflect.EnumNumber(x))
}

func (PluginPhase) Descriptor() protoreflect.EnumDescriptor {
	return file_extensions_v1alpha1_wasmplugin_proto_enumTypes[1].Descriptor()
}

func (PluginPhase) Type() protoreflect.EnumType {
	return &file_extensions_v1alpha1_wasmplugin_proto_enumTypes[1]
}

func (x PluginPhase) Number() protoreflect.EnumNumber {
	return protoreflect.EnumNumber(x)
}

// Deprecated: Use PluginPhase.Descriptor instead.
func (PluginPhase) EnumDescriptor() ([]byte, []int) {
	return file_extensions_v1alpha1_wasmplugin_proto_rawDescGZIP(), []int{1}
}

// The pull behaviour to be applied when fetching an OCI image,
// mirroring K8s behaviour.
//
// <!--
// buf:lint:ignore ENUM_VALUE_UPPER_SNAKE_CASE
// -->
type PullPolicy int32

const (
	// Defaults to IfNotPresent, except for OCI images with tag `latest`, for which
	// the default will be Always.
	PullPolicy_UNSPECIFIED_POLICY PullPolicy = 0
	// If an existing version of the image has been pulled before, that
	// will be used. If no version of the image is present locally, we
	// will pull the latest version.
	PullPolicy_IfNotPresent PullPolicy = 1
	// We will always pull the latest version of an image when applying
	// this plugin.
	PullPolicy_Always PullPolicy = 2
)

// Enum value maps for PullPolicy.
var (
	PullPolicy_name = map[int32]string{
		0: "UNSPECIFIED_POLICY",
		1: "IfNotPresent",
		2: "Always",
	}
	PullPolicy_value = map[string]int32{
		"UNSPECIFIED_POLICY": 0,
		"IfNotPresent":       1,
		"Always":             2,
	}
)

func (x PullPolicy) Enum() *PullPolicy {
	p := new(PullPolicy)
	*p = x
	return p
}

func (x PullPolicy) String() string {
	return protoimpl.X.EnumStringOf(x.Descriptor(), protoreflect.EnumNumber(x))
}

func (PullPolicy) Descriptor() protoreflect.EnumDescriptor {
	return file_extensions_v1alpha1_wasmplugin_proto_enumTypes[2].Descriptor()
}

func (PullPolicy) Type() protoreflect.EnumType {
	return &file_extensions_v1alpha1_wasmplugin_proto_enumTypes[2]
}

func (x PullPolicy) Number() protoreflect.EnumNumber {
	return protoreflect.EnumNumber(x)
}

// Deprecated: Use PullPolicy.Descriptor instead.
func (PullPolicy) EnumDescriptor() ([]byte, []int) {
	return file_extensions_v1alpha1_wasmplugin_proto_rawDescGZIP(), []int{2}
}

type EnvValueSource int32

const (
	// Explicitly given key-value pairs to be injected to this VM
	EnvValueSource_INLINE EnvValueSource = 0
	// *Istio-proxy's* environment variables exposed to this VM.
	EnvValueSource_HOST EnvValueSource = 1
)

// Enum value maps for EnvValueSource.
var (
	EnvValueSource_name = map[int32]string{
		0: "INLINE",
		1: "HOST",
	}
	EnvValueSource_value = map[string]int32{
		"INLINE": 0,
		"HOST":   1,
	}
)

func (x EnvValueSource) Enum() *EnvValueSource {
	p := new(EnvValueSource)
	*p = x
	return p
}

func (x EnvValueSource) String() string {
	return protoimpl.X.EnumStringOf(x.Descriptor(), protoreflect.EnumNumber(x))
}

func (EnvValueSource) Descriptor() protoreflect.EnumDescriptor {
	return file_extensions_v1alpha1_wasmplugin_proto_enumTypes[3].Descriptor()
}

func (EnvValueSource) Type() protoreflect.EnumType {
	return &file_extensions_v1alpha1_wasmplugin_proto_enumTypes[3]
}

func (x EnvValueSource) Number() protoreflect.EnumNumber {
	return protoreflect.EnumNumber(x)
}

// Deprecated: Use EnvValueSource.Descriptor instead.
func (EnvValueSource) EnumDescriptor() ([]byte, []int) {
	return file_extensions_v1alpha1_wasmplugin_proto_rawDescGZIP(), []int{3}
}

type FailStrategy int32

const (
	// A fatal error in the binary fetching or during the plugin execution causes
	// all subsequent requests to fail with 5xx.
	FailStrategy_FAIL_CLOSE FailStrategy = 0
	// Enables the fail open behavior for the Wasm plugin fatal errors to bypass
	// the plugin execution. A fatal error can be a failure to fetch the remote
	// binary, an exception, or abort() on the VM. This flag is not recommended
	// for the authentication or the authorization plugins.
	FailStrategy_FAIL_OPEN FailStrategy = 1
)

// Enum value maps for FailStrategy.
var (
	FailStrategy_name = map[int32]string{
		0: "FAIL_CLOSE",
		1: "FAIL_OPEN",
	}
	FailStrategy_value = map[string]int32{
		"FAIL_CLOSE": 0,
		"FAIL_OPEN":  1,
	}
)

func (x FailStrategy) Enum() *FailStrate
```

### Core Architecture Module: `api/extensions/v1alpha1/wasmplugin_deepcopy.gen.go`
```
// Code generated by protoc-gen-deepcopy. DO NOT EDIT.
package v1alpha1

import (
	proto "google.golang.org/protobuf/proto"
)

// DeepCopyInto supports using WasmPlugin within kubernetes types, where deepcopy-gen is used.
func (in *WasmPlugin) DeepCopyInto(out *WasmPlugin) {
	p := proto.Clone(in).(*WasmPlugin)
	*out = *p
}

// DeepCopy is an autogenerated deepcopy function, copying the receiver, creating a new WasmPlugin. Required by controller-gen.
func (in *WasmPlugin) DeepCopy() *WasmPlugin {
	if in == nil {
		return nil
	}
	out := new(WasmPlugin)
	in.DeepCopyInto(out)
	return out
}

// DeepCopyInterface is an autogenerated deepcopy function, copying the receiver, creating a new WasmPlugin. Required by controller-gen.
func (in *WasmPlugin) DeepCopyInterface() interface{} {
	return in.DeepCopy()
}

// DeepCopyInto supports using MatchRule within kubernetes types, where deepcopy-gen is used.
func (in *MatchRule) DeepCopyInto(out *MatchRule) {
	p := proto.Clone(in).(*MatchRule)
	*out = *p
}

// DeepCopy is an autogenerated deepcopy function, copying the receiver, creating a new MatchRule. Required by controller-gen.
func (in *MatchRule) DeepCopy() *MatchRule {
	if in == nil {
		return nil
	}
	out := new(MatchRule)
	in.DeepCopyInto(out)
	return out
}

// DeepCopyInterface is an autogenerated deepcopy function, copying the receiver, creating a new MatchRule. Required by controller-gen.
func (in *MatchRule) DeepCopyInterface() interface{} {
	return in.DeepCopy()
}

// DeepCopyInto supports using VmConfig within kubernetes types, where deepcopy-gen is used.
func (in *VmConfig) DeepCopyInto(out *VmConfig) {
	p := proto.Clone(in).(*VmConfig)
	*out = *p
}

// DeepCopy is an autogenerated deepcopy function, copying the receiver, creating a new VmConfig. Required by controller-gen.
func (in *VmConfig) DeepCopy() *VmConfig {
	if in == nil {
		return nil
	}
	out := new(VmConfig)
	in.DeepCopyInto(out)
	return out
}

// DeepCopyInterface is an autogenerated deepcopy function, copying the receiver, creating a new VmConfig. Required by controller-gen.
func (in *VmConfig) DeepCopyInterface() interface{} {
	return in.DeepCopy()
}

// DeepCopyInto supports using EnvVar within kubernetes types, where deepcopy-gen is used.
func (in *EnvVar) DeepCopyInto(out *EnvVar) {
	p := proto.Clone(in).(*EnvVar)
	*out = *p
}

// DeepCopy is an autogenerated deepcopy function, copying the receiver, creating a new EnvVar. Required by controller-gen.
func (in *EnvVar) DeepCopy() *EnvVar {
	if in == nil {
		return nil
	}
	out := new(EnvVar)
	in.DeepCopyInto(out)
	return out
}

// DeepCopyInterface is an autogenerated deepcopy function, copying the receiver, creating a new EnvVar. Required by controller-gen.
func (in *EnvVar) DeepCopyInterface() interface{} {
	return in.DeepCopy()
}

```

### Core Architecture Module: `api/extensions/v1alpha1/wasmplugin_json.gen.go`
```
// Code generated by protoc-gen-jsonshim. DO NOT EDIT.
package v1alpha1

import (
	bytes "bytes"
	jsonpb "github.com/golang/protobuf/jsonpb"
)

// MarshalJSON is a custom marshaler for WasmPlugin
func (this *WasmPlugin) MarshalJSON() ([]byte, error) {
	str, err := WasmpluginMarshaler.MarshalToString(this)
	return []byte(str), err
}

// UnmarshalJSON is a custom unmarshaler for WasmPlugin
func (this *WasmPlugin) UnmarshalJSON(b []byte) error {
	return WasmpluginUnmarshaler.Unmarshal(bytes.NewReader(b), this)
}

// MarshalJSON is a custom marshaler for MatchRule
func (this *MatchRule) MarshalJSON() ([]byte, error) {
	str, err := WasmpluginMarshaler.MarshalToString(this)
	return []byte(str), err
}

// UnmarshalJSON is a custom unmarshaler for MatchRule
func (this *MatchRule) UnmarshalJSON(b []byte) error {
	return WasmpluginUnmarshaler.Unmarshal(bytes.NewReader(b), this)
}

// MarshalJSON is a custom marshaler for VmConfig
func (this *VmConfig) MarshalJSON() ([]byte, error) {
	str, err := WasmpluginMarshaler.MarshalToString(this)
	return []byte(str), err
}

// UnmarshalJSON is a custom unmarshaler for VmConfig
func (this *VmConfig) UnmarshalJSON(b []byte) error {
	return WasmpluginUnmarshaler.Unmarshal(bytes.NewReader(b), this)
}

// MarshalJSON is a custom marshaler for EnvVar
func (this *EnvVar) MarshalJSON() ([]byte, error) {
	str, err := WasmpluginMarshaler.MarshalToString(this)
	return []byte(str), err
}

// UnmarshalJSON is a custom unmarshaler for EnvVar
func (this *EnvVar) UnmarshalJSON(b []byte) error {
	return WasmpluginUnmarshaler.Unmarshal(bytes.NewReader(b), this)
}

var (
	WasmpluginMarshaler   = &jsonpb.Marshaler{}
	WasmpluginUnmarshaler = &jsonpb.Unmarshaler{AllowUnknownFields: true}
)

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #4878** (2026-09-29): **fix(mcp-session): write back assembled SSE fragments when path rewrite is disabled**
  *Symptoms*: ## I. Describe what this PR did  Fixes a response-integrity bug in the mcp-session plugin's SSE direct-proxy mode: when an upstream splits one SSE message across multiple response chunks, the first chunk was cached and drained from the wire, but the assembled message was written back only when path rewriting succeeded. With `enable_path_rewrite: false` (or a rewrite-prefix mismatch) the assembled data was dropped and the client received only the last chunk — a partial line like `essions?sessionId=demo` — leaving legacy HTTP+SSE MCP clients without the endpoint they need for subsequent POSTs.  The fix makes every path that consumes the fragment cache write the assembled data back into the buffer: rewritten form when rewriting applies (unchanged behavior), the original combined bytes otherwise. The cache lifecycle (buffer-and-retry for incomplete messages) is untouched, and the request-body-buffering region is deliberately not modified.  Fixes #4651  ## II. Related issues  #4651 (verified analysis in the issue thread; the fix direction was validated against the reported reproduction cases).  ## III. Testing  Five new tests in `filter_test.go` covering: fragmented endpoint without rewrite (complete original message restored), fragmented endpoint with rewrite (regression guard), fragmented endpoint with prefix mismatch (complete original restored), single-chunk passthrough (behavior guard), fragmented malformed endpoint, and fragmented non-endpoint events. Four of the six fail on
  **Post-Mortem & Fix Analysis**:
  > :warning: Please install the !['codecov app svg image'](https://github.com/codecov/engineering-team/assets/152432831/e90313f4-9d3a-4b63-8b54-cfe14e7ec20d) to ensure uploads and comments are reliably processed by Codecov.  ## [Codecov](https://app.codecov.io/gh/higress-group/higress/pull/4878?dropdown=coverage&src=pr&el=h1&utm_medium=referral&utm_source=github&utm_content=comment&utm_campaign=pr+comments&utm_term=None) Report :white_check_mark: All modified and coverable lines are covered by tests. :warning: Please [upload](https://docs.codecov.com/docs/codecov-uploader) report for BASE (`main@943b31b`). [Learn more](https://docs.codecov.io/docs/error-reference?utm_medium=referral&utm_source=github&utm_content=comment&utm_campaign=pr+comments&utm_term=None#section-missing-base-commit) about missing BASE report. :exclamation: Your organization needs to install the [Codecov GitHub app](https://github.com/apps/codecov/installations/select_target) to enable full functionality.  <details><su

- **Issue #4873** (2026-09-29): **plugins/wasm-go/extensions/hmac-auth-apisix/main.go:78 - HMAC auth fails open for attached rules with an empty allow list**
  *Symptoms*: 缺陷说明：onHttpRequestHeaders (plugins/wasm-go/extensions/hmac-auth-apisix/main.go:65) computes noAllow, globalAuthNoSet/True/False and ruleSet. At line 78 it does `if globalAuthSetFalse || (globalAuthNoSet && ruleSet) { if noAllow { log.Info("authorization is not required"); ctx.DontReadRequestBody(); return types.ActionContinue } }`. cfg.RuleSet is set to true only by ParseOverrideRuleConfig (config/config.go:171), i.e. the request matched a domain/route rule that explicitly attaches this plugin; ParseGlobalConfig always sets RuleSet=false (config/config.go:40) and never reads an `allow` key, and ParseOverrideRuleConfig leaves Allow empty when the rule has no `allow` key (config/config.go:152-169). So for the common configuration where the plugin is attached to a route rule without `global_auth` set, a request that matches that rule has ruleSet==true, globalAuthNoSet==true and noAllow==true, and the handler returns ActionContinue without ever calling retrieveHmacFieldsAndConsumer or verifying the signature. The plugin therefore admits every caller on any domain/route it is attached to instead of denying, contradicting its purpose and leaving the upstream unauthenticated; the later allow-list check at lines 99-109 is never reached. Configured `allow` lists and rules with `global_auth` set are unaffected, which is why the flaw is easy to miss.  复现步骤：Deploy hmac-auth-apisix with a global config that defines consumers and omits global_auth (or sets global_auth: false), then attach 
  **Post-Mortem & Fix Analysis**:
  > Superseded by #4835, which landed the same fail-closed behaviour for a matched domain/route rule with an empty `allow` list, together with the surrounding global-auth/rule-set cleanup and a broader regression suite. Closing this one so the discussion stays in a single place - thanks to @johnlanni for the review.

- **Issue #4855** (2026-09-29): **fix: replace instead of append X-Mse-Consumer consumer identity header**
  *Symptoms*: ## I. Describe what this PR did  Changes every producer of the `X-Mse-Consumer` consumer identity header from append to replace semantics. Previously the header was added without removing a client-supplied value, so a request could leave the gateway carrying two copies of the header with the client's value first — any first-value reader would trust the spoofed identity instead of the gateway's assertion.  Producers updated (enumerated by tree-wide search): - wasm-cpp `key_auth/plugin.cc` (three call sites): `removeHeader` before `addHeader` - wasm-cpp `basic_auth/plugin.cc`: same pattern - Go-side producers and the ai-quota family readers aligned to the single canonical value (minimal change, no auth redesign)  Each modified plugin's README notes the new invariant: a client-supplied `X-Mse-Consumer` is always overridden by the gateway's assertion.  ## II. Related issues  None — identity-header semantics correction found during internal review.  ## III. Testing  Go plugins: unit tests assert exactly-one-value after the plugin runs (client header present → overridden; absent → added). C++ changes are compile-verified by CI (bazel build not available on weak hosts); diffs reviewed line-by-line.  ## IV. Agent participation and issue-spec gate  - [x] **Material agent participation** (implementation by agent under maintainer direction; maintainer reviewed, tested locally, and owns the change). 
  **Post-Mortem & Fix Analysis**:
  > :warning: Please install the !['codecov app svg image'](https://github.com/codecov/engineering-team/assets/152432831/e90313f4-9d3a-4b63-8b54-cfe14e7ec20d) to ensure uploads and comments are reliably processed by Codecov.  ## [Codecov](https://app.codecov.io/gh/higress-group/higress/pull/4855?dropdown=coverage&src=pr&el=h1&utm_medium=referral&utm_source=github&utm_content=comment&utm_campaign=pr+comments&utm_term=None) Report :white_check_mark: All modified and coverable lines are covered by tests. :warning: Please [upload](https://docs.codecov.com/docs/codecov-uploader) report for BASE (`main@b7fb876`). [Learn more](https://docs.codecov.io/docs/error-reference?utm_medium=referral&utm_source=github&utm_content=comment&utm_campaign=pr+comments&utm_term=None#section-missing-base-commit) about missing BASE report. :exclamation: Your organization needs to install the [Codecov GitHub app](https://github.com/apps/codecov/installations/select_target) to enable full functionality.  <details><su

- **Issue #4854** (2026-09-29): **docs: clarify allowTools is route-scoped**
  *Symptoms*: ## I. Describe what this PR did  Clarifies in the MCP servers README (en + zh) that the `allowTools` tool whitelist applies at route scope: it covers only requests matched by the route(s) where the mcp-server plugin is configured. A backend that is also attached to a plain HTTP route on the same gateway is not covered by that whitelist on those routes — backends offering sensitive tools should not be exposed through non-plugin routes.  ## II. Related issues  None — documentation clarification.  ## III. Testing  Docs-only change; no tests affected.  ## IV. Agent participation and issue-spec gate  - [x] **Material agent participation** (implementation by agent under maintainer direction; maintainer reviewed and owns the change). 
  **Post-Mortem & Fix Analysis**:
  > :warning: Please install the !['codecov app svg image'](https://github.com/codecov/engineering-team/assets/152432831/e90313f4-9d3a-4b63-8b54-cfe14e7ec20d) to ensure uploads and comments are reliably processed by Codecov.  ## [Codecov](https://app.codecov.io/gh/higress-group/higress/pull/4854?dropdown=coverage&src=pr&el=h1&utm_medium=referral&utm_source=github&utm_content=comment&utm_campaign=pr+comments&utm_term=None) Report :white_check_mark: All modified and coverable lines are covered by tests. :warning: Please [upload](https://docs.codecov.com/docs/codecov-uploader) report for BASE (`main@a3714ff`). [Learn more](https://docs.codecov.io/docs/error-reference?utm_medium=referral&utm_source=github&utm_content=comment&utm_campaign=pr+comments&utm_term=None#section-missing-base-commit) about missing BASE report. :exclamation: Your organization needs to install the [Codecov GitHub app](https://github.com/apps/codecov/installations/select_target) to enable full functionality.  <details><su

- **Issue #4853** (2026-09-29): **fix: require authentication for RAG MCP server write path**
  *Symptoms*: ## I. Describe what this PR did  Requires HTTP Basic authentication for the RAG MCP server. The server exposes tools that write to and delete from a shared vector store (`create-chunks-from-text`, `delete-chunk`), but it never participated in the framework's auth flow, so any caller that could reach the endpoint could mutate the vector store.  Implementation: `RAGConfig` implements the framework's existing `common.BasicAuthProvider` interface (`GetBasicAuthCredentials`); credentials are required at config parse time — a config without `username`/`password` is rejected, keeping the gate from being silently disabled. Credentials are kept out of `config.Config` because that struct is dumped with `%+v` in several debug logs.  The framework's auth middleware enforces the check before any tool handler runs; 284 lines of tests cover: missing credentials rejected, wrong credentials 401, valid credentials pass-through, and config-parse rejection of empty credentials.  ## II. Related issues  None — hardening found during internal review.  ## III. Testing  `go test ./plugins/golang-filter/mcp-server/...` — the mcp-server package suite (including the new auth tests) passes. Note: `servers/rag` `TestNewRAGClient` panics with "To implement" — verified pre-existing on main (worktree check), unrelated to this change.  ## IV. Agent participation and issue-spec gate  - [x] **Material agent participation** (implementation by agent under maintainer direction; maintainer reviewed, tested locally,
  **Post-Mortem & Fix Analysis**:
  > :warning: Please install the !['codecov app svg image'](https://github.com/codecov/engineering-team/assets/152432831/e90313f4-9d3a-4b63-8b54-cfe14e7ec20d) to ensure uploads and comments are reliably processed by Codecov.  ## [Codecov](https://app.codecov.io/gh/higress-group/higress/pull/4853?dropdown=coverage&src=pr&el=h1&utm_medium=referral&utm_source=github&utm_content=comment&utm_campaign=pr+comments&utm_term=None) Report :white_check_mark: All modified and coverable lines are covered by tests. :warning: Please [upload](https://docs.codecov.com/docs/codecov-uploader) report for BASE (`main@a3714ff`). [Learn more](https://docs.codecov.io/docs/error-reference?utm_medium=referral&utm_source=github&utm_content=comment&utm_campaign=pr+comments&utm_term=None#section-missing-base-commit) about missing BASE report. :exclamation: Your organization needs to install the [Codecov GitHub app](https://github.com/apps/codecov/installations/select_target) to enable full functionality.  <details><su

- **Issue #4852** (2026-09-29): **refactor: migrate deprecated wrapper.HasRequestBody() to ctx.HasRequestBody()**
  *Symptoms*: ## I. Describe what this PR did  Migrates the two remaining consumers of the deprecated package-level `wrapper.HasRequestBody()` to the context method `ctx.HasRequestBody()`: - `hmac-auth-apisix/main.go` (request-body validation branch) - `ext-auth/main.go` (authorization request with-body branch)  The deprecated function only inspects headers (Content-Length / Content-Type / Transfer-Encoding) and returns incorrect results for HTTP/2 requests whose bodies arrive as DATA frames without those headers. The context method also considers whether end-of-stream was received during the header phase, which is the accurate signal. No behavior is changed beyond adopting the corrected body detection.  ## II. Related issues  None — SDK API migration following the upstream deprecation notice.  ## III. Testing  Unit tests updated/added for both call sites; full plugin suites pass (`hmac-auth-apisix`, `ext-auth` ~33s).  ## IV. Agent participation and issue-spec gate  - [x] **Material agent participation** (implementation by agent under maintainer direction; maintainer reviewed, tested locally, and owns the change). 
  **Post-Mortem & Fix Analysis**:
  > :warning: Please install the !['codecov app svg image'](https://github.com/codecov/engineering-team/assets/152432831/e90313f4-9d3a-4b63-8b54-cfe14e7ec20d) to ensure uploads and comments are reliably processed by Codecov.  ## [Codecov](https://app.codecov.io/gh/higress-group/higress/pull/4852?dropdown=coverage&src=pr&el=h1&utm_medium=referral&utm_source=github&utm_content=comment&utm_campaign=pr+comments&utm_term=None) Report :white_check_mark: All modified and coverable lines are covered by tests. :warning: Please [upload](https://docs.codecov.com/docs/codecov-uploader) report for BASE (`main@a3714ff`). [Learn more](https://docs.codecov.io/docs/error-reference?utm_medium=referral&utm_source=github&utm_content=comment&utm_campaign=pr+comments&utm_term=None#section-missing-base-commit) about missing BASE report. :exclamation: Your organization needs to install the [Codecov GitHub app](https://github.com/apps/codecov/installations/select_target) to enable full functionality.  <details><su

- **Issue #4837** (2026-09-29): **ai-proxy: hunyuan provider classifies every path as chat completion, misprocessing /v1/embeddings (protocol: original)**
  *Symptoms*: ### Summary  Under `protocol: original`, the hunyuan provider classifies **every** request path as `ApiNameChatCompletion`, including the OpenAI-compatible embeddings path (`/v1/embeddings`). Embeddings requests are therefore stored and processed as chat completions: the response is run through the chat-completion transformation path, which corrupts embeddings responses.  ### Environment  - Higress commit: `b44d4f77011ad7f63c2fefef5b8cd2dec0cff1c6` (current `main`, 2026-09-28) - Plugin: `ai-proxy` (wasm-go), provider `hunyuan`  ### Configuration  ```yaml apiVersion: extensions.higress.io/v1alpha1 kind: WasmPlugin metadata:   name: ai-proxy-hunyuan-original spec:   defaultConfig:     provider:       hunyuanAuthId: "<secret-id>"       hunyuanAuthKey: "<secret-key>"       protocol: original       type: hunyuan   url: file:///opt/plugins/wasm-go/extensions/ai-proxy/plugin.wasm ```  ### Steps to reproduce  1. Install Higress with the ai-proxy plugin using the config above, routed to the hunyuan backend (`hunyuan-apigw.tencentcloudapi.com`). 2. Send an embeddings request through the gateway, using the embeddings path the provider itself declares:  ```bash curl -X POST http://<gateway>/v1/embeddings \   -H "Content-Type: application/json" \   -d '{"model":"hunyuan-embedding","input":["hello"]}' ```  ### Expected behavior  `GetApiName("/v1/embeddings")` returns `ApiNameEmbeddings`, matching the capability declared by `hunyuanProviderInitializer.DefaultCapabilities()`, and the embeddi
  **Post-Mortem & Fix Analysis**:
  > ### Runtime confirmation (live gateway)  Confirmed on a live gateway: kind cluster (k8s v1.34), official higress controller/pilot/gateway `v2.2.4` images, ai-proxy wasm built from `main` @ `b44d4f77`, provider config `protocol: original` routed to llm-mock-server.  **Request**  ```bash curl -X POST http://<gateway>/v1/embeddings -H "Host: hunyuan-apigw.tencentcloudapi.com" \   -H "Content-Type: application/json" \   -d '{"model":"gpt-3","input":["hello world"],"encoding_format":"float"}' ```  **Observed on `main`** — the embeddings request is misclassified as a chat completion, the path is rewritten to the chat endpoint, and the embeddings body is then rejected by chat-completion validation with a client-facing **400**:  ``` HTTP/1.1 400 {"error":"Key: 'chatCompletionRequest.Messages' Error:Field validation for 'Messages' failed on the 'required' tag"}  wasm log higress-system.<plugin>: [ai-proxy] [onHttpRequestHeader] provider=hunyuan wasm log higress-system.<plugin>: [ai-proxy] [Over
  > The path misclassification described here is fixed by #4220 (merged): hunyuanProvider.GetApiName now classifies /v1/embeddings as ApiNameEmbeddings, and the runtime confirmation above shows the embeddings request keeping its semantics end-to-end (no rewrite to /v1/chat/completions, no chat-parse 400).  The residual original-protocol gap noted in the #4220 review — the TC-Action still being hard-coded to ChatCompletions — is followed up in #4872. Closing this issue; thanks for the quick review and merge.

- **Issue #4835** (2026-09-29): **fix: hmac-auth-apisix fails closed for attached rules with empty allow list**
  *Symptoms*: ## I. Describe what this PR did  Tightens `hmac-auth-apisix` semantics when a route/domain rule **explicitly attaches** the plugin but carries an empty/absent `allow` list. The old code treated "no allow" as "plugin not active" and returned `ActionContinue` before any signature verification, which did not match operator intent for explicitly-attached rules.  New semantics (only the bolded cell changed):  | rule matched | allow list | global_auth | before | after | |---|---|---|---|---| | yes | empty | unset/false | **skip verification (old)** | **401 (fail closed)** | | yes | empty | true | verify (allow = fine-grained only) | unchanged | | yes | non-empty | any | verify + allow check | unchanged | | no | — | false | pass-through | unchanged | | no | — | unset | global auth applies (legacy behavior) | unchanged |  README (zh/en) updated to document the fail-closed semantics.  ## II. Related issues  None — semantics correction found during internal review. Bugfix class.  ## III. Testing  416-line behavior-matrix test (`main_failclosed_test.go`) covering every cell above old-vs-new; full plugin suite passes.  ## IV. Agent participation and issue-spec gate  - [x] **Material agent participation** (implementation by agent under maintainer direction; maintainer reviewed, tested locally, and owns the change). - Gate status: maintainer exception applies (maintainer is the PR author). 
  **Post-Mortem & Fix Analysis**:
  > :warning: Please install the !['codecov app svg image'](https://github.com/codecov/engineering-team/assets/152432831/e90313f4-9d3a-4b63-8b54-cfe14e7ec20d) to ensure uploads and comments are reliably processed by Codecov.  ## [Codecov](https://app.codecov.io/gh/higress-group/higress/pull/4835?dropdown=coverage&src=pr&el=h1&utm_medium=referral&utm_source=github&utm_content=comment&utm_campaign=pr+comments&utm_term=None) Report :white_check_mark: All modified and coverable lines are covered by tests. :warning: Please [upload](https://docs.codecov.com/docs/codecov-uploader) report for BASE (`main@b44d4f7`). [Learn more](https://docs.codecov.io/docs/error-reference?utm_medium=referral&utm_source=github&utm_content=comment&utm_campaign=pr+comments&utm_term=None#section-missing-base-commit) about missing BASE report. :exclamation: Your organization needs to install the [Codecov GitHub app](https://github.com/apps/codecov/installations/select_target) to enable full functionality.  <details><su

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

### Incident Patch 1: `ddbaea08` (2026-09-29)
**Commit Message**: fix(mcp-session): write back assembled SSE fragments when path rewrite is disabled (#4878)

Signed-off-by: johnlanni <ztywto@qq.com>

**File**: `plugins/golang-filter/mcp-session/filter.go` (modified, +15/-2)
```diff
@@ -305,9 +305,12 @@ func (f *filter) encodeDataFromSSEUpstream(buffer api.BufferInstance, endStream
 	bufferData := string(bufferBytes)
 	api.LogDebugf("Received SSE data: %q, length: %d, endStream: %v", bufferData, len(bufferData), endStream)
 
-	// Combine cached data with new data
+	// Combine cached data with new data. Cached chunks were already drained from
+	// the wire, so every path that consumes the cache must put the assembled data
+	// back into the buffer, otherwise the client only sees the last chunk. See #4651.
 	var combinedData string
-	if len(f.cachedResponseBody) > 0 {
+	hasCachedData := len(f.cachedResponseBody) > 0
+	if hasCachedData {
 		combinedData = string(f.cachedResponseBody) + bufferData
 		api.LogDebugf("Combined with cached data: %q, total length: %d", combinedData, len(combinedData))
 	} else {
@@ -318,6 +321,10 @@ func (f *filter) encodeDataFromSSEUpstream(buffer api.BufferInstance, endStream
 	if err != nil {
 		api.LogWarnf("Failed to find endpoint URL in SSE data: %v", err)
 		f.needProcess = false
+		f.cachedResponseBody = nil
+		if hasCachedData {
+			_ = buffer.SetString(combinedData)
+		}
 		return api.Continue
 	}
 	if endpointUrl == "" {
@@ -341,12 +348,18 @@ func (f *filter) encodeDataFromSSEUpstream(buffer api.BufferInstance, endStream
 		endpointUrlIndex := strings.Index(combinedData, endpointUrl)
 		if endpointUrlIndex == -1 {
 			api.LogWarnf("Something wrong, the previously found endpoint URL %s not found in the SSE data now", endpointUrl)
+			if hasCachedData {
+				_ = buffer.SetString(combinedData)
+			}
 		} else {
 			newBufferData := combinedData[:endpointUrlIndex] + newEndpointUrl + combinedData[endpointUrlIndex+len(endpointUrl):]
 			_ = buffer.SetString(newBufferData)
 		}
 	} else {
 		api.LogDebugf("The endpoint URL %s is not changed", endpointUrl)
+		if hasCachedData {
+			_ = buffer.SetString(combinedData)
+		}
 	}
 
 	f.needProcess = false
```

**File**: `plugins/golang-filter/mcp-session/filter_test.go` (modified, +180/-0)
```diff
@@ -542,3 +542,183 @@ func TestRestUpstreamBuffersBodyWhenRateLimitEnabled(t *testing.T) {
 		t.Errorf("expected skipRequestBody to be false when buffering is required")
 	}
 }
+
+// minimal BufferInstance mock that records what would be sent to the client
+type testBuffer struct {
+	api.BufferInstance
+	data []byte
+}
+
+func (b *testBuffer) Bytes() []byte  { return b.data }
+func (b *testBuffer) String() string { return string(b.data) }
+func (b *testBuffer) Len() int       { return len(b.data) }
+func (b *testBuffer) Reset()         { b.data = nil }
+func (b *testBuffer) Set(data []byte) error {
+	b.data = append([]byte(nil), data...)
+	return nil
+}
+func (b *testBuffer) SetString(s string) error {
+	b.data = []byte(s)
+	return nil
+}
+
+// feedSSEChunks pushes the given upstream chunks through EncodeData in order and
+// returns the concatenation of what the client received.
+func feedSSEChunks(t *testing.T, f *filter, chunks ...string) string {
+	t.Helper()
+	received := ""
+	for i, chunk := range chunks {
+		buffer := &testBuffer{data: []byte(chunk)}
+		endStream := i == len(chunks)-1
+		if status := f.EncodeData(buffer, endStream); status != api.Continue {
+			t.Fatalf("chunk %d: expected api.Continue, got %v", i, status)
+		}
+		received += buffer.String()
+	}
+	return received
+}
+
+func createSSETestFilter(matchedRule common.MatchRule) *filter {
+	return &filter{needProcess: true, matchedRule: matchedRule}
+}
+
+func createPathRewriteDisabledRule() common.MatchRule {
+	rule := createTestMatchRule()
+	rule.EnablePathRewrite = false
+	rule.PathRewritePrefix = ""
+	return rule
+}
+
+// TestEncodeDataFromSSEUpstream_FragmentedEndpointWithoutPathRewrite verifies
+// that an endpoint message split across two upstream chunks reaches the client
+// in full when path rewriting is disabled. Previously the assembled message was
+// only written back inside the rewrite branch, so the client saw the truncated
+// tail of the message and never learned the endpoint to POST to. See #4651.
+func TestEncodeDataFromSSEUpstream_FragmentedEndpointWithoutPathRewrite(t *testing.T) {
+	mockAPI := &mockCommonCAPI{}
+	api.SetCommonCAPI(mockAPI)
+
+	f := createSSETestFilter(createPathRewriteDisabledRule())
+	chunks := []string{
+		"event: endpoint\ndata: https://api.example.com/mes",
+		"sions?sessionId=demo\n\n",
+	}
+	want := chunks[0] + chunks[1]
+
+	got := feedSSEChunks(t, f, chunks...)
+	if got != want {
+		t.Errorf("expected client to receive the complete message %q, got %q", want, got)
+	}
+	if f.cachedResponseBody != nil {
+		t.Errorf("expected cachedResponseBody to be cleared, got %q", string(f.cachedResponseBody))
+	}
+	if f.needProcess {
+		t.Errorf("expected needProcess to be false after the endpoint event was handled")
+	}
+}
+
+// TestEncodeDataFromSSEUpstream_FragmentedEndpointWithPathRewrite guards the
+// existing behavior of the enabled-and-matching rewrite path.
+func TestEncodeDataFromSSEUpstream_FragmentedEndpointWithPathRewrite(t *testing.T) {
+	mockAPI := &mockCommonCAPI{}
+	api.SetCommonCAPI(mockAPI)
+
+	f := createSSETestFilter(createTestMatchRule())
+	chunks := []string{
+		"event: endpoint\ndata: https://api.example.com/api/v1/mes",
+		"sages?sessionId=demo\n\n",
+	}
+	want := "event: endpoint\ndata: /mcp/messages?sessionId=demo\n\n"
+
+	got := feedSSEChunks(t, f, chunks...)
+	if got != want {
+		t.Errorf("expected rewritten message %q, got %q", want, got)
+	}
+	if f.cachedResponseBody != nil {
+		t.Errorf("expected cachedResponseBody to be cleared, got %q", string(f.cachedResponseBody))
+	}
+}
+
+// TestEncodeDataFromSSEUpstream_FragmentedEndpointWithRewritePrefixMismatch
+// verifies that an endpoint URL outside the rewrite prefix is still forwarded
+// verbatim instead of being dropped.
+func TestEncodeDataFromSSEUpstream_FragmentedEndpointWithRewritePrefixMismatch(t *testing.T) {
+	mockAPI := &mockCommonCAPI{}
+	api.SetCommonCAPI(mockAPI)
+
+	f := createSSETestFilter(createTestMatchRule())
+	chunks := []string{

```

---

### Incident Patch 2: `943b31bc` (2026-09-29)
**Commit Message**: fix main.go bug( no command-ok) (#4644)

Signed-off-by: enkilee <jeffrey0122@163.com>

**File**: `plugins/wasm-go/extensions/ai-history/main.go` (modified, +41/-9)
```diff
@@ -347,7 +347,11 @@ func processSSEMessage(ctx wrapper.HttpContext, config PluginConfig, sseMessage
 				ctx.SetContext(AnswerContentContextKey, content)
 			} else {
 				append := TrimQuote(gjson.Get(bodyJson, config.AnswerStreamValueFrom.ResponseBody).Raw)
-				content = tempContentI.(string) + append
+				prevContent, ok := tempContentI.(string)
+				if !ok {
+					log.Errorf("answer content in context has unexpected type %T, reset answer content", tempContentI)
+				}
+				content = prevContent + append
 				ctx.SetContext(AnswerContentContextKey, content)
 			}
 		} else if gjson.Get(bodyJson, "choices.0.delta.content.tool_calls").Exists() {
@@ -386,14 +390,23 @@ func onHttpStreamResponseBody(ctx wrapper.HttpContext, config PluginConfig, chun
 				ctx.SetContext(AnswerContentContextKey, chunk)
 				return chunk
 			}
-			tempContent := tempContentI.([]byte)
-			tempContent = append(tempContent, chunk...)
-			ctx.SetContext(AnswerContentContextKey, tempContent)
+			if tempContent, ok := tempContentI.([]byte); ok {
+				tempContent = append(tempContent, chunk...)
+				ctx.SetContext(AnswerContentContextKey, tempContent)
+			} else {
+				log.Errorf("answer content in context has unexpected type %T, reset answer content", tempContentI)
+				ctx.SetContext(AnswerContentContextKey, chunk)
+			}
 		} else {
 			var partialMessage []byte
 			partialMessageI := ctx.GetContext(PartialMessageContextKey)
 			if partialMessageI != nil {
-				partialMessage = append(partialMessageI.([]byte), chunk...)
+				if pm, ok := partialMessageI.([]byte); ok {
+					partialMessage = append(pm, chunk...)
+				} else {
+					log.Errorf("partial message in context has unexpected type %T, reset partial message", partialMessageI)
+					partialMessage = chunk
+				}
 			} else {
 				partialMessage = chunk
 			}
@@ -419,7 +432,12 @@ func onHttpStreamResponseBody(ctx wrapper.HttpContext, config PluginConfig, chun
 		var body []byte
 		tempContentI := ctx.GetContext(AnswerContentContextKey)
 		if tempContentI != nil {
-			body = append(tempContentI.([]byte), chunk...)
+			tempContent, ok := tempContentI.([]byte)
+			if !ok {
+				log.Errorf("answer content in context has unexpected type %T, skip parsing answer value", tempContentI)
+				return chunk
+			}
+			body = append(tempContent, chunk...)
 		} else {
 			body = chunk
 		}
@@ -435,7 +453,12 @@ func onHttpStreamResponseBody(ctx wrapper.HttpContext, config PluginConfig, chun
 			var lastMessage []byte
 			partialMessageI := ctx.GetContext(PartialMessageContextKey)
 			if partialMessageI != nil {
-				lastMessage = append(partialMessageI.([]byte), chunk...)
+				pm, ok := partialMessageI.([]byte)
+				if !ok {
+					log.Errorf("partial message in context has unexpected type %T, skip parsing last message", partialMessageI)
+					return chunk
+				}
+				lastMessage = append(pm, chunk...)
 			} else {
 				lastMessage = chunk
 			}
@@ -451,15 +474,24 @@ func onHttpStreamResponseBody(ctx wrapper.HttpContext, config PluginConfig, chun
 			if tempContentI == nil {
 				return chunk
 			}
-			value = tempContentI.(string)
+			if v, ok := tempContentI.(string); ok {
+				value = v
+			} else {
+				log.Errorf("answer content in context has unexpected type %T, skip saving chat history", tempContentI)
+				return chunk
+			}
 		}
 	}
 	saveChatHistory(ctx, config, questionI, value, log)
 	return chunk
 }
 
 func saveChatHistory(ctx wrapper.HttpContext, config PluginConfig, questionI any, value string, log log.Log) {
-	question := questionI.(string)
+	question, ok := questionI.(string)
+	if !ok {
+		log.Errorf("question in context has unexpected type %T, skip saving chat history", questionI)
+		return
+	}
 	identityKey := ctx.GetStringContext(IdentityKey, "")
 	var chat []ChatHistory
 	chatHistories := ctx.GetStringContext(ChatHistories, "")
```

**File**: `plugins/wasm-go/extensions/ai-history/main_test.go` (modified, +107/-0)
```diff
@@ -15,10 +15,12 @@ package main
 
 import (
 	"encoding/json"
+	"fmt"
 	"reflect"
 	"testing"
 
 	"github.com/higress-group/proxy-wasm-go-sdk/proxywasm/types"
+	"github.com/higress-group/wasm-go/pkg/iface"
 	"github.com/higress-group/wasm-go/pkg/test"
 	"github.com/stretchr/testify/require"
 )
@@ -124,6 +126,111 @@ var authRedisConfig = func() json.RawMessage {
 	return data
 }()
 
+// fakeLog 记录 Errorf 调用，用于断言错误被记录（而非静默吞掉）。
+type fakeLog struct {
+	errors []string
+}
+
+func (l *fakeLog) Trace(msg string)                     {}
+func (l *fakeLog) Tracef(format string, args ...any)    {}
+func (l *fakeLog) Debug(msg string)                     {}
+func (l *fakeLog) Debugf(format string, args ...any)    {}
+func (l *fakeLog) Info(msg string)                      {}
+func (l *fakeLog) Infof(format string, args ...any)     {}
+func (l *fakeLog) Warn(msg string)                      {}
+func (l *fakeLog) Warnf(format string, args ...any)     {}
+func (l *fakeLog) Error(msg string)                     { l.errors = append(l.errors, msg) }
+func (l *fakeLog) Critical(msg string)                  {}
+func (l *fakeLog) Criticalf(format string, args ...any) {}
+func (l *fakeLog) Errorf(format string, args ...any) {
+	l.errors = append(l.errors, fmt.Sprintf(format, args...))
+}
+func (l *fakeLog) ResetID(pluginID string) {}
+
+// fakeHttpContext 只实现 saveChatHistory / processSSEMessage 需要的 context 方法，
+// 用于直接验证类型异常分支。
+type fakeHttpContext struct {
+	values map[string]interface{}
+}
+
+func newFakeHttpContext() *fakeHttpContext {
+	return &fakeHttpContext{values: map[string]interface{}{}}
+}
+
+func (c *fakeHttpContext) SetContext(key string, value interface{})          { c.values[key] = value }
+func (c *fakeHttpContext) GetContext(key string) interface{}                 { return c.values[key] }
+func (c *fakeHttpContext) GetStringContext(key, defaultValue string) string  { return defaultValue }
+func (c *fakeHttpContext) GetBoolContext(key string, defaultValue bool) bool { return defaultValue }
+func (c *fakeHttpContext) GetByteSliceContext(key string, d []byte) []byte   { return d }
+func (c *fakeHttpContext) GetUserAttribute(key string) interface{}           { return nil }
+func (c *fakeHttpContext) SetUserAttribute(key string, value interface{})    {}
+func (c *fakeHttpContext) SetUserAttributeMap(kvmap map[string]interface{})  {}
+func (c *fakeHttpContext) GetUserAttributeMap() map[string]interface{}       { return nil }
+func (c *fakeHttpContext) WriteUserAttributeToLog() error                    { return nil }
+func (c *fakeHttpContext) WriteUserAttributeToLogWithKey(key string) error   { return nil }
+func (c *fakeHttpContext) WriteUserAttributeToTrace() error                  { return nil }
+func (c *fakeHttpContext) DontReadRequestBody()                              {}
+func (c *fakeHttpContext) DontReadResponseBody()                             {}
+func (c *fakeHttpContext) BufferRequestBody()                                {}
+func (c *fakeHttpContext) BufferResponseBody()                               {}
+func (c *fakeHttpContext) NeedPauseStreamingResponse()                       {}
+func (c *fakeHttpContext) PushBuffer(buffer []byte)                          {}
+func (c *fakeHttpContext) PopBuffer() []byte                                 { return nil }
+func (c *fakeHttpContext) BufferQueueSize() int                              { return 0 }
+func (c *fakeHttpContext) DisableReroute()                                   {}
+func (c *fakeHttpContext) SetRequestBodyBufferLimit(byteSize uint32)         {}
+func (c *fakeHttpContext) SetResponseBodyBufferLimit(byteSize uint32)        {}
+func (c *fakeHttpContext) RouteCall(method, url string, headers [][2]string, body []byte, callback iface.RouteResponseCallback) error {
+	return nil
+}
+func (c *fakeHttpContext) GetExecutionPhase() iface.HTTPExecutionPhase { return iface.DecodeHeader }
+func (c *fakeHttpContext) HasRequestBody() bool                        { return false }
+fu
```

---

### Incident Patch 3: `ef1a57b1` (2026-09-29)
**Commit Message**: fix(ai-statistics): make request body buffer limit configurable (#4282)

Signed-off-by: Srikanth Patchava <spatchava@meta.com>
Co-authored-by: EndlessSeeker <153817598+EndlessSeeker@users.noreply.github.com>

**File**: `plugins/wasm-go/extensions/ai-statistics/README.md` (modified, +1/-0)
```diff
@@ -29,6 +29,7 @@ description: AI可观测配置参考
 | `attributes` | []Attribute | 非必填  | -   | 用户希望记录在log/span中的信息 |
 | `disable_openai_usage` | bool | 非必填  | false   | 非openai兼容协议时，model、token的支持非标，配置为true时可以避免报错 |
 | `value_length_limit` | int | 非必填  | 4000   | 记录的单个value的长度限制 |
+| `max_request_body_bytes` | int | 非必填  | 104857600 (100 MiB)   | 请求体缓冲的最大字节数。支持通过 matchRules 进行路由级覆盖，避免大体积非 AI 上传（如 multipart/form-data）被 Envoy 以 413 拒绝。取值范围为 1 到 209715200（200 MiB，即插件 VM 的内存重建上限），超出范围或非数字时插件配置加载失败 |
 | `enable_path_suffixes` | []string    | 非必填   | []     | 只对这些特定路径后缀的请求生效，可以配置为 "\*" 以匹配所有路径（通配符检查会优先进行以提高性能）。如果为空数组，则对所有路径生效 |
 | `enable_content_types` | []string    | 非必填   | []     | 只对这些内容类型的响应进行缓冲处理。如果为空数组，则对所有内容类型生效                                                           |
 | `session_id_header` | string | 非必填  | -   | 指定读取 session ID 的 header 名称。如果不配置，将按以下优先级自动查找：`x-openclaw-session-key`、`x-clawdbot-session-key`、`x-moltbot-session-key`、`x-agent-session`。session ID 可用于追踪多轮 Agent 对话 |
```

**File**: `plugins/wasm-go/extensions/ai-statistics/README_EN.md` (modified, +1/-0)
```diff
@@ -27,6 +27,7 @@ Users can also expand observable values ​​through configuration:
 | `attributes` | []Attribute | optional  | -   | Information that the user wants to record in log/span |
 | `disable_openai_usage` | bool | optional  | false   | When using a non-OpenAI-compatible protocol, the support for model and token is non-standard. Setting the configuration to true can prevent errors. |
 | `value_length_limit` | int | optional  | 4000   | length limit for each value |
+| `max_request_body_bytes` | int | optional  | 104857600 (100 MiB)   | Maximum number of bytes to buffer for the request body. Supports route-level overrides via matchRules, preventing large non-AI uploads (e.g. multipart/form-data) from being rejected by Envoy with HTTP 413. Must be between 1 and 209715200 (200 MiB, the plugin VM memory rebuild ceiling); a value outside that range or a non-number fails config loading |
 | `enable_path_suffixes`   | []string    | optional | ["/v1/chat/completions","/v1/completions","/v1/embeddings","/v1/models","/generateContent","/streamGenerateContent"] | Only effective for requests with these specific path suffixes, can be configured as "\*" to match all paths                                         |
 | `enable_content_types` | []string    | optional | ["text/event-stream","application/json"]                                                                             | Only buffer response body for these content types                                                                                                   |
 | `session_id_header` | string | optional  | -   | Specify the header name to read session ID from. If not configured, it will automatically search in the following priority: `x-openclaw-session-key`, `x-clawdbot-session-key`, `x-moltbot-session-key`, `x-agent-session`. Session ID can be used to trace multi-turn Agent conversations |
```

**File**: `plugins/wasm-go/extensions/ai-statistics/main.go` (modified, +34/-3)
```diff
@@ -40,11 +40,18 @@ func init() {
 		wrapper.ProcessResponseHeaders(onHttpResponseHeaders),
 		wrapper.ProcessStreamingResponseBody(onHttpStreamingBody),
 		wrapper.ProcessResponseBody(onHttpResponseBody),
-		wrapper.WithRebuildMaxMemBytes[AIStatisticsConfig](200*1024*1024),
+		wrapper.WithRebuildMaxMemBytes[AIStatisticsConfig](vmRebuildMaxMemBytes),
 	)
 }
 
 const (
+	// vmRebuildMaxMemBytes is the wasm VM memory ceiling that triggers a VM
+	// rebuild. The buffered request body is copied into the VM, so a buffer
+	// limit above this value cannot be served without forcing a rebuild.
+	vmRebuildMaxMemBytes = 200 * 1024 * 1024
+	// maxRequestBodyBytesCeiling is the largest accepted max_request_body_bytes.
+	maxRequestBodyBytesCeiling = vmRebuildMaxMemBytes
+
 	defaultMaxBodyBytes uint32 = 100 * 1024 * 1024
 	// Context consts
 	StatisticsRequestStartTime = "ai-statistics-request-start-time"
@@ -465,6 +472,10 @@ type AIStatisticsConfig struct {
 	enableContentTypes []string
 	// Session ID header name (if configured, takes priority over default headers)
 	sessionIdHeader string
+	// Maximum request body buffer size in bytes. Configurable via
+	// `max_request_body_bytes`; supports matchRules route-level overrides.
+	// Defaults to defaultMaxBodyBytes when unset.
+	maxRequestBodyBytes uint32
 }
 
 func generateMetricName(route, cluster, model, consumer, metricName string) string {
@@ -563,6 +574,24 @@ func parseConfig(configJson gjson.Result, config *AIStatisticsConfig) error {
 		config.valueLengthLimit = 32000
 	}
 
+	// Set max_request_body_bytes (request body buffer limit). Supports
+	// matchRules route-level overrides. Defaults to defaultMaxBodyBytes.
+	// The value is validated as a number in (0, maxRequestBodyBytesCeiling]
+	// before narrowing to uint32, so out-of-range input is rejected instead
+	// of silently wrapping.
+	config.maxRequestBodyBytes = defaultMaxBodyBytes
+	if limitJson := configJson.Get("max_request_body_bytes"); limitJson.Exists() {
+		if limitJson.Type != gjson.Number {
+			return fmt.Errorf("max_request_body_bytes must be a number, got %s", limitJson.Raw)
+		}
+		limit := limitJson.Int()
+		if limit <= 0 || limit > maxRequestBodyBytesCeiling {
+			return fmt.Errorf("max_request_body_bytes must be in the range (0, %d], got %s", maxRequestBodyBytesCeiling, limitJson.Raw)
+		}
+		config.maxRequestBodyBytes = uint32(limit)
+	}
+	log.Infof("request body buffer limit: %d bytes", config.maxRequestBodyBytes)
+
 	// Parse attributes or use defaults
 	if useDefaultAttributes {
 		config.attributes = getDefaultAttributes()
@@ -699,8 +728,10 @@ func onHttpRequestHeaders(ctx wrapper.HttpContext, config AIStatisticsConfig) ty
 	}
 
 	// Always buffer request body to extract model field
-	// This is essential for metrics and logging
-	ctx.SetRequestBodyBufferLimit(defaultMaxBodyBytes)
+	// This is essential for metrics and logging.
+	// The limit is configurable via `max_request_body_bytes` (with matchRules
+	// route-level overrides) so large non-AI uploads are not rejected with 413.
+	ctx.SetRequestBodyBufferLimit(config.maxRequestBodyBytes)
 
 	// Extract session ID from headers
 	sessionId := extractSessionId(config.sessionIdHeader)
```

**File**: `plugins/wasm-go/extensions/ai-statistics/main_extra_test.go` (modified, +80/-0)
```diff
@@ -128,3 +128,83 @@ func TestConvertToUInt_NilAndSlice_FallToDefault(t *testing.T) {
 	require.False(t, ok)
 	require.Equal(t, uint64(0), v)
 }
+
+// === Module C — max_request_body_bytes configurable buffer limit =========
+//
+// The request-body buffer limit was previously a hard-coded 100 MiB
+// (defaultMaxBodyBytes), which rejected large non-AI uploads with HTTP 413.
+// These tests pin the configurable-limit contract: an unset value falls
+// back to the default, an in-range value (up to and including the VM
+// rebuild ceiling) is honored, and any value that is not a number in
+// (0, maxRequestBodyBytesCeiling] fails plugin start instead of silently
+// wrapping when narrowed to uint32.
+func TestParseConfig_MaxRequestBodyBytes_DefaultWhenUnset(t *testing.T) {
+	test.RunGoTest(t, func(t *testing.T) {
+		host, status := test.NewTestHost([]byte(`{
+			"enable_path_suffixes": ["*"]
+		}`))
+		defer host.Reset()
+		require.Equal(t, types.OnPluginStartStatusOK, status)
+
+		conf, err := host.GetMatchConfig()
+		require.NoError(t, err)
+		c := conf.(*AIStatisticsConfig)
+		require.Equal(t, defaultMaxBodyBytes, c.maxRequestBodyBytes)
+	})
+}
+
+func TestParseConfig_MaxRequestBodyBytes_HonorsExplicitValue(t *testing.T) {
+	test.RunGoTest(t, func(t *testing.T) {
+		host, status := test.NewTestHost([]byte(`{
+			"max_request_body_bytes": 157286400
+		}`))
+		defer host.Reset()
+		require.Equal(t, types.OnPluginStartStatusOK, status)
+
+		conf, err := host.GetMatchConfig()
+		require.NoError(t, err)
+		c := conf.(*AIStatisticsConfig)
+		require.Equal(t, uint32(157286400), c.maxRequestBodyBytes)
+	})
+}
+
+func TestParseConfig_MaxRequestBodyBytes_HonorsCeiling(t *testing.T) {
+	test.RunGoTest(t, func(t *testing.T) {
+		host, status := test.NewTestHost([]byte(`{
+			"max_request_body_bytes": 209715200
+		}`))
+		defer host.Reset()
+		require.Equal(t, types.OnPluginStartStatusOK, status)
+
+		conf, err := host.GetMatchConfig()
+		require.NoError(t, err)
+		c := conf.(*AIStatisticsConfig)
+		require.Equal(t, uint32(maxRequestBodyBytesCeiling), c.maxRequestBodyBytes)
+	})
+}
+
+// Each of these values previously produced a wrong limit without any error:
+// -1 wrapped to 4 GiB, 4294967296 wrapped to 0 (then silently fell back to
+// 100 MiB), and 5000000000 wrapped to ~672 MiB. They must now fail start.
+func TestParseConfig_MaxRequestBodyBytes_InvalidValuesFailStart(t *testing.T) {
+	cases := map[string]string{
+		"zero":               `0`,
+		"negative":           `-1`,
+		"one above ceiling":  `209715201`,
+		"exactly 4 GiB":      `4294967296`,
+		"above uint32 range": `5000000000`,
+		"string":             `"104857600"`,
+		"boolean":            `true`,
+	}
+	for name, value := range cases {
+		t.Run(name, func(t *testing.T) {
+			test.RunGoTest(t, func(t *testing.T) {
+				host, status := test.NewTestHost([]byte(`{
+					"max_request_body_bytes": ` + value + `
+				}`))
+				defer host.Reset()
+				require.Equal(t, types.OnPluginStartStatusFailed, status)
+			})
+		})
+	}
+}
```

---

### Incident Patch 4: `99aaa5d2` (2026-09-29)
**Commit Message**: fix(ai-proxy): detect hunyuan embeddings API paths (#4220)

Signed-off-by: Yue Wang <1939455790@qq.com>

**File**: `plugins/wasm-go/extensions/ai-proxy/provider/hunyuan.go` (modified, +3/-0)
```diff
@@ -564,5 +564,8 @@ func GetTC3Authorizationcode(secretId string, secretKey string, timestamp int64,
 }
 
 func (m *hunyuanProvider) GetApiName(path string) ApiName {
+	if strings.Contains(path, PathOpenAIEmbeddings) {
+		return ApiNameEmbeddings
+	}
 	return ApiNameChatCompletion
 }
```

**File**: `plugins/wasm-go/extensions/ai-proxy/provider/hunyuan_test.go` (added, +44/-0)
```diff
@@ -0,0 +1,44 @@
+package provider
+
+import (
+	"testing"
+
+	"github.com/stretchr/testify/assert"
+)
+
+func TestHunyuanProviderGetApiName(t *testing.T) {
+	provider := &hunyuanProvider{}
+
+	tests := []struct {
+		name string
+		path string
+		want ApiName
+	}{
+		{
+			name: "chat completions",
+			path: PathOpenAIChatCompletions,
+			want: ApiNameChatCompletion,
+		},
+		{
+			name: "embeddings",
+			path: PathOpenAIEmbeddings,
+			want: ApiNameEmbeddings,
+		},
+		{
+			name: "embeddings with route prefix",
+			path: "/gateway" + PathOpenAIEmbeddings,
+			want: ApiNameEmbeddings,
+		},
+		{
+			name: "unknown path defaults to chat completion",
+			path: "/v1/unknown",
+			want: ApiNameChatCompletion,
+		},
+	}
+
+	for _, tt := range tests {
+		t.Run(tt.name, func(t *testing.T) {
+			assert.Equal(t, tt.want, provider.GetApiName(tt.path))
+		})
+	}
+}
```

---

### Incident Patch 5: `37b20cb1` (2026-09-29)
**Commit Message**: fix: require authentication for RAG MCP server write path (#4853)

Signed-off-by: johnlanni <ztywto@qq.com>

**File**: `plugins/golang-filter/mcp-server/auth_test.go` (added, +284/-0)
```diff
@@ -0,0 +1,284 @@
+package mcp_server
+
+import (
+	"context"
+	"encoding/base64"
+	"encoding/json"
+	"net/http"
+	"testing"
+
+	"github.com/alibaba/higress/plugins/golang-filter/mcp-session/common"
+	"github.com/envoyproxy/envoy/contrib/golang/common/go/api"
+	"github.com/mark3labs/mcp-go/mcp"
+	"github.com/stretchr/testify/require"
+)
+
+// writeToolCall is a tools/call body for the stub server's write tool. It stands
+// in for the RAG server's create-chunks-from-text call, which is the
+// unauthenticated write path this gate protects.
+const writeToolCall = `{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"insert-doc","arguments":{}}}`
+
+// stubWriteServer is a minimal server that owns a write tool and exposes HTTP
+// Basic credentials through common.BasicAuthProvider, the same contract the rag
+// and higress-ops servers implement.
+type stubWriteServer struct {
+	username   string
+	password   string
+	writeCalls *int
+}
+
+func (s *stubWriteServer) Clone() common.Server {
+	clone := *s
+	return &clone
+}
+
+func (s *stubWriteServer) GetBasicAuthCredentials() (string, string) {
+	return s.username, s.password
+}
+
+func (s *stubWriteServer) ParseConfig(cfg map[string]any) error {
+	if username, ok := cfg["username"].(string); ok {
+		s.username = username
+	}
+	if password, ok := cfg["password"].(string); ok {
+		s.password = password
+	}
+	return nil
+}
+
+func (s *stubWriteServer) NewServer(serverName string) (*common.MCPServer, error) {
+	mcpServer := common.NewMCPServer(serverName, "1.0.0")
+	mcpServer.AddTool(
+		mcp.NewToolWithRawSchema("insert-doc", "write to the backing store", json.RawMessage(`{"type":"object","properties":{}}`)),
+		func(ctx context.Context, request mcp.CallToolRequest) (*mcp.CallToolResult, error) {
+			*s.writeCalls++
+			return &mcp.CallToolResult{
+				Content: []mcp.Content{mcp.TextContent{Type: "text", Text: "inserted"}},
+			}, nil
+		},
+	)
+	return mcpServer, nil
+}
+
+func basicAuthHeader(user, pass string) string {
+	return "Basic " + base64.StdEncoding.EncodeToString([]byte(user+":"+pass))
+}
+
+// registerStubWriteServer registers the stub under a unique type name and
+// returns the shared write-call counter.
+func registerStubWriteServer(t *testing.T, serverType, username, password string) *int {
+	t.Helper()
+
+	writeCalls := new(int)
+	common.GlobalRegistry.RegisterServer(serverType, &stubWriteServer{
+		username:   username,
+		password:   password,
+		writeCalls: writeCalls,
+	})
+	t.Cleanup(func() { common.GlobalRegistry.UnregisterServer(serverType) })
+	return writeCalls
+}
+
+func parseStubServerConfig(t *testing.T, serverType, serverPath, username, password string) *config {
+	t.Helper()
+
+	serverConfig := map[string]any{
+		"name": serverType + "-server",
+		"type": serverType,
+		"path": serverPath,
+	}
+	if username != "" || password != "" {
+		serverConfig["config"] = map[string]any{"username": username, "password": password}
+	}
+
+	parsed, err := (&Parser{}).Parse(typedStructAny(t, map[string]any{
+		"servers": []any{serverConfig},
+	}), nil)
+	require.NoError(t, err)
+
+	conf := parsed.(*config)
+	t.Cleanup(conf.Destroy)
+	require.Len(t, conf.servers, 1, "server should have loaded")
+	return conf
+}
+
+func newTestFilter(conf *config) (*filter, *testDecoderCallbacks) {
+	decoder := &testDecoderCallbacks{}
+	return &filter{
+		callbacks: &testCallbacks{decoder: decoder},
+		config:    conf,
+	}, decoder
+}
+
+func postMessageHeaders(path, authorization string) testRequestHeaderMap {
+	values := map[string][]string{
+		":method":    {http.MethodPost},
+		":scheme":    {"http"},
+		":authority": {"example.com"},
+		":path":      {path},
+	}
+	if authorization != "" {
+		values["authorization"] = []string{authorization}
+	}
+	return testRequestHeaderMap{values: values}
+}
+
+// TestParserWiresBasicAuthCredentialsIntoServerWrapper covers the composition
+// point at config.go: a server that implements common.BasicAuthProvider must
+// have its credent
```

**File**: `plugins/golang-filter/mcp-server/servers/rag/README.md` (modified, +35/-0)
```diff
@@ -70,6 +70,8 @@ Higress RAG MCP Server 提供以下工具，根据配置不同，可用工具也
 
 | 名称                         | 数据类型 | 填写要求 | 默认值 | 描述 |
 |----------------------------|----------|-----------|---------|--------|
+| **username**               | string | 必填 | - | 访问本 MCP Server 所需的 HTTP Basic 认证用户名（未配置则 Server 不会加载） |
+| **password**               | string | 必填 | - | 访问本 MCP Server 所需的 HTTP Basic 认证密码（未配置则 Server 不会加载） |
 | **rag**                    | object | 必填 | - | RAG系统基础配置 |
 | rag.splitter.provider      | string | 必填 | recursive | 分块器类型：recursive或nosplitter |
 | rag.splitter.chunk_size    | integer | 可选 | 500 | 块大小 |
@@ -110,6 +112,32 @@ Higress RAG MCP Server 提供以下工具，根据配置不同，可用工具也
 | vectordb.mapping.search.params | object | 可选 | - | 搜索参数（如 nprobe, ef_search 等）
 
 
+### 认证要求（必填）
+
+RAG MCP Server 提供 `create-chunks-from-text`、`delete-chunk` 等写入/删除工具，直接操作共享向量数据库。
+若不加认证，任何能访问该 MCP 端点的客户端都可以向知识库注入内容，形成**持久化的提示词注入（stored prompt injection）**风险，
+后续所有检索与 `chat` 回答都会被污染。因此本 Server 强制要求 HTTP Basic 认证：
+
+- `username` 与 `password` 均为**必填**项，由 mcp-server 网关过滤器在请求进入 MCP 处理逻辑之前统一校验；
+- 认证失败（缺失 `Authorization` 头、凭证错误、或使用非 Basic 方案）时直接返回 `401 Unauthorized`，
+  并带上 `WWW-Authenticate: Basic realm="MCP Server"`，请求体不会被解析，任何工具都不会执行；
+- **未配置凭证时采用 fail-closed 策略**：该 Server 不会被注册，对应的 MCP 端点不可用，
+  同时网关日志中会输出 `RAG server rejected config: missing username/password` 错误，便于排查。
+
+客户端调用示例：
+
+```bash
+curl -u admin:your-password \
+  -X POST 'http://<higress-gateway>/mcp-servers/rag' \
+  -H 'Content-Type: application/json' \
+  -d '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"search-chunks","arguments":{"query":"hello"}}}'
+```
+
+MCP 客户端（如 CherryStudio、Claude Desktop）在配置该 Server 时，需填写 Basic Auth 的用户名与密码。
+
+> 注意：`username`/`password` 是访问本 MCP Server 的凭证，与 `vectordb.username`/`vectordb.password`
+> （连接 Milvus 数据库的凭证）是两个不同的配置项，请勿混用。
+
 ### higress-config 配置样例
 
 ```yaml
@@ -140,6 +168,9 @@ data:
         name: "rag"
         type: "rag"
         config:
+          # 必填：访问本 MCP Server 的 HTTP Basic 认证凭证，缺失则该 Server 不会加载
+          username: "admin"
+          password: "your-password"
           rag:
             splitter:
               provider: recursive
@@ -822,6 +853,10 @@ langchain-milvus>=0.2.2
 ### 3. Higress RAG mcp server config 配置
 
 ```yaml
+# 必填：访问本 MCP Server 的 HTTP Basic 认证凭证，缺失则该 Server 不会加载
+username: "admin"
+password: "your-password"
+
 rag:
   splitter:
     provider: "nosplitter"
```

**File**: `plugins/golang-filter/mcp-server/servers/rag/server.go` (modified, +32/-3)
```diff
@@ -15,6 +15,12 @@ const Version = "1.0.0"
 
 type RAGConfig struct {
 	config *config.Config
+	// username/password are the HTTP Basic credentials a caller must present to
+	// reach this server. They live here rather than in config.Config because
+	// that struct is dumped with %+v by several debug logs, which would write
+	// the credential to the gateway log.
+	username string
+	password string
 }
 
 func init() {
@@ -101,22 +107,45 @@ func init() {
 
 func (c *RAGConfig) Clone() common.Server {
 	if c.config == nil {
-		return &RAGConfig{}
+		return &RAGConfig{username: c.username, password: c.password}
 	}
 	configBytes, err := json.Marshal(c.config)
 	if err != nil {
 		clonedConfig := *c.config
-		return &RAGConfig{config: &clonedConfig}
+		return &RAGConfig{config: &clonedConfig, username: c.username, password: c.password}
 	}
 	var clonedConfig config.Config
 	if err := json.Unmarshal(configBytes, &clonedConfig); err != nil {
 		clonedConfig = *c.config
 	}
-	return &RAGConfig{config: &clonedConfig}
+	return &RAGConfig{config: &clonedConfig, username: c.username, password: c.password}
+}
+
+// GetBasicAuthCredentials implements common.BasicAuthProvider. The RAG server
+// exposes tools that write to and delete from a shared vector store, so callers
+// must always present HTTP Basic credentials. ParseConfig rejects a config that
+// leaves them empty, which is what keeps this gate from being silently disabled.
+func (c *RAGConfig) GetBasicAuthCredentials() (string, string) {
+	return c.username, c.password
 }
 
 func (c *RAGConfig) ParseConfig(cfg map[string]any) error {
 	api.LogDebugf("RAG start to parse config: %+v", cfg)
+	// Basic auth credentials are mandatory and validated first: the RAG server
+	// writes to a shared vector store, so it must never load unauthenticated.
+	username, _ := cfg["username"].(string)
+	if username == "" {
+		api.LogErrorf("RAG server rejected config: missing username. The RAG MCP server exposes write tools (create-chunks-from-text, delete-chunk) against a shared vector store and requires basic auth credentials (username and password).")
+		return errors.New("missing username: rag requires basic auth credentials (username and password)")
+	}
+	password, _ := cfg["password"].(string)
+	if password == "" {
+		api.LogErrorf("RAG server rejected config: missing password. The RAG MCP server exposes write tools (create-chunks-from-text, delete-chunk) against a shared vector store and requires basic auth credentials (username and password).")
+		return errors.New("missing password: rag requires basic auth credentials (username and password)")
+	}
+	c.username = username
+	c.password = password
+
 	// Parse RAG con
 	api.LogDebugf("RAG parse rag config")
 	if ragConfig, ok := cfg["rag"].(map[string]any); ok {
```

---

### Incident Patch 6: `a3714ff5` (2026-09-29)
**Commit Message**: fix: replace instead of append X-Mse-Consumer consumer identity header (#4855)

Signed-off-by: johnlanni <ztywto@qq.com>

**File**: `plugins/release/catalog.json` (modified, +1/-1)
```diff
@@ -31,7 +31,7 @@
       "frontend-gray": { "repository": "higress-group/higress-console", "sourceCommit": "36aa9c67fb0057164dab9b1fe687b38fe5b8a022", "files": [{ "sourcePath": "backend/sdk/src/main/resources/plugins/frontend-gray/spec.yaml", "targetPath": "spec.yaml", "sha256": "d3ec4bfc85f3ae49d58345ed713cb5f995965d915b492a12195cb507ab1604ca" }, { "sourcePath": "backend/sdk/src/main/resources/plugins/frontend-gray/README.md", "targetPath": "README.md", "sha256": "33e9348e29b37789d36a01aca0925e9e07b2134e948e285dccfd825bd02770a1" }, { "sourcePath": "backend/sdk/src/main/resources/plugins/frontend-gray/README_EN.md", "targetPath": "README_EN.md", "sha256": "dbc19cfb4ad5b52a075d26f6e99d5a3b44db5095589075863d9318df19c4fab4" }] },
       "geo-ip": { "repository": "higress-group/higress-console", "sourceCommit": "36aa9c67fb0057164dab9b1fe687b38fe5b8a022", "files": [{ "sourcePath": "backend/sdk/src/main/resources/plugins/geo-ip/spec.yaml", "targetPath": "spec.yaml", "sha256": "b4b5ec8aa3c48d93d809bf580e02578b5d012883025d7299a846d81169e2a51a" }, { "sourcePath": "backend/sdk/src/main/resources/plugins/geo-ip/README.md", "targetPath": "README.md", "sha256": "67408e4c774ec7c0123b33cb706da8636d7aed89564bcd51e03e7604697ec46c" }, { "sourcePath": "backend/sdk/src/main/resources/plugins/geo-ip/README_EN.md", "targetPath": "README_EN.md", "sha256": "5992b0ac4ffe63d8e7997e8c7af54ea7ef230b014569ea6a2c5301694d887f99" }] },
       "gw-error-format": { "repository": "higress-group/higress", "files": [{ "sourcePath": "plugins/release/console/gw-error-format/spec.yaml", "targetPath": "spec.yaml", "sha256": "26ec5ed1220efb0b5bbcec6342a48fcfc01ad68321b56c1e28a99301fd34a7b1" }, { "sourcePath": "plugins/wasm-go/extensions/gw-error-format/README.md", "targetPath": "README.md", "sha256": "9d083183ae678c2089ad676745893c2c2697d85a3e5253fffd44c5738aa017a8" }, { "sourcePath": "plugins/release/console/gw-error-format/README_EN.md", "targetPath": "README_EN.md", "sha256": "f4a795ef32d155264089d9336c28f1948dcafaed1408cabd7902f5c0d651645c" }] },
-      "hmac-auth-apisix": { "repository": "higress-group/higress", "files": [{ "sourcePath": "plugins/release/console/hmac-auth-apisix/spec.yaml", "targetPath": "spec.yaml", "sha256": "d8ea901848ebe354471297840a4ba8da3f50fff55998e85bd656396b5608815b" }, { "sourcePath": "plugins/wasm-go/extensions/hmac-auth-apisix/README.md", "targetPath": "README.md", "sha256": "4aa1d4f8500759e12322e5c4cfd08eafa1090a2ad32215b6d4f0c0f534d0da13" }, { "sourcePath": "plugins/wasm-go/extensions/hmac-auth-apisix/README_EN.md", "targetPath": "README_EN.md", "sha256": "c435e41bbd430fb47f5f823f7fde20f4ae3ae46336e059dadf9446910c425d65" }] },
+      "hmac-auth-apisix": { "repository": "higress-group/higress", "files": [{ "sourcePath": "plugins/release/console/hmac-auth-apisix/spec.yaml", "targetPath": "spec.yaml", "sha256": "d8ea901848ebe354471297840a4ba8da3f50fff55998e85bd656396b5608815b" }, { "sourcePath": "plugins/wasm-go/extensions/hmac-auth-apisix/README.md", "targetPath": "README.md", "sha256": "388842967031d5167c701ec3dd5aea7ed045ac08346813af0d39aef7e659518e" }, { "sourcePath": "plugins/wasm-go/extensions/hmac-auth-apisix/README_EN.md", "targetPath": "README_EN.md", "sha256": "7447afe454db1452f715b3041d59b2fbfee253d5fb6ba001a99ae309507edc49" }] },
       "ip-restriction": { "repository": "higress-group/higress-console", "sourceCommit": "36aa9c67fb0057164dab9b1fe687b38fe5b8a022", "files": [{ "sourcePath": "backend/sdk/src/main/resources/plugins/ip-restriction/spec.yaml", "targetPath": "spec.yaml", "sha256": "a3dd47a0f22b54bf560470de6e68ec163844b3de8c4cfe5f203864d11eef0f3a" }, { "sourcePath": "backend/sdk/src/main/resources/plugins/ip-restriction/README.md", "targetPath": "README.md", "sha256": "db580cad8eb73240bb0296d6e20eed3613fd20716462096163ff6bd5b3df50e7" }, { "sourcePath": "backend/sdk/src/main/resources/plugins/ip-restriction/README_EN.md", "targetPath": "README_EN.md", "sha256": "b9ac3ac76d68bd82cb660e71f8be104b669af961b7ab95d5945fbe72
```

**File**: `plugins/release/console-recovery/2.2.4.json` (modified, +2/-2)
```diff
@@ -90,12 +90,12 @@
             {
               "sourcePath": "plugins/wasm-go/extensions/hmac-auth-apisix/README.md",
               "targetPath": "README.md",
-              "sha256": "4aa1d4f8500759e12322e5c4cfd08eafa1090a2ad32215b6d4f0c0f534d0da13"
+              "sha256": "388842967031d5167c701ec3dd5aea7ed045ac08346813af0d39aef7e659518e"
             },
             {
               "sourcePath": "plugins/wasm-go/extensions/hmac-auth-apisix/README_EN.md",
               "targetPath": "README_EN.md",
-              "sha256": "c435e41bbd430fb47f5f823f7fde20f4ae3ae46336e059dadf9446910c425d65"
+              "sha256": "7447afe454db1452f715b3041d59b2fbfee253d5fb6ba001a99ae309507edc49"
             }
           ]
         }
```

**File**: `plugins/wasm-cpp/extensions/basic_auth/README.md` (modified, +2/-0)
```diff
@@ -18,6 +18,8 @@ description: Basic 认证插件配置参考
 
 - 在一个规则里，鉴权配置和认证配置不可同时存在
 - 对于通过认证鉴权的请求，请求的header会被添加一个`X-Mse-Consumer`字段，用以标识调用者的名称。
+  该字段由网关**覆盖写入**而非追加：客户端请求中自带的 `X-Mse-Consumer` 会先被移除，再写入本次认证得到的 Consumer 名称。
+  因此下游读取到的始终是网关的认证结果，调用方无法通过自带该请求头伪造身份。
 
 ### 认证配置
 
```

**File**: `plugins/wasm-cpp/extensions/basic_auth/README_EN.md` (modified, +3/-0)
```diff
@@ -14,6 +14,9 @@ Plugin execution priority: `320`
 **Note:**
 - In one rule, authentication configurations and authorization configurations cannot coexist.
 - For requests that pass authentication, the request header will include an `X-Mse-Consumer` field to identify the caller's name.
+  The gateway **replaces** this header instead of appending to it: any client-supplied `X-Mse-Consumer` is removed
+  before the consumer name from this authentication is set. Downstream therefore always reads the gateway's own
+  assertion, so a caller cannot forge its identity by sending the header itself.
 
 ### Authentication Configuration
 | Name          | Data Type        | Requirements                   | Default Value | Description                                                                                                                                                                            |
```

**File**: `plugins/wasm-cpp/extensions/basic_auth/plugin.cc` (modified, +2/-0)
```diff
@@ -225,6 +225,8 @@ bool PluginRootContext::addBasicAuthConfigRule(
 bool PluginRootContext::checkPlugin(
     const BasicAuthConfigRule& rule,
     const std::optional<std::unordered_set<std::string>>& allow_set) {
+  // Drop any client-supplied value so only this gateway's assertion survives.
+  removeRequestHeader("X-Mse-Consumer");
   auto authorization_header = getRequestHeader("authorization");
   auto authorization = authorization_header->view();
   // Check if the Basic auth header starts with "Basic "
```

---

### Incident Patch 7: `6ac9700c` (2026-09-29)
**Commit Message**: fix: namespace-restricted secret template resolution for Ingress annotations (#4834)

Signed-off-by: johnlanni <ztywto@qq.com>

**File**: `pkg/ingress/config/ingress_config.go` (modified, +15/-1)
```diff
@@ -310,7 +310,10 @@ func (m *IngressConfig) List(typ config.GroupVersionKind, namespace string) []co
 	}
 
 	if configsFromGateway := m.listFromGatewayControllers(typ, namespace); configsFromGateway != nil {
-		// Process templates for gateway configs
+		// Process templates for gateway configs. These are merged across namespaces and some of
+		// them are re-stamped with the Higress system namespace, so the namespace of the object
+		// a config was generated from cannot be recovered here. Their references are restricted
+		// during the Gateway API conversion instead, while that namespace is still known.
 		for i := range configsFromGateway {
 			if err := m.templateProcessor.ProcessConfig(&configsFromGateway[i]); err != nil {
 				IngressLog.Errorf("Failed to process template for config %s/%s: %v",
@@ -459,6 +462,17 @@ func (m *IngressConfig) createWrapperConfigs(configs []config.Config) []common.W
 
 	for idx := range configs {
 		rawConfig := configs[idx]
+		// Annotation values are the only tenant-writable strings that reach generated
+		// configs, and those configs are merged across namespaces under the Higress system
+		// namespace, so this is the last point where the owning namespace is still known.
+		// A reference with no namespace is expanded to the Ingress's own namespace and a
+		// reference to any other namespace is replaced with an opaque placeholder.
+		sanitizedAnnotations, refused := m.templateProcessor.RestrictTemplatesToNamespace(rawConfig.Annotations, rawConfig.Namespace)
+		rawConfig.Annotations = sanitizedAnnotations
+		if len(refused) > 0 {
+			IngressLog.Errorf("Ingress %s/%s references secrets outside its own namespace, replacing them with %q: %v",
+				rawConfig.Namespace, rawConfig.Name, util.RefusedReferencePlaceholder, refused)
+		}
 		annotationsConfig := &annotations.Ingress{
 			Meta: annotations.Meta{
 				Namespace:    rawConfig.Namespace,
```

**File**: `pkg/ingress/config/ingress_template.go` (modified, +32/-6)
```diff
@@ -17,9 +17,9 @@ package config
 import (
 	"encoding/json"
 	"fmt"
-	"regexp"
 	"strings"
 
+	"github.com/alibaba/higress/v2/pkg/ingress/kube/util"
 	. "github.com/alibaba/higress/v2/pkg/ingress/log"
 	"google.golang.org/protobuf/proto"
 	"istio.io/istio/pkg/config"
@@ -42,7 +42,16 @@ func NewTemplateProcessor(getValue func(valueType, namespace, name, key string)
 	}
 }
 
-// ProcessConfig processes a config and substitutes any template variables
+// ProcessConfig processes a config and substitutes every template variable in it, allowing
+// references to secrets in any namespace.
+//
+// Only call this for config sources whose references have already been restricted to the
+// namespace of the object that supplied them, or that already require write access to the
+// Higress control plane namespace, such as WasmPlugin CRs and the higress-config ConfigMap:
+// those are operator-owned, and cross-namespace references are their intended use. Anything
+// a tenant can write must be passed through RestrictTemplatesToNamespace or
+// util.DefuseSpecTemplates first, otherwise a tenant could read secrets from arbitrary
+// namespaces.
 func (p *TemplateProcessor) ProcessConfig(cfg *config.Config) error {
 	// Convert spec to JSON string to process substitutions
 	jsonBytes, err := json.Marshal(cfg.Spec)
@@ -51,10 +60,7 @@ func (p *TemplateProcessor) ProcessConfig(cfg *config.Config) error {
 	}
 
 	configStr := string(jsonBytes)
-	// Find all value references in format:
-	// ${type.name.key} or ${type.namespace/name.key}
-	valueRegex := regexp.MustCompile(`\$\{([^.}/]+)\.(?:([^/}]+)/)?([^.}/]+)\.([^}]+)\}`)
-	matches := valueRegex.FindAllStringSubmatch(configStr, -1)
+	matches := util.TemplateRegex.FindAllStringSubmatch(configStr, -1)
 	// If there are no value references, return immediately
 	if len(matches) == 0 {
 		if p.secretConfigMgr != nil {
@@ -117,3 +123,23 @@ func (p *TemplateProcessor) ProcessConfig(cfg *config.Config) error {
 	IngressLog.Infof("end to process config %s/%s", cfg.Namespace, cfg.Name)
 	return nil
 }
+
+// RestrictTemplatesToNamespace defuses every reference in values that resolves to a namespace
+// other than ownerNamespace, and expands every reference that has no namespace at all to
+// ownerNamespace, so that ProcessConfig can only substitute what the owning object is allowed
+// to read. A refused reference is logged and replaced with util.RefusedReferencePlaceholder,
+// an opaque fixed-form string that cannot be reassembled into a reference.
+//
+// It exists because configs generated from Ingresses are merged across namespaces (one
+// VirtualService per host, one EnvoyFilter per plugin) and always carry the Higress system
+// namespace, so the owning namespace cannot be recovered from the generated config. Raw
+// Ingress annotations are the last place where a template and the namespace of the object
+// that supplied it are both known. The Gateway API path faces the same problem and defuses at
+// the equivalent point via util.DefuseSpecTemplates.
+//
+// The returned map is the input map unless something was defused, in which case it is a
+// copy; the input map is never modified because it is shared with the informer cache. The
+// second return value describes the defused references for logging.
+func (p *TemplateProcessor) RestrictTemplatesToNamespace(values map[string]string, ownerNamespace string) (map[string]string, []string) {
+	return util.DefuseTemplates(values, ownerNamespace)
+}
```

**File**: `pkg/ingress/config/ingress_template_test.go` (modified, +205/-0)
```diff
@@ -23,6 +23,8 @@ import (
 	extensions "istio.io/api/extensions/v1alpha1"
 	"istio.io/istio/pkg/config"
 	"istio.io/istio/pkg/config/schema/gvk"
+
+	"github.com/alibaba/higress/v2/pkg/ingress/kube/util"
 )
 
 func TestTemplateProcessor_ProcessConfig(t *testing.T) {
@@ -218,6 +220,209 @@ func TestTemplateProcessor_ProcessConfig(t *testing.T) {
 	}
 }
 
+// newRecordingSecretGetter returns a getValue implementation backed by values, whose keys
+// are of the form type.namespace/name.key, together with the list of references it was
+// asked to resolve. The list lets a test prove that a refused reference never reached the
+// secret store at all.
+func newRecordingSecretGetter(values map[string]string) (func(valueType, namespace, name, key string) (string, error), *[]string) {
+	var calls []string
+	getValue := func(valueType, namespace, name, key string) (string, error) {
+		fullKey := fmt.Sprintf("%s.%s/%s.%s", valueType, namespace, name, key)
+		calls = append(calls, fullKey)
+		if value, exists := values[fullKey]; exists {
+			return value, nil
+		}
+		return "", fmt.Errorf("value not found for %s", fullKey)
+	}
+	return getValue, &calls
+}
+
+// tenantSecrets holds a value for every namespace used below. The foreign ones must never
+// be handed out to a config owned by tenant-a.
+var tenantSecrets = map[string]string{
+	"secret.tenant-a/app.api_key":        "tenant-a-key",
+	"secret.tenant-b/app.api_key":        "tenant-b-key",
+	"secret.higress-system/shared.token": "system-token",
+}
+
+func pluginWithConfig(t *testing.T, namespace string, fields map[string]interface{}) *config.Config {
+	return &config.Config{
+		Meta: config.Meta{
+			GroupVersionKind: gvk.WasmPlugin,
+			Name:             "test-plugin",
+			Namespace:        namespace,
+		},
+		Spec: &extensions.WasmPlugin{
+			PluginName:   "test-plugin",
+			PluginConfig: makeStructValue(t, fields),
+		},
+	}
+}
+
+func assertConfigValue(t *testing.T, cfg *config.Config, key, expected string) {
+	t.Helper()
+	plugin := cfg.Spec.(*extensions.WasmPlugin)
+	assert.Equal(t, expected, plugin.PluginConfig.Fields[key].GetStringValue())
+}
+
+func TestTemplateProcessor_RestrictTemplatesToNamespace(t *testing.T) {
+	processor := NewTemplateProcessor(nil, "higress-system", nil)
+
+	t.Run("annotations without references are returned untouched", func(t *testing.T) {
+		annotations := map[string]string{
+			"higress.io/destination":                     "foo.default.svc.cluster.local",
+			"nginx.ingress.kubernetes.io/rewrite-target": "/",
+		}
+		sanitized, refused := processor.RestrictTemplatesToNamespace(annotations, "tenant-a")
+		assert.Empty(t, refused)
+		assert.Equal(t, annotations, sanitized)
+
+		// Nothing was defused, so no copy is made: every Ingress pays for this call.
+		sanitized["probe"] = "x"
+		assert.Equal(t, "x", annotations["probe"])
+		delete(annotations, "probe")
+	})
+
+	t.Run("same namespace reference is preserved byte identically", func(t *testing.T) {
+		annotations := map[string]string{
+			"higress.io/request-header": "Bearer ${secret.tenant-a/app.api_key}",
+		}
+		sanitized, refused := processor.RestrictTemplatesToNamespace(annotations, "tenant-a")
+		assert.Empty(t, refused)
+		assert.Equal(t, "Bearer ${secret.tenant-a/app.api_key}", sanitized["higress.io/request-header"])
+	})
+
+	t.Run("cross namespace reference is replaced with an opaque placeholder", func(t *testing.T) {
+		annotations := map[string]string{
+			"higress.io/request-header": "Bearer ${secret.tenant-b/app.api_key}",
+			"higress.io/destination":    "foo.default.svc.cluster.local",
+		}
+		sanitized, refused := processor.RestrictTemplatesToNamespace(annotations, "tenant-a")
+		assert.Equal(t, []string{"higress.io/request-header=${secret.tenant-b/app.api_key}"}, refused)
+		assert.Equal(t, "Bearer "+util.RefusedReferencePlaceholder, sanitized["higress.io/request-header"])
+		assert.Equal(t, "foo.default.svc.cluster.local", sanitized["higress.io/destination"])
+		// The caller's map
```

**File**: `pkg/ingress/kube/gateway/istio/backend_policies.go` (modified, +30/-0)
```diff
@@ -44,6 +44,8 @@ import (
 	"istio.io/istio/pkg/ptr"
 	"istio.io/istio/pkg/slices"
 	"istio.io/istio/pkg/util/sets"
+
+	"github.com/alibaba/higress/v2/pkg/ingress/kube/util"
 )
 
 type TypedNamespacedName struct {
@@ -263,6 +265,16 @@ func DestinationRuleCollection(
 				spec.TrafficPolicy.PortLevelSettings = append(spec.TrafficPolicy.PortLevelSettings, portPolicy)
 			}
 
+			// Start - Added by Higress
+			// A rule that cannot be inspected has to be dropped: it is about to be stamped
+			// with target.Namespace while carrying values written by whichever policies won
+			// the merge, so anything left unchecked would be resolved as if target.Namespace
+			// had written it.
+			if err := defuseBackendPolicySecretTemplates(spec, target); err != nil {
+				return nil
+			}
+			// End - Added by Higress
+
 			cfg := &config.Config{
 				Meta: config.Meta{
 					GroupVersionKind: gvk.DestinationRule,
@@ -279,6 +291,24 @@ func DestinationRuleCollection(
 	return merged
 }
 
+// Start - Added by Higress
+
+// defuseBackendPolicySecretTemplates restricts the secret references in a DestinationRule
+// merged from backend policies to the namespace of the policy target. Every policy merged
+// under one target is a local policy attached to it, so they all come from that namespace,
+// and it is the namespace the generated rule is stamped with.
+//
+// The restriction has to happen here because the merge discards the identities of the
+// policies that supplied each setting, keeping them only in an annotation that template
+// resolution never reads.
+func defuseBackendPolicySecretTemplates(spec *networking.DestinationRule, target TypedNamespacedName) error {
+	_, err := util.DefuseSpecTemplates(spec, target.Namespace,
+		fmt.Sprintf("DestinationRule for %s", target))
+	return err
+}
+
+// End - Added by Higress
+
 func BackendTLSPolicyCollection(
 	tlsPolicies krt.Collection[*gw.BackendTLSPolicy],
 	ancestors krt.IndexCollection[TypedNamespacedName, AncestorBackend],
```

**File**: `pkg/ingress/kube/gateway/istio/gateway_collection.go` (modified, +31/-0)
```diff
@@ -34,6 +34,8 @@ import (
 	"istio.io/istio/pkg/ptr"
 	"istio.io/istio/pkg/revisions"
 	"istio.io/istio/pkg/slices"
+
+	"github.com/alibaba/higress/v2/pkg/ingress/kube/util"
 )
 
 type Gateway struct {
@@ -70,6 +72,23 @@ func (g ListenerSet) Equals(other ListenerSet) bool {
 		g.Valid == other.Valid // TODO: ok to ignore parent/parentInfo?
 }
 
+// Start - Added by Higress
+
+// defuseGatewaySecretTemplates restricts the secret references in a converted listener to the
+// namespace of the Gateway or ListenerSet it was built from, the same way the route conversion
+// does: by the time these configs are listed, the namespace of the object they came from is no
+// longer distinguishable from a namespace a tenant wrote into the reference itself.
+//
+// The error is fatal for that listener and the caller has to drop it. Emitting a spec that
+// could not be inspected would resolve its references against the namespace of the generated
+// config, which is the cross-namespace secret read this exists to prevent.
+func defuseGatewaySecretTemplates(kind config.GroupVersionKind, namespace, name string, spec any) error {
+	_, err := util.DefuseSpecTemplates(spec, namespace, fmt.Sprintf("%s %s/%s", kind.Kind, namespace, name))
+	return err
+}
+
+// End - Added by Higress
+
 func ListenerSetCollection(
 	listenerSets krt.Collection[*gateway.ListenerSet],
 	gateways krt.Collection[*gateway.Gateway],
@@ -200,6 +219,12 @@ func ListenerSetCollection(
 					},
 				}
 
+				// Start - Added by Higress
+				if err := defuseGatewaySecretTemplates(gvk.ListenerSet, obj.Namespace, obj.Name, gatewayConfig.Spec); err != nil {
+					continue
+				}
+				// End - Added by Higress
+
 				allowed, _ := generateSupportedKinds(standardListener)
 				ref := parentKey{
 					Kind:      gvk.ListenerSet,
@@ -362,6 +387,12 @@ func GatewayCollection(
 				},
 			}
 
+			// Start - Added by Higress
+			if err := defuseGatewaySecretTemplates(gvk.KubernetesGateway, obj.Namespace, obj.Name, gatewayConfig.Spec); err != nil {
+				continue
+			}
+			// End - Added by Higress
+
 			allowed, _ := generateSupportedKinds(l)
 			ref := parentKey{
 				Kind:      gvk.KubernetesGateway,
```

---

### Incident Patch 8: `96441915` (2026-09-29)
**Commit Message**: fix: query-safe path joining for ext-auth envoy mode and ai-proxy basePath (#4833)

Signed-off-by: johnlanni <ztywto@qq.com>

**File**: `.github/workflows/wasm-plugin-unit-test.yml` (modified, +6/-0)
```diff
@@ -7,6 +7,7 @@ on:
       - 'plugins/wasm-go/extensions/**'
       - 'plugins/wasm-go/examples/**'
       - 'plugins/wasm-go/pkg/mcp/**'
+      - 'plugins/wasm-go/pkg/pathutil/**'
       - 'samples/mcp/protocol/2026-07-28/auto.yaml'
       - 'test/e2e/conformance/tests/go-wasm-mcp-2026-07-28.*'
       - '.github/workflows/wasm-plugin-unit-test.yml'
@@ -18,6 +19,7 @@ on:
       - 'plugins/wasm-go/extensions/**'
       - 'plugins/wasm-go/examples/**'
       - 'plugins/wasm-go/pkg/mcp/**'
+      - 'plugins/wasm-go/pkg/pathutil/**'
       - 'samples/mcp/protocol/2026-07-28/auto.yaml'
       - 'test/e2e/conformance/tests/go-wasm-mcp-2026-07-28.*'
       - '.github/workflows/wasm-plugin-unit-test.yml'
@@ -86,6 +88,10 @@ jobs:
             add_plugin "${BASH_REMATCH[1]}/${BASH_REMATCH[2]}"
           elif [[ $file =~ ^plugins/wasm-go/pkg/mcp/ || $file =~ ^samples/mcp/protocol/2026-07-28/auto.yaml$ || $file =~ ^test/e2e/conformance/tests/go-wasm-mcp-2026-07-28\. ]]; then
             add_plugin "extensions/mcp-server"
+          elif [[ $file =~ ^plugins/wasm-go/pkg/pathutil/ ]]; then
+            # Library-only module: exercised through the plugins that consume it.
+            add_plugin "extensions/ai-proxy"
+            add_plugin "extensions/ext-auth"
           fi
         done
         
```

**File**: `plugins/wasm-go/extensions/ai-proxy/go.mod` (modified, +3/-0)
```diff
@@ -6,7 +6,10 @@ go 1.24.1
 
 toolchain go1.24.4
 
+replace github.com/alibaba/higress/plugins/wasm-go/pkg/pathutil => ../../pkg/pathutil
+
 require (
+	github.com/alibaba/higress/plugins/wasm-go/pkg/pathutil v0.0.0
 	github.com/higress-group/proxy-wasm-go-sdk v0.0.0-20251103120604-77e9cce339d2
 	github.com/higress-group/wasm-go v1.0.10-0.20260120033417-1c84f010156d
 	github.com/stretchr/testify v1.9.0
```

**File**: `plugins/wasm-go/extensions/ai-proxy/provider/basepath_traversal_test.go` (added, +184/-0)
```diff
@@ -0,0 +1,184 @@
+// Copyright (c) 2025 Alibaba Group Holding Ltd.
+//
+// Licensed under the Apache License, Version 2.0 (the "License");
+// you may not use this file except in compliance with the License.
+// You may obtain a copy of the License at
+//
+//      http://www.apache.org/licenses/LICENSE-2.0
+//
+// Unless required by applicable law or agreed to in writing, software
+// distributed under the License is distributed on an "AS IS" BASIS,
+// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
+// See the License for the specific language governing permissions and
+// limitations under the License.
+
+package provider
+
+import (
+	"path"
+	"testing"
+
+	"github.com/alibaba/higress/plugins/wasm-go/pkg/pathutil"
+	"github.com/stretchr/testify/assert"
+	"github.com/stretchr/testify/require"
+)
+
+// The :path header carries the query string. Joining it whole onto basePath let
+// dot segments inside a query value resolve as path segments.
+func TestPrependBasePathQueryCarriedTraversalWasUnsafe(t *testing.T) {
+	const basePath = "/api"
+	const requestPath = "/v1/models?next=/../../../admin/keys"
+
+	assert.Equal(t, "/admin/keys", path.Join(basePath, requestPath),
+		"path.Join on the raw :path escapes basePath")
+
+	got, err := (&ProviderConfig{basePath: basePath, basePathHandling: basePathHandlingPrepend}).prependBasePath(requestPath)
+	require.NoError(t, err)
+	assert.Equal(t, "/api/v1/models?next=/../../../admin/keys", got)
+}
+
+func TestPrependBasePath(t *testing.T) {
+	tests := []struct {
+		name        string
+		basePath    string
+		requestPath string
+		want        string
+		wantErr     error
+	}{
+		// Clean paths keep their previous result.
+		{name: "clean path", basePath: "/api", requestPath: "/v1/chat/completions", want: "/api/v1/chat/completions"},
+		{name: "trailing slash basePath", basePath: "/api/", requestPath: "/v1/models", want: "/api/v1/models"},
+		{name: "already prefixed", basePath: "/api", requestPath: "/api/v1/models", want: "/api/v1/models"},
+		{name: "already prefixed with query", basePath: "/api", requestPath: "/api/v1/models?a=1", want: "/api/v1/models?a=1"},
+		{name: "empty request path", basePath: "/api", requestPath: "", want: "/api"},
+
+		// The query is re-appended verbatim and never joins the path.
+		{name: "path with query", basePath: "/api", requestPath: "/v1/models?a=1", want: "/api/v1/models?a=1"},
+		{name: "multiple query params", basePath: "/api", requestPath: "/v1/models?a=1&b=2", want: "/api/v1/models?a=1&b=2"},
+		{name: "empty query keeps separator", basePath: "/api", requestPath: "/v1/models?", want: "/api/v1/models?"},
+		{
+			name:        "dot segments carried by query value",
+			basePath:    "/api",
+			requestPath: "/v1/models?next=/../../../admin/keys",
+			want:        "/api/v1/models?next=/../../../admin/keys",
+		},
+		{
+			name:        "percent encoded dots in query stay as-is",
+			basePath:    "/api",
+			requestPath: "/v1/models?next=%2E%2E%2F%2E%2E%2Fadmin",
+			want:        "/api/v1/models?next=%2E%2E%2F%2E%2E%2Fadmin",
+		},
+		{
+			// %2E%2E is a literal segment for path.Join, but the upstream decodes the
+			// path before resolving dot segments, so it must be treated as one.
+			name:        "percent encoded dot dot in path",
+			basePath:    "/api",
+			requestPath: "/%2E%2E/admin",
+			wantErr:     pathutil.ErrPathTraversal,
+		},
+		{
+			name:        "percent encoded dots that stay inside basePath",
+			basePath:    "/api",
+			requestPath: "/v1/models%2E%2Elist",
+			want:        "/api/v1/models%2E%2Elist",
+		},
+
+		// A path that already starts with basePath is not exempt: it can climb back
+		// out of basePath, and the early return used to skip every check.
+		{
+			name:        "already prefixed dot dot escapes basePath",
+			basePath:    "/api",
+			requestPath: "/api/../../admin",
+			wantErr:     pathutil.ErrPathTraversal,
+		},
+		{
+			name:        "already prefixed dot dot below a segment escapes basePath"
```

**File**: `plugins/wasm-go/extensions/ai-proxy/provider/provider.go` (modified, +28/-3)
```diff
@@ -8,13 +8,13 @@ import (
 	"hash/fnv"
 	"math/rand"
 	"net/http"
-	"path"
 	"regexp"
 	"strconv"
 
 	"strings"
 
 	"github.com/alibaba/higress/plugins/wasm-go/extensions/ai-proxy/util"
+	"github.com/alibaba/higress/plugins/wasm-go/pkg/pathutil"
 	"github.com/higress-group/proxy-wasm-go-sdk/proxywasm"
 	"github.com/higress-group/proxy-wasm-go-sdk/proxywasm/types"
 	"github.com/higress-group/wasm-go/pkg/log"
@@ -954,6 +954,24 @@ func (c *ProviderConfig) applyProviderBasePath(path string) string {
 	return path
 }
 
+// prependBasePath puts c.basePath in front of the request path. The request path
+// carries the query string, so joining it whole would let dot segments hidden in
+// a query value resolve as path segments and escape basePath; pathutil.SafeJoin
+// joins the path portion only and rejects results outside basePath.
+//
+// The already-prefixed branch is validated as well: a path that starts with
+// basePath can still climb back out of it, and returning it untouched would skip
+// every check.
+func (c *ProviderConfig) prependBasePath(currentPath string) (string, error) {
+	if strings.HasPrefix(currentPath, c.basePath) {
+		if err := pathutil.ValidateWithin(c.basePath, currentPath); err != nil {
+			return "", err
+		}
+		return currentPath, nil
+	}
+	return pathutil.SafeJoin(c.basePath, currentPath)
+}
+
 func (c *ProviderConfig) parseRequestAndMapModel(ctx wrapper.HttpContext, request interface{}, body []byte) error {
 	switch req := request.(type) {
 	case *chatCompletionRequest:
@@ -1396,8 +1414,15 @@ func (c *ProviderConfig) handleRequestHeaders(provider Provider, ctx wrapper.Htt
 		headers.Set(":path", removePrefixPath)
 	}
 
-	if c.basePath != "" && c.basePathHandling == basePathHandlingPrepend && !strings.HasPrefix(headers.Get(":path"), c.basePath) {
-		headers.Set(":path", path.Join(c.basePath, headers.Get(":path")))
+	if c.basePath != "" && c.basePathHandling == basePathHandlingPrepend {
+		prependedPath, err := c.prependBasePath(headers.Get(":path"))
+		if err != nil {
+			log.Errorf("rejecting request path %q for basePath %q: %v", headers.Get(":path"), c.basePath, err)
+			_ = proxywasm.SendHttpResponseWithDetail(http.StatusBadRequest, "ai-proxy.path_traversal",
+				util.CreateHeaders(util.HeaderContentType, util.MimeTypeTextPlain), []byte("invalid request path"), -1)
+			return
+		}
+		headers.Set(":path", prependedPath)
 	}
 
 	// Apply providerBasePath if configured
```

**File**: `plugins/wasm-go/extensions/ext-auth/README.md` (modified, +1/-1)
```diff
@@ -99,7 +99,7 @@ MatchRule 类型每一项的配置字段说明，在使用 `array of MatchRule`
 
 ### 两种 `endpoint_mode` 的区别
 
-`endpoint_mode` 为 `envoy` 时，鉴权请求会使用原始请求的 HTTP Method，和配置的 `path_prefix` 作为请求路径前缀拼接上原始的请求路径
+`endpoint_mode` 为 `envoy` 时，鉴权请求会使用原始请求的 HTTP Method，和配置的 `path_prefix` 作为请求路径前缀拼接上原始的请求路径。拼接时只使用原始请求路径中 `?` 之前的部分，因此查询参数取值里的 `..` 不会被当作路径段解析。`path_prefix` 必须是绝对且规范的路径：若请求路径解析后超出 `path_prefix`、包含反斜杠（`\`），或无法被解析为合法的 URL，则不会调用鉴权服务，直接返回 HTTP 403（`ext-auth.path_traversal`）。这类拒绝不会应用 `failure_mode_allow` 配置，因为该配置针对的是鉴权服务不可用，而不是根本无法完成鉴权的请求。
 
 `endpoint_mode` 为 `forward_auth` 时，鉴权请求会使用配置的 `request_method` 作为 HTTP Method，和配置的 `path` 作为请求路径，并且 Higress 会自动生成并发送以下 header 至鉴权服务：
 
```

---

### Incident Patch 9: `b7fb8762` (2026-09-29)
**Commit Message**: fix: hmac-auth-apisix fails closed for attached rules with empty allow list (#4835)

Signed-off-by: johnlanni <ztywto@qq.com>

**File**: `plugins/release/catalog.json` (modified, +1/-1)
```diff
@@ -31,7 +31,7 @@
       "frontend-gray": { "repository": "higress-group/higress-console", "sourceCommit": "36aa9c67fb0057164dab9b1fe687b38fe5b8a022", "files": [{ "sourcePath": "backend/sdk/src/main/resources/plugins/frontend-gray/spec.yaml", "targetPath": "spec.yaml", "sha256": "d3ec4bfc85f3ae49d58345ed713cb5f995965d915b492a12195cb507ab1604ca" }, { "sourcePath": "backend/sdk/src/main/resources/plugins/frontend-gray/README.md", "targetPath": "README.md", "sha256": "33e9348e29b37789d36a01aca0925e9e07b2134e948e285dccfd825bd02770a1" }, { "sourcePath": "backend/sdk/src/main/resources/plugins/frontend-gray/README_EN.md", "targetPath": "README_EN.md", "sha256": "dbc19cfb4ad5b52a075d26f6e99d5a3b44db5095589075863d9318df19c4fab4" }] },
       "geo-ip": { "repository": "higress-group/higress-console", "sourceCommit": "36aa9c67fb0057164dab9b1fe687b38fe5b8a022", "files": [{ "sourcePath": "backend/sdk/src/main/resources/plugins/geo-ip/spec.yaml", "targetPath": "spec.yaml", "sha256": "b4b5ec8aa3c48d93d809bf580e02578b5d012883025d7299a846d81169e2a51a" }, { "sourcePath": "backend/sdk/src/main/resources/plugins/geo-ip/README.md", "targetPath": "README.md", "sha256": "67408e4c774ec7c0123b33cb706da8636d7aed89564bcd51e03e7604697ec46c" }, { "sourcePath": "backend/sdk/src/main/resources/plugins/geo-ip/README_EN.md", "targetPath": "README_EN.md", "sha256": "5992b0ac4ffe63d8e7997e8c7af54ea7ef230b014569ea6a2c5301694d887f99" }] },
       "gw-error-format": { "repository": "higress-group/higress", "files": [{ "sourcePath": "plugins/release/console/gw-error-format/spec.yaml", "targetPath": "spec.yaml", "sha256": "26ec5ed1220efb0b5bbcec6342a48fcfc01ad68321b56c1e28a99301fd34a7b1" }, { "sourcePath": "plugins/wasm-go/extensions/gw-error-format/README.md", "targetPath": "README.md", "sha256": "9d083183ae678c2089ad676745893c2c2697d85a3e5253fffd44c5738aa017a8" }, { "sourcePath": "plugins/release/console/gw-error-format/README_EN.md", "targetPath": "README_EN.md", "sha256": "f4a795ef32d155264089d9336c28f1948dcafaed1408cabd7902f5c0d651645c" }] },
-      "hmac-auth-apisix": { "repository": "higress-group/higress", "files": [{ "sourcePath": "plugins/release/console/hmac-auth-apisix/spec.yaml", "targetPath": "spec.yaml", "sha256": "d8ea901848ebe354471297840a4ba8da3f50fff55998e85bd656396b5608815b" }, { "sourcePath": "plugins/wasm-go/extensions/hmac-auth-apisix/README.md", "targetPath": "README.md", "sha256": "fa896d226dd92482ca1e273387831f4048445499aa0410935da242369f6ebd97" }, { "sourcePath": "plugins/wasm-go/extensions/hmac-auth-apisix/README_EN.md", "targetPath": "README_EN.md", "sha256": "c076fc3d6ca469456f6d53b3b8b61e4e87c721999217445e47fc19d63d6aa34d" }] },
+      "hmac-auth-apisix": { "repository": "higress-group/higress", "files": [{ "sourcePath": "plugins/release/console/hmac-auth-apisix/spec.yaml", "targetPath": "spec.yaml", "sha256": "d8ea901848ebe354471297840a4ba8da3f50fff55998e85bd656396b5608815b" }, { "sourcePath": "plugins/wasm-go/extensions/hmac-auth-apisix/README.md", "targetPath": "README.md", "sha256": "4aa1d4f8500759e12322e5c4cfd08eafa1090a2ad32215b6d4f0c0f534d0da13" }, { "sourcePath": "plugins/wasm-go/extensions/hmac-auth-apisix/README_EN.md", "targetPath": "README_EN.md", "sha256": "c435e41bbd430fb47f5f823f7fde20f4ae3ae46336e059dadf9446910c425d65" }] },
       "ip-restriction": { "repository": "higress-group/higress-console", "sourceCommit": "36aa9c67fb0057164dab9b1fe687b38fe5b8a022", "files": [{ "sourcePath": "backend/sdk/src/main/resources/plugins/ip-restriction/spec.yaml", "targetPath": "spec.yaml", "sha256": "a3dd47a0f22b54bf560470de6e68ec163844b3de8c4cfe5f203864d11eef0f3a" }, { "sourcePath": "backend/sdk/src/main/resources/plugins/ip-restriction/README.md", "targetPath": "README.md", "sha256": "db580cad8eb73240bb0296d6e20eed3613fd20716462096163ff6bd5b3df50e7" }, { "sourcePath": "backend/sdk/src/main/resources/plugins/ip-restriction/README_EN.md", "targetPath": "README_EN.md", "sha256": "b9ac3ac76d68bd82cb660e71f8be104b669af961b7ab95d5945fbe72
```

**File**: `plugins/release/console-recovery/2.2.4.json` (modified, +2/-2)
```diff
@@ -90,12 +90,12 @@
             {
               "sourcePath": "plugins/wasm-go/extensions/hmac-auth-apisix/README.md",
               "targetPath": "README.md",
-              "sha256": "fa896d226dd92482ca1e273387831f4048445499aa0410935da242369f6ebd97"
+              "sha256": "4aa1d4f8500759e12322e5c4cfd08eafa1090a2ad32215b6d4f0c0f534d0da13"
             },
             {
               "sourcePath": "plugins/wasm-go/extensions/hmac-auth-apisix/README_EN.md",
               "targetPath": "README_EN.md",
-              "sha256": "c076fc3d6ca469456f6d53b3b8b61e4e87c721999217445e47fc19d63d6aa34d"
+              "sha256": "c435e41bbd430fb47f5f823f7fde20f4ae3ae46336e059dadf9446910c425d65"
             }
           ]
         }
```

**File**: `plugins/wasm-go/extensions/hmac-auth-apisix/README.md` (modified, +9/-1)
```diff
@@ -46,7 +46,14 @@ description: APISIX HMAC 认证插件配置参考
 
 | 名称    | 数据类型        | 填写要求                 | 默认值 | 描述                                                         |
 | ------- | --------------- | ------------------------ | ------ | ------------------------------------------------------------ |
-| `allow` | array of string | 选填(**非实例级别配置**) | -      | 只能在路由或域名等细粒度规则上配置，对于符合匹配条件的请求，配置允许访问的 consumer，从而实现细粒度的权限控制 |
+| `allow` | array of string | 选填(**非实例级别配置**) | -      | 只能在路由或域名等细粒度规则上配置，对于符合匹配条件的请求，配置允许访问的 consumer，从而实现细粒度的权限控制。**在规则上启用了本插件却未配置 `allow`（或配置为空列表）时，视为没有任何 consumer 被授权，匹配该规则的请求会被直接拒绝（fail closed）** |
+
+**关于 `allow` 的 fail closed 语义：**
+
+- 细粒度规则（`_rules_`）一旦命中当前请求，就表示插件已在该域名或路由上生效。此时 `allow` 缺失或为空列表**不再表示“插件未生效”**，而是表示没有任何 consumer 被授权，所有匹配该规则的请求都会返回 `401`，错误信息为 `{"message":"client request can't be validated: no consumer is allowed"}`，不会跳过认证直接放行。
+- 配置了 `anonymous_consumer` 时同样如此：匿名身份也不能绕过上述拒绝。
+- `global_auth: true` 时认证全局生效，`allow` 只是附加的细粒度限制，因此规则上未配置 `allow` 表示不做额外限制，请求仍需通过签名校验后才能访问。
+- `global_auth: false` 时，只有命中规则的域名或路由才会认证；未命中任何规则的请求直接放行。
 
 ## 配置示例
 
@@ -85,6 +92,7 @@ allow:
 - 路由名称（如 route-a、route-b）对应网关路由创建时定义的名称，匹配时仅允许consumer1访问
 - 域名匹配（如 `*.example.com`、`test.com`）用于过滤请求域名，匹配时仅允许consumer2访问
 - 未在allow列表中的调用者将被拒绝访问
+- 如果在某个路由或域名上启用了本插件，却没有配置 `allow`（或配置为空列表），则该路由或域名上的**所有**请求都会被拒绝（返回 `401`），即“失败关闭”（fail closed），不会跳过认证直接放行
 
 **生成签名，可以使用以下 Go 代码片段或其他技术栈**：
 
```

**File**: `plugins/wasm-go/extensions/hmac-auth-apisix/README_EN.md` (modified, +9/-1)
```diff
@@ -46,7 +46,14 @@ The `hmac-auth-apisix` plugin is compatible with Apache APISIX's HMAC authentica
 
 | Name    | Data Type        | Requirements                              | Default Value | Description                                                                                                                                 |
 |---------|------------------| ----------------------------------------- |---------------|---------------------------------------------------------------------------------------------------------------------------------------------|
-| `allow` | array of string  | Optional (**Non-instance-level configuration only**) | -             | Can only be configured in fine-grained rules such as routes or domains. For requests that match the criteria, it configures the consumers allowed to access, enabling fine-grained permission control. |
+| `allow` | array of string  | Optional (**Non-instance-level configuration only**) | -             | Can only be configured in fine-grained rules such as routes or domains. For requests that match the criteria, it configures the consumers allowed to access, enabling fine-grained permission control. **When a rule enables the plugin but `allow` is missing (or an empty list), no consumer is authorized and matching requests are rejected (fail closed).** |
+
+**Fail-closed semantics of `allow`:**
+
+- Once a fine-grained rule (`_rules_`) matches the current request, the plugin is in effect on that domain or route. A missing or empty `allow` list there **no longer means "the plugin is not in effect"**; it means no consumer is authorized, so every request matching that rule is rejected with `401` and the message `{"message":"client request can't be validated: no consumer is allowed"}` instead of being forwarded without authentication.
+- This also holds when `anonymous_consumer` is configured: the anonymous identity cannot bypass the rejection above.
+- With `global_auth: true`, authentication applies globally and `allow` is only an additional fine-grained restriction, so a rule without `allow` adds no restriction and requests still have to pass signature verification.
+- With `global_auth: false`, only domains and routes matched by a rule are authenticated; requests that match no rule are passed through.
 
 
 ## Configuration Examples
@@ -87,6 +94,7 @@ allow:
 - **Route Names** (e.g., `route-a`, `route-b`): Correspond to the names defined when creating gateway routes. Only `consumer1` is allowed access when matched.
 - **Domain Matching** (e.g., `*.example.com`, `test.com`): Used to filter request domains. Only `consumer2` is allowed access when matched.
 - Callers not in the `allow` list will be denied access.
+- If the plugin is enabled on a route or domain without an `allow` list (or with an empty one), then **all** requests on that route or domain are rejected with `401` — the plugin fails closed instead of skipping authentication.
 
 
 #### To Generate a Signature, Use the Following Go Code Snippet or Other Tech Stacks:
```

**File**: `plugins/wasm-go/extensions/hmac-auth-apisix/config/config.go` (modified, +6/-1)
```diff
@@ -24,8 +24,13 @@ type HmacAuthConfig struct {
 	ValidateRequestBody bool       `json:"validate_request_body,omitempty" yaml:"validate_request_body,omitempty"`
 	HideCredentials     bool       `json:"hide_credentials,omitempty" yaml:"hide_credentials,omitempty"`
 	AnonymousConsumer   string     `json:"anonymous_consumer,omitempty" yaml:"anonymous_consumer,omitempty"`
+	// Allow lists the consumers authorized at the rule scope. It is only parsed from
+	// domain/route override rules (ParseOverrideRuleConfig); the global config parser
+	// deliberately ignores a global "allow" key, so an empty Allow at global scope means
+	// "no extra fine-grained restriction", never "deny all". The fail-closed semantics in
+	// onHttpRequestHeaders depend on this invariant together with RuleSet.
 	Allow               []string   `json:"allow,omitempty" yaml:"allow,omitempty"`
-	// RuleSet 插件是否至少在一个 domain 或 route 上生效
+	// RuleSet 当前请求是否命中了 domain/route 级规则，即插件是否在该 domain/route 上被显式启用
 	RuleSet bool `json:"-" yaml:"-"`
 }
 
```

---

### Incident Patch 10: `b44d4f77` (2026-09-28)
**Commit Message**: fix(ai-data-masking): avoid CPU stalls in hash restore

Signed-off-by: jianwei.wjw <jianwei.wjw@alibaba-inc.com>

**File**: `plugins/wasm-rust/extensions/ai-data-masking/Cargo.lock` (modified, +5/-4)
```diff
@@ -33,6 +33,7 @@ dependencies = [
 name = "ai-data-masking"
 version = "0.1.0"
 dependencies = [
+ "aho-corasick",
  "fancy-regex",
  "grok",
  "higress-wasm-rust",
@@ -212,9 +213,9 @@ checksum = "75b325c5dbd37f80359721ad39aca5a29fb04c89279657cffdda8736d0c0b9d2"
 
 [[package]]
 name = "fancy-regex"
-version = "0.14.0"
+version = "0.19.0"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "6e24cb5a94bcae1e5408b0effca5cd7172ea3c5755049c5f3af4cd283a165298"
+checksum = "476de73bddf2ef8490aa4ee8f1cf40b430bf1d56c48c22080e5186952cd580e6"
 dependencies = [
  "bit-set",
  "regex-automata",
@@ -803,9 +804,9 @@ dependencies = [
 
 [[package]]
 name = "regex-automata"
-version = "0.4.9"
+version = "0.4.18"
 source = "registry+https://github.com/rust-lang/crates.io-index"
-checksum = "809e8dc61f6de73b46c85f4c96486310fe304c434cfa43669d7b40f711150908"
+checksum = "ad8553b9b26413251cbf30e620595c7a41b3887f03da04579c0e6b0d6a06b4b2"
 dependencies = [
  "aho-corasick",
  "memchr",
```

**File**: `plugins/wasm-rust/extensions/ai-data-masking/Cargo.toml` (modified, +2/-1)
```diff
@@ -9,11 +9,12 @@ publish = false
 crate-type = ["cdylib"]
 
 [dependencies]
+aho-corasick = "1"
 higress-wasm-rust = { path = "../../", version = "0.1.0" }
 proxy-wasm = { git="https://github.com/higress-group/proxy-wasm-rust-sdk", branch="main", version="0.2.2" }
 serde = { version = "1.0", features = ["derive"] }
 serde_json = "1.0"
-fancy-regex = "0"
+fancy-regex = "0.19"
 hmac-sha256 = "1"
 grok = "2"
 lazy_static = "1"
```

**File**: `plugins/wasm-rust/extensions/ai-data-masking/src/ai_data_masking.rs` (modified, +603/-82)
```diff
@@ -14,6 +14,7 @@
 
 use crate::deny_word::DenyWord;
 use crate::msg_win_openai::MsgWindow;
+use aho_corasick::{AhoCorasick, AhoCorasickBuilder, AhoCorasickKind, Input, MatchKind};
 use fancy_regex::Regex;
 use grok::patterns;
 use higress_wasm_rust::log::Log;
@@ -60,7 +61,8 @@ struct AiDataMaskingRoot {
 struct AiDataMasking {
     weak: Weak<RefCell<Box<dyn HttpContextWrapper<AiDataMaskingConfig>>>>,
     config: Option<Rc<AiDataMaskingConfig>>,
-    mask_map: HashMap<String, Option<String>>,
+    mask_map: HashMap<String, RestoreEntry>,
+    mask_restore: Option<MaskRestore>,
     is_openai: bool,
     is_openai_stream: Option<bool>,
     stream: bool,
@@ -149,6 +151,296 @@ struct Rule {
     #[serde(default)]
     value: String,
 }
+
+struct MaskRestore {
+    general: Option<GeneralRestore>,
+    hashes: HashMap<String, String>,
+}
+
+struct GeneralRestore {
+    matcher: AhoCorasick,
+    replacements: Vec<String>,
+}
+
+#[derive(Clone, Copy, Debug, PartialEq, Eq)]
+enum RestoreKind {
+    Hash,
+    General,
+}
+
+struct RestoreEntry {
+    original: Option<String>,
+    kind: RestoreKind,
+}
+
+#[derive(Debug)]
+enum RestoreBuildError {
+    TooManyGeneralPatterns(usize),
+    GeneralPatternBytesExceeded(usize),
+    Matcher(aho_corasick::BuildError),
+}
+
+impl std::fmt::Display for RestoreBuildError {
+    fn fmt(&self, formatter: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
+        match self {
+            Self::TooManyGeneralPatterns(count) => write!(
+                formatter,
+                "general restore pattern count {} exceeds limit {}",
+                count, MAX_GENERAL_RESTORE_PATTERNS
+            ),
+            Self::GeneralPatternBytesExceeded(bytes) => write!(
+                formatter,
+                "general restore pattern bytes {} exceeds limit {}",
+                bytes, MAX_GENERAL_RESTORE_PATTERN_BYTES
+            ),
+            Self::Matcher(error) => write!(formatter, "{}", error),
+        }
+    }
+}
+
+impl From<aho_corasick::BuildError> for RestoreBuildError {
+    fn from(error: aho_corasick::BuildError) -> Self {
+        Self::Matcher(error)
+    }
+}
+
+const HASH_MASK_BYTES: usize = 64;
+const MAX_GENERAL_RESTORE_PATTERNS: usize = 1_024;
+const MAX_GENERAL_RESTORE_PATTERN_BYTES: usize = 64 * 1_024;
+
+impl MaskRestore {
+    fn from_map(
+        mask_map: HashMap<String, RestoreEntry>,
+    ) -> Result<Option<Self>, RestoreBuildError> {
+        let mut hashes = HashMap::new();
+        let mut general_pairs = Vec::new();
+        let mut general_pattern_bytes = 0;
+        for (masked, entry) in mask_map {
+            let Some(original) = entry.original else {
+                continue;
+            };
+            match entry.kind {
+                RestoreKind::Hash => {
+                    hashes.insert(masked, original);
+                }
+                RestoreKind::General => {
+                    general_pattern_bytes += masked.len();
+                    general_pairs.push((masked, original));
+                }
+            }
+        }
+
+        if general_pairs.len() > MAX_GENERAL_RESTORE_PATTERNS {
+            return Err(RestoreBuildError::TooManyGeneralPatterns(
+                general_pairs.len(),
+            ));
+        }
+        if general_pattern_bytes > MAX_GENERAL_RESTORE_PATTERN_BYTES {
+            return Err(RestoreBuildError::GeneralPatternBytesExceeded(
+                general_pattern_bytes,
+            ));
+        }
+        if hashes.is_empty() && general_pairs.is_empty() {
+            return Ok(None);
+        }
+        general_pairs.sort_unstable_by(|left, right| left.0.cmp(&right.0));
+
+        let general = if general_pairs.is_empty() {
+            None
+        } else {
+            let matcher = AhoCorasickBuilder::new()
+                .match_kind(MatchKind::LeftmostLongest)
+                .kind(Some(AhoCorasickKind::ContiguousNFA))
+                .build(general_pairs.iter().map(|(masked, _)| masked))?;
+  
```

#### Recent Merged Pull Requests:
- **PR #4878** (2026-09-29): fix(mcp-session): write back assembled SSE fragments when path rewrite is disabled (@johnlanni)
- **PR #4873** (closed): plugins/wasm-go/extensions/hmac-auth-apisix/main.go:78 - HMAC auth fails open for attached rules with an empty allow list (@Metastarx)
- **PR #4855** (2026-09-29): fix: replace instead of append X-Mse-Consumer consumer identity header (@johnlanni)
- **PR #4854** (2026-09-29): docs: clarify allowTools is route-scoped (@johnlanni)
- **PR #4853** (2026-09-29): fix: require authentication for RAG MCP server write path (@johnlanni)
- **PR #4852** (2026-09-29): refactor: migrate deprecated wrapper.HasRequestBody() to ctx.HasRequestBody() (@johnlanni)
- **PR #4835** (2026-09-29): fix: hmac-auth-apisix fails closed for attached rules with empty allow list (@johnlanni)
- **PR #4834** (2026-09-29): fix: namespace-restricted secret template resolution for Ingress annotations (@johnlanni)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
