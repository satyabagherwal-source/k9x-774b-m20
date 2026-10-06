# Forensic Learning Record (Deep Inspection): mem0ai/mem0

> **Canonical Artifact**: `07_PROJECT_LEARNING/mem0ai-mem0-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/mem0ai/mem0](https://github.com/mem0ai/mem0))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-06T03:22:39.378Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `mem0ai/mem0`
- **Description**: The Memory Layer for AI Agents - Drop-in memory infrastructure for AI agents and apps. Context that persists. Built for production.
- **Primary Language / Ecosystem**: Python
- **Discovered Manifests / Configurations**: pyproject.toml, README.md
- **Stars / Engagement**: 66633 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: pyproject.toml, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `cli/node/src/commands/utils.ts`
```
/**
 * Utility commands: status, import.
 */

import fs from "node:fs";
import boxen from "boxen";
import type { Backend } from "../backend/base.js";
import { colors, printError, printSuccess, timedStatus } from "../branding.js";
import { formatAgentEnvelope, formatJsonEnvelope } from "../output.js";
import { setCurrentCommand } from "../state.js";

const { brand, dim, success, error: errorColor } = colors;

export async function cmdStatus(
	backend: Backend,
	opts: { userId?: string; agentId?: string; output?: string } = {},
): Promise<void> {
	setCurrentCommand("status");
	const start = performance.now();
	let result: Record<string, unknown>;
	try {
		result = await timedStatus("Checking connection...", async () => {
			return backend.status({ userId: opts.userId, agentId: opts.agentId });
		});
	} catch (e) {
		result = {
			connected: false,
			error: e instanceof Error ? e.message : String(e),
		};
	}
	const elapsed = (performance.now() - start) / 1000;

	if (opts.output === "agent" || opts.output === "json") {
		formatAgentEnvelope({
			command: "status",
			data: {
				connected: result.connected,
				backend: result.backend ?? null,
				base_url: result.base_url ?? null,
			},
			durationMs: Math.round(elapsed * 1000),
		});
		return;
	}

	const lines: string[] = [];
	if (result.connected) {
		lines.push(`  ${success("\u25cf")} Connected`);
	} else {
		lines.push(`  ${errorColor("\u25cf")} Disconnected`);
	}

	lines.push(`  ${dim("Backend:")}  ${result.backend ?? "?"}`);
	if (result.base_url) {
		lines.push(`  ${dim("API URL:")}  ${result.base_url}`);
	}
	if (result.error) {
		lines.push(`  ${errorColor("Error:")}    ${result.error}`);
		if (String(result.error).includes("Authentication failed")) {
			lines.push("");
			lines.push(
				`  ${dim("Run")} ${brand("mem0 init")} ${dim("to reconfigure your API key")}`,
			);
			lines.push(
				`  ${dim("Get a key at")} ${brand("https://app.mem0.ai/dashboard/api-keys?utm_source=oss&utm_medium=cli-node")}`,
			);
		}
	}
	lines.push(`  ${dim("Latency:")}  ${elapsed.toFixed(2)}s`);

	const content = lines.join("\n");
	console.log();
	console.log(
		boxen(content, {
			title: brand("Connection Status"),
			titleAlignment: "left",
			borderColor: "magenta",
			padding: 1,
		}),
	);
	console.log();
}

export async function cmdImport(
	backend: Backend,
	filePath: string,
	opts: { userId?: string; agentId?: string; output?: string },
): Promise<void> {
	setCurrentCommand("import");
	let data: Record<string, unknown>[];
	try {
		const raw = fs.readFileSync(filePath, "utf-8");
		const parsed = JSON.parse(raw);
		data = Array.isArray(parsed) ? parsed : [parsed];
	} catch (e) {
		printError(`Failed to read file: ${e instanceof Error ? e.message : e}`);
		process.exit(1);
	}

	let added = 0;
	let failed = 0;
	const start = performance.now();

	for (let i = 0; i < data.length; i++) {
		const item = data[i];
		const content = (item.memory ?? item.text ?? item.content ?? "") as string;
		if (!content) {
			failed++;
			continue;
		}

		try {
			await backend.add(content, undefined, {
				userId: opts.userId ?? (item.user_id as string | undefined),
				agentId: opts.agentId ?? (item.agent_id as string | undefined),
				metadata: item.metadata as Record<string, unknown> | undefined,
			});
			added++;
		} catch {
			failed++;
		}

		// Simple progress indicator
		if ((i + 1) % 10 === 0 || i === data.length - 1) {
			process.stdout.write(
				`\r  ${dim(`Importing memories... ${i + 1}/${data.length}`)}`,
			);
		}
	}

	const elapsed = (performance.now() - start) / 1000;
	console.log(); // Clear progress line

	if (opts.output === "agent" || opts.output === "json") {
		formatAgentEnvelope({
			command: "import",
			data: {
				added,
				failed,
			},
			durationMs: Math.round(elapsed * 1000),
		});
		return;
	}

	printSuccess(`Imported ${added} memories (${elapsed.toFixed(2)}s)`);
	if (failed > 0) {
		printError(`${failed} memories failed to import.`);
	}
}

```

### Core Architecture Module: `cli/node/src/state.ts`
```
/**
 * Agent mode state — set by the root program option handler,
 * read by commands and branding functions.
 */

import fs from "node:fs";

let _agentMode = false;
let _currentCommand = "";
let _pendingNotice = "";

export function isAgentMode(): boolean {
	return _agentMode;
}

export function setAgentMode(val: boolean): void {
	_agentMode = val;
}

export function getCurrentCommand(): string {
	return _currentCommand;
}

export function setCurrentCommand(name: string): void {
	_currentCommand = name;
}

/**
 * Stash a Mem0 backend notice (Agent Mode unclaimed reminder) for end-of-
 * command surfacing. Called from the platform backend after each response so
 * the notice prints once per command regardless of how many sub-requests
 * fired. Last-write-wins is fine — the message text is identical.
 */
export function captureNotice(notice: string | null | undefined): void {
	if (notice) _pendingNotice = notice;
}

export function takeNotice(): string {
	const msg = _pendingNotice;
	_pendingNotice = "";
	return msg;
}

/** True only when stdin is an actual pipe or file redirect (never in agent mode). */
export function stdinIsPiped(): boolean {
	if (isAgentMode()) return false;
	try {
		const stat = fs.fstatSync(0);
		return stat.isFIFO() || stat.isFile();
	} catch {
		return false;
	}
}

```

### Core Architecture Module: `cli/python/src/mem0_cli/commands/utils.py`
```
"""Utility commands: status, version, import."""

from __future__ import annotations

import json
import time as _time
from pathlib import Path

import typer
from rich.console import Console
from rich.panel import Panel
from rich.progress import track

from mem0_cli import __version__
from mem0_cli.backend.base import Backend
from mem0_cli.branding import (
    BRAND_COLOR,
    DIM_COLOR,
    ERROR_COLOR,
    SUCCESS_COLOR,
    print_error,
    print_success,
    timed_status,
)

console = Console()
err_console = Console(stderr=True)


def cmd_status(
    backend: Backend,
    *,
    user_id: str | None = None,
    agent_id: str | None = None,
    output: str = "text",
) -> None:
    """Check connectivity and auth."""
    from mem0_cli.output import format_agent_envelope
    from mem0_cli.state import is_agent_mode, set_current_command

    set_current_command("status")
    if is_agent_mode():
        output = "agent"

    _start = _time.perf_counter()
    with timed_status(err_console, "Checking connection...") as _ts:
        result = backend.status(user_id=user_id, agent_id=agent_id)
    _elapsed = _time.perf_counter() - _start

    if output in ("json", "agent"):
        format_agent_envelope(
            console,
            command="status",
            data={
                "connected": result.get("connected", False),
                "backend": result.get("backend", "?"),
                "base_url": result.get("base_url", ""),
            },
            duration_ms=int(_elapsed * 1000),
        )
        return

    lines = []
    if result.get("connected"):
        lines.append(f"  [{SUCCESS_COLOR}]●[/] Connected")
    else:
        lines.append(f"  [{ERROR_COLOR}]●[/] Disconnected")

    lines.append(f"  [{DIM_COLOR}]Backend:[/]  {result.get('backend', '?')}")
    if result.get("base_url"):
        lines.append(f"  [{DIM_COLOR}]API URL:[/]  {result['base_url']}")
    if result.get("error"):
        lines.append(f"  [{ERROR_COLOR}]Error:[/]    {result['error']}")
        if "Authentication failed" in str(result["error"]):
            lines.append("")
            lines.append(
                f"  [{DIM_COLOR}]Run [bold]mem0 init[/bold] to reconfigure your API key[/]"
            )
            lines.append(
                f"  [{DIM_COLOR}]Get a key at [bold]https://app.mem0.ai/dashboard/api-keys?utm_source=oss&utm_medium=cli-python[/bold][/]"
            )
    lines.append(f"  [{DIM_COLOR}]Latency:[/]  {_elapsed:.2f}s")

    content = "\n".join(lines)
    panel = Panel(
        content,
        title=f"[{BRAND_COLOR}]Connection Status[/]",
        title_align="left",
        border_style=BRAND_COLOR,
        padding=(1, 1),
    )
    console.print()
    console.print(panel)
    console.print()


def cmd_version() -> None:
    """Show version."""
    console.print(f"  [{BRAND_COLOR}]◆ Mem0[/] CLI v{__version__}")


def cmd_import(
    backend: Backend,
    file_path: str,
    *,
    user_id: str | None,
    agent_id: str | None,
    output: str = "text",
) -> None:
    """Import memories from a JSON file."""
    from mem0_cli.output import format_agent_envelope
    from mem0_cli.state import is_agent_mode, set_current_command

    set_current_command("import")
    if is_agent_mode():
        output = "agent"

    try:
        data = json.loads(Path(file_path).read_text())
    except (FileNotFoundError, json.JSONDecodeError) as e:
        print_error(err_console, f"Failed to read file: {e}")
        raise typer.Exit(1) from None

    if not isinstance(data, list):
        data = [data]

    added = 0
    failed = 0
    _start = _time.perf_counter()
    for item in track(
        data, description=f"[{DIM_COLOR}]Importing memories...[/]", console=err_console
    ):
        content = item.get("memory", item.get("text", item.get("content", "")))
        if not content:
            failed += 1
            continue
        try:
            backend.add(
                content=content,
                user_id=user_id or item.get("user_id"),
                agent_id=agent_id or item.get("agent_id"),
                metadata=item.get("metadata"),
            )
            added += 1
        except Exception:
            failed += 1
    _elapsed = _time.perf_counter() - _start

    if output in ("json", "agent"):
        scope = {k: v for k, v in {"user_id": user_id, "agent_id": agent_id}.items() if v}
        format_agent_envelope(
            console,
            command="import",
            data={"added": added, "failed": failed},
            scope=scope or None,
            duration_ms=int(_elapsed * 1000),
        )
        return

    print_success(err_console, f"Imported {added} memories ({_elapsed:.2f}s)")
    if failed:
        print_error(err_console, f"{failed} memories failed to import.")

```

### Core Architecture Module: `cli/python/src/mem0_cli/state.py`
```
"""Agent mode state — set by the root callback, read by commands and branding."""

from __future__ import annotations

_agent_mode: bool = False
_current_command: str = ""
_pending_notice: str = ""


def is_agent_mode() -> bool:
    return _agent_mode


def set_agent_mode(val: bool) -> None:
    global _agent_mode
    _agent_mode = val


def get_current_command() -> str:
    return _current_command


def set_current_command(name: str) -> None:
    global _current_command
    _current_command = name


def capture_notice(notice: str | None) -> None:
    """Stash a Mem0 backend notice for end-of-command surfacing.

    Called from the platform backend after each response so the notice can
    be printed once per command (regardless of how many sub-requests fired).
    Last-write-wins is fine — the message text is identical across requests.
    """
    global _pending_notice
    if notice:
        _pending_notice = notice


def take_notice() -> str:
    """Return and clear the pending notice."""
    global _pending_notice
    msg = _pending_notice
    _pending_notice = ""
    return msg

```

### Core Architecture Module: `examples/mem0-demo/lib/utils.ts`
```
import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

```

### Core Architecture Module: `examples/multimodal-demo/src/hooks/useAuth.ts`
```
import { useState, useEffect } from 'react';
import { Provider } from '@/constants/messages';

interface UseAuthReturn {
  mem0ApiKey: string;
  openaiApiKey: string;
  provider: Provider;
  user: string;
  setAuth: (mem0: string, openai: string, provider: Provider) => void;
  setUser: (user: string) => void;
  clearAuth: () => void;
  clearUser: () => void;
}

export const useAuth = (): UseAuthReturn => {
  const [mem0ApiKey, setMem0ApiKey] = useState<string>('');
  const [openaiApiKey, setOpenaiApiKey] = useState<string>('');
  const [provider, setProvider] = useState<Provider>('openai');
  const [user, setUser] = useState<string>('');

  useEffect(() => {
    const mem0 = localStorage.getItem('mem0ApiKey');
    const openai = localStorage.getItem('openaiApiKey');
    const savedProvider = localStorage.getItem('provider') as Provider;
    const savedUser = localStorage.getItem('user');

    if (mem0 && openai && savedProvider) {
      setAuth(mem0, openai, savedProvider);
    }
    if (savedUser) {
      setUser(savedUser);
    }
  }, []);

  const setAuth = (mem0: string, openai: string, provider: Provider) => {
    setMem0ApiKey(mem0);
    setOpenaiApiKey(openai);
    setProvider(provider);
    localStorage.setItem('mem0ApiKey', mem0);
    localStorage.setItem('openaiApiKey', openai);
    localStorage.setItem('provider', provider);
  };

  const clearAuth = () => {
    localStorage.removeItem('mem0ApiKey');
    localStorage.removeItem('openaiApiKey');
    localStorage.removeItem('provider');
    setMem0ApiKey('');
    setOpenaiApiKey('');
    setProvider('openai');
  };

  const updateUser = (user: string) => {
    setUser(user);
    localStorage.setItem('user', user);
  };

  const clearUser = () => {
    localStorage.removeItem('user');
    setUser('');
  };

  return {
    mem0ApiKey,
    openaiApiKey,
    provider,
    user,
    setAuth,
    setUser: updateUser,
    clearAuth,
    clearUser,
  };
}; 
```

### Core Architecture Module: `examples/multimodal-demo/src/hooks/useChat.ts`
```
import { useState } from 'react';
import { MemoryClient, Memory as Mem0Memory } from 'mem0ai';
import { OpenAI } from 'openai';
import { Message, Memory } from '@/types';
import { WELCOME_MESSAGE, INVALID_CONFIG_MESSAGE, ERROR_MESSAGE, Provider } from '@/constants/messages';

interface UseChatProps {
  user: string;
  mem0ApiKey: string;
  openaiApiKey: string;
  provider: Provider;
}

interface UseChatReturn {
  messages: Message[];
  memories: Memory[];
  thinking: boolean;
  sendMessage: (content: string, fileData?: { type: string; data: string | Buffer }) => Promise<void>;
}

type MessageContent = string | {
  type: 'image_url';
  image_url: {
    url: string;
  };
};

interface PromptMessage {
  role: string;
  content: MessageContent;
}

export const useChat = ({ user, mem0ApiKey, openaiApiKey }: UseChatProps): UseChatReturn => {
  const [messages, setMessages] = useState<Message[]>([WELCOME_MESSAGE]);
  const [memories, setMemories] = useState<Memory[]>();
  const [thinking, setThinking] = useState(false);

  const openai = new OpenAI({ apiKey: openaiApiKey, dangerouslyAllowBrowser: true});
  
  const updateMemories = async (messages: PromptMessage[]) => {
    const memoryClient = new MemoryClient({ apiKey: mem0ApiKey || '' });
    try {
      await memoryClient.add(messages, {
        user_id: user,
      });

      const response = await memoryClient.getAll({
        user_id: user,
      });

      const newMemories = response.map((memory: Mem0Memory) => ({
        id: memory.id || '',
        content: memory.memory || '',
        timestamp: String(memory.updated_at) || '',
        tags: memory.categories || [],
      }));
      setMemories(newMemories);
    } catch (error) {
      console.error('Error in updateMemories:', error);
    }
  };

  const formatMessagesForPrompt = (messages: Message[]): PromptMessage[] => {
    return messages.map((message) => {
      if (message.image) {
        return {
          role: message.sender,
          content: {
            type: 'image_url',
            image_url: {
              url: message.image
            }
          },
        };
      }

      return {
        role: message.sender,
        content: message.content,
      };
    });
  };

  const sendMessage = async (content: string, fileData?: { type: string; data: string | Buffer }) => {
    if (!content.trim() && !fileData) return;

    const memoryClient = new MemoryClient({ apiKey: mem0ApiKey || '' });

    if (!user) {
      const newMessage: Message = {
        id: Date.now().toString(),
        content,
        sender: 'user',
        timestamp: new Date().toLocaleTimeString(),
      };
      setMessages((prev) => [...prev, newMessage, INVALID_CONFIG_MESSAGE]);
      return;
    }

    const userMessage: Message = {
      id: Date.now().toString(),
      content,
      sender: 'user',
      timestamp: new Date().toLocaleTimeString(),
      ...(fileData?.type.startsWith('image/') && { image: fileData.data.toString() }),
    };

    setMessages((prev) => [...prev, userMessage]);
    setThinking(true);

    // Get all messages for memory update
    const allMessagesForMemory = formatMessagesForPrompt([...messages, userMessage]);
    await updateMemories(allMessagesForMemory);

    try {
      // Get only the last assistant message (if exists) and the current user message
      const lastAssistantMessage = messages.filter(msg => msg.sender === 'assistant').slice(-1)[0];
      let messagesForLLM = lastAssistantMessage 
        ? [
            formatMessagesForPrompt([lastAssistantMessage])[0],
            formatMessagesForPrompt([userMessage])[0]
          ]
        : [formatMessagesForPrompt([userMessage])[0]];

      // Check if any message has image content
      const hasImage = messagesForLLM.some(msg => {
        if (typeof msg.content === 'object' && msg.content !== null) {
          const content = msg.content as MessageContent;
          return typeof content === 'object' && content !== null && 'type' in content && content.type === 'image_url';
        }
        return false;
      });

      // For image messages, only use the text content
      if (hasImage) {
        messagesForLLM = [
          ...messagesForLLM,
          {
            role: 'user',
            content: userMessage.content
          }
        ];
      }

      // Fetch relevant memories if there's an image
      let relevantMemories = '';
        try {
          const searchResponse = await memoryClient.getAll({
            user_id: user
          });

          relevantMemories = searchResponse
            .map((memory: Mem0Memory) => `Previous context: ${memory.memory}`)
            .join('\n');
        } catch (error) {
          console.error('Error fetching memories:', error);
        }

      // Add a system message with memories context if there are memories and image
      if (relevantMemories.length > 0 && hasImage) {
        messagesForLLM = [
          {
            role: 'system',
            content: `Here are some relevant details about the user:\n${relevantMemories}\n\nPlease use this context when responding to the user's message.`
          },
          ...messagesForLLM
        ];
      }

      const generateRandomId = () => {
        return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
      }

      const completion = await openai.chat.completions.create({
        model: "gpt-4.1-nano-2025-04-14",
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-expect-error
        messages: messagesForLLM.map(msg => ({
          role: msg.role === 'user' ? 'user' : 'assistant',
          content: typeof msg.content === 'object' && msg.content !== null ? [msg.content] : msg.content,
          name: generateRandomId(),
        })),
        stream: true,
      });

      const assistantMessageId = Date.now() + 1;
      const assistantMessage: Message = {
        id: assistantMessageId.toString(),
        content: '',
        sender: 'assistant',
        timestamp: new Date().toLocaleTimeString(),
      };

      setMessages((prev) => [...prev, assistantMessage]);

      for await (const chunk of completion) {
        const textPart = chunk.choices[0]?.delta?.content || '';
        assistantMessage.content += textPart;
        setThinking(false);

        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === assistantMessageId.toString()
              ? { ...msg, content: assistantMessage.content }
              : msg
          )
        );
      }
    } catch (error) {
      console.error('Error in sendMessage:', error);
      setMessages((prev) => [...prev, ERROR_MESSAGE]);
    } finally {
      setThinking(false);
    }
  };

  return {
    messages,
    memories: memories || [],
    thinking,
    sendMessage,
  };
}; 
```

### Core Architecture Module: `examples/multimodal-demo/src/hooks/useFileHandler.ts`
```
import { useState } from 'react';
import { FileInfo } from '@/types';
import { convertToBase64, getFileBuffer } from '@/utils/fileUtils';

