# Forensic Learning Record (Deep Inspection): open-webui/open-webui

> **Canonical Artifact**: `07_PROJECT_LEARNING/open-webui-open-webui-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/open-webui/open-webui](https://github.com/open-webui/open-webui))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-09-30T18:36:22.910Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `open-webui/open-webui`
- **Description**: User-friendly AI Interface (Supports Ollama, OpenAI API, ...)
- **Primary Language / Ecosystem**: Python
- **Discovered Manifests / Configurations**: package.json, pyproject.toml, README.md, Dockerfile
- **Stars / Engagement**: 153638 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: package.json, pyproject.toml, README.md, Dockerfile.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `backend/open_webui/__init__.py`
```
import base64
import os
import random
import sys
from pathlib import Path
from typing import Annotated

import typer
import uvicorn

app = typer.Typer()

KEY_FILE = Path.cwd() / '.webui_secret_key'
DEFAULT_SECRET_KEY_LENGTH = 24


def version_callback(value: bool) -> None:
    if value:
        from open_webui.env import VERSION

        # LICENSE covers this Open WebUI CLI identifier.
        # Do not alter, remove, obscure, or replace it except as LICENSE permits:
        # https://docs.openwebui.com/license.
        typer.echo(f'Open WebUI version: {VERSION}')
        raise typer.Exit()


@app.command()
def main(
    version: Annotated[bool | None, typer.Option('--version', callback=version_callback)] = None,
):
    pass


@app.command()
def serve(
    host: str = '0.0.0.0',
    port: int = 8080,
):
    os.environ['FROM_INIT_PY'] = 'true'
    if os.getenv('WEBUI_SECRET_KEY') is None:
        typer.echo('Loading WEBUI_SECRET_KEY from file, not provided as an environment variable.')
        if not KEY_FILE.exists():
            key_length = int(os.getenv('WEBUI_SECRET_KEY_LENGTH', DEFAULT_SECRET_KEY_LENGTH))
            if key_length < 1:
                raise ValueError('WEBUI_SECRET_KEY_LENGTH must be a positive integer')
            typer.echo(f'Generating a new secret key and saving it to {KEY_FILE}')
            KEY_FILE.write_bytes(base64.b64encode(random.randbytes(key_length)))
        typer.echo(f'Loading WEBUI_SECRET_KEY from {KEY_FILE}')
        os.environ['WEBUI_SECRET_KEY'] = KEY_FILE.read_text()

    if os.getenv('USE_CUDA_DOCKER', 'false') == 'true':
        typer.echo('CUDA is enabled, appending LD_LIBRARY_PATH to include torch/cudnn & cublas libraries.')
        LD_LIBRARY_PATH = os.getenv('LD_LIBRARY_PATH', '').split(':')
        os.environ['LD_LIBRARY_PATH'] = ':'.join(
            LD_LIBRARY_PATH
            + [
                '/usr/local/lib/python3.11/site-packages/torch/lib',
                '/usr/local/lib/python3.11/site-packages/nvidia/cudnn/lib',
            ]
        )
        try:
            import torch

            assert torch.cuda.is_available(), 'CUDA not available'
            typer.echo('CUDA seems to be working')
        except Exception as e:
            typer.echo(
                'Error when testing CUDA but USE_CUDA_DOCKER is true. '
                'Resetting USE_CUDA_DOCKER to false and removing '
                f'LD_LIBRARY_PATH modifications: {e}'
            )
            os.environ['USE_CUDA_DOCKER'] = 'false'
            os.environ['LD_LIBRARY_PATH'] = ':'.join(LD_LIBRARY_PATH)

    import open_webui.main  # noqa: F401
    from open_webui.env import UVICORN_WORKERS, UVICORN_WS_PER_MESSAGE_DEFLATE

    # On Windows, uvicorn's default loop factory hardcodes ProactorEventLoop,
    # which is incompatible with psycopg v3 async.  Setting loop='none' lets
    # asyncio.run() respect the WindowsSelectorEventLoopPolicy set in db.py.
    loop = 'none' if sys.platform == 'win32' else 'auto'

    uvicorn.run(
        'open_webui.main:app',
        host=host,
        port=port,
        forwarded_allow_ips='*',
        workers=UVICORN_WORKERS,
        ws_per_message_deflate=UVICORN_WS_PER_MESSAGE_DEFLATE,
        loop=loop,
    )


@app.command()
def dev(
    host: str = '0.0.0.0',
    port: int = 8080,
    reload: bool = True,
):
    from open_webui.env import UVICORN_WS_PER_MESSAGE_DEFLATE

    uvicorn.run(
        'open_webui.main:app',
        host=host,
        port=port,
        reload=reload,
        forwarded_allow_ips='*',
        ws_per_message_deflate=UVICORN_WS_PER_MESSAGE_DEFLATE,
    )


if __name__ == '__main__':
    app()

```

### Core Architecture Module: `backend/open_webui/config.py`
```
from __future__ import annotations

import base64
import logging
import os
import shutil
import socket
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime
from pathlib import Path
from typing import Optional, Union
from urllib.parse import urlparse

import redis
import requests
from authlib.integrations.starlette_client import OAuth
from pydantic import BaseModel

from open_webui.env import (
    USE_SLIM,
    DATA_DIR,
    DATABASE_URL,
    ENABLE_ADMIN_CHAT_ACCESS,
    ENABLE_DB_MIGRATIONS,
    ENV,
    FRONTEND_BUILD_DIR,
    OFFLINE_MODE,
    OPEN_WEBUI_DIR,
    REDIS_KEY_PREFIX,
    REDIS_SENTINEL_HOSTS,
    REDIS_SENTINEL_PORT,
    REDIS_URL,
    WEBUI_AUTH,
    WEBUI_FAVICON_URL,
    WEBUI_NAME,
    log,
)
from open_webui.models.config import Config
from open_webui.utils.json_codec import JSONCodec


async def seed_registered_defaults():
    await Config.rename_prefix('rag.web', 'web')
    await Config.repair_config_rows()
    await Config.seed_defaults(DEFAULT_CONFIG)


async def async_reset_config():
    await Config.clear()


class EndpointFilter(logging.Filter):
    def filter(self, record: logging.LogRecord) -> bool:
        return record.getMessage().find('/health') == -1


logging.getLogger('uvicorn.access').addFilter(EndpointFilter())

####################################
# Initialization
####################################


def run_migrations():
    log.info('Running migrations')
    try:
        from alembic import command
        from alembic.config import Config as AlembicConfig

        alembic_cfg = AlembicConfig(OPEN_WEBUI_DIR / 'alembic.ini')

        migrations_path = OPEN_WEBUI_DIR / 'migrations'
        alembic_cfg.set_main_option('script_location', str(migrations_path))

        command.upgrade(alembic_cfg, 'head')
    except Exception as e:
        log.exception(f'Error running migrations: {e}')
        raise


if ENABLE_DB_MIGRATIONS:
    run_migrations()


async def import_legacy_config_json():
    """Migrate legacy config.json → database on first run."""
    if not os.path.exists(f'{DATA_DIR}/config.json'):
        return
    with open(f'{DATA_DIR}/config.json', 'r') as _f:
        await Config.upsert(JSONCodec.loads(_f.read()))
    os.rename(f'{DATA_DIR}/config.json', f'{DATA_DIR}/old_config.json')


####################################
# Static DIR
####################################

STATIC_DIR = Path(os.getenv('STATIC_DIR', OPEN_WEBUI_DIR / 'static')).resolve()

try:
    if STATIC_DIR.exists():
        for item in STATIC_DIR.iterdir():
            if item.is_file() or item.is_symlink():
                try:
                    item.unlink()
                except Exception as e:
                    pass
except Exception as e:
    pass

for file_path in (FRONTEND_BUILD_DIR / 'static').glob('**/*'):
    if file_path.is_file():
        target_path = STATIC_DIR / file_path.relative_to((FRONTEND_BUILD_DIR / 'static'))
        target_path.parent.mkdir(parents=True, exist_ok=True)
        try:
            shutil.copyfile(file_path, target_path)
        except Exception as e:
            logging.error(f'An error occurred: {e}')

# LICENSE covers copied Open WebUI logo/favicon assets.
# Do not alter, remove, obscure, or replace them except as LICENSE permits:
# https://docs.openwebui.com/license.
frontend_favicon = FRONTEND_BUILD_DIR / 'static' / 'favicon.png'

if frontend_favicon.exists():
    try:
        shutil.copyfile(frontend_favicon, STATIC_DIR / 'favicon.png')
    except Exception as e:
        logging.error(f'An error occurred: {e}')

frontend_splash = FRONTEND_BUILD_DIR / 'static' / 'splash.png'

if frontend_splash.exists():
    try:
        shutil.copyfile(frontend_splash, STATIC_DIR / 'splash.png')
    except Exception as e:
        logging.error(f'An error occurred: {e}')

frontend_loader = FRONTEND_BUILD_DIR / 'static' / 'loader.js'

if frontend_loader.exists():
    try:
        shutil.copyfile(frontend_loader, STATIC_DIR / 'loader.js')
    except Exception as e:
        logging.error(f'An error occurred: {e}')


# --- Storage Provider ---

STORAGE_PROVIDER = os.getenv('STORAGE_PROVIDER', 'local')  # defaults to local, s3
STORAGE_LOCAL_CACHE = os.getenv('STORAGE_LOCAL_CACHE', 'true').lower() == 'true'

S3_ACCESS_KEY_ID = os.getenv('S3_ACCESS_KEY_ID', None)
S3_SECRET_ACCESS_KEY = os.getenv('S3_SECRET_ACCESS_KEY', None)
S3_REGION_NAME = os.getenv('S3_REGION_NAME', None)
S3_BUCKET_NAME = os.getenv('S3_BUCKET_NAME', None)
S3_KEY_PREFIX = os.getenv('S3_KEY_PREFIX', None)
S3_ENDPOINT_URL = os.getenv('S3_ENDPOINT_URL', None)
S3_USE_ACCELERATE_ENDPOINT = os.getenv('S3_USE_ACCELERATE_ENDPOINT', 'false').lower() == 'true'
S3_ADDRESSING_STYLE = os.getenv('S3_ADDRESSING_STYLE', None)
S3_ENABLE_TAGGING = os.getenv('S3_ENABLE_TAGGING', 'false').lower() == 'true'

GCS_BUCKET_NAME = os.getenv('GCS_BUCKET_NAME', None)
GOOGLE_APPLICATION_CREDENTIALS_JSON = os.getenv('GOOGLE_APPLICATION_CREDENTIALS_JSON', None)

AZURE_STORAGE_ENDPOINT = os.getenv('AZURE_STORAGE_ENDPOINT', None)
AZURE_STORAGE_CONTAINER_NAME = os.getenv('AZURE_STORAGE_CONTAINER_NAME', None)
AZURE_STORAGE_KEY = os.getenv('AZURE_STORAGE_KEY', None)

####################################
# File Upload DIR
####################################

UPLOAD_DIR = DATA_DIR / 'uploads'
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)


####################################
# Cache DIR
####################################

CACHE_DIR = DATA_DIR / 'cache'
CACHE_DIR.mkdir(parents=True, exist_ok=True)


####################################
# CUSTOM_NAME (Legacy)
####################################

# LICENSE covers this legacy Open WebUI branding path.
# Do not alter, remove, obscure, or replace it except as LICENSE permits:
# https://docs.openwebui.com/license.
CUSTOM_NAME = os.getenv('CUSTOM_NAME', '')

if CUSTOM_NAME:
    try:
        r = requests.get(f'https://api.openwebui.com/api/v1/custom/{CUSTOM_NAME}')
        data = r.json()
        if r.ok:
            if 'logo' in data:
                WEBUI_FAVICON_URL = url = (
                    f'https://api.openwebui.com{data["logo"]}' if data['logo'][0] == '/' else data['logo']
                )

                r = requests.get(url, stream=True)
                if r.status_code == 200:
                    with open(f'{STATIC_DIR}/favicon.png', 'wb') as f:
                        r.raw.decode_content = True
                        shutil.copyfileobj(r.raw, f)

            if 'splash' in data:
                url = f'https://api.openwebui.com{data["splash"]}' if data['splash'][0] == '/' else data['splash']

                r = requests.get(url, stream=True)
                if r.status_code == 200:
                    with open(f'{STATIC_DIR}/splash.png', 'wb') as f:
                        r.raw.decode_content = True
                        shutil.copyfileobj(r.raw, f)

            WEBUI_NAME = data['name']
    except Exception as e:
        log.exception(e)
        pass


####################################
# DIRECT CONNECTIONS
####################################

ENABLE_DIRECT_CONNECTIONS = os.getenv('ENABLE_DIRECT_CONNECTIONS', 'False').lower() == 'true'
ENABLE_DIRECT_INTEGRATIONS = os.getenv('ENABLE_DIRECT_INTEGRATIONS', 'False').lower() == 'true'

####################################
# OLLAMA_BASE_URL
####################################

ENABLE_OLLAMA_API = os.getenv('ENABLE_OLLAMA_API', 'True').lower() == 'true'

OLLAMA_API_BASE_URL = os.getenv('OLLAMA_API_BASE_URL', 'http://localhost:11434/api')

OLLAMA_BASE_URL = os.getenv('OLLAMA_BASE_URL', '')
if OLLAMA_BASE_URL:
    # Remove trailing slash
    OLLAMA_BASE_URL = OLLAMA_BASE_URL[:-1] if OLLAMA_BASE_URL.endswith('/') else OLLAMA_BASE_URL


