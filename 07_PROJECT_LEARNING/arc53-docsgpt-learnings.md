# Forensic Learning Record (Deep Inspection): arc53/DocsGPT

> **Canonical Artifact**: `07_PROJECT_LEARNING/arc53-docsgpt-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/arc53/DocsGPT](https://github.com/arc53/DocsGPT))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-09-30T18:45:20.001Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `arc53/DocsGPT`
- **Description**: Private AI platform for agents, assistants and enterprise search. Built-in Agent Builder, Deep research, Document analysis, Multi-model support, and API connectivity for agents.
- **Primary Language / Ecosystem**: Python
- **Discovered Manifests / Configurations**: pyproject.toml, README.md
- **Stars / Engagement**: 18295 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: pyproject.toml, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `application/__init__.py`
```
"""``application`` is now ``docsgpt``; this alias keeps the old name importable for one release.

Every ``import application.x.y`` resolves to the already-imported ``docsgpt.x.y``
module object, so there is exactly one settings object, one Celery app and one
Flask app however a process refers to them. Entry points such as
``celery -A application.app.celery``, ``uvicorn application.asgi:asgi_app`` and
``python -m application.scripts.<name>`` keep working; update them to
``docsgpt.…`` before the alias is removed.
"""

from __future__ import annotations

import importlib
import importlib.abc
import importlib.util
import sys
import warnings

_OLD = __name__
_NEW = "docsgpt"


class _AliasLoader(importlib.abc.Loader):
    """Hand back the ``docsgpt`` module object; delegate code access to its real loader."""

    def __init__(self, target: str, target_spec) -> None:
        self._target = target
        self._target_spec = target_spec
        self._original_spec = None

    def create_module(self, spec):
        module = importlib.import_module(self._target)
        self._original_spec = module.__spec__
        return module

    def exec_module(self, module) -> None:
        # The import machinery stamps the alias spec on the shared module
        # object; put the real one back so importlib.reload and __spec__-based
        # lookups keep addressing the module by its docsgpt name.
        if self._original_spec is not None:
            module.__spec__ = self._original_spec

    # runpy (``python -m application.x``) reads the code through the loader.
    def get_code(self, fullname):
        return self._target_spec.loader.get_code(self._target)

    def get_source(self, fullname):
        return self._target_spec.loader.get_source(self._target)

    def get_filename(self, fullname):
        return self._target_spec.loader.get_filename(self._target)

    def is_package(self, fullname):
        return self._target_spec.submodule_search_locations is not None


class _AliasFinder(importlib.abc.MetaPathFinder):
    """Resolve ``application.<path>`` to ``docsgpt.<path>``."""

    def find_spec(self, name, path=None, target=None):
        if name != _OLD and not name.startswith(_OLD + "."):
            return None
        new_name = _NEW + name[len(_OLD):]
        target_spec = importlib.util.find_spec(new_name)
        if target_spec is None:
            return None
        return importlib.util.spec_from_loader(name, _AliasLoader(new_name, target_spec))


warnings.warn(
    "The 'application' package was renamed to 'docsgpt'. Update imports and entry points "
    "(celery -A docsgpt.app.celery, uvicorn docsgpt.asgi:asgi_app); this alias will be removed.",
    FutureWarning,
    stacklevel=2,
)
sys.meta_path.insert(0, _AliasFinder())
sys.modules[_OLD] = importlib.import_module(_NEW)

```

### Core Architecture Module: `extensions/chatwoot/app.py`
```
"""Chatwoot webhook bridge: answers incoming Chatwoot messages with a DocsGPT agent."""

import hashlib
import hmac
import json
import logging
import os
import time
from pathlib import Path
from typing import Any

import dotenv
import requests
from flask import Flask, request

dotenv.load_dotenv(Path(__file__).with_name(".env"))
docsgpt_url = os.getenv("docsgpt_url", "").rstrip("/")
chatwoot_url = os.getenv("chatwoot_url", "").rstrip("/")
docsgpt_key = os.getenv("docsgpt_key")
chatwoot_token = os.getenv("chatwoot_token")
chatwoot_webhook_secret = os.getenv("chatwoot_webhook_secret", "")
# INSECURE opt-in for Chatwoot versions that do not sign webhooks: accept requests that carry
# neither X-Chatwoot-Signature nor X-Chatwoot-Timestamp. Anyone who can reach /docsgpt can then
# make the bridge answer and post into your conversations.
chatwoot_allow_unsigned = os.getenv("chatwoot_allow_unsigned", "").strip().lower() in ("1", "true", "yes", "on")
# Optional filters: when set, only answer conversations in this account / assigned to this agent.
account_id = os.getenv("account_id") or None
assignee_id = os.getenv("assignee_id") or None
label_stop = "human-requested"
# Reject webhook deliveries signed more than this many seconds ago (replay protection).
SIGNATURE_MAX_AGE_SECONDS = 300
REQUEST_TIMEOUT_SECONDS = 120

logger = logging.getLogger(__name__)
if chatwoot_allow_unsigned:
    logger.warning(
        "chatwoot_allow_unsigned is on: unsigned webhook requests are accepted. This is insecure; "
        "use it only with a Chatwoot version that cannot sign webhooks, and keep /docsgpt off the public internet."
    )


def send_to_bot(sender: Any, message: str) -> str | None:
    """Ask the DocsGPT agent a question through ``/api/answer``.

    Args:
        sender: The Chatwoot contact id (kept for logging).
        message: The customer's message text.

    Returns:
        The agent's answer, or ``None`` if DocsGPT could not be reached or returned an error.
    """
    data = {
        'question': message,
        'api_key': docsgpt_key,
        'history': json.dumps([]),
    }
    headers = {"Content-Type": "application/json",
               "Accept": "application/json"}

    try:
        r = requests.post(f'{docsgpt_url}/api/answer',
                          json=data, headers=headers, timeout=REQUEST_TIMEOUT_SECONDS)
    except requests.RequestException as exc:
        logger.error("DocsGPT request for contact %s failed: %s", sender, exc)
        return None
    if not r.ok:
        logger.error("DocsGPT returned HTTP %s for contact %s: %s", r.status_code, sender, r.text[:500])
        return None
    try:
        answer = r.json().get('answer')
    except ValueError:
        answer = None
    if not answer:
        logger.error("DocsGPT response for contact %s has no answer: %s", sender, r.text[:500])
        return None
    return answer


