# Forensic Learning Record (Deep Inspection): arc53/DocsGPT

> **Canonical Artifact**: `07_PROJECT_LEARNING/arc53-docsgpt-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/arc53/DocsGPT](https://github.com/arc53/DocsGPT))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-06T03:31:24.945Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `arc53/DocsGPT`
- **Description**: Private AI platform for agents, assistants and enterprise search. Built-in Agent Builder, Deep research, Document analysis, Multi-model support, and API connectivity for agents.
- **Primary Language / Ecosystem**: Python
- **Discovered Manifests / Configurations**: pyproject.toml, README.md
- **Stars / Engagement**: 18313 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: pyproject.toml, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `deployment/sandbox/helpers/html_render.py`
```
#!/usr/bin/env python3
"""html-to-pdf and html-screenshot: render a page with headless Chromium.

Installed twice in the sandbox image, as /usr/local/bin/html-to-pdf and
/usr/local/bin/html-screenshot; the name it is called by picks the mode::

    html-to-pdf report.html report.pdf
    html-to-pdf https://example.com page.pdf
    html-screenshot chart.html chart.png --width 1200 --height 800

The input is a local HTML file or an http(s) URL. Page size and margins come
from the page's CSS (``@page``); Chromium's date/URL header and footer are off.
Each call uses a throwaway browser profile. The helper exits non-zero with a
message when no output file appears and prints the output path on success.

Exit codes: 0 rendered, 1 rendering failed, 2 bad arguments or input,
124 timed out, 127 Chromium not installed.
"""

from __future__ import annotations

import argparse
import contextlib
import os
import shutil
import signal
import subprocess
import sys
import tempfile
from pathlib import Path
from typing import List, Optional
from urllib.parse import urlparse
from urllib.request import url2pathname

# Tried in order; the image ships chromium-headless-shell.
BROWSERS = ("chromium-headless-shell", "chromium", "chromium-browser", "google-chrome", "chrome")

DEFAULT_TIMEOUT = 45.0
# Virtual time the page gets to run scripts and timers before it is captured.
DEFAULT_WAIT_MS = 2000
DEFAULT_WIDTH = 1280
DEFAULT_HEIGHT = 800

_MODES = {"html-to-pdf": "pdf", "html-screenshot": "screenshot"}
_STDERR_TAIL = 1500


def _positive_int(value: str) -> int:
    """argparse type for a pixel size: an integer above zero."""
    try:
        parsed = int(value)
    except ValueError:
        raise argparse.ArgumentTypeError(f"not an integer: {value!r}") from None
    if parsed <= 0:
        raise argparse.ArgumentTypeError("must be greater than 0")
    return parsed


def _non_negative_int(value: str) -> int:
    """argparse type for a wait budget in ms: zero or more."""
    try:
        parsed = int(value)
    except ValueError:
        raise argparse.ArgumentTypeError(f"not an integer: {value!r}") from None
    if parsed < 0:
        raise argparse.ArgumentTypeError("must be 0 or more")
    return parsed


def _positive_float(value: str) -> float:
    """argparse type for a timeout: a number above zero."""
    try:
        parsed = float(value)
    except ValueError:
        raise argparse.ArgumentTypeError(f"not a number: {value!r}") from None
    if parsed <= 0:
        raise argparse.ArgumentTypeError("must be greater than 0")
    return parsed


def parse_args(mode: str, prog: str, argv: Optional[List[str]]) -> argparse.Namespace:
    """Parse the command line for one mode.

    Args:
        mode: ``pdf`` or ``screenshot``.
        prog: Program name for usage messages.
        argv: Arguments without the program name.

    Returns:
        The parsed arguments.
    """
    what = "a PDF" if mode == "pdf" else "a PNG screenshot"
    parser = argparse.ArgumentParser(prog=prog, description=f"Render a web page to {what} with headless Chromium.")
    parser.add_argument("input", help="local .html file or http(s) URL")
    parser.add_argument("output", help="file to write" + (" (.pdf)" if mode == "pdf" else " (.png)"))
    if mode == "screenshot":
        parser.add_argument("--width", type=_positive_int, default=DEFAULT_WIDTH, help="viewport width in px")
        parser.add_argument("--height", type=_positive_int, default=DEFAULT_HEIGHT, help="viewport height in px")
    parser.add_argument(
        "--wait-ms",
        type=_non_negative_int,
        default=DEFAULT_WAIT_MS,
        help="virtual time for scripts and timers before capture; 0 captures at load (default: 2000)",
    )
    parser.add_argument(
        "--timeout", type=_positive_float, default=DEFAULT_TIMEOUT, help="seconds before giving up (default: 45)"
    )
    return parser.parse_args(argv)


def find_browser() -> Optional[str]:
    """Return the first Chromium executable on PATH, or None."""
    for name in BROWSERS:
        path = shutil.which(name)
        if path:
            return path
    return None


def to_url(target: str) -> str:
    """Return the URL Chromium should open for a file path or URL.

    Args:
        target: A local path, or an http, https or file URL.

    Returns:
        The URL; local paths become absolute ``file://`` URLs.

    Raises:
        ValueError: For another scheme or a local file that does not exist.
    """
    scheme = urlparse(target).scheme.lower()
    if scheme in ("http", "https", "file"):
        return target
    if scheme and len(scheme) > 1:
        raise ValueError(f"unsupported URL scheme {scheme!r}; give a local .html file or an http(s) URL")
    path = Path(target).expanduser().resolve()
    if not path.is_file():
        raise ValueError(f"input not found: {target}")
    return path.as_uri()


def _local_path(url: str) -> Optional[Path]:
    """Return the resolved file a ``file://`` URL names, or None for any other URL."""
    parsed = urlparse(url)
    if parsed.scheme.lower() != "file":
        return None
    return Path(url2pathname(parsed.path)).resolve()


def run(cmd: List[str], timeout: float) -> subprocess.CompletedProcess:
    """Run ``cmd`` in its own process group, killing the whole group on timeout.

    Args:
        cmd: The command.
        timeout: Seconds to wait.

    Returns:
        The finished process with captured text output.

    Raises:
        subprocess.TimeoutExpired: When the command outlives ``timeout``.
    """
    proc = subprocess.Popen(
        cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True, start_new_session=True
    )
    try:
        stdout, stderr = proc.communicate(timeout=timeout)
    except subprocess.TimeoutExpired:
        # The group may already be gone if Chromium exited at the deadline.
        with contextlib.suppress(ProcessLookupError):
            os.killpg(proc.pid, signal.SIGKILL)
        proc.communicate()
        raise
    return subprocess.CompletedProcess(cmd, proc.returncode, stdout, stderr)


def build_command(
    browser: str, mode: str, url: str, output: Path, profile: Path, args: argparse.Namespace
) -> List[str]:
    """Return the Chromium command for one render.

    Args:
        browser: Chromium executable.
        mode: ``pdf`` or ``screenshot``.
        url: Page to open.
        output: Absolute output path.
        profile: Empty directory for this call's browser profile.
        args: Parsed arguments (wait budget, viewport).

    Returns:
        The argument list.
    """
    cmd = [
        browser,
        "--headless",
        # The sandbox has no user namespaces for Chromium's own sandbox, and a
        # container's small /dev/shm crashes renderers.
        "--no-sandbox",
        "--disable-gpu",
        "--disable-dev-shm-usage",
        "--no-first-run",
        "--mute-audio",
        f"--user-data-dir={profile}",
    ]
    if args.wait_ms:
        cmd.append(f"--virtual-time-budget={args.wait_ms}")
    if mode == "pdf":
        cmd += [f"--print-to-pdf={output}", "--no-pdf-header-footer"]
    else:
        cmd += [f"--screenshot={output}", f"--window-size={args.width},{args.height}", "--hide-scrollbars"]
    cmd.append(url)
    return cmd


def _tail(text: str) -> str:
    """Return the end of the browser's output, enough to show its error."""
    return (text or "").strip()[-_STDERR_TAIL:]


def _render(mode: str, prog: str, argv: Optional[List[str]]) -> int:
    """Render one page in ``mode``; returns the exit code."""
    args = parse_args(mode, prog, argv)
    try:
        url = to_url(args.input)
    except ValueError as exc:
        print(f"{prog}: {exc}", file=sys.stderr)
        return 2
    output = Path(args.output).expanduser().resolve()
    if _local_path(url) == output:
        print(f"{prog}: the output would overwrite the input {args.input}; choose another output file", file=sys.stderr)
        return 2
    browser = find_browser()
    if browser is None:
        print(f"{prog}: Chromium is not installed", file=sys.stderr)
        return 127
    output.parent.mkdir(parents=True, exist_ok=True)
    # A stale file from an earlier run must not pass for this run's output.
    output.unlink(missing_ok=True)

    profile = Path(tempfile.mkdtemp(prefix="chromium-"))
    try:
        try:
            result = run(build_command(browser, mode, url, output, profile, args), args.timeout)
        except subprocess.TimeoutExpired:
            print(f"{prog}: Chromium timed out after {args.timeout:g}s on {args.input}", file=sys.stderr)
            return 124
    finally:
        shutil.rmtree(profile, ignore_errors=True)

    if result.returncode != 0:
        print(f"{prog}: Chromium exited with {result.returncode}", file=sys.stderr)
        detail = _tail(result.stderr) or _tail(result.stdout)
        if detail:
            print(detail, file=sys.stderr)
        return 1
    if not output.is_file() or output.stat().st_size == 0:
        print(f"{prog}: no output: Chromium did not write {output}", file=sys.stderr)
        detail = _tail(result.stderr) or _tail(result.stdout)
        if detail:
            print(detail, file=sys.stderr)
        return 1
    print(output)
    return 0


def main(argv: Optional[List[str]] = None, prog: Optional[str] = None) -> int:
    """Dispatch on the command name: ``html-to-pdf`` or ``html-screenshot``.

    Args:
        argv: Arguments without the program name; None reads ``sys.argv``.
        prog: Command name; None takes it from ``sys.argv[0]``.

    Returns:
        The process exit code.
    """
    prog = prog or os.path.basename(sys.argv[0])
    if argv is None:
        argv = sys.argv[1:]
    mode = _MODES.get(prog)
    if mode is None:
        print(f"{prog}: run this as html-to-pdf or html-screenshot", file=sys.stderr)
        return 2
    return _render(mode, prog, argv)


if __name__ == "__main__":
    raise SystemExit(main())

```

### Core Architecture Module: `extensions/react-widget/src/hooks/useAttachments.ts`
```
import React from 'react';

import { fetchTaskOutcome, uploadAttachment } from '../requests/attachmentsApi';
import { Attachment } from '../types/index';

const POLL_INTERVAL_MS = 1500;
// A large PDF with OCR can take minutes to parse.
const POLL_TIMEOUT_MS = 5 * 60 * 1000;

const PROCESSING_FAILED = 'Could not read this file.';

const generateId = (): string =>
  `${Date.now()}-${Math.random().toString(36).slice(2)}`;

/** Lower-cased final extension including the dot, or '' (dotfiles have none). */
const fileExtension = (name: string): string => {
  const base = name.split(/[\\/]/).pop() ?? '';
  const dot = base.lastIndexOf('.');
  return dot <= 0 ? '' : base.slice(dot).toLowerCase();
};

/** `allowedFileExtensions` as '.ext' entries; 'pdf' and '.PDF' both work. */
export const normalizeExtensions = (types?: string[]): string[] => {
  if (!Array.isArray(types)) return [];
  return types
    .map((type) => String(type).trim().toLowerCase())
    .filter(Boolean)
    .map((type) => (type.startsWith('.') ? type : `.${type}`));
};

/** Picker filter; a hint only, `addFiles` does the real check. */
export const acceptAttribute = (extensions: string[]): string =>
  extensions.join(',');

/** Resolves on the timeout, or early on abort. */
const delay = (ms: number, signal: AbortSignal): Promise<void> =>
  new Promise<void>((resolve) => {
    const onAbort = () => {
      clearTimeout(timer);
      resolve();
    };
    const timer = setTimeout(() => {
      signal.removeEventListener('abort', onAbort);
      resolve();
    }, ms);
    signal.addEventListener('abort', onAbort, { once: true });
  });

interface UseAttachmentsOptions {
  apiKey: string;
  apiHost: string;
  /** Normalised '.ext' list; empty accepts nothing. */
  acceptedExtensions: string[];
}

/**
 * Upload each picked file, then poll its parse task for an attachment id.
 *
 * The widget authenticates on an agent key, so it has no user event stream
 * to subscribe to and completion has to be polled.
 */
export const useAttachments = ({
  apiKey,
  apiHost,
  acceptedExtensions,
}: UseAttachmentsOptions) => {
  const [attachments, setAttachments] = React.useState<Attachment[]>([]);
  // One per chip, so removing it cancels the upload and stops the poll.
  const controllersRef = React.useRef(new Map<string, AbortController>());

  const patch = React.useCallback(
    (id: string, updates: Partial<Attachment>) => {
      // A removed chip is not matched, so a late response cannot resurrect
      // it.
      setAttachments((prev) =>
        prev.map((item) => (item.id === id ? { ...item, ...updates } : item)),
      );
    },
    [],
  );

  const track = React.useCallback(
    async (id: string, taskId: string, controller: AbortController) => {
      const deadline = Date.now() + POLL_TIMEOUT_MS;

      while (!controller.signal.aborted) {
        await delay(POLL_INTERVAL_MS, controller.signal);
        if (controller.signal.aborted) return;

        let outcome;
        try {
          outcome = await fetchTaskOutcome(taskId, apiHost, controller.signal);
        } catch {
          // Offline for a moment; the deadline below bounds this.
          outcome = { state: 'pending' as const };
        }
        if (controller.signal.aborted) return;

        if (outcome.state === 'completed') {
          // Without an attachment id there is nothing to send.
          if (outcome.attachmentId)
            patch(id, {
              status: 'completed',
              progress: 100,
              attachmentId: outcome.attachmentId,
            });
          else patch(id, { status: 'failed', error: PROCESSING_FAILED });
          return;
        }
        if (outcome.state === 'failed') {
          patch(id, { status: 'failed', error: PROCESSING_FAILED });
          return;
        }
        if (Date.now() > deadline) {
          patch(id, {
            status: 'failed',
            error: 'Took too long to process.',
          });
          return;
        }
      }
    },
    [apiHost, patch],
  );

  const addFiles = React.useCallback(
    (files: File[]) => {
      files.forEach((file) => {
        const id = generateId();
        const extension = fileExtension(file.name);

        // Mobile pickers ignore accept, so rejected files still get a chip.
        if (!acceptedExtensions.includes(extension)) {
          setAttachments((prev) => [
            ...prev,
            {
              id,
              fileName: file.name,
              status: 'failed',
              progress: 0,
              error: `${extension || 'That file type'} is not accepted here.`,
            },
          ]);
          return;
        }

        const controller = new AbortController();
        controllersRef.current.set(id, controller);
        setAttachments((prev) => [
          ...prev,
          { id, fileName: file.name, status: 'uploading', progress: 0 },
        ]);

        uploadAttachment({
          file,
          apiKey,
          apiHost,
          signal: controller.signal,
          onProgress: (percent) => patch(id, { progress: percent }),
        })
          .then(({ taskId }) => {
            if (controller.signal.aborted) return undefined;
            patch(id, { status: 'processing', progress: 100 });
            return track(id, taskId, controller);
          })
          .catch((error: unknown) => {
            if (controller.signal.aborted) return;
            patch(id, {
              status: 'failed',
              error:
                error instanceof Error && error.message
                  ? error.message
                  : 'Upload failed.',
            });
          })
          .finally(() => {
            controllersRef.current.delete(id);
          });
      });
    },
    [acceptedExtensions, apiHost, apiKey, patch, track],
  );

  const remove = React.useCallback((id: string) => {
    controllersRef.current.get(id)?.abort();
    controllersRef.current.delete(id);
    setAttachments((prev) => prev.filter((item) => item.id !== id));
  }, []);

  const clear = React.useCallback(() => {
    controllersRef.current.forEach((controller) => controller.abort());
    controllersRef.current.clear();
    setAttachments([]);
  }, []);

  React.useEffect(() => {
    const controllers = controllersRef.current;
    return () => {
      controllers.forEach((controller) => controller.abort());
      controllers.clear();
    };
  }, []);

  const pendingCount = attachments.filter(
    (item) => item.status === 'uploading' || item.status === 'processing',
  ).length;
  const failedCount = attachments.filter(
    (item) => item.status === 'failed',
  ).length;
  const completed = attachments.filter(
    (item) => item.status === 'completed' && item.attachmentId,
  );

  return {
    attachments,
    addFiles,
    remove,
    clear,
    pendingCount,
    failedCount,
    completed,
  };
};

```

### Core Architecture Module: `extensions/react-widget/src/hooks/useBackDismiss.ts`
```
import React from 'react';

/** Marks our own history entry, so only an entry we pushed is popped. */
const HISTORY_MARKER = 'dgptOverlay';

const layers: Array<() => void> = [];
let entryPushed = false;
let releaseTimer: ReturnType<typeof setTimeout> | 0 = 0;
let releasing = false;

const ours = () =>
  (window.history.state as Record<string, unknown> | null)?.[HISTORY_MARKER] ===
  true;

const arm = () => {
  if (entryPushed) return;
  entryPushed = true;
  if (!ours()) window.history.pushState({ [HISTORY_MARKER]: true }, '');
  window.addEventListener('popstate', handlePopState);
};

const handlePopState = () => {
  if (releasing) {
    releasing = false;
    entryPushed = ours();
    if (layers.length > 0) arm();
    else if (!entryPushed)
      window.removeEventListener('popstate', handlePopState);
    return;
  }
  // A host entry stacked above ours pops first, leaving ours in place.
  entryPushed = ours();
  const remaining = layers.length > 1;
  layers[layers.length - 1]?.();
  if (remaining) arm();
};

const register = (dismiss: () => void) => {
  layers.push(dismiss);
  if (releaseTimer) {
    clearTimeout(releaseTimer);
    releaseTimer = 0;
  }
  arm();
};

const unregister = (dismiss: () => void) => {
  const index = layers.lastIndexOf(dismiss);
  if (index !== -1) layers.splice(index, 1);
  if (layers.length > 0 || releaseTimer) return;
  // The palette hands over to the chat panel in one commit, every cleanup
  // before any setup, so release only once nothing reclaims it a task later.
  releaseTimer = setTimeout(() => {
    releaseTimer = 0;
    if (layers.length > 0) return;
    entryPushed = false;
    // Closing by button or overlay would otherwise leave the entry behind.
    if (ours()) {
      releasing = true;
      window.history.back();
      return;
    }
    window.removeEventListener('popstate', handlePopState);
  });
};

/**
 * Closes an open layer on the hardware back button instead of leaving the page.
 * All layers share one history entry, and `onDismiss` is read through a ref.
 */
export function useBackDismiss(active: boolean, onDismiss: () => void): void {
  const dismissRef = React.useRef(onDismiss);

  React.useEffect(() => {
    dismissRef.current = onDismiss;
  });

  React.useEffect(() => {
    if (!active || typeof window === 'undefined' || !window.history) return;
    const dismiss = () => dismissRef.current();
    register(dismiss);
    return () => unregister(dismiss);
  }, [active]);
}

```

### Core Architecture Module: `extensions/react-widget/src/hooks/useDictation.ts`
```
import React from 'react';

import type { MicButtonState } from '../components/ComposerControls';
import { useVoiceInput, voiceInputSupported } from './useVoiceInput';

interface UseDictationOptions {
  enabled: boolean;
  /** Read when dictation starts; the transcript is appended to it. */
  getDraft: () => string;
  onDraftChange: (value: string) => void;
  /** '\n' for a textarea, ' ' for a single-line input. */
  separator: string;
  onEnd?: () => void;
}

/** Microphone state plus merging the live transcript into an input's draft. */
export const useDictation = ({
  enabled,
  getDraft,
  onDraftChange,
  separator,
  onEnd,
}: UseDictationOptions) => {
  const baseRef = React.useRef('');

  const handleStart = React.useCallback(() => {
    baseRef.current = getDraft();
  }, [getDraft]);

  const handleTranscript = React.useCallback(
    (text: string) => {
      // The base is captured once, so interim revisions only replace the
      // transcript.
      const base = baseRef.current;
      onDraftChange(
        base.trim() ? `${base.replace(/\s+$/, '')}${separator}${text}` : text,
      );
    },
    [onDraftChange, separator],
  );

  const voice = useVoiceInput({
    onStart: handleStart,
    onTranscript: handleTranscript,
    onEnd,
  });

  const state: MicButtonState =
    voice.recordingState === 'recording' ||
    voice.recordingState === 'transcribing'
      ? voice.recordingState
      : 'idle';

  return {
    // Firefox has no SpeechRecognition, nor does an insecure origin.
    available: enabled && voiceInputSupported(),
    state,
    isDictating: state !== 'idle',
    error: voice.error,
    clearError: voice.clearError,
    toggle: voice.toggle,
    stop: voice.stop,
    analyserRef: voice.analyserRef,
  };
};

```

### Core Architecture Module: `extensions/react-widget/src/hooks/useVisualViewportBounds.ts`
```
import React from 'react';

/** Below this the gap is the browser's own chrome, not a keyboard. */
const KEYBOARD_MIN_INSET_PX = 120;

/**
 * Publishes the visual viewport as `--dgpt-vv-top`, `--dgpt-vv-bottom` and
 * `--dgpt-vv-height` on the node while a keyboard covers it. Neither
 * `position: fixed` nor `100dvh` notices one, so a full-screen panel keeps its
 * height and slides its header off the display, close button and all. Written
 * straight to the node, since these events fire every frame while the keyboard
 * animates.
 */
export function useVisualViewportBounds(
  active: boolean,
  ref: React.RefObject<HTMLElement | null>,
): void {
  React.useEffect(() => {
    const viewport =
      typeof window === 'undefined' ? null : window.visualViewport;
    const node = ref.current;
    if (!active || !viewport || !node) return;

    let frame = 0;
    let written = '';

    const clear = () => {
      if (!written) return;
      written = '';
      node.style.removeProperty('--dgpt-vv-top');
      node.style.removeProperty('--dgpt-vv-height');
      node.style.removeProperty('--dgpt-vv-bottom');
    };

    const apply = () => {
      frame = 0;
      // Pinch-zoom shrinks the viewport the same way but covers nothing.
      if (viewport.scale > 1.01) {
        clear();
        return;
      }
      // A quirks-mode host reports its content height from `clientHeight`.
      const layoutHeight = Math.min(
        document.documentElement.clientHeight,
        window.innerHeight,
      );
      const top = viewport.offsetTop;
      const bottom = Math.max(0, layoutHeight - top - viewport.height);
      if (top + bottom < KEYBOARD_MIN_INSET_PX) {
        clear();
        return;
      }
      const next = `${top}|${viewport.height}|${bottom}`;
      if (next === written) return;
      written = next;
      node.style.setProperty('--dgpt-vv-top', `${top}px`);
      node.style.setProperty('--dgpt-vv-height', `${viewport.height}px`);
      node.style.setProperty('--dgpt-vv-bottom', `${bottom}px`);
    };

    const schedule = () => {
      if (!frame) frame = window.requestAnimationFrame(apply);
    };

    apply();
    viewport.addEventListener('resize', schedule);
    viewport.addEventListener('scroll', schedule);

    return () => {
      if (frame) window.cancelAnimationFrame(frame);
      viewport.removeEventListener('resize', schedule);
      viewport.removeEventListener('scroll', schedule);
      clear();
    };
  }, [active, ref]);
}

```

### Core Architecture Module: `extensions/react-widget/src/hooks/useVoiceInput.ts`
```
import React from 'react';

//Recognition runs in-browser

export type RecordingState = 'idle' | 'recording' | 'transcribing' | 'error';

interface SpeechRecognitionLike extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  maxAlternatives: number;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEvent) => void) | null;
  onend: (() => void) | null;
}

type SpeechRecognitionConstructor = new () => SpeechRecognitionLike;

type LegacyAudioWindow = Window &
  typeof globalThis & { webkitAudioContext?: typeof AudioContext };

const LEVEL_FFT_SIZE = 1024;
const LEVEL_SMOOTHING = 0.6;

type SpeechWindow = Window &
  typeof globalThis & {
    SpeechRecognition?: SpeechRecognitionConstructor;
    webkitSpeechRecognition?: SpeechRecognitionConstructor;
  };

const recognitionClass = (): SpeechRecognitionConstructor | undefined => {
  if (typeof window === 'undefined') return undefined;
  const speechWindow = window as SpeechWindow;
  return speechWindow.SpeechRecognition ?? speechWindow.webkitSpeechRecognition;
};

export const voiceInputSupported = (): boolean => {
  if (typeof window === 'undefined') return false;
  // The API is only exposed on secure origins.
  if (!window.isSecureContext) return false;
  return recognitionClass() !== undefined;
};

/** User-facing message, or null for outcomes that are not errors. */
const errorMessage = (code: string): string | null => {
  switch (code) {
    // The user pressed stop.
    case 'aborted':
      return null;
    case 'no-speech':
      return 'No speech was picked up.';
    case 'not-allowed':
    case 'service-not-allowed':
      return 'Microphone access was blocked.';
    case 'audio-capture':
      return 'No microphone was found.';
    case 'network':
      return 'Voice input is unavailable right now.';
    case 'language-not-supported':
      return 'Voice input does not support this language.';
    default:
      return 'Voice input stopped unexpectedly.';
  }
};

interface UseVoiceInputOptions {
  onStart: () => void;
  /** Final words plus the interim tail. */
  onTranscript: (text: string) => void;
  onEnd?: () => void;
}

/** Browser speech recognition with interim results. */
export const useVoiceInput = ({
  onStart,
  onTranscript,
  onEnd,
}: UseVoiceInputOptions) => {
  const [recordingState, setRecordingState] =
    React.useState<RecordingState>('idle');
  const [error, setError] = React.useState<string | null>(null);
  const recognitionRef = React.useRef<SpeechRecognitionLike | null>(null);
  // The Web Speech API exposes no audio, so the waveform uses a separate
  // capture. Refs, so drawing does not re-render.
  const analyserRef = React.useRef<AnalyserNode | null>(null);
  const audioContextRef = React.useRef<AudioContext | null>(null);
  const levelStreamRef = React.useRef<MediaStream | null>(null);
  // Final results accumulate; interim text is rebuilt on each event.
  const finalTranscriptRef = React.useRef('');
  const isMountedRef = React.useRef(true);

  const stopLevelMeter = React.useCallback(() => {
    analyserRef.current = null;
    levelStreamRef.current?.getTracks().forEach((track) => track.stop());
    levelStreamRef.current = null;
    void audioContextRef.current?.close().catch(() => undefined);
    audioContextRef.current = null;
  }, []);

  /** Best effort: recognition still works if this capture is refused. */
  const startLevelMeter = React.useCallback(async () => {
    const audioWindow = window as LegacyAudioWindow;
    const AudioContextClass =
      audioWindow.AudioContext ?? audioWindow.webkitAudioContext;
    if (!AudioContextClass || !navigator.mediaDevices?.getUserMedia) return;

    // Never `await context.resume()`: without user activation the promise
    // never settles and the analyser below is never built. Constructed before
    // the first await so it is created within the click's activation.
    const context = new AudioContextClass();

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      // Recording may have ended while permission was pending.
      if (!isMountedRef.current || !recognitionRef.current) {
        stream.getTracks().forEach((track) => track.stop());
        void context.close().catch(() => undefined);
        return;
      }

      const analyser = context.createAnalyser();
      analyser.fftSize = LEVEL_FFT_SIZE;
      analyser.smoothingTimeConstant = LEVEL_SMOOTHING;
      // Left unconnected to the destination, which would play the mic back.
      context.createMediaStreamSource(stream).connect(analyser);

      levelStreamRef.current = stream;
      audioContextRef.current = context;
      analyserRef.current = analyser;
    } catch {
      void context.close().catch(() => undefined);
    }
  }, []);

  React.useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      // abort() releases the microphone immediately.
      recognitionRef.current?.abort();
      recognitionRef.current = null;
      stopLevelMeter();
    };
  }, [stopLevelMeter]);

  const start = React.useCallback(() => {
    const RecognitionClass = recognitionClass();
    if (!RecognitionClass) {
      setRecordingState('error');
      setError(
        typeof window !== 'undefined' && !window.isSecureContext
          ? 'Voice input needs a secure connection (HTTPS).'
          : 'This browser does not support voice input.',
      );
      return;
    }

    const recognition = new RecognitionClass();
    // Without this the engine stops at the first pause.
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;
    if (typeof navigator !== 'undefined' && navigator.language)
      recognition.lang = navigator.language;

    finalTranscriptRef.current = '';

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let interim = '';
      // Start at resultIndex: the list also contains results already
      // accumulated.
      for (
        let index = event.resultIndex;
        index < event.results.length;
        index += 1
      ) {
        const result = event.results[index];
        const text = result[0]?.transcript ?? '';
        if (result.isFinal) finalTranscriptRef.current += text;
        else interim += text;
      }
      onTranscript(`${finalTranscriptRef.current}${interim}`.trim());
    };

    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      const message = errorMessage(event.error);
      if (!isMountedRef.current || !message) return;
      setRecordingState('error');
      setError(message);
    };

    recognition.onend = () => {
      recognitionRef.current = null;
      // Here, so the waveform stays live until the final result arrives.
      stopLevelMeter();
      if (!isMountedRef.current) return;
      // An error already set its own state; do not overwrite it.
      setRecordingState((previous) =>
        previous === 'error' ? previous : 'idle',
      );
      onEnd?.();
    };

    try {
      recognition.start();
    } catch {
      // Already running, if a stop is still unwinding.
      return;
    }

    recognitionRef.current = recognition;
    setError(null);
    onStart();
    setRecordingState('recording');
    void startLevelMeter();
  }, [onEnd, onStart, onTranscript, startLevelMeter, stopLevelMeter]);

  const stop = React.useCallback(() => {
    if (recordingState !== 'recording') return;
    // stop() lets the last utterance deliver its final result.
    setRecordingState('transcribing');
    recognitionRef.current?.stop();
  }, [recordingState]);

  const toggle = React.useCallback(() => {
    if (recordingState === 'transcribing') return;
    if (recordingState === 'recording') {
      stop();
      return;
    }
    start();
  }, [recordingState, start, stop]);

  const clearError = React.useCallback(() => {
    setError(null);
    setRecordingState((previous) => (previous === 'error' ? 'idle' : previous));
  }, []);

  return { recordingState, error, toggle, stop, clearError, analyserRef };
};

```

### Core Architecture Module: `extensions/react-widget/src/utils/helper.ts`
```
/**
 * Whether touch is the only pointer: a phone or tablet, not a laptop with a
 * touchscreen, which `'ontouchstart' in window` cannot tell apart.
 */
export const isTouchPrimary = (): boolean => {
  if (typeof window === 'undefined' || !window.matchMedia) return false;
  return window.matchMedia('(hover: none) and (pointer: coarse)').matches;
};

export const getOS = () => {
  const platform = window.navigator.platform;
  const userAgent = window.navigator.userAgent || window.navigator.vendor;

  if (/Mac/i.test(platform)) {
    return 'mac';
  }

  if (/Win/i.test(platform)) {
    return 'win';
  }

  if (/Linux/i.test(platform) && !/Android/i.test(userAgent)) {
    return 'linux';
  }

  if (/Android/i.test(userAgent)) {
    return 'android';
  }

  if (/iPhone|iPad|iPod/i.test(userAgent)) {
    return 'ios';
  }

  return 'other';
};

interface ParsedElement {
  content: string;
  tag: string;
}

