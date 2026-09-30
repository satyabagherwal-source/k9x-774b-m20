# Forensic Learning Record (Deep Inspection): NVIDIA-AI-Blueprints/video-search-and-summarization

> **Canonical Artifact**: `07_PROJECT_LEARNING/nvidia-ai-blueprints-video-search-and-summarization-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/NVIDIA-AI-Blueprints/video-search-and-summarization](https://github.com/NVIDIA-AI-Blueprints/video-search-and-summarization))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-09-30T21:13:27.374Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `NVIDIA-AI-Blueprints/video-search-and-summarization`
- **Description**: NVIDIA AI Blueprint for video search and summarization (VSS) is a GPU-accelerated reference architecture for building video analytics agents with real-time verified alerts, visual Q&A, and automated reporting. The VSS Blueprint uses vision language models (VLMs) such as NVIDIA Cosmos, LLMs such as NVIDIA Nemotron, RAG, and NVIDIA NIMs.
- **Primary Language / Ecosystem**: Python
- **Discovered Manifests / Configurations**: README.md
- **Stars / Engagement**: 1883 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `.openclaw/apply-onboard-config.py`
```
#!/usr/bin/env python3
# SPDX-FileCopyrightText: Copyright (c) 2025-2026, NVIDIA CORPORATION & AFFILIATES. All rights reserved.
# SPDX-License-Identifier: Apache-2.0
"""Apply onboard's build args to the openclaw.json this image inherits.

NemoClaw generates /sandbox/.openclaw/openclaw.json inside its managed base
image, from build ARGs its own Dockerfile declares. `onboard --from <Dockerfile>`
rewrites those ARGs in the custom Dockerfile with the session's values
(src/lib/onboard/dockerfile-patch.ts) and expects the generator to run again at
build. A custom image cannot re-run the generator (the post-generator
attestation allowlist forbids it), so it inherits the base image's config -- and
every ARG the custom Dockerfile does not declare is dropped by a regex
`String.replace` that matches nothing and reports nothing.

The user-visible bug that comes from that silence is the model: the sandbox keeps
the base image's model, context window and max tokens, so the agent caps output
and compacts against the wrong model's limits. This script closes it -- the
Dockerfile declares the ARGs, and this applies them to the inherited config at
build, before the config hash is recomputed.

controlUi.allowedOrigins is always a wildcard: the gateway binds loopback, the
gates are the token and (for a loopback UI host) device auth rather than the
origin, and an origin derived from CHAT_UI_URL could miss
the one the browser sends (onboard rewrites its port). CHAT_UI_URL only sets the
auth flags: allowInsecureAuth is scheme == http; device auth is disabled for a
non-loopback UI host. `config set` refuses gateway.*, so this is the only place
to set them.
"""

from __future__ import annotations

import json
import os
import re
import sys
from urllib.parse import urlparse

CONFIG = "/sandbox/.openclaw/openclaw.json"
_LOOPBACK = {"localhost", "127.0.0.1", "::1", "[::1]"}


def _is_loopback(host: str) -> bool:
    host = (host or "").lower().strip("[]")
    return host in {h.strip("[]") for h in _LOOPBACK} or host.startswith("127.")


def _qualify(model: str) -> str:
    return model if model.startswith("inference/") else f"inference/{model}"


def control_ui_auth(chat_ui_url: str) -> dict | None:
    """The controlUi auth flags for the UI host CHAT_UI_URL names, or None."""
    if not chat_ui_url:
        return None
    parsed = urlparse(chat_ui_url)
    if not parsed.scheme or not parsed.hostname:
        return None
    return {
        "allowInsecureAuth": parsed.scheme == "http",
        "dangerouslyDisableDeviceAuth": not _is_loopback(parsed.hostname),
    }


def apply(config: str | None = None, env: dict | None = None) -> list[str]:
    """Patch the config in place. Returns one line per change, for the build log."""
    config = CONFIG if config is None else config
    env = os.environ if env is None else env
    with open(config) as handle:
        cfg = json.load(handle)
    changes: list[str] = []

    # --- model identity: onboard supplies the session's model -----------------
    model = (env.get("NEMOCLAW_PRIMARY_MODEL_REF") or env.get("NEMOCLAW_MODEL") or "").strip()
    if model and len(model) <= 256 and not re.search(r"[\x00-\x1f\x7f]", model):
        qualified = _qualify(model)
        slot = cfg.setdefault("agents", {}).setdefault("defaults", {}).setdefault("model", {})
        if slot.get("primary") != qualified:
            changes.append(f"model.primary {slot.get('primary')} -> {qualified}")
            slot["primary"] = qualified
        inference = cfg.setdefault("models", {}).setdefault("providers", {}).setdefault("inference", {})
        models = inference.get("models")
        if not isinstance(models, list) or not models or not isinstance(models[0], dict):
            models = [{}]
            inference["models"] = models
        bare = qualified[len("inference/"):]
        model_changed = models[0].get("id") != bare or models[0].get("name") != qualified
        if model_changed:
            models[0]["id"] = bare
            models[0]["name"] = qualified
            changes.append(f"models[0] -> {qualified}")
        # Limits: onboard passes the session values. A value the base image baked
        # for *another* model is worse than none, so drop it when unset here - but
        # only when the model actually changed: the baked limits are right for the
        # baked model, and onboard does not forward them for it.
        for env_key, cfg_key in (("NEMOCLAW_CONTEXT_WINDOW", "contextWindow"),
                                 ("NEMOCLAW_MAX_TOKENS", "maxTokens")):
            raw = (env.get(env_key) or "").strip()
            if raw and re.fullmatch(r"[1-9][0-9]*", raw):
                if models[0].get(cfg_key) != int(raw):
                    models[0][cfg_key] = int(raw)
                    changes.append(f"{cfg_key} -> {raw}")
            elif model_changed and cfg_key in models[0]:
                del models[0][cfg_key]
                changes.append(f"{cfg_key} dropped (baked for another model, none supplied)")

    # --- control UI: any origin; onboard's CHAT_UI_URL sets the auth flags ---
    current = cfg.setdefault("gateway", {}).setdefault("controlUi", {})
    if current.get("allowedOrigins") != ["*"]:
        changes.append(f"allowedOrigins {current.get('allowedOrigins')} -> ['*']")
        current["allowedOrigins"] = ["*"]
    for key, value in (control_ui_auth((env.get("CHAT_UI_URL") or "").strip()) or {}).items():
        if current.get(key) != value:
            changes.append(f"{key} {current.get(key)} -> {value}")
            current[key] = value

    if changes:
        with open(config, "w") as handle:
            json.dump(cfg, handle, indent=2)
            handle.write("\n")
    return changes


def main(argv: list[str] | None = None) -> int:
    argv = sys.argv[1:] if argv is None else argv
    strict = "--require-change" in argv
    changes = apply()
    for line in changes:
        print(f"[vss-onboard-config] {line}", file=sys.stderr)
    if not changes:
        print("[vss-onboard-config] no onboard build args supplied; config left as the base image generated it", file=sys.stderr)
        if strict:
            return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())

```

### Core Architecture Module: `.openclaw/plugin/src/index.ts`
```
// SPDX-FileCopyrightText: Copyright (c) 2025-2026, NVIDIA CORPORATION & AFFILIATES. All rights reserved.
// SPDX-License-Identifier: Apache-2.0
//
// VSS OpenClaw plugin. Two things, both declared in openclaw.plugin.json:
//   - the `vss_cli` tool below, which runs the pinned `vss` CLI baked into the
//     sandbox image so the agent drives the VSS backends through a typed tool
//     call rather than a free-form shell;
//   - the VSS skills (`skills/`, copied from the repo's skills/ tree at build),
//     which OpenClaw loads from the plugin root. The skills teach the agent
//     which vss subcommands to reach for; the tool is how it invokes them.
// Two things happen at register time. Skills are selected: each shipped skill
// declares the vss command group (or the alerts path) it needs in its SKILL.md
// frontmatter (`metadata.vss-requires`), and
// sync_skills.py (the shared, harness-neutral selector staged from the pinned
// VSS checkout at image build) asks `vss configure check` which groups the
// recorded deployment can serve, then copies exactly those skills into
// skills-active/, the directory the manifest points OpenClaw at. Unconfigured
// deployment: all shipped skills.
// And the OpenClaw workspace instructions
// (`workspace/` — AGENTS.md, SOUL.md, IDENTITY.md, TOOLS.md, BOOTSTRAP.md, copied
// from .openclaw/workspace at build) are seeded into the agent's
// configured workspace when they are not there yet, with the `_<variant>`
// overlay applied on top (VSS_WORKSPACE_VARIANT, or `nemoclaw` when running in
// a NemoClaw sandbox). Existing files are never overwritten: the workspace is
// the agent's memory.