def send_to_chatwoot(account: Any, conversation: Any, message: str) -> dict | None:
    """Post a reply into a Chatwoot conversation.

    Args:
        account: The Chatwoot account id.
        conversation: The Chatwoot conversation id.
        message: The reply text.

    Returns:
        The created Chatwoot message, or ``None`` if Chatwoot could not be reached or rejected it.
    """
    data = {
        'content': message
    }
    url = f"{chatwoot_url}/api/v1/accounts/{account}/conversations/{conversation}/messages"
    headers = {"Content-Type": "application/json",
               "Accept": "application/json",
               "api_access_token": f"{chatwoot_token}"}

    try:
        r = requests.post(url, json=data, headers=headers, timeout=REQUEST_TIMEOUT_SECONDS)
    except requests.RequestException as exc:
        logger.error("Chatwoot request for conversation %s failed: %s", conversation, exc)
        return None
    if not r.ok:
        logger.error("Chatwoot returned HTTP %s for conversation %s: %s", r.status_code, conversation, r.text[:500])
        return None
    try:
        return r.json()
    except ValueError:
        return {}


def is_valid_chatwoot_signature(
    raw_body: bytes, signature_header: str | None, timestamp_header: str | None
) -> bool:
    """Validate a Chatwoot webhook signature.

    Chatwoot signs each delivery with ``sha256=HMAC-SHA256(secret, "{timestamp}.{raw_body}")`` and sends the
    timestamp in ``X-Chatwoot-Timestamp``. When ``chatwoot_allow_unsigned`` is on, a request with neither header
    is accepted; a request that carries either header is still verified.

    Args:
        raw_body: The unparsed request body.
        signature_header: The ``X-Chatwoot-Signature`` header value.
        timestamp_header: The ``X-Chatwoot-Timestamp`` header value (Unix seconds).

    Returns:
        True if the signature matches and the timestamp is recent, or the request is unsigned and unsigned
        requests are allowed.
    """
    if chatwoot_allow_unsigned and not signature_header and not timestamp_header:
        return True
    if not chatwoot_webhook_secret or not signature_header or not timestamp_header:
        return False
    try:
        timestamp = int(timestamp_header.strip())
    except ValueError:
        return False
    if abs(time.time() - timestamp) > SIGNATURE_MAX_AGE_SECONDS:
        return False

    expected = hmac.new(
        chatwoot_webhook_secret.encode("utf-8"), f"{timestamp_header.strip()}.".encode() + raw_body, hashlib.sha256
    ).hexdigest()

    provided = signature_header.strip()
    if provided.startswith("sha256="):
        provided = provided.split("=", maxsplit=1)[1]

    try:
        return hmac.compare_digest(provided.encode("ascii"), expected.encode("ascii"))
    except UnicodeEncodeError:
        # A hex digest is ASCII; anything else cannot match.
        return False


app = Flask(__name__)


@app.route('/docsgpt', methods=['POST'])
def docsgpt():
    """Handle a Chatwoot ``message_created`` webhook and reply with the agent's answer."""
    raw_body = request.get_data()
    signature = request.headers.get("X-Chatwoot-Signature")
    timestamp = request.headers.get("X-Chatwoot-Timestamp")
    if not is_valid_chatwoot_signature(raw_body, signature, timestamp):
        return "Unauthorized", 401

    data = request.get_json(silent=True)
    if not isinstance(data, dict):
        return "Invalid payload", 400

    message_type = data.get('message_type')
    if message_type is None:
        return "Not a message"
    if message_type != "incoming":
        return "Not an incoming message"

    message = data.get('content')
    conversation_data = data.get('conversation') or {}
    conversation = conversation_data.get('id')
    contact = (data.get('sender') or {}).get('id')
    account = (data.get('account') or {}).get('id')
    assignee = ((conversation_data.get('meta') or {}).get('assignee') or {}).get('id')
    if not message or conversation is None or account is None:
        return "Nothing to answer"

    if label_stop in (conversation_data.get('labels') or []):
        return "Label stop"
    if account_id and str(account) != str(account_id):
        return "Not the right account"
    if assignee_id and str(assignee) != str(assignee_id):
        return "Not the right assignee"

    bot_response = send_to_bot(contact, message)
    if bot_response is None:
        return "DocsGPT request failed", 502
    create_message = send_to_chatwoot(account, conversation, bot_response)
    if create_message is None:
        return "Chatwoot request failed", 502
    return create_message


if __name__ == '__main__':
    app.run(host='0.0.0.0', port=int(os.getenv("PORT", "5000")))

```

### Core Architecture Module: `extensions/react-widget/eslint.config.mjs`
```
import js from '@eslint/js'
import tsParser from '@typescript-eslint/parser'
import tsPlugin from '@typescript-eslint/eslint-plugin'
import react from 'eslint-plugin-react'
import unusedImports from 'eslint-plugin-unused-imports'
import prettier from 'eslint-plugin-prettier'
import globals from 'globals'

export default [
  {
    ignores: [
      'node_modules/',
      'dist/',
      'prettier.config.cjs',
      'custom.d.ts',
      'package-lock.json',
      'package.json',
    ],
  },
  {
    files: ['**/*.{js,jsx,ts,tsx}'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      parser: tsParser,
      parserOptions: {
        ecmaFeatures: {
          jsx: true,
        },
      },
      globals: {
        ...globals.browser,
        ...globals.es2021,
        ...globals.node,
      },
    },
    plugins: {
      '@typescript-eslint': tsPlugin,
      react,
      'unused-imports': unusedImports,
      prettier,
    },
    rules: {
      ...js.configs.recommended.rules,
      ...tsPlugin.configs.recommended.rules,
      ...react.configs.recommended.rules,
      ...prettier.configs.recommended.rules,
      'react/prop-types': 'off',
      'unused-imports/no-unused-imports': 'error',
      'react/react-in-jsx-scope': 'off',
      'no-undef': 'off',
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-unused-vars': [
        'warn',
        { varsIgnorePattern: '^_', argsIgnorePattern: '^_' },
      ],
      '@typescript-eslint/no-unused-expressions': 'warn',
      'prettier/prettier': [
        'error',
        {
          endOfLine: 'auto',
        },
      ],
    },
    settings: {
      react: {
        version: 'detect',
      },
    },
  },
]


```

### Core Architecture Module: `extensions/react-widget/src/App.tsx`
```
import React from 'react';
import { DocsGPTWidget } from './components/DocsGPTWidget';
import { SearchBar } from './components/SearchBar';
export const App = () => {
  return (
    <div>
      <SearchBar showMicButton/>
      <DocsGPTWidget
        allowedFileExtensions={['.pdf', '.md', '.txt', '.docx', '.png', '.jpg']}
        showMicButton
      />
    </div>
  );
};