K8S_FLAG = os.getenv('K8S_FLAG', '')
USE_OLLAMA_DOCKER = os.getenv('USE_OLLAMA_DOCKER', 'false')

if OLLAMA_BASE_URL == '' and OLLAMA_API_BASE_URL != '':
    OLLAMA_BASE_URL = OLLAMA_API_BASE_URL[:-4] if OLLAMA_API_BASE_URL.endswith('/api') else OLLAMA_API_BASE_URL

if ENV == 'prod':
    if OLLAMA_BASE_URL 
```

### Core Architecture Module: `backend/open_webui/constants.py`
```
from __future__ import annotations

import errno
from enum import Enum

_ERRNO_MESSAGES = {
    errno.ENAMETOOLONG: 'File name is too long.',
    errno.ENOSPC: 'The server is out of storage space.',
    errno.EDQUOT: 'Server storage quota exceeded.',
    errno.EACCES: 'Server storage is not writable.',
    errno.EPERM: 'Server storage is not writable.',
    errno.EROFS: 'Server storage is not writable.',
}


def _error_message(err='', fallback='') -> str:
    if not err:
        return 'Something went wrong :/'
    if isinstance(err, OSError) and err.errno in _ERRNO_MESSAGES:
        return f'[ERROR: {_ERRNO_MESSAGES[err.errno]}]'
    if isinstance(err, Exception):
        return f'[ERROR: {fallback}]' if fallback else 'Something went wrong :/'
    return f'[ERROR: {err}]'


class MESSAGES(str, Enum):
    DEFAULT = lambda msg='': f'{msg if msg else ""}'
    MODEL_ADDED = lambda model='': f"The model '{model}' has been added successfully."
    MODEL_DELETED = lambda model='': f"The model '{model}' has been deleted successfully."


class WEBHOOK_MESSAGES(str, Enum):
    DEFAULT = lambda msg='': f'{msg if msg else ""}'
    USER_SIGNUP = lambda username='': f'New user signed up: {username}' if username else 'New user signed up'


class ERROR_MESSAGES(str, Enum):
    def __str__(self) -> str:
        return super().__str__()

    DEFAULT = _error_message
    ENV_VAR_NOT_FOUND = 'Required environment variable not found. Terminating now.'
    CREATE_USER_ERROR = 'Oops! Something went wrong while creating your account. Please try again later. If the issue persists, contact support for assistance.'
    DELETE_USER_ERROR = 'Oops! Something went wrong. We encountered an issue while trying to delete the user. Please give it another shot.'
    EMAIL_MISMATCH = 'Uh-oh! This email does not match the email your provider is registered with. Please check your email and try again.'
    EMAIL_TAKEN = 'Uh-oh! This email is already registered. Sign in with your existing account or choose another email to start anew.'
    USERNAME_TAKEN = 'Uh-oh! This username is already registered. Please choose another username.'
    PASSWORD_TOO_LONG = (
        'Uh-oh! The password you entered is too long. Please make sure your password is less than 72 bytes long.'
    )
    COMMAND_TAKEN = 'Uh-oh! This command is already registered. Please choose another command string.'
    FILE_EXISTS = 'Uh-oh! This file is already registered. Please choose another file.'

    ID_TAKEN = 'Uh-oh! This id is already registered. Please choose another id string.'
    MODEL_ID_TAKEN = 'Uh-oh! This model id is already registered. Please choose another model id string.'
    NAME_TAG_TAKEN = 'Uh-oh! This name tag is already registered. Please choose another name tag string.'
    MODEL_ID_TOO_LONG = 'The model id is too long. Please make sure your model id is less than 256 characters long.'

    INVALID_TOKEN = 'Your session has expired or the token is invalid. Please sign in again.'
    INVALID_CRED = 'The email or password provided is incorrect. Please check for typos and try logging in again.'
    INVALID_EMAIL_FORMAT = "The email format you entered is invalid. Please double-check and make sure you're using a valid email address (e.g., yourname@example.com)."
    INCORRECT_PASSWORD = 'The password provided is incorrect. Please check for typos and try again.'
    INVALID_TRUSTED_HEADER = (
        'Your provider has not provided a trusted header. Please contact your administrator for assistance.'
    )

    EXISTING_USERS = "You can't turn off authentication because there are existing users. If you want to disable WEBUI_AUTH, make sure your web interface doesn't have any existing users and is a fresh installation."

    UNAUTHORIZED = '401 Unauthorized'
    ACCESS_PROHIBITED = (
        'You do not have permission to access this resource. Please contact your administrator for assistance.'
    )
    ACTION_PROHIBITED = 'The requested action has been restricted as a security measure.'

    FILE_NOT_SENT = 'FILE_NOT_SENT'
    FILE_NOT_SUPPORTED = "Oops! It seems like the file format you're trying to upload is not supported. Please upload a file with a supported format and try again."

    NOT_FOUND = "We could not find what you're looking for :/"
    USER_NOT_FOUND = "We could not find what you're looking for :/"
    API_KEY_NOT_FOUND = "Oops! It looks like there's a hiccup. The API key is missing. Please make sure to provide a valid API key to access this feature."
    API_KEY_NOT_ALLOWED = 'Use of API key is not enabled in the environment.'

    MALICIOUS = 'Unusual activities detected, please try again in a few minutes.'

    PANDOC_NOT_INSTALLED = 'Pandoc is not installed on the server. Please contact your administrator for assistance.'
    INCORRECT_FORMAT = lambda err='': f'Invalid format. Please use the correct format{err}'
    RATE_LIMIT_EXCEEDED = 'API rate limit exceeded'

    MODEL_NOT_FOUND = lambda name='': f"Model '{name}' was not found"
    OPENAI_NOT_FOUND = lambda name='': 'OpenAI API was not found'
    OLLAMA_NOT_FOUND = 'WebUI could not connect to Ollama'
    CREATE_API_KEY_ERROR = 'Oops! Something went wrong while creating your API key. Please try again later. If the issue persists, contact support for assistance.'
    API_KEY_CREATION_NOT_ALLOWED = 'API key creation is not allowed in the environment.'

    EMPTY_CONTENT = 'The content provided is empty. Please ensure that there is text or data present before proceeding.'

    DB_NOT_SQLITE = 'This feature is only available with SQLite databases.'

    INVALID_URL = 'The URL you provided is invalid. Please double-check and try again.'

    WEB_SEARCH_ERROR = 'Something went wrong while searching the web.'

    OLLAMA_API_DISABLED = 'The Ollama API is disabled. Please enable it to use this feature.'

    FILE_TOO_LARGE = lambda size='': (
        f"Oops! The file you're trying to upload is too large. Please upload a file that is less than {size}."
    )

    DUPLICATE_CONTENT = 'Duplicate content detected. Please provide unique content to proceed.'
    FILE_NOT_PROCESSED = (
        'Extracted content is not available for this file. Please ensure that the file is processed before proceeding.'
    )

    INVALID_PASSWORD = lambda err='': err if err else 'The password does not meet the required validation criteria.'

    AUTOMATION_LIMIT_EXCEEDED = lambda size='': f'Automation limit reached ({size})'
    AUTOMATION_TOO_FREQUENT = lambda interval='': f'Schedule too frequent. Minimum interval is {interval} seconds.'
    AUTOMATION_INVALID_RRULE = lambda err='': f'Invalid RRULE: {err}'
    AUTOMATION_NO_FUTURE_RUNS = 'RRULE has no future occurrences'
    AUTOMATION_COUNT_REQUIRES_DTSTART = (
        'RRULE with COUNT requires an explicit DTSTART line to anchor the occurrence window'
    )
    CALENDAR_RRULE_TOO_FREQUENT = 'Recurring events cannot repeat more often than daily'

    FEATURE_DISABLED = lambda name='': f'{name} is disabled'
    INPUT_TOO_LONG = lambda size='': f'Input prompt exceeds maximum length of {size}'
    # LICENSE covers this Open WebUI error identifier.
    # Do not alter, remove, obscure, or replace it except as LICENSE permits:
    # https://docs.openwebui.com/license.
    SERVER_CONNECTION_ERROR = 'Open WebUI: Server Connection Error'
    REQUIRED_FIELD_EMPTY = lambda name='': f'Required field {name} is empty'
    OAUTH_NOT_CONFIGURED = lambda name='': f"Provider '{name}' is not configured"


class TASKS(str, Enum):
    def __str__(self) -> str:
        return super().__str__()

    DEFAULT = lambda task='': f'{task if task else "generation"}'
    TITLE_GENERATION = 'title_generation'
    FOLLOW_UP_GENERATION = 'follow_up_generation'
    TAGS_GENERATION = 'tags_generation'
    EMOJI_GENERATION = 'emoji_generation'
    QUERY_GENERATION = 'query_generation'
    IMAGE_PROMPT_GENERATION = 'image_prompt_generation'
    AUTOCOMPLETE_GENERATION = 'autocomplete_generation'
    FUNCTION_CALLING = 'function_calling'
    MOA_RESP
```

### Core Architecture Module: `backend/open_webui/env.py`
```
import datetime as dt
import importlib.metadata
import json
import logging
import os
import pkgutil
import re
import shutil
import sys
import threading
import traceback
from contextlib import nullcontext
from pathlib import Path
from typing import Any, Optional
from uuid import uuid4

import markdown
from bs4 import BeautifulSoup
from cryptography.hazmat.primitives import serialization

####################################
# Load .env file
####################################

# Use .resolve() to get the canonical path, removing any '..' or '.' components
ENV_FILE_PATH = Path(__file__).resolve()

# OPEN_WEBUI_DIR should be the directory where env.py resides (open_webui/)
OPEN_WEBUI_DIR = ENV_FILE_PATH.parent

# BACKEND_DIR is the parent of OPEN_WEBUI_DIR (backend/)
BACKEND_DIR = OPEN_WEBUI_DIR.parent

# BASE_DIR is the parent of BACKEND_DIR (open-webui-dev/)
BASE_DIR = BACKEND_DIR.parent

try:
    from dotenv import find_dotenv, load_dotenv

    load_dotenv(find_dotenv(str(BASE_DIR / '.env')))
except ImportError:
    print('dotenv not installed, skipping...')

DOCKER = os.getenv('DOCKER', 'False').lower() == 'true'
USE_SLIM = os.getenv('USE_SLIM_DOCKER', 'False').lower() == 'true'

USE_CUDA = os.getenv('USE_CUDA_DOCKER', 'false')
DEVICE_TYPE = 'cpu'
_cuda_error: Optional[str] = None

if not USE_SLIM and USE_CUDA.lower() == 'true':
    try:
        import torch  # noqa: E402

        if not torch.cuda.is_available():
            raise RuntimeError('CUDA not available')
        DEVICE_TYPE = 'cuda'
    except Exception as exc:
        _cuda_error = f'CUDA unavailable (USE_CUDA_DOCKER=true), falling back to CPU: {exc}'
        os.environ['USE_CUDA_DOCKER'] = 'false'
        USE_CUDA = 'false'

if not USE_SLIM and sys.platform == 'darwin' and DEVICE_TYPE == 'cpu':
    try:
        import torch  # noqa: E402

        if torch.backends.mps.is_available() and torch.backends.mps.is_built():
            DEVICE_TYPE = 'mps'
    except Exception:
        pass

# Torch MPS inference is not thread-safe and a concurrent call kills the whole process.
MPS_INFERENCE_LOCK = threading.Lock() if DEVICE_TYPE == 'mps' else nullcontext()

####################################
# LOGGING
####################################

_LEVEL_MAP = {
    'DEBUG': 'debug',
    'INFO': 'info',
    'WARNING': 'warn',
    'ERROR': 'error',
    'CRITICAL': 'fatal',
}


class JSONFormatter(logging.Formatter):
    """Format log records as single-line JSON objects for structured logging."""

    def format(self, record: logging.LogRecord) -> str:
        log_entry: dict[str, Any] = {
            'ts': dt.datetime.fromtimestamp(record.created, tz=dt.UTC).isoformat(timespec='milliseconds'),
            'level': _LEVEL_MAP.get(record.levelname, record.levelname.lower()),
            'msg': record.getMessage(),
            'caller': record.name,
        }

        if record.exc_info and record.exc_info[0] is not None:
            log_entry['error'] = ''.join(traceback.format_exception(*record.exc_info)).rstrip()
        elif record.exc_text:
            log_entry['error'] = record.exc_text

        if record.stack_info:
            log_entry['stacktrace'] = record.stack_info

        return json.dumps(log_entry, ensure_ascii=False, default=str)


LOG_FORMAT = os.getenv('LOG_FORMAT', '').lower()
LOGURU_DIAGNOSE = os.getenv('LOGURU_DIAGNOSE', 'False').lower() == 'true'

GLOBAL_LOG_LEVEL = os.getenv('GLOBAL_LOG_LEVEL', '').upper()
if GLOBAL_LOG_LEVEL in logging.getLevelNamesMapping():
    _log_cfg: dict[str, Any] = {'level': GLOBAL_LOG_LEVEL, 'force': True}
    if LOG_FORMAT == 'json':
        _json_handler = logging.StreamHandler(sys.stdout)
        _json_handler.setFormatter(JSONFormatter())
        _log_cfg['handlers'] = [_json_handler]
    else:
        _log_cfg['stream'] = sys.stdout
    logging.basicConfig(**_log_cfg)
else:
    GLOBAL_LOG_LEVEL = 'INFO'

