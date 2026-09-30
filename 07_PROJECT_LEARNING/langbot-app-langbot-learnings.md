# Forensic Learning Record (Deep Inspection): langbot-app/LangBot

> **Canonical Artifact**: `07_PROJECT_LEARNING/langbot-app-langbot-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/langbot-app/LangBot](https://github.com/langbot-app/LangBot))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-09-30T18:46:18.183Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `langbot-app/LangBot`
- **Description**: Production-grade platform for building agentic IM bots - 生产级多平台智能机器人开发平台/ Agent、知识库编排、插件系统 / Bots for Discord / Slack / LINE / Telegram / WeChat(企业微信, 企微智能机器人, 公众号) / 飞书 / 钉钉 / QQ / Matrix e.g. Integrated with ChatGPT(GPT), DeepSeek, Dify, n8n, Langflow, Coze, Claude, Gemini, GLM, Ollama, SiliconFlow, Moonshot, openclaw / hermes agent, deerflow
- **Primary Language / Ecosystem**: Python
- **Discovered Manifests / Configurations**: pyproject.toml, README.md, Dockerfile
- **Stars / Engagement**: 17979 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: pyproject.toml, README.md, Dockerfile.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `examples/http-bot/client.py`
```
#!/usr/bin/env python3
"""LangBot HTTP Bot adapter — reference client (Python).

Two things in one file:

1. ``push()`` / ``push_sync()`` — send a message into a LangBot ``http_bot`` bot.
2. A tiny Flask callback receiver that verifies signatures and prints replies,
   so you can watch N->1 aggregation and 1->M multi-reply working live.

Usage
-----
    pip install flask requests

    # Terminal 1 — start the callback receiver (this is your callback_url):
    python client.py serve --port 8900 --secret SHARED_SECRET

    # Terminal 2 — push a message (async; reply lands on the receiver):
    python client.py push \
        --url   https://your-langbot/bots/<BOT_UUID> \
        --secret SHARED_SECRET \
        --session ticket-10293 \
        --text "Export keeps failing on the dashboard."

    # Or push and block for the collapsed reply (sync convenience mode):
    python client.py sync --url https://your-langbot/bots/<BOT_UUID> \
        --secret SHARED_SECRET --session ticket-10293 --text "hi"

The signing scheme is HMAC-SHA256 over ``"{timestamp}." + raw_body``; see
``sign()`` below — it is intentionally tiny and easy to port.
"""

from __future__ import annotations

import argparse
import hashlib
import hmac
import json
import sys
import time
import uuid

HEADER_TIMESTAMP = 'X-LB-Timestamp'
HEADER_SIGNATURE = 'X-LB-Signature'
HEADER_IDEMPOTENCY = 'X-LB-Idempotency-Key'
REPLAY_WINDOW = 300


def sign(secret: str, body: bytes, timestamp: int | None = None) -> tuple[str, str]:
    """Return (timestamp, signature) for *body*."""
    ts = str(timestamp if timestamp is not None else int(time.time()))
    mac = hmac.new(secret.encode(), f'{ts}.'.encode() + body, hashlib.sha256)
    return ts, 'sha256=' + mac.hexdigest()


def verify(secret: str, body: bytes, timestamp: str | None, signature: str | None) -> bool:
    """Verify an inbound signature (used by the callback receiver)."""
    if not timestamp or not signature:
        return False
    try:
        if abs(int(time.time()) - int(float(timestamp))) > REPLAY_WINDOW:
            return False
    except ValueError:
        return False
    _, expected = sign(secret, body, int(float(timestamp)))
    return hmac.compare_digest(expected, signature)


def _post(url: str, secret: str, payload: dict, idempotency: bool = True):
    import requests

    body = json.dumps(payload, ensure_ascii=False).encode()
    ts, sig = sign(secret, body)
    headers = {
        'Content-Type': 'application/json',
        HEADER_TIMESTAMP: ts,
        HEADER_SIGNATURE: sig,
    }
    if idempotency:
        headers[HEADER_IDEMPOTENCY] = uuid.uuid4().hex
    resp = requests.post(url, data=body, headers=headers, timeout=30)
    print(f'-> {resp.status_code} {resp.text}')
    return resp


def push(url: str, secret: str, session: str, text: str, session_type: str = 'person'):
    """Fire-and-collect: returns 202 immediately; reply arrives on your callback."""
    payload = {
        'session_id': session,
        'session_type': session_type,
        'message': [{'type': 'Plain', 'text': text}],
    }
    return _post(url.rstrip('/'), secret, payload)


def push_sync(url: str, secret: str, session: str, text: str, session_type: str = 'person'):
    """Blocking convenience: POST to /sync and get the collapsed reply back."""
    payload = {
        'session_id': session,
        'session_type': session_type,
        'message': [{'type': 'Plain', 'text': text}],
    }
    resp = _post(url.rstrip('/') + '/sync', secret, payload, idempotency=False)
    return resp


def reset(url: str, secret: str, session: str, session_type: str = 'person'):
    """Reset a session's conversation (next message starts fresh)."""
    payload = {'session_id': session, 'session_type': session_type}
    return _post(url.rstrip('/') + '/reset', secret, payload, idempotency=False)


def serve(port: int, secret: str):
    """Run a callback receiver that verifies signatures and prints replies."""
    from flask import Flask, request

    app = Flask(__name__)

    @app.route('/', methods=['POST'])
    def recv():
        raw = request.get_data()
        ok = verify(secret, raw, request.headers.get(HEADER_TIMESTAMP), request.headers.get(HEADER_SIGNATURE))
        if not ok:
            print('!! signature verification FAILED — rejecting')
            return {'error': 'bad signature'}, 401
        data = json.loads(raw)
        text_parts = [c.get('text', '') for c in data.get('message', []) if c.get('type') == 'Plain']
        marker = 'FINAL' if data.get('is_final') else 'part '
        print(
            f'[{marker}] session={data["session_id"]} seq={data["sequence"]} '
            f'reply_to={data.get("reply_to")}: {" ".join(text_parts)}'
        )
        return {'ok': True}

    print(f'callback receiver listening on http://0.0.0.0:{port}/  (Ctrl-C to stop)')
    app.run(host='0.0.0.0', port=port)


def main(argv=None):
    p = argparse.ArgumentParser(description='LangBot HTTP Bot reference client')
    sub = p.add_subparsers(dest='cmd', required=True)

    sp = sub.add_parser('serve', help='run the callback receiver')
    sp.add_argument('--port', type=int, default=8900)
    sp.add_argument('--secret', required=True)

    for name in ('push', 'sync', 'reset'):
        c = sub.add_parser(name)
        c.add_argument('--url', required=True, help='https://host/bots/<BOT_UUID>')
        c.add_argument('--secret', required=True)
        c.add_argument('--session', required=True)
        c.add_argument('--session-type', default='person', choices=['person', 'group'])
        if name != 'reset':
            c.add_argument('--text', required=True)

    args = p.parse_args(argv)
    if args.cmd == 'serve':
        serve(args.port, args.secret)
    elif args.cmd == 'push':
        push(args.url, args.secret, args.session, args.text, args.session_type)
    elif args.cmd == 'sync':
        push_sync(args.url, args.secret, args.session, args.text, args.session_type)
    elif args.cmd == 'reset':
        reset(args.url, args.secret, args.session, args.session_type)


if __name__ == '__main__':
    sys.exit(main())

```

### Core Architecture Module: `examples/http-bot/client.ts`
```
/**
 * LangBot HTTP Bot adapter — reference client (TypeScript / Node 18+).
 *
 * Zero runtime dependencies (uses global `fetch`, `crypto`, and `http`).
 *
 *   - `push()`      : fire-and-collect; reply lands on your callback URL.
 *   - `pushSync()`  : POST /sync and await the collapsed reply.
 *   - `reset()`     : reset a session's conversation.
 *   - `startReceiver()` : a callback server that verifies signatures and logs
 *                         replies, so you can watch N->1 and 1->M live.
 *
 * Run the demos:
 *   npx tsx client.ts serve   8900 SHARED_SECRET
 *   npx tsx client.ts push    https://host/bots/<UUID> SHARED_SECRET ticket-1 "hello"
 *   npx tsx client.ts sync    https://host/bots/<UUID> SHARED_SECRET ticket-1 "hello"
 *   npx tsx client.ts reset   https://host/bots/<UUID> SHARED_SECRET ticket-1
 */

import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto';
import { createServer } from 'node:http';

const HEADER_TIMESTAMP = 'X-LB-Timestamp';
const HEADER_SIGNATURE = 'X-LB-Signature';
const HEADER_IDEMPOTENCY = 'X-LB-Idempotency-Key';
const REPLAY_WINDOW = 300;

/** Compute the `sha256=<hex>` signature over `"{ts}." + body`. */
export function sign(secret: string, body: Buffer | string, timestamp?: number): [string, string] {
  const ts = String(timestamp ?? Math.floor(Date.now() / 1000));
  const buf = typeof body === 'string' ? Buffer.from(body) : body;
  const mac = createHmac('sha256', secret).update(Buffer.concat([Buffer.from(`${ts}.`), buf])).digest('hex');
  return [ts, `sha256=${mac}`];
}

/** Verify an inbound signature (used by the callback receiver). */
export function verify(secret: string, body: Buffer, timestamp?: string, signature?: string): boolean {
  if (!timestamp || !signature) return false;
  if (Math.abs(Math.floor(Date.now() / 1000) - Number(timestamp)) > REPLAY_WINDOW) return false;
  const [, expected] = sign(secret, body, Number(timestamp));
  const a = Buffer.from(expected);
  const b = Buffer.from(signature);
  return a.length === b.length && timingSafeEqual(a, b);
}

interface Segment { type: string; text?: string; url?: string; [k: string]: unknown }

async function post(url: string, secret: string, payload: object, idempotency = true) {
  const body = Buffer.from(JSON.stringify(payload));
  const [ts, sig] = sign(secret, body);
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    [HEADER_TIMESTAMP]: ts,
    [HEADER_SIGNATURE]: sig,
  };
  if (idempotency) headers[HEADER_IDEMPOTENCY] = randomUUID();
  const resp = await fetch(url, { method: 'POST', headers, body });
  const text = await resp.text();
  console.log(`-> ${resp.status} ${text}`);
  return { status: resp.status, text };
}

/** Fire-and-collect: 202 now, reply later on your callback URL. */
export function push(url: string, secret: string, session: string, text: string, sessionType = 'person') {
  return post(url.replace(/\/$/, ''), secret, {
    session_id: session,
    session_type: sessionType,
    message: [{ type: 'Plain', text }] as Segment[],
  });
}

/** Blocking convenience: POST /sync, get the collapsed reply. */
export function pushSync(url: string, secret: string, session: string, text: string, sessionType = 'person') {
  return post(`${url.replace(/\/$/, '')}/sync`, secret, {
    session_id: session,
    session_type: sessionType,
    message: [{ type: 'Plain', text }] as Segment[],
  }, false);
}

/** Reset a session's conversation. */
export function reset(url: string, secret: string, session: string, sessionType = 'person') {
  return post(`${url.replace(/\/$/, '')}/reset`, secret, { session_id: session, session_type: sessionType }, false);
}

/** Run a callback receiver that verifies signatures and prints replies. */
export function startReceiver(port: number, secret: string) {
  const server = createServer((req, res) => {
    if (req.method !== 'POST') { res.writeHead(405).end(); return; }
    const chunks: Buffer[] = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', () => {
      const raw = Buffer.concat(chunks);
      const ok = verify(secret, raw, req.headers[HEADER_TIMESTAMP.toLowerCase()] as string,
        req.headers[HEADER_SIGNATURE.toLowerCase()] as string);
      if (!ok) {
        console.log('!! signature verification FAILED — rejecting');
        res.writeHead(401, { 'Content-Type': 'application/json' }).end(JSON.stringify({ error: 'bad signature' }));
        return;
      }
      const data = JSON.parse(raw.toString());
      const parts = (data.message as Segment[]).filter((c) => c.type === 'Plain').map((c) => c.text).join(' ');
      const marker = data.is_final ? 'FINAL' : 'part ';
      console.log(`[${marker}] session=${data.session_id} seq=${data.sequence} reply_to=${data.reply_to}: ${parts}`);
      res.writeHead(200, { 'Content-Type': 'application/json' }).end(JSON.stringify({ ok: true }));
    });
  });
  server.listen(port, () => console.log(`callback receiver listening on http://0.0.0.0:${port}/  (Ctrl-C to stop)`));
}