```

### Core Architecture Module: `extensions/react-widget/src/browser.tsx`
```
//exports browser ready methods

import { createRoot } from 'react-dom/client';

import { DocsGPTWidget } from './components/DocsGPTWidget';
import { SearchBar } from './components/SearchBar';
import React from 'react';
if (typeof window !== 'undefined') {
  const renderWidget = (elementId: string, props = {}) => {
    const root = createRoot(document.getElementById(elementId) as HTMLElement);
    root.render(<DocsGPTWidget {...props} />);
  };
  const renderSearchBar = (elementId: string, props = {}) => {
    const root = createRoot(document.getElementById(elementId) as HTMLElement);
    root.render(<SearchBar {...props} />);
  };
  (window as unknown as Record<string, unknown>).renderDocsGPTWidget =
    renderWidget;

  (window as unknown as Record<string, unknown>).renderSearchBar =
    renderSearchBar;
}

export { DocsGPTWidget, SearchBar };

```

### Core Architecture Module: `extensions/react-widget/src/components/ComposerControls.tsx`
```
import React from 'react';
import styled, { keyframes, useTheme } from 'styled-components';

import { Attachment } from '../types/index';
import { radii } from './tokens';

const ClipIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg
    width="14"
    height="14"
    viewBox="0 0 16 16"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.4"
    strokeLinecap="round"
    strokeLinejoin="round"
    xmlns="http://www.w3.org/2000/svg"
    {...props}
  >
    <path d="M13 7.5 8.1 12.4a3.04 3.04 0 0 1-4.3-4.3l5.3-5.3a2.03 2.03 0 0 1 2.87 2.87l-5.3 5.3a1.01 1.01 0 0 1-1.44-1.44l4.6-4.6" />
  </svg>
);

const MicIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg
    width="14"
    height="14"
    viewBox="0 0 16 16"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.4"
    strokeLinecap="round"
    strokeLinejoin="round"
    xmlns="http://www.w3.org/2000/svg"
    {...props}
  >
    <rect x="5.75" y="1.5" width="4.5" height="8" rx="2.25" />
    <path d="M3.5 7.5a4.5 4.5 0 0 0 9 0M8 12v2.5" />
  </svg>
);

const SquareIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg
    width="14"
    height="14"
    viewBox="0 0 16 16"
    fill="currentColor"
    xmlns="http://www.w3.org/2000/svg"
    {...props}
  >
    <rect x="4" y="4" width="8" height="8" rx="1.5" />
  </svg>
);

const DocumentIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg
    width="14"
    height="14"
    viewBox="0 0 16 16"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.4"
    strokeLinecap="round"
    strokeLinejoin="round"
    xmlns="http://www.w3.org/2000/svg"
    {...props}
  >
    <path d="M9 1.5H4.5A1.5 1.5 0 0 0 3 3v10a1.5 1.5 0 0 0 1.5 1.5h7A1.5 1.5 0 0 0 13 13V5.5L9 1.5Z" />
    <path d="M9 1.5V5.5H13" />
  </svg>
);

const AlertIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg
    width="14"
    height="14"
    viewBox="0 0 16 16"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.4"
    strokeLinecap="round"
    strokeLinejoin="round"
    xmlns="http://www.w3.org/2000/svg"
    {...props}
  >
    <path d="M8 2 1.8 13h12.4L8 2Z" />
    <path d="M8 6.5v3M8 11.5h.01" />
  </svg>
);

const CrossIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg
    width="10"
    height="10"
    viewBox="0 0 16 16"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    xmlns="http://www.w3.org/2000/svg"
    {...props}
  >
    <path d="M4 4l8 8M12 4l-8 8" />
  </svg>
);

const spin = keyframes`
  to { transform: rotate(360deg); }
`;

/**
 * Determinate while uploading; indeterminate while the server parses, since
 * parsing reports no progress.
 */
const ProgressRing = styled.svg<{ $indeterminate?: boolean }>`
  width: 14px;
  height: 14px;
  transform: rotate(-90deg);
  animation: ${(props) => (props.$indeterminate ? spin : 'none')} 900ms linear
    infinite;
  transform-origin: center;

  @media (prefers-reduced-motion: reduce) {
    animation: none;
  }
`;

const CIRCUMFERENCE = 2 * Math.PI * 6;

const AttachmentProgress = ({ attachment }: { attachment: Attachment }) => {
  const indeterminate = attachment.status === 'processing';
  const fraction = indeterminate
    ? 0.25
    : Math.min(Math.max(attachment.progress, 0), 100) / 100;

  return (
    <ProgressRing viewBox="0 0 16 16" $indeterminate={indeterminate}>
      <circle
        cx="8"
        cy="8"
        r="6"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        opacity="0.25"
      />
      <circle
        cx="8"
        cy="8"
        r="6"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeDasharray={CIRCUMFERENCE}
        strokeDashoffset={CIRCUMFERENCE * (1 - fraction)}
      />
    </ProgressRing>
  );
};

const ChipList = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  padding: 2px 2px 0 2px;
`;

const FailureList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 4px 2px 0 2px;
  font-size: 11.5px;
  line-height: 1.45;
  color: ${(props) => props.theme.danger!.text};
  overflow-wrap: anywhere;
`;

const Chip = styled.div<{ $failed?: boolean }>`
  box-sizing: border-box;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  max-width: min(100%, 200px);
  padding: 4px 4px 4px 8px;
  border-radius: ${radii.full};
  font-size: 12px;
  line-height: 1.5;
  border: 1px solid
    ${(props) =>
      props.$failed ? props.theme.danger!.border : props.theme.hairline};
  background: ${(props) =>
    props.$failed ? props.theme.danger!.soft : props.theme.primary.bg};
  color: ${(props) =>
    props.$failed ? props.theme.danger!.text : props.theme.primary.text};
`;

const ChipGlyph = styled.span`
  display: inline-flex;
  flex-shrink: 0;
  align-items: center;
  justify-content: center;
  color: ${(props) => props.theme.accent!.base};
`;

const ChipLabel = styled.span`
  min-width: 0;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
`;

const ChipRemove = styled.button`
  display: inline-flex;
  flex-shrink: 0;
  align-items: center;
  justify-content: center;
  width: 18px;
  height: 18px;
  padding: 0;
  border: none;
  border-radius: ${radii.full};
  background: transparent;
  color: inherit;
  opacity: 0.65;
  cursor: pointer;
  transition: opacity 0.15s ease;

  &:hover {
    opacity: 1;
  }

  &:focus-visible {
    outline: 2px solid ${(props) => props.theme.accent!.base};
    outline-offset: 1px;
    opacity: 1;
  }
`;