import { execFile, spawnSync } from "node:child_process";
import { copyFileSync, cpSync, existsSync, mkdirSync, readdirSync, renameSync, rmSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, isAbsolute, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { defineToolPlugin } from "openclaw/plugin-sdk/tool-plugin";
import { Type } from "typebox";

// Output is capped so a chatty subcommand cannot blow the model's context.
const MAX_CAPTURE = 200_000;

const VssCliParameters = Type.Object(
  {
    args: Type.Array(Type.String(), {
      description:
        'Arguments after `vss`, one per element, for example ["summarize", "--help"] or ["ask", "--file", "clip.mp4", "what happens?"].',
    }),
    cwd: Type.Optional(
      Type.String({ description: "Working directory for the call. Defaults to the process cwd." }),
    ),
    timeoutSec: Type.Optional(
      Type.Integer({ minimum: 1, description: "Seconds before the call is killed." }),
    ),
  },
  { additionalProperties: false },
);

const VssConfig = Type.Object(
  {
    vssBin: Type.Optional(Type.String({ description: "Path to the vss CLI binary." })),
    defaultTimeoutSec: Type.Optional(
      Type.Integer({ minimum: 1, description: "Default timeout for a vss call." }),
    ),
  },
  { additionalProperties: false },
);

function clip(text: string): { text: string; truncated: boolean } {
  if (text.length <= MAX_CAPTURE) {
    return { text, truncated: false };
  }
  return { text: `${text.slice(0, MAX_CAPTURE)}\n…[truncated]`, truncated: true };
}

const vssPlugin = defineToolPlugin({
  id: "vss",
  name: "NVIDIA VSS",
  description:
    "Drive a live Video Search and Summarization deployment: the vss CLI as an agent tool, plus the VSS skills.",
  configSchema: VssConfig,
  tools: (tool) => [
    tool({
      name: "vss_cli",
      label: "vss CLI",
      description:
        "Run the NVIDIA VSS command-line client (`vss`) against the configured VSS deployment. " +
        "Pass the subcommand and flags as an argument array; the VSS skills describe which subcommands to use. " +
        "Returns exit code, stdout and stderr.",
      parameters: VssCliParameters,
      async execute({ args, cwd, timeoutSec }, config, context) {
        context.signal?.throwIfAborted();
        const bin = config.vssBin ?? "/usr/local/bin/vss";
        const timeoutMs = 1000 * (timeoutSec ?? config.defaultTimeoutSec ?? 600);
        const command = [bin, ...args].join(" ");

        return await new Promise((resolve) => {
          const child = execFile(
            bin,
            args,
            { cwd, timeout: timeoutMs, maxBuffer: 64 * 1024 * 1024, signal: context.signal },
            (error, stdout, stderr) => {
              const out = clip(String(stdout ?? ""));
              const err = clip(String(stderr ?? ""));
              const e = error as (NodeJS.ErrnoException & { killed?: boolean; signal?: string; code?: number | string }) | null;
              const spawnFailure = e && typeof e.code === "string" ? `${e.code}: ${e.message}` : "";
              resolve({
                command,
                exitCode: e ? (typeof e.code === "number" ? e.code : null) : (child.exitCode ?? 0),
                signal: e?.signal ?? null,
                timedOut: Boolean(e?.killed && e?.signal === "SIGTERM"),
                stdout: out.text,
                stderr: spawnFailure ? `${err.text}${err.text ? "\n" : ""}${spawnFailure}` : err.text,
                truncated: out.truncated || err.truncated,
              });
            },
          );
        });
      },
    }),
  ],
});


type WorkspaceApi = {
  config?: { agents?: { defaults?: { workspace?: string } } };
  logger: { info: (msg: string) => void; warn: (msg: string) => void };
};

function resolveWorkspaceVariant(): string | undefined {
  const fromEnv = process.env.VSS_WORKSPACE_VARIANT?.trim();
  if (fromEnv) {
    return fromEnv;
  }
  // NemoClaw's managed runtime always ships this entrypoint.
  return existsSync("/usr/local/bin/nemoclaw-start") ? "nemoclaw" : undefined;
}

function expandWorkspacePath(raw: string): string {
  const expanded = raw === "~" || raw.startsWith("~/") ? join(homedir(), raw.slice(1)) : raw;
  return isAbsolute(expanded) ? expanded : resolve(process.cwd(), expanded);
}

function copyMissingMarkdown(fromDir: string, toDir: string): number {
  if (!existsSync(fromDir)) {
    return 0;
  }
  let copied = 0;
  for (const file of readdirSync(fromDir).filter((f) => f.endsWith(".md"))) {
    const target = join(toDir, file);
    if (existsSync(target)) {
      continue;
    }
    copyFileSync(join(fromDir, file), target);
    copied += 1;
  }
  return copied;
}

/** Seed the agent workspace with the VSS instruction files, never overwriting. */
export function seedWorkspace(api: WorkspaceApi): void {
  const configured = api.config?.agents?.defaults?.workspace;
  if (!configured) {
    return;
  }
  const workspaceDir = expandWorkspacePath(configured);
  const templatesDir = join(dirname(fileURLToPath(import.meta.url)), "..", "workspace");
  if (!existsSync(templatesDir)) {
    api.logger.warn(`[vss] workspace templates missing at ${templatesDir}; nothing seeded`);
    return;
  }
  const variant = resolveWorkspaceVariant();
  try {
    mkdirSync(workspaceDir, { recursive: true });
    // Overlay first so a variant file wins over the base of the same name.
    let copied = 0;
    if (variant) {
      const overlay = join(templatesDir, `_${variant}`);
      if (existsSync(overlay)) {
        copied += copyMissingMarkdown(overlay, workspaceDir);
      } else {
        api.logger.warn(`[vss] workspace variant '${variant}' has no ${overlay}; base files only`);
      }
    }
    copied += copyMissingMarkdown(templatesDir, workspaceDir);
    if (copied > 0) {
      api.logger.info(
        `[vss] seeded ${copied} workspace file(s) into ${workspaceDir}${variant ? ` (variant ${variant})` : ""}`,
      );
    }
  } catch (err) {
    api.logger.warn(`[vss] workspace seeding failed: ${err instanceof Error ? err.message : String(err)}`);
  }
}

// Keep the entry defineToolPlugin produced (its non-enumerable metadata included)
// and wrap only `register`, so tool registration is untouched.
const registerTools = vssPlugin.register;
vssPlugin.register = (api) =>
```

### Core Architecture Module: `deploy/docker/scripts/nemoclaw/dashboard-relay.py`
```
#!/usr/bin/env python3
# SPDX-FileCopyrightText: Copyright (c) 2025-2026, NVIDIA CORPORATION & AFFILIATES. All rights reserved.
# SPDX-License-Identifier: Apache-2.0
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
# http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.

"""TCP relay: non-loopback LISTEN addresses -> the sandbox dashboard forward on loopback.

NemoClaw keeps the sandbox dashboard forward on 127.0.0.1:<dashboard-port>: its
forward recovery (`nemoclaw <sandbox> connect|recover|start`) retires a 0.0.0.0
forward as stale and re-creates the loopback one, and it inspects that port with
`lsof -i4TCP:<port>`, so a second listener on the port - on any address - makes
recovery refuse to touch the forward at all. Off-loopback clients therefore get
their own port: this relay listens on it and pipes bytes to the forward. It is
protocol-agnostic, so the OpenClaw control UI's WebSocket passes through.

Clients that need it:
  - the `vss-agent-ui` container, whose `host.docker.internal` alias is the Docker
    daemon's default-bridge gateway - a host address, never loopback;
  - the Brev secure-link edge, which reaches the instance port from off-loopback.

Started by deploy_nemoclaw.ipynb section 3.5, which chooses the bind addresses at
run time (they differ per host and per Docker daemon) and attributes a running
relay to its sandbox through `--sandbox` on the command line.
"""

from __future__ import annotations

import argparse
import asyncio
import sys

_TAG = "[dashboard-relay]"


def _log(message: str) -> None:
    sys.stderr.write(f"{_TAG} {message}\n")
    sys.stderr.flush()


def parse_args(argv: list[str] | None = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--sandbox", required=True, help="sandbox name; attribution only, kept on the command line")
    parser.add_argument("--listen", default="0.0.0.0", help="comma-separated bind addresses (default 0.0.0.0)")
    parser.add_argument("--port", type=int, default=18790, help="listen port on every bind address (0 = ephemeral)")
    parser.add_argument("--upstream", default="127.0.0.1:18789", help="host:port of the dashboard forward")
    args = parser.parse_args(argv)
    args.hosts = [h.strip() for h in args.listen.split(",") if h.strip()]
    if not args.hosts:
        parser.error("--listen needs at least one address")
    host, _, port = args.upstream.rpartition(":")
    if not host or not port.isdigit():
        parser.error("--upstream must be host:port")
    args.upstream_host, args.upstream_port = host.strip("[]"), int(port)
    return args


async def _pump(reader: asyncio.StreamReader, writer: asyncio.StreamWriter) -> None:
    """Copy one direction, then pass EOF on as a half-close so the other direction
    keeps flowing (a client may shut its write side and still expect the reply)."""
    try:
        while chunk := await reader.read(65536):
            writer.write(chunk)
            await writer.drain()
        if writer.can_write_eof():
            writer.write_eof()
    except (ConnectionError, asyncio.IncompleteReadError):
        if not writer.is_closing():
            writer.close()


async def _close(writer: asyncio.StreamWriter) -> None:
    if not writer.is_closing():
        writer.close()
    try:
        await writer.wait_closed()
    except (ConnectionError, OSError):
        pass


async def relay(client_reader: asyncio.StreamReader, client_writer: asyncio.StreamWriter, upstream: tuple[str, int]) -> None:
    peer = client_writer.get_extra_info("peername")
    try:
        upstream_reader, upstream_writer = await asyncio.open_connection(*upstream)
    except OSError as exc:
        # The forward is down (kernel gone, sandbox rebuilt): refuse the client cleanly
        # instead of holding it open; section 3.5 re-establishes the forward.
        _log(f"{peer} -> {upstream[0]}:{upstream[1]} unavailable: {exc}")
        await _close(client_writer)
        return
    try:
        await asyncio.gather(
            _pump(client_reader, upstream_writer),
            _pump(upstream_reader, client_writer),
        )
    finally:
        await asyncio.gather(_close(upstream_writer), _close(client_writer))


async def serve(hosts: list[str], port: int, upstream: tuple[str, int]) -> None:
    server = await asyncio.start_server(
        lambda r, w: relay(r, w, upstream), host=hosts, port=port, reuse_address=True
    )
    bound = ", ".join(f"{s.getsockname()[0]}:{s.getsockname()[1]}" for s in server.sockets)
    # stdout, one line, so a supervisor can wait for it: the address:port pairs actually bound.
    print(f"{_TAG} listening on {bound} -> {upstream[0]}:{upstream[1]}", flush=True)
    async with server:
        await server.serve_forever()


def main(argv: list[str] | None = None) -> int:
    args = parse_args(argv)
    try:
        asyncio.run(serve(args.hosts, args.port, (args.upstream_host, args.upstream_port)))
    except KeyboardInterrupt:
        pass
    except OSError as exc:
        _log(f"cannot listen on {args.listen}:{args.port}: {exc}")
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())

```

### Core Architecture Module: `deploy/docker/scripts/nemoclaw/inference-api-proxy.py`
```
#!/usr/bin/env python3
# SPDX-FileCopyrightText: Copyright (c) 2025-2026, NVIDIA CORPORATION & AFFILIATES. All rights reserved.
# SPDX-License-Identifier: Apache-2.0
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
# http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.

"""Reverse proxy: LISTEN -> https://inference-api.nvidia.com (for NemoClaw SSRF bypass).

On hosts where inference-api.nvidia.com resolves to a private IP (e.g. corp/DGX
internal DNS), NemoClaw onboard rejects the endpoint during SSRF preflight.
Point NEMOCLAW_ENDPOINT_URL at this proxy instead, e.g.:

  http://host.openshell.internal:18080/v1

Bind on all interfaces (0.0.0.0) so the OpenShell gateway container can reach
the host via host.openshell.internal (typically 172.18.0.1). Loopback-only
(127.0.0.1) works for host-side onboard probes but breaks inference.local
inside the sandbox (503).

Environment variables:
  INFERENCE_API_UPSTREAM      upstream host (default: inference-api.nvidia.com)
  INFERENCE_API_PROXY_HOST    bind address (default: 0.0.0.0)
  INFERENCE_API_PROXY_PORT    listen port (default: 18080)
"""

from __future__ import annotations

import http.client
import os
import ssl
import sys
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

UPSTREAM_HOST = os.environ.get("INFERENCE_API_UPSTREAM", "inference-api.nvidia.com")
LISTEN_HOST = os.environ.get("INFERENCE_API_PROXY_HOST", "0.0.0.0")
LISTEN_PORT = int(os.environ.get("INFERENCE_API_PROXY_PORT", "18080"))
SKIP_HEADERS = {"host", "connection", "transfer-encoding", "proxy-connection"}


class ProxyHandler(BaseHTTPRequestHandler):
    protocol_version = "HTTP/1.1"

    def log_message(self, fmt: str, *args) -> None:
        sys.stderr.write(f"[inference-api-proxy] {self.address_string()} - {fmt % args}\n")

    def _proxy(self) -> None:
        length = int(self.headers.get("Content-Length", "0") or "0")
        body = self.rfile.read(length) if length else None
        conn = http.client.HTTPSConnection(UPSTREAM_HOST, timeout=120, context=ssl.create_default_context())
        try:
            headers = {k: v for k, v in self.headers.items() if k.lower() not in SKIP_HEADERS}
            headers["Host"] = UPSTREAM_HOST
            conn.request(self.command, self.path, body=body, headers=headers)
            upstream = conn.getresponse()
            self.send_response(upstream.status, upstream.reason)
            has_length = upstream.getheader("Content-Length") is not None
            for key, value in upstream.getheaders():
                if key.lower() not in SKIP_HEADERS:
                    self.send_header(key, value)
            # Streaming (SSE) replies come back chunked with no Content-Length.
            # We strip Transfer-Encoding above and don't re-chunk, so on a keep-alive
            # HTTP/1.1 socket the client would never see end-of-message and hang.
            # Signal end-of-body via connection close instead.
            if not has_length:
                self.send_header("Connection", "close")
                self.close_connection = True
            self.end_headers()
            while True:
                chunk = upstream.read(65536)
                if not chunk:
                    break
                self.wfile.write(chunk)
                self.wfile.flush()  # push SSE tokens to the client promptly
        finally:
            conn.close()

    def do_GET(self) -> None:
        self._proxy()

    def do_POST(self) -> None:
        self._proxy()

    def do_PUT(self) -> None:
        self._proxy()

    def do_PATCH(self) -> None:
        self._proxy()

    def do_DELETE(self) -> None:
        self._proxy()

    def do_OPTIONS(self) -> None:
        self._proxy()


def main() -> None:
    server = ThreadingHTTPServer((LISTEN_HOST, LISTEN_PORT), ProxyHandler)
    print(f"Listening http://{LISTEN_HOST}:{LISTEN_PORT} -> https://{UPSTREAM_HOST}", flush=True)
    server.serve_forever()


if __name__ == "__main__":
    main()

```

### Core Architecture Module: `deploy/docker/scripts/orchestrator_mcp_helper.py`
```
# SPDX-FileCopyrightText: Copyright (c) 2025-2026, NVIDIA CORPORATION & AFFILIATES. All rights reserved.
# SPDX-License-Identifier: Apache-2.0

import ipaddress
import json
import os
import re
import shlex
import shutil
import subprocess
import time
from enum import StrEnum
from pathlib import Path
from typing import Any


# Docker inspection is advisory here — the caller falls back to the checked-in
# policy — so an unresponsive daemon has to fail rather than block the cell.
DOCKER_QUERY_TIMEOUT_S = 20


class OrchestratorTool(StrEnum):
    PROFILES = "vss_orchestrator__profiles"
    PREREQS = "vss_orchestrator__prereqs"
    DOCKER_GENERATE = "vss_orchestrator__docker_generate"
    DOCKER_READ = "vss_orchestrator__docker_read"
    DOCKER_LIST = "vss_orchestrator__docker_list"
    DOCKER_LOGS = "vss_orchestrator__docker_logs"
    DOCKER_UP = "vss_orchestrator__docker_up"
    DOCKER_DOWN = "vss_orchestrator__docker_down"
    DOCKER_STATUS = "vss_orchestrator__docker_status"


def _strip_ansi(text: str) -> str:
    return re.sub(r"\x1b\[[0-9;]*m", "", text)


def supported_hardware_profiles(config_path: str | Path) -> tuple[str, ...]:
    """Return the HARDWARE_PROFILE values *config_path* declares, in file order.

    These are the ``model_resolution.hardware.hardware_profiles`` keys, which are
    the orchestrator's supported set verbatim — ``docker_generate`` rejects a
    HARDWARE_PROFILE that is not one of them, and it compares exactly, so a
    notebook is better off reading them than restating the list.

    Read by indentation rather than with PyYAML: the notebook kernel CI builds
    carries ``nbclient`` and ``ipykernel`` only, so ``import yaml`` is not
    available where this runs. Only the keys one level under the block are
    returned; the env overrides and per-profile blocks nested below them are not.

    Raises:
        FileNotFoundError: if *config_path* does not exist.
        ValueError: if the block is absent or declares no keys.
    """
    block_indent: int | None = None
    profiles: list[str] = []
    for line in Path(config_path).read_text().splitlines():
        stripped = line.strip()
        if not stripped or stripped.startswith("#"):
            continue
        indent = len(line) - len(line.lstrip())
        if block_indent is None:
            if stripped == "hardware_profiles:":
                block_indent = indent
            continue
        if indent <= block_indent:
            break
        if indent == block_indent + 2 and stripped.endswith(":") and " " not in stripped:
            profiles.append(stripped[:-1])
    if not profiles:
        raise ValueError(f"{config_path} declares no model_resolution.hardware.hardware_profiles keys.")
    return tuple(profiles)


def gpu_device_ids() -> tuple[list[str], list[str]]:
    """Return the GPU indices and every device id ``nvidia-smi -L`` reports here.

    The second list is what a device-id setting is allowed to name: the indices
    plus every GPU and MIG UUID, because the VSS ``*_DEVICE_ID`` variables and
    ``nemoclaw onboard --vllm-gpu-device`` each accept either form.

    Raises:
        RuntimeError: if ``nvidia-smi`` is missing, fails, or lists no GPU — the
            device ids cannot be checked at all in those cases, and silently
            skipping the check would defer the failure to a container start.
    """
    if shutil.which("nvidia-smi") is None:
        raise RuntimeError("nvidia-smi is not installed, so the GPU device ids cannot be checked.")
    result = subprocess.run(["nvidia-smi", "-L"], capture_output=True, text=True, check=False)
    if result.returncode != 0:
        raise RuntimeError(
            f"`nvidia-smi -L` failed with exit code {result.returncode}, so the GPU device ids "
            f"cannot be checked:\n{(result.stderr or result.stdout).strip() or '(no output)'}"
        )
    indices = re.findall(r"^GPU (\d+):", result.stdout, re.MULTILINE)
    if not indices:
        raise RuntimeError(f"`nvidia-smi -L` listed no GPUs on this host:\n{result.stdout.strip() or '(no output)'}")
    return indices, indices + re.findall(r"\(UUID: ([^)]+)\)", result.stdout)


def require_gpu_device(
    label: str,
    device_id: str,
    *,
    remedy: str,
    known_device_ids: list[str] | None = None,
) -> None:
    """Raise unless *device_id* names a GPU on this host. A blank value is accepted.

    Args:
        label: Setting name to quote in the error (e.g. ``LLM_DEVICE_ID``).
        device_id: Index or GPU/MIG UUID to check. Blank means the caller left the
            default to whatever consumes the setting, so there is nothing to check.
        remedy: Sentence appended to the error telling the reader where to fix it.
        known_device_ids: Second element of a previous :func:`gpu_device_ids` call,
            to check several settings without re-running ``nvidia-smi`` per setting.

    Raises:
        RuntimeError: if *device_id* matches no GPU, or if the host inventory
            cannot be read (see :func:`gpu_device_ids`).
    """
    if not device_id:
        return
    device_ids = gpu_device_ids()[1] if known_device_ids is None else known_device_ids
    if device_id not in device_ids:
        raise RuntimeError(f"{label}={device_id} matches no GPU on this host: {', '.join(device_ids)}. {remedy}")


def resolve_openshell_gateway_container(sandbox_name: str) -> str | None:
    """Return the running OpenShell sandbox container name for *sandbox_name*.

    Uses OpenShell owner labels instead of the container name prefix/format
    (``openshell-<name>-<id>``), which is an implementation detail.
    """
    result = subprocess.run(
        [
            "docker",
            "ps",
            "--no-trunc",
            "--filter",
            "label=openshell.ai/managed-by=openshell",
            "--filter",
            f"label=openshell.ai/sandbox-name={sandbox_name}",
            "--format",
            "{{.Names}}",
        ],
        capture_output=True,
        text=True,
        check=True,
        timeout=DOCKER_QUERY_TIMEOUT_S,
    )
    names = [line.strip() for line in result.stdout.splitlines() if line.strip()]
    return names[0] if names else None


def sandbox_host_cidrs(sandbox_name: str) -> list[str]:
    """Return the IPv4 subnets of the Docker networks *sandbox_name* is attached to.

    ``host.openshell.internal`` resolves to the gateway of each of those
    networks, so they are the ranges an egress ``allowed_ips`` entry has to
    cover. Returns an empty list when the sandbox does not exist yet, or when
    Docker cannot be inspected within ``DOCKER_QUERY_TIMEOUT_S``, so a caller
    can fall back to whatever the policy declares.
    """
    try:
        container = resolve_openshell_gateway_container(sandbox_name)
        if container is None:
            return []
        attached = json.loads(
            subprocess.run(
                ["docker", "inspect", "--format", "{{json .NetworkSettings.Networks}}", container],
                capture_output=True,
                text=True,
                check=True,
                timeout=DOCKER_QUERY_TIMEOUT_S,
            ).stdout
            or "{}"
        )
        if not attached:
            return []
        inspected = json.loads(
            subprocess.run(
                ["docker", "network", "inspect", *sorted(attached)],
                capture_output=True,
                text=True,
                check=True,
                timeout=DOCKER_QUERY_TIMEOUT_S,
            ).stdout
            or "[]"
        )
    except (subprocess.SubprocessError, json.JSONDecodeError, OSError):
        return []

    subnets = set()
    for network in inspected:
        for config in (network.get("IPAM") or {}).get("Config") or []:
            # Parsed rather than string-matched: the result is written into a
            # policy file, and IPv6 ranges are not what allowed_ips carries.
            try:
                subnet = ipaddress.ip_network(config.get("Subnet
```

### Core Architecture Module: `deploy/docker/scripts/run_setup_notebook.py`
```
#!/usr/bin/env python3
# SPDX-FileCopyrightText: Copyright (c) 2025-2026, NVIDIA CORPORATION & AFFILIATES. All rights reserved.
# SPDX-License-Identifier: Apache-2.0
"""Execute a checked-in VSS setup notebook end to end.

Run the notebook; do not reimplement its cells. Pass overrides through the
environment. Re-inject `NOTEBOOK_PARAMETERS` at the derived-settings marker.
Keep the executed notebook in memory — never write it back.
"""

from __future__ import annotations

import argparse
import os
import re
import sys
from collections.abc import Iterable, Sequence
from pathlib import Path
from typing import Any

# Section 1.3 of every setup notebook opens its derived block with this line.
# It is the first point where all of the settings literals are in scope, which
# is what makes it the correct place to re-read the environment.
DERIVED_SETTINGS_MARKER = (
    "# ================== Derived (no need to touch) =================="
)

# Per-notebook parameter contract: the variables that notebook's settings cells
# assign as literals. Keep an entry here when a new caller needs to override a
# literal; a variable the notebook already reads from `SHELL_ENV` does not
# belong in this table.
NOTEBOOK_PARAMETERS: dict[str, tuple[str, ...]] = {
    "deploy_nemoclaw.ipynb": (
        "NEMOCLAW_PROVIDER",
        "NEMOCLAW_ENDPOINT_URL",
        "NEMOCLAW_MODEL",
        "COMPATIBLE_API_KEY",
    ),
    "deploy_nemo_relay.ipynb": (),
    "deploy_vss_orchestrator.ipynb": (
        "NGC_CLI_API_KEY",
        "NVIDIA_API_KEY",
        "HARDWARE_PROFILE",
        "EXTERNAL_IP",
        "LLM_DEVICE_ID",
        "VLM_DEVICE_ID",
        "LLM_NAME",
        "LLM_ENDPOINT_URL",
        "LLM_MODEL_TYPE",
        "LLM_ENABLE_THINKING",
        "OPENAI_API_KEY",
        "VLM_NAME",
        "VLM_ENDPOINT_URL",
        "VLM_MODEL_TYPE",
    ),
}

_MINIMUM_TIMEOUT_SEC = 60

# The OpenClaw control UI authenticates from this fragment, so an echoed
# Agent UI line would otherwise leave a live gateway token in the caller's log.
_TOKEN_FRAGMENT = re.compile(r"(#token=)[^\s\"'<>]+")


def repo_root() -> Path:
    """Repository root, resolved from this file's location in the checkout."""

    return Path(__file__).resolve().parents[3]


def parameters_for(path: Path) -> tuple[str, ...]:
    """Parameter contract for *path*, or raise when the notebook has none."""

    parameters = NOTEBOOK_PARAMETERS.get(path.name)
    if parameters is None:
        known = ", ".join(sorted(NOTEBOOK_PARAMETERS))
        raise ValueError(
            f"No parameter contract for notebook {path.name}; known: {known}"
        )
    return parameters


def parameterize_notebook(
    notebook: Any, parameters: Iterable[str], *, label: str = "notebook"
) -> None:
    """Re-read *parameters* from the environment at the derived-settings marker.

    Mutates the in-memory notebook only; the checked-in source is never edited.
    """

    names = tuple(parameters)
    if not names:
        return
    assignments = [
        "# Injected by run_setup_notebook; never persisted.",
        "import os as _vss_setup_os",
        *(
            f"{name} = _vss_setup_os.environ.get({name!r}, {name})"
            for name in names
        ),
    ]
    parameter_source = "\n".join(assignments)

    for cell in notebook.get("cells", []):
        source_value = cell.get("source", "")
        source = (
            source_value if isinstance(source_value, str) else "".join(source_value)
        )
        if DERIVED_SETTINGS_MARKER not in source:
            continue
        cell["source"] = source.replace(
            DERIVED_SETTINGS_MARKER,
            f"{parameter_source}\n\n{DERIVED_SETTINGS_MARKER}",
            1,
        )
        return
    raise RuntimeError(f"Could not locate the derived-settings marker in {label}")


def execute_notebook(
    path: Path,
    *,
    cwd: Path,
    timeout: int,
    parameters: Iterable[str] | None = None,
    kernel_name: str | None = None,
    echo_output: bool = False,
) -> Any:
    """Run *path* end to end and return the executed in-memory notebook."""

    try:
        import nbformat
        from nbclient import NotebookClient
    except ImportError as exc:
        raise RuntimeError(
            "Notebook execution requires nbformat, nbclient, and ipykernel"
        ) from exc

    notebook = nbformat.read(path, as_version=4)
    parameterize_notebook(
        notebook,
        parameters_for(path) if parameters is None else parameters,
        label=path.name,
    )
    client = NotebookClient(
        notebook,
        timeout=timeout,
        kernel_name=(
            kernel_name
            or os.environ.get("VSS_SETUP_NOTEBOOK_KERNEL")
            or "python3"
        ),
        allow_errors=False,
        resources={"metadata": {"path": str(cwd)}},
    )
    try:
        executed = client.execute()
    finally:
        if echo_output:
            # `client` records outputs on `notebook` as it goes, so a failed
            # cell still leaves the completed cells' output to echo here.
            echo_notebook_output(notebook)
    print(f"Executed {path.name} from beginning to end; outputs were not persisted.")
    return executed


def echo_notebook_output(notebook: Any) -> None:
    """Print what *notebook* has produced so far, with the token redacted."""

    # Opt-in even with the fragment scrubbed: a notebook can still print a
    # credential in a shape this does not match.
    text = _TOKEN_FRAGMENT.sub(r"\1<redacted>", output_text(notebook))
    if text.strip():
        print(text, flush=True)


def output_text(notebook: Any) -> str:
    """Every stream and result payload the executed notebook produced."""

    chunks: list[str] = []
    for cell in notebook.get("cells", []):
        for output in cell.get("outputs", []):
            if output.get("output_type") == "stream":
                chunks.append(str(output.get("text", "")))
            elif output.get("output_type") in {"display_data", "execute_result"}:
                chunks.append(str(output.get("data", {}).get("text/plain", "")))
    return "\n".join(chunks)


def require_output(notebook: Any, marker: str, *, notebook_name: str) -> None:
    """Fail when *marker* is absent from the executed notebook's output.

    A notebook runs with `allow_errors=False`, so a failed cell already aborts
    the run. This covers the other case: a notebook that completed but skipped
    the step the caller depends on.
    """

    if marker not in output_text(notebook):
        raise RuntimeError(
            f"{notebook_name} completed without readiness marker: {marker}"
        )


def run_notebooks(
    paths: Sequence[Path],
    *,
    cwd: Path,
    timeout: int,
    required_output: Sequence[str] = (),
    echo_output: bool = False,
) -> None:
    """Execute *paths* in order, then assert every required marker was printed."""

    missing = [str(path) for path in paths if not path.is_file()]
    if missing:
        raise FileNotFoundError("Missing setup notebooks: " + ", ".join(missing))

    combined: list[str] = []
    for path in paths:
        executed = execute_notebook(
            path, cwd=cwd, timeout=timeout, echo_output=echo_output
        )
        combined.append(output_text(executed))

    produced = "\n".join(combined)
    absent = [marker for marker in required_output if marker not in produced]
    if absent:
        raise RuntimeError(
            "Setup completed without readiness marker(s): " + ", ".join(absent)
        )


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--notebook",
        action="append",
        required=True,
        metavar="PATH",
        help="Setup notebook to execute; repeat to run several in order.",
    )
    parser.add_argument(
        "--cwd",
        default=None,
        metavar="PATH",
        help="Working directory for the kernel (default: repository root).",
    )
 
```

### Core Architecture Module: `deploy/docker/services/alert/scripts/env-substitute.py`
```
#!/usr/bin/env python3

# SPDX-FileCopyrightText: Copyright (c) 2025-2026, NVIDIA CORPORATION & AFFILIATES. All rights reserved.
# SPDX-License-Identifier: Apache-2.0
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
# http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.

"""
Environment variable substitution script for config files.
Works with distroless Python images using tmpfs mount.

Usage:
    python env-substitute.py \
        --source <path> --output <path> \
        [--source <path> --output <path> ...] \
        [--optional-source <path> --optional-output <path> ...] \
        -- <command> [args...]
"""

import os
import sys
import re
import argparse


def substitute_env_vars(content):
    """
    Replace ${VAR_NAME} with environment variable values.
    """
    def replacer(match):
        var_name = match.group(1)
        value = os.environ.get(var_name, '')
        if not value:
            print(f"Warning: Environment variable {var_name} is not set or empty", file=sys.stderr)
        return value
    
    # Match ${VAR_NAME} pattern
    pattern = r'\$\{([A-Za-z_][A-Za-z0-9_]*)\}'
    return re.sub(pattern, replacer, content)


def main():
    # Split arguments at '--' separator
    if '--' in sys.argv:
        separator_idx = sys.argv.index('--')
        entrypoint_args = sys.argv[1:separator_idx]
        command_args = sys.argv[separator_idx + 1:]
    else:
        print("Error: Missing '--' separator between entrypoint args and command", file=sys.stderr)
        print(
            "Usage: env-substitute.py --source <path> --output <path> "
            "[--source <path> --output <path> ...] "
            "[--optional-source <path> --optional-output <path> ...] "
            "-- <command> [args...]",
            file=sys.stderr,
        )
        sys.exit(1)
    
    # Parse named arguments for the entrypoint
    parser = argparse.ArgumentParser(
        description='Process config file with environment variable substitution'
    )
    parser.add_argument(
        '--source',
        action='append',
        required=True,
        help='Source config file path (repeat with --output for multiple files)'
    )
    parser.add_argument(
        '--output',
        action='append',
        required=True,
        help='Output config file path (repeat with --source for multiple files)'
    )
    parser.add_argument(
        '--optional-source',
        action='append',
        default=[],
        help='Optional source config; skipped when it is not a regular file'
    )
    parser.add_argument(
        '--optional-output',
        action='append',
        default=[],
        help='Output path paired with --optional-source'
    )
    
    try:
        args = parser.parse_args(entrypoint_args)
    except SystemExit as e:
        sys.exit(e.code)
    
    if not command_args:
        print("Error: No command provided after '--'", file=sys.stderr)
        sys.exit(1)

    if len(args.source) != len(args.output):
        print(
            "Error: Each --source must have a matching --output",
            file=sys.stderr,
        )
        sys.exit(1)
    if len(args.optional_source) != len(args.optional_output):
        print(
            "Error: Each --optional-source must have a matching "
            "--optional-output",
            file=sys.stderr,
        )
        sys.exit(1)

    config_pairs = [
        (source, output, True)
        for source, output in zip(args.source, args.output)
    ]
    config_pairs.extend(
        (source, output, False)
        for source, output in zip(args.optional_source, args.optional_output)
    )

    for source, output, required in config_pairs:
        if not required and not os.path.isfile(source):
            print(f"Optional config not found; skipping: {source}")
            continue

        print("Substituting environment variables in config...")
        print(f"  Source: {source}")
        print(f"  Output: {output}")

        try:
            with open(source, 'r') as f:
                config_content = f.read()
        except FileNotFoundError:
            print(f"Error: Source config file not found: {source}", file=sys.stderr)
            sys.exit(1)
        except Exception as e:
            print(f"Error reading source config: {e}", file=sys.stderr)
            sys.exit(1)

        processed_content = substitute_env_vars(config_content)

        try:
            os.makedirs(os.path.dirname(output), exist_ok=True)
            with open(output, 'w') as f:
                f.write(processed_content)
            print("Processed config written successfully")
        except Exception as e:
            print(f"Error writing processed config: {e}", file=sys.stderr)
            sys.exit(1)
    
    # Execute the original command
    print(f"Executing: {' '.join(command_args)}")
    os.execvp(command_args[0], command_args)


if __name__ == '__main__':
    main()


```

### Core Architecture Module: `deploy/docker/services/rtvi/reid-embed/convert_clipreid_to_onnx.py`
```
#!/usr/bin/env python3
# SPDX-FileCopyrightText: Copyright (c) 2026, NVIDIA CORPORATION & AFFILIATES. All rights reserved.
# SPDX-License-Identifier: Apache-2.0
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
# http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.
"""
Convert a CLIP-ReID Market-1501 ViT-B-16 SIE+OLP checkpoint to ONNX.

Kept as close as possible to convert_to_onnx.py. Path overrides (--repo-dir,
--checkpoint, --output) exist only so download-embedding-models.sh can run this
inside the perception container with bind mounts.
"""

import argparse
import hashlib
import os
import sys

# Market-1501 ViT-CLIP-ReID-SIE-OLP (Drive id 1K32xrosw0gPrxYCWXER81mhWObEW5-d4).
CHECKPOINT_SHA256 = "6e11721abdc91939da69916c2e109302eb400d0b95196286a18c59d459b79bef"


def parse_args():
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("--repo-dir", required=True, help="CLIP-ReID repository root")
    p.add_argument("--checkpoint", required=True, help="Path to the .pth checkpoint")
    p.add_argument("--output", required=True, help="Destination path for reid_model.onnx")
    return p.parse_args()


def _require_checkpoint_digest(path):
    digest = hashlib.sha256()
    with open(path, "rb") as fh:
        for chunk in iter(lambda: fh.read(1024 * 1024), b""):
            digest.update(chunk)
    got = digest.hexdigest()
    if got != CHECKPOINT_SHA256:
        raise RuntimeError(
            f"CLIP-ReID checkpoint sha256 mismatch: got {got}, expected {CHECKPOINT_SHA256}"
        )


def _install_weights_only_load():
    """Upstream load_param calls torch.load with no restrictions. Force the
    weights-only unpickler so a swapped checkpoint cannot run pickle payload."""
    import torch

    orig_load = torch.load

    def _load(*args, **kwargs):
        kwargs["map_location"] = kwargs.get("map_location", "cpu")
        kwargs["weights_only"] = True
        return orig_load(*args, **kwargs)

    torch.load = _load


def convert_to_onnx(repo_dir, checkpoint, output_path):
    repo = os.path.abspath(repo_dir)
    sys.path.insert(0, repo)
    os.chdir(repo)

    _require_checkpoint_digest(checkpoint)

    import torch
    from yacs.config import CfgNode
    from model.make_model_clipreid import make_model
    from config import cfg

    _install_weights_only_load()

    # Load configuration. Upstream ships this file with every key under DATASETS
    # commented out, so it parses as None and merge_from_file rejects it against
    # the CfgNode default. The defaults (market1501) are what we want anyway.
    with open("configs/person/vit_clipreid.yml") as f:
        file_cfg = CfgNode.load_cfg(f)
    if file_cfg.get("DATASETS") is None:
        file_cfg.pop("DATASETS", None)
    cfg.merge_from_other_cfg(file_cfg)

    # Enable SIE and OLP (must match training settings)
    cfg.MODEL.SIE_CAMERA = True
    cfg.MODEL.SIE_COE = 1.0
    cfg.MODEL.STRIDE_SIZE = [12, 12]

    cfg.freeze()

    # Create model
    model = make_model(cfg, num_class=751, camera_num=6, view_num=1)
    model.eval()
    model.cuda()  # Move model to GPU

    # Load checkpoint
    model.load_param(checkpoint)

    # Create dummy input for tracing
    # The input shape should match your preprocessing (256, 128)
    dummy_input = torch.randn(1, 3, 256, 128).cuda()

    os.makedirs(os.path.dirname(output_path) or ".", exist_ok=True)

    # Export the model
    torch.onnx.export(
        model,                  # model being run
        dummy_input,           # model input
        output_path,           # where to save the model
        export_params=True,    # store the trained parameter weights inside the model file
        opset_version=17,      # the ONNX version to export the model to
        do_constant_folding=True,  # whether to execute constant folding for optimization
        input_names=['input'],     # the model's input names
        output_names=['output'],   # the model's output names
        dynamic_axes={
            'input': {0: 'batch_size'},    # variable length axes
            'output': {0: 'batch_size'}
        },
        # Torch ≥2.9 defaults to the torch.export exporter; stay on the
        # TorchScript one that produced the deployed reid_model.onnx.
        dynamo=False,
    )

    print(f"Model has been converted to ONNX and saved to {output_path}")


if __name__ == "__main__":
    args = parse_args()
    convert_to_onnx(args.repo_dir, args.checkpoint, args.output)

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #1838** (2026-09-20): **[BUG]: Alert Bridge sends no VLM system_prompt when verification config omits it**
  *Symptoms*: ### Version  develop  ### Installation method  Docker Compose  ### Describe the bug  POST /api/v1/verification/config only requires alert_type and prompt. system_prompt is optional and may be omitted or null.  When it is unset, Alert Bridge does not apply a service default. The stored value stays null, prompt lookup returns None, and VlmClient skips the system role entirely. The VLM call is user prompt + media only.  That is weaker than the seeded FOV config in alert_type_config.json, which always includes "system": "You are a helpful assistant.". Seeding only happens at startup (prompt.override_prompts_on_start + file load). A config created at runtime without system_prompt never gets that text.  Operators should not have to supply a system prompt. The user prompt is the detection question; the system prompt is the VLM contract (role, answer shape) and should be decided by the service unless an admin explicitly overrides it.   ### Steps to reproduce  Deploy alerts in verification / CV mode (dev-profile-alerts, -m verification). Create a verification config with only alert_type and prompt (no system_prompt), e.g. curl -sS -X POST "$AB/api/v1/verification/config" -H 'Content-Type: application/json' -d '{ "alert_type": "FOV Count Violation", "prompt": "Is anyone on the ladder without a hardhat and safety vest? Answer yes or no.", "output_category": "Ladder PPE Violation" }' Confirm GET .../verification/config shows "system_prompt": null. Let a matching CV candidate through (or 
  **Post-Mortem & Fix Analysis**:
  > <!-- vss-github-ai-triage:v1 --> Thanks for filing this issue. We ran an automated first-pass triage.  - Category: `product bug` - Confidence: `0.92` - Next step: This looks actionable for maintainer review. It will not be copied to internal NVBugs unless the team explicitly approves it.  A maintainer will make the final call on labels, escalation, and whether this should become an internal bug.
  > Thank you for your reply, this is a bug.  The current flow is: ```   POST /api/v1/verification/config     -> system_prompt is optional     -> AlertConfigService persists null unchanged     -> PromptManager returns None for system_prompt     -> VlmClient only adds the system message when system_prompt is truthy     -> the VLM request contains no system role ```  The seed file `alert_type_config.json` contains a default system prompt, but it is applied only during service startup. It does not fix configurations created or updated later through the API, or existing configurations where system_prompt is already null.  Please refer to the following patch:  ```patch  diff --git a/services/alert/handlers/prompt_handler/prompt_manager.py b/services/alert/handlers/prompt_handler/prompt_manager.py   --- a/services/alert/handlers/prompt_handler/prompt_manager.py   +++ b/services/alert/handlers/prompt_handler/prompt_manager.py   @@    class PromptManager:   +    DEFAULT_SYSTEM_PROMPT = "You are a 
  > You should also merge this PR locally first.  https://github.com/NVIDIA-AI-Blueprints/video-search-and-summarization/pull/1861

- **Issue #1413** (2026-09-03): **[BUG]: RT-VLM openai-compat sends max_tokens, incompatible with OpenAI GPT-5 reasoning models (requires max_completion_tokens)**
  *Symptoms*: ### Version  3.2.0  ### Installation method  Other  ### Describe the bug  **VSS version:** 3.2.0 and 3.2.1 (both reproduce) **Component:** RT-VLM (vss-rt-vlm), openai-compat mode **Deployment:** Helm on EKS, remote Azure OpenAI endpoint  ### Summary RT-VLM's openai-compat client always sends `max_tokens` in its chat/completions requests. OpenAI's GPT-5 model family (reasoning models AND chat variants, e.g. gpt-5.2, gpt-5.2-chat, gpt-5.4, gpt-5.5) rejects `max_tokens` and requires `max_completion_tokens` instead. This makes RT-VLM unusable with any GPT-5-class model for the VLM/vision role.  ### Actual result ERROR Error during warmup VlmProcess-0: ServiceException - code: BadRequestError message: Error code: 400 - {'error': {'message': "Unsupported parameter: 'max_tokens' is not supported with this model. Use 'max_completion_tokens' instead.", 'type': 'invalid_request_error', 'param': 'max_tokens', 'code': 'unsupported_parameter'}}   Confirmed this is not model-specific — the same error occurs with gpt-5.2-chat and other -chat variants via direct Azure API testing.  ### Expected result RT-VLM should either emit `max_completion_tokens` for reasoning-model deployments, or expose a config option to control which token parameter is sent (similar to how the LVS summarization LLM config already supports `max_completion_tokens` per docs.nvidia.com/vss/3.2.0/vss-agent/configure-llm.html).  ### Additional context - NVIDIA support (via account team) confirmed no existing fix and recomm
  **Post-Mortem & Fix Analysis**:
  > <!-- vss-github-ai-triage:v1 --> Thanks for filing this issue. We ran an automated first-pass triage.  - Category: `product bug` - Confidence: `0.94` - Next step: This looks actionable for maintainer review. It will not be copied to internal NVBugs unless the team explicitly approves it.  A maintainer will make the final call on labels, escalation, and whether this should become an internal bug.
  >  This issue is caused by the RT-VLM openai-compat backend sending max_tokens, while GPT-5 reasoning endpoints require max_completion_tokens.  As a workaround for VSS 3.2.0/3.2.1, use gpt-4o for the VLM and reserve GPT-5 for LVS summarization. If GPT-5 is required for RT-VLM, apply the patch above and rebuild/redeploy the vss-rt-vlm image.  Note that this is a targeted workaround. Endpoints that only support the legacy max_tokens parameter may not work with the patched image.  ```python   diff --git a/services/rtvi/rt-vlm/src/models/openai_compat/openai_compat_model.py b/services/rtvi/rt-vlm/src/models/openai_compat/openai_compat_model.py   @@ -1058,7 +1058,7 @@ class CompOpenAIModel(BaseVlmModel):                            response_obj = self._model.invoke(                                messages,   -                            max_tokens=config.max_new_tokens,   +                            max_completion_tokens=config.max_new_tokens,                                temperature=config
  > Thank you for the patch reference. However, modifying files inside a vendor-provided container image is not viable for our Kubernetes/Helm/ArgoCD deployment — it would require building and maintaining a custom fork of the RT-VLM image. Could this be addressed as a proper configuration option instead, for example:  An env var like VLM_TOKEN_PARAM=max_completion_tokens that the OpenAI-compat client respects, OR Model-family detection (auto-switch to max_completion_tokens when the model name matches a gpt-5/o-series pattern), similar to how the LVS summarization LLM already supports max_completion_tokens natively  Is a fix planned for any upcoming versions ? Additionally, gpt-4o is reaching end-of-life in October 2026 — at that point the VLM role will have no viable fallback and migrating to GPT-5 or higher models becomes mandatory, not optional. This makes a proper configurable fix a hard requirement before that deadline, not just a nice-to-have. In the meantime we'll keep gpt-4o on the 

- **Issue #1138** (2026-06-30): **[GH-1125] [video-search-and-summarization] [GH-1119] [video-search-and-summarization] [GH-1116] [video-**
  *Symptoms*: ## Description  https://github.com/NVIDIA-AI-Blueprints/video-search-and-summarization/issues/1125 <hr /> ## Description https://github.com/NVIDIA-AI-Blueprints/video-search-and-summarization/issues/1119<hr /> Description</h2> https://github.com/NVIDIA-AI-Blueprints/video-search-and-summarization/issues/1116<hr /> Description</h2> https://github.com/NVIDIA-AI-Blueprints/video-search-and-summarization/issues/1112<hr /> Description</h2> https://github.com/NVIDIA-AI-Blueprints/video-search-and-summarization/issues/1102<hr /> Description</h2> https://github.com/NVIDIA-AI-Blueprints/video-search-and-summarization/issues/1091<hr /> Is this a correction or a request for new documentation?</h3> Correction / UpdateLink to existing documentation (if applicable) <em>No response</em>Describe the issue or what documentation is needed Dear Support, this is very excellent concept and effort. But, I am trying to make it run locally <strong>without</strong> <code>NGC_CLI_API_KEY</code> which I have also asked in some other tickets, but was not able to make it docker UP and run. I think if you can provide any <code>Readme</code> or any step guidelines that after locally downloading model, how to make the docker and <strong>run it without any NGC_CLI_API_KEY / cloud / internet / external source access</strong>. Proposed correction or content Docker <code>maybe</code> changes <code>1) –flags local, cloud 2) –model model_names,  3) –local_path_ /storage/disk1/folder 4) –option_to_use search_and_c

- **Issue #1137** (2026-06-30): **[GH-1124] [video-search-and-summarization] [GH-1118] [video-search-and-summarization] [GH-1115] [video-**
  *Symptoms*: ## Description  https://github.com/NVIDIA-AI-Blueprints/video-search-and-summarization/issues/1124 <hr /> ## Description https://github.com/NVIDIA-AI-Blueprints/video-search-and-summarization/issues/1118<hr /> Description</h2> https://github.com/NVIDIA-AI-Blueprints/video-search-and-summarization/issues/1115<hr /> Description</h2> https://github.com/NVIDIA-AI-Blueprints/video-search-and-summarization/issues/1111<hr /> Description</h2> https://github.com/NVIDIA-AI-Blueprints/video-search-and-summarization/issues/1101<hr /> Description</h2> https://github.com/NVIDIA-AI-Blueprints/video-search-and-summarization/issues/1019<hr /> Hi Team, I tried to deploy via remote_llm_deployment, LLM Server : RTX A5000 + H100 VSS Server : DGX Spark When i upload video file at web UI application, I got error “Error: [###] {‘message’: ‘“auto” tool choice requires –enable-auto-tool-choice and –tool-call-parser to be set’, ‘type’: ‘BadRequestError’, ‘param’: None, ‘code’: 400} {‘error’: {‘message’: ‘“auto” tool choice requires –enable-auto-tool-choice and –tool-call-parser to be set’, ‘type’: ‘BadRequestError’, ‘param’: None, ‘code’: 400}}” Below is the command I run docker: docker run -it –rm –gpus ‘device=0’ –shm-size=16gb -e NGC_API_KEY=$NGC_API_KEY -e NIM_ENABLE_AUTO_TOOL_CHOICE=1 -e NIM_TOOL_CALL_PARSER=llama3_json -v “$LOCAL_NIM_CACHE:/opt/nim/.cache” -p 30081:8000 nvcr.io/nim/nvidia/nemotron-3-nano:latest LLM Error log when upload video file : (APIServer pid=72) INFO: Started server process

- **Issue #1136** (2026-06-30): **[GH-1123] [video-search-and-summarization] [GH-1117] [video-search-and-summarization] [GH-111] [video-s**
  *Symptoms*: ## Description  https://github.com/NVIDIA-AI-Blueprints/video-search-and-summarization/issues/1123 <hr /> ## Description https://github.com/NVIDIA-AI-Blueprints/video-search-and-summarization/issues/1117<hr /> Description</h2> https://github.com/NVIDIA-AI-Blueprints/video-search-and-summarization/issues/111<hr /> Environment<ul><li>VSS 3.1.0 (2026-03-13 build, SHA <code>cdd604d6baf6c445882ce72ecbf5426287a847ff</code>)</li><li>Hardware: DGX Spark (ARM64 / GB10)</li><li>Running the <code>bp_developer_lvs_2d</code> profile via <code>docker compose –profile bp_developer_lvs_2d up -d lvs-server elasticsearch elasticsearch-init-container</code></li><li>Remote LLM: Nemotron 3 Super 120B on a second Spark (OpenAI-compatible)</li><li>Local VLM: Cosmos Reason-2 8B NIM at <code>http://:30082/v1/</code> (confirmed reachable)</li></ul> </h3> Observation</h3> In our <code>docker images</code> output for NGC-pulled <code>nvcr.io/nvidia/vss-core/*</code>:<code>nvcr.io/nvidia/vss-core/vss-vios-sensor:3.1.0-sbsa            5.89GB nvcr.io/nvidia/vss-core/vss-vios-streamprocessing:3.1.0-sbsa  5.99GB nvcr.io/nvidia/vss-core/vss-long-video-summarization:3.1.0    33.5GB  ← no -sbsa tag </code></pre>Other VSS components ship with <code>-sbsa</code> variants for ARM64, but <code>vss-long-video-summarization</code> only ships the x86 tag. Docker pulls and runs it on DGX Spark via emulation, which causes the DeepStream GPU-decoder path to fail.Symptom</h3> On <code>docker compose up -d lvs-server</code

- **Issue #1125** (2026-06-30): **[GH-1119] [video-search-and-summarization] [GH-1116] [video-search-and-summarization] [GH-1112] [video-**
  *Symptoms*: ## Description  https://github.com/NVIDIA-AI-Blueprints/video-search-and-summarization/issues/1119 <hr /> ## Description https://github.com/NVIDIA-AI-Blueprints/video-search-and-summarization/issues/1116<hr /> Description</h2> https://github.com/NVIDIA-AI-Blueprints/video-search-and-summarization/issues/1112<hr /> Description</h2> https://github.com/NVIDIA-AI-Blueprints/video-search-and-summarization/issues/1102<hr /> Description</h2> https://github.com/NVIDIA-AI-Blueprints/video-search-and-summarization/issues/1091<hr /> Is this a correction or a request for new documentation?</h3> Correction / UpdateLink to existing documentation (if applicable) <em>No response</em>Describe the issue or what documentation is needed Dear Support, this is very excellent concept and effort. But, I am trying to make it run locally <strong>without</strong> <code>NGC_CLI_API_KEY</code> which I have also asked in some other tickets, but was not able to make it docker UP and run. I think if you can provide any <code>Readme</code> or any step guidelines that after locally downloading model, how to make the docker and <strong>run it without any NGC_CLI_API_KEY / cloud / internet / external source access</strong>. Proposed correction or content Docker <code>maybe</code> changes <code>1) –flags local, cloud 2) –model model_names,  3) –local_path_ /storage/disk1/folder 4) –option_to_use search_and_collect, search_and_summarization_from_collection </code> This might be an easy to use.Code of Conduct<ul><

- **Issue #1124** (2026-06-30): **[GH-1118] [video-search-and-summarization] [GH-1115] [video-search-and-summarization] [GH-1111] [video-**
  *Symptoms*: ## Description  https://github.com/NVIDIA-AI-Blueprints/video-search-and-summarization/issues/1118 <hr /> ## Description https://github.com/NVIDIA-AI-Blueprints/video-search-and-summarization/issues/1115<hr /> Description</h2> https://github.com/NVIDIA-AI-Blueprints/video-search-and-summarization/issues/1111<hr /> Description</h2> https://github.com/NVIDIA-AI-Blueprints/video-search-and-summarization/issues/1101<hr /> Description</h2> https://github.com/NVIDIA-AI-Blueprints/video-search-and-summarization/issues/1019<hr /> Hi Team, I tried to deploy via remote_llm_deployment, LLM Server : RTX A5000 + H100 VSS Server : DGX Spark When i upload video file at web UI application, I got error “Error: [###] {‘message’: ‘“auto” tool choice requires –enable-auto-tool-choice and –tool-call-parser to be set’, ‘type’: ‘BadRequestError’, ‘param’: None, ‘code’: 400} {‘error’: {‘message’: ‘“auto” tool choice requires –enable-auto-tool-choice and –tool-call-parser to be set’, ‘type’: ‘BadRequestError’, ‘param’: None, ‘code’: 400}}” Below is the command I run docker: docker run -it –rm –gpus ‘device=0’ –shm-size=16gb -e NGC_API_KEY=$NGC_API_KEY -e NIM_ENABLE_AUTO_TOOL_CHOICE=1 -e NIM_TOOL_CALL_PARSER=llama3_json -v “$LOCAL_NIM_CACHE:/opt/nim/.cache” -p 30081:8000 nvcr.io/nim/nvidia/nemotron-3-nano:latest LLM Error log when upload video file : (APIServer pid=72) INFO: Started server process [72] (APIServer pid=72) INFO: Waiting for application startup. (APIServer pid=72) INFO: Application start

- **Issue #1123** (2026-06-30): **[GH-1117] [video-search-and-summarization] [GH-111] [video-search-and-summarization] `vss-long-video-su**
  *Symptoms*: ## Description  https://github.com/NVIDIA-AI-Blueprints/video-search-and-summarization/issues/1117 <hr /> ## Description https://github.com/NVIDIA-AI-Blueprints/video-search-and-summarization/issues/111<hr /> Environment<ul><li>VSS 3.1.0 (2026-03-13 build, SHA <code>cdd604d6baf6c445882ce72ecbf5426287a847ff</code>)</li><li>Hardware: DGX Spark (ARM64 / GB10)</li><li>Running the <code>bp_developer_lvs_2d</code> profile via <code>docker compose –profile bp_developer_lvs_2d up -d lvs-server elasticsearch elasticsearch-init-container</code></li><li>Remote LLM: Nemotron 3 Super 120B on a second Spark (OpenAI-compatible)</li><li>Local VLM: Cosmos Reason-2 8B NIM at <code>http://:30082/v1/</code> (confirmed reachable)</li></ul> </h3> Observation</h3> In our <code>docker images</code> output for NGC-pulled <code>nvcr.io/nvidia/vss-core/*</code>:<code>nvcr.io/nvidia/vss-core/vss-vios-sensor:3.1.0-sbsa            5.89GB nvcr.io/nvidia/vss-core/vss-vios-streamprocessing:3.1.0-sbsa  5.99GB nvcr.io/nvidia/vss-core/vss-long-video-summarization:3.1.0    33.5GB  ← no -sbsa tag </code></pre>Other VSS components ship with <code>-sbsa</code> variants for ARM64, but <code>vss-long-video-summarization</code> only ships the x86 tag. Docker pulls and runs it on DGX Spark via emulation, which causes the DeepStream GPU-decoder path to fail.Symptom</h3> On <code>docker compose up -d lvs-server</code>, the container starts, Cosmos VLM connectivity succeeds (remote), 16 VlmProcess workers warm up, but ini

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

### Incident Patch 1: `b534be23` (2026-09-30)
**Commit Message**: fix(behavior-analytics): refine calibration gating conditions in deployment.yaml

Updated the conditions for initializing the calibration-related resources to ensure consistency across the chart. The gating now checks both the enabled status of resourceFiles.calibration and the presence of apiUrl, aligning with previous changes made to the fetch-calibration ConfigMap. This adjustment prevents unnecessary resource allocation when calibration is disabled.

Signed-off-by: Ankita Jain <ankitaj@nvidia.com>
Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Signed-off-by: Ankita Jain <ankitaj@nvidia.com>

**File**: `deploy/helm/services/analytics/charts/behavior-analytics/templates/deployment.yaml` (modified, +2/-2)
```diff
@@ -50,7 +50,7 @@ spec:
         {{- toYaml (index $g "imagePullSecrets") | nindent 8 }}
       {{- end }}
       {{- $calibApiUrl := .Values.resourceFiles.calibration.apiUrl }}
-      {{- if or .Values.waitForKafka.enabled .Values.downloadResourcesFromNgc $calibApiUrl }}
+      {{- if or .Values.waitForKafka.enabled .Values.downloadResourcesFromNgc (and .Values.resourceFiles.calibration.enabled $calibApiUrl) }}
       initContainers:
         {{- if .Values.waitForKafka.enabled }}
         - name: wait-for-kafka
@@ -192,7 +192,7 @@ spec:
             name: {{ include "vss-behavior-analytics.fullname" . }}-config
         {{- if or .Values.resourceFiles.calibration.enabled .Values.resourceFiles.roadNetwork.enabled }}
         - name: vss-behavior-analytics-resources
-          {{- if $calibApiUrl }}
+          {{- if and .Values.resourceFiles.calibration.enabled $calibApiUrl }}
           emptyDir: {}
           {{- else if .Values.downloadResourcesFromNgc }}
           persistentVolumeClaim:
```

---

### Incident Patch 2: `6bd1999f` (2026-09-30)
**Commit Message**: fix(behavior-analytics): align calibration gate style with configmap.yaml

Use the explicit .Values.enabled / .Values.resourceFiles.calibration.enabled /
.Values.resourceFiles.calibration.apiUrl condition (matching configmap.yaml's
fetch-calibration ConfigMap gate) instead of the $calibApiUrl variable shorthand,
for consistency across the chart. .Values.enabled is already guaranteed true at
this point in deployment.yaml (whole file is wrapped in it), so this is a
style/consistency alignment rather than a behavior change.

Signed-off-by: Ankita Jain <ankitaj@nvidia.com>
Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>

**File**: `deploy/helm/services/analytics/charts/behavior-analytics/templates/deployment.yaml` (modified, +2/-2)
```diff
@@ -128,7 +128,7 @@ spec:
             - name: vss-behavior-analytics-resources
               mountPath: /resources-data
         {{- end }}
-        {{- if and .Values.resourceFiles.calibration.enabled $calibApiUrl }}
+        {{- if and .Values.enabled .Values.resourceFiles.calibration.enabled .Values.resourceFiles.calibration.apiUrl }}
         # Fetches calibration.json from the video-analytics API, retrying
         # until it returns real data, then validates it before the main
         # container starts.
@@ -202,7 +202,7 @@ spec:
             name: {{ include "vss-behavior-analytics.fullname" . }}-resources
           {{- end }}
         {{- end }}
-        {{- if and .Values.resourceFiles.calibration.enabled $calibApiUrl }}
+        {{- if and .Values.enabled .Values.resourceFiles.calibration.enabled .Values.resourceFiles.calibration.apiUrl }}
         - name: fetch-calibration-script
           configMap:
             name: {{ include "vss-behavior-analytics.fullname" . }}-fetch-calibration
```

---

### Incident Patch 3: `bf744fe9` (2026-09-30)
**Commit Message**: fix(behavior-analytics): gate fetch-calibration ConfigMap on resourceFiles.calibration.enabled

The fetch-calibration ConfigMap (fetch-calibration.py script) was gated
only on apiUrl being set, same inconsistency as the initContainer/volume
fixed previously. This leaves an orphaned, unused ConfigMap when
calibration is disabled but apiUrl is still populated. Align the
condition with the rest of the calibration gating.

Signed-off-by: Ankita Jain <ankitaj@nvidia.com>
Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>

**File**: `deploy/helm/services/analytics/charts/behavior-analytics/templates/configmap.yaml` (modified, +1/-1)
```diff
@@ -24,7 +24,7 @@ data:
   vss-behavior-analytics-config.json: |
 {{ required "vss-behavior-analytics.config.kafkaConfigJson must be set when enabled" .Values.config.kafkaConfigJson | trim | nindent 4 }}
 {{- end }}
-{{- if and .Values.enabled .Values.resourceFiles.calibration.apiUrl }}
+{{- if and .Values.enabled .Values.resourceFiles.calibration.enabled .Values.resourceFiles.calibration.apiUrl }}
 ---
 apiVersion: v1
 kind: ConfigMap
```

---

### Incident Patch 4: `9588b648` (2026-09-30)
**Commit Message**: fix(behavior-analytics): gate fetch-calibration on resourceFiles.calibration.enabled

Previously the fetch-calibration initContainer and its script ConfigMap
were gated solely on apiUrl being set, ignoring resourceFiles.calibration.enabled.
This meant enabled: false had no effect if apiUrl was still populated,
leaving the pod blocked/crashing on a calibration API that was never meant
to be polled.

This is needed to allow the warehouse-2d-app profile to run entirely
without calibration (ROI/tripwire), since 2D can operate directly on
raw camera streams using image coordinates and doesn't require it.

Signed-off-by: Ankita Jain <ankitaj@nvidia.com>
Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>

**File**: `deploy/helm/services/analytics/charts/behavior-analytics/templates/deployment.yaml` (modified, +2/-2)
```diff
@@ -128,7 +128,7 @@ spec:
             - name: vss-behavior-analytics-resources
               mountPath: /resources-data
         {{- end }}
-        {{- if $calibApiUrl }}
+        {{- if and .Values.resourceFiles.calibration.enabled $calibApiUrl }}
         # Fetches calibration.json from the video-analytics API, retrying
         # until it returns real data, then validates it before the main
         # container starts.
@@ -202,7 +202,7 @@ spec:
             name: {{ include "vss-behavior-analytics.fullname" . }}-resources
           {{- end }}
         {{- end }}
-        {{- if $calibApiUrl }}
+        {{- if and .Values.resourceFiles.calibration.enabled $calibApiUrl }}
         - name: fetch-calibration-script
           configMap:
             name: {{ include "vss-behavior-analytics.fullname" . }}-fetch-calibration
```

---

### Incident Patch 5: `1747adbb` (2026-09-30)
**Commit Message**: fix(rtvi-vlm): accept stream IDs in VLM queries (#2435)

* fix(rtvi-vlm): accept stream IDs in VLM queries

Allow path-safe external stream identifiers through the captions query model so CV stream/add can start auto-inference after registration.

NVBug 6735416

Signed-off-by: Amit Kale <amkale@nvidia.com>

* fix(rtvi-vlm): preserve legacy VIOS removal IDs

Signed-off-by: Amit Kale <amkale@nvidia.com>

* test(rtvi-vlm): align unit fixtures with stream ID contract

Signed-off-by: Amit Kale <36946319+nv-amkale@users.noreply.github.com>

* docs(rtvi-vlm): align OpenAPI with string stream identifiers

Signed-off-by: Amit Kale <36946319+nv-amkale@users.noreply.github.com>

---------

Signed-off-by: Amit Kale <amkale@nvidia.com>
Signed-off-by: Amit Kale <36946319+nv-amkale@users.noreply.github.com>

**File**: `services/rtvi/rt-vlm/README.md` (modified, +7/-6)
```diff
@@ -1082,7 +1082,7 @@ curl -X POST "$BACKEND/v1/stream/add" \
 
 Response:
 ```json
-{"camera_id": "cam-001", "asset_id": "uuid-...", "status": "processing", "inference": true}
+{"camera_id": "cam-001", "asset_id": "cam-001", "status": "processing", "inference": true}
 ```
 
 #### Add Stream without Inference (Passthrough)
@@ -1123,10 +1123,11 @@ curl "$BACKEND/v1/stream/get-stream-info"
 Response:
 ```json
 {
-  "streams": [
-    {"camera_id": "cam-001", "asset_id": "uuid-...", "camera_url": "rtsp://...", "inference_active": true}
-  ],
-  "stream_count": 1
+  "status": "ok",
+  "stream_count": 1,
+  "stream_list": [
+    {"camera_id": "cam-001", "asset_id": "cam-001", "camera_url": "rtsp://...", "inference_active": true}
+  ]
 }
 ```
 
@@ -1148,7 +1149,7 @@ curl -X POST "$BACKEND/v1/stream/remove" \
 
 Response:
 ```json
-{"camera_id": "cam-001", "asset_id": "uuid-...", "status": "removed"}
+{"camera_id": "cam-001", "asset_id": "cam-001", "status": "removed"}
 ```
 
 #### CLI Commands
```

**File**: `services/rtvi/rt-vlm/api_spec/openapi.json` (modified, +13/-11)
```diff
@@ -4895,7 +4895,7 @@
                         "maxLength": 256,
                         "pattern": "^(.|\\n)*$",
                         "title": "Asset Id",
-                        "description": "RTVI internal asset UUID."
+                        "description": "Asset identifier; for live streams, matches camera_id."
                     },
                     "status": {
                         "type": "string",
@@ -4930,7 +4930,8 @@
                     "camera_id": {
                         "type": "string",
                         "maxLength": 256,
-                        "pattern": "^(.|\\n)*$",
+                        "minLength": 1,
+                        "pattern": "^[A-Za-z0-9][A-Za-z0-9._-]{0,255}$",
                         "title": "Camera Id",
                         "description": "User-provided unique camera identifier.",
                         "examples": [
@@ -5092,7 +5093,7 @@
                         "maxLength": 256,
                         "pattern": "^(.|\\n)*$",
                         "title": "Asset Id",
-                        "description": "RTVI internal asset UUID."
+                        "description": "RTVI asset identifier."
                     },
                     "source_id": {
                         "anyOf": [
@@ -5817,7 +5818,8 @@
                     "camera_id": {
                         "type": "string",
                         "maxLength": 256,
-                        "pattern": "^(.|\\n)*$",
+                        "minLength": 1,
+                        "pattern": "^[A-Za-z0-9][A-Za-z0-9._-]{0,255}$",
                         "title": "Camera Id",
                         "description": "User-provided unique camera identifier.",
                         "examples": [
@@ -6453,16 +6455,16 @@
                         "anyOf": [
                             {
                                 "type": "string",
-                                "format": "uuid",
-                                "maxLength": 36,
-                                "minLength": 36
+                                "minLength": 1,
+                                "maxLength": 256,
+                                "pattern": "^[A-Za-z0-9][A-Za-z0-9._-]{0,255}$"
                             },
                             {
                                 "items": {
                                     "type": "string",
-                                    "format": "uuid",
-                                    "maxLength": 36,
-                                    "minLength": 36
+                                    "minLength": 1,
+                                    "maxLength": 256,
+                                    "pattern": "^[A-Za-z0-9][A-Za-z0-9._-]{0,255}$"
                                 },
                                 "type": "array",
                                 "maxItems": 50
@@ -6490,7 +6492,7 @@
                             }
                         ],
                         "title": "Url",
-                        "description": "URL of the video/image to process. Supported schemes: http://, https://, s3://, file://. When provided, 'id' must also be specified as a single UUID.",
+                        "description": "URL of the video/image to process. Supported schemes: http://, https://, s3://, file://. When provided, 'id' must also be specified as a single identifier.",
                         "examples": [
                             "https://example.com/video.mp4",
                             "s3://bucket/video.mp4",
```

**File**: `services/rtvi/rt-vlm/src/api_models/captions.py` (modified, +25/-6)
```diff
@@ -27,6 +27,7 @@
     DEFAULT_MAX_GENERATION_TOKENS,
     MAX_GENERATION_TOKENS,
     MAX_GENERATION_TOKENS_ENV,
+    STREAM_ID_PATTERN,
     CommonBaseModel,
     CompletionUsage,
     MediaInfoOffset,
@@ -72,6 +73,10 @@ def get_vlm_prompt_max_length() -> int:
 
 
 VLM_PROMPT_MAX_LENGTH = get_vlm_prompt_max_length()
+VlmAssetId = (
+    UUID
+    | Annotated[str, Field(min_length=1, max_length=256, pattern=STREAM_ID_PATTERN)]
+)
 
 
 # Absolute upper bound for `prompt` / `system_prompt` length, used as the
@@ -287,16 +292,30 @@ class VlmQuery(CommonBaseModel):
 
     _prompt_driven_reasoning: bool = PrivateAttr(default=False)
 
-    id: UUID | List[UUID] = Field(
+    id: VlmAssetId | List[VlmAssetId] = Field(
         description="Unique ID or list of IDs of the file(s)/live-stream(s) to generate VLM captions for",
         examples=[
             "123e4567-e89b-12d3-a456-426614174000",
             ["123e4567-e89b-12d3-a456-426614174000", "987fcdeb-51a2-43d1-b567-537725285111"],
         ],
         json_schema_extra={
             "anyOf": [
-                {"type": "string", "format": "uuid"},
-                {"type": "array", "items": {"type": "string", "format": "uuid"}, "maxItems": 50},
+                {
+                    "type": "string",
+                    "minLength": 1,
+                    "maxLength": 256,
+                    "pattern": STREAM_ID_PATTERN,
+                },
+                {
+                    "type": "array",
+                    "items": {
+                        "type": "string",
+                        "minLength": 1,
+                        "maxLength": 256,
+                        "pattern": STREAM_ID_PATTERN,
+                    },
+                    "maxItems": 50,
+                },
             ]
         },
     )
@@ -308,8 +327,8 @@ def check_ids(cls, v):
         return v
 
     @property
-    def id_list(self) -> List[UUID]:
-        return [self.id] if isinstance(self.id, UUID) else self.id
+    def id_list(self) -> List[VlmAssetId]:
+        return self.id if isinstance(self.id, list) else [self.id]
 
     @property
     def get_query_json(self: CommonBaseModel) -> dict:
@@ -321,7 +340,7 @@ def get_query_json(self: CommonBaseModel) -> dict:
         description=(
             "URL of the video/image to process. Supported schemes: "
             "http://, https://, s3://, file://. "
-            "When provided, 'id' must also be specified as a single UUID."
+            "When provided, 'id' must also be specified as a single identifier."
         ),
         pattern=r"^(https?://|s3://|file://).*",
         examples=[
```

**File**: `services/rtvi/rt-vlm/src/api_models/common.py` (modified, +1/-0)
```diff
@@ -33,6 +33,7 @@
 ERROR_MESSAGE_PATTERN = r'^[A-Za-z\-. ,_"\']*$'
 ANY_CHAR_PATTERN = r"^(.|\n)*$"
 UUID_PATTERN = r"^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$"
+STREAM_ID_PATTERN = r"^[A-Za-z0-9][A-Za-z0-9._-]{0,255}$"
 MAX_GENERATION_TOKENS_ENV = "VLM_MAX_GENERATION_TOKENS"
 DEFAULT_MAX_GENERATION_TOKENS = 16 * 1024
 
```

**File**: `services/rtvi/rt-vlm/src/api_models/live_stream.py` (modified, +12/-4)
```diff
@@ -38,11 +38,11 @@
     DESCRIPTION_PATTERN,
     MAX_GENERATION_TOKENS,
     MAX_GENERATION_TOKENS_ENV,
+    STREAM_ID_PATTERN,
     CommonBaseModel,
 )
 
 LIVE_STREAM_URL_PATTERN = r"^rtsp://"
-STREAM_ID_PATTERN = r"^[A-Za-z0-9][A-Za-z0-9._-]{0,255}$"
 # CV-compatible URL pattern: accepts rtsp://, file://, http://, https://.
 # Empty VIOS camera_add registration URLs are handled by the VIOS-specific pattern.
 CV_STREAM_URL_PATTERN = r"^(rtsp://|file://|https?://)"
@@ -617,8 +617,9 @@ class StreamAddValue(CommonBaseModel):
 
     camera_id: str = Field(
         description="User-provided unique camera identifier.",
+        min_length=1,
         max_length=256,
-        pattern=ANY_CHAR_PATTERN,
+        pattern=STREAM_ID_PATTERN,
         examples=["camera-001"],
     )
     camera_name: Optional[str] = Field(
@@ -821,6 +822,13 @@ def validate_known_metadata(cls, v):
 class ViosStreamAddEvent(ViosStreamEventBase):
     """VIOS event payload for POST /v1/stream/add."""
 
+    camera_id: str = Field(
+        description="User-provided unique camera identifier.",
+        min_length=1,
+        max_length=256,
+        pattern=STREAM_ID_PATTERN,
+        examples=["camera-001"],
+    )
     camera_url: str = Field(
         description="Stream URL or absolute file path.",
         max_length=1024,
@@ -946,7 +954,7 @@ class StreamAddResponse(CommonBaseModel):
         pattern=ANY_CHAR_PATTERN,
     )
     asset_id: str = Field(
-        description="RTVI internal asset UUID.",
+        description="Asset identifier; for live streams, matches camera_id.",
         max_length=256,
         pattern=ANY_CHAR_PATTERN,
     )
@@ -1101,7 +1109,7 @@ class StreamInfo(CommonBaseModel):
         pattern=CV_STREAM_URL_PATTERN,
     )
     asset_id: str = Field(
-        description="RTVI internal asset UUID.",
+        description="RTVI asset identifier.",
         max_length=256,
         pattern=ANY_CHAR_PATTERN,
     )
```

---

### Incident Patch 6: `84acd954` (2026-09-30)
**Commit Message**: fix(compose): the ingress answers NemoClaw's host.openshell.internal on the Compose network (#2451)

Co-authored-by: Claude Opus 5.5 <noreply@anthropic.com>
Signed-off-by: Zac Wang <zacw@nvidia.com>

**File**: `.github/skill-eval/tests/test_lvs_deployment_config.py` (modified, +60/-0)
```diff
@@ -40,3 +40,63 @@ def test_file_and_live_summarization_use_separate_data_paths(config_path: Path)
     live_summary = functions["summarization_online"]
     assert live_summary["type"] == "vlm_structured_summarization_online"
     assert live_summary["params"]["kafka_enabled"] is True
+
+
+# --- NemoClaw clip URLs --------------------------------------------------------
+#
+# The vss CLI in a NemoClaw sandbox mints clip URLs on host.openshell.internal.
+# LVS passes them to its VLM, and the VLM is what fetches the clip. The ingress
+# carries that name as a network alias, so every container on the Compose network
+# resolves it to vss-haproxy-ingress (which already accepts that Host) without a
+# per-service extra_hosts entry.
+
+COMPOSE_SERVICES = REPO_ROOT / "deploy/docker/services"
+OPENSHELL_ALIAS = "${HOST_INTERNAL_ALIAS:-host.openshell.internal}"
+VLM_PREFIXES = ("rtvi-vlm", "cosmos3-reasoner")
+
+
+class ComposeLoader(yaml.SafeLoader):
+    """Read Compose files, whose merge tags (`!override`, `!reset`) are plain values here."""
+
+
+def _construct_compose_tag(loader: ComposeLoader, _suffix: str, node: yaml.Node):
+    if isinstance(node, yaml.MappingNode):
+        return loader.construct_mapping(node)
+    if isinstance(node, yaml.SequenceNode):
+        return loader.construct_sequence(node)
+    return loader.construct_scalar(node)
+
+
+ComposeLoader.add_multi_constructor("!", _construct_compose_tag)
+
+
+def _compose_services() -> dict[str, dict]:
+    services: dict[str, dict] = {}
+    for path in sorted(COMPOSE_SERVICES.rglob("*.yml")):
+        document = yaml.load(path.read_text(), Loader=ComposeLoader)
+        if isinstance(document, dict) and isinstance(document.get("services"), dict):
+            services.update(document["services"])
+    return services
+
+
+def _networks(service: dict) -> set[str]:
+    networks = service.get("networks") or {"default": None}
+    return set(networks) if isinstance(networks, dict) else set(networks)
+
+
+def test_the_ingress_answers_the_nemoclaw_alias_on_the_compose_network() -> None:
+    ingress = _compose_services()["vss-haproxy-ingress"]
+    aliases = ((ingress.get("networks") or {}).get("default") or {}).get("aliases") or []
+    assert OPENSHELL_ALIAS in aliases, f"vss-haproxy-ingress has no {OPENSHELL_ALIAS} alias on the default network"
+
+
+def test_lvs_and_every_vlm_it_calls_share_the_ingress_network() -> None:
+    services = _compose_services()
+    lvs = services["lvs-server"]
+    vlms = sorted(name for name in lvs.get("depends_on", {}) if name.startswith(VLM_PREFIXES))
+    assert vlms, "lvs-server depends on no VLM service; update VLM_PREFIXES"
+    off_network = [
+        name for name in ["lvs-server", *vlms]
+        if services[name].get("network_mode") or "default" not in _networks(services[name])
+    ]
+    assert not off_network, f"{off_network} cannot reach the ingress alias; NemoClaw clip URLs would not resolve"
```

**File**: `deploy/docker/services/infra/haproxy/compose.yml` (modified, +8/-0)
```diff
@@ -24,6 +24,14 @@ services:
     container_name: vss-haproxy-ingress
     ports:
       - ${HAPROXY_HOST_PORT:-7777}:${HAPROXY_PORT:-7777}
+    networks:
+      default:
+        aliases:
+          # NemoClaw's vss CLI mints URLs on this name (http://<alias>:7777/...), and
+          # LVS hands them to its VLM. The alias lets every container on this network
+          # fetch them straight from the ingress, which already accepts that Host.
+          # Assumes HAPROXY_PORT == HAPROXY_HOST_PORT (both 7777 by default).
+          - ${HOST_INTERNAL_ALIAS:-host.openshell.internal}
     restart: always
     ulimits:
       nofile:
```

**File**: `deploy/docker/services/video-summarization/compose.yml` (modified, +0/-3)
```diff
@@ -144,9 +144,6 @@ services:
       rtvi-vlm:
         condition: service_healthy
         required: false
-    extra_hosts:
-      # NemoClaw's vss CLI mints clip URLs on this alias; resolve it to haproxy on the host.
-      - "host.openshell.internal:host-gateway"
 
     # Network mode: bridge (default) to enable port mapping
     # To use host network instead (ignores port mapping), uncomment:
```

---

### Incident Patch 7: `e3f9cf0a` (2026-09-30)
**Commit Message**: Fix (Docs) - Missing standard Search profile deployment prompt in Agent Skills workflow [nvbugs/6850644] (#2446)

Signed-off-by: Priyank Srivastava <prisrivastav@nvidia.com>

**File**: `docs/agent-workflow-search.mdx` (modified, +254/-206)
```diff
@@ -41,6 +41,8 @@ The following diagram illustrates the search workflow architecture:
 - **RTVI-CV:** Real Time Video Intelligence Computer Vision Microservice to generate object attribute embeddings for videos
 - **Behavior Analytics:** Behavior Analytics microservice to perform sequential frame analysis for object detection and tracking in videos/streams.
 
+This list describes the stock profile. The manual Compose deployment below uses it as it stands, and so does the Agent Skills deployment that names the in-stack Agent. The other two Agent Skills deployments do not: both drop the in-stack VSS Agent, Phoenix, and the Agent's LLM. The NemoClaw deployment keeps the Web UI, whose Search tab then stops working because it calls the Agent's `/api/v1/search`; a capability-composed build drops the Web UI as well. Ask for the in-stack VSS Agent if you plan to use the Agent REST API or the manual Agent UI workflow.
+
 ## Search Workflow Data Flow
 
 The search workflow has two related paths: ingestion and query execution.
@@ -67,13 +69,251 @@ The Vision Agent chat path can run:
 
 Before you begin, ensure all of the prerequisites are met. See [Prerequisites](/vss/getting-started/prerequisites) for more details.
 
-## Manual Workflow
+## Deploy
+
+### With Agent Skills
+
+As an alternative to running the workflow manually, you can use [VSS Agent Skills](/vss/vision-agent/agent-skills) from a coding agent such as Claude Code, Codex, or NemoClaw.
+
+First install the skills as described in [Installing Skills](/vss/vision-agent/agent-skills#installing-skills) and make it accessible to your coding agent.
+
+Your coding agent drives the workflow: it deploys the stack, provisions sources, and runs retrieval. Step 1 offers three deployments, and the one you pick decides how you operate it afterwards. All three assume the same supported hardware as the manual workflow.
+
+#### Step 1: Deploy the Search Stack
+
+<Note>
+The host must meet the same deployment requirements listed under [Manually](/vss/vision-agent/agent-workflows/search#manually) (supported GPU/hardware for that profile) and must meet the [Prerequisites](/vss/getting-started/prerequisites). The skill selects the hardware profile to match your system, as detailed in [Development Profile GPU Requirements](/vss/getting-started/prerequisites#development-profile-gpu-requirements).
+</Note>
+
+Deployment is driven by the [`vss-build-vision-ai`](/vss/vision-agent/agent-skills) skill. It can deploy the Search developer profile as it ships, or compose a leaner stack from the capabilities you name. Any prompt below can also name an image tag to run a release's images instead of the `containers.env` default, for example *"…with image tag `${VSS_DOCS_IMAGE_TAG:-develop-latest}`."* See [Container image tag](/vss/vision-agent/build-vision-ai#container-image-tag). The skill presents the composed architecture for your confirmation before it generates or deploys anything.
+
+##### Stock Search profile with the in-stack Agent
+
+This deploys the profile unchanged, including the in-stack VSS Agent, the Agent UI, and Phoenix — the service set under [What's being deployed](/vss/vision-agent/agent-workflows/search#whats-being-deployed). Naming the Agent is what keeps it in the build, so this is the deployment to choose if you want the Agent UI or the Agent REST API.
+
+**Deploy prompt structure**
+
+```text title="Deploy prompt structure"
+Deploy the VSS search profile with the in-stack VSS Agent so I can use the Agent UI workflow.
+```
+
+What the agent does:
+
+1. Loads the `vss-build-vision-ai` skill and detects the repository, GPU hardware, and host networking values.
+2. Validates required credentials (such as `NGC_CLI_API_KEY`) and prompts you if any are missing.
+3. Selects the `search` profile and a hardware profile that fits your system, then builds the deployment configuration.
+4. Reviews the configuration with you, then deploys the containers.
+5. Waits until all services are healthy and
```

**File**: `skills/vss-build-vision-ai/references/profiles/search.md` (modified, +5/-4)
```diff
@@ -39,10 +39,11 @@ compose tokens). Helm search keeps SDRC enabled for live multi-worker scale.
 
 ## Headless fan-out (no-agent builds)
 
-When the `vss-agent` tier is omitted, fan-out is webhook-driven: this profile
-pins `VST_NOTIFICATION_CONFIG_PATH` at a webhooks-enabled
-`notification_config.json`, so the caller registers one VIOS source and calls no
-consumer (`vss-manage-video-io-storage` `provision-vios-source.md`).
+This profile pins `VST_NOTIFICATION_CONFIG_PATH` at a webhooks-enabled
+`notification_config.json` — the pin is the profile's own, not a property of
+no-agent builds. When the `vss-agent` tier is omitted it is the whole fan-out,
+so the caller registers one VIOS source and calls no consumer
+(`vss-manage-video-io-storage` `provision-vios-source.md`).
 
 That config ships RT-CV, RT-Embed and RT-VLM tagging enabled, plus the
 Elasticsearch teardown cleanups, but the set is not inherited by default: it must
```

---

### Incident Patch 8: `7ef488c3` (2026-09-30)
**Commit Message**: fix(helm): roll alert pods on rules and prompt changes

Signed-off-by: Yun He <yunh@nvidia.com>

**File**: `deploy/helm/industry-profiles/warehouse-operations/warehouse-2d-app/README.md` (modified, +3/-1)
```diff
@@ -453,7 +453,9 @@ vss-agent-ui:
   alertsApiUrl: "http://<NODE_IP>:30980/api/v1"
   dashboardKibanaBaseUrl: "http://<NODE_IP>:31560"
   envOverrides:
-    # Merge with existing entries; Helm replaces lists.
+    # Preserve existing entries; Helm replaces lists.
+    - name: NEXT_PUBLIC_ALERTS_TAB_MEDIA_WITH_OBJECTS_BBOX
+      value: "true"
     - name: NEXT_PUBLIC_MDX_WEB_API_URL
       value: "http://<NODE_IP>:30801"
 ```
```

**File**: `deploy/helm/services/alert/templates/deployment.yaml` (modified, +1/-1)
```diff
@@ -34,7 +34,7 @@ spec:
         app.kubernetes.io/name: vss-alert-bridge
         app.kubernetes.io/instance: {{ .Release.Name }}
       annotations:
-        checksum/config: {{ tpl (.Files.Get "configs/config.yml") . | sha256sum }}
+        checksum/config: {{ include (print $.Template.BasePath "/configmap.yaml") . | sha256sum }}
     spec:
       # At alert_agent.processes: 1, the shipped default, there is no
       # supervisor: up to 10s to terminate and join the API child, up to 15s
```

---

### Incident Patch 9: `b7372787` (2026-09-29)
**Commit Message**: fix(warehouse): align Redis event format and create VLM error topic

Signed-off-by: Yun He <yunh@nvidia.com>

**File**: `deploy/docker/services/infra/compose.yml` (modified, +2/-0)
```diff
@@ -234,6 +234,7 @@ services:
         {"name": "mdx-vlm-incidents"},
         {"name": "mdx-vlm"},
         {"name": "mdx-vlm-captions"},
+        {"name": "vision-llm-errors"},
         {"name": "mdx-structured-events-summary"},
         {"name": "mdx-embed"},
         {"name": "mdx-embed-filtered"},
@@ -357,6 +358,7 @@ services:
         {"name": "mdx-vlm-incidents"},
         {"name": "mdx-vlm"},
         {"name": "mdx-vlm-captions"},
+        {"name": "vision-llm-errors"},
         {"name": "mdx-structured-events-summary"},
         {"name": "mdx-embed"},
         {"name": "mdx-embed-filtered"},
```

**File**: `deploy/helm/industry-profiles/warehouse-operations/warehouse-2d-app/configs/sdrc/config.yml` (modified, +3/-2)
```diff
@@ -42,7 +42,7 @@ k8s-workload-streamprocessing:
   WDM_MS_LISTENER_PORT: 10000
   NOHEADERTARGETROUTE: true
   HEADERLESS_SERVICE_ENDPOINTS: '["vss-vios-streamprocessing:30001"]'
-  WDM_WL_REDIS_MSG_FIELD: sensor.id
+  WDM_WL_REDIS_MSG_FIELD: value
   WDM_MSG_KEY: vst_events
   WDM_WL_PROXY_URL: /
   ENVOY_ROUTE_URL_PREFIX_REWRITE: /
@@ -59,6 +59,7 @@ k8s-workload-rtvi-cv:
   WDM_CLUSTER_TYPE: k8s
   WDM_WL_OBJECT_NAME: vss-rtvi-cv
   WDM_CONSUMER_GRP_ID: sdr-rtvi-cv-cg
+  WDM_WL_REDIS_MSG_FIELD: value
   WDM_REDIS_CACHE_OBJECT: rtvi-cv-data
   WDM_XDS_USE_POD_DNS: true
   WDM_XDS_USE_IP_ADDRESS: false
@@ -84,7 +85,7 @@ k8s-workload-alerts-2d:
   enable: true
   REDIS_MSG_KEY: vst.event
   WDM_REDIS_MSG_KEY: vst.event
-  WDM_WL_REDIS_MSG_FIELD: sensor.id
+  WDM_WL_REDIS_MSG_FIELD: value
   WDM_INITIALIZE_FROM_VST: false
   VST_STREAMS_ENDPOINT: http://vss-vios-sensor:30000/api/v1/sensor/streams
   VST_STATUS_ENDPOINT: http://vss-vios-sensor:30000/api/v1/sensor/status
```

**File**: `deploy/helm/industry-profiles/warehouse-operations/warehouse-2d-app/values.yaml` (modified, +56/-0)
```diff
@@ -170,12 +170,68 @@ vios:
     enabled: false
   vss-vios-sensor:
     enabled: true
+    # Preserve subchart defaults; extraction publishes Redis payloads under value.
+    env:
+    - name: HOST_IP
+      value: 0.0.0.0
+    - name: ADAPTOR
+      value: vst_rtsp
+    - name: ADAPTOR_IP
+      value: ''
+    - name: ADAPTOR_USER
+      value: ''
+    - name: ADAPTOR_PASSWORD
+      value: ''
+    - name: ADAPTOR_PORT
+      value: ''
+    - name: NEED_RECORDING
+      value: 'false'
+    - name: NEED_RTSPSERVER
+      value: 'false'
+    - name: NEED_STORAGE
+      value: 'false'
+    - name: NEED_STREAM_MONITORING
+      value: 'true'
+    - name: HTTP_PORT
+      value: '30000'
+    - name: CENTRALIZE_DB_NAME
+      value: nvcentralizedb
+    - name: CENTRALIZE_DB_USERNAME
+      value: vst
+    - name: DEEPSTREAM_ENABLE_SENSOR_ID_EXTRACTION
+      value: '1'
     streamProcessorService: sdrc
     persistence:
       vstData: { enabled: true, create: false, existingClaim: "" }
       vstVideo: { enabled: true, create: false, existingClaim: "" }
   vss-vios-streamprocessing:
     enabled: true
+    # Preserve subchart defaults; extraction publishes Redis payloads under value.
+    env:
+    - name: HOST_IP
+      value: 0.0.0.0
+    - name: VST_INSTALL_ADDITIONAL_PACKAGES
+      value: 'true'
+    - name: VST_APT_MIRROR
+      value: ''
+    - name: CONTAINER_NAME
+      value: vss-vios-streamprocessing
+    - name: ADAPTOR
+      value: vst_rtsp
+    - name: HTTP_PORT
+      value: '30001'
+    - name: RTSP_SERVER_PORT
+      value: '30554'
+    - name: CENTRALIZE_DB_NAME
+      value: nvcentralizedb
+    - name: CENTRALIZE_DB_USERNAME
+      value: vst
+    - name: ENABLE_AGING_POLICY
+      value: 'true'
+    - name: VST_VIDEO_STORAGE_SIZE_MB
+      value: '100000'
+    - name: DEEPSTREAM_ENABLE_SENSOR_ID_EXTRACTION
+      value: '1'
     useSdrEnvoyStyleHeadless: false
     headlessServiceName: ""
     # No bind-mounts in Helm: download overlay assets from video-analytics-api.
```

**File**: `deploy/helm/services/infra/charts/kafka/values.yaml` (modified, +1/-0)
```diff
@@ -48,6 +48,7 @@ topics:
   - name: mdx-vlm-incidents
   - name: mdx-vlm
   - name: mdx-vlm-captions
+  - name: vision-llm-errors
   - name: mdx-structured-events-summary
   - name: mdx-embed
   - name: mdx-embed-filtered
```

---

### Incident Patch 10: `14f97d29` (2026-09-29)
**Commit Message**: fix(warehouse-2d): initialize alerts from camera events

Signed-off-by: Yun He <yunh@nvidia.com>

**File**: `deploy/helm/industry-profiles/warehouse-operations/warehouse-2d-app/configs/sdrc/config.yml` (modified, +1/-1)
```diff
@@ -85,7 +85,7 @@ k8s-workload-alerts-2d:
   REDIS_MSG_KEY: vst.event
   WDM_REDIS_MSG_KEY: vst.event
   WDM_WL_REDIS_MSG_FIELD: sensor.id
-  WDM_INITIALIZE_FROM_VST: true
+  WDM_INITIALIZE_FROM_VST: false
   VST_STREAMS_ENDPOINT: http://vss-vios-sensor:30000/api/v1/sensor/streams
   VST_STATUS_ENDPOINT: http://vss-vios-sensor:30000/api/v1/sensor/status
   WDM_WL_CONFIG_PORT: "9080"
```

#### Recent Merged Pull Requests:
- **PR #2459** (closed): fix(helm): make VIOS sensor admission limit configurable (@maxervo)
- **PR #2455** (closed): harbor test (@nv-gsjadhawar)
- **PR #2454** (closed): Gsj/harbor view on openshell skills deployment (@nv-gsjadhawar)
- **PR #2453** (2026-09-30): Align alerts manual deploy command to include --build (@dineshvenkat)
- **PR #2451** (2026-09-30): fix(compose): the ingress answers NemoClaw's host.openshell.internal on the Compose network (@zac-wang-nv)
- **PR #2449** (closed): docs(warehouse-2d): updated README for Ingress configuration and exte… (@kartikayt-nvidia)
- **PR #2448** (2026-09-30): Reduce default file expiry from 7 days to 1 hour (@dsitlani-nv)
- **PR #2446** (2026-09-30): Fix (Docs) - Missing standard Search profile deployment prompt in Agent Skills workflow [nvbugs/6850644]  (@prisrivastav-nv)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
