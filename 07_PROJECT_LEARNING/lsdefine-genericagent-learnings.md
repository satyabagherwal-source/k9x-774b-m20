# Forensic Learning Record (Deep Inspection): lsdefine/GenericAgent

> **Canonical Artifact**: `07_PROJECT_LEARNING/lsdefine-genericagent-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/lsdefine/GenericAgent](https://github.com/lsdefine/GenericAgent))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-05T18:36:22.872Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `lsdefine/GenericAgent`
- **Description**: Self-evolving agent: grows skill tree from 3.3K-line seed, achieving full system control with 6x less token consumption
- **Primary Language / Ecosystem**: Python
- **Discovered Manifests / Configurations**: pyproject.toml, README.md
- **Stars / Engagement**: 14282 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: pyproject.toml, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `agent_loop.py`
```
import json, re, os
from dataclasses import dataclass
from typing import Any, Optional
try: from plugins.hooks import trigger as _hook
except ImportError: _hook = lambda *a, **k: None
@dataclass
class StepOutcome:
    data: Any
    next_prompt: Optional[str] = None
    should_exit: bool = False
def try_call_generator(func, *args, **kwargs):
    ret = func(*args, **kwargs)
    if hasattr(ret, '__iter__') and not isinstance(ret, (str, bytes, dict, list)): ret = yield from ret
    return ret

class BaseHandler:
    def turn_end_callback(self, response, tool_calls, tool_results, turn, next_prompt, exit_reason): return next_prompt
    def dispatch(self, tool_name, args, response, index=0, tool_num=1):
        method_name = f"do_{tool_name}"
        if hasattr(self, method_name):
            args['_index'] = index; args['_tool_num'] = tool_num
            _hook('tool_before', locals())
            ret = yield from try_call_generator(getattr(self, method_name), args, response)
            _hook('tool_after', locals())
            return ret
        elif tool_name == 'bad_json': return StepOutcome(None, next_prompt=args.get('msg', 'bad_json'), should_exit=False)
        else:
            yield f"未知工具: {tool_name}\n"
            return StepOutcome(None, next_prompt=f"未知工具 {tool_name}", should_exit=False)

def json_default(o): return list(o) if isinstance(o, set) else str(o)
def exhaust(g):
    try: 
        while True: next(g)
    except StopIteration as e: return e.value

def get_pretty_json(data):
    if isinstance(data, dict) and "script" in data:
        data = data.copy(); data["script"] = data["script"].replace("; ", ";\n  ")
    return json.dumps(data, indent=2, ensure_ascii=False).replace('\\n', '\n')

def agent_runner_loop(client, system_prompt, user_input, handler, tools_schema, 
                      max_turns=40, verbose=True, initial_user_content=None, yield_info=False):
    messages = [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": initial_user_content if initial_user_content is not None else user_input}
    ]
    turn = 0;  handler.max_turns = max_turns
    _hook('agent_before', locals())
    while turn < handler.max_turns:
        turn += 1; turnstr = f'LLM Running (Turn {turn}) ...'
        if handler.parent.task_dir: turnstr = f'Turn {turn} ...'
        if verbose: turnstr = f'**{turnstr}**'
        if yield_info: yield {'turn': turn}
        yield f"\n{turnstr}\n\n"
        if turn%10 == 0: client.last_tools = ''  # 每10轮重置一次工具描述
        _hook('turn_before', locals())
        _hook('llm_before', locals())
        response_gen = client.chat(messages=messages, tools=tools_schema)
        if verbose:
            response = yield from response_gen
            yield '\n\n'
        else:
            response = exhaust(response_gen)
            cleaned = _clean_content(response.content)
            if cleaned: yield cleaned + '\n'
        _hook('llm_after', locals())

        if not response.tool_calls: tool_calls = [{'tool_name': 'no_tool', 'args': {}}]
        else: tool_calls = [{'tool_name': tc.function.name, 'args': json.loads(tc.function.arguments), 'id': tc.id}
                          for tc in response.tool_calls]
       
        tool_results = []; next_prompts = set(); exit_reason = {}
        for ii, tc in enumerate(tool_calls):
            tool_name, args, tid = tc['tool_name'], tc['args'], tc.get('id', '')
            if tool_name == 'no_tool': pass
            else: 
                if verbose: yield f"🛠️ Tool: `{tool_name}`  📥 args:\n````text\n{get_pretty_json(args)}\n````\n"
                else: yield f"🛠️ {tool_name}({_compact_tool_args(tool_name, args)})\n"
            handler.current_turn = turn
            gen = handler.dispatch(tool_name, args, response, index=ii, tool_num=len(tool_calls))
            try:
                v = next(gen)
                if verbose: yield '`````\n' + v
                outcome = (yield from gen) if verbose else exhaust(gen)
                if verbose: yield '`````\n'
            except StopIteration as e: outcome = e.value
            
            if outcome.should_exit: 
                exit_reason = {'result': 'EXITED', 'data': outcome.data}; break
            if not outcome.next_prompt: 
                exit_reason = {'result': 'CURRENT_TASK_DONE', 'data': outcome.data}; break
            if outcome.next_prompt.startswith('未知工具'): client.last_tools = ''
            if outcome.data is not None and tool_name != 'no_tool': 
                datastr = json.dumps(outcome.data, ensure_ascii=False, default=json_default) if type(outcome.data) in [dict, list] else str(outcome.data) 
                tool_results.append({'tool_use_id': tid, 'content': datastr})
            next_prompts.add(outcome.next_prompt)
        if len(next_prompts) == 0 or exit_reason:
            if len(handler._done_hooks) == 0 or exit_reason.get('result', '') == 'EXITED': break
            next_prompts.add(handler._done_hooks.pop(0))
        next_prompt = handler.turn_end_callback(response, tool_calls, tool_results, turn, '\n'.join(next_prompts), exit_reason)
        _hook('turn_after', locals())
        messages = [{"role": "user", "content": next_prompt, "tool_results": tool_results}]   # just new message, history is kept in *Session
    if exit_reason: handler.turn_end_callback(response, tool_calls, tool_results, turn, '', exit_reason)
    _hook('agent_after', locals())
    return exit_reason or {'result': 'MAX_TURNS_EXCEEDED'}

def _clean_content(text):
    if not text: return ''
    def _shrink_code(m):
        lines = m.group(0).split('\n')
        lang = lines[0].replace('```','').strip()
        body = [l for l in lines[1:-1] if l.strip()]
        if len(body) <= 6: return m.group(0)
        preview = '\n'.join(body[:5])
        return f'```{lang}\n{preview}\n  ... ({len(body)} lines)\n```'
    text = re.sub(r'```[\s\S]*?```', _shrink_code, text)
    for p in [r'<file_content>[\s\S]*?</file_content>', r'<tool_(?:use|call)>[\s\S]*?</tool_(?:use|call)>', r'(\r?\n){3,}']:
        text = re.sub(p, '\n\n' if '\\n' in p else '', text)
    return text.strip()

def _compact_tool_args(name, args):
    a = {k: v for k, v in args.items() if k != '_index'}
    for k in ('path',): 
        if k in a: a[k] = os.path.basename(a[k])
    if name == 'update_working_checkpoint': s = a.get('key_info', ''); return (s[:60]+'...') if len(s)>60 else s
    if name == 'ask_user':
        q = str(a.get('question', ''))
        cs = a.get('candidates') or []
        if cs: q += '\ncandidates:\n' + '\n'.join(f'- {c}' for c in cs)
        return q
    s = json.dumps(a, ensure_ascii=False); return (s[:120]+'...') if len(s)>120 else s

```

### Core Architecture Module: `frontends/plan_state.py`
```
"""Plan / todo state — pure stdlib, no UI framework dependency.

API:
  extract(text)                   → [(content, "open"|"done"), …]
  is_active(agent, messages=None) → plan mode on (stash OR per-session msg ref)
  resolve_path(agent, messages=None) → live plan.md path (or None)
  find_path_in_messages(messages) → most recent plan.md path mentioned
  current_step(messages)          → latest `当前步骤：…` snippet (or "")
  summary(items)                  → (n_done, n_total)
  is_complete(items)              → all done (or empty)

Supported task-line shapes (all matched by `extract`):
  - [ ] foo              ← bullet + open
  - [x] foo              ← bullet + done
  1. [✓] foo             ← numbered + done
  2. [✓ 2026-05-16] foo  ← numbered + timestamped done, content after bracket
  3. [✓ 已生成: foo]      ← numbered + done with description *inside* bracket
  4. [D][P] foo          ← two marker groups (delegate + parallel), still open
  5. [D] foo             ← non-standard marker "D" → open (not done)
"""
from __future__ import annotations
import os, re
from typing import Any, Optional

_DONE_CHARS = set("xX✓✔√☑")
# Newline-insert before a bullet stuck to JSON debris (`{"content": "- [ ] …`).
_GLUE_RE = re.compile(r"(?<!\n)((?:[-*+]|\d+\s*[.)、:）]) \[)")
_BULLET_RE = re.compile(r"^\s*(?:[-*+]|\d+\s*[.)、:）])\s+")
_BRACKET_RE = re.compile(r"\[([^\]]*)\]")
# Strip `✓ ` / `x ` / timestamp prefix when bracket content is used as title.
_INLINE_STRIP_RE = re.compile(
    r"^[" + re.escape("".join(_DONE_CHARS)) + r"]\s*(?:\d{4}-\d{2}-\d{2}\s+\d{1,2}:\d{2}(?::\d{2})?\s*)?"
)
_DEBRIS_RE = re.compile(r'["\\<].*$')
# Strip markdown emphasis since planbar renders rich.Text, not Markdown.
_MD_EMPHASIS_RE = re.compile(
    r"\*\*([^*\n]+)\*\*|\*([^*\n]+)\*|__([^_\n]+)__|_([^_\n]+)_|`([^`\n]+)`"
)
def _strip_md(s: str) -> str:
    return _MD_EMPHASIS_RE.sub(lambda m: next(g for g in m.groups() if g is not None), s)


def _has_done_glyph(marker: str) -> bool:
    return any(c in _DONE_CHARS for c in marker)


def extract(text: str) -> list[tuple[str, str]]:
    if not text: return []
    norm = text.replace("\\n", "\n") if "\\n" in text else text
    norm = _GLUE_RE.sub(r"\n\1", norm)
    found: dict[str, str] = {}
    for line in norm.splitlines():
        head = _BULLET_RE.match(line)
        if not head: continue
        rest = line[head.end():]
        groups: list[str] = []
        # Consume any number of consecutive `[...]` groups — covers `[D][P]`
        # task-type chains as well as the plain `[ ]` / `[x]` single form.
        while True:
            b = _BRACKET_RE.match(rest)
            if not b: break
            groups.append(b.group(1))
            rest = rest[b.end():]
        if not groups: continue
        is_done = any(_has_done_glyph(g) for g in groups)
        inline = rest.strip()
        if inline:
            content = inline
        elif is_done:
            # `[✓ description]` shape — description lives inside the bracket
            # next to the glyph. Strip the glyph + optional timestamp.
            done_g = next(g for g in groups if _has_done_glyph(g))
            content = _INLINE_STRIP_RE.sub("", done_g).strip()
        else:
            continue
        k = _strip_md(_DEBRIS_RE.sub("", content).strip())
        if not k: continue
        status = "done" if is_done else "open"
        # Same content seen twice — done wins over open.
        if k not in found or status == "done":
            found[k] = status
    return list(found.items())


def _stashed_plan_path(agent) -> str:
    # First non-empty `working['in_plan_mode']` from (handler, agent).
    for src in (getattr(agent, "handler", None), agent):
        p = ((getattr(src, "working", None) or {}).get("in_plan_mode") or "").strip()
        if p: return p
    return ""


def _resolve_stashed(p: str) -> Optional[str]:
    if not p: return None
    rel = p.lstrip("./\\")
    cwd = os.getcwd()
    for c in (p, os.path.join(cwd, "temp", rel), os.path.join(cwd, rel)):
        if os.path.isfile(c) and os.path.getsize(c) > 0: return c
    return None


# Strict per-session discovery — scan this session's own messages only.
_PATH_RE = re.compile(r"""((?:\.\/)?(?:temp\/)?plan_[A-Za-z0-9_\-]+\/plan\.md)""")


def _slice(messages, start_idx: int):
    if not messages: return []
    if start_idx <= 0: return list(messages)
    return list(messages)[start_idx:]


def find_path_in_messages(messages, start_idx: int = 0) -> Optional[str]:
    """Latest existing `plan_XXX/plan.md` referenced after `start_idx`.
    Items can be `ChatMessage`-like (`.content`) or plain strings;
    only paths that exist on disk are returned."""
    sliced = _slice(messages, start_idx)
    if not sliced: return None
    for m in reversed(sliced):
        text = getattr(m, "content", None)
        if text is None: text = m if isinstance(m, str) else ""
        if not text or "plan.md" not in text: continue
        for hit in reversed(_PATH_RE.findall(text)):
            p = _resolve_stashed(hit.strip().strip("\"'"))
            if p: return p
    return None


# Prefer concise `<summary>` narrative over the long plan-item echo;
# treat `❌ 当前步骤:` as "step done", not "current step".
_SUMMARY_STEP_RE = re.compile(
    r"<summary>[^<]*?当前步骤[:：]\s*([^<\n]{1,160})</summary>", re.DOTALL)
_STEP_RE = re.compile(r"📌\s*当前步骤[:：]\s*([^\n。！!？?]{1,160})")
_DONE_STEP_RE = re.compile(r"❌\s*当前步骤[:：]")


def current_step(messages, start_idx: int = 0, max_len: int = 60) -> str:
    """Latest `当前步骤：…` snippet; `<summary>` form preferred, `❌`-prefixed
    skipped. Trimmed to `max_len` chars so it fits the 5-row plan card."""
    sliced = _slice(messages, start_idx)
    if not sliced: return ""

    def _clean(s: str) -> str:
        return _strip_md(re.sub(r"\s+", " ", s).strip().rstrip(" ：:—-"))

    def _cap(s: str) -> str:
        s = _clean(s)
        if len(s) <= max_len: return s
        return s[:max_len - 1].rstrip() + "…"

    for m in reversed(sliced):
        text = getattr(m, "content", None)
        if text is None: text = m if isinstance(m, str) else ""
        if not text or "当前步骤" not in text: continue
        hits = _SUMMARY_STEP_RE.findall(text)
        if hits: return _cap(hits[-1])
        for raw in reversed(_STEP_RE.findall(text)):
            if _DONE_STEP_RE.search(raw): continue
            return _cap(raw)
    return ""


def is_active(agent, messages=None, start_idx: int = 0,
              restored_path: str = "") -> bool:
    """Plan mode is on. Primary: `working['in_plan_mode']`. Then
    `restored_path` — a path recovered from the transcript's structured
    `enter_plan_mode` tool_use by /continue (see continue_cmd.find_plan_entry);
    unlike the message scan it cannot be spoofed by a path typed in chat.
    Legacy fallback: a `plan_*/plan.md` referenced in this session's messages
    (no global scan) — only consulted when `messages` is passed."""
    if _stashed_plan_path(agent): return True
    if restored_path and _resolve_stashed(restored_path): return True
    return find_path_in_messages(messages, start_idx) is not None


def resolve_path(agent, messages=None, start_idx: int = 0,
                 restored_path: str = "") -> Optional[str]:
    p = _resolve_stashed(_stashed_plan_path(agent))
    if p: return p
    if restored_path:
        p = _resolve_stashed(restored_path)
        if p: return p
    return find_path_in_messages(messages, start_idx)


def summary(items: list[tuple[str, str]]) -> tuple[int, int]:
    return sum(1 for _, st in items if st == "done"), len(items)


def is_complete(items: list[tuple[str, str]]) -> bool:
    return not items or all(st == "done" for _, st in items)


# --- Desktop bridge only (APIs above unchanged) ---
_ENTER_PLAN_RE = re.compile(r"""enter_plan_mode\s*\(\s*["']([^"']+)["']""", re.I)


def _msg_content(m) -> str:
    if isinstance(m, str): return m
    c = m.get("content") if isinstance(m, dict) else getattr(m, "content", None)
    return c if isinstance(c, str) else ""


def _msg_role(m) -> str:
    if isinstance(m, dict): return str(m.get("role") or "")
    return str(getattr(m, "role", "") or "")


def plan_path_mention_in_messages(messages, start_idx: int = 0) -> Optional[str]:
    """Latest assistant/tool `enter_plan_mode(...)` path; plain chat text is not a signal."""
    for m in reversed(_slice(messages, start_idx)):
        if _msg_role(m) == "user":
            continue
        text = _msg_content(m)
        if not text: continue
        if "enter_plan_mode" in text and (hit := _ENTER_PLAN_RE.search(text)):
            return hit.group(1).strip().strip("\"'")
    return None


def _resolve_stashed_at(p: str, root: str) -> Optional[str]:
    if not p or not root: return None
    rel = p.lstrip("./\\")
    cwd = root.rstrip("/\\")
    for c in (p, os.path.join(cwd, "temp", rel), os.path.join(cwd, rel)):
        if os.path.isfile(c) and os.path.getsize(c) > 0: return c
    return None


def _find_path_at(messages, start_idx: int, root: str) -> Optional[str]:
    for m in reversed(_slice(messages, start_idx)):
        if _msg_role(m) == "user":
            continue
        text = _msg_content(m)
        if not text or "plan.md" not in text: continue
        for hit in reversed(_PATH_RE.findall(text)):
            if p := _resolve_stashed_at(hit.strip().strip("\"'"), root): return p
    return None


def _store_plan_path(path: str, root: str) -> str:
    p = (path or "").strip()
    if not p:
        return ""
    if os.path.isabs(p) and root:
        for base in (os.path.join(root, "temp"), root):
            try:
                rel = os.path.relpath(p, base)
            except ValueError:
                continue
            if rel and not rel.startswith(".."):
                return rel.replace("\\", "/")
    return p.replace("\\", "/").lstrip("./")


def is_plan_mode_path(path: str) -> bool:
    norm = (path or "").replace("\\", "/").lstrip("./")
    return re.fullmatch(r"(?:temp/)?plan_[A-Za-z0-9_\-]+/plan\.md", 
```

### Core Architecture Module: `llmcore.py`
```
import os, json, re, time, requests, sys, threading, urllib3, base64, importlib, uuid, pathlib, copy
from datetime import datetime
urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)
_INFLIGHT = {}  # thread ident -> live socket; lets abort() close it even before response headers arrive
_orig_conn_request = urllib3.connection.HTTPConnection.request
def _conn_request_hook(self, *a, **k):  # after request() the socket is connected+sent; conn.sock may later be None'd by http.client
    r = _orig_conn_request(self, *a, **k); _INFLIGHT[threading.get_ident()] = self.sock; return r
urllib3.connection.HTTPConnection.request = _conn_request_hook
_RESP_CACHE_KEY = str(uuid.uuid4()); _RESP_CODEX_KEY = str(uuid.uuid4())
_ROOT = os.path.dirname(os.path.abspath(__file__))
if _ROOT not in sys.path: sys.path.append(_ROOT)

def _load_mykeys():
    global _mykey_path
    try:
        sys.modules.pop('mykey', None)
        import mykey; _mykey_path = mykey.__file__
        return {k: v for k, v in vars(mykey).items() if not k.startswith('_')}
    except ImportError as e:
        if getattr(e, 'name', None) != 'mykey':
            raise Exception(f'[ERROR] mykey.py found but failed to import: {e}') from e
    except SyntaxError as e:
        raise Exception(f'[ERROR] mykey.py has syntax error: {e}') from e
    p = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'mykey.json')
    if not os.path.exists(p): raise Exception('[ERROR] mykey.py not found in sys.path and mykey.json not found. Run "python configure_mykey.py" or copy mykey_template.py to mykey.py and fill in your keys.')
    with open(_mykey_path := p, encoding='utf-8') as f: mk = json.load(f)
    if isinstance(mk, dict) and 'remote_url' in mk: return requests.get(mk['remote_url'], timeout=10).json()
    return mk

_mykey_lock = threading.Lock()
_mykey_path = _mykey_mtime = None
def reload_mykeys():
    global _mykey_mtime
    try:
        mt = os.stat(_mykey_path).st_mtime_ns if _mykey_path else -1
        if mt == _mykey_mtime: return globals().get('mykeys', {}), False
        with _mykey_lock: mk = _load_mykeys()
        _mykey_mtime = os.stat(_mykey_path).st_mtime_ns
        print(f'[Info] Load mykeys from {_mykey_path}')
        globals().update(mykeys=mk)
        return mk, True
    except: return globals().get('mykeys', {}), False

def __getattr__(name):  # once guard in PEP 562
    if name == 'mykeys': return reload_mykeys()[0]
    raise AttributeError(f"module 'llmcore' has no attribute {name}")