const statusLabel = (attachment: Attachment): string => {
  if (attachment.status === 'uploading')
    return `Uploading ${attachment.progress}%`;
  if (attachment.status === 'processing') return 'Processing';
  if (attachment.status === 'failed') return attachment.error ?? 'Failed';
  return 'Ready';
};

export const AttachmentChips = ({
  attachments,
  onRemove,
}: {
  attachments: Attachment[];
  onRemove: (id: string) => void;
}) => {
  // Tooltips are unreachable on touch, so failure reasons are shown inline.
  const failures = attachments.filter(
    (attachment) => attachment.status === 'failed' && attachment.error,
  );

  return (
    <>
      <ChipList>
        {attachments.map((attachment) => {
          const failed = attachment.status === 'failed';
          return (
            <Chip
              key={attachment.id}
              $failed={failed}
              title={`${attachment.fileName} — ${statusLabel(attachment)}`}
            >
              <ChipGlyph aria-hidden="true">
                {failed ? (
                  <AlertIcon />
                ) : attachment.status === 'completed' ? (
                  <DocumentIcon />
                ) : (
                  <AttachmentProgress attachment={attachment} />
                )}
              </ChipGlyph>
              <ChipLabel>{attachment.fileName}</ChipLabel>
              <ChipRemove
                type="button"
                onClick={() => onRemove(attachment.id)}
                aria-label={`Remove ${attachment.fileName}`}
              >
                <CrossIcon />
              </ChipRemove>
            </Chip>
          );
        })}
      </ChipList>

      {failures.length > 0 && (
        <FailureList role="alert">
          {failures.map((attachment) => (
            <span key={attachment.id}>
              {attachment.fileName}: {attachment.error}
            </span>
          ))}
        </FailureList>
      )}
    </>
  );
};

export const ControlBar = styled.div`
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 0 2px;
`;

export const ControlGroup = styled.div`
  display: flex;
  flex: 1;
  min-width: 0;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
`;

const ControlButton = styled.button<{
  $recording?: boolean;
  $iconOnly?: boolean;
}>`
  display: inline-flex;
  align-items: center;
  gap: 5px;
  height: ${(props) => (props.$iconOnly ? '32px' : '28px')};
  padding: ${(props) => (props.$iconOnly ? '0' : '0 10px')};
  ${(pr
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

### Incident Patch 1: `297f78c1` (2026-09-30)
**Commit Message**: Merge pull request #2864 from arc53-machine/docs-audit-fixes

Make the docs match the code, and fix what following them broke

**File**: `.devcontainer/devc-welcome.md` (modified, +11/-4)
```diff
@@ -4,7 +4,7 @@ Welcome to the DocsGPT development environment! This guide will help you get sta
 
 ## Starting Services
 
-To run DocsGPT, you need to start three main services: Flask (backend), Celery (task queue), and Vite (frontend). Here are the commands to start each service within the devcontainer:
+To run DocsGPT, you need to start three main services: the backend API, Celery (task queue and scheduler), and Vite (frontend). Here are the commands to start each service within the devcontainer:
 
 ### Vite (Frontend)
 
@@ -23,15 +23,22 @@ uvicorn docsgpt.asgi:asgi_app --host 0.0.0.0 --port 7091 --reload
 ```
 
 `flask --app docsgpt/app.py run --host=0.0.0.0 --port=7091` is faster but
-serves only the WSGI Flask app — it omits `/mcp` and the reconnect reader
-`GET /api/messages/<id>/events`, so a dropped stream won't auto-resume.
+serves only the WSGI Flask app. The ASGI-only routes return 404 under it:
+`/mcp`, notifications (`GET /api/events`), chat reconnect
+(`GET /api/messages/<id>/events`), the remote-device command stream and
+artifact downloads. See "ASGI-only features" in
+`docs/content/Deploying/Development-Environment.mdx`.
 
 ### Celery (Task Queue)
 
 ```bash
-celery -A docsgpt.app.celery worker -l INFO -Q docsgpt,parsing,embeddings
+celery -A docsgpt.app.celery worker -l INFO -B -Q docsgpt,parsing,embeddings
 ```
 
+`-B` embeds the beat scheduler, which fires scheduled agent runs, source syncs,
+reconciliation and cleanups; `docsgpt worker` adds `-B` itself.
+The `embeddings` queue serves every search query, so retrieval needs this worker.
+
 The `parsing` queue serves document parsing (the `read_document` tool / workflow
 native-file parse); without it those calls hang `DOCUMENT_PARSE_TIMEOUT` then
 error. A dedicated `-Q parsing` worker can be GPU-enabled for heavier parsers.
```