// --- CLI ---
const [cmd, ...rest] = process.argv.slice(2);
if (cmd === 'serve') {
  startReceiver(Number(rest[0] ?? 8900), rest[1] ?? 'SHARED_SECRET');
} else if (cmd === 'push') {
  push(rest[0], rest[1], rest[2], rest[3]);
} else if (cmd === 'sync') {
  pushSync(rest[0], rest[1], rest[2], rest[3]);
} else if (cmd === 'reset') {
  reset(rest[0], rest[1], rest[2]);
} else if (cmd) {
  console.error(`unknown command: ${cmd}`);
  process.exit(1);
}

```

### Core Architecture Module: `examples/http-bot/playground.py`
```
#!/usr/bin/env python3
"""LangBot HTTP Bot — interactive playground (public, browser-based).

This is a REAL end-to-end demo against the RUNNING LangBot instance on this
host. It is NOT a mock and NOT an in-process import: every message you type in
the browser is signed and POSTed to the live `http_bot` bot at
http://127.0.0.1:5300/bots/<uuid>, and the bot's replies come back to this
server's /callback endpoint over real HTTP, then stream to your browser via SSE.

What it does on startup:
  1. Reads the LangBot API key + the http_bot bot from data/langbot.db.
  2. Configures the bot via the LangBot API (PUT /api/v1/platform/bots/<uuid>):
     sets inbound_secret + outbound_secret + callback_url to point back here.
     (LangBot reloads the bot live — no server restart needed.)
  3. Serves a chat page on 0.0.0.0:<PORT> so you can open it from the internet.

Run:  ./.venv/bin/python examples/http-bot/playground.py
Then open:  http://<this-host-public-ip>:<PORT>/
"""

from __future__ import annotations

import asyncio
import json
import os
import sqlite3
import sys

REPO = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
sys.path.insert(0, os.path.join(REPO, 'src'))

from aiohttp import web  # noqa: E402
import aiohttp  # noqa: E402

from langbot.pkg.platform.sources import http_bot_signing as sg  # noqa: E402

# ---- config -----------------------------------------------------------------
LANGBOT_BASE = 'http://127.0.0.1:5300'
DB_PATH = os.path.join(REPO, 'data', 'langbot.db')
PUBLIC_IP = os.environ.get('PUBLIC_IP', '127.0.0.1')
PORT = int(os.environ.get('PLAYGROUND_PORT', '8920'))
SECRET = 'playground-shared-secret'

# SSE subscribers: list of asyncio.Queue
subscribers: list[asyncio.Queue] = []


def db_lookup() -> tuple[str, str]:
    """Return (api_key, http_bot_uuid) from the LangBot DB."""
    db = sqlite3.connect(DB_PATH)
    db.row_factory = sqlite3.Row
    api_key = db.execute('SELECT key FROM api_keys LIMIT 1').fetchone()['key']
    bot = db.execute("SELECT uuid FROM bots WHERE adapter='http_bot' LIMIT 1").fetchone()
    if not bot:
        raise SystemExit('No http_bot bot found. Create one in the WebUI first.')
    return api_key, bot['uuid']


async def configure_bot(api_key: str, bot_uuid: str, callback_url: str):
    """Point the live bot at this playground via the LangBot API.

    update_bot() runs a raw SQL UPDATE with whatever keys we send, so we send a
    MINIMAL payload: only adapter_config (built from scratch, not read back —
    the GET masks secrets). LangBot reloads + reruns the bot live.
    """
    cfg = {
        'inbound_secret': SECRET,
        'outbound_secret': SECRET,
        'callback_url': callback_url,
        'signature_required': True,
        'default_session_type': 'person',
        'callback_timeout': 15,
        'callback_max_retries': 3,
    }
    async with aiohttp.ClientSession() as s:
        async with s.put(
            f'{LANGBOT_BASE}/api/v1/platform/bots/{bot_uuid}',
            headers={'Authorization': f'Bearer {api_key}', 'Content-Type': 'application/json'},
            json={'adapter_config': cfg},
        ) as r:
            txt = await r.text()
            print(f'[configure] PUT adapter_config -> {r.status} {txt[:200]}')
            return r.status < 400


async def broadcast(event: dict):
    for q in list(subscribers):
        try:
            q.put_nowait(event)
        except Exception:
            pass


# ---- HTTP handlers ----------------------------------------------------------
async def index(request: web.Request):
    return web.Response(text=PAGE, content_type='text/html')


async def send(request: web.Request):
    """Browser -> here -> signed POST -> live LangBot bot."""
    body_in = await request.json()
    session_id = body_in.get('session_id') or 'playground-1'
    text = body_in.get('text', '')
    bot_uuid = request.app['bot_uuid']

    payload = {
        'session_id': session_id,
        'sender': {'id': 'browser-user', 'name': 'You'},
        'message': [{'type': 'Plain', 'text': text}],
    }
    raw = json.dumps(payload, ensure_ascii=False).encode()
    ts, sig = sg.sign(SECRET, raw)
    url = f'{LANGBOT_BASE}/bots/{bot_uuid}'

    # echo what we send to the browser timeline
    await broadcast(
        {'dir': 'out', 'kind': 'request', 'session_id': session_id, 'text': text, 'url': url, 'sig': sig[:24] + '…'}
    )

    async with aiohttp.ClientSession() as s:
        async with s.post(
            url,
            data=raw,
            headers={
                'Content-Type': 'application/json',
                sg.HEADER_TIMESTAMP: ts,
                sg.HEADER_SIGNATURE: sig,
            },
        ) as r:
            status = r.status
            try:
                jr = await r.json()
            except Exception:
                jr = {'raw': await r.text()}
    await broadcast({'dir': 'in', 'kind': 'ack', 'status': status, 'data': jr})
    return web.json_response({'status': status, 'data': jr})


async def callback(request: web.Request):
    """Live LangBot bot -> here. Verify signature, stream to browser."""
    raw = await request.read()
    ok, why = sg.verify(SECRET, raw, request.headers.get(sg.HEADER_TIMESTAMP), request.headers.get(sg.HEADER_SIGNATURE))
    data = json.loads(raw)
    text = ' '.join(c.get('text', '') for c in data.get('message', []) if c.get('type') == 'Plain')
    await broadcast(
        {
            'dir': 'in',
            'kind': 'reply',
            'session_id': data.get('session_id'),
            'sequence': data.get('sequence'),
            'is_final': data.get('is_final'),
            'sig_ok': ok,
            'sig_why': why,
            'text': text,
        }
    )
    return web.json_response({'ok': True})


async def events(request: web.Request):
    """SSE stream to the browser."""
    resp = web.StreamResponse(
        headers={
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive',
            'Access-Control-Allow-Origin': '*',
        }
    )
    await resp.prepare(request)
    q: asyncio.Queue = asyncio.Queue()
    subscribers.append(q)
    try:
        await resp.write(b': connected\n\n')
        while True:
            try:
                ev = await asyncio.wait_for(q.get(), timeout=15)
                await resp.write(f'data: {json.dumps(ev, ensure_ascii=False)}\n\n'.encode())
            except asyncio.TimeoutError:
                await resp.write(b': ping\n\n')
    except (asyncio.CancelledError, ConnectionResetError):
        pass
    finally:
        if q in subscribers:
            subscribers.remove(q)
    return resp


PAGE = r"""<!doctype html>
<html lang="zh"><head><meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>LangBot HTTP Bot · 调试台</title>
<style>
  :root{
    --bg:#f7f8fa; --panel:#ffffff; --line:#e8eaed; --ink:#1f2329; --mut:#8a909a;
    --brand:#2563eb; --brand-soft:#eef3ff; --ok:#16a34a; --bad:#dc2626; --code:#f3f4f6;
  }
  *{box-sizing:border-box}
  html,body{height:100%}
  body{margin:0;background:var(--bg);color:var(--ink);
    font:14px/1.6 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"PingFang SC","Microsoft YaHei",sans-serif}
  .top{height:52px;background:var(--panel);border-bottom:1px solid var(--line);
    display:flex;align-items:center;gap:10px;padding:0 18px}
  .logo{width:26px;height:26px;border-radius:7px;background:var(--brand);display:grid;place-items:center;color:#fff;font-weight:700;font-size:14px}
  .top b{font-size:15px} .top .ver{font-size:12px;color:var(--mut)}
  .dot{width:8px;height:8px;border-radius:50%;background:#cbd2dc;display:inline-block;margin-right:5px;vertical-align:middle}
  .dot.on{background:var(--ok)} .dot.off{background:var(--bad)}
  .conn{margin-left:auto;font-size:12px;color:var(--mut)}
  .wrap{max-width:1080px;margin:0 auto;padding:18px;display:grid;grid-template-columns:1fr 360px;gap:16px}
  @media(max-wid
```

### Core Architecture Module: `main.py`
```
import langbot.__main__

langbot.__main__.main()

```

### Core Architecture Module: `res/scripts/publish_announcement.py`
```
# 输出工作路径
import os
import time
import json

print('工作路径: ' + os.getcwd())
announcement = input('请输入公告内容: ')

# 读取现有的公告文件 res/announcement.json
with open('res/announcement.json', 'r', encoding='utf-8') as f:
    announcement_json = json.load(f)

# 将公告内容写入公告文件

# 当前自然时间
now = time.strftime('%Y-%m-%d %H:%M:%S', time.localtime())

# 获取最后一个公告的id
last_id = announcement_json[-1]['id'] if len(announcement_json) > 0 else -1

announcement = {
    'id': last_id + 1,
    'time': now,
    'timestamp': int(time.time()),
    'content': announcement,
}

announcement_json.append(announcement)

# 将公告写入公告文件
with open('res/announcement.json', 'w', encoding='utf-8') as f:
    json.dump(announcement_json, f, indent=4, ensure_ascii=False)

```

### Core Architecture Module: `scripts/cloud_runtime_soak.py`
```
#!/usr/bin/env python3
"""Run the final LangBot Cloud resource-stability acceptance gate.

The short synthetic probes in this repository prove that selected registries
plateau.  This tool is for the production-candidate topology: it samples Core,
Plugin Runtime and Box health endpoints together with their Linux process trees
and cgroup v2 accounting, streams raw evidence to JSONL, and fails when the
post-load tail shows a material leak or sustained CPU pressure.

Examples:

    uv run python scripts/cloud_runtime_soak.py \
      --duration 24h --startup-grace 5m --cooldown 30m \
      --endpoint core=http://langbot:5300/healthz \
      --endpoint plugin=http://langbot-plugin-runtime:5400/healthz \
      --endpoint box=http://langbot-box:5410/readyz \
      --cgroup core=/sys/fs/cgroup/langbot \
      --cgroup plugin=/sys/fs/cgroup/langbot-plugin-runtime \
      --cgroup box=/sys/fs/cgroup/langbot-box \
      --samples-file artifacts/cloud-soak-samples.jsonl \
      --report-file artifacts/cloud-soak-report.json \
      --workload uv run python tests/load/cloud_candidate_workload.py