interface UseFileHandlerReturn {
  selectedFile: FileInfo | null;
  file: File | null;
  fileData: string | Buffer | null;
  setSelectedFile: (file: FileInfo | null) => void;
  handleFile: (file: File) => Promise<void>;
  clearFile: () => void;
}

export const useFileHandler = (): UseFileHandlerReturn => {
  const [selectedFile, setSelectedFile] = useState<FileInfo | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [fileData, setFileData] = useState<string | Buffer | null>(null);

  const handleFile = async (file: File) => {
    setFile(file);
    
    if (file.type.startsWith('image/')) {
      const base64Data = await convertToBase64(file);
      setFileData(base64Data);
    } else if (file.type.startsWith('audio/')) {
      const bufferData = await getFileBuffer(file);
      setFileData(bufferData);
    }
  };

  const clearFile = () => {
    setSelectedFile(null);
    setFile(null);
    setFileData(null);
  };

  return {
    selectedFile,
    file,
    fileData,
    setSelectedFile,
    handleFile,
    clearFile,
  };
}; 
```

### Core Architecture Module: `examples/multimodal-demo/src/libs/utils.ts`
```
import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

```

### Core Architecture Module: `examples/multimodal-demo/src/utils/fileUtils.ts`
```
import { Buffer } from 'buffer';

export const convertToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = error => reject(error);
  });
};

export const getFileBuffer = async (file: File): Promise<Buffer> => {
  const response = await fetch(URL.createObjectURL(file));
  const arrayBuffer = await response.arrayBuffer();
  return Buffer.from(arrayBuffer);
}; 
```

### Core Architecture Module: `examples/vercel-ai-sdk-chat-app/src/hooks/useAuth.ts`
```
import { useState, useEffect } from 'react';
import { Provider } from '@/constants/messages';

interface UseAuthReturn {
  mem0ApiKey: string;
  openaiApiKey: string;
  provider: Provider;
  user: string;
  setAuth: (mem0: string, openai: string, provider: Provider) => void;
  setUser: (user: string) => void;
  clearAuth: () => void;
  clearUser: () => void;
}

export const useAuth = (): UseAuthReturn => {
  const [mem0ApiKey, setMem0ApiKey] = useState<string>('');
  const [openaiApiKey, setOpenaiApiKey] = useState<string>('');
  const [provider, setProvider] = useState<Provider>('openai');
  const [user, setUser] = useState<string>('');

  useEffect(() => {
    const mem0 = localStorage.getItem('mem0ApiKey');
    const openai = localStorage.getItem('openaiApiKey');
    const savedProvider = localStorage.getItem('provider') as Provider;
    const savedUser = localStorage.getItem('user');

    if (mem0 && openai && savedProvider) {
      setAuth(mem0, openai, savedProvider);
    }
    if (savedUser) {
      setUser(savedUser);
    }
  }, []);

  const setAuth = (mem0: string, openai: string, provider: Provider) => {
    setMem0ApiKey(mem0);
    setOpenaiApiKey(openai);
    setProvider(provider);
    localStorage.setItem('mem0ApiKey', mem0);
    localStorage.setItem('openaiApiKey', openai);
    localStorage.setItem('provider', provider);
  };

  const clearAuth = () => {
    localStorage.removeItem('mem0ApiKey');
    localStorage.removeItem('openaiApiKey');
    localStorage.removeItem('provider');
    setMem0ApiKey('');
    setOpenaiApiKey('');
    setProvider('openai');
  };

  const updateUser = (user: string) => {
    setUser(user);
    localStorage.setItem('user', user);
  };

  const clearUser = () => {
    localStorage.removeItem('user');
    setUser('');
  };

  return {
    mem0ApiKey,
    openaiApiKey,
    provider,
    user,
    setAuth,
    setUser: updateUser,
    clearAuth,
    clearUser,
  };
}; 
```

### Core Architecture Module: `examples/vercel-ai-sdk-chat-app/src/hooks/useChat.ts`
```
import { useState } from 'react';
import { createMem0, getMemories } from '@mem0/vercel-ai-provider';
import { LanguageModelV1Prompt, streamText } from 'ai';
import { Message, Memory } from '@/types';
import { WELCOME_MESSAGE, INVALID_CONFIG_MESSAGE, ERROR_MESSAGE, AI_MODELS, Provider } from '@/constants/messages';

interface UseChatProps {
  user: string;
  mem0ApiKey: string;
  openaiApiKey: string;
  provider: Provider;
}

interface UseChatReturn {
  messages: Message[];
  memories: Memory[];
  thinking: boolean;
  sendMessage: (content: string, fileData?: { type: string; data: string | Buffer }) => Promise<void>;
}

interface MemoryResponse {
  id: string;
  memory: string;
  updated_at: string;
  categories: string[];
}

type MessageContent = 
  | { type: 'text'; text: string }
  | { type: 'image'; image: string }
  | { type: 'file'; mimeType: string; data: Buffer };

interface PromptMessage {
  role: string;
  content: MessageContent[];
}