**File**: `.env-template` (modified, +33/-15)
```diff
@@ -1,8 +1,16 @@
 API_KEY=<LLM api key (for example, open ai key)>
 LLM_NAME=docsgpt
 VITE_API_STREAMING=true
+# Required: the worker hands finished indexes to the API with it; without it every ingest fails.
+# Same value on the API and the worker. Generate one with: openssl rand -hex 32
 INTERNAL_KEY=<internal key for worker-to-backend authentication>
 
+# Address other machines open DocsGPT at, if any: http://<server-address>:7091, or the public https://
+# address behind a proxy. The backend builds agent image, webhook, device pairing and MCP OAuth
+# callback links from it (default http://localhost:7091). The Docker Compose worker keeps
+# http://backend:7091 from the compose file.
+# API_URL=https://docs.example.com
+
 # Provider-specific API keys (optional - use these to enable multiple providers)
 # OPENAI_API_KEY=<your-openai-api-key>
 # ANTHROPIC_API_KEY=<your-anthropic-api-key>
@@ -32,19 +40,20 @@ EMBEDDINGS_KEY=
 
 # Run the embedding model on the Celery worker instead of in every process that
 # embeds. The API embeds each query it serves, so without this it holds its own
-# copy of the model (~370 MB more resident). Costs a broker round trip per
-# query. Retrieval then needs a worker consuming EMBEDDINGS_QUEUE -- set this to
-# false if you run the API on its own.
+# copy of the model (~660 MB resident instead of ~285 MB). Costs a broker
+# round trip per query. Retrieval then needs a worker consuming
+# EMBEDDINGS_QUEUE -- set this to false if you run the API on its own.
 # EMBEDDINGS_DELEGATE_TO_WORKER=true
 # EMBEDDINGS_QUEUE=embeddings
 # EMBEDDINGS_DELEGATE_TIMEOUT=60
 
 # Documents per local ONNX forward pass. Each pass pads every input up to the
 # longest one in it, and that waste grows with the square of chunk length, so
-# larger is not faster here: at the 1250-token default chunk size, 32 peaked at
-# 6.6 GB and took 326s, while 1 peaked at 2.9 GB and took 90s. Raise it only if
-# your chunks are short and uniform. Distinct from EMBEDDINGS_BATCH_SIZE, which
-# is chunks per store transaction / per remote embed request.
+# larger is not faster here: on a 30-document ingest at the 1250-token default
+# chunk size, 32 peaked at 7.7 GB and took 154s, while 1 peaked at 1.5 GB and
+# took 53s. Raise it only if your chunks are short and uniform. Distinct from
+# EMBEDDINGS_BATCH_SIZE, which is chunks per store transaction / per remote
+# embed request.
 # EMBEDDINGS_MODEL_BATCH_SIZE=1
 
 #For Azure (you can delete it if you don't use Azure)
@@ -53,26 +62,35 @@ OPENAI_API_VERSION=
 AZURE_DEPLOYMENT_NAME=
 AZURE_EMBEDDINGS_DEPLOYMENT_NAME=
 
+# SharePoint / OneDrive connector (optional). Uncomment and fill in to enable it.
 #Azure AD Application (client) ID
-MICROSOFT_CLIENT_ID=your-azure-ad-client-id
+# MICROSOFT_CLIENT_ID=your-azure-ad-client-id
 #Azure AD Application client secret
-MICROSOFT_CLIENT_SECRET=your-azure-ad-client-secret
+# MICROSOFT_CLIENT_SECRET=your-azure-ad-client-secret
 #Azure AD Tenant ID (or 'common' for multi-tenant)
-MICROSOFT_TENANT_ID=your-azure-ad-tenant-id
+# MICROSOFT_TENANT_ID=your-azure-ad-tenant-id
 #If you are using a Microsoft Entra ID tenant,
 #configure the AUTHORITY variable as
 #"https://login.microsoftonline.com/TENANT_GUID"
 #or "https://login.microsoftonline.com/contoso.onmicrosoft.com".
 #Alternatively, use "https://login.microsoftonline.com/common" for multi-tenant app.
-MICROSOFT_AUTHORITY=https://{tenantId}.ciamlogin.com/{tenantId}
+# MICROSOFT_AUTHORITY=https://{tenantId}.ciamlogin.com/{tenantId}
 
 
 # POSTGRES_URI=postgresql://docsgpt:docsgpt@localhost:5432/docsgpt
 
-# Authentication (optional - default is no auth; see docs: Deploying -> App Configuration)
+# Authentication (optional - default is no auth; see docs: Deploying -> Security)
+# No auth: every visitor shares one account. simple_jwt: one shared token, one shared user.
+# session_jwt: separates browsers, but anyone who can reach the app gets in. oidc: real per-user sign-in.
 # AUTH_TYPE=None|simple_jwt
```

**File**: `.github/workflows/docs.yml` (added, +86/-0)
```diff
@@ -0,0 +1,86 @@
+name: Docs site
+
+# Builds the documentation site on every change to docs/, checks that
+# public/llms.txt matches the sidebar, and checks every internal link and
+# #anchor in the built pages, offline. A weekly job checks the external links
+# in the docs and the top-level Markdown files; it reports and never fails.
+
+on:
+  pull_request:
+    paths:
+      - 'docs/**'
+      - '.github/workflows/docs.yml'
+  push:
+    branches: [main]
+    paths:
+      - 'docs/**'
+      - '.github/workflows/docs.yml'
+  schedule:
+    - cron: '17 6 * * 1'
+  workflow_dispatch:
+
+permissions:
+  contents: read
+
+concurrency:
+  group: docs-${{ github.event_name }}-${{ github.ref }}
+  cancel-in-progress: true
+
+jobs:
+  build:
+    name: Build and check internal links
+    if: github.event_name != 'schedule'
+    runs-on: ubuntu-latest
+    defaults:
+      run:
+        working-directory: docs
+    steps:
+      - uses: actions/checkout@de0fac2e4500dabe0009e67214ff5f5447ce83dd # v6.0.2
+        with:
+          persist-credentials: false
+
+      - uses: actions/setup-node@820762786026740c76f36085b0efc47a31fe5020 # v7.0.0
+        with:
+          node-version: 22
+          cache: npm
+          cache-dependency-path: docs/package-lock.json
+
+      - name: Install dependencies
+        run: npm ci
+
+      - name: Check that llms.txt is up to date
+        run: npm run llms:check
+
+      - name: Build the site
+        run: npm run build
+
+      - name: Check internal links and anchors
+        run: node scripts/check-links.mjs
+
+  external-links:
+    name: Check external links
+    if: github.event_name == 'schedule' || github.event_name == 'workflow_dispatch'
+    runs-on: ubuntu-latest
+    steps:
+      - uses: actions/checkout@de0fac2e4500dabe0009e67214ff5f5447ce83dd # v6.0.2
+        with:
+          persist-credentials: false
+
+      # Only http(s) links are checked: --root-dir turns the docs' root-relative
+      # links into local paths, which --scheme then leaves out (the build job
+      # covers those). Code blocks are skipped, so example URLs are not fetched.
+      - name: Check external links
+        uses: lycheeverse/lychee-action@e7477775783ea5526144ba13e8db5eec57747ce8 # v2.9.0
+        with:
+          fail: false
+          args: >-
+            --no-progress
+            --scheme https --scheme http
+            --root-dir ${{ github.workspace }}/docs/content
+            --exclude-loopback
+            --exclude '^https?://([a-z0-9-]+\.)*example\.(com|org)'
+            --exclude 'your-'
+            --accept '100..=103,200..=299,403,429'
+            --max-retries 3
+            'README.md' 'HACKTOBERFEST.md' 'CONTRIBUTING.md' 'docs/README.md'
+            'docs/content/**/*.mdx'
```

**File**: `.github/workflows/package-build.yml` (modified, +0/-2)
```diff
@@ -80,8 +80,6 @@ jobs:
               "docsgpt/Dockerfile",
               "docsgpt/requirements.txt",
               "docsgpt/requirements-docling.txt",
-              "docsgpt/index.faiss",
-              "docsgpt/index.pkl",
               "application/__init__.py",
           ):
               assert banned not in names, f"must not ship: {banned}"
```