Run this from a node/sidecar that can read the target cgroups.  A process target
(``--pid name=PID``) is useful when cgroup paths are not directly mounted, but
cgroup evidence is still required for the production gate because only cgroups
report OOM, PID-limit and CPU-throttling events.
"""

from __future__ import annotations

import argparse
import concurrent.futures
import contextlib
import dataclasses
import datetime as dt
import json
import math
import os
import re
import signal
import statistics
import subprocess
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from collections import deque
from collections.abc import Callable, Iterable, Mapping, Sequence
from pathlib import Path
from typing import Any, TextIO


BYTES_PER_MIB = 1024 * 1024
MAX_HTTP_BODY_BYTES = BYTES_PER_MIB
MAX_FLATTENED_HTTP_METRICS = 256
MAX_PROCESS_TREE_SIZE = 4096
MAX_TARGETS = 32
MAX_SAMPLER_THREADS = 8
_DIRECT_HTTP_OPENER = urllib.request.build_opener(urllib.request.ProxyHandler({}))
TARGET_NAME_RE = re.compile(r'^[A-Za-z0-9][A-Za-z0-9_.-]{0,63}$')
COUNTER_SUFFIXES = (
    '.memory.events.high',
    '.memory.events.max',
    '.memory.events.oom',
    '.memory.events.oom_kill',
    '.memory.events.oom_group_kill',
    '.pids.events.max',
)
REJECTION_SUFFIXES = (
    '.blocking_executor.global_rejected_total',
    '.blocking_executor.scope_rejected_total',
)
RUNTIME_FAILURE_COUNTER_SUFFIXES = ('.restart_coordinator.circuit_open_total',)
DRAIN_GAUGE_SUFFIXES = (
    '.blocking_executor.pending',
    '.restart_coordinator.active_launches',
    '.restart_coordinator.gate_waiters',
    '.restart_coordinator.half_open_probe_inflight',
    '.restart_coordinator.open_remaining_seconds',
    '.resources.runtimes.mcp_projection_retirements',
    '.resources.runtimes.mcp_projection_reconcile_active',
    '.resources.runtimes.message_aggregation_buffers',
    '.resources.runtimes.message_aggregation_scopes',
)
TRANSIENT_GAUGE_SUFFIXES = (
    '.resources.telemetry_tasks',
    '.resources.query_pool.queued',
    '.resources.runtimes.mcp_host_tasks',
    '.resources.runtimes.mcp_dispatch_tasks',
    '.resources.creating_session_tasks',
    '.resources.closing_session_tasks',
    '.resources.background_tasks',
)
CAPACITY_GAUGE_PAIRS = (
    (
        '.resources.directory.active_workspaces',
        '.resources.directory.max_active_workspaces',
    ),
    (
        '.resources.directory.last_batch_workspaces',
        '.resources.directory.max_snapshot_workspaces',
    ),
    (
        '.resources.directory.last_batch_memberships',
        '.resources.directory.max_snapshot_memberships',
    ),
    (
        '.resources.database_pool.checked_out',
        '.resources.database_pool.configured_capacity',
    ),
)
REQUIRED_CORE_CAPACITY_GAUGES = frozenset(suffix for pair in CAPACITY_GAUGE_PAIRS for suffix in pair)


@dataclasses.dataclass(frozen=True, slots=True)
class Target:
    name: str
    kind: str
    location: str


@dataclasses.dataclass(frozen=True, slots=True)
class MetricSample:
    monotonic_seconds: float
    wall_time: str
    metrics: dict[str, float]


@dataclasses.dataclass(slots=True)
class TargetState:
    target: Target
    samples: deque[MetricSample]
    baseline_metrics: dict[str, float] | None = None
    last_metrics: dict[str, float] | None = None
    observed_max_metrics: dict[str, float] = dataclasses.field(default_factory=dict)
    attempted_samples: int = 0
    successful_samples: int = 0
    failed_samples: int = 0
    consecutive_failures: int = 0
    max_consecutive_failures: int = 0
    first_error: str | None = None


@dataclasses.dataclass(frozen=True, slots=True)
class Thresholds:
    max_memory_growth_bytes: int
    max_memory_slope_bytes_per_hour: float
    max_tail_cpu_cores: float
    max_throttled_period_ratio: float
    allow_rejections: bool
    max_transient_gauge_growth: float
    require_hard_limits: bool
    max_event_loop_lag_ms: float
    max_event_loop_p95_lag_ms: float
    require_event_loop_metrics: bool


@dataclasses.dataclass(frozen=True, slots=True)
class WorkloadResult:
    executable: str | None
    argument_count: int
    started_at_seconds: float | None
    completed_at_seconds: float | None
    return_code: int | None
    timed_out: bool


@dataclasses.dataclass(frozen=True, slots=True)
class GateResult:
    failures: tuple[str, ...]
    warnings: tuple[str, ...]
    targets: dict[str, dict[str, Any]]

    @property
    def passed(self) -> bool:
        return not self.failures


def parse_duration(value: str) -> float:
    """Parse a positive duration such as 30s, 5m, 2h or 1d."""

    match = re.fullmatch(r'\s*(\d+(?:\.\d+)?)\s*([smhd]?)\s*', value, re.IGNORECASE)
    if match is None:
        raise argparse.ArgumentTypeError(f'invalid duration: {value!r}')
    amount = float(match.group(1))
    if amount <= 0:
        raise argparse.ArgumentTypeError('duration must be greater than zero')
    multiplier = {
        '': 1.0,
        's': 1.0,
        'm': 60.0,
        'h': 3600.0,
        'd': 86400.0,
    }[match.group(2).lower()]
    return amount * multiplier


def _parse_named_values(values: Iterable[str], *, option: str) -> dict[str, str]:
    parsed: dict[str, str] = {}
    for value in values:
        name, separator, location = value.partition('=')
        name = name.strip()
        location = location.strip()
        if not separator or not TARGET_NAME_RE.fullmatch(name) or not location:
            raise ValueError(f'{option} must use NAME=VALUE with a safe, non-empty name: {value!r}')
        if name in parsed:
            raise ValueError(f'duplicate target name {name!r} in {option}')
        parsed[name] = location
    return parsed


def _safe_endpoint_url(value: str) -> str:
    parsed = urllib.parse.urlsplit(value)
    if parsed.scheme not in {'http', 'https'} or not parsed.hostname:
        raise ValueError(f'health endpoint must be an http(s) URL: {value!r}')
    if parsed.username or parsed.password or parsed.query or parsed.fragment:
        raise ValueError('health endpoint URLs must not contain credentials, query parameters or fragments')
    return urllib.parse.urlunsplit((parsed.scheme, parsed.netloc, parsed.path or '/', '', ''))


def build_targets(
    *,
    endpoints: Iterable[str],
    cgroups: Iterable[str],
    pids: Iterable[str],
) -> list[Target]:
    targets: list[Target] = []
    seen_names: set[str] = set()
    for kind, option, values in (
        ('endpoint', '--endpoint', endpoints),
        ('cgroup', '--cgroup', cgroups),
        ('process', '--pid', pids),
    ):
        for name, location in _parse_named_values(values, option=option).items():
            qualified_name = f'{kind}:{name}'
            if qualified_name in seen_names:
                raise ValueError(f'duplicate target {qualified_name!r}')
            seen_names.add(qualified_name)
            if kind ==
```

### Core Architecture Module: `scripts/runtime_resource_probe.py`
```
#!/usr/bin/env python3
"""Exercise long-lived Core registries and verify that they reach a plateau.

This probe is intentionally separate from the default test suite because the
audit profile creates tens of thousands of historical identities. It uses the
real admission, eviction, and cleanup code while replacing external platform
objects that are irrelevant to registry retention.
"""

from __future__ import annotations

import argparse
import asyncio
import gc
import json
import time
import tracemalloc
from dataclasses import asdict, dataclass
from types import SimpleNamespace
from unittest.mock import patch

import psutil

from langbot.pkg.api.http.context import ExecutionContext

# Import the Application graph before taskmgr. The production boot path has
# this same ordering; importing taskmgr first exposes its historical cycle
# through HTTP route annotations.
from langbot.pkg.core import app as _core_app  # noqa: F401
from langbot.pkg.core.taskmgr import AsyncTaskManager
from langbot.pkg.pipeline.pool import QueryPool
from langbot.pkg.pipeline.ratelimit.algos.fixedwin import FixedWindowAlgo
from langbot.pkg.plugin.connector import PluginRuntimeConnector
from langbot.pkg.platform.sources.websocket_adapter import (
    WebSocketMessage,
    WebSocketSession,
)
from langbot.pkg.provider.modelmgr.modelmgr import ModelManager
from langbot.pkg.provider.session.sessionmgr import SessionManager
from langbot_plugin.api.entities.builtin.provider.session import LauncherTypes


@dataclass(frozen=True, slots=True)
class ProbeScale:
    query_churn_per_phase: int
    session_churn_per_phase: int
    rate_limit_churn_per_phase: int
    task_churn_per_phase: int
    websocket_churn_per_phase: int
    empty_workspace_churn_per_phase: int


SCALES = {
    'quick': ProbeScale(
        query_churn_per_phase=2_500,
        session_churn_per_phase=500,
        rate_limit_churn_per_phase=10_000,
        task_churn_per_phase=1_000,
        websocket_churn_per_phase=500,
        empty_workspace_churn_per_phase=1_000,
    ),
    'audit': ProbeScale(
        query_churn_per_phase=25_000,
        session_churn_per_phase=2_500,
        rate_limit_churn_per_phase=10_000,
        task_churn_per_phase=5_000,
        websocket_churn_per_phase=2_500,
        empty_workspace_churn_per_phase=10_000,
    ),
}


class _ProbeQuery:
    """Small weak-referenceable stand-in for SDK Query construction."""

    def __init__(self, **values):
        self.__dict__.update(values)


class _EmptyResult:
    def all(self) -> list:
        return []


class _EmptyPluginRuntimeHandler:
    async def reconcile_plugin_installations(self, _states: tuple) -> dict:
        return {
            'applied': [],
            'removed': [],
            'missing_artifacts': [],
            'failed_installations': [],
        }

    def unregister_installation_binding(self, _binding) -> None:
        raise AssertionError('An empty Workspace exposed an installation binding')


@dataclass(frozen=True, slots=True)
class ProcessSample:
    rss_bytes: int
    traced_current_bytes: int
    traced_peak_bytes: int
    asyncio_tasks: int
    threads: int
    open_fds: int | None


def _sample_process() -> ProcessSample:
    gc.collect()
    process = psutil.Process()
    try:
        open_fds = process.num_fds()
    except (AttributeError, psutil.Error):
        open_fds = None
    traced_current, traced_peak = tracemalloc.get_traced_memory()
    return ProcessSample(
        rss_bytes=process.memory_info().rss,
        traced_current_bytes=traced_current,
        traced_peak_bytes=traced_peak,
        asyncio_tasks=len(asyncio.all_tasks()),
        threads=process.num_threads(),
        open_fds=open_fds,
    )


def _execution_context(index: int, *, query_uuid: str | None = None) -> ExecutionContext:
    return ExecutionContext(
        instance_uuid='runtime-resource-probe',
        workspace_uuid=f'workspace-{index}',
        placement_generation=1,
        bot_uuid='probe-bot',
        pipeline_uuid='probe-pipeline',
        query_uuid=query_uuid,
    )


class CoreRuntimeProbe:
    """Own the same manager instances across two equal churn phases."""

    def __init__(self) -> None:
        self.query_pool = QueryPool(max_queries=100, max_queries_per_workspace=1)
        app = SimpleNamespace(
            event_loop=asyncio.get_running_loop(),
            persistence_mgr=None,
            instance_config=SimpleNamespace(
                data={
                    'concurrency': {'session': 1},
                    'system': {
                        'session_retention': {
                            'idle_ttl_seconds': 86_400,
                            'max_entries': 200,
                            'max_entries_per_workspace': 200,
                            'max_conversations_per_session': 20,
                            'max_messages_per_conversation': 100,
                        },
                        'task_retention': {
                            'completed_limit': 200,
                            'max_log_chars': 4_096,
                            'max_active_user_tasks': 256,
                            'max_active_user_tasks_per_workspace': 8,
                        },
                    },
                }
            ),
        )
        self.session_manager = SessionManager(app)
        self.task_manager = AsyncTaskManager(app)
        self.rate_limit = FixedWindowAlgo(SimpleNamespace())
        self.websocket_session = WebSocketSession(
            'resource-probe',
            max_conversations=200,
            max_messages=100,
        )
        logger = SimpleNamespace(
            debug=lambda *_args, **_kwargs: None,
            info=lambda *_args, **_kwargs: None,
            warning=lambda *_args, **_kwargs: None,
            error=lambda *_args, **_kwargs: None,
        )
        self.empty_model_queries = 0

        async def execute_empty(_statement):
            self.empty_model_queries += 1
            return _EmptyResult()

        model_app = SimpleNamespace(
            logger=logger,
            persistence_mgr=SimpleNamespace(execute_async=execute_empty),
        )
        self.empty_model_manager = ModelManager(model_app)

        async def runtime_disconnect_callback(_connector) -> None:
            return None

        plugin_app = SimpleNamespace(
            instance_config=SimpleNamespace(data={'plugin': {'enable': True}}),
            deployment=SimpleNamespace(mode='cloud'),
            logger=logger,
        )
        self.empty_plugin_connector = PluginRuntimeConnector(
            plugin_app,
            runtime_disconnect_callback,
        )
        self.empty_plugin_connector.handler = _EmptyPluginRuntimeHandler()

        async def validate_context(context):
            return context

        async def load_desired_states(_context):
            return []

        self.empty_plugin_connector._validate_execution_context = validate_context
        self.empty_plugin_connector._load_workspace_desired_states = load_desired_states

    async def initialize(self) -> None:
        await self.rate_limit.initialize()

    async def run_phase(self, scale: ProbeScale, phase: int) -> None:
        offsets = {
            'query': (phase - 1) * scale.query_churn_per_phase,
            'session': (phase - 1) * scale.session_churn_per_phase,
            'rate': (phase - 1) * scale.rate_limit_churn_per_phase,
            'task': (phase - 1) * scale.task_churn_per_phase,
            'websocket': (phase - 1) * scale.websocket_churn_per_phase,
            'empty_workspace': ((phase - 1) * scale.empty_workspace_churn_per_phase),
        }
        await self._churn_queries(offsets['query'], scale.query_churn_per_phase)
        await self._churn_sessions(offsets['session'], scale.session_churn_per_phase)
        await self._churn_rate_limits(offsets['rate'], scale.rate_limit_churn_per_phase)
        await self._churn_tasks(offsets['task'], scale.task_churn_per_phase)
        self.
```

### Core Architecture Module: `scripts/workspace_runtime_capacity_probe.py`
```
#!/usr/bin/env python3
"""Measure populated Workspace runtime replacement cost and retention.