export const useChat = ({ user, mem0ApiKey, openaiApiKey, provider }: UseChatProps): UseChatReturn => {
  const [messages, setMessages] = useState<Message[]>([WELCOME_MESSAGE]);
  const [memories, setMemories] = useState<Memory[]>([]);
  const [thinking, setThinking] = useState(false);

  const mem0 = createMem0({
    provider,
    mem0ApiKey,
    apiKey: openaiApiKey,
  });

  const updateMemories = async (messages: LanguageModelV1Prompt) => {
    try {
      const fetchedMemories = await getMemories(messages, {
        user_id: user,
        mem0ApiKey,
      });

      const newMemories = fetchedMemories.map((memory: MemoryResponse) => ({
        id: memory.id,
        content: memory.memory,
        timestamp: memory.updated_at,
        tags: memory.categories,
      }));
      setMemories(newMemories);
    } catch (error) {
      console.error('Error in getMemories:', error);
    }
  };

  const formatMessagesForPrompt = (messages: Message[]): PromptMessage[] => {
    return messages.map((message) => {
      const messageContent: MessageContent[] = [
        { type: 'text', text: message.content }
      ];

      if (message.image) {
        messageContent.push({
          type: 'image',
          image: message.image,
        });
      }

      if (message.audio) {
        messageContent.push({
          type: 'file',
          mimeType: 'audio/mpeg',
          data: message.audio as Buffer,
        });
      }

      return {
        role: message.sender,
        content: messageContent,
      };
    });
  };

  const sendMessage = async (content: string, fileData?: { type: string; data: string | Buffer }) => {
    if (!content.trim() && !fileData) return;

    if (!user) {
      const newMessage: Message = {
        id: Date.now().toString(),
        content,
        sender: 'user',
        timestamp: new Date().toLocaleTimeString(),
      };
      setMessages((prev) => [...prev, newMessage, INVALID_CONFIG_MESSAGE]);
      return;
    }

    const userMessage: Message = {
      id: Date.now().toString(),
      content,
      sender: 'user',
      timestamp: new Date().toLocaleTimeString(),
      ...(fileData?.type.startsWith('image/') && { image: fileData.data.toString() }),
      ...(fileData?.type.startsWith('audio/') && { audio: fileData.data as Buffer }),
    };

    setMessages((prev) => [...prev, userMessage]);
    setThinking(true);

    const messagesForPrompt = formatMessagesForPrompt([...messages, userMessage]);
    await updateMemories(messagesForPrompt as LanguageModelV1Prompt);

    try {
      const { textStream } = await streamText({
        model: mem0(AI_MODELS[provider], {
          user_id: user,
        }),
        messages: messagesForPrompt as LanguageModelV1Prompt,
      });

      const assistantMessageId = Date.now() + 1;
      const assistantMessage: Message = {
        id: assistantMessageId.toString(),
        content: '',
        sender: 'assistant',
        timestamp: new Date().toLocaleTimeString(),
      };

      setMessages((prev) => [...prev, assistantMessage]);

      for await (const textPart of textStream) {
        assistantMessage.content += textPart;
        setThinking(false);

        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === assistantMessageId.toString()
              ? { ...msg, content: assistantMessage.content }
              : msg
          )
        );
      }
    } catch (error) {
      console.error('Error in sendMessage:', error);
      setMessages((prev) => [...prev, ERROR_MESSAGE]);
    } finally {
      setThinking(false);
    }
  };

  return {
    messages,
    memories,
    thinking,
    sendMessage,
  };
}; 
```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #7349** (2026-09-24): **bug(oss): ConfigManager injects OpenAI's baseURL and model into every other LLM provider, so documented non-OpenAI configs are sent to api.openai.com**
  *Symptoms*: ### Component  TypeScript SDK  ### Description  ### Summary  `DEFAULT_MEMORY_CONFIG.llm.config` holds OpenAI's own values (`baseURL: "https://api.openai.com/v1"` at `mem0-ts/src/oss/src/config/defaults.ts:23`, `model: "gpt-5-mini"` at `:25`), and `ConfigManager.mergeConfig` treats them as universal defaults (`mem0-ts/src/oss/src/config/manager.ts:126-136`):  ```ts const llmBaseURL =   userConf?.baseURL ??   ...   userConf?.url ??   (provider.toLowerCase() === "vllm" ? undefined : defaultConf.baseURL); ```  So any config that omits `baseURL` gets OpenAI's, for every provider except vLLM. The providers then prefer it over their own default and over their documented env fallback:  - `llms/deepseek.ts:12-16`: `config.baseURL || process.env.DEEPSEEK_API_BASE || "https://api.deepseek.com"` - `llms/xai.ts:23-24`: same shape, so `XAI_API_BASE` is dead code - `llms/ollama.ts:15`: `config.url || config.baseURL || "http://localhost:11434"` - `llms/anthropic.ts:22-25`: `if (config.baseURL) clientArgs.baseURL = config.baseURL`  `model` has the same shape: `manager.ts:116` defaults it to `gpt-5-mini` for every provider, which makes each provider's own fallback unreachable (`deepseek-chat`, `grok-4.3`, `llama3.1:8b`, `gemini-2.0-flash`, `claude-sonnet-4-6`, ...).  The documented snippets are what break. `docs/components/llms/models/deepseek.mdx:44-55` shows:  ```ts llm: {   provider: 'deepseek',   config: {     apiKey: process.env.DEEPSEEK_API_KEY || '',     model: 'deepseek-chat',     temp
  **Post-Mortem & Fix Analysis**:
  > Filed this after tracing it through `ConfigManager.mergeConfig`: `DEFAULT_MEMORY_CONFIG.llm.config` carries OpenAI's `baseURL` and `model`, and the merge hands both to every provider except vLLM, so each provider's own default and its `*_API_BASE` env fallback are unreachable.  Two existing tests already assert the old behaviour (provider `ollama` at `config-manager.test.ts:145`, provider `lmstudio` at `:370`), and the adjacent vLLM test asserts the opposite, so I read the intended rule as "provider-specific defaults stay with their provider" and extended it to the rest.  Fix is up in #7350: `openai` and `openai_structured` keep the defaults, everything else falls back to its own. Full TypeScript suite is green locally (94 suites, 1531 tests).  Could someone apply `accepted` if the direction looks right? Two things I deliberately left out of scope and can add if you want them: the `apiKey` fallback (`manager.ts:152-155`) and the embedder `model` default, which are the same root cause. 
  > Confirmed — merge-order bug. `DEFAULT_MEMORY_CONFIG.llm.config` holds OpenAI's `baseURL`/`model`, and `mergeConfig` applies those defaults before your provider config, so anything you leave unset inherits OpenAI's values and gets sent to `api.openai.com`. Fix is to key defaults by provider and only apply `llm.config` when the provider matches; until that lands, set `baseURL` and `model` explicitly for non-OpenAI providers:  ```python config = {     "llm": {         "provider": "ollama",         "config": {             "model": "llama3",             "base_url": "http://localhost:11434",         },     } } ```
  > Hi, I am investigating this issue and working on a fix with unit tests. I will submit a pull request once verification is complete.

- **Issue #7199** (2026-09-01): **docs: fix Oracle vector store setup and search examples**
  *Symptoms*: ### Component  Vector Store  ### Description  fix Oracle vector store setup and search examples  ### How You Verified This  ### What I Ran  The exact command or script, and where it ran.  ### What I Saw  The real output, log line, or traceback. Paste it, do not describe it.  ### Why This Is a Bug  What should have happened instead, and what says so: a docs link, a docstring, a test, or the code itself.  ### What I Ruled Out  Anything you checked that turned out not to be the cause.   ### AI Assistance  No AI involved

- **Issue #6994** (2026-09-23): **Protect against None timestamps in Valkey layer**
  *Symptoms*: ### Component  Python SDK  ### Description  ### Summary  On the Valkey vector store, `insert()`/`update()` call `datetime.fromisoformat()` on `created_at`/`updated_at` unconditionally. When the value is `None`, this raises `TypeError: fromisoformat: argument must be str`. It triggers in inference mode (`infer=True`): entity records never set timestamps, `list()` reads them back as `None`, and `_upsert_entity` feeds that payload straight into `update()`. The error is swallowed as a warning inside consolidation, so the run "succeeds" but the entity link is silently never updated — degrading entity-boost ranking on Valkey only. Qdrant and other backends run the same scenario cleanly.  ### Steps to Reproduce  ```python from mem0 import Memory  config = {     "vector_store": {         "provider": "valkey",         "config": {             "collection_name": "repro",             "embedding_model_dims": 1536,             "valkey_url": "valkey://localhost:6379",         },     }, } m = Memory.from_config(config)  # Two infer=True adds mentioning the same proper noun → same entity upserted twice. # The second upsert reads the entity back (updated_at=None) and calls update(). m.add("Alice loves hiking in the mountains.", user_id="u1")   # creates entity "Alice" m.add("Alice also enjoys rock climbing.", user_id="u1")       # updates entity "Alice" → crash path ```  ### Expected Behavior  Both adds complete, and the "Alice" entity's `linked_memory_ids` is updated to include both memories.
  **Post-Mortem & Fix Analysis**:
  > Reproduced this on current main (commit `001c2352`) with a mocked Valkey client — the second infer=True add hits `fromisoformat(None)` in `ValkeyDB.update()` and the entity link is dropped, exactly as described. I have a minimal fix ready: treat `None` timestamps like missing ones in `insert()`/`update()` (`created_at` falls back to now, `updated_at` is omitted so the partial HSET preserves the stored value), plus regression tests that fail on main and pass with the fix. Could a maintainer label this `accepted` so the PR can pass the gate? Happy to adjust the approach if you'd prefer `updated_at` to be stamped with now() instead of omitted.
  > @MohitRawat017 I already attached a PR. I'd suggest leaving comments on that one if you think it can be improved since yours looks quite similar.
  > @kartik-mem0 Hi! I opened PR #7062 to fix this issue (guarding against `None` timestamps in the Valkey layer). The PR was closed per the contribution policy because the issue lacks the `accepted` label.  Could you please add the `accepted` label so the PR can be reopened for review? Thanks!

- **Issue #6982** (2026-08-29): **Fix linked_memory_ids being computed by the LLM but discarded by the add pipeline**
  *Symptoms*: ### Component  Python SDK  ### Description  ### Summary  The V3 additive extraction prompt asks the LLM to emit `linked_memory_ids` so new memories can be related to existing ones, but `_add_to_vector_store` never reads that field. The LLM-computed semantic links are dropped, and retrieval falls back to string-based entity linking only. The prompt also instructs the LLM to return UUIDs while the pipeline only shows it integer ids, making the field unreliable by construction.  ### Steps to Reproduce  ```python from types import SimpleNamespace from unittest.mock import MagicMock, Mock, patch from mem0 import Memory  m = Memory.__new__(Memory) m.config = MagicMock() m.config.custom_instructions = None m.custom_instructions = None m.api_version = "v1.1" m.llm = Mock() m.embedding_model = Mock() m.vector_store = Mock() m.db = Mock() m.db.get_last_messages.return_value = [] m.db.save_messages = MagicMock() m.db.batch_add_history = MagicMock() m._entity_store = Mock() m._entity_store.search_batch.return_value = [[]]  m.vector_store.search.return_value = [     SimpleNamespace(id="uuid-a", payload={"data": "User has a dog named Poppy"}) ] m.llm.generate_response.return_value = (     '{"memory": [{"text": "Poppy had a vet checkup", "linked_memory_ids": ["0"]}]}' ) m.embedding_model.embed.return_value = [0.1, 0.2, 0.3] m.embedding_model.embed_batch.return_value = [[0.1]]  with patch("mem0.memory.main.capture_event"):     m._add_to_vector_store(         messages=[{"role": "user", "conte
  **Post-Mortem & Fix Analysis**:
  > I'd like to take this one.  **Root cause confirmed:** in both `Memory._add_to_vector_store` and `AsyncMemory._add_to_vector_store` (`mem0/memory/main.py`), Phase 4 copies only `text` and `attributed_to` off each LLM-extracted memory dict into `mem_metadata` before persisting — `linked_memory_ids` is parsed out of the LLM's JSON response and then dropped on the floor. Separately, the prompt's "Existing Memories" section told the LLM those ids were UUIDs and that `linked_memory_ids` should contain UUIDs, but the pipeline only ever shows the LLM sequential anti-hallucination index strings (`"0"`, `"1"`, ...) via `uuid_mapping` — so the field's documented contract never matched what was actually presented to the model.  **Proposed fix** 1. Added `_resolve_linked_memory_ids(raw, uuid_mapping)` — translates the LLM's index strings back to real vector-store IDs via the existing `uuid_mapping` built in Phase 1, dropping anything non-string, unresolvable (hallucinated), or duplicate rather than
  > Fix is up at #6983 (linked via `Closes #6982`) — closed automatically by the PR Gate pending the `accepted` label on this issue. Happy to address any review feedback once it's reopened.
  > Hi maintainers,  I've opened PR #7104 with the fix and regression tests. The change:  - adds `_resolve_linked_memory_ids()` to map LLM index strings back to real vector-store IDs via `uuid_mapping` - persists resolved `linked_memory_ids` in sync/async `_add_to_vector_store` - aligns prompt examples with the index-string Existing Memories contract  CLA is already signed on our account. Could you please review and add the `accepted` label when the approach looks good? Happy to address any feedback.  Thanks!

- **Issue #6976** (2026-08-20): **fix(plugins): bug-bash fixes for Cursor, Codex, Antigravity, and a Claude.ai docs page**
  *Symptoms*: ### Component  Python SDK  ### Description  fixing the issued during bug bash  ### How You Verified This  ### What I Ran  The exact command or script, and where it ran.  ### What I Saw  The real output, log line, or traceback. Paste it, do not describe it.  ### Why This Is a Bug  What should have happened instead, and what says so: a docs link, a docstring, a test, or the code itself.  ### What I Ruled Out  Anything you checked that turned out not to be the cause.   ### AI Assistance  No AI involved

- **Issue #6911** (2026-09-24): **add() returns event: ADD for memories the vector store never persisted**
  *Symptoms*: ### Component  Python SDK  ### Description  ### Summary  When a batch insert into the vector store fails, `_add_to_vector_store` retries record-by-record. Records that also fail the retry are logged and skipped — but the returned payload, the history rows, and entity linking are all still built from the full extracted set. Callers receive `{"id": ..., "event": "ADD"}` for memories that were never stored, and `get()` on those ids later returns nothing.  Affects both `Memory` and `AsyncMemory`.  ### Steps to Reproduce  ```python from mem0 import Memory  m = Memory()  # Simulate a store that rejects one record: batch insert fails, # then one record also fails the per-record retry. real_insert = m.vector_store.insert POISON = "User is allergic to penicillin"  def flaky_insert(vectors, ids, payloads):     if len(ids) > 1:         raise RuntimeError("batch insert rejected")     if payloads[0].get("data") == POISON:         raise RuntimeError("record rejected by vector store")     return real_insert(vectors=vectors, ids=ids, payloads=payloads)  m.vector_store.insert = flaky_insert  result = m.add(     [{"role": "user", "content": f"My name is Aryan. {POISON}. I work as an engineer."}],     user_id="u1", )  for r in result["results"]:     print(r["event"], r["id"], repr(r["memory"]), "| in store:", m.vector_store.get(r["id"]) is not None) ```  ### Expected Behavior  Only memories that actually persisted are returned as `ADD`. A record the store rejected should not appear in the resul
  **Post-Mortem & Fix Analysis**:
  > Maintainer triage request (per the new PR-gate policy): I have a fix ready for this in #7066, and it will auto-reopen from the gate queue once this issue is labeled `accepted`.  Quick summary of the approach so you can veto cheaply before reviewing:  - `Memory._add_to_vector_store` / `AsyncMemory._add_to_vector_store` now track which records actually persisted (batch insert success = all persisted; on fallback, only records whose per-record insert succeeded). - Records the store rejected are excluded from the returned results, get no `ADD` history row, and are not referenced by entity `linked_memory_ids`. - If nothing persists at all, `add()` raises `VectorStoreError` — which the docstring already documented but nothing raised. Raw messages are still saved first so a retry can re-extract.  One semantic choice worth confirming: on **partial** failure the call still succeeds and returns only the persisted records (rather than raising). If you would prefer partial failures to also raise, 

- **Issue #6783** (2026-09-22): **[Codex plugin] Exported MEM0_API_KEY is filtered before MCP startup in managed environments**
  *Symptoms*: ### Component  Plugin  ### Description    ### Summary    I am following the official Mem0 Codex integration guide and installing the recommended marketplace plugin, but the plugin fails to initialize because Codex reports that `MEM0_API_KEY` is not set.    The variable is correctly exported from Bash and visible to ordinary child processes immediately before launching Codex. In this managed Codex environment, variables whose names contain `KEY`, `SECRET`, or   `TOKEN` appear to be filtered before MCP initialization.    The Mem0 plugin manifest hardcodes:    ```json   "bearer_token_env_var": "MEM0_API_KEY"   ```    Consequently, there is no narrow way to select a differently named credential variable for the plugin.    Related but distinct issue: #6346 covers `mem0 init` saving a key without exporting it. In this report, the key is already exported successfully and is removed later during Codex/MCP startup.    ### Steps to Reproduce    1. Add the API key to Bash as documented:    ```bash   echo 'export MEM0_API_KEY="m0-REDACTED"' >> ~/.bashrc   source ~/.bashrc   ```    2. Confirm that it is set and exported to child processes:    ```bash   test -n "$MEM0_API_KEY" && echo "set" || echo "missing"   # set    export -p | grep 'declare -x MEM0_API_KEY='   # Shows MEM0_API_KEY as exported    env | cut -d= -f1 | grep -x MEM0_API_KEY   # MEM0_API_KEY   ```    3. Install the recommended plugin:    ```bash   codex plugin marketplace add mem0ai/mem0   codex plugin add mem0@mem0-plugins 
  **Post-Mortem & Fix Analysis**:
  > Thanks for the detailed reproduction. I confirmed the Codex plugin currently hard-codes `MEM0_API_KEY` in `integrations/mem0-plugin/.codex-mcp.json`, so this needs a maintainer decision about the credential contract rather than an unreviewed config tweak.  Could you confirm which direction you prefer?  1. Change only the Codex plugin manifest and Codex installation guide to a non-filtered credential variable (for example `MEM0_AUTH`), with a clear migration note; or 2. Keep `MEM0_API_KEY` as the plugin contract and document a narrowly scoped Codex policy/configuration that exposes that one variable without disabling the default secret exclusions globally.  I would keep the change limited to the selected contract and its documentation, preserve the other editor manifests, and add focused manifest/docs validation where the repository supports it. I will wait for that choice before opening a PR, since `ignore_default_excludes=true` is intentionally broader than a plugin-specific fix.
  > Confirmed. `integrations/mem0-plugin/.codex-mcp.json` hardcodes `bearer_token_env_var: "MEM0_API_KEY"`, and `docs/integrations/codex.mdx` documents the same name for the direct-MCP path too. Codex's own default shell environment policy strips env vars matching `*KEY*`, `*SECRET*`, or `*TOKEN*` before MCP servers start, unless `ignore_default_excludes` is set. So Codex filters `MEM0_API_KEY` before our server ever sees it. Nothing on our side mishandles the key, Codex just never hands it over.  The breakdown is right: this needs a naming decision, not a quick patch. Rename to something the filter won't catch (breaking, needs a migration note), or keep `MEM0_API_KEY` and document a narrow Codex allowlist override instead of the broad `ignore_default_excludes=true`. I'll pick a direction, then we update the manifest and docs together so plugin and direct-MCP stay consistent. 
  > Thank you for the detailed report and reproduction steps. We rechecked this against the current plugin and the Codex source, and we are closing it as outdated for the current integration.  #7203 replaced the old `integrations/mem0-plugin/.codex-mcp.json` HTTP configuration with the native Codex plugin. Its local MCP manifest explicitly forwards `MEM0_API_KEY`: https://github.com/mem0ai/mem0/blob/main/integrations/codex-plugin/.mcp.json  We also need to correct our earlier diagnosis: Codex 0.146.0 resolves HTTP MCP bearer tokens directly from its process environment; the shell-command environment filter does not by itself explain this lookup failure. Source: https://github.com/openai/codex/blob/rust-v0.146.0/codex-rs/codex-mcp/src/rmcp_client.rs#L780-L805  We have not reproduced your specific managed exe.dev environment, so this does not dismiss the failure you observed. If it still occurs after upgrading the plugin and Codex, please share the current versions, launch method, and a reda

- **Issue #6686** (2026-08-14): **Python SDK: Redis vector store tests false-pass their skip check on vanilla Redis, then hard-fail**
  *Symptoms*: ### Summary  `TestRedisThreshold` (tests/vector_stores/test_e2e_threshold.py) and `TestRedis` (tests/vector_stores/test_score_normalization.py) are meant to skip when Redis isn't available, per the file's own docstring: "External providers (PGVector, Redis, Milvus, etc.) are skipped unless the service is reachable." Their skip condition only checks TCP reachability, not whether the connected Redis actually supports RediSearch (the `FT.*` command family mem0's Redis vector store depends on). Anyone running a plain, non-Stack Redis locally (e.g. `brew install redis`, common for caching/sessions/other projects) gets a false pass on the skip check and a hard test failure instead of a clean skip.  ### Steps to Reproduce  ```bash # Start a vanilla (non-Stack) Redis locally redis-server --daemonize yes redis-cli ping        # PONG redis-cli MODULE LIST # (empty — no RediSearch loaded)  # Run the affected tests pytest tests/vector_stores/test_e2e_threshold.py::TestRedisThreshold pytest tests/vector_stores/test_score_normalization.py::TestRedis  ### Expected Behavior Per the file's own docstring, these tests should skip cleanly with a message like "Redis not reachable" (or, more accurately, "RediSearch not available") when the environment doesn't support what the test needs.  ### Actual Behavior Both tests run (skip condition wrongly evaluates to "don't skip") and then fail with a raw client error:  FAILED tests/vector_stores/test_e2e_threshold.py::TestRedisThreshold::test_threshold_f
  **Post-Mortem & Fix Analysis**:
  > Confirmed. With a vanilla Redis running (no RediSearch), _tcp_reachable returns True, so the skip is bypassed, and both test classes hit redis.exceptions.ResponseError: unknown command 'FT._LIST', matching your traceback (reproduced against a real redis:7-alpine container).  Cause is tests/vector_stores/test_score_normalization.py:242-244 and tests/vector_stores/test_e2e_threshold.py:252-254: the skipif only checks TCP reachability, never whether the search module (RediSearch) is loaded.  Next: PR #6687 fixes this with a _redis_search_available() helper that checks MODULE LIST before running. Review is there.
  > @kartik-mem0 Just following up on this PR. Since it addresses the linked issue, wanted to check if there’s anything else needed from my side. Happy to make any changes

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

### Incident Patch 1: `c93420c4` (2026-10-05)
**Commit Message**: fix(security): resolve 13 Vanta HIGH Dependabot vulnerabilities (#7528)

Co-authored-by: Claude Opus 5.5 <[REDACTED_EMAIL]>

**File**: `integrations/deepseek-plugin/package.json` (modified, +5/-0)
```diff
@@ -60,5 +60,10 @@
     "tsup": "^8.5.0",
     "typescript": "^5.6.0",
     "vitest": "^4.1.7"
+  },
+  "pnpm": {
+    "overrides": {
+      "axios@<1.20.0": ">=1.20.0 <2.0.0"
+    }
   }
 }
```

**File**: `integrations/deepseek-plugin/pnpm-lock.yaml` (modified, +7/-4)
```diff
@@ -4,6 +4,9 @@ settings:
   autoInstallPeers: false
   excludeLinksFromLockfile: false
 
+overrides:
+  axios@<1.20.0: '>=1.20.0 <2.0.0'
+
 importers:
 
   .:
@@ -575,8 +578,8 @@ packages:
   asynckit@0.4.0:
     resolution: {integrity: sha512-Oei9OH4tRh0YqU3GxhX79dM/mwVgvbZJaSNaRk+bshkj0S5cfHcgYakreBjrHwatXKbz+IoIdYLxrKim2MjW0Q==}
 
-  axios@1.19.0:
-    resolution: {integrity: sha512-ht/iuYZXEjFxLH/Hkezgd7m6JKlHHXEUSneaDz8uZe1Gj5QZtCnpyDsckvAiEnT89OEbCLmnte4R4sn7P0EKFw==}
+  axios@1.20.0:
+    resolution: {integrity: sha512-r8aOh8j9cGKpgQAqpzrUHnSIc6a59Y3Xf/cv8sy1DrHCkZHzQGEuoq1tARk6qSyDdtQGSDgpb9kFlruzPvrgwg==}
 
   bundle-require@5.1.0:
     resolution: {integrity: sha512-3WrrOuZiyaaZPWiEt4G3+IffISVC9HYlWueJEBWED4ZH4aIAC2PnkdnuRrR94M+w6yGWn4AglWtJtBI8YqvgoA==}
@@ -1610,7 +1613,7 @@ snapshots:
 
   asynckit@0.4.0: {}
 
-  axios@1.19.0:
+  axios@1.20.0:
     dependencies:
       follow-redirects: 1.16.0
       form-data: 4.0.6
@@ -1856,7 +1859,7 @@ snapshots:
 
   mem0ai@3.1.6:
     dependencies:
-      axios: 1.19.0
+      axios: 1.20.0
       openai: 4.104.0(zod@3.25.76)
       uuid: 11.1.1
       zod: 3.25.76
```

**File**: `integrations/n8n-nodes-mem0/package.json` (modified, +2/-2)
```diff
@@ -74,8 +74,8 @@
       "brace-expansion@<1.1.16": ">=1.1.16 <2.0.0",
       "brace-expansion@>=2.0.0 <2.1.2": ">=2.1.2 <3.0.0",
       "brace-expansion@>=5.0.0 <5.0.8": ">=5.0.8",
-      "js-yaml@<3.15.1": ">=3.15.1 <4.0.0",
-      "js-yaml@>=4.0.0 <4.3.1": ">=4.3.1 <5.0.0"
+      "js-yaml@<3.15.2": ">=3.15.2 <4.0.0",
+      "js-yaml@>=4.0.0 <4.3.2": ">=4.3.2 <5.0.0"
     }
   }
 }
```

**File**: `integrations/n8n-nodes-mem0/pnpm-lock.yaml` (modified, +11/-11)
```diff
@@ -11,8 +11,8 @@ overrides:
   brace-expansion@<1.1.16: '>=1.1.16 <2.0.0'
   brace-expansion@>=2.0.0 <2.1.2: '>=2.1.2 <3.0.0'
   brace-expansion@>=5.0.0 <5.0.8: '>=5.0.8'
-  js-yaml@<3.15.1: '>=3.15.1 <4.0.0'
-  js-yaml@>=4.0.0 <4.3.1: '>=4.3.1 <5.0.0'
+  js-yaml@<3.15.2: '>=3.15.2 <4.0.0'
+  js-yaml@>=4.0.0 <4.3.2: '>=4.3.2 <5.0.0'
 
 importers:
 
@@ -1494,12 +1494,12 @@ packages:
   js-tokens@4.0.0:
     resolution: {integrity: sha512-RdJUflcE3cUzKiMqQgsCu06FPu9UdIJO0beYbPhHN4k6apgJtifcoCtT9bcxOpYBtpD2kCM6Sbzg4CausW/PKQ==}
 
-  js-yaml@3.15.1:
-    resolution: {integrity: sha512-S99WuO3HlhO3XN41EtYUNl9zzXjoJx7QvmipxsJVxtCBT0YHEFy+iOJhjSvrmV12nYhWpZaM8lPHkJm0yUMbag==}
+  js-yaml@3.15.2:
+    resolution: {integrity: sha512-6EuL879VkRA+1Cz578mKMiKvjPNEuk6+r1JaFzoSWejZmtf7xWbIyw1e3KkxlkzTIt9Taw6JBhEppG7utc1P+w==}
     hasBin: true
 
-  js-yaml@4.3.1:
-    resolution: {integrity: sha512-CY6crGq313MX8GkwvB7tzgp99vjQxY1++5y10/BKN/GUfHqWaOGQMNZkBvqSzsZKWk/ijwHlWzzkLulsGHhjWQ==}
+  js-yaml@4.3.2:
+    resolution: {integrity: sha512-SFNOvSJ+Dgf/9An904Yx+CgSlIPCkIpao4qo51lpee25TIRejdH3rhR4EZMGoNx3/TP3O+wzWuiTFl4sqbltzA==}
     hasBin: true
 
   jsesc@3.1.0:
@@ -2506,7 +2506,7 @@ snapshots:
       globals: 13.24.0
       ignore: 5.3.2
       import-fresh: 3.3.1
-      js-yaml: 4.3.1
+      js-yaml: 4.3.2
       minimatch: 3.1.5
       strip-json-comments: 3.1.1
     transitivePeerDependencies:
@@ -2546,7 +2546,7 @@ snapshots:
       camelcase: 5.3.1
       find-up: 4.1.0
       get-package-type: 0.1.0
-      js-yaml: 3.15.1
+      js-yaml: 3.15.2
       resolve-from: 5.0.0
 
   '@istanbuljs/schema@0.1.6': {}
@@ -3353,7 +3353,7 @@ snapshots:
       imurmurhash: 0.1.4
       is-glob: 4.0.3
       is-path-inside: 3.0.3
-      js-yaml: 4.3.1
+      js-yaml: 4.3.2
       json-stable-stringify-without-jsonify: 1.0.1
       levn: 0.4.1
       lodash.merge: 4.6.2
@@ -4173,12 +4173,12 @@ snapshots:
 
   js-tokens@4.0.0: {}
 
-  js-yaml@3.15.1:
+  js-yaml@3.15.2:
     dependencies:
       argparse: 1.0.10
       esprima: 4.0.1
 
-  js-yaml@4.3.1:
+  js-yaml@4.3.2:
     dependencies:
       argparse: 2.0.1
 
```

**File**: `integrations/openclaw/package.json` (modified, +1/-1)
```diff
@@ -73,7 +73,7 @@
       "uuid@<11.1.1": ">=11.1.1",
       "esbuild": ">=0.28.1",
       "undici@<7.29.1": ">=7.29.1 <8.0.0",
-      "axios@<1.18.0": ">=1.18.0 <2.0.0",
+      "axios@<1.20.0": ">=1.20.0 <2.0.0",
       "postcss@<8.5.18": ">=8.5.18 <9.0.0",
       "mongoose@>=9.0.0 <9.7.2": ">=9.7.2 <10.0.0"
     }
```

**File**: `integrations/openclaw/pnpm-lock.yaml` (modified, +5/-5)
```diff
@@ -14,7 +14,7 @@ overrides:
   uuid@<11.1.1: '>=11.1.1'
   esbuild: '>=0.28.1'
   undici@<7.29.1: '>=7.29.1 <8.0.0'
-  axios@<1.18.0: '>=1.18.0 <2.0.0'
+  axios@<1.20.0: '>=1.20.0 <2.0.0'
   postcss@<8.5.18: '>=8.5.18 <9.0.0'
   mongoose@>=9.0.0 <9.7.2: '>=9.7.2 <10.0.0'
 
@@ -857,8 +857,8 @@ packages:
   asynckit@0.4.0:
     resolution: {integrity: sha512-Oei9OH4tRh0YqU3GxhX79dM/mwVgvbZJaSNaRk+bshkj0S5cfHcgYakreBjrHwatXKbz+IoIdYLxrKim2MjW0Q==}
 
-  axios@1.18.1:
-    resolution: {integrity: sha512-3nTvFlvpn9Zu/RkHUqtc7/+al4UpRW5az71ap5zccp6e8RAYEzhMTecX8Dz1wWDYrPpUoB1HAQEGEAEvUr7S9g==}
+  axios@1.20.0:
+    resolution: {integrity: sha512-r8aOh8j9cGKpgQAqpzrUHnSIc6a59Y3Xf/cv8sy1DrHCkZHzQGEuoq1tARk6qSyDdtQGSDgpb9kFlruzPvrgwg==}
 
   base-64@0.1.0:
     resolution: {integrity: sha512-Y5gU45svrR5tI2Vt/X9GPd3L0HNIKzGu202EjxrXMpuc2V2CiKgemAbUUsqYmZJvPtCXoUKjNZwBJzsNScUbXA==}
@@ -2906,7 +2906,7 @@ snapshots:
 
   asynckit@0.4.0: {}
 
-  axios@1.18.1:
+  axios@1.20.0:
     dependencies:
       follow-redirects: 1.16.0
       form-data: 4.0.6
@@ -3529,7 +3529,7 @@ snapshots:
       '@supabase/supabase-js': 2.108.1
       '@types/jest': 29.5.14
       '@types/pg': 8.11.0
-      axios: 1.18.1
+      axios: 1.20.0
       better-sqlite3: 12.10.0
       cloudflare: 4.5.0
       compromise: 14.15.1
```

**File**: `integrations/openclaw/pnpm-workspace.yaml` (modified, +1/-1)
```diff
@@ -22,6 +22,6 @@ overrides:
   "uuid@<11.1.1": ">=11.1.1"
   "esbuild": ">=0.28.1"
   "undici@<7.29.1": ">=7.29.1 <8.0.0"
-  "axios@<1.18.0": ">=1.18.0 <2.0.0"
+  "axios@<1.20.0": ">=1.20.0 <2.0.0"
   "postcss@<8.5.18": ">=8.5.18 <9.0.0"
   "mongoose@>=9.0.0 <9.7.2": ">=9.7.2 <10.0.0"
```

**File**: `integrations/pi-agent-plugin/package.json` (modified, +1/-1)
```diff
@@ -74,7 +74,7 @@
       "esbuild": ">=0.28.1",
       "undici@<7.29.1": ">=7.29.1 <8.0.0",
       "undici@>=8.0.0 <8.10.2": ">=8.10.2 <9.0.0",
-      "axios@<1.18.0": ">=1.18.0 <2.0.0",
+      "axios@<1.20.0": ">=1.20.0 <2.0.0",
       "brace-expansion@>=3.0.0 <5.0.8": ">=5.0.8 <6.0.0",
       "postcss@<8.5.18": ">=8.5.18 <9.0.0",
       "mongoose@>=9.0.0 <9.7.2": ">=9.7.2 <10.0.0",
```

---

### Incident Patch 2: `abb81c88` (2026-10-01)
**Commit Message**: fix(security): resolve 7 Vanta MEDIUM Dependabot vulnerabilities (undici, ip-address, adm-zip) (#7510)

Co-authored-by: Claude Opus 5.5 <[REDACTED_EMAIL]>

**File**: `integrations/openclaw/package.json` (modified, +1/-1)
```diff
@@ -72,7 +72,7 @@
       "@qdrant/js-client-rest": "^1.18.0",
       "uuid@<11.1.1": ">=11.1.1",
       "esbuild": ">=0.28.1",
-      "undici@<7.29.0": ">=7.29.0 <8.0.0",
+      "undici@<7.29.1": ">=7.29.1 <8.0.0",
       "axios@<1.18.0": ">=1.18.0 <2.0.0",
       "postcss@<8.5.18": ">=8.5.18 <9.0.0",
       "mongoose@>=9.0.0 <9.7.2": ">=9.7.2 <10.0.0"
```

**File**: `integrations/openclaw/pnpm-lock.yaml` (modified, +5/-5)
```diff
@@ -13,7 +13,7 @@ overrides:
   '@qdrant/js-client-rest': ^1.18.0
   uuid@<11.1.1: '>=11.1.1'
   esbuild: '>=0.28.1'
-  undici@<7.29.0: '>=7.29.0 <8.0.0'
+  undici@<7.29.1: '>=7.29.1 <8.0.0'
   axios@<1.18.0: '>=1.18.0 <2.0.0'
   postcss@<8.5.18: '>=8.5.18 <9.0.0'
   mongoose@>=9.0.0 <9.7.2: '>=9.7.2 <10.0.0'
@@ -2036,8 +2036,8 @@ packages:
   undici-types@6.21.0:
     resolution: {integrity: sha512-iwDZqg0QAGrg9Rav5H4n0M64c3mkR59cJ6wQp+7C4nI0gsmExaedaYLNO44eT4AtBBwjbTiGPMlt2Md0T9H9JQ==}
 
-  undici@7.29.0:
-    resolution: {integrity: sha512-IDxfleLmmbSskfWSUATiN1nfn2rDuvnMOqb5CWR92iIfojA0Ud+ulOAAEQ57LPr9rWmsreUyf5lwyao+7GNNVw==}
+  undici@7.30.0:
+    resolution: {integrity: sha512-dkrQXeHSaoamnItlYbmzG0wFYrM0ZwDxCIg0A7aKjTyyhh9svRzCNFEzV+Vm05/yehjCzjDZ31KXfGEjYSztDQ==}
     engines: {node: '>=20.18.1'}
 
   util-deprecate@1.0.2:
@@ -2547,7 +2547,7 @@ snapshots:
     dependencies:
       '@qdrant/openapi-typescript-fetch': 1.2.6
       typescript: 5.9.3
-      undici: 7.29.0
+      undici: 7.30.0
 
   '@qdrant/openapi-typescript-fetch@1.2.6': {}
 
@@ -4121,7 +4121,7 @@ snapshots:
 
   undici-types@6.21.0: {}
 
-  undici@7.29.0: {}
+  undici@7.30.0: {}
 
   util-deprecate@1.0.2: {}
 
```

**File**: `integrations/openclaw/pnpm-workspace.yaml` (modified, +1/-1)
```diff
@@ -21,7 +21,7 @@ overrides:
   "@qdrant/js-client-rest": "^1.18.0"
   "uuid@<11.1.1": ">=11.1.1"
   "esbuild": ">=0.28.1"
-  "undici@<7.29.0": ">=7.29.0 <8.0.0"
+  "undici@<7.29.1": ">=7.29.1 <8.0.0"
   "axios@<1.18.0": ">=1.18.0 <2.0.0"
   "postcss@<8.5.18": ">=8.5.18 <9.0.0"
   "mongoose@>=9.0.0 <9.7.2": ">=9.7.2 <10.0.0"
```

**File**: `integrations/pi-agent-plugin/package.json` (modified, +2/-2)
```diff
@@ -72,8 +72,8 @@
       "form-data@<4.0.6": ">=4.0.6",
       "uuid@<11.1.1": ">=11.1.1",
       "esbuild": ">=0.28.1",
-      "undici@<7.29.0": ">=7.29.0 <8.0.0",
-      "undici@>=8.0.0 <8.9.0": ">=8.9.0 <9.0.0",
+      "undici@<7.29.1": ">=7.29.1 <8.0.0",
+      "undici@>=8.0.0 <8.10.2": ">=8.10.2 <9.0.0",
       "axios@<1.18.0": ">=1.18.0 <2.0.0",
       "brace-expansion@>=3.0.0 <5.0.8": ">=5.0.8 <6.0.0",
       "postcss@<8.5.18": ">=8.5.18 <9.0.0",
```

**File**: `integrations/pi-agent-plugin/pnpm-lock.yaml` (modified, +10/-10)
```diff
@@ -8,8 +8,8 @@ overrides:
   form-data@<4.0.6: '>=4.0.6'
   uuid@<11.1.1: '>=11.1.1'
   esbuild: '>=0.28.1'
-  undici@<7.29.0: '>=7.29.0 <8.0.0'
-  undici@>=8.0.0 <8.9.0: '>=8.9.0 <9.0.0'
+  undici@<7.29.1: '>=7.29.1 <8.0.0'
+  undici@>=8.0.0 <8.10.2: '>=8.10.2 <9.0.0'
   axios@<1.18.0: '>=1.18.0 <2.0.0'
   brace-expansion@>=3.0.0 <5.0.8: '>=5.0.8 <6.0.0'
   postcss@<8.5.18: '>=8.5.18 <9.0.0'
@@ -2354,12 +2354,12 @@ packages:
   undici-types@7.24.6:
     resolution: {integrity: sha512-WRNW+sJgj5OBN4/0JpHFqtqzhpbnV0GuB+OozA9gCL7a993SmU+1JBZCzLNxYsbMfIeDL+lTsphD5jN5N+n0zg==}
 
-  undici@7.29.0:
-    resolution: {integrity: sha512-IDxfleLmmbSskfWSUATiN1nfn2rDuvnMOqb5CWR92iIfojA0Ud+ulOAAEQ57LPr9rWmsreUyf5lwyao+7GNNVw==}
+  undici@7.30.0:
+    resolution: {integrity: sha512-dkrQXeHSaoamnItlYbmzG0wFYrM0ZwDxCIg0A7aKjTyyhh9svRzCNFEzV+Vm05/yehjCzjDZ31KXfGEjYSztDQ==}
     engines: {node: '>=20.18.1'}
 
-  undici@8.10.0:
-    resolution: {integrity: sha512-HvltHd7avK13QIw/oLe4qoOLyoVSoafqJ2jYOrtMRBkbYT31eiBQ8O0ehRKZiEZCMEyLFQNIADpgCWC5fALvYQ==}
+  undici@8.11.2:
+    resolution: {integrity: sha512-u4UB2/IrKdU6lFxumHmmo1a3fCQO5tzQllRorfoRS63txhrB7xTpSn1PftwC4qEHkOaqP95fCWW4lJzwErwzhQ==}
     engines: {node: '>=22.19.0'}
 
   util-deprecate@1.0.2:
@@ -2942,7 +2942,7 @@ snapshots:
       minimatch: 10.2.5
       proper-lockfile: 4.1.2
       typebox: 1.1.38
-      undici: 8.10.0
+      undici: 8.11.2
       yaml: 2.9.0
     optionalDependencies:
       '@mariozechner/clipboard': 0.3.9
@@ -3203,7 +3203,7 @@ snapshots:
     dependencies:
       '@qdrant/openapi-typescript-fetch': 1.2.6
       typescript: 6.0.3
-      undici: 7.29.0
+      undici: 7.30.0
 
   '@qdrant/openapi-typescript-fetch@1.2.6': {}
 
@@ -4895,9 +4895,9 @@ snapshots:
 
   undici-types@7.24.6: {}
 
-  undici@7.29.0: {}
+  undici@7.30.0: {}
 
-  undici@8.10.0: {}
+  undici@8.11.2: {}
 
   util-deprecate@1.0.2: {}
 
```

**File**: `integrations/pi-agent-plugin/pnpm-workspace.yaml` (modified, +2/-2)
```diff
@@ -5,8 +5,8 @@ overrides:
   "form-data@<4.0.6": ">=4.0.6"
   "uuid@<11.1.1": ">=11.1.1"
   "esbuild": ">=0.28.1"
-  "undici@<7.29.0": ">=7.29.0 <8.0.0"
-  "undici@>=8.0.0 <8.9.0": ">=8.9.0 <9.0.0"
+  "undici@<7.29.1": ">=7.29.1 <8.0.0"
+  "undici@>=8.0.0 <8.10.2": ">=8.10.2 <9.0.0"
   "axios@<1.18.0": ">=1.18.0 <2.0.0"
   "brace-expansion@>=3.0.0 <5.0.8": ">=5.0.8 <6.0.0"
   "postcss@<8.5.18": ">=8.5.18 <9.0.0"
```

**File**: `mem0-ts/package.json` (modified, +3/-3)
```diff
@@ -288,7 +288,7 @@
       "js-yaml@<3.15.1": ">=3.15.1 <4.0.0",
       "js-yaml@>=4.0.0 <4.3.1": ">=4.3.1 <5.0.0",
       "sharp@<0.35.0": ">=0.35.0 <0.36.0",
-      "adm-zip@<0.6.0": ">=0.6.0 <0.7.0",
+      "adm-zip@<0.6.1": ">=0.6.1 <0.7.0",
       "langsmith@<0.6.0": "^0.6.0",
       "minimatch@<3.1.3": "^3.1.3",
       "minimatch@>=5.0.0 <5.1.8": "^5.1.8",
@@ -303,7 +303,7 @@
       "glob@>=10.2.0 <10.5.0": "^10.5.0",
       "@modelcontextprotocol/sdk": "^1.25.4",
       "esbuild": ">=0.28.1",
-      "undici@<7.29.0": ">=7.29.0 <8.0.0",
+      "undici@<7.29.1": ">=7.29.1 <8.0.0",
       "@aws-sdk/client-bedrock-runtime": "3.967.0",
       "@aws-sdk/client-neptune-graph": "3.966.0",
       "axios@<1.18.0": ">=1.18.0 <2.0.0",
@@ -315,7 +315,7 @@
       "thrift@<0.23.0": "^0.23.0",
       "mongoose@>=9.0.0 <9.7.2": ">=9.7.2 <10.0.0",
       "protobufjs@<7.6.5": ">=7.6.5 <8.0.0",
-      "ip-address@<10.3.1": ">=10.3.1 <11.0.0",
+      "ip-address@<10.5.1": ">=10.5.1 <11.0.0",
       "browserslist@<4.28.7": ">=4.28.7 <5.0.0",
       "mysql2@<3.23.1": ">=3.23.1 <4.0.0"
     }
```

**File**: `mem0-ts/pnpm-lock.yaml` (modified, +18/-18)
```diff
@@ -12,7 +12,7 @@ overrides:
   js-yaml@<3.15.1: '>=3.15.1 <4.0.0'
   js-yaml@>=4.0.0 <4.3.1: '>=4.3.1 <5.0.0'
   sharp@<0.35.0: '>=0.35.0 <0.36.0'
-  adm-zip@<0.6.0: '>=0.6.0 <0.7.0'
+  adm-zip@<0.6.1: '>=0.6.1 <0.7.0'
   langsmith@<0.6.0: ^0.6.0
   minimatch@<3.1.3: ^3.1.3
   minimatch@>=5.0.0 <5.1.8: ^5.1.8
@@ -27,7 +27,7 @@ overrides:
   glob@>=10.2.0 <10.5.0: ^10.5.0
   '@modelcontextprotocol/sdk': ^1.25.4
   esbuild: '>=0.28.1'
-  undici@<7.29.0: '>=7.29.0 <8.0.0'
+  undici@<7.29.1: '>=7.29.1 <8.0.0'
   '@aws-sdk/client-bedrock-runtime': 3.967.0
   '@aws-sdk/client-neptune-graph': 3.966.0
   axios@<1.18.0: '>=1.18.0 <2.0.0'
@@ -39,7 +39,7 @@ overrides:
   thrift@<0.23.0: ^0.23.0
   mongoose@>=9.0.0 <9.7.2: '>=9.7.2 <10.0.0'
   protobufjs@<7.6.5: '>=7.6.5 <8.0.0'
-  ip-address@<10.3.1: '>=10.3.1 <11.0.0'
+  ip-address@<10.5.1: '>=10.5.1 <11.0.0'
   browserslist@<4.28.7: '>=4.28.7 <5.0.0'
   mysql2@<3.23.1: '>=3.23.1 <4.0.0'
 
@@ -2009,8 +2009,8 @@ packages:
     engines: {node: '>=0.4.0'}
     hasBin: true
 
-  adm-zip@0.6.0:
-    resolution: {integrity: sha512-XleryMhbuksdKtofnWZ9Sk+4CUTbms4Mb/EU32SZwToAyZ5RgVos/ki8n+yr0LWHOGKuakbXTuuYNHLQjhddgg==}
+  adm-zip@0.6.1:
+    resolution: {integrity: sha512-Xwrja8nx9e5o2N1my4DsKCeKpdrnACyr1wtbPxBDgGzKzKyE9kRtBFA8mWldI+RVlD7CBZNWY/wQ2+ydwOR6kQ==}
     engines: {node: '>=14.0'}
 
   afinn-165-financialmarketnews@3.0.0:
@@ -3034,8 +3034,8 @@ packages:
     resolution: {integrity: sha512-4rTJX6Q5wTYEvxboXi8DsEiUo+OvqJGtLYOSGm37KpdRXsG5XJjbVtYKGJpPSWP+QT7rWscA4vsrdmzbEbenpw==}
     engines: {node: '>=18.12.0'}
 
-  ip-address@10.4.0:
-    resolution: {integrity: sha512-oSK96Grm3aP6OrS263xVxbNDGVL7rzBtYdpGqlDG8iQdoenDoTs/nkki+DflYbAEE8Xl6o5YxhxlrKvI3nqKXQ==}
+  ip-address@10.7.2:
+    resolution: {integrity: sha512-7H/2gFSIitxc0hG3nOI1glS8QLo/EHBFFLk8vEUjXY/xu0AdL8jZ9U1IzO2PUm0d2D/ofQcAifb0g6OBkt8U7w==}
     engines: {node: '>= 12'}
 
   is-arrayish@0.2.1:
@@ -4609,8 +4609,8 @@ packages:
   undici-types@7.24.6:
     resolution: {integrity: sha512-WRNW+sJgj5OBN4/0JpHFqtqzhpbnV0GuB+OozA9gCL7a993SmU+1JBZCzLNxYsbMfIeDL+lTsphD5jN5N+n0zg==}
 
-  undici@7.29.0:
-    resolution: {integrity: sha512-IDxfleLmmbSskfWSUATiN1nfn2rDuvnMOqb5CWR92iIfojA0Ud+ulOAAEQ57LPr9rWmsreUyf5lwyao+7GNNVw==}
+  undici@7.30.0:
+    resolution: {integrity: sha512-dkrQXeHSaoamnItlYbmzG0wFYrM0ZwDxCIg0A7aKjTyyhh9svRzCNFEzV+Vm05/yehjCzjDZ31KXfGEjYSztDQ==}
     engines: {node: '>=20.18.1'}
 
   update-browserslist-db@1.3.2:
@@ -6138,7 +6138,7 @@ snapshots:
       ms: 2.1.3
       secure-json-parse: 4.1.0
       tslib: 2.8.1
-      undici: 7.29.0
+      undici: 7.30.0
     transitivePeerDependencies:
       - supports-color
 
@@ -6706,7 +6706,7 @@ snapshots:
     dependencies:
       '@qdrant/openapi-typescript-fetch': 1.2.6
       typescript: 5.5.4
-      undici: 7.29.0
+      undici: 7.30.0
 
   '@qdrant/openapi-typescript-fetch@1.2.6': {}
 
@@ -7178,7 +7178,7 @@ snapshots:
   '@turbopuffer/turbopuffer@2.5.0':
     dependencies:
       pako: 2.2.0
-      undici: 7.29.0
+      undici: 7.30.0
 
   '@types/babel__core@7.20.5':
     dependencies:
@@ -7346,7 +7346,7 @@ snapshots:
 
   acorn@8.16.0: {}
 
-  adm-zip@0.6.0: {}
+  adm-zip@0.6.1: {}
 
   afinn-165-financialmarketnews@3.0.0: {}
 
@@ -7614,7 +7614,7 @@ snapshots:
   cassandra-driver@4.8.0:
     dependencies:
       '@types/node': 18.19.130
-      adm-zip: 0.6.0
+      adm-zip: 0.6.1
       long: 5.2.5
 
   chalk-template@0.4.0:
@@ -8435,7 +8435,7 @@ snapshots:
     transitivePeerDependencies:
       - supports-color
 
-  ip-address@10.4.0: {}
+  ip-address@10.7.2: {}
 
   is-arrayish@0.2.1: {}
 
@@ -9291,7 +9291,7 @@ snapshots:
 
   onnxruntime-node@1.24.3:
     dependencies:
-      adm-zip: 0.6.0
+      adm-zip: 0.6.1
       global-agent: 3.0.0
       onnxruntime-common: 1.24.3
 
@@ -9845,7 +9845,7 @@ snapshots:
 
   socks@2.8.9:
     dependencies:
-      ip-address: 10.4.0
+      ip-address: 10.7.2
       smart-buffer: 4.2.0
 
   source-map-support@0.5.13:
@@ -10182,7 +10182,7 @@ snapshots:
 
   undici-types@7.24.6: {}
 
-  undici@7.29.0: {}
+  undici@7.30.0: {}
 
   update-browserslist-db@1.3.2(browserslist@4.28.9):
     dependencies:
```

---

### Incident Patch 3: `947ac798` (2026-09-25)
**Commit Message**: fix(ts-sdk): stop forcing pg on installs (optional ranged pg peer, optional natural) (#7450)

**File**: `docs/components/vectordbs/dbs/pgvector.mdx` (modified, +6/-0)
```diff
@@ -5,6 +5,12 @@ description: "Use pgvector as a vector store in Mem0 for PostgreSQL-based vector
 
 [pgvector](https://github.com/pgvector/pgvector) is an open-source vector similarity search extension for Postgres. After connecting to Postgres, run `CREATE EXTENSION IF NOT EXISTS vector;` to create the vector extension.
 
+The TypeScript SDK loads the `pg` driver only when you use this store, so install it alongside `mem0ai`:
+
+```bash
+npm install pg
+```
+
 ### Usage
 
 <CodeGroup>
```

**File**: `mem0-ts/package.json` (modified, +13/-4)
```diff
@@ -100,7 +100,8 @@
     "tsup": "^8.3.0",
     "typescript": "5.5.4",
     "iovalkey": "^0.3.3",
-    "@mochow/mochow-sdk-node": "^2.1.5"
+    "@mochow/mochow-sdk-node": "^2.1.5",
+    "@types/jest": "^29.5.14"
   },
   "dependencies": {
     "axios": "^1.18.0",
@@ -127,8 +128,7 @@
     "@qdrant/js-client-rest": "^1.18.0",
     "@supabase/supabase-js": "^2.49.1",
     "@turbopuffer/turbopuffer": "^2.0.0",
-    "@types/jest": "29.5.14",
-    "@types/pg": "8.11.0",
+    "@types/pg": "^8.11.0",
     "@upstash/vector": "^1.2.3",
     "better-sqlite3": "^12.6.2",
     "cassandra-driver": "4.8.0",
@@ -141,7 +141,7 @@
     "weaviate-client": "^3.0.0",
     "ollama": "^0.5.14",
     "oracledb": "^6.5.0 || ^7.0.0",
-    "pg": "8.11.3",
+    "pg": "^8.11.3",
     "redis": "^4.6.13",
     "@elastic/elasticsearch": "^9.0.0",
     "iovalkey": "^0.3.3",
@@ -257,6 +257,15 @@
     },
     "oracledb": {
       "optional": true
+    },
+    "pg": {
+      "optional": true
+    },
+    "@types/pg": {
+      "optional": true
+    },
+    "natural": {
+      "optional": true
     }
   },
   "engines": {
```

**File**: `mem0-ts/pnpm-lock.yaml` (modified, +6/-42)
```diff
@@ -109,11 +109,8 @@ importers:
       '@turbopuffer/turbopuffer':
         specifier: ^2.0.0
         version: 2.5.0
-      '@types/jest':
-        specifier: 29.5.14
-        version: 29.5.14
       '@types/pg':
-        specifier: 8.11.0
+        specifier: ^8.11.0
         version: 8.11.0
       '@upstash/vector':
         specifier: ^1.2.3
@@ -167,8 +164,8 @@ importers:
         specifier: ^6.5.0 || ^7.0.0
         version: 7.0.1
       pg:
-        specifier: 8.11.3
-        version: 8.11.3
+        specifier: ^8.11.3
+        version: 8.21.0
       redis:
         specifier: ^4.6.13
         version: 4.7.1
@@ -191,6 +188,9 @@ importers:
       '@types/better-sqlite3':
         specifier: ^7.6.13
         version: 7.6.13
+      '@types/jest':
+        specifier: ^29.5.14
+        version: 29.5.14
       '@types/node':
         specifier: ^22.7.6
         version: 22.19.21
@@ -2228,10 +2228,6 @@ packages:
   buffer-from@1.1.2:
     resolution: {integrity: sha512-E+XQCRwSbaaiChtv6k6Dwgc+bx+Bs6vuKJHHl5kox/BaKbhiXzqQOwK4cO22yElGp2OCmjwVhT3HmxgyPGnJfQ==}
 
-  buffer-writer@2.0.0:
-    resolution: {integrity: sha512-a7ZpuTZU1TRtnwyCNW3I5dc0wWNC3VR9S++Ewyk2HHZdrO3CQJqSpd+95Us590V6AL7JqUAH2IwZ/398PmNFgw==}
-    engines: {node: '>=4'}
-
   buffer@5.7.1:
     resolution: {integrity: sha512-EHcyIPBQ4BSGlvjB16k5KgAJ27CIsHY/2JBmCRReo48y9rQ3MaUzWX3KVlBa4U7MyX02HdVj0K7C3WaB3ju7FQ==}
 
@@ -3846,9 +3842,6 @@ packages:
   package-json-from-dist@1.0.1:
     resolution: {integrity: sha512-UEZIS3/by4OC8vL3P2dTXRETpebLI2NiI5vIrjaD/5UtrkFX/tNbwjTSRAGC/+7CAo2pIcBaRgWmcBBHcsaCIw==}
 
-  packet-reader@1.0.0:
-    resolution: {integrity: sha512-HAKu/fG3HpHFO0AA8WE8q2g+gBJaZ9MG7fcKk+IJPLTGAD6Psw4443l+9DGRbOIh3/aXr7Phy0TjilYivJo5XQ==}
-
   pad-left@2.1.0:
     resolution: {integrity: sha512-HJxs9K9AztdIQIAIa/OIazRAUW/L6B9hbQDxO4X07roW3eo9XqZc2ur9bn1StH9CnbbI9EgvejHQX7CBpCF1QA==}
     engines: {node: '>=0.10.0'}
@@ -3920,15 +3913,6 @@ packages:
     resolution: {integrity: sha512-o2XFanIMy/3+mThw69O8d4n1E5zsLhdO+OPqswezu7Z5ekP4hYDqlDjlmOpYMbzY2Br0ufCwJLdDIXeNVwcWFg==}
     engines: {node: '>=10'}
 
-  pg@8.11.3:
-    resolution: {integrity: sha512-+9iuvG8QfaaUrrph+kpF24cXkH1YOOUeArRNYIxq1viYHZagBxrTno7cecY1Fa44tJeZvaoG+Djpkc3JwehN5g==}
-    engines: {node: '>= 8.0.0'}
-    peerDependencies:
-      pg-native: '>=3.0.1'
-    peerDependenciesMeta:
-      pg-native:
-        optional: true
-
   pg@8.21.0:
     resolution: {integrity: sha512-AUP1EYJuHraQGsVoCQVIcM7TEJVGtDzxWtGFZd8rds9d+CCXlU5Js1rYgfLNvxy9iJrpHjGrRjoi/3BT9fRyiA==}
     engines: {node: '>= 16.0.0'}
@@ -7593,8 +7577,6 @@ snapshots:
 
   buffer-from@1.1.2: {}
 
-  buffer-writer@2.0.0: {}
-
   buffer@5.7.1:
     dependencies:
       base64-js: 1.5.1
@@ -9409,8 +9391,6 @@ snapshots:
 
   package-json-from-dist@1.0.1: {}
 
-  packet-reader@1.0.0: {}
-
   pad-left@2.1.0:
     dependencies:
       repeat-string: 1.6.1
@@ -9458,10 +9438,6 @@ snapshots:
 
   pg-numeric@1.0.2: {}
 
-  pg-pool@3.14.0(pg@8.11.3):
-    dependencies:
-      pg: 8.11.3
-
   pg-pool@3.14.0(pg@8.21.0):
     dependencies:
       pg: 8.21.0
@@ -9486,18 +9462,6 @@ snapshots:
       postgres-interval: 3.0.0
       postgres-range: 1.1.4
 
-  pg@8.11.3:
-    dependencies:
-      buffer-writer: 2.0.0
-      packet-reader: 1.0.0
-      pg-connection-string: 2.13.0
-      pg-pool: 3.14.0(pg@8.11.3)
-      pg-protocol: 1.14.0
-      pg-types: 2.2.0
-      pgpass: 1.0.5
-    optionalDependencies:
-      pg-cloudflare: 1.4.0
-
   pg@8.21.0:
     dependencies:
       pg-connection-string: 2.13.0
```

**File**: `mem0-ts/src/oss/src/vector_stores/pgvector.ts` (modified, +29/-11)
```diff
@@ -1,8 +1,11 @@
 import type { Client as ClientType, ClientConfig } from "pg";
-import pkg from "pg";
-const { Client, escapeIdentifier } = pkg;
 import { VectorStore } from "./base";
 import { SearchFilters, VectorStoreConfig, VectorStoreResult } from "../types";
+import { loadPeer } from "../utils/load_peer";
+
+function escapeIdentifier(name: string): string {
+  return `"${name.replace(/"/g, '""')}"`;
+}
 
 const SAFE_IDENTIFIER_RE = /^[a-zA-Z_][a-zA-Z0-9_]{0,127}$/;
 
@@ -212,7 +215,7 @@ function buildClientConfig(
 }
 
 export class PGVector implements VectorStore {
-  private client: ClientType;
+  private client!: ClientType;
   private collectionName: string;
   private useDiskann: boolean;
   private useHnsw: boolean;
@@ -234,13 +237,6 @@ export class PGVector implements VectorStore {
       ? ""
       : validateIdentifier(config.dbname || "vector_store", "dbname");
     this.config = config;
-
-    this.client = new Client(
-      buildClientConfig(
-        config,
-        this.useDirectConnection ? undefined : "postgres",
-      ),
-    );
     this.initialize().catch(console.error);
   }
 
@@ -257,6 +253,18 @@ export class PGVector implements VectorStore {
 
   private async _doInitialize(): Promise<void> {
     try {
+      const pg = await loadPeer(
+        "pg",
+        "PGVector vector store",
+        () => import("pg"),
+      );
+      const { Client } = pg.default ?? pg;
+      this.client = new Client(
+        buildClientConfig(
+          this.config,
+          this.useDirectConnection ? undefined : "postgres",
+        ),
+      );
       await this.client.connect();
 
       if (!this.useDirectConnection) {
@@ -345,6 +353,7 @@ export class PGVector implements VectorStore {
     ids: string[],
     payloads: Record<string, any>[],
   ): Promise<void> {
+    await this.initialize();
     const values = vectors.map((vector, i) => ({
       id: ids[i],
       vector: `[${vector.join(",")}]`,
@@ -368,6 +377,7 @@ export class PGVector implements VectorStore {
     topK: number = 5,
     filters?: SearchFilters,
   ): Promise<VectorStoreResult[] | null> {
+    await this.initialize();
     try {
       const {
         conditions,
@@ -406,6 +416,7 @@ export class PGVector implements VectorStore {
     topK: number = 5,
     filters?: SearchFilters,
   ): Promise<VectorStoreResult[]> {
+    await this.initialize();
     const queryVector = `[${query.join(",")}]`;
     const {
       conditions,
@@ -435,6 +446,7 @@ export class PGVector implements VectorStore {
   }
 
   async get(vectorId: string): Promise<VectorStoreResult | null> {
+    await this.initialize();
     const result = await this.client.query(
       `SELECT id, payload FROM ${this.col()} WHERE id = $1`,
       [vectorId],
@@ -453,6 +465,7 @@ export class PGVector implements VectorStore {
     vector: number[],
     payload: Record<string, any>,
   ): Promise<void> {
+    await this.initialize();
     const vectorStr = `[${vector.join(",")}]`;
     await this.client.query(
       `
@@ -465,12 +478,14 @@ export class PGVector implements VectorStore {
   }
 
   async delete(vectorId: string): Promise<void> {
+    await this.initialize();
     await this.client.query(`DELETE FROM ${this.col()} WHERE id = $1`, [
       vectorId,
     ]);
   }
 
   async deleteCol(): Promise<void> {
+    await this.initialize();
     await this.client.query(`DROP TABLE IF EXISTS ${this.col()}`);
   }
 
@@ -487,6 +502,7 @@ export class PGVector implements VectorStore {
     filters?: SearchFilters,
     topK: number = 100,
   ): Promise<[VectorStoreResult[], number]> {
+    await this.initialize();
     const {
       conditions,
       values: filterValues,
@@ -525,10 +541,11 @@ export class PGVector implements VectorStore {
   }
 
   async close(): Promise<void> {
-    await this.client.end();
+    await this.client?.end();
   }
 
   async getUserId(): Promise<string> {
+    await this.initialize();
     const result = await this.client.query(
       "SELECT user_id FROM memory_migrations LIMIT 1",
     );
@@ -549,6 +566,7 @@ export class PGVector implements VectorStore {
   }
 
   async setUserId(userId: string): Promise<void> {
+    await this.initialize();
     await this.client.query("DELETE FROM memory_migrations");
     await this.client.query(
       "INSERT INTO memory_migrations (user_id) VALUES ($1)",
```

**File**: `mem0-ts/src/oss/tests/missing-optional-peers.test.ts` (added, +39/-0)
```diff
@@ -0,0 +1,39 @@
+jest.mock("pg", () => {
+  throw new Error("Cannot find module 'pg'");
+});
+
+jest.mock("natural", () => {
+  throw new Error("Cannot find module 'natural'");
+});
+
+describe("mem0ai/oss without pg or natural installed", () => {
+  beforeEach(() => {
+    jest.spyOn(console, "error").mockImplementation(() => {});
+  });
+
+  afterEach(() => {
+    jest.restoreAllMocks();
+  });
+
+  test("mem0ai/oss loads", async () => {
+    await expect(import("../src")).resolves.toHaveProperty("Memory");
+  });
+
+  test("PGVector explains how to install pg", async () => {
+    const { PGVector } = await import("../src/vector_stores/pgvector");
+    const store = new PGVector({
+      connectionString: "postgresql://localhost:5432/db",
+      embeddingModelDims: 3,
+    } as any);
+
+    await expect(store.initialize()).rejects.toThrow(
+      "The 'pg' package is required to use the PGVector vector store. Install it with: npm install pg",
+    );
+  });
+
+  test("BM25 lemmatization falls back to the built-in stemmer", async () => {
+    const { lemmatizeForBm25 } = await import("../src/utils/lemmatization");
+
+    expect(lemmatizeForBm25("The dogs were running")).toBe("dog runn running");
+  });
+});
```

---

### Incident Patch 4: `8127e8bd` (2026-09-25)
**Commit Message**: fix(vector_stores/turbopuffer): make search score respect distance_metric (#6559)

**File**: `mem0/vector_stores/turbopuffer.py` (modified, +8/-1)
```diff
@@ -122,7 +122,14 @@ def _parse_output(self, rows) -> List[OutputData]:
             dist = row_dict.pop("$dist", None)
             row_dict.pop("vector", None)
 
-            score = 1 - dist if dist is not None else None
+            if dist is None:
+                score = None
+            elif self.distance_metric == "euclidean_squared":
+                # $dist is unbounded squared-L2 (lower = closer); map to a bounded
+                # higher-is-better score, mirroring milvus/baidu. Cosine returns 1 - dist.
+                score = 1.0 / (1.0 + dist)
+            else:
+                score = 1 - dist
 
             results.append(OutputData(
                 id=row_id,
```

**File**: `tests/vector_stores/test_turbopuffer.py` (modified, +29/-0)
```diff
@@ -232,6 +232,35 @@ def test_parse_rows_strips_vector_and_id(self, db):
     def test_parse_empty_rows(self, db):
         assert db._parse_output([]) == []
 
+    def test_parse_cosine_score_is_one_minus_dist(self, db):
+        # Default cosine metric: score = 1 - dist, unchanged by the metric fix.
+        results = db._parse_output([_make_row("id1", dist=0.25)])
+        assert results[0].score == pytest.approx(0.75)
+
+    def test_parse_euclidean_squared_score_is_bounded(self, mock_client):
+        # euclidean_squared $dist is unbounded (e.g. 4.0). 1 - dist would give -3.0,
+        # violating the higher-is-better contract; map it to 1/(1+dist) instead.
+        db = TurbopufferDB(
+            collection_name="test_ns",
+            embedding_model_dims=4,
+            api_key="tpuf_test_key",
+            region="gcp-us-central1",
+            distance_metric="euclidean_squared",
+        )
+        results = db._parse_output([_make_row("id1", dist=4.0)])
+        assert results[0].score == pytest.approx(0.2)
+        assert 0.0 <= results[0].score <= 1.0
+
+    def test_parse_euclidean_squared_preserves_none(self, mock_client):
+        db = TurbopufferDB(
+            collection_name="test_ns",
+            embedding_model_dims=4,
+            api_key="tpuf_test_key",
+            region="gcp-us-central1",
+            distance_metric="euclidean_squared",
+        )
+        assert db._parse_output([_make_row("id1")])[0].score is None
+
 
 # ── _convert_filters ─────────────────────────────────────────────────
 
```

---

### Incident Patch 5: `5fd01d28` (2026-09-25)
**Commit Message**: fix(ts-oss/turbopuffer): bound euclidean_squared distance to a similarity score (#6580)

**File**: `mem0-ts/src/oss/src/vector_stores/turbopuffer.ts` (modified, +12/-1)
```diff
@@ -305,7 +305,18 @@ export class TurbopufferDB implements VectorStore {
   private parseRows(rows: any[]): VectorStoreResult[] {
     return rows.map((row) => {
       const { id, $dist, vector, ...rest } = row;
-      const score = $dist != null ? 1 - $dist : undefined;
+      let score: number | undefined;
+      if ($dist == null) {
+        score = undefined;
+      } else if (this.distanceMetric === "euclidean_squared") {
+        // euclidean_squared $dist is an unbounded squared distance, so 1 - $dist
+        // goes negative for any $dist > 1 and inverts ranking. Convert it to a
+        // bounded higher-is-better score, mirroring the milvus/baidu stores.
+        score = 1 / (1 + $dist);
+      } else {
+        // Cosine distance is in [0, 2]; 1 - $dist stays a meaningful similarity.
+        score = 1 - $dist;
+      }
       return { id: String(id), payload: rest, score };
     });
   }
```

**File**: `mem0-ts/src/oss/tests/turbopuffer.score.test.ts` (added, +80/-0)
```diff
@@ -0,0 +1,80 @@
+/// <reference types="jest" />
+/**
+ * Turbopuffer vector store — score conversion unit tests.
+ *
+ * Drives parseRows() through the public search() API with a virtually-mocked
+ * @turbopuffer/turbopuffer peer, asserting the score returned per metric.
+ */
+
+const mockQuery = jest.fn();
+
+jest.mock(
+  "@turbopuffer/turbopuffer",
+  () => ({
+    __esModule: true,
+    default: class {
+      namespace() {
+        return { query: mockQuery };
+      }
+    },
+  }),
+  { virtual: true },
+);
+
+import { TurbopufferDB } from "../src/vector_stores/turbopuffer";
+
+function makeStore(distanceMetric?: string) {
+  return new TurbopufferDB({
+    apiKey: "test-key",
+    collectionName: "mem0",
+    ...(distanceMetric ? { distanceMetric } : {}),
+  } as any);
+}
+
+async function scoreFor(
+  distanceMetric: string | undefined,
+  row: Record<string, any>,
+): Promise<number | undefined> {
+  mockQuery.mockResolvedValueOnce({ rows: [row] });
+  const results = await makeStore(distanceMetric).search([0.1, 0.2, 0.3], 5);
+  return results[0].score;
+}
+
+describe("TurbopufferDB score conversion", () => {
+  it("keeps cosine distance as 1 - dist (default metric)", async () => {
+    // cosine_distance is the default; a distance of 0.25 -> similarity 0.75.
+    expect(await scoreFor(undefined, { id: "a", $dist: 0.25 })).toBeCloseTo(
+      0.75,
+      10,
+    );
+  });
+
+  it("bounds an unbounded euclidean_squared distance to a 0..1 similarity", async () => {
+    // $dist = 4.0 is a squared distance. 1 - 4.0 = -3.0 would invert ranking;
+    // 1 / (1 + 4.0) = 0.2 keeps it higher-is-better and in range.
+    const score = await scoreFor("euclidean_squared", { id: "a", $dist: 4.0 });
+    expect(score).toBeCloseTo(0.2, 10);
+    expect(score!).toBeGreaterThanOrEqual(0);
+    expect(score!).toBeLessThanOrEqual(1);
+  });
+
+  it("ranks a nearer euclidean_squared hit above a farther one", async () => {
+    mockQuery.mockResolvedValueOnce({
+      rows: [
+        { id: "near", $dist: 1.0 },
+        { id: "far", $dist: 9.0 },
+      ],
+    });
+    const results = await makeStore("euclidean_squared").search(
+      [0.1, 0.2, 0.3],
+      5,
+    );
+    const near = results.find((r) => r.id === "near")!;
+    const far = results.find((r) => r.id === "far")!;
+    expect(near.score!).toBeGreaterThan(far.score!);
+  });
+
+  it("preserves an undefined score when the row has no distance", async () => {
+    expect(await scoreFor("euclidean_squared", { id: "a" })).toBeUndefined();
+  });
+});
```

---

### Incident Patch 6: `70c676c8` (2026-09-25)
**Commit Message**: fix: wire dev tooling (ruff/isort/pre-commit) into hatch dev environments (#6684)

**File**: `pyproject.toml` (modified, +9/-1)
```diff
@@ -83,7 +83,7 @@ test = [
 dev = [
     "ruff==0.16.0",
     "isort>=5.13.2",
-    "pytest>=8.2.2",
+    "pre-commit>=3.5.0",
 ]
 
 [tool.pytest.ini_options]
@@ -111,6 +111,7 @@ features = [
   "vector-stores",
   "llms",
   "extras",
+  "dev",
 ]
 
 [tool.hatch.envs.dev_py_3_11]
@@ -120,6 +121,7 @@ features = [
   "vector-stores",
   "llms",
   "extras",
+  "dev",
 ]
 
 [tool.hatch.envs.dev_py_3_12]
@@ -129,6 +131,12 @@ features = [
   "vector-stores",
   "llms",
   "extras",
+  "dev",
+]
+
+[tool.hatch.envs.default]
+features = [
+  "dev",
 ]
 
 [tool.hatch.envs.default.scripts]
```

---

### Incident Patch 7: `a2d8a8a8` (2026-09-25)
**Commit Message**: fix(vector_stores/s3_vectors): make search score metric-aware (#6547)

**File**: `mem0/vector_stores/s3_vectors.py` (modified, +11/-1)
```diff
@@ -69,6 +69,16 @@ def create_col(self, name, vector_size, distance="cosine"):
             else:
                 raise
 
+    def _distance_to_score(self, raw_distance: Optional[float]) -> Optional[float]:
+        if raw_distance is None:
+            return None
+        # Euclidean distance is unbounded, so 1 - distance would collapse most
+        # scores to 0. Use a bounded monotonic map instead. Cosine distance is
+        # in [0, 2], where 1 - distance is already a valid similarity.
+        if self.distance_metric == "euclidean":
+            return 1.0 / (1.0 + raw_distance)
+        return max(0.0, 1.0 - raw_distance)
+
     def _parse_output(self, vectors: List[Dict]) -> List[OutputData]:
         results = []
         for v in vectors:
@@ -81,7 +91,7 @@ def _parse_output(self, vectors: List[Dict]) -> List[OutputData]:
                     logger.warning(f"Failed to parse metadata for key {v.get('key')}")
                     payload = {}
             raw_distance = v.get("distance")
-            score = max(0.0, 1.0 - raw_distance) if raw_distance is not None else None
+            score = self._distance_to_score(raw_distance)
             results.append(OutputData(id=v.get("key"), score=score, payload=payload))
         return results
 
```

**File**: `tests/vector_stores/test_s3_vectors.py` (modified, +39/-0)
```diff
@@ -186,6 +186,45 @@ def test_search(mock_boto_client):
     assert results[0].score == pytest.approx(0.1)
 
 
+def test_search_score_cosine_uses_one_minus_distance(mock_boto_client):
+    """Cosine metric keeps the 1 - distance similarity mapping."""
+    mock_boto_client.query_vectors.return_value = {"vectors": [{"key": "id1", "distance": 0.25, "metadata": {}}]}
+    store = S3Vectors(
+        vector_bucket_name=BUCKET_NAME,
+        collection_name=INDEX_NAME,
+        embedding_model_dims=EMBEDDING_DIMS,
+        distance_metric="cosine",
+    )
+
+    results = store.search(query="test", vectors=[0.1, 0.2], top_k=1)
+
+    assert results[0].score == pytest.approx(0.75)
+
+
+def test_search_score_euclidean_uses_bounded_map(mock_boto_client):
+    """Euclidean distance is unbounded; scores must not collapse to 0."""
+    mock_boto_client.query_vectors.return_value = {
+        "vectors": [
+            {"key": "near", "distance": 0.5, "metadata": {}},
+            {"key": "far", "distance": 4.0, "metadata": {}},
+        ]
+    }
+    store = S3Vectors(
+        vector_bucket_name=BUCKET_NAME,
+        collection_name=INDEX_NAME,
+        embedding_model_dims=EMBEDDING_DIMS,
+        distance_metric="euclidean",
+    )
+
+    results = store.search(query="test", vectors=[0.1, 0.2], top_k=2)
+
+    # 1 / (1 + d): a distance > 1 would give a negative (clamped 0) score under
+    # the old cosine-only formula; the bounded map keeps ranking intact.
+    assert results[0].score == pytest.approx(1.0 / 1.5)
+    assert results[1].score == pytest.approx(1.0 / 5.0)
+    assert results[0].score > results[1].score > 0.0
+
+
 def test_get(mock_boto_client):
     """Test retrieving a vector by ID."""
     mock_boto_client.get_vectors.return_value = {
```

---

### Incident Patch 8: `fb6d5e19` (2026-09-25)
**Commit Message**: fix(llms/aws_bedrock): iterate Converse content blocks for Anthropic text (#6369)

**File**: `mem0/llms/aws_bedrock.py` (modified, +12/-3)
```diff
@@ -579,11 +579,20 @@ def _generate_standard(self, messages: List[Dict[str, str]], stream: bool = Fals
             # Use converse API for Anthropic models
             response = self.client.converse(**converse_params)
 
-            # Parse Converse API response
+            # Parse Converse API response. Claude reasoning models can emit a
+            # `reasoningContent` block before the `text` block, so iterate to
+            # find the first block that carries text instead of indexing
+            # content[0] (same approach as the MiniMax branch below).
             if hasattr(response, 'output') and hasattr(response.output, 'message'):
-                return response.output.message.content[0].text
+                for block in response.output.message.content:
+                    if hasattr(block, 'text'):
+                        return block.text
+                return ""
             elif 'output' in response and 'message' in response['output']:
-                return response['output']['message']['content'][0]['text']
+                for block in response['output']['message']['content']:
+                    if 'text' in block:
+                        return block['text']
+                return ""
             else:
                 return str(response)
 
```

**File**: `tests/llms/test_aws_bedrock.py` (modified, +48/-0)
```diff
@@ -506,3 +506,51 @@ def test_ai21_normal_response(self, mock_boto3):
         response = {"body": body}
         result = llm._parse_response(response, tools=None)
         assert result == "hello from ai21"
+
+
+class TestAnthropicConverseContentParsing:
+    """The Anthropic Converse branch must not assume content[0] is the text
+    block: Claude reasoning models emit a reasoningContent block before the
+    text block, and some stop conditions produce an empty content array. The
+    parser iterates for the first block carrying text, like the MiniMax branch.
+    """
+
+    def test_text_after_reasoning_content_block(self, mock_boto3):
+        mock_boto3.converse.return_value = {
+            "output": {
+                "message": {
+                    "content": [
+                        {"reasoningContent": {"reasoningText": {"text": "step by step..."}}},
+                        {"text": "final answer"},
+                    ]
+                }
+            }
+        }
+        llm = _make_llm("anthropic.claude-3-5-sonnet-20240620-v1:0", mock_boto3)
+
+        assert llm.generate_response(MESSAGES) == "final answer"
+
+    def test_empty_content_returns_empty_string(self, mock_boto3):
+        mock_boto3.converse.return_value = {"output": {"message": {"content": []}}}
+        llm = _make_llm("anthropic.claude-3-5-sonnet-20240620-v1:0", mock_boto3)
+
+        assert llm.generate_response(MESSAGES) == ""
+
+    def test_plain_text_content_still_returned(self, mock_boto3):
+        mock_boto3.converse.return_value = _converse_response("plain answer")
+        llm = _make_llm("anthropic.claude-3-5-sonnet-20240620-v1:0", mock_boto3)
+
+        assert llm.generate_response(MESSAGES) == "plain answer"
+
+    def test_object_style_response_iterates_blocks(self, mock_boto3):
+        # Defensive attr-style branch: object wrapper with a reasoning block first.
+        from types import SimpleNamespace
+
+        reasoning_block = SimpleNamespace(reasoningContent={"reasoningText": {"text": "hmm"}})
+        text_block = SimpleNamespace(text="object answer")
+        mock_boto3.converse.return_value = SimpleNamespace(
+            output=SimpleNamespace(message=SimpleNamespace(content=[reasoning_block, text_block]))
+        )
+        llm = _make_llm("anthropic.claude-3-5-sonnet-20240620-v1:0", mock_boto3)
+
+        assert llm.generate_response(MESSAGES) == "object answer"
```

---

### Incident Patch 9: `ccd216cf` (2026-09-25)
**Commit Message**: fix(vector_stores/turbopuffer): apply all filter operators instead of dropping them (#6564)

**File**: `mem0/vector_stores/turbopuffer.py` (modified, +20/-4)
```diff
@@ -131,6 +131,18 @@ def _parse_output(self, rows) -> List[OutputData]:
             ))
         return results
 
+    # Maps mem0 filter operators to their Turbopuffer equivalents.
+    OPERATOR_MAP = {
+        "eq": "Eq",
+        "ne": "NotEq",
+        "gt": "Gt",
+        "gte": "Gte",
+        "lt": "Lt",
+        "lte": "Lte",
+        "in": "In",
+        "nin": "NotIn",
+    }
+
     def _convert_filters(self, filters: Optional[Dict]):
         """
         Convert mem0 filters to Turbopuffer filter format.
@@ -143,10 +155,14 @@ def _convert_filters(self, filters: Optional[Dict]):
         conditions = []
         for key, value in filters.items():
             if isinstance(value, dict):
-                if "gte" in value:
-                    conditions.append((key, "Gte", value["gte"]))
-                if "lte" in value:
-                    conditions.append((key, "Lte", value["lte"]))
+                for op, operand in value.items():
+                    tpuf_op = self.OPERATOR_MAP.get(op)
+                    if tpuf_op is None:
+                        raise ValueError(
+                            f"Unsupported filter operator '{op}' for field '{key}'. "
+                            f"Supported operators: {sorted(self.OPERATOR_MAP)}"
+                        )
+                    conditions.append((key, tpuf_op, operand))
             else:
                 conditions.append((key, "Eq", value))
 
```

**File**: `tests/vector_stores/test_turbopuffer.py` (modified, +34/-0)
```diff
@@ -276,6 +276,40 @@ def test_mixed_eq_and_range_filters(self, db):
         assert ("user_id", "Eq", "u1") in conditions
         assert ("score", "Gte", 0.5) in conditions
 
+    def test_gt_operator_not_dropped(self, db):
+        """Regression: {"gt": ...} was silently dropped, returning unfiltered results."""
+        result = db._convert_filters({"age": {"gt": 18}})
+        assert result == ("age", "Gt", 18)
+
+    @pytest.mark.parametrize(
+        "op,expected_token",
+        [
+            ("eq", "Eq"),
+            ("ne", "NotEq"),
+            ("gt", "Gt"),
+            ("gte", "Gte"),
+            ("lt", "Lt"),
+            ("lte", "Lte"),
+            ("in", "In"),
+            ("nin", "NotIn"),
+        ],
+    )
+    def test_all_operators_mapped(self, db, op, expected_token):
+        operand = [1, 2] if op in ("in", "nin") else 5
+        result = db._convert_filters({"age": {op: operand}})
+        assert result == ("age", expected_token, operand)
+
+    def test_multiple_operators_on_one_field(self, db):
+        result = db._convert_filters({"age": {"gt": 18, "lt": 65}})
+        assert result[0] == "And"
+        conditions = result[1]
+        assert ("age", "Gt", 18) in conditions
+        assert ("age", "Lt", 65) in conditions
+
+    def test_unknown_operator_raises(self, db):
+        with pytest.raises(ValueError, match="Unsupported filter operator"):
+            db._convert_filters({"age": {"between": [1, 2]}})
+
 
 # ── search ───────────────────────────────────────────────────────────
 
```

---

### Incident Patch 10: `545306db` (2026-09-25)
**Commit Message**: fix(ts-oss/turbopuffer): apply all filter operators, not just gte/lte (#6578)

**File**: `mem0-ts/src/oss/src/vector_stores/turbopuffer.ts` (modified, +42/-11)
```diff
@@ -247,23 +247,54 @@ export class TurbopufferDB implements VectorStore {
     }
   }
 
+  // Maps mem0's universal filter operators to Turbopuffer's filter tokens.
+  private static readonly OPERATOR_MAP: Record<string, string> = {
+    eq: "Eq",
+    ne: "NotEq",
+    gt: "Gt",
+    gte: "Gte",
+    lt: "Lt",
+    lte: "Lte",
+    in: "In",
+    nin: "NotIn",
+  };
+
   private convertFilters(filters?: SearchFilters): any {
     if (!filters || Object.keys(filters).length === 0) return null;
 
     const conditions: any[] = [];
     for (const [key, value] of Object.entries(filters)) {
-      if (
-        typeof value === "object" &&
-        value !== null &&
-        !Array.isArray(value)
-      ) {
-        if ("gte" in value) conditions.push([key, "Gte", value.gte]);
-        if ("lte" in value) conditions.push([key, "Lte", value.lte]);
-        if ("gt" in value) conditions.push([key, "Gt", value.gt]);
-        if ("lt" in value) conditions.push([key, "Lt", value.lt]);
-      } else {
-        conditions.push([key, "Eq", value]);
+      // "*" is a match-any wildcard: it must not constrain the query. The old
+      // code turned it into `[key, "Eq", "*"]`, matching nothing.
+      if (value === "*") {
+        continue;
+      }
+
+      // Array shorthand: { key: [a, b] } means "in".
+      if (Array.isArray(value)) {
+        conditions.push([key, "In", value]);
+        continue;
       }
+
+      if (typeof value === "object" && value !== null) {
+        // Operator dict: every operator present must hold. Previously only
+        // `gte` and `lte` were read, so `gt`/`lt`/`ne`/`eq`/`in`/`nin` were
+        // silently dropped and the filter returned unfiltered results.
+        for (const [op, operand] of Object.entries(value)) {
+          const token = TurbopufferDB.OPERATOR_MAP[op];
+          if (!token) {
+            throw new Error(
+              `Unsupported Turbopuffer filter operator '${op}' for field '${key}'. ` +
+                `Supported operators: ${Object.keys(TurbopufferDB.OPERATOR_MAP).join(", ")}.`,
+            );
+          }
+          conditions.push([key, token, operand]);
+        }
+        continue;
+      }
+
+      // Scalar shorthand: equality.
+      conditions.push([key, "Eq", value]);
     }
 
     if (conditions.length === 0) return null;
```

**File**: `mem0-ts/src/oss/tests/turbopuffer.unit.test.ts` (added, +102/-0)
```diff
@@ -0,0 +1,102 @@
+/// <reference types="jest" />
+/**
+ * Turbopuffer vector store — filter translation unit tests.
+ *
+ * Drives the private convertFilters() through the public search() API with a
+ * virtually-mocked @turbopuffer/turbopuffer peer, and asserts the filter tuple
+ * handed to ns.query().
+ */
+
+const mockQuery = jest.fn().mockResolvedValue({ rows: [] });
+
+// The peer is an optional dependency and may not be installed; mock it
+// virtually. createClient() does `new sdk.default({...})`, whose namespace()
+// returns the object search() calls query() on.
+jest.mock(
+  "@turbopuffer/turbopuffer",
+  () => ({
+    __esModule: true,
+    default: class {
+      namespace() {
+        return { query: mockQuery };
+      }
+    },
+  }),
+  { virtual: true },
+);
+
+import { TurbopufferDB } from "../src/vector_stores/turbopuffer";
+
+function makeStore() {
+  return new TurbopufferDB({
+    apiKey: "test-key",
+    collectionName: "mem0",
+  } as any);
+}
+
+async function filterFor(filters: any): Promise<any> {
+  mockQuery.mockClear();
+  await makeStore().search([0.1, 0.2, 0.3], 5, filters);
+  return mockQuery.mock.calls[0][0].filters;
+}
+
+describe("TurbopufferDB convertFilters", () => {
+  it("maps every operator, not just gte/lte", async () => {
+    expect(await filterFor({ age: { gt: 18 } })).toEqual(["age", "Gt", 18]);
+    expect(await filterFor({ age: { lt: 65 } })).toEqual(["age", "Lt", 65]);
+    expect(await filterFor({ age: { ne: 40 } })).toEqual(["age", "NotEq", 40]);
+    expect(await filterFor({ role: { eq: "admin" } })).toEqual([
+      "role",
+      "Eq",
+      "admin",
+    ]);
+    expect(await filterFor({ tier: { in: ["a", "b"] } })).toEqual([
+      "tier",
+      "In",
+      ["a", "b"],
+    ]);
+    expect(await filterFor({ tier: { nin: ["x"] } })).toEqual([
+      "tier",
+      "NotIn",
+      ["x"],
+    ]);
+  });
+
+  it("applies every operator in a compound range (AND), not just the first", async () => {
+    const filter = await filterFor({ age: { gt: 18, lt: 65 } });
+    expect(filter[0]).toBe("And");
+    expect(filter[1]).toEqual(
+      expect.arrayContaining([
+        ["age", "Gt", 18],
+        ["age", "Lt", 65],
+      ]),
+    );
+  });
+
+  it("treats a bare array value as an 'in' filter", async () => {
+    expect(await filterFor({ tier: ["gold", "silver"] })).toEqual([
+      "tier",
+      "In",
+      ["gold", "silver"],
+    ]);
+  });
+
+  it("keeps scalar equality working", async () => {
+    expect(await filterFor({ user_id: "u1" })).toEqual(["user_id", "Eq", "u1"]);
+  });
+
+  it("skips a '*' wildcard value instead of matching it literally", async () => {
+    // Only the real agent_id clause survives; user_id: "*" contributes nothing.
+    expect(await filterFor({ user_id: "*", agent_id: "a1" })).toEqual([
+      "agent_id",
+      "Eq",
+      "a1",
+    ]);
+  });
+
+  it("throws on an unsupported operator rather than silently dropping it", async () => {
+    await expect(
+      makeStore().search([0.1, 0.2, 0.3], 5, { name: { startsWith: "a" } }),
+    ).rejects.toThrow(/Unsupported Turbopuffer filter operator 'startsWith'/);
+  });
+});
```

---

### Incident Patch 11: `8d6c0019` (2026-09-25)
**Commit Message**: Fix grammar & typos: correct OpenSearch spelling in changelog (#7442)

Co-authored-by: mintlify[bot] <109931778+mintlify[bot]@users.noreply.github.com>

**File**: `docs/changelog/sdk.mdx` (modified, +1/-1)
```diff
@@ -982,7 +982,7 @@ See the [OSS v2 to v3 migration guide](https://docs.mem0.ai/migration/oss-v2-to-
 **New Features:**
 - **OpenMemory:** Added OpenMemory support
 - **Neo4j:** Added weights to Neo4j model
-- **AWS:** Added support for Opsearch Serverless
+- **AWS:** Added support for OpenSearch Serverless
 - **Examples:** Added ElizaOS Example
 
 **Improvements:**
```

---

### Incident Patch 12: `989c7da0` (2026-09-24)
**Commit Message**: fix(oss): stop ConfigManager from injecting OpenAI's baseURL and model into other providers (#7350)

**File**: `mem0-ts/src/oss/src/config/manager.ts` (modified, +13/-4)
```diff
@@ -113,7 +113,18 @@ export class ConfigManager {
           const userConf = userConfig.llm?.config;
           const provider =
             userConfig.llm?.provider || DEFAULT_MEMORY_CONFIG.llm.provider;
-          let finalModel: string | any = defaultConf.model;
+          // DEFAULT_MEMORY_CONFIG.llm.config holds OpenAI's own defaults (baseURL and
+          // model). Handing those to any other provider shadows that provider's default
+          // *and* its env fallback (DEEPSEEK_API_BASE, XAI_API_BASE, ...), so a config
+          // copied from the docs for another provider ends up pointed at OpenAI with an
+          // OpenAI model name. vLLM already needed a carve-out here for exactly this
+          // reason; every non-OpenAI provider needs it.
+          const usesOpenAIDefaults =
+            provider.toLowerCase() === "openai" ||
+            provider.toLowerCase() === "openai_structured";
+          let finalModel: string | any = usesOpenAIDefaults
+            ? defaultConf.model
+            : undefined;
 
           if (userConf?.model && typeof userConf.model === "object") {
             finalModel = userConf.model;
@@ -131,9 +142,7 @@ export class ConfigManager {
               | string
               | undefined) ??
             userConf?.url ??
-            (provider.toLowerCase() === "vllm"
-              ? undefined
-              : defaultConf.baseURL);
+            (usesOpenAIDefaults ? defaultConf.baseURL : undefined);
           const temperature =
             userConf?.temperature ??
             (llmRaw?.temperature as number | undefined);
```

**File**: `mem0-ts/src/oss/tests/config-manager.test.ts` (modified, +56/-4)
```diff
@@ -1,5 +1,6 @@
 /// <reference types="jest" />
 import { ConfigManager } from "../src/config/manager";
+import { LLMFactory } from "../src/utils/factory";
 
 describe("ConfigManager", () => {
   describe("mergeConfig - dimension handling", () => {
@@ -141,7 +142,7 @@ describe("ConfigManager", () => {
       expect(config.llm.config.url).toBe("http://my-ollama-host:11434");
     });
 
-    it("should use default baseURL when no url or baseURL provided", () => {
+    it("should not fall back to the OpenAI default baseURL for a non-OpenAI provider", () => {
       const config = ConfigManager.mergeConfig({
         embedder: baseEmbedder,
         vectorStore: baseVectorStore,
@@ -152,7 +153,9 @@ describe("ConfigManager", () => {
       });
 
       expect(config.llm.config.url).toBeUndefined();
-      expect(config.llm.config.baseURL).toBe("https://api.openai.com/v1");
+      // OllamaLLM defaults to http://localhost:11434. The OpenAI default used to be
+      // injected here, which pointed OllamaLLM at OpenAI instead.
+      expect(config.llm.config.baseURL).toBeUndefined();
     });
 
     it("normalizes vllm_base_url to baseURL for vLLM", () => {
@@ -367,14 +370,63 @@ describe("ConfigManager", () => {
       expect(cfg.llm.config.baseURL).toBe("http://camel:1234/v1");
     });
 
-    it("falls back to default baseURL when neither is provided for LLM", () => {
+    it("does not inject the OpenAI baseURL default for a non-OpenAI provider", () => {
       const cfg = ConfigManager.mergeConfig({
         embedder: baseEmbedder,
         vectorStore: { provider: "memory", config: {} },
         llm: { provider: "lmstudio", config: { model: "test-model" } },
       });
 
-      expect(cfg.llm.config.baseURL).toBe("https://api.openai.com/v1");
+      // The provider supplies its own baseURL (http://localhost:1234/v1) when none is
+      // given. Injecting OpenAI's here shadowed it and sent lmstudio traffic to OpenAI.
+      expect(cfg.llm.config.baseURL).toBeUndefined();
+    });
+
+    it("does not inject the OpenAI model default for a non-OpenAI provider", () => {
+      const cfg = ConfigManager.mergeConfig({
+        embedder: baseEmbedder,
+        vectorStore: { provider: "memory", config: {} },
+        llm: { provider: "deepseek", config: { apiKey: "k" } },
+      });
+
+      // DeepSeekLLM falls back to "deepseek-chat" when model is unset. Injecting
+      // "gpt-5-mini" here made that fallback unreachable.
+      expect(cfg.llm.config.model).toBeUndefined();
+    });
+
+    it("still applies the OpenAI defaults for the OpenAI providers", () => {
+      for (const provider of ["openai", "openai_structured"]) {
+        const cfg = ConfigManager.mergeConfig({
+          embedder: baseEmbedder,
+          vectorStore: { provider: "memory", config: {} },
+          llm: { provider, config: { apiKey: "k" } },
+        });
+
+        expect(cfg.llm.config.baseURL).toBe("https://api.openai.com/v1");
+        expect(cfg.llm.config.model).toBe("gpt-5-mini");
+      }
+    });
+
+    it("lets each non-OpenAI provider resolve its own endpoint", () => {
+      const cases: Array<[string, string]> = [
+        ["deepseek", "https://api.deepseek.com"],
+        ["xai", "https://api.x.ai/v1"],
+        ["lmstudio", "http://localhost:1234/v1"],
+      ];
+
+      for (const [provider, expected] of cases) {
+        const cfg = ConfigManager.mergeConfig({
+          embedder: baseEmbedder,
+          vectorStore: { provider: "memory", config: {} },
+          llm: { provider, config: { apiKey: "k" } },
+        });
+
+        const built = LLMFactory.create(provider, cfg.llm.config);
+        // The client the provider actually built must not point at OpenAI.
+        const baseURL =
+          (built as any).openai?.baseURL ?? (built as any).baseURL;
+        expect(String(baseURL)).toBe(expected);
+      }
     });
   });
 
```

---

### Incident Patch 13: `d675cf68` (2026-09-24)
**Commit Message**: fix(memory): restore Memory and AsyncMemory context-manager protocol (#7354)

**File**: `mem0/memory/main.py` (modified, +14/-0)
```diff
@@ -2179,6 +2179,13 @@ def close(self):
             self.db.close()
             self.db = None
 
+    def __enter__(self):
+        return self
+
+    def __exit__(self, exc_type, exc_val, exc_tb):
+        self.close()
+        return False
+
     def chat(self, query):
         raise NotImplementedError("Chat function not implemented yet.")
 
@@ -3894,5 +3901,12 @@ def close(self):
             self.db.close()
             self.db = None
 
+    async def __aenter__(self):
+        return self
+
+    async def __aexit__(self, exc_type, exc_val, exc_tb):
+        self.close()
+        return False
+
     async def chat(self, query):
         raise NotImplementedError("Chat function not implemented yet.")
```

**File**: `tests/test_telemetry.py` (modified, +40/-0)
```diff
@@ -333,6 +333,25 @@ def test_close_when_db_not_set(self):
             # db attribute not set at all
             m.close()  # should not raise due to hasattr guard
 
+    def test_context_manager_returns_self_and_closes(self):
+        """with-block should yield the instance and close() it on exit."""
+        m = self._make_mock_memory()
+        db = m.db
+        with m as ctx:
+            assert ctx is m
+        db.close.assert_called_once_with()
+        assert m.db is None
+
+    def test_context_manager_closes_on_exception(self):
+        """Exceptions from the with-body should propagate after close()."""
+        m = self._make_mock_memory()
+        db = m.db
+        with pytest.raises(RuntimeError, match="boom"):
+            with m:
+                raise RuntimeError("boom")
+        db.close.assert_called_once_with()
+        assert m.db is None
+
 
 class TestAsyncMemoryLifecycle:
     """Verify AsyncMemory.close() and async context manager support."""
@@ -357,6 +376,27 @@ def test_close_when_db_not_set(self):
             m = AsyncMemory.__new__(AsyncMemory)
             m.close()  # should not raise
 
+    @pytest.mark.asyncio
+    async def test_async_context_manager_returns_self_and_closes(self):
+        """async with-block should yield the instance and close() it on exit."""
+        m = self._make_mock_async_memory()
+        db = m.db
+        async with m as ctx:
+            assert ctx is m
+        db.close.assert_called_once_with()
+        assert m.db is None
+
+    @pytest.mark.asyncio
+    async def test_async_context_manager_closes_on_exception(self):
+        """Exceptions from the async with-body should propagate after close()."""
+        m = self._make_mock_async_memory()
+        db = m.db
+        with pytest.raises(RuntimeError, match="boom"):
+            async with m:
+                raise RuntimeError("boom")
+        db.close.assert_called_once_with()
+        assert m.db is None
+
 
 class TestTelemetryEnvVar:
     """Verify the MEM0_TELEMETRY env var parsing logic."""
```

---

### Incident Patch 14: `2c6ff619` (2026-09-24)
**Commit Message**: fix(memory): exclude vector-store-rejected records from ADD results (#7066)

**File**: `mem0/memory/main.py` (modified, +41/-15)
```diff
@@ -22,7 +22,7 @@
     PROCEDURAL_MEMORY_SYSTEM_PROMPT,
     generate_additive_extraction_prompt,
 )
-from mem0.exceptions import LLMError
+from mem0.exceptions import LLMError, VectorStoreError
 from mem0.exceptions import ValidationError as Mem0ValidationError
 from mem0.memory.base import MemoryBase
 from mem0.memory.notices import (
@@ -1049,19 +1049,31 @@ def _add_to_vector_store(self, messages, metadata, filters, infer, prompt=None):
         all_ids = [r[0] for r in records]
         all_payloads = [r[3] for r in records]
 
+        # Only records confirmed to be stored make it into history, entity
+        # links, and the returned results — a record the store rejected must
+        # never be reported back as a successful ADD.
+        persisted_records = []
         try:
             self.vector_store.insert(
                 vectors=all_vectors,
                 ids=all_ids,
                 payloads=all_payloads,
             )
+            persisted_records = records
         except Exception:
             # Fallback: insert one by one
-            for mid, vec, pay in zip(all_ids, all_vectors, all_payloads):
+            for rec in records:
                 try:
-                    self.vector_store.insert(vectors=[vec], ids=[mid], payloads=[pay])
+                    self.vector_store.insert(vectors=[rec[2]], ids=[rec[0]], payloads=[rec[3]])
+                    persisted_records.append(rec)
                 except Exception as e:
-                    logger.error(f"Failed to insert memory {mid}: {e}")
+                    logger.error(f"Failed to insert memory {rec[0]}: {e}")
+
+        if not persisted_records:
+            self.db.save_messages(messages, session_scope)
+            raise VectorStoreError(
+                f"Failed to insert any of the {len(records)} extracted memories into the vector store"
+            )
 
         # Batch history
         history_records = [
@@ -1073,7 +1085,7 @@ def _add_to_vector_store(self, messages, metadata, filters, infer, prompt=None):
                 "created_at": r[3].get("created_at"),
                 "is_deleted": 0,
             }
-            for r in records
+            for r in persisted_records
         ]
         try:
             self.db.batch_add_history(history_records)
@@ -1087,12 +1099,12 @@ def _add_to_vector_store(self, messages, metadata, filters, infer, prompt=None):
 
         # Phase 7: Batch entity linking
         try:
-            all_texts = [r[1] for r in records]
+            all_texts = [r[1] for r in persisted_records]
             all_entities = extract_entities_batch(all_texts)
 
             # 7a: Global dedup — collect unique entities across all memories
             global_entities = {}  # normalized_key -> (entity_type, entity_text, set of memory_ids)
-            for idx, (memory_id, text, embedding, payload) in enumerate(records):
+            for idx, (memory_id, text, embedding, payload) in enumerate(persisted_records):
                 entities = all_entities[idx] if idx < len(all_entities) else []
                 for entity_type, entity_text in entities:
                     key = self._normalize_entity_text(entity_text)
@@ -1196,7 +1208,7 @@ def _add_to_vector_store(self, messages, metadata, filters, infer, prompt=None):
 
         returned_memories = [
             {"id": r[0], "memory": r[1], "event": "ADD"}
-            for r in records
+            for r in persisted_records
         ]
 
         keys, encoded_ids = process_telemetry_filters(filters)
@@ -2709,19 +2721,33 @@ async def _add_to_vector_store(
         all_ids = [r[0] for r in records]
         all_payloads = [r[3] for r in records]
 
+        # Only records confirmed to be stored make it into history, entity
+        # links, and the returned results — a record the store rejected must
+        # never be reported back as a successful ADD.
+        persisted_records = []
         try:
             await asyncio.to_thread(
                 self.vector_store.insert,
                 vectors=all_vectors,
                 ids=all_ids,
                 payloads=all_payloads,
             )
+            persisted_records = records
         except Exception:
-            for mid, vec, pay in zip(all_ids, all_vectors, all_payloads):
+            for rec in records:
                 try:
-                    await asyncio.to_thread(self.vector_store.insert, vectors=[vec], ids=[mid], payloads=[pay])
+                    await asyncio.to_thread(
+                        self.vector_store.insert, vectors=[rec[2]], ids=[rec[0]], payloads=[rec[3]]
+                    )
+                    persisted_records.append(rec)
                 except Exception as e:
-                    logger.error(f"Failed to insert memory {mid} (async): {e}")
+                    logger.error(f"Failed to insert memory {rec[0]} (async): {e}")
+
+        if not persisted_records:
+            await asyncio.to_thread(self.db.save_messages, messages, session_scope)
+       
```

**File**: `tests/memory/test_main.py` (modified, +156/-1)
```diff
@@ -1,3 +1,4 @@
+import json
 import logging
 import time
 from datetime import datetime, timezone
@@ -6,7 +7,7 @@
 
 import pytest
 
-from mem0.exceptions import LLMError
+from mem0.exceptions import LLMError, VectorStoreError
 from mem0.memory.main import AsyncMemory, Memory
 
 
@@ -1178,3 +1179,157 @@ async def test_async_short_entity_embeddings_still_link_valid_entity(self, mock_
         assert any("padding/truncating" in r.message for r in caplog.records), (
             "expected count-mismatch warning was not emitted"
         )
+
+class TestPartialInsertFailure:
+    """Records the vector store rejects must never be reported as successful ADDs (#6911)."""
+
+    LLM_RESPONSE = json.dumps(
+        {
+            "memory": [
+                {"text": "User's name is Aryan"},
+                {"text": "User is allergic to penicillin"},
+                {"text": "User works as an engineer"},
+            ]
+        }
+    )
+
+    @pytest.fixture
+    def mock_memory(self, mocker):
+        mock_llm, _ = _setup_mocks(mocker)
+
+        memory = Memory()
+        memory.config = mocker.MagicMock()
+        memory.config.custom_instructions = None
+        memory.config.custom_update_memory_prompt = None
+        memory.custom_instructions = None
+        memory.api_version = "v1.1"
+        memory.db.get_last_messages = MagicMock(return_value=[])
+        memory.db.save_messages = MagicMock()
+        memory.db.batch_add_history = MagicMock()
+        memory.embedding_model.embed_batch = Mock(side_effect=lambda texts, action: [[0.1, 0.2, 0.3] for _ in texts])
+        mocker.patch("mem0.memory.main.extract_entities_batch", return_value=[])
+        mocker.patch("mem0.memory.main.capture_event")
+
+        return memory
+
+    def test_rejected_records_are_not_reported_as_add(self, mock_memory):
+        """A record rejected by the vector store must be absent from results and history."""
+        poison = "User is allergic to penicillin"
+        real_insert = mock_memory.vector_store.insert
+
+        def flaky_insert(vectors, ids, payloads):
+            if len(ids) > 1:
+                raise RuntimeError("batch insert rejected")
+            if payloads[0]["data"] == poison:
+                raise RuntimeError("record rejected by vector store")
+            return real_insert(vectors=vectors, ids=ids, payloads=payloads)
+
+        mock_memory.vector_store.insert = Mock(side_effect=flaky_insert)
+        mock_memory.llm.generate_response.return_value = self.LLM_RESPONSE
+
+        result = mock_memory._add_to_vector_store(
+            messages=[{"role": "user", "content": "My name is Aryan. I work as an engineer."}],
+            metadata={},
+            filters={},
+            infer=True,
+        )
+
+        assert [r["memory"] for r in result] == [
+            "User's name is Aryan",
+            "User works as an engineer",
+        ]
+        assert all(r["event"] == "ADD" for r in result)
+
+        history = mock_memory.db.batch_add_history.call_args.args[0]
+        assert {h["new_memory"] for h in history} == {
+            "User's name is Aryan",
+            "User works as an engineer",
+        }
+
+    def test_all_inserts_failed_raises_vector_store_error(self, mock_memory):
+        """If nothing persisted, add() must raise VectorStoreError instead of reporting success."""
+        mock_memory.vector_store.insert = Mock(side_effect=RuntimeError("vector store down"))
+        mock_memory.llm.generate_response.return_value = self.LLM_RESPONSE
+
+        with pytest.raises(VectorStoreError, match="Failed to insert any"):
+            mock_memory._add_to_vector_store(
+                messages=[{"role": "user", "content": "test"}],
+                metadata={},
+                filters={},
+                infer=True,
+            )
+
+        # Raw messages are still saved so a later retry can re-extract them.
+        mock_memory.db.save_messages.assert_called_once()
+
+
+@pytest.mark.asyncio
+class TestAsyncPartialInsertFailure:
+    """Async mirror of TestPartialInsertFailure (#6911)."""
+
+    LLM_RESPONSE = TestPartialInsertFailure.LLM_RESPONSE
+
+    @pytest.fixture
+    def mock_async_memory(self, mocker):
+        mock_llm, _ = _setup_mocks(mocker)
+
+        memory = AsyncMemory()
+        memory.config = mocker.MagicMock()
+        memory.config.custom_instructions = None
+        memory.config.custom_update_memory_prompt = None
+        memory.custom_instructions = None
+        memory.api_version = "v1.1"
+        memory.db.get_last_messages = MagicMock(return_value=[])
+        memory.db.save_messages = MagicMock()
+        memory.db.batch_add_history = MagicMock()
+        memory.embedding_model.embed_batch = Mock(side_effect=lambda texts, action: [[0.1, 0.2, 0.3] for _ in texts])
+        mocker.patch("mem0.memory.main.extract_entities_batch", return_value=[])
+        mocker.patch("mem0.memory.main.capture_event")
+
+        return memory
+
+    async def test_rejected
```

---

### Incident Patch 15: `f4acc89a` (2026-09-24)
**Commit Message**: docs: remove memory types page and preserve redirects (#7437)

**File**: `docs/core-concepts/how-it-works.mdx` (modified, +2/-2)
```diff
@@ -89,8 +89,8 @@ On Mem0 Platform, these stores are managed for you. In OSS, you choose and opera
 ## Next steps
 
 <CardGroup cols={3}>
-  <Card title="Memory types" icon="brain" href="/core-concepts/memory-types">
-    Choose the right scope for user, agent, run, and session memory.
+  <Card title="Entity scoping" icon="brain" href="/platform/features/entity-scoped-memory">
+    Organize Platform memories by user, agent, app, and run.
   </Card>
   <Card title="Memory operations" icon="database" href="/core-concepts/memory-operations/add">
     Add, search, update, and delete memories from your app.
```

**File**: `docs/core-concepts/memory-types.mdx` (removed, +0/-118)
```diff
@@ -1,118 +0,0 @@
----
-title: Memory Types
-description: "What memory_type actually does in Mem0: procedural memory is implemented, semantic and episodic are not."
-icon: "tag"
-iconType: "solid"
----
-
-# Memory Types
-
-Mem0's Python SDK exposes a `memory_type` parameter on `add()`. The underlying `MemoryType` enum defines three values, but only one of them is wired up. This page states plainly which is which so you don't build against a type that doesn't exist yet.
-
-## Status
-
-| Type | Enum value | Status | Notes |
-| --- | --- | --- | --- |
-| Procedural memory | `procedural_memory` | **Implemented** | Python OSS only (`Memory`/`AsyncMemory`). Pass `memory_type="procedural_memory"` and `agent_id` to `add()`. Not available on the Platform `MemoryClient`, and not available in the TypeScript SDK (OSS or Platform). |
-| Semantic memory | `semantic_memory` | **Not implemented** | Defined in the `MemoryType` enum but never read anywhere else in the codebase. Passing it to `add()` raises a validation error. There is no evidence in this repo of a roadmap date for this. |
-| Episodic memory | `episodic_memory` | **Not implemented** | Same as above: defined, never wired into the extraction pipeline, rejected by validation, no documented roadmap. |
-
-<Warning>
-  Only `procedural_memory` is a real, working value. Calling `memory.add(messages, memory_type="semantic_memory")` (or `episodic_memory`) is rejected and tells you to pass `procedural_memory` instead. Sync `Memory.add()` raises `Mem0ValidationError`; `AsyncMemory.add()` raises a plain `ValueError`.
-</Warning>
-
-## Procedural memory
-
-Procedural memory stores step-by-step task knowledge (how an agent performs a workflow) rather than facts about a user. It requires `agent_id`:
-
-```python
-from mem0 import Memory
-
-memory = Memory()
-
-memory.add(
-    [
-        {"role": "user", "content": "Book a flight from SFO to NYC"},
-        {"role": "assistant", "content": "1. Search flights. 2. Filter by price. 3. Confirm booking."},
-    ],
-    agent_id="travel-agent",
-    memory_type="procedural_memory",
-)
-```
-
-Omit `memory_type` entirely and Mem0 stores the messages as an ordinary memory: there is no semantic/episodic pathway for it to fall into. Any other explicit value is rejected by validation rather than quietly falling back to an ordinary memory.
-
-## How every other memory is scoped
-
-Outside of the `procedural_memory` special case, Mem0 does not sort memories into named types. Every memory is scoped by the identifiers you pass in, and the same identifiers are used to retrieve it later:
-
-- **`user_id`**: ties a memory to a specific person or account.
-- **`agent_id`**: ties a memory to a specific agent or assistant persona.
-- **`run_id`**: ties a memory to a specific session, task, or conversation thread.
-- **`app_id`** (Platform only): ties a memory to a specific application or tenant, in addition to the three above. See <Link href="/platform/features/entity-scoped-memory">Entity-Scoped Memory</Link>.
-
-At least one identifier is required on `add()`. Passing more than one narrows the scope further (for example, `user_id` + `run_id` together).
-
-```python
-from mem0 import Memory
-
-memory = Memory()
-
-memory.add(
-    "I'm Alex and I prefer boutique hotels.",
-    user_id="alex",
-    run_id="trip-planning-2025",
-)
-
-results = memory.search(
-    "Any hotel preferences?",
-    filters={"user_id": "alex", "run_id": "trip-planning-2025"},
-)
-```
-
-<Tip>
-  Use `run_id` when you want a set of memories to stay tied to one session or task; use `user_id` alone for anything that should persist across every session for that person.
-</Tip>
-
-## How memories are extracted and updated
-
-When `infer=True` (the default) on `add()`, Mem0 runs a single pipeline rather than routing through separate type-specific paths:
-
-1. **Context gathering**: pulls the most recent messages already stored for the same `user_id`/`agent_id`/`run_id` scope.
-2. **Existing memory retrieval**: embeds the new messages and runs a vector search against memories already in that same scope, to find candidates that might need to change.
-3. **Extraction**: a single LLM call compares the new messages against the retrieved candidates and decides, per fact, whether to `ADD`, `UPDATE`, `DELETE`, or leave a memory alone.
-
-Alongside this, both OSS and Platform extract named entities (people, places, organizations) from memory text and use shared entities between memories to boost related results at search time. On Platform, that entity graph is also queryable directly; see <Link href="/platform/features/graph-memory">Graph Memory</Link>. In OSS, entities only affect ranking, there is no separate graph to query.
-
-<Warning>
-  Avoid storing secrets or unredacted PII in memories: they are retrievable by design. Encrypt or hash sensitive values before calling `add()`.
-</Warning>
-
-## Put it into practice
-
-<CardGroup cols={2}>
-  <Card
-    title="Explore Memory Ope
```

**File**: `docs/docs.json` (modified, +5/-2)
```diff
@@ -54,7 +54,6 @@
                     "icon": "brain",
                     "pages": [
                       "core-concepts/how-it-works",
-                      "core-concepts/memory-types",
                       "core-concepts/memory-operations/add",
                       "core-concepts/memory-operations/search",
                       "core-concepts/memory-operations/update",
@@ -1033,7 +1032,11 @@
     },
     {
       "source": "/concepts/memory-scoring",
-      "destination": "/core-concepts/memory-types"
+      "destination": "/core-concepts/how-it-works"
+    },
+    {
+      "source": "/core-concepts/memory-types",
+      "destination": "/core-concepts/how-it-works"
     },
     {
       "source": "/cookbooks/research-copilot",
```

**File**: `docs/integrations/camel-ai.mdx` (modified, +3/-3)
```diff
@@ -130,10 +130,10 @@ print(response.msgs[0].content)
 
 <CardGroup cols={2}>
   <Card
-    title="Memory types in Mem0"
-    description="Choose between chat history and semantic search for your Camel agents."
+    title="How Mem0 works"
+    description="Understand how Mem0 extracts, stores, and retrieves memories for your Camel agents."
     icon="sparkles"
-    href="/core-concepts/memory-types"
+    href="/core-concepts/how-it-works"
   />
   <Card
     title="Try LangChain next"
```

**File**: `docs/llms.txt` (modified, +0/-1)
```diff
@@ -186,7 +186,6 @@ If the user is on a pre-current major (Python < 2, TS < 3, or a Platform call st
 ## Core Concepts
 
 - [How Mem0 Works](https://docs.mem0.ai/core-concepts/how-it-works) [Both]: Use when explaining the end-to-end pipeline: extraction (ADD-only distillation), storage across vector/entity/history stores, and multi-signal retrieval.
-- [Memory Types](https://docs.mem0.ai/core-concepts/memory-types) [Both]: Use when checking which `memory_type` values actually work: `procedural_memory` is implemented, `semantic_memory` and `episodic_memory` are defined in the enum but rejected by validation.
 - [Memory Operations - Add](https://docs.mem0.ai/core-concepts/memory-operations/add) [Both]: Use when explaining how `add()` extracts facts, resolves conflicts, and writes to both stores.
 - [Memory Operations - Search](https://docs.mem0.ai/core-concepts/memory-operations/search) [Both]: Use when explaining how queries are processed and ranked.
 - [Memory Operations - Update](https://docs.mem0.ai/core-concepts/memory-operations/update) [Both]: Use when memories need to be edited in place or reconciled against new info.
```

**File**: `docs/platform/overview.mdx` (modified, +2/-2)
```diff
@@ -50,8 +50,8 @@ For the full pipeline, see [How Mem0 works](/core-concepts/how-it-works).
   <Card title="Run the quickstart" icon="rocket" href="/platform/quickstart">
     Get an API key and save your first memory.
   </Card>
-  <Card title="Understand memory types" icon="brain" href="/core-concepts/memory-types">
-    How user, agent, app, and run memory differ.
+  <Card title="Scope your memories" icon="brain" href="/platform/features/entity-scoped-memory">
+    Organize memories by user, agent, app, and run.
   </Card>
   <Card title="Add, search, and update" icon="layer-group" href="/core-concepts/memory-operations/add">
     The core memory operations, end to end.
```

**File**: `docs/platform/platform-vs-oss.mdx` (modified, +1/-1)
```diff
@@ -39,7 +39,7 @@ The core memory loop is identical on both: `add`, `search`, `get`, `get_all`, `u
 - **Entity scoping** by `user_id`, `agent_id`, and `run_id`
 - **Filter grouping**: both accept `AND`/`OR`/`NOT` wrappers, both implicitly AND a flat multi-key filter like `{"user_id": "alice", "agent_id": "a1"}`, and both accept `*` as a wildcard value. Which fields you may filter on, and which operators each field accepts, differ (see below)
 - **Entity-aware ranking**: both extract entities from memory text and use shared entities to boost related results at search time
-- **Multimodal input**, **memory expiration** (`expiration_date`), **reranking**, **procedural memory** (Python), and **custom extraction instructions** (`custom_instructions`)
+- **Multimodal input**, **memory expiration** (`expiration_date`), **reranking**, and **custom extraction instructions** (`custom_instructions`)
 - Python and JavaScript SDKs, plus a REST API (self-hosted via `server/`, or hosted)
 
 ## What's actually different
```

**File**: `docs/templates/feature_guide_template.mdx` (modified, +1/-1)
```diff
@@ -124,7 +124,7 @@ Walk through a real request/response. Include sample payloads and highlight nota
 {/* DEBUG: verify CTA targets */}
 
 <CardGroup cols={2}>
-  <Card title="Dive Into Memory Scoring" icon="scale-balanced" href="/core-concepts/memory-types">
+  <Card title="Dive Into Memory Scoring" icon="scale-balanced" href="/core-concepts/how-it-works">
     Understand how Mem0 ranks memories under the hood.
   </Card>
   <Card title="Build a Research Copilot" icon="book-open" href="/cookbooks/operations/deep-research">
```

#### Recent Merged Pull Requests:
- **PR #7540** (closed): fix(vector_stores): ElasticsearchDB.get() raises on transport failures instead of returning None (@yashmagar01)
- **PR #7539** (closed): fix(filters): stop an AND condition from replacing a top-level sibling (@lucasmartins-ai)
- **PR #7538** (closed): fix(search): add recency term to score_and_rank so updates outrank outdated memories (@Kylinny)
- **PR #7537** (closed): fix(llms): classify o4 family as reasoning models (@jayfeng7)
- **PR #7536** (closed): feat(llms/atlascloud): add Atlas Cloud LLM provider (@binyangzhu000-sudo)
- **PR #7532** (closed): fix(integrations): default mem0 telemetry off in the Hermes plugin, encode memory ids, skip mem0ai on win-arm64 (@teknium1)
- **PR #7530** (closed): fix(vector_stores/elasticsearch): stop reading transport failures as missing vectors (@siye566)
- **PR #7528** (2026-10-05): fix(security): resolve 13 Vanta HIGH Dependabot vulnerabilities (@harshgupta-mem0)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