**File**: `.github/workflows/pytest.yml` (modified, +2/-0)
```diff
@@ -24,6 +24,8 @@ jobs:
           if [ -f requirements.txt ]; then pip install -r requirements.txt; fi
           cd ../tests
           if [ -f requirements.txt ]; then pip install -r requirements.txt; fi
+      - name: Check the REST API reference snapshot is current
+        run: python -m docsgpt.api.reference --check
       - name: Test with pytest and generate coverage report
         run: |
           python -m pytest -n auto --cov=docsgpt --cov-report=xml --cov-report=term-missing
```

---

### Incident Patch 2: `5f18dbf8` (2026-09-30)
**Commit Message**: Fix the README Hacktoberfest heading and the connector and MCP server lines

The heading followed a closing </div> with no blank line, so GitHub rendered it as raw text inside the HTML block. The connector list now names every connector that syncs, and the MCP server line says what the server offers: a search_docs tool over an agent's sources.

**File**: `README.md` (modified, +4/-2)
```diff
@@ -31,6 +31,7 @@
   <br>
 <img src="https://d3dg1063dc54p9.cloudfront.net/videos/demo-26.gif" alt="video-example-of-docs-gpt" width="800" height="480">
 </div>
+
 ## 🎃 Hacktoberfest 2026
 
 DocsGPT takes part in [Hacktoberfest](https://hacktoberfest.com/) from October 1 to 31, 2026. We give away T-shirts
@@ -50,7 +51,8 @@ how to take part.
 - Documents: PDF, DOCX, XLSX, PPTX, legacy Office and OpenDocument files, RTF, CSV, EPUB, Markdown, MDX, RST, HTML,
   JSON, TXT, images, and audio (MP3, WAV, M4A, OGG, WebM), which is transcribed. Voice input works in the chat too.
 - Remote sources: URLs, sitemaps, a web crawler, GitHub, Reddit, S3 and Linear.
-- [Connectors](https://docs.docsgpt.cloud/Sources/Connectors) for Google Drive, SharePoint and Confluence that keep a source in sync.
+- [Connectors](https://docs.docsgpt.cloud/Sources/Connectors) for Google Drive, SharePoint, Confluence, GitHub, Amazon S3,
+  Reddit and Linear that keep a source in sync.
 - [GraphRAG](https://docs.docsgpt.cloud/Sources/GraphRAG) knowledge-graph retrieval and [wiki sources](https://docs.docsgpt.cloud/Sources/Wiki-sources) that an agent
   reads and keeps up to date.
 - Grounded answers with source citations.
@@ -71,7 +73,7 @@ how to take part.
 **APIs and integrations**
 - An [Agent API](https://docs.docsgpt.cloud/API/agent-api) with agent keys, an [OpenAI-compatible `/v1` API](https://docs.docsgpt.cloud/API/openai-compatible),
   [webhooks](https://docs.docsgpt.cloud/API/webhooks), [personal access tokens](https://docs.docsgpt.cloud/API/personal-access-tokens), and an
-  [MCP server](https://docs.docsgpt.cloud/API/mcp-server) that exposes your agents to MCP clients.
+  [MCP server](https://docs.docsgpt.cloud/API/mcp-server) whose `search_docs` tool lets MCP clients search an agent's sources.
 - HTML and React [chat](https://docs.docsgpt.cloud/Extensions/chat-widget) and [search](https://docs.docsgpt.cloud/Extensions/search-widget) widgets, and a
   [Chatwoot](https://docs.docsgpt.cloud/Extensions/Chatwoot-extension) bridge.
 - [Community integrations](https://docs.docsgpt.cloud/Extensions/community) in separate repos: [DocsGPT CLI](https://github.com/arc53/DocsGPT-cli)
```

---

### Incident Patch 3: `d1842702` (2026-09-30)
**Commit Message**: Keep the legacy langchain index as a test fixture

The sample index removed from docsgpt/ was also the committed legacy
fixture two faiss docstore tests read, so it now lives next to them.

**File**: `tests/vectorstore/test_faiss_docstore.py` (modified, +5/-3)
```diff
@@ -11,6 +11,7 @@
 import io
 import pickle
 import pickletools
+from pathlib import Path
 
 import pytest
 
@@ -29,6 +30,7 @@
     "id-2": {"page_content": "Postgres is a database.", "metadata": {"source": "db.txt"}},
 }
 MAPPING = {0: "id-1", 1: "id-2"}
+LEGACY_INDEX_PKL = Path(__file__).parent / "fixtures" / "legacy_langchain_index.pkl"
 
 
 def _emitted_symbols(data: bytes):
@@ -171,18 +173,18 @@ def test_empty_index(self):
 
 @pytest.mark.unit
 class TestRealLegacyFixture:
-    """The index.pkl checked into the repo was written by langchain in 2025."""
+    """A legacy index.pkl written by langchain in 2025, kept as a test fixture."""
 
     def test_reads_committed_legacy_index(self):
-        with open("docsgpt/index.pkl", "rb") as f:
+        with open(LEGACY_INDEX_PKL, "rb") as f:
             documents, mapping = load_pickle_sidecar(f.read())
         assert len(documents) == 3
         assert len(mapping) == 3
         assert all(d["page_content"] for d in documents.values())
         assert all(d["metadata"].get("title") for d in documents.values())
 
     def test_legacy_survives_conversion_to_json(self):
-        with open("docsgpt/index.pkl", "rb") as f:
+        with open(LEGACY_INDEX_PKL, "rb") as f:
             documents, mapping = load_pickle_sidecar(f.read())
         restored, restored_mapping = load_json_sidecar(
             dump_json_sidecar(documents, mapping)
```

---

### Incident Patch 4: `152034cf` (2026-09-30)
**Commit Message**: Refuse a reschedule that races the dispatcher

The PUT read the one-time task without a lock and updated it unguarded, so
a dispatch or pause between the two let it re-arm next_run_at and answer
200 while the run went ahead at the old time. The update now matches only
a task still pending in the status that was read, and answers 409 when it
no longer is.

**File**: `docsgpt/api/user/schedules/routes.py` (modified, +11/-0)
```diff
@@ -587,9 +587,20 @@ def put(self, schedule_id):
                         )
                     except ScheduleValidationError as exc:
                         return _err(str(exc))
+            # A reschedule only lands on a task that is still pending: the
+            # dispatcher may have claimed it (or someone paused it) since it
+            # was read above, and re-arming it then would lose the edit.
             updated = SchedulesRepository(conn).update(
                 schedule_id, acting, fields_in,
+                pending_once_status=(
+                    existing.get("status") if "run_at" in data else None
+                ),
             )
+            if updated is None and "run_at" in data:
+                return _err(
+                    "the task started or changed while you edited it; reload and try again",
+                    409,
+                )
         return _ok({"schedule": _format_schedule(updated or {})})
 
     @api.doc(description="Pause / resume a schedule.")
```