Unlike ``runtime_resource_probe.py``, which stresses historical request keys
and empty tenants, this probe keeps one representative Provider, LLM,
Embedding model, Rerank model, Pipeline, Bot, and Knowledge Base per Workspace.
It then advances every Workspace to a new placement generation and verifies
that old runtime objects are closed and collectible while active registry
cardinality remains constant.
"""

from __future__ import annotations

import argparse
import asyncio
import gc
import json
import time
import tracemalloc
import weakref
from dataclasses import asdict, dataclass
from types import SimpleNamespace

import psutil

from langbot.pkg.api.http.context import ExecutionContext

# Match the production import order; importing a leaf manager first exposes a
# historical annotation cycle that the application graph resolves.
from langbot.pkg.core import app as _core_app  # noqa: F401
from langbot.pkg.entity.persistence import bot as persistence_bot
from langbot.pkg.entity.persistence import model as persistence_model
from langbot.pkg.entity.persistence import pipeline as persistence_pipeline
from langbot.pkg.entity.persistence import rag as persistence_rag
from langbot.pkg.pipeline.pipelinemgr import PipelineManager
from langbot.pkg.platform.botmgr import PlatformManager
from langbot.pkg.provider.modelmgr import requester
from langbot.pkg.provider.modelmgr.modelmgr import ModelManager
from langbot.pkg.provider.tools.loaders.mcp import MCPLoader
from langbot.pkg.rag.knowledge.kbmgr import RAGManager
from langbot.pkg.workspace.entities import WorkspaceExecutionBinding


@dataclass(frozen=True, slots=True)
class ProbeScale:
    workspaces: int


SCALES = {
    'quick': ProbeScale(workspaces=250),
    'audit': ProbeScale(workspaces=5_000),
}


@dataclass(frozen=True, slots=True)
class ProcessSample:
    rss_bytes: int
    traced_current_bytes: int
    traced_peak_bytes: int
    asyncio_tasks: int
    threads: int
    open_fds: int | None


class _ProbeLogger:
    def debug(self, *_args, **_kwargs) -> None:
        return None

    def info(self, *_args, **_kwargs) -> None:
        return None

    def warning(self, *_args, **_kwargs) -> None:
        return None

    def error(self, *_args, **_kwargs) -> None:
        return None


class _ProbeWorkspaceService:
    instance_uuid = 'runtime-capacity-probe'

    def __init__(self) -> None:
        self.generations: dict[str, int] = {}
        self.binding_lookups = 0

    async def get_execution_binding(
        self,
        workspace_uuid: str,
        *,
        expected_generation: int | None = None,
    ) -> WorkspaceExecutionBinding:
        self.binding_lookups += 1
        generation = self.generations[workspace_uuid]
        if expected_generation is not None and expected_generation != generation:
            raise AssertionError(f'stale probe generation {expected_generation} != {generation}')
        return WorkspaceExecutionBinding(
            instance_uuid=self.instance_uuid,
            workspace_uuid=workspace_uuid,
            placement_generation=generation,
            write_fenced=False,
            state='active',
        )


class _ProbeRequester(requester.ProviderAPIRequester):
    name = 'capacity-probe'
    closed = 0

    async def invoke_llm(
        self,
        query,
        model,
        messages,
        funcs=None,
        extra_args=None,
        remove_think=False,
    ):
        return None

    async def aclose(self) -> None:
        type(self).closed += 1


class _ProbeAdapter:
    killed = 0

    def __init__(self, _config, _logger) -> None:
        self.listeners = []

    def register_listener(self, event_type, listener) -> None:
        self.listeners.append((event_type, listener))

    async def kill(self) -> None:
        type(self).killed += 1


class _ProbeMCPSession:
    closed = 0

    def __init__(self, server_name: str) -> None:
        self.server_name = server_name

    async def shutdown(self) -> None:
        type(self).closed += 1


def _sample_process() -> ProcessSample:
    gc.collect()
    process = psutil.Process()
    try:
        open_fds = process.num_fds()
    except (AttributeError, psutil.Error):
        open_fds = None
    traced_current, traced_peak = tracemalloc.get_traced_memory()
    return ProcessSample(
        rss_bytes=process.memory_info().rss,
        traced_current_bytes=traced_current,
        traced_peak_bytes=traced_peak,
        asyncio_tasks=len(asyncio.all_tasks()),
        threads=process.num_threads(),
        open_fds=open_fds,
    )


class PopulatedWorkspaceProbe:
    def __init__(self) -> None:
        _ProbeRequester.closed = 0
        _ProbeAdapter.killed = 0
        _ProbeMCPSession.closed = 0
        self.workspace_service = _ProbeWorkspaceService()
        self.logger = _ProbeLogger()
        self.app = SimpleNamespace(
            logger=self.logger,
            workspace_service=self.workspace_service,
            persistence_mgr=SimpleNamespace(
                mode=SimpleNamespace(value='cloud_runtime'),
            ),
            pipeline_config_meta_trigger={'name': 'trigger', 'stages': []},
            pipeline_config_meta_safety={'name': 'safety', 'stages': []},
            pipeline_config_meta_ai={'name': 'ai', 'stages': []},
            pipeline_config_meta_output={'name': 'output', 'stages': []},
            task_mgr=SimpleNamespace(
                cancel_by_scope=lambda *_args, **_kwargs: None,
                cancel_task=lambda *_args, **_kwargs: None,
            ),
        )
        self.model_manager = ModelManager(self.app)
        self.model_manager.requester_dict = {
            _ProbeRequester.name: _ProbeRequester,
        }
        self.pipeline_manager = PipelineManager(self.app)
        self.pipeline_manager.stage_dict = {}
        self.rag_manager = RAGManager(self.app)
        self.mcp_loader = MCPLoader(self.app)
        self.platform_manager = PlatformManager(self.app)
        self.platform_manager.adapter_dict = {
            'capacity-probe': _ProbeAdapter,
        }
        self.generation_refs: dict[
            int,
            list[weakref.ReferenceType],
        ] = {}

    def _context(
        self,
        workspace_uuid: str,
        generation: int,
        *,
        bot_uuid: str | None = None,
        pipeline_uuid: str | None = None,
    ) -> ExecutionContext:
        return ExecutionContext(
            instance_uuid=self.workspace_service.instance_uuid,
            workspace_uuid=workspace_uuid,
            placement_generation=generation,
            bot_uuid=bot_uuid,
            pipeline_uuid=pipeline_uuid,
        )

    async def load_generation(self, workspaces: int, generation: int) -> None:
        for index in range(workspaces):
            workspace_uuid = f'workspace-{index}'
            provider_uuid = f'provider-{index}'
            llm_uuid = f'llm-{index}'
            embedding_uuid = f'embedding-{index}'
            rerank_uuid = f'rerank-{index}'
            pipeline_uuid = f'pipeline-{index}'
            bot_uuid = f'bot-{index}'
            kb_uuid = f'knowledge-{index}'
            mcp_server_name = f'mcp-{index}'
            self.workspace_service.generations[workspace_uuid] = generation
            context = self._context(workspace_uuid, generation)

            runtime_provider = await self.model_manager.load_provider(
                context,
                persistence_model.ModelProvider(
                    uuid=provider_uuid,
                    workspace_uuid=workspace_uuid,
                    name='Capacity Provider',
                    requester=_ProbeRequester.name,
                    base_url='https://capacity.invalid',
                    api_keys=['probe'],
                ),
            )
            await self.model_manager.cache_provider(context, runtime_provider)

            runtime_llm = await self.model_manager.load_llm_m
```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #2619** (2026-09-30): **docs: move telemetry configuration out of READMEs**
  *Symptoms*: Move the Chinese and English optional-telemetry instructions into docs/TELEMETRY.md. Remove all telemetry text from root READMEs. No runtime changes. Verified all root README locales and git diff --check.

- **Issue #2618** (2026-09-30): **fix: document telemetry opt-out and silence delivery failures**
  *Symptoms*: ## Summary - Document default-on telemetry and the instance-wide disable_telemetry opt-out in Chinese/English READMEs and configuration template. - Keep delivery failures at DEBUG only; preserve best-effort exception isolation and background delivery. - Update existing failure tests to assert no warning alerts.  ## Verification - Existing telemetry suite: 44 passed. - Ruff and git diff --check passed.

- **Issue #2617** (2026-09-30): **feat: bounded execution telemetry for all processing modes**
  *Symptoms*: ## Summary - Core reports execution facts only; acceptance analysis remains in Space. - Observe platform events, route delivery, runner terminal state and affirmative API results. - Bound in-memory counters and upload rate; separate instance/workspace identities and honor disable_telemetry.  ## Verification - 164 existing focused tests pass; Ruff passes. - Public-IP sender/receiver/Postgres smoke verifies three modes and two workspaces. - 100,000-observation probe confirms 512-key cap.  Deploy Space receiver first (langbot-space#250). Independent Cloud pods are not changed.
  **Post-Mortem & Fix Analysis**:
  > ## [Codecov](https://app.codecov.io/gh/langbot-app/LangBot/pull/2617?dropdown=coverage&src=pr&el=h1&utm_medium=referral&utm_source=github&utm_content=comment&utm_campaign=pr+comments&utm_term=langbot-app) Report :x: Patch coverage is `36.17021%` with `120 lines` in your changes missing coverage. Please review. | [Files with missing lines](https://app.codecov.io/gh/langbot-app/LangBot/pull/2617?dropdown=coverage&src=pr&el=tree&utm_medium=referral&utm_source=github&utm_content=comment&utm_campaign=pr+comments&utm_term=langbot-app) | Patch % | Lines | |---|---|---| | [src/langbot/pkg/telemetry/platform.py](https://app.codecov.io/gh/langbot-app/LangBot/pull/2617?src=pr&el=tree&utm_medium=referral&utm_source=github&utm_content=comment&utm_campaign=pr+comments&utm_term=langbot-app#diff-c3JjL2xhbmdib3QvcGtnL3RlbGVtZXRyeS9wbGF0Zm9ybS5weQ==) | 17.33% | [62 Missing :warning: ](https://app.codecov.io/gh/langbot-app/LangBot/pull/2617?src=pr&el=tree&utm_medium=referral&utm_source=github&utm_content

- **Issue #2616** (2026-09-30): **refactor: remove Beta diagnostics**
  *Symptoms*: Remove Beta diagnostic collection, wrappers, transport, configuration and dedicated docs/tests. Preserve product telemetry and plugin error feedback. Validation: 73 Runner/telemetry tests, 25 boot/MCP/WebSocket tests; Ruff and compileall pass.

- **Issue #2615** (2026-09-30): **feat(market): certified plugin checks and explanatory tooltips**
  *Symptoms*: Carry certification status through marketplace lists and recommendations. Display the same green check and localized documentation tooltip as Space. Detail links lead to the Space detail page. Verified TypeScript and production Vite build.

- **Issue #2613** (2026-09-29): **fix(i18n): complete beta banner translations**
  *Symptoms*: ## Summary Fill missing beta_banner translations in Spanish, Russian, Thai, Vietnamese and Traditional Chinese. Fixes the master i18n consistency failure without changing CI gates or plugin code.  ## Verification - node web/scripts/check-i18n.mjs - git diff --check

- **Issue #2610** (2026-09-28): **fix(certification): align certified sharing, unsigned dedicated, and docs**
  *Symptoms*: Integrates code semantics and previously proposed docs on current canonical base. Cloud: only valid v2 shared-runtime-v1 + stateless-v1 grants singleton sharing; unsigned archives run dedicated; malformed, forged, legacy, or insufficient signatures still error. OSS remains dedicated. Space review evidence is fail-closed until an independently authenticated trusted review source is configured; no PASS is asserted and no plugins are published. Includes tests and Core frontend lint formatting repair.
  **Post-Mortem & Fix Analysis**:
  > All contributors have signed the CLA. :white_check_mark: 所有贡献者均已签署 CLA。<br/><sub>Posted by the ****CLA Assistant Lite bot****.</sub>

- **Issue #2609** (2026-09-28): **fix(plugin): allow unsigned Cloud plugins as dedicated**
  *Symptoms*: Certification is solely cross-tenant shared eligibility. Unsigned Cloud archives install on dedicated workers; malformed, forged, or untrusted signed declarations remain rejected. Remove the obsolete Cloud certificate-required and OSS dedicated-certificate branches. Focused policy and install tests: 81 passed; ruff passed. No marketplace package is republished by this change.

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

### Incident Patch 1: `df64f83e` (2026-09-30)
**Commit Message**: fix(telemetry): schedule the trace payload send instead of dropping it

close_trace() called the coroutine TelemetryManager.start_send_task without
awaiting or scheduling it, so every payload closed on that path was silently
dropped and the runtime logged "coroutine ... was never awaited". The only
other caller awaits it correctly, so both call styles stay supported: call the
manager, schedule the returned coroutine on the running loop, and close it with
a debug log when no loop is available.

Regression case added in tests/unit_tests/telemetry/test_trace.py: it fails
before this change (payload never delivered) and passes after.

**File**: `src/langbot/pkg/telemetry/execution.py` (modified, +19/-1)
```diff
@@ -167,10 +167,28 @@ def close_trace(self, state: TraceState, reason: str = 'event_done') -> None:
                 return
             payload = self._build_trace_payload(state, reason)
             if payload is not None:
-                self.manager.start_send_task(payload)
+                self._dispatch_payload(payload)
         except Exception:
             return
 
+    def _dispatch_payload(self, payload: dict) -> None:
+        """Hand one built payload to the telemetry manager from this sync context.
+
+        TelemetryManager.start_send_task is a coroutine, so calling it without
+        scheduling dropped every trace closed here. Stand-ins used by tests and
+        manual tools schedule synchronously, hence the coroutine check.
+        """
+        result = self.manager.start_send_task(payload)
+        if not asyncio.iscoroutine(result):
+            return
+        try:
+            asyncio.get_running_loop().create_task(result)
+        except RuntimeError:
+            result.close()
+            logger = getattr(getattr(self.manager, 'ap', None), 'logger', None)
+            if logger is not None:
+                logger.debug('Execution trace payload dropped: no running event loop')
+
     def _trace_emitted(self, state: TraceState) -> bool:
         mode = self.trace_mode()
         if mode == 'off':
```

**File**: `tests/unit_tests/telemetry/test_trace.py` (modified, +25/-0)
```diff
@@ -344,3 +344,28 @@ def test_ingress_without_telemetry_is_a_no_op(self):
         _, execution = get_modules()
         with execution.ingress(types.SimpleNamespace(), 'event_done'):
             pass
+
+
+class AsyncSendManager(FakeManager):
+    """Stand-in whose start_send_task is a coroutine, like TelemetryManager."""
+
+    async def start_send_task(self, payload: dict) -> None:
+        self.sent.append(payload)
+
+
+class TestTraceDispatch:
+    async def test_close_trace_schedules_the_coroutine_send(self):
+        trace, execution = get_modules()
+        manager = AsyncSendManager(trace_config())
+        counters = execution.ExecutionCounters(manager)
+        binding = trace.bind()
+        try:
+            counters.record(CONTEXT, **STAGE)
+            counters.close_trace(binding.state, 'event_done')
+            # The payload is only delivered once the scheduled task runs.
+            assert manager.sent == []
+            await asyncio.sleep(0)
+        finally:
+            trace.unbind_root(binding)
+        assert len(manager.sent) == 1
+        assert manager.sent[0]['event_type'] == 'feature_execution'
```

---

### Incident Patch 2: `0efc1fb1` (2026-09-30)
**Commit Message**: feat(telemetry): trace one inbound event end to end

Execution telemetry already reported window counters. This adds one bounded,
content-free chain per inbound platform event, so a single event can be
followed from its source platform through routing and processing to the
platform API calls it caused.

- telemetry/trace.py: ContextVar trace identity with route and run scopes, and
  a 32-stage bound per chain.
- telemetry/execution.py: keeps at most 64 chains for 120s, decides sampling
  from the observed outcome, and sends one payload per chain keyed by
  query_id = trace_id, so Space fetches a chain by primary identity. Window
  counters are unchanged and remain the source of coverage statistics.
- botmgr / pipelinemgr / orchestrator: bind the trace at the ingress boundary,
  scope routing identity per dispatch, and attach the run identity, so nested
  lanes (event -> route -> pipeline/runner -> platform API) reuse one chain. A
  run reached without an ingress (WebUI debug, service API) owns its own chain.
- space.execution_trace selects off | failures | sampled | all (default
  sampled: failures, WebUI debug runs and every N-th success).

Chains carry only code-defined identifie

**File**: `src/langbot/pkg/agent/runner/orchestrator.py` (modified, +11/-0)
```diff
@@ -37,6 +37,8 @@
 from .session_registry import AgentRunSessionRegistry, get_session_registry
 from .state_scope import build_state_context
 from ...provider.tools.loaders import skill as skill_loader
+from ...telemetry import trace as trace_mod
+from ...telemetry.execution import close_trace as close_execution_trace
 from ...telemetry.execution import record as record_execution
 
 
@@ -211,8 +213,14 @@ async def run(
         terminal_reason: str | None = None
         terminal_usage: dict[str, typing.Any] | None = None
         execution_outcome = 'unknown'
+        # A run reached without a platform ingress (WebUI debug, service API)
+        # owns its own chain; a run inside an ingress reuses that chain.
+        trace_binding: trace_mod.TraceBinding | None = None
+        run_token: typing.Any = None
 
         try:
+            trace_binding = trace_mod.bind()
+            run_token = trace_mod.set_run(run_id)
             await self.journal.create_run(
                 event=event,
                 binding=binding,
@@ -419,6 +427,9 @@ async def run(
                 outcome=execution_outcome,
                 synthetic=event.source == 'webui',
             )
+            trace_mod.reset_run(run_token)
+            if trace_binding is not None and trace_mod.unbind_root(trace_binding):
+                close_execution_trace(self.ap, trace_binding.state, 'runner_done')
             binding_box = getattr(execution_query, '_box_binding', None)
             if binding_box is not None and binding_box.run_id == run_id:
                 object.__delattr__(execution_query, '_box_binding')
```

**File**: `src/langbot/pkg/pipeline/pipelinemgr.py` (modified, +5/-1)
```diff
@@ -367,11 +367,15 @@ async def _execute_from_stage(
             i += 1
 
     async def process_query(self, query: pipeline_query.Query):
+        from ..telemetry.execution import ingress
         from ..telemetry.platform import processing_mode
 
         token = processing_mode.set('pipeline')
         try:
-            return await self._process_query(query)
+            # Callers without a platform event (Webchat, HTTP API) still get one
+            # trace for the whole Pipeline lane; nested calls reuse the trace.
+            with ingress(self.ap, 'pipeline_done'):
+                return await self._process_query(query)
         finally:
             processing_mode.reset(token)
 
```

**File**: `src/langbot/pkg/platform/botmgr.py` (modified, +71/-32)
```diff
@@ -352,6 +352,20 @@ def diagnose_eba_event_binding(
         """Return the selected event binding plus per-binding diagnostic steps."""
         return self._evaluate_eba_event_bindings(self._get_event_bindings(), event, event_type)
 
+    @staticmethod
+    def _route_ref(
+        binding: dict | None,
+        target_type: str | None = None,
+        target_uuid: str | None = None,
+    ) -> str:
+        """Code-defined route identity for telemetry; never a user-facing name."""
+        binding = binding or {}
+        kind = str(target_type or binding.get('target_type') or '').strip()
+        target = str(target_uuid or binding.get('target_uuid') or '').strip()
+        if not kind or not target:
+            return ''
+        return f'{kind}:{target}'[:160]
+
     async def _record_event_route_trace(
         self,
         *,
@@ -383,17 +397,19 @@ async def _record_event_route_trace(
         log_method = getattr(self.logger, level, self.logger.info)
         await log_method(text, metadata=metadata)
         if status in {'delivered', 'failed', 'discarded', 'not_matched'}:
+            from ..telemetry import trace as trace_mod
             from ..telemetry.execution import record
 
-            record(
-                getattr(self, 'ap', None),
-                getattr(self, 'execution_context', None),
-                family='event_route',
-                operation=event_type,
-                adapter=type(getattr(self, 'adapter', None)).__name__,
-                mode=target_type if target_type in {'pipeline', 'agent', 'event_processor'} else 'none',
-                outcome={'delivered': 'success', 'failed': 'failed'}.get(status, 'skipped'),
-            )
+            with trace_mod.scope(route_ref=self._route_ref(binding, target_type, target_uuid)):
+                record(
+                    getattr(self, 'ap', None),
+                    getattr(self, 'execution_context', None),
+                    family='event_route',
+                    operation=event_type,
+                    adapter=type(getattr(self, 'adapter', None)).__name__,
+                    mode=target_type if target_type in {'pipeline', 'agent', 'event_processor'} else 'none',
+                    outcome={'delivered': 'success', 'failed': 'failed'}.get(status, 'skipped'),
+                )
         return metadata
 
     def get_pipeline_target_for_event_type(self, event_type: str = 'message.received') -> str | None:
@@ -852,7 +868,19 @@ async def _handle_platform_event(
         event: platform_events.EBAEvent,
         adapter: abstract_platform_adapter.AbstractMessagePlatformAdapter,
     ) -> None:
+        # One inbound event owns one execution trace; every stage recorded while
+        # it is handled (routing, runner, platform API calls) joins that trace.
+        from ..telemetry.execution import ingress
+
         event.bot_uuid = self.bot_entity.uuid
+        with ingress(getattr(self, 'ap', None), 'event_done'):
+            await self._handle_platform_event_body(event, adapter)
+
+    async def _handle_platform_event_body(
+        self,
+        event: platform_events.EBAEvent,
+        adapter: abstract_platform_adapter.AbstractMessagePlatformAdapter,
+    ) -> None:
         from ..telemetry.execution import record
 
         record(
@@ -951,12 +979,15 @@ async def _dispatch_eba_event_to_processor(
         )
         if target_type == 'discard':
             if isinstance(event, platform_events.MessageReceivedEvent):
-                await self._dispatch_eba_message_to_pipeline(
-                    event,
-                    adapter,
-                    pipeline_uuid=self.PIPELINE_DISCARD,
-                    routed_by_event_binding=True,
-                )
+                from ..telemetry import trace as trace_mod
+
+                with trace_mod.scope(route_ref=self._route_ref(event_binding)):
+                    await self._dispatch_eba_message_to_pipeline(
+                        event,
+                  
```

**File**: `src/langbot/pkg/telemetry/execution.py` (modified, +195/-5)
```diff
@@ -2,29 +2,68 @@
 
 This module reports observations only. Coverage catalogs and acceptance rules
 belong to Space. Aggregation keys include both immutable execution identities.
+
+Two shapes share one payload type:
+
+* window counters, aggregated by ``(family, operation, mode, adapter, runner,
+  outcome, synthetic)`` — unchanged coverage reporting;
+* per-event traces, one bounded payload per traced event, keyed by
+  ``query_id = trace_id`` so Space can fetch a whole chain by primary identity.
+
+Traces are additive: they never alter the counters, and both are bounded in
+memory, batch size and send concurrency.
 """
 
 from __future__ import annotations
 
 import asyncio