log = logging.getLogger(__name__)
log.info('GLOBAL_LOG_LEVEL: %s', GLOBAL_LOG_LEVEL)

if _cuda_error:
    log.error(_cuda_error)
    _cuda_error = None

SRC_LOG_LEVELS = {}  # Legacy variable, do not remove

####################################
# ENV (dev,test,prod)
####################################

ENV = os.getenv('ENV', 'dev')

FROM_INIT_PY = os.getenv('FROM_INIT_PY', 'False').lower() == 'true'

if FROM_INIT_PY:
    PACKAGE_DATA = {'version': importlib.metadata.version('open-webui')}
else:
    try:
        PACKAGE_DATA = json.loads((BASE_DIR / 'package.json').read_text())
    except Exception:
        PACKAGE_DATA = {'version': '0.0.0'}

VERSION = PACKAGE_DATA['version']


DEPLOYMENT_ID = os.getenv('DEPLOYMENT_ID', '')
INSTANCE_ID = os.getenv('INSTANCE_ID', str(uuid4()))

ENABLE_DB_MIGRATIONS = os.getenv('ENABLE_DB_MIGRATIONS', 'True').lower() == 'true'

# Swap the JSON encoder/decoder used across the app (HTTP request bodies, JSONResponse
# bodies, upstream provider responses, socket.io payloads) from the stdlib `json` module
# to orjson. Faster, but stricter: see open_webui/utils/json_codec.py for the differences.
ENABLE_ORJSON = os.getenv('ENABLE_ORJSON', 'False').lower() == 'true'


# Function to parse each section
def parse_section(section):
    items = []
    for li in section.find_all('li'):
        # Extract raw HTML string
        raw_html = str(li)

        # Extract text without HTML tags
        text = li.get_text(separator=' ', strip=True)

        # Split into title and content
        parts = text.split(': ', 1)
        title = parts[0].strip() if len(parts) > 1 else ''
        content = parts[1].strip() if len(parts) > 1 else text

        items.append({'title': title, 'content': content, 'raw': raw_html})
    return items


try:
    changelog_path = BASE_DIR / 'CHANGELOG.md'
    with open(str(changelog_path.absolute()), encoding='utf8') as file:
        changelog_content = file.read()

except Exception:
    changelog_content = (pkgutil.get_data('open_webui', 'CHANGELOG.md') or b'').decode()

# Convert markdown content to HTML
html_content = markdown.markdown(changelog_content)

# Parse the HTML content
soup = BeautifulSoup(html_content, 'html.parser')

# Initialize JSON structure
changelog_json = {}

# Iterate over each version
for version in soup.find_all('h2'):
    version_number = version.get_text().strip().split(' - ')[0][1:-1]  # Remove brackets
    date = version.get_text().strip().split(' - ')[1]

    version_data = {'date': date}

    # Find the next sibling that is a h3 tag (section title)
    current = version.find_next_sibling()

    while current and current.name != 'h2':
        if current.name == 'h3':
            section_title = current.get_text().lower()  # e.g., "added", "fixed"
            section_items = parse_section(current.find_next_sibling('ul'))
            version_data[section_title] = section_items

        # Move to the next element
        current = current.find_next_sibling()

    changelog_json[version_number] = version_data

CHANGELOG = changelog_json

####################################
# DATA/FRONTEND BUILD DIR
####################################

DATA_DIR = Path(os.getenv('DATA_DIR', BACKEND_DIR / 'data')).resolve()

if FROM_INIT_PY:
    NEW_DATA_DIR = Path(os.getenv('DATA_DIR', OPEN_WEBUI_DIR / 'data')).resolve()
    NEW_DATA_DIR.mkdir(parents=True, exist_ok=True)

    # Check if the data directory exists in the package directory
    if DATA_DIR.exists() and DATA_DIR != NEW_DATA_DIR:
        log.info('Moving %s to %s', DATA_DIR, NEW_DATA_DIR)
        for item in DATA_DIR.iterdir():
            dest = NEW_DATA_DIR / item.name
            if item.is_dir():
                shutil.copytree(item, dest, dirs_exist_ok=True)
            else:
                shutil.copy2(item, dest)

        # Zip the data directory
        shutil.make_archive(DATA_DIR.parent / 'open_webui_data', 'zip', DATA_DIR)

        # Remove the old data directory
        shutil.rmtree(DATA_DIR)

    DATA_DIR = Path(os.getenv('DATA_DIR', OPEN_WEBUI_DIR / 'data'))