**File**: `docsgpt/storage/db/repositories/schedules.py` (modified, +25/-3)
```diff
@@ -242,8 +242,24 @@ def update(
         schedule_id: str,
         user_id: str,
         fields: dict,
+        *,
+        pending_once_status: Optional[str] = None,
     ) -> Optional[dict]:
-        """Apply a whitelisted partial update; return the new row or None."""
+        """Apply a whitelisted partial update; return the new row or None.
+
+        Args:
+            schedule_id: Schedule UUID.
+            user_id: The owner the row must belong to.
+            fields: Columns to set; others are ignored.
+            pending_once_status: When set, update only a one-time task still in
+                this status that the dispatcher hasn't claimed (an active task
+                must still have ``next_run_at``). Rescheduling uses it so a
+                task dispatched, paused or cancelled since it was read is left
+                alone, and ``None`` is returned instead.
+
+        Returns:
+            The updated row, or ``None`` when no row matched.
+        """
         filtered = {k: v for k, v in fields.items() if k in _ALLOWED_UPDATES}
         if not filtered:
             return self.get(schedule_id, user_id)
@@ -261,10 +277,16 @@ def update(
             else:
                 set_parts.append(f"{key} = :{key}")
                 params[key] = val
+        guard = ""
+        if pending_once_status is not None:
+            guard = " AND trigger_type = 'once' AND status = :pending_status"
+            params["pending_status"] = pending_once_status
+            if pending_once_status == "active":
+                guard += " AND next_run_at IS NOT NULL"
         sql = (
             "UPDATE schedules SET " + ", ".join(set_parts) +
-            " WHERE id = CAST(:id AS uuid) AND user_id = :user_id "
-            "RETURNING *"
+            " WHERE id = CAST(:id AS uuid) AND user_id = :user_id" + guard +
+            " RETURNING *"
         )
         row = self._conn.execute(text(sql), params).fetchone()
         return row_to_dict(row) if row is not None else None
```

**File**: `tests/api/user/test_schedules_routes.py` (modified, +58/-0)
```diff
@@ -578,6 +578,64 @@ def test_task_already_dispatched_cannot_be_rescheduled(self, app, pg_conn):
         row = SchedulesRepository(pg_conn).get(str(s["id"]), "u1")
         assert row["next_run_at"] is None
 
+    def test_dispatch_between_read_and_write_returns_409(self, app, pg_conn):
+        """The dispatcher claims the task after the PUT read it as pending."""
+        from docsgpt.api.user.schedules import routes
+
+        s = self._once(pg_conn)
+        original_run_at = SchedulesRepository(pg_conn).get(str(s["id"]), "u1")["run_at"]
+        real_schedule_for = routes._schedule_for
+
+        def read_then_dispatch(conn, schedule_id, user_id):
+            row, acting = real_schedule_for(conn, schedule_id, user_id)
+            conn.execute(
+                text(
+                    "UPDATE schedules SET next_run_at = NULL, last_run_at = now() "
+                    "WHERE id = CAST(:id AS uuid)"
+                ),
+                {"id": schedule_id},
+            )
+            return row, acting
+
+        with patch.object(routes, "_schedule_for", read_then_dispatch):
+            resp = self._put(
+                app, pg_conn, str(s["id"]),
+                {"run_at": (_now() + timedelta(hours=5)).isoformat(), "name": "moved"},
+            )
+        assert resp.status_code == 409
+        row = SchedulesRepository(pg_conn).get(str(s["id"]), "u1")
+        assert row["next_run_at"] is None
+        assert row["run_at"] == original_run_at
+        assert row["name"] is None
+
+    def test_pause_between_read_and_write_keeps_next_run_at_empty(self, app, pg_conn):
+        """A pause after the read must not be re-armed by the reschedule."""
+        from docsgpt.api.user.schedules import routes
+
+        s = self._once(pg_conn)
+        real_schedule_for = routes._schedule_for
+
+        def read_then_pause(conn, schedule_id, user_id):
+            row, acting = real_schedule_for(conn, schedule_id, user_id)
+            conn.execute(
+                text(
+                    "UPDATE schedules SET status = 'paused', next_run_at = NULL "
+                    "WHERE id = CAST(:id AS uuid)"
+                ),
+                {"id": schedule_id},
+            )
+            return row, acting
+
+        with patch.object(routes, "_schedule_for", read_then_pause):
+            resp = self._put(
+                app, pg_conn, str(s["id"]),
+                {"run_at": (_now() + timedelta(hours=5)).isoformat()},
+            )
+        assert resp.status_code == 409
+        row = SchedulesRepository(pg_conn).get(str(s["id"]), "u1")
+        assert row["status"] == "paused"
+        assert row["next_run_at"] is None
+
 
 class TestRunList:
     def test_list_owner_scoped(self, app, pg_conn):
```

---

### Incident Patch 5: `56351525` (2026-09-30)
**Commit Message**: Note the MCP path, schedule approval and one-time edit fixes and the new docs pages

**File**: `docs/content/changelog.mdx` (modified, +17/-0)
```diff
@@ -81,6 +81,23 @@ Answers render math, and the chat widget is published at 0.8.0.
   to read an empty body and return 400).
 - Docs: new API section with an overview and a REST API reference generated from the Swagger
   document, including the token scope for each endpoint.
+- DocsGPT's MCP server now answers at `/mcp` as well as `/mcp/`. Before, `/mcp` without the slash
+  returned 404 to a POST.
+
+### Schedules
+
+- The Schedules tab no longer pre-approves every tool. Tools with actions that need approval are
+  listed unticked under **Tools that need approval**, and a scheduled run performs those actions
+  without asking only for the tools you tick. Existing schedules keep their approvals; see
+  [Upgrading](/upgrading#schedules-review-the-tools-they-pre-approve).
+- Editing a one-time task's date or time in the Schedules tab now moves the task; the change used
+  to be ignored. `PUT /api/schedules/<id>` accepts `run_at` for one-time tasks, and the schedule
+  dialog shows why a save was refused.
+
+### Documentation
+
+New docs pages: Agent Schedules, MCP Server, Background Jobs and Data Retention, Custom Models, and a
+Using DocsGPT section (web app, sharing conversations, teams and sharing, analytics and logs).
 
 ### Integrations
 
```