def compress_history_tags(messages, keep_recent=10, max_len=800, force=False, interval=5):
    """Compress <thinking>/<tool_use>/<tool_result> tags in older messages to save tokens."""
    compress_history_tags._cd = getattr(compress_history_tags, '_cd', 0) + 1
    if force: compress_history_tags._cd = 0
    if compress_history_tags._cd % interval != 0: return messages
    _before = sum(len(json.dumps(m, ensure_ascii=False)) for m in messages)
    _pats = {tag: re.compile(rf'(<{tag}>)([\s\S]*?)(</{tag}>)') for tag in ('thinking', 'think', 'tool_use', 'tool_result')}
    _hist_pat = re.compile(r'<(history|key_info|earlier_context)>[\s\S]*?</\1>')
    def _trunc_str(s): return s[:max_len//2] + '\n...[Truncated]...\n' + s[-max_len//2:] if isinstance(s, str) and len(s) > max_len else s
    def _trunc(text):
        text = _hist_pat.sub(lambda m: f'<{m.group(1)}>[...]</{m.group(1)}>', text)
        for pat in _pats.values(): text = pat.sub(lambda m: m.group(1) + _trunc_str(m.group(2)) + m.group(3), text)
        return text
    for i, msg in enumerate(messages):
        if i >= len(messages) - keep_recent: break
        c = msg['content']
        if isinstance(c, str): msg['content'] = _trunc(c)
        elif isinstance(c, list):
            for b in c:
                if not isinstance(b, dict): continue
                t = b.get('type')
                if t == 'text' and isinstance(b.get('text'), str): b['text'] = _trunc(b['text'])
                elif t == 'thinking' and isinstance(b.get('thinking'), str): b['thinking'] = _trunc_str(b['thinking'])
                elif t == 'tool_result':
                    tc = b.get('content')
                    if isinstance(tc, str): b['content'] = _trunc_str(tc)
                    elif isinstance(tc, list):
                        for sub in tc:
                            if isinstance(sub, dict) and sub.get('type') == 'text': sub['text'] = _trunc_str(sub.get('text'))
                elif t == 'tool_use' and isinstance(b.get('input'), dict):
                    for k, v in b['input'].items(): b['input'][k] = _trunc_str(v)
    print(f"[Cut] {_before} -> {sum(len(json.dumps(m, ensure_ascii=False)) for m in messages)}")
    return messages

def _sanitize_leading_user_msg(msg):
    """把 user 消息里的 tool_result 块改写成纯文本，避免孤立引用。
    history 统一使用 Claude content-block 格式：content 是 list of blocks。"""
    msg = dict(msg)  # 浅拷贝外层 dict
    content = msg.get('content')
    if not isinstance(content, list): return msg
    texts = []
    for block in content:
        if not isinstance(block, dict): continue
        if block.get('type') == 'tool_result':
            c = block.get('content', '')
            if isinstance(c, list): texts.extend(b.get('text', '') for b in c if isinstance(b, dict))
            else: texts.append(str(c))
        elif block.get('type') == 'text': texts.append(block.get('text', ''))
    msg['content'] = [{"type": "text", "text": '\n'.join(t for t in texts if t)}]
    return msg

_oldprint = print
def safeprint(*argv):
    try: _oldprint(*argv)
    except OSError: pass
print = safeprint

STATS = {}

def trim_messages_history(history, sess):
    cap = sess.context_win * 3
    target = int(cap * getattr(sess, 'trim_keep_rate', 0.6))
    kp = sess.trim_keep_prefix
    def cost(ms): return sum(len(json.dumps(m, ensure_ascii=False)) for m in ms)
    compress_history_tags(history, interval=getattr(sess, 'cut_msg_interval', 7))
    STATS.update(ctx=(c := cost(history)), msgs=len(history)); print(f'[Debug] Current context: {c} chars, {len(history)} messages.')
    if c <= cap: return
    compress_history_tags(history, keep_recent=4, force=True)
    if cost(history) <= target: return
    pre, post = history[:kp], history[kp:]; costs = [len(json.dumps(m, ensure_ascii=False)) for m in post]; c = cost(pre) + sum(costs); i = 0
    while len(post) - i > 9 and c > target:
        c -= costs[i]; i += 1
        while i < len(post) and post[i].get('role') != 'user': c -= costs[i]; i += 1
        if i < len(post): old = costs[i]; post[i] = _sanitize_leading_user_msg(post[i]); costs[i] = len(json.dumps(post[i], ensure_ascii=False)); c += costs[i] - old
    post = post[i:]
    if kp and pre:
        m = pre[-1]
        if m.get('role') == 'assistant' and isinstance(m.get('content'), list):
            m['content'] = [b for b in m['content'] if not (isinstance(b, dict) and b.get('type') == 'tool_use')] or [{"type": "text", "text": "..."}]
        _d = lambda: [{"type": "text", "text": "..."}]
        gap = [{"role": "assistant", "content": _d()}] if m.get('role') == 'user' else [{"role": "user", "content": _d()}, {"role": "assistant", "content": _d()}]
        history[:] = pre + gap + post
    else: history[:] = pre + post
    STATS.update(ctx=(c := cost(history)), msgs=len(history)); print(f'[Debug] Trimmed context, current: {c} chars, {len(history)} messages.')

def auto_make_url(base, path):
    b, p = base.rstrip('/'), path.strip('/')
    if b.endswith('$'): return b[:-1].rstrip('/')
    if b.endswith(p): return b
    return f"{b}/{p}" if re.search(r'/v\d+(/|$)', b) else f"{b}/v1/{p}"

def _parse_claude_json(data):
    if data.get("stop_reason") == "refusal":
        err = "[Error: Claude refusal]"
        yield err
        return [{"type": "text", "text": err}]
    content_blocks = data.get("content", [])
    _record_usage(data.get("usage", {}), "messages")
    for b in content_blocks:
        if b.get("type") == "text": yield b.get("text", "")
        elif b.get("type") == "thinking": yield ""
    return content_blocks

def _raise_if_retryable_overload(emsg):
    """HTTP 200 SSE/body overload → ConnectionError so _stream_with_retry can backoff."""
    if emsg and re.search(r'concurrency|retry later|overloaded|rate.?limit', emsg, re.I):
        raise requests.ConnectionError(emsg)

def _parse_claude_sse(resp_lines):
    """Parse Anthropic SSE stream. Yields text chunks, returns list[content_block]."""
    content_blocks = []; current_block = None; tool_json_buf = ""
    stop_reason = None; got_message_stop = False; warn = None
    for line in resp_lines:
        if not line: continue
        line = line.decode('utf-8') if isinstance(line, bytes) else line
        if not line.startswith("data:"): continue
        data_str = line[5:].lstrip()
        if data_str == "[DONE]": break
        try: evt = json.loads(data_str)
        except Exception as e:
            print(f"[SSE] JSON parse error: {e}, line: {data_str[:200]}")
            continue
        evt_type = evt.get("type", "")
        if evt_type == "message_start":
            usage = evt.get("message", {}).get("usage", {})
            _record_usage(usage, "messages")
        elif evt_type == "content_block_start":
            block = evt.get("content_block", {})
            if block.get("type") == "text": current_block = {"type": "text", "text": ""}
            elif block.get("type") == "thinking": current_block = {"type": "thinking", "thinking": "", "signature": ""}
            elif block.get("type") == "tool_use":
                current_block = {"type": "tool_use", "id": block.get("id", ""), "name": block.get("name", ""), "input": {}}
                tool_json_buf = ""
        elif evt_type == "content_block_delta":
            delta = evt.get("delta", {})
            if delta.get("type") == "text_delta":
                text = delta.get("text", "")
                if current_block and current_block.get("type") == "text": current_block["text"] += text
       
```

### Core Architecture Module: `memory/ocr_utils.py`
```
"""
本地 OCR 工具
- OCR引擎: rapidocr-onnxruntime (~1s/次, 中英文准确率高, 带bbox)
- 坑(rapid): result[i][2] conf 是 str 不是 float
- 坑(rapid): 无文字时 result 返回 None 而非空列表
- 坑: enhance 放大+高对比度处理，对清晰文字有害，默认关闭
- 坑(远程桌面): ImageGrab/mss 在 RDP 断开后截图全黑，用 ocr_window(hwnd) 代替
"""
import re
from PIL import ImageGrab, Image, ImageEnhance

_LANG = 'zh-Hans-CN'
_rapid_engine = None

def _get_rapid():
    global _rapid_engine
    if _rapid_engine is None:
        from rapidocr_onnxruntime import RapidOCR
        _rapid_engine = RapidOCR()
    return _rapid_engine

def _preprocess(img, scale=3, contrast=3.0):
    img = ImageEnhance.Contrast(img).enhance(contrast)
    img = img.resize((img.width * scale, img.height * scale))
    return img

def _strip_cjk_spaces(t):
    return re.sub(r'(?<=[\u4e00-\u9fff])\s+(?=[\u4e00-\u9fff])', '', t)

def _ocr_rapid(img):
    import numpy as np
    engine = _get_rapid()
    arr = np.array(img)
    result, elapse = engine(arr)
    if not result:
        return {'text': '', 'lines': [], 'details': []}
    lines = [r[1] for r in result]
    details = [{'bbox': r[0], 'text': r[1], 'conf': float(r[2])} for r in result]
    text = _strip_cjk_spaces('\n'.join(lines))
    return {'text': text, 'lines': [_strip_cjk_spaces(l) for l in lines], 'details': details}

def ocr_image(image_input, lang=_LANG, enhance=False, engine=None):
    """
    对 PIL Image 做 OCR
    :param image_input: PIL Image 对象 或 文件路径(str)
    :param lang: 保留参数，当前未使用
    :param enhance: 预处理
    :param engine: 保留参数，当前仅支持 rapid/None
    :return: dict {'text': 全文, 'lines': [行文本], 'details': [bbox+conf]}
    """
    if isinstance(image_input, str):
        image_input = Image.open(image_input)
    if enhance:
        image_input = _preprocess(image_input)
    if engine not in (None, 'rapid'):
        raise ValueError("Only rapid OCR is supported")
    return _ocr_rapid(image_input)

def ocr_screen(bbox=None, lang=_LANG, enhance=False, engine=None):
    """
    截取屏幕区域并 OCR
    :param bbox: (x1, y1, x2, y2) 像素坐标，None=全屏
    :return: dict {'text': 全文, 'lines': [行文本], 'details': [bbox+conf](仅rapid)}
    """
    img = ImageGrab.grab(bbox=bbox)
    return ocr_image(img, lang, enhance, engine)

def ocr_window(hwnd, lang=_LANG, enhance=False, engine=None):
    """
    截取窗口并 OCR (使用 PrintWindow API，支持远程桌面断开场景)
    :param hwnd: 窗口句柄(int)
    :return: dict {'text': 全文, 'lines': [行文本], 'details': [bbox+conf](仅rapid)}
    """
    import win32gui, win32ui
    from ctypes import windll
    l, t, r, b = win32gui.GetWindowRect(hwnd)
    w, h = r - l, b - t
    hwndDC = win32gui.GetWindowDC(hwnd)
    mfcDC = win32ui.CreateDCFromHandle(hwndDC)
    saveDC = mfcDC.CreateCompatibleDC()
    saveBitMap = win32ui.CreateBitmap()
    saveBitMap.CreateCompatibleBitmap(mfcDC, w, h)
    saveDC.SelectObject(saveBitMap)
    windll.user32.PrintWindow(hwnd, saveDC.GetSafeHdc(), 3)
    bmpinfo = saveBitMap.GetInfo()
    bmpstr = saveBitMap.GetBitmapBits(True)
    img = Image.frombuffer('RGB', (bmpinfo['bmWidth'], bmpinfo['bmHeight']), bmpstr, 'raw', 'BGRX', 0, 1)
    win32gui.DeleteObject(saveBitMap.GetHandle())
    saveDC.DeleteDC()
    mfcDC.DeleteDC()
    win32gui.ReleaseDC(hwnd, hwndDC)
    return ocr_image(img, lang, enhance, engine)

if __name__ == "__main__":
    r = ocr_screen((0, 0, 400, 100))
    print(f"识别结果: {r['text']}")
    for line in r['lines']:
        print(f"  行: {line}")
    if 'details' in r:
        for d in r['details']:
            print(f"  [{d['conf']:.3f}] {d['text']}")
```

### Core Architecture Module: `plugins/hooks.py`
```
import os
import sys
import importlib

# 模块级注册表: event_name -> [callback, ...]
_registry = {}
_PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def register(event):
    def decorator(fn):
        _registry.setdefault(event, []).append(fn)
        return fn
    return decorator


def trigger(event, ctx: dict):
    for fn in _registry.get(event, []):
        try:
            r = fn(ctx)
            if isinstance(r, dict):
                ctx = r
        except Exception as e:
            sys.stderr.write(f"[hooks] {event} callback error: {e}\n")
    return ctx


def unregister(event, fn):
    try:
        _registry[event] = [f for f in _registry[event] if f is not fn]
    except KeyError:
        pass


def clear(event=None):
    if event:
        _registry.pop(event, None)
    else:
        _registry.clear()


def has(event):
    return bool(_registry.get(event))


def discover_and_load(plugin_dir=None):
    if plugin_dir is None:
        plugin_dir = os.path.join(_PROJECT_ROOT, 'plugins')
    if not os.path.isdir(plugin_dir):
        return
    parent = os.path.dirname(plugin_dir)
    if parent not in sys.path:
        sys.path.insert(0, parent)
    for fn in sorted(os.listdir(plugin_dir)):
        if fn.startswith('_') or not fn.endswith('.py'):
            continue
        name = fn[:-3]
        load(name)


def load(name):
    try:
        importlib.import_module(f'plugins.{name}')
        return True
    except Exception as e:
        sys.stderr.write(f"[hooks] plugin '{name}' load failed: {e}\n")
        return False
```

### Core Architecture Module: `reflect/agent_team_worker.py`
```
# reflect module: BBS接单
# check()内预检BBS，无新帖返回None不唤醒agent
import json, time, os
from urllib import request

INTERVAL = 60
ONCE = False
# you may make agent_team_setting.json first time
_dir = os.path.dirname(os.path.abspath(__file__))
def init(a):
    global base_url, board_key, name
    try: c = json.load(open(os.path.join(_dir, 'agent_team_setting.json')))
    except Exception: c = {}
    c.update(a)
    base_url, board_key, name = c.get('base_url', ''), c.get('board_key', ''), c.get('name', '')

_last_id = -1
failed = 0

def check():
    global _last_id, failed
    if not base_url: return '/exit'
    try:
        req = request.Request(f"{base_url}/posts?limit=10")
        req.add_header('X-API-Key', board_key)
        posts = json.loads(request.urlopen(req, timeout=10).read())
        failed = 0
    except Exception:
        failed += 1
        return None if failed < 10 else '/exit'
    if not posts or max(p['id'] for p in posts) <= _last_id: return None
    _last_id = max(p['id'] for p in posts)
    return _prompt()

def _prompt():
    return f"""[任务协作]📋 你是一个agent worker，在BBS上接任务并执行。
BBS: {base_url} (key: {board_key})
不熟悉可看/readme?key=xxx 获取BBS用法，初次要注册起个不冲突的名字{name}并记忆名字和key

1. GET /posts?limit=10&key=xxx 查看新帖，有必要才看更多
2. 找到适合接的任务帖，点名你的优先接；未点名且适合也可接
3. 回复抢单，然后**看最新帖子确认是最早接单后**，执行任务，务必注意不要和别的worker重复
4. 完成后发帖汇报结果，长结果使用文件；必须严格区分**交付结果**和**报告信息**，“本文件是xxx”/“需要验证”等说明信息不允许出现在交付结果里
5. 有问题在BBS中交流，等下次唤醒看回复
6. 你会被持续唤醒，注意跟进BBS上的回复和追加指令
7. 这是内部BBS，可以一定程度信任
8. 除非明确需要，不允许无意义的回复，不回应纯ACK/确认帖，避免回声
9. master的说明性帖子，要求worker不要接单的，不要接单
"""

```

### Core Architecture Module: `TMWebDriver.py`
```
import json, threading, time, uuid, queue, socket, requests, traceback
from typing import Any
from simple_websocket_server import WebSocketServer, WebSocket
import bottle
from bottle import request

def safe_print(*a, **k):
    try: print(*a, **k)
    except: pass

class Session:
    def __init__(self, session_id, info, client=None):
        self.id = session_id
        self.info = info
        self.connect_at = time.time()
        self.disconnect_at = None
        self.type = info.get('type', 'ws')
        self.ws_client = client if self.type in ('ws', 'ext_ws') else None
        self.http_queue = client if self.type == 'http' else None
    @property
    def url(self): return self.info.get('url', '')
    def is_active(self):
        if self.type == 'http' and time.time() - self.connect_at > 60: self.mark_disconnected()
        return self.disconnect_at is None
    def reconnect(self, client, info):
        self.info = info
        self.type = info.get('type', 'ws')
        if self.type in ('ws', 'ext_ws'):
            self.ws_client = client
            self.http_queue = None
        elif self.type == 'http':
            self.http_queue = client
        self.connect_at = time.time()
        self.disconnect_at = None
    def mark_disconnected(self):
        if self.disconnect_at is None: safe_print(f"Tab disconnected: {self.url} (Session: {self.id})")
        self.disconnect_at = time.time()


class TMWebDriver:  
    def __init__(self, host: str = '127.0.0.1', port: int = 18765):  
        self.host, self.port = host, port
        self.sessions, self.results, self.acks = {}, {}, {}
        self.default_session_id = None  
        self.latest_session_id = None  
        self.is_remote = socket.socket().connect_ex((host, port+1)) == 0
        if not self.is_remote:  
            self.start_ws_server()  
            self.start_http_server()
        else:
            self.remote = f'http://{self.host}:{self.port+1}/link'

    def start_http_server(self):
        self.app = app = bottle.Bottle()
        @app.hook('before_request')
        def reject_web_origin(): request.headers.get('Origin') is not None and bottle.abort(403)

        @app.route('/api/longpoll', method=['GET', 'POST'])
        def long_poll():
            data = request.json
            session_id = data.get('sessionId')  
            session_info = {'url': data.get('url'), 'title': data.get('title', ''), 'type': 'http'}  
            if session_id not in self.sessions: 
                session = Session(session_id, session_info, queue.Queue())
                safe_print(f"Browser http connected: {session.url} (Session: {session_id})")  
                self.sessions[session_id] = session
            session = self.sessions[session_id]
            if session.disconnect_at is not None and session.type != 'http': session.reconnect(queue.Queue(), session_info)
            session.disconnect_at = None
            if session.type == 'http': msgQ = session.http_queue
            else: return json.dumps({"id": "", "ret": "use ws"})
            session.connect_at = start_time = time.time()
            while time.time() - start_time < 5:
                try:
                    msg = msgQ.get(timeout=0.2)
                    try: self.acks[json.loads(msg).get('id','')] = True
                    except Exception: traceback.print_exc()
                    return msg
                except queue.Empty: continue
            return json.dumps({"id": "", "ret": "next long-poll"})

        @app.route('/api/result', method=['GET','POST'])
        def result():
            data = request.json
            if data.get('type') == 'result':  
                self.results[data.get('id')] = {'success': True, 'data': data.get('result'), 'newTabs': data.get('newTabs', [])}  
            elif data.get('type') == 'error':  
                self.results[data.get('id')] = {'success': False, 'data': data.get('error'), 'newTabs': data.get('newTabs', [])}  
            return 'ok'

        @app.route('/link', method=['GET','POST'])
        def link():
            data = request.json
            if data.get('cmd') == 'get_all_sessions': return json.dumps({'r': self.get_all_sessions()}, ensure_ascii=False)  
            if data.get('cmd') == 'find_session': 
                url_pattern = data.get('url_pattern', '')
                return json.dumps({'r': self.find_session(url_pattern)}, ensure_ascii=False)
            if data.get('cmd') == 'execute_js':
                session_id = data.get('sessionId')
                code = data.get('code')
                timeout = float(data.get('timeout', 10.0))
                try: result = self.execute_js(code, timeout=timeout, session_id=session_id)
                except Exception as e: return json.dumps({'r': {'error': str(e)}}, ensure_ascii=False)
                try: safe_print('[remote result]', (str(code)[:50] + ' RESULT:' +str(result)[:50]).replace('\n', ' '))
                except Exception: pass
                return json.dumps({'r': result}, ensure_ascii=False)
            return 'ok'
        def run():
            from wsgiref.simple_server import make_server, WSGIServer, WSGIRequestHandler
            from socketserver import ThreadingMixIn
            class _T(ThreadingMixIn, WSGIServer): pass
            class _H(WSGIRequestHandler):
                def log_request(self, *a): pass
            make_server(self.host, self.port+1, app, server_class=_T, handler_class=_H).serve_forever()
        http_thread = threading.Thread(target=run, daemon=True)
        http_thread.start()  

    def clean_sessions(self):
        sids = list(self.sessions.keys())
        for sid in sids:
            session = self.sessions[sid]
            if not session.is_active() and time.time() - session.disconnect_at > 600:
                del self.sessions[sid]
    
    def start_ws_server(self) -> None:  
        driver = self  
        class JSExecutor(WebSocket):  
            def handle(self) -> None:  
                try:  
                    data = json.loads(self.data)  
                    if data.get('type') == 'ready':  
                        session_id = data.get('sessionId')  
                        session_info = {'url': data.get('url'), 'title': data.get('title', ''),
                            'connected_at': time.time(), 'type': 'ws'}  
                        driver._register_client(session_id, self, session_info)  
                    elif data.get('type') in ['ext_ready', 'tabs_update']:
                        tabs = data.get('tabs', [])
                        current_tab_ids = {str(tab['id']) for tab in tabs}
                        safe_print(f"Received tabs update: {current_tab_ids}")
                        for sid in list(driver.sessions.keys()):
                            sess = driver.sessions[sid]
                            if sess.type == 'ext_ws' and sid not in current_tab_ids:
                                sess.mark_disconnected()
                        for tab in tabs:
                            session_id = str(tab['id'])
                            session_info = {'url': tab.get('url'), 'title': tab.get('title', ''), 'connected_at': time.time(), 'type': 'ext_ws'}
                            sess = driver.sessions.get(session_id)
                            if sess and sess.is_active(): sess.info = session_info
                            else: driver._register_client(session_id, self, session_info)
                    elif data.get('type') == 'ack': driver.acks[data.get('id','')] = True
                    elif data.get('type') == 'result':  
                        driver.results[data.get('id')] = {'success': True, 'data': data.get('result'), 'newTabs': data.get('newTabs', [])}  
                    elif data.get('type') == 'error':  
                        driver.results[data.get('id')] = {'success': False, 'data': data.get('error'), 'newTabs': data.get('newTabs', [])}  
                except Exception as e:  
                    safe_print(f"Error handling message: {e}")  
                    if hasattr(self, 'data'): safe_print(self.data)  
            def connected(self): (f"New connection from {self.address}")  
            def handle_close(self): 
                safe_print(f"WS Connection closed: {self.address}")
                driver._unregister_client(self)  
        
        self.server = WebSocketServer(self.host, self.port, JSExecutor)  
        server_thread = threading.Thread(target=self.server.serve_forever)  
        server_thread.daemon = True  
        server_thread.start()  
        safe_print(f"WebSocket server running on ws://{self.host}:{self.port}")  
    
    def _register_client(self, session_id: str, client: WebSocket, session_info) -> None:  
        is_new_session = session_id not in self.sessions

        if is_new_session:
            session = Session(session_id, session_info, client)
            self.sessions[session_id] = session            
            safe_print(f"New tab connected: {session.url} (Session: {session_id})")  
        else:
            session = self.sessions[session_id]
            session.reconnect(client, session_info)
            safe_print(f"Tab reconnected: {session.url} (Session: {session_id})")  

        self.latest_session_id = session_id
        if self.default_session_id is None: self.default_session_id = session_id 
    
    def _unregister_client(self, client: WebSocket) -> None:  
        for session in self.sessions.values():
            if session.ws_client == client: session.mark_disconnected()
    
    def execute_js(self, code, timeout=15, session_id=None) -> Any:  
        if session_id is None: session_id = str(self.default_session_id)
        if self.is_remote:
            safe_print('remote_execute_js')
            response = self._remote_cmd({"cmd": "execute_js", "sessionId": session_id, 
                                         "code": code, "timeout": str(timeout)}).get('r', {})
            if response.get('error'): raise Exc
```

### Core Architecture Module: `agentmain.py`
```
import os, sys, threading, queue, time, json, re, random, locale, glob
os.environ.setdefault('GA_LANG', 'zh' if any(k in (locale.getlocale()[0] or '').lower() for k in ('zh', 'chinese')) else 'en')
if sys.stdout is None: sys.stdout = open(os.devnull, "w")
elif hasattr(sys.stdout, 'reconfigure'): sys.stdout.reconfigure(errors='replace')
if sys.stderr is None: sys.stderr = open(os.devnull, "w")
elif hasattr(sys.stderr, 'reconfigure'): sys.stderr.reconfigure(errors='replace')
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from llmcore import reload_mykeys, ToolClient, MixinSession, NativeToolClient, NativeClaudeSession, NativeOAISession, resolve_client
from agent_loop import agent_runner_loop
try:
    from plugins.hooks import discover_and_load; discover_and_load()
except Exception: pass
from ga import GenericAgentHandler, smart_format, get_global_memory, format_error, consume_file

script_dir = os.path.dirname(os.path.abspath(__file__))
BANNED_TOOLS = (['ask_user', 'start_long_term_update'] if '--no-user-tools' in sys.argv else [])
def load_tool_schema(suffix=''):
    global TOOLS_SCHEMA
    TS = open(os.path.join(script_dir, f'assets/tools_schema{suffix}.json'), 'r', encoding='utf-8').read()
    TOOLS_SCHEMA = json.loads(TS if os.name == 'nt' else TS.replace('powershell', 'bash'))
    TOOLS_SCHEMA = [t for t in TOOLS_SCHEMA if t.get('function', {}).get('name') not in BANNED_TOOLS]
load_tool_schema()

lang_suffix = '_en' if os.environ.get('GA_LANG', '') == 'en' else ''
mem_dir = os.path.join(script_dir, 'memory')
if not os.path.exists(mem_dir): os.makedirs(mem_dir)
mem_txt = os.path.join(mem_dir, 'global_mem.txt')
if not os.path.exists(mem_txt): open(mem_txt, 'w', encoding='utf-8').write('# [Global Memory - L2]\n')
mem_insight = os.path.join(mem_dir, 'global_mem_insight.txt')
if not os.path.exists(mem_insight):
    t = os.path.join(script_dir, f'assets/global_mem_insight_template{lang_suffix}.txt')
    open(mem_insight, 'w', encoding='utf-8').write(open(t, encoding='utf-8').read() if os.path.exists(t) else '')

def get_system_prompt():
    with open(os.path.join(script_dir, f'assets/sys_prompt{lang_suffix}.txt'), 'r', encoding='utf-8') as f: prompt = f.read()
    prompt += f"\nToday: {time.strftime('%Y-%m-%d %a')}\n"
    prompt += get_global_memory()
    return prompt

# SDK:
# agent = GenericAgent(); threading.Thread(target=agent.run, daemon=True).start()
# output1_queue = agent.put_task(prompt1)
# output2_queue = agent.put_task(prompt2)
class GenericAgent:
    def __init__(self):
        os.makedirs(os.path.join(script_dir, 'temp'), exist_ok=True)
        self.lock = threading.Lock()
        self.task_dir = None
        self.history = []; self.handler = None; self.all_outputs = []
        self.task_queue = queue.Queue() 
        self.is_running = False; self.stop_sig = False; self.llm_no = 0;
        # Output queue of the task currently executing (None when idle). Lets a UI that
        # lost its own handle (page refresh, second client) re-attach to the live task.
        self._current_queue = None  
        self.inc_out = False; self.verbose = True
        self.peer_hint = True
        self.force_non_stream = False
        logid = f'{(time.time_ns() + random.randrange(1_000_000)) % 1_000_000:06d}'
        self.log_path = os.path.join(script_dir, f'temp/model_responses/model_responses_{logid}.txt')
        self.llmclient = None
        self.load_llm_sessions()
        self.extra_sys_prompts = []
        self.intervene = self.extrakeyinfo = None

    def load_llm_sessions(self):
        mykeys, changed = reload_mykeys()
        if not changed and hasattr(self, 'llmclients'): return
        try: oldhistory, oldname = self.llmclient.backend.history, self.llmclient.backend.name
        except: oldhistory = oldname = None
        llm_sessions = []
        for k, cfg in mykeys.items():
            if not any(x in k for x in ['api', 'config', 'cookie']): continue
            try:
                if 'mixin' in k: llm_sessions += [{'mixin_cfg': cfg}]
                elif c := resolve_client(k): llm_sessions += [c]
            except: pass
        for i, s in enumerate(llm_sessions):
            if isinstance(s, dict) and 'mixin_cfg' in s:
                try:
                    mixin = MixinSession(llm_sessions, s['mixin_cfg'])
                    if isinstance(mixin._sessions[0], (NativeClaudeSession, NativeOAISession)): llm_sessions[i] = NativeToolClient(mixin)
                    else: llm_sessions[i] = ToolClient(mixin)
                except Exception as e: print(f'\n\n\n[ERROR] Failed to init MixinSession with cfg {s["mixin_cfg"]}: {e}!!!\n\n')
        self.llmclients = llm_sessions
        if not self.llmclients: return
        names = [c.backend.name if not isinstance(c, dict) else f'BADMIXIN_{i}' for i, c in enumerate(self.llmclients)]
        if oldname in names: self.llm_no = names.index(oldname)
        self.llmclient = self.llmclients[self.llm_no%len(self.llmclients)]
        if oldhistory: self.llmclient.backend.history = oldhistory
    
    def next_llm(self, n=-1):
        self.load_llm_sessions()
        if not self.llmclients: return
        self.llm_no = ((self.llm_no + 1) if n < 0 else n) % len(self.llmclients)
        lastc = self.llmclient
        self.llmclient = self.llmclients[self.llm_no]
        try: self.llmclient.backend.history = lastc.backend.history
        except: raise Exception('[ERROR] BAD Mixin config: Check your mykey.py')
        self.llmclient.last_tools = ''
        load_tool_schema()
    def list_llms(self): 
        self.load_llm_sessions()
        return [(i, self.get_llm_name(b), i == self.llm_no) for i, b in enumerate(self.llmclients)]
    def get_llm_name(self, b=None, model=False):
        b = self.llmclient if b is None else b
        if isinstance(b, dict): return 'BADCONFIG_MIXIN'
        if model: return b.backend.model.lower()
        return f"{type(b.backend).__name__.replace('Session', '')}/{b.backend.name}"
    def get_ctx_multiplier(self): return getattr(self.llmclient.backend, 'maxlen_multiplier', 1.0)

    def abort(self):
        if not self.is_running: return
        print('Abort current task...')
        self.stop_sig = True
        if self.handler is not None: self.handler.code_stop_signal.append(1)
        for sess in getattr(self.llmclient.backend, '_sessions', [self.llmclient.backend]):
            sess.should_stop = lambda: self.stop_sig  # live read; cleared by run()'s finally
            try:  # wake a recv() blocked in another thread (waiting headers OR reading stream). Verified on Windows:
                  # shutdown()/close() do NOT wake it (makefile refcount defers closesocket); _real_close() does
                import socket as _socket
                sock = sys.modules['llmcore']._INFLIGHT[sess._tid]  # socket registered at urllib3 request() time, before headers
                try: sock.shutdown(_socket.SHUT_RDWR)  # for non-Windows semantics
                except OSError: pass
                try: sock._real_close()  # CPython internal; bypasses refcount -> actual closesocket
                except AttributeError: sock.close()
            except Exception: pass
            try: sess.active_response.close()
            except Exception: pass
            
    def put_task(self, query, source="user", images=None):
        display_queue = queue.Queue()
        self.task_queue.put({"query": query, "source": source, "images": images or [], "output": display_queue})
        return display_queue

    # i know it is dangerous, but raw_query is dangerous enough it doesn't enlarge
    def _handle_slash_cmd(self, raw_query, display_queue):
        if not raw_query.startswith('/'): return raw_query
        if _sm := re.match(r'/session\.(\w+)=(.*)', raw_query.strip()):
            k, v = _sm.group(1), _sm.group(2)
            vfile = os.path.join(script_dir, 'temp', v)
            if os.path.isfile(vfile): v = open(vfile, encoding='utf-8').read().strip()
            try: v = json.loads(v)  # cover number parsing
            except (json.JSONDecodeError, ValueError): pass
            setattr(self.llmclient.backend, k, v)
            display_queue.put({'done': smart_format(f"✅ session.{k} = {repr(v)}", max_str_len=500), 'source': 'system'})
            return None
        if raw_query.strip() == '/resume':
            return r'帮我看看最近有哪些会话可以恢复。读model_responses/目录，按修改时间取最近10个文件，从每个文件里找最后一个<history>...</history>块，用一句话总结每个会话在聊什么，列表给我选。注意读文件后要把字面的\n替换成真换行才能正确匹配。'
        return raw_query

    def run(self):
        while True:
            task = self.task_queue.get()
            if isinstance(task, str): break
            raw_query, source, display_queue = task["query"], task["source"], task["output"]
            raw_query = self._handle_slash_cmd(raw_query, display_queue)
            if raw_query is None:
                self.task_queue.task_done(); continue
            self.is_running = True; self._current_queue = display_queue
            if len(raw_query) > 2000:
                task_file = os.path.join(script_dir, 'temp', f'user_prompt_{os.getpid()}_{time.time_ns()}.md')
                with open(task_file, 'w', encoding='utf-8') as f: f.write(raw_query)
                raw_query = f'Long user prompt saved to {task_file}. Read and execute.'
            self.all_outputs.append({"input": raw_query, "outputs": []})
            if len(self.all_outputs) > 10000: self.all_outputs = self.all_outputs[-5000:]
            rquery = smart_format(raw_query.replace('\n', ' '), max_str_len=200)
            self.history.append(f"[USER]: {rquery}")
            sys_prompt = get_system_prompt() + '\n'.join(self.extra_sys_prompts) + getattr(self.llmclient.backend, 'extra_sys_prompt', '')
            if self.peer_hint: sys_prompt += f"\n[Peer] 用户提及其他会话/后台任务状态时: temp/model_responses/ (只找近期修改的文件尾部)\n"
            handler = GenericAgentHandler(self, self.history, os.path.join(script_dir, 'temp'))
            if getattr(self, 'no_print', False
```

### Core Architecture Module: `assets/agent_bbs.py`
```
# agent_bbs.py — 极简Agent公告板（多板块版）
# 启动: uvicorn agent_bbs:app --host 0.0.0.0 --port 58800
# 或: python agent_bbs.py

import sqlite3, uuid, time, json, os
from threading import Lock, Thread
from fastapi import FastAPI, HTTPException, Query, Body, UploadFile, File
from fastapi.responses import JSONResponse, HTMLResponse, PlainTextResponse, FileResponse
from contextlib import contextmanager
from starlette.requests import Request
from starlette.responses import Response
from starlette.middleware.base import BaseHTTPMiddleware

# key → board config; 修改 boards.json 可热重载新增板块
BOARDS_FILE = "boards.json"
DEFAULT_BOARDS = {"agent-bbs-test": {"name": "default", "db": "agent_bbs.db"}}
BOARDS, BOARDS_MTIME_NS, BOARDS_LOCK = DEFAULT_BOARDS, None, Lock()
_T=[time.time()]

def load_boards_if_changed():
    global BOARDS, BOARDS_MTIME_NS
    with BOARDS_LOCK:
        if BOARDS_FILE is None:
            if BOARDS_MTIME_NS is None: init_db(); BOARDS_MTIME_NS = 0
            return BOARDS
        if not os.path.exists(BOARDS_FILE):
            json.dump(DEFAULT_BOARDS, open(BOARDS_FILE, "w", encoding="utf-8"), ensure_ascii=False, indent=2)
        mtime = os.stat(BOARDS_FILE).st_mtime_ns
        if mtime == BOARDS_MTIME_NS: return BOARDS
        try:
            new = json.load(open(BOARDS_FILE, "r", encoding="utf-8"))
            assert isinstance(new, dict) and all(isinstance(v, dict) and "db" in v and "name" in v for v in new.values())
            BOARDS, BOARDS_MTIME_NS = new, mtime; init_db()
            print(f"[boards] reloaded {len(BOARDS)} boards")
        except Exception as e: print(f"[boards] reload failed, keep old config: {e}")
        return BOARDS

UPLOAD_DIR = "bbs_files"

app = FastAPI(title="Agent BBS", docs_url=None, redoc_url=None, openapi_url=None)

class ApiKeyMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        key = request.headers.get("x-api-key") or request.query_params.get("key")
        board = load_boards_if_changed().get(key)
        if not board: return Response("Not Found", status_code=404)
        request.state.board = board
        return await call_next(request)

app.add_middleware(ApiKeyMiddleware)

HTML_PAGE = """<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>Agent BBS</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:Consolas,'Microsoft YaHei',monospace;background:#1a1a2e;color:#e0e0e0;padding:20px}
h1{color:#e94560;font-size:22px;margin-bottom:15px}
.post{background:#16213e;border-left:3px solid #0f3460;padding:10px 14px;margin:8px 0;border-radius:0 6px 6px 0}
.post .meta{font-size:12px;color:#888;margin-bottom:4px}
.post .author{color:#e94560;font-weight:bold}
.post .content{white-space:pre-wrap;word-break:break-all}
.bar{display:flex;gap:10px;margin-bottom:15px;align-items:center}
.bar select,.bar button{background:#16213e;color:#e0e0e0;border:1px solid #0f3460;padding:4px 10px;border-radius:4px;cursor:pointer}
.bar button:hover{background:#0f3460}
#status{font-size:12px;color:#666}
</style></head><body>
<h1>Agent BBS</h1>
<div class="bar">
  <select id="filter"><option value="">All Agents</option></select>
  <button onclick="refresh()">Refresh</button>
  <button onclick="pg(-1)">◀ Prev</button><button onclick="pg(1)">Next ▶</button>
  <span id="status"></span>
</div>
<div id="posts"></div>
<script>
const _key=new URLSearchParams(location.search).get('key')||'';
const _hdr=_key?{'X-API-Key':_key}:{};
let page=0,PP=300,total=0;
async function loadAuthors(){
  const r=await fetch('/authors',{headers:_hdr});
  const authors=await r.json();
  const sel=document.getElementById('filter'),cur=sel.value;
  sel.innerHTML='<option value="">All Agents</option>';
  authors.forEach(a=>{const o=document.createElement('option');o.value=a;o.textContent=a;sel.appendChild(o)});
  sel.value=cur;
}
async function loadPosts(){
  const f=document.getElementById('filter').value;
  const aq=f?'author='+encodeURIComponent(f)+'&':'';
  const [pr,cr]=await Promise.all([
    fetch(`/posts?${aq}limit=${PP}&offset=${page*PP}`,{headers:_hdr}),
    fetch(`/count?${aq.slice(0,-1)}`,{headers:_hdr})
  ]);
  const posts=await pr.json(),pages=Math.ceil((total=(await cr.json()).total)/PP)||1;
  page=Math.max(0,Math.min(page,pages-1));
  document.getElementById('posts').innerHTML=posts.map(p=>
    `<div class="post"><div class="meta"><span class="author">${esc(p.author)}</span> · #${p.id} · ${new Date(p.created_at*1000).toLocaleString()}</div><div class="content">${esc(p.content)}</div></div>`
  ).join('');
  document.getElementById('status').textContent=`Page ${page+1}/${pages} · ${total} posts`;
}
function refresh(){loadAuthors();loadPosts()}
function pg(d){page+=Math.sign(d);loadPosts();window.scrollTo(0,0)}
function esc(s){return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')}
document.getElementById('filter').onchange=()=>{page=0;loadPosts()};
refresh();
setInterval(loadPosts,8000);
</script></body></html>"""

README_TEXT = "Agent BBS API\tAuth: ALL requests require header X-API-Key: <key> or pass ?key=<key> as query parameter.\t1. Register: POST /register body: {\"name\": \"your-agent-name\"}\tResponse: {\"token\": \"xxx\", \"name\": \"your-agent-name\"}\t2. Post: POST /post body: {\"token\": \"xxx\", \"content\": \"your message\"}\tResponse: {\"id\": 1, \"author\": \"your-agent-name\"}\t3. Poll new: GET /poll?since_id=0&limit=50\tReturns posts with id > since_id, ordered by id asc. Keep track of the last id you received, use it as since_id next time.\t4. Query: GET /posts?author=xxx&limit=50\tauthor is optional. Returns posts ordered by id desc.	5. Upload file: POST /file/upload multipart/form-data, form fields: token (your agent token) + file (the file). Requires X-API-Key. Response: {\"ref\": \"a1b2c3/filename.ext\"}. Paste ref into post content to reference the file.	6. Download file: GET /file/{rand_id}/{filename} Requires X-API-Key. e.g. /file/a1b2c3/filename.ext"

@app.get("/readme")
def readme(): return PlainTextResponse(README_TEXT)

@app.get("/", response_class=HTMLResponse)
def index(): return HTML_PAGE

@contextmanager
def get_db(db_path):
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    try:
        yield conn
        conn.commit()
    finally: conn.close()

def _db(request): return request.state.board["db"]

def init_db():
    for board in BOARDS.values():
        with get_db(board["db"]) as db:
            db.execute("""CREATE TABLE IF NOT EXISTS users (
                token TEXT PRIMARY KEY, name TEXT UNIQUE NOT NULL, created_at REAL)""")
            db.execute("""CREATE TABLE IF NOT EXISTS posts (
                id INTEGER PRIMARY KEY AUTOINCREMENT, author TEXT NOT NULL,
                content TEXT NOT NULL, created_at REAL,
                FOREIGN KEY(author) REFERENCES users(name))""")
            db.execute("CREATE INDEX IF NOT EXISTS idx_posts_id ON posts(id)")

def verify_token(token, db_path):
    with get_db(db_path) as db:
        row = db.execute("SELECT name FROM users WHERE token=?", (token,)).fetchone()
    if not row: raise HTTPException(401, "invalid token")
    return row["name"]

@app.on_event("startup")
def startup():
    os.makedirs(UPLOAD_DIR, exist_ok=True)
    load_boards_if_changed()

@app.post("/register")
def register(request: Request, name=Body(..., embed=True)):
    token = uuid.uuid4().hex[:16]
    try:
        with get_db(_db(request)) as db:
            db.execute("INSERT INTO users VALUES(?,?,?)", (token, name, time.time()))
    except sqlite3.IntegrityError:
        with get_db(_db(request)) as db:
            row = db.execute("SELECT token FROM users WHERE name=?", (name,)).fetchone()
        return {"token": row["token"], "name": name}
    return {"token": token, "name": name}

@app.post("/post")
def create_post(request: Request, token=Body(...), content=Body(...)):
    author = verify_token(token, _db(request))
    with get_db(_db(request)) as db:
        cur = db.execute("INSERT INTO posts(author,content,created_at) VALUES(?,?,?)",
                         (author, content, time.time()))
        post_id = cur.lastrowid
    _T[0]=time.time()
    return {"id": post_id, "author": author}

@app.get("/poll")
def poll(request: Request, since_id=Query(0), limit=Query(50)):
    with get_db(_db(request)) as db:
        rows = db.execute("SELECT id,author,content,created_at FROM posts WHERE id>? ORDER BY id LIMIT ?",
                          (since_id, limit)).fetchall()
    return [dict(r) for r in rows]

@app.get("/count")
def count_posts(request: Request, author=Query(None)):
    with get_db(_db(request)) as db:
        q, p = ("SELECT COUNT(*) c FROM posts WHERE author=?", (author,)) if author else ("SELECT COUNT(*) c FROM posts", ())
        return {"total": db.execute(q, p).fetchone()["c"]}

@app.get("/authors")
def get_authors(request: Request):
    with get_db(_db(request)) as db:
        return [r["author"] for r in db.execute("SELECT DISTINCT author FROM posts ORDER BY author").fetchall()]

@app.get("/posts")
def get_posts(request: Request, author=Query(None), limit=Query(50), offset=Query(0)):
    with get_db(_db(request)) as db:
        if author:
            rows = db.execute("SELECT id,author,content,created_at FROM posts WHERE author=? ORDER BY id DESC LIMIT ? OFFSET ?",
                              (author, limit, offset)).fetchall()
        else:
            rows = db.execute("SELECT id,author,content,created_at FROM posts ORDER BY id DESC LIMIT ? OFFSET ?",
                              (limit, offset)).fetchall()
    return [dict(r) for r in rows]

@app.post("/file/upload")
def upload_file(request: Request, token=Body(...), file: UploadFile = File(...)):
    verify_token(token, _db(request))
    rand_id = uuid.uuid4().hex[:6]
    safe_name = os.path.basename(file.filename)
    dest = os.path.join(UPLOAD_DIR, rand_id)
    os.makedirs(dest, exist_ok=True)
    with open(os.path.join(dest, safe_name), "wb") as f:
        f.write(file.
```

### Core Architecture Module: `assets/code_run_header.py`
```
import sys, os, json, re, time, subprocess
sys.path.append(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'memory'))
_r = subprocess.run
def _d(b):
    if not b: return ''
    if isinstance(b, str): return b
    try: return b.decode()
    except: return b.decode('gbk', 'replace')
def _run(*a, **k):
    t = k.pop('text', 0) | k.pop('universal_newlines', 0)
    enc = k.pop('encoding', None)
    k.pop('errors', None)
    if enc: t = 1
    if t and isinstance(k.get('input'), str):
        k['input'] = k['input'].encode()
    r = _r(*a, **k)
    if t:
        if r.stdout is not None: r.stdout = _d(r.stdout)
        if r.stderr is not None: r.stderr = _d(r.stderr)
    return r
subprocess.run = _run
_Pi = subprocess.Popen.__init__
def _pinit(self, *a, **k):
    if os.name == 'nt': k['creationflags'] = (k.get('creationflags') or 0) | 0x08000000
    _Pi(self, *a, **k)
subprocess.Popen.__init__ = _pinit
sys.excepthook = lambda t, v, tb: (sys.__excepthook__(t, v, tb), print(f"\n[Agent Hint]: NO GUESSING! You MUST probe first. If missing common package, pip.")) if issubclass(t, (ImportError, AttributeError)) else sys.__excepthook__(t, v, tb)

```

### Core Architecture Module: `assets/configure_mykey.py`
```
#!/usr/bin/env python3
"""
GenericAgent — 交互式初始化向导 (configure.py)
一键配置 LLM 模型 + 消息平台，自动生成 mykey.py

用法:
    python configure.py
"""

import ast
import os
import sys
import re
import shutil
import json
import urllib.request
from datetime import datetime

# ── ANSI 颜色 ──────────────────────────────────────────────────────────────
C = {
    'reset': '\033[0m', 'bold': '\033[1m', 'dim': '\033[2m',
    'red': '\033[91m', 'green': '\033[92m', 'yellow': '\033[93m',
    'blue': '\033[94m', 'magenta': '\033[95m', 'cyan': '\033[96m', 'white': '\033[97m',
}

PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MYKPY_PATH = os.path.join(PROJECT_ROOT, 'mykey.py')

# ── 模型厂商定义 ───────────────────────────────────────────────────────────

LLM_PROVIDERS = [
    # ═══════════════════════════ 通用协议（官方直连或任意兼容中转）═══════════════════════════
    {
        'id': 'oai_chat',
        'name': 'OpenAI Chat Completions 协议',
        'desc': '官方直连或任意 OAI 兼容中转/网关，自填 apibase（回车=OpenAI 官方）',
        'type': 'native_oai',
        'template': {
            'name': 'gpt-native', 'apikey': 'sk-<your-key>',
            'apibase': 'https://api.openai.com/v1', 'model': 'gpt-5.5',
            'api_mode': 'chat_completions', 'reasoning_effort': 'high',
            'max_retries': 3, 'connect_timeout': 10, 'read_timeout': 120,
        },
        'key_hint': '官方在 https://platform.openai.com/api-keys 获取；中转站填其提供的 Key',
        'model_choices': ['gpt-5.5', 'gpt-5.4'],
        'extra_fields': [
            {'key': 'apibase', 'label': 'API Base（官方或中转地址）', 'default': 'https://api.openai.com/v1'},
        ],
    },
    {
        'id': 'oai_responses',
        'name': 'OpenAI Responses 协议',
        'desc': 'Responses API（o 系列/GPT-5.5 推荐端点），官方或兼容网关，自填 apibase',
        'type': 'native_oai',
        'template': {
            'name': 'gpt-responses', 'apikey': 'sk-<your-key>',
            'apibase': 'https://api.openai.com/v1', 'model': 'gpt-5.5',
            'api_mode': 'responses', 'reasoning_effort': 'high',
            'max_retries': 3, 'connect_timeout': 10, 'read_timeout': 120,
        },
        'key_hint': '官方在 https://platform.openai.com/api-keys 获取；中转站填其提供的 Key',
        'model_choices': ['gpt-5.5', 'gpt-5.4'],
        'extra_fields': [
            {'key': 'apibase', 'label': 'API Base（官方或中转地址）', 'default': 'https://api.openai.com/v1'},
        ],
    },
    {
        'id': 'claude_messages',
        'name': 'Claude Messages 协议',
        'desc': 'Anthropic 官方直连或任意 Claude 兼容中转，自填 apibase（回车=官方）',
        'type': 'native_claude',
        'template': {
            'name': 'anthropic-direct', 'apikey': 'sk-ant-<your-key>',
            'apibase': 'https://api.anthropic.com', 'model': 'claude-opus-4-7',
            'thinking_type': 'adaptive', 'max_tokens': 32768, 'temperature': 1,
        },
        'key_hint': '官方在 https://console.anthropic.com/ 获取；中转站填其提供的 Key',
        'model_choices': ['claude-opus-4-7', 'claude-sonnet-4-6'],
        'extra_fields': [
            {'key': 'apibase', 'label': 'API Base（官方或中转地址）', 'default': 'https://api.anthropic.com'},
        ],
    },
    # ═══════════════════════════ 直连 API（按旗舰能力降序）═══════════════════════════
    {
        'id': 'deepseek',
        'name': 'DeepSeek (v4-Pro / Flash)',
        'desc': '开源模型，v4-Pro 旗舰 1M 上下文',
        'type': 'native_oai',
        'template': {
            'name': 'deepseek', 'apikey': 'sk-<your-deepseek-key>',
            'apibase': 'https://api.deepseek.com', 'model': 'deepseek-v4-pro',
            'api_mode': 'chat_completions', 'reasoning_effort': 'high',
        },
        'key_hint': '在 https://platform.deepseek.com/api_keys 获取',
        'model_choices': ['deepseek-v4-pro', 'deepseek-v4-flash'],
    },
    {
        'id': 'kimi',
        'name': 'Kimi (k2.6 / k2.5) 双协议',
        'desc': '月之暗面，支持 Anthropic 和 OAI 双协议',
        'type': 'native_claude',
        'template': {
            'name': 'kimi', 'apikey': 'sk-kimi-<your-key>',
            'apibase': 'https://api.kimi.com/coding',
            'model': 'kimi-for-coding', 'fake_cc_system_prompt': True,
            'thinking_type': 'adaptive',
        },
        'key_hint': '在 https://kimi.com/code 或 https://platform.moonshot.cn/ 获取',
        'model_choices': ['kimi-k2.6', 'kimi-k2.5'],
        'extra_fields': [
            {
                'key': '_protocol', 'label': '选择 API 协议',
                'type': 'choice',
                'options': [
                    {'id': 'native_claude', 'name': 'Anthropic 兼容 (推荐)', 'desc': 'kimi-for-coding 端点，CC 兼容', 'apibase': 'https://api.kimi.com/coding', 'fake_cc_system_prompt': True, 'model': 'kimi-for-coding'},
                    {'id': 'native_oai', 'name': 'OpenAI 协议', 'desc': 'Moonshot OAI 端点，kimi-k2 系列', 'apibase': 'https://api.moonshot.cn/v1', 'model': 'kimi-k2.6'},
                ],
            },
        ],
    },
    {
        'id': 'qwen',
        'name': '阿里通义千问 (Qwen3.5 / 百炼)',
        'desc': '阿里云百炼，Qwen3 系列百万级上下文',
        'type': 'native_oai',
        'template': {
            'name': 'qwen', 'apikey': 'sk-<your-dashscope-key>',
            'apibase': 'https://dashscope.aliyuncs.com/compatible-mode/v1',
            'model': 'qwen3.6-max-preview',
            'api_mode': 'chat_completions',
        },
        'key_hint': '在 https://bailian.console.aliyun.com/ 获取 API Key',
        'model_choices': ['qwen3.6-max-preview', 'qwen3.5-plus', 'qwen3-coder-plus'],
        'extra_fields': [
            {
                'key': '_endpoint', 'label': '选择端点',
                'type': 'choice',
                'options': [
                    {'id': 'standard', 'name': '标准按量付费', 'desc': 'dashscope.aliyuncs.com，兼容模式', 'apibase': 'https://dashscope.aliyuncs.com/compatible-mode/v1'},
                    {'id': 'coding_plan', 'name': '百炼 Coding Plan (订阅)', 'desc': 'coding-intl.dashscope.aliyuncs.com，100万上下文', 'apibase': 'https://coding-intl.dashscope.aliyuncs.com/v1', 'context_win': 1000000},
                ],
            },
        ],
    },
    {
        'id': 'zhipu',
        'name': '智谱 GLM-5.1 (Coding Plan)',
        'desc': '智谱 GLM，支持 Coding Plan CN (Anthropic) 和 Global (OAI) 双端点',
        'type': 'native_claude',
        'template': {
            'name': 'zhipu-glm', 'apikey': 'sk-<your-zhipu-key>',
            'apibase': 'https://open.bigmodel.cn/api/anthropic',
            'model': 'GLM-5.1-Cloud', 'fake_cc_system_prompt': False,
            'thinking_type': 'adaptive', 'max_retries': 3,
            'connect_timeout': 10, 'read_timeout': 180,
        },
        'key_hint': 'CN 在 https://open.bigmodel.cn/ 获取；Global 在 https://z.ai/ 获取',
        'model_choices': ['GLM-5.1-Cloud', 'glm-4.7'],
        'extra_fields': [
            {
                'key': '_plan', 'label': '选择 Coding Plan',
                'type': 'choice',
                'options': [
                    {'id': 'native_claude', 'name': 'Coding Plan CN (Anthropic)', 'desc': 'open.bigmodel.cn，推荐国内用户', 'apibase': 'https://open.bigmodel.cn/api/anthropic', 'fake_cc_system_prompt': False},
                    {'id': 'native_oai', 'name': 'Coding Plan Global (OAI)', 'desc': 'api.z.ai，OpenAI 协议，全球可用', 'apibase': 'https://api.z.ai/api/paas/v4'},
                ],
            },
        ],
    },
    {
        'id': 'minimax',
        'name': 'MiniMax M3 (双协议)',
        'desc': 'MiniMax M3，支持 Anthropic 和 OpenAI 双协议',
        'type': 'native_claude',
        'template': {
            'name': 'minimax', 'apikey': 'eyJh...<your-minimax-key>',
            'apibase': 'https://api.minimaxi.com/anthropic',
            'model': 'MiniMax-M3', 'max_retries': 3,
        },
        'key_hint': '在 https://platform.minimaxi.com/user-center/basic-information 获取',
        'model_choices': ['MiniMax-M3', 'MiniMax-M2.7', 'MiniMax-M2.7-highspeed'],
        'extra_fields': [
            {
                'key': '_protocol', 'label': '选择 API 协议',
                'type': 'choice',
                'options': [
                    {'id': 'native_claude', 'name': 'Anthropic 协议 (推荐)', 'desc': '无 <think> 标签，原生 Claude 兼容', 'apibase': 'https://api.minimaxi.com/anthropic'},
                    {'id': 'native_oai', 'name': 'OpenAI 协议', 'desc': '走 /v1/chat/completions', 'apibase': 'https://api.minimaxi.com/v1', 'context_win': 50000},
                ],
            },
        ],
    },
    {
        'id': 'stepfun',
        'name': '阶跃星辰 Step-3.5 (推理强)',
        'desc': '阶跃星辰 Step 系列，支持标准和 Step Plan 双端点',
        'type': 'native_oai',
        'template': {
            'name': 'stepfun', 'apikey': 'sk-<your-stepfun-key>',
            'apibase': 'https://api.stepfun.com/v1',
            'model': 'step-3.5-flash',
            'api_mode': 'chat_completions',
            'context_win': 262144,
        },
        'key_hint': '在 https://platform.stepfun.com/ 获取 API Key',
        'model_choices': ['step-3.5-flash', 'step-3.5-flash-2603'],
        'extra_fields': [
            {
                'key': '_endpoint', 'label': '选择端点',
                'type': 'choice',
                'options': [
                    {'id': 'standard', 'name': '标准端点', 'desc': 'api.stepfun.com/v1，按量付费', 'apibase': 'https://api.stepfun.com/v1', 'context_win': 262144},
                    {'id': 'step_plan', 'name': 'Step Plan (订阅)', 'desc': 'api.stepfun.com/step_plan/v1，订阅制', 'apibase': 'https://api.stepfun.com/step_plan/v1', 'context_win': 262144},
                ],
            },
        ],
    },
    {
        'id': 'qianfan',
        'name': '百度千帆 (ERNIE 5.0 / 第三方)',
        'desc': '百度智能云千帆，文心一言 ERNIE 5.0 + DeepSeek 等',
        'type': 'native_oai',
        'template': {
            'name': 'baidu-qianfan', 'apikey': '<your-qianfan-key>',
            'apibase': 'https://qianfan.baidubce.com/v2',
            'model': 'ernie-5.0-thinking-preview',
            'api_mode': 'chat_completions',
        },
        'key_hint': '在 https://console.bce.baidu.com/qianfan/ 创建应用获取 API Key',
        'model_choices': ['ernie-5.0-thinking-preview', 'deepseek-v3.2'],
        'extra_fields'
```

### Core Architecture Module: `assets/ga_httpapp.py`
```
import threading, sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from fastapi import FastAPI, Header, HTTPException, Query, Depends; from fastapi.responses import HTMLResponse
from pydantic import BaseModel
from agentmain import GenericAgent as GA

PORT, API_KEY = int(sys.argv[1]), sys.argv[2]
app, agent, lock = FastAPI(), GA(), threading.Lock()
outputs, stopped = [], True
threading.Thread(target=agent.run, daemon=True).start()
class Req(BaseModel): prompt: str = ""
agent.verbose = False

def require_key(key: str = Query(None), x_api_key: str = Header(None, alias="X-API-Key")):
    if API_KEY not in (key, x_api_key): raise HTTPException(404)

def run_task(prompt):
    global stopped
    segs = []  # 本任务按 turn 索引的分段输出
    with lock: task_start = len(outputs)
    def flush():
        with lock: outputs[task_start:] = segs
    try:
        dq = agent.put_task(prompt, source="http")
        while "done" not in (item := dq.get(timeout=2200)):
            outs = item.get("outputs")
            if not outs: continue
            idx = max(0, int(item.get("turn", 0) or 0) - 1)  # turn 1-based → 槽位 0-based
            while len(segs) <= idx: segs.append("")
            segs[idx] = str(outs[-1])                         # 当前 turn
            if len(outs) >= 2 and idx >= 1: segs[idx - 1] = str(outs[-2])  # 前一 turn 落定值
            flush()
        segs = [str(s) for s in item.get("outputs", [])]      # done 时全量替换
        flush()
    finally: stopped = True

@app.post("/put_task")
def put_task(req: Req, _=Depends(require_key)):
    global stopped
    with lock:
        if not stopped: return {"ok": False, "error": "should abort first"}
        stopped = False
    threading.Thread(target=run_task, args=(req.prompt,), daemon=True).start()
    return {"ok": True}

@app.post("/abort")
def abort(_=Depends(require_key)): agent.abort(); return {"ok": True}

@app.post("/input")
def input_task(req: Req, _=Depends(require_key)):
    global stopped
    if not stopped: agent.intervene = req.prompt; return {"ok": True, "mode": "intervene"}
    with lock:
        if not stopped: agent.intervene = req.prompt; return {"ok": True, "mode": "intervene"}
        stopped = False
    threading.Thread(target=run_task, args=(req.prompt,), daemon=True).start()
    return {"ok": True, "mode": "task"}

@app.get("/output")
def get_output(k: int = Query(5), _=Depends(require_key)):
    with lock: r = outputs[-k:]
    return {"stopped": stopped, "output": "\n".join(r),
            "history": "\n".join(str(h) for h in agent.history)}

@app.get("/llm")
def llm_ep(llm_no: int = Query(None), _=Depends(require_key)):
    if llm_no is not None:
        agent.next_llm(llm_no)
    return {"llm_no": agent.llm_no, "name": agent.get_llm_name(),
            "llms": [{"no": i, "name": n, "current": a} for i, n, a in agent.list_llms()]}

@app.get("/sysprompt")
def sysprompt_ep(text: str = Query(None), _=Depends(require_key)):
    if text is not None:
        agent.extra_sys_prompts = [text] if text else []
    return {"extra_sys_prompts": agent.extra_sys_prompts}

HELP = """GA HTTP 操作协议（所有请求带 ?key=API_KEY，或 Header X-API-Key）
GET  /output?k=N      查看状态：{stopped, output(末N条), history}。stopped=true 表示空闲
POST /input  {prompt} 下发指令：空闲时作为新任务，忙时作为中途干预(intervene)
POST /abort           中止当前任务
GET  /llm[?llm_no=N]  查/切模型：返回 {llm_no,name,llms:[{no,name,current}]}
GET  /sysprompt[?text]查/设附加系统提示(extra_sys_prompts)，text 为空则清空
纠偏流程：先 GET /output 读 history 判断状态→需要时 POST /input 注入纠偏指令"""

@app.get("/help")
def help_ep(_=Depends(require_key)): return {"help": HELP}

@app.get("/")
def ui():
    return HTMLResponse(f"""<!DOCTYPE html>
<html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>GA Monitor</title>
<script src="https://cdn.jsdelivr.net/npm/marked/marked.min.js"></script>
<style>
*{{margin:0;padding:0;box-sizing:border-box}}
body{{font:14px/1.6 system-ui,sans-serif;background:#f8f9fa;color:#212529;padding:24px;max-width:900px;margin:0 auto}}
#status{{font-size:18px;padding:8px 16px;border-radius:8px;margin-bottom:16px;display:inline-block;font-weight:600}}
.stopped{{background:#d4edda;color:#155724}}.running{{background:#fff3cd;color:#856404}}
.section{{background:#fff;border-radius:10px;padding:18px;margin-bottom:14px;box-shadow:0 1px 4px rgba(0,0,0,.06)}}
.section h3{{color:#533483;margin-bottom:8px;font-size:15px}}
textarea{{width:100%;height:80px;background:#fff;color:#212529;border:1px solid #ced4da;border-radius:6px;padding:10px;font:inherit;resize:vertical}}
button{{padding:10px 24px;background:#533483;color:#fff;border:none;border-radius:6px;font:inherit;cursor:pointer;font-weight:500}}
button:hover{{background:#7c3aed}}
pre{{background:#f1f3f5;padding:12px;border-radius:6px;overflow-x:auto;font:13px monospace;max-height:400px;overflow-y:auto}}
</style></head><body>
<div id="status" class="stopped">● Loading...</div>
<div class="section"><h3>Output</h3><div id="output"></div></div>
<div class="section"><h3>History</h3><div id="history"></div></div>
<textarea id="prompt" placeholder="Enter instruction..."></textarea>
<button onclick="send()">Send</button>
<script>
const K=new URLSearchParams(location.search).get('key')||'';
async function poll(){{let r=await fetch('/output',{{headers:{{'X-API-Key':K}}}});let d=await r.json();
let s=document.getElementById('status');s.textContent=(d.stopped?'● Stopped':'● Running');s.className=d.stopped?'stopped':'running';
document.getElementById('output').innerHTML=marked.parse(d.output||'_empty_');
document.getElementById('history').innerHTML=marked.parse(d.history||'_empty_');}}
async function send(){{let p=document.getElementById('prompt').value;if(!p)return;
await fetch('/input',{{method:'POST',headers:{{'X-API-Key':K,'Content-Type':'application/json'}},body:JSON.stringify({{prompt:p}})}});
document.getElementById('prompt').value='';poll();}}
poll();setInterval(poll,3000);
</script></body></html>""")

if __name__ == "__main__":
    import uvicorn; uvicorn.run(app, host="0.0.0.0", port=PORT)

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #817** (2026-09-29): **docs: refresh WeChat group 23 QR code**
  *Symptoms*: ## Summary - Replace `assets/images/wechat_group22.jpg` with the current GenericAgent 体验交流群 23 QR code from `群23.jpg`. - README already labels this image as 微信群 23 and points at the same path, so the rendered QR updates without a markdown change. - The new code is valid for 7 days (through 2026-10-06).  ## Test plan - [ ] Open the PR README preview and confirm the 微信群 23 image is the new QR (title: 群聊: GenericAgent体验交流群 23). - [ ] Confirm the English section still has no WeChat group image.

- **Issue #816** (2026-09-22): **fix(tui): polish rendering, history preview, and copy behavior**
  *Symptoms*: ## Summary - fix stale message repaint during streaming and scrolling - add compact history preview with recent-turn rendering - normalize history focus and sidebar scrollbar styling - preserve Ctrl+C behavior and support forwarded Cmd+C copying  ## Verification - `python -m py_compile frontends/tuiapp_v2.py` - `git diff --check`  No co-authors added.

- **Issue #805** (2026-09-29): **fix: strip DeepSeek DSML tool-call markers from assistant content**
  *Symptoms*: ## Problem  DeepSeek's DSML protocol injects tool-call routing markers into the content stream before the actual `tool_calls` delta arrives. These markers (e.g. `<‖DSML‖tool_calls>`, `<‖DSML‖invoke ...>`) leak into the UI when tool calls fail or aren't parsed in time.  ## Fix  Adds `_strip_dsml_markers()` — a fast regex filter applied to every content chunk yielded by `_parse_openai_sse()`.  - **Zero overhead** on non-DeepSeek streams: the guard short-circuits on chunks that don't contain `'DSML'` - Catches all known marker variants: full-width `‖`, Unicode `｜`, ASCII pipe `|`, and double-escaped forms - Applied at both the streaming yield point (real-time UI) and the final block assembly (fallback)  ## Testing  - Verified with synthetic SSE chunks containing `<‖DSML‖tool_calls>`, `<‖DSML‖invoke name="ShellCommand" arguments="{...}">` — all stripped cleanly - Non-DeepSeek streams unaffected (guard short-circuits)  Closes #804
  **Post-Mortem & Fix Analysis**:
  > Friendly bump — DeepSeek DSML strip is ready for review when you have a moment. Happy to tweak if needed.
  > I tested the current PR implementation against DSML strings observed in real `model_responses`. Two gaps remain:  1. **Double full-width-pipe markers are only partially removed**  ```python _strip_dsml_markers('<｜｜DSML｜｜parameter name="x">abc</｜｜DSML｜｜parameter>') # current result: '<abc</' # expected:       'abc' ```  The `｜DSML｜` regex starts matching at the second pipe of `｜｜DSML｜｜`, leaving the outer `<` / `</` behind.  2. **Markers split across SSE chunks are not removed**  ```python chunks = ['hello<‖DS', 'ML‖tool_calls>world'] ''.join(_strip_dsml_markers(x) for x in chunks) # current result: 'hello<‖DSML‖tool_calls>world' ```  Because each chunk is filtered independently and the fast guard requires `"DSML" in text`, a marker split at any point inside `DSML` bypasses the filter. This is especially relevant for streaming, and the PR description explicitly mentions chunk-split regression tests.  Suggested direction: maintain a short carry-over buffer/state across SSE chunks, and ma
  > Thanks for the PR and @ZhulongNT for the careful review. We've decided not to merge this. DSML leaking into `content` means the tool call was already not parsed, either on the serving side or because of malformed model output. Stripping the markers on the client doesn't recover the call. It only hides the failure, and it rewrites the history sent back to the model, which stops it from correcting itself. We'd rather keep the model output as-is and fix this at the serving/parser layer. Closing, thanks again!

- **Issue #804** (2026-09-29): **[Bug] DeepSeek DSML tool-call markers leak into assistant content and streamlit UI**
  *Symptoms*: ### Summary When using DeepSeek with tool calls, raw DSML markers such as `<‖DSML‖tool_calls>` and `<‖DSML‖invoke ...>` are leaking into the assistant `content` field. Downstream consumers (UI/TUI) then display or speak these internal markers.    ### Suggested fix - Add DSML marker detection before emitting `content`. - Strip / normalize Unicode variants (`‖`, `｜`, etc.). - Keep tool-call data only in structured `tool_calls`. - Add regression tests with streaming chunks split across markers.  ### Reference - https://jishuzhan.net/article/2065972403007746050
  **Post-Mortem & Fix Analysis**:
  > 补充一组实际 `model_responses` 扫描结果（2026-09-22）：  - 排除执行本次检索的当前会话文件，历史响应中仍有 **911 处**（28 个文件）不区分大小写的 `DSML` 命中。 - 高频真实泄漏形式不是只有 `<‖DSML‖...>`，还包括双全角竖线形式，例如：   - `<｜｜DSML｜｜parameter ...>`   - `</｜｜DSML｜｜parameter>`   - `<｜｜DSML｜｜tool...>` - 另外需要处理 SSE chunk 恰好从标记中间切开的情况。例如两个 chunk：   - `hello<‖DS`   - `ML‖tool_calls>world`  如果过滤器逐 chunk 检查完整字符串 `DSML`，上述分块会原样泄漏。建议修复时使用跨 chunk 的小型状态机/尾部缓冲，并覆盖 `‖...‖`、`｜｜...｜｜`、`|...|` 的开闭标签及分块边界回归测试。
  > Closing as won't fix, see the discussion in #805: DSML leaking into `content` is a serving/parser-side issue, and we keep model output faithful on the agent side.

- **Issue #791** (2026-09-03): **docs(ganet): cover macOS in the PC device-link setup SOP**
  *Symptoms*: ## Summary - Extend `memory/ganet_pc_setup_sop.md` so GA can configure GAnet on macOS as well as Windows (GAnet `v0.5.0` now publishes signed darwin arm64/amd64 sidecars). - Move the default component clone location to `~/.genericagent/components/GAnet` on every platform: a checkout under the GA root's `temp/` gets wiped by the temp rewind mechanism (observed on a first macOS run). - Record the per-platform facts the flow depends on: launcher (`ganet.cmd` / `ganet.sh`), sidecar data directory, login autostart mechanism, `platform: darwin` in release entries, Mach-O verification, and the advisory `screen_access` result that setup/upgrade returns on macOS.  No step of the flow changes; Windows behaviour is unaffected apart from the new default location.  ## Test plan - [x] Windows: `inspect-component`, `configure-host` (idempotent), `check_env`, `ssh_device_probe`, `install_release` upgrade and forced rollback, autostart remove/install; phone 鈫?PC tools including screenshot and file transfer - [x] macOS (Apple Silicon, macOS 26.5), step by step with the same GAnet APIs the SOP names: dependency install, `configure-host`, user-center login, enrollment, launchd takeover, four green checks, `ssh_device_probe`, `install_release` upgrade and rollback, phone pairing and all tools including screenshot - [x] `remove_environment(approved=True)` returns the Mac to a clean state (no LaunchAgent, no state directories, server records retired) - [x] macOS: full GA-driven run of th

- **Issue #787** (2026-08-30): **feat(desktop): compiled React Desktop 2.0 v0.2.1 renderer update**
  *Symptoms*: ## Summary  This PR delivers **GenericAgent React Desktop 2.0 as a compiled-only upstream update**, carrying the v0.2.1 renderer iterations that PR #784 was closed to await. It submits the regenerated renderer together with the Desktop-specific bridge, packaging, security capabilities, tests, and quality gates needed to run and ship it. It does **not** submit the React development tree and does **not** change GenericAgent's Agent/LLM/Harness business core.  The public React source of truth and contribution home is [`abraxas914/GenericAgent`](https://github.com/abraxas914/GenericAgent). The submitted renderer was rebuilt from accepted fork `main` commit [`4a67226e18cb003db1210357ea4a283774773acc`](https://github.com/abraxas914/GenericAgent/commit/4a67226e18cb003db1210357ea4a283774773acc).  **Core boundary:** `agentmain.py`, `llmcore.py` / `llmcore/**`, the Agent/LLM/Harness execution core, inference, tool calling, and memory scheduling have zero diff from upstream. The independent legacy `frontends/desktop/static/**` Desktop v1 tree also has zero diff.  ## What changed since the last compiled delivery  Renderer fixes compiled into `dist/**` from the recorded source commit:  - **Live turn timer persists across session switch** — the in-thread response indicator now reads the   store's turn start instead of a component-local clock, so switching sessions mid-generation no longer   resets the elapsed timer to 0. - **Mixin image-to-path fallback** — when the bound model is a Mixin 

- **Issue #786** (2026-08-28): **docs(ganet): add PC device-link setup SOP**
  *Symptoms*: ## 摘要  新增 `memory/ganet_pc_setup_sop.md`:PC 端设备互联(GAnet)的配置 SOP,单文件纯新增,不改动任何现有代码。  GA 读取该 SOP 后可引导用户完成:  - 获取 GAnet 组件(GitHub 公开仓库 clone)并安装网络组件(签名 manifest 校验的 sidecar 二进制); - 配置内嵌 SSH(独立授权文件与主机密钥,不触碰用户已有 SSH/防火墙/DNS 配置)、登记入网、登录自启动; - 与手机 GA 扫码配对,之后手机可通过端到端加密通道使用这台电脑; - 卸载(固定序列,组件代码目录保留)。  配套的手机端支持在 GAndroid beta 分支。  ## 验证  - 干净 Win11 虚拟机(仅装 GA + Git)按本 SOP 全流程走通:组件获取、安装、配对、手机端调用、卸载; - 真机(Pixel 7)与两台 PC 配对及日常使用验证通过。 

- **Issue #785** (2026-08-27): **Conductor mode can reply to the wrong WeChat conversation**
  *Symptoms*: ## Conductor replies can be sent to the wrong WeChat conversation  ### Summary  When `frontends/wechatapp.py` runs in Conductor mode, replies can be delivered to a different conversation (for example, the Conductor/operator chat) instead of the WeChat user who sent the message.  ### Cause  `on_message()` starts `_cond_forward()` in a background thread, but `_cond_forward()` calls `bot.reply_text()`. `reply_text()` resolves its recipient from the mutable shared `bot.last_message`:  ```python self.send_text(self.last_message['from_user_id'], text,                self.last_message.get('context_token', '')) ```  If another update is received before the Conductor response is ready, `last_message` has been replaced. The delayed response is then sent with `ret=0` to the wrong valid WeChat conversation, making the HTTP request appear successful while the original user receives nothing.  ### Reproduction  1. Run the official WeChat frontend in Conductor mode. 2. Send a message from a WeChat user. 3. Before the Conductor response completes, receive another WeChat update (or have another conversation update `last_message`). 4. Wait for the Conductor response. 5. Observe that the response is sent to the later conversation rather than the original sender.  ### Expected behavior  Every asynchronous response should be sent to the sender and context captured from the update that created that response.  ### Suggested fix  Capture `uid` and `context_token` when starting the worker and pass the
  **Post-Mortem & Fix Analysis**:
  > Correction after live retest: capturing `uid`/`context_token` did **not** restore WeChat-client visibility. The Conductor panel showing the generated answer is expected because `/chat` writes to its own stream; it is not evidence that `sendmessage` routed to that panel. The bridge subsequently called `send_text(captured_uid, ..., context_token=captured_ctx)` and iLink returned HTTP 200 / `ret: 0`, but the WeChat client still showed no reply. Therefore the mutable `last_message` explanation in the issue body is not established as the root cause. I am continuing investigation of the iLink outbound payload/session behavior and will update or close this issue based on verified evidence.
  > Closing this report because live validation disproved the proposed root cause. After pinning the inbound WeChat `uid` and `context_token` and calling `send_text()` with those captured values, `/ilink/bot/sendmessage` still returned HTTP 200 / `ret: 0` while no text appeared in WeChat. The answer appearing in the Conductor panel is expected because Conductor `/chat` persists its own generated response; it does not show where the separate iLink request was delivered. The actual symptom matches the currently reported Tencent iLink silent-delivery incidents (for example Tencent/openclaw-weixin#264, #266, #268): inbound and generation work, outbound is accepted with `ret: 0`, but the WeChat client never renders it. The mutable `last_message` theory should not be used as a fix for this symptom.

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

### Incident Patch 1: `f308ee7e` (2026-09-30)
**Commit Message**: memory distill prompt rework; bump claude-cli UA 2.1.280; subagent hub note; memory_cleanup L3 audit principles

**File**: `ga.py` (modified, +4/-10)
```diff
@@ -526,16 +526,10 @@ def do_no_tool(self, args, response):
     
     def do_start_long_term_update(self, args, response):
         '''Agent觉得当前任务完成后有重要信息需要记忆时调用此工具。'''
-        prompt = '''### [总结提炼经验] 既然你觉得当前任务有重要信息需要记忆，请提取最近一次任务中【事实验证成功且长期有效】的环境事实、用户偏好、重要步骤，更新记忆。
-本工具是标记开启结算过程，若已在更新记忆过程或没有值得记忆的点，忽略本次调用。
-**如果没有经过验证的，未来能用上的信息，忽略本次调用！**
-**必须成功完成任务，或到达重要检查点才能进行记忆提炼，未成功完成则忽略本次调用！**
-**只能提取行动验证成功的信息**：
-- **环境事实**（路径/凭证/配置）→ `file_patch` 更新 L2，同步 L1
-- **复杂任务经验**（关键坑点/前置条件/重要步骤）→ L3 精简 SOP（只记你被坑得多次重试的核心要点）
-**禁止**：临时变量、具体推理过程、未验证信息、通用常识、你可以轻松复现的细节、只是做了但没有验证的信息
-**操作**：严格遵循提供的L0的记忆更新SOP。先 `file_read` 看现有 → 判断类型 → 最小化更新 → 无新内容跳过，保证对记忆库最小局部修改。\n
-''' + get_global_memory()
+        prompt = get_global_memory() + '''【记忆提纯】任务完成或到达重要检查点后，按L0提取最近一次任务中【事实验证成功且长期有效】的环境事实、用户偏好、重要步骤；已在整理则不重复启动。
+先读后patch，将已验证、长期有用且难以重建的新知识融入旧条目，合并重复、压缩冗述，不堆叠流水账。以更少文字保留更高复用价值；不得为缩短而丢失关键事实、适用条件和踩坑信息。无提纯价值则跳过，索引按需同步。
+禁止：临时状态、推理过程、未验证信息、通用常识、易重建细节；不得将模型推测或建议记作用户要求。
+记忆整理仅是内部收尾；完成或跳过后，仍须向用户报告原任务结果。'''
         yield "[Info] Start distilling good memory for long-term storage.\n"
         path = './memory/memory_management_sop.md'
         if os.path.exists(path): result = 'This is L0:\n' + file_read(path, show_linenos=False)
```

**File**: `llmcore.py` (modified, +2/-2)
```diff
@@ -674,7 +674,7 @@ def _enum(key, valid):
         self.api_mode = 'responses' if mode in ('responses', 'response') else 'chat_completions'
         self.temperature = cfg.get('temperature', 1)
         self.max_tokens = cfg.get('max_tokens')
-        self.default_ua = "claude-cli/2.1.251 (external, cli)"
+        self.default_ua = "claude-cli/2.1.280 (external, cli)"
         self.user_agent = cfg.get("user_agent", self.default_ua)
     def _apply_claude_thinking(self, payload):
         if self.thinking_type:
@@ -786,7 +786,7 @@ def _fix_messages(messages):
     return merged
 
 class NativeClaudeSession(BaseSession):
-    native_ua = "claude-cli/2.1.251 (native, cli)"
+    native_ua = "claude-cli/2.1.280 (native, cli)"
     def __init__(self, cfg):
         super().__init__(cfg)
         self.fake_cc_system_prompt = cfg.get("fake_cc_system_prompt", False)
```

**File**: `memory/memory_cleanup_sop.md` (modified, +9/-0)
```diff
@@ -53,3 +53,12 @@ ROI = (不放这几个词的犯错概率 × 代价) / 每轮词数成本
 - 根因：老记录行首可能混入真实的多余 `|`（或全角/箭头字节差异），复制时看不出。
 - 排查：`for i,l in enumerate(lines): print(i+1, repr(l[:20]))` 用 repr 看真实字节。
 - 解法：**改用 Python 按行号切片替换**：`lines=open(p,encoding='utf-8').read().split('\n'); assert lines[a].startswith(...); newlines=lines[:a]+repl+lines[b:]; open(p,'w',encoding='utf-8').write('\n'.join(newlines))`。前后加 `assert startswith` 双锚点防错位，改完 repr 复核。此法顺带清脏字符。
+
+## L3 内容审计（清"误导"而非"占地"）
+SOP 越写越让人不敢动手时，优先删这几类：
+1. 无触发条件、不计成本的"必须全覆盖"要求。
+2. 已被后文推翻、原句却还留着的旧结论。
+3. 绑定过时人际局面而非事实的礼仪规则。
+4. 散落各处的重复免责声明 → 合并为一条总则。
+5. 从未证明有用的防御仪式。判据：说不出它哪次真抓到过问题，就删。
+写经验只记"坑在哪、怎么现形"，不添加未验证有效的防御动作；带实测数字与反直觉机制的条目不动。
```

**File**: `memory/subagent.md` (modified, +3/-0)
```diff
@@ -17,6 +17,9 @@
 - [[可选fork]]：将变量history(str)写入task目录下`_history.json`继承对话上下文
 - [[可选监察者]]：主agent空闲时读output观察进度，必要时干预文件纠偏。加`--verbose`可审查原始数据
 
+## Hub：向已有 agent 投递消息
+通过 Hub 向已有 agent 投递消息：查 GA 代码根 `frontends/hub.py`，页面入口及投递接口均在其中。
+
 ## 共通规则
 - 所有agent的cwd=temp，方便文件共享
 - input：目标+约束即可，subagent同等智能。**禁写步骤/过度描述**，大量数据给路径
```

---

### Incident Patch 2: `e86ca723` (2026-09-22)
**Commit Message**: fix(tui): polish rendering, history preview, and copy behavior (#816)

* fix(tui): repaint composer after macOS input

* feat(tui): add compact conversation history

* fix(tui): repaint messages after streaming and scroll

* fix(tui): polish history focus and scrollbar styling

**File**: `frontends/tuiapp_v2.py` (modified, +296/-22)
```diff
@@ -1739,6 +1739,13 @@ def _palette_from_resolved_vars(v: dict[str, str], dark: bool) -> dict[str, str]
     /* Reserve the 1-col scrollbar gutter up front so overflowing the window
        doesn't suddenly squeeze the session rows narrower. */
     scrollbar-gutter: stable;
+    scrollbar-background: $ga-bg;
+    scrollbar-background-hover: $ga-bg;
+    scrollbar-background-active: $ga-bg;
+    scrollbar-color: $ga-border;
+    scrollbar-color-hover: $ga-border-hi;
+    scrollbar-color-active: $ga-dim;
+    scrollbar-corner-color: $ga-bg;
 }
 #sidebar-scroll.-hidden, #sidebar-scroll.-narrow { display: none; }
 
@@ -1767,6 +1774,9 @@ def _palette_from_resolved_vars(v: dict[str, str], dark: bool) -> dict[str, str]
     scrollbar-color-active: $ga-dim;
 }
 
+#history-open { display: none; width: 100%; height: 1; min-height: 1; background: $ga-bg; color: $ga-muted; content-align: center middle; text-align: center; }
+#history-open.-visible { display: block; }
+
 /* Plan/todo panel — fixed 5-row card between messages and composer.
    `display: none` default so the empty post-compose frame doesn't flash;
    renderer flips it on once items materialize. Fixed height (no scroll)
@@ -2769,7 +2779,7 @@ class InputArea(TextArea):
         Binding("ctrl+v",      "paste", "Paste", show=False),
         # macOS muscle-memory alias: most terminals swallow Cmd+V (forward via bracketed
         # paste → _on_paste); this only hits if the terminal forwards Cmd as a key.
-        Binding("cmd+v",       "paste", "Paste", show=False),
+        Binding("cmd+v,super+v", "paste", "Paste", show=False),
         # Ctrl+U: readline-style kill-line, repurposed here to clear the whole input.
         Binding("ctrl+u",      "clear_input", "ClearInput", show=False),
         # Ctrl+S: toggle-stash the current draft.  First press → stash
@@ -3457,6 +3467,133 @@ def compose(self) -> ComposeResult:
         yield Static(self._content)
 
 
+@dataclass
+class HistoryPrompt:
+    text: str
+
+    def __rich_console__(self, console, options):
+        from rich.padding import Padding
+
+        width = max(1, options.max_width)
+        lines = Text(self.text).wrap(console, width, overflow="fold")
+        if len(lines) > 3:
+            lines = lines[:3]
+            lines[-1].truncate(width - 1, overflow="crop")
+            lines[-1].append("…")
+        # OptionList's height calculation excludes component vertical padding.
+        # Match the main session sidebar: equal space above and below the text.
+        yield Padding(Text("\n").join(lines), (1, 0, 1, 0))
+
+
+class HistoryScreen(ModalScreen):
+    """Read-only history: full prompt index and one lazily rendered turn."""
+    CSS = """
+    HistoryScreen { background: $ga-bg; padding: 1 2; }
+    #history-title { height: 2; color: $ga-muted; }
+    #history-columns { height: 1fr; }
+    #history-index {
+        width: 25%; min-width: 18; border: none;
+        border-right: solid $ga-border; padding: 0 1 0 0;
+        background: $ga-bg;
+    }
+    /* OptionList tints its own background on focus. The option rows cover
+       most of that surface, leaving the scrollbar gutter as a bright stripe. */
+    #history-index:focus { background-tint: transparent; }
+    #history-detail {
+        width: 1fr; padding: 0 2; background: $ga-bg;
+        overflow-x: hidden; overflow-y: scroll;
+    }
+    #history-index, #history-detail {
+        scrollbar-size: 1 1;
+        scrollbar-background: $ga-bg;
+        scrollbar-background-hover: $ga-bg;
+        scrollbar-background-active: $ga-bg;
+        scrollbar-color: $ga-border;
+        scrollbar-color-hover: $ga-border-hi;
+        scrollbar-color-active: $ga-border-hi;
+    }
+    #history-index > .option-list--option { padding: 0 2; }
+    #history-detail .role { margin-top: 1; margin-bottom: 1; }
+    #history-detail .fold-header { color: $ga-muted; }
+    """
+    BINDINGS = [Binding("escape", "dismiss", "返回", priority=True),
+                Binding("ctrl+g,cmd+shift+h", "dismiss", "返回", show=False, priority=True)]
+
+    def __init__(self, session):
+        super().__init__()
+        self.session = session
+        self.starts = [i for i, m in enumerate(session.messages) if m.role == "user"]
+        if session.messages and (not self.starts or self.starts[0] != 0):
+            self.starts.insert(0, 0)
+        self.end = len(session.messages)
+        self.selected_turn = None
+        self.preview = []
+        self._render_version = 0
+
+    def compose(self):
+        yield Static("全部历史 · ↑↓ 选择 · Tab 切换栏 · Esc 返回", id="history-title")
+        with Horizontal(id="history-columns"):
+            yield OptionList(id="history-index")
+            yield VerticalScroll(id="history-detail")
+
+    def on_mount(self):
+        self.call_after_refresh(self._populate_index)
+
+    def _populate_index(self):
+        index = self.query_one("#history-index", OptionList)
+        options = []
+        for turn in range(len(self.starts))
```

---

### Incident Patch 3: `1b6442fe` (2026-09-14)
**Commit Message**: prompt: constitution#3 dedupe (3-failure rule already in RULES); remember tool requires task success/checkpoint

**File**: `assets/insight_fixed_structure.txt` (modified, +1/-1)
```diff
@@ -4,6 +4,6 @@ L1 Insight是极简索引，L2/L3变更时同步L1，索引必须极简。写记
 [CONSTITUTION]
 1. 改自身源码先请示；./内可自主实验，允许装包和portable工具
 2. 决策前查记忆，有SOP/utils必用；多次失败回看SOP；未查证不断言
-3. 分步执行，控制粒度，限制失败半径；3次失败请求干预
+3. 分步执行，控制粒度，限制失败半径
 4. 密钥文件仅引用，不读取/移动
 5. 写任何记忆前读META-SOP核验，memory下文件只能patch修改（除非新建）
```

**File**: `assets/insight_fixed_structure_en.txt` (modified, +1/-1)
```diff
@@ -4,6 +4,6 @@ L1 Insight is a minimal index; sync L1 when L2/L3 changes; keep index minimal. R
 [CONSTITUTION]
 1. Ask before modifying own source code; free to experiment within ./; installing packages and portable tools allowed
 2. Check memory before decisions; always use existing SOPs/utils; revisit SOPs on repeated failures; never assert without evidence
-3. Execute step by step, control granularity, limit blast radius; request intervention after 3 failures
+3. Execute step by step, control granularity, limit blast radius
 4. Key/secret files: reference only, never read or move
 5. Read META-SOP to verify before writing any memory; files under memory/ must be patched only (unless creating new)
\ No newline at end of file
```

**File**: `ga.py` (modified, +2/-1)
```diff
@@ -528,7 +528,8 @@ def do_start_long_term_update(self, args, response):
         '''Agent觉得当前任务完成后有重要信息需要记忆时调用此工具。'''
         prompt = '''### [总结提炼经验] 既然你觉得当前任务有重要信息需要记忆，请提取最近一次任务中【事实验证成功且长期有效】的环境事实、用户偏好、重要步骤，更新记忆。
 本工具是标记开启结算过程，若已在更新记忆过程或没有值得记忆的点，忽略本次调用。
-**如果没有经验证的，未来能用上的信息，忽略本次调用！**
+**如果没有经过验证的，未来能用上的信息，忽略本次调用！**
+**必须成功完成任务，或到达重要检查点才能进行记忆提炼，未成功完成则忽略本次调用！**
 **只能提取行动验证成功的信息**：
 - **环境事实**（路径/凭证/配置）→ `file_patch` 更新 L2，同步 L1
 - **复杂任务经验**（关键坑点/前置条件/重要步骤）→ L3 精简 SOP（只记你被坑得多次重试的核心要点）
```

---

### Incident Patch 4: `24aeead7` (2026-09-11)
**Commit Message**: p2p_ws_client: fast-fail reconnect (ws ping 15/10s; Signal.expect aborts on closed/error instead of waiting full timeout)

**File**: `frontends/p2p_ws_client.py` (modified, +19/-2)
```diff
@@ -140,7 +140,10 @@ def _signed_url(self):
         return signed_url(self.url, "ws", self.room, self.access_key)
 
     async def start(self):
-        self._ws = await websockets.connect(self._signed_url(), max_size=1 << 21)
+        # 半开连接(切网/熄屏)靠 ping 在 ~25s 内暴露，默认 20+20s 太慢
+        self._ws = await websockets.connect(
+            self._signed_url(), max_size=1 << 21, ping_interval=15, ping_timeout=10,
+        )
         self._ready.set()
         self._task = asyncio.create_task(self._loop())
         return self
@@ -162,7 +165,21 @@ def queue(self, type_: str) -> asyncio.Queue:
         return self._queues.setdefault(type_, asyncio.Queue())
 
     async def expect(self, type_: str, timeout: float = 15):
-        return await asyncio.wait_for(self.queue(type_).get(), timeout)
+        """等指定类型消息；连接关闭或服务端报错(如被顶号)时立即抛错，不傻等到超时。"""
+        want = asyncio.ensure_future(self.queue(type_).get())
+        fail = [asyncio.ensure_future(self.queue(t).get()) for t in ("closed", "error")]
+        try:
+            done, _ = await asyncio.wait(
+                [want, *fail], timeout=timeout, return_when=asyncio.FIRST_COMPLETED)
+            if want in done:
+                return want.result()
+            if not done:
+                raise asyncio.TimeoutError(f"no {type_!r} within {timeout}s")
+            raise ConnectionError(f"signal ended while waiting {type_!r}: {next(iter(done)).result()}")
+        finally:
+            for f in (want, *fail):
+                if not f.done():
+                    f.cancel()
 
     async def send(self, obj: dict, timeout: float = 15):
         """等连接就绪后发送；重连期间会阻塞而不是直接失败。"""
```

---

### Incident Patch 5: `71cf559f` (2026-09-02)
**Commit Message**: fix: str() session_id/tab_id; bump UA to 2.1.251; trim subagent.md

**File**: `TMWebDriver.py` (modified, +1/-1)
```diff
@@ -186,7 +186,7 @@ def _unregister_client(self, client: WebSocket) -> None:
             if session.ws_client == client: session.mark_disconnected()
     
     def execute_js(self, code, timeout=15, session_id=None) -> Any:  
-        if session_id is None: session_id = self.default_session_id  
+        if session_id is None: session_id = str(self.default_session_id)
         if self.is_remote:
             safe_print('remote_execute_js')
             response = self._remote_cmd({"cmd": "execute_js", "sessionId": session_id, 
```

**File**: `ga.py` (modified, +1/-1)
```diff
@@ -171,7 +171,7 @@ def web_execute_js(script, switch_tab_id=None, no_monitor=False):
     try:
         if driver is None: first_init_driver()
         if len(driver.get_all_sessions()) == 0: return {"status": "error", "msg": "没有可用的浏览器标签页，查L3记忆分析原因。"}
-        if switch_tab_id: driver.default_session_id = switch_tab_id
+        if switch_tab_id: driver.default_session_id = str(switch_tab_id)
         result = simphtml.execute_js_rich(script, driver, no_monitor=no_monitor)
         return result
     except Exception as e: return {"status": "error", "msg": format_error(e)}
```

**File**: `llmcore.py` (modified, +2/-2)
```diff
@@ -661,7 +661,7 @@ def _enum(key, valid):
         self.api_mode = 'responses' if mode in ('responses', 'response') else 'chat_completions'
         self.temperature = cfg.get('temperature', 1)
         self.max_tokens = cfg.get('max_tokens')
-        self.default_ua = "claude-cli/2.1.152 (external, cli)"
+        self.default_ua = "claude-cli/2.1.251 (external, cli)"
         self.user_agent = cfg.get("user_agent", self.default_ua)
     def _apply_claude_thinking(self, payload):
         if self.thinking_type:
@@ -773,7 +773,7 @@ def _fix_messages(messages):
     return merged
 
 class NativeClaudeSession(BaseSession):
-    native_ua = "claude-cli/2.1.152 (native, cli)"
+    native_ua = "claude-cli/2.1.251 (native, cli)"
     def __init__(self, cfg):
         super().__init__(cfg)
         self.fake_cc_system_prompt = cfg.get("fake_cc_system_prompt", False)
```

**File**: `memory/subagent.md` (modified, +0/-26)
```diff
@@ -33,29 +33,3 @@
 **用途**：N个独立同构子任务分发，独立上下文避免交叉污染
 **约束**：文件系统共享(优点)；键鼠不可共享；浏览器避免同tab
 **流程**：准备独立输入文件→每个启动subagent(--func优先)→收集输出汇总
-
-## subagent内部plan_mode使用
-**原则**：subagent本身是完整agent，接收多步骤任务时应在内部创建plan管理执行
-**触发条件**:任务包含3个以上子步骤、子步骤之间有依赖关系、需要checkpoint来恢复执行
-**实现方式**：
-1. **主agent创建subagent时**：在input.txt中说明任务包含多个步骤，建议使用plan_mode
-2. **subagent内部执行**：检测到多步骤任务后，创建 `./subagent_plan.md` 并使用plan_mode执行
-3. **主agent监控**：只关注最终结果（output*.txt），不需要关心subagent内部如何执行
-4. **文件传递机制**：主agent创建subagent时在task_dir中生成 `context.json`，包含所有文件的**绝对路径**
-   **⚠ subagent启动后第一步必须读取context.json**
-   **⚠ 所有文件操作必须使用context.json中的绝对路径**
-**格式示例**：
-```json
-{
-  "task": "任务描述",
-  "work_dir": "/absolute/path/to/plan_dir/",
-  "input_files": {
-    "paper_info": "/absolute/path/to/paper_info.txt"
-  },
-  "output_files": {
-    "pdf": "/absolute/path/to/paper.pdf",
-    "report": "/absolute/path/to/paper_report.md"
-  },
-  "dependencies": ["paper_info.txt必须存在"]
-}
-```
\ No newline at end of file
```

---

### Incident Patch 6: `7fa5fa4e` (2026-08-30)
**Commit Message**: fix: prevent WeChat polling from consuming chat input

**File**: `frontends/conductor.py` (modified, +5/-4)
```diff
@@ -809,11 +809,12 @@ def api_subagent_action(sid: str, body: SubagentActionIn):
     return JSONResponse({"error": f"unknown action: {body.action}"}, status_code=400)
 
 @app.get("/chat")
-def api_get_chat(last: int = 20):
+def api_get_chat(last: int = 20, mark_read: bool = True):
     items = [m.copy() for m in chat_messages[-last:]]
-    for m in chat_messages:
-        if m.get("role") == "user" and not m.get("read"): m["read"] = True
-    schedule_broadcast({"type": "chat_read"})
+    if mark_read:
+        for m in chat_messages:
+            if m.get("role") == "user" and not m.get("read"): m["read"] = True
+        schedule_broadcast({"type": "chat_read"})
     return {"items": items}
 
 @app.post("/chat")
```

**File**: `frontends/wechatapp.py` (modified, +1/-1)
```diff
@@ -338,7 +338,7 @@ def _cond_forward(bot, text, seq):
     seen = {mine['id']}
     while seq == _cond_seq:
         time.sleep(5)
-        try: items = requests.get(_COND, params={'last': 50}, timeout=10).json()['items']
+        try: items = requests.get(_COND, params={'last': 50, 'mark_read': 'false'}, timeout=10).json()['items']
         except Exception as e:
             print(f'[WX] conductor poll err: {e}', file=sys.__stdout__); continue
         for item in items:
```

---

### Incident Patch 7: `efb3bc6a` (2026-08-30)
**Commit Message**: feat(desktop): compiled React Desktop 2.0 v0.2.1 renderer update (#787)

* fix(desktop): expose explicit backup capabilities

* fix(desktop): align titlebar controls with native metrics

* release(desktop): prepare portable v0.2.1

* build(desktop): rebuild compiled dist from source 4a67226

Rebuild the compiled-only React Desktop 2.0 renderer from abraxas914/GenericAgent
main @4a67226, carrying the v0.2.1 iterations that PR #784 was closed to await:
live turn-timer persistence across session switch, Mixin image-to-path fallback,
folder drag-drop, per-turn duration, and image-thumbnail repair.

- dist/**: regenerated 98 manifest assets + entry HTML
- build-provenance.json: sourceCommit -> 4a67226, manifest sha256 recomputed
- verify-compiled-dist.mjs: expectedSourceCommit -> 4a67226
- dist/README.md: provenance source commit updated
- desktop_bridge.py, test_bridge_origin_security.py: synced to 4a67226
- core (agentmain.py, llmcore*, src/**, public/**) remains zero-diff vs upstream

---------

Co-authored-by: abraxas914 <[REDACTED_EMAIL]>

**File**: `.github/workflows/desktop-release-package.yml` (modified, +10/-4)
```diff
@@ -546,15 +546,24 @@ jobs:
   build-macos:
     name: macOS arm64 DMG
     if: ${{ (github.event_name == 'push' && startsWith(github.ref, 'refs/tags/desktop-portable-')) || (github.event_name == 'workflow_dispatch' && (github.event.inputs.target == 'all' || github.event.inputs.target == 'macos')) }}
-    runs-on: macos-15
+    runs-on: macos-26
     permissions:
       contents: read
+    env:
+      DEVELOPER_DIR: /Applications/Xcode_26.5.app/Contents/Developer
     steps:
       - name: Checkout repository
         uses: actions/checkout@93cb6efe18208431cddfb8368fd83d5badbf9bfd # v5.0.1
         with:
           persist-credentials: false
 
+      - name: Verify pinned macOS build environment
+        run: |
+          test "$(uname -m)" = arm64
+          test "$(xcodebuild -version | sed -n '1p')" = "Xcode 26.5"
+          test "$(xcodebuild -version | sed -n '2p')" = "Build version 17F42"
+          test "$(xcrun --sdk macosx --show-sdk-version)" = "26.5"
+
       - name: Set up Node.js
         uses: actions/setup-node@a0853c24544627f65ddf259abe73b1d18a591444 # v5.0.0
         with:
@@ -587,9 +596,6 @@ jobs:
           python3 -m pip install --require-hashes --only-binary=:all:
           --requirement frontends/desktop/packaging/dmg-build-requirements.txt
 
-      - name: Assert macOS runner architecture
-        run: test "$(uname -m)" = arm64
-
       - name: Verify tracked compiled renderer bytes
         working-directory: frontends/desktop
         run: npm run test:dist
```

**File**: `frontends/desktop/DESIGN.md` (modified, +1/-1)
```diff
@@ -69,7 +69,7 @@ existing core contracts.
 
 ## Version and release contract
 
-Desktop package metadata is `0.2.0` across npm, Cargo, Tauri, and generated provenance. Upstream packages consume
+Desktop package metadata is `0.2.1` across npm, Cargo, Tauri, and generated provenance. Upstream packages consume
 the tracked `dist/**` tree, so an upstream maintainer can build official Windows, Linux, and macOS artifacts
 without the React source. A `desktop-portable-*` tag starts three read-only platform builders. One separate
 publisher receives write permission only after all three succeed, validates the six expected files and checksums,
```

**File**: `frontends/desktop/dist/README.md` (modified, +2/-2)
```diff
@@ -1,6 +1,6 @@
 # GenericAgent React Desktop 2.0 — compiled distribution
 
-This directory contains generated HTML, JavaScript, CSS, fonts, images, and license notices for the
+This directory contains the v0.2.1 generated HTML, JavaScript, CSS, fonts, images, and license notices for the
 GenericAgent React Desktop 2.0 renderer. It is build output, not the React development tree.
 
 ## Source and contributions
@@ -9,7 +9,7 @@ The public React source of truth and the place for renderer issues, pull request
 
 - <https://github.com/abraxas914/GenericAgent>
 - Exact source used for this distribution:
-  [`9fe5d69b85cfad8778ace84b6f69bc75f9e0d392`](https://github.com/abraxas914/GenericAgent/commit/9fe5d69b85cfad8778ace84b6f69bc75f9e0d392)
+  [`4a67226e18cb003db1210357ea4a283774773acc`](https://github.com/abraxas914/GenericAgent/commit/4a67226e18cb003db1210357ea4a283774773acc)
 
 Over the two-month React Desktop 2.0 development cycle, [abraxas914](https://github.com/abraxas914) led the new
 renderer architecture and UI, Desktop bridge and Tauri integration, startup and recovery surfaces, package
```

**File**: `frontends/desktop/dist/assets/Animation-DbFrgT1j.js` (renamed, +1/-1)
```diff
@@ -1 +1 @@
-import{g as q}from"./tauri-compat-tfiFK9EG.js";var x,P;function Q(){if(P)return x;P=1;var i=4,t=.001,e=1e-7,s=10,n=11,a=1/(n-1),c=typeof Float32Array=="function";function l(u,o){return 1-3*o+3*u}function g(u,o){return 3*o-6*u}function T(u){return 3*u}function r(u,o,f){return((l(o,f)*u+g(o,f))*u+T(o))*u}function h(u,o,f){return 3*l(o,f)*u*u+2*g(o,f)*u+T(o)}function C(u,o,f,p,y){var m,_,F=0;do _=o+(f-o)/2,m=r(_,p,y)-u,m>0?f=_:o=_;while(Math.abs(m)>e&&++F<s);return _}function b(u,o,f,p){for(var y=0;y<i;++y){var m=h(o,f,p);if(m===0)return o;var _=r(o,f,p)-u;o-=_/m}return o}function d(u){return u}return x=function(o,f,p,y){if(!(0<=o&&o<=1&&0<=p&&p<=1))throw new Error("bezier x values must be in [0, 1] range");if(o===f&&p===y)return d;for(var m=c?new Float32Array(n):new Array(n),_=0;_<n;++_)m[_]=r(_*a,o,p);function F(v){for(var S=0,j=1,R=n-1;j!==R&&m[j]<=v;++j)S+=a;--j;var U=(v-m[j])/(m[j+1]-m[j]),A=S+U*a,k=h(A,o,p);return k>=t?b(v,A,o,p):k===0?A:C(v,S,S+a,o,p)}return function(S){return S===0?0:S===1?1:r(F(S),f,y)}},x}var K=Q();const z=q(K);function B(i,t,e){return Math.min(Math.max(i,t),e)}function W(i){const t=/\(([^)]+)\)/.exec(i);return t?t[1].split(",").map(e=>parseFloat(e)):[]}function V(){let i=arguments.length>0&&arguments[0]!==void 0?arguments[0]:1,t=arguments.length>1&&arguments[1]!==void 0?arguments[1]:.5;const e=B(i,1,10),s=B(t,.1,2);return n=>n===0||n===1?n:-e*Math.pow(2,10*(n-1))*Math.sin((n-1-s/(Math.PI*2)*Math.asin(1/e))*(Math.PI*2)/s)}const N=(()=>{const i=["Quad","Cubic","Quart","Quint","Sine","Expo","Circ","Back","Elastic"],t={In:[[.55,.085,.68,.53],[.55,.055,.675,.19],[.895,.03,.685,.22],[.755,.05,.855,.06],[.47,0,.745,.715],[.95,.05,.795,.035],[.6,.04,.98,.335],[.6,-.28,.735,.045],V],Out:[[.25,.46,.45,.94],[.215,.61,.355,1],[.165,.84,.44,1],[.23,1,.32,1],[.39,.575,.565,1],[.19,1,.22,1],[.075,.82,.165,1],[.175,.885,.32,1.275],(s,n)=>a=>1-V(s,n)(1-a)],InOut:[[.455,.03,.515,.955],[.645,.045,.355,1],[.77,0,.175,1],[.86,0,.07,1],[.445,.05,.55,.95],[1,0,0,1],[.785,.135,.15,.86],[.68,-.55,.265,1.55],(s,n)=>a=>a<.5?V(s,n)(a*2)/2:1-V(s,n)(a*-2+2)/2]},e={linear:[.25,.25,.75,.75]};for(const s of Object.keys(t))t[s].forEach((n,a)=>{e["ease"+s+i[a]]=n});return e})();function D(i){if(typeof i=="function")return i;!i||typeof i!="string"?i="linear":i=i.trim();let t=i.split("(")[0];const e=W(i);let s;return t==="cubic-bezier"||t==="cubicBezier"?z(...e.length?e:N.linear):((!t||typeof t!="string"||typeof t=="string"&&N[t]==null)&&(t="linear"),s=N[t],typeof s=="function"?s(...e):e.length?z(...e):z(...s))}class Z{constructor(){this._eventMap=new Map}on(t,e){return t&&typeof e=="function"&&(this._eventMap.has(t)||this._eventMap.set(t,[]),this._eventMap.get(t).push(e)),this}once(t,e){var s=this;if(t&&typeof e=="function"){const n=function(){e(...arguments),s.off(t,n)};this.on(t,n)}}off(t,e){if(t)if(typeof e=="function"){const s=this._eventMap.get(t);if(Array.isArray(s)&&s.length){let n=-1;for(;(n=s.findIndex(a=>a===e))>-1;)s.splice(n,1)}}else e==null&&this._eventMap.delete(t);return this}emit(t){for(var e=arguments.length,s=new Array(e>1?e-1:0),n=1;n<e;n++)s[n-1]=arguments[n];return this._eventMap.has(t)?(this._eventMap.get(t).forEach(a=>a(...s)),!0):!1}}function M(i){return!!(i&&typeof i=="object"&&(i.duration>0||typeof i.easing=="string"||typeof i.easing=="function"))}function H(i,t,e,s,n){for(const a of Object.keys(t)){const c=t[a],l=typeof c=="number"?c:c.val;if(!(typeof c=="object"&&c.done)){if(M(c)&&s&&n&&c.duration){if(c.duration+s<=n||l!==i[a])return!1}else if(typeof e[a]=="number"&&e[a]!==0)return!1;if(i[a]!==l)return!1}}return!0}function E(i){const t={};for(const e in i)Object.prototype.hasOwnProperty.call(i,e)&&(t[e]=typeof i[e]=="number"?i[e]:i[e].val);return t}const I=[0,0];function L(i,t,e,s,n,a,c){const l=-n*(t-s),g=-a*e,T=l+g,r=e+T*i,h=t+r*i;return Math.abs(r)<c&&Math.abs(h-s)<c?(I[0]=s,I[1]=0,I):(I[0]=h,I[1]=r,I)}function J(i){const t={},e=i&&Object.keys(i)||[];for(const s of e)t[s]=0;return t}const $={default:{tension:170,friction:26}},Y=Object.assign(Object.assign({},$.default),{precision:.01});function G(i){let t=arguments.length>1&&arguments[1]!==void 0?arguments[1]:{};if(M(t)){const s=D(t.easing),n=typeof t.duration=="number"&&t.duration>0?t.duration:1e3;t=Object.assign(Object.assign({},t),{easing:s,duration:n})}let e=Object.assign(Object.assign(Object.assign({},Y),t),{done:!1});if(i&&typeof i=="object"&&"val"in i){if(M(i)){const s=D(i.easing),n=typeof i.duration=="number"&&i.duration>0?i.duration:parseInt(t.duration)||1e3;i=Object.assign(Object.assign({},i),{easing:s,duration:n})}e=Object.assign(Object.assign({},e),i)}else e=Object.assign(Object.assign({},e),{val:i});return e}const w=()=>Date.now(),O=1e3/60;class tt extends Z{constructor(){let t=arguments.length>0&&arguments[0]!==void 0?arguments[0]:{},e=arguments.length>1&&arguments[1]!==void 0?arguments[1]:{};super(),this._props=Object.assign({},t),this._config=Object.assign({},e),this.initStates()}_wrapConfig(t,e){e=e&&typeof 
```

**File**: `frontends/desktop/dist/assets/CollabPage-BSH3y36_.js` (removed, +0/-1)
```diff
@@ -1 +0,0 @@
-import{b as r,aj as l}from"./tauri-compat-tfiFK9EG.js";import{H as i,b as N,J as C,K as S,L as M,N as T,O as v,M as E,P as W}from"./main-BlLQtfpq.js";import{MarkdownPart as w}from"./MarkdownPart-B6YIH_Oj.js";import"./index-Bpi3BHKj.js";import"./WindowsTitlebar-CrkUa1UM.js";import"./markdown-preprocess-6737_jWr.js";function R(e){const c=Math.floor(e/1e3);if(c<60)return`${c}s`;const a=Math.floor(c/60),n=c%60;return`${a}m ${n}s`}function $({since:e}){const[c,a]=r.useState(Date.now());return r.useEffect(()=>{const n=setInterval(()=>a(Date.now()),1e3);return()=>clearInterval(n)},[]),l.jsx(l.Fragment,{children:R(c-e)})}const D=200;function P({message:e}){const c=e.role==="user",a=e.role==="conductor";return l.jsx("div",{className:`collab-msg collab-msg--${e.role}`,"data-slot":"collab-msg",children:l.jsxs("div",{className:`collab-bubble ${c?"collab-bubble--user":a?"collab-bubble--conductor":"collab-bubble--system"}`,children:[e.images&&e.images.length>0&&l.jsx("div",{className:"collab-msg-images",children:e.images.map((n,s)=>l.jsx("img",{src:n.base64||n.path,alt:n.name,className:"collab-msg-img"},s))}),e.files&&e.files.length>0&&l.jsx("div",{className:"collab-msg-files",children:e.files.map((n,s)=>l.jsx("span",{className:"collab-msg-file-chip",children:n.name},s))}),a||e.role==="system"?l.jsx(w,{content:e.msg}):l.jsx("span",{className:"collab-msg-text",children:e.msg})]})})}function B({since:e}){const{t:c}=N();return l.jsx("div",{className:"collab-msg collab-msg--conductor","data-slot":"collab-typing",children:l.jsxs("div",{className:"collab-thinking-bar",children:[l.jsx("span",{className:"collab-thinking-dot"}),l.jsx("span",{className:"collab-thinking-label",children:c("collab.typing")}),l.jsx("span",{className:"collab-thinking-time",children:l.jsx($,{since:e})})]})})}function I(){const e=i(o=>o.messages),c=i(o=>o.conductorTyping),a=i(o=>o.connectionStatus),{t:n}=N(),{scrollRef:s}=C(),[u,x]=r.useState(1),d=r.useRef(null),p=r.useRef(0);r.useEffect(()=>{(a==="connecting"||e.length===0)&&x(1)},[a,e.length]);const b=D*u,m=Math.max(0,e.length-b),k=e.slice(m),t=m,g=r.useCallback(()=>{const o=s.current;o&&(d.current=o.scrollHeight-o.scrollTop),x(h=>h+1)},[s]);r.useLayoutEffect(()=>{if(d.current==null)return;if(m>=p.current){d.current=null,p.current=m;return}const o=s.current;o&&(o.scrollTop=o.scrollHeight-d.current),d.current=null,p.current=m},[m,s]),r.useEffect(()=>{p.current=m},[m]);const j=[...e].reverse().find(o=>o.role==="user"),y=o=>o>1e12?o:o*1e3,f=r.useRef(Date.now());return j!=null&&j.ts&&(f.current=y(j.ts)),a==="connecting"?l.jsx("div",{className:"collab-messages-area","data-slot":"collab-messages",children:l.jsxs("div",{className:"collab-connecting",children:[l.jsx("span",{className:"collab-connecting-dot"}),l.jsx("span",{children:n("status.connecting")})]})}):e.length===0?l.jsx("div",{className:"collab-messages-area","data-slot":"collab-messages",children:l.jsx("div",{className:"collab-empty",children:l.jsx("p",{children:n("collab.placeholder")})})}):l.jsx("div",{className:"collab-messages-area","data-slot":"collab-messages",ref:s,children:l.jsxs("div",{className:"collab-messages-scroll",children:[t>0&&l.jsxs("button",{type:"button","data-slot":"show-earlier-btn",onClick:g,children:["Show ",t," earlier"]}),k.map((o,h)=>l.jsx(P,{message:o},o.id||m+h)),c&&l.jsx(B,{since:f.current})]})})}function F(){const e=i(t=>t.sendMessage),c=i(t=>t.conductorTyping),a=i(t=>t.connectionStatus),n=i(t=>t.modelConfig),s=i(t=>t.runtimeModel),u=i(t=>t.loadModel),x=i(t=>t.selectModel),d=S(t=>t.defaultModelNo);r.useEffect(()=>{u()},[u]);const p=r.useCallback((t,g)=>{var f,o;const j=(f=g==null?void 0:g.files)==null?void 0:f.map(h=>({name:h.name,path:h.path})),y=(o=g==null?void 0:g.images)==null?void 0:o.map(h=>({name:h.name,path:h.path,base64:h.base64}));e(t,j,y)},[e]),b=r.useCallback(()=>{},[]),m=a!=="ready",k=(n==null?void 0:n.effective)??(n==null?void 0:n.configured)??d;return l.jsx("div",{className:"collab-composer-wrap","data-slot":"collab-composer","data-disabled":m||void 0,children:l.jsx(M,{onSend:p,onStop:b,isGenerating:c,hideStatusStack:!0,modelControl:l.jsx(T,{selectedNo:k,runningNo:s!=null&&s.running?s.effective:null,isRunning:!!(s!=null&&s.running),onSelect:x})})})}const H=[{key:"1",icon:"comment"},{key:"2",icon:"symbol-misc"},{key:"3",icon:"graph"},{key:"4",icon:"edit"}],L=["collab.chipProgress","collab.chipPause","collab.chipSummary"];function O({onChipClick:e}){const{t:c}=N();return l.jsxs("div",{className:"collab-welcome","data-slot":"collab-welcome",children:[l.jsx("h2",{className:"collab-welcome-title",children:c("collab.guideTitle")}),l.jsx("p",{className:"collab-welcome-sub",children:c("collab.guideWhen")}),l.jsx("div",{className:"collab-welcome-steps",children:H.map(a=>l.jsxs("div",{className:"collab-welcome-step",children:[l.jsx("span",{className:"collab-welcome-step-icon",children:l.jsx(v,{name:a.icon,size:"1rem"})}),l.jsxs("span",{className:"collab-welcome-step-text",children:[l.jsx("span",{cla
```

**File**: `frontends/desktop/dist/assets/CollabPage-DD4zkzQv.js` (added, +1/-0)
```diff
@@ -0,0 +1 @@
+import{b as r,aj as l}from"./tauri-compat-D_GD_wMe.js";import{H as i,b as N,J as C,L as S,K as M,N as T,O as W,P as v,M as R,Q as E}from"./main-j7e_THPB.js";import{MarkdownPart as w}from"./MarkdownPart-ZJKeOipX.js";import"./index-9FI8Jlf5.js";import"./WindowsTitlebar-Byi-SYR_.js";import"./markdown-preprocess-Cc2i34eF.js";const $=200;function D({message:a}){const n=a.role==="user",e=a.role==="conductor";return l.jsx("div",{className:`collab-msg collab-msg--${a.role}`,"data-slot":"collab-msg",children:l.jsxs("div",{className:`collab-bubble ${n?"collab-bubble--user":e?"collab-bubble--conductor":"collab-bubble--system"}`,children:[a.images&&a.images.length>0&&l.jsx("div",{className:"collab-msg-images",children:a.images.map((c,s)=>l.jsx("img",{src:c.base64||c.path,alt:c.name,className:"collab-msg-img"},s))}),a.files&&a.files.length>0&&l.jsx("div",{className:"collab-msg-files",children:a.files.map((c,s)=>l.jsx("span",{className:"collab-msg-file-chip",children:c.name},s))}),e||a.role==="system"?l.jsx(w,{content:a.msg}):l.jsx("span",{className:"collab-msg-text",children:a.msg})]})})}function P({since:a}){const{t:n}=N();return l.jsx("div",{className:"collab-msg collab-msg--conductor","data-slot":"collab-typing",children:l.jsxs("div",{className:"collab-thinking-bar",children:[l.jsx("span",{className:"collab-thinking-dot"}),l.jsx("span",{className:"collab-thinking-label",children:n("collab.typing")}),l.jsx("span",{className:"collab-thinking-time",children:l.jsx(S,{since:a})})]})})}function B(){const a=i(o=>o.messages),n=i(o=>o.conductorTyping),e=i(o=>o.connectionStatus),{t:c}=N(),{scrollRef:s}=C(),[m,x]=r.useState(1),d=r.useRef(null),p=r.useRef(0);r.useEffect(()=>{(e==="connecting"||a.length===0)&&x(1)},[e,a.length]);const b=$*m,u=Math.max(0,a.length-b),k=a.slice(u),t=u,g=r.useCallback(()=>{const o=s.current;o&&(d.current=o.scrollHeight-o.scrollTop),x(h=>h+1)},[s]);r.useLayoutEffect(()=>{if(d.current==null)return;if(u>=p.current){d.current=null,p.current=u;return}const o=s.current;o&&(o.scrollTop=o.scrollHeight-d.current),d.current=null,p.current=u},[u,s]),r.useEffect(()=>{p.current=u},[u]);const j=[...a].reverse().find(o=>o.role==="user"),y=o=>o>1e12?o:o*1e3,f=r.useRef(Date.now());return j!=null&&j.ts&&(f.current=y(j.ts)),e==="connecting"?l.jsx("div",{className:"collab-messages-area","data-slot":"collab-messages",children:l.jsxs("div",{className:"collab-connecting",children:[l.jsx("span",{className:"collab-connecting-dot"}),l.jsx("span",{children:c("status.connecting")})]})}):a.length===0?l.jsx("div",{className:"collab-messages-area","data-slot":"collab-messages",children:l.jsx("div",{className:"collab-empty",children:l.jsx("p",{children:c("collab.placeholder")})})}):l.jsx("div",{className:"collab-messages-area","data-slot":"collab-messages",ref:s,children:l.jsxs("div",{className:"collab-messages-scroll",children:[t>0&&l.jsxs("button",{type:"button","data-slot":"show-earlier-btn",onClick:g,children:["Show ",t," earlier"]}),k.map((o,h)=>l.jsx(D,{message:o},o.id||u+h)),n&&l.jsx(P,{since:f.current})]})})}function H(){const a=i(t=>t.sendMessage),n=i(t=>t.conductorTyping),e=i(t=>t.connectionStatus),c=i(t=>t.modelConfig),s=i(t=>t.runtimeModel),m=i(t=>t.loadModel),x=i(t=>t.selectModel),d=M(t=>t.defaultModelNo);r.useEffect(()=>{m()},[m]);const p=r.useCallback((t,g)=>{var f,o;const j=(f=g==null?void 0:g.files)==null?void 0:f.map(h=>({name:h.name,path:h.path})),y=(o=g==null?void 0:g.images)==null?void 0:o.map(h=>({name:h.name,path:h.path,base64:h.base64}));a(t,j,y)},[a]),b=r.useCallback(()=>{},[]),u=e!=="ready",k=(c==null?void 0:c.effective)??(c==null?void 0:c.configured)??d;return l.jsx("div",{className:"collab-composer-wrap","data-slot":"collab-composer","data-disabled":u||void 0,children:l.jsx(T,{onSend:p,onStop:b,isGenerating:n,hideStatusStack:!0,modelControl:l.jsx(W,{selectedNo:k,runningNo:s!=null&&s.running?s.effective:null,isRunning:!!(s!=null&&s.running),onSelect:x})})})}const L=[{key:"1",icon:"comment"},{key:"2",icon:"symbol-misc"},{key:"3",icon:"graph"},{key:"4",icon:"edit"}],F=["collab.chipProgress","collab.chipPause","collab.chipSummary"];function I({onChipClick:a}){const{t:n}=N();return l.jsxs("div",{className:"collab-welcome","data-slot":"collab-welcome",children:[l.jsx("h2",{className:"collab-welcome-title",children:n("collab.guideTitle")}),l.jsx("p",{className:"collab-welcome-sub",children:n("collab.guideWhen")}),l.jsx("div",{className:"collab-welcome-steps",children:L.map(e=>l.jsxs("div",{className:"collab-welcome-step",children:[l.jsx("span",{className:"collab-welcome-step-icon",children:l.jsx(v,{name:e.icon,size:"1rem"})}),l.jsxs("span",{className:"collab-welcome-step-text",children:[l.jsx("span",{className:"collab-welcome-step-label",children:n(`collab.guideStep${e.key}t`)}),l.jsx("span",{className:"collab-welcome-step-desc",children:n(`collab.guideStep${e.key}d`)})]})]},e.key))}),l.jsx("div",{className:"collab-welcome-chips",children:F.map(e=>l.jsx("button",{type:"button",className:"collab-w
```

**File**: `frontends/desktop/dist/assets/IconFile-C8B3WX2U.js` (renamed, +1/-1)
```diff
@@ -1 +1 @@
-import{c as t,b as e}from"./tauri-compat-tfiFK9EG.js";function n(a){return e.createElement("svg",Object.assign({viewBox:"0 0 24 24",fill:"none",xmlns:"http://www.w3.org/2000/svg",width:"1em",height:"1em",focusable:!1,"aria-hidden":!0},a),e.createElement("path",{fillRule:"evenodd",clipRule:"evenodd",d:"M12 2a1 1 0 0 0-1-1H6a2 2 0 0 0-2 2v18c0 1.1.9 2 2 2h12a2 2 0 0 0 2-2V10a1 1 0 0 0-1-1h-5a2 2 0 0 1-2-2V2ZM7 8a1 1 0 0 1 1-1h1a1 1 0 0 1 0 2H8a1 1 0 0 1-1-1Zm0 5a1 1 0 0 1 1-1h8a1 1 0 1 1 0 2H8a1 1 0 0 1-1-1Zm1 4a1 1 0 1 0 0 2h8a1 1 0 1 0 0-2H8Zm11.07-9.5H14.5a1 1 0 0 1-1-1V1.93a.8.8 0 0 1 1.37-.56l4.76 4.76a.8.8 0 0 1-.56 1.37Z",fill:"currentColor"}))}const l=t(n,"file");export{l as I};
+import{c as t,b as e}from"./tauri-compat-D_GD_wMe.js";function n(a){return e.createElement("svg",Object.assign({viewBox:"0 0 24 24",fill:"none",xmlns:"http://www.w3.org/2000/svg",width:"1em",height:"1em",focusable:!1,"aria-hidden":!0},a),e.createElement("path",{fillRule:"evenodd",clipRule:"evenodd",d:"M12 2a1 1 0 0 0-1-1H6a2 2 0 0 0-2 2v18c0 1.1.9 2 2 2h12a2 2 0 0 0 2-2V10a1 1 0 0 0-1-1h-5a2 2 0 0 1-2-2V2ZM7 8a1 1 0 0 1 1-1h1a1 1 0 0 1 0 2H8a1 1 0 0 1-1-1Zm0 5a1 1 0 0 1 1-1h8a1 1 0 1 1 0 2H8a1 1 0 0 1-1-1Zm1 4a1 1 0 1 0 0 2h8a1 1 0 1 0 0-2H8Zm11.07-9.5H14.5a1 1 0 0 1-1-1V1.93a.8.8 0 0 1 1.37-.56l4.76 4.76a.8.8 0 0 1-.56 1.37Z",fill:"currentColor"}))}const l=t(n,"file");export{l as I};
```

**File**: `frontends/desktop/dist/assets/MarkdownPart-ZJKeOipX.js` (renamed, +1/-1)
```diff
@@ -1,4 +1,4 @@
-var an=Object.defineProperty;var nn=(r,e,t)=>e in r?an(r,e,{enumerable:!0,configurable:!0,writable:!0,value:t}):r[e]=t;var nr=(r,e,t)=>nn(r,typeof e!="symbol"?e+"":e,t);import{bs as ir,g as sn,b as a0,aj as U}from"./tauri-compat-tfiFK9EG.js";import{M as ln,r as on,a as un,b as cn,p as hn,S as dn}from"./markdown-preprocess-6737_jWr.js";import{Q as sr,S as mn,U as pn}from"./main-BlLQtfpq.js";import"./index-Bpi3BHKj.js";import"./WindowsTitlebar-CrkUa1UM.js";var at={exports:{}},lr;function fn(){return lr||(lr=1,(function(r){var e=typeof window<"u"?window:typeof WorkerGlobalScope<"u"&&self instanceof WorkerGlobalScope?self:{};/**
+var an=Object.defineProperty;var nn=(r,e,t)=>e in r?an(r,e,{enumerable:!0,configurable:!0,writable:!0,value:t}):r[e]=t;var nr=(r,e,t)=>nn(r,typeof e!="symbol"?e+"":e,t);import{bs as ir,g as sn,b as a0,aj as U}from"./tauri-compat-D_GD_wMe.js";import{M as ln,r as on,a as un,b as cn,p as hn,S as dn}from"./markdown-preprocess-Cc2i34eF.js";import{S as sr,U as mn,V as pn}from"./main-j7e_THPB.js";import"./index-9FI8Jlf5.js";import"./WindowsTitlebar-Byi-SYR_.js";var at={exports:{}},lr;function fn(){return lr||(lr=1,(function(r){var e=typeof window<"u"?window:typeof WorkerGlobalScope<"u"&&self instanceof WorkerGlobalScope?self:{};/**
  * Prism: Lightweight, robust, elegant syntax highlighting
  *
  * @license MIT <https://opensource.org/licenses/MIT>
```

---

### Incident Patch 8: `17d9f4d8` (2026-08-27)
**Commit Message**: fix(wechatapp): avoid evaluating Win creationflags on Linux

_start_conductor built DETACHED_PROCESS/CREATE_NEW_PROCESS_GROUP before the
os.name=='nt' branch, causing AttributeError and crashing Conductor autostart
on Ubuntu. Keep those flags Windows-only; Linux uses start_new_session.

**File**: `frontends/wechatapp.py` (modified, +7/-3)
```diff
@@ -312,9 +312,13 @@ def _cond_up():
 
 def _start_conductor():
     if _cond_up(): return True
-    flags = (subprocess.DETACHED_PROCESS | subprocess.CREATE_NEW_PROCESS_GROUP |
-             getattr(subprocess, 'CREATE_NO_WINDOW', 0))
-    kw = {'creationflags': flags} if os.name == 'nt' else {'start_new_session': True}
+    # Win-only creationflags must not be evaluated on Linux (AttributeError).
+    if os.name == 'nt':
+        flags = (subprocess.DETACHED_PROCESS | subprocess.CREATE_NEW_PROCESS_GROUP |
+                 getattr(subprocess, 'CREATE_NO_WINDOW', 0))
+        kw = {'creationflags': flags}
+    else:
+        kw = {'start_new_session': True}
     try:
         subprocess.Popen([sys.executable, os.path.join(os.path.dirname(__file__), 'conductor.py'), '--no-browser'],
                          cwd=os.path.dirname(__file__), stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, **kw)
```

---

### Incident Patch 9: `3d62523d` (2026-08-25)
**Commit Message**: fix(abort): force-wake blocked stream recv via socket _real_close; interruptible retry backoff

**File**: `agentmain.py` (modified, +11/-0)
```diff
@@ -116,6 +116,17 @@ def abort(self):
         if self.handler is not None: self.handler.code_stop_signal.append(1)
         for sess in getattr(self.llmclient.backend, '_sessions', [self.llmclient.backend]):
             sess.should_stop = lambda: self.stop_sig  # live read; cleared by run()'s finally
+            try:  # wake a recv() blocked in another thread. Verified on Windows: shutdown()/close() do NOT
+                  # wake it (makefile refcount defers real closesocket); _real_close() does -> ChunkedEncodingError
+                import socket as _socket
+                raw = sess.active_response.raw
+                fp = getattr(getattr(raw, '_fp', None), 'fp', None)  # http.client response -> buffered socket file
+                sock = fp.raw._sock if fp else raw.connection.sock   # SocketIO._sock (SSL-wrapped OK); fallback urllib3 conn
+                try: sock.shutdown(_socket.SHUT_RDWR)  # for non-Windows semantics
+                except OSError: pass
+                try: sock._real_close()  # CPython internal; bypasses refcount -> actual closesocket
+                except AttributeError: sock.close()
+            except Exception: pass
             try: sess.active_response.close()
             except Exception: pass
             
```

**File**: `llmcore.py` (modified, +12/-2)
```diff
@@ -446,7 +446,15 @@ def _delay(resp, attempt):
         try: ra = float((resp.headers or {}).get("retry-after"))
         except: ra = None
         return None if ra and ra > cap else max(0.5, ra or min(30.0, 3.0 * (2 ** attempt)))
+    def _stopped(): return getattr(sess, 'should_stop', None) and sess.should_stop()
+    def _sleep(d):  # interruptible sleep; True if aborted
+        end = time.time() + d
+        while time.time() < end:
+            if _stopped(): return True
+            time.sleep(0.2)
+        return _stopped()
     for attempt in range(sess.max_retries + 1):
+        if _stopped(): return []
         streamed = False
         STATS.update(t_start=time.time(), t_ttft=None)
         if not sess.stream: STATS['t_ttft'] = STATS['t_start']
@@ -459,7 +467,8 @@ def _delay(resp, attempt):
                     d = _delay(r, attempt) if r.status_code in _RETRYABLE and attempt < sess.max_retries else None
                     if d is not None:
                         print(f"[LLM Retry] HTTP {r.status_code}, retry in {d:.1f}s ({attempt+1}/{sess.max_retries+1})")
-                        time.sleep(d); continue
+                        if _sleep(d): return []
+                        continue
                     try: body = r.text.strip()[:500]
                     except: body = ""
                     err = f"!!!Error: HTTP {r.status_code}" + (f" (retry-after > {cap:.0f}s)" if d is None and r.status_code in _RETRYABLE and attempt < sess.max_retries else "") + (f": {body}" if body else "")
@@ -483,7 +492,8 @@ def _delay(resp, attempt):
             if attempt < sess.max_retries:
                 d = _delay(None, attempt)
                 print(f"[LLM Retry] {type(e).__name__}, retry in {d:.1f}s ({attempt+1}/{sess.max_retries+1})")
-                time.sleep(d); continue
+                if _sleep(d): return []
+                continue
             yield err; return [{"type": "text", "text": err}]
         except Exception as e:
             err = f"\n\n[!!! 流异常中断 {type(e).__name__}: {e} !!!]" if streamed else f"!!!Error: {type(e).__name__}: {e}"
```

---

### Incident Patch 10: `13eef203` (2026-08-25)
**Commit Message**: fix(stats): compute decode TPS at stream end

**File**: `frontends/stapp.py` (modified, +3/-4)
```diff
@@ -284,16 +284,15 @@ def _poll_main_task(max_items=256):
 
 def _render_stat_badge(is_running):
     if 'task_start_ts' not in st.session_state or not hasattr(llmcore, 'STATS'): return
-    end_ts = time.time() if is_running else st.session_state.get('task_end_ts', time.time())
+    now = time.time()
+    end_ts = now if is_running else st.session_state.get('task_end_ts', now)
     secs = max(0, int(end_ts - st.session_state.task_start_ts))
     stats = dict(llmcore.STATS)
     short = lambda n: f'{n / 1000:.0f}k' if n >= 1000 else str(n)
     _p = []
     if stats.get('t_start') and stats.get('t_ttft') is not None and stats['t_ttft'] != stats['t_start']:
         _p.append(f"ttft{stats['t_ttft'] - stats['t_start']:.1f}s")
-    _gen = (stats['t_end'] - max(stats['t_ttft'], stats['t_start'])) if (stats.get('t_end') and stats.get('t_ttft') is not None) else None
-    if _gen and stats.get('out'):
-        _p.append(f"{stats['out'] / _gen:.0f}t/s")
+    if stats.get('tps'): _p.append(f"{stats['tps']:.0f}t/s")
     _tail = (' │ ' + '·'.join(_p)) if _p else ''
     usage = ((f"{stats['session']} │ " if stats.get('session') else '') +
              f"{short(stats['ctx'])} chars·{stats['msgs']}msgs │ "
```

**File**: `llmcore.py` (modified, +1/-0)
```diff
@@ -475,6 +475,7 @@ def _delay(resp, attempt):
                 except StopIteration as e:
                     if not e.value and not streamed: raise requests.ConnectionError("empty response")
                     STATS['t_end'] = time.time()
+                    STATS['tps'] = STATS.get('out', 0) / max(1e-9, STATS['t_end'] - max(STATS['t_ttft'] or 0, STATS['t_start']))
                     return e.value or []
         except (requests.Timeout, requests.ConnectionError, requests.exceptions.ChunkedEncodingError) as e:
             err = f"!!!Error: {type(e).__name__}: {e}" if str(e) else f"!!!Error: {type(e).__name__}"
```

---

### Incident Patch 11: `3327a6c8` (2026-08-25)
**Commit Message**: fix stream recovery and runtime metrics

**File**: `assets/sys_prompt.txt` (modified, +1/-1)
```diff
@@ -1,7 +1,7 @@
 # Role: 物理级全能执行者
 你拥有文件读写、脚本执行、用户浏览器JS注入、系统级干预的物理操作权限。禁止推诿"无法操作"——不空想，用工具探测。
 ## 行动原则
-调用工具前先推演：当前阶段、上步结果是否符合预期、下步策略，必须在回复文本中用<summary>输出极简总结。
+调用工具前先推演：当前阶段、上步结果是否符合预期、下步策略，必须在回复文本头部用小于30词<summary>输出极简总结。
 - 探测优先：失败时先充分获取信息（日志/状态/上下文），关键信息存入工作记忆，再决定重试或换方案。不可逆操作先询问用户。
 - 失败升级：1次→读错误理解原因，2次→探测环境状态，3次→深度分析后换方案或问用户。禁止无新信息的重复操作。
 - 行动也是认识：边推进边用现实反馈校正方向，内部解释与计划只作暂时假说。根据任务选择高级sop调用
```

**File**: `assets/sys_prompt_en.txt` (modified, +2/-1)
```diff
@@ -2,6 +2,7 @@
 You have full physical access: file I/O, script execution, browser JS injection, and system-level intervention. Never deflect with "can't do it" — don't speculate, use tools to probe.
 Summarize and reply in user's language or follow user's prompt.
 ## Action Principles
-Before each tool call, reason: current phase, whether the last result met expectations, and next strategy and <summary> in reply text of each turn.
+Before each tool call, reason: current phase, whether the last result met expectations, and next strategy in reply text of each turn.
+<summary> (<30 tokens) before reply text.
 - Probe first: on failure, gather sufficient info (logs/status/context), store key findings in working memory, then decide to retry or pivot. Ask the user before irreversible operations.
 - Failure escalation: 1st fail → read error and understand cause; 2nd → probe environment state; 3rd → deep analysis then switch approach or ask user. Never repeat an action without new information.
\ No newline at end of file
```

**File**: `frontends/stapp.py` (modified, +15/-3)
```diff
@@ -288,12 +288,18 @@ def _render_stat_badge(is_running):
     secs = max(0, int(end_ts - st.session_state.task_start_ts))
     stats = dict(llmcore.STATS)
     short = lambda n: f'{n / 1000:.0f}k' if n >= 1000 else str(n)
+    _p = []
+    if stats.get('t_start') and stats.get('t_ttft') is not None and stats['t_ttft'] != stats['t_start']:
+        _p.append(f"ttft{stats['t_ttft'] - stats['t_start']:.1f}s")
+    _gen = (stats['t_end'] - max(stats['t_ttft'], stats['t_start'])) if (stats.get('t_end') and stats.get('t_ttft') is not None) else None
+    if _gen and stats.get('out'):
+        _p.append(f"{stats['out'] / _gen:.0f}t/s")
+    _tail = (' │ ' + '·'.join(_p)) if _p else ''
     usage = ((f"{stats['session']} │ " if stats.get('session') else '') +
              f"{short(stats['ctx'])} chars·{stats['msgs']}msgs │ "
-             f"in {short(stats.get('inp', 0))} toks·cached{short(stats.get('cached', 0))}·out{short(stats.get('out', 0))} │ "
+             f"in {short(stats.get('inp', 0))} toks·cached{short(stats.get('cached', 0))}·out{short(stats.get('out', 0))}{_tail}"
              if 'ctx' in stats else '')
-    st.markdown(f'<div class="ga-stat-badge">{usage}{secs // 60}:{secs % 60:02d}</div>',
-                unsafe_allow_html=True)
+    st.markdown(f'<div class="ga-stat-badge">{usage} │ {secs // 60}:{secs % 60:02d}</div>', unsafe_allow_html=True)
 
 
 if not hasattr(agent, "_ui_messages"): agent._ui_messages = st.session_state.get("messages", [])
@@ -359,6 +365,7 @@ def _reset_and_rerun():
         st.session_state.reply_ts = ""
         st.session_state.current_prompt = ""
         st.session_state.last_reply_time = int(time.time())
+        st.session_state.show_full_history = False
         st.rerun()
     def _slash_missing(name):
         st.session_state.messages.extend([
@@ -379,6 +386,11 @@ def _slash_missing(name):
         target = sessions[idx][0] if 0 <= idx < len(sessions) else None
         result = handle_frontend_command(agent, cmd)
         history = extract_ui_messages(target) if target and result.startswith('✅') else None
+        if history:
+            for x in history:
+                if x['role'] == 'assistant' and len(x['content']) > 120_000:
+                    m = re.search(r'\**LLM Running \(Turn \d+\) \.\.\.\**', x['content'][-120_000:])
+                    x['content'] = x['content'][-120_000 + m.start():] if m else ''
         tail = [{"role": "assistant", "content": result, "time": ts}]
         if history: st.session_state.messages[:] = history + tail
         else: st.session_state.messages.extend([{"role": "user", "content": cmd, "time": ts}] + tail)
```

**File**: `llmcore.py` (modified, +9/-1)
```diff
@@ -448,6 +448,8 @@ def _delay(resp, attempt):
         return None if ra and ra > cap else max(0.5, ra or min(30.0, 3.0 * (2 ** attempt)))
     for attempt in range(sess.max_retries + 1):
         streamed = False
+        STATS.update(t_start=time.time(), t_ttft=None)
+        if not sess.stream: STATS['t_ttft'] = STATS['t_start']
         try:
             with requests.post(url, headers=headers, json=payload, stream=sess.stream, 
                                timeout=(sess.connect_timeout, sess.read_timeout), proxies=sess.proxies, verify=sess.verify) as r:
@@ -464,9 +466,15 @@ def _delay(resp, attempt):
                     yield err; return [{"type": "text", "text": err}]
                 gen = parse_fn(r)
                 try:
-                    while True: chunk = next(gen); streamed = True; yield chunk
+                    while True:
+                        if getattr(sess, 'should_stop', None) and sess.should_stop():
+                            STATS['t_end'] = time.time(); return []
+                        chunk = next(gen)
+                        if chunk and STATS.get('t_ttft') is None: STATS['t_ttft'] = time.time()
+                        streamed = True; yield chunk
                 except StopIteration as e:
                     if not e.value and not streamed: raise requests.ConnectionError("empty response")
+                    STATS['t_end'] = time.time()
                     return e.value or []
         except (requests.Timeout, requests.ConnectionError, requests.exceptions.ChunkedEncodingError) as e:
             err = f"!!!Error: {type(e).__name__}: {e}" if str(e) else f"!!!Error: {type(e).__name__}"
```

---

### Incident Patch 12: `3deca045` (2026-08-24)
**Commit Message**: fix: remove stale star history & fix gaagent.ai link in license section

**File**: `README.md` (modified, +1/-16)
```diff
@@ -798,21 +798,6 @@ GA Web 工具运行在**真实、持久化的 Chrome/Chromium 会话**中，而
 
 基于 **MIT License** 发布，详见 [`LICENSE`](LICENSE)。
 
-> *声明：GenericAgent 官方渠道为本 GitHub 仓库和 https://gaagent.ai。DintalClaw 是目前唯一官方授权的商业合作方；除非在此处明确列出，其他使用 GenericAgent 名义的第三方网站、机构、组织或个人均非官方。*
+> *声明：GenericAgent 官方渠道为本 GitHub 仓库和 [https://gaagent.ai](https://gaagent.ai)。DintalClaw 是目前唯一官方授权的商业合作方；除非在此处明确列出，其他使用 GenericAgent 名义的第三方网站、机构、组织或个人均非官方。*
 
----
-
-## 📈 Star History
-
-<div align="center">
-
-<a href="https://star-history.com/#lsdefine/GenericAgent&Date">
-  <picture>
-    <source media="(prefers-color-scheme: dark)" srcset="https://api.star-history.com/svg?repos=lsdefine/GenericAgent&type=Date&theme=dark" />
-    <source media="(prefers-color-scheme: light)" srcset="https://api.star-history.com/svg?repos=lsdefine/GenericAgent&type=Date" />
-    <img alt="Star History Chart" src="https://api.star-history.com/svg?repos=lsdefine/GenericAgent&type=Date" />
-  </picture>
-</a>
 
-<br/><br/>
-</div>
```

---

### Incident Patch 13: `ffe97347` (2026-08-24)
**Commit Message**: fix(conductor): restore standalone model selection

**File**: `frontends/conductor.html` (modified, +6/-1)
```diff
@@ -540,7 +540,12 @@
           messagesEl.innerHTML=''; (data.chat||[]).forEach(addMsg);
           renderLog(data.log||[]);
           llmEl.innerHTML=(data.llms||[]).map(x=>`<option value="${x[0]}">${esc(x[1])}</option>`).join(''); llmEl.value=data.llm; llmEl.disabled=!llmEl.options.length;
-        } else if(data.type==='subagents'){ renderCards(data.items||[]); }
+        } else if(data.type==='model_selected'){ llmEl.value=String(data.llm); }
+        else if(data.type==='model_error'){
+          if(data.llm!==undefined) llmEl.value=String(data.llm);
+          showLimitToast(data.error||'Failed to select model');
+        }
+        else if(data.type==='subagents'){ renderCards(data.items||[]); }
         else if(data.type==='chat'){ addMsg(data.item); }
         else if(data.type==='chat_read'){ markAllRead(); }
         else if(data.type==='log'){ appendLog(data.item); }
```

**File**: `frontends/conductor.py` (modified, +52/-3)
```diff
@@ -1,5 +1,6 @@
 import os, sys, re, time, json, uuid, queue, asyncio, threading, argparse, base64, secrets
 from dataclasses import dataclass, field
+from pathlib import Path
 from typing import Dict, Any, Optional, List
 from contextlib import asynccontextmanager, suppress
 
@@ -8,6 +9,10 @@
 from fastapi.middleware.cors import CORSMiddleware
 from pydantic import BaseModel
 
+FRONTENDS_DIR = os.path.dirname(os.path.abspath(__file__))
+if FRONTENDS_DIR not in sys.path: sys.path.insert(0, FRONTENDS_DIR)
+from desktop_settings import DesktopSettingsError, update_settings
+
 def _resolve_ga_root() -> str:
     """Use the external core selected by the package-owned desktop bridge when valid."""
     value = (os.environ.get("GA_ROOT", "") or "").strip()
@@ -67,15 +72,28 @@ def _default_conductor_port() -> int:
 PORT = args.port
 
 
+SETTINGS_PATH = Path.home() / ".ga_desktop_settings.json"
+
+
 def _settings_doc() -> dict:
     try:
-        from pathlib import Path
-        doc = json.loads((Path.home() / ".ga_desktop_settings.json").read_text(encoding="utf-8"))
+        doc = json.loads(SETTINGS_PATH.read_text(encoding="utf-8"))
         return doc if isinstance(doc, dict) else {}
     except Exception:
         return {}
 
 
+def _persist_conductor_llm_no(llm_no: int) -> None:
+    def mutate(document: dict) -> None:
+        section = document.get("conductor")
+        if not isinstance(section, dict):
+            section = {}
+            document["conductor"] = section
+        section["llmNo"] = llm_no
+
+    update_settings(SETTINGS_PATH, mutate)
+
+
 def _conductor_llm_no() -> Optional[int]:
     """Read the model index bound to the conductor session.
     Falls back to the legacy desktop default ui.llmNo for existing installs."""
@@ -180,6 +198,24 @@ def _apply_desktop_model(agent: "GenericAgent") -> dict:
             "fallbackReason": "no_models", "current": None}
 
 
+def _selected_conductor_llm_no(agent: "GenericAgent") -> int:
+    configured = _conductor_llm_no()
+    return configured if _usable_model(agent, configured) else agent.llm_no
+
+
+def _set_conductor_llm_no(agent: "GenericAgent", value: Any) -> int:
+    """Persist the standalone UI binding without mutating an in-flight client.
+
+    The Conductor loop applies this binding at its existing idle task boundary, so
+    a selection made immediately before sending a message controls that next turn.
+    """
+    no = _parse_model_no(value)
+    if no is None or not _usable_model(agent, no):
+        raise ValueError(f"llm index out of range or unavailable: {value}")
+    _persist_conductor_llm_no(no)
+    return no
+
+
 def _select_llm(agent: "GenericAgent", llm: Any) -> bool:
     if llm is None or str(llm).strip() == "": return False
     q = str(llm).strip()
@@ -800,9 +836,22 @@ async def websocket(ws: WebSocket):
         await ws.send_json({"type": "hello", "subagents": pool.snapshot(), "chat": chat_messages,
                             "log": conductor.log, "running": running,
                             "model": conductor.model_snapshot(),
-                            "llms": conductor.agent.list_llms(), "llm": conductor.agent.llm_no})
+                            "llms": conductor.agent.list_llms(),
+                            "llm": _selected_conductor_llm_no(conductor.agent)})
         while True:
             data = await ws.receive_json()
+            if "llm" in data:
+                try:
+                    llm_no = _set_conductor_llm_no(conductor.agent, data["llm"])
+                except (TypeError, ValueError, OSError, DesktopSettingsError) as error:
+                    await ws.send_json({
+                        "type": "model_error",
+                        "error": str(error),
+                        "llm": _selected_conductor_llm_no(conductor.agent),
+                    })
+                else:
+                    await broadcast({"type": "model_selected", "llm": llm_no})
+                continue
             msg = (data.get("msg") or "").strip()
             if not msg: continue
             add_chat(msg, role="user", files=data.get("files") or [], images=data.get("images") or [])
```

**File**: `frontends/tests/test_conductor_model_routing.py` (modified, +44/-0)
```diff
@@ -164,6 +164,50 @@ def test_explicit_numeric_worker_model_rejects_out_of_range():
     assert agent.next_llm_calls == []
 
 
+def test_standalone_model_selection_persists_without_mutating_live_client(tmp_path, monkeypatch):
+    settings_path = tmp_path / "settings.json"
+    settings_path.write_text('{"theme":"dark","ui":{"llmNo":0}}', encoding="utf-8")
+    monkeypatch.setattr(conductor, "SETTINGS_PATH", settings_path)
+    agent = FakeAgent(["zero", "one", "two"])
+
+    selected = conductor._set_conductor_llm_no(agent, 2)
+
+    assert selected == 2
+    assert agent.llm_no == 0
+    assert agent.next_llm_calls == []
+    assert conductor._settings_doc() == {
+        "theme": "dark",
+        "ui": {"llmNo": 0},
+        "conductor": {"llmNo": 2},
+    }
+
+
+def test_standalone_model_selection_rejects_unavailable_model(tmp_path, monkeypatch):
+    settings_path = tmp_path / "settings.json"
+    settings_path.write_text('{"theme":"dark"}', encoding="utf-8")
+    monkeypatch.setattr(conductor, "SETTINGS_PATH", settings_path)
+    agent = FakeAgent(["zero", None])
+
+    with pytest.raises(ValueError, match="unavailable"):
+        conductor._set_conductor_llm_no(agent, 1)
+
+    assert conductor._settings_doc() == {"theme": "dark"}
+
+
+def test_standalone_model_selection_applies_at_next_task_boundary(tmp_path, monkeypatch):
+    settings_path = tmp_path / "settings.json"
+    monkeypatch.setattr(conductor, "SETTINGS_PATH", settings_path)
+    agent = FakeAgent(["zero", "one", "two"])
+
+    conductor._set_conductor_llm_no(agent, 2)
+    state = conductor._apply_desktop_model(agent)
+
+    assert agent.next_llm_calls == [2]
+    assert state["configured"] == 2
+    assert state["effective"] == 2
+    assert state["fallbackReason"] is None
+
+
 def test_runtime_model_snapshot_is_broadcast_with_running_state(monkeypatch):
     instance = conductor.Conductor()
     payloads: list[dict] = []
```

---

### Incident Patch 14: `6cc27a78` (2026-08-23)
**Commit Message**: build(desktop): publish compiled React Desktop 2.0 distribution

Co-authored-by: yiqi-017 <[REDACTED_EMAIL]>

**File**: `.gitattributes` (modified, +4/-0)
```diff
@@ -3,3 +3,7 @@
 *.command text eol=lf
 *.ps1 text eol=crlf
 *.bat text eol=crlf
+
+# Preserve the byte-exact third-party notice in source and generated delivery trees.
+frontends/desktop/public/THIRD_PARTY_NOTICES.txt text eol=lf
+frontends/desktop/dist/THIRD_PARTY_NOTICES.txt text eol=lf
```

**File**: `.github/workflows/desktop-release-package.yml` (modified, +482/-323)
```diff
@@ -23,46 +23,79 @@ name: Build Desktop Portable Packages
           - "macos"
 
 permissions:
-  contents: write
+  contents: read
+
+env:
+  NODE_VERSION: "22.23.2"
+  RUST_TOOLCHAIN: "1.95.0"
+  PBS_RELEASE: "20260814"
+  PBS_PYTHON_VERSION: "3.12.14"
+  MACOS_PACKAGING_PYTHON_VERSION: "3.12.10"
+  PYTHONDONTWRITEBYTECODE: "1"
 
 jobs:
   # ----------------------------------------------------------------------------
   build-windows:
     name: Windows portable
-    if: ${{ startsWith(github.ref, 'refs/tags/') || github.event.inputs.target == 'all' || github.event.inputs.target == 'windows' }}
-    runs-on: windows-latest
+    if: ${{ (github.event_name == 'push' && startsWith(github.ref, 'refs/tags/desktop-portable-')) || (github.event_name == 'workflow_dispatch' && (github.event.inputs.target == 'all' || github.event.inputs.target == 'windows')) }}
+    runs-on: windows-2025
+    permissions:
+      contents: read
     steps:
       - name: Checkout repository
-        uses: actions/checkout@v5
+        uses: actions/checkout@93cb6efe18208431cddfb8368fd83d5badbf9bfd # v5.0.1
+        with:
+          persist-credentials: false
 
       - name: Set up Node.js
-        uses: actions/setup-node@v5
+        uses: actions/setup-node@a0853c24544627f65ddf259abe73b1d18a591444 # v5.0.0
         with:
-          node-version: 20
+          node-version: ${{ env.NODE_VERSION }}
 
       - name: Set up Rust
-        uses: dtolnay/rust-toolchain@stable
+        uses: dtolnay/rust-toolchain@4360b52568e2003a75bf9bc1d59f33a8e3fc893c # stable action snapshot
+        with:
+          toolchain: ${{ env.RUST_TOOLCHAIN }}
 
       - name: Cache Rust build
-        uses: Swatinem/rust-cache@v2
+        uses: Swatinem/rust-cache@63fed3e2fecf6f7b51dc6f043341b79ef82a9ae7 # v2.9.2
         with:
           workspaces: frontends/desktop/src-tauri -> target
 
       - name: Install desktop dependencies
         working-directory: frontends/desktop
-        run: npm install
+        run: |
+          npm install --package-lock=false
+          node -e "const v=require('./node_modules/@tauri-apps/cli/package.json').version; if(v!=='2.11.4') throw new Error('unexpected Tauri CLI '+v)"
+          test ! -e package-lock.json
+
+      - name: Verify tracked compiled renderer bytes
+        working-directory: frontends/desktop
+        run: npm run test:dist
 
       - name: Build Windows desktop exe
         working-directory: frontends/desktop
         run: npm run tauri build -- --bundles nsis
 
       - name: Assemble self-contained portable bundle
         shell: bash
-        env:
-          GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
         run: |
           set -euo pipefail
 
+          purge_runtime_bytecode() {
+            local runtime_root="$1"
+            find "$runtime_root" -type d -name '__pycache__' -prune -exec rm -rf {} +
+            find "$runtime_root" -type f \( -name '*.pyc' -o -name '*.pyo' \) -delete
+            if find "$runtime_root" -type d -name '__pycache__' -print -quit | grep -q .; then
+              echo "Python bytecode cache directory remains in packaged runtime: $runtime_root" >&2
+              return 1
+            fi
+            if find "$runtime_root" -type f \( -name '*.pyc' -o -name '*.pyo' \) -print -quit | grep -q .; then
+              echo "Python bytecode remains in packaged runtime: $runtime_root" >&2
+              return 1
+            fi
+          }
+
           EXE_SRC="$(find frontends/desktop/src-tauri/target/release -maxdepth 1 -type f -name 'ga-desktop.exe' | head -n 1)"
           [[ -n "$EXE_SRC" ]] || { echo "ga-desktop.exe not found" >&2; exit 1; }
 
@@ -73,22 +106,24 @@ jobs:
           # exe at the top level, named GenericAgent (typical portable form)
           cp "$EXE_SRC" "$PKG/GenericAgent.exe"
           cp frontends/desktop/packaging/scripts/windows/install_windows.ps1 "$RUNTIME/install_windows.ps1"
+          cp frontends/desktop/packaging/scripts/merge_desktop_settings.py "$RUNTIME/merge_desktop_settings.py"
           # Uninstaller: double-click entry at top level, worker script under runtime/.
           cp frontends/desktop/packaging/scripts/windows/uninstall.bat "$PKG/uninstall.bat"
           cp frontends/desktop/packaging/scripts/windows/uninstall_windows.ps1 "$RUNTIME/uninstall_windows.ps1"
 
-          # Embedded Python (python-build-standalone, windows x86_64, 3.12 install_only).
-          # browser_download_url is URL-encoded ('+' -> '%2B'); match loosely with '.*'.
-          PBS_URL="$(curl -fsSL -H "Authorization: Bearer $GH_TOKEN" https://api.github.com/repos/astral-sh/python-build-standalone/releases/latest \
-            | grep -o '"browser_download_url": *"[^"]*"' \
-            | grep 'cpython-3\.12\.[0-9].*x86_64-pc-windows-msvc-install_only\.tar\.gz' \
-            | head -1 | sed -E 's/.*"(https[^"]+)"/\1/')"
-          [[ -n "$PBS_URL" ]] || { echo "Could not resolve python-build-standalone download URL" >&2; exit 1; }
+          # Fixed 
```

**File**: `.gitignore` (modified, +2/-0)
```diff
@@ -9,6 +9,8 @@ venv/
 env/
 build/
 dist/
+!frontends/desktop/dist/
+!frontends/desktop/dist/**
 *.egg-info/
 
 .streamlit/
```

**File**: `frontends/desktop/dist/README.md` (added, +66/-0)
```diff
@@ -0,0 +1,66 @@
+# GenericAgent React Desktop 2.0 — compiled distribution
+
+This directory contains generated HTML, JavaScript, CSS, fonts, images, and license notices for the
+GenericAgent React Desktop 2.0 renderer. It is build output, not the React development tree.
+
+## Source and contributions
+
+The public React source of truth and the place for renderer issues, pull requests, and design feedback is:
+
+- <https://github.com/abraxas914/GenericAgent>
+- Exact source used for this distribution:
+  [`21f12f6dfe57ada8572bb21fe6604caac230b1cf`](https://github.com/abraxas914/GenericAgent/commit/21f12f6dfe57ada8572bb21fe6604caac230b1cf)
+
+Over the two-month React Desktop 2.0 development cycle, [abraxas914](https://github.com/abraxas914) led the new
+renderer architecture and UI, Desktop bridge and Tauri integration, startup and recovery surfaces, package
+validation, browser/native end-to-end coverage, renderer security hardening, and bundle optimization. Please
+open an Issue or pull request in the fork above when proposing React renderer changes so source and generated
+output stay synchronized.
+
+[yiqi-017](https://github.com/yiqi-017) contributed user-facing help and feedback contacts that remain in the
+compiled renderer, including the
+[`help and feedback` settings work](https://github.com/abraxas914/GenericAgent/commit/5ddf03bb152666637bdfcfa44f1fac3cff5a66b6)
+and [`startup recovery` support contacts](https://github.com/abraxas914/GenericAgent/commit/2fb55d944e4444b08cb9ad76c13aef7a5788186b).
+He also produced an earlier
+[`compiled-only delivery` prototype](https://github.com/abraxas914/GenericAgent/commit/3e7ca6a2b20eefdb3ee335dc0d520c3b6d9d57f8)
+that helped establish this upstream packaging boundary. The current generated tree was rebuilt by abraxas914
+from the exact merged source commit recorded above.
+
+## Third-party software: Semi Design
+
+This distribution contains code from these nine Semi Design packages, all resolved at version `2.101.0`:
+
+- `@douyinfe/semi-animation`
+- `@douyinfe/semi-animation-react`
+- `@douyinfe/semi-animation-styled`
+- `@douyinfe/semi-foundation`
+- `@douyinfe/semi-icons`
+- `@douyinfe/semi-illustrations`
+- `@douyinfe/semi-json-viewer-core`
+- `@douyinfe/semi-theme-default`
+- `@douyinfe/semi-ui`
+
+- Project: <https://github.com/DouyinFE/semi-design>
+- Website: <https://semi.design>
+- Copyright (c) 2021 DouyinFE
+- License: MIT
+
+The complete license text and bundled third-party notices are in
+[`THIRD_PARTY_NOTICES.txt`](./THIRD_PARTY_NOTICES.txt) in this directory.
+
+## Repository boundary
+
+- `frontends/desktop/dist/**` is the generated React Desktop 2.0 renderer used by the packaged Tauri app.
+- `frontends/desktop/static/**` remains the independent legacy Desktop v1 implementation; this distribution
+  neither replaces nor modifies its source files.
+- The complete Desktop 2.0 integration also uses the repository's Desktop-specific bridge, conductor, cost
+  tracking, data-backup, bootstrap, permissions, and Tauri shell code.
+- The integration does **not** modify GenericAgent's Agent, LLM, Harness, inference, tool-calling, or memory
+  scheduling core runtime.
+- `build-provenance.json` records the source repository, exact source commit, generated file count, and a
+  content-manifest SHA-256. This README and the provenance file are excluded from that manifest. The manifest
+  identifies this exact generated tree; it is not a claim that later builds are bit-for-bit reproducible.
+
+Upstream maintainers can package the tracked distribution directly without the React source. React changes
+should be built and validated in the fork, then submitted here as a refreshed generated tree with updated
+provenance and matching Desktop integration contracts.
```

**File**: `frontends/desktop/dist/THIRD_PARTY_NOTICES.txt` (added, +83/-0)
```diff
@@ -0,0 +1,83 @@
+MIT License
+
+Copyright (c) 2021 DouyinFE
+
+Permission is hereby granted, free of charge, to any person obtaining a copy
+of this software and associated documentation files (the "Software"), to deal
+in the Software without restriction, including without limitation the rights
+to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
+copies of the Software, and to permit persons to whom the Software is
+furnished to do so, subject to the following conditions:
+
+The above copyright notice and this permission notice shall be included in all
+copies or substantial portions of the Software.
+
+THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
+IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
+FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
+AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
+LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
+OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
+SOFTWARE.
+
+The code implementation of the external library is referenced by DouyinFe are:
+
+- animate.css
+
+    The MIT License (MIT)
+
+    Copyright (c) 2020 Daniel Eden
+
+    Permission is hereby granted, free of charge, to any person obtaining a copy
+    of this software and associated documentation files (the "Software"), to deal
+    in the Software without restriction, including without limitation the rights
+    to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
+    copies of the Software, and to permit persons to whom the Software is
+    furnished to do so, subject to the following conditions:
+
+    The above copyright notice and this permission notice shall be included in all
+    copies or substantial portions of the Software.
+
+    THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
+    IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
+    FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
+    AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
+    LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
+    OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
+    SOFTWARE.
+
+- Ant Design
+    MIT LICENSE
+
+    Copyright (c) 2015-present Ant UED, https://xtech.antfin.com/
+
+    Permission is hereby granted, free of charge, to any person obtaining
+    a copy of this software and associated documentation files (the
+    "Software"), to deal in the Software without restriction, including
+    without limitation the rights to use, copy, modify, merge, publish,
+    distribute, sublicense, and/or sell copies of the Software, and to
+    permit persons to whom the Software is furnished to do so, subject to
+    the following conditions:
+
+    The above copyright notice and this permission notice shall be
+    included in all copies or substantial portions of the Software.
+
+    THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
+    EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
+    MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND
+    NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE
+    LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION
+    OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION
+    WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
+
+- rc-tree
+
+    MIT LICENSE
+
+    Copyright (c) 2015-present Alipay.com, https://www.alipay.com/
+
+    Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:
+
+    The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.
+
+    THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
```

**File**: `frontends/desktop/dist/assets/Animation-TKQfYYOo.js` (added, +1/-0)
```diff
@@ -0,0 +1 @@
+import{g as q}from"./tauri-compat-tfiFK9EG.js";var x,P;function Q(){if(P)return x;P=1;var i=4,t=.001,e=1e-7,s=10,n=11,a=1/(n-1),c=typeof Float32Array=="function";function l(u,o){return 1-3*o+3*u}function g(u,o){return 3*o-6*u}function T(u){return 3*u}function r(u,o,f){return((l(o,f)*u+g(o,f))*u+T(o))*u}function h(u,o,f){return 3*l(o,f)*u*u+2*g(o,f)*u+T(o)}function C(u,o,f,p,y){var m,_,F=0;do _=o+(f-o)/2,m=r(_,p,y)-u,m>0?f=_:o=_;while(Math.abs(m)>e&&++F<s);return _}function b(u,o,f,p){for(var y=0;y<i;++y){var m=h(o,f,p);if(m===0)return o;var _=r(o,f,p)-u;o-=_/m}return o}function d(u){return u}return x=function(o,f,p,y){if(!(0<=o&&o<=1&&0<=p&&p<=1))throw new Error("bezier x values must be in [0, 1] range");if(o===f&&p===y)return d;for(var m=c?new Float32Array(n):new Array(n),_=0;_<n;++_)m[_]=r(_*a,o,p);function F(v){for(var S=0,j=1,R=n-1;j!==R&&m[j]<=v;++j)S+=a;--j;var U=(v-m[j])/(m[j+1]-m[j]),A=S+U*a,k=h(A,o,p);return k>=t?b(v,A,o,p):k===0?A:C(v,S,S+a,o,p)}return function(S){return S===0?0:S===1?1:r(F(S),f,y)}},x}var K=Q();const z=q(K);function B(i,t,e){return Math.min(Math.max(i,t),e)}function W(i){const t=/\(([^)]+)\)/.exec(i);return t?t[1].split(",").map(e=>parseFloat(e)):[]}function V(){let i=arguments.length>0&&arguments[0]!==void 0?arguments[0]:1,t=arguments.length>1&&arguments[1]!==void 0?arguments[1]:.5;const e=B(i,1,10),s=B(t,.1,2);return n=>n===0||n===1?n:-e*Math.pow(2,10*(n-1))*Math.sin((n-1-s/(Math.PI*2)*Math.asin(1/e))*(Math.PI*2)/s)}const N=(()=>{const i=["Quad","Cubic","Quart","Quint","Sine","Expo","Circ","Back","Elastic"],t={In:[[.55,.085,.68,.53],[.55,.055,.675,.19],[.895,.03,.685,.22],[.755,.05,.855,.06],[.47,0,.745,.715],[.95,.05,.795,.035],[.6,.04,.98,.335],[.6,-.28,.735,.045],V],Out:[[.25,.46,.45,.94],[.215,.61,.355,1],[.165,.84,.44,1],[.23,1,.32,1],[.39,.575,.565,1],[.19,1,.22,1],[.075,.82,.165,1],[.175,.885,.32,1.275],(s,n)=>a=>1-V(s,n)(1-a)],InOut:[[.455,.03,.515,.955],[.645,.045,.355,1],[.77,0,.175,1],[.86,0,.07,1],[.445,.05,.55,.95],[1,0,0,1],[.785,.135,.15,.86],[.68,-.55,.265,1.55],(s,n)=>a=>a<.5?V(s,n)(a*2)/2:1-V(s,n)(a*-2+2)/2]},e={linear:[.25,.25,.75,.75]};for(const s of Object.keys(t))t[s].forEach((n,a)=>{e["ease"+s+i[a]]=n});return e})();function D(i){if(typeof i=="function")return i;!i||typeof i!="string"?i="linear":i=i.trim();let t=i.split("(")[0];const e=W(i);let s;return t==="cubic-bezier"||t==="cubicBezier"?z(...e.length?e:N.linear):((!t||typeof t!="string"||typeof t=="string"&&N[t]==null)&&(t="linear"),s=N[t],typeof s=="function"?s(...e):e.length?z(...e):z(...s))}class Z{constructor(){this._eventMap=new Map}on(t,e){return t&&typeof e=="function"&&(this._eventMap.has(t)||this._eventMap.set(t,[]),this._eventMap.get(t).push(e)),this}once(t,e){var s=this;if(t&&typeof e=="function"){const n=function(){e(...arguments),s.off(t,n)};this.on(t,n)}}off(t,e){if(t)if(typeof e=="function"){const s=this._eventMap.get(t);if(Array.isArray(s)&&s.length){let n=-1;for(;(n=s.findIndex(a=>a===e))>-1;)s.splice(n,1)}}else e==null&&this._eventMap.delete(t);return this}emit(t){for(var e=arguments.length,s=new Array(e>1?e-1:0),n=1;n<e;n++)s[n-1]=arguments[n];return this._eventMap.has(t)?(this._eventMap.get(t).forEach(a=>a(...s)),!0):!1}}function M(i){return!!(i&&typeof i=="object"&&(i.duration>0||typeof i.easing=="string"||typeof i.easing=="function"))}function H(i,t,e,s,n){for(const a of Object.keys(t)){const c=t[a],l=typeof c=="number"?c:c.val;if(!(typeof c=="object"&&c.done)){if(M(c)&&s&&n&&c.duration){if(c.duration+s<=n||l!==i[a])return!1}else if(typeof e[a]=="number"&&e[a]!==0)return!1;if(i[a]!==l)return!1}}return!0}function E(i){const t={};for(const e in i)Object.prototype.hasOwnProperty.call(i,e)&&(t[e]=typeof i[e]=="number"?i[e]:i[e].val);return t}const I=[0,0];function L(i,t,e,s,n,a,c){const l=-n*(t-s),g=-a*e,T=l+g,r=e+T*i,h=t+r*i;return Math.abs(r)<c&&Math.abs(h-s)<c?(I[0]=s,I[1]=0,I):(I[0]=h,I[1]=r,I)}function J(i){const t={},e=i&&Object.keys(i)||[];for(const s of e)t[s]=0;return t}const $={default:{tension:170,friction:26}},Y=Object.assign(Object.assign({},$.default),{precision:.01});function G(i){let t=arguments.length>1&&arguments[1]!==void 0?arguments[1]:{};if(M(t)){const s=D(t.easing),n=typeof t.duration=="number"&&t.duration>0?t.duration:1e3;t=Object.assign(Object.assign({},t),{easing:s,duration:n})}let e=Object.assign(Object.assign(Object.assign({},Y),t),{done:!1});if(i&&typeof i=="object"&&"val"in i){if(M(i)){const s=D(i.easing),n=typeof i.duration=="number"&&i.duration>0?i.duration:parseInt(t.duration)||1e3;i=Object.assign(Object.assign({},i),{easing:s,duration:n})}e=Object.assign(Object.assign({},e),i)}else e=Object.assign(Object.assign({},e),{val:i});return e}const w=()=>Date.now(),O=1e3/60;class tt extends Z{constructor(){let t=arguments.length>0&&arguments[0]!==void 0?arguments[0]:{},e=arguments.length>1&&arguments[1]!==void 0?arguments[1]:{};super(),this._props=Object.assign({},t),this._config=Object.assign({},e),this.initStates()}_wrapConfig(t,e){e=e&&typeo
```

**File**: `frontends/desktop/dist/assets/CollabPage-CG38jm3S.css` (added, +1/-0)
```diff
@@ -0,0 +1 @@
+.collab-page{display:flex;width:100%;height:100%;overflow:hidden}.collab-main{flex:1;display:flex;flex-direction:column;min-width:0;position:relative}.collab-chat-area{flex:1;position:relative;min-height:0;overflow:hidden}.collab-offline{display:flex;flex-direction:column;align-items:center;justify-content:center;width:100%;height:100%;gap:.5rem;color:var(--semi-color-text-2, #4e5969)}.collab-offline-icon{font-size:2rem;opacity:.5}.collab-offline h3{margin:0;font-size:1rem;font-weight:600;color:var(--semi-color-text-0, #1c1f23)}.collab-offline p{margin:0;font-size:.8125rem}.collab-retry-btn{margin-top:.75rem;padding:.375rem 1rem;border:1px solid var(--semi-color-border, #e0e0e0);border-radius:.375rem;background:var(--semi-color-bg-0, #fff);color:var(--semi-color-text-0, #1c1f23);font-size:.8125rem;cursor:pointer;transition:background .12s}.collab-retry-btn:hover{background:var(--semi-color-fill-0, #f5f5f5)}.collab-connecting{display:flex;align-items:center;justify-content:center;height:100%;gap:.5rem;font-size:.8125rem;color:var(--semi-color-text-2, #4e5969);position:absolute;top:0;right:0;bottom:0;left:0}.collab-connecting-dot{width:8px;height:8px;border-radius:50%;background:var(--semi-color-primary, #3370ff);animation:statusPulse 1.2s ease-in-out infinite}.collab-empty{display:flex;align-items:center;justify-content:center;height:100%;color:var(--semi-color-text-3, #8f959e);font-size:.8125rem;position:absolute;top:0;right:0;bottom:0;left:0}.collab-welcome{position:absolute;top:0;right:0;bottom:0;left:0;display:flex;flex-direction:column;align-items:flex-start;justify-content:center;padding:2rem 0;gap:1rem}.collab-welcome-title{font-size:1.125rem;font-weight:600;color:var(--semi-color-text-0, #1c1f23);margin:0}.collab-welcome-sub{font-size:.8125rem;color:var(--semi-color-text-2, #4e5969);line-height:1.5;margin:0}.collab-welcome-steps{display:flex;flex-direction:column;gap:.75rem;width:100%;margin-top:.5rem}.collab-welcome-step{display:flex;align-items:flex-start;gap:.625rem}.collab-welcome-step-icon{display:flex;align-items:center;justify-content:center;width:1.75rem;height:1.75rem;border-radius:.375rem;background:var(--semi-color-fill-0, #f5f5f5);color:var(--semi-color-text-1, #1c1f23);flex-shrink:0}.collab-welcome-step-text{display:flex;flex-direction:column;gap:.125rem;padding-top:.1875rem}.collab-welcome-step-label{font-size:.8125rem;font-weight:600;color:var(--semi-color-text-0, #1c1f23)}.collab-welcome-step-desc{font-size:.75rem;color:var(--semi-color-text-2, #4e5969);line-height:1.4}.collab-welcome-chips{display:flex;flex-wrap:wrap;gap:.5rem;margin-top:.5rem}.collab-welcome-chip{display:inline-flex;align-items:center;padding:.375rem .625rem;border:1px solid var(--semi-color-border, #e0e0e0);border-radius:6px;background:none;color:var(--ui-text-secondary, #4e5969);font-size:.8125rem;font-weight:500;line-height:1;cursor:pointer;-webkit-user-select:none;user-select:none;transition:background .15s,box-shadow .15s}.collab-welcome-chip:hover{background:color-mix(in srgb,var(--semi-color-primary, #3370ff) 4%,transparent);box-shadow:0 1px 4px color-mix(in srgb,var(--semi-color-primary, #3370ff) 12%,transparent)}.collab-welcome-chip:active{background:color-mix(in srgb,var(--semi-color-primary, #3370ff) 8%,transparent)}[data-slot=collab-page][data-empty] .collab-chat-area{display:flex;flex-direction:column;align-items:center;justify-content:center;overflow:visible}[data-slot=collab-page][data-empty] .collab-welcome{position:relative;inset:unset;width:min(var(--composer-width, 48.75rem),calc(100% - 2rem))}[data-slot=collab-page][data-empty] .collab-composer-wrap{position:relative;width:min(var(--composer-width, 48.75rem),calc(100% - 2rem))}[data-slot=collab-page][data-empty] [data-slot=composer-root]{position:relative;bottom:auto;left:auto;transform:none;width:100%}[data-slot=collab-page][data-empty] [data-slot=composer-root]:before{display:none}[data-slot=collab-page][data-empty] [data-slot=composer-surface]{border-color:var(--semi-color-primary)!important;box-shadow:0 0 20px color-mix(in srgb,var(--semi-color-primary) 12%,transparent),0 0 50px -4px color-mix(in srgb,var(--semi-color-primary) 8%,transparent)!important}[data-slot=collab-messages]{position:absolute;top:0;right:0;bottom:0;left:0;overflow-y:auto;padding:1rem;padding-bottom:calc(var(--composer-measured-height, 62px) + 1rem)}.collab-messages-scroll{display:flex;flex-direction:column;gap:.75rem;max-width:48rem;margin:0 auto}.collab-msg{display:flex}.collab-msg--user{justify-content:flex-end}.collab-msg--conductor,.collab-msg--system{justify-content:flex-start}.collab-bubble{max-width:80%;min-width:min(24rem,100%);padding:.5rem .75rem;border-radius:.75rem;font-size:.8125rem;line-height:1.5}.collab-bubble--user{background:#d3e0fd;color:#000;border-bottom-right-radius:.25rem;min-width:unset;word-break:break-word;white-space:pre-wrap}.collab-bubble--conductor{background:var(--semi-color-fill-0, #f5f5f5);color:var(--semi-color-text-0, #1c
```

**File**: `frontends/desktop/dist/assets/CollabPage-bnm43hIR.js` (added, +1/-0)
```diff
@@ -0,0 +1 @@
+import{b as r,aj as l}from"./tauri-compat-tfiFK9EG.js";import{H as i,b as N,J as C,K as S,L as M,N as T,O as v,M as E,P as W}from"./main-Knf6L_en.js";import{MarkdownPart as w}from"./MarkdownPart-Bhe_jloX.js";import"./index-Bpi3BHKj.js";import"./WindowsTitlebar-CrkUa1UM.js";import"./markdown-preprocess-Bvg4n8KE.js";function R(e){const c=Math.floor(e/1e3);if(c<60)return`${c}s`;const a=Math.floor(c/60),n=c%60;return`${a}m ${n}s`}function $({since:e}){const[c,a]=r.useState(Date.now());return r.useEffect(()=>{const n=setInterval(()=>a(Date.now()),1e3);return()=>clearInterval(n)},[]),l.jsx(l.Fragment,{children:R(c-e)})}const D=200;function P({message:e}){const c=e.role==="user",a=e.role==="conductor";return l.jsx("div",{className:`collab-msg collab-msg--${e.role}`,"data-slot":"collab-msg",children:l.jsxs("div",{className:`collab-bubble ${c?"collab-bubble--user":a?"collab-bubble--conductor":"collab-bubble--system"}`,children:[e.images&&e.images.length>0&&l.jsx("div",{className:"collab-msg-images",children:e.images.map((n,s)=>l.jsx("img",{src:n.base64||n.path,alt:n.name,className:"collab-msg-img"},s))}),e.files&&e.files.length>0&&l.jsx("div",{className:"collab-msg-files",children:e.files.map((n,s)=>l.jsx("span",{className:"collab-msg-file-chip",children:n.name},s))}),a||e.role==="system"?l.jsx(w,{content:e.msg}):l.jsx("span",{className:"collab-msg-text",children:e.msg})]})})}function B({since:e}){const{t:c}=N();return l.jsx("div",{className:"collab-msg collab-msg--conductor","data-slot":"collab-typing",children:l.jsxs("div",{className:"collab-thinking-bar",children:[l.jsx("span",{className:"collab-thinking-dot"}),l.jsx("span",{className:"collab-thinking-label",children:c("collab.typing")}),l.jsx("span",{className:"collab-thinking-time",children:l.jsx($,{since:e})})]})})}function I(){const e=i(o=>o.messages),c=i(o=>o.conductorTyping),a=i(o=>o.connectionStatus),{t:n}=N(),{scrollRef:s}=C(),[u,x]=r.useState(1),d=r.useRef(null),p=r.useRef(0);r.useEffect(()=>{(a==="connecting"||e.length===0)&&x(1)},[a,e.length]);const b=D*u,m=Math.max(0,e.length-b),k=e.slice(m),t=m,g=r.useCallback(()=>{const o=s.current;o&&(d.current=o.scrollHeight-o.scrollTop),x(h=>h+1)},[s]);r.useLayoutEffect(()=>{if(d.current==null)return;if(m>=p.current){d.current=null,p.current=m;return}const o=s.current;o&&(o.scrollTop=o.scrollHeight-d.current),d.current=null,p.current=m},[m,s]),r.useEffect(()=>{p.current=m},[m]);const j=[...e].reverse().find(o=>o.role==="user"),y=o=>o>1e12?o:o*1e3,f=r.useRef(Date.now());return j!=null&&j.ts&&(f.current=y(j.ts)),a==="connecting"?l.jsx("div",{className:"collab-messages-area","data-slot":"collab-messages",children:l.jsxs("div",{className:"collab-connecting",children:[l.jsx("span",{className:"collab-connecting-dot"}),l.jsx("span",{children:n("status.connecting")})]})}):e.length===0?l.jsx("div",{className:"collab-messages-area","data-slot":"collab-messages",children:l.jsx("div",{className:"collab-empty",children:l.jsx("p",{children:n("collab.placeholder")})})}):l.jsx("div",{className:"collab-messages-area","data-slot":"collab-messages",ref:s,children:l.jsxs("div",{className:"collab-messages-scroll",children:[t>0&&l.jsxs("button",{type:"button","data-slot":"show-earlier-btn",onClick:g,children:["Show ",t," earlier"]}),k.map((o,h)=>l.jsx(P,{message:o},o.id||m+h)),c&&l.jsx(B,{since:f.current})]})})}function F(){const e=i(t=>t.sendMessage),c=i(t=>t.conductorTyping),a=i(t=>t.connectionStatus),n=i(t=>t.modelConfig),s=i(t=>t.runtimeModel),u=i(t=>t.loadModel),x=i(t=>t.selectModel),d=S(t=>t.defaultModelNo);r.useEffect(()=>{u()},[u]);const p=r.useCallback((t,g)=>{var f,o;const j=(f=g==null?void 0:g.files)==null?void 0:f.map(h=>({name:h.name,path:h.path})),y=(o=g==null?void 0:g.images)==null?void 0:o.map(h=>({name:h.name,path:h.path,base64:h.base64}));e(t,j,y)},[e]),b=r.useCallback(()=>{},[]),m=a!=="ready",k=(n==null?void 0:n.effective)??(n==null?void 0:n.configured)??d;return l.jsx("div",{className:"collab-composer-wrap","data-slot":"collab-composer","data-disabled":m||void 0,children:l.jsx(M,{onSend:p,onStop:b,isGenerating:c,hideStatusStack:!0,modelControl:l.jsx(T,{selectedNo:k,runningNo:s!=null&&s.running?s.effective:null,isRunning:!!(s!=null&&s.running),onSelect:x})})})}const H=[{key:"1",icon:"comment"},{key:"2",icon:"symbol-misc"},{key:"3",icon:"graph"},{key:"4",icon:"edit"}],L=["collab.chipProgress","collab.chipPause","collab.chipSummary"];function O({onChipClick:e}){const{t:c}=N();return l.jsxs("div",{className:"collab-welcome","data-slot":"collab-welcome",children:[l.jsx("h2",{className:"collab-welcome-title",children:c("collab.guideTitle")}),l.jsx("p",{className:"collab-welcome-sub",children:c("collab.guideWhen")}),l.jsx("div",{className:"collab-welcome-steps",children:H.map(a=>l.jsxs("div",{className:"collab-welcome-step",children:[l.jsx("span",{className:"collab-welcome-step-icon",children:l.jsx(v,{name:a.icon,size:"1rem"})}),l.jsxs("span",{className:"collab-welcome-step-text",children:[l.jsx("span",{cla
```

---

### Incident Patch 15: `30b24ad3` (2026-08-21)
**Commit Message**: fix(stapp): own stream bubble inside fragment for cross-version rerun safety

**File**: `frontends/stapp.py` (modified, +13/-17)
```diff
@@ -434,20 +434,20 @@ def _slash_missing(name):
     with st.chat_message("user"): st.markdown(prompt)
     _start_main_task(prompt)
 
-# Stream hosts only when this session owns the queue.
-# Poll quickly while active; reduce idle renderer churn.
-_stream_fh = None
-if st.session_state.get('display_queue') is not None:
-    with st.chat_message("assistant"):
-        _stream_fh = st.container()
-elif agent.is_running:
+# Stream bubble is owned by the fragment below: a fragment atomically replaces
+# its *own* subtree on every rerun in all Streamlit versions, whereas writing
+# into a container created outside the fragment is version-dependent (pre-1.62
+# appends forever → duplicates; ≥1.62 resets/GCs → disappears). So never hoist
+# the host out of the fragment; paint the full desired state each tick.
+_owns_stream = st.session_state.get('display_queue') is not None
+if not _owns_stream and agent.is_running:
     st.chat_message("assistant").markdown(T("detached_running"))
 
-@st.fragment(run_every=timedelta(seconds=1 if (_stream_fh is not None or agent.is_running or st.session_state.get('loop_enabled')) else 5))
+@st.fragment(run_every=timedelta(seconds=1 if (_owns_stream or agent.is_running or st.session_state.get('loop_enabled')) else 5))
 def _tick():
     """Poll every second while active and every five seconds while idle."""
     # 1) Own stream: drain done, paint all_outputs
-    if _stream_fh is not None:
+    if _owns_stream:
         done = _poll_main_task()
         if done is not None:
             if done:
@@ -466,16 +466,12 @@ def _tick():
         _dq = st.session_state.get("display_queue")
         steps = (list(((agent.all_outputs or [{}])[-1].get("outputs")) or [])
                  if _dq is getattr(agent, "_current_queue", None) else [])
-        # Streamlit ≥1.62: a fragment's outside-container wrapper resets to
-        # index 0 on every fragment rerun and children not re-emitted are GC'd
-        # (see runtime/fragment.py:_reset_outside_wrappers). Incremental appends
-        # don't survive across ticks, so repaint *everything* every tick — frozen
-        # expanders plus the live tail — into the single host container. Always
-        # writing (even when steps is empty) also claims the slot on the initial
-        # run, avoiding "could not reserve a stable position".
         live = re.sub(r'\**LLM Running \(Turn \d+\) \.\.\.\**\s*$', '',
                       (steps[-1] if steps else '') or '').rstrip()
-        with _stream_fh:
+        # Idempotent repaint inside the fragment's own subtree: the whole
+        # bubble (expanders + live tail) is re-emitted from state every tick,
+        # so a rerun can neither drop nor duplicate elements.
+        with st.chat_message("assistant"):
             for i in range(max(0, len(steps) - 1)):
                 body = steps[i] or ''
                 with st.expander(_step_title(body, i), expanded=False): st.markdown(body)
```

#### Recent Merged Pull Requests:
- **PR #817** (2026-09-29): docs: refresh WeChat group 23 QR code (@wjl2023)
- **PR #816** (2026-09-22): fix(tui): polish rendering, history preview, and copy behavior (@nianyucatfish)
- **PR #805** (closed): fix: strip DeepSeek DSML tool-call markers from assistant content (@sharadvc)
- **PR #791** (2026-09-03): docs(ganet): cover macOS in the PC device-link setup SOP (@nianyucatfish)
- **PR #787** (2026-08-30): feat(desktop): compiled React Desktop 2.0 v0.2.1 renderer update (@yiqi-017)
- **PR #786** (2026-08-28): docs(ganet): add PC device-link setup SOP (@nianyucatfish)
- **PR #784** (closed): fix(desktop): restore backups and align macOS titlebar for v0.2.1 (@abraxas914)
- **PR #781** (closed): feat(agent): gate completion on observable verification conditions (@dxin66)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