STATIC_DIR = Path(os.getenv('STATIC_DIR', OPEN_WEBUI_DIR
```

### Core Architecture Module: `backend/open_webui/events.py`
```
from __future__ import annotations

import asyncio
import inspect
import logging
import time
import uuid
from types import SimpleNamespace
from typing import Any

from open_webui.env import ENABLE_PLUGINS, VERSION
from open_webui.models.config import Config
from pydantic import BaseModel, ConfigDict, Field, model_validator
from open_webui.retrieval.web.utils import validate_url
from open_webui.utils.webhook import post_webhook

log = logging.getLogger(__name__)

MAX_STRING_LENGTH = 1000
EVENT_WEBHOOKS_CONFIG_KEY = 'events.webhooks'
LEGACY_WEBHOOK_CONFIG_KEY = 'webhook_url'
DEFAULT_WEBHOOK_ID = 'default'


class EventDefinition(BaseModel):
    model_config = ConfigDict(frozen=True)

    name: str
    description: str | None = None
    message: str | None = None

    @model_validator(mode='after')
    def defaults(self) -> 'EventDefinition':
        title = self.name.replace('.', ' ').replace('_', ' ').title()
        if self.description is None:
            object.__setattr__(self, 'description', f'{title}.')
        if self.message is None:
            object.__setattr__(self, 'message', title)
        return self


class EventDefinitions(BaseModel):
    model_config = ConfigDict(frozen=True)

    SYSTEM_STARTUP_STARTED: EventDefinition = EventDefinition(
        name='system.startup.started', description='Application startup began.', message='Startup started'
    )
    SYSTEM_STARTUP_COMPLETED: EventDefinition = EventDefinition(
        name='system.startup.completed', description='Application startup completed.', message='Startup completed'
    )
    SYSTEM_SHUTDOWN_STARTED: EventDefinition = EventDefinition(
        name='system.shutdown.started', description='Application shutdown began.', message='Shutdown started'
    )
    SYSTEM_SHUTDOWN_COMPLETED: EventDefinition = EventDefinition(
        name='system.shutdown.completed', description='Application shutdown completed.', message='Shutdown completed'
    )
    CONFIG_IMPORTED: EventDefinition = EventDefinition(
        name='config.imported', description='Configuration was imported.', message='Config imported'
    )
    CONFIG_UPDATED: EventDefinition = EventDefinition(
        name='config.updated', description='Configuration was updated.', message='Config updated'
    )
    CONFIG_WEBHOOK_UPDATED: EventDefinition = EventDefinition(
        name='config.webhook.updated',
        description='Event webhook configuration was updated.',
        message='Webhook configuration updated',
    )
    CONFIG_CONNECTIONS_UPDATED: EventDefinition = EventDefinition(
        name='config.connections.updated',
        description='Connection configuration was updated.',
        message='Config Connections updated',
    )
    CONFIG_TOOL_SERVERS_UPDATED: EventDefinition = EventDefinition(
        name='config.tool_servers.updated',
        description='Tool server configuration was updated.',
        message='Config Tool Servers updated',
    )
    CONFIG_TERMINAL_SERVERS_UPDATED: EventDefinition = EventDefinition(
        name='config.terminal_servers.updated',
        description='Terminal server configuration was updated.',
        message='Config Terminal Servers updated',
    )
    CONFIG_CODE_EXECUTION_UPDATED: EventDefinition = EventDefinition(
        name='config.code_execution.updated',
        description='Code execution configuration was updated.',
        message='Config Code Execution updated',
    )
    CONFIG_MODELS_UPDATED: EventDefinition = EventDefinition(
        name='config.models.updated', description='Model configuration was updated.', message='Config Models updated'
    )
    CONFIG_BANNERS_UPDATED: EventDefinition = EventDefinition(
        name='config.banners.updated', description='Banner configuration was updated.', message='Config Banners updated'
    )
    CONFIG_SUGGESTIONS_UPDATED: EventDefinition = EventDefinition(
        name='config.suggestions.updated',
        description='Suggestion configuration was updated.',
        message='Config Suggestions updated',
    )
    AUTH_SIGNUP: EventDefinition = EventDefinition(
        name='auth.signup', description='A user account was created through signup.', message='User signed up'
    )
    AUTH_LOGIN: EventDefinition = EventDefinition(
        name='auth.login', description='A user successfully logged in.', message='User logged in'
    )
    AUTH_LOGOUT: EventDefinition = EventDefinition(
        name='auth.logout', description='A user logged out.', message='User logged out'
    )
    AUTH_PASSWORD_CHANGED: EventDefinition = EventDefinition(
        name='auth.password_changed', description='A user password was changed.', message='Password changed'
    )
    AUTH_API_KEY_CREATED: EventDefinition = EventDefinition(
        name='auth.api_key.created', description='A user API key was created.', message='API key created'
    )
    AUTH_API_KEY_DELETED: EventDefinition = EventDefinition(
        name='auth.api_key.deleted', description='A user API key was deleted.', message='API key deleted'
    )
    AUTH_OAUTH_SESSION_DELETED: EventDefinition = EventDefinition(
        name='auth.oauth_session.deleted', description='An OAuth session was deleted.', message='OAuth session deleted'
    )
    USER_CREATED: EventDefinition = EventDefinition(
        name='user.created', description='A user account was created.', message='User created'
    )
    USER_UPDATED: EventDefinition = EventDefinition(
        name='user.updated', description='A user account was updated.', message='User updated'
    )
    USER_DELETED: EventDefinition = EventDefinition(
        name='user.deleted', description='A user account was deleted.', message='User deleted'
    )
    USER_ROLE_UPDATED: EventDefinition = EventDefinition(
        name='user.role_updated', description='A user role was updated.', message='User role updated'
    )
    USER_STATUS_UPDATED: EventDefinition = EventDefinition(
        name='user.status_updated', description='A user status was updated.', message='User status updated'
    )
    USER_SETTINGS_UPDATED: EventDefinition = EventDefinition(
        name='user.settings_updated', description='A user settings object was updated.', message='User settings updated'
    )
    USER_PROFILE_UPDATED: EventDefinition = EventDefinition(
        name='user.profile_updated', description='A user profile was updated.', message='User profile updated'
    )
    USER_PERMISSIONS_UPDATED: EventDefinition = EventDefinition(
        name='user.permissions_updated',
        description='A user permissions object was updated.',
        message='User permissions updated',
    )
    GROUP_CREATED: EventDefinition = EventDefinition(
        name='group.created', description='A group was created.', message='Group created'
    )
    GROUP_UPDATED: EventDefinition = EventDefinition(
        name='group.updated', description='A group was updated.', message='Group updated'
    )
    GROUP_DELETED: EventDefinition = EventDefinition(
        name='group.deleted', description='A group was deleted.', message='Group deleted'
    )
    GROUP_MEMBER_ADDED: EventDefinition = EventDefinition(
        name='group.member_added', description='A user was added to a group.', message='Group member added'
    )
    GROUP_MEMBER_REMOVED: EventDefinition = EventDefinition(
        name='group.member_removed', description='A user was removed from a group.', message='Group member removed'
    )
    CHAT_CREATED: EventDefinition = EventDefinition(
        name='chat.created', description='A chat was created.', message='Chat created'
    )
    CHAT_FINISHED: EventDefinition = EventDefinition(
        name='chat.finished', description='A chat response finished.', message='Chat finished'
    )
    CHAT_FAILED: EventDefinition = EventDefinition(
        name='chat.failed', description='A chat response failed.', message='Chat failed'
    )
    CHAT_IMPORTED: EventDefinition = EventDefinition(
        name='chat.imported', description='A chat was imported.', message='Chat imported'
    )
    CHA
```

### Core Architecture Module: `backend/open_webui/functions.py`
```
import asyncio
import inspect
import logging
import sys
from typing import AsyncGenerator, Generator, Iterator

from fastapi import (
    Depends,
    FastAPI,
    File,
    Form,
    HTTPException,
    Request,
    UploadFile,
    status,
)
from pydantic import BaseModel
from starlette.responses import Response, StreamingResponse

from open_webui.config import BYPASS_ADMIN_ACCESS_CONTROL
from open_webui.constants import ERROR_MESSAGES
from open_webui.env import BYPASS_MODEL_ACCESS_CONTROL, ENABLE_PLUGINS, GLOBAL_LOG_LEVEL
from open_webui.models.functions import Functions
from open_webui.models.models import Models
from open_webui.models.users import UserModel
from open_webui.socket.main import (
    get_event_call,
    get_event_emitter,
)
from open_webui.utils.access_control import check_model_access
from open_webui.utils.json_codec import JSONCodec
from open_webui.utils.misc import (
    add_or_update_system_message,
    get_last_user_message,
    openai_chat_chunk_message_template,
    openai_chat_completion_message_template,
    prepend_to_first_user_message_content,
)
from open_webui.utils.payload import (
    apply_model_params_to_body_openai,
    apply_system_prompt_to_body,
)
from open_webui.utils.plugin import (
    get_function_module_from_cache,
    load_function_module_by_id,
)

logging.basicConfig(stream=sys.stdout, level=GLOBAL_LOG_LEVEL)
log = logging.getLogger(__name__)


async def get_function_module_by_id(request: Request, pipe_id: str):
    function_module, _, _ = await get_function_module_from_cache(request, pipe_id)

    if hasattr(function_module, 'valves') and hasattr(function_module, 'Valves'):
        Valves = function_module.Valves
        valves = await Functions.get_function_valves_by_id(pipe_id)

        if valves:
            try:
                function_module.valves = Valves(**{k: v for k, v in valves.items() if v is not None})
            except Exception as e:
                log.exception(f'Error loading valves for function {pipe_id}: {e}')
                raise e
        else:
            function_module.valves = Valves()

    return function_module


async def get_function_models(request):
    if not ENABLE_PLUGINS:
        return []

    pipes = await Functions.get_functions_by_type('pipe', active_only=True)
    pipe_models = []

    for pipe in pipes:
        try:
            function_module = await get_function_module_by_id(request, pipe.id)

            has_user_valves = False
            if hasattr(function_module, 'UserValves'):
                has_user_valves = True

            # Check if function is a manifold
            if hasattr(function_module, 'pipes'):
                sub_pipes = []

                # Handle pipes being a list, sync function, or async function
                try:
                    if callable(function_module.pipes):
                        if asyncio.iscoroutinefunction(function_module.pipes):
                            sub_pipes = await function_module.pipes()
                        else:
                            sub_pipes = function_module.pipes()
                    else:
                        sub_pipes = function_module.pipes
                except Exception as e:
                    log.exception(e)
                    sub_pipes = []

                log.debug("get_function_models: function '%s' is a manifold of %s", pipe.id, sub_pipes)

                for p in sub_pipes:
                    sub_pipe_id = f'{pipe.id}.{p["id"]}'
                    sub_pipe_name = p['name']

                    if hasattr(function_module, 'name'):
                        sub_pipe_name = f'{function_module.name}{sub_pipe_name}'

                    pipe_flag = {'type': pipe.type}

                    pipe_models.append(
                        {
                            'id': sub_pipe_id,
                            'name': sub_pipe_name,
                            'object': 'model',
                            'created': pipe.created_at,
                            'owned_by': 'openai',
                            'pipe': pipe_flag,
                            'has_user_valves': has_user_valves,
                        }
                    )
            else:
                pipe_flag = {'type': 'pipe'}

                log.debug(
                    "get_function_models: function '%s' is a single pipe { 'id': %s, 'name': %s }",
                    pipe.id,
                    pipe.id,
                    pipe.name,
                )

                pipe_models.append(
                    {
                        'id': pipe.id,
                        'name': pipe.name,
                        'object': 'model',
                        'created': pipe.created_at,
                        'owned_by': 'openai',
                        'pipe': pipe_flag,
                        'has_user_valves': has_user_valves,
                    }
                )
        except Exception as e:
            log.exception(e)
            continue

    return pipe_models


async def generate_function_chat_completion(request, form_data, user, models: dict | None = None):
    if models is None:
        models = {}

    async def execute_pipe(pipe, params):
        if inspect.iscoroutinefunction(pipe):
            return await pipe(**params)
        else:
            return pipe(**params)

    async def get_message_content(res: str | Generator | AsyncGenerator) -> str:
        if isinstance(res, str):
            return res
        if isinstance(res, Generator):
            return ''.join(map(str, res))
        if isinstance(res, AsyncGenerator):
            return ''.join([str(stream) async for stream in res])

    def process_line(form_data: dict, line):
        if isinstance(line, BaseModel):
            line = line.model_dump_json()
            line = f'data: {line}'
        if isinstance(line, dict):
            line = f'data: {JSONCodec.dumps(line)}'

        try:
            line = line.decode('utf-8')
        except Exception:
            pass

        if line.startswith('data:'):
            return f'{line}\n\n'
        else:
            line = openai_chat_chunk_message_template(form_data['model'], line)
            return f'data: {JSONCodec.dumps(line)}\n\n'

    def get_pipe_id(form_data: dict) -> str:
        pipe_id = form_data['model']
        if '.' in pipe_id:
            pipe_id, _ = pipe_id.split('.', 1)
        return pipe_id

    async def get_function_params(function_module, form_data, user, extra_params=None):
        if extra_params is None:
            extra_params = {}

        pipe_id = get_pipe_id(form_data)

        # Get the signature of the function
        sig = inspect.signature(function_module.pipe)
        params = {'body': form_data} | {k: v for k, v in extra_params.items() if k in sig.parameters}

        if '__user__' in params and hasattr(function_module, 'UserValves'):
            user_valves = await Functions.get_user_valves_by_id_and_user_id(pipe_id, user.id)
            try:
                params['__user__']['valves'] = function_module.UserValves(**user_valves)
            except Exception as e:
                log.exception(e)
                params['__user__']['valves'] = function_module.UserValves()

        return params

    # Set server-side by utils/chat.py, never by client input. Mirrors the routers.
    bypass_system_prompt = getattr(request.state, 'bypass_system_prompt', False)

    # Copy so the base-model substitution below doesn't leak into the caller's
    # payload, which the tool-call continuation re-submits. Mirrors the routers.
    form_data = {**form_data}

    model_id = form_data.get('model')
    model_info = await Models.get_model_by_id(model_id)

    metadata = form_data.pop('metadata', {})

    files = metadata.get('files', [])
    tool_ids = metadata.get('tool_ids', [])
    # Check if tool_ids is None
    if tool_ids is None:
        tool_ids = []

    __event_emitter__ = None
    __event_call__ = None
    __task__ = None
    __
```

### Core Architecture Module: `backend/open_webui/internal/db.py`
```
from __future__ import annotations

import logging
import os
import re
import sys
from contextlib import asynccontextmanager, contextmanager
from datetime import datetime, timedelta, timezone
from typing import Any, Optional
from urllib.parse import parse_qs, urlencode, urlparse, urlunparse

from open_webui.env import (
    DATABASE_ENABLE_IAM_TOKEN_AUTH,
    DATABASE_ENABLE_SESSION_SHARING,
    DATABASE_ENABLE_SQLITE_WAL,
    DATABASE_POOL_MAX_OVERFLOW,
    DATABASE_POOL_RECYCLE,
    DATABASE_POOL_SIZE,
    DATABASE_POOL_TIMEOUT,
    DATABASE_SCHEMA,
    DATABASE_SQLITE_PRAGMA_BUSY_TIMEOUT,
    DATABASE_SQLITE_PRAGMA_CACHE_SIZE,
    DATABASE_SQLITE_PRAGMA_JOURNAL_SIZE_LIMIT,
    DATABASE_SQLITE_PRAGMA_MMAP_SIZE,
    DATABASE_SQLITE_PRAGMA_SYNCHRONOUS,
    DATABASE_SQLITE_PRAGMA_TEMP_STORE,
    DATABASE_URL,
    ENABLE_DB_MIGRATIONS,
    OPEN_WEBUI_DIR,
    USE_SLIM,
)
from open_webui.utils.json_codec import JSONCodec
from sqlalchemy import Dialect, MetaData, create_engine, event, types
from sqlalchemy.engine.url import make_url
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import Session, scoped_session, sessionmaker
from sqlalchemy.pool import NullPool, QueuePool
from sqlalchemy.sql.type_api import _T
from typing_extensions import Self

log = logging.getLogger(__name__)


# ── SSL URL normalization (used by sync engine & Alembic migrations) ─
#
# psycopg2 (sync) needs ``sslmode=`` in the connection string (it does
# not recognise the bare ``ssl=`` key that some ORMs emit).  The helpers
# below strip all SSL-related query params, normalise them, and
# reattach them in the canonical libpq form.
#
# The **async** engine now uses psycopg (v3), which speaks libpq
# natively, so it needs no translation at all — the DATABASE_URL is
# passed through as-is.
# ─────────────────────────────────────────────────────────────────────


def _pop_first(params: dict[str, list[str]], key: str) -> str | None:
    """Pop a single-valued query param, returning ``None`` if absent."""
    values = params.pop(key, None)
    return values[0] if values else None


def _is_postgres_url(url: str) -> bool:
    """Return True if *url* looks like a PostgreSQL connection string."""
    return bool(url) and any(url.startswith(p) for p in ('postgresql://', 'postgresql+', 'postgres://'))


def extract_ssl_params_from_url(url: str) -> tuple[str, dict[str, str]]:
    """Strip SSL query-string parameters from a PostgreSQL URL.

    Returns ``(url_without_ssl, ssl_dict)`` where *ssl_dict* maps
    canonical libpq key names (``sslmode``, ``sslrootcert``, …) to
    their values.  Non-PostgreSQL URLs are returned unchanged with an
    empty dict.
    """
    if not _is_postgres_url(url):
        return url, {}

    parsed = urlparse(url)
    qp = parse_qs(parsed.query, keep_blank_values=True)

    # Prefer sslmode (libpq canonical) over the bare ``ssl`` key.
    sslmode_val = _pop_first(qp, 'sslmode')
    ssl_val = _pop_first(qp, 'ssl')
    ssl_mode = sslmode_val or ssl_val

    ssl_dict: dict[str, str] = {}
    if ssl_mode:
        ssl_dict['sslmode'] = ssl_mode
    for key in ('sslrootcert', 'sslcert', 'sslkey', 'sslcrl'):
        val = _pop_first(qp, key)
        if val:
            ssl_dict[key] = val

    if not ssl_dict:
        return url, ssl_dict

    cleaned_query = urlencode(qp, doseq=True)
    return urlunparse(parsed._replace(query=cleaned_query)), ssl_dict


def reattach_ssl_params_to_url(url_without_ssl: str, ssl_dict: dict[str, str]) -> str:
    """Re-append SSL query-string parameters to a cleaned PostgreSQL URL.

    Used for psycopg2/libpq consumers that expect ``sslmode`` and the
    certificate-file keys in the connection string.
    """
    if not ssl_dict:
        return url_without_ssl

    parts = [f'{k}={v}' for k, v in ssl_dict.items() if v]
    if not parts:
        return url_without_ssl

    sep = '&' if '?' in url_without_ssl else '?'
    return f'{url_without_ssl}{sep}{"&".join(parts)}'


# Backwards-compatible aliases for external callers.
extract_ssl_mode_from_url = extract_ssl_params_from_url
reattach_ssl_mode_to_url = reattach_ssl_params_to_url


class JSONField(types.TypeDecorator):  # TEXT-backed JSON storage
    """Store arbitrary Python objects as JSON-encoded TEXT.

    Used instead of native JSON columns for portability across SQLite and
    PostgreSQL.  Values are serialized with ``JSONCodec.dumps`` on write and
    deserialized with ``JSONCodec.loads`` on read.
    """

    impl = types.UnicodeText
    cache_ok = True

    def process_bind_param(self, value: _T | None, dialect: Dialect) -> Any:
        return JSONCodec.dumps(value) if value is not None else None

    def process_result_value(self, value: _T | None, dialect: Dialect) -> Any:
        return JSONCodec.loads(value) if value is not None else None

    def copy(self, **kwargs: Any) -> Self:
        return JSONField(length=self.impl.length)


if USE_SLIM:
    if make_url(DATABASE_URL).get_backend_name() not in ('sqlite', 'postgresql', 'postgres'):
        raise ValueError(
            'Slim requires SQLite or PostgreSQL for DATABASE_URL. Use the standard image for other databases.'
        )
    if DATABASE_ENABLE_IAM_TOKEN_AUTH:
        raise ValueError(
            'AWS RDS IAM authentication requires the standard image. Slim supports PostgreSQL database credentials.'
        )


# Normalize SSL params from the URL once; the sync engine needs them
# reattached in canonical libpq form for psycopg2.
_url_without_ssl, _ssl_dict = extract_ssl_params_from_url(DATABASE_URL)

# For psycopg2 (sync engine), re-append sslmode + cert-file params.
SQLALCHEMY_DATABASE_URL = reattach_ssl_params_to_url(_url_without_ssl, _ssl_dict) if _ssl_dict else DATABASE_URL


class RDSIAMTokenAuth:
    _refresh_after = timedelta(minutes=14)

    def __init__(self, database_url: str) -> None:
        url = make_url(database_url)
        if not url.drivername.startswith(('postgresql', 'postgres')):
            raise ValueError('DATABASE_ENABLE_IAM_TOKEN_AUTH is only supported for PostgreSQL databases')
        if not url.host or not url.username:
            raise ValueError('DATABASE_ENABLE_IAM_TOKEN_AUTH requires a database host and user')

        self.host = url.host
        self.port = url.port or 5432
        self.username = url.username
        self._client = None
        self._token: str | None = None
        self._expires_at = datetime.min.replace(tzinfo=timezone.utc)

    @property
    def client(self):
        if self._client is None:
            import boto3

            self._client = boto3.client('rds')
        return self._client

    def get_password(self) -> str:
        now = datetime.now(timezone.utc)
        if self._token and now < self._expires_at:
            return self._token

        self._token = self.client.generate_db_auth_token(
            DBHostname=self.host,
            Port=self.port,
            DBUsername=self.username,
        )
        self._expires_at = now + self._refresh_after
        log.info('AWS RDS IAM database token refreshed; next refresh after %s', self._expires_at.isoformat())
        return self._token


_rds_iam_token_auth = RDSIAMTokenAuth(SQLALCHEMY_DATABASE_URL) if DATABASE_ENABLE_IAM_TOKEN_AUTH else None


def _set_iam_token_password(dialect, conn_rec, cargs, cparams):
    if _rds_iam_token_auth is not None:
        cparams['password'] = _rds_iam_token_auth.get_password()


def enable_iam_token_auth(connectable) -> None:
    if _rds_iam_token_auth is None:
        return

    engine = getattr(connectable, 'sync_engine', connectable)
    url = engine.url
    auth = _rds_iam_token_auth
    # The token is bound to one host/port/user pair; leave other databases on their own credentials.
    if (url.host, url.port or 5432, url.username) != (auth.host, auth.port, auth.username):
        log.warning(
            'AWS RDS IAM token auth not applied 
```

### Core Architecture Module: `backend/open_webui/main.py`
```
from __future__ import annotations

import asyncio
import copy
import logging
import mimetypes
import os
import sys
import time
from concurrent.futures import ThreadPoolExecutor
from contextlib import asynccontextmanager
from uuid import uuid4

import aiohttp
import anyio.to_thread
from cryptography.fernet import InvalidToken
from fastapi import (
    Depends,
    FastAPI,
    HTTPException,
    Request,
    applications,
    status,
)
from fastapi.middleware.cors import CORSMiddleware
from fastapi.openapi.docs import get_swagger_ui_html
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession
from starlette.datastructures import Headers
from starlette.exceptions import HTTPException as StarletteHTTPException
from starlette.middleware.sessions import SessionMiddleware
from starlette.responses import Response, StreamingResponse
from starlette_compress import CompressMiddleware
from starsessions import (
    SessionAutoloadMiddleware,
)
from starsessions import (
    SessionMiddleware as StarSessionsMiddleware,
)
from starsessions.stores.redis import RedisStore

from open_webui.config import (
    BYPASS_ADMIN_ACCESS_CONTROL,
    CACHE_DIR,
    CORS_ALLOW_ORIGIN,
    DEFAULT_LOCALE,
    ENABLE_ADMIN_ANALYTICS,
    # Admin
    ENABLE_ADMIN_CHAT_ACCESS,
    ENABLE_ADMIN_EXPORT,
    ENABLE_ONEDRIVE_BUSINESS,
    ENABLE_ONEDRIVE_PERSONAL,
    # OpenAI
    ENV,
    FRONTEND_BUILD_DIR,
    GOOGLE_DRIVE_API_KEY,
    GOOGLE_DRIVE_CLIENT_ID,
    IFRAME_CSP,
    OAUTH_PROVIDERS,
    ONEDRIVE_CLIENT_ID_BUSINESS,
    ONEDRIVE_CLIENT_ID_PERSONAL,
    ONEDRIVE_SHAREPOINT_TENANT_ID,
    ONEDRIVE_SHAREPOINT_URL,
    STATIC_DIR,
    THREAD_POOL_SIZE,
    THREAD_POOL_THREAD_NAME_PREFIX,
    WEBUI_AUTH,
    WEBUI_NAME,
    async_reset_config,
    import_legacy_config_json,
    seed_registered_defaults,
)
from open_webui.constants import ERROR_MESSAGES, TASKS
from open_webui.utils.recurrence import RecurrenceEvaluationTimeout
from open_webui.env import (
    USE_SLIM,
    AIOHTTP_CLIENT_SESSION_SSL,
    AUDIT_EXCLUDED_PATHS,
    AUDIT_INCLUDED_PATHS,
    AUDIT_LOG_LEVEL,
    BYPASS_MODEL_ACCESS_CONTROL,
    CHANGELOG,
    DEPLOYMENT_ID,
    ENABLE_AUDIT_GET_REQUESTS,
    ENABLE_COMPRESSION_MIDDLEWARE,
    ENABLE_CUSTOM_MODEL_FALLBACK,
    ENABLE_EASTER_EGGS,
    # OAuth Back-Channel Logout
    ENABLE_OAUTH_BACKCHANNEL_LOGOUT,
    ENABLE_OTEL,
    ENABLE_PLUGINS,
    ENABLE_PUBLIC_ACTIVE_USERS_COUNT,
    ENABLE_PYODIDE_FILE_PERSISTENCE,
    # SCIM
    ENABLE_SCIM,
    ENABLE_SIGNUP_PASSWORD_CONFIRMATION,
    ENABLE_STAR_SESSIONS_MIDDLEWARE,
    ENABLE_VERSION_UPDATE_CHECK,
    ENABLE_WEBSOCKET_SUPPORT,
    EXTERNAL_PWA_MANIFEST_URL,
    GLOBAL_LOG_LEVEL,
    INSTANCE_ID,
    LICENSE_KEY,
    LOG_FORMAT,
    MAX_BODY_LOG_SIZE,
    # Redis
    REDIS_KEY_PREFIX,
    REDIS_TASK_TTL,
    REDIS_URL,
    RESET_CONFIG_ON_START,
    SAFE_MODE,
    SCIM_TOKEN,
    VERSION,
    WEBSOCKET_HEARTBEAT_INTERVAL,
    WEBSOCKET_MANAGER,
    # Admin Account Runtime Creation
    WEBUI_ADMIN_EMAIL,
    WEBUI_ADMIN_NAME,
    WEBUI_ADMIN_PASSWORD,
    WEBUI_AUTH_TRUSTED_EMAIL_HEADER,
    WEBUI_BUILD_HASH,
    WEBUI_SECRET_KEY,
    WEBUI_SESSION_COOKIE_SAME_SITE,
    WEBUI_SESSION_COOKIE_SECURE,
)
from open_webui.events import (
    EVENTS,
    delete_event_webhook,
    get_event_webhooks,
    migrate_legacy_webhook_config,
    publish_event,
    upsert_event_webhook,
)
from open_webui.events import (
    get_event_catalog as get_event_catalog_items,
)
from open_webui.internal.db import engine, get_async_session
from open_webui.models.access_grants import AccessGrants
from open_webui.models.channels import Channels
from open_webui.models.chats import ChatForm, Chats
from open_webui.models.config import Config
from open_webui.models.functions import Functions
from open_webui.models.messages import Messages
from open_webui.models.models import Models, normalize_model_tags
from open_webui.models.users import Users
from open_webui.routers import (
    analytics,
    audio,
    auths,
    automations,
    calendar,
    channels,
    chats,
    configs,
    evaluations,
    files,
    folders,
    functions,
    groups,
    images,
    knowledge,
    memories,
    models,
    notes,
    notifications,
    ollama,
    openai,
    pipelines,
    prompts,
    retrieval,
    scim,
    skills,
    tasks,
    terminals,
    tools,
    users,
    utils,
)
from open_webui.routers.retrieval import (
    get_ef,
    get_embedding_function,
    get_reranking_function,
    get_rf,
)
from open_webui.socket.main import (
    MODELS,
    get_event_emitter,
    get_models_in_use,
    get_user_id_from_session_pool,
    periodic_session_pool_cleanup,
    periodic_usage_pool_cleanup,
    redis_event_listener,
)
from open_webui.socket.main import (
    app as socket_app,
)
from open_webui.tasks import (
    cleanup_task,
    create_task,
    has_active_tasks,
    list_task_ids_by_item_id,
    list_tasks,
    redis_task_command_listener,
    redis_task_heartbeat,
    stop_item_tasks,
    stop_task,
)  # Import from tasks.py
from open_webui.utils import logger
from open_webui.utils.access_control import has_permission
from open_webui.utils.access_control.folders import has_folder_write_access
from open_webui.utils.actions import chat_action as chat_action_handler
from open_webui.utils.asgi_middleware import AppHTTPMiddleware
from open_webui.utils.audit import AuditLevel, AuditLoggingMiddleware
from open_webui.utils.auth import (
    create_admin_user,
    decode_token,
    get_admin_user,
    get_http_authorization_cred,
    get_license_data,
    get_verified_user,
)
from open_webui.utils.chat import (
    chat_completed as chat_completed_handler,
)
from open_webui.utils.chat import (
    generate_chat_completion as chat_completion_handler,
)
from open_webui.utils.chat_id import (
    get_temporary_chat_session_id,
    is_saved_chat_id,
    is_temporary_chat_id,
)
from open_webui.utils.chat_variables import (
    normalize_chat_variables,
)
from open_webui.utils.embeddings import generate_embeddings
from open_webui.utils.json_codec import JSONCodec
from open_webui.utils.json_response import apply_orjson_http_json
from open_webui.utils.logger import start_logger
from open_webui.utils.middleware import (
    background_tasks_handler,
    build_chat_response_context,
    drain_approved_tool_calls,
    process_chat_payload,
    process_chat_response,
)
from open_webui.utils.misc import get_response_error_detail, merge_model_params
from open_webui.utils.model_ids import strip_provider_model_prefix
from open_webui.utils.models import (
    check_model_access,
    get_all_base_models,
    get_all_models,
    get_filtered_models,
)
from open_webui.utils.oauth import (
    OAuthClientInformationFull,
    OAuthClientManager,
    OAuthManager,
    apply_connection_oauth_options,
    decrypt_data,
    encrypt_data,
    get_oauth_client_info_with_dynamic_client_registration,
    get_oauth_client_info_with_static_credentials,
    recover_static_oauth_client_metadata,
    resolve_oauth_client_info,
)
from open_webui.utils.plugin import install_tool_and_function_dependencies
from open_webui.utils.redis import get_redis_client
from open_webui.utils.session_pool import cleanup_response, get_client_timeout, get_session, stream_wrapper
from open_webui.utils.tool_approval import (
    ResolveToolCallForm,
    build_tool_approval_resume_payload,
    resolve_tool_call_output,
)
from open_webui.utils.tools import set_terminal_servers, set_tool_servers

if SAFE_MODE:
    print('SAFE MODE ENABLED')
    # Functions.deactivate_all_functions() is awaited in lifespan below

logging.basicConfig(stream=sys.stdout, level=GLOBAL_LOG_LEVEL)
log = logging.getLogger(__name__)


async def emit_chat_list_event(metadata: dict, chat_id: str):
    if not is_saved_chat_id(chat_id):
        return

    event_emitter 
```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #31648** (2026-09-30): **issue: new files silently lose their chat link when sent together with a file already in the chat**
  *Symptoms*: ### Before Submitting  - [x] I searched open and closed issues and discussions for an existing report. - [x] I reproduced this bug on the latest release AND on the current `dev` branch, right before submitting this report. I did not just check an old version or rely on a check from days ago. - [x] I understand that maintainers want a well-written issue before any code pull request. - [x] This is not a security vulnerability.  **Installation Method:** Docker (single container, SQLite backend) **Open WebUI Version:** v0.11.4 (latest release) — runtime repro today; bug line confirmed unchanged on `dev` @ `a5bc78300e9eb93f379f93665ab68b618dbcb021` (`models/chats.py:2589`) at submission time **Operating System:** Ubuntu 24.04 LTS (container host) **Browser:** N/A — server-side model-layer bug, no browser involvement **Ollama Version:** N/A (vLLM backend; not involved)  ### Summary  `ChatFile.insert_chat_files` (`backend/open_webui/models/chats.py`) intends to skip files already linked to a chat — the comment says so — but it builds its "existing" set from the wrong field:  ```python chat_message_file_ids = {     item.id for item in await self.get_chat_files_by_chat_id_and_message_id(chat_id, message_id, db=db) } # Remove duplicates and existing file_ids file_ids = list({file_id for file_id in file_ids if file_id and file_id not in chat_message_file_ids}) ```  `item` is a `ChatFileModel` for an existing `chat_file` row, and `item.id` is that row's own primary key — a fresh `uuid4` 
  **Post-Mortem & Fix Analysis**:
  > <!-- terminator-bot:related-issues-reply --> 🔍 **Related Issues Found**  I found some existing issues that might be related. Please check if any of these are duplicates or contain helpful solutions:  1. 🟣 [#20964](https://github.com/open-webui/open-webui/issues/20964) **issue: psycopg2.errors.UniqueViolation: duplicate key value violates unique constraint "uq_chat_file_chat_file"**    *This is the closest match: it reports the same unique constraint name `uq_chat_file_chat_file` on `(chat_id, file_id)`. Your issue explains a specific code path that can trigger that duplicate insert and then silently swallow the error.*    *by Abdelrahman1993 · `bug`*  2. 🟣 [#31455](https://github.com/open-webui/open-webui/issues/31455) **issue: deleting chats leaves dangling chat_file links, orphaned file rows, and leaked uploads on disk**    *It concerns `chat_file` lifecycle bugs and data integrity around chat-file links. While the symptom is deletion leakage rather than duplicate inserts, it is d
  > https://github.com/open-webui/open-webui/pull/31650

- **Issue #31643** (2026-09-30): **issue: Artifact Preview window snapping closed despite Detect Artifacts Flag**
  *Symptoms*: ### Before Submitting  - [x] I searched open and closed issues and discussions for an existing report. - [x] I reproduced this bug on the latest release AND on the current `dev` branch, right before submitting this report. I did not just check an old version or rely on a check from days ago. - [x] I understand that maintainers want a well-written issue before any code pull request. - [x] This is not a security vulnerability.  ### Installation Method  Docker  ### Open WebUI Version  v0.11.1  ### Operating System  macOS Tahoe 26.6.2  ### Browser  Chrome 153.0.8010.53  ### Ollama Version  _No response_  ### Summary  When "Always Collapse Code Blocks" is selected in interface settings, and the following Artifact and iframe rendering settings are enabled: Detect Artifacts Automatically iframe Sandbox Allow Scripts iframe Sandbox Allow Same Origin Always Collapse Code Blocks  The artifact preview in this use case is the result of a global filter that is applied to the prompt before submitted to the models. If it detects certain values in the prompt, it responds with an HTML in-line code block. The interface detects the HTML artifact and pops the preview window open, but then immediately closes it.  The artifact preview pane will open quickly and then close again.   ### Expected Behavior  The preview pane should pop open and remain open. This behavior worked correctly in this configuration in v0.11.0, but breaks in all version from v0.11.1 up to the current dev branch release.   ###
  **Post-Mortem & Fix Analysis**:
  > <!-- terminator-bot:related-issues-reply --> 🔍 **Related Issues Found**  I found some existing issues that might be related. Please check if any of these are duplicates or contain helpful solutions:  1. 🟣 [#27399](https://github.com/open-webui/open-webui/issues/27399) **issue: Artifacts panel force-reopens on every streamed token while generating; cannot be closed mid-generation**    *This is the closest behavioral match: the artifacts panel repeatedly reopens during streaming because artifact state is being toggled on each update. Your issue also involves artifact auto-opening/closing unexpectedly, and the root cause is likely in the same `ContentRenderer` artifact-detection flow.*    *by soonlaii-upskill · `bug`, `confirmed issue`*  2. 🟣 [#25752](https://github.com/open-webui/open-webui/issues/25752) **bug: Artifact panel does not auto-open for HTML generated by outlet filter functions**    *This issue is about artifact auto-opening when HTML is introduced by a filter function rat
  > https://github.com/open-webui/open-webui/pull/31652  https://github.com/open-webui/open-webui/pull/31653

- **Issue #31640** (2026-09-30): **issue: native MCP tool calls have no configurable timeout (AIOHTTP_CLIENT_TIMEOUT_TOOL_SERVER is never applied)**
  *Symptoms*: ## Check Existing Issues  - [x] I have searched the existing issues and discussions.  ## Installation Method  Docker (`ghcr.io/open-webui/open-webui:v0.11.3`)  ## Open WebUI Version  v0.11.3 (same code on `main` and `dev` as of 2026-09-30)  ## Bug Summary  `AIOHTTP_CLIENT_TIMEOUT_TOOL_SERVER` is meant to bound tool server calls, and `utils/mcp/client.py` documents a fallback to it for MCP transports. In practice the fallback is never taken for native MCP connections, and nothing bounds `call_tool`. A hanging MCP server blocks the chat request until the TCP connection is closed by something else (reverse proxy / ingress timeout, or the SDK's 300 s read timeout if the server sends nothing at all).  ## Root cause  1. `MCPClient.connect()` calls    `streamablehttp_client(url, headers=headers, httpx_client_factory=create_httpx_client)`    without `timeout` / `sse_read_timeout`. 2. In `mcp==1.27.2`, `streamablehttp_client` defaults to `timeout=30`,    `sse_read_timeout=300` and always calls the factory with    `timeout=httpx.Timeout(30, read=300)`. 3. `_build_httpx_client` only falls back to `AIOHTTP_CLIENT_TIMEOUT_TOOL_SERVER` when    `timeout is None`, which never happens on this path. 4. `MCPClient.call_tool` calls `self.session.call_tool(function_name, function_args)`    without `read_timeout_seconds`, the `ClientSession` is created without a session read    timeout, and there is no `asyncio.wait_for` / `anyio.fail_after` around the tool    callable in `utils/middleware.py`. 5.
  **Post-Mortem & Fix Analysis**:
  > <!-- terminator-bot:related-issues-reply --> 🔍 **Related Issues Found**  I found some existing issues that might be related. Please check if any of these are duplicates or contain helpful solutions:  1. 🟣 [#25001](https://github.com/open-webui/open-webui/issues/25001) **issue: MCPClient initialize timeout hardcoded to 10s — production MCP servers fail with "Failed to connect"**    *This is directly related because it documents another MCP timeout problem in the same client path: `initialize()` is hardcoded to 10s and lacks configurability. Your issue is the analogous missing timeout for native `call_tool`, so both concern absent/incorrect timeout propagation in MCPClient.*    *by KingsleyOWO · `bug`*  2. 🟣 [#26860](https://github.com/open-webui/open-webui/issues/26860) **issue: Native MCP tool call never dispatched to server — chat hangs indefinitely on "Executing…"**    *This issue is closely related because it also describes native MCP tool calls hanging in the Open WebUI dispatch
  > https://github.com/open-webui/open-webui/pull/31641

- **Issue #31638** (2026-09-30): **issue: In dev branch, expired jwt does not redirect user to auth screen**
  *Symptoms*: ### Before Submitting  - [x] I searched open and closed issues and discussions for an existing report. - [x] I reproduced this bug on the latest release AND on the current `dev` branch, right before submitting this report. I did not just check an old version or rely on a check from days ago. - [x] I understand that maintainers want a well-written issue before any code pull request. - [x] This is not a security vulnerability.  ### Installation Method  Docker  ### Open WebUI Version  dev - latest  ### Operating System  Ubuntu 24.04  ### Browser  _No response_  ### Ollama Version  _No response_  ### Summary  I am forced to use the dev branch since there is a fix for the double JWT refresh token leading to cascade failure.  My user is not redirected to auth screen when its token expires.  ### Expected Behavior  When the token expires i should be redirected to auth screen  ### Actual Behavior  I stay on openwebui, i can browse chats but requesting models fails (but it is linked to our configuration which uses system_oauth)  ### Steps to Reproduce  1. Start openwebui in dev branch with OIDC configured 2. Set-up an external API (in my case via OPENAI_API_CONFIGS env variable and "auth_type" : "system_oauth") 3. Connect to OpenWebUI and expires your token 4. Try interacting with openwebui  ### Logs, Screenshots, and Config  {"ts": "2026-09-30T12:20:47.832+00:00", "level": "debug", "msg": "Token refresh needed for user dc25ef5c-1ebc-4af3-9eb9-9cb871583b9c, provider oidc", "caller": "o
  **Post-Mortem & Fix Analysis**:
  > This is expected behaviour, and it is the same on the release and on dev. Your Open WebUI login and the session at your identity provider are two separate things. The Open WebUI login lasts as long as `JWT_EXPIRES_IN` (4 weeks by default). The provider's tokens are only stored so they can be sent to connections like your `system_oauth` one.  In your log the provider rejected the refresh with "Token is not active", which means the session on its side had already ended. Open WebUI then drops the stored tokens, so that connection has nothing left to send. Your Open WebUI login is still valid, so there is no reason to send you to the login page.  What you can do today: set `JWT_EXPIRES_IN` to the same lifetime as the session at your provider (in Keycloak that is SSO Session Max). The Open WebUI login then ends at roughly the same time and you get sent to the login page. This does not cover the provider's idle timeout, which can still end its session sooner.

- **Issue #31610** (2026-09-29): **issue: Web search never triggered in v0.11.4 (desktop app, Windows) - no search request sent**
  *Symptoms*: ### Before Submitting  - [x] I searched open and closed issues and discussions for an existing report. - [x] I reproduced this bug on the latest release AND on the current `dev` branch, right before submitting this report. I did not just check an old version or rely on a check from days ago. - [x] I understand that maintainers want a well-written issue before any code pull request. - [x] This is not a security vulnerability.  ### Installation Method  Other  ### Open WebUI Version  v0.11.4  ### Operating System  Windows 10  ### Browser  _No response_  ### Ollama Version  v0.34.3  ### Summary  ## Bug Description  Web search is fully enabled in admin settings and in the model's capabilities,  but no search request is ever sent. The chat completion request goes straight  to the LLM backend with no retrieved context.  The server log shows `POST /api/chat/completions` with no preceding search or  fetch call. No error is raised.  ### Expected Behavior  ## Expected Behavior  A search request is issued and retrieved page content is injected into the prompt.    ### Actual Behavior  ## Actual Behavior  No search is performed. The model answers from its training data.  Ollama logs show the prompt contains only the user question (27 tokens),  confirming no context was injected.  ### Steps to Reproduce  ## Steps to Reproduce  1. Admin Panel > Settings > Web Search: enable, engine `duckduckgo`, results = 2 2. Model settings > Capabilities: "Web Search" checked 3. Model settings > Default Fe
  **Post-Mortem & Fix Analysis**:
  > <!-- terminator-bot:related-issues-reply --> 🔍 **Related Issues Found**  I found some existing issues that might be related. Please check if any of these are duplicates or contain helpful solutions:  1. 🟣 [#31350](https://github.com/open-webui/open-webui/issues/31350) **issue: Web Search toggle in chat bypassed when function_calling is 'default' or 'native'`**    *This is the closest functional match: it reports that Web Search is skipped entirely when `function_calling` is `default` or `native`, causing no search request to be sent and the prompt going straight to the LLM. Your issue also describes web search being enabled but never triggered.*    *by MoultonLava · `bug`*  2. 🟣 [#31344](https://github.com/open-webui/open-webui/issues/31344) **issue: KeyError: 'model' in background_tasks_handler during run_initial_title_generation**    *Both issues mention the same `background_tasks_handler` `KeyError: 'model'` seen in the logs. While this issue is about title-generation background 
  > Same as #31350, which covers this exact setup. With Function Calling on Default or Native (they are the same setting), turning on Web Search gives the model a search tool and the model decides whether to call it. Small local models often never call it, so nothing gets searched and the prompt reaches the model with only your question. Open WebUI runs the search itself before the model answers only when Function Calling is set to Legacy.  Two options today: 1. Set **Function Calling** to **Legacy** on that model (Admin Panel > Settings > Models, edit the model, Advanced Params). Legacy is unsupported and the model loses the other builtin tools, but the search then runs every time the toggle is on. 2. Use a model that handles tool calling well: https://docs.openwebui.com/getting-started/essentials#tool-calling-native-vs-legacy  This exact symptom is covered here: https://docs.openwebui.com/troubleshooting/web-search  The KeyError 'model' on every new chat is unrelated. It is #30339, fixed
  > In Default/Native mode the model decides whether to search, and small local models often don't. Set Function Calling to Legacy on the model, or use a model that handles tool calling: https://docs.openwebui.com/troubleshooting/web-search  The KeyError line in your log no longer exists on dev, so this was not reproduced on dev.  PLEASE search for issues before opening

- **Issue #31608** (2026-09-29): **issue: Changing model-specific compaction settings applies to all models**
  *Symptoms*: ### Before Submitting  - [x] I searched open and closed issues and discussions for an existing report. - [x] I reproduced this bug on the latest release AND on the current `dev` branch, right before submitting this report. I did not just check an old version or rely on a check from days ago. - [x] I understand that maintainers want a well-written issue before any code pull request. - [x] This is not a security vulnerability.  ### Installation Method  Docker  ### Open WebUI Version  v0.11.4  ### Operating System  Devuan (Debian 13, kernel 6.12.74)  ### Browser  Brave 1.95.101  ### Ollama Version  n/a  ### Summary  Under Settings -> Experience -> Interface, the various compaction settings can't actually be changed per-model. Choosing a specific model and saving changes applies those changes to all models, plus the "Current model" selection. This applies to Token Threshold, Token Cap, and Retained Messages, I don't use a compaction prompt so I didn't check that.  ### Expected Behavior  Only the selected model's settings should be modified.  I suppose it's an open question what "Current model" should do, I had always thought of that as a default before I ran into the need to have different settings (normally I run with YaRN, but I'm experimenting with the TensorFold backend which doesn't currently support YaRN).  ### Actual Behavior  All settings update to match any changes.  ### Steps to Reproduce  1. Open Settings -> Experience -> Interface 2. Choose a model 3. Modify Token Thr
  **Post-Mortem & Fix Analysis**:
  > <!-- terminator-bot:related-issues-reply --> 🔍 **Related Issues Found**  I found some existing issues that might be related. Please check if any of these are duplicates or contain helpful solutions:  1. 🟣 [#27603](https://github.com/open-webui/open-webui/issues/27603) **issue: Compaction "Current Model" does not utilize the current chat model**    *Related to the same compaction settings area and model selection behavior. It reports that the 'Current Model' compaction option does not follow the active chat model, which is part of the same UI section and may share the same model-scoping bug path.*    *by knguyen298 · `bug`, `confirmed issue`*  2. 🟣 [#30269](https://github.com/open-webui/open-webui/issues/30269) **issue: the Context Compaction Threshold in General settings is never saved**    *This is another compaction settings bug in the same admin/settings flow, showing that compaction parameters are not being persisted correctly. It is relevant because the new issue is also about 
  > Those values are global by design, they are not scoped to whichever model is selected in that section. The model dropdown there only chooses which model writes the compaction summaries; "Current Model" means it follows the chat's model.  The per-model option that does exist is the Context Compaction Threshold advanced parameter on the model itself (Workspace Or Admin Settings > Models > edit the model > Advanced Parameters). It overrides the global threshold for that model only, capped by Token Cap. Token Cap and Retained Messages have no per-model override, they are global for everyone.  https://docs.openwebui.com/reference/env-configuration/#context_compaction_token_threshold
  > thanks

- **Issue #31605** (2026-09-29): **bug: Recurring calendar events overlapping the start of a requested range are omitted**
  *Symptoms*: ### Before Submitting  - [x] I searched open and closed issues and discussions for an existing report. - [x] I reproduced this bug on the latest release AND on the current `dev` branch, right before submitting this report. I did not just check an old version or rely on a check from days ago. - [x] I understand that maintainers want a well-written issue before any code pull request. - [x] This is not a security vulnerability.  ### Installation Method  Git Clone  ### Open WebUI Version  Latest release: `v0.11.4` (`8bd8b4fac5e059578ac0c74b3c18d11139f88b7d`)  Current dev: `176d31d1db2f8f803a6fda3013c4df5578be9fb4`  The issue was reproduced on both immediately before submission.  ### Operating System  macOS 26.6.2 ARM64  ### Browser  Not applicable. Reproduced through the real FastAPI calendar routes using an isolated integration test environment.  ### Ollama Version  Not applicable.  ### Summary  A recurring calendar event that overlaps the beginning of a requested calendar range is omitted, while an otherwise identical non-recurring event is returned.  This was reproduced on both the latest release, `v0.11.4`, and current `dev` using the real calendar HTTP API routes, real SQLAlchemy records, isolated SQLite databases, and temporary application directories.  For example, an event running from September 28 at 23:00 UTC to September 29 at 01:00 UTC is returned when non-recurring, but omitted when configured with `FREQ=WEEKLY` and queried for September 29.  ### Expected Behavior  R
  **Post-Mortem & Fix Analysis**:
  > <!-- terminator-bot:related-issues-reply --> 🔍 **Related Issues Found**  I found some existing issues that might be related. Please check if any of these are duplicates or contain helpful solutions:  1. 🟢 [#30970](https://github.com/open-webui/open-webui/issues/30970) **issue: saving a repeating calendar event opened from a later occurrence deletes every earlier occurrence**    *This issue is about recurring calendar events being mishandled when a later occurrence is treated as the series start. Both reports involve recurring-event series boundaries being wrong, which can cause valid earlier-overlapping occurrences to disappear from calendar queries.*    *by silentoplayz · `bug`, `confirmed issue`*  2. 🟢 [#31600](https://github.com/open-webui/open-webui/issues/31600) **bug: Scheduled Tasks calendar shows extra occurrences for COUNT-limited automations after a run**    *This report concerns recurring calendar occurrences not matching the expected recurrence expansion in the Scheduled
  > Thanks — I checked these.  #30970 is related to recurrence-series boundaries when editing a later occurrence, but this issue reproduces without editing and is specifically about range-overlap filtering.  #31600 affects Scheduled Tasks automation recurrence and `COUNT` handling, while this report concerns stored recurring calendar events being omitted from range queries.  #27774 is a timezone-offset issue; this one reproduces entirely in UTC.  So these appear related to the same calendar recurrence area, but I don’t believe any of them describe the same failure mode.
  > https://github.com/open-webui/open-webui/pull/31606

- **Issue #31600** (2026-09-30): **bug: Scheduled Tasks calendar shows extra occurrences for COUNT-limited automations after a run**
  *Symptoms*: ### Before Submitting  - [x] I searched open and closed issues and discussions for an existing report. - [x] I reproduced this bug on the latest release AND on the current `dev` branch, right before submitting this report. I did not just check an old version or rely on a check from days ago. - [x] I understand that maintainers want a well-written issue before any code pull request. - [x] This is not a security vulnerability.  ### Installation Method  Git Clone  ### Open WebUI Version  Latest release: v0.11.4 (8bd8b4fac5e059578ac0c74b3c18d11139f88b7d) Current dev: 176d31d1db2f8f803a6fda3013c4df5578be9fb4  ### Operating System  macOS 26.6.2 ARM64  ### Browser  Not applicable — reproduced through backend HTTP API routes.  ### Ollama Version  Not applicable — no Ollama connection or model execution is required.  ### Summary  The Scheduled Tasks calendar displays occurrences beyond an automation's RRULE COUNT limit after the scheduler advances the automation's next_run_at.  This was reproduced immediately before submission on:  Latest release: v0.11.4 (8bd8b4fac5e059578ac0c74b3c18d11139f88b7d)  Current dev: 176d31d1db2f8f803a6fda3013c4df5578be9fb4  The reproduction used the real automation and calendar HTTP API routes, real SQLAlchemy records, an isolated SQLite database, and the real scheduler claim and recurrence functions. No browser interaction, Ollama connection, or LLM execution is required.  ### Expected Behavior  Calendar occurrences should match the remaining occurrences 
  **Post-Mortem & Fix Analysis**:
  > # ⚠️ Missing Issue Title Prefix  @bahar-daryosh, your issue title is missing a categorising prefix (e.g. `bug:`, `feat:`, `docs:`).  Please update the title to lead with one of: - **bug**: bug report or error - **feat**: feature request or enhancement - **docs**: documentation issue - **question**: usage question - **help**: support request  Example: `bug: Login fails when the password contains special characters`
  > <!-- terminator-bot:related-issues-reply --> 🔍 **Related Issues Found**  I found some existing issues that might be related. Please check if any of these are duplicates or contain helpful solutions:  1. 🟣 [#27780](https://github.com/open-webui/open-webui/issues/27780) **issue: automations with COUNT but no DTSTART never stop running because every claim reanchors the rule**    *This is the closest match: it also involves COUNT-based automations and recurrence being re-anchored on each claim. Your issue differs in that the scheduler still stops correctly, while the calendar expansion shows extra occurrences, but both point to COUNT semantics being affected by moving the rule anchor.*    *by silentoplayz · `bug`, `confirmed issue`*  2. 🟣 [#29066](https://github.com/open-webui/open-webui/issues/29066) **bug: Model cannot create recurring events**    *This is only loosely related. It concerns recurrence handling for calendar/event creation, so it touches the same calendar/rrule area, but
  > Thanks — I reviewed both reports.  #27780 is closely related in terms of recurrence anchoring, but it describes a different observable bug. In #27780, an automation without `DTSTART` is re-anchored during scheduler claims and never stops executing.  This report uses an explicit `DTSTART`, and the scheduler correctly exhausts the original `COUNT`-limited schedule. The mismatch occurs only while generating the `__scheduled_tasks__` calendar overlay:  ```text After first claim: Scheduler: Jan 2, Jan 3 Calendar:  Jan 2, Jan 3, Jan 4 ```  No extra automation executions occur. The extra dates are calendar-only occurrences produced after `next_run_at` advances while the original `COUNT` is retained.  #29066 concerns the creation of recurring calendar events rather than the display of remaining automation occurrences.  I’ll keep this issue open unless the maintainers prefer consolidating these separate scheduler and calendar behaviors. 

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

### Incident Patch 1: `9530cc15` (2026-09-21)
**Commit Message**: i18n: restore placeholder names that were translated or lost their braces (#30326)

{{ models }} -> {{ modelli }} etc. in 10 locales, {{name}} -> {{nombre}} in
gl-ES, {{file}} -> {{arxiu}} in ca-ES, and single/unbalanced braces in kab-DZ,
nb-NO and ca-ES. 22 strings in 13 locales, tokens only.

**File**: `src/lib/i18n/locales/bs-BA/translation.json` (modified, +1/-1)
```diff
@@ -5,7 +5,7 @@
 	"[Last] dddd [at] h:mm A": "[Prošle sedmice:] dddd [u] h:mm A",
 	"[Today at] h:mm A": "[Danas u] h:mm A",
 	"[Yesterday at] h:mm A": "[Jučer u] h:mm A",
-	"{{ models }}": "{{ modeli }}",
+	"{{ models }}": "{{ models }}",
 	"{{count}} added lines_one": "",
 	"{{count}} added lines_few": "",
 	"{{count}} added lines_other": "",
```

**File**: `src/lib/i18n/locales/ca-ES/translation.json` (modified, +3/-3)
```diff
@@ -1747,7 +1747,7 @@
 	"Quick Actions": "Accions ràpides",
 	"Ran {{COUNT}} analyses": "S'han executat {{COUNT}} anàlisis",
 	"Ran {{COUNT}} analysis": "S'han executat {{COUNT}} anàlisis",
-	"Rate {{rating}} out of 10": "Nota {{rating} sobre 10",
+	"Rate {{rating}} out of 10": "Nota {{rating}} sobre 10",
 	"Rating": "Valoració",
 	"Read": "Llegit",
 	"Read Aloud": "Llegir en veu alta",
@@ -3379,7 +3379,7 @@
 	"Upload Progress": "Progrés de càrrega",
 	"Uploaded files or images": "Arxius o imatges pujats",
 	"Uploading": "S'està carregant",
-	"Uploading {{current}}/{{total}}: {{file}}": "Pujant {{current}}/{{total}}: {{arxiu}}",
+	"Uploading {{current}}/{{total}}: {{file}}": "Pujant {{current}}/{{total}}: {{file}}",
 	"Uploading...": "Pujant...",
 	"URL": "URL",
 	"URL is required": "La URL és necessària",
@@ -3393,7 +3393,7 @@
 	"Use segmented retrieval for focused and relevant content extraction.": "Utilitzar la recuperació segmentada per a l'extracció de contingut centrada i rellevant.",
 	"Use segmented retrieval for focused and relevant context.": "Utilitzar la recuperació segmentada per a un context centrat i rellevant.",
 	"Use segmented retrieval for focused context.": "Utilitzar la recuperació segmentada per al context.",
-	"Use these in model system prompts as {{example}}.": "Utilitzar-los a les indicacions del sistema del model com a {{exemple}}.",
+	"Use these in model system prompts as {{example}}.": "Utilitzar-los a les indicacions del sistema del model com a {{example}}.",
 	"Use Web Search?": "Utilitzar la cerca web?",
 	"user": "usuari",
 	"User": "Usuari",
```

**File**: `src/lib/i18n/locales/da-DK/translation.json` (modified, +1/-1)
```diff
@@ -5,7 +5,7 @@
 	"[Last] dddd [at] h:mm A": "[Sidste] dddd [kl.] h:mm A",
 	"[Today at] h:mm A": "[I dag kl.] h:mm A",
 	"[Yesterday at] h:mm A": "[I går kl.] h:mm A",
-	"{{ models }}": "{{ modeller }}",
+	"{{ models }}": "{{ models }}",
 	"{{count}} added lines_one": "",
 	"{{count}} added lines_other": "",
 	"{{COUNT}} Available Skills": "Tilgængelige færdigheder: {{COUNT}}",
```

**File**: `src/lib/i18n/locales/et-EE/translation.json` (modified, +1/-1)
```diff
@@ -5,7 +5,7 @@
 	"[Last] dddd [at] h:mm A": "[Eelmisel] dddd [kell] h:mm A",
 	"[Today at] h:mm A": "[Täna kell] h:mm A",
 	"[Yesterday at] h:mm A": "[Eile kell] h:mm A",
-	"{{ models }}": "{{ mudelid }}",
+	"{{ models }}": "{{ models }}",
 	"{{count}} added lines_one": "",
 	"{{count}} added lines_other": "",
 	"{{COUNT}} Available Skills": "",
```

**File**: `src/lib/i18n/locales/fi-FI/translation.json` (modified, +1/-1)
```diff
@@ -5,7 +5,7 @@
 	"[Last] dddd [at] h:mm A": "[Viimeisin] dddd h:mm A",
 	"[Today at] h:mm A": "[Tänään] h:mm A",
 	"[Yesterday at] h:mm A": "[Eilen] h:mm A",
-	"{{ models }}": "{{ mallit }}",
+	"{{ models }}": "{{ models }}",
 	"{{count}} added lines_one": "",
 	"{{count}} added lines_other": "",
 	"{{COUNT}} Available Skills": "{{COUNT}} taitoa käytettävissä",
```

---

### Incident Patch 2: `b988f06c` (2026-09-21)
**Commit Message**: fix: drop every local reference to a channel message that was deleted (#30314)

**File**: `src/lib/components/channel/Channel.svelte` (modified, +11/-1)
```diff
@@ -168,7 +168,17 @@
 					messages[idx] = data;
 				}
 			} else if (type === 'message:delete') {
-				messages = messages.filter((message) => message.id !== data.id);
+				messages = messages
+					.filter((message) => message.id !== data.id)
+					.map((message) =>
+						message?.reply_to_message?.id === data.id
+							? { ...message, reply_to_message: null }
+							: message
+					);
+
+				if (replyToMessage?.id === data.id) {
+					replyToMessage = null;
+				}
 
 				if (threadId === data.id) {
 					threadId = null;
```

**File**: `src/lib/components/channel/Thread.svelte` (modified, +11/-1)
```diff
@@ -92,7 +92,17 @@
 				}
 
 				if (messages) {
-					messages = messages.filter((message) => message.id !== data.id);
+					messages = messages
+						.filter((message) => message.id !== data.id)
+						.map((message) =>
+							message?.reply_to_message?.id === data.id
+								? { ...message, reply_to_message: null }
+								: message
+						);
+				}
+
+				if (replyToMessage?.id === data.id) {
+					replyToMessage = null;
 				}
 			} else if (type.includes('message:reaction')) {
 				if (messages) {
```

---

### Incident Patch 3: `4b61b86a` (2026-09-21)
**Commit Message**: fix: apply the knowledge File content filter on the first click (#30211)

**File**: `src/lib/components/workspace/Knowledge/KnowledgeBase.svelte` (modified, +1/-7)
```diff
@@ -1435,13 +1435,7 @@
 											currentPage = 1;
 										}}
 									>
-										<Checkbox
-											state={includeContent ? 'checked' : 'unchecked'}
-											on:change={(e) => {
-												includeContent = e.detail === 'checked';
-												currentPage = 1;
-											}}
-										/>
+										<Checkbox state={includeContent ? 'checked' : 'unchecked'} />
 										{$i18n.t('File content')}
 									</button>
 								</DropdownMenu>
```

---

### Incident Patch 4: `e8c26f83` (2026-09-21)
**Commit Message**: fix: stop the background memory review when memory is switched off (#30309)

With memories disabled instance-wide, or for a user barred from the feature,
the background review still ran every interval turn: it spent a task-model
call drafting memory operations and only then failed at the write, because
the router's permission check rejected it. The review now checks the
'memories.enable' switch and re-checks the 'features.memories' permission
the same way the context-injection path already does, so a model whose memory
capability is on no longer triggers memory work that can never land.

The permission lookup costs a groups query, so it runs last, after the free
config and interval gates; those stay on every turn's hot path.

**File**: `backend/open_webui/utils/memory.py` (modified, +8/-1)
```diff
@@ -8,6 +8,7 @@
 from fastapi import HTTPException
 from open_webui.models.config import Config
 from open_webui.models.memories import Memories
+from open_webui.utils.access_control import has_permission
 from open_webui.utils.json_codec import JSONCodec
 from open_webui.utils.misc import add_or_update_system_message, get_content_from_message
 
@@ -428,10 +429,12 @@ async def review_memory_after_turn(
         return
 
     config = await Config.get_many(
+        'memories.enable',
         'memories.background_review.enable',
         'memories.review_interval_turns',
+        'user.permissions',
     )
-    if not config.get('memories.background_review.enable'):
+    if not config.get('memories.enable') or not config.get('memories.background_review.enable'):
         return
 
     try:
@@ -443,6 +446,10 @@ async def review_memory_after_turn(
     if user_turns == 0 or user_turns % interval != 0:
         return
 
+    # features is client-supplied; re-check the permission the memory routes enforce.
+    if user.role != 'admin' and not await has_permission(user.id, 'features.memories', config.get('user.permissions')):
+        return
+
     task = asyncio.create_task(
         _review_memory(
             request=request,
```

---

### Incident Patch 5: `94eea41a` (2026-09-21)
**Commit Message**: fix: surface searchapi errors, news results and redirect links (#30308)

Web search via searchapi.io could come back empty or near-empty with no
hint of why: an invalid or expired API key turned into an empty result
set instead of an error, the google_news engine splits its results
between organic_results and top_stories and only the first block was
read, and google links came back as google.com/goto redirects the web
loader cannot fetch, so citations pointed at a redirect blob.

The search now reads both result blocks, asks google engines for
resolved destination links, raises on HTTP errors, carries a 30s request
timeout, skips result rows without a link, and logs the response body at
debug instead of dumping every search at info.

Fixes #30305

**File**: `backend/open_webui/retrieval/web/searchapi.py` (modified, +11/-4)
```diff
@@ -26,19 +26,26 @@ def search_searchapi(
     engine = engine or 'google'
 
     payload = {'engine': engine, 'q': query, 'api_key': api_key}
+    if engine.startswith('google'):
+        payload['link'] = 'resolved'
 
     url = f'{url}?{urlencode(payload)}'
-    response = requests.request('GET', url)
+    response = requests.request('GET', url, timeout=30)
+    response.raise_for_status()
 
     json_response = response.json()
-    log.info('results from searchapi search: %s', json_response)
+    log.debug('results from searchapi search: %s', json_response)
 
-    results = sorted(json_response.get('organic_results', []), key=lambda x: x.get('position', 0))
+    # top_stories entries carry no position, so the merged list keeps API order
+    results = [
+        *json_response.get('organic_results', []),
+        *json_response.get('top_stories', []),
+    ]
     if filter_list:
         results = get_filtered_results(results, filter_list)
     return [
         SearchResult(
-            link=result['link'],
+            link=result.get('link', ''),
             title=result.get('title'),
             snippet=result.get('snippet'),
         )
```

---

### Incident Patch 6: `9688d327` (2026-09-21)
**Commit Message**: fix: keep the background image chosen while creating a folder from the sidebar (#30218)

**File**: `src/lib/components/layout/Sidebar.svelte` (modified, +2/-1)
```diff
@@ -306,7 +306,7 @@
 		folders = folderMap;
 	};
 
-	const createFolder = async ({ name, data, parent_id }) => {
+	const createFolder = async ({ name, data, meta, parent_id }) => {
 		name = name?.trim();
 		if (!name) {
 			toast.error($i18n.t('Folder name cannot be empty.'));
@@ -343,6 +343,7 @@
 		const res = await createNewFolder(localStorage.token, {
 			name,
 			data,
+			meta,
 			parent_id
 		}).catch((error) => {
 			toast.error(`${error}`);
```

---

### Incident Patch 7: `c864e3ae` (2026-09-21)
**Commit Message**: fix: stop asking for chat variables a model's system prompt no longer declares (#30173)

**File**: `backend/open_webui/routers/models.py` (modified, +2/-0)
```diff
@@ -62,6 +62,8 @@ def add_chat_variables_schema(model_dict: dict) -> dict:
     schema = get_chat_variables_schema(system)
     if schema:
         model_dict.setdefault('meta', {})['chat_variables_schema'] = schema
+    elif isinstance(model_dict.get('meta'), dict):
+        model_dict['meta'].pop('chat_variables_schema', None)
     return model_dict
 
 
```

**File**: `backend/open_webui/utils/models.py` (modified, +4/-0)
```diff
@@ -187,6 +187,8 @@ async def get_all_models(request, refresh: bool = False, user: UserModel = None)
                     schema = get_chat_variables_schema(custom_model.params.model_dump().get('system'))
                     if schema:
                         model['info'].setdefault('meta', {})['chat_variables_schema'] = schema
+                    elif isinstance(model['info'].get('meta'), dict):
+                        model['info']['meta'].pop('chat_variables_schema', None)
 
                     action_ids = []
                     filter_ids = []
@@ -239,6 +241,8 @@ async def get_all_models(request, refresh: bool = False, user: UserModel = None)
             schema = get_chat_variables_schema(custom_model.params.model_dump().get('system'))
             if schema:
                 info.setdefault('meta', {})['chat_variables_schema'] = schema
+            elif isinstance(info.get('meta'), dict):
+                info['meta'].pop('chat_variables_schema', None)
             if 'params' in info:
                 # Remove params to avoid exposing sensitive info
                 del info['params']
```

---

### Incident Patch 8: `bc50026f` (2026-09-21)
**Commit Message**: fix: make the Delete Chat shortcut work whenever a chat is open, not only while its sidebar row is rendered (#30165)

**File**: `src/lib/components/chat/Navbar.svelte` (modified, +13/-0)
```diff
@@ -149,6 +149,19 @@
 									</button>
 								</Menu>
 							{/if}
+
+							{#if !$temporaryChatEnabled && ($user?.role === 'admin' || ($user?.permissions?.chat?.delete ?? true))}
+								<button
+									id="delete-chat-button"
+									aria-label={$i18n.t('Delete')}
+									class="hidden"
+									on:click={() => {
+										deleteChatHandler(chat.id);
+									}}
+								>
+									<EllipsisHorizontal className="size-4.5" strokeWidth="1.5" />
+								</button>
+							{/if}
 						</div>
 					{:else}
 						<div class="pointer-events-none invisible flex max-w-full min-w-0 items-center gap-2">
```

**File**: `src/lib/components/layout/Sidebar/ChatItem.svelte` (modified, +0/-14)
```diff
@@ -782,20 +782,6 @@
 							<MoreHorizontalIcon className="size-3.5" strokeWidth="2" />
 						</button>
 					</ChatMenu>
-
-					{#if id === $chatId && ($user?.role === 'admin' || ($user?.permissions?.chat?.delete ?? true))}
-						<!-- Shortcut support using "delete-chat-button" id -->
-						<button
-							id="delete-chat-button"
-							aria-label={$i18n.t('Delete')}
-							class="hidden"
-							on:click={() => {
-								showDeleteConfirm = true;
-							}}
-						>
-							<MoreHorizontalIcon className="size-3.5" strokeWidth="2" />
-						</button>
-					{/if}
 				</div>
 			{/if}
 		</div>
```

---

### Incident Patch 9: `438d9db8` (2026-09-21)
**Commit Message**: fix: correct recurrence rule parsing for schedules and calendar events (#29262)

* fix: correct recurrence rule parsing for schedules and calendar events

An automation set to repeat a limited number of times, say ten or a hundred, was treated as a one-shot and reported no repeat interval, because any count whose digits began with a one matched a text check for the one-shot case. The scheduler already answers that question correctly by asking the rule for its next two occurrences, so the text check is gone and the count is read as the number it is.

A recurrence rule that carries its start date on the same line as the repeat text kept that date when the automation was parsed, so the schedule ran from whatever date the rule happened to carry and ignored the start the user picked. The filter that drops the start date now splits the rule on any whitespace, the same way the rule parser itself does, so both agree on where one part of the rule ends and the next begins.

The same mismatch on the calendar path anchored a recurring event to the date inside its rule, so occurrences showed up before the event had begun and at the wrong time of day. That filter splits the rule the same way now

**File**: `backend/open_webui/utils/automations.py` (modified, +4/-6)
```diff
@@ -89,9 +89,9 @@ def _parse_rule(s: str, now: Optional[datetime] = None):
     rule = rules[0]
     start = rule._dtstart.replace(tzinfo=None)
     anchor = now or datetime.now()
-    lines = s.splitlines()
-    stripped = '\n'.join(line for line in lines if not line.upper().startswith('DTSTART')) or s
-    has_dtstart = any(line.upper().startswith('DTSTART') for line in lines)
+    parts = s.split()
+    stripped = '\n'.join(part for part in parts if not part.upper().startswith('DTSTART')) or s
+    has_dtstart = any(part.upper().startswith('DTSTART') for part in parts)
     step = {
         SECONDLY: timedelta(seconds=rule._interval),
         MINUTELY: timedelta(minutes=rule._interval),
@@ -183,9 +183,7 @@ def rrule_interval_seconds(s: str) -> Optional[int]:
     Returns None for one-shot (COUNT=1) schedules or rules
     with fewer than two future occurrences.
     """
-    if 'COUNT=1' in s:
-        return None
-    s = '\n'.join(line for line in s.splitlines() if not line.upper().startswith('DTSTART')) or s
+    s = '\n'.join(part for part in s.split() if not part.upper().startswith('DTSTART')) or s
     now = datetime.now()
     rule = _parse_rule(s, now)
     first = rule.after(now)
```

**File**: `backend/open_webui/utils/calendar.py` (modified, +1/-1)
```diff
@@ -44,7 +44,7 @@ def to_local_datetime(timestamp_ns: int) -> dt.datetime:
 
     original_start_ns = event_dict['start_at']
     original_start = to_local_datetime(original_start_ns)
-    rule_str = '\n'.join(line for line in rrule_str.splitlines() if not line.upper().startswith('DTSTART')) or rrule_str
+    rule_str = '\n'.join(part for part in rrule_str.split() if not part.upper().startswith('DTSTART')) or rrule_str
 
     try:
         # Anchor to the event's real start so day-of-week / day-of-month are correct
```

---

### Incident Patch 10: `7fa86732` (2026-09-21)
**Commit Message**: fix: resolve this instance's own file URLs in edit_image regardless of the URL host (#29691)

The native edit_image tool fails with "400: [ERROR: Error loading image]" whenever the model hands it an absolute URL for an image Open WebUI already stores. Such a URL is treated as local only when its host string matches the incoming request's host exactly, so a default-port form, a container name or any host the model composed itself falls through to an outbound HTTP fetch instead. That fetch asks /api/v1/files/{id}/content without a session, gets a 401, and the user sees the generic 400.

Match the file URL on its path and let the existing local branch resolve it. Fetching that endpoint over the network can never succeed for a local or a remote instance, because it requires an authenticated user, so the host comparison only decided which way the request failed. Access control is unchanged: the local branch still goes through get_file_content_by_id, which enforces owner, admin or shared access.

Fixes #29220

**File**: `backend/open_webui/routers/images.py` (modified, +2/-5)
```diff
@@ -920,11 +920,8 @@ async def load_url_image(data):
 
             if data.startswith('http://') or data.startswith('https://'):
                 parsed = urlparse(data)
-                if (
-                    parsed.netloc == urlparse(str(request.base_url)).netloc
-                    and parsed.path.startswith('/api/v1/files/')
-                    and '/content' in parsed.path
-                ):
+                # Fetching /api/v1/files/{id}/content over the network would be unauthenticated.
+                if parsed.path.startswith('/api/v1/files/') and '/content' in parsed.path:
                     return await load_url_image(parsed.path)
 
                 # Validate URL to prevent SSRF attacks against local/private networks.
```

#### Recent Merged Pull Requests:
- **PR #31653** (2026-09-30): fix: artifact preview sometimes closes the moment it auto-opens (@Classic298)
- **PR #31652** (2026-09-30): fix: artifact preview closes right after opening when a filter writes the reply (@Classic298)
- **PR #31650** (2026-09-30): fix: shared chats can't open new files attached together with a file already in the chat (@Classic298)
- **PR #31649** (2026-09-30): fix: iPhone HEIC photos are rejected by vision models (@Classic298)
- **PR #31647** (closed): feat: show input and output tokens on the Analytics dashboard (@silentoplayz)
- **PR #31645** (2026-09-30): feat: native hybrid search for Milvus and Milvus multitenancy (@Classic298)
- **PR #31644** (2026-09-30): fix: Playwright web loader returns only the site menu for pages with more than one <main> element (@Classic298)
- **PR #31641** (2026-09-30): fix: MCP tool calls ignore AIOHTTP_CLIENT_TIMEOUT_TOOL_SERVER (@Classic298)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