**File**: `docs/content/upgrading.mdx` (modified, +4/-0)
```diff
@@ -258,6 +258,10 @@ The manifests in `deployment/k8s` did not work as shipped: the migration Job ran
 
 `docsgpt-api-service` is now `ClusterIP`, so the old external address stops answering. Use `kubectl port-forward service/docsgpt-api-service 7091:80`, or set `AUTH_TYPE` and `API_URL` (the public `https://` address) and publish DocsGPT through an Ingress as described in [Publish DocsGPT](/Deploying/Kubernetes-Deploying#publish-docsgpt).
 
+#### Schedules: review the tools they pre-approve
+
+Schedules created before this release still pre-approve every tool the agent had, including actions that need approval. Open each schedule in the Schedules tab: those tools show ticked under **Tools that need approval**. Untick any a scheduled run should not use without asking, then save. Saving without unticking keeps them approved.
+
 #### Swagger UI moved to /api/docs
 
 Bookmarks or scripts that opened the Swagger UI at `/` should use `/api/docs`; `/swagger.json` is unchanged.
```

---

### Incident Patch 6: `57bde7e6` (2026-09-30)
**Commit Message**: Note the Swagger UI move, the agent import fix and the API docs in the changelog

**File**: `docs/content/changelog.mdx` (modified, +9/-0)
```diff
@@ -73,6 +73,15 @@ Answers render math, and the chat widget is published at 0.8.0.
   Code Executor tools need, and `scripts/build_daytona_snapshot.py` pins the runner image's render
   library versions.
 
+### API
+
+- The Swagger UI moved from `/` to `/api/docs`, so the bundled web UI no longer hides it;
+  `/swagger.json` is unchanged, and `/` on an API without the web UI redirects to `/api/docs`.
+- Agent import accepts `curl --data-binary @file.agent.yaml` without a Content-Type header (it used
+  to read an empty body and return 400).
+- Docs: new API section with an overview and a REST API reference generated from the Swagger
+  document, including the token scope for each endpoint.
+
 ### Integrations
 
 - Chatwoot extension: verifies Chatwoot's timestamped webhook signature, sends a valid `history`,
```

**File**: `docs/content/upgrading.mdx` (modified, +4/-0)
```diff
@@ -258,6 +258,10 @@ The manifests in `deployment/k8s` did not work as shipped: the migration Job ran
 
 `docsgpt-api-service` is now `ClusterIP`, so the old external address stops answering. Use `kubectl port-forward service/docsgpt-api-service 7091:80`, or set `AUTH_TYPE` and `API_URL` (the public `https://` address) and publish DocsGPT through an Ingress as described in [Publish DocsGPT](/Deploying/Kubernetes-Deploying#publish-docsgpt).
 
+#### Swagger UI moved to /api/docs
+
+Bookmarks or scripts that opened the Swagger UI at `/` should use `/api/docs`; `/swagger.json` is unchanged.
+
 #### Azure and local Compose files removed
 
 `deployment/docker-compose-azure.yaml` and `deployment/docker-compose-local.yaml` are gone. Their replacements:
```

---

### Incident Patch 7: `15acf50b` (2026-09-30)
**Commit Message**: Fix where the API key guide sends people for a key

There is no Settings > Agents screen, and only a published agent has a key. Describe Publish and Access Details, the create_agent status rule and masked keys, and what a key holder can't do with the owner's accounts.

**File**: `docs/content/Extensions/api-key-guide.mdx` (modified, +7/-3)
```diff
@@ -9,10 +9,10 @@ DocsGPT API keys are essential for developers and users who wish to integrate th
 
 ## Obtaining Your API Key
 
-After uploading your document, you can obtain an API key either through the graphical user interface or via an API call:
+Every **published** agent has its own API key. A draft has none until you publish it.
 
-- **Graphical User Interface:** Navigate to the Settings section of the DocsGPT web app, find the Agents option, and press 'Create New' to generate a new agent (which includes an API key).
-- **API Call:** Alternatively, you can use the `/api/create_agent` endpoint to create a new agent. An API key is automatically generated for each agent. For detailed instructions, visit [DocsGPT API Documentation](https://gptcloud.arc53.com/).
+- **In the web app:** open **Agents** in the sidebar and choose **New Agent**, or open an existing agent. Configure it and press **Publish**. Then open **More actions > Access Details** to copy the **API Key**, or **Reset key** to replace it (the old key stops working at once). The same dialog holds the agent's public link and [webhook URL](/Agents/webhooks).
+- **With the API:** `POST /api/create_agent` returns a `key` only when the agent is created with `"status": "published"`; updating a draft to published creates one too. A [personal access token](/Extensions/personal-access-tokens) without the `agents:keys` scope gets the key back masked. See the [REST API reference](/API/reference#post-api-create-agent) and the [API overview](/API) for the other credentials.
 
 ## Understanding Key Variables
 
@@ -25,4 +25,8 @@ Upon creating your agent, you will encounter several key variables. Each serves
 
 With your API key ready, you can now integrate DocsGPT into your application, such as the DocsGPT Widget or any other software, via `/api/answer` or `/stream` endpoints. The source document is preset with the agent, so you don't need to send fields like `active_docs` during implementation.
 
+## What an API-key caller can do
+
+A key lets anyone who holds it chat with the agent and search its sources; the widget key in a web page is public. A key holder can't approve anything on the owner's behalf, so write actions on the owner's connected accounts or saved credentials are refused unless the owner allows them under **Access Details > Changes others can make as you**. See [Letting API callers make changes](/Agents/api#letting-api-callers-make-changes) and [Agents used through an API key](/Guides/Connectors#agents-used-through-an-api-key).
+
 Congratulations on taking the first step towards enhancing your applications with DocsGPT!
```

#### Recent Merged Pull Requests:
- **PR #2864** (2026-09-30): Make the docs match the code, and fix what following them broke (@arc53-machine)
- **PR #2863** (2026-09-29): fix: remove connect more link (@dartpain)
- **PR #2855** (2026-09-29): Roles revamp (@pabik)
- **PR #2853** (2026-09-29): Bump @babel/preset-env from 8.0.5 to 8.0.6 in /extensions/react-widget (@dependabot[bot])
- **PR #2852** (2026-09-29): Bump @typescript-eslint/eslint-plugin from 8.70.0 to 8.70.1 in /extensions/react-widget (@dependabot[bot])
- **PR #2851** (2026-09-29): Bump @typescript-eslint/parser from 8.70.0 to 8.70.1 in /frontend (@dependabot[bot])
- **PR #2850** (closed): Bump typescript from 6.0.3 to 7.0.2 in /extensions/react-widget (@dependabot[bot])
- **PR #2849** (2026-09-29): Bump prettier from 3.9.6 to 3.9.9 in /frontend (@dependabot[bot])

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