export const processMarkdownString = (
  markdown: string,
  keyword?: string,
): ParsedElement[] => {
  const lines = markdown.trim().split('\n');
  const keywordLower = keyword?.toLowerCase();

  const escapeRegExp = (str: string) =>
    str.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&');
  const escapedKeyword = keyword ? escapeRegExp(keyword) : '';
  const keywordRegex = keyword ? new RegExp(`(${escapedKeyword})`, 'gi') : null;

  let isInCodeBlock = false;
  let codeBlockContent: string[] = [];
  let matchingLines: ParsedElement[] = [];
  let firstLine: ParsedElement | null = null;

  for (let i = 0; i < lines.length; i++) {
    const trimmedLine = lines[i].trim();
    if (!trimmedLine) continue;

    if (trimmedLine.startsWith('```')) {
      if (!isInCodeBlock) {
        isInCodeBlock = true;
        codeBlockContent = [];
      } else {
        isInCodeBlock = false;
        const codeContent = codeBlockContent.join('\n');
        const parsedElement: ParsedElement = {
          content: codeContent,
          tag: 'code',
        };

        if (!firstLine) {
          firstLine = parsedElement;
        }

        if (keywordLower && codeContent.toLowerCase().includes(keywordLower)) {
          parsedElement.content = parsedElement.content.replace(
            keywordRegex!,
            '<span class="highlight">$1</span>',
          );
          matchingLines.push(parsedElement);
        }
      }
      continue;
    }

    if (isInCodeBlock) {
      codeBlockContent.push(trimmedLine);
      continue;
    }

    let parsedElement: ParsedElement | null = null;

    const headingMatch = trimmedLine.match(/^(#{1,6})\s+(.+)$/);
    const bulletMatch = trimmedLine.match(/^[-*]\s+(.+)$/);
    const numberedMatch = trimmedLine.match(/^\d+\.\s+(.+)$/);
    const blockquoteMatch = trimmedLine.match(/^>+\s*(.+)$/);

    let content = trimmedLine;

    if (headingMatch) {
      content = headingMatch[2];
      parsedElement = {
        content: content,
        tag: 'heading',
      };
    } else if (bulletMatch) {
      content = bulletMatch[1];
      parsedElement = {
        content: content,
        tag: 'bulletList',
      };
    } else if (numberedMatch) {
      content = numberedMatch[1];
      parsedElement = {
        content: content,
        tag: 'numberedList',
      };
    } else if (blockquoteMatch) {
      content = blockquoteMatch[1];
      parsedElement = {
        content: content,
        tag: 'blockquote',
      };
    } else {
      parsedElement = {
        content: content,
        tag: 'text',
      };
    }

    if (!firstLine) {
      firstLine = parsedElement;
    }

    if (
      keywordLower &&
      parsedElement.content.toLowerCase().includes(keywordLower)
    ) {
      parsedElement.content = parsedElement.content.replace(
        keywordRegex!,
        '<span class="highlight">$1</span>',
      );
      matchingLines.push(parsedElement);
    }
  }

  if (isInCodeBlock && codeBlockContent.length > 0) {
    const codeContent = codeBlockContent.join('\n');
    const parsedElement: ParsedElement = {
      content: codeContent,
      tag: 'code',
    };

    if (!firstLine) {
      firstLine = parsedElement;
    }

    if (keywordLower && codeContent.toLowerCase().includes(keywordLower)) {
      parsedElement.content = parsedElement.content.replace(
        keywordRegex!,
        '<span class="highlight">$1</span>',
      );
      matchingLines.push(parsedElement);
    }
  }

  if (keywordLower && matchingLines.length > 0) {
    return matchingLines;
  }

  return firstLine ? [firstLine] : [];
};

```

### Core Architecture Module: `extensions/react-widget/src/utils/streamEvents.ts`
```
export interface StreamEvent {
  type?: string;
  [key: string]: unknown;
}

export interface ToolCallEvent {
  action_name?: string;
  tool_name?: string;
}

/** internal_search -> Internal Search */
export const prettifyName = (name: string): string =>
  name
    .split(/[_\s]+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');

/**
 * Status-line text for a running workflow node, or null when the node is
 * scaffolding the user gains nothing from seeing. Keyed on node_type (a
 * closed enum) rather than node_title, which is free text like "agent node".
 */
export const workflowStepLabel = (event: StreamEvent): string | null => {
  if (event.status !== 'running') return null;
  switch (event.node_type) {
    case 'agent':
      return 'Thinking…';
    case 'code':
      return 'Running code…';
    case 'condition':
      return 'Deciding next step…';
    case 'start':
    case 'end':
    case 'state':
    case 'note':
      return null;
    default:
      return typeof event.node_title === 'string' && event.node_title
        ? `${prettifyName(event.node_title)}…`
        : null;
  }
};

export const toolNames = (calls: unknown): string[] => {
  if (!Array.isArray(calls)) return [];
  return calls
    .map((call: ToolCallEvent | null) => call?.action_name ?? call?.tool_name)
    .filter((name): name is string => Boolean(name));
};

```

### Core Architecture Module: `frontend/src/admin/quotaUtils.ts`
```
// Pure helpers behind the quota editor and usage bars.

export type BudgetMode = 'inherit' | 'limit' | 'unlimited';

export type QuotaPolicy = {
  scope: 'instance' | 'team' | 'user';
  subject_id: string | null;
  bucket: string;
  token_limit: number | null;
  token_unlimited: boolean;
  cost_limit_usd: number | null;
  cost_unlimited: boolean;
  enabled: boolean;
  note?: string | null;
  updated_by?: string | null;
  updated_at?: string | null;
};

export type Budget = {
  limit: number | null;
  used: number;
  source?: string | null;
  source_id?: string | null;
};

export type BucketStatus = {
  bucket: string;
  tokens: Budget;
  cost: Budget;
  resets_at: string;
};

export type QuotaForm = {
  tokenMode: BudgetMode;
  tokenLimit: string;
  costMode: BudgetMode;
  costLimit: string;
  note: string;
};

const mode = (limit: number | null, unlimited: boolean): BudgetMode => {
  if (unlimited) return 'unlimited';
  return limit === null || limit === undefined ? 'inherit' : 'limit';
};

export function policyToForm(policy?: QuotaPolicy | null): QuotaForm {
  return {
    tokenMode: policy
      ? mode(policy.token_limit, policy.token_unlimited)
      : 'inherit',
    tokenLimit: policy?.token_limit != null ? String(policy.token_limit) : '',
    costMode: policy
      ? mode(policy.cost_limit_usd, policy.cost_unlimited)
      : 'inherit',
    costLimit:
      policy?.cost_limit_usd != null ? String(policy.cost_limit_usd) : '',
    note: policy?.note ?? '',
  };
}

export type FormResult =
  { ok: true; policy: Record<string, unknown> } | { ok: false; error: string };

// An empty form (both budgets inherited) is not a policy: the caller deletes instead.
export function isEmptyForm(form: QuotaForm): boolean {
  return form.tokenMode === 'inherit' && form.costMode === 'inherit';
}

// ``existing`` carries the stored ``enabled`` flag through an edit: the form has
// no control for it, and a body without it would switch the policy back on.
export function formToPolicy(
  form: QuotaForm,
  existing?: QuotaPolicy | null,
): FormResult {
  const policy: Record<string, unknown> = {
    bucket: 'all',
    enabled: existing?.enabled ?? true,
    token_limit: null,
    token_unlimited: form.tokenMode === 'unlimited',
    cost_limit_usd: null,
    cost_unlimited: form.costMode === 'unlimited',
    note: form.note.trim() || null,
  };
  if (form.tokenMode === 'limit') {
    const raw = form.tokenLimit.trim();
    if (!/^\d+$/.test(raw))
      return { ok: false, error: 'Token limit must be a whole number.' };
    const tokens = Number(raw);
    if (!Number.isSafeInteger(tokens))
      return { ok: false, error: 'Token limit is too large.' };
    policy.token_limit = tokens;
  }
  if (form.costMode === 'limit') {
    const raw = form.costLimit.trim();
    const cost = Number(raw);
    if (raw === '' || !Number.isFinite(cost) || cost < 0)
      return { ok: false, error: 'Cost limit must be a number, 0 or more.' };
    policy.cost_limit_usd = cost;
  }
  return { ok: true, policy };
}

export function usagePercent(used: number, limit: number | null): number {
  if (limit === null || limit === undefined) return 0;
  if (limit <= 0) return 100;
  return Math.min(100, Math.max(0, (used / limit) * 100));
}

export function fmtUsd(value?: number | null): string {
  return new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: value != null && value < 1 ? 4 : 2,
  }).format(value ?? 0);
}

export function describeBudget(
  limit: number | null,
  unlimited: boolean,
  kind: 'tokens' | 'cost',
): string {
  if (unlimited) return 'Unlimited';
  if (limit === null || limit === undefined) return '—';
  return kind === 'cost'
    ? fmtUsd(limit)
    : `${new Intl.NumberFormat().format(limit)} tokens`;
}

export function sourceLabel(budget: Budget, teamName?: string): string {
  if (!budget.source) return 'No limit set';
  if (budget.source === 'user') return 'User override';
  if (budget.source === 'team')
    return teamName ? `Team: ${teamName}` : 'Team allowance';
  if (budget.source === 'instance') return 'Instance default';
  return 'Plan default';
}

```

### Core Architecture Module: `frontend/src/agents/hooks/useAgentSearch.ts`
```
import { useCallback, useMemo, useState } from 'react';
import { useSelector } from 'react-redux';

import {
  selectAgents,
  selectSharedAgents,
  selectTemplateAgents,
} from '../../preferences/preferenceSlice';
import { AgentSectionId } from '../agents.config';
import { Agent } from '../types';

export type AgentFilterTab = 'all' | AgentSectionId;

export type AgentsBySection = Record<AgentSectionId, Agent[]>;

interface UseAgentSearchResult {
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  filteredAgentsBySection: AgentsBySection;
  totalAgentsBySection: Record<AgentSectionId, number>;
  hasAnyAgents: boolean;
  hasFilteredResults: boolean;
  isDataLoaded: Record<AgentSectionId, boolean>;
}

const filterAgentsByQuery = (
  agents: Agent[] | null,
  query: string,
): Agent[] => {
  if (!agents) return [];
  if (!query.trim()) return agents;

  const normalizedQuery = query.toLowerCase().trim();
  return agents.filter(
    (agent) =>
      agent.name.toLowerCase().includes(normalizedQuery) ||
      agent.description?.toLowerCase().includes(normalizedQuery),
  );
};

/**
 * Search and filtering for the agent list. The filter is passed in rather
 * than held here: it lives in the route, so it stays linkable and survives a
 * reload.
 */
export function useAgentSearch(
  activeFilter: AgentFilterTab = 'all',
): UseAgentSearchResult {
  const [searchQuery, setSearchQuery] = useState('');

  const templateAgents = useSelector(selectTemplateAgents);
  const allUserAgents = useSelector(selectAgents);
  const sharedAgents = useSelector(selectSharedAgents);

  // /api/get_agents returns both the caller's own agents and agents shared
  // with their teams (tagged ownership:'team'). Split them so "By me" shows
  // only owned agents and "Shared with my team" gets its own section.
  // Preserve the null (still-loading) state for both buckets.
  const userAgents = useMemo(
    () =>
      allUserAgents === null
        ? null
        : allUserAgents.filter((a) => a.ownership !== 'team'),
    [allUserAgents],
  );
  const teamAgents = useMemo(
    () =>
      allUserAgents === null
        ? null
        : allUserAgents.filter((a) => a.ownership === 'team'),
    [allUserAgents],
  );

  const handleSearchChange = useCallback((query: string) => {
    setSearchQuery(query);
  }, []);

  const isDataLoaded = useMemo(
    (): Record<AgentSectionId, boolean> => ({
      template: templateAgents !== null,
      user: userAgents !== null,
      team: teamAgents !== null,
      shared: sharedAgents !== null,
    }),
    [templateAgents, userAgents, teamAgents, sharedAgents],
  );

  const totalAgentsBySection = useMemo(
    (): Record<AgentSectionId, number> => ({
      template: templateAgents?.length ?? 0,
      user: userAgents?.length ?? 0,
      team: teamAgents?.length ?? 0,
      shared: sharedAgents?.length ?? 0,
    }),
    [templateAgents, userAgents, teamAgents, sharedAgents],
  );

  const filteredAgentsBySection = useMemo((): AgentsBySection => {
    const filtered = {
      template: filterAgentsByQuery(templateAgents, searchQuery),
      user: filterAgentsByQuery(userAgents, searchQuery),
      team: filterAgentsByQuery(teamAgents, searchQuery),
      shared: filterAgentsByQuery(sharedAgents, searchQuery),
    };

    if (activeFilter === 'all') {
      return filtered;
    }

    return {
      template: activeFilter === 'template' ? filtered.template : [],
      user: activeFilter === 'user' ? filtered.user : [],
      team: activeFilter === 'team' ? filtered.team : [],
      shared: activeFilter === 'shared' ? filtered.shared : [],
    };
  }, [
    templateAgents,
    userAgents,
    teamAgents,
    sharedAgents,
    searchQuery,
    activeFilter,
  ]);

  const hasAnyAgents = useMemo(() => {
    return (
      totalAgentsBySection.template > 0 ||
      totalAgentsBySection.user > 0 ||
      totalAgentsBySection.team > 0 ||
      totalAgentsBySection.shared > 0
    );
  }, [totalAgentsBySection]);

  const hasFilteredResults = useMemo(() => {
    return (
      filteredAgentsBySection.template.length > 0 ||
      filteredAgentsBySection.user.length > 0 ||
      filteredAgentsBySection.team.length > 0 ||
      filteredAgentsBySection.shared.length > 0
    );
  }, [filteredAgentsBySection]);

  return {
    searchQuery,
    setSearchQuery: handleSearchChange,
    filteredAgentsBySection,
    totalAgentsBySection,
    hasAnyAgents,
    hasFilteredResults,
    isDataLoaded,
  };
}

```

### Core Architecture Module: `frontend/src/agents/hooks/useAgentsFetch.ts`
```
import { useCallback, useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';

import userService from '../../api/services/userService';
import {
  selectToken,
  setAgentFolders,
  setAgents,
  setSharedAgents,
  setTemplateAgents,
} from '../../preferences/preferenceSlice';
import { AgentSectionId } from '../agents.config';

interface UseAgentsFetchResult {
  isLoading: Record<AgentSectionId, boolean>;
  isAllLoaded: boolean;
  refetchFolders: () => Promise<void>;
  refetchUserAgents: () => Promise<void>;
}

export function useAgentsFetch(): UseAgentsFetchResult {
  const dispatch = useDispatch();
  const token = useSelector(selectToken);

  const [isLoading, setIsLoading] = useState<Record<AgentSectionId, boolean>>({
    template: true,
    user: true,
    // 'team' agents are split out of the same /api/get_agents payload, so
    // their loading state tracks the user fetch.
    team: true,
    shared: true,
  });

  const fetchTemplateAgents = useCallback(async () => {
    try {
      const response = await userService.getTemplateAgents(token);
      if (!response.ok) throw new Error('Failed to fetch template agents');
      const data = await response.json();
      dispatch(setTemplateAgents(data));
    } catch (error) {
      dispatch(setTemplateAgents([]));
    } finally {
      setIsLoading((prev) => ({ ...prev, template: false }));
    }
  }, [token, dispatch]);

  const fetchUserAgents = useCallback(async () => {
    try {
      const response = await userService.getAgents(token);
      if (!response.ok) throw new Error('Failed to fetch user agents');
      const data = await response.json();
      dispatch(setAgents(data));
    } catch (error) {
      dispatch(setAgents([]));
    } finally {
      setIsLoading((prev) => ({ ...prev, user: false, team: false }));
    }
  }, [token, dispatch]);

  const fetchSharedAgents = useCallback(async () => {
    try {
      const response = await userService.getSharedAgents(token);
      if (!response.ok) throw new Error('Failed to fetch shared agents');
      const data = await response.json();
      dispatch(setSharedAgents(data));
    } catch (error) {
      dispatch(setSharedAgents([]));
    } finally {
      setIsLoading((prev) => ({ ...prev, shared: false }));
    }
  }, [token, dispatch]);

  const fetchFolders = useCallback(async () => {
    try {
      const response = await userService.getAgentFolders(token);
      if (!response.ok) throw new Error('Failed to fetch folders');
      const data = await response.json();
      dispatch(setAgentFolders(data.folders || []));
    } catch (error) {
      dispatch(setAgentFolders([]));
    }
  }, [token, dispatch]);

  useEffect(() => {
    setIsLoading({ template: true, user: true, team: true, shared: true });
    Promise.all([
      fetchTemplateAgents(),
      fetchUserAgents(),
      fetchSharedAgents(),
      fetchFolders(),
    ]);
  }, [fetchTemplateAgents, fetchUserAgents, fetchSharedAgents, fetchFolders]);

  const isAllLoaded =
    !isLoading.template &&
    !isLoading.user &&
    !isLoading.team &&
    !isLoading.shared;

  return {
    isLoading,
    isAllLoaded,
    refetchFolders: fetchFolders,
    refetchUserAgents: fetchUserAgents,
  };
}

```

### Core Architecture Module: `frontend/src/agents/useAgentResourceStates.ts`
```
import { useEffect, useState } from 'react';
import { useSelector } from 'react-redux';

import userService from '../api/services/userService';
import { selectToken } from '../preferences/preferenceSlice';
import type { Agent, ResourceState } from './types';

/** The agent as read, and every tool, source and prompt it runs. */
export type AgentResources = { agent: Agent; items: ResourceState[] };

/** The agent's own items, then its workflow nodes' ones it doesn't have. */
export function mergeStates(
  own: ResourceState[],
  nodes: ResourceState[],
): ResourceState[] {
  const seen = new Set(own.map((item) => item.key.toLowerCase()));
  return [...own, ...nodes.filter((item) => !seen.has(item.key.toLowerCase()))];
}

/**
 * Reads an agent and the run state of what it uses: `resource_states` from
 * the agent read, plus the workflow read's for a workflow agent's node
 * tools and sources. Only owners and editors get the states; everyone else
 * gets an empty list.
 *
 * Args:
 *   agentId: The agent to read; nothing is read without one.
 *   reloadKey: Read again when this changes (the agent's saved tools).
 *
 * Returns:
 *   The agent and its items, or null while loading or when the agent
 *   can't be read. A failed workflow read leaves the agent's own items.
 */
export default function useAgentResourceStates(
  agentId: string | undefined,
  reloadKey = '',
): AgentResources | null {
  const token = useSelector(selectToken);
  const [loaded, setLoaded] = useState<AgentResources | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoaded(null);
    if (!agentId) return;
    const load = async () => {
      let agent: Agent;
      try {
        const response = await userService.getAgent(agentId, token);
        if (!response.ok) return;
        agent = await response.json();
      } catch {
        return;
      }
      let items = agent.resource_states ?? [];
      if (agent.agent_type === 'workflow' && agent.workflow) {
        try {
          const response = await userService.getWorkflow(agent.workflow, token);
          if (response.ok) {
            const body = await response.json();
            items = mergeStates(items, body?.data?.resource_states ?? []);
          }
        } catch {
          // The agent's own items still show.
        }
      }
      if (!cancelled) setLoaded({ agent, items });
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [agentId, reloadKey, token]);

  return loaded;
}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #2269** (2026-02-09): **🐛 Bug Report: Non latin text gets truncated for in the sources filename section**
  *Symptoms*: ### 📜 Description  Use virtual filenames and save files by id in the filesystem  ### 👟 Reproduction steps  Upload any file with non latin name  ### 👍 Expected behavior  Should keep original language or transliterate  ### 👎 Actual Behavior with Screenshots  -  ### 💻 Operating system  MacOS  ### What browsers are you seeing the problem on?  _No response_  ### 🤖 What development environment are you experiencing this bug on?  Docker  ### 🔒 Did you set the correct environment variables in the right path? List the environment variable names (not values please!)  _No response_  ### 📃 Provide any additional context for the Bug.  _No response_  ### 📖 Relevant log output  ```shell  ```  ### 👀 Have you spent some time to check if this bug has been raised before?  - [x] I checked and didn't find similar issue  ### 🔗 Are you willing to submit PR?  None  ### 🧑‍⚖️ Code of Conduct  - [x] I agree to follow this project's Code of Conduct
  **Post-Mortem & Fix Analysis**:
  > I wanna work on it
  > Sorry I got it fixed this Friday

- **Issue #2167** (2025-12-19): **🐛 Bug Report: missing SVG on test button**
  *Symptoms*: ### 📜 Description  When new agent is created there is a `Test` button next to API key. The svg link there is not working.  This link `/src/assets/external-link.svg` is missing an svg.     ### 👟 Reproduction steps  1. Create new agent.  ### 👍 Expected behavior  Correct svg shown.    ### 👎 Actual Behavior with Screenshots  <img width="141" height="111" alt="Image" src="https://github.com/user-attachments/assets/09ad1efb-d9ec-4434-9d35-6842cdd50d2f" />  ### 💻 Operating system  MacOS  ### What browsers are you seeing the problem on?  Chrome  ### 🤖 What development environment are you experiencing this bug on?  Docker  ### 🔒 Did you set the correct environment variables in the right path? List the environment variable names (not values please!)  _No response_  ### 📃 Provide any additional context for the Bug.  _No response_  ### 📖 Relevant log output  ```shell  ```  ### 👀 Have you spent some time to check if this bug has been raised before?  - [x] I checked and didn't find similar issue  ### 🔗 Are you willing to submit PR?  None  ### 🧑‍⚖️ Code of Conduct  - [x] I agree to follow this project's Code of Conduct
  **Post-Mortem & Fix Analysis**:
  > Can I work on this one?
  > if it is still open then will work on it 

- **Issue #2159** (2026-01-04): **🐛 Bug Report: Improve DocsGPT Chat Widget**
  *Symptoms*: ### 📜 Description  1. Add better formatting, spacing, line breaks, bullet lists etc. 2. Add a shortcut "Shift+Enter" that starts a new line (without sending).  ### 👟 Reproduction steps  -  ### 👍 Expected behavior  -  ### 👎 Actual Behavior with Screenshots  -  ### 💻 Operating system  Linux  ### What browsers are you seeing the problem on?  _No response_  ### 🤖 What development environment are you experiencing this bug on?  Docker  ### 🔒 Did you set the correct environment variables in the right path? List the environment variable names (not values please!)  _No response_  ### 📃 Provide any additional context for the Bug.  _No response_  ### 📖 Relevant log output  ```shell  ```  ### 👀 Have you spent some time to check if this bug has been raised before?  - [x] I checked and didn't find similar issue  ### 🔗 Are you willing to submit PR?  None  ### 🧑‍⚖️ Code of Conduct  - [x] I agree to follow this project's Code of Conduct
  **Post-Mortem & Fix Analysis**:
  > I'll be happy to work on this one, if no one else did it please assign it to me
  > I would like to contribute to this issue. Please assign me this task. 
  > The DocsGPT widget is referred in the https://docs.docsgpt.cloud/Extensions/chat-widget, located in the `./extentions/react-widget`  Issue discused is reproducible in this chat interface  <img width="481" height="811" alt="Image" src="https://github.com/user-attachments/assets/0d8e6ac1-f3f4-4642-be14-3e079201c8d1" />

- **Issue #2120** (2025-10-31): **🐛 Bug Report: If i have multiple sources selected and delete one, selection is still active**
  *Symptoms*: ### 📜 Description  Sometimes there are deleted sources that are actively selected in users state. Make sure that we check if selected sources exist on user query - if not quietly unselect them in the UI. ( remove from localstorage )  ### 👟 Reproduction steps  1. Create 2 sources 2. Select both 3. Delete one of them  ### 👍 Expected behavior  Deleted source should be quietly unselected.   ### 👎 Actual Behavior with Screenshots  -  ### 💻 Operating system  MacOS  ### What browsers are you seeing the problem on?  Chrome  ### 🤖 What development environment are you experiencing this bug on?  Docker  ### 🔒 Did you set the correct environment variables in the right path? List the environment variable names (not values please!)  _No response_  ### 📃 Provide any additional context for the Bug.  _No response_  ### 📖 Relevant log output  ```shell  ```  ### 👀 Have you spent some time to check if this bug has been raised before?  - [x] I checked and didn't find similar issue  ### 🔗 Are you willing to submit PR?  None  ### 🧑‍⚖️ Code of Conduct  - [x] I agree to follow this project's Code of Conduct

- **Issue #1986** (2025-10-06): **🐛 Bug Report: Can't Select Agent Source**
  *Symptoms*: ### 📜 Description  If there is only one data source, then you can't select data source except default one while creating an agent.  ### 👟 Reproduction steps  1. Start DocsGPT 2. Go to settings 3. Add only one data source 4. Click manage agents 5. Create agent 6. Try to select data source  (At this step you should only see the option "default")  ### 👍 Expected behavior  User should see the data source they uploaded instead of "default".  ### 👎 Actual Behavior with Screenshots  It actually shows only "default" option.  ### 💻 Operating system  MacOS  ### What browsers are you seeing the problem on?  Chrome  ### 🤖 What development environment are you experiencing this bug on?  Docker  ### 🔒 Did you set the correct environment variables in the right path? List the environment variable names (not values please!)  LLM_PROVIDER= VITE_API_STREAMING=  ### 📃 Provide any additional context for the Bug.  If this behaviour is accepted because of existence of only one data source, then there is an issue when user uploads multiple data source, because we can see default option there too. (What is the default option?)  ### 📖 Relevant log output  ```shell  ```  ### 👀 Have you spent some time to check if this bug has been raised before?  - [x] I checked and didn't find similar issue  ### 🔗 Are you willing to submit PR?  None  ### 🧑‍⚖️ Code of Conduct  - [x] I agree to follow this project's Code of Conduct
  **Post-Mortem & Fix Analysis**:
  > I would like to contribute to this, will you assign me this. Thanks
  > @ardafincan Please try it out again, I think issue might be fixed for you now. Thank you!
  > Yeah it is fixed! Even though what "default" is not clear for the user the main issue is solved.

- **Issue #1878** (2025-07-15): **🐛 Bug Report: Edit prompt for saving conversations. Make sure they are saved in the same language as user query explicitly.**
  *Symptoms*: ### 📜 Description  {                 "role": "assistant",                 "content": "Summarise following conversation in no more than 3 "                 "words, respond ONLY with the summary, use the same "                 "language as the system",             },             {                 "role": "user",                 "content": "Summarise following conversation in no more than 3 words, "                 "respond ONLY with the summary, use the same language as the "                 "system \n\nUser: " + question + "\n\n" + "AI: " + response,             },  Edit this to save in the same language as users query.  ### 👟 Reproduction steps  Just ask any question in different language  ### 👍 Expected behavior  Should save in the same language  ### 👎 Actual Behavior with Screenshots  -  ### 💻 Operating system  Linux  ### What browsers are you seeing the problem on?  _No response_  ### 🤖 What development environment are you experiencing this bug on?  Docker  ### 🔒 Did you set the correct environment variables in the right path? List the environment variable names (not values please!)  _No response_  ### 📃 Provide any additional context for the Bug.  _No response_  ### 📖 Relevant log output  ```shell  ```  ### 👀 Have you spent some time to check if this bug has been raised before?  - [x] I checked and didn't find similar issue  ### 🔗 Are you willing to submit PR?  No  ### 🧑‍⚖️ Code of Conduct  - [x] I agree to follow this project's Code of Conduct

- **Issue #1835** (2025-06-12): **🐛 Bug Report: Can't upload file with non-ASCII characters**
  *Symptoms*: ### 📜 Description  If the uploaded filename contains any non-ASCII characters the app breaks.   ### 👟 Reproduction steps  1. Try to upload a source (potentially an attachment also).  2. Choose any file which name contains contains non-ASCII characters (any non latin alphabet will work, feel free to use файл.pdf or 파일.pdf)  Specifying a separate name for the upload will also result in similar behaviour.    ### 👍 Expected behavior  We need to allow users to use non-ASCII characters in the filename or the name of the upload (`request.form["name"]`) We also need to keep sanitizing filenames that will be used by the app, but will not be displayed to the user.   ### 👎 Actual Behavior with Screenshots  The app stops working.   ### 💻 Operating system  MacOS  ### What browsers are you seeing the problem on?  Chrome  ### 🤖 What development environment are you experiencing this bug on?  Local dev server  ### 🔒 Did you set the correct environment variables in the right path? List the environment variable names (not values please!)  _No response_  ### 📃 Provide any additional context for the Bug.  The error happens due to this import: `from werkzeug.utils import secure_filename` This `secure_filename` function completely removes all non-ASCII characters and sometimes even more. And this leads to no docs being provided later. The problematic file is: `application/api/user/routes.py`. Specifically this route `@user_ns.route("/api/upload")`, but there might be more issues that I didn

- **Issue #1481** (2025-01-02): **🚀 Feature: Add Enter/Esc Functionality to "Rename" Chat **
  *Symptoms*: ### 🔖 Feature description  Add enter/escape key functionality to the chat rename option on the side bar for chats. This would allow the user to click their enter and escape key on their keyboard to either submit or cancel the rename rather than hovering their mouse over the checkmark or X.  ### 🎤 Why is this feature needed ?  In my use case, this feature would allow for a more convenient user experience as it allows for a quicker renaming process during real-time use of the product.   ### ✌️ How do you aim to achieve this?  I plan to add JavaScript code to implement this feature by using JavaScript to react to the events of "Enter" or "Esc" key presses. I will have the response react in a similar fashion to how the current mouse press actions behave regarding the checkmark/X options.   ### 🔄️ Additional Information  _No response_  ### 👀 Have you spent some time to check if this feature request has been raised before?  - [X] I checked and didn't find similar issue  ### Are you willing to submit PR?  Yes I am willing to submit a PR!
  **Post-Mortem & Fix Analysis**:
  > @aidanbennettjones Assigning to you, btw we use React and Typescript in /frontend. Thanks!
  > Hey @aidanbennettjones  any updates?
  > @aidanbennettjones Assuming inactivity on this issue.

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

### Incident Patch 1: `7c0a5880` (2026-10-05)
**Commit Message**: Merge pull request #2921 from lorenzozanee/fix/clickup-mcp-preset

Add ClickUp as an MCP connector preset

**File**: `docs/content/Sources/Connectors/index.mdx` (modified, +2/-2)
```diff
@@ -9,7 +9,7 @@ import { Steps } from 'nextra/components'
 
 # Connectors
 
-A connector is a service DocsGPT can connect to: Google Drive, SharePoint, Confluence, GitHub, Amazon S3, Reddit, Brave Search, Telegram, ntfy, PostgreSQL, curated MCP servers (Notion, Linear, Atlassian, Sentry, Stripe), and any MCP server or OpenAPI spec you add yourself. A **connection** is one signed-in account or one saved API key for a connector.
+A connector is a service DocsGPT can connect to: Google Drive, SharePoint, Confluence, GitHub, Amazon S3, Reddit, Brave Search, Telegram, ntfy, PostgreSQL, curated MCP servers (Notion, Linear, Atlassian, Sentry, Stripe, ClickUp), and any MCP server or OpenAPI spec you add yourself. A **connection** is one signed-in account or one saved API key for a connector.
 
 Connections are the single place credentials live. A synced source and an agent tool both point at a connection, so you sign in once, reconnect once when a token expires, and disconnect in one place.
 
@@ -299,7 +299,7 @@ Each post becomes one document with its title, subreddit, score, author and link
 
 ### MCP presets
 
-Notion, Linear, Atlassian, Sentry and Stripe are remote MCP servers that support OAuth with dynamic client registration, so they need no server settings. Members sign in with their own account. The presets ship in `docsgpt/connectors/presets/mcp.yaml`.
+Notion, Linear, Atlassian, Sentry, Stripe and ClickUp are remote MCP servers that support OAuth with dynamic client registration, so they need no server settings. Members sign in with their own account. The presets ship in `docsgpt/connectors/presets/mcp.yaml`.
 
 ### Linear
 
```

**File**: `docs/content/Tools/mcp-tools.mdx` (modified, +1/-1)
```diff
@@ -27,7 +27,7 @@ If not set, it is derived from the host of `CONNECTOR_REDIRECT_BASE_URI`, then f
 
 ### Step 2: Add an MCP Server
 
-Go to **Settings** > **Connectors** and pick a preset (Notion, Linear, Atlassian, Sentry, Stripe): **Sign in to Notion** opens the service's sign-in, and its tools are ready when you come back. For any other server, choose **Add custom connector** > **MCP server** and enter its URL and authentication; scopes and the timeout are under **Show advanced**. Enter the server URL, select an auth type, and click **Test Connection** to verify, then **Save**.
+Go to **Settings** > **Connectors** and pick a preset (Notion, Linear, Atlassian, Sentry, Stripe or ClickUp): **Sign in to ClickUp** opens the service's sign-in, and its tools are ready when you come back. For any other server, choose **Add custom connector** > **MCP server** and enter its URL and authentication; scopes and the timeout are under **Show advanced**. Enter the server URL, select an auth type, and click **Test Connection** to verify, then **Save**.
 
 ### Step 3: Enable for Your Agent
 
```

**File**: `docsgpt/connectors/presets/mcp.yaml` (modified, +10/-0)
```diff
@@ -65,3 +65,13 @@
   auth_kind: mcp_oauth
   capabilities: [read, write]
   docs_url: https://docs.stripe.com/mcp
+
+- key: mcp:clickup
+  name: ClickUp
+  description: Search, read and update ClickUp tasks, docs and lists, and add comments.
+  icon: clickup
+  category: projects
+  mcp_url: https://mcp.clickup.com/mcp
+  auth_kind: mcp_oauth
+  capabilities: [read, write]
+  docs_url: https://developer.clickup.com/docs/connect-an-ai-assistant-to-clickups-mcp-server
```

**File**: `frontend/src/assets/connectors/clickup.svg` (added, +1/-0)
```diff
@@ -0,0 +1 @@
+<svg fill="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M2 18.439l3.69-2.828c1.961 2.56 4.044 3.739 6.363 3.739 2.307 0 4.33-1.166 6.203-3.704L22 18.405C19.298 22.065 15.941 24 12.053 24 8.178 24 4.788 22.078 2 18.439zM12.04 6.15l-6.568 5.66-3.036-3.52L12.055 0l9.543 8.296-3.05 3.509z"/></svg>
```

**File**: `frontend/src/locale/de.json` (modified, +1/-0)
```diff
@@ -1432,6 +1432,7 @@
         "mcp_atlassian": "Jira-Issues und Confluence-Seiten durchsuchen und aktualisieren.",
         "mcp_sentry": "Sentry-Issues, -Events und -Releases nachschlagen.",
         "mcp_stripe": "Kunden, Zahlungen und Abonnements in Stripe nachschlagen.",
+        "mcp_clickup": "ClickUp-Aufgaben, Dokumente und Listen suchen, lesen und aktualisieren sowie Kommentare hinzufügen.",
         "github": "Repositorys in Wissen synchronisieren und Agenten Code, Issues und Pull Requests lesen lassen."
       },
       "empty": "Noch nichts verbunden. Verbinde einen Dienst, um seine Inhalte zu synchronisieren oder Agenten neue Werkzeuge zu geben.",
```

**File**: `frontend/src/locale/en.json` (modified, +1/-0)
```diff
@@ -1438,6 +1438,7 @@
         "mcp_atlassian": "Search and update Jira issues and Confluence pages.",
         "mcp_sentry": "Look up Sentry issues, events and releases.",
         "mcp_stripe": "Look up customers, payments and subscriptions in Stripe.",
+        "mcp_clickup": "Search, read and update ClickUp tasks, docs and lists, and add comments.",
         "github": "Sync repositories into Knowledge and let agents read code, issues and pull requests."
       },
       "empty": "Nothing connected yet. Connect a service to sync its content or give agents new tools.",
```

**File**: `frontend/src/locale/es.json` (modified, +1/-0)
```diff
@@ -1432,6 +1432,7 @@
         "mcp_atlassian": "Busca y actualiza incidencias de Jira y páginas de Confluence.",
         "mcp_sentry": "Consulta incidencias, eventos y versiones de Sentry.",
         "mcp_stripe": "Consulta clientes, pagos y suscripciones en Stripe.",
+        "mcp_clickup": "Busca, lee y actualiza tareas, documentos y listas de ClickUp, y añade comentarios.",
         "github": "Sincroniza repositorios con Conocimiento y deja que los agentes lean código, issues y pull requests."
       },
       "empty": "Aún no hay nada conectado. Conecta un servicio para sincronizar su contenido o dar nuevas herramientas a los agentes.",
```

**File**: `frontend/src/locale/jp.json` (modified, +1/-0)
```diff
@@ -1431,6 +1431,7 @@
         "mcp_atlassian": "Jira の課題と Confluence のページを検索、更新します。",
         "mcp_sentry": "Sentry の課題、イベント、リリースを調べます。",
         "mcp_stripe": "Stripe の顧客、支払い、サブスクリプションを調べます。",
+        "mcp_clickup": "ClickUp のタスク、ドキュメント、リストを検索、閲覧、更新し、コメントを追加します。",
         "github": "リポジトリをナレッジに同期し、エージェントがコード、Issue、プルリクエストを読めるようにします。"
       },
       "empty": "まだ何も接続されていません。サービスを接続すると、コンテンツを同期したり、エージェントに新しいツールを提供したりできます。",
```

---

### Incident Patch 2: `e7154f4f` (2026-10-05)
**Commit Message**: Merge pull request #2971 from arc53/feat/sandbox-exec-timeout

Let run_code take a longer timeout and allow compiled pip installs in the self-hosted sandbox

**File**: `.github/workflows/sandbox-image-verify.yml` (modified, +16/-3)
```diff
@@ -1,8 +1,8 @@
 name: Verify the sandbox image
 
 # Builds the code-execution runner image (deployment/sandbox) and runs its smoke
-# test the way kernels run: read-only root, /tmp as tmpfs, the scrubbed kernel
-# environment. The test imports every package in docsgpt/sandbox/manifest.py,
+# test the way kernels run: read-only root, /tmp as a noexec tmpfs, the kernels'
+# home on an exec-enabled tmpfs, the scrubbed kernel environment. The test imports every package in docsgpt/sandbox/manifest.py,
 # checks every command and font, and converts real files with LibreOffice,
 # Chromium, tesseract, poppler, ffmpeg and Node, so a Debian package rename or a
 # broken pin fails here instead of in a deployment.
@@ -13,6 +13,7 @@ on:
     paths:
       - 'deployment/sandbox/**'
       - 'docsgpt/sandbox/manifest.py'
+      - 'deployment/optional/docker-compose.optional.sandbox.yaml'
       - '.github/workflows/sandbox-image-verify.yml'
 
 permissions:
@@ -46,8 +47,20 @@ jobs:
           docker image inspect docsgpt-sandbox:verify --format '{{.Size}}' | awk '{printf "uncompressed: %.2f GB\n", $1/1e9}'
           docker history docsgpt-sandbox:verify --format '{{.Size}}\t{{.CreatedBy}}' | head -20
 
+      # The same mounts as deployment/optional/docker-compose.optional.sandbox.yaml:
+      # /tmp is Docker's default noexec tmpfs, /sandbox-home the kernels' exec-enabled home.
       - name: Smoke test (read-only root, as compose runs it)
         run: |
-          docker run --rm --read-only --tmpfs /tmp --memory 4g --shm-size 256m --pids-limit 1024 \
+          docker run --rm --read-only --tmpfs /tmp \
+            --tmpfs /sandbox-home:rw,exec,nosuid,nodev,size=1g,uid=10001,gid=10001,mode=0700 \
+            --memory 4g --shm-size 256m --pids-limit 1024 \
             docsgpt-sandbox:verify \
             /opt/docsgpt/kernel-env.sh python /opt/docsgpt/smoke_test.py --pip
+
+      - name: Without the home mount the kernel falls back to /tmp/home
+        run: |
+          out="$(docker run --rm --read-only --tmpfs /tmp docsgpt-sandbox:verify \
+            /opt/docsgpt/kernel-env.sh sh -c 'echo "HOME=$HOME"' 2>&1)"
+          echo "$out"
+          echo "$out" | grep -q '^HOME=/tmp/home$'
+          echo "$out" | grep -q 'kernel-env: no writable exec-enabled /sandbox-home mount'
```

**File**: `deployment/k8s/deployments/sandbox-deploy.yaml` (modified, +19/-7)
```diff
@@ -88,10 +88,11 @@ spec:
               value: /tmp/jupyter-data
           # Same budget as the compose overlay's SANDBOX_MEMORY default: the
           # gateway, the warm session kernels, and the LibreOffice (~170 MB) and
-          # headless Chromium (~110 MB) processes they start, plus the /tmp
-          # emptyDir if it is memory-backed. SANDBOX_MAX_SESSIONS caps each API
-          # and worker process separately; raise the limit (or lower that cap or
-          # SANDBOX_MAX_TTL) when many processes keep kernels warm at once.
+          # headless Chromium (~110 MB) processes they start, plus what the
+          # memory-backed /sandbox-home holds (up to its 1Gi sizeLimit).
+          # SANDBOX_MAX_SESSIONS caps each API and worker process separately;
+          # raise the limit (or lower that cap or SANDBOX_MAX_TTL) when many
+          # processes keep kernels warm at once.
           resources:
             limits:
               memory: "4Gi"
@@ -100,21 +101,32 @@ spec:
               memory: "512Mi"
               cpu: "250m"
           volumeMounts:
-            # Per-session workspaces, kernel HOME (/tmp/home) and Jupyter
-            # runtime files on an emptyDir; the root FS stays read-only
-            # everywhere else.
+            # Per-session workspaces and Jupyter runtime files on an emptyDir;
+            # the root FS stays read-only everywhere else.
             - name: scratch
               mountPath: /tmp
             # A larger /dev/shm for Chromium (the container default is 64 MB).
             - name: dshm
               mountPath: /dev/shm
+            # The kernels' HOME (/sandbox-home/home): runtime pip installs,
+            # pip's cache and the LibreOffice/Chromium dot-dirs. An emptyDir is
+            # never mounted noexec, so compiled packages installed at runtime
+            # load; the pod's allowPrivilegeEscalation=false and dropped
+            # capabilities still apply. Memory-backed to match the compose
+            # tmpfs: it counts against the memory limit as it fills.
+            - name: sandbox-home
+              mountPath: /sandbox-home
       volumes:
         - name: scratch
           emptyDir: {}
         - name: dshm
           emptyDir:
             medium: Memory
             sizeLimit: 256Mi
+        - name: sandbox-home
+          emptyDir:
+            medium: Memory
+            sizeLimit: 1Gi
 ---
 apiVersion: v1
 kind: Service
```

**File**: `deployment/optional/docker-compose.optional.sandbox.yaml` (modified, +11/-1)
```diff
@@ -79,15 +79,25 @@ services:
       # Do NOT add `env_file: ../.env` here -- the runner needs no other app secret.
       - SANDBOX_GATEWAY_AUTH_TOKEN=${SANDBOX_GATEWAY_AUTH_TOKEN:?set SANDBOX_GATEWAY_AUTH_TOKEN to a shared gateway token}
       # Idle seconds before the gateway shuts a kernel down; keep it above the
-      # app's SANDBOX_MAX_TTL (see gateway-launch.sh).
+      # app's SANDBOX_MAX_TTL (see gateway-launch.sh). A kernel running code is
+      # never culled, so long runs (SANDBOX_EXEC_MAX_TIMEOUT) need no more.
       - SANDBOX_KERNEL_IDLE_TIMEOUT=${SANDBOX_KERNEL_IDLE_TIMEOUT:-1800}
       # Keep Jupyter's runtime/connection files on the writable tmpfs.
       - JUPYTER_RUNTIME_DIR=/tmp/jupyter-runtime
       - JUPYTER_DATA_DIR=/tmp/jupyter-data
     tmpfs:
       # Per-session workspaces (/tmp/docsgpt-sandbox/<session_id>) and Jupyter
       # runtime files live on tmpfs; the root FS is read-only everywhere else.
+      # Docker mounts this one noexec,nosuid: nothing on /tmp can be run.
       - /tmp
+      # The kernels' HOME (/sandbox-home/home): `pip install --user` packages,
+      # pip's cache and the LibreOffice/Chromium/fontconfig dot-dirs. Unlike
+      # /tmp it allows exec, so a compiled package pip-installed at runtime can
+      # map its .so files; nosuid and nodev still refuse setuid binaries and
+      # device files. Owned by the sandbox uid with mode 0700. It is RAM: what
+      # is written here counts against mem_limit, up to SANDBOX_HOME_SIZE. A
+      # runner started without this mount falls back to a home under /tmp.
+      - /sandbox-home:rw,exec,nosuid,nodev,size=${SANDBOX_HOME_SIZE:-1g},uid=10001,gid=10001,mode=0700
     networks:
       # Reachable by backend/worker over the internal sandbox-net; internet egress
       # (runtime pip install, etc.) via the dedicated sandbox-egress net. NOT on
```

**File**: `deployment/sandbox/Dockerfile` (modified, +7/-3)
```diff
@@ -73,8 +73,11 @@ RUN if [ "$INSTALL_DOCLING" = "true" ]; then \
 # `env_file: ../.env` -- the scrubber blocks exfil from the kernel, but the
 # runner image itself should stay free of app secrets it has no use for.
 #
-# kernel-env.sh does the scrubbing and gives kernels a writable HOME under /tmp
-# (the root FS is read-only); sandbox.env is the image environment it passes on.
+# kernel-env.sh does the scrubbing and gives kernels a writable HOME (the root FS
+# is read-only): /sandbox-home/home on the exec-enabled tmpfs compose and k8s
+# mount there, so compiled packages pip-installed at runtime load, or /tmp/home
+# when the image runs without that mount. sandbox.env is the image environment
+# it passes on.
 # kernel-startup.py runs inside each kernel and drops the FORCE_COLOR ipykernel sets.
 COPY kernel-env.sh /opt/docsgpt/kernel-env.sh
 COPY kernel-launch.sh /opt/docsgpt/kernel-launch.sh
@@ -85,7 +88,8 @@ COPY kernels/docsgpt-python/kernel.json /usr/local/share/jupyter/kernels/docsgpt
 
 # Conversion helpers on PATH (html_render.py picks its mode from the name it is
 # run as), and the smoke test with the manifest it checks against:
-#   docker run --rm --read-only --tmpfs /tmp IMAGE \
+#   docker run --rm --read-only --tmpfs /tmp \
+#     --tmpfs /sandbox-home:rw,exec,nosuid,nodev,size=1g,uid=10001,gid=10001,mode=0700 IMAGE \
 #     /opt/docsgpt/kernel-env.sh python /opt/docsgpt/smoke_test.py
 COPY helpers/office_convert.py /usr/local/bin/office-convert
 COPY helpers/html_render.py /usr/local/bin/html-to-pdf
```

**File**: `deployment/sandbox/README.md` (modified, +58/-16)
```diff
@@ -138,7 +138,8 @@ of these:
   (pointing `argv` at a local copy of `kernel-launch.sh`, with `kernel-env.sh`,
   `kernel-startup.py` and `sandbox.env` copied next to it) into a Jupyter data dir on the
   kernelspec search path. The default kernel name then works. Kernels get
-  `HOME=/tmp/home` unless you set `SANDBOX_KERNEL_HOME` on the gateway.
+  `HOME=/sandbox-home/home` when that mount exists and allows exec, otherwise
+  `/tmp/home`, unless you set `SANDBOX_KERNEL_HOME` on the gateway.
 - Or set `SANDBOX_KERNEL_NAME=python3` in the app's `.env`. The stock spec
   inherits the gateway's full env (no secret scrubbing), so use it only for
   single-trust dev.
@@ -230,14 +231,35 @@ pdfplumber, pypdf or pypdfium2.
 
 The root filesystem is read-only (compose `read_only: true`, k8s
 `readOnlyRootFilesystem`), so `kernel-env.sh` gives every kernel a writable
-`HOME` under `/tmp` (`/tmp/home`, or `SANDBOX_KERNEL_HOME` on the runner) and
-points `XDG_CONFIG_HOME`, `XDG_CACHE_HOME` and `PYTHONUSERBASE` into it.
-LibreOffice, Chromium, fontconfig, npm and `pip install` (which falls back to a
-user install) all write there. Before this, `pip install` inside the runner
-failed with `Read-only file system: '/home/sandbox/.local'`. The script also
-creates the user site-packages directory before the kernel starts, so a package
-installed from a running kernel imports without a restart. All sessions share
-that `HOME`, like the rest of the container (see *Isolation model*).
+`HOME` and points `XDG_CONFIG_HOME`, `XDG_CACHE_HOME` and `PYTHONUSERBASE` into
+it. LibreOffice, Chromium, fontconfig, npm and `pip install` (which falls back
+to a user install, with its cache under `XDG_CACHE_HOME`) all write there. The
+script also creates the user site-packages directory before the kernel starts,
+so a package installed from a running kernel imports without a restart. All
+sessions share that `HOME`, like the rest of the container (see *Isolation
+model*).
+
+Where `HOME` goes, first match wins:
+
+1. `SANDBOX_KERNEL_HOME`, when set on the runner.
+2. `/sandbox-home/home`, when `/sandbox-home` (`SANDBOX_HOME_MOUNT`) is a
+   writable mount that is not `noexec`. The compose overlay mounts it as a
+   tmpfs with `rw,exec,nosuid,nodev,size=${SANDBOX_HOME_SIZE:-1g},uid=10001,gid=10001,mode=0700`;
+   the k8s manifest mounts a memory-backed `emptyDir` (1Gi `sizeLimit`), which
+   is never `noexec`.
+3. `/tmp/home` (`SANDBOX_TMP_HOME`), with one line on the gateway's stderr.
+
+Docker mounts a compose `tmpfs:` entry `noexec,nosuid` unless told otherwise,
+so a package with compiled code pip-installed under `/tmp/home` failed to load
+with `failed to map segment from shared object`; pure-Python packages worked.
+Under compose the separate home mount allows exec for that one directory only:
+`/tmp`, where the session workspaces live, stays `noexec`, and `nosuid,nodev`
+still refuse setuid binaries and device files. Both compose mounts are RAM and
+count against the container's memory limit as they fill. On Kubernetes `/tmp` is
+the `scratch` `emptyDir` (node disk, not `noexec`) and only `/sandbox-home` is
+memory-backed, counting against the pod's memory limit. Either way kernel code
+can already run anything through the Python interpreter, so exec on its own
+home adds no new capability beyond loading the extensions it installed.
 
 ipykernel sets `FORCE_COLOR=1` and `CLICOLOR_FORCE=1` once the kernel is up, so
 Node, npm and pip coloured their output even into a pipe and the model read
@@ -249,14 +271,22 @@ escape codes. `kernel-launch.sh` runs `kernel-startup.py` in every kernel
 `smoke_test.py` runs inside the image: it imports every manifest package,
 checks every command and font, and converts real files (docx and pptx to PDF,
 HTML to PDF and PNG, OCR, pdftotext, Node, an animated GIF and WebP, and an
-H.264 MP4 checked with ffprobe). Run it the way kernels run:
+H.264 MP4 checked with ffprobe). `--pip` also pip-installs a pure-Python
+package and one with a compiled extension (`ujson`) and imports them, the
+second in a new process. Run it the way kernels run, with the compose mounts:
 
 ```bash
 docker build -t docsgpt-sandbox deployment/sandbox
-docker run --rm --read-only --tmpfs /tmp docsgpt-sandbox \
-  /opt/docsgpt/kernel-env.sh python /opt/docsgpt/smoke_test.py   # add --pip to test pip installs
+docker run --rm --read-only --tmpfs /tmp \
+  --tmpfs /sandbox-home:rw,exec,nosuid,nodev,size=1g,uid=10001,gid=10001,mode=0700 \
+  docsgpt-sandbox \
+  /opt/docsgpt/kernel-env.sh python /opt/docsgpt/smoke_test.py --pip
 ```
 
+The `Verify the sandbox image` workflow runs the same command on every change
+under `deployment/sandbox/`, then checks that the image without the home mount
+falls back to `/tmp/home`.
+
 For the Daytona snapshot, `python scripts/build_daytona_snapshot.py --smoke`
 runs it in a sandbox made from the snapshot.
 
@@ -269,17 +299,29 @@ sessions, so a kernel held by an API or worker process that restarte
```

**File**: `deployment/sandbox/gateway-launch.sh` (modified, +4/-0)
```diff
@@ -30,6 +30,10 @@ fi
 # session's kernel between calls and retires it after SANDBOX_MAX_TTL idle seconds
 # (1200 by default); this cull is the backstop for kernels no app process will
 # retire, e.g. ones held by a worker that restarted. Keep it above SANDBOX_MAX_TTL.
+# A run's length (up to the app's SANDBOX_EXEC_MAX_TIMEOUT, 1000 s by default)
+# does not add to it: the gateway never culls a busy kernel or one with an open
+# connection (cull_busy and cull_connected stay False), and both idle clocks
+# restart when the run ends.
 IDLE_TIMEOUT="${SANDBOX_KERNEL_IDLE_TIMEOUT:-1800}"
 
 # ip=0.0.0.0 so the backend/worker can reach it over the internal sandbox network.
```

**File**: `deployment/sandbox/kernel-env.sh` (modified, +41/-5)
```diff
@@ -10,22 +10,58 @@
 #
 # Kept: PATH (find python), LANG (encoding) and the Jupyter runtime/data dirs
 # (writable tmpfs paths). Set here:
-#   HOME, XDG_CONFIG_HOME, XDG_CACHE_HOME, PYTHONUSERBASE -- a writable home
-#     under /tmp (SANDBOX_KERNEL_HOME), because the root filesystem is read-only
-#     and LibreOffice, Chromium, fontconfig, npm and `pip install --user` all
+#   HOME, XDG_CONFIG_HOME, XDG_CACHE_HOME, PYTHONUSERBASE -- a writable home,
+#     because the root filesystem is read-only and LibreOffice, Chromium,
+#     fontconfig, npm and `pip install --user` (packages and pip's cache) all
 #     write under HOME. Its .local/bin is appended to PATH for pip-installed
 #     commands.
 #   Every NAME=value line of sandbox.env next to this script -- the image
 #     environment from docsgpt/sandbox/manifest.py (generated; do not edit it).
 #
+# Where HOME goes, first match wins:
+#   1. SANDBOX_KERNEL_HOME, when set.
+#   2. $SANDBOX_HOME_MOUNT/home (default /sandbox-home/home) when that mount is
+#      there, writable and not noexec. Compose and Kubernetes mount it as a
+#      tmpfs that allows exec (still nosuid,nodev), so a compiled package
+#      pip-installed at runtime can map its .so files. /tmp stays noexec.
+#   3. $SANDBOX_TMP_HOME (default /tmp/home), with a one-line note on stderr:
+#      the image was started without the mount (an older compose file, a plain
+#      `docker run`). Everything works except compiled packages installed at
+#      runtime, which fail with "failed to map segment from shared object".
+# SANDBOX_PROC_MOUNTS (default /proc/mounts) is where the mount options are read.
+#
 # The image's smoke test runs the same way:
-#   docker run --rm --read-only --tmpfs /tmp IMAGE \
+#   docker run --rm --read-only --tmpfs /tmp \
+#     --tmpfs /sandbox-home:rw,exec,nosuid,nodev,size=1g,uid=10001,gid=10001,mode=0700 IMAGE \
 #     /opt/docsgpt/kernel-env.sh python /opt/docsgpt/smoke_test.py
 set -eu
 
-KERNEL_HOME="${SANDBOX_KERNEL_HOME:-/tmp/home}"
+HOME_MOUNT="${SANDBOX_HOME_MOUNT:-/sandbox-home}"
+TMP_HOME="${SANDBOX_TMP_HOME:-/tmp/home}"
+PROC_MOUNTS="${SANDBOX_PROC_MOUNTS:-/proc/mounts}"
 ENV_FILE="$(dirname "$0")/sandbox.env"
 
+# True when $1 is a writable directory whose mount does not forbid exec.
+exec_mount() {
+    [ -d "$1" ] && [ -w "$1" ] || return 1
+    [ -r "$PROC_MOUNTS" ] || return 0
+    # Field 2 is the mount point, field 4 its options; the last entry for a path wins.
+    options="$(awk -v dir="$1" '$2 == dir { opts = $4 } END { print opts }' "$PROC_MOUNTS")"
+    case ",$options," in
+        *,noexec,*) return 1 ;;
+    esac
+    return 0
+}
+
+if [ -n "${SANDBOX_KERNEL_HOME:-}" ]; then
+    KERNEL_HOME="$SANDBOX_KERNEL_HOME"
+elif exec_mount "$HOME_MOUNT"; then
+    KERNEL_HOME="$HOME_MOUNT/home"
+else
+    KERNEL_HOME="$TMP_HOME"
+    echo "kernel-env: no writable exec-enabled $HOME_MOUNT mount; HOME is $KERNEL_HOME, where compiled packages pip-installed at runtime fail to load if it is noexec (as /tmp is under compose)" >&2
+fi
+
 mkdir -p -m 0700 "$KERNEL_HOME"
 mkdir -p "$KERNEL_HOME/.config" "$KERNEL_HOME/.cache" "$KERNEL_HOME/.local/bin"
 
```

**File**: `deployment/sandbox/smoke_test.py` (modified, +28/-5)
```diff
@@ -4,8 +4,9 @@
 Run it in the image the way kernels run, so the environment checks see what
 model-written code sees::
 
-    # self-hosted runner image (read-only root, like compose and k8s):
-    docker run --rm --read-only --tmpfs /tmp IMAGE \\
+    # self-hosted runner image (read-only root and the two tmpfs mounts, like compose):
+    docker run --rm --read-only --tmpfs /tmp \\
+        --tmpfs /sandbox-home:rw,exec,nosuid,nodev,size=1g,uid=10001,gid=10001,mode=0700 IMAGE \\
         /opt/docsgpt/kernel-env.sh python /opt/docsgpt/smoke_test.py
     # Daytona snapshot: scripts/build_daytona_snapshot.py --smoke
 
@@ -18,8 +19,10 @@
 PDF and PNG with headless Chromium, OCR of a rendered image, pdftotext and
 pdfplumber on a generated PDF, Node and npm, an animated GIF and WebP through
 imageio, and an H.264 MP4 through the ffmpeg command, checked with ffprobe.
-``--pip`` also pip-installs a small package as the sandbox user and imports it
-in the running interpreter (needs network).
+``--pip`` also pip-installs two small packages as the sandbox user (needs
+network): a pure-Python one imported in the running interpreter, and one with a
+compiled extension imported in a new process, which loads only when the home is
+on an exec-enabled mount (``/sandbox-home``; ``/tmp`` is noexec).
 
 Each check prints PASS or FAIL; the exit code is 1 if any failed. Only the
 stdlib and the image's own packages are used.
@@ -320,6 +323,23 @@ def check_pip_user_install(work: Path) -> str:
     return f"tabulate imported from {Path(module.__file__).parent}"
 
 
+# A package with a C extension and no pure-Python fallback, with manylinux wheels
+# for amd64 and arm64: if its .so cannot be mapped, the import fails.
+_COMPILED_PACKAGE = "ujson==6.0.0"
+
+
+def check_pip_compiled_extension(work: Path) -> str:
+    """pip install a compiled package, then import it in a new process (the next call, or a new kernel)."""
+    _run(
+        [sys.executable, "-m", "pip", "install", "--no-deps", "--only-binary=:all:", "--quiet", _COMPILED_PACKAGE],
+        timeout=180,
+    )
+    proc = _run([sys.executable, "-c", "import ujson; print(ujson.__file__); print(ujson.dumps({'ok': 1}))"])
+    path, dumped = proc.stdout.strip().splitlines()[-2:]
+    _expect(dumped == '{"ok":1}', f"ujson returned {dumped!r}")
+    return f"ujson loaded from {path}"
+
+
 # -- Runner --------------------------------------------------------------------
 
 
@@ -348,6 +368,9 @@ def sub(name: str) -> Path:
     ]
     if with_pip:
         checks.append(("pip install --user + import", lambda: check_pip_user_install(sub("pip"))))
+        checks.append(
+            ("pip install of a compiled package + import", lambda: check_pip_compiled_extension(sub("pip-compiled")))
+        )
     return checks
 
 
@@ -362,7 +385,7 @@ def main(argv: Optional[List[str]] = None) -> int:
     """
     parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
     parser.add_argument("--manifest", type=Path, default=_DEFAULT_MANIFEST, help="path to manifest.json")
-    parser.add_argument("--pip", action="store_true", help="also pip-install a package and import it (network)")
+    parser.add_argument("--pip", action="store_true", help="also pip-install packages and import them (network)")
     args = parser.parse_args(argv)
     manifest = json.loads(args.manifest.read_text())
 
```

---

### Incident Patch 3: `024fb8a3` (2026-10-05)
**Commit Message**: Let run_code take a longer timeout and allow compiled pip installs in the self-hosted sandbox

run_code takes a timeout (default SANDBOX_EXEC_TIMEOUT, clamped to the new
SANDBOX_EXEC_MAX_TIMEOUT, 1000 s). Every layer honours it: the Jupyter exec
deadline and reads, Daytona code_run (whose 408 timeout is now reported as a
timeout), and a Daytona activity refresh while a run could outlast the
auto-stop window. The reconciler no longer fails a proposed tool call whose
stream is still heartbeating.

A kernel that dies mid-run ends the call at once and is reported as out of
memory when the container's OOM-kill counter rose; Daytona exit 137 likewise.
New hints cover a larger timeout and running out of memory.

The runner mounts an exec-enabled tmpfs at /sandbox-home for the kernels'
home (compose tmpfs, k8s memory emptyDir) so compiled packages installed at
runtime load; /tmp stays noexec, and an image run without the mount falls
back to /tmp/home with a one-line note. The smoke test pip-installs ujson and
imports it in a new process.

**File**: `.github/workflows/sandbox-image-verify.yml` (modified, +16/-3)
```diff
@@ -1,8 +1,8 @@
 name: Verify the sandbox image
 
 # Builds the code-execution runner image (deployment/sandbox) and runs its smoke
-# test the way kernels run: read-only root, /tmp as tmpfs, the scrubbed kernel
-# environment. The test imports every package in docsgpt/sandbox/manifest.py,
+# test the way kernels run: read-only root, /tmp as a noexec tmpfs, the kernels'
+# home on an exec-enabled tmpfs, the scrubbed kernel environment. The test imports every package in docsgpt/sandbox/manifest.py,
 # checks every command and font, and converts real files with LibreOffice,
 # Chromium, tesseract, poppler, ffmpeg and Node, so a Debian package rename or a
 # broken pin fails here instead of in a deployment.
@@ -13,6 +13,7 @@ on:
     paths:
       - 'deployment/sandbox/**'
       - 'docsgpt/sandbox/manifest.py'
+      - 'deployment/optional/docker-compose.optional.sandbox.yaml'
       - '.github/workflows/sandbox-image-verify.yml'
 
 permissions:
@@ -46,8 +47,20 @@ jobs:
           docker image inspect docsgpt-sandbox:verify --format '{{.Size}}' | awk '{printf "uncompressed: %.2f GB\n", $1/1e9}'
           docker history docsgpt-sandbox:verify --format '{{.Size}}\t{{.CreatedBy}}' | head -20
 
+      # The same mounts as deployment/optional/docker-compose.optional.sandbox.yaml:
+      # /tmp is Docker's default noexec tmpfs, /sandbox-home the kernels' exec-enabled home.
       - name: Smoke test (read-only root, as compose runs it)
         run: |
-          docker run --rm --read-only --tmpfs /tmp --memory 4g --shm-size 256m --pids-limit 1024 \
+          docker run --rm --read-only --tmpfs /tmp \
+            --tmpfs /sandbox-home:rw,exec,nosuid,nodev,size=1g,uid=10001,gid=10001,mode=0700 \
+            --memory 4g --shm-size 256m --pids-limit 1024 \
             docsgpt-sandbox:verify \
             /opt/docsgpt/kernel-env.sh python /opt/docsgpt/smoke_test.py --pip
+
+      - name: Without the home mount the kernel falls back to /tmp/home
+        run: |
+          out="$(docker run --rm --read-only --tmpfs /tmp docsgpt-sandbox:verify \
+            /opt/docsgpt/kernel-env.sh sh -c 'echo "HOME=$HOME"' 2>&1)"
+          echo "$out"
+          echo "$out" | grep -q '^HOME=/tmp/home$'
+          echo "$out" | grep -q 'kernel-env: no writable exec-enabled /sandbox-home mount'
```

**File**: `deployment/k8s/deployments/sandbox-deploy.yaml` (modified, +19/-7)
```diff
@@ -88,10 +88,11 @@ spec:
               value: /tmp/jupyter-data
           # Same budget as the compose overlay's SANDBOX_MEMORY default: the
           # gateway, the warm session kernels, and the LibreOffice (~170 MB) and
-          # headless Chromium (~110 MB) processes they start, plus the /tmp
-          # emptyDir if it is memory-backed. SANDBOX_MAX_SESSIONS caps each API
-          # and worker process separately; raise the limit (or lower that cap or
-          # SANDBOX_MAX_TTL) when many processes keep kernels warm at once.
+          # headless Chromium (~110 MB) processes they start, plus what the
+          # memory-backed /sandbox-home holds (up to its 1Gi sizeLimit).
+          # SANDBOX_MAX_SESSIONS caps each API and worker process separately;
+          # raise the limit (or lower that cap or SANDBOX_MAX_TTL) when many
+          # processes keep kernels warm at once.
           resources:
             limits:
               memory: "4Gi"
@@ -100,21 +101,32 @@ spec:
               memory: "512Mi"
               cpu: "250m"
           volumeMounts:
-            # Per-session workspaces, kernel HOME (/tmp/home) and Jupyter
-            # runtime files on an emptyDir; the root FS stays read-only
-            # everywhere else.
+            # Per-session workspaces and Jupyter runtime files on an emptyDir;
+            # the root FS stays read-only everywhere else.
             - name: scratch
               mountPath: /tmp
             # A larger /dev/shm for Chromium (the container default is 64 MB).
             - name: dshm
               mountPath: /dev/shm
+            # The kernels' HOME (/sandbox-home/home): runtime pip installs,
+            # pip's cache and the LibreOffice/Chromium dot-dirs. An emptyDir is
+            # never mounted noexec, so compiled packages installed at runtime
+            # load; the pod's allowPrivilegeEscalation=false and dropped
+            # capabilities still apply. Memory-backed to match the compose
+            # tmpfs: it counts against the memory limit as it fills.
+            - name: sandbox-home
+              mountPath: /sandbox-home
       volumes:
         - name: scratch
           emptyDir: {}
         - name: dshm
           emptyDir:
             medium: Memory
             sizeLimit: 256Mi
+        - name: sandbox-home
+          emptyDir:
+            medium: Memory
+            sizeLimit: 1Gi
 ---
 apiVersion: v1
 kind: Service
```

**File**: `deployment/optional/docker-compose.optional.sandbox.yaml` (modified, +11/-1)
```diff
@@ -79,15 +79,25 @@ services:
       # Do NOT add `env_file: ../.env` here -- the runner needs no other app secret.
       - SANDBOX_GATEWAY_AUTH_TOKEN=${SANDBOX_GATEWAY_AUTH_TOKEN:?set SANDBOX_GATEWAY_AUTH_TOKEN to a shared gateway token}
       # Idle seconds before the gateway shuts a kernel down; keep it above the
-      # app's SANDBOX_MAX_TTL (see gateway-launch.sh).
+      # app's SANDBOX_MAX_TTL (see gateway-launch.sh). A kernel running code is
+      # never culled, so long runs (SANDBOX_EXEC_MAX_TIMEOUT) need no more.
       - SANDBOX_KERNEL_IDLE_TIMEOUT=${SANDBOX_KERNEL_IDLE_TIMEOUT:-1800}
       # Keep Jupyter's runtime/connection files on the writable tmpfs.
       - JUPYTER_RUNTIME_DIR=/tmp/jupyter-runtime
       - JUPYTER_DATA_DIR=/tmp/jupyter-data
     tmpfs:
       # Per-session workspaces (/tmp/docsgpt-sandbox/<session_id>) and Jupyter
       # runtime files live on tmpfs; the root FS is read-only everywhere else.
+      # Docker mounts this one noexec,nosuid: nothing on /tmp can be run.
       - /tmp
+      # The kernels' HOME (/sandbox-home/home): `pip install --user` packages,
+      # pip's cache and the LibreOffice/Chromium/fontconfig dot-dirs. Unlike
+      # /tmp it allows exec, so a compiled package pip-installed at runtime can
+      # map its .so files; nosuid and nodev still refuse setuid binaries and
+      # device files. Owned by the sandbox uid with mode 0700. It is RAM: what
+      # is written here counts against mem_limit, up to SANDBOX_HOME_SIZE. A
+      # runner started without this mount falls back to a home under /tmp.
+      - /sandbox-home:rw,exec,nosuid,nodev,size=${SANDBOX_HOME_SIZE:-1g},uid=10001,gid=10001,mode=0700
     networks:
       # Reachable by backend/worker over the internal sandbox-net; internet egress
       # (runtime pip install, etc.) via the dedicated sandbox-egress net. NOT on
```

**File**: `deployment/sandbox/Dockerfile` (modified, +7/-3)
```diff
@@ -73,8 +73,11 @@ RUN if [ "$INSTALL_DOCLING" = "true" ]; then \
 # `env_file: ../.env` -- the scrubber blocks exfil from the kernel, but the
 # runner image itself should stay free of app secrets it has no use for.
 #
-# kernel-env.sh does the scrubbing and gives kernels a writable HOME under /tmp
-# (the root FS is read-only); sandbox.env is the image environment it passes on.
+# kernel-env.sh does the scrubbing and gives kernels a writable HOME (the root FS
+# is read-only): /sandbox-home/home on the exec-enabled tmpfs compose and k8s
+# mount there, so compiled packages pip-installed at runtime load, or /tmp/home
+# when the image runs without that mount. sandbox.env is the image environment
+# it passes on.
 # kernel-startup.py runs inside each kernel and drops the FORCE_COLOR ipykernel sets.
 COPY kernel-env.sh /opt/docsgpt/kernel-env.sh
 COPY kernel-launch.sh /opt/docsgpt/kernel-launch.sh
@@ -85,7 +88,8 @@ COPY kernels/docsgpt-python/kernel.json /usr/local/share/jupyter/kernels/docsgpt
 
 # Conversion helpers on PATH (html_render.py picks its mode from the name it is
 # run as), and the smoke test with the manifest it checks against:
-#   docker run --rm --read-only --tmpfs /tmp IMAGE \
+#   docker run --rm --read-only --tmpfs /tmp \
+#     --tmpfs /sandbox-home:rw,exec,nosuid,nodev,size=1g,uid=10001,gid=10001,mode=0700 IMAGE \
 #     /opt/docsgpt/kernel-env.sh python /opt/docsgpt/smoke_test.py
 COPY helpers/office_convert.py /usr/local/bin/office-convert
 COPY helpers/html_render.py /usr/local/bin/html-to-pdf
```

**File**: `deployment/sandbox/README.md` (modified, +56/-16)
```diff
@@ -138,7 +138,8 @@ of these:
   (pointing `argv` at a local copy of `kernel-launch.sh`, with `kernel-env.sh`,
   `kernel-startup.py` and `sandbox.env` copied next to it) into a Jupyter data dir on the
   kernelspec search path. The default kernel name then works. Kernels get
-  `HOME=/tmp/home` unless you set `SANDBOX_KERNEL_HOME` on the gateway.
+  `HOME=/sandbox-home/home` when that mount exists and allows exec, otherwise
+  `/tmp/home`, unless you set `SANDBOX_KERNEL_HOME` on the gateway.
 - Or set `SANDBOX_KERNEL_NAME=python3` in the app's `.env`. The stock spec
   inherits the gateway's full env (no secret scrubbing), so use it only for
   single-trust dev.
@@ -230,14 +231,33 @@ pdfplumber, pypdf or pypdfium2.
 
 The root filesystem is read-only (compose `read_only: true`, k8s
 `readOnlyRootFilesystem`), so `kernel-env.sh` gives every kernel a writable
-`HOME` under `/tmp` (`/tmp/home`, or `SANDBOX_KERNEL_HOME` on the runner) and
-points `XDG_CONFIG_HOME`, `XDG_CACHE_HOME` and `PYTHONUSERBASE` into it.
-LibreOffice, Chromium, fontconfig, npm and `pip install` (which falls back to a
-user install) all write there. Before this, `pip install` inside the runner
-failed with `Read-only file system: '/home/sandbox/.local'`. The script also
-creates the user site-packages directory before the kernel starts, so a package
-installed from a running kernel imports without a restart. All sessions share
-that `HOME`, like the rest of the container (see *Isolation model*).
+`HOME` and points `XDG_CONFIG_HOME`, `XDG_CACHE_HOME` and `PYTHONUSERBASE` into
+it. LibreOffice, Chromium, fontconfig, npm and `pip install` (which falls back
+to a user install, with its cache under `XDG_CACHE_HOME`) all write there. The
+script also creates the user site-packages directory before the kernel starts,
+so a package installed from a running kernel imports without a restart. All
+sessions share that `HOME`, like the rest of the container (see *Isolation
+model*).
+
+Where `HOME` goes, first match wins:
+
+1. `SANDBOX_KERNEL_HOME`, when set on the runner.
+2. `/sandbox-home/home`, when `/sandbox-home` (`SANDBOX_HOME_MOUNT`) is a
+   writable mount that is not `noexec`. The compose overlay mounts it as a
+   tmpfs with `rw,exec,nosuid,nodev,size=${SANDBOX_HOME_SIZE:-1g},uid=10001,gid=10001,mode=0700`;
+   the k8s manifest mounts a memory-backed `emptyDir` (1Gi `sizeLimit`), which
+   is never `noexec`.
+3. `/tmp/home` (`SANDBOX_TMP_HOME`), with one line on the gateway's stderr.
+
+Docker mounts a compose `tmpfs:` entry `noexec,nosuid` unless told otherwise,
+so a package with compiled code pip-installed under `/tmp/home` failed to load
+with `failed to map segment from shared object`; pure-Python packages worked.
+The separate home mount allows exec for that one directory only: `/tmp`, where
+the session workspaces live, stays `noexec`, and `nosuid,nodev` still refuse
+setuid binaries and device files. Kernel code can already run anything through
+the Python interpreter, so exec on its own home adds no new capability beyond
+loading the extensions it installed. Both mounts are RAM and count against the
+container's memory limit as they fill.
 
 ipykernel sets `FORCE_COLOR=1` and `CLICOLOR_FORCE=1` once the kernel is up, so
 Node, npm and pip coloured their output even into a pipe and the model read
@@ -249,14 +269,22 @@ escape codes. `kernel-launch.sh` runs `kernel-startup.py` in every kernel
 `smoke_test.py` runs inside the image: it imports every manifest package,
 checks every command and font, and converts real files (docx and pptx to PDF,
 HTML to PDF and PNG, OCR, pdftotext, Node, an animated GIF and WebP, and an
-H.264 MP4 checked with ffprobe). Run it the way kernels run:
+H.264 MP4 checked with ffprobe). `--pip` also pip-installs a pure-Python
+package and one with a compiled extension (`ujson`) and imports them, the
+second in a new process. Run it the way kernels run, with the compose mounts:
 
 ```bash
 docker build -t docsgpt-sandbox deployment/sandbox
-docker run --rm --read-only --tmpfs /tmp docsgpt-sandbox \
-  /opt/docsgpt/kernel-env.sh python /opt/docsgpt/smoke_test.py   # add --pip to test pip installs
+docker run --rm --read-only --tmpfs /tmp \
+  --tmpfs /sandbox-home:rw,exec,nosuid,nodev,size=1g,uid=10001,gid=10001,mode=0700 \
+  docsgpt-sandbox \
+  /opt/docsgpt/kernel-env.sh python /opt/docsgpt/smoke_test.py --pip
 ```
 
+The `Verify the sandbox image` workflow runs the same command on every change
+under `deployment/sandbox/`, then checks that the image without the home mount
+falls back to `/tmp/home`.
+
 For the Daytona snapshot, `python scripts/build_daytona_snapshot.py --smoke`
 runs it in a sandbox made from the snapshot.
 
@@ -269,17 +297,29 @@ sessions, so a kernel held by an API or worker process that restarted would
 otherwise live until the runner restarts. `gateway-launch.sh` therefore has the
 gateway shut down any kernel idle for `SANDBOX_KERNEL_IDLE_TIMEOUT` seconds
 (1800 by default); keep it 
```

**File**: `deployment/sandbox/gateway-launch.sh` (modified, +4/-0)
```diff
@@ -30,6 +30,10 @@ fi
 # session's kernel between calls and retires it after SANDBOX_MAX_TTL idle seconds
 # (1200 by default); this cull is the backstop for kernels no app process will
 # retire, e.g. ones held by a worker that restarted. Keep it above SANDBOX_MAX_TTL.
+# A run's length (up to the app's SANDBOX_EXEC_MAX_TIMEOUT, 1000 s by default)
+# does not add to it: the gateway never culls a busy kernel or one with an open
+# connection (cull_busy and cull_connected stay False), and both idle clocks
+# restart when the run ends.
 IDLE_TIMEOUT="${SANDBOX_KERNEL_IDLE_TIMEOUT:-1800}"
 
 # ip=0.0.0.0 so the backend/worker can reach it over the internal sandbox network.
```

**File**: `deployment/sandbox/kernel-env.sh` (modified, +41/-5)
```diff
@@ -10,22 +10,58 @@
 #
 # Kept: PATH (find python), LANG (encoding) and the Jupyter runtime/data dirs
 # (writable tmpfs paths). Set here:
-#   HOME, XDG_CONFIG_HOME, XDG_CACHE_HOME, PYTHONUSERBASE -- a writable home
-#     under /tmp (SANDBOX_KERNEL_HOME), because the root filesystem is read-only
-#     and LibreOffice, Chromium, fontconfig, npm and `pip install --user` all
+#   HOME, XDG_CONFIG_HOME, XDG_CACHE_HOME, PYTHONUSERBASE -- a writable home,
+#     because the root filesystem is read-only and LibreOffice, Chromium,
+#     fontconfig, npm and `pip install --user` (packages and pip's cache) all
 #     write under HOME. Its .local/bin is appended to PATH for pip-installed
 #     commands.
 #   Every NAME=value line of sandbox.env next to this script -- the image
 #     environment from docsgpt/sandbox/manifest.py (generated; do not edit it).
 #
+# Where HOME goes, first match wins:
+#   1. SANDBOX_KERNEL_HOME, when set.
+#   2. $SANDBOX_HOME_MOUNT/home (default /sandbox-home/home) when that mount is
+#      there, writable and not noexec. Compose and Kubernetes mount it as a
+#      tmpfs that allows exec (still nosuid,nodev), so a compiled package
+#      pip-installed at runtime can map its .so files. /tmp stays noexec.
+#   3. $SANDBOX_TMP_HOME (default /tmp/home), with a one-line note on stderr:
+#      the image was started without the mount (an older compose file, a plain
+#      `docker run`). Everything works except compiled packages installed at
+#      runtime, which fail with "failed to map segment from shared object".
+# SANDBOX_PROC_MOUNTS (default /proc/mounts) is where the mount options are read.
+#
 # The image's smoke test runs the same way:
-#   docker run --rm --read-only --tmpfs /tmp IMAGE \
+#   docker run --rm --read-only --tmpfs /tmp \
+#     --tmpfs /sandbox-home:rw,exec,nosuid,nodev,size=1g,uid=10001,gid=10001,mode=0700 IMAGE \
 #     /opt/docsgpt/kernel-env.sh python /opt/docsgpt/smoke_test.py
 set -eu
 
-KERNEL_HOME="${SANDBOX_KERNEL_HOME:-/tmp/home}"
+HOME_MOUNT="${SANDBOX_HOME_MOUNT:-/sandbox-home}"
+TMP_HOME="${SANDBOX_TMP_HOME:-/tmp/home}"
+PROC_MOUNTS="${SANDBOX_PROC_MOUNTS:-/proc/mounts}"
 ENV_FILE="$(dirname "$0")/sandbox.env"
 
+# True when $1 is a writable directory whose mount does not forbid exec.
+exec_mount() {
+    [ -d "$1" ] && [ -w "$1" ] || return 1
+    [ -r "$PROC_MOUNTS" ] || return 0
+    # Field 2 is the mount point, field 4 its options; the last entry for a path wins.
+    options="$(awk -v dir="$1" '$2 == dir { opts = $4 } END { print opts }' "$PROC_MOUNTS")"
+    case ",$options," in
+        *,noexec,*) return 1 ;;
+    esac
+    return 0
+}
+
+if [ -n "${SANDBOX_KERNEL_HOME:-}" ]; then
+    KERNEL_HOME="$SANDBOX_KERNEL_HOME"
+elif exec_mount "$HOME_MOUNT"; then
+    KERNEL_HOME="$HOME_MOUNT/home"
+else
+    KERNEL_HOME="$TMP_HOME"
+    echo "kernel-env: no writable exec-enabled $HOME_MOUNT mount; HOME is $KERNEL_HOME, where compiled packages pip-installed at runtime fail to load if it is noexec (as /tmp is under compose)" >&2
+fi
+
 mkdir -p -m 0700 "$KERNEL_HOME"
 mkdir -p "$KERNEL_HOME/.config" "$KERNEL_HOME/.cache" "$KERNEL_HOME/.local/bin"
 
```

**File**: `deployment/sandbox/smoke_test.py` (modified, +28/-5)
```diff
@@ -4,8 +4,9 @@
 Run it in the image the way kernels run, so the environment checks see what
 model-written code sees::
 
-    # self-hosted runner image (read-only root, like compose and k8s):
-    docker run --rm --read-only --tmpfs /tmp IMAGE \\
+    # self-hosted runner image (read-only root and the two tmpfs mounts, like compose):
+    docker run --rm --read-only --tmpfs /tmp \\
+        --tmpfs /sandbox-home:rw,exec,nosuid,nodev,size=1g,uid=10001,gid=10001,mode=0700 IMAGE \\
         /opt/docsgpt/kernel-env.sh python /opt/docsgpt/smoke_test.py
     # Daytona snapshot: scripts/build_daytona_snapshot.py --smoke
 
@@ -18,8 +19,10 @@
 PDF and PNG with headless Chromium, OCR of a rendered image, pdftotext and
 pdfplumber on a generated PDF, Node and npm, an animated GIF and WebP through
 imageio, and an H.264 MP4 through the ffmpeg command, checked with ffprobe.
-``--pip`` also pip-installs a small package as the sandbox user and imports it
-in the running interpreter (needs network).
+``--pip`` also pip-installs two small packages as the sandbox user (needs
+network): a pure-Python one imported in the running interpreter, and one with a
+compiled extension imported in a new process, which loads only when the home is
+on an exec-enabled mount (``/sandbox-home``; ``/tmp`` is noexec).
 
 Each check prints PASS or FAIL; the exit code is 1 if any failed. Only the
 stdlib and the image's own packages are used.
@@ -320,6 +323,23 @@ def check_pip_user_install(work: Path) -> str:
     return f"tabulate imported from {Path(module.__file__).parent}"
 
 
+# A package with a C extension and no pure-Python fallback, with manylinux wheels
+# for amd64 and arm64: if its .so cannot be mapped, the import fails.
+_COMPILED_PACKAGE = "ujson==6.0.0"
+
+
+def check_pip_compiled_extension(work: Path) -> str:
+    """pip install a compiled package, then import it in a new process (the next call, or a new kernel)."""
+    _run(
+        [sys.executable, "-m", "pip", "install", "--no-deps", "--only-binary=:all:", "--quiet", _COMPILED_PACKAGE],
+        timeout=180,
+    )
+    proc = _run([sys.executable, "-c", "import ujson; print(ujson.__file__); print(ujson.dumps({'ok': 1}))"])
+    path, dumped = proc.stdout.strip().splitlines()[-2:]
+    _expect(dumped == '{"ok":1}', f"ujson returned {dumped!r}")
+    return f"ujson loaded from {path}"
+
+
 # -- Runner --------------------------------------------------------------------
 
 
@@ -348,6 +368,9 @@ def sub(name: str) -> Path:
     ]
     if with_pip:
         checks.append(("pip install --user + import", lambda: check_pip_user_install(sub("pip"))))
+        checks.append(
+            ("pip install of a compiled package + import", lambda: check_pip_compiled_extension(sub("pip-compiled")))
+        )
     return checks
 
 
@@ -362,7 +385,7 @@ def main(argv: Optional[List[str]] = None) -> int:
     """
     parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
     parser.add_argument("--manifest", type=Path, default=_DEFAULT_MANIFEST, help="path to manifest.json")
-    parser.add_argument("--pip", action="store_true", help="also pip-install a package and import it (network)")
+    parser.add_argument("--pip", action="store_true", help="also pip-install packages and import them (network)")
     args = parser.parse_args(argv)
     manifest = json.loads(args.manifest.read_text())
 
```

---

### Incident Patch 4: `925c5045` (2026-10-05)
**Commit Message**: Merge pull request #2969 from arc53/fix/artifact-pdf-unicode-fonts

Render non-Latin text in PDF artifacts

**File**: `deployment/sandbox/Dockerfile` (modified, +6/-4)
```diff
@@ -14,10 +14,12 @@
 # sandbox.env, manifest.json; edit the manifest and run
 # `python scripts/export_sandbox_manifest.py`, never these files.
 #
-# LICENSES. The Python libraries are permissive (MIT, BSD, Apache-2.0, HPND for
-# Pillow), and so are Node.js (MIT, unpacked from the official nodejs.org
-# tarball and checked against the SHA-256 pinned in the manifest), Chromium
-# (BSD-3-Clause plus its bundled third-party code) and tesseract (Apache-2.0).
+# LICENSES. The Python libraries but one are permissive (MIT, BSD, Apache-2.0,
+# HPND for Pillow; uharfbuzz bundles HarfBuzz, MIT), and so are Node.js (MIT,
+# unpacked from the official nodejs.org tarball and checked against the SHA-256
+# pinned in the manifest), Chromium (BSD-3-Clause plus its bundled third-party
+# code) and tesseract (Apache-2.0). The one is python-bidi, LGPL-3.0: an
+# unmodified wheel installed as its own package and imported at runtime.
 # LibreOffice is MPL-2.0. The fonts are under the Bitstream Vera (DejaVu) and
 # SIL OFL-1.1 (Liberation, Carlito, Caladea, Noto) licenses. Two packages are
 # GPL and are only ever run as separate programs, never linked into the Python
```

**File**: `deployment/sandbox/manifest.json` (modified, +128/-1)
```diff
@@ -32,10 +32,25 @@
       "use": "PowerPoint .pptx"
     },
     {
-      "spec": "reportlab==4.2.5",
+      "spec": "reportlab==4.4.10",
       "import": "reportlab",
       "use": "PDF generation"
     },
+    {
+      "spec": "uharfbuzz==0.56.2",
+      "import": "uharfbuzz",
+      "use": "text shaping for reportlab (Indic scripts)"
+    },
+    {
+      "spec": "arabic-reshaper==3.0.1",
+      "import": "arabic_reshaper",
+      "use": "join Arabic letters for reportlab"
+    },
+    {
+      "spec": "python-bidi==0.6.11",
+      "import": "bidi",
+      "use": "right-to-left display order for reportlab"
+    },
     {
       "spec": "lxml==6.1.3",
       "import": "lxml",
@@ -309,6 +324,118 @@
       "reportlab": false
     }
   ],
+  "pdf_fonts": [
+    {
+      "script": "base",
+      "regular": "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
+      "bold": "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"
+    },
+    {
+      "script": "arabic",
+      "regular": "/usr/share/fonts/truetype/noto/NotoSansArabic-Regular.ttf",
+      "bold": "/usr/share/fonts/truetype/noto/NotoSansArabic-Bold.ttf"
+    },
+    {
+      "script": "hebrew",
+      "regular": "/usr/share/fonts/truetype/noto/NotoSansHebrew-Regular.ttf",
+      "bold": "/usr/share/fonts/truetype/noto/NotoSansHebrew-Bold.ttf"
+    },
+    {
+      "script": "syriac",
+      "regular": "/usr/share/fonts/truetype/noto/NotoSansSyriac-Regular.ttf",
+      "bold": ""
+    },
+    {
+      "script": "devanagari",
+      "regular": "/usr/share/fonts/truetype/noto/NotoSansDevanagari-Regular.ttf",
+      "bold": "/usr/share/fonts/truetype/noto/NotoSansDevanagari-Bold.ttf"
+    },
+    {
+      "script": "bengali",
+      "regular": "/usr/share/fonts/truetype/noto/NotoSansBengali-Regular.ttf",
+      "bold": "/usr/share/fonts/truetype/noto/NotoSansBengali-Bold.ttf"
+    },
+    {
+      "script": "gurmukhi",
+      "regular": "/usr/share/fonts/truetype/noto/NotoSansGurmukhi-Regular.ttf",
+      "bold": "/usr/share/fonts/truetype/noto/NotoSansGurmukhi-Bold.ttf"
+    },
+    {
+      "script": "gujarati",
+      "regular": "/usr/share/fonts/truetype/noto/NotoSansGujarati-Regular.ttf",
+      "bold": "/usr/share/fonts/truetype/noto/NotoSansGujarati-Bold.ttf"
+    },
+    {
+      "script": "oriya",
+      "regular": "/usr/share/fonts/truetype/noto/NotoSansOriya-Regular.ttf",
+      "bold": "/usr/share/fonts/truetype/noto/NotoSansOriya-Bold.ttf"
+    },
+    {
+      "script": "tamil",
+      "regular": "/usr/share/fonts/truetype/noto/NotoSansTamil-Regular.ttf",
+      "bold": "/usr/share/fonts/truetype/noto/NotoSansTamil-Bold.ttf"
+    },
+    {
+      "script": "telugu",
+      "regular": "/usr/share/fonts/truetype/noto/NotoSansTelugu-Regular.ttf",
+      "bold": "/usr/share/fonts/truetype/noto/NotoSansTelugu-Bold.ttf"
+    },
+    {
+      "script": "kannada",
+      "regular": "/usr/share/fonts/truetype/noto/NotoSansKannada-Regular.ttf",
+      "bold": "/usr/share/fonts/truetype/noto/NotoSansKannada-Bold.ttf"
+    },
+    {
+      "script": "malayalam",
+      "regular": "/usr/share/fonts/truetype/noto/NotoSansMalayalam-Regular.ttf",
+      "bold": "/usr/share/fonts/truetype/noto/NotoSansMalayalam-Bold.ttf"
+    },
+    {
+      "script": "sinhala",
+      "regular": "/usr/share/fonts/truetype/noto/NotoSansSinhala-Regular.ttf",
+      "bold": "/usr/share/fonts/truetype/noto/NotoSansSinhala-Bold.ttf"
+    },
+    {
+      "script": "thai",
+      "regular": "/usr/share/fonts/truetype/noto/NotoSansThai-Regular.ttf",
+      "bold": "/usr/share/fonts/truetype/noto/NotoSansThai-Bold.ttf"
+    },
+    {
+      "script": "lao",
+      "regular": "/usr/share/fonts/truetype/noto/NotoSansLao-Regular.ttf",
+      "bold": "/usr/share/fonts/truetype/noto/NotoSansLao-Bold.ttf"
+    },
+    {
+      "script": "khmer",
+      "regular": "/usr/share/fonts/truetype/noto/NotoSansKhmer-Regular.ttf",
+      "bold": "/usr/share/fonts/truetype/noto/NotoSansKhmer-Bold.ttf"
+    },
+    {
+      "script": "myanmar",
+      "regular": "/usr/share/fonts/truetype/noto/NotoSansMyanmar-Regular.ttf",
+      "bold": "/usr/share/fonts/truetype/noto/NotoSansMyanmar-Bold.ttf"
+    },
+    {
+      "script": "ethiopic",
+      "regular": "/usr/share/fonts/truetype/noto/NotoSansEthiopic-Regular.ttf",
+      "bold": "/usr/share/fonts/truetype/noto/NotoSansEthiopic-Bold.ttf"
+    },
+    {
+      "script": "symbols",
+      "regular": "/usr/share/fonts/truetype/noto/NotoSansMath-Regular.ttf",
+      "bold": ""
+    },
+    {
+      "script": "symbols",
+      "regular": "/usr/share/fonts/truetype/noto/NotoSansSymbols2-Regular.ttf",
+      "bold": ""
+    },
+    {
+      "script": "symbols",
+      "regular": "/usr/share/fonts/truetype/noto/NotoSansSymbols-Regular.ttf",
+      "bold": ""
+    }
+  ],
   "helpers": {
     "office-convert": "helpers/office_convert.py",
     "html-to-pdf": "helpers/html_render.py",
```

**File**: `deployment/sandbox/requirements.txt` (modified, +4/-1)
```diff
@@ -6,7 +6,10 @@ matplotlib==3.9.2
 openpyxl==3.1.5
 python-docx==1.1.2
 python-pptx==1.0.2
-reportlab==4.2.5
+reportlab==4.4.10
+uharfbuzz==0.56.2
+arabic-reshaper==3.0.1
+python-bidi==0.6.11
 lxml==6.1.3
 pillow==11.3.0
 requests==2.34.2
```

**File**: `deployment/sandbox/smoke_test.py` (modified, +32/-1)
```diff
@@ -11,7 +11,9 @@
 
 It reads manifest.json (written from docsgpt/sandbox/manifest.py, next to this
 script in the image) and checks that every Python package imports, every
-command is on PATH, every font file exists and the image environment is set.
+command is on PATH, every font file exists (the pdf artifact renderer's too,
+with HarfBuzz shaping, Arabic joining and bidi working) and the image
+environment is set.
 Then it converts real files: docx and pptx to PDF with office-convert, HTML to
 PDF and PNG with headless Chromium, OCR of a rendered image, pdftotext and
 pdfplumber on a generated PDF, Node and npm, an animated GIF and WebP through
@@ -104,6 +106,34 @@ def check_fonts(manifest: Dict) -> str:
     return f"{len(manifest['fonts'])} font files"
 
 
+def check_pdf_scripts(manifest: Dict) -> str:
+    """The pdf artifact renderer's fonts load, and reportlab can shape, join and reorder text."""
+    from reportlab.pdfbase import pdfmetrics
+    from reportlab.pdfbase.ttfonts import TTFont, shapeStr
+
+    missing, loaded = [], 0
+    for number, font in enumerate(manifest["pdf_fonts"]):
+        for role in ("regular", "bold"):
+            if not font[role]:
+                continue
+            if not Path(font[role]).is_file():
+                missing.append(font[role])
+                continue
+            pdfmetrics.registerFont(TTFont(f"smokepdf{number}{role}", font[role]))
+            loaded += 1
+    _expect(not missing, "missing pdf renderer fonts: " + ", ".join(missing))
+    deva = next(f["regular"] for f in manifest["pdf_fonts"] if f["script"] == "devanagari")
+    pdfmetrics.registerFont(TTFont("smokeshape", deva))
+    # HarfBuzz turns the three code points of the conjunct ksha into one glyph.
+    _expect(len(shapeStr("क्ष", "smokeshape", 10)) == 1, "reportlab did not shape Devanagari (uharfbuzz)")
+    import arabic_reshaper
+    from bidi import get_display
+
+    shown = get_display(arabic_reshaper.reshape("سلام"))
+    _expect(shown == "\ufee1\ufefc\ufeb3", f"Arabic came out as {shown!r}, not joined and reordered")
+    return f"{loaded} font files, shaping, reshaping and bidi"
+
+
 def check_env(manifest: Dict) -> str:
     wrong = {k: os.environ.get(k) for k, v in manifest["env"].items() if os.environ.get(k) != v}
     _expect(not wrong, f"env not set as in the manifest: {wrong}")
@@ -303,6 +333,7 @@ def sub(name: str) -> Path:
         ("imports", lambda: check_imports(manifest)),
         ("commands on PATH", lambda: check_binaries(manifest)),
         ("fonts", lambda: check_fonts(manifest)),
+        ("pdf renderer scripts", lambda: check_pdf_scripts(manifest)),
         ("environment", lambda: check_env(manifest)),
         ("writable HOME", lambda: check_writable_home(manifest)),
         ("office-convert docx -> pdf", lambda: check_office_docx_to_pdf(sub("docx"))),
```

**File**: `docs/content/Tools/artifacts-and-code-execution.mdx` (modified, +12/-1)
```diff
@@ -52,6 +52,17 @@ The Artifact tool keeps a structured spec as the source of truth and renders the
 
 Supported kinds are presentation (.pptx), document (.docx), spreadsheet (.xlsx), pdf, and html.
 
+#### Non-Latin text in PDF artifacts
+
+The pdf kind draws text with the fonts installed in the sandbox, so text in other scripts renders instead of showing as boxes or blanks:
+
+- Latin, Greek, Cyrillic and most symbols (such as `−`, `→` and `≤`) use DejaVu Sans.
+- Arabic, Persian, Hebrew, Devanagari and the other Indic scripts, Thai, Khmer, Ethiopic and a few more use the matching Noto font. A paragraph can mix scripts: each run of text gets a font that has its characters.
+- Chinese, Japanese and Korean use the standard PDF CJK fonts (STSong-Light, HeiseiKakuGo-W5 and HYGothic-Medium). They aren't embedded, so the PDF viewer supplies the glyphs, and they have no bold weight.
+- Right-to-left paragraphs are joined, put in display order and right-aligned. Devanagari, Bengali, Tamil, Thai and similar scripts are shaped with HarfBuzz, so conjuncts and vowel signs sit where they belong; text copied out of a shaped word can contain private-use characters.
+
+A sandbox image without these fonts falls back to matplotlib's copy of DejaVu Sans, then to Helvetica, which covers Latin only. For a layout the pdf kind can't express, the model can build the file in the Code Executor and convert HTML with `html-to-pdf`.
+
 ## Code Executor
 
 The Code Executor runs Python in a sandboxed session bound to your conversation (or to a workflow run). Files the code writes into the workspace are captured as artifacts automatically, so a script that produces `report.csv` gives you a downloadable artifact with no extra steps.
@@ -77,7 +88,7 @@ Key points:
 
 The self-hosted runner image and the Daytona snapshot hold the same set, listed in `docsgpt/sandbox/manifest.py`, and the Code Executor tells the model what is there so it doesn't have to find out by failing:
 
-- **Python libraries:** pandas, numpy, matplotlib, openpyxl, python-docx, python-pptx, reportlab, lxml, Pillow, requests, beautifulsoup4, PyYAML, pypdf, PyPDF2, pdfplumber, pdfminer.six, pypdfium2, pytesseract and imageio.
+- **Python libraries:** pandas, numpy, matplotlib, openpyxl, python-docx, python-pptx, reportlab (with uharfbuzz for shaping, and arabic-reshaper and python-bidi for right-to-left text), lxml, Pillow, requests, beautifulsoup4, PyYAML, pypdf, PyPDF2, pdfplumber, pdfminer.six, pypdfium2, pytesseract and imageio.
 - **Commands:** headless LibreOffice, headless Chromium, tesseract OCR (English), poppler's `pdftotext` and `pdftoppm`, `ffmpeg` and `ffprobe`, and Node.js 24 with `npm` and `npx`.
 - **Conversion helpers:** `office-convert FILE --to pdf` (also `docx`, `xlsx`, `pptx`, `png` and more) converts office documents with LibreOffice; `html-to-pdf` and `html-screenshot` render an HTML file or URL with Chromium.
 - **Fonts:** DejaVu, Liberation and Carlito/Caladea (metric-compatible with Arial, Times New Roman, Courier New, Calibri and Cambria), Noto for Arabic, Devanagari and other scripts, and Noto CJK for Chinese, Japanese and Korean.
```

**File**: `docsgpt/agents/tools/artifact_generator.py` (modified, +31/-26)
```diff
@@ -15,6 +15,7 @@
 import json
 import logging
 import uuid
+from pathlib import Path
 from typing import Any, Dict, List, Optional, Tuple
 
 from docsgpt.agents.tools.artifact_ref import resolve_artifact_id
@@ -25,6 +26,7 @@
     append_artifact_version,
     persist_new_artifact,
 )
+from docsgpt.sandbox.manifest import PDF_FONTS
 from docsgpt.sandbox.sandbox_creator import SandboxCreator
 from docsgpt.storage.db.repositories.artifacts import ArtifactsRepository
 from docsgpt.storage.db.session import db_readonly
@@ -237,6 +239,34 @@
     '{"type": "table", "rows": [[str]], "headers"?: [str]} | {"type": "code", "text"}'
 )
 
+
+def _pdf_renderer() -> str:
+    """Return the pdf renderer program: ``artifact_pdf.py`` run in its own namespace with the image's font table.
+
+    The module's source goes in as a string literal and runs in a fresh dict,
+    so its helpers never land in the session kernel that ``run_code`` shares.
+    The font table is the manifest's ``PDF_FONTS``; the sandbox looks the files
+    up. Braces are doubled so the template survives ``str.format``.
+
+    Returns:
+        A ``str.format`` template taking ``spec_path`` and ``out_path``.
+    """
+    source = Path(__file__).with_name("artifact_pdf.py").read_text(encoding="utf-8")
+    fonts = repr([dict(entry) for entry in PDF_FONTS])
+
+    def literal(value: str) -> str:
+        return value.replace("{", "{{").replace("}", "}}")
+
+    return (
+        "_docsgpt_artifact_pdf = {{'__name__': 'docsgpt_artifact_pdf'}}\n"
+        "try:\n"
+        f"    exec(compile({literal(repr(source))}, 'artifact_pdf.py', 'exec'), _docsgpt_artifact_pdf)\n"
+        f"    _docsgpt_artifact_pdf['render_pdf_spec']({{spec_path!r}}, {{out_path!r}}, {literal(fonts)})\n"
+        "finally:\n"
+        "    del _docsgpt_artifact_pdf\n"
+    )
+
+
 # FIXED renderer programs. Each reads ``spec.json`` from the workspace as DATA
 # and writes ``out.<ext>``. The spec is NEVER string-interpolated into the
 # program; ``{spec_path}``/``{out_path}`` are server-controlled path literals.
@@ -308,32 +338,7 @@
         "    wb.create_sheet(title='Sheet1')\n"
         "wb.save({out_path!r})\n"
     ),
-    "pdf": (
-        "import json\n"
-        "from reportlab.lib.pagesizes import letter\n"
-        "from reportlab.lib.styles import getSampleStyleSheet\n"
-        "from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer\n"
-        "from xml.sax.saxutils import escape\n"
-        "spec = json.load(open({spec_path!r}))\n"
-        "styles = getSampleStyleSheet()\n"
-        "story = []\n"
-        "title = spec.get('title')\n"
-        "if title:\n"
-        "    story.append(Paragraph(escape(str(title)), styles['Title']))\n"
-        "    story.append(Spacer(1, 12))\n"
-        "for block in spec.get('blocks', []):\n"
-        "    if block.get('type') == 'heading':\n"
-        "        try:\n"
-        "            level = int(block.get('level') or 1)\n"
-        "        except (TypeError, ValueError):\n"
-        "            level = 1\n"
-        "        style = styles['Heading%d' % min(max(level, 1), 3)]\n"
-        "    else:\n"
-        "        style = styles['BodyText']\n"
-        "    story.append(Paragraph(escape(str(block.get('text', ''))), style))\n"
-        "    story.append(Spacer(1, 6))\n"
-        "SimpleDocTemplate({out_path!r}, pagesize=letter).build(story)\n"
-    ),
+    "pdf": _pdf_renderer(),
     "html": (
         "import json\n"
         "import html\n"
```

**File**: `docsgpt/agents/tools/artifact_pdf.py` (added, +871/-0)
```diff
@@ -0,0 +1,871 @@
+"""The ``pdf`` artifact renderer: reportlab with fonts that cover the text's scripts.
+
+``artifact_generator`` sends this module's source to the sandbox and calls
+``render_pdf_spec`` there, so the module imports only the standard library at
+the top and reportlab, arabic_reshaper and python-bidi inside functions. The API
+process imports it only in tests.
+
+reportlab's built-in Helvetica draws Latin-1 and nothing else, so Cyrillic,
+Greek, Arabic, Devanagari, CJK and symbols such as ``−`` or ``→`` used to come
+out as boxes or blanks. Here:
+
+* Fonts. DejaVu Sans is the base family. Every other script the text uses gets
+  the Noto font the sandbox image installs; the table of files comes from
+  ``PDF_FONTS`` in ``docsgpt/sandbox/manifest.py`` and is looked up here, in
+  the sandbox. A base face missing from the image is taken from matplotlib's
+  bundled DejaVu Sans, and with no DejaVu at all the base is Helvetica. A font
+  that is missing or will not load is skipped, never fatal.
+* Mixed scripts. Each character is drawn in the first font whose character map
+  has it (its script's font, then the base, then the symbol fonts), and runs in
+  a font other than the paragraph's are wrapped in ``<font name="...">``.
+* Chinese, Japanese and Korean use reportlab's built-in CID fonts (STSong-Light,
+  HeiseiKakuGo-W5, HYGothic-Medium), chosen per sentence: kana makes it
+  Japanese, Hangul Korean, anything else Chinese. reportlab cannot load the
+  Noto CJK collection (CFF outlines in a ``.ttc``), and a CID font needs no
+  file: the PDF names the font and the viewer supplies the glyphs. They have no
+  bold face.
+* Right-to-left text. reportlab neither joins Arabic letters nor reorders RTL
+  text. Arabic is reshaped into its presentation forms (arabic_reshaper), the
+  paragraph is broken into lines here, each line is reordered for display
+  (python-bidi, with bracket pairs mirrored) and the paragraph is right-aligned
+  when its first strong character is right-to-left.
+* Scripts that need shaping (Devanagari, Bengali, Tamil, Thai and the rest of
+  ``SHAPED_SCRIPTS``) go through reportlab's HarfBuzz shaping when reportlab
+  supports it and uharfbuzz is installed; without it, or in a paragraph where
+  one word is drawn in two fonts, they draw unshaped.
+"""
+
+from __future__ import annotations
+
+import bisect
+import json
+import os
+import re
+import unicodedata
+from importlib.util import find_spec
+from typing import Any, Callable, Dict, Iterable, List, Mapping, Optional, Sequence, Set, Tuple
+
+BASE_FAMILY = "ArtifactSans"
+
+# Unicode blocks the renderer picks a font for, sorted by start and
+# non-overlapping. Characters outside them (Latin, Greek, Cyrillic, Armenian,
+# Georgian, digits, punctuation, symbols) have no script and go to the base
+# font when it has them. "cjk" is CJK punctuation and full-width forms, drawn
+# in the document's CJK font.
+_SCRIPT_RANGES: Tuple[Tuple[int, int, str], ...] = (
+    (0x0590, 0x05FF, "hebrew"),
+    (0x0600, 0x06FF, "arabic"),
+    (0x0700, 0x074F, "syriac"),
+    (0x0750, 0x077F, "arabic"),
+    (0x0870, 0x08FF, "arabic"),
+    (0x0900, 0x097F, "devanagari"),
+    (0x0980, 0x09FF, "bengali"),
+    (0x0A00, 0x0A7F, "gurmukhi"),
+    (0x0A80, 0x0AFF, "gujarati"),
+    (0x0B00, 0x0B7F, "oriya"),
+    (0x0B80, 0x0BFF, "tamil"),
+    (0x0C00, 0x0C7F, "telugu"),
+    (0x0C80, 0x0CFF, "kannada"),
+    (0x0D00, 0x0D7F, "malayalam"),
+    (0x0D80, 0x0DFF, "sinhala"),
+    (0x0E00, 0x0E7F, "thai"),
+    (0x0E80, 0x0EFF, "lao"),
+    (0x1000, 0x109F, "myanmar"),
+    (0x1100, 0x11FF, "hangul"),
+    (0x1200, 0x139F, "ethiopic"),
+    (0x1780, 0x17FF, "khmer"),
+    (0x1CD0, 0x1CFF, "devanagari"),
+    (0x2E80, 0x2FDF, "han"),
+    (0x3000, 0x303F, "cjk"),
+    (0x3040, 0x30FF, "kana"),
+    (0x3130, 0x318F, "hangul"),
+    (0x31F0, 0x31FF, "kana"),
+    (0x3200, 0x33FF, "cjk"),
+    (0x3400, 0x4DBF, "han"),
+    (0x4E00, 0x9FFF, "han"),
+    (0xA8E0, 0xA8FF, "devanagari"),
+    (0xA960, 0xA97F, "hangul"),
+    (0xAC00, 0xD7FF, "hangul"),
+    (0xF900, 0xFAFF, "han"),
+    (0xFB1D, 0xFB4F, "hebrew"),
+    (0xFB50, 0xFDFF, "arabic"),
+    (0xFE30, 0xFE4F, "cjk"),
+    (0xFE70, 0xFEFF, "arabic"),
+    (0xFF00, 0xFF65, "cjk"),
+    (0xFF66, 0xFF9F, "kana"),
+    (0xFFA0, 0xFFDF, "hangul"),
+    (0xFFE0, 0xFFEF, "cjk"),
+    (0x20000, 0x323AF, "han"),
+)
+_RANGE_STARTS = [start for start, _end, _script in _SCRIPT_RANGES]
+# Punctuation inside a script block that other scripts share: the dandas end
+# Bengali, Gurmukhi and Oriya sentences as well as Devanagari ones.
+_SHARED_PUNCTUATION = frozenset({0x0964, 0x0965})
+# Where a CJK sentence ends, for choosing its font.
+_SENTENCE_END = frozenset("。！？.!?\n．")
+
+RTL_SCRIPTS = frozenset({"arabic", "hebrew", "syriac"})
+CJK_SCRIPTS = frozenset({"han", "kana", "hangul", "cjk"})
+# Scripts whose letters change shape or order around each other, so they read
+# correctly only after HarfBuzz shaping.
+SH
```

**File**: `docsgpt/sandbox/manifest.py` (modified, +67/-2)
```diff
@@ -56,6 +56,20 @@ class Font(TypedDict):
     reportlab: bool
 
 
+class PdfFont(TypedDict):
+    """A TrueType font the pdf artifact renderer embeds: the script it draws and its regular and bold files.
+
+    ``script`` is ``base`` for the base family, ``symbols`` for a fallback
+    tried for characters no other font has, or a script key of
+    ``docsgpt/agents/tools/artifact_pdf.py``. ``bold`` is empty when the
+    package ships no bold face.
+    """
+
+    script: str
+    regular: str
+    bold: str
+
+
 class Missing(TypedDict):
     """A library models import that the image lacks: its pip name and what to use instead."""
 
@@ -73,14 +87,19 @@ class NodeRelease(TypedDict):
 
 # Libraries baked into both images. Pins are exact so a rebuild gives the same
 # image; pdfplumber stays at 0.11.9 because 0.11.10 needs Pillow >= 12.2.
+# reportlab is 4.4+ for its HarfBuzz shaping (through uharfbuzz), which the pdf
+# artifact renderer uses for Devanagari and other complex scripts.
 PIP_PACKAGES: Tuple[PipPackage, ...] = (
     {"spec": "pandas==2.2.3", "import": "pandas", "use": "dataframes, CSV and Excel I/O"},
     {"spec": "numpy==2.1.3", "import": "numpy", "use": "arrays and maths"},
     {"spec": "matplotlib==3.9.2", "import": "matplotlib", "use": "charts"},
     {"spec": "openpyxl==3.1.5", "import": "openpyxl", "use": "Excel .xlsx"},
     {"spec": "python-docx==1.1.2", "import": "docx", "use": "Word .docx"},
     {"spec": "python-pptx==1.0.2", "import": "pptx", "use": "PowerPoint .pptx"},
-    {"spec": "reportlab==4.2.5", "import": "reportlab", "use": "PDF generation"},
+    {"spec": "reportlab==4.4.10", "import": "reportlab", "use": "PDF generation"},
+    {"spec": "uharfbuzz==0.56.2", "import": "uharfbuzz", "use": "text shaping for reportlab (Indic scripts)"},
+    {"spec": "arabic-reshaper==3.0.1", "import": "arabic_reshaper", "use": "join Arabic letters for reportlab"},
+    {"spec": "python-bidi==0.6.11", "import": "bidi", "use": "right-to-left display order for reportlab"},
     {"spec": "lxml==6.1.3", "import": "lxml", "use": "XML and HTML parsing"},
     {"spec": "pillow==11.3.0", "import": "PIL", "use": "images"},
     {"spec": "requests==2.34.2", "import": "requests", "use": "HTTP"},
@@ -236,7 +255,52 @@ class NodeRelease(TypedDict):
     },
 )
 
-_USE_FFMPEG_CLI = "the ffmpeg command (run it with subprocess) for video, or imageio for GIF and WebP"
+_NOTO_DIR = "/usr/share/fonts/truetype/noto/"
+
+
+def _noto(script: str, family: str, bold: bool = True) -> PdfFont:
+    """Return the ``PdfFont`` for a fonts-noto-core family such as ``NotoSansArabic``."""
+    return {
+        "script": script,
+        "regular": f"{_NOTO_DIR}{family}-Regular.ttf",
+        "bold": f"{_NOTO_DIR}{family}-Bold.ttf" if bold else "",
+    }
+
+
+# Fonts the pdf artifact renderer (docsgpt/agents/tools/artifact_pdf.py) embeds,
+# by script; it looks the files up inside the sandbox and skips any that are
+# missing. Chinese, Japanese and Korean use reportlab's built-in CID fonts, so
+# they are not listed. The paths exist on Debian 12 and 13.
+PDF_FONTS: Tuple[PdfFont, ...] = (
+    {
+        "script": "base",
+        "regular": "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
+        "bold": "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
+    },
+    _noto("arabic", "NotoSansArabic"),
+    _noto("hebrew", "NotoSansHebrew"),
+    _noto("syriac", "NotoSansSyriac", bold=False),
+    _noto("devanagari", "NotoSansDevanagari"),
+    _noto("bengali", "NotoSansBengali"),
+    _noto("gurmukhi", "NotoSansGurmukhi"),
+    _noto("gujarati", "NotoSansGujarati"),
+    _noto("oriya", "NotoSansOriya"),
+    _noto("tamil", "NotoSansTamil"),
+    _noto("telugu", "NotoSansTelugu"),
+    _noto("kannada", "NotoSansKannada"),
+    _noto("malayalam", "NotoSansMalayalam"),
+    _noto("sinhala", "NotoSansSinhala"),
+    _noto("thai", "NotoSansThai"),
+    _noto("lao", "NotoSansLao"),
+    _noto("khmer", "NotoSansKhmer"),
+    _noto("myanmar", "NotoSansMyanmar"),
+    _noto("ethiopic", "NotoSansEthiopic"),
+    _noto("symbols", "NotoSansMath", bold=False),
+    _noto("symbols", "NotoSansSymbols2", bold=False),
+    _noto("symbols", "NotoSansSymbols", bold=False),
+)
+
+_USE_FFMPEG_CLI ="the ffmpeg command (run it with subprocess) for video, or imageio for GIF and WebP"
 _USE_OFFICE_CONVERT = "the office-convert command (LibreOffice) for Office conversions"
 _USE_PDFPLUMBER_TABLES = "pdfplumber's page.extract_tables()"
 
@@ -467,6 +531,7 @@ def render_manifest_json() -> str:
         "env": ENV,
         "binaries": list(BINARIES),
         "fonts": list(FONTS),
+        "pdf_fonts": list(PDF_FONTS),
         "helpers": HELPERS,
     }
     return json.dumps(data, indent=2) + "\n"
```

---

### Incident Patch 5: `a0ff30f6` (2026-10-05)
**Commit Message**: Cover the last pdf renderer branches

Register the CID fonts on every render instead of only when they are new
(cheap, and the outcome no longer depends on what else ran first), and test
_fitting_prefix directly.

**File**: `docsgpt/agents/tools/artifact_pdf.py` (modified, +2/-3)
```diff
@@ -449,9 +449,8 @@ def base_paths(role: str) -> List[Optional[str]]:
         # Which flavour a sentence takes is decided per sentence; a CID font
         # costs nothing until a run uses it, so all three are registered.
         for flavor, name in CID_FONTS.items():
-            if name not in pdfmetrics.getRegisteredFontNames():
-                pdfmetrics.registerFont(UnicodeCIDFont(name))
-                _register_family(name, name, name, name)
+            pdfmetrics.registerFont(UnicodeCIDFont(name))
+            _register_family(name, name, name, name)
             fonts.add_coverage(name, _cid_covers)
             fonts.cjk[flavor] = name
 
```

**File**: `tests/agents/tools/test_artifact_pdf.py` (modified, +7/-0)
```diff
@@ -356,6 +356,13 @@ def test_long_unbroken_text_lays_out_in_linear_time():
     assert len(lines) == 250 and all(len(line) == 80 for line in lines)
 
 
+def test_fitting_prefix_counts_the_characters_that_fit():
+    assert artifact_pdf._fitting_prefix("abcdef", len, 4) == 4
+    assert artifact_pdf._fitting_prefix("abcdef", lambda s: 10.0, 4) == 1
+    # Characters that fit one by one fit whole, even if the word measured as one string did not.
+    assert artifact_pdf._fitting_prefix("abc", lambda s: 1.0, 5) == 3
+
+
 def test_reshape_arabic_joins_letters_into_presentation_forms():
     pytest.importorskip("arabic_reshaper")
     shaped = artifact_pdf.reshape_arabic("سلام")
```

---

### Incident Patch 6: `5bbafca6` (2026-10-05)
**Commit Message**: Isolate the pdf renderer tests from fonts other tests registered

reportlab's font registry is process-global. On a Linux runner an
artifact_generator render in the same worker finds DejaVu and binds
ArtifactSans to it, so the renderer gave the tests' stand-in font a fresh
name. Each test now starts without the renderer's fonts.

**File**: `tests/agents/tools/test_artifact_pdf.py` (modified, +24/-1)
```diff
@@ -58,9 +58,31 @@
 }
 
 
+def _forget_renderer_fonts() -> None:
+    """Drop every font the renderer registered (``ArtifactSans*``) from reportlab's registry."""
+    from reportlab.lib import fonts as rl_fonts
+
+    ours = artifact_pdf.BASE_FAMILY.lower()
+    for name in [n for n in pdfmetrics._fonts if n.lower().startswith(ours)]:
+        del pdfmetrics._fonts[name]
+    for face, font in list(pdfmetrics._dynFaceNames.items()):
+        if font.fontName.lower().startswith(ours):
+            del pdfmetrics._dynFaceNames[face]
+    for key, value in list(rl_fonts._tt2ps_map.items()):
+        if key[0].startswith(ours) or value.lower().startswith(ours):
+            del rl_fonts._tt2ps_map[key]
+    for key in [k for k in rl_fonts._ps2tt_map if k.startswith(ours)]:
+        del rl_fonts._ps2tt_map[key]
+
+
 @pytest.fixture(autouse=True)
 def _fresh_font_registry():
-    """Give each test reportlab's font registry as it was: the renderer registers fonts globally."""
+    """Run each test without the renderer's fonts and restore the registry after.
+
+    reportlab's registry is process-global: another test in the same worker
+    (say an artifact_generator render, which finds DejaVu on a Linux runner)
+    may already have bound ``ArtifactSans`` to a different file.
+    """
     from reportlab.lib import fonts as rl_fonts
 
     saved = (
@@ -69,6 +91,7 @@ def _fresh_font_registry():
         dict(rl_fonts._tt2ps_map),
         dict(rl_fonts._ps2tt_map),
     )
+    _forget_renderer_fonts()
     yield
     for current, before in zip(
         (pdfmetrics._fonts, pdfmetrics._dynFaceNames, rl_fonts._tt2ps_map, rl_fonts._ps2tt_map), saved
```

---

### Incident Patch 7: `0f07ea83` (2026-10-05)
**Commit Message**: Render non-Latin text in PDF artifacts

The pdf artifact renderer used reportlab's built-in Helvetica styles, which
draw Latin-1 only: Cyrillic, Greek, Arabic, Persian, Devanagari, CJK and
symbols such as − → ≤ came out as boxes or blanks.

The renderer now lives in docsgpt/agents/tools/artifact_pdf.py. Its source runs
in the sandbox in a fresh namespace, with the manifest's new PDF_FONTS table
passed in as data:

- DejaVu Sans is the base family (manifest paths, then matplotlib's bundled
  copy, then Helvetica); each script the text uses gets its Noto font, and
  each character is drawn in the first font that has it, with <font> runs.
- Chinese, Japanese and Korean use reportlab's CID fonts, chosen per sentence.
- Right-to-left paragraphs are reshaped (arabic-reshaper), broken into lines,
  reordered per line (python-bidi, brackets mirrored) and right-aligned.
- Devanagari and other complex scripts are shaped with HarfBuzz.

The sandbox image moves to reportlab 4.4.10 (HarfBuzz shaping) and adds
uharfbuzz, arabic-reshaper and python-bidi; the smoke test checks the
renderer's fonts, shaping, reshaping and bidi.

**File**: `deployment/sandbox/Dockerfile` (modified, +6/-4)
```diff
@@ -14,10 +14,12 @@
 # sandbox.env, manifest.json; edit the manifest and run
 # `python scripts/export_sandbox_manifest.py`, never these files.
 #
-# LICENSES. The Python libraries are permissive (MIT, BSD, Apache-2.0, HPND for
-# Pillow), and so are Node.js (MIT, unpacked from the official nodejs.org
-# tarball and checked against the SHA-256 pinned in the manifest), Chromium
-# (BSD-3-Clause plus its bundled third-party code) and tesseract (Apache-2.0).
+# LICENSES. The Python libraries but one are permissive (MIT, BSD, Apache-2.0,
+# HPND for Pillow; uharfbuzz bundles HarfBuzz, MIT), and so are Node.js (MIT,
+# unpacked from the official nodejs.org tarball and checked against the SHA-256
+# pinned in the manifest), Chromium (BSD-3-Clause plus its bundled third-party
+# code) and tesseract (Apache-2.0). The one is python-bidi, LGPL-3.0: an
+# unmodified wheel installed as its own package and imported at runtime.
 # LibreOffice is MPL-2.0. The fonts are under the Bitstream Vera (DejaVu) and
 # SIL OFL-1.1 (Liberation, Carlito, Caladea, Noto) licenses. Two packages are
 # GPL and are only ever run as separate programs, never linked into the Python
```

**File**: `deployment/sandbox/manifest.json` (modified, +128/-1)
```diff
@@ -32,10 +32,25 @@
       "use": "PowerPoint .pptx"
     },
     {
-      "spec": "reportlab==4.2.5",
+      "spec": "reportlab==4.4.10",
       "import": "reportlab",
       "use": "PDF generation"
     },
+    {
+      "spec": "uharfbuzz==0.56.2",
+      "import": "uharfbuzz",
+      "use": "text shaping for reportlab (Indic scripts)"
+    },
+    {
+      "spec": "arabic-reshaper==3.0.1",
+      "import": "arabic_reshaper",
+      "use": "join Arabic letters for reportlab"
+    },
+    {
+      "spec": "python-bidi==0.6.11",
+      "import": "bidi",
+      "use": "right-to-left display order for reportlab"
+    },
     {
       "spec": "lxml==6.1.3",
       "import": "lxml",
@@ -309,6 +324,118 @@
       "reportlab": false
     }
   ],
+  "pdf_fonts": [
+    {
+      "script": "base",
+      "regular": "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
+      "bold": "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"
+    },
+    {
+      "script": "arabic",
+      "regular": "/usr/share/fonts/truetype/noto/NotoSansArabic-Regular.ttf",
+      "bold": "/usr/share/fonts/truetype/noto/NotoSansArabic-Bold.ttf"
+    },
+    {
+      "script": "hebrew",
+      "regular": "/usr/share/fonts/truetype/noto/NotoSansHebrew-Regular.ttf",
+      "bold": "/usr/share/fonts/truetype/noto/NotoSansHebrew-Bold.ttf"
+    },
+    {
+      "script": "syriac",
+      "regular": "/usr/share/fonts/truetype/noto/NotoSansSyriac-Regular.ttf",
+      "bold": ""
+    },
+    {
+      "script": "devanagari",
+      "regular": "/usr/share/fonts/truetype/noto/NotoSansDevanagari-Regular.ttf",
+      "bold": "/usr/share/fonts/truetype/noto/NotoSansDevanagari-Bold.ttf"
+    },
+    {
+      "script": "bengali",
+      "regular": "/usr/share/fonts/truetype/noto/NotoSansBengali-Regular.ttf",
+      "bold": "/usr/share/fonts/truetype/noto/NotoSansBengali-Bold.ttf"
+    },
+    {
+      "script": "gurmukhi",
+      "regular": "/usr/share/fonts/truetype/noto/NotoSansGurmukhi-Regular.ttf",
+      "bold": "/usr/share/fonts/truetype/noto/NotoSansGurmukhi-Bold.ttf"
+    },
+    {
+      "script": "gujarati",
+      "regular": "/usr/share/fonts/truetype/noto/NotoSansGujarati-Regular.ttf",
+      "bold": "/usr/share/fonts/truetype/noto/NotoSansGujarati-Bold.ttf"
+    },
+    {
+      "script": "oriya",
+      "regular": "/usr/share/fonts/truetype/noto/NotoSansOriya-Regular.ttf",
+      "bold": "/usr/share/fonts/truetype/noto/NotoSansOriya-Bold.ttf"
+    },
+    {
+      "script": "tamil",
+      "regular": "/usr/share/fonts/truetype/noto/NotoSansTamil-Regular.ttf",
+      "bold": "/usr/share/fonts/truetype/noto/NotoSansTamil-Bold.ttf"
+    },
+    {
+      "script": "telugu",
+      "regular": "/usr/share/fonts/truetype/noto/NotoSansTelugu-Regular.ttf",
+      "bold": "/usr/share/fonts/truetype/noto/NotoSansTelugu-Bold.ttf"
+    },
+    {
+      "script": "kannada",
+      "regular": "/usr/share/fonts/truetype/noto/NotoSansKannada-Regular.ttf",
+      "bold": "/usr/share/fonts/truetype/noto/NotoSansKannada-Bold.ttf"
+    },
+    {
+      "script": "malayalam",
+      "regular": "/usr/share/fonts/truetype/noto/NotoSansMalayalam-Regular.ttf",
+      "bold": "/usr/share/fonts/truetype/noto/NotoSansMalayalam-Bold.ttf"
+    },
+    {
+      "script": "sinhala",
+      "regular": "/usr/share/fonts/truetype/noto/NotoSansSinhala-Regular.ttf",
+      "bold": "/usr/share/fonts/truetype/noto/NotoSansSinhala-Bold.ttf"
+    },
+    {
+      "script": "thai",
+      "regular": "/usr/share/fonts/truetype/noto/NotoSansThai-Regular.ttf",
+      "bold": "/usr/share/fonts/truetype/noto/NotoSansThai-Bold.ttf"
+    },
+    {
+      "script": "lao",
+      "regular": "/usr/share/fonts/truetype/noto/NotoSansLao-Regular.ttf",
+      "bold": "/usr/share/fonts/truetype/noto/NotoSansLao-Bold.ttf"
+    },
+    {
+      "script": "khmer",
+      "regular": "/usr/share/fonts/truetype/noto/NotoSansKhmer-Regular.ttf",
+      "bold": "/usr/share/fonts/truetype/noto/NotoSansKhmer-Bold.ttf"
+    },
+    {
+      "script": "myanmar",
+      "regular": "/usr/share/fonts/truetype/noto/NotoSansMyanmar-Regular.ttf",
+      "bold": "/usr/share/fonts/truetype/noto/NotoSansMyanmar-Bold.ttf"
+    },
+    {
+      "script": "ethiopic",
+      "regular": "/usr/share/fonts/truetype/noto/NotoSansEthiopic-Regular.ttf",
+      "bold": "/usr/share/fonts/truetype/noto/NotoSansEthiopic-Bold.ttf"
+    },
+    {
+      "script": "symbols",
+      "regular": "/usr/share/fonts/truetype/noto/NotoSansMath-Regular.ttf",
+      "bold": ""
+    },
+    {
+      "script": "symbols",
+      "regular": "/usr/share/fonts/truetype/noto/NotoSansSymbols2-Regular.ttf",
+      "bold": ""
+    },
+    {
+      "script": "symbols",
+      "regular": "/usr/share/fonts/truetype/noto/NotoSansSymbols-Regular.ttf",
+      "bold": ""
+    }
+  ],
   "helpers": {
     "office-convert": "helpers/office_convert.py",
     "html-to-pdf": "helpers/html_render.py",
```

**File**: `deployment/sandbox/requirements.txt` (modified, +4/-1)
```diff
@@ -6,7 +6,10 @@ matplotlib==3.9.2
 openpyxl==3.1.5
 python-docx==1.1.2
 python-pptx==1.0.2
-reportlab==4.2.5
+reportlab==4.4.10
+uharfbuzz==0.56.2
+arabic-reshaper==3.0.1
+python-bidi==0.6.11
 lxml==6.1.3
 pillow==11.3.0
 requests==2.34.2
```

**File**: `deployment/sandbox/smoke_test.py` (modified, +32/-1)
```diff
@@ -11,7 +11,9 @@
 
 It reads manifest.json (written from docsgpt/sandbox/manifest.py, next to this
 script in the image) and checks that every Python package imports, every
-command is on PATH, every font file exists and the image environment is set.
+command is on PATH, every font file exists (the pdf artifact renderer's too,
+with HarfBuzz shaping, Arabic joining and bidi working) and the image
+environment is set.
 Then it converts real files: docx and pptx to PDF with office-convert, HTML to
 PDF and PNG with headless Chromium, OCR of a rendered image, pdftotext and
 pdfplumber on a generated PDF, Node and npm, an animated GIF and WebP through
@@ -104,6 +106,34 @@ def check_fonts(manifest: Dict) -> str:
     return f"{len(manifest['fonts'])} font files"
 
 
+def check_pdf_scripts(manifest: Dict) -> str:
+    """The pdf artifact renderer's fonts load, and reportlab can shape, join and reorder text."""
+    from reportlab.pdfbase import pdfmetrics
+    from reportlab.pdfbase.ttfonts import TTFont, shapeStr
+
+    missing, loaded = [], 0
+    for number, font in enumerate(manifest["pdf_fonts"]):
+        for role in ("regular", "bold"):
+            if not font[role]:
+                continue
+            if not Path(font[role]).is_file():
+                missing.append(font[role])
+                continue
+            pdfmetrics.registerFont(TTFont(f"smokepdf{number}{role}", font[role]))
+            loaded += 1
+    _expect(not missing, "missing pdf renderer fonts: " + ", ".join(missing))
+    deva = next(f["regular"] for f in manifest["pdf_fonts"] if f["script"] == "devanagari")
+    pdfmetrics.registerFont(TTFont("smokeshape", deva))
+    # HarfBuzz turns the three code points of the conjunct ksha into one glyph.
+    _expect(len(shapeStr("क्ष", "smokeshape", 10)) == 1, "reportlab did not shape Devanagari (uharfbuzz)")
+    import arabic_reshaper
+    from bidi import get_display
+
+    shown = get_display(arabic_reshaper.reshape("سلام"))
+    _expect(shown == "\ufee1\ufefc\ufeb3", f"Arabic came out as {shown!r}, not joined and reordered")
+    return f"{loaded} font files, shaping, reshaping and bidi"
+
+
 def check_env(manifest: Dict) -> str:
     wrong = {k: os.environ.get(k) for k, v in manifest["env"].items() if os.environ.get(k) != v}
     _expect(not wrong, f"env not set as in the manifest: {wrong}")
@@ -303,6 +333,7 @@ def sub(name: str) -> Path:
         ("imports", lambda: check_imports(manifest)),
         ("commands on PATH", lambda: check_binaries(manifest)),
         ("fonts", lambda: check_fonts(manifest)),
+        ("pdf renderer scripts", lambda: check_pdf_scripts(manifest)),
         ("environment", lambda: check_env(manifest)),
         ("writable HOME", lambda: check_writable_home(manifest)),
         ("office-convert docx -> pdf", lambda: check_office_docx_to_pdf(sub("docx"))),
```

**File**: `docs/content/Tools/artifacts-and-code-execution.mdx` (modified, +12/-1)
```diff
@@ -52,6 +52,17 @@ The Artifact tool keeps a structured spec as the source of truth and renders the
 
 Supported kinds are presentation (.pptx), document (.docx), spreadsheet (.xlsx), pdf, and html.
 
+#### Non-Latin text in PDF artifacts
+
+The pdf kind draws text with the fonts installed in the sandbox, so text in other scripts renders instead of showing as boxes or blanks:
+
+- Latin, Greek, Cyrillic and most symbols (such as `−`, `→` and `≤`) use DejaVu Sans.
+- Arabic, Persian, Hebrew, Devanagari and the other Indic scripts, Thai, Khmer, Ethiopic and a few more use the matching Noto font. A paragraph can mix scripts: each run of text gets a font that has its characters.
+- Chinese, Japanese and Korean use the standard PDF CJK fonts (STSong-Light, HeiseiKakuGo-W5 and HYGothic-Medium). They aren't embedded, so the PDF viewer supplies the glyphs, and they have no bold weight.
+- Right-to-left paragraphs are joined, put in display order and right-aligned. Devanagari, Bengali, Tamil, Thai and similar scripts are shaped with HarfBuzz, so conjuncts and vowel signs sit where they belong; text copied out of a shaped word can contain private-use characters.
+
+A sandbox image without these fonts falls back to matplotlib's copy of DejaVu Sans, then to Helvetica, which covers Latin only. For a layout the pdf kind can't express, the model can build the file in the Code Executor and convert HTML with `html-to-pdf`.
+
 ## Code Executor
 
 The Code Executor runs Python in a sandboxed session bound to your conversation (or to a workflow run). Files the code writes into the workspace are captured as artifacts automatically, so a script that produces `report.csv` gives you a downloadable artifact with no extra steps.
@@ -77,7 +88,7 @@ Key points:
 
 The self-hosted runner image and the Daytona snapshot hold the same set, listed in `docsgpt/sandbox/manifest.py`, and the Code Executor tells the model what is there so it doesn't have to find out by failing:
 
-- **Python libraries:** pandas, numpy, matplotlib, openpyxl, python-docx, python-pptx, reportlab, lxml, Pillow, requests, beautifulsoup4, PyYAML, pypdf, PyPDF2, pdfplumber, pdfminer.six, pypdfium2, pytesseract and imageio.
+- **Python libraries:** pandas, numpy, matplotlib, openpyxl, python-docx, python-pptx, reportlab (with uharfbuzz for shaping, and arabic-reshaper and python-bidi for right-to-left text), lxml, Pillow, requests, beautifulsoup4, PyYAML, pypdf, PyPDF2, pdfplumber, pdfminer.six, pypdfium2, pytesseract and imageio.
 - **Commands:** headless LibreOffice, headless Chromium, tesseract OCR (English), poppler's `pdftotext` and `pdftoppm`, `ffmpeg` and `ffprobe`, and Node.js 24 with `npm` and `npx`.
 - **Conversion helpers:** `office-convert FILE --to pdf` (also `docx`, `xlsx`, `pptx`, `png` and more) converts office documents with LibreOffice; `html-to-pdf` and `html-screenshot` render an HTML file or URL with Chromium.
 - **Fonts:** DejaVu, Liberation and Carlito/Caladea (metric-compatible with Arial, Times New Roman, Courier New, Calibri and Cambria), Noto for Arabic, Devanagari and other scripts, and Noto CJK for Chinese, Japanese and Korean.
```

**File**: `docsgpt/agents/tools/artifact_generator.py` (modified, +31/-26)
```diff
@@ -15,6 +15,7 @@
 import json
 import logging
 import uuid
+from pathlib import Path
 from typing import Any, Dict, List, Optional, Tuple
 
 from docsgpt.agents.tools.artifact_ref import resolve_artifact_id
@@ -25,6 +26,7 @@
     append_artifact_version,
     persist_new_artifact,
 )
+from docsgpt.sandbox.manifest import PDF_FONTS
 from docsgpt.sandbox.sandbox_creator import SandboxCreator
 from docsgpt.storage.db.repositories.artifacts import ArtifactsRepository
 from docsgpt.storage.db.session import db_readonly
@@ -237,6 +239,34 @@
     '{"type": "table", "rows": [[str]], "headers"?: [str]} | {"type": "code", "text"}'
 )
 
+
+def _pdf_renderer() -> str:
+    """Return the pdf renderer program: ``artifact_pdf.py`` run in its own namespace with the image's font table.
+
+    The module's source goes in as a string literal and runs in a fresh dict,
+    so its helpers never land in the session kernel that ``run_code`` shares.
+    The font table is the manifest's ``PDF_FONTS``; the sandbox looks the files
+    up. Braces are doubled so the template survives ``str.format``.
+
+    Returns:
+        A ``str.format`` template taking ``spec_path`` and ``out_path``.
+    """
+    source = Path(__file__).with_name("artifact_pdf.py").read_text(encoding="utf-8")
+    fonts = repr([dict(entry) for entry in PDF_FONTS])
+
+    def literal(value: str) -> str:
+        return value.replace("{", "{{").replace("}", "}}")
+
+    return (
+        "_docsgpt_artifact_pdf = {{'__name__': 'docsgpt_artifact_pdf'}}\n"
+        "try:\n"
+        f"    exec(compile({literal(repr(source))}, 'artifact_pdf.py', 'exec'), _docsgpt_artifact_pdf)\n"
+        f"    _docsgpt_artifact_pdf['render_pdf_spec']({{spec_path!r}}, {{out_path!r}}, {literal(fonts)})\n"
+        "finally:\n"
+        "    del _docsgpt_artifact_pdf\n"
+    )
+
+
 # FIXED renderer programs. Each reads ``spec.json`` from the workspace as DATA
 # and writes ``out.<ext>``. The spec is NEVER string-interpolated into the
 # program; ``{spec_path}``/``{out_path}`` are server-controlled path literals.
@@ -308,32 +338,7 @@
         "    wb.create_sheet(title='Sheet1')\n"
         "wb.save({out_path!r})\n"
     ),
-    "pdf": (
-        "import json\n"
-        "from reportlab.lib.pagesizes import letter\n"
-        "from reportlab.lib.styles import getSampleStyleSheet\n"
-        "from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer\n"
-        "from xml.sax.saxutils import escape\n"
-        "spec = json.load(open({spec_path!r}))\n"
-        "styles = getSampleStyleSheet()\n"
-        "story = []\n"
-        "title = spec.get('title')\n"
-        "if title:\n"
-        "    story.append(Paragraph(escape(str(title)), styles['Title']))\n"
-        "    story.append(Spacer(1, 12))\n"
-        "for block in spec.get('blocks', []):\n"
-        "    if block.get('type') == 'heading':\n"
-        "        try:\n"
-        "            level = int(block.get('level') or 1)\n"
-        "        except (TypeError, ValueError):\n"
-        "            level = 1\n"
-        "        style = styles['Heading%d' % min(max(level, 1), 3)]\n"
-        "    else:\n"
-        "        style = styles['BodyText']\n"
-        "    story.append(Paragraph(escape(str(block.get('text', ''))), style))\n"
-        "    story.append(Spacer(1, 6))\n"
-        "SimpleDocTemplate({out_path!r}, pagesize=letter).build(story)\n"
-    ),
+    "pdf": _pdf_renderer(),
     "html": (
         "import json\n"
         "import html\n"
```

**File**: `docsgpt/agents/tools/artifact_pdf.py` (added, +872/-0)
```diff
@@ -0,0 +1,872 @@
+"""The ``pdf`` artifact renderer: reportlab with fonts that cover the text's scripts.
+
+``artifact_generator`` sends this module's source to the sandbox and calls
+``render_pdf_spec`` there, so the module imports only the standard library at
+the top and reportlab, arabic_reshaper and python-bidi inside functions. The API
+process imports it only in tests.
+
+reportlab's built-in Helvetica draws Latin-1 and nothing else, so Cyrillic,
+Greek, Arabic, Devanagari, CJK and symbols such as ``−`` or ``→`` used to come
+out as boxes or blanks. Here:
+
+* Fonts. DejaVu Sans is the base family. Every other script the text uses gets
+  the Noto font the sandbox image installs; the table of files comes from
+  ``PDF_FONTS`` in ``docsgpt/sandbox/manifest.py`` and is looked up here, in
+  the sandbox. A base face missing from the image is taken from matplotlib's
+  bundled DejaVu Sans, and with no DejaVu at all the base is Helvetica. A font
+  that is missing or will not load is skipped, never fatal.
+* Mixed scripts. Each character is drawn in the first font whose character map
+  has it (its script's font, then the base, then the symbol fonts), and runs in
+  a font other than the paragraph's are wrapped in ``<font name="...">``.
+* Chinese, Japanese and Korean use reportlab's built-in CID fonts (STSong-Light,
+  HeiseiKakuGo-W5, HYGothic-Medium), chosen per sentence: kana makes it
+  Japanese, Hangul Korean, anything else Chinese. reportlab cannot load the
+  Noto CJK collection (CFF outlines in a ``.ttc``), and a CID font needs no
+  file: the PDF names the font and the viewer supplies the glyphs. They have no
+  bold face.
+* Right-to-left text. reportlab neither joins Arabic letters nor reorders RTL
+  text. Arabic is reshaped into its presentation forms (arabic_reshaper), the
+  paragraph is broken into lines here, each line is reordered for display
+  (python-bidi, with bracket pairs mirrored) and the paragraph is right-aligned
+  when its first strong character is right-to-left.
+* Scripts that need shaping (Devanagari, Bengali, Tamil, Thai and the rest of
+  ``SHAPED_SCRIPTS``) go through reportlab's HarfBuzz shaping when reportlab
+  supports it and uharfbuzz is installed; without it, or in a paragraph where
+  one word is drawn in two fonts, they draw unshaped.
+"""
+
+from __future__ import annotations
+
+import bisect
+import json
+import os
+import re
+import unicodedata
+from importlib.util import find_spec
+from typing import Any, Callable, Dict, Iterable, List, Mapping, Optional, Sequence, Set, Tuple
+
+BASE_FAMILY = "ArtifactSans"
+
+# Unicode blocks the renderer picks a font for, sorted by start and
+# non-overlapping. Characters outside them (Latin, Greek, Cyrillic, Armenian,
+# Georgian, digits, punctuation, symbols) have no script and go to the base
+# font when it has them. "cjk" is CJK punctuation and full-width forms, drawn
+# in the document's CJK font.
+_SCRIPT_RANGES: Tuple[Tuple[int, int, str], ...] = (
+    (0x0590, 0x05FF, "hebrew"),
+    (0x0600, 0x06FF, "arabic"),
+    (0x0700, 0x074F, "syriac"),
+    (0x0750, 0x077F, "arabic"),
+    (0x0870, 0x08FF, "arabic"),
+    (0x0900, 0x097F, "devanagari"),
+    (0x0980, 0x09FF, "bengali"),
+    (0x0A00, 0x0A7F, "gurmukhi"),
+    (0x0A80, 0x0AFF, "gujarati"),
+    (0x0B00, 0x0B7F, "oriya"),
+    (0x0B80, 0x0BFF, "tamil"),
+    (0x0C00, 0x0C7F, "telugu"),
+    (0x0C80, 0x0CFF, "kannada"),
+    (0x0D00, 0x0D7F, "malayalam"),
+    (0x0D80, 0x0DFF, "sinhala"),
+    (0x0E00, 0x0E7F, "thai"),
+    (0x0E80, 0x0EFF, "lao"),
+    (0x1000, 0x109F, "myanmar"),
+    (0x1100, 0x11FF, "hangul"),
+    (0x1200, 0x139F, "ethiopic"),
+    (0x1780, 0x17FF, "khmer"),
+    (0x1CD0, 0x1CFF, "devanagari"),
+    (0x2E80, 0x2FDF, "han"),
+    (0x3000, 0x303F, "cjk"),
+    (0x3040, 0x30FF, "kana"),
+    (0x3130, 0x318F, "hangul"),
+    (0x31F0, 0x31FF, "kana"),
+    (0x3200, 0x33FF, "cjk"),
+    (0x3400, 0x4DBF, "han"),
+    (0x4E00, 0x9FFF, "han"),
+    (0xA8E0, 0xA8FF, "devanagari"),
+    (0xA960, 0xA97F, "hangul"),
+    (0xAC00, 0xD7FF, "hangul"),
+    (0xF900, 0xFAFF, "han"),
+    (0xFB1D, 0xFB4F, "hebrew"),
+    (0xFB50, 0xFDFF, "arabic"),
+    (0xFE30, 0xFE4F, "cjk"),
+    (0xFE70, 0xFEFF, "arabic"),
+    (0xFF00, 0xFF65, "cjk"),
+    (0xFF66, 0xFF9F, "kana"),
+    (0xFFA0, 0xFFDF, "hangul"),
+    (0xFFE0, 0xFFEF, "cjk"),
+    (0x20000, 0x323AF, "han"),
+)
+_RANGE_STARTS = [start for start, _end, _script in _SCRIPT_RANGES]
+# Punctuation inside a script block that other scripts share: the dandas end
+# Bengali, Gurmukhi and Oriya sentences as well as Devanagari ones.
+_SHARED_PUNCTUATION = frozenset({0x0964, 0x0965})
+# Where a CJK sentence ends, for choosing its font.
+_SENTENCE_END = frozenset("。！？.!?\n．")
+
+RTL_SCRIPTS = frozenset({"arabic", "hebrew", "syriac"})
+CJK_SCRIPTS = frozenset({"han", "kana", "hangul", "cjk"})
+# Scripts whose letters change shape or order around each other, so they read
+# correctly only after HarfBuzz shaping.
+SH
```

**File**: `docsgpt/sandbox/manifest.py` (modified, +67/-2)
```diff
@@ -56,6 +56,20 @@ class Font(TypedDict):
     reportlab: bool
 
 
+class PdfFont(TypedDict):
+    """A TrueType font the pdf artifact renderer embeds: the script it draws and its regular and bold files.
+
+    ``script`` is ``base`` for the base family, ``symbols`` for a fallback
+    tried for characters no other font has, or a script key of
+    ``docsgpt/agents/tools/artifact_pdf.py``. ``bold`` is empty when the
+    package ships no bold face.
+    """
+
+    script: str
+    regular: str
+    bold: str
+
+
 class Missing(TypedDict):
     """A library models import that the image lacks: its pip name and what to use instead."""
 
@@ -73,14 +87,19 @@ class NodeRelease(TypedDict):
 
 # Libraries baked into both images. Pins are exact so a rebuild gives the same
 # image; pdfplumber stays at 0.11.9 because 0.11.10 needs Pillow >= 12.2.
+# reportlab is 4.4+ for its HarfBuzz shaping (through uharfbuzz), which the pdf
+# artifact renderer uses for Devanagari and other complex scripts.
 PIP_PACKAGES: Tuple[PipPackage, ...] = (
     {"spec": "pandas==2.2.3", "import": "pandas", "use": "dataframes, CSV and Excel I/O"},
     {"spec": "numpy==2.1.3", "import": "numpy", "use": "arrays and maths"},
     {"spec": "matplotlib==3.9.2", "import": "matplotlib", "use": "charts"},
     {"spec": "openpyxl==3.1.5", "import": "openpyxl", "use": "Excel .xlsx"},
     {"spec": "python-docx==1.1.2", "import": "docx", "use": "Word .docx"},
     {"spec": "python-pptx==1.0.2", "import": "pptx", "use": "PowerPoint .pptx"},
-    {"spec": "reportlab==4.2.5", "import": "reportlab", "use": "PDF generation"},
+    {"spec": "reportlab==4.4.10", "import": "reportlab", "use": "PDF generation"},
+    {"spec": "uharfbuzz==0.56.2", "import": "uharfbuzz", "use": "text shaping for reportlab (Indic scripts)"},
+    {"spec": "arabic-reshaper==3.0.1", "import": "arabic_reshaper", "use": "join Arabic letters for reportlab"},
+    {"spec": "python-bidi==0.6.11", "import": "bidi", "use": "right-to-left display order for reportlab"},
     {"spec": "lxml==6.1.3", "import": "lxml", "use": "XML and HTML parsing"},
     {"spec": "pillow==11.3.0", "import": "PIL", "use": "images"},
     {"spec": "requests==2.34.2", "import": "requests", "use": "HTTP"},
@@ -236,7 +255,52 @@ class NodeRelease(TypedDict):
     },
 )
 
-_USE_FFMPEG_CLI = "the ffmpeg command (run it with subprocess) for video, or imageio for GIF and WebP"
+_NOTO_DIR = "/usr/share/fonts/truetype/noto/"
+
+
+def _noto(script: str, family: str, bold: bool = True) -> PdfFont:
+    """Return the ``PdfFont`` for a fonts-noto-core family such as ``NotoSansArabic``."""
+    return {
+        "script": script,
+        "regular": f"{_NOTO_DIR}{family}-Regular.ttf",
+        "bold": f"{_NOTO_DIR}{family}-Bold.ttf" if bold else "",
+    }
+
+
+# Fonts the pdf artifact renderer (docsgpt/agents/tools/artifact_pdf.py) embeds,
+# by script; it looks the files up inside the sandbox and skips any that are
+# missing. Chinese, Japanese and Korean use reportlab's built-in CID fonts, so
+# they are not listed. The paths exist on Debian 12 and 13.
+PDF_FONTS: Tuple[PdfFont, ...] = (
+    {
+        "script": "base",
+        "regular": "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
+        "bold": "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
+    },
+    _noto("arabic", "NotoSansArabic"),
+    _noto("hebrew", "NotoSansHebrew"),
+    _noto("syriac", "NotoSansSyriac", bold=False),
+    _noto("devanagari", "NotoSansDevanagari"),
+    _noto("bengali", "NotoSansBengali"),
+    _noto("gurmukhi", "NotoSansGurmukhi"),
+    _noto("gujarati", "NotoSansGujarati"),
+    _noto("oriya", "NotoSansOriya"),
+    _noto("tamil", "NotoSansTamil"),
+    _noto("telugu", "NotoSansTelugu"),
+    _noto("kannada", "NotoSansKannada"),
+    _noto("malayalam", "NotoSansMalayalam"),
+    _noto("sinhala", "NotoSansSinhala"),
+    _noto("thai", "NotoSansThai"),
+    _noto("lao", "NotoSansLao"),
+    _noto("khmer", "NotoSansKhmer"),
+    _noto("myanmar", "NotoSansMyanmar"),
+    _noto("ethiopic", "NotoSansEthiopic"),
+    _noto("symbols", "NotoSansMath", bold=False),
+    _noto("symbols", "NotoSansSymbols2", bold=False),
+    _noto("symbols", "NotoSansSymbols", bold=False),
+)
+
+_USE_FFMPEG_CLI ="the ffmpeg command (run it with subprocess) for video, or imageio for GIF and WebP"
 _USE_OFFICE_CONVERT = "the office-convert command (LibreOffice) for Office conversions"
 _USE_PDFPLUMBER_TABLES = "pdfplumber's page.extract_tables()"
 
@@ -467,6 +531,7 @@ def render_manifest_json() -> str:
         "env": ENV,
         "binaries": list(BINARIES),
         "fonts": list(FONTS),
+        "pdf_fonts": list(PDF_FONTS),
         "helpers": HELPERS,
     }
     return json.dumps(data, indent=2) + "\n"
```

---

### Incident Patch 8: `d1597a94` (2026-10-05)
**Commit Message**: Merge pull request #2968 from arc53/feat/sandbox-model-guidance

Teach the model the code sandbox: environment summary, fix hints and a tighter tool description

**File**: `deployment/sandbox/Dockerfile` (modified, +4/-1)
```diff
@@ -73,8 +73,10 @@ RUN if [ "$INSTALL_DOCLING" = "true" ]; then \
 #
 # kernel-env.sh does the scrubbing and gives kernels a writable HOME under /tmp
 # (the root FS is read-only); sandbox.env is the image environment it passes on.
+# kernel-startup.py runs inside each kernel and drops the FORCE_COLOR ipykernel sets.
 COPY kernel-env.sh /opt/docsgpt/kernel-env.sh
 COPY kernel-launch.sh /opt/docsgpt/kernel-launch.sh
+COPY kernel-startup.py /opt/docsgpt/kernel-startup.py
 COPY gateway-launch.sh /opt/docsgpt/gateway-launch.sh
 COPY sandbox.env /opt/docsgpt/sandbox.env
 COPY kernels/docsgpt-python/kernel.json /usr/local/share/jupyter/kernels/docsgpt-python/kernel.json
@@ -90,7 +92,8 @@ COPY smoke_test.py /opt/docsgpt/smoke_test.py
 COPY manifest.json /opt/docsgpt/manifest.json
 RUN chmod 0555 /opt/docsgpt/kernel-env.sh /opt/docsgpt/kernel-launch.sh /opt/docsgpt/gateway-launch.sh \
         /usr/local/bin/office-convert /usr/local/bin/html-to-pdf /usr/local/bin/html-screenshot \
-    && chmod 0444 /opt/docsgpt/sandbox.env /opt/docsgpt/smoke_test.py /opt/docsgpt/manifest.json
+    && chmod 0444 /opt/docsgpt/sandbox.env /opt/docsgpt/kernel-startup.py /opt/docsgpt/smoke_test.py \
+        /opt/docsgpt/manifest.json
 
 # Numeric UID (not the name) so a kubelet with `runAsNonRoot: true` can verify
 # the user is non-root without resolving /etc/passwd. This uid MUST match
```

**File**: `deployment/sandbox/README.md` (modified, +7/-2)
```diff
@@ -135,8 +135,8 @@ the **stock** `python3` kernelspec, so session creation fails until you do one
 of these:
 
 - Install the scrubbing spec: copy `kernels/docsgpt-python/kernel.json`
-  (pointing `argv` at a local copy of `kernel-launch.sh`, with `kernel-env.sh`
-  and `sandbox.env` copied next to it) into a Jupyter data dir on the
+  (pointing `argv` at a local copy of `kernel-launch.sh`, with `kernel-env.sh`,
+  `kernel-startup.py` and `sandbox.env` copied next to it) into a Jupyter data dir on the
   kernelspec search path. The default kernel name then works. Kernels get
   `HOME=/tmp/home` unless you set `SANDBOX_KERNEL_HOME` on the gateway.
 - Or set `SANDBOX_KERNEL_NAME=python3` in the app's `.env`. The stock spec
@@ -239,6 +239,11 @@ creates the user site-packages directory before the kernel starts, so a package
 installed from a running kernel imports without a restart. All sessions share
 that `HOME`, like the rest of the container (see *Isolation model*).
 
+ipykernel sets `FORCE_COLOR=1` and `CLICOLOR_FORCE=1` once the kernel is up, so
+Node, npm and pip coloured their output even into a pipe and the model read
+escape codes. `kernel-launch.sh` runs `kernel-startup.py` in every kernel
+(`--IPKernelApp.exec_files`), which drops both and sets `NO_COLOR=1`.
+
 ### Smoke test
 
 `smoke_test.py` runs inside the image: it imports every manifest package,
```

**File**: `deployment/sandbox/kernel-launch.sh` (modified, +5/-1)
```diff
@@ -6,4 +6,8 @@
 # it) for a minimal allowlist plus a writable HOME; see that script. The
 # {connection_file} the gateway passes is forwarded via "$@" so loopback ZMQ
 # reachability is preserved -- do NOT drop or rewrite those args.
-exec sh "$(dirname "$0")/kernel-env.sh" python -m ipykernel_launcher "$@"
+#
+# kernel-startup.py runs in each kernel once ipykernel has set its environment,
+# to undo the FORCE_COLOR it sets (see that file).
+dir="$(dirname "$0")"
+exec sh "$dir/kernel-env.sh" python -m ipykernel_launcher "$@" "--IPKernelApp.exec_files=$dir/kernel-startup.py"
```

**File**: `deployment/sandbox/kernel-startup.py` (added, +16/-0)
```diff
@@ -0,0 +1,16 @@
+# Run in every sandbox kernel at start, after ipykernel has set up its environment.
+#
+# ipykernel's shell sets FORCE_COLOR=1 and CLICOLOR_FORCE=1 for the programs a
+# kernel starts, so Node, npm, pip and other tools colour their output even into
+# a pipe. The model reads that output as text, where colour codes are only noise
+# (the app strips them too, as a backstop), so drop both and set NO_COLOR.
+#
+# kernel-launch.sh loads this with --IPKernelApp.exec_files. It runs in the
+# user's namespace, so it uses comments rather than a docstring and deletes the
+# names it binds.
+import os as _docsgpt_os
+
+for _docsgpt_name in ("FORCE_COLOR", "CLICOLOR_FORCE"):
+    _docsgpt_os.environ.pop(_docsgpt_name, None)
+_docsgpt_os.environ["NO_COLOR"] = "1"
+del _docsgpt_os, _docsgpt_name
```

**File**: `deployment/sandbox/manifest.json` (modified, +16/-8)
```diff
@@ -195,7 +195,8 @@
     "PIP_ROOT_USER_ACTION": "ignore",
     "PIP_DISABLE_PIP_VERSION_CHECK": "1",
     "OMP_THREAD_LIMIT": "1",
-    "IMAGEIO_FFMPEG_EXE": "/usr/bin/ffmpeg"
+    "IMAGEIO_FFMPEG_EXE": "/usr/bin/ffmpeg",
+    "NO_COLOR": "1"
   },
   "binaries": [
     {
@@ -268,37 +269,44 @@
     {
       "name": "DejaVu Sans",
       "scripts": "Latin, Greek, Cyrillic",
-      "path": "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"
+      "path": "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
+      "reportlab": true
     },
     {
       "name": "Liberation Sans/Serif/Mono",
       "scripts": "Latin, Greek, Cyrillic; Arial, Times New Roman and Courier New metrics",
-      "path": "/usr/share/fonts/truetype/liberation2/LiberationSans-Regular.ttf"
+      "path": "/usr/share/fonts/truetype/liberation2/LiberationSans-Regular.ttf",
+      "reportlab": true
     },
     {
       "name": "Carlito",
       "scripts": "Latin; Calibri metrics",
-      "path": "/usr/share/fonts/truetype/crosextra/Carlito-Regular.ttf"
+      "path": "/usr/share/fonts/truetype/crosextra/Carlito-Regular.ttf",
+      "reportlab": true
     },
     {
       "name": "Caladea",
       "scripts": "Latin; Cambria metrics",
-      "path": "/usr/share/fonts/truetype/crosextra/Caladea-Regular.ttf"
+      "path": "/usr/share/fonts/truetype/crosextra/Caladea-Regular.ttf",
+      "reportlab": true
     },
     {
       "name": "Noto Sans Arabic",
       "scripts": "Arabic, Persian, Urdu",
-      "path": "/usr/share/fonts/truetype/noto/NotoSansArabic-Regular.ttf"
+      "path": "/usr/share/fonts/truetype/noto/NotoSansArabic-Regular.ttf",
+      "reportlab": true
     },
     {
       "name": "Noto Sans Devanagari",
       "scripts": "Devanagari: Hindi, Marathi, Nepali",
-      "path": "/usr/share/fonts/truetype/noto/NotoSansDevanagari-Regular.ttf"
+      "path": "/usr/share/fonts/truetype/noto/NotoSansDevanagari-Regular.ttf",
+      "reportlab": true
     },
     {
       "name": "Noto Sans CJK",
       "scripts": "Chinese, Japanese, Korean",
-      "path": "/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc"
+      "path": "/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc",
+      "reportlab": false
     }
   ],
   "helpers": {
```

**File**: `deployment/sandbox/sandbox.env` (modified, +1/-0)
```diff
@@ -3,3 +3,4 @@ PIP_ROOT_USER_ACTION=ignore
 PIP_DISABLE_PIP_VERSION_CHECK=1
 OMP_THREAD_LIMIT=1
 IMAGEIO_FFMPEG_EXE=/usr/bin/ffmpeg
+NO_COLOR=1
```

**File**: `deployment/sandbox/smoke_test.py` (modified, +5/-0)
```diff
@@ -96,6 +96,11 @@ def check_fonts(manifest: Dict) -> str:
     # The liberation2 compatibility link must not make fontconfig list the fonts twice.
     regular = [line for line in _run(["fc-list"]).stdout.splitlines() if "LiberationSans-Regular" in line]
     _expect(len(regular) == 1, f"Liberation Sans listed {len(regular)} times")
+    # The fonts the code executor offers for reportlab must load there.
+    from reportlab.pdfbase.ttfonts import TTFont
+
+    for number, font in enumerate(f for f in manifest["fonts"] if f.get("reportlab")):
+        TTFont(f"smoke{number}", font["path"])
     return f"{len(manifest['fonts'])} font files"
 
 
```

**File**: `docs/content/Tools/artifacts-and-code-execution.mdx` (modified, +40/-0)
```diff
@@ -84,6 +84,46 @@ The self-hosted runner image and the Daytona snapshot hold the same set, listed
 
 imageio writes animated GIF and WebP; for MP4 and other video the code runs `ffmpeg`. PyMuPDF (`fitz`) is not installed because of its AGPL license; pdfplumber, pypdf and pypdfium2 cover PDF reading.
 
+### What the model is told
+
+The Code Executor's tool description is under 300 words and depends only on the deployment (backend, `SANDBOX_EXEC_TIMEOUT`, `SANDBOX_MAX_TTL` and the manifest), never on the conversation, so providers can cache it. It tells the model:
+
+- what carries over between calls on this backend, and that a result marked `session: new` means it starts again;
+- that every file it writes in the working directory becomes a download, except under `scratch/`, that files elsewhere (such as `/tmp`) are never saved, and to save each deliverable once under its final name;
+- to show a chart with `plt.show()` to check it and `savefig()` the one the user should get, and to name saved files in its answer rather than link them;
+- to pass earlier files by reference (`A1`, `F3`) in `inputs` rather than download artifact URLs, which need the user's session;
+- the time cap, and to split longer work or run it in the background;
+- the preinstalled libraries by import name, the commands, and which library makes which format: reportlab for PDF (`html-to-pdf` for non-Latin text), python-docx, openpyxl and python-pptx for Office files, `office-convert` for conversions and `ffmpeg` for video;
+- to use the Artifact tool for documents the user will keep editing;
+- not to pip-install a listed library or run `apt-get`.
+
+The first result of a new session also carries an `environment` field, under 120 words: the packages with their import names, how to call `office-convert`, `html-to-pdf` and `html-screenshot`, the other commands, each font's file and the scripts it covers, the workspace paths, and the limits. A reused session's results leave it out. A new session also starts with an empty `scratch/` directory, so commands that don't create directories (such as `pdftoppm`) can write there.
+
+### Hints in results
+
+When a run shows a mistake the Code Executor recognizes, the result gets a `hint` list with a line or two for each. Package, command and font names in the hints come from the manifest.
+
+| The run shows | The hint says |
+| --- | --- |
+| An import of a package that isn't installed | Which preinstalled library or command to use instead (for example pdfplumber for `fitz`), or to install the package in the same call |
+| `pip install` of a preinstalled package | It is already installed; drop the pip step |
+| `apt-get`, `apt` or `sudo` in the code | System packages can't be installed; the commands that exist |
+| A missing file or variable in a new session | Earlier files and variables are gone; recreate them or pass them as inputs |
+| A missing variable on Daytona | Each call is a new interpreter; re-import and reload from files |
+| A missing file under `/tmp` | `/tmp` isn't kept; use `scratch/` or the workspace |
+| The time cap | Work not written before the cap is lost; split it and write partial results to `scratch/` |
+| A missing command (`wkhtmltopdf`, `pdftk`, `google-chrome`, ...) | The replacement (`html-to-pdf`, pypdf, ...) and the commands that exist |
+| A 401, 403 or connection error fetching this deployment's URLs or `/api/artifacts/` | Pass the file in `inputs` instead |
+| A PDF, Office file, image, CSV, HTML, MP4 or ZIP written to an absolute path outside the workspace | It was not saved; save it in the workspace |
+| More than three images saved, or files named like preview, test, tmp, debug or check | Which files the user got; put previews in `scratch/` |
+| A font file that can't be opened, or missing glyphs | The installed fonts with their files and scripts |
+| reportlab with non-Latin text in its built-in fonts, or with the Noto CJK collection (which it can't load) | Use `html-to-pdf`, which embeds the fonts and shapes Arabic and Devanagari, or a font reportlab can load |
+| A package installed at runtime whose compiled code won't load (the runner's `/tmp` is mounted `noexec`) | Use a preinstalled or pure-Python library |
+| A successful run with no output and no files | Print what it needs to see |
+| The same error twice in a row in one conversation | Change approach instead of retrying |
+
+Before the output is cut to its last 4,000 characters, colour codes and pip's routine lines ("Requirement already satisfied", the root-user warning, upgrade notices, download progress) are removed. The runner image also stops ipykernel from forcing colour on the programs code starts, so Node and npm print plain text. On Daytona, a failed run's `error` names the exception from the last traceback line instead of repeating the whole output.
+
 ### Run inputs
 
 You can pass files into a run. Each input accepts a short reference returned by a previous artifact action, a full artifact id
```

---

### Incident Patch 9: `f990972e` (2026-10-05)
**Commit Message**: Teach the model the code sandbox: environment summary, fix hints and a tighter tool description

Models made the same run_code mistakes across ~730 production calls: importing
libraries the image lacks or pip-installing ones it has, running apt-get,
expecting variables or /tmp files to outlive a call, writing deliverables
outside the workspace, saving previews as downloads, hardcoding font paths,
fetching the app's own artifact URLs from the sandbox, and retrying the same
failure.

- run_code's description is rewritten (about 300 words, deployment-stable):
  per-backend persistence, the workspace and scratch/ contract, show vs
  savefig, inputs by ref, limits, import names, commands and a format to
  library guide, and when artifact_generator fits better.
- A new session's first result carries an `environment` summary rendered
  from the manifest: packages with import names, helper usage, other
  commands, fonts with files and scripts, paths and limits.
- Results carry `hint` lines built from the manifest for missing modules,
  preinstalled pip installs, apt-get, lost session state, /tmp, timeouts,
  missing commands, app URLs, deliverables outside the workspace, previews,
  fonts,

**File**: `deployment/sandbox/Dockerfile` (modified, +4/-1)
```diff
@@ -73,8 +73,10 @@ RUN if [ "$INSTALL_DOCLING" = "true" ]; then \
 #
 # kernel-env.sh does the scrubbing and gives kernels a writable HOME under /tmp
 # (the root FS is read-only); sandbox.env is the image environment it passes on.
+# kernel-startup.py runs inside each kernel and drops the FORCE_COLOR ipykernel sets.
 COPY kernel-env.sh /opt/docsgpt/kernel-env.sh
 COPY kernel-launch.sh /opt/docsgpt/kernel-launch.sh
+COPY kernel-startup.py /opt/docsgpt/kernel-startup.py
 COPY gateway-launch.sh /opt/docsgpt/gateway-launch.sh
 COPY sandbox.env /opt/docsgpt/sandbox.env
 COPY kernels/docsgpt-python/kernel.json /usr/local/share/jupyter/kernels/docsgpt-python/kernel.json
@@ -90,7 +92,8 @@ COPY smoke_test.py /opt/docsgpt/smoke_test.py
 COPY manifest.json /opt/docsgpt/manifest.json
 RUN chmod 0555 /opt/docsgpt/kernel-env.sh /opt/docsgpt/kernel-launch.sh /opt/docsgpt/gateway-launch.sh \
         /usr/local/bin/office-convert /usr/local/bin/html-to-pdf /usr/local/bin/html-screenshot \
-    && chmod 0444 /opt/docsgpt/sandbox.env /opt/docsgpt/smoke_test.py /opt/docsgpt/manifest.json
+    && chmod 0444 /opt/docsgpt/sandbox.env /opt/docsgpt/kernel-startup.py /opt/docsgpt/smoke_test.py \
+        /opt/docsgpt/manifest.json
 
 # Numeric UID (not the name) so a kubelet with `runAsNonRoot: true` can verify
 # the user is non-root without resolving /etc/passwd. This uid MUST match
```

**File**: `deployment/sandbox/README.md` (modified, +7/-2)
```diff
@@ -135,8 +135,8 @@ the **stock** `python3` kernelspec, so session creation fails until you do one
 of these:
 
 - Install the scrubbing spec: copy `kernels/docsgpt-python/kernel.json`
-  (pointing `argv` at a local copy of `kernel-launch.sh`, with `kernel-env.sh`
-  and `sandbox.env` copied next to it) into a Jupyter data dir on the
+  (pointing `argv` at a local copy of `kernel-launch.sh`, with `kernel-env.sh`,
+  `kernel-startup.py` and `sandbox.env` copied next to it) into a Jupyter data dir on the
   kernelspec search path. The default kernel name then works. Kernels get
   `HOME=/tmp/home` unless you set `SANDBOX_KERNEL_HOME` on the gateway.
 - Or set `SANDBOX_KERNEL_NAME=python3` in the app's `.env`. The stock spec
@@ -239,6 +239,11 @@ creates the user site-packages directory before the kernel starts, so a package
 installed from a running kernel imports without a restart. All sessions share
 that `HOME`, like the rest of the container (see *Isolation model*).
 
+ipykernel sets `FORCE_COLOR=1` and `CLICOLOR_FORCE=1` once the kernel is up, so
+Node, npm and pip coloured their output even into a pipe and the model read
+escape codes. `kernel-launch.sh` runs `kernel-startup.py` in every kernel
+(`--IPKernelApp.exec_files`), which drops both and sets `NO_COLOR=1`.
+
 ### Smoke test
 
 `smoke_test.py` runs inside the image: it imports every manifest package,
```

**File**: `deployment/sandbox/kernel-launch.sh` (modified, +5/-1)
```diff
@@ -6,4 +6,8 @@
 # it) for a minimal allowlist plus a writable HOME; see that script. The
 # {connection_file} the gateway passes is forwarded via "$@" so loopback ZMQ
 # reachability is preserved -- do NOT drop or rewrite those args.
-exec sh "$(dirname "$0")/kernel-env.sh" python -m ipykernel_launcher "$@"
+#
+# kernel-startup.py runs in each kernel once ipykernel has set its environment,
+# to undo the FORCE_COLOR it sets (see that file).
+dir="$(dirname "$0")"
+exec sh "$dir/kernel-env.sh" python -m ipykernel_launcher "$@" "--IPKernelApp.exec_files=$dir/kernel-startup.py"
```

**File**: `deployment/sandbox/kernel-startup.py` (added, +16/-0)
```diff
@@ -0,0 +1,16 @@
+# Run in every sandbox kernel at start, after ipykernel has set up its environment.
+#
+# ipykernel's shell sets FORCE_COLOR=1 and CLICOLOR_FORCE=1 for the programs a
+# kernel starts, so Node, npm, pip and other tools colour their output even into
+# a pipe. The model reads that output as text, where colour codes are only noise
+# (the app strips them too, as a backstop), so drop both and set NO_COLOR.
+#
+# kernel-launch.sh loads this with --IPKernelApp.exec_files. It runs in the
+# user's namespace, so it uses comments rather than a docstring and deletes the
+# names it binds.
+import os as _docsgpt_os
+
+for _docsgpt_name in ("FORCE_COLOR", "CLICOLOR_FORCE"):
+    _docsgpt_os.environ.pop(_docsgpt_name, None)
+_docsgpt_os.environ["NO_COLOR"] = "1"
+del _docsgpt_os, _docsgpt_name
```

**File**: `deployment/sandbox/manifest.json` (modified, +16/-8)
```diff
@@ -195,7 +195,8 @@
     "PIP_ROOT_USER_ACTION": "ignore",
     "PIP_DISABLE_PIP_VERSION_CHECK": "1",
     "OMP_THREAD_LIMIT": "1",
-    "IMAGEIO_FFMPEG_EXE": "/usr/bin/ffmpeg"
+    "IMAGEIO_FFMPEG_EXE": "/usr/bin/ffmpeg",
+    "NO_COLOR": "1"
   },
   "binaries": [
     {
@@ -268,37 +269,44 @@
     {
       "name": "DejaVu Sans",
       "scripts": "Latin, Greek, Cyrillic",
-      "path": "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"
+      "path": "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
+      "reportlab": true
     },
     {
       "name": "Liberation Sans/Serif/Mono",
       "scripts": "Latin, Greek, Cyrillic; Arial, Times New Roman and Courier New metrics",
-      "path": "/usr/share/fonts/truetype/liberation2/LiberationSans-Regular.ttf"
+      "path": "/usr/share/fonts/truetype/liberation2/LiberationSans-Regular.ttf",
+      "reportlab": true
     },
     {
       "name": "Carlito",
       "scripts": "Latin; Calibri metrics",
-      "path": "/usr/share/fonts/truetype/crosextra/Carlito-Regular.ttf"
+      "path": "/usr/share/fonts/truetype/crosextra/Carlito-Regular.ttf",
+      "reportlab": true
     },
     {
       "name": "Caladea",
       "scripts": "Latin; Cambria metrics",
-      "path": "/usr/share/fonts/truetype/crosextra/Caladea-Regular.ttf"
+      "path": "/usr/share/fonts/truetype/crosextra/Caladea-Regular.ttf",
+      "reportlab": true
     },
     {
       "name": "Noto Sans Arabic",
       "scripts": "Arabic, Persian, Urdu",
-      "path": "/usr/share/fonts/truetype/noto/NotoSansArabic-Regular.ttf"
+      "path": "/usr/share/fonts/truetype/noto/NotoSansArabic-Regular.ttf",
+      "reportlab": true
     },
     {
       "name": "Noto Sans Devanagari",
       "scripts": "Devanagari: Hindi, Marathi, Nepali",
-      "path": "/usr/share/fonts/truetype/noto/NotoSansDevanagari-Regular.ttf"
+      "path": "/usr/share/fonts/truetype/noto/NotoSansDevanagari-Regular.ttf",
+      "reportlab": true
     },
     {
       "name": "Noto Sans CJK",
       "scripts": "Chinese, Japanese, Korean",
-      "path": "/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc"
+      "path": "/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc",
+      "reportlab": false
     }
   ],
   "helpers": {
```

**File**: `deployment/sandbox/sandbox.env` (modified, +1/-0)
```diff
@@ -3,3 +3,4 @@ PIP_ROOT_USER_ACTION=ignore
 PIP_DISABLE_PIP_VERSION_CHECK=1
 OMP_THREAD_LIMIT=1
 IMAGEIO_FFMPEG_EXE=/usr/bin/ffmpeg
+NO_COLOR=1
```

**File**: `deployment/sandbox/smoke_test.py` (modified, +5/-0)
```diff
@@ -96,6 +96,11 @@ def check_fonts(manifest: Dict) -> str:
     # The liberation2 compatibility link must not make fontconfig list the fonts twice.
     regular = [line for line in _run(["fc-list"]).stdout.splitlines() if "LiberationSans-Regular" in line]
     _expect(len(regular) == 1, f"Liberation Sans listed {len(regular)} times")
+    # The fonts the code executor offers for reportlab must load there.
+    from reportlab.pdfbase.ttfonts import TTFont
+
+    for number, font in enumerate(f for f in manifest["fonts"] if f.get("reportlab")):
+        TTFont(f"smoke{number}", font["path"])
     return f"{len(manifest['fonts'])} font files"
 
 
```

**File**: `docs/content/Tools/artifacts-and-code-execution.mdx` (modified, +40/-0)
```diff
@@ -84,6 +84,46 @@ The self-hosted runner image and the Daytona snapshot hold the same set, listed
 
 imageio writes animated GIF and WebP; for MP4 and other video the code runs `ffmpeg`. PyMuPDF (`fitz`) is not installed because of its AGPL license; pdfplumber, pypdf and pypdfium2 cover PDF reading.
 
+### What the model is told
+
+The Code Executor's tool description is under 300 words and depends only on the deployment (backend, `SANDBOX_EXEC_TIMEOUT`, `SANDBOX_MAX_TTL` and the manifest), never on the conversation, so providers can cache it. It tells the model:
+
+- what carries over between calls on this backend, and that a result marked `session: new` means it starts again;
+- that every file it writes in the working directory becomes a download, except under `scratch/`, that files elsewhere (such as `/tmp`) are never saved, and to save each deliverable once under its final name;
+- to show a chart with `plt.show()` to check it and `savefig()` the one the user should get, and to name saved files in its answer rather than link them;
+- to pass earlier files by reference (`A1`, `F3`) in `inputs` rather than download artifact URLs, which need the user's session;
+- the time cap, and to split longer work or run it in the background;
+- the preinstalled libraries by import name, the commands, and which library makes which format: reportlab for PDF (`html-to-pdf` for non-Latin text), python-docx, openpyxl and python-pptx for Office files, `office-convert` for conversions and `ffmpeg` for video;
+- to use the Artifact tool for documents the user will keep editing;
+- not to pip-install a listed library or run `apt-get`.
+
+The first result of a new session also carries an `environment` field, under 120 words: the packages with their import names, how to call `office-convert`, `html-to-pdf` and `html-screenshot`, the other commands, each font's file and the scripts it covers, the workspace paths, and the limits. A reused session's results leave it out. A new session also starts with an empty `scratch/` directory, so commands that don't create directories (such as `pdftoppm`) can write there.
+
+### Hints in results
+
+When a run shows a mistake the Code Executor recognizes, the result gets a `hint` list with a line or two for each. Package, command and font names in the hints come from the manifest.
+
+| The run shows | The hint says |
+| --- | --- |
+| An import of a package that isn't installed | Which preinstalled library or command to use instead (for example pdfplumber for `fitz`), or to install the package in the same call |
+| `pip install` of a preinstalled package | It is already installed; drop the pip step |
+| `apt-get`, `apt` or `sudo` in the code | System packages can't be installed; the commands that exist |
+| A missing file or variable in a new session | Earlier files and variables are gone; recreate them or pass them as inputs |
+| A missing variable on Daytona | Each call is a new interpreter; re-import and reload from files |
+| A missing file under `/tmp` | `/tmp` isn't kept; use `scratch/` or the workspace |
+| The time cap | Work not written before the cap is lost; split it and write partial results to `scratch/` |
+| A missing command (`wkhtmltopdf`, `pdftk`, `google-chrome`, ...) | The replacement (`html-to-pdf`, pypdf, ...) and the commands that exist |
+| A 401, 403 or connection error fetching this deployment's URLs or `/api/artifacts/` | Pass the file in `inputs` instead |
+| A PDF, Office file, image, CSV, HTML, MP4 or ZIP written to an absolute path outside the workspace | It was not saved; save it in the workspace |
+| More than three images saved, or files named like preview, test, tmp, debug or check | Which files the user got; put previews in `scratch/` |
+| A font file that can't be opened, or missing glyphs | The installed fonts with their files and scripts |
+| reportlab with non-Latin text in its built-in fonts, or with the Noto CJK collection (which it can't load) | Use `html-to-pdf`, which embeds the fonts and shapes Arabic and Devanagari, or a font reportlab can load |
+| A package installed at runtime whose compiled code won't load (the runner's `/tmp` is mounted `noexec`) | Use a preinstalled or pure-Python library |
+| A successful run with no output and no files | Print what it needs to see |
+| The same error twice in a row in one conversation | Change approach instead of retrying |
+
+Before the output is cut to its last 4,000 characters, colour codes and pip's routine lines ("Requirement already satisfied", the root-user warning, upgrade notices, download progress) are removed. The runner image also stops ipykernel from forcing colour on the programs code starts, so Node and npm print plain text. On Daytona, a failed run's `error` names the exception from the last traceback line instead of repeating the whole output.
+
 ### Run inputs
 
 You can pass files into a run. Each input accepts a short reference returned by a previous artifact action, a full artifact id
```

---

### Incident Patch 10: `4c40f3cb` (2026-10-05)
**Commit Message**: fix: when a type list is split into anyOf branches

**File**: `docsgpt/llm/anthropic.py` (modified, +30/-7)
```diff
@@ -112,20 +112,31 @@ def _json_type(value: Any) -> Optional[str]:
     return None
 
 
+def _matches_type(value: Any, type_name: str) -> bool:
+    """Whether ``value`` is an instance of the JSON Schema type ``type_name``."""
+    value_type = _json_type(value)
+    return value_type == type_name or (type_name == "number" and value_type == "integer")
+
+
 def _normalize_schema(schema: Any, root: bool = False) -> Any:
     """Rewrite JSON Schema spellings ``transform_schema`` cannot read.
 
     Returns a copy (the input is not mutated) where a list-valued ``type``
-    becomes an ``anyOf`` of single types, ``const`` becomes a one-value
-    ``enum``, an ``enum`` with no ``type`` gets the type of its values, and
-    draft-07 ``definitions`` become ``$defs``.
+    becomes an ``anyOf`` of single types (each keeping only the ``enum``
+    values of its own type), ``const`` becomes a one-value ``enum``, an
+    ``enum`` with no ``type`` gets the type of its values, and draft-07
+    ``definitions`` become ``$defs``.
 
     Args:
         schema: A schema node; non-dict values are returned unchanged.
         root: Whether this is the top-level schema.
 
     Returns:
         The rewritten schema node.
+
+    Raises:
+        ValueError: A list-valued ``type`` whose ``enum`` has no value of
+            any listed type, so no answer could match.
     """
     if not isinstance(schema, dict):
         return schema
@@ -160,10 +171,22 @@ def _normalize_schema(schema: Any, root: bool = False) -> Any:
     if isinstance(types, list):
         node.pop("type")
         outer = {key: node.pop(key) for key in ("description", "title") if key in node}
-        branches = [
-            {"type": "null"} if name == "null" else {**node, "type": name}
-            for name in types
-        ]
+        enum = node.pop("enum", None)
+        branches = []
+        for name in types:
+            branch = {"type": "null"} if name == "null" else {**node, "type": name}
+            if isinstance(enum, list):
+                # A branch admits only its own type's values and is dropped
+                # when it has none, so a bare ``null`` branch cannot reopen
+                # what the enum excluded.
+                values = [value for value in enum if _matches_type(value, name)]
+                if not values:
+                    continue
+                if name != "null":
+                    branch["enum"] = values
+            branches.append(branch)
+        if not branches:
+            raise ValueError(f"enum {enum!r} has no value of type {types!r}")
         if len(branches) == 1:
             return {**outer, **branches[0]}
         return {**outer, "anyOf": branches}
```

**File**: `tests/llm/test_anthropic.py` (modified, +72/-0)
```diff
@@ -1114,6 +1114,78 @@ def test_prepare_nullable_type_list_becomes_any_of(self, llm):
         assert note["description"] == "Optional note"
         assert {branch["type"] for branch in note["anyOf"]} == {"string", "null"}
 
+    def test_prepare_type_list_enum_without_null_drops_null_branch(self, llm):
+        """A bare ``null`` branch would let the model answer ``null`` although
+        the enum excludes it."""
+        schema = {
+            "type": "object",
+            "properties": {
+                "status": {"type": ["string", "null"], "enum": ["open", "closed"]},
+            },
+        }
+
+        status = llm.prepare_structured_output_format(schema)["schema"]["properties"]["status"]
+
+        assert status == {"type": "string", "enum": ["open", "closed"]}
+
+    def test_prepare_type_list_splits_enum_values_by_type(self, llm):
+        schema = {
+            "type": "object",
+            "properties": {
+                "status": {"type": ["string", "null"], "enum": ["open", None]},
+                "code": {"type": ["integer", "string"], "enum": [1, "a"]},
+            },
+        }
+
+        props = llm.prepare_structured_output_format(schema)["schema"]["properties"]
+
+        assert props["status"]["anyOf"] == [
+            {"type": "string", "enum": ["open"]},
+            {"type": "null"},
+        ]
+        assert props["code"]["anyOf"] == [
+            {"type": "integer", "enum": [1]},
+            {"type": "string", "enum": ["a"]},
+        ]
+
+    def test_prepare_type_list_enum_matching_no_type_returns_none(self, llm):
+        """No value satisfies such a schema; it goes out unenforced rather
+        than as an empty ``anyOf``."""
+        schema = {
+            "type": "object",
+            "properties": {"x": {"type": ["string", "null"], "enum": [1]}},
+        }
+
+        assert llm.prepare_structured_output_format(schema) is None
+
+    def test_prepare_normalizes_inside_combinators(self, llm):
+        schema = {
+            "type": "object",
+            "properties": {
+                "kind": {"anyOf": [{"const": "a"}, {"type": ["integer", "null"]}]},
+            },
+        }
+
+        kind = llm.prepare_structured_output_format(schema)["schema"]["properties"]["kind"]
+
+        assert kind["anyOf"][0] == {"type": "string", "enum": ["a"]}
+        assert {branch["type"] for branch in kind["anyOf"][1]["anyOf"]} == {"integer", "null"}
+
+    def test_prepare_typeless_enum_of_containers_returns_none(self, llm):
+        """Enum values with no JSON scalar type leave ``type`` unset, which
+        the API cannot express."""
+        schema = {
+            "type": "object",
+            "properties": {"pair": {"enum": [[1, 2], [3, 4]]}},
+        }
+
+        assert llm.prepare_structured_output_format(schema) is None
+
+    def test_prepare_boolean_subschema_returns_none(self, llm):
+        schema = {"type": "object", "properties": {"anything": True}}
+
+        assert llm.prepare_structured_output_format(schema) is None
+
     def test_prepare_const_becomes_single_value_enum(self, llm):
         schema = {
             "type": "object",
```

---

### Incident Patch 11: `f72fa686` (2026-10-05)
**Commit Message**: fix anthropic structured output

**File**: `docs/content/API/openai-compatible.mdx` (modified, +2/-1)
```diff
@@ -1,7 +1,7 @@
 ---
 title: OpenAI-Compatible API
 description: Connect any OpenAI-compatible client to DocsGPT Agents via /v1/chat/completions — streaming, structured output, files and images, tool calling, reasoning, and idempotent retries.
-lastUpdated: 2026-10-02
+lastUpdated: 2026-10-05
 ---
 
 import { Callout, Tabs } from 'nextra/components';
@@ -143,6 +143,7 @@ You can force the model to return JSON matching a schema, using either the OpenA
 
 - `response_format` follows OpenAI Structured Outputs. `strict` defaults to `true`; set `strict: false` to relax enforcement.
 - `response_format: {"type": "json_object"}` requests JSON without a fixed schema (the model is steered by the prompt).
+- On Claude models the schema is always enforced, even with `strict: false`. Constraints Claude cannot enforce, such as `minimum` or `maxLength`, are passed to the model as hints in the field description. `json_object` has no Claude equivalent and is ignored.
 - `response_schema` is a DocsGPT convenience: pass a raw JSON Schema object (or a `{"schema": {...}}` wrapper) directly.
 
 ## Files and Images
```

**File**: `docsgpt/agents/base.py` (modified, +4/-3)
```diff
@@ -1811,13 +1811,14 @@ def _structured_output_kwarg(self) -> Optional[str]:
         declaration so the cross-provider fallback adapter can read it too.
 
         Returns:
-            ``"response_format"``, ``"response_schema"``, or None when the
-            provider has no structured-output kwarg.
+            ``"response_format"``, ``"response_schema"``,
+            ``"output_format"``, or None when the provider has no
+            structured-output kwarg.
         """
         # ``type(self.llm)`` — an instance attribute on a test double would
         # otherwise leak a truthy Mock into the gen kwargs.
         kwarg = getattr(type(self.llm), "structured_output_kwarg", None)
-        return kwarg if kwarg in ("response_format", "response_schema") else None
+        return kwarg if kwarg in ("response_format", "response_schema", "output_format") else None
 
     def _llm_gen(
         self,
```

**File**: `docsgpt/cache.py` (modified, +3/-2)
```diff
@@ -30,8 +30,9 @@ def _cache_default(value):
 
 # Generation kwargs that never reach the provider: usage-accounting side
 # channels only. Everything else the caller passes (``response_format``,
-# ``response_schema``, ``tool_choice``, ``reasoning_effort``, sampling
-# params, ...) is part of the request and therefore part of the key —
+# ``response_schema``, ``output_format``, ``tool_choice``,
+# ``reasoning_effort``, sampling params, ...) is part of the request and
+# therefore part of the key —
 # otherwise a workflow node that changed its JSON schema replays the old
 # schema's cached answer for the whole TTL.
 _CACHE_KEY_IGNORED_KWARGS = frozenset({"_usage_attachments", "_attachment_dispatch", "attachments"})
```

**File**: `docsgpt/llm/anthropic.py` (modified, +139/-1)
```diff
@@ -3,7 +3,7 @@
 import logging
 from typing import Any, Dict, Generator, List, Optional, Tuple
 
-from anthropic import Anthropic
+from anthropic import Anthropic, transform_schema
 
 from docsgpt.core.settings import settings
 from docsgpt.llm.base import BaseLLM, optional_int
@@ -85,13 +85,95 @@
     "refusal": "stop",
 }
 
+# Root-level meta keywords that carry no constraint. ``transform_schema``
+# would fold them into the root description, so they are dropped instead.
+_SCHEMA_META_KEYWORDS = ("$schema", "$id", "$comment")
+
+# JSON types of enum/const values, for schemas that leave ``type`` implied.
+# ``bool`` precedes ``int`` because it is a subclass of it.
+_JSON_TYPES = (
+    (bool, "boolean"),
+    (int, "integer"),
+    (float, "number"),
+    (str, "string"),
+    (type(None), "null"),
+)
+
 # ``image/jpg`` is accepted by our upload path but is not a media type the
 # Messages API recognises — it 400s. Normalise on the way out.
 _MEDIA_TYPE_ALIASES = {"image/jpg": "image/jpeg"}
 
 
+def _json_type(value: Any) -> Optional[str]:
+    """JSON Schema type name of a Python value, or None for containers."""
+    for python_type, name in _JSON_TYPES:
+        if isinstance(value, python_type):
+            return name
+    return None
+
+
+def _normalize_schema(schema: Any, root: bool = False) -> Any:
+    """Rewrite JSON Schema spellings ``transform_schema`` cannot read.
+
+    Returns a copy (the input is not mutated) where a list-valued ``type``
+    becomes an ``anyOf`` of single types, ``const`` becomes a one-value
+    ``enum``, an ``enum`` with no ``type`` gets the type of its values, and
+    draft-07 ``definitions`` become ``$defs``.
+
+    Args:
+        schema: A schema node; non-dict values are returned unchanged.
+        root: Whether this is the top-level schema.
+
+    Returns:
+        The rewritten schema node.
+    """
+    if not isinstance(schema, dict):
+        return schema
+    node = dict(schema)
+    if root:
+        for key in _SCHEMA_META_KEYWORDS:
+            node.pop(key, None)
+        if "definitions" in node and "$defs" not in node:
+            node["$defs"] = node.pop("definitions")
+
+    ref = node.get("$ref")
+    if isinstance(ref, str) and ref.startswith("#/definitions/"):
+        node["$ref"] = "#/$defs/" + ref[len("#/definitions/"):]
+
+    if "const" in node and "enum" not in node:
+        node["enum"] = [node.pop("const")]
+    if "type" not in node and isinstance(node.get("enum"), list):
+        value_types = {_json_type(value) for value in node["enum"]}
+        if len(value_types) == 1 and None not in value_types:
+            node["type"] = value_types.pop()
+
+    for key in ("properties", "$defs"):
+        if isinstance(node.get(key), dict):
+            node[key] = {name: _normalize_schema(sub) for name, sub in node[key].items()}
+    if isinstance(node.get("items"), dict):
+        node["items"] = _normalize_schema(node["items"])
+    for key in ("anyOf", "oneOf", "allOf"):
+        if isinstance(node.get(key), list):
+            node[key] = [_normalize_schema(sub) for sub in node[key]]
+
+    types = node.get("type")
+    if isinstance(types, list):
+        node.pop("type")
+        outer = {key: node.pop(key) for key in ("description", "title") if key in node}
+        branches = [
+            {"type": "null"} if name == "null" else {**node, "type": name}
+            for name in types
+        ]
+        if len(branches) == 1:
+            return {**outer, **branches[0]}
+        return {**outer, "anyOf": branches}
+    return node
+
+
 class AnthropicLLM(BaseLLM):
     provider_name = "anthropic"
+    # Internal gen kwarg; ``_build_request`` sends it as ``output_config.format``.
+    structured_output_kwarg = "output_format"
 
     def __init__(self, api_key=None, user_api_key=None, base_url=None, *args, **kwargs):
 
@@ -498,6 +580,12 @@ def _build_request(
             if cleaned_tools:
                 params["tools"] = cleaned_tools
 
+        # Defense-in-depth, as for tools: a model whose registry entry denies
+        # structured output never gets a format it would 400 on.
+        output_format = kwargs.get("output_format")
+        if output_format and self._supports_structured_output():
+            params["output_config"] = {"format": output_format}
+
         for key in _PASSTHROUGH_PARAMS:
             if kwargs.get(key) is not None:
                 params[key] = kwargs[key]
@@ -696,6 +784,56 @@ def _supports_tools(self) -> bool:
             return bool(self.capabilities.supports_tools)
         return True
 
+    def _supports_structured_output(self) -> bool:
+        """Whether this model may be sent a JSON schema to enforce.
+
+        Returns:
+            The registry capability flag when one is attached, otherwise
+            True: every current Claude model supports structured outputs.
+        """
+        if self.capabilities is not None:
+            return bool(self.capabilities.supports_structured_output)
+
```

**File**: `docsgpt/llm/base.py` (modified, +5/-2)
```diff
@@ -94,7 +94,8 @@ class BaseLLM(ABC):
 
     # Name of the gen kwarg this provider takes structured output on
     # ("response_format" for OpenAI-wire classes, "response_schema" for
-    # Google); None = the provider has no structured-output kwarg.
+    # Google, "output_format" for Anthropic); None = the provider has no
+    # structured-output kwarg.
     structured_output_kwarg: ClassVar[Optional[str]] = None
 
     # (json_schema, strict) last passed to ``prepare_structured_output_format``;
@@ -108,6 +109,7 @@ class BaseLLM(ABC):
     _STRUCTURED_OUTPUT_KWARGS: ClassVar[Tuple[str, ...]] = (
         "response_format",
         "response_schema",
+        "output_format",
     )
 
     def __init__(
@@ -562,7 +564,8 @@ def _adapt_structured_output_kwargs(self, fallback, kwargs: Dict) -> Dict:
         """Re-express the primary's structured-output kwargs for ``fallback``.
 
         Structured output is provider-specific: OpenAI-wire classes take
-        ``response_format``, Google takes ``response_schema``. Forwarding the
+        ``response_format``, Google takes ``response_schema``, Anthropic takes
+        ``output_format``. Forwarding the
         primary's kwarg verbatim to a different-family backup either loses
         enforcement silently (Google swallows ``response_format`` in
         ``**kwargs``) or raises ``TypeError`` inside the OpenAI SDK
```

**File**: `docsgpt/usage.py` (modified, +1/-0)
```diff
@@ -91,6 +91,7 @@ def _count_prompt_tokens(messages, tools=None, usage_attachments=None, **kwargs)
     # Count structured-output/schema payloads when provided.
     prompt_tokens += _count_tokens(kwargs.get("response_format"))
     prompt_tokens += _count_tokens(kwargs.get("response_schema"))
+    prompt_tokens += _count_tokens(kwargs.get("output_format"))
 
     # Optional usage-only attachment context (not forwarded to provider).
     prompt_tokens += _count_tokens(usage_attachments)
```

**File**: `tests/agents/test_base_agent.py` (modified, +21/-11)
```diff
@@ -1714,23 +1714,37 @@ def test_google_llm_gets_no_json_object_mode(
         assert "response_format" not in call_kwargs
         assert "response_schema" not in call_kwargs
 
-    def test_non_openai_wire_llm_gets_neither(
+    def test_anthropic_llm_gets_output_format(
         self, agent_base_params, mock_llm_handler_creator, log_context
     ):
-        """Even a capability-claiming Anthropic LLM takes no format kwarg."""
+        """Anthropic takes the schema on its own kwarg, sent as output_config.format."""
         llm = AnthropicLLM(api_key="ant-test", user_api_key=None)
-        llm._supports_structured_output = Mock(return_value=True)
-        llm.prepare_structured_output_format = Mock(return_value={"schema": "x"})
         agent = _build_agent_with_llm(
             agent_base_params, llm, "anthropic", json_schema=SCHEMA
         )
 
         agent._llm_gen([{"role": "user", "content": "test"}], log_context)
 
         call_kwargs = llm.gen_stream.call_args[1]
+        assert call_kwargs["output_format"]["type"] == "json_schema"
+        assert call_kwargs["output_format"]["schema"]["additionalProperties"] is False
         assert "response_format" not in call_kwargs
         assert "response_schema" not in call_kwargs
 
+    def test_anthropic_answer_is_marked_structured(
+        self, agent_base_params, mock_llm_handler_creator, log_context
+    ):
+        """Workflow nodes read ``structured`` to parse the answer as JSON."""
+        llm = AnthropicLLM(api_key="ant-test", user_api_key=None)
+        agent = _build_agent_with_llm(
+            agent_base_params, llm, "anthropic", json_schema=SCHEMA
+        )
+
+        events = list(agent._handle_response('{"a": 1}', {}, [], log_context))
+
+        answers = [event for event in events if "answer" in event]
+        assert answers and all(event.get("structured") for event in answers)
+
     def test_non_openai_wire_llm_gets_no_json_object_mode(
         self, agent_base_params, mock_llm_handler_creator, log_context
     ):
@@ -1773,17 +1787,13 @@ def test_declaration_comes_from_the_llm_class_attribute(
         """``BaseLLM.structured_output_kwarg`` is the single source of truth —
         the agent no longer isinstance-checks provider classes."""
         llm = AnthropicLLM(api_key="ant-test", user_api_key=None)
-        llm._supports_structured_output = Mock(return_value=True)
-        llm.prepare_structured_output_format = Mock(return_value={"schema": "x"})
         agent = _build_agent_with_llm(
             agent_base_params, llm, "anthropic", json_schema=SCHEMA
         )
-        assert agent._structured_output_kwarg() is None
+        assert agent._structured_output_kwarg() == "output_format"
 
-        with patch.object(
-            type(llm), "structured_output_kwarg", "response_format", create=True
-        ):
-            assert agent._structured_output_kwarg() == "response_format"
+        with patch.object(type(llm), "structured_output_kwarg", None):
+            assert agent._structured_output_kwarg() is None
 
     def test_capability_flag_still_vetoes_openai_compatible(
         self, agent_base_params, mock_llm_handler_creator, log_context
```

**File**: `tests/llm/test_anthropic.py` (modified, +235/-0)
```diff
@@ -14,6 +14,7 @@
 import types
 
 import pytest
+from anthropic import transform_schema as _real_transform_schema
 
 
 # ---------------------------------------------------------------------------
@@ -164,6 +165,8 @@ def __init__(self, api_key=None, base_url=None):
 def patch_anthropic():
     fake = types.ModuleType("anthropic")
     fake.Anthropic = _FakeAnthropic
+    # The real schema transformer: pure, and it is what pins the wire shape.
+    fake.transform_schema = _real_transform_schema
 
     modules_to_remove = [key for key in sys.modules if key.startswith("anthropic")]
     for key in modules_to_remove:
@@ -1015,6 +1018,238 @@ def test_supports_tools_respects_capabilities(self, llm):
         llm.capabilities = types.SimpleNamespace(supports_tools=False)
         assert llm._supports_tools() is False
 
+    def test_supports_structured_output_default(self, llm):
+        assert llm._supports_structured_output() is True
+
+    def test_supports_structured_output_respects_capabilities(self, llm):
+        llm.capabilities = types.SimpleNamespace(supports_structured_output=False)
+        assert llm._supports_structured_output() is False
+
+
+# ---------------------------------------------------------------------------
+# Structured output (output_config.format)
+# ---------------------------------------------------------------------------
+
+
+ORDER_SCHEMA = {
+    "type": "object",
+    "properties": {
+        "order_id": {"type": "string"},
+        "total": {"type": "number"},
+    },
+    "required": ["order_id"],
+}
+
+
+@pytest.mark.unit
+class TestStructuredOutput:
+
+    def test_declares_output_format_kwarg(self):
+        from docsgpt.llm.anthropic import AnthropicLLM
+
+        assert AnthropicLLM.structured_output_kwarg == "output_format"
+
+    def test_prepare_builds_json_schema_format(self, llm):
+        prepared = llm.prepare_structured_output_format(ORDER_SCHEMA)
+
+        assert prepared["type"] == "json_schema"
+        schema = prepared["schema"]
+        assert schema["additionalProperties"] is False
+        assert set(schema["properties"]) == {"order_id", "total"}
+        # Anthropic does not need every property required (unlike OpenAI strict).
+        assert schema["required"] == ["order_id"]
+
+    def test_prepare_closes_nested_objects(self, llm):
+        schema = {
+            "type": "object",
+            "properties": {
+                "customer": {
+                    "type": "object",
+                    "properties": {"name": {"type": "string"}},
+                },
+                "lines": {
+                    "type": "array",
+                    "items": {
+                        "type": "object",
+                        "properties": {"sku": {"type": "string"}},
+                    },
+                },
+            },
+        }
+
+        sent = llm.prepare_structured_output_format(schema)["schema"]
+
+        assert sent["properties"]["customer"]["additionalProperties"] is False
+        assert sent["properties"]["lines"]["items"]["additionalProperties"] is False
+
+    def test_prepare_moves_unsupported_constraints_into_description(self, llm):
+        """Numeric/length constraints 400 on the API; they become hints."""
+        schema = {
+            "type": "object",
+            "properties": {
+                "qty": {"type": "integer", "minimum": 1, "description": "Units"},
+                "code": {"type": "string", "maxLength": 8},
+            },
+        }
+
+        props = llm.prepare_structured_output_format(schema)["schema"]["properties"]
+
+        assert "minimum" not in props["qty"]
+        assert "minimum: 1" in props["qty"]["description"]
+        assert props["qty"]["description"].startswith("Units")
+        assert "maxLength" not in props["code"]
+        assert "maxLength: 8" in props["code"]["description"]
+
+    def test_prepare_nullable_type_list_becomes_any_of(self, llm):
+        """``"type": [T, "null"]`` crashes the SDK transformer; split it."""
+        schema = {
+            "type": "object",
+            "properties": {
+                "note": {"type": ["string", "null"], "description": "Optional note"},
+            },
+        }
+
+        note = llm.prepare_structured_output_format(schema)["schema"]["properties"]["note"]
+
+        assert note["description"] == "Optional note"
+        assert {branch["type"] for branch in note["anyOf"]} == {"string", "null"}
+
+    def test_prepare_const_becomes_single_value_enum(self, llm):
+        schema = {
+            "type": "object",
+            "properties": {"kind": {"const": "invoice"}},
+        }
+
+        kind = llm.prepare_structured_output_format(schema)["schema"]["properties"]["kind"]
+
+        assert kind["enum"] == ["invoice"]
+        assert kind["type"] == "string"
+
+    def test_prepare_typeless_enum_gets_its_type(self, llm):
+        schema = {
+            "type": "object",
+            "properties": {"status": {"enum": ["open", "closed"]}},
+
```

---

### Incident Patch 12: `2aeb862e` (2026-10-05)
**Commit Message**: Build the code sandbox from one package manifest and add office, browser and OCR tools

The runner image (deployment/sandbox/Dockerfile), the Daytona snapshot
(scripts/build_daytona_snapshot.py) and the code_executor environment note
each kept their own package list, and they drifted. docsgpt/sandbox/manifest.py
is now the one list; the snapshot builds from it, the Dockerfile installs from
files generated from it (scripts/export_sandbox_manifest.py, checked in CI),
and the tool description is rendered from it.

Both images gain requests, beautifulsoup4, PyYAML, pypdf, PyPDF2, pdfplumber,
pypdfium2, pytesseract and imageio; tesseract, poppler-utils and Debian's
ffmpeg; headless LibreOffice and Chromium with office-convert, html-to-pdf and
html-screenshot helpers; Node.js 24 from the nodejs.org tarball, checked
against a pinned SHA-256; and fonts for Latin, Arabic, Devanagari and CJK.

The runner's kernels get a writable HOME under /tmp through kernel-env.sh:
with the read-only root filesystem, pip install, LibreOffice and Chromium had
nowhere to write. SANDBOX_MEMORY defaults to 4g, with shm_size 256m and
pids_limit 1024 (k8s: 4Gi and a memory-backed /dev/shm). The Daytona
snapshot 

**File**: `.github/workflows/lint.yml` (modified, +5/-0)
```diff
@@ -38,3 +38,8 @@ jobs:
           uv lock --check
           bash scripts/export_requirements.sh
           git diff --exit-code -- docsgpt/requirements.txt docsgpt/requirements-docling.txt docsgpt/requirements-milvus.txt
+
+      # deployment/sandbox/{requirements.txt,install-system.sh,sandbox.env,manifest.json}
+      # are generated from docsgpt/sandbox/manifest.py (stdlib only, no install needed).
+      - name: Sandbox image files match the manifest
+        run: python3 scripts/export_sandbox_manifest.py --check
```

**File**: `.github/workflows/sandbox-image-verify.yml` (added, +53/-0)
```diff
@@ -0,0 +1,53 @@
+name: Verify the sandbox image
+
+# Builds the code-execution runner image (deployment/sandbox) and runs its smoke
+# test the way kernels run: read-only root, /tmp as tmpfs, the scrubbed kernel
+# environment. The test imports every package in docsgpt/sandbox/manifest.py,
+# checks every command and font, and converts real files with LibreOffice,
+# Chromium, tesseract, poppler, ffmpeg and Node, so a Debian package rename or a
+# broken pin fails here instead of in a deployment.
+
+on:
+  workflow_dispatch:
+  pull_request:
+    paths:
+      - 'deployment/sandbox/**'
+      - 'docsgpt/sandbox/manifest.py'
+      - '.github/workflows/sandbox-image-verify.yml'
+
+permissions:
+  contents: read
+
+jobs:
+  verify:
+    runs-on: ubuntu-latest
+    timeout-minutes: 30
+    steps:
+      - uses: actions/checkout@11d5960a326750d5838078e36cf38b85af677262 # v4.4.0
+        with:
+          persist-credentials: false
+
+      - name: Set up Docker Buildx
+        uses: docker/setup-buildx-action@8d2750c68a42422c14e847fe6c8ac0403b4cbd6f # v3.12.0
+
+      - name: Build the image
+        uses: docker/build-push-action@10e90e3645eae34f1e60eeb005ba3a3d33f178e8 # v6.19.2
+        with:
+          file: ./deployment/sandbox/Dockerfile
+          context: ./deployment/sandbox
+          platforms: linux/amd64
+          load: true
+          tags: docsgpt-sandbox:verify
+          cache-from: type=gha,scope=sandbox-verify
+          cache-to: type=gha,mode=max,scope=sandbox-verify
+
+      - name: Image size
+        run: |
+          docker image inspect docsgpt-sandbox:verify --format '{{.Size}}' | awk '{printf "uncompressed: %.2f GB\n", $1/1e9}'
+          docker history docsgpt-sandbox:verify --format '{{.Size}}\t{{.CreatedBy}}' | head -20
+
+      - name: Smoke test (read-only root, as compose runs it)
+        run: |
+          docker run --rm --read-only --tmpfs /tmp --memory 4g --shm-size 256m --pids-limit 1024 \
+            docsgpt-sandbox:verify \
+            /opt/docsgpt/kernel-env.sh python /opt/docsgpt/smoke_test.py --pip
```

**File**: `deployment/k8s/deployments/sandbox-deploy.yaml` (modified, +16/-4)
```diff
@@ -86,21 +86,33 @@ spec:
               value: /tmp/jupyter-runtime
             - name: JUPYTER_DATA_DIR
               value: /tmp/jupyter-data
+          # Same budget as the compose overlay's SANDBOX_MEMORY default: the
+          # gateway, the warm session kernels, and the LibreOffice (~170 MB) and
+          # headless Chromium (~110 MB) processes they start, plus the /tmp
+          # emptyDir if it is memory-backed.
           resources:
             limits:
-              memory: "1Gi"
+              memory: "4Gi"
               cpu: "1"
             requests:
-              memory: "256Mi"
+              memory: "512Mi"
               cpu: "250m"
           volumeMounts:
-            # Per-session workspaces + Jupyter runtime files on an emptyDir;
-            # the root FS stays read-only everywhere else.
+            # Per-session workspaces, kernel HOME (/tmp/home) and Jupyter
+            # runtime files on an emptyDir; the root FS stays read-only
+            # everywhere else.
             - name: scratch
               mountPath: /tmp
+            # A larger /dev/shm for Chromium (the container default is 64 MB).
+            - name: dshm
+              mountPath: /dev/shm
       volumes:
         - name: scratch
           emptyDir: {}
+        - name: dshm
+          emptyDir:
+            medium: Memory
+            sizeLimit: 256Mi
 ---
 apiVersion: v1
 kind: Service
```

**File**: `deployment/optional/docker-compose.optional.sandbox.yaml` (modified, +12/-2)
```diff
@@ -58,9 +58,19 @@ services:
 
   docsgpt-sandbox:
     build: ./sandbox
-    mem_limit: ${SANDBOX_MEMORY:-1g}
+    # One container holds the gateway, every warm session kernel (~50-60 MB
+    # each, more with data loaded) and whatever they start: a LibreOffice
+    # conversion took about 170 MB and a headless Chromium render
+    # about 110 MB on small documents, more on large ones. /tmp (the session
+    # workspaces) is a tmpfs and counts against this limit too. At the default
+    # SANDBOX_MAX_SESSIONS (32 per app process) idle kernels alone near 2 GB.
+    mem_limit: ${SANDBOX_MEMORY:-4g}
     cpus: ${SANDBOX_CPUS:-1.0}
-    pids_limit: 256
+    # Chromium is thread-heavy; 256 ran out with a few sessions converting.
+    pids_limit: 1024
+    # Docker's 64 MB /dev/shm is too small for Chromium. The helpers also pass
+    # --disable-dev-shm-usage; this covers code that starts Chromium itself.
+    shm_size: 256m
     read_only: true
     environment:
       # The gateway REQUIRES this and fails closed if unset (see gateway-launch.sh).
```

**File**: `deployment/sandbox/Dockerfile` (modified, +47/-15)
```diff
@@ -8,9 +8,26 @@
 # The app (backend/worker) is the CLIENT and reaches this service over
 # HTTP + WebSocket via SANDBOX_GATEWAY_URL.
 #
-# Pre-baked doc libs are all permissive (MIT/BSD/Apache) for speed/reliability;
-# runtime `pip install` still works because egress is open. PyMuPDF and any
-# other AGPL lib are intentionally excluded; Docling is deferred to its own slice.
+# CONTENTS come from docsgpt/sandbox/manifest.py, the list the Daytona snapshot
+# (scripts/build_daytona_snapshot.py) builds from too. This Dockerfile installs
+# from files generated from it -- requirements.txt, install-system.sh,
+# sandbox.env, manifest.json; edit the manifest and run
+# `python scripts/export_sandbox_manifest.py`, never these files.
+#
+# LICENSES. The Python libraries are permissive (MIT, BSD, Apache-2.0, HPND for
+# Pillow), and so are Node.js (MIT, unpacked from the official nodejs.org
+# tarball and checked against the SHA-256 pinned in the manifest), Chromium
+# (BSD-3-Clause plus its bundled third-party code) and tesseract (Apache-2.0).
+# LibreOffice is MPL-2.0. The fonts are under the Bitstream Vera (DejaVu) and
+# SIL OFL-1.1 (Liberation, Carlito, Caladea, Noto) licenses. Two packages are
+# GPL and are only ever run as separate programs, never linked into the Python
+# code: poppler-utils (pdftotext, pdftoppm) and Debian's ffmpeg build (ffmpeg,
+# ffprobe). They are unmodified Debian packages whose corresponding source
+# Debian publishes (`apt-get source poppler ffmpeg`, or sources.debian.org);
+# anyone redistributing this image passes on that GPL offer. PyMuPDF (AGPL) and
+# any other AGPL library are intentionally excluded; pdfplumber, pypdf and
+# pypdfium2 cover PDF reading. Runtime `pip install` still works while egress
+# is open.
 #
 # HARDENING (separate slice — NOT done here): run under the gVisor `runsc`
 # runtime, add network-layer SSRF blocks (drop RFC1918 / link-local /
@@ -21,16 +38,15 @@ FROM python:3.12-slim
 # Non-root user for the runner (untrusted code runs as this UID).
 RUN useradd --create-home --uid 10001 sandbox
 
-# Exact pins for reproducible builds and no license drift (all MIT/BSD/Apache).
-RUN pip install --no-cache-dir \
-    jupyter-kernel-gateway==3.0.1 \
-    ipykernel==6.29.5 \
-    python-pptx==1.0.2 \
-    python-docx==1.1.2 \
-    openpyxl==3.1.5 \
-    reportlab==4.2.5 \
-    pandas==2.2.3 \
-    matplotlib==3.9.2
+# System packages (OCR, poppler, ffmpeg, headless LibreOffice and Chromium,
+# fonts) and the pinned Node.js build. Its own layer: it is the largest and
+# changes least often.
+COPY install-system.sh /opt/docsgpt/install-system.sh
+RUN sh /opt/docsgpt/install-system.sh
+
+# Python libraries, exact pins from the manifest.
+COPY requirements.txt /opt/docsgpt/requirements.txt
+RUN PIP_ROOT_USER_ACTION=ignore pip install --no-cache-dir -r /opt/docsgpt/requirements.txt
 
 # Docling (MIT) — OFF by default because it pulls torch + models and makes the
 # image multi-GB. NOTE: document parsing now runs on the Celery `parsing` worker
@@ -54,12 +70,28 @@ RUN if [ "$INSTALL_DOCLING" = "true" ]; then \
 # kernelspec-name precedence to rely on). SECURITY: never give this image
 # `env_file: ../.env` -- the scrubber blocks exfil from the kernel, but the
 # runner image itself should stay free of app secrets it has no use for.
+#
+# kernel-env.sh does the scrubbing and gives kernels a writable HOME under /tmp
+# (the root FS is read-only); sandbox.env is the image environment it passes on.
+COPY kernel-env.sh /opt/docsgpt/kernel-env.sh
 COPY kernel-launch.sh /opt/docsgpt/kernel-launch.sh
-RUN chmod 0555 /opt/docsgpt/kernel-launch.sh
 COPY gateway-launch.sh /opt/docsgpt/gateway-launch.sh
-RUN chmod 0555 /opt/docsgpt/gateway-launch.sh
+COPY sandbox.env /opt/docsgpt/sandbox.env
 COPY kernels/docsgpt-python/kernel.json /usr/local/share/jupyter/kernels/docsgpt-python/kernel.json
 
+# Conversion helpers on PATH (html_render.py picks its mode from the name it is
+# run as), and the smoke test with the manifest it checks against:
+#   docker run --rm --read-only --tmpfs /tmp IMAGE \
+#     /opt/docsgpt/kernel-env.sh python /opt/docsgpt/smoke_test.py
+COPY helpers/office_convert.py /usr/local/bin/office-convert
+COPY helpers/html_render.py /usr/local/bin/html-to-pdf
+COPY helpers/html_render.py /usr/local/bin/html-screenshot
+COPY smoke_test.py /opt/docsgpt/smoke_test.py
+COPY manifest.json /opt/docsgpt/manifest.json
+RUN chmod 0555 /opt/docsgpt/kernel-env.sh /opt/docsgpt/kernel-launch.sh /opt/docsgpt/gateway-launch.sh \
+        /usr/local/bin/office-convert /usr/local/bin/html-to-pdf /usr/local/bin/html-screenshot \
+    && chmod 0444 /opt/docsgpt/sandbox.env /opt/docsgpt/smoke_test.py /opt/docsgpt/manifest.json
+
 # Numeric UID (not the name) so a kubelet with `runAsNonRoot: true` can verify
 # the user is non-root without resolving /etc/passwd. This uid MUST match
 # `runAsUser` in deployment/k8s/deployments/sandbox-deploy.yaml.
```

**File**: `deployment/sandbox/README.md` (modified, +118/-34)
```diff
@@ -57,8 +57,10 @@ What this slice does close:
 
 - **Env-secret exfil is closed.** The custom kernelspec
   (`kernels/docsgpt-python/kernel.json` → `/opt/docsgpt/kernel-launch.sh`)
-  re-execs ipykernel under a minimal allowlisted env (`env -i` keeping only
-  `PATH`, `HOME`, `LANG`, `JUPYTER_RUNTIME_DIR`, `JUPYTER_DATA_DIR`). The image
+  re-execs ipykernel through `kernel-env.sh` under a minimal allowlisted env
+  (`env -i` keeping only `PATH`, `LANG`, `JUPYTER_RUNTIME_DIR` and
+  `JUPYTER_DATA_DIR`, plus a writable `HOME` and the image variables from
+  `sandbox.env`; see *Kernel environment*). The image
   installs this spec under the **distinct name `docsgpt-python`** and the app
   selects it via `SANDBOX_KERNEL_NAME=docsgpt-python`; because the name is
   distinct, it is **never shadowed** by the stock ipykernel `python3` spec
@@ -133,8 +135,10 @@ the **stock** `python3` kernelspec, so session creation fails until you do one
 of these:
 
 - Install the scrubbing spec: copy `kernels/docsgpt-python/kernel.json`
-  (pointing `argv` at a local copy of `kernel-launch.sh`) into a Jupyter data
-  dir on the kernelspec search path. The default kernel name then works.
+  (pointing `argv` at a local copy of `kernel-launch.sh`, with `kernel-env.sh`
+  and `sandbox.env` copied next to it) into a Jupyter data dir on the
+  kernelspec search path. The default kernel name then works. Kernels get
+  `HOME=/tmp/home` unless you set `SANDBOX_KERNEL_HOME` on the gateway.
 - Or set `SANDBOX_KERNEL_NAME=python3` in the app's `.env`. The stock spec
   inherits the gateway's full env (no secret scrubbing), so use it only for
   single-trust dev.
@@ -169,6 +173,88 @@ k8s these are added to the `docsgpt-api` and `docsgpt-worker` deployments when
 enabling the opt-in `sandbox-deploy.yaml` (the default `docsgpt-deploy.yaml`
 omits them); see that manifest's header for the exact env and the token Secret.
 
+## What the image contains
+
+`docsgpt/sandbox/manifest.py` is the single list of what the sandbox holds. The
+Daytona snapshot (`scripts/build_daytona_snapshot.py`) builds from it directly,
+and `code_executor` tells the model what is installed from it. This image
+installs from files generated from it, next to the Dockerfile:
+`requirements.txt`, `install-system.sh`, `sandbox.env` and `manifest.json`.
+Edit the manifest, never those files, then regenerate them (CI fails when they
+are stale):
+
+```bash
+python scripts/export_sandbox_manifest.py
+```
+
+What is in it:
+
+- **Python libraries:** pandas, numpy, matplotlib, openpyxl, python-docx,
+  python-pptx, reportlab, lxml, Pillow, requests, beautifulsoup4, PyYAML, pypdf,
+  PyPDF2, pdfplumber, pdfminer.six, pypdfium2, pytesseract and imageio, at the
+  exact versions in the manifest.
+- **Commands:** headless LibreOffice (`soffice`), headless Chromium
+  (`chromium-headless-shell`), `tesseract` (English), poppler's `pdftotext`
+  and `pdftoppm`, `ffmpeg` and `ffprobe`, and Node.js 24 (`node`, `npm`,
+  `npx`) from the official nodejs.org tarball, checked against the SHA-256
+  pinned in the manifest.
+- **Helpers on PATH** (`helpers/`):
+  - `office-convert FILE [--to pdf|docx|xlsx|pptx|png|...] [--outdir DIR]`
+    runs LibreOffice with a throwaway profile per call (a shared profile makes
+    a second soffice exit 0 having written nothing), a timeout, and a non-zero
+    exit with a message when no output appears.
+  - `html-to-pdf IN.html|URL OUT.pdf` and
+    `html-screenshot IN.html|URL OUT.png [--width W --height H]` render with
+    headless Chromium (`--no-sandbox --disable-gpu --disable-dev-shm-usage`,
+    no PDF header or footer).
+- **Fonts:** DejaVu, Liberation (Arial, Times New Roman and Courier New
+  metrics), Carlito and Caladea (Calibri and Cambria metrics), Noto (Arabic,
+  Devanagari, Hebrew, Thai and more) and Noto CJK.
+
+imageio writes GIF and WebP through Pillow. It has no MP4 writer here, because
+that needs the `imageio-ffmpeg` package, whose wheels bundle a static GPL
+ffmpeg; code runs the `ffmpeg` command with `subprocess` for video instead.
+
+### Licenses
+
+The Python libraries, Node.js (MIT), Chromium (BSD-3-Clause) and tesseract
+(Apache-2.0) are permissive. LibreOffice is MPL-2.0, and the fonts are under
+the Bitstream Vera (DejaVu) and SIL OFL-1.1 licenses. Two packages are GPL:
+poppler-utils and Debian's ffmpeg build. Both are unmodified Debian packages
+that run only as separate programs, never linked into the Python code, and
+Debian publishes their corresponding source (`apt-get source poppler ffmpeg`,
+or sources.debian.org). PyMuPDF (AGPL) is deliberately not installed; use
+pdfplumber, pypdf or pypdfium2.
+
+### Kernel environment
+
+The root filesystem is read-only (compose `read_only: true`, k8s
+`readOnlyRootFilesystem`), so `kernel-env.sh` gives every kernel a writable
+`HOME` under `/tmp` (`/tmp/home`, or `SANDBOX_KERNEL_HOME` on the runner) and
+points `XDG_CONFIG_HOME`, `XDG_CACHE_HOME` and `PYTHONUSERBASE` into it.
+L
```

**File**: `deployment/sandbox/helpers/html_render.py` (added, +278/-0)
```diff
@@ -0,0 +1,278 @@
+#!/usr/bin/env python3
+"""html-to-pdf and html-screenshot: render a page with headless Chromium.
+
+Installed twice in the sandbox image, as /usr/local/bin/html-to-pdf and
+/usr/local/bin/html-screenshot; the name it is called by picks the mode::
+
+    html-to-pdf report.html report.pdf
+    html-to-pdf https://example.com page.pdf
+    html-screenshot chart.html chart.png --width 1200 --height 800
+
+The input is a local HTML file or an http(s) URL. Page size and margins come
+from the page's CSS (``@page``); Chromium's date/URL header and footer are off.
+Each call uses a throwaway browser profile. The helper exits non-zero with a
+message when no output file appears and prints the output path on success.
+
+Exit codes: 0 rendered, 1 rendering failed, 2 bad arguments or input,
+124 timed out, 127 Chromium not installed.
+"""
+
+from __future__ import annotations
+
+import argparse
+import os
+import shutil
+import signal
+import subprocess
+import sys
+import tempfile
+from pathlib import Path
+from typing import List, Optional
+from urllib.parse import urlparse
+
+# Tried in order; the image ships chromium-headless-shell.
+BROWSERS = ("chromium-headless-shell", "chromium", "chromium-browser", "google-chrome", "chrome")
+
+DEFAULT_TIMEOUT = 45.0
+# Virtual time the page gets to run scripts and timers before it is captured.
+DEFAULT_WAIT_MS = 2000
+DEFAULT_WIDTH = 1280
+DEFAULT_HEIGHT = 800
+
+_MODES = {"html-to-pdf": "pdf", "html-screenshot": "screenshot"}
+_STDERR_TAIL = 1500
+
+
+def _positive_int(value: str) -> int:
+    """argparse type for a pixel size: an integer above zero."""
+    try:
+        parsed = int(value)
+    except ValueError:
+        raise argparse.ArgumentTypeError(f"not an integer: {value!r}") from None
+    if parsed <= 0:
+        raise argparse.ArgumentTypeError("must be greater than 0")
+    return parsed
+
+
+def _non_negative_int(value: str) -> int:
+    """argparse type for a wait budget in ms: zero or more."""
+    try:
+        parsed = int(value)
+    except ValueError:
+        raise argparse.ArgumentTypeError(f"not an integer: {value!r}") from None
+    if parsed < 0:
+        raise argparse.ArgumentTypeError("must be 0 or more")
+    return parsed
+
+
+def _positive_float(value: str) -> float:
+    """argparse type for a timeout: a number above zero."""
+    try:
+        parsed = float(value)
+    except ValueError:
+        raise argparse.ArgumentTypeError(f"not a number: {value!r}") from None
+    if parsed <= 0:
+        raise argparse.ArgumentTypeError("must be greater than 0")
+    return parsed
+
+
+def parse_args(mode: str, prog: str, argv: Optional[List[str]]) -> argparse.Namespace:
+    """Parse the command line for one mode.
+
+    Args:
+        mode: ``pdf`` or ``screenshot``.
+        prog: Program name for usage messages.
+        argv: Arguments without the program name.
+
+    Returns:
+        The parsed arguments.
+    """
+    what = "a PDF" if mode == "pdf" else "a PNG screenshot"
+    parser = argparse.ArgumentParser(prog=prog, description=f"Render a web page to {what} with headless Chromium.")
+    parser.add_argument("input", help="local .html file or http(s) URL")
+    parser.add_argument("output", help="file to write" + (" (.pdf)" if mode == "pdf" else " (.png)"))
+    if mode == "screenshot":
+        parser.add_argument("--width", type=_positive_int, default=DEFAULT_WIDTH, help="viewport width in px")
+        parser.add_argument("--height", type=_positive_int, default=DEFAULT_HEIGHT, help="viewport height in px")
+    parser.add_argument(
+        "--wait-ms",
+        type=_non_negative_int,
+        default=DEFAULT_WAIT_MS,
+        help="virtual time for scripts and timers before capture; 0 captures at load (default: 2000)",
+    )
+    parser.add_argument(
+        "--timeout", type=_positive_float, default=DEFAULT_TIMEOUT, help="seconds before giving up (default: 45)"
+    )
+    return parser.parse_args(argv)
+
+
+def find_browser() -> Optional[str]:
+    """Return the first Chromium executable on PATH, or None."""
+    for name in BROWSERS:
+        path = shutil.which(name)
+        if path:
+            return path
+    return None
+
+
+def to_url(target: str) -> str:
+    """Return the URL Chromium should open for a file path or URL.
+
+    Args:
+        target: A local path, or an http, https or file URL.
+
+    Returns:
+        The URL; local paths become absolute ``file://`` URLs.
+
+    Raises:
+        ValueError: For another scheme or a local file that does not exist.
+    """
+    scheme = urlparse(target).scheme.lower()
+    if scheme in ("http", "https", "file"):
+        return target
+    if scheme and len(scheme) > 1:
+        raise ValueError(f"unsupported URL scheme {scheme!r}; give a local .html file or an http(s) URL")
+    path = Path(target).expanduser().resolve()
+    if not path.is_file():
+        raise ValueError(f"input not found: {target}")
+    return path.as_uri()
+
+
+def run(cmd: L
```

**File**: `deployment/sandbox/helpers/office_convert.py` (added, +224/-0)
```diff
@@ -0,0 +1,224 @@
+#!/usr/bin/env python3
+"""office-convert: convert an office document with headless LibreOffice.
+
+Installed as /usr/local/bin/office-convert in the sandbox image::
+
+    office-convert report.docx                    # -> ./report.pdf
+    office-convert inputs/data.xlsx --to pdf --outdir out
+    office-convert slides.pptx --to png           # first slide as an image
+
+Each call runs soffice with its own throwaway profile. Two soffice processes
+sharing one profile make the second exit 0 having written nothing, which code
+in a sandbox session easily hits. The helper exits non-zero with a message
+when no output file appears, prints the output path on success, and stops
+soffice (and the soffice.bin it forks) after --timeout seconds.
+
+Exit codes: 0 converted, 1 conversion failed, 2 bad arguments or input,
+124 timed out, 127 LibreOffice not installed.
+"""
+
+from __future__ import annotations
+
+import argparse
+import os
+import shutil
+import signal
+import subprocess
+import sys
+import tempfile
+from pathlib import Path
+from typing import List, Optional
+
+# --to value -> soffice --convert-to argument. The explicit filters pick the
+# OOXML export whatever the source format is; txt is written as UTF-8.
+FORMATS = {
+    "pdf": "pdf",
+    "docx": "docx:MS Word 2007 XML",
+    "xlsx": "xlsx:Calc MS Excel 2007 XML",
+    "pptx": "pptx:Impress MS PowerPoint 2007 XML",
+    "odt": "odt",
+    "ods": "ods",
+    "odp": "odp",
+    "png": "png",
+    "html": "html",
+    "txt": "txt:Text (encoded):UTF8",
+    "csv": "csv",
+}
+
+# Below the sandbox's 60 s per-call cap, so the caller sees this helper's
+# message rather than a killed run.
+DEFAULT_TIMEOUT = 45.0
+
+_STDERR_TAIL = 1500
+
+
+def _positive_float(value: str) -> float:
+    """argparse type for a timeout: a number above zero."""
+    try:
+        parsed = float(value)
+    except ValueError:
+        raise argparse.ArgumentTypeError(f"not a number: {value!r}") from None
+    if parsed <= 0:
+        raise argparse.ArgumentTypeError("must be greater than 0")
+    return parsed
+
+
+def parse_args(argv: Optional[List[str]]) -> argparse.Namespace:
+    """Parse the command line.
+
+    Args:
+        argv: Arguments without the program name; None reads ``sys.argv``.
+
+    Returns:
+        The parsed arguments.
+    """
+    parser = argparse.ArgumentParser(
+        prog="office-convert",
+        description="Convert a document with headless LibreOffice and print the output path.",
+    )
+    parser.add_argument("input", help="document to convert (docx, doc, odt, rtf, xlsx, csv, pptx, html, ...)")
+    parser.add_argument("--to", choices=sorted(FORMATS), default="pdf", help="output format (default: pdf)")
+    parser.add_argument("--outdir", default=".", help="directory for the output file (default: current directory)")
+    parser.add_argument(
+        "--timeout", type=_positive_float, default=DEFAULT_TIMEOUT, help="seconds before giving up (default: 45)"
+    )
+    return parser.parse_args(argv)
+
+
+def find_soffice() -> Optional[str]:
+    """Return the LibreOffice executable on PATH, or None."""
+    return shutil.which("soffice") or shutil.which("libreoffice")
+
+
+def run(cmd: List[str], timeout: float) -> subprocess.CompletedProcess:
+    """Run ``cmd`` in its own process group, killing the whole group on timeout.
+
+    Args:
+        cmd: The command.
+        timeout: Seconds to wait.
+
+    Returns:
+        The finished process with captured text output.
+
+    Raises:
+        subprocess.TimeoutExpired: When the command outlives ``timeout``.
+    """
+    proc = subprocess.Popen(
+        cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True, start_new_session=True
+    )
+    try:
+        stdout, stderr = proc.communicate(timeout=timeout)
+    except subprocess.TimeoutExpired:
+        try:
+            os.killpg(proc.pid, signal.SIGKILL)
+        except ProcessLookupError:
+            pass
+        proc.communicate()
+        raise
+    return subprocess.CompletedProcess(cmd, proc.returncode, stdout, stderr)
+
+
+def build_command(soffice: str, source: Path, fmt: str, outdir: Path, profile: Path) -> List[str]:
+    """Return the soffice command converting ``source`` into ``outdir``.
+
+    Args:
+        soffice: LibreOffice executable.
+        source: Absolute input path.
+        fmt: A key of ``FORMATS``.
+        outdir: Absolute output directory.
+        profile: Empty directory for this call's LibreOffice profile.
+
+    Returns:
+        The argument list.
+    """
+    return [
+        soffice,
+        f"-env:UserInstallation={profile.as_uri()}",
+        "--headless",
+        "--norestore",
+        "--nolockcheck",
+        "--convert-to",
+        FORMATS[fmt],
+        "--outdir",
+        str(outdir),
+        str(source),
+    ]
+
+
+def _mtime(path: Path) -> Optional[int]:
+    """Return ``path``'s modification time in ns, or None when it does not exist."""
+    try:
+  
```

---

### Incident Patch 13: `a73eec07` (2026-10-05)
**Commit Message**: Merge pull request #2963 from arc53/fix/sandbox-session-and-artifact-dedupe

Keep the code sandbox between calls and version re-saved files

**File**: `deployment/optional/docker-compose.optional.sandbox.yaml` (modified, +3/-0)
```diff
@@ -66,6 +66,9 @@ services:
       # The gateway REQUIRES this and fails closed if unset (see gateway-launch.sh).
       # Do NOT add `env_file: ../.env` here -- the runner needs no other app secret.
       - SANDBOX_GATEWAY_AUTH_TOKEN=${SANDBOX_GATEWAY_AUTH_TOKEN:?set SANDBOX_GATEWAY_AUTH_TOKEN to a shared gateway token}
+      # Idle seconds before the gateway shuts a kernel down; keep it above the
+      # app's SANDBOX_MAX_TTL (see gateway-launch.sh).
+      - SANDBOX_KERNEL_IDLE_TIMEOUT=${SANDBOX_KERNEL_IDLE_TIMEOUT:-1800}
       # Keep Jupyter's runtime/connection files on the writable tmpfs.
       - JUPYTER_RUNTIME_DIR=/tmp/jupyter-runtime
       - JUPYTER_DATA_DIR=/tmp/jupyter-data
```

**File**: `deployment/sandbox/README.md` (modified, +16/-0)
```diff
@@ -169,6 +169,22 @@ k8s these are added to the `docsgpt-api` and `docsgpt-worker` deployments when
 enabling the opt-in `sandbox-deploy.yaml` (the default `docsgpt-deploy.yaml`
 omits them); see that manifest's header for the exact env and the token Secret.
 
+## Session lifetime
+
+The app keeps a session's kernel between `run_code` calls, so variables, files
+and installed packages carry over, and retires it once it has been idle for
+`SANDBOX_MAX_TTL` seconds (1200 by default). Each process retires only its own
+sessions, so a kernel held by an API or worker process that restarted would
+otherwise live until the runner restarts. `gateway-launch.sh` therefore has the
+gateway shut down any kernel idle for `SANDBOX_KERNEL_IDLE_TIMEOUT` seconds
+(1800 by default); keep it above `SANDBOX_MAX_TTL`. The compose overlay passes
+the variable through.
+
+Warm kernels count against the runner's memory: an idle kernel takes about
+50-60 MB, more once code has loaded data, and session workspaces live on the
+`/tmp` tmpfs. Size `SANDBOX_MEMORY` (1g by default) for the conversations that
+run code at the same time, or lower `SANDBOX_MAX_TTL`.
+
 ## Artifact rendering on Daytona (snapshot)
 
 The `artifact` tool renders `presentation` / `document` / `spreadsheet` / `pdf`
```

**File**: `deployment/sandbox/gateway-launch.sh` (modified, +9/-1)
```diff
@@ -26,6 +26,12 @@ if [ -z "$TOKEN" ]; then
     exit 1
 fi
 
+# Seconds a kernel may sit idle before the gateway shuts it down. The app keeps a
+# session's kernel between calls and retires it after SANDBOX_MAX_TTL idle seconds
+# (1200 by default); this cull is the backstop for kernels no app process will
+# retire, e.g. ones held by a worker that restarted. Keep it above SANDBOX_MAX_TTL.
+IDLE_TIMEOUT="${SANDBOX_KERNEL_IDLE_TIMEOUT:-1800}"
+
 # ip=0.0.0.0 so the backend/worker can reach it over the internal sandbox network.
 # auth_token gates every HTTP + WebSocket request, including loopback ones from
 # kernel code. limit_rate=False raises the iopub data-rate cap so large get_file
@@ -35,4 +41,6 @@ exec jupyter kernelgateway \
     --KernelGatewayApp.ip=0.0.0.0 \
     --KernelGatewayApp.port=8888 \
     --KernelGatewayApp.auth_token="$TOKEN" \
-    --ZMQChannelsWebsocketConnection.limit_rate=False
+    --ZMQChannelsWebsocketConnection.limit_rate=False \
+    --MappingKernelManager.cull_idle_timeout="$IDLE_TIMEOUT" \
+    --MappingKernelManager.cull_interval=300
```

**File**: `docs/content/Deploying/Sandbox.mdx` (modified, +5/-2)
```diff
@@ -1,7 +1,7 @@
 ---
 title: Code Execution Sandbox
 description: Run the sandbox that the Artifact and Code Executor tools need - the self-hosted Jupyter runner with Docker Compose, Kubernetes or pip, or Daytona Cloud - with the gateway token, kernel settings and network isolation.
-lastUpdated: 2026-09-30
+lastUpdated: 2026-10-05
 ---
 
 import { Callout } from 'nextra/components'
@@ -124,8 +124,11 @@ To check the setup, ask an agent with Code Executor to run `print(1 + 1)`. An er
 | `SANDBOX_GATEWAY_AUTH_TOKEN` | unset | Shared token. Set the same value on the runner and on DocsGPT; the runner won't start without it. |
 | `SANDBOX_KERNEL_NAME` | `docsgpt-python` | The kernel each session uses. `docsgpt-python` strips secrets from the kernel environment. The stock `python3` kernel passes the gateway's whole environment to code, so use it only with a bare development gateway that has no other kernel. |
 | `SANDBOX_EXEC_TIMEOUT` | `60` | Wall-clock limit in seconds for one run. |
-| `SANDBOX_MAX_TTL` | `1200` | Longest time in seconds a kept-alive session may sit idle. |
+| `SANDBOX_MAX_TTL` | `1200` | Seconds an idle session is kept before it is closed. Sessions stay open between runs until then. |
 | `SANDBOX_MAX_SESSIONS` | `32` | Live sessions per API or worker process. At the limit, the least recently used idle session is closed. |
 | `SANDBOX_MEMORY`, `SANDBOX_CPUS` | `1g`, `1.0` | Resource caps for the Compose runner container. |
+| `SANDBOX_KERNEL_IDLE_TIMEOUT` | `1800` | Set on the runner, not on DocsGPT. Seconds an idle kernel may live before the runner shuts it down, which catches kernels a restarted API or worker process left behind. Keep it above `SANDBOX_MAX_TTL`. |
+
+On the Jupyter runner every conversation that ran code keeps its kernel until the session has been idle for `SANDBOX_MAX_TTL`. An idle kernel takes about 50-60 MB, and more once code has loaded data, and its workspace files sit on the runner's in-memory `/tmp`. Size `SANDBOX_MEMORY` for the conversations you expect to run code at the same time, or lower `SANDBOX_MAX_TTL` or `SANDBOX_MAX_SESSIONS`. On Daytona each session is its own sandbox, which Daytona also stops after `DAYTONA_AUTO_STOP_INTERVAL` idle minutes.
 
 The rest, including the output and file size caps and the Daytona settings, are in the [Settings Reference](/Deploying/Settings-Reference#sandbox). The [runner README](https://github.com/arc53/DocsGPT/tree/main/deployment/sandbox) covers the isolation model in more depth.
```

**File**: `docs/content/Deploying/Settings-Reference.mdx` (modified, +2/-2)
```diff
@@ -1,7 +1,7 @@
 ---
 title: Settings Reference
 description: Every DocsGPT setting, grouped by domain, with its type, default and purpose.
-lastUpdated: 2026-10-02
+lastUpdated: 2026-10-05
 ---
 
 {/* GENERATED FILE. Do not edit by hand: run `python -m docsgpt.core.settings.reference --write`. */}
@@ -1703,7 +1703,7 @@ Kernelspec per session. The env-scrubbing docsgpt-python spec keeps kernel code
 
 Type `int`, default `1200`.
 
-Hard cap (s) on agent-selectable keep-alive TTL.
+Seconds an idle session is kept before it is closed, and the cap on a keep-alive TTL the model asks for. Code Executor sessions stay open between calls until then.
 
 ### `SANDBOX_MAX_SESSIONS`
 
```

**File**: `docs/content/Tools/artifacts-and-code-execution.mdx` (modified, +10/-7)
```diff
@@ -1,7 +1,7 @@
 ---
 title: Artifacts and Code Execution
 description: Generate editable documents, run sandboxed code, and read files with the DocsGPT artifact, code executor, and read document tools.
-lastUpdated: 2026-10-01
+lastUpdated: 2026-10-05
 ---
 
 import { Callout } from 'nextra/components';
@@ -30,7 +30,7 @@ sandbox runner, so on a deployment without one they would fail on every call.
 
 An **artifact** is a file the assistant produces that you can open, download, and edit later. Artifacts are versioned: every edit appends a new version at the same artifact, so you can review or restore an earlier one. Bytes are stored on the server and are never passed through the model, so large files stay fast and cheap to work with.
 
-In a normal chat, a produced artifact appears as a chip under the assistant's reply (for example, "Artifact"). Open it to:
+In a normal chat, a produced artifact appears as a chip under the assistant's reply (for example, "Artifact"). A chip opens the artifact's current version, so a chip under an earlier reply shows the latest edit. Open it to:
 
 - preview the content in a side panel (HTML and similar kinds render inline),
 - download the file,
@@ -54,14 +54,17 @@ Supported kinds are presentation (.pptx), document (.docx), spreadsheet (.xlsx),
 
 ## Code Executor
 
-The Code Executor runs Python in a sandboxed, stateful session bound to your conversation (or to a workflow run). Files the code writes into the workspace are captured as artifacts automatically, so a script that produces `report.csv` gives you a downloadable artifact with no extra steps.
+The Code Executor runs Python in a sandboxed session bound to your conversation (or to a workflow run). Files the code writes into the workspace are captured as artifacts automatically, so a script that produces `report.csv` gives you a downloadable artifact with no extra steps.
 
 Key points:
 
-- A session is closed after each run unless the model asks to keep it alive. When it does, variables, imports, and files persist between calls in the same conversation (or workflow run) until the session has been idle for the time the model asked for, at most `SANDBOX_MAX_TTL` (1200 seconds by default).
+- The session stays open between runs until it has been idle for `SANDBOX_MAX_TTL` seconds (1200 by default) or a shorter time the model asks for. The model can pass `persist=false` to close it after a run.
+- What carries over to the next run depends on the backend. On the Jupyter runner, variables, imports, files, and installed packages all do. On Daytona, files and installed packages do, but each run starts a new Python interpreter, so the model re-imports and re-loads what it needs and passes data between runs through files.
+- Each result tells the model whether the session is `new` (nothing from earlier runs is left, for example after it idled out) or `reused`, so it knows when to rebuild its files.
 - Only a compact summary is returned to the model (an output tail plus artifact references), never raw file bytes.
 - Each run is limited to `SANDBOX_EXEC_TIMEOUT` seconds of wall-clock time (60 by default). For longer work, the model starts the job in the background and checks back with more calls.
-- Every file a run creates or changes is saved as an artifact, except files under `tmp/`. The model can instead name the files or globs to keep.
+- Every file a run creates or changes in the workspace is saved as an artifact, except files under `scratch/` (or `tmp/`), where the model puts previews and intermediate files. The model can instead name the files or globs to keep. Files written outside the workspace, such as under `/tmp`, are never saved.
+- Saving a file under a name the Code Executor already used in the conversation (or workflow run) adds a new version of that artifact instead of a second artifact, and saving identical bytes again adds nothing. Files from workflow Code nodes are always new artifacts.
 - Install packages from inside the code itself when you need them.
 
 <Callout type="warning">
@@ -78,7 +81,7 @@ You can pass files into a run. Each input accepts a short reference returned by
 
 When the model reads images, it can look at what its tools produce instead of guessing:
 
-- Charts a run displays with `plt.show()` are saved as artifacts and shown to the model with the run's result. On Daytona this needs a snapshot that includes matplotlib.
+- Charts a run displays with `plt.show()` are shown to the model with the run's result. They are saved as artifacts too, unless the run also saved an image file of its own (with `savefig`), so a chart the code both saves and shows is saved once. On Daytona this needs a snapshot that includes matplotlib.
 - A `view_image` tool is added next to the Code Executor and Read Webpage. It shows the model an image artifact by its reference (such as `A2`) or an image URL, such as one on a page Read Webpage returned.
 - Images an MCP server returns are shown to the model as images too.
 
```

**File**: `docsgpt/agents/tools/artifact_generator.py` (modified, +2/-2)
```diff
@@ -855,8 +855,8 @@ def _render(self, kind: str, spec: Any) -> Dict[str, Any]:
             return {"error": f"render failed: {type(exc).__name__}: {exc}"}
         finally:
             # Drop this render's scratch dir, but do NOT close the session: it is the
-            # shared conversation/run session that code_executor(persist=True) keeps
-            # warm. A render is self-contained (it builds a document from the artifact
+            # shared conversation/run session that code_executor keeps warm between
+            # calls. A render is self-contained (it builds a document from the artifact
             # spec, not from prior kernel state) and does not own that session -- its
             # lifecycle belongs to the manager's TTL reaper / the conversation.
             manager.remove_path(session_id, token_dir)
```

**File**: `docsgpt/agents/tools/code_executor.py` (modified, +124/-36)
```diff
@@ -23,7 +23,7 @@
     MAX_CAPTURED_FILES,
     QuotaExceeded,
     capture_artifacts,
-    persist_new_artifact,
+    persist_artifact,
     snapshot_signatures,
     unique_input_path,
 )
@@ -57,6 +57,9 @@
 # [A-Za-z0-9_-]+, so any disallowed character is stripped before binding.
 _SESSION_ID_RE = re.compile(r"[^A-Za-z0-9_-]+")
 
+# ``persist`` values (models often send strings) that ask to close the session.
+_CLOSE_VALUES = frozenset({"false", "0", "no"})
+
 
 def _tail(stream: Optional[str]) -> str:
     """Return the trailing slice of ``stream`` bounded by ``_OUTPUT_TAIL_BYTES``."""
@@ -117,26 +120,56 @@ def _environment_note() -> str:
             "importing it."
         )
 
+    @staticmethod
+    def _persistence_note() -> str:
+        """Backend-specific note on what survives from one ``run_code`` call to the next.
+
+        The Jupyter runner keeps one kernel per session, so interpreter state
+        carries over. Daytona runs every call in a new interpreter: only the
+        sandbox filesystem (and so pip installs) outlives a call.
+        """
+        backend = str(settings.SANDBOX_BACKEND or "jupyter").lower()
+        if backend == "daytona":
+            return (
+                "The session stays warm between calls until it idles out: files and pip-installed "
+                "packages carry over to the next run_code call, but each call runs in a fresh Python "
+                "interpreter, so variables and imports do NOT carry over. Re-import and re-load what "
+                "you need in every call, and pass data between calls through files. "
+            )
+        return (
+            "The session stays warm between calls until it idles out: variables, imports, files and "
+            "installed packages carry over to the next run_code call. "
+        )
+
     def get_actions_metadata(self) -> List[Dict[str, Any]]:
         """Return JSON metadata describing the ``run_code`` action for tool schemas."""
         return [
             {
                 "name": "run_code",
                 "description": (
-                    "Execute Python in a sandboxed, stateful session bound to this conversation. ""Use it for real computation, data processing, file parsing or conversion, and "
+                    "Execute Python in a sandboxed session bound to this conversation. Use it for real "
+                    "computation, data processing, file parsing or conversion, and "
                     "charts rather than estimating or writing results by hand; each run is "
                     "time-limited, so start long work in the background and check on it with "
                     "another run. Do NOT use it for arithmetic you can do inline. "
-                    
-                    "Files written by the code are saved as downloadable artifacts (write throwaway "
-                    "files under `tmp/`, or pass `outputs` to save only specific files); only a compact "
-                    "summary (output tail + artifact references) is returned, never raw bytes. "
-                    "Charts the code displays (plt.show()) are saved too and shown to you as images "
-                    "when you can read images. "
+                    + self._persistence_note()
+                    + "Every result has a `session` field: `new` means a fresh session where nothing "
+                    "from earlier calls exists, so rebuild what you need; `reused` means what earlier calls "
+                    "left is still there. "
+                    "Files the code writes in the workspace (the working directory) are saved as "
+                    "downloadable artifacts, and saving a file again under the same name adds a new "
+                    "version of it. Put previews, test renders and intermediate files under `scratch/`, "
+                    "which is never saved, or pass `outputs` to save only specific files. Absolute paths "
+                    "such as /tmp are outside the workspace: files there are never saved, so do not rely on "
+                    "them later. "
+                    "Only a compact summary (output tail + artifact references) is returned, never raw bytes. "
+                    "Charts the code displays (plt.show()) are shown to you as images when you can read "
+                    "images: show a chart to check it yourself, and savefig the chart the user should get. "
+                    "A displayed chart is saved for the user only when the run saved no image file. "
                     "Each saved file appears to the user as a download button: name it in your answer, "
                     "never write a link or sandbox path to it. "
                     "Each call is capped at ~60s of wall-clock; for longer work, start it in the "
-                    "background and poll with additional run_code calls (use persist=true to keep state). "
+                    "background and poll with additional run_code calls. "
                     + self._en
```

---

### Incident Patch 14: `81e5e379` (2026-10-04)
**Commit Message**: Merge pull request #2958 from arc53/HTML-entities-fix

**File**: `frontend/src/assets/sharepoint.svg` (modified, +1/-16)
```diff
@@ -1,16 +1 @@
-<!DOCTYPE svg PUBLIC "-//W3C//DTD SVG 1.1//EN" "http://www.w3.org/Graphics/SVG/1.1/DTD/svg11.dtd">
-<!-- Uploaded to: SVG Repo, www.svgrepo.com, Transformed by: SVG Repo Mixer Tools -->
-<svg width="800px" height="800px" viewBox="0 0 48 48" id="b" xmlns="http://www.w3.org/2000/svg" fill="currentColor" stroke="currentColor" stroke-width="3.312">
-<g id="SVGRepo_bgCarrier" stroke-width="0"/>
-<g id="SVGRepo_tracerCarrier" stroke-linecap="round" stroke-linejoin="round"/>
-<g id="SVGRepo_iconCarrier">
-<defs>
-<style>.c{fill:none;stroke:#000000;stroke-linecap:round;stroke-linejoin:round;}</style>
-</defs>
-<path class="c" d="m4.55,16v16c0,1.1.9,2,2,2h16c1.1,0,2-.9,2-2v-16c0-1.1-.9-2-2-2H6.55c-1.1,0-2,.9-2,2Z"/>
-<path class="c" d="m11.15,28.3c.7.9,1.5,1.2,2.7,1.2h1.6c1.5,0,2.7-1.2,2.7-2.7h0c0-1.5-1.2-2.7-2.7-2.7h-1.8c-1.5,0-2.7-1.2-2.7-2.7h0c0-1.5,1.2-2.8,2.8-2.8h1.6c1.2,0,2,.3,2.7,1.2"/>
-<path class="c" d="m32.45,35.6c.4.1.9.1,1.3.1,5.4,0,9.7-4.4,9.7-9.7s-4.4-9.7-9.7-9.7c-4.3,0-8,2.8-9.2,6.7"/>
-<path class="c" d="m24.55,26.5c4.4,0,8,3.6,8,8,0,.4,0,.8-.1,1.1-.6,3.9-3.9,6.9-7.9,6.9-4.4,0-8-3.6-8-8v-.5"/>
-<path class="c" d="m12.85,14c1-4.9,5.4-8.5,10.5-8.5,5.9,0,10.8,4.8,10.8,10.7"/>
-</g>
-</svg>
\ No newline at end of file
+<svg fill="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path fill-rule="evenodd" d="M20.98 6.52L20.93 6.05L20.81 5.42L20.67 4.96L20.44 4.37L20.23 3.94L19.99 3.52L19.62 3L19.32 2.63L18.98 2.29L18.62 1.98L18.11 1.60L17.70 1.34L17.28 1.12L16.69 0.88L16.08 0.69L15.61 0.60L15.14 0.53L14.66 0.50L14.02 0.52L13.55 0.57L12.92 0.69L12.46 0.83L11.87 1.06L11.44 1.27L11.02 1.51L10.50 1.88L10.13 2.18L9.68 2.63L9.38 3L9.01 3.52L8.77 3.94L8.50 4.50L11.06 4.50L11.60 4.56L12.07 4.70L12.47 4.88L12.86 5.14L13.21 5.48L13.49 5.82L13.71 6.21L13.87 6.62L13.97 7.05L14 7.49L14 10.53L14.35 10.16L14.68 9.87L15.04 9.60L15.40 9.36L15.79 9.15L16.22 8.95L16.63 8.80L17.05 8.68L17.49 8.59L17.92 8.53L18.49 8.50L18.93 8.52L19.37 8.56L19.83 8.65L20.25 8.76L20.71 8.92L20.84 8.42L20.95 7.80L21 7.16ZM12.99 7.35L12.94 7.01L12.83 6.69L12.66 6.39L12.45 6.12L12.19 5.89L11.90 5.71L11.58 5.59L11.24 5.52L2.90 5.50L2.61 5.54L2.28 5.63L2.01 5.76L1.73 5.95L1.42 6.27L1.21 6.60L1.06 7.01L1 7.45L1 15.60L1.04 15.89L1.13 16.22L1.26 16.49L1.45 16.77L1.77 17.08L2.14 17.31L2.56 17.45L2.95 17.50L11.10 17.50L11.44 17.45L11.72 17.37L11.99 17.24L12.27 17.05L12.58 16.73L12.79 16.40L12.93 16.03L12.99 15.65ZM9.28 8.83L9.33 8.99L9.35 9.15L9.33 9.32L9.26 9.52L9.18 9.66L9.03 9.81L8.90 9.90L8.74 9.97L8.58 10L8.41 10L8.25 9.97L8.09 9.90L7.86 9.72L7.64 9.37L7.52 9.24L7.30 9.11L7.05 9.05L6.88 9.06L6.72 9.10L6.50 9.23L6.38 9.35L6.28 9.50L6.23 9.66L6.20 9.82L6.21 9.99L6.30 10.23L6.46 10.44L6.59 10.54L6.83 10.63L7.53 10.71L8.04 10.88L8.27 11L8.53 11.18L8.86 11.48L9.05 11.72L9.19 11.95L9.32 12.23L9.45 12.66L9.49 12.96L9.50 13.28L9.43 13.72L9.35 14.02L9.22 14.30L8.95 14.71L8.58 15.09L8.13 15.38L7.67 15.56L7.15 15.64L6.79 15.64L6.31 15.55L5.82 15.35L5.41 15.08L5.18 14.87L4.98 14.63L4.74 14.21L4.66 13.97L4.66 13.76L4.72 13.52L4.85 13.31L5.03 13.14L5.26 13.03L5.51 13L5.75 13.03L5.94 13.12L6.11 13.25L6.21 13.38L6.36 13.63L6.55 13.81L6.78 13.92L6.95 13.95L7.12 13.94L7.28 13.90L7.44 13.82L7.57 13.71L7.67 13.58L7.77 13.34L7.80 13.18L7.79 13.01L7.74 12.84L7.66 12.69L7.54 12.56L7.41 12.46L7.17 12.37L6.47 12.29L5.96 12.12L5.69 11.98L5.33 11.71L5.11 11.49L4.95 11.28L4.81 11.05L4.68 10.77L4.55 10.34L4.51 10.04L4.50 9.72L4.57 9.28L4.65 8.98L4.78 8.70L5.02 8.33L5.19 8.12L5.42 7.91L5.68 7.73L6.07 7.53L6.37 7.43L6.68 7.37L7.12 7.35L7.43 7.39L7.73 7.46L8.14 7.63L8.41 7.79L8.66 7.98L8.96 8.30L9.14 8.56ZM23.49 14.13L23.38 13.40L23.25 12.93L23.12 12.59L22.91 12.14L22.72 11.83L22.52 11.52L22.20 11.14L21.67 10.63L21.38 10.41L20.96 10.15L20.30 9.84L19.83 9.68L19.48 9.60L18.75 9.51L18.25 9.51L17.89 9.54L17.40 9.62L17.05 9.72L16.59 9.88L16.25 10.03L15.62 10.41L15.23 10.71L14.96 10.96L14.63 11.33L14.41 11.62L14.21 11.93L14 12.32L14 14.02L14.54 14.10L15.14 14.26L15.64 14.46L16.19 14.74L16.72 15.10L17.13 15.46L17.55 15.91L17.87 16.34L18.12 16.76L18.29 17.11L18.56 17.84L18.65 18.24L18.71 18.62L18.74 19L18.74 19.49L19.23 19.45L19.71 19.35L20.18 19.21L20.64 19.02L21.07 18.79L21.48 18.52L21.86 18.20L22.20 17.86L22.52 17.48L22.79 17.07L23.02 16.64L23.21 16.18L23.35 15.71L23.45 15.23L23.49 14.75ZM17.74 18.94L17.70 18.63L17.62 18.22L17.54 17.92L17.39 17.53L17.25 17.25L17.03 16.89L16.79 16.55L16.58 16.32L16.35 16.10L16.03 15.84L15.77 15.66L15.41 15.45L15.03 15.28L14.73 15.18L14.33 15.08L14 15.03L13.98 15.86L13.92 16.17L13.83 16.50L13.69 16.84L13.53 17.12L13.33 17.39L13.08 17.66L12.78 17.92L12.42 18.14L12.07 18.30L11.65 18.43L11.09 18.50L9.32 18.50L9.26 19.04L9.26 19.56L9.31 19.98L9.40 20.38L9.53 20.78L9.70 21.16L9.91 21.52L10.15 21.86L10.42 22.18L10.72 22.47L11.05 22.72L11.41 22.95L11.78 23.14L12.17 23.29L12.57 23.40L12.98 23.47L13.40 23.50L13.81 23.49L14.23 23.44L14.63 23.35L15.03 23.22L15.41 23.05L15.77 22.84L16.11 22.60L16.43 22.33L16.72 22.0
```

**File**: `frontend/src/settings/SourceConfigModal.tsx` (modified, +2/-0)
```diff
@@ -171,6 +171,8 @@ export default function SourceConfigModal({
         document?.name
           ? t('settings.sources.configModal.subtitle', {
               name: document.name,
+              // React escapes the text; i18next escaping it too shows "&amp;".
+              interpolation: { escapeValue: false },
             })
           : t('settings.sources.configModal.subtitleGeneric')
       }
```

**File**: `frontend/src/settings/TestRetrievalModal.tsx` (modified, +5/-1)
```diff
@@ -183,7 +183,11 @@ export default function TestRetrievalModal({
       title={tr('title')}
       description={
         document?.name
-          ? tr('subtitle', { name: document.name })
+          ? tr('subtitle', {
+              name: document.name,
+              // React escapes the text; i18next escaping it too shows "&amp;".
+              interpolation: { escapeValue: false },
+            })
           : tr('subtitleGeneric')
       }
       // xl, like PromptsModal, so the two large modals read as one family.
```

**File**: `frontend/src/settings/sourceModalSubtitles.test.tsx` (added, +98/-0)
```diff
@@ -0,0 +1,98 @@
+import i18n from 'i18next';
+import { act } from 'react';
+import { createRoot, type Root } from 'react-dom/client';
+import { I18nextProvider, initReactI18next } from 'react-i18next';
+
+vi.mock('../hooks', () => ({
+  useMediaQuery: () => ({ isMobile: false, isDesktop: true }),
+}));
+
+vi.mock('react-redux', () => ({
+  useSelector: () => null,
+  useDispatch: () => vi.fn(),
+}));
+
+vi.mock('../api/services/userService', () => ({
+  default: { updateSourceConfig: vi.fn(), testSourceRetrieval: vi.fn() },
+}));
+
+import en from '../locale/en.json';
+import type { Doc } from '../models/misc';
+import SourceConfigModal from './SourceConfigModal';
+import TestRetrievalModal from './TestRetrievalModal';
+
+Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
+
+// A real i18next instance: it HTML-escapes interpolated values unless told not
+// to, and React escapes them again, so "&" would render as "&amp;".
+const testI18n = i18n.createInstance();
+
+const doc: Doc = {
+  id: 'src-1',
+  name: 'Policies & Contracts Library',
+  date: '',
+  model: '',
+};
+
+describe('source modal subtitles', () => {
+  let container: HTMLDivElement;
+  let root: Root;
+
+  beforeAll(async () => {
+    await testI18n.use(initReactI18next).init({
+      lng: 'en',
+      fallbackLng: 'en',
+      resources: { en: { translation: en } },
+    });
+  });
+
+  beforeEach(() => {
+    container = document.createElement('div');
+    document.body.appendChild(container);
+    root = createRoot(container);
+  });
+
+  afterEach(async () => {
+    await act(async () => root.unmount());
+    container.remove();
+    document.body.innerHTML = '';
+  });
+
+  it('shows the source name unescaped in Source settings', async () => {
+    await act(async () => {
+      root.render(
+        <I18nextProvider i18n={testI18n}>
+          <SourceConfigModal
+            modalState="ACTIVE"
+            setModalState={vi.fn()}
+            document={doc}
+            onReingest={vi.fn()}
+            onEnableGraphRAG={vi.fn()}
+          />
+        </I18nextProvider>,
+      );
+    });
+    expect(document.body.textContent).toContain(
+      'Configure how "Policies & Contracts Library" is chunked',
+    );
+    expect(document.body.textContent).not.toContain('&amp;');
+  });
+
+  it('shows the source name unescaped in Test retrieval', async () => {
+    await act(async () => {
+      root.render(
+        <I18nextProvider i18n={testI18n}>
+          <TestRetrievalModal
+            modalState="ACTIVE"
+            setModalState={() => undefined}
+            document={doc}
+          />
+        </I18nextProvider>,
+      );
+    });
+    expect(document.body.textContent).toContain(
+      'retrieves from "Policies & Contracts Library"',
+    );
+    expect(document.body.textContent).not.toContain('&amp;');
+  });
+});
```

---

### Incident Patch 15: `576205d4` (2026-10-04)
**Commit Message**: Explain Entra app roles, security groups and the groups overage limit

**File**: `docs/content/Deploying/OIDC-SSO.mdx` (modified, +26/-0)
```diff
@@ -132,6 +132,32 @@ Use `OIDC_USER_ID_CLAIM=oid`. The `oid` claim is the user's object ID in your te
 
 The default `sub` claim also works, but Entra issues a different `sub` for each app registration. If you ever replace the app registration, every user gets a new `sub` and therefore a fresh, empty DocsGPT account. Avoid `email` and `preferred_username` (the user principal name): both change when a user is renamed and can be reassigned to someone else later, and Entra doesn't guarantee `email` is present. Pick the claim before going live; changing it later gives existing users new, empty accounts.
 
+### Restrict access with app roles or groups
+
+By default every user in the tenant can sign in. Entra offers three ways to narrow that down, and they combine.
+
+**Require assignment in Entra.** Under **Entra ID → Enterprise apps → *your app* → Properties**, set **Assignment required?** to *Yes*, then add the allowed users or groups under **Users and groups**. Unassigned users are stopped on the Microsoft sign-in page and never reach DocsGPT, so no DocsGPT setting is involved.
+
+**App roles (recommended for the allowlist and admin mapping).** App roles arrive in the ID token's `roles` claim as the readable values you define, and they aren't subject to the group-count limit described below.
+
+1. In the app registration, open **App roles → Create app role** and create one role per access level, with **Allowed member types** set to *Users/Groups* — for example the values `DocsGPT.User` and `DocsGPT.Admin`.
+2. Under **Enterprise apps → *your app* → Users and groups → Add user/group**, assign users or groups to those roles. Assigning a *group* to a role requires Microsoft Entra ID P1 or P2; assigning individual users works on every tier.
+3. Point DocsGPT at the `roles` claim:
+   ```env
+   OIDC_GROUPS_CLAIM=roles
+   OIDC_ALLOWED_GROUPS=DocsGPT.User,DocsGPT.Admin
+   OIDC_ADMIN_GROUPS=DocsGPT.Admin
+   ```
+
+**Security groups.** In the app registration, open **Token configuration → Add groups claim** and choose *Security groups* or *Groups assigned to the application*. Entra emits group **object IDs**, not display names, so list the IDs shown on each group's **Overview** page:
+
+```env
+OIDC_ALLOWED_GROUPS=<object id of the users group>
+OIDC_ADMIN_GROUPS=<object id of the admins group>
+```
+
+When a user belongs to more than 200 groups, Entra leaves the `groups` claim out of the ID token and points to Microsoft Graph instead. DocsGPT doesn't query Graph, and Entra's userinfo endpoint doesn't return groups, so that user is denied with `not_authorized` and their admin role is left unchanged. *Groups assigned to the application* only emits the groups assigned to the enterprise app, which keeps the claim short (assigning groups needs Entra ID P1 or P2); app roles avoid the limit entirely.
+
 ## Restricting sign-in by group
 
 By default any user who can authenticate at the IdP may use DocsGPT. To restrict access to specific IdP groups:
```

#### Recent Merged Pull Requests:
- **PR #2971** (2026-10-05): Let run_code take a longer timeout and allow compiled pip installs in the self-hosted sandbox (@dartpain)
- **PR #2969** (2026-10-05): Render non-Latin text in PDF artifacts (@dartpain)
- **PR #2968** (2026-10-05): Teach the model the code sandbox: environment summary, fix hints and a tighter tool description (@dartpain)
- **PR #2966** (2026-10-05): fix anthropic structured output (@pabik)
- **PR #2964** (2026-10-05): Build the code sandbox from one package manifest and add office, browser and OCR tools (@dartpain)
- **PR #2963** (2026-10-05): Keep the code sandbox between calls and version re-saved files (@dartpain)
- **PR #2958** (2026-10-04): Source names with special characters showed as HTML entities (@pabik)
- **PR #2957** (2026-10-04): Document Microsoft Entra ID sign-in in the OIDC SSO guide (@dartpain)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