+import contextlib
+import time
 from datetime import datetime, timezone
 from uuid import uuid4
 
+from . import trace as trace_mod
 from .identity import workspace_identity
+from .trace import TraceState
 
 MAX_KEYS = 512
 MAX_BATCH = 32
 FLUSH_SECONDS = 60
 MODES = frozenset({'pipeline', 'agent', 'event_processor', 'none'})
 OUTCOMES = frozenset({'success', 'failed', 'cancelled', 'timeout', 'skipped', 'unknown'})
 
+# Trace bounds: stages per trace, traces buffered per process, trace lifetime.
+MAX_TRACES = 64
+TRACE_TTL_SECONDS = 120
+TRACE_MODES = frozenset({'off', 'failures', 'sampled', 'all'})
+DEFAULT_TRACE_MODE = 'sampled'
+DEFAULT_TRACE_SAMPLE = 20
+
 
 class ExecutionCounters:
     def __init__(self, manager):
         self.manager = manager
         self.pending: dict[tuple, dict] = {}
         self.task: asyncio.Task | None = None
         self.dropped = 0
+        self.traces: dict[str, TraceState] = {}
+        self.trace_deadlines: dict[str, float] = {}
+        self.dropped_traces = 0
+
+    # ------------------------------------------------------------------ config
+
+    def trace_mode(self) -> str:
+        mode = str(self.manager.telemetry_config.get('execution_trace', DEFAULT_TRACE_MODE) or '').strip().lower()
+        return mode if mode in TRACE_MODES else DEFAULT_TRACE_MODE
+
+    def trace_sample(self) -> int:
+        try:
+            sample = int(self.manager.telemetry_config.get('execution_trace_sample', DEFAULT_TRACE_SAMPLE))
+        except (TypeError, ValueError):
+            sample = DEFAULT_TRACE_SAMPLE
+        return sample if 1 <= sample <= 100000 else DEFAULT_TRACE_SAMPLE
+
+    # --------------------------------------------------------------- recording
 
     def record(
         self,
@@ -50,6 +89,19 @@ def record(
             if any(not isinstance(v, str) or len(v) > 160 for v in (operation, adapter, runner)):
                 return
             identity = workspace_identity(context)
+            state = trace_mod.current()
+            if state is not None:
+                self._record_trace_stage(
+                    state,
+                    identity=identity,
+                    family=family,
+                    operation=operation,
+                    mode=mode,
+                    adapter=adapter,
+                    runner=runner,
+                    outcome=outcome,
+                    synthetic=synthetic,
+                )
             key = (
                 identity['instance_id'],
                 identity['workspace_uuid'],
@@ -70,16 +122,124 @@ def record(
                 self.pending[key] = row
             row['count'] = min(row['count'] + 1, 2147483647)
             row['last_seen'] = datetime.now(timezone.utc).isoformat()
-            if self.task is None or self.task.done():
-                self.task = asyncio.create_task(self._loop())
+            self._ensure_loop()
         except Exception:
             # Observability must never change execution behavior.
             return
 
+    def _record_trace_stage(
+        self, state: TraceState, *, identity, family, operation, mode, adapter, runner, outcome, synthetic
+    ) -> None:
+        if state.abandoned:
+            return
+        if state.trace_id not in self.traces:
+            # Never buffer traces this configura
```

**File**: `src/langbot/pkg/telemetry/trace.py` (added, +166/-0)
```diff
@@ -0,0 +1,166 @@
+"""Content-free per-event execution traces.
+
+One trace identity is minted per inbound platform event and survives until the
+ingress handler returns. Stage records appended under it describe how that one
+event was routed and processed, using only code-defined identifiers. Nothing
+here is aggregated: a trace is a bounded, ordered sequence for one event.
+
+Three bounds keep memory independent of traffic volume:
+
+* ``MAX_STAGES`` stages per trace (further stages are counted, not kept);
+* ``MAX_TRACES`` traces in flight, enforced by the sender that owns the buffer;
+* a wall-clock TTL, enforced by the sender's sweep.
+
+The identity itself lives in a ContextVar so that asynchronous work spawned
+while handling one event inherits it, mirroring ``telemetry.platform``.
+"""
+
+from __future__ import annotations
+
+import contextlib
+import contextvars
+import typing
+from datetime import datetime, timezone
+from uuid import uuid4
+
+MAX_STAGES = 32
+
+_current: contextvars.ContextVar['TraceState | None'] = contextvars.ContextVar('telemetry_trace', default=None)
+_route: contextvars.ContextVar[str] = contextvars.ContextVar('telemetry_trace_route', default='')
+_run: contextvars.ContextVar[str] = contextvars.ContextVar('telemetry_trace_run', default='')
+
+
+def _now() -> str:
+    return datetime.now(timezone.utc).isoformat()
+
+
+class TraceState:
+    """Bounded stage buffer for exactly one event."""
+
+    __slots__ = (
+        'trace_id',
+        'started_at',
+        'stages',
+        'dropped_stages',
+        'synthetic',
+        'sequence',
+        'identity',
+        'abandoned',
+    )
+
+    def __init__(self) -> None:
+        self.trace_id = str(uuid4())
+        self.started_at = _now()
+        self.stages: list[dict[str, typing.Any]] = []
+        self.dropped_stages = 0
+        self.synthetic = False
+        self.sequence = 0
+        self.identity: dict[str, str] = {}
+        # Set when the sender refused to buffer this trace: stop appending.
+        self.abandoned = False
+
+    def append(
+        self,
+        *,
+        family: str,
+        operation: str,
+        mode: str,
+        adapter: str,
+        runner: str,
+        outcome: str,
+        synthetic: bool,
+    ) -> None:
+        if len(self.stages) >= MAX_STAGES:
+            self.dropped_stages += 1
+            return
+        seen = _now()
+        self.stages.append(
+            {
+                'family': family,
+                'operation': operation,
+                'mode': mode,
+                'adapter': adapter,
+                'runner': runner,
+                'outcome': outcome,
+                'synthetic': bool(synthetic),
+                'seq': self.sequence,
+                'route_ref': _route.get(),
+                'run_id': _run.get(),
+                'first_seen': seen,
+                'last_seen': seen,
+            }
+        )
+        self.sequence += 1
+        if synthetic:
+            self.synthetic = True
+
+    def outcome(self) -> str:
+        """Terminal outcome of the last recorded stage, for space-side display."""
+        return self.stages[-1]['outcome'] if self.stages else 'unknown'
+
+
+class TraceBinding(typing.NamedTuple):
+    state: TraceState
+    created: bool
+    token: typing.Any
+
+
+def bind() -> TraceBinding:
+    """Start a trace unless one is already in flight in this context."""
+    existing = _current.get()
+    if existing is not None:
+        return TraceBinding(existing, False, None)
+    state = TraceState()
+    return TraceBinding(state, True, _current.set(state))
+
+
+def unbind(binding: TraceBinding) -> bool:
+    """Detach this binding. Returns True when this caller owns the trace."""
+    if binding.token is not None:
+        try:
+            _current.reset(binding.token)
+        except (ValueError, RuntimeError):
+            # A token from another context must never break execution.
+            pass
+    return binding.create
```

---

### Incident Patch 3: `d3e4bd55` (2026-09-30)
**Commit Message**: fix: document telemetry opt-out and silence delivery failures (#2618)

* fix: document telemetry opt-out and silence delivery failures

* style: format telemetry debug logging

**File**: `README.md` (modified, +4/-0)
```diff
@@ -188,3 +188,7 @@ Thanks to all [contributors](https://github.com/langbot-app/LangBot/graphs/contr
 <a href="https://github.com/langbot-app/LangBot/graphs/contributors">
   <img src="https://contrib.rocks/image?repo=langbot-app/LangBot" />
 </a>
+
+## Optional telemetry
+
+Telemetry is enabled by default. To opt out, set `space.disable_telemetry: true` in your instance’s `data/config.yaml`, preserve other settings, and restart the instance. This disables usage, heartbeat and execution telemetry. In Cloud, the instance operator controls this setting for every workspace in the instance. Delivery is best-effort in background tasks; connection failures, timeouts and server errors do not block normal operations. Failure details are logged only at DEBUG level.
```

**File**: `README_CN.md` (modified, +4/-0)
```diff
@@ -212,3 +212,7 @@ LangBot **从设计上就对 Agent 友好** —— 你的编码 Agent（Claude C
 
 If you're a code agent based on LLM, you should read [AGENTS.md](AGENTS.md) to understand the project structure and development process before you start any development.
 -->
+
+## 可选遥测
+
+遥测默认开启。可以在实例 `data/config.yaml` 中将 `space.disable_telemetry` 改为 `true`，保留其他配置，然后重启实例。此开关关闭使用统计、实例心跳和功能执行遥测；Cloud 由实例运维方配置，对该实例所有工作区生效。遥测在后台尽力发送，网络故障、超时或服务端错误不会阻断正常操作；失败详情仅记录在 DEBUG 日志中。
```

**File**: `src/langbot/pkg/telemetry/telemetry.py` (modified, +8/-10)
```diff
@@ -170,9 +170,7 @@ async def send(self, payload: dict):
 
                         if resp.status_code >= 400:
                             body = await httpclient.response_text(resp, max_chars=200)
-                            self.ap.logger.warning(
-                                f'Telemetry post to {url} returned status {resp.status_code} - {body}'
-                            )
+                            self.ap.logger.debug(f'Telemetry post to {url} returned status {resp.status_code} - {body}')
                         else:
                             # Detect application-level errors inside HTTP 200 responses
                             app_err = False
@@ -181,15 +179,15 @@ async def send(self, payload: dict):
                                 app_code = j.get('code') if isinstance(j, dict) else None
                                 if app_code is not None and int(app_code) >= 400:
                                     app_err = True
-                                    self.ap.logger.warning(
+                                    self.ap.logger.debug(
                                         f'Telemetry post to {url} returned application error code {j.get("code")} - {j.get("msg")}'
                                     )
                             except Exception:
                                 pass
 
                             if app_err:
                                 body = await httpclient.response_text(resp, max_chars=200)
-                                self.ap.logger.warning(
+                                self.ap.logger.debug(
                                     f'Telemetry post to {url} returned app-level error - response: {body}'
                                 )
                             else:
@@ -200,19 +198,19 @@ async def send(self, payload: dict):
                             if not app_err:
                                 return True
                     except asyncio.TimeoutError:
-                        self.ap.logger.warning(f'Telemetry post to {url} timed out')
+                        self.ap.logger.debug(f'Telemetry post to {url} timed out')
                     except Exception as e:
-                        self.ap.logger.warning(f'Failed to post telemetry to {url}: {e}', exc_info=True)
+                        self.ap.logger.debug(f'Failed to post telemetry to {url}: {e}', exc_info=True)
             except Exception as e:
                 try:
-                    self.ap.logger.warning(
+                    self.ap.logger.debug(
                         f'Failed to create HTTP client for telemetry or sanitize payload: {e}', exc_info=True
                     )
                 except Exception:
                     pass
         except Exception as e:
-            # Never raise from telemetry; surface as warning for visibility
+            # Never raise from telemetry; diagnostics are debug-only.
             try:
-                self.ap.logger.warning(f'Unexpected telemetry error: {e}', exc_info=True)
+                self.ap.logger.debug(f'Unexpected telemetry error: {e}', exc_info=True)
             except Exception:
                 pass
```

**File**: `src/langbot/templates/config.yaml` (modified, +2/-1)
```diff
@@ -426,5 +426,6 @@ space:
     # OAuth authorization page URL (user will be redirected here)
     oauth_authorize_url: 'https://space.langbot.app/auth/authorize'
     disable_models_service: false
-    # Disable usage telemetry.
+    # Optional telemetry is enabled by default. Set true to disable usage,
+    # heartbeat and execution reporting; restart after changing this setting.
     disable_telemetry: false
```

**File**: `tests/unit_tests/telemetry/test_telemetry.py` (modified, +12/-8)
```diff
@@ -431,6 +431,7 @@ async def test_send_http_success_logs_debug(self):
         with patch.object(httpx, 'AsyncClient', return_value=mock_client):
             await manager.send({'query_id': 'test'})
 
+        mock_app.logger.warning.assert_not_called()
         mock_app.logger.debug.assert_called()
         # Verify debug message contains URL and status
         debug_call_args = mock_app.logger.debug.call_args[0][0]
@@ -459,8 +460,9 @@ async def test_send_http_error_status_logs_warning(self):
         with patch.object(httpx, 'AsyncClient', return_value=mock_client):
             await manager.send({'query_id': 'test'})
 
-        mock_app.logger.warning.assert_called()
-        warning_call_args = mock_app.logger.warning.call_args[0][0]
+        mock_app.logger.warning.assert_not_called()
+        mock_app.logger.debug.assert_called()
+        warning_call_args = mock_app.logger.debug.call_args[0][0]
         assert 'status 500' in warning_call_args
 
     @pytest.mark.asyncio
@@ -488,9 +490,9 @@ async def test_send_application_error_logs_warning(self):
             await manager.send({'query_id': 'test'})
 
         # Source code calls warning twice for application errors
-        assert mock_app.logger.warning.call_count >= 1
+        assert mock_app.logger.debug.call_count >= 1
         # Check that one of the calls contains application error info
-        all_warnings = [call[0][0] for call in mock_app.logger.warning.call_args_list]
+        all_warnings = [call[0][0] for call in mock_app.logger.debug.call_args_list]
         assert any('400' in w for w in all_warnings), f'No warning contained error code 400: {all_warnings}'
 
     @pytest.mark.asyncio
@@ -516,8 +518,9 @@ async def mock_post_timeout(url, json):
         with patch.object(httpx, 'AsyncClient', return_value=mock_client):
             await manager.send({'query_id': 'test'})
 
-        mock_app.logger.warning.assert_called()
-        warning_call_args = mock_app.logger.warning.call_args[0][0]
+        mock_app.logger.warning.assert_not_called()
+        mock_app.logger.debug.assert_called()
+        warning_call_args = mock_app.logger.debug.call_args[0][0]
         assert 'timed out' in warning_call_args
 
     @pytest.mark.asyncio
@@ -542,7 +545,8 @@ async def mock_post_error(url, json):
             # Should not raise exception
             await manager.send({'query_id': 'test'})
 
-        mock_app.logger.warning.assert_called()
+        mock_app.logger.warning.assert_not_called()
+        mock_app.logger.debug.assert_called()
 
     @pytest.mark.asyncio
     async def test_send_never_raises_exception(self):
@@ -551,7 +555,7 @@ async def test_send_never_raises_exception(self):
         mock_app = Mock()
         # Even logger may fail
         mock_app.logger = Mock()
-        mock_app.logger.warning = Mock(side_effect=Exception('Logger failed'))
+        mock_app.logger.debug = Mock(side_effect=Exception('Logger failed'))
 
         manager = telemetry.TelemetryManager(mock_app)
         manager.telemetry_config = {'url': 'https://example.com'}
```

---

### Incident Patch 4: `4fc700b7` (2026-09-30)
**Commit Message**: fix(tools): hide register_skill when Cloud sandboxes cannot scan host directories

scan_skill_directory is disabled for Cloud-managed sandboxes, but the
register_skill tool was still advertised to the model whenever a backend was
available, so every call failed closed without a usable explanation. Advertise
register_skill only when the runtime may scan sandbox directories, and keep
activate available in both modes.

**File**: `src/langbot/pkg/provider/tools/loaders/skill_authoring.py` (modified, +24/-9)
```diff
@@ -35,10 +35,7 @@ async def initialize(self):
         # Check if sandbox backend is available (same check as native tools)
         self._sandbox_available = await self._check_sandbox_available()
         if self._sandbox_available:
-            self._tools = [
-                self._build_activate_skill_tool(),
-                self._build_register_skill_tool(),
-            ]
+            self._tools = self._build_skill_tools()
         else:
             self.ap.logger.info(
                 'Skill tools (activate/register_skill) are NOT available. '
@@ -54,14 +51,32 @@ async def get_tools(self, bound_plugins: list[str] | None = None) -> list[resour
         if not await self._is_available():
             return []
         if not self._tools:
-            self._tools = [
-                self._build_activate_skill_tool(),
-                self._build_register_skill_tool(),
-            ]
+            self._tools = self._build_skill_tools()
         return list(self._tools)
 
+    def _build_skill_tools(self) -> list[resource_tool.LLMTool]:
+        tools = [self._build_activate_skill_tool()]
+        if self._skill_registration_available():
+            tools.append(self._build_register_skill_tool())
+        else:
+            self.ap.logger.info(
+                'register_skill is NOT available: Cloud sandboxes never scan arbitrary '
+                'host skill directories. Install skills through the skill store instead.'
+            )
+        return tools
+
+    def _skill_registration_available(self) -> bool:
+        """Host skill scanning is disabled for Cloud-managed sandboxes."""
+
+        box_service = getattr(self.ap, 'box_service', None)
+        return not bool(getattr(box_service, 'managed_admission_required', False))
+
     async def has_tool(self, name: str) -> bool:
-        return await self._is_available() and name in SKILL_TOOL_NAMES
+        if not await self._is_available() or name not in SKILL_TOOL_NAMES:
+            return False
+        if name == REGISTER_SKILL_TOOL_NAME:
+            return self._skill_registration_available()
+        return True
 
     async def _is_available(self) -> bool:
         """Check if skill tools should be available.
```

**File**: `tests/unit_tests/provider/test_skill_tools.py` (modified, +20/-0)
```diff
@@ -737,3 +737,23 @@ async def test_native_skill_tools_require_runner_box_binding():
     with pytest.raises(BoxValidationError, match='Runner must bind a Box'):
         await loader.invoke_tool('exec', {'command': 'true'}, _make_query())
     ap.box_service.execute_tool.assert_not_awaited()
+
+
+    @pytest.mark.asyncio
+    async def test_register_skill_hidden_when_cloud_scanning_is_disabled(self):
+        from langbot.pkg.provider.tools.loaders.skill_authoring import SkillToolLoader
+
+        ap = _make_ap()
+        ap.skill_mgr = _make_skill_manager({'demo': _make_skill_data(name='demo')})
+        ap.box_service = SimpleNamespace(
+            available=True,
+            managed_admission_required=True,
+            get_backend_status=AsyncMock(return_value={'backend': {'available': True}}),
+        )
+
+        loader = SkillToolLoader(ap)
+        await loader.initialize()
+
+        assert [tool.name for tool in await loader.get_tools()] == ['activate']
+        assert await loader.has_tool('register_skill') is False
+        assert await loader.has_tool('activate') is True
```

---

### Incident Patch 5: `ff3f3211` (2026-09-30)
**Commit Message**: fix(tools): resolve the sandbox interpreter for workspace file scripts

The workspace file tools (read/write/edit/glob/grep) ran a script through
`python`, which a sandbox built from a host rootfs may not provide: those hosts
ship `python3` only, and a read-only /usr prevents creating a `python` shim
inside the jail. Every file tool then failed with `/bin/sh: 1: python: not
found`. Resolve the interpreter with `command -v python3 || command -v python`,
matching the interpreter the Box service already uses for its own scripts.

**File**: `src/langbot/pkg/provider/tools/loaders/native.py` (modified, +8/-1)
```diff
@@ -754,9 +754,16 @@ def _sandbox_child_path(base: str, relative: str) -> str:
         return f'{str(base).rstrip("/")}/{relative}'
 
     async def _run_workspace_file_script(self, script: str, query: pipeline_query.Query) -> dict:
+        # Sandbox images built from a host rootfs may only ship `python3`, and a
+        # read-only /usr prevents creating a `python` shim inside the jail, so
+        # resolve the interpreter instead of assuming its name.
+        command = (
+            'PYTHON_BIN=$(command -v python3 || command -v python); '
+            f"\"$PYTHON_BIN\" - <<'PY'\n{script}\nPY"
+        )
         result = await self.ap.box_service.execute_tool(
             {
-                'command': f"python - <<'PY'\n{script}\nPY",
+                'command': command,
                 'timeout_sec': 30,
             },
             query,
```

**File**: `tests/unit_tests/provider/test_tool_manager_native.py` (modified, +32/-0)
```diff
@@ -851,3 +851,35 @@ async def test_box_grep_script_serializes_optional_include_as_python(monkeypatch
             values[statement.targets[0].id] = ast.literal_eval(statement.value)
     assert values['include'] == include
     assert values['path'] == '/workspace'
+
+
+@pytest.mark.asyncio
+async def test_workspace_file_script_resolves_the_sandbox_interpreter():
+    """Sandboxes built from a host rootfs may only ship `python3`."""
+
+    captured: dict = {}
+
+    async def execute_tool(payload, query):
+        captured.update(payload)
+        return {'ok': True, 'stdout': '{"ok": true}'}
+
+    box_service = SimpleNamespace(
+        available=True,
+        execute_tool=execute_tool,
+        require_workspace_sandbox=AsyncMock(),
+    )
+    loader = NativeToolLoader(SimpleNamespace(box_service=box_service, logger=Mock()))
+    query = SimpleNamespace(
+        _execution_context=_CONTEXT,
+        bot_uuid=None,
+        pipeline_uuid=None,
+        query_uuid=None,
+    )
+    query._box_binding = RunBoxBinding('run', 'box', {}, 'run')
+
+    result = await loader._run_workspace_file_script('print("x")', query)
+
+    assert result == {'ok': True}
+    command = captured['command']
+    assert command.startswith('PYTHON_BIN=$(command -v python3 || command -v python)')
+    assert command.endswith(" - <<'PY'\nprint(\"x\")\nPY")
```

---

### Incident Patch 6: `0c3917ee` (2026-09-30)
**Commit Message**: style(api): format the streamed Agent debug helper with ruff

**File**: `src/langbot/pkg/api/http/controller/groups/agent_debug_stream.py` (modified, +1/-5)
```diff
@@ -29,11 +29,7 @@ async def execute() -> None:
             application = getattr(service, 'ap', None)
             persistence_mgr = getattr(application, 'persistence_mgr', None)
             tenant_scope = getattr(persistence_mgr, 'tenant_scope', None)
-            scope = (
-                tenant_scope(context.workspace_uuid)
-                if callable(tenant_scope)
-                else contextlib.nullcontext()
-            )
+            scope = tenant_scope(context.workspace_uuid) if callable(tenant_scope) else contextlib.nullcontext()
             try:
                 # The streamed body is emitted after the request handler returned,
                 # so the request's tenant scope has already closed: carry the
```

---

### Incident Patch 7: `5758f207` (2026-09-30)
**Commit Message**: fix(vector): do not bind a query dimension for text-only search

A full-text search sends no query vector by design, but search() validated
len([]) == 0 as the expected embedding dimension, so the request failed with
'Embedding dimension 0 is not enabled for this deployment' and hid the
backend capability error. An empty query vector now means no expected
dimension to verify.

**File**: `src/langbot/pkg/vector/mgr.py` (modified, +4/-1)
```diff
@@ -356,7 +356,10 @@ async def search(
             scope = await self._resolve_pgvector_scope(
                 execution_context,
                 knowledge_base_uuid,
-                expected_dimension=len(query_vector),
+                # A text-only search sends no query vector; there is no dimension
+                # to bind, and validating an empty vector as dimension 0 would
+                # mask the backend capability error.
+                expected_dimension=len(query_vector) or None,
                 initialize_dimension=False,
             )
             results = await pgvector.search(
```

---

### Incident Patch 8: `e3e45d7b` (2026-09-30)
**Commit Message**: fix(api): keep the Workspace tenant scope for streamed Agent debug runs

The NDJSON debug stream emits its frames after the request handler returned,
so the request-scoped tenant scope is already closed by then. The deferred
execution therefore failed with TenantScopeRequiredError on its first
persistence access and the client only saw a generic runner_error frame with
no log entry.

Re-enter the Workspace tenant scope around the deferred execution and log
unexpected failures with their traceback.

**File**: `src/langbot/pkg/api/http/controller/groups/agent_debug_stream.py` (modified, +21/-1)
```diff
@@ -26,8 +26,25 @@ async def on_result(result: dict) -> None:
             await queue.put({'kind': 'result', 'data': result})
 
         async def execute() -> None:
+            application = getattr(service, 'ap', None)
+            persistence_mgr = getattr(application, 'persistence_mgr', None)
+            tenant_scope = getattr(persistence_mgr, 'tenant_scope', None)
+            scope = (
+                tenant_scope(context.workspace_uuid)
+                if callable(tenant_scope)
+                else contextlib.nullcontext()
+            )
             try:
-                result = await service.debug_agent(context, agent_uuid, payload, on_result=on_result)
+                # The streamed body is emitted after the request handler returned,
+                # so the request's tenant scope has already closed: carry the
+                # trusted Workspace identity into the deferred execution.
+                async with scope:
+                    result = await service.debug_agent(
+                        context,
+                        agent_uuid,
+                        payload,
+                        on_result=on_result,
+                    )
                 await queue.put({'kind': 'completed', 'data': result})
             except Exception as exc:
                 # The stream still uses HTTP 200 when execution returns an
@@ -46,6 +63,9 @@ async def execute() -> None:
                 elif isinstance(exc, RunnerError):
                     code, message = 'runner_error', 'The Agent runner could not complete this test'
                 else:
+                    logger = getattr(application, 'logger', None)
+                    if logger is not None:
+                        logger.exception('Agent debug stream execution failed')
                     code, message = 'runner_error', 'The Agent debug execution failed'
                 await queue.put({'kind': 'error', 'code': code, 'msg': message})
 
```

---

### Incident Patch 9: `6022c471` (2026-09-29)
**Commit Message**: fix(i18n): complete beta banner translations (#2613)

* fix(i18n): complete beta banner translations

* style(i18n): format beta banner messages

**File**: `web/src/i18n/locales/es-ES.ts` (modified, +9/-0)
```diff
@@ -3383,5 +3383,14 @@ const esES = {
     selectFromSidebar: 'Selecciona una página de plugin en la barra lateral',
     invalidPage: 'Página de plugin no válida',
   },
+  beta_banner: {
+    message:
+      'Este entorno está en fase beta. La estabilidad del servicio no está garantizada. Considera usar',
+    cloud_link: 'LangBot Cloud (entorno dedicado)',
+    or: 'o',
+    oss_link: 'la versión de código abierto autoalojada',
+    period: '.',
+    dismiss: 'Cerrar',
+  },
 };
 export default esES;
```

**File**: `web/src/i18n/locales/ru-RU.ts` (modified, +9/-0)
```diff
@@ -3342,5 +3342,14 @@ const ruRU = {
     selectFromSidebar: 'Выберите страницу плагина на боковой панели',
     invalidPage: 'Недопустимая страница плагина',
   },
+  beta_banner: {
+    message:
+      'Эта среда находится в стадии бета-тестирования. Стабильность сервиса не гарантируется. Рекомендуем использовать',
+    cloud_link: 'LangBot Cloud (выделенная среда)',
+    or: 'или',
+    oss_link: 'версию с открытым исходным кодом на своём сервере',
+    period: '.',
+    dismiss: 'Закрыть',
+  },
 };
 export default ruRU;
```

**File**: `web/src/i18n/locales/th-TH.ts` (modified, +9/-0)
```diff
@@ -3251,5 +3251,14 @@ const thTH = {
     selectFromSidebar: 'เลือกหน้าปลั๊กอินจากแถบด้านข้าง',
     invalidPage: 'หน้าปลั๊กอินไม่ถูกต้อง',
   },
+  beta_banner: {
+    message:
+      'สภาพแวดล้อมนี้อยู่ระหว่างการทดสอบเบต้า ไม่รับประกันความเสถียรของบริการ โปรดพิจารณาใช้',
+    cloud_link: 'LangBot Cloud (สภาพแวดล้อมเฉพาะ)',
+    or: 'หรือ',
+    oss_link: 'เวอร์ชันโอเพนซอร์สที่โฮสต์เอง',
+    period: '',
+    dismiss: 'ปิด',
+  },
 };
 export default thTH;
```

**File**: `web/src/i18n/locales/vi-VN.ts` (modified, +9/-0)
```diff
@@ -3299,5 +3299,14 @@ const viVN = {
     selectFromSidebar: 'Chọn một trang plugin từ thanh bên',
     invalidPage: 'Trang plugin không hợp lệ',
   },
+  beta_banner: {
+    message:
+      'Môi trường này đang trong giai đoạn thử nghiệm beta. Độ ổn định của dịch vụ không được đảm bảo. Hãy cân nhắc sử dụng',
+    cloud_link: 'LangBot Cloud (môi trường riêng)',
+    or: 'hoặc',
+    oss_link: 'phiên bản mã nguồn mở tự lưu trữ',
+    period: '.',
+    dismiss: 'Đóng',
+  },
 };
 export default viVN;
```

**File**: `web/src/i18n/locales/zh-Hant.ts` (modified, +8/-0)
```diff
@@ -3125,5 +3125,13 @@ const zhHant = {
     selectFromSidebar: '從側邊欄選擇一個插件頁面',
     invalidPage: '無效的插件頁面',
   },
+  beta_banner: {
+    message: '此環境正處於 Beta 測試階段，服務穩定性尚未保證。建議使用',
+    cloud_link: 'LangBot Cloud（獨立環境）',
+    or: '或',
+    oss_link: '自行部署的開源版本',
+    period: '。',
+    dismiss: '關閉',
+  },
 };
 export default zhHant;
```

---

### Incident Patch 10: `1fde3b42` (2026-09-28)
**Commit Message**: fix(certification): align certified sharing and unsigned dedicated admission (#2610)

Integrate certification policy, SDK/Core semantics, and documentation on canonical branch. Resolve duplicated documentation and keep invalid Cloud signatures rejected.

**File**: `docs/architecture/certified-plugins.md` (modified, +26/-19)
```diff
@@ -17,7 +17,10 @@ metadata.
 
 ## Trusted issuer configuration
 
-Configure the non-secret Ed25519 public-key ring in `data/config.yaml`:
+Hosted Cloud provisions the non-secret Ed25519 issuer public-key ring out of
+band. Key IDs must match the SDK envelope; values are base64 public keys, never
+private signing keys. Invalid configuration fails closed; keep old issuer keys
+through rotation while their signed archives remain installed.
 
 ```yaml
 plugin:
@@ -39,10 +42,11 @@ PLUGIN__CERTIFICATION__TRUSTED_PUBLIC_KEYS_JSON='{"ed25519:issuer":"<base64>"}'
 ```
 
 An **empty** ring is a supported state, not a misconfiguration. OSS defaults to
-it, so a self-hosted instance that has not provisioned any issuer key still
-installs packages (see the admission matrix below). Configure the ring to grant
-the shared-runtime profile; leave it empty to keep every package on the
-dedicated profile.
+it and supports one Workspace; configuring certification keys on OSS is not a
+supported way to enable cross-tenant sharing. Cloud provisions the ring to grant
+shared placement only to eligible v2 artifacts. Certification means eligibility
+for Cloud cross-tenant use of the same Worker and the same plugin/component
+singleton, never a dedicated certificate or intermediate trust tier.
 
 ## Admission matrix
 
@@ -52,21 +56,20 @@ dedicated profile.
 | Cloud | no signature | any | install on dedicated worker, without shared eligibility |
 | Cloud | malformed, untrusted, invalid, or non-shared declaration | any | reject before storage with `CERTIFIED_PLUGIN_CLOUD_CERTIFICATE_INVALID`; do not treat a broken signature as unsigned |
 | OSS | absent legacy envelope | any | admitted to the dedicated profile |
-| OSS | valid envelope declaring `shared-runtime-v1` + `stateless-v1` | any | selected shared singleton profile |
-| OSS | declaration signed by a **key this instance resolves** | false | reject with `CERTIFIED_PLUGIN_OSS_FORCE_REQUIRED` |
-| OSS | declaration signed by a **key this instance resolves** | true | admitted to the dedicated profile |
+| OSS | valid envelope declaring `shared-runtime-v1` + `stateless-v1` | any | dedicated only; OSS has no cross-tenant shared placement |
+| OSS | invalid declaration referencing a **key this instance resolves** | false | reject with `CERTIFIED_PLUGIN_OSS_FORCE_REQUIRED` |
+| OSS | invalid declaration referencing a **key this instance resolves** | true | admitted to the dedicated profile |
 | OSS | declaration this instance **cannot resolve** (empty ring) | any | admitted to the dedicated profile |
 
-The OSS row that matters for availability is the last one. Marketplace
-packages are signed by the marketplace issuer and declare
-`shared-runtime-v1`, while OSS ships an empty key ring by default. Treating that
-as a rejection made every certified marketplace package uninstallable with
-`CERTIFIED_PLUGIN_OSS_FORCE_REQUIRED` before artifact storage. Because the
-certificate is signed by an issuer the instance does not declare trusted, no
-shared-runtime privilege may be granted, so admission degrades the install to
-the existing `oss_dev` dedicated profile and records
-`CERTIFIED_PLUGIN_OSS_UNTRUSTED_DEDICATED`. This is not an escalation: it
-withholds the shared profile rather than granting it.
+There is no dedicated certification, dedicated signature, or intermediate
+certification trust tier. Advisory review is an internal prerequisite, not an
+installation trust status. An `issued` marketplace badge, source candidate,
+matching version, or shared artifact/dependency tree alone does not prove Cloud
+admission or Worker sharing. Compare the downloaded archive's ZIP comment,
+normalized digest and signed claims with the public version record and deployed
+Core trust-key ring. Confirm two Workspace bindings share one Worker PID, one
+plugin object, and one object for each declared component before claiming live
+cross-tenant sharing.
 
 A declaration is "resolvable" only when its `key_id` is present in th
```

**File**: `docs/pipeline-migration-config-map.zh-CN.md` (modified, +1/-1)
```diff
@@ -26,7 +26,7 @@
 
 ## 插件版本要求
 
-以下是迁移器要求的已发布 Certified Plugin 版本。旧版本即使名称相同，也不能作为当前 Cloud 迁移能力的证明。
+以下是迁移器要求的插件最低版本，不是认证版本清单。已发布的专属运行版本不等于已认证可跨工作区共享；旧版本即使名称相同，也不能作为当前 Cloud 迁移能力的证明。认证须由精确制品的有效签名及 `shared-runtime-v1`、`stateless-v1` 声明证明。
 
 - `local-agent` → `LocalAgent` **0.1.10**。
 - `dify-service-api` → `DifyAgent` **0.1.10**。
```

**File**: `src/langbot/pkg/plugin/certification.py` (modified, +10/-1)
```diff
@@ -199,7 +199,7 @@ def decide_plugin_admission(
 
     mode = DeploymentMode(deployment)
     certificate = facts.certificate
-    if certificate.is_valid_shared_runtime:
+    if mode is DeploymentMode.CLOUD and certificate.is_valid_shared_runtime:
         return PluginAdmissionDecision(
             AdmissionDisposition.SHARED_ELIGIBLE,
             AdmissionCode.SHARED_ELIGIBLE,
@@ -213,6 +213,15 @@ def decide_plugin_admission(
             DEDICATED_RUNTIME,
         )
 
+    # OSS has no cross-tenant shared placement; a verified claim stays dedicated
+    # there without inventing a dedicated certification tier.
+    if mode is DeploymentMode.OSS and certificate.is_valid_shared_runtime:
+        return PluginAdmissionDecision(
+            AdmissionDisposition.DEDICATED_ALLOWED,
+            AdmissionCode.OSS_UNTRUSTED_DEDICATED,
+            DEDICATED_RUNTIME,
+        )
+
     if mode is DeploymentMode.CLOUD:
         return PluginAdmissionDecision(
             AdmissionDisposition.REJECTED, AdmissionCode.CLOUD_CERTIFICATE_INVALID, DEDICATED_RUNTIME
```

**File**: `src/langbot/pkg/plugin/connector.py` (modified, +3/-2)
```diff
@@ -345,8 +345,9 @@ def _binding_from_setting(
             artifact_digest=setting.artifact_digest,
         )
 
-    @staticmethod
-    def _execution_mode_from_setting(setting: persistence_plugin.PluginSetting) -> PluginExecutionMode:
+    def _execution_mode_from_setting(self, setting: persistence_plugin.PluginSetting) -> PluginExecutionMode:
+        if getattr(getattr(self.ap, 'deployment', None), 'mode', 'oss') != 'cloud':
+            return PluginExecutionMode.DEDICATED
         return execution_mode_for_persisted_installation(
             artifact_digest=setting.artifact_digest,
             install_info=setting.install_info,
```

**File**: `tests/integration/plugin/test_certified_plugin_admission.py` (modified, +1/-1)
```diff
@@ -30,7 +30,7 @@
     [
         ('cloud', 'signed_shared', False, 'shared-runtime-v1'),
         ('cloud', 'legacy', False, 'dedicated'),
-        ('oss', 'signed_shared', False, 'shared-runtime-v1'),
+        ('oss', 'signed_shared', False, 'dedicated'),
         ('oss', 'legacy', False, 'dedicated'),
         ('oss', 'forged_shared', True, 'dedicated'),
     ],
```

#### Recent Merged Pull Requests:
- **PR #2619** (2026-09-30): docs: move telemetry configuration out of READMEs (@RockChinQ)
- **PR #2618** (2026-09-30): fix: document telemetry opt-out and silence delivery failures (@RockChinQ)
- **PR #2617** (2026-09-30): feat: bounded execution telemetry for all processing modes (@RockChinQ)
- **PR #2616** (2026-09-30): refactor: remove Beta diagnostics (@RockChinQ)
- **PR #2615** (2026-09-30): feat(market): certified plugin checks and explanatory tooltips (@RockChinQ)
- **PR #2613** (2026-09-29): fix(i18n): complete beta banner translations (@RockChinQ)
- **PR #2610** (2026-09-28): fix(certification): align certified sharing, unsigned dedicated, and docs (@RockChinQ)
- **PR #2609** (2026-09-28): fix(plugin): allow unsigned Cloud plugins as dedicated (@RockChinQ)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
